// "Dispara y gana" (data.kind = "dispara"): un juego 360 con la cámara. Lo usan el visor (/x/) y la vista previa del creador
// (/crear/dispara/).
//  - Las cosas vuelan alrededor de quien juega (adelante, a los lados y atrás). Se gira con el celular (giroscopio, sin
//    WebXR: funciona en iPhone y Android) o, sin giroscopio (computadora, vista previa), arrastrando. Se dispara tocando
//    la pantalla: le pega a lo que está en la mira (o a lo que se tocó).
//  - Malos = +10 (×2 después de 3 seguidos, ×3 después de 6), buenos = −15, dorado = +50. Fallar un tiro rompe el combo.
//    Flechas en la orilla señalan los malos que no se ven. Al final: puntos, estrellas y récord del celular.
//  - Opcional: premio (cupón con código como el de la ruleta) si se llega a prize.min puntos, y un link con mensaje
//    (reseña, Instagram…) aparte, que no condiciona nada.
//  - La cámara de fondo es un <video> detrás del canvas (no se graba nada). Sin cámara: un cielo morado con estrellas.
//  - onClick(id) cuenta en el servidor: "play", "win", "save", "share", "link".
// cfg = { slug, title, dispara: {name, sub, time, speed, color, objs: [{id, role, key | img}], prize: {min, t, days, cond, limit}, link: {url, t, msg}} }.
// Cada objeto es "key" (un dibujo de SPRITES) o "img" (el id de una imagen subida, src(id) da su URL).
import * as THREE from "three";
import { sfx } from "./sonidos.js";

export const TIMES = [20, 30, 45, 60];
export const SPEEDS = { lento: { t: "Tranquilo", k: .7, life: 6.5 }, normal: { t: "Normal", k: 1, life: 5.5 }, rapido: { t: "Rápido", k: 1.45, life: 4.4 } };
export const LIMITS = { una: "Una vez por persona", dia: "Una vez al día", libre: "Sin límite" };
export const ROLES = { malo: { max: 4, pts: 10 }, bueno: { max: 3, pts: -15 }, dorado: { max: 1, pts: 50 } };

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hexOk = (v, d) => /^#[0-9a-f]{6}$/i.test(v || "") ? v.toLowerCase() : d;
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lum = hex => { const c = rgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const onAccent = hex => lum(hex) > .42 ? "#16151a" : "#ffffff";
const ART = n => new URL(`./filtros/particula-${n}.webp`, import.meta.url).href;

// ---------- the ready-made characters: drawn in code (the same on every phone) or the filters' art ----------
function eyes(x, cx, cy, s, mood) {   // mood: "malo" (angry), "bueno" (happy), "susto"
  for (const d of [-1, 1]) {
    x.fillStyle = "#fff"; x.beginPath(); x.ellipse(cx + d * s * .42, cy, s * .26, s * .3, 0, 0, 7); x.fill();
    x.fillStyle = "#16101f"; x.beginPath(); x.arc(cx + d * s * .42 + (mood === "malo" ? -d * s * .05 : 0), cy + s * .06, s * .13, 0, 7); x.fill();
    x.fillStyle = "#fff"; x.beginPath(); x.arc(cx + d * s * .42 - s * .04, cy + s * .01, s * .045, 0, 7); x.fill();
    if (mood === "malo") { x.strokeStyle = "#16101f"; x.lineWidth = s * .11; x.lineCap = "round"; x.beginPath(); x.moveTo(cx + d * s * .18, cy - s * .22); x.lineTo(cx + d * s * .66, cy - s * .4); x.stroke(); }
  }
}
function mouth(x, cx, cy, s, mood) {
  x.strokeStyle = "#16101f"; x.lineWidth = s * .09; x.lineCap = "round"; x.beginPath();
  if (mood === "bueno") x.arc(cx, cy - s * .12, s * .3, .2 * Math.PI, .8 * Math.PI);
  else if (mood === "susto") { x.fillStyle = "#16101f"; x.ellipse(cx, cy, s * .14, s * .19, 0, 0, 7); x.fill(); return; }
  else { x.moveTo(cx - s * .3, cy + s * .06); x.quadraticCurveTo(cx, cy - s * .16, cx + s * .3, cy + s * .06); }
  x.stroke();
  if (mood === "malo") { x.fillStyle = "#fff"; for (const d of [-1, 1]) { x.beginPath(); x.moveTo(cx + d * s * .2, cy - s * .02); x.lineTo(cx + d * s * .12, cy + s * .14); x.lineTo(cx + d * s * .04, cy - s * .06); x.fill(); } }
}
const shine = (x, cx, cy, r) => { const g = x.createRadialGradient(cx - r * .35, cy - r * .4, r * .05, cx, cy, r); g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(.35, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,.25)"); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
const DRAW = {
  monstruo(x) {
    x.fillStyle = "#ffbe55"; for (const d of [-1, 1]) { x.beginPath(); x.moveTo(128 + d * 40, 70); x.lineTo(128 + d * 78, 14); x.lineTo(128 + d * 80, 80); x.fill(); }
    x.fillStyle = "#8b3fd6"; x.beginPath(); x.moveTo(40, 230); x.bezierCurveTo(10, 120, 50, 52, 128, 52); x.bezierCurveTo(206, 52, 246, 120, 216, 230);
    for (let i = 0; i < 5; i++) x.quadraticCurveTo(216 - i * 35.2 - 17.6, 200, 216 - (i + 1) * 35.2, 230); x.fill();
    shine(x, 128, 140, 96); eyes(x, 128, 120, 80, "malo"); mouth(x, 128, 178, 80, "malo");
  },
  virus(x) {
    x.strokeStyle = "#1f9e57"; x.lineWidth = 12; x.fillStyle = "#56e08f";
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, c = Math.cos(a), s = Math.sin(a); x.beginPath(); x.moveTo(128 + c * 70, 128 + s * 70); x.lineTo(128 + c * 108, 128 + s * 108); x.stroke(); x.beginPath(); x.arc(128 + c * 110, 128 + s * 110, 14, 0, 7); x.fill(); }
    x.fillStyle = "#3cc977"; x.beginPath(); x.arc(128, 128, 80, 0, 7); x.fill();
    x.fillStyle = "rgba(20,110,60,.35)"; for (const [a, b, r] of [[90, 90, 12], [170, 160, 9], [100, 180, 8]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
    shine(x, 128, 128, 80); eyes(x, 128, 118, 64, "malo"); mouth(x, 128, 162, 64, "malo");
  },
  asteroide(x) {
    x.fillStyle = "#8a8496"; x.beginPath();
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = 92 + [8, -10, 12, -4, 6, -12, 10, -6, 4, -8, 12, -2, 6, -10][i]; x.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); }
    x.fill(); x.fillStyle = "#6c6678"; for (const [a, b, r] of [[80, 80, 16], [180, 96, 12], [170, 180, 18], [80, 176, 10]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
    shine(x, 128, 128, 100); eyes(x, 128, 118, 66, "malo"); mouth(x, 128, 162, 66, "malo");
  },
  ovni(x) {
    x.fillStyle = "rgba(150,240,255,.85)"; x.beginPath(); x.arc(128, 112, 54, Math.PI, 0); x.fill();
    x.fillStyle = "#6be07a"; x.beginPath(); x.arc(128, 116, 30, Math.PI, 0); x.fill(); eyes(x, 128, 98, 30, "malo");
    const g = x.createLinearGradient(0, 100, 0, 170); g.addColorStop(0, "#d9d4e6"); g.addColorStop(1, "#6f6886"); x.fillStyle = g; x.beginPath(); x.ellipse(128, 136, 116, 36, 0, 0, 7); x.fill();
    for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? "#ffbe55" : "#ff5c8a"; x.beginPath(); x.arc(40 + i * 35.2, 140 + Math.sin(i / 5 * Math.PI) * 6, 9, 0, 7); x.fill(); }
  },
  bomba(x) {
    x.strokeStyle = "#b07a3a"; x.lineWidth = 9; x.beginPath(); x.moveTo(150, 60); x.quadraticCurveTo(170, 20, 200, 30); x.stroke();
    x.fillStyle = "#ffbe55"; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.beginPath(); x.moveTo(204, 26); x.lineTo(204 + Math.cos(a) * 26, 26 + Math.sin(a) * 26); x.lineTo(204 + Math.cos(a + .3) * 8, 26 + Math.sin(a + .3) * 8); x.fill(); }
    x.fillStyle = "#3a3346"; x.fillRect(132, 52, 30, 26);
    x.fillStyle = "#211b2b"; x.beginPath(); x.arc(128, 146, 92, 0, 7); x.fill(); shine(x, 128, 146, 92); eyes(x, 128, 140, 64, "malo"); mouth(x, 128, 186, 64, "malo");
  },
  carbon(x) {
    x.fillStyle = "#2b2730"; x.beginPath();
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = 96 + (i % 2 ? -14 : 8); x.lineTo(128 + Math.cos(a) * r, 136 + Math.sin(a) * r * .86); }
    x.fill(); x.fillStyle = "rgba(255,255,255,.12)"; x.beginPath(); x.moveTo(70, 100); x.lineTo(110, 70); x.lineTo(100, 110); x.fill();
    eyes(x, 128, 126, 64, "malo"); mouth(x, 128, 172, 64, "malo");
  },
  fantasma(x) {
    x.fillStyle = "#fbf8ff"; x.beginPath(); x.moveTo(44, 236); x.lineTo(44, 120); x.arc(128, 120, 84, Math.PI, 0); x.lineTo(212, 236);
    for (let i = 0; i < 4; i++) x.quadraticCurveTo(212 - i * 42 - 21, 206, 212 - (i + 1) * 42, 236); x.fill();
    x.fillStyle = "rgba(139,63,214,.15)"; x.beginPath(); x.arc(160, 160, 50, 0, 7); x.fill();
    eyes(x, 128, 116, 64, "malo"); mouth(x, 128, 168, 64, "susto");
  },
  regalo(x) {
    x.fillStyle = "#e23d4f"; x.fillRect(40, 96, 176, 140); x.fillStyle = "#ff5c6e"; x.fillRect(30, 80, 196, 40);
    x.fillStyle = "#ffcf4d"; x.fillRect(114, 80, 28, 156); x.fillRect(30, 92, 196, 16);
    x.strokeStyle = "#ffcf4d"; x.lineWidth = 14; for (const d of [-1, 1]) { x.beginPath(); x.ellipse(128 + d * 34, 62, 34, 20, d * .5, 0, 7); x.stroke(); }
    eyes(x, 128, 160, 52, "bueno"); mouth(x, 128, 200, 52, "bueno");
  },
  planeta(x) {
    x.strokeStyle = "#ffd27f"; x.lineWidth = 12; x.beginPath(); x.ellipse(128, 132, 120, 34, -.3, Math.PI * .98, Math.PI * 2.02); x.stroke();
    const g = x.createLinearGradient(60, 60, 200, 200); g.addColorStop(0, "#ffb15c"); g.addColorStop(1, "#ff5c8a"); x.fillStyle = g; x.beginPath(); x.arc(128, 128, 76, 0, 7); x.fill();
    shine(x, 128, 128, 76); eyes(x, 128, 118, 56, "bueno"); mouth(x, 128, 156, 56, "bueno");
    x.strokeStyle = "#ffd27f"; x.beginPath(); x.ellipse(128, 132, 120, 34, -.3, -Math.PI * .02, Math.PI * 1.02); x.stroke();
  },
  moneda(x) {
    x.fillStyle = "#c98a1f"; x.beginPath(); x.arc(132, 132, 100, 0, 7); x.fill();
    const g = x.createRadialGradient(100, 90, 10, 128, 128, 100); g.addColorStop(0, "#fff1c2"); g.addColorStop(.5, "#ffcf4d"); g.addColorStop(1, "#e09a2a"); x.fillStyle = g; x.beginPath(); x.arc(126, 126, 98, 0, 7); x.fill();
    x.strokeStyle = "rgba(160,100,20,.6)"; x.lineWidth = 8; x.beginPath(); x.arc(126, 126, 76, 0, 7); x.stroke();
    x.fillStyle = "#fff6d8"; x.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 22 : 52, a = -Math.PI / 2 + k * Math.PI / 5; x.lineTo(126 + Math.cos(a) * r, 126 + Math.sin(a) * r); } x.fill();
  },
};
// key → {t: name, src (art) | draw}
export const SPRITES = {
  monstruo: { t: "Monstruo" }, virus: { t: "Virus" }, asteroide: { t: "Asteroide" }, ovni: { t: "Ovni" }, bomba: { t: "Bomba" }, carbon: { t: "Carbón" }, fantasma: { t: "Fantasma" },
  calaverita: { t: "Calaverita", src: ART("calaverita") }, regalo: { t: "Regalo" }, planeta: { t: "Planeta" }, cempasuchil: { t: "Cempasúchil", src: ART("cempasuchil") },
  corazon: { t: "Corazón", src: ART("corazon") }, esfera: { t: "Esfera", src: ART("esfera") }, copo: { t: "Copo de nieve", src: ART("copo") },
  estrella: { t: "Estrella", src: ART("estrella") }, moneda: { t: "Moneda" },
};
// the creator's templates: which characters each role gets
export const TEMPLATES = {
  monstruos: { t: "Monstruos", malo: ["monstruo", "virus"], bueno: ["corazon"], dorado: "estrella" },
  muertos: { t: "Día de Muertos", malo: ["calaverita", "fantasma"], bueno: ["cempasuchil"], dorado: "estrella" },
  navidad: { t: "Navidad", malo: ["carbon", "bomba"], bueno: ["regalo", "esfera"], dorado: "estrella" },
  espacio: { t: "Espacio", malo: ["asteroide", "ovni"], bueno: ["planeta"], dorado: "moneda" },
};
const cache = new Map();
// a character as a canvas (or an image) ready for a texture: 256 px, transparent
export function spriteImage(key) {
  if (cache.has(key)) return cache.get(key);
  const S = SPRITES[key]; let p;
  if (!S) p = Promise.resolve(null);
  else if (S.src) p = loadImg(S.src);
  else { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); try { DRAW[key](x); } catch (e) { console.error(e); } p = Promise.resolve(c); }
  cache.set(key, p); return p;
}
function loadImg(s) { return new Promise(ok => { if (!s) return ok(null); const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = s; }); }
export const spriteUrl = key => { const S = SPRITES[key]; if (!S) return ""; if (S.src) return S.src; const c = document.createElement("canvas"); c.width = c.height = 256; DRAW[key](c.getContext("2d")); return c.toDataURL("image/png"); };

