import { and, eq, isNotNull, isNull } from "drizzle-orm";
import db from "src/db";
import { transactions } from "src/db/schema";
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from "src/lib/constants";
import type { AppRouteHandler } from "src/lib/types";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import type * as routes from "./routes";
import { createAdvanceTx } from "./utils";
import { getNonceInfo } from "src/routes/nonces/utils";
import { sendAndConfirmRawTransaction, serialize } from "src/lib/solana";

export const create: AppRouteHandler<typeof routes.create> = async (c) => {
  const { sender, recipient, amount } = c.req.valid("json");

  const nonce = await db.query.nonces.findFirst({
    columns: {
      noncePublicKey: true,
    },
    where: and(
      eq(transactions.sender, sender),
      isNotNull(transactions.transactionSigned)
    ),
  });

  if (!nonce) {
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

  const newNonce = await getNonceInfo(nonce.noncePublicKey);

  // NOTE: clean up old transactions
  await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.sender, sender),
        isNull(transactions.transactionSigned)
      )
    );

  const advanceTx = createAdvanceTx({
    noncePublicKey: nonce.noncePublicKey,
    nonce: newNonce.nonce,
    signer: sender,
    recipient,
    amount,
  });

  const [inserted] = await db
    .insert(transactions)
    .values({
      sender,
      recipient,
      amount,
      transaction: serialize(advanceTx),
    })
    .returning();

  return c.json(inserted, HttpStatusCodes.OK);
};

export const patch: AppRouteHandler<typeof routes.patch> = async (c) => {
  const { sender, transaction, transactionSigned } = c.req.valid("json");

  if (!transaction || !transactionSigned) {
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

  c.var.logger.info(
    `Updating transaction: ${JSON.stringify({ transaction, transactionSigned })}`
  );

  const [updated] = await db
    .update(transactions)
    .set({ transactionSigned })
    .where(
      and(
        eq(transactions.sender, sender),
        eq(transactions.transaction, transaction)
      )
    )
    .returning();

  if (!updated) {
    return c.json(
      { message: HttpStatusPhrases.NOT_FOUND },
      HttpStatusCodes.NOT_FOUND
    );
  }

  // NOTE: executed immediately, but can be added to a queue
  const tx = await sendAndConfirmRawTransaction(transactionSigned);
  c.var.logger.info(`Transaction executed: ${tx}`);

  return c.json(updated, HttpStatusCodes.OK);
};
