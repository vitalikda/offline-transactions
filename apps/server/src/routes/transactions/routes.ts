import { createRoute } from "@hono/zod-openapi";
import {
  insertTransactionSchema,
  selectTransactionSchema,
  senderType,
} from "src/db/schema";
import { notFoundSchema } from "src/lib/constants";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { IdParamsSchema, createErrorSchema } from "stoker/openapi/schemas";
import { z } from "zod";

const basePath = "/transactions";
const tags = ["Transactions"];

export const list = createRoute({
  path: basePath,
  method: "get",
  tags,
  request: {
    query: z.object({
      sender: senderType,
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectTransactionSchema),
      "List transactions"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Transactions not found"
    ),
  },
});

export const create = createRoute({
  path: basePath,
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(insertTransactionSchema, "To create transaction"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectTransactionSchema
        .pick({
          id: true,
          sender: true,
          noncePublicKey: true,
        })
        .and(
          z.object({
            tx: z.string().min(1),
          })
        ),
      "The transaction created"
    ),
    [HttpStatusCodes.PAYMENT_REQUIRED]: jsonContent(
      z.object({
        message: z.string().min(1),
      }),
      "The transaction requires nonce account"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertTransactionSchema),
      "The validation error(s)"
    ),
  },
});

const patchTransactionSchema = insertTransactionSchema
  .required({ id: true })
  .pick({ id: true, sender: true })
  .and(
    z.object({
      txSigned: z.string().min(1),
    })
  );

export const patch = createRoute({
  path: basePath,
  method: "patch",
  tags,
  request: {
    body: jsonContentRequired(patchTransactionSchema, "To update transaction"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectTransactionSchema,
      "The transaction updated"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Transaction not found"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(patchTransactionSchema).or(
        createErrorSchema(IdParamsSchema)
      ),
      "The validation error(s)"
    ),
  },
});

const executeTransactionSchema = z.array(
  insertTransactionSchema
    .required({ id: true })
    .pick({ id: true, sender: true })
);

export const execute = createRoute({
  path: `${basePath}/execute`,
  method: "patch",
  tags,
  request: {
    body: jsonContentRequired(
      executeTransactionSchema,
      "To execute transactions"
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectTransactionSchema),
      "Transactions executed"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Transaction not found"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(executeTransactionSchema),
      "The validation error(s)"
    ),
  },
});
