// ---------- how-to: house syrups and techniques ----------
// Techniques show in a "How to" row under the spec; syrups and fresh citrus link from the ingredient's name in the spec.
// Tapping either opens a short guide; ingredient guides also say how much to make for the drinks you're scaling to.
// match(d, txt): txt is the drink's ingredients, method, garnish and notes, lowercased.
const HOWTO = [
  // methods
  { key: "shake", title: "Shake", kind: "Technique", match: d => d.method === "Shaken",
    steps: ["Add everything to the shaker, then fill it about two-thirds with ice.", "Seal it and shake hard for 10 to 15 seconds, until the outside of the tin is frosty.", "Strain into the glass (over fresh ice if the drink is served on the rocks)."],
    tip: "Shake drinks that have citrus, egg, cream or juice. The shake chills, dilutes and adds air." },
  { key: "stir", title: "Stir", kind: "Technique", match: d => d.method === "Stirred",
    steps: ["Add everything to a mixing glass (or a pint glass) and fill it with ice.", "Stir smoothly with a bar spoon for 20 to 30 seconds.", "Strain into a chilled glass, or over one big cube."],
    tip: "Stir drinks made only of spirits, vermouth and bitters. Stirring keeps them clear and silky." },
  { key: "dry-shake", title: "Dry shake (egg white)", kind: "Technique", match: (d, t) => /egg white|aquafaba|\begg\b|dry shake/.test(t),
    steps: ["Add everything to the shaker with no ice and shake hard for about 10 seconds. This whips the egg white into foam.", "Add ice and shake again for 10 to 15 seconds.", "Strain, then let it sit a moment so the foam rises."],
    tip: "Use a fresh egg; pasteurized egg whites from a carton work too. For no egg, use ¾ oz aquafaba (the liquid from a can of chickpeas)." },
  { key: "double-strain", title: "Double strain", kind: "Technique", match: d => d.method === "Shaken" && ((d.ingredients || []).some(i => /mint|basil|raspberr|blackberr|strawberr|cucumber/i.test(i.name) && !/syrup|liqueur|cordial|crème|creme/i.test(i.name)) || /double strain|fine strain/i.test(d.notes || "")),
    steps: ["Hold a small fine-mesh strainer over the glass.", "Pour through it while straining from the shaker as usual."],
    tip: "It catches ice chips, fruit pulp and bits of herb, for a smoother drink." },
  { key: "muddle", title: "Muddle", kind: "Technique", match: (d, t) => /muddl|mint leaves|cut into wedges|lime wedges|sugar cube/.test(t),
    steps: ["Put the fruit or herbs in the shaker or glass with the syrup or sugar.", "Press down and twist with a muddler a few times."],
    tip: "Press mint gently, just to release its oils. Shredding it makes the drink bitter. Limes and fruit can take a firmer press." },
  { key: "rinse", title: "Rinse a glass", kind: "Technique", match: (d, t) => /rinse/.test(t),
    steps: ["Pour a barspoon of the spirit (often absinthe) into a chilled glass.", "Tilt and turn the glass so it coats the inside.", "Pour out the extra, then add the drink."],
    tip: "A rinse adds aroma without taking over the drink." },
  { key: "float", title: "Float", kind: "Technique", match: (d, t) => (d.ingredients || []).some(i => i.float) || /float/.test(t),
    steps: ["Hold a bar spoon upside down just above the drink's surface.", "Pour the float slowly over the back of the spoon so it spreads and sits on top."],
    tip: "Don't stir after floating. The first sip should hit the float." },
  { key: "peel", title: "Express a peel", kind: "Technique", match: d => /peel|twist/.test(String(d.garnish || "").toLowerCase()),
    steps: ["Cut a wide strip of peel with a vegetable peeler, avoiding most of the white pith.", "Hold it skin-side down over the drink and pinch it to spray the oils across the top.", "Rub it around the rim, then drop it in (or discard it, if the recipe says so)."],
    tip: "The oils are the point: they're the first thing you smell." },
  // ingredients and syrups: linked from the ingredient's name in the spec (see ingHowto below)
  { key: "citrus", title: "Fresh citrus", kind: "Ingredient",
    steps: ["Squeeze citrus fresh, ideally the same day you use it.", "Strain out the seeds and big pulp."],
    tip: "A lime gives about 1 oz of juice; a lemon about 1½ oz. Bottled juice makes a flat, sour drink." },
  { key: "simple", title: "Simple syrup", kind: "Syrup",
    steps: ["Stir equal parts sugar and hot water until the sugar dissolves.", "Let it cool and bottle it."],
    keeps: "About a month in the fridge.", batch: { parts: [["sugar", 1], ["hot water", 1]], oz: 12 } },
  { key: "rich", title: "Rich simple syrup (2:1)", kind: "Syrup",
    steps: ["Stir 2 parts sugar into 1 part hot water until dissolved.", "Cool and bottle it."],
    tip: "Sweeter and silkier than simple syrup. If a recipe calls for plain simple syrup, use about ⅔ as much.", keeps: "A few months in the fridge.",
    batch: { parts: [["sugar", 1], ["hot water", 0.5]], oz: 9 } },
  { key: "honey-ginger", title: "Honey-ginger syrup", kind: "Syrup",
    steps: ["Peel and thinly slice fresh ginger.", "Simmer it with equal parts honey and water for 5 minutes.", "Let it steep 30 minutes, then strain and cool."],
    tip: "For more bite, use juiced ginger: 1 part ginger juice to 2 parts honey syrup.", keeps: "About 2 weeks in the fridge.",
    batch: { parts: [["honey", 0.5], ["water", 0.5]], extra: [3, "-inch piece of ginger", "-inch piece of ginger"], oz: 8 } },
  { key: "honey", title: "Honey syrup", kind: "Syrup",
    steps: ["Stir equal parts honey and hot water until smooth.", "Cool and bottle it."],
    tip: "Straight honey seizes up in a cold shaker; the syrup mixes in.", keeps: "About a month in the fridge.",
    batch: { parts: [["honey", 1], ["hot water", 1]], oz: 16 } },
  { key: "demerara", title: "Demerara syrup", kind: "Syrup",
    steps: ["Stir equal parts demerara sugar and hot water until dissolved.", "Cool and bottle it."],
    tip: "Brings a light molasses note. Great in Old Fashioneds and tiki drinks.", keeps: "About a month in the fridge.",
    batch: { parts: [["demerara sugar", 1], ["hot water", 1]], oz: 12 } },
  { key: "agave", title: "Agave syrup", kind: "Syrup",
    steps: ["Stir equal parts agave nectar and warm water.", "Cool and bottle it."],
    tip: "Cutting it with water makes it easier to measure and mix.", keeps: "About a month in the fridge.",
    batch: { parts: [["agave nectar", 1], ["warm water", 1]], oz: 16 } },
  { key: "ginger", title: "Ginger syrup", kind: "Syrup",
    buy: "Store-bought ginger syrup works fine. To make your own:",
    steps: ["Juice or finely grate fresh ginger and squeeze out the juice through a cloth.", "Stir in an equal amount of sugar until dissolved."],
    keeps: "About 2 weeks in the fridge." },
  { key: "cinnamon", title: "Cinnamon syrup", kind: "Syrup",
    steps: ["Simmer sugar, water and broken cinnamon sticks for 5 minutes.", "Let it steep for a few hours (or overnight), then strain."],
    keeps: "About a month in the fridge.", batch: { parts: [["sugar", 1], ["water", 1]], extra: [3, " cinnamon sticks", " cinnamon stick"], oz: 11 } },
  { key: "raspberry", title: "Raspberry syrup", kind: "Syrup",
    steps: ["Simmer the raspberries, sugar and water for 5 minutes, mashing the berries.", "Strain out the seeds and cool."],
    keeps: "About 2 weeks in the fridge.", batch: { parts: [["raspberries", 1], ["sugar", 1], ["water", 0.5]], oz: 10 } },
  { key: "grenadine", title: "Grenadine", kind: "Syrup",
    buy: "Buy one made from real pomegranate (skip the bright red corn-syrup kind), or make it:",
    steps: ["Warm pure pomegranate juice and stir in an equal amount of sugar until dissolved. Don't boil it.", "Cool, and add a few drops of orange flower water if you have it."],
    keeps: "About 3 weeks in the fridge.", batch: { parts: [["pomegranate juice", 1], ["sugar", 1]], oz: 12 } },
  { key: "orgeat", title: "Orgeat", kind: "Syrup",
    buy: "Most people buy it. Look for real almonds high on the label. To make your own:",
    steps: ["Blend 1 cup toasted almonds with 1½ cups water, then strain through a cloth.", "Stir in an equal amount of sugar and a few drops of orange flower water."],
    tip: "The almond syrup behind the Mai Tai.", keeps: "Homemade, about 2 weeks in the fridge." },
  { key: "saline", title: "Saline solution", kind: "Syrup",
    steps: ["Stir 1 part salt into 4 parts warm water until dissolved.", "Keep it in a dropper bottle and add 1 or 2 drops per drink."],
    tip: "A tiny bit of salt brightens citrus and softens bitterness. You shouldn't taste salt.", keeps: "Indefinitely." }
];
function howtoText(d) {
  return [(d.ingredients || []).map(i => i.name).join(" | "), d.method, d.garnish, d.notes].join(" | ").toLowerCase();
}
// Which guide an ingredient links to, and the ratio its name asks for ("2:1 simple syrup", "rich demerara", "3:1 honey syrup").
function ingHowto(name) {
  const n = String(name || "").toLowerCase();
  const m = n.match(/(\d+(?:\.\d+)?)\s*(?::|to)\s*(\d+(?:\.\d+)?)/);
  const ratio = m ? [Number(m[1]), Number(m[2])] : /\brich\b/.test(n) ? [2, 1] : null;
  const richer = ratio && ratio[0] > ratio[1];
  const fruit = (n.match(/\b(lime|lemon|grapefruit|orange)\b.*\bjuice\b/) || [])[1];
  if (fruit && !/cordial|soda|liqueur/.test(n)) return { key: "citrus", fruit };
  if (/honey[- ]ginger/.test(n)) return { key: "honey-ginger" };
  if (/simple|sugar syrup|gomme|cane syrup/.test(n) && !/demerara|turbinado|cinnamon|ginger|raspberry|honey/.test(n)) return { key: richer ? "rich" : "simple", ratio };
  if (/demerara|turbinado|raw sugar/.test(n) && !/rum/.test(n)) return { key: "demerara", ratio };
  if (/\bhoney\b/.test(n) && !/honeydew|liqueur|whiske?y|bourbon/.test(n)) return { key: "honey", ratio };
  if (/agave/.test(n) && !/tequila|mezcal|spirit|blanco|reposado|añejo|anejo/.test(n)) return { key: "agave" };
  if (/ginger syrup/.test(n)) return { key: "ginger" };
  if (/cinnamon syrup/.test(n)) return { key: "cinnamon" };
  if (/raspberry syrup/.test(n)) return { key: "raspberry" };
  if (/grenadine/.test(n)) return { key: "grenadine" };
  if (/orgeat/.test(n)) return { key: "orgeat" };
  if (/saline|salt solution|pinch of salt/.test(n)) return { key: "saline" };
  return null;
}
// The ingredient name in the spec, tappable when there's a guide for it.
function ingNameHtml(d, i) {
  const h = ingHowto(i.name), idx = (d.ingredients || []).indexOf(i);
  return h && HOWTO.some(x => x.key === h.key)
    ? `<button type="button" class="ing-link" data-howto="${h.key}" data-idx="${idx}" title="How to make it">${esc(i.name)}</button>`
    : esc(i.name);
}
// Techniques (shake, stir, dry shake…) go in the How to row; ingredients link from the spec itself.
function howtosFor(d) {
  const t = howtoText(d);
  return HOWTO.filter(h => { try { return h.kind === "Technique" && h.match(d, t); } catch (e) { return false; } }).slice(0, 6);
}
function howtoHtml(d) {
  const list = howtosFor(d);
  if (!list.length) return "";
  return `<div class="howto-row"><span class="label">How to</span>${list.map(h => `<button type="button" class="howto-chip" data-howto="${h.key}">${esc(h.title)}</button>`).join("")}</div>`;
}

