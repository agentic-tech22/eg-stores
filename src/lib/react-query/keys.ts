/**
 * Central registry of React Query keys for the admin dashboard. Use `.all` to
 * invalidate every query for a resource, `.list()` for the list query itself.
 */
export const queryKeys = {
  products: {
    all: ["products"] as const,
    list: () => [...queryKeys.products.all, "list"] as const,
    history: (id: string) =>
      [...queryKeys.products.all, "history", id] as const,
  },
  combos: {
    all: ["combos"] as const,
    list: () => [...queryKeys.combos.all, "list"] as const,
  },
  categories: {
    all: ["categories"] as const,
    list: () => [...queryKeys.categories.all, "list"] as const,
  },
  warehouses: {
    all: ["warehouses"] as const,
    list: () => [...queryKeys.warehouses.all, "list"] as const,
    inventory: (id?: string) =>
      [...queryKeys.warehouses.all, "inventory", id ?? "all"] as const,
    transfers: () => [...queryKeys.warehouses.all, "transfers"] as const,
    stockValue: () => [...queryKeys.warehouses.all, "stock-value"] as const,
  },
  vendors: {
    all: ["vendors"] as const,
    list: () => [...queryKeys.vendors.all, "list"] as const,
    purchases: () => [...queryKeys.vendors.all, "purchases"] as const,
    detail: (id: string) => [...queryKeys.vendors.all, "detail", id] as const,
    transactions: (id: string) =>
      [...queryKeys.vendors.all, "transactions", id] as const,
  },
  customers: {
    all: ["customers"] as const,
    list: () => [...queryKeys.customers.all, "list"] as const,
    detail: (id: string) => [...queryKeys.customers.all, "detail", id] as const,
    transactions: (id: string) =>
      [...queryKeys.customers.all, "transactions", id] as const,
  },
  expenses: {
    all: ["expenses"] as const,
    list: () => [...queryKeys.expenses.all, "list"] as const,
    salaries: () => [...queryKeys.expenses.all, "salaries"] as const,
  },
  users: {
    all: ["users"] as const,
    list: () => [...queryKeys.users.all, "list"] as const,
    records: (id: string) => [...queryKeys.users.all, "records", id] as const,
  },
  orders: {
    all: ["orders"] as const,
    list: () => [...queryKeys.orders.all, "list"] as const,
    detail: (id: string) => [...queryKeys.orders.all, "detail", id] as const,
  },
  sales: {
    all: ["sales"] as const,
    list: () => [...queryKeys.sales.all, "list"] as const,
    detail: (id: string) => [...queryKeys.sales.all, "detail", id] as const,
  },
  invoices: {
    all: ["invoices"] as const,
    list: () => [...queryKeys.invoices.all, "list"] as const,
    detail: (id: string) => [...queryKeys.invoices.all, "detail", id] as const,
  },
  businessProfile: {
    all: ["business-profile"] as const,
  },
  ncmSettings: {
    all: ["ncm-settings"] as const,
  },
  ncmBranches: {
    all: ["ncm-branches"] as const,
  },
  ncmComments: {
    all: ["ncm-comments"] as const,
    list: (orderId: string) =>
      [...queryKeys.ncmComments.all, orderId] as const,
  },
};
