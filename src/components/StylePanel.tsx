"use client";

import { STYLE_FIELDS, type StyleDescription } from "@/lib/style";
import type { StyleStatus } from "@/lib/types";

interface Props {
  on: boolean;
  onToggle: (on: boolean) => void;
  status: StyleStatus;
  style: StyleDescription | null;
  error?: string | null;
  hasSource: boolean;
  onChange: (key: keyof StyleDescription, value: string) => void;
  onRegenerate: () => void;
}

/**
 * The style description a designer would normally hand over. Read off the photo
 * by the model, then corrected by hand — the point is that nobody has to write
 * it from scratch, and nothing wrong reaches the prompt.
 */
export function StylePanel({ on, onToggle, status, style, error, hasSource, onChange, onRegenerate }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">Style description</div>
          <div className="mt-0.5 text-[11px] leading-snug text-stone-500">
            Read off your photo, like the brief a designer hands over. Fix anything wrong before you shoot.
          </div>
        </div>
        <Switch on={on} onToggle={onToggle} label="Use style description" />
      </div>

      {on && (
        <div className="border-t px-4 pb-4 pt-3 hairline">
          {!hasSource && <p className="text-xs text-stone-500">Upload a product photo and the description writes itself.</p>}

          {hasSource && status === "loading" && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="shimmer h-9 w-full rounded-lg" />
              ))}
              <p className="pt-1 text-[11px] text-stone-500">Reading the garment…</p>
            </div>
          )}

          {hasSource && status === "error" && (
            <div className="space-y-2">
              <p className="text-xs text-red-700">{error || "Could not read the photo."}</p>
              <button className="btn-ghost w-full" onClick={onRegenerate}>
                Try again
              </button>
            </div>
          )}

          {hasSource && status === "ready" && style && (
            <div className="space-y-3">
              {STYLE_FIELDS.map(({ key, label, hint, long }) => (
                <label key={key} className="block">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-semibold text-stone-700">{label}</span>
                    <span className="truncate text-[10px] text-stone-400">{hint}</span>
                  </div>
                  {long ? (
                    <textarea
                      className="input min-h-[56px] resize-y text-[12px] leading-snug"
                      value={style[key]}
                      onChange={(e) => onChange(key, e.target.value)}
                    />
                  ) : (
                    <input className="input text-[12px]" value={style[key]} onChange={(e) => onChange(key, e.target.value)} />
                  )}
                </label>
              ))}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-stone-400">Free — costs no credits</span>
                <button className="text-[11px] font-medium text-stone-600 underline underline-offset-2 hover:text-stone-900" onClick={onRegenerate}>
                  Re-read photo
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onToggle(!on)}
      className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-stone-900" : "bg-stone-300"}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}
