import { open, check } from "./harness.mjs";
const invoke = `async (name, body) => {
  await new Promise(r => setTimeout(r, 150));
  if (body.mode === "substitute") return { data: { options: [
    { name: "Aperol", amount: 1, unit: "oz", why: "Lighter and more orange.", adjust: "", in_bar: false },
    { name: "Sweet vermouth", amount: 1.5, unit: "oz", why: "Less bitter.", adjust: "Add a dash of Angostura.", in_bar: true } ] }, error: null };
  return { data: null, error: { name: "FunctionsFetchError" } };
}`;
export default async function () {
  const p = await open({ invoke });
  await p.pick('neg-1');
  check("no Swap button on each ingredient, one Missing something? link", (await p.evaluate("document.querySelectorAll('.spec-table .swap').length")) === 0 && await p.isVisible("#missing-btn"));
  await p.click("#missing-btn"); await p.waitForTimeout(50);
  check("it asks what you're missing, listing the ingredients", /what are you missing/i.test(await p.text("#swap-title")) && (await p.evaluate("document.querySelectorAll('#swap-body [data-miss]').length")) === 3);
  await p.click("#swap-body [data-miss='1']"); await p.waitForTimeout(50);
  check("swap shows loading", (await p.text("#swap-body")).includes("Finding substitutes"));
  await p.waitForTimeout(300);
  const t = await p.text("#swap-body");
  check("swap options listed", t.includes("Aperol") && t.includes("In your bottles") && t.includes("Add a dash of Angostura"), t);
  check("request sent the right ingredient", (await p.evaluate("window.__MOCK.lastInvoke.index")) === 1);
  await p.click("#swap-body [data-use='0']"); await p.waitForTimeout(100);
  check("make my version opens editor with swap", (await p.inputValue("#f-name")) === "Negroni (with Aperol)" && (await p.inputValue("#ing-name-1")) === "Aperol");
  await p.click("#cancel-btn");
  // second time is cached (no new request)
  await p.evaluate("window.__MOCK.lastInvoke = null");
  await p.click("#missing-btn"); await p.click("#swap-body [data-miss='1']"); await p.waitForTimeout(50);
  check("swap results cached", (await p.evaluate("window.__MOCK.lastInvoke")) === null && (await p.text("#swap-body")).includes("Aperol"));
  await p.keyboard.press("Escape");
  check("Escape closes swap", await p.isHidden("#swap-modal"));
  check("Make it is gone from recipes", !(await p.evaluate("!!document.getElementById('makeit-btn')")));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
  const q = await open({ user: null });
  await q.pick('neg-1');
  check("signed out: no swap link, Ask still there", !(await q.evaluate("!!document.getElementById('missing-btn')")) && await q.isVisible("#ask-recipe-btn"));
  await q.close();
}
