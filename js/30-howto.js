// ---------- how-to: house syrups and techniques ----------
// Each recipe page shows the ones that fit it in a "How to" row under the spec; tapping one opens a short guide.
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
  { key: "citrus", title: "Fresh citrus", kind: "Ingredient", match: (d, t) => /lime juice|lemon juice|grapefruit juice|orange juice/.test(t),
    steps: ["Squeeze citrus fresh, ideally the same day you use it.", "Strain out the seeds and big pulp."],
    tip: "A lime gives about 1 oz of juice; a lemon about 1½ oz. Bottled juice makes a flat, sour drink." },
  // syrups
  { key: "simple", title: "Simple syrup", kind: "Syrup", match: (d, t) => /simple syrup/.test(t) && !/rich simple/.test(t),
    steps: ["Stir equal parts sugar and hot water (say 1 cup each) until the sugar dissolves.", "Let it cool and bottle it."],
    keeps: "About a month in the fridge." },
  { key: "rich", title: "Rich simple syrup", kind: "Syrup", match: (d, t) => /rich simple|rich syrup|2:1/.test(t),
    steps: ["Stir 2 parts sugar into 1 part hot water until dissolved.", "Cool and bottle it."],
    tip: "Sweeter and silkier than simple syrup. Use about ⅔ as much.", keeps: "A few months in the fridge." },
  { key: "honey-ginger", title: "Honey-ginger syrup", kind: "Syrup", match: (d, t) => /honey[- ]ginger/.test(t),
    steps: ["Peel and thinly slice a 3-inch piece of fresh ginger.", "Simmer it with ½ cup honey and ½ cup water for 5 minutes.", "Let it steep 30 minutes, then strain and cool."],
    tip: "For more bite, use juiced ginger: 1 part ginger juice to 2 parts honey syrup.", keeps: "About 2 weeks in the fridge." },
  { key: "honey", title: "Honey syrup", kind: "Syrup", match: (d, t) => /\bhoney\b/.test(t) && !/honey[- ]ginger|honeydew/.test(t),
    steps: ["Stir equal parts honey and hot water until smooth.", "Cool and bottle it."],
    tip: "Straight honey seizes up in a cold shaker; the syrup mixes in.", keeps: "About a month in the fridge." },
  { key: "demerara", title: "Demerara syrup", kind: "Syrup", match: (d, t) => /demerara (syrup|sugar)|turbinado|raw sugar/.test(t),
    steps: ["Stir equal parts demerara sugar and hot water until dissolved (2 to 1 for a rich version).", "Cool and bottle it."],
    tip: "Brings a light molasses note. Great in Old Fashioneds and tiki drinks.", keeps: "About a month in the fridge." },
  { key: "agave", title: "Agave syrup", kind: "Syrup", match: d => (d.ingredients || []).some(i => /agave/i.test(i.name) && !/tequila|mezcal|spirit|blanco|reposado/i.test(i.name)),
    steps: ["Stir equal parts agave nectar and warm water.", "Cool and bottle it."],
    tip: "Cutting it with water makes it easier to measure and mix.", keeps: "About a month in the fridge." },
  { key: "ginger", title: "Ginger syrup", kind: "Syrup", match: (d, t) => /ginger syrup/.test(t) && !/honey[- ]ginger/.test(t),
    steps: ["Juice or finely grate fresh ginger and squeeze out the juice through a cloth.", "Stir in an equal amount of sugar until dissolved."],
    keeps: "About 2 weeks in the fridge." },
  { key: "cinnamon", title: "Cinnamon syrup", kind: "Syrup", match: (d, t) => /cinnamon syrup/.test(t),
    steps: ["Simmer 1 cup sugar, 1 cup water and 3 broken cinnamon sticks for 5 minutes.", "Let it steep for a few hours (or overnight), then strain."],
    keeps: "About a month in the fridge." },
  { key: "raspberry", title: "Raspberry syrup", kind: "Syrup", match: (d, t) => /raspberry syrup/.test(t),
    steps: ["Simmer 1 cup raspberries, 1 cup sugar and ½ cup water for 5 minutes, mashing the berries.", "Strain out the seeds and cool."],
    keeps: "About 2 weeks in the fridge." },
  { key: "grenadine", title: "Grenadine", kind: "Syrup", match: (d, t) => /grenadine/.test(t),
    steps: ["Warm 1 cup of pure pomegranate juice and stir in 1 cup sugar until dissolved. Don't boil it.", "Cool, and add a few drops of orange flower water if you have it."],
    tip: "Real grenadine is pomegranate, not the bright red corn syrup kind.", keeps: "About 3 weeks in the fridge." },
  { key: "orgeat", title: "Orgeat", kind: "Syrup", match: (d, t) => /orgeat/.test(t),
    steps: ["Easiest: buy a good one (look for real almonds high on the label).", "To make it: blend 1 cup toasted almonds with 1½ cups water, strain through a cloth, then stir in an equal amount of sugar and a few drops of orange flower water."],
    tip: "The almond syrup behind the Mai Tai.", keeps: "Homemade, about 2 weeks in the fridge." },
  { key: "saline", title: "Saline solution", kind: "Syrup", match: (d, t) => /saline|salt solution|pinch of salt/.test(t),
    steps: ["Stir 1 part salt into 4 parts warm water until dissolved.", "Keep it in a dropper bottle and add 1 or 2 drops per drink."],
    tip: "A tiny bit of salt brightens citrus and softens bitterness. You shouldn't taste salt.", keeps: "Indefinitely." }
];
function howtoText(d) {
  return [(d.ingredients || []).map(i => i.name).join(" | "), d.method, d.garnish, d.notes].join(" | ").toLowerCase();
}
function howtosFor(d) {
  const t = howtoText(d);
  return HOWTO.filter(h => { try { return h.match(d, t); } catch (e) { return false; } }).slice(0, 7);
}
function howtoHtml(d) {
  const list = howtosFor(d);
  if (!list.length) return "";
  return `<div class="howto-row"><span class="label">How to</span>${list.map(h => `<button type="button" class="howto-chip" data-howto="${h.key}">${esc(h.title)}</button>`).join("")}</div>`;
}
function openHowto(key) {
  const h = HOWTO.find(x => x.key === key); if (!h) return;
  sheet(h.title, `<div class="howto">
    <span class="label">${esc(h.kind)}</span>
    <ol>${h.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
    ${h.tip ? `<p class="howto-tip">${esc(h.tip)}</p>` : ""}
    ${h.keeps ? `<p class="hint"><b>Keeps:</b> ${esc(h.keeps)}</p>` : ""}
  </div>`);
}
document.addEventListener("click", e => { const b = e.target.closest("[data-howto]"); if (b) openHowto(b.dataset.howto); });
