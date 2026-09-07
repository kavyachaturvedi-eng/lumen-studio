"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Controls } from "./Controls";
import { Gallery } from "./Gallery";
import { Detail } from "./Detail";
import { Logo } from "./Logo";
import { callGenerate, callJudge, fileToSource, uid } from "@/lib/client";
import { SHOT_TYPES, TRANSFORMS } from "@/lib/presets";
import type { Settings, Shot, SourceImage } from "@/lib/types";

const DEFAULTS: Settings = {
  shotType: "packshot",
  angleId: SHOT_TYPES.packshot.defaultAngle,
  lightingId: SHOT_TYPES.packshot.defaultLighting,
  backgroundId: SHOT_TYPES.packshot.defaultBackground,
  aspect: "4:5",
  extra: "",
  models: ["gemini-3.1-flash-image", "gemini-3-pro-image"],
  perModel: 2,
  size: "1K",
};

export function Studio() {
  const [source, setSource] = useState<SourceImage | null>(null);
  const [original, setOriginal] = useState<SourceImage | null>(null); // the very first upload — ground truth for judging
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const batchRef = useRef(0);

  const patch = useCallback((p: Partial<Shot> & { id: string }) => {
    setShots((prev) => prev.map((s) => (s.id === p.id ? { ...s, ...p } : s)));
  }, []);

  const busy = shots.some((s) => s.status === "loading");
  const selected = shots.find((s) => s.id === selectedId) ?? null;

  const bestId = useMemo(() => {
    const latest = Math.max(0, ...shots.map((s) => s.batch));
    const cands = shots.filter(
      (s) => s.batch === latest && s.kind === "shot" && s.score,
    );
    if (!cands.length) return null;
    return cands.reduce((a, b) => (b.score!.overall > a.score!.overall ? b : a))
      .id;
  }, [shots]);

  async function onSource(f: File) {
    try {
      const src = await fileToSource(f);
      setSource(src);
      setOriginal(src);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  /** Score a finished shot against the original upload. */
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

  /** Fire one generation request and manage its shot's lifecycle. */
  async function run(shot: Shot, body: Record<string, unknown>) {
    setShots((prev) => [shot, ...prev]);
    try {
      const r = await callGenerate(body);
      setDemo(r.demo);
      patch({
        id: shot.id,
        status: "done",
        image: r.image,
        prompt: r.prompt,
        size: r.size,
        aspect: r.aspect,
        demo: r.demo,
      });
      void score(shot.id, r.image, shot.label);
    } catch (e) {
      patch({
        id: shot.id,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function generate() {
    if (!source) return;
    const batch = ++batchRef.current;
    const label = SHOT_TYPES[settings.shotType].label;
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
        void run(shot, {
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
        });
      }
    }
    setSelectedId(null);
    scrollTo("gallery");
  }

  function scrollTo(id: string) {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setTimeout(
        () =>
          document
            .getElementById(id)
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        50,
      );
    }
  }

  function edit(parent: Shot, instruction: string, model: string) {
    if (!parent.image) return;
    const shot: Shot = {
      id: uid(),
      batch: parent.batch,
      kind: "edit",
      label: `Edit: ${instruction.slice(0, 40)}`,
      model,
      status: "loading",
      aspect: parent.aspect,
      size: parent.size,
      parentId: parent.id,
      scoreStatus: "idle",
      createdAt: Date.now(),
    };
    setSelectedId(shot.id);
    void run(shot, {
      mode: "edit",
      source: parent.image,
      reference: original?.dataUrl,
      instruction,
      model,
      aspect: parent.aspect,
      size: parent.size === "2K" ? "2K" : "1K",
    });
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
    void run(shot, {
      mode: "upscale",
      source: parent.image,
      reference: original?.dataUrl,
      model,
      size,
    });
  }

  function transform(
    parent: Shot,
    transformId: string,
    detail: string,
    model: string,
  ) {
    if (!parent.image) return;
    const t = TRANSFORMS.find((x) => x.id === transformId);
    const aspect =
      transformId === "social" && detail.match(/\d+:\d+/)
        ? detail.match(/\d+:\d+/)![0]
        : parent.aspect;
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
    void run(shot, {
      mode: "transform",
      source: parent.image,
      reference: original?.dataUrl,
      transformId,
      detail,
      model,
      aspect,
    });
  }

  function useAsSource(shot: Shot) {
    if (!shot.image) return;
    setSource({
      dataUrl: shot.image,
      name: `${shot.label} (generated)`,
      width: 0,
      height: 0,
    });
    setToast(
      "This take is now the source for new shots. Fidelity is still judged against your original upload.",
    );
    setTimeout(() => setToast(null), 4000);
  }

  function remove(shot: Shot) {
    setShots((prev) => prev.filter((s) => s.id !== shot.id));
    if (selectedId === shot.id) setSelectedId(null);
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <header className="z-20 shrink-0 border-b border-stone-200 bg-stone-50">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8" />
            <div>
              <div className="text-sm font-semibold tracking-tight">
                Lumen Studio
              </div>
              <div className="hidden text-[11px] text-stone-500 sm:block">
                One product photo → listing-ready shots that keep your label and
                finish
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {demo && (
              <span
                className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800"
                title="Set GEMINI_API_KEY to generate real images"
              >
                Demo mode — no API key
              </span>
            )}
            <span className="hidden rounded-full bg-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-700 sm:inline">
              {shots.filter((s) => s.status === "done").length} shots this
              session
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-4 py-6 lg:min-h-0 lg:flex-row lg:items-stretch lg:overflow-hidden lg:px-6">
        <Controls
          source={source}
          onSource={onSource}
          settings={settings}
          onChange={(p) => setSettings((s) => ({ ...s, ...p }))}
          onGenerate={generate}
          busy={busy}
        />
        <section
          id="gallery"
          className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto lg:pr-1"
        >
          <Gallery
            shots={shots}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              scrollTo("detail");
            }}
            bestId={bestId}
          />
        </section>
        {selected && (
          <div id="detail" className="flex lg:contents">
            <Detail
              shot={selected}
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
        <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-stone-900 px-4 py-2 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
