import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open({ user: "u1", width: 390 });
  const tab = () => p.evaluate("document.querySelector('.tabbar [aria-current]')?.dataset.nav || ''");
  const pages = [["openCanMake()", "cart"], ["openShop()", "cart"], ["openParty()", "home"], ["openGuide()", "home"], ["openMenuDecoder()", "ask"]];
  for (const [js, want] of pages) {
    await p.evaluate(js); await p.waitForTimeout(150);
    const back = await p.evaluate("[...document.querySelectorAll('#main .back-link')].map(b => b.textContent.trim())");
    check(`${js}: one "‹ Back" link and the ${want} tab is marked`, back.length === 1 && back[0] === "‹ Back" && (await tab()) === want, JSON.stringify(back) + " " + (await tab()));
    check(`${js}: no "Back to drinks" button`, !(await p.text("#main")).includes("Back to drinks"));
  }
  await p.evaluate("navGo('ask')"); await p.waitForTimeout(150);
  check("tab pages have no back link", !(await p.evaluate("!!document.querySelector('#main .back-link')")) && (await tab()) === "ask");
  await p.evaluate("openGuide()"); await p.waitForTimeout(100); await p.click("#gd-back"); await p.waitForTimeout(150);
  check("Back goes back", (await p.evaluate("S.view")) === "ask", await p.evaluate("S.view"));
  await p.evaluate("$('acct-btn').click()"); await p.waitForTimeout(150);
  const menu = await p.evaluate("[...document.querySelectorAll('.acct-grp')].map(x => x.textContent)");
  check("the menu is grouped like the tabs", menu.slice(0, 3).join("|") === "Home|Bartender|My Cocktail Cart", JSON.stringify(menu));
  check("the menu carries 21+ and the legal links", /21\+/.test(await p.text("#gen-modal")) && /Terms/.test(await p.text("#gen-modal")));
  await p.evaluate("closeSheet(); navGo('cart')"); await p.waitForTimeout(150);
  check("cart page title matches the tab; cart name under it", /^My Cocktail Cart$/.test((await p.text("#main .make-title")).trim()) && await p.isVisible("#prof-rename"));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
