// Pass both exports to the optional @abhi1693/medusa-rbac module configuration.
export const megamenuPermissions = [
  ["megamenu.view", "View mega menus", "Navigation"],
  ["megamenu.manage", "Manage mega menus", "Navigation"],
] as const;
export const megamenuResources = [
  {
    key: "megamenu",
    root: "mega-menus",
    actorTypes: ["user"],
    profile: {
      actions: { GET: "read", POST: "write" },
      item: {
        parameter: "id",
        profile: { actions: { GET: "read", POST: "write", DELETE: "write" } },
      },
    },
    operations: {
      read: { permissions: ["megamenu.view"] },
      write: { permissions: ["megamenu.manage"] },
    },
  },
];
