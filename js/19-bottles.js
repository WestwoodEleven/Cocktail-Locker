// My Cocktail Cart: bottle guide. Scripts share one global scope and load in numbered order.
// A shared page per bottle: details and a description (written once by the AI), people's photos, ratings and comments,
// recipes that call for it, and a button to add it to your bottles.

S.bottles = []; S.bottlePhotos = {}; S.bottleReviews = {}; S.isAdmin = false;
const BOTTLE_GROUP = { bitters: "bitters", syrup: "syrups", mixer: "fresh" };
const CATEGORY_LABEL = { whiskey: "Whiskey", gin: "Gin", vodka: "Vodka", rum: "Rum", tequila: "Tequila", mezcal: "Mezcal", brandy: "Brandy", liqueur: "Liqueur", amaro: "Amaro", vermouth: "Vermouth", wine: "Wine", bitters: "Bitters", syrup: "Syrup", mixer: "Mixer", other: "Other" };

async function loadBottles() {
  if (!sb) return;
  const [b, p, r] = await Promise.all([
    sb.from("bottles").select("slug, name, product, ingredient, category, producer, origin, abv, age, description, aliases, updated_at"),
    sb.from("bottle_photos").select("id, slug, path, user_id, created_at"),
    sb.from("bottle_reviews").select("slug, user_id, stars, comment, updated_at")
  ]);
  if (b.error) { S.bottlesOff = true; return; }
  S.bottlesOff = false;
  S.bottles = (b.data || []).map(x => Object.assign(x, { aliases: x.aliases || [] }));
  S.bottlePhotos = {}; (p.data || []).forEach(x => (S.bottlePhotos[x.slug] = S.bottlePhotos[x.slug] || []).push(x));
  S.bottleReviews = {}; (r.data || []).forEach(x => (S.bottleReviews[x.slug] = S.bottleReviews[x.slug] || []).push(x));
  if (uid()) { const a = await sb.from("site_admins").select("user_id").eq("user_id", uid()); S.isAdmin = !a.error && (a.data || []).length > 0; } else S.isAdmin = false;
  await loadReports();
}
// Strength label: "40% ABV", or "0.0% NA" for non-alcoholic bottles (syrups and mixers count as NA when no ABV is stored).
function abvText(b) {
  const v = b.abv == null || b.abv === "" ? null : Number(b.abv);
  if (v === 0 || (v == null && ["syrup", "mixer"].includes(b.category))) return "0.0% NA";
  return v > 0 ? `${+v.toFixed(1)}% ABV` : "";
}
const bottleFor = name => { const k = slugify(name); return k ? S.bottles.find(b => b.slug === k || b.aliases.includes(k)) : null; };
const bottleRating = slug => { const rs = S.bottleReviews[slug] || []; return { count: rs.length, avg: rs.length ? rs.reduce((s, r) => s + r.stars, 0) / rs.length : 0, mine: (rs.find(r => r.user_id === uid()) || {}) }; };
const bottlePhoto = slug => { const ps = (S.bottlePhotos[slug] || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))); return ps[0] || null; };
// Recipes that name this bottle as a recommended brand.
function drinksUsing(b) {
  const keys = new Set([b.slug, ...b.aliases]);
  return allSorted().filter(d => (d.ingredients || []).some(i => i.brand && keys.has(slugify(i.brand))));
}
function barHas(b) {
  const keys = new Set([b.slug, ...b.aliases]);
  return savedItems().some(x => typeof x !== "string" && x.brand && keys.has(slugify(x.brand)) && !x.out);
}

