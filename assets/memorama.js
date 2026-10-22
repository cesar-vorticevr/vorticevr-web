// Memorama (/x/ when the experience is kind "memorama"; made in /crear/memorama/, whose preview runs this same file).
// A memory game for the phone: find the pairs before the time runs out (30 s by default). During the 3-2-1 every card is
// shown for a moment, then they turn over. Pairs in a row make a combo; the last 5 s go red with a tick.
// cfg.memorama = { name, sub, time, color, mode: iguales (the same card twice) | parejas (two cards that go together),
//   pairs: [{ id, a: side, b?: side }] }, side = { t (text) | img (an item "foto") | key (a picture of assets/filtros/) }.
// Saved on the phone: the best score (vvr-memorama-<slug>). Counted: play, win, share (o.onClick).
import { sfx } from "./sonidos.js";

export const TIMES = [30, 45, 60, 90];
export const MODES = { iguales: "Dos cartas iguales", parejas: "Parejas que se relacionan" };
export const ART = ["particula-calaverita", "particula-cempasuchil", "particula-petalo", "corona-flores", "sombrero-copa", "lentes-catrina", "lentes-catrin", "bigote-catrin", "mono-catrin", "papel-picado",
  "gorro-santa", "diadema-reno", "nariz-reno", "lentes-navidad", "particula-copo", "particula-esfera", "luces-navidad", "esquina-pino",
  "gorro-fiesta", "lentes-fiesta", "particula-serpentina", "particula-estrella", "guirnalda-banderines", "esquina-globos",
  "orejas-gato", "nariz-gato", "lentes-gato", "particula-huella", "lentes-corazon", "diadema-corazones", "corazon-mejilla", "particula-corazon", "lentes-vortice"];
