// The Cocktail Locker: ingredient swaps (Claude) and step-by-step Make mode. Scripts share one global scope and load in numbered order.

// ---------- swaps ----------
function swapBtn(d, i) {
  if (S.backend !== "supabase" || !uid()) return "";
  const idx = (d.ingredients || []).indexOf(i);
  return idx < 0 ? "" : ` <button type="button" class="swap" data-swap="${idx}" title="Don't have it? Get a substitute">Swap</button>`;
}
S.swapCache = {};
function swapSheet(html) {
  let el = $("swap-modal");
  if (!el) {
    el = document.createElement("div"); el.className = "modal"; el.id = "swap-modal";
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="swap-title"><div class="sheet-head"><h3 id="swap-title">Swap</h3><button class="x" type="button" id="swap-close" aria-label="Close">×</button></div><div id="swap-body"></div></div>`;
    document.body.appendChild(el);
    el.addEventListener("click", e => { if (e.target === el) closeSwap(); });
    $("swap-close").onclick = closeSwap;
  }
  el.hidden = false; $("swap-body").innerHTML = html;
}
function closeSwap() { const el = $("swap-modal"); if (el) el.hidden = true; S.swapToken = null; }
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("swap-modal") && !$("swap-modal").hidden) closeSwap(); });
async function openSwap(d, idx) {
  const i = (d.ingredients || [])[idx]; if (!i) return;
  const key = d.id + "|" + idx;
  swapSheet("");
  $("swap-title").textContent = `Swap ${i.name}`;
  const render = st => {
    if (st.loading) return swapSheet(`<div class="scanning"><div class="glass dots">Finding substitutes</div><div class="hint">Checking what works in a ${esc(d.name)}.</div></div>`);
    if (st.error) return swapSheet(`<div class="scan-banner"><span><b>Couldn't get substitutes.</b> ${esc(st.error)}</span></div>`);
    swapSheet(`<p class="hint" style="margin:0">Out of ${esc(i.name)}? Options for this ${esc(d.name)}${inStock(savedItems()).length ? ", starting with what's in your bar" : ""}:</p>
      <div class="swaps">${st.options.map((o, k) => `<div class="swap-opt">
        <div class="swap-name"><b>${esc(o.name)}</b>${o.in_bar ? ' <span class="chip">In your bar</span>' : ""}</div>
        <div class="hint">${esc(o.amount ? `${fmtOz(Number(o.amount))} ${o.unit || "oz"}` : "")}${o.adjust ? (o.amount ? " · " : "") + esc(o.adjust) : ""}</div>
        ${o.why ? `<div class="swap-why">${esc(o.why)}</div>` : ""}
        ${S.canWrite ? `<button class="btn small" type="button" data-use="${k}">Make my version with this</button>` : ""}</div>`).join("")}</div>`);
    document.querySelectorAll("#swap-body [data-use]").forEach(b => b.onclick = () => {
      const o = st.options[Number(b.dataset.use)];
      const c = JSON.parse(JSON.stringify(d));
      ["photo", "owner", "standard", "slug", "aliases", "about"].forEach(k => delete c[k]); c.id = null;
      c.ingredients[idx] = Object.assign({}, c.ingredients[idx], { name: o.name, amount: Number(o.amount) > 0 ? Number(o.amount) : c.ingredients[idx].amount, unit: o.unit || c.ingredients[idx].unit });
      delete c.ingredients[idx].brand; delete c.ingredients[idx].kind;
      c.name = d.name + " (with " + o.name + ")";
      c.notes = [c.notes, `Swapped ${i.name} for ${o.name}.${o.adjust ? " " + o.adjust : ""}`].filter(Boolean).join("\n\n");
      closeSwap();
      openEditor(c, true);
    });
  };
  if (S.swapCache[key]) return render(S.swapCache[key]);
  const token = {}; S.swapToken = token;
  render({ loading: true });
  const { data, code, detail } = await invokeHelper({ mode: "substitute", drink: { name: d.name, method: d.method, ingredients: (d.ingredients || []).map(x => ({ amount: x.amount, unit: x.unit, name: x.name, brand: x.brand || "" })) }, index: idx, bar: barForAI() });
  if (S.swapToken !== token) return;
  let st;
  if (data && Array.isArray(data.options) && data.options.length) st = S.swapCache[key] = { options: data.options.slice(0, 3) };
  else {
    let msg = detail; try { const j = JSON.parse(detail); msg = (j.error && j.error.message) || detail; } catch (e) {}
    st = { error: SCAN_ERR[code] || msg || "Something went wrong. Try again." };
  }
  render(st);
}