function openBottle(name) {
  const b = bottleFor(name);
  S.bottleQuery = String(name || "").trim();
  S.bottleSlug = b ? b.slug : slugify(name);
  S.view = "bottle"; S.confirmDelete = false; setHash("bottle-" + S.bottleSlug);
  renderList(); renderMain();
  $("main").scrollIntoView({ behavior: "smooth", block: "start" });
  if (!b && uid() && !S.bottlesOff) lookupBottle(S.bottleQuery);
}
async function lookupBottle(q) {
  const token = {}; S.bottleLookup = { q, token }; renderMain();
  const { data, code, detail, reply } = await invokeHelper({ mode: "bottle", query: q });
  if (!S.bottleLookup || S.bottleLookup.token !== token) return;
  S.bottleLookup = null;
  if (data && data.bottle) {
    const b = Object.assign({ aliases: [] }, data.bottle);
    S.bottles = S.bottles.filter(x => x.slug !== b.slug).concat(b);
    S.bottleSlug = b.slug; setHash("bottle-" + b.slug);
  } else {
    let msg = detail; try { const j = JSON.parse(detail); msg = (j.error && j.error.message) || detail; } catch (e) {}
    S.bottleError = code === "not_a_bottle" ? { notBottle: true, dym: (reply && reply.did_you_mean) || "" } : { msg: SCAN_ERR[code] || msg || "Couldn't look up this bottle. Try again." };
  }
  if (S.view === "bottle") renderMain();
}

