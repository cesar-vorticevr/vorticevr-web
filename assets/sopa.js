// Sopa de letras (/x/ when the experience is kind "sopa"; made in /crear/sopa/, whose preview runs this same file).
// A word search for the phone: the grid is made again on the phone each game (so playing again is a new puzzle); a word
// is marked by dragging over it (or tapping its first and last letter). mode = lista (the words are shown) | pistas (only
// a clue is shown and the word comes out when found: "El planeta rojo" → MARTE). level = facil (→ ↓), normal (+ diagonals),
// dificil (+ backwards). time = seconds (0 = no limit). The last 5 s go red with a tick; up to 3 hints per game.
// cfg.sopa = { name, sub, mode, level, time, color, words: [{ w, h? }] } (w as typed: "Papel picado"; the grid uses norm(w)).
// Saved on the phone: the best score (vvr-sopa-<slug>). Counted: play, win, share (o.onClick).
import { sfx } from "./sonidos.js";

export const TIMES = [0, 60, 90, 120, 180];
export const LEVELS = { facil: "Fácil", normal: "Normal", dificil: "Difícil" };
export const LEVEL_HINT = { facil: "Palabras de izquierda a derecha y de arriba abajo.", normal: "También en diagonal.", dificil: "En todas direcciones, también al revés." };
export const MODES = { lista: "Ver las palabras", pistas: "Adivinar con pistas" };
export const LIMITS = { min: 3, max: 12, letters: 12, total: 90 };
// letters only, upper case, without accents (the Ñ stays): "Cempasúchil" → CEMPASUCHIL, "Papel picado" → PAPELPICADO
export const norm = s => String(s || "").toUpperCase().replace(/Ñ/g, "\u0001").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\u0001/g, "Ñ").replace(/[^A-ZÑ]/g, "");
const W = w => ({ w }), H = (h, w) => ({ w, h });
export const TEMPLATES = {
  animales: { t: "Animales", mode: "lista", level: "facil", color: "#2fb67c", words: ["Perro", "Gato", "Vaca", "Conejo", "Tortuga", "Jirafa", "León", "Pato"].map(W) },
  muertos: { t: "Día de Muertos", mode: "lista", level: "normal", color: "#e4007c", words: ["Altar", "Ofrenda", "Calavera", "Catrina", "Veladora", "Copal", "Cempasúchil", "Papel picado"].map(W) },
  navidad: { t: "Navidad", mode: "lista", level: "normal", color: "#c8102e", words: ["Pino", "Estrella", "Regalo", "Piñata", "Posada", "Nieve", "Reno", "Esfera"].map(W) },
  planetas: { t: "Planetas", mode: "lista", level: "normal", color: "#2c3e8f", words: ["Mercurio", "Venus", "Tierra", "Marte", "Júpiter", "Saturno", "Urano", "Neptuno"].map(W) },
  ingles: { t: "Inglés: animales", mode: "pistas", level: "normal", color: "#1f8fd6", words: [["Perro", "Dog"], ["Gato", "Cat"], ["Pájaro", "Bird"], ["Pez", "Fish"], ["Caballo", "Horse"], ["Vaca", "Cow"], ["Conejo", "Rabbit"], ["Pato", "Duck"]].map(([h, w]) => H(h, w)) },
  ciencias: { t: "Ciencias: adivina", mode: "pistas", level: "normal", color: "#ff8a3d", words: [["La estrella de nuestro sistema", "Sol"], ["El satélite de la Tierra", "Luna"], ["El planeta rojo", "Marte"], ["El gas que respiramos para vivir", "Oxígeno"], ["El órgano que bombea la sangre", "Corazón"], ["El agua congelada", "Hielo"], ["Así hacen su alimento las plantas con la luz", "Fotosíntesis"]].map(([h, w]) => H(h, w)) },
};

