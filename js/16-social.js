// The Cocktail Locker: lists, notes with ratings, locker pages and following. Scripts share one global scope and load in numbered order.

// ---------- a small reusable sheet ----------
function sheet(title, html) {
  let el = $("gen-modal");
  if (!el) {
    el = document.createElement("div"); el.className = "modal"; el.id = "gen-modal";
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="gen-title"><div class="sheet-head"><h3 id="gen-title"></h3><button class="x" type="button" id="gen-close" aria-label="Close">×</button></div><div id="gen-body"></div></div>`;
    document.body.appendChild(el);
    el.addEventListener("click", e => { if (e.target === el) closeSheet(); });
    $("gen-close").onclick = closeSheet;
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !el.hidden) closeSheet(); });
  }
  $("gen-title").textContent = title; $("gen-body").innerHTML = html; el.hidden = false;
  return $("gen-body");
}
function closeSheet() { const el = $("gen-modal"); if (el) el.hidden = true; }

// ---------- notes with ratings ----------
S.ratingRows = {};
function ratingNotes(d) {
  return (S.ratingRows[d.id] || []).filter(r => r.note && r.note.trim())
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
}
function myNote(d) { const r = (S.ratingRows[d.id] || []).find(x => x.user_id === uid()); return r ? r.note || "" : ""; }
async function saveNote(d, note) {
  note = String(note || "").trim().slice(0, 280);
  const mine = ratingOf(d).mine;
  if (!mine) { toast("Pick a star rating first."); return; }
  const { error } = await sb.from("ratings").upsert({ drink_id: d.id, user_id: uid(), stars: mine, note: note || null, updated_at: new Date().toISOString() });
  if (error) { toast(S.notesOff ? "Notes aren't switched on yet. The site owner needs to run social-setup.sql." : "Couldn't save your note. Try again."); return; }
  const rows = S.ratingRows[d.id] || (S.ratingRows[d.id] = []);
  const r = rows.find(x => x.user_id === uid());
  if (r) { r.note = note; r.updated_at = new Date().toISOString(); } else rows.push({ user_id: uid(), stars: mine, note, updated_at: new Date().toISOString() });
  toast(note ? "Note saved" : "Note removed");
  renderMain();
}
function noteForm(d) {
  if (S.notesOff || !uid() || !ratingOf(d).mine) return "";
  const n = myNote(d);
  return `<div class="note-form"><label class="label" for="note-in">${n ? "Your note" : "Add a note with your rating"}</label>
    <div class="chip-add"><input id="note-in" type="text" maxlength="280" value="${esc(n)}" placeholder="Add a note"><button class="btn small" type="button" id="note-save">Save note</button></div></div>`;
}
function notesBlock(d) {
  const rows = ratingNotes(d);
  if (!rows.length) return "";
  return `<div><div class="label notes-label">What people say</div><ul class="rnotes">${rows.slice(0, 20).map(r => `<li>
    <span class="stars">${starText(r.stars)}</span> <b>${r.user_id === uid() ? "You" : `<button type="button" class="linkish who" data-locker="${esc(r.user_id)}">${esc(lockerName(r.user_id))}</button>`}</b>
    <p>${esc(r.note)}</p></li>`).join("")}</ul></div>`;
}

// ---------- lists ----------
S.collections = []; S.colItems = {};
async function loadCollections() {
  S.collections = []; S.colItems = {};
  if (!sb) return;
  const [c, i] = await Promise.all([sb.from("collections").select("id, owner, name, is_public, created_at"), sb.from("collection_items").select("collection_id, drink_id")]);
  if (c.error) { S.colsOff = true; return; }
  S.colsOff = false;
  S.collections = (c.data || []).sort((a, b) => a.name.localeCompare(b.name));
  (i.data || []).forEach(r => (S.colItems[r.collection_id] = S.colItems[r.collection_id] || new Set()).add(r.drink_id));
}
const myLists = () => S.collections.filter(c => c.owner === uid());
const listDrinks = c => allSorted().filter(d => S.colItems[c.id] && S.colItems[c.id].has(d.id));
function openListsFor(d) {
  if (!uid()) { toast("Sign in to make lists."); return; }
  if (S.colsOff) { toast("Lists aren't switched on yet. The site owner needs to run social-setup.sql."); return; }
  const draw = () => {
    const body = sheet(`Add ${d.name} to a list`, `
      ${myLists().length ? `<ul class="list-pick">${myLists().map(c => `<li><label class="check"><input type="checkbox" data-col="${esc(c.id)}" ${S.colItems[c.id] && S.colItems[c.id].has(d.id) ? "checked" : ""}><span>${esc(c.name)} <span class="hint">${(S.colItems[c.id] || new Set()).size} drinks${c.is_public ? "" : " · private"}</span></span></label></li>`).join("")}</ul>`
        : `<p class="hint" style="margin:0">You don't have any lists yet. Make one for a party, a season or a theme.</p>`}
      <div class="chip-add"><input id="newlist-name" type="text" maxlength="60" placeholder="New list name, like Thanksgiving"><button class="btn small primary" type="button" id="newlist-add">Create and add</button></div>`);
    body.querySelectorAll("[data-col]").forEach(cb => cb.onchange = async () => {
      const id = cb.dataset.col;
      const { error } = cb.checked ? await sb.from("collection_items").upsert({ collection_id: id, drink_id: d.id })
                                   : await sb.from("collection_items").delete().eq("collection_id", id).eq("drink_id", d.id);
      if (error) { toast("Couldn't update the list. Try again."); cb.checked = !cb.checked; return; }
      const set = S.colItems[id] || (S.colItems[id] = new Set());
      cb.checked ? set.add(d.id) : set.delete(d.id);
      toast(cb.checked ? "Added to the list" : "Removed from the list");
      renderFilters(); draw();
    });
    const create = async () => {
      const name = $("newlist-name").value.trim().slice(0, 60);
      if (!name) { $("newlist-name").focus(); return; }
      const { data, error } = await sb.from("collections").insert({ owner: uid(), name, is_public: true }).select("id, owner, name, is_public, created_at").single();
      if (error || !data) { toast("Couldn't create the list. Try again."); return; }
      S.collections.push(data); S.collections.sort((a, b) => a.name.localeCompare(b.name));
      await sb.from("collection_items").upsert({ collection_id: data.id, drink_id: d.id });
      (S.colItems[data.id] = new Set()).add(d.id);
      toast(`Added to ${name}`); renderFilters(); draw();
    };
    $("newlist-add").onclick = create;
    $("newlist-name").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); create(); } };
  };
  draw();
}
function listsHtml(lists, editable) {
  if (!lists.length) return "";
  return lists.map(c => { const ds = listDrinks(c); return `<details class="listbox">
    <summary><b>${esc(c.name)}</b> <span class="hint">${ds.length} drink${ds.length === 1 ? "" : "s"}${editable ? (c.is_public ? " · shown on your cart page" : " · private") : ""}</span></summary>
    ${ds.length ? `<ul class="plist">${ds.map(d => drinkRow(d, true)).join("")}</ul>` : `<p class="hint" style="margin:0">Empty. Use "Add to list" on any drink.</p>`}
    ${editable ? `<div class="panel-actions" style="justify-content:flex-start"><button class="btn small" type="button" data-colpub="${esc(c.id)}">${c.is_public ? "Make private" : "Show on my cart page"}</button><button class="btn small" type="button" data-colfilter="${esc(c.id)}">Show in drink list</button><button class="btn small danger ghost" type="button" data-coldel="${esc(c.id)}">Delete list</button></div>` : ""}
  </details>`; }).join("");
}
function wireLists(m) {
  m.querySelectorAll("[data-colpub]").forEach(b => b.onclick = async () => {
    const c = S.collections.find(x => x.id === b.dataset.colpub); if (!c) return;
    const { error } = await sb.from("collections").update({ is_public: !c.is_public }).eq("id", c.id);
    if (error) { toast("Couldn't change the list. Try again."); return; }
    c.is_public = !c.is_public; toast(c.is_public ? "List shown on your cart page" : "List is now private"); renderMain();
  });
  m.querySelectorAll("[data-colfilter]").forEach(b => b.onclick = () => { S.f = { owner: "col:" + b.dataset.colfilter, type: "", base: "", method: "", kind: "", rating: "" }; S.query = ""; $("search").value = ""; refreshView(); $("filters").open = true; $("list").scrollIntoView({ behavior: "smooth", block: "start" }); });
  m.querySelectorAll("[data-coldel]").forEach(b => b.onclick = () => {
    const c = S.collections.find(x => x.id === b.dataset.coldel); if (!c) return;
    const body = sheet("Delete list", `<p style="margin:0">Delete <b>${esc(c.name)}</b>? The drinks stay where they are; only the list goes.</p>
      <div class="panel-actions" style="justify-content:flex-start"><button class="btn small danger" type="button" id="coldel-yes">Delete list</button><button class="btn small" type="button" id="coldel-no">Keep it</button></div>`);
    $("coldel-no").onclick = closeSheet;
    $("coldel-yes").onclick = async () => {
      const { error } = await sb.from("collections").delete().eq("id", c.id);
      if (error) { toast("Couldn't delete the list. Try again."); return; }
      S.collections = S.collections.filter(x => x.id !== c.id); delete S.colItems[c.id];
      if (S.f.owner === "col:" + c.id) S.f.owner = "";
      closeSheet(); toast("List deleted"); renderFilters(); renderList(); renderMain();
    };
  });
}

// ---------- following ----------
S.follows = [];
async function loadFollows() {
  S.follows = [];
  if (!sb) return;
  const { data, error } = await sb.from("follows").select("follower, followee");
  if (error) { S.followsOff = true; return; }
  S.followsOff = false; S.follows = data || [];
}
const iFollow = id => !!uid() && S.follows.some(f => f.follower === uid() && f.followee === id);
const followersOf = id => S.follows.filter(f => f.followee === id).length;
const followingIds = () => S.follows.filter(f => f.follower === uid()).map(f => f.followee);
async function toggleFollow(id) {
  if (!uid()) { toast("Sign in to follow carts."); return; }
  if (S.followsOff) { toast("Following isn't switched on yet. The site owner needs to run social-setup.sql."); return; }
  const on = !iFollow(id);
  const { error } = on ? await sb.from("follows").upsert({ follower: uid(), followee: id }) : await sb.from("follows").delete().eq("follower", uid()).eq("followee", id);
  if (error) { toast("Couldn't update. Try again."); return; }
  if (on) S.follows.push({ follower: uid(), followee: id }); else S.follows = S.follows.filter(f => !(f.follower === uid() && f.followee === id));
  toast(on ? `Following ${lockerName(id)}` : `Stopped following ${lockerName(id)}`);
  renderFilters(); renderMain();
}

// ---------- locker pages ----------
const lockerLink = id => location.origin + location.pathname + "#locker-" + id;
function openLocker(id) {
  if (!id) return;
  if (id === uid()) { openProfile(); return; }
  S.lockerId = id; S.view = "locker"; S.confirmDelete = false; setHash("locker-" + id);
  renderList(); renderMain();
  $("main").scrollIntoView({ behavior: "smooth", block: "start" });
}
async function copyText(txt, okMsg) {
  try { await navigator.clipboard.writeText(txt); toast(okMsg); }
  catch (e) { sheet("Copy this link", `<input type="text" readonly value="${esc(txt)}" id="copy-field" style="width:100%;padding:8px;border:1px solid var(--rule);border-radius:8px">`); const f = $("copy-field"); f.focus(); f.select(); }
}
VIEWS.locker = function renderLocker() {
  const m = $("main"), id = S.lockerId;
  const ds = sorted().filter(d => d.owner === id).sort((a, b) => (score(b) - score(a)) || byName(a, b));
  const lists = S.collections.filter(c => c.owner === id && c.is_public);
  const known = !!S.profiles[id] || ds.length;
  m.innerHTML = `
    <div class="make">
      <div class="editor-top"><div><span class="label">Cart</span><h2 class="make-title">${esc(lockerName(id))}</h2>
        <div class="hint">${ds.length} drink${ds.length === 1 ? "" : "s"}${S.followsOff ? "" : ` · ${followersOf(id)} follower${followersOf(id) === 1 ? "" : "s"}`}</div></div>
        <div class="panel-actions">${uid() && !S.followsOff ? `<button class="btn small${iFollow(id) ? "" : " primary"}" type="button" id="lk-follow">${iFollow(id) ? "Following ✓" : "Follow"}</button>` : ""}<button class="btn small" type="button" id="lk-link">Copy link</button></div></div>
      ${!known ? `<p class="hint">This cart doesn't exist or has no drinks yet.</p>` : ""}
      <section class="make-sec"><div class="sec-head"><h3>Drinks</h3><span class="hint">Best rated first</span></div>
        ${ds.length ? `<ul class="plist">${ds.map(d => drinkRow(d, false)).join("")}</ul>` : `<p class="hint" style="margin:0">No drinks yet.</p>`}</section>
      ${lists.length ? `<section class="make-sec"><div class="sec-head"><h3>Lists</h3></div>${listsHtml(lists, false)}</section>` : ""}
    </div>`;
  m.querySelectorAll("[data-open]").forEach(b => b.onclick = () => selectDrink(b.dataset.open));
  if ($("lk-follow")) $("lk-follow").onclick = () => toggleFollow(id);
  $("lk-link").onclick = () => copyText(lockerLink(id), "Cart link copied");
};

// Extra sections for My cart
function profileSocialHtml() {
  const lists = myLists();
  const following = followingIds();
  return `
    <section class="make-sec" id="prof-lists">
      <div class="sec-head"><h3>My lists</h3><span class="hint">Use "Add to list" on any drink.</span></div>
      ${S.colsOff ? `<p class="hint" style="margin:0">Lists aren't switched on yet. The site owner needs to run social-setup.sql in Supabase.</p>`
        : lists.length ? listsHtml(lists, true) : `<p class="hint" style="margin:0">No lists yet. Open any drink and tap Add to list to start one, like "Thanksgiving" or "Summer patio".</p>`}
    </section>
    ${S.followsOff ? "" : `<section class="make-sec" id="prof-following">
      <div class="sec-head"><h3>Following</h3><span class="hint">${followersOf(uid())} follower${followersOf(uid()) === 1 ? "" : "s"} · <button type="button" class="linkish" id="prof-link">Copy my cart link</button></span></div>
      ${following.length ? `<div class="chips">${following.map(f => `<button type="button" class="chip-item lockerchip" data-locker="${esc(f)}">${esc(lockerName(f))}</button>`).join("")}</div>`
        : `<p class="hint" style="margin:0">You're not following anyone yet. Tap a cart name on any drink to visit it and follow.</p>`}
    </section>`}`;
}
function wireProfileSocial(m) {
  wireLists(m);
  if ($("prof-link")) $("prof-link").onclick = () => copyText(lockerLink(uid()), "Your cart link is copied");
}
// Any [data-locker] button anywhere opens that locker page.
document.addEventListener("click", e => { const b = e.target.closest("[data-locker]"); if (b) { e.preventDefault(); closeSheet(); openLocker(b.dataset.locker); } });
