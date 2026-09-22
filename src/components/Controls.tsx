"use client";

import { useRef } from "react";
import { ANGLES, ASPECTS, BACKGROUNDS, LIGHTING, MODELS, SHOT_TYPES, type ShotType } from "@/lib/presets";
import { PLANS, planRequiredFor } from "@/lib/plans";
import type { Me, Settings, SourceImage, StyleStatus } from "@/lib/types";
import type { StyleDescription } from "@/lib/style";
import { Section } from "./Section";
import { StylePanel } from "./StylePanel";

interface Props {
  me: Me | null;
  source: SourceImage | null;
  onSource: (f: File) => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onGenerate: () => void;
  busy: boolean;
  cost: number;
  styleStatus: StyleStatus;
  style: StyleDescription | null;
  styleError: string | null;
  onStyleChange: (key: keyof StyleDescription, value: string) => void;
  onStyleRegenerate: () => void;
}

export function Controls({
  me,
  source,
  onSource,
  settings,
  onChange,
  onGenerate,
  busy,
  cost,
  styleStatus,
  style,
  styleError,
  onStyleChange,
  onStyleRegenerate,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const allowed = me?.shotTypes ?? (Object.keys(SHOT_TYPES) as ShotType[]);
  const takes = settings.models.length * settings.perModel;
  const notEnough = me ? cost > me.creditsLeft : false;

  function pickShot(id: ShotType) {
    const s = SHOT_TYPES[id];
    onChange({ shotType: id, angleId: s.defaultAngle, backgroundId: s.defaultBackground, lightingId: s.defaultLighting });
  }

  const angleLabel = ANGLES.find((a) => a.id === settings.angleId)?.label ?? "";
  const lightLabel = LIGHTING.find((a) => a.id === settings.lightingId)?.label ?? "";
  const bgLabel = BACKGROUNDS.find((a) => a.id === settings.backgroundId)?.label ?? "";

  return (
    <aside className="flex w-full flex-col gap-3 lg:w-[336px] lg:shrink-0 lg:overflow-y-auto lg:pb-2 lg:pr-1 [&>*]:shrink-0">
      {/* Upload */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onSource(f);
        }}
        className={`group cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed bg-white transition-colors ${
          source ? "border-stone-200" : "border-stone-300 hover:border-stone-500"
        }`}
      >
        {source ? (
          <div className="flex items-center gap-3 p-3">
            <div className="checker h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={source.dataUrl} alt="" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 text-xs">
              <div className="truncate font-semibold">{source.name}</div>
              {source.width > 0 && (
                <div className="text-stone-500">
                  {source.width}×{source.height}
                </div>
              )}
              <div className="mt-1 text-stone-500 underline-offset-2 group-hover:underline">Replace photo</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-9 text-center">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-stone-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4m0 0-4 4m4-4 4 4" />
              <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
            <div className="text-sm font-semibold">Drop one product photo</div>
            <div className="text-xs text-stone-500">A phone photo on any background works.</div>
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

      {/* Shot type */}
      <div className="card p-4">
        <div className="label mb-2.5">Shot type</div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(SHOT_TYPES) as ShotType[]).map((id) => {
            const s = SHOT_TYPES[id];
            const locked = !allowed.includes(id);
            const on = settings.shotType === id;
            const needs = PLANS[planRequiredFor(id)].label;
            return (
              <button
                key={id}
                disabled={locked}
                title={locked ? `Included in the ${needs} plan` : s.blurb}
                onClick={() => !locked && pickShot(id)}
                className={`relative rounded-xl border p-2.5 text-left transition-all duration-150 ${
                  on
                    ? "border-stone-900 bg-stone-900 text-white"
                    : locked
                      ? "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400"
                      : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold">{s.label}</span>
                  {locked && (
                    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  )}
                </div>
                <div className={`mt-0.5 text-[11px] leading-snug ${on ? "text-stone-300" : locked ? "text-stone-400" : "text-stone-500"}`}>
                  {locked ? `${needs} plan` : s.blurb}
                </div>
              </button>
            );
          })}
        </div>
        {me && allowed.length < Object.keys(SHOT_TYPES).length && (
          <p className="mt-2.5 text-[11px] leading-snug text-stone-500">
            You&rsquo;re on <span className="font-semibold text-stone-700">{me.planLabel}</span>. Locked shots come with a higher plan — ask the studio to upgrade.
          </p>
        )}
      </div>

      {/* Style description */}
      <StylePanel
        on={settings.styleOn}
        onToggle={(v) => onChange({ styleOn: v })}
        status={styleStatus}
        style={style}
        error={styleError}
        hasSource={Boolean(source)}
        onChange={onStyleChange}
        onRegenerate={onStyleRegenerate}
      />

      {/* Look */}
      <Section title="Look" summary={`${angleLabel} · ${lightLabel} · ${bgLabel}`}>
        <div className="space-y-4">
          <div>
            <div className="label mb-2">Camera angle</div>
            <div className="flex flex-wrap gap-1.5">
              {ANGLES.map((a) => (
                <button key={a.id} className="chip" data-on={settings.angleId === a.id} title={a.hint} onClick={() => onChange({ angleId: a.id })}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2">Lighting</div>
            <div className="flex flex-wrap gap-1.5">
              {LIGHTING.map((a) => (
                <button key={a.id} className="chip" data-on={settings.lightingId === a.id} title={a.hint} onClick={() => onChange({ lightingId: a.id })}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2">Background / setting</div>
            <div className="flex flex-wrap gap-1.5">
              {BACKGROUNDS.map((a) => (
                <button key={a.id} className="chip" data-on={settings.backgroundId === a.id} title={a.hint} onClick={() => onChange({ backgroundId: a.id })}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2">Art direction (optional)</div>
            <textarea
              className="input min-h-[68px] resize-y text-[12px]"
              placeholder="e.g. model with curly hair, hands in pockets; calm premium mood"
              value={settings.extra}
              onChange={(e) => onChange({ extra: e.target.value })}
            />
          </div>
        </div>
      </Section>

      {/* Output */}
      <Section title="Output" summary={`${settings.aspect} · ${settings.size} · ${takes} ${takes === 1 ? "take" : "takes"}`}>
        <div className="space-y-4">
          <div>
            <div className="label mb-2">Aspect ratio</div>
            <div className="flex flex-wrap gap-1.5">
              {ASPECTS.map((a) => (
                <button key={a} className="chip" data-on={settings.aspect === a} onClick={() => onChange({ aspect: a })}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label mb-2">Resolution</div>
              <div className="flex gap-1.5">
                {(["1K", "2K"] as const).map((s) => (
                  <button key={s} className="chip" data-on={settings.size === s} onClick={() => onChange({ size: s })}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="label mb-2">Takes each</div>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((n) => (
                  <button key={n} className="chip" data-on={settings.perModel === n} onClick={() => onChange({ perModel: n })}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="label mb-2">Models to race</div>
            <div className="flex flex-col gap-1.5">
              {MODELS.map((m) => {
                const on = settings.models.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-colors ${on ? "border-stone-900" : "border-stone-200 hover:border-stone-300"}`}
                  >
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
          </div>
        </div>
      </Section>

      {/* Generate */}
      <div className="sticky bottom-0 z-10 -mx-1 bg-gradient-to-t from-[var(--canvas)] via-[var(--canvas)] to-transparent px-1 pb-1 pt-3">
        <button className="btn-primary w-full shadow-lg shadow-stone-900/10" disabled={!source || busy || notEnough} onClick={onGenerate}>
          {busy ? "Generating…" : notEnough ? "Not enough credits" : `Generate ${takes} ${takes === 1 ? "take" : "takes"}`}
        </button>
        <div className="mt-1.5 text-center text-[11px] text-stone-500">
          {notEnough ? (
            <span className="text-red-600">This run needs {cost} credits.</span>
          ) : (
            <>
              Uses <span className="font-semibold tabular-nums text-stone-700">{cost}</span> credits
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
