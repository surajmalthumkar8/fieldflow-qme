import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

// Resolve the database URL. Locally this is the .env value (file:./dev.db).
// On Vercel the bundle filesystem is read-only, so we copy a pre-seeded SQLite
// snapshot (committed at prisma/seed.sqlite) into the writable /tmp dir on cold
// start and point Prisma there. Mutations persist for the warm instance's life
// and reset to the seeded baseline on the next cold start — ideal for a public
// demo where every visitor gets clean, populated data. (Swap to Supabase
// Postgres for real persistence — the schema is identical.)
function resolveDatabaseUrl(): string | undefined {
  if (process.env.VERCEL) {
    const tmpDb = "/tmp/qme-dev.db";
    try {
      if (!fs.existsSync(tmpDb)) {
        const seed = path.join(process.cwd(), "prisma", "seed.sqlite");
        if (fs.existsSync(seed)) fs.copyFileSync(seed, tmpDb);
      }
      return `file:${tmpDb}`;
    } catch (err) {
      console.error("[db] failed to bootstrap /tmp database:", err);
    }
  }
  return process.env.DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = resolveDatabaseUrl();
  return new PrismaClient({
    // Only pass an explicit datasource when we actually have a URL. Passing
    // `{ url: undefined }` makes the constructor throw — which broke `next build`
    // (page-data collection) and any deploy that builds without DATABASE_URL.
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** The shared Prisma client, constructed lazily on first use and cached. */
export function getPrisma(): PrismaClient {
  return (globalForPrisma.prisma ??= createClient());
}

// Back-compat: callers `import { prisma }`. A Proxy defers construction until the first
// property access (a query at request time), so importing this module is side-effect
// free — `next build` can collect page data without a database connection.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
