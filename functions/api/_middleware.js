// Runs before every /api/* request. Cloudflare Access has already checked the visitor against the
// Family list, so we only need to read who they are, and make sure the storage (KV) is connected.

function emailFromJwt(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part)).email || "";
  } catch {
    return "";
  }
}

function accessEmail(request) {
  const h = request.headers;
  const direct = h.get("cf-access-authenticated-user-email");
  if (direct) return direct;
  const jwt = h.get("cf-access-jwt-assertion")
    || (h.get("cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  return jwt ? emailFromJwt(jwt) : "";
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function onRequest(context) {
  const email = accessEmail(context.request).trim().toLowerCase();
  if (!email) return json({ error: "not-signed-in" }, 401);
  if (!context.env.JK) return json({ error: "storage-not-connected" }, 503);
  context.data.email = email;
  try {
    return await context.next();
  } catch (e) {
    return json({ error: "server-error", detail: String(e?.message || e) }, 500);
  }
}
