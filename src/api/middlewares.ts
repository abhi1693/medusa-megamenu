import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
} from "@medusajs/framework/http";
import { menuInput } from "../validation";
import { guard } from "./guard";
export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/mega-menus*",
      middlewares: [authenticate("user", ["session", "bearer"]), guard],
    },
    {
      matcher: "/admin/mega-menus",
      method: "POST",
      middlewares: [validateAndTransformBody(menuInput)],
    },
    {
      matcher: "/admin/mega-menus/:id",
      method: "POST",
      middlewares: [validateAndTransformBody(menuInput)],
    },
  ],
});
