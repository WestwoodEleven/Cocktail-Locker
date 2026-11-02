// The Cocktail Locker: detail. Scripts share one global scope and load in numbered order.
// ---------- detail ----------
function renderMain() {
  const m = $("main");
  document.body.classList.toggle("on-home", S.view === "home");
  if (typeof markNav === "function") markNav();
  if (VIEWS[S.view]) return VIEWS[S.view]();
  if (S.view === "edit") return renderEditor();
  if (S.view === "make") return renderMake();
  if (S.view === "lookup") {
    m.innerHTML = `<div class="scanning"><div class="glass dots">Looking up the ${esc(S.lookup ? S.lookup.q.replace(/^\s*the\s+/i, "") : "")} recipe</div>
      <div class="hint">This usually takes 5 to 10 seconds. Next time it'll be instant.</div>
      <button class="btn" type="button" id="lookup-cancel">Cancel</button></div>`;
    $("lookup-cancel").onclick = () => { S.lookup = null; S.view = "detail"; renderList(); renderMain(); };
    return;
  }
  if (S.view === "profile") return renderProfile();
  if (S.view === "scan") {
    m.innerHTML = `<div class="scanning">${S.scan && S.scan.preview ? `<img src="${S.scan.preview}" alt="Your recipe photo">` : ""}
      <div class="glass dots">Reading the recipe</div>
      <div class="hint">This usually takes 5 to 15 seconds.</div>
      <button class="btn" type="button" id="scan-cancel">Cancel</button></div>`;
    $("scan-cancel").onclick = () => { S.scan = null; S.view = "detail"; renderList(); renderMain(); };
    return;
  }
  const d = current();
  if (!S.loaded) { m.innerHTML = `<div class="blank"><div class="glass">Opening the bar…</div><div>Your saved drinks will appear here.</div></div>`; return; }
  if (!d) { m.innerHTML = `<div class="blank"><div class="glass">The shelf is empty</div><div>Add a drink with its spec for one glass. You can batch it for any crowd after.</div>${S.canWrite ? `<button class="btn primary" type="button" id="blank-new">+ Add your first drink</button>` : ""}</div>`;
    if (S.canWrite) $("blank-new").onclick = () => openEditor(null); return; }

  const perServing = liquidMl(d);
  const dil = S.prebatch ? (DILUTION[d.method] ?? 0) : 0;
  const floatMl = liquidMl(d, true);
  const floats = (d.ingredients || []).filter(i => i.float);
  const totalMl = perServing * S.servings * (1 + dil);
  const brandNote = i => !i.brand ? "" : S.backend === "supabase" && !S.bottlesOff
    ? `<span class="note brand-note">Recommended: <button type="button" class="brand-link" data-bottle="${esc(i.brand)}">${esc(i.brand)}</button></span>`
    : `<span class="note brand-note">Recommended: <b>${esc(i.brand)}</b></span>`;
  const row = (i, mult, cls) => { const s = show(i, mult, S.mode);
    return `<tr${cls ? ` class="${cls}"` : ""}><td class="q">${esc(s.q)}</td><td class="u">${esc(s.u)}</td><td class="n">${esc(i.name)}${swapBtn(d, i)}${brandNote(i)}${s.note ? `<span class="note">${esc(s.note)}</span>` : ""}</td></tr>`; };
  const rows = (d.ingredients || []).filter(i => !i.float).map(i => row(i, S.servings)).join("");
  const many = S.servings !== 1;
  const floatRows = floats.map(i => {
    const s = show(i, S.servings, S.mode), g = show(i, 1, S.mode);
    const note = many ? `${g.q}${g.u ? " " + g.u : ""} on top of each glass at serving. Keep it out of the batch.` : "";
    return `<tr class="float"><td class="q">${esc(s.q)}</td><td class="u">${esc(s.u)}</td><td class="n">${esc(i.name)} <span class="chip amber float-tag">Float</span>${swapBtn(d, i)}${brandNote(i)}${note ? `<span class="note">${esc(note)}</span>` : ""}</td></tr>`;
  }).join("");
  let waterRow = "";
  if (S.prebatch && dil > 0) {
    const w = show({ amount: perServing * dil, unit: "ml" }, S.servings, S.mode === "spec" ? "oz" : S.mode);
    waterRow = `<tr class="water"><td class="q">${esc(w.q)}</td><td class="u">${esc(w.u)}</td><td class="n">Cold water<span class="note">Stands in for ${Math.round(dil * 100)}% ${esc(d.method.toLowerCase())} dilution. Chill the batch and pour straight from the fridge.</span></td></tr>`;
  }
  const meta = [`<span class="chip amber">${esc(typeOf(d))}</span>`, `<span class="chip amber">${esc(baseOf(d))}</span>`,
    d.glass && `<span class="chip">${esc(d.glass)}</span>`, d.method && `<span class="chip">${esc(d.method)}</span>`,
    d.garnish && `<span class="chip">Garnish: ${esc(d.garnish)}</span>`, d.starter && `<span class="chip amber">Starter recipe</span>`, d.origin && `<span class="chip amber">${esc(d.origin)}</span>`, d.standard && `<span class="chip amber">Classic</span>`].filter(Boolean).join("");
  const servingsLabel = S.servings === 1 ? "1 drink" : `${fmtCount(S.servings)} drinks`;
  const fillVal = S._fillL ?? "";
  const mine = isMine(d);
  const canPhoto = S.backend === "supabase" && mine;
  const fromLine = d.standard ? `<div class="from"><b>Standard recipe</b> from the shared library</div>` : S.backend === "supabase" ? `<div class="from">From ${mine && uid() ? "<b>your cart</b>" : `<button type="button" data-locker="${esc(d.owner || "")}">${esc(lockerName(d.owner))}</button>`}</div>` : "";
  const busy = S.uploading === d.id;

  m.innerHTML = `
    <div class="hero">
    <div class="spec-top">
      <div><h2 class="drink-name">${esc(d.name)}</h2>${fromLine}<div class="meta">${meta}</div>${ratingSummary(d)}</div>
      <div class="actions"><button class="btn small primary" type="button" id="makeit-btn">Make it</button>${mockBtn(d)}<button class="btn small" type="button" id="share-btn">Share</button>${S.backend === "supabase" && uid() ? `<button class="btn small" type="button" id="list-add">Add to list</button>` : ""}<button class="btn small" type="button" id="party-add">${S.party && S.party.items.some(x => x.id === d.id) ? "In your party ✓" : "+ Party"}</button>${S.backend === "supabase" && uid() ? `<button class="btn small${isFav(d) ? " fav-on" : ""}" type="button" id="fav-btn" aria-pressed="${isFav(d)}">${isFav(d) ? "♥ Favorited" : "♡ Favorite"}</button>` : ""}${S.canWrite && !mine ? `<button class="btn small" type="button" id="copy-btn">${d.standard ? "Save to my cart" : "Copy to my cart"}</button>` : ""}${mine ? `<button class="btn small" type="button" id="edit-btn">Edit</button>${canPhoto && !d.photo ? `<button class="btn small" type="button" id="photo-add" ${busy ? "disabled" : ""}>${busy ? "Uploading…" : "Add photo"}</button>` : ""}<button class="btn small danger ghost" type="button" id="del-btn">Delete</button>` : ""}</div>
    </div>
    ${d.photo ? `<figure class="photo${busy ? " uploading" : ""}">
      <img src="${esc(photoUrl(d.photo))}" alt="${esc(d.name)}" id="photo-img">
      ${canPhoto ? (S.confirmPhoto
        ? `<div class="photo-tools"><span class="hint">Remove this photo?</span><button class="btn small danger" type="button" id="photo-rm-yes">Remove</button><button class="btn small" type="button" id="photo-rm-no">Keep</button></div>`
        : `<div class="photo-tools"><button class="btn small" type="button" id="photo-change" ${busy ? "disabled" : ""}>${busy ? "Uploading…" : "Change photo"}</button><button class="btn small ghost" type="button" id="photo-rm" ${busy ? "disabled" : ""}>Remove</button></div>`) : ""}
    </figure>` : `<figure class="photo glassfig" aria-hidden="true">${drinkPicture(d)}</figure>`}
    </div>
    <input type="file" id="photo-file" accept="image/jpeg,image/png,image/webp,image/gif,image/*" hidden>
    ${S.confirmDelete ? `<div class="confirm" role="alert"><span>Delete <b>${esc(d.name)}</b> from your cart?</span><button class="btn small danger" type="button" id="del-yes">Delete</button><button class="btn small" type="button" id="del-no">Keep it</button></div>` : ""}

    <section class="batch" aria-label="Batch size">
      <div class="ctl">
        <span class="label">How many</span>
        <div class="stepper">
          <button type="button" id="minus" aria-label="One fewer">−</button>
          <input id="servings" type="text" inputmode="decimal" value="${esc(fmtNumPlain(S.servings))}" aria-label="Number of drinks">
          <button type="button" id="plus" aria-label="One more">+</button>
        </div>
      </div>
      <div class="ctl">
        <span class="label">Or fill a container</span>
        <div class="fill"><input id="fill" type="text" inputmode="decimal" placeholder="1.75" value="${esc(fillVal)}" aria-label="Container size in liters"><span class="hint">liters</span>
          <button class="btn small" type="button" id="fill-go">Batch it</button></div>
        <span class="hint">${perServing ? "One drink is about " + fmtMl(perServing * (1 + dil)) + " ml" + (dil ? " with water" : "") + "." : "Add liquid amounts to batch by volume."}</span>
      </div>
      <div class="ctl">
        <span class="label">Show amounts in</span>
        <div class="seg" id="mode">
          <button type="button" data-m="spec" aria-pressed="${S.mode === "spec"}">As written</button>
          <button type="button" data-m="oz" aria-pressed="${S.mode === "oz"}">oz</button>
          <button type="button" data-m="ml" aria-pressed="${S.mode === "ml"}">ml</button>
        </div>
        <label class="check"><input type="checkbox" id="prebatch" ${S.prebatch ? "checked" : ""} ${d.method === "Blended" ? "disabled" : ""}>
          <span>Pre-batch with water<br><span class="hint">${d.method === "Blended" ? "Blended drinks get their water from ice." : "Adds the melt you'd get from " + (d.method ? d.method.toLowerCase() : "mixing") + " on ice, so the batch pours ready to serve."}</span></span></label>
      </div>
    </section>

    <div>
      <div class="label" style="margin-bottom:4px">Spec for ${servingsLabel}</div>
      <div style="overflow-x:auto"><table class="spec-table"><tbody>${rows}${waterRow}${floatRows}</tbody></table></div>
    </div>
    ${perServing ? `<div class="totals">
      <div class="tot"><b>${fmtLiters(totalMl)}</b><span>${floats.length ? "Batch liquid, before floats" : "Total liquid"}</span></div>
      <div class="tot"><b>${fmtOz(totalMl / ML.oz)} oz</b><span>Same, in ounces</span></div>
      ${totalMl >= 750 ? `<div class="tot"><b>${Math.round(totalMl / 750 * 10) / 10}</b><span>750 ml bottles to hold it</span></div>` : ""}
    </div>` : ""}
    ${d.notes ? `<div><div class="label notes-label">Notes</div><p class="notes">${esc(d.notes)}</p></div>` : ""}
    ${d.about ? `<div><div class="label notes-label">About</div><p class="about">${esc(d.about)}</p></div>` : ""}
    ${rateBlock(d)}
    ${notesBlock(d)}
    ${!d.standard && !mine ? `<p class="report-line">${reportBtn("drink", d.id, d.owner, d.name, "Report this drink")}</p>` : ""}
  `;

  const setServ = n => { n = Math.max(0.5, Math.min(999, Math.round(n * 10) / 10)); S.servings = n; S._fillL = null; renderMain(); };
  $("minus").onclick = () => setServ(S.servings - 1 >= 1 ? S.servings - 1 : 0.5);
  $("plus").onclick = () => setServ(S.servings < 1 ? 1 : Math.floor(S.servings) + 1);
  const si = $("servings");
  si.onchange = () => { const v = parseAmount(si.value); if (v > 0) setServ(v); else si.value = fmtNumPlain(S.servings); };
  si.onkeydown = e => { if (e.key === "Enter") si.blur(); };
  $("mode").onclick = e => { const b = e.target.closest("button[data-m]"); if (!b) return; S.mode = b.dataset.m; try { localStorage.setItem("mc-mode", S.mode); } catch (er) {} renderMain(); };
  $("prebatch").onchange = e => { S.prebatch = e.target.checked; renderMain(); };
  const doFill = () => { const L = parseFloat($("fill").value); const per = perServing * (1 + dil);
    if (!(L > 0) || !per) { toast("Enter a container size in liters, like 1.75"); return; }
    S.servings = Math.max(0.5, Math.floor(L * 1000 / per * 2) / 2); S._fillL = $("fill").value; renderMain(); };
  $("fill-go").onclick = doFill;
  $("fill").onkeydown = e => { if (e.key === "Enter") doFill(); };
  $("share-btn").onclick = () => openShare(d);
  $("makeit-btn").onclick = () => openMakeMode(d);
  if ($("mock-btn")) $("mock-btn").onclick = () => openMocktail(d);
  m.querySelectorAll("[data-swap]").forEach(b => b.onclick = () => openSwap(d, Number(b.dataset.swap)));
  $("party-add").onclick = () => { if (S.party.items.some(x => x.id === d.id)) { openParty(); return; } addToParty(d.id); toast(d.name + " added to your party plan"); renderMain(); };
  if ($("fav-btn")) $("fav-btn").onclick = () => toggleFav(d);
  m.querySelectorAll("[data-star]").forEach(b => b.onclick = () => { const n = Number(b.dataset.star); rateDrink(d, n === ratingOf(d).mine ? 0 : n); });
  if ($("rate-clear")) $("rate-clear").onclick = () => rateDrink(d, 0);
  if ($("note-save")) { $("note-save").onclick = () => saveNote(d, $("note-in").value); $("note-in").onkeydown = e => { if (e.key === "Enter") saveNote(d, $("note-in").value); }; }
  if ($("list-add")) $("list-add").onclick = () => openListsFor(d);
  if ($("copy-btn")) $("copy-btn").onclick = () => {
    const c = JSON.parse(JSON.stringify(d)); delete c.photo; delete c.owner; c.id = null;
    if (d.standard) { delete c.standard; delete c.slug; delete c.aliases; delete c.about; }
    c.notes = (c.notes ? c.notes + "\n\n" : "") + (d.standard ? "Based on the standard recipe." : "Copied from " + lockerName(d.owner) + ".");
    openEditor(c, true);
  };
  if (mine) {
    $("edit-btn").onclick = () => openEditor(d);
    $("del-btn").onclick = () => { S.confirmDelete = true; renderMain(); };
  }
  if (d.photo) $("photo-img").onerror = e => { e.target.replaceWith(Object.assign(document.createElement("div"), { className: "missing", textContent: "Photo couldn't load" })); };
  if (canPhoto) {
    const pick = () => $("photo-file").click();
    $("photo-file").onchange = ev => { const f = ev.target.files && ev.target.files[0]; if (f) setPhoto(d, f); };
    if ($("photo-add")) $("photo-add").onclick = pick;
    if ($("photo-change")) $("photo-change").onclick = pick;
    if ($("photo-rm")) $("photo-rm").onclick = () => { S.confirmPhoto = true; renderMain(); };
    if ($("photo-rm-no")) $("photo-rm-no").onclick = () => { S.confirmPhoto = false; renderMain(); };
    if ($("photo-rm-yes")) $("photo-rm-yes").onclick = () => removePhoto(d);
  }
  if (S.confirmDelete) {
    $("del-no").onclick = () => { S.confirmDelete = false; renderMain(); };
    $("del-yes").onclick = async () => { const name = d.name, photo = d.photo; const ok = await removeDrink(d.id);
      if (ok && photo && sb) sb.storage.from(BUCKET).remove([photo]).catch(() => {});
      if (ok) { S.confirmDelete = false; S.selected = null; afterData(); toast("Deleted " + name); } };
  }
}
async function prepImage(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, "image/jpeg", 0.85));
    if (blob) return blob;
  } catch (e) {}
  return file;
}
const PHOTO_ERR = { too_large: "That photo is too big. Try one under 20 MB.", unsupported_type: "That photo format isn't supported. Use a JPEG, PNG or WebP.",
  rate_limited: "Too many uploads at once. Wait a moment and try again." };
