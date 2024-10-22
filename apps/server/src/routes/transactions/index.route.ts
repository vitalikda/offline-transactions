import { createRouter } from "src/lib/createApp";
import * as handlers from "./handlers";
import * as routes from "./routes";

export default createRouter()
  .openapi(routes.create, handlers.create)
  .openapi(routes.patch, handlers.patch);
