// The Cocktail Locker: list. Scripts share one global scope and load in numbered order.
// ---------- list + filters ----------
const haystack = d => [d.name, d.glass, d.garnish, d.notes, d.method, typeOf(d), baseOf(d), S.backend === "supabase" ? (d.standard ? "standard recipe classic" : lockerName(d.owner)) : "",
  ...(d.ingredients || []).flatMap(i => [i.name, i.brand, kindOf(i)])].filter(Boolean).join(" ").toLowerCase();
function passesFilters(d, skip) {
  const f = S.f;
  if (skip !== "owner" && f.owner && !(f.owner === "mine" ? isMine(d) : f.owner === "fav" ? isFav(d) : f.owner === "following" ? followingIds().includes(d.owner) : f.owner.startsWith("col:") ? !!(S.colItems[f.owner.slice(4)] && S.colItems[f.owner.slice(4)].has(d.id)) : d.owner === f.owner)) return false;
  if (skip !== "type" && f.type && typeOf(d) !== f.type) return false;
  if (skip !== "base" && f.base && baseOf(d) !== f.base) return false;
  if (skip !== "method" && f.method && d.method !== f.method) return false;
  if (skip !== "kind" && f.kind && !(d.ingredients || []).some(i => kindOf(i) === f.kind)) return false;
  if (skip !== "rating" && f.rating && !(f.rating === "none" ? !ratingOf(d).count : avgOf(d) >= Number(f.rating))) return false;
  if (S.query.trim()) {
    const qs = slugify(S.query);
    const byName = qs && (slugify(d.name).includes(qs) || (d.aliases || []).includes(qs));
    const h = haystack(d);
    if (!byName && !S.query.toLowerCase().split(/\s+/).filter(w => w && w !== "the").every(w => h.includes(w))) return false;
  }
  return true;
}
// Standard recipes appear only when searching, or under My favorites.
const pool = () => (S.query.trim() || S.f.owner === "fav" || S.f.owner.startsWith("col:")) ? allDrinks() : S.drinks.slice();
function filtered() { return sortItems(pool().filter(d => passesFilters(d))); }
function renderFilters() {
  const multi = S.backend === "supabase";
  $("flt-owner-wrap").hidden = !multi;
  const opts = (key, all, label, valueOf) => {
    const counts = {};
    S.drinks.filter(d => passesFilters(d, key)).forEach(d => [].concat(valueOf(d)).forEach(v => counts[v] = (counts[v] || 0) + 1));
    const sel = S.f[key];
    const list = all.filter(v => counts[v] || v === sel);
    return `<option value="">${label}</option>` + list.map(v => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(v)} (${counts[v] || 0})</option>`).join("");
  };
  if (multi) {
    const ids = [...new Set(S.drinks.map(d => d.owner || ""))];
    const counts = {}; S.drinks.filter(d => passesFilters(d, "owner")).forEach(d => counts[d.owner || ""] = (counts[d.owner || ""] || 0) + 1);
    const named = ids.filter(id => id !== uid()).sort((a, b) => lockerName(a).localeCompare(lockerName(b)));
    $("flt-owner").innerHTML = `<option value="">Everyone's carts</option>` +
      (uid() ? `<option value="mine" ${S.f.owner === "mine" ? "selected" : ""}>My cart (${S.drinks.filter(d => passesFilters(d, "owner") && isMine(d)).length})</option>` : "") +
      (uid() && !S.favsOff ? `<option value="fav" ${S.f.owner === "fav" ? "selected" : ""}>My favorites (${allDrinks().filter(d => passesFilters(d, "owner") && isFav(d)).length})</option>` : "") +
      (uid() && !S.followsOff && followingIds().length ? `<option value="following" ${S.f.owner === "following" ? "selected" : ""}>People I follow (${S.drinks.filter(d => passesFilters(d, "owner") && followingIds().includes(d.owner)).length})</option>` : "") +
      (uid() ? myLists().map(c => `<option value="col:${esc(c.id)}" ${S.f.owner === "col:" + c.id ? "selected" : ""}>List: ${esc(c.name)} (${allDrinks().filter(d => passesFilters(d, "owner") && S.colItems[c.id] && S.colItems[c.id].has(d.id)).length})</option>`).join("") : "") +
      named.filter(id => id).map(id => `<option value="${esc(id)}" ${S.f.owner === id ? "selected" : ""}>${esc(lockerName(id))} (${counts[id] || 0})</option>`).join("");
  }
  $("flt-type").innerHTML = opts("type", TYPES, "Any type", typeOf);
  $("flt-base").innerHTML = opts("base", BASES, "Any base", baseOf);
  $("flt-method").innerHTML = opts("method", METHODS, "Any method", d => d.method || "");
  $("flt-kind").innerHTML = opts("kind", KINDS, "Anything", d => [...new Set((d.ingredients || []).map(kindOf))]);
  $("flt-rating-wrap").hidden = !multi || !!S.ratingsOff;
  const rpool = S.drinks.filter(d => passesFilters(d, "rating"));
  const rc = v => rpool.filter(d => v === "none" ? !ratingOf(d).count : avgOf(d) >= Number(v)).length;
  $("flt-rating").innerHTML = `<option value="">Any rating</option>` + [["4", "4 stars and up"], ["3", "3 stars and up"], ["none", "Not rated yet"]]
    .map(([v, l]) => `<option value="${v}" ${S.f.rating === v ? "selected" : ""}>${l} (${rc(v)})</option>`).join("");
  const n = Object.values(S.f).filter(Boolean).length;
  $("fcount").hidden = !n; $("fcount").textContent = n;
  $("fclear").hidden = !n;
}
["owner", "type", "base", "method", "kind", "rating"].forEach(k => $("flt-" + k).addEventListener("change", e => { S.f[k] = e.target.value; refreshView(); }));
$("fclear").onclick = () => { S.f = { owner: "", type: "", base: "", method: "", kind: "", rating: "" }; refreshView(); };
function refreshView() {
  renderFilters(); renderList();
  const vis = filtered();
  if (S.view === "detail" && vis.length && !vis.some(d => d.id === S.selected)) { S.selected = vis[0].id; renderList(); renderMain(); }
}

