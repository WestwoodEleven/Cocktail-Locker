// Runs the read-recipe Supabase function against a fake database and a fake Claude.
// Usage: node --experimental-strip-types tests/function.test.mjs
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

let pass = 0, fail = 0;
const check = (name, ok, info = "") => { ok ? pass++ : fail++; console.log((ok ? "  ok   " : "  FAIL ") + name + (ok || !info ? "" : "  -> " + info)); };

const src = readFileSync(new URL("../supabase/functions/read-recipe/index.ts", import.meta.url), "utf8")
  .replace(/^import \{ createClient \} from "jsr:@supabase\/supabase-js@2";/m, "const createClient = (globalThis as any).__cc;");
const dir = mkdtempSync(path.join(tmpdir(), "fn-"));
writeFileSync(path.join(dir, "fn.ts"), src);

let handler, sent, claudeReply, scansToday = 0;
const rows = { standard_recipes: [], recipe_scans: [], bottles: [] };
globalThis.Deno = { env: { get: k => ({ ANTHROPIC_API_KEY: " 'sk-ant-test' ", SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "y", UNLIMITED_EMAILS: "someone@x.com, listed@example.com" })[k] }, serve: h => { handler = h; } };
globalThis.__cc = () => ({
  auth: { getUser: async t => t === "good" ? { data: { user: { id: "u1", email: "u1@example.com" } } } : t === "boss" ? { data: { user: { id: "admin1", email: "Boss@Example.com" } } } : t === "listed" ? { data: { user: { id: "u9", email: "Listed@Example.com" } } } : { error: "no" } },
  from: t => ({
    select: () => ({ eq: (c, v) => ({ gte: async () => ({ count: scansToday }), limit: async () => ({ data: t === "site_admins" && v === "admin1" ? [{ user_id: "admin1" }] : [] }) }),
      or: f => ({ limit: async () => { const m = f.match(/slug\.eq\.([^,]+),aliases\.cs\.\{([^}]+)\}/); return { data: rows[t].filter(r => r.slug === m[1] || r.aliases.includes(m[2])).map(r => structuredClone(r)) }; } }) }),
    insert: async r => { rows[t].push(structuredClone(r)); return {}; },
    update: v => ({ eq: async (_, slug) => { Object.assign(rows[t].find(r => r.slug === slug), v); return {}; } })
  })
});
let claudeCalls = 0;
globalThis.fetch = async (u, o) => { claudeCalls++; sent = JSON.parse(o.body); sent._key = o.headers["x-api-key"]; return claudeReply(sent); };
const ok = input => () => new Response(JSON.stringify({ content: [{ type: "tool_use", name: sent.tools[0].name, input }] }));
await import(pathToFileURL(path.join(dir, "fn.ts")).href);
const call = async (body, tok = "good", method = "POST") => {
  const r = await handler(new Request("http://x", { method, headers: { Authorization: "Bearer " + tok, "Access-Control-Request-Headers": "authorization, x-extra" }, body: method === "POST" ? JSON.stringify(body) : undefined }));
  return [r.status, method === "POST" ? await r.json() : r.headers.get("access-control-allow-headers")];
};

console.log("\nfunction.test.mjs");
check("preflight allows requested headers", (await call(null, "good", "OPTIONS"))[1] === "authorization, x-extra");
check("signed out is refused", (await call({ mode: "generate" }, "bad"))[0] === 401);

claudeReply = ok({ found: true, name: "Last Word", method: "Shaken", ingredients: [{ amount: 0.75, unit: "oz", name: "Gin" }] });
let [st, body] = await call({ image: "abc", mediaType: "image/jpeg" });
check("scan returns a recipe", st === 200 && body.recipe.name === "Last Word");
check("API key is trimmed of quotes and spaces", sent._key === "sk-ant-test");
check("tool use is not forced", sent.tool_choice.type === "auto");
check("bad image type refused", (await call({ image: "abc", mediaType: "text/html" }))[0] === 400);

claudeReply = ok({ drinks: [{ name: "Gin Sour", ingredients: [{ amount: 2, unit: "oz", name: "Gin" }] }, { name: "Empty", ingredients: [] }] });
[st, body] = await call({ mode: "generate", bar: { liquors: ["Gin"] }, fresh: ["Lemons"], taste: { liked: [{ name: "Negroni", ingredients: ["Gin", "Campari"] }], avoid: ["Negroni"] } });
check("ideas drop empty drinks", st === 200 && body.drinks.length === 1);
check("ideas prompt includes taste and avoid list", sent.messages[0].content[0].text.includes("Drinks they love") && sent.messages[0].content[0].text.includes("don't suggest them again: Negroni"));
check("no ingredients refused", (await call({ mode: "generate", bar: {}, fresh: [] }))[0] === 400);

claudeReply = ok({ options: [{ name: "Aperol", amount: 1, unit: "oz", why: "Lighter." }] });
[st, body] = await call({ mode: "substitute", drink: { name: "Negroni", ingredients: [{ amount: 1, unit: "oz", name: "Gin" }, { amount: 1, unit: "oz", name: "Campari" }] }, index: 1, bar: { liquors: ["Aperol"] } });
check("swaps returned", st === 200 && body.options[0].name === "Aperol");
check("swap prompt marks the right ingredient", sent.messages[0].content[0].text.includes("→ 1 oz Campari"));

