# Vercel Production Deployment Guide — Love Kitchen

This guide contains the exact steps to deploy the Love Kitchen restaurant platform to Vercel.

---

## 1. Environment Variables in Vercel

In your **Vercel Project Dashboard** $\rightarrow$ **Settings** $\rightarrow$ **Environment Variables**, configure the following:

| Variable | Description | Example / Source |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname?sslmode=require` (Auto-filled if using Vercel Postgres/Neon) |
| `ADMIN_PASSWORD` | Password to access `/admin` | Choose a strong password (e.g. `YourSecureAdminPass2026!`) |
| `ADMIN_SESSION_SECRET` | 32+ character random secret for HMAC tokens | Generate via terminal: `openssl rand -hex 32` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob persistent storage token | Auto-filled when connecting Vercel Blob store |

---

## 2. Storage Setup on Vercel

1. **PostgreSQL Database**:
   - In Vercel $\rightarrow$ **Storage** tab $\rightarrow$ Create or Connect **Postgres** (or Neon / Supabase).
   - Link it to your project to automatically populate `DATABASE_URL`.
2. **Vercel Blob Storage** (for Product Images):
   - In Vercel $\rightarrow$ **Storage** tab $\rightarrow$ Create **Blob** store.
   - Link it to your project to automatically populate `BLOB_READ_WRITE_TOKEN`.

---

## 3. Apply Database Migrations

Once your PostgreSQL database is linked, run the initial migration against production:

```bash
npx prisma migrate deploy
```

*(Optional)* To seed the initial menu (Burgers, Pizza, Sides, Drinks, Opening Hours, Settings):
```bash
npx prisma db seed
```

---

## 4. Deploy & Verify

1. Push your latest commits to GitHub (`git push origin main`).
2. Vercel will trigger a production build (`npm run build` runs `prisma generate` and compiles Next.js).
3. Test the following in production:
   - **Storefront** (`/`): View menu, category filter, product modifiers dialog, cart drawer.
   - **Checkout** (`/checkout`): Place a test order.
   - **Admin Login** (`/admin/login`): Log in using `ADMIN_PASSWORD`.
   - **Admin Products** (`/admin/products`): Upload a product image (persisted in Vercel Blob) and create/edit a product.
   - **Admin Settings** (`/admin/settings`): Configure opening hours, delivery fee, WhatsApp number, Google Maps link.
