# Lumen Studio

Studio-grade AI product photography from a single photo, sold to multiple clients on prepaid credits.

A client uploads one plain garment photo and gets flat lays, ghost mannequin, hero, macro, lifestyle and packshots — from up to three camera angles per run (e.g. front, side, back). Each take is raced across two Gemini image models and **scored against the original for label, colour and cut fidelity**, so the one that actually looks like the product is flagged per angle.

Next.js 16 · Tailwind v4 · `@google/genai` · Upstash/Vercel KV. Free to host on Vercel; you pay only Gemini usage.

---

## How the business side works

- **You** hold one Gemini API key and fund it. You are the only person who ever sees money.
- **Each client** gets their own username + passcode, plan and credit pool. They see a percentage and a credit count — never a rupee figure, never what the pool cost you.
- **You manage everything** at `/admin`: add clients, change plans, top up credits, pause accounts, read their usage log.

### Plans (cumulative)

| Plan | Shot types unlocked | Default credits |
| --- | --- | --- |
| **Basic** | Flat lay, Ghost mannequin | 300 |
| **Pro** | + Hero, Detail/macro | 900 |
| **Max** | + Lifestyle, Packshot | 2,500 |

Higher plans include everything below them, so a Max client never loses the shots they use most. Credit grants are defaults — you can set any number per client when you create them or top them up later.

### What a shot costs, in credits

| Action | Credits |
| --- | --- |
| Flat lay / ghost mannequin | 1 per take |
| Hero / detail / lifestyle / packshot | 2 per take |
| Nano Banana Pro instead of Nano Banana 2 | ×2 |
| 2K output | ×2 |
| 4K output | ×3 |
| Edit by prompt | 1 |
| Transform | 1 |
| Upscale | 2 (×2 at 2K, ×3 at 4K) |
| Each extra camera angle | repeats the run |

**Calibration.** One credit is priced to cost you no more than one Nano Banana 2 image at 1K (≈ ₹6 at Sept-2026 Gemini prices; Nano Banana Pro at 1K ≈ ₹12 = 2 credits). Heavier work is deliberately priced *above* its true cost, so your margin never inverts when a client leans on 4K upscales. The default run — both models, 2 takes each, flat lay at 1K — is 6 credits; the same run from three angles is 18.

Sizing: a 300-credit Basic pool is roughly 50 default runs. If a client is shooting a real catalog (say 100 SKUs across several shot types), size their pool accordingly rather than assuming the defaults will last.

Credits are reserved atomically *before* the Gemini call and refunded automatically if generation fails, so two parallel takes can never overspend a pool and nobody is ever charged for an error.

---

## Signing in

Each client gets a **username and passcode**. Passcodes are at least 6
characters, stored as salted PBKDF2 hashes (never readable, even by you), and
each username locks for 15 minutes after 8 wrong attempts — so a short code
can't be brute-forced. The admin panel generates a strong 10-character passcode
for you and gives you a ready-to-send message with the link and login.

"Reset login" replaces a client's username/passcode; the old one stops working
immediately.

---

## Setup

### 1. Gemini key

<https://aistudio.google.com/apikey> → create a key → **enable billing** on that Cloud project (Nano Banana Pro needs it). Use a personal account, not your employer's.

### 2. Storage (Upstash / Vercel KV)

Clients and credit balances need a database. In the Vercel dashboard: Storage → create an Upstash Redis (KV) store → connect it to the project. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.

Without these the app still runs, but accounts live in memory and vanish on restart — the admin panel shows a warning when that's the case.

### 3. Environment variables

| Variable | What it's for |
| --- | --- |
| `GEMINI_API_KEY` | Your Gemini Developer API key |
| `ADMIN_PASSCODE` | Your owner passcode for `/admin` |
| `SESSION_SECRET` | Long random string; signs session cookies |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash/Vercel KV |
| `SEED_CLIENT_USERNAME` + `SEED_CLIENT_PASSCODE` *(optional)* | Creates one Max client on first run |
| `JUDGE_MODEL` *(optional)* | Fidelity reviewer, default `gemini-3.6-flash` |

