"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV, isActivePath } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { NavBadge } from "./nav-badge";
import type { ShellCounts } from "./types";

/** Phone bottom bar (wireframe P21); hidden from the md breakpoint up. */
export function BottomNav({ counts }: { counts: ShellCounts }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {MAIN_NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active && "font-semibold text-primary",
                )}
              >
                <Icon aria-hidden className="size-5" />
                {item.shortLabel}
                {item.badge ? (
                  <NavBadge
                    count={counts[item.badge]}
                    label={`unread ${item.badge}`}
                    className="absolute top-1 left-1/2 ml-2"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
