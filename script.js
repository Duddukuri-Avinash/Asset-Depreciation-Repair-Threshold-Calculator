const $ = id => document.getElementById(id);
const fmt = n => "₹" + Math.round(n).toLocaleString("en-IN");
const iso = d => d.toISOString().slice(0, 10);
const DAY = 864e5, YR = 365.25 * DAY;
const now = new Date();
const back = y => new Date(now.getTime() - y * YR);
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const nm = m => m.name.trim() || "Unnamed machine";

// ---------- Data: a LIST of machines ----------
let machines = [
  {
    name: "Delivery Bike 1", price: 80000, pdate: iso(back(5)), life: 8, repl: 90000, limit: 50,
    repairs: [
      { d: iso(back(3.2)), w: "Brake and chain set", c: 3500 },
      { d: iso(back(1.6)), w: "Clutch replacement", c: 6000 },
      { d: iso(new Date(now.getTime() - 200 * DAY)), w: "Engine overhaul", c: 9000 },
      { d: iso(new Date(now.getTime() - 60 * DAY)), w: "Gearbox repair", c: 5000 }
    ]
  },
  {
    name: "Office Laptop", price: 60000, pdate: iso(back(3)), life: 5, repl: 70000, limit: 50,
    repairs: [{ d: iso(back(1)), w: "Battery change", c: 3000 }]
  }
];
let cur = 0;
$("rd").value = iso(now);

// ---------- Calculations for ONE machine ----------
function calc(m) {
  const age = Math.max(0, (now - new Date(m.pdate || now)) / YR);
  const value = Math.max(0, m.price * (1 - age / m.life));   // straight-line depreciation
  const total = m.repairs.reduce((s, r) => s + r.c, 0);
  const yr = m.repairs
    .filter(r => now - new Date(r.d) <= YR && new Date(r.d) <= now)
    .reduce((s, r) => s + r.c, 0);                            // repairs in last 12 months
  const pct = value > 0 ? yr / value * 100 : (yr > 0 ? Infinity : 0);
  const limA = m.limit / 100 * value;                         // limit 1: % of current value
  const limB = m.repl / m.life;                               // limit 2: yearly cost of a new one
  const over = yr > limA || yr > limB;
  const near = yr > 0.7 * Math.min(limA, limB);
  const level = over ? "r" : near ? "o" : "g";
  return { age, value, total, yr, pct, limA, limB, over, near, level };
}
const dot = l => ({ g: "🟢", o: "🟠", r: "🔴" }[l]);
const word = l => ({ g: "Keep", o: "Watch", r: "Replace" }[l]);

// ---------- Form <-> machine ----------
function loadForm() {
  const m = machines[cur];
  $("name").value = m.name;
  $("price").value = m.price;
  $("pdate").value = m.pdate;
  $("life").value = m.life;
  $("repl").value = m.repl;
  $("limit").value = m.limit;
}
function readForm() {
  const m = machines[cur];
  m.name = $("name").value;
  m.price = +$("price").value || 0;
  m.pdate = $("pdate").value || iso(now);
  m.life = Math.max(1, +$("life").value || 1);
  m.repl = +$("repl").value || 0;
  m.limit = +$("limit").value || 50;
}

// ---------- Draw the page ----------
function render() {
  const m = machines[cur];
  const c = calc(m);

  // Dropdown
  $("picker").innerHTML = machines.map((x, i) => `<option value="${i}">${esc(nm(x))}</option>`).join("");
  $("picker").value = cur;

  // Summary table of all machines
  $("summary").innerHTML = `<tr><th></th><th>Machine</th><th>Worth today</th><th>Repairs (12 mo)</th><th>% of value</th><th>Advice</th></tr>` +
    machines.map((x, i) => {
      const k = calc(x);
      return `<tr class="pick ${i === cur ? "active" : ""}" data-i="${i}">
        <td>${dot(k.level)}</td><td>${esc(nm(x))}</td><td>${fmt(k.value)}</td><td>${fmt(k.yr)}</td>
        <td>${k.pct === Infinity ? "∞" : k.pct.toFixed(0) + "%"}</td><td>${word(k.level)}</td></tr>`;
    }).join("");

  // Alert box
  const colors = { g: "var(--g)", o: "var(--o)", r: "var(--r)" };
  let title = "🟢 Keep it. Repairs are small.";
  let msg = "Repair spending this year is well below your limits.";
  if (c.over) {
    title = "🔴 Replace it. You are wasting money.";
    msg = (c.yr > c.limA ? `Repairs this year (${fmt(c.yr)}) are above ${m.limit}% of the machine's value (${fmt(c.limA)}). ` : "") +
          (c.yr > c.limB ? `They are also above the yearly cost of owning a new one (${fmt(c.limB)}).` : "");
  } else if (c.near) {
    title = "🟠 Watch it. Repairs are getting high.";
    msg = "You are close to a replacement limit. One more big repair could tip it.";
  }
  $("alert").style.background = colors[c.level];
  $("alert").innerHTML = `<h2>${esc(nm(m))}: ${title}</h2><p>${msg}</p>`;

  // Number boxes
  const S = [
    ["Worth today", fmt(c.value)],
    ["Total repairs, ever", fmt(c.total)],
    ["Repairs, last 12 months", fmt(c.yr)],
    ["Repairs as % of value", c.pct === Infinity ? "∞" : c.pct.toFixed(0) + "%"],
    ["Asset age", c.age.toFixed(1) + " yrs"],
    ["New machine yearly cost", fmt(c.limB)]
  ];
  $("stats").innerHTML = S.map(s => `<div class="stat"><b>${s[1]}</b><span>${s[0]}</span></div>`).join("");

  // Repair table
  const sorted = m.repairs.map((r, i) => ({ ...r, i })).sort((a, b) => (a.d < b.d ? 1 : -1));
  $("log").innerHTML = sorted.length
    ? `<tr><th>Date</th><th>Repair</th><th>Cost</th><th></th></tr>` +
      sorted.map(r => `<tr><td>${r.d}</td><td>${esc(r.w)}</td><td>${fmt(r.c)}</td><td><button class="x" data-i="${r.i}" title="Delete">×</button></td></tr>`).join("")
    : `<tr><td style="color:var(--mute)">No repairs logged yet.</td></tr>`;

  drawChart(m, c);
}

