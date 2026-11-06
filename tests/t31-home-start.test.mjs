import { open, check, sample } from "./harness.mjs";
const pickId = p => p.evaluate("(tonightPick() || {}).d?.id || ''");
export default async function () {
  // A member with bottles: Tonight, from your bottles takes the drink of the day's place
  const p = await open({ user: "u1", width: 390, home: true });
  await p.evaluate("openHome()"); await p.waitForTimeout(250);
  check("members with bottles get Tonight, from your bottles", await p.isVisible("#tonight") && !(await p.evaluate("!!document.querySelector('button.home-day')")) && /Tonight, from your bottles/i.test(await p.text("#tonight")));
  const first = await pickId(p);
  check("the pick is a drink you can make right now", !!first && await p.evaluate(`canMakeResults().ready.some(d => d.id === ${JSON.stringify(first)})`), first);
  check("nothing to buy when a drink without pick-ups fits", (await p.evaluate("tonightPick().pick.length")) === 0 && !/Pick up/.test(await p.text("#tonight")));
  await p.evaluate("renderMain()"); await p.waitForTimeout(100);
  check("the same pick all day", (await pickId(p)) === first);
  check("the card shows why and the spec", /Not in your log yet|Last made|A favorite/.test(await p.text("#tonight")) && /See the spec/.test(await p.text("#tonight")));
  // Another idea moves on, and stays moved on
  if (await p.isVisible("#tn-next")) {
    await p.click("#tn-next"); await p.waitForTimeout(150);
    const second = await pickId(p);
    check("Another idea shows a different drink", !!second && second !== first, first + " → " + second);
    await p.evaluate("renderMain()"); await p.waitForTimeout(100);
    check("and keeps it", (await pickId(p)) === second);
  } else check("Another idea shows when there's more than one drink", false, await p.evaluate("tonightPool().length"));
  // I made this: the usual log sheet, then the card says so
  const now = await pickId(p);
  await p.click("#tn-made"); await p.waitForTimeout(150);
  await p.click("#lg-save"); await p.waitForTimeout(250);
  await p.evaluate("if (!$('gen-modal').hidden) closeSheet()"); await p.waitForTimeout(100);
  check("✓ I made this logs it and the card says Made it today", (await pickId(p)) === now && /Made it today/.test(await p.text("#tonight")) && (await p.evaluate("S.log.some(e => e.drink_id === " + JSON.stringify(now) + " && e.made_on === todayIso())")), await p.text("#tonight"));
  // something made a few days ago sits out
  await p.evaluate(`S.log.push({ id: 991, drink_id: ${JSON.stringify(first)}, drink_name: "x", made_on: isoDaysAgo(3) })`);
  check("drinks logged in the last two weeks sit out", !(await p.evaluate(`tonightPool().some(x => x.d.id === ${JSON.stringify(first)})`)));
  // tapping the card opens the recipe
  await p.click("#tonight .home-feat-name"); await p.waitForTimeout(200);
  check("tapping the card opens the recipe", (await p.evaluate("S.view")) === "detail" && (await p.evaluate("S.selected")) === now, await p.evaluate("S.view + ':' + S.selected"));
  // established members never see the setup steps
  await p.evaluate("openHome()"); await p.waitForTimeout(150);
  check("members with bottles and drinks don't see the setup steps", !(await p.isVisible("#setup-card")));
  // the daily 'seen' note: once a day
  check("a signed-in visit is noted once", (await p.evaluate("__MOCK.seenCalls")) === 1, await p.evaluate("__MOCK.seenCalls"));
  await p.evaluate("touchSeen()"); await p.waitForTimeout(100);
  check("and not again the same day", (await p.evaluate("__MOCK.seenCalls")) === 1);
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();

  // Visitors keep the drink of the day
  const v = await open({ user: null, width: 390, home: true });
  await v.evaluate("openHome()"); await v.waitForTimeout(200);
  check("visitors see the drink of the day, no Tonight or setup steps", await v.isVisible("button.home-day") && !(await v.isVisible("#tonight")) && !(await v.isVisible("#setup-card")) && !(await v.evaluate("__MOCK.seenCalls")));
  await v.close();

  // A new member: the setup steps
  const t = sample(); t.profiles.push({ id: "u4", display_name: "New Cart" });
  const n = await open({ user: "u4", tables: t, width: 390, home: true });
  await n.evaluate("openHome()"); await n.waitForTimeout(250);
  check("a new member sees the setup steps", await n.isVisible("#setup-card") && /0 of 3/.test(await n.text("#setup-card")), await n.evaluate("document.getElementById('setup-card')?.innerText || 'none'"));
  check("no bottles yet: the drink of the day, not Tonight", await n.isVisible("button.home-day") && !(await n.isVisible("#tonight")));
  const order = await n.evaluate("[...document.querySelectorAll('#main .home-top > *')].map(x => x.id || x.className).join('|')");
  check("on a phone the steps come before the drink card", /home-hero.*home-day/.test(order) && await n.evaluate("!!document.querySelector('.home-hero #setup-card')"), order);
  await n.click('[data-setup="bottles"]'); await n.waitForTimeout(150);
  check("Add your bottles opens the add-bottles choices", await n.isVisible("#ba-photo") && await n.isVisible("#ba-type"));
  await n.evaluate("closeSheet(); addItem('liquors', 'Gin', ''); addItem('liquors', 'Campari', ''); addItem('liquors', 'Sweet vermouth', ''); openHome()"); await n.waitForTimeout(200);
  check("step 1 ticks off, and Tonight appears", /1 of 3/.test(await n.text("#setup-card")) && await n.isVisible("#tonight"), await n.text("#setup-card"));
  await n.click('[data-setup="canmake"]'); await n.waitForTimeout(150);
  check("See what you can make opens it", (await n.evaluate("S.view")) === "canmake");
  await n.evaluate("openHome()"); await n.waitForTimeout(150);
  check("step 2 ticks off", /2 of 3/.test(await n.text("#setup-card")));
  await n.evaluate("toggleFav(allDrinks().find(d => d.id === 'neg-1'))"); await n.waitForTimeout(200);
  await n.evaluate("openHome()"); await n.waitForTimeout(150);
  check("after a first favorite the steps are done and go away", !(await n.isVisible("#setup-card")) && (await n.evaluate("localStorage.getItem('mc-setup-u4')")) === "done");
  await n.evaluate("S.favs.clear(); openHome()"); await n.waitForTimeout(150);
  check("and stay gone", !(await n.isVisible("#setup-card")));
  check("no errors", n.errors.length === 0, n.errors.join("; "));
  await n.close();

  // Hiding the steps
  const t2 = sample(); t2.profiles.push({ id: "u5", display_name: "Fifth" });
  const h = await open({ user: "u5", tables: t2, width: 1200, home: true });
  await h.evaluate("openHome()"); await h.waitForTimeout(200);
  await h.click("#setup-hide"); await h.waitForTimeout(150);
  check("× hides the steps for good", !(await h.isVisible("#setup-card")) && (await h.evaluate("localStorage.getItem('mc-setup-u5')")) === "hidden");
  check("no errors", h.errors.length === 0, h.errors.join("; "));
  await h.close();
}
