// Galería 3D (/x/ when the experience is kind "galeria"; made in /crear/galeria/, whose preview runs this same file).
// An art exhibition walked through on the phone or the computer, in one or more rooms (salas) joined by portals.
// Each room is of a type (SALAS): the classic room (with its ambiences), a huge minimalist museum or a gallery floating in
// space, and it is built to the size its pieces need (fewer pieces, a smaller room). Each piece (obra) is:
//  - a picture on the wall at its real size (w or h in cm; it keeps its proportion inside those measures) or on an easel,
//    with its frame (FRAMES) and, if they want, a white mat (passe-partout);
//  - a 3D object (GLB) on a square pedestal of its frame's color, or on the floor; s = its largest side in cm.
// As in a real exhibition, the room's text (texto) hangs first, right of the entrance, and the pieces follow to the right:
// the walls take them in order (each wall the next ones that fit, evenly spread); easels and 3D take the floor spots in
// order. Whatever doesn't fit is reported (o.onLayout) and not shown.
// Drag to look; WASD/arrows or the joystick (phone) to walk; tap the floor to go there; tap a piece (or the text) to see
// its card; "Iniciar recorrido" goes through the text and the pieces, room after room.
// cfg.galeria = { name, autor, salas: [{ tipo: clasica | museo | espacio, amb (clasica: noche | blanca | museo),
//   nombre, texto, obras: [ { id, img (an item "foto"), mount: pared | caballete, w, h (cm), frame, mat, t, d } |
//   { id, model (an item "model"), mount: pedestal | piso, s (cm), frame (the pedestal's), gira, t, d } ] }] }
// Galleries from before ({sala, amb, obras}, no mount) are one classic room with easels (salasOf).
// Counted: tour, share (o.onClick).
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { sfx } from "./sonidos.js";

