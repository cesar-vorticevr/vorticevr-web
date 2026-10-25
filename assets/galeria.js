// Galería 3D (/x/ when the experience is kind "galeria"; made in /crear/galeria/, whose preview runs this same file).
// An art space that is walked through on the phone or the computer. Three rooms (SALAS): the classic room (with its
// ambiences), a huge minimalist museum and a gallery floating in space. Each piece (obra) is a picture or a 3D object:
//  - pictures hang on the walls at their real size (w or h in cm; the picture keeps its proportion inside those
//    measures) or stand on an easel; each with its frame (FRAMES) and, if they want, a white mat (passe-partout);
//  - 3D objects (GLB) stand on a pedestal or on the floor, s = their largest side in cm, and may turn slowly.
// The wall pieces are laid out on the room's walls in order (each wall takes the next ones that fit, evenly spread);
// easels and 3D take the room's floor spots in order. Whatever doesn't fit is reported (o.onLayout) and not shown.
// Drag to look; WASD/arrows or the joystick (phone) to walk; tap the floor to go there; tap a piece to see it with its
// card (title and description); "Iniciar recorrido" goes from one to the next.
// cfg.galeria = { name, sala: clasica | museo | espacio, amb (clasica: noche | blanca | museo), obras: [
//   { id, img (an item "foto"), mount: pared | caballete, w, h (cm), frame, mat, t, d } |
//   { id, model (an item "model"), mount: pedestal | piso, s (cm), gira, t, d } ] }
// Galleries from before (no sala, no mount) are the classic room with easels, exactly as they were.
// Counted: tour, share (o.onClick).
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { sfx } from "./sonidos.js";

export const MAX = 20, MAX_3D = 6;
export const SALAS = {
  clasica: { t: "Sala clásica", d: "Un cuarto de galería con caballetes. Elige su ambiente." },
  museo: { t: "Gran museo", d: "Una nave enorme y blanca de 9 m de alto, con muros para obras de varios metros." },
  espacio: { t: "Galería en el espacio", d: "Una plataforma flotando entre estrellas y planetas." },
};
// f = width of the moulding, d = its depth; bead = a raised fillet, lip = an inner fillet; css = its swatch in the maker
export const FRAMES = {
  dorado: { t: "Dorado", f: .09, d: .065, color: 0xc89b3c, metal: 1, rough: .3, bead: 0xf2d47c, lip: 0x8a6420, css: "linear-gradient(135deg,#8a6420,#f2d47c 30%,#b8862f 55%,#f7dc8d 80%,#8a6420)" },
  madera: { t: "Madera", f: .075, d: .05, color: 0x7b4a26, rough: .62, lip: 0x3d2312, css: "repeating-linear-gradient(100deg,#6d3f1f 0 3px,#8a5530 3px 6px,#5e3418 6px 8px)" },
  negro: { t: "Negro", f: .035, d: .05, color: 0x151515, metal: .3, rough: .38, css: "linear-gradient(135deg,#000,#333 50%,#0c0c0c)" },
  blanco: { t: "Blanco", f: .045, d: .05, color: 0xf2efe8, rough: .55, css: "linear-gradient(135deg,#d9d5cc,#fff 50%,#e6e2da)" },
  plata: { t: "Plata", f: .055, d: .05, color: 0xc9cdd3, metal: 1, rough: .22, lip: 0x8d939b, css: "linear-gradient(135deg,#7d838b,#f1f3f6 35%,#a6acb4 60%,#eef0f3 85%,#7d838b)" },
  neon: { t: "Neón", f: .032, d: .04, color: 0x8b3fd6, emissive: 0xa45bff, glow: true, css: "linear-gradient(135deg,#b06cff,#8b3fd6)" },
  lienzo: { t: "Sin marco", f: 0, d: 0, lienzo: true, css: "none" },
};
// the classic room's ambiences
export const AMBIENTES = {
  noche: { t: "Noche Vórtice", wall: 0x1c1528, ceil: 0x0c0812, floor: ["#3b2a22", "#2a1c16"], trim: 0x8b3fd6, trimI: 2.2, strip: 0xd9c6ff, text: "#f3ecff", sub: "#ffbe55", dark: true, hemi: .32, dot: 0xd2b8ff },
  blanca: { t: "Galería blanca", wall: 0xeeece7, ceil: 0xf6f4f0, floor: ["#c39466", "#a97b4f"], trim: 0xd8d4cc, trimI: 0, strip: 0xfff6e8, text: "#1d1626", sub: "#8b3fd6", dark: false, hemi: 1.1, dot: 0xffbe55 },
  museo: { t: "Rojo museo", wall: 0x5a1d29, ceil: 0x160a0d, floor: ["#4a3020", "#36211a"], trim: 0xffbe55, trimI: .9, strip: 0xffe2b8, text: "#f8e9cc", sub: "#ffbe55", dark: true, hemi: .45, dot: 0xffd27a },
};
// where a piece goes when the maker hasn't chosen: easels in the classic room, walls elsewhere
export const mountOf = (ob, sala) => ob.model ? (ob.mount === "piso" ? "piso" : "pedestal") : ob.mount === "pared" || ob.mount === "caballete" ? ob.mount : sala && sala !== "clasica" ? "pared" : "caballete";
// the real size of a picture in cm from what the artist wrote (width, height or both) and its proportion; null = not given
export function realSize(ob, aspect) {
  let w = Number(ob.w) || 0, h = Number(ob.h) || 0;
  if (w && h) { if (w / h > aspect) w = h * aspect; else h = w / aspect; }   // the picture inside the box, never stretched
  else if (w) h = w / aspect;
  else if (h) w = h * aspect;
  else return null;
  return { w, h };
}

const EYE = 1.62, BODY = .3;
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const LOGO = { blanco: new URL("logo-vorticevr-blanco.png", import.meta.url).href, morado: new URL("logo-vorticevr.png", import.meta.url).href };

let gltfP = null;
function gltfTools() {   // the same loaders as assets/escena.js (Draco and Meshopt), loaded only when there is a 3D piece
  return gltfP ||= Promise.all([
    import("three/addons/loaders/GLTFLoader.js"), import("three/addons/loaders/DRACOLoader.js"),
    import("three/addons/libs/meshopt_decoder.module.js"), import("three/addons/utils/SkeletonUtils.js"),
  ]).then(([{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }, SU]) => {
    const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/");
    return { loader: new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder), clone: SU.clone };
  });
}

