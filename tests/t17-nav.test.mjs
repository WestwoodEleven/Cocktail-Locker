import { open, check } from "./harness.mjs";
export default async function () {
  // Back button walks back through the site
  const p = await open({ width: 390, home: true });
  await p.evaluate("showList(null)"); await p.waitForTimeout(100);
  await p.evaluate("window.scrollTo(0, 120); S._browseY = 120");
  await p.pick("pk"); await p.waitForTimeout(100);
  check("opening a drink adds a history step", (await p.evaluate("location.hash")) === "#pk" && (await p.evaluate("history.length")) >= 3);
  await p.goBack(); await p.waitForTimeout(200);
  check("Back from a recipe returns to All drinks", (await p.evaluate("S.view")) === "browse" && (await p.evaluate("location.hash")) === "#drinks");
  await p.goBack(); await p.waitForTimeout(200);
  check("Back again returns home", (await p.evaluate("S.view")) === "home");
  await p.goForward(); await p.waitForTimeout(200);
  check("Forward works too", (await p.evaluate("S.view")) === "browse");
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();

  // Recipe actions: four visible plus More, pinned on phones
  const r = await open({ width: 390, hash: "#rita", home: true });
  const vis = await r.evaluate("[...document.querySelectorAll('.recipe-bar button')].map(b => b.textContent.trim())");
  check("recipe bar shows Make it, Mocktail, Share, heart and More", JSON.stringify(vis) === JSON.stringify(["Make it", "Mocktail", "Share", "♡", "⋯ More"]), JSON.stringify(vis));
  check("recipe bar is pinned on phones", (await r.evaluate("getComputedStyle(document.querySelector('.recipe-bar')).position")) === "sticky");
  await r.click("#more-btn"); await r.waitForTimeout(50);
  const more = await r.text("#gen-body");
  check("More has the other actions", /add to list/i.test(more) && /party plan/i.test(more) && /edit/i.test(more) && /delete/i.test(more), more);
  await r.click("[data-proxy='edit-btn']"); await r.waitForTimeout(100);
  check("More › Edit opens the editor", await r.isVisible("#f-name") && (await r.inputValue("#f-name")) === "Mitch-A-Rita");
  check("no sideways scroll on phone", (await r.evaluate("document.documentElement.scrollWidth")) <= 390);
  check("no errors", r.errors.length === 0, r.errors.join("; "));
  await r.close();

  // Tools have homes; pop-ups come up from the bottom on phones
  const h = await open({ width: 390, home: true });
  check("home has Plan & explore", /plan & explore/i.test(await h.text("#main")) && await h.isVisible(".plan-row [data-home=guide]") && await h.isVisible(".plan-row [data-home=canmake]"));
  await h.click(".plan-row [data-home=guide]"); await h.waitForTimeout(100);
  check("Plan & explore opens the bottle guide", (await h.evaluate("S.view")) === "guide");
  await h.click(".tabbar [data-nav=cart]"); await h.waitForTimeout(150);
  check("My bottles links to What can I make?", await h.isVisible("#prof-canmake"));
  await h.click("#acct-btn"); await h.waitForTimeout(400);
  const box = await h.locator("#gen-modal .sheet").boundingBox();
  const vh = await h.evaluate("innerHeight");
  check("pop-ups sit at the bottom of the phone screen", box && Math.abs(box.y + box.height - vh) < 4 && box.width >= 389, JSON.stringify(box) + " vh " + vh);
  await h.click("#acct-canmake"); await h.waitForTimeout(100);
  check("account menu opens What can I make?", (await h.evaluate("S.view")) === "canmake");
  check("no errors", h.errors.length === 0, h.errors.join("; "));
  await h.close();
}
