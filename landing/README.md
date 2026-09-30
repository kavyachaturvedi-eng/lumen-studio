# Lumen Studio — client landing page

A single static page you send to prospective clients before they buy: what the
studio does, the shot types, plans, and exactly how credits are spent. It never
shows your Gemini cost.

## Before you deploy

1. **WhatsApp number** — open `index.html`, find `window.LUMEN_WHATSAPP` near the
   top of `<body>`, and put your number in: country code + number, digits only
   (e.g. `919876543210`). Every button on the page uses it.
2. **Link preview** — once you know the site's URL, change
   `<meta property="og:image" content="og.png">` to the full address
   (e.g. `https://lumen-studio-site.vercel.app/og.png`) so WhatsApp shows the
   preview card.
3. **Prices** — Basic is `₹10,000 · 300 credits`; Pro and Max say "Let's talk".
   Edit them in the `PRICING` section of `index.html`.

## Deploy on Vercel (separate project, same repo)

1. vercel.com/new → import the same GitHub repo again.
2. Project name: e.g. `lumen-studio-site`.
3. **Root Directory → `landing`**. Framework preset → **Other**. No build command.
4. Deploy. Your studio app keeps deploying from the repo root as before.

Everything is self-contained: fonts (Geist, SIL Open Font License) are in
`fonts/`, the illustrations are inline SVG, and there are no external requests.
