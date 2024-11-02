import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { deserialize, serialize } from "@/lib/solana";
import { copyToClipboard } from "@/lib/utils";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "@radix-ui/react-icons";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

const nonceKeys = ["nonces"] as const;
const transactionKeys = ["transactions"] as const;

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
      json: Parameters<typeof api.nonces.$patch>[0]["json"]
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
    mutationKey: [...nonceKeys, "tx", "close"],
    mutationFn: async (
      json: Parameters<typeof api.nonces.remove.$post>[0]["json"]
    ) => {
      const res = await api.nonces.remove.$post({
        json,
      });
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    },
  });

const useNoncesCloseConfirm = () =>
  useMutation({
    mutationKey: [...nonceKeys, "tx", "close", "signed"],
    mutationFn: async (
      json: Parameters<typeof api.nonces.remove.$patch>[0]["json"]
    ) => {
      const res = await api.nonces.remove.$patch({
        json,
      });
      if (!res.ok) throw new Error(res.statusText);
      return "";
    },
  });

function NonceForm() {
  const queryClient = useQueryClient();
  const { publicKey, signAllTransactions } = useWallet();

  const { data: nonces } = useNonces(publicKey?.toString());
  const { mutateAsync: createNoncesTx } = useNoncesTx();
  const { mutateAsync: sendNoncesTx } = useNoncesSend();
  const { mutateAsync: closeNonces } = useNoncesClose();
  const { mutateAsync: confirmCloseNonces } = useNoncesCloseConfirm();

  const [busy, setBusy] = useState(false);

  const [toCreate, setToCreate] = useState(1);
  const increase = () => setToCreate((s) => s + 1);
  const decrease = () => setToCreate((s) => (s > 1 ? s - 1 : s));

  const onCreateNonce = async () => {
    if (!publicKey) return;
    setBusy(true);

    try {
      const newNonces = await createNoncesTx({
        sender: publicKey.toString(),
        qt: `${toCreate}`,
      });
      const noncesTxsRaw = newNonces.reduce((all, { tx }) => {
        if (tx) all.push(tx);
        return all;
      }, [] as string[]);
      console.log("NonceTx: ", noncesTxsRaw.join(", "));

      const noncesTxs = noncesTxsRaw.map((tx) => deserialize(tx));
      const txSigned = await signAllTransactions?.(noncesTxs);
      if (!txSigned) throw new Error("Transaction not signed");

      await sendNoncesTx(
        newNonces.map((nonce, i) => ({
          ...nonce,
          txSigned: serialize(txSigned[i]),
        }))
      );

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

    try {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!nonces?.length) throw new Error("No nonces available");

      const toCloseNonces = await closeNonces(
        toCloseKeys.map((idx) => ({
          sender: publicKey.toString(),
          noncePublicKey: nonces[idx].noncePublicKey,
        }))
      );
      const closeTxsRaw = toCloseNonces.reduce((all, { tx }) => {
        if (tx) all.push(tx);
        return all;
      }, [] as string[]);
      console.log("CloseNonceTx: ", closeTxsRaw.join(", "));

      const closeTxs = closeTxsRaw.map((tx) => deserialize(tx));
      const txSigned = await signAllTransactions?.(closeTxs);
      if (!txSigned) throw new Error("Transaction not signed");

      await confirmCloseNonces(
        toCloseNonces.map((nonce, i) => ({
          ...nonce,
          txSigned: serialize(txSigned[i]),
        }))
      );

      queryClient.invalidateQueries({ queryKey: nonceKeys });

      toast.info("Nonce closed!");
    } catch (error) {
      console.log(error);
      toast.error("Failed to close nonce!");
    } finally {
      setToCloseKeys([]);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onCloseNonces} className="flex flex-col gap-2">
      {!!nonces?.length && (
        <>
          {nonces.map(({ id, noncePublicKey, transaction }, idx) => {
            if (!transaction) return null;
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

const useTransaction = () =>
  useMutation({
    mutationKey: [...transactionKeys, "tx"],
    mutationFn: async (
      json: Parameters<typeof api.transactions.$post>[0]["json"]
    ) => {
      const res = await api.transactions.$post({
        json,
      });
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    },
  });

const useTransactionSend = () =>
  useMutation({
    mutationKey: [...transactionKeys, "tx", "signed"],
    mutationFn: async (
      json: Parameters<typeof api.transactions.$patch>[0]["json"]
    ) => {
      const res = await api.transactions.$patch({
        json,
      });
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    },
  });

function TransferForm() {
  const queryClient = useQueryClient();
  const { publicKey, signTransaction } = useWallet();

  const { data: nonces } = useNonces();
  const noNonces = !nonces?.length;
  const { mutateAsync: createTransaction } = useTransaction();
  const { mutateAsync: sendTransaction } = useTransactionSend();

  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    try {
      const recipient = event.currentTarget.recipient.value;
      const amount = event.currentTarget.amount.value;

      if (noNonces) throw new Error("No nonces available");
      if (!publicKey) throw new Error("Wallet not connected");
      if (!recipient) throw new Error("Recipient not provided");
      if (!amount) throw new Error("Amount not provided");

      const { id, tx: advanceTx } = await createTransaction({
        sender: publicKey.toString(),
        recipient,
        amount,
      });
      console.log("AdvanceTx: ", advanceTx);

      const txSigned = await signTransaction?.(deserialize(advanceTx));
      if (!txSigned) throw new Error("Transaction not signed");

      await sendTransaction({
        id,
        sender: publicKey.toString(),
        txSigned: serialize(txSigned),
      });

      formRef.current?.reset();
      queryClient.invalidateQueries({ queryKey: transactionKeys });

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
      <Input id="recipient" type="text" required />
      <label htmlFor="amount">Amount:</label>
      <Input id="amount" type="text" required />

      <Button disabled={noNonces || busy} type="submit" className="mt-4">
        {noNonces ? "Create Nonce First" : "Send Transaction"}
      </Button>
    </form>
  );
}

const useTransactions = (sender?: string) =>
  useQuery({
    enabled: !!sender,
    queryKey: transactionKeys,
    queryFn: async () => {
      if (!sender) throw new Error("Sender not provided");
      const res = await api.transactions.$get({ query: { sender } });
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    },
  });

const useTransactionsExecute = () =>
  useMutation({
    mutationKey: [...transactionKeys, "execute"],
    mutationFn: async (
      json: Parameters<typeof api.transactions.execute.$patch>[0]["json"]
    ) => {
      const res = await api.transactions.execute.$patch({
        json,
      });
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    },
  });

function Transfers() {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();

  const { data: transactions } = useTransactions(publicKey?.toString());
  const { mutateAsync: executeTransactions } = useTransactionsExecute();

  const [busy, setBusy] = useState(false);
  const [toExecuteKeys, setToExecuteKeys] = useState<number[]>([]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    try {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!transactions) throw new Error("No transactions available");

      await executeTransactions(
        toExecuteKeys.map((idx) => ({
          id: transactions[idx].id,
          sender: publicKey?.toString(),
        }))
      );

      setToExecuteKeys([]);
      queryClient.invalidateQueries({ queryKey: transactionKeys });

      toast.info("Transactions executed!");
    } catch (error) {
      console.log(error);
      toast.error("Failed to execute transactions!");
    } finally {
      setBusy(false);
    }
  };

  if (!transactions?.length) {
    return (
      <div>
        <span>No transactions yet</span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      {transactions.map(({ id, signature, transaction: txExecuted }, idx) => {
        if (!signature) return null;
        return (
          <div key={id} className="flex space-x-2 items-center">
            {txExecuted ? (
              <div>
                <CheckIcon className="h-4 w-4 text-green-500" />
              </div>
            ) : (
              <Checkbox
                id={`${id}-${signature}`}
                onCheckedChange={(v) => {
                  if (v) {
                    setToExecuteKeys((s) => [...s, idx]);
                  } else {
                    setToExecuteKeys((s) => s.filter((n) => n !== idx));
                  }
                }}
              />
            )}
            <div className="flex-1 flex flex-col space-y-1">
              <label
                htmlFor={`${id}-${signature}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 inline-flex gap-1 items-baseline"
              >
                {id}.{" "}
                <span className="text-xs text-zinc-400 font-medium leading-none">
                  {signature.slice(0, 36)}...
                </span>
              </label>
            </div>
            <div className="flex gap-1 items-center">
              <Button
                type="button"
                onClick={() =>
                  copyToClipboard(signature).then((t) =>
                    t
                      ? toast.info("Text copied!")
                      : toast.error(
                          "Clipboard is not available! Check browser logs."
                        )
                  )
                }
                size="icon"
                variant="ghost"
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
              {!!txExecuted && (
                <Button size="icon" variant="ghost" asChild>
                  <a
                    href={`https://solana.fm/tx/${txExecuted}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        );
      })}
      <Button
        disabled={!toExecuteKeys.length || busy}
        type="submit"
        variant="outline"
      >
        Execute Transactions
      </Button>
    </form>
  );
}

function AsyncPage() {
  const { publicKey } = useWallet();

  if (!publicKey) return null;

  return (
    <div className="flex flex-wrap gap-4">
      <div className="p-8 bg-zinc-900 shadow-md w-full md:w-1/4">
        <NonceForm />
      </div>
      <div className="p-8 bg-zinc-900 shadow-md w-full md:w-1/4">
        <TransferForm />
      </div>
      <div className="p-8 bg-zinc-900 shadow-md w-full md:w-1/4">
        <Transfers />
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/sol/async")({
  component: AsyncPage,
});
