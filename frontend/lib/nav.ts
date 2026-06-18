// Single source of truth for the app's primary navigation. Feature pages live
// at these routes; the sidebar renders from this list, filtered by the user's role.

export type Role = "admin" | "agent" | "customer";

export interface NavItem {
  href: string;
  label: string;
  icon: string; // lucide-react icon name
  group: "You" | "Prove it" | "Run it" | "Set it up" | "Win work";
  description: string;
  roles: Role[]; // who can see it
}

const COMPANY: Role[] = ["admin", "agent"];
const ALL: Role[] = ["admin", "agent", "customer"];

export const NAV: NavItem[] = [
  // ---- Customer-facing ----
  {
    href: "/profile",
    label: "My Profile",
    icon: "UserRound",
    group: "You",
    description: "Your details — help the AI assist you better.",
    roles: ["customer"],
  },
  {
    href: "/receptionist",
    label: "AI Receptionist",
    icon: "Sparkles",
    group: "You",
    description: "Chat or talk with Elara — ask, qualify, book a meeting.",
    roles: ALL,
  },
  // ---- Company (agent/admin) ----
  {
    href: "/dashboard",
    label: "Attribution",
    icon: "LayoutDashboard",
    group: "Prove it",
    description: "Call → booked → held → $ recovered. The product.",
    roles: COMPANY,
  },
  {
    href: "/conversations",
    label: "Conversations",
    icon: "MessagesSquare",
    group: "Prove it",
    description: "Every AI call & text transcript, with outcomes.",
    roles: COMPANY,
  },
  {
    href: "/reactivation",
    label: "Reactivation",
    icon: "Send",
    group: "Run it",
    description: "Text the consented dormant list and book replies.",
    roles: COMPANY,
  },
  {
    href: "/leads",
    label: "Leads & Consent",
    icon: "Users",
    group: "Run it",
    description: "Upload the list, audit consent, run the scrubs.",
    roles: COMPANY,
  },
  {
    href: "/audit",
    label: "After-Hours Audit",
    icon: "PhoneOff",
    group: "Win work",
    description: "The outbound hook: grade a prospect's missed-call coverage.",
    roles: COMPANY,
  },
  {
    href: "/compliance",
    label: "Compliance",
    icon: "ShieldCheck",
    group: "Set it up",
    description: "The moat: consent gate, A2P, DNC, disclosures.",
    roles: COMPANY,
  },
  {
    href: "/config",
    label: "Business Config",
    icon: "Settings2",
    group: "Set it up",
    description: "The one tenant config that feeds every layer.",
    roles: COMPANY,
  },
];

export const NAV_GROUPS: NavItem["group"][] = ["You", "Prove it", "Run it", "Win work", "Set it up"];

export function navForRole(role: Role): NavItem[] {
  return NAV.filter((n) => n.roles.includes(role));
}
