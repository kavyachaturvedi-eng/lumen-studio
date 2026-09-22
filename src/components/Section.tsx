"use client";

import { useState, type ReactNode } from "react";

/**
 * Collapsible block for the control rail. Collapsed sections show a one-line
 * summary of what's currently chosen, so the rail stays short without hiding state.
 */
export function Section({
  title,
  summary,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold">{title}</span>
            {badge}
          </div>
          {!open && summary && <div className="mt-0.5 truncate text-[11px] text-stone-500">{summary}</div>}
        </div>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div className="border-t px-4 pb-4 pt-3 hairline">{children}</div>}
    </section>
  );
}
