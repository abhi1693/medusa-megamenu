# Medusa Mega Menu

[![CI](https://github.com/abhi1693/medusa-megamenu/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/abhi1693/medusa-megamenu/actions/workflows/ci.yml)
[![Medusa 2.22.1](https://img.shields.io/badge/Medusa-2.22.1-7c3aed)](https://docs.medusajs.com/)
[![Node.js >=22.22.0](https://img.shields.io/badge/Node.js-%E2%89%A522.22.0-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MIT license](https://img.shields.io/github/license/abhi1693/medusa-megamenu)](LICENSE)
[![Sponsor](https://img.shields.io/badge/Sponsor-abhi1693-ea4aaa?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/abhi1693)

Headless navigation for Medusa v2, with native Admin editing for menus, category and collection sections, ordered featured products and optional image tiles. Resolve published menus through a Store API that respects the native catalog and the requesting storefront's sales channels.

**Your native catalog remains authoritative.** The plugin stores menu configuration and references existing products, categories and collections. Your storefront owns its routes, rendering and interaction; the plugin does not create catalog records or bundle a menu renderer.

Validated with Medusa **2.22.1**, UI **4.2.8**, React **18.3.1** and Node.js **24**. The package requires Node.js **22.22.0 or newer** and currently declares exact **2.22.1** peers for the Medusa framework, commerce package, Admin SDK and icons. Align the host's installed versions with those peers; support for later versions is not implied.

[Install](#install) · [Capabilities](#capabilities) · [Admin management](#admin-management) · [Storefront integration](#storefront-integration) · [Server guarantees](#catalog-and-access-boundaries)

## Capabilities

| Capability | What it provides |
| --- | --- |
| Menu management | Named menus with unique handles, explicit publication, ordered sections and deletion. |
| Native catalog groups | Category or collection targets, a full-group View all reference and an optional Shop all reference. |
| Featured products | Explicit selection, ordering and a display limit from 0–50, checked against current native membership. |
| Image tiles | One optional tile per section using an existing safe image URL, alt text and optional link. |
| Store API | Published menu data with product publication and native sales-channel filtering on every request. |
| Access control | Native staff authentication and optional persisted RBAC permission checks. |
| Storefront adapters | Public TypeScript contracts without assumptions about routing, CSS, layout or pricing. |

## Install

The package has not yet been published to npm. Install a reviewed source revision:

```sh
npm install 'git+https://github.com/abhi1693/medusa-megamenu.git#<commit>'
```

The Git dependency runs `prepare` to build the server and Admin extension and include the native migration snapshot. Review and allow the source dependency's build scripts according to your package manager's install-script policy. A reviewed built archive can also be installed with `npm install /path/to/abhi1693-medusa-megamenu-0.0.1.tgz`.

Add the plugin to the application's existing `plugins` array in `medusa-config.ts`:

```ts
plugins: [
  {
    resolve: "@abhi1693/medusa-megamenu",
    options: {},
  },
]
```

Run the application's `medusa db:migrate`, then build its Admin. Plugin discovery registers the module, migration, API routes and Admin extension; do not register the same module separately. The migration creates menu storage and leaves the native catalog unchanged.

The package's dependency overrides apply only when this repository is the npm root. A consuming application must review its own lockfile, dependency compatibility and audit results.

## Admin management

Open **Mega menus** and create a menu with a unique handle such as `main`. Menus start unpublished. Add sections, select an existing category or collection, choose individual featured products, then order both products and sections with the editor controls. Set **Publish menu** and save when the menu is ready for the Store API.

Each section has a stable key, a label, an enabled switch, a native group, ordered product IDs, a display limit and an optional tile. **View all** always refers to the full native category or collection, not just the featured selection. **Shop all** is a separate optional menu-level native group reference.

The selectors search the native Admin catalog APIs. They show up to 100 groups or 50 products per search; selected IDs remain visible when absent from the current results. Menu management lists up to 100 menus. A menu accepts at most 30 sections, with at most 50 selected products per section.

### Image tiles

Enable a section's tile and provide an existing image URL and meaningful alt text. An optional link can point to a storefront path or HTTPS destination. API callers can retain the native `file_id` alongside the URL. Disabling a tile removes it from the public response.

The plugin accepts HTTPS URLs without credentials and local absolute paths. It rejects protocol-relative, executable, whitespace-containing and unsafe URLs, and never fetches those URLs itself. Manage uploads through the application's existing media storage and configure image-host allowlists in the storefront. A menu tile does not automatically inherit or follow later category/collection image edits.

## Catalog and access boundaries

- Featured products must belong directly to the selected category or collection when saving. A parent category does not implicitly include descendants.
- Every Store request rechecks native group availability, product publication, direct membership and current sales-channel links. Missing groups and inactive/internal categories are omitted.
- Eligible selected products retain their configured order before the display limit is applied. Removed or unpublished products disappear without automatic backfilling. A section with no eligible products can still provide View all.
- Store requests use only the publishable key's native sales-channel context. Query parameters cannot expand that scope. A multi-channel key receives the eligible union; a key without channels is rejected.
- Enabled menu configuration is public by handle within one backend. Distinct handles and correctly scoped publishable keys are required for separate storefronts; no domain-based tenant identity is inferred.
- Saving replaces the complete validated menu aggregate. Concurrent edits use last-write-wins; coordinate editors. Requests reject unknown fields, duplicate section keys/product IDs and invalid native references.
- Admin routes require a persisted native staff user. Optional RBAC enforcement runs on the server and does not accept authority flags from request data.
- Admin and Store responses disable caching. A storefront that adds caching must choose its own invalidation policy.

## API

Admin requests use native staff session or bearer authentication. Store requests require a valid `x-publishable-api-key` associated with sales channels.

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/admin/mega-menus` | `{ mega_menus, count }`, in handle order. |
| POST | `/admin/mega-menus` | Create a menu; `{ mega_menu }`, status 201. |
| GET | `/admin/mega-menus/:id` | `{ mega_menu }`. |
| POST | `/admin/mega-menus/:id` | Replace the validated menu configuration; `{ mega_menu }`. |
| DELETE | `/admin/mega-menus/:id` | Delete acknowledgement; the menu is no longer publicly available. |
| GET | `/store/mega-menus/:handle` | Published, resolved `{ mega_menu }`; otherwise 404. |

Create or update with the complete menu configuration:

```json
{
  "handle": "main",
  "title": "Main navigation",
  "enabled": false,
  "shop_all": null,
  "sections": [
    {
      "key": "networking",
      "label": "Networking",
      "enabled": true,
      "target": { "type": "category", "id": "pcat_existing" },
      "featured_product_ids": ["prod_existing"],
      "display_limit": 3,
      "tile": null
    }
  ]
}
```

Replace the example IDs with existing native records whose membership is valid. A collection target uses `{ "type": "collection", "id": "pcol_existing" }`. Menu handles and section keys use lowercase letters, digits, underscores and hyphens, beginning with a letter or digit and containing at most 64 characters.

An enabled tile has `{ "enabled": true, "url": "https://cdn.example.com/menu.png", "alt": "Networking", "href": "/categories/networking" }`. Its `href` and `file_id` fields are optional.

## Storefront integration

Fetch a menu using the storefront's configured backend URL and publishable key:

```ts
import type { StoreMenu } from "@abhi1693/medusa-megamenu"

const response = await fetch(
  `${backendUrl}/store/mega-menus/${encodeURIComponent(handle)}`,
  {
    headers: { "x-publishable-api-key": publishableKey },
    cache: "no-store",
  },
)
if (!response.ok) throw new Error("Menu is unavailable")
const { mega_menu }: { mega_menu: StoreMenu } = await response.json()
```

The public contract includes the menu title/handle, native target IDs/handles/labels, section keys/labels, enabled tiles and product cards containing only `id`, `title`, `handle` and `thumbnail`. It does not return full product records, metadata, variants, costs or disabled selections. Use the native Store Products API with the application's region/currency context for prices and availability.

Map each `view_all` and `shop_all` reference to your existing category or collection route using its handle. Map product handles to existing product detail routes. The plugin does not assume a URL pattern or turn a featured subset into the full listing.

Build the menu shell and slot components in the storefront, including keyboard navigation, focus handling and open/close behavior. When `tile` is null, omit that slot. The exported `StoreMenu`, `StoreSection`, `NativeTarget` and `ProductCard` types support different layouts and frameworks without a bundled renderer or CSS.

## Development

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:integration
npm pack --ignore-scripts --dry-run
```

The integration command builds and packs the plugin, then creates its own disposable PostgreSQL container and native Medusa host. It checks repeated migrations, schema-snapshot compatibility, native group membership, publication/channel filtering and real authenticated HTTP APIs, then removes its own test resources. Docker is required; it does not read a merchant database URL.

CI also runs the shared packager against the actual archive. Additional migration-snapshot and route requirements are declared in `package.json` under `config.release.requiredFiles`; generic packaging implementation stays in the actions repository. The local build retains snapshot copying because Medusa's compiler does not include that hidden native JSON file automatically.


## License

[MIT](LICENSE)
