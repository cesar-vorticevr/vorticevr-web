// Ruleta de premios (data.kind = "ruleta"). La usan el visor (/x/) y la vista previa del creador (/crear/ruleta/).
//  - run({root, cfg, src, brand, url, onClick, embedded}) dibuja la página dentro de root: título, la ruleta de 10 espacios,
//    el botón "¡Girar!" (también se gira arrastrando la ruleta) y, al caer, el premio como cupón (código, fecha, vigencia,
//    condiciones y un reloj que se mueve para que se note que no es una captura) con "Guardar mi premio" y "Compartir".
//    Abajo, aparte y sin condicionar el premio (Google no permite premios a cambio de reseñas): "Déjanos tu reseña".
//  - El premio se guarda en el celular (localStorage vvr-ruleta-<slug>): al volver al link se ve otra vez; limit decide
//    cuántas veces se gira (una = una vez por celular, dia = una al día, libre = sin límite).
//  - onClick(id) cuenta en el servidor: "spin", el id del premio que salió, "lose", "review", "save", "share".
//  - slotsOf(ruleta) = los 10 espacios (null = "Suerte para la próxima"); wheelSvg(cfg) = la ruleta en SVG (miniatura).
// cfg = { slug, title, ruleta: {prizes: [{id, t}], fill, limit, days, cond, sub, review: {url, t}, color, color2, theme, logo} }.

import { sfx } from "./sonidos.js";

