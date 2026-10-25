// Galería 3D (/x/ when the experience is kind "galeria"; made in /crear/galeria/, whose preview runs this same file).
// A room of art that is walked through on the phone or the computer: easels with the customer's pictures, each with
// its frame (FRAMES) and, if they want, a white mat (passe-partout); a spotlight over each easel and floating sparkles.
// Drag to look; WASD/arrows or the joystick (phone) to walk; tap the floor to go there; tap a picture to see it with its
// card (title and description); "Iniciar recorrido" goes from one to the next.
// cfg.galeria = { name, amb: noche | blanca | museo, obras: [{ id, img (an item "foto"), frame, mat, t, d }] } (1 to 12).
// The pictures go on the easels in PLACES order (left, right, left… from the entrance to the back, then the back wall).
// Counted: tour, share (o.onClick).
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { sfx } from "./sonidos.js";

export const MAX = 12;
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
export const AMBIENTES = {
  noche: { t: "Noche Vórtice", wall: 0x1c1528, ceil: 0x0c0812, floor: ["#3b2a22", "#2a1c16"], trim: 0x8b3fd6, trimI: 2.2, strip: 0xd9c6ff, text: "#f3ecff", sub: "#ffbe55", dark: true, hemi: .32, dot: 0xd2b8ff },
  blanca: { t: "Galería blanca", wall: 0xeeece7, ceil: 0xf6f4f0, floor: ["#c39466", "#a97b4f"], trim: 0xd8d4cc, trimI: 0, strip: 0xfff6e8, text: "#1d1626", sub: "#8b3fd6", dark: false, hemi: 1.1, dot: 0xffbe55 },
  museo: { t: "Museo", wall: 0x5a1d29, ceil: 0x160a0d, floor: ["#4a3020", "#36211a"], trim: 0xffbe55, trimI: .9, strip: 0xffe2b8, text: "#f8e9cc", sub: "#ffbe55", dark: true, hemi: .45, dot: 0xffd27a },
};

const RW = 16, RD = 26, RH = 5, EYE = 1.62, SPEED = 2.4, BODY = .3;
// easels: left and right walls alternating from the entrance to the back, then the two of the back wall
const L = -RW / 2 + 2.1, R = RW / 2 - 2.1, PLACES = [];
for (const z of [9, 4.5, 0, -4.5, -9]) PLACES.push({ x: L, z, ry: Math.PI / 2 }, { x: R, z, ry: -Math.PI / 2 });
PLACES.push({ x: -2.6, z: -RD / 2 + 2.3, ry: 0 }, { x: 2.6, z: -RD / 2 + 2.3, ry: 0 });

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const LOGO = { blanco: new URL("logo-vorticevr-blanco.png", import.meta.url).href, morado: new URL("logo-vorticevr.png", import.meta.url).href };

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

/** run({ root, cfg, src(id) → url of a picture, brand: {src, own, href} | null, url (to share), onClick(id),
 *       embedded (the maker's preview: nothing counted or shared), onPick(index) (the maker: a picture was tapped) })
 * returns { update(cfg, brand), focus(index), shot() → Promise<Blob> (a picture of the room for Mi cuenta), destroy() } */