// ---------- make mode ----------
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && $("make-mode") && !$("make-mode").hidden) keepAwake(true); });
function stepsFor(d) {
  const steps = [];
  const text = String(d.notes || "").split(/\n+/).filter(p => !/^(copied from|based on the standard|swapped )/i.test(p.trim())).join(" ");
  text.split(/(?<=[.!?])\s+(?=[A-Z])/).map(s => s.trim()).filter(s => s.length > 2).forEach(s => steps.push(s));
  if (!steps.length) steps.push({ Shaken: "Shake hard with ice for about 12 seconds, then strain.", Stirred: "Stir with ice for about 20 seconds, then strain.", Built: "Build over ice in the glass and give it a gentle stir.", Blended: "Blend with ice until smooth.", Thrown: "Throw between two tins with ice a few times, then strain." }[d.method] || "Mix with ice and strain.");
  if (d.glass) steps.push(`Serve in a ${d.glass.toLowerCase()} glass.`);
  const floats = (d.ingredients || []).filter(i => i.float);
  if (floats.length) steps.push(`Float ${floats.map(i => i.name).join(" and ")} on top.`);
  if (d.garnish) steps.push(`Garnish with ${d.garnish.charAt(0).toLowerCase() + d.garnish.slice(1)}.`);
  return steps;
}
function openMakeMode(d) {
  let el = $("make-mode");
  if (!el) { el = document.createElement("div"); el.id = "make-mode"; el.className = "make-mode"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  const sv = S.servings, mode = S.mode;
  const ings = (d.ingredients || []).slice().sort((a, b) => (a.float ? 1 : 0) - (b.float ? 1 : 0));
  const steps = stepsFor(d);
  el.hidden = false; document.body.classList.add("no-scroll");
  el.innerHTML = `<div class="mm-inner">
    <div class="mm-top"><div><span class="label">Make mode${sv !== 1 ? ` · ${fmtCount(sv)} drinks` : ""}</span><h2 class="mm-title">${esc(d.name)}</h2></div>
      <button class="x mm-x" type="button" id="mm-close" aria-label="Close make mode">×</button></div>
    <p class="hint mm-hint">Tap each ingredient as you pour. The screen stays on while this is open.</p>
    <ul class="mm-list">${ings.map((i, k) => { const x = show(i, sv, mode); return `<li><button type="button" class="mm-ing" data-k="${k}" aria-pressed="false"><span class="mm-q">${esc(x.q)} <small>${esc(x.u)}</small></span><span class="mm-n">${esc(i.name)}${i.float ? " <small>(float, last)</small>" : ""}${i.brand ? `<small>${esc(i.brand)}</small>` : ""}</span></button></li>`; }).join("")}</ul>
    <ol class="mm-steps">${steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
    <div class="mm-progress" id="mm-progress">0 of ${ings.length} poured</div>
    <button class="btn primary mm-done" type="button" id="mm-done">Done${uid() && S.backend === "supabase" ? " · rate it" : ""}</button>
  </div>`;
  keepAwake(true);
  const upd = () => { const n = el.querySelectorAll(".mm-ing[aria-pressed='true']").length; $("mm-progress").textContent = n === ings.length ? "All poured. Finish the steps below." : `${n} of ${ings.length} poured`; };
  el.querySelectorAll(".mm-ing").forEach(b => b.onclick = () => { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); upd(); });
  const close = () => { el.hidden = true; document.body.classList.remove("no-scroll"); keepAwake(false); };
  $("mm-close").onclick = close;
  $("mm-done").onclick = () => { close(); const r = document.querySelector(".rate"); if (r) r.scrollIntoView({ behavior: "smooth", block: "center" }); };
  el.onkeydown = e => { if (e.key === "Escape") close(); };
  $("mm-close").focus();
}
