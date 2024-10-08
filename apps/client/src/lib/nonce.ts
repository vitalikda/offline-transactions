import {
  Connection,
  type Keypair,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { retry } from "./retry";

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
  const rent = await connection.getMinimumBalanceForRentExemption(
    NONCE_ACCOUNT_LENGTH
  );

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

export const createNonce = async (
  nonceKeypair: Keypair,
  nonceAuthKeypair: Keypair
) => {
  const tx = await createNonceTx(nonceKeypair, nonceAuthKeypair);
  await sendAndConfirmRawTransaction(connection, tx.serialize());

  const nonceAccount = await getNonceInfo(nonceKeypair);

  return nonceAccount.nonce;
};

export const executeTransaction = async (signedTx: Buffer) => {
  return sendAndConfirmRawTransaction(connection, signedTx);
};
