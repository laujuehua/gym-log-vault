// Gym Log dashboard views (Dataview + Charts plugin).
// Use in any note:
//   ```dataviewjs
//   await dv.view("Scripts/gym", { show: "summary" })
//   ```
// show: summary | recent | bodyweight | volume | wellbeing | prs | exercise
// Optional: days (look-back window, default 90), name (exercise name; defaults to the note's title)

const SESSIONS = '"Sessions"';
const DAILY = '"Daily"';
const show = input?.show ?? "summary";
const days = input?.days ?? 90;
const today = dv.date("today");
const since = today.minus({ days });

// ---------- helpers ----------
const arr = x => x == null ? [] : Array.isArray(x) ? x : (typeof x.array === "function" ? x.array() : [x]);
const iso = d => (d && d.toISODate) ? d.toISODate() : String(d ?? "").slice(0, 10);
const r1 = x => Math.round(x * 10) / 10;
const num = x => (x === null || x === undefined || x === "") ? null : Number(x);

// "60x8", "62.5 x 6", "BWx10", "60x8x3" (= 3 sets of 8 at 60 kg)
function parseSets(list) {
  const out = [];
  for (const raw of arr(list)) {
    const s = String(raw).trim().toLowerCase().replace(/kg/g, "").replace(/×/g, "x");
    const m = s.match(/^(bw|[\d.]+)\s*x\s*(\d+)(?:\s*x\s*(\d+))?$/);
    if (!m) continue;
    const bw = m[1] === "bw";
    const kg = bw ? 0 : parseFloat(m[1]);
    const reps = parseInt(m[2]);
    const n = m[3] ? parseInt(m[3]) : 1;
    for (let i = 0; i < n; i++) out.push({ kg, reps, bw });
  }
  return out;
}

// Epley estimated 1-rep max; only trusted for 1–12 reps
const e1rm = (kg, reps) => (kg > 0 && reps > 0 && reps <= 12) ? (reps === 1 ? kg : kg * (1 + reps / 30)) : 0;

function chart(config) {
  if (typeof window.renderChart !== "function") {
    dv.paragraph("⚠️ Install and enable the **Charts** community plugin (by phibr0) to see this chart.");
    return;
  }
  window.renderChart(config, dv.container);
}

// ---------- load data ----------
const sessions = dv.pages(SESSIONS).where(p => p.date).sort(p => p.date, "asc").array().map(p => {
  const exercises = arr(p.exercises).map(e => {
    const sets = parseSets(e?.sets);
    return {
      name: String(e?.name ?? "").trim(),
      sets,
      volume: sets.reduce((a, s) => a + s.kg * s.reps, 0),
      best: Math.max(0, ...sets.map(s => e1rm(s.kg, s.reps))),
      top: Math.max(0, ...sets.map(s => s.kg)),
      raw: arr(e?.sets).join(", "),
    };
  }).filter(e => e.name);
  return {
    page: p,
    date: p.date,
    exercises,
    volume: exercises.reduce((a, e) => a + e.volume, 0),
    sets: exercises.reduce((a, e) => a + e.sets.length, 0),
    cardio: arr(p.cardio).reduce((a, c) => a + (Number(c?.minutes) || 0), 0),
  };
});

const daily = dv.pages(DAILY).where(p => p.date).sort(p => p.date, "asc").array();

// body weight can be logged in a daily check-in or on a session note
const weights = [...daily, ...sessions.map(s => s.page)]
  .filter(p => num(p.bodyweight_kg) !== null)
  .map(p => ({ date: p.date, kg: num(p.bodyweight_kg) }))
  .sort((a, b) => a.date.toMillis() - b.date.toMillis());

// ---------- views ----------
if (show === "summary") {
  const last = sessions.at(-1);
  const in7 = sessions.filter(s => s.date >= today.minus({ days: 7 })).length;
  const in30 = sessions.filter(s => s.date >= today.minus({ days: 30 })).length;
  const lastW = weights.at(-1);
  const w30 = weights.filter(w => w.date >= today.minus({ days: 30 }))[0];
  const mood7 = daily.filter(d => d.date >= today.minus({ days: 7 }) && num(d.mood) !== null);
  const avgMood = mood7.length ? r1(mood7.reduce((a, d) => a + num(d.mood), 0) / mood7.length) : "–";
  const rows = [
    ["Last session", last ? `${iso(last.date)} · ${last.page.workout ?? ""} (${Math.round(today.diff(last.date, "days").days)} days ago)` : "–"],
    ["Sessions, last 7 days", in7],
    ["Sessions, last 30 days", in30],
    ["Body weight (latest)", lastW ? `${lastW.kg} kg on ${iso(lastW.date)}` : "–"],
    ["Body weight change, 30 days", (lastW && w30) ? `${lastW.kg - w30.kg >= 0 ? "+" : ""}${r1(lastW.kg - w30.kg)} kg` : "–"],
    ["Average mood, last 7 days", avgMood],
    ["Sessions logged in total", sessions.length],
  ];
  dv.table(["", "Value"], rows);
}

else if (show === "recent") {
  const n = input?.n ?? 10;
  dv.table(
    ["Date", "Workout", "Exercises", "Sets", "Volume (kg)", "Cardio (min)", "Rating"],
    sessions.slice(-n).reverse().map(s => [
      s.page.file.link, s.page.workout ?? "", s.exercises.length, s.sets,
      Math.round(s.volume), s.cardio || "", s.page.rating ? "★".repeat(Number(s.page.rating)) : "",
    ])
  );
}

