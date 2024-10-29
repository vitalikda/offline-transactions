import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWallet } from "@solana/wallet-adapter-react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  closeNonceTx,
  createAdvanceTx,
  createNonceTx,
  encodeKeypair,
  getNonceInfo,
  makeKeypairs,
  sendAndConfirmRawTransaction,
  serialize,
} from "../lib/solana";
import { toKey } from "../lib/utils";

type NonceKey = ReturnType<typeof toKey>;
type Nonce = {
  publicKey: string;
  secretKey: string;
  nonce: string;
};

interface State {
  nonces: Record<NonceKey, Nonce>;
  addNonces: (nonces: Nonce[]) => void;
  closeNonces: (nonceKeys: NonceKey[]) => void;
}

const useNonces = create(
  persist<State>(
    (set) => ({
      nonces: {},
      addNonces: (nonces) =>
        set((s) => {
          const newNonces = s.nonces;
          for (const n of nonces) {
            newNonces[toKey(n.publicKey, n.nonce)] = n;
          }
          return { nonces: newNonces };
        }),
      closeNonces: (nonceKeys) =>
        set((s) => {
          const newNonces = s.nonces;
          for (const key of nonceKeys) {
            delete newNonces[key];
          }
          return { nonces: newNonces };
        }),
    }),
    {
      name: "nonces",
    }
  )
);

function NonceForm() {
  const { publicKey, signAllTransactions } = useWallet();

  const [busy, setBusy] = useState(false);

  const { nonces, addNonces, closeNonces } = useNonces();

  const [toCreate, setToCreate] = useState(1);
  const increase = () => setToCreate((s) => s + 1);
  const decrease = () => setToCreate((s) => (s > 1 ? s - 1 : s));

  const onCreateNonce = async () => {
    if (!publicKey) return;
    setBusy(true);

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
          const nonceAccount = await getNonceInfo(keypair.publicKey.toString());
          console.log(`Nonce:${i}: ${nonceAccount.nonce}`);
          return { keypair, nonce: nonceAccount.nonce };
        })
      );

      console.log("KeypairNonce: ", newNonces);
      addNonces(
        newNonces.map((n) => ({
          publicKey: n.keypair.publicKey.toString(),
          secretKey: encodeKeypair(n.keypair),
          nonce: n.nonce,
        }))
      );

      toast.info("Nonces received!");
    } catch (error) {
      console.log(error);
      toast.error("Failed to get nonce!");
    } finally {
      setToCreate(1);
      setBusy(false);
    }
  };

  const [toCloseKeys, setToCloseKeys] = useState<NonceKey[]>([]);

  const onCloseNonces = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    console.log("Closing nonces: ", toCloseKeys);
    try {
      if (!publicKey) throw new Error("Wallet not connected");

      const closeTxs = await Promise.all(
        toCloseKeys.map((key) => {
          const nonce = nonces[key];
          if (!nonce) throw new Error("Nonce not found");
          return closeNonceTx({
            noncePublicKey: nonce.publicKey,
            signer: publicKey.toString(),
          });
        })
      );
      console.log("CloseTxs: ", closeTxs);

      const txSigned = await signAllTransactions?.(closeTxs);
      if (!txSigned) throw new Error("Transaction not signed");

      await Promise.all(
        // txSigned.map((tx) => sendTransaction?.(tx, connection)) // NOTE: each tx require confirmation
        txSigned.map((tx) => sendAndConfirmRawTransaction(serialize(tx)))
      );

      console.log("CloseKeys: ", toCloseKeys);
      setToCloseKeys([]);
      closeNonces(toCloseKeys);

      toast.info("Nonce closed!");
    } catch (error) {
      console.log(error);
      toast.error("Failed to close nonce!");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onCloseNonces} className="flex flex-col gap-2">
      {!!Object.keys(nonces).length && (
        <>
          {Object.entries(nonces).map(([key, { publicKey, nonce }]) => {
            return (
              <div key={key} className="flex space-x-2">
                <Checkbox
                  id={nonce}
                  onCheckedChange={(v) => {
                    if (v) {
                      setToCloseKeys((s) => [...s, key as NonceKey]);
                    } else {
                      setToCloseKeys((s) => s.filter((n) => n !== key));
                    }
                  }}
                />
                <div className="flex flex-col space-y-1">
                  <label
                    htmlFor={nonce}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {nonce}
                  </label>
                  <span className="text-xs text-zinc-400 font-medium leading-none">
                    by {publicKey}
                  </span>
                </div>
              </div>
            );
          })}
          <Button
            disabled={!toCloseKeys.length || busy}
            type="submit"
            variant="outline"
          >
            Close Nonces
          </Button>
          <br className="my-2" />
        </>
      )}

      <div className="flex gap-1 items-center">
        <Button onClick={decrease} disabled={busy} size="icon" variant="ghost">
          -
        </Button>
        <span className="p-2">{toCreate}</span>
        <Button onClick={increase} disabled={busy} size="icon" variant="ghost">
          +
        </Button>
        <Button
          onClick={() => onCreateNonce()}
          disabled={busy}
          className="ml-auto"
        >
          Create Nonce
        </Button>
      </div>
    </form>
  );
}