export const SLOTS = 10;
export const LOSE = "Suerte para la próxima";
export const THEMES = {
  vortice: { t: "Vórtice", dark: true },
  color: { t: "Mi color", dark: true },
  claro: { t: "Claro", dark: false },
};
export const LIMITS = { una: "Una vez por persona", dia: "Una vez al día", libre: "Sin límite" };

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lum = hex => { const c = rgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
export const onAccent = hex => lum(hex) > .42 ? "#16151a" : "#ffffff";
const mix = (hex, k, to = 0) => "#" + rgb(hex).map(v => Math.round(v + (to - v) * k).toString(16).padStart(2, "0")).join("");
const hexOk = (v, d) => /^#[0-9a-f]{6}$/i.test(v || "") ? v.toLowerCase() : d;

// the 10 spaces: with fewer than 10 prizes they repeat (no two equal ones side by side) or the rest is "Suerte para la próxima"
export function slotsOf(R) {
  const P = ((R && R.prizes) || []).filter(p => p && String(p.t || "").trim());
  const n = P.length, out = new Array(SLOTS).fill(null);
  if (!n) return out;
  if (R.fill === "suerte" && n < SLOTS) { P.forEach((p, j) => { out[Math.round(j * SLOTS / n) % SLOTS] = p; }); return out; }
  for (let i = 0; i < SLOTS; i++) out[i] = P[i % n];
  if (n > 1 && SLOTS % n === 1) [out[SLOTS - 2], out[SLOTS - 1]] = [out[SLOTS - 1], out[SLOTS - 2]];   // the last one would touch the first
  return out;
}
// how often each prize comes out: [{p, n}] (p = null → "Suerte para la próxima")
export function odds(R) {
  const m = new Map();
  for (const s of slotsOf(R)) { const k = s ? s.id : null; const e = m.get(k) || { p: s, n: 0 }; e.n++; m.set(k, e); }
  return [...m.values()];
}
// the text of a slice in up to 3 lines
function lines(t) {
  const w = String(t).trim().split(/\s+/), out = [];
  let cur = "";
  for (const x of w) { if (cur && (cur + " " + x).length > 12) { out.push(cur); cur = x; } else cur = cur ? cur + " " + x : x; }
  if (cur) out.push(cur);
  if (out.length > 3) { const rest = out.splice(2).join(" "); out.push(rest); }
  return out;
}
function colors(R) {
  const T = THEMES[R.theme] ? R.theme : "vortice";
  const c1 = hexOk(R.color, "#8b3fd6"), c2 = hexOk(R.color2, "#ffbe55");
  return { T, c1, c2, lose: T === "claro" ? "#f1edf7" : "#1c1030", loseInk: T === "claro" ? "#6b6380" : "#b9addb" };
}
const pt = (a, r) => { const t = a * Math.PI / 180; return [(r * Math.sin(t)).toFixed(2), (-r * Math.cos(t)).toFixed(2)]; };
// the wheel (without rotation): 10 slices, a golden rim with lights and the middle (logo or a star)
export function wheelSvg(cfg, { logo = "", id = "w" } = {}) {
  const R = (cfg && cfg.ruleta) || {}, S = slotsOf(R), C = colors(R), r = 236, A = 360 / SLOTS;
  let h = `<svg viewBox="-270 -270 540 540" xmlns="http://www.w3.org/2000/svg" class="rl-svg"><defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1c2"/><stop offset=".45" stop-color="#ffbe55"/><stop offset="1" stop-color="#b8741c"/></linearGradient>
    <radialGradient id="${id}s" r=".5"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient>
    <clipPath id="${id}c"><circle r="44"/></clipPath></defs>
    <circle r="266" fill="#000" opacity=".25"/><circle r="262" fill="url(#${id}g)"/><circle r="${r + 4}" fill="#3b1d05"/><g class="rl-rot">`;
  S.forEach((s, i) => {
    const a0 = i * A - A / 2, a1 = a0 + A, [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
    const fill = s ? (i % 2 ? C.c2 : C.c1) : C.lose, ink = s ? onAccent(fill) : C.loseInk;
    h += `<path d="M0 0L${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}Z" fill="${fill}" stroke="rgba(255,255,255,.55)" stroke-width="2"/>`;
    const L = lines(s ? s.t : LOSE), long = Math.max(...L.map(l => l.length)), fs = Math.max(13, Math.min(s ? 30 : 22, 178 / (long * .6)) - (L.length > 2 ? 2 : 0));
    const lh = fs * 1.08, y = -((L.length - 1) * lh) / 2;
    h += `<g transform="rotate(${i * A}) translate(0 -142) rotate(-90)"><text text-anchor="middle" font-family="Sora,system-ui,sans-serif" font-weight="${s ? 800 : 600}" font-size="${fs.toFixed(1)}" fill="${ink}">${L.map((l, k) => `<tspan x="0" y="${(y + k * lh + fs * .36).toFixed(1)}">${esc(l)}</tspan>`).join("")}</text></g>`;
  });
  h += `<circle r="${r}" fill="url(#${id}s)"/></g>`;
  for (let i = 0; i < 20; i++) { const [x, y] = pt(i * 18, 249); h += `<circle class="rl-bulb ${i % 2 ? "b" : "a"}" cx="${x}" cy="${y}" r="5.5"/>`; }
  h += `<g class="rl-hub"><circle r="54" fill="url(#${id}g)"/><circle r="46" fill="#fff"/>`;
  h += logo ? `<image href="${esc(logo)}" x="-38" y="-38" width="76" height="76" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id}c)"/>`
    : `<path d="M0-28L8-9 28-8 12 5 18 25 0 14-18 25-12 5-28-8-8-9Z" fill="${C.c1}"/>`;
  return h + "</g></svg>";
}

const CSS = `
.rl{position:absolute;inset:0;overflow:hidden;font-family:"IBM Plex Sans",system-ui,-apple-system,sans-serif;color:var(--rl-ink);-webkit-tap-highlight-color:transparent;background:var(--rl-bg)}
.rl *{box-sizing:border-box}
.rl-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.rl-in{position:relative;max-width:560px;margin:0 auto;padding:calc(30px + env(safe-area-inset-top,0px)) 16px calc(24px + env(safe-area-inset-bottom,0px));min-height:100%;display:flex;flex-direction:column;align-items:center;text-align:center}
.rl-k{font:700 .74rem "Sora",sans-serif;letter-spacing:.22em;text-transform:uppercase;color:var(--rl-acc)}
.rl h1{font:800 clamp(1.5rem,6.4vw,2.1rem)/1.1 "Sora",system-ui,sans-serif;margin:8px 0 0;text-wrap:balance;overflow-wrap:anywhere}
.rl-sub{margin:8px 0 0;color:var(--rl-mute);max-width:36ch;line-height:1.45;white-space:pre-line}
.rl-wheel{position:relative;width:min(100%,430px,calc(100vh - 330px));width:min(100%,430px,calc(100dvh - 330px));min-width:250px;aspect-ratio:1;margin:20px auto 0;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
.rl-wheel.spin{cursor:default}
.rl-wheel>svg{position:absolute;inset:0;width:100%;height:100%;display:block;filter:drop-shadow(0 18px 30px rgba(0,0,0,.4))}
.rl-rot{transform-origin:0 0;will-change:transform}
.rl-bulb{fill:#fff8dc}
.rl-bulb.a{animation:rl-blink 1.4s steps(1) infinite}.rl-bulb.b{animation:rl-blink 1.4s steps(1) .7s infinite}
.rl-wheel.spin .rl-bulb.a,.rl-wheel.spin .rl-bulb.b{animation-duration:.24s}.rl-wheel.spin .rl-bulb.b{animation-delay:.12s}
@keyframes rl-blink{0%{fill:#fff8dc;filter:drop-shadow(0 0 4px #fff3b0)}50%{fill:#9a6a1c;filter:none}}
.rl-ptr{position:absolute;left:50%;top:-3%;width:13%;margin-left:-6.5%;transform-origin:50% 22%;z-index:2;filter:drop-shadow(0 4px 6px rgba(0,0,0,.45));pointer-events:none}
.rl-ptr svg{display:block;width:100%;height:auto}
.rl-go{margin:22px 0 0;font:800 1.15rem "Sora",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;border:0;border-radius:999px;padding:17px 46px;cursor:pointer;color:#2a1600;
  background:linear-gradient(135deg,#ffe29a,#ffbe55 50%,#ff9f3a);box-shadow:0 10px 30px -8px rgba(255,170,60,.75),inset 0 -3px 0 rgba(0,0,0,.15);position:relative;overflow:hidden;animation:rl-pulse 2.2s ease-in-out infinite}
.rl-go::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.6) 50%,transparent 65%);background-size:250% 100%;animation:rl-shine 2.6s ease-in-out infinite}
.rl-go:disabled{animation:none;opacity:.55;cursor:default}.rl-go:disabled::after{display:none}
.rl-go:active:not(:disabled){transform:scale(.97)}
@keyframes rl-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
@keyframes rl-shine{0%,50%{background-position:120% 0}90%,100%{background-position:-120% 0}}
.rl-note{margin:12px 0 0;font-size:.86rem;color:var(--rl-mute)}
.rl-mine{margin:14px 0 0;font:600 .9rem "Sora",sans-serif;border:1px solid var(--rl-line);background:var(--rl-chip);color:var(--rl-ink);border-radius:999px;padding:9px 16px;cursor:pointer}
.rl-foot{margin-top:auto;padding-top:30px;display:flex;justify-content:center}
.rl-foot a,.rl-foot span{display:inline-flex;align-items:center;padding:9px 16px;border-radius:999px;background:var(--rl-chip)}
.rl-foot img{height:20px;width:auto;display:block}
.rl-foot.own a,.rl-foot.own span{background:#fff}.rl-foot.own img{height:26px;max-width:60vw}
/* the prize */
.rl-ov{position:absolute;inset:0;z-index:5;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(22px + env(safe-area-inset-top,0px)) 16px calc(22px + env(safe-area-inset-bottom,0px));
  background:var(--rl-veil);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:rl-fade .35s ease both}
@keyframes rl-fade{from{opacity:0}}
.rl-box{width:100%;max-width:420px;margin:auto 0;display:flex;flex-direction:column;align-items:center;text-align:center;animation:rl-pop .55s cubic-bezier(.2,1.4,.4,1) both}
@keyframes rl-pop{from{opacity:0;transform:scale(.8) translateY(20px)}}
.rl-won{font:800 clamp(2rem,10vw,2.8rem)/1 "Sora",sans-serif;color:#ffd27f;text-shadow:0 0 30px rgba(255,190,85,.6);margin:0 0 14px}
.rl-cup{position:relative;width:100%;background:#fff;color:#1b1626;border-radius:22px;padding:20px 20px 16px;box-shadow:0 30px 60px -20px rgba(0,0,0,.6);overflow:hidden}
.rl-cup .cut::before,.rl-cup .cut::after{content:"";position:absolute;top:-14px;width:26px;height:26px;border-radius:50%;background:var(--rl-hole)}
.rl-cup .cut::before{left:-13px}.rl-cup .cut::after{right:-13px}
.rl-cup .sh{position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 30%,rgba(255,215,130,.55) 48%,rgba(210,184,255,.5) 52%,transparent 70%);background-size:300% 100%;animation:rl-shine 3s linear infinite}
.rl-cup .biz{display:flex;align-items:center;justify-content:center;gap:10px;font:700 .82rem "Sora",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#6b6380}
.rl-cup .biz img{height:34px;width:34px;object-fit:contain;border-radius:50%}
.rl-cup .pz{font:800 clamp(1.6rem,8vw,2.2rem)/1.08 "Sora",sans-serif;margin:12px 0 4px;color:var(--rl-c1d);overflow-wrap:anywhere;text-wrap:balance}
.rl-cup .cut{position:relative;border-top:2px dashed #ddd6ea;margin:16px -20px 14px}
.rl-cup .code{font:700 1.5rem/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.14em;color:#1b1626}
.rl-cup .lbl{font:600 .7rem "Sora",sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#8a8399;margin-bottom:5px}
.rl-cup .meta{display:grid;gap:4px;margin-top:12px;font-size:.88rem;color:#4a4458}
.rl-cup .cond{margin-top:10px;font-size:.84rem;color:#6b6380;white-space:pre-line}
.rl-cup .live{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;font:600 .78rem "IBM Plex Sans",sans-serif;color:#6b6380}
.rl-cup .live i{width:9px;height:9px;border-radius:50%;background:#2fb67c;animation:rl-dot 1s ease-in-out infinite}
.rl-cup .live b{font:700 .9rem "IBM Plex Mono",monospace;color:#1b1626}
.rl-cup .star{position:absolute;right:14px;top:12px;width:26px;height:26px;animation:rl-spin 4s linear infinite;fill:#ffbe55}
@keyframes rl-dot{50%{opacity:.25;transform:scale(.7)}}
@keyframes rl-spin{to{transform:rotate(360deg)}}
.rl-cup.old{filter:grayscale(1);opacity:.75}.rl-cup.old .sh,.rl-cup.old .live{display:none}
.rl-cup .stamp{display:inline-block;margin-top:10px;padding:5px 12px;border:2px solid #c0392b;color:#c0392b;border-radius:8px;font:800 .85rem "Sora",sans-serif;letter-spacing:.1em;text-transform:uppercase;transform:rotate(-4deg)}
.rl-acts{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:16px;width:100%}
.rl-btn{flex:1 1 140px;font:700 .88rem "Sora",sans-serif;white-space:nowrap;border-radius:999px;padding:14px 12px;cursor:pointer;border:0;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.rl-btn.p{background:linear-gradient(135deg,#ffe29a,#ffbe55 50%,#ff9f3a);color:#2a1600}
.rl-btn.s{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.35)}
.rl-btn svg{width:18px;height:18px;fill:currentColor}
.rl-keep{margin:12px 0 0;font-size:.82rem;color:rgba(255,255,255,.75)}
.rl-rev{width:100%;margin-top:22px;padding:16px;border-radius:18px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);color:#fff}
.rl-rev p{margin:0 0 10px;font-weight:600}
.rl-rev .stars{color:#ffd27f;letter-spacing:.2em;font-size:1.1rem}
.rl-rev a{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px 18px;border-radius:999px;background:#fff;color:#1b1626;text-decoration:none;font:700 .92rem "Sora",sans-serif}
.rl-lose{font:800 clamp(1.7rem,8vw,2.4rem)/1.1 "Sora",sans-serif;color:#fff;margin:0;text-wrap:balance}
.rl-lose-e{font-size:3.6rem;line-height:1;margin-bottom:10px;animation:rl-wob 2.4s ease-in-out infinite}
@keyframes rl-wob{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
.rl-lose-p{color:rgba(255,255,255,.8);margin:10px 0 0}
.rl-close{position:absolute;right:12px;top:calc(10px + env(safe-area-inset-top,0px));width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:1.3rem;cursor:pointer;z-index:2}
.rl-list{width:100%;display:grid;gap:10px;margin-top:6px}
.rl-list button{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;padding:13px 16px;border-radius:14px;border:0;background:#fff;color:#1b1626;cursor:pointer;font:600 .95rem "Sora",sans-serif}
.rl-list small{font:500 .78rem "IBM Plex Sans",sans-serif;color:#6b6380;white-space:nowrap}
.rl-list .old{opacity:.6}
.rl-cf{position:absolute;inset:0;pointer-events:none;z-index:6;width:100%;height:100%}
.rl-toast{position:absolute;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);opacity:0;pointer-events:none;background:#16151a;color:#fff;padding:11px 18px;border-radius:999px;font-size:.9rem;font-weight:600;transition:.25s;z-index:9;white-space:nowrap;max-width:90%;overflow:hidden;text-overflow:ellipsis}
.rl-toast.on{opacity:1;transform:translate(-50%,0)}
@media (prefers-reduced-motion:reduce){.rl-go,.rl-go::after,.rl-bulb,.rl-cup .star,.rl-lose-e{animation:none!important}}
`;
const ICON = {
  save: '<path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/>',
  share: '<path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7a3 3 0 0 0 .1.8L8.4 11.2a3 3 0 1 0 0 1.6l6.7 3.4A3 3 0 1 0 18 16z"/>',
  star: '<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z"/>',
};
const POINTER = '<svg viewBox="0 0 60 80"><defs><linearGradient id="rlpg" x1="0" x2="1"><stop offset="0" stop-color="#fff1c2"/><stop offset=".5" stop-color="#ffbe55"/><stop offset="1" stop-color="#b8741c"/></linearGradient></defs><path d="M30 78 4 22a26 26 0 1 1 52 0z" fill="url(#rlpg)" stroke="#3b1d05" stroke-width="3"/><circle cx="30" cy="22" r="9" fill="#fff"/></svg>';

const mxDay = (t = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(t);
const fmtDate = t => new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
const fmtWhen = t => new Date(t).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => { const b = crypto.getRandomValues(new Uint8Array(6)); const s = Array.from(b, x => ALPHA[x % ALPHA.length]).join(""); return s.slice(0, 3) + "-" + s.slice(3); };
const randInt = n => { const b = crypto.getRandomValues(new Uint32Array(1))[0]; return b % n; };
// a prize is valid until the end of its last day (Mexico time); days = 0 → no date
function validUntil(at, days) {
  if (!days) return 0;
  const d = new Date(at + days * 864e5), s = mxDay(d.getTime());
  return Date.parse(s + "T23:59:59-06:00");
}

export function run(o) {
  const root = o.root;
  if (!document.getElementById("rl-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "rl-css", textContent: CSS }));
  if (!document.getElementById("rl-fonts")) document.head.appendChild(Object.assign(document.createElement("link"), { id: "rl-fonts", rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=Sora:wght@500;600;700;800&display=swap" }));
  const el = document.createElement("div"); el.className = "rl";
  el.innerHTML = '<div class="rl-scroll"><div class="rl-in"></div></div><div class="rl-toast" role="status" aria-live="polite"></div>';
  root.appendChild(el);
  const inner = el.querySelector(".rl-in"), toastEl = el.querySelector(".rl-toast");
  // the business (ruleta.name) is apart from the experience title; old wheels only have the title
  const named = c => ({ ...c, title: (c.ruleta && c.ruleta.name) || c.title });
  let cfg = named(o.cfg), rot = 0, busy = false, raf = 0, clockT = 0, tT = 0, saved = null, alive = true;
  const KEY = "vvr-ruleta-" + (cfg.slug || "x");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const R = () => cfg.ruleta || {};
  const toast = t => { toastEl.textContent = t; toastEl.classList.add("on"); clearTimeout(tT); tT = setTimeout(() => toastEl.classList.remove("on"), 2400); };
  const count = id => { if (!o.embedded && o.onClick) o.onClick(id); };
  const logo = () => (R().logo && o.src ? o.src(R().logo) : "");

  // ---- what this phone already won (never in the preview) ----
  function load() { if (o.embedded) return { won: [], last: null }; try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v && Array.isArray(v.won)) return v; } catch {} return { won: [], last: null }; }
  function store() { if (o.embedded) return; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} }
  saved = load();
  function canSpin() {
    if (o.embedded) return true;
    const L = R().limit || "una", last = saved.last;
    if (!last || L === "libre") return true;
    if (L === "dia") return last.day !== mxDay();
    return false;
  }

  function theme() {
    const C = colors(R()), dark = C.T !== "claro";
    const bg = C.T === "vortice" ? "radial-gradient(120% 70% at 50% 0%,#3a1670 0%,#14072b 55%,#05020b 100%)"
      : C.T === "color" ? `radial-gradient(120% 80% at 50% 0%,${mix(C.c1, .25, 255)} 0%,${C.c1} 40%,${mix(C.c1, .6)} 100%)`
      : "radial-gradient(120% 70% at 50% 0%,#ffffff 0%,#f4effa 60%,#ebe3f5 100%)";
    const inkOnBg = C.T === "color" ? onAccent(mix(C.c1, .2)) : dark ? "#f4eeff" : "#1b1626";
    el.style.cssText = [`--rl-bg:${bg}`, `--rl-ink:${inkOnBg}`, `--rl-mute:${inkOnBg === "#1b1626" || inkOnBg === "#16151a" ? "rgba(27,22,38,.68)" : "rgba(255,255,255,.78)"}`,
      `--rl-acc:${C.T === "claro" ? C.c1 : "#ffd27f"}`, `--rl-chip:${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.06)"}`, `--rl-line:${dark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.14)"}`,
      `--rl-veil:${C.T === "color" ? `linear-gradient(180deg,${mix(C.c1, .55)}f0,${mix(C.c1, .8)}f5)` : "linear-gradient(180deg,rgba(20,7,43,.94),rgba(5,2,11,.97))"}`,
      `--rl-hole:${C.T === "color" ? mix(C.c1, .7) : "#0d0520"}`, `--rl-c1d:${lum(C.c1) > .5 ? mix(C.c1, .55) : C.c1}`].join(";");
    if (o.themeColor) o.themeColor(C.T === "claro" ? "#ffffff" : C.T === "color" ? C.c1 : "#14072b");
  }
  function brandHtml() {
    const b = o.brand; if (!b) return "";
    const img = `<img src="${esc(b.src)}" alt="${b.own ? "" : "Vórtice VR"}">`;
    return `<footer class="rl-foot${b.own ? " own" : ""}">${b.href ? `<a href="${esc(b.href)}" target="_blank" rel="noopener">${img}</a>` : `<span>${img}</span>`}</footer>`;
  }
  function render() {
    theme();
    const Rr = R(), can = canSpin(), L = Rr.limit || "una";
    const valid = saved.won.filter(w => !w.until || w.until > Date.now());
    const note = !can ? (L === "dia" ? "Ya giraste hoy. Vuelve mañana para girar otra vez." : "Ya giraste esta ruleta.") : L === "una" ? "Tienes un giro." : L === "dia" ? "Tienes un giro al día." : "";
    inner.innerHTML = `<span class="rl-k">Gira y gana</span><h1>${esc(cfg.title || "Ruleta de premios")}</h1>${Rr.sub ? `<p class="rl-sub">${esc(Rr.sub)}</p>` : ""}
      <div class="rl-wheel${can ? "" : " spin"}"><div class="rl-ptr">${POINTER}</div>${wheelSvg(cfg, { logo: logo(), id: "rlw" })}</div>
      <button class="rl-go" type="button" data-go ${can ? "" : "disabled"}>¡Girar!</button>${note ? `<p class="rl-note">${note}</p>` : ""}
      ${valid.length ? `<button class="rl-mine" type="button" data-mine>🎁 ${valid.length === 1 ? "Ver mi premio" : `Mis premios (${valid.length})`}</button>` : ""}
      ${brandHtml()}`;
    setRot(rot);
  }
  const rotG = () => inner.querySelector(".rl-rot"), ptr = () => inner.querySelector(".rl-ptr");
  function setRot(a) { const g = rotG(); if (g) g.setAttribute("transform", `rotate(${a.toFixed(2)})`); }

  // ---- spinning: the slot is drawn first (all 10 equal), then the wheel turns 6+ times and stops on it ----
  function spin() {
    if (busy || !canSpin()) return;
    const S = slotsOf(R()); if (!S.some(Boolean) && !(R().prizes || []).length) { toast("Primero escribe tus premios"); return; }
    busy = true; count("spin"); sfx.whoosh(.6);
    const k = randInt(SLOTS), A = 360 / SLOTS, jitter = (Math.random() - .5) * A * .7;
    const base = rot - (rot % 360) + 360 * (reduced ? 2 : 6);
    const target = base + ((360 - k * A) % 360) + jitter;
    const from = rot, dur = reduced ? 1800 : 5600, t0 = performance.now();
    const wheel = inner.querySelector(".rl-wheel"), go = inner.querySelector("[data-go]");
    wheel.classList.add("spin"); go.disabled = true;
    let lastPeg = Math.floor((from + A / 2) / A), kick = 0;
    const ease = t => 1 - Math.pow(1 - t, 4);
    cancelAnimationFrame(raf);
    const step = now => {
      if (!alive) return;
      const t = Math.min(1, (now - t0) / dur);
      rot = from + (target - from) * ease(t); setRot(rot);
      const peg = Math.floor((rot + A / 2) / A);
      if (peg !== lastPeg) { lastPeg = peg; kick = 1; sfx.tick(); }
      kick *= .82; const p = ptr(); if (p) p.style.transform = `rotate(${(-22 * kick).toFixed(1)}deg)`;
      if (t < 1) raf = requestAnimationFrame(step);
      else { if (p) p.style.transform = ""; setTimeout(() => land(S[k]), 450); }
    };
    raf = requestAnimationFrame(step);
  }
  function land(p) {
    busy = false;
    const at = Date.now(), Rr = R();
    const res = p ? { id: p.id, p: p.t, code: code(), at, until: validUntil(at, Rr.days || 0), day: mxDay(at) } : { id: null, p: null, at, day: mxDay(at) };
    if (!o.embedded) { saved.last = res; if (p) { saved.won.unshift(res); saved.won = saved.won.slice(0, 20); } store(); }
    count(p ? p.id : "lose");
    if (p) sfx.win(); else sfx.lose();
    if (p && navigator.vibrate) try { navigator.vibrate([40, 60, 40]); } catch {}
    render();
    show(res, true);
  }

  // ---- the prize (or "Suerte para la próxima") ----
  let ov = null, shot = null;
  function closeOv() { if (ov) { ov.remove(); ov = null; } clearInterval(clockT); }
  function reviewHtml() {
    const rv = R().review; if (!rv || !rv.url) return "";
    return `<div class="rl-rev"><div class="stars" aria-hidden="true">★★★★★</div><p>¿Te gustó tu visita? Cuéntanos qué te pareció.</p><a href="${esc(rv.url)}" target="_blank" rel="noopener" data-rev>${esc(rv.t || "Déjanos tu reseña")}</a></div>`;
  }
  function coupon(w) {
    const Rr = R(), old = w.until && w.until < Date.now(), lg = logo();
    return `<div class="rl-cup${old ? " old" : ""}"><span class="sh"></span><svg class="star" viewBox="0 0 24 24" aria-hidden="true">${ICON.star}</svg>
      <div class="biz">${lg ? `<img src="${esc(lg)}" alt="">` : ""}<span>${esc(cfg.title || "")}</span></div>
      <div class="pz">${esc(w.p)}</div>
      <div class="cut"></div>
      <div class="lbl">Tu código</div><div class="code">${esc(w.code)}</div>
      <div class="meta"><span>Lo ganaste el ${esc(fmtWhen(w.at))}</span>${w.until ? `<span><b>${old ? "Venció" : "Válido hasta"} el ${esc(fmtDate(w.until))}</b></span>` : ""}</div>
      ${Rr.cond ? `<div class="cond">${esc(Rr.cond)}</div>` : ""}
      ${old ? '<span class="stamp">Vencido</span>' : '<div class="live"><i></i><span>Cupón en vivo</span><b data-clock></b></div>'}</div>`;
  }
  function show(w, fresh) {
    closeOv();
    ov = document.createElement("div"); ov.className = "rl-ov";
    const Rr = R(), L = Rr.limit || "una", again = o.embedded || L === "libre";
    if (w.p) {
      ov.innerHTML = `<button class="rl-close" type="button" data-x aria-label="Cerrar">✕</button><div class="rl-box">${fresh ? '<div class="rl-won">¡Ganaste!</div>' : '<div class="rl-won" style="font-size:1.6rem">Tu premio</div>'}${coupon(w)}
        <div class="rl-acts"><button class="rl-btn p" type="button" data-save><svg viewBox="0 0 24 24">${ICON.save}</svg>Guardar mi premio</button><button class="rl-btn s" type="button" data-share><svg viewBox="0 0 24 24">${ICON.share}</svg>Compartir</button></div>
        <p class="rl-keep">Muéstralo en el negocio para canjearlo. Queda guardado aquí: vuelve a abrir este link para verlo.</p>
        ${reviewHtml()}${again ? '<div class="rl-acts"><button class="rl-btn s" type="button" data-again>Girar otra vez</button></div>' : ""}</div>`;
    } else {
      ov.innerHTML = `<button class="rl-close" type="button" data-x aria-label="Cerrar">✕</button><div class="rl-box"><div class="rl-lose-e" aria-hidden="true">🍀</div><p class="rl-lose">¡Suerte para la próxima!</p>
        <p class="rl-lose-p">${again ? "Esta vez no tocó premio." : L === "dia" ? "Esta vez no tocó premio. Vuelve mañana y gira otra vez." : "Esta vez no tocó premio. ¡Gracias por jugar!"}</p>
        ${again ? '<div class="rl-acts"><button class="rl-btn p" type="button" data-again>Girar otra vez</button></div>' : ""}${reviewHtml()}</div>`;
    }
    el.appendChild(ov);
    const tick = () => { const c = ov && ov.querySelector("[data-clock]"); if (c) c.textContent = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); };
    tick(); clockT = setInterval(tick, 1000);
    shot = null; if (w.p) prepareShot(w);
    if (fresh && w.p && !reduced) confetti();
    ov.addEventListener("click", async e => {
      if (e.target.closest("[data-x]")) { sfx.swoosh(); closeOv(); return; }
      if (e.target.closest("[data-again]")) { closeOv(); spin(); return; }
      if (e.target.closest("[data-rev]")) { count("review"); if (o.embedded) { e.preventDefault(); toast("Aquí se abrirá tu link de reseñas"); } return; }
      if (e.target.closest("[data-save]")) { count("save"); sfx.coin(); saveShot(w); return; }
      if (e.target.closest("[data-share]")) { count("share"); sfx.tap(); share(w); return; }
    });
  }
  function showMine() {
    const list = saved.won;
    if (list.length === 1) { show(list[0], false); return; }
    closeOv();
    ov = document.createElement("div"); ov.className = "rl-ov";
    ov.innerHTML = `<button class="rl-close" type="button" data-x aria-label="Cerrar">✕</button><div class="rl-box"><div class="rl-won" style="font-size:1.6rem">Mis premios</div><div class="rl-list">${list.map((w, i) => {
      const old = w.until && w.until < Date.now();
      return `<button type="button" data-i="${i}" class="${old ? "old" : ""}"><span>${esc(w.p)}</span><small>${old ? "Vencido" : w.until ? "Hasta el " + esc(fmtDate(w.until)) : esc(fmtWhen(w.at))}</small></button>`; }).join("")}</div></div>`;
    el.appendChild(ov);
    ov.addEventListener("click", e => { if (e.target.closest("[data-x]")) { closeOv(); return; } const b = e.target.closest("[data-i]"); if (b) show(list[+b.dataset.i], false); });
  }

  // ---- "Guardar mi premio": a picture of the coupon, made ahead so sharing stays inside the tap (iPhone) ----
  const loadImg = s => new Promise(ok => { if (!s) return ok(null); const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = s; });
  function wrap(x, t, max) { const w = String(t).split(/\s+/), out = []; let cur = ""; for (const s of w) { const n = cur ? cur + " " + s : s; if (cur && x.measureText(n).width > max) { out.push(cur); cur = s; } else cur = n; } if (cur) out.push(cur); return out; }
  async function prepareShot(w) {
    try {
      const C = colors(R()), W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
      const x = c.getContext("2d");
      const g = x.createLinearGradient(0, 0, W, H);
      if (C.T === "color") { g.addColorStop(0, mix(C.c1, .2, 255)); g.addColorStop(1, mix(C.c1, .55)); } else { g.addColorStop(0, "#3a1670"); g.addColorStop(1, "#05020b"); }
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      try { await document.fonts.load("800 80px Sora"); await document.fonts.load("700 60px 'IBM Plex Mono'"); } catch {}
      x.textAlign = "center"; x.fillStyle = "#ffd27f"; x.font = "800 96px Sora, sans-serif"; x.fillText("¡Gané!", W / 2, 190);
      const cx = 110, cy = 260, cw = W - 220, ch = 820;
      x.fillStyle = "#fff"; x.beginPath(); x.roundRect ? x.roundRect(cx, cy, cw, ch, 44) : x.rect(cx, cy, cw, ch); x.fill();
      const lg = await loadImg(logo()); let y = cy + 100;
      if (lg) { const s = 120, k = Math.min(s / lg.naturalWidth, s / lg.naturalHeight); x.drawImage(lg, W / 2 - lg.naturalWidth * k / 2, cy + 50, lg.naturalWidth * k, lg.naturalHeight * k); y = cy + 220; }
      x.fillStyle = "#6b6380"; x.font = "700 34px Sora, sans-serif"; x.fillText(String(cfg.title || "").toUpperCase().slice(0, 40), W / 2, y);
      x.fillStyle = lum(C.c1) > .5 ? mix(C.c1, .55) : C.c1; x.font = "800 84px Sora, sans-serif";
      let L = wrap(x, w.p, cw - 100); if (L.length > 3) { x.font = "800 64px Sora, sans-serif"; L = wrap(x, w.p, cw - 100).slice(0, 4); }
      const lh = parseInt(x.font.match(/(\d+)px/)[1]) * 1.12; L.forEach((l, i) => x.fillText(l, W / 2, y + 110 + i * lh)); y += 110 + (L.length - 1) * lh + 70;
      x.strokeStyle = "#ddd6ea"; x.lineWidth = 4; x.setLineDash([16, 14]); x.beginPath(); x.moveTo(cx + 30, y); x.lineTo(cx + cw - 30, y); x.stroke(); x.setLineDash([]);
      x.fillStyle = "#8a8399"; x.font = "600 28px Sora, sans-serif"; x.fillText("TU CÓDIGO", W / 2, y + 70);
      x.fillStyle = "#1b1626"; x.font = "700 72px 'IBM Plex Mono', monospace"; x.fillText(w.code, W / 2, y + 150);
      x.fillStyle = "#4a4458"; x.font = "500 32px 'IBM Plex Sans', sans-serif"; x.fillText("Lo ganaste el " + fmtWhen(w.at), W / 2, y + 215);
      if (w.until) { x.font = "700 32px 'IBM Plex Sans', sans-serif"; x.fillText("Válido hasta el " + fmtDate(w.until), W / 2, y + 262); }
      if (R().cond) { x.fillStyle = "#6b6380"; x.font = "500 28px 'IBM Plex Sans', sans-serif"; wrap(x, R().cond, cw - 120).slice(0, 3).forEach((l, i) => x.fillText(l, W / 2, Math.min(cy + ch - 120, y + 320) + i * 36)); }
      x.fillStyle = "rgba(255,255,255,.85)"; x.font = "500 34px 'IBM Plex Sans', sans-serif"; x.fillText("Muéstralo en el negocio para canjearlo", W / 2, cy + ch + 90);
      const b = o.brand, bi = b && await loadImg(b.src);
      if (bi) { const bh = b.own ? 70 : 52, bw = bi.naturalWidth * bh / bi.naturalHeight, bx = W / 2 - bw / 2, by = H - 120;
        if (b.own) { x.fillStyle = "#fff"; x.beginPath(); x.roundRect ? x.roundRect(bx - 26, by - 14, bw + 52, bh + 28, 50) : x.rect(bx - 26, by - 14, bw + 52, bh + 28); x.fill(); }
        x.drawImage(bi, bx, by, bw, bh); }
      shot = await new Promise(r => c.toBlob(r, "image/png"));
    } catch (e) { console.error(e); shot = null; }
  }
  async function saveShot(w) {
    if (o.embedded) { toast("Aquí se guarda la imagen de su premio"); return; }
    if (!shot) { await prepareShot(w); if (!shot) { toast("No se pudo crear la imagen; toma una captura"); return; } }
    const name = `premio-${(cfg.slug || "ruleta")}-${w.code}.png`, file = new File([shot], name, { type: "image/png" });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Mi premio" }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(shot); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Imagen guardada");
  }
  async function share(w) {
    const url = o.url || location.href, text = `¡Gané ${w.p} en ${cfg.title || "la ruleta"}! Gira tú también:`;
    if (o.embedded) { toast("Así compartirán su premio"); return; }
    try { if (navigator.share) { await navigator.share({ title: cfg.title || "", text, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text + " " + url); toast("Link copiado"); } catch { toast(url); }
  }

  // ---- confetti ----
  function confetti() {
    const c = document.createElement("canvas"); c.className = "rl-cf"; el.appendChild(c);
    const dpr = Math.min(2, devicePixelRatio || 1), W = el.clientWidth, H = el.clientHeight; c.width = W * dpr; c.height = H * dpr;
    const x = c.getContext("2d"); x.scale(dpr, dpr);
    const C = colors(R()), cols = [C.c1, C.c2, "#ffd27f", "#ffffff", "#ff5c8a", "#74e8ba"];
    const P = Array.from({ length: 160 }, (_, i) => ({ x: W / 2 + (Math.random() - .5) * 60, y: H * .42, vx: (Math.random() - .5) * 14, vy: -Math.random() * 15 - 5, r: Math.random() * 6 + 4,
      a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cols[i % cols.length], s: i % 3 }));
    const t0 = performance.now();
    const step = now => {
      if (!alive) return;
      x.clearRect(0, 0, W, H);
      for (const p of P) { p.vy += .35; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c;
        if (p.s === 0) x.fillRect(-p.r, -p.r / 2.5, p.r * 2, p.r / 1.25); else if (p.s === 1) { x.beginPath(); x.arc(0, 0, p.r / 1.6, 0, 7); x.fill(); }
        else { x.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? p.r / 2.2 : p.r; x.lineTo(Math.cos(k * Math.PI / 5) * rr, Math.sin(k * Math.PI / 5) * rr); } x.fill(); } x.restore(); }
      if (now - t0 < 4200) requestAnimationFrame(step); else c.remove();
    };
    requestAnimationFrame(step);
  }

  // ---- drag the wheel with the finger; a quick flick spins it ----
  let drag = null;
  const angleAt = (e, w) => { const b = w.getBoundingClientRect(); return Math.atan2(e.clientX - (b.left + b.width / 2), -(e.clientY - (b.top + b.height / 2))) * 180 / Math.PI; };
  inner.addEventListener("pointerdown", e => {
    const w = e.target.closest(".rl-wheel"); if (!w || busy || !canSpin()) return;
    drag = { w, a: angleAt(e, w), r: rot, v: 0, t: performance.now(), last: angleAt(e, w), moved: 0 }; w.setPointerCapture(e.pointerId);
  });
  inner.addEventListener("pointermove", e => {
    if (!drag) return; const a = angleAt(e, drag.w); let d = a - drag.last; if (d > 180) d -= 360; if (d < -180) d += 360;
    const now = performance.now(), dt = Math.max(1, now - drag.t); drag.v = drag.v * .5 + (d / dt) * .5; drag.t = now; drag.last = a; drag.moved += Math.abs(d);
    rot += d; setRot(rot);
    const pg = Math.floor((rot + 18) / 36); if (pg !== drag.peg) { if (drag.peg !== undefined) sfx.tick(.6); drag.peg = pg; }
  });
  const up = () => { if (!drag) return; const v = drag.v, moved = drag.moved; drag = null; if (Math.abs(v) > .25 && moved > 12) spin(); };
  inner.addEventListener("pointerup", up); inner.addEventListener("pointercancel", up);
  inner.addEventListener("click", e => {
    if (e.target.closest("[data-go]")) spin();
    else if (e.target.closest("[data-mine]")) { sfx.tap(); showMine(); }
  });

  render();
  // coming back to the link: the last result is still there (only right after it, not every visit, for "libre")
  if (!o.embedded && saved.last && !canSpin()) setTimeout(() => { if (saved.last.p) show(saved.won.find(w => w.code === saved.last.code) || saved.last, false); }, 350);
  return {
    update(c, brand) { cfg = named(c); if (brand !== undefined) o.brand = brand; if (!busy) render(); },
    spin,
    destroy() { alive = false; cancelAnimationFrame(raf); clearInterval(clockT); el.remove(); },
  };
}
