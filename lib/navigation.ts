import {
  ClipboardList,
  House,
  MessageCircle,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

export type BadgeKey = "requests" | "messages";

export type NavItem = {
  href: string;
  /** Label in the desktop top menu */
  label: string;
  /** Label in the phone bottom bar */
  shortLabel: string;
  icon: LucideIcon;
  badge?: BadgeKey;
};

/** Main menu shown on every signed-in page (wireframes P04 and P21). */
export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: House },
  { href: "/directory", label: "Directory", shortLabel: "People", icon: Users },
  { href: "/board", label: "Need Board", shortLabel: "Board", icon: ClipboardList },
  { href: "/messages", label: "Messages", shortLabel: "Chat", icon: MessageCircle, badge: "messages" },
  { href: "/requests", label: "Requests", shortLabel: "Requests", icon: UserPlus, badge: "requests" },
];

/** True when `pathname` is the nav item's page or one of its sub-pages. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Badge text: hidden at 0, capped at "99+". */
export function formatBadgeCount(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
}

/** Up to two initials for an avatar fallback. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
