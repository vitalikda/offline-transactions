import { createRoute } from "@hono/zod-openapi";
import {
  insertNonceSchema,
  patchNonceSchema,
  selectNonceSchema,
} from "src/db/schema";
import { notFoundSchema } from "src/lib/constants";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { IdParamsSchema, createErrorSchema } from "stoker/openapi/schemas";

const basePath = "/nonces";
const tags = ["Nonces"];

export const create = createRoute({
  path: basePath,
  method: "post",
  request: {
    body: jsonContentRequired(insertNonceSchema, "The nonce to create"),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectNonceSchema, "The created nonce"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertNonceSchema),
      "The validation error(s)"
    ),
  },
});

export const patch = createRoute({
  path: `${basePath}/{id}`,
  method: "patch",
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(patchNonceSchema, "The nonce updates"),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectNonceSchema, "The updated nonce"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Nonce not found"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(patchNonceSchema).or(createErrorSchema(IdParamsSchema)),
      "The validation error(s)"
    ),
  },
});
