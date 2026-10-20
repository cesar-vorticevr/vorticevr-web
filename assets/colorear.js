// "Colorea mi dibujo": a line drawing that anyone with the link paints with a finger. Used by the viewer (/x/) and by the
// preview in /crear/colorear/. Everything runs on the device: nothing is uploaded, the result is saved or shared from the phone.
//
// Two canvases of the same size: the paint (bottom, starts white) and the lines (top, the drawing with its white made
// transparent, so the color always stays under the lines). A pixel darker than cfg.th is a "wall": the bucket fills the
// zone the tap falls in up to the walls (plus 2 px under them so no white halo is left), and the brush, with
// "No salirse" on, only paints inside the zone where the stroke started.

export const PALETTES = {
  vivos: ["#e53935", "#ff7043", "#fb8c00", "#fdd835", "#c0ca33", "#43a047", "#00897b", "#00acc1", "#1e88e5", "#3949ab", "#8e24aa", "#d81b60", "#f48fb1", "#8d6e63", "#5d4037", "#212121", "#9e9e9e", "#ffffff"],
  pastel: ["#ffb3ba", "#ffcba4", "#ffdfba", "#ffffba", "#dcedc1", "#baffc9", "#a8e6cf", "#bae1ff", "#a0c4ff", "#c5b3ff", "#e0bbe4", "#fec8d8", "#f6eac2", "#d5c6b0", "#b5a7a0", "#6d6875", "#d9d9d9", "#ffffff"],
  naturaleza: ["#2e7d32", "#558b2f", "#8bc34a", "#cddc39", "#827717", "#4e342e", "#795548", "#a1887f", "#d7ccc8", "#0277bd", "#4fc3f7", "#b3e5fc", "#ff8f00", "#ffca28", "#fff59d", "#e64a19", "#616161", "#ffffff"],
  piel: ["#ffe0c4", "#f5c7a1", "#e8b48a", "#d19a6a", "#b07a4f", "#8d5a3b", "#6b4029", "#4a2c1d", "#2b1a12", "#f2d16b", "#c98b3c", "#8a4b2a", "#e53935", "#1e88e5", "#43a047", "#fdd835", "#212121", "#ffffff"],
};
export const PALETTE_NAMES = { vivos: "Vivos", pastel: "Pastel", naturaleza: "Naturaleza", piel: "Piel y cabello" };
const MORE = ["#b71c1c", "#e65100", "#f9a825", "#33691e", "#004d40", "#01579b", "#1a237e", "#4a148c", "#880e4f", "#3e2723",
  "#ef9a9a", "#ffcc80", "#fff176", "#a5d6a7", "#80cbc4", "#81d4fa", "#9fa8da", "#ce93d8", "#f8bbd0", "#bcaaa4",
  "#ff1744", "#ff9100", "#ffea00", "#76ff03", "#1de9b6", "#00b0ff", "#651fff", "#d500f9", "#f50057", "#000000"];

const LUM = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// For the maker: how much of the picture is "line" with this threshold (a photo or a dark background gives a lot).
export function analyze(img, th) {
  const k = Math.min(1, 400 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * k)), h = Math.max(1, Math.round((img.naturalHeight || img.height) * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data; let dark = 0, color = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (LUM(r, g, b) < th) dark++;
    if (mx > 50 && (mx - mn) / mx > 0.3) color++;   // a clearly colored pixel (not white, gray or black)
  }
  return { dark: dark / (w * h), color: color / (w * h) };
}

// A color picture (or a photo) → black outlines on white, ready to color. Contours = where the color changes
// (Sobel on R, G and B after a light blur; detail 0–100 sets how small a change counts) plus the dark outlines it
// already has; specks are dropped and the lines are thickened a little so the zones stay closed.
export function toLineArt(img, detail = 50, maxPx = 1600) {
  const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height, k = Math.min(1, maxPx / Math.max(nw, nh));
  const w = Math.round(nw * k), h = Math.round(nh * k), n = w * h;
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, w, h);
  const id = x.getImageData(0, 0, w, h), d = id.data;
  const ch = [new Uint8ClampedArray(n), new Uint8ClampedArray(n), new Uint8ClampedArray(n)], lum = new Uint8ClampedArray(n);
  let darkN = 0;
  for (let p = 0, i = 0; p < n; p++, i += 4) { ch[0][p] = d[i]; ch[1][p] = d[i + 1]; ch[2][p] = d[i + 2]; lum[p] = LUM(d[i], d[i + 1], d[i + 2]); if (lum[p] < 60) darkN++; }
  const keepDark = darkN < n * 0.2;   // its own dark outlines count as lines, unless the picture is dark overall (night, dark background)
  // [1 2 1] blur, twice when less detail is wanted (hides texture and noise)
  const tmp = new Uint8ClampedArray(n), passes = detail < 40 ? 3 : detail < 75 ? 2 : 1;
  for (const a of ch) for (let s = 0; s < passes; s++) {
    for (let y = 0; y < h; y++) { const o = y * w; for (let X = 0; X < w; X++) tmp[o + X] = (a[o + Math.max(0, X - 1)] + 2 * a[o + X] + a[o + Math.min(w - 1, X + 1)]) >> 2; }
    for (let y = 0; y < h; y++) { const u = Math.max(0, y - 1) * w, m = y * w, v = Math.min(h - 1, y + 1) * w; for (let X = 0; X < w; X++) a[m + X] = (tmp[u + X] + 2 * tmp[m + X] + tmp[v + X]) >> 2; }
  }
  const T = 300 - detail * 2.3;   // edge strength needed: 300 (only strong changes) … 70 (fine detail)
  const edge = new Uint8Array(n);
  for (let y = 1; y < h - 1; y++) for (let X = 1; X < w - 1; X++) {
    const p = y * w + X; let mag = 0;
    for (const a of ch) {
      const gx = a[p - w + 1] + 2 * a[p + 1] + a[p + w + 1] - a[p - w - 1] - 2 * a[p - 1] - a[p + w - 1];
      const gy = a[p + w - 1] + 2 * a[p + w] + a[p + w + 1] - a[p - w - 1] - 2 * a[p - w] - a[p - w + 1];
      const g = Math.abs(gx) + Math.abs(gy); if (g > mag) mag = g;
    }
    if (mag > T || (keepDark && lum[p] < 60)) edge[p] = 1;
  }
  // drop specks (fewer than 2 neighbors), then thicken by 1 px
  const keep = new Uint8Array(n);
  for (let y = 1; y < h - 1; y++) for (let X = 1; X < w - 1; X++) {
    const p = y * w + X; if (!edge[p]) continue;
    const nb = edge[p - w - 1] + edge[p - w] + edge[p - w + 1] + edge[p - 1] + edge[p + 1] + edge[p + w - 1] + edge[p + w] + edge[p + w + 1];
    if (nb >= 2) keep[p] = 1;
  }
  const thick = Math.max(w, h) >= 900;
  for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
    const p = y * w + X; let on = keep[p];
    if (!on && thick && X > 0 && y > 0 && X < w - 1 && y < h - 1) on = keep[p - 1] | keep[p + 1] | keep[p - w] | keep[p + w] | keep[p - w - 1] | keep[p - w + 1] | keep[p + w - 1] | keep[p + w + 1];
    const v = on ? 20 : 255, i = p * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  return c;
}

