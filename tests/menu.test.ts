import { describe, expect, it, vi } from "vitest";
import { menuInput, safeUrl } from "../src/validation";
import { resolveMenu } from "../src/resolve";
import { validateCatalog } from "../src/catalog";
import { guard } from "../src/api/guard";
import { GET as storeGet } from "../src/api/store/mega-menus/[handle]/route";
import { megamenuPermissions, megamenuResources } from "../src/rbac";

const target = { type: "category" as const, id: "cat_1" };
const section = {
  key: "networking",
  label: "Networking",
  enabled: true,
  target,
  featured_product_ids: ["p2", "p1", "draft", "private"],
  display_limit: 2,
  tile: null,
};
const menu = () =>
  menuInput.parse({
    handle: "main",
    title: "Main",
    enabled: true,
    shop_all: target,
    sections: [section],
  });
function scopeFor(graph: any) {
  return { resolve: () => ({ graph }) } as any;
}
const res = () => {
  const r: any = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  r.status.mockReturnValue(r);
  return r;
};

describe("input contract", () => {
  it("bounds payloads, rejects unknown flags and duplicate IDs or section keys", () => {
    expect(menuInput.safeParse({ ...menu(), is_superuser: true }).success).toBe(
      false,
    );
    expect(
      menuInput.safeParse({ ...menu(), sections: [section, section] }).success,
    ).toBe(false);
    expect(
      menuInput.safeParse({
        ...menu(),
        sections: [{ ...section, featured_product_ids: ["p1", "p1"] }],
      }).success,
    ).toBe(false);
    expect(
      menuInput.safeParse({
        ...menu(),
        sections: [{ ...section, display_limit: 51 }],
      }).success,
    ).toBe(false);
    expect(
      menuInput.safeParse({ ...menu(), sections: Array(31).fill(section) })
        .success,
    ).toBe(false);
  });
  it.each([
    "javascript:alert(1)",
    "//evil.test",
    "/\\evil.test",
    "https://user:pass@evil.test",
    "/\nevil.test",
    "data:image/svg+xml,hi",
  ])("rejects unsafe tile URL %s", (url) =>
    expect(safeUrl.safeParse(url).success).toBe(false),
  );
  it.each(["/catalog", "https://cdn.example.com/image.png"])(
    "accepts safe URL %s",
    (url) => expect(safeUrl.safeParse(url).success).toBe(true),
  );
});
describe("public resolution", () => {
  it("preserves merchant order, excludes draft/channel-mismatched products and whitelists public fields", async () => {
    const graph = vi.fn(async (q: any) => {
      if (q.entity === "product_category") {
        expect(q.filters).toMatchObject({
          is_active: true,
          is_internal: false,
        });
        return { data: [{ id: "cat_1", handle: "network", name: "Network" }] };
      }
      if (q.entity === "product_sales_channel") {
        expect(q.filters.sales_channel_id).toEqual(["sc_public"]);
        return {
          data: section.featured_product_ids.map((product_id) => ({
            product_id,
          })),
        };
      }
      expect(q.filters.status).toBe("published");
      return {
        data: [
          {
            id: "p1",
            title: "One",
            handle: "one",
            status: "published",
            sales_channels: [{ id: "sc_public" }],
            metadata: { secret: "never" },
          },
          {
            id: "draft",
            title: "Draft",
            status: "draft",
            sales_channels: [{ id: "sc_public" }],
          },
          {
            id: "private",
            title: "Private",
            status: "published",
            sales_channels: [{ id: "sc_other" }],
          },
          {
            id: "p2",
            title: "Two",
            handle: "two",
            status: "published",
            sales_channels: [{ id: "sc_public" }],
          },
        ],
      };
    });
    const result = await resolveMenu(scopeFor(graph), menu(), ["sc_public"]);
    expect(result.sections[0].products.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(result.sections[0].products[1]).toEqual({
      id: "p1",
      title: "One",
      handle: "one",
      thumbnail: null,
    });
    expect(result.sections[0].view_all).toEqual({
      ...target,
      handle: "network",
      label: "Network",
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("drops deleted/private groups, disabled sections and disabled tiles", async () => {
    const m = menu();
    m.sections.push({ ...section, key: "disabled", enabled: false });
    m.sections[0].tile = { enabled: false, url: "/a.png", alt: "A" };
    const graph = vi.fn(async () => ({ data: [] }));
    const result = await resolveMenu(scopeFor(graph), m, ["sc_1"]);
    expect(result.sections).toEqual([]);
    expect(result.shop_all).toBeNull();
  });
  it("filters before applying limit and never backfills with unselected products", async () => {
    const m = menu();
    m.sections[0].display_limit = 0;
    const graph = vi.fn(async (q: any) => ({
      data:
        q.entity === "product_category"
          ? [{ id: "cat_1", name: "A", handle: "a" }]
          : [],
    }));
    expect(
      (await resolveMenu(scopeFor(graph), m, ["sc_1"])).sections[0].products,
    ).toEqual([]);
  });
  it("requires key context and never accepts caller channel overrides", async () => {
    const r = res();
    const resolve = vi.fn();
    await storeGet(
      { scope: { resolve }, query: { sales_channel_id: "sc_private" } } as any,
      r,
    );
    expect(r.status).toHaveBeenCalledWith(403);
    expect(resolve).not.toHaveBeenCalled();
  });
  it("returns 404 for disabled/missing menu", async () => {
    const listMegaMenus = vi.fn(async () => []);
    const r = res();
    await storeGet(
      {
        params: { handle: "main" },
        publishable_key_context: { sales_channel_ids: ["sc_1"] },
        scope: { resolve: () => ({ listMegaMenus }) },
      } as any,
      r,
    );
    expect(listMegaMenus).toHaveBeenCalledWith(
      { handle: "main", enabled: true },
      { take: 1 },
    );
    expect(r.status).toHaveBeenCalledWith(404);
  });
});
describe("native catalog validation", () => {
  it("rejects products outside selected group without writing catalog data", async () => {
    const graph = vi.fn(async (q: any) => ({
      data: q.entity === "product_category" ? [{ id: "cat_1" }] : [],
    }));
    await expect(validateCatalog(scopeFor(graph), menu())).rejects.toThrow(
      "must belong directly",
    );
    expect(
      graph.mock.calls.find(([q]) => q.entity === "product")?.[0].filters
        .categories,
    ).toEqual({ id: "cat_1" });
  });
  it("rejects stale native references", async () => {
    await expect(
      validateCatalog(
        scopeFor(async () => ({ data: [] })),
        menu(),
      ),
    ).rejects.toThrow("Unknown category");
  });
});
describe("staff security", () => {
  it("rejects unauthenticated callers", async () => {
    const r = res(),
      next = vi.fn();
    await guard({} as any, r, next);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  it("validates native staff existence even without RBAC", async () => {
    const retrieveUser = vi.fn(async () => {
        throw new Error("deleted staff");
      }),
      next = vi.fn();
    await guard(
      {
        auth_context: { actor_type: "user", actor_id: "u1" },
        scope: { resolve: () => ({ retrieveUser }) },
      } as any,
      res(),
      next,
    );
    expect(next.mock.calls[0][0].message).toBe("deleted staff");
  });
  it.each(["GET", "POST", "DELETE"])(
    "uses persisted principal for %s and ignores body superuser flags",
    async (method) => {
      const r = res(),
        next = vi.fn(),
        principal = {
          actor_id: "u1",
          actor_type: "user",
          active: true,
          is_superuser: false,
        };
      const allows = vi.fn(() => false);
      const access = {
        principalForRequest: async () => principal,
        allows,
        permissionContext: async () => ({}),
      };
      await guard(
        {
          method,
          body: { is_superuser: true },
          auth_context: { actor_type: "user", actor_id: "u1" },
          scope: {
            hasRegistration: () => true,
            resolve: (key: string) =>
              key === "rbac_access"
                ? access
                : { retrieveUser: async () => ({ id: "u1" }) },
          },
        } as any,
        r,
        next,
      );
      expect(r.status).toHaveBeenCalledWith(403);
      expect(allows).toHaveBeenCalledWith(
        principal,
        method === "GET" ? "megamenu.view" : "megamenu.manage",
        {},
      );
      expect(next).not.toHaveBeenCalled();
    },
  );
  it("lets trusted RBAC authorize genuine active superusers for all actions", async () => {
    const principal = {
      actor_id: "u1",
      actor_type: "user",
      active: true,
      is_superuser: true,
    };
    for (const method of ["GET", "POST", "DELETE"]) {
      const next = vi.fn();
      const access = {
        principalForRequest: async () => principal,
        allows: (p: any) =>
          p === principal &&
          p.active &&
          p.actor_type === "user" &&
          p.is_superuser,
        permissionContext: async () => ({}),
      };
      await guard(
        {
          method,
          auth_context: { actor_type: "user", actor_id: "u1" },
          scope: {
            hasRegistration: () => true,
            resolve: (key: string) =>
              key === "rbac_access"
                ? access
                : { retrieveUser: async () => ({ id: "u1" }) },
          },
        } as any,
        res(),
        next,
      );
      expect(next).toHaveBeenCalledWith();
    }
  });
  it("resource permissions and catalog agree", () => {
    expect(
      Object.values(megamenuResources[0].operations).flatMap(
        (o) => o.permissions,
      ),
    ).toEqual(megamenuPermissions.map((p) => p[0]));
  });
  it.each([
    { actor_id: "u1", actor_type: "user", active: false },
    { actor_id: "u1", actor_type: "customer", active: true },
    { actor_id: "another", actor_type: "user", active: true },
  ])(
    "rejects inactive/non-staff/mismatched persisted principals even when a legacy policy allows them",
    async (principal) => {
      const r = res(),
        next = vi.fn(),
        allows = vi.fn(() => true);
      const access = {
        principalForRequest: async () => ({ ...principal, is_superuser: true }),
        allows,
      };
      await guard(
        {
          method: "POST",
          auth_context: { actor_type: "user", actor_id: "u1" },
          scope: {
            hasRegistration: () => true,
            resolve: (key: string) =>
              key === "rbac_access"
                ? access
                : { retrieveUser: async () => ({ id: "u1" }) },
          },
        } as any,
        r,
        next,
      );
      expect(r.status).toHaveBeenCalledWith(403);
      expect(allows).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    },
  );
});
