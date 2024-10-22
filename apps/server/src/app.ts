import { configureOpenAPI } from "src/lib/configureOpenAPI";
import { createApp } from "src/lib/createApp";
import indexRoute from "src/routes/index.route";
import noncesRoute from "src/routes/nonces/index.route";
import transactionsRoute from "src/routes/transactions/index.route";

const app = createApp();

configureOpenAPI(app);

const routes = [indexRoute, noncesRoute, transactionsRoute] as const;

for (const route of routes) {
  app.route("/", route);
}

export type AppType = (typeof routes)[number];

export default app;
