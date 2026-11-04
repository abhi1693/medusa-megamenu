import { copyFile, mkdir, readdir } from "node:fs/promises";
const source = new URL("../src/modules/megamenu/migrations/", import.meta.url);
const target = new URL(
  "../.medusa/server/src/modules/megamenu/migrations/",
  import.meta.url,
);
await mkdir(target, { recursive: true });
for (const file of await readdir(source)) {
  if (file.startsWith(".snapshot") && file.endsWith(".json"))
    await copyFile(new URL(file, source), new URL(file, target));
}
