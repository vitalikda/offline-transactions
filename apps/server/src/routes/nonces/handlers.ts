import { and, eq, isNotNull } from "drizzle-orm";
import db from "src/db";
import { nonces } from "src/db/schema";
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from "src/lib/constants";
import { sendAndConfirmRawTransaction, serialize } from "src/lib/solana";
import type { AppRouteHandler } from "src/lib/types";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import type * as routes from "./routes";
import { createNonceTx, makeKeypairs } from "./utils";

export const list: AppRouteHandler<typeof routes.list> = async (c) => {
  const { sender } = c.req.valid("query");

  // FIX: return type shows as nullable
  const nonceList = await db.query.nonces.findMany({
    where: and(eq(nonces.sender, sender), isNotNull(nonces.transactionSigned)),
  });

  return c.json(nonceList, HttpStatusCodes.OK);
};

export const create: AppRouteHandler<typeof routes.create> = async (c) => {
  const { qt } = c.req.valid("query");
  const { sender } = c.req.valid("json");

  const nonceKeypairs = makeKeypairs(qt);

  const noncesTxs = await Promise.all(
    nonceKeypairs.map((nonceKeypair) =>
      createNonceTx({ nonceKeypair, signer: sender })
    )
  );

  const nonceTxsRaw = noncesTxs.map((tx) => serialize(tx));
  c.var.logger.info(`Created nonces: ${nonceTxsRaw.join(", ")}`);

  const newNonces = nonceKeypairs.map((nonce, i) => ({
    sender,
    noncePublicKey: nonce.publicKey.toString(),
    transaction: nonceTxsRaw[i],
  })) satisfies (typeof nonces.$inferInsert)[];

  const inserted = await db.insert(nonces).values(newNonces).returning();

  return c.json(inserted, HttpStatusCodes.OK);
};

export const patch: AppRouteHandler<typeof routes.patch> = async (c) => {
  const txs = c.req.valid("json");

  // FIX: type of `patchNonceSchema`
  if (!txs.every((tx) => tx.sender && tx.transaction && tx.transactionSigned)) {
    return c.json(
      {
        success: false,
        error: {
          issues: [
            {
              code: ZOD_ERROR_CODES.INVALID_UPDATES,
              path: [],
              message: ZOD_ERROR_MESSAGES.NO_UPDATES,
            },
          ],
          name: "ZodError",
        },
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }

  c.var.logger.info(`Updating nonces: ${JSON.stringify(txs)}`);

  const newNonces = await Promise.all(
    txs.map(async ({ sender, transaction, transactionSigned }) => {
      const sqlWhere = and(
        eq(nonces.sender, sender),
        eq(nonces.transaction, transaction!)
      );

      const nonce = await db.query.nonces.findFirst({ where: sqlWhere });
      if (!nonce) throw new Error("Nonce not found");

      await sendAndConfirmRawTransaction(transactionSigned!);

      const [newNonce] = await db
        .update(nonces)
        .set({ transactionSigned })
        .where(sqlWhere)
        .returning();
      return newNonce;
    })
  );

  if (!newNonces.length) {
    return c.json(
      { message: HttpStatusPhrases.NOT_FOUND },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.json(newNonces, HttpStatusCodes.OK);
};

export const remove: AppRouteHandler<typeof routes.remove> = async (c) => {
  const txs = c.req.valid("json");

  c.var.logger.info(`Remove nonces: ${JSON.stringify(txs)}`);

  const newNonces = await Promise.all(
    txs.map(async ({ id, sender }) => {
      const [newNonce] = await db
        .delete(nonces)
        .where(and(eq(nonces.id, id), eq(nonces.sender, sender)))
        .returning();
      return newNonce;
    })
  );

  if (!newNonces.length) {
    return c.json(
      { message: HttpStatusPhrases.NOT_FOUND },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};
