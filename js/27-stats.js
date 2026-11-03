// ---------- site stats (admins only) ----------
// One database call (admin_stats, from supabase/stats-setup.sql) returns totals, the last 8 weeks,
// AI use and the most loved drinks. Visitor traffic lives in Cloudflare Web Analytics instead.
const AI_LABELS = { ask: "Ask the bartender", scan: "Scan a recipe", standard: "Classic lookups", mocktail: "Mocktails",
  bottles: "Stock my bottles", bottle: "Bottle guide", swap: "Ingredient swaps", idea: "Drink ideas" };
function openStats() {
  S.view = "stats"; S.stats = null; S.statsErr = ""; setHash("stats");
  renderList(); renderMain(); window.scrollTo({ top: 0 });
  loadStats();
}
HASH_VIEWS.stats = openStats;
async function loadStats() {
  if (!sb || !S.isAdmin) return;
  const { data, error } = await sb.rpc("admin_stats");
  if (S.view !== "stats") return;
  if (error) S.statsErr = /not found|PGRST202|does not exist/i.test(error.message || error.code || "")
    ? "Stats aren't set up yet. Run supabase/stats-setup.sql in the Supabase SQL Editor, then reload."
    : "Couldn't load stats. Try again.";
  else S.stats = data;
  renderMain();
}
VIEWS.stats = function renderStats() {
  const m = $("main");
  const head = `<div class="editor-top"><div><span class="label">Admin</span><h2 class="make-title">Site stats</h2></div>
    <button class="btn small" type="button" id="st-back">Back to My Cocktail Cart</button></div>`;
  if (!S.isAdmin) { m.innerHTML = `<div class="make">${head}<p class="hint">Only site admins can see stats.</p></div>`; wireStats(); return; }
  const st = S.stats;
  if (!st) { m.innerHTML = `<div class="make">${head}<p class="hint">${esc(S.statsErr || "Counting…")}</p></div>`; wireStats(); return; }
  const t = st.totals || {}, num = v => Number(v || 0).toLocaleString();
  const tiles = [["Members", t.members], ["Signed in this week", t.active_7d], ["Drinks", t.drinks], ["Drink photos", t.drink_photos],
    ["Classics", t.classics], ["Ratings", t.ratings], ["Favorites", t.favorites], ["Bottle photos", t.bottle_photos],
    ["Bottle comments", t.bottle_reviews], ["Lists", t.lists], ["Follows", t.follows]];
  const weeks = st.weeks || [];
  const bars = (key, label) => {
    const max = Math.max(1, ...weeks.map(w => Number(w[key] || 0)));
    return `<div class="st-chart"><h4>${label}</h4><div class="st-bars">${weeks.map(w => {
      const v = Number(w[key] || 0), d = new Date(w.week + "T12:00:00");
      const lbl = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return `<div class="st-bar" title="Week of ${esc(lbl)}: ${v}"><span class="st-v">${v}</span><span class="st-fill" style="height:${Math.round(v / max * 100)}%"></span><span class="st-wk">${esc(lbl)}</span></div>`;
    }).join("")}</div></div>`;
  };
  const ai = Object.entries(st.ai_30d || {}).sort((a, b) => b[1] - a[1]);
  const list = (rows, fmt) => rows.length ? `<ol class="st-list">${rows.map(r => `<li><button type="button" class="linkish" data-open="${esc(r.id)}">${esc(r.name)}</button> <span class="hint">${fmt(r)}</span></li>`).join("")}</ol>` : `<p class="hint">Not enough yet.</p>`;
  m.innerHTML = `<div class="make stats">${head}
    <section class="make-sec"><div class="st-tiles">${tiles.map(([l, v]) => `<div class="st-tile"><b>${num(v)}</b><span>${l}</span></div>`).join("")}</div></section>
    <section class="make-sec"><div class="sec-head"><h3>Last 8 weeks</h3></div>
      <div class="st-charts">${bars("signups", "New members")}${bars("drinks", "Drinks added")}${bars("ai", "AI requests")}</div></section>
    <section class="make-sec"><div class="sec-head"><h3>AI use</h3></div>
      <p class="hint" style="margin:0">${num(st.ai_today)} requests in the last 24 hours${Number(st.at_limit_today) ? ` · ${num(st.at_limit_today)} ${Number(st.at_limit_today) === 1 ? "person" : "people"} hit the daily limit` : ""}.</p>
      ${ai.length ? `<table class="st-table"><thead><tr><th>Last 30 days</th><th>Requests</th></tr></thead><tbody>${ai.map(([k, n]) => `<tr><td>${esc(AI_LABELS[k] || k)}</td><td>${num(n)}</td></tr>`).join("")}</tbody></table>` : `<p class="hint">No AI requests in the last 30 days.</p>`}</section>
    <section class="make-sec st-two">
      <div><div class="sec-head"><h3>Top rated</h3></div>${list(st.top_rated || [], r => `★ ${Number(r.avg).toFixed(1)} · ${r.n} ratings`)}</div>
      <div><div class="sec-head"><h3>Most favorited</h3></div>${list(st.most_saved || [], r => `♥ ${r.n}`)}</div>
    </section>
    <p class="hint">Visitor counts, pages and where people come from are in Cloudflare: dashboard › Analytics &amp; Logs › Web Analytics.</p>
  </div>`;
  wireStats();
};
function wireStats() {
  const m = $("main");
  if ($("st-back")) $("st-back").onclick = () => { openProfile(); window.scrollTo({ top: 0 }); };
  m.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { if (allDrinks().some(d => d.id === b.dataset.open)) selectDrink(b.dataset.open); else toast("That drink is gone."); });
}

// ---------- Cloudflare Web Analytics (visitor counts) ----------
// Paste the token from Cloudflare (Web Analytics > your site > the "token" in the JS snippet) between the quotes.
// No cookies and nothing that identifies a person. Leave empty to turn it off.
const CF_BEACON_TOKEN = "";
if (CF_BEACON_TOKEN && location.protocol === "https:") {
  const s = document.createElement("script");
  s.defer = true; s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.setAttribute("data-cf-beacon", JSON.stringify({ token: CF_BEACON_TOKEN }));
  document.head.appendChild(s);
}
