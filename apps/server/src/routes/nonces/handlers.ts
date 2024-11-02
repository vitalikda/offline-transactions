import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import db from "src/db";
import { authorities, nonces } from "src/db/schema";
import { sendAndConfirmRawTransaction, serialize } from "src/lib/solana";
import type { AppRouteHandler } from "src/lib/types";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import type * as routes from "./routes";
import {
  closeNonceAccount,
  createNonceAccount,
  encodeKeypair,
  getAuthKeypair,
  getKeypair,
  makeKeypairs,
} from "./utils";

export const list: AppRouteHandler<typeof routes.list> = async (c) => {
  const { sender } = c.req.valid("query");

  const nonceList = await db.query.nonces.findMany({
    where: and(eq(nonces.sender, sender), isNotNull(nonces.transaction)),
  });

  return c.json(nonceList, HttpStatusCodes.OK);
};

export const create: AppRouteHandler<typeof routes.create> = async (c) => {
  const { qt } = c.req.valid("query");
  const { sender } = c.req.valid("json");

  await db
    .delete(nonces)
    .where(and(eq(nonces.sender, sender), isNull(nonces.transaction)));

  const authority = await db.query.authorities.findFirst({
    where: eq(authorities.sender, sender),
  });

  const nonceAuthority = !authority
    ? getKeypair()
    : getAuthKeypair(authority.nonceSecretKey);

  if (!authority) {
    await db.insert(authorities).values({
      sender,
      nonceSecretKey: encodeKeypair(nonceAuthority),
      noncePublicKey: nonceAuthority.publicKey.toString(),
    });
  }

  const nonceKeypairs = makeKeypairs(qt);

  const newNonces = nonceKeypairs.map((nonce) => ({
    sender,
    noncePublicKey: nonce.publicKey.toString(),
  })) satisfies (typeof nonces.$inferInsert)[];

  await db.insert(nonces).values(newNonces);

  const noncesTxs = await Promise.all(
    nonceKeypairs.map(async (nonce) => {
      const tx = await createNonceAccount({
        nonceAccount: nonce,
        nonceAuthority,
        feePayer: sender,
      });
      return {
        sender,
        noncePublicKey: nonce.publicKey.toString(),
        tx: serialize(tx),
      };
    })
  );
  c.var.logger.info(`Created nonces: ${noncesTxs.map((n) => n.tx).join(", ")}`);

  return c.json(noncesTxs, HttpStatusCodes.OK);
};

export const createUpdate: AppRouteHandler<typeof routes.createUpdate> = async (
  c
) => {
  const txs = c.req.valid("json");
  c.var.logger.info(`Updating nonces: ${JSON.stringify(txs)}`);

  const newNonces = await Promise.all(
    txs.map(async ({ sender, noncePublicKey, txSigned }) => {
      const tx = await sendAndConfirmRawTransaction(txSigned);

      const [newNonce] = await db
        .update(nonces)
        .set({ transaction: tx })
        .where(
          and(
            eq(nonces.sender, sender),
            eq(nonces.noncePublicKey, noncePublicKey)
          )
        )
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
  const { sender } = txs[0];
  c.var.logger.info(`Remove nonces: ${JSON.stringify(txs)}`);

  const foundAccounts = await db.query.nonces.findMany({
    where: and(
      eq(nonces.sender, sender),
      inArray(
        nonces.noncePublicKey,
        txs.map((tx) => tx.noncePublicKey)
      )
    ),
  });

  const nonceAuthority = await db.query.authorities.findFirst({
    where: eq(authorities.sender, sender),
  });

  if (!foundAccounts.length || !nonceAuthority) {
    return c.json(
      { message: HttpStatusPhrases.NOT_FOUND },
      HttpStatusCodes.NOT_FOUND
    );
  }

  const newNonces = await Promise.all(
    foundAccounts.map(async ({ sender, noncePublicKey }) => {
      const tx = await closeNonceAccount({
        nonceAccountPublicKey: noncePublicKey,
        nonceAuthority: getAuthKeypair(nonceAuthority.nonceSecretKey),
        feePayer: sender,
      });
      return {
        sender,
        noncePublicKey,
        tx: serialize(tx),
      };
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

export const removeUpdate: AppRouteHandler<typeof routes.removeUpdate> = async (
  c
) => {
  const txs = c.req.valid("json");
  c.var.logger.info(`Remove nonces: ${JSON.stringify(txs)}`);

  const oldNonces = await Promise.all(
    txs.map(async ({ sender, noncePublicKey, txSigned }) => {
      await sendAndConfirmRawTransaction(txSigned);

      const [oldNonce] = await db
        .delete(nonces)
        .where(
          and(
            eq(nonces.sender, sender),
            eq(nonces.noncePublicKey, noncePublicKey)
          )
        )
        .returning();

      await db
        .delete(authorities)
        .where(
          and(
            eq(authorities.sender, sender),
            eq(authorities.noncePublicKey, noncePublicKey)
          )
        );

      return oldNonce;
    })
  );

  if (!oldNonces.length) {
    return c.json(
      { message: HttpStatusPhrases.NOT_FOUND },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};
