import "./App.css";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { SolanaProvider } from "./components/SolanaProvider";
import { SendTx } from "./components/SendTx";

const App = () => {
  return (
    <SolanaProvider>
      <WalletMultiButton />

      <SendTx />
    </SolanaProvider>
  );
};

export default App;
