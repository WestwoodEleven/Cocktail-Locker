import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)("playwright");
// Draws the app icons into icons/. Run: node tools/make-icons.mjs
const out = new URL("../icons", import.meta.url).pathname;
// The mark from the site header: a cocktail glass with a cherry, on the near-black bar color.
// scale: how much of the canvas the glass fills (smaller for maskable icons, which get cropped to a circle).
const svg = (size, { round, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  ${round ? `<rect width="100" height="100" rx="22" fill="#121418"/>` : `<rect width="100" height="100" fill="#121418"/>`}
  <g transform="translate(50 50) scale(${scale}) translate(-50 -50)">
    <path d="M24 31 H76 L50 57 Z" fill="#B3122E"/>
    <path d="M14 22 H86 L50 58 Z" fill="none" stroke="#F5F5F2" stroke-width="5.5" stroke-linejoin="round"/>
    <path d="M50 58 V82 M34 84 H66" stroke="#F5F5F2" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M70 23 L78 10" stroke="#F5F5F2" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="70" cy="24" r="8.5" fill="#E8203F" stroke="#121418" stroke-width="2.5"/>
  </g>
</svg>`;
const icons = [
  ["icon-192.png", 192, { round: true, scale: 0.86 }],
  ["icon-512.png", 512, { round: true, scale: 0.86 }],
  ["maskable-512.png", 512, { round: false, scale: 0.66 }],
  ["apple-touch-icon.png", 180, { round: false, scale: 0.8 }],
  ["favicon-64.png", 64, { round: true, scale: 0.95 }]
];
const b = await chromium.launch();
for (const [name, size, opt] of icons) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg(size, opt)}</body></html>`);
  await p.screenshot({ path: `${out}/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await p.close();
}

await b.close();

