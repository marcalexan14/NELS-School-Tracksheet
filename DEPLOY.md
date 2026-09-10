# Deploying NELS Tracking Sheet

A standard Next.js app. The two things it needs in production:

1. a **PostgreSQL database** (the app is stateless; all data lives here)
2. an **`AUTH_SECRET`** (signs login sessions)

The path below uses **Neon** (free Postgres) + **Vercel** (free hosting). ~5 minutes.

---

## 1. Create the database (Neon)

1. Go to <https://neon.tech> and sign up (GitHub login is fine).
2. **Create project** → name it `nels`, pick the region closest to the school
   (Frankfurt / `eu-central-1` is nearest Egypt).
3. On the project dashboard, copy the **connection string**. It looks like:
   ```
   postgresql://nels_owner:npg_xxxxxxxx@ep-xxxx-xxxx.eu-central-1.aws.neon.tech/nels?sslmode=require
   ```
   Keep this tab open.

## 2. Create the tables

From this repo on your machine, with the Neon string:

```bash
cd D:\Claude\schoolflow
# PowerShell:
$env:DATABASE_URL="postgresql://...paste the Neon string..."
npm run db:push
```

You should see `[✓] Changes applied`. That's every table created. Do this once.

*(Or paste the connection string to Claude and it can run `npm run db:push`
against it for you.)*

## 3. Deploy (Vercel)

1. Go to <https://vercel.com> and sign up with **GitHub**.
2. **Add New → Project** → import **`marcalexan14/NELS-School-Tracksheet`**.
3. Framework preset: **Next.js** (auto-detected). Leave build settings as-is.
4. Expand **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `AUTH_SECRET` | run `npx auth secret` locally and paste the value, or any 32+ random chars |
   | `AUTH_TRUST_HOST` | `true` |

5. **Deploy**. Two minutes later you get a URL like
   `https://nels-school-tracksheet.vercel.app`.

## 4. First run

Open the deployed URL → you land on **`/setup`**. Enter the school name, pick the
academic year, create the owner account. Done — that URL is now the live app,
reachable from anywhere, always on.

Add staff from **Settings → Staff**. They sign in at `/login`.

---

## Notes

- **`/api/dev/seed`** (the demo-data route) is automatically disabled when
  `NODE_ENV=production`, so it's inert on Vercel.
- **Document uploads** on the student profile currently expect local disk. If
  the school will attach scanned documents, wire an object store (Vercel Blob,
  S3, Cloudflare R2) in `src/app/dashboard/students/[id]` before relying on it —
  everything else works on Vercel as-is.
- **Schema changes later**: edit `src/db/schema.ts`, then re-run
  `npm run db:push` with `DATABASE_URL` pointed at Neon.
- **Backups**: use the in-app **Export & backup** tab, or Neon's own
  point-in-time restore.
- A **custom domain** (e.g. `tracking.yourschool.edu.eg`) is added in the Vercel
  project's *Domains* tab; keep `AUTH_TRUST_HOST=true` set.
