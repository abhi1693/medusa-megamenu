import type {
  MedusaStoreRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MEGAMENU } from "../../../../modules/megamenu";
import type Service from "../../../../modules/megamenu/service";
import { resolveMenu } from "../../../../resolve";
import { menuInput } from "../../../../validation";
export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "no-store");
  const channels = req.publishable_key_context?.sales_channel_ids ?? [];
  if (!channels.length)
    return res
      .status(403)
      .json({ message: "A publishable key with sales channels is required" });
  const [menu] = await req.scope
    .resolve<Service>(MEGAMENU)
    .listMegaMenus({ handle: req.params.handle, enabled: true }, { take: 1 });
  if (!menu) return res.status(404).json({ message: "Menu not found" });
  const mega_menu = await resolveMenu(
    req.scope,
    menuInput.parse(menuInputKeys(menu)),
    channels,
  );
  res.json({ mega_menu });
}
function menuInputKeys(menu: any) {
  return {
    handle: menu.handle,
    title: menu.title,
    enabled: menu.enabled,
    shop_all: menu.shop_all,
    sections: menu.sections,
  };
}
