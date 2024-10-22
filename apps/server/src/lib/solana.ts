import {
  ComputeBudgetProgram,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
  clusterApiUrl,
} from "@solana/web3.js";

export const isSolanaAddress = (address: string) => {
  return PublicKey.isOnCurve(new PublicKey(address).toBuffer());
};

export const toLamports = (n: string | number) => +n * LAMPORTS_PER_SOL;

export const serialize = (tx: VersionedTransaction) => {
  return Buffer.from(tx.serialize()).toString("base64");
};

export const deserialize = (tx: string) => {
  return VersionedTransaction.deserialize(Buffer.from(tx, "base64"));
};

export const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

export const sendAndConfirmRawTransaction = async (tx: string) => {
  const signature = await connection.sendRawTransaction(
    Buffer.from(tx, "base64")
  );

  const latestBlockHash = await connection.getLatestBlockhash();
  const conf = await connection.confirmTransaction({
    ...latestBlockHash,
    signature,
  });

  if (conf.value.err) {
    throw new Error(`Transaction failed: ${conf.value.err}`);
  }

  return signature;
};

export const getPrioriFeeIxs = (cuPrice = 250_000, cuLimit = 200_000) => [
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: cuPrice }),
  ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit }),
];
