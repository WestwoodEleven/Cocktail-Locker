// The Cocktail Locker: bartender. Scripts share one global scope and load in numbered order.
// ---------- make me a drink ----------
const GROUPS = [
  { key: "liquors", label: "Liquors & liqueurs", saved: true, kinds: ["Spirit", "Liqueur", "Vermouth & wine"], ph: "Name of a spirit or liqueur",
    extra: ["Bourbon", "Rye whiskey", "London dry gin", "Vodka", "White rum", "Dark rum", "Blanco tequila", "Mezcal", "Cognac", "Campari", "Aperol", "Sweet vermouth", "Dry vermouth", "Cointreau", "Green Chartreuse", "Maraschino liqueur", "Amaro Nonino", "Coffee liqueur"] },
  { key: "syrups", label: "Syrups & sweeteners", saved: true, kinds: ["Syrup & sweetener"], ph: "Name of a syrup or sweetener",
    extra: ["Simple syrup", "Rich demerara syrup", "Honey syrup", "Agave syrup", "Maple syrup", "Grenadine", "Orgeat", "Cinnamon syrup", "Ginger syrup"] },
  { key: "bitters", label: "Bitters", saved: true, kinds: ["Bitters"], ph: "Name of the bitters",
    extra: ["Angostura bitters", "Orange bitters", "Peychaud's bitters", "Chocolate bitters", "Mole bitters"] },
  { key: "fresh", label: "Juices, mixers & garnishes", saved: false, kinds: ["Juice", "Soda & mixer", "Egg & dairy", "Other"], ph: "A juice, mixer or garnish you have",
    extra: ["Limes", "Lemons", "Oranges", "Grapefruit juice", "Pineapple juice", "Cranberry juice", "Soda water", "Tonic water", "Ginger beer", "Cola", "Prosecco", "Egg whites", "Heavy cream", "Mint", "Cucumber", "Espresso"] }
];
S.bar = { liquors: [], syrups: [], bitters: [] };
S.fresh = (() => { try { return JSON.parse(localStorage.getItem("mc-fresh") || "[]"); } catch (e) { return []; } })();
S.prefs = { style: "", strength: "", taste: "", method: "", notes: "" };
const groupList = k => k === "fresh" ? S.fresh : S.bar[k];
// Saved bar items are { name, brand, out }; older bars saved plain names, which still work.
const barItem = x => typeof x === "string" ? { name: x, brand: "", out: false } : { name: String((x && x.name) || ""), brand: String((x && x.brand) || ""), out: !!(x && x.out) };
const itemName = x => typeof x === "string" ? x : x.name;
const itemLabel = x => typeof x === "string" ? x : (x.brand ? `${x.name} (${x.brand})` : x.name);
const savedItems = () => [...S.bar.liquors, ...S.bar.syrups, ...S.bar.bitters];
const inStock = list => list.filter(x => typeof x === "string" || !x.out);
// What the AI tools are told you have: in-stock bottles, with brands.
const barForAI = () => ({ liquors: inStock(S.bar.liquors).map(itemLabel), syrups: inStock(S.bar.syrups).map(itemLabel), bitters: inStock(S.bar.bitters).map(itemLabel) });
async function loadBar() {
  if (!sb || !uid()) return;
  const { data, error } = await sb.from("bars").select("items").eq("user_id", uid()).maybeSingle();
  if (error) { S.barOff = true; return; }
  const it = (data && data.items) || {};
  S.bar = { liquors: [].concat(it.liquors || []).map(barItem), syrups: [].concat(it.syrups || []).map(barItem), bitters: [].concat(it.bitters || []).map(barItem) };
  if (S.view === "make") renderMake();
  if (S.view === "profile") renderProfile();
  if (VIEWS[S.view]) renderMain();
}
let barTimer = null;
function saveBarSoon() {
  clearTimeout(barTimer);
  barTimer = setTimeout(async () => {
    if (!sb || !uid()) return;
    const { error } = await sb.from("bars").upsert({ user_id: uid(), items: S.bar, updated_at: new Date().toISOString() });
    const el = $("bar-saved"); if (el) el.textContent = error ? "Couldn't save your bottles just now." : "Saved to your cart.";
  }, 700);
}
function saveFresh() { try { localStorage.setItem("mc-fresh", JSON.stringify(S.fresh)); } catch (e) {} }
function suggestionsFor(g) {
  const have = new Set(g.saved ? [] : groupList(g.key).map(x => itemName(x).toLowerCase()));
  const seen = new Set(), out = [];
  S.drinks.forEach(d => (d.ingredients || []).forEach(i => { if (g.kinds.includes(kindOf(i))) out.push(i.name); }));
  return out.concat(g.extra).filter(n => { const k = n.toLowerCase(); if (seen.has(k) || have.has(k)) return false; seen.add(k); return true; }).slice(0, 80);
}
function addItem(key, text, brand) {
  const list = groupList(key);
  brand = String(brand || "").trim().slice(0, 60);
  String(text || "").split(/[,\n]/).map(x => x.trim().slice(0, 60)).filter(Boolean).forEach(v => {
    if (key === "fresh") { if (!list.some(x => x.toLowerCase() === v.toLowerCase()) && list.length < 60) list.push(v); return; }
    const same = list.find(x => x.name.toLowerCase() === v.toLowerCase() && x.brand.toLowerCase() === brand.toLowerCase());
    if (same) { same.out = false; return; } // re-adding something marked out puts it back in stock
    if (list.length < 80) list.push({ name: v, brand, out: false });
  });
  afterItems(key);
}
function editItem(key, idx) {
  const it = groupList(key)[idx]; if (!it) return;
  const body = sheet("Edit " + it.name, `
    <div class="field"><label for="bi-name">Name</label><input id="bi-name" type="text" maxlength="60" value="${esc(it.name)}"></div>
    <div class="field"><label for="bi-brand">Brand</label><input id="bi-brand" type="text" maxlength="60" value="${esc(it.brand)}" placeholder="Brand (optional)"></div>
    ${it.brand && S.backend === "supabase" && !S.bottlesOff ? `<button type="button" class="linkish" data-bottle="${esc(it.brand)}">Open the ${esc(it.brand)} bottle page</button>` : ""}
    <label class="check" for="bi-out"><input type="checkbox" id="bi-out" ${it.out ? "checked" : ""}><span>Out of stock<br><span class="hint">Kept on your list, but left out of What can I make? and the AI tools until you restock.</span></span></label>
    <div class="panel-actions" style="justify-content:flex-start"><button class="btn primary small" type="button" id="bi-save">Save</button><button class="btn small danger ghost" type="button" id="bi-rm">Remove from bar</button></div>`);
  $("bi-save").onclick = () => {
    const n = $("bi-name").value.trim().slice(0, 60); if (!n) { $("bi-name").focus(); return; }
    it.name = n; it.brand = $("bi-brand").value.trim().slice(0, 60); it.out = $("bi-out").checked;
    closeSheet(); afterItems(key);
  };
  $("bi-rm").onclick = () => { closeSheet(); removeItem(key, idx); };
  body.querySelectorAll("input[type=text]").forEach(x => x.onkeydown = e => { if (e.key === "Enter") $("bi-save").click(); });
}
function toggleOut(key, idx) { const it = groupList(key)[idx]; if (!it) return; it.out = !it.out; toast(it.out ? `${it.name} marked out of stock` : `${it.name} back in stock`); afterItems(key); }
function removeItem(key, idx) { groupList(key).splice(idx, 1); afterItems(key); }
function afterItems(key) {
  if (key === "fresh") saveFresh(); else saveBarSoon();
  renderChips(key);
  const g = GROUPS.find(x => x.key === key);
  const dl = $("dl-" + key); if (dl) dl.innerHTML = suggestionsFor(g).map(n => `<option value="${esc(n)}">`).join("");
  if ($("make-go")) $("make-go").disabled = !totalItems();
  if (VIEWS[S.view] && S.view === "canmake") { clearTimeout(afterItems.t); afterItems.t = setTimeout(() => { const a = document.activeElement && document.activeElement.id; renderMain(); if (a && $(a)) $(a).focus(); }, 300); }
  if (S.view === "profile") { const st = document.querySelectorAll(".stat b")[2]; if (st) st.textContent = inStock(savedItems()).length; const o = $("bar-out"); if (o) o.outerHTML = outSummary(); }
}
const totalItems = () => inStock(savedItems()).length + S.fresh.length;
function outSummary() {
  const out = savedItems().filter(x => typeof x !== "string" && x.out);
  return `<p class="hint" id="bar-out" style="margin:0">${out.length ? `<b>Out of stock:</b> ${esc(out.map(itemLabel).join(", "))}` : ""}</p>`;
}
// Liquors are shown in shelves by type. The bottle guide decides when it knows the bottle; otherwise the name and brand do.
const BAR_SHELVES = ["Whiskey", "Gin", "Vodka", "Rum", "Tequila & mezcal", "Brandy", "Other spirits", "Liqueurs", "Vermouth & wine", "Other"];
const SHELF_OF_CATEGORY = { whiskey: "Whiskey", gin: "Gin", vodka: "Vodka", rum: "Rum", tequila: "Tequila & mezcal", mezcal: "Tequila & mezcal", brandy: "Brandy",
  liqueur: "Liqueurs", amaro: "Liqueurs", vermouth: "Vermouth & wine", wine: "Vermouth & wine" };
