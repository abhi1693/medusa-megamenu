import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MEGAMENU } from "../../../modules/megamenu";
import type Service from "../../../modules/megamenu/service";
import type { MenuInput } from "../../../validation";
import { validateCatalog } from "../../../catalog";
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<Service>(MEGAMENU);
  const [mega_menus, count] = await service.listAndCountMegaMenus(
    {},
    { take: 100, order: { handle: "ASC" } },
  );
  res.json({ mega_menus, count });
}
export async function POST(req: MedusaRequest<MenuInput>, res: MedusaResponse) {
  await validateCatalog(req.scope, req.validatedBody);
  const mega_menu = await req.scope
    .resolve<Service>(MEGAMENU)
    .createMegaMenus(req.validatedBody as any);
  res.status(201).json({ mega_menu });
}
