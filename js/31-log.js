// ---------- drink log ("I made this") ----------
// A private, dated entry each time you make a drink, with an optional note (supabase/log-setup.sql).
// Shown on the recipe page under the ratings, in My Log on My Cocktail Cart, and as "Made 4×" in the lists.
S.log = []; S.logOff = false; S.logAll = {}; S.logShow = 10;
async function loadLog() {
  if (!sb || !uid()) { S.log = []; return; }
  const { data, error } = await sb.from("drink_log").select("id, drink_id, drink_name, made_on, note").eq("user_id", uid());
  S.logOff = !!error; S.log = error ? [] : sortLog(data || []);
}
const sortLog = list => list.sort((a, b) => String(b.made_on).localeCompare(String(a.made_on)) || (Number(b.id) - Number(a.id)));
const todayIso = () => { const t = new Date(); return new Date(t - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
function logDate(iso, withYear) {
  const d = new Date(iso + "T12:00:00");
  const y = withYear || d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleDateString(undefined, y ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
}
const logFor = d => S.log.filter(e => e.drink_id === d.id);
function madeCount(d) { return uid() && S.log.length ? logFor(d).length : 0; }

// ---------- on the recipe page ----------
function madeHtml(d) {
  if (S.backend !== "supabase" || !uid() || S.logOff) return "";
  const list = logFor(d), n = list.length, all = S.logAll[d.id], shown = all ? list : list.slice(0, 3);
  return `<section class="made-sec" id="made-sec">
    <div class="made-head"><div><b>${n ? `Made ${n} time${n === 1 ? "" : "s"}` : "Made it?"}</b>
      <div class="hint">${n ? `Last on ${esc(logDate(list[0].made_on))}` : "Keep a private log of when you make it, with notes."}</div></div>
      <button class="btn primary small" type="button" id="made-btn" aria-haspopup="dialog">✓ I made this</button></div>
    ${n ? `<ul class="log-list">${shown.map(e => `<li>
      <span class="lg-date">${esc(logDate(e.made_on))}</span>
      <span class="lg-body">${e.note ? esc(e.note) : `<span class="hint">No note</span>`}
        ${e.note ? `<button type="button" class="linkish lg-riff" data-log-riff="${e.id}">Make my version with this change</button>` : ""}</span>
      <button type="button" class="linkish lg-edit" data-log-edit="${e.id}" aria-label="Edit the entry from ${esc(logDate(e.made_on))}">Edit</button></li>`).join("")}</ul>
      ${n > 3 && !all ? `<button type="button" class="linkish" id="log-all">See all ${n}</button>` : ""}
      <p class="hint lg-private">Only you can see your log.</p>` : ""}
  </section>`;
}
function wireMade(d) {
  const sec = $("made-sec"); if (!sec) return;
  $("made-btn").onclick = () => openMadeSheet(d);
  if ($("log-all")) $("log-all").onclick = () => { S.logAll[d.id] = true; renderMain(); };
  sec.querySelectorAll("[data-log-edit]").forEach(b => b.onclick = () => openMadeSheet(d, S.log.find(e => String(e.id) === b.dataset.logEdit)));
  sec.querySelectorAll("[data-log-riff]").forEach(b => b.onclick = () => riffFromLog(d, S.log.find(e => String(e.id) === b.dataset.logRiff)));
}
function openMadeSheet(d, entry) {
  const t = todayIso();
  sheet(d.name, `<form class="made-form" id="made-form">
    <label for="lg-date">When</label>
    <input type="date" id="lg-date" max="${t}" value="${esc(entry ? entry.made_on : t)}" required>
    <label for="lg-note">Note <span class="hint">(optional, only you see it)</span></label>
    <textarea id="lg-note" rows="4" maxlength="1000" placeholder="What did you use or change? How was it?">${esc(entry ? entry.note || "" : "")}</textarea>
    <button class="btn primary" type="submit" id="lg-save">${entry ? "Save changes" : "Save to my log"}</button>
    ${entry ? `<button class="btn danger" type="button" id="lg-del">Delete this entry</button>` : ""}
  </form>`);
  $("made-form").onsubmit = async ev => {
    ev.preventDefault();
    const made_on = ($("lg-date").value || t).slice(0, 10), note = $("lg-note").value.trim().slice(0, 1000) || null;
    if (made_on > t) { toast("Pick today or an earlier day."); return; }
    $("lg-save").disabled = true;
    if (entry) {
      const { error } = await sb.from("drink_log").update({ made_on, note }).eq("id", entry.id);
      if (error) { $("lg-save").disabled = false; toast("Couldn't save. Try again."); return; }
      Object.assign(entry, { made_on, note }); sortLog(S.log); closeSheet(); toast("Saved"); renderList(); renderMain(); return;
    }
    const row = { user_id: uid(), drink_id: d.id, drink_name: String(d.name || "").slice(0, 120), made_on, note };
    const { data, error } = await sb.from("drink_log").insert(row).select().single();
    if (error) { $("lg-save").disabled = false; toast(/relation|does not exist|schema cache/i.test(error.message || "") ? "The drink log isn't set up yet. Run log-setup.sql in Supabase." : "Couldn't save. Try again."); return; }
    S.log.push(Object.assign({ id: (data && data.id) || Date.now() }, row)); sortLog(S.log);
    renderList(); renderMain();
    // Haven't rated it yet? Ask now (this is the public rating).
    if (!S.ratingsOff && !ratingOf(d).mine) {
      sheet(d.name, `<div class="made-rate"><b>Logged. How was it?</b>
        <div class="rate-stars big-stars" role="radiogroup" aria-label="Rate ${esc(d.name)}">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star" data-lg-star="${n}" role="radio" aria-checked="false" aria-label="${n} star${n === 1 ? "" : "s"}">★</button>`).join("")}</div>
        <p class="hint">Your rating is public and adds to the drink's average.</p>
        <button type="button" class="linkish" id="lg-skip">Not now</button></div>`);
      document.querySelectorAll("[data-lg-star]").forEach(b => b.onclick = async () => { closeSheet(); await rateDrink(d, Number(b.dataset.lgStar)); renderList(); renderMain(); });
      $("lg-skip").onclick = closeSheet;
    } else { closeSheet(); toast("Logged"); }
  };
  if ($("lg-del")) $("lg-del").onclick = async () => {
    const { error } = await sb.from("drink_log").delete().eq("id", entry.id);
    if (error) { toast("Couldn't delete. Try again."); return; }
    S.log = S.log.filter(e => e !== entry); closeSheet(); toast("Entry deleted"); renderList(); renderMain();
  };
}
// Start your own version of the drink, with the note from that day.
function riffFromLog(d, e) {
  if (!e) return;
  const c = JSON.parse(JSON.stringify(d)); delete c.photo; delete c.owner; c.id = null;
  if (d.standard) { delete c.standard; delete c.slug; delete c.aliases; delete c.about; }
  const cl = classicOf(d); if (cl) c.classic = cl;
  c.name = `${d.name} (my version)`.slice(0, 80);
  c.notes = `From my log, ${logDate(e.made_on, true)}: ${e.note}`;
  openEditor(c, true);
}

// ---------- My Log on My Cocktail Cart ----------
function logSectionHtml() {
  if (S.backend !== "supabase" || !uid() || S.logOff) return "";
  const list = S.log, now = todayIso().slice(0, 7);
  const counts = {}; list.forEach(e => { counts[e.drink_id] = (counts[e.drink_id] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const nameOf = id => { const d = allDrinks().find(x => x.id === id); return d ? d.name : ((list.find(e => e.drink_id === id) || {}).drink_name || "A drink"); };
  let month = "";
  const rows = list.slice(0, S.logShow).map(e => {
    const m = e.made_on.slice(0, 7), d = allDrinks().find(x => x.id === e.drink_id);
    const label = new Date(e.made_on + "T12:00:00").toLocaleDateString(undefined, m.slice(0, 4) === now.slice(0, 4) ? { month: "long" } : { month: "long", year: "numeric" });
    const head = m !== month ? `<li class="lg-month">${esc(label)}</li>` : ""; month = m;
    return head + `<li><button type="button" class="lg-entry" ${d ? `data-open="${esc(d.id)}"` : "disabled"}>
      ${d ? drinkThumb(d) : `<span class="thumb" aria-hidden="true"></span>`}
      <span class="txt"><span><b>${esc(d ? d.name : e.drink_name || "A drink")}</b> <span class="hint">· ${esc(logDate(e.made_on))}${d ? "" : " · no longer on the site"}</span></span>
      ${e.note ? `<span class="lg-note">${esc(e.note)}</span>` : ""}</span></button></li>`;
  }).join("");
  return `<section class="make-sec" id="prof-log">
    <div class="sec-head"><h3>My Log</h3></div>
    ${list.length ? `<div class="lg-tiles">
        <div><b>${list.filter(e => e.made_on.slice(0, 7) === now).length}</b><span>this month</span></div>
        <div><b>${list.length}</b><span>all time</span></div>
        <div><b>${esc(nameOf(top[0]))}</b><span>most made (${top[1]}×)</span></div></div>
      <ul class="lg-timeline">${rows}</ul>
      ${list.length > S.logShow ? `<button type="button" class="linkish" id="log-more">Show more</button>` : ""}
      <p class="hint" style="margin:0">Only you can see your log.</p>`
    : `<p class="hint" style="margin:0">Nothing logged yet. Tap <b>✓ I made this</b> on any recipe to start a private log of what you make, with notes.</p>`}
  </section>`;
}
function wireLogSection() {
  const sec = $("prof-log"); if (!sec) return;
  sec.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { selectDrink(b.dataset.open); window.scrollTo({ top: 0 }); });
  if ($("log-more")) $("log-more").onclick = () => { S.logShow += 20; renderMain(); };
}
