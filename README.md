# Medusa Mega Menu

Reusable, headless navigation for Medusa Commerce v2. Native products, categories, collections, files and sales channels remain authoritative. No products, categories, collections or routes are created by this plugin. No Uniek styling is bundled.

## Compatibility and installation

Validated against **Medusa 2.22.1**, Admin SDK/icons 2.22.1, UI 4.2.8, React 18, Node 24 (minimum Node 22.22). The inspected Uniek manifests declare 2.22.2, but their installed framework, commerce modules and Admin SDK are actually 2.22.1. The registry did not resolve Admin SDK 2.22.2 during implementation. Do not treat declared dependencies as proof of runtime compatibility; align the host's actual installed versions before integration. Later Medusa versions require validation.

This package is not published to npm. Build and pack it locally after review:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm pack --ignore-scripts
# In a separately authorized Medusa host:
npm install /path/to/abhi1693-medusa-megamenu-0.0.1.tgz
```

Register the plugin in `medusa-config.ts`:

```ts
plugins: [{ resolve: "@abhi1693/medusa-megamenu", options: {} }]
```

Medusa discovers the packaged `megamenu` module, API routes, migrations and Admin extension. Run the host's `medusa db:migrate`, then build the host Admin. Do not also register the same module manually. No plugin activation or migration on Uniek is included in this batch.

## Admin management

Open **Mega menus**. Create a menu with a unique handle (for example `main`). A menu starts unpublished. Add sections, select their native category or collection, choose and order individual featured products, and choose any display limit from 0–50 (top 3, top 5, etc.). Section order is array order. Section keys are unique stable identifiers for storefront components. A section's View all target is always its entire native group; a separate optional Shop all target is also a native category or collection.

The editor searches native catalog endpoints; it does not maintain its own product picker database. Product/category/collection read permissions are needed for those selectors in RBAC hosts. Search narrows large catalogs; the selectors show up to 100 groups or 50 products per search. Product IDs remain visible when not in the current search results. A menu may have at most 30 sections, each with at most 50 selected products. List management currently displays at most 100 menus.

Each section optionally has one image/logo/feature tile. Enable it, enter an existing Medusa upload/CDN URL and meaningful alt text, and optionally enter a link. Disabling the tile removes it. Upload assets through Medusa's existing file management; this plugin does not introduce file storage. API callers can retain the native `file_id` alongside its URL. Only HTTPS URLs or local absolute paths are accepted; the plugin never fetches image or link URLs. Configure the storefront's image host allowlist as needed.

Saving replaces the entire menu aggregate in one native module-service write. No multi-module commerce mutations or compensating saga are needed. Concurrent saves use last-write-wins; coordinate editors. Publishing is explicit via the menu switch. Delete soft-deletes the menu. A unique active handle prevents collisions.

## Native catalog prerequisites

Categories are hierarchical and a product can belong to multiple categories. Collections are curated single-collection groupings. This plugin does not reclassify products or infer membership from names. A selected product must belong **directly** to the selected category or collection when saving. Parent categories do not implicitly include descendants; merchants should choose the exact native group whose listing the storefront supports. Native hierarchy can remain as deep as the store needs; menu sections are a deliberate flat presentation of selected groups.

Example: create or choose an existing category named “Networking”, assign the intended products using native Medusa management, select that category in a section, manually choose three products and set the limit to 3. View all still points to the full Networking category. This is a generic setup example, not a seed script. Existing seed/development catalog data is untouched.

At every Store request, missing/deleted groups are omitted, inactive/internal categories are omitted, and product status, group membership and sales-channel links are rechecked. Removed or unpublished products disappear without backfilling; eligible selected products retain their order before the limit is applied. An empty section can still offer View all. Category visibility follows that exact native category's active/internal flags, consistent with native product filtering; no ancestor visibility policy is invented.

## API

Admin requests use native staff session or bearer authentication. Responses have `Cache-Control: no-store`.

| Method | Path | Result |
| --- | --- | --- |
| GET | `/admin/mega-menus` | `{ mega_menus, count }` (first 100, handle order) |
| POST | `/admin/mega-menus` | Create; `{ mega_menu }`, status 201 |
| GET | `/admin/mega-menus/:id` | `{ mega_menu }` |
| POST | `/admin/mega-menus/:id` | Full validated replacement; `{ mega_menu }` |
| DELETE | `/admin/mega-menus/:id` | Soft delete acknowledgement |
| GET | `/store/mega-menus/:handle` | Published resolved `{ mega_menu }`; otherwise 404 |

Create/update body:

```json
{
  "handle": "main",
  "title": "Main navigation",
  "enabled": false,
  "shop_all": { "type": "category", "id": "pcat_existing_parent" },
  "sections": [{
    "key": "networking",
    "label": "Networking",
    "enabled": true,
    "target": { "type": "category", "id": "pcat_existing_group" },
    "featured_product_ids": ["prod_existing_1", "prod_existing_2"],
    "display_limit": 3,
    "tile": null
  }]
}
```

Use real native IDs; the placeholders above intentionally fail catalog validation. `type: "collection"` accepts a native collection ID. Tile shape: `{ "enabled": true, "url": "https://cdn.example.com/logo.png", "alt": "Brand", "href": "/brands/example", "file_id": "file_existing" }`; `href` and `file_id` are optional. Unknown fields, duplicate IDs/keys, unsafe URLs and excessive limits are rejected.

Store requests require a valid native `x-publishable-api-key` linked to sales channels. The endpoint uses **only** `req.publishable_key_context.sales_channel_ids`; caller query parameters cannot expand scope. A key with no channels is rejected. For a key linked to multiple channels the eligible products are the union, matching its scope. Use a dedicated key per storefront when stores must be isolated. Menu configuration itself is public once enabled, shared by handle within one Medusa backend; there is no tenant identity inferred from a domain. Use distinct handles per storefront.

The public contract contains only menu title/handle, public native target IDs/handles/labels, section keys/labels, optional enabled tiles and product cards `{ id, title, handle, thumbnail }`. It does not serialize full products, metadata, variants, costs, admin fields, unselected IDs or disabled tiles. Prices and availability should be obtained from the native Store Products API with the storefront's region/currency context; the plugin does not duplicate pricing or inventory logic. Responses disable caching so publication/channel changes take effect on subsequent requests; storefront caches must choose their own invalidation policy.

## RBAC integration

Without an RBAC module, Medusa's native model applies: any authenticated, existing staff user can manage navigation. When `rbac_access` is registered, the plugin additionally delegates authorization to its persisted principal and `allows` policy. It never accepts superuser status from a request. The RBAC service grants genuine **active native staff superusers** access to all actions; ordinary principals require the permissions below. The RBAC module's global Admin guard also requires custom route registration.

Merge these exports into the host's existing RBAC module options:

```ts
import { megamenuPermissions, megamenuResources } from "@abhi1693/medusa-megamenu/rbac"

