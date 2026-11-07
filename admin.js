// Family page: every signed-in person's picks and meal plans, by dish and by person.
// Anyone past the Cloudflare Access gate (the Family list) can see this; data comes from /api/state.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MEALS = [["lunch", "Lunch"], ["dinner", "Dinner"]];
const fmtDate = (ms) => new Date(ms).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
const fmtDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" }); };

let dishes = {}, order = [], me = null;

function setStatus(msg) { $("status").textContent = msg; }

function chip(p, extra = "") {
  return `<span class="person-chip${p.email === me ? " me" : ""}">${esc(p.name || p.email)}${p.email === me ? " (you)" : ""}${extra}</span>`;
}

function renderByDish(people) {
  const rows = order.map((id) => {
    const pickedBy = people.filter((p) => p.picks?.[id]).sort((a, b) => a.picks[id] - b.picks[id]);
    const plannedBy = people.map((p) => {
      const days = Object.entries(p.plan || {}).filter(([, m]) => MEALS.some(([k]) => m[k]?.includes(id))).map(([d]) => d).sort();
      return days.length ? { p, days } : null;
    }).filter(Boolean);
    return { id, pickedBy, plannedBy };
  }).filter((r) => r.pickedBy.length || r.plannedBy.length)
    .sort((a, b) => (b.pickedBy.length + b.plannedBy.length) - (a.pickedBy.length + a.plannedBy.length));

  if (!rows.length) { $("byDish").innerHTML = '<p class="empty">Nobody has added a dish yet.</p>'; return; }
  $("byDish").innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Dish</th><th class="num">Picks</th><th>Picked by</th><th class="num">Planned</th><th>In meal plans of</th></tr></thead>
    <tbody>${rows.map(({ id, pickedBy, plannedBy }) => `<tr>
      <td class="dish"><div class="dishcell"><img src="images/${id}.jpg" alt=""><span>${esc(dishes[id].en)}<br><small class="zh">${esc(dishes[id].zh)}</small></span></div></td>
      <td class="num">${pickedBy.length}</td>
      <td data-label="Picked by"><div class="who">${pickedBy.map((p) => chip(p, ` <span class="when">${fmtDate(p.picks[id])}</span>`)).join("")}</div></td>
      <td class="num">${plannedBy.length}</td>
      <td data-label="Planned by"><div class="who">${plannedBy.map(({ p, days }) => chip(p, ` <span class="when">${days.map(fmtDay).join(", ")}</span>`)).join("")}</div></td>
    </tr>`).join("")}</tbody></table></div>`;
}

function renderByPerson(people) {
  if (!people.length) { $("byPerson").innerHTML = '<p class="empty">Nobody has signed in yet.</p>'; return; }
  $("byPerson").innerHTML = `<div class="people">${people.map((p) => {
    const picks = Object.entries(p.picks || {}).filter(([id]) => dishes[id]).sort((a, b) => a[1] - b[1]);
    const days = Object.keys(p.plan || {}).sort();
    return `<article class="person">
      <header>
        <div><h3>${esc(p.name || "(no name)")}${p.email === me ? " (you)" : ""}</h3><div class="email">${esc(p.email)}</div>
        ${p.updatedAt ? `<div class="updated">Last change ${fmtDate(p.updatedAt)}</div>` : ""}</div></header>
      <h4>Picks (${picks.length})</h4>
      ${picks.length ? `<ul>${picks.map(([id, t]) => `<li>${esc(dishes[id].en)} <small class="zh">${esc(dishes[id].zh)}</small> <span class="when">added ${fmtDate(t)}</span></li>`).join("")}</ul>` : '<p class="note">None</p>'}
      <h4>Meal plan</h4>
      ${days.length ? `<ul>${days.map((d) => `<li><strong>${fmtDay(d)}</strong> — ${MEALS.filter(([k]) => p.plan[d][k]?.length)
        .map(([k, label]) => `${label}: ${p.plan[d][k].filter((id) => dishes[id]).map((id) => esc(dishes[id].en)).join(", ")}`).join("; ")}</li>`).join("")}</ul>` : '<p class="note">Nothing planned</p>'}
    </article>`;
  }).join("")}</div>`;
}

async function load() {
  setStatus("Loading…");
  try {
    const r = await fetch("/api/state");
    if (!r.ok) throw new Error(r.status === 503 ? "storage isn't connected yet — see SETUP.md" : `error ${r.status}`);
    const data = await r.json();
    me = data.me;
    const people = data.people.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    renderByDish(people);
    renderByPerson(people);
    setStatus(`${people.length} ${people.length === 1 ? "person has" : "people have"} used the menu.`);
  } catch (e) {
    $("byDish").innerHTML = $("byPerson").innerHTML = "";
    setStatus(`Couldn't load who picked what (${e.message}). This page only works on the live site.`);
  }
}

document.querySelectorAll("[data-view]").forEach((a) => a.addEventListener("click", (e) => {
  e.preventDefault();
  document.querySelectorAll("[data-view]").forEach((x) => x.classList.toggle("on", x === a));
  $("byDish").hidden = a.dataset.view !== "dish";
  $("byPerson").hidden = a.dataset.view !== "person";
}));

(async () => {
  const menu = await (await fetch("menu.json")).json();
  menu.categories.forEach((c) => c.dishes.forEach((d) => { dishes[d.id] = d; order.push(d.id); }));
  load();
})();
