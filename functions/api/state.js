// GET  /api/state -> { me, people: [{ email, name, picks, plan, updatedAt }] }  (everyone in Family)
// PUT  /api/state  { name, picks, plan } -> saves the signed-in person's own picks and meal plan.
// Stored in KV as "user:<email>".
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const MEALS = ["lunch", "dinner"];
const ID = /^[a-z0-9-]{1,60}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function clean(body) {
  const picks = {};
  for (const [id, t] of Object.entries(body?.picks || {}).slice(0, 300)) {
    if (ID.test(id) && Number.isFinite(t)) picks[id] = Math.round(t);
  }
  const plan = {};
  for (const [day, meals] of Object.entries(body?.plan || {}).slice(0, 400)) {
    if (!DAY.test(day) || !meals || typeof meals !== "object") continue;
    const kept = {};
    for (const m of MEALS) {
      const ids = (Array.isArray(meals[m]) ? meals[m] : []).filter((id) => typeof id === "string" && ID.test(id)).slice(0, 30);
      if (ids.length) kept[m] = [...new Set(ids)];
    }
    if (Object.keys(kept).length) plan[day] = kept;
  }
  const name = String(body?.name || "").trim().slice(0, 80);
  return { name, picks, plan };
}

export async function onRequestGet({ env, data }) {
  const people = [];
  let cursor;
  do {
    const page = await env.JK.list({ prefix: "user:", cursor });
    const values = await Promise.all(page.keys.map((k) => env.JK.get(k.name, "json")));
    values.forEach((v) => v && people.push(v));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return json({ me: data.email, people });
}

export async function onRequestPut({ request, env, data }) {
  const text = await request.text();
  if (text.length > 100_000) return json({ error: "too-large" }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: "bad-json" }, 400); }
  const record = { email: data.email, ...clean(body), updatedAt: Date.now() };
  if (!record.name) record.name = data.email.split("@")[0];
  await env.JK.put(`user:${data.email}`, JSON.stringify(record));
  return json(record);
}
