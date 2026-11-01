// Stamps index.html's script and style links with a short hash of their contents (?v=...),
// so browsers fetch new code right after a change instead of using a cached copy.
// Run after editing any file in js/ or styles.css:  node tools/stamp.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function stampedHtml() {
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  return html.replace(/(<script src="|<link rel="stylesheet" href=")((?:js\/[^"?]+\.js)|styles\.css|config\.js)(?:\?v=[a-f0-9]+)?"/g, (m, pre, file) => {
    const v = createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex").slice(0, 10);
    return `${pre}${file}?v=${v}"`;
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = stampedHtml();
  writeFileSync(path.join(root, "index.html"), out);
  console.log("Stamped index.html");
}
