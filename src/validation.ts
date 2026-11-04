import { z } from "@medusajs/framework/zod";
const id = z.string().trim().min(1).max(200);
const text = z.string().trim().min(1).max(200);
export const targetInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("category"), id }).strict(),
  z.object({ type: z.literal("collection"), id }).strict(),
]);
// Local absolute paths or HTTPS URLs only; prevent protocol-relative and executable URLs.
export const safeUrl = z
  .string()
  .max(2048)
  .refine((v) => {
    if (/[\\\s\u0000-\u001f\u007f]/.test(v)) return false;
    if (v.startsWith("/") && !v.startsWith("//")) return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Use a local /path or an HTTPS URL without credentials");
export const tileInput = z
  .object({
    enabled: z.boolean(),
    url: safeUrl,
    file_id: id.optional(),
    alt: text,
    href: safeUrl.optional(),
  })
  .strict();
export const sectionInput = z
  .object({
    key: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
    label: text,
    enabled: z.boolean().default(true),
    target: targetInput,
    featured_product_ids: z
      .array(id)
      .max(50)
      .refine((a) => new Set(a).size === a.length, "Products must be unique")
      .default([]),
    display_limit: z.number().int().min(0).max(50).default(5),
    tile: tileInput.nullable().default(null),
  })
  .strict();
export const menuInput = z
  .object({
    handle: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
    title: text,
    enabled: z.boolean().default(false),
    shop_all: targetInput.nullable().default(null),
    sections: z
      .array(sectionInput)
      .max(30)
      .refine(
        (a) => new Set(a.map((s) => s.key)).size === a.length,
        "Section keys must be unique",
      ),
  })
  .strict();
export type MenuInput = z.infer<typeof menuInput>;
export type Section = z.infer<typeof sectionInput>;
export type Target = z.infer<typeof targetInput>;
export type Tile = z.infer<typeof tileInput>;
