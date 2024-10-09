import path from "node:path";
import { cwd } from "node:process";
import { config } from "dotenv";
import { z } from "zod";

config({
  path: path.resolve(cwd(), ".env"),
});

const envSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().default(3000),
    LOG_LEVEL: z.string().default("info"),
    DATABASE_URL: z.string().url(),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    AUTH_KEYPAIR: z.string(),
  })
  .superRefine((input, ctx) => {
    if (input.NODE_ENV === "production" && !input.DATABASE_AUTH_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.invalid_type,
        expected: "string",
        received: "undefined",
        path: ["DATABASE_AUTH_TOKEN"],
        message: "Must be set when NODE_ENV is 'production'",
      });
    }
  });

// eslint-disable-next-line node/no-process-env
const envParsed = envSchema.safeParse(process.env);

if (!envParsed.success) {
  console.error("Invalid env:");
  console.error(JSON.stringify(envParsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export type ENV = z.infer<typeof envSchema>;

export const env = envParsed.data;
