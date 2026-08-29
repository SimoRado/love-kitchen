# Vercel Production Deployment Guide — Love Kitchen

This guide contains the exact steps to finalize the deployment of the Love Kitchen restaurant platform on Vercel with Supabase PostgreSQL and Supabase Storage.

---

## 1. Branch Configuration in Vercel

The production-ready codebase with Supabase Realtime, multi-POS device authentication, and automatic image optimization is on the **`new`** branch (commit `8b3dfc9` or later).

To deploy:
- **Option A (Recommended)**: In **Vercel Project Settings $\rightarrow$ Git $\rightarrow$ Production Branch**, set the Production Branch to **`new`** and trigger a redeployment.
- **Option B**: Merge the **`new`** branch into **`main`** and push to GitHub.

---

## 2. Environment Variables in Vercel

In your **Vercel Project Dashboard** $\rightarrow$ **Settings** $\rightarrow$ **Environment Variables**, configure the following variables for **Production** (and Preview if needed):

| Variable | Description | Value / Format |
| :--- | :--- | :--- |
| `DATABASE_URL` | Supabase Transaction Pooler (port 6543) | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Supabase Direct Connection (port 5432) | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres` |
| `ADMIN_PASSWORD` | Password to access `/admin` | Choose a strong, secret production password |
| `ADMIN_SESSION_SECRET` | 32+ character secret for HMAC session tokens | Generate via terminal: `openssl rand -hex 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://eeqknxbboyupavepvsng.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Public Anonymous API Key | Found in Supabase Dashboard $\rightarrow$ Project Settings $\rightarrow$ API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key | Found in Supabase Dashboard $\rightarrow$ Project Settings $\rightarrow$ API (Never expose to client) |

---

## 3. Storage Setup in Supabase

1. **Storage Bucket**: The `product-images` bucket is configured with:
   - **Public Access**: Enabled (public read)
   - **File Size Limit**: 30 MB (`31457280` bytes)
   - **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`, `image/heic`
2. **Next.js Config**: `next.config.ts` includes `*.supabase.co` in `images.remotePatterns` for optimized image serving.

---

## 4. Deploy & Verify

1. Trigger a fresh deployment in Vercel (or push to the configured production branch).
2. Verify on the deployed site:
   - **Admin Product Add/Edit**: Changes persist directly in Supabase PostgreSQL and show immediately on the customer site without caching staleness.
   - **Product Image Upload**: Camera photos (up to 30 MB) upload directly to Supabase Storage and are automatically converted to optimized WebP (`1200x750`, quality 80), displaying immediately on the customer menu.
   - **POS Register & Realtime**: POS devices can pair via QR code and receive live order updates via Supabase Realtime.

