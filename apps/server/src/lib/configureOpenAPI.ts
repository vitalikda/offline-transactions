import { swaggerUI } from "@hono/swagger-ui";
import packageJSON from "../../package.json" with { type: "json" };
import type { AppOpenAPI } from "./types";

export const configureOpenAPI = (app: AppOpenAPI) => {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: packageJSON.version,
      title: "Durable Nonce API",
    },
  });

  app.get("/ui", swaggerUI({ url: "/doc" }));
};
