// ---------- home page ----------
// What people see when they arrive without a link to something specific (and when they tap the logo):
// a welcome (an intro and what the site does for new visitors; quick actions when signed in),
// a drink of the day, the top-rated drinks and the newest ones.
function openHome() {
  S.view = "home"; S.editing = null; S.confirmDelete = false; S.confirmPhoto = false;
  setHash(null); renderList(); renderMain();
}

// Same pick all day for everyone: one of the best-rated drinks, preferring ones with photos.
function drinkOfTheDay() {
  const pool = S.drinks.filter(d => d.photo).length >= 3 ? S.drinks.filter(d => d.photo) : S.drinks.slice();
  if (!pool.length) return null;
  const best = pool.sort((a, b) => (score(b) - score(a)) || byName(a, b)).slice(0, 10);
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  return best[day % best.length];
}
function topRated(n) {
  const rated = S.drinks.filter(d => ratingOf(d).count > 0).sort((a, b) => (score(b) - score(a)) || byName(a, b));
  return rated.slice(0, n);
}
function newest(n) {
  return S.drinks.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) || byName(a, b)).slice(0, n);
}

const HOME_FEATURES = [
  ["Batch any recipe", "Scale a drink from one glass to a pitcher, or fill a bottle, with dilution worked out.", ""],
  ["Your bar, your drinks", "Save what's on your shelf and see what you can make right now.", "signin"],
  ["An AI bartender", "Scan a recipe photo, get ideas from what you have, or turn any drink into a mocktail.", "signin"],
  ["Plan a party", "Pick the drinks and guest count for batches, a shopping list and a printed menu.", "party"],
  ["Bottle guide", "Ratings, photos and notes on every bottle, and the recipes that use it.", "guide"]
];