function TransferForm() {
  const { publicKey, signTransaction } = useWallet();

  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);

  const { nonces, addNonces, closeNonces } = useNonces();
  const [selectId, setSelectId] = useState(0);
  const noNonces = !Object.keys(nonces).length;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    try {
      const recipient = event.currentTarget.recipient.value;
      const amount = event.currentTarget.amount.value;

      if (!publicKey) throw new Error("Wallet not connected");
      if (!recipient) throw new Error("Recipient not provided");
      if (!amount) throw new Error("Amount not provided");

      const [nonceKey, nonce] = Object.entries(nonces)[selectId];
      if (!nonce) throw new Error("Nonce not found");

      const advanceTx = createAdvanceTx({
        noncePublicKey: nonce.publicKey,
        nonce: nonce.nonce,
        signer: publicKey.toString(),
        recipient,
        amount,
      });
      console.log("AdvanceTx: ", serialize(advanceTx));

      const signedTx = await signTransaction?.(advanceTx);
      if (!signedTx) throw new Error("Transaction not signed");

      await sendAndConfirmRawTransaction(serialize(signedTx));
      const newNonce = await getNonceInfo(nonce.publicKey);
      addNonces([{ ...nonce, nonce: newNonce.nonce }]);
      closeNonces([nonceKey as NonceKey]);

      formRef.current?.reset();
      toast.info("Transaction sent!");
    } catch (error) {
      console.log(error);
      toast.error("Transaction failed!");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      ref={formRef}
      className="flex flex-col gap-2 text-left"
    >
      <label htmlFor="recipient">Recipient:</label>
      <Input disabled={noNonces} id="recipient" type="text" required />
      <label htmlFor="amount">Amount:</label>
      <Input disabled={noNonces} id="amount" type="text" required />
      <label htmlFor="nonce">Nonce:</label>
      <Select
        onValueChange={(v) => setSelectId(+v)}
        defaultValue={`${selectId}`}
        disabled={noNonces}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select nonce" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(nonces).map(([key, { publicKey, nonce }], i) => (
            <SelectItem key={key} value={`${i}`}>
              <span className="inline-flex flex-col text-left">
                <span className="text-sm font-medium">{nonce}</span>
                <span className="text-xs text-zinc-400 font-medium ">
                  by {publicKey}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button disabled={noNonces || busy} type="submit" className="mt-4">
        Send Transaction
      </Button>
    </form>
  );
}

function IndexPage() {
  const { publicKey } = useWallet();

  if (!publicKey) return null;

  return (
    <div className="flex flex-wrap gap-4">
      <div className="p-8 bg-zinc-900 shadow-md w-full md:w-1/3">
        <NonceForm />
      </div>
      <div className="p-8 bg-zinc-900 shadow-md w-full md:w-1/3">
        <TransferForm />
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/sol/")({
  component: IndexPage,
});
