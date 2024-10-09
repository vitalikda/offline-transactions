import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export const WalletConnect = ({ children }: { children: React.ReactNode }) => {
  const { publicKey } = useWallet();

  if (!publicKey) return <WalletMultiButton />;

  return (
    <>
      <nav style={{ position: "absolute", top: "2rem", right: "2rem" }}>
        <WalletMultiButton />
      </nav>
      <main>{children}</main>
    </>
  );
};
