// The Cocktail Locker: share. Scripts share one global scope and load in numbered order.
// ---------- share card ----------
const CARD = { bg: "#F5F5F2", band: "#121418", ink: "#121418", muted: "#5E626B", rule: "#D9DAD4", accent: "#B3122E", soft: "#F7E1E4", green: "#121418" };
function wrap(ctx, text, maxW) {
  const words = String(text || "").split(/\s+/).filter(Boolean), lines = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width <= maxW || !line) line = t; else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}
function loadImg(src) {
  return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
// Amounts on the card: a fraction character like ¾ is tiny in any font, so draw it like the site does:
// a raised top number, a slanted slash and the bottom number, right-aligned at x.
function drawQty(ctx, text, x, baseline, size, family, draw) {
  const m = String(text || "").match(/^(.*?)([⅛¼⅜½⅝¾⅞⅓⅔])?$/);
  const whole = m ? m[1] : String(text || ""), frac = m && m[2] ? FRAC_PARTS[m[2]] : null;
  const big = `700 ${size}px ${family}`, small = `700 ${Math.round(size * 0.7)}px ${family}`;
  ctx.font = big; const wW = ctx.measureText(whole).width;
  let fW = 0, nW = 0, dW = 0, gap = size * 0.08, slashW = size * 0.34;
  if (frac) { ctx.font = small; nW = ctx.measureText(String(frac[0])).width; dW = ctx.measureText(String(frac[1])).width; fW = (whole ? gap : 0) + nW + slashW + dW; }
  if (!draw) return wW + fW;
  let cx = x - wW - fW;
  ctx.textAlign = "left";
  ctx.font = big; ctx.fillText(whole, cx, baseline); cx += wW;
  if (frac) {
    cx += whole ? gap : 0;
    ctx.font = small; ctx.fillText(String(frac[0]), cx, baseline - size * 0.32); cx += nW;
    ctx.save(); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(2, size * 0.07); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx + slashW * 0.78, baseline - size * 0.72); ctx.lineTo(cx + slashW * 0.22, baseline + size * 0.04); ctx.stroke(); ctx.restore();
    cx += slashW;
    ctx.font = small; ctx.fillText(String(frac[1]), cx, baseline);
  }
  return wW + fW;
}
// Fraction characters in small text (notes) read better spelled out: "1½" → "1 1/2".
const plainFrac = t => String(t || "").replace(/(\d)?([⅛¼⅜½⅝¾⅞⅓⅔])/g, (m0, dgt, ch) => `${dgt ? dgt + " " : ""}${FRAC_PARTS[ch][0]}/${FRAC_PARTS[ch][1]}`);

