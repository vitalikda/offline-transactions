import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export const WalletConnect = ({ children }: { children: React.ReactNode }) => {
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
