import { open, check } from "./harness.mjs";
// The first attempt fails; the second succeeds and removes u1's drinks, as the database would.
const invoke = `async (name, body) => {
  window.__calls = (window.__calls || 0) + 1;
  await new Promise(r => setTimeout(r, 100));
  if (window.__calls === 1) return { data: null, error: { name: "FunctionsFetchError" } };
  window.__MOCK.tables.drinks = window.__MOCK.tables.drinks.filter(d => d.owner !== "u1");
  return { data: { deleted: true }, error: null };
}`;
export default async function () {
  const p = await open({ invoke });
  await p.click("#locker-btn"); await p.waitForTimeout(150);
  await p.click("#prof-account-open"); await p.waitForTimeout(150);
  check("Account (from My cart) has a delete account button", await p.isVisible("#prof-delete") && /signed in as/i.test(await p.text("#main")));
  await p.click("#prof-delete");
  const t = await p.text("#gen-body");
  check("confirmation explains what goes", t.includes("permanently deletes") && t.includes("can't be undone") && /your \d+ drinks?/.test(t), t);
  check("delete disabled until DELETE typed", await p.isDisabled("#del-go"));
  await p.fill("#del-confirm", "delet");
  check("still disabled with a typo", await p.isDisabled("#del-go"));
  await p.click("#del-keep");
  check("Keep my account closes it", !(await p.isVisible("#gen-modal")) && !(await p.evaluate("window.__calls")));
  await p.click("#prof-delete");
  await p.fill("#del-confirm", "delete");
  check("lowercase delete accepted", !(await p.isDisabled("#del-go")));
  await p.click("#del-go"); await p.waitForTimeout(250);
  check("failure shown and nothing changed", (await p.text("#del-msg")).includes("Couldn't reach") && !(await p.isDisabled("#del-go")) && await p.isVisible("#gen-modal"));
  await p.click("#del-go"); await p.waitForTimeout(400);
  const sent = await p.evaluate("window.__MOCK.lastInvoke");
  check("asks the server to delete, confirmed", sent.mode === "delete_account" && sent.confirm === "DELETE");
  check("sheet closes and says it's done", !(await p.isVisible("#gen-modal")) && (await p.text("#toast")).includes("account has been deleted"));
  check("their drinks are gone from the list", !(await p.evaluate("[...document.querySelectorAll('#list button[data-id]')].some(b => b.dataset.id === 'rita')")));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
