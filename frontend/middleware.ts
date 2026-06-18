import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "ff_token";

// Pages that require a signed-in session. The marketing root ("/") and /login
// stay public. Auth happens against the FastAPI JWT service; here we just gate
// on cookie presence (full validation happens when API routes call the backend).
const PROTECTED = [
  "/dashboard",
  "/ai-receptionist",
  "/receptionist",
  "/leads",
  "/reactivation",
  "/compliance",
  "/config",
  "/conversations",
  "/audit",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (token) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/ai-receptionist/:path*",
    "/receptionist/:path*",
    "/leads/:path*",
    "/reactivation/:path*",
    "/compliance/:path*",
    "/config/:path*",
    "/conversations/:path*",
    "/audit/:path*",
  ],
};
