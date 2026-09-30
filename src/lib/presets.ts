// Shot vocabulary for Lumen Studio.
// Everything the UI offers as a chip lives here so it is easy to tune per client.

export type ShotType =
  | "packshot"
  | "ghost-mannequin"
  | "flat-lay"
  | "lifestyle"
  | "hero"
  | "detail";

export interface Option {
  id: string;
  label: string;
  hint: string; // shown in UI
  prompt: string; // injected into the generation prompt
}

export const SHOT_TYPES: Record<
  ShotType,
  { label: string; blurb: string; prompt: string; defaultAngle: string; defaultBackground: string; defaultLighting: string }
> = {
  "flat-lay": {
    label: "Flat lay",
    blurb: "Top-down, folded or styled on a surface.",
    prompt:
      "Flat-lay product photograph of the exact garment from the reference photo laid out neatly on a surface, photographed from directly above. Sleeves and hem arranged with intention, gentle natural folds, fabric texture clearly visible. Optional minimal styling props kept small and out of the way of the garment.",
    defaultAngle: "top-down",
    defaultBackground: "linen-neutral",
    defaultLighting: "window-daylight",
  },
  "ghost-mannequin": {
    label: "Ghost mannequin",
    blurb: "Invisible-mannequin look: 3D shape, no model, no stand.",
    prompt:
      "Ghost mannequin (invisible mannequin) product photograph of the exact garment from the reference photo. The garment holds a natural three-dimensional worn shape as if on an invisible body, with the inner back neckline visible through the collar opening, sleeves gently filled, hem hanging naturally. Absolutely no mannequin, stand, hanger, or person visible. Studio backdrop, soft contact shadow.",
    defaultAngle: "front-straight",
    defaultBackground: "seamless-white",
    defaultLighting: "softbox-even",
  },
  hero: {
    label: "Hero",
    blurb: "Dramatic campaign image for banners and ads.",
    prompt:
      "Hero campaign photograph of the exact garment from the reference photo, styled as a premium fashion advertisement. Strong composition with negative space suitable for headline copy, dramatic but flattering light, rich material rendering. The garment must remain exactly as in the reference: same colour, same print placement, same trims.",
    defaultAngle: "low-angle",
    defaultBackground: "studio-gradient",
    defaultLighting: "rim-dramatic",
  },
  detail: {
    label: "Detail / macro",
    blurb: "Close-up of fabric, print, stitching or trims.",
    prompt:
      "Macro detail photograph of the exact garment from the reference photo, filling the frame with fabric weave, stitching, print or trim detail. Shallow depth of field, tack-sharp focus on the texture, faithful colour and finish.",
    defaultAngle: "macro-45",
    defaultBackground: "seamless-white",
    defaultLighting: "raking-texture",
  },
  lifestyle: {
    label: "Lifestyle",
    blurb: "Worn in a real-world scene by a model.",
    prompt:
      "Editorial lifestyle photograph of a model wearing the exact garment from the reference photo in a believable real-world setting. The garment fits naturally with realistic drape and creasing, and its colour, print, trims and construction match the reference exactly. Candid, unforced pose; the garment stays the clear focal point. No readable signage or text anywhere in the scene.",
    defaultAngle: "three-quarter",
    defaultBackground: "urban-street",
    defaultLighting: "golden-hour",
  },
  packshot: {
    label: "Packshot",
    blurb: "Clean e-commerce shot on seamless white or grey.",
    prompt:
      "Clean e-commerce packshot of the exact garment from the reference photo. The garment is the only subject, centred, fully in frame with even margins, wrinkle-free and neatly presented. Seamless studio backdrop with a soft natural contact shadow so the garment never appears to float. No props, no people, no text.",
    defaultAngle: "front-straight",
    defaultBackground: "seamless-white",
    defaultLighting: "softbox-even",
  },
};

/** How many camera angles one run may shoot. Each angle gets its own set of takes. */
export const MAX_ANGLES = 3;