const SHELF_OF_BASE = { Whiskey: "Whiskey", Gin: "Gin", Vodka: "Vodka", Rum: "Rum", Tequila: "Tequila & mezcal", Mezcal: "Tequila & mezcal", Brandy: "Brandy" };
function barShelf(v) {
  const known = typeof bottleFor === "function" && ((v.brand && bottleFor(v.brand)) || bottleFor(v.name));
  if (known && SHELF_OF_CATEGORY[known.category]) return SHELF_OF_CATEGORY[known.category];
  const text = (v.name + " " + (v.brand || "")).toLowerCase();
  const kind = guessKind(v.name) !== "Other" ? guessKind(v.name) : guessKind(text);
  if (kind === "Liqueur") return "Liqueurs";
  if (kind === "Vermouth & wine") return "Vermouth & wine";
  for (const [b, re] of BASE_RULES) if (re.test(text)) return SHELF_OF_BASE[b];
  return kind === "Spirit" ? "Other spirits" : "Other";
}
const barChip = (v, i) => `<span class="chip-item bar-chip${v.out ? " out" : ""}"><button type="button" class="chip-main" data-edit="${i}" title="Edit brand or stock">${esc(v.name)}${v.brand ? ` <small>${esc(v.brand)}</small>` : ""}${v.out ? ` <small class="out-tag">out</small>` : ""}</button>`
  + `<button type="button" class="chip-stock" data-out="${i}" aria-label="${v.out ? "Mark " + esc(v.name) + " back in stock" : "Mark " + esc(v.name) + " out of stock"}" title="${v.out ? "Back in stock" : "Out of stock"}">${v.out ? "↺" : "○"}</button>`
  + `<button type="button" data-rm="${i}" aria-label="Remove ${esc(v.name)}">×</button></span>`;
