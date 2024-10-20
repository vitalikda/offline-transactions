import type { AppType } from "./app";
import { hc } from "hono/client";

// assign the client to a variable to calculate the type when compiling
const _client = hc<AppType>("");
export type Client = typeof _client;

export const hcClient = (...args: Parameters<typeof hc>): Client =>
  hc<AppType>(...args);