VIEWS.home = function renderHome() {
  const m = $("main");
  if (!S.loaded) { m.innerHTML = `<div class="blank"><div class="glass">Opening the bar…</div></div>`; return; }
  const signedIn = !!uid(), accounts = S.backend === "supabase";
  const me = signedIn ? myProfile() : null;
  const carts = new Set(S.drinks.map(d => d.owner).filter(Boolean)).size;
  const feat = drinkOfTheDay();
  const top = topRated(6), fresh = newest(6);
  const statBits = [`${S.drinks.length} drink${S.drinks.length === 1 ? "" : "s"}`, accounts && carts ? `${carts} cart${carts === 1 ? "" : "s"}` : "", S.bottles && S.bottles.length ? `${S.bottles.length} bottles in the guide` : ""].filter(Boolean);
  const ingList = d => (d.ingredients || []).filter(i => !i.float).map(i => i.name).filter(Boolean).slice(0, 5).join(" · ");

  m.innerHTML = `
    <div class="home">
      ${signedIn ? `
      <section class="home-hero">
        <span class="label">Welcome back</span>
        <h2 class="home-title">${esc(me && me.display_name ? me.display_name : "Your cart")}</h2>
        <div class="panel-actions home-ctas">
          <button class="btn primary" type="button" data-home="cart">My cart</button>
          <button class="btn" type="button" data-home="canmake">What can I make?</button>
          <button class="btn" type="button" data-home="make">Make me a drink</button>
          <button class="btn" type="button" data-home="new">+ New drink</button>
        </div>
      </section>` : `
      <section class="home-hero">
        <h2 class="home-title">Great cocktails, for one glass or the whole party.</h2>
        <p class="home-lede">Browse house recipes from people who love making drinks, scale any of them to the size you need${accounts ? ", and save your own in a free cart" : ""}.</p>
        <form class="home-search" id="home-search" role="search">
          <input type="search" id="home-q" placeholder="Search drinks, ingredients, brands" aria-label="Search drinks">
          <button class="btn primary" type="submit">Search</button>
        </form>
        <div class="panel-actions home-ctas">
          ${accounts ? `<button class="btn primary" type="button" data-home="signin">Sign in or join free</button>` : ""}
          <button class="btn" type="button" data-home="browse">Browse all drinks</button>
        </div>
        ${statBits.length ? `<p class="hint home-stats">${statBits.join(" · ")}</p>` : ""}
      </section>`}

      ${feat ? `
      <section class="home-sec">
        <div class="sec-head"><h3>Drink of the day</h3></div>
        <button type="button" class="home-feat" data-open="${esc(feat.id)}">
          ${feat.photo ? `<img src="${esc(photoUrl(feat.photo))}" alt="" loading="lazy">` : `<span class="home-feat-ph" aria-hidden="true">${esc((feat.name || "?").charAt(0).toUpperCase())}</span>`}
          <span class="home-feat-txt">
            <span class="home-feat-name">${esc(feat.name)}</span>
            <span class="hint">${esc([typeOf(feat), accounts ? lockerName(feat.owner) : "", ratingOf(feat).count ? `★ ${avgOf(feat).toFixed(1)} (${ratingOf(feat).count})` : ""].filter(Boolean).join(" · "))}</span>
            ${ingList(feat) ? `<span class="home-feat-ing">${esc(ingList(feat))}</span>` : ""}
            <span class="home-feat-go">See the recipe →</span>
          </span>
        </button>
      </section>` : ""}

      ${top.length ? `<section class="home-sec"><div class="sec-head"><h3>Top rated</h3><button type="button" class="linkish" data-home="toplist">See all</button></div>
        <ul class="plist">${top.map(d => drinkRow(d, accounts)).join("")}</ul></section>` : ""}

      ${fresh.length ? `<section class="home-sec"><div class="sec-head"><h3>Newest</h3><button type="button" class="linkish" data-home="newlist">See all</button></div>
        <ul class="plist">${fresh.map(d => drinkRow(d, accounts)).join("")}</ul></section>` : ""}

      ${signedIn ? "" : `
      <section class="home-sec">
        <div class="sec-head"><h3>What you can do here</h3></div>
        <ul class="home-features">${HOME_FEATURES.filter(f => accounts || f[2] !== "signin").map(([t, d, act]) => `<li>
          <b>${t}</b><span>${d}</span>
          ${act === "party" ? `<button type="button" class="linkish" data-home="party">Plan a party →</button>`
            : act === "guide" ? `<button type="button" class="linkish" data-home="guide">Open the guide →</button>`
            : act === "signin" ? `<button type="button" class="linkish" data-home="signin">Sign in to start →</button>` : ""}
        </li>`).join("")}</ul>
      </section>`}

      ${!S.drinks.length ? `<p class="hint">No drinks yet.${S.canWrite ? " Add the first one with + New drink." : ""}</p>` : ""}
    </div>`;

  m.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { selectDrink(b.dataset.open); $("main").scrollIntoView({ behavior: "smooth", block: "start" }); });
  const go = {
    cart: () => openProfile(),
    canmake: () => openCanMake(),
    make: () => openMake(),
    new: () => openEditor(null),
    signin: () => { $("auth-btn").click(); window.scrollTo({ top: 0, behavior: "smooth" }); },
    party: () => openParty(),
    guide: () => openGuide(),
    browse: () => showList("rated"),
    toplist: () => showList("rated"),
    newlist: () => showList("new")
  };
  m.querySelectorAll("[data-home]").forEach(b => b.onclick = () => go[b.dataset.home] && go[b.dataset.home]());
  const form = $("home-search");
  if (form) form.onsubmit = e => {
    e.preventDefault();
    const q = $("home-q").value.trim(); if (!q) return;
    $("search").value = q; $("search").dispatchEvent(new Event("input", { bubbles: true }));
    showList(null);
  };
};

// Open the full drink list, optionally re-sorted, and bring it into view.
function showList(sort) {
  if (sort && S.sort !== sort) { S.sort = sort; $("sort").value = sort; try { localStorage.setItem("mc-sort", sort); } catch (e) {} renderList(); }
  const first = filtered()[0] || sorted()[0];
  if (first) { S.selected = first.id; S.view = "detail"; setHash(first.id); renderFilters(); renderList(); renderMain(); }
  const list = $("list"); if (list) { list.scrollTop = 0; list.scrollIntoView({ behavior: "smooth", block: "start" }); }
}