function renderChips(key) {
  const el = $("chips-" + key); if (!el) return;
  const list = groupList(key);
  if (!list.length) { el.innerHTML = `<span class="hint">Nothing yet.</span>`; el.classList.remove("shelved"); return; }
  if (key === "fresh") {
    el.innerHTML = list.map((v, i) => `<span class="chip-item">${esc(v)}<button type="button" data-rm="${i}" aria-label="Remove ${esc(v)}">×</button></span>`).join("");
    return;
  }
  // Keep each item's position in the saved list for the edit, stock and remove buttons; show in stock first, then A–Z.
  const items = list.map((x, i) => ({ v: barItem(x), i }))
    .sort((a, b) => (a.v.out - b.v.out) || a.v.name.localeCompare(b.v.name, undefined, { sensitivity: "base" }));
  if (key !== "liquors" || items.length < 6) { el.classList.remove("shelved"); el.innerHTML = items.map(x => barChip(x.v, x.i)).join(""); return; }
  const shelves = new Map(BAR_SHELVES.map(s => [s, []]));
  items.forEach(x => shelves.get(barShelf(x.v)).push(x));
  el.classList.add("shelved");
  el.innerHTML = [...shelves].filter(([, xs]) => xs.length).map(([shelf, xs]) => `<div class="shelf">
      <div class="shelf-name">${esc(shelf)} <span class="shelf-n">${xs.length}</span></div>
      <div class="shelf-chips">${xs.map(x => barChip(x.v, x.i)).join("")}</div></div>`).join("");
}
function openMake() {
  if (!S.canWrite || S.backend !== "supabase") { toast("Sign in to use the AI bartender."); return; }
  S.view = "make"; S.confirmDelete = false; setHash(null);
  renderList(); renderMake();
  $("main").scrollIntoView({ behavior: "smooth", block: "start" });
}
const chipGroupHtml = g => `<div class="cgroup">
      <label class="label" for="in-${g.key}">${esc(g.label)}</label>
      <div class="chips" id="chips-${g.key}"></div>
      <div class="chip-add${g.saved ? " with-brand" : ""}"><input id="in-${g.key}" type="text" list="dl-${g.key}" placeholder="${esc(g.ph)}" autocomplete="off" enterkeyhint="${g.saved ? "next" : "done"}" aria-label="${esc(g.label)}">
        ${g.saved ? `<input id="br-${g.key}" type="text" class="brand-in" placeholder="Brand (optional)" autocomplete="off" enterkeyhint="done" aria-label="Brand">` : ""}
        <button class="btn small" type="button" data-add="${g.key}">Add</button></div>
      <datalist id="dl-${g.key}"></datalist></div>`;
