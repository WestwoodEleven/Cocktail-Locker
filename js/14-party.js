// The Cocktail Locker: party planner. Scripts share one global scope and load in numbered order.
// The plan is kept on this device (localStorage), so it works signed in or not.

const CITRUS_YIELD_OZ = { lime: 1, lemon: 1.25, orange: 2.5, grapefruit: 5 };
const CARBONATED = /soda|tonic|ginger beer|ginger ale|cola|seltzer|sparkling|prosecco|champagne|cava|club/i;
S.party = (() => {
  try { const p = JSON.parse(localStorage.getItem("mc-party") || "null"); if (p && Array.isArray(p.items)) return p; } catch (e) {}
  return { name: "Tonight's menu", guests: 10, perGuest: 2, units: "oz", dilute: true, items: [] };
})();
S.partyQuery = "";
function saveParty() { try { localStorage.setItem("mc-party", JSON.stringify(S.party)); } catch (e) {} }
function openParty() {
  S.view = "party"; S.confirmDelete = false; setHash("party");
  renderList(); renderMain();
  $("main").scrollIntoView({ behavior: "smooth", block: "start" });
}
HASH_VIEWS.party = openParty;
$("party-btn").onclick = openParty;
function addToParty(id) {
  if (!S.party.items.some(x => x.id === id)) S.party.items.push({ id, servings: null });
  saveParty();
}

const partyDrinks = () => S.party.items.map(x => ({ item: x, d: allDrinks().find(d => d.id === x.id) })).filter(x => x.d);
function servingsFor(item, n) {
  if (item.servings) return item.servings;
  return Math.max(1, Math.ceil((S.party.guests * S.party.perGuest) / Math.max(1, n)));
}
const amt = (ml, units) => units === "ml" ? fmtLiters(ml) : fmtOz(ml / ML.oz) + " oz";

function shoppingList() {
  const list = partyDrinks(), n = list.length;
  const byKey = new Map();
  list.forEach(({ item, d }) => {
    const sv = servingsFor(item, n);
    (d.ingredients || []).forEach(i => {
      const k = ingKey(i.name) || i.name.toLowerCase();
      const e = byKey.get(k) || { name: i.name, brand: i.brand || "", kind: kindOf(i), ml: 0, dashes: 0, each: 0, drinks: new Set() };
      const a = (Number(i.amount) || 0) * sv;
      if (i.unit === "each") e.each += a; else if (i.unit === "dash") e.dashes += a; else e.ml += a * (ML[i.unit] || 0);
      if (!e.brand && i.brand) e.brand = i.brand;
      e.drinks.add(d.name);
      byKey.set(k, e);
    });
  });
  const lines = [...byKey.values()].map(e => {
    const parts = [];
    const key = ingKey(e.name);
    const fruit = Object.keys(CITRUS_YIELD_OZ).find(f => key === f + " juice" || key === f);
    if (e.ml) {
      const oz = e.ml / ML.oz;
      if (["Spirit", "Liqueur", "Vermouth & wine"].includes(e.kind)) parts.push(`${amt(e.ml, S.party.units)} · ${Math.ceil(e.ml / 750 - 0.05)} × 750 ml bottle${Math.ceil(e.ml / 750 - 0.05) === 1 ? "" : "s"}`);
      else if (fruit) parts.push(`${amt(e.ml, S.party.units)} · about ${Math.ceil(oz / CITRUS_YIELD_OZ[fruit])} ${fruit}${Math.ceil(oz / CITRUS_YIELD_OZ[fruit]) === 1 ? "" : "s"}`);
      else if (e.kind === "Soda & mixer") parts.push(`${amt(e.ml, S.party.units)} · about ${Math.ceil(oz / 12)} × 12 oz cans`);
      else parts.push(amt(e.ml, S.party.units));
    }
    if (e.dashes) parts.push(`${Math.round(e.dashes)} dashes (about ${fmtOz(e.dashes * ML.dash / ML.oz)} oz)`);
    if (e.each) parts.push(`${fmtCount(e.each)}`);
    return { name: e.name, brand: e.brand, kind: e.kind, detail: parts.join(" + "), drinks: [...e.drinks] };
  });
  const garnishes = new Map();
  list.forEach(({ item, d }) => { if (d.garnish) garnishes.set(d.garnish, (garnishes.get(d.garnish) || 0) + servingsFor(item, n)); });
  const order = ["Spirit", "Liqueur", "Vermouth & wine", "Bitters", "Syrup & sweetener", "Juice", "Soda & mixer", "Egg & dairy", "Other"];
  lines.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name));
  const ice = Math.ceil(S.party.guests * 1.5);
  return { lines, garnishes: [...garnishes.entries()], ice };
}
function shoppingText() {
  const s = shoppingList();
  return [`${S.party.name} · ${S.party.guests} guests`, "", ...s.lines.map(l => `- ${l.name}${l.brand ? ` (${l.brand})` : ""}: ${l.detail}`),
    ...s.garnishes.map(([g, n]) => `- Garnish: ${g} × ${n}`), `- Ice: about ${s.ice} lb`].join("\n");
}