async function buildCard(d, withPhoto) {
  try { await Promise.all(["900 80px 'Big Shoulders Display'", "700 46px 'Instrument Sans'", "600 36px 'Instrument Sans'", "400 30px 'Instrument Sans'", "600 40px 'IBM Plex Mono'"].map(f => document.fonts.load(f))); } catch (e) {}
  let photo = null;
  if (withPhoto && d.photo) { try { photo = await loadImg(photoUrl(d.photo)); } catch (e) { photo = null; } }
  const W = 1080, P = 72, inner = W - P * 2;
  const disp = "'Big Shoulders Display', 'Arial Narrow', sans-serif", body = "'Instrument Sans', Helvetica, Arial, sans-serif", mono = "'IBM Plex Mono', Menlo, monospace";
  const many = S.servings !== 1;
  const dil = S.prebatch ? (DILUTION[d.method] ?? 0) : 0;
  const per = liquidMl(d);
  const rows = (d.ingredients || []).filter(i => !i.float).map(i => ({ i, s: show(i, S.servings, S.mode) }));
  if (dil > 0) rows.push({ water: true, s: show({ amount: per * dil, unit: "ml" }, S.servings, S.mode === "spec" ? "oz" : S.mode) });
  (d.ingredients || []).filter(i => i.float).forEach(i => rows.push({ i, s: show(i, S.servings, S.mode), float: true, g: show(i, 1, S.mode) }));
  const meta = [typeOf(d), baseOf(d), d.method, d.glass].filter(Boolean).join("  ·  ");
  const from = d.standard ? "A classic" : d.fromMenu ? d.fromMenu : S.backend === "supabase" && d.owner ? "From " + lockerName(d.owner) : "";

  const layout = (ctx, draw) => {
    let y = 0;
    const photoH = photo ? 760 : 0;
    if (draw) { ctx.fillStyle = CARD.bg; ctx.fillRect(0, 0, W, ctx.canvas.height); }
    if (photo) {
      if (draw) {
        const r = Math.max(W / photo.width, photoH / photo.height), sw = W / r, sh = photoH / r;
        ctx.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2, sw, sh, 0, 0, W, photoH);
      }
      y = photoH;
    } else {
      if (draw) { ctx.fillStyle = CARD.band; ctx.fillRect(0, 0, W, 18); }
      y = 18;
    }
    y += 64;
    ctx.font = `700 24px ${body}`;
    if (draw) { ctx.fillStyle = CARD.accent; ctx.letterSpacing = "4px"; ctx.fillText("MY COCKTAIL CART", P, y); ctx.letterSpacing = "0px"; }
    y += 30;
    ctx.font = `900 104px ${disp}`;
    for (const ln of wrap(ctx, String(d.name || "").toUpperCase(), inner)) { y += 92; if (draw) { ctx.fillStyle = CARD.ink; ctx.fillText(ln, P, y); } }
    if (from) { ctx.font = `600 32px ${body}`; y += 52; if (draw) { ctx.fillStyle = CARD.green; ctx.fillText(from, P, y); } }
    if (meta) { ctx.font = `500 30px ${body}`; for (const ln of wrap(ctx, meta, inner)) { y += 46; if (draw) { ctx.fillStyle = CARD.muted; ctx.fillText(ln, P, y); } } }
    if (many) {
      y += 34;
      const label = `Batch for ${fmtCount(S.servings)} drinks` + (dil > 0 ? ", pre-diluted" : "");
      ctx.font = `700 28px ${body}`;
      const w = ctx.measureText(label).width + 36;
      if (draw) { ctx.fillStyle = CARD.soft; roundRect(ctx, P, y, w, 50, 25); ctx.fill(); ctx.fillStyle = CARD.accent; ctx.fillText(label, P + 18, y + 35); }
      y += 50;
    }
    y += 40;
    if (draw) { ctx.fillStyle = CARD.ink; ctx.fillRect(P, y, inner, 4); }
    y += 4;
    const qW = 170, uW = 96, nX = P + qW + uW, nW = inner - qW - uW;
    rows.forEach((row, k) => {
      y += 30;
      const top = y;
      if (draw) ctx.fillStyle = row.water ? CARD.green : CARD.ink;
      drawQty(ctx, row.s.q, P + qW - 14, top + 42, 46, body, draw);
      // Long units ("dashes", "barspoons") shrink to fit their column instead of running into the name.
      let uSize = 28; ctx.font = `400 ${uSize}px ${mono}`;
      while (uSize > 18 && ctx.measureText(row.s.u || "").width > uW - 12) { uSize -= 2; ctx.font = `400 ${uSize}px ${mono}`; }
      if (draw) { ctx.fillStyle = CARD.muted; ctx.fillText(row.s.u, P + qW + 4, top + 40); }
      ctx.font = `600 38px ${body}`;
      const name = row.water ? "Cold water" : row.i.name;
      let lines = wrap(ctx, name, nW - (row.float ? 130 : 0));
      lines.forEach((ln, j) => { if (draw) { ctx.fillStyle = row.water ? CARD.green : CARD.ink; ctx.fillText(ln, nX, top + 42 + j * 48); } });
      let yy = top + 42 + (lines.length - 1) * 48;
      if (row.float) {
        const lw = ctx.measureText(lines[lines.length - 1]).width;
        ctx.font = `700 22px ${body}`;
        if (draw) { ctx.fillStyle = CARD.soft; roundRect(ctx, nX + lw + 14, yy - 30, 96, 38, 19); ctx.fill(); ctx.fillStyle = CARD.accent; ctx.fillText("FLOAT", nX + lw + 30, yy - 3); }
      }
      const notes = [];
      if (row.i && row.i.brand) notes.push("Recommended: " + row.i.brand);
      if (row.float && many) notes.push(`${plainFrac(row.g.q)}${row.g.u ? " " + row.g.u : ""} on top of each glass`);
      if (row.water) notes.push(`Stands in for ${Math.round(dil * 100)}% dilution. Chill and pour.`);
      if (row.s.note) notes.push(plainFrac(row.s.note));
      ctx.font = `400 28px ${body}`;
      notes.forEach(n => wrap(ctx, n, nW).forEach(ln => { yy += 40; if (draw) { ctx.fillStyle = CARD.muted; ctx.fillText(ln, nX, yy); } }));
      y = yy + 26;
      if (draw && k < rows.length - 1) { ctx.fillStyle = CARD.rule; ctx.fillRect(P, y, inner, 2); }
      y += 2;
    });
    if (draw) { ctx.fillStyle = CARD.ink; ctx.fillRect(P, y + 8, inner, 4); }
    y += 12;
    if (d.garnish) { ctx.font = `600 30px ${body}`; y += 56; if (draw) { ctx.fillStyle = CARD.ink; ctx.fillText("Garnish: " + d.garnish, P, y); } }
    const cardNotes = d.cardNotes || d.notes;
    if (cardNotes) {
      ctx.font = `400 30px ${body}`;
      let lines = cardNotes.split(/\n+/).flatMap(par => wrap(ctx, par, inner - 24));
      const most = d.cardNotes ? 16 : 8;
      if (lines.length > most) { lines = lines.slice(0, most); lines[most - 1] += " …"; }
      y += 30;
      const top = y;
      lines.forEach(ln => { y += 44; if (draw) { const head = /^[^:]{2,40}:/.exec(ln); ctx.fillStyle = CARD.ink;
        if (d.cardNotes && head) { ctx.font = `700 30px ${body}`; ctx.fillText(head[0], P + 24, y); const w = ctx.measureText(head[0] + " ").width; ctx.font = `400 30px ${body}`; ctx.fillText(ln.slice(head[0].length).trimStart(), P + 24 + w, y); }
        else ctx.fillText(ln, P + 24, y); } });
      if (draw) { ctx.fillStyle = CARD.accent; ctx.fillRect(P, top + 10, 5, y - top + 4); }
    }
    y += 70;
    ctx.font = `500 24px ${body}`;
    if (draw) { ctx.fillStyle = CARD.muted; ctx.fillText(d.fromMenu ? "Decoded from the menu with mycocktailcart.com" : (location.host + location.pathname).replace(/\/$/, ""), P, y); }
    return y + 52;
  };
  const c = document.createElement("canvas"); c.width = W; c.height = 10;
  const H = Math.ceil(layout(c.getContext("2d"), false));
  c.height = H;
  layout(c.getContext("2d"), true);
  const blob = await new Promise((res, rej) => { try { c.toBlob(b => b ? res(b) : rej(new Error("empty")), "image/png"); } catch (e) { rej(e); } });
  return blob;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