const CSS = `
.dp{position:absolute;inset:0;overflow:hidden;background:radial-gradient(120% 80% at 50% 10%,#3a1670 0%,#14072b 55%,#05020b 100%);color:#fff;font-family:"IBM Plex Sans",system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:none}
.dp *{box-sizing:border-box}
.dp [hidden]{display:none!important}
.dp video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dp canvas.gl,.dp canvas.hud{position:absolute;inset:0;width:100%;height:100%;display:block}
.dp-top{position:absolute;left:0;right:0;top:0;padding:calc(12px + env(safe-area-inset-top,0px)) 12px 0;display:grid;grid-template-columns:1fr auto 1fr;align-items:start;gap:8px;pointer-events:none;z-index:2}
.dp-sc{justify-self:start;display:flex;align-items:center;gap:7px;padding:6px 14px 6px 7px;border-radius:999px;background:linear-gradient(135deg,rgba(255,226,154,.95),rgba(255,190,85,.95) 55%,rgba(255,159,58,.95));color:#2a1600;box-shadow:0 6px 20px -6px rgba(255,170,60,.8),inset 0 -2px 0 rgba(0,0,0,.15);transition:background .2s}
.dp-sc svg{width:26px;height:26px;flex:none;fill:#fff;filter:drop-shadow(0 1px 1px rgba(120,60,0,.5))}
.dp-sc b{font:800 1.45rem/1 "Sora",sans-serif;min-width:1.4em;display:inline-block;font-variant-numeric:tabular-nums}
.dp-sc small{font:700 .62rem "Sora",sans-serif;letter-spacing:.14em;opacity:.75}
.dp-sc.bump b{animation:dp-bump .35s cubic-bezier(.2,1.8,.4,1)}
.dp-sc.loss{background:linear-gradient(135deg,#ff9aa8,#ff4d6d);color:#fff}
@keyframes dp-bump{40%{transform:scale(1.45)}}
.dp-tm{position:relative;width:66px;height:66px;display:grid;place-items:center;transition:transform .35s cubic-bezier(.2,1.6,.4,1)}
.dp-tm svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);filter:drop-shadow(0 4px 10px rgba(0,0,0,.45))}
.dp-tm .bg{fill:rgba(10,4,22,.62);stroke:rgba(255,255,255,.18);stroke-width:7}
.dp-tm .fg{fill:none;stroke:url(#dpTg);stroke-width:7;stroke-linecap:round;transition:stroke-dashoffset .12s linear}
.dp-tm b{position:relative;font:800 1.5rem/1 "Sora",sans-serif;font-variant-numeric:tabular-nums;text-shadow:0 2px 6px rgba(0,0,0,.5)}
.dp-goal{justify-self:end;display:flex;flex-direction:column;align-items:flex-end;gap:5px;padding:7px 11px;border-radius:14px;background:rgba(10,4,22,.62);border:1px solid rgba(255,190,85,.5);font:700 .78rem "Sora",sans-serif;color:#ffd27f;max-width:44vw}
.dp-goal span{white-space:nowrap}
.dp-goal i{display:block;width:84px;height:6px;border-radius:99px;background:rgba(255,255,255,.18);overflow:hidden}
.dp-goal i::after{content:"";display:block;height:100%;width:var(--p,0%);background:linear-gradient(90deg,#ffbe55,#ffe29a);transition:width .25s}
.dp-goal.done{border-color:#74e8ba;color:#74e8ba;animation:dp-beat .6s ease-in-out 3}
.dp-goal.done i::after{background:#74e8ba}
/* the last 5 seconds: the clock grows and turns red, the edges of the screen beat in red, each second pops in the middle */
.dp.low .dp-tm{transform:scale(1.5) translateY(6px)}
.dp.low .dp-tm .bg{fill:rgba(120,0,25,.75);stroke:rgba(255,80,110,.5)}
.dp.low .dp-tm .fg{stroke:#ff3b5c}
.dp.low .dp-tm b{color:#fff;animation:dp-beat .5s ease-in-out infinite}
.dp-low{position:absolute;inset:0;pointer-events:none;z-index:1;opacity:0;box-shadow:inset 0 0 0 0 rgba(255,30,60,0);transition:opacity .3s}
.dp.low .dp-low{opacity:1;box-shadow:inset 0 0 60px 18px rgba(255,30,60,.5);animation:dp-edge 1s ease-in-out infinite}
@keyframes dp-edge{0%,100%{box-shadow:inset 0 0 40px 10px rgba(255,30,60,.35)}50%{box-shadow:inset 0 0 90px 30px rgba(255,30,60,.7)}}
.dp-cd{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);font:800 clamp(5rem,30vw,9rem)/1 "Sora",sans-serif;color:#ff4d6d;text-shadow:0 0 40px rgba(255,40,70,.8);pointer-events:none;z-index:1;opacity:0}
.dp-cd.go{animation:dp-cd .9s ease-out both}
@keyframes dp-cd{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}20%{opacity:.85;transform:translate(-50%,-50%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}}
.dp-combo{position:absolute;top:calc(48px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%) scale(0);font:800 1.1rem "Sora",sans-serif;color:#2a1600;background:linear-gradient(135deg,#ffe29a,#ffbe55);padding:5px 14px;border-radius:99px;transition:transform .25s cubic-bezier(.2,1.6,.4,1);z-index:2;pointer-events:none}
.dp-combo.on{transform:translateX(-50%) scale(1)}
.dp-aim{position:absolute;left:50%;top:50%;width:72px;height:72px;margin:-36px 0 0 -36px;pointer-events:none;z-index:2;transition:transform .12s;filter:drop-shadow(0 0 6px rgba(0,0,0,.6))}
.dp-aim.fire{transform:scale(.78) rotate(45deg)}
.dp-aim.hit svg circle,.dp-aim.hit svg path{stroke:#ffd27f}
.dp-aim.on svg circle{stroke:#ffd27f}
.dp-hint{position:absolute;left:50%;bottom:calc(26px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:rgba(10,4,22,.72);padding:9px 16px;border-radius:99px;font:600 .9rem "Sora",sans-serif;white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis;pointer-events:none;opacity:0;transition:opacity .3s;z-index:2}
.dp-hint.on{opacity:1}
.dp-flash{position:absolute;inset:0;pointer-events:none;z-index:3;opacity:0;background:radial-gradient(closest-side,transparent 55%,rgba(255,40,70,.6));transition:opacity .35s}
.dp-flash.on{opacity:1;transition:none}
.dp-big{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);font:800 clamp(3.4rem,20vw,6rem)/1 "Sora",sans-serif;color:#ffd27f;text-shadow:0 0 40px rgba(255,190,85,.7);pointer-events:none;z-index:4;text-align:center;white-space:nowrap}
.dp-big.pop{animation:dp-pop .7s cubic-bezier(.2,1.4,.4,1) both}
.dp-big small{display:block;font-size:.3em;letter-spacing:.12em;color:#fff;margin-top:10px}
@keyframes dp-pop{from{opacity:0;transform:translate(-50%,-50%) scale(.4)}}
@keyframes dp-beat{50%{transform:scale(1.15)}}
.dp.shake{animation:dp-shake .35s}
@keyframes dp-shake{20%{transform:translate(-8px,3px)}40%{transform:translate(7px,-4px)}60%{transform:translate(-5px,2px)}80%{transform:translate(3px,-1px)}}
.dp-ov{position:absolute;inset:0;z-index:6;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;background:linear-gradient(180deg,rgba(20,7,43,.86),rgba(5,2,11,.94));backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);animation:dp-fade .35s both;user-select:text;-webkit-user-select:text}
@keyframes dp-fade{from{opacity:0}}
.dp-in{min-height:100%;max-width:440px;margin:0 auto;padding:calc(26px + env(safe-area-inset-top,0px)) 18px calc(22px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:center;text-align:center}
.dp-k{font:700 .74rem "Sora",sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#ffd27f}
.dp-in h1{font:800 clamp(1.6rem,7vw,2.2rem)/1.08 "Sora",sans-serif;margin:8px 0 0;text-wrap:balance;overflow-wrap:anywhere}
.dp-sub{margin:8px 0 0;color:rgba(255,255,255,.8);line-height:1.45;white-space:pre-line;max-width:34ch}
.dp-cast{width:100%;display:grid;gap:10px;margin-top:18px}
.dp-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);text-align:left}
.dp-row .im{display:flex;gap:4px;flex:none}
.dp-row img{width:46px;height:46px;object-fit:contain;animation:dp-bob 2.4s ease-in-out infinite}
.dp-row img:nth-child(2){animation-delay:.4s}.dp-row img:nth-child(3){animation-delay:.8s}.dp-row img:nth-child(4){animation-delay:1.2s}
@keyframes dp-bob{50%{transform:translateY(-4px) rotate(4deg)}}
.dp-row b{display:block;font:700 .98rem "Sora",sans-serif}
.dp-row span{font-size:.84rem;color:rgba(255,255,255,.75)}
.dp-row.bad b{color:#ff8a9e}.dp-row.good b{color:#74e8ba}.dp-row.gold b{color:#ffd27f}
.dp-how{margin:14px 0 0;font-size:.9rem;color:rgba(255,255,255,.82);line-height:1.45}
.dp-prize{width:100%;margin-top:14px;padding:12px 14px;border-radius:16px;background:linear-gradient(135deg,rgba(255,190,85,.22),rgba(139,63,214,.2));border:1px solid rgba(255,190,85,.55);font-weight:600}
.dp-prize b{color:#ffd27f;font-family:"Sora",sans-serif}
.dp-go{margin:20px 0 0;font:800 1.15rem "Sora",sans-serif;letter-spacing:.14em;text-transform:uppercase;border:0;border-radius:999px;padding:17px 46px;cursor:pointer;color:#2a1600;background:linear-gradient(135deg,#ffe29a,#ffbe55 50%,#ff9f3a);box-shadow:0 10px 30px -8px rgba(255,170,60,.75),inset 0 -3px 0 rgba(0,0,0,.15);position:relative;overflow:hidden;animation:dp-pulse 2.2s ease-in-out infinite}
.dp-go::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.6) 50%,transparent 65%);background-size:250% 100%;animation:dp-shine 2.6s ease-in-out infinite}
.dp-go:disabled{animation:none;opacity:.6}
@keyframes dp-pulse{50%{transform:scale(1.045)}}
@keyframes dp-shine{0%,50%{background-position:120% 0}90%,100%{background-position:-120% 0}}
.dp-mine{margin:14px 0 0;font:600 .9rem "Sora",sans-serif;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff;border-radius:999px;padding:9px 16px;cursor:pointer}
.dp-note{margin:10px 0 0;font-size:.82rem;color:rgba(255,255,255,.65)}
.dp-foot{margin-top:auto;padding-top:26px;display:flex;justify-content:center}
.dp-foot a,.dp-foot span{display:inline-flex;align-items:center;padding:9px 16px;border-radius:999px;background:rgba(255,255,255,.14)}
.dp-foot img{height:20px;width:auto;display:block}
.dp-foot.own a,.dp-foot.own span{background:#fff}.dp-foot.own img{height:26px;max-width:60vw}
.dp-score{font:800 clamp(3.6rem,20vw,5.2rem)/1 "Sora",sans-serif;color:#ffd27f;text-shadow:0 0 40px rgba(255,190,85,.6);margin-top:6px}
.dp-pts{font:700 .8rem "Sora",sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.75)}
.dp-stars{display:flex;gap:8px;justify-content:center;margin:12px 0 4px}
.dp-stars svg{width:42px;height:42px;fill:rgba(255,255,255,.18);transform:scale(0);animation:dp-star .5s cubic-bezier(.2,1.6,.4,1) forwards}
.dp-stars svg.on{fill:#ffcf4d;filter:drop-shadow(0 0 10px rgba(255,207,77,.7))}
.dp-stars svg:nth-child(2){animation-delay:.25s}.dp-stars svg:nth-child(3){animation-delay:.5s}
@keyframes dp-star{to{transform:scale(1)}}
.dp-stats{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px}
.dp-stats span{font-size:.84rem;padding:6px 11px;border-radius:99px;background:rgba(255,255,255,.1)}
.dp-rec{margin-top:10px;font:700 .95rem "Sora",sans-serif;color:#74e8ba}
.dp-miss{width:100%;margin-top:16px;padding:14px;border-radius:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2)}
.dp-miss b{color:#ffd27f}
.dp-won{font:800 clamp(1.8rem,9vw,2.5rem)/1 "Sora",sans-serif;color:#ffd27f;text-shadow:0 0 30px rgba(255,190,85,.6);margin:18px 0 12px}
.dp-cup{position:relative;width:100%;background:#fff;color:#1b1626;border-radius:22px;padding:20px 20px 16px;box-shadow:0 30px 60px -20px rgba(0,0,0,.6);overflow:hidden;text-align:center}
.dp-cup .sh{position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 30%,rgba(255,215,130,.55) 48%,rgba(210,184,255,.5) 52%,transparent 70%);background-size:300% 100%;animation:dp-shine 3s linear infinite}
.dp-cup .biz{font:700 .82rem "Sora",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#6b6380}
.dp-cup .pz{font:800 clamp(1.5rem,7.5vw,2.1rem)/1.08 "Sora",sans-serif;margin:10px 0 4px;color:var(--dp-cd);overflow-wrap:anywhere;text-wrap:balance}
.dp-cup .cut{position:relative;border-top:2px dashed #ddd6ea;margin:14px -20px 12px}
.dp-cup .cut::before,.dp-cup .cut::after{content:"";position:absolute;top:-14px;width:26px;height:26px;border-radius:50%;background:#0d0520}
.dp-cup .cut::before{left:-13px}.dp-cup .cut::after{right:-13px}
.dp-cup .lbl{font:600 .7rem "Sora",sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#8a8399;margin-bottom:5px}
.dp-cup .code{font:700 1.5rem/1 "IBM Plex Mono",monospace;letter-spacing:.14em}
.dp-cup .meta{display:grid;gap:4px;margin-top:12px;font-size:.88rem;color:#4a4458}
.dp-cup .cond{margin-top:10px;font-size:.84rem;color:#6b6380;white-space:pre-line}
.dp-cup .live{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;font:600 .78rem "IBM Plex Sans",sans-serif;color:#6b6380}
.dp-cup .live i{width:9px;height:9px;border-radius:50%;background:#2fb67c;animation:dp-dot 1s ease-in-out infinite}
.dp-cup .live b{font:700 .9rem "IBM Plex Mono",monospace;color:#1b1626}
@keyframes dp-dot{50%{opacity:.25;transform:scale(.7)}}
.dp-cup.old{filter:grayscale(1);opacity:.75}.dp-cup.old .sh,.dp-cup.old .live{display:none}
.dp-cup .stamp{display:inline-block;margin-top:10px;padding:5px 12px;border:2px solid #c0392b;color:#c0392b;border-radius:8px;font:800 .85rem "Sora",sans-serif;letter-spacing:.1em;text-transform:uppercase;transform:rotate(-4deg)}
.dp-acts{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:16px;width:100%}
.dp-btn{flex:1 1 140px;font:700 .88rem "Sora",sans-serif;white-space:nowrap;border-radius:999px;padding:14px 12px;cursor:pointer;border:0;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.dp-btn.p{background:linear-gradient(135deg,#ffe29a,#ffbe55 50%,#ff9f3a);color:#2a1600}
.dp-btn.s{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.35)}
.dp-btn svg{width:18px;height:18px;fill:currentColor}
.dp-keep{margin:12px 0 0;font-size:.82rem;color:rgba(255,255,255,.75)}
.dp-lk{width:100%;margin-top:20px;padding:16px;border-radius:18px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22)}
.dp-lk p{margin:0 0 10px;font-weight:600;white-space:pre-line}
.dp-lk a{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:13px 18px;border-radius:999px;background:#fff;color:#1b1626;text-decoration:none;font:700 .92rem "Sora",sans-serif}
.dp-close{position:absolute;right:12px;top:calc(10px + env(safe-area-inset-top,0px));width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:1.3rem;cursor:pointer;z-index:2}
.dp-list{width:100%;display:grid;gap:10px;margin-top:6px}
.dp-list button{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;padding:13px 16px;border-radius:14px;border:0;background:#fff;color:#1b1626;cursor:pointer;font:600 .95rem "Sora",sans-serif}
.dp-list small{font:500 .78rem "IBM Plex Sans",sans-serif;color:#6b6380;white-space:nowrap}
.dp-cf{position:absolute;inset:0;pointer-events:none;z-index:7;width:100%;height:100%}
.dp-toast{position:absolute;left:50%;bottom:calc(80px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);opacity:0;pointer-events:none;background:#16151a;color:#fff;padding:11px 18px;border-radius:999px;font-size:.9rem;font-weight:600;transition:.25s;z-index:9;white-space:nowrap;max-width:90%;overflow:hidden;text-overflow:ellipsis}
.dp-toast.on{opacity:1;transform:translate(-50%,0)}
@media (prefers-reduced-motion:reduce){.dp-go,.dp-go::after,.dp-row img,.dp-cup .sh,.dp.low .dp-tm b,.dp.low .dp-low,.dp-cd.go,.dp-sc.bump b{animation:none!important}}
`;
const ICON = {
  save: '<path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/>',
  share: '<path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7a3 3 0 0 0 .1.8L8.4 11.2a3 3 0 1 0 0 1.6l6.7 3.4A3 3 0 1 0 18 16z"/>',
  star: '<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z"/>',
  again: '<path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/>',
};
const AIM = '<svg viewBox="0 0 64 64" fill="none" stroke-width="3"><circle cx="32" cy="32" r="20" stroke="#fff" opacity=".9"/><path d="M32 4v14M32 46v14M4 32h14M46 32h14" stroke="#fff" stroke-linecap="round"/><circle cx="32" cy="32" r="3" fill="#ffd27f" stroke="none"/></svg>';

