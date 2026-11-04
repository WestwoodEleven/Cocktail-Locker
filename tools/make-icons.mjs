import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)("playwright");
// Draws the app icons into icons/. Run: node tools/make-icons.mjs
const out = new URL("../icons", import.meta.url).pathname;
// The mark from the site header: the brass bar cart, on the near-black bar color.
// scale: how much of the canvas the glass fills (smaller for maskable icons, which get cropped to a circle).
const svg = (size, { round, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  ${round ? `<rect width="100" height="100" rx="22" fill="#121418"/>` : `<rect width="100" height="100" fill="#121418"/>`}
  <g transform="translate(50 50) scale(${scale * 3.4}) translate(-16.9 -17.4)"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M7.6 6.3 H12.4 L10 9.2 Z" fill="#E3E7B8" stroke="none" opacity=".9"/><path d="M6.5 5 H13.5 L10 9.2 Z M10 9.2 V13.2 M8 13.4 H12" stroke="#F5F5F2" stroke-width="1.4"/><path d="M8.6 3.6 L11.3 7.4" stroke="#F5F5F2" stroke-width=".8"/><circle cx="10.6" cy="6.5" r="1.35" fill="#7FA33A" stroke="none"/><circle cx="10.95" cy="6.3" r=".45" fill="#D2333F" stroke="none"/><path d="M16.6 13.4 L17.2 7.6 H20.8 L21.4 13.4 Z" fill="#B9BEC6" stroke="none"/><path d="M17.6 7.6 L18.2 5.6 H19.8 L20.4 7.6 Z M18.6 5.6 V4.3 H19.4 V5.6 Z" fill="#DADDE2" stroke="none"/><path d="M17.7 8.4 L17.3 12.8" stroke="#F4F5F7" stroke-width=".7"/><path d="M16.6 13.4 L17.2 7.6 H20.8 L21.4 13.4 Z M17.6 7.6 L18.2 5.6 H19.8 L20.4 7.6 M18.6 5.6 V4.3 H19.4 V5.6" stroke="#F5F5F2" stroke-width="1.1"/><path d="M17.05 9.6 H20.95" stroke="#F5F5F2" stroke-width=".7"/><path d="M8.4 20 H13.6 L13.3 23 H8.7 Z" fill="#C77A2A" stroke="none"/><rect x="9.3" y="18.6" width="2.6" height="2.4" rx=".4" transform="rotate(-10 10.6 19.8)" stroke="#F5F5F2" stroke-width=".7"/><path d="M7.5 17.6 L8.1 23.4 H13.9 L14.5 17.6 Z" stroke="#F5F5F2" stroke-width="1.4"/><path d="M17.4 23.4 V18.9 Q17.4 17.4 18.8 16.8 V15.2 H20.2 V16.8 Q21.6 17.4 21.6 18.9 V23.4 Z" fill="#C77A2A" stroke="none"/><rect x="17.4" y="19.4" width="4.2" height="2.4" fill="#F3E6C4" stroke="none"/><path d="M17.4 23.4 V18.9 Q17.4 17.4 18.8 16.8 V15.2 H20.2 V16.8 Q21.6 17.4 21.6 18.9 V23.4 Z" stroke="#F5F5F2" stroke-width="1.1"/><path d="M4 14.5 H26 M4 24.5 H26 M5.5 14.5 V27.5 M24.5 14.5 V27.5 M26 14.5 L29 9.5" stroke="#D4A24C" stroke-width="2"/></g><circle cx="5.5" cy="29.3" r="1.8" fill="#D4A24C"/><circle cx="24.5" cy="29.3" r="1.8" fill="#D4A24C"/><circle cx="5.5" cy="29.3" r=".6" fill="#121418"/><circle cx="24.5" cy="29.3" r=".6" fill="#121418"/></g>
</svg>`;
const icons = [
  ["icon-192.png", 192, { round: true, scale: 0.8 }],
  ["icon-512.png", 512, { round: true, scale: 0.8 }],
  ["maskable-512.png", 512, { round: false, scale: 0.66 }],
  ["apple-touch-icon.png", 180, { round: false, scale: 0.74 }],
  ["favicon-64.png", 64, { round: true, scale: 0.88 }]
];
const b = await chromium.launch();
for (const [name, size, opt] of icons) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg(size, opt)}</body></html>`);
  await p.screenshot({ path: `${out}/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await p.close();
}

await b.close();