let shareState = null;
async function openShare(d) {
  const modal = $("share-modal");
  modal.hidden = false; $("share-preview").textContent = "Making the recipe card…";
  const unitsLabel = { spec: "as written", oz: "in oz", ml: "in ml" }[S.mode];
  $("share-note").textContent = (S.servings === 1 ? "One drink" : `Batch for ${fmtCount(S.servings)} drinks`) + ", " + unitsLabel + ". Change the amounts on the recipe first to share a different batch.";
  ["share-native", "share-copy", "share-save"].forEach(id => $(id).disabled = true);
  $("share-close").focus();
  let blob;
  try { blob = await buildCard(d, true); } catch (e) { try { blob = await buildCard(d, false); } catch (e2) { blob = null; } }
  if (modal.hidden) return;
  if (!blob) { $("share-preview").textContent = "Couldn't make the image. You can still copy the link."; return; }
  const slug = (d.name || "drink").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "drink";
  const file = new File([blob], slug + ".png", { type: "image/png" });
  const url = URL.createObjectURL(blob);
  if (shareState && shareState.url) URL.revokeObjectURL(shareState.url);
  shareState = { d, blob, file, url };
  $("share-preview").innerHTML = `<img src="${url}" alt="Recipe card for ${esc(d.name)}">`;
  const canShareFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  $("share-link").hidden = !!d.fromMenu; // a decoded drink isn't saved anywhere, so there's no link to it
  $("share-native").hidden = !canShareFile;
  $("share-copy").hidden = !(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write);
  ["share-native", "share-copy", "share-save"].forEach(id => $(id).disabled = false);
}
function closeShare() { $("share-modal").hidden = true; }
$("share-close").onclick = closeShare;
$("share-modal").addEventListener("click", e => { if (e.target === $("share-modal")) closeShare(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("share-modal").hidden) closeShare(); });
$("share-native").onclick = async () => {
  const { d, file } = shareState;
  const text = d.fromMenu ? `${d.name}, ${d.fromMenu.charAt(0).toLowerCase() + d.fromMenu.slice(1)}, decoded with My Cocktail Cart\n${location.origin}` : `${d.name} from My Cocktail Cart\n${drinkLink(d.id)}`;
  try { await navigator.share({ files: [file], title: d.name, text }); }
  catch (e) { if (e && e.name !== "AbortError") toast("Couldn't open sharing. Try Save image instead."); }
};
$("share-copy").onclick = async () => {
  try { await navigator.clipboard.write([new ClipboardItem({ "image/png": shareState.blob })]); toast("Image copied. Paste it into a text or email."); }
  catch (e) { toast("Couldn't copy the image here. Try Save image."); }
};
$("share-save").onclick = () => {
  const a = document.createElement("a"); a.href = shareState.url; a.download = shareState.file.name;
  document.body.appendChild(a); a.click(); a.remove(); toast("Image saved");
};
$("share-link").onclick = async () => {
  const d = shareState ? shareState.d : current(); const link = drinkLink(d.id);
  try { await navigator.clipboard.writeText(link); toast("Link copied"); }
  catch (e) { $("share-note").textContent = link; toast("Copy the link shown above"); }
};