async function setPhoto(d, file) {
  S.uploading = d.id; S.confirmPhoto = false; renderMain();
  try {
    const blob = await prepImage(file);
    if (blob.size > 20 * 1024 * 1024) throw { code: "too_large" };
    const type = blob.type || "image/jpeg";
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) throw { code: "unsupported_type" };
    const ext = { "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[type] || "jpg";
    const path = `${uid()}/${d.id}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: "31536000" });
    if (error) throw error;
    const old = d.photo;
    const ok = await saveDrink(Object.assign({}, d, { photo: path }));
    if (!ok) { sb.storage.from(BUCKET).remove([path]).catch(() => {}); return; }
    if (old && old !== path) sb.storage.from(BUCKET).remove([old]).catch(() => {});
    toast(old ? "Photo replaced" : "Photo added");
  } catch (e) {
    toast(PHOTO_ERR[e && e.code] || "Couldn't upload the photo. Try again.");
  } finally { S.uploading = null; renderList(); renderMain(); }
}
async function removePhoto(d) {
  const old = d.photo; S.confirmPhoto = false;
  const rest = Object.assign({}, d); delete rest.photo;
  if (await saveDrink(rest)) { if (old) sb.storage.from(BUCKET).remove([old]).catch(() => {}); toast("Photo removed"); }
  renderList(); renderMain();
}
const fmtNumPlain = n => Number.isInteger(n) ? String(n) : String(n);

// ---------- deep links ----------
const hashId = () => { try { return decodeURIComponent(location.hash.replace(/^#/, "")); } catch (e) { return ""; } };
const drinkLink = id => location.origin + location.pathname + "#" + encodeURIComponent(id);
function setHash(id) { try { history.replaceState(null, "", id ? "#" + encodeURIComponent(id) : location.pathname); } catch (e) {} }
window.addEventListener("hashchange", () => { const id = hashId(); if (id === "") { if (S.view !== "home") openHome(); return; } if (id === "my-locker") { if (S.view !== "profile") openProfile(); return; } if (HASH_VIEWS[id]) { HASH_VIEWS[id](); return; } if (/^bottle-/.test(id)) { if (!(S.view === "bottle" && S.bottleSlug === id.slice(7))) { const b = S.bottles.find(x => x.slug === id.slice(7)); openBottle(b ? b.name : id.slice(7).replace(/-/g, " ")); } return; } if (/^locker-/.test(id)) { if (!(S.view === "locker" && S.lockerId === id.slice(7))) openLocker(id.slice(7)); return; } if (id && allDrinks().some(d => d.id === id)) { S.selected = id; S.view = "detail"; renderList(); renderMain(); } });

$("home-link").addEventListener("click", ev => {
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
  ev.preventDefault();
  S.view = "detail"; S.editing = null; S.confirmDelete = false; S.confirmPhoto = false;
  S.f = { owner: "", type: "", base: "", method: "", kind: "", rating: "" }; S.query = ""; $("search").value = "";
  S.servings = 1; S._fillL = null; S.prebatch = false;
  $("signin").hidden = true; closeShare(); $("filters").open = true;
  const first = sorted()[0]; S.selected = first ? first.id : null;
  S.view = "home"; setHash(null); renderFilters(); renderList(); renderMain();
  $("list").scrollTop = 0; window.scrollTo({ top: 0, behavior: "smooth" });
});
