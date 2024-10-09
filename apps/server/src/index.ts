import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono({ strict: false }).basePath("/api");

app.get("/", (c) => {
  return c.text("Server is running!");
});

console.log("Running at http://localhost:3000");

serve(app);