export const MAX = 20, MAX_3D = 6;   // per room
export const SALAS = {
  clasica: { t: "Sala clásica", d: "Un cuarto de galería con caballetes. Elige su ambiente." },
  museo: { t: "Gran museo", d: "Una nave blanca y alta, con muros para obras de varios metros." },
  espacio: { t: "Galería en el espacio", d: "Paneles que flotan entre estrellas y planetas." },
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
// the rooms of a gallery (one classic room for the galleries from before)
export function salasOf(g) {
  g = g || {};
  if (Array.isArray(g.salas) && g.salas.length) return g.salas;
  return [{ tipo: SALAS[g.sala] ? g.sala : "clasica", amb: g.amb, obras: g.obras || [] }];
}
// where a piece goes when the maker hasn't chosen: easels in the classic room, walls elsewhere
export const mountOf = (ob, tipo) => ob.model ? (ob.mount === "piso" ? "piso" : "pedestal") : ob.mount === "pared" || ob.mount === "caballete" ? ob.mount : tipo && tipo !== "clasica" ? "pared" : "caballete";
// the real size of a picture in cm from what the artist wrote (width, height or both) and its proportion; null = not given
export function realSize(ob, aspect) {
  let w = Number(ob.w) || 0, h = Number(ob.h) || 0;
  if (w && h) { if (w / h > aspect) w = h * aspect; else h = w / aspect; }   // the picture inside the box, never stretched
  else if (w) h = w / aspect;
  else if (h) w = h * aspect;
  else return null;
  return { w, h };
}

const EYE = 1.62, BODY = .3, GAP = .7, TXT = { w: 1.3, h: 1.8 };
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const LOGO = { blanco: new URL("logo-vorticevr-blanco.png", import.meta.url).href, morado: new URL("logo-vorticevr.png", import.meta.url).href };
const salaName = (s, i) => s.nombre || `Sala ${i + 1}`;

/* ---------- the rooms' plans: walls to hang on, floor spots, size (no meshes yet) ---------- */
// seg = a wall to hang on, from (x1,z1) to (x2,z2) (the pieces go in that direction), facing n, pieces up to `top` m
const seg = (x1, z1, x2, z2, nx, nz, top) => ({ x1, z1, x2, z2, nx, nz, top, len: Math.hypot(x2 - x1, z2 - z1) });
const SIZES = { clasica: 5, museo: 4, espacio: 6 };   // how many sizes each room comes in
function specOf(tipo, k, amb, next) {
  if (tipo === "museo") {
    const D = [22, 30, 38, 46][k], W = [20, 22, 24, 26][k], hw = W / 2, hd = D / 2, H = 9;
    const parts = k === 0 ? [] : k === 1 ? [0] : [D / 6, -D / 6], L = 12, pl = L / 2 - .4, e = hw - 1.5;
    const segs = [seg(hw, hd - 2, hw, -(hd - 2), -1, 0, 8.3)];   // the right wall first
    if (next) segs.push(seg(e, -hd, 3, -hd, 0, 1, 6.6), seg(-3, -hd, -e, -hd, 0, 1, 6.6)); else segs.push(seg(e, -hd, -e, -hd, 0, 1, 6.6));
    segs.push(seg(-hw, -(hd - 2), -hw, hd - 2, 1, 0, 8.3));
    for (const z of parts) segs.push(seg(pl, z + .21, -pl, z + .21, 0, 1, 5.2), seg(-pl, z - .21, pl, z - .21, 0, -1, 5.2));
    segs.push(seg(-e, hd, e, hd, 0, -1, 6.6));
    const bands = [hd, ...parts, -hd], zs = [];
    for (let i = 0; i < bands.length - 1; i++) { const a = bands[i], b = bands[i + 1]; if (a - b > 7) zs.push((a + b) / 2); }
    if (!parts.length) zs.splice(0, zs.length, hd - 6, -(hd - 6));
    const sx = hw - 5, spots = [...zs.map(z => ({ x: sx, z, ry: 0 })), ...[...zs].reverse().map(z => ({ x: -sx, z, ry: 0 })), ...zs.map(z => ({ x: 0, z, ry: 0 }))];
    return { tipo, k, W, D, H, hw, hd, parts, segs, spots, bounds: { rect: [hw - .45, hd - .45] }, obst: [], walls: parts.map(z => ({ x1: -L / 2, z1: z, x2: L / 2, z2: z, r: .2 })),
      start: { x: 0, z: hd - .8, to: hd - 3.2 }, shot: { y: 2.6, z: hd - 1, pitch: -.1 }, name: { y: 7.6, z: -hd + .02, w: 14 }, logo: { y: 7.6, z: hd - .02, w: 6, h: 1.8 },
      portal: next ? { x: 0, z: -hd + 1.8, ry: 0 } : null, spotI: 30, speed: 3.2, poolI: .18, dark: false };
  }
  if (tipo === "espacio") {
    const n = 3 + k, R = 7 + n * 1.1, segs = [], spots = [];
    for (let j = 0; j < n; j++) {   // panels in a ring from the right of the entrance (+z) around to its left
      const a = Math.PI / 4 + j * 1.5 * Math.PI / (n - 1), cx = Math.sin(a) * R, cz = Math.cos(a) * R, ux = -Math.cos(a), uz = Math.sin(a), f = .14;
      segs.push(Object.assign(seg(cx - ux * 3.8 - Math.sin(a) * f, cz - uz * 3.8 - Math.cos(a) * f, cx + ux * 3.8 - Math.sin(a) * f, cz + uz * 3.8 - Math.cos(a) * f, -Math.sin(a), -Math.cos(a), 4.45), { a, cx, cz }));
    }
    const r = R * .45;
    for (let j = 0; j < 8; j++) { const a = Math.PI / 8 + j * Math.PI / 4; spots.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, ry: a }); }
    return { tipo, k, R, H: 6, segs, spots, bounds: { circle: R - 1.2 }, obst: next ? [{ x: 0, z: 0, r: 1.3 }] : [], walls: [],
      start: { x: 0, z: R - 1.6, to: R - 3.4 }, shot: { y: 3, z: R - 1.4, pitch: -.14 }, name: { y: 6.4, z: -R - 1, w: 10, float: true }, logo: { y: 6.4, z: R + 2.5, w: 5, h: 1.5, float: true },
      portal: next ? { x: 0, z: 0, ry: 0 } : null, spotI: 40, speed: 2.8, poolI: .35, dark: true };
  }
  const A = AMBIENTES[amb] || AMBIENTES.noche, W = 16, D = 14 + 4 * k, hw = W / 2, hd = D / 2, e = hd - 1.4, H = 5;
  const segs = [seg(hw, e, hw, -e, -1, 0, 4.6)];
  if (next) segs.push(seg(6.6, -hd, 2.2, -hd, 0, 1, 3.15), seg(-2.2, -hd, -6.6, -hd, 0, 1, 3.15)); else segs.push(seg(6.6, -hd, -6.6, -hd, 0, 1, 3.15));
  segs.push(seg(-hw, -e, -hw, e, 1, 0, 4.6), seg(-6.6, hd, 6.6, hd, 0, -1, 3));
  // easels along the walls (galleries with only easels, as they always were) or in two rows down the middle
  const zs = []; for (let z = hd - 4; z > -hd + 3; z -= 4.5) zs.push(z);
  const side = [...zs.map(z => ({ x: hw - 2.1, z, ry: -Math.PI / 2 })), { x: 2.6, z: -hd + 2.3, ry: 0 }, { x: -2.6, z: -hd + 2.3, ry: 0 }, ...[...zs].reverse().map(z => ({ x: -(hw - 2.1), z, ry: Math.PI / 2 }))];
  const mz = []; for (let z = hd - 3.5; z > -hd + 3.5; z -= 4.5) mz.push(z);
  const mid = [...mz.map(z => ({ x: 2.8, z, ry: 0 })), ...[...mz].reverse().map(z => ({ x: -2.8, z, ry: 0 }))];
  const bench = D >= 22;
  return { tipo, k, A, W, D, H, hw, hd, segs, spots: mid, sideSpots: side, bench, bounds: { rect: [hw - .45, hd - .45] }, obst: bench ? [-1.05, -.35, .35, 1.05].map(z => ({ x: 0, z, r: .42 })) : [], walls: [],
    start: { x: 0, z: hd - .6, to: hd - 2.4 }, shot: { y: 2.1, z: hd - 1, pitch: -.12 }, name: { y: 3.75, z: -hd + .02, w: 9 }, logo: { y: 3.6, z: hd - .02, w: 4.2, h: 1.3 },
    portal: next ? { x: 0, z: -hd + 1.2, ry: 0 } : null, spotI: 46, speed: 2.4, poolI: A.dark ? .5 : .25, dark: A.dark };
}
// the walls take the pieces in order: each wall the next ones that fit (70 cm between them), evenly spread
function planWalls(spec, items) {
  const missing = [], out = [];
  const fits = it => spec.segs.some(S => it.h + .2 <= S.top && it.w + 2 * GAP <= S.len);
  const queue = items.filter(it => fits(it) || (missing.push(it.key), false));   // bigger than every wall of this room
  for (const S of spec.segs) {
    if (!queue.length) break;
    const take = []; let used = GAP;
    while (queue.length) {
      const it = queue[0];
      if (it.h + .2 > S.top || used + it.w + GAP > S.len) break;   // it goes on the next wall
      take.push(it); used += it.w + GAP; queue.shift();
    }
    if (!take.length) continue;
    const free = (S.len - take.reduce((a, t) => a + t.w, 0)) / (take.length + 1);
    let at = free;
    for (const it of take) { out.push({ it, S, mid: at + it.w / 2, cy: clamp(Math.max(1.6, it.h / 2 + .45), it.h / 2 + .1, S.top - it.h / 2) }); at += it.w + free; }
  }
  missing.push(...queue.map(q => q.key));
  return { out, missing };
}

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
.gl-salas{position:absolute;top:calc(58px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:3;display:flex;align-items:center;gap:4px;background:rgba(14,8,26,.78);border:1px solid rgba(255,190,85,.35);border-radius:999px;padding:3px;max-width:calc(100% - 24px)}
.gl-salas span{font:600 12.5px "Sora",system-ui,sans-serif;color:#ffd27f;padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gl-salas button{flex:none;width:30px;height:30px;border-radius:50%;border:0;background:rgba(139,63,214,.3);font-size:15px}
.gl-salas button:disabled{opacity:.25}
.gl-pill{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:3;pointer-events:none;background:rgba(14,8,26,.78);border:1px solid rgba(210,184,255,.18);border-radius:16px;padding:8px 16px;font-size:12.5px;color:#cbbbe8;text-align:center;width:max-content;max-width:calc(100% - 32px);transition:opacity .8s}
.gl-pill.off{opacity:0}
.gl-tour{position:absolute;right:14px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:3;border:0;border-radius:999px;padding:12px 18px;font:600 13.5px "Sora",system-ui,sans-serif;color:#1b0f00!important;background:linear-gradient(135deg,#ffd88a,#ffbe55);box-shadow:0 8px 30px rgba(255,190,85,.35)}
.gl-card{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:3;width:min(480px,calc(100% - 24px));background:rgba(14,8,26,.9);border:1px solid rgba(210,184,255,.18);border-radius:18px;padding:13px 15px;animation:gl-up .35s ease}
@keyframes gl-up{from{opacity:0;transform:translate(-50%,14px)}}
.gl-card .ct{display:flex;align-items:baseline;gap:10px}
.gl-card b{font:600 16px "Sora",system-ui,sans-serif;flex:1;min-width:0}
.gl-card .num{font-size:12px;color:#b9a8d6;flex:none}
.gl-card .sz{font:500 12px "IBM Plex Mono",ui-monospace,monospace;color:#ffbe55;margin-top:3px}
.gl-card .sz:empty{display:none}
.gl-card p{margin:5px 0 0;color:#cbbbe8;font-size:14px;line-height:1.45;white-space:pre-line;max-height:5.8em;overflow:auto;user-select:text;-webkit-user-select:text}
.gl-card.txt p{max-height:min(46vh,420px);color:#e6dcf7;font-size:15px}
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
.gl-intro .by{color:#ffd27f;font:500 15px "Sora",system-ui,sans-serif;margin-top:10px}
.gl-intro .by:empty{display:none}
.gl-intro p{color:#cbbbe8;max-width:34ch;margin:12px auto 22px;line-height:1.45}
.gl-go{border:0;border-radius:999px;padding:14px 30px;font:700 15px "Sora",system-ui,sans-serif;color:#1b0f00!important;background:linear-gradient(135deg,#ffd88a,#ffbe55);box-shadow:0 10px 40px rgba(255,190,85,.4)}
.gl-go:disabled{opacity:.6}
.gl-fade{position:absolute;inset:0;z-index:4;background:#05020b;opacity:0;pointer-events:none;transition:opacity .45s;display:grid;place-items:center;font:600 22px "Sora",system-ui,sans-serif;color:#ffd27f}
.gl-fade.on{opacity:1}
.gl-toast{position:absolute;left:50%;top:70px;transform:translateX(-50%);z-index:6;background:rgba(30,14,52,.94);border:1px solid rgba(210,184,255,.2);border-radius:999px;padding:8px 16px;font-size:13px;opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap}
.gl-toast.on{opacity:1}
.gl.em .gl-top{padding-top:10px}
.gl.em .gl-salas{top:52px}
.gl.em .gl-intro p{display:none}
`;

/** run({ root, cfg, src(id) → url of a picture or GLB, brand: {src, own, href} | null, url (to share), onClick(id),
 *       embedded (the maker's preview: nothing counted or shared), sala (the room to show first),
 *       onPick(sala, index) (the maker: a piece was tapped), onLayout({sala, missing: [indexes that didn't fit]}) })
 * returns { update(cfg, brand), setSala(i), focus(sala, index), shot() → Promise<Blob> (Mi cuenta), destroy() } */
export function run(o) {
  if (!document.getElementById("gl-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "gl-css", textContent: CSS }));
  let cfg = o.cfg, brand = o.brand, alive = true;
  const G = () => cfg.galeria || {};
  const salas = () => salasOf(G());
  let salaI = clamp(o.sala || 0, 0, salas().length - 1);
  const sala = () => salas()[salaI] || salas()[0];
  const tipoOf = s => SALAS[s.tipo] ? s.tipo : "clasica";
  const obras = () => (sala().obras || []).slice(0, MAX);
  const count = id => { if (!o.embedded && o.onClick) o.onClick(id); };
  const MOBILE = matchMedia("(pointer: coarse)").matches;
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = document.createElement("div"); el.className = "gl" + (o.embedded ? " em" : "") + (MOBILE ? " joy" : "");
  el.innerHTML = `<canvas tabindex="0"></canvas>
    <div class="gl-top"><span data-logo></span><div class="gl-name" data-name></div>
      ${o.embedded ? "" : `<button class="gl-ic" type="button" data-share aria-label="Compartir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg></button>
      <button class="gl-ic" type="button" data-fs aria-label="Pantalla completa"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4"/></svg></button>`}</div>
    <div class="gl-salas" data-salas hidden><button type="button" data-sp aria-label="Sala anterior">‹</button><span data-sn></span><button type="button" data-sx aria-label="Sala siguiente">›</button></div>
    <div class="gl-pill off" data-hint></div>
    <button class="gl-tour" type="button" data-tour hidden>Iniciar recorrido →</button>
    <div class="gl-joy" data-joy ${MOBILE ? "" : "hidden"}><i></i></div>
    <div class="gl-card" data-card hidden><div class="ct"><b data-ct></b><span class="num" data-cn></span></div><div class="sz" data-cs></div><p data-cd></p>
      <div class="gl-nav"><button type="button" data-prev>← Anterior</button><button type="button" data-next>Siguiente →</button><button class="x" type="button" data-close aria-label="Cerrar">×</button></div></div>
    <div class="gl-fade" data-fade></div>
    <div class="gl-intro" data-intro><div><div class="k">Galería en 3D</div><h1 data-ih></h1><div class="by" data-iby></div><p>Camina entre las obras, acércate a cada una y descubre su historia.</p><button class="gl-go" type="button" data-go disabled>Cargando…</button></div></div>
    <div class="gl-toast" data-toast></div>`;
  o.root.appendChild(el);
  const $ = s => el.querySelector(s);
  const canvas = $("canvas");
  let toastT;
  const toast = m => { const t = $("[data-toast]"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 1800); };

  /* ---------- renderer ---------- */
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
  catch { $("[data-go]").textContent = "Este navegador no puede mostrar 3D"; return { update() {}, setSala() {}, focus() {}, shot: async () => null, destroy() { el.remove(); } }; }
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
  const freeTex = t => { if (t && owned.delete(t)) t.dispose(); };
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
  const KEEP = new Set([GLOW, POOL, SHADOW]);
  const MAT = {
    easel: new THREE.MeshStandardMaterial({ color: 0xa6743f, roughness: .62, envMapIntensity: .4 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 1, roughness: .35 }),
    lens: new THREE.MeshBasicMaterial({ color: 0xfff4e0 }),
    passe: new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: .92, envMapIntensity: .2 }),
    side: new THREE.MeshStandardMaterial({ color: 0xebe5d8, roughness: .9, envMapIntensity: .2 }),
    plinth: new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: .7, envMapIntensity: .4 }),
    shadow: new THREE.MeshBasicMaterial({ map: SHADOW, transparent: true, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({ color: 0xb37bff, toneMapped: false }), gold: new THREE.MeshBasicMaterial({ color: 0xffbe55, toneMapped: false }),
  };
  const shared = new Set(Object.values(MAT));
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  /* ---------- room meshes ---------- */
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
  function meshesOf(P) {
    const grp = new THREE.Group(), anim = [];
    if (P.tipo === "clasica") {
      const A = P.A, { W, D, H } = P;
      const m = {
        wall: new THREE.MeshStandardMaterial({ color: A.wall, roughness: .93, envMapIntensity: .25 }),
        ceil: new THREE.MeshStandardMaterial({ color: A.ceil, roughness: 1, envMapIntensity: .15 }),
        floor: new THREE.MeshStandardMaterial({ map: woodTexture(A.floor, W, D), roughness: .42, envMapIntensity: .5 }),
        trim: new THREE.MeshStandardMaterial({ color: A.trim, emissive: A.trimI ? A.trim : 0, emissiveIntensity: A.trimI, roughness: .5 }),
        strip: new THREE.MeshBasicMaterial({ color: A.strip }),
        bench: new THREE.MeshStandardMaterial({ color: 0x2b1d2f, roughness: .55 }), benchTop: new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: .5 }),
      };
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), m.floor); floor.rotation.x = -Math.PI / 2; floor.userData.floor = true; grp.add(floor);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), m.ceil); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; grp.add(ceil);
      for (const [w, x, z, ry] of [[D, -W / 2, 0, Math.PI / 2], [D, W / 2, 0, -Math.PI / 2], [W, 0, -D / 2, 0], [W, 0, D / 2, Math.PI]]) {
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, H), m.wall); wall.position.set(x, H / 2, z); wall.rotation.y = ry; grp.add(wall);
        const base = box(w, .05, .03, m.trim); base.position.set(x, .09, z); base.rotation.y = ry; base.translateZ(.015); grp.add(base);   // a glowing skirting
        const top = box(w, .03, .02, m.trim); top.position.set(x, H - .35, z); top.rotation.y = ry; top.translateZ(.01); grp.add(top);
      }
      for (const x of [-3.6, 3.6]) { const s = box(.1, .02, D - 4, m.strip); s.position.set(x, H - .01, 0); grp.add(s); }
      if (P.bench) {
        const top = box(.55, .08, 2.8, m.benchTop); top.position.y = .46; grp.add(top);
        const body = box(.46, .42, 2.6, m.bench); body.position.y = .21; grp.add(body);
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3.6), MAT.shadow); sh.rotation.x = -Math.PI / 2; sh.position.y = .003; grp.add(sh);
      }
      grp.add(new THREE.HemisphereLight(0xe8ddff, 0x20152a, A.hemi));
      return { grp, floor, anim, text: A.text, sub: A.sub, dust: { color: A.dot, add: A.dark, n: MOBILE ? 240 : 480, box: [W, H, D] } };
    }
    if (P.tipo === "museo") {
      const { W, D, H } = P;
      const m = {
        wall: new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: .95, envMapIntensity: .3 }),
        ceil: new THREE.MeshStandardMaterial({ color: 0xf6f5f2, roughness: 1, envMapIntensity: .2 }),
        floor: new THREE.MeshStandardMaterial({ map: concreteTexture(W, D), roughness: .26, metalness: .05, envMapIntensity: .9 }),
        sky: new THREE.MeshBasicMaterial({ color: 0xffffff }), beam: new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: .9 }),
        base: new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: .6 }),
      };
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), m.floor); floor.rotation.x = -Math.PI / 2; floor.userData.floor = true; grp.add(floor);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), m.ceil); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; grp.add(ceil);
      for (const [w, x, z, ry] of [[D, -W / 2, 0, Math.PI / 2], [D, W / 2, 0, -Math.PI / 2], [W, 0, -D / 2, 0], [W, 0, D / 2, Math.PI]]) {
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, H), m.wall); wall.position.set(x, H / 2, z); wall.rotation.y = ry; grp.add(wall);
        const b = box(w, .08, .02, m.base); b.position.set(x, .04, z); b.rotation.y = ry; b.translateZ(.01); grp.add(b);   // a thin shadow gap at the floor
      }
      for (const x of W > 21 ? [-7.5, 0, 7.5] : [-5, 5]) {   // long skylights
        const s = box(2.6, .02, D - 8, m.sky); s.position.set(x, H - .01, 0); grp.add(s);
        for (let z = -D / 2 + 4; z <= D / 2 - 4; z += 2.6) { const bm = box(2.8, .18, .12, m.beam); bm.position.set(x, H - .1, z); grp.add(bm); }
      }
      for (const z of P.parts) {   // free-standing walls in the hall: pieces hang on both faces
        const pw = box(12, 5.6, .4, m.wall); pw.position.set(0, 2.8, z); grp.add(pw);
        const b = box(12.02, .08, .42, m.base); b.position.set(0, .04, z); grp.add(b);
      }
      grp.add(new THREE.HemisphereLight(0xffffff, 0xd8cfc0, 1.15));
      const sun = new THREE.DirectionalLight(0xfff6ea, 1.1); sun.position.set(4, 20, 6); grp.add(sun);
      return { grp, floor, anim, text: "#1d1626", sub: "#8b3fd6", dust: { color: 0xffd9a0, add: false, n: MOBILE ? 160 : 320, box: [W, H, D] } };
    }
    // in space: a floating platform among the stars, with panels in a ring
    const R = P.R, Rp = R + 2.4;
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
      floor: new THREE.MeshStandardMaterial({ color: 0x0c0818, metalness: .25, roughness: .55, emissive: 0xffffff, emissiveMap: platformTexture(), emissiveIntensity: .85, envMapIntensity: .12 }),
      under: new THREE.MeshStandardMaterial({ color: 0x0a0714, metalness: .6, roughness: .5 }),
      panel: new THREE.MeshStandardMaterial({ color: 0x1d1633, metalness: .3, roughness: .5, envMapIntensity: .35 }),
    };
    const floor = new THREE.Mesh(new THREE.CircleGeometry(Rp, 96), m.floor); floor.rotation.x = -Math.PI / 2; floor.userData.floor = true; grp.add(floor);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(Rp, Rp * .55, 3, 96, 1, true), m.under); under.position.y = -1.5; grp.add(under);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(Rp, .06, 8, 160), MAT.gold); edge.rotation.x = Math.PI / 2; edge.position.y = .02; grp.add(edge);
    for (const S of P.segs) {   // panels of 8 × 4.4 m, at eye height, with glowing edges
      const p = box(8, 4.4, .25, m.panel); p.position.set(S.cx, 2.45, S.cz); p.rotation.y = S.a; grp.add(p);
      for (const y of [.25, 4.65]) { const s = box(8, .05, .27, MAT.glow); s.position.set(S.cx, y, S.cz); s.rotation.y = S.a; grp.add(s); }
    }
    grp.add(new THREE.HemisphereLight(0xc9b8ff, 0x1a1030, .7));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.4); sun.position.set(-20, 30, 10); grp.add(sun);
    return { grp, floor, anim, text: "#f3ecff", sub: "#ffbe55", dust: { color: 0xd2b8ff, add: true, n: MOBILE ? 260 : 520, box: [Rp * 2, 9, Rp * 2] } };
  }

  /* ---------- shared pieces: signs, sparkles, aim ---------- */
  const nameMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 440 / 2048), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false })); scene.add(nameMesh);
  const logoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false })); logoMesh.rotation.y = Math.PI; scene.add(logoMesh);
  const aim = new THREE.Mesh(new THREE.RingGeometry(.2, .26, 40), new THREE.MeshBasicMaterial({ color: 0xd2b8ff, transparent: true, opacity: .7, depthWrite: false }));
  aim.rotation.x = -Math.PI / 2; aim.visible = false; scene.add(aim);
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
  let spec = null, room = null, roomKey = "", dust = null, dustV = null;
  function setRoom(P) {
    if (room) {
      room.grp.traverse(x => {
        if (x.geometry) x.geometry.dispose();
        if (x.material && !shared.has(x.material)) { for (const t of [x.material.map, x.material.emissiveMap]) if (t && !KEEP.has(t)) freeTex(t); x.material.dispose(); }
      });
      scene.remove(room.grp);
    }
    if (dust) { scene.remove(dust); dust.geometry.dispose(); dust.material.dispose(); }
    spec = P; room = meshesOf(P); scene.add(room.grp);
    scene.background = P.tipo === "espacio" ? null : new THREE.Color(0x05020b);
    const [bx, by, bz] = room.dust.box, n = room.dust.n, pos = new Float32Array(n * 3); dustV = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set([rnd(-bx / 2, bx / 2), rnd(0, by), rnd(-bz / 2, bz / 2)], i * 3); dustV[i] = rnd(.02, .09); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: GLOW, color: room.dust.color, size: .045, transparent: true, opacity: room.dust.add ? .75 : .3, depthWrite: false, blending: room.dust.add ? THREE.AdditiveBlending : THREE.NormalBlending }));
    scene.add(dust);
    nameMesh.position.set(0, P.name.y, P.name.z); nameMesh.scale.set(P.name.w, P.name.w, 1);
    logoMesh.position.set(0, P.logo.y, P.logo.z);
    drawName(); drawLogo();
  }
  function drawName() {
    const cv = document.createElement("canvas"); cv.width = 2048; cv.height = 440;
    const g = cv.getContext("2d"), s = sala(), name = salaI === 0 ? G().name || cfg.title || "" : salaName(s, salaI);
    g.textAlign = "center"; g.textBaseline = "middle";
    let size = 170; g.font = `600 ${size}px Sora, sans-serif`;
    while (g.measureText(name || " ").width > 1900 && size > 60) { size -= 6; g.font = `600 ${size}px Sora, sans-serif`; }
    if (spec.name.float) { g.shadowColor = "rgba(160,90,255,.9)"; g.shadowBlur = 40; }
    g.fillStyle = room.text; g.fillText(name, 1024, 200);
    const sub = salaI > 0 ? (G().name || "").toUpperCase() : brand && !brand.own ? "GALERÍAS VÓRTICE VR" : "";
    if (sub) { g.font = "600 52px Sora, sans-serif"; g.fillStyle = room.sub; if ("letterSpacing" in g) g.letterSpacing = "14px"; g.fillText(sub.slice(0, 40), 1024, 365); }
    const old = nameMesh.material.map; nameMesh.material.map = canvasTex(cv); nameMesh.material.needsUpdate = true; freeTex(old);
    $("[data-name]").textContent = G().name || cfg.title || ""; $("[data-ih]").textContent = G().name || cfg.title || "Galería";
    $("[data-iby]").textContent = G().autor ? `Presenta: ${G().autor}` : "";
    const n = salas().length, bar = $("[data-salas]");
    bar.hidden = n < 2;
    $("[data-sn]").textContent = `Sala ${salaI + 1} de ${n}${sala().nombre ? " · " + sala().nombre : ""}`;
    $("[data-sp]").disabled = salaI === 0; $("[data-sx]").disabled = salaI >= n - 1;
  }
  const logoTex = new Map();
  async function drawLogo() {
    // Vórtice VR's logo only in its original purple or in white; the brand's own as it is; none = no logo
    const src = !brand ? "" : brand.own ? brand.src : spec.dark ? LOGO.blanco : LOGO.morado;
    logoMesh.visible = !!src;
    const top = $("[data-logo]");
    top.innerHTML = brand ? `<img class="${brand.own ? "own" : ""}" src="${esc(brand.src)}" alt="">` : "";
    if (brand && brand.href && !o.embedded) top.innerHTML = `<a href="${esc(brand.href)}" target="_blank" rel="noopener">${top.innerHTML}</a>`;
    if (!src) return;
    try {
      if (!logoTex.has(src)) logoTex.set(src, loader.loadAsync(src).then(t => { t.colorSpace = THREE.SRGBColorSpace; return t; }));
      const t = await logoTex.get(src); if (!alive) return;
      logoMesh.material.map = t; logoMesh.material.needsUpdate = true;
      const k = Math.min(spec.logo.w / t.image.width, spec.logo.h / t.image.height);
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
  const matOf = (ob, w, h) => { const F = FRAMES[ob.frame] || FRAMES.dorado; return ob.mat && !F.lienzo ? Math.max(.06, Math.min(w, h) * .09) : 0; };
  // the framed picture standing on y = 0 (w × h = the picture itself, in meters); returns its outer size
  function buildArt(ob, tex, w, h, lit) {
    const k = FRAMES[ob.frame] ? ob.frame : "dorado", F = FRAMES[k], g = new THREE.Group();
    const mw = matOf(ob, w, h), iw = w + 2 * mw, ih = h + 2 * mw, cy = F.f + ih / 2;
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
  // the room's text: a panel like a museum's wall text (the whole text is read on its card)
  function textPanel(title, by, body, dark) {
    const W = 1040, H = Math.round(W * TXT.h / TXT.w), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), ink = dark ? "#ffffff" : "#120b1c", soft = dark ? "#e6dcf7" : "#2a2238", acc = dark ? "#ffbe55" : "#7a2fc4";
    g.fillStyle = dark ? "#140d24" : "#fbfaf6"; g.fillRect(0, 0, W, H);
    const P = 80, wrap = (text, font, lh, maxY, color) => {
      g.font = font; g.fillStyle = color; let y = yy;
      for (const para of String(text).split(/\n+/)) {
        let line = "";
        for (const word of para.split(/\s+/)) {
          const t = line ? line + " " + word : word;
          if (g.measureText(t).width > W - 2 * P && line) { if (y + lh > maxY) { g.fillText(line + "…", P, y); return { y, cut: true }; } g.fillText(line, P, y); y += lh; line = word; } else line = t;
        }
        if (line) { if (y + lh > maxY) { g.fillText(line + "…", P, y); return { y, cut: true }; } g.fillText(line, P, y); y += lh; }
        y += lh * .45;
      }
      return { y, cut: false };
    };
    g.textBaseline = "top"; let yy = P;
    g.fillStyle = acc; g.fillRect(P, yy, 90, 8); yy += 40;
    let r = wrap(title, "700 66px Sora, sans-serif", 78, 420, ink); yy = r.y + 6;
    if (by) { r = wrap(by, "500 34px Sora, sans-serif", 44, 520, acc); yy = r.y + 20; }
    r = wrap(body, "400 31px 'IBM Plex Sans', sans-serif", 45, H - P - 60, soft);
    if (r.cut) { g.font = "600 28px Sora, sans-serif"; g.fillStyle = acc; g.fillText("Toca para leerlo completo", P, H - P - 30); }
    const grp = new THREE.Group();
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(TXT.w, TXT.h), new THREE.MeshStandardMaterial({ map: canvasTex(cv), roughness: .9, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 }));
    pic.material.emissiveMap = pic.material.map; pic.material.emissiveIntensity = dark ? .3 : .08;   // bright rooms wash it out otherwise
    pic.position.set(0, TXT.h / 2, .012); grp.add(pic);
    const back = box(TXT.w, TXT.h, .02, MAT.passe); back.position.set(0, TXT.h / 2, 0); grp.add(back);
    return grp;
  }
  function addSpot(parent, x, y, z, tx, ty, tz, intensity, color = 0xfff1dc) {
    const spot = new THREE.SpotLight(color, intensity, 0, .38, .6, 2); spot.position.set(x, y, z); spot.target.position.set(tx, ty, tz);
    parent.add(spot, spot.target);
    if (spec.tipo === "espacio") return;   // nothing hangs in space: the light just shines
    const fix = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, .16, 20), MAT.metal); fix.position.set(x, y, z); parent.add(fix);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.065, 20), MAT.lens); lens.rotation.x = Math.PI / 2; lens.position.set(x, y - .085, z); parent.add(lens);
  }
  // the door to the next room: a glowing arch with its name
  function portal(next) {
    const g = new THREE.Group(), W = 2.4, H = 3.2;
    for (const [w, h, x, y] of [[.16, H, -W / 2, H / 2], [.16, H, W / 2, H / 2], [W + .16, .16, 0, H]]) { const b = box(w, h, .2, MAT.glow); b.position.set(x, y, 0); g.add(b); }
    const cv = document.createElement("canvas"); cv.width = cv.height = 256; const c = cv.getContext("2d");
    const gr = c.createRadialGradient(128, 128, 4, 128, 128, 128); gr.addColorStop(0, "rgba(255,230,180,.95)"); gr.addColorStop(.35, "rgba(190,120,255,.75)"); gr.addColorStop(1, "rgba(60,20,120,.15)");
    c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 3; for (let a = 0; a < 6; a++) { c.beginPath(); for (let t = 0; t < 1; t += .02) { const r = t * 128, an = a + t * 5; c.lineTo(128 + Math.cos(an) * r, 128 + Math.sin(an) * r); } c.stroke(); }
    const swirlTex = canvasTex(cv); swirlTex.center.set(.5, .5);
    const swirl = new THREE.Mesh(new THREE.PlaneGeometry(W - .1, H - .1), new THREE.MeshBasicMaterial({ map: swirlTex, transparent: true, opacity: .9, depthWrite: false, toneMapped: false }));
    swirl.position.set(0, H / 2, 0); g.add(swirl);
    const lc = document.createElement("canvas"); lc.width = 1024; lc.height = 160; const l = lc.getContext("2d");
    l.font = "600 64px Sora, sans-serif"; l.textAlign = "center"; l.textBaseline = "middle"; l.shadowColor = "rgba(0,0,0,.6)"; l.shadowBlur = 12; l.fillStyle = "#ffd27f";
    let t = `${salaName(salas()[next], next)} →`; while (l.measureText(t).width > 980 && t.length > 6) t = t.slice(0, -3) + "…→";
    l.fillText(t, 512, 80);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .5), new THREE.MeshBasicMaterial({ map: canvasTex(lc), transparent: true, toneMapped: false }));
    label.position.set(0, H + .55, 0); g.add(label);
    g.traverse(x => { if (x.isMesh) { x.userData.portal = next; if (x.material.map) x.userData.ownMap = true; } });
    portalSpin = swirlTex;
    return g;
  }
  let portalSpin = null;

  const texCache = new Map(), modelCache = new Map();
  const texFor = url => {
    if (!url) return Promise.resolve(null);
    if (!texCache.has(url)) texCache.set(url, loader.loadAsync(url).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t; }).catch(() => null));
    return texCache.get(url);
  };
  const modelFor = url => {
    if (!url) return Promise.resolve(null);
    if (!modelCache.has(url)) modelCache.set(url, gltfTools().then(T => T.loader.loadAsync(url)).catch(e => { console.warn("3D", e); return null; }));
    return modelCache.get(url);
  };

  const pieces = new THREE.Group(); scene.add(pieces);
  let placed = new Map(), glows = [], mixers = [], turners = [], OBST = [], buildN = 0, loading = Promise.resolve();
  function freePieces() {
    pieces.traverse(x => {
      if (x.geometry && !x.userData.cachedGeo) x.geometry.dispose();
      if (x.material && !shared.has(x.material) && !x.userData.cachedMat) { if (x.material.map && x.userData.ownMap) freeTex(x.material.map); x.material.dispose(); }
    });
    pieces.clear(); placed = new Map(); glows = []; mixers = []; turners = []; portalSpin = null;
  }
  function tag(g, key) { g.traverse(x => { if (x.isMesh) x.userData.obra = key; }); }

  // loads the room's files, picks the smallest size where everything fits, builds the room (if it changed) and lays it out
  async function build() {
    const n = ++buildN, s = sala(), tipo = tipoOf(s), list = obras(), next = salaI < salas().length - 1 ? salaI + 1 : -1;
    const assets = await Promise.all(list.map(ob => ob.model ? modelFor(o.src(ob.model)) : texFor(o.src(ob.img))));
    if (!alive || n !== buildN) return;
    const tools = list.some(ob => ob.model) ? await gltfTools().catch(() => null) : null;
    if (!alive || n !== buildN) return;
    // the walls' pieces: the room's text first, then the pictures in order, with their outer size in meters
    const wall = [], sizes = new Map();
    const texto = String(s.texto || "").trim();
    if (texto) wall.push({ key: "txt", w: TXT.w, h: TXT.h });
    list.forEach((ob, i) => {
      if (ob.model || mountOf(ob, tipo) !== "pared") return;
      const tex = assets[i], a = tex && tex.image ? tex.image.width / tex.image.height : 1, rs = realSize(ob, a);
      const sz = rs ? { w: rs.w / 100, h: rs.h / 100 } : a >= 1 ? { w: 1, h: 1 / a } : { w: a, h: 1 };   // no measures: 1 m on its long side
      sizes.set(i, sz);
      const F = FRAMES[ob.frame] || FRAMES.dorado, mw = matOf(ob, sz.w, sz.h);
      wall.push({ key: i, w: sz.w + 2 * (mw + F.f), h: sz.h + 2 * (mw + F.f) });
    });
    const floorIdx = list.map((ob, i) => i).filter(i => list[i].model || mountOf(list[i], tipo) === "caballete");
    const useSide = tipo === "clasica" && !wall.length && !floorIdx.some(i => list[i].model);
    let P, plan;
    for (let k = 0; k < SIZES[tipo]; k++) {
      P = specOf(tipo, k, s.amb, next >= 0); plan = planWalls(P, wall);
      if (!plan.missing.length && floorIdx.length <= (useSide ? P.sideSpots : P.spots).length) break;
    }
    const key = [tipo, P.k, tipo === "clasica" ? s.amb : "", next >= 0].join("|");
    if (key !== roomKey) { roomKey = key; setRoom(P); } else spec = P;
    freePieces();
    OBST = [...P.obst];
    const missing = plan.missing.filter(k => k !== "txt");
    const R = spec, dark = R.dark;
    for (const a of plan.out) {
      const S = a.S, ry = Math.atan2(S.nx, S.nz), ux = (S.x2 - S.x1) / S.len, uz = (S.z2 - S.z1) / S.len;
      const x = S.x1 + ux * a.mid + S.nx * .02, z = S.z1 + uz * a.mid + S.nz * .02;
      let g, OW, OH;
      if (a.it.key === "txt") {
        g = textPanel(salaI === 0 ? G().name || cfg.title || "La exposición" : salaName(s, salaI), salaI === 0 && G().autor ? G().autor : "", texto, dark); OW = TXT.w; OH = TXT.h;
        g.traverse(m => { if (m.isMesh && m.material.map) m.userData.ownMap = true; });
      } else {
        const i = a.it.key, sz = sizes.get(i), art = buildArt(list[i], assets[i], sz.w, sz.h, .22); g = art.g; OW = art.OW; OH = art.OH;
        placed.set(i, { cx: x, cy: a.cy, cz: z, nx: S.nx, nz: S.nz, w: OW, h: OH, size: list[i].w || list[i].h ? `${Math.round(sz.w * 100)} × ${Math.round(sz.h * 100)} cm` : "" });
      }
      g.position.set(x, a.cy - OH / 2, z); g.rotation.y = ry;
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(OW + 1.6, OH + 2.2), new THREE.MeshBasicMaterial({ map: POOL, transparent: true, opacity: R.poolI, depthWrite: false, blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending }));
      pool.position.set(0, OH / 2 + .35, -.03); g.add(pool);   // the warm light of its spot on the wall
      tag(g, a.it.key); pieces.add(g);
      if (a.it.key === "txt") placed.set("txt", { cx: x, cy: a.cy, cz: z, nx: S.nx, nz: S.nz, w: OW, h: OH, size: "" });
    }
    // the floor: easels and 3D take the spots in order (in the classic room, easels go along the walls when nothing hangs)
    const spots = [...(useSide ? R.sideSpots : R.spots)];
    let lights = 0;
    for (const i of floorIdx) {
      const sp = spots.shift(); if (!sp) { missing.push(i); continue; }
      const ob = list[i], root = new THREE.Group(); root.position.set(sp.x, 0, sp.z); root.rotation.y = sp.ry;
      const fx = Math.sin(sp.ry), fz = Math.cos(sp.ry);
      if (ob.model) {
        const gltf = assets[i], sm = clamp((Number(ob.s) || 80) / 100, .1, 6), onPed = mountOf(ob, tipo) === "pedestal";
        const pm = FRAMES[ob.frame] && !FRAMES[ob.frame].lienzo ? fmat(ob.frame).main : MAT.plinth;   // the pedestal in the color of its frame
        let topY = 0;
        if (onPed) {   // a square column, with a base and a cap a little wider
          const pw = clamp(sm * .55, .32, .8), ph = sm > 1.5 ? .6 : sm > 1 ? .8 : 1;
          const col = box(pw, ph - .08, pw, pm); col.position.y = .04 + (ph - .08) / 2; root.add(col);
          const base = box(pw + .06, .04, pw + .06, pm); base.position.y = .02; root.add(base);
          const cap = box(pw + .06, .04, pw + .06, pm); cap.position.y = ph - .02; root.add(cap);
          if (ob.frame === "neon") { const halo = new THREE.Mesh(new THREE.PlaneGeometry(pw * 3, pw * 3), new THREE.MeshBasicMaterial({ map: GLOW, color: 0x9b4dff, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending })); halo.rotation.x = -Math.PI / 2; halo.position.y = .01; halo.userData.glow = true; root.add(halo); }
          topY = ph;
        } else {
          const plate = new THREE.Mesh(new THREE.CylinderGeometry(sm * .6, sm * .62, .04, 48), pm); plate.position.y = .02; root.add(plate); topY = .04;
        }
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(sm * 1.8 + .6, sm * 1.8 + .6), MAT.shadow); sh.rotation.x = -Math.PI / 2; sh.position.y = .003; root.add(sh);
        const turn = new THREE.Group(); turn.position.y = topY; root.add(turn);
        let h = .3;
        if (gltf && tools) {
          const m = tools.clone(gltf.scene);
          m.traverse(x => { if (x.isMesh) { x.userData.cachedGeo = true; x.userData.cachedMat = true; } });
          const bb = new THREE.Box3().setFromObject(m), sz = bb.getSize(new THREE.Vector3()), k = sm / Math.max(sz.x, sz.y, sz.z, 1e-6);
          m.scale.setScalar(k); const c = bb.getCenter(new THREE.Vector3());
          m.position.set(-c.x * k, -bb.min.y * k, -c.z * k); turn.add(m); h = sz.y * k;
          if (gltf.animations && gltf.animations.length) { const mx = new THREE.AnimationMixer(m); mx.clipAction(gltf.animations[0]).play(); mixers.push(mx); }
        } else {   // the file could not be read: a placeholder so the spot isn't empty
          const q = new THREE.Mesh(new THREE.IcosahedronGeometry(sm * .35), new THREE.MeshStandardMaterial({ color: 0x8b3fd6, roughness: .4 })); q.position.y = sm * .35; turn.add(q); h = sm * .7;
        }
        if (ob.gira && !REDUCED) turners.push(turn);
        OBST.push({ x: sp.x, z: sp.z, r: Math.max(.5, sm * .6) });
        if (lights < 10) { addSpot(root, 0, R.H - .12, 1.6, 0, topY + h / 2, 0, R.spotI * .8); lights++; }
        tag(root, i); pieces.add(root);
        placed.set(i, { cx: sp.x, cy: topY + h / 2, cz: sp.z, nx: fx, nz: fz, w: sm, h: Math.max(h, .3), model: true, size: ob.s ? `${Math.round(sm * 100)} cm` : "" });
      } else {
        root.add(buildEasel());
        const tex = assets[i], a = tex && tex.image ? tex.image.width / tex.image.height : .8, rs = realSize(ob, a);
        let w, h2;
        if (rs) { w = rs.w / 100; h2 = rs.h / 100; const k = Math.min(1, 1.6 / w, 1.8 / h2); w *= k; h2 *= k; }   // an easel holds up to 1.6 × 1.8 m
        else { w = 1.1; h2 = w / a; if (h2 > 1.3) { h2 = 1.3; w = h2 * a; } }
        const holder = new THREE.Group(); holder.position.set(0, .89, .14); holder.rotation.x = -.1; root.add(holder);
        const art = buildArt(ob, tex, w, h2, 0); holder.add(art.g);
        const clampM = box(.12, .055, .09, MAT.easel); clampM.position.set(0, art.OH + .02, -.04); holder.add(clampM);
        OBST.push({ x: sp.x - fx * .25, z: sp.z - fz * .25, r: .7 });
        if (lights < 10) { addSpot(root, 0, R.H - .12, 1.9, 0, 1.5, .1, R.spotI, ob.frame === "neon" ? 0xe9d8ff : 0xfff1dc); lights++; }
        tag(root, i); pieces.add(root);
        placed.set(i, { cx: sp.x + fx * .1, cy: .89 + art.OH / 2, cz: sp.z + fz * .1, nx: fx, nz: fz, w: art.OW, h: art.OH, size: rs ? `${Math.round(w * 100)} × ${Math.round(h2 * 100)} cm` : "" });
      }
    }
    if (R.portal) { const pg = portal(next); pg.position.set(R.portal.x, 0, R.portal.z); pg.rotation.y = R.portal.ry; pieces.add(pg); if (R.tipo !== "espacio") OBST.push({ x: R.portal.x, z: R.portal.z, r: .9 }); }
    pieces.traverse(x => { if (x.userData.glow) glows.push(x); });
    if (o.onLayout) o.onLayout({ sala: salaI, missing: missing.sort((a, b) => a - b) });
    if (focusKey !== null && !placed.has(focusKey)) { focusKey = null; showCard(); }
    $("[data-tour]").hidden = !!(focusKey !== null || !order().length || state !== "in");
  }
  function rebuild() { loading = build().catch(e => console.error(e)); return loading; }

  /* ---------- walking and looking ---------- */
  const player = { x: 0, z: 0, yaw: 0, pitch: -.03 };
  let anim = null, bob = 0, focusKey = null, state = "intro";
  const keys = new Set(), joy = { x: 0, y: 0 };
  function resolve(x, z) {
    const B = spec.bounds;
    if (B.rect) { x = clamp(x, -B.rect[0], B.rect[0]); z = clamp(z, -B.rect[1], B.rect[1]); }
    else { const d = Math.hypot(x, z); if (d > B.circle) { x *= B.circle / d; z *= B.circle / d; } }
    for (const b of OBST) {
      const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz), r = b.r + BODY;
      if (d < r) { if (d < 1e-4) x += r; else { x = b.x + dx / d * r; z = b.z + dz / d * r; } }
    }
    for (const w of spec.walls) {   // free-standing walls: push out of the segment
      const ux = w.x2 - w.x1, uz = w.z2 - w.z1, L2 = ux * ux + uz * uz, t = clamp(((x - w.x1) * ux + (z - w.z1) * uz) / L2, 0, 1);
      const px = w.x1 + ux * t, pz = w.z1 + uz * t, dx = x - px, dz = z - pz, d = Math.hypot(dx, dz), r = w.r + BODY;
      if (d < r) { if (d < 1e-4) z += r; else { x = px + dx / d * r; z = pz + dz / d * r; } }
    }
    return [x, z];
  }
  function goTo(x, z, yaw = player.yaw, pitch = player.pitch, dur) {
    const dy = ((yaw - player.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    anim = { x0: player.x, z0: player.z, a0: player.yaw, p0: player.pitch, x, z, a: player.yaw + dy, p: pitch, t: 0,
      dur: REDUCED ? .01 : dur ?? clamp(Math.max(Math.hypot(x - player.x, z - player.z) / (spec.speed * 1.4), Math.abs(dy) / 2.4), .6, 3) };
  }
  const size = () => [el.clientWidth || 1, el.clientHeight || 1];
  function focus(key, dur) {
    const P = placed.get(key); if (!P) return;
    // far enough to see the whole piece; on a tall screen the card takes the bottom, so look lower to sit it higher
    const [w, h] = size(), tall = w < h, tv = Math.tan(camera.fov * Math.PI / 360), asp = w / h;
    let dist = Math.max((P.h * (tall ? 1.7 : 1.3)) / 2 / tv, P.w * 1.25 / 2 / (tv * asp), P.model ? 1.8 : 1.7) + (P.model ? P.w * .5 : 0);
    let nx = P.nx, nz = P.nz;
    if (P.model) { const dx = player.x - P.cx, dz = player.z - P.cz, d = Math.hypot(dx, dz); if (d > .5) { nx = dx / d; nz = dz / d; } }   // a 3D piece: from where you are
    let [x, z] = resolve(P.cx + nx * dist, P.cz + nz * dist);
    dist = Math.hypot(x - P.cx, z - P.cz);
    const ty = tall ? P.cy - P.h * .18 : P.cy;
    goTo(x, z, Math.atan2(-(P.cx - x), -(P.cz - z)), Math.atan2(ty - EYE, dist), dur);
    focusKey = key; showCard(); sfx.whoosh(.35);
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
        const v = spec.speed * (k("ShiftLeft") || k("ShiftRight") ? 1.8 : 1) * dt, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
        [player.x, player.z] = resolve(player.x + (-sy * f + cy * s) * v, player.z + (-cy * f - sy * s) * v);
        if (!REDUCED) bob += dt * 9 * Math.min(1, len);
        if (focusKey !== null) { focusKey = null; showCard(); }
      }
    }
    camera.position.set(player.x, EYE + (REDUCED ? 0 : Math.sin(bob) * .018), player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
  }

  /* ---------- rooms: going from one to the next ---------- */
  function placeStart() { player.x = spec.start.x; player.z = spec.start.z; player.yaw = 0; player.pitch = -.03; }
  let switching = false;
  async function goSala(j, then) {
    if (switching || j === salaI || j < 0 || j >= salas().length) return;
    switching = true; focusKey = null; showCard();
    const f = $("[data-fade]"); f.textContent = salaName(salas()[j], j); f.classList.add("on");
    if (!REDUCED) sfx.whoosh(.6);
    await new Promise(r => setTimeout(r, REDUCED ? 0 : 450));
    salaI = j; await rebuild();
    placeStart(); if (state === "in") goTo(spec.start.x, spec.start.to, 0, -.03, .9);
    drawName();
    setTimeout(() => f.classList.remove("on"), 120);
    switching = false;
    if (then) setTimeout(then, 500);
  }
  $("[data-sp]").onclick = () => goSala(salaI - 1);
  $("[data-sx]").onclick = () => goSala(salaI + 1);

  /* ---------- taps, mouse and keys ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hitAt(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const h of ray.intersectObjects([room.floor, pieces], true)) {
      if (h.object.userData.portal !== undefined) return { portal: h.object.userData.portal };
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
        hoverQ = false; if (!alive || !room) return;
        const h = hitAt(e.clientX, e.clientY);
        canvas.style.cursor = h?.obra !== undefined || h?.portal !== undefined ? "pointer" : h?.floor ? "crosshair" : "grab";
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
    if (h.portal !== undefined) { goSala(h.portal); return; }
    if (h.obra !== undefined) { focus(h.obra); if (o.onPick && h.obra !== "txt") o.onPick(salaI, h.obra); return; }
    const [x, z] = resolve(h.floor.x, h.floor.z); goTo(x, z); sfx.tap();
    if (focusKey !== null) { focusKey = null; showCard(); }
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
  // the tour of a room: its text, then its pieces in order
  const order = () => [...(placed.has("txt") ? ["txt"] : []), ...obras().map((_, i) => i).filter(i => placed.has(i))];
  function showCard() {
    const isTxt = focusKey === "txt", ob = isTxt ? null : focusKey !== null ? obras()[focusKey] : null;
    const card = $("[data-card]");
    card.hidden = !(ob || isTxt); card.classList.toggle("txt", isTxt);
    $("[data-tour]").hidden = !!(ob || isTxt || !order().length || state !== "in");
    if (card.hidden) return;
    $("[data-hint]").classList.add("off");
    const list = order(), n = salas().length;
    if (isTxt) {
      $("[data-ct]").textContent = salaI === 0 ? G().name || cfg.title || "La exposición" : salaName(sala(), salaI);
      $("[data-cs]").textContent = salaI === 0 && G().autor ? `Presenta: ${G().autor}` : "";
      $("[data-cd]").textContent = String(sala().texto || "").trim();
    } else {
      $("[data-ct]").textContent = ob.t || "Sin título";
      $("[data-cs]").textContent = placed.get(focusKey)?.size || "";
      $("[data-cd]").textContent = ob.d || "";
    }
    $("[data-cd]").scrollTop = 0;
    $("[data-cn]").textContent = `${list.indexOf(focusKey) + 1} de ${list.length}${n > 1 ? ` · Sala ${salaI + 1}` : ""}`;
    $("[data-prev]").disabled = list.length < 2 && salaI === 0;
    $("[data-next]").disabled = list.length < 2 && salaI >= n - 1;
  }
  function step(dir) {
    const list = order(), at = focusKey === null ? -1 : list.indexOf(focusKey);
    const k = at < 0 ? (dir > 0 ? 0 : list.length - 1) : at + dir;
    if (k >= list.length && salaI < salas().length - 1) return goSala(salaI + 1, () => { const l = order(); if (l.length) focus(l[0]); });   // on to the next room
    if (k < 0 && salaI > 0) return goSala(salaI - 1, () => { const l = order(); if (l.length) focus(l[l.length - 1]); });
    if (!list.length) return;
    focus(list[(k + list.length) % list.length]);
  }
  $("[data-prev]").onclick = () => step(-1);
  $("[data-next]").onclick = () => step(1);
  $("[data-close]").onclick = () => { sfx.tap(); focusKey = null; showCard(); };
  $("[data-tour]").onclick = () => { count("tour"); step(1); };
  if (!o.embedded) {
    $("[data-fs]").onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else (document.documentElement.requestFullscreen?.() || Promise.reject()).catch(() => toast("Este navegador no permite pantalla completa"));
    };
    $("[data-share]").onclick = async () => {
      sfx.tap(); count("share");
      const url = o.url || location.href, text = `Mira esta galería en 3D: ${G().name || cfg.title || ""}`;
      try { if (navigator.share) { await navigator.share({ title: G().name || cfg.title, text, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
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
    placeStart(); goTo(spec.start.x, spec.start.to, 0, -.03, 1.8);
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
      for (const f of room.anim) f(t);
      if (portalSpin) portalSpin.rotation = -t * .6;
      if (spec.name.float) { nameMesh.position.y = spec.name.y + Math.sin(t * .8) * .12; logoMesh.position.y = spec.logo.y + Math.sin(t * .8 + 1) * .12; }
      if (state === "intro") player.yaw = Math.sin(t * .25) * .18;   // a slow look around behind the intro
    }
    renderer.render(scene, camera);
  });

  async function start() {
    await document.fonts?.load("600 40px Sora").catch(() => {});
    await document.fonts?.load("400 31px 'IBM Plex Sans'").catch(() => {});
    if (!alive) return;
    await rebuild();
    if (!alive || !room) return;
    placeStart(); readyBtn();
  }
  function readyBtn() {
    const go = $("[data-go]"); if (state !== "intro") return;
    const any = salas().some(s => (s.obras || []).length || String(s.texto || "").trim());
    go.disabled = !any; go.textContent = any ? "Entrar a la galería" : "La galería está vacía";
  }
  let textKey = "";
  start();

  return {
    update(c, b) {
      cfg = c; if (b !== undefined) brand = b;
      if (salaI >= salas().length) salaI = salas().length - 1;
      if (focusKey !== null && focusKey !== "txt" && focusKey >= obras().length) focusKey = null;
      const tk = JSON.stringify([G().name, G().autor, salas().map(s => [s.nombre]), brand]);
      rebuild().then(() => { if (!room) return; if (tk !== textKey) { textKey = tk; drawName(); drawLogo(); } showCard(); readyBtn(); });
    },
    setSala(i) { if (i !== salaI) { if (state === "in") goSala(i); else { salaI = clamp(i, 0, salas().length - 1); rebuild().then(() => { placeStart(); drawName(); }); } } },
    focus(s, i) { if (state !== "in") enter(); const go = () => setTimeout(() => focus(i), 60); if (s !== salaI) goSala(s, go); else go(); },
    // a picture of the first room from its entrance (Mi cuenta), once every piece is in place
    async shot() {
      if (salaI !== 0) { salaI = 0; await rebuild(); placeStart(); drawName(); }
      await loading;
      const c = document.createElement("canvas"); c.width = 800; c.height = 600;
      const pr = renderer.getPixelRatio(), [w, h] = size(), cam = camera.clone();
      cam.aspect = 4 / 3; cam.fov = 66; cam.position.set(0, spec.shot.y, spec.shot.z); cam.rotation.set(spec.shot.pitch, 0, 0); cam.updateProjectionMatrix();
      renderer.setPixelRatio(1); renderer.setSize(800, 600, false); renderer.render(scene, cam);
      c.getContext("2d").drawImage(canvas, 0, 0);
      renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
      return new Promise(r => c.toBlob(r, "image/jpeg", .86));
    },
    destroy() {
      alive = false; renderer.setAnimationLoop(null); ro.disconnect(); io.disconnect(); offs.forEach(f => f()); clearTimeout(hintT); clearTimeout(toastT);
      scene.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); });
      owned.forEach(x => x.dispose()); for (const p of texCache.values()) p.then(t => t && t.dispose()); envTex.dispose(); renderer.dispose(); el.remove();
    },
  };
}
