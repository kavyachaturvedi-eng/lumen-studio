import type { JudgeScore, StyleDescription } from "./gemini";
import type { PlanId } from "./plans";
import type { ShotType } from "./presets";

export type ShotKind = "shot" | "edit" | "upscale" | "transform";

export interface Shot {
  id: string;
  batch: number;
  kind: ShotKind;
  label: string; // e.g. "Ghost mannequin", "Edit: brighter", "Upscale 4K"
  model: string;
  status: "loading" | "done" | "error";
  image?: string; // data URL
  prompt?: string;
  error?: string;
  aspect: string;
  size: string;
  parentId?: string;
  score?: JudgeScore;
  scoreStatus: "idle" | "loading" | "done" | "error";
  demo?: boolean;
  credits?: number;
  createdAt: number;
}

export interface SourceImage {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
}

export interface Settings {
  shotType: ShotType;
  angleId: string;
  lightingId: string;
  backgroundId: string;
  aspect: string;
  extra: string;
  models: string[];
  perModel: number;
  size: "1K" | "2K";
  /** Whether the style description is generated and fed into prompts. */
  styleOn: boolean;
}

/** The signed-in client, as the studio sees them. No currency, ever. */
export interface Me {
  name: string;
  plan: PlanId;
  planLabel: string;
  shotTypes: ShotType[];
  creditsLeft: number;
  creditsTotal: number;
  percentLeft: number;
  active: boolean;
  demo: boolean;
}

export type StyleDraft = StyleDescription;

export type StyleStatus = "idle" | "loading" | "ready" | "error";