function batchCard({ item, d }, n) {
  const sv = servingsFor(item, n);
  const atServe = (d.ingredients || []).filter(i => i.float || (CARBONATED.test(i.name) && S.party.dilute));
  const batch = (d.ingredients || []).filter(i => !atServe.includes(i));
  const dil = S.party.dilute && batch.length ? (DILUTION[d.method] ?? 0) : 0;
  const batchMl = batch.reduce((s, i) => s + ingMl(i), 0) * sv;
  const mode = S.party.units === "ml" ? "ml" : "oz";
  const row = (i, mult) => { const x = show(i, mult, mode); return `<tr><td class="q">${qHtml(x.q)}</td><td class="u">${esc(x.u)}</td><td class="n">${esc(i.name)}${i.brand ? `<span class="note brand-note">Recommended: <b>${esc(i.brand)}</b></span>` : ""}</td></tr>`; };
  return `<article class="idea party-drink">
    <div class="idea-head"><h3>${esc(d.name)}</h3>
      <div class="stepper small-step"><button type="button" data-sv="${esc(d.id)}" data-d="-1" aria-label="Fewer">−</button><span class="sv">${sv}</span><button type="button" data-sv="${esc(d.id)}" data-d="1" aria-label="More">+</button></div></div>
    <div class="hint">${sv} drink${sv === 1 ? "" : "s"}${item.servings ? ` · <button type="button" class="linkish" data-auto="${esc(d.id)}">Split evenly again</button>` : ""} · <button type="button" class="linkish" data-rmparty="${esc(d.id)}">Remove</button></div>
    <table class="spec-table"><tbody>${batch.map(i => row(i, sv)).join("")}
      ${dil > 0 ? `<tr class="water"><td class="q">${qHtml(amt(batchMl * dil, S.party.units).replace(/ (oz|ml|L)$/, ""))}</td><td class="u">${S.party.units === "ml" ? (batchMl * dil >= 1000 ? "L" : "ml") : "oz"}</td><td class="n">Cold water<span class="note">Pre-dilution, so it pours ready. Chill the batch.</span></td></tr>` : ""}</tbody></table>
    ${atServe.length ? `<p class="idea-line hint"><b>Add to each glass at serving:</b> ${atServe.map(i => { const x = show(i, 1, mode); return esc(`${x.q}${x.u ? " " + x.u : ""} ${i.name}`); }).join(", ")}</p>` : ""}
    <p class="idea-line hint">Batch is about ${qHtml(amt(batchMl * (1 + dil), S.party.units))}${batchMl * (1 + dil) >= 750 ? ` (${Math.round(batchMl * (1 + dil) / 750 * 10) / 10} bottles' worth)` : ""}.</p>
  </article>`;
}

VIEWS.party = function renderParty() {
  const m = $("main"), P = S.party;
  const list = partyDrinks(), n = list.length;
  const q = S.partyQuery.trim().toLowerCase();
  const chosen = new Set(P.items.map(x => x.id));
  const results = q ? allSorted().filter(d => !chosen.has(d.id) && (d.name.toLowerCase().includes(q) || slugify(d.name).includes(slugify(q)))).slice(0, 8) : [];
  const shop = n ? shoppingList() : null;
  m.innerHTML = `
    <div class="make party">
      <div class="editor-top"><div><span class="label">Party planner</span><h2 class="make-title">Plan a party</h2></div>
        <button class="btn small" type="button" id="party-close">Back to drinks</button></div>
      <p class="hint" style="margin:0">Pick the drinks, set the guest count, and get batches, one shopping list and a menu. Your plan is saved on this device.</p>
      <section class="make-sec">
        <div class="row2">
          <div class="field"><label for="pp-name">Menu title</label><input id="pp-name" type="text" maxlength="60" value="${esc(P.name)}"></div>
          <div class="field"><label for="pp-guests">Guests</label><input id="pp-guests" type="number" inputmode="numeric" min="1" max="500" value="${P.guests}"></div>
          <div class="field"><label for="pp-per">Drinks per guest</label><input id="pp-per" type="number" inputmode="decimal" min="0.5" max="10" step="0.5" value="${P.perGuest}"></div>
          <div class="field"><label for="pp-units">Amounts in</label><select id="pp-units"><option value="oz" ${P.units === "oz" ? "selected" : ""}>oz</option><option value="ml" ${P.units === "ml" ? "selected" : ""}>ml and liters</option></select></div>
        </div>
        <label class="check" for="pp-dilute"><input type="checkbox" id="pp-dilute" ${P.dilute ? "checked" : ""}><span>Pre-batch with water<br><span class="hint">Adds the melt from shaking or stirring so batches pour ready. Bubbly mixers and floats are added at serving.</span></span></label>
      </section>
      <section class="make-sec">
        <div class="sec-head"><h3>Drinks <span class="count">${n}</span></h3><span class="hint">${n ? `${P.guests * P.perGuest} drinks in total, split across ${n}` : "Add two to four drinks for a good spread."}</span></div>
        <div class="chip-add"><input id="pp-search" type="search" placeholder="Search for a drink to add" value="${esc(S.partyQuery)}" autocomplete="off"></div>
        ${results.length ? `<ul class="plist">${results.map(d => drinkRow(d, true).replace('class="prow"', 'class="prow" data-addparty="' + esc(d.id) + '"').replace(/data-open="[^"]*"/, "")).join("")}</ul>` : q ? `<p class="hint" style="margin:0">No drinks match. Try another name, or look it up from the main search.</p>` : ""}
        ${n ? `<div class="ideas">${list.map(x => batchCard(x, n)).join("")}</div>` : ""}
      </section>
      ${n ? `
      <section class="make-sec" id="shop">
        <div class="sec-head"><h3>Shopping list</h3>
          <div class="panel-actions">${uid() && S.backend === "supabase" ? `<button class="btn small primary" type="button" id="pp-shop">+ Add all to my list</button>` : ""}<button class="btn small" type="button" id="pp-copy">Copy list</button><button class="btn small" type="button" id="pp-print-list">Print list</button></div></div>
        <ul class="shop">${shop.lines.map(l => `<li><span class="sname">${esc(l.name)}${l.brand ? ` <span class="hint">(${esc(l.brand)})</span>` : ""}</span><span class="sdetail">${qHtml(l.detail)}</span></li>`).join("")}
          ${shop.garnishes.map(([g, c]) => `<li><span class="sname">Garnish: ${esc(g)}</span><span class="sdetail">for ${c} drinks</span></li>`).join("")}
          <li><span class="sname">Ice</span><span class="sdetail">about ${shop.ice} lb</span></li></ul>
      </section>
      <section class="make-sec">
        <div class="sec-head"><h3>Menu card</h3><button class="btn small" type="button" id="pp-print-menu">Print menu</button></div>
        <div class="menu-card" id="menu-card">
          <div class="menu-kicker">My Cocktail Cart</div>
          <h3 class="menu-title">${esc(P.name)}</h3>
          ${list.map(({ d }) => `<div class="menu-item"><div class="menu-name">${esc(d.name)}</div><div class="menu-desc">${esc((d.ingredients || []).filter(i => !/^(ice|water)$/i.test(i.name)).map(i => i.name.toLowerCase()).join(", "))}${d.garnish ? esc(", " + d.garnish.toLowerCase()) : ""}</div></div>`).join("")}
        </div>
      </section>` : ""}
    </div>`;
  const rerender = focusId => { renderMain(); if (focusId && $(focusId)) { const el = $(focusId); el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} } };
  $("party-close").onclick = () => { S.view = "detail"; setHash(null); renderList(); renderMain(); };
  $("pp-name").onchange = e => { P.name = e.target.value.trim() || "Tonight's menu"; saveParty(); rerender(); };
  $("pp-guests").onchange = e => { P.guests = Math.max(1, Math.min(500, Math.round(Number(e.target.value) || 1))); saveParty(); rerender(); };
  $("pp-per").onchange = e => { P.perGuest = Math.max(0.5, Math.min(10, Math.round((Number(e.target.value) || 1) * 2) / 2)); saveParty(); rerender(); };
  $("pp-units").onchange = e => { P.units = e.target.value; saveParty(); rerender(); };
  $("pp-dilute").onchange = e => { P.dilute = e.target.checked; saveParty(); rerender(); };
  $("pp-search").oninput = e => { S.partyQuery = e.target.value; clearTimeout(VIEWS.party.t); VIEWS.party.t = setTimeout(() => rerender("pp-search"), 200); };
  m.querySelectorAll("[data-addparty]").forEach(b => b.onclick = () => { addToParty(b.dataset.addparty); S.partyQuery = ""; rerender("pp-search"); toast("Added to your party"); });
  m.querySelectorAll("[data-rmparty]").forEach(b => b.onclick = () => { P.items = P.items.filter(x => x.id !== b.dataset.rmparty); saveParty(); rerender(); });
  m.querySelectorAll("[data-auto]").forEach(b => b.onclick = () => { const it = P.items.find(x => x.id === b.dataset.auto); if (it) it.servings = null; saveParty(); rerender(); });
  m.querySelectorAll("[data-sv]").forEach(b => b.onclick = () => {
    const it = P.items.find(x => x.id === b.dataset.sv); if (!it) return;
    it.servings = Math.max(1, servingsFor(it, n) + Number(b.dataset.d)); saveParty(); rerender();
  });
  if ($("pp-shop")) $("pp-shop").onclick = () => addManyToShop(shoppingList().lines.map(l => [l.brand ? `${l.name} (${l.brand})` : l.name, `Party: ${String(l.detail).replace(/<[^>]+>/g, "")}`]));
  if ($("pp-copy")) $("pp-copy").onclick = async () => {
    const txt = shoppingText();
    try { await navigator.clipboard.writeText(txt); toast("Shopping list copied"); }
    catch (e) { toast("Couldn't copy here. Use Print list instead."); }
  };
  const printWith = cls => {
    document.body.classList.remove("print-menu", "print-list"); document.body.classList.add(cls);
    const done = () => { document.body.classList.remove(cls); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print();
  };
  if ($("pp-print-menu")) $("pp-print-menu").onclick = () => printWith("print-menu");
  if ($("pp-print-list")) $("pp-print-list").onclick = () => printWith("print-list");
};
