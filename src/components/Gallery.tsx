"use client";

import { MODELS } from "@/lib/presets";
import type { Shot } from "@/lib/types";

interface Props {
  shots: Shot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  bestId: string | null;
}

export function modelLabel(id: string) {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

export function ScorePill({ score, small }: { score?: Shot["score"]; small?: boolean }) {
  if (!score) return null;
  const tone =
    score.verdict === "keep" ? "bg-emerald-600 text-white" : score.verdict === "review" ? "bg-amber-500 text-white" : "bg-red-600 text-white";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${tone} ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
      {score.overall}
      <span className="font-normal opacity-80">fidelity</span>
    </span>
  );
}

export function Gallery({ shots, selectedId, onSelect, bestId }: Props) {
  if (!shots.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 p-10 text-center">
        <div className="mb-3 grid grid-cols-3 gap-1.5 opacity-60">
          {["Packshot", "Ghost", "Flat lay", "Lifestyle", "Hero", "Detail"].map((t) => (
            <div key={t} className="grid h-14 w-16 place-items-center rounded-md bg-stone-100 text-[10px] text-stone-400">
              {t}
            </div>
          ))}
        </div>
        <h2 className="text-base font-semibold">Your shots will land here</h2>
        <p className="mt-1 max-w-sm text-sm text-stone-500">
          Upload one photo, pick a shot type, and race both models. Every take is scored against your original for label, colour and shape fidelity — the best match is flagged.
        </p>
      </div>
    );
  }

  // Newest batch first, then by score within a batch.
  const ordered = [...shots].sort((a, b) => {
    if (b.batch !== a.batch) return b.batch - a.batch;
    return (b.score?.overall ?? -1) - (a.score?.overall ?? -1);
  });

  return (
    <div className="grid flex-1 auto-rows-max grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {ordered.map((s) => {
        const on = s.id === selectedId;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`group relative overflow-hidden rounded-xl border bg-white text-left transition ${
              on ? "border-stone-900 ring-2 ring-stone-900/10" : "border-stone-200 hover:border-stone-400"
            }`}
          >
            <div className="checker relative aspect-square w-full overflow-hidden">
              {s.status === "loading" && <div className="shimmer absolute inset-0" />}
              {s.status === "error" && (
                <div className="absolute inset-0 grid place-items-center bg-red-50 p-3 text-center text-[11px] leading-snug text-red-700">
                  {s.error?.slice(0, 160) || "Generation failed"}
                </div>
              )}
              {s.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt={s.label} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
              )}
              {s.id === bestId && (
                <div className="absolute left-2 top-2 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                  Best match
                </div>
              )}
              {s.status === "done" && (
                <div className="absolute bottom-2 right-2">
                  {s.scoreStatus === "loading" ? (
                    <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] text-stone-600 shadow">scoring…</span>
                  ) : (
                    <ScorePill score={s.score} small />
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-2.5 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{s.label}</div>
                <div className="truncate text-[11px] text-stone-500">
                  {modelLabel(s.model)} · {s.size}
                </div>
              </div>
              {s.kind !== "shot" && <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-500">{s.kind}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
