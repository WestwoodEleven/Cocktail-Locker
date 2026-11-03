// ---------- reports and moderation ----------
// Anyone signed in can report a drink, rating note, bottle comment, bottle photo or cart. Reports go to
// a table only site admins can read; admins review them on the Reports page (#reports, linked from My Cocktails).
// Targets: drink = drink id; note = "<drink id>|<user id>"; comment = "<bottle slug>|<user id>";
// bottle_photo = photo id; cart = user id.
const REPORT_REASONS = [
  ["spam", "Spam or advertising"],
  ["offensive", "Offensive or inappropriate"],
  ["not_theirs", "Uses someone else's photo or work"],
  ["unsafe", "Unsafe or harmful"],
  ["other", "Something else"]
];
const REPORT_KINDS = { drink: "drink", note: "rating note", comment: "comment", bottle_photo: "photo", cart: "cart" };

// A small "Report" link, or nothing when it's your own content or the site has no accounts.
function reportBtn(kind, target, owner, snap, label) {
  if (S.backend !== "supabase" || (owner && owner === uid())) return "";
  return `<button type="button" class="linkish report-link" data-report="${kind}" data-target="${esc(target)}" data-owner="${esc(owner || "")}" data-snap="${esc(String(snap || "").slice(0, 600))}">${label || "Report"}</button>`;
}

function openReport(kind, target, owner, snap) {
  const what = REPORT_KINDS[kind] || "post";
  if (!uid()) {
    sheet(`Report this ${what}`, `<p style="margin:0">Sign in to report something, or email <a href="mailto:support@mycocktailcart.com">support@mycocktailcart.com</a> and tell us what's wrong.</p>
      <div class="share-actions"><button class="btn primary" type="button" id="rp-signin">Sign in</button><button class="btn" type="button" id="rp-cancel">Cancel</button></div>`);
    $("rp-cancel").onclick = closeSheet;
    $("rp-signin").onclick = () => { closeSheet(); $("auth-btn").click(); };
    return;
  }
  sheet(`Report this ${what}`, `
    <p class="hint" style="margin:0">Reports go to the site's admins. The person won't be told who sent it.</p>
    <fieldset class="rp-reasons"><legend class="label">What's wrong?</legend>
      ${REPORT_REASONS.map(([v, t], i) => `<label class="check"><input type="radio" name="rp-reason" value="${v}" ${i ? "" : "checked"}><span>${t}</span></label>`).join("")}
    </fieldset>
    <div class="field"><label for="rp-details">Anything else? (optional)</label><textarea id="rp-details" maxlength="500" rows="3"></textarea></div>
    <div class="share-actions"><button class="btn primary" type="button" id="rp-send">Send report</button><button class="btn" type="button" id="rp-cancel">Cancel</button></div>
    <p class="hint" id="rp-msg" role="status" style="margin:0"></p>`);
  $("rp-cancel").onclick = closeSheet;
  $("rp-send").onclick = async () => {
    const reason = (document.querySelector("input[name=rp-reason]:checked") || {}).value || "other";
    const details = $("rp-details").value.trim().slice(0, 500) || null;
    $("rp-send").disabled = true; $("rp-msg").textContent = "Sending…";
    const { error } = await sb.from("reports").insert({ kind, target, target_owner: owner || null, reason, details, snapshot: String(snap || "").slice(0, 600) || null, reporter: uid() });
    if (error && error.code === "23505") { closeSheet(); toast("You've already reported this. Thanks."); return; }
    if (error) {
      $("rp-send").disabled = false;
      $("rp-msg").textContent = /relation|does not exist|schema cache/i.test(error.message || "")
        ? "Reporting isn't switched on yet. Email support@mycocktailcart.com instead."
        : "Couldn't send the report. Try again.";
      return;
    }
    closeSheet(); toast("Thanks. An admin will take a look.");
  };
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-report]"); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  openReport(b.dataset.report, b.dataset.target, b.dataset.owner, b.dataset.snap);
});

// ---------- admin: review reports ----------
S.reports = [];
async function loadReports() {
  S.reports = [];
  if (!sb || !S.isAdmin) return;
  const r = await sb.from("reports").select("id, kind, target, target_owner, reason, details, snapshot, created_at").order("created_at", { ascending: false });
  S.reportsOff = !!r.error;
  S.reports = r.data || [];
}
function reportGroups() {
  const g = new Map();
  for (const r of S.reports) {
    const k = r.kind + "|" + r.target;
    if (!g.has(k)) g.set(k, { kind: r.kind, target: r.target, owner: r.target_owner, items: [] });
    g.get(k).items.push(r);
  }
  return [...g.values()];
}
function findBottlePhoto(id) {
  for (const list of Object.values(S.bottlePhotos)) { const p = list.find(x => String(x.id) === String(id)); if (p) return p; }
  return null;
}
function openReports() { S.view = "reports"; setHash("reports"); renderList(); renderMain(); $("main").scrollIntoView({ behavior: "smooth", block: "start" }); loadReports().then(() => { if (S.view === "reports") renderMain(); }); }
HASH_VIEWS.reports = openReports;

