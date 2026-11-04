import { open, check, sample } from "./harness.mjs";
export default async function () {
  const t = sample();
  t.drink_log = [
    { id: 1, user_id: "u1", drink_id: "neg-1", drink_name: "Negroni", made_on: "2026-10-12", note: "Batched for Sam's party." },
    { id: 2, user_id: "u1", drink_id: "neg-1", drink_name: "Negroni", made_on: "2026-10-28", note: "Carpano Antica instead of Dolin. Better." },
    { id: 3, user_id: "u2", drink_id: "neg-1", drink_name: "Negroni", made_on: "2026-10-30", note: "Someone else's note" }];
  const p = await open({ user: "u1", tables: t });
  // the mock returns every row; the database only returns your own (RLS). Mirror that here.
  await p.evaluate("S.log = S.log.filter(e => e.drink_id && window.__MOCK.tables.drink_log.find(r => r.id === e.id).user_id === 'u1'); renderList()");
  const listTxt = await p.text("#list");
  check("lists show how often you've made a drink", /made 2×/i.test(listTxt), listTxt);
  await p.pick("neg-1"); await p.waitForTimeout(150);
  let sec = await p.text("#made-sec");
  check("recipe page: count, last made, notes newest first", /made 2 times/i.test(sec) && /last on oct 28/i.test(sec) && sec.indexOf("Carpano") < sec.indexOf("Batched"), sec);
  check("your log is private", /only you can see your log/i.test(sec));
  // log a new one
  await p.click("#made-btn"); await p.waitForTimeout(100);
  check("the sheet has a date (today) and a note, no drink count", (await p.inputValue("#lg-date")) === (await p.evaluate("todayIso()")) && await p.isVisible("#lg-note") && !(await p.evaluate("!!document.querySelector('#gen-modal input[type=number]')")));
  await p.fill("#lg-note", "Tried Cocchi di Torino."); await p.click("#lg-save"); await p.waitForTimeout(200);
  const rows = await p.evaluate("window.__MOCK.tables.drink_log.filter(r => r.user_id === 'u1')");
  check("saved to your log", rows.length === 3 && rows.some(r => r.note === "Tried Cocchi di Torino." && r.drink_id === "neg-1"));
  check("not rated yet: asks how it was, and Not now closes it", /logged\. how was it\?/i.test(await p.text("#gen-modal")));
  await p.click("#lg-skip"); await p.waitForTimeout(100);
  sec = await p.text("#made-sec");
  check("now made 3 times", /made 3 times/i.test(sec), sec);
  // edit and delete
  await p.click("[data-log-edit='1']"); await p.waitForTimeout(100);
  await p.fill("#lg-note", "Batched for Sam's party. Gone in an hour."); await p.click("#lg-save"); await p.waitForTimeout(150);
  check("edit an entry", (await p.evaluate("window.__MOCK.tables.drink_log.find(r => r.id === 1).note")) === "Batched for Sam's party. Gone in an hour.");
  await p.click("#log-all").catch(() => {}); await p.waitForTimeout(50);
  await p.click("[data-log-edit='1']"); await p.waitForTimeout(100); await p.click("#lg-del"); await p.waitForTimeout(150);
  check("delete an entry", !(await p.evaluate("window.__MOCK.tables.drink_log.some(r => r.id === 1)")) && /made 2 times/i.test(await p.text("#made-sec")));
  // make my version from a note
  await p.click("[data-log-riff='2']"); await p.waitForTimeout(150);
  check("make my version starts a riff with the note", (await p.inputValue("#f-name")) === "Negroni (my version)" && /from my log, oct 28, 2026: carpano antica/i.test(await p.inputValue("#f-notes")));
  await p.click("#cancel-btn"); await p.waitForTimeout(100);
  // an unrated drink asks for a rating after logging
  await p.pick("mule"); await p.waitForTimeout(100);
  check("never made: invites you to log it", /made it\?/i.test(await p.text("#made-sec")));
  await p.click("#made-btn"); await p.click("#lg-save"); await p.waitForTimeout(200);
  check("unrated: asks how it was", /logged\. how was it\?/i.test(await p.text("#gen-modal")));
  await p.click("[data-lg-star='4']"); await p.waitForTimeout(200);
  check("the stars set your public rating", (await p.evaluate("window.__MOCK.tables.ratings.find(r => r.drink_id === 'mule' && r.user_id === 'u1').stars")) === 4);
  await p.click("#made-btn"); await p.click("#lg-save"); await p.waitForTimeout(200);
  check("already rated: no prompt next time", !(await p.evaluate("!!document.querySelector('[data-lg-star]')")) && /made 2 times/i.test(await p.text("#made-sec")));
  // My Log
  await p.evaluate("navGo('cart')"); await p.waitForTimeout(200);
  const log = await p.text("#prof-log");
  check("My Log: counts, most made and a month timeline", /all time/i.test(log) && /negroni/i.test(log) && /most made \(2×\)/i.test(log) && /4 \| all time/i.test(log) && /october/i.test(log), log);
  await p.click("#prof-log [data-open='mule']"); await p.waitForTimeout(150);
  check("tapping an entry opens the drink", (await p.evaluate("S.view + ':' + S.selected")) === "detail:mule");
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
  const q = await open({ user: null });
  await q.pick("neg-1"); await q.waitForTimeout(100);
  check("signed out: no log", !(await q.evaluate("!!document.getElementById('made-sec')")));
  await q.close();
}
