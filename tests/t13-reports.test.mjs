import { open, check, sample } from "./harness.mjs";
export default async function () {
  // A regular person reports things
  const tables = sample();
  tables.ratings = (tables.ratings || []).concat([{ drink_id: "neg-1", user_id: "u2", stars: 2, note: "Buy cheap watches at spam.example" }]);
  const p = await open({ tables });
  await p.click("#list button[data-id='neg-1']"); await p.waitForTimeout(100);
  check("someone else's drink can be reported", await p.isVisible("text=Report this drink"));
  check("their rating note can be reported", await p.isVisible(".rnotes .report-link"));
  await p.click("text=Report this drink");
  check("report sheet asks what's wrong", /what's wrong\?/i.test(await p.text("#gen-body")) && (await p.text("#gen-body")).includes("Spam or advertising"));
  await p.check("input[name=rp-reason][value=offensive]");
  await p.fill("#rp-details", "Rude name");
  await p.click("#rp-send"); await p.waitForTimeout(100);
  const rep = await p.evaluate("window.__MOCK.tables.reports");
  check("report saved with reason, owner and snapshot", rep.length === 1 && rep[0].kind === "drink" && rep[0].target === "neg-1" && rep[0].target_owner === "u2" && rep[0].reason === "offensive" && rep[0].details === "Rude name" && rep[0].snapshot === "Negroni" && rep[0].reporter === "u1", JSON.stringify(rep));
  check("thanks shown", (await p.text("#toast")).includes("admin will take a look"));
  await p.click("text=Report this drink"); await p.click("#rp-send"); await p.waitForTimeout(100);
  check("reporting twice is handled", (await p.text("#toast")).includes("already reported") && (await p.evaluate("window.__MOCK.tables.reports.length")) === 1);
  await p.click(".rnotes .report-link"); await p.click("#rp-send"); await p.waitForTimeout(100);
  check("note reported", (await p.evaluate("window.__MOCK.tables.reports.some(r => r.kind === 'note' && r.target === 'neg-1|u2')")));
  await p.click("#list button[data-id='rita']"); await p.waitForTimeout(100);
  check("no report link on your own drink", !(await p.isVisible("text=Report this drink")));
  await p.click(".who[data-locker='u2'], [data-locker='u2']").catch(() => {});
  await p.evaluate("openLocker('u2')"); await p.waitForTimeout(100);
  check("carts can be reported", await p.isVisible("text=Report this cart"));
  await p.evaluate("openBottle('Cointreau')"); await p.waitForTimeout(100);
  check("bottle comments can be reported", await p.isVisible(".rnotes .report-link"));
  check("not an admin: no admin section", !(await p.evaluate("!!document.getElementById('prof-admin')")));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();

  // Signed out
  const q = await open({ user: null });
  await q.click("#list button[data-id='neg-1']");
  await q.click("text=Report this drink");
  check("signed out is asked to sign in", (await q.text("#gen-body")).includes("Sign in to report"));
  await q.close();

  // An admin reviews them
  const t2 = sample();
  t2.site_admins = [{ user_id: "u1" }];
  t2.ratings = (t2.ratings || []).concat([{ drink_id: "neg-1", user_id: "u2", stars: 2, note: "Spammy note" }]);
  t2.drinks.find(d => d.id === "neg-1").data.photo = "u2/neg-1/1.jpg";
  t2.reports = [
    { id: 1, kind: "drink", target: "neg-1", target_owner: "u2", reason: "offensive", details: "Bad photo", snapshot: "Negroni", reporter: "u3", created_at: "2026-11-01" },
    { id: 2, kind: "drink", target: "neg-1", target_owner: "u2", reason: "not_theirs", details: null, snapshot: "Negroni", reporter: "u4", created_at: "2026-11-01" },
    { id: 3, kind: "note", target: "neg-1|u2", target_owner: "u2", reason: "spam", details: null, snapshot: "Spammy note", reporter: "u3", created_at: "2026-11-01" },
    { id: 4, kind: "comment", target: "cointreau|u2", target_owner: "u2", reason: "other", details: null, snapshot: "Essential for Margaritas.", reporter: "u3", created_at: "2026-11-01" },
    { id: 5, kind: "cart", target: "u2", target_owner: "u2", reason: "offensive", details: "Rude cart name", snapshot: "x", reporter: "u3", created_at: "2026-11-01" }];
  const a = await open({ tables: t2 });
  await a.click("#locker-btn"); await a.waitForTimeout(150);
  check("admin sees Review reports with count", (await a.text("#prof-reports")).includes("(4)"));
  await a.click("#prof-reports"); await a.waitForTimeout(150);
  const page = await a.text("#main");
  check("reports grouped by thing reported", page.includes("4 to review") && page.includes("2 reports") && page.includes("Bad photo") && page.includes("Uses someone else's photo"), page);
  await a.click("[data-rpact=photo]"); await a.waitForTimeout(150);
  const neg = await a.evaluate("window.__MOCK.tables.drinks.find(d => d.id === 'neg-1')");
  check("admin removes a drink's photo, drink stays", neg && !neg.data.photo && neg.data.name === "Negroni" && neg.owner === "u2", JSON.stringify(neg));
  check("its reports cleared", !(await a.evaluate("window.__MOCK.tables.reports.some(r => r.kind === 'drink')")) && (await a.text("#main")).includes("3 to review"));
  await a.click("[data-rpact=note]"); await a.waitForTimeout(150);
  check("admin removes a note, rating stays", (await a.evaluate("JSON.stringify(window.__MOCK.tables.ratings.find(r => r.drink_id === 'neg-1' && r.user_id === 'u2'))")).includes('"note":null'));
  await a.click("[data-rpact=comment]"); await a.waitForTimeout(150);
  check("admin deletes a bottle comment", !(await a.evaluate("window.__MOCK.tables.bottle_reviews.some(r => r.user_id === 'u2')")));
  await a.click("[data-rpact=dismiss]"); await a.waitForTimeout(150);
  check("dismiss clears the last report", (await a.evaluate("window.__MOCK.tables.reports.length")) === 0 && (await a.text("#main")).includes("Nothing to review"));
  check("no errors", a.errors.length === 0, a.errors.join("; "));
  await a.close();
}
