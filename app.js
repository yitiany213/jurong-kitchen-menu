// Jurong Kitchen menu: renders menu.json, search, language toggle, "my picks", a weekly meal plan,
// and — when served behind Cloudflare Access with the /api functions — saves picks and plans per
// person, shows who else picked each dish, and a shared feedback board.
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const MEALS = [["lunch", "Lunch"], ["dinner", "Dinner"]];

let menu, dishes = {}, current = null;
// picks: dish id -> time added (ms). plan: "YYYY-MM-DD" -> { lunch: [ids], dinner: [ids] }.
let picks = loadPicks(), plan = store.get("plan", {});
// me: signed-in email (null when there's no /api, e.g. a plain local server). people: everyone's saved records.
let me = null, myName = "", people = [], peopleAt = 0, saveTimer = null;

function loadPicks() {
  const v = store.get("picks", {});
  // Earlier versions stored picks as a plain array of ids.
  if (Array.isArray(v)) return Object.fromEntries(v.map((id) => [id, Date.now()]));
  return v && typeof v === "object" ? v : {};
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const img = (d) => `images/${d.id}.jpg`;

// ---- dates (local time, stored as YYYY-MM-DD) ----
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDay = (d) => d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
function mondayOf(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
let weekStart = mondayOf(new Date());  // week shown in the meal plan

// ---- saving ----
function save() {
  store.set("picks", picks);
  store.set("plan", plan);
  if (me) { clearTimeout(saveTimer); saveTimer = setTimeout(cloudSave, 600); }
}

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { "content-type": "application/json", ...opts.headers } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || r.status), { status: r.status });
  return data;
}

function tidyPlan(p) {
  const out = {};
  for (const [day, meals] of Object.entries(p)) {
    const kept = {};
    for (const [meal] of MEALS) if (meals?.[meal]?.length) kept[meal] = meals[meal];
    if (Object.keys(kept).length) out[day] = kept;
  }
  return out;
}

async function cloudSave() {
  if (!me) return;
  try {
    const rec = await api("/api/state", { method: "PUT", body: JSON.stringify({ name: myName, picks, plan: tidyPlan(plan) }) });
    people = [...people.filter((p) => p.email !== me), rec];
  } catch (e) {
    toast("Couldn't save to your account — your changes are kept on this device for now.");
  }
}

async function refreshPeople(maxAgeMs = 30000) {
  if (!me || Date.now() - peopleAt < maxAgeMs) return;
  try {
    people = (await api("/api/state")).people;
    peopleAt = Date.now();
  } catch {}
}

// ---- menu ----
function render() {
  $("tabs").innerHTML = menu.categories
    .map((c) => `<a href="#${c.id}" data-cat="${c.id}">${esc(c.en)} · ${esc(c.zh)}</a>`).join("");
  $("menu").innerHTML = menu.categories.map((c) => `
    <section id="${c.id}">
      <h2>${esc(c.en)}<span class="zh">${esc(c.zh)}</span></h2>
      <div class="grid">${c.dishes.map(card).join("")}</div>
    </section>`).join("");
  syncPicks();
}

function card(d) {
  return `<div class="card" role="button" tabindex="0" data-id="${d.id}"
      data-search="${esc((d.en + " " + d.zh + " " + d.desc).toLowerCase())}">
    <img src="${img(d)}" alt="${esc(d.en)}" loading="lazy">
    <div class="txt">
      <div class="en">${esc(d.en)}</div>
      <div class="zhname">${esc(d.zh)}</div>
      <div class="sub en">${esc(d.zh)}</div>
      <div class="sub zhname">${esc(d.en)}</div>
    </div>
    <button class="add" type="button" data-add="${d.id}" aria-label="Add to my picks">＋</button>
  </div>`;
}

function filter(q) {
  q = q.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll("#menu section").forEach((s) => {
    let n = 0;
    s.querySelectorAll(".card").forEach((c) => {
      const hit = !q || c.dataset.search.includes(q);
      c.hidden = !hit;
      n += hit;
    });
    s.hidden = n === 0;
    shown += n;
  });
  $("empty").hidden = shown > 0;
}

function setLang(zh) {
  document.body.classList.toggle("zhfirst", zh);
  $("langBtn").textContent = zh ? "EN" : "中文";
  store.set("zhfirst", zh);
}

// Highlight the category tab for whichever section is at the top of the screen.
function watchSections() {
  const tabs = [...document.querySelectorAll(".tabs a")];
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      tabs.forEach((t) => {
        const on = t.dataset.cat === e.target.id;
        t.classList.toggle("on", on);
        if (on) t.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    });
  }, { rootMargin: "-160px 0px -60% 0px" });
  document.querySelectorAll("#menu section").forEach((s) => io.observe(s));
}

