import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Invoice PDFs are printed by a headless browser on the server.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/invoices/*/pdf": ["./node_modules/@sparticuz/chromium/bin/**", "./src/server/pdf-fonts/**"],
  },
  experimental: {
    // Bill scans upload one photo or PDF (up to 4 MB) through a server action.
    serverActions: { bodySizeLimit: "5mb" },
  },
  async redirects() {
    // Tasks became Notes.
    return [{ source: "/tasks/:path*", destination: "/notes", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
