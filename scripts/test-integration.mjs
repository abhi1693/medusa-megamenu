import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import {
  mkdir,
  writeFile,
  copyFile,
  rm,
  symlink,
  readFile,
  readdir,
} from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
const root = process.cwd();
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const archive = `${pkg.name.replace(/^@/, "").replace("/", "-")}-${pkg.version}.tgz`;
const host = path.join(root, ".test-host");
const token = randomBytes(6).toString("hex");
const name = `megamenu-test-${token}`;
const password = randomBytes(24).toString("hex");
const exec = (cmd, args) =>
  execFileSync(cmd, args, { encoding: "utf8" }).trim();
let created = false;
let env;
let server;
const run = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(path.join(root, "node_modules/.bin/medusa"), args, {
      cwd: host,
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`medusa ${args.join(" ")} exited ${code}`)),
    );
  });
try {
  await mkdir(path.join(host, "node_modules/@abhi1693/medusa-megamenu"), {
    recursive: true,
  });
  await mkdir(path.join(host, "src/scripts"), { recursive: true });
  exec("tar", [
    "-xzf",
    path.join(root, archive),
    "--strip-components=1",
    "-C",
    path.join(host, "node_modules/@abhi1693/medusa-megamenu"),
  ]);
  await mkdir(path.join(host, "node_modules/@medusajs"), { recursive: true });
  await symlink(
    path.join(root, "node_modules/@medusajs/medusa"),
    path.join(host, "node_modules/@medusajs/medusa"),
    "dir",
  );
  await writeFile(
    path.join(host, "package.json"),
    JSON.stringify({
      name: "megamenu-disposable-test",
      version: "0.0.0",
      private: true,
      dependencies: { "@medusajs/medusa": "2.22.1" },
    }),
  );
  await copyFile(
    path.join(root, "tsconfig.json"),
    path.join(host, "tsconfig.json"),
  );
  await copyFile(
    path.join(root, "tests/integration/catalog.ts"),
    path.join(host, "src/scripts/check.ts"),
  );
  await writeFile(
    path.join(host, "medusa-config.ts"),
    `import { defineConfig } from '@medusajs/framework/utils'
module.exports = defineConfig({
  projectConfig: { databaseUrl: process.env.DATABASE_URL, http: { jwtSecret: process.env.JWT_SECRET, cookieSecret: process.env.COOKIE_SECRET, storeCors: 'http://localhost', adminCors: 'http://localhost', authCors: 'http://localhost' } },
  admin: { disable: true },
  plugins: [{ resolve: '@abhi1693/medusa-megamenu', options: {} }]
})`,
  );
  exec("docker", [
    "run",
    "--detach",
    "--rm",
    "--name",
    name,
    "--publish",
    "127.0.0.1::5432",
    "--env",
    `POSTGRES_PASSWORD=${password}`,
    "--env",
    "POSTGRES_DB=megamenu_test",
    "postgres:16-alpine",
  ]);
  created = true;
  const port = exec("docker", ["port", name, "5432/tcp"]).split(":").pop();
  assert.match(port, /^\d+$/);
  env = {
    ...process.env,
    NODE_ENV: "test",
    MEDUSA_DISABLE_TELEMETRY: "true",
    DATABASE_URL: `postgres://postgres:${password}@127.0.0.1:${port}/megamenu_test`,
    JWT_SECRET: token.repeat(8),
    COOKIE_SECRET: token.repeat(8),
  };
  for (let i = 0; i < 60; i++) {
    try {
      exec("docker", ["exec", name, "pg_isready", "-U", "postgres"]);
      break;
    } catch {
      if (i === 59) throw new Error("Test PostgreSQL did not start");
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  await run(["db:migrate"]);
  await run(["db:migrate"]);
  const migrations = path.join(
    host,
    "node_modules/@abhi1693/medusa-megamenu/.medusa/server/src/modules/megamenu/migrations",
  );
  const before = (await readdir(migrations))
    .filter((f) => /Migration.*\.[jt]s$/.test(f))
    .sort();
  await run(["db:generate", "megamenu"]);
  const after = await readdir(migrations);
  if (process.env.MEGAMENU_RECORD_SNAPSHOT === "true") {
    for (const file of after.filter(
      (f) => f.startsWith(".snapshot") && f.endsWith(".json"),
    ))
      await copyFile(
        path.join(migrations, file),
        path.join(root, "src/modules/megamenu/migrations", file),
      );
  }
  for (const file of after.filter(
    (f) => /Migration.*\.ts$/.test(f) && !f.endsWith(".d.ts"),
  ))
    console.log(
      "SCHEMA DIFFERENCE:",
      await readFile(path.join(migrations, file), "utf8"),
    );
  assert.deepEqual(
    after.filter((f) => /Migration.*\.[jt]s$/.test(f)).sort(),
    before,
    "Packaged migration must match native DML schema",
  );
  await run(["exec", "./src/scripts/check.ts"]);
  const fixture = JSON.parse(
    await readFile(path.join(host, "fixture.json"), "utf8"),
  );
  const socket = createServer();
  await new Promise((r) => socket.listen(0, "127.0.0.1", r));
  const httpPort = socket.address().port;
  await new Promise((r) => socket.close(r));
  server = spawn(
    path.join(root, "node_modules/.bin/medusa"),
    ["start", "--host", "127.0.0.1", "--port", String(httpPort)],
    { cwd: host, env, stdio: "inherit", detached: true },
  );
  const base = `http://127.0.0.1:${httpPort}`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${base}/health`)).ok) break;
    } catch {}
    if (i === 119) throw new Error("Disposable HTTP host did not start");
    await new Promise((r) => setTimeout(r, 500));
  }
  const request = async (url, method = "GET", body, headers = {}) => {
    const response = await fetch(`${base}${url}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { response, data: await response.json() };
  };
  assert.equal((await request("/admin/mega-menus")).response.status, 401);
  const admin = { authorization: `Bearer ${fixture.jwt}` };
  assert.equal(
    (await request("/admin/mega-menus", "GET", null, admin)).response.status,
    200,
  );
  assert.equal(
    (
      await request(
        "/admin/mega-menus",
        "POST",
        { ...fixture.menu, handle: "http", is_superuser: true },
        admin,
      )
    ).response.status,
    400,
  );
  const createdMenu = await request(
    "/admin/mega-menus",
    "POST",
    { ...fixture.menu, handle: "http", enabled: false },
    admin,
  );
  assert.equal(createdMenu.response.status, 201);
  const storeA = { "x-publishable-api-key": fixture.keyA },
    storeB = { "x-publishable-api-key": fixture.keyB };
  assert.equal(
    (await request("/store/mega-menus/http", "GET", null, storeA)).response
      .status,
    404,
  );
  const updated = await request(
    `/admin/mega-menus/${createdMenu.data.mega_menu.id}`,
    "POST",
    { ...fixture.menu, handle: "http", enabled: true },
    admin,
  );
  assert.equal(updated.response.status, 200);
  const publicA = await request(
    "/store/mega-menus/http?sales_channel_id=private&fields=*",
    "GET",
    null,
    storeA,
  );
  assert.equal(publicA.response.status, 200);
  assert.deepEqual(
    publicA.data.mega_menu.sections[0].products.map((p) => p.id),
    fixture.expectedA,
  );
  const publicB = await request("/store/mega-menus/http", "GET", null, storeB);
  assert.deepEqual(
    publicB.data.mega_menu.sections[0].products.map((p) => p.id),
    fixture.expectedB,
  );
  assert.equal(publicA.response.headers.get("cache-control"), "no-store");
  assert.notEqual(
    (await request("/store/mega-menus/http")).response.status,
    200,
  );
  assert.equal(
    (
      await request(
        `/admin/mega-menus/${createdMenu.data.mega_menu.id}`,
        "DELETE",
        null,
        admin,
      )
    ).response.status,
    200,
  );
  assert.equal(
    (await request("/store/mega-menus/http", "GET", null, storeA)).response
      .status,
    404,
  );
  console.log(
    "PASS real HTTP: staff auth, request validation, create/update/delete, publish toggle, publishable keys, channel isolation and cache headers",
  );
} finally {
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
    await new Promise((r) => {
      if (server.exitCode !== null) r();
      else {
        server.once("exit", r);
        setTimeout(r, 5000);
      }
    });
  }
  if (created) exec("docker", ["rm", "--force", name]);
  // Only this plugin's deterministic disposable host is removed.
  assert.equal(path.dirname(host), root);
  await rm(host, { recursive: true, force: true });
}
