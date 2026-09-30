"use client";

import { ANGLES, MODELS } from "@/lib/presets";
import type { Shot } from "@/lib/types";
import { LogoMark } from "./Logo";

interface Props {
  shots: Shot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  bestIds: Set<string>;
}

export function modelLabel(id: string) {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

export function ScorePill({ score, small }: { score?: Shot["score"]; small?: boolean }) {
  if (!score) return null;
  const dot = score.verdict === "keep" ? "bg-[var(--ok)]" : score.verdict === "review" ? "bg-[var(--warn)]" : "bg-[var(--bad)]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/95 font-mono font-medium text-[var(--ink)] shadow-sm ring-1 ring-black/5 backdrop-blur ${
        small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {score.overall}
    </span>
  );
}

const angleRank = (id?: string) => (id ? ANGLES.findIndex((a) => a.id === id) : -1);

const EMPTY_TILES = ["Flat lay", "Ghost", "Hero", "Detail", "Lifestyle", "Packshot"];

export function Gallery({ shots, selectedId, onSelect, bestIds }: Props) {
  if (!shots.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed bg-white/60 p-10 text-center hairline">
        <LogoMark className="mb-5 h-11 w-11" />
        <h2 className="text-[17px] font-semibold tracking-tight">Your shots land here</h2>
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--muted)]">
          Upload one photo, choose a shot type and up to three angles, then race both models. Every take is scored against your original for label,
          colour and cut — the closest match per angle is flagged.
        </p>
        <div className="mt-7 grid grid-cols-6 gap-1.5 opacity-80">
          {EMPTY_TILES.map((t, i) => (
            <div
              key={t}
              className="grid h-14 w-14 place-items-center rounded-lg border bg-[var(--surface-2)] font-mono text-[9px] uppercase tracking-wide text-[var(--subtle)] hairline"
              style={{ opacity: 1 - i * 0.12 }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Newest batch first; within a batch, group by angle, then best score first.
  const ordered = [...shots].sort((a, b) => {
    if (b.batch !== a.batch) return b.batch - a.batch;
    if ((a.angleId ?? "") !== (b.angleId ?? "")) return angleRank(a.angleId) - angleRank(b.angleId);
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
            className={`group relative overflow-hidden rounded-2xl border bg-white text-left transition ${
              on ? "border-[var(--ink)] ring-2 ring-[var(--ink)]/10" : "border-[var(--line)] hover:border-[var(--line-strong)]"
            }`}
          >
            <div className="checker relative aspect-square w-full overflow-hidden">
              {s.status === "loading" && (
                <div className="shimmer absolute inset-0 grid place-items-center">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--subtle)]">Rendering</span>
                </div>
              )}
              {s.status === "error" && (
                <div className="absolute inset-0 grid place-items-center bg-red-50/70 p-3 text-center text-[11px] leading-snug text-[var(--bad)]">
                  {s.error?.slice(0, 160) || "Generation failed"}
                </div>
              )}
              {s.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt={s.label} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
              )}
              {bestIds.has(s.id) && (
                <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-white shadow">
                  Best match
                </div>
              )}
              {s.status === "done" && (
                <div className="absolute bottom-2 right-2">
                  {s.scoreStatus === "loading" ? (
                    <span className="rounded-full bg-white/95 px-2 py-0.5 font-mono text-[10px] text-[var(--muted)] shadow-sm">scoring…</span>
                  ) : (
                    <ScorePill score={s.score} small />
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium">{s.label}</div>
                <div className="truncate font-mono text-[10.5px] text-[var(--muted)]">
                  {modelLabel(s.model)} · {s.size}
                </div>
              </div>
              {s.kind !== "shot" && <span className="badge shrink-0">{s.kind}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
