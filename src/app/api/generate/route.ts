import { NextResponse } from "next/server";
import sharp from "sharp";
import { generateImage, parseDataUrl, toDataUrl, DEMO_MODE, type ImageInput } from "@/lib/gemini";
import {
  buildEditPrompt,
  buildPrompt,
  buildTransformPrompt,
  buildUpscalePrompt,
  MODELS,
  type ShotType,
} from "@/lib/presets";

export const runtime = "nodejs";
export const maxDuration = 300; // Pro model at 4K can take a while. Vercel Hobby allows up to 300s with Fluid Compute.

type Body =
  | {
      mode: "shot";
      source: string;
      shotType: ShotType;
      angleId: string;
      lightingId: string;
      backgroundId: string;
      extra?: string;
      model: string;
      aspect: string;
      size?: "1K" | "2K" | "4K";
      seedHint?: number; // lets the client ask for visibly different candidates
    }
  | { mode: "edit"; source: string; reference?: string; instruction: string; model: string; aspect: string; size?: "1K" | "2K" | "4K" }
  | { mode: "upscale"; source: string; reference?: string; model: string; size: "2K" | "4K" }
  | { mode: "transform"; source: string; reference?: string; transformId: string; detail?: string; model: string; aspect: string };

const ALLOWED_MODELS = new Set<string>(MODELS.map((m) => m.id));

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body?.source) return NextResponse.json({ error: "Missing source image." }, { status: 400 });
  if (!ALLOWED_MODELS.has(body.model)) return NextResponse.json({ error: `Unknown model ${body.model}.` }, { status: 400 });

  const source = parseDataUrl(body.source);
  const reference = "reference" in body && body.reference ? parseDataUrl(body.reference) : undefined;

  let prompt: string;
  let references: ImageInput[];
  let aspect = "1:1";
  let size: "1K" | "2K" | "4K" = "1K";

  switch (body.mode) {
    case "shot": {
      prompt = buildPrompt({
        shotType: body.shotType,
        angleId: body.angleId,
        lightingId: body.lightingId,
        backgroundId: body.backgroundId,
        extra: body.extra,
      });
      if (body.seedHint) {
        prompt += `\n\nVARIATION ${body.seedHint}: choose a slightly different but equally natural pose/arrangement, camera distance and micro-composition than other takes, while obeying every rule above.`;
      }
      references = [source];
      aspect = body.aspect;
      size = body.size ?? "1K";
      break;
    }
    case "edit": {
      if (!body.instruction?.trim()) return NextResponse.json({ error: "Missing edit instruction." }, { status: 400 });
      prompt = buildEditPrompt(body.instruction);
      references = reference
        ? [source, reference]
        : [source];
      if (reference) prompt += "\n\nThe FIRST image is the one to edit. The SECOND image is the original product photo — use it only as ground truth for the garment's colour, print, labels and trims.";
      aspect = body.aspect;
      size = body.size ?? "1K";
      break;
    }
    case "upscale": {
      prompt = buildUpscalePrompt();
      references = reference ? [source, reference] : [source];
      if (reference) prompt += "\n\nThe FIRST image is the one to upscale. The SECOND image is the original product photo for texture and colour ground truth.";
      size = body.size;
      aspect = await detectAspect(source);
      break;
    }
    case "transform": {
      prompt = buildTransformPrompt(body.transformId, body.detail ?? "");
      references = reference ? [source, reference] : [source];
      if (reference) prompt += "\n\nThe FIRST image is the one to transform. The SECOND image is the original product photo for fidelity.";
      aspect = body.aspect;
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
  }

  // Nano Banana 2 does not do 4K; fall back to 2K silently.
  if (size === "4K" && body.model === "gemini-3.1-flash-image") size = "2K";

  try {
    const out = await generateImage({ model: body.model, prompt, references, aspect, size });
    const compact = await compress(out);
    return NextResponse.json({
      image: toDataUrl(compact),
      model: out.model,
      prompt,
      text: out.text,
      demo: DEMO_MODE,
      size,
      aspect,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generate]", body.mode, body.model, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** Re-encode model output as JPEG so responses stay under serverless size limits. */
async function compress(img: ImageInput): Promise<ImageInput> {
  if (img.mimeType === "image/svg+xml") return img; // demo
  try {
    const buf = Buffer.from(img.data, "base64");
    const meta = await sharp(buf).metadata();
    const big = (meta.width ?? 0) * (meta.height ?? 0) > 2200 * 2200;
    const jpeg = await sharp(buf).jpeg({ quality: big ? 86 : 92, mozjpeg: true }).toBuffer();
    return { mimeType: "image/jpeg", data: jpeg.toString("base64") };
  } catch {
    return img;
  }
}

async function detectAspect(img: ImageInput): Promise<string> {
  if (img.mimeType === "image/svg+xml") return "1:1";
  try {
    const meta = await sharp(Buffer.from(img.data, "base64")).metadata();
    const r = (meta.width ?? 1) / (meta.height ?? 1);
    const table: Array<[string, number]> = [
      ["1:1", 1],
      ["4:5", 0.8],
      ["3:4", 0.75],
      ["2:3", 0.667],
      ["9:16", 0.5625],
      ["5:4", 1.25],
      ["4:3", 1.333],
      ["3:2", 1.5],
      ["16:9", 1.778],
    ];
    return table.reduce((best, cur) => (Math.abs(cur[1] - r) < Math.abs(best[1] - r) ? cur : best))[0];
  } catch {
    return "1:1";
  }
}
