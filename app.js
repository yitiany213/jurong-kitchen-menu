// Jurong Kitchen menu: renders menu.json, search, language toggle, "my picks", a weekly meal plan,
// and — when firebase-config.js is filled in — Google sign-in that saves picks and plans per person
// in Firestore, shows who else picked each dish, and a shared feedback board.
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const MEALS = [["lunch", "Lunch"], ["dinner", "Dinner"]];

let menu, dishes = {}, current = null;
// picks: dish id -> time added (ms). plan: "YYYY-MM-DD" -> { lunch: [ids], dinner: [ids] }.
let picks = loadPicks(), plan = store.get("plan", {});
// user: the signed-in Firebase user (null when signed out or Firebase isn't configured).
// people: everyone's users/{uid} records, kept live by a Firestore listener.
let db = null, user = null, people = [], saveTimer = null, stopPeople = null, stopFeedback = null;

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
  if (user) { clearTimeout(saveTimer); saveTimer = setTimeout(cloudSave, 600); }
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
  if (!user || !db) return;
  try {
    await db.collection("users").doc(user.uid).set({
      name: user.displayName || "", email: (user.email || "").toLowerCase(), photo: user.photoURL || "",
      picks, plan: tidyPlan(plan), updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    toast(e.code === "permission-denied" ? notFamily() : "Couldn't save to your account — your changes are kept on this device for now.");
  }
}

const notFamily = () => `${user?.email || "This account"} isn't on the family list yet — ask the owner to add it.`;

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
}

