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
  check("swap buttons on ingredients", (await p.evaluate("document.querySelectorAll('.spec-table .swap').length")) === 3);
  await p.click(".spec-table .swap[data-swap='1']"); await p.waitForTimeout(50);
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
  await p.click(".spec-table .swap[data-swap='1']"); await p.waitForTimeout(50);
  check("swap results cached", (await p.evaluate("window.__MOCK.lastInvoke")) === null && (await p.text("#swap-body")).includes("Aperol"));
  await p.keyboard.press("Escape");
  check("Escape closes swap", await p.isHidden("#swap-modal"));
  // make mode
  await p.pick('pk'); await p.fill("#servings", "2"); await p.press("#servings", "Enter");
  await p.click("#makeit-btn"); await p.waitForTimeout(100);
  const mm = await p.text("#make-mode");
  check("make mode shows doubled amounts", mm.includes("4 | oz | Gold rum") || mm.includes("4 oz | Gold rum"), mm.slice(0, 300));
  check("float comes last", (await p.evaluate("[...document.querySelectorAll('.mm-n')].pop().textContent")).startsWith("Dark rum"));
  check("steps include float and method", mm.includes("Float Dark rum on top.") && mm.includes("Shake hard"));
  await p.click(".mm-ing[data-k='0']"); await p.click(".mm-ing[data-k='1']");
  check("progress counts poured", (await p.text("#mm-progress")) === "2 of 5 poured");
  await p.setViewportSize({ width: 390, height: 844 });
  check("make mode fits phone", (await p.evaluate("document.querySelector('#make-mode').scrollWidth")) <= 390);
  await p.click("#mm-done");
  check("done closes make mode", await p.isHidden("#make-mode"));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
  const q = await open({ user: null });
  await q.pick('neg-1');
  check("signed out: no swap buttons, Make it still there", (await q.evaluate("document.querySelectorAll('.swap').length")) === 0 && await q.isVisible("#makeit-btn"));
  await q.close();
}