claudeReply = ok({ found: true, name: "Last Word", method: "Shaken", ingredients: [{ amount: 0.75, unit: "oz", name: "Gin" }], about: "Detroit." });
claudeCalls = 0;
[st, body] = await call({ mode: "standard", query: "The Last Word cocktail" });
check("standard recipe saved under its proper name", st === 200 && body.standard.slug === "last-word" && rows.standard_recipes.length === 1);
await call({ mode: "standard", query: "last word" });
check("repeat lookup is served from the library", claudeCalls === 1);
await call({ mode: "standard", query: "lastword" });
await call({ mode: "standard", query: "LastWord" });
check("new spelling saved as an alias, then reused", claudeCalls === 2 && rows.standard_recipes[0].aliases.join() === "lastword");
claudeReply = ok({ found: false, name: "gin", did_you_mean: "Gin Rickey" });
[st, body] = await call({ mode: "standard", query: "gin" });
check("non-cocktail gets a suggestion", st === 422 && body.did_you_mean === "Gin Rickey");

claudeReply = ok({ bottles: [{ name: "Bourbon", brand: "Buffalo Trace", category: "liquor", confidence: "high", count: 2 }, { name: "", category: "other", confidence: "low" }, { name: "Campari", brand: "", category: "liqueur", confidence: "weird" }], note: "" });
[st, body] = await call({ mode: "bottles", image: "abc", mediaType: "image/jpeg" });
check("bottles identified, blanks dropped", st === 200 && body.bottles.length === 2 && body.bottles[0].brand === "Buffalo Trace" && body.bottles[0].count === 2, JSON.stringify(body));
check("unknown confidence normalized", body.bottles[1].confidence === "medium");
check("bottle request sends the photo", sent.messages[0].content[0].type === "image" && sent.tools[0].name === "save_bottles");
check("bottle photo must be an image", (await call({ mode: "bottles", image: "abc", mediaType: "application/pdf" }))[0] === 400);

claudeReply = ok({ found: true, name: "Buffalo Trace", product: "Buffalo Trace Kentucky Straight Bourbon Whiskey", ingredient: "Bourbon", category: "whiskey", producer: "Buffalo Trace Distillery", origin: "Kentucky, USA", abv: 45, age: "", description: "A classic bourbon." });
claudeCalls = 0;
[st, body] = await call({ mode: "bottle", query: "buffalo trace bourbon" });
check("bottle looked up and saved", st === 200 && body.bottle.slug === "buffalo-trace" && rows.bottles.length === 1 && body.bottle.abv === 45, JSON.stringify(body));
check("search wording saved as an alias", rows.bottles[0].aliases.includes("buffalo-trace-bourbon"));
await call({ mode: "bottle", query: "Buffalo Trace Bourbon" });
await call({ mode: "bottle", query: "Buffalo Trace" });
check("repeat bottle lookups are free", claudeCalls === 1);
claudeReply = ok({ found: false, name: "gin", did_you_mean: "Tanqueray London Dry" });
[st, body] = await call({ mode: "bottle", query: "gin" });
check("generic spirit gets a product suggestion", st === 422 && body.error === "not_a_bottle" && body.did_you_mean === "Tanqueray London Dry");
claudeReply = ok({ found: true, name: "Odd", abv: 250, category: "nonsense" });
[st, body] = await call({ mode: "bottle", query: "odd stuff" });
check("bad ABV and category cleaned up", body.bottle.abv === null && body.bottle.category === "other");
claudeReply = ok({ found: true, name: "Fever-Tree Tonic", category: "mixer", non_alcoholic: true });
[st, body] = await call({ mode: "bottle", query: "fever tree tonic" });
check("non-alcoholic bottles saved as 0% ABV", body.bottle.abv === 0);
claudeReply = ok({ found: true, name: "Mystery Rum", category: "rum", abv: 0 });
[st, body] = await call({ mode: "bottle", query: "mystery rum" });
check("unsure ABV on a spirit left blank, not 0", body.bottle.abv === null);

scansToday = 25;
check("daily allowance enforced", (await call({ mode: "generate", bar: { liquors: ["Gin"] } }))[0] === 429);
claudeReply = ok({ drinks: [{ name: "Gin Sour", ingredients: [{ amount: 2, unit: "oz", name: "Gin" }] }] });
check("emails in UNLIMITED_EMAILS have no daily limit", (await call({ mode: "generate", bar: { liquors: ["Gin"] } }, "listed"))[0] === 200);
check("site admins have no daily limit", (await call({ mode: "generate", bar: { liquors: ["Gin"] } }, "boss"))[0] === 200);
check("library hits still free over the allowance", (await call({ mode: "standard", query: "last word" }))[0] === 200);
scansToday = 0;

claudeReply = () => new Response(JSON.stringify({ error: { message: "Your credit balance is too low" } }), { status: 400 });
check("no credit reported clearly", (await call({ mode: "generate", bar: { liquors: ["Gin"] } }))[1].error === "no_credit");
claudeReply = () => new Response("{}", { status: 401 });
check("bad key reported clearly", (await call({ mode: "generate", bar: { liquors: ["Gin"] } }))[1].error === "bad_key");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