// ---------- the grid ----------
const DIRS = {
  facil: [[1, 0], [0, 1]],
  normal: [[1, 0], [0, 1], [1, 1], [1, -1]],
  dificil: [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]],
};
const ALL8 = DIRS.dificil;
const FILL = "AAAAAAEEEEEEIIIIOOOOOUUUSSSSRRRRNNNNLLLDDDCCCTTTMMMPPBBGGVYQHFZJÑX";
// count the times a word can be read in the grid (any direction)
function occurrences(g, n, w) {
  let k = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (g[y * n + x] !== w[0]) continue;
    for (const [dx, dy] of ALL8) {
      let i = 1; for (; i < w.length; i++) { const X = x + dx * i, Y = y + dy * i; if (X < 0 || Y < 0 || X >= n || Y >= n || g[Y * n + X] !== w[i]) break; }
      if (i === w.length) k++;
    }
  }
  return w.length === 1 ? k / 8 : k;
}
// words → { n, cells (n × n letters), places: [{ w, x, y, dx, dy }] }; null if they do not fit
export function makeGrid(words, level = "normal", rnd = Math.random) {
  const list = [...new Set(words.map(norm).filter(w => w.length >= 2))].sort((a, b) => b.length - a.length);
  if (!list.length) return null;
  const dirs = DIRS[level] || DIRS.normal, total = list.reduce((s, w) => s + w.length, 0);
  for (let n = Math.max(list[0].length, Math.ceil(Math.sqrt(total * (level === "facil" ? 2.3 : 1.9))), 6); n <= 16; n++) {
    for (let attempt = 0; attempt < 25; attempt++) {
      const g = Array(n * n).fill(""), places = []; let ok = true;
      for (const w of list) {
        let best = null, bestScore = -1;
        for (let t = 0; t < 160; t++) {
          const [dx, dy] = dirs[rnd() * dirs.length | 0], x = rnd() * n | 0, y = rnd() * n | 0;
          const xe = x + dx * (w.length - 1), ye = y + dy * (w.length - 1);
          if (xe < 0 || ye < 0 || xe >= n || ye >= n) continue;
          let ov = 0, fits = true;
          for (let i = 0; i < w.length; i++) { const c = g[(y + dy * i) * n + x + dx * i]; if (c) { if (c !== w[i]) { fits = false; break; } ov++; } }
          if (!fits || ov === w.length) continue;
          const score = ov + rnd() * 1.5;   // crossing other words a little, not always
          if (score > bestScore) { best = { w, x, y, dx, dy }; bestScore = score; }
        }
        if (!best) { ok = false; break; }
        for (let i = 0; i < w.length; i++) g[(best.y + best.dy * i) * n + best.x + best.dx * i] = w[i];
        places.push(best);
      }
      if (!ok) continue;
      // the rest with random letters, without making a second copy of any word
      const fill = list.some(w => w.includes("Ñ")) ? FILL : FILL.replace("Ñ", "");   // an Ñ only when a word has one
      for (let f = 0; f < 12; f++) {
        const cells = g.map(c => c || fill[rnd() * fill.length | 0]);
        if (list.every(w => occurrences(cells, n, w) <= (w === [...w].reverse().join("") ? 2 : 1))) return { n, cells, places, words: list };
      }
    }
  }
  return null;
}

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hexOk = (v, d) => /^#[0-9a-f]{6}$/i.test(v || "") ? v.toLowerCase() : d;
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lum = hex => { const c = rgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const onAccent = hex => lum(hex) > .42 ? "#16151a" : "#ffffff";
const mix = (hex, to, k) => { const a = rgb(hex), b = rgb(to); return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join(""); };
// points: each word 100 + 10 per letter; a hint takes 20; finishing in time adds 5 per second left
export function starsFor(G, D) {
  if (G.won) return !D.time ? (G.hints ? 2 : 3) : G.left >= D.time * .35 && !G.hints ? 3 : 2;
  return G.found >= Math.ceil(G.total / 2) ? 1 : 0;
}
const MARKS = ["#ffd27f", "#7ff0bf", "#8fd3ff", "#ffa8c8", "#cdb0ff", "#ffb877", "#b8f27a", "#7fe3f0"];

const CSS = `
.sp{position:absolute;inset:0;overflow:hidden;font-family:"Sora",system-ui,sans-serif;color:#fff;background:radial-gradient(120% 70% at 50% 0%,var(--sp-c2),#0b0418 62%);user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.sp *{box-sizing:border-box}
.sp [hidden]{display:none!important}
.sp-scr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center}
.sp-card0{margin:auto;width:min(92%,420px);text-align:center;padding:18px 18px 22px;display:flex;flex-direction:column;align-items:center;gap:12px;max-height:100%;overflow:auto}
.sp-logo{height:24px;width:auto;margin-top:calc(16px + env(safe-area-inset-top,0px));flex:none}
.sp-logo.own{height:auto;max-height:42px;max-width:60%;filter:drop-shadow(0 0 1.5px rgba(255,255,255,.75)) drop-shadow(0 2px 8px rgba(0,0,0,.45))}
.sp-k{font-size:.72rem;letter-spacing:.24em;text-transform:uppercase;color:#ffd27f;font-weight:700}
.sp h1{font-size:clamp(1.6rem,7vw,2.3rem);line-height:1.05;margin:0;text-wrap:balance}
.sp p{margin:0;color:rgba(255,255,255,.78);line-height:1.45;font-family:"IBM Plex Sans",system-ui,sans-serif}
/* the little grid of the intro, with a word being marked */
.sp-demo{position:relative;display:grid;grid-template-columns:repeat(5,30px);gap:3px;padding:8px;border-radius:14px;background:#fffdf8;color:#1d1430;font-weight:800;font-size:1rem;margin:4px 0;box-shadow:0 16px 30px -14px rgba(0,0,0,.7);transform:rotate(-3deg)}
.sp-demo span{height:30px;display:grid;place-items:center;position:relative;z-index:1}
.sp-demo i{position:absolute;left:8px;top:calc(8px + 33px);height:30px;border-radius:15px;background:#ffd27f;width:30px;animation:spDemo 2.6s ease-in-out infinite}
@keyframes spDemo{0%,15%{width:30px;opacity:.95}55%,85%{width:162px;opacity:.95}100%{width:162px;opacity:0}}
.sp-rules{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.sp-rules span{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 12px;font-size:.82rem;font-weight:600}
.sp-btn{font:700 1.05rem Sora,sans-serif;letter-spacing:.06em;border:0;border-radius:999px;padding:15px 34px;color:#2b1300;background:linear-gradient(135deg,#ffd27f,#ff9f3a);box-shadow:0 0 30px rgba(255,190,85,.55);cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.sp-btn.g{background:rgba(255,255,255,.12);color:#fff;box-shadow:none;border:1px solid rgba(255,255,255,.3);font-size:.92rem;padding:12px 22px}
.sp-best{font-size:.85rem;color:#ffd27f}
/* game */
.sp-top{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 6px;flex:none}
.sp-pill{background:rgba(10,4,22,.55);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 14px;font-weight:700;font-size:.9rem;white-space:nowrap}
.sp-pill b{color:#ffd27f}
.sp-clock{position:relative;width:58px;height:58px;flex:none}
.sp-clock svg{width:100%;height:100%;transform:rotate(-90deg)}
.sp-clock circle{fill:none;stroke-width:6}
.sp-clock .bg{stroke:rgba(255,255,255,.15)}.sp-clock .fg{stroke:#ffd27f;stroke-linecap:round;transition:stroke .3s}
.sp-clock span{position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:1.2rem}
.sp.low .sp-clock .fg{stroke:#ff5c74}.sp.low .sp-clock span{color:#ff8a9e;animation:spBeat 1s ease-in-out infinite}
.sp.low::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 60px rgba(255,60,90,.55);animation:spEdge 1s ease-in-out infinite}
@keyframes spBeat{50%{transform:scale(1.18)}}@keyframes spEdge{50%{opacity:.35}}
.sp-board{flex:1 1 0;min-height:0;width:100%;display:grid;place-items:center;padding:4px 10px}
.sp-paper{padding:var(--sp-pad);border-radius:18px;background:#fffdf8;box-shadow:0 18px 40px -18px rgba(0,0,0,.8),0 0 0 3px rgba(255,255,255,.25)}
.sp-area{position:relative;width:calc(var(--sp-cs) * var(--sp-n));height:calc(var(--sp-cs) * var(--sp-n));touch-action:none;cursor:pointer}
.sp-area svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.sp-grid{position:relative;display:grid;grid-template-columns:repeat(var(--sp-n),var(--sp-cs));grid-auto-rows:var(--sp-cs)}
.sp-grid span{display:grid;place-items:center;font-weight:700;font-size:calc(var(--sp-cs) * .56);color:#2a1d44;line-height:1;transition:opacity .3s,transform .3s}
.sp-grid span.f{color:#140a26;font-weight:800}
.sp-grid.hide span{opacity:0;transform:scale(.4)}
.sp-sel{stroke:var(--sp-c);stroke-opacity:.42;stroke-linecap:round;fill:none}
.sp-mark{stroke-linecap:round;fill:none;animation:spMark .35s cubic-bezier(.3,1.4,.5,1)}
@keyframes spMark{from{stroke-width:0}}
.sp-anchor{fill:var(--sp-c);fill-opacity:.45}
.sp-hintc{fill:none;stroke:#ff9f3a;stroke-width:.12;animation:spHint .5s ease-in-out 4 alternate}
@keyframes spHint{to{stroke-width:.24;opacity:.4}}
.sp-area.bad{animation:spBad .35s ease}
@keyframes spBad{25%{translate:-5px 0}50%{translate:5px 0}75%{translate:-3px 0}}
.sp-list{flex:none;width:min(100%,560px);padding:6px 12px calc(12px + env(safe-area-inset-bottom,0px));max-height:34%;overflow:auto}
.sp-lh{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 2px 6px}
.sp-lh span{font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.65);font-weight:700}
.sp-hb{display:inline-flex;align-items:center;gap:6px;font:700 .78rem Sora,sans-serif;color:#2b1300;background:#ffd27f;border:0;border-radius:999px;padding:6px 12px;cursor:pointer}
.sp-hb:disabled{opacity:.4;cursor:default}
.sp-hb svg{width:14px;height:14px}
.sp-words{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.sp-w{background:rgba(10,4,22,.55);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:5px 11px;font-weight:700;font-size:.82rem;letter-spacing:.04em;transition:all .3s}
.sp-w.done{background:var(--mk);border-color:var(--mk);color:#140a26;text-decoration:line-through;text-decoration-thickness:2px}
.sp.pistas .sp-words{flex-direction:column;align-items:stretch}
.sp.pistas .sp-w{border-radius:12px;padding:7px 12px;font-family:"IBM Plex Sans",system-ui,sans-serif;font-weight:600;letter-spacing:0;display:flex;justify-content:space-between;gap:10px;align-items:center}
.sp.pistas .sp-w b{font-family:Sora,sans-serif;letter-spacing:.08em;white-space:nowrap;color:rgba(255,255,255,.5)}
.sp.pistas .sp-w.done{text-decoration:none}.sp.pistas .sp-w.done b{color:#140a26}
.sp-big{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font:800 clamp(3.4rem,20vw,6rem) Sora,sans-serif;text-shadow:0 6px 30px rgba(0,0,0,.6);pointer-events:none;animation:spPop .7s ease forwards;z-index:3}
.sp-big.s{font-size:clamp(1.1rem,5.4vw,1.7rem);background:rgba(10,4,22,.82);padding:10px 20px;border-radius:999px;top:calc(76px + env(safe-area-inset-top,0px));transform:translate(-50%,0);animation:spToast 1.6s ease forwards;white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis}
@keyframes spPop{0%{opacity:0;scale:.4}25%{opacity:1;scale:1.1}75%{opacity:1;scale:1}100%{opacity:0;scale:1}}
@keyframes spToast{0%{opacity:0;translate:0 -10px}15%,80%{opacity:1;translate:0 0}100%{opacity:0}}
/* end */
.sp-score{font:800 clamp(3rem,16vw,4.6rem) Sora,sans-serif;line-height:1;color:#ffd27f;text-shadow:0 0 30px rgba(255,190,85,.5)}
.sp-stars{display:flex;gap:6px;justify-content:center}
.sp-stars svg{width:44px;height:44px}
.sp-stars svg.on{animation:spStar .5s cubic-bezier(.3,1.6,.5,1) backwards}
@keyframes spStar{from{transform:scale(0) rotate(-40deg)}}
.sp-sum{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.sp-sum span{background:rgba(255,255,255,.1);border-radius:12px;padding:8px 12px;font-size:.85rem}
.sp-sum b{display:block;font-size:1.1rem}
.sp-miss{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:10px 12px;text-align:left;font-size:.86rem}
.sp-miss b{display:block;font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:#ffd27f;margin-bottom:4px}
.sp-miss div{padding:3px 0;font-family:"IBM Plex Sans",system-ui,sans-serif}
.sp-miss em{font-style:normal;font-weight:700;font-family:Sora,sans-serif;letter-spacing:.06em}
.sp-acts{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:4px}
.sp-new{font:800 .8rem Sora,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#2b1300;background:#ffd27f;border-radius:999px;padding:5px 12px;animation:spBeat 1.2s ease-in-out infinite}
.sp-toast{position:absolute;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:rgba(10,4,22,.85);padding:10px 16px;border-radius:999px;font-size:.88rem;white-space:nowrap;z-index:3}
.sp-conf{position:absolute;inset:0;pointer-events:none}
@media (prefers-reduced-motion:reduce){.sp-demo i,.sp.low .sp-clock span,.sp.low::after,.sp-new,.sp-mark,.sp-hintc{animation:none}.sp-grid span{transition:none}}
`;
const STAR = on => `<svg viewBox="0 0 24 24" class="${on ? "on" : ""}"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" fill="${on ? "#ffd27f" : "rgba(255,255,255,.18)"}" stroke="${on ? "#fff3c4" : "rgba(255,255,255,.3)"}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const BULB = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3z"/></svg>`;

/**
 * o: { root, cfg (an experience: slug, title, sopa), brand: {src, own, href} | null, url (to share), onClick(id),
 *      embedded (the maker's preview: nothing is saved, counted or shared) }
 * returns { update(cfg, brand), destroy() }
 */
export function run(o) {
  if (!document.getElementById("sp-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "sp-css", textContent: CSS }));
  let cfg = o.cfg, brand = o.brand, state = "intro", timers = [], raf = 0;
  const KEY = "vvr-sopa-" + (cfg.slug || "x");
  const D = () => cfg.sopa || {};
  const el = document.createElement("div"); el.className = "sp"; o.root.appendChild(el);
  const later = (f, ms) => { const t = setTimeout(f, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); };
  const count = id => { if (!o.embedded && o.onClick) o.onClick(id); };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let best = 0; if (!o.embedded) try { best = Number(JSON.parse(localStorage.getItem(KEY) || "{}").best) || 0; } catch {}
  function paint() {
    const c = hexOk(D().color, "#8b3fd6");
    el.style.setProperty("--sp-c", c); el.style.setProperty("--sp-c2", mix(c, "#0b0418", .55)); el.style.setProperty("--sp-on", onAccent(c));
    el.classList.toggle("pistas", D().mode === "pistas");
  }
  const logoHtml = () => brand ? `<img class="sp-logo${brand.own ? " own" : ""}" src="${esc(brand.src)}" alt="">` : `<span style="height:24px;margin-top:calc(16px + env(safe-area-inset-top,0px))"></span>`;
  const name = () => D().name || cfg.title || "Sopa de letras";
  const words = () => (D().words || []).filter(x => norm(x.w).length >= 2).slice(0, LIMITS.max);
  const timeOf = () => TIMES.includes(Number(D().time)) ? Number(D().time) : 90;

  // ---------- intro ----------
  function intro() {
    clearTimers(); state = "intro"; el.classList.remove("low"); paint();
    const d = D(), n = words().length, t = timeOf();
    const demo = "SOLARMARTEDLUNAPCIELOVENUS".slice(0, 25).split("").map(c => `<span>${c}</span>`).join("");
    el.innerHTML = `<div class="sp-scr">${logoHtml()}<div class="sp-card0">
      <div class="sp-demo" aria-hidden="true"><i></i>${demo}</div>
      <h1>${esc(name())}</h1>${d.sub ? `<p>${esc(d.sub)}</p>` : ""}
      <div class="sp-rules"><span>${n} palabras</span><span>${t ? t + " segundos" : "Sin límite de tiempo"}</span><span>${LEVELS[d.level] || LEVELS.normal}</span>${d.mode === "pistas" ? "<span>Adivina con pistas</span>" : ""}</div>
      <p style="font-size:.88rem">Desliza el dedo sobre las letras para marcar cada palabra.</p>
      <button class="sp-btn" type="button" data-go>¡Jugar!</button>${best ? `<span class="sp-best">Tu récord: ${best.toLocaleString("es-MX")} puntos</span>` : ""}</div></div>`;
    el.querySelector("[data-go]").onclick = () => { sfx.tap(); count("play"); play(); };
  }

  // ---------- the game ----------
  let G = null;
  function layout() {
    const board = el.querySelector(".sp-board"); if (!board || !G) return;
    const pad = 8, W = board.clientWidth - 20 - pad * 2, H = board.clientHeight - 8 - pad * 2;
    const cs = Math.max(14, Math.floor(Math.min(W, H, 520) / G.n));
    el.style.setProperty("--sp-cs", cs + "px"); el.style.setProperty("--sp-n", G.n); el.style.setProperty("--sp-pad", pad + "px");
  }
  function play() {
    clearTimers(); paint(); state = "peek";
    const d = D(), list = words(), time = timeOf();
    const grid = makeGrid(list.map(x => x.w), LEVELS[d.level] ? d.level : "normal");
    if (!grid) { el.innerHTML = `<div class="sp-scr"><div class="sp-card0"><h1>Son demasiadas letras</h1><p>Quita una palabra o usa palabras más cortas.</p></div></div>`; return; }
    const W8 = list.map((x, i) => ({ i, w: x.w, h: x.h || "", n: norm(x.w), found: false }));
    G = { ...grid, list: W8, total: W8.length, found: 0, score: 0, hints: 0, left: time, time, won: false, lastSec: -1, sel: null, anchor: null, lastFound: 0 };
    const pistas = d.mode === "pistas";
    el.innerHTML = `<div class="sp-scr"><div class="sp-top"><span class="sp-pill">Palabras <b data-found>0</b>/${G.total}</span>
      <div class="sp-clock"><svg viewBox="0 0 60 60"><circle class="bg" cx="30" cy="30" r="26"/><circle class="fg" cx="30" cy="30" r="26" stroke-dasharray="163.4" stroke-dashoffset="0"/></svg><span data-t>${time || 0}</span></div>
      <span class="sp-pill">Puntos <b data-score>0</b></span></div>
      <div class="sp-board"><div class="sp-paper"><div class="sp-area">
        <svg viewBox="0 0 ${G.n} ${G.n}" aria-hidden="true"><g data-marks></g><g data-temp></g></svg>
        <div class="sp-grid hide">${G.cells.map((c, k) => `<span data-k="${k}" style="transition-delay:${reduced ? 0 : ((k % G.n) + Math.floor(k / G.n)) * 14}ms">${c}</span>`).join("")}</div>
      </div></div></div>
      <div class="sp-list"><div class="sp-lh"><span>${pistas ? "Adivina y encuentra" : "Encuentra"}</span><button class="sp-hb" type="button" data-hint>${BULB}Pista <b data-hl>3</b></button></div>
        <div class="sp-words">${W8.map(x => `<span class="sp-w" data-w="${x.i}">${pistas ? `${esc(x.h)}<b>${"_ ".repeat(x.n.length).trim()}</b>` : esc(x.w.toUpperCase())}</span>`).join("")}</div></div></div>`;
    layout(); later(layout, 60);
    const area = el.querySelector(".sp-area");
    area.addEventListener("pointerdown", down); area.addEventListener("pointermove", move); area.addEventListener("pointerup", up); area.addEventListener("pointercancel", () => { G.sel = null; drawTemp(); });
    el.querySelector("[data-hint]").onclick = hint;
    const big = (t, cls = "") => { const s = Object.assign(document.createElement("div"), { className: "sp-big " + cls, innerHTML: t }); el.appendChild(s); later(() => s.remove(), cls ? 1700 : 760); };
    G.big = big;
    const me = G;
    [3, 2, 1].forEach((n, k) => later(() => { if (G !== me) return; sfx.count(); big(String(n)); }, 200 + k * 700));
    later(() => { if (G !== me) return; el.querySelector(".sp-grid").classList.remove("hide"); sfx.swoosh(); }, 2150);
    later(() => { if (G !== me) return; sfx.go(); big("¡Ya!"); state = "play"; G.t0 = performance.now(); tick(); }, 2400);
  }
  function tick() {
    if (state !== "play") return;
    const el0 = (performance.now() - G.t0) / 1000, fg = el.querySelector(".sp-clock .fg"), tx = el.querySelector("[data-t]");
    if (!G.time) { G.left = 0; G.used = el0; const s = Math.floor(el0); if (s !== G.lastSec) { G.lastSec = s; if (tx) tx.textContent = s; } raf = requestAnimationFrame(tick); return; }
    const left = Math.max(0, G.time - el0); G.left = left; G.used = G.time - left;
    const s = Math.ceil(left);
    if (fg) fg.style.strokeDashoffset = String(163.4 * (1 - left / G.time));
    if (s !== G.lastSec) { G.lastSec = s; if (tx) tx.textContent = s; if (s <= 5 && s > 0) { el.classList.add("low"); sfx.tick(1.4); if (navigator.vibrate && !o.embedded) try { navigator.vibrate(25); } catch {} } }
    if (left <= 0) { end(false); return; }
    raf = requestAnimationFrame(tick);
  }

  // ---------- marking a word ----------
  const cellAt = e => { const r = el.querySelector(".sp-area").getBoundingClientRect(), n = G.n;
    return { x: Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n))), y: Math.max(0, Math.min(n - 1, Math.floor((e.clientY - r.top) / r.height * n))) }; };
  // from a to b along the nearest of the 8 directions, inside the grid
  function line(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y; if (!dx && !dy) return { a, b: a, dx: 0, dy: 0, len: 1 };
    const k = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)), ux = Math.round(Math.cos(k * Math.PI / 4)), uy = Math.round(Math.sin(k * Math.PI / 4));
    let len = Math.max(Math.abs(dx), Math.abs(dy));
    while (len > 0 && (a.x + ux * len < 0 || a.y + uy * len < 0 || a.x + ux * len >= G.n || a.y + uy * len >= G.n)) len--;
    return { a, b: { x: a.x + ux * len, y: a.y + uy * len }, dx: ux, dy: uy, len: len + 1 };
  }
  const aligned = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y; return (dx || dy) && (!dx || !dy || Math.abs(dx) === Math.abs(dy)); };
  function down(e) {
    if (state !== "play") return; e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const c = cellAt(e); G.sel = { a: c, l: line(c, c), moved: false }; drawTemp();
  }
  function move(e) {
    if (!G || !G.sel || state !== "play") return;
    const c = cellAt(e), l = line(G.sel.a, c);
    if (l.len !== G.sel.l.len || l.b.x !== G.sel.l.b.x || l.b.y !== G.sel.l.b.y) { G.sel.l = l; if (l.len > 1) { G.sel.moved = true; G.anchor = null; } drawTemp(); }
  }
  function up() {
    if (!G || !G.sel || state !== "play") return;
    const s = G.sel; G.sel = null;
    if (!s.moved) {   // a tap: the first letter, then the last one
      const c = s.a;
      if (G.anchor && aligned(G.anchor, c)) { const a = G.anchor; G.anchor = null; drawTemp(); check(line(a, c)); return; }
      G.anchor = G.anchor && G.anchor.x === c.x && G.anchor.y === c.y ? null : c; sfx.pop(); drawTemp(); return;
    }
    drawTemp(); check(s.l);
  }
  const textOf = l => Array.from({ length: l.len }, (_, i) => G.cells[(l.a.y + l.dy * i) * G.n + l.a.x + l.dx * i]).join("");
  function check(l) {
    if (l.len < 2) return;
    const s = textOf(l), r = [...s].reverse().join(""), w = G.list.find(x => !x.found && (x.n === s || x.n === r));
    if (!w) { const a = el.querySelector(".sp-area"); a.classList.remove("bad"); void a.offsetWidth; a.classList.add("bad"); sfx.swoosh(); return; }
    found(w, l);
  }
  function found(w, l) {
    w.found = true; G.found++;
    const col = MARKS[(G.found - 1) % MARKS.length], now = performance.now(), quick = G.lastFound && now - G.lastFound < 6000; G.lastFound = now;
    const pts = 100 + w.n.length * 10 + (quick ? 50 : 0); G.score += pts;
    el.querySelector("[data-marks]").insertAdjacentHTML("beforeend", `<line class="sp-mark" x1="${l.a.x + .5}" y1="${l.a.y + .5}" x2="${l.b.x + .5}" y2="${l.b.y + .5}" stroke="${col}" stroke-width=".78"/>`);
    for (let i = 0; i < l.len; i++) { const k = (l.a.y + l.dy * i) * G.n + l.a.x + l.dx * i, c = el.querySelector(`[data-k="${k}"]`); if (c) c.classList.add("f"); }
    const chip = el.querySelector(`[data-w="${w.i}"]`); if (chip) { chip.style.setProperty("--mk", col); chip.classList.add("done"); const b = chip.querySelector("b"); if (b) b.textContent = w.w.toUpperCase(); chip.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" }); }
    el.querySelector("[data-found]").textContent = G.found; el.querySelector("[data-score]").textContent = G.score.toLocaleString("es-MX");
    sfx.correct(); sfx.sparkle(quick ? 6 : 3); burst(l);
    const what = D().mode === "pistas" && w.h ? `${esc(w.h)} = <b>${esc(w.w.toUpperCase())}</b>` : `<b>${esc(w.w.toUpperCase())}</b>`;
    G.big(quick ? `<span style="color:#ffd27f">¡Rapidísimo! +${pts}</span> · ${what}` : what, "s");
    if (G.found === G.total) later(() => end(true), 700);
  }
  function drawTemp() {
    const g = el.querySelector("[data-temp]"); if (!g) return;
    let h = "";
    if (G.anchor) h += `<circle class="sp-anchor" cx="${G.anchor.x + .5}" cy="${G.anchor.y + .5}" r=".42"/>`;
    if (G.sel) { const l = G.sel.l; h += `<line class="sp-sel" x1="${l.a.x + .5}" y1="${l.a.y + .5}" x2="${l.b.x + .5}" y2="${l.b.y + .5}" stroke-width=".8"/>`; }
    g.innerHTML = h;
  }
  function hint() {
    if (state !== "play" || G.hints >= 3) return;
    const left = G.list.filter(x => !x.found); if (!left.length) return;
    const w = left[Math.random() * left.length | 0], p = G.places.find(q => q.w === w.n); if (!p) return;
    G.hints++; G.score = Math.max(0, G.score - 20); sfx.sparkle(4);
    el.querySelector("[data-score]").textContent = G.score.toLocaleString("es-MX");
    el.querySelector("[data-hl]").textContent = 3 - G.hints; el.querySelector("[data-hint]").disabled = G.hints >= 3;
    const g = el.querySelector("[data-marks]"); g.insertAdjacentHTML("beforeend", `<circle class="sp-hintc" cx="${p.x + .5}" cy="${p.y + .5}" r=".46"/>`);
    const c = g.lastElementChild; later(() => c.remove(), 2200);
    G.big(D().mode === "pistas" && w.h ? `Empieza aquí: ${esc(w.h)}` : `Aquí empieza ${esc(w.w.toUpperCase())}`, "s");
  }
  function burst(l) {   // little stars out of the word just found
    if (reduced) return;
    const r = el.querySelector(".sp-area").getBoundingClientRect(), R = el.getBoundingClientRect(), cs = r.width / G.n;
    const cx = r.left - R.left + ((l.a.x + l.b.x) / 2 + .5) * cs, cy = r.top - R.top + ((l.a.y + l.b.y) / 2 + .5) * cs;
    for (let k = 0; k < 12; k++) {
      const s = document.createElement("i"), a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
      s.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:9px;height:9px;border-radius:2px;background:${["#ffd27f", "#6ff0b2", "#fff", "#ff8fb1"][k % 4]};pointer-events:none;transition:transform .6s cubic-bezier(.2,.8,.3,1),opacity .6s;transform:translate(-50%,-50%) rotate(45deg);z-index:2`;
      el.appendChild(s); requestAnimationFrame(() => { s.style.transform = `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d}px)) rotate(${200 + Math.random() * 300}deg) scale(.5)`; s.style.opacity = "0"; });
      later(() => s.remove(), 700);
    }
  }

  // ---------- the end ----------
  function end(won) {
    if (state === "over") return;
    state = "over"; cancelAnimationFrame(raf); el.classList.remove("low");
    G.won = won; const secs = G.time ? Math.ceil(G.left) : 0, bonus = won ? secs * 5 : 0; G.score += bonus;
    const d = D(), st = starsFor(G, { time: G.time }), rec = !o.embedded && G.score > best && G.score > 0;
    if (rec) { best = G.score; try { localStorage.setItem(KEY, JSON.stringify({ best })); } catch {} }
    if (won) count("win");
    const usedT = Math.round(G.used || 0), miss = G.list.filter(x => !x.found);
    el.innerHTML = `<div class="sp-scr">${logoHtml()}<div class="sp-card0">
      <span class="sp-k">${esc(name())}</span><h1>${won ? (st === 3 ? "¡Ojo de águila!" : "¡Las encontraste todas!") : "¡Se acabó el tiempo!"}</h1>
      <div class="sp-stars">${[0, 1, 2].map(i => STAR(i < st)).join("")}</div>
      <div class="sp-score" data-sc>0</div><span style="margin-top:-6px;color:rgba(255,255,255,.7);font-size:.85rem">puntos</span>
      ${rec ? `<span class="sp-new">¡Nuevo récord!</span>` : best ? `<span class="sp-best">Tu récord: ${best.toLocaleString("es-MX")}</span>` : ""}
      <div class="sp-sum"><span><b>${G.found}/${G.total}</b>palabras</span><span><b>${won ? usedT + " s" : "—"}</b>tiempo</span><span><b>${G.hints}</b>pistas</span>${won && bonus ? `<span><b>+${bonus}</b>por rapidez</span>` : ""}</div>
      ${miss.length ? `<div class="sp-miss"><b>Te faltaron</b>${miss.map(x => `<div>${d.mode === "pistas" && x.h ? `${esc(x.h)}: ` : ""}<em>${esc(x.w.toUpperCase())}</em></div>`).join("")}</div>` : ""}
      <div class="sp-acts"><button class="sp-btn" type="button" data-again>Jugar otra vez</button><button class="sp-btn g" type="button" data-share>Retar a alguien</button></div></div></div>`;
    const sc = el.querySelector("[data-sc]"), t0 = performance.now(), dur = Math.min(1400, 300 + G.score / 2);
    const upd = () => { const k = Math.min(1, (performance.now() - t0) / dur); sc.textContent = Math.round(G.score * (1 - (1 - k) ** 3)).toLocaleString("es-MX"); if (k < 1) raf = requestAnimationFrame(upd); };
    upd();
    later(() => { if (won) { sfx.win(); confetti(); } else if (st) sfx.sparkle(5); else sfx.lose(); }, 200);
    el.querySelector("[data-again]").onclick = () => { sfx.tap(); count("play"); play(); };
    el.querySelector("[data-share]").onclick = () => { sfx.tap(); count("share"); share(won, usedT); };
  }
  function confetti() {
    if (reduced) return;
    const c = Object.assign(document.createElement("canvas"), { className: "sp-conf" }); el.appendChild(c);
    const W = c.width = el.clientWidth * (devicePixelRatio || 1), H = c.height = el.clientHeight * (devicePixelRatio || 1), g = c.getContext("2d");
    const cols = ["#ffd27f", "#ff8fb1", "#6ff0b2", "#6fc8ff", "#c99bff", hexOk(D().color, "#8b3fd6")];
    const ps = Array.from({ length: 140 }, () => ({ x: W * Math.random(), y: -H * Math.random() * .6, vx: (Math.random() - .5) * W * .004, vy: H * (.004 + Math.random() * .006), r: Math.random() * 6, vr: (Math.random() - .5) * .3, s: (6 + Math.random() * 8) * (devicePixelRatio || 1), c: cols[Math.floor(Math.random() * cols.length)] }));
    const t0 = performance.now();
    const fr = () => { if (!c.isConnected) return; const k = (performance.now() - t0) / 3200; g.clearRect(0, 0, W, H);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - k * k); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
      if (k < 1) requestAnimationFrame(fr); else c.remove(); };
    fr();
  }
  function toast(t) { const s = Object.assign(document.createElement("div"), { className: "sp-toast", textContent: t }); el.appendChild(s); later(() => s.remove(), 1900); }
  async function share(won, secs) {
    if (o.embedded) { toast("Así retarán a sus amigos"); return; }
    const text = won ? `¡Encontré las ${G.total} palabras en ${secs} segundos e hice ${G.score.toLocaleString("es-MX")} puntos en la sopa de letras "${name()}"! ¿Me ganas?` : `Encontré ${G.found} de ${G.total} palabras en la sopa de letras "${name()}". ¿Tú puedes con todas?`;
    try { if (navigator.share) { await navigator.share({ title: name(), text, url: o.url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text + " " + o.url); toast("Copiado: pégalo donde quieras"); } catch { toast(o.url); }
  }

  const ro = new ResizeObserver(() => { if (G && state !== "intro" && state !== "over") layout(); }); ro.observe(el);
  intro();
  return {
    update(c, b) { cfg = c; brand = b === undefined ? brand : b; G = null; intro(); },
    destroy() { clearTimers(); ro.disconnect(); el.remove(); },
  };
}
