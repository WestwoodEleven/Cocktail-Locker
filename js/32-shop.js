// ---------- shopping list ----------
// One private list, saved to your account (supabase/shopping-setup.sql). Add to it from What can I make?,
// a recipe, the party planner, your bottles and the Bottle guide. Bottles you've marked out of stock are suggested.
S.shop = []; S.shopOff = false; S.shopPrompt = null;
async function loadShop() {
  if (!sb || !uid()) { S.shop = []; return; }
  const { data, error } = await sb.from("shopping_list").select("id, name, kind, reason, done, created_at").eq("user_id", uid());
  S.shopOff = !!error; S.shop = error ? [] : (data || []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id - b.id);
}
const shopOpen = () => S.shop.filter(x => !x.done);
const onShop = name => { const k = ingKey(name); return S.shop.find(x => !x.done && (ingKey(x.name) === k || sameThing(ingKey(x.name), k))); };
const BOTTLE_KINDS = ["Spirit", "Liqueur", "Vermouth & wine", "Bitters"];
const shopKind = name => BOTTLE_KINDS.includes(guessKind(name)) ? "bottle" : "mixer";
// Add one item (or update its reason if it's already there). Returns true when something changed.
async function addToShop(name, reason, opts = {}) {
  name = String(name || "").trim().slice(0, 80); if (!name) return false;
  if (!uid()) { toast("Sign in to keep a shopping list."); return false; }
  const have = onShop(name);
  if (have) { if (!opts.quiet) toast(`${have.name} is already on your list`); return false; }
  const row = { user_id: uid(), name, kind: opts.kind || shopKind(name), reason: reason ? String(reason).slice(0, 200) : null, done: false };
  const { data, error } = await sb.from("shopping_list").insert(row).select().single();
  if (error) { toast(/relation|does not exist|schema cache/i.test(error.message || "") ? "The shopping list isn't set up yet. Run shopping-setup.sql in Supabase." : "Couldn't add it. Try again."); return false; }
  S.shop.push(Object.assign({ id: (data && data.id) || Date.now(), created_at: new Date().toISOString() }, row));
  if (!opts.quiet) toast(`Added ${name} to your shopping list`);
  updateShopBadges();
  return true;
}
async function addManyToShop(items) {
  let n = 0;
  for (const [name, reason] of items) if (await addToShop(name, reason, { quiet: true })) n++;
  toast(n ? `Added ${n} item${n === 1 ? "" : "s"} to your shopping list` : "Already on your list");
  if (VIEWS[S.view]) renderMain();
}
function updateShopBadges() {
  const n = shopOpen().length;
  document.querySelectorAll("[data-shop-count]").forEach(el => { el.textContent = n ? String(n) : ""; el.hidden = !n; });
}
// A small "+ List" button; turns into "✓ On list" once added.
function shopBtn(name, reason, label) {
  if (S.backend !== "supabase" || !uid() || S.shopOff) return "";
  const on = !!onShop(name);
  return `<button type="button" class="shop-add${on ? " on" : ""}" data-shop-add="${esc(name)}" data-shop-why="${esc(reason || "")}" ${on ? "disabled" : ""} aria-label="${on ? esc(name) + " is on your shopping list" : "Add " + esc(name) + " to your shopping list"}">${on ? "✓ On list" : esc(label || "+ List")}</button>`;
}
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-shop-add]"); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (await addToShop(b.dataset.shopAdd, b.dataset.shopWhy)) {
    if (S.view === "shop") { renderMain(); return; }
    b.classList.add("on"); b.disabled = true; b.textContent = "✓ On list";
  }
}, true);

