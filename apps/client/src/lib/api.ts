import { env } from "@/lib/env";
import { hcClient } from "server/hc";

export const api = hcClient(env.VITE_API_URL);
