import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  closeNonceAccount,
  createAdvanceTransfer,
  createMultisigAccount,
  createNonceAccount,
  createProposeApprove,
  createVaultTransfer,
  deserialize,
  encodeKeypair,
  getKeypair,
  makeKeypairs,
  sendAndConfirmRawTransaction,
  serialize,
} from "@/lib/solana";
import { copyToClipboard } from "@/lib/utils";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { useWallet } from "@solana/wallet-adapter-react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Nonce = {
  publicKey: string;
  secretKey: string;
};

const useNonces = create(
  persist<{
    nonces?: { [authKey: string]: Nonce[] };
    addNonce: (authKey: string, nonce: Nonce) => void;
    closeNonce: (authKey: string, nonceKey: Nonce["publicKey"]) => void;
  }>(
    (set) => ({
      nonces: undefined,
      addNonce: (authKey, nonce) =>
        set((s) => {
          return {
            nonces: {
              ...s.nonces,
              [authKey]: [...(s.nonces?.[authKey] ?? []), nonce],
            },
          };
        }),
      closeNonce: (authKey, nonceKey) =>
        set((s) => {
          const newNonces = (s.nonces?.[authKey] ?? []).filter(
            (n) => n.publicKey === nonceKey
          );
          return { nonces: { [authKey]: newNonces } };
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

  const { nonces, addNonce, closeNonce } = useNonces();

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
          createNonceAccount({
            nonceAccount: nonceKeypair,
            nonceAuthorityPublicKey: publicKey.toString(),
            feePayer: publicKey.toString(),
          })
        )
      );
      console.log("NonceTx: ", noncesTxs.map((tx) => serialize(tx)).join(", "));

      const txSigned = await signAllTransactions?.(noncesTxs);
      if (!txSigned) throw new Error("Transaction not signed");

      await Promise.all(
        txSigned.map(async (sig, idx) => {
          const tx = await sendAndConfirmRawTransaction(serialize(sig));
          if (!tx) throw new Error("Transaction not submitted");
          addNonce(publicKey.toString(), {
            publicKey: nonceKeypairs[idx].publicKey.toString(),
            secretKey: encodeKeypair(nonceKeypairs[idx]),
          });
        })
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

  const [toCloseKeys, setToCloseKeys] = useState<number[]>([]);

  const onCloseNonces = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    console.log("Closing nonces: ", toCloseKeys);
    try {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!nonces) throw new Error("");

      const closeTxs = await Promise.all(
        toCloseKeys.map((key) => {
          const nonce = nonces[publicKey.toString()][key];
          if (!nonce) throw new Error("Nonce not found");
          return closeNonceAccount({
            nonceAccountPublicKey: nonce.publicKey,
            nonceAuthorityPublicKey: publicKey.toString(),
            feePayer: publicKey.toString(),
          });
        })
      );
      console.log("CloseTxs: ", closeTxs);

      const txSigned = await signAllTransactions?.(closeTxs);
      if (!txSigned) throw new Error("Transaction not signed");

      await Promise.all(
        txSigned.map(async (sig, idx) => {
          const tx = await sendAndConfirmRawTransaction(serialize(sig));
          if (!tx) throw new Error("Transaction not submitted");
          closeNonce(
            publicKey.toString(),
            nonces[publicKey.toString()][idx].publicKey
          );
        })
      );

      setToCloseKeys([]);

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
      {!!(publicKey && nonces && nonces[publicKey.toString()]?.length) && (
        <>
          {nonces[publicKey.toString()].map(({ publicKey }, idx) => {
            return (
              <div key={publicKey} className="flex space-x-2">
                <Checkbox
                  id={publicKey}
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
                    htmlFor={publicKey}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {idx}.{" "}
                    <span className="text-xs text-zinc-400 font-medium leading-none">
                      {publicKey}
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

type Multisig = {
  publicKey: string;
  signers: string[];
};

const useMultisig = create(
  persist<{
    multisig?: Multisig;
    set: (multisig: Multisig) => void;
    clear: () => void;
  }>(
    (set) => ({
      multisig: undefined,
      set: (multisig) => set({ multisig }),
      clear: () => set({ multisig: undefined }),
    }),
    {
      name: "multisig",
    }
  )
);

function MultisigForm() {
  const { publicKey, signTransaction } = useWallet();
  const { multisig, set: setMultisig } = useMultisig();

  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [senders, setSenders] = useState<string[]>([]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    try {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!senders.length) throw new Error("Senders not provided");

      const multisigKeypair = getKeypair();
      const signers = senders.filter((s) => !!s);
      const multisigTx = await createMultisigAccount({
        multisigAccount: multisigKeypair,
        owner: publicKey.toString(),
        signers,
      });
      console.log("MultisigTx: ", serialize(multisigTx));

      const signedTx = await signTransaction?.(multisigTx);
      if (!signedTx) throw new Error("Transaction not signed");

      const tx = await sendAndConfirmRawTransaction(serialize(signedTx));
      console.log("Tx: ", tx);
      setMultisig({
        publicKey: multisigKeypair.publicKey.toString(),
        signers,
      });

      formRef.current?.reset();
      toast.info("Multisig created!");
    } catch (error) {
      console.log(error);
      toast.error("Multisig creation failed!");
    } finally {
      setBusy(false);
    }
  };

  if (multisig) {
    return (
      <div>
        <h4 className="text-xl font-bold text-center mb-2">Multisig Signers</h4>
        {multisig.signers.map((s) => (
          <p
            key={s}
            className="text-xs text-zinc-400 font-medium leading-none mt-1"
          >
            {s}
          </p>
        ))}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      ref={formRef}
      className="flex flex-col gap-2 text-left"
    >
      <label htmlFor="sender">Senders:</label>
      <div className="flex gap-1 items-center">
        <Input
          value={publicKey?.toString() ?? ""}
          id="sender"
          type="text"
          readOnly
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSenders((s) => [...s.filter((v) => !!v), ""])}
        >
          +
        </Button>
      </div>
      {!!senders.length &&
        senders.map((sender, i) => (
          <div key={i.toString()} className="flex gap-1 items-center">
            <Input
              defaultValue={sender}
              type="text"
              onChange={(e) => {
                const value = e.target.value.trim();
                if (!value || value.length !== 44) return;
                setSenders((s) => [e.target.value, ...s]);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSenders((s) => s.filter((_, idx) => idx !== i))}
            >
              -
            </Button>
          </div>
        ))}

      <Button disabled={busy} type="submit" className="mt-4">
        Create Multisig
      </Button>
    </form>
  );
}

function TransferForm() {
  const { publicKey } = useWallet();

  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);

  const { nonces } = useNonces();
  const multisig = useMultisig((s) => s.multisig);
  const { transactions, setTransaction } = useTransactions();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    try {
      const isMultisig = event.currentTarget.isMultisig?.checked ?? false;
      const recipient = event.currentTarget.recipient.value;
      const amount = event.currentTarget.amount.value;

      if (!publicKey) throw new Error("Wallet not connected");
      if (!recipient) throw new Error("Recipient not provided");
      if (!amount) throw new Error("Amount not provided");
      if (isMultisig && !multisig) throw new Error("Multisig not found");

      const usedNonces = transactions.map((tx) => tx.noncePublicKey);
      const nonce = nonces?.[publicKey.toString()].find(
        (n) => !usedNonces.includes(n.publicKey)
      );
      if (!nonces || !nonce) throw new Error("No nonces available");

      if (isMultisig && multisig) {
        const tx = await createVaultTransfer({
          nonceAccountPublicKey: nonce.publicKey,
          nonceAuthorityPublicKey: publicKey.toString(),
          feePayer: publicKey.toString(),
          multisigAccountPublicKey: multisig.publicKey,
          sender: publicKey.toString(),
          recipient,
          amount,
        });
        const signature = serialize(tx);
        console.log("AdvanceTx: ", signature);

        setTransaction({
          sender: publicKey.toString(),
          noncePublicKey: nonce.publicKey,
          signature,
          multisigPublicKey: multisig.publicKey,
        });

        await Promise.all(
          multisig.signers.map(async (sender) => {
            const usedNonces = transactions.map((tx) => tx.noncePublicKey);
            const nonce = nonces?.[publicKey.toString()].find(
              (n) => !usedNonces.includes(n.publicKey)
            );
            if (!nonce) throw new Error("No nonces available");

            const tx = await createProposeApprove({
              nonceAccountPublicKey: nonce.publicKey,
              nonceAuthorityPublicKey: publicKey.toString(),
              feePayer: publicKey.toString(),
              multisigAccountPublicKey: multisig.publicKey,
              sender,
            });
            const signature = serialize(tx);
            console.log("AdvanceTx: ", signature);

            setTransaction({
              sender,
              noncePublicKey: nonce.publicKey,
              signature,
              multisigPublicKey: multisig.publicKey,
            });
          })
        );
      } else {
        const tx = await createAdvanceTransfer({
          nonceAccountPublicKey: nonce.publicKey,
          nonceAuthorityPublicKey: publicKey.toString(),
          feePayer: publicKey.toString(),
          sender: publicKey.toString(),
          recipient,
          amount,
        });

        const signature = serialize(tx);
        console.log("AdvanceTx: ", signature);

        setTransaction({
          sender: publicKey.toString(),
          noncePublicKey: nonce.publicKey,
          signature,
        });
      }

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
      <Input id="recipient" type="text" required />
      <label htmlFor="amount">Amount:</label>
      <Input id="amount" type="text" required />
      {!!multisig && (
        <div className="w-fit flex gap-2 justify-center items-center">
          <label htmlFor="isMultisig">Multisig:</label>
          <Input id="isMultisig" type="checkbox" />
        </div>
      )}

      <Button
        disabled={!nonces?.[publicKey?.toString() ?? 0]?.length || busy}
        type="submit"
        className="mt-4"
      >
        Send Transaction
      </Button>
    </form>
  );
}

type Transaction = {
  id: number;
  sender: string;
  noncePublicKey: string;
  signature: string;
  transaction?: string;
  multisigPublicKey?: string;
};

const useTransactions = create(
  persist<{
    transactions: Transaction[];
    setTransaction: (
      transaction: Transaction | Omit<Transaction, "id">
    ) => void;
    closeTransaction: (transactionId: Transaction["id"]) => void;
  }>(
    (set) => ({
      transactions: [],
      setTransaction: (transaction) =>
        set((s) => {
          const newTransactions = [...s.transactions];
          const id =
            "id" in transaction ? transaction.id : s.transactions.length;
          newTransactions[id] = { id, ...transaction };
          return { transactions: newTransactions };
        }),
      closeTransaction: (transactionId) =>
        set((s) => {
          const newTransactions = s.transactions.filter(
            (t) => t.id !== transactionId
          );
          return { transactions: newTransactions };
        }),
    }),
    {
      name: "transactions",
    }
  )
);

function Transactions() {
  const { publicKey, signAllTransactions } = useWallet();

  const { transactions, setTransaction, closeTransaction } = useTransactions();

  const [busy, setBusy] = useState(false);
  const [toExecuteKeys, setToExecuteKeys] = useState<number[]>([]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    try {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!transactions) throw new Error("No transactions available");

      const txs = toExecuteKeys.map((idx) => transactions[idx]);
      const sigs = txs.map((tx) => deserialize(tx.signature));

      const signedTx = await signAllTransactions?.(sigs);
      if (!signedTx) throw new Error("Transaction not signed");

      await Promise.all(
        signedTx.map(async (sig, idx) => {
          const tx = await sendAndConfirmRawTransaction(serialize(sig));
          if (!tx) throw new Error("Transaction not submitted");
          setTransaction({ ...txs[idx], transaction: tx });
        })
      );

      setToExecuteKeys([]);

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
              {txExecuted ? (
                <Button size="icon" variant="ghost" asChild>
                  <a
                    href={`https://solana.fm/tx/${txExecuted}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                  </a>
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => closeTransaction(id)}
                  size="icon"
                  variant="destructive"
                >
                  <TrashIcon className="h-4 w-4" />
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

function IndexPage() {
  const { publicKey } = useWallet();

  if (!publicKey) return null;

  return (
    <div className="flex flex-wrap">
      <div className="p-8 w-full border md:w-1/2 lg:w-1/3">
        <NonceForm />
      </div>
      <div className="p-8 w-full border md:w-1/2 lg:w-1/3">
        <MultisigForm />
      </div>
      <div className="p-8 w-full border md:w-1/2 lg:w-1/3">
        <TransferForm />
      </div>
      <div className="p-8 w-full border md:w-1/2 lg:w-1/3">
        <Transactions />
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/sol/")({
  component: IndexPage,
});
