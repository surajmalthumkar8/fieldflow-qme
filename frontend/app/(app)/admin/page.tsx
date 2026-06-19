import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";

// /admin is just a router: send each role to its real home.
export default async function AdminIndex() {
  const user = await getCurrentUser();
  if (user?.role === "super_admin") redirect("/admin/insights");
  if (user?.role === "admin") redirect("/admin/overview");
  redirect("/login");
}
