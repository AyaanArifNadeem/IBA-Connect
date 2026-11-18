"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** On phones the filters fold behind a "Filters (n)" button (wireframe P21); from md they are always shown. */
export function FilterToggle({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="w-full md:hidden"
        aria-expanded={open}
        aria-controls="directory-filters"
        onClick={() => setOpen((o) => !o)}
      >
        <SlidersHorizontal aria-hidden /> Filters{count ? ` (${count})` : ""}
      </Button>
      <div id="directory-filters" className={`${open ? "mt-3 block" : "hidden"} md:mt-0 md:block`}>
        {children}
      </div>
    </div>
  );
}
