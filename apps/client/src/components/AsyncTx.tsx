import { useWallet } from "@solana/wallet-adapter-react";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { toast } from "sonner";
import { createNonce, executeTransaction } from "../lib/nonce";

const nonceKeypair = Keypair.generate();
const nonceAuthKeypair = Keypair.fromSecretKey(
  bs58.decode(import.meta.env.VITE_AUTH_KEYPAIR)
);

const toLamports = (n: string | number) => +n * LAMPORTS_PER_SOL;

export const AsyncTx = () => {
  const { publicKey, signTransaction } = useWallet();

  // const airdrop = async () => {
  //   const airdropSignature = await connection.requestAirdrop(
  //     nonceAuthKeypair.publicKey,
  //     LAMPORTS_PER_SOL
  //   );
  //   const res = await connection.confirmTransaction(
  //     airdropSignature,
  //     "confirmed"
  //   );
  //   console.log("airdrop", res);
  // };

  // const createNonce = async () => {
  //   if (!publicKey) return;

  //   try {
  //     const nonce = await createNonce(nonceKeypair, nonceAuthKeypair);
  //     console.log("Nonce", nonce);

  //     setNonce(nonce);
  //     toast.info("Nonce received!");
  //   } catch (error) {
  //     console.log(error);
  //     toast.error("Failed to get nonce!");
  //   }
  // };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const recipient = event.currentTarget.recipient.value;
      const amount = event.currentTarget.amount.value;

      if (!publicKey) throw new Error("Wallet not connected");
      if (!recipient) throw new Error("Recipient not provided");
      if (!amount) throw new Error("Amount not provided");

      console.log("Creating nonce for: ", nonceKeypair.publicKey.toBase58());

      const nonce = await createNonce(nonceKeypair, nonceAuthKeypair);
      console.log("Nonce", nonce);

      const advanceIx = SystemProgram.nonceAdvance({
        authorizedPubkey: nonceAuthKeypair.publicKey,
        noncePubkey: nonceKeypair.publicKey,
      });

      const transferIx = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(recipient),
        lamports: toLamports(amount),
      });

      const tx = new Transaction();

      tx.add(advanceIx, transferIx);
      tx.recentBlockhash = nonce;
      tx.feePayer = publicKey;
      tx.sign(nonceAuthKeypair);

      const signedTx = await signTransaction?.(tx);
      if (!signedTx) throw new Error("Transaction not signed");

      console.log(signedTx.serializeMessage().toString("base64"));

      await executeTransaction(
        signedTx.serialize({ requireAllSignatures: false })
      );

      toast.info("Transaction signed!");
    } catch (error) {
      console.error(error);
      const msg = (error as { message: string })?.message ?? "";
      toast.error(`Transaction failed! ${msg}`);
    }
  };

  if (!publicKey) return null;

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        textAlign: "left",
      }}
    >
      <label htmlFor="recipient">Recipient:</label>
      <input id="recipient" type="text" />
      <label htmlFor="amount">Amount:</label>
      <input id="amount" type="text" />
      <br />
      <button type="submit">Async Transaction</button>
    </form>
  );
};
