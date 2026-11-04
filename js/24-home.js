// ---------- home page ----------
// Home is also the drink list: a welcome (big for new visitors, one line when signed in) and the drink of the day,
// then every drink with quick filter chips (the index under the main column), then Plan & explore.
// Searching filters the list in place and hides the welcome so results come first.
function openHome() {
  S.view = "home"; S.editing = null; S.confirmDelete = false; S.confirmPhoto = false;
  S.f = { owner: "", type: "", base: "", method: "", kind: "", rating: "" }; S.query = ""; $("search").value = ""; S.browseAll = false; S.secShow = {}; renderFilters();
  setHash(null); renderList(); renderMain(); window.scrollTo({ top: S._routing ? (S._homeY || 0) : 0 });
}

// Same pick all day for everyone: one of the best-rated drinks, preferring ones with photos.
function drinkOfTheDay() {
  const pool = S.drinks.filter(d => d.photo).length >= 3 ? S.drinks.filter(d => d.photo) : S.drinks.slice();
  if (!pool.length) return null;
  const best = pool.sort((a, b) => (score(b) - score(a)) || byName(a, b)).slice(0, 10);
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  return best[day % best.length];
}
VIEWS.home = function renderHome() {
  const m = $("main");
  if (!S.loaded) { m.innerHTML = `<div class="blank"><div class="glass">Opening the bar…</div></div>`; return; }
  const signedIn = !!uid(), accounts = S.backend === "supabase";
  const me = signedIn ? myProfile() : null;
  const feat = drinkOfTheDay();
  const today = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const sub = d => [typeOf(d), accounts ? (isMine(d) && signedIn ? "Your cart" : lockerName(d.owner)) : baseOf(d)].filter(Boolean).join(" · ");
  const amt = i => { const s = show(i, 1, "spec"); return (s.q + (s.u ? " " + s.u : "")).trim(); };

  m.innerHTML = `
    <div class="home">
      <div class="home-top${signedIn ? " signed" : ""}">
        <section class="home-hero">
          ${signedIn ? `
            <p class="home-hello">Welcome back, <b>${esc(me && me.display_name ? me.display_name : "your cart")}</b></p>` : `
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
            <span class="home-day-ings">${(feat.ingredients || []).filter(i => !i.float && i.name).slice(0, 5).map(i => `<span><b>${qHtml(amt(i))}</b> ${esc(i.name)}</span>`).join("")}</span>
            <span class="home-feat-go">See the spec →</span>
          </span>
        </button>` : ""}
      </div>

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

      ${!S.drinks.length ? `<p class="hint">No drinks yet.${S.canWrite ? " Add the first one with + New drink." : ""}</p>` : ""}
    </div>`;

  const after = $("home-after");
  after.innerHTML = `<section class="home-sec plan-links" aria-label="Plan and explore">
      <div class="sec-head"><h3>Plan &amp; explore</h3></div>
      <div class="plan-row">
        ${signedIn ? `<button type="button" data-home="canmake"><b>What can I make?</b><span>From your bottles</span></button>` : ""}
        <button type="button" data-home="menu"><b>Menu decoder</b><span>Snap a bar's menu, make it at home</span></button>
        <button type="button" data-home="guide"><b>Bottle guide</b><span>Ratings, photos and notes</span></button>
        <button type="button" data-home="party"><b>Plan a party</b><span>Batches, shopping list, menu</span></button>
      </div>
    </section>`;
  m.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { selectDrink(b.dataset.open); window.scrollTo({ top: 0, behavior: "smooth" }); });
  const go = {
    cart: () => openProfile(),
    canmake: () => openCanMake(),
    guide: () => openGuide(),
    menu: () => openMenuDecoder(),
    party: () => openParty(),
    make: () => openMake(),
    ask: () => openAsk(),
    new: () => openEditor(null),
    scan: () => $("scan-file").click(),
    stock: () => openStock(),
    signin: () => { $("auth-btn").click(); window.scrollTo({ top: 0, behavior: "smooth" }); },
    browse: () => showList("rated"),
    toplist: () => showList("rated"),
    newlist: () => showList("new")
  };
  [m, after].forEach(el => el.querySelectorAll("[data-home]").forEach(b => b.onclick = () => go[b.dataset.home] && go[b.dataset.home]()));
  m.querySelectorAll("[data-f]").forEach(b => b.onclick = () => {
    S.f = { owner: "", type: "", base: "", method: "", kind: "", rating: "" };
    S.f[b.dataset.f] = b.dataset.v;
    S.query = ""; $("search").value = "";
    renderFilters(); showList(null);
  });
};

// Show the drink list on Home, keeping the search and filters, optionally re-sorted.
// keepFocus: called while typing in the search box, so don't move the page.
function showList(sort, keepFocus) {
  if (sort && S.sort !== sort) { S.sort = sort; $("sort").value = sort; try { localStorage.setItem("mc-sort", sort); } catch (e) {} }
  S.view = "home"; S.editing = null; S.confirmDelete = false; setHash(null);
  renderFilters(); renderList(); renderMain();
  if (keepFocus) return;
  const t = $("drinks-title"); if (t) t.scrollIntoView({ block: "start" });
}