else if (show === "bodyweight") {
  const pts = weights.filter(w => w.date >= since);
  if (!pts.length) { dv.paragraph("No body weight logged in this period."); }
  else {
    const avg = pts.map((_, i) => {
      const win = pts.slice(Math.max(0, i - 6), i + 1);
      return r1(win.reduce((a, w) => a + w.kg, 0) / win.length);
    });
    chart({
      type: "line",
      data: {
        labels: pts.map(w => iso(w.date)),
        datasets: [
          { label: "Body weight (kg)", data: pts.map(w => w.kg), pointRadius: 3, borderWidth: 1, showLine: false },
          { label: "Rolling average (7 entries)", data: avg, pointRadius: 0, borderWidth: 2, tension: 0.3 },
        ],
      },
      options: { scales: { y: { title: { display: true, text: "kg" } } } },
    });
  }
}

else if (show === "volume") {
  const weeks = new Map();
  for (let w = since.startOf("week"); w <= today; w = w.plus({ weeks: 1 })) weeks.set(iso(w), { vol: 0, n: 0 });
  for (const s of sessions.filter(s => s.date >= since)) {
    const k = iso(s.date.startOf("week"));
    if (!weeks.has(k)) weeks.set(k, { vol: 0, n: 0 });
    weeks.get(k).vol += s.volume; weeks.get(k).n += 1;
  }
  const keys = [...weeks.keys()].sort();
  chart({
    type: "bar",
    data: {
      labels: keys.map(k => `wk of ${k}`),
      datasets: [
        { type: "bar", label: "Volume (kg × reps)", data: keys.map(k => Math.round(weeks.get(k).vol)), yAxisID: "y" },
        { type: "line", label: "Sessions", data: keys.map(k => weeks.get(k).n), yAxisID: "y1", tension: 0.2 },
      ],
    },
    options: {
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "kg" } },
        y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, ticks: { stepSize: 1 }, title: { display: true, text: "sessions" } },
      },
    },
  });
}

else if (show === "wellbeing") {
  const pts = daily.filter(d => d.date >= since);
  if (!pts.length) { dv.paragraph("No daily check-ins in this period."); }
  else {
    chart({
      type: "line",
      data: {
        labels: pts.map(d => iso(d.date)),
        datasets: [
          { label: "Mood", data: pts.map(d => num(d.mood)), tension: 0.3, spanGaps: true },
          { label: "Energy", data: pts.map(d => num(d.energy)), tension: 0.3, spanGaps: true },
          { label: "Sleep", data: pts.map(d => num(d.sleep)), tension: 0.3, spanGaps: true },
        ],
      },
      options: { scales: { y: { min: 1, max: 5, ticks: { stepSize: 1 } } } },
    });
  }
}

else if (show === "prs") {
  const by = new Map();
  for (const s of sessions) for (const e of s.exercises) {
    const k = e.name.toLowerCase();
    const r = by.get(k) ?? { name: e.name, best: 0, bestDate: null, top: 0, topDate: null, n: 0, last: null };
    if (e.best > r.best) { r.best = e.best; r.bestDate = s.date; }
    if (e.top > r.top) { r.top = e.top; r.topDate = s.date; }
    r.n += 1; r.last = s.date;
    by.set(k, r);
  }
  const rows = [...by.values()].sort((a, b) => b.last.toMillis() - a.last.toMillis());
  dv.table(
    ["Exercise", "Best est. 1RM", "Heaviest set", "Times done", "Last done"],
    rows.map(r => [
      dv.fileLink(`Exercises/${r.name}`, false, r.name),
      r.best ? `${r1(r.best)} kg (${iso(r.bestDate)})` : "–",
      r.top ? `${r.top} kg (${iso(r.topDate)})` : "bodyweight",
      r.n, iso(r.last),
    ])
  );
}

else if (show === "exercise") {
  const name = (input?.name ?? dv.current().file.name).toLowerCase();
  const hist = sessions
    .map(s => ({ s, e: s.exercises.find(e => e.name.toLowerCase() === name) }))
    .filter(x => x.e);
  if (!hist.length) { dv.paragraph(`No sessions found with an exercise named "${name}". Check the spelling matches the session notes.`); }
  else {
    chart({
      type: "line",
      data: {
        labels: hist.map(x => iso(x.s.date)),
        datasets: [
          { label: "Est. 1RM (kg)", data: hist.map(x => x.e.best ? r1(x.e.best) : null), tension: 0.3, spanGaps: true },
          { label: "Heaviest set (kg)", data: hist.map(x => x.e.top || null), tension: 0.3, spanGaps: true },
        ],
      },
    });
    dv.table(
      ["Date", "Sets", "Heaviest", "Est. 1RM", "Volume"],
      hist.slice().reverse().map(x => [
        x.s.page.file.link, x.e.raw, x.e.top ? `${x.e.top} kg` : "BW",
        x.e.best ? `${r1(x.e.best)} kg` : "–", Math.round(x.e.volume),
      ])
    );
  }
}

else {
  dv.paragraph(`Unknown view "${show}".`);
}