const CSS = `
.gl{position:absolute;inset:0;overflow:hidden;background:#05020b;color:#f4eeff;font-family:"IBM Plex Sans",system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.gl *{box-sizing:border-box}
.gl [hidden]{display:none!important}
.gl button{font:inherit;color:inherit;cursor:pointer}
.gl canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}
.gl-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:10px;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 18px;background:linear-gradient(rgba(5,2,11,.72),transparent);pointer-events:none;z-index:3}
.gl-top>*{pointer-events:auto}
.gl-top img{height:22px;width:auto;display:block}
.gl-top img.own{height:auto;max-height:34px;max-width:34vw;filter:drop-shadow(0 0 1.5px rgba(255,255,255,.75)) drop-shadow(0 2px 8px rgba(0,0,0,.45))}
.gl-name{flex:1;min-width:0;font:600 14px "Sora",system-ui,sans-serif;color:#d2b8ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
.gl-ic{flex:none;width:36px;height:36px;border-radius:50%;border:1px solid rgba(210,184,255,.22);background:rgba(14,8,26,.72);display:grid;place-items:center}
.gl-ic svg{width:16px;height:16px}
.gl-pill{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:3;pointer-events:none;background:rgba(14,8,26,.78);border:1px solid rgba(210,184,255,.18);border-radius:16px;padding:8px 16px;font-size:12.5px;color:#cbbbe8;text-align:center;width:max-content;max-width:calc(100% - 32px);transition:opacity .8s}
.gl-pill.off{opacity:0}
.gl-tour{position:absolute;right:14px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:3;border:0;border-radius:999px;padding:12px 18px;font:600 13.5px "Sora",system-ui,sans-serif;color:#1b0f00!important;background:linear-gradient(135deg,#ffd88a,#ffbe55);box-shadow:0 8px 30px rgba(255,190,85,.35)}
.gl-card{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:3;width:min(460px,calc(100% - 24px));background:rgba(14,8,26,.86);border:1px solid rgba(210,184,255,.18);border-radius:18px;padding:13px 15px;animation:gl-up .35s ease}
@keyframes gl-up{from{opacity:0;transform:translate(-50%,14px)}}
.gl-card .ct{display:flex;align-items:baseline;gap:10px}
.gl-card b{font:600 16px "Sora",system-ui,sans-serif;flex:1;min-width:0}
.gl-card .num{font-size:12px;color:#b9a8d6;flex:none}
.gl-card .sz{font:500 12px "IBM Plex Mono",ui-monospace,monospace;color:#ffbe55;margin-top:3px}
.gl-card .sz:empty{display:none}
.gl-card p{margin:5px 0 0;color:#cbbbe8;font-size:14px;line-height:1.4;white-space:pre-line;max-height:5.6em;overflow:auto}
.gl-card p:empty{display:none}
.gl-nav{display:flex;gap:8px;margin-top:11px}
.gl-nav button{flex:1;border:1px solid rgba(210,184,255,.2);background:rgba(139,63,214,.22);border-radius:12px;padding:9px;font:600 13px "Sora",system-ui,sans-serif}
.gl-nav button.x{flex:0 0 42px;background:none}
.gl-joy{position:absolute;left:18px;bottom:calc(18px + env(safe-area-inset-bottom,0px));width:112px;height:112px;border-radius:50%;z-index:3;background:radial-gradient(rgba(139,63,214,.18),rgba(14,8,26,.55));border:1px solid rgba(210,184,255,.18);touch-action:none}
.gl-joy i{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#d9c2ff,#8b3fd6);box-shadow:0 0 20px rgba(139,63,214,.7)}
@media (max-width:640px){.gl-pill{bottom:calc(74px + env(safe-area-inset-bottom,0px))}}
.gl.joy .gl-pill{bottom:calc(144px + env(safe-area-inset-bottom,0px))}
.gl.joy .gl-card{bottom:calc(140px + env(safe-area-inset-bottom,0px))}
.gl-intro{position:absolute;inset:0;z-index:5;display:grid;place-items:center;text-align:center;padding:24px;background:radial-gradient(circle at 50% 40%,rgba(139,63,214,.3),rgba(5,2,11,.88) 62%);transition:opacity .7s}
.gl-intro.out{opacity:0;pointer-events:none}
.gl-intro .k{font:600 11.5px "Sora",system-ui,sans-serif;letter-spacing:.28em;text-transform:uppercase;color:#ffbe55;margin:0 0 10px}
.gl-intro h1{font:700 clamp(26px,7vw,48px)/1.06 "Sora",system-ui,sans-serif;margin:0;text-wrap:balance;background:linear-gradient(100deg,#fff,#d2b8ff 55%,#ffbe55);-webkit-background-clip:text;background-clip:text;color:transparent}
.gl-intro p{color:#cbbbe8;max-width:34ch;margin:12px auto 22px;line-height:1.45}
.gl-go{border:0;border-radius:999px;padding:14px 30px;font:700 15px "Sora",system-ui,sans-serif;color:#1b0f00!important;background:linear-gradient(135deg,#ffd88a,#ffbe55);box-shadow:0 10px 40px rgba(255,190,85,.4)}
.gl-go:disabled{opacity:.6}
.gl-toast{position:absolute;left:50%;top:70px;transform:translateX(-50%);z-index:6;background:rgba(30,14,52,.94);border:1px solid rgba(210,184,255,.2);border-radius:999px;padding:8px 16px;font-size:13px;opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap}
.gl-toast.on{opacity:1}
.gl.em .gl-top{padding-top:10px}
.gl.em .gl-intro p{display:none}
`;

/** run({ root, cfg, src(id) → url of a picture or GLB, brand: {src, own, href} | null, url (to share), onClick(id),
 *       embedded (the maker's preview: nothing counted or shared), onPick(index) (the maker: a piece was tapped),
 *       onLayout({missing: [indexes that didn't fit]}) })
 * returns { update(cfg, brand), focus(index), shot() → Promise<Blob> (a picture of the room for Mi cuenta), destroy() } */