VIEWS.bottle = function renderBottle() {
  const m = $("main");
  const b = S.bottles.find(x => x.slug === S.bottleSlug);
  const back = `<button class="btn small" type="button" id="bt-back">Back</button>`;
  if (!b) {
    const err = S.bottleError; S.bottleError = null;
    m.innerHTML = S.bottleLookup ? `<div class="scanning"><div class="glass dots">Looking up ${esc(S.bottleLookup.q)}</div><div class="hint">The first look-up takes a few seconds. After that it's instant for everyone.</div>${back}</div>`
      : `<div class="blank"><div class="glass">${esc(S.bottleQuery || "Bottle")}</div>
        ${S.bottlesOff ? `<div>The bottle guide isn't switched on yet. The site owner needs to run bottles-setup.sql.</div>`
        : err && err.notBottle ? `<div>That isn't a specific bottle we know.${err.dym ? "" : " Try the brand and product name, like Tanqueray London Dry."}</div>${err.dym ? `<button class="btn primary" type="button" data-bottle="${esc(err.dym)}">Look up ${esc(err.dym)}</button>` : ""}`
        : err ? `<div>${esc(err.msg)}</div><button class="btn primary" type="button" id="bt-retry">Try again</button>`
        : !uid() ? `<div>There's no page for this bottle yet. Sign in to create it.</div>` : ""}
        ${back}</div>`;
    $("bt-back").onclick = bottleBack;
    if ($("bt-retry")) $("bt-retry").onclick = () => lookupBottle(S.bottleQuery);
    return;
  }
  const photo = bottlePhoto(b.slug);
  const r = bottleRating(b.slug);
  const reviews = (S.bottleReviews[b.slug] || []).filter(x => x.comment && x.comment.trim()).sort((a, c) => String(c.updated_at).localeCompare(String(a.updated_at)));
  const uses = drinksUsing(b);
  const facts = [["Type", b.ingredient], ["Producer", b.producer], ["From", b.origin], ["Strength", abvText(b)], ["Age", b.age]].filter(f => f[1]);
  const inBar = barHas(b);
  const mine = r.mine.stars || 0;
  m.innerHTML = `
    <div class="make bottle-page">
      <div class="editor-top"><div><span class="label">Bottle guide${b.category ? " · " + esc(CATEGORY_LABEL[b.category] || b.category) : ""}</span><h2 class="make-title">${esc(b.name)}</h2>
        ${b.product && b.product !== b.name ? `<div class="hint">${esc(b.product)}</div>` : ""}
        ${r.count ? `<span class="avg"><span class="stars">${starText(r.avg)}</span> ${r.avg.toFixed(1)} · ${r.count} rating${r.count === 1 ? "" : "s"}</span>` : ""}</div>
        ${back}</div>
      <div class="bottle-top">
        <figure class="bottle-photo">${photo ? `<img src="${esc(photoUrl(photo.path))}" alt="${esc(b.name)} bottle">` : `<div class="bottle-ph" aria-hidden="true">${esc(b.name.charAt(0))}</div>`}
          ${uid() && !S.bottlesOff ? `<button class="btn small" type="button" id="bt-photo">${photo ? "Add another photo" : "Add a photo of your bottle"}</button>` : ""}
          ${photo && (photo.user_id === uid() || S.isAdmin) ? `<button type="button" class="linkish" id="bt-photo-rm">Remove this photo</button>` : photo ? reportBtn("bottle_photo", String(photo.id), photo.user_id, b.name + " photo", "Report this photo") : ""}</figure>
        <div class="bottle-info">
          ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
          ${b.description ? `<p class="bottle-desc">${esc(b.description)}</p>` : ""}
          <p class="hint" style="margin:0">Written by AI and may contain errors. ${uid() ? `<button type="button" class="linkish" id="bt-fix">Suggest a fix</button>` : ""}${S.isAdmin ? ` · <button type="button" class="linkish" id="bt-edit">Edit details</button>` : ""}</p>
          <div class="panel-actions" style="justify-content:flex-start">${uid() ? (inBar ? `<span class="chip">In your bottles ✓</span>` : `<button class="btn primary small" type="button" id="bt-addbar">Add to my bottles</button>`) : ""}${typeof shopBtn === "function" ? shopBtn(b.name, "From the Bottle guide", "+ Shopping list") : ""}<button class="btn small" type="button" id="bt-link">Copy link</button></div>
        </div>
      </div>
      <section class="make-sec">
        <div class="sec-head"><h3>Ratings</h3></div>
        ${uid() ? `<div class="rate" style="border-top:0;padding-top:0"><span class="label">${mine ? "Your rating" : "Rate it"}</span>
          <div class="rate-stars" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star${n <= mine ? " on" : ""}" data-bstar="${n}" role="radio" aria-checked="${n === mine}" aria-label="${n} star${n === 1 ? "" : "s"}">★</button>`).join("")}</div>
          ${mine ? `<button type="button" class="linkish" id="bt-rate-clear">Remove</button>` : ""}</div>
          ${mine ? `<div class="note-form"><label class="label" for="bt-comment">${r.mine.comment ? "Your comment" : "Add a comment"}</label><div class="chip-add"><input id="bt-comment" type="text" maxlength="500" value="${esc(r.mine.comment || "")}" placeholder="Your comment about this bottle (public)"><button class="btn small" type="button" id="bt-comment-save">Save</button></div></div>` : ""}`
          : `<p class="hint" style="margin:0">Sign in to rate this bottle.</p>`}
        ${reviews.length ? `<ul class="rnotes">${reviews.map(x => `<li><span class="stars">${starText(x.stars)}</span> <b>${x.user_id === uid() ? "You" : `<button type="button" class="linkish who" data-locker="${esc(x.user_id)}">${esc(lockerName(x.user_id))}</button>`}</b>${S.isAdmin && x.user_id !== uid() ? ` <button type="button" class="linkish" data-rmreview="${esc(x.user_id)}">Remove</button>` : ` ${reportBtn("comment", b.slug + "|" + x.user_id, x.user_id, x.comment)}`}<p>${esc(x.comment)}</p></li>`).join("")}</ul>` : ""}
      </section>
      <section class="make-sec">
        <div class="sec-head"><h3>Recipes that call for it <span class="count">${uses.length}</span></h3></div>
        ${uses.length ? `<ul class="plist">${uses.map(d => drinkRow(d, true)).join("")}</ul>` : `<p class="hint" style="margin:0">No recipes name this bottle yet. Set it as the recommended brand on an ingredient to list it here.</p>`}
      </section>
    </div>`;
  $("bt-back").onclick = bottleBack;
  m.querySelectorAll("[data-open]").forEach(x => x.onclick = () => selectDrink(x.dataset.open));
  $("bt-link").onclick = () => copyText(location.origin + location.pathname + "#bottle-" + b.slug, "Bottle link copied");
  if ($("bt-addbar")) $("bt-addbar").onclick = () => {
    const group = BOTTLE_GROUP[b.category] || "liquors";
    if (group === "fresh") addItem("fresh", b.ingredient || b.name); else addItem(group, b.ingredient || b.name, b.name);
    toast(`${b.name} added to your bottles`); renderMain();
  };
  if ($("bt-photo")) $("bt-photo").onclick = () => $("bottle-file").click();
  if ($("bt-photo-rm")) $("bt-photo-rm").onclick = async () => {
    const { error } = await sb.from("bottle_photos").delete().eq("id", photo.id);
    if (error) { toast("Couldn't remove the photo. Try again."); return; }
    S.bottlePhotos[b.slug] = (S.bottlePhotos[b.slug] || []).filter(x => x.id !== photo.id);
    if (photo.user_id === uid()) sb.storage.from(BUCKET).remove([photo.path]).catch(() => {});
    toast("Photo removed"); renderMain();
  };
  m.querySelectorAll("[data-bstar]").forEach(x => x.onclick = () => { const n = Number(x.dataset.bstar); rateBottle(b, n === mine ? 0 : n); });
  if ($("bt-rate-clear")) $("bt-rate-clear").onclick = () => rateBottle(b, 0);
  if ($("bt-comment-save")) { const save = () => rateBottle(b, mine, $("bt-comment").value); $("bt-comment-save").onclick = save; $("bt-comment").onkeydown = e => { if (e.key === "Enter") save(); }; }
  if ($("bt-fix")) $("bt-fix").onclick = () => suggestFix(b);
  if ($("bt-edit")) $("bt-edit").onclick = () => editBottle(b);
  m.querySelectorAll("[data-rmreview]").forEach(x => x.onclick = async () => {
    const { error } = await sb.from("bottle_reviews").delete().eq("slug", b.slug).eq("user_id", x.dataset.rmreview);
    if (error) { toast("Couldn't remove it. Try again."); return; }
    S.bottleReviews[b.slug] = (S.bottleReviews[b.slug] || []).filter(y => y.user_id !== x.dataset.rmreview); toast("Review removed"); renderMain();
  });
};
function bottleBack() {
  const v = S.cameFrom && S.cameFrom !== "bottle" ? S.cameFrom : "detail"; S.cameFrom = null;
  const reopen = { canmake: openCanMake, party: openParty, stock: openStock, guide: openGuide, profile: openProfile, make: openMake, locker: () => openLocker(S.lockerId) }[v];
  if (reopen) return reopen();
  S.view = "detail"; setHash(S.selected); renderList(); renderMain();
}

