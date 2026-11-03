import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open();
  check("tools panel shows for signed-in users", await p.isVisible("#canmake-btn"));
  await p.click("#canmake-btn"); await p.waitForTimeout(150);
  const t = await p.text("#main");
  check("both Negronis are ready to make", /Ready to make\s*\|?\s*2/.test(t), t.slice(0, 300));
  check("hash link set", (await p.evaluate("location.hash")) === "#can-make");
  await p.fill("#in-fresh", "Limes"); await p.press("#in-fresh", "Enter"); await p.waitForTimeout(500);
  const t2 = await p.text("#main");
  check("adding limes moves Mule to missing one", t2.includes("Missing Ginger beer"), t2.slice(0, 600));
  check("Margarita-style drink missing orange liqueur", t2.includes("Missing Orange liqueur"));
  check("focus stays in the box after re-match", (await p.evaluate("document.activeElement && document.activeElement.id")) === "in-fresh");
  await p.click("#main [data-open='mule']"); await p.waitForTimeout(100);
  check("opening a result shows the drink", (await p.text(".drink-name")) === "Moscow Mule");
  // ingredient spelling help in the editor
  await p.pick('rita'); await p.act('edit-btn'); await p.waitForTimeout(100);
  await p.fill("#ing-name-1", "Freshly squeezed lime juice"); await p.dispatchEvent("#ing-name-1", "change"); await p.waitForTimeout(50);
  const dym = await p.isVisible(".ing-dym");
  check("editor suggests the common spelling", dym && (await p.text(".ing-dym")).includes("Lime juice"), dym ? await p.text(".ing-dym") : "none");
  await p.click(".ing-dym");
  check("tapping the suggestion uses it", (await p.inputValue("#ing-name-1")) === "Lime juice");
  check("ingredient suggestions list exists", (await p.evaluate("document.querySelectorAll('#dl-ings option').length")) > 5);
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
  const q = await open({ hash: "#can-make" }); await q.waitForTimeout(200);
  check("can-make link opens the page", (await q.text("#main")).includes("What can I make?"));
  await q.close();
  const r = await open({ user: null });
  check("signed out: tools hint shown, bar tools hidden", await r.isVisible("#tools-hint") && !(await r.isVisible("#canmake-btn")));
  await r.close();
}