export function run(o) {
  if (!document.getElementById("gl-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "gl-css", textContent: CSS }));
  let cfg = o.cfg, brand = o.brand, alive = true;
  const D = () => cfg.galeria || {};
  const salaKey = () => SALAS[D().sala] ? D().sala : "clasica";
  const obras = () => (D().obras || []).slice(0, MAX);
  const count = id => { if (!o.embedded && o.onClick) o.onClick(id); };
  const MOBILE = matchMedia("(pointer: coarse)").matches;
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = document.createElement("div"); el.className = "gl" + (o.embedded ? " em" : "") + (MOBILE ? " joy" : "");
  el.innerHTML = `<canvas tabindex="0"></canvas>
    <div class="gl-top"><span data-logo></span><div class="gl-name" data-name></div>
      ${o.embedded ? "" : `<button class="gl-ic" type="button" data-share aria-label="Compartir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg></button>
      <button class="gl-ic" type="button" data-fs aria-label="Pantalla completa"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4"/></svg></button>`}</div>
    <div class="gl-pill off" data-hint></div>
    <button class="gl-tour" type="button" data-tour hidden>Iniciar recorrido →</button>
    <div class="gl-joy" data-joy ${MOBILE ? "" : "hidden"}><i></i></div>
    <div class="gl-card" data-card hidden><div class="ct"><b data-ct></b><span class="num" data-cn></span></div><div class="sz" data-cs></div><p data-cd></p>
      <div class="gl-nav"><button type="button" data-prev>← Anterior</button><button type="button" data-next>Siguiente →</button><button class="x" type="button" data-close aria-label="Cerrar">×</button></div></div>
    <div class="gl-intro" data-intro><div><div class="k">Galería en 3D</div><h1 data-ih></h1><p>Camina entre las obras, acércate a cada una y descubre su historia.</p><button class="gl-go" type="button" data-go disabled>Cargando…</button></div></div>
    <div class="gl-toast" data-toast></div>`;
  o.root.appendChild(el);
  const $ = s => el.querySelector(s);
  const canvas = $("canvas");
  let toastT;
  const toast = m => { const t = $("[data-toast]"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 1800); };

  /* ---------- renderer ---------- */
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
  catch { $("[data-go]").textContent = "Este navegador no puede mostrar 3D"; return { update() {}, focus() {}, shot: async () => null, destroy() { el.remove(); } }; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.6 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const ANISO = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture; scene.environment = envTex; pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(62, 1, .05, 400); camera.rotation.order = "YXZ";
  const owned = new Set();   // textures made here, freed on destroy
  const canvasTex = (cv, repeat) => {
    const t = new THREE.CanvasTexture(cv); owned.add(t); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
    return t;
  };
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const radial = (stops, size = 128) => {
    const cv = document.createElement("canvas"); cv.width = cv.height = size; const m = size / 2;
    const g = cv.getContext("2d"), gr = g.createRadialGradient(m, m, 1, m, m, m);
    for (const [k, c] of stops) gr.addColorStop(k, c);
    g.fillStyle = gr; g.fillRect(0, 0, size, size); return canvasTex(cv);
  };
  const GLOW = radial([[0, "rgba(255,255,255,1)"], [.35, "rgba(255,255,255,.35)"], [1, "rgba(255,255,255,0)"]]);
  const POOL = radial([[0, "rgba(255,236,205,.9)"], [.45, "rgba(255,236,205,.35)"], [1, "rgba(255,236,205,0)"]]);
  const SHADOW = radial([[0, "rgba(0,0,0,.6)"], [1, "rgba(0,0,0,0)"]]);
  const MAT = {
    easel: new THREE.MeshStandardMaterial({ color: 0xa6743f, roughness: .62, envMapIntensity: .4 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 1, roughness: .35 }),
    lens: new THREE.MeshBasicMaterial({ color: 0xfff4e0 }),
    passe: new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: .92, envMapIntensity: .2 }),
    side: new THREE.MeshStandardMaterial({ color: 0xebe5d8, roughness: .9, envMapIntensity: .2 }),
    plinth: new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: .7, envMapIntensity: .4 }),
    shadow: new THREE.MeshBasicMaterial({ map: SHADOW, transparent: true, depthWrite: false }),
  };
  const shared = new Set(Object.values(MAT));
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  /* ---------- rooms ---------- */
  // Each room: its meshes (R.group), the walls to hang on (segs: from (x1,z1) to (x2,z2), facing n, up to `top` m),
  // the floor spots for easels and 3D (spots: x, z, ry = where they face), the walkable area (rect or circle) and
  // obstacles (circles; walls as segments), where to start, its signs and how bright its lights are.
  function woodTexture([c1, c2], W, Dp) {   // planks that tile without seams (each texture covers 4 × 4 m)
    const S = 1024, cv = document.createElement("canvas"); cv.width = cv.height = S;
    const g = cv.getContext("2d"), a = hexRgb(c1), b = hexRgb(c2), pw = S / 8;
    const seg = (x, y, len) => {
      const t = Math.random(), j = rnd(-10, 10), col = a.map((v, i) => Math.round(v + (b[i] - v) * t + j));
      for (const oy of [-S, 0, S]) {
        g.fillStyle = `rgb(${col})`; g.fillRect(x, y + oy, pw, len); g.globalAlpha = .07;
        for (let k = 0; k < 16; k++) {
          g.strokeStyle = Math.random() < .5 ? "#000" : "#fff"; g.lineWidth = rnd(1, 2.5);
          const sx = x + rnd(4, pw - 4); g.beginPath(); g.moveTo(sx, y + oy);
          g.bezierCurveTo(sx + rnd(-6, 6), y + oy + len * .33, sx + rnd(-6, 6), y + oy + len * .66, sx + rnd(-4, 4), y + oy + len); g.stroke();
        }
        g.globalAlpha = 1; g.fillStyle = "rgba(0,0,0,.4)"; g.fillRect(x, y + oy, pw, 2);
      }
    };
    for (let i = 0; i < 8; i++) {
      let y = rnd(0, S), done = 0;
      while (done < S) { const len = Math.min(rnd(280, 640), S - done); seg(i * pw, y, len); y += len; done += len; }
      g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(i * pw, 0, 2, S);
    }
    return canvasTex(cv, [W / 4, Dp / 4]);
  }
  function concreteTexture(W, Dp) {   // polished concrete in 3 m slabs
    const S = 1024, cv = document.createElement("canvas"); cv.width = cv.height = S;
    const g = cv.getContext("2d"); g.fillStyle = "#c9c6c0"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) { const v = Math.random() < .5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${rnd(.015, .05)})`; const r = rnd(1, 7); g.fillRect(rnd(0, S), rnd(0, S), r, r); }
    for (let i = 0; i < 6; i++) { const gr = g.createRadialGradient(rnd(0, S), rnd(0, S), 10, rnd(0, S), rnd(0, S), rnd(150, 400)); gr.addColorStop(0, "rgba(120,115,108,.12)"); gr.addColorStop(1, "rgba(120,115,108,0)"); g.fillStyle = gr; g.fillRect(0, 0, S, S); }
    g.fillStyle = "rgba(70,66,60,.35)"; g.fillRect(0, 0, S, 2); g.fillRect(0, 0, 2, S);
    return canvasTex(cv, [W / 3, Dp / 3]);
  }
  function skyTexture() {   // a starry sky with a purple and gold nebula (equirectangular)
    const W = 2048, H = 1024, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"); g.fillStyle = "#03010a"; g.fillRect(0, 0, W, H);
    for (const [x, y, r, c] of [[500, 380, 520, "rgba(120,50,200,.35)"], [1400, 560, 640, "rgba(60,30,140,.35)"], [1000, 300, 380, "rgba(255,150,80,.14)"], [1750, 420, 420, "rgba(200,60,160,.2)"], [250, 620, 360, "rgba(40,90,200,.2)"]]) {
      const gr = g.createRadialGradient(x, y, 10, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    for (let i = 0; i < 4200; i++) {
      const y = H / 2 + (Math.random() - .5) * H * Math.random() * 1.9, s = Math.random() < .03 ? rnd(1.5, 2.6) : rnd(.4, 1.2);
      g.fillStyle = `rgba(255,${200 + Math.random() * 55 | 0},${200 + Math.random() * 55 | 0},${rnd(.4, 1)})`; g.beginPath(); g.arc(rnd(0, W), y, s, 0, 7); g.fill();
    }
    return canvasTex(cv);
  }
  function planetTexture() {   // a banded gas giant
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 512; const g = cv.getContext("2d");
    let y = 0; while (y < 512) { const h = rnd(6, 34); g.fillStyle = `hsl(${rnd(18, 42)},${rnd(45, 75)}%,${rnd(38, 70)}%)`; g.fillRect(0, y, 1024, h); y += h; }
    g.globalAlpha = .25; for (let i = 0; i < 60; i++) { g.fillStyle = Math.random() < .5 ? "#fff" : "#5a2a10"; g.fillRect(0, rnd(0, 512), 1024, rnd(1, 4)); }
    g.globalAlpha = .55; g.fillStyle = "#b5532a"; g.beginPath(); g.ellipse(640, 300, 70, 30, 0, 0, 7); g.fill();
    return canvasTex(cv);
  }
  function ringTexture() {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 8; const g = cv.getContext("2d");
    for (let x = 0; x < 512; x++) { g.fillStyle = `rgba(${220 + rnd(0, 35) | 0},${190 + rnd(0, 40) | 0},${150 + rnd(0, 60) | 0},${x < 30 || x > 490 ? 0 : rnd(.15, .7)})`; g.fillRect(x, 0, 1, 8); }
    return canvasTex(cv);
  }
  function platformTexture() {   // the glowing rings and grid of the floating floor (emissive map)
    const S = 1024, cv = document.createElement("canvas"); cv.width = cv.height = S; const g = cv.getContext("2d"), c = S / 2;
    g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
    g.strokeStyle = "rgba(160,90,255,.5)"; g.lineWidth = 2;
    for (let r = 60; r < c; r += 60) { g.globalAlpha = r % 180 === 0 ? 1 : .35; g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke(); }
    g.globalAlpha = .18; for (let a = 0; a < 24; a++) { g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a / 24 * 6.283) * c, c + Math.sin(a / 24 * 6.283) * c); g.stroke(); }
    g.globalAlpha = 1; g.lineWidth = 6; g.strokeStyle = "rgba(255,190,85,.8)"; g.beginPath(); g.arc(c, c, c - 8, 0, 7); g.stroke();
    return canvasTex(cv);
  }
  const seg = (x1, z1, x2, z2, nx, nz, top) => ({ x1, z1, x2, z2, nx, nz, top, len: Math.hypot(x2 - x1, z2 - z1) });

  function roomClasica() {
    const A = AMBIENTES[D().amb] || AMBIENTES.noche, W = 16, Dp = 26, H = 5, grp = new THREE.Group();
    const m = {
      wall: new THREE.MeshStandardMaterial({ color: A.wall, roughness: .93, envMapIntensity: .25 }),
      ceil: new THREE.MeshStandardMaterial({ color: A.ceil, roughness: 1, envMapIntensity: .15 }),
      floor: new THREE.MeshStandardMaterial({ map: woodTexture(A.floor, W, Dp), roughness: .42, envMapIntensity: .5 }),
      trim: new THREE.MeshStandardMaterial({ color: A.trim, emissive: A.trimI ? A.trim : 0, emissiveIntensity: A.trimI, roughness: .5 }),
      strip: new THREE.MeshBasicMaterial({ color: A.strip }),
      bench: new THREE.MeshStandardMaterial({ color: 0x2b1d2f, roughness: .55 }), benchTop: new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: .5 }),
    };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, Dp), m.floor); floor.rotation.x = -Math.PI / 2; floor.userData.floor = true; grp.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, Dp), m.ceil); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; grp.add(ceil);
    for (const [w, x, z, ry] of [[Dp, -W / 2, 0, Math.PI / 2], [Dp, W / 2, 0, -Math.PI / 2], [W, 0, -Dp / 2, 0], [W, 0, Dp / 2, Math.PI]]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, H), m.wall); wall.position.set(x, H / 2, z); wall.rotation.y = ry; grp.add(wall);
      const base = box(w, .05, .03, m.trim); base.position.set(x, .09, z); base.rotation.y = ry; base.translateZ(.015); grp.add(base);   // a glowing skirting
      const top = box(w, .03, .02, m.trim); top.position.set(x, H - .35, z); top.rotation.y = ry; top.translateZ(.01); grp.add(top);
    }
    for (const x of [-3.6, 3.6]) { const s = box(.1, .02, Dp - 4, m.strip); s.position.set(x, H - .01, 0); grp.add(s); }
    const top = box(.55, .08, 2.8, m.benchTop); top.position.y = .46; grp.add(top);
    const body = box(.46, .42, 2.6, m.bench); body.position.y = .21; grp.add(body);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3.6), MAT.shadow); sh.rotation.x = -Math.PI / 2; sh.position.y = .003; grp.add(sh);
    const hemi = new THREE.HemisphereLight(0xe8ddff, 0x20152a, A.hemi); grp.add(hemi);
    // easels along the walls (galleries with no wall pieces, as they always were) or in two rows down the middle
    const side = [], mid = [];
    for (const z of [9, 4.5, 0, -4.5, -9]) side.push({ x: -W / 2 + 2.1, z, ry: Math.PI / 2 }, { x: W / 2 - 2.1, z, ry: -Math.PI / 2 });
    side.push({ x: -2.6, z: -Dp / 2 + 2.3, ry: 0 }, { x: 2.6, z: -Dp / 2 + 2.3, ry: 0 });
    for (const z of [8.5, 4, -3.5, -8]) mid.push({ x: -2.8, z, ry: 0 }, { x: 2.8, z, ry: 0 });
    return {
      grp, mats: Object.values(m), floor, H, dark: A.dark, text: A.text, sub: A.sub, dust: { color: A.dot, add: A.dark, n: MOBILE ? 240 : 480, box: [W, H, Dp] },
      segs: [seg(-W / 2, 11.6, -W / 2, -11.6, 1, 0, 4.6), seg(-6.6, -Dp / 2, 6.6, -Dp / 2, 0, 1, 3.15), seg(W / 2, -11.6, W / 2, 11.6, -1, 0, 4.6), seg(6.6, Dp / 2, -6.6, Dp / 2, 0, -1, 3)],
      spots: mid, sideSpots: side, bounds: { rect: [W / 2 - .45, Dp / 2 - .45] }, obst: [-1.05, -.35, .35, 1.05].map(z => ({ x: 0, z, r: .42 })), walls: [],
      start: { x: 0, z: Dp / 2 - .6, to: Dp / 2 - 2.6 }, shot: { y: 2.1, z: Dp / 2 - 1, pitch: -.12 },
      name: { y: 3.75, z: -Dp / 2 + .02, w: 9 }, logo: { y: 3.6, z: Dp / 2 - .02, w: 4.2, h: 1.3 }, spotI: 46, speed: 2.4, poolI: A.dark ? .5 : .25,
    };
  }

  function roomMuseo() {
    const W = 26, Dp = 46, H = 9, grp = new THREE.Group();
    const m = {
      wall: new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: .95, envMapIntensity: .3 }),
      ceil: new THREE.MeshStandardMaterial({ color: 0xf6f5f2, roughness: 1, envMapIntensity: .2 }),
      floor: new THREE.MeshStandardMaterial({ map: concreteTexture(W, Dp), roughness: .26, metalness: .05, envMapIntensity: .9 }),
      sky: new THREE.MeshBasicMaterial({ color: 0xffffff }), beam: new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: .9 }),
      base: new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: .6 }),
    };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, Dp), m.floor); floor.rotation.x = -Math.PI / 2; floor.userData.floor = true; grp.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, Dp), m.ceil); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; grp.add(ceil);
    for (const [w, x, z, ry] of [[Dp, -W / 2, 0, Math.PI / 2], [Dp, W / 2, 0, -Math.PI / 2], [W, 0, -Dp / 2, 0], [W, 0, Dp / 2, Math.PI]]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, H), m.wall); wall.position.set(x, H / 2, z); wall.rotation.y = ry; grp.add(wall);
      const b = box(w, .08, .02, m.base); b.position.set(x, .04, z); b.rotation.y = ry; b.translateZ(.01); grp.add(b);   // a thin shadow gap at the floor
    }
    for (const x of [-7.5, 0, 7.5]) {   // three long skylights
      const s = box(2.6, .02, Dp - 8, m.sky); s.position.set(x, H - .01, 0); grp.add(s);
      for (let z = -Dp / 2 + 4; z <= Dp / 2 - 4; z += 2.6) { const bm = box(2.8, .18, .12, m.beam); bm.position.set(x, H - .1, z); grp.add(bm); }
    }
    // two free-standing walls in the hall: pieces hang on both faces
    const walls = [];
    for (const z of [8, -9]) {
      const pw = box(12, 5.6, .4, m.wall); pw.position.set(0, 2.8, z); grp.add(pw);
      const b = box(12.02, .08, .42, m.base); b.position.set(0, .04, z); grp.add(b);
      walls.push({ x1: -6, z1: z, x2: 6, z2: z, r: .2 });
    }
    grp.add(new THREE.HemisphereLight(0xffffff, 0xd8cfc0, 1.15));
    const sun = new THREE.DirectionalLight(0xfff6ea, 1.1); sun.position.set(4, 20, 6); grp.add(sun);
    // easels and 3D go to the sides first, so they don't cover the walls in the middle of the hall
    const spots = [];
    for (const z of [16, -.5, -16]) for (const x of [-7, 7]) spots.push({ x, z, ry: 0 });
    for (const z of [-.5, 16, -16]) spots.push({ x: 0, z, ry: 0 });
    return {
      grp, mats: Object.values(m), floor, H, dark: false, text: "#1d1626", sub: "#8b3fd6", dust: { color: 0xffd9a0, add: false, n: MOBILE ? 160 : 320, box: [W, H, Dp] },
      segs: [seg(-5.6, 8.21, 5.6, 8.21, 0, 1, 5.2), seg(-W / 2, 21, -W / 2, -21, 1, 0, 8.3), seg(-5.6, -8.79, 5.6, -8.79, 0, 1, 5.2), seg(-11.5, -Dp / 2, 11.5, -Dp / 2, 0, 1, 6.6),
        seg(5.6, -9.21, -5.6, -9.21, 0, -1, 5.2), seg(W / 2, -21, W / 2, 21, -1, 0, 8.3), seg(5.6, 7.79, -5.6, 7.79, 0, -1, 5.2), seg(11.5, Dp / 2, -11.5, Dp / 2, 0, -1, 6.6)],
      spots, bounds: { rect: [W / 2 - .45, Dp / 2 - .45] }, obst: [], walls,
      start: { x: 0, z: Dp / 2 - .8, to: Dp / 2 - 3.2 }, shot: { y: 2.6, z: Dp / 2 - 1, pitch: -.1 },
      name: { y: 7.6, z: -Dp / 2 + .02, w: 14 }, logo: { y: 7.6, z: Dp / 2 - .02, w: 6, h: 1.8 }, spotI: 30, speed: 3.4, poolI: .18,
    };
  }

  function roomEspacio() {
    const Rp = 17, PR = 15, grp = new THREE.Group(), anim = [];
    const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, toneMapped: false }));
    grp.add(sky); anim.push(t => { sky.rotation.y = t * .004; });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(30, 64, 32), new THREE.MeshStandardMaterial({ map: planetTexture(), roughness: .9 }));
    planet.position.set(-70, 26, -90); planet.rotation.z = .35; grp.add(planet); anim.push(t => { planet.rotation.y = t * .02; });
    const ring = new THREE.Mesh(new THREE.RingGeometry(38, 58, 96, 1), new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    { const uv = ring.geometry.attributes.uv, p = ring.geometry.attributes.position; for (let i = 0; i < uv.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (r - 38) / 20, .5); } }
    ring.position.copy(planet.position); ring.rotation.set(-1.25, .2, .35); grp.add(ring);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16), new THREE.MeshStandardMaterial({ color: 0xbfb6d6, roughness: 1 }));
    moon.position.set(48, 34, -60); grp.add(moon);
    const m = {
      floor: new THREE.MeshStandardMaterial({ color: 0x120c22, metalness: .55, roughness: .32, emissive: 0xffffff, emissiveMap: platformTexture(), emissiveIntensity: .9, envMapIntensity: .3 }),
      under: new THREE.MeshStandardMaterial({ color: 0x0a0714, metalness: .6, roughness: .5 }),
      panel: new THREE.MeshStandardMaterial({ color: 0x1b1430, metalness: .35, roughness: .45, envMapIntensity: .5 }),
      glow: new THREE.MeshBasicMaterial({ color: 0xb37bff, toneMapped: false }), gold: new THREE.MeshBasicMaterial({ color: 0xffbe55, toneMapped: false }),
    };
    const floor = new THREE.Mesh(new THREE.CircleGeometry(Rp, 96), m.floor); floor.rotation.x = -Math.PI / 2; floor.userData.floor = true; grp.add(floor);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(Rp, Rp * .55, 3, 96, 1, true), m.under); under.position.y = -1.5; grp.add(under);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(Rp, .06, 8, 160), m.gold); edge.rotation.x = Math.PI / 2; edge.position.y = .02; grp.add(edge);
    // floating panels in a ring, the gap toward the start (+z) is the entrance
    const segs = [];
    for (let k = 1; k <= 7; k++) {
      const a = k * Math.PI / 4, cx = Math.sin(a) * PR, cz = Math.cos(a) * PR, ux = Math.cos(a), uz = -Math.sin(a);
      const p = box(9, 6, .25, m.panel); p.position.set(cx, 3.35, cz); p.rotation.y = a; grp.add(p);
      for (const y of [.35, 6.35]) { const s = box(9, .05, .27, m.glow); s.position.set(cx, y, cz); s.rotation.y = a; grp.add(s); }
      segs.push(seg(cx - ux * 4.2 - Math.sin(a) * .13, cz - uz * 4.2 - Math.cos(a) * .13, cx + ux * 4.2 - Math.sin(a) * .13, cz + uz * 4.2 - Math.cos(a) * .13, -Math.sin(a), -Math.cos(a), 6.05));
    }
    grp.add(new THREE.HemisphereLight(0xc9b8ff, 0x1a1030, .7));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.4); sun.position.set(-20, 30, 10); grp.add(sun);
    const spots = [];
    for (let k = 0; k < 8; k++) { const a = (k + .5) * Math.PI / 4; spots.push({ x: Math.sin(a) * 7, z: Math.cos(a) * 7, ry: a }); }
    return {
      grp, mats: Object.values(m), floor, H: 7, dark: true, text: "#f3ecff", sub: "#ffbe55", dust: { color: 0xd2b8ff, add: true, n: MOBILE ? 260 : 520, box: [32, 9, 32] },
      segs, spots, bounds: { circle: 13.6 }, obst: [], walls: [], anim,
      start: { x: 0, z: 13, to: 11.2 }, shot: { y: 3, z: 13.4, pitch: -.12 },
      name: { y: 8.4, z: -PR, w: 11, float: true }, logo: { y: 8.4, z: PR + 1, w: 5, h: 1.5, float: true }, spotI: 40, speed: 2.8, poolI: .35,
    };
  }

  /* ---------- shared pieces: signs, sparkles, aim ---------- */
  const nameMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 440 / 2048), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false })); scene.add(nameMesh);
  const logoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false })); logoMesh.rotation.y = Math.PI; scene.add(logoMesh);
  const aim = new THREE.Mesh(new THREE.RingGeometry(.2, .26, 40), new THREE.MeshBasicMaterial({ color: 0xd2b8ff, transparent: true, opacity: .7, depthWrite: false }));
  aim.rotation.x = -Math.PI / 2; aim.visible = false; scene.add(aim);
  let dust = null, dustV = null;
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");

  let room = null, roomKey = "";
  function buildRoom() {
    if (room) {
      room.grp.traverse(x => {
        if (x.geometry) x.geometry.dispose();
        if (x.material && !shared.has(x.material)) for (const t of [x.material.map, x.material.emissiveMap]) if (t && t !== GLOW && owned.delete(t)) t.dispose();
        if (x.material && !shared.has(x.material)) x.material.dispose();
      });
      scene.remove(room.grp);
    }
    if (dust) { scene.remove(dust); dust.geometry.dispose(); dust.material.dispose(); }
    const k = salaKey();
    room = k === "museo" ? roomMuseo() : k === "espacio" ? roomEspacio() : roomClasica();
    scene.add(room.grp);
    scene.background = k === "espacio" ? null : new THREE.Color(0x05020b);
    const [bx, by, bz] = room.dust.box, n = room.dust.n, pos = new Float32Array(n * 3); dustV = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set([rnd(-bx / 2, bx / 2), rnd(0, by), rnd(-bz / 2, bz / 2)], i * 3); dustV[i] = rnd(.02, .09); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: GLOW, color: room.dust.color, size: .045, transparent: true, opacity: room.dust.add ? .75 : .3, depthWrite: false, blending: room.dust.add ? THREE.AdditiveBlending : THREE.NormalBlending }));
    scene.add(dust);
    const N = room.name; nameMesh.position.set(0, N.y, N.z); nameMesh.scale.set(N.w, N.w, 1);
    const L = room.logo; logoMesh.position.set(0, L.y, L.z);
    drawName(); drawLogo();
  }
  function drawName() {
    const cv = document.createElement("canvas"); cv.width = 2048; cv.height = 440;
    const g = cv.getContext("2d"), name = D().name || cfg.title || ""; g.textAlign = "center"; g.textBaseline = "middle";
    let size = 170; g.font = `600 ${size}px Sora, sans-serif`;
    while (g.measureText(name || " ").width > 1900 && size > 60) { size -= 6; g.font = `600 ${size}px Sora, sans-serif`; }
    if (room.name.float) { g.shadowColor = "rgba(160,90,255,.9)"; g.shadowBlur = 40; }
    g.fillStyle = room.text; g.fillText(name, 1024, brand && !brand.own ? 190 : 220);
    if (brand && !brand.own) {   // "Galerías Vórtice VR" only with Vórtice VR's logo
      g.font = "600 52px Sora, sans-serif"; g.fillStyle = room.sub; if ("letterSpacing" in g) g.letterSpacing = "14px";
      g.fillText("GALERÍAS VÓRTICE VR", 1024, 365);
    }
    const old = nameMesh.material.map; nameMesh.material.map = canvasTex(cv); nameMesh.material.needsUpdate = true; if (old) { owned.delete(old); old.dispose(); }
    $("[data-name]").textContent = name; $("[data-ih]").textContent = name || "Galería";
  }
  const logoTex = new Map();
  async function drawLogo() {
    // Vórtice VR's logo only in its original purple or in white; the brand's own as it is; none = no logo
    const src = !brand ? "" : brand.own ? brand.src : room.dark ? LOGO.blanco : LOGO.morado;
    logoMesh.visible = !!src;
    const top = $("[data-logo]");
    top.innerHTML = brand ? `<img class="${brand.own ? "own" : ""}" src="${esc(brand.src)}" alt="">` : "";
    if (brand && brand.href && !o.embedded) top.innerHTML = `<a href="${esc(brand.href)}" target="_blank" rel="noopener">${top.innerHTML}</a>`;
    if (!src) return;
    try {
      if (!logoTex.has(src)) logoTex.set(src, loader.loadAsync(src).then(t => { t.colorSpace = THREE.SRGBColorSpace; owned.add(t); return t; }));
      const t = await logoTex.get(src); if (!alive) return;
      logoMesh.material.map = t; logoMesh.material.needsUpdate = true;
      const k = Math.min(room.logo.w / t.image.width, room.logo.h / t.image.height);
      logoMesh.scale.set(t.image.width * k, t.image.height * k, 1);
    } catch { logoMesh.visible = false; }
  }

  /* ---------- pieces ---------- */
  function beam(a, b, t) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = box(t, A.distanceTo(B), t, MAT.easel);
    m.position.copy(A).add(B).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize());
    return m;
  }
  function buildEasel() {
    const g = new THREE.Group();
    g.add(beam([-.44, 0, .13], [-.17, 1.98, -.07], .045), beam([.44, 0, .13], [.17, 1.98, -.07], .045));   // front legs
    g.add(beam([0, 0, -.8], [0, 1.86, -.11], .04), beam([0, .5, .06], [0, 2.42, -.135], .05));            // back leg and mast
    g.add(beam([-.38, .56, .085], [.38, .56, .085], .035));
    const ledge = box(.98, .035, .14, MAT.easel); ledge.position.set(0, .86, .1); g.add(ledge);
    const lip = box(.98, .05, .015, MAT.easel); lip.position.set(0, .89, .17); g.add(lip);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.9), MAT.shadow); sh.rotation.x = -Math.PI / 2; sh.position.set(0, .002, -.2); g.add(sh);
    return g;
  }
  const frameMats = {};
  function fmat(k) {
    if (frameMats[k]) return frameMats[k];
    const F = FRAMES[k];
    const m = { main: new THREE.MeshStandardMaterial({ color: F.color, metalness: F.metal || 0, roughness: F.rough ?? .5, emissive: F.emissive || 0, emissiveIntensity: F.emissive ? 2.6 : 0 }) };
    if (F.bead) m.bead = new THREE.MeshStandardMaterial({ color: F.bead, metalness: 1, roughness: .2 });
    if (F.lip) m.lip = new THREE.MeshStandardMaterial({ color: F.lip, metalness: F.metal || 0, roughness: .45 });
    for (const x of Object.values(m)) shared.add(x);
    return frameMats[k] = m;
  }
  // a moulding of 4 pieces of width w around a hole iw × ih
  function ring(g, iw, ih, w, d, z, mat, cy) {
    for (const [bw, bh, x, y] of [[iw + 2 * w, w, 0, ih / 2 + w / 2], [iw + 2 * w, w, 0, -ih / 2 - w / 2], [w, ih, -iw / 2 - w / 2, 0], [w, ih, iw / 2 + w / 2, 0]]) {
      const m = box(bw, bh, d, mat); m.position.set(x, cy + y, z); g.add(m);
    }
  }
  // the framed picture standing on y = 0 (w × h = the picture itself, in meters); returns its outer size
  function buildArt(ob, tex, w, h, lit) {
    const k = FRAMES[ob.frame] ? ob.frame : "dorado", F = FRAMES[k], g = new THREE.Group();
    const mw = ob.mat && !F.lienzo ? Math.max(.06, Math.min(w, h) * .09) : 0;
    const iw = w + 2 * mw, ih = h + 2 * mw, cy = F.f + ih / 2;
    // a little self-light so the picture reads as lit by its spot (any room, any light)
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: F.lienzo ? .85 : .6, envMapIntensity: .25, color: tex ? 0xffffff : 0xece6da, emissive: tex ? 0xffffff : 0, emissiveMap: tex, emissiveIntensity: lit }));
    pic.position.set(0, cy, .0125); g.add(pic);
    const depth = F.lienzo ? .045 : .022, board = box(iw, ih, depth, F.lienzo ? MAT.side : MAT.passe);
    board.position.set(0, cy, .012 - depth / 2); g.add(board);
    if (F.f) {
      const m = fmat(k), back = -.008;
      ring(g, iw, ih, F.f, F.d, back + F.d / 2, m.main, cy);
      if (m.bead) ring(g, iw + F.f * .7, ih + F.f * .7, F.f * .26, F.d + .014, back + (F.d + .014) / 2, m.bead, cy);
      if (m.lip) ring(g, iw - .024, ih - .024, .012, .012, .0185, m.lip, cy);
    }
    if (F.glow) {
      const halo = new THREE.Mesh(new THREE.PlaneGeometry((iw + .2) * 1.9, (ih + .2) * 1.7), new THREE.MeshBasicMaterial({ map: GLOW, color: 0x9b4dff, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.set(0, cy, -.04); halo.userData.glow = true; g.add(halo);
    }
    return { g, OW: iw + 2 * F.f, OH: ih + 2 * F.f };
  }
  function addSpot(parent, x, y, z, tx, ty, tz, intensity, color = 0xfff1dc) {
    const spot = new THREE.SpotLight(color, intensity, 0, .38, .6, 2); spot.position.set(x, y, z); spot.target.position.set(tx, ty, tz);
    parent.add(spot, spot.target);
    const fix = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, .16, 20), MAT.metal); fix.position.set(x, y, z); parent.add(fix);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.065, 20), MAT.lens); lens.rotation.x = Math.PI / 2; lens.position.set(x, y - .085, z); parent.add(lens);
  }

  const texCache = new Map(), modelCache = new Map();
  const texFor = url => {
    if (!url) return Promise.resolve(null);
    if (!texCache.has(url)) texCache.set(url, loader.loadAsync(url).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; owned.add(t); return t; }).catch(() => null));
    return texCache.get(url);
  };
  const modelFor = url => {
    if (!url) return Promise.resolve(null);
    if (!modelCache.has(url)) modelCache.set(url, gltfTools().then(T => T.loader.loadAsync(url)).catch(e => { console.warn("3D", e); return null; }));
    return modelCache.get(url);
  };

  const pieces = new THREE.Group(); scene.add(pieces);
  let placed = [], glows = [], mixers = [], turners = [], OBST = [], buildN = 0, loading = Promise.resolve();
  function freePieces() {
    pieces.traverse(x => { if (x.userData.cached) return; if (x.geometry && !x.userData.cachedGeo) x.geometry.dispose(); if (x.material && !shared.has(x.material) && !x.userData.cachedMat) x.material.dispose(); });
    pieces.clear(); placed = []; glows = []; mixers = []; turners = [];
  }
  function tag(g, i) { g.traverse(x => { if (x.isMesh) x.userData.obra = i; }); }

  async function build() {
    const n = ++buildN, list = obras(), sala = salaKey();
    // everything loads first (sizes come from the files), then the room is laid out in one go
    const assets = await Promise.all(list.map(ob => ob.model ? modelFor(o.src(ob.model)) : texFor(o.src(ob.img))));
    if (!alive || n !== buildN) return;
    const tools = list.some(ob => ob.model) ? await gltfTools().catch(() => null) : null;
    if (!alive || n !== buildN) return;
    freePieces();
    const R = room, missing = [];
    OBST = [...R.obst];
    // walls: each takes the next pieces that fit (with room between them), evenly spread along it
    const wallIdx = list.map((ob, i) => i).filter(i => !list[i].model && mountOf(list[i], sala) === "pared");
    const sizes = new Map();
    for (const i of wallIdx) {
      const tex = assets[i], a = tex && tex.image ? tex.image.width / tex.image.height : 1, rs = realSize(list[i], a);
      sizes.set(i, rs ? { w: rs.w / 100, h: rs.h / 100 } : a >= 1 ? { w: 1, h: 1 / a } : { w: a, h: 1 });   // no measures: 1 m on its long side
    }
    const outer = i => { const F = FRAMES[list[i].frame] || FRAMES.dorado, s = sizes.get(i), mw = list[i].mat && !F.lienzo ? Math.max(.06, Math.min(s.w, s.h) * .09) : 0; return { w: s.w + 2 * (mw + F.f), h: s.h + 2 * (mw + F.f) }; };
    const GAP = .7, fits = i => { const ow = outer(i); return R.segs.some(S => ow.h + .2 <= S.top && ow.w + 2 * GAP <= S.len); };
    const queue = wallIdx.filter(i => fits(i) || (missing.push(i), false));   // bigger than every wall of this room
    for (const S of R.segs) {
      if (!queue.length) break;
      const take = []; let used = GAP;
      while (queue.length) {
        const i = queue[0], ow = outer(i);
        if (ow.h + .2 > S.top || used + ow.w + GAP > S.len) break;   // it goes on the next wall
        take.push(i); used += ow.w + GAP; queue.shift();
      }
      if (!take.length) continue;
      const free = (S.len - (used - GAP * (take.length + 1))) / (take.length + 1);
      const ux = (S.x2 - S.x1) / S.len, uz = (S.z2 - S.z1) / S.len, ry = Math.atan2(S.nx, S.nz);
      let at = free;
      for (const i of take) {
        const ow = outer(i), s = sizes.get(i), mid = at + ow.w / 2; at += ow.w + free;
        const cy = clamp(Math.max(1.6, ow.h / 2 + .45), ow.h / 2 + .1, S.top - ow.h / 2);
        const art = buildArt(list[i], assets[i], s.w, s.h, .22);
        const x = S.x1 + ux * mid + S.nx * .02, z = S.z1 + uz * mid + S.nz * .02;
        art.g.position.set(x, cy - art.OH / 2, z); art.g.rotation.y = ry;
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(art.OW + 1.6, art.OH + 2.2), new THREE.MeshBasicMaterial({ map: POOL, transparent: true, opacity: R.poolI, depthWrite: false, blending: R.dark ? THREE.AdditiveBlending : THREE.NormalBlending }));
        pool.position.set(0, art.OH / 2 + .35, -.03); art.g.add(pool);   // the warm light of its spot on the wall
        tag(art.g, i); pieces.add(art.g);
        placed[i] = { cx: x, cy, cz: z, nx: S.nx, nz: S.nz, w: art.OW, h: art.OH, size: list[i].w || list[i].h ? `${Math.round(s.w * 100)} × ${Math.round(s.h * 100)} cm` : "" };
      }
    }
    missing.push(...queue);
    // the floor: easels and 3D take the spots in order (in the classic room, easels go along the walls when no picture hangs there)
    const floorIdx = list.map((ob, i) => i).filter(i => list[i].model || mountOf(list[i], sala) === "caballete");
    const useSide = sala === "clasica" && !wallIdx.length && !floorIdx.some(i => list[i].model);
    const spots = [...(useSide ? R.sideSpots : R.spots)];
    let lights = 0;
    for (const i of floorIdx) {
      const sp = spots.shift(); if (!sp) { missing.push(i); continue; }
      const ob = list[i], root = new THREE.Group(); root.position.set(sp.x, 0, sp.z); root.rotation.y = sp.ry;
      const fx = Math.sin(sp.ry), fz = Math.cos(sp.ry);
      if (ob.model) {
        const gltf = assets[i], s = clamp((Number(ob.s) || 80) / 100, .1, 6), onPed = mountOf(ob, sala) === "pedestal";
        let topY = 0;
        if (onPed) {
          const pw = clamp(s * .8, .45, 1.2), ph = clamp(1.1 - s * .25, .5, .95);
          const ped = box(pw, ph, pw, MAT.plinth); ped.position.y = ph / 2; root.add(ped); topY = ph;
          if (R.dark) { const rim = new THREE.Mesh(new THREE.TorusGeometry(pw * .55, .012, 6, 48), new THREE.MeshBasicMaterial({ color: 0xb37bff, toneMapped: false })); rim.rotation.x = Math.PI / 2; rim.position.y = ph + .005; root.add(rim); }
        } else {
          const plate = new THREE.Mesh(new THREE.CylinderGeometry(s * .6, s * .62, .04, 48), MAT.plinth); plate.position.y = .02; root.add(plate); topY = .04;
        }
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(s * 1.8 + .6, s * 1.8 + .6), MAT.shadow); sh.rotation.x = -Math.PI / 2; sh.position.y = .003; root.add(sh);
        const turn = new THREE.Group(); turn.position.y = topY; root.add(turn);
        let h = .3;
        if (gltf && tools) {
          const m = tools.clone(gltf.scene);
          m.traverse(x => { if (x.isMesh) { x.userData.cachedGeo = true; x.userData.cachedMat = true; } });
          const bb = new THREE.Box3().setFromObject(m), sz = bb.getSize(new THREE.Vector3()), k = s / Math.max(sz.x, sz.y, sz.z, 1e-6);
          m.scale.setScalar(k); const c = bb.getCenter(new THREE.Vector3());
          m.position.set(-c.x * k, -bb.min.y * k, -c.z * k); turn.add(m); h = sz.y * k;
          if (gltf.animations && gltf.animations.length) { const mx = new THREE.AnimationMixer(m); mx.clipAction(gltf.animations[0]).play(); mixers.push(mx); }
        } else {   // the file could not be read: a placeholder so the spot isn't empty
          const q = new THREE.Mesh(new THREE.IcosahedronGeometry(s * .35), new THREE.MeshStandardMaterial({ color: 0x8b3fd6, roughness: .4 })); q.position.y = s * .35; turn.add(q); h = s * .7;
        }
        if (ob.gira && !REDUCED) turners.push(turn);
        OBST.push({ x: sp.x, z: sp.z, r: Math.max(.5, s * .6) });
        if (lights < 10) { addSpot(root, 0, R.H - .12, 1.6, 0, topY + h / 2, 0, R.spotI * .8); lights++; }
        tag(root, i); pieces.add(root);
        placed[i] = { cx: sp.x, cy: topY + h / 2, cz: sp.z, nx: fx, nz: fz, w: s, h: Math.max(h, .3), model: true, size: ob.s ? `${Math.round(s * 100)} cm` : "" };
      } else {
        root.add(buildEasel());
        const tex = assets[i], a = tex && tex.image ? tex.image.width / tex.image.height : .8, rs = realSize(ob, a);
        let w, h2;
        if (rs) { w = rs.w / 100; h2 = rs.h / 100; const k = Math.min(1, 1.6 / w, 1.8 / h2); w *= k; h2 *= k; }   // an easel holds up to 1.6 × 1.8 m
        else { w = 1.1; h2 = w / a; if (h2 > 1.3) { h2 = 1.3; w = h2 * a; } }
        const holder = new THREE.Group(); holder.position.set(0, .89, .14); holder.rotation.x = -.1; root.add(holder);
        const art = buildArt(ob, tex, w, h2, 0); holder.add(art.g);
        const clampM = box(.12, .055, .09, MAT.easel); clampM.position.set(0, art.OH + .02, -.04); holder.add(clampM);
        for (const x of art.g.children) if (x.userData.glow) glows.push(x);
        OBST.push({ x: sp.x - fx * .25, z: sp.z - fz * .25, r: .7 });
        if (lights < 10) { addSpot(root, 0, R.H - .12, 1.9, 0, 1.5, .1, R.spotI, ob.frame === "neon" ? 0xe9d8ff : 0xfff1dc); lights++; }
        tag(root, i); pieces.add(root);
        placed[i] = { cx: sp.x + fx * .1, cy: .89 + art.OH / 2, cz: sp.z + fz * .1, nx: fx, nz: fz, w: art.OW, h: art.OH, size: rs ? `${Math.round(w * 100)} × ${Math.round(h2 * 100)} cm` : "" };
      }
    }
    pieces.traverse(x => { if (x.userData.glow && !glows.includes(x)) glows.push(x); });
    if (o.onLayout) o.onLayout({ missing: missing.sort((a, b) => a - b) });
    if (focusI >= 0 && !placed[focusI]) { focusI = -1; showCard(); }
    $("[data-tour]").hidden = !!(focusI >= 0 || !placed.some(Boolean) || state !== "in");
  }
  function rebuild() { loading = build().catch(e => console.error(e)); return loading; }

  /* ---------- walking and looking ---------- */
  const player = { x: 0, z: 0, yaw: 0, pitch: -.03 };
  let anim = null, bob = 0, focusI = -1, state = "intro";
  const keys = new Set(), joy = { x: 0, y: 0 };
  function resolve(x, z) {
    const B = room.bounds;
    if (B.rect) { x = clamp(x, -B.rect[0], B.rect[0]); z = clamp(z, -B.rect[1], B.rect[1]); }
    else { const d = Math.hypot(x, z); if (d > B.circle) { x *= B.circle / d; z *= B.circle / d; } }
    for (const b of OBST) {
      const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz), r = b.r + BODY;
      if (d < r) { if (d < 1e-4) x += r; else { x = b.x + dx / d * r; z = b.z + dz / d * r; } }
    }
    for (const w of room.walls) {   // free-standing walls: push out of the segment
      const ux = w.x2 - w.x1, uz = w.z2 - w.z1, L2 = ux * ux + uz * uz, t = clamp(((x - w.x1) * ux + (z - w.z1) * uz) / L2, 0, 1);
      const px = w.x1 + ux * t, pz = w.z1 + uz * t, dx = x - px, dz = z - pz, d = Math.hypot(dx, dz), r = w.r + BODY;
      if (d < r) { if (d < 1e-4) z += r; else { x = px + dx / d * r; z = pz + dz / d * r; } }
    }
    return [x, z];
  }
  function goTo(x, z, yaw = player.yaw, pitch = player.pitch, dur) {
    const dy = ((yaw - player.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    anim = { x0: player.x, z0: player.z, a0: player.yaw, p0: player.pitch, x, z, a: player.yaw + dy, p: pitch, t: 0,
      dur: REDUCED ? .01 : dur ?? clamp(Math.max(Math.hypot(x - player.x, z - player.z) / (room.speed * 1.4), Math.abs(dy) / 2.4), .6, 3) };
  }
  const size = () => [el.clientWidth || 1, el.clientHeight || 1];
  function focus(i, dur) {
    const P = placed[i]; if (!P) return;
    // far enough to see the whole piece; on a tall screen the card takes the bottom, so look lower to sit it higher
    const [w, h] = size(), tall = w < h, tv = Math.tan(camera.fov * Math.PI / 360), asp = w / h;
    let dist = Math.max((P.h * (tall ? 1.7 : 1.3)) / 2 / tv, P.w * 1.25 / 2 / (tv * asp), P.model ? 1.8 : 1.7) + (P.model ? P.w * .5 : 0);
    let nx = P.nx, nz = P.nz;
    if (P.model) { const dx = player.x - P.cx, dz = player.z - P.cz, d = Math.hypot(dx, dz); if (d > .5) { nx = dx / d; nz = dz / d; } }   // a 3D piece: from where you are
    let [x, z] = resolve(P.cx + nx * dist, P.cz + nz * dist);
    dist = Math.hypot(x - P.cx, z - P.cz);
    const ty = tall ? P.cy - P.h * .18 : P.cy;
    goTo(x, z, Math.atan2(-(P.cx - x), -(P.cz - z)), Math.atan2(ty - EYE, dist), dur);
    focusI = i; showCard(); sfx.whoosh(.35);
  }
  function update(dt, raw) {
    if (anim) {
      anim.t += Math.min(raw, .25) / anim.dur;   // real time: a slow phone gets there on time too
      const k = ease(Math.min(1, anim.t));
      player.x = anim.x0 + (anim.x - anim.x0) * k; player.z = anim.z0 + (anim.z - anim.z0) * k;
      player.yaw = anim.a0 + (anim.a - anim.a0) * k; player.pitch = anim.p0 + (anim.p - anim.p0) * k;
      if (anim.t >= 1) anim = null;
    } else if (state === "in") {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
      const k = c => !typing && keys.has(c);
      let f = (k("KeyW") || k("ArrowUp")) - (k("KeyS") || k("ArrowDown")) + joy.y, s = k("KeyD") - k("KeyA") + joy.x;
      const turn = k("ArrowLeft") - k("ArrowRight"); if (turn) player.yaw += turn * 1.8 * dt;
      const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
      if (len > .05) {
        const v = room.speed * (k("ShiftLeft") || k("ShiftRight") ? 1.8 : 1) * dt, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
        [player.x, player.z] = resolve(player.x + (-sy * f + cy * s) * v, player.z + (-cy * f - sy * s) * v);
        if (!REDUCED) bob += dt * 9 * Math.min(1, len);
        if (focusI >= 0) { focusI = -1; showCard(); }
      }
    }
    camera.position.set(player.x, EYE + (REDUCED ? 0 : Math.sin(bob) * .018), player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
  }

  /* ---------- taps, mouse and keys ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hitAt(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const h of ray.intersectObjects([room.floor, pieces], true)) {
      if (h.object.userData.obra !== undefined) return { obra: h.object.userData.obra };
      if (h.object.userData.floor) return { floor: h.point };
    }
    return null;
  }
  let drag = null, hoverQ = false;
  const offs = [];
  const on = (t, ev, f, opt) => { t.addEventListener(ev, f, opt); offs.push(() => t.removeEventListener(ev, f, opt)); };
  on(canvas, "pointerdown", e => {
    if (drag || state !== "in") return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true });
  });
  on(canvas, "pointermove", e => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 5) { anim = null; const k = MOBILE ? .0055 : .0042; player.yaw += dx * k; player.pitch = clamp(player.pitch + dy * k * .85, -1.15, 1.15); }
      aim.visible = false;
    } else if (e.pointerType === "mouse" && state === "in" && !hoverQ) {
      hoverQ = true;
      requestAnimationFrame(() => {
        hoverQ = false; if (!alive) return;
        const h = hitAt(e.clientX, e.clientY);
        canvas.style.cursor = h?.obra !== undefined ? "pointer" : h?.floor ? "crosshair" : "grab";
        aim.visible = !!h?.floor; if (h?.floor) aim.position.set(h.floor.x, .01, h.floor.z);
      });
    }
  });
  const endDrag = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const tap = drag.moved < 8 && performance.now() - drag.t < 500; drag = null;
    if (tap && e.type === "pointerup") onTap(e.clientX, e.clientY);
  };
  on(canvas, "pointerup", endDrag); on(canvas, "pointercancel", endDrag);
  on(canvas, "pointerleave", () => { aim.visible = false; });
  function onTap(cx, cy) {
    const h = hitAt(cx, cy); if (!h) return;
    if (h.obra !== undefined) { focus(h.obra); if (o.onPick) o.onPick(h.obra); return; }
    const [x, z] = resolve(h.floor.x, h.floor.z); goTo(x, z); sfx.tap();
    if (focusI >= 0) { focusI = -1; showCard(); }
  }
  // keys: the whole page at the link; in the maker only while the room has the focus
  const keyTarget = o.embedded ? canvas : window;
  on(keyTarget, "keydown", e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || state !== "in") return;
    keys.add(e.code);
    if (/^(Arrow|Key[WASD])/.test(e.code)) { anim = null; e.preventDefault(); }
  });
  on(keyTarget, "keyup", e => keys.delete(e.code));
  on(window, "blur", () => keys.clear());
  const joyEl = $("[data-joy]"), knob = joyEl.querySelector("i"); let joyId = null;
  const joyMove = e => {
    const r = joyEl.getBoundingClientRect(), R = r.width / 2;
    let x = e.clientX - r.left - R, y = e.clientY - r.top - R; const d = Math.hypot(x, y);
    if (d > R * .8) { x *= R * .8 / d; y *= R * .8 / d; }
    knob.style.transform = `translate(${x}px,${y}px)`; joy.x = x / (R * .8); joy.y = -y / (R * .8); anim = null;
  };
  on(joyEl, "pointerdown", e => { joyId = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); });
  on(joyEl, "pointermove", e => { if (e.pointerId === joyId) joyMove(e); });
  for (const ev of ["pointerup", "pointercancel"]) on(joyEl, ev, e => { if (e.pointerId !== joyId) return; joyId = null; joy.x = joy.y = 0; knob.style.transform = ""; });

  /* ---------- card, tour and buttons ---------- */
  const shown = () => obras().map((_, i) => i).filter(i => placed[i]);
  function showCard() {
    const ob = focusI >= 0 ? obras()[focusI] : null;
    $("[data-card]").hidden = !ob;
    $("[data-tour]").hidden = !!(ob || !shown().length || state !== "in");
    if (!ob) return;
    $("[data-hint]").classList.add("off");
    const list = shown();
    $("[data-ct]").textContent = ob.t || "Sin título";
    $("[data-cs]").textContent = placed[focusI]?.size || "";
    $("[data-cd]").textContent = ob.d || "";
    $("[data-cn]").textContent = `${list.indexOf(focusI) + 1} de ${list.length}`;
    $("[data-prev]").disabled = $("[data-next]").disabled = list.length < 2;
  }
  function step(dir) {
    const list = shown(); if (!list.length) return;
    const k = focusI < 0 ? (dir > 0 ? 0 : list.length - 1) : (list.indexOf(focusI) + dir + list.length) % list.length;
    focus(list[k]);
  }
  $("[data-prev]").onclick = () => step(-1);
  $("[data-next]").onclick = () => step(1);
  $("[data-close]").onclick = () => { sfx.tap(); focusI = -1; showCard(); };
  $("[data-tour]").onclick = () => { count("tour"); step(1); };
  if (!o.embedded) {
    $("[data-fs]").onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else (document.documentElement.requestFullscreen?.() || Promise.reject()).catch(() => toast("Este navegador no permite pantalla completa"));
    };
    $("[data-share]").onclick = async () => {
      sfx.tap(); count("share");
      const url = o.url || location.href, text = `Mira esta galería en 3D: ${D().name || cfg.title || ""}`;
      try { if (navigator.share) { await navigator.share({ title: D().name || cfg.title, text, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(url); toast("Link copiado"); } catch { toast(url); }
    };
  }
  let hintT;
  function hint() {
    const h = $("[data-hint]");
    h.textContent = MOBILE ? "Arrastra para mirar · el control camina · toca el piso o una obra" : "Arrastra para mirar · WASD o flechas para caminar · clic en el piso para ir · clic en una obra para verla";
    h.classList.remove("off"); clearTimeout(hintT); hintT = setTimeout(() => h.classList.add("off"), 6000);
  }
  function placeStart() { player.x = room.start.x; player.z = room.start.z; player.yaw = 0; player.pitch = -.03; }
  function enter() {
    if (state === "in") return;
    state = "in"; sfx.appear();
    const it = $("[data-intro]"); it.classList.add("out"); setTimeout(() => { it.hidden = true; }, 700);
    placeStart(); goTo(room.start.x, room.start.to, 0, -.03, 1.8);
    hint(); showCard(); canvas.focus({ preventScroll: true });
  }
  $("[data-go]").onclick = enter;

  /* ---------- loop ---------- */
  const ro = new ResizeObserver(() => {
    const [w, h] = size(); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w < h ? 72 : 62; camera.updateProjectionMatrix();
  });
  ro.observe(el);
  let vis = true;
  const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; }); io.observe(el);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const raw = clock.getDelta(), dt = Math.min(raw, .1), t = clock.elapsedTime;
    if (!vis || !room) return;
    update(dt, raw);
    for (const m of mixers) m.update(dt);
    for (const g of turners) g.rotation.y += dt * .35;
    if (!REDUCED) {
      const p = dust.geometry.attributes.position.array, top = room.dust.box[1];
      for (let i = 0; i < dustV.length; i++) { p[i * 3 + 1] += dustV[i] * dt; p[i * 3] += Math.sin(t * .4 + i) * .002; if (p[i * 3 + 1] > top) p[i * 3 + 1] = 0; }
      dust.geometry.attributes.position.needsUpdate = true;
      for (const g of glows) g.material.opacity = .45 + Math.sin(t * 2.2) * .15;
      for (const f of room.anim || []) f(t);
      if (room.name.float) { nameMesh.position.y = room.name.y + Math.sin(t * .8) * .12; logoMesh.position.y = room.logo.y + Math.sin(t * .8 + 1) * .12; }
      if (state === "intro") player.yaw = Math.sin(t * .25) * .18;   // a slow look around behind the intro
    }
    renderer.render(scene, camera);
  });

  async function start() {
    await document.fonts?.load("600 40px Sora").catch(() => {});
    if (!alive) return;
    buildRoom(); roomKey = keyOfRoom(); nameKey = D().name; placeStart();
    await rebuild();
    if (!alive) return;
    readyBtn();
  }
  function readyBtn() {
    const go = $("[data-go]"); if (state !== "intro") return;
    go.disabled = !obras().length; go.textContent = obras().length ? "Entrar a la galería" : "La galería está vacía";
  }
  let nameKey = "";
  const keyOfRoom = () => salaKey() + (salaKey() === "clasica" ? (AMBIENTES[D().amb] ? D().amb : "noche") : "");
  start();

  return {
    update(c, b) {
      cfg = c; const brandChanged = b !== undefined && JSON.stringify(b) !== JSON.stringify(brand); if (b !== undefined) brand = b;
      if (!room) return;
      const rk = keyOfRoom();
      if (rk !== roomKey) { roomKey = rk; buildRoom(); placeStart(); if (state === "in") goTo(room.start.x, room.start.to, 0, -.03, .01); }
      else if (D().name !== nameKey || brandChanged) { drawName(); if (brandChanged) drawLogo(); }
      nameKey = D().name;
      if (focusI >= obras().length) focusI = -1;
      rebuild(); showCard(); readyBtn();
    },
    focus(i) { if (state !== "in") enter(); setTimeout(() => focus(i), 60); },
    // a picture of the room from the entrance (Mi cuenta), once every piece is in place
    async shot() {
      await loading;
      const c = document.createElement("canvas"); c.width = 800; c.height = 600;
      const pr = renderer.getPixelRatio(), [w, h] = size(), cam = camera.clone();
      cam.aspect = 4 / 3; cam.fov = 66; cam.position.set(0, room.shot.y, room.shot.z); cam.rotation.set(room.shot.pitch, 0, 0); cam.updateProjectionMatrix();
      renderer.setPixelRatio(1); renderer.setSize(800, 600, false); renderer.render(scene, cam);
      c.getContext("2d").drawImage(canvas, 0, 0);
      renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
      return new Promise(r => c.toBlob(r, "image/jpeg", .86));
    },
    destroy() {
      alive = false; renderer.setAnimationLoop(null); ro.disconnect(); io.disconnect(); offs.forEach(f => f()); clearTimeout(hintT); clearTimeout(toastT);
      scene.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); });
      owned.forEach(x => x.dispose()); envTex.dispose(); renderer.dispose(); el.remove();
    },
  };
}
