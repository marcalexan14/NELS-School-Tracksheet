// Local throwaway Postgres for development, backed by PGlite (WASM Postgres 17).
// Speaks the real wire protocol on a TCP port, so drizzle's node-postgres driver
// connects to it exactly like a hosted database. NOT for production.
//
//   node scripts/dev-db.mjs           # data in ./.pgdata, port 55432
//
// Then point DATABASE_URL at: postgres://postgres:postgres@localhost:55432/postgres

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.DEV_DB_PORT ?? 55432);
const DATA_DIR = process.env.DEV_DB_DIR ?? resolve(here, "..", ".pgdata");

mkdirSync(DATA_DIR, { recursive: true });

const db = await PGlite.create({ dataDir: DATA_DIR });
// PGlite is single-writer; the server multiplexes several client connections
// (Next.js RSC + middleware + drizzle-kit) onto it and queues queries.
const server = new PGLiteSocketServer({
  db,
  port: PORT,
  host: "127.0.0.1",
  maxConnections: 20,
});
await server.start();

console.log(`[dev-db] PGlite listening on postgres://postgres:postgres@localhost:${PORT}/postgres`);
console.log(`[dev-db] data dir: ${DATA_DIR}`);

const shutdown = async () => {
  console.log("\n[dev-db] shutting down");
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
