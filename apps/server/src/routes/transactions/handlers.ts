import { and, desc, eq, isNotNull, isNull, notInArray } from "drizzle-orm";
import db from "src/db";
import { authorities, nonces, transactions } from "src/db/schema";
import { ZOD_ERROR_MESSAGES } from "src/lib/constants";
import { sendAndConfirmRawTransaction, serialize } from "src/lib/solana";
import type { AppRouteHandler } from "src/lib/types";
import { getAuthKeypair, getNonceInfo } from "src/routes/nonces/utils";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import type * as routes from "./routes";
import { createAdvanceTransfer } from "./utils";

export const list: AppRouteHandler<typeof routes.list> = async (c) => {
  const { sender } = c.req.valid("query");

  const nonceList = await db.query.transactions.findMany({
    where: and(
      eq(transactions.sender, sender),
      isNotNull(transactions.signature)
    ),
    orderBy: [desc(transactions.createdAt)],
  });

  return c.json(nonceList, HttpStatusCodes.OK);
};

export const create: AppRouteHandler<typeof routes.create> = async (c) => {
  const { sender, recipient, amount } = c.req.valid("json");

  const authority = await db.query.authorities.findFirst({
    where: eq(authorities.sender, sender),
  });

  if (!authority) {
    return c.json(
      { message: ZOD_ERROR_MESSAGES.NONCE_REQUIRED },
      HttpStatusCodes.PAYMENT_REQUIRED
    );
  }

  const scheduledTransactions = await db.query.transactions.findMany({
    where: and(
      eq(transactions.sender, sender),
      isNotNull(transactions.signature),
      isNull(transactions.transaction)
    ),
  });
  const usedNonces = scheduledTransactions.map((tx) => tx.noncePublicKey);
  const nonce = await db.query.nonces.findFirst({
    columns: {
      noncePublicKey: true,
    },
    where: and(
      eq(nonces.sender, sender),
      isNotNull(nonces.transaction),
      notInArray(nonces.noncePublicKey, usedNonces)
    ),
  });

  if (!nonce) {
    return c.json(
      { message: ZOD_ERROR_MESSAGES.NONCE_REQUIRED },
      HttpStatusCodes.PAYMENT_REQUIRED
    );
  }

  await db
    .delete(transactions)
    .where(
      and(eq(transactions.sender, sender), isNull(transactions.signature))
    );

  const advanceTx = await createAdvanceTransfer({
    nonceAccountPublicKey: nonce.noncePublicKey,
    nonceAuthority: getAuthKeypair(authority.nonceSecretKey),
    feePayer: sender,
    sender,
    recipient,
    amount,
  });

  const [transaction] = await db
    .insert(transactions)
    .values({ sender, recipient, amount, noncePublicKey: nonce.noncePublicKey })
    .returning();

  return c.json(
    {
      id: transaction.id,
      sender: transaction.sender,
      noncePublicKey: transaction.noncePublicKey,
      tx: serialize(advanceTx),
    },
    HttpStatusCodes.OK
  );
};

export const patch: AppRouteHandler<typeof routes.patch> = async (c) => {
  const { id, sender, txSigned } = c.req.valid("json");
  c.var.logger.info(
    `Updating transaction: ${JSON.stringify({ id, txSigned })}`
  );

  const [updated] = await db
    .update(transactions)
    .set({ signature: txSigned })
    .where(and(eq(transactions.id, id), eq(transactions.sender, sender)))
    .returning();

  if (!updated) {
    return c.json(
      { message: HttpStatusPhrases.NOT_FOUND },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.json(updated, HttpStatusCodes.OK);
};

export const execute: AppRouteHandler<typeof routes.execute> = async (c) => {
  const txs = c.req.valid("json");
  c.var.logger.info(`Remove nonces: ${JSON.stringify(txs)}`);

  const newTxs = await Promise.all(
    txs.map(async ({ id, sender }) => {
      const sqlWhere = and(
        eq(transactions.id, id),
        eq(transactions.sender, sender),
        isNotNull(transactions.signature)
      );

      const transaction = await db.query.transactions.findFirst({
        where: sqlWhere,
      });
      if (!transaction?.signature) throw new Error("Transaction not found");

      const tx = await sendAndConfirmRawTransaction(transaction.signature);
      c.var.logger.info(`Transaction executed: ${tx}`);

      const [newNonce] = await db
        .update(transactions)
        .set({ transaction: tx })
        .where(sqlWhere)
        .returning();

      return newNonce;
    })
  );

  if (!newTxs.length) {
    return c.json(
      { message: HttpStatusPhrases.NOT_FOUND },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.json(newTxs, HttpStatusCodes.OK);
};
