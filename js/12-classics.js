// ---------- classics: which well-known drink a recipe is (or riffs on) ----------
// A drink can say it outright (d.classic, set in the editor or by the AI), or we recognize it from its
// signature ingredients, so "Mitch-A-Rita" (tequila, lime, orange liqueur) shows up when you search "margarita".
// Rules are tried in order, most specific first. need: every pattern must match some ingredient;
// none: no ingredient may match these.
const ORANGE_LIQ = /cointreau|triple sec|orange liqueur|cura[cç]ao|grand marnier|combier/;
const CLASSIC_RULES = [
  ["Corpse Reviver No. 2", [/\bgin\b/, /lillet|cocchi americano|blanc vermouth/, ORANGE_LIQ, /lemon/, /absinthe|pastis|herbsaint/]],
  ["Last Word", [/\bgin\b/, /green chartreuse|chartreuse/, /maraschino|luxardo/, /lime/]],
  ["Paper Plane", [/bourbon|whiske?y|rye/, /aperol/, /nonino|amaro/, /lemon/]],
  ["Aviation", [/\bgin\b/, /maraschino|luxardo/, /violette|violet/, /lemon/]],
  ["Hemingway Daiquiri", [/\brum\b/, /grapefruit/, /maraschino|luxardo/, /lime/]],
  ["Jungle Bird", [/\brum\b/, /campari/, /pineapple/, /lime/]],
  ["Mai Tai", [/\brum\b|rhum/, /orgeat/, /lime/, ORANGE_LIQ]],
  ["Painkiller", [/\brum\b/, /pineapple/, /cream of coconut|coco l[oó]pez|coconut cream/, /orange/]],
  ["Piña Colada", [/\brum\b/, /pineapple/, /cream of coconut|coco l[oó]pez|coconut cream|coconut milk/]],
  ["Penicillin", [/scotch|whisk(e)?y/, /lemon/, /honey/, /ginger/]],
  ["Sazerac", [/\brye\b|cognac|whiske?y/, /absinthe|herbsaint|pastis/, /peychaud/]],
  ["Clover Club", [/\bgin\b/, /raspberr/, /lemon/, /egg white|aquafaba/]],
  ["Espresso Martini", [/vodka/, /espresso|coffee|cold brew/, /coffee liqueur|kahl[uú]a|mr\.? black|tia maria/]],
  ["Cosmopolitan", [/vodka|citron/, /cranberr/, /lime/, ORANGE_LIQ]],
  ["French 75", [/\bgin\b|cognac/, /lemon/, /champagne|prosecco|sparkling|cava|cr[eé]mant/]],
  ["Aperol Spritz", [/aperol/, /prosecco|champagne|sparkling|cava/], [/gin\b|vodka|tequila|whiske?y|bourbon/]],
  ["Boulevardier", [/bourbon|\brye\b|whiske?y/, /campari/, /sweet vermouth|rosso|carpano|cocchi di torino|punt e mes/]],
  ["Negroni", [/\bgin\b/, /campari/, /sweet vermouth|rosso|carpano|cocchi di torino|punt e mes/]],
  ["Manhattan", [/\brye\b|bourbon|whiske?y/, /sweet vermouth|rosso|carpano|cocchi di torino|punt e mes/, /bitters/], [/campari|lemon|lime/]],
  ["Martini", [/\bgin\b|vodka/, /dry vermouth|blanc vermouth|dolin dry|noilly/], [/lime|lemon juice|campari|espresso/]],
  ["Moscow Mule", [/vodka/, /ginger beer|ginger ale/, /lime/]],
  ["Kentucky Mule", [/bourbon|whiske?y/, /ginger beer/, /lime/]],
  ["Dark 'n' Stormy", [/\brum\b/, /ginger beer/], [/vodka|bourbon/]],
  ["Paloma", [/tequila|mezcal/, /grapefruit/]],
  ["Margarita", [/tequila|mezcal/, /lime/, ORANGE_LIQ]],
  ["Tommy's Margarita", [/tequila/, /lime/, /agave/], [ORANGE_LIQ, /grapefruit/]],
  ["Mojito", [/\brum\b/, /lime/, /mint/, /soda|club|sparkling water|seltzer/]],
  ["Mint Julep", [/bourbon|whiske?y/, /mint/], [/lemon|lime/]],
  ["Caipirinha", [/cacha[cç]a/, /lime/]],
  ["Pisco Sour", [/pisco/, /lime|lemon/]],
  ["Amaretto Sour", [/amaretto|disaronno/, /lemon/]],
  ["Gold Rush", [/bourbon|whiske?y/, /lemon/, /honey/], [/ginger/]],
  ["Bee's Knees", [/\bgin\b/, /lemon/, /honey/]],
  ["Tom Collins", [/\bgin\b/, /lemon/, /soda|club|sparkling water|seltzer/]],
  ["Whiskey Sour", [/bourbon|whiske?y|\brye\b/, /lemon/, /syrup|sugar|simple/], [/honey|aperol|campari|amaro/]],
  ["Sidecar", [/cognac|brandy|armagnac/, /lemon/, ORANGE_LIQ]],
  ["Gimlet", [/\bgin\b|vodka/, /lime/, /syrup|sugar|simple|cordial/], [/soda|mint|chartreuse|ginger|cranberr/]],
  ["Daiquiri", [/\brum\b/, /lime/, /syrup|sugar|simple|demerara/], [/mint|pineapple|grapefruit|orgeat|soda|cola/]],
  ["Cuba Libre", [/\brum\b/, /cola|coke/]],
  ["Old Fashioned", [/bourbon|\brye\b|whiske?y|scotch/, /bitters/, /syrup|sugar|simple|demerara/], [/lemon juice|lime|vermouth|mint/]],
  ["Gin and Tonic", [/\bgin\b/, /tonic/]],
  ["Bloody Mary", [/vodka/, /tomato/]]
];
const CLASSIC_NAMES = CLASSIC_RULES.map(r => r[0]).sort((a, b) => a.localeCompare(b));

function detectClassic(d) {
  const names = (d.ingredients || []).map(i => (i.name + " " + (i.brand || "")).toLowerCase()).filter(s => s.trim());
  if (names.length < 2) return "";
  const any = re => names.some(n => re.test(n));
  for (const [name, need, none] of CLASSIC_RULES) if (need.every(any) && !(none || []).some(any)) return name;
  return "";
}
// The classic for a drink: what its owner set ("none" means not a riff on anything), else what we recognize.
function classicOf(d) {
  if (!d) return "";
  if (d.classic === "none") return "";
  return d.classic || detectClassic(d);
}
// "Riff on a Margarita", unless the drink is simply called that.
function riffLabel(d) {
  const c = classicOf(d); if (!c) return "";
  const k = slugify(c), n = slugify(d.name || "");
  return n === k || n.includes(k) ? "" : c;
}
