// ---------- Ask the bartender ----------
// One place for the AI: ask in your own words ("something refreshing with gin", "out of Campari",
// "a mocktail Paloma", "classic Last Word") or tap a quick start. Answers come back as a short reply
// plus drink cards you can save, make or swap for another. Follow-ups refine the last answer.
// Each question is one AI request (the read-recipe function's "ask" mode).
S.ask = { msgs: [], loading: false, error: "", token: null,
  useBar: (() => { try { return localStorage.getItem("mc-ask-bar") !== "0"; } catch (e) { return true; } })() };

const ASK_STARTS = [
  ["Use what I have", "What can I make with what I have? Give me three ideas.", true],
  ["Surprise me", "Surprise me with something I probably haven't tried.", true],
  ["Make a mocktail", "I'd like a mocktail tonight. What do you suggest?", true],
  ["Find a substitute", "I'm out of ", false],
  ["Look up a classic", "What's the classic recipe for ", false]
];

function openAsk(question) {
  S.view = "ask"; S.confirmDelete = false; setHash("ask");
  renderList(); renderMain(); window.scrollTo({ top: 0 });
  if (question && uid()) askSend(question);
}
HASH_VIEWS.ask = () => openAsk();

const askDrink = x => recipeToDrink(Object.assign({}, x, { notes: [x.notes, x.why].filter(Boolean).join("\n\n") }));

