"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controls } from "./Controls";
import { Gallery } from "./Gallery";
import { Detail } from "./Detail";
import { Logo } from "./Logo";
import { CreditMeter } from "./CreditMeter";
import { ApiError, callDescribe, callGenerate, callJudge, callMe, fileToSource, uid } from "@/lib/client";
import { SHOT_TYPES, TRANSFORMS } from "@/lib/presets";
import { batchCost, creditCost } from "@/lib/plans";
import type { StyleDescription } from "@/lib/style";
import type { Me, Settings, Shot, SourceImage, StyleStatus } from "@/lib/types";

const DEFAULTS: Settings = {
  shotType: "flat-lay",
  angleId: SHOT_TYPES["flat-lay"].defaultAngle,
  lightingId: SHOT_TYPES["flat-lay"].defaultLighting,
  backgroundId: SHOT_TYPES["flat-lay"].defaultBackground,
  aspect: "4:5",
  extra: "",
  models: ["gemini-3.1-flash-image", "gemini-3-pro-image"],
  perModel: 2,
  size: "1K",
  styleOn: true,
};

export function Studio() {
  const [me, setMe] = useState<Me | null>(null);
  const [source, setSource] = useState<SourceImage | null>(null);
  const [original, setOriginal] = useState<SourceImage | null>(null); // first upload — ground truth for judging
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [style, setStyle] = useState<StyleDescription | null>(null);
  const [styleStatus, setStyleStatus] = useState<StyleStatus>("idle");
  const [styleError, setStyleError] = useState<string | null>(null);

  const batchRef = useRef(0);
  const describeSeq = useRef(0);

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
            angleId: preset.defaultAngle,
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
    () => batchCost(settings.shotType, settings.models, settings.perModel, settings.size),
    [settings.shotType, settings.models, settings.perModel, settings.size],
  );

  const bestId = useMemo(() => {
    const latest = Math.max(0, ...shots.map((s) => s.batch));
    const cands = shots.filter((s) => s.batch === latest && s.kind === "shot" && s.score);
    if (!cands.length) return null;
    return cands.reduce((a, b) => (b.score!.overall > a.score!.overall ? b : a)).id;
  }, [shots]);

  /* ---------------- style description ---------------- */

  const describe = useCallback(
    async (dataUrl: string) => {
      const seq = ++describeSeq.current;
      setStyleStatus("loading");
      setStyleError(null);
      try {
        const d = await callDescribe(dataUrl);
        if (seq !== describeSeq.current) return; // a newer photo won
        setStyle(d);
        setStyleStatus("ready");
      } catch (e) {
        if (seq !== describeSeq.current) return;
        setStyleError(e instanceof Error ? e.message : String(e));
        setStyleStatus("error");
      }
    },
    [],
  );

  async function onSource(f: File) {
    try {
      const src = await fileToSource(f);
      setSource(src);
      setOriginal(src);
      setStyle(null);
      setStyleStatus("idle");
      if (settings.styleOn) void describe(src.dataUrl);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  function changeSettings(p: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...p }));
    // Turning the description on with a photo already loaded should fill it in.
    if (p.styleOn === true && original && styleStatus === "idle") void describe(original.dataUrl);
  }

  function editStyle(key: keyof StyleDescription, value: string) {
    setStyle((s) => (s ? { ...s, [key]: value } : s));
  }

  const activeStyle = settings.styleOn && styleStatus === "ready" ? style : null;

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
      const r = await callGenerate({ ...body, style: activeStyle });
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
    const label = SHOT_TYPES[settings.shotType].label;
    const running: Promise<void>[] = [];
    for (const model of settings.models) {
      for (let i = 0; i < settings.perModel; i++) {
        const shot: Shot = {
          id: uid(),
          batch,
          kind: "shot",
          label,
          model,
          status: "loading",
          aspect: settings.aspect,
          size: settings.size,
          scoreStatus: "idle",
          createdAt: Date.now(),
        };
        running.push(run(shot, {
          mode: "shot",
          source: source.dataUrl,
          shotType: settings.shotType,
          angleId: settings.angleId,
          lightingId: settings.lightingId,
          backgroundId: settings.backgroundId,
          extra: settings.extra,
          model,
          aspect: settings.aspect,
          size: settings.size,
          seedHint: settings.perModel > 1 ? i + 1 : undefined,
        }));
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
      <header className="z-20 shrink-0 border-b bg-white/80 backdrop-blur hairline">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <Logo className="h-9 w-9" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold tracking-tight">Lumen Studio</span>
                {me && (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                    {me.planLabel}
                  </span>
                )}
              </div>
              <div className="truncate text-[11px] text-stone-500">{me ? me.name : "Loading account…"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {me?.demo && (
              <span className="hidden rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 sm:inline">
                Demo mode
              </span>
            )}
            {me && <CreditMeter percentLeft={me.percentLeft} creditsLeft={me.creditsLeft} compact />}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-5 px-4 py-5 lg:min-h-0 lg:flex-row lg:items-stretch lg:overflow-hidden lg:px-6">
        <Controls
          me={me}
          source={source}
          onSource={onSource}
          settings={settings}
          onChange={changeSettings}
          onGenerate={generate}
          busy={busy}
          cost={cost}
          styleStatus={styleStatus}
          style={style}
          styleError={styleError}
          onStyleChange={editStyle}
          onStyleRegenerate={() => original && describe(original.dataUrl)}
        />
        <section id="gallery" className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto lg:pr-1">
          <Gallery shots={shots} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); scrollTo("detail"); }} bestId={bestId} />
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
        <div className="rise fixed bottom-5 left-1/2 z-30 max-w-[92vw] -translate-x-1/2 rounded-full bg-stone-900 px-4 py-2.5 text-xs text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
