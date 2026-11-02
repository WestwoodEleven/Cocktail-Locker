import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open();
  await p.click("#list button[data-id='neg-1']");
  const t = await p.text("#main");
  check("notes from others shown", t.toLowerCase().includes("what people say") && t.includes("Perfect bitter balance."), t.slice(-400));
  // rate and add a note
  await p.click("[data-star='4']"); await p.waitForTimeout(100);
  check("note box appears after rating", await p.isVisible("#note-in"));
  await p.fill("#note-in", "Great with Carpano."); await p.click("#note-save"); await p.waitForTimeout(100);
  check("note saved and shown as yours", (await p.text("#main")).includes("You") && (await p.text("#main")).includes("Great with Carpano."));
  const saved = await p.evaluate("window.__MOCK.tables.ratings.find(r => r.drink_id === 'neg-1' && r.user_id === 'u1')");
  check("note stored with the rating", saved && saved.note === "Great with Carpano." && saved.stars === 4, JSON.stringify(saved));
  await p.click("[data-star='5']"); await p.waitForTimeout(100);
  const saved2 = await p.evaluate("window.__MOCK.tables.ratings.find(r => r.drink_id === 'neg-1' && r.user_id === 'u1')");
  check("changing stars keeps the note", saved2.stars === 5 && saved2.note === "Great with Carpano.", JSON.stringify(saved2));
  // lists
  await p.click("#list-add"); await p.waitForTimeout(50);
  await p.fill("#newlist-name", "Thanksgiving"); await p.click("#newlist-add"); await p.waitForTimeout(150);
  check("new list created with the drink", (await p.text("#gen-body")).includes("Thanksgiving 1 drinks"));
  await p.keyboard.press("Escape");
  await p.click("#list button[data-id='pk']"); await p.click("#list-add"); await p.waitForTimeout(50);
  await p.check("#gen-body [data-col]"); await p.waitForTimeout(150); await p.keyboard.press("Escape");
  const opts = await p.text("#flt-owner");
  check("list appears in the Locker filter", opts.includes("List: Thanksgiving (2)"), opts);
  const colId = await p.evaluate("window.__MOCK.tables.collections[0].id");
  await p.selectOption("#flt-owner", "col:" + colId); await p.waitForTimeout(100);
  check("filtering by list shows its drinks", (await p.text("#list")).includes("Painkiller") && !(await p.text("#list")).includes("Moscow Mule"));
  await p.selectOption("#flt-owner", "");
  // locker page + follow
  await p.click("#list button[data-id='mule']"); await p.waitForTimeout(50);
  await p.click(".from [data-locker]"); await p.waitForTimeout(100);
  check("locker page opens from the drink", (await p.text("#main")).includes("Jo's Cart") && (await p.evaluate("location.hash")) === "#locker-u3");
  await p.click("#lk-follow"); await p.waitForTimeout(100);
  check("follow works", (await p.text("#lk-follow")).includes("Following") && (await p.text("#main")).includes("1 follower"));
  check("People I follow filter offered", (await p.text("#flt-owner")).includes("People I follow (1)"));
  await p.click("#locker-btn"); await p.waitForTimeout(100);
  const prof = await p.text("#main");
  check("My cart shows lists and following", prof.includes("My lists") && prof.includes("Thanksgiving") && prof.includes("Jo's Cart"), prof.slice(0, 900));
  await p.click("#prof-lists summary"); await p.click("[data-colpub]"); await p.waitForTimeout(100);
  check("list can be made private", (await p.evaluate("window.__MOCK.tables.collections[0].is_public")) === false);
  await p.click("#prof-lists summary").catch(() => {});
  await p.click("[data-coldel]"); await p.click("#coldel-yes"); await p.waitForTimeout(100);
  check("list can be deleted", (await p.evaluate("window.__MOCK.tables.collections.length")) === 0);
  await p.evaluate("location.hash = '#locker-u2'"); await p.waitForTimeout(150);
  check("locker link via address works", (await p.text("#main")).includes("Sam's Shelf"));
  await p.setViewportSize({ width: 390, height: 844 });
  check("no sideways scroll on phone", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
