import { createRoute } from "@hono/zod-openapi";
import {
  insertNonceSchema,
  selectNonceSchema,
  senderType,
} from "src/db/schema";
import { notFoundSchema } from "src/lib/constants";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";
import { z } from "zod";

const basePath = "/nonces";
const tags = ["Nonces"];

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
      z.array(selectNonceSchema),
      "List nonces"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Nonces not found"
    ),
  },
});

const createNonceSchema = insertNonceSchema.pick({ sender: true });

export const create = createRoute({
  path: basePath,
  method: "post",
  tags,
  request: {
    query: z.object({
      qt: z.coerce.number().min(1).max(10).optional().default(1),
    }),
    body: jsonContentRequired(createNonceSchema, "To create nonces"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(
        selectNonceSchema.pick({ sender: true, noncePublicKey: true }).and(
          z.object({
            tx: z.string().min(1),
          })
        )
      ),
      "Nonce transactions to sign"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createNonceSchema),
      "The validation error(s)"
    ),
  },
});

const createUpdateNonceSchema = z.array(
  insertNonceSchema.pick({ sender: true, noncePublicKey: true }).and(
    z.object({
      tx: z.string().min(1),
      txSigned: z.string().min(1),
    })
  )
);

export const createUpdate = createRoute({
  path: basePath,
  method: "patch",
  tags,
  request: {
    body: jsonContentRequired(createUpdateNonceSchema, "To updated nonces"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectNonceSchema),
      "Nonces updated"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Nonce not found"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createUpdateNonceSchema),
      "The validation error(s)"
    ),
  },
});

const removeNonceSchema = z.array(
  insertNonceSchema.pick({ sender: true, noncePublicKey: true })
);

export const remove = createRoute({
  path: `${basePath}/remove`,
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(removeNonceSchema, "To remove nonces"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(
        selectNonceSchema.pick({ sender: true, noncePublicKey: true }).and(
          z.object({
            tx: z.string().min(1),
          })
        )
      ),
      "Nonces transactions to sign"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Nonce not found"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(removeNonceSchema),
      "The validation error(s)"
    ),
  },
});

const removeUpdateNonceSchema = z.array(
  insertNonceSchema.pick({ sender: true, noncePublicKey: true }).and(
    z.object({
      tx: z.string().min(1),
      txSigned: z.string().min(1),
    })
  )
);

export const removeUpdate = createRoute({
  path: `${basePath}/remove`,
  method: "patch",
  tags,
  request: {
    body: jsonContentRequired(removeUpdateNonceSchema, "To remove nonces"),
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "Nonces deleted",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Nonce not found"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(removeUpdateNonceSchema),
      "The validation error(s)"
    ),
  },
});
