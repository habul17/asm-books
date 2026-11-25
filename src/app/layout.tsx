import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { THEME_SCRIPT } from "@/components/layout/theme";

import "./globals.css";

// The app's text uses Apple's system font where there is one (see globals.css);
// Inter stands in on other devices, so it is only fetched when needed.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  preload: false,
});

// Receipts and vouchers keep the font they were matched to on paper.
const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ASM Books",
    template: "%s · ASM Books",
  },
  description: "Inventory, billing and accounting for an automobile spare-parts business.",
  robots: { index: false, follow: false },
  // Home-screen shortcut on iPhone: opens full screen with this name.
  appleWebApp: { capable: true, title: "ASM", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3f7" },
    { media: "(prefers-color-scheme: dark)", color: "#050507" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The theme script sets the "dark" class before React loads.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
