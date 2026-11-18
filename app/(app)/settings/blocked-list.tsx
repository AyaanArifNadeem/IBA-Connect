"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/client/api";

/** Members you blocked, with Unblock (FR3.7). */
export function BlockedList({ blocked }: { blocked: { id: string; name: string }[] }) {
  const router = useRouter();
  if (!blocked.length) return <p className="text-sm text-muted-foreground">You have not blocked anyone.</p>;

  async function unblock(id: string, name: string) {
    const result = await requestJson("DELETE", `/api/v1/blocks/${id}`);
    if (!result.ok) return toast.error(result.error.message);
    toast.success(`${name} is unblocked`);
    router.refresh();
  }

  return (
    <ul className="divide-y">
      {blocked.map((b) => (
        <li key={b.id} className="flex items-center justify-between py-2 text-sm">
          <span>{b.name}</span>
          <Button size="sm" variant="outline" onClick={() => unblock(b.id, b.name)} aria-label={`Unblock ${b.name}`}>
            Unblock
          </Button>
        </li>
      ))}
    </ul>
  );
}