// Camera angles — mirrors the camera-angle skill vocabulary.
export const ANGLES: Option[] = [
  {
    id: "front-straight",
    label: "Front, eye level",
    hint: "Catalog standard",
    prompt: "Camera height at the garment's mid-line, 0° rotation (perfectly frontal), 0° tilt (level, no keystoning), 85mm equivalent, garment fills about 75% of frame height with even margins, everything on the garment in sharp focus.",
  },
  {
    id: "three-quarter",
    label: "3/4 view",
    hint: "Shows shape + side",
    prompt: "Camera at mid-line height, rotated 35° to one side for a three-quarter view showing the front and one side, 0° tilt, 85mm equivalent, garment fills about 70% of frame height, front text and prints still fully legible.",
  },
  {
    id: "profile",
    label: "Side profile",
    hint: "Silhouette",
    prompt: "Camera at mid-line height, rotated 90° for a clean side profile emphasising silhouette and fit, 0° tilt, 85mm equivalent, garment fills about 75% of frame height.",
  },
  {
    id: "back",
    label: "Back view",
    hint: "Back details",
    prompt: "Camera at mid-line height, rotated 180° to show the back panel, back neckline and any rear details, 0° tilt, 85mm equivalent, garment fills about 75% of frame height.",
  },
  {
    id: "top-down",
    label: "Top-down 90°",
    hint: "Flat lay",
    prompt: "Camera directly overhead, lens pointing straight down at 90°, 50mm equivalent, garment perfectly parallel to the image plane with no keystoning, fills about 70% of the frame, everything in focus.",
  },
  {
    id: "high-angle",
    label: "High angle 45°",
    hint: "Styled table view",
    prompt: "Camera raised above the surface and tilted down 45° for a styled table-top perspective, 50mm equivalent, garment fills about 60% of the frame, moderate depth of field with the garment fully sharp.",
  },
  {
    id: "low-angle",
    label: "Low angle",
    hint: "Heroic, powerful",
    prompt: "Camera below the subject's mid-line, tilted up 5–15° for a heroic, monumental feel, 35mm equivalent, garment fills about 65% of frame height, no wide-angle distortion or stretching of the garment's proportions.",
  },
  {
    id: "macro-45",
    label: "Macro 45°",
    hint: "Texture detail",
    prompt: "100mm macro lens at 45° to the fabric surface so weave and stitching catch the light, shallow depth of field with the focal plane on the texture, detail fills the whole frame.",
  },
  {
    id: "dutch",
    label: "Dutch tilt",
    hint: "Energetic",
    prompt: "Camera at mid-line height, rolled 15° off horizontal for an energetic editorial dutch angle, 35mm equivalent, garment fills about 65% of frame height, no distortion of the garment.",
  },
];

export const LIGHTING: Option[] = [
  { id: "softbox-even", label: "Soft even studio", hint: "Two softboxes", prompt: "Two large softboxes at 45 degrees left and right plus a fill, shadowless even lighting, true-to-life colour, white balance 5500K." },
  { id: "window-daylight", label: "Window daylight", hint: "Natural, soft", prompt: "Soft directional daylight from a large window to one side, gentle falloff, subtle soft shadows, natural white balance." },
  { id: "golden-hour", label: "Golden hour", hint: "Warm, outdoor", prompt: "Warm low-sun golden-hour light with long soft shadows and a gentle warm glow, colours of the garment still faithful." },
  { id: "rim-dramatic", label: "Dramatic rim", hint: "Campaign", prompt: "Dramatic low-key lighting with a strong rim light separating the garment from the background and a soft key light on the front, deep controlled shadows." },
  { id: "raking-texture", label: "Raking light", hint: "Reveals texture", prompt: "Hard raking light skimming across the fabric at a low angle to reveal weave, knit and stitch texture." },
  { id: "overcast", label: "Overcast outdoor", hint: "Neutral, flat", prompt: "Bright overcast daylight, large soft source from above, neutral colour rendering, minimal shadows." },
];

export const BACKGROUNDS: Option[] = [
  { id: "seamless-white", label: "Seamless white", hint: "Marketplace ready", prompt: "Pure seamless white studio backdrop (#FFFFFF) with a soft natural contact shadow only." },
  { id: "seamless-grey", label: "Light grey", hint: "Premium catalog", prompt: "Seamless light grey studio backdrop with a soft graduated falloff." },
  { id: "studio-gradient", label: "Studio gradient", hint: "Deep, moody", prompt: "Dark studio backdrop with a smooth spotlight gradient behind the subject." },
  { id: "linen-neutral", label: "Linen / oak surface", hint: "Flat lay", prompt: "Natural oat-coloured linen or pale oak table surface with fine visible texture." },
  { id: "concrete", label: "Concrete", hint: "Minimal, cool", prompt: "Smooth pale concrete surface and wall, minimalist, cool neutral tones." },
  { id: "urban-street", label: "Urban street", hint: "Lifestyle", prompt: "Quiet sunlit city street with soft bokeh architecture behind, no readable signage." },
  { id: "cafe-interior", label: "Café interior", hint: "Lifestyle", prompt: "Warm minimalist café interior with wooden textures and soft window light, blurred background." },
  { id: "beach", label: "Coastal", hint: "Lifestyle", prompt: "Bright coastal setting with sand, pale sky and sea haze in the distance." },
  { id: "home-interior", label: "Home interior", hint: "Lifestyle", prompt: "Bright Scandinavian-style home interior, soft textiles, plants, natural light." },
];