function rowHtml(d, ver) {
  const multi = S.backend === "supabase";
  const who = d.standard ? `<span class="std-tag">Standard recipe</span>` : esc(multi ? (isMine(d) && uid() ? "Your cart" : lockerName(d.owner)) : baseOf(d));
  return `<li${ver ? ' class="ver"' : ""}><button type="button" data-id="${esc(d.id)}" aria-current="${d.id === S.selected && S.view === "detail"}">
    ${d.photo ? `<img class="thumb" src="${esc(photoUrl(d.photo))}" alt="" loading="lazy">` : `<span class="thumb" aria-hidden="true">${esc((d.name || "?").trim().charAt(0).toUpperCase())}</span>`}
    <span class="txt"><span class="nm">${esc(d.name)}${isFav(d) ? ' <span class="fav-dot" aria-label="Favorite">♥</span>' : ""}</span><span class="sub">${ratingOf(d).count ? `<span class="stars">★</span> ${avgOf(d).toFixed(1)} · ` : ""}${ver ? who : esc(typeOf(d)) + " · " + who}</span></span></button></li>`;
}
function lookupRow() {
  const q = S.query.trim();
  if (S.backend !== "supabase" || S.stdOff || q.length < 2 || stdFor(q)) return "";
  return `<li><button type="button" class="lookup-btn" id="lookup-btn" ${uid() ? "" : "disabled"}>
    <span><b>Look up the standard recipe</b> for “${esc(q)}”</span>
    <span class="hint">${uid() ? "Saved to the shared library so everyone can use it." : "Sign in to look up recipes that aren't here yet."}</span></button></li>`;
}
function renderList() {
  const items = filtered();
  const total = S.drinks.length, shown = items.length;
  $("count-label").textContent = !S.loaded ? "" : S.query.trim() ? `${shown} found` : shown === total ? String(total) : `${shown} of ${total}`;
  const ul = $("list");
  if (!S.loaded) { ul.innerHTML = '<li class="empty-list">Pulling the recipes…</li>'; return; }
  if (!items.length) {
    const msg = S.query.trim() ? "Nobody has this one yet."
      : !total ? "No drinks yet." + (S.canWrite ? " Add the first one." : " Sign in to add the first one.")
      : S.f.owner === "mine" && !S.drinks.some(isMine) ? "Your cart is empty. Tap + New drink to add one."
      : "No drinks match. Try fewer filters.";
    ul.innerHTML = `<li class="empty-list">${esc(msg)}</li>` + bottleRows() + lookupRow(); wireLookup(); return;
  }
  // Group versions of the same drink; groups keep the order of their best member.
  const groups = new Map();
  items.forEach(d => { const k = slugify(d.name) || d.id; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); });
  ul.innerHTML = [...groups.values()].map(g => g.length === 1 ? rowHtml(g[0], false)
    : `<li class="ghead">${esc(g[0].name)}<span>${g.length} versions${S.sort === "rated" ? ", best rated first" : ""}</span></li>` + g.map(d => rowHtml(d, true)).join("")).join("") + bottleRows() + lookupRow();
  wireLookup();
}
// Bottles matching the search, shown under the drinks.
function bottleRows() {
  const q = S.query.trim().toLowerCase();
  if (q.length < 2 || !S.bottles || !S.bottles.length) return "";
  const hits = S.bottles.filter(b => [b.name, b.product, b.producer].join(" ").toLowerCase().includes(q)).slice(0, 5);
  return hits.length ? `<li class="ghead">Bottles</li>` + hits.map(b => `<li><button type="button" data-bottle="${esc(b.name)}"><span class="thumb" aria-hidden="true">${esc(b.name.charAt(0))}</span><span class="txt"><span class="nm">${esc(b.name)}</span><span class="sub">${esc(b.ingredient || "Bottle")}</span></span></button></li>`).join("") : "";
}
function wireLookup() { if ($("lookup-btn")) $("lookup-btn").onclick = () => lookupStandard(S.query); }
$("sort").addEventListener("change", e => { S.sort = e.target.value; try { localStorage.setItem("mc-sort", S.sort); } catch (er) {} renderList(); });
$("list").addEventListener("click", e => {
  const b = e.target.closest("button[data-id]"); if (!b) return;
  S.selected = b.dataset.id; S.view = "detail"; S.confirmDelete = false; S.confirmPhoto = false; setHash(S.selected);
  renderList(); renderMain();
  if (window.matchMedia("(max-width: 780px)").matches) $("main").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("search").addEventListener("input", e => { S.query = e.target.value; refreshView(); });
$("search").addEventListener("keydown", e => { if (e.key === "Enter" && !filtered().length && S.query.trim().length >= 2 && uid()) lookupStandard(S.query); });
try { $("sort").value = S.sort; } catch (e) {}
$("new-btn").addEventListener("click", () => openEditor(null));
