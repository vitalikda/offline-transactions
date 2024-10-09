import { Transaction } from "@solana/web3.js";

export const serialize = (tx: Transaction) => {
  return tx.serialize({ requireAllSignatures: false }).toString("base64");
};

export const deserialize = (tx: string) => {
  return Transaction.from(Buffer.from(tx, "base64"));
};
