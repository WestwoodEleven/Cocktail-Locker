import { open, check } from "./harness.mjs";
// The fake bartender: answers with two drinks, or a short reply to a follow-up; the first follow-up after an error works.
const invoke = `async (name, body) => {
  window.__asks = (window.__asks || []).concat([body]);
  await new Promise(r => setTimeout(r, 120));
  if (body.mode !== "ask") return { data: null, error: { name: "FunctionsFetchError" } };
  const last = body.messages[body.messages.length - 1].text;
  if (/fail please/.test(last)) return { data: null, error: { name: "FunctionsFetchError" } };
  if (/less sweet/i.test(last)) return { data: { answer: "Cut the syrup to a half ounce.", drinks: [
    { name: "Drier Gimlet", method: "Shaken", glass: "Coupe", type: "Sour", base: "Gin", ingredients: [{ amount: 2, unit: "oz", name: "Gin" }, { amount: 0.5, unit: "oz", name: "Simple syrup" }, { amount: 0.75, unit: "oz", name: "Lime juice" }], notes: "Shake hard.", why: "Tarter.", need: [] }] }, error: null };
  return { data: { answer: "Here are two bright ones.", drinks: [
    { name: "Gimlet", method: "Shaken", glass: "Coupe", type: "Sour", base: "Gin", classic: "Gimlet", ingredients: [{ amount: 2, unit: "oz", name: "Gin" }, { amount: 0.75, unit: "oz", name: "Simple syrup" }, { amount: 0.75, unit: "oz", name: "Lime juice" }], notes: "Shake hard, strain into a chilled coupe.", why: "Uses your gin.", need: ["Limes"] },
    { name: "Gin Rickey", method: "Built", glass: "Highball", type: "Highball", base: "Gin", ingredients: [{ amount: 2, unit: "oz", name: "Gin" }, { amount: 0.5, unit: "oz", name: "Lime juice" }, { amount: 4, unit: "oz", name: "Soda water" }], notes: "Build over ice.", why: "Light and dry.", need: [] }] }, error: null };
}`;
export default async function () {
  const p = await open({ invoke, width: 390, home: true });
  await p.click(".tabbar [data-nav=ask]"); await p.waitForTimeout(100);
  check("Ask page opens with quick starts", /ask the bartender/i.test(await p.text("#main")) && (await p.evaluate("document.querySelectorAll('[data-ask-start]').length")) === 5 && (await p.evaluate("location.hash")) === "#ask");
  check("Bartender tab marked", (await p.getAttribute(".tabbar [data-nav=ask]", "aria-current")) === "page");
  await p.click("[data-ask-start='4']");
  check("Look up a classic fills the box to finish", (await p.inputValue("#ask-in")) === "What's the classic recipe for " && await p.evaluate("document.activeElement.id") === "ask-in");
  await p.fill("#ask-in", "Something refreshing with gin");
  await p.click("#ask-form button[type=submit]"); await p.waitForTimeout(40);
  check("shows the question and a working state", /something refreshing with gin/i.test(await p.text("#ask-thread")) && /mixing up an answer/i.test(await p.text("#ask-thread")));
  await p.waitForTimeout(300);
  const t = await p.text("#ask-thread");
  check("answer and drink cards shown", t.includes("Here are two bright ones.") && (await p.evaluate("document.querySelectorAll('.ask-drink').length")) === 2, t);
  check("cards show amounts, what you'll need and a glass", t.includes("Gin") && /you'll need/i.test(t) && t.includes("Limes") && (await p.evaluate("!!document.querySelector('.ask-drink .glassbox svg')")));
  const sent = await p.evaluate("window.__asks[0]");
  check("sends the question with your bottles", sent.mode === "ask" && sent.useBar === true && sent.bar.liquors.includes("Gin") && sent.messages.length === 1);
  await p.fill("#ask-in", "less sweet"); await p.press("#ask-in", "Enter"); await p.waitForTimeout(350);
  const sent2 = await p.evaluate("window.__asks[1]");
  check("follow-up carries the conversation", sent2.messages.length === 3 && sent2.messages[1].role === "bartender" && sent2.messages[1].drinks.join() === "Gimlet,Gin Rickey");
  check("follow-up answer added below", (await p.text("#ask-thread")).includes("Drier Gimlet"));
  await p.uncheck("#ask-bar");
  await p.fill("#ask-in", "fail please"); await p.press("#ask-in", "Enter"); await p.waitForTimeout(300);
  check("errors offer a retry", await p.isVisible("#ask-retry"));
  check("Use my bottles off is sent", (await p.evaluate("window.__asks[2].useBar")) === false && (await p.evaluate("window.__asks[2].bar")) === null);
  await p.click("[data-ask-save='1:0']"); await p.waitForTimeout(150);
  check("Save opens the editor filled in", (await p.inputValue("#f-name")) === "Gimlet" && /ask the bartender/i.test(await p.text(".scan-banner")));
  await p.evaluate("openAsk()"); await p.waitForTimeout(100);
  check("conversation kept when you come back", (await p.text("#ask-thread")).includes("Drier Gimlet"));
  await p.click("[data-ask-make='1:1']"); await p.waitForTimeout(150);
  check("Make it opens make mode", (await p.text("#make-mode")).includes("Gin Rickey"));
  await p.click("#mm-close");
  await p.click("#ask-reset"); await p.waitForTimeout(100);
  check("Start over clears it", !(await p.evaluate("document.querySelector('.ask-drink')")) && (await p.evaluate("document.querySelectorAll('[data-ask-start]').length")) === 5);
  check("no sideways scroll on phone", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();

  const q = await open({ user: null, home: true });
  await q.evaluate("openAsk()"); await q.waitForTimeout(100);
  check("signed out: asked to sign in, no question box", /sign in to ask the bartender/i.test(await q.text("#main")) && !(await q.isVisible("#ask-in")));
  await q.close();
}
