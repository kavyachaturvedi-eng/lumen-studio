"use client";

import { useState } from "react";
import { MODELS, TRANSFORMS } from "@/lib/presets";
import type { Shot } from "@/lib/types";
import { download } from "@/lib/client";
import { ScorePill, modelLabel } from "./Gallery";

interface Props {
  shot: Shot;
  creditsLeft: number;
  costOf: (kind: "edit" | "upscale" | "transform", model: string, size: string) => number;
  onClose: () => void;
  onEdit: (shot: Shot, instruction: string, model: string) => void;
  onUpscale: (shot: Shot, size: "2K" | "4K", model: string) => void;
  onTransform: (shot: Shot, transformId: string, detail: string, model: string) => void;
  onUseAsSource: (shot: Shot) => void;
  onDelete: (shot: Shot) => void;
  onRescore: (shot: Shot) => void;
}

type Tab = "edit" | "upscale" | "transform";

export function Detail({
  shot,
  creditsLeft,
  costOf,
  onClose,
  onEdit,
  onUpscale,
  onTransform,
  onUseAsSource,
  onDelete,
  onRescore,
}: Props) {
  const [tab, setTab] = useState<Tab>("edit");
  const [instruction, setInstruction] = useState("");
  const [transformId, setTransformId] = useState(TRANSFORMS[0].id);
  const [detail, setDetail] = useState("");
  const [model, setModel] = useState<string>("gemini-3-pro-image");
  const [showPrompt, setShowPrompt] = useState(false);
  const ready = shot.status === "done" && !!shot.image;

  const editSize = shot.size === "2K" ? "2K" : "1K";
  const editCost = costOf("edit", model, editSize);
  const transformCost = costOf("transform", model, "1K");
  const up2k = costOf("upscale", model, "2K");
  const up4k = costOf("upscale", "gemini-3-pro-image", "4K");
  const afford = (n: number) => creditsLeft >= n;

  const ext = shot.image?.startsWith("data:image/svg") ? "svg" : shot.image?.startsWith("data:image/png") ? "png" : "jpg";
  const filename = `lumen-${shot.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${modelLabel(shot.model).toLowerCase().replace(/\s+/g, "")}-${shot.size}.${ext}`;

  return (
    <aside className="card scroll-quiet flex w-full flex-col gap-4 p-4 lg:w-[380px] lg:shrink-0 lg:overflow-y-auto [&>*]:shrink-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold tracking-tight">{shot.label}</div>
          <div className="font-mono text-[11px] text-[var(--muted)]">
            {modelLabel(shot.model)} · {shot.aspect} · {shot.size}
            {shot.credits ? ` · ${shot.credits} cr` : ""}
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-[var(--subtle)] transition-colors hover:bg-zinc-100 hover:text-[var(--ink)]" aria-label="Close">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className="checker overflow-hidden rounded-xl border hairline">
        {shot.status === "loading" && <div className="shimmer aspect-square w-full" />}
        {shot.status === "error" && <div className="p-4 text-xs text-[var(--bad)]">{shot.error}</div>}
        {shot.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.image} alt={shot.label} className="w-full object-contain" />
        )}
      </div>

      {/* Fidelity review */}
      <div className="rounded-xl border bg-[var(--surface-2)] p-3 hairline">
        <div className="mb-2 flex items-center justify-between">
          <div className="label">Fidelity review</div>
          {shot.scoreStatus === "loading" ? (
            <span className="font-mono text-[11px] text-[var(--muted)]">scoring…</span>
          ) : shot.score ? (
            <ScorePill score={shot.score} />
          ) : ready ? (
            <button className="text-[11px] font-medium text-[var(--accent)]" onClick={() => onRescore(shot)}>
              score now
            </button>
          ) : null}
        </div>
        {shot.score ? (
          <>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["Label / print", shot.score.label],
                  ["Colour / finish", shot.score.colour],
                  ["Cut / trims", shot.score.shape],
                  ["Realism", shot.score.realism],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] leading-tight text-[var(--muted)]">{k}</div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className={`h-full rounded-full ${v >= 8 ? "bg-[var(--ok)]" : v >= 6 ? "bg-[var(--warn)]" : "bg-[var(--bad)]"}`}
                      style={{ width: `${v * 10}%` }}
                    />
                  </div>
                  <div className="mt-1 font-mono text-[11px] tabular-nums">{v}/10</div>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[12px] leading-snug text-[var(--ink-2)]">{shot.score.notes}</p>
          </>
        ) : (
          <p className="text-[12px] text-[var(--muted)]">Each take is compared with your original photo for label, colour, cut and realism.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary" disabled={!ready} onClick={() => shot.image && download(shot.image, filename)}>
          Download
        </button>
        <button className="btn-ghost" disabled={!ready} onClick={() => onUseAsSource(shot)} title="Use this image as the reference for further shots">
          Use as source
        </button>
      </div>

      <div>
        <div className="seg mb-3">
          {(
            [
              ["edit", "Edit"],
              ["upscale", "Upscale"],
              ["transform", "Transform"],
            ] as const
          ).map(([id, l]) => (
            <button key={id} data-on={tab === id} onClick={() => setTab(id)}>
              {l}
            </button>
          ))}
        </div>

        <div className="mb-3">
          <div className="label mb-2">Run with</div>
          <div className="flex gap-1.5">
            {MODELS.map((m) => (
              <button key={m.id} className="chip" data-on={model === m.id} onClick={() => setModel(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "edit" && (
          <div className="flex flex-col gap-2">
            <textarea
              className="input min-h-[84px] resize-y text-[12px]"
              placeholder="e.g. remove the wrinkle on the left sleeve · warmer beige background · tighter crop"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {["Remove wrinkles", "Whiter background", "Brighter, airier", "Tighter crop", "Add contact shadow", "Fix the collar"].map((q) => (
                <button key={q} className="chip" onClick={() => setInstruction(q)}>
                  {q}
                </button>
              ))}
            </div>
            <button className="btn-primary" disabled={!ready || !instruction.trim() || !afford(editCost)} onClick={() => onEdit(shot, instruction, model)}>
              Apply edit · {editCost} cr
            </button>
            <p className="text-[11px] text-[var(--muted)]">Only what you ask for changes; the garment is re-checked against your original.</p>
          </div>
        )}

        {tab === "upscale" && (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] text-[var(--ink-2)]">Re-render this exact image larger, recovering fabric texture and edge sharpness.</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost" disabled={!ready || !afford(up2k)} onClick={() => onUpscale(shot, "2K", model)}>
                2K · {up2k} cr
              </button>
              <button className="btn-primary" disabled={!ready || !afford(up4k)} onClick={() => onUpscale(shot, "4K", "gemini-3-pro-image")}>
                4K · {up4k} cr
              </button>
            </div>
            <p className="text-[11px] text-[var(--muted)]">4K always uses Nano Banana Pro.</p>
          </div>
        )}

        {tab === "transform" && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {TRANSFORMS.map((t) => (
                <button key={t.id} className="chip" data-on={transformId === t.id} title={t.hint} onClick={() => setTransformId(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            <input
              className="input text-[12px]"
              placeholder={TRANSFORMS.find((t) => t.id === transformId)?.hint}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
            <button className="btn-primary" disabled={!ready || !afford(transformCost)} onClick={() => onTransform(shot, transformId, detail, model)}>
              Transform · {transformCost} cr
            </button>
          </div>
        )}
      </div>

      <div className="border-t pt-3 hairline">
        <button className="text-[11px] text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink)]" onClick={() => setShowPrompt((v) => !v)}>
          {showPrompt ? "Hide" : "Show"} the prompt that was sent
        </button>
        {showPrompt && (
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--ink)] p-3 font-mono text-[10.5px] leading-relaxed text-zinc-100">
            {shot.prompt}
          </pre>
        )}
        <button className="mt-2 block text-[11px] text-[var(--bad)] underline underline-offset-2" onClick={() => onDelete(shot)}>
          Delete this take
        </button>
      </div>
    </aside>
  );
}
