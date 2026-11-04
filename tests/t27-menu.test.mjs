import { open, check } from "./harness.mjs";
import { fileURLToPath } from "node:url";
const fx = n => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
const invoke = `async (name, body) => {
  if (body.mode !== "menu") return { data: null, error: { name: "FunctionsFetchError" } };
  window.__menuCalls = (window.__menuCalls || 0) + 1;
  await new Promise(r => setTimeout(r, 150));
  return { data: { bar: "Bar Agricole", drinks: [
    { name: "Cane & Cinnamon", menu_text: "aged rum, cinnamon-honey, lime", price: "$16", classic: "Daiquiri", riff: "Aged rum with a cinnamon-honey syrup", type: "Sour", base: "Rum", method: "Shaken", glass: "Coupe", garnish: "Lime wheel",
      ingredients: [{ amount: 2, unit: "oz", name: "Aged rum" }, { amount: 0.75, unit: "oz", name: "Lime juice" }, { amount: 0.75, unit: "oz", name: "Cinnamon-honey syrup", house: true }],
      steps: ["Shake hard with ice.", "Double strain into a chilled coupe."],
      house_made: [{ name: "Cinnamon-honey syrup", ingredients: ["½ cup honey", "½ cup water", "2 cinnamon sticks"], steps: ["Simmer 5 minutes.", "Steep 1 hour, then strain."], keeps: "About 2 weeks in the fridge", shortcut: "Honey syrup with a pinch of cinnamon" }],
      confidence: "high", note: "" },
    { name: "Bitter Garden", menu_text: "gin, campari, cucumber", price: "$15", classic: "Negroni", riff: "", type: "Spirit-forward", base: "Gin", method: "Stirred", glass: "Rocks", garnish: "",
      ingredients: [{ amount: 1, unit: "oz", name: "Gin" }, { amount: 1, unit: "oz", name: "Campari" }, { amount: 1, unit: "oz", name: "Sweet vermouth" }],
      steps: ["Stir with ice.", "Strain over a big cube."], house_made: [], confidence: "medium", note: "" } ] }, error: null };
}`;
export default async function () {
  const p = await open({ user: "u1", invoke, width: 390 });
  await p.evaluate("localStorage.removeItem('mc-menu'); S.menuRes = null; openMenuDecoder()"); await p.waitForTimeout(150);
  check("intro explains what you get", /photograph a menu/i.test(await p.text("#md-pick")) && /house-made syrups/i.test(await p.text("#main")));
  await p.click("#md-pick"); await p.setInputFiles("#menu-file", fx("shelf1.jpg")); await p.waitForTimeout(100);
  check("shows that it's reading", /reading the menu/i.test(await p.text("#main")));
  await p.waitForTimeout(700);
  const t = await p.text("#main");
  check("lists each drink with the bar, price and menu text", /from bar agricole's menu/i.test(t) && t.includes("Cane & Cinnamon") && t.includes("$16") && t.includes("aged rum, cinnamon-honey, lime"), t.slice(0, 500));
  check("names the classic, linking to the library", await p.isVisible("#md-0 [data-open-std='std:daiquiri']") && /aged rum with a cinnamon-honey syrup/i.test(t));
  check("estimated spec, steps and confidence", t.includes("Likely close") && /double strain/i.test(t) && (await p.evaluate("document.querySelectorAll('#md-0 .md-spec tr').length")) === 3);
  check("house-made syrup has its own recipe", /how to make the cinnamon-honey syrup/i.test(t) && t.includes("2 cinnamon sticks") && /keeps:/i.test(t) && /shortcut:/i.test(t));
  check("compares with your bottles", /you have 1 of 2, plus 1 to make/i.test(await p.text("#md-0 .md-have")) && /you have everything/i.test(await p.text("#md-1 .md-have")), await p.text("#md-0 .md-have"));
  check("lime juice links to the citrus guide", await p.isVisible("#md-0 [data-md-howto='citrus']"));
  // save as your own
  await p.click("#md-0 [data-md-save]"); await p.waitForTimeout(200);
  const notes = await p.inputValue("#f-notes");
  check("save opens the editor with the spec, steps and syrup recipe", (await p.inputValue("#f-name")) === "Cane & Cinnamon" && notes.includes("Cinnamon-honey syrup:") && notes.includes("1. Shake hard") && (await p.inputValue("#ing-name-2")) === "Cinnamon-honey syrup", notes);
  check("…as a riff on its classic", (await p.inputValue("#f-classic")) === "Daiquiri");
  await p.click("#cancel-btn"); await p.waitForTimeout(100);
  // kept on the device
  check("the last menu is saved on this device", (await p.evaluate("JSON.parse(localStorage.getItem('mc-menu') || 'null')?.drinks?.length")) === 2);
  await p.reload(); await p.waitForTimeout(600);
  // (file:// storage doesn't always survive a reload in the test browser; check the reload only when it did)
  if (await p.evaluate("!!localStorage.getItem('mc-menu')")) {
    await p.evaluate("openMenuDecoder()"); await p.waitForTimeout(150);
    check("…and shown again after a reload, without a new request", (await p.text("#main")).includes("Bitter Garden") && (await p.evaluate("window.__menuCalls || 0")) === 0);
  }
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
  const q = await open({ user: null, home: true });
  check("Plan & explore links to it", await q.isVisible(".plan-row [data-home=menu]"));
  await q.close();
}
