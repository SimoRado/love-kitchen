# Local PostgreSQL development

Production remains unchanged: Vercel supplies its own `DATABASE_URL`.

For local development, put a separate development PostgreSQL connection string in
`.env` (Prisma CLI reads `.env` directly) and, if you use `.env.local`, keep the
same value there for Next.js. Do not commit either file.

```powershell
# Example format only — replace every placeholder with your development values.
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

After saving the real URL, run:

```powershell
npx prisma generate
npx prisma validate
npx prisma migrate status
```

If the database is new, apply existing migrations safely with
`npx prisma migrate deploy`. No reset or force-reset commands are needed.

If you intentionally use Vercel's database for one terminal session, do not save
the URL: `$env:DATABASE_URL=postgresql://...; npm run dev`.
