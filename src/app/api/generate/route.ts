import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import sharp from "sharp";
import { CLIENT_COOKIE, readClientId } from "@/lib/auth";
import { getClient, refundCredits, spendCredits } from "@/lib/store";
import { PLANS, creditCost, planAllows, planRequiredFor } from "@/lib/plans";
import {
  generateImage,
  parseDataUrl,
  styleBlock,
  toDataUrl,
  DEMO_MODE,
  type ImageInput,
  type StyleDescription,
} from "@/lib/gemini";
import {
  buildEditPrompt,
  buildPrompt,
  buildTransformPrompt,
  buildUpscalePrompt,
  MODELS,
  SHOT_TYPES,
  type ShotType,
} from "@/lib/presets";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  mode: "shot" | "edit" | "upscale" | "transform";
  source: string;
  reference?: string;
  model: string;
  aspect?: string;
  size?: "1K" | "2K" | "4K";
  style?: Partial<StyleDescription> | null;
  // shot
  shotType?: ShotType;
  angleId?: string;
  lightingId?: string;
  backgroundId?: string;
  extra?: string;
  seedHint?: number;
  // edit
  instruction?: string;
  // transform
  transformId?: string;
  detail?: string;
};

const ALLOWED_MODELS = new Set<string>(MODELS.map((m) => m.id));

export async function POST(req: Request) {
  const jar = await cookies();
  const clientId = await readClientId(jar.get(CLIENT_COOKIE)?.value);
  if (!clientId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!client.active) return NextResponse.json({ error: "This account is paused. Contact the studio owner." }, { status: 403 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body?.source) return NextResponse.json({ error: "Missing source image." }, { status: 400 });
  if (!ALLOWED_MODELS.has(body.model)) return NextResponse.json({ error: `Unknown model ${body.model}.` }, { status: 400 });

  // Plan gate — a shot type outside the plan never reaches Gemini.
  if (body.mode === "shot") {
    const shotType = body.shotType;
    if (!shotType || !SHOT_TYPES[shotType]) return NextResponse.json({ error: "Unknown shot type." }, { status: 400 });
    if (!planAllows(client.plan, shotType)) {
      const needed = planRequiredFor(shotType);
      return NextResponse.json(
        {
          error: `${SHOT_TYPES[shotType].label} isn't included in the ${PLANS[client.plan].label} plan.`,
          upgradeTo: needed,
          upgradeLabel: PLANS[needed].label,
        },
        { status: 403 },
      );
    }
  }

  const source = parseDataUrl(body.source);
  const reference = body.reference ? parseDataUrl(body.reference) : undefined;
  const style = styleBlock(body.style);

  let prompt: string;
  let references: ImageInput[];
  let aspect = body.aspect || "1:1";
  let size: "1K" | "2K" | "4K" = body.size ?? "1K";
  let actionLabel: string;

  switch (body.mode) {
    case "shot": {
      const shotType = body.shotType!;
      prompt = buildPrompt({
        shotType,
        angleId: body.angleId || "",
        lightingId: body.lightingId || "",
        backgroundId: body.backgroundId || "",
        extra: body.extra,
        style,
      });
      if (body.seedHint) {
        prompt += `\n\nVARIATION ${body.seedHint}: choose a slightly different but equally natural pose/arrangement, camera distance and micro-composition than other takes, while obeying every rule above.`;
      }
      references = [source];
      actionLabel = SHOT_TYPES[shotType].label;
      break;
    }
    case "edit": {
      if (!body.instruction?.trim()) return NextResponse.json({ error: "Missing edit instruction." }, { status: 400 });
      prompt = buildEditPrompt(body.instruction, style);
      references = reference ? [source, reference] : [source];
      if (reference) {
        prompt +=
          "\n\nThe FIRST image is the one to edit. The SECOND image is the original product photo — use it only as ground truth for the garment's colour, print, labels and trims.";
      }
      actionLabel = `Edit: ${body.instruction.trim().slice(0, 40)}`;
      break;
    }
    case "upscale": {
      prompt = buildUpscalePrompt();
      if (style) prompt += `\n\n${style}`;
      references = reference ? [source, reference] : [source];
      if (reference) {
        prompt += "\n\nThe FIRST image is the one to upscale. The SECOND image is the original product photo for texture and colour ground truth.";
      }
      size = body.size ?? "2K";
      aspect = await detectAspect(source);
      actionLabel = `Upscale ${size}`;
      break;
    }
    case "transform": {
      prompt = buildTransformPrompt(body.transformId || "", body.detail ?? "", style);
      references = reference ? [source, reference] : [source];
      if (reference) prompt += "\n\nThe FIRST image is the one to transform. The SECOND image is the original product photo for fidelity.";
      actionLabel = `Transform${body.detail ? `: ${body.detail.slice(0, 30)}` : ""}`;
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
  }

  // Nano Banana 2 does not do 4K; fall back to 2K silently — and price it as 2K.
  if (size === "4K" && body.model === "gemini-3.1-flash-image") size = "2K";

  const cost = creditCost({ kind: body.mode, shotType: body.shotType, model: body.model, size });

  const spend = await spendCredits(clientId, cost, { action: actionLabel, model: body.model });
  if (!spend.ok) {
    if (spend.reason === "insufficient") {
      return NextResponse.json(
        {
          error: "Not enough credits left for this shot.",
          outOfCredits: true,
          creditsLeft: spend.creditsLeft ?? 0,
          needed: spend.needed ?? cost,
        },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "This account can't generate right now." }, { status: 403 });
  }

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
      credits: {
        spent: cost,
        left: spend.client.creditsLeft,
        percentLeft: spend.client.percentLeft,
      },
    });
  } catch (e) {
    await refundCredits(clientId, cost); // never charge for a failed generation
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generate]", body.mode, body.model, msg);
    const after = await getClient(clientId);
    return NextResponse.json(
      {
        error: msg,
        credits: after ? { spent: 0, left: after.creditsLeft, percentLeft: after.percentLeft } : undefined,
      },
      { status: 502 },
    );
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
