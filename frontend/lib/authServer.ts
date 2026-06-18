// Server-side: resolve the signed-in user from the JWT cookie via the auth service.
import { cookies } from "next/headers";

const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  timezone: string;
  role: string;
  business_id: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!BACKEND) return null;
  const token = (await cookies()).get("ff_token")?.value;
  if (!token) return null;
  try {
    const r = await fetch(`${BACKEND}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as CurrentUser;
  } catch {
    return null;
  }
}
