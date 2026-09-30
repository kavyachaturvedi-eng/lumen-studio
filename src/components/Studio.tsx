"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controls } from "./Controls";
import { Gallery } from "./Gallery";
import { Detail } from "./Detail";
import { Logo } from "./Logo";
import { CreditMeter } from "./CreditMeter";
import { ApiError, callGenerate, callJudge, callMe, fileToSource, uid } from "@/lib/client";
import { ANGLES, SHOT_TYPES, TRANSFORMS } from "@/lib/presets";
import { batchCost, creditCost } from "@/lib/plans";
import type { Me, Settings, Shot, SourceImage } from "@/lib/types";

const DEFAULTS: Settings = {
  shotType: "flat-lay",
  angleIds: [SHOT_TYPES["flat-lay"].defaultAngle],
  lightingId: SHOT_TYPES["flat-lay"].defaultLighting,
  backgroundId: SHOT_TYPES["flat-lay"].defaultBackground,
  aspect: "4:5",
  extra: "",
  models: ["gemini-3.1-flash-image", "gemini-3-pro-image"],
  perModel: 2,
  size: "1K",
};

export function Studio() {
  const [me, setMe] = useState<Me | null>(null);
  const [source, setSource] = useState<SourceImage | null>(null);
  const [original, setOriginal] = useState<SourceImage | null>(null); // first upload — ground truth for judging
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const batchRef = useRef(0);

  useEffect(() => {
    callMe()
      .then((m) => {
        setMe(m);
        // Start on a shot type this plan actually includes.
        setSettings((s) => {
          if (m.shotTypes.includes(s.shotType)) return s;
          const first = m.shotTypes[0];
          if (!first) return s;
          const preset = SHOT_TYPES[first];
          return {
            ...s,
            shotType: first,
            angleIds: [preset.defaultAngle],
            lightingId: preset.defaultLighting,
            backgroundId: preset.defaultBackground,
          };
        });
      })
      .catch(() => setToast("Could not load your account."));
  }, []);

  const patch = useCallback((p: Partial<Shot> & { id: string }) => {
    setShots((prev) => prev.map((s) => (s.id === p.id ? { ...s, ...p } : s)));
  }, []);

  const flash = useCallback((msg: string, ms = 4500) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), ms);
  }, []);

  /**
   * Re-read the authoritative balance. Parallel takes each report the balance at
   * the moment of their own spend, so whichever resolves last can be a couple of
   * credits stale — this reconciles after a batch settles.
   */
  const refreshMe = useCallback(() => {
    callMe()
      .then((m) => setMe((prev) => (prev ? { ...prev, ...m } : m)))
      .catch(() => {});
  }, []);

  const busy = shots.some((s) => s.status === "loading");
  const selected = shots.find((s) => s.id === selectedId) ?? null;

  const cost = useMemo(
    () => batchCost(settings.shotType, settings.models, settings.perModel, settings.size, settings.angleIds.length),
    [settings.shotType, settings.models, settings.perModel, settings.size, settings.angleIds.length],
  );

  /** The highest-scoring take for each camera angle in the latest batch. */
  const bestIds = useMemo(() => {
    const latest = Math.max(0, ...shots.map((s) => s.batch));
    const best = new Map<string, Shot>();
    for (const s of shots) {
      if (s.batch !== latest || s.kind !== "shot" || !s.score) continue;
      const key = s.angleId ?? "";
      const cur = best.get(key);
      if (!cur || s.score.overall > cur.score!.overall) best.set(key, s);
    }
    return new Set([...best.values()].map((s) => s.id));
  }, [shots]);

  async function onSource(f: File) {
    try {
      const src = await fileToSource(f);
      setSource(src);
      setOriginal(src);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  function changeSettings(p: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...p }));
  }

  /* ---------------- generation ---------------- */

  async function score(id: string, image: string, label: string) {
    patch({ id, scoreStatus: "loading" });
    try {
      const ref = original?.dataUrl ?? source?.dataUrl;
      if (!ref) throw new Error("No reference");
      const { score } = await callJudge(ref, image, label);
      patch({ id, score, scoreStatus: "done" });
    } catch {
      patch({ id, scoreStatus: "error" });
    }
  }

  async function run(shot: Shot, body: Record<string, unknown>): Promise<void> {
    setShots((prev) => [shot, ...prev]);
    try {
      const r = await callGenerate(body);
      if (r.credits) {
        setMe((m) => (m ? { ...m, creditsLeft: r.credits!.left, percentLeft: r.credits!.percentLeft } : m));
      }
      patch({
        id: shot.id,
        status: "done",
        image: r.image,
        prompt: r.prompt,
        size: r.size,
        aspect: r.aspect,
        demo: r.demo,
        credits: r.credits?.spent,
      });
      void score(shot.id, r.image, shot.label);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      patch({ id: shot.id, status: "error", error: msg });
      if (e instanceof ApiError) {
        const d = e.data as { credits?: { left: number; percentLeft: number }; outOfCredits?: boolean; upgradeLabel?: string };
        if (d.credits) setMe((m) => (m ? { ...m, creditsLeft: d.credits!.left, percentLeft: d.credits!.percentLeft } : m));
        if (e.status === 402) flash("You're out of credits — ask the studio for a top-up. Nothing was charged.", 7000);
        else if (e.status === 403 && d.upgradeLabel) flash(`That shot needs the ${d.upgradeLabel} plan.`, 6000);
      }
    }
  }

  function generate() {
    if (!source) return;
    if (me && cost > me.creditsLeft) {
      flash(`This run needs ${cost} credits and you have ${me.creditsLeft}.`, 6000);
      return;
    }
    const batch = ++batchRef.current;
    const shotLabel = SHOT_TYPES[settings.shotType].label;
    const multi = settings.angleIds.length > 1;
    const running: Promise<void>[] = [];
    for (const angleId of settings.angleIds) {
      const angleLabel = ANGLES.find((a) => a.id === angleId)?.label ?? "";
      const label = multi && angleLabel ? `${shotLabel} · ${angleLabel}` : shotLabel;
      for (const model of settings.models) {
        for (let i = 0; i < settings.perModel; i++) {
          const shot: Shot = {
            id: uid(),
            batch,
            kind: "shot",
            label,
            model,
            angleId,
            status: "loading",
            aspect: settings.aspect,
            size: settings.size,
            scoreStatus: "idle",
            createdAt: Date.now(),
          };
          running.push(
            run(shot, {
              mode: "shot",
              source: source.dataUrl,
              shotType: settings.shotType,
              angleId,
              lightingId: settings.lightingId,
              backgroundId: settings.backgroundId,
              extra: settings.extra,
              model,
              aspect: settings.aspect,
              size: settings.size,
              seedHint: settings.perModel > 1 ? i + 1 : undefined,
            }),
          );
        }
      }
    }
    void Promise.allSettled(running).then(refreshMe);
    setSelectedId(null);
    scrollTo("gallery");
  }

  function scrollTo(id: string) {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }

  function edit(parent: Shot, instruction: string, model: string) {
    if (!parent.image) return;
    const size = parent.size === "2K" ? "2K" : "1K";
    const shot: Shot = {
      id: uid(),
      batch: parent.batch,
      kind: "edit",
      label: `Edit: ${instruction.slice(0, 40)}`,
      model,
      status: "loading",
      aspect: parent.aspect,
      size,
      parentId: parent.id,
      scoreStatus: "idle",
      createdAt: Date.now(),
    };
    setSelectedId(shot.id);
    void run(shot, { mode: "edit", source: parent.image, reference: original?.dataUrl, instruction, model, aspect: parent.aspect, size }).then(refreshMe);
  }

  function upscale(parent: Shot, size: "2K" | "4K", model: string) {
    if (!parent.image) return;
    const shot: Shot = {
      id: uid(),
      batch: parent.batch,
      kind: "upscale",
      label: `${parent.label} · ${size}`,
      model,
      status: "loading",
      aspect: parent.aspect,
      size,
      parentId: parent.id,
      scoreStatus: "idle",
      createdAt: Date.now(),
    };
    setSelectedId(shot.id);
    void run(shot, { mode: "upscale", source: parent.image, reference: original?.dataUrl, model, size }).then(refreshMe);
  }

  function transform(parent: Shot, transformId: string, detail: string, model: string) {
    if (!parent.image) return;
    const t = TRANSFORMS.find((x) => x.id === transformId);
    const aspect = transformId === "social" && detail.match(/\d+:\d+/) ? detail.match(/\d+:\d+/)![0] : parent.aspect;
    const shot: Shot = {
      id: uid(),
      batch: parent.batch,
      kind: "transform",
      label: `${t?.label ?? "Transform"}${detail ? `: ${detail.slice(0, 30)}` : ""}`,
      model,
      status: "loading",
      aspect,
      size: "1K",
      parentId: parent.id,
      scoreStatus: "idle",
      createdAt: Date.now(),
    };
    setSelectedId(shot.id);
    void run(shot, { mode: "transform", source: parent.image, reference: original?.dataUrl, transformId, detail, model, aspect }).then(refreshMe);
  }

  function useAsSource(shot: Shot) {
    if (!shot.image) return;
    setSource({ dataUrl: shot.image, name: `${shot.label} (generated)`, width: 0, height: 0 });
    flash("This take is now the source for new shots. Fidelity is still judged against your original upload.");
  }

  function remove(shot: Shot) {
    setShots((prev) => prev.filter((s) => s.id !== shot.id));
    if (selectedId === shot.id) setSelectedId(null);
  }

  const actionCost = (kind: "edit" | "upscale" | "transform", model: string, size: string) => creditCost({ kind, model, size });

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <header className="z-20 shrink-0 border-b bg-white/85 backdrop-blur-md hairline">
        <div className="mx-auto flex h-14 max-w-[1680px] items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <span className="hidden h-5 w-px bg-[var(--line)] sm:block" />
            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              <span className="truncate text-[13px] text-[var(--muted)]">{me ? me.name : "Loading…"}</span>
              {me && <span className="badge">{me.planLabel}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {me?.demo && <span className="badge !bg-amber-50 !text-amber-800">Demo mode</span>}
            {me && <CreditMeter percentLeft={me.percentLeft} creditsLeft={me.creditsLeft} compact />}
            <form action="/api/logout" method="post">
              <button className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-zinc-100 hover:text-[var(--ink)]" title="Sign out" aria-label="Sign out">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-5 px-4 py-5 lg:min-h-0 lg:flex-row lg:items-stretch lg:overflow-hidden lg:px-6">
        <Controls me={me} source={source} onSource={onSource} settings={settings} onChange={changeSettings} onGenerate={generate} busy={busy} cost={cost} />
        <section id="gallery" className="scroll-quiet flex min-w-0 flex-1 flex-col lg:overflow-y-auto lg:pr-1">
          <Gallery
            shots={shots}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              scrollTo("detail");
            }}
            bestIds={bestIds}
          />
        </section>
        {selected && (
          <div id="detail" className="flex lg:contents">
            <Detail
              shot={selected}
              creditsLeft={me?.creditsLeft ?? 0}
              costOf={actionCost}
              onClose={() => setSelectedId(null)}
              onEdit={edit}
              onUpscale={upscale}
              onTransform={transform}
              onUseAsSource={useAsSource}
              onDelete={remove}
              onRescore={(s) => s.image && score(s.id, s.image, s.label)}
            />
          </div>
        )}
      </main>

      {toast && (
        <div className="rise fixed bottom-5 left-1/2 z-30 max-w-[92vw] -translate-x-1/2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-[12px] text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
