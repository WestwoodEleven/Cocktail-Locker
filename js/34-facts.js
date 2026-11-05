// ---------- strength (ABV) and cost per drink ----------
// Two links under a recipe's totals: "~16% ABV" and "~$2.90 a drink" (or "the batch"), each opening a breakdown.
// Built from small tables of typical proofs and US prices. Your own bottle prices (My Bottles) replace the typical ones.

// [pattern on "name brand", ABV]. First match wins; brands before generic names.
const PROOFS = [
  [/smith ?& ?cross|navy strength|overproof|\b151\b|wray ?& ?nephew/, 0.57], [/plantation o\.?f\.?t\.?d|\boftd\b/, 0.69],
  [/wild turkey 101|rittenhouse|bottled in bond|\bbib\b|old grand-dad 114|booker/, 0.50], [/buffalo trace|maker'?s mark|bulleit/, 0.45],
  [/green chartreuse|chartreuse verte/, 0.55], [/yellow chartreuse/, 0.40], [/absinthe|pastis|pernod/, 0.55], [/herbsaint/, 0.45],
  [/cointreau|grand marnier|pierre ferrand|dry cura[cç]ao/, 0.40], [/triple sec/, 0.30], [/cura[cç]ao|blue cura/, 0.25], [/orange liqueur/, 0.40],
  [/campari/, 0.24], [/aperol/, 0.11], [/select aperitivo/, 0.175], [/cynar/, 0.165], [/averna/, 0.29], [/montenegro/, 0.23], [/nonino/, 0.35],
  [/ramazzotti/, 0.30], [/fernet/, 0.39], [/amaro|amari/, 0.28], [/b[eé]n[eé]dictine/, 0.40], [/drambuie/, 0.40], [/st[- ]?germain|elderflower liqueur/, 0.20],
  [/maraschino|luxardo/, 0.32], [/cr[eè]me de violette|violette/, 0.16], [/cr[eè]me de cacao/, 0.25], [/cr[eè]me de (cassis|m[uû]re|framboise|p[eê]che)/, 0.16],
  [/amaretto|disaronno/, 0.28], [/kahl[uú]a|coffee liqueur|mr ?black/, 0.20], [/irish cream|baileys/, 0.17], [/frangelico|hazelnut liqueur/, 0.20],
  [/falernum/, 0.11], [/allspice dram|pimento dram/, 0.22], [/midori|melon liqueur/, 0.20], [/limoncello/, 0.30], [/sloe gin/, 0.26],
  [/lillet|cocchi americano|kina/, 0.17], [/sweet vermouth|rosso|vermouth di torino|carpano|antica formula|punt e mes/, 0.165], [/dry vermouth|blanc vermouth|bianco|dolin|noilly/, 0.175], [/vermouth/, 0.17],
  [/fino|manzanilla/, 0.15], [/amontillado|oloroso|sherry|pedro xim/, 0.18], [/port\b|tawny/, 0.20], [/madeira|marsala/, 0.18],
  [/prosecco|champagne|cava|cr[eé]mant|sparkling wine|brut/, 0.12], [/red wine|white wine|ros[eé] wine|\bwine\b/, 0.13], [/\bbeer\b|lager|\bale\b|stout|cider/, 0.05], [/sake/, 0.15],
  [/bitters/, 0.40], [/vodka|gin\b|genever|rum\b|rhum|cacha[cç]a|tequila|mezcal|whiske?y|bourbon|\brye\b|scotch|cognac|armagnac|brandy|calvados|applejack|pisco|grappa|aquavit|akvavit|soju|baijiu|shochu/, 0.40]
];
// Things with no alcohol, checked before the table (so "rum-raisin syrup" and "gin-infused tonic" don't count).
const NO_ALCOHOL = /juice|syrup|soda|tonic|water|ginger beer|ginger ale|cola|egg|cream(?! liqueur)|milk|coffee(?! liqueur)|espresso|cold brew|pur[eé]e|honey|sugar|salt|saline|agave nectar|nectar|lemonade|tea\b|shrub|cordial|grenadine|orgeat|aquafaba|zero[- ]proof|non[- ]?alcoholic|n\/a|mint|basil|cucumber|\bberries\b/;
function abvOf(i) {
  const t = `${i.name || ""} ${i.brand || ""}`.toLowerCase();
  if (/bitters/.test(t)) return { abv: 0.40, known: true };
  if (NO_ALCOHOL.test(t) && !/liqueur|vermouth|amaro|wine|spirit/.test(t)) return { abv: 0, known: true };
  for (const [re, v] of PROOFS) if (re.test(t)) return { abv: v, known: true };
  const k = typeof guessKind === "function" ? guessKind(i.name || "") : "";
  if (k === "Spirit") return { abv: 0.40, known: false };
  if (k === "Liqueur") return { abv: 0.25, known: false };
  if (k === "Vermouth & wine") return { abv: 0.16, known: false };
  return { abv: 0, known: true };
}
// ml of one ingredient for one drink, counting an egg white as about an ounce (other "each" items add no volume).
const factMl = i => i.unit === "each" ? (/egg/i.test(i.name || "") ? (Number(i.amount) || 0) * ML.oz : 0) : ingMl(i);
// How much ice melts into a drink as it's made, as a share of the drink before ice (rough rules of thumb;
// larger than DILUTION in 01-core, which is the water added to a pre-batch that's then poured over fresh ice).
const MELT = { Shaken: 0.40, Stirred: 0.30, Built: 0.20, Blended: 0.60, Swizzled: 0.45, Thrown: 0.25 };
const STD_DRINK_ML = 17.74; // US standard drink: 0.6 oz of pure alcohol
function strengthOf(d) {
  const ings = (d.ingredients || []).filter(i => i.name);
  let vol = 0, alc = 0, guessed = [];
  const rows = ings.map(i => {
    const ml = factMl(i), a = abvOf(i);
    vol += ml; alc += ml * a.abv; if (!a.known && a.abv) guessed.push(i.name);
    return { i, ml, abv: a.abv, alc: ml * a.abv, known: a.known };
  });
  if (!vol || !alc) return null;
  const dil = MELT[d.method] != null ? MELT[d.method] : 0.25;
  const water = vol * dil;
  return { rows, vol, alc, water, abv: alc / (vol + water), std: alc / STD_DRINK_ML, guessed, dil };
}

// ---------- typical prices ----------
// Bottles: [pattern, dollars for a 750 ml bottle]. Fresh and pantry items: [pattern, dollars per oz, how to describe it].
const BOTTLE_PRICES = [
  [/green chartreuse|yellow chartreuse|chartreuse/, 65], [/absinthe/, 65], [/single malt|islay|laphroaig|lagavulin|ardbeg/, 60], [/smith ?& ?cross/, 33],
  [/cointreau|grand marnier|pierre ferrand|dry cura[cç]ao/, 40], [/triple sec/, 12], [/cura[cç]ao/, 18], [/orange liqueur/, 40],
  [/campari/, 30], [/aperol/, 25], [/cynar/, 30], [/averna/, 35], [/montenegro/, 33], [/nonino/, 50], [/fernet/, 35], [/amaro/, 35],
  [/b[eé]n[eé]dictine|drambuie/, 40], [/st[- ]?germain|elderflower/, 35], [/maraschino|luxardo/, 35], [/violette/, 30], [/cr[eè]me de/, 25],
  [/amaretto|disaronno/, 28], [/kahl[uú]a|coffee liqueur/, 22], [/mr ?black/, 32], [/irish cream|baileys/, 25], [/falernum/, 20], [/allspice dram|pimento dram/, 30],
  [/lillet|cocchi/, 22], [/carpano|antica formula/, 35], [/sweet vermouth|rosso|punt e mes/, 18], [/dry vermouth|blanc|bianco|vermouth/, 16],
  [/sherry|fino|amontillado|oloroso/, 18], [/port\b/, 20], [/champagne/, 45], [/prosecco|cava|sparkling wine|cr[eé]mant/, 15], [/\bwine\b/, 14],
  [/mezcal/, 40], [/reposado|a[nñ]ejo/, 38], [/tequila/, 30], [/cognac|armagnac/, 45], [/calvados|applejack/, 32], [/pisco/, 28], [/brandy/, 20], [/cacha[cç]a/, 25],
  [/aged rum|dark rum|añejo rum|jamaica|demerara rum|agricole|blackstrap/, 28], [/rum|rhum/, 22],
  [/scotch/, 30], [/japanese whisk/, 55], [/irish whisk/, 28], [/bourbon|rye|whiske?y/, 32], [/gin\b|genever/, 26], [/vodka/, 20]
];
const BITTERS_PER_DASH = 0.06;
const PANTRY_PRICES = [
  [/lime/, 0.40, "about 1 oz of juice per lime"], [/lemon/, 0.40, "about 1½ oz of juice per lemon"], [/grapefruit juice/, 0.25, "fresh grapefruit"],
  [/orange juice|blood orange/, 0.30, "fresh oranges"], [/pineapple juice/, 0.10, "carton"], [/cranberry|tomato|apple juice|pomegranate juice/, 0.10, "carton"],
  [/honey[- ]ginger/, 0.25, "homemade"], [/honey/, 0.15, "homemade"], [/simple|sugar syrup|rich|demerara|cane syrup|gomme|agave/, 0.06, "homemade"],
  [/cinnamon syrup|ginger syrup|raspberry syrup|vanilla syrup/, 0.15, "homemade"], [/grenadine/, 0.25, "homemade or store-bought"], [/orgeat/, 0.85, "store-bought"],
  [/cream of coconut/, 0.30, "can"], [/coconut/, 0.20, "can"], [/ginger beer|ginger ale/, 0.12, "about $1.40 a can"], [/tonic/, 0.13, "about $1.50 a bottle"],
  [/cola|lemon[- ]lime soda|grapefruit soda/, 0.06, "can"], [/soda water|club soda|seltzer|sparkling water|\bwater\b/, 0.02, "bottle"],
  [/espresso|coffee|cold brew/, 0.50, "a shot"], [/worcestershire|hot sauce|tabasco|pepper|spice/, 0.30, "a dash or two"], [/cream|milk|half and half/, 0.12, "carton"], [/saline|salt/, 0, "pennies"]
];
const EACH_PRICES = [[/pinch|salt/, 0.01], [/egg/, 0.40], [/lime/, 0.40], [/lemon/, 0.50], [/mint/, 0.05], [/sugar cube/, 0.02]];
// Your own price from My Bottles, if you've entered one.
function yourPrice(i) {
  if (typeof savedItems !== "function") return null;
  const k = ingKey(i.name), bk = i.brand ? ingKey(i.brand) : "";
  for (const x of savedItems()) {
    const v = barItem(x);
    if (!v.price) continue;
    const vn = ingKey(v.name), vb = v.brand ? ingKey(v.brand) : "";
    if ((bk && vb && sameThing(vb, bk)) || sameThing(vn, k) || (vb && sameThing(vb, k))) return { price: v.price, ml: v.size || 750, label: itemLabel(v) };
  }
  return null;
}
function costOf(d) {
  const ings = (d.ingredients || []).filter(i => i.name);
  let total = 0; const missing = [];
  const rows = ings.map(i => {
    const t = `${i.name} ${i.brand || ""}`.toLowerCase(), ml = factMl(i), a = Number(i.amount) || 0;
    if (/bitters/.test(t)) { const dashes = i.unit === "dash" ? a : ml / ML.dash; const c = dashes * BITTERS_PER_DASH; total += c; return { i, cost: c, how: "a bottle lasts hundreds of dashes" }; }
    const mine = abvOf(i).abv > 0 ? yourPrice(i) : null;
    if (mine) { const c = ml / mine.ml * mine.price; total += c; return { i, cost: c, bottle: `$${fmtMoney(mine.price)} · ${mine.ml} ml`, perOz: mine.price / mine.ml * ML.oz, yours: true }; }
    if (abvOf(i).abv > 0) {
      const hit = BOTTLE_PRICES.find(([re]) => re.test(t));
      if (!hit) { missing.push(i.name); return { i, cost: null }; }
      const c = ml / 750 * hit[1]; total += c;
      return { i, cost: c, bottle: `$${hit[1]} · 750 ml`, perOz: hit[1] / 750 * ML.oz, typical: true };
    }
    if (i.unit === "each") {
      const e = EACH_PRICES.find(([re]) => re.test(t));
      if (!e) { missing.push(i.name); return { i, cost: null }; }
      const c = a * e[1]; total += c; return { i, cost: c, how: "each" };
    }
    const p = PANTRY_PRICES.find(([re]) => re.test(t));
    if (!p) { missing.push(i.name); return { i, cost: null }; }
    const c = ml / ML.oz * p[1]; total += c;
    return { i, cost: c, how: p[2] };
  });
  const priced = rows.filter(r => r.cost != null).length;
  if (!priced || priced < rows.length / 2) return null;
  return { rows, total, missing };
}
const fmtMoney = v => v >= 10 ? Math.round(v).toLocaleString() : v.toFixed(2);
const fmtPct = v => { const p = v * 100; return p < 10 ? p.toFixed(1).replace(/\.0$/, "") : String(Math.round(p)); };

// The two links under the totals.
function factsHtml(d) {
  const s = strengthOf(d), c = costOf(d), n = S.servings || 1;
  const parts = [];
  if (s) parts.push(`<button type="button" class="linkish batch-link" id="abv-open" aria-haspopup="dialog">~${fmtPct(s.abv)}% ABV</button>`);
  if (c) parts.push(`<button type="button" class="linkish batch-link" id="cost-open" aria-haspopup="dialog">~$${fmtMoney(c.total * n)}${c.missing.length ? "+" : ""} ${n === 1 ? "a drink" : "the batch"}</button>`);
  return parts.length ? `<div class="facts-line">${parts.join(`<span class="dot" aria-hidden="true">·</span>`)}</div>` : "";
}
function wireFacts(d) {
  if ($("abv-open")) $("abv-open").onclick = () => openStrength(d);
  if ($("cost-open")) $("cost-open").onclick = () => openCost(d);
}
const ozTxt = ml => `${fmtOz(Math.round(ml / ML.oz * 4) / 4)} oz`;
function openStrength(d) {
  const s = strengthOf(d); if (!s) return;
  const proof = r => r.abv ? String(Math.round(r.abv * 200)) : "0";
  const zero = s.rows.filter(r => !r.abv), boozy = s.rows.filter(r => r.abv);
  const glasses = s.std / 1, wine = s.alc / (5 * ML.oz * 0.12);
  sheet("Strength", `<div class="facts-sheet">
    <div class="fs-big">~${fmtPct(s.abv)}% ABV <span>in the glass</span></div>
    <table class="fs-table"><thead><tr><th>Ingredient</th><th>Amount</th><th>Proof</th><th>Alcohol</th></tr></thead><tbody>
      ${boozy.map(r => `<tr><td>${esc(r.i.name)}${r.i.brand ? ` (${esc(r.i.brand)})` : ""}${r.known ? "" : " *"}</td><td>${ozTxt(r.ml)}</td><td>${proof(r)}</td><td>${(r.alc / ML.oz).toFixed(2)} oz</td></tr>`).join("")}
      ${zero.length ? `<tr><td>${esc(zero.map(r => r.i.name).join(", "))}</td><td>${ozTxt(zero.reduce((a, r) => a + r.ml, 0))}</td><td>0</td><td>0</td></tr>` : ""}
      <tr class="sum"><td><b>Before ice</b></td><td>${ozTxt(s.vol)}</td><td></td><td><b>${(s.alc / ML.oz).toFixed(2)} oz</b></td></tr>
      <tr><td>+ melted ice (${esc((d.method || "mixed").toLowerCase())})</td><td>~${ozTxt(s.water)}</td><td></td><td></td></tr>
      <tr class="sum"><td><b>In the glass</b></td><td>~${ozTxt(s.vol + s.water)}</td><td></td><td><b>~${fmtPct(s.abv)}%</b></td></tr>
    </tbody></table>
    <p class="fs-std"><b>${glasses.toFixed(1)} standard drink${Math.abs(glasses - 1) < 0.05 ? "" : "s"}</b> <span class="hint">(US: 0.6 oz of alcohol each)</span></p>
    <p class="hint" style="margin:0">About as much alcohol as ${wine < 0.75 ? "half a glass" : wine < 1.25 ? "a glass" : wine < 1.75 ? "a glass and a half" : Math.round(wine) + " glasses"} of wine. Stirred drinks melt less ice than shaken ones, so they come out stronger.</p>
    <p class="fs-fine">Uses the brand's proof when the recipe names one, otherwise a typical proof${s.guessed.length ? " (* = our guess)" : ""}. An estimate, not a lab result.</p>
  </div>`);
}
function openCost(d) {
  const c = costOf(d); if (!c) return;
  const n = S.servings || 1;
  const anyTypical = c.rows.some(r => r.typical);
  sheet("Cost", `<div class="facts-sheet">
    <div class="fs-big">~$${fmtMoney(c.total)}${c.missing.length ? "+" : ""} <span>a drink</span></div>
    <table class="fs-table"><thead><tr><th>Ingredient</th><th>Bottle</th><th>This drink</th></tr></thead><tbody>
      ${c.rows.map(r => `<tr><td>${esc(r.i.name)}${r.i.brand ? ` (${esc(r.i.brand)})` : ""}</td>
        <td>${r.cost == null ? `<span class="hint">no price</span>` : r.bottle ? `${esc(r.bottle)} <span class="fs-tag${r.yours ? " yours" : ""}">${r.yours ? "your price" : "typical"}</span>` : `<span class="hint">${esc(r.how || "")}</span>`}</td>
        <td>${r.cost == null ? "–" : "$" + r.cost.toFixed(2)}</td></tr>`).join("")}
      <tr class="sum"><td><b>Total</b></td><td></td><td><b>$${c.total.toFixed(2)}${c.missing.length ? "+" : ""}</b></td></tr>
    </tbody></table>
    ${n > 1 ? `<p class="fs-std">${fmtNumPlain(n)} drinks: <b>~$${fmtMoney(c.total * n)}${c.missing.length ? "+" : ""}</b></p>` : `<p class="fs-std">A batch of 12: <b>~$${fmtMoney(c.total * 12)}</b></p>`}
    ${uid() && anyTypical ? `<div class="fs-edit"><span>Set what you paid for a bottle in My Bottles.</span><button type="button" class="linkish" id="fs-prices">Edit prices ›</button></div>` : ""}
    <p class="fs-fine">Typical prices are rough US averages for a 750 ml bottle; your own prices replace them.${c.missing.length ? ` No price for ${esc(c.missing.join(", "))}.` : ""}</p>
  </div>`);
  if ($("fs-prices")) $("fs-prices").onclick = () => { closeSheet(); S.profTab = "bar"; openProfile(); setTimeout(() => { const b = $("prof-bar"); if (b) b.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50); };
}
