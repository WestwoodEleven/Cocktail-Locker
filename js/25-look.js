// ---------- the "Back bar" look: glass drawings and navigation ----------
// Drinks without a photo get a line drawing of their glass, filled with a color that fits the drink.

// Which glass to draw: from the drink's glass, else its style.
function glassOf(d) {
  const g = String(d.glass || "").toLowerCase();
  if (/copper|mule/.test(g)) return "rocks";
  if (/tiki|mug|skull|bowl/.test(g)) return "mug";
  if (/coupe|martini|nick|cocktail glass|saucer|flute|champagne|wine|goblet/.test(g)) return /flute|champagne|wine|goblet/.test(g) ? "highball" : "coupe";
  if (/rocks|old[- ]?fashioned|lowball|double|tumbler/.test(g)) return "rocks";
  if (/highball|collins|tall|pint|hurricane|julep|copper|zombie|chimney/.test(g)) return "highball";
  const t = typeof typeOf === "function" ? typeOf(d) : "";
  if (t === "Tiki") return "mug";
  if (["Highball", "Fizz & Collins", "Spritz & bubbly"].includes(t)) return "highball";
  if (t === "Sour" || t === "Flip & creamy") return d.method === "Shaken" ? "coupe" : "rocks";
  return "rocks";
}

// The drink's color, guessed from its ingredients (first match wins).
const DRINK_COLORS = [
  [/blue cura/, "#3A7BD5"],
  [/coffee|espresso|kahl|cola|stout|cold brew/, "#4A2C1E"],
  [/campari|cherry|cranberry|raspberry|strawberry|hibiscus|grenadine|pomegranate|sorrel/, "#B3242B"],
  [/aperol|blood orange|watermelon|passion ?fruit|guava/, "#E0662C"],
  [/grapefruit|rosé|rose\b|pink/, "#F08C8C"],
  [/dark rum|aged rum|amber rum|añejo|anejo|reposado|bourbon|whiske?y|\brye\b|scotch|cognac|brandy|armagnac|calvados|sweet vermouth|amaro|averna|cynar/, "#B5651D"],
  [/pineapple|orange juice|mango|apricot|peach|cream of coconut|turmeric|ginger beer|ginger ale/, "#E3B65A"],
  [/cream|egg|coconut milk|milk|baileys|horchata/, "#EADBC0"],
  [/chartreuse|midori|matcha|basil|cucumber|mint|absinthe|green/, "#A9C46C"],
  [/lime|lemon|gin|vodka|tequila|blanco|white rum|mezcal|pisco|prosecco|champagne|sparkling|tonic|soda/, "#E3E7B8"]
];
function drinkColor(d) {
  const names = (d.ingredients || []).map(i => (i.name + " " + (i.brand || "")).toLowerCase()).join(" | ");
  for (const [re, c] of DRINK_COLORS) if (re.test(names)) return c;
  return "#D9B26A";
}
// Mix a hex color toward another; used for the soft background behind the glass.
function mixHex(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return "#" + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, "0")).join("");
}
const GLASS_SVG = {
  mug: c => `<path d="M28.6 44 H71.4 Q74 70 69.5 102 H30.5 Q26 70 28.6 44 Z" fill="${c}"/><path class="gl" d="M28 22 H72 Q76 60 70 104 H30 Q24 60 28 22 Z"/><path class="gl" d="M38 60 h8 M54 60 h8 M42 76 Q50 82 58 76"/>`,
  rocks: c => `<path d="M24.5 62 H75.5 L73 102 H27 Z" fill="${c}"/><rect class="ice" x="38" y="54" width="22" height="20" rx="3" transform="rotate(-8 49 64)"/><path class="gl" d="M22 40 H78 L74 104 H26 Z"/>`,
  coupe: c => `<path d="M18 34 H82 Q76 62 50 64 Q24 62 18 34 Z" fill="${c}"/><path class="gl" d="M12 28 H88 Q82 68 50 70 Q18 68 12 28 Z"/><path class="gl" d="M50 70 V106 M34 108 H66"/>`,
  highball: c => `<path d="M31.4 36 H68.6 L67.4 104 H32.6 Z" fill="${c}"/><path class="gl" d="M30 14 H70 L68 106 H32 Z"/><path class="gl" d="M58 6 L48 70"/>`
};
function glassSvg(d) {
  return `<svg class="glass-svg" viewBox="0 0 100 120" aria-hidden="true" focusable="false">${GLASS_SVG[glassOf(d)](drinkColor(d))}</svg>`;
}
function tintStyle(d) {
  const c = drinkColor(d);
  return `--tl:${mixHex(c, "#FFFFFF", 0.24)};--td:${mixHex(c, "#1C1F25", 0.3)}`;
}
// A small square for lists: the photo if there is one, else the glass.
function drinkThumb(d) {
  return d.photo
    ? `<img class="thumb" src="${esc(photoUrl(d.photo))}" alt="" loading="lazy">`
    : `<span class="thumb glassbox" style="${tintStyle(d)}" aria-hidden="true">${glassSvg(d)}</span>`;
}
// A larger picture block (recipe page, home tiles).
function drinkPicture(d) {
  return `<div class="glassbox" style="${tintStyle(d)}">${glassSvg(d)}</div>`;
}

// ---------- navigation: the top bar on computers, the tab bar on phones ----------
function navGo(where) {
  const needSignIn = msg => { toast(msg); const a = $("auth-btn"); if (a && !a.hidden) a.click(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  if (where === "home") return openHome();
  if (where === "guide") return openGuide();
  if (where === "party") return openParty();
  if (where === "canmake") { if (!uid()) return needSignIn("Sign in to save your bottles and see what you can make."); return openCanMake(); }
  if (where === "mine") {
    if (!uid()) return needSignIn("Sign in to keep your own drinks.");
    S.profTab = "mine"; openProfile();
    setTimeout(() => { const d = $("prof-drinks"); if (d) d.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
    return;
  }
  if (where === "bar") {
    if (!uid()) return needSignIn("Sign in to keep your bottles.");
    S.profTab = "bar"; openProfile();
    setTimeout(() => { const b = $("prof-bar"); if (b) b.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
  }
}
document.querySelectorAll("[data-nav]").forEach(b => b.addEventListener("click", () => navGo(b.dataset.nav)));
// Page-wide state that follows the current view: full-width home, and which nav item is marked.
function syncChrome() { document.body.classList.toggle("on-home", S.view === "home"); markNav(); }
// Mark where you are.
const NAV_OF_VIEW = { home: "home", detail: "home", canmake: "canmake", guide: "guide", bottle: "guide", party: "party", profile: "bar" };
function markNav() {
  const here = S.view === "profile" ? (S.profTab || "mine") : NAV_OF_VIEW[S.view] || "";
  document.querySelectorAll("[data-nav]").forEach(b => { if (b.dataset.nav === here) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
}

// Typing in the top search from the home page opens the drink list.
$("search").addEventListener("input", () => {
  if (S.view === "home" && $("search").value.trim()) showList(null, true);
});
