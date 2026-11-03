// My Cocktail Cart: "Make it a mocktail". Scripts share one global scope and load in numbered order.
// Asks the AI for a zero-proof version of a drink, using its own non-alcoholic ingredients and your bottles first.

S.mockCache = {};
function mockBtn(d) {
  if (S.backend !== "supabase" || !uid() || baseOf(d) === "No alcohol") return "";
  return `<button class="btn small" type="button" id="mock-btn" aria-label="Make it a mocktail">Mocktail</button>`;
}
function mockToDrink(d, x) {
  const drink = recipeToDrink({ name: x.name, method: x.method, glass: x.glass || d.glass, garnish: x.garnish || d.garnish, ingredients: x.ingredients, notes: x.notes, type: typeOf(d), base: "No alcohol" });
  drink.origin = "Mocktail";
  drink.notes = [x.notes, x.why, `A mocktail version of ${d.name}.`].filter(Boolean).join("\n\n");
  return drink;
}
async function openMocktail(d, fresh) {
  const key = d.id;
  const draw = st => {
    if (st.loading) { sheet(`Mocktail ${d.name}`, `<div class="scanning"><div class="glass dots">Making it zero-proof</div><div class="hint">Working from the ${esc(d.name)} spec and your bottles.</div></div>`); return; }
    if (st.error) { sheet(`Mocktail ${d.name}`, `<div class="scan-banner"><span><b>Couldn't make a mocktail.</b> ${esc(st.error)}</span></div><div class="panel-actions" style="justify-content:flex-start"><button class="btn small" type="button" id="mk-retry">Try again</button></div>`); $("mk-retry").onclick = () => openMocktail(d, true); return; }
    const x = st.mocktail;
    const rows = (x.ingredients || []).map(i => { const s = show({ amount: Number(i.amount) || 0, unit: i.unit }, 1, S.mode);
      return `<tr${i.float ? ' class="float"' : ""}><td class="q">${qHtml(s.q)}</td><td class="u">${esc(s.u)}</td><td class="n">${esc(i.name)}${i.float ? ' <span class="chip amber float-tag">Float</span>' : ""}${i.have === false ? ' <span class="chip amber need-tag">Need</span>' : ""}</td></tr>`; }).join("");
    sheet(`Mocktail ${d.name}`, `
      <div class="idea-head"><h3 class="mk-name">${esc(x.name || d.name + " (mocktail)")}</h3><span class="chip">0.0% NA</span></div>
      <div class="meta">${[x.method, x.glass || d.glass].filter(Boolean).map(v => `<span class="chip">${esc(v)}</span>`).join("")}</div>
      ${(x.swaps || []).length ? `<div><div class="label notes-label">Swaps</div><ul class="mk-swaps">${x.swaps.map(s => `<li><s>${esc(s.from)}</s> → <b>${esc(s.to)}</b></li>`).join("")}</ul></div>` : ""}
      <table class="spec-table"><tbody>${rows}</tbody></table>
      ${x.garnish || d.garnish ? `<p class="idea-line"><b>Garnish:</b> ${esc(x.garnish || d.garnish)}</p>` : ""}
      ${x.notes ? `<p class="idea-line">${esc(x.notes)}</p>` : ""}
      ${x.why ? `<p class="idea-line hint">${esc(x.why)}</p>` : ""}
      ${x.shopping ? `<p class="idea-line hint"><b>You'll need:</b> ${esc(x.shopping)}</p>` : ""}
      <div class="panel-actions" style="justify-content:flex-start">
        <button class="btn primary small" type="button" id="mk-save">Save to My Bar</button>
        <button class="btn small ghost" type="button" id="mk-again">Try another version</button>
      </div>`);
    $("mk-save").onclick = () => { closeSheet(); openEditor(mockToDrink(d, x), false, { title: "Mocktail version.", body: "Tweak anything before saving.", warning: x.shopping ? "You'll need: " + x.shopping : "" }); };
    $("mk-again").onclick = () => openMocktail(d, true);
  };
  if (!fresh && S.mockCache[key]) return draw(S.mockCache[key]);
  const token = {}; S.mockToken = token;
  draw({ loading: true });
  const { data, code, detail } = await invokeHelper({ mode: "mocktail",
    drink: { name: d.name, method: d.method, glass: d.glass || "", garnish: d.garnish || "", ingredients: (d.ingredients || []).map(i => ({ amount: i.amount, unit: i.unit, name: i.name, brand: i.brand || "", float: !!i.float })) },
    bar: barForAI(), fresh: S.fresh });
  if (S.mockToken !== token || !$("gen-modal") || $("gen-modal").hidden) return;
  let st;
  if (data && data.mocktail) st = S.mockCache[key] = { mocktail: data.mocktail };
  else { let msg = detail; try { const j = JSON.parse(detail); msg = (j.error && j.error.message) || detail; } catch (e) {} st = { error: SCAN_ERR[code] || msg || "Something went wrong. Try again." }; }
  draw(st);
}