let toastTimer;
function toast(msg) {
  $("toast").textContent = msg;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 3500);
}

// ---- picks ----
function togglePick(id) {
  if (picks[id]) delete picks[id]; else picks[id] = Date.now();
  save();
  syncPicks();
}

function syncPicks() {
  const ids = Object.keys(picks).filter((id) => dishes[id]).sort((a, b) => picks[a] - picks[b]);
  $("pickCount").textContent = ids.length;
  document.querySelectorAll("[data-add]").forEach((b) => {
    const on = !!picks[b.dataset.add];
    b.classList.toggle("on", on);
    b.textContent = on ? "✓" : "＋";
    b.setAttribute("aria-label", on ? "Remove from my picks" : "Add to my picks");
  });
  if (current) $("dPick").textContent = picks[current.id] ? "Remove from picks" : "Add to picks";
  $("pickList").innerHTML = ids.map((id) => {
    const d = dishes[id];
    return `<li><img src="${img(d)}" alt=""><span>${esc(d.en)}<br><small class="zh">${esc(d.zh)}</small></span>
      <button type="button" data-remove="${id}" aria-label="Remove ${esc(d.en)}">✕</button></li>`;
  }).join("");
  $("pickEmpty").hidden = ids.length > 0;
}

async function shareText(text, msgEl) {
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text);
    msgEl.textContent = "Copied to clipboard — paste it into WhatsApp or a message.";
  } catch (e) {
    if (e.name !== "AbortError") msgEl.textContent = "Couldn't share automatically. Select and copy the list instead.";
  }
}

// ---- dish detail ----
function openDish(id) {
  current = dishes[id];
  $("dImg").src = img(current);
  $("dImg").alt = current.en;
  $("dEn").textContent = current.en;
  $("dZh").textContent = current.zh;
  $("dDesc").textContent = current.desc;
  // Offer today and the next 13 days.
  const today = new Date();
  $("dDay").innerHTML = Array.from({ length: 14 }, (_, i) => addDays(today, i))
    .map((d, i) => `<option value="${iso(d)}">${i === 0 ? "Today, " : i === 1 ? "Tomorrow, " : ""}${fmtDay(d)}</option>`).join("");
  $("dMeal").value = today.getHours() >= 14 ? "dinner" : "lunch";
  syncPicks();
  renderWho();
  $("dish").showModal();
  refreshPeople().then(() => current?.id === id && renderWho());
}

// "Picked by Mum, Dad · Planned by Ah Ma (Sat 15 Nov dinner)" for the open dish.
function renderWho() {
  const id = current?.id, who = $("dWho");
  const others = people.filter((p) => p.email !== me);
  const name = (p) => esc(p.name || p.email.split("@")[0]);
  const picked = others.filter((p) => p.picks?.[id]).map(name);
  const planned = others.map((p) => {
    const days = Object.keys(p.plan || {}).filter((d) => MEALS.some(([m]) => p.plan[d][m]?.includes(id))).sort();
    return days.length ? `${name(p)} (${days.map((d) => fmtDay(fromIso(d))).join(", ")})` : null;
  }).filter(Boolean);
  who.innerHTML = [picked.length && `<strong>Picked by</strong> ${picked.join(", ")}`,
    planned.length && `<strong>Planned by</strong> ${planned.join(", ")}`].filter(Boolean).join("<br>");
  who.hidden = !who.innerHTML;
}

function addToPlan(day, meal, id) {
  const slot = ((plan[day] ??= {})[meal] ??= []);
  if (slot.includes(id)) return false;
  slot.push(id);
  save();
  return true;
}

// ---- meal plan ----
function dishOptions() {
  return menu.categories.map((c) => `<optgroup label="${esc(c.en)} · ${esc(c.zh)}">${
    c.dishes.map((d) => `<option value="${d.id}">${esc(d.en)} ${esc(d.zh)}</option>`).join("")}</optgroup>`).join("");
}

