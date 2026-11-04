import type {
  MedusaRequest,
  AuthenticatedMedusaRequest,
  MedusaResponse,
  MedusaNextFunction,
} from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import type { IUserModuleService } from "@medusajs/framework/types";
type AccessService = {
  principalForRequest(
    req: MedusaRequest,
  ): Promise<{ actor_id: string; actor_type: string; active: boolean } | null>;
  permissionContext(req: MedusaRequest): Promise<Record<string, unknown>>;
  allows(
    principal: unknown,
    permission: string,
    context: Record<string, unknown>,
  ): boolean;
};
export async function guard(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  try {
    const auth = (req as AuthenticatedMedusaRequest).auth_context;
    if (auth?.actor_type !== "user" || !auth.actor_id)
      return res.status(401).json({ message: "Staff authentication required" });
    await req.scope
      .resolve<IUserModuleService>(Modules.USER)
      .retrieveUser(auth.actor_id, { select: ["id"] });
    res.setHeader("Cache-Control", "no-store");
    if (req.scope.hasRegistration("rbac_access")) {
      const access = req.scope.resolve<AccessService>("rbac_access");
      const principal = await access.principalForRequest(req);
      const permission = ["GET", "HEAD"].includes(req.method)
        ? "megamenu.view"
        : "megamenu.manage";
      if (
        !principal ||
        principal.actor_id !== auth.actor_id ||
        principal.actor_type !== "user" ||
        !principal.active ||
        !access.allows(
          principal,
          permission,
          await access.permissionContext(req),
        )
      )
        return res
          .status(403)
          .json({ message: "Mega-menu permission required" });
    }
    return next();
  } catch (e) {
    return next(e);
  }
}
