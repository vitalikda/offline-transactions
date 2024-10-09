import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "src/lib/createApp";
import type { AppRouteHandler } from "src/lib/types";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const basePath = "/";
const tags = ["Index"];

const route = createRoute({
  path: basePath,
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createMessageObjectSchema("Durable Nonce API"),
      "API Index"
    ),
  },
});

const handler: AppRouteHandler<typeof route> = (c) => {
  return c.json(
    {
      message: "Durable Nonce API",
    },
    HttpStatusCodes.OK
  );
};

export default createRouter().openapi(route, handler);