// What a report is about, as it stands now (or as it was, if it's already gone).
function reportSubject(g) {
  const snap = g.items[0].snapshot || "";
  const who = id => id ? esc(lockerName(id)) : "someone";
  if (g.kind === "drink") {
    const d = S.drinks.find(x => x.id === g.target);
    return { title: d ? esc(d.name) : `${esc(snap)} <span class="hint">(already deleted)</span>`, gone: !d, d,
      body: d ? `In ${who(d.owner)}'s cart${d.photo ? `<img class="rp-thumb" src="${esc(photoUrl(d.photo))}" alt="">` : ""}` : "" };
  }
  if (g.kind === "note") {
    const [drinkId, userId] = g.target.split("|");
    const d = allDrinks().find(x => x.id === drinkId);
    const row = (S.ratingRows[drinkId] || []).find(x => x.user_id === userId);
    const note = row && row.note;
    return { title: `Note by ${who(userId)} on ${d ? esc(d.name) : "a deleted drink"}`, gone: !note, d,
      body: `<p class="rp-snap">“${esc(note || snap)}”</p>${note ? "" : `<span class="hint">Already removed.</span>`}` };
  }
  if (g.kind === "comment") {
    const [slug, userId] = g.target.split("|");
    const b = S.bottles.find(x => x.slug === slug);
    const row = (S.bottleReviews[slug] || []).find(x => x.user_id === userId);
    return { title: `Comment by ${who(userId)} on ${b ? esc(b.name) : esc(slug)}`, gone: !row, slug,
      body: `<p class="rp-snap">“${esc(row && row.comment || snap)}”</p>${row ? "" : `<span class="hint">Already removed.</span>`}` };
  }
  if (g.kind === "bottle_photo") {
    const p = findBottlePhoto(g.target);
    const b = p && S.bottles.find(x => x.slug === p.slug);
    return { title: `Photo by ${who(g.owner)}${b ? " of " + esc(b.name) : ""}`, gone: !p, slug: p && p.slug, photo: p,
      body: p ? `<img class="rp-thumb" src="${esc(photoUrl(p.path))}" alt="">` : `<span class="hint">Already removed.</span>` };
  }
  if (g.kind === "cart") return { title: `Cart: ${who(g.target)}`, gone: false, body: "" };
  return { title: esc(snap), gone: false, body: "" };
}

VIEWS.reports = function renderReports() {
  const m = $("main");
  if (!S.isAdmin) { m.innerHTML = `<div class="make"><h2 class="make-title">Reports</h2><p class="hint">Only site admins can see reports.</p></div>`; return; }
  const groups = reportGroups();
  const reasonText = v => (REPORT_REASONS.find(r => r[0] === v) || [, v])[1];
  m.innerHTML = `
    <div class="make">
      <div class="editor-top"><div><span class="label">Admin</span><h2 class="make-title">Reports</h2>
        <div class="hint">${S.reportsOff ? "Reports aren't switched on yet. Run reports-setup.sql in Supabase." : groups.length ? `${groups.length} to review` : "Nothing to review."}</div></div>
        <button class="btn small" type="button" id="rp-back">Back to My Cocktails</button></div>
      ${groups.map((g, i) => {
        const s = reportSubject(g);
        const acts = [];
        if (g.kind === "drink" && s.d) { acts.push(`<button class="btn small" type="button" data-rpview="${i}">View</button>`); if (s.d.photo) acts.push(`<button class="btn small danger" type="button" data-rpact="photo" data-i="${i}">Remove photo</button>`); acts.push(`<button class="btn small danger" type="button" data-rpact="drink" data-i="${i}">Delete drink</button>`); }
        if (g.kind === "note") { if (s.d) acts.push(`<button class="btn small" type="button" data-rpview="${i}">View</button>`); if (!s.gone) acts.push(`<button class="btn small danger" type="button" data-rpact="note" data-i="${i}">Remove note</button>`); }
        if (g.kind === "comment" && !s.gone) acts.push(`<button class="btn small" type="button" data-rpview="${i}">View</button><button class="btn small danger" type="button" data-rpact="comment" data-i="${i}">Delete comment</button>`);
        if (g.kind === "bottle_photo" && !s.gone) acts.push(`<button class="btn small" type="button" data-rpview="${i}">View</button><button class="btn small danger" type="button" data-rpact="bphoto" data-i="${i}">Delete photo</button>`);
        if (g.kind === "cart") acts.push(`<button class="btn small" type="button" data-rpview="${i}">View</button><button class="btn small danger" type="button" data-rpact="cart" data-i="${i}">Reset cart name</button>`);
        acts.push(`<button class="btn small" type="button" data-rpact="dismiss" data-i="${i}">${s.gone ? "Clear" : "Dismiss"}</button>`);
        return `<section class="make-sec rp-item">
          <div class="sec-head"><h3>${s.title}</h3><span class="hint">${g.items.length} report${g.items.length === 1 ? "" : "s"} · ${esc(String(g.items[0].created_at || "").slice(0, 10))}</span></div>
          ${s.body}
          <ul class="rp-reasons-list">${g.items.map(r => `<li><b>${esc(reasonText(r.reason))}</b>${r.details ? `: ${esc(r.details)}` : ""}</li>`).join("")}</ul>
          <div class="panel-actions" style="justify-content:flex-start">${acts.join("")}</div>
        </section>`;
      }).join("")}
    </div>`;
  $("rp-back").onclick = () => openProfile();
  m.querySelectorAll("[data-rpview]").forEach(b => b.onclick = () => {
    const g = groups[+b.dataset.rpview], s = reportSubject(g);
    if (g.kind === "cart") openLocker(g.target);
    else if (s.d) selectDrink(s.d.id);
    else if (s.slug) { const bt = S.bottles.find(x => x.slug === s.slug); openBottle(bt ? bt.name : s.slug); }
  });
  m.querySelectorAll("[data-rpact]").forEach(b => b.onclick = () => moderate(b.dataset.rpact, groups[+b.dataset.i], b));
};

