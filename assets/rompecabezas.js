// Rompecabezas (/x/ when the experience is kind "rompecabezas"; made in /crear/rompecabezas/, whose preview runs this same file).
// A jigsaw puzzle for the phone made from the experience's image: real pieces with tabs, cut on the phone each game (new
// tabs every time), scattered below the board (beside it on a wide screen); a piece dragged near its place snaps in.
// level = facil (6 pieces) | normal (12) | dificil (20) | experto (35); facil and normal show the picture faintly on the
// board. time = the seconds of the clock; whoever plays chooses on the first screen to play with it or without it (time 0,
// from before, starts without it); the last 5 s go red with a tick. At the end: the whole picture and, if there is
// one, the "¿Sabías que…?" text (info).
// cfg.rompecabezas = { name, sub, level, time, color, info }, cfg.img = { w, h }; o.image = the url of the picture.
// Saved on the phone: the best score (vvr-rompecabezas-<slug>). Counted: play, win, share (o.onClick).
import { sfx } from "./sonidos.js";

export const TIMES = [60, 120, 180, 300];
export const LEVELS = { facil: { t: "Fácil", n: 6, ghost: true }, normal: { t: "Normal", n: 12, ghost: true }, dificil: { t: "Difícil", n: 20 }, experto: { t: "Experto", n: 35 } };
// columns and rows for about n pieces of a picture of this shape, with pieces as square as possible
export function gridFor(aspect, n) {
  let best = null;
  for (let c = 2; c <= 9; c++) for (let r = 2; r <= 9; r++) {
    const cell = (aspect / c) / (1 / r), score = Math.abs(Math.log(cell)) * 2 + Math.abs(c * r - n) / n * 3;
    if (!best || score < best.score) best = { cols: c, rows: r, score };
  }
  return { cols: best.cols, rows: best.rows };
}
// points: each piece 50, another within 4 s adds 25; finishing in time adds 5 per second left
export function starsFor(G) {
  if (!G.won) return G.placed >= Math.ceil(G.total / 2) ? 1 : 0;
  if (G.time) return G.left >= G.time * .4 ? 3 : 2;
  return G.used <= G.total * 7 ? 3 : 2;
}

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hexOk = (v, d) => /^#[0-9a-f]{6}$/i.test(v || "") ? v.toLowerCase() : d;
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (hex, to, k) => { const a = rgb(hex), b = rgb(to); return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join(""); };

// one side of a piece from (x0, y0) to (x1, y1): straight (s = 0) or with a knob out (s = 1) or in (s = -1); T = the size of the knob
function side(p, x0, y0, x1, y1, s, T) {
  if (!s) { p.lineTo(x1, y1); return; }
  const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = uy, ny = -ux;
  const P = (a, b) => [x0 + ux * (L / 2 + (a - .5) * T) + nx * b * T * s, y0 + uy * (L / 2 + (a - .5) * T) + ny * b * T * s];
  p.lineTo(...P(.4, 0));
  p.bezierCurveTo(...P(.43, 0), ...P(.44, .04), ...P(.41, .08));
  p.bezierCurveTo(...P(.35, .15), ...P(.38, .25), ...P(.5, .25));
  p.bezierCurveTo(...P(.62, .25), ...P(.65, .15), ...P(.59, .08));
  p.bezierCurveTo(...P(.56, .04), ...P(.57, 0), ...P(.6, 0));
  p.lineTo(x1, y1);
}

