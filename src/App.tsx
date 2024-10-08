import "./App.css";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AsyncTx } from "./components/AsyncTx";
import { SendTx } from "./components/SendTx";
import { SolanaProvider } from "./components/SolanaProvider";

const App = () => {
  return (
    <SolanaProvider>
      <WalletMultiButton />

      <div
        style={{
          padding: "2rem",
          display: "grid",
          gridAutoFlow: "column",
          alignItems: "end",
          gap: "2rem",
        }}
      >
        <div
          style={{
            padding: "2rem",
            backgroundColor: "#000",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          }}
        >
          <SendTx />
        </div>
        <div
          style={{
            padding: "2rem",
            backgroundColor: "#000",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          }}
        >
          <AsyncTx />
        </div>
      </div>
    </SolanaProvider>
  );
};

export default App;
