import {
  Keypair,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  SystemProgram,
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

export const createNonceAccount = async ({
  nonceAccount,
  nonceAuthority,
  feePayer,
}: {
  nonceAccount: Keypair;
  nonceAuthority: Keypair;
  feePayer: string;
}) => {
  const rent =
    await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);

  const latestBlockhash = await connection.getLatestBlockhash();

  const feePayerPK = new PublicKey(feePayer);

  const ixs = [
    SystemProgram.createAccount({
      fromPubkey: feePayerPK,
      newAccountPubkey: nonceAccount.publicKey,
      lamports: rent,
      space: NONCE_ACCOUNT_LENGTH,
      programId: SystemProgram.programId,
    }),
    SystemProgram.nonceInitialize({
      authorizedPubkey: nonceAuthority.publicKey,
      noncePubkey: nonceAccount.publicKey,
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: feePayerPK,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: ixs.concat(getPrioriFeeIxs()),
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  tx.sign([nonceAccount]);

  return tx;
};

export const closeNonceAccount = async ({
  nonceAccountPublicKey,
  nonceAuthority,
  feePayer,
}: {
  nonceAccountPublicKey: string;
  nonceAuthority: Keypair;
  feePayer: string;
}) => {
  const noncePK = new PublicKey(nonceAccountPublicKey);

  const balance = await connection.getBalance(noncePK);
  if (!balance) {
    throw new Error(`Nonce account balance for ${nonceAccountPublicKey} is 0`);
  }

  const rent =
    await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  if (balance < rent) {
    throw new Error(
      `Nonce account balance for ${nonceAccountPublicKey} is less than rent: ${balance} < ${rent}`
    );
  }

  const latestBlockhash = await connection.getLatestBlockhash();

  const feePayerPK = new PublicKey(feePayer);

  const ixs = [
    SystemProgram.nonceWithdraw({
      noncePubkey: noncePK,
      toPubkey: feePayerPK,
      lamports: balance,
      authorizedPubkey: nonceAuthority.publicKey,
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: feePayerPK,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: ixs.concat(getPrioriFeeIxs()),
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  tx.sign([nonceAuthority]);

  return tx;
};