const CSS = `
.clr{position:absolute;inset:0;display:flex;flex-direction:column;background:radial-gradient(90% 60% at 50% 30%,#22104a,#05020b 75%);color:#f2ecff;font-family:"IBM Plex Sans",system-ui,sans-serif;user-select:none;-webkit-user-select:none;overflow:hidden}
.clr.full{padding-top:calc(52px + env(safe-area-inset-top,0px))}
.clr button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.clr-stage{position:relative;flex:1;min-height:0;overflow:hidden;touch-action:none;display:flex;align-items:center;justify-content:center}
.clr-wrap{position:relative;transform-origin:0 0;box-shadow:0 18px 50px -12px rgba(0,0,0,.7),0 0 0 1px rgba(210,184,255,.25);border-radius:6px;overflow:hidden;background:#fff;flex:none}
.clr-wrap canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.clr-wrap canvas.ln{pointer-events:none}
.clr-fit{position:absolute;right:10px;top:10px;width:40px;height:40px;border-radius:50%;border:1px solid rgba(210,184,255,.45);background:rgba(10,4,22,.72);display:grid;place-items:center;backdrop-filter:blur(8px)}
.clr-fit svg{width:20px;height:20px;fill:#fff}
.clr-toast{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);max-width:calc(100% - 28px);background:rgba(10,4,22,.86);border:1px solid rgba(210,184,255,.35);border-radius:999px;padding:9px 16px;font-size:.88rem;font-weight:600;text-align:center;pointer-events:none;transition:opacity .4s;backdrop-filter:blur(8px)}
.clr-toast.off{opacity:0}
.clr-bar{flex:none;display:flex;flex-direction:column;gap:8px;padding:10px 10px calc(10px + env(safe-area-inset-bottom,0px));background:rgba(10,4,22,.9);border-top:1px solid rgba(210,184,255,.18)}
.clr-row{display:flex;align-items:center;gap:6px}
.clr-tool{flex:none;width:46px;height:46px;border-radius:14px;border:1px solid rgba(210,184,255,.3);background:rgba(255,255,255,.04);display:grid;place-items:center;transition:background .2s,border-color .2s,transform .15s}
.clr-tool svg{width:24px;height:24px;fill:currentColor}
.clr-tool[aria-pressed="true"]{background:linear-gradient(135deg,#8b3fd6,#5a1f8f);border-color:#d2b8ff;box-shadow:0 0 18px rgba(139,63,214,.6)}
.clr-tool:active{transform:scale(.92)}
.clr-tool:disabled{opacity:.35}
.clr-sp{flex:1}
.clr-save{flex:none;height:46px;border-radius:999px;border:1px solid #ffbe55;background:linear-gradient(135deg,#ffd27f,#ff9f3a);color:#1a0d00!important;font:700 .82rem "Sora",system-ui,sans-serif!important;letter-spacing:.08em;text-transform:uppercase;padding:0 16px;box-shadow:0 0 22px rgba(255,170,60,.35);display:flex;align-items:center;gap:8px}
.clr-save svg{width:18px;height:18px;fill:currentColor}
.clr-colors{display:flex;gap:8px;padding:3px 2px 4px;align-items:center}
.clr-colors::-webkit-scrollbar{display:none}
.clr-sw{flex:none;width:36px;height:36px;border-radius:50%;border:2px solid rgba(255,255,255,.25);transition:transform .15s}
.clr-sw[aria-pressed="true"]{transform:scale(1.18);border-color:#fff;box-shadow:0 0 0 3px rgba(139,63,214,.9)}
.clr-sw.cur{width:52px;height:52px;border:3px solid #fff;box-shadow:0 0 0 2px rgba(139,63,214,.9),0 4px 14px rgba(0,0,0,.5)}
.clr-spec{position:relative;flex:1;min-width:150px;height:52px;display:flex;gap:6px;touch-action:none;cursor:crosshair}
.clr-spec .hue{flex:1;border-radius:12px;background:linear-gradient(to bottom,#fff 0%,rgba(255,255,255,0) 50%,rgba(0,0,0,0) 50%,#000 100%),linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}
.clr-spec .gray{flex:none;width:26px;border-radius:10px;background:linear-gradient(#fff,#000);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}
.clr-spec i{position:absolute;width:26px;height:26px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.5),0 3px 10px rgba(0,0,0,.5);transform:translate(-50%,-50%);pointer-events:none}
.clr-sizes{display:flex;gap:4px;align-items:center;flex:none;padding-right:6px;margin-right:2px;border-right:1px solid rgba(210,184,255,.2)}
.clr-sizes button{width:34px;height:36px;border-radius:10px;border:1px solid transparent;background:none;display:grid;place-items:center}
.clr-sizes button i{display:block;border-radius:50%;background:#fff}
.clr-sizes button[aria-pressed="true"]{border-color:#d2b8ff;background:rgba(139,63,214,.35)}
.clr-pop{position:absolute;left:10px;right:10px;bottom:calc(100% + 8px);background:rgba(16,7,34,.97);border:1px solid rgba(210,184,255,.35);border-radius:16px;padding:12px;box-shadow:0 20px 50px -10px rgba(0,0,0,.8)}
.clr-pop h4{margin:0 0 8px;font:700 .78rem "Sora",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d2b8ff}
.clr-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:6px}
.clr-grid button{aspect-ratio:1;border-radius:50%;border:2px solid rgba(255,255,255,.2)}
.clr-box{display:grid;gap:12px}
.clr-sv{position:relative;height:150px;border-radius:12px;touch-action:none;cursor:crosshair;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}
.clr-hue{position:relative;height:28px;border-radius:999px;touch-action:none;cursor:pointer;background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)}
.clr-sv i,.clr-hue i{position:absolute;width:28px;height:28px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.4),0 3px 10px rgba(0,0,0,.5);transform:translate(-50%,-50%);pointer-events:none}
.clr-hue i{top:50%}
.clr-okrow{display:flex;gap:10px;align-items:center;margin-top:12px}
.clr-now{flex:1;height:44px;border-radius:12px;display:grid;place-items:center;font:600 .85rem "IBM Plex Mono",monospace;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
.clr-ok{flex:none;height:44px;border-radius:999px;border:1px solid #d2b8ff;background:linear-gradient(135deg,#8b3fd6,#5a1f8f);font:700 .85rem "Sora",system-ui,sans-serif!important;letter-spacing:.08em;text-transform:uppercase;padding:0 22px}
.clr-pop{max-height:calc(100vh - 140px);max-height:calc(100dvh - 140px);overflow-y:auto}
.clr.mini .clr-pop{max-height:340px}
.clr-menu{display:grid;gap:4px}
.clr-menu button,.clr-menu a{display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;padding:12px;border-radius:10px;border:0;background:rgba(255,255,255,.04);color:#f2ecff;text-decoration:none;font-size:.95rem}
.clr-menu .sw{width:42px;height:24px;border-radius:999px;background:rgba(255,255,255,.2);position:relative;flex:none;transition:background .2s}
.clr-menu .sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s}
.clr-menu .sw.on{background:#74e8ba}.clr-menu .sw.on::after{transform:translateX(18px)}
.clr-sheet{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:calc(60px + env(safe-area-inset-top,0px)) 18px calc(20px + env(safe-area-inset-bottom,0px));background:rgba(5,2,11,.94);text-align:center}
.clr-sheet h3{margin:0;font:700 1.5rem "Sora",system-ui,sans-serif}
.clr-sheet img{max-width:min(100%,420px);max-height:48vh;border-radius:10px;box-shadow:0 20px 50px -10px rgba(139,63,214,.8)}
.clr-sheet .acts{display:flex;flex-direction:column;gap:10px;width:min(100%,340px)}
.clr-sheet .acts button,.clr-sheet .acts a{display:flex;justify-content:center;align-items:center;gap:8px;border-radius:999px;padding:14px 18px;font:700 .85rem "Sora",system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;border:1px solid rgba(210,184,255,.45);background:rgba(20,9,40,.7);color:#fff}
.clr-sheet .acts .p{background:linear-gradient(135deg,#ffd27f,#ff9f3a);border-color:#ffbe55;color:#1a0d00}
.clr-sheet small{color:#b9addb;max-width:34ch;font-size:.8rem}
.clr-soc{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.clr-soc a{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:rgba(139,63,214,.3);border:1px solid rgba(210,184,255,.4)}
.clr-soc svg{width:20px;height:20px;fill:#fff}
.clr-conf{position:absolute;top:-10px;width:10px;height:14px;border-radius:2px;pointer-events:none;z-index:6;animation:clrFall var(--d) cubic-bezier(.3,.6,.5,1) forwards}
@keyframes clrFall{to{transform:translate(var(--x),110vh) rotate(var(--r))}}
.clr.mini .clr-tool{width:40px;height:40px;border-radius:12px}.clr.mini .clr-sw.cur{width:44px;height:44px}.clr.mini .clr-spec{height:44px}.clr.mini .clr-save{display:none}
@media (prefers-reduced-motion:reduce){.clr-conf{display:none}}
@media (max-width:420px){.clr-row{gap:5px}.clr-tool{width:40px;height:44px;border-radius:12px}.clr-save{padding:0 12px;letter-spacing:.04em;gap:6px}}
@media (max-width:345px){.clr-tool{width:36px}.clr-save{padding:0 10px}}`;

