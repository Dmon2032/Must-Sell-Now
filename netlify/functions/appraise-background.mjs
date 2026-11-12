// Netlify Background Function (the "-background" suffix gives it up to 15 minutes).
// Reads the photos from Blobs, asks Claude to identify the item and search for SOLD comps,
// then writes the normalized result to Blobs for status.mjs to serve.
import { getStore } from "@netlify/blobs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const API = "https://api.anthropic.com/v1/messages";

const PROMPT = (note) => `You are a collectibles pricing expert for "Must Sell NOW!" by Cosmic Filaments. The attached photo(s) show ONE collectible the owner wants to sell fast. Photo 1 is the main shot.
Owner note: ${note ? JSON.stringify(note) : "none"}

Do this:
1. Identify the item and grade its visible condition. Never invent marks, serial numbers or provenance you cannot see.
2. Use web search to find what this exact item (or the closest match) has actually SOLD for: eBay sold listings, auction results, WorthPoint, dealer sold archives. Prefer sold over asking prices. Do 3 to 6 searches.
3. Price for condition: low = realistic floor, quick = price likely to sell in about 7 days on the best platform (often 80 to 90 percent of the median sold price), high = top of the realistic range. Always low <= quick <= high. USD.
4. Pick the single best place to sell this type and quality of item.
5. Write a listing a buyer would click: a catchy title, short product info, a short description.

Rules for comps: only list sales or listings you actually found in search results, using the exact URL from the result. Never make up a comp, price or URL. If you found few, list few.
If you cannot identify the item with reasonable certainty, say so in heads_up, set confidence to "low", and give a category-level range.

Do not write anything before or between searches. Your final message must be ONLY this JSON object:
{
 "item": {"name": "plain item name"},
 "condition": "short grade, e.g. Very Good",
 "confidence": "high|medium|low",
 "prices": {"low": 0, "quick": 0, "high": 0, "days": 7},
 "comps": [{"title": "", "price": 0, "kind": "sold|asking", "source": "site name", "url": ""}],
 "platform": {"name": "", "why": "one short sentence", "fee_pct": 0},
 "listing": {
   "title": "catchy, 70 characters or fewer",
   "info": "2 to 4 short lines separated by \\n, each like 'Maker: ...' or 'Era: ...' or 'Size: ...' or 'Condition: ...'",
   "description": "35 to 55 words, specific, honest, no unsupported hype"
 },
 "heads_up": "one sentence on authenticity or missing info, or empty string"
}`;

export default async (req) => {
  let id;
  try {
    ({ id } = await req.json());
  } catch {
    return;
  }
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) return;

  const store = getStore("jobs");
  try {
    const input = await store.get(`${id}/input`, { type: "json" });
    if (!input) return;
    const result = await appraise(input);
    await store.setJSON(`${id}/state`, { status: "done", result });
  } catch (e) {
    await store.setJSON(`${id}/state`, { status: "error", message: friendly(e) });
  } finally {
    await store.delete(`${id}/input`).catch(() => {}); // photos don't stick around
  }
};

async function callClaude(messages) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      messages,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Anthropic error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function appraise({ photos, note }) {
  const content = photos.map((p) => {
    const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(p);
    if (!m) throw new Error("bad_image");
    return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
  });
  content.push({ type: "text", text: PROMPT(note) });

  let messages = [{ role: "user", content }];
  const seenUrls = new Set();
  let finalText = "";

  for (let turn = 0; turn < 4; turn++) {
    const data = await callClaude(messages);
    let afterSearch = "";
    for (const b of data.content || []) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) if (r && r.url) seenUrls.add(r.url);
        afterSearch = ""; // only keep text written after the last search
      } else if (b.type === "text") {
        afterSearch += b.text;
      }
    }
    if (data.stop_reason === "pause_turn") {
      messages = [...messages, { role: "assistant", content: data.content }];
      continue;
    }
    finalText = afterSearch;
    break;
  }

  const raw = parseJson(finalText);
  if (!raw) throw new Error("no_json");
  return normalize(raw, seenUrls);
}

function parseJson(text) {
  if (!text) return null;
  const t = text.replace(/```json|```/g, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(t.slice(a, b + 1));
  } catch {
    return null;
  }
}

function normalize(d, seenUrls) {
  const num = (v) => {
    const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  };
  const p = d.prices || {};
  let [low, quick, high] = [num(p.low), num(p.quick), num(p.high)];
  if (![low, quick, high].every(Number.isFinite) || high <= 0) throw new Error("no_prices");
  [low, quick, high] = [low, quick, high].sort((a, b) => a - b);

  // Only keep comps whose URL really came back from the search tool. No invented evidence.
  const comps = (Array.isArray(d.comps) ? d.comps : [])
    .map((c) => ({
      title: String(c.title || "").slice(0, 110),
      price: num(c.price),
      kind: String(c.kind).toLowerCase() === "sold" ? "sold" : "asking",
      source: String(c.source || "").slice(0, 40),
      url: String(c.url || ""),
    }))
    .filter((c) => c.price > 0 && /^https:\/\//.test(c.url) && seenUrls.has(c.url))
    .slice(0, 6);

  const l = d.listing || {};
  const info = String(l.info || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((s) => s.slice(0, 90));
  const pl = d.platform || {};

  return {
    item: { name: String(d.item?.name || "Collectible").slice(0, 120) },
    condition: String(d.condition || "").slice(0, 40),
    confidence: ["high", "medium", "low"].includes(d.confidence) ? d.confidence : "low",
    prices: { low, quick, high, days: Math.min(60, Math.max(1, Math.round(num(p.days) || 7))) },
    comps,
    soldCount: comps.filter((c) => c.kind === "sold").length,
    platform: {
      name: String(pl.name || "eBay").slice(0, 40),
      why: String(pl.why || "").slice(0, 200),
      fee: num(pl.fee_pct) || 0,
    },
    listing: {
      title: String(l.title || d.item?.name || "").slice(0, 80),
      info,
      description: String(l.description || "").slice(0, 600),
    },
    headsUp: String(d.heads_up || "").slice(0, 240),
  };
}

function friendly(e) {
  const msg = String(e?.message || "");
  if (e?.status === 401) return "The server’s Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Netlify.";
  if (e?.status === 400 && /web.?search/i.test(msg)) return "Web search isn’t enabled for your Anthropic organization. Turn it on in the Anthropic Console.";
  if (e?.status === 429) return "Anthropic rate limit hit. Try again in a minute.";
  if (e?.status === 529 || /overloaded/i.test(msg)) return "Anthropic is busy right now. Try again in a minute.";
  if (msg === "no_prices" || msg === "no_json") return "Couldn’t price that one. Try a clearer photo of the item.";
  if (msg === "bad_image") return "One of the photos couldn’t be read.";
  return "Something went wrong while pricing. Try again.";
}
