import {
  type Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { getPrioriFeeIxs, toLamports } from "src/lib/solana";
import { getNonceInfo } from "src/routes/nonces/utils";

export const createAdvanceTransfer = async ({
  nonceAccountPublicKey,
  nonceAuthority,
  feePayer,
  sender,
  recipient,
  amount,
}: {
  nonceAccountPublicKey: string;
  nonceAuthority: Keypair;
  feePayer: string;
  sender: string;
  recipient: string;
  amount: number;
}) => {
  const { nonce } = await getNonceInfo(nonceAccountPublicKey);

  const noncePK = new PublicKey(nonceAccountPublicKey);

  const ixs = [
    SystemProgram.nonceAdvance({
      authorizedPubkey: nonceAuthority.publicKey,
      noncePubkey: noncePK,
    }),
    SystemProgram.transfer({
      fromPubkey: new PublicKey(sender),
      toPubkey: new PublicKey(recipient),
      lamports: toLamports(amount),
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: new PublicKey(feePayer),
    recentBlockhash: nonce,
    instructions: ixs.concat(getPrioriFeeIxs()),
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  tx.sign([nonceAuthority]);

  return tx;
};
