import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { isSolanaAddress } from "src/lib/solana";
import { z } from "zod";

export const nonces = sqliteTable("nonces", {
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
  nonce: text("nonce").notNull(),
  transaction: text("transaction").notNull(),
  signature: text("signature"),
});

export const selectNonceSchema = createSelectSchema(nonces);

export const insertNonceSchema = createInsertSchema(nonces, {
  sender: (s) => s.sender.refine(isSolanaAddress, "Invalid address"),
  recipient: (s) => s.recipient.refine(isSolanaAddress, "Invalid address"),
  amount: z.coerce.number(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,

  nonce: true,
  transaction: true,
  signature: true,
});

export const patchNonceSchema = createInsertSchema(nonces, {
  signature: z.string(),
})
  .required({
    signature: true,
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,

    nonce: true,
    transaction: true,
    sender: true,
    recipient: true,
    amount: true,
  });
