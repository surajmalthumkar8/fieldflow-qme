// Single source of truth for the app's primary navigation. Feature pages live
// at these routes; the sidebar renders from this list.

export interface NavItem {
  href: string;
  label: string;
  icon: string; // lucide-react icon name
  group: "Prove it" | "Run it" | "Set it up" | "Win work";
  description: string;
}

export const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Attribution",
    icon: "LayoutDashboard",
    group: "Prove it",
    description: "Call → booked → held → $ recovered. The product.",
  },
  {
    href: "/conversations",
    label: "Conversations",
    icon: "MessagesSquare",
    group: "Prove it",
    description: "Every AI call & text transcript, with outcomes.",
  },
  {
    href: "/ai-receptionist",
    label: "Ava (Real Estate AI)",
    icon: "Sparkles",
    group: "Run it",
    description: "Real local-LLM receptionist with live lead scoring + voice.",
  },
  {
    href: "/receptionist",
    label: "AI Receptionist (demo)",
    icon: "PhoneCall",
    group: "Run it",
    description: "Scripted home-services demo — talk to it and watch it book.",
  },
  {
    href: "/reactivation",
    label: "Reactivation",
    icon: "Send",
    group: "Run it",
    description: "Text the consented dormant list and book replies.",
  },
  {
    href: "/leads",
    label: "Leads & Consent",
    icon: "Users",
    group: "Run it",
    description: "Upload the list, audit consent, run the scrubs.",
  },
  {
    href: "/audit",
    label: "After-Hours Audit",
    icon: "PhoneOff",
    group: "Win work",
    description: "The outbound hook: grade a prospect's missed-call coverage.",
  },
  {
    href: "/compliance",
    label: "Compliance",
    icon: "ShieldCheck",
    group: "Set it up",
    description: "The moat: consent gate, A2P, DNC, disclosures.",
  },
  {
    href: "/config",
    label: "Business Config",
    icon: "Settings2",
    group: "Set it up",
    description: "The one tenant config that feeds every layer.",
  },
];

export const NAV_GROUPS: NavItem["group"][] = ["Prove it", "Run it", "Win work", "Set it up"];
