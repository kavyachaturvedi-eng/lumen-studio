import { GoogleGenAI } from "@google/genai";
import type { Aspect } from "./presets";

export interface ImageInput {
  mimeType: string;
  data: string; // base64 without data: prefix
}

export interface GeneratedImage extends ImageInput {
  model: string;
  text?: string; // any commentary the model returned
}

export interface JudgeScore {
  label: number; // 0-10 text / logo / print fidelity
  colour: number; // 0-10 colour & finish fidelity
  shape: number; // 0-10 cut / proportions / trims preserved
  realism: number; // 0-10 natural, believable photography
  overall: number; // 0-100 weighted
  verdict: "keep" | "review" | "reject";
  notes: string;
}

export const DEMO_MODE = !process.env.GEMINI_API_KEY && !process.env.GOOGLE_CLOUD_PROJECT;

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (client) return client;
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    // Vertex AI path: uses Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS / gcloud auth).
    client = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || "global",
    });
  } else {
    // Gemini Developer API path (AI Studio key). Simplest for Vercel.
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

export const JUDGE_MODEL = process.env.JUDGE_MODEL || "gemini-2.5-flash";

/** Strip a data URL into {mimeType, data}. Accepts raw base64 too. */
export function parseDataUrl(src: string): ImageInput {
  const m = src.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (m) return { mimeType: m[1], data: m[2] };
  return { mimeType: "image/png", data: src };
}

export function toDataUrl(img: ImageInput): string {
  return `data:${img.mimeType};base64,${img.data}`;
}

/**
 * Generate ONE image with a Gemini image model from a prompt + reference images.
 * Throws on API failure so the route can report it per-candidate.
 */
export async function generateImage(opts: {
  model: string;
  prompt: string;
  references: ImageInput[];
  aspect?: Aspect | string;
  size?: "1K" | "2K" | "4K";
}): Promise<GeneratedImage> {
  if (DEMO_MODE) return demoImage(opts.model, opts.prompt, opts.aspect);

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: opts.prompt },
    ...opts.references.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.data } })),
  ];

  const res = await ai().models.generateContent({
    model: opts.model,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: {
        aspectRatio: opts.aspect || "1:1",
        imageSize: opts.size || "1K",
      },
    },
  });

  let text = "";
  for (const cand of res.candidates ?? []) {
    for (const p of cand.content?.parts ?? []) {
      if (p.inlineData?.data) {
        return {
          model: opts.model,
          mimeType: p.inlineData.mimeType || "image/png",
          data: p.inlineData.data,
          text: text || undefined,
        };
      }
      if (p.text) text += p.text;
    }
  }
  throw new Error(
    `Model ${opts.model} returned no image${text ? `: ${text.slice(0, 200)}` : ""}${
      res.promptFeedback?.blockReason ? ` (blocked: ${res.promptFeedback.blockReason})` : ""
    }`,
  );
}

/**
 * Score a candidate against the source photo for product fidelity.
 * Uses a cheap multimodal Gemini model and asks for strict JSON.
 */