// ---------- how much to make ----------
const NICE = [[0, ""], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"], [1, ""]];
function cupsText(x) {
  let whole = Math.floor(x + 1e-9), rest = x - whole, best = NICE[0];
  NICE.forEach(n => { if (Math.abs(n[0] - rest) < Math.abs(best[0] - rest)) best = n; });
  if (best[0] === 1) { whole += 1; best = NICE[0]; }
  const num = (whole ? String(whole) : "") + best[1];
  return `${num || "a little"} cup${x > 1 + 1e-9 ? "s" : ""}`;
}
const ozText = v => fmtOz(Math.round(v * 4) / 4) + " oz";
const listText = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
// Ounces of this ingredient for the current number of drinks (null when it isn't measured by volume).
function ingNeedOz(i, servings) {
  const per = Number(i.amount) * (ML[i.unit] || 0);
  return per > 0 ? { per: per / ML.oz, total: per * servings / ML.oz } : null;
}
function batchLine(h, i, servings, ratio) {
  const need = ingNeedOz(i, servings);
  if (h.key === "citrus") {
    if (!need) return "";
    const each = { lime: 1, lemon: 1.5, grapefruit: 6, orange: 2.5 }[h.fruit || "lime"] || 1;
    const n = Math.max(1, Math.ceil(need.total / each));
    return servings > 1 ? `This batch needs ${ozText(need.total)} of ${h.fruit || "citrus"} juice: about ${n} ${h.fruit || "fruit"}${n === 1 ? "" : "s"}.`
      : `One drink uses ${ozText(need.per)}: about ${n === 1 && need.per < each ? (need.per <= each / 2 ? "half a" : "one") : n} ${h.fruit || "fruit"}${n > 1 ? "s" : ""}.`;
  }
  let b = h.batch; if (!b) return need && servings > 1 ? `This batch needs ${ozText(need.total)}.` : "";
  if (ratio && (h.key === "honey" || h.key === "demerara") && ratio[0] !== ratio[1]) {
    const [a, w] = ratio, tot = a + w;
    b = { parts: [[b.parts[0][0], a / tot], [b.parts[1][0], w / tot]], oz: h.key === "honey" ? 8 : Math.round(8 * (0.6 * a + w) / tot) };
  }
  if (!need) return "";
  const target = servings > 1 ? need.total * 1.1 : Math.max(need.per, 6);
  const mult = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16].find(m => m * b.oz >= target) || 16;
  const parts = b.parts.map(([what, cups]) => `${cupsText(cups * mult)} ${what}`);
  if (b.extra) { const k = Math.max(1, Math.round(b.extra[0] * mult)); parts.push(`${k}${k === 1 ? b.extra[2] : b.extra[1]}`); }
  const makes = Math.round(b.oz * mult);
  return servings > 1
    ? `This batch needs ${ozText(need.total)}. ${listText(parts)} makes about ${makes} oz.`
    : `One drink uses ${ozText(need.per)}. ${listText(parts)} makes about ${makes} oz, enough for ${Math.max(1, Math.floor(makes / need.per))} drinks.`;
}
function openHowto(key, d, idx) {
  let h = HOWTO.find(x => x.key === key); if (!h) return;
  const i = d && idx >= 0 ? (d.ingredients || [])[idx] : null;
  const ih = i ? ingHowto(i.name) : null;
  const ratio = ih && ih.ratio;
  let steps = h.steps, title = h.title;
  if (ratio && (key === "honey" || key === "demerara") && ratio[0] !== ratio[1]) {
    const [a, w] = ratio, what = key === "honey" ? "honey" : "demerara sugar";
    steps = [`Stir ${a} parts ${what} into ${w} part${w === 1 ? "" : "s"} hot water until ${key === "honey" ? "smooth" : "dissolved"}.`].concat(h.steps.slice(1));
    title = `${h.title} (${a}:${w})`;
  }
  const amount = i ? batchLine(Object.assign({}, h, { fruit: ih && ih.fruit }), i, S.servings || 1, ratio) : "";
  sheet(title, `<div class="howto">
    <span class="label">${esc(h.kind)}</span>
    ${amount ? `<p class="howto-amount">${esc(amount)}</p>` : ""}
    ${h.buy ? `<p class="howto-buy">${esc(h.buy)}</p>` : ""}
    <ol>${steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
    ${h.tip ? `<p class="howto-tip">${esc(h.tip)}</p>` : ""}
    ${h.keeps ? `<p class="hint"><b>Keeps:</b> ${esc(h.keeps)}</p>` : ""}
  </div>`);
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-howto]"); if (!b) return;
  const idx = b.dataset.idx !== undefined ? Number(b.dataset.idx) : -1;
  openHowto(b.dataset.howto, idx >= 0 ? current() : null, idx);
});
