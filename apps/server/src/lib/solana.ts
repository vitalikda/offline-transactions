import { LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";

export const isSolanaAddress = (address: string) => {
  return PublicKey.isOnCurve(new PublicKey(address).toBuffer());
};

export const toLamports = (n: string | number) => +n * LAMPORTS_PER_SOL;

export const serialize = (tx: Transaction) => {
  return tx.serialize({ requireAllSignatures: false }).toString("base64");
};

export const deserialize = (tx: string) => {
  return Transaction.from(Buffer.from(tx, "base64"));
};
