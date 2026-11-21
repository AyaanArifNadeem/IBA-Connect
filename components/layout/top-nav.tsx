"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV, isActivePath } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { NavBadge } from "./nav-badge";
import type { ShellCounts } from "./types";

/** Desktop top menu (hidden below the md breakpoint). */
export function TopNav({ counts }: { counts: ShellCounts }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {MAIN_NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active && "text-foreground underline decoration-primary decoration-2 underline-offset-8",
                )}
              >
                {item.label}
                {item.badge ? <NavBadge count={counts[item.badge]} label={`unread ${item.badge}`} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
