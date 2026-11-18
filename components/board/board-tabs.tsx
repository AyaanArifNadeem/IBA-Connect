import Link from "next/link";
import { cn } from "@/lib/utils";

/** Open posts / My posts tabs (wireframe P10). */
export function BoardTabs({ active }: { active: "open" | "mine" }) {
  const tab = (key: "open" | "mine", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={cn(
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
        active === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Need Board" className="flex gap-1 border-b">
      {tab("open", "/board", "Open posts")}
      {tab("mine", "/board/my-posts", "My posts")}
    </nav>
  );
}
