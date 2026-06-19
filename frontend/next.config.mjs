/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prisma engine + client are server-only; keep them external in server bundles.
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Bundle the pre-seeded SQLite snapshot + the generated Prisma engine into the
  // serverless function output so the /tmp bootstrap (lib/db.ts) can read them.
  outputFileTracingIncludes: {
    "**": ["./prisma/seed.sqlite", "./node_modules/.prisma/client/**"],
  },
};

export default nextConfig;
