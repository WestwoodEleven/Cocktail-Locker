// The Cocktail Locker: stock your bar from photos. Scripts share one global scope and load in numbered order.
// Each photo goes to Claude, which lists every bottle it can see; you review the list, then add it to your bar.

const STOCK_GROUPS = [["liquors", "Liquors & liqueurs"], ["syrups", "Syrups & sweeteners"], ["bitters", "Bitters"], ["fresh", "Fresh today (mixers)"]];
const CATEGORY_GROUP = { liquor: "liquors", liqueur: "liquors", vermouth_wine: "liquors", syrup: "syrups", bitters: "bitters", mixer: "fresh", other: "fresh" };
S.stock = { photos: [], items: [] };
let stockSeq = 0;

function openStock() {
  if (!uid()) { toast("Sign in to stock your bar from photos."); return; }
  S.view = "stock"; S.confirmDelete = false; setHash("stock-bar");
  renderList(); renderMain();
  $("main").scrollIntoView({ behavior: "smooth", block: "start" });
}
HASH_VIEWS["stock-bar"] = openStock;

// Where an identified bottle stands against your current bar.
function stockStatus(it) {
  if (it.group === "fresh") return S.fresh.some(x => ingKey(x) === ingKey(it.name)) ? "have" : "new";
  const list = S.bar[it.group] || [];
  const nk = ingKey(it.name), bk = ingKey(it.brand);
  const same = list.find(x => ingKey(itemName(x)) === nk && ingKey(x.brand || "") === bk);
  if (same) return same.out ? "restock" : "have";
  if (bk && list.some(x => ingKey(itemName(x)) === nk && !x.brand)) return "brand";
  return "new";
}
const STATUS_TEXT = { have: "Already in your bar", restock: "Marks it back in stock", brand: "Adds the brand to your bottle", new: "" };

