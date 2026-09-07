import type { JudgeScore } from "./gemini";
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
}
