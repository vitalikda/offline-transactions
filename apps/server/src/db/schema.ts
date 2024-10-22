import { z } from "zod";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { isSolanaAddress } from "src/lib/solana";

export const nonces = sqliteTable("nonces", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),

  sender: text("sender").notNull(),
  noncePublicKey: text("nonce_publicKey").notNull(),
  transaction: text("transaction"),
  transactionSigned: text("transaction_signed"),
});

export const senderType = z.string().refine(isSolanaAddress, "Invalid address");

export const selectNonceSchema = createSelectSchema(nonces);

export const insertNonceSchema = createInsertSchema(nonces, {
  sender: senderType,
}).omit({
  createdAt: true,
  updatedAt: true,
  noncePublicKey: true,
});

export const patchNonceSchema = insertNonceSchema.required({
  transaction: true,
  transactionSigned: true,
});

export const removeNonceSchema = insertNonceSchema.required({
  id: true,
});

export const transactions = sqliteTable("transactions", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),

  sender: text("sender").notNull(),
  recipient: text("recipient").notNull(),
  amount: integer("amount", { mode: "number" }).notNull(),
  transaction: text("transaction"),
  transactionSigned: text("transaction_signed"),
});

export const selectTransactionSchema = createSelectSchema(transactions);

export const insertTransactionSchema = createInsertSchema(transactions, {
  sender: senderType,
  recipient: senderType,
  amount: z.coerce.number(),
}).omit({
  createdAt: true,
  updatedAt: true,
});

export const patchTransactionSchema = createInsertSchema(transactions)
  .omit({
    createdAt: true,
    updatedAt: true,
    recipient: true,
    amount: true,
  })
  .required({
    transaction: true,
    transactionSigned: true,
  });