export const TRANSFORMS: Option[] = [
  { id: "colorway", label: "New colourway", hint: "Recolour only the garment", prompt: "Recolour ONLY the garment to the requested colour. Keep the cut, print scale, trims, lighting, shadows, background and everything else pixel-identical." },
  { id: "season", label: "Swap season", hint: "Change the scene mood", prompt: "Keep the garment and model identical; change the season, weather and environment of the scene as requested." },
  { id: "social", label: "Social crop", hint: "Reframe for 4:5 / 9:16", prompt: "Reframe and extend the scene naturally for the requested social aspect ratio while keeping the garment untouched." },
  { id: "banner", label: "Banner with copy space", hint: "Leave room for text", prompt: "Recompose so the garment sits to one side leaving clean negative space for headline copy on the other side. Do not add any text." },
  { id: "sketch", label: "Fashion illustration", hint: "Creative", prompt: "Render the same garment as a hand-drawn fashion illustration with marker and ink style, faithful to colour and cut." },
];

export const ASPECTS = ["1:1", "4:5", "3:4", "2:3", "4:3", "3:2", "16:9", "9:16"] as const;
export type Aspect = (typeof ASPECTS)[number];

export const MODELS = [
  {
    id: "gemini-3.1-flash-image",
    label: "Nano Banana 2",
    hint: "Fast, strong at faithful edits",
  },
  {
    id: "gemini-3-pro-image",
    label: "Nano Banana Pro",
    hint: "Highest fidelity, slower, 4K",
  },
] as const;
export type ModelId = (typeof MODELS)[number]["id"];

// Guard-rails appended to every generation prompt. This is what keeps the label and finish.
export const FIDELITY_RULES = `
STRICT PRODUCT FIDELITY RULES:
- The garment in the output must be the SAME physical product as in the reference photo: identical colour, fabric, sheen/finish, print or pattern (same scale and placement), seams, buttons, zips, labels, logos and trims.
- Reproduce any visible text, logo or brand mark exactly as in the reference. Never invent, alter, translate or "improve" text or logos. If a detail is not visible in the reference, do not add it.
- Do not idealise the material: keep the exact matte/gloss level, weave visibility and weight of drape.
- Do not change the garment's proportions, length, neckline or fit.
- Photorealistic, natural, believable. Physically correct shadows and reflections. No AI artefacts, no over-smoothing, no HDR look, no watermark, no added text or captions.
`.trim();

export interface BuildPromptArgs {
  shotType: ShotType;
  angleId: string;
  lightingId: string;
  backgroundId: string;
  extra?: string;
}

export function buildPrompt(a: BuildPromptArgs): string {
  const shot = SHOT_TYPES[a.shotType];
  const angle = ANGLES.find((x) => x.id === a.angleId) ?? ANGLES[0];
  const light = LIGHTING.find((x) => x.id === a.lightingId) ?? LIGHTING[0];
  const bg = BACKGROUNDS.find((x) => x.id === a.backgroundId) ?? BACKGROUNDS[0];
  const parts = [
    shot.prompt,
    `CAMERA: ${angle.prompt}`,
    `LIGHTING: ${light.prompt}`,
    `BACKGROUND / SETTING: ${bg.prompt}`,
    a.extra?.trim() ? `ART DIRECTION: ${a.extra.trim()}` : "",
    FIDELITY_RULES,
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function buildEditPrompt(instruction: string): string {
  return [
    `Edit the provided image according to this instruction: ${instruction.trim()}`,
    "Change ONLY what the instruction asks for. Everything else — the garment, its colour, print, trims, labels, the lighting and the composition — must remain identical to the input image.",
    FIDELITY_RULES,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildUpscalePrompt(): string {
  return [
    "Reproduce this exact image at higher resolution. This is an upscale: same framing, same composition, same garment, same colours, same background, same lighting.",
    "Recover fine fabric texture, stitching and edge sharpness. Do not add, remove or reinterpret anything.",
    FIDELITY_RULES,
  ].join("\n\n");
}

export function buildTransformPrompt(transformId: string, detail: string): string {
  const t = TRANSFORMS.find((x) => x.id === transformId) ?? TRANSFORMS[0];
  return [t.prompt, detail.trim() ? `REQUEST: ${detail.trim()}` : "", FIDELITY_RULES]
    .filter(Boolean)
    .join("\n\n");
}
