// GET /.netlify/functions/status?id=<uuid>  ->  { status: "working" | "done" | "error", result?, message? }
import { getStore } from "@netlify/blobs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Bad id." }, 400);

  const state = await getStore("jobs").get(`${id}/state`, { type: "json" });
  if (!state) return json({ status: "unknown" }, 404);

  if (state.status === "working" && Date.now() - (state.startedAt || 0) > 6 * 60 * 1000) {
    return json({ status: "error", message: "That took too long. Try again." });
  }
  return json(state);
};