// My bottles on My Cocktail Cart: the groups show only their bottles; adding happens through one Add button.
const barGroupHtml = g => `<div class="cgroup"><span class="label">${esc(g.label)}</span><div class="chips" id="chips-${g.key}"></div></div>`;
function wireBarChips(groups) {
  groups.forEach(g => {
    renderChips(g.key);
    $("chips-" + g.key).addEventListener("click", e => {
      const rm = e.target.closest("[data-rm]"), ed = e.target.closest("[data-edit]"), out = e.target.closest("[data-out]");
      if (rm) removeItem(g.key, Number(rm.dataset.rm));
      else if (out) toggleOut(g.key, Number(out.dataset.out));
      else if (ed) editItem(g.key, Number(ed.dataset.edit));
    });
  });
}
// Add: from photos (the bottle scanner) or typed in.
function openBottleAdd(typed) {
  if (!typed) {
    sheet("Add bottles", `<div class="add-menu">
      <button type="button" id="ba-photo"><b>From photos</b><span>Photograph your shelf and we add every bottle we can see</span></button>
      <button type="button" id="ba-type"><b>Type it in</b><span>Add one bottle by name, with its brand if you like</span></button>
    </div>`);
    $("ba-photo").onclick = () => { closeSheet(); openStock(); };
    $("ba-type").onclick = () => openBottleAdd(true);
    return;
  }
  const saved = GROUPS.filter(g => g.saved);
  const opts = g => suggestionsFor(g).map(n => `<option value="${esc(n)}">`).join("");
  sheet("Add a bottle", `<form id="ba-form" class="ba-form">
      <div class="field"><label for="ba-kind">Type</label><select id="ba-kind">${saved.map(g => `<option value="${g.key}">${esc(g.label)}</option>`).join("")}</select></div>
      <div class="field"><label for="ba-name">Bottle</label><input id="ba-name" type="text" list="ba-dl" maxlength="60" autocomplete="off" placeholder="${esc(saved[0].ph)}" required></div>
      <datalist id="ba-dl">${opts(saved[0])}</datalist>
      <div class="field"><label for="ba-brand">Brand (optional)</label><input id="ba-brand" type="text" maxlength="60" autocomplete="off" placeholder="Maker or label, if it matters"></div>
      <div class="share-actions"><button class="btn primary" type="submit">Add</button><button class="btn" type="button" id="ba-done">Done</button></div>
      <p class="hint" id="ba-msg" role="status" style="margin:0"></p>
    </form>`);
  const kind = $("ba-kind"), name = $("ba-name"), brand = $("ba-brand");
  const PH = Object.fromEntries(saved.map(g => [g.key, g.ph]));
  kind.onchange = () => { const g = saved.find(x => x.key === kind.value); $("ba-dl").innerHTML = opts(g); name.placeholder = PH[g.key] || ""; name.focus(); };
  $("ba-done").onclick = closeSheet;
  $("ba-form").onsubmit = e => {
    e.preventDefault();
    const v = name.value.trim(); if (!v) { name.focus(); return; }
    addItem(kind.value, v, brand.value);
    $("ba-msg").textContent = `Added ${v}${brand.value.trim() ? " (" + brand.value.trim() + ")" : ""}. Add another or tap Done.`;
    name.value = ""; brand.value = ""; name.focus();
  };
  name.focus();
}

