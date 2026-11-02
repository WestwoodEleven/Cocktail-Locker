import { open, check } from "./harness.mjs";
const invoke = `async (name, body) => {
  window.__mockCalls = (window.__mockCalls || 0) + 1;
  await new Promise(r => setTimeout(r, 150));
  if (body.mode !== "mocktail") return { data: null, error: { name: "FunctionsFetchError" } };
  return { data: { mocktail: { name: "Faux Negroni", method: "Stirred", glass: "Rocks", garnish: "Orange peel",
    ingredients: [{ amount: 1, unit: "oz", name: "Chilled juniper tea", have: false }, { amount: 1, unit: "oz", name: "Non-alcoholic aperitivo", have: false }, { amount: 0.5, unit: "oz", name: "Simple syrup", have: true }],
    swaps: [{ from: "Gin", to: "Chilled juniper tea" }, { from: "Campari", to: "Non-alcoholic aperitivo" }],
    notes: "Stir with ice and strain over a large cube.", why: "Keeps the bitter-orange backbone.", shopping: "A non-alcoholic aperitivo" } }, error: null };
}`;
export default async function () {
  const p = await open({ invoke });
  await p.click("#list button[data-id='neg-1']");
  check("mocktail button on drinks", await p.isVisible("#mock-btn"));
  await p.click("#mock-btn"); await p.waitForTimeout(50);
  check("shows working state", (await p.text("#gen-body")).includes("Making it zero-proof"));
  await p.waitForTimeout(250);
  const t = await p.text("#gen-body");
  check("mocktail shown with swaps and NA label", t.includes("Faux Negroni") && t.includes("0.0% NA") && t.includes("Gin → Chilled juniper tea"), t);
  check("marks what you need to get", t.includes("Need") && t.includes("You'll need: A non-alcoholic aperitivo"));
  const sent = await p.evaluate("window.__MOCK.lastInvoke");
  check("sends the drink and your bar", sent.drink.name === "Negroni" && sent.drink.ingredients.length === 3 && sent.bar.liquors.includes("Gin"));
  await p.click("#mk-make"); await p.waitForTimeout(100);
  check("Make it opens the mocktail in make mode", (await p.text("#make-mode")).includes("Faux Negroni"));
  await p.click("#mm-close");
  await p.click("#mock-btn"); await p.waitForTimeout(50);
  check("second open is instant (cached)", (await p.evaluate("window.__mockCalls")) === 1 && (await p.text("#gen-body")).includes("Faux Negroni"));
  await p.click("#mk-save"); await p.waitForTimeout(100);
  check("save opens editor as a no-alcohol drink", (await p.inputValue("#f-name")) === "Faux Negroni" && (await p.inputValue("#f-base")) === "No alcohol" && (await p.text(".scan-banner")).includes("Mocktail version."));
  await p.click("#save-btn"); await p.waitForTimeout(150);
  const meta = await p.text(".meta");
  check("saved mocktail tagged and has no mocktail button", meta.includes("Mocktail") && meta.includes("No alcohol") && !(await p.isVisible("#mock-btn")), meta);
  await p.setViewportSize({ width: 390, height: 844 });
  check("no sideways scroll on phone", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
  const q = await open({ user: null });
  await q.click("#list button[data-id='neg-1']");
  check("signed out: no mocktail button", !(await q.isVisible("#mock-btn")));
  await q.close();
}
