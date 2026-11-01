import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open();
  check("loads with no errors", p.errors.length === 0, p.errors.join("; "));
  check("signed in shows My locker", (await p.text("#locker-btn")) === "My locker");
  const list = await p.text("#list");
  check("negroni versions grouped", /NEGRONI \| 2 versions/.test(list), list);
  check("rating shown in list", list.includes("★ 4.5"), list);
  await p.fill("#search", "daiquiri"); await p.waitForTimeout(100);
  check("standard recipe found by search", (await p.text("#list")).includes("Standard recipe"));
  await p.fill("#search", "zombie punch"); await p.waitForTimeout(100);
  check("lookup offered when nothing matches", await p.isVisible("#lookup-btn"));
  await p.fill("#search", "");
  await p.click("#list button[data-id='pk']");
  check("float shows on detail", (await p.text("#main")).includes("Float"));
  await p.fill("#servings", "8"); await p.press("#servings", "Enter");
  check("batch scales to 16 oz rum", (await p.text(".spec-table")).includes("16 | oz | Gold rum"), await p.text(".spec-table"));
  await p.setViewportSize({ width: 390, height: 844 });
  check("no sideways scroll on phone", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  check("no errors after interaction", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
