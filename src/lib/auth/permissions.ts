// ============================================================
// Permission catalog (single source of truth)
// ============================================================
// Members are granted an explicit subset of these permissions.
// Admins implicitly hold every permission (see hasPermission()).
// To add a new gated capability, add an entry here and enforce it
// in the relevant server action and UI.

export const PERMISSIONS = [
  {
    id: "products.view",
    label: "View products",
    description: "See the product list in the dashboard",
    group: "Products",
  },
  {
    id: "products.create",
    label: "Create products",
    description: "Add new products to the catalog",
    group: "Products",
  },
  {
    id: "products.edit",
    label: "Edit products",
    description: "Update product details, images, and featured status",
    group: "Products",
  },
  {
    id: "products.delete",
    label: "Delete products",
    description: "Permanently remove products from the catalog",
    group: "Products",
  },
  {
    id: "orders.view",
    label: "View orders",
    description: "See the order list and order details",
    group: "Orders",
  },
  {
    id: "orders.create",
    label: "Create orders",
    description: "Create orders on behalf of customers",
    group: "Orders",
  },
  {
    id: "orders.edit",
    label: "Edit orders",
    description:
      "Update order status, change an order discount, and restock returned orders",
    group: "Orders",
  },
  {
    id: "orders.cancel",
    label: "Cancel orders",
    description: "Cancel orders and release reserved stock",
    group: "Orders",
  },
  {
    id: "orders.delete",
    label: "Delete orders",
    description: "Permanently remove cancelled orders that hold no stock or revenue",
    group: "Orders",
  },
  {
    id: "sales.view",
    label: "View sales",
    description: "See the sales list and sale details",
    group: "Sales",
  },
  {
    id: "sales.create",
    label: "Create sales",
    description: "Record point-of-sale transactions",
    group: "Sales",
  },
  {
    id: "sales.edit",
    label: "Edit sales",
    description: "Update sale details and line items",
    group: "Sales",
  },
  {
    id: "sales.delete",
    label: "Delete sales",
    description: "Delete sales and restore their stock",
    group: "Sales",
  },
  {
    id: "finances.view",
    label: "View costs & profit",
    description:
      "See product cost prices and profit / loss figures across the dashboard",
    group: "Finance",
  },
  {
    id: "invoices.view",
    label: "View invoices",
    description: "See the invoice list and invoice details",
    group: "Invoices",
  },
  {
    id: "invoices.generate",
    label: "Generate invoices",
    description: "Create invoices from sales",
    group: "Invoices",
  },
  {
    id: "invoices.edit",
    label: "Update invoices",
    description: "Mark invoices paid, reopen, or cancel them",
    group: "Invoices",
  },
  {
    id: "invoices.delete",
    label: "Delete invoices",
    description: "Permanently delete invoices",
    group: "Invoices",
  },
  {
    id: "shipments.ship",
    label: "Ship via NCM",
    description: "Dispatch orders to NCM and sync delivery status",
    group: "Shipments",
  },
  {
    id: "shipments.manage",
    label: "Manage shipments",
    description: "Add comments, mark returns, and refresh NCM branches",
    group: "Shipments",
  },
  {
    id: "settings.ncm",
    label: "Manage NCM settings",
    description: "Configure the NCM API token, branches, and webhook",
    group: "Settings",
  },
  {
    id: "settings.business",
    label: "Manage business profile",
    description: "Configure the shop identity and invoice numbering",
    group: "Settings",
  },
  {
    id: "vendors.view",
    label: "View vendors",
    description: "See the vendor list, contact/tax details, and payable ledgers",
    group: "Vendors",
  },
  {
    id: "vendors.create",
    label: "Create vendors",
    description: "Add new vendors to the directory",
    group: "Vendors",
  },
  {
    id: "vendors.edit",
    label: "Edit vendors & record bills",
    description:
      "Update vendor details and record bills, payments, and attachments",
    group: "Vendors",
  },
  {
    id: "vendors.delete",
    label: "Delete vendors",
    description: "Remove vendors that have no recorded transactions",
    group: "Vendors",
  },
  {
    id: "customers.view",
    label: "View customers",
    description: "See the customer directory, purchase history, and loyalty ledgers",
    group: "Customers",
  },
  {
    id: "customers.create",
    label: "Create customers",
    description: "Add new customers to the directory",
    group: "Customers",
  },
  {
    id: "customers.edit",
    label: "Edit customers & manage points",
    description:
      "Update customer details and record loyalty earn, redeem, and adjustment entries",
    group: "Customers",
  },
  {
    id: "customers.delete",
    label: "Delete customers",
    description: "Remove customers that have no loyalty history",
    group: "Customers",
  },
  {
    id: "warehouses.view",
    label: "View warehouses",
    description: "See warehouses, per-location stock, and transfer history",
    group: "Warehouses",
  },
  {
    id: "warehouses.create",
    label: "Create warehouses",
    description: "Add new stock locations",
    group: "Warehouses",
  },
  {
    id: "warehouses.edit",
    label: "Edit warehouses & move stock",
    description:
      "Update warehouses, set the default, and transfer stock between locations",
    group: "Warehouses",
  },
  {
    id: "warehouses.delete",
    label: "Delete warehouses",
    description: "Remove stock locations that hold no stock",
    group: "Warehouses",
  },
  {
    id: "expenses.view",
    label: "View expenses",
    description:
      "See recorded business expenses and their totals. Employee salary figures stay admin-only",
    group: "Expenses",
  },
  {
    id: "expenses.create",
    label: "Record expenses",
    description: "Add business expenses with receipts and notes",
    group: "Expenses",
  },
  {
    id: "expenses.edit",
    label: "Edit expenses",
    description: "Update recorded expenses and their receipts",
    group: "Expenses",
  },
  {
    id: "expenses.delete",
    label: "Delete expenses",
    description: "Remove recorded expenses",
    group: "Expenses",
  },
] as const;

export type PermissionId = (typeof PERMISSIONS)[number]["id"];

export const ALL_PERMISSION_IDS: PermissionId[] = PERMISSIONS.map((p) => p.id);

export type Role = "admin" | "member";

/** Default grants applied to a newly invited member when none are specified. */
export const DEFAULT_MEMBER_PERMISSIONS: PermissionId[] = [
  "products.view",
  "orders.view",
  "sales.view",
];

/** Permissions grouped by their `group` field, for rendering toggles. */
export function groupedPermissions(): Record<
  string,
  (typeof PERMISSIONS)[number][]
> {
  return PERMISSIONS.reduce(
    (acc, perm) => {
      (acc[perm.group] ??= []).push(perm);
      return acc;
    },
    {} as Record<string, (typeof PERMISSIONS)[number][]>,
  );
}

/** Keep only ids that exist in the catalog (defends against stale/forged input). */
export function sanitizePermissions(input: unknown): PermissionId[] {
  if (!Array.isArray(input)) return [];
  const valid = new Set<string>(ALL_PERMISSION_IDS);
  return input.filter(
    (id): id is PermissionId => typeof id === "string" && valid.has(id),
  );
}
