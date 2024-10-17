import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Keypair } from "@solana/web3.js";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  closeNonceTx,
  connection,
  createNonceTx,
  deserialize,
  getNonceInfo,
  makeKeypairs,
  sendAndConfirmRawTransaction,
  serialize,
} from "../lib/solana";
import { confirmAdvanceTransaction, getAdvanceTransaction } from "../utils/api";

function AsyncPage() {
  const { publicKey, signAllTransactions, sendTransaction } = useWallet();

  const [loading, setLoading] = useState(false);

  const [nonces, setNonces] = useState<{ keypair: Keypair; nonce: string }[]>(
    []
  );

  const [advanceTransaction, setAdvanceTransaction] =
    useState<Awaited<ReturnType<typeof getAdvanceTransaction>>>();

  const [toCreate, setToCreate] = useState(1);
  const increase = () => setToCreate((s) => s + 1);
  const decrease = () => setToCreate((s) => (s > 1 ? s - 1 : s));

  const onCreateNonce = async () => {
    if (!publicKey) return;

    try {
      const nonceKeypairs = makeKeypairs(toCreate);

      const noncesTxs = await Promise.all(
        nonceKeypairs.map((nonceKeypair) =>
          createNonceTx({
            nonceKeypair,
            signer: publicKey.toString(),
          })
        )
      );
      console.log("NonceTx: ", noncesTxs.map((tx) => serialize(tx)).join(", "));

      const txSigned = await signAllTransactions?.(noncesTxs);
      if (!txSigned) throw new Error("Transaction not signed");

      await Promise.all(
        // txSigned.map((tx) => sendTransaction?.(tx, connection)) // NOTE: each tx require confirmation
        txSigned.map((tx) => sendAndConfirmRawTransaction(serialize(tx)))
      );

      const newNonces = await Promise.all(
        nonceKeypairs.map(async (keypair, i) => {
          console.log(`Keypair:${i}: ${keypair.publicKey}`);
          const nonceAccount = await getNonceInfo(keypair);
          console.log(`Nonce:${i}: ${nonceAccount.nonce}`);
          return { keypair, nonce: nonceAccount.nonce };
        })
      );

      console.log("KeypairNonce: ", newNonces);
      setNonces((s) => [...s, ...newNonces]);

      toast.info("Nonces received!");
    } catch (error) {
      console.log(error);
      toast.error("Failed to get nonce!");
    } finally {
      setToCreate(1);
    }
  };

  const [toRemove, setToRemove] = useState<string[]>([]);
  const onRemoveNonces = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    console.log("Removing nonces: ", toRemove);
    try {
      if (!publicKey) throw new Error("Wallet not connected");

      const nonceKeypairs = nonces
        .filter(({ nonce }) => toRemove.includes(nonce))
        .map(({ keypair }) => keypair);

      console.log("Keypair: ", nonceKeypairs[0].secretKey);

      const closeTxs = await Promise.all(
        nonceKeypairs.map((nonceKeypair) =>
          closeNonceTx({
            nonceKeypair,
            signer: publicKey.toString(),
          })
        )
      );
      console.log("CloseTxs: ", closeTxs);

      const txSigned = await signAllTransactions?.(closeTxs);
      if (!txSigned) throw new Error("Transaction not signed");

      await Promise.all(
        // txSigned.map((tx) => sendTransaction?.(tx, connection)) // NOTE: each tx require confirmation
        txSigned.map((tx) => sendAndConfirmRawTransaction(serialize(tx)))
      );

      setNonces((s) => [...s].filter(({ nonce }) => !toRemove.includes(nonce)));

      toast.info("Nonce removed!");
    } catch (error) {
      console.log(error);
      toast.error("Failed to remove nonce!");
    }
  };

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
      const signedTx = await signAllTransactions?.([advanceTx]);
      if (!signedTx) throw new Error("Transaction not signed");

      setAdvanceTransaction(undefined);
      const sig = serialize(signedTx[0]);
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
    <div className="flex gap-4">
      <div className="p-8 bg-zinc-900 shadow-md min-w-64 max-w-fit">
        <form onSubmit={onRemoveNonces} className="flex flex-col gap-2">
          {!!nonces.length && (
            <>
              {nonces.map(({ nonce }, i) => (
                <div key={`${i}${nonce}`} className="flex space-x-2">
                  <Checkbox
                    id={nonce}
                    onCheckedChange={(v) => {
                      if (v) {
                        setToRemove((s) => [...s, nonce]);
                      } else {
                        setToRemove((s) => s.filter((n) => n !== nonce));
                      }
                    }}
                  />
                  <label
                    htmlFor={nonce}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {nonce}
                  </label>
                </div>
              ))}
              <Button type="submit" variant="outline">
                Remove Nonces
              </Button>
              <br className="my-2" />
            </>
          )}

          <div className="flex gap-1 items-center">
            <Button onClick={decrease} size="icon" variant="ghost">
              -
            </Button>
            <span className="p-2">{toCreate}</span>
            <Button onClick={increase} size="icon" variant="ghost">
              +
            </Button>
            <Button onClick={() => onCreateNonce()} className="ml-auto">
              Create Nonce
            </Button>
          </div>
        </form>
      </div>
      <div className="p-8 bg-zinc-900 shadow-md max-w-fit">
        <form onSubmit={onSubmit} className="flex flex-col gap-2 text-left">
          <label htmlFor="recipient">Recipient:</label>
          <Input id="recipient" type="text" />
          <label htmlFor="amount">Amount:</label>
          <Input id="amount" type="text" />
          <Button disabled={loading} type="submit" className="mt-4">
            Async Transaction
          </Button>
        </form>
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/async")({
  component: AsyncPage,
});
