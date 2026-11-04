// Optional read-only compatibility probe against an already-built RBAC checkout.
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = process.env.RBAC_PACKAGE_DIR;
assert.ok(
  root && path.isAbsolute(root),
  "Set RBAC_PACKAGE_DIR to an existing built RBAC package directory",
);
const { createAccessConfig } = require(
  path.join(root, ".medusa/server/src/lib/access/config.js"),
);
const Service = require(
  path.join(root, ".medusa/server/src/modules/access-control/service.js"),
).default;
const {
  megamenuPermissions,
  megamenuResources,
} = require("../.medusa/server/src/rbac.js");
const configuration = createAccessConfig({
  permissions: [...megamenuPermissions],
  resources: megamenuResources,
});
const allows = (principal, permission) =>
  Service.prototype.allows.call({ configuration }, principal, permission, {});
const base = {
  actor_id: "test",
  actor_type: "user",
  active: true,
  is_superuser: false,
  role_ids: [],
  permissions: [],
};
for (const permission of megamenuPermissions.map((p) => p[0])) {
  assert.equal(allows(base, permission), false);
  assert.equal(
    allows({ ...base, permissions: [permission] }, permission),
    true,
  );
  assert.equal(allows({ ...base, is_superuser: true }, permission), true);
  assert.equal(
    allows({ ...base, is_superuser: true, active: false }, permission),
    false,
  );
}
console.log(
  "PASS actual RBAC resource/catalog validation and policy: granted/restricted staff, active/inactive native staff superusers. Non-staff rejection is independently enforced by the plugin guard.",
);
