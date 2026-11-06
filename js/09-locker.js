// The Cocktail Locker: locker. Scripts share one global scope and load in numbered order.
// ---------- favorites ----------
S.favs = new Set();
async function loadFavorites() {
  S.favs = new Set();
  if (!sb || !uid()) return;
  const { data, error } = await sb.from("favorites").select("drink_id").eq("user_id", uid());
  if (error) { S.favsOff = true; return; }
  S.favsOff = false;
  (data || []).forEach(r => S.favs.add(r.drink_id));
}
const isFav = d => S.favs.has(d.id);
async function toggleFav(d) {
  if (!uid()) { toast("Sign in to save favorites."); return; }
  if (S.favsOff) { toast("Favorites aren't switched on yet. The site owner needs to run favorites-setup.sql."); return; }
  const on = !isFav(d);
  const { error } = on ? await sb.from("favorites").upsert({ user_id: uid(), drink_id: d.id })
                       : await sb.from("favorites").delete().eq("user_id", uid()).eq("drink_id", d.id);
  if (error) { toast("Couldn't update your favorites. Try again."); return; }
  on ? S.favs.add(d.id) : S.favs.delete(d.id);
  toast(on ? `Added ${d.name} to your favorites` : `Removed ${d.name} from your favorites`);
  renderFilters(); renderList(); if (S.view === "profile") renderProfile(); else renderMain();
}

