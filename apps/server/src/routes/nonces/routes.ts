import { createRoute } from "@hono/zod-openapi";
import {
  insertNonceSchema,
  patchNonceSchema,
  removeNonceSchema,
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

export const create = createRoute({
  path: basePath,
  method: "post",
  tags,
  request: {
    query: z.object({
      qt: z.coerce.number().min(1).max(10).optional().default(1),
    }),
    body: jsonContentRequired(insertNonceSchema, "To create nonces"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectNonceSchema),
      "Nonces created"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertNonceSchema),
      "The validation error(s)"
    ),
  },
});

export const patch = createRoute({
  path: basePath,
  method: "patch",
  tags,
  request: {
    body: jsonContentRequired(z.array(patchNonceSchema), "To updated nonces"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectNonceSchema),
      "Nonces updated"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Nonce not found"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(patchNonceSchema),
      "The validation error(s)"
    ),
  },
});

export const remove = createRoute({
  path: basePath,
  method: "delete",
  tags,
  request: {
    body: jsonContentRequired(z.array(removeNonceSchema), "To remove nonces"),
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "Nonces deleted",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Nonce not found"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(removeNonceSchema),
      "The validation error(s)"
    ),
  },
});