const SVG = {
  fill: '<path d="M16.6 9.2 8.4 1 7 2.4l2.4 2.4-5.2 5.2a1.5 1.5 0 0 0 0 2.1l5.5 5.5a1.5 1.5 0 0 0 2.1 0l5.5-5.5a1.5 1.5 0 0 0 0-2.1zM5.9 11 10.8 6l4.9 5H5.9zM19 12.5s-2 2.2-2 3.5a2 2 0 0 0 4 0c0-1.3-2-3.5-2-3.5zM2 20h20v4H2z"/>',
  brush: '<path d="M7 14c-1.7 0-3 1.3-3 3 0 1.3-1.2 2-2 2 .9 1.2 2.5 2 4 2 2.2 0 4-1.8 4-4 0-1.7-1.3-3-3-3zm13.7-9.6-1.3-1.3a1 1 0 0 0-1.4 0L9 12l2.8 2.8 8.9-9a1 1 0 0 0 0-1.4z"/>',
  eraser: '<path d="M16.2 3.6 21.4 8.8a2 2 0 0 1 0 2.8L12 21H6.8l-3.2-3.2a2 2 0 0 1 0-2.8L13.4 3.6a2 2 0 0 1 2.8 0zM5 16.4 7.6 19h3.6l1.6-1.6-5.2-5.2L5 14.8v1.6zM8 21h13v-2H10z"/>',
  undo: '<path d="M12.5 8c-2.6 0-5 1-6.9 2.6L2 7v9h9l-3.6-3.6A7.9 7.9 0 0 1 20.1 16l2.4-.8A10.5 10.5 0 0 0 12.5 8z"/>',
  more: '<path d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>',
  save: '<path d="M12 2 7 7h3v7h4V7h3l-5-5zM4 15v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5h-2v5H6v-5H4z"/>',
  fit: '<path d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z"/>',
};

