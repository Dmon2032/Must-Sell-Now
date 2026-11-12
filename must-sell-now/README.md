# Must Sell NOW! — Cosmic Filaments

Photo in. Sold-price research, a quick-sale price, where to sell, and a paste-ready listing out.

**Output (kept short on purpose)**
- Price matrix: Floor / **Must-sell price** / Ceiling, backed by real sold listings found by web search
- Sold prices found (linked, so you can click through and verify)
- Best place to sell, with one reason and net-after-fees
- Listing: catchy title, 2–4 product info lines, short description. One tap to copy
- One-page PDF: labeled photo, price matrix, platform, listing text (selectable, paste-ready), top comps

## How it works

```
public/index.html                         the app (no build step)
public/brand/                             tag.png (the app mark), plus badge.png and glyph.png cut from the Cosmic Filaments brand book (splash and footer only, never recolor)
public/favicon.png                        the app mark, for the browser tab
netlify/functions/start.mjs               receives photos, stores them, starts the job
netlify/functions/appraise-background.mjs Claude + web search (background function, up to 15 min)
netlify/functions/status.mjs              the app polls this until the result is ready
```

Web search takes longer than Netlify's 10-second limit for normal functions, so the appraisal runs as a
**background function** and the page polls for the result. This works on every Netlify plan.
Comps are only shown if their URL actually came back from the search tool, so the evidence can't be invented.

## Deploy (GitHub → Netlify)

1. Create a GitHub repo and push this folder:
   ```bash
   git init && git add . && git commit -m "Must Sell NOW!"
   git branch -M main
   git remote add origin https://github.com/YOUR-USER/must-sell-now.git
   git push -u origin main
   ```
2. Netlify → **Add new site → Import an existing project → GitHub** → pick the repo.
   Settings are read from `netlify.toml` (publish `public`, functions `netlify/functions`). No build command.
3. **Site configuration → Environment variables**, add:
   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your key (required) |
   | `APP_PASSCODE` | a passcode (strongly recommended; without it anyone with the URL can spend your API credits) |
   | `ANTHROPIC_MODEL` | optional model override |
4. In the **Anthropic Console**, make sure **web search is enabled** for your organization, and set a monthly spend limit.
5. Deploy. Open the site, add a photo, tap **Price it to sell**.

## Local dev

```bash
npm install
cp .env.example .env     # fill in the key
npx netlify dev          # http://localhost:8888
```

## Notes

- Each appraisal = one Claude call with up to 6 web searches. Web search is billed per search on top of normal token costs; check current Anthropic pricing.
- Photos are deleted from storage as soon as the job finishes. Results stay in Netlify Blobs (store `jobs`) until you clear them.
- Estimates only, not formal appraisals. Rare, signed or possibly reproduced items should be authenticated.


## Look and brand

The app has its own identity: an estate-sale price tag. Cosmic Filaments stays on the splash screen, the footer and the copyright, and nowhere else.

- **App mark:** a price tag inside camera-viewfinder corners (photo in, price out). `public/brand/tag.png` is the full mark (masthead, PDF header, home-screen icon) and `public/favicon.png` is the tab icon. The source art was drawn as SVG at 512 px.
- **Color:** warm paper `#F4ECDC` page, cream cards, ink `#1F1A14` text, tag red `#CF3322` for the one hot thing on screen (the must-sell sticker and the main button), sticker yellow `#FFD23F` for highlights, kraft `#C9A66B` for the dashed "perforation" lines. Light only.
- **Type:** Archivo Black for headlines and prices, Georgia for reading text, Archivo 700 uppercase with wide tracking for labels and buttons. The PDF uses Helvetica Bold and Times as stand-ins.
- **Motion:** while it works, a yellow scan line sweeps your own photo inside viewfinder corners. On the result, a pin slides along a price ruler to the must-sell price. The main button gets one glow-breath the first time it lights up. All of it switches off for visitors who prefer reduced motion.
- **PDF:** paper-white so it prints cheaply, with the price-tag mark in the header and the Cosmic Filaments copyright in the footer.
- **Voice:** plain English, "you can do this."

### Splash and copyright

- Every page load and every reset ("Price another piece", "Cancel") plays the Cosmic Filaments splash: the full badge, a filament that draws on, then the app. Tap the splash to skip it.
- Footer, PDF and page metadata carry "© [year] Cosmic Filaments. All rights reserved." The year updates itself.
