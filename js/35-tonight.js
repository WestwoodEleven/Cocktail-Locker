// ---------- Home for members: tonight's pick and the setup steps ----------

// "Tonight, from your bottles": one drink you can make right now that you haven't logged in the last two weeks.
// The same pick all day (Another idea moves on to the next one). Favorites and drinks not in your log yet come
// first, and drinks that need a mixer you'd have to buy only when nothing else fits.
// Visitors, and members with nothing to make yet, see the drink of the day instead.
const homeDay = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
const strHash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const isoDaysAgo = n => { const t = new Date(Date.now() - n * 86400000); return new Date(t - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
S.tonight = (() => { try { return JSON.parse(localStorage.getItem("mc-tonight") || "null"); } catch (e) { return null; } })();
const tonightSkips = () => S.tonight && S.tonight.day === homeDay() ? Number(S.tonight.n) || 0 : 0;
function skipTonight() {
  S.tonight = { day: homeDay(), n: tonightSkips() + 1 };
  try { localStorage.setItem("mc-tonight", JSON.stringify(S.tonight)); } catch (e) {}
}
function tonightPool() {
  if (!uid() || S.backend !== "supabase" || !S.barLoaded || !S.userLoaded) return [];
  if (!inStock(savedItems()).length) return [];
  const r = canMakeResults(), today = todayIso(), since = isoDaysAgo(14);
  const recent = new Set(S.log.filter(e => e.made_on >= since && e.made_on < today).map(e => e.drink_id));
  let pool = r.ready.filter(d => !recent.has(d.id));
  if (!pool.length) pool = r.ready.slice();
  const nothingToBuy = pool.filter(d => !pickupsFor(d, r.keys).length);
  if (nothingToBuy.length) pool = nothingToBuy;
  const rank = d => (isFav(d) ? 2 : 0) + (logFor(d).length ? 0 : 1);
  return pool.sort((a, b) => rank(b) - rank(a) || (score(b) - score(a)) || byName(a, b)).slice(0, 12)
    .map(d => ({ d, pick: pickupsFor(d, r.keys) }));
}
function tonightPick() {
  const pool = tonightPool(); if (!pool.length) return null;
  return Object.assign({ of: pool.length }, pool[(homeDay() + strHash(uid()) + tonightSkips()) % pool.length]);
}
// h: { today, sub, amt } from the Home page, so the card reads like the drink of the day.
function tonightHtml(t, h) {
  const d = t.d, list = logFor(d), today = todayIso(), madeToday = list.some(e => e.made_on === today);
  const last = list.find(e => e.made_on < today);
  const why = [isFav(d) ? "♥ A favorite" : "", madeToday ? "" : last ? `Last made ${esc(logDate(last.made_on))}` : "Not in your log yet",
    t.pick.length ? `<span class="pick">Pick up ${esc(t.pick.map(i => i.name).join(" and "))}</span>` : ""].filter(Boolean).join(" · ");
  return `<div class="home-day tonight" id="tonight">
    <span class="home-day-head"><span>Tonight, from your bottles</span><span>${esc(h.today)}</span></span>
    ${d.photo ? `<img src="${esc(photoUrl(d.photo))}" alt="" loading="lazy">` : drinkPicture(d)}
    <span class="home-day-body">
      <span><span class="home-feat-name">${esc(d.name)}</span><br><span class="hint">${esc(h.sub(d))}${ratingOf(d).count ? ` · ★ ${avgOf(d).toFixed(1)}` : ""}</span></span>
      ${why ? `<span class="tn-why">${why}</span>` : ""}
      <span class="home-day-ings">${(d.ingredients || []).filter(i => !i.float && i.name).slice(0, 5).map(i => `<span><b>${qHtml(h.amt(i))}</b> ${esc(i.name)}</span>`).join("")}</span>
      <span class="tn-actions">
        ${madeToday ? `<span class="tn-made">✓ Made it today</span>` : `<button class="btn primary small" type="button" id="tn-made" aria-haspopup="dialog">✓ I made this</button>`}
        <button type="button" class="linkish home-feat-go" id="tn-open">See the spec ›</button>
        ${t.of > 1 ? `<button type="button" class="linkish tn-next" id="tn-next">Another idea</button>` : ""}
      </span>
    </span>
  </div>`;
}
function wireTonight(t) {
  const card = $("tonight"); if (!card || !t) return;
  const open = () => { selectDrink(t.d.id); window.scrollTo({ top: 0, behavior: "smooth" }); };
  card.onclick = e => { if (!e.target.closest("button, a")) open(); };
  $("tn-open").onclick = open;
  if ($("tn-made")) $("tn-made").onclick = () => openMadeSheet(t.d);
  if ($("tn-next")) $("tn-next").onclick = () => { skipTonight(); renderMain(); };
}

// ---------- first-week setup steps ----------
// Three steps on Home until they're done (or hidden): add your bottles, see what you can make, save or log a drink.
// Members who already have bottles and drinks never see them.
const setupKey = () => "mc-setup-" + uid();
function setupState() {
  if (S.setupState && S.setupState.uid === uid()) return S.setupState.v;
  try { return localStorage.getItem(setupKey()) || ""; } catch (e) { return ""; }
}
function setSetupState(v) {
  S.setupState = { uid: uid(), v };
  try { localStorage.setItem(setupKey(), v); } catch (e) {}
}
function setupSteps() {
  const bottles = savedItems().length > 0;
  const first = S.drinks.some(d => isMine(d)) || S.favs.size > 0 || S.log.length > 0;
  let looked = !!S.didCanMake; try { looked = looked || localStorage.getItem("mc-did-canmake") === "1"; } catch (e) {}
  return [
    { key: "bottles", done: bottles, title: "Add your bottles", hint: "Type them in, or photograph your shelf" },
    { key: "canmake", done: looked || (bottles && first), title: "See what you can make", hint: "Every drink your bottles can pour" },
    { key: "first", done: first, title: "Save or log your first drink", hint: "Tap ♡ on one you like, or ✓ I made this after you make it" }
  ];
}
function setupHtml() {
  if (!uid() || S.backend !== "supabase" || !S.barLoaded || !S.userLoaded || setupState()) return "";
  const steps = setupSteps(), n = steps.filter(x => x.done).length;
  if (n === steps.length) { setSetupState("done"); return ""; }
  return `<section class="setup-card" id="setup-card" aria-label="Get your cart set up">
    <div class="setup-head"><span>Get your cart set up</span><span class="setup-right"><span>${n} of ${steps.length}</span>
      <button type="button" class="setup-x" id="setup-hide" aria-label="Hide these steps">×</button></span></div>
    <ol class="setup-steps">${steps.map((x, k) => `<li class="${x.done ? "done" : ""}">
      <button type="button" data-setup="${x.key}"><span class="setup-n" aria-hidden="true">${x.done ? "✓" : k + 1}</span>
        <span class="txt"><b>${esc(x.title)}</b><span class="hint">${x.done ? "Done" : esc(x.hint)}</span></span>
        <span class="chev" aria-hidden="true">›</span></button></li>`).join("")}</ol>
  </section>`;
}
function wireSetup() {
  const card = $("setup-card"); if (!card) return;
  $("setup-hide").onclick = () => { setSetupState("hidden"); renderMain(); };
  const go = {
    bottles: () => openBottleAdd(),
    canmake: () => openCanMake(),
    first: () => { const t = tonightPick(); if (t) selectDrink(t.d.id); else showList("rated"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };
  card.querySelectorAll("[data-setup]").forEach(b => b.onclick = () => go[b.dataset.setup]());
}
