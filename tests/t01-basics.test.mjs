import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open();
  check("loads with no errors", p.errors.length === 0, p.errors.join("; "));
  check("signed in shows My cart", (await p.text("#locker-btn")) === "My cart");
  const list = await p.text("#list");
  check("negroni versions grouped", /negroni \| 2 versions/i.test(list), list);
  check("rating shown in list", list.includes("★ 4.5"), list);
  await p.fill("#search", "daiquiri"); await p.waitForTimeout(100);
  check("standard recipe found by search", (await p.text("#list")).includes("Standard recipe"));
  await p.fill("#search", "zombie punch"); await p.waitForTimeout(100);
  check("lookup offered when nothing matches", await p.isVisible("#lookup-btn"));
  await p.fill("#search", "");
  await p.pick('pk');
  check("float shows on detail", (await p.text("#main")).includes("Float"));
  await p.fill("#servings", "8"); await p.press("#servings", "Enter");
  check("batch scales to 16 oz rum", (await p.text(".spec-table")).includes("16 | oz | Gold rum"), await p.text(".spec-table"));
  check("stepper sits in the spec heading", /spec for/i.test(await p.text(".spec-head")) && /drinks/i.test(await p.text(".spec-head")));
  check("old How many and container boxes are gone", !(await p.evaluate("!!document.getElementById('fill')")));
  // batch it: 1 gallon of Painkiller (7 oz a drink, shaken dilution)
  await p.click("#batch-open"); await p.waitForTimeout(50);
  check("batch pop-up offers ounces, liters and gallons", JSON.stringify(await p.evaluate("[...document.querySelectorAll('#bf-unit option')].map(o => o.textContent)")) === JSON.stringify(["ounces", "liters", "gallons"]));
  await p.fill("#bf-size", "1"); await p.selectOption("#bf-unit", "gal"); await p.click("#bf-form button[type=submit]"); await p.waitForTimeout(100);
  const n = Number(await p.inputValue("#servings"));
  check("batch fills a gallon", n >= 17 && n <= 19 && /fill 1 gallon/i.test(await p.text(".spec-block")), String(n));
  await p.click("#batch-clear"); await p.waitForTimeout(50);
  check("back to 1 drink", (await p.inputValue("#servings")) === "1");
  await p.click("#plus"); await p.waitForTimeout(50);
  await p.pick('neg-1'); await p.waitForTimeout(50);
  check("every drink opens at 1", (await p.inputValue("#servings")) === "1");
  await p.setViewportSize({ width: 390, height: 844 });
  check("no sideways scroll on phone", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  check("no errors after interaction", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
