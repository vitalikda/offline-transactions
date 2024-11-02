import { createRouter } from "src/lib/createApp";
import * as handlers from "./handlers";
import * as routes from "./routes";

export default createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.create, handlers.create)
  .openapi(routes.createUpdate, handlers.createUpdate)
  .openapi(routes.remove, handlers.remove)
  .openapi(routes.removeUpdate, handlers.removeUpdate);