const hex2rgb = h => { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
function hex2hsv(hex) {
  const [r, g, b] = hex2rgb(hex).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn;
  let h = 0; if (dd) h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
  return [Math.round((h * 60 + 360) % 360), mx ? dd / mx : 0, mx];
}
function hsv2hex(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return "#" + [f(5), f(3), f(1)].map(x => x.toString(16).padStart(2, "0")).join("");
}

// opts: { root, image (url or <img>), th, palette, title, slug, key (autosave), embedded, buttons:[{href,label,svg}], logo (url) }
export async function run(opts) {
  if (!document.getElementById("clr-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "clr-css", textContent: CSS }));
  const img = typeof opts.image === "string" ? await loadImg(opts.image) : opts.image;
  const th = opts.th || 170, emb = !!opts.embedded;

  // ---- work size: the longest side between 1000 and 1400 px ----
  const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height, longest = Math.max(nw, nh);
  const k = Math.min(1400, Math.max(1000, longest)) / longest;
  const W = Math.round(nw * k), H = Math.round(nh * k), N = W * H;

  // ---- walls and the lines layer ----
  const src = document.createElement("canvas"); src.width = W; src.height = H;
  const sx = src.getContext("2d", { willReadFrequently: true });
  sx.fillStyle = "#fff"; sx.fillRect(0, 0, W, H); sx.imageSmoothingQuality = "high"; sx.drawImage(img, 0, 0, W, H);
  const sd = sx.getImageData(0, 0, W, H), d = sd.data, wall = new Uint8Array(N);
  for (let i = 0, p = 0; p < N; i += 4, p++) {
    const l = LUM(d[i], d[i + 1], d[i + 2]);
    if (l < th) wall[p] = 1;
    d[i + 3] = l >= 245 ? 0 : l <= 70 ? 255 : Math.round((245 - l) / 175 * 255);   // white → transparent, keeps the line's own color
  }

  // ---- DOM ----
  const root = document.createElement("div"); root.className = "clr" + (emb ? " mini" : " full");
  root.innerHTML = `<div class="clr-stage"><div class="clr-wrap"><canvas class="pt"></canvas><canvas class="ln"></canvas></div>
    <button class="clr-fit" type="button" aria-label="Ver todo el dibujo" hidden><svg viewBox="0 0 24 24">${SVG.fit}</svg></button><div class="clr-toast off"></div></div>
    <div class="clr-bar" style="position:relative">
      <div class="clr-row">
        <button class="clr-tool" data-t="fill" type="button" aria-label="Cubeta: pinta una zona completa" title="Cubeta"><svg viewBox="0 0 24 24">${SVG.fill}</svg></button>
        <button class="clr-tool" data-t="brush" type="button" aria-label="Pincel" title="Pincel"><svg viewBox="0 0 24 24">${SVG.brush}</svg></button>
        <button class="clr-tool" data-t="eraser" type="button" aria-label="Borrador" title="Borrador"><svg viewBox="0 0 24 24">${SVG.eraser}</svg></button>
        <button class="clr-tool" data-a="undo" type="button" aria-label="Deshacer" title="Deshacer" disabled><svg viewBox="0 0 24 24">${SVG.undo}</svg></button>
        <button class="clr-tool" data-a="menu" type="button" aria-label="Más opciones" title="Más opciones"><svg viewBox="0 0 24 24">${SVG.more}</svg></button>
        <span class="clr-sp"></span>
        <button class="clr-save" data-a="save" type="button"><svg viewBox="0 0 24 24">${SVG.save}</svg>Guardar</button>
      </div>
      <div class="clr-colors"></div>
    </div>`;
  opts.root.appendChild(root);
  const $ = s => root.querySelector(s);
  const stage = $(".clr-stage"), wrap = $(".clr-wrap"), bar = $(".clr-bar"), toastEl = $(".clr-toast");
  const pc = $("canvas.pt"), lc = $("canvas.ln");
  pc.width = lc.width = W; pc.height = lc.height = H;
  const px = pc.getContext("2d", { willReadFrequently: true }), lx = lc.getContext("2d");
  lx.putImageData(sd, 0, 0);
  px.fillStyle = "#fff"; px.fillRect(0, 0, W, H);

  // ---- state ----
  const S = { tool: "fill", color: (PALETTES[opts.palette] || PALETTES.vivos)[0], size: 1, clip: false };   // the brush paints freely (under the lines); "No salirse" is in the menu
  const SIZES = [W * 0.006, W * 0.016, W * 0.04];
  const undo = [];
  const pushUndo = () => { undo.push(px.getImageData(0, 0, W, H)); if (undo.length > 8) undo.shift(); $('[data-a="undo"]').disabled = false; };

  // ---- autosave (only in the viewer) ----
  const KEY = !emb && opts.key ? `vvr-color-${opts.key}-${W}x${H}-${th}` : null;
  let saveT = 0;
  const autosave = () => { if (!KEY) return; clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, pc.toDataURL("image/png")); } catch (e) {} }, 1200); };
  let restored = false;
  if (KEY) { try { const v = localStorage.getItem(KEY); if (v) { const im = await loadImg(v); px.drawImage(im, 0, 0, W, H); restored = true; } } catch (e) {} }

  // ---- region of a point (flood over non-wall pixels, 4-neighbors) + 2 px under the walls ----
  const mark = new Uint32Array(N); let gen = 0;
  const stack = new Int32Array(N);
  function nearestOpen(x, y) {
    if (!wall[y * W + x]) return y * W + x;
    for (let r = 1; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      if (!wall[Y * W + X]) return Y * W + X;
    }
    return -1;
  }
  function region(x, y) {
    const s = nearestOpen(x, y); if (s < 0) return null;
    gen++; if (gen >= 0xfffffff0) { mark.fill(0); gen = 1; }
    const g = gen; let sp = 0, n = 0; stack[sp++] = s; mark[s] = g;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    const list = [];
    while (sp) {
      const p = stack[--sp]; list.push(p); n++;
      const px_ = p % W, py_ = (p - px_) / W;
      if (px_ < x0) x0 = px_; if (px_ > x1) x1 = px_; if (py_ < y0) y0 = py_; if (py_ > y1) y1 = py_;
      if (px_ > 0) { const q = p - 1; if (mark[q] !== g && !wall[q]) { mark[q] = g; stack[sp++] = q; } }
      if (px_ < W - 1) { const q = p + 1; if (mark[q] !== g && !wall[q]) { mark[q] = g; stack[sp++] = q; } }
      if (py_ > 0) { const q = p - W; if (mark[q] !== g && !wall[q]) { mark[q] = g; stack[sp++] = q; } }
      if (py_ < H - 1) { const q = p + W; if (mark[q] !== g && !wall[q]) { mark[q] = g; stack[sp++] = q; } }
    }
    // grow 2 px into the walls (the lines layer covers it), so the color meets the line without a white edge
    for (let pass = 0; pass < 2; pass++) {
      const add = [];
      for (const p of (pass ? list.slice(-list.added) : list)) {
        const X = p % W, Y = (p - X) / W;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const XX = X + dx, YY = Y + dy; if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
          const q = YY * W + XX; if (mark[q] !== g && wall[q]) { mark[q] = g; add.push(q); }
        }
      }
      for (const q of add) { list.push(q); const X = q % W, Y = (q - X) / W; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
      list.added = add.length;
    }
    return { list, x0, y0, x1, y1, open: n };
  }

  function fillAt(x, y) {
    const r = region(x, y); if (!r) return;
    pushUndo();
    const bw = r.x1 - r.x0 + 1, bh = r.y1 - r.y0 + 1, id = px.getImageData(r.x0, r.y0, bw, bh), a = id.data, [R, G, B] = hex2rgb(S.color);
    for (const p of r.list) { const X = p % W - r.x0, Y = (p - p % W) / W - r.y0, i = (Y * bw + X) * 4; a[i] = R; a[i + 1] = G; a[i + 2] = B; a[i + 3] = 255; }
    px.putImageData(id, r.x0, r.y0);
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
    if (r.open > N * 0.6) toast("Esa zona no está cerrada: se pintó casi todo. Toca ↶ para deshacer.");
    autosave();
  }

  // ---- brush: draws on its own layer, clipped to the starting zone when "No salirse" is on ----
  const stroke = document.createElement("canvas"); stroke.width = W; stroke.height = H; const sxx = stroke.getContext("2d");
  const maskC = document.createElement("canvas"); maskC.width = W; maskC.height = H; const mx = maskC.getContext("2d");
  const snap = document.createElement("canvas"); snap.width = W; snap.height = H; const snx = snap.getContext("2d");
  let drawing = null, raf = 0;
  function strokeStart(x, y) {
    pushUndo();
    snx.clearRect(0, 0, W, H); snx.drawImage(pc, 0, 0);
    sxx.clearRect(0, 0, W, H);
    let clip = false;
    if (S.clip) {
      const r = region(Math.round(x), Math.round(y));
      if (r) {
        const bw = r.x1 - r.x0 + 1, bh = r.y1 - r.y0 + 1, id = mx.createImageData(bw, bh), a = id.data;
        for (const p of r.list) { const X = p % W - r.x0, Y = (p - p % W) / W - r.y0; a[(Y * bw + X) * 4 + 3] = 255; }
        mx.clearRect(0, 0, W, H); mx.putImageData(id, r.x0, r.y0); clip = true;
      }
    }
    sxx.lineCap = sxx.lineJoin = "round"; sxx.lineWidth = SIZES[S.size] * (S.tool === "eraser" ? 1.6 : 1); sxx.strokeStyle = sxx.fillStyle = S.tool === "eraser" ? "#ffffff" : S.color;
    sxx.beginPath(); sxx.arc(x, y, sxx.lineWidth / 2, 0, Math.PI * 2); sxx.fill();
    drawing = { x, y, clip, moved: false };
    paintFrame();
  }
  function strokeMove(x, y) {
    if (!drawing) return;
    sxx.beginPath(); sxx.moveTo(drawing.x, drawing.y); sxx.lineTo(x, y); sxx.stroke();
    drawing.x = x; drawing.y = y; drawing.moved = true;
    if (!raf) raf = requestAnimationFrame(paintFrame);
  }
  function paintFrame() {
    raf = 0; if (!drawing) return;
    if (drawing.clip) { sxx.globalCompositeOperation = "destination-in"; sxx.drawImage(maskC, 0, 0); sxx.globalCompositeOperation = "source-over"; }
    px.clearRect(0, 0, W, H); px.drawImage(snap, 0, 0); px.drawImage(stroke, 0, 0);
  }
  function strokeEnd(cancel) {
    if (!drawing) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (cancel) { px.clearRect(0, 0, W, H); px.drawImage(snap, 0, 0); undo.pop(); $('[data-a="undo"]').disabled = !undo.length; }
    else { paintFrame(); autosave(); }
    drawing = null;
  }

  // ---- view: fit, pinch / wheel zoom and pan ----
  const V = { s: 1, tx: 0, ty: 0, bw: 0, bh: 0 };
  function layout() {
    const r = stage.getBoundingClientRect(), m = emb ? 8 : 14, f = Math.min((r.width - 2 * m) / W, (r.height - 2 * m) / H);
    V.bw = Math.max(10, W * f); V.bh = Math.max(10, H * f);
    wrap.style.width = V.bw + "px"; wrap.style.height = V.bh + "px"; apply();
  }
  function apply() {
    if (V.s <= 1.001) { V.s = 1; V.tx = V.ty = 0; }
    wrap.style.transform = `translate(${V.tx}px,${V.ty}px) scale(${V.s})`; $(".clr-fit").hidden = V.s === 1;
  }
  const ro = new ResizeObserver(layout); ro.observe(stage); layout();
  $(".clr-fit").addEventListener("click", () => { V.s = 1; apply(); });
  // stage point (relative to the wrapper's untransformed spot) of a client point
  const local = (cx, cy) => { const r = stage.getBoundingClientRect(); return { x: cx - r.left - (r.width - V.bw) / 2, y: cy - r.top - (r.height - V.bh) / 2 }; };
  const toCanvas = (cx, cy) => { const r = wrap.getBoundingClientRect(); return { x: (cx - r.left) / r.width * W, y: (cy - r.top) / r.height * H }; };
  function zoomAt(cx, cy, s) {
    const p = local(cx, cy), ax = (p.x - V.tx) / V.s, ay = (p.y - V.ty) / V.s;
    V.s = Math.min(8, Math.max(1, s)); V.tx = p.x - ax * V.s; V.ty = p.y - ay * V.s; apply();
  }
  stage.addEventListener("wheel", e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, V.s * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

  const P = new Map(); let gesture = null, tap = null;
  stage.addEventListener("pointerdown", e => {
    if (e.target.closest(".clr-fit")) return;
    try { stage.setPointerCapture(e.pointerId); } catch (err) {} P.set(e.pointerId, { x: e.clientX, y: e.clientY });
    closePop();
    if (P.size === 2) {   // second finger: it was a pinch, not paint
      strokeEnd(true); tap = null;
      const [a, b] = [...P.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, p = local(mid.x, mid.y);
      gesture = { d: Math.hypot(a.x - b.x, a.y - b.y), s: V.s, ax: (p.x - V.tx) / V.s, ay: (p.y - V.ty) / V.s };
      return;
    }
    if (P.size > 2 || gesture) return;
    if (e.button === 1 || e.button === 2) { gesture = { pan: true, x: e.clientX, y: e.clientY, tx: V.tx, ty: V.ty }; return; }
    const c = toCanvas(e.clientX, e.clientY);
    if (c.x < 0 || c.y < 0 || c.x >= W || c.y >= H) { if (V.s > 1) gesture = { pan: true, x: e.clientX, y: e.clientY, tx: V.tx, ty: V.ty }; return; }
    if (S.tool === "fill") tap = { x: e.clientX, y: e.clientY, c };
    else strokeStart(c.x, c.y);
  });
  stage.addEventListener("pointermove", e => {
    if (!P.has(e.pointerId)) return;
    P.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture && gesture.pan) { V.tx = gesture.tx + e.clientX - gesture.x; V.ty = gesture.ty + e.clientY - gesture.y; if (V.s > 1) apply(); return; }
    if (gesture && P.size >= 2) {
      const [a, b] = [...P.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, p = local(mid.x, mid.y);
      V.s = Math.min(8, Math.max(1, gesture.s * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d)); V.tx = p.x - gesture.ax * V.s; V.ty = p.y - gesture.ay * V.s; apply();
      return;
    }
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) { tap = null; if (V.s > 1) gesture = { pan: true, x: e.clientX, y: e.clientY, tx: V.tx, ty: V.ty }; }
    if (drawing) { const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null; for (const ev of (evs && evs.length ? evs : [e])) { const c = toCanvas(ev.clientX, ev.clientY); strokeMove(c.x, c.y); } }
  });
  const up = e => {
    if (!P.has(e.pointerId)) return; P.delete(e.pointerId);
    if (gesture) { if (!P.size) gesture = null; return; }
    if (tap) { const c = tap.c; tap = null; fillAt(Math.floor(c.x), Math.floor(c.y)); }
    if (drawing) strokeEnd(e.type === "pointercancel");
  };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  stage.addEventListener("contextmenu", e => e.preventDefault());

  // ---- toolbar ----
  const tools = root.querySelectorAll("[data-t]");
  const setTool = t => { S.tool = t; tools.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === t))); colors(); };
  tools.forEach(b => b.addEventListener("click", () => { setTool(b.dataset.t); if (b.dataset.t !== "fill" && !emb) toast(S.clip ? "Pinta con el dedo; no se sale de la línea" : "Pinta libre con el dedo"); }));
  $('[data-a="undo"]').addEventListener("click", () => { const u = undo.pop(); if (u) { px.putImageData(u, 0, 0); autosave(); } $('[data-a="undo"]').disabled = !undo.length; });
  // colors: the current one (tap = the big color box) and a strip with every color always in view — the hue from left to
  // right, lighter toward the top and darker toward the bottom — plus a gray column; dragging a finger over it paints live
  const specColor = (fx, fy) => fy < .5 ? hsv2hex(fx * 360, fy * 2, 1) : hsv2hex(fx * 360, 1, Math.max(0, 1 - (fy - .5) * 2));
  const grayColor = fy => { const v = Math.round(255 * (1 - fy)).toString(16).padStart(2, "0"); return "#" + v + v + v; };
  let chosen = null;
  function colors() {
    const box = $(".clr-colors");
    const sizes = S.tool === "fill" ? "" : `<div class="clr-sizes">${SIZES.map((s, i) => `<button type="button" data-s="${i}" aria-pressed="${S.size === i}" aria-label="Grosor ${["chico", "mediano", "grande"][i]}"><i style="width:${[6, 11, 18][i]}px;height:${[6, 11, 18][i]}px"></i></button>`).join("")}</div>`;
    box.innerHTML = sizes + (S.tool === "eraser" ? "" : `<button type="button" class="clr-sw cur" data-a="more" style="background:${S.color}" aria-label="Tu color (toca para ajustarlo)"></button>
      <div class="clr-spec" role="slider" aria-label="Todos los colores: arrastra el dedo"><div class="hue" data-k="spec"></div><div class="gray" data-k="gray"></div><i hidden></i></div>`);
    placeMark();
  }
  function placeMark() {
    const i = root.querySelector(".clr-spec i"); if (!i) return;
    if (!chosen || chosen.c !== S.color) { i.hidden = true; return; }
    const el = root.querySelector(chosen.k === "gray" ? ".clr-spec .gray" : ".clr-spec .hue");
    i.hidden = false; i.style.left = (el.offsetLeft + chosen.fx * el.offsetWidth) + "px"; i.style.top = (chosen.fy * el.offsetHeight) + "px"; i.style.background = S.color;
  }
  const specAt = e => {
    const spec = root.querySelector(".clr-spec"); if (!spec) return;
    const hue = spec.querySelector(".hue"), r = hue.getBoundingClientRect(), g = spec.querySelector(".gray").getBoundingClientRect();
    const fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    if (e.clientX >= g.left) { S.color = grayColor(fy); chosen = { k: "gray", fx: .5, fy, c: S.color }; }
    else { const fx = Math.min(.999, Math.max(0, (e.clientX - r.left) / r.width)); S.color = specColor(fx, fy); chosen = { k: "spec", fx, fy, c: S.color }; }
    const cur = root.querySelector(".clr-sw.cur"); if (cur) cur.style.background = S.color;
    placeMark();
  };
  $(".clr-colors").addEventListener("pointerdown", e => {
    const spec = e.target.closest(".clr-spec"); if (!spec) return;
    try { spec.setPointerCapture(e.pointerId); } catch (err) {} spec.dataset.on = "1"; closePop(); specAt(e);
  });
  $(".clr-colors").addEventListener("pointermove", e => { const spec = e.target.closest(".clr-spec"); if (spec && spec.dataset.on) specAt(e); });
  const specEnd = e => { const spec = e.target.closest && e.target.closest(".clr-spec"); if (spec) delete spec.dataset.on; };
  $(".clr-colors").addEventListener("pointerup", specEnd); $(".clr-colors").addEventListener("pointercancel", specEnd);
  $(".clr-colors").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.s) { S.size = +b.dataset.s; colors(); return; }
    if (b.dataset.a === "more") { if (pop) closePop(); else openMore(); return; }
  });
  const pickColor = c => { S.color = c; if (S.tool === "eraser") S.tool = "fill"; setTool(S.tool); };

  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  function openPop(html) { closePop(); pop = document.createElement("div"); pop.className = "clr-pop"; pop.innerHTML = html; bar.appendChild(pop); return pop; }
  // color box: drag on the square (lightness and intensity) and on the rainbow bar (the hue); it paints live
  function openMore() {
    let [hh, ss, vv] = hex2hsv(S.color);
    const p = openPop(`<h4>Ajusta tu color</h4>
      <div class="clr-box"><div class="clr-sv"><i></i></div><div class="clr-hue"><i></i></div></div>
      <div class="clr-okrow"><span class="clr-now"></span><button type="button" class="clr-ok">Listo</button></div>
      <h4 style="margin-top:12px">Colores rápidos</h4><div class="clr-grid">${MORE.map(c => `<button type="button" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join("")}</div>`);
    const sv = p.querySelector(".clr-sv"), hue = p.querySelector(".clr-hue"), now = p.querySelector(".clr-now");
    const show = () => {
      const c = hsv2hex(hh, ss, vv); S.color = c; if (S.tool === "eraser") setTool("fill");
      sv.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${hh},100%,50%))`;
      sv.firstElementChild.style.cssText = `left:${ss * 100}%;top:${(1 - vv) * 100}%;background:${c}`;
      hue.firstElementChild.style.cssText = `left:${hh / 360 * 100}%;background:hsl(${hh},100%,50%)`;
      now.style.background = c; now.textContent = c.toUpperCase(); now.style.color = vv > .6 && ss < .5 ? "#1a0d00" : "#fff";
      const cur = root.querySelector(".clr-sw.cur"); if (cur) cur.style.background = c; placeMark();
    };
    const drag = (el, fn) => {
      const at = e => { const r = el.getBoundingClientRect(); fn(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))); show(); };
      el.addEventListener("pointerdown", e => { try { el.setPointerCapture(e.pointerId); } catch (err) {} el.dataset.on = "1"; at(e); });
      el.addEventListener("pointermove", e => { if (el.dataset.on) at(e); });
      const end = () => { delete el.dataset.on; };
      el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    };
    drag(sv, (fx, fy) => { ss = fx; vv = 1 - fy; });
    drag(hue, fx => { hh = Math.round(fx * 360) % 360; if (ss < .15) ss = 1; if (vv < .15) vv = 1; });
    show();
    p.querySelector(".clr-ok").addEventListener("click", () => { pickColor(S.color); closePop(); });
    p.addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (b) { pickColor(b.dataset.c); closePop(); } });
  }
  $('[data-a="menu"]').addEventListener("click", e => {
    if (pop) { closePop(); return; }
    e.stopPropagation();
    const soc = (opts.buttons || []).map(b => `<a href="${b.href}" target="_blank" rel="noopener">${b.label}<span>↗</span></a>`).join("");
    const p = openPop(`<div class="clr-menu"><button type="button" data-m="clip">No salirse de la línea<span class="sw ${S.clip ? "on" : ""}"></span></button>
      <button type="button" data-m="fit">Ver todo el dibujo</button><button type="button" data-m="reset">Empezar de nuevo</button>${soc}</div>`);
    p.addEventListener("click", ev => {
      const b = ev.target.closest("[data-m]"); if (!b) return;
      if (b.dataset.m === "clip") { S.clip = !S.clip; b.querySelector(".sw").classList.toggle("on", S.clip); return; }
      if (b.dataset.m === "fit") { V.s = 1; apply(); }
      if (b.dataset.m === "reset") { pushUndo(); px.fillStyle = "#fff"; px.fillRect(0, 0, W, H); autosave(); toast("Dibujo en blanco. Toca ↶ si te arrepientes."); }
      closePop();
    });
  });
  document.addEventListener("pointerdown", e => { if (pop && !bar.contains(e.target)) closePop(); });

  // ---- save / share: the drawing with the logo on top (Vórtice VR, or the brand's own on Empresarial) ----
  const logo = opts.logo ? await loadImg(opts.logo).catch(() => null) : null;
  function exportBlob() {
    const pad = Math.round(W * 0.03), band = logo ? Math.round(W * 0.11) : pad, out = document.createElement("canvas");
    out.width = W + 2 * pad; out.height = H + band + pad; const x = out.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, out.width, out.height);
    if (logo) { let lw = out.width * 0.34, lh = lw * logo.naturalHeight / logo.naturalWidth; if (lh > band * 0.72) { lh = band * 0.72; lw = lh * logo.naturalWidth / logo.naturalHeight; } x.drawImage(logo, (out.width - lw) / 2, (band - lh) / 2, lw, lh); }
    x.drawImage(pc, pad, band); x.drawImage(lc, pad, band);
    return new Promise(r => out.toBlob(r, "image/jpeg", 0.92));
  }
  $('[data-a="save"]').addEventListener("click", async () => {
    closePop();
    const blob = await exportBlob(); if (!blob) return;
    const url = URL.createObjectURL(blob), name = `VorticeVR-${opts.slug || "dibujo"}.jpg`, file = new File([blob], name, { type: "image/jpeg" });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const sh = document.createElement("div"); sh.className = "clr-sheet";
    sh.innerHTML = `<h3>¡Te quedó increíble!</h3><img alt="Tu dibujo coloreado" src="${url}">
      <div class="acts">${canShare ? `<button class="p" data-x="share" type="button">Guardar o compartir</button>` : ""}
        <a class="${canShare ? "" : "p"}" href="${url}" download="${name}">Descargar imagen</a>
        <button data-x="invite" type="button">Invitar a colorear</button>
        <button data-x="close" type="button">Seguir pintando</button></div>
      ${canShare ? "<small>En iPhone toca “Guardar o compartir” y elige “Guardar imagen” para que quede en tu galería.</small>" : ""}
      ${(opts.buttons || []).length ? `<div class="clr-soc">${opts.buttons.map(b => `<a href="${b.href}" target="_blank" rel="noopener" aria-label="${b.label}">${b.svg || b.label}</a>`).join("")}</div>` : ""}`;
    root.appendChild(sh); confetti();
    sh.addEventListener("click", async e => {
      const b = e.target.closest("[data-x]"); if (!b) return;
      if (b.dataset.x === "share") { try { await navigator.share({ files: [file], title: opts.title || "Mi dibujo" }); } catch (err) {} }
      if (b.dataset.x === "invite") {
        const link = location.href.split("?")[0];
        if (navigator.share) { try { await navigator.share({ title: opts.title || "Colorea este dibujo", text: "¡Colorea este dibujo tú también!", url: link }); } catch (err) {} }
        else { try { await navigator.clipboard.writeText(link); b.textContent = "Link copiado ✓"; } catch (err) {} }
      }
      if (b.dataset.x === "close") { sh.remove(); URL.revokeObjectURL(url); }
    });
  });
  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cs = ["#ffbe55", "#8b3fd6", "#d2b8ff", "#74e8ba", "#ff8a9e", "#4fc3f7"];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement("i"); c.className = "clr-conf";
      c.style.cssText = `left:${Math.random() * 100}%;background:${cs[i % cs.length]};--x:${(Math.random() - .5) * 160}px;--r:${Math.random() * 900}deg;--d:${1.6 + Math.random() * 1.6}s;animation-delay:${Math.random() * .4}s`;
      root.appendChild(c); setTimeout(() => c.remove(), 3800);
    }
  }

  // ---- hints ----
  let toastT = 0;
  function toast(t, ms = 3200) { toastEl.textContent = t; toastEl.classList.remove("off"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.add("off"), ms); }
  if (emb) $(".clr-save").remove();
  setTool("fill");
  if (!emb) toast(restored ? "Seguimos donde te quedaste ✨" : "Elige un color y toca una zona del dibujo · pellizca para hacer zoom", 4200);

  return { destroy() { ro.disconnect(); root.remove(); }, size: { W, H } };
}

function loadImg(src) {
  return new Promise((ok, bad) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = bad; i.src = src; });
}
