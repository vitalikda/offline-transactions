import "@solana/wallet-adapter-react-ui/styles.css";

import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

const WalletConnect = ({ children }: { children: React.ReactNode }) => {
  const { publicKey } = useWallet();

  if (!publicKey)
    return (
      <div className="absolute inset-4 flex justify-center items-center">
        <WalletMultiButton />
      </div>
    );

  return (
    <>
      <div className="absolute top-4 right-4">
        <WalletMultiButton />
      </div>

      {children}
    </>
  );
};

export const SolanaProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ConnectionProvider endpoint={clusterApiUrl("devnet")}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <WalletConnect>
            {/*  */}
            {children}
          </WalletConnect>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
