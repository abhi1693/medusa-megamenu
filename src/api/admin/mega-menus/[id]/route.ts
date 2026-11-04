import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MEGAMENU } from "../../../../modules/megamenu";
import type Service from "../../../../modules/megamenu/service";
import type { MenuInput } from "../../../../validation";
import { validateCatalog } from "../../../../catalog";
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({
    mega_menu: await req.scope
      .resolve<Service>(MEGAMENU)
      .retrieveMegaMenu(req.params.id),
  });
}
export async function POST(req: MedusaRequest<MenuInput>, res: MedusaResponse) {
  await validateCatalog(req.scope, req.validatedBody);
  const service = req.scope.resolve<Service>(MEGAMENU);
  await service.retrieveMegaMenu(req.params.id);
  res.json({
    mega_menu: await service.updateMegaMenus({
      id: req.params.id,
      ...req.validatedBody,
    } as any),
  });
}
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  await req.scope.resolve<Service>(MEGAMENU).softDeleteMegaMenus(req.params.id);
  res.json({ id: req.params.id, object: "mega_menu", deleted: true });
}
