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
function openProfile() {
  if (!uid()) { toast("Sign in to see your cart."); return; }
  S.view = "profile"; S.confirmDelete = false; setHash("my-locker");
  $("name-form").hidden = true;
  renderList(); renderProfile();
  $("main").scrollIntoView({ behavior: "smooth", block: "start" });
}
function drinkRow(d, showFrom) {
  const r = ratingOf(d);
  const sub = [typeOf(d), showFrom && !isMine(d) ? (d.standard ? "Classic" : lockerName(d.owner)) : "", r.count ? `★ ${avgOf(d).toFixed(1)}` : ""].filter(Boolean).join(" · ");
  return `<li><button type="button" class="prow" data-open="${esc(d.id)}">
    ${drinkThumb(d)}
    <span class="txt"><span class="nm">${esc(d.name)}</span><span class="sub">${esc(sub)}</span></span>
    ${isFav(d) ? `<span class="fav-mark" aria-label="Favorite">♥</span>` : ""}</button></li>`;
}
function renderProfile() {
  const m = $("main");
  const me = myProfile();
  const mine = sorted().filter(d => isMine(d));
  const favs = allSorted().filter(d => isFav(d));
  const barCount = inStock(savedItems()).length;
  const email = S.session && S.session.user && S.session.user.email;
  m.innerHTML = `
    <div class="make">
      <div class="editor-top">
        <div><h2 class="make-title">My Cocktail Cart</h2>
          <div class="cart-name"><b>${esc(me && me.display_name ? me.display_name : "Unnamed cart")}</b> · <button class="linkish" type="button" id="prof-rename">Rename</button></div>
          ${email ? `<div class="hint">Signed in as ${esc(email)}</div>` : ""}</div>
      </div>
      <div class="stats">
        <a href="#prof-drinks" class="stat"><b>${mine.length}</b><span>My drinks</span></a>
        <a href="#prof-favs" class="stat"><b>${favs.length}</b><span>Favorites</span></a>
        <a href="#prof-bar" class="stat"><b>${barCount}</b><span>Bottles &amp; supplies</span></a>
      </div>

      <section class="make-sec" id="prof-drinks">
        <div class="sec-head"><h3>My drinks</h3>
          <div class="panel-actions"><button class="btn primary small" type="button" id="prof-drink-add" aria-haspopup="dialog">+ Add</button></div></div>
        ${mine.length ? `<ul class="plist">${mine.map(d => drinkRow(d, false)).join("")}</ul>`
          : `<p class="hint" style="margin:0">Your cart has no drinks yet. Add one, scan a recipe, or copy someone else's drink.</p>`}
      </section>

      <section class="make-sec" id="prof-favs">
        <div class="sec-head"><h3>Favorites</h3><span class="hint">Only you can see these.</span></div>
        ${S.favsOff ? `<p class="hint" style="margin:0">Favorites aren't switched on yet. The site owner needs to run favorites-setup.sql in Supabase.</p>`
          : favs.length ? `<ul class="plist">${favs.map(d => drinkRow(d, true)).join("")}</ul>`
          : `<p class="hint" style="margin:0">No favorites yet. Tap ♡ Favorite on any drink, yours or someone else's, to keep it here.</p>`}
      </section>

      ${typeof logSectionHtml === "function" ? logSectionHtml() : ""}

      ${profileSocialHtml()}

      <section class="make-sec" id="prof-bar">
        <div class="sec-head"><h3>My bottles</h3>
          <div class="panel-actions"><button class="btn primary small" type="button" id="prof-bottle-add" aria-haspopup="dialog">+ Add</button></div></div>
        <button type="button" class="linkish canmake-link" id="prof-canmake">What can I make with these? ›</button>
        <button type="button" class="linkish canmake-link" id="prof-shop">Shopping list <span class="count-pill" data-shop-count ${typeof shopOpen === "function" && shopOpen().length ? "" : "hidden"}>${typeof shopOpen === "function" ? shopOpen().length : ""}</span> ›</button>
        <p class="hint" style="margin:0">Tap a bottle to add its brand. Tap ○ to mark it out of stock, and ↺ when you restock. <span id="bar-saved">${S.barOff ? "Your bottles can't be saved yet. Ask the site owner to run bartender-setup.sql." : "Changes save automatically."}</span></p>
        ${outSummary()}
        ${GROUPS.filter(g => g.saved).map(barGroupHtml).join("")}
      </section>

      ${adminHtml()}
      ${accountHtml()}
    </div>`;
  wireBarChips(GROUPS.filter(g => g.saved));
  $("prof-bottle-add").onclick = () => openBottleAdd();
  $("prof-canmake").onclick = () => openCanMake();
  if ($("prof-shop")) $("prof-shop").onclick = () => openShop();
  m.querySelectorAll("[data-open]").forEach(b => b.onclick = () => {
    S.selected = b.dataset.open; S.view = "detail"; setHash(S.selected);
    const d = current(); if (d && !passesFilters(d)) { S.f = { owner: "", type: "", base: "", method: "", kind: "", rating: "" }; S.query = ""; $("search").value = ""; renderFilters(); }
    renderList(); renderMain(); $("main").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  m.querySelectorAll(".stat").forEach(a => a.onclick = e => { e.preventDefault(); const t = $(a.getAttribute("href").slice(1)); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); });
  wireProfileSocial(m);
  $("prof-rename").onclick = () => openNameForm(false);
  $("prof-drink-add").onclick = openDrinkAdd;
  if (typeof wireLogSection === "function") wireLogSection();
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
