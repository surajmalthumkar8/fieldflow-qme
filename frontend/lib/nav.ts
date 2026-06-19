// Single source of truth for the app's primary navigation. The sidebar renders
// from this list, grouped by `group` (the headings) and filtered by role.
//
// Group headings (render order in NAV_GROUPS): clean, logical buckets so each role's
// sidebar reads as: what's mine → daily work → analytics → money → setup → platform.

export type Role = "super_admin" | "admin" | "agent" | "customer";

export interface NavItem {
  href: string;
  label: string;
  icon: string; // lucide-react icon name
  group: "You" | "Overview" | "Workspace" | "Insights" | "Billing" | "Setup" | "Manage";
  description: string;
  roles: Role[];
}

export const NAV: NavItem[] = [
  // ---- Customer ----
  { href: "/profile", label: "My Profile", icon: "UserRound", group: "You", description: "Your details — help the AI assist you better.", roles: ["customer"] },
  { href: "/receptionist", label: "AI Receptionist", icon: "Sparkles", group: "You", description: "Chat or talk with Elara — ask, qualify, book a meeting.", roles: ["customer"] },
  { href: "/my-agent", label: "My Agent", icon: "MessagesSquare", group: "You", description: "Chat with your human agent.", roles: ["customer"] },
  { href: "/my-feedback", label: "Feedback", icon: "Star", group: "You", description: "Rate the AI assistant and your agent — separately.", roles: ["customer"] },

  // ---- Agent ----
  { href: "/leads", label: "Customers", icon: "Users", group: "Workspace", description: "Your leads — auto-graded, with what they want & booked calls.", roles: ["agent"] },
  { href: "/conversations", label: "Conversations", icon: "MessagesSquare", group: "Workspace", description: "Every AI call & text transcript, with outcomes.", roles: ["agent"] },
  { href: "/scorecard", label: "My Performance", icon: "TrendingUp", group: "Insights", description: "Your responsiveness, bookings, effort and customer ratings.", roles: ["agent"] },
  { href: "/dashboard", label: "Attribution", icon: "LayoutDashboard", group: "Insights", description: "Call → booked → held → $ recovered.", roles: ["agent"] },

  // ---- Company admin ----
  { href: "/admin/overview", label: "Overview", icon: "LayoutDashboard", group: "Overview", description: "Your company at a glance — leads, bookings, AI conversion.", roles: ["admin"] },
  { href: "/admin/customers", label: "Customers", icon: "Users", group: "Workspace", description: "Your leads — assign agents to follow up.", roles: ["admin"] },
  { href: "/admin/campaigns", label: "Campaigns", icon: "Megaphone", group: "Workspace", description: "Run limited-time offers — the AI advertises them and interested customers route to your agents.", roles: ["admin"] },
  { href: "/admin/performance", label: "Performance & Revenue", icon: "TrendingUp", group: "Insights", description: "Your agents' bookings, conversion, SLAs and revenue.", roles: ["admin"] },
  { href: "/admin/feedback", label: "Feedback", icon: "Star", group: "Insights", description: "What customers say — with an AI summary of themes & priorities.", roles: ["admin"] },
  { href: "/admin/cost", label: "Cost Analyzer", icon: "Gauge", group: "Billing", description: "Your AI + RAG usage and what it costs.", roles: ["admin"] },
  { href: "/admin/billing", label: "Billing", icon: "CreditCard", group: "Billing", description: "Your current bill, line items and plan.", roles: ["admin"] },
  { href: "/admin/agents", label: "My Agents", icon: "UserPlus", group: "Setup", description: "Invite or remove the agents who manage your customers.", roles: ["admin"] },
  { href: "/admin/knowledge", label: "Train the AI", icon: "BookOpen", group: "Setup", description: "Feed company knowledge (RAG) so the AI answers customer questions.", roles: ["admin"] },

  // ---- Super admin (platform) ----
  { href: "/admin/insights", label: "Platform Insights", icon: "LineChart", group: "Overview", description: "How our AI performs across every company — adoption, engagement, conversion.", roles: ["super_admin"] },
  { href: "/admin/revenue", label: "Revenue", icon: "DollarSign", group: "Billing", description: "What each company is billed and total platform revenue.", roles: ["super_admin"] },
  { href: "/admin/feedback", label: "Feedback", icon: "Star", group: "Insights", description: "All customer feedback across companies, with an AI summary.", roles: ["super_admin"] },
  { href: "/admin/companies", label: "Companies", icon: "Building2", group: "Manage", description: "Add / remove real-estate companies and the markets they serve.", roles: ["super_admin"] },
  { href: "/admin/admins", label: "Admins", icon: "ShieldCheck", group: "Manage", description: "Invite each company an admin (secure email link to set their password).", roles: ["super_admin"] },
];

export const NAV_GROUPS: NavItem["group"][] = ["You", "Overview", "Workspace", "Insights", "Billing", "Setup", "Manage"];

export function navForRole(role: Role): NavItem[] {
  return NAV.filter((n) => n.roles.includes(role));
}
