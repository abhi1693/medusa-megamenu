import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
const pkg = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const [pack] = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], {
    encoding: "utf8",
  }),
);
const files = new Set(pack.files.map((f) => f.path));
for (const file of [
  "README.md",
  "LICENSE",
  ".medusa/server/src/admin/index.js",
  ".medusa/server/src/admin/index.mjs",
  ".medusa/server/src/modules/megamenu/migrations/Migration20261104000000.js",
  ".medusa/server/src/modules/megamenu/migrations/.snapshot-megamenu.json",
  ".medusa/server/src/api/middlewares.js",
  ".medusa/server/src/api/store/mega-menus/[handle]/route.js",
])
  assert.ok(files.has(file), `Missing ${file}`);
const targets = (value) =>
  typeof value === "string" ? [value] : Object.values(value).flatMap(targets);
for (const target of targets(pkg.exports).filter((t) => !t.includes("*")))
  assert.ok(files.has(target.replace(/^\.\//, "")), `Missing export ${target}`);
assert.ok(
  [...files].every(
    (f) => !/(^|\/)(node_modules|tests|\.env|\.test-host)(\/|$)/.test(f),
  ),
);
console.log(
  `PASS distributable: ${files.size} files, all exports, both Admin bundles, API routes, migration and schema snapshot; no tests, credentials or dependency trees`,
);
