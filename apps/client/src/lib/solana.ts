import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import bs58 from "bs58";
import { retry } from "./utils";

export const toLamports = (n: string | number) => +n * LAMPORTS_PER_SOL;

export const serialize = (tx: VersionedTransaction) => {
  return Buffer.from(tx.serialize()).toString("base64");
};

export const deserialize = (tx: string) => {
  return VersionedTransaction.deserialize(Buffer.from(tx, "base64"));
};

export const getKeypair = () => Keypair.generate();

export const encodeKeypair = (kp: Keypair) => bs58.encode(kp.secretKey);

export const getAuthKeypair = (secret: string) => {
  return Keypair.fromSecretKey(bs58.decode(secret));
};

export const makeKeypairs = (n = 1) => {
  return Array.from({ length: n }).map(() => getKeypair());
};

export const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

export const sendAndConfirmRawTransaction = async (tx: string) => {
  const signature = await connection.sendRawTransaction(
    Buffer.from(tx, "base64")
  );
  console.log("Signature: ", signature);

  const latestBlockHash = await connection.getLatestBlockhash();
  const conf = await connection.confirmTransaction({
    ...latestBlockHash,
    signature,
  });
  console.log("Confirmation: ", conf);

  if (conf.value.err) {
    throw new Error(`Transaction failed: ${conf.value.err}`);
  }

  return signature;
};

export const airdrop = async (publicKey: PublicKey) => {
  const sig = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
  return sendAndConfirmRawTransaction(sig);
};

const getPrioriFeeIxs = (cuPrice = 250_000, cuLimit = 200_000) => [
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: cuPrice }),
  ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit }),
];

// TODO: does not work - tx simulation throws error
// const getOptimalPrioriFeeIxs = async (
//   ixs: Array<TransactionInstruction>,
//   senderPK: PublicKey,
//   lookupTables: Array<AddressLookupTableAccount> = []
// ) => {
//   const [microLamports, units] = await Promise.all([
//     connection.getRecentPrioritizationFees(),
//     getSimulationComputeUnits(connection, ixs, senderPK, lookupTables),
//   ]);
//   console.log("microLamports: ", microLamports);
//   console.log("units: ", units);
//   const cuPrice = Math.floor(
//     microLamports.reduce((acc, cur) => acc + cur.prioritizationFee, 0) /
//       microLamports.length
//   );
//   const cuLimit = units ?? 300;
//   console.log("cuPrice/cuLimit: ", { cuPrice, cuLimit });
//   return getPrioriFeeIxs(cuPrice, cuLimit);
// };

const getAccountInfo = async ({ publicKey }: { publicKey: PublicKey }) => {
  console.log("Fetching nonce account info");
  const accountInfo = await connection.getAccountInfo(publicKey);
  if (!accountInfo) {
    throw new Error(`Nonce account not found: ${publicKey.toString()}`);
  }
  return accountInfo;
};

export const getNonceInfo = async (noncePublicKey: string) => {
  // Note: nonce account is not available immediately after creation
  const accountInfo = await retry(
    () => getAccountInfo({ publicKey: new PublicKey(noncePublicKey) }),
    3,
    3000
  );
  return NonceAccount.fromAccountData(accountInfo.data);
};

