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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