// ---------- My Cocktail Cart page ----------
// A grid of icons, one for each part of your cart, with a count on each. Each opens its own page
// (‹ Back returns to the grid). What can I make? and the Shopping list are pages of their own already.
// Under the grid: the admin pages (for admins) and Account.
const CART_SECS = {
  drinks: { title: "My drinks", hash: "cart-drinks" },
  favs: { title: "Favorites", hash: "cart-favorites" },
  log: { title: "My log", hash: "cart-log" },
  bottles: { title: "My bottles", hash: "cart-bottles" },
  menus: { title: "Decoded menus", hash: "cart-menus" },
  lists: { title: "My lists", hash: "cart-lists" },
  following: { title: "Following", hash: "cart-following" },
  account: { title: "Account", hash: "cart-account" }
};
const CART_ICONS = {
  drinks: '<path d="M4 5 H20 C20 9.5 16.5 12.2 12 12.2 C7.5 12.2 4 9.5 4 5 Z M12 12.2 V19 M8 19.6 H16"/>',
  favs: '<path d="M12 20 C5.2 15.2 3 11.6 3 8.6 C3 6 5 4 7.5 4 C9.3 4 10.8 5 12 6.8 C13.2 5 14.7 4 16.5 4 C19 4 21 6 21 8.6 C21 11.6 18.8 15.2 12 20 Z"/>',
  log: '<path d="M4 6 H20 V20 H4 Z M4 10 H20 M8 3.5 V7.5 M16 3.5 V7.5 M9 15 L11 17 L15 13"/>',
  bottles: '<path d="M10 3 H14 V7.2 C14 8.2 17 9.2 17 12 V20 C17 20.6 16.6 21 16 21 H8 C7.4 21 7 20.6 7 20 V12 C7 9.2 10 8.2 10 7.2 Z M7 14 H17 M7 18 H17"/>',
  canmake: '<path d="M8 9.5 H16 L15 21 H9 Z M7.4 9.5 H16.6 M9 9.5 C9 7 10.2 5.8 12 5.8 C13.8 5.8 15 7 15 9.5 M11 3.5 H13 V5.8 H11 Z"/>',
  shop: '<path d="M5 8 H19 L18 21 H6 Z M9 8 V6.5 C9 4.8 10.3 3.5 12 3.5 C13.7 3.5 15 4.8 15 6.5 V8"/>',
  menus: '<path d="M6 3 H18 V21 H6 Z M9 7.5 H15 M9 11 H15 M9 14.5 H13"/>',
  lists: '<path d="M9 6 H20 M9 12 H20 M9 18 H20"/><path d="M4.6 6 H4.7 M4.6 12 H4.7 M4.6 18 H4.7" stroke-width="2.8"/>',
  following: '<path d="M9 11 A3.2 3.2 0 1 0 9 4.6 A3.2 3.2 0 1 0 9 11 Z M3 20 C3 16.4 5.7 14 9 14 C12.3 14 15 16.4 15 20 M16 4.8 A3 3 0 0 1 16 10.8 M17.6 14.3 C19.7 15 21 17.1 21 20"/>'
};
const cartIcon = k => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${CART_ICONS[k]}</svg>`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
function openProfile() {
  if (!uid()) { toast("Sign in to see your cart."); return; }
  S.view = "profile"; S.cartSec = null; S.confirmDelete = false; setHash("my-locker");
  $("name-form").hidden = true;
  renderList(); renderProfile();
  window.scrollTo({ top: 0 });
}
function openCartSec(key) {
  if (!uid()) { toast("Sign in to see your cart."); return; }
  if (!CART_SECS[key]) return openProfile();
  S.view = "profile"; S.cartSec = key; S.confirmDelete = false; setHash(CART_SECS[key].hash);
  $("name-form").hidden = true;
  renderList(); renderProfile();
  window.scrollTo({ top: 0 });
}
Object.keys(CART_SECS).forEach(k => { HASH_VIEWS[CART_SECS[k].hash] = () => openCartSec(k); });
function drinkRow(d, showFrom) {
  const r = ratingOf(d);
  const sub = [typeOf(d), showFrom && !isMine(d) ? (d.standard ? "Classic" : lockerName(d.owner)) : "", r.count ? `★ ${avgOf(d).toFixed(1)}` : ""].filter(Boolean).join(" · ");
  return `<li><button type="button" class="prow" data-open="${esc(d.id)}">
    ${drinkThumb(d)}
    <span class="txt"><span class="nm">${esc(d.name)}</span><span class="sub">${esc(sub)}</span></span>
    ${isFav(d) ? `<span class="fav-mark" aria-label="Favorite">♥</span>` : ""}</button></li>`;
}
function cartHubHtml() {
  const me = myProfile();
  const mine = S.drinks.filter(d => isMine(d)).length, favs = allDrinks().filter(d => isFav(d)).length;
  const bar = inStock(savedItems()).length, out = savedItems().filter(x => typeof x !== "string" && x.out).length;
  const toBuy = typeof shopOpen === "function" ? shopOpen().length : 0, lists = myLists().length, following = followingIds().length, followers = followersOf(uid());
  const tiles = [
    ["drinks", "My drinks", mine ? plural(mine, "drink") : "None yet"],
    ["favs", "Favorites", favs ? `${favs} saved` : "None yet"],
    S.logOff ? null : ["log", "My log", S.log.length ? `Made ${plural(S.log.length, "time")}` : "Nothing yet"],
    ["bottles", "My bottles", out ? `${bar} · ${out} out` : bar ? plural(bar, "bottle") : "Add yours"],
    ["canmake", "What can I make?", bar ? `${canMakeResults().ready.length} ready` : "Add bottles first"],
    ["shop", "Shopping list", toBuy ? `${toBuy} to buy` : "Nothing to buy"],
    S.menusOff && !S.menus.length ? null : ["menus", "Decoded menus", S.menus.length ? plural(S.menus.length, "menu") : "None yet"],
    ["lists", "My lists", S.colsOff ? "Not set up" : lists ? plural(lists, "list") : "None yet"],
    S.followsOff ? null : ["following", "Following", followers ? `${following} · ${plural(followers, "follower")}` : following ? plural(following, "cart") : "No one yet"]
  ].filter(Boolean);
  return `<div class="editor-top"><div><h2 class="make-title">My Cocktail Cart</h2>
      <div class="cart-name"><b>${esc(me && me.display_name ? me.display_name : "Unnamed cart")}</b> · <button class="linkish" type="button" id="prof-rename">Rename</button></div></div></div>
    <nav class="cart-grid" aria-label="Your cart">${tiles.map(([k, label, n]) => `<button type="button" class="cart-tile" data-cart="${k}">
      <span class="ic">${cartIcon(k)}</span><b>${esc(label)}</b><span class="n">${esc(n)}</span></button>`).join("")}</nav>
    <ul class="cart-rows">
      <li><button type="button" data-cart="account" id="prof-account-open"><span>Account</span><span class="chev" aria-hidden="true">›</span></button></li>
      ${adminHtml()}
    </ul>`;
}
// The parts of the cart, each as it used to appear on the long page.
function drinksSecHtml() {
  const mine = sorted().filter(d => isMine(d));
  return `<section class="make-sec" id="prof-drinks">
    <div class="sec-head"><h3>My drinks</h3>
      <div class="panel-actions"><button class="btn primary small" type="button" id="prof-drink-add" aria-haspopup="dialog">+ Add</button></div></div>
    ${mine.length ? `<ul class="plist">${mine.map(d => drinkRow(d, false)).join("")}</ul>`
      : `<p class="hint" style="margin:0">Your cart has no drinks yet. Add one, scan a recipe, or copy someone else's drink.</p>`}
  </section>`;
}
function favsSecHtml() {
  const favs = allSorted().filter(d => isFav(d));
  return `<section class="make-sec" id="prof-favs">
    <div class="sec-head"><h3>Favorites</h3><span class="hint">Only you can see these.</span></div>
    ${S.favsOff ? `<p class="hint" style="margin:0">Favorites aren't switched on yet. The site owner needs to run favorites-setup.sql in Supabase.</p>`
      : favs.length ? `<ul class="plist">${favs.map(d => drinkRow(d, true)).join("")}</ul>`
      : `<p class="hint" style="margin:0">No favorites yet. Tap ♡ Favorite on any drink, yours or someone else's, to keep it here.</p>`}
  </section>`;
}
function barSecHtml() {
  return `<section class="make-sec" id="prof-bar">
    <div class="sec-head"><h3>My bottles</h3>
      <div class="panel-actions"><button class="btn primary small" type="button" id="prof-bottle-add" aria-haspopup="dialog">+ Add</button></div></div>
    <button type="button" class="linkish canmake-link" id="prof-canmake">What can I make with these? ›</button>
    <p class="hint" style="margin:0">Tap a bottle to add its brand. Tap ○ to mark it out of stock, and ↺ when you restock. <span id="bar-saved">${S.barOff ? "Your bottles can't be saved yet. Ask the site owner to run bartender-setup.sql." : "Changes save automatically."}</span></p>
    ${outSummary()}
    ${GROUPS.filter(g => g.saved).map(barGroupHtml).join("")}
  </section>`;
}
// One part as its own page: its heading becomes the page title, its buttons sit on the right and its note under the title.
function cartPageHtml(key, html, id, top) {
  const tpl = document.createElement("template"); tpl.innerHTML = html || "";
  const sec = id ? tpl.content.getElementById(id) : tpl.content.firstElementChild;
  let actions = "", note = "";
  const head = sec && sec.querySelector(":scope > .sec-head");
  if (head) {
    [...head.children].forEach(el => { if (el.tagName === "H3") return; if (el.classList.contains("panel-actions")) actions += el.outerHTML; else note += el.innerHTML; });
    head.remove();
  }
  return `${backLink("cart-back")}
    <div class="editor-top"><h2 class="make-title">${esc(CART_SECS[key].title)}</h2>${actions}</div>
    ${note ? `<p class="hint cart-note">${note}</p>` : ""}${top || ""}
    ${sec ? sec.outerHTML : `<p class="hint">Nothing here yet.</p>`}`;
}
function cartSecHtml(key) {
  const email = S.session && S.session.user && S.session.user.email;
  if (key === "drinks") return cartPageHtml(key, drinksSecHtml());
  if (key === "favs") return cartPageHtml(key, favsSecHtml());
  if (key === "log") return cartPageHtml(key, typeof logSectionHtml === "function" ? logSectionHtml() : "");
  if (key === "bottles") return cartPageHtml(key, barSecHtml());
  if (key === "menus") return cartPageHtml(key, typeof menusSectionHtml === "function" ? menusSectionHtml() : "");
  if (key === "lists") return cartPageHtml(key, profileSocialHtml(), "prof-lists");
  if (key === "following") return cartPageHtml(key, profileSocialHtml(), "prof-following");
  if (key === "account") return cartPageHtml(key, accountHtml(), null, email ? `<p class="hint" style="margin:0">Signed in as ${esc(email)}</p>` : "");
  return cartHubHtml();
}
function renderProfile() {
  const m = $("main");
  const key = S.cartSec && CART_SECS[S.cartSec] ? S.cartSec : null;
  m.innerHTML = `<div class="make cart-page${key ? "" : " cart-home"}">${key ? cartSecHtml(key) : cartHubHtml()}</div>`;
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  if (key === "bottles") wireBarChips(GROUPS.filter(g => g.saved));
  on("prof-bottle-add", () => openBottleAdd());
  on("prof-canmake", () => openCanMake());
  on("prof-rename", () => openNameForm(false));
  on("prof-drink-add", openDrinkAdd);
  on("cart-back", () => goBack(openProfile));
  m.querySelectorAll("[data-open]").forEach(b => b.onclick = () => {
    S.selected = b.dataset.open; S.view = "detail"; setHash(S.selected);
    const d = current(); if (d && !passesFilters(d)) { S.f = { owner: "", type: "", base: "", method: "", kind: "", rating: "" }; S.query = ""; $("search").value = ""; renderFilters(); }
    renderList(); renderMain(); window.scrollTo({ top: 0 });
  });
  m.querySelectorAll("[data-cart]").forEach(b => b.onclick = () => {
    const k = b.dataset.cart;
    if (k === "canmake") openCanMake(); else if (k === "shop") openShop(); else openCartSec(k);
  });
  wireProfileSocial(m);
  if (typeof wireLogSection === "function") wireLogSection();
  if (typeof wireMenusSection === "function") wireMenusSection();
  wireAdmin();
  wireAccount();
}

// Add a drink: from a photo of a recipe, or typed in.
function openDrinkAdd() {
  sheet("Add a drink", `<div class="add-menu">
    <button type="button" id="da-photo"><b>From a photo</b><span>A recipe card, book page or screenshot. We fill in the recipe</span></button>
    <button type="button" id="da-type"><b>Type it in</b><span>Enter the ingredients and amounts yourself</span></button>
  </div>`);
  $("da-photo").onclick = () => { closeSheet(); $("scan-file").click(); };
  $("da-type").onclick = () => { closeSheet(); openEditor(null); };
}