// Out-of-stock bottles that aren't on the list yet.
function shopSuggestions() {
  return savedItems().filter(x => typeof x !== "string" && x.out).map(x => x.brand ? `${x.name} (${x.brand})` : x.name).filter(n => !onShop(n.replace(/ \(.*\)$/, "")) && !onShop(n));
}
// Which bottle group something goes in when you've bought it.
function bottleGroupFor(name) { const k = guessKind(name); return k === "Bitters" ? "bitters" : k === "Syrup & sweetener" ? "syrups" : "liquors"; }
function savedMatch(name) {
  const k = ingKey(name.replace(/ \(.*\)$/, ""));
  for (const key of ["liquors", "syrups", "bitters"]) {
    const idx = (S.bar[key] || []).findIndex(x => { const v = barItem(x); return sameThing(ingKey(v.name), k) || (v.brand && sameThing(ingKey(v.brand), k)); });
    if (idx >= 0) return { key, idx, item: barItem(S.bar[key][idx]) };
  }
  return null;
}

function openShop() {
  if (!uid()) { toast("Sign in to keep a shopping list."); return; }
  S.view = "shop"; S.confirmDelete = false; S.shopPrompt = null; setHash("shopping-list");
  renderList(); renderMain(); window.scrollTo({ top: 0 });
}
HASH_VIEWS["shopping-list"] = openShop;
VIEWS.shop = function renderShop() {
  const m = $("main");
  if (!uid()) { m.innerHTML = `<div class="make"><h2 class="make-title">Shopping list</h2><p class="hint">Sign in to keep a shopping list.</p></div>`; return; }
  const open = shopOpen(), done = S.shop.filter(x => x.done), sugg = shopSuggestions();
  const item = x => `<li class="shop-item${x.done ? " done" : ""}" data-sid="${x.id}">
      <label class="shop-check"><input type="checkbox" data-shop-done="${x.id}" ${x.done ? "checked" : ""}><span class="box" aria-hidden="true"></span>
        <span class="txt"><b>${esc(x.name)}</b>${x.reason && !x.done ? `<span class="hint">${esc(x.reason)}</span>` : ""}</span></label>
      ${x.done ? "" : `<button type="button" class="x" data-shop-rm="${x.id}" aria-label="Remove ${esc(x.name)}">×</button>`}</li>
      ${S.shopPrompt === x.id ? promptHtml(x) : ""}`;
  const group = (title, list) => list.length ? `<li class="shop-grp">${title}</li>${list.map(item).join("")}` : "";
  m.innerHTML = `<div class="make shop-page">
    <div class="editor-top"><div><span class="label">Yours only</span><h2 class="make-title">Shopping list</h2></div>
      <div class="panel-actions">${open.length ? `<button class="btn small" type="button" id="shop-share">Share</button>` : ""}<button class="btn small" type="button" id="shop-back">Back</button></div></div>
    ${S.shopOff ? `<div class="scan-banner"><span><b>The shopping list isn't set up yet.</b> Run shopping-setup.sql in Supabase.</span></div>` : ""}
    <form class="chip-add shop-form" id="shop-form"><input id="shop-in" type="text" maxlength="80" placeholder="Something to buy" autocomplete="off" aria-label="Something to buy"><button class="btn small primary" type="submit">Add</button></form>
    <ul class="shop-list">
      ${open.length ? group("Bottles", open.filter(x => x.kind === "bottle")) + group("Juices, mixers &amp; more", open.filter(x => x.kind !== "bottle"))
        : `<li class="hint shop-empty">Nothing to buy. Add things here, or with <b>+ List</b> on What can I make?, a recipe, the party planner, your bottles or the Bottle guide.</li>`}
      ${sugg.length ? `<li class="shop-grp">Suggested <span>you marked these out of stock</span></li>${sugg.map(n => `<li class="shop-sugg"><span class="txt"><b>${esc(n)}</b><span class="hint">Out of stock in My Bottles</span></span>${shopBtn(n, "Out of stock", "Add")}</li>`).join("")}` : ""}
      ${done.length ? `<li class="shop-grp">Got it <span>${done.length}</span><button type="button" class="linkish" id="shop-clear">Clear</button></li>${done.map(item).join("")}` : ""}
    </ul>
  </div>`;
  wireShop();
};
function promptHtml(x) {
  const match = savedMatch(x.name);
  if (match && !match.item.out) return "";
  return `<li class="shop-prompt"><b>Got ${esc(x.name)}.</b> ${match ? "Mark it back in stock in My Bottles?" : "Add it to My Bottles?"}
    <div class="panel-actions" style="justify-content:flex-start"><button class="btn small primary" type="button" id="shop-stock">${match ? "Back in stock" : "Add to My Bottles"}</button><button class="btn small" type="button" id="shop-later">Not now</button></div>
    <span class="hint">Then What can I make? counts it.</span></li>`;
}
function wireShop() {
  const m = $("main");
  $("shop-back").onclick = () => history.state && history.state.inSite ? history.back() : openHome();
  $("shop-form").onsubmit = async e => { e.preventDefault(); const v = $("shop-in").value.trim(); if (!v) return; if (await addToShop(v, "", { quiet: true })) { renderMain(); $("shop-in").focus(); } else toast(`${v} is already on your list`); };
  if ($("shop-share")) $("shop-share").onclick = async () => {
    const text = "My Cocktail Cart shopping list:\n" + shopOpen().map(x => "☐ " + x.name).join("\n");
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); toast("Shopping list copied"); } catch (e) { toast("Couldn't copy. Try again."); }
  };
  m.querySelectorAll("[data-shop-done]").forEach(cb => cb.onchange = async () => {
    const x = S.shop.find(i => String(i.id) === cb.dataset.shopDone); if (!x) return;
    const done = cb.checked;
    const { error } = await sb.from("shopping_list").update({ done }).eq("id", x.id);
    if (error) { cb.checked = !done; toast("Couldn't save. Try again."); return; }
    x.done = done; S.shopPrompt = done && x.kind === "bottle" ? x.id : null;
    updateShopBadges(); renderMain();
  });
  m.querySelectorAll("[data-shop-rm]").forEach(b => b.onclick = async () => {
    const id = Number(b.dataset.shopRm);
    const { error } = await sb.from("shopping_list").delete().eq("id", id);
    if (error) { toast("Couldn't remove. Try again."); return; }
    S.shop = S.shop.filter(x => x.id !== id); updateShopBadges(); renderMain();
  });
  if ($("shop-clear")) $("shop-clear").onclick = async () => {
    const ids = S.shop.filter(x => x.done).map(x => x.id);
    const { error } = await sb.from("shopping_list").delete().in("id", ids);
    if (error) { toast("Couldn't clear. Try again."); return; }
    S.shop = S.shop.filter(x => !x.done); S.shopPrompt = null; renderMain();
  };
  if ($("shop-stock")) $("shop-stock").onclick = () => {
    const x = S.shop.find(i => i.id === S.shopPrompt); if (!x) return;
    const match = savedMatch(x.name);
    if (match) { S.bar[match.key][match.idx] = Object.assign(barItem(S.bar[match.key][match.idx]), { out: false }); afterItems(match.key); toast(`${match.item.name} is back in stock`); }
    else { addItem(bottleGroupFor(x.name), x.name.replace(/ \(.*\)$/, ""), (x.name.match(/\(([^)]+)\)$/) || [])[1] || ""); toast(`Added ${x.name} to My Bottles`); }
    S.shopPrompt = null; renderMain();
  };
  if ($("shop-later")) $("shop-later").onclick = () => { S.shopPrompt = null; renderMain(); };
}

// ---------- add buttons around the site ----------
// A recipe: the ingredients you don't have (basics skipped when "Assume I have the basics" is on).
function addRecipeToShop(d) {
  const keys = barKeys();
  const need = (d.ingredients || []).filter(i => i.name && !(keys.some(b => sameThing(b, ingKey(i.name)) || (i.brand && sameThing(b, ingKey(i.brand))))) && !(S.assumeBasics && isBasic(i)) && !ALWAYS_HAVE.includes(ingKey(i.name)));
  if (!need.length) { toast("You have everything for this one"); return; }
  addManyToShop(need.map(i => [i.brand ? `${i.name} (${i.brand})` : i.name, "For the " + d.name]));
}