async function moderate(act, g, btn) {
  const s = reportSubject(g);
  btn.disabled = true;
  let error = null, done = "";
  if (act === "photo" || act === "drink") {
    const d = s.d, photo = d.photo;
    if (act === "drink") { ({ error } = await sb.from("drinks").delete().eq("id", d.id)); done = "Drink deleted"; }
    else {
      const body = JSON.parse(JSON.stringify(d)); delete body.id; delete body.owner; delete body.photo;
      ({ error } = await sb.from("drinks").update({ data: body, updated_at: new Date().toISOString() }).eq("id", d.id));
      done = "Photo removed";
    }
    if (!error && photo) sb.storage.from(BUCKET).remove([photo]).catch(() => {});
    if (!error) await loadDrinks();
  } else if (act === "note") {
    const [drinkId, userId] = g.target.split("|");
    ({ error } = await sb.from("ratings").update({ note: null }).eq("drink_id", drinkId).eq("user_id", userId));
    done = "Note removed"; if (!error) await loadRatings();
  } else if (act === "comment") {
    const [slug, userId] = g.target.split("|");
    ({ error } = await sb.from("bottle_reviews").delete().eq("slug", slug).eq("user_id", userId));
    done = "Comment deleted";
    if (!error) S.bottleReviews[slug] = (S.bottleReviews[slug] || []).filter(x => x.user_id !== userId);
  } else if (act === "bphoto") {
    const p = s.photo;
    ({ error } = await sb.from("bottle_photos").delete().eq("id", p.id));
    done = "Photo deleted";
    if (!error) { sb.storage.from(BUCKET).remove([p.path]).catch(() => {}); S.bottlePhotos[p.slug] = (S.bottlePhotos[p.slug] || []).filter(x => x.id !== p.id); }
  } else if (act === "cart") {
    ({ error } = await sb.from("profiles").update({ display_name: null }).eq("id", g.target));
    done = "Cart name reset"; if (!error) await loadProfiles();
  } else done = "Report cleared";
  if (error) { btn.disabled = false; toast("Couldn't do that. Make sure reports-setup.sql has been run."); return; }
  await sb.from("reports").delete().eq("kind", g.kind).eq("target", g.target);
  await loadReports();
  toast(done); renderList(); renderMain();
}

// Admin section for My Cocktails
function adminHtml() {
  if (!S.isAdmin) return "";
  const n = reportGroups().length;
  return `<section class="make-sec" id="prof-admin">
    <div class="sec-head"><h3>Admin</h3></div>
    <div class="panel-actions" style="justify-content:flex-start"><button class="btn small${n ? " primary" : ""}" type="button" id="prof-reports">Review reports${n ? ` (${n})` : ""}</button></div>
  </section>`;
}
function wireAdmin() { const b = $("prof-reports"); if (b) b.onclick = openReports; }