function renderPlan() {
  const end = addDays(weekStart, 6);
  $("wkTitle").textContent = `${fmtDay(weekStart)} – ${fmtDay(end)}`;
  const today = iso(new Date());
  const options = dishOptions();
  $("planDays").innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i), key = iso(d);
    return `<div class="day${key === today ? " today" : ""}">
      <h3>${fmtDay(d)}${key === today ? ' <span class="tag">Today</span>' : ""}</h3>
      ${MEALS.map(([meal, label]) => `<div class="slot">
        <span class="meal">${label}</span>
        <div class="chips">
          ${(plan[key]?.[meal] || []).filter((id) => dishes[id]).map((id) => `<span class="chip">
            <img src="${img(dishes[id])}" alt=""><span>${esc(dishes[id].en)} <small class="zh">${esc(dishes[id].zh)}</small></span>
            <button type="button" data-unplan="${key}|${meal}|${id}" aria-label="Remove ${esc(dishes[id].en)}">✕</button></span>`).join("")}
          <select class="addsel" data-slot="${key}|${meal}" aria-label="Add a dish to ${fmtDay(d)} ${label}">
            <option value="">＋ Add dish</option>${options}
          </select>
        </div>
      </div>`).join("")}
    </div>`;
  }).join("");
}

function weekText() {
  const lines = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i), meals = plan[iso(d)] || {};
    const parts = MEALS.filter(([m]) => meals[m]?.length)
      .map(([m, label]) => `  ${label}: ${meals[m].filter((id) => dishes[id]).map((id) => `${dishes[id].en} ${dishes[id].zh}`).join(", ")}`);
    if (parts.length) lines.push(fmtDay(d), ...parts);
  }
  return lines.length ? `Jurong Kitchen – meal plan, week of ${fmtDay(weekStart)}\n${lines.join("\n")}` : "";
}

// ---- account (sign-in itself happens at the Cloudflare Access gate, with Google) ----
function mergeInto(cloud) {
  for (const [id, t] of Object.entries(cloud.picks || {})) if (!picks[id] || t < picks[id]) picks[id] = t;
  for (const [day, meals] of Object.entries(cloud.plan || {})) {
    for (const [meal] of MEALS) for (const id of meals[meal] || []) {
      const slot = ((plan[day] ??= {})[meal] ??= []);
      if (!slot.includes(id)) slot.push(id);
    }
  }
}

async function initCloud() {
  let state;
  try {
    state = await api("/api/state");
  } catch (e) {
    // No /api here (plain local server) or storage not connected yet: work on this device only.
    if (e.status === 503) console.warn("Cloudflare KV storage isn't connected — see SETUP.md.");
    return;
  }
  me = state.me;
  people = state.people;
  peopleAt = Date.now();
  try {
    const id = await (await fetch("/cdn-cgi/access/get-identity")).json();
    myName = id.name || "";
  } catch {}
  const mine = people.find((p) => p.email === me);
  if (!myName) myName = mine?.name || me.split("@")[0];
  // The copy on this device belongs to whoever last used it here; don't hand it to someone else.
  if (store.get("owner", me) !== me) { picks = {}; plan = {}; }
  store.set("owner", me);
  mergeInto(mine || {});
  store.set("picks", picks);
  store.set("plan", plan);
  syncPicks();
  if ($("plan").open) renderPlan();
  $("familyBtn").hidden = $("fbBtn").hidden = false;
  $("acctLine").hidden = false;
  $("acctName").textContent = myName;
  await cloudSave();
}

// ---- feedback board ----
const fmtWhen = (ms) => new Date(ms).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

async function loadFeedback() {
  $("fbList").innerHTML = '<p class="note">Loading…</p>';
  try {
    const { messages } = await api("/api/feedback");
    $("fbList").innerHTML = messages.length ? messages.map((m) => `<article class="msg">
        <header><strong>${esc(m.name)}</strong> <span class="note">${fmtWhen(m.at)}</span>
          ${m.email === me ? `<button type="button" class="msgdel" data-delfb="${esc(m.id)}" aria-label="Delete your message">Delete</button>` : ""}</header>
        <p>${esc(m.text)}</p></article>`).join("")
      : '<p class="empty">No feedback yet — be the first.</p>';
  } catch {
    $("fbList").innerHTML = '<p class="empty">Couldn\'t load feedback. Check your connection.</p>';
  }
}

async function sendFeedback() {
  const text = $("fbText").value.trim();
  if (!text) return $("fbText").focus();
  $("fbSend").disabled = true;
  try {
    await api("/api/feedback", { method: "POST", body: JSON.stringify({ name: myName, text }) });
    $("fbText").value = "";
    store.set("fbDraft", "");
    toast("Thanks — feedback sent.");
    loadFeedback();
  } catch (e) {
    toast(e.message === "too-long" ? "That's a bit long — please keep it under 2,000 characters." : "Couldn't send. Your message is kept here — try again.");
  } finally {
    $("fbSend").disabled = false;
  }
}

