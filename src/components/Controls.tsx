"use client";

import { useRef, useState } from "react";
import { ANGLES, ASPECTS, BACKGROUNDS, LIGHTING, MAX_ANGLES, MODELS, SHOT_TYPES, type ShotType } from "@/lib/presets";
import { PLANS, planRequiredFor } from "@/lib/plans";
import type { Me, Settings, SourceImage } from "@/lib/types";
import { Section } from "./Section";

interface Props {
  me: Me | null;
  source: SourceImage | null;
  onSource: (f: File) => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onGenerate: () => void;
  busy: boolean;
  cost: number;
}

const SHOT_ORDER = Object.keys(SHOT_TYPES) as ShotType[];

export function Controls({ me, source, onSource, settings, onChange, onGenerate, busy, cost }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [angleHint, setAngleHint] = useState(false);
  const allowed = me?.shotTypes ?? SHOT_ORDER;
  const angles = settings.angleIds.length;
  const takes = angles * settings.models.length * settings.perModel;
  const notEnough = me ? cost > me.creditsLeft : false;

  function pickShot(id: ShotType) {
    const s = SHOT_TYPES[id];
    onChange({ shotType: id, angleIds: [s.defaultAngle], backgroundId: s.defaultBackground, lightingId: s.defaultLighting });
  }

  function toggleAngle(id: string) {
    const on = settings.angleIds.includes(id);
    if (on) {
      if (settings.angleIds.length === 1) return; // always keep one
      onChange({ angleIds: settings.angleIds.filter((a) => a !== id) });
      return;
    }
    if (settings.angleIds.length >= MAX_ANGLES) {
      setAngleHint(true);
      setTimeout(() => setAngleHint(false), 2200);
      return;
    }
    // Keep the chosen angles in the order they appear in the list.
    const next = ANGLES.map((a) => a.id).filter((a) => a === id || settings.angleIds.includes(a));
    onChange({ angleIds: next });
  }

  const lightLabel = LIGHTING.find((a) => a.id === settings.lightingId)?.label ?? "";
  const bgLabel = BACKGROUNDS.find((a) => a.id === settings.backgroundId)?.label ?? "";
  const modelsLabel = settings.models.map((m) => MODELS.find((x) => x.id === m)?.label.replace("Nano Banana ", "NB ")).join(" + ");

  return (
    <aside className="scroll-quiet flex w-full flex-col gap-3 lg:w-[340px] lg:shrink-0 lg:overflow-y-auto lg:pb-2 lg:pr-1 [&>*]:shrink-0">
      {/* Upload */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onSource(f);
        }}
        className={`group cursor-pointer overflow-hidden rounded-2xl border bg-white transition-colors ${
          dragging ? "border-[var(--accent)] bg-[var(--accent-soft)]" : source ? "border-[var(--line)]" : "border-dashed border-[var(--line-strong)] hover:border-[var(--ink)]"
        }`}
      >
        {source ? (
          <div className="flex items-center gap-3 p-3">
            <div className="checker h-16 w-16 shrink-0 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={source.dataUrl} alt="" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="label mb-1">Source photo</div>
              <div className="truncate text-[13px] font-medium">{source.name}</div>
              {source.width > 0 && (
                <div className="font-mono text-[11px] text-[var(--muted)]">
                  {source.width}×{source.height}
                </div>
              )}
            </div>
            <span className="btn-ghost btn-sm shrink-0">Replace</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-9 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--ink)] text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4m0 0-4 4m4-4 4 4" />
                <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
              </svg>
            </div>
            <div className="text-[14px] font-semibold tracking-tight">Drop one product photo</div>
            <div className="text-[12px] text-[var(--muted)]">A phone photo on any background works.</div>
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

      {/* Shot type — ordered Basic → Pro → Max */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="label">Shot type</div>
          {me && <span className="badge">{me.planLabel} plan</span>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SHOT_ORDER.map((id) => {
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
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : locked
                      ? "cursor-not-allowed border-dashed border-[var(--line)] bg-[var(--surface-2)] text-[var(--subtle)]"
                      : "border-[var(--line)] bg-white hover:border-[var(--line-strong)]"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[13px] font-semibold tracking-tight">{s.label}</span>
                  {locked && (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  )}
                </div>
                <div className={`mt-0.5 text-[11px] leading-snug ${on ? "text-white/65" : locked ? "" : "text-[var(--muted)]"}`}>
                  {locked ? `${needs} plan` : s.blurb}
                </div>
              </button>
            );
          })}
        </div>
        {me && allowed.length < SHOT_ORDER.length && (
          <p className="mt-3 text-[11px] leading-snug text-[var(--muted)]">Locked shots come with a higher plan — ask the studio to upgrade.</p>
        )}
      </div>

      {/* Camera angles — multi-select */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="label">Camera angles</div>
          <span className={`font-mono text-[11px] tabular-nums transition-colors ${angleHint ? "text-[var(--bad)]" : "text-[var(--muted)]"}`}>
            {angles}/{MAX_ANGLES}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ANGLES.map((a) => {
            const on = settings.angleIds.includes(a.id);
            const full = !on && angles >= MAX_ANGLES;
            return (
              <button key={a.id} className={`chip ${full ? "opacity-45" : ""}`} data-on={on} title={a.hint} onClick={() => toggleAngle(a.id)}>
                {on && angles > 1 && (
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-white/20 font-mono text-[10px]">{settings.angleIds.indexOf(a.id) + 1}</span>
                )}
                {a.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11px] leading-snug text-[var(--muted)]">
          {angleHint ? `Up to ${MAX_ANGLES} angles per run — tap one to remove it first.` : "Pick up to 3, e.g. front, side and back. Each angle is shot separately."}
        </p>
      </div>

      {/* Look */}
      <Section title="Look" summary={`${lightLabel} · ${bgLabel}`}>
        <div className="space-y-4">
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
            <div className="label mb-2">Art direction · optional</div>
            <textarea
              className="input min-h-[68px] resize-y text-[12px]"
              placeholder="e.g. sleeves folded behind, calm premium mood"
              value={settings.extra}
              onChange={(e) => onChange({ extra: e.target.value })}
            />
          </div>
        </div>
      </Section>

      {/* Output */}
      <Section title="Output" summary={`${settings.aspect} · ${settings.size} · ${modelsLabel} · ${settings.perModel} each`}>
        <div className="space-y-4">
          <div>
            <div className="label mb-2">Aspect ratio</div>
            <div className="flex flex-wrap gap-1.5">
              {ASPECTS.map((a) => (
                <button key={a} className="chip font-mono" data-on={settings.aspect === a} onClick={() => onChange({ aspect: a })}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label mb-2">Resolution</div>
              <div className="seg">
                {(["1K", "2K"] as const).map((s) => (
                  <button key={s} data-on={settings.size === s} onClick={() => onChange({ size: s })}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="label mb-2">Takes each</div>
              <div className="seg">
                {[1, 2, 3].map((n) => (
                  <button key={n} data-on={settings.perModel === n} onClick={() => onChange({ perModel: n })}>
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
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-colors ${on ? "border-[var(--ink)]" : "border-[var(--line)] hover:border-[var(--line-strong)]"}`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--ink)]"
                      checked={on}
                      onChange={(e) => {
                        const next = e.target.checked ? [...settings.models, m.id] : settings.models.filter((x) => x !== m.id);
                        if (next.length) onChange({ models: next });
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium">{m.label}</div>
                      <div className="text-[11px] text-[var(--muted)]">{m.hint}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* Generate */}
      <div className="sticky bottom-0 z-10 -mx-1 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent px-1 pb-1 pt-4">
        <button className="btn-primary w-full py-3 shadow-lg shadow-black/10" disabled={!source || busy || notEnough} onClick={onGenerate}>
          {busy ? (
            <>
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              Generating…
            </>
          ) : notEnough ? (
            "Not enough credits"
          ) : (
            `Generate ${takes} ${takes === 1 ? "take" : "takes"}`
          )}
        </button>
        <div className="mt-2 flex items-center justify-between px-0.5 font-mono text-[11px] text-[var(--muted)]">
          <span>
            {angles} {angles === 1 ? "angle" : "angles"} × {settings.models.length} {settings.models.length === 1 ? "model" : "models"} × {settings.perModel}
          </span>
          <span className={notEnough ? "text-[var(--bad)]" : "text-[var(--ink)]"}>
            {cost} {cost === 1 ? "credit" : "credits"}
          </span>
        </div>
      </div>
    </aside>
  );
}