Vertex AI instead of an API key: set `GOOGLE_CLOUD_PROJECT` (+ `GOOGLE_CLOUD_LOCATION`) and leave `GEMINI_API_KEY` empty.

### 4. Run locally

```bash
npm install
cp .env.example .env.local     # fill in the values above
npm run dev                    # http://localhost:3000
```

Open `/admin`, sign in with `ADMIN_PASSCODE`, add your first client, then open `/` and sign in with their username and passcode.

### 5. Deploy on Vercel

Push to a private GitHub repo → import at <https://vercel.com/new> → add the environment variables → deploy. Check Project → Settings → Functions that **Fluid Compute** is on, so a 4K Pro render has its full 300 seconds.

Changing an environment variable needs a redeploy to take effect.

---

## Day-to-day

**Onboarding a client:** `/admin` → Add client → name, username (auto-filled), passcode (auto-generated), plan, credits → press "Copy message for the client" and send it. That's the whole onboarding. The passcode is shown only once.

**Selling:** send prospects the landing page in `landing/` (plans, shot types, credit maths — no costs shown). They pay you; you set their credit pool. The "Note" field on each client is a private place to record what they paid and when — only you ever see it.

**Top-ups:** enter a number next to their card and press Top up. It adds to the pool without resetting usage. "Reset meter" zeroes usage instead, putting them back at 100% of their existing pool.

**Pausing:** Pause blocks both new generations and new sign-ins, and tells them to contact you. Reversible.

**Logins:** "Reset login" sets a new username and/or passcode and revokes the old one at once — use it when someone leaves their team or a passcode leaks.

---

## Tuning for a client

Everything a merchandiser might change is data, not code:

- `src/lib/presets.ts` — shot types, camera angles, lighting, backgrounds, transforms, and `FIDELITY_RULES` (the guard-rails appended to every prompt).
- `src/lib/plans.ts` — plan contents, default credit grants, and the whole credit price list.
- `src/lib/gemini.ts` → `judgeCandidate` — the scoring rubric and weights (label 35%, colour 25%, shape 25%, realism 15%).
- `MAX_ANGLES` in `presets.ts` — how many camera angles one run may shoot (3).

Camera-angle presets follow a fixed grammar — camera height, rotation, tilt, lens as a 35mm equivalent, framing percentage, depth of field — so results are repeatable rather than vibes.

---

## Project layout

```
src/
  app/
    page.tsx                    the studio
    unlock/                     client sign-in (username + passcode)
    admin/                      owner panel + login
    api/
      unlock, logout, me        client session and balance
      generate                  shot | edit | upscale | transform, with plan gate + credit spend
      judge                     fidelity score for one candidate
      admin/login, admin/clients
  components/
    Studio.tsx                  state, fan-out, credit reconciliation
    Controls.tsx                left rail: upload, shot type, angles, look, output
    Logo.tsx                    brand mark (camera + aperture) and wordmark
    AuthShell.tsx               sign-in frame for client + owner
    Gallery.tsx  Detail.tsx     ranked grid + selected take
    CreditMeter.tsx             percentage only, never currency
    Admin.tsx                   client management
  lib/
    plans.ts                    plans + credit price list
    store.ts                    accounts, logins, atomic credit spend, usage log
    gemini.ts  presets.ts  auth.ts  client.ts
  proxy.ts                      client gate + admin gate
landing/                        static client-facing site (separate Vercel project)
```

## Large images

Vercel caps request and response bodies at 4.5 MB. The browser re-encodes every
image it sends (uploads, 4K takes being edited or recoloured, judge inputs) as a
JPEG sized to fit, and the server steps JPEG quality down on big 4K renders, so
edits and transforms of 4K takes don't fail with HTTP 413.

## Ideas next

- Per-client branding (logo and accent on their sign-in screen).
- Batch mode: drop a folder of SKUs, get a CSV of best-match images for Shopify import.
- Email the client automatically when they drop below 10% credits.
- True transparent-PNG packshots via background removal.
