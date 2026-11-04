// ---------- Menu decoder ----------
// Photograph a bar's cocktail menu: each drink comes back with the classic it's built on, an estimated home spec,
// steps, and recipes for house-made syrups and infusions (AI mode "menu", one request per menu).
// The last menu you decoded is kept on this device so you can come back to it.
S.menuRes = (() => { try { return JSON.parse(localStorage.getItem("mc-menu") || "null"); } catch (e) { return null; } })();
S.menuBusy = null;
const MENU_CONF = { high: "Likely close", medium: "Educated guess", low: "Rough guess" };
function openMenuDecoder() {
  S.view = "menu"; S.confirmDelete = false; setHash("menu");
  renderList(); renderMain(); window.scrollTo({ top: 0 });
}
HASH_VIEWS.menu = openMenuDecoder;
function pickMenuPhoto() {
  if (!uid()) { toast("Sign in to decode menus."); const a = $("auth-btn"); if (a && !a.hidden) a.click(); return; }
  let inp = $("menu-file");
  if (!inp) { inp = Object.assign(document.createElement("input"), { type: "file", id: "menu-file", accept: "image/*", hidden: true }); document.body.appendChild(inp);
    inp.onchange = ev => { const f = ev.target.files && ev.target.files[0]; ev.target.value = ""; if (f) decodeMenu(f); }; }
  inp.click();
}
async function decodeMenu(file) {
  let dataUrl;
  try { dataUrl = await shrinkForScan(file); } catch (e) { toast("Couldn't open that photo. Try a JPEG or PNG."); return; }
  const token = {};
  S.menuBusy = { preview: dataUrl, token }; S.view = "menu"; setHash("menu"); renderList(); renderMain(); window.scrollTo({ top: 0 });
  const { data, code, detail } = await invokeHelper({ mode: "menu", image: dataUrl.split(",")[1], mediaType: "image/jpeg" });
  if (!S.menuBusy || S.menuBusy.token !== token) return;
  S.menuBusy = null;
  if (data && Array.isArray(data.drinks) && data.drinks.length) {
    S.menuRes = { bar: data.bar || "", drinks: data.drinks, at: new Date().toISOString() };
    try { localStorage.setItem("mc-menu", JSON.stringify(S.menuRes)); } catch (e) {}
    if (S.view === "menu") renderMain();
    return;
  }
  if (data && data.recipe) toast("The menu reader needs the latest read-recipe function. Redeploy it in Supabase, then try again.");
  else toast(code === "no_menu" ? "Couldn't find cocktails in that photo. Try a closer, straighter shot of the menu." : (SCAN_ERR[code] || "Couldn't read the menu. Try again." + (detail ? " (" + detail + ")" : "")));
  if (S.view === "menu") renderMain();
}
// A decoded drink as a site drink (for saving, matching and the shopping list).
function menuToDrink(m) {
  const r = S.menuRes || {};
  const house = (m.house_made || []).map(h => `${h.name}:\n${(h.ingredients || []).map(x => "- " + x).join("\n")}\n${(h.steps || []).map((x, k) => `${k + 1}. ${x}`).join("\n")}${h.keeps ? `\nKeeps: ${h.keeps}` : ""}`).join("\n\n");
  const notes = [m.menu_text ? `On the menu${r.bar ? ` at ${r.bar}` : ""}: ${m.menu_text}` : "", (m.steps || []).map((x, k) => `${k + 1}. ${x}`).join("\n"), house, "Spec estimated from the menu."].filter(Boolean).join("\n\n");
  const d = recipeToDrink({ name: m.name, method: m.method, glass: m.glass, garnish: m.garnish, type: m.type, base: m.base, notes,
    ingredients: (m.ingredients || []).map(i => ({ amount: i.amount, unit: i.unit, name: i.name, brand: i.brand })) });
  const cl = CLASSIC_NAMES.find(c => c.toLowerCase() === String(m.classic || "").toLowerCase());
  if (cl) d.classic = cl;
  d.origin = r.bar ? `Inspired by ${r.bar}` : "Inspired by a bar menu";
  return d;
}
function menuAmount(i) {
  const a = Number(i.amount) || 0;
  if (!a) return "";
  if (i.unit === "oz") return `${qHtml(fmtOz(a))} oz`;
  if (i.unit === "dash") return `${fmtOz(a)} dash${a === 1 ? "" : "es"}`;
  if (i.unit === "each") return qHtml(fmtOz(a));
  return `${qHtml(fmtOz(a))} ${esc(i.unit)}`;
}
function menuCardHtml(m, k) {
  const keys = barKeys();
  const bottles = (m.ingredients || []).filter(i => !i.house);
  const missing = bottles.filter(i => !haveIngredient(i, keys));
  const houseN = (m.ingredients || []).filter(i => i.house).length;
  const std = m.classic ? stdFor(m.classic) : null;
  const ingRow = i => {
    const h = !i.house && typeof ingHowto === "function" ? ingHowto(i.name) : null;
    const name = i.house ? `<a class="ing-link" href="#md-h-${k}-${slugify(i.name)}">${esc(i.name)}</a> <span class="chip amber">House-made</span>`
      : h && HOWTO.some(x => x.key === h.key) ? `<button type="button" class="ing-link" data-md-howto="${h.key}" data-md-k="${k}" data-md-i="${(m.ingredients || []).indexOf(i)}">${esc(i.name)}</button>` : esc(i.name);
    return `<tr><td class="q">${menuAmount(i)}</td><td class="n">${name}${i.brand ? ` <span class="hint">(${esc(i.brand)})</span>` : ""}${!i.house && missing.includes(i) ? ` <span class="md-miss">You don't have it</span>` : ""}</td></tr>`;
  };
  return `<article class="md-card" id="md-${k}">
    <div class="md-head"><h3>${esc(m.name)}</h3>${m.price ? `<span class="md-price">${esc(m.price)}</span>` : ""}</div>
    ${m.menu_text ? `<p class="md-menu">“${esc(m.menu_text)}”</p>` : ""}
    ${m.classic ? `<p class="md-riff">A riff on the ${std ? `<button type="button" class="linkish" data-open-std="${esc(std.id)}">${esc(m.classic)}</button>` : `<b>${esc(m.classic)}</b>`}${m.riff ? `: ${esc(m.riff)}` : ""}</p>` : ""}
    <div class="md-meta"><span class="md-conf ${esc(m.confidence || "medium")}">${esc(MENU_CONF[m.confidence] || "Educated guess")}</span>${[m.method, m.glass, m.garnish && "Garnish: " + m.garnish].filter(Boolean).map(x => ` · ${esc(x)}`).join("")}</div>
    <div class="md-have ${missing.length ? "" : "ok"}">${uid() && savedItems().length ? (missing.length
      ? `You have ${bottles.length - missing.length} of ${bottles.length}${houseN ? `, plus ${houseN} to make` : ""}. ${missing.map(i => `${esc(i.name)} ${shopBtn(i.name, `For the ${m.name}`)}`).join(" ")}`
      : `You have everything${houseN ? `; just make the ${houseN === 1 ? "house-made part" : "house-made parts"}` : ""}.`) : ""}</div>
    <table class="spec-table md-spec"><tbody>${(m.ingredients || []).map(ingRow).join("")}</tbody></table>
    ${(m.steps || []).length ? `<div><div class="label notes-label">How to make it</div><ol class="md-steps">${m.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol></div>` : ""}
    ${(m.house_made || []).map(h => `<details class="md-house" id="md-h-${k}-${slugify(h.name)}" open>
      <summary>How to make the ${esc(h.name.toLowerCase())}</summary>
      <ul>${(h.ingredients || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <ol>${(h.steps || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol>
      ${h.keeps ? `<p class="hint"><b>Keeps:</b> ${esc(h.keeps)}</p>` : ""}
      ${h.shortcut ? `<p class="hint"><b>Shortcut:</b> ${esc(h.shortcut)}</p>` : ""}
    </details>`).join("")}
    ${m.note ? `<p class="hint md-note">${esc(m.note)}</p>` : ""}
    <div class="panel-actions md-actions">${S.canWrite ? `<button type="button" class="btn small primary" data-md-save="${k}">Save to My Cocktail Cart</button>` : ""}${uid() && missing.length && !S.shopOff ? `<button type="button" class="btn small" data-md-shop="${k}">+ Add what I don't have</button>` : ""}</div>
  </article>`;
}
VIEWS.menu = function renderMenu() {
  const m = $("main");
  const head = `<div class="editor-top"><div><span class="label">Out at a bar?</span><h2 class="make-title">Menu decoder</h2></div>
    <div class="panel-actions"><button class="btn small primary" type="button" id="md-pick">${S.menuRes ? "Decode another menu" : "Photograph a menu"}</button></div></div>`;
  if (S.menuBusy) {
    m.innerHTML = `<div class="make">${head.replace('id="md-pick"', 'id="md-pick" disabled')}
      <div class="scanning"><img class="md-preview" src="${S.menuBusy.preview}" alt="Your menu photo">
        <div class="glass dots">Reading the menu</div><div class="hint">Working out each drink's spec and any house-made syrups. This can take up to a minute.</div></div></div>`;
    return;
  }
  const r = S.menuRes;
  m.innerHTML = `<div class="make menu-page">${head}
    ${r ? `<p class="hint" style="margin:0">${r.bar ? `From <b>${esc(r.bar)}</b>'s menu` : "From your menu photo"} · ${r.drinks.length} drink${r.drinks.length === 1 ? "" : "s"} · ${esc(new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }))}. Specs are educated guesses from the menu, not the bar's own recipes.</p>
      <nav class="md-jump" aria-label="Drinks on this menu">${r.drinks.map((d, k) => `<a href="#md-${k}" data-md-jump="${k}">${esc(d.name)}</a>`).join("")}</nav>
      ${r.drinks.map(menuCardHtml).join("")}`
    : `<div class="md-intro">
        <p>Take a photo of a bar's cocktail menu. For each drink you'll get:</p>
        <ul><li>the classic it's built on,</li><li>a best-guess spec to make it at home,</li><li>step-by-step instructions,</li><li>recipes for house-made syrups, cordials and infusions,</li><li>and what you're missing from your bottles.</li></ul>
        <p class="hint">${uid() ? "Uses one AI request from your daily allowance. The photo isn't saved." : "Sign in to decode menus."}</p></div>`}
  </div>`;
  $("md-pick").onclick = pickMenuPhoto;
  m.querySelectorAll("[data-md-jump]").forEach(a => a.onclick = e => { e.preventDefault(); const t = $("md-" + a.dataset.mdJump); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); });
  m.querySelectorAll('a.ing-link[href^="#md-h-"]').forEach(a => a.onclick = e => { e.preventDefault(); const t = document.getElementById(a.getAttribute("href").slice(1)); if (t) { t.open = true; t.scrollIntoView({ behavior: "smooth", block: "center" }); } });
  m.querySelectorAll("[data-open-std]").forEach(b => b.onclick = () => selectDrink(b.dataset.openStd));
  m.querySelectorAll("[data-md-save]").forEach(b => b.onclick = () => openEditor(menuToDrink(r.drinks[Number(b.dataset.mdSave)]), true));
  m.querySelectorAll("[data-md-shop]").forEach(b => b.onclick = () => addRecipeToShop(menuToDrink(r.drinks[Number(b.dataset.mdShop)])));
  m.querySelectorAll("[data-md-howto]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    const d = menuToDrink(r.drinks[Number(b.dataset.mdK)]);
    const sv = S.servings; S.servings = 1; openHowto(b.dataset.mdHowto, d, Number(b.dataset.mdI)); S.servings = sv;
  });
};
