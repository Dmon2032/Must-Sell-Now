// POST /.netlify/functions/start
// Stores the photos, then kicks off the background appraisal. Returns { id } fast.
import { getStore } from "@netlify/blobs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const need = process.env.APP_PASSCODE;
  if (need && req.headers.get("x-passcode") !== need) {
    return json({ error: "passcode" }, 401);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "Server is missing ANTHROPIC_API_KEY. Add it in Netlify environment variables." }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }

  const photos = Array.isArray(body.photos) ? body.photos.slice(0, 3) : [];
  const okPhotos =
    photos.length > 0 &&
    photos.every((p) => typeof p === "string" && /^data:image\/(jpeg|png|webp|gif);base64,/i.test(p));
  if (!okPhotos) return json({ error: "Send 1 to 3 photos." }, 400);

  const total = photos.reduce((n, p) => n + p.length, 0);
  if (total > 5_000_000) return json({ error: "Photos are too large. Try smaller ones." }, 413);

  const note = String(body.note || "").slice(0, 400);
  const id = crypto.randomUUID();
  const store = getStore("jobs");

  await store.setJSON(`${id}/input`, { photos, note });
  await store.setJSON(`${id}/state`, { status: "working", startedAt: Date.now() });

  // Fire the background function. It answers 202 immediately; the work continues server-side.
  const origin = new URL(req.url).origin;
  let ok = false;
  try {
    const r = await fetch(`${origin}/.netlify/functions/appraise-background`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    ok = r.ok || r.status === 202;
  } catch {
    ok = false;
  }
  if (!ok) {
    await store.setJSON(`${id}/state`, { status: "error", message: "Couldn’t start the appraisal. Try again." });
    return json({ error: "Couldn’t start the appraisal. Try again." }, 502);
  }

  return json({ id });
};
