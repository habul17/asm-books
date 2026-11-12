import {
  CalendarCheckIcon,
  DatabaseBackupIcon,
  KeyRoundIcon,
  UserCogIcon,
  ChartColumnIcon,
  CircleArrowDownIcon,
  CircleArrowUpIcon,
  BellIcon,
  FileBoxIcon,
  FileMinusIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FolderIcon,
  HouseIcon,
  LandmarkIcon,
  ListChecksIcon,
  PackageCheckIcon,
  PackageIcon,
  PackageOpenIcon,
  ReceiptTextIcon,
  RepeatIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

export interface AppModule {
  label: string;
  icon: LucideIcon;
  /** Where the module lives; null while it is not built yet ("coming soon"). */
  href: string | null;
}

export interface ModuleGroup {
  /** Section heading; null for the ungrouped top section. */
  title: string | null;
  modules: AppModule[];
}

const soon = (label: string, icon: LucideIcon): AppModule => ({ label, icon, href: null });

export const HOME: AppModule = { label: "Home", icon: HouseIcon, href: "/" };
export const REMINDERS: AppModule = { label: "Reminders", icon: BellIcon, href: "/reminders" };
export const CUSTOMERS: AppModule = { label: "Customers", icon: UsersIcon, href: "/customers" };
export const INVOICES: AppModule = { label: "Invoices", icon: FileTextIcon, href: "/invoices" };
export const ITEMS: AppModule = { label: "Items", icon: PackageIcon, href: "/catalogue" };
export const PRICE_LISTS: AppModule = { label: "Price Lists", icon: ListChecksIcon, href: "/price-lists" };
export const PAYMENTS_RECEIVED: AppModule = { label: "Payments Received", icon: CircleArrowDownIcon, href: "/payments" };
export const QUOTES: AppModule = { label: "Quotes", icon: FileSpreadsheetIcon, href: "/sales/quotes" };
export const SALES_ORDERS: AppModule = { label: "Sales Orders", icon: FileBoxIcon, href: "/sales/orders" };
export const DELIVERY_CHALLANS: AppModule = { label: "Delivery Challans", icon: PackageCheckIcon, href: "/sales/challans" };
export const EWAY_BILLS: AppModule = { label: "e-Way Bills", icon: TruckIcon, href: "/eway-bills" };
export const CREDIT_NOTES: AppModule = { label: "Credit Notes", icon: FileMinusIcon, href: "/credit-notes" };
export const VENDORS: AppModule = { label: "Vendors", icon: StoreIcon, href: "/vendors" };
export const PURCHASE_ORDERS: AppModule = { label: "Purchase Orders", icon: ShoppingCartIcon, href: "/purchase-orders" };
export const BILLS: AppModule = { label: "Bills", icon: ReceiptTextIcon, href: "/bills" };
export const PAYMENTS_MADE: AppModule = { label: "Payments Made", icon: CircleArrowUpIcon, href: "/payments-made" };
export const PURCHASE_RETURNS: AppModule = { label: "Purchase Returns", icon: TagIcon, href: "/purchase-returns" };
export const INVENTORY_ADJUSTMENTS: AppModule = {
  label: "Inventory Adjustments",
  icon: PackageOpenIcon,
  href: "/inventory-adjustments",
};
export const EXPENSES: AppModule = { label: "Expenses", icon: WalletIcon, href: "/expenses" };
export const DOCUMENTS: AppModule = { label: "Documents", icon: FolderIcon, href: "/documents" };
export const REPORTS: AppModule = { label: "Reports", icon: ChartColumnIcon, href: "/reports" };
export const USERS: AppModule = { label: "Users", icon: UserCogIcon, href: "/users" };
export const BACKUPS: AppModule = { label: "Backups", icon: DatabaseBackupIcon, href: "/backup" };
export const ACCOUNT: AppModule = { label: "My account", icon: KeyRoundIcon, href: "/account" };
export const SETTINGS: AppModule = { label: "Settings", icon: SettingsIcon, href: "/settings" };

/** Every module of the app, grouped like the "More" screen. Unbuilt ones show as "Soon". */
export const MODULE_GROUPS: ModuleGroup[] = [
  { title: null, modules: [HOME, REMINDERS, soon("Banking", LandmarkIcon)] },
  { title: "Items", modules: [ITEMS, PRICE_LISTS] },
  { title: "Inventory", modules: [INVENTORY_ADJUSTMENTS] },
  {
    title: "Sales",
    modules: [
      CUSTOMERS,
      QUOTES,
      SALES_ORDERS,
      DELIVERY_CHALLANS,
      INVOICES,
      PAYMENTS_RECEIVED,
      soon("Recurring Invoices", RepeatIcon),
      CREDIT_NOTES,
      EWAY_BILLS,
    ],
  },
  {
    title: "Purchases",
    modules: [
      VENDORS,
      PURCHASE_ORDERS,
      BILLS,
      PAYMENTS_MADE,
      PURCHASE_RETURNS,
      EXPENSES,
    ],
  },
  {
    title: "Others",
    modules: [
      DOCUMENTS,
      REPORTS,
      SETTINGS,
      USERS,
      BACKUPS,
      ACCOUNT,
      soon("Tasks", CalendarCheckIcon),
    ],
  },
];

/** The phone's bottom tabs (the fifth tab is "More"). */
export const TAB_MODULES: AppModule[] = [HOME, CUSTOMERS, INVOICES, ITEMS];

/** True when `pathname` is inside the module at `href`. */
export function isActive(pathname: string | null, href: string | null): boolean {
  if (pathname == null || href == null) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Full-screen forms hide the bottom tabs so their own save bar stays reachable. */
export const isFormPage = (pathname: string | null) => pathname != null && /\/(new|edit)$/.test(pathname);

/** Reports grouped like the Reports screen. A null href shows "Soon". */
export const REPORT_GROUPS: { label: string; href: string | null }[][] = [
  [
    { label: "Profit and Loss", href: "/reports/profit-and-loss" },
    { label: "Balance Sheet", href: "/reports/balance-sheet" },
    { label: "Cash Flow Statement", href: "/reports/cash-flow" },
  ],
  [
    { label: "Sales Summary", href: "/reports/sales" },
    { label: "Sales by Customer", href: "/reports/sales-by-customer" },
    { label: "Sales by Item", href: "/reports/sales-by-item" },
    { label: "GST Summary", href: "/reports/gst" },
  ],
  [
    { label: "Customer Balances (who owes you)", href: "/reports/customer-balances" },
    { label: "AR Aging Summary", href: null },
  ],
  [
    { label: "Vendor Balances (what you owe)", href: "/reports/vendor-balances" },
    { label: "Expenses by Category", href: "/reports/expenses-by-category" },
  ],
  [{ label: "Low Stock", href: "/reports/low-stock" }],
];
