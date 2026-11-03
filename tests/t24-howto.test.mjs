import { open, check } from "./harness.mjs";
import { CLASSICS } from "../tools/classics-data.mjs";
export default async function () {
  const p = await open({});
  const specs = CLASSICS.map(c => ({ name: c[0], method: c[3], garnish: c[5], ingredients: c[6].map(([amount, unit, name]) => ({ amount, unit, name })) }));
  const got = Object.fromEntries(await p.evaluate(s => s.map(d => [d.name, howtosFor(d).map(h => h.key)]), specs));
  const has = (n, ...keys) => keys.every(k => got[n].includes(k));
  check("Pisco Sour: shake, dry shake, simple syrup", has("Pisco Sour", "shake", "dry-shake", "simple"), JSON.stringify(got["Pisco Sour"]));
  check("Penicillin: honey-ginger, not plain honey", has("Penicillin", "honey-ginger", "float") && !got["Penicillin"].includes("honey"), JSON.stringify(got["Penicillin"]));
  check("Mojito: muddle; Mai Tai: orgeat, not demerara or double strain; Sazerac: rinse, stir", has("Mojito", "muddle") && has("Mai Tai", "orgeat") && !got["Mai Tai"].includes("demerara") && !got["Mai Tai"].includes("double-strain") && has("Sazerac", "rinse", "stir"), JSON.stringify(got["Mai Tai"]));
  check("Tommy's Margarita: agave; Margarita: no agave", has("Tommy's Margarita", "agave") && !got["Margarita"].includes("agave"), JSON.stringify(got["Margarita"]));
  check("Gin and Tonic has nothing to explain beyond a pour", got["Gin and Tonic"].length === 0, JSON.stringify(got["Gin and Tonic"]));
  check("every classic gets at most 7", Object.values(got).every(v => v.length <= 7));
  await p.pick("neg-1"); await p.waitForTimeout(100);
  check("recipe page shows a How to row", /how to/i.test(await p.text(".howto-row")) && await p.isVisible("[data-howto='stir']"));
  await p.click("[data-howto='stir']"); await p.waitForTimeout(150);
  check("tapping opens the guide", /stir smoothly/i.test(await p.text("#gen-modal")));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  console.log("  how-tos per classic:", JSON.stringify(got));
  await p.close();
}
