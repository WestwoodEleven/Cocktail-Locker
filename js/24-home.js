// ---------- home page ----------
// What people see when they arrive without a link to something specific (and when they tap the logo or Drinks):
// a big welcome with the drink of the day, quick ways to browse by style and spirit, the best-rated drinks
// as picture tiles, the newest as a menu, and (for new visitors) what an account adds.
function openHome() {
  S.view = "home"; S.editing = null; S.confirmDelete = false; S.confirmPhoto = false;
  S.f = { owner: "", type: "", base: "", method: "", kind: "", rating: "" }; S.query = ""; $("search").value = ""; renderFilters();
  setHash(null); renderList(); renderMain(); window.scrollTo({ top: 0 });
}

// Same pick all day for everyone: one of the best-rated drinks, preferring ones with photos.
function drinkOfTheDay() {
  const pool = S.drinks.filter(d => d.photo).length >= 3 ? S.drinks.filter(d => d.photo) : S.drinks.slice();
  if (!pool.length) return null;
  const best = pool.sort((a, b) => (score(b) - score(a)) || byName(a, b)).slice(0, 10);
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  return best[day % best.length];
}
// Best first by weighted rating (unrated drinks fill in after rated ones).
function topRated(n) {
  return S.drinks.slice().sort((a, b) => (score(b) - score(a)) || (ratingOf(b).count - ratingOf(a).count) || byName(a, b)).slice(0, n);
}
function newest(n) {
  return S.drinks.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) || byName(a, b)).slice(0, n);
}

// Browse shortcuts: [label, filter key, value]
const HOME_STYLES = [["Sours", "type", "Sour"], ["Spirit-forward", "type", "Spirit-forward"], ["Tiki", "type", "Tiki"], ["Highballs", "type", "Highball"], ["Fizzes", "type", "Fizz & Collins"], ["Spritzes", "type", "Spritz & bubbly"], ["Mocktails", "base", "No alcohol"]];
const HOME_BASES = ["Gin", "Rum", "Tequila", "Mezcal", "Whiskey", "Vodka", "Brandy"];

