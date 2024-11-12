# Offline Transactions

This template provides a minimal setup to get Solan Wallet Adapter integrated with React and Vite.

## Solana + Durable Nonce

![diagram](/diagram.png)

### NOTES

- nonce hash is time based
- nonce account can be re-used

### TODO

- [ ] durable nonce with safe/squads account - https://x.com/SquadsProtocol/status/1837047617127358585
- [ ] schedule transactions on Ethereum

## Ethereum

### NOTES

- Metamask (Phantom) does not support `eth_signTransaction`
  - https://github.com/MetaMask/metamask-extension/issues/3475
  - https://x.com/CT_IOE/status/1534658825843683328
  - https://x.com/1inch/status/1334992381242961930
- Ethereum transaction data structure - https://ethereum.stackexchange.com/questions/1990/what-is-the-ethereum-transaction-data-structure
- Multisig
  - ECDSA threshold signature or multi-party signature: https://github.com/ZenGo-X/multi-party-ecdsa
  - Smart Contract: https://github.com/gnosis/MultiSigWallet
  -
