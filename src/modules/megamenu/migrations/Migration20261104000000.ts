import { Migration } from "@medusajs/framework/mikro-orm/migrations";
export class Migration20261104000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `alter table if exists "mega_menu" drop constraint if exists "mega_menu_handle_unique";`,
    );
    this.addSql(
      `create table if not exists "mega_menu" ("id" text not null, "handle" text not null, "title" text not null, "enabled" boolean not null default false, "shop_all" jsonb null, "sections" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "mega_menu_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_mega_menu_handle_unique" ON "mega_menu" ("handle") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_mega_menu_deleted_at" ON "mega_menu" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
  }
  async down(): Promise<void> {
    this.addSql('drop table if exists "mega_menu" cascade;');
  }
}