function askCardHtml(x, mi, di) {
  const d = askDrink(x);
  const rows = (d.ingredients || []).map(i => { const s = show(i, 1, "spec"); return `<tr${i.float ? ' class="float"' : ""}><td class="q">${qHtml(s.q)}</td><td class="u">${esc(s.u)}</td><td class="n">${esc(i.name)}${i.float ? ` <span class="chip amber float-tag">Float</span>` : ""}${i.brand ? `<span class="note">${esc(i.brand)}</span>` : ""}</td></tr>`; }).join("");
  const meta = [x.classic && x.classic.toLowerCase() !== String(x.name || "").toLowerCase() ? "Riff on a " + x.classic : "", x.type, x.method, x.glass].filter(Boolean).join(" · ");
  const id = `${mi}:${di}`;
  return `<article class="ask-drink">
    <div class="ask-pic" aria-hidden="true">${drinkPicture(d)}</div>
    <div class="ask-body">
      <h3>${esc(x.name || "Drink")}</h3>
      ${meta ? `<div class="hint">${esc(meta)}</div>` : ""}
      ${x.why ? `<p class="ask-why">${esc(x.why)}</p>` : ""}
      <table class="spec-table"><tbody>${rows}</tbody></table>
      ${x.garnish ? `<p class="hint" style="margin:0">Garnish: ${esc(x.garnish)}</p>` : ""}
      ${x.notes ? `<p class="ask-notes">${esc(x.notes)}</p>` : ""}
      ${(x.need || []).length ? `<p class="ask-need"><b>You'll need:</b> ${esc(x.need.join(", "))}</p>` : ""}
      <div class="panel-actions" style="justify-content:flex-start">
        <button class="btn small primary" type="button" data-ask-save="${id}">Save to My Cocktail Cart</button>
        <button class="btn small" type="button" data-ask-other="${id}">Try another</button>
      </div>
    </div>
  </article>`;
}

VIEWS.ask = function renderAsk() {
  const m = $("main");
  const A = S.ask, signedIn = !!uid();
  const stocked = signedIn ? inStock(savedItems()).length : 0;
  m.innerHTML = `
    <div class="make ask">
      <div class="editor-top">
        <div><span class="label">AI bartender</span><h2 class="make-title">Ask the bartender</h2></div>
        ${A.msgs.length ? `<button class="btn small" type="button" id="ask-reset">Start over</button>` : ""}
      </div>
      ${!signedIn ? `<div class="scan-banner"><span><b>Sign in to ask the bartender.</b> Ideas from your bottles, substitutes, mocktails and classic recipes, all in one place.</span>
        <div><button class="btn small primary" type="button" id="ask-signin">Sign in or join free</button></div></div>` : ""}
      ${!A.msgs.length ? `<p class="ask-intro">Ask for ideas from your bottles, a substitute for something you're out of, a mocktail, a classic spec, or help planning drinks for a crowd.</p>` : ""}
      <div class="ask-thread" id="ask-thread">
        ${A.msgs.map((msg, mi) => msg.role === "user"
          ? `<div class="ask-q"><span class="label">You</span><p>${esc(msg.text)}</p></div>`
          : `<div class="ask-a"><span class="label">Bartender</span>${msg.text ? `<p class="ask-answer">${esc(msg.text)}</p>` : ""}
              ${(msg.drinks || []).map((x, di) => askCardHtml(x, mi, di)).join("")}</div>`).join("")}
        ${A.loading ? `<div class="ask-a"><span class="label">Bartender</span><p class="ask-answer dots">Mixing up an answer</p></div>` : ""}
        ${A.error ? `<div class="ask-err"><p class="err" style="margin:0">${esc(A.error)}</p>${A.retry ? `<button class="btn small" type="button" id="ask-retry">Try again</button>` : ""}</div>` : ""}
      </div>
      ${signedIn ? `
      ${!A.msgs.length ? `<div class="ask-starts">${ASK_STARTS.map(([t], i) => `<button type="button" data-ask-start="${i}">${esc(t)}</button>`).join("")}</div>` : ""}
      <form class="ask-form" id="ask-form">
        <label class="sr-only" for="ask-in">${A.msgs.length ? "Ask a follow-up" : "Ask the bartender"}</label>
        <textarea id="ask-in" rows="2" maxlength="500" placeholder="${A.msgs.length ? "Ask a follow-up question" : "What are you in the mood for?"}" ${A.loading ? "disabled" : ""}></textarea>
        <button class="btn primary" type="submit" ${A.loading ? "disabled" : ""}>Ask</button>
      </form>
      <div class="ask-opts">
        <label class="check"><input type="checkbox" id="ask-bar" ${A.useBar ? "checked" : ""}><span>Use my bottles${stocked ? ` (${stocked} in stock)` : ""}</span></label>
        <span class="hint">Each question uses one of your 25 daily AI requests.</span>
      </div>` : ""}
    </div>`;

  if ($("ask-signin")) $("ask-signin").onclick = () => { $("auth-btn").click(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  if ($("ask-reset")) $("ask-reset").onclick = () => { S.ask.msgs = []; S.ask.error = ""; S.ask.loading = false; S.ask.token = null; renderMain(); };
  if ($("ask-retry")) $("ask-retry").onclick = () => { const q = S.ask.retry; S.ask.retry = null; S.ask.error = ""; askSend(q, true); };
  if ($("ask-bar")) $("ask-bar").onchange = e => { S.ask.useBar = e.target.checked; try { localStorage.setItem("mc-ask-bar", S.ask.useBar ? "1" : "0"); } catch (er) {} };
  m.querySelectorAll("[data-ask-start]").forEach(b => b.onclick = () => {
    const [, text, send] = ASK_STARTS[Number(b.dataset.askStart)];
    if (send) return askSend(text);
    const inp = $("ask-in"); inp.value = text; inp.focus(); inp.setSelectionRange(text.length, text.length);
  });
  const form = $("ask-form");
  if (form) {
    form.onsubmit = e => { e.preventDefault(); const q = $("ask-in").value.trim(); if (q) askSend(q); };
    $("ask-in").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  }
  const pick = v => { const [mi, di] = v.split(":").map(Number); return (S.ask.msgs[mi] && S.ask.msgs[mi].drinks || [])[di]; };
  m.querySelectorAll("[data-ask-save]").forEach(b => b.onclick = () => {
    const x = pick(b.dataset.askSave); if (!x) return;
    const d = askDrink(x); d.origin = "AI bartender";
    openEditor(d, false, { title: "From Ask the bartender.", body: "Tweak anything before saving.", warning: (x.need || []).length ? "You'll need: " + x.need.join(", ") : "" });
  });
  m.querySelectorAll("[data-ask-other]").forEach(b => b.onclick = () => {
    const x = pick(b.dataset.askOther); if (!x) return;
    askSend(`Give me a different option instead of the ${x.name}.`);
  });
};

async function askSend(text, isRetry) {
  if (!uid() || S.ask.loading) return;
  const A = S.ask;
  if (!isRetry) A.msgs.push({ role: "user", text: String(text).slice(0, 500) });
  A.msgs = A.msgs.slice(-20);
  A.loading = true; A.error = ""; A.retry = null;
  const token = {}; A.token = token;
  if (S.view === "ask") { renderMain(); const t = $("ask-thread"); if (t && t.lastElementChild) t.lastElementChild.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  const messages = A.msgs.slice(-10).map(x => ({ role: x.role, text: x.text || "", drinks: (x.drinks || []).map(d => d.name) }));
  const { data, code } = await invokeHelper({ mode: "ask", messages, useBar: A.useBar, bar: A.useBar ? barForAI() : null, fresh: A.useBar ? S.fresh : [] });
  if (A.token !== token) return;
  A.loading = false;
  if (data && (data.answer || (data.drinks || []).length)) {
    A.msgs.push({ role: "bartender", text: data.answer || "", drinks: data.drinks || [] });
  } else {
    // An older read-recipe function doesn't know "ask" and treats it as a photo scan (bad_image).
    A.error = code === "bad_image" ? "Ask the bartender isn't switched on yet. The site owner needs to redeploy the read-recipe function in Supabase."
      : (code === "daily_limit" ? "You've used today's 25 AI requests. Try again tomorrow." : SCAN_ERR[code]) || "The bartender couldn't answer just now. Try again.";
    A.retry = A.msgs[A.msgs.length - 1] && A.msgs[A.msgs.length - 1].role === "user" ? A.msgs[A.msgs.length - 1].text : null;
  }
  if (S.view !== "ask") return;
  renderMain();
  const answers = document.querySelectorAll("#ask-thread .ask-a, #ask-thread .ask-err");
  const last = answers[answers.length - 1];
  if (last) last.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Ask about one recipe ----------
// The Ask button on a recipe opens a pop-up conversation about that drink. Its spec rides along with the
// first question, so "make it less sweet" or "what can I use instead of Campari?" are about this drink.
const RECIPE_ASK_STARTS = ["Make it less sweet", "What can I swap for one of these?", "How do I batch this for 10?", "What food goes with it?", "What's the story behind it?"];
function recipeContext(d) {
  const ings = (d.ingredients || []).map(i => { const s = show(i, 1, "spec"); return `${s.q}${s.u ? " " + s.u : ""} ${i.name}${i.brand ? " (" + i.brand + ")" : ""}${i.float ? " (float)" : ""}`.replace(/\s+/g, " ").trim(); });
  return `About this recipe, ${d.name}: ${[d.method, d.glass].filter(Boolean).join(", ")}; ${ings.join("; ")}${d.garnish ? "; garnish " + d.garnish : ""}.`.slice(0, 420);
}
function openRecipeAsk(d) {
  if (!S.rAsk || S.rAsk.id !== d.id) S.rAsk = { id: d.id, d, msgs: [], loading: false, error: "" };
  renderRecipeAsk();
}
function renderRecipeAsk() {
  const A = S.rAsk, d = A.d, signedIn = !!uid();
  const body = sheet(`Ask about ${d.name}`, !signedIn
    ? `<p style="margin:0">Sign in to ask the bartender about this drink: swaps, sweeter or drier versions, batching, food pairings and more.</p>
       <div class="share-actions"><button class="btn primary" type="button" id="ra-signin">Sign in or join free</button></div>`
    : `<div class="ask-thread" id="ra-thread">
        ${A.msgs.map((msg, mi) => msg.role === "user"
          ? `<div class="ask-q"><span class="label">You</span><p>${esc(msg.text)}</p></div>`
          : `<div class="ask-a"><span class="label">Bartender</span>${msg.text ? `<p class="ask-answer">${esc(msg.text)}</p>` : ""}${(msg.drinks || []).map((x, di) => askCardHtml(x, mi, di).replace(/data-ask-(save|other)=/g, "data-ra-$1=")).join("")}</div>`).join("")}
        ${A.loading ? `<div class="ask-a"><span class="label">Bartender</span><p class="ask-answer dots">Mixing up an answer</p></div>` : ""}
        ${A.error ? `<p class="err" style="margin:0">${esc(A.error)}</p>` : ""}
      </div>
      ${!A.msgs.length ? `<div class="ask-starts">${RECIPE_ASK_STARTS.map((t, i) => `<button type="button" data-ra-start="${i}">${esc(t)}</button>`).join("")}</div>` : ""}
      <form class="ask-form" id="ra-form">
        <label class="sr-only" for="ra-in">Your question about ${esc(d.name)}</label>
        <textarea id="ra-in" rows="2" maxlength="300" placeholder="${A.msgs.length ? "Ask a follow-up" : "Ask anything about this drink"}" ${A.loading ? "disabled" : ""}>${esc(A.draft || "")}</textarea>
        <button class="btn primary" type="submit" ${A.loading ? "disabled" : ""}>Ask</button>
      </form>
      <p class="hint" style="margin:0">Each question uses one of your 25 daily AI requests.</p>`);
  body.classList.add("ra-body");
  if ($("ra-signin")) { $("ra-signin").onclick = () => { closeSheet(); $("auth-btn").click(); window.scrollTo({ top: 0 }); }; return; }
  body.querySelectorAll("[data-ra-start]").forEach(b => b.onclick = () => recipeAskSend(RECIPE_ASK_STARTS[Number(b.dataset.raStart)]));
  $("ra-form").onsubmit = e => { e.preventDefault(); const q = $("ra-in").value.trim(); if (q) recipeAskSend(q); };
  $("ra-in").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("ra-form").requestSubmit(); } });
  const pick = v => { const [mi, di] = v.split(":").map(Number); return (A.msgs[mi] && A.msgs[mi].drinks || [])[di]; };
  body.querySelectorAll("[data-ra-save]").forEach(b => b.onclick = () => {
    const x = pick(b.dataset.raSave); if (!x) return;
    const nd = askDrink(x); nd.origin = "AI bartender"; closeSheet();
    openEditor(nd, false, { title: "From Ask the bartender.", body: "Tweak anything before saving.", warning: (x.need || []).length ? "You'll need: " + x.need.join(", ") : "" });
  });
  body.querySelectorAll("[data-ra-other]").forEach(b => b.onclick = () => { const x = pick(b.dataset.raOther); if (x) recipeAskSend(`Give me a different version instead of the ${x.name}.`); });
  const t = $("ra-thread"); if (t && t.lastElementChild) t.lastElementChild.scrollIntoView({ block: "nearest" });
}
async function recipeAskSend(text) {
  const A = S.rAsk; if (!A || A.loading || !uid()) return;
  A.msgs.push({ role: "user", text: String(text).slice(0, 300) });
  A.loading = true; A.error = ""; A.draft = ""; renderRecipeAsk();
  const ctx = recipeContext(A.d);
  const messages = A.msgs.slice(-10).map((x, i, arr) => ({ role: x.role, text: (i === 0 && x.role === "user" ? ctx + " Question: " : "") + (x.text || ""), drinks: (x.drinks || []).map(dd => dd.name) }));
  const { data, code } = await invokeHelper({ mode: "ask", messages, useBar: S.ask.useBar, bar: S.ask.useBar ? barForAI() : null, fresh: S.ask.useBar ? S.fresh : [] });
  if (S.rAsk !== A) return;
  A.loading = false;
  if (data && (data.answer || (data.drinks || []).length)) A.msgs.push({ role: "bartender", text: data.answer || "", drinks: data.drinks || [] });
  else { A.error = code === "bad_image" ? "Ask the bartender isn't switched on yet. The site owner needs to redeploy the read-recipe function in Supabase."
    : (code === "daily_limit" ? "You've used today's 25 AI requests. Try again tomorrow." : SCAN_ERR[code]) || "The bartender couldn't answer just now. Try again."; A.draft = (A.msgs.pop() || {}).text || ""; }
  const modal = $("gen-modal");
  if (modal && !modal.hidden && (document.getElementById("ra-form") || document.getElementById("ra-thread"))) renderRecipeAsk();
}
