import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { getPrioriFeeIxs, toLamports } from "src/lib/solana";

export const createAdvanceTx = ({
  noncePublicKey,
  nonce,
  signer,
  feePayer,
  recipient,
  amount,
}: {
  noncePublicKey: string;
  nonce: string;
  signer: string;
  feePayer?: string;
  recipient: string;
  amount: number;
}) => {
  const signerPK = new PublicKey(signer);
  const noncePK = new PublicKey(noncePublicKey);

  const ixs = [
    SystemProgram.nonceAdvance({
      authorizedPubkey: signerPK,
      noncePubkey: noncePK,
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
