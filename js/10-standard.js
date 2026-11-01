// The Cocktail Locker: standard. Scripts share one global scope and load in numbered order.
// ---------- standard recipe library ----------
S.std = [];
const slugify = v => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/^\s*the\s+/, "").replace(/\s+cocktail\s*$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
function stdToDrink(row) {
  const data = row.data || {};
  const d = recipeToDrink(Object.assign({}, data, { name: row.name || data.name }));
  return Object.assign(d, { id: "std:" + row.slug, slug: row.slug, aliases: row.aliases || [], standard: true, owner: null, about: String(data.about || "").slice(0, 600) });
}
async function loadStd() {
  if (!sb) return;
  const { data, error } = await sb.from("standard_recipes").select("slug, name, data, aliases");
  if (error) { S.stdOff = true; return; }
  S.stdOff = false;
  S.std = (data || []).map(stdToDrink);
}
const stdFor = q => { const k = slugify(q); return k ? S.std.find(d => d.slug === k || d.aliases.includes(k)) : null; };
async function lookupStandard(q) {
  q = String(q || "").trim().slice(0, 80);
  if (!q) return;
  const have = stdFor(q);
  if (have) { selectDrink(have.id); return; }
  if (!uid()) { toast("Sign in to look up standard recipes."); return; }
  const token = {};
  S.lookup = { q, token }; S.view = "lookup"; renderList(); renderMain();
  $("main").scrollIntoView({ behavior: "smooth", block: "start" });
  const { data, code, detail, reply } = await invokeHelper({ mode: "standard", query: q });
  if (!S.lookup || S.lookup.token !== token) return;
  S.lookup = null;
  if (data && data.standard) {
    const d = stdToDrink(data.standard);
    S.std = S.std.filter(x => x.id !== d.id).concat(d);
    selectDrink(d.id); return;
  }
  S.view = "detail";
  if (code === "not_a_cocktail") {
    S.lookupDym = String((reply && reply.did_you_mean) || "").trim();
    if (slugify(S.lookupDym) === slugify(q)) S.lookupDym = "";
    const m = $("main");
    m.innerHTML = `<div class="blank"><div class="glass">No cocktail called “${esc(q)}”</div>
      <div>Check the spelling, or search for another drink.</div>
      ${S.lookupDym ? `<button class="btn primary" type="button" id="dym-btn">Look up ${esc(S.lookupDym)}</button>` : ""}
      <button class="btn" type="button" id="dym-back">Back to drinks</button></div>`;
    if ($("dym-btn")) $("dym-btn").onclick = () => { const n = S.lookupDym; S.lookupDym = ""; $("search").value = n; S.query = n; refreshView(); lookupStandard(n); };
    $("dym-back").onclick = () => { renderList(); renderMain(); };
    renderList(); return;
  }
  renderList();
  if (SCAN_ERR[code]) { renderMain(); toast(SCAN_ERR[code]); } else showScanError(code, detail);
}
function selectDrink(id) {
  S.selected = id; S.view = "detail"; S.confirmDelete = false; setHash(id);
  renderFilters(); renderList(); renderMain();
}
