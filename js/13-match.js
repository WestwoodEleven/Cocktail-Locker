// The Cocktail Locker: ingredient clean-up and "What can I make?". Scripts share one global scope and load in numbered order.

// ---------- ingredient names ----------
// A comparison key that ignores small wording differences ("Fresh lime juice" = "Lime juice", "Limes" = "Lime").
const ING_NOISE = /\b(fresh(ly)?|squeezed|chilled|cold|homemade|house|good|quality|premium|your favou?rite|of choice|a splash of|splash|top( up)? with)\b/g;
function ingKey(name) {
  return String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\([^)]*\)/g, " ").replace(/\b\d+\s*:\s*\d+\b/g, " ").replace(ING_NOISE, " ")
    .replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\b(limes|lemons|oranges|grapefruits|cherries|eggs)\b/g, w => w === "cherries" ? "cherry" : w.slice(0, -1));
}
// Known ingredient names across every recipe, most common spelling first.
function knownIngredients() {
  const byKey = new Map();
  allDrinks().forEach(d => (d.ingredients || []).forEach(i => {
    const k = ingKey(i.name); if (!k) return;
    const e = byKey.get(k) || { count: 0, names: new Map() };
    e.count++; e.names.set(i.name, (e.names.get(i.name) || 0) + 1);
    byKey.set(k, e);
  }));
  return [...byKey.entries()].map(([k, e]) => ({ key: k, count: e.count, name: [...e.names.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
function suggestSpelling(name) {
  const k = ingKey(name); if (!k) return "";
  const hit = knownIngredients().find(x => x.key === k);
  return hit && hit.name.toLowerCase() !== String(name).trim().toLowerCase() && hit.count >= 1 ? hit.name : "";
}
// Called by the editor after it renders: suggestions as you type, and "Did you mean…?" for near-duplicates.
function wireIngredientHelp(m) {
  let dl = $("dl-ings");
  if (!dl) { dl = document.createElement("datalist"); dl.id = "dl-ings"; m.appendChild(dl); }
  dl.innerHTML = knownIngredients().slice(0, 300).map(x => `<option value="${esc(x.name)}">`).join("");
  m.querySelectorAll(".ing-name").forEach(inp => {
    inp.setAttribute("list", "dl-ings");
    const row = inp.closest(".ing-row");
    const check = () => {
      const s = inp.value.trim() ? suggestSpelling(inp.value) : "";
      const old = row.querySelector(".ing-dym");
      if (old && old.dataset.s === s) return;
      if (old) old.remove();
      if (!s) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "ing-dym"; b.dataset.s = s;
      b.addEventListener("mousedown", e => e.preventDefault());
      b.innerHTML = `Others call this <b>${esc(s)}</b>. Use that name?`;
      b.onclick = () => { inp.value = s; inp.dispatchEvent(new Event("input", { bubbles: true })); b.remove(); };
      row.appendChild(b);
    };
    inp.addEventListener("change", check);
    inp.addEventListener("blur", check);
  });
}

// ---------- what can I make? ----------
const ALWAYS_HAVE = ["ice", "water", "sugar", "simple syrup", "sugar syrup", "salt"];
const SYN = [
  ["whiskey", "whisky", "bourbon", "rye", "rye whiskey", "scotch", "blended scotch", "irish whiskey", "bourbon whiskey"],
  ["orange liqueur", "cointreau", "triple sec", "grand marnier", "curacao", "dry curacao", "orange curacao"],
  ["sweet vermouth", "carpano antica", "punt e mes", "cocchi di torino", "rosso vermouth", "red vermouth"],
  ["dry vermouth", "dolin dry", "noilly prat", "french vermouth"],
  ["lime juice", "lime"], ["lemon juice", "lemon"], ["orange juice", "orange"], ["grapefruit juice", "grapefruit"],
  ["soda water", "club soda", "sparkling water", "seltzer", "soda"],
  ["angostura bitters", "angostura", "aromatic bitters"],
  ["cream of coconut", "coco lopez", "coconut cream"],
  ["egg white", "egg"],
  ["simple syrup", "sugar", "sugar syrup", "rich simple syrup", "demerara syrup", "rich demerara syrup"],
  ["maraschino liqueur", "luxardo maraschino", "maraschino"],
  ["prosecco", "sparkling wine", "champagne", "cava"]
];
const tokens = k => k.split(" ").filter(Boolean);
function sameThing(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const ta = tokens(a), tb = tokens(b);
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length && short.every(t => long.includes(t))) return true;
  return SYN.some(g => g.includes(a) && g.includes(b));
}
function barKeys() {
  return [...inStock(savedItems()).flatMap(x => typeof x === "string" ? [x] : [x.name, x.brand]), ...S.fresh].map(ingKey).filter(Boolean);
}
function haveIngredient(i, keys) {
  const k = ingKey(i.name), bk = ingKey(i.brand);
  if (ALWAYS_HAVE.includes(k)) return true;
  return keys.some(b => sameThing(b, k) || (bk && sameThing(b, bk)));
}
// Ingredients you have on your list but marked out of stock
function outOfStock(i) {
  const k = ingKey(i.name), bk = ingKey(i.brand);
  const keys = savedItems().filter(x => typeof x !== "string" && x.out).flatMap(x => [x.name, x.brand]).map(ingKey).filter(Boolean);
  return keys.some(b => sameThing(b, k) || (bk && sameThing(b, bk)));
}
function missingFor(d, keys) { return (d.ingredients || []).filter(i => !haveIngredient(i, keys)); }
function canMakeResults() {
  const keys = barKeys();
  const ready = [], one = [], two = [];
  allDrinks().forEach(d => {
    if (!(d.ingredients || []).length) return;
    const miss = missingFor(d, keys);
    if (!miss.length) ready.push(d); else if (miss.length === 1) one.push([d, miss]); else if (miss.length === 2) two.push([d, miss]);
  });
  const order = (a, b) => (score(b) - score(a)) || byName(a, b);
  return { ready: ready.sort(order), one: one.sort((a, b) => order(a[0], b[0])), two: two.sort((a, b) => order(a[0], b[0])), keys };
}
$("canmake-btn").onclick = () => openCanMake();
function openCanMake() {
  if (!uid()) { toast("Sign in to save your bottles and see what you can make."); return; }
  S.view = "canmake"; S.confirmDelete = false; setHash("can-make");
  renderList(); renderMain();
  $("main").scrollIntoView({ behavior: "smooth", block: "start" });
}
HASH_VIEWS["can-make"] = openCanMake;
VIEWS.canmake = function renderCanMake() {
  const m = $("main");
  const r = canMakeResults();
  const missRow = ([d, miss]) => drinkRow(d, true).replace('<span class="sub">', `<span class="sub"><span class="miss">${esc(miss.every(outOfStock) ? "Out of " + miss.map(i => i.name).join(" and ") : "Missing " + miss.map(i => i.name + (outOfStock(i) ? " (out)" : "")).join(" and "))}</span> · `);
  const commonMissing = (() => {
    const c = new Map();
    r.one.forEach(([, miss]) => { const k = ingKey(miss[0].name); const e = c.get(k) || { name: miss[0].name, n: 0 }; e.n++; c.set(k, e); });
    return [...c.values()].sort((a, b) => b.n - a.n).slice(0, 3);
  })();
  m.innerHTML = `
    <div class="make">
      <div class="editor-top"><div><span class="label">From your bottles</span><h2 class="make-title">What can I make?</h2></div>
        <button class="btn small" type="button" id="cm-close">Back to drinks</button></div>
      <p class="hint" style="margin:0">Matches your bottles and today's fresh ingredients against every recipe on the site. Ice, water and sugar are assumed.</p>
      ${!r.keys.length ? `<div class="scan-banner"><span><b>No bottles yet.</b> Add your bottles below to see what you can make.</span></div>` : ""}
      <section class="make-sec">
        <div class="sec-head"><h3>Ready to make <span class="count">${r.ready.length}</span></h3></div>
        ${r.ready.length ? `<ul class="plist">${r.ready.map(d => drinkRow(d, true)).join("")}</ul>` : `<p class="hint" style="margin:0">Nothing yet. Add citrus and mixers under Fresh today, or check the near misses below.</p>`}
      </section>
      <section class="make-sec">
        <div class="sec-head"><h3>Missing one ingredient <span class="count">${r.one.length}</span></h3>
          ${commonMissing.length ? `<span class="hint">Worth buying: ${commonMissing.map(x => `${esc(x.name)} (${x.n})`).join(", ")}</span>` : ""}</div>
        ${r.one.length ? `<ul class="plist">${r.one.map(missRow).join("")}</ul>` : `<p class="hint" style="margin:0">None.</p>`}
      </section>
      ${r.two.length ? `<section class="make-sec"><div class="sec-head"><h3>Missing two <span class="count">${r.two.length}</span></h3></div><ul class="plist">${r.two.slice(0, 30).map(missRow).join("")}</ul></section>` : ""}
      <section class="make-sec">
        <div class="sec-head"><h3>Fresh today</h3><span class="hint">Citrus, mixers and garnishes, remembered on this device.</span></div>
        ${GROUPS.filter(g => !g.saved).map(chipGroupHtml).join("")}
      </section>
      <section class="make-sec">
        <div class="sec-head"><h3>My bottles</h3><span class="hint"><span id="bar-saved">Changes save automatically.</span> · <button type="button" class="linkish" data-stock-open>Add bottles from photos</button></span></div>
        ${GROUPS.filter(g => g.saved).map(chipGroupHtml).join("")}
      </section>
    </div>`;
  wireGroups(GROUPS);
  m.querySelectorAll("[data-open]").forEach(b => b.onclick = () => selectDrink(b.dataset.open));
  $("cm-close").onclick = () => { S.view = "detail"; setHash(null); renderList(); renderMain(); };
};
