import { serve } from "@hono/node-server";
import { env } from "src/lib/env";
import app from "./app";

const port = env.PORT;
// eslint-disable-next-line no-console
console.log(`Running at http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
