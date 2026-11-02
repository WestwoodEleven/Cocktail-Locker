// The Cocktail Locker: core. Scripts share one global scope and load in numbered order.
// ---------- units ----------
const ML = { oz: 29.5735, ml: 1, cl: 10, tsp: 4.93, tbsp: 14.79, barspoon: 5, dash: 0.92 };
const UNIT_OPTS = [["oz","oz"],["ml","ml"],["cl","cl"],["barspoon","barspoon"],["tsp","tsp"],["tbsp","tbsp"],["dash","dash"],["each","each / whole"]];
const SPOONS = new Set(["barspoon","tsp","tbsp"]);
const DILUTION = { Stirred: 0.20, Shaken: 0.25, Built: 0.10, Blended: 0, Thrown: 0.15 };
const METHODS = ["Stirred","Shaken","Built","Blended","Thrown"];

const FR8 = { 0: "", 1: "⅛", 2: "¼", 3: "⅜", 4: "½", 5: "⅝", 6: "¾", 7: "⅞" };
// Amounts as HTML with readable fractions: "1¾" becomes 1 plus a properly sized ¾ (the ¾ character is tiny on phones).
const FRAC_PARTS = { "⅛": [1, 8], "¼": [1, 4], "⅜": [3, 8], "½": [1, 2], "⅝": [5, 8], "¾": [3, 4], "⅞": [7, 8], "⅓": [1, 3], "⅔": [2, 3] };
const qHtml = q => esc(q).replace(/[⅛¼⅜½⅝¾⅞⅓⅔]/g, ch => { const [n, d] = FRAC_PARTS[ch]; return `<span class="fr" aria-label="${n}/${d}"><span class="fn">${n}</span><span class="fs">⁄</span><span class="fd">${d}</span></span>`; });
function fracFmt(v, denom) {
  const q = Math.round(v * denom) / denom;
  if (q === 0) return v > 0 ? (Math.round(v * 100) / 100).toString() : "0";
  const whole = Math.floor(q + 1e-9);
  const eighths = Math.round((q - whole) * 8);
  return (whole ? String(whole) : "") + FR8[eighths] || "0";
}
const fmtOz = v => v < 2 ? fracFmt(v, 8) : v < 32 ? fracFmt(v, 4) : String(Math.round(v * 2) / 2).replace(/\.5$/, "½");
const fmtMl = v => v < 10 ? String(Math.round(v * 2) / 2) : v < 100 ? String(Math.round(v)) : String(Math.round(v / 5) * 5);
const fmtCl = v => String(Math.round(v * 10) / 10);
const fmtCount = v => fracFmt(v, 2);
const fmtLiters = ml => ml >= 1000 ? (Math.round(ml / 10) / 100) + " L" : fmtMl(ml) + " ml";

function parseAmount(s) {
  s = String(s || "").trim().replace(/½/g," 1/2").replace(/¼/g," 1/4").replace(/¾/g," 3/4").replace(/⅛/g," 1/8").trim();
  if (!s) return NaN;
  let total = 0;
  for (const part of s.split(/\s+/)) {
    if (/^\d+\/\d+$/.test(part)) { const [a,b] = part.split("/").map(Number); if (!b) return NaN; total += a / b; }
    else if (/^\d*\.?\d+$/.test(part)) total += Number(part);
    else return NaN;
  }
  return total;
}
function amountToText(v) {
  if (!isFinite(v)) return "";
  const whole = Math.floor(v), rest = v - whole;
  const map = { 0.125: "1/8", 0.25: "1/4", 0.375: "3/8", 0.5: "1/2", 0.625: "5/8", 0.75: "3/4", 0.875: "7/8" };
  const key = Object.keys(map).find(k => Math.abs(rest - k) < 1e-6);
  if (rest === 0) return String(whole);
  if (key) return (whole ? whole + " " : "") + map[key];
  return String(Math.round(v * 1000) / 1000);
}

// Show one scaled ingredient in the chosen display mode
function show(ing, mult, mode) {
  const amt = (Number(ing.amount) || 0) * mult;
  const unit = ing.unit;
  if (unit === "each") return { q: fmtCount(amt), u: "", note: "" };
  if (unit === "dash") {
    const n = Math.max(1, Math.round(amt));
    let note = "";
    if (n >= 12) { const ml = n * ML.dash; note = "≈ " + (mode === "ml" ? fmtMl(ml) + " ml" : fmtOz(ml / ML.oz) + " oz") + " if measuring"; }
    return { q: String(n), u: n === 1 ? "dash" : "dashes", note };
  }
  const ml = amt * (ML[unit] || 0);
  let out;
  const keepSpoon = SPOONS.has(unit) && ml < (mode === "ml" ? 15 : 30);
  if (keepSpoon) out = { q: fracFmt(amt, 4), u: unit === "barspoon" ? (amt > 1 ? "barspoons" : "barspoon") : unit };
  else if (mode === "ml" || (mode === "spec" && unit === "ml")) out = { q: fmtMl(ml), u: "ml" };
  else if (mode === "spec" && unit === "cl") out = { q: fmtCl(ml / 10), u: "cl" };
  else out = { q: fmtOz(ml / ML.oz), u: "oz" };
  out.note = ml >= 500 ? "≈ " + (Math.round(ml / 750 * 10) / 10) + " × 750 ml bottles" : "";
  return out;
}
const ingMl = i => i.unit === "each" ? 0 : (Number(i.amount) || 0) * (ML[i.unit] || 0);
const liquidMl = (d, floats = false) => (d.ingredients || []).filter(i => !!i.float === floats).reduce((s, i) => s + ingMl(i), 0);

