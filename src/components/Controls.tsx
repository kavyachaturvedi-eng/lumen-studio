"use client";

import { useRef } from "react";
import { ANGLES, ASPECTS, BACKGROUNDS, LIGHTING, MODELS, SHOT_TYPES, type ShotType } from "@/lib/presets";
import type { Settings, SourceImage } from "@/lib/types";

interface Props {
  source: SourceImage | null;
  onSource: (f: File) => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onGenerate: () => void;
  busy: boolean;
}

export function Controls({ source, onSource, settings, onChange, onGenerate, busy }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const total = settings.models.length * settings.perModel;

  function pickShot(id: ShotType) {
    const s = SHOT_TYPES[id];
    onChange({ shotType: id, angleId: s.defaultAngle, backgroundId: s.defaultBackground, lightingId: s.defaultLighting });
  }

  return (
    <aside className="flex w-full flex-col gap-6 lg:w-[340px] lg:shrink-0 lg:overflow-y-auto lg:pr-1 lg:pb-2 [&>*]:shrink-0">
      {/* Upload */}
      <section>
        <div className="label mb-2">1 · Product photo</div>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) onSource(f);
          }}
          className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition ${
            source ? "border-stone-200 bg-white" : "border-stone-300 bg-white hover:border-stone-500"
          }`}
        >
          {source ? (
            <div className="flex items-center gap-3 p-3">
              <div className="checker h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={source.dataUrl} alt="" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 text-xs">
                <div className="truncate font-medium">{source.name}</div>
                <div className="text-stone-500">
                  {source.width}×{source.height}
                </div>
                <div className="mt-1 text-stone-500 underline-offset-2 group-hover:underline">Replace photo</div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-stone-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4m0 0-4 4m4-4 4 4" />
                <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
              </svg>
              <div className="text-sm font-medium">Drop one plain product photo</div>
              <div className="text-xs text-stone-500">Phone photo on any background works. JPG or PNG.</div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSource(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      {/* Shot type */}
      <section>
        <div className="label mb-2">2 · Shot type</div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(SHOT_TYPES) as ShotType[]).map((id) => {
            const s = SHOT_TYPES[id];
            const on = settings.shotType === id;
            return (
              <button
                key={id}
                onClick={() => pickShot(id)}
                className={`rounded-lg border p-2.5 text-left transition ${on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white hover:border-stone-400"}`}
              >
                <div className="text-sm font-semibold">{s.label}</div>
                <div className={`mt-0.5 text-[11px] leading-snug ${on ? "text-stone-300" : "text-stone-500"}`}>{s.blurb}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Camera */}
      <section>
        <div className="label mb-2">3 · Camera angle</div>
        <div className="flex flex-wrap gap-1.5">
          {ANGLES.map((a) => (
            <button key={a.id} className="chip" data-on={settings.angleId === a.id} title={a.hint} onClick={() => onChange({ angleId: a.id })}>
              {a.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="label mb-2">4 · Lighting</div>
        <div className="flex flex-wrap gap-1.5">
          {LIGHTING.map((a) => (
            <button key={a.id} className="chip" data-on={settings.lightingId === a.id} title={a.hint} onClick={() => onChange({ lightingId: a.id })}>
              {a.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="label mb-2">5 · Background / setting</div>
        <div className="flex flex-wrap gap-1.5">
          {BACKGROUNDS.map((a) => (
            <button key={a.id} className="chip" data-on={settings.backgroundId === a.id} title={a.hint} onClick={() => onChange({ backgroundId: a.id })}>
              {a.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="label mb-2">6 · Art direction (optional)</div>
        <textarea
          className="input min-h-[72px] resize-y"
          placeholder="e.g. model with curly hair, denim jeans, hands in pockets; keep the mood calm and premium"
          value={settings.extra}
          onChange={(e) => onChange({ extra: e.target.value })}
        />
      </section>

      <section>
        <div className="label mb-2">7 · Output</div>
        <div className="flex flex-wrap gap-1.5">
          {ASPECTS.map((a) => (
            <button key={a} className="chip" data-on={settings.aspect === a} onClick={() => onChange({ aspect: a })}>
              {a}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[11px] text-stone-500">Draft resolution</div>
            <div className="flex gap-1.5">
              {(["1K", "2K"] as const).map((s) => (
                <button key={s} className="chip" data-on={settings.size === s} onClick={() => onChange({ size: s })}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-stone-500">Takes per model</div>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((n) => (
                <button key={n} className="chip" data-on={settings.perModel === n} onClick={() => onChange({ perModel: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="label mb-2">8 · Models to race</div>
        <div className="flex flex-col gap-1.5">
          {MODELS.map((m) => {
            const on = settings.models.includes(m.id);
            return (
              <label key={m.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 ${on ? "border-stone-900 bg-white" : "border-stone-200 bg-white"}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-stone-900"
                  checked={on}
                  onChange={(e) => {
                    const next = e.target.checked ? [...settings.models, m.id] : settings.models.filter((x) => x !== m.id);
                    if (next.length) onChange({ models: next });
                  }}
                />
                <div className="text-sm">
                  <div className="font-medium">{m.label}</div>
                  <div className="text-[11px] text-stone-500">{m.hint}</div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      <button className="btn-primary sticky bottom-4 w-full shadow-lg shadow-stone-900/10" disabled={!source || busy} onClick={onGenerate}>
        {busy ? "Generating…" : `Generate ${total} ${total === 1 ? "take" : "takes"} & rank`}
      </button>
    </aside>
  );
}
