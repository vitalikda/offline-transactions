import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import bs58 from "bs58";
import { retry } from "./utils";

export const toLamports = (n: string | number) => +n * LAMPORTS_PER_SOL;

export const serialize = (tx: VersionedTransaction) => {
  return Buffer.from(tx.serialize()).toString("base64");
};

export const deserialize = (tx: string) => {
  return VersionedTransaction.deserialize(Buffer.from(tx, "base64"));
};

export const getKeypair = () => Keypair.generate();

export const encodeKeypair = (kp: Keypair) => bs58.encode(kp.secretKey);

export const getAuthKeypair = (secret: string) => {
  return Keypair.fromSecretKey(bs58.decode(secret));
};

export const makeKeypairs = (n = 1) => {
  return Array.from({ length: n }).map(() => getKeypair());
};

export const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

export const sendAndConfirmRawTransaction = async (tx: string) => {
  const signature = await connection.sendRawTransaction(
    Buffer.from(tx, "base64")
  );
  console.log("Signature: ", signature);

  const latestBlockHash = await connection.getLatestBlockhash();
  const conf = await connection.confirmTransaction({
    ...latestBlockHash,
    signature,
  });
  console.log("Confirmation: ", conf);

  if (conf.value.err) {
    throw new Error(`Transaction failed: ${conf.value.err}`);
  }

  return signature;
};

export const airdrop = async (publicKey: PublicKey) => {
  const sig = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
  return sendAndConfirmRawTransaction(sig);
};

const getPrioriFeeIxs = (cuPrice = 250_000, cuLimit = 200_000) => [
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: cuPrice }),
  ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit }),
];

const getAccountInfo = async ({ publicKey }: { publicKey: PublicKey }) => {
  console.log("Fetching nonce account info");
  const accountInfo = await connection.getAccountInfo(publicKey);
  if (!accountInfo) {
    throw new Error(`Nonce account not found: ${publicKey.toString()}`);
  }
  return accountInfo;
};

export const getNonceInfo = async ({ publicKey }: { publicKey: PublicKey }) => {
  // Note: nonce account is not available immediately after creation
  const accountInfo = await retry(() => getAccountInfo({ publicKey }), 3, 3000);
  return NonceAccount.fromAccountData(accountInfo.data);
};

export const createNonceTx = async ({
  nonceKeypair,
  signer,
  feePayer,
}: {
  nonceKeypair: Keypair;
  signer: string;
  feePayer?: string;
}) => {
  const rent =
    await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);

  const latestBlockhash = await connection.getLatestBlockhash();

  const signerPK = new PublicKey(signer);

  const ixs = [
    SystemProgram.createAccount({
      fromPubkey: signerPK,
      newAccountPubkey: nonceKeypair.publicKey,
      lamports: rent,
      space: NONCE_ACCOUNT_LENGTH,
      programId: SystemProgram.programId,
    }),

    SystemProgram.nonceInitialize({
      authorizedPubkey: signerPK,
      noncePubkey: nonceKeypair.publicKey,
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: feePayer ? new PublicKey(feePayer) : signerPK,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: ixs.concat(getPrioriFeeIxs()),
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  tx.sign([nonceKeypair]);

  return tx;
};

export const closeNonceTx = async ({
  nonceKeypair,
  signer,
  feePayer,
}: {
  nonceKeypair: Keypair;
  signer: string;
  feePayer?: string;
}) => {
  const balance = await connection.getBalance(nonceKeypair.publicKey);
  if (!balance) {
    throw new Error(
      `Nonce account not found: ${nonceKeypair.publicKey.toString()}`
    );
  }

  const rent =
    await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  if (balance < rent) {
    throw new Error(
      `Nonce account balance for ${nonceKeypair.publicKey.toString()} is less than rent: ${balance} < ${rent}`
    );
  }

  const latestBlockhash = await connection.getLatestBlockhash();

  const signerPK = new PublicKey(signer);

  const ixs = [
    SystemProgram.nonceWithdraw({
      noncePubkey: nonceKeypair.publicKey,
      toPubkey: signerPK,
      authorizedPubkey: signerPK,
      lamports: balance,
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: feePayer ? new PublicKey(feePayer) : signerPK,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: ixs.concat(getPrioriFeeIxs()),
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  return tx;
};

export const createAdvanceTx = ({
  nonceKeypair,
  nonce,
  signer,
  feePayer,
  recipient,
  amount,
}: {
  nonceKeypair: Keypair;
  nonce: string;
  signer: string;
  feePayer?: string;
  recipient: string;
  amount: number;
}) => {
  const signerPK = new PublicKey(signer);

  const ixs = [
    SystemProgram.nonceAdvance({
      authorizedPubkey: signerPK,
      noncePubkey: nonceKeypair.publicKey,
    }),
    SystemProgram.transfer({
      fromPubkey: signerPK,
      toPubkey: new PublicKey(recipient),
      lamports: toLamports(amount),
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: feePayer ? new PublicKey(feePayer) : signerPK,
    recentBlockhash: nonce,
    instructions: ixs.concat(getPrioriFeeIxs()),
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  return tx;
};
