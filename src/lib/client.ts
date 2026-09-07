// Browser-side helpers: image compression + API calls.
import type { JudgeScore } from "./gemini";
import type { SourceImage } from "./types";

/** Downscale to ≤ maxEdge px and encode as JPEG so uploads stay small (Gemini wants ≲ 7MB inline). */
export async function fileToSource(file: File, maxEdge = 1600): Promise<SourceImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // flatten transparency (PNG logos etc.)
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const isPngWithAlpha = file.type === "image/png";
    const dataUrl = isPngWithAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.92);
    return { dataUrl, name: file.name, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Could not read image"));
    img.src = src;
  });
}

export interface GenerateResult {
  image: string;
  model: string;
  prompt: string;
  text?: string;
  demo: boolean;
  size: string;
  aspect: string;
}

export async function callGenerate(body: Record<string, unknown>): Promise<GenerateResult> {
  const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as GenerateResult;
}

export async function callJudge(source: string, candidate: string, shotLabel: string): Promise<{ score: JudgeScore; demo: boolean }> {
  const res = await fetch("/api/judge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, candidate, shotLabel }) });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
