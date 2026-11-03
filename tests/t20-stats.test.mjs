import { open, check, sample } from "./harness.mjs";
const STATS = { totals: { members: 12, active_7d: 5, drinks: 40, drink_photos: 9, classics: 42, ratings: 30, favorites: 14, bottle_photos: 3, bottle_reviews: 2, lists: 4, follows: 6 },
  weeks: Array.from({ length: 8 }, (_, i) => ({ week: `2026-09-${String(7 + i * 3).padStart(2, "0")}`, signups: i, drinks: i * 2, ai: i * 5 })),
  ai_30d: { ask: 20, scan: 7 }, ai_today: 4, at_limit_today: 1,
  top_rated: [{ id: "neg-1", name: "Negroni", avg: 4.5, n: 2 }], most_saved: [{ id: "neg-1", name: "Negroni", n: 1 }] };
export default async function () {
  const t = sample(); t.site_admins = [{ user_id: "u1" }];
  const p = await open({ user: "u1", tables: t, hash: "" });
  await p.evaluate(s => { window.__MOCK.rpc = { admin_stats: s }; }, STATS);
  await p.evaluate("navGo('cart')"); await p.waitForTimeout(200);
  check("admins see a Site stats button", await p.isVisible("#prof-stats"));
  await p.click("#prof-stats"); await p.waitForTimeout(200);
  const txt = await p.text("#main");
  check("stats page shows totals, weeks, AI use and top drinks", /site stats/i.test(txt) && /members/i.test(txt) && /last 8 weeks/i.test(txt) && /ask the bartender/i.test(txt) && /hit the daily limit/i.test(txt) && /negroni/i.test(txt), txt.slice(0, 300));
  check("8 weekly bars per chart", (await p.evaluate("document.querySelectorAll('.st-bar').length")) === 24);
  await p.click(".st-list [data-open='neg-1']"); await p.waitForTimeout(150);
  check("a top drink opens its recipe", (await p.evaluate("S.view + ':' + S.selected")) === "detail:neg-1");
  // not set up yet
  await p.evaluate("window.__MOCK.rpc = {}"); await p.evaluate("openStats()"); await p.waitForTimeout(200);
  check("explains how to set it up", /stats-setup\.sql/.test(await p.text("#main")));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
  const p2 = await open({ user: "u2" });
  await p2.evaluate("navGo('cart')"); await p2.waitForTimeout(200);
  check("others don't get the stats button", !(await p2.isVisible("#prof-stats")));
  await p2.close();
}