async function thumbOf(dataUrl) {
  const img = new Image(); img.src = dataUrl; await img.decode();
  const s = Math.min(1, 240 / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7);
}
async function prepBottlePhoto(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
function mergeBottles(photo, bottles) {
  bottles.forEach(b => {
    const group = CATEGORY_GROUP[b.category] || "fresh";
    const key = ingKey(b.name) + "|" + ingKey(b.brand);
    let it = S.stock.items.find(x => x.key === key);
    if (!it) {
      it = { id: "si" + (++stockSeq), key, name: b.name, brand: b.brand || "", group, confidence: b.confidence, count: 0, photos: new Set() };
      it.include = stockStatus(it) !== "have";
      S.stock.items.push(it);
    }
    if (!it.photos.has(photo.id)) { it.count += b.count || 1; it.photos.add(photo.id); }
    if (b.confidence === "high" || (b.confidence === "medium" && it.confidence === "low")) it.confidence = b.confidence;
  });
}
const stockQueue = [];
let stockRunning = 0;
function pumpStock() {
  while (stockRunning < 2 && stockQueue.length) {
    const photo = stockQueue.shift(); stockRunning++;
    readPhoto(photo).finally(() => { stockRunning--; pumpStock(); });
  }
}
async function readPhoto(photo) {
  photo.status = "reading"; refreshStock();
  const { data, code, detail } = await invokeHelper({ mode: "bottles", image: photo.data.split(",")[1], mediaType: "image/jpeg" });
  if (!S.stock.photos.includes(photo)) return; // started over
  if (data && Array.isArray(data.bottles)) {
    photo.status = "done"; photo.found = data.bottles.length; photo.note = data.note || "";
    mergeBottles(photo, data.bottles);
    photo.data = null; // free memory; the thumbnail stays
  } else {
    let msg = detail; try { const j = JSON.parse(detail); msg = (j.error && j.error.message) || detail; } catch (e) {}
    photo.status = "error"; photo.error = SCAN_ERR[code] || msg || "Couldn't read this photo.";
  }
  refreshStock();
}
async function addStockPhotos(files) {
  for (const f of [...files].slice(0, 12)) {
    const photo = { id: "p" + (++stockSeq), status: "preparing", thumb: "", data: "" };
    S.stock.photos.push(photo); refreshStock();
    try { photo.data = await prepBottlePhoto(f); photo.thumb = await thumbOf(photo.data); stockQueue.push(photo); }
    catch (e) { photo.status = "error"; photo.error = "Couldn't open this photo. Try a JPEG or PNG."; }
    refreshStock();
  }
  pumpStock();
}

// Re-render without losing the box someone is typing in.
function refreshStock() {
  if (S.view !== "stock") return;
  const a = document.activeElement, id = a && a.id, pos = a && typeof a.selectionStart === "number" ? a.selectionStart : null;
  renderMain();
  if (id && $(id)) { const el = $(id); el.focus(); if (pos != null) try { el.setSelectionRange(pos, pos); } catch (e) {} }
}

VIEWS.stock = function renderStock() {
  const m = $("main"), st = S.stock;
  const busy = st.photos.some(p => p.status === "reading" || p.status === "preparing");
  const items = st.items.slice().sort((a, b) => STOCK_GROUPS.findIndex(g => g[0] === a.group) - STOCK_GROUPS.findIndex(g => g[0] === b.group) || a.name.localeCompare(b.name));
  const chosen = items.filter(i => i.include).length;
  const photoCard = p => `<div class="stock-photo ${p.status}">
      ${p.thumb ? `<img src="${p.thumb}" alt="">` : `<div class="ph"></div>`}
      <span class="stock-state">${p.status === "done" ? `${p.found} found` : p.status === "error" ? "Couldn't read" : p.status === "reading" ? `<span class="dots">Reading</span>` : `<span class="dots">Preparing</span>`}</span>
      ${p.status === "error" ? `<div class="stock-err">${esc(p.error)}${p.data ? ` <button type="button" class="linkish" data-retry="${p.id}">Try again</button>` : ""}</div>` : ""}
      ${p.note ? `<div class="stock-err">${esc(p.note)}</div>` : ""}</div>`;
  const row = it => {
    const s = stockStatus(it);
    return `<div class="stock-row${it.include ? "" : " off"}">
      <input type="checkbox" id="inc-${it.id}" data-inc="${it.id}" ${it.include ? "checked" : ""} aria-label="Add ${esc(it.name)}">
      <div class="stock-fields">
        <input type="text" id="nm-${it.id}" data-nm="${it.id}" value="${esc(it.name)}" aria-label="Name" maxlength="60">
        <input type="text" id="bd-${it.id}" data-bd="${it.id}" value="${esc(it.brand)}" placeholder="Brand" aria-label="Brand" maxlength="80">
        <select id="gp-${it.id}" data-gp="${it.id}" aria-label="Where it goes">${STOCK_GROUPS.map(([v, l]) => `<option value="${v}" ${it.group === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      </div>
      <div class="stock-meta">${it.count > 1 ? `<span class="chip">×${it.count}</span>` : ""}${it.confidence !== "high" ? `<span class="chip amber" title="The label was hard to read">${it.confidence === "low" ? "Guess, check it" : "Check name"}</span>` : ""}${STATUS_TEXT[s] ? `<span class="hint">${STATUS_TEXT[s]}</span>` : ""}</div>
    </div>`;
  };
  m.innerHTML = `
    <div class="make">
      <div class="editor-top"><div><span class="label">My bar</span><h2 class="make-title">Stock my bar from photos</h2></div>
        <button class="btn small" type="button" id="stock-close">Back to drinks</button></div>
      <p class="hint" style="margin:0">Photograph your shelves, a few bottles at a time with labels facing the camera. We list every bottle we can read, and you check the list before anything is added. Each photo uses one of your daily AI requests.</p>
      <div class="panel-actions" style="justify-content:flex-start">
        <button class="btn primary" type="button" id="stock-pick">${st.photos.length ? "Add more photos" : "Choose or take photos"}</button>
        ${st.photos.length ? `<button class="btn" type="button" id="stock-reset">Start over</button>` : ""}
      </div>
      ${st.photos.length ? `<div class="stock-photos">${st.photos.map(photoCard).join("")}</div>` : ""}
      ${items.length ? `
      <section class="make-sec">
        <div class="sec-head"><h3>Found <span class="count">${items.length}</span></h3><span class="hint">Untick anything you don't want. Edit names or brands if a label was misread.</span></div>
        <div class="stock-list">${items.map(row).join("")}</div>
        <div class="form-actions"><button class="btn primary" type="button" id="stock-add" ${chosen ? "" : "disabled"}>${busy ? "Still reading… " : ""}Add ${chosen} to my bar</button></div>
      </section>` : st.photos.length && !busy ? `<p class="hint">No bottles found yet. Try a closer photo with the labels facing the camera.</p>` : ""}
    </div>`;
  $("stock-close").onclick = () => { S.view = "detail"; setHash(null); renderList(); renderMain(); };
  $("stock-pick").onclick = () => $("stock-file").click();
  if ($("stock-reset")) $("stock-reset").onclick = () => { S.stock = { photos: [], items: [] }; stockQueue.length = 0; renderMain(); };
  m.querySelectorAll("[data-retry]").forEach(b => b.onclick = () => { const p = st.photos.find(x => x.id === b.dataset.retry); if (p) { p.status = "preparing"; stockQueue.push(p); pumpStock(); refreshStock(); } });
  const find = id => st.items.find(x => x.id === id);
  m.querySelectorAll("[data-inc]").forEach(cb => cb.onchange = () => { find(cb.dataset.inc).include = cb.checked; refreshStock(); });
  m.querySelectorAll("[data-nm]").forEach(x => x.oninput = () => { find(x.dataset.nm).name = x.value; });
  m.querySelectorAll("[data-bd]").forEach(x => x.oninput = () => { find(x.dataset.bd).brand = x.value; });
  m.querySelectorAll("[data-nm], [data-bd]").forEach(x => x.onchange = () => refreshStock());
  m.querySelectorAll("[data-gp]").forEach(x => x.onchange = () => { find(x.dataset.gp).group = x.value; refreshStock(); });
  if ($("stock-add")) $("stock-add").onclick = applyStock;
};

function applyStock() {
  const chosen = S.stock.items.filter(i => i.include && i.name.trim());
  if (!chosen.length) return;
  const touched = new Set();
  let added = 0, restocked = 0, branded = 0;
  chosen.forEach(it => {
    const name = it.name.trim().slice(0, 60), brand = it.brand.trim().slice(0, 80);
    if (it.group === "fresh") { if (!S.fresh.some(x => ingKey(x) === ingKey(name))) { S.fresh.push(name); added++; touched.add("fresh"); } return; }
    const list = S.bar[it.group];
    const nk = ingKey(name), bk = ingKey(brand);
    const same = list.find(x => ingKey(itemName(x)) === nk && ingKey(x.brand || "") === bk);
    if (same) { if (same.out) { same.out = false; restocked++; touched.add(it.group); } return; }
    const unbranded = bk && list.find(x => ingKey(itemName(x)) === nk && !x.brand);
    if (unbranded) { unbranded.brand = brand; unbranded.out = false; branded++; touched.add(it.group); return; }
    list.push({ name, brand, out: false }); added++; touched.add(it.group);
  });
  touched.forEach(k => afterItems(k));
  const parts = [added && `${added} added`, branded && `${branded} brand${branded === 1 ? "" : "s"} filled in`, restocked && `${restocked} back in stock`].filter(Boolean);
  toast(parts.length ? "Your bar: " + parts.join(", ") : "Everything was already in your bar");
  S.stock = { photos: [], items: [] };
  openProfile();
  setTimeout(() => { const b = $("prof-bar"); if (b) b.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
}

$("stock-btn").onclick = openStock;
$("stock-file").onchange = ev => { const f = ev.target.files; if (f && f.length) addStockPhotos(f); ev.target.value = ""; };
document.addEventListener("click", e => { if (e.target.closest("[data-stock-open]")) openStock(); });