// ---------- types ----------
const TYPES = ["Sour", "Spirit-forward", "Highball", "Tiki", "Fizz & Collins", "Spritz & bubbly", "Flip & creamy", "Punch", "Hot", "Shot", "Other"];
const BASES = ["Gin", "Vodka", "Rum", "Tequila", "Mezcal", "Whiskey", "Brandy", "Liqueur", "Wine & fortified", "No alcohol", "Other"];
const KINDS = ["Spirit", "Liqueur", "Vermouth & wine", "Bitters", "Juice", "Syrup & sweetener", "Soda & mixer", "Egg & dairy", "Other"];
const KIND_RULES = [
  ["Bitters", /bitters/],
  ["Liqueur", /liqueur|cointreau|triple sec|curac|campari|aperol|chartreuse|amaro|maraschino|kahl|creme de|crème de|st[- .]?germain|elderflower|benedictine|galliano|chambord|amaretto|fernet|cynar|schnapps|falernum|allspice dram|drambuie|frangelico|limoncello|grand marnier|midori|disaronno|baileys|irish cream|pimm/],
  ["Vermouth & wine", /vermouth|lillet|cocchi|sherry|\bport\b|wine|prosecco|champagne|cava|sparkling|madeira|sake/],
  ["Syrup & sweetener", /syrup|sugar|honey|agave|grenadine|orgeat|cream of coconut|coco l[oó]pez|maple|demerara/],
  ["Juice", /juice|\blime\b|\blemon\b|grapefruit|pineapple|passion ?fruit|cranberry|pur[eé]e/],
  ["Soda & mixer", /soda|tonic|ginger beer|ginger ale|cola|club|seltzer|sparkling water|lemonade|\bwater\b|\bcoffee\b|espresso|\btea\b/],
  ["Egg & dairy", /\begg|cream|milk|half and half|aquafaba/],
  ["Spirit", /\bgin\b|vodka|\brum\b|rhum|tequila|mezcal|whiske?y|bourbon|\brye\b|scotch|brandy|cognac|pisco|cacha[cç]a|calvados|armagnac|absinthe|aquavit|akvavit|genever|batavia|arrack|sotol|baijiu|soju|overproof/]
];
const guessKind = name => { const n = String(name || "").toLowerCase(); for (const [k, re] of KIND_RULES) if (re.test(n)) return k; return "Other"; };
const kindOf = i => i.kind || guessKind(i.name);
const BASE_RULES = [["Mezcal", /mezcal|sotol/], ["Tequila", /tequila/], ["Rum", /\brum\b|rhum|cacha[cç]a|arrack/], ["Whiskey", /whiske?y|bourbon|\brye\b|scotch/],
  ["Brandy", /brandy|cognac|pisco|calvados|armagnac/], ["Gin", /\bgin\b|genever/], ["Vodka", /vodka/]];
function guessBase(d) {
  const ings = (d.ingredients || []).filter(i => !i.float);
  const spirits = ings.filter(i => kindOf(i) === "Spirit").sort((a, b) => ingMl(b) - ingMl(a));
  for (const i of spirits) { const n = (i.name + " " + (i.brand || "")).toLowerCase(); for (const [b, re] of BASE_RULES) if (re.test(n)) return b; }
  if (spirits.length) return "Other";
  if (ings.some(i => kindOf(i) === "Liqueur")) return "Liqueur";
  if (ings.some(i => kindOf(i) === "Vermouth & wine")) return "Wine & fortified";
  return ings.length ? "No alcohol" : "Other";
}
const baseOf = d => d.base || guessBase(d);
function guessType(d) {
  const ings = d.ingredients || [];
  const names = ings.map(i => (i.name + " " + (i.brand || "")).toLowerCase()).join(" | ");
  const kinds = new Set(ings.map(kindOf));
  const citrus = /\blime\b|\blemon\b|grapefruit|yuzu/.test(names) && kinds.has("Juice");
  const sweet = kinds.has("Syrup & sweetener") || kinds.has("Liqueur");
  if (/\bhot\b|toddy|mulled|irish coffee/.test(names) || /hot/i.test(d.glass || "")) return "Hot";
  if (baseOf(d) === "Rum" && /pineapple|orgeat|falernum|passion|coconut|allspice/.test(names)) return "Tiki";
  if (/prosecco|champagne|cava|sparkling wine/.test(names)) return "Spritz & bubbly";
  if (kinds.has("Soda & mixer") && !/\bwater\b|espresso|coffee/.test(names.replace(/sparkling water/g, "soda"))) return citrus && sweet && /soda|club|seltzer|sparkling water/.test(names) ? "Fizz & Collins" : "Highball";
  if (kinds.has("Egg & dairy") && !citrus) return "Flip & creamy";
  if (citrus) return "Sour";
  if (d.method === "Stirred" || d.method === "Built") return "Spirit-forward";
  return "Other";
}
const typeOf = d => d.type || guessType(d);

// ---------- state ----------
// Extra full-page views register here: VIEWS.name = () => render into #main.
const VIEWS = {};
// Views that have their own link (#name), opened on load or when the link changes.
const HASH_VIEWS = {};
const S = {
  drinks: [], selected: null, servings: 1, mode: "spec", prebatch: false,
  view: location.hash.length > 1 ? "detail" : "home", editing: null, confirmDelete: false, query: "", loaded: false,
  canWrite: false, backend: null, session: null, uploading: null, confirmPhoto: false,
  profiles: {}, ratings: {}, sort: (() => { try { return localStorage.getItem("mc-sort") || "rated"; } catch (e) { return "rated"; } })(), f: { owner: "", type: "", base: "", method: "", kind: "", rating: "" }
};
try { const m = localStorage.getItem("mc-mode"); if (m) S.mode = m; } catch (e) {}

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, Math.max(2200, String(msg).length * 55)); }
function setStatus(kind, text) { $("status").className = "status " + kind; $("status-text").textContent = text; }