function wireGroups(groups) {
  groups.forEach(g => {
    renderChips(g.key); $("dl-" + g.key).innerHTML = suggestionsFor(g).map(n => `<option value="${esc(n)}">`).join("");
    const inp = $("in-" + g.key);
    const br = $("br-" + g.key);
    const add = () => { addItem(g.key, inp.value, br ? br.value : ""); inp.value = ""; if (br) br.value = ""; inp.focus(); };
    document.querySelector(`[data-add="${g.key}"]`).onclick = add;
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter" || (e.key === "," && !g.saved)) { e.preventDefault(); if (g.saved && br && !br.value && inp.value.trim()) { br.focus(); return; } add(); }
    });
    if (br) br.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (inp.value.trim()) add(); } });
    if (!g.saved) inp.addEventListener("change", () => { if (suggestionsFor(g).some(n => n === inp.value)) { addItem(g.key, inp.value); inp.value = ""; } });
    $("chips-" + g.key).addEventListener("click", e => {
      const rm = e.target.closest("[data-rm]"), ed = e.target.closest("[data-edit]"), out = e.target.closest("[data-out]");
      if (rm) removeItem(g.key, Number(rm.dataset.rm));
      else if (out) toggleOut(g.key, Number(out.dataset.out));
      else if (ed) editItem(g.key, Number(ed.dataset.edit));
    });
  });
}
const sel = (id, label, opts, cur) => `<div class="field"><label for="${id}">${label}</label><select id="${id}"><option value="">Any</option>${opts.map(o => `<option ${o === cur ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;
function renderMake() {
  const m = $("main");
  const group = chipGroupHtml;
  m.innerHTML = `
    <div class="make">
      <div class="editor-top"><h2 class="make-title">Make me a drink</h2><button class="btn small" type="button" id="make-close">Back to drinks</button></div>
      <p class="hint" style="margin:0">List what you have and we'll suggest 3 cocktails you can make right now. It may add ice, water and sugar, nothing else.</p>
      <section class="make-sec">
        <div class="sec-head"><h3>Your bottles</h3><button type="button" class="linkish" data-stock-open>Add bottles from photos</button><span class="hint" id="bar-saved">${S.barOff ? "Your bottles can't be saved yet. Ask the site owner to run bartender-setup.sql." : "Saved to your cart for next time."}</span></div>
        ${GROUPS.filter(g => g.saved).map(group).join("")}
      </section>
      <section class="make-sec">
        <div class="sec-head"><h3>Fresh today</h3><span class="hint">Remembered on this device only.</span></div>
        ${GROUPS.filter(g => !g.saved).map(group).join("")}
      </section>
      <section class="make-sec">
        <div class="sec-head"><h3>What you're in the mood for</h3><span class="hint">All optional.</span></div>
        <div class="row2">
          ${sel("p-style", "Style", TYPES.filter(t => t !== "Other"), S.prefs.style)}
          ${sel("p-strength", "Strength", ["Light", "Medium", "Strong"], S.prefs.strength)}
          ${sel("p-taste", "Taste", ["Sweet", "Balanced", "Tart", "Bitter", "Dry", "Fruity", "Herbal", "Smoky"], S.prefs.taste)}
          ${sel("p-method", "Method", METHODS, S.prefs.method)}
        </div>
        <label class="check" for="p-taste-on"><input type="checkbox" id="p-taste-on" ${S.useTaste ? "checked" : ""}>
          <span>Use my favorites and top-rated drinks<br><span class="hint">${tasteHint()}</span></span></label>
        <div class="field"><label for="p-notes">Anything else</label><input id="p-notes" type="text" maxlength="300" value="${esc(S.prefs.notes)}" placeholder="Other requests for the bartender (optional)"></div>
      </section>
      <div class="form-actions"><button class="btn primary" type="button" id="make-go" ${totalItems() ? "" : "disabled"}>Suggest 3 drinks</button></div>
      <div id="ideas" aria-live="polite">${ideasHtml()}</div>
    </div>`;
  wireGroups(GROUPS);
  ["style", "strength", "taste", "method"].forEach(k => $("p-" + k).onchange = e => { S.prefs[k] = e.target.value; });
  $("p-notes").oninput = e => { S.prefs.notes = e.target.value; };
  $("p-taste-on").onchange = e => { S.useTaste = e.target.checked; try { localStorage.setItem("mc-use-taste", S.useTaste ? "1" : "0"); } catch (er) {} };
  $("make-close").onclick = () => { S.view = "detail"; renderList(); renderMain(); };
  $("make-go").onclick = generateIdeas;
  wireIdeas();
}
function ideasHtml() {
  const st = S.ideasState;
  if (!st) return "";
  if (st.loading) return `<div class="scanning"><div class="glass dots">Mixing up ideas</div><div class="hint">This usually takes 10 to 20 seconds.</div><button class="btn" type="button" id="ideas-cancel">Cancel</button></div>`;
  if (st.error) return `<div class="scan-banner"><span><b>Couldn't get drink ideas.</b> ${esc(st.error)}</span></div>`;
  return `${st.note ? `<div class="scan-banner"><span>${esc(st.note)}</span></div>` : ""}
    <div class="ideas">${st.drinks.map((x, k) => `<article class="idea">
      <div class="idea-head"><h3>${esc(x.name || "Untitled")}</h3><span class="chip amber">${x.classic ? "Classic: " + esc(x.classic) : "Original"}</span></div>
      <div class="meta">${[x.type, x.base, x.method, x.glass].filter(Boolean).map(v => `<span class="chip">${esc(v)}</span>`).join("")}</div>
      <table class="spec-table"><tbody>${(x.ingredients || []).map(i => { const s = show({ amount: Number(i.amount) || 0, unit: i.unit }, 1, "spec");
        return `<tr${i.float ? ' class="float"' : ""}><td class="q">${qHtml(s.q)}</td><td class="u">${esc(s.u)}</td><td class="n">${esc(i.name)}${i.float ? ' <span class="chip amber float-tag">Float</span>' : ""}${i.brand ? `<span class="note brand-note">Recommended: <b>${esc(i.brand)}</b></span>` : ""}</td></tr>`; }).join("")}</tbody></table>
      ${x.garnish ? `<p class="idea-line"><b>Garnish:</b> ${esc(x.garnish)}</p>` : ""}
      ${x.notes ? `<p class="idea-line">${esc(x.notes)}</p>` : ""}
      ${x.why ? `<p class="idea-line hint">${esc(x.why)}</p>` : ""}
      ${x.extras ? `<p class="idea-line hint"><b>Even better with:</b> ${esc(x.extras)}</p>` : ""}
      <div><button class="btn primary small" type="button" data-save-idea="${k}">Save to My Cocktail Cart</button></div>
    </article>`).join("")}</div>
    <div class="form-actions"><button class="btn" type="button" id="ideas-again">Suggest 3 more</button></div>`;
}
function wireIdeas() {
  if ($("ideas-cancel")) $("ideas-cancel").onclick = () => { S.ideasState = null; $("ideas").innerHTML = ""; $("make-go").disabled = !totalItems(); };
  if ($("ideas-again")) $("ideas-again").onclick = generateIdeas;
  document.querySelectorAll("[data-save-idea]").forEach(b => b.onclick = () => {
    const x = S.ideasState.drinks[Number(b.dataset.saveIdea)];
    const d = recipeToDrink(Object.assign({}, x, { notes: [x.notes, x.why].filter(Boolean).join("\n\n") }));
    d.origin = "AI bartender";
    openEditor(d, false, { title: "Made by the AI bartender.", body: "Tweak anything before saving.", warning: x.extras ? "Even better with: " + x.extras : "" });
  });
}
S.useTaste = (() => { try { return localStorage.getItem("mc-use-taste") !== "0"; } catch (e) { return true; } })();
function likedDrinks() {
  return allSorted().filter(d => isFav(d) || ratingOf(d).mine >= 4)
    .sort((a, b) => (isFav(b) - isFav(a)) || (ratingOf(b).mine - ratingOf(a).mine));
}
function tasteProfile() {
  const liked = likedDrinks().slice(0, 15).map(d => ({ name: d.name, type: typeOf(d), base: baseOf(d), ingredients: (d.ingredients || []).map(i => i.name).slice(0, 10) }));
  const avoid = [...new Set(allSorted().filter(d => isMine(d) || isFav(d)).map(d => d.name))].slice(0, 60);
  return { liked, avoid };
}
function tasteHint() {
  const n = likedDrinks().length;
  return n ? `Leans toward ${n} drink${n === 1 ? "" : "s"} you love and skips ones you already have.` : "Favorite drinks or rate them 4 stars or more to personalize ideas. It still skips drinks you already have.";
}
async function invokeHelper(body) {
  let code = "", detail = "", data = null, reply = null;
  try {
    const res = await sb.functions.invoke("read-recipe", { body });
    if (res.error) {
      const resp = res.error.context;
      if (resp && typeof resp.json === "function") {
        if (resp.status === 404) code = "not_deployed";
        else { try { const j = await resp.json(); reply = j; code = j.error || ""; detail = j.detail || ""; } catch (e2) {} }
        if (!code && resp.status === 401) code = "signed_out";
        if (!code && resp.status >= 500) code = "crashed";
        if (!code) detail = detail || ("HTTP " + resp.status);
      } else code = res.error.name === "FunctionsFetchError" ? "unreachable" : "";
    } else data = res.data;
  } catch (e) { detail = String(e && e.message || e); }
  return { data, code, detail, reply };
}
async function generateIdeas() {
  if (!totalItems()) { toast("Add at least one ingredient."); return; }
  const token = {};
  S.ideasState = { loading: true, token };
  $("ideas").innerHTML = ideasHtml(); wireIdeas(); $("make-go").disabled = true;
  $("ideas").scrollIntoView({ behavior: "smooth", block: "start" });
  const { data, code, detail } = await invokeHelper({ mode: "generate", bar: barForAI(), fresh: freshForAI(), prefs: S.prefs, taste: S.useTaste ? tasteProfile() : null });
  if (!S.ideasState || S.ideasState.token !== token) return;
  if (data && Array.isArray(data.drinks) && data.drinks.length) S.ideasState = { drinks: data.drinks, note: data.note || "" };
  else {
    let msg = detail; try { const j = JSON.parse(detail); msg = (j.error && j.error.message) || detail; } catch (e) {}
    const known = { no_ingredients: "Add at least one ingredient first.", reader_failed: "" };
    S.ideasState = { error: (code in known ? known[code] : SCAN_ERR[code]) || msg || "Something went wrong. Try again." };
  }
  if (S.view !== "make") return;
  $("ideas").innerHTML = ideasHtml(); wireIdeas(); $("make-go").disabled = !totalItems();
}
$("make-btn").onclick = () => openAsk();
