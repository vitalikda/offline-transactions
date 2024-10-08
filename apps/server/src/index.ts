import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono({ strict: false }).basePath("/api");

app.get("/", (c) => {
  return c.text("Server is running!");
});

const port = Number.parseInt(process.env.PORT || "3000");
console.log(`Running at http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
