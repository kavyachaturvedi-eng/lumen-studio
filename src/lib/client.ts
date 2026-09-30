// Browser-side helpers: image compression + API calls.
import type { JudgeScore } from "./gemini";
import type { Me, SourceImage } from "./types";

/**
 * Vercel rejects any request body over 4.5 MB with HTTP 413 before our code
 * runs. Images travel as base64 inside JSON, so every image we send is
 * re-encoded as a JPEG at a sensible size first, and the whole body is kept
 * under this budget.
 */
const REQUEST_BUDGET = 4_000_000;

/** Draw an image onto a canvas at ≤ maxEdge px and return a JPEG data URL. */
function encode(img: HTMLImageElement, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // flatten transparency (PNG cut-outs etc.)
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { dataUrl: canvas.toDataURL("image/jpeg", quality), w, h };
}

/** Downscale an upload to ≤ maxEdge px JPEG so it is small enough to send with anything else. */
export async function fileToSource(file: File, maxEdge = 1600): Promise<SourceImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { dataUrl, w, h } = encode(img, maxEdge, 0.9);
    return { dataUrl, name: file.name, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const shrinkCache = new Map<string, string>();

/**
 * Shrink an image data URL (e.g. a 4K take being edited or recoloured) to
 * ≤ maxEdge px JPEG. SVG demo images pass through untouched.
 */
export async function shrink(dataUrl: string, maxEdge = 2048, quality = 0.9): Promise<string> {
  if (dataUrl.startsWith("data:image/svg")) return dataUrl;
  const key = `${maxEdge}:${quality}:${dataUrl.length}:${dataUrl.slice(-64)}`;
  const hit = shrinkCache.get(key);
  if (hit) return hit;
  const img = await loadImage(dataUrl);
  const small = img.naturalWidth <= maxEdge && img.naturalHeight <= maxEdge && dataUrl.startsWith("data:image/jpeg") && dataUrl.length < 1_600_000;
  const out = small ? dataUrl : encode(img, maxEdge, quality).dataUrl;
  if (shrinkCache.size > 40) shrinkCache.clear();
  shrinkCache.set(key, out);
  return out;
}

/** Shrink every image field in a request body until the JSON fits Vercel's limit. */
async function fitBody(body: Record<string, unknown>, fields: string[]): Promise<string> {
  const steps: Array<[number, number]> = [
    [2048, 0.9],
    [1600, 0.86],
    [1280, 0.82],
    [1024, 0.78],
  ];
  const b = { ...body };
  for (const [edge, q] of steps) {
    for (const f of fields) if (typeof b[f] === "string") b[f] = await shrink(b[f] as string, edge, q);
    const json = JSON.stringify(b);
    if (json.length <= REQUEST_BUDGET) return json;
  }
  return JSON.stringify(b);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Could not read image"));
    img.src = src;
  });
}

export interface CreditsInfo {
  spent: number;
  left: number;
  percentLeft: number;
}

export interface GenerateResult {
  image: string;
  model: string;
  prompt: string;
  text?: string;
  demo: boolean;
  size: string;
  aspect: string;
  credits?: CreditsInfo;
}

/** Errors that carry extra context the UI reacts to (upgrade prompt, out of credits). */
export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function httpError(status: number) {
  if (status === 413) return "This image is too large to send. Try a smaller take or re-upload the photo.";
  if (status === 504) return "The model took too long to answer. Nothing was charged — try again.";
  return `Request failed (HTTP ${status}).`;
}

export async function callGenerate(body: Record<string, unknown>): Promise<GenerateResult> {
  const json = await fitBody(body, ["source", "reference"]);
  const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: json });
  const data = await res.json().catch(() => ({ error: httpError(res.status) }));
  if (!res.ok) throw new ApiError(data.error || httpError(res.status), res.status, data);
  return data as GenerateResult;
}

export async function callMe(): Promise<Me> {
  const res = await fetch("/api/me");
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as Me;
}

export async function callJudge(source: string, candidate: string, shotLabel: string): Promise<{ score: JudgeScore; demo: boolean }> {
  // The judge only needs to see the garment clearly — 1280px is plenty and keeps the call small.
  const body = JSON.stringify({ source: await shrink(source, 1280, 0.85), candidate: await shrink(candidate, 1280, 0.85), shotLabel });
  const res = await fetch("/api/judge", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  const data = await res.json().catch(() => ({ error: httpError(res.status) }));
  if (!res.ok) throw new Error(data.error || httpError(res.status));
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