VIEWS.home = function renderHome() {
  const m = $("main");
  if (!S.loaded) { m.innerHTML = `<div class="blank"><div class="glass">Opening the bar…</div></div>`; return; }
  const signedIn = !!uid(), accounts = S.backend === "supabase";
  const me = signedIn ? myProfile() : null;
  const feat = drinkOfTheDay();
  const top = topRated(8), fresh = newest(6);
  const has = (k, v) => S.drinks.some(d => (k === "type" ? typeOf(d) : baseOf(d)) === v);
  const styles = HOME_STYLES.filter(([, k, v]) => has(k, v));
  const bases = HOME_BASES.filter(b => has("base", b));
  const today = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const sub = d => [typeOf(d), accounts ? (isMine(d) && signedIn ? "Your cart" : lockerName(d.owner)) : baseOf(d)].filter(Boolean).join(" · ");
  const amt = i => { const s = show(i, 1, "spec"); return (s.q + (s.u ? " " + s.u : "")).trim(); };

  m.innerHTML = `
    <div class="home">
      <div class="home-top${signedIn ? " signed" : ""}">
        <section class="home-hero">
          ${signedIn ? `
            <p class="home-hello">Welcome back, <b>${esc(me && me.display_name ? me.display_name : "your cart")}</b></p>
            <div class="home-tiles">
              <button class="home-tile" type="button" data-home="canmake">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2 H15 V6 Q18 8 18 12 V22 H6 V12 Q6 8 9 6 Z M6 14 H18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 18 L11.5 20 L15 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span><b>What can I make?</b><span>From your bottles</span></span>
              </button>
              <button class="home-tile" type="button" data-home="make">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5 H21 L12 14 Z M12 14 V21 M7.5 21 H16.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><path d="M18 1.5 L18.8 3.2 L20.5 4 L18.8 4.8 L18 6.5 L17.2 4.8 L15.5 4 L17.2 3.2 Z" fill="currentColor"/></svg>
                <span><b>Make me a drink</b><span>AI ideas from what you have</span></span>
              </button>
            </div>
            <button class="btn home-add" type="button" data-home="add" aria-haspopup="dialog">+ Add</button>` : `
            <h2 class="home-title">House specs,<br>scaled to<br><em>the crowd.</em></h2>
            <div style="display:flex;flex-direction:column;gap:18px">
              <p class="home-lede">Real recipes from people who make drinks at home. Batch any of them from one glass to a punch bowl${accounts ? ", and keep your own in a free cart" : ""}.</p>
              <div class="panel-actions home-ctas">
                <button class="btn" type="button" data-home="browse">Browse all drinks</button>
                ${accounts ? `<button class="btn primary" type="button" data-home="signin">Sign in or join free</button>` : ""}
              </div>
            </div>`}
        </section>
        ${feat ? `
        <button type="button" class="home-day" data-open="${esc(feat.id)}">
          <span class="home-day-head"><span>Drink of the day</span><span>${esc(today)}</span></span>
          ${feat.photo ? `<img src="${esc(photoUrl(feat.photo))}" alt="" loading="lazy">` : drinkPicture(feat)}
          <span class="home-day-body">
            <span><span class="home-feat-name">${esc(feat.name)}</span><br><span class="hint">${esc(sub(feat))}${ratingOf(feat).count ? ` · ★ ${avgOf(feat).toFixed(1)}` : ""}</span></span>
            <span class="home-day-ings">${(feat.ingredients || []).filter(i => !i.float && i.name).slice(0, 5).map(i => `<span><b>${esc(amt(i))}</b> ${esc(i.name)}</span>`).join("")}</span>
            <span class="home-feat-go">See the spec →</span>
          </span>
        </button>` : ""}
      </div>

      ${styles.length || bases.length ? `<nav class="home-browse" aria-label="Browse">
        ${styles.length ? `<span class="label">Style</span><div class="pills">${styles.map(([t, k, v]) => `<button type="button" data-f="${k}" data-v="${esc(v)}">${esc(t)}</button>`).join("")}</div>` : ""}
        ${bases.length ? `<span class="label">Base</span><div class="pills">${bases.map(b => `<button type="button" data-f="base" data-v="${esc(b)}">${esc(b)}</button>`).join("")}</div>` : ""}
      </nav>` : ""}

      ${top.length ? `<section class="home-sec">
        <div class="sec-head"><h3>Top rated</h3><button type="button" class="linkish" data-home="toplist">All drinks →</button></div>
        <ul class="tiles">${top.map(d => `<li><button type="button" class="tile" data-open="${esc(d.id)}">
          <span class="tile-img">${d.photo ? `<img src="${esc(photoUrl(d.photo))}" alt="" loading="lazy">` : drinkPicture(d)}${ratingOf(d).count ? `<span class="tile-rate">★ ${avgOf(d).toFixed(1)}</span>` : ""}</span>
          <span class="tile-name">${esc(d.name)}</span>
          <span class="tile-sub">${esc(sub(d))}</span>
        </button></li>`).join("")}</ul>
      </section>` : ""}

      <div class="home-split">
        ${fresh.length ? `<section class="home-sec">
          <div class="sec-head"><h3>Just added</h3><button type="button" class="linkish" data-home="newlist">Newest first →</button></div>
          <ul class="menu-list">${fresh.map(d => `<li><button type="button" data-open="${esc(d.id)}"><span class="mn">${esc(d.name)}</span><span class="lead" aria-hidden="true"></span><span class="ms">${esc([baseOf(d), accounts ? (isMine(d) && signedIn ? "Your cart" : lockerName(d.owner)) : ""].filter(Boolean).join(" · "))}</span></button></li>`).join("")}</ul>
        </section>` : ""}
        ${signedIn || !accounts ? "" : `<aside class="home-promo" aria-label="What you can do with a free cart">
          <h3>Your bottles,<br>working for you</h3>
          <ul>
            <li><b>What can I make?</b> Save your bottles and see every drink you can pour right now.</li>
            <li><b>Snap a recipe.</b> Photograph a recipe card, or your shelf, and we fill it in.</li>
            <li><b>Make it a mocktail.</b> A zero-proof version of any drink.</li>
            <li><b>Plan a party.</b> Batches, a shopping list and a printed menu.</li>
          </ul>
          <button class="btn primary" type="button" data-home="signin">Start your cart, free</button>
        </aside>`}
      </div>

      ${!S.drinks.length ? `<p class="hint">No drinks yet.${S.canWrite ? " Add the first one with + New drink." : ""}</p>` : ""}
    </div>`;

  m.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { selectDrink(b.dataset.open); window.scrollTo({ top: 0, behavior: "smooth" }); });
  const go = {
    cart: () => openProfile(),
    add: () => openAddMenu(),
    canmake: () => openCanMake(),
    make: () => openMake(),
    new: () => openEditor(null),
    scan: () => $("scan-file").click(),
    stock: () => openStock(),
    signin: () => { $("auth-btn").click(); window.scrollTo({ top: 0, behavior: "smooth" }); },
    browse: () => showList("rated"),
    toplist: () => showList("rated"),
    newlist: () => showList("new")
  };
  m.querySelectorAll("[data-home]").forEach(b => b.onclick = () => go[b.dataset.home] && go[b.dataset.home]());
  m.querySelectorAll("[data-f]").forEach(b => b.onclick = () => {
    S.f = { owner: "", type: "", base: "", method: "", kind: "", rating: "" };
    S.f[b.dataset.f] = b.dataset.v;
    S.query = ""; $("search").value = "";
    renderFilters(); showList(null);
  });
};

// Open the full drink list (the first drink that matches), optionally re-sorted.
// keepFocus: called while typing in the search box, so don't move the page.
function showList(sort, keepFocus) {
  if (sort && S.sort !== sort) { S.sort = sort; $("sort").value = sort; try { localStorage.setItem("mc-sort", sort); } catch (e) {} }
  const first = filtered()[0] || sorted()[0];
  S.view = "detail"; S.selected = first ? first.id : null; setHash(first ? first.id : null);
  renderFilters(); renderList(); renderMain();
  if (keepFocus) return;
  const narrow = window.matchMedia && window.matchMedia("(max-width: 780px)").matches;
  const target = narrow ? $("list") : $("main");
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

// One "+ Add" menu for the three ways to add something.
function openAddMenu() {
  sheet("Add", `<div class="add-menu">
    <button type="button" data-add-how="new"><b>Type a recipe</b><span>Add a drink with its spec</span></button>
    <button type="button" data-add-how="scan"><b>Scan a recipe photo</b><span>A card, a book page or a screenshot</span></button>
    <button type="button" data-add-how="stock"><b>Photograph my bottles</b><span>We add every bottle we can see</span></button>
  </div>`);
  document.querySelectorAll("[data-add-how]").forEach(b => b.onclick = () => {
    const how = b.dataset.addHow; closeSheet();
    if (how === "new") openEditor(null);
    else if (how === "scan") $("scan-file").click();
    else openStock();
  });
}
