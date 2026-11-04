import { model } from "@medusajs/framework/utils";
export default model.define("mega_menu", {
  id: model.id({ prefix: "mmenu" }).primaryKey(),
  handle: model.text().unique(),
  title: model.text(),
  enabled: model.boolean().default(false),
  shop_all: model.json().nullable(),
  sections: model.json(),
});
