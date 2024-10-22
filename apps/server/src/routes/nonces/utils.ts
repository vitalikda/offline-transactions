import {
  Keypair,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { retry } from "src/lib/retry";
import { connection, getPrioriFeeIxs } from "src/lib/solana";

export const getKeypair = () => Keypair.generate();

export const encodeKeypair = (kp: Keypair) => bs58.encode(kp.secretKey);

export const getAuthKeypair = (secret: string) => {
  return Keypair.fromSecretKey(bs58.decode(secret));
};

export const makeKeypairs = (n = 1) => {
  return Array.from({ length: n }).map(() => getKeypair());
};

const getAccountInfo = async ({ publicKey }: { publicKey: PublicKey }) => {
  console.log("Fetching nonce account info");
  const accountInfo = await connection.getAccountInfo(publicKey);
  if (!accountInfo) {
    throw new Error(`Nonce account not found: ${publicKey.toString()}`);
  }
  return accountInfo;
};

export const getNonceInfo = async (publicKey: string) => {
  // Note: nonce account is not available immediately after creation
  const accountInfo = await retry(
    () => getAccountInfo({ publicKey: new PublicKey(publicKey) }),
    3,
    3000
  );
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
  sender,
  nonceKeypair,
}: {
  sender: string;
  nonceKeypair: Keypair;
}) => {
  const senderPubkey = new PublicKey(sender);

  const balance = await connection.getBalance(nonceKeypair.publicKey);
  if (!balance) return;

  const latestBlockhash = await connection.getLatestBlockhash();

  const closeNonceIx = SystemProgram.nonceWithdraw({
    noncePubkey: nonceKeypair.publicKey,
    toPubkey: senderPubkey,
    authorizedPubkey: senderPubkey,
    lamports: balance,
  });

  const tx = new Transaction();

  tx.add(closeNonceIx);

  tx.feePayer = senderPubkey;
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;

  tx.partialSign(nonceKeypair);

  return tx;
};
