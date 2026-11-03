import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open({ user: null, width: 390, home: true });
  const t = await p.text("#main");
  check("new visitors land on the home page", /house specs/i.test(t) && /sign in or join free/i.test(t), t.slice(0, 200));
  check("drink of the day shown", await p.isVisible(".home-day") && /see the spec/i.test(await p.text(".home-day")));
  check("top rated and just added listed", /top rated/i.test(t) && /just added/i.test(t), t);
  check("browse by style and base", await p.isVisible(".home-browse [data-f=type]") && await p.isVisible(".home-browse [data-f=base]"));
  check("what an account adds explained", /what can I make/i.test(t) && /plan a party/i.test(t));
  check("drink list hidden on the home page", !(await p.isVisible("#list")));
  check("phone tab bar shown", await p.isVisible(".tabbar") && (await p.getAttribute(".tabbar [data-nav=home]", "aria-current")) === "page");
  check("no sideways scroll on phone", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  await p.click(".home-day"); await p.waitForTimeout(150);
  check("drink of the day opens the recipe", await p.isVisible("#makeit-btn") && (await p.evaluate("location.hash")).length > 1);
  check("recipe page has no list, filters or tools beside it", !(await p.isVisible("#list")) && !(await p.isVisible("#find-title")) && !(await p.isVisible("#tools-title")));
  await p.click("#to-list"); await p.waitForTimeout(100);
  check("All drinks link opens the list page", await p.isVisible("#list") && await p.isVisible("#find-title") && !(await p.isVisible("#main")) && (await p.evaluate("location.hash")) === "#drinks");
  await p.click("#home-link"); await p.waitForTimeout(100);
  await p.click("#home-link"); await p.waitForTimeout(150);
  check("logo goes back home", /house specs/i.test(await p.text("#main")) && (await p.evaluate("location.hash")) === "");
  await p.click(".home-browse [data-v=Tiki]"); await p.waitForTimeout(150);
  const ids1 = await p.evaluate("[...document.querySelectorAll('#list button[data-id]')].map(b => b.dataset.id)");
  check("style shortcut filters the list", ids1.length === 1 && ids1[0] === "pk", JSON.stringify(ids1));
  await p.click(".tabbar [data-nav=home]"); await p.waitForTimeout(100);
  await p.fill("#search", "campari"); await p.waitForTimeout(150);
  const ids = await p.evaluate("[...document.querySelectorAll('#list button[data-id]')].map(b => b.dataset.id)");
  check("typing in the top search from home shows matches", ids.length > 0 && ids.every(id => id.startsWith("neg")) && await p.evaluate("document.activeElement.id") === "search", JSON.stringify(ids));
  await p.fill("#search", ""); await p.click(".tabbar [data-nav=home]"); await p.waitForTimeout(100);
  await p.click("[data-home=signin]"); await p.waitForTimeout(100);
  check("sign in button opens sign-in", await p.isVisible("#signin-email"));
  await p.click(".tabbar [data-nav=bar]"); await p.waitForTimeout(100);
  check("My bar tab asks signed-out visitors to sign in", await p.isVisible("#signin-email"));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();

  const q = await open({ home: true });
  const t2 = await q.text("#main");
  check("signed in: welcome back, no sign-in prompt", /welcome back/i.test(t2) && !/sign in or join/i.test(t2), t2.slice(0, 200));
  check("drinks without photos get a glass drawing", await q.evaluate("!!document.querySelector('.tile .glassbox svg')"));
  check("signed-in welcome is just a greeting", /welcome back/i.test(t2) && !(await q.evaluate("!!document.querySelector('.home-tile, .home-add, .home-top.signed .home-title')")));
  await q.click(".topnav [data-nav=guide]"); await q.waitForTimeout(100);
  check("top nav opens the bottle guide and marks it", (await q.getAttribute(".topnav [data-nav=guide]", "aria-current")) === "page");
  await q.close();

  const m = await open({ width: 390, home: true });
  check("phone tabs are Home, Bartender, My drinks, My bottles", JSON.stringify(await m.evaluate("[...document.querySelectorAll('.tabbar button')].map(b => b.textContent.trim())")) === JSON.stringify(["Home", "Bartender", "My drinks", "My bottles"]));
  await m.click(".tabbar [data-nav=mine]"); await m.waitForTimeout(400);
  check("My drinks opens your drinks on My cart", /my drinks/i.test(await m.text("#prof-drinks")) && (await m.evaluate("Math.abs(document.getElementById('prof-drinks').getBoundingClientRect().top)")) < 60);
  check("My drinks tab marked", (await m.getAttribute(".tabbar [data-nav=mine]", "aria-current")) === "page");
  await m.click(".tabbar [data-nav=bar]"); await m.waitForTimeout(400);
  check("My bottles tab marked instead", (await m.getAttribute(".tabbar [data-nav=bar]", "aria-current")) === "page" && !(await m.getAttribute(".tabbar [data-nav=mine]", "aria-current")));
  await m.click(".tabbar [data-nav=home]"); await m.waitForTimeout(150);
  check("Home tab returns home and clears the filter", /welcome back/i.test(await m.text("#main")) && (await m.evaluate("S.f.owner")) === "");
  check("no errors", m.errors.length === 0, m.errors.join("; "));
  await m.close();

  const f = await open({ hash: "#rita", home: true });
  check("recipe total uses readable fractions", await f.evaluate("!!document.querySelector('.totals .fr')"), await f.text(".totals"));
  await f.close();

  const r = await open({ hash: "#neg-1", home: true });
  check("a link to a drink still opens the drink", /negroni/i.test(await r.text(".drink-name")));
  check("recipe without a photo shows its glass", await r.evaluate("!!document.querySelector('.photo.glassfig svg')"));
  await r.close();
}
