# Maxx Marketing Agency — Webshop

Next.js 16 (App Router) + React 19 + Tailwind CSS 4 storefront for Maxx Marketing Agency LLC, Houston, TX.

## Features

- Categories: Yard Signs, Retractable Banners, Dress Shirts, Signage, T-Shirts, Trade Show
- Product pages with size/package options, quantity and a cart (saved in the browser)
- Sign up, sign in and sign out (scrypt password hashing, HMAC-signed httpOnly session cookie)
- Account page with profile editing and order history
- Checkout for signed-in customers: pickup or delivery, artwork notes. No payment is taken online; the shop follows up with a proof and an invoice.
- Contact page with the address, phone, email and map
- **Design Studio** (`/design`): pick a product, add text, upload images and add shapes, design front and back, preview live, then add to cart. Each saved design keeps a mockup preview, a print-ready PNG (about 150 DPI, transparent background) and its editable JSON.

## Getting started

```bash
cp .env.example .env.local   # set SESSION_SECRET to a long random string
npm install
npm run dev
```

Open http://localhost:3000.

## Where things live

| Path | What |
| --- | --- |
| `lib/catalog.ts` | Categories, products, options and prices |
| `lib/site.ts` | Business name, address, phone, email |
| `lib/db.ts` | Users and orders store (JSON file at `data/db.json`) |
| `lib/session.ts` | Password hashing and session cookie |
| `lib/actions.ts` | Server actions: sign up/in/out, profile, place order |
| `proxy.ts` | Redirects signed-out visitors away from `/account` and `/checkout` |
| `lib/design-config.ts` | Which products can be designed, their mockups, print areas and sizes |
| `lib/design-fonts.ts` | Fonts offered in the studio |
| `components/studio/` | The studio UI (`studio.tsx`) and Fabric.js canvas engine (`engine.ts`) |
| `app/api/uploads`, `app/api/designs` | Image upload and design save/serve endpoints |
| `lib/files.ts` | Disk storage for uploads and design files (`data/uploads`, `data/designs`) |
| `public/products` | Product images (from the InkSoft store) |

## Before going live

- `data/` (db.json, uploads, designs) only works on a server with a writable disk. On Vercel or other serverless hosts, replace the functions in `lib/db.ts` with a real database (Vercel Postgres, Supabase, Neon, etc.).
- `SESSION_SECRET` must be set in production.
- Prices in `lib/catalog.ts` are placeholders. Update them to the shop's real pricing.
- Staff currently find print files under `data/designs/<id>/` (`<side>-print.png`). An admin page for orders and artwork is a good next step.