const mxDay = (t = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(t);
const fmtDate = t => new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
const fmtWhen = t => new Date(t).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => { const b = crypto.getRandomValues(new Uint8Array(6)); const s = Array.from(b, x => ALPHA[x % ALPHA.length]).join(""); return s.slice(0, 3) + "-" + s.slice(3); };
function validUntil(at, days) { if (!days) return 0; const s = mxDay(at + days * 864e5); return Date.parse(s + "T23:59:59-06:00"); }
// stars: thresholds that grow with the time (or with the prize's score, when there is one)
export function starsFor(score, D) { const goal = D.prize && D.prize.min ? D.prize.min : (D.time || 30) * 3.4; return score >= goal * 1.35 ? 3 : score >= goal ? 2 : score >= goal * .4 ? 1 : 0; }

export function run(o) {
  const root = o.root;
  if (!document.getElementById("dp-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "dp-css", textContent: CSS }));
  if (!document.getElementById("dp-fonts")) document.head.appendChild(Object.assign(document.createElement("link"), { id: "dp-fonts", rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=Sora:wght@500;600;700;800&display=swap" }));
  const el = document.createElement("div"); el.className = "dp";
  el.innerHTML = `<video playsinline muted autoplay hidden></video><canvas class="gl"></canvas><canvas class="hud"></canvas>
    <div class="dp-low"></div><div class="dp-cd"></div>
    <div class="dp-top" hidden><div class="dp-sc"><svg viewBox="0 0 24 24">${ICON.star}</svg><b>0</b><small>PTS</small></div>
      <div class="dp-tm"><svg viewBox="0 0 66 66"><defs><linearGradient id="dpTg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe29a"/><stop offset="1" style="stop-color:var(--dp-c,#8b3fd6)"/></linearGradient></defs><circle class="bg" cx="33" cy="33" r="28"/><circle class="fg" cx="33" cy="33" r="28" stroke-dasharray="175.9" stroke-dashoffset="0"/></svg><b>30</b></div>
      <div class="dp-goal" hidden><span></span><i></i></div></div>
    <div class="dp-combo"></div><div class="dp-aim" hidden>${AIM}</div><div class="dp-hint"></div><div class="dp-flash"></div><div class="dp-big" hidden></div><div class="dp-toast" role="status" aria-live="polite"></div>`;
  root.appendChild(el);
  const q = s => el.querySelector(s);
  const video = q("video"), glc = q("canvas.gl"), hud = q("canvas.hud"), hx = hud.getContext("2d"), toastEl = q(".dp-toast");
  const named = c => ({ ...c, title: (c.dispara && c.dispara.name) || c.title });
  let cfg = named(o.cfg), alive = true, state = "intro", tT = 0, clockT = 0, saved = null;
  const D = () => cfg.dispara || {};
  const KEY = "vvr-dispara-" + (cfg.slug || "x");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toast = t => { toastEl.textContent = t; toastEl.classList.add("on"); clearTimeout(tT); tT = setTimeout(() => toastEl.classList.remove("on"), 2600); };
  const count = id => { if (!o.embedded && o.onClick) o.onClick(id); };
  const hint = t => { const h = q(".dp-hint"); if (t) h.textContent = t; h.classList.toggle("on", !!t); };
  const color = () => hexOk(D().color, "#8b3fd6");

  // ---- what this phone won and its record (never in the preview) ----
  function load() { if (o.embedded) return { won: [], last: null, best: 0 }; try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v && Array.isArray(v.won)) return v; } catch {} return { won: [], last: null, best: 0 }; }
  function store() { if (o.embedded) return; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} }
  saved = load();
  function canWin() {
    const P = D().prize; if (!P) return false; if (o.embedded) return true;
    const L = P.limit || "una", last = saved.last; if (!last || L === "libre") return true;
    return L === "dia" ? last.day !== mxDay() : false;
  }

  // ---- 3D: the camera turns with the phone (or a drag); objects live on a sphere around it ----
  const renderer = new THREE.WebGLRenderer({ canvas: glc, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(62, 1, .1, 200);
  // stars: only without camera, so turning shows that the world moves
  const sky = (() => { const n = 900, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(60); p.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd2b8ff, size: .22, transparent: true, opacity: .75 })); })();
  scene.add(sky);
  let W = 1, H = 1;
  function resize() { W = el.clientWidth || 1; H = el.clientHeight || 1; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); const d = Math.min(2, devicePixelRatio || 1); hud.width = W * d; hud.height = H * d; hx.setTransform(d, 0, 0, d, 0, 0); }
  const ro = new ResizeObserver(resize); ro.observe(el); resize();

  // orientation: the phone's gyroscope (deviceorientation) or dragging (yaw/pitch)
  let gyro = false, gyroData = null, yaw0 = null, yaw = 0, pitch = 0;
  const qT = new THREE.Quaternion(), euler = new THREE.Euler(), qFix = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2), zee = new THREE.Vector3(0, 0, 1), qS = new THREE.Quaternion();
  const onOri = e => { if (e.alpha == null && e.beta == null) return; gyroData = e; if (!gyro) { gyro = true; if (state === "play" || state === "count") setMode(); } };
  function gyroQuat(e) {
    const deg = THREE.MathUtils.degToRad, orient = deg((screen.orientation && screen.orientation.angle) || window.orientation || 0);
    if (yaw0 === null) yaw0 = e.alpha || 0;
    euler.set(deg(e.beta || 0), deg((e.alpha || 0) - yaw0), -deg(e.gamma || 0), "YXZ");
    qT.setFromEuler(euler).multiply(qFix).multiply(qS.setFromAxisAngle(zee, -orient));
    return qT;
  }
  function setMode() { q(".dp-aim").hidden = !(state === "play" || state === "count"); }
  function aim(dt) {
    if (gyro && gyroData) camera.quaternion.slerp(gyroQuat(gyroData), Math.min(1, dt * 18));
    else { euler.set(pitch, yaw, 0, "YXZ"); camera.quaternion.setFromEuler(euler); }
  }

  // ---- textures of the characters ----
  const texCache = new Map();
  function texFor(ob) {
    const k = ob.key ? "k:" + ob.key : "i:" + ob.img;
    if (texCache.has(k)) return texCache.get(k);
    const p = (ob.key ? spriteImage(ob.key) : loadImg(o.src ? o.src(ob.img) : "")).then(img => {
      if (!img) return null; const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; t.anisotropy = 4;
      return { t, a: (img.naturalWidth || img.width) / (img.naturalHeight || img.height) || 1 };
    });
    texCache.set(k, p); return p;
  }
  const imgUrl = ob => ob.key ? spriteUrl(ob.key) : (o.src ? o.src(ob.img) : "");
  let cast = { malo: [], bueno: [], dorado: [] };
  async function prepareCast() {
    const objs = (D().objs || []).length ? D().objs : [{ role: "malo", key: "monstruo" }];
    const out = { malo: [], bueno: [], dorado: [] };
    await Promise.all(objs.map(async ob => { const t = await texFor(ob); if (t && out[ob.role]) out[ob.role].push(t); }));
    if (!out.malo.length) { const t = await texFor({ key: "monstruo" }); if (t) out.malo.push(t); }
    cast = out;
  }

  // ---- the flying things ----
  const things = [];
  const dirOf = (az, elv) => new THREE.Vector3(Math.sin(az) * Math.cos(elv), Math.sin(elv), -Math.cos(az) * Math.cos(elv));
  const fwd = new THREE.Vector3();
  const viewAz = () => { camera.getWorldDirection(fwd); return Math.atan2(fwd.x, -fwd.z); };
  let spawned = 0;
  function spawn(role) {
    const list = cast[role]; if (!list || !list.length) return;
    const tx = list[Math.floor(Math.random() * list.length)], sp = SPEEDS[D().speed] || SPEEDS.normal;
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx.t, transparent: true, depthWrite: false }));
    const near = spawned < 3 ? 0.7 : 2.6;   // the first ones come in front, then all around
    const az = viewAz() + (Math.random() * 2 - 1) * near, el0 = THREE.MathUtils.degToRad(-12 + Math.random() * 42), r = 4.2 + Math.random() * 2.4;
    const size = (role === "dorado" ? .8 : role === "bueno" ? 1 : 1.1) * (r / 5);
    const w = (role === "dorado" ? .9 : .22 + Math.random() * .3) * sp.k * (Math.random() < .5 ? -1 : 1);
    const t = { m, role, az, el0, r, w, ph: Math.random() * 6, fq: .8 + Math.random() * 1.2, amp: .08 + Math.random() * .12, age: 0, life: (role === "dorado" ? .55 : 1) * sp.life * (.85 + Math.random() * .3), size, a: tx.a, dead: false, out: 0 };
    m.scale.set(0.001, 0.001, 1); scene.add(m); things.push(t); spawned++;
  }
  function placeThing(t, dt) {
    t.age += dt; t.az += t.w * dt;
    const elv = t.el0 + Math.sin(t.age * t.fq + t.ph) * t.amp, r = t.r + Math.sin(t.age * 1.3 + t.ph) * .25;
    t.m.position.copy(dirOf(t.az, elv)).multiplyScalar(r);
    const inK = Math.min(1, t.age / .35), pop = inK < 1 ? 1 + Math.sin(inK * Math.PI) * .25 : 1;   // pops in
    let k = inK * pop;
    if (t.age > t.life) { t.out += dt * 3; k *= Math.max(0, 1 - t.out); t.m.material.opacity = Math.max(0, 1 - t.out); if (t.out >= 1) t.dead = true; }
    t.m.scale.set(t.size * t.a * k, t.size * k, 1);
    t.m.material.rotation = Math.sin(t.age * 2 + t.ph) * .18;
  }
  function removeThing(t) { scene.remove(t.m); t.m.material.dispose(); t.dead = true; }

  // ---- bursts and floating points ----
  const dot = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "#fff"); g.addColorStop(.4, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
  const parts = [];
  function burst(pos, n, cols, big = 1) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: cols[i % cols.length], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.copy(pos); const s = (.08 + Math.random() * .16) * big; m.scale.set(s, s, 1); scene.add(m);
      parts.push({ m, v: new THREE.Vector3().randomDirection().multiplyScalar((1.2 + Math.random() * 2.6) * big), life: .5 + Math.random() * .5, age: 0, s });
    }
  }
  function label(pos, text, col) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d");
    x.font = "800 84px Sora, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 14; x.lineJoin = "round"; x.strokeStyle = "rgba(10,4,22,.85)"; x.strokeText(text, 128, 64); x.fillStyle = col; x.fillText(text, 128, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false })); m.renderOrder = 5;
    m.position.copy(pos); const d = pos.length() / 5; m.scale.set(1.1 * d, .55 * d, 1); scene.add(m);
    parts.push({ m, v: new THREE.Vector3(0, .9, 0), life: .9, age: 0, s: 0, label: true, d });
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.age += dt; const k = p.age / p.life;
      if (k >= 1) { scene.remove(p.m); if (p.label) p.m.material.map.dispose(); p.m.material.dispose(); parts.splice(i, 1); continue; }
      p.m.position.addScaledVector(p.v, dt); if (!p.label) { p.v.multiplyScalar(1 - dt * 2.5); const s = p.s * (1 - k * .6); p.m.scale.set(s, s, 1); }
      else { const pop = k < .2 ? .6 + k * 2 : 1; p.m.scale.set(1.1 * p.d * pop, .55 * p.d * pop, 1); }
      p.m.material.opacity = 1 - k * k;
    }
  }

  // ---- the game ----
  let G = null;   // {t, score, combo, mult, hits, goods, golds, shots, nextSpawn, nextGold}
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3();
  function hitAt(px, py) {   // the closest thing to the ray through (px, py), with some slack
    ndc.set(px / W * 2 - 1, -(py / H) * 2 + 1); ray.setFromCamera(ndc, camera);
    let best = null, bestA = Infinity;
    for (const t of things) {
      if (t.dead || t.age > t.life) continue;
      tmp.copy(t.m.position); const dist = tmp.length(); tmp.normalize();
      const ang = ray.ray.direction.angleTo(tmp), lim = Math.atan((t.size * Math.max(1, t.a) * .5) / dist) * 1.3 + .02;
      if (ang < lim && ang < bestA) { best = t; bestA = ang; }
    }
    return best;
  }
  let laser = null;   // {x, y, t}
  function shoot() {
    if (state !== "play") return;
    G.shots++; sfx.laser();
    const t = hitAt(W / 2, H / 2), aimEl = q(".dp-aim");
    aimEl.classList.add("fire"); aimEl.classList.toggle("hit", !!t); setTimeout(() => aimEl.classList.remove("fire", "hit"), 140);
    laser = { t: 0, hit: !!t };
    if (!t) { if (G.combo >= 3) toast("Se rompió tu combo"); G.combo = 0; G.mult = 1; drawCombo(); return; }
    const pos = t.m.position.clone();
    if (t.role === "bueno") {
      G.score = Math.max(0, G.score + ROLES.bueno.pts); G.goods++; G.combo = 0; G.mult = 1; drawCombo();
      sfx.wrong(); label(pos, "−15", "#ff6b81"); burst(pos, 14, [0xff4d6d, 0xffffff]);
      el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
      const f = q(".dp-flash"); f.classList.add("on"); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove("on")));
      if (navigator.vibrate) try { navigator.vibrate([60, 40, 60]); } catch {}
    } else {
      G.combo++; G.mult = G.combo >= 6 ? 3 : G.combo >= 3 ? 2 : 1;
      const pts = (t.role === "dorado" ? ROLES.dorado.pts : ROLES.malo.pts) * G.mult; G.score += pts;
      if (t.role === "dorado") { G.golds++; sfx.coin(); sfx.sparkle(6); burst(pos, 46, [0xffd27f, 0xffbe55, 0xffffff], 1.4); label(pos, "+" + pts, "#ffd27f"); }
      else { G.hits++; sfx.boom(); burst(pos, 26, [0xffbe55, 0xd2b8ff, 0xffffff, new THREE.Color(color()).getHex()]); label(pos, "+" + pts, "#ffffff"); }
      if (G.combo === 3 || G.combo === 6) sfx.sparkle(4);
      drawCombo();
      if (navigator.vibrate) try { navigator.vibrate(18); } catch {}
    }
    removeThing(t); drawScore();
  }
  function drawScore() {
    const s = q(".dp-sc"), d = G.score - (G.shown ?? G.score); G.shown = G.score;
    s.querySelector("b").textContent = G.score.toLocaleString("es-MX");
    if (d) { s.classList.remove("bump"); void s.offsetWidth; s.classList.add("bump"); s.classList.toggle("loss", d < 0); clearTimeout(s._t); s._t = setTimeout(() => s.classList.remove("loss"), 450); }
    const P = D().prize, g = q(".dp-goal");
    g.hidden = !(P && canWin());
    if (!g.hidden) {
      const done = G.score >= P.min;
      g.querySelector("span").textContent = done ? "🎁 ¡Premio ganado!" : `🎁 Meta ${P.min.toLocaleString("es-MX")}`;
      g.style.setProperty("--p", Math.min(100, G.score / P.min * 100) + "%");
      if (done && !g.classList.contains("done")) { g.classList.add("done"); sfx.sparkle(8); sfx.coin(); }
      if (!done) g.classList.remove("done");
    }
  }
  function drawCombo() { const c = q(".dp-combo"); c.textContent = `¡Combo ×${G.mult}!`; c.classList.toggle("on", G.mult > 1); }
  function drawTime() {
    const T = D().time || 30, left = Math.max(0, G.t), s = Math.ceil(left);
    q(".dp-tm .fg").setAttribute("stroke-dashoffset", (175.9 * (1 - left / T)).toFixed(1));
    q(".dp-tm b").textContent = s;
    const low = state === "play" && left <= 5 && left > 0;
    el.classList.toggle("low", low);
  }
  // each of the last 5 seconds pops big in red
  function lastSecond(s) { const c = q(".dp-cd"); c.textContent = s; c.classList.remove("go"); void c.offsetWidth; c.classList.add("go"); if (s === 5) hint("¡Se acaba el tiempo!"); if (s === 3) hint(""); }
  function big(html, ms = 800) { const b = q(".dp-big"); b.innerHTML = html; b.hidden = false; b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); clearTimeout(b._t); if (ms) b._t = setTimeout(() => { b.hidden = true; }, ms); }

  // arrows on the edges toward bad things out of view
  function drawHud(dt) {
    hx.clearRect(0, 0, W, H);
    if (laser) {
      laser.t += dt; const k = laser.t / .2;
      if (k >= 1) laser = null;
      else {
        const cx = W / 2, cy = H / 2, a = 1 - k, grow = Math.min(1, laser.t / .05);   // the beams shoot up fast, then fade
        hx.save(); hx.lineCap = "round"; hx.globalCompositeOperation = "lighter";
        for (const sx of [W * .12, W * .88]) {
          const x0 = sx, y0 = H + 12, x1 = x0 + (cx - x0) * grow, y1 = y0 + (cy - y0) * grow;
          const g = hx.createLinearGradient(x0, y0, cx, cy); g.addColorStop(0, "rgba(255,120,60,0)"); g.addColorStop(.6, `rgba(255,190,85,${.7 * a})`); g.addColorStop(1, `rgba(255,250,220,${a})`);
          hx.strokeStyle = g; hx.lineWidth = 12 * a + 2; hx.shadowColor = "rgba(255,190,85,.9)"; hx.shadowBlur = 18;
          hx.beginPath(); hx.moveTo(x0, y0); hx.lineTo(x1, y1); hx.stroke();
          hx.strokeStyle = `rgba(255,255,255,${a})`; hx.lineWidth = 3 * a + 1; hx.shadowBlur = 0; hx.beginPath(); hx.moveTo(x0, y0); hx.lineTo(x1, y1); hx.stroke();
        }
        if (grow >= 1) {   // the impact in the crosshair
          const r = (laser.hit ? 34 : 20) * (0.5 + k);
          const g = hx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(255,255,240,${a})`); g.addColorStop(.4, `rgba(255,200,100,${.8 * a})`); g.addColorStop(1, "rgba(255,120,60,0)");
          hx.fillStyle = g; hx.beginPath(); hx.arc(cx, cy, r, 0, 7); hx.fill();
        }
        hx.restore();
      }
    }
    if (state !== "play") return;
    const shown = [];
    for (const t of things) {
      if (t.dead || t.role === "bueno" || t.age > t.life) continue;
      tmp.copy(t.m.position).applyMatrix4(camera.matrixWorldInverse);
      const v = tmp.clone().applyMatrix4(camera.projectionMatrix);
      if (tmp.z < 0 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) continue;   // on screen
      shown.push({ t, x: tmp.x, y: tmp.y, z: tmp.z });
    }
    shown.slice(0, 4).forEach(s => {
      const a = Math.atan2(-s.y, s.x), m = 30, cx = W / 2, cy = H / 2, c = Math.cos(a), sn = Math.sin(a);
      const k = Math.min((W / 2 - m) / Math.abs(c || 1e-6), (H / 2 - m) / Math.abs(sn || 1e-6));
      const x = cx + c * k, y = cy + sn * k, pulse = 1 + Math.sin(clockT * 8) * .12;
      hx.save(); hx.translate(x, y); hx.rotate(a); hx.scale(pulse, pulse);
      hx.fillStyle = s.t.role === "dorado" ? "#ffd27f" : "#ff6b81"; hx.strokeStyle = "rgba(10,4,22,.7)"; hx.lineWidth = 3;
      hx.beginPath(); hx.moveTo(14, 0); hx.lineTo(-10, -12); hx.lineTo(-5, 0); hx.lineTo(-10, 12); hx.closePath(); hx.stroke(); hx.fill(); hx.restore();
    });
  }

  function startGame() {
    for (const t of things) removeThing(t); things.length = 0; spawned = 0;
    G = { t: D().time || 30, score: 0, combo: 0, mult: 1, hits: 0, goods: 0, golds: 0, shots: 0, nextSpawn: .4, nextGold: 6 + Math.random() * 6, lastSec: 99 };
    q(".dp-top").hidden = false; drawScore(); drawCombo(); drawTime(); setMode();
    state = "count"; G.cd = 3.2; G.cdShown = 0; setMode();
    hint(gyro ? "Gira con tu celular, pon la mira sobre los malos y toca la pantalla" : "Arrastra para apuntar con la mira · toca para disparar");
  }
  function tick(dt) {
    if (state === "count") {
      G.cd -= dt; const n = Math.ceil(G.cd - .2);
      if (n !== G.cdShown) { G.cdShown = n; if (n > 0) { sfx.count(); big(String(n), 700); } else { sfx.go(); big("¡Ya!", 700); } }
      if (G.cd <= 0) { state = "play"; setTimeout(() => hint(""), 2500); }
      return;
    }
    if (state !== "play") return;
    G.t -= dt; drawTime();
    const s = Math.ceil(G.t); if (s !== G.lastSec) { G.lastSec = s; if (s <= 5 && s > 0) { sfx.tick(1.6); sfx.count(); lastSecond(s); if (navigator.vibrate) try { navigator.vibrate(30); } catch {} } }
    const T = D().time || 30, el2 = T - G.t, sp = SPEEDS[D().speed] || SPEEDS.normal;
    const maxAlive = Math.min(9, 4 + Math.floor(el2 / 8)), live = things.filter(t => !t.dead).length;
    G.nextSpawn -= dt;
    if (G.nextSpawn <= 0 && live < maxAlive) {
      const goodChance = cast.bueno.length ? .3 : 0;
      spawn(Math.random() < goodChance ? "bueno" : "malo");
      G.nextSpawn = Math.max(.32, (1.05 - el2 / T * .55) / sp.k) * (.7 + Math.random() * .6);
    }
    G.nextGold -= dt; if (G.nextGold <= 0) { if (cast.dorado.length) { spawn("dorado"); sfx.sparkle(3); } G.nextGold = 7 + Math.random() * 7; }
    if (G.t <= 0) end();
  }
  function end() {
    state = "over"; G.t = 0; drawTime(); el.classList.remove("low"); hint(""); sfx.go();
    big("¡Tiempo!", 1300);
    setTimeout(() => { if (!alive) return; for (const t of things) t.age = Math.max(t.age, t.life); results(); }, 1400);
  }

  // ---- screens ----
  let ov = null;
  function closeOv() { if (ov) { ov.remove(); ov = null; } clearInterval(clockT); }
  function openOv(html) { closeOv(); ov = document.createElement("div"); ov.className = "dp-ov"; ov.innerHTML = `<div class="dp-in">${html}</div>`; el.appendChild(ov); return ov; }
  function brandHtml() {
    const b = o.brand; if (!b) return "";
    const img = `<img src="${esc(b.src)}" alt="${b.own ? "" : "Vórtice VR"}">`;
    return `<footer class="dp-foot${b.own ? " own" : ""}">${b.href ? `<a href="${esc(b.href)}" target="_blank" rel="noopener">${img}</a>` : `<span>${img}</span>`}</footer>`;
  }
  const rowImgs = role => (D().objs || []).filter(x => x.role === role).map(x => `<img src="${esc(imgUrl(x))}" alt="">`).join("");
  function linkHtml() { const L = D().link; if (!L || !L.url) return ""; return `<div class="dp-lk">${L.msg ? `<p>${esc(L.msg)}</p>` : ""}<a href="${esc(L.url)}" target="_blank" rel="noopener" data-link>${esc(L.t || "Visítanos")}</a></div>`; }
  function intro() {
    el.style.setProperty("--dp-c", color());
    state = "intro"; q(".dp-top").hidden = true; q(".dp-aim").hidden = true; hint("");
    const d = D(), P = d.prize, objs = d.objs || [];
    const valid = saved.won.filter(w => !w.until || w.until > Date.now());
    const has = r => objs.some(x => x.role === r);
    const p = openOv(`<span class="dp-k">Dispara y gana</span><h1>${esc(cfg.title || "Dispara y gana")}</h1>${d.sub ? `<p class="dp-sub">${esc(d.sub)}</p>` : ""}
      <div class="dp-cast">
        <div class="dp-row bad"><div class="im">${rowImgs("malo") || `<img src="${esc(spriteUrl("monstruo"))}" alt="">`}</div><div><b>¡Dispárales!</b><span>+10 puntos cada uno · seguidos valen doble</span></div></div>
        ${has("bueno") ? `<div class="dp-row good"><div class="im">${rowImgs("bueno")}</div><div><b>A estos no</b><span>Si les das, pierdes 15 puntos</span></div></div>` : ""}
        ${has("dorado") ? `<div class="dp-row gold"><div class="im">${rowImgs("dorado")}</div><div><b>¡El dorado!</b><span>Sale poco y vuela rápido: +50</span></div></div>` : ""}
      </div>
      <p class="dp-how">Tienes <b>${d.time || 30} segundos</b>. Gira con tu celular para encontrarlos a tu alrededor y toca la pantalla para disparar.</p>
      ${P ? `<div class="dp-prize">${canWin() ? `Haz <b>${P.min.toLocaleString("es-MX")} puntos</b> y gana: <b>${esc(P.t)}</b>` : `Ya ganaste tu premio${(P.limit || "una") === "dia" ? " de hoy" : ""}. ¡Sigue jugando por tu récord!`}</div>` : ""}
      <button class="dp-go" type="button" data-play>¡Jugar!</button>
      ${saved.best ? `<p class="dp-note">Tu récord: ${saved.best.toLocaleString("es-MX")} puntos</p>` : ""}
      ${valid.length ? `<button class="dp-mine" type="button" data-mine>🎁 ${valid.length === 1 ? "Ver mi premio" : `Mis premios (${valid.length})`}</button>` : ""}
      ${brandHtml()}`);
    p.addEventListener("click", e => {
      if (e.target.closest("[data-play]")) play(e.target.closest("[data-play]"));
      else if (e.target.closest("[data-mine]")) { sfx.tap(); showMine(); }
    });
  }
  // the tap on "¡Jugar!": permissions are asked inside it (iPhone needs that for the gyroscope)
  let camAsked = false;
  async function play(btn) {
    sfx.tap(); count("play");
    if (!o.embedded && !camAsked) {
      camAsked = true; if (btn) btn.disabled = true;
      const DOE = window.DeviceOrientationEvent;
      const perm = DOE && typeof DOE.requestPermission === "function" ? DOE.requestPermission().catch(() => "denied") : Promise.resolve("granted");
      const cam = navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).catch(() => null) : Promise.resolve(null);
      const [p, stream] = await Promise.all([perm, cam]);
      if (p === "granted") addEventListener("deviceorientation", onOri);
      if (stream) { video.srcObject = stream; video.hidden = false; sky.visible = false; try { await video.play(); } catch {} }
      else toast("Sin cámara: juegas con el cielo de fondo");
      await new Promise(r => setTimeout(r, 450));   // the first gyroscope readings
    }
    await prepareCast();
    closeOv(); yaw0 = null; startGame();
  }
  function results() {
    state = "end"; q(".dp-top").hidden = true; q(".dp-aim").hidden = true;
    const d = D(), P = d.prize, sc = G.score, st = starsFor(sc, d), rec = !o.embedded && sc > (saved.best || 0) && sc > 0;
    if (rec) { saved.best = sc; store(); }
    let prizeHtml = "", w = null;
    if (P) {
      if (sc >= P.min && canWin()) {
        const at = Date.now(); w = { p: P.t, code: code(), at, until: validUntil(at, P.days || 0), day: mxDay(at), score: sc };
        if (!o.embedded) { saved.last = w; saved.won.unshift(w); saved.won = saved.won.slice(0, 20); store(); }
        count("win");
      } else if (sc < P.min && canWin()) prizeHtml = `<div class="dp-miss">Te faltaron <b>${(P.min - sc).toLocaleString("es-MX")} puntos</b> para ganar <b>${esc(P.t)}</b>. ¡Inténtalo otra vez!</div>`;
    }
    const acc = G.shots ? Math.round((G.hits + G.golds) / G.shots * 100) : 0;
    const p = openOv(`<span class="dp-k">${esc(cfg.title || "Dispara y gana")}</span><div class="dp-score">0</div><div class="dp-pts">puntos</div>
      <div class="dp-stars">${[0, 1, 2].map(i => `<svg viewBox="0 0 24 24" class="${i < st ? "on" : ""}">${ICON.star}</svg>`).join("")}</div>
      <div class="dp-stats"><span>🎯 ${G.hits} malos</span>${G.golds ? `<span>✦ ${G.golds} dorado${G.golds > 1 ? "s" : ""}</span>` : ""}${G.goods ? `<span>💔 ${G.goods} bueno${G.goods > 1 ? "s" : ""}</span>` : ""}<span>Puntería ${acc}%</span></div>
      ${rec ? `<div class="dp-rec">¡Nuevo récord!</div>` : saved.best ? `<p class="dp-note">Tu récord: ${saved.best.toLocaleString("es-MX")}</p>` : ""}
      ${w ? `<div class="dp-won">¡Ganaste!</div>${coupon(w)}<div class="dp-acts"><button class="dp-btn p" type="button" data-save><svg viewBox="0 0 24 24">${ICON.save}</svg>Guardar mi premio</button></div><p class="dp-keep">Muéstralo en el negocio para canjearlo. Queda guardado aquí: vuelve a abrir este link para verlo.</p>` : prizeHtml}
      <div class="dp-acts"><button class="dp-btn ${w ? "s" : "p"}" type="button" data-again><svg viewBox="0 0 24 24">${ICON.again}</svg>Jugar otra vez</button><button class="dp-btn s" type="button" data-share><svg viewBox="0 0 24 24">${ICON.share}</svg>Retar a alguien</button></div>
      ${linkHtml()}${brandHtml()}`);
    // the score counts up
    const scEl = p.querySelector(".dp-score"), t0 = performance.now(), dur = Math.min(1600, 300 + sc * 4);
    const up = now => { if (!alive || !scEl.isConnected) return; const k = Math.min(1, (now - t0) / dur); scEl.textContent = Math.round(sc * (1 - Math.pow(1 - k, 3))).toLocaleString("es-MX"); if (k < 1) requestAnimationFrame(up); };
    requestAnimationFrame(up);
    setTimeout(() => { if (w) { sfx.win(); if (!reduced) confetti(); } else if (st >= 2 || rec) { sfx.sparkle(8); if (!reduced) confetti(); } else if (st === 0) sfx.lose(); else sfx.sparkle(4); }, Math.min(dur, 900));
    if (w) startClock(); shot = null; if (w) prepareShot(w);
    p.addEventListener("click", e => {
      if (e.target.closest("[data-again]")) { closeOv(); play(); }
      else if (e.target.closest("[data-share]")) { count("share"); sfx.tap(); share(sc); }
      else if (e.target.closest("[data-save]")) { count("save"); sfx.coin(); saveShot(w); }
      else if (e.target.closest("[data-link]")) { count("link"); if (o.embedded) { e.preventDefault(); toast("Aquí se abrirá tu link"); } }
    });
  }
  function coupon(w) {
    const old = w.until && w.until < Date.now(), P = D().prize || {};
    return `<div class="dp-cup${old ? " old" : ""}" style="--dp-cd:${lum(color()) > .5 ? "#6b3fa0" : color()}"><span class="sh"></span>
      <div class="biz">${esc(cfg.title || "")}</div><div class="pz">${esc(w.p)}</div><div class="cut"></div>
      <div class="lbl">Tu código</div><div class="code">${esc(w.code)}</div>
      <div class="meta"><span>Lo ganaste el ${esc(fmtWhen(w.at))}${w.score ? ` con ${w.score.toLocaleString("es-MX")} puntos` : ""}</span>${w.until ? `<span><b>${old ? "Venció" : "Válido hasta"} el ${esc(fmtDate(w.until))}</b></span>` : ""}</div>
      ${P.cond ? `<div class="cond">${esc(P.cond)}</div>` : ""}
      ${old ? '<span class="stamp">Vencido</span>' : '<div class="live"><i></i><span>Cupón en vivo</span><b data-clock></b></div>'}</div>`;
  }
  function startClock() { const tk = () => { const c = ov && ov.querySelector("[data-clock]"); if (c) c.textContent = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }; tk(); clearInterval(clockT); clockT = setInterval(tk, 1000); }
  function showPrize(w) {
    const p = openOv(`<button class="dp-close" type="button" data-x aria-label="Cerrar">✕</button><div class="dp-won" style="font-size:1.6rem">Tu premio</div>${coupon(w)}
      <div class="dp-acts"><button class="dp-btn p" type="button" data-save><svg viewBox="0 0 24 24">${ICON.save}</svg>Guardar mi premio</button></div><p class="dp-keep">Muéstralo en el negocio para canjearlo.</p>${linkHtml()}`);
    startClock(); shot = null; prepareShot(w);
    p.addEventListener("click", e => { if (e.target.closest("[data-x]")) { sfx.swoosh(); intro(); } else if (e.target.closest("[data-save]")) { count("save"); sfx.coin(); saveShot(w); } else if (e.target.closest("[data-link]")) count("link"); });
  }
  function showMine() {
    const list = saved.won; if (list.length === 1) { showPrize(list[0]); return; }
    const p = openOv(`<button class="dp-close" type="button" data-x aria-label="Cerrar">✕</button><div class="dp-won" style="font-size:1.6rem">Mis premios</div><div class="dp-list">${list.map((w, i) => { const old = w.until && w.until < Date.now();
      return `<button type="button" data-i="${i}" style="${old ? "opacity:.6" : ""}"><span>${esc(w.p)}</span><small>${old ? "Vencido" : w.until ? "Hasta el " + esc(fmtDate(w.until)) : esc(fmtWhen(w.at))}</small></button>`; }).join("")}</div>`);
    p.addEventListener("click", e => { if (e.target.closest("[data-x]")) { sfx.swoosh(); intro(); return; } const b = e.target.closest("[data-i]"); if (b) showPrize(list[+b.dataset.i]); });
  }

  // ---- the coupon as a picture (made ahead, so sharing stays inside the tap on iPhone) ----
  let shot = null;
  function wrap(x, t, max) { const w = String(t).split(/\s+/), out = []; let cur = ""; for (const s of w) { const n = cur ? cur + " " + s : s; if (cur && x.measureText(n).width > max) { out.push(cur); cur = s; } else cur = n; } if (cur) out.push(cur); return out; }
  async function prepareShot(w) {
    try {
      const Wd = 1080, Ht = 1350, c = document.createElement("canvas"); c.width = Wd; c.height = Ht; const x = c.getContext("2d");
      const g = x.createLinearGradient(0, 0, Wd, Ht); g.addColorStop(0, "#3a1670"); g.addColorStop(1, "#05020b"); x.fillStyle = g; x.fillRect(0, 0, Wd, Ht);
      try { await document.fonts.load("800 80px Sora"); await document.fonts.load("700 60px 'IBM Plex Mono'"); } catch {}
      x.textAlign = "center"; x.fillStyle = "#ffd27f"; x.font = "800 96px Sora, sans-serif"; x.fillText("¡Gané!", Wd / 2, 190);
      const cx = 110, cy = 260, cw = Wd - 220, ch = 820; x.fillStyle = "#fff"; x.beginPath(); x.roundRect ? x.roundRect(cx, cy, cw, ch, 44) : x.rect(cx, cy, cw, ch); x.fill();
      let y = cy + 110; x.fillStyle = "#6b6380"; x.font = "700 34px Sora, sans-serif"; x.fillText(String(cfg.title || "").toUpperCase().slice(0, 40), Wd / 2, y);
      x.fillStyle = lum(color()) > .5 ? "#6b3fa0" : color(); x.font = "800 84px Sora, sans-serif";
      let L = wrap(x, w.p, cw - 100); if (L.length > 3) { x.font = "800 64px Sora, sans-serif"; L = wrap(x, w.p, cw - 100).slice(0, 4); }
      const lh = parseInt(x.font.match(/(\d+)px/)[1]) * 1.12; L.forEach((l, i) => x.fillText(l, Wd / 2, y + 110 + i * lh)); y += 110 + (L.length - 1) * lh + 70;
      x.strokeStyle = "#ddd6ea"; x.lineWidth = 4; x.setLineDash([16, 14]); x.beginPath(); x.moveTo(cx + 30, y); x.lineTo(cx + cw - 30, y); x.stroke(); x.setLineDash([]);
      x.fillStyle = "#8a8399"; x.font = "600 28px Sora, sans-serif"; x.fillText("TU CÓDIGO", Wd / 2, y + 70);
      x.fillStyle = "#1b1626"; x.font = "700 72px 'IBM Plex Mono', monospace"; x.fillText(w.code, Wd / 2, y + 150);
      x.fillStyle = "#4a4458"; x.font = "500 32px 'IBM Plex Sans', sans-serif"; x.fillText(`Lo ganaste el ${fmtWhen(w.at)} con ${(w.score || 0).toLocaleString("es-MX")} puntos`, Wd / 2, y + 215);
      if (w.until) { x.font = "700 32px 'IBM Plex Sans', sans-serif"; x.fillText("Válido hasta el " + fmtDate(w.until), Wd / 2, y + 262); }
      const P = D().prize || {}; if (P.cond) { x.fillStyle = "#6b6380"; x.font = "500 28px 'IBM Plex Sans', sans-serif"; wrap(x, P.cond, cw - 120).slice(0, 3).forEach((l, i) => x.fillText(l, Wd / 2, Math.min(cy + ch - 120, y + 320) + i * 36)); }
      x.fillStyle = "rgba(255,255,255,.85)"; x.font = "500 34px 'IBM Plex Sans', sans-serif"; x.fillText("Muéstralo en el negocio para canjearlo", Wd / 2, cy + ch + 90);
      const b = o.brand, bi = b && await loadImg(b.src);
      if (bi) { const bh = b.own ? 70 : 52, bw = bi.naturalWidth * bh / bi.naturalHeight, bx = Wd / 2 - bw / 2, by = Ht - 120;
        if (b.own) { x.fillStyle = "#fff"; x.beginPath(); x.roundRect ? x.roundRect(bx - 26, by - 14, bw + 52, bh + 28, 50) : x.rect(bx - 26, by - 14, bw + 52, bh + 28); x.fill(); }
        x.drawImage(bi, bx, by, bw, bh); }
      shot = await new Promise(r => c.toBlob(r, "image/png"));
    } catch (e) { console.error(e); shot = null; }
  }
  async function saveShot(w) {
    if (o.embedded) { toast("Aquí se guarda la imagen de su premio"); return; }
    if (!shot) { await prepareShot(w); if (!shot) { toast("No se pudo crear la imagen; toma una captura"); return; } }
    const name = `premio-${cfg.slug || "dispara"}-${w.code}.png`, file = new File([shot], name, { type: "image/png" });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Mi premio" }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(shot); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Imagen guardada");
  }
  async function share(sc) {
    const url = o.url || location.href, text = `¡Hice ${sc.toLocaleString("es-MX")} puntos en ${cfg.title || "Dispara y gana"}! ¿Me ganas?`;
    if (o.embedded) { toast("Así retarán a sus amigos"); return; }
    try { if (navigator.share) { await navigator.share({ title: cfg.title || "", text, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text + " " + url); toast("Link copiado"); } catch { toast(url); }
  }
  function confetti() {
    const c = document.createElement("canvas"); c.className = "dp-cf"; el.appendChild(c);
    const dpr = Math.min(2, devicePixelRatio || 1), Wc = el.clientWidth, Hc = el.clientHeight; c.width = Wc * dpr; c.height = Hc * dpr;
    const x = c.getContext("2d"); x.scale(dpr, dpr);
    const cols = [color(), "#ffbe55", "#ffd27f", "#ffffff", "#ff5c8a", "#74e8ba"];
    const P = Array.from({ length: 150 }, (_, i) => ({ x: Wc / 2 + (Math.random() - .5) * 60, y: Hc * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 15 - 5, r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cols[i % cols.length], s: i % 3 }));
    const t0 = performance.now();
    const step = now => { if (!alive) return; x.clearRect(0, 0, Wc, Hc);
      for (const p of P) { p.vy += .35; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c;
        if (p.s === 0) x.fillRect(-p.r, -p.r / 2.5, p.r * 2, p.r / 1.25); else if (p.s === 1) { x.beginPath(); x.arc(0, 0, p.r / 1.6, 0, 7); x.fill(); } else { x.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? p.r / 2.2 : p.r; x.lineTo(Math.cos(k * Math.PI / 5) * rr, Math.sin(k * Math.PI / 5) * rr); } x.fill(); } x.restore(); }
      if (now - t0 < 4200) requestAnimationFrame(step); else c.remove(); };
    requestAnimationFrame(step);
  }

  // ---- input: a tap shoots; without gyroscope a drag looks around ----
  let drag = null;
  el.addEventListener("pointerdown", e => {
    if (e.target.closest(".dp-ov")) return;
    if (gyro) { shoot(); return; }
    drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; try { el.setPointerCapture(e.pointerId); } catch {}
  });
  el.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    const k = camera.fov * Math.PI / 180 / H; yaw += dx * k; pitch = Math.max(-1.1, Math.min(1.1, pitch + dy * k));
  });
  const up = e => { if (!drag || e.pointerId !== drag.id) return; if (drag.moved < 10) shoot(); drag = null; };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", () => { drag = null; });
  const onVis = () => { if (document.hidden && state === "play") { state = "paused"; } else if (!document.hidden && state === "paused") { state = "play"; toast("¡Sigue!"); } };
  document.addEventListener("visibilitychange", onVis);

  // ---- loop ----
  let last = performance.now(), raf = 0;
  const loop = now => {
    if (!alive) return; raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now; clockT += dt;
    aim(dt);
    if (!gyro && state === "intro" && !reduced) yaw += dt * .08;   // the sky turns slowly behind the intro
    tick(dt);
    for (let i = things.length - 1; i >= 0; i--) { const t = things[i]; if (t.dead) { things.splice(i, 1); continue; } placeThing(t, dt); if (t.dead) { scene.remove(t.m); t.m.material.dispose(); things.splice(i, 1); } }
    stepParts(dt);
    renderer.render(scene, camera);
    drawHud(dt);
  };
  raf = requestAnimationFrame(loop);
  intro();
  prepareCast();
  // coming back right after winning: the coupon is still there
  if (!o.embedded && saved.last && !canWin() && D().prize) setTimeout(() => { if (state === "intro" && saved.won[0]) showPrize(saved.won[0]); }, 350);

  return {
    update(c, brand) {
      cfg = named(c); if (brand !== undefined) o.brand = brand;
      texCache.clear(); prepareCast();
      if (state === "intro" || state === "end") intro();
    },
    destroy() {
      alive = false; cancelAnimationFrame(raf); clearInterval(clockT); ro.disconnect(); removeEventListener("deviceorientation", onOri); document.removeEventListener("visibilitychange", onVis);
      try { (video.srcObject && video.srcObject.getTracks() || []).forEach(t => t.stop()); } catch {}
      renderer.dispose(); el.remove();
    },
  };
}