export const createNonceAccount = async ({
  nonceAccount,
  nonceAuthorityPublicKey,
  feePayer,
}: {
  nonceAccount: Keypair;
  nonceAuthorityPublicKey: string;
  feePayer: string;
}) => {
  const rent =
    await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);

  const latestBlockhash = await connection.getLatestBlockhash();

  const nonceAuthPK = new PublicKey(nonceAuthorityPublicKey);
  const feePayerPK = new PublicKey(feePayer);

  const ixs = [
    SystemProgram.createAccount({
      fromPubkey: feePayerPK,
      newAccountPubkey: nonceAccount.publicKey,
      lamports: rent,
      space: NONCE_ACCOUNT_LENGTH,
      programId: SystemProgram.programId,
    }),
    SystemProgram.nonceInitialize({
      authorizedPubkey: nonceAuthPK,
      noncePubkey: nonceAccount.publicKey,
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: feePayerPK,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: ixs.concat(getPrioriFeeIxs()),
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  tx.sign([nonceAccount]);

  return tx;
};

export const closeNonceAccount = async ({
  nonceAccountPublicKey,
  nonceAuthorityPublicKey,
  feePayer,
}: {
  nonceAccountPublicKey: string;
  nonceAuthorityPublicKey: string;
  feePayer: string;
}) => {
  const noncePK = new PublicKey(nonceAccountPublicKey);

  const balance = await connection.getBalance(noncePK);
  if (!balance) {
    throw new Error(`Nonce account balance for ${nonceAccountPublicKey} is 0`);
  }

  const rent =
    await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  if (balance < rent) {
    throw new Error(
      `Nonce account balance for ${nonceAccountPublicKey} is less than rent: ${balance} < ${rent}`
    );
  }

  const latestBlockhash = await connection.getLatestBlockhash();

  const nonceAuthPK = new PublicKey(nonceAuthorityPublicKey);
  const feePayerPK = new PublicKey(feePayer);

  const ixs = [
    SystemProgram.nonceWithdraw({
      noncePubkey: noncePK,
      toPubkey: feePayerPK,
      lamports: balance,
      authorizedPubkey: nonceAuthPK,
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: feePayerPK,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: ixs.concat(getPrioriFeeIxs()),
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  // tx.sign([nonceAuthority]);

  return tx;
};

export const createAdvanceTransfer = async ({
  nonceAccountPublicKey,
  nonceAuthorityPublicKey,
  feePayer,
  sender,
  recipient,
  amount,
}: {
  nonceAccountPublicKey: string;
  nonceAuthorityPublicKey: string;
  feePayer: string;
  sender: string;
  recipient: string;
  amount: number;
}) => {
  const { nonce } = await getNonceInfo(nonceAccountPublicKey);

  const noncePK = new PublicKey(nonceAccountPublicKey);
  const nonceAuthPK = new PublicKey(nonceAuthorityPublicKey);

  const ixs = [
    SystemProgram.nonceAdvance({
      authorizedPubkey: nonceAuthPK,
      noncePubkey: noncePK,
    }),
    SystemProgram.transfer({
      fromPubkey: new PublicKey(sender),
      toPubkey: new PublicKey(recipient),
      lamports: toLamports(amount),
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: new PublicKey(feePayer),
    recentBlockhash: nonce,
    instructions: ixs.concat(getPrioriFeeIxs()),
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  // tx.sign([nonceAuthority]);

  return tx;
};

const Permissions = multisig.types.Permissions;
const {
  multisigCreateV2,
  vaultTransactionCreate,
  proposalCreate,
  proposalApprove,
} = multisig.instructions;

export const createMultisigAccount = async ({
  multisigAccount,
  owner,
  signers,
}: {
  multisigAccount: Keypair;
  owner: string;
  signers: string[];
}) => {
  const latestBlockhash = await connection.getLatestBlockhash();

  const ownerPK = new PublicKey(owner);
  const members = signers
    .filter((s) => s !== owner)
    .map((signer) => ({
      key: new PublicKey(signer),
      permissions: Permissions.all(),
    }));
  const [multisigPda] = multisig.getMultisigPda({
    createKey: multisigAccount.publicKey,
  });

  const programConfig =
    await multisig.accounts.ProgramConfig.fromAccountAddress(
      connection,
      multisig.getProgramConfigPda({})[0]
    );

  const ixs = [
    multisigCreateV2({
      // Must sign the transaction, unless the .rpc method is used.
      createKey: multisigAccount.publicKey,
      // The creator & fee payer
      creator: ownerPK,
      // The PDA of the multisig you are creating, derived by a random PublicKey
      multisigPda,
      // Here the config authority will be the system program
      configAuthority: null,
      // Create without any time-lock
      timeLock: 0,
      // List of the members to add to the multisig
      members: [
        {
          key: ownerPK,
          permissions: Permissions.all(),
        },
      ].concat(members),
      // This means that there needs to be 2 votes for a transaction proposal to be approved
      threshold: members.length + 1,
      // This is for the program config treasury account
      treasury: programConfig.treasury,
      // Rent reclaim account
      rentCollector: null,
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: ownerPK,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: ixs.concat(getPrioriFeeIxs()),
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  tx.sign([multisigAccount]);

  return tx;
};

export const createVaultTransfer = async ({
  nonceAccountPublicKey,
  nonceAuthorityPublicKey,
  feePayer,
  multisigAccountPublicKey,
  sender,
  recipient,
  amount,
}: {
  nonceAccountPublicKey: string;
  nonceAuthorityPublicKey: string;
  feePayer: string;
  multisigAccountPublicKey: string;
  sender: string;
  recipient: string;
  amount: number;
}) => {
  const { nonce } = await getNonceInfo(nonceAccountPublicKey);

  const noncePK = new PublicKey(nonceAccountPublicKey);
  const nonceAuthPK = new PublicKey(nonceAuthorityPublicKey);
  const multisigPK = new PublicKey(multisigAccountPublicKey);

  const [multisigPda] = multisig.getMultisigPda({
    createKey: multisigPK,
  });

  const [vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: 0,
  });

  const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
    connection,
    multisigPda
  );

  const currentTransactionIndex = Number(multisigInfo.transactionIndex);
  const newTransactionIndex = BigInt(currentTransactionIndex + 1);

  const ixs = [
    SystemProgram.nonceAdvance({
      authorizedPubkey: nonceAuthPK,
      noncePubkey: noncePK,
    }),
    vaultTransactionCreate({
      multisigPda,
      transactionIndex: newTransactionIndex,
      creator: new PublicKey(sender),
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: nonce, // ???
        instructions: [
          SystemProgram.transfer({
            // The transfer is being signed by the vault that's executing
            fromPubkey: vaultPda,
            toPubkey: new PublicKey(recipient),
            lamports: toLamports(amount),
          }),
        ],
      }),
    }),
    proposalCreate({
      multisigPda,
      transactionIndex: newTransactionIndex,
      creator: new PublicKey(sender),
      rentPayer: new PublicKey(feePayer),
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: new PublicKey(feePayer),
    recentBlockhash: nonce,
    instructions: ixs.concat(getPrioriFeeIxs()),
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  // tx.sign([nonceAuthority]);

  return tx;
};

export const createProposeApprove = async ({
  nonceAccountPublicKey,
  nonceAuthorityPublicKey,
  feePayer,
  multisigAccountPublicKey,
  sender,
}: {
  nonceAccountPublicKey: string;
  nonceAuthorityPublicKey: string;
  feePayer: string;
  multisigAccountPublicKey: string;
  sender: string;
}) => {
  const { nonce } = await getNonceInfo(nonceAccountPublicKey);

  const noncePK = new PublicKey(nonceAccountPublicKey);
  const nonceAuthPK = new PublicKey(nonceAuthorityPublicKey);
  const multisigPK = new PublicKey(multisigAccountPublicKey);

  const [multisigPda] = multisig.getMultisigPda({
    createKey: multisigPK,
  });

  const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
    connection,
    multisigPda
  );

  const transactionIndex = BigInt(multisigInfo.transactionIndex.toString());

  const ixs = [
    SystemProgram.nonceAdvance({
      authorizedPubkey: nonceAuthPK,
      noncePubkey: noncePK,
    }),
    proposalApprove({
      multisigPda,
      transactionIndex,
      member: new PublicKey(sender),
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: new PublicKey(feePayer),
    recentBlockhash: nonce,
    instructions: ixs.concat(getPrioriFeeIxs()),
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  // tx.sign([nonceAuthority]);

  return tx;
};
