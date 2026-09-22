// Shape of the style description, shared by server and browser.
// Kept dependency-free so client components can import it without pulling in the Gemini SDK.

export interface StyleDescription {
  product: string;
  fabric: string;
  colour: string;
  pattern: string;
  details: string;
  fit: string;
  styling: string;
  mood: string;
}

export const STYLE_FIELDS: Array<{ key: keyof StyleDescription; label: string; hint: string; long?: boolean }> = [
  { key: "product", label: "Product", hint: "What the garment is" },
  { key: "colour", label: "Colour", hint: "Exact shade, as a stylist would name it" },
  { key: "fabric", label: "Fabric & finish", hint: "Material, weight, sheen" },
  { key: "pattern", label: "Print / pattern", hint: "Motif, scale, placement" },
  { key: "details", label: "Trims & details", hint: "Buttons, zips, stitching, hardware" },
  { key: "fit", label: "Fit & silhouette", hint: "Cut, length, how it sits" },
  { key: "styling", label: "Styling", hint: "How to style it for the shoot", long: true },
  { key: "mood", label: "Mood", hint: "Aesthetic direction", long: true },
];

export const EMPTY_STYLE: StyleDescription = {
  product: "",
  colour: "",
  fabric: "",
  pattern: "",
  details: "",
  fit: "",
  styling: "",
  mood: "",
};

/** Turn the (possibly user-edited) description into a prompt block. */
export function styleBlock(d: Partial<StyleDescription> | null | undefined): string {
  if (!d) return "";
  const lines = STYLE_FIELDS.map(({ key, label }) => {
    const v = String(d[key] ?? "").trim();
    return v ? `- ${label}: ${v}` : "";
  }).filter(Boolean);
  if (!lines.length) return "";
  return [
    "STYLE DESCRIPTION (supplied by the designer — treat as ground truth about the product; where it conflicts with your own reading of the reference photo, follow this description):",
    ...lines,
  ].join("\n");
}