const CSS = `
.pz{position:absolute;inset:0;overflow:hidden;font-family:"Sora",system-ui,sans-serif;color:#fff;background:radial-gradient(120% 70% at 50% 0%,var(--pz-c2),#0b0418 62%);user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.pz *{box-sizing:border-box}
.pz [hidden]{display:none!important}
.pz-scr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center}
.pz-card0{margin:auto;width:min(92%,440px);text-align:center;padding:18px 18px 22px;display:flex;flex-direction:column;align-items:center;gap:12px;max-height:100%;overflow:auto}
.pz-logo{height:24px;width:auto;margin-top:calc(16px + env(safe-area-inset-top,0px));flex:none}
.pz-logo.own{height:auto;max-height:42px;max-width:60%;filter:drop-shadow(0 0 1.5px rgba(255,255,255,.75)) drop-shadow(0 2px 8px rgba(0,0,0,.45))}
.pz-k{font-size:.72rem;letter-spacing:.24em;text-transform:uppercase;color:#ffd27f;font-weight:700}
.pz h1{font-size:clamp(1.6rem,7vw,2.3rem);line-height:1.05;margin:0;text-wrap:balance}
.pz p{margin:0;color:rgba(255,255,255,.78);line-height:1.45;font-family:"IBM Plex Sans",system-ui,sans-serif}
/* the picture of the intro, with a piece out */
.pz-pic{position:relative;width:min(78%,300px);margin:6px 0 4px;transform:rotate(-2.5deg)}
.pz-pic img{display:block;width:100%;border-radius:10px;border:5px solid #fff;box-shadow:0 18px 34px -14px rgba(0,0,0,.75)}
.pz-pic canvas{position:absolute;filter:drop-shadow(0 8px 10px rgba(0,0,0,.5));animation:pzFloat 2.8s ease-in-out infinite}
@keyframes pzFloat{50%{translate:6px -10px;rotate:8deg}}
.pz-tog{display:flex;background:rgba(10,4,22,.55);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:4px;gap:4px}
.pz-tog button{border:0;border-radius:999px;padding:8px 14px;font:700 .85rem Sora,sans-serif;color:#fff;background:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.pz-tog button[aria-pressed="true"]{background:#fff;color:#1d1430}
.pz-rules{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.pz-rules span{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 12px;font-size:.82rem;font-weight:600}
.pz-btn{font:700 1.05rem Sora,sans-serif;letter-spacing:.06em;border:0;border-radius:999px;padding:15px 34px;color:#2b1300;background:linear-gradient(135deg,#ffd27f,#ff9f3a);box-shadow:0 0 30px rgba(255,190,85,.55);cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.pz-btn.g{background:rgba(255,255,255,.12);color:#fff;box-shadow:none;border:1px solid rgba(255,255,255,.3);font-size:.92rem;padding:12px 22px}
.pz-best{font-size:.85rem;color:#ffd27f}
/* game */
.pz-top{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 6px;flex:none}
.pz-pill{background:rgba(10,4,22,.55);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 14px;font-weight:700;font-size:.9rem;white-space:nowrap}
.pz-pill b{color:#ffd27f}
.pz-clock{position:relative;width:58px;height:58px;flex:none}
.pz-clock svg{width:100%;height:100%;transform:rotate(-90deg)}
.pz-clock circle{fill:none;stroke-width:6}
.pz-clock .bg{stroke:rgba(255,255,255,.15)}.pz-clock .fg{stroke:#ffd27f;stroke-linecap:round;transition:stroke .3s}
.pz-clock span{position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:1.15rem}
.pz.low .pz-clock .fg{stroke:#ff5c74}.pz.low .pz-clock span{color:#ff8a9e;animation:pzBeat 1s ease-in-out infinite}
.pz.low::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 60px rgba(255,60,90,.55);animation:pzEdge 1s ease-in-out infinite}
@keyframes pzBeat{50%{transform:scale(1.18)}}@keyframes pzEdge{50%{opacity:.35}}
.pz-area{position:relative;flex:1 1 0;min-height:0;width:100%;touch-action:none}
.pz-board{position:absolute;border-radius:6px;box-shadow:0 0 0 3px rgba(255,255,255,.85),0 18px 40px -16px rgba(0,0,0,.8);background:rgba(255,255,255,.07)}
.pz-board canvas{position:absolute;inset:0;width:100%;height:100%;border-radius:6px}
.pz-board .full{opacity:0;transition:opacity .5s}
.pz-board.peek .full,.pz-board.done .full{opacity:1}
.pz-board.done{box-shadow:0 0 0 3px #ffd27f,0 0 40px rgba(255,190,85,.7)}
.pz-pc{position:absolute;left:0;top:0;pointer-events:none;will-change:transform;filter:drop-shadow(0 3px 4px rgba(0,0,0,.45))}
.pz-pc.fly{transition:transform .7s cubic-bezier(.3,1.1,.4,1)}
.pz-pc.snap{transition:transform .14s ease-out;filter:none}
.pz-pc.lift{filter:drop-shadow(0 12px 14px rgba(0,0,0,.55))}
.pz-pc.ok{filter:none}
.pz-bar{flex:none;display:flex;gap:10px;justify-content:center;padding:6px 12px calc(12px + env(safe-area-inset-bottom,0px))}
.pz-eye{display:inline-flex;align-items:center;gap:7px;font:700 .82rem Sora,sans-serif;color:#2b1300;background:#ffd27f;border:0;border-radius:999px;padding:8px 16px;cursor:pointer}
.pz-eye svg{width:16px;height:16px}
.pz-big{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font:800 clamp(3.4rem,20vw,6rem) Sora,sans-serif;text-shadow:0 6px 30px rgba(0,0,0,.6);pointer-events:none;animation:pzPop .7s ease forwards;z-index:999}
.pz-big.s{font-size:clamp(1.1rem,5.4vw,1.6rem);background:rgba(10,4,22,.82);padding:10px 20px;border-radius:999px;top:calc(76px + env(safe-area-inset-top,0px));transform:translate(-50%,0);animation:pzToast 1.4s ease forwards;white-space:nowrap}
@keyframes pzPop{0%{opacity:0;scale:.4}25%{opacity:1;scale:1.1}75%{opacity:1;scale:1}100%{opacity:0;scale:1}}
@keyframes pzToast{0%{opacity:0;translate:0 -10px}15%,80%{opacity:1;translate:0 0}100%{opacity:0}}
/* end */
.pz-done{width:min(86%,360px);border-radius:10px;border:5px solid #fff;box-shadow:0 18px 34px -14px rgba(0,0,0,.75);display:block}
.pz-score{font:800 clamp(2.6rem,14vw,4rem) Sora,sans-serif;line-height:1;color:#ffd27f;text-shadow:0 0 30px rgba(255,190,85,.5)}
.pz-stars{display:flex;gap:6px;justify-content:center}
.pz-stars svg{width:40px;height:40px}
.pz-stars svg.on{animation:pzStar .5s cubic-bezier(.3,1.6,.5,1) backwards}
@keyframes pzStar{from{transform:scale(0) rotate(-40deg)}}
.pz-sum{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.pz-sum span{background:rgba(255,255,255,.1);border-radius:12px;padding:8px 12px;font-size:.85rem}
.pz-sum b{display:block;font-size:1.1rem}
.pz-info{width:100%;background:rgba(255,190,85,.1);border:1px solid rgba(255,190,85,.4);border-radius:14px;padding:12px 14px;text-align:left;font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:.92rem;line-height:1.45;white-space:pre-line}
.pz-info b{display:block;font:700 .7rem Sora,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#ffd27f;margin-bottom:4px}
.pz-acts{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:4px}
.pz-new{font:800 .8rem Sora,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#2b1300;background:#ffd27f;border-radius:999px;padding:5px 12px;animation:pzBeat 1.2s ease-in-out infinite}
.pz-toast{position:absolute;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:rgba(10,4,22,.85);padding:10px 16px;border-radius:999px;font-size:.88rem;white-space:nowrap;z-index:999}
.pz-conf{position:absolute;inset:0;pointer-events:none;z-index:998}
@media (prefers-reduced-motion:reduce){.pz-pic canvas,.pz.low .pz-clock span,.pz.low::after,.pz-new{animation:none}.pz-pc.fly,.pz-pc.snap{transition:none}}
`;
const STAR = on => `<svg viewBox="0 0 24 24" class="${on ? "on" : ""}"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" fill="${on ? "#ffd27f" : "rgba(255,255,255,.18)"}" stroke="${on ? "#fff3c4" : "rgba(255,255,255,.3)"}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const EYE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;

/**
 * o: { root, cfg (an experience: slug, title, img {w, h}, rompecabezas), image (url of the picture),
 *      brand: {src, own, href} | null, url (to share), onClick(id), embedded (the maker's preview: nothing saved, counted or shared) }
 * returns { update(cfg, brand, image), destroy() }
 */
export function run(o) {
  if (!document.getElementById("pz-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "pz-css", textContent: CSS }));
  let cfg = o.cfg, brand = o.brand, image = o.image, state = "intro", timers = [], raf = 0, pic = null, picSrc = "";
  const KEY = "vvr-rompecabezas-" + (cfg.slug || "x");
  const D = () => cfg.rompecabezas || {};
  const el = document.createElement("div"); el.className = "pz"; o.root.appendChild(el);
  const later = (f, ms) => { const t = setTimeout(f, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); };
  const count = id => { if (!o.embedded && o.onClick) o.onClick(id); };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = () => Math.min(2, devicePixelRatio || 1);
  let best = 0; if (!o.embedded) try { best = Number(JSON.parse(localStorage.getItem(KEY) || "{}").best) || 0; } catch {}
  function paint() { const c = hexOk(D().color, "#8b3fd6"); el.style.setProperty("--pz-c2", mix(c, "#0b0418", .55)); }
  const logoHtml = () => brand ? `<img class="pz-logo${brand.own ? " own" : ""}" src="${esc(brand.src)}" alt="">` : `<span style="height:24px;margin-top:calc(16px + env(safe-area-inset-top,0px))"></span>`;
  const name = () => D().name || cfg.title || "Rompecabezas";
  const level = () => LEVELS[D().level] ? D().level : "normal";
  const timeOf = () => TIMES.includes(Number(D().time)) ? Number(D().time) : 120;
  // with the clock or without it: whoever plays chooses (it starts as the maker left it)
  let withTime = Number(D().time) > 0;
  const loadPic = () => {
    if (pic && picSrc === image) return Promise.resolve(pic);
    return new Promise((ok, bad) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { pic = im; picSrc = image; ok(im); }; im.onerror = bad; im.src = image; });
  };

  // ---------- intro ----------
  function intro() {
    clearTimers(); state = "intro"; el.classList.remove("low"); paint(); G = null;
    const d = D(), lv = LEVELS[level()], t = timeOf();
    el.innerHTML = `<div class="pz-scr">${logoHtml()}<div class="pz-card0">
      <div class="pz-pic"><img src="${esc(image)}" alt="" draggable="false"></div>
      <h1>${esc(name())}</h1>${d.sub ? `<p>${esc(d.sub)}</p>` : ""}
      <div class="pz-tog" role="group" aria-label="Tiempo"><button type="button" data-tm="1" aria-pressed="${withTime}">Con tiempo · ${t >= 120 ? t / 60 + " min" : t + " s"}</button><button type="button" data-tm="0" aria-pressed="${!withTime}">Sin tiempo</button></div>
      <div class="pz-rules"><span>${lv.n} piezas</span><span>${lv.t}</span></div>
      <p style="font-size:.88rem">Arrastra cada pieza a su lugar.</p>
      <button class="pz-btn" type="button" data-go>¡Jugar!</button>${best ? `<span class="pz-best">Tu récord: ${best.toLocaleString("es-MX")} puntos</span>` : ""}</div></div>`;
    el.querySelector("[data-go]").onclick = () => { sfx.tap(); count("play"); play(); };
    el.querySelectorAll("[data-tm]").forEach(b => b.onclick = () => { withTime = b.dataset.tm === "1"; sfx.tap(); el.querySelectorAll("[data-tm]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
    // a piece of the picture floats out of it
    loadPic().then(im => {
      const box = el.querySelector(".pz-pic"); if (!box || state !== "intro") return;
      const W = box.clientWidth - 10, H = W * im.naturalHeight / im.naturalWidth, T = Math.min(W, H) / 3.2, m = T * .3, c = document.createElement("canvas"), k = dpr();
      c.width = (T + 2 * m) * k; c.height = (T + 2 * m) * k; c.style.width = T + 2 * m + "px"; c.style.right = -m * .6 + "px"; c.style.top = 5 + H * .3 - m + "px";
      const x = c.getContext("2d"); x.scale(k, k); const p = new Path2D(); p.moveTo(m, m);
      side(p, m, m, m + T, m, 1, T); side(p, m + T, m, m + T, m + T, -1, T); side(p, m + T, m + T, m, m + T, 1, T); side(p, m, m + T, m, m, 1, T); p.closePath();
      x.save(); x.clip(p); x.drawImage(im, -(W - T) + m, -H * .3 + m, W, H); x.restore(); x.strokeStyle = "rgba(255,255,255,.8)"; x.lineWidth = 2; x.stroke(p);
      box.appendChild(c);
    }).catch(() => {});
  }

  // ---------- the game ----------
  let G = null, drag = null, zTop = 10;
  const hitCtx = document.createElement("canvas").getContext("2d");
  function geometry() {
    const area = el.querySelector(".pz-area"); if (!area || !G) return null;
    const W = area.clientWidth, H = area.clientHeight, aspect = G.aspect, wide = W / H > 1.15;
    let bw, bh, bx, by, tray;
    if (wide) {
      bw = Math.min(W * .58, (H - 28) * aspect); bh = bw / aspect; bx = 14; by = (H - bh) / 2;
      tray = { x: bx + bw + 16, y: 8, w: W - (bx + bw + 16) - 8, h: H - 16 };
    } else {
      bw = Math.min(W - 28, H * .55 * aspect); bh = bw / aspect; bx = (W - bw) / 2; by = 12;
      tray = { x: 8, y: by + bh + 16, w: W - 16, h: H - (by + bh + 16) - 6 };
    }
    const cw = bw / G.cols, ch = bh / G.rows, T = Math.min(cw, ch), m = T * .26;
    return { W, H, bw, bh, bx, by, cw, ch, T, m, tray };
  }
  function play() {
    clearTimers(); paint(); state = "peek";
    loadPic().then(start).catch(() => { el.innerHTML = `<div class="pz-scr"><div class="pz-card0"><h1>No se pudo abrir la imagen</h1><p>Revisa tu conexión y vuelve a intentar.</p><button class="pz-btn" type="button" data-go>Intentar de nuevo</button></div></div>`; el.querySelector("[data-go]").onclick = play; });
  }
  function start(im) {
    const lv = LEVELS[level()], aspect = im.naturalWidth / im.naturalHeight, { cols, rows } = gridFor(aspect, lv.n), time = withTime ? timeOf() : 0;
    // the tabs: each inner side a knob out or in, new every game
    const rs = () => Math.random() < .5 ? 1 : -1, Hs = [], Vs = [];
    for (let r = 0; r < rows; r++) { Hs.push([]); Vs.push([]); for (let c = 0; c < cols; c++) { Hs[r].push(r ? rs() : 0); Vs[r].push(c ? rs() : 0); } }
    const pieces = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      pieces.push({ c, r, gx: c, gy: r, ok: false, sides: [-Hs[r][c], c + 1 < cols ? Vs[r][c + 1] : 0, r + 1 < rows ? Hs[r + 1][c] : 0, -Vs[r][c]] });
    G = { cols, rows, aspect, pieces, total: pieces.length, placed: 0, moves: 0, score: 0, time, left: time, used: 0, won: false, lastSec: -1, lastOk: 0, ghost: !!lv.ghost };
    el.innerHTML = `<div class="pz-scr"><div class="pz-top"><span class="pz-pill">Piezas <b data-n>0</b>/${G.total}</span>
      <div class="pz-clock"><svg viewBox="0 0 60 60"><circle class="bg" cx="30" cy="30" r="26"/><circle class="fg" cx="30" cy="30" r="26" stroke-dasharray="163.4" stroke-dashoffset="0"/></svg><span data-t>${time ? fmt(time) : "0"}</span></div>
      <span class="pz-pill">Puntos <b data-score>0</b></span></div>
      <div class="pz-area"><div class="pz-board peek"><canvas class="bgc"></canvas><canvas class="full"></canvas></div></div>
      <div class="pz-bar"><button class="pz-eye" type="button" data-eye>${EYE}Ver la imagen</button></div></div>`;
    const area = el.querySelector(".pz-area");
    for (const p of pieces) { p.el = document.createElement("canvas"); p.el.className = "pz-pc"; area.appendChild(p.el); }
    layout();
    area.addEventListener("pointerdown", down); area.addEventListener("pointermove", move); area.addEventListener("pointerup", up); area.addEventListener("pointercancel", up);
    const eye = el.querySelector("[data-eye]"), board = el.querySelector(".pz-board");
    const peekOn = () => { if (state === "play") board.classList.add("peek"); }, peekOff = () => { if (state === "play") board.classList.remove("peek"); };
    eye.addEventListener("pointerdown", e => { e.preventDefault(); peekOn(); sfx.pop(); }); eye.addEventListener("pointerup", peekOff); eye.addEventListener("pointerleave", peekOff); eye.addEventListener("pointercancel", peekOff);
    eye.addEventListener("click", () => { if (state !== "play" || board.classList.contains("peek")) return; peekOn(); later(peekOff, 1500); });
    // 3-2-1 with the picture whole on the board; then the pieces jump to the tray
    const me = G;
    [3, 2, 1].forEach((n, k) => later(() => { if (G !== me) return; sfx.count(); big(String(n)); }, 200 + k * 700));
    later(() => { if (G !== me) return; scatter(); board.classList.remove("peek"); sfx.whoosh(.6); }, 2200);
    later(() => { if (G !== me) return; sfx.go(); big("¡Ya!"); for (const p of G.pieces) p.el.classList.remove("fly"); state = "play"; G.t0 = performance.now(); tick(); }, 2950);
  }
  const fmt = s => s >= 60 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : String(Math.ceil(s));
  function big(t, cls = "") { if (cls) el.querySelectorAll(".pz-big.s").forEach(x => x.remove()); const s = Object.assign(document.createElement("div"), { className: "pz-big " + cls, innerHTML: t }); el.appendChild(s); later(() => s.remove(), cls ? 1500 : 760); }
  // draws the board and every piece for the current size (they keep their places, in cells of the board)
  function layout() {
    const g = geometry(); if (!g) return; G.g = g; const k = dpr(), im = pic;
    const board = el.querySelector(".pz-board"); Object.assign(board.style, { left: g.bx + "px", top: g.by + "px", width: g.bw + "px", height: g.bh + "px" });
    const bg = board.querySelector(".bgc"), full = board.querySelector(".full");
    for (const c of [bg, full]) { c.width = Math.round(g.bw * k); c.height = Math.round(g.bh * k); }
    const x = bg.getContext("2d"); x.scale(k, k);
    if (G.ghost) { x.globalAlpha = .22; x.drawImage(im, 0, 0, g.bw, g.bh); x.globalAlpha = 1; }
    x.strokeStyle = "rgba(255,255,255,.22)"; x.lineWidth = 1; x.setLineDash([4, 4]); x.beginPath();
    for (let c = 1; c < G.cols; c++) { x.moveTo(c * g.cw, 0); x.lineTo(c * g.cw, g.bh); }
    for (let r = 1; r < G.rows; r++) { x.moveTo(0, r * g.ch); x.lineTo(g.bw, r * g.ch); }
    x.stroke();
    const f = full.getContext("2d"); f.scale(k, k); f.drawImage(im, 0, 0, g.bw, g.bh);
    for (const p of G.pieces) {
      const w = g.cw + 2 * g.m, h = g.ch + 2 * g.m, c = p.el; c.width = Math.round(w * k); c.height = Math.round(h * k); c.style.width = w + "px"; c.style.height = h + "px";
      const path = new Path2D(), m = g.m, [t, rr, b, l] = p.sides; path.moveTo(m, m);
      side(path, m, m, m + g.cw, m, t, g.T); side(path, m + g.cw, m, m + g.cw, m + g.ch, rr, g.T); side(path, m + g.cw, m + g.ch, m, m + g.ch, b, g.T); side(path, m, m + g.ch, m, m, l, g.T); path.closePath();
      p.path = path;
      const x2 = c.getContext("2d"); x2.scale(k, k); x2.save(); x2.clip(path); x2.drawImage(im, -p.c * g.cw + m, -p.r * g.ch + m, g.bw, g.bh); x2.restore();
      x2.lineWidth = 1.4; x2.strokeStyle = p.ok ? "rgba(255,255,255,0)" : "rgba(255,255,255,.75)"; x2.stroke(path);
      x2.lineWidth = .8; x2.strokeStyle = p.ok ? "rgba(0,0,0,.12)" : "rgba(0,0,0,.35)"; x2.stroke(path);
      place(p);
    }
  }
  const place = p => { const g = G.g; p.el.style.transform = `translate(${g.bx + p.gx * g.cw - g.m}px,${g.by + p.gy * g.ch - g.m}px)`; p.el.style.zIndex = p.ok ? 1 : p.z || 10; };
  // the pieces jump from the board to random places of the tray (or anywhere outside the board if the tray is too small)
  function scatter() {
    const g = G.g, pw = g.cw, ph = g.ch, t = g.tray, roomy = t.w >= pw + 4 && t.h >= ph + 4;
    const order = G.pieces.slice().sort(() => Math.random() - .5);
    // spread evenly: one slot of a grid over the tray for each piece, a little off its center
    const R = roomy ? { x: t.x + g.m, y: t.y + g.m, w: Math.max(1, t.w - pw - 2 * g.m), h: Math.max(1, t.h - ph - 2 * g.m) } : { x: g.m, y: g.m, w: g.W - pw - 2 * g.m, h: g.H - ph - 2 * g.m };
    const n = order.length, sc = Math.max(1, Math.round(Math.sqrt(n * (R.w + pw) / (R.h + ph)))), sr = Math.ceil(n / sc);
    order.forEach((p, i) => {
      const cx = (i % sc + .5 + (Math.random() - .5) * .5) / sc, cy = (Math.floor(i / sc) + .5 + (Math.random() - .5) * .5) / sr;
      const x = R.x + Math.max(0, Math.min(1, sc > 1 ? (cx - .5 / sc) / (1 - 1 / sc) : .5)) * R.w, y = R.y + Math.max(0, Math.min(1, sr > 1 ? (cy - .5 / sr) / (1 - 1 / sr) : .5)) * R.h;
      p.gx = (x - g.bx) / g.cw; p.gy = (y - g.by) / g.ch; p.z = 10 + i; p.el.classList.add("fly");
      p.el.style.transitionDelay = reduced ? "0ms" : i * 18 + "ms"; place(p);
    });
    zTop = 10 + order.length;
    later(() => G && G.pieces.forEach(p => { p.el.style.transitionDelay = ""; }), 900);
  }
  function tick() {
    if (state !== "play") return;
    const t = (performance.now() - G.t0) / 1000, fg = el.querySelector(".pz-clock .fg"), tx = el.querySelector("[data-t]"); G.used = t;
    if (!G.time) { const s = Math.floor(t); if (s !== G.lastSec) { G.lastSec = s; if (tx) tx.textContent = fmt(s); } raf = requestAnimationFrame(tick); return; }
    const left = Math.max(0, G.time - t), s = Math.ceil(left); G.left = left;
    if (fg) fg.style.strokeDashoffset = String(163.4 * (1 - left / G.time));
    if (s !== G.lastSec) { G.lastSec = s; if (tx) tx.textContent = fmt(s); if (s <= 5 && s > 0) { el.classList.add("low"); sfx.tick(1.4); if (navigator.vibrate && !o.embedded) try { navigator.vibrate(25); } catch {} } }
    if (left <= 0) { end(false); return; }
    raf = requestAnimationFrame(tick);
  }

  // ---------- dragging ----------
  function pick(e) {
    const r = el.querySelector(".pz-area").getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, g = G.g;
    const loose = G.pieces.filter(p => !p.ok).sort((a, b) => (b.z || 0) - (a.z || 0));
    for (const p of loose) { const lx = x - (g.bx + p.gx * g.cw - g.m), ly = y - (g.by + p.gy * g.ch - g.m); if (lx >= 0 && ly >= 0 && lx <= g.cw + 2 * g.m && ly <= g.ch + 2 * g.m && hitCtx.isPointInPath(p.path, lx, ly)) return { p, x, y }; }
    // a little slack on a phone: the nearest piece under the finger
    let best = null, bd = g.T * .35;
    for (const p of loose) { const cx = g.bx + (p.gx + .5) * g.cw, cy = g.by + (p.gy + .5) * g.ch, d = Math.hypot(x - cx, y - cy) - Math.min(g.cw, g.ch) / 2; if (d < bd) { bd = d; best = p; } }
    return best ? { p: best, x, y } : null;
  }
  function down(e) {
    if (state !== "play" || drag) return;
    const h = pick(e); if (!h) return; e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    drag = { p: h.p, id: e.pointerId, x: h.x, y: h.y, gx: h.p.gx, gy: h.p.gy };
    h.p.z = ++zTop; h.p.el.classList.add("lift"); h.p.el.classList.remove("snap"); place(h.p); sfx.pop();
  }
  function move(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const r = el.querySelector(".pz-area").getBoundingClientRect(), g = G.g, p = drag.p;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    p.gx = Math.max(-g.bx / g.cw, Math.min((g.W - g.bx - g.cw) / g.cw, drag.gx + (x - drag.x) / g.cw));
    p.gy = Math.max(-g.by / g.ch, Math.min((g.H - g.by - g.ch) / g.ch, drag.gy + (y - drag.y) / g.ch));
    place(p);
  }
  function up(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const p = drag.p, movedIt = Math.hypot(p.gx - drag.gx, p.gy - drag.gy) > .05; drag = null; p.el.classList.remove("lift");
    if (state !== "play") return;
    if (movedIt) G.moves++;
    if (Math.hypot(p.gx - p.c, p.gy - p.r) < .3) { snapIn(p); return; }
    if (movedIt) sfx.swoosh();
  }
  function snapIn(p) {
    p.ok = true; p.gx = p.c; p.gy = p.r; p.el.classList.add("snap", "ok"); place(p);
    // redraw without the white edge, so the picture closes up
    const g = G.g, k = dpr(), x2 = p.el.getContext("2d"); x2.setTransform(k, 0, 0, k, 0, 0); x2.clearRect(0, 0, p.el.width, p.el.height);
    x2.save(); x2.clip(p.path); x2.drawImage(pic, -p.c * g.cw + g.m, -p.r * g.ch + g.m, g.bw, g.bh); x2.restore(); x2.lineWidth = .8; x2.strokeStyle = "rgba(0,0,0,.12)"; x2.stroke(p.path);
    G.placed++; const now = performance.now(), quick = G.lastOk && now - G.lastOk < 4000; G.lastOk = now;
    const pts = 50 + (quick ? 25 : 0); G.score += pts;
    el.querySelector("[data-n]").textContent = G.placed; el.querySelector("[data-score]").textContent = G.score.toLocaleString("es-MX");
    sfx.correct(); sfx.sparkle(quick ? 5 : 2); burst(p);
    if (navigator.vibrate && !o.embedded) try { navigator.vibrate(12); } catch {}
    if (G.placed === G.total) {
      state = "won"; cancelAnimationFrame(raf); el.classList.remove("low");
      el.querySelector(".pz-board").classList.add("done"); sfx.sparkle(8);
      later(() => end(true), 1300);
    }
  }
  function burst(p) {
    if (reduced) return;
    const g = G.g, cx = g.bx + (p.c + .5) * g.cw, cy = g.by + (p.r + .5) * g.ch, area = el.querySelector(".pz-area");
    for (let k = 0; k < 10; k++) {
      const s = document.createElement("i"), a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 50;
      s.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:8px;height:8px;border-radius:2px;background:${["#ffd27f", "#6ff0b2", "#fff", "#ff8fb1"][k % 4]};pointer-events:none;transition:transform .6s cubic-bezier(.2,.8,.3,1),opacity .6s;transform:translate(-50%,-50%) rotate(45deg);z-index:900`;
      area.appendChild(s); requestAnimationFrame(() => { s.style.transform = `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d}px)) rotate(${200 + Math.random() * 300}deg) scale(.5)`; s.style.opacity = "0"; });
      later(() => s.remove(), 700);
    }
  }

  // ---------- the end ----------
  function end(won) {
    if (state === "over") return;
    state = "over"; cancelAnimationFrame(raf); el.classList.remove("low"); drag = null;
    G.won = won; const secs = G.time ? Math.ceil(G.left) : 0, bonus = won ? secs * 5 : 0; G.score += bonus;
    const d = D(), st = starsFor(G), rec = !o.embedded && G.score > best && G.score > 0;
    if (rec) { best = G.score; try { localStorage.setItem(KEY, JSON.stringify({ best })); } catch {} }
    if (won) count("win");
    const usedT = Math.round(G.used || 0);
    el.innerHTML = `<div class="pz-scr">${logoHtml()}<div class="pz-card0">
      <span class="pz-k">${esc(name())}</span><h1>${won ? (st === 3 ? "¡Qué rapidez!" : "¡Lo armaste!") : "¡Se acabó el tiempo!"}</h1>
      <img class="pz-done" src="${esc(image)}" alt="">
      <div class="pz-stars">${[0, 1, 2].map(i => STAR(i < st)).join("")}</div>
      <div class="pz-score" data-sc>0</div><span style="margin-top:-6px;color:rgba(255,255,255,.7);font-size:.85rem">puntos</span>
      ${rec ? `<span class="pz-new">¡Nuevo récord!</span>` : best ? `<span class="pz-best">Tu récord: ${best.toLocaleString("es-MX")}</span>` : ""}
      <div class="pz-sum"><span><b>${G.placed}/${G.total}</b>piezas</span><span><b>${won ? fmt(usedT) + (usedT < 60 ? " s" : "") : "—"}</b>tiempo</span><span><b>${G.moves}</b>movimientos</span>${won && bonus ? `<span><b>+${bonus}</b>por rapidez</span>` : ""}</div>
      ${d.info ? `<div class="pz-info"><b>¿Sabías que…?</b>${esc(d.info)}</div>` : ""}
      <div class="pz-acts"><button class="pz-btn" type="button" data-again>Jugar otra vez</button><button class="pz-btn g" type="button" data-share>Retar a alguien</button></div></div></div>`;
    const sc = el.querySelector("[data-sc]"), t0 = performance.now(), dur = Math.min(1400, 300 + G.score / 2);
    const upd = () => { const k = Math.min(1, (performance.now() - t0) / dur); sc.textContent = Math.round(G.score * (1 - (1 - k) ** 3)).toLocaleString("es-MX"); if (k < 1) raf = requestAnimationFrame(upd); };
    upd();
    later(() => { if (won) { sfx.win(); confetti(); } else if (st) sfx.sparkle(5); else sfx.lose(); }, 200);
    el.querySelector("[data-again]").onclick = () => { sfx.tap(); count("play"); play(); };
    el.querySelector("[data-share]").onclick = () => { sfx.tap(); count("share"); share(won, usedT); };
  }
  function confetti() {
    if (reduced) return;
    const c = Object.assign(document.createElement("canvas"), { className: "pz-conf" }); el.appendChild(c);
    const W = c.width = el.clientWidth * (devicePixelRatio || 1), H = c.height = el.clientHeight * (devicePixelRatio || 1), g = c.getContext("2d");
    const cols = ["#ffd27f", "#ff8fb1", "#6ff0b2", "#6fc8ff", "#c99bff", hexOk(D().color, "#8b3fd6")];
    const ps = Array.from({ length: 140 }, () => ({ x: W * Math.random(), y: -H * Math.random() * .6, vx: (Math.random() - .5) * W * .004, vy: H * (.004 + Math.random() * .006), r: Math.random() * 6, vr: (Math.random() - .5) * .3, s: (6 + Math.random() * 8) * (devicePixelRatio || 1), c: cols[Math.floor(Math.random() * cols.length)] }));
    const t0 = performance.now();
    const fr = () => { if (!c.isConnected) return; const k = (performance.now() - t0) / 3200; g.clearRect(0, 0, W, H);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - k * k); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
      if (k < 1) requestAnimationFrame(fr); else c.remove(); };
    fr();
  }
  function toast(t) { const s = Object.assign(document.createElement("div"), { className: "pz-toast", textContent: t }); el.appendChild(s); later(() => s.remove(), 1900); }
  async function share(won, secs) {
    if (o.embedded) { toast("Así retarán a sus amigos"); return; }
    const text = won ? `¡Armé el rompecabezas "${name()}" de ${G.total} piezas en ${fmt(secs)}${secs < 60 ? " segundos" : ""} e hice ${G.score.toLocaleString("es-MX")} puntos! ¿Me ganas?` : `Puse ${G.placed} de ${G.total} piezas del rompecabezas "${name()}". ¿Tú lo terminas?`;
    try { if (navigator.share) { await navigator.share({ title: name(), text, url: o.url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text + " " + o.url); toast("Copiado: pégalo donde quieras"); } catch { toast(o.url); }
  }

  const ro = new ResizeObserver(() => { if (G && G.g && (state === "play" || state === "peek")) layout(); }); ro.observe(el);
  intro();
  return {
    update(c, b, img) { cfg = c; withTime = Number(D().time) !== 0; brand = b === undefined ? brand : b; if (img) image = img; intro(); },
    destroy() { clearTimers(); ro.disconnect(); el.remove(); },
  };
}
