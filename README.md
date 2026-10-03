# Maxx Marketing Agency — Webshop

Next.js 16 (App Router) + React 19 + Tailwind CSS 4 storefront for Maxx Marketing Agency LLC, Houston, TX.

## Features

- Categories: Apparel, Headwear, Stickers, Trade Show, Yard Signs
- Product pages with size/package options, quantity and a cart (saved in the browser)
- Sign up, sign in and sign out (scrypt password hashing, HMAC-signed httpOnly session cookie)
- Account page with profile editing and order history
- Checkout for signed-in customers: pickup or delivery, artwork notes, 8.25% sales tax, and card payment through Stripe Checkout. The shop sends a proof after payment; delivery cost is quoted and invoiced separately.
- Contact page with the address, phone, email and map
- **Design Studio** (`/design`): pick a product, add text, upload images and add shapes, design front and back, preview live, then add to cart. Each saved design keeps a mockup preview, a print-ready PNG and its editable JSON.
  - Print files are exported at full size with the DPI written into the PNG: 300 DPI for items up to 14", 150 DPI up to 40", 100 DPI for larger formats.
  - Trimmed products (yard signs, business cards, circle/rectangle stickers, banners) show the trim line, a safe zone and a shaded bleed zone, and the print file includes the bleed (1/8", or 1/4" on very large pieces).
  - Contour-cut products (die-cut stickers, big heads, cut-outs, clear stickers) also export a vector cut path (`<side>-cut.svg`, path id `CutContour`, magenta stroke) that lines up with the print PNG.
  - Before an order is added, the studio warns about soft images, text outside the safe zone and artwork that stops short of the bleed.

## Getting started

```bash
npm install
vercel link && vercel env pull .env.local   # pulls DATABASE_URL, BLOB_READ_WRITE_TOKEN, SESSION_SECRET
npm run dev
```

Open http://localhost:3000.

## Card payments (Stripe)

1. In the Stripe dashboard (Test mode) open Developers → API keys and copy the secret key (`sk_test_...`) into `.env.local` as `STRIPE_SECRET_KEY`.
2. Run the Stripe CLI to forward webhooks to your machine, then copy the `whsec_...` value it prints into `STRIPE_WEBHOOK_SECRET` and restart `npm run dev`:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   (Payments are also confirmed when the customer returns to `/account`, so the webhook is a safety net locally.)
3. Pay with test card `4242 4242 4242 4242`, any future date, any CVC.
4. Going live: switch Stripe to live mode, add a webhook endpoint `https://YOUR-DOMAIN/api/stripe/webhook` for the event `checkout.session.completed`, and set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel.

An order is saved as "Awaiting payment" and only becomes a real order when Stripe confirms the exact amount (webhook or return page). A customer who leaves the payment page keeps the saved order and can use **Pay now** in their account. The tax rate lives in `lib/tax.ts`.

## Where things live

| Path | What |
| --- | --- |
| `lib/catalog.ts` | Categories, products, options and prices |
| `lib/site.ts` | Business name, address, phone, email |
| `lib/db.ts` | Users, orders and designs in Postgres (Neon); tables are created on first use |
| `lib/session.ts` | Password hashing and session cookie |
| `lib/payments.ts`, `lib/tax.ts`, `app/api/stripe/webhook` | Stripe Checkout, sales tax, and the payment webhook |
| `lib/actions.ts` | Server actions: sign up/in/out, profile, place order |
| `proxy.ts` | Redirects signed-out visitors away from `/account` and `/checkout` |
| `lib/design-config.ts` | Which products can be designed, their mockups, print areas and sizes |
| `lib/design-fonts.ts` | Fonts offered in the studio |
| `components/studio/` | The studio UI (`studio.tsx`) and Fabric.js canvas engine (`engine.ts`) |
| `app/api/uploads`, `app/api/designs` | Image upload and design save/serve endpoints. Print and cut files are only served to the owner and to staff |
| `app/admin` | Staff order list with status updates and print/cut file downloads |
| `lib/files.ts` | Uploads and design files in a private Vercel Blob store (`uploads/`, `designs/<id>/`) |
| `public/products` | Product images (from the InkSoft store) |

## Before going live

- In the Vercel project, add a Neon Postgres database and a **private** Blob store (Storage tab). They set `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`.
- `SESSION_SECRET` must be set in production (Settings → Environment Variables).
- Prices in `lib/catalog.ts` are placeholders. Update them to the shop's real pricing.
- Set `ADMIN_EMAILS` (comma-separated) to the sign-in emails of staff. Those accounts get an **Orders** link in the header and `/admin`, where each order lists its print files (and cut paths) for download. Create the staff account first via Sign up.
- Vercel limits request bodies to 4.5 MB, so image uploads are capped at 4 MB, and a saved design (all preview and print files together) is kept under about 3.8 MB. If the print files would be bigger, the studio lowers their DPI just enough to fit; the DPI stored in each PNG always matches its real size. For full-resolution files on large jobs, ask customers to send artwork directly or move uploads to Vercel Blob client uploads.
- **Print PDFs** (`/admin` → PDF, PDF + crop marks; or `/api/designs/<id>/<side>-print.pdf[?marks=1][&rgb=1]`) are built on demand from the saved print PNG: page size from the PNG's DPI, TrimBox and BleedBox set, text already flattened to pixels (no fonts to embed), CMYK artwork by default, optional crop marks, and the cut line as a `CutContour` spot color on contour-cut products. Limits to know: the CMYK conversion is a plain formula, not ICC color-managed; there is no PDF/X OutputIntent, so it will not pass a strict PDF/X-1a or X-4 check; and the artwork resolution is whatever the saved PNG has (see the 4.5 MB note above). For certified PDF/X or managed CMYK, run the PDF through Acrobat Preflight or your RIP with your shop's profile.
