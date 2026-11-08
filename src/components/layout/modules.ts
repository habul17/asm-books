import {
  CalendarCheckIcon,
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
export const CUSTOMERS: AppModule = { label: "Customers", icon: UsersIcon, href: "/customers" };
export const INVOICES: AppModule = { label: "Invoices", icon: FileTextIcon, href: "/invoices" };
export const ITEMS: AppModule = { label: "Items", icon: PackageIcon, href: "/catalogue" };
export const PRICE_LISTS: AppModule = { label: "Price Lists", icon: ListChecksIcon, href: "/price-lists" };
export const PAYMENTS_RECEIVED: AppModule = { label: "Payments Received", icon: CircleArrowDownIcon, href: "/payments" };
export const CREDIT_NOTES: AppModule = { label: "Credit Notes", icon: FileMinusIcon, href: "/credit-notes" };
export const VENDORS: AppModule = { label: "Vendors", icon: StoreIcon, href: "/vendors" };
export const BILLS: AppModule = { label: "Bills", icon: ReceiptTextIcon, href: "/bills" };
export const PAYMENTS_MADE: AppModule = { label: "Payments Made", icon: CircleArrowUpIcon, href: "/payments-made" };
export const EXPENSES: AppModule = { label: "Expenses", icon: WalletIcon, href: "/expenses" };
export const REPORTS: AppModule = { label: "Reports", icon: ChartColumnIcon, href: "/reports" };
export const SETTINGS: AppModule = { label: "Settings", icon: SettingsIcon, href: "/settings" };

/** Every module of the app, grouped like the "More" screen. Unbuilt ones show as "Soon". */
export const MODULE_GROUPS: ModuleGroup[] = [
  { title: null, modules: [HOME, soon("Banking", LandmarkIcon)] },
  { title: "Items", modules: [ITEMS, PRICE_LISTS] },
  { title: "Inventory", modules: [soon("Inventory Adjustments", PackageOpenIcon)] },
  {
    title: "Sales",
    modules: [
      CUSTOMERS,
      soon("Quotes", FileSpreadsheetIcon),
      soon("Sales Orders", FileBoxIcon),
      soon("Delivery Challans", PackageCheckIcon),
      INVOICES,
      PAYMENTS_RECEIVED,
      soon("Recurring Invoices", RepeatIcon),
      CREDIT_NOTES,
      soon("e-Way Bills", TruckIcon),
    ],
  },
  {
    title: "Purchases",
    modules: [
      VENDORS,
      soon("Purchase Orders", ShoppingCartIcon),
      BILLS,
      PAYMENTS_MADE,
      soon("Vendor Credits", TagIcon),
      EXPENSES,
    ],
  },
  {
    title: "Others",
    modules: [
      soon("Documents", FolderIcon),
      REPORTS,
      SETTINGS,
      soon("Tasks", CalendarCheckIcon),
      soon("Notifications", BellIcon),
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

/** Reports grouped like the Reports screen; all are still to be built. */
export const REPORT_GROUPS: string[][] = [
  ["Balance Sheet", "Profit and Loss", "Cash Flow Statement"],
  ["Sales by Customer", "Sales by Item", "Sales by Salesperson"],
  ["Customer Balances Summary", "AR Aging Summary", "AR Aging Details", "Payments Received"],
  ["Vendor Balances Summary", "Payments Made", "Expenses by Category"],
];
