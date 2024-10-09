import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { toast } from "sonner";
import { deserialize, serialize } from "../lib/solana";
import { confirmAdvanceTransaction, getAdvanceTransaction } from "../utils/api";

export const AsyncTx = () => {
  const { publicKey, signTransaction } = useWallet();

  const [loading, setLoading] = useState(false);
  const [advanceTransaction, setAdvanceTransaction] =
    useState<Awaited<ReturnType<typeof getAdvanceTransaction>>>();

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
    setLoading(true);

    try {
      const recipient = event.currentTarget.recipient.value;
      const amount = event.currentTarget.amount.value;

      if (!publicKey) throw new Error("Wallet not connected");
      if (!recipient) throw new Error("Recipient not provided");
      if (!amount) throw new Error("Amount not provided");

      let tx = advanceTransaction;
      if (!tx) {
        tx = await getAdvanceTransaction(
          publicKey.toString(),
          recipient,
          amount
        );
        setAdvanceTransaction(tx);
      }

      const advanceTx = deserialize(tx.transaction);
      const signedTx = await signTransaction?.(advanceTx);
      if (!signedTx) throw new Error("Transaction not signed");

      setAdvanceTransaction(undefined);
      const sig = serialize(signedTx);
      console.log(sig);
      await confirmAdvanceTransaction(tx.id, sig);

      toast.info("Transaction signed!");
    } catch (error) {
      console.error(error);
      const msg = (error as { message: string })?.message ?? "";
      toast.error(`Transaction failed! ${msg}`);
    } finally {
      setLoading(false);
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
      <button disabled={loading} type="submit">
        Async Transaction
      </button>
    </form>
  );
};
