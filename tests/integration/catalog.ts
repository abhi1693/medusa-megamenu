import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import type {
  ExecArgs,
  IProductModuleService,
  ISalesChannelModuleService,
} from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
const loadPackage = createRequire(__filename);
const installed = loadPackage.resolve("@abhi1693/medusa-megamenu");
const { menuInput } = loadPackage("@abhi1693/medusa-megamenu");
const { resolveMenu } = loadPackage(
  installed.replace(/index\.js$/, "resolve.js"),
);
const { validateCatalog } = loadPackage(
  installed.replace(/index\.js$/, "catalog.js"),
);
const { GET: storeGet } = loadPackage(
  installed.replace(/index\.js$/, "api/store/mega-menus/[handle]/route.js"),
);

export default async function check({ container }: ExecArgs) {
  assert.match(
    process.env.DATABASE_URL ?? "",
    /127\.0\.0\.1:\d+\/megamenu_test$/,
  );
  const product = container.resolve<IProductModuleService>(Modules.PRODUCT);
  const channels = container.resolve<ISalesChannelModuleService>(
    Modules.SALES_CHANNEL,
  );
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const service: any = container.resolve("megamenu");
  const a = await channels.createSalesChannels({ name: "Store A" });
  const b = await channels.createSalesChannels({ name: "Store B" });
  const category = await product.createProductCategories({
    name: "Networking",
    handle: "networking",
    is_active: true,
    is_internal: false,
  });
  const collection = await product.createProductCollections({
    title: "Curated",
    handle: "curated",
  });
  const make = async (
    title: string,
    status: "published" | "draft",
    channel: string,
  ) => {
    const p = await product.createProducts({
      title,
      handle: title.toLowerCase(),
      status,
      collection_id: collection.id,
      category_ids: [category.id],
    });
    await link.create({
      [Modules.PRODUCT]: { product_id: p.id },
      [Modules.SALES_CHANNEL]: { sales_channel_id: channel },
    });
    return p;
  };
  const one = await make("One", "published", a.id);
  const two = await make("Two", "published", a.id);
  const other = await make("Other", "published", b.id);
  const draft = await make("Draft", "draft", a.id);
  const menu = menuInput.parse({
    handle: "main",
    title: "Main",
    enabled: true,
    shop_all: { type: "collection", id: collection.id },
    sections: [
      {
        key: "network",
        label: "Network",
        target: { type: "category", id: category.id },
        featured_product_ids: [two.id, other.id, draft.id, one.id],
        display_limit: 3,
      },
    ],
  });
  await validateCatalog(container, menu);
  const saved = await service.createMegaMenus(menu);
  assert.equal(
    (await service.retrieveMegaMenu(saved.id)).sections[0]
      .featured_product_ids[0],
    two.id,
  );
  const result = await resolveMenu(container, menu, [a.id]);
  assert.deepEqual(
    result.sections[0].products.map((p: any) => p.id),
    [two.id, one.id],
  );
  assert.equal(result.shop_all.handle, "curated");
  assert.deepEqual(
    (await resolveMenu(container, menu, [b.id])).sections[0].products.map(
      (p: any) => p.id,
    ),
    [other.id],
  );
  // Collection membership path uses native single-collection filtering.
  const collectionMenu = {
    ...menu,
    sections: [
      {
        ...menu.sections[0],
        target: { type: "collection", id: collection.id },
      },
    ],
  };
  await validateCatalog(container, collectionMenu);
  assert.deepEqual(
    (
      await resolveMenu(container, collectionMenu, [a.id])
    ).sections[0].products.map((p: any) => p.id),
    [two.id, one.id],
  );
  await product.updateProducts(one.id, { status: "draft" });
  assert.deepEqual(
    (await resolveMenu(container, menu, [a.id])).sections[0].products.map(
      (p: any) => p.id,
    ),
    [two.id],
  );
  await link.dismiss({
    [Modules.PRODUCT]: { product_id: two.id },
    [Modules.SALES_CHANNEL]: { sales_channel_id: a.id },
  });
  assert.deepEqual(
    (await resolveMenu(container, menu, [a.id])).sections[0].products,
    [],
  );
  await product.updateProductCategories(category.id, { is_internal: true });
  assert.deepEqual((await resolveMenu(container, menu, [a.id])).sections, []);
  const outside = await product.createProducts({
    title: "Outside",
    handle: "outside",
  });
  await assert.rejects(
    () =>
      validateCatalog(container, {
        ...menu,
        sections: [{ ...menu.sections[0], featured_product_ids: [outside.id] }],
      }),
    /must belong directly/,
  );
  await assert.rejects(
    () => service.createMegaMenus(menu),
    /duplicate|unique|already exists/i,
  );
  const req: any = {
    scope: container,
    params: { handle: "main" },
    publishable_key_context: { sales_channel_ids: [a.id] },
  };
  const response: any = {
    setHeader() {},
    json(v: any) {
      this.body = v;
    },
    status(n: number) {
      this.code = n;
      return this;
    },
  };
  await storeGet(req, response);
  assert.equal(response.body.mega_menu.handle, "main");
  await service.updateMegaMenus({ id: saved.id, enabled: false });
  await storeGet(req, response);
  assert.equal(response.code, 404);
  await service.softDeleteMegaMenus(saved.id);
  assert.equal((await service.listMegaMenus({ handle: "main" })).length, 0);
  await service.createMegaMenus(menu); // partial unique handle allows replacement after deletion
  await product.updateProductCategories(category.id, { is_internal: false });
  await product.updateProducts(one.id, { status: "published" });
  await link.create({
    [Modules.PRODUCT]: { product_id: two.id },
    [Modules.SALES_CHANNEL]: { sales_channel_id: a.id },
  });
  const user = await container
    .resolve<any>(Modules.USER)
    .createUsers({ email: "test@example.invalid" });
  const keyA = await container
    .resolve<any>(Modules.API_KEY)
    .createApiKeys({
      title: "Store A",
      type: "publishable",
      created_by: user.id,
    });
  const keyB = await container
    .resolve<any>(Modules.API_KEY)
    .createApiKeys({
      title: "Store B",
      type: "publishable",
      created_by: user.id,
    });
  await link.create({
    [Modules.API_KEY]: { publishable_key_id: keyA.id },
    [Modules.SALES_CHANNEL]: { sales_channel_id: a.id },
  });
  await link.create({
    [Modules.API_KEY]: { publishable_key_id: keyB.id },
    [Modules.SALES_CHANNEL]: { sales_channel_id: b.id },
  });
  const jwt = loadPackage("jsonwebtoken").sign(
    {
      actor_id: user.id,
      actor_type: "user",
      auth_identity_id: "test_identity",
      app_metadata: {},
    },
    process.env.JWT_SECRET,
    { expiresIn: "5m" },
  );
  await writeFile(
    "fixture.json",
    JSON.stringify({
      keyA: keyA.token,
      keyB: keyB.token,
      jwt,
      menu,
      expectedA: [two.id, one.id],
      expectedB: [other.id],
    }),
  );
  console.log(
    "PASS packaged module CRUD, category/collection membership, publication, channel removal, private categories, Store handler, soft delete and unique handles",
  );
}