async function rateBottle(b, stars, comment) {
  if (!uid()) { toast("Sign in to rate bottles."); return; }
  const list = S.bottleReviews[b.slug] || (S.bottleReviews[b.slug] = []);
  const cur = list.find(x => x.user_id === uid());
  if (!stars) {
    const { error } = await sb.from("bottle_reviews").delete().eq("slug", b.slug).eq("user_id", uid());
    if (error) { toast("Couldn't remove your rating. Try again."); return; }
    S.bottleReviews[b.slug] = list.filter(x => x.user_id !== uid()); toast("Rating removed"); renderMain(); return;
  }
  const row = { slug: b.slug, user_id: uid(), stars, comment: (comment !== undefined ? String(comment).trim().slice(0, 500) : (cur && cur.comment) || "") || null, updated_at: new Date().toISOString() };
  const { error } = await sb.from("bottle_reviews").upsert(row);
  if (error) { toast("Couldn't save your rating. Try again."); return; }
  if (cur) Object.assign(cur, row); else list.push(row);
  toast(comment !== undefined ? (row.comment ? "Comment saved" : "Comment removed") : `Rated ${b.name} ${stars} star${stars === 1 ? "" : "s"}`);
  renderMain();
}
function suggestFix(b) {
  sheet("Suggest a fix", `<p class="hint" style="margin:0">What's wrong or missing on the ${esc(b.name)} page? The site owner will see it.</p>
    <textarea id="fix-msg" maxlength="1000" rows="4" style="width:100%;padding:8px;border:1px solid var(--rule);border-radius:8px;background:var(--raised)" placeholder="What's wrong, and what it should say"></textarea>
    <div class="panel-actions" style="justify-content:flex-start"><button class="btn primary small" type="button" id="fix-send">Send</button></div>`);
  $("fix-msg").focus();
  $("fix-send").onclick = async () => {
    const message = $("fix-msg").value.trim(); if (!message) { $("fix-msg").focus(); return; }
    const { error } = await sb.from("bottle_reports").insert({ slug: b.slug, user_id: uid(), message });
    if (error) { toast("Couldn't send it. Try again."); return; }
    closeSheet(); toast("Thanks. The site owner will take a look.");
  };
}
async function editBottle(b) {
  const reports = await sb.from("bottle_reports").select("id, message, created_at").eq("slug", b.slug);
  const fixes = (reports.data || []);
  const f = (id, label, v, type = "text") => `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(v == null ? "" : v)}"></div>`;
  sheet("Edit " + b.name, `
    ${fixes.length ? `<div class="scan-banner"><span><b>Suggested fixes</b></span>${fixes.map(x => `<span>• ${esc(x.message)}</span>`).join("")}</div>` : ""}
    ${f("eb-name", "Name", b.name)}${f("eb-product", "Full product name", b.product)}${f("eb-ingredient", "Type (what recipes call it)", b.ingredient)}
    <div class="row2">${f("eb-producer", "Producer", b.producer)}${f("eb-origin", "From", b.origin)}${f("eb-abv", "ABV % (0 for non-alcoholic, blank if unknown)", b.abv, "number")}${f("eb-age", "Age", b.age)}</div>
    <div class="field"><label for="eb-category">Category</label><select id="eb-category">${Object.entries(CATEGORY_LABEL).map(([k, l]) => `<option value="${k}" ${b.category === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div class="field"><label for="eb-desc">Description</label><textarea id="eb-desc" rows="5">${esc(b.description || "")}</textarea></div>
    <div class="panel-actions" style="justify-content:flex-start"><button class="btn primary small" type="button" id="eb-save">Save</button>${fixes.length ? `<button class="btn small" type="button" id="eb-clear">Save and clear suggestions</button>` : ""}</div>`);
  const save = async clear => {
    const abvRaw = $("eb-abv").value.trim(), abv = Number(abvRaw);
    const patch = { name: $("eb-name").value.trim() || b.name, product: $("eb-product").value.trim(), ingredient: $("eb-ingredient").value.trim(), producer: $("eb-producer").value.trim(),
      origin: $("eb-origin").value.trim(), abv: abvRaw === "" || !(abv >= 0 && abv < 100) ? null : abv, age: $("eb-age").value.trim(), category: $("eb-category").value, description: $("eb-desc").value.trim(), updated_at: new Date().toISOString() };
    const { error } = await sb.from("bottles").update(patch).eq("slug", b.slug);
    if (error) { toast("Couldn't save. Make sure you're set up as an admin."); return; }
    Object.assign(b, patch);
    if (clear) await sb.from("bottle_reports").delete().eq("slug", b.slug);
    closeSheet(); toast("Bottle updated"); renderMain();
  };
  $("eb-save").onclick = () => save(false);
  if ($("eb-clear")) $("eb-clear").onclick = () => save(true);
}
async function uploadBottlePhoto(file) {
  const b = S.bottles.find(x => x.slug === S.bottleSlug); if (!b || !uid()) return;
  toast("Uploading photo…");
  try {
    const blob = await prepImage(file);
    const type = blob.type || "image/jpeg";
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) { toast("Use a JPEG or PNG photo."); return; }
    const path = `${uid()}/bottles/${b.slug}/${Date.now()}.${type === "image/png" ? "png" : "jpg"}`;
    const check = await photoVerdict(blob, "bottle", b.name);
    const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: "31536000" });
    if (up.error) throw up.error;
    if (check.verdict === "hold") { await holdPhoto("bottle", b.slug, b.name, path, check.reason); return; }
    const { error } = await sb.from("bottle_photos").insert({ slug: b.slug, path, user_id: uid() });
    if (error) throw error;
    (S.bottlePhotos[b.slug] = S.bottlePhotos[b.slug] || []).push({ id: Date.now(), slug: b.slug, path, user_id: uid(), created_at: new Date().toISOString() });
    toast("Photo added"); renderMain();
  } catch (e) { toast("Couldn't add the photo. Try again."); }
}

// ---------- bottle guide (browse) ----------
function openGuide() { S.view = "guide"; S.confirmDelete = false; setHash("bottles"); renderList(); renderMain(); $("main").scrollIntoView({ behavior: "smooth", block: "start" }); }
HASH_VIEWS.bottles = openGuide;
S.guideQuery = "";
VIEWS.guide = function renderGuide() {
  const m = $("main");
  const q = S.guideQuery.trim().toLowerCase();
  const list = S.bottles.filter(b => !q || [b.name, b.product, b.ingredient, b.producer, b.origin, CATEGORY_LABEL[b.category]].join(" ").toLowerCase().includes(q))
    .sort((a, c) => { const ra = bottleRating(a.slug), rc = bottleRating(c.slug); return ((2 * 3.5 + rc.avg * rc.count) / (2 + rc.count)) - ((2 * 3.5 + ra.avg * ra.count) / (2 + ra.count)) || a.name.localeCompare(c.name); });
  const groups = {};
  list.forEach(b => (groups[CATEGORY_LABEL[b.category] || "Other"] = groups[CATEGORY_LABEL[b.category] || "Other"] || []).push(b));
  const row = b => { const r = bottleRating(b.slug), ph = bottlePhoto(b.slug);
    return `<li><button type="button" class="prow" data-bottle="${esc(b.name)}">${ph ? `<img class="thumb" src="${esc(photoUrl(ph.path))}" alt="" loading="lazy">` : `<span class="thumb" aria-hidden="true">${esc(b.name.charAt(0))}</span>`}
      <span class="txt"><span class="nm">${esc(b.name)}</span><span class="sub">${esc([b.ingredient, abvText(b), r.count ? `★ ${r.avg.toFixed(1)}` : ""].filter(Boolean).join(" · "))}</span></span></button></li>`; };
  m.innerHTML = `
    <div class="make">
      <div class="editor-top"><div><span class="label">Bottle guide</span><h2 class="make-title">Bottles</h2></div><button class="btn small" type="button" id="gd-back">Back to drinks</button></div>
      <p class="hint" style="margin:0">Every bottle people have looked up, best rated first. Tap a brand on any recipe or in your bottles to open its page.</p>
      <div class="chip-add"><input id="gd-search" type="search" placeholder="Search bottles, or type one to look it up" value="${esc(S.guideQuery)}" autocomplete="off"><button class="btn small primary" type="button" id="gd-go">Look up</button></div>
      ${S.bottlesOff ? `<p class="hint">The bottle guide isn't switched on yet. The site owner needs to run bottles-setup.sql.</p>`
        : list.length ? Object.keys(groups).sort().map(g => `<section class="make-sec"><div class="sec-head"><h3>${esc(g)} <span class="count">${groups[g].length}</span></h3></div><ul class="plist">${groups[g].map(row).join("")}</ul></section>`).join("")
        : `<p class="hint">${q ? `No bottles match. Tap Look up to find “${esc(S.guideQuery.trim())}”.` : "No bottles yet. Look one up above, or tap a recommended brand on any recipe."}</p>`}
    </div>`;
  $("gd-back").onclick = () => { S.view = "detail"; setHash(null); renderList(); renderMain(); };
  const inp = $("gd-search");
  inp.oninput = () => { S.guideQuery = inp.value; clearTimeout(VIEWS.guide.t); VIEWS.guide.t = setTimeout(() => { if (S.view !== "guide") return; renderMain(); const el = $("gd-search"); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 200); };
  const go = () => { clearTimeout(VIEWS.guide.t); const v = inp.value.trim(); if (v.length < 2) { inp.focus(); return; } S.cameFrom = "guide"; openBottle(v); };
  $("gd-go").onclick = go; inp.onkeydown = e => { if (e.key === "Enter") go(); };
};

// Any [data-bottle] button anywhere opens that bottle's page.
document.addEventListener("click", e => {
  const x = e.target.closest("[data-bottle]"); if (!x) return;
  e.preventDefault(); closeSheet(); if (S.view !== "bottle") S.cameFrom = S.view; openBottle(x.dataset.bottle);
});
$("guide-btn").onclick = openGuide;
$("bottle-file").onchange = ev => { const f = ev.target.files && ev.target.files[0]; ev.target.value = ""; if (f) uploadBottlePhoto(f); };
