import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  VITE_API_URL: z.string().url(),
});

export type env = z.infer<typeof envSchema>;

const envParsed = envSchema.safeParse(import.meta.env);

if (!envParsed.success) {
  console.error("Invalid env:");
  console.error(JSON.stringify(envParsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

const envData = envParsed.data;

export default envData;
