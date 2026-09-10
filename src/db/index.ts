import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// One driver, one code path: node-postgres against a real PostgreSQL server.
//
//  • Production / staging: DATABASE_URL (or POSTGRES_URL, which Vercel's Postgres
//    integration sets automatically) points at Neon, Supabase, RDS, etc.
//
//  • Zero-install local dev: run `npm run dev:db` in a second terminal. It
//    starts an embedded PostgreSQL (PGlite, WASM) on port 55432 and stores its
//    data in ./.pgdata. The default DATABASE_URL in .env already points at it.

const url =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  "postgresql://postgres:postgres@localhost:55432/postgres";

// Next.js dev hot-reloads server modules on every save; cache the pool on
// globalThis so we don't leak connections in development.
const globalForDb = globalThis as unknown as { __pgPool?: Pool };

const pool =
  globalForDb.__pgPool ?? new Pool({ connectionString: url, max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgPool = pool;
}

export const db = drizzle(pool, { schema });
