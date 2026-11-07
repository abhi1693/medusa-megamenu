# Verification record

Performed on 4 November 2026 in `/home/asaharan/PycharmProjects/medusa-megamenu` on the shared build machine. The repository was empty when cloned. These checks precede the initial implementation PR; no npm publication or Uniek integration was performed as part of this plugin batch.

## Environment and successful checks

- Node 24.21.0; actual installed Medusa/framework/Admin SDK/icons/CLI 2.22.1, UI 4.2.8, React 18.3.1.
- Fresh lockfile generated from an empty dependency directory; `npm ci --ignore-scripts` succeeded. This corrected an initial npm optional-dependency omission affecting Rollup's Linux native binary. No platform-specific root dependency was added.
- `npm run typecheck` passed.
- `npm test` passed: 26 tests for schema bounds and unsafe URLs, ordered public product cards, native reference validation, publication/channel filtering, disabled/missing menu behavior, strict public fields and staff/RBAC guards (including spoofed flags, inactive/non-staff/mismatched principals).
- `npm run build` passed for backend and Admin extensions. The build explicitly copies the native generated `.snapshot-megamenu.json`; Medusa's TypeScript compiler alone does not include this hidden file.
- `npm run test:package` checks all exports, CJS/ESM Admin bundles, API routes, migration, schema snapshot, README and license, and excludes dependency trees, test fixtures and credentials.
- The optional `RBAC_PACKAGE_DIR=/home/asaharan/PycharmProjects/medusa-rbac node scripts/check-rbac-interop.mjs` probe passed against the actual neighboring built service: custom permission/resource catalog accepted; denied ordinary staff, explicitly granted staff, active staff superuser and inactive staff superuser behavior checked. This probe is read-only and is not a runtime dependency. The mega-menu guard separately verifies native staff existence and requires an active persisted user principal whose ID matches authentication before evaluating permission.
- `node scripts/test-integration.mjs` passed with the built tarball extracted into a disposable Medusa host and a fresh `postgres:16-alpine` container on a random loopback-only port. Two migrations succeeded, and `medusa db:generate megamenu` introduced no migration after the packaged schema snapshot was included.
- Native integration checks passed for module discovery, CRUD, unique handles, soft deletion/recreation, categories and collections, direct membership, draft exclusion, publication changes, native sales-channel links and link removal, internal category exclusion and the public route handler.
- Real HTTP checks passed for anonymous Admin rejection, trusted signed staff authentication with a persisted user, input validation including unknown superuser flags, create/update/delete, menu publishing, native publishable keys, two-channel product isolation despite caller channel/field query parameters, missing-key rejection, 404 after unpublishing/deletion and `Cache-Control: no-store`.
- Disposable HTTP process, test database/container and `.test-host` were removed. Existing Compose containers/watchers and merchant catalog were not modified.
- `npm audit --omit=dev` reported zero vulnerabilities for this package's production install graph. The full development toolchain audit reported 80 (4 low, 61 moderate, 14 high, 1 critical); no forced dependency upgrades were applied. Host applications must audit their own resolved peer/runtime graph separately.

## Practical limits

- No installation, activation, migration, runtime API check or visual storefront verification in Uniek.
- Admin extension compiled, but no browser interaction/visual QA was performed. The actual HTTP backend was exercised separately.
- RBAC integration uses its real built permission policy plus plugin guard tests; a full browser/HTTP host with both plugins installed was not exercised.
- Version support is verified for 2.22.1, not the 2.22.2 declared in Uniek's manifests. Installed packages were inspected directly. The registry did not resolve Admin SDK 2.22.2 during the initial install attempt.
- Full-menu saves use last-write-wins. Management lists at most 100 menus; native search selectors return bounded result sets. There is no tenant isolation of published menu presentation; use distinct handles and correctly scoped publishable keys per store.
- No renderer, CSS, price calculation, inventory logic, inferred descendant-category membership, catalog seeding, catalog cleanup or automated product selection.
- The optional Alphabite collection-images package was inspected read-only from its published 0.3.7 npm tarball because its linked GitHub repository was unavailable. Declared version ranges admit this environment, but runtime interop was not tested. No dependency was added or activated. README records its actual model/API and the distinction between collection thumbnails and menu promotional tiles.

## Current release workflow migration

The generic local check-package.mjs implementation and test:package alias were
removed during the shared release migration. CI now calls the central packager
against a real archive; config.release.requiredFiles preserves the additional
native migration, snapshot and API requirements. The source/integration checks
below remain current; the earlier results above are a historical record.

## Reproduction

```sh
npm ci
npm run typecheck
npm test
npm run test:integration
npm pack --ignore-scripts --dry-run
```

The integration command builds and packs the plugin, starts only its own disposable PostgreSQL container and HTTP process, verifies the installed package, and cleans them up. It requires Docker and may pull `postgres:16-alpine`. It never reads a merchant database URL. CI runs the same source/build/integration checks on Ubuntu with Node 24.
