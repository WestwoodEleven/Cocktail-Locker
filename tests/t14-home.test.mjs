import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open({ user: null, width: 390 });
  const t = await p.text("#main");
  check("new visitors land on the home page", t.includes("Great cocktails") && t.includes("Sign in or join free"), t.slice(0, 200));
  check("drink of the day shown", await p.isVisible(".home-feat") && (await p.text(".home-feat")).includes("See the recipe"));
  check("top rated and newest listed", /top rated/i.test(t) && /newest/i.test(t) && /\d+ bottles in the guide/.test(t), t);
  check("what you can do explained", t.includes("Batch any recipe") && t.includes("Bottle guide"));
  check("home comes first on a phone", await p.evaluate("document.getElementById('main').getBoundingClientRect().top < document.querySelector('aside').getBoundingClientRect().top"));
  check("no sideways scroll on phone", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  await p.click(".home-feat"); await p.waitForTimeout(150);
  check("drink of the day opens the recipe", await p.isVisible("#makeit-btn") && (await p.evaluate("location.hash")).length > 1);
  check("recipe page puts the list back first on a phone", await p.evaluate("document.getElementById('main').getBoundingClientRect().top > document.querySelector('aside').getBoundingClientRect().top"));
  await p.click("#home-link"); await p.waitForTimeout(150);
  check("logo goes back home", (await p.text("#main")).includes("Great cocktails") && (await p.evaluate("location.hash")) === "");
  await p.fill("#home-q", "campari"); await p.click("#home-search button"); await p.waitForTimeout(150);
  const ids = await p.evaluate("[...document.querySelectorAll('#list button[data-id]')].map(b => b.dataset.id)");
  check("home search filters the list", ids.length > 0 && ids.every(id => id.startsWith("neg")) && (await p.inputValue("#search")) === "campari", JSON.stringify(ids));
  await p.click("#home-link"); await p.waitForTimeout(100);
  await p.click("[data-home=signin]"); await p.waitForTimeout(100);
  check("sign in button opens sign-in", await p.isVisible("#signin-email"));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();

  const q = await open({});
  const t2 = await q.text("#main");
  check("signed in: welcome back with quick actions", /welcome back/i.test(t2) && t2.includes("What can I make?") && !t2.includes("Sign in or join"), t2.slice(0, 200));
  await q.click("[data-home=cart]"); await q.waitForTimeout(100);
  check("My cart quick action works", (await q.text("#main")).includes("My drinks") || /my drinks/i.test(await q.text("#main")));
  await q.close();

  const r = await open({ hash: "#neg-1" });
  check("a link to a drink still opens the drink", (await r.text(".drink-name")) === "Negroni");
  await r.close();
}
