// Subscription plans and the credit price list.
//
// Credits are an abstract unit shown to clients. They are calibrated so that
// 1 credit costs you roughly ₹6 or less of real Gemini spend at Sept-2026 prices
// (Nano Banana 2 @1K ≈ ₹5.9, Nano Banana Pro @1K ≈ ₹11.8 = 2 credits).
// Heavier work is priced above its true cost, so your margin never inverts.
// Clients never see currency — only credits and a percentage remaining.

import type { ShotType } from "./presets";

export type PlanId = "basic" | "pro" | "max";

export interface Plan {
  id: PlanId;
  label: string;
  blurb: string;
  /** Shot types unlocked. Cumulative: pro includes basic, max includes pro. */
  shotTypes: ShotType[];
  /** Credits granted when this plan is assigned or renewed. Editable per client in admin. */
  credits: number;
}

const BASIC_SHOTS: ShotType[] = ["flat-lay", "ghost-mannequin"];
const PRO_SHOTS: ShotType[] = [...BASIC_SHOTS, "hero", "detail"];
const MAX_SHOTS: ShotType[] = [...PRO_SHOTS, "lifestyle", "packshot"];

export const PLANS: Record<PlanId, Plan> = {
  basic: {
    id: "basic",
    label: "Basic",
    blurb: "Flat lays and ghost mannequin — the everyday catalog shots.",
    shotTypes: BASIC_SHOTS,
    credits: 300,
  },
  pro: {
    id: "pro",
    label: "Pro",
    blurb: "Everything in Basic, plus hero and macro detail shots.",
    shotTypes: PRO_SHOTS,
    credits: 900,
  },
  max: {
    id: "max",
    label: "Max",
    blurb: "Everything in Pro, plus lifestyle scenes and packshots.",
    shotTypes: MAX_SHOTS,
    credits: 2500,
  },
};

export const PLAN_ORDER: PlanId[] = ["basic", "pro", "max"];

export function isPlanId(v: unknown): v is PlanId {
  return v === "basic" || v === "pro" || v === "max";
}

export function planAllows(plan: PlanId, shotType: ShotType): boolean {
  return PLANS[plan].shotTypes.includes(shotType);
}

/** The cheapest plan that unlocks a given shot type — used for the upgrade hint. */
export function planRequiredFor(shotType: ShotType): PlanId {
  for (const id of PLAN_ORDER) if (PLANS[id].shotTypes.includes(shotType)) return id;
  return "max";
}

/* ---------------- Credit price list ---------------- */

/** Base credit cost of one generated image, before model and resolution multipliers. */
const SHOT_BASE: Record<ShotType, number> = {
  "flat-lay": 1,
  "ghost-mannequin": 1,
  hero: 2,
  detail: 2,
  lifestyle: 2,
  packshot: 2,
};

const MODEL_MULTIPLIER: Record<string, number> = {
  "gemini-3.1-flash-image": 1,
  "gemini-3-pro-image": 2,
};

const SIZE_MULTIPLIER: Record<string, number> = {
  "1K": 1,
  "2K": 2,
  "4K": 3,
};

/** Base cost for the non-shot actions. */
const ACTION_BASE = {
  edit: 1,
  upscale: 2,
  transform: 1,
} as const;

export interface CostInput {
  kind: "shot" | "edit" | "upscale" | "transform";
  shotType?: ShotType;
  model: string;
  size: string;
}

/** Credits one action will cost. Always at least 1. */
export function creditCost(input: CostInput): number {
  const base =
    input.kind === "shot"
      ? (input.shotType ? SHOT_BASE[input.shotType] : 1)
      : ACTION_BASE[input.kind];
  const m = MODEL_MULTIPLIER[input.model] ?? 1;
  const s = SIZE_MULTIPLIER[input.size] ?? 1;
  return Math.max(1, Math.ceil(base * m * s));
}

/** Total credits a whole generate batch will cost, for the "this run costs N" hint. */
export function batchCost(shotType: ShotType, models: string[], perModel: number, size: string): number {
  return models.reduce((sum, model) => sum + creditCost({ kind: "shot", shotType, model, size }) * perModel, 0);
}

/** Human-readable price list for the admin panel and client help text. */
export const PRICE_LIST: Array<{ label: string; credits: string }> = [
  { label: "Flat lay / ghost mannequin", credits: "1 per take" },
  { label: "Hero / detail / lifestyle / packshot", credits: "2 per take" },
  { label: "Nano Banana Pro instead of Nano Banana 2", credits: "×2" },
  { label: "2K output", credits: "×2" },
  { label: "4K output", credits: "×3" },
  { label: "Edit by prompt", credits: "1" },
  { label: "Transform", credits: "1" },
  { label: "Upscale", credits: "2 (×2 at 2K, ×3 at 4K)" },
  { label: "Style description", credits: "free" },
];