export function run(o) {
  if (!document.getElementById("gl-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "gl-css", textContent: CSS }));
  let cfg = o.cfg, brand = o.brand, alive = true;
  const D = () => cfg.galeria || {};
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
    <div class="gl-card" data-card hidden><div class="ct"><b data-ct></b><span class="num" data-cn></span></div><p data-cd></p>
      <div class="gl-nav"><button type="button" data-prev>← Anterior</button><button type="button" data-next>Siguiente →</button><button class="x" type="button" data-close aria-label="Cerrar">×</button></div></div>
    <div class="gl-intro" data-intro><div><div class="k">Galería en 3D</div><h1 data-ih></h1><p>Camina entre las obras, acércate a cada una y descubre su historia.</p><button class="gl-go" type="button" data-go disabled>Cargando…</button></div></div>
    <div class="gl-toast" data-toast></div>`;
  o.root.appendChild(el);
  const $ = s => el.querySelector(s);
  const canvas = $("canvas");
  let toastT;
  const toast = m => { const t = $("[data-toast]"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 1800); };

  /* ---------- renderer and room ---------- */
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
  const camera = new THREE.PerspectiveCamera(62, 1, .05, 80); camera.rotation.order = "YXZ";
  const hemi = new THREE.HemisphereLight(0xe8ddff, 0x20152a, .4); scene.add(hemi);
  const owned = [];   // textures and geometries to free on destroy
  const keep = x => { owned.push(x); return x; };
  const canvasTex = (cv, repeat) => {
    const t = keep(new THREE.CanvasTexture(cv)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
    return t;
  };
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  // wooden planks that tile without seams (each texture covers 4 × 4 m: 8 planks of 50 cm)
  function woodTexture([c1, c2]) {
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
    return canvasTex(cv, [RW / 4, RD / 4]);
  }
  const radial = (stops) => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 128;
    const g = cv.getContext("2d"), gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    for (const [k, c] of stops) gr.addColorStop(k, c);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return canvasTex(cv);
  };
  const GLOW = radial([[0, "rgba(255,255,255,1)"], [.35, "rgba(255,255,255,.35)"], [1, "rgba(255,255,255,0)"]]);
  const MAT = {
    wall: new THREE.MeshStandardMaterial({ roughness: .93, envMapIntensity: .25 }),
    ceil: new THREE.MeshStandardMaterial({ roughness: 1, envMapIntensity: .15 }),
    floor: new THREE.MeshStandardMaterial({ roughness: .42, envMapIntensity: .5 }),
    trim: new THREE.MeshStandardMaterial({ roughness: .5 }),
    strip: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    easel: new THREE.MeshStandardMaterial({ color: 0xa6743f, roughness: .62, envMapIntensity: .4 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 1, roughness: .35 }),
    passe: new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: .92, envMapIntensity: .2 }),
    side: new THREE.MeshStandardMaterial({ color: 0xebe5d8, roughness: .9, envMapIntensity: .2 }),
    bench: new THREE.MeshStandardMaterial({ color: 0x2b1d2f, roughness: .55 }),
    benchTop: new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: .5 }),
    shadow: new THREE.MeshBasicMaterial({ map: radial([[0, "rgba(0,0,0,.6)"], [1, "rgba(0,0,0,0)"]]), transparent: true, depthWrite: false }),
  };
  const shared = new Set(Object.values(MAT));
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), MAT.floor); floor.rotation.x = -Math.PI / 2; floor.userData.floor = true; scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), MAT.ceil); ceil.rotation.x = Math.PI / 2; ceil.position.y = RH; scene.add(ceil);
  for (const [w, x, z, ry] of [[RD, -RW / 2, 0, Math.PI / 2], [RD, RW / 2, 0, -Math.PI / 2], [RW, 0, -RD / 2, 0], [RW, 0, RD / 2, Math.PI]]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, RH), MAT.wall); wall.position.set(x, RH / 2, z); wall.rotation.y = ry; scene.add(wall);
    const base = box(w, .05, .03, MAT.trim); base.position.set(x, .09, z); base.rotation.y = ry; base.translateZ(.015); scene.add(base);   // a glowing skirting
    const top = box(w, .03, .02, MAT.trim); top.position.set(x, RH - .35, z); top.rotation.y = ry; top.translateZ(.01); scene.add(top);
  }
  for (const x of [-3.6, 3.6]) { const s = box(.1, .02, RD - 4, MAT.strip); s.position.set(x, RH - .01, 0); scene.add(s); }   // light strips on the ceiling
  const OBST = [];
  {   // a bench in the middle
    const top = box(.55, .08, 2.8, MAT.benchTop); top.position.y = .46; scene.add(top);
    const body = box(.46, .42, 2.6, MAT.bench); body.position.y = .21; scene.add(body);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3.6), MAT.shadow); sh.rotation.x = -Math.PI / 2; sh.position.y = .003; scene.add(sh);
    for (const z of [-1.05, -.35, .35, 1.05]) OBST.push({ x: 0, z, r: .42 });
  }
  // signs: the gallery's name on the back wall, the logo over the entrance
  const nameMesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 9 * 440 / 2048), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
  nameMesh.position.set(0, 3.75, -RD / 2 + .02); scene.add(nameMesh);
  const logoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
  logoMesh.position.set(0, 3.6, RD / 2 - .02); logoMesh.rotation.y = Math.PI; scene.add(logoMesh);
  // sparkles floating in the light
  const DUST = MOBILE ? 240 : 480, dustGeo = new THREE.BufferGeometry(), dustPos = new Float32Array(DUST * 3), dustV = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) { dustPos.set([rnd(-RW / 2, RW / 2), rnd(0, RH), rnd(-RD / 2, RD / 2)], i * 3); dustV[i] = rnd(.02, .09); }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ map: GLOW, size: .045, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(dustGeo, dustMat));
  // the ring on the floor where the mouse would walk to
  const aim = new THREE.Mesh(new THREE.RingGeometry(.2, .26, 40), new THREE.MeshBasicMaterial({ color: 0xd2b8ff, transparent: true, opacity: .7, depthWrite: false }));
  aim.rotation.x = -Math.PI / 2; aim.visible = false; scene.add(aim);

  const amb = () => AMBIENTES[D().amb] || AMBIENTES.noche;
  let ambKey = "", nameKey = "";
  function drawName() {
    const A = amb(), cv = document.createElement("canvas"); cv.width = 2048; cv.height = 440;
    const g = cv.getContext("2d"), name = D().name || cfg.title || ""; g.textAlign = "center"; g.textBaseline = "middle";
    let size = 170; g.font = `600 ${size}px Sora, sans-serif`;
    while (g.measureText(name || " ").width > 1900 && size > 60) { size -= 6; g.font = `600 ${size}px Sora, sans-serif`; }
    g.fillStyle = A.text; g.fillText(name, 1024, brand && !brand.own ? 190 : 220);
    if (brand && !brand.own) {   // "Galerías Vórtice VR" only with Vórtice VR's logo
      g.font = "600 52px Sora, sans-serif"; g.fillStyle = A.sub; if ("letterSpacing" in g) g.letterSpacing = "14px";
      g.fillText("GALERÍAS VÓRTICE VR", 1024, 365);
    }
    nameMesh.material.map = canvasTex(cv); nameMesh.material.needsUpdate = true;
    $("[data-name]").textContent = name; $("[data-ih]").textContent = name || "Galería";
  }
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
  async function drawLogo() {
    // Vórtice VR's logo only in its original purple or in white; the brand's own as it is; none = no logo
    const src = !brand ? "" : brand.own ? brand.src : amb().dark ? LOGO.blanco : LOGO.morado;
    logoMesh.visible = !!src; if (!src) return;
    try {
      const t = keep(await loader.loadAsync(src)); t.colorSpace = THREE.SRGBColorSpace;
      if (!alive) return;
      logoMesh.material.map = t; logoMesh.material.needsUpdate = true;
      const k = Math.min(4.2 / t.image.width, 1.3 / t.image.height);
      logoMesh.scale.set(t.image.width * k, t.image.height * k, 1);
    } catch { logoMesh.visible = false; }
    const top = $("[data-logo]");
    top.innerHTML = brand ? `<img class="${brand.own ? "own" : ""}" src="${esc(brand.src)}" alt="">` : "";
    if (brand && brand.href && !o.embedded) top.innerHTML = `<a href="${esc(brand.href)}" target="_blank" rel="noopener">${top.innerHTML}</a>`;
  }
  function applyAmb() {
    const A = amb();
    MAT.wall.color.setHex(A.wall); MAT.ceil.color.setHex(A.ceil);
    MAT.trim.color.setHex(A.trim); MAT.trim.emissive.setHex(A.trimI ? A.trim : 0); MAT.trim.emissiveIntensity = A.trimI;
    MAT.strip.color.setHex(A.strip);
    MAT.floor.map = woodTexture(A.floor); MAT.floor.needsUpdate = true;
    hemi.intensity = A.hemi; dustMat.color.setHex(A.dot);
    dustMat.blending = A.dark ? THREE.AdditiveBlending : THREE.NormalBlending; dustMat.opacity = A.dark ? .75 : .35;
  }

  /* ---------- easels and pictures ---------- */
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
  // the whole piece (frame, mat and picture) standing on y = 0; it fits in 1.18 × 1.42 m
  function buildArt(ob, tex, aspect) {
    const k = FRAMES[ob.frame] ? ob.frame : "dorado", F = FRAMES[k], g = new THREE.Group();
    const mw = ob.mat && !F.lienzo ? .08 : 0, pad = mw + F.f;
    let w = 1.18 - 2 * pad, h = w / aspect; if (h > 1.42 - 2 * pad) { h = 1.42 - 2 * pad; w = h * aspect; }
    const iw = w + 2 * mw, ih = h + 2 * mw, cy = pad + h / 2;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: F.lienzo ? .85 : .6, envMapIntensity: .25, color: tex ? 0xffffff : 0xece6da }));
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
    const clampM = box(.12, .055, .09, MAT.easel); clampM.position.set(0, ih + 2 * F.f + .02, -.04); g.add(clampM);
    return g;
  }
  const easels = PLACES.map((p, i) => {
    const root = new THREE.Group(); root.position.set(p.x, 0, p.z); root.rotation.y = p.ry; root.visible = false;
    root.add(buildEasel());
    const holder = new THREE.Group(); holder.position.set(0, .89, .14); holder.rotation.x = -.1; root.add(holder);
    const spot = new THREE.SpotLight(0xfff1dc, 0, 0, .38, .6, 2); spot.position.set(0, RH - .12, 1.9); spot.target.position.set(0, 1.5, .1);
    root.add(spot, spot.target);
    const fix = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, .16, 20), MAT.metal); fix.position.copy(spot.position); root.add(fix);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.065, 20), MAT.strip); lens.rotation.x = Math.PI / 2; lens.position.set(0, RH - .2, 1.9); root.add(lens);
    root.traverse(x => { if (x.isMesh) x.userData.slot = i; });
    scene.add(root);
    const dir = new THREE.Vector3(Math.sin(p.ry), 0, Math.cos(p.ry));
    return { ...p, i, root, holder, spot, dir, key: "", obst: { x: p.x - dir.x * .25, z: p.z - dir.z * .25, r: .7 } };
  });

  const texCache = new Map();   // url → Promise<texture>
  const texFor = url => {
    if (!url) return Promise.resolve(null);
    if (!texCache.has(url)) texCache.set(url, loader.loadAsync(url).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return keep(t); }).catch(() => null));
    return texCache.get(url);
  };
  function freeGroup(g) {
    g.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material && !shared.has(x.material)) x.material.dispose(); });
    g.clear();
  }
  let glows = [], loading = Promise.resolve();
  function build() {
    const list = obras(), jobs = [];
    OBST.length = 4;
    easels.forEach((E, i) => {
      const ob = list[i];
      E.root.visible = !!ob; E.spot.intensity = ob ? 46 : 0;
      if (!ob) { if (E.key) { freeGroup(E.holder); E.key = ""; } return; }
      OBST.push(E.obst);
      const url = o.src(ob.img), key = [url, ob.frame, !!ob.mat].join("|");
      E.spot.color.setHex(ob.frame === "neon" ? 0xe9d8ff : 0xfff1dc);
      if (E.key === key) return;
      E.key = key;
      jobs.push(texFor(url).then(tex => {
        if (!alive || E.key !== key) return;
        const a = tex && tex.image ? tex.image.width / tex.image.height : .8;
        freeGroup(E.holder); E.holder.add(buildArt(ob, tex, a));
        E.root.traverse(x => { if (x.isMesh) x.userData.slot = i; });
        glows = []; for (const e of easels) e.holder.traverse(x => { if (x.userData.glow) glows.push(x); });
      }));
    });
    loading = Promise.all(jobs);
    $("[data-tour]").hidden = !!(focusI >= 0 || !list.length || state !== "in");
    return loading;
  }

  /* ---------- walking and looking ---------- */
  const player = { x: 0, z: RD / 2 - .6, yaw: 0, pitch: -.03 };
  let anim = null, bob = 0, focusI = -1, state = "intro";
  const keys = new Set(), joy = { x: 0, y: 0 };
  function resolve(x, z) {
    x = clamp(x, -RW / 2 + .45, RW / 2 - .45); z = clamp(z, -RD / 2 + .45, RD / 2 - .45);
    for (const b of OBST) {
      const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz), r = b.r + BODY;
      if (d < r) { if (d < 1e-4) x += r; else { x = b.x + dx / d * r; z = b.z + dz / d * r; } }
    }
    return [x, z];
  }
  function goTo(x, z, yaw = player.yaw, pitch = player.pitch, dur) {
    const dy = ((yaw - player.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    anim = { x0: player.x, z0: player.z, a0: player.yaw, p0: player.pitch, x, z, a: player.yaw + dy, p: pitch, t: 0,
      dur: REDUCED ? .01 : dur ?? clamp(Math.max(Math.hypot(x - player.x, z - player.z) / 3.2, Math.abs(dy) / 2.4), .6, 2.4) };
  }
  const size = () => [el.clientWidth || 1, el.clientHeight || 1];
  function focus(i, dur) {
    const E = easels[i]; if (!E || !E.root.visible) return;
    // on a tall screen the card takes the bottom: look lower so the picture sits higher
    const [w, h] = size(), tall = w < h, dist = tall ? 3.1 : 2.35;
    const x = E.x + E.dir.x * dist, z = E.z + E.dir.z * dist;
    goTo(x, z, Math.atan2(-(E.x - x), -(E.z - z)), Math.atan2((tall ? 1.05 : 1.45) - EYE, dist), dur);
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
        const v = SPEED * (k("ShiftLeft") || k("ShiftRight") ? 1.8 : 1) * dt, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
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
    for (const h of ray.intersectObjects([floor, ...easels.filter(e => e.root.visible).map(e => e.root)], true)) {
      if (h.object.userData.slot !== undefined) return { slot: h.object.userData.slot };
      if (h.object.userData.floor) return { floor: h.point };
    }
    return null;
  }
  let drag = null, hoverQ = false;
  const on = (t, ev, f, opt) => { t.addEventListener(ev, f, opt); offs.push(() => t.removeEventListener(ev, f, opt)); };
  const offs = [];
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
        canvas.style.cursor = h?.slot !== undefined ? "pointer" : h?.floor ? "crosshair" : "grab";
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
    if (h.slot !== undefined) { focus(h.slot); if (o.onPick) o.onPick(h.slot); return; }
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
  // the phone's joystick
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
  const filled = () => obras().map((_, i) => i);
  function showCard() {
    const ob = focusI >= 0 ? obras()[focusI] : null;
    $("[data-card]").hidden = !ob;
    $("[data-tour]").hidden = !!(ob || !obras().length || state !== "in");
    if (!ob) return;
    $("[data-hint]").classList.add("off");
    $("[data-ct]").textContent = ob.t || "Sin título";
    $("[data-cd]").textContent = ob.d || "";
    $("[data-cn]").textContent = `${focusI + 1} de ${obras().length}`;
    $("[data-prev]").disabled = $("[data-next]").disabled = obras().length < 2;
  }
  function step(dir) {
    const list = filled(); if (!list.length) return;
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
  function enter() {
    if (state === "in") return;
    state = "in"; sfx.appear();
    const it = $("[data-intro]"); it.classList.add("out"); setTimeout(() => { it.hidden = true; }, 700);
    player.z = RD / 2 - .6; goTo(0, RD / 2 - 2.6, 0, -.03, 1.8);
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
    if (!vis) return;
    update(dt, raw);
    if (!REDUCED) {
      const p = dustGeo.attributes.position.array;
      for (let i = 0; i < DUST; i++) { p[i * 3 + 1] += dustV[i] * dt; p[i * 3] += Math.sin(t * .4 + i) * .002; if (p[i * 3 + 1] > RH) p[i * 3 + 1] = 0; }
      dustGeo.attributes.position.needsUpdate = true;
      for (const g of glows) g.material.opacity = .45 + Math.sin(t * 2.2) * .15;
      if (state === "intro") player.yaw = Math.sin(t * .25) * .18;   // a slow look around behind the intro
    }
    renderer.render(scene, camera);
  });

  async function start() {
    await document.fonts?.load("600 40px Sora").catch(() => {});
    if (!alive) return;
    applyAmb(); drawName(); drawLogo(); ambKey = D().amb; nameKey = D().name;
    await build();
    if (!alive) return;
    const go = $("[data-go]"); go.disabled = false; go.textContent = obras().length ? "Entrar a la galería" : "La galería está vacía";
    if (!obras().length) go.disabled = true;
  }
  start();

  return {
    update(c, b) {
      cfg = c; const brandChanged = b !== undefined && JSON.stringify(b) !== JSON.stringify(brand); if (b !== undefined) brand = b;
      if (D().amb !== ambKey) { applyAmb(); ambKey = D().amb; drawName(); drawLogo(); }
      else if (D().name !== nameKey || brandChanged) { drawName(); if (brandChanged) drawLogo(); }
      nameKey = D().name;
      if (focusI >= obras().length) focusI = -1;
      build(); showCard();
      const go = $("[data-go]"); if (state === "intro") { go.disabled = !obras().length; go.textContent = obras().length ? "Entrar a la galería" : "La galería está vacía"; }
    },
    focus(i) { if (state !== "in") enter(); setTimeout(() => focus(i), state === "in" && !anim ? 0 : 50); },
    // a picture of the room from the entrance (Mi cuenta), once every picture is on its easel
    async shot() {
      await loading;
      const c = document.createElement("canvas"); c.width = 800; c.height = 600;
      const pr = renderer.getPixelRatio(), [w, h] = size(), cam = camera.clone();
      cam.aspect = 4 / 3; cam.fov = 66; cam.position.set(0, 2.1, RD / 2 - 1); cam.rotation.set(-.12, 0, 0); cam.updateProjectionMatrix();
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
