// GET    /api/feedback          -> { me, messages: [{ id, email, name, text, at }] }  newest first
// POST   /api/feedback { name, text }  -> adds a message from the signed-in person
// DELETE /api/feedback?id=...   -> removes a message, only if it's your own
// Stored in KV as "fb:<reverse time>-<random>", so a plain key listing comes back newest first.
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const MAX_LEN = 2000;
const keyFor = (at) => `fb:${String(9_999_999_999_999 - at).padStart(13, "0")}-${crypto.randomUUID().slice(0, 8)}`;

export async function onRequestGet({ env, data }) {
  const page = await env.JK.list({ prefix: "fb:", limit: 200 });
  const values = await Promise.all(page.keys.map((k) => env.JK.get(k.name, "json")));
  const messages = values.map((v, i) => v && { id: page.keys[i].name, ...v }).filter(Boolean);
  return json({ me: data.email, messages });
}

export async function onRequestPost({ request, env, data }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad-json" }, 400); }
  const text = String(body?.text || "").trim();
  if (!text) return json({ error: "empty" }, 400);
  if (text.length > MAX_LEN) return json({ error: "too-long", max: MAX_LEN }, 400);
  const at = Date.now();
  const msg = { email: data.email, name: String(body?.name || "").trim().slice(0, 80) || data.email.split("@")[0], text, at };
  const id = keyFor(at);
  await env.JK.put(id, JSON.stringify(msg));
  return json({ id, ...msg }, 201);
}

export async function onRequestDelete({ request, env, data }) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id.startsWith("fb:")) return json({ error: "bad-id" }, 400);
  const msg = await env.JK.get(id, "json");
  if (!msg) return json({ ok: true });
  if (msg.email !== data.email) return json({ error: "not-yours" }, 403);
  await env.JK.delete(id);
  return json({ ok: true });
}