// Within existing @abhi1693/medusa-rbac module options:
permissions: [...existingPermissions, ...megamenuPermissions],
resources: [...existingResources, ...megamenuResources],
```

`megamenu.view` (“View mega menus”, Navigation) guards reads; `megamenu.manage` (“Manage mega menus”, Navigation) guards writes/deletes. Give editors both, plus native `products.view`, `categories.view`, `collections.view` for selectors. Native uploads need the host's media permission. Registration, displayed catalog and enforced identifiers use the same exports. No roles or assignments are auto-created. The Admin navigation entry can be visible to staff without access; its API calls are still denied. No plugin-specific hiding rule excludes superusers.

## Storefront integration and styling

```ts
const { mega_menu } = await fetch(`${backend}/store/mega-menus/main`, {
  headers: { "x-publishable-api-key": publishableKey },
  cache: "no-store",
}).then(async response => {
  if (!response.ok) throw new Error(`Menu request failed: ${response.status}`)
  return response.json()
})
```

Map each `view_all`/`shop_all` reference to the storefront's **existing** category or collection listing route using its handle. Map product handles to existing product detail routes. Do not link View all to the small featured-product array. URL patterns are intentionally not assumed; native IDs and handles let every store choose its own routes.

Render your own accessible menu shell (focus handling, keyboard navigation, open/close behavior) and slot components for section headings, product cards, View all, Shop all and optional tiles. When `tile` is null, omit that slot and let your grid use the freed space. Different stores may use entirely different layouts, typography and interaction. Exported TypeScript contracts (`StoreMenu`, `StoreSection`, `NativeTarget`, `ProductCard`) support those adapters. There is no bundled renderer, CSS, Uniek-specific inventory or search service. The approved Uniek Demo4 informed the optional tile and grouped navigation concepts only. Uniek section implementation and live integration require separate scope confirmation.

### Optional collection-images interoperability

The user-provided [Collection images integration](https://medusajs.com/integrations/@alphabitemedusa-collection-images) was reviewed separately. Its listed/latest package is `@alphabite/medusa-collection-images@0.3.7`. The listing says Medusa 2.14+; its published peer ranges include Medusa/framework/Admin SDK `^2.13.6` and UI `^4.0.3`, so they admit the inspected 2.22.1/4.2.8 versions. That establishes declared compatibility, not tested runtime compatibility. The linked [GitHub source](https://github.com/alphabite-dev/medusa-collection-images) returned repository-not-found during review; the published npm tarball was inspected read-only, without installation or activation.

Its actual model is a separate `product_collection_image` module with `id`, `url`, `rank`, `product_collection_id`, and nullable `metadata`, linked as a list to native product collections. It offers `GET /admin/product-collection/:id` and POST/PUT/DELETE `/admin/product-collection/:id/images`; the Admin widget uses native collection `metadata.thumbnail` for the selected thumbnail. The inspected package contains no Store route. It does not make images a built-in collection field or add native file IDs to its image model. Its DELETE handler also contains a `product_category_images` / `product_category_id` readback, which should be tested before adopting it for collection-image management.

Recommendation: keep this integration optional. An existing uploaded URL from that integration can already be used as a menu tile URL, reusing the asset without a second upload or image store. A merchant must still choose menu-specific alt text/link and enable the tile. This is an explicit reference to the same asset URL; it does not automatically follow later collection-image edits. A collection's reusable thumbnail is catalog presentation, while a menu's optional promotional/logo tile may be entirely different. If dynamic collection-thumbnail inheritance is later requested, add a small host adapter that reads the explicitly selected native collection and returns only a safe URL/alt pair; do not serialize its full metadata or expose its Admin endpoint publicly. Do not add a hard dependency, new image database, or unconditional inheritance. No third-party package has been added to this plugin or Uniek.

## Verification

`npm run typecheck`, `npm test`, `npm run build`, and `npm run test:package` validate the source and distributable. `npm run test:integration` builds/packs the plugin and verifies its migrations, native catalog queries and real HTTP APIs in a disposable PostgreSQL/Medusa host (Docker required). Unit tests exercise unsafe input, public response allowlists, product order/limits, native membership failures, publication/channel filtering, missing/disabled menus and trusted staff/RBAC decisions. Exact results and limitations are recorded in `VERIFICATION.md`. No runtime verification in Uniek or storefront visual verification is implied.

Official references: [Medusa plugins](https://docs.medusajs.com/learn/fundamentals/plugins), [custom modules](https://docs.medusajs.com/learn/fundamentals/modules), [publishable-key channel context](https://docs.medusajs.com/resources/commerce-modules/sales-channel/publishable-api-keys), [middleware](https://docs.medusajs.com/learn/fundamentals/api-routes/middlewares). Exact API behavior was also checked against installed Medusa 2.22.1 source.
