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

## Hosting: Cloudflare Workers + Neon

- Database: Neon Postgres. Run `db/schema.sql` once in the Neon SQL editor.
- Files: private Neon Object Storage bucket named `files` (S3-compatible). Set `NEON_S3_ENDPOINT`, `NEON_S3_REGION`, `NEON_S3_ACCESS_KEY_ID`, `NEON_S3_SECRET_ACCESS_KEY` (create the bucket and a storage credential with the Neon CLI: `neon buckets create files`, `neon credentials create --scope storage:read --scope storage:write`).
- Hosting: Cloudflare Workers via OpenNext (`wrangler.jsonc`, `open-next.config.ts`).
- Secrets (set in Cloudflare → Workers → maxxprintingtx → Settings → Variables and Secrets): `DATABASE_URL`, the four `NEON_S3_*` values, `SESSION_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `npm run preview` runs the Cloudflare build locally; `npm run deploy` ships it.

## Card payments (Stripe)

1. In the Stripe dashboard (Test mode) open Developers → API keys and copy the secret key (`sk_test_...`) into `.env.local` as `STRIPE_SECRET_KEY`.
2. Run the Stripe CLI to forward webhooks to your machine, then copy the `whsec_...` value it prints into `STRIPE_WEBHOOK_SECRET` and restart `npm run dev`:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   (Payments are also confirmed when the customer returns to `/account`, so the webhook is a safety net locally.)
3. Pay with test card `4242 4242 4242 4242`, any future date, any CVC.
4. Going live: switch Stripe to live mode, add a webhook endpoint `https://YOUR-DOMAIN/api/stripe/webhook` for the event `checkout.session.completed`, and set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Cloudflare.

An order is saved as "Awaiting payment" and only becomes a real order when Stripe confirms the exact amount (webhook or return page). A customer who leaves the payment page keeps the saved order and can use **Pay now** in their account. The tax rate lives in `lib/tax.ts`.

## Email (own SMTP server)

Emails are sent through the shop's own mail server over SMTP (`lib/email.ts`): `worker-mailer` on Cloudflare Workers (Cloudflare sockets), `nodemailer` in `npm run dev`. Port 465 (SSL) or 587 (STARTTLS); port 25 is blocked on Workers.

- New accounts (optional, off by default): set `REQUIRE_EMAIL_ACTIVATION=true` to require an activation email before an account can sign in (signed link, 48 hours, tied to the email address; signing in or "Didn't get the activation email?" sends a new one, at most every 2 minutes; staff can resend or activate in Admin → Customers). Only turn it on once customers can receive email (verified domain); it stays off while SMTP isn't set up.
- Forgot password (`/forgot-password`): emails a link to choose a new password (1 hour, works once because it is tied to the current password; at most one email every 2 minutes; same answer whether or not the email has an account). Setting the new password signs the customer in and signs out their other devices.
- Refunds: customers press "Request a refund" on a paid order (with a reason). Staff get an email and a "Refund requests" tab; on the order they refund all or part of it (card payments go back through Stripe automatically, cash/check/invoice is recorded) or decline with a note. The customer is emailed either way, revenue is shown net of refunds, and the invoice shows the refund. The return & refund policy is edited in Admin → Settings and shown on the Ordering page, at checkout and on the request form.
- Customer: order received (card payment, or marked paid/invoiced in the admin), design approved, design change needed, printing, ready, done. Each shows the 6-step tracker.
- Shop (the "Order notifications" email in Admin → Settings): new order.

Setup: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `EMAIL_FROM` in `.env.local` and in Cloudflare (Variables and Secrets; make the password a secret), then use **Send test email** in Admin → Settings. Without them, emails are skipped and logged. Shop notifications go to the "Order notifications" address in Admin → Settings, and customer replies go there too. For customers' inboxes, shotokancenter.com's SPF/DKIM/DMARC should cover the mail server.

## Where things live

