# Lumen Studio

Studio-grade AI product photography from a single photo. Upload one plain product shot and get packshots, ghost-mannequin, flat lays, lifestyle scenes, hero and macro images — every take is raced across Google's image models and **scored against your original for label, colour and cut fidelity**, so you keep the one that actually looks like your product.

Built with Next.js 16 · Tailwind v4 · `@google/genai`. Runs free on Vercel's Hobby tier; you pay only Gemini API usage.

## What it does

| Step | What happens |
| --- | --- |
| **Upload** | One JPG/PNG. Downscaled in the browser to ≤1600px so uploads stay small. |
| **Shot type** | Packshot · Ghost mannequin · Flat lay · Lifestyle · Hero · Detail/macro. Each sets sensible defaults for angle, light and background. |
| **Camera / lighting / background** | Chips, each mapping to a precise prompt fragment (see `src/lib/presets.ts`). |
| **Race models** | Nano Banana 2 (`gemini-3.1-flash-image`) and Nano Banana Pro (`gemini-3-pro-image`), 1–3 takes each, all fired in parallel. |
| **Fidelity judge** | A cheap Gemini vision model compares every take with the original and scores label/print, colour/finish, cut/trims and realism (0–10 each, weighted to 0–100). The top score of the batch gets the **Best match** badge. |
| **Edit by prompt** | "Whiter background", "remove the wrinkle on the left sleeve"… Only what you ask changes; the original photo is sent alongside as ground truth. |
| **Upscale** | Re-render at 2K or 4K (4K = Pro only). |
| **Transform** | New colourway, swap season, social crop, banner with copy space, fashion illustration. |
| **Use as source** | Chain: turn any take into the reference for the next round (fidelity is still judged against the very first upload). |
| **Download** | JPEG, named by shot/model/size. |

Without an API key the app runs in **demo mode** (placeholder images and random scores) so you can click through the UI.

## 1 · Get a Gemini key

Simplest path — Gemini Developer API:

1. Go to <https://aistudio.google.com/apikey> and create a key (enable billing on the project for the Pro model).
2. That's `GEMINI_API_KEY`.

Vertex AI path (if you prefer your GCP project): leave `GEMINI_API_KEY` empty and set `GOOGLE_CLOUD_PROJECT` (+ `GOOGLE_CLOUD_LOCATION`, default `global`). Locally, `gcloud auth application-default login`; on Vercel you'd need a service-account JSON via `GOOGLE_APPLICATION_CREDENTIALS` — the API-key path is far easier there.

Rough cost (Sept 2026 list prices): Nano Banana 2 ≈ $0.06–0.16 per image depending on resolution, Nano Banana Pro ≈ $0.15 per 1K image, more at 2K/4K; the judge call is fractions of a cent. A default run (2 models × 2 takes + 4 judge calls) is roughly $0.40–0.50.

## 2 · Run locally

```bash
npm install
cp .env.example .env.local     # fill in GEMINI_API_KEY and APP_PASSCODE
npm run dev                    # http://localhost:3000
```

## 3 · Deploy free on Vercel

1. Push this folder to a GitHub repo (private is fine).
2. <https://vercel.com/new> → Import the repo → Framework: Next.js (auto-detected).
3. **Environment Variables** — add:
   - `GEMINI_API_KEY` = your key
   - `APP_PASSCODE` = the shared passcode you'll give your client
   - (optional) `JUDGE_MODEL` = `gemini-2.5-flash` (default) or any cheap multimodal Gemini model
4. Deploy. You'll get `https://<project>.vercel.app`. Share the URL + passcode with your client.

Notes for the Hobby tier:
- Functions can run up to 300 s (Fluid Compute is on by default for new projects). `maxDuration` is already set in the API routes. If your project shows a 10 s/60 s limit, enable Fluid Compute in Project Settings → Functions.
- Response bodies are capped around 4.5 MB. Outputs are re-encoded as JPEG to stay under that; if a 4K upscale ever fails for size, use 2K.
- Each generation is its own request, so the browser fans out the parallel work — nothing is blocked on the slowest model.

## 4 · Access control

The whole app (pages *and* API routes) sits behind a shared passcode enforced in `src/proxy.ts`. The cookie holds an HMAC, never the passcode. Change the passcode by changing the env var — every existing session is invalidated automatically. Leave `APP_PASSCODE` empty only for local development.

Want per-user logins later? Swap `src/lib/auth.ts` for Clerk/Auth.js — the proxy only needs `isAuthed()` to keep working.

## Tuning for your client

Everything a merchandiser might want to change is data, not code:

- `src/lib/presets.ts` — shot types, camera angles, lighting, backgrounds, transforms, aspect ratios, model list, and `FIDELITY_RULES` (the guard-rail text appended to every prompt).
- `src/lib/gemini.ts` → `judgeCandidate` — the scoring rubric and weights (label 35 %, colour 25 %, shape 25 %, realism 15 %).
- Add a shot type: add a key to `SHOT_TYPES` and a value to the `ShotType` union. The UI picks it up.

## Project layout

```
src/
  app/
    page.tsx              → <Studio />
    unlock/page.tsx       passcode screen
    api/generate/route.ts one image per request: shot | edit | upscale | transform
    api/judge/route.ts    fidelity score for one candidate
    api/unlock/route.ts   sets the session cookie
  components/
    Studio.tsx            state + orchestration (fan-out, judging, batches)
    Controls.tsx          left panel
    Gallery.tsx           ranked grid, Best match badge
    Detail.tsx            selected take: score breakdown, edit / upscale / transform
  lib/
    presets.ts            all the prompt vocabulary
    gemini.ts             Gemini calls + demo mode
    auth.ts               passcode HMAC helpers
    client.ts             browser helpers (compression, fetches, download)
  proxy.ts                route guard (Next 16 middleware)
```

## Roadmap ideas

- Persist sessions (Vercel Blob / Supabase) so the client can come back to a shoot.
- Batch mode: drop a folder of SKUs, get a CSV of best-match URLs for Shopify import.
- Background removal + true transparent PNG packshots.
- Video: 3-second turntable from the hero shot (Veo).