function drawChart(m, c) {
  const W = 640, H = 300, L = 60, B = 30, T = 14, R = 14;
  const pd = new Date(m.pdate || now);
  const maxT = Math.max(m.life, Math.ceil(c.age) + 1);
  const cum = t => m.repairs.filter(r => (new Date(r.d) - pd) / YR <= t).reduce((s, r) => s + r.c, 0);
  const maxY = Math.max(m.price, cum(c.age), 1) * 1.05;
  const X = t => L + t / maxT * (W - L - R);
  const Y = v => H - B - v / maxY * (H - B - T);

  let vp = "", rp = "";
  for (let t = 0; t <= maxT + 1e-9; t += 0.1)
    vp += `${X(t).toFixed(1)},${Y(Math.max(0, m.price * (1 - t / m.life))).toFixed(1)} `;
  for (let t = 0; t <= c.age + 1e-9; t += 0.05)
    rp += `${X(t).toFixed(1)},${Y(cum(t)).toFixed(1)} `;
  rp += `${X(c.age).toFixed(1)},${Y(cum(c.age)).toFixed(1)}`;

  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const v = maxY * i / 4;
    grid += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="var(--mute)">${Math.round(v / 1000)}k</text>`;
  }
  for (let t = 0; t <= maxT; t++)
    grid += `<text x="${X(t)}" y="${H - 10}" text-anchor="middle" font-size="10" fill="var(--mute)">Yr ${t}</text>`;

  $("chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Asset value falling and cumulative repair cost rising">${grid}
    <polyline points="${vp}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
    <polyline points="${rp}" fill="none" stroke="var(--r)" stroke-width="2.5"/>
    <line x1="${X(c.age)}" x2="${X(c.age)}" y1="${T}" y2="${H - B}" stroke="var(--mute)" stroke-dasharray="4 4"/>
    <circle cx="${X(c.age)}" cy="${Y(c.value)}" r="4" fill="var(--accent)"/>
    <circle cx="${X(c.age)}" cy="${Y(cum(c.age))}" r="4" fill="var(--r)"/></svg>`;
}

// ---------- Buttons and typing ----------
["name", "price", "pdate", "life", "repl", "limit"].forEach(id =>
  $(id).addEventListener("input", () => { readForm(); render(); })
);

$("picker").onchange = () => { cur = +$("picker").value; loadForm(); render(); };

$("summary").onclick = e => {
  const row = e.target.closest("tr.pick");
  if (row) { cur = +row.dataset.i; loadForm(); render(); }
};

$("addMachine").onclick = () => {
  machines.push({ name: "", price: 50000, pdate: iso(now), life: 5, repl: 50000, limit: 50, repairs: [] });
  cur = machines.length - 1;
  loadForm(); render();
  $("name").focus();
};

$("delMachine").onclick = () => {
  if (machines.length === 1) { alert("You need at least one machine."); return; }
  if (!confirm("Delete " + nm(machines[cur]) + "?")) return;
  machines.splice(cur, 1);
  cur = 0;
  loadForm(); render();
};

$("add").onclick = () => {
  const c = +$("rc").value, w = $("rw").value.trim() || "Repair", d = $("rd").value;
  if (!(c > 0) || !d) { alert("Please enter a date and a cost above 0."); return; }
  machines[cur].repairs.push({ d, w, c });
  $("rw").value = ""; $("rc").value = "";
  render();
};

$("clear").onclick = () => { machines[cur].repairs = []; render(); };

$("log").onclick = e => {
  const i = e.target.dataset.i;
  if (i !== undefined) { machines[cur].repairs.splice(+i, 1); render(); }
};

loadForm();
render();