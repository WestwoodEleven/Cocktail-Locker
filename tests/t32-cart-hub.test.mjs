import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open({ user: "u1", width: 390, home: true });
  await p.click(".tabbar [data-nav=cart]"); await p.waitForTimeout(200);
  const tiles = await p.evaluate("[...document.querySelectorAll('.cart-grid .cart-tile')].map(b => b.dataset.cart)");
  check("My Cocktail Cart is a grid of icons, one per part", JSON.stringify(tiles) === JSON.stringify(["drinks", "favs", "log", "bottles", "canmake", "shop", "menus", "lists", "following"]), JSON.stringify(tiles));
  const hub = await p.text(".cart-grid");
  check("each icon has a count", /My drinks \| 2 drinks/.test(hub) && /Favorites \| 1 saved/.test(hub) && /My bottles \| 7 bottles/.test(hub) && /What can I make\? \| \d+ ready/.test(hub) && /Shopping list \| Nothing to buy/.test(hub), hub);
  const tops = await p.evaluate("[...document.querySelectorAll('.cart-tile')].slice(0, 4).map(b => Math.round(b.getBoundingClientRect().top))");
  check("three across on a phone", tops[0] === tops[1] && tops[1] === tops[2] && tops[3] > tops[0], JSON.stringify(tops));
  check("no drink filters beside or under it", !(await p.isVisible("#flt-owner")) && await p.evaluate("document.body.classList.contains('on-home')"));
  check("no sideways scroll", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  check("Account sits under the icons; no admin rows for members", await p.isVisible("#prof-account-open") && !(await p.evaluate("!!document.getElementById('prof-admin')")));
  // each icon opens its own page, with ‹ Back and the cart tab still marked
  const pages = [["drinks", "My drinks", "#cart-drinks", "#prof-drink-add"], ["favs", "Favorites", "#cart-favorites", "#prof-favs"], ["log", "My log", "#cart-log", "#prof-log"],
    ["bottles", "My bottles", "#cart-bottles", "#prof-bottle-add"], ["menus", "Decoded menus", "#cart-menus", "#prof-menu-new"], ["lists", "My lists", "#cart-lists", "#prof-lists"],
    ["following", "Following", "#cart-following", "#prof-following"]];
  for (const [k, title, hash, el] of pages) {
    await p.evaluate("openProfile()"); await p.waitForTimeout(80);
    await p.click(`[data-cart=${k}]`); await p.waitForTimeout(150);
    const ok = (await p.text("#main .make-title")).trim() === title && (await p.evaluate("location.hash")) === hash && await p.evaluate(`!!document.querySelector(${JSON.stringify(el)})`)
      && await p.isVisible("#cart-back") && (await p.getAttribute(".tabbar [data-nav=cart]", "aria-current")) === "page";
    check(`${title} opens as its own page`, ok, `${await p.text("#main .make-title")} ${await p.evaluate("location.hash")}`);
  }
  check("a section's note moves under the page title", /only you can see these/i.test(await (async () => { await p.evaluate("openCartSec('favs')"); await p.waitForTimeout(80); return p.text(".cart-note"); })()));
  // What can I make? and the Shopping list are their own pages already
  await p.evaluate("openProfile()"); await p.waitForTimeout(80);
  await p.click("[data-cart=canmake]"); await p.waitForTimeout(150);
  check("What can I make? opens it", (await p.evaluate("S.view")) === "canmake");
  await p.evaluate("openProfile()"); await p.waitForTimeout(80);
  await p.click("[data-cart=shop]"); await p.waitForTimeout(150);
  check("Shopping list opens it", (await p.evaluate("S.view")) === "shop");
  // ‹ Back and the tab both return to the icons
  await p.evaluate("openProfile()"); await p.waitForTimeout(80);
  await p.click("[data-cart=bottles]"); await p.waitForTimeout(150);
  await p.click("#cart-back"); await p.waitForTimeout(250);
  check("‹ Back returns to the icons", await p.isVisible(".cart-grid") && (await p.evaluate("location.hash")) === "#my-locker", await p.evaluate("location.hash"));
  await p.click("[data-cart=favs]"); await p.waitForTimeout(150);
  await p.click(".tabbar [data-nav=cart]"); await p.waitForTimeout(150);
  check("the cart tab on a sub-page returns to the icons", await p.isVisible(".cart-grid"));
  // other ways in land on the right page
  await p.evaluate("navGo('bar')"); await p.waitForTimeout(150);
  check("links to My bottles open that page", (await p.text("#main .make-title")).trim() === "My bottles");
  await p.evaluate("openCartSec('account')"); await p.waitForTimeout(100);
  check("Account has the delete button and who's signed in", await p.isVisible("#prof-delete"));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
  // a link straight to a sub-page
  const q = await open({ user: "u1", width: 390, hash: "#cart-bottles", home: true });
  await q.waitForTimeout(300);
  check("a link to #cart-bottles opens My bottles", (await q.text("#main .make-title")).trim() === "My bottles" && await q.isVisible("#chips-liquors"));
  check("no errors", q.errors.length === 0, q.errors.join("; "));
  await q.close();
  // admins get their pages as rows under Account
  const t = (await import("./harness.mjs")).sample(); t.site_admins = [{ user_id: "u1" }];
  const a = await open({ user: "u1", tables: t, width: 390, home: true });
  await a.evaluate("navGo('cart')"); await a.waitForTimeout(250);
  const rows = await a.evaluate("[...document.querySelectorAll('.cart-rows li')].map(li => li.innerText.replace(/\\s+/g, ' ').trim())");
  check("admins see Admin rows: Site stats, Review reports, Review photos", rows[0].startsWith("Account") && rows[1] === "Admin" && rows.slice(2).map(r => r.replace(/ ?›$/, "").replace(/ \d+$/, "")).join("|") === "Site stats|Review reports|Review photos", JSON.stringify(rows));
  check("no errors", a.errors.length === 0, a.errors.join("; "));
  await a.close();
}
