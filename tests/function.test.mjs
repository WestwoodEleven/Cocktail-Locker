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
const rows = { standard_recipes: [], recipe_scans: [] };
globalThis.Deno = { env: { get: k => ({ ANTHROPIC_API_KEY: " 'sk-ant-test' ", SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "y" })[k] }, serve: h => { handler = h; } };
globalThis.__cc = () => ({
  auth: { getUser: async t => t === "good" ? { data: { user: { id: "u1" } } } : { error: "no" } },
  from: t => ({
    select: () => ({ eq: () => ({ gte: async () => ({ count: scansToday }) }),
      or: f => ({ limit: async () => { const m = f.match(/slug\.eq\.([^,]+),aliases\.cs\.\{([^}]+)\}/); return { data: rows.standard_recipes.filter(r => r.slug === m[1] || r.aliases.includes(m[2])).map(r => structuredClone(r)) }; } }) }),
    insert: async r => { rows[t].push(structuredClone(r)); return {}; },
    update: v => ({ eq: async (_, slug) => { Object.assign(rows.standard_recipes.find(r => r.slug === slug), v); return {}; } })
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

scansToday = 25;
check("daily allowance enforced", (await call({ mode: "generate", bar: { liquors: ["Gin"] } }))[0] === 429);
check("library hits still free over the allowance", (await call({ mode: "standard", query: "last word" }))[0] === 200);
scansToday = 0;

claudeReply = () => new Response(JSON.stringify({ error: { message: "Your credit balance is too low" } }), { status: 400 });
check("no credit reported clearly", (await call({ mode: "generate", bar: { liquors: ["Gin"] } }))[1].error === "no_credit");
claudeReply = () => new Response("{}", { status: 401 });
check("bad key reported clearly", (await call({ mode: "generate", bar: { liquors: ["Gin"] } }))[1].error === "bad_key");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
