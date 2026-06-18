import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "ff_token";
const ROLE_COOKIE = "ff_role";

const PROTECTED = [
  "/dashboard",
  "/receptionist",
  "/profile",
  "/leads",
  "/reactivation",
  "/compliance",
  "/config",
  "/conversations",
  "/audit",
];

// Company-only (agent/admin) — customers may NOT see these.
const COMPANY_ONLY = ["/dashboard", "/leads", "/reactivation", "/compliance", "/config", "/conversations", "/audit"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Role-gating (UI routing; data access is still JWT-gated server-side).
  const role = req.cookies.get(ROLE_COOKIE)?.value;
  const isCompanyOnly = COMPANY_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (role === "customer" && isCompanyOnly) {
    const url = req.nextUrl.clone();
    url.pathname = "/profile";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/receptionist/:path*",
    "/profile/:path*",
    "/leads/:path*",
    "/reactivation/:path*",
    "/compliance/:path*",
    "/config/:path*",
    "/conversations/:path*",
    "/audit/:path*",
  ],
};
