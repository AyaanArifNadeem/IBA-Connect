"use client";

import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getJson } from "@/lib/client/api";
import { MAX_SKILLS } from "@/lib/validation/profile";

type Props = {
  value: string[];
  onChange: (skills: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
};

/** Skills as removable chips. Type a skill and press Enter or comma; suggestions come from the shared list. */
export function SkillsInput({ value, onChange, invalid, describedBy }: Props) {
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const listId = useId();

  useEffect(() => {
    const q = draft.trim();
    if (q.length < 1) return;
    const timer = setTimeout(async () => {
      const result = await getJson<string[]>(`/api/v1/skills?q=${encodeURIComponent(q)}`);
      if (result.ok) setSuggestions(result.data);
    }, 200);
    return () => clearTimeout(timer);
  }, [draft]);

  function add(raw: string) {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    setDraft("");
    if (!name || value.length >= MAX_SKILLS) return;
    if (value.some((s) => s.toLowerCase() === name.toLowerCase())) return;
    onChange([...value, name]);
  }

  return (
    <div className="space-y-2">
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Your skills">
          {value.map((skill) => (
            <li key={skill}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {skill}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((s) => s !== skill))}
                  className="rounded-full p-0.5 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`Remove ${skill}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        id="skills"
        list={listId}
        value={draft}
        placeholder={value.length >= MAX_SKILLS ? `Up to ${MAX_SKILLS} skills` : "Type a skill and press Enter"}
        disabled={value.length >= MAX_SKILLS}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => {
          // Choosing a suggestion from the list adds it straight away
          if (suggestions.includes(e.target.value)) add(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => add(draft)}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
