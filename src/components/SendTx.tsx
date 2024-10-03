import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { toast } from "sonner";

const toLamports = (n: string | number) => +n * LAMPORTS_PER_SOL;

export const SendTx = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const recipient = event.currentTarget.recipient.value;
      const amount = event.currentTarget.amount.value;

      if (!publicKey) throw new Error("Wallet not connected");
      if (!recipient) throw new Error("Recipient not provided");
      if (!amount) throw new Error("Amount not provided");

      const sendSolInstruction = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(recipient),
        lamports: toLamports(amount),
      });

      const tx = new Transaction().add(sendSolInstruction);

      const txSig = await sendTransaction(tx, connection);

      const latestBlockhash = await connection.getLatestBlockhash();

      await connection.confirmTransaction(
        { signature: txSig, ...latestBlockhash },
        "confirmed"
      );

      toast.info("Transaction sent!");
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
        padding: "1rem",
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
      <button type="submit">Send Transaction (devnet)</button>
    </form>
  );
};
