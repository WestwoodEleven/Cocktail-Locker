// ---------- photo check and review ----------
// New drink and bottle photos get a quick AI look (mode "photo_check"). Photos that aren't about drinks,
// or look inappropriate, are uploaded but kept hidden in photo_reviews until an admin approves them.
// If the check can't run (AI down, old function), the photo goes up as before; the Report button still applies.
S.held = []; S.myHeld = [];
async function photoVerdict(blob, kind, name) {
  if (!sb || S.isAdmin) return { verdict: "ok" };
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 768 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const image = c.toDataURL("image/jpeg", 0.8);
    const { data } = await invokeHelper({ mode: "photo_check", image, mediaType: "image/jpeg", kind, name: String(name || "").slice(0, 80) });
    if (data && (data.verdict === "ok" || data.verdict === "hold")) return data;
  } catch (e) {}
  return { verdict: "ok", skipped: true };
}
// Keep an uploaded photo hidden until an admin looks at it.
async function holdPhoto(kind, target, name, path, reason) {
  const row = { kind, target, target_name: String(name || "").slice(0, 120), path, user_id: uid(), reason: String(reason || "").slice(0, 300) };
  const { error } = await sb.from("photo_reviews").insert(row);
  if (error) { sb.storage.from(BUCKET).remove([path]).catch(() => {}); toast("Couldn't add the photo. Try another one."); return false; }
  S.myHeld.push(Object.assign({ created_at: new Date().toISOString() }, row));
  toast("Thanks! An admin will take a quick look before this photo shows.");
  return true;
}
async function loadMyHeld() {
  if (!sb || !uid()) { S.myHeld = []; return; }
  const { data, error } = await sb.from("photo_reviews").select("kind, target, path, created_at").eq("user_id", uid());
  S.myHeld = error ? [] : (data || []);
}
const isHeld = (kind, target) => S.myHeld.some(h => h.kind === kind && h.target === target);

// ---------- admin: review held photos ----------
async function loadHeld() {
  if (!sb || !S.isAdmin) { S.held = []; return; }
  const { data, error } = await sb.from("photo_reviews").select("*").order("created_at", { ascending: true });
  S.heldOff = !!error; S.held = error ? [] : (data || []);
}
function openPhotoReview() { S.view = "photoreview"; setHash("photo-review"); renderList(); renderMain(); window.scrollTo({ top: 0 }); loadHeld().then(() => { if (S.view === "photoreview") renderMain(); }); }
HASH_VIEWS["photo-review"] = openPhotoReview;
VIEWS.photoreview = function renderPhotoReview() {
  const m = $("main");
  const head = `<div class="editor-top"><div><span class="label">Admin</span><h2 class="make-title">Photos to review</h2>
    <div class="hint">${S.heldOff ? "Photo review isn't set up yet. Run photo-review-setup.sql in Supabase." : S.held.length ? `${S.held.length} waiting` : "Nothing waiting."}</div></div>
    <button class="btn small" type="button" id="pr-back">Back to My Cocktail Cart</button></div>`;
  if (!S.isAdmin) { m.innerHTML = `<div class="make"><h2 class="make-title">Photos to review</h2><p class="hint">Only site admins can review photos.</p></div>`; return; }
  m.innerHTML = `<div class="make">${head}
    ${S.held.map(h => `<article class="pr-item">
      <img src="${esc(photoUrl(h.path))}" alt="Held photo for ${esc(h.target_name || h.target)}" loading="lazy">
      <div class="pr-body">
        <b>${h.kind === "bottle" ? "Bottle" : "Drink"}: ${esc(h.target_name || h.target)}</b>
        <span class="hint">From ${esc(lockerName(h.user_id))} · ${esc(new Date(h.created_at).toLocaleDateString())}</span>
        ${h.reason ? `<span class="pr-reason">${esc(h.reason)}</span>` : ""}
        <div class="panel-actions" style="justify-content:flex-start">
          <button class="btn small primary" type="button" data-pr-ok="${h.id}">Approve</button>
          <button class="btn small danger" type="button" data-pr-no="${h.id}">Reject</button>
        </div>
      </div></article>`).join("")}
  </div>`;
  $("pr-back").onclick = () => { openProfile(); window.scrollTo({ top: 0 }); };
  m.querySelectorAll("[data-pr-ok]").forEach(b => b.onclick = () => decideHeld(Number(b.dataset.prOk), true));
  m.querySelectorAll("[data-pr-no]").forEach(b => b.onclick = () => decideHeld(Number(b.dataset.prNo), false));
};
async function decideHeld(id, approve) {
  const h = S.held.find(x => x.id === id); if (!h) return;
  if (approve) {
    if (h.kind === "drink") {
      const d = S.drinks.find(x => x.id === h.target);
      if (!d) { toast("That drink is gone. Rejecting the photo."); return decideHeld(id, false); }
      const body = JSON.parse(JSON.stringify(d)); delete body.id; delete body.owner; body.photo = h.path;
      const { error } = await sb.from("drinks").update({ data: body, updated_at: new Date().toISOString() }).eq("id", d.id);
      if (error) { toast("Couldn't approve. Try again."); return; }
      const old = d.photo; d.photo = h.path;
      if (old && old !== h.path) sb.storage.from(BUCKET).remove([old]).catch(() => {});
    } else {
      const { error } = await sb.from("bottle_photos").insert({ slug: h.target, path: h.path, user_id: h.user_id });
      if (error) { toast("Couldn't approve. Run photo-review-setup.sql, then try again."); return; }
      (S.bottlePhotos[h.target] = S.bottlePhotos[h.target] || []).push({ id: Date.now(), slug: h.target, path: h.path, user_id: h.user_id, created_at: new Date().toISOString() });
    }
  } else sb.storage.from(BUCKET).remove([h.path]).catch(() => {});
  await sb.from("photo_reviews").delete().eq("id", id);
  S.held = S.held.filter(x => x.id !== id);
  toast(approve ? "Photo approved" : "Photo rejected");
  renderMain();
}
