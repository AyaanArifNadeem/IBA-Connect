import { formatBadgeCount } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function NavBadge({ count, label, className }: { count: number; label: string; className?: string }) {
  const text = formatBadgeCount(count);
  if (!text) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground",
        className,
      )}
      aria-label={`${text} ${label}`}
    >
      {text}
    </span>
  );
}
