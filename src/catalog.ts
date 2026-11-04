import type { MedusaContainer } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import type { MenuInput, Target } from "./validation";
export async function nativeGroup(
  scope: MedusaContainer,
  target: Target,
  publicOnly: boolean,
) {
  const category = target.type === "category";
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: category ? "product_category" : "product_collection",
    fields: category
      ? ["id", "name", "handle", "is_active", "is_internal"]
      : ["id", "title", "handle"],
    filters: {
      id: target.id,
      ...(category && publicOnly
        ? { is_active: true, is_internal: false }
        : {}),
    },
  });
  return data[0];
}
export async function groupProducts(
  scope: MedusaContainer,
  target: Target,
  ids: string[],
  channels?: string[],
) {
  if (!ids.length || (channels && !channels.length)) return [];
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  let eligibleIds = ids;
  if (channels) {
    const { data: links } = await query.graph({
      entity: "product_sales_channel",
      fields: ["product_id", "sales_channel_id"],
      filters: { product_id: ids, sales_channel_id: channels },
    });
    const linked = new Set(links.map((l: any) => l.product_id));
    eligibleIds = ids.filter((id) => linked.has(id));
    if (!eligibleIds.length) return [];
  }
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "thumbnail",
      "status",
      "sales_channels.id",
    ],
    filters: {
      id: eligibleIds,
      ...(target.type === "category"
        ? { categories: { id: target.id } }
        : { collection_id: target.id }),
      ...(channels ? { status: "published" } : {}),
    },
  });
  // Defense in depth: return only explicitly published products with a current native channel link.
  return channels
    ? data.filter(
        (p: any) =>
          p.status === "published" &&
          p.sales_channels?.some((c: any) => channels.includes(c.id)),
      )
    : data;
}
export async function validateCatalog(scope: MedusaContainer, menu: MenuInput) {
  const targets = [
    ...menu.sections.map((s) => s.target),
    ...(menu.shop_all ? [menu.shop_all] : []),
  ];
  for (const target of targets) {
    if (!(await nativeGroup(scope, target, false)))
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown ${target.type}: ${target.id}`,
      );
  }
  for (const section of menu.sections) {
    const products = await groupProducts(
      scope,
      section.target,
      section.featured_product_ids,
    );
    const found = new Set(products.map((p: any) => p.id));
    if (section.featured_product_ids.some((id) => !found.has(id)))
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Featured products must belong directly to the native group for ${section.key}`,
      );
  }
}
