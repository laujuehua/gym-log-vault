// Gym Log entry forms: key in or edit data inside Obsidian, no YAML editing.
// Use in a note:
//   ```dataviewjs
//   await dv.view("Scripts/log", { form: "daily" })     // or "workout"
//   ```
// Pick a date: if a note for that date exists, the form loads it for editing.
// Saving writes Daily/YYYY-MM-DD.md or Sessions/YYYY-MM-DD.md (created if missing).

const app = dv.app;
const form = input?.form ?? "daily";
const root = dv.container;
const today = dv.date("today").toISODate();
window.__gymLogDate = window.__gymLogDate || {};

// ---------- tiny DOM helpers ----------
function el(tag, attrs = {}, parent = null, text = null) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === "style") e.style.cssText = v;
    else if (k in e && k !== "list") e[k] = v;
    else e.setAttribute(k, v);
  }
  if (text !== null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function field(parent, label, input, hint) {
  const wrap = el("label", { class: "gl-field" }, parent);
  el("span", { class: "gl-label" }, wrap, label);
  wrap.appendChild(input);
  if (hint) el("span", { class: "gl-hint" }, wrap, hint);
  return input;
}
function select15(blank = "–") {
  const s = el("select", {});
  el("option", { value: "" }, s, blank);
  for (let i = 1; i <= 5; i++) el("option", { value: String(i) }, s, String(i));
  return s;
}
function datalist(id, values) {
  const dl = el("datalist", { id }, root);
  for (const v of [...new Set(values)].filter(Boolean).sort()) el("option", { value: v }, dl);
  return id;
}

// ---------- styles (scoped to this form) ----------
el("style", {}, root, `
.gl-form { border: 1px solid var(--background-modifier-border); border-radius: 10px; padding: 14px; margin: 6px 0 14px; }
.gl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px 12px; }
.gl-field { display: flex; flex-direction: column; gap: 3px; font-size: var(--font-ui-small); }
.gl-label { color: var(--text-muted); font-weight: 600; }
.gl-hint { color: var(--text-faint); font-size: var(--font-ui-smaller); }
.gl-field input, .gl-field select, .gl-field textarea { width: 100%; }
.gl-rows { display: flex; flex-direction: column; gap: 6px; margin: 6px 0; }
.gl-row { display: grid; grid-template-columns: minmax(120px, 1.2fr) minmax(160px, 2fr) auto; gap: 6px; align-items: center; }
.gl-row.cardio { grid-template-columns: minmax(120px, 2fr) minmax(70px, 1fr) auto; }
.gl-row .gl-check { grid-column: 1 / -1; font-size: var(--font-ui-smaller); color: var(--text-muted); margin-top: -3px; }
.gl-row .gl-check.bad { color: var(--text-error); }
.gl-h { font-weight: 700; margin: 12px 0 2px; }
.gl-actions { display: flex; gap: 8px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
.gl-status { font-size: var(--font-ui-small); color: var(--text-muted); }
.gl-status.ok { color: var(--color-green); } .gl-status.bad { color: var(--text-error); }
@media (max-width: 500px) { .gl-row { grid-template-columns: 1fr auto; } .gl-row > :nth-child(2) { grid-column: 1 / 2; grid-row: 2; } }
`);

// ---------- vault helpers ----------
const getFile = path => app.vault.getAbstractFileByPath(path);
const readFM = path => { const f = getFile(path); return f ? (app.metadataCache.getFileCache(f)?.frontmatter ?? {}) : null; };
async function ensureFolder(folder) { if (folder && !getFile(folder)) await app.vault.createFolder(folder); }
async function getOrCreate(path, body = "") {
  let f = getFile(path);
  if (!f) { await ensureFolder(path.split("/").slice(0, -1).join("/")); f = await app.vault.create(path, `---\n---\n${body}`); }
  return f;
}
function put(fm, key, val) {
  const empty = val === "" || val === null || val === undefined || (Array.isArray(val) && !val.length) || Number.isNaN(val);
  if (empty) delete fm[key]; else fm[key] = val;
}
const numOrNull = v => (v === "" || v === null || v === undefined) ? null : Number(v);
const toTime = v => {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") { const h = Math.floor(v / 60), m = v % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; } // YAML 1.1 sexagesimal fallback
  const m = String(v).match(/^(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
};
function sleepHours(bed, wake) {
  if (!bed || !wake) return null;
  const [bh, bm] = bed.split(":").map(Number), [wh, wm] = wake.split(":").map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round(mins / 6) / 10;
}

// same set format the dashboard reads: "60x8", "62.5 x 6", "BWx10", "60x8x3"
function checkSets(text) {
  const tokens = String(text).split(",").map(t => t.trim()).filter(Boolean);
  let sets = 0, vol = 0; const bad = [];
  for (const t of tokens) {
    const m = t.toLowerCase().replace(/kg/g, "").replace(/×/g, "x").match(/^(bw|[\d.]+)\s*x\s*(\d+)(?:\s*x\s*(\d+))?$/);
    if (!m) { bad.push(t); continue; }
    const n = m[3] ? parseInt(m[3]) : 1;
    sets += n; vol += (m[1] === "bw" ? 0 : parseFloat(m[1])) * parseInt(m[2]) * n;
  }
  return { tokens, sets, vol, bad };
}

// ---------- date row (shared) ----------
function dateRow(box, onLoad) {
  const grid = el("div", { class: "gl-grid" }, box);
  const date = field(grid, "Date", el("input", { type: "date", value: window.__gymLogDate[form] || today }));
  const info = el("div", { class: "gl-hint", style: "align-self:end; padding-bottom:6px" }, grid);
  const load = () => { window.__gymLogDate[form] = date.value; onLoad(date.value, info); };
  date.addEventListener("change", load);
  return { date, load };
}

// =====================================================================
// DAILY CHECK-IN
// =====================================================================
if (form === "daily") {
  const box = el("div", { class: "gl-form" }, root);
  const status = el("span", { class: "gl-status" });
  let F = {};

  const { date, load } = dateRow(box, (d, info) => {
    const fm = readFM(`Daily/${d}.md`);
    info.textContent = fm ? "Editing existing check-in" : "New check-in";
    const v = fm ?? {};
    F.weight.value = v.bodyweight_kg ?? "";
    F.bed.value = toTime(v.bedtime);
    F.wake.value = toTime(v.wake_time);
    F.hours.value = (v.bedtime && v.wake_time) ? "" : (v.sleep_hours ?? "");
    F.quality.value = v.sleep_quality ?? v.sleep ?? "";
    F.mood.value = v.mood ?? ""; F.energy.value = v.energy ?? "";
    F.note.value = v.note ?? "";
    updateHours(); status.textContent = ""; status.className = "gl-status";
  });

  el("div", { class: "gl-h" }, box, "Body");
  const g1 = el("div", { class: "gl-grid" }, box);
  F.weight = field(g1, "Body weight (kg)", el("input", { type: "number", step: "0.1", min: "20", max: "300", inputMode: "decimal" }));

  el("div", { class: "gl-h" }, box, "Sleep (last night)");
  const g2 = el("div", { class: "gl-grid" }, box);
  F.bed = field(g2, "Bedtime", el("input", { type: "time" }));
  F.wake = field(g2, "Wake time", el("input", { type: "time" }));
  F.hours = field(g2, "Hours slept", el("input", { type: "number", step: "0.1", min: "0", max: "24", inputMode: "decimal" }), "Auto from bed/wake; or type it");
  F.quality = field(g2, "Sleep quality (1–5)", select15());
  const updateHours = () => {
    const h = sleepHours(F.bed.value, F.wake.value);
    F.hours.placeholder = h !== null ? String(h) : "";
    F.hours.disabled = h !== null;
    if (h !== null) F.hours.value = "";
  };
  F.bed.addEventListener("change", updateHours); F.wake.addEventListener("change", updateHours);

  el("div", { class: "gl-h" }, box, "How you feel");
  const g3 = el("div", { class: "gl-grid" }, box);
  F.mood = field(g3, "Mood (1–5)", select15());
  F.energy = field(g3, "Energy (1–5)", select15());
  F.note = field(el("div", { style: "margin-top:10px" }, box), "Note", el("textarea", { rows: 2 }));

  const actions = el("div", { class: "gl-actions" }, box);
  const save = el("button", { class: "mod-cta" }, actions, "Save check-in");
  actions.appendChild(status);

  save.addEventListener("click", async () => {
    try {
      const d = date.value; if (!d) throw new Error("Pick a date");
      const f = await getOrCreate(`Daily/${d}.md`);
      const bed = F.bed.value, wake = F.wake.value;
      const hours = sleepHours(bed, wake) ?? numOrNull(F.hours.value);
      await app.fileManager.processFrontMatter(f, fm => {
        fm.date = d;
        put(fm, "bodyweight_kg", numOrNull(F.weight.value));
        put(fm, "bedtime", bed); put(fm, "wake_time", wake);
        put(fm, "sleep_hours", hours);
        put(fm, "sleep_quality", numOrNull(F.quality.value));
        delete fm.sleep; // old field name
        put(fm, "mood", numOrNull(F.mood.value)); put(fm, "energy", numOrNull(F.energy.value));
        put(fm, "note", F.note.value.trim());
      });
      status.textContent = `✓ Saved ${d}`; status.className = "gl-status ok";
    } catch (e) { status.textContent = `⚠ ${e.message}`; status.className = "gl-status bad"; }
  });

  load();
}

// =====================================================================
// WORKOUT
// =====================================================================
else if (form === "workout") {
  const sessions = dv.pages('"Sessions"').array();
  const exNames = [
    ...dv.pages('"Exercises"').array().map(p => p.file.name),
    ...sessions.flatMap(p => (p.exercises ?? []).map(e => e?.name)),
  ];
  const exList = datalist("gl-ex-" + Math.random().toString(36).slice(2), exNames);
  const woList = datalist("gl-wo-" + Math.random().toString(36).slice(2), ["Push", "Pull", "Legs", "Upper", "Lower", "Full body", "Cardio", ...sessions.map(p => p.workout)]);
  const caList = datalist("gl-ca-" + Math.random().toString(36).slice(2), ["Treadmill", "Cycling", "Rowing", "Stairmaster", "Run", "Swim", ...sessions.flatMap(p => (p.cardio ?? []).map(c => c?.type))]);

  const box = el("div", { class: "gl-form" }, root);
  const status = el("span", { class: "gl-status" });
  let F = {};

  const { date, load } = dateRow(box, (d, info) => {
    const fm = readFM(`Sessions/${d}.md`);
    info.textContent = fm ? "Editing existing workout" : "New workout";
    const v = fm ?? {};
    F.workout.value = v.workout ?? ""; F.duration.value = v.duration_min ?? ""; F.rating.value = v.rating ?? "";
    exRows.replaceChildren(); caRows.replaceChildren();
    const ex = Array.isArray(v.exercises) ? v.exercises : [];
    if (ex.length) ex.forEach(e => addEx(e?.name ?? "", (Array.isArray(e?.sets) ? e.sets : [e?.sets ?? ""]).filter(Boolean).join(", ")));
    else { addEx(); addEx(); addEx(); }
    const ca = Array.isArray(v.cardio) ? v.cardio : [];
    ca.filter(c => c?.type || c?.minutes).forEach(c => addCa(c.type ?? "", c.minutes ?? ""));
    status.textContent = ""; status.className = "gl-status";
  });

  const g = el("div", { class: "gl-grid", style: "margin-top:10px" }, box);
  F.workout = field(g, "Workout", el("input", { type: "text", list: woList, placeholder: "Push / Pull / Legs…" }));
  F.workout.setAttribute("list", woList);
  F.duration = field(g, "Duration (min)", el("input", { type: "number", min: "0", step: "5", inputMode: "numeric" }));
  F.rating = field(g, "Rating (1–5 ★)", select15());

  el("div", { class: "gl-h" }, box, "Exercises");
  el("div", { class: "gl-hint" }, box, "Sets as kg x reps, comma-separated: 60x8, 60x8, 62.5x6 · 3 identical sets: 60x8x3 · bodyweight: BWx12");
  const exRows = el("div", { class: "gl-rows" }, box);
  function addEx(name = "", sets = "") {
    const row = el("div", { class: "gl-row" }, exRows);
    const n = el("input", { type: "text", placeholder: "Exercise", value: name }, row); n.setAttribute("list", exList);
    const s = el("input", { type: "text", placeholder: "60x8, 60x8, 62.5x6", value: sets }, row);
    const x = el("button", { title: "Remove", "aria-label": "Remove exercise" }, row, "✕");
    const chk = el("div", { class: "gl-check" }, row);
    const upd = () => {
      if (!s.value.trim()) { chk.textContent = ""; chk.className = "gl-check"; return; }
      const c = checkSets(s.value);
      chk.textContent = c.bad.length ? `⚠ Can't read: ${c.bad.join(", ")}` : `${c.sets} set${c.sets === 1 ? "" : "s"} · ${Math.round(c.vol).toLocaleString()} kg volume`;
      chk.className = c.bad.length ? "gl-check bad" : "gl-check";
    };
    s.addEventListener("input", upd); upd();
    x.addEventListener("click", () => row.remove());
    row._get = () => ({ name: n.value.trim(), sets: checkSets(s.value) });
  }
  el("button", {}, el("div", {}, box), "+ Add exercise").addEventListener("click", () => addEx());

  el("div", { class: "gl-h" }, box, "Cardio");
  const caRows = el("div", { class: "gl-rows" }, box);
  function addCa(type = "", minutes = "") {
    const row = el("div", { class: "gl-row cardio" }, caRows);
    const t = el("input", { type: "text", placeholder: "Type", value: type }, row); t.setAttribute("list", caList);
    const m = el("input", { type: "number", placeholder: "min", min: "0", value: minutes, inputMode: "numeric" }, row);
    el("button", { title: "Remove", "aria-label": "Remove cardio" }, row, "✕").addEventListener("click", () => row.remove());
    row._get = () => ({ type: t.value.trim(), minutes: numOrNull(m.value) });
  }
  el("button", {}, el("div", {}, box), "+ Add cardio").addEventListener("click", () => addCa());

  const actions = el("div", { class: "gl-actions" }, box);
  const save = el("button", { class: "mod-cta" }, actions, "Save workout");
  actions.appendChild(status);

  save.addEventListener("click", async () => {
    try {
      const d = date.value; if (!d) throw new Error("Pick a date");
      const ex = [...exRows.children].map(r => r._get()).filter(e => e.name || e.sets.tokens.length);
      const noName = ex.find(e => !e.name); if (noName) throw new Error("An exercise row has sets but no name");
      const bad = ex.find(e => e.sets.bad.length); if (bad) throw new Error(`Fix the sets for ${bad.name}: ${bad.sets.bad.join(", ")}`);
      const ca = [...caRows.children].map(r => r._get()).filter(c => c.type || c.minutes);

      const f = await getOrCreate(`Sessions/${d}.md`, "## Notes\n\n");
      await app.fileManager.processFrontMatter(f, fm => {
        fm.date = d;
        put(fm, "workout", F.workout.value.trim());
        put(fm, "duration_min", numOrNull(F.duration.value));
        put(fm, "rating", numOrNull(F.rating.value));
        put(fm, "exercises", ex.map(e => ({ name: e.name, sets: e.sets.tokens })));
        put(fm, "cardio", ca.map(c => { const o = { type: c.type }; if (c.minutes !== null) o.minutes = c.minutes; return o; }));
      });

      // give every new exercise its own progress page
      let made = 0;
      for (const e of ex) {
        const p = `Exercises/${e.name.replace(/[\\/:*?"<>|]/g, "-")}.md`;
        if (!getFile(p)) {
          await ensureFolder("Exercises");
          await app.vault.create(p, `---\nmuscle_group:\n---\n# ${e.name}\n\n\`\`\`dataviewjs\nawait dv.view("Scripts/gym", { show: "exercise" })\n\`\`\`\n\n## Cues / form notes\n\n`);
          made++;
        }
      }
      status.textContent = `✓ Saved ${d}${made ? ` · ${made} new exercise page${made > 1 ? "s" : ""}` : ""}`;
      status.className = "gl-status ok";
    } catch (e) { status.textContent = `⚠ ${e.message}`; status.className = "gl-status bad"; }
  });

  load();
}

else dv.paragraph(`Unknown form "${form}". Use "daily" or "workout".`);
