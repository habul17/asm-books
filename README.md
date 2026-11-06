# ASM Books

Inventory, billing and accounting for an automobile spare-parts business.

## Features (in progress)

- Product catalogue with search, HSN codes and purchase-price history
- Price lists with markup, markdown, discounts and rounding rules
- Customers with GSTIN validation, groups, credit limits and balances
- GST invoices (CGST/SGST or IGST), stock tracking and printable layouts

## Tech stack

- [Next.js](https://nextjs.org) (App Router) and TypeScript
- [Neon](https://neon.tech) serverless PostgreSQL
- [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com)
- Deployed on [Vercel](https://vercel.com)

## Getting started

Requirements: Node.js 24+ and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then fill in real values
pnpm dev
```

Open http://localhost:3000.

## Security

- Secrets live only in `.env.local` (local) and Vercel environment variables (production).
- Business data (price lists, customer files, database exports) is never committed.
- A pre-commit hook (`scripts/check-staged.mjs`) blocks sensitive files and credential
  patterns, and CI runs a secret scan on every push.

## License

Copyright © 2026 Abul Hassan. All rights reserved.
