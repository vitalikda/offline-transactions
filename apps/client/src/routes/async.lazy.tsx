import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useWallet } from "@solana/wallet-adapter-react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  closeNonceTx,
  deserialize,
  sendAndConfirmRawTransaction,
  serialize,
} from "../lib/solana";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const nonceKeys = ["nonces"] as const;

const useNonces = (sender?: string) =>
  useQuery({
    enabled: !!sender,
    queryKey: nonceKeys,
    queryFn: async () => {
      if (!sender) throw new Error("Sender not provided");
      const res = await api.nonces.$get({ query: { sender } });
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    },
  });

const useNoncesTx = () =>
  useMutation({
    mutationKey: [...nonceKeys, "tx"],
    mutationFn: async ({ qt, ...json }: { qt: string; sender: string }) => {
      const res = await api.nonces.$post({
        query: { qt },
        json,
      });
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    },
  });

const useNoncesSend = () =>
  useMutation({
    mutationKey: [...nonceKeys, "tx", "signed"],
    mutationFn: async (
      json: { sender: string; transaction: string; transactionSigned: string }[]
    ) => {
      const res = await api.nonces.$patch({
        json,
      });
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    },
  });

const useNoncesClose = () =>
  useMutation({
    mutationKey: [...nonceKeys, "tx", "signed"],
    mutationFn: async (json: { id: number; sender: string }[]) => {
      const res = await api.nonces.$remove({
        json,
      });
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    },
  });

function NonceForm() {
  const queryClient = useQueryClient();
  const { publicKey, signAllTransactions } = useWallet();

  const { data: nonces } = useNonces(publicKey?.toString());
  const { mutateAsync: createNoncesTx } = useNoncesTx();
  const { mutateAsync: sendNoncesTx } = useNoncesSend();
  const { mutateAsync: closeNonces } = useNoncesClose();

  const [busy, setBusy] = useState(false);

  const [toCreate, setToCreate] = useState(1);
  const increase = () => setToCreate((s) => s + 1);
  const decrease = () => setToCreate((s) => (s > 1 ? s - 1 : s));

  const onCreateNonce = async () => {
    if (!publicKey) return;
    setBusy(true);

    try {
      const res = await createNoncesTx({
        sender: publicKey.toString(),
        qt: `${toCreate}`,
      });
      const noncesTxsRaw = res.reduce(
        (all, { transaction }) => (transaction ? [...all, transaction] : all),
        [] as string[]
      );
      console.log("NonceTx: ", noncesTxsRaw.join(", "));

      const noncesTxs = noncesTxsRaw.map((tx) => deserialize(tx));
      const txSigned = await signAllTransactions?.(noncesTxs);
      if (!txSigned) throw new Error("Transaction not signed");

      const res1 = await sendNoncesTx(
        noncesTxsRaw.map((tx, i) => ({
          sender: publicKey.toString(),
          transaction: tx,
          transactionSigned: serialize(txSigned[i]),
        }))
      );

      console.log("KeypairNonce: ", res1);
      queryClient.invalidateQueries({ queryKey: nonceKeys });

      toast.info("Nonces received!");
    } catch (error) {
      console.log(error);
      toast.error("Failed to get nonce!");
    } finally {
      setToCreate(1);
      setBusy(false);
    }
  };

  const [toCloseKeys, setToCloseKeys] = useState<number[]>([]);

  const onCloseNonces = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    console.log("Closing nonces: ", toCloseKeys);
    try {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!nonces?.length) throw new Error("No nonces available");

      const closeTxs = await Promise.all(
        toCloseKeys.map((idx) => {
          const nonce = nonces[idx];
          if (!nonce) throw new Error("Nonce not found");
          return closeNonceTx({
            noncePublicKey: nonce.noncePublicKey,
            signer: publicKey.toString(),
          });
        })
      );
      console.log("CloseTxs: ", closeTxs);

      const txSigned = await signAllTransactions?.(closeTxs);
      if (!txSigned) throw new Error("Transaction not signed");

      await Promise.all(
        txSigned.map((tx) => sendAndConfirmRawTransaction(serialize(tx)))
      );

      console.log("CloseKeys: ", toCloseKeys);
      setToCloseKeys([]);
      closeNonces(
        toCloseKeys.map((idx) => ({ id: idx, sender: publicKey.toString() }))
      );

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
      {!!nonces?.length && (
        <>
          {nonces.map(({ id, noncePublicKey, transactionSigned }, idx) => {
            if (!transactionSigned) return null;
            return (
              <div key={id} className="flex space-x-2">
                <Checkbox
                  id={`${id}-${noncePublicKey}`}
                  onCheckedChange={(v) => {
                    if (v) {
                      setToCloseKeys((s) => [...s, idx]);
                    } else {
                      setToCloseKeys((s) => s.filter((n) => n !== idx));
                    }
                  }}
                />
                <div className="flex flex-col space-y-1">
                  <label
                    htmlFor={`${id}-${noncePublicKey}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {id}.{" "}
                    <span className="text-xs text-zinc-400 font-medium leading-none">
                      {noncePublicKey}
                    </span>
                  </label>
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

function AsyncPage() {
  const { publicKey } = useWallet();

  if (!publicKey) return null;

  return (
    <div className="flex flex-wrap gap-4">
      <div className="p-8 bg-zinc-900 shadow-md w-full md:w-1/3">
        <NonceForm />
      </div>
      <div className="p-8 bg-zinc-900 shadow-md w-full md:w-1/3">
        {/* <TransferForm /> */}
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/async")({
  component: AsyncPage,
});
