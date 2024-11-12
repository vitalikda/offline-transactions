import { Button } from "@/components/ui/button";
import { WagmiProvider, useAccount, useConnect, useDisconnect } from "wagmi";
import { wagmiConfig } from "./config";

const WalletConnect = ({ children }: { children: React.ReactNode }) => {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors, connect } = useConnect();

  if (!address)
    return (
      <div className="absolute inset-6 flex flex-col gap-2 justify-center items-center">
        {connectors.map((connector) => (
          <Button
            key={connector.uid}
            onClick={() => connect({ connector })}
            size="lg"
            className="max-w-32"
          >
            {connector.name}
          </Button>
        ))}
      </div>
    );

  return (
    <>
      <div className="absolute top-6 right-6">
        <Button onClick={() => disconnect()}>Disconnect</Button>
      </div>

      {children}
    </>
  );
};

export const EthProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <WalletConnect>
        {/*  */}
        {children}
      </WalletConnect>
    </WagmiProvider>
  );
};
