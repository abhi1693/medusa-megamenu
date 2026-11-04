import { defineRouteConfig } from "@medusajs/admin-sdk";
import { BarsThree } from "@medusajs/icons";
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Text,
  Switch,
  toast,
} from "@medusajs/ui";
import { useEffect, useState } from "react";
import type { MenuInput, Section, Target } from "../../../validation";

async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "Request failed");
  return data;
}
const blank = (): MenuInput => ({
  handle: "main",
  title: "Main navigation",
  enabled: false,
  shop_all: null,
  sections: [],
});
function GroupPicker({
  value,
  onChange,
}: {
  value: Target | null;
  onChange: (v: Target | null) => void;
}) {
  const [groups, setGroups] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const type = value?.type ?? "category";
  useEffect(() => {
    let active = true;
    const path = type === "category" ? "product-categories" : "collections";
    api(`/admin/${path}?limit=100&q=${encodeURIComponent(query)}`)
      .then((d) => {
        if (active) setGroups(d.product_categories ?? d.collections);
      })
      .catch((e) => toast.error(e.message));
    return () => {
      active = false;
    };
  }, [type, query]);
  return (
    <div className="flex flex-col gap-2">
      <select
        aria-label="Group type"
        value={type}
        onChange={(e) =>
          onChange({ type: e.target.value as Target["type"], id: "" })
        }
        className="rounded border p-2"
      >
        <option value="category">Category</option>
        <option value="collection">Collection</option>
      </select>
      <Input
        aria-label="Search native groups"
        placeholder="Search native groups"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        aria-label="Native group"
        value={value?.id ?? ""}
        onChange={(e) =>
          onChange(e.target.value ? { type, id: e.target.value } : null)
        }
        className="rounded border p-2"
      >
        <option value="">Select native group</option>
        {value?.id && !groups.some((g) => g.id === value.id) && (
          <option value={value.id}>{value.id}</option>
        )}
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name ?? g.title} ({g.handle})
          </option>
        ))}
      </select>
    </div>
  );
}
function Featured({
  section,
  change,
}: {
  section: Section;
  change: (s: Section) => void;
}) {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    const filter =
      section.target.type === "category" ? "category_id[]" : "collection_id[]";
    if (!section.target.id) {
      setProducts([]);
      return;
    }
    api(
      `/admin/products?limit=50&${filter}=${encodeURIComponent(section.target.id)}&q=${encodeURIComponent(q)}`,
    )
      .then((d) => {
        if (active) setProducts(d.products);
      })
      .catch((e) => toast.error(e.message));
    return () => {
      active = false;
    };
  }, [q, section.target.type, section.target.id]);
  const ids = section.featured_product_ids;
  function move(index: number, delta: number) {
    const next = [...ids];
    const other = index + delta;
    if (other < 0 || other >= ids.length) return;
    [next[index], next[other]] = [next[other], next[index]];
    change({ ...section, featured_product_ids: next });
  }
  return (
    <div className="flex flex-col gap-2">
      <Label>Featured products (ordered)</Label>
      <Input
        aria-label="Search products in group"
        placeholder="Search products in this group"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        aria-label="Add featured product"
        value=""
        className="rounded border p-2"
        onChange={(e) => {
          if (e.target.value)
            change({
              ...section,
              featured_product_ids: [...ids, e.target.value],
            });
        }}
      >
        <option value="">Add native product</option>
        {products
          .filter((p) => !ids.includes(p.id))
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
      </select>
      {ids.map((id, i) => (
        <div key={id} className="flex items-center gap-2">
          <Text className="flex-1">
            {products.find((p) => p.id === id)?.title ?? id}
          </Text>
          <Button
            size="small"
            variant="secondary"
            aria-label={`Move product ${i + 1} up`}
            onClick={() => move(i, -1)}
            disabled={!i}
          >
            ↑
          </Button>
          <Button
            size="small"
            variant="secondary"
            aria-label={`Move product ${i + 1} down`}
            onClick={() => move(i, 1)}
            disabled={i === ids.length - 1}
          >
            ↓
          </Button>
          <Button
            size="small"
            variant="danger"
            onClick={() =>
              change({
                ...section,
                featured_product_ids: ids.filter((p) => p !== id),
              })
            }
          >
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
}
export default function MegaMenus() {
  const [menus, setMenus] = useState<any[]>([]);
  const [id, setId] = useState("");
  const [menu, setMenu] = useState<MenuInput>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    try {
      setMenus((await api("/admin/mega-menus")).mega_menus);
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function select(value: string) {
    setId(value);
    const m = menus.find((m) => m.id === value);
    setMenu(
      m
        ? {
            handle: m.handle,
            title: m.title,
            enabled: m.enabled,
            shop_all: m.shop_all,
            sections: m.sections,
          }
        : blank(),
    );
  }
  function section(index: number, s: Section) {
    setMenu({
      ...menu,
      sections: menu.sections.map((v, i) => (i === index ? s : v)),
    });
  }
  function move(index: number, delta: number) {
    const sections = [...menu.sections],
      other = index + delta;
    if (other < 0 || other >= sections.length) return;
    [sections[index], sections[other]] = [sections[other], sections[index]];
    setMenu({ ...menu, sections });
  }
  async function save() {
    setBusy(true);
    try {
      const d = await api(
        `/admin/mega-menus${id ? `/${id}` : ""}`,
        "POST",
        menu,
      );
      setId(d.mega_menu.id);
      await load();
      toast.success("Menu saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!window.confirm("Delete this menu?")) return;
    setBusy(true);
    try {
      await api(`/admin/mega-menus/${id}`, "DELETE");
      select("");
      await load();
      toast.success("Menu deleted");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Container className="flex flex-col gap-6">
      <Heading>Mega menus</Heading>
      <Text>
        Configure navigation using native catalog groups. Public menus show only
        currently published products in the requesting store’s sales channels.
      </Text>
      {error && <Text role="alert">{error}</Text>}
      <select
        aria-label="Select menu"
        value={id}
        onChange={(e) => select(e.target.value)}
        className="rounded border p-2"
      >
        <option value="">New menu</option>
        {menus.map((m) => (
          <option key={m.id} value={m.id}>
            {m.title} ({m.handle})
          </option>
        ))}
      </select>
      <div>
        <Label htmlFor="menu-handle">Handle</Label>
        <Input
          id="menu-handle"
          value={menu.handle}
          onChange={(e) => setMenu({ ...menu, handle: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="menu-title">Title</Label>
        <Input
          id="menu-title"
          value={menu.title}
          onChange={(e) => setMenu({ ...menu, title: e.target.value })}
        />
      </div>
      <Label className="flex items-center gap-2">
        <Switch
          checked={menu.enabled}
          onCheckedChange={(enabled) => setMenu({ ...menu, enabled })}
        />
        Publish menu
      </Label>
      <div>
        <Label>Shop all target (optional)</Label>
        <GroupPicker
          value={menu.shop_all}
          onChange={(shop_all) => setMenu({ ...menu, shop_all })}
        />
        <Button
          variant="secondary"
          size="small"
          onClick={() => setMenu({ ...menu, shop_all: null })}
        >
          Clear Shop all
        </Button>
      </div>
      {menu.sections.map((s, i) => (
        <div key={i} className="flex flex-col gap-4 rounded border p-4">
          <div className="flex gap-2">
            <Heading level="h2">Section {i + 1}</Heading>
            <Button
              size="small"
              variant="secondary"
              onClick={() => move(i, -1)}
              disabled={!i}
            >
              Move up
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => move(i, 1)}
              disabled={i === menu.sections.length - 1}
            >
              Move down
            </Button>
            <Button
              size="small"
              variant="danger"
              onClick={() =>
                setMenu({
                  ...menu,
                  sections: menu.sections.filter((_, n) => n !== i),
                })
              }
            >
              Remove section
            </Button>
          </div>
          <Label>
            Key
            <Input
              value={s.key}
              onChange={(e) => section(i, { ...s, key: e.target.value })}
            />
          </Label>
          <Label>
            Label
            <Input
              value={s.label}
              onChange={(e) => section(i, { ...s, label: e.target.value })}
            />
          </Label>
          <Label className="flex gap-2">
            <Switch
              checked={s.enabled}
              onCheckedChange={(enabled) => section(i, { ...s, enabled })}
            />
            Enabled
          </Label>
          <GroupPicker
            value={s.target}
            onChange={(target) =>
              section(i, {
                ...s,
                target: target ?? { type: s.target.type, id: "" },
                featured_product_ids: [],
              })
            }
          />
          <Featured section={s} change={(v) => section(i, v)} />
          <Label>
            Display limit
            <Input
              type="number"
              min={0}
              max={50}
              value={s.display_limit}
              onChange={(e) =>
                section(i, { ...s, display_limit: Number(e.target.value) })
              }
            />
          </Label>
          <Label className="flex gap-2">
            <Switch
              checked={Boolean(s.tile?.enabled)}
              onCheckedChange={(enabled) =>
                section(i, {
                  ...s,
                  tile: enabled
                    ? {
                        enabled,
                        url: s.tile?.url ?? "",
                        alt: s.tile?.alt ?? "",
                        ...(s.tile?.href ? { href: s.tile.href } : {}),
                      }
                    : null,
                })
              }
            />
            Image / logo tile
          </Label>
          {s.tile && (
            <>
              <Label>
                Image URL (use an existing Medusa upload URL)
                <Input
                  value={s.tile.url}
                  onChange={(e) =>
                    section(i, {
                      ...s,
                      tile: { ...s.tile!, url: e.target.value },
                    })
                  }
                />
              </Label>
              <Label>
                Alt text
                <Input
                  value={s.tile.alt}
                  onChange={(e) =>
                    section(i, {
                      ...s,
                      tile: { ...s.tile!, alt: e.target.value },
                    })
                  }
                />
              </Label>
              <Label>
                Link (optional)
                <Input
                  value={s.tile.href ?? ""}
                  onChange={(e) => {
                    const { href, ...tile } = s.tile!;
                    section(i, {
                      ...s,
                      tile: e.target.value
                        ? { ...tile, href: e.target.value }
                        : tile,
                    });
                  }}
                />
              </Label>
            </>
          )}
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() =>
          setMenu({
            ...menu,
            sections: [
              ...menu.sections,
              {
                key: `section-${Date.now()}`,
                label: "New section",
                enabled: true,
                target: { type: "category", id: "" },
                featured_product_ids: [],
                display_limit: 5,
                tile: null,
              },
            ],
          })
        }
        disabled={menu.sections.length >= 30}
      >
        Add section
      </Button>
      <div className="flex gap-2">
        <Button onClick={save} isLoading={busy}>
          Save menu
        </Button>
        {id && (
          <Button variant="danger" onClick={remove} disabled={busy}>
            Delete menu
          </Button>
        )}
      </div>
    </Container>
  );
}
export const config = defineRouteConfig({
  label: "Mega menus",
  icon: BarsThree,
});