// "Picked by Mum, Dad · Planned by Ah Ma (Sat 15 Nov dinner)" for the open dish.
function renderWho() {
  const id = current?.id, who = $("dWho");
  if (!id) return;
  const others = people.filter((p) => p.uid !== user?.uid);
  const name = (p) => esc(p.name || (p.email || "someone").split("@")[0]);
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

// ---- account ----
function mergeInto(cloud) {
  for (const [id, t] of Object.entries(cloud.picks || {})) if (!picks[id] || t < picks[id]) picks[id] = t;
  for (const [day, meals] of Object.entries(cloud.plan || {})) {
    for (const [meal] of MEALS) for (const id of meals[meal] || []) {
      const slot = ((plan[day] ??= {})[meal] ??= []);
      if (!slot.includes(id)) slot.push(id);
    }
  }
}

function renderAccount() {
  const b = $("acctBtn");
  b.hidden = !db;
  $("familyBtn").hidden = $("fbBtn").hidden = !user;
  $("acctLine").hidden = !user;
  if (user) {
    const first = (user.displayName || user.email || "Me").split(" ")[0];
    b.innerHTML = user.photoURL
      ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer"><span>${esc(first)}</span>`
      : esc(first);
    b.setAttribute("aria-label", `Signed in as ${user.displayName || user.email}. Tap to sign out.`);
    $("acctName").textContent = user.displayName || user.email;
  } else {
    b.textContent = "Sign in";
    b.removeAttribute("aria-label");
  }
}

// Everyone's records, kept up to date while signed in (for "Picked by" and the Family page).
function watchPeople() {
  stopPeople?.();
  stopPeople = db.collection("users").onSnapshot((snap) => {
    people = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    if (current) renderWho();
  }, (e) => { if (e.code === "permission-denied") toast(notFamily()); });
}

async function onAuth(u) {
  user = u;
  renderAccount();
  stopPeople?.(); stopPeople = null; people = [];
  if (!u) return;
  // The copy on this device belongs to whoever last used it here; don't hand it to someone else.
  if (store.get("owner", u.uid) !== u.uid) { picks = {}; plan = {}; save(); syncPicks(); }
  store.set("owner", u.uid);
  try {
    const snap = await db.collection("users").doc(u.uid).get();
    // Anything added on this device before signing in joins the account.
    mergeInto(snap.exists ? snap.data() : {});
    store.set("picks", picks);
    store.set("plan", plan);
    syncPicks();
    if ($("plan").open) renderPlan();
    await cloudSave();
    watchPeople();
  } catch (e) {
    toast(e.code === "permission-denied" ? notFamily() : "Signed in, but couldn't load your saved list. Check your connection.");
  }
}

async function initCloud() {
  try {
    db = await loadFirebase();
  } catch (e) {
    console.warn(e);
    return;
  }
  if (!db) return;
  renderAccount();
  firebase.auth().onAuthStateChanged(onAuth);
}

// ---- feedback board ----
const fmtWhen = (ms) => new Date(ms).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function watchFeedback() {
  $("fbList").innerHTML = '<p class="note">Loading…</p>';
  stopFeedback?.();
  stopFeedback = db.collection("feedback").orderBy("at", "desc").limit(200).onSnapshot((snap) => {
    $("fbList").innerHTML = snap.empty ? '<p class="empty">No feedback yet — be the first.</p>'
      : snap.docs.map((d) => {
        const m = d.data(), at = m.at?.toMillis?.() ?? Date.now();
        return `<article class="msg">
          <header><strong>${esc(m.name || m.email)}</strong> <span class="note">${fmtWhen(at)}</span>
            ${m.uid === user?.uid ? `<button type="button" class="msgdel" data-delfb="${esc(d.id)}" aria-label="Delete your message">Delete</button>` : ""}</header>
          <p>${esc(m.text)}</p></article>`;
      }).join("");
  }, (e) => {
    $("fbList").innerHTML = `<p class="empty">${e.code === "permission-denied" ? esc(notFamily()) : "Couldn't load feedback. Check your connection."}</p>`;
  });
}

async function sendFeedback() {
  const text = $("fbText").value.trim();
  if (!text) return $("fbText").focus();
  if (text.length > 2000) return toast("That's a bit long — please keep it under 2,000 characters.");
  $("fbSend").disabled = true;
  try {
    await db.collection("feedback").add({
      uid: user.uid, name: user.displayName || "", email: (user.email || "").toLowerCase(),
      text, at: firebase.firestore.FieldValue.serverTimestamp(),
    });
    $("fbText").value = "";
    store.set("fbDraft", "");
    toast("Thanks — feedback sent.");
  } catch (e) {
    toast(e.code === "permission-denied" ? notFamily() : "Couldn't send. Your message is kept here — try again.");
  } finally {
    $("fbSend").disabled = false;
  }
}

// Start loading the menu before wiring up buttons, so a problem with one button can never leave the page empty.
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
    return db.collection("feedback").doc(del.dataset.delfb).delete()
      .catch(() => toast("Couldn't delete that message."));
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
  watchFeedback();
});
$("fb").addEventListener("close", () => { stopFeedback?.(); stopFeedback = null; });
$("fbText").addEventListener("input", (e) => store.set("fbDraft", e.target.value));
$("fbSend").addEventListener("click", sendFeedback);
$("fbClose").addEventListener("click", () => $("fb").close());

async function signOut() {
  if (!confirm(`Sign out of ${user.displayName || user.email}? Your picks and meal plan stay saved in your account.`)) return;
  clearTimeout(saveTimer);
  await cloudSave();
  // Detach from the account first so clearing this device below can never be saved over it.
  user = null;
  stopPeople?.(); stopPeople = null;
  await firebase.auth().signOut();
  // The device copy belonged to that account; start the next person with a clean slate.
  picks = {}; plan = {};
  save();
  store.set("owner", null);
  syncPicks();
  renderAccount();
}
$("signOut").addEventListener("click", signOut);
$("acctBtn").addEventListener("click", () => {
  if (user) return signOut();
  $("sMsg").textContent = "";
  $("signin").showModal();
});
$("sCancel").addEventListener("click", () => $("signin").close());
$("sGo").addEventListener("click", async () => {
  try {
    await googleSignIn();
    $("signin").close();
  } catch (e) {
    $("sMsg").textContent = `Sign-in didn't work (${e.code || e.message}).`;
  }
});