export const artUrl = key => new URL(`./filtros/${key}.webp`, import.meta.url).href;
const T = t => ({ t }), K = key => ({ key });
export const TEMPLATES = {
  muertos: { t: "Día de Muertos", mode: "iguales", color: "#e4007c", pairs: ["particula-calaverita", "particula-cempasuchil", "corona-flores", "sombrero-copa", "lentes-catrina", "papel-picado"].map(k => [K(k)]) },
  navidad: { t: "Navidad", mode: "iguales", color: "#c8102e", pairs: ["gorro-santa", "particula-copo", "particula-esfera", "nariz-reno", "lentes-navidad", "diadema-reno"].map(k => [K(k)]) },
  fiesta: { t: "Fiesta", mode: "iguales", color: "#8b3fd6", pairs: ["gorro-fiesta", "lentes-fiesta", "particula-serpentina", "particula-estrella", "guirnalda-banderines", "lentes-vortice"].map(k => [K(k)]) },
  ingles: { t: "Inglés: colores", mode: "parejas", color: "#1f8fd6", pairs: [["Rojo", "Red"], ["Azul", "Blue"], ["Verde", "Green"], ["Amarillo", "Yellow"], ["Negro", "Black"], ["Blanco", "White"]].map(([a, b]) => [T(a), T(b)]) },
  tablas: { t: "Tablas de multiplicar", mode: "parejas", color: "#2fb67c", pairs: [["3 × 4", "12"], ["6 × 7", "42"], ["8 × 5", "40"], ["9 × 3", "27"], ["7 × 7", "49"], ["6 × 8", "48"]].map(([a, b]) => [T(a), T(b)]) },
  capitales: { t: "Capitales", mode: "parejas", color: "#ff8a3d", pairs: [["México", "Ciudad de México"], ["Francia", "París"], ["Japón", "Tokio"], ["Argentina", "Buenos Aires"], ["España", "Madrid"], ["Brasil", "Brasilia"]].map(([a, b]) => [T(a), T(b)]) },
};

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hexOk = (v, d) => /^#[0-9a-f]{6}$/i.test(v || "") ? v.toLowerCase() : d;
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lum = hex => { const c = rgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const onAccent = hex => lum(hex) > .42 ? "#16151a" : "#ffffff";
const mix = (hex, to, k) => { const a = rgb(hex), b = rgb(to); return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join(""); };
// points: each pair 100 + 50 for each pair in a row after the first; finishing in time adds 10 per second left
export function starsFor(G, D) { if (G.won) return G.left >= (D.time || 30) * .4 ? 3 : 2; return G.found >= Math.ceil(G.total / 2) ? 1 : 0; }

const CSS = `
.mm{position:absolute;inset:0;overflow:hidden;font-family:"Sora",system-ui,sans-serif;color:#fff;background:radial-gradient(120% 70% at 50% 0%,var(--mm-c2),#0b0418 62%);user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.mm *{box-sizing:border-box}
.mm [hidden]{display:none!important}
.mm-scr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center}
/* intro and end */
.mm-card0{margin:auto;width:min(92%,420px);text-align:center;padding:18px 18px 22px;display:flex;flex-direction:column;align-items:center;gap:12px}
.mm-logo{height:24px;width:auto;margin-top:calc(16px + env(safe-area-inset-top,0px))}
.mm-logo.own{height:auto;max-height:42px;max-width:60%;filter:drop-shadow(0 0 1.5px rgba(255,255,255,.75)) drop-shadow(0 2px 8px rgba(0,0,0,.45))}
.mm-k{font-size:.72rem;letter-spacing:.24em;text-transform:uppercase;color:#ffd27f;font-weight:700}
.mm h1{font-size:clamp(1.6rem,7vw,2.3rem);line-height:1.05;margin:0;text-wrap:balance}
.mm p{margin:0;color:rgba(255,255,255,.78);line-height:1.45;font-family:"IBM Plex Sans",system-ui,sans-serif}
.mm-fan{position:relative;width:200px;height:120px;margin:6px 0}
.mm-fan i{position:absolute;left:50%;top:6px;width:72px;height:96px;margin-left:-36px;border-radius:14px;background:linear-gradient(150deg,var(--mm-c),var(--mm-c3));border:3px solid rgba(255,255,255,.9);box-shadow:0 12px 24px -10px rgba(0,0,0,.6);animation:mmFan 3s ease-in-out infinite}
.mm-fan i::after{content:"?";position:absolute;inset:0;display:grid;place-items:center;font:800 2rem Sora,sans-serif;color:var(--mm-on)}
.mm-fan i:nth-child(1){transform:rotate(-16deg) translateX(-46px)}.mm-fan i:nth-child(3){transform:rotate(16deg) translateX(46px)}
.mm-fan i:nth-child(2){z-index:1;animation-delay:.4s}
@keyframes mmFan{50%{translate:0 -6px}}
.mm-rules{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.mm-rules span{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 12px;font-size:.82rem;font-weight:600}
.mm-btn{font:700 1.05rem Sora,sans-serif;letter-spacing:.06em;border:0;border-radius:999px;padding:15px 34px;color:#2b1300;background:linear-gradient(135deg,#ffd27f,#ff9f3a);box-shadow:0 0 30px rgba(255,190,85,.55);cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.mm-btn.g{background:rgba(255,255,255,.12);color:#fff;box-shadow:none;border:1px solid rgba(255,255,255,.3);font-size:.92rem;padding:12px 22px}
.mm-best{font-size:.85rem;color:#ffd27f}
/* game */
.mm-top{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 8px}
.mm-pill{background:rgba(10,4,22,.55);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 14px;font-weight:700;font-size:.9rem;white-space:nowrap}
.mm-pill b{color:#ffd27f}
.mm-clock{position:relative;width:58px;height:58px;flex:none}
.mm-clock svg{width:100%;height:100%;transform:rotate(-90deg)}
.mm-clock circle{fill:none;stroke-width:6}
.mm-clock .bg{stroke:rgba(255,255,255,.15)}.mm-clock .fg{stroke:#ffd27f;stroke-linecap:round;transition:stroke .3s}
.mm-clock span{position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:1.25rem}
.mm.low .mm-clock .fg{stroke:#ff5c74}.mm.low .mm-clock span{color:#ff8a9e;animation:mmBeat 1s ease-in-out infinite}
.mm.low::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 60px rgba(255,60,90,.55);animation:mmEdge 1s ease-in-out infinite}
@keyframes mmBeat{50%{transform:scale(1.18)}}@keyframes mmEdge{50%{opacity:.35}}
.mm-board{flex:1 1 0;min-height:0;width:100%;display:grid;place-items:center;padding:6px 10px calc(14px + env(safe-area-inset-bottom,0px))}
.mm-grid{display:grid;gap:var(--mm-gap)}
.mm-c{position:relative;width:var(--mm-w);height:var(--mm-h);perspective:700px;cursor:pointer;border:0;padding:0;background:none}
.mm-in{position:absolute;inset:0;transition:transform .38s cubic-bezier(.3,1.25,.5,1);transform-style:preserve-3d}
.mm-c.up .mm-in{transform:rotateY(180deg)}
.mm-f,.mm-b{position:absolute;inset:0;border-radius:calc(var(--mm-w) * .14);backface-visibility:hidden;-webkit-backface-visibility:hidden;display:grid;place-items:center;overflow:hidden}
.mm-b{background:linear-gradient(150deg,var(--mm-c),var(--mm-c3));border:3px solid rgba(255,255,255,.85);box-shadow:0 8px 18px -10px rgba(0,0,0,.7)}
.mm-b::before{content:"";position:absolute;inset:7%;border-radius:inherit;border:2px dashed rgba(255,255,255,.35)}
.mm-b em{font:800 calc(var(--mm-w) * .42) Sora,sans-serif;font-style:normal;color:var(--mm-on);opacity:.92}
.mm-b img{width:58%;max-height:46%;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))}
.mm-f{transform:rotateY(180deg);background:#fffdf8;border:3px solid #fff;box-shadow:0 8px 18px -10px rgba(0,0,0,.7);color:#1d1430;padding:8%}
.mm-f img{max-width:100%;max-height:100%;object-fit:contain}
.mm-f span{font-weight:800;line-height:1.08;text-align:center;overflow-wrap:normal;word-break:normal}
.mm-c.ok .mm-f{border-color:#6ff0b2;box-shadow:0 0 0 3px rgba(111,240,178,.35),0 0 22px rgba(111,240,178,.65);animation:mmOk .5s ease}
.mm-c.bad .mm-in{animation:mmBad .4s ease}
@keyframes mmOk{40%{transform:scale(1.08)}}
@keyframes mmBad{25%{translate:-5px 0}50%{translate:5px 0}75%{translate:-3px 0}}
.mm-big{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font:800 clamp(3.4rem,20vw,6rem) Sora,sans-serif;text-shadow:0 6px 30px rgba(0,0,0,.6);pointer-events:none;animation:mmPop .7s ease forwards}
.mm-big.s{font-size:clamp(1.3rem,6vw,2rem);background:rgba(10,4,22,.75);padding:10px 20px;border-radius:999px;top:auto;bottom:calc(22px + env(safe-area-inset-bottom,0px));transform:translate(-50%,0);animation:mmToast 1.6s ease forwards;white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis}
@keyframes mmPop{0%{opacity:0;scale:.4}25%{opacity:1;scale:1.1}75%{opacity:1;scale:1}100%{opacity:0;scale:1}}
@keyframes mmToast{0%{opacity:0;translate:0 10px}15%,80%{opacity:1;translate:0 0}100%{opacity:0}}
.mm-combo{color:#ffd27f}
/* end */
.mm-score{font:800 clamp(3rem,16vw,4.6rem) Sora,sans-serif;line-height:1;color:#ffd27f;text-shadow:0 0 30px rgba(255,190,85,.5)}
.mm-stars{display:flex;gap:6px;justify-content:center}
.mm-stars svg{width:44px;height:44px}
.mm-stars svg.on{animation:mmStar .5s cubic-bezier(.3,1.6,.5,1) backwards}
@keyframes mmStar{from{transform:scale(0) rotate(-40deg)}}
.mm-sum{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.mm-sum span{background:rgba(255,255,255,.1);border-radius:12px;padding:8px 12px;font-size:.85rem}
.mm-sum b{display:block;font-size:1.1rem}
.mm-acts{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:4px}
.mm-new{font:800 .8rem Sora,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#2b1300;background:#ffd27f;border-radius:999px;padding:5px 12px;animation:mmBeat 1.2s ease-in-out infinite}
.mm-toast{position:absolute;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:rgba(10,4,22,.85);padding:10px 16px;border-radius:999px;font-size:.88rem;white-space:nowrap}
.mm-conf{position:absolute;inset:0;pointer-events:none}
@media (prefers-reduced-motion:reduce){.mm-in{transition:none}.mm-fan i,.mm.low .mm-clock span,.mm.low::after,.mm-new{animation:none}}
`;
const STAR = on => `<svg viewBox="0 0 24 24" class="${on ? "on" : ""}"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" fill="${on ? "#ffd27f" : "rgba(255,255,255,.18)"}" stroke="${on ? "#fff3c4" : "rgba(255,255,255,.3)"}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

/**
 * o: { root, cfg (an experience: slug, title, memorama), src(id) → url of an uploaded picture, brand: {src, own, href} | null,
 *      url (to share), onClick(id), embedded (the maker's preview: nothing is saved, counted or shared) }
 * returns { update(cfg, brand), destroy() }
 */
export function run(o) {
  if (!document.getElementById("mm-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "mm-css", textContent: CSS }));
  let cfg = o.cfg, brand = o.brand, state = "intro", timers = [], raf = 0;
  const KEY = "vvr-memorama-" + (cfg.slug || "x");
  const D = () => cfg.memorama || {};
  const el = document.createElement("div"); el.className = "mm"; o.root.appendChild(el);
  const later = (f, ms) => { const t = setTimeout(f, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); };
  const count = id => { if (!o.embedded && o.onClick) o.onClick(id); };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let best = 0; if (!o.embedded) try { best = Number(JSON.parse(localStorage.getItem(KEY) || "{}").best) || 0; } catch {}
  function paint() {
    const c = hexOk(D().color, "#8b3fd6");
    el.style.setProperty("--mm-c", c); el.style.setProperty("--mm-c3", mix(c, "#0b0418", .45)); el.style.setProperty("--mm-c2", mix(c, "#0b0418", .55)); el.style.setProperty("--mm-on", onAccent(c));
  }
  const sideUrl = s => s.key ? artUrl(s.key) : s.img ? (o.src ? o.src(s.img) : "") : "";
  const logoHtml = () => brand ? `<img class="mm-logo${brand.own ? " own" : ""}" src="${esc(brand.src)}" alt="">` : `<span style="height:24px;margin-top:calc(16px + env(safe-area-inset-top,0px))"></span>`;
  const name = () => D().name || cfg.title || "Memorama";

  // ---------- intro ----------
  function intro() {
    clearTimers(); state = "intro"; el.classList.remove("low"); paint();
    const d = D(), n = (d.pairs || []).length;
    el.innerHTML = `<div class="mm-scr">${logoHtml()}<div class="mm-card0">
      <span class="mm-k">Memorama</span><h1>${esc(name())}</h1>${d.sub ? `<p>${esc(d.sub)}</p>` : ""}
      <div class="mm-fan"><i></i><i></i><i></i></div>
      <div class="mm-rules"><span>${n} pares</span><span>${d.time || 30} segundos</span>${d.mode === "parejas" ? "<span>Une cada pareja</span>" : "<span>Encuentra las iguales</span>"}</div>
      <button class="mm-btn" type="button" data-go>¡Jugar!</button>${best ? `<span class="mm-best">Tu récord: ${best.toLocaleString("es-MX")} puntos</span>` : ""}</div></div>`;
    el.querySelector("[data-go]").onclick = () => { sfx.tap(); count("play"); play(); };
  }

  // ---------- the game ----------
  let G = null;
  function deal() {
    const d = D(), cards = [];
    for (const p of (d.pairs || []).slice(0, 10)) {
      const a = p.a || {}, b = d.mode === "parejas" && p.b ? p.b : a;
      cards.push({ pair: p.id, side: a, label: a.t || "" }, { pair: p.id, side: b, label: b.t || "" });
    }
    for (let i = cards.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    return cards;
  }
  function layout() {
    const grid = el.querySelector(".mm-grid"), board = el.querySelector(".mm-board"); if (!grid || !board) return;
    const n = G.cards.length, W = board.clientWidth - 20, H = board.clientHeight - 20, gap = Math.max(6, Math.min(12, W * .025)), ratio = 1.32;
    let bestC = 2, bestW = 0;
    for (let c = 2; c <= 6; c++) { const r = Math.ceil(n / c), w = Math.min((W - gap * (c - 1)) / c, (H - gap * (r - 1)) / r / ratio); if (w > bestW) { bestW = w; bestC = c; } }
    const w = Math.floor(Math.min(bestW, 150));
    grid.style.gridTemplateColumns = `repeat(${bestC}, ${w}px)`;
    el.style.setProperty("--mm-w", w + "px"); el.style.setProperty("--mm-h", Math.round(w * ratio) + "px"); el.style.setProperty("--mm-gap", gap + "px");
    // the text as big as it fits, without breaking a word in two ("Yellow", not "Yello w")
    const meas = document.createElement("canvas").getContext("2d"), inner = w * .84;
    grid.querySelectorAll(".mm-f span").forEach(s => {
      const txt = s.textContent, words = txt.split(/\s+/), len = txt.length;
      let px = Math.round(w * (len <= 3 ? .34 : len <= 8 ? .26 : len <= 16 ? .2 : .16));
      for (; px > 9; px--) { meas.font = `800 ${px}px Sora, system-ui, sans-serif`; if (Math.max(...words.map(x => meas.measureText(x).width)) <= inner) break; }
      s.style.fontSize = px + "px";
    });
  }
  function play() {
    clearTimers(); paint(); state = "peek";
    const d = D(), time = TIMES.includes(Number(d.time)) ? Number(d.time) : 30, cards = deal();
    G = { cards, total: cards.length / 2, found: 0, moves: 0, combo: 0, bestCombo: 0, score: 0, open: [], lock: true, left: time, time, won: false, lastSec: -1 };
    const back = brand && brand.own ? `<img src="${esc(brand.src)}" alt="">` : "<em>?</em>";
    el.innerHTML = `<div class="mm-scr"><div class="mm-top"><span class="mm-pill">Pares <b data-found>0</b>/${G.total}</span>
      <div class="mm-clock"><svg viewBox="0 0 60 60"><circle class="bg" cx="30" cy="30" r="26"/><circle class="fg" cx="30" cy="30" r="26" stroke-dasharray="163.4" stroke-dashoffset="0"/></svg><span data-t>${time}</span></div>
      <span class="mm-pill">Puntos <b data-score>0</b></span></div>
      <div class="mm-board"><div class="mm-grid">${cards.map((c, i) => `<button class="mm-c up" type="button" data-i="${i}" aria-label="Carta ${i + 1}"><span class="mm-in"><span class="mm-b">${back}</span><span class="mm-f">${c.side.t ? `<span>${esc(c.side.t)}</span>` : `<img src="${esc(sideUrl(c.side))}" alt="" draggable="false">`}</span></span></button>`).join("")}</div></div></div>`;
    layout(); later(layout, 60);
    el.querySelector(".mm-grid").addEventListener("click", e => { const b = e.target.closest(".mm-c"); if (b) flip(b); });
    const big = (t, cls = "") => { const s = Object.assign(document.createElement("div"), { className: "mm-big " + cls, innerHTML: t }); el.appendChild(s); later(() => s.remove(), cls ? 1700 : 760); };
    G.big = big;
    // every picture loaded first (so no card shows blank), then 3-2-1 with the cards face up; then they turn over and the clock starts
    const pics = [...el.querySelectorAll(".mm-f img")].map(im => im.complete ? Promise.resolve() : new Promise(ok => { im.onload = im.onerror = ok; }));
    const me = G;
    Promise.race([Promise.all(pics), new Promise(ok => setTimeout(ok, 4000))]).then(() => {
      if (G !== me || state !== "peek") return;
      [3, 2, 1].forEach((n, k) => later(() => { sfx.count(); big(String(n)); }, 200 + k * 700));
      later(() => { el.querySelectorAll(".mm-c").forEach(c => c.classList.remove("up")); sfx.swoosh(); }, 2200);
      later(() => { sfx.go(); big("¡Ya!"); state = "play"; G.lock = false; G.t0 = performance.now(); tick(); }, 2400);
    });
  }
  function tick() {
    if (state !== "play") return;
    const left = Math.max(0, G.time - (performance.now() - G.t0) / 1000); G.left = left;
    const s = Math.ceil(left), fg = el.querySelector(".mm-clock .fg"), tx = el.querySelector("[data-t]");
    if (fg) fg.style.strokeDashoffset = String(163.4 * (1 - left / G.time));
    if (s !== G.lastSec) { G.lastSec = s; if (tx) tx.textContent = s; if (s <= 5 && s > 0) { el.classList.add("low"); sfx.tick(1.4); if (navigator.vibrate && !o.embedded) try { navigator.vibrate(25); } catch {} } }
    if (left <= 0) { end(false); return; }
    raf = requestAnimationFrame(tick);
  }
  function flip(b) {
    if (state !== "play" || G.lock) return;
    const i = +b.dataset.i, c = G.cards[i]; if (c.done || G.open.includes(i)) return;
    b.classList.add("up"); sfx.pop(); G.open.push(i);
    if (G.open.length < 2) return;
    G.moves++; G.lock = true;
    const [x, y] = G.open, bx = el.querySelector(`[data-i="${x}"]`), by = el.querySelector(`[data-i="${y}"]`);
    if (G.cards[x].pair === G.cards[y].pair) {
      G.cards[x].done = G.cards[y].done = true; G.found++; G.combo++; G.bestCombo = Math.max(G.bestCombo, G.combo);
      const pts = 100 + (G.combo - 1) * 50; G.score += pts;
      later(() => { bx.classList.add("ok"); by.classList.add("ok"); sfx.correct(); sfx.sparkle(G.combo > 1 ? 6 : 3); burst(by); }, 220);
      el.querySelector("[data-found]").textContent = G.found; el.querySelector("[data-score]").textContent = G.score.toLocaleString("es-MX");
      // a pair that goes together says what it is ("Rojo = Red"); in a row says the combo
      const lab = D().mode === "parejas" && G.cards[x].label && G.cards[y].label ? `${esc(G.cards[x].label)} = ${esc(G.cards[y].label)}` : "";
      if (G.combo > 1) G.big(`<span class="mm-combo">¡${G.combo} seguidos! +${pts}</span>${lab ? " · " + lab : ""}`, "s"); else if (lab) G.big(lab, "s");
      G.open = []; G.lock = false;
      if (G.found === G.total) later(() => end(true), 650);
    } else {
      G.combo = 0;
      later(() => { bx.classList.add("bad"); by.classList.add("bad"); sfx.swoosh(); }, 380);
      later(() => { bx.classList.remove("up", "bad"); by.classList.remove("up", "bad"); G.open = []; G.lock = false; }, 820);
    }
  }
  function burst(btn) {   // little stars out of a pair just found
    if (reduced || !btn) return;
    const r = btn.getBoundingClientRect(), R = el.getBoundingClientRect();
    for (let k = 0; k < 10; k++) {
      const s = document.createElement("i"), a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 50;
      s.style.cssText = `position:absolute;left:${r.left - R.left + r.width / 2}px;top:${r.top - R.top + r.height / 2}px;width:9px;height:9px;border-radius:2px;background:${["#ffd27f", "#6ff0b2", "#fff", "#ff8fb1"][k % 4]};pointer-events:none;transition:transform .6s cubic-bezier(.2,.8,.3,1),opacity .6s;transform:translate(-50%,-50%) rotate(45deg)`;
      el.appendChild(s); requestAnimationFrame(() => { s.style.transform = `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d}px)) rotate(${200 + Math.random() * 300}deg) scale(.5)`; s.style.opacity = "0"; });
      later(() => s.remove(), 700);
    }
  }

  // ---------- the end ----------
  function end(won) {
    if (state === "over") return;
    state = "over"; cancelAnimationFrame(raf); el.classList.remove("low");
    G.won = won; const secs = Math.ceil(G.left), bonus = won ? secs * 10 : 0; G.score += bonus;
    const d = D(), st = starsFor(G, d), rec = !o.embedded && G.score > best && G.score > 0;
    if (rec) { best = G.score; try { localStorage.setItem(KEY, JSON.stringify({ best })); } catch {} }
    if (won) count("win");
    const usedT = Math.round(G.time - G.left);
    el.innerHTML = `<div class="mm-scr">${logoHtml()}<div class="mm-card0">
      <span class="mm-k">${esc(name())}</span><h1>${won ? (st === 3 ? "¡Increíble memoria!" : "¡Lo lograste!") : "¡Se acabó el tiempo!"}</h1>
      <div class="mm-stars">${[0, 1, 2].map(i => STAR(i < st)).join("")}</div>
      <div class="mm-score" data-sc>0</div><span style="margin-top:-6px;color:rgba(255,255,255,.7);font-size:.85rem">puntos</span>
      ${rec ? `<span class="mm-new">¡Nuevo récord!</span>` : best ? `<span class="mm-best">Tu récord: ${best.toLocaleString("es-MX")}</span>` : ""}
      <div class="mm-sum"><span><b>${G.found}/${G.total}</b>pares</span><span><b>${won ? usedT + " s" : "—"}</b>tiempo</span><span><b>${G.moves}</b>intentos</span>${won && bonus ? `<span><b>+${bonus}</b>por rapidez</span>` : ""}</div>
      <div class="mm-acts"><button class="mm-btn" type="button" data-again>Jugar otra vez</button><button class="mm-btn g" type="button" data-share>Retar a alguien</button></div></div></div>`;
    // the score counts up
    const sc = el.querySelector("[data-sc]"), t0 = performance.now(), dur = Math.min(1400, 300 + G.score / 2);
    const up = () => { const k = Math.min(1, (performance.now() - t0) / dur); sc.textContent = Math.round(G.score * (1 - (1 - k) ** 3)).toLocaleString("es-MX"); if (k < 1) raf = requestAnimationFrame(up); };
    up();
    later(() => { if (won) { sfx.win(); confetti(); } else if (st) sfx.sparkle(5); else sfx.lose(); }, 200);
    el.querySelector("[data-again]").onclick = () => { sfx.tap(); count("play"); play(); };
    el.querySelector("[data-share]").onclick = () => { sfx.tap(); count("share"); share(won, usedT); };
  }
  function confetti() {
    if (reduced) return;
    const c = Object.assign(document.createElement("canvas"), { className: "mm-conf" }); el.appendChild(c);
    const W = c.width = el.clientWidth * (devicePixelRatio || 1), H = c.height = el.clientHeight * (devicePixelRatio || 1), g = c.getContext("2d");
    const cols = ["#ffd27f", "#ff8fb1", "#6ff0b2", "#6fc8ff", "#c99bff", hexOk(D().color, "#8b3fd6")];
    const ps = Array.from({ length: 140 }, () => ({ x: W * Math.random(), y: -H * Math.random() * .6, vx: (Math.random() - .5) * W * .004, vy: H * (.004 + Math.random() * .006), r: Math.random() * 6, vr: (Math.random() - .5) * .3, s: (6 + Math.random() * 8) * (devicePixelRatio || 1), c: cols[Math.floor(Math.random() * cols.length)] }));
    const t0 = performance.now();
    const fr = () => { if (!c.isConnected) return; const k = (performance.now() - t0) / 3200; g.clearRect(0, 0, W, H);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - k * k); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
      if (k < 1) requestAnimationFrame(fr); else c.remove(); };
    fr();
  }
  function toast(t) { const s = Object.assign(document.createElement("div"), { className: "mm-toast", textContent: t }); el.appendChild(s); later(() => s.remove(), 1900); }
  async function share(won, secs) {
    if (o.embedded) { toast("Así retarán a sus amigos"); return; }
    const text = won ? `¡Encontré los ${G.total} pares en ${secs} segundos e hice ${G.score.toLocaleString("es-MX")} puntos en el memorama "${name()}"! ¿Me ganas?` : `Encontré ${G.found} de ${G.total} pares en el memorama "${name()}". ¿Tú puedes con todos?`;
    try { if (navigator.share) { await navigator.share({ title: name(), text, url: o.url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text + " " + o.url); toast("Copiado: pégalo donde quieras"); } catch { toast(o.url); }
  }

  const ro = new ResizeObserver(() => { if (G && state !== "intro" && state !== "over") layout(); }); ro.observe(el);
  intro();
  return {
    update(c, b) { cfg = c; brand = b === undefined ? brand : b; intro(); },
    destroy() { clearTimers(); ro.disconnect(); el.remove(); },
  };
}