export async function judgeCandidate(source: ImageInput, candidate: ImageInput, shotLabel: string): Promise<JudgeScore> {
  if (DEMO_MODE) return demoScore();

  const prompt = `You are a meticulous e-commerce QA reviewer for fashion product imagery.
Image 1 is the REFERENCE photo of the real garment. Image 2 is an AI-generated "${shotLabel}" of the same garment.
Compare Image 2 to Image 1 and score how faithfully the PRODUCT is preserved. Be strict — marketplaces reject listings whose images misrepresent the item.

Score 0–10 for each:
- label: text, logos, brand marks, prints and patterns — identical wording, placement and scale? Invented or altered text must score ≤ 3.
- colour: hue, saturation, fabric finish (matte/gloss/sheen), weave visibility.
- shape: cut, length, neckline, sleeves, buttons/zips/trims, proportions — nothing added, removed or resized.
- realism: natural photography, believable physics of light/shadow/drape, no AI artefacts, no over-smoothing.

Return ONLY JSON in this exact shape, no markdown:
{"label":n,"colour":n,"shape":n,"realism":n,"verdict":"keep|review|reject","notes":"one or two short sentences naming the biggest deviation, or 'Faithful.'"}`;

  const res = await ai().models.generateContent({
    model: JUDGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: source.mimeType, data: source.data } },
          { inlineData: { mimeType: candidate.mimeType, data: candidate.data } },
        ],
      },
    ],
    config: { responseMimeType: "application/json", temperature: 0.1 },
  });

  const raw = res.text ?? "{}";
  let parsed: Partial<JudgeScore> = {};
  try {
    parsed = JSON.parse(raw.replace(/^```json|```$/g, "").trim());
  } catch {
    parsed = { notes: "Judge returned unparseable output." };
  }
  const clamp = (n: unknown) => Math.max(0, Math.min(10, Number(n) || 0));
  const s = {
    label: clamp(parsed.label),
    colour: clamp(parsed.colour),
    shape: clamp(parsed.shape),
    realism: clamp(parsed.realism),
  };
  // Weighted: fidelity matters more than prettiness.
  const overall = Math.round((s.label * 0.35 + s.colour * 0.25 + s.shape * 0.25 + s.realism * 0.15) * 10);
  const verdict: JudgeScore["verdict"] =
    parsed.verdict === "keep" || parsed.verdict === "review" || parsed.verdict === "reject"
      ? parsed.verdict
      : overall >= 80
        ? "keep"
        : overall >= 60
          ? "review"
          : "reject";
  return { ...s, overall, verdict, notes: String(parsed.notes ?? "").slice(0, 300) };
}

/* ---------------- Demo mode (no API key) ---------------- */

function demoImage(model: string, prompt: string, aspect?: string): Promise<GeneratedImage> {
  const [aw, ah] = (aspect || "1:1").split(":").map(Number);
  const w = 1024;
  const h = Math.round((w * ah) / aw);
  const hue = (hash(prompt + model) % 360) | 0;
  const title = model.includes("pro") ? "Nano Banana Pro" : "Nano Banana 2";
  const firstLine = prompt.split("\n")[0].slice(0, 70);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue},40%,92%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},45%,78%)"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <ellipse cx="${w / 2}" cy="${h * 0.78}" rx="${w * 0.22}" ry="${h * 0.03}" fill="rgba(0,0,0,0.12)"/>
  <path d="M ${w * 0.35} ${h * 0.3} l ${w * 0.08} -${h * 0.06} h ${w * 0.14} l ${w * 0.08} ${h * 0.06} l ${w * 0.05} ${h * 0.1} l -${w * 0.06} ${h * 0.03} v ${h * 0.32} h -${w * 0.28} v -${h * 0.32} l -${w * 0.06} -${h * 0.03} z" fill="hsl(${hue},55%,45%)" stroke="rgba(0,0,0,0.15)" stroke-width="4"/>
  <text x="${w / 2}" y="${h * 0.9}" font-family="Helvetica, Arial, sans-serif" font-size="34" text-anchor="middle" fill="#333">DEMO — ${title}</text>
  <text x="${w / 2}" y="${h * 0.945}" font-family="Helvetica, Arial, sans-serif" font-size="22" text-anchor="middle" fill="#555">${escapeXml(firstLine)}…</text>
</svg>`;
  return new Promise((r) =>
    setTimeout(
      () => r({ model, mimeType: "image/svg+xml", data: Buffer.from(svg).toString("base64"), text: "Demo image — add GEMINI_API_KEY to generate real shots." }),
      600 + Math.random() * 900,
    ),
  );
}

function demoScore(): Promise<JudgeScore> {
  const r = () => 6 + Math.round(Math.random() * 4);
  const s = { label: r(), colour: r(), shape: r(), realism: r() };
  const overall = Math.round((s.label * 0.35 + s.colour * 0.25 + s.shape * 0.25 + s.realism * 0.15) * 10);
  return new Promise((res) =>
    setTimeout(
      () =>
        res({
          ...s,
          overall,
          verdict: overall >= 80 ? "keep" : overall >= 60 ? "review" : "reject",
          notes: "Demo score — add GEMINI_API_KEY for a real fidelity review.",
        }),
      300,
    ),
  );
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}
function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}