| Path | What |
| --- | --- |
| `lib/catalog.ts` | Categories, products, options and prices |
| `lib/site.ts` | Business name, address, phone, email |
| `lib/db.ts` | Users, orders and designs in Neon Postgres (schema in `db/schema.sql`) |
| `lib/session.ts` | Password hashing and session cookie |
| `lib/payments.ts`, `lib/tax.ts`, `app/api/stripe/webhook` | Stripe Checkout, sales tax, and the payment webhook |
| `lib/actions.ts` | Server actions: sign up/in/out, profile, place order |
| `proxy.ts` | Redirects signed-out visitors away from `/account` and `/checkout` |
| `lib/design-config.ts` | Which products can be designed, their mockups, print areas and sizes |
| `lib/design-fonts.ts` | Fonts offered in the studio |
| `components/studio/` | The studio UI (`studio.tsx`) and Fabric.js canvas engine (`engine.ts`) |
| `app/api/uploads`, `app/api/designs` | Image upload and design save/serve endpoints. Print and cut files are only served to the owner and to staff |
| `app/admin` | Admin backend: dashboard, orders (status, payments, notes, packing slips, print files), products, customers, staff, settings |
| `lib/admin-actions.ts`, `lib/store.ts` | Admin server actions; the catalog and settings with admin edits applied |
| `lib/files.ts` | Uploads and design files in a private Neon Object Storage bucket (`uploads/`, `designs/<id>/`) |
| `public/products` | Product images (from the InkSoft store) |

## Before going live

- Set `DATABASE_URL` and the `NEON_S3_*` values (listed above) and create the `files` bucket.
- `SESSION_SECRET` must be set in production (Settings → Environment Variables).
- Prices in `lib/catalog.ts` are placeholders. Update them to the shop's real pricing.
- **Admin** (`/admin`, sign in at `/admin/login`): staff have their own logins, separate from customer accounts. Create the first one with `npm run admin:create` (asks for name, email and a hidden password; run it again to reset a forgotten password), then add more in Admin → Staff. The admin has a sales dashboard; orders with search, filters (status, payment, approval, design source), manual payments (cash/invoice), internal notes, packing slips and print/cut file downloads; design approval by the shop, only for orders with a Design Studio or DTF gang sheet design (approve it, or ask the customer to change something; other orders go straight to printing; an order only goes to printing once approved), a 6-step tracker (Paid, Design check, Approved, Printing, Ready, Done) with one big next-step button, and an email to the customer at every step, and each item marked as Design Studio, DTF gang sheet or artwork to follow; product edits (name, description, prices, sales with an end date, hide/show products and options, featured) saved as overrides on top of `lib/catalog.ts`; customers (details, orders, designs, set a new password); and store settings (business info, tax rate, pickup/delivery). New products are still added in code. The admin tables are at the end of `db/schema.sql`.
- Upload limits live in `lib/limits.ts`: images up to 20 MB, and a saved design (all preview and print files together) up to 20 MB, kept below the Cloudflare Workers request and memory limits. If the print files would be bigger, the studio lowers their DPI just enough to fit; the DPI stored in each PNG always matches its real size. For bigger files, ask customers to send artwork directly or upload straight to the bucket from the browser (presigned URLs).
- **Print PDFs** (`/admin` → PDF, PDF + crop marks; or `/api/designs/<id>/<side>-print.pdf[?marks=1][&rgb=1]`) are built on demand from the saved print PNG: page size from the PNG's DPI, TrimBox and BleedBox set, text already flattened to pixels (no fonts to embed), CMYK artwork by default, optional crop marks, and the cut line as a `CutContour` spot color on contour-cut products. Limits to know: the CMYK conversion is a plain formula, not ICC color-managed; there is no PDF/X OutputIntent, so it will not pass a strict PDF/X-1a or X-4 check; and the artwork resolution is whatever the saved PNG has (see the 4.5 MB note above). For certified PDF/X or managed CMYK, run the PDF through Acrobat Preflight or your RIP with your shop's profile.
