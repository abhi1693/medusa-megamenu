import type { MedusaContainer } from "@medusajs/framework/types";
import { nativeGroup, groupProducts } from "./catalog";
import type { MenuInput, Target, Tile } from "./validation";
export type NativeTarget = Target & { handle: string; label: string };
export type ProductCard = {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
};
export type StoreSection = {
  key: string;
  label: string;
  view_all: NativeTarget;
  products: ProductCard[];
  tile: Tile | null;
};
export type StoreMenu = {
  handle: string;
  title: string;
  shop_all: NativeTarget | null;
  sections: StoreSection[];
};
async function resolveTarget(
  scope: MedusaContainer,
  target: Target,
): Promise<NativeTarget | null> {
  const g: any = await nativeGroup(scope, target, true);
  return g
    ? {
        type: target.type,
        id: g.id,
        handle: g.handle,
        label: g.name ?? g.title,
      }
    : null;
}
export async function resolveMenu(
  scope: MedusaContainer,
  menu: MenuInput,
  channels: string[],
): Promise<StoreMenu> {
  const sections: StoreSection[] = [];
  for (const s of menu.sections) {
    if (!s.enabled) continue;
    const target = await resolveTarget(scope, s.target);
    if (!target) continue;
    const eligible = await groupProducts(
      scope,
      s.target,
      s.featured_product_ids,
      channels,
    );
    const byId = new Map(eligible.map((p: any) => [p.id, p]));
    const products = s.featured_product_ids
      .flatMap((id) => {
        const p: any = byId.get(id);
        return p
          ? [
              {
                id: p.id,
                title: p.title,
                handle: p.handle,
                thumbnail: p.thumbnail ?? null,
              },
            ]
          : [];
      })
      .slice(0, s.display_limit);
    sections.push({
      key: s.key,
      label: s.label,
      view_all: target,
      products,
      tile: s.tile?.enabled ? s.tile : null,
    });
  }
  return {
    handle: menu.handle,
    title: menu.title,
    shop_all: menu.shop_all ? await resolveTarget(scope, menu.shop_all) : null,
    sections,
  };
}
