import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { isSolanaAddress } from "src/lib/solana";
import { z } from "zod";

export const nonces = sqliteTable("nonces", {
  id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  createdAt: integer({ mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),

  sender: text().notNull(),
  noncePublicKey: text().notNull(),
  transaction: text(),
  transactionSigned: text(),
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
  id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  createdAt: integer({ mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),

  sender: text().notNull(),
  recipient: text().notNull(),
  amount: integer({ mode: "number" }).notNull(),
  transaction: text(),
  transactionSigned: text(),
  transactionExecuted: text(),
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

export const executeTransactionSchema = createInsertSchema(transactions, {
  sender: senderType,
})
  .omit({
    createdAt: true,
    updatedAt: true,
    recipient: true,
    amount: true,
  })
  .required({
    id: true,
  });
