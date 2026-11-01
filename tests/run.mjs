// Runs every browser test against the site with a stand-in database. Usage: node tests/run.mjs
import { start, stop, summary } from "./harness.mjs";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
await start();
try {
  for (const f of readdirSync(dir).filter(f => /^t\d.*\.mjs$/.test(f)).sort()) {
    console.log("\n" + f);
    const mod = await import(path.join(dir, f));
    try { await mod.default(); } catch (e) { console.log("  FAIL crashed: " + e.message.split("\n")[0]); process.exitCode = 1; }
  }
} finally { await stop(); }
if (summary()) process.exitCode = 1;
