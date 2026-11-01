// The Cocktail Locker: bartender. Scripts share one global scope and load in numbered order.
// ---------- make me a drink ----------
const GROUPS = [
  { key: "liquors", label: "Liquors & liqueurs", saved: true, kinds: ["Spirit", "Liqueur", "Vermouth & wine"], ph: "Add a bottle, like bourbon or Campari",
    extra: ["Bourbon", "Rye whiskey", "London dry gin", "Vodka", "White rum", "Dark rum", "Blanco tequila", "Mezcal", "Cognac", "Campari", "Aperol", "Sweet vermouth", "Dry vermouth", "Cointreau", "Green Chartreuse", "Maraschino liqueur", "Amaro Nonino", "Coffee liqueur"] },
  { key: "syrups", label: "Syrups & sweeteners", saved: true, kinds: ["Syrup & sweetener"], ph: "Add a syrup, like honey syrup",
    extra: ["Simple syrup", "Rich demerara syrup", "Honey syrup", "Agave syrup", "Maple syrup", "Grenadine", "Orgeat", "Cinnamon syrup", "Ginger syrup"] },
  { key: "bitters", label: "Bitters", saved: true, kinds: ["Bitters"], ph: "Add bitters, like Angostura",
    extra: ["Angostura bitters", "Orange bitters", "Peychaud's bitters", "Chocolate bitters", "Mole bitters"] },
  { key: "fresh", label: "Juices, mixers & garnishes", saved: false, kinds: ["Juice", "Soda & mixer", "Egg & dairy", "Other"], ph: "Add what's in the fridge, like limes or soda",
    extra: ["Limes", "Lemons", "Oranges", "Grapefruit juice", "Pineapple juice", "Cranberry juice", "Soda water", "Tonic water", "Ginger beer", "Cola", "Prosecco", "Egg whites", "Heavy cream", "Mint", "Cucumber", "Espresso"] }
];
S.bar = { liquors: [], syrups: [], bitters: [] };
S.fresh = (() => { try { return JSON.parse(localStorage.getItem("mc-fresh") || "[]"); } catch (e) { return []; } })();
S.prefs = { style: "", strength: "", taste: "", method: "", notes: "" };
const groupList = k => k === "fresh" ? S.fresh : S.bar[k];
async function loadBar() {
  if (!sb || !uid()) return;
  const { data, error } = await sb.from("bars").select("items").eq("user_id", uid()).maybeSingle();
  if (error) { S.barOff = true; return; }
  const it = (data && data.items) || {};
  S.bar = { liquors: [].concat(it.liquors || []), syrups: [].concat(it.syrups || []), bitters: [].concat(it.bitters || []) };
  if (S.view === "make") renderMake();
  if (S.view === "profile") renderProfile();
}
let barTimer = null;
function saveBarSoon() {
  clearTimeout(barTimer);
  barTimer = setTimeout(async () => {
    if (!sb || !uid()) return;
    const { error } = await sb.from("bars").upsert({ user_id: uid(), items: S.bar, updated_at: new Date().toISOString() });
    const el = $("bar-saved"); if (el) el.textContent = error ? "Couldn't save your bar just now." : "Saved to your locker.";
  }, 700);
}
function saveFresh() { try { localStorage.setItem("mc-fresh", JSON.stringify(S.fresh)); } catch (e) {} }
function suggestionsFor(g) {
  const have = new Set(groupList(g.key).map(x => x.toLowerCase()));
  const seen = new Set(), out = [];
  S.drinks.forEach(d => (d.ingredients || []).forEach(i => { if (g.kinds.includes(kindOf(i))) out.push(i.name); }));
  return out.concat(g.extra).filter(n => { const k = n.toLowerCase(); if (seen.has(k) || have.has(k)) return false; seen.add(k); return true; }).slice(0, 80);
}
function addItem(key, text) {
  const list = groupList(key);
  String(text || "").split(/[,\n]/).map(x => x.trim().slice(0, 60)).filter(Boolean).forEach(v => {
    if (!list.some(x => x.toLowerCase() === v.toLowerCase()) && list.length < 60) list.push(v);
  });
  afterItems(key);
}
function removeItem(key, idx) { groupList(key).splice(idx, 1); afterItems(key); }
function afterItems(key) {
  if (key === "fresh") saveFresh(); else saveBarSoon();
  renderChips(key);
  const g = GROUPS.find(x => x.key === key);
  $("dl-" + key).innerHTML = suggestionsFor(g).map(n => `<option value="${esc(n)}">`).join("");
  if ($("make-go")) $("make-go").disabled = !totalItems();
  if (S.view === "profile") { const st = document.querySelectorAll(".stat b")[2]; if (st) st.textContent = S.bar.liquors.length + S.bar.syrups.length + S.bar.bitters.length; }
}
const totalItems = () => S.bar.liquors.length + S.bar.syrups.length + S.bar.bitters.length + S.fresh.length;
function renderChips(key) {
  const el = $("chips-" + key); if (!el) return;
  const list = groupList(key);
  el.innerHTML = list.length ? list.map((v, i) => `<span class="chip-item">${esc(v)}<button type="button" data-rm="${i}" aria-label="Remove ${esc(v)}">×</button></span>`).join("")
    : `<span class="hint">Nothing yet.</span>`;
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
      <div class="chip-add"><input id="in-${g.key}" type="text" list="dl-${g.key}" placeholder="${esc(g.ph)}" autocomplete="off" enterkeyhint="done">
        <button class="btn small" type="button" data-add="${g.key}">Add</button></div>
      <datalist id="dl-${g.key}"></datalist></div>`;
function wireGroups(groups) {
  groups.forEach(g => {
    renderChips(g.key); $("dl-" + g.key).innerHTML = suggestionsFor(g).map(n => `<option value="${esc(n)}">`).join("");
    const inp = $("in-" + g.key);
    document.querySelector(`[data-add="${g.key}"]`).onclick = () => { addItem(g.key, inp.value); inp.value = ""; inp.focus(); };
    inp.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addItem(g.key, inp.value); inp.value = ""; } });
    inp.addEventListener("change", () => { if (suggestionsFor(g).some(n => n === inp.value)) { addItem(g.key, inp.value); inp.value = ""; } });
    $("chips-" + g.key).addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) removeItem(g.key, Number(b.dataset.rm)); });
  });
}
const sel = (id, label, opts, cur) => `<div class="field"><label for="${id}">${label}</label><select id="${id}"><option value="">Any</option>${opts.map(o => `<option ${o === cur ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;
function renderMake() {
  const m = $("main");
  const group = chipGroupHtml;
  m.innerHTML = `
    <div class="make">
      <div class="editor-top"><h2 class="make-title">Make me a drink</h2><button class="btn small" type="button" id="make-close">Back to drinks</button></div>
      <p class="hint" style="margin:0">List what you have and Claude suggests 3 cocktails you can make right now. It may add ice, water and sugar, nothing else.</p>
      <section class="make-sec">
        <div class="sec-head"><h3>Your bar</h3><span class="hint" id="bar-saved">${S.barOff ? "Your bar can't be saved yet. Ask the site owner to run bartender-setup.sql." : "Saved to your locker for next time."}</span></div>
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
        <div class="field"><label for="p-notes">Anything else</label><input id="p-notes" type="text" maxlength="300" value="${esc(S.prefs.notes)}" placeholder="Anything else"></div>
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
        return `<tr${i.float ? ' class="float"' : ""}><td class="q">${esc(s.q)}</td><td class="u">${esc(s.u)}</td><td class="n">${esc(i.name)}${i.float ? ' <span class="chip amber float-tag">Float</span>' : ""}${i.brand ? `<span class="note brand-note">Recommended: <b>${esc(i.brand)}</b></span>` : ""}</td></tr>`; }).join("")}</tbody></table>
      ${x.garnish ? `<p class="idea-line"><b>Garnish:</b> ${esc(x.garnish)}</p>` : ""}
      ${x.notes ? `<p class="idea-line">${esc(x.notes)}</p>` : ""}
      ${x.why ? `<p class="idea-line hint">${esc(x.why)}</p>` : ""}
      ${x.extras ? `<p class="idea-line hint"><b>Even better with:</b> ${esc(x.extras)}</p>` : ""}
      <div><button class="btn primary small" type="button" data-save-idea="${k}">Save to my locker</button></div>
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
  const { data, code, detail } = await invokeHelper({ mode: "generate", bar: S.bar, fresh: S.fresh, prefs: S.prefs, taste: S.useTaste ? tasteProfile() : null });
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
$("make-btn").onclick = openMake;
