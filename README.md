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
