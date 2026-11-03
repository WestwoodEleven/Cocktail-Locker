// ---------- drink views and the home page's Drinks sections ----------
// Views: one count per drink per day (supabase/views-setup.sql), no record of who viewed.
// Trending = most views in the last 7 days.
S.views = {}; S.viewsOff = false;
const _viewed = new Set();
async function loadViews() {
  if (!sb) return;
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await sb.from("drink_views").select("drink_id, views").gte("day", since);
  if (error) { S.viewsOff = true; return; }
  S.viewsOff = false;
  const v = {}; (data || []).forEach(r => { v[r.drink_id] = (v[r.drink_id] || 0) + Number(r.views || 0); });
  S.views = v;
}
const viewsOf = d => S.views[d.id] || 0;
// Count an open once per drink per visit, and never your own drinks.
function recordView(d) {
  if (!sb || !d || !d.id || S.viewsOff || _viewed.has(d.id) || (uid() && isMine(d))) return;
  _viewed.add(d.id);
  try { const k = "mc-viewed"; const seen = JSON.parse(sessionStorage.getItem(k) || "[]"); if (seen.includes(d.id)) return; seen.push(d.id); sessionStorage.setItem(k, JSON.stringify(seen.slice(-300))); } catch (e) {}
  S.views[d.id] = viewsOf(d) + 1;
  sb.rpc("record_view", { p_drink: d.id }).then(() => {}, () => {});
}

// ---------- sections ----------
// Shown on Home when there's no search and no filter. Each section starts at 5 drinks.
S.secShow = {}; S.browseAll = false;
const SEC_STEP = 5, SEC_MAX_INLINE = 15;
function browsing() {
  return S.view === "home" && !S.browseAll && !(S.query || "").trim() && !Object.values(S.f).some(Boolean);
}
function homeSections() {
  const all = allDrinks(), signedIn = !!uid() && S.backend === "supabase";
  const byScore = (a, b) => (score(b) - score(a)) || (ratingOf(b).count - ratingOf(a).count) || (!!a.standard - !!b.standard) || byName(a, b);
  const secs = [];
  if (signedIn) secs.push({ key: "mine", title: "My Drinks", items: sortItems(all.filter(isMine)),
    empty: `<li class="sec-empty"><button type="button" class="linkish" data-sec-new>+ Add your first drink</button></li>`, all: () => { S.f.owner = "mine"; } });
  const hot = all.filter(d => viewsOf(d) > 0).sort((a, b) => (viewsOf(b) - viewsOf(a)) || byScore(a, b));
  if (hot.length) secs.push({ key: "trending", title: "Trending", note: "Most viewed this week", items: hot, all: () => { S.browseAll = true; S.sort = "trending"; } });
  else {
    // No views yet (or view counts not set up): show the newest drinks instead.
    const newest = S.drinks.filter(d => d.updatedAt).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if (newest.length) secs.push({ key: "trending", title: "Recently Added", items: newest, all: () => { S.browseAll = true; S.sort = "new"; } });
  }
  const rated = all.filter(d => ratingOf(d).count > 0).sort(byScore);
  if (rated.length) secs.push({ key: "rated", title: "Highest Rated", items: rated, all: () => { S.browseAll = true; S.sort = "rated"; } });
  const classics = all.filter(d => d.standard).sort((a, b) => (viewsOf(b) - viewsOf(a)) || byScore(a, b));
  if (classics.length) secs.push({ key: "classics", title: "The Classics", items: classics, all: () => { S.f.owner = "std"; } });
  return secs;
}
function sectionsHtml() {
  const secs = homeSections(); S._secs = secs;
  const total = allDrinks().length;
  return secs.map(s => {
    const n = S.secShow[s.key] || SEC_STEP, rows = s.items.slice(0, n);
    const more = s.items.length > n ? (n >= SEC_MAX_INLINE
      ? `<li class="sec-more"><button type="button" class="linkish" data-sec-all="${s.key}">See all ${s.items.length} →</button></li>`
      : `<li class="sec-more"><button type="button" class="linkish" data-sec-more="${s.key}">Show more</button></li>`) : "";
    return `<li class="sec-head-row" id="sec-${s.key}"><h3>${esc(s.title)}</h3>${s.note ? `<span>${esc(s.note)}</span>` : ""}</li>`
      + (rows.length ? rows.map(d => rowHtml(d, false)).join("") : (s.empty || "")) + more;
  }).join("") + `<li class="sec-more sec-all"><button type="button" class="btn small" data-sec-browse>Browse all drinks (${total})</button></li>`;
}
function backToSectionsRow() {
  return S.view === "home" && S.browseAll ? `<li class="sec-more sec-back"><button type="button" class="linkish" data-sec-back>← Back to sections</button></li>` : "";
}
$("list").addEventListener("click", e => {
  const t = e.target.closest("[data-sec-more],[data-sec-all],[data-sec-browse],[data-sec-back],[data-sec-new]"); if (!t) return;
  e.stopPropagation();
  if (t.dataset.secMore) { const k = t.dataset.secMore; S.secShow[k] = (S.secShow[k] || SEC_STEP) + SEC_STEP; renderList(); return; }
  if (t.hasAttribute("data-sec-new")) { openEditor(null); return; }
  if (t.hasAttribute("data-sec-back")) { S.browseAll = false; S.secShow = {}; renderFilters(); renderList(); $("drinks-title").scrollIntoView({ block: "start" }); return; }
  if (t.hasAttribute("data-sec-browse")) S.browseAll = true;
  else { const s = (S._secs || []).find(x => x.key === t.dataset.secAll); if (s) s.all(); }
  try { $("sort").value = S.sort; } catch (er) {}
  renderFilters(); renderList(); $("drinks-title").scrollIntoView({ block: "start" });
}, true);
