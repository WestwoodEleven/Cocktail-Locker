import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open({ user: null, width: 390 });
  await p.evaluate("$('auth-btn').click()"); await p.waitForTimeout(100);
  check("the code box waits until the email is sent", !(await p.isVisible("#signin-code-row")));
  await p.fill("#signin-email", "me@example.com"); await p.check("#signin-age");
  await p.click("#signin-send"); await p.waitForTimeout(150);
  check("after sending, a code box appears", await p.isVisible("#signin-code") && /type the code/i.test(await p.text("#signin-msg")));
  await p.fill("#signin-code", "999999"); await p.click("#signin-code-btn"); await p.waitForTimeout(150);
  check("a wrong code says so", /didn't work/i.test(await p.text("#signin-msg")) && await p.isVisible("#signin"));
  await p.fill("#signin-code", "123 456"); await p.press("#signin-code", "Enter"); await p.waitForTimeout(150);
  const v = await p.evaluate("window.__MOCK.lastVerify");
  check("the right code signs in with that email", v.email === "me@example.com" && v.token === "123456" && v.type === "email" && !(await p.isVisible("#signin")), JSON.stringify(v));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
