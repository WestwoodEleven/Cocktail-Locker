// The Cocktail Locker: scan. Scripts share one global scope and load in numbered order.
// ---------- scan a recipe photo ----------
const SCAN_ERR = {
  signed_out: "Your sign-in expired. Sign in again to scan recipes.",
  daily_limit: "You've used today's AI allowance for scans and drink ideas. Try again tomorrow.",
  no_recipe: "Couldn't find a cocktail recipe in that photo. Try a closer, sharper shot.",
  too_large: "That photo is too big. Try a smaller one.",
  bad_image: "That photo format isn't supported. Use a JPEG or PNG.",
  not_configured: "Recipe scanning isn't switched on yet. The site owner needs to add the Claude API key.",
  bad_key: "Anthropic rejected the Claude API key. Check that the full key was pasted into the ANTHROPIC_API_KEY secret.",
  key_not_allowed: "The Claude API key doesn't have permission to do this. Create a new key in the Anthropic Console.",
  no_credit: "The Anthropic account is out of credit. Add credit under Billing in the Anthropic Console.",
  bad_model: "The Claude model name isn't recognized. Remove or fix the RECIPE_MODEL secret in Supabase.",
  busy: "Claude is busy right now. Try again in a minute.",
  not_deployed: "Recipe scanning isn't set up yet: Supabase has no function named read-recipe.",
  unreachable: "Couldn't reach the recipe scanner. In Supabase, check that read-recipe has Verify JWT turned off, then try again.",
  crashed: "The recipe scanner hit an error. Check read-recipe's Logs in Supabase."
};
async function shrinkForScan(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
function recipeToDrink(r) {
  const okUnit = u => ["oz", "ml", "cl", "barspoon", "tsp", "tbsp", "dash", "each"].includes(u) ? u : "oz";
  const ings = (r.ingredients || []).filter(i => i && String(i.name || "").trim()).map(i => {
    const out = { amount: Number(i.amount) > 0 ? Math.round(Number(i.amount) * 1000) / 1000 : "", unit: okUnit(i.unit), name: String(i.name).trim().slice(0, 80) };
    if (i.brand && String(i.brand).trim()) out.brand = String(i.brand).trim().slice(0, 80);
    if (i.float) out.float = true;
    return out;
  });
  return {
    id: null, name: String(r.name || "").trim().slice(0, 80),
    glass: String(r.glass || "").trim().slice(0, 40), garnish: String(r.garnish || "").trim().slice(0, 80),
    method: METHODS.includes(r.method) ? r.method : "Shaken",
    type: TYPES.includes(r.type) ? r.type : "", base: BASES.includes(r.base) ? r.base : "",
    notes: String(r.notes || "").trim().slice(0, 1500),
    ingredients: ings.length ? ings : [{ amount: "", unit: "oz", name: "" }]
  };
}
async function scanRecipe(file) {
  if (!sb || !S.session) { toast("Sign in to scan recipes."); return; }
  let dataUrl;
  try { dataUrl = await shrinkForScan(file); }
  catch (e) { toast("Couldn't open that photo. Try a JPEG or PNG."); return; }
  const token = {};
  S.scan = { preview: dataUrl, token }; S.view = "scan"; S.scanNote = null;
  renderList(); renderMain(); $("main").scrollIntoView({ behavior: "smooth", block: "start" });
  let code = "", recipe = null, detail = "";
  try {
    const { data, error } = await sb.functions.invoke("read-recipe", { body: { image: dataUrl.split(",")[1], mediaType: "image/jpeg" } });
    if (error) {
      const resp = error.context;
      if (resp && typeof resp.json === "function") {
        if (resp.status === 404) code = "not_deployed";
        else { try { const j = await resp.json(); code = j.error || ""; detail = j.detail || ""; } catch (e2) {} }
        if (!code) detail = detail || ("HTTP " + resp.status);
        if (!code && resp.status === 401) code = "signed_out";
        if (!code && resp.status >= 500) code = "crashed";
      } else code = error.name === "FunctionsFetchError" ? "unreachable" : "";
    } else recipe = data && data.recipe;
  } catch (e) { code = ""; detail = String(e && e.message || e); }
  if (!S.scan || S.scan.token !== token) return;
  S.scan = null;
  if (!recipe) { S.view = "detail"; renderList(); if (SCAN_ERR[code]) renderMain(); if (SCAN_ERR[code]) toast(SCAN_ERR[code]);
    else showScanError(code, detail);
    return; }
  openEditor(recipeToDrink(recipe), false, { warning: String(recipe.warning || "").trim() });
}
function showScanError(code, detail) {
  let msg = detail;
  try { const j = JSON.parse(detail); msg = (j.error && (j.error.message || j.error.type)) || detail; } catch (e) {}
  $("main").innerHTML = `<div class="blank"><div class="glass">Couldn't read that photo</div>
    <div>Here's what came back, so it can be fixed:</div>
    <div class="hint" style="max-width:60ch;word-break:break-word">${esc([code, msg].filter(Boolean).join(": ") || "No details were returned.")}</div>
    <button class="btn" type="button" id="scan-err-ok">Back to drinks</button></div>`;
  $("scan-err-ok").onclick = () => { S.view = "detail"; renderMain(); };
}
$("scan-btn").onclick = () => $("scan-file").click();
$("scan-file").onchange = ev => { const f = ev.target.files && ev.target.files[0]; ev.target.value = ""; if (f) scanRecipe(f); };
