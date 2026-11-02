import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open({ adult: false, user: null, width: 390 });
  check("first visit shows the age check", await p.isVisible("#age-gate") && (await p.text("#age-gate")).includes("legal drinking age"));
  check("Yes button has focus", await p.evaluate("document.activeElement.id") === "age-yes");
  await p.click("#age-no");
  check("No shows a sorry message and no way in", (await p.text("#age-gate")).includes("come back when you're 21") && !(await p.isVisible("#age-yes")));
  await p.reload(); await p.waitForTimeout(300);
  check("still asked after reload", await p.isVisible("#age-yes"));
  await p.click("#age-yes");
  check("Yes lets you in", !(await p.isVisible("#age-gate")) && await p.isVisible("#list"));
  await p.reload(); await p.waitForTimeout(300);
  check("remembered on this device", !(await p.isVisible("#age-gate")));

  await p.click("#auth-btn");
  check("sign-in asks to confirm 21+", await p.isVisible("#signin-age") && (await p.text("#signin")).includes("21 or older"));
  await p.fill("#signin-email", "new@example.com");
  await p.click("#signin button[type=submit]"); await p.waitForTimeout(100);
  check("can't send a link without ticking it", !(await p.text("#signin-msg")).includes("Check your email"));
  await p.check("#signin-age");
  await p.click("#signin button[type=submit]"); await p.waitForTimeout(100);
  check("sends once ticked", (await p.text("#signin-msg")).includes("Check your email"));
  check("no sideways scroll on phone", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
