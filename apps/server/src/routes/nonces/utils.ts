import {
  Connection,
  Keypair,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import bs58 from "bs58";
import { env } from "src/lib/env";
import { retry } from "src/lib/retry";
import { serialize, toLamports } from "src/lib/solana";

export const getKeypair = () => Keypair.generate();

export const getAuthKeypair = () => {
  return Keypair.fromSecretKey(bs58.decode(env.AUTH_KEYPAIR));
};

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

const sendAndConfirmRawTransaction = async (
  connection: Connection,
  tx: Buffer
) => {
  const signature = await connection.sendRawTransaction(tx);
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

const createNonceTx = async (
  nonceKeypair: Keypair,
  nonceAuthKeypair: Keypair
) => {
  const rent =
    await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);

  const latestBlockhash = await connection.getLatestBlockhash();

  const createNonceAccountIx = SystemProgram.createAccount({
    fromPubkey: nonceAuthKeypair.publicKey,
    newAccountPubkey: nonceKeypair.publicKey,
    lamports: rent,
    space: NONCE_ACCOUNT_LENGTH,
    programId: SystemProgram.programId,
  });

  const initNonceAccountIx = SystemProgram.nonceInitialize({
    authorizedPubkey: nonceAuthKeypair.publicKey,
    noncePubkey: nonceKeypair.publicKey,
  });

  const tx = new Transaction();

  tx.add(createNonceAccountIx, initNonceAccountIx);

  tx.feePayer = nonceAuthKeypair.publicKey;
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;

  tx.sign(nonceAuthKeypair, nonceKeypair);

  return tx;
};

const getAccountInfo = async ({ publicKey }: Keypair) => {
  console.log("Fetching nonce account info");
  const accountInfo = await connection.getAccountInfo(publicKey);
  if (!accountInfo) {
    throw new Error(`Nonce account not found: ${publicKey.toString()}`);
  }
  return accountInfo;
};

const getNonceInfo = async (nonceKeypair: Keypair) => {
  // Note: nonce account is not available immediately after creation
  const accountInfo = await retry(() => getAccountInfo(nonceKeypair), 3, 3000);
  return NonceAccount.fromAccountData(accountInfo.data);
};

export const createNonce = async ({
  nonceKeypair,
  nonceAuthKeypair,
}: {
  nonceKeypair: Keypair;
  nonceAuthKeypair: Keypair;
}) => {
  const tx = await createNonceTx(nonceKeypair, nonceAuthKeypair);
  await sendAndConfirmRawTransaction(connection, tx.serialize());

  const nonceAccount = await getNonceInfo(nonceKeypair);

  return nonceAccount.nonce;
};

export const createAdvanceTransaction = async ({
  nonce,
  nonceKeypair,
  nonceAuthKeypair,
  sender,
  recipient,
  amount,
}: {
  nonceKeypair: Keypair;
  nonceAuthKeypair: Keypair;
  nonce: string;
  sender: string;
  recipient: string;
  amount: number;
}) => {
  const advanceIx = SystemProgram.nonceAdvance({
    authorizedPubkey: nonceAuthKeypair.publicKey,
    noncePubkey: nonceKeypair.publicKey,
  });

  const senderPubkey = new PublicKey(sender);

  const transferIx = SystemProgram.transfer({
    fromPubkey: senderPubkey,
    toPubkey: new PublicKey(recipient),
    lamports: toLamports(amount),
  });

  const tx = new Transaction();

  tx.add(advanceIx, transferIx);
  tx.recentBlockhash = nonce;
  tx.feePayer = senderPubkey;
  tx.sign(nonceAuthKeypair);

  return serialize(tx);
};

export const executeTransaction = async (signature: string) => {
  const signedTx = Buffer.from(signature, "base64");
  return sendAndConfirmRawTransaction(connection, signedTx);
};
