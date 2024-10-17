import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";

export const toLamports = (n: string | number) => +n * LAMPORTS_PER_SOL;

export const serialize = (tx: Transaction) => {
  return tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString("base64");
};

export const deserialize = (tx: string) => {
  return Transaction.from(Buffer.from(tx, "base64"));
};

export const airdrop = async (publicKey: PublicKey) => {
  const sig = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
  return sendAndConfirmRawTransaction(sig);
};

export const makeKeypairs = (n = 1) => {
  return Array.from({ length: n }).map(() => Keypair.generate());
};

// TODO: DELETE!

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const retry = async <T>(
  fn: () => Promise<T>,
  retries: number,
  delay: number
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await wait(delay);
      return retry(fn, retries - 1, delay);
    }
    throw error;
  }
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

const getFeePrioritizationIxs = (cuPrice = 250_000, cuLimit = 200_000) => [
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: cuPrice }),
  ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit }),
];

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

  const tx = new Transaction();
  const signerPK = new PublicKey(signer);

  tx.feePayer = feePayer ? new PublicKey(feePayer) : signerPK;
  tx.recentBlockhash = latestBlockhash.blockhash;

  const createNonceAccountIx = SystemProgram.createAccount({
    fromPubkey: signerPK,
    newAccountPubkey: nonceKeypair.publicKey,
    lamports: rent,
    space: NONCE_ACCOUNT_LENGTH,
    programId: SystemProgram.programId,
  });

  const initNonceAccountIx = SystemProgram.nonceInitialize({
    authorizedPubkey: signerPK,
    noncePubkey: nonceKeypair.publicKey,
  });

  tx.add(createNonceAccountIx, initNonceAccountIx);
  tx.add(...getFeePrioritizationIxs());

  // tx.sign(nonceAuthKeypair, nonceKeypair);
  tx.partialSign(nonceKeypair);

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

  const latestBlockhash = await connection.getLatestBlockhash();

  const tx = new Transaction();
  const signerPK = new PublicKey(signer);

  tx.feePayer = feePayer ? new PublicKey(feePayer) : signerPK;
  tx.recentBlockhash = latestBlockhash.blockhash;

  const closeNonceIx = SystemProgram.nonceWithdraw({
    noncePubkey: nonceKeypair.publicKey,
    toPubkey: signerPK,
    authorizedPubkey: signerPK,
    lamports: balance,
  });

  tx.add(closeNonceIx);
  tx.add(...getFeePrioritizationIxs());

  return tx;
};

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
