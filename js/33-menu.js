// ---------- Decode a cocktail menu (the menu decoder) ----------
// Photograph a bar's cocktail menu: each drink comes back with the classic it's built on, an estimated home spec,
// steps, and recipes for house-made syrups and infusions (AI mode "menu", one request per menu).
// Every menu you decode is saved to your account (supabase/menus-setup.sql) under My menus.
// The one you last opened is also kept on this device.
S.menuRes = (() => { try { return JSON.parse(localStorage.getItem("mc-menu") || "null"); } catch (e) { return null; } })();
S.menuBusy = null; S.menus = []; S.menusOff = false;
const menuOfRow = x => ({ id: x.id, bar: x.bar || "", drinks: x.drinks || [], at: x.created_at });
function setMenuRes(r) {
  S.menuRes = r; S.menuSel = null;
  try { if (r) localStorage.setItem("mc-menu", JSON.stringify(r)); else localStorage.removeItem("mc-menu"); } catch (e) {}
}
async function loadMenus() {
  if (!sb || !uid()) { S.menus = []; return; }
  const { data, error } = await sb.from("menus").select("id, bar, drinks, created_at").eq("user_id", uid());
  S.menusOff = !!error; if (error) { S.menus = []; return; }
  S.menus = (data || []).map(menuOfRow).sort((a, b) => String(b.at).localeCompare(String(a.at)) || b.id - a.id);
  const r = S.menuRes;
  if (r && r.id && !S.menus.some(m => m.id === r.id)) setMenuRes(S.menus[0] || null); // deleted on another device
  else if (r && !r.id && Array.isArray(r.drinks) && r.drinks.length) { const saved = await saveMenu(r); if (saved) setMenuRes(saved); } // a menu from before My menus
  if (S.view === "profile" || S.view === "menu") renderMain();
}
// Sorted by restaurant name ("The Varnish" files under V); menus without a name go last.
const menuSortKey = x => String(x.bar || "").trim().toLowerCase().replace(/^the\s+/, "");
function menusSorted(list = S.menus) {
  return list.slice().sort((a, b) => !a.bar - !b.bar || menuSortKey(a).localeCompare(menuSortKey(b)) || String(b.at).localeCompare(String(a.at)));
}
function menuListHtml(list) {
  const day = at => esc(new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: new Date(at).getFullYear() === new Date().getFullYear() ? undefined : "numeric" }));
  return `<ul class="md-list md-menus">${menusSorted(list).map(x => `<li class="md-menu-li"><button type="button" class="md-row" data-md-menu="${x.id}">
      <span class="md-initial" aria-hidden="true">${esc((x.bar || "?").trim().replace(/^the\s+/i, "").charAt(0).toUpperCase())}</span>
      <span class="txt"><b>${esc(x.bar || "Unnamed menu")}</b><span class="hint">${x.drinks.length} drink${x.drinks.length === 1 ? "" : "s"} · ${day(x.at)}</span></span>
      <span class="chev" aria-hidden="true">›</span></button>${x.bar ? "" : `<button type="button" class="linkish md-name-it" data-md-name="${x.id}">Add the name</button>`}</li>`).join("")}</ul>`;
}
// Open, or name, a saved menu from any list of them.
document.addEventListener("click", e => {
  const o = e.target.closest("[data-md-menu]"), n = e.target.closest("[data-md-name]");
  if (n) { e.preventDefault(); const x = S.menus.find(m => String(m.id) === n.dataset.mdName); if (x) renameMenu(x); return; }
  if (!o) return;
  e.preventDefault();
  setMenuRes(S.menus.find(x => String(x.id) === o.dataset.mdMenu) || null);
  if (S.view === "menu") { renderMain(); window.scrollTo({ top: 0 }); } else openMenuDecoder();
});
// The cart page's section.
function menusSectionHtml() {
  if (!uid() || (S.menusOff && !S.menus.length)) return "";
  return `<section class="make-sec" id="prof-menus">
    <div class="sec-head"><h3>My decoded menus${S.menus.length ? ` <span class="count">${S.menus.length}</span>` : ""}</h3>
      <div class="panel-actions"><button class="btn primary small" type="button" id="prof-menu-new" aria-label="Decode a new menu">+ Add</button></div></div>
    ${S.menus.length ? menuListHtml(S.menus) : `<p class="hint" style="margin:0">Photograph a bar's cocktail menu and every drink comes back with a spec to make at home. Menus you decode are kept here.</p>`}
  </section>`;
}
function wireMenusSection() { if ($("prof-menu-new")) $("prof-menu-new").onclick = () => { setMenuRes(null); openMenuDecoder(); }; }
async function saveMenu(r) {
  if (!sb || !uid() || S.menusOff) return null;
  const { data, error } = await sb.from("menus").insert({ user_id: uid(), bar: (r.bar || "").slice(0, 80) || null, drinks: r.drinks }).select().single();
  if (error || !data) { if (error && /relation|does not exist|schema cache/i.test(error.message || "")) S.menusOff = true; return null; }
  const m = menuOfRow(Object.assign({ created_at: r.at || new Date().toISOString() }, data));
  S.menus = [m, ...S.menus.filter(x => x.id !== m.id)];
  return m;
}
const MENU_CONF = { high: "Likely close", medium: "Educated guess", low: "Rough guess" };
function openMenuDecoder() {
  S.view = "menu"; S.confirmDelete = false; S.menuSel = null; setHash("menu");
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
    const r = { bar: data.bar || "", drinks: data.drinks, at: new Date().toISOString() };
    setMenuRes((await saveMenu(r)) || r);
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
  // A shorter version for the share card: the steps as one line, then each house-made recipe as one paragraph.
  const lc = x => String(x).replace(/\.$/, "").replace(/^./, c => c.toLowerCase());
  d.cardNotes = [(m.steps || []).join(" "), ...(m.house_made || []).map(h => `${h.name}: ${(h.ingredients || []).join(", ")}. ${(h.steps || []).join(" ")}${h.keeps ? ` Keeps ${lc(h.keeps)}.` : ""}`)].filter(Boolean).join("\n");
  d.fromMenu = r.bar ? `From ${r.bar}'s menu` : "From a bar menu";
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
// What you're missing for a decoded drink (house-made parts are things to make, not to buy).
function menuNeeds(m) {
  const keys = barKeys();
  return (m.ingredients || []).filter(i => !i.house && !haveIngredient(i, keys));
}
// A1: one short row per drink.
function menuRowHtml(m, k) {
  const d = menuToDrink(m), need = uid() && savedItems().length ? menuNeeds(m).length : -1;
  const status = need < 0 ? "" : need ? `<span class="md-need">Need ${need}</span>` : `<span class="md-can">✓ You can make it</span>`;
  return `<li><button type="button" class="md-row" data-md-open="${k}">
    ${drinkThumb(d)}
    <span class="txt"><b>${esc(m.name)}</b><span class="hint">${m.classic ? `Riff on ${/^[aeiou]/i.test(m.classic) ? "an" : "a"} ${esc(m.classic)}` : esc(m.type || "Original")}</span></span>
    ${status}<span class="chev" aria-hidden="true">›</span></button></li>`;
}
// A2: one drink, laid out like a recipe.
function menuDetailHtml(m, k) {
  const r = S.menuRes || {}, std = m.classic ? stdFor(m.classic) : null, need = menuNeeds(m);
  const ing = i => {
    const h = !i.house && typeof ingHowto === "function" ? ingHowto(i.name) : null;
    const name = h && HOWTO.some(x => x.key === h.key) ? `<button type="button" class="ing-link" data-md-howto="${h.key}" data-md-i="${(m.ingredients || []).indexOf(i)}">${esc(i.name)}</button>` : esc(i.name);
    return `<tr><td class="q">${menuAmount(i)}</td><td class="n">${name}${i.house ? ` <span class="md-make">make it</span>` : ""}</td></tr>`;
  };
  const steps = (m.steps || []).join(" ") + (m.garnish && !(m.steps || []).join(" ").toLowerCase().includes(String(m.garnish).toLowerCase().split(/[ ,]/)[0]) ? ` Garnish: ${m.garnish}.` : "");
  return `<div class="make menu-page md-detail">
    <button type="button" class="linkish md-back" id="md-back">‹ ${r.bar ? esc(r.bar) + "'s menu" : "Back to the menu"}</button>
    <div><h2 class="make-title">${esc(m.name)}</h2>
      <p class="md-sub">${m.classic ? `Riff on ${/^[aeiou]/i.test(m.classic) ? "an" : "a"} ${std ? `<button type="button" class="linkish" data-open-std="${esc(std.id)}">${esc(m.classic)}</button>` : esc(m.classic)}` : esc(m.type || "Original")}${m.riff ? ` · ${esc(m.riff.charAt(0).toLowerCase() + m.riff.slice(1))}` : ""}</p></div>
    <table class="spec-table md-spec"><tbody>${(m.ingredients || []).map(ing).join("")}</tbody></table>
    ${steps ? `<p class="md-steps">${esc(steps)}</p>` : ""}
    <div class="md-folds">
      ${(m.house_made || []).map(h => `<details class="md-fold"><summary>How to make the ${esc(h.name.toLowerCase())}</summary>
        <ul>${(h.ingredients || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
        <ol>${(h.steps || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol>
        ${h.keeps ? `<p class="hint"><b>Keeps:</b> ${esc(h.keeps)}</p>` : ""}${h.shortcut ? `<p class="hint"><b>Shortcut:</b> ${esc(h.shortcut)}</p>` : ""}</details>`).join("")}
      ${m.menu_text || m.note ? `<details class="md-fold"><summary>What the menu said</summary>
        ${m.menu_text ? `<p>“${esc(m.menu_text)}”${m.price ? ` · ${esc(m.price)}` : ""}</p>` : ""}${m.note ? `<p class="hint">${esc(m.note)}</p>` : ""}</details>` : ""}
    </div>
    <div class="panel-actions md-actions">${S.canWrite ? `<button type="button" class="btn primary" id="md-save" aria-label="Save to My Cocktail Cart">Save</button>` : ""}<button type="button" class="btn" id="md-share">Share</button>${uid() && need.length && !S.shopOff ? `<button type="button" class="btn" id="md-shop">+ List</button>` : ""}</div>
    <p class="hint md-fine">Our best guess from the menu, not the bar's own recipe.</p>
  </div>`;
}
function openMenuDrink(k) {
  S.menuSel = k; setHash("menu-drink"); renderMain(); window.scrollTo({ top: 0 });
}
HASH_VIEWS["menu-drink"] = () => { if (S.menuSel == null || !S.menuRes || !S.menuRes.drinks[S.menuSel]) openMenuDecoder(); else { S.view = "menu"; renderList(); renderMain(); } };
VIEWS.menu = function renderMenu() {
  const m = $("main");
  const r = S.menuRes;
  if (!S.menuBusy && r && S.menuSel != null && r.drinks[S.menuSel] && location.hash === "#menu-drink") {
    const k = S.menuSel, dm = r.drinks[k];
    m.innerHTML = menuDetailHtml(dm, k);
    $("md-back").onclick = () => history.state && history.state.inSite ? history.back() : openMenuDecoder();
    m.querySelectorAll("[data-open-std]").forEach(b => b.onclick = () => selectDrink(b.dataset.openStd));
    if ($("md-save")) $("md-save").onclick = () => openEditor(menuToDrink(dm), true);
    if ($("md-shop")) $("md-shop").onclick = () => addRecipeToShop(menuToDrink(dm));
    $("md-share").onclick = () => openShare(menuToDrink(dm));
    m.querySelectorAll("[data-md-howto]").forEach(b => b.onclick = e => {
      e.stopPropagation();
      const sv = S.servings; S.servings = 1; openHowto(b.dataset.mdHowto, menuToDrink(dm), Number(b.dataset.mdI)); S.servings = sv;
    });
    return;
  }
  const head = `${backLink("md-close")}<div class="editor-top"><h2 class="make-title">Decode a cocktail menu</h2>
    ${r ? "" : `<div class="panel-actions"><button class="btn small primary" type="button" id="md-pick">Photograph a menu</button></div>`}</div>`;
  if (S.menuBusy) {
    m.innerHTML = `<div class="make">${head.replace('id="md-pick"', 'id="md-pick" disabled')}
      <div class="scanning"><img class="md-preview" src="${S.menuBusy.preview}" alt="Your menu photo">
        <div class="glass dots">Reading the menu</div><div class="hint">Working out each drink's spec and any house-made syrups. This can take up to a minute.</div></div></div>`;
    $("md-close").onclick = () => goBack(openAsk);
    return;
  }
  const day = at => esc(new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  const others = S.menus.filter(x => !r || x.id !== r.id);
  const mine = others.length ? menuListHtml(others) : "";
  m.innerHTML = `<div class="make menu-page">${head}
    ${r ? (r.id && !r.bar ? `<form class="md-ask-name" id="md-name-form"><label for="md-name-in"><b>Which bar or restaurant is this?</b> We couldn't tell from the photo.</label>
        <div class="chip-add"><input id="md-name-in" type="text" maxlength="80" placeholder="Bar or restaurant name" autocomplete="off"><button class="btn small primary" type="submit">Save</button></div></form>`
      : `<div class="sec-head md-bar"><h3>${esc(r.bar || "Unnamed menu")}</h3>${r.id ? `<button type="button" class="linkish" id="md-rename">Rename</button>` : ""}</div>`) + `
      <div class="md-meta-line"><span>${r.drinks.length} drink${r.drinks.length === 1 ? "" : "s"} · ${day(r.at)}</span>${r.id ? `<button type="button" class="linkish md-del" id="md-delete">Delete</button>` : ""}</div>
      <ul class="md-list">${r.drinks.map(menuRowHtml).join("")}</ul>` + `
      <section class="make-sec"><div class="sec-head"><h3>${others.length ? `My menus <span class="count">${S.menus.length}</span>` : "My menus"}</h3><button class="btn small primary" type="button" id="md-pick">Photograph a menu</button></div>
        ${mine || `<p class="hint" style="margin:0">${S.menusOff ? "Only your latest menu is kept, on this device. Run menus-setup.sql in Supabase to save them all to your account." : "Every menu you decode is saved here."}</p>`}</section>`
    : `<div class="md-intro">
        <p>Take a photo of a bar's cocktail menu. For each drink you'll get:</p>
        <ul><li>the classic it's built on,</li><li>a best-guess spec to make it at home,</li><li>step-by-step instructions,</li><li>recipes for house-made syrups, cordials and infusions,</li><li>and what you're missing from your bottles.</li></ul>
        <p class="hint">${uid() ? "Uses one AI request from your daily allowance. The photo isn't saved; the drinks are, under My menus." : "Sign in to decode menus."}</p></div>
      ${mine ? `<section class="make-sec"><div class="sec-head"><h3>My menus <span class="count">${S.menus.length}</span></h3></div>${mine}</section>` : ""}`}
  </div>`;
  $("md-pick").onclick = pickMenuPhoto;
  $("md-close").onclick = () => goBack(openAsk);
  m.querySelectorAll("[data-md-open]").forEach(b => b.onclick = () => openMenuDrink(Number(b.dataset.mdOpen)));
  if ($("md-rename")) $("md-rename").onclick = () => renameMenu(S.menuRes);
  if ($("md-name-form")) $("md-name-form").onsubmit = e => { e.preventDefault(); nameMenu(S.menuRes, $("md-name-in").value); };
  if ($("md-delete")) $("md-delete").onclick = deleteMenu;
};
async function nameMenu(r, bar) {
  bar = String(bar || "").trim().slice(0, 80); if (!r || !r.id) return false;
  const { error } = await sb.from("menus").update({ bar: bar || null }).eq("id", r.id);
  if (error) { toast("Couldn't save the name. Try again."); return false; }
  r.bar = bar; const x = S.menus.find(m => m.id === r.id); if (x && x !== r) x.bar = bar;
  if (S.menuRes && S.menuRes.id === r.id) { S.menuRes.bar = bar; setMenuRes(S.menuRes); }
  renderMain();
  return true;
}
function renameMenu(r) {
  if (!r || !r.id) return;
  sheet(r.bar ? "Rename menu" : "Name this menu", `<form id="mn-form"><div class="field"><label for="mn-name">Bar or restaurant name</label>
    <input id="mn-name" type="text" maxlength="80" value="${esc(r.bar || "")}" autocomplete="off"></div>
    <div class="panel-actions"><button class="btn primary" type="submit">Save</button></div></form>`);
  const inp = $("mn-name"); inp.focus(); inp.select();
  $("mn-form").onsubmit = async e => {
    e.preventDefault(); if (await nameMenu(r, inp.value)) closeSheet();
  };
}
function deleteMenu() {
  const r = S.menuRes; if (!r || !r.id) return;
  sheet("Delete this menu?", `<p style="margin-top:0">${esc(r.bar || "This menu")} and its ${r.drinks.length} decoded drink${r.drinks.length === 1 ? "" : "s"} will be removed from My menus. Drinks you saved to your cart stay.</p>
    <div class="panel-actions"><button class="btn danger-solid" type="button" id="mn-del">Delete</button><button class="btn" type="button" id="mn-keep">Keep it</button></div>`);
  $("mn-keep").onclick = closeSheet;
  $("mn-del").onclick = async () => {
    const { error } = await sb.from("menus").delete().eq("id", r.id);
    if (error) { toast("Couldn't delete it. Try again."); return; }
    S.menus = S.menus.filter(m => m.id !== r.id); setMenuRes(S.menus[0] || null);
    closeSheet(); renderMain(); toast("Menu deleted");
  };
}
