import { integer as int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { isSolanaAddress } from "src/lib/solana";
import { z } from "zod";

const common = {
  id: int({ mode: "number" }).primaryKey({ autoIncrement: true }),
  createdAt: int({ mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: int({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
};

export const authorities = sqliteTable("authorities", {
  ...common,
  sender: text().notNull(),
  nonceSecretKey: text().notNull(),
  noncePublicKey: text().notNull(),
});

export const nonces = sqliteTable("nonces", {
  ...common,
  sender: text().notNull(),
  noncePublicKey: text().notNull(),
  transaction: text(),
});

export const senderType = z.string().refine(isSolanaAddress, "Invalid address");

export const selectNonceSchema = createSelectSchema(nonces);

export const insertNonceSchema = createInsertSchema(nonces, {
  sender: senderType,
}).omit({
  createdAt: true,
  updatedAt: true,
});

export const transactions = sqliteTable("transactions", {
  ...common,
  sender: text().notNull(),
  recipient: text().notNull(),
  amount: int({ mode: "number" }).notNull(),
  noncePublicKey: text().notNull(),
  signature: text(),
  transaction: text(),
});

export const selectTransactionSchema = createSelectSchema(transactions);

export const insertTransactionSchema = createInsertSchema(transactions, {
  sender: senderType,
  recipient: senderType,
  amount: z.coerce.number(),
}).omit({
  createdAt: true,
  updatedAt: true,
  noncePublicKey: true,
});
