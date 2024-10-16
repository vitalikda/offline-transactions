import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createLazyFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { toLamports } from "../lib/solana";

function IndexPage() {
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
    <div className="p-8 bg-zinc-900 shadow-md max-w-fit">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 text-left">
        <label htmlFor="recipient">Recipient:</label>
        <Input id="recipient" type="text" />
        <label htmlFor="amount">Amount:</label>
        <Input id="amount" type="text" />
        <Button type="submit" className="mt-4">
          Send Transaction
        </Button>
      </form>
    </div>
  );
}

export const Route = createLazyFileRoute("/")({
  component: IndexPage,
});
