import { chromium } from "playwright"; import { readFileSync } from "fs";
const sp = process.argv[2]; const g = readFileSync(sp + "/cart.svg.txt", "utf8");
const svg = s => `<svg width="${s}" height="${s}" viewBox="0 0 32 32">${g}</svg>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 520, height: 200 }, deviceScaleFactor: 2 });
await p.setContent(`<body style="margin:0;font-family:sans-serif"><div style="background:#121418;color:#fff;padding:16px;display:flex;gap:24px;align-items:center">${[24,28,40,96].map(svg).join("")}</div><div style="background:#F5F5F2;color:#121418;padding:16px;display:flex;gap:24px;align-items:center">${[24,28,40].map(svg).join("")}</div></body>`);
await p.screenshot({ path: sp + "/cart.png" }); await b.close();
