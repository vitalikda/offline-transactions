import { createLazyFileRoute } from "@tanstack/react-router";
import { useAccount, useBalance } from "wagmi";

function IndexPage() {
  const account = useAccount();
  const result = useBalance({
    address: account.address,
  });

  return (
    <div className="flex flex-wrap gap-4">
      <div className="p-8 bg-zinc-900 shadow-md w-full md:w-1/3">
        <p className="text-2xl">
          Balance: {result.data?.formatted} {result.data?.symbol}
        </p>
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/eth/")({
  component: IndexPage,
});