// ---- events ----
document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) return togglePick(add.dataset.add);
  const rm = e.target.closest("[data-remove]");
  if (rm) return togglePick(rm.dataset.remove);
  const un = e.target.closest("[data-unplan]");
  if (un) {
    const [day, meal, id] = un.dataset.unplan.split("|");
    plan[day][meal] = plan[day][meal].filter((x) => x !== id);
    save();
    return renderPlan();
  }
  const del = e.target.closest("[data-delfb]");
  if (del) {
    if (!confirm("Delete your message? This can't be undone.")) return;
    return api(`/api/feedback?id=${encodeURIComponent(del.dataset.delfb)}`, { method: "DELETE" })
      .then(loadFeedback, () => toast("Couldn't delete that message."));
  }
  const c = e.target.closest(".card");
  if (c) openDish(c.dataset.id);
});
document.addEventListener("keydown", (e) => {
  const c = e.target.closest?.(".card");
  if (c && (e.key === "Enter" || e.key === " ") && !e.target.closest("[data-add]")) { e.preventDefault(); openDish(c.dataset.id); }
});
document.addEventListener("change", (e) => {
  const sel = e.target.closest("[data-slot]");
  if (!sel || !sel.value) return;
  const [day, meal] = sel.dataset.slot.split("|");
  addToPlan(day, meal, sel.value);
  renderPlan();
});

$("search").addEventListener("input", (e) => filter(e.target.value));
$("langBtn").addEventListener("click", () => setLang(!document.body.classList.contains("zhfirst")));
$("pickBtn").addEventListener("click", () => { $("pMsg").textContent = ""; $("picks").showModal(); });
$("planBtn").addEventListener("click", () => { $("planMsg").textContent = ""; renderPlan(); $("plan").showModal(); });
$("dClose").addEventListener("click", () => $("dish").close());
$("dPick").addEventListener("click", () => togglePick(current.id));
$("dPlan").addEventListener("click", () => {
  const day = $("dDay").value, meal = $("dMeal").value;
  const added = addToPlan(day, meal, current.id);
  const when = `${$("dDay").selectedOptions[0].textContent} ${meal}`;
  toast(added ? `Added to ${when}` : `Already planned for ${when}`);
});
$("dish").addEventListener("close", () => { current = null; });
$("pClose").addEventListener("click", () => $("picks").close());
$("pShare").addEventListener("click", () => {
  const ids = Object.keys(picks).filter((id) => dishes[id]).sort((a, b) => picks[a] - picks[b]);
  if (ids.length) shareText(`Jurong Kitchen – my picks\n${ids.map((id, i) => `${i + 1}. ${dishes[id].en} ${dishes[id].zh}`).join("\n")}`, $("pMsg"));
});
$("pClear").addEventListener("click", () => {
  if (Object.keys(picks).length && confirm("Remove all dishes from your picks?")) { picks = {}; save(); syncPicks(); }
});
$("wkPrev").addEventListener("click", () => { weekStart = addDays(weekStart, -7); renderPlan(); });
$("wkNext").addEventListener("click", () => { weekStart = addDays(weekStart, 7); renderPlan(); });
$("planClose").addEventListener("click", () => $("plan").close());
$("planShare").addEventListener("click", () => {
  const text = weekText();
  if (text) shareText(text, $("planMsg")); else $("planMsg").textContent = "Nothing planned this week yet.";
});
$("planClear").addEventListener("click", () => {
  const keys = Array.from({ length: 7 }, (_, i) => iso(addDays(weekStart, i))).filter((k) => plan[k]);
  if (keys.length && confirm("Remove every dish planned for this week?")) { keys.forEach((k) => delete plan[k]); save(); renderPlan(); }
});
$("fbBtn").addEventListener("click", () => {
  $("fbText").value = store.get("fbDraft", "");
  $("fb").showModal();
  loadFeedback();
});
$("fbText").addEventListener("input", (e) => store.set("fbDraft", e.target.value));
$("fbSend").addEventListener("click", sendFeedback);
$("fbClose").addEventListener("click", () => $("fb").close());
$("signOut").addEventListener("click", async () => {
  if (!confirm("Sign out? Your picks and meal plan stay saved in your account.")) return;
  clearTimeout(saveTimer);
  await cloudSave();
  // Detach from the account first so clearing this device below can never be saved over it.
  me = null;
  picks = {}; plan = {};
  save();
  store.set("owner", null);
  location.href = "/cdn-cgi/access/logout";
});

fetch("menu.json")
  .then((r) => r.json())
  .then((m) => {
    menu = m;
    menu.categories.forEach((c) => c.dishes.forEach((d) => (dishes[d.id] = d)));
    render();
    setLang(store.get("zhfirst", false));
    watchSections();
    initCloud();
  })
  .catch(() => { $("menu").innerHTML = '<p class="empty">Couldn\'t load the menu. Start it with Run.bat.</p>'; });
