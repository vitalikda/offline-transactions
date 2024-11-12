import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLazyFileRoute } from "@tanstack/react-router";
import { prepareTransactionRequest } from "@wagmi/core";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { parseEther } from "viem";
import { useAccount, useConfig, useSignMessage } from "wagmi";

function TransferForm() {
  const config = useConfig();
  const { connector: activeConnector, address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    try {
      const recipient = event.currentTarget.recipient.value;
      const amount = event.currentTarget.amount.value;

      if (!recipient) throw new Error("Recipient not provided");
      if (!amount) throw new Error("Amount not provided");

      const tx = await prepareTransactionRequest(config, {
        to: recipient as `0x${string}`,
        value: parseEther(amount),
      });
      console.log("Tx: ", tx);

      const provider = await activeConnector?.getProvider();
      const test = await provider?.request!({
        method: "eth_signTransaction",
        params: [
          {
            to: "0xA0Cf798816D4b9b9866b5330EEa46a18382f251e",
            from: "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
            value: "0x0",
          },
        ],
      });
      console.log("Test: ", test);
      const signedTx = await signMessageAsync?.({
        account: address,
        message: { raw: tx },
      });
      console.log("Signed Tx: ", signedTx);
      if (!signedTx) throw new Error("Transaction not signed");

      // const hash = await walletClient.account.client(config, {
      //   serializedTransaction: signedTx as `0x${string}`,
      // });
      // console.log("TxHash: ", hash);

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
      <Input
        id="recipient"
        type="text"
        required
        defaultValue={"0x3A169379eF86164aeA75dd05cB7daF32C966F24c"}
      />
      <label htmlFor="amount">Amount:</label>
      <Input id="amount" type="text" required defaultValue={"0.0001"} />
      <Button disabled={busy} type="submit" className="mt-4">
        Send Transaction
      </Button>
    </form>
  );
}

function IndexPage() {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="p-8 bg-zinc-900 shadow-md w-full md:w-1/3">
        <TransferForm />
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/eth/")({
  component: IndexPage,
});
