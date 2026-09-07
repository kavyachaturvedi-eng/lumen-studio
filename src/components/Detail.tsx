"use client";

import { useState } from "react";
import { MODELS, TRANSFORMS } from "@/lib/presets";
import type { Shot } from "@/lib/types";
import { download } from "@/lib/client";
import { ScorePill, modelLabel } from "./Gallery";

interface Props {
  shot: Shot;
  onClose: () => void;
  onEdit: (shot: Shot, instruction: string, model: string) => void;
  onUpscale: (shot: Shot, size: "2K" | "4K", model: string) => void;
  onTransform: (shot: Shot, transformId: string, detail: string, model: string) => void;
  onUseAsSource: (shot: Shot) => void;
  onDelete: (shot: Shot) => void;
  onRescore: (shot: Shot) => void;
}

type Tab = "edit" | "upscale" | "transform";

export function Detail({ shot, onClose, onEdit, onUpscale, onTransform, onUseAsSource, onDelete, onRescore }: Props) {
  const [tab, setTab] = useState<Tab>("edit");
  const [instruction, setInstruction] = useState("");
  const [transformId, setTransformId] = useState(TRANSFORMS[0].id);
  const [detail, setDetail] = useState("");
  const [model, setModel] = useState<string>("gemini-3-pro-image");
  const [showPrompt, setShowPrompt] = useState(false);
  const ready = shot.status === "done" && !!shot.image;

  const ext = shot.image?.startsWith("data:image/svg") ? "svg" : shot.image?.startsWith("data:image/png") ? "png" : "jpg";
  const filename = `lumen-${shot.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${modelLabel(shot.model).toLowerCase().replace(/\s+/g, "")}-${shot.size}.${ext}`;

  return (
    <aside className="flex w-full flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 lg:w-[380px] lg:shrink-0 lg:overflow-y-auto [&>*]:shrink-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{shot.label}</div>
          <div className="text-xs text-stone-500">
            {modelLabel(shot.model)} · {shot.aspect} · {shot.size}
          </div>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Close">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className="checker overflow-hidden rounded-xl border border-stone-100">
        {shot.status === "loading" && <div className="shimmer aspect-square w-full" />}
        {shot.status === "error" && <div className="p-4 text-xs text-red-700">{shot.error}</div>}
        {shot.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.image} alt={shot.label} className="w-full object-contain" />
        )}
      </div>

      {/* Fidelity review */}
      <div className="rounded-xl bg-stone-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="label">Fidelity review</div>
          {shot.scoreStatus === "loading" ? (
            <span className="text-[11px] text-stone-500">scoring…</span>
          ) : shot.score ? (
            <ScorePill score={shot.score} />
          ) : ready ? (
            <button className="text-[11px] underline" onClick={() => onRescore(shot)}>
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
                  <div className="text-[10px] leading-tight text-stone-500">{k}</div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                    <div className={`h-full rounded-full ${v >= 8 ? "bg-emerald-500" : v >= 6 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${v * 10}%` }} />
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium">{v}/10</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs leading-snug text-stone-600">{shot.score.notes}</p>
          </>
        ) : (
          <p className="text-xs text-stone-500">Each take is compared with your original photo for label, colour, cut and realism.</p>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary" disabled={!ready} onClick={() => shot.image && download(shot.image, filename)}>
          Download
        </button>
        <button className="btn-ghost" disabled={!ready} onClick={() => onUseAsSource(shot)} title="Use this image as the new reference for further shots">
          Use as source
        </button>
      </div>

      {/* Tabs */}
      <div>
        <div className="mb-3 flex gap-1 rounded-lg bg-stone-100 p-1">
          {(
            [
              ["edit", "Edit by prompt"],
              ["upscale", "Upscale"],
              ["transform", "Transform"],
            ] as const
          ).map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${tab === id ? "bg-white shadow-sm" : "text-stone-500 hover:text-stone-800"}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="mb-3">
          <div className="mb-1 text-[11px] text-stone-500">Run with</div>
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
              className="input min-h-[84px] resize-y"
              placeholder="e.g. remove the wrinkle on the left sleeve · make the background a warmer beige · move the model closer · add soft shadow under the hem"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {["Remove wrinkles", "Whiter background", "Brighter, airier", "Tighter crop on garment", "Add soft contact shadow", "Fix the collar shape"].map((q) => (
                <button key={q} className="chip" onClick={() => setInstruction(q)}>
                  {q}
                </button>
              ))}
            </div>
            <button className="btn-primary" disabled={!ready || !instruction.trim()} onClick={() => onEdit(shot, instruction, model)}>
              Apply edit
            </button>
            <p className="text-[11px] text-stone-500">Only what you ask for changes; the garment is re-checked against your original.</p>
          </div>
        )}

        {tab === "upscale" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-stone-600">Re-render this exact image at a higher resolution, recovering fabric texture and edge sharpness.</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost" disabled={!ready} onClick={() => onUpscale(shot, "2K", model)}>
                Upscale to 2K
              </button>
              <button className="btn-primary" disabled={!ready} onClick={() => onUpscale(shot, "4K", "gemini-3-pro-image")}>
                Upscale to 4K
              </button>
            </div>
            <p className="text-[11px] text-stone-500">4K always uses Nano Banana Pro. If a 4K response is too large for the host, use 2K.</p>
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
            <input className="input" placeholder={TRANSFORMS.find((t) => t.id === transformId)?.hint} value={detail} onChange={(e) => setDetail(e.target.value)} />
            <button className="btn-primary" disabled={!ready} onClick={() => onTransform(shot, transformId, detail, model)}>
              Transform
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-stone-100 pt-3">
        <button className="text-[11px] text-stone-500 underline" onClick={() => setShowPrompt((v) => !v)}>
          {showPrompt ? "Hide" : "Show"} the prompt that was sent
        </button>
        {showPrompt && <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-900 p-3 font-mono text-[10.5px] leading-relaxed text-stone-100">{shot.prompt}</pre>}
        <button className="mt-2 block text-[11px] text-red-600 underline" onClick={() => onDelete(shot)}>
          Delete this take
        </button>
      </div>
    </aside>
  );
}
