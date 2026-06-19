import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "ff_token";
const ROLE_COOKIE = "ff_role";

// Routes each role is allowed to see. Anything authenticated-but-not-allowed
// bounces to that role's home. Data access is still JWT-gated server-side; this
// is UI routing + privacy separation (admins never land on customer data).
const ROUTES: Record<string, string[]> = {
  customer: ["/profile", "/receptionist", "/my-agent", "/my-feedback"],
  agent: ["/leads", "/scorecard", "/conversations", "/dashboard", "/reactivation", "/compliance", "/config", "/audit"],
  // Company admin: their overview, performance/revenue, customers/leads, agents,
  // feedback, cost + billing.
  admin: ["/admin/overview", "/admin/performance", "/admin/customers", "/admin/campaigns", "/admin/agents", "/admin/feedback", "/admin/knowledge", "/admin/cost", "/admin/billing"],
  // Platform: product analytics + companies + admins + feedback + revenue. NOT
  // /admin/performance — super_admin must never see a company's pipeline (privacy).
  super_admin: ["/admin/insights", "/admin/companies", "/admin/admins", "/admin/feedback", "/admin/revenue"],
};

const HOME: Record<string, string> = {
  customer: "/profile",
  agent: "/leads",
  admin: "/admin/overview",
  super_admin: "/admin/insights",
};

// Every path the middleware guards (union of all roles' routes).
const PROTECTED = Array.from(new Set(Object.values(ROUTES).flat()));

function matches(pathname: string, routes: string[]): boolean {
  return routes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!matches(pathname, PROTECTED)) return NextResponse.next();

  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const role = req.cookies.get(ROLE_COOKIE)?.value || "customer";
  const allowed = ROUTES[role] ?? ROUTES.customer;
  if (!matches(pathname, allowed)) {
    const url = req.nextUrl.clone();
    url.pathname = HOME[role] ?? "/profile";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/receptionist/:path*",
    "/my-agent/:path*",
    "/my-feedback/:path*",
    "/profile/:path*",
    "/leads/:path*",
    "/scorecard/:path*",
    "/reactivation/:path*",
    "/compliance/:path*",
    "/config/:path*",
    "/conversations/:path*",
    "/audit/:path*",
    "/admin/:path*",
  ],
};
