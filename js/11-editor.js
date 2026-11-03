// The Cocktail Locker: editor. Scripts share one global scope and load in numbered order.
// ---------- editor ----------
const draftDrink = () => { const e = S.editing || {}; return { method: e.method, glass: e.glass,
  ingredients: (e.ingredients || []).filter(i => (i.name || "").trim()).map(i => ({ name: i.name, brand: i.brand, kind: i.kind || "", unit: i.unit, float: i.float, amount: parseAmount(i.amountText) || 0 })) }; };
function openEditor(d, isCopy, scanNote) {
  S.view = "edit"; S.confirmDelete = false; S.isCopy = !!isCopy; S.scanNote = scanNote || null;
  S.editing = d ? JSON.parse(JSON.stringify(d)) : { id: null, name: "", glass: "", method: "Stirred", garnish: "", notes: "",
    ingredients: [{ amount: "", unit: "oz", name: "" }, { amount: "", unit: "oz", name: "" }, { amount: "", unit: "dash", name: "" }] };
  S.editing.ingredients = S.editing.ingredients.map(i => Object.assign({}, i, { amountText: typeof i.amount === "number" ? amountToText(i.amount) : (i.amount || "") }));
  S.editing.type = S.editing.type || ""; S.editing.base = S.editing.base || "";
  renderList(); renderEditor();
  $("main").scrollIntoView({ behavior: "smooth", block: "start" });
}
function readForm() {
  const e = S.editing;
  e.name = $("f-name").value; e.glass = $("f-glass").value; e.method = $("f-method").value;
  e.garnish = $("f-garnish").value; e.notes = $("f-notes").value;
  e.type = $("f-type").value; e.base = $("f-base").value;
  document.querySelectorAll(".ing-row").forEach((r, i) => {
    e.ingredients[i].amountText = r.querySelector(".amt").value;
    e.ingredients[i].unit = r.querySelector(".ing-unit").value;
    e.ingredients[i].kind = r.querySelector(".ing-kind").value;
    e.ingredients[i].name = r.querySelector(".ing-name").value;
    e.ingredients[i].brand = r.querySelector(".ing-brand").value;
    e.ingredients[i].float = r.querySelector(".flt input").checked;
  });
}
function renderEditor(errMsg) {
  const e = S.editing; const m = $("main");
  const ingRows = e.ingredients.map((i, k) => `
    <div class="ing-row">
      <input class="amt" id="ing-amt-${k}" type="text" inputmode="decimal" placeholder="Amount" value="${esc(i.amountText)}" aria-label="Amount">
      <select class="ing-unit" id="ing-unit-${k}" aria-label="Unit">${UNIT_OPTS.map(([v, l]) => `<option value="${v}" ${i.unit === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <input class="ing-name" id="ing-name-${k}" type="text" placeholder="Ingredient" value="${esc(i.name)}" aria-label="Ingredient">
      <input class="ing-brand" id="ing-brand-${k}" type="text" placeholder="Recommended brand (optional)" value="${esc(i.brand || "")}" aria-label="Recommended brand (optional)">
      <select class="ing-kind" id="ing-kind-${k}" aria-label="Ingredient type"><option value="">${esc("Auto: " + guessKind(i.name))}</option>${KINDS.map(x => `<option ${i.kind === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>
      <label class="flt" title="Pour on top of each glass at serving"><input type="checkbox" id="ing-float-${k}" ${i.float ? "checked" : ""}>Float</label>
      <button class="x" type="button" data-rm="${k}" aria-label="Remove ingredient">×</button>
    </div>`).join("");
  m.innerHTML = `
    <form class="form" id="form" novalidate>
      <div class="editor-top"><h2>${e.id ? "Edit " + esc(e.name || "drink") : S.isCopy ? "Copy to your cart" : "New drink"}</h2>
        ${!e.id && !S.isCopy && S.backend === "supabase" ? `<button class="btn small" type="button" id="fill-photo">Fill from a photo</button>` : ""}</div>
      ${S.scanNote ? `<div class="scan-banner"><span><b>${esc(S.scanNote.title || "Read from your photo.")}</b> ${esc(S.scanNote.body || "Check the amounts and names before saving.")}</span>${S.scanNote.warning ? `<span>${esc(S.scanNote.warning)}</span>` : ""}</div>` : ""}
      <div class="field"><label for="f-name">Name</label><input id="f-name" type="text" value="${esc(e.name)}" placeholder="Drink name" autocomplete="off"></div>
      <div class="row2">
        <div class="field"><label for="f-glass">Glass</label><input id="f-glass" type="text" list="glasses" value="${esc(e.glass)}" placeholder="Glass"></div>
        <div class="field"><label for="f-method">Method</label><select id="f-method">${METHODS.map(x => `<option ${e.method === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div class="field"><label for="f-garnish">Garnish</label><input id="f-garnish" type="text" value="${esc(e.garnish)}" placeholder="Garnish"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="f-type">Cocktail type</label><select id="f-type"><option value="" id="f-type-auto">${esc("Auto: " + guessType(draftDrink()))}</option>${TYPES.map(x => `<option ${e.type === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
        <div class="field"><label for="f-base">Base spirit</label><select id="f-base"><option value="" id="f-base-auto">${esc("Auto: " + guessBase(draftDrink()))}</option>${BASES.map(x => `<option ${e.base === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
      </div>
      <datalist id="glasses"><option>Rocks</option><option>Coupe</option><option>Nick &amp; Nora</option><option>Collins</option><option>Highball</option><option>Martini</option><option>Copper mug</option><option>Wine glass</option><option>Tiki mug</option><option>Flute</option></datalist>
      <div class="field">
        <span class="label">Ingredients · amounts for one drink</span>
        <div class="ings">
          <div class="ing-head"><span>Amount</span><span>Unit</span><span>Ingredient</span><span>Recommended brand</span><span>Type</span><span>On top</span><span></span></div>
          ${ingRows}
        </div>
        <div><button class="btn small" type="button" id="add-ing">+ Add ingredient</button> <span class="hint">Fractions like 3/4 or 1 1/2 work. Brand is optional. Type sorts the ingredient for filters; Auto guesses from the name. Tick Float for anything poured on top at the end.</span></div>
      </div>
      <div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" placeholder="Notes">${esc(e.notes)}</textarea></div>
      ${errMsg ? `<div class="err" role="alert">${esc(errMsg)}</div>` : ""}
      <div class="form-actions"><button class="btn primary" type="submit" id="save-btn">${e.id ? "Save changes" : "Add to My Bar"}</button><button class="btn" type="button" id="cancel-btn">Cancel</button></div>
    </form>`;
  const refreshAuto = () => {
    readForm();
    const dd = draftDrink();
    $("f-type-auto").textContent = "Auto: " + guessType(dd);
    $("f-base-auto").textContent = "Auto: " + guessBase(dd);
    document.querySelectorAll(".ing-row").forEach((r, k) => { r.querySelector(".ing-kind option[value='']").textContent = "Auto: " + guessKind(e.ingredients[k].name); });
  };
  m.querySelectorAll(".ing-name, .ing-brand, .amt").forEach(x => x.addEventListener("input", refreshAuto));
  m.querySelectorAll(".ing-unit, .ing-kind, #f-method, .flt input").forEach(x => x.addEventListener("change", refreshAuto));
  $("add-ing").onclick = () => { readForm(); e.ingredients.push({ amountText: "", unit: "oz", name: "" }); renderEditor(); $("ing-amt-" + (e.ingredients.length - 1)).focus(); };
  m.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { readForm(); e.ingredients.splice(Number(b.dataset.rm), 1); if (!e.ingredients.length) e.ingredients.push({ amountText: "", unit: "oz", name: "" }); renderEditor(); });
  $("cancel-btn").onclick = () => { const back = S.scanNote && S.scanNote.title && S.ideasState && S.ideasState.drinks; S.editing = null; S.scanNote = null; if (back) { S.view = "make"; renderList(); renderMake(); } else { S.view = "detail"; renderList(); renderMain(); } };
  if ($("fill-photo")) $("fill-photo").onclick = () => $("scan-file").click();
  wireIngredientHelp(m);
  $("form").onsubmit = async ev => {
    ev.preventDefault(); readForm();
    if (!e.name.trim()) return renderEditor("Give the drink a name.");
    const ings = [];
    for (const i of e.ingredients) {
      const nm = (i.name || "").trim(); const txt = (i.amountText || "").trim();
      if (!nm && !txt) continue;
      if (!nm) return renderEditor("One ingredient has an amount but no name.");
      const a = parseAmount(txt);
      if (!(a > 0)) return renderEditor(`Check the amount for ${nm}. Use numbers like 2, 0.75 or 1 1/2.`);
      const ing = { amount: a, unit: i.unit, name: nm };
      if (i.float) ing.float = true;
      if ((i.brand || "").trim()) ing.brand = i.brand.trim();
      if (i.kind) ing.kind = i.kind;
      ings.push(ing);
    }
    if (!ings.length) return renderEditor("Add at least one ingredient.");
    const isNew = !e.id;
    const id = e.id || (e.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "drink") + "-" + Math.random().toString(36).slice(2, 7);
    const d = { id, name: e.name.trim(), glass: e.glass.trim(), method: e.method, garnish: e.garnish.trim(), notes: e.notes.trim(), ingredients: ings, updatedAt: new Date().toISOString() };
    if (e.type) d.type = e.type;
    if (e.base) d.base = e.base;
    if (e.photo) d.photo = e.photo;
    if (e.owner) d.owner = e.owner;
    if (e.origin) d.origin = e.origin;
    $("save-btn").disabled = true;
    const ok = await saveDrink(d);
    if (!ok) { $("save-btn").disabled = false; return; }
    S.selected = id; S.view = "detail"; S.scanNote = null; if (!passesFilters(S.drinks.find(x => x.id === id) || d)) { S.f = { owner: "", type: "", base: "", method: "", kind: "", rating: "" }; S.query = ""; $("search").value = ""; } renderFilters(); S.editing = null; S.servings = 1; S._fillL = null;
    if (S.backend === "db" && !S.drinks.find(x => x.id === id)) S.drinks.push(d);
    renderList(); renderMain(); toast(isNew ? "Added " + d.name : "Saved " + d.name);
  };
}
