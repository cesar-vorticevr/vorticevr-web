// Face filter: /x/ when the experience is kind "filtro" (front camera + MindAR face), and the live preview of
// /crear/filtro/ (a mannequin head made from the same canonical face). Everything is drawn in code, except the
// creator's own images:
//  · paint: drawn on the face mesh (MindAR's canonical face, 468 points) in its UV space, placed from the points' UVs,
//    so it follows every gesture. The eyes and the mouth are holes in the mesh: they always show through.
//  · items: stickers (drawn here) or the creator's images ("image", a PNG), each pinned to a point of the face
//    (ANCHORS) with an offset x, y in cm (the canonical face is ~15 cm wide), width s in cm and turn r in degrees.
//    "mejillas" puts it on both cheeks (mirrored).
//  · effect: what comes out of the mouth while it is open · frame: drawn over the whole picture with the color and text.
// Units inside an anchor are the canonical face's cm (MindAR's landmark matrix), in the preview too.

import { sfx } from "./sonidos.js";

export const ANCHORS = { cabeza: 10, frente: 151, ojos: 168, nariz: 4, boca: 0, barbilla: 152, mejillas: [205, 425] };
export const ANCHOR_NAMES = { cabeza: "Arriba de la cabeza", frente: "Frente", ojos: "Ojos", nariz: "Nariz", boca: "Boca", barbilla: "Barbilla", mejillas: "Mejillas (las dos)" };
export const PAINTS = { ninguna: "Sin pintura", catrina: "Catrina", corazones: "Corazones", mexico: "México", brillos: "Brillos", gatito: "Gatito", propia: "Mi propia pintura" };
export const EFFECTS = { ninguno: "Nada", flores: "Cempasúchil", calaveritas: "Calaveritas", nieve: "Nieve", confeti: "Confeti", estrellas: "Estrellas", corazones: "Corazones", huellas: "Huellitas" };
export const FRAMES = { ninguno: "Sin marco", muertos: "Papel picado", brillo: "Brillo", cinta: "Cinta", polaroid: "Foto instantánea" };
// color looks (their order is the number the shader gets) and the shader, which grades in sRGB and adds the vignette
// over the visible part of the camera image (vis = how much of the canvas is on screen)
export const LOOKS = { ninguno: "Natural", vivo: "Vivo", calido: "Cálido", frio: "Frío", bn: "Blanco y negro", sepia: "Antiguo", retro: "Retro", sueno: "Sueño" };
const LOOK_IDS = Object.keys(LOOKS);
const LOOK_SHADER = `
uniform sampler2D tDiffuse; uniform float look, vig, time, aspect; uniform vec2 vis; varying vec2 vUv;
float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 samp(vec2 uv){ return pow(max(texture2D(tDiffuse, uv).rgb, 0.0), vec3(1.0 / 2.2)); }
void main(){
  vec2 uv = vUv; vec3 c = samp(uv); float L = dot(c, vec3(0.299, 0.587, 0.114));
  if (look > 0.5 && look < 1.5) { c = mix(vec3(L), c, 1.45); c = (c - 0.5) * 1.08 + 0.5; }
  else if (look < 2.5 && look > 1.5) { c *= vec3(1.08, 1.0, 0.85); c = mix(vec3(L), c, 1.1) + vec3(0.02, 0.01, 0.0); }
  else if (look < 3.5 && look > 2.5) { c *= vec3(0.88, 1.0, 1.12); c = mix(vec3(L), c, 0.95); }
  else if (look < 4.5 && look > 3.5) { c = vec3((L - 0.5) * 1.15 + 0.5); }
  else if (look < 5.5 && look > 4.5) { c = vec3(L) * vec3(1.07, 0.95, 0.76) + vec3(0.05, 0.03, 0.0); }
  else if (look < 6.5 && look > 5.5) {
    vec2 o = vec2(0.004 / vis.x, 0.0);
    c = vec3(samp(uv + o).r, c.g, samp(uv - o).b);
    c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, 0.8) * vec3(1.05, 1.0, 0.9) + 0.05;
    c *= 0.93 + 0.07 * sin(uv.y * 700.0 / vis.y);
    c += (rnd(uv * vec2(731.0, 513.0) + time) - 0.5) * 0.12;
  }
  else if (look > 6.5) {
    vec3 b = vec3(0.0);
    for (int i = 0; i < 8; i++) { float a = float(i) * 0.785; b += samp(uv + vec2(cos(a), sin(a) * aspect) * 0.012 * vis.x); }
    b /= 8.0; c = 1.0 - (1.0 - c) * (1.0 - b * 0.55);
    c = mix(c, c * vec3(1.08, 0.94, 1.04) + vec3(0.04, 0.0, 0.03), 0.8);
  }
  if (vig > 0.0) {
    float r = length((uv - 0.5) / (vis * 0.5));   // 0 in the middle of the screen, 1 at the middle of each edge
    c *= 1.0 - smoothstep(0.55, 1.45, r) * vig * 0.9;
  }
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
const MOUTH = [13, 14];

// ---------- small drawing helpers ----------
const TAU = Math.PI * 2;
function heartPath(g, cx, cy, s) {   // s = half width
  g.moveTo(cx, cy + s * 0.9);
  g.bezierCurveTo(cx - s * 1.35, cy + s * 0.05, cx - s * 0.95, cy - s * 1.0, cx, cy - s * 0.38);
  g.bezierCurveTo(cx + s * 0.95, cy - s * 1.0, cx + s * 1.35, cy + s * 0.05, cx, cy + s * 0.9);
}
function starPath(g, cx, cy, R, n = 5, inner = 0.46, rot = -Math.PI / 2) {
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? R * inner : R; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  g.closePath();
}
function sparkle(g, cx, cy, R, color) {   // a 4-point twinkle
  g.save(); g.beginPath(); starPath(g, cx, cy, R, 4, 0.22, 0); g.fillStyle = color; g.shadowColor = color; g.shadowBlur = R * 0.8; g.fill(); g.restore();
}
function marigold(g, cx, cy, r, colors = ["#ff8c00", "#ffa31a", "#ffc94d"]) {   // cempasúchil: ruffled layers
  for (const [k, c] of [[1, colors[0]], [0.74, colors[1]], [0.48, colors[2]]]) {
    g.fillStyle = c; g.beginPath();
    const n = Math.round(10 + k * 8);
    for (let i = 0; i < n; i++) { const a = i / n * TAU; g.moveTo(cx + Math.cos(a) * r * k * 0.68 + r * k * 0.34, cy + Math.sin(a) * r * k * 0.68); g.arc(cx + Math.cos(a) * r * k * 0.68, cy + Math.sin(a) * r * k * 0.68, r * k * 0.34, 0, TAU); }
    g.fill();
  }
  g.fillStyle = "#c25a00"; g.beginPath(); g.arc(cx, cy, r * 0.14, 0, TAU); g.fill();
}
function blossom(g, cx, cy, r, color, center = "#ffd23f", petals = 6, rot = 0) {
  g.fillStyle = color;
  for (let i = 0; i < petals; i++) { const a = rot + i / petals * TAU; g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.5, r * 0.32, a, 0, TAU); g.fill(); }
  g.fillStyle = center; g.beginPath(); g.arc(cx, cy, r * 0.3, 0, TAU); g.fill();
}
function leaf(g, cx, cy, len, ang, color = "#1f9d55") {
  g.save(); g.translate(cx, cy); g.rotate(ang); g.fillStyle = color; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0); g.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0); g.fill(); g.restore();
}
const shade = (hex, t) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); const to = t > 0 ? 255 : 0; return "#" + c.map(v => Math.round(v + (to - v) * Math.abs(t)).toString(16).padStart(2, "0")).join(""); };
const okColor = c => /^#[0-9a-f]{6}$/i.test(String(c || "")) ? c : "#8b3fd6";

// ---------- stickers: name, where they go by default, height/width and how they are drawn ----------
export const STICKERS = {
  "lentes-corazon": { name: "Lentes de corazón", anchor: "ojos", x: 0, y: -0.6, z: 1.2, s: 15.5, ratio: 0.42, draw(g, w, h) {
    g.lineJoin = "round";
    for (const cx of [w * 0.27, w * 0.73]) {
      g.beginPath(); heartPath(g, cx, h * 0.5, w * 0.2);
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,120,175,.72)"); gr.addColorStop(1, "rgba(230,20,110,.62)"); g.fillStyle = gr; g.fill();
      g.lineWidth = w * 0.03; g.strokeStyle = "#ff2d7a"; g.stroke();
      g.beginPath(); g.ellipse(cx - w * 0.07, h * 0.36, w * 0.045, w * 0.02, -0.6, 0, TAU); g.fillStyle = "rgba(255,255,255,.75)"; g.fill();
    }
    g.lineCap = "round"; g.lineWidth = w * 0.028; g.strokeStyle = "#ff2d7a";
    g.beginPath(); g.moveTo(w * 0.42, h * 0.36); g.quadraticCurveTo(w * 0.5, h * 0.24, w * 0.58, h * 0.36); g.stroke();
    g.beginPath(); g.moveTo(w * 0.02, h * 0.3); g.lineTo(w * 0.09, h * 0.36); g.moveTo(w * 0.98, h * 0.3); g.lineTo(w * 0.91, h * 0.36); g.stroke();
  } },
  "lentes-sol": { name: "Lentes oscuros", anchor: "ojos", x: 0, y: -0.7, z: 1.2, s: 15.5, ratio: 0.36, draw(g, w, h) {
    const lens = (x0) => { g.beginPath(); g.moveTo(x0, h * 0.2); g.lineTo(x0 + w * 0.38, h * 0.2); g.quadraticCurveTo(x0 + w * 0.39, h * 0.95, x0 + w * 0.2, h * 0.9); g.quadraticCurveTo(x0 + w * 0.01, h * 0.86, x0, h * 0.2); g.closePath(); };
    for (const x0 of [w * 0.06, w * 0.56]) {
      lens(x0); const gr = g.createLinearGradient(0, h * 0.2, 0, h); gr.addColorStop(0, "rgba(20,18,30,.95)"); gr.addColorStop(1, "rgba(60,50,90,.9)"); g.fillStyle = gr; g.fill();
      g.lineWidth = w * 0.022; g.strokeStyle = "#0b0a10"; g.lineJoin = "round"; g.stroke();
      g.save(); lens(x0); g.clip(); g.fillStyle = "rgba(255,255,255,.22)"; g.beginPath(); g.moveTo(x0 + w * 0.05, h * 0.2); g.lineTo(x0 + w * 0.15, h * 0.2); g.lineTo(x0 + w * 0.02, h * 0.8); g.lineTo(x0 - w * 0.06, h * 0.8); g.fill(); g.restore();
    }
    g.fillStyle = "#0b0a10"; g.fillRect(w * 0.03, h * 0.12, w * 0.94, h * 0.13); g.fillRect(w * 0.43, h * 0.2, w * 0.14, h * 0.08);
  } },
  corona: { name: "Corona", anchor: "cabeza", x: 0, y: 5.2, z: -1, s: 11, ratio: 0.62, draw(g, w, h) {
    const k = w / 300; g.save(); g.translate(w / 2, h * 0.56); g.scale(k, k);
    g.beginPath(); g.moveTo(-110, 60); g.lineTo(-128, -40); g.lineTo(-60, 5); g.lineTo(0, -78); g.lineTo(60, 5); g.lineTo(128, -40); g.lineTo(110, 60); g.closePath();
    const gr = g.createLinearGradient(0, -78, 0, 60); gr.addColorStop(0, "#ffe08a"); gr.addColorStop(1, "#ffab3d"); g.fillStyle = gr; g.shadowColor = "rgba(255,190,85,.9)"; g.shadowBlur = 20; g.fill(); g.shadowBlur = 0;
    g.lineWidth = 8; g.lineJoin = "round"; g.strokeStyle = "#fff6dc"; g.stroke();
    g.fillStyle = "#e0a12a"; g.fillRect(-108, 38, 216, 14);
    [[-128, -40, "#ff4f8b"], [0, -78, "#29c5f6"], [128, -40, "#ff4f8b"]].forEach(([x, y, c]) => { g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fillStyle = c; g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 5; g.stroke(); });
    [[-60, 18, "#16a663"], [0, 14, "#e4007c"], [60, 18, "#16a663"]].forEach(([x, y, c]) => { g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 11, y); g.lineTo(x, y + 14); g.lineTo(x - 11, y); g.closePath(); g.fillStyle = c; g.fill(); g.strokeStyle = "#fff6dc"; g.lineWidth = 4; g.stroke(); });
    g.restore();
  } },
  flores: { name: "Corona de flores", anchor: "cabeza", x: 0, y: 1.6, z: 0.5, s: 20, ratio: 0.42, draw(g, w, h, color) {
    const cx = w / 2, cy = h * 2.1, rx = w * 0.46, ry = h * 1.85, list = [];
    for (let i = 0; i <= 8; i++) { const a = Math.PI + 0.42 + i / 8 * (Math.PI - 0.84); list.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, i]); }
    list.forEach(([x, y], i) => { if (i < list.length - 1) { leaf(g, x, y, w * 0.09, -1.9 + i * 0.4); leaf(g, x, y, w * 0.08, -0.6 + i * 0.25, "#27b864"); } });
    list.forEach(([x, y, i]) => {
      const r = w * (i % 2 ? 0.055 : 0.075);
      if (i % 4 === 0) marigold(g, x, y, r); else if (i % 4 === 2) marigold(g, x, y, r, ["#ffb000", "#ffc94d", "#ffe08a"]);
      else blossom(g, x, y, r, i % 3 ? "#e4007c" : color, "#ffd23f", 6, i);
    });
  } },
  orejas: { name: "Orejas de gato", anchor: "cabeza", x: 0, y: 4.6, z: -0.5, s: 17, ratio: 0.42, draw(g, w, h) {
    for (const side of [-1, 1]) {
      g.save(); g.translate(w / 2 + side * w * 0.33, 0); g.scale(side, 1);
      g.beginPath(); g.moveTo(-w * 0.14, h); g.quadraticCurveTo(-w * 0.12, h * 0.25, w * 0.02, h * 0.04); g.quadraticCurveTo(w * 0.15, h * 0.45, w * 0.15, h); g.closePath();
      g.fillStyle = "#2b2233"; g.fill(); g.lineWidth = w * 0.012; g.strokeStyle = "#120d18"; g.stroke();
      g.beginPath(); g.moveTo(-w * 0.08, h); g.quadraticCurveTo(-w * 0.07, h * 0.42, w * 0.02, h * 0.24); g.quadraticCurveTo(w * 0.1, h * 0.55, w * 0.09, h); g.closePath();
      g.fillStyle = "#ff9ec4"; g.fill(); g.restore();
    }
  } },
  bigote: { name: "Bigote", anchor: "boca", x: 0, y: 0.55, z: 0.7, s: 8, ratio: 0.34, draw(g, w, h) {
    g.save(); g.scale(w / 512, h / 174);
    for (const side of [1, -1]) {
      g.save(); g.translate(256, 0); g.scale(side, 1); g.translate(-256, 0);
      g.beginPath(); g.moveTo(256, 54); g.bezierCurveTo(300, 8, 385, 22, 420, 74); g.bezierCurveTo(442, 104, 486, 98, 494, 62); g.bezierCurveTo(504, 126, 430, 158, 378, 126); g.bezierCurveTo(330, 98, 292, 112, 256, 104); g.closePath();
      g.fillStyle = "#2a1a12"; g.fill(); g.restore();
    }
    g.restore();
  } },
  gorro: { name: "Gorro de fiesta", anchor: "cabeza", x: -1.5, y: 7.6, z: -1, s: 7, ratio: 1.3, r: 14, draw(g, w, h, color) {
    const tip = [w / 2, h * 0.12], L = [w * 0.1, h * 0.93], R = [w * 0.9, h * 0.93];
    g.save(); g.beginPath(); g.moveTo(...tip); g.lineTo(...R); g.lineTo(...L); g.closePath(); g.clip();
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#ffd23f"; g.lineWidth = w * 0.09; for (let k = -2; k < 8; k++) { g.beginPath(); g.moveTo(-w * 0.2, k * h * 0.17); g.lineTo(w * 1.2, k * h * 0.17 + h * 0.35); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,.75)"; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc((i * 97) % w, (i * 151) % h, w * 0.02, 0, TAU); g.fill(); }
    g.restore();
    g.fillStyle = "#fff"; for (let i = 0; i <= 8; i++) { g.beginPath(); g.arc(L[0] + (R[0] - L[0]) * i / 8, h * 0.93, w * 0.065, 0, TAU); g.fill(); }
    g.fillStyle = "#fff"; g.beginPath(); g.arc(tip[0], tip[1], w * 0.11, 0, TAU); g.fill(); g.fillStyle = "#ff4f8b"; g.beginPath(); g.arc(tip[0], tip[1], w * 0.07, 0, TAU); g.fill();
  } },
  corazon: { name: "Corazón", anchor: "mejillas", x: 0, y: 0, z: 0.4, s: 2.6, ratio: 0.9, draw(g, w, h) {
    g.beginPath(); heartPath(g, w / 2, h * 0.52, w * 0.36); g.fillStyle = "#ff2d55"; g.fill(); g.lineWidth = w * 0.06; g.strokeStyle = "#fff"; g.stroke();
    g.beginPath(); g.ellipse(w * 0.36, h * 0.36, w * 0.08, w * 0.04, -0.7, 0, TAU); g.fillStyle = "rgba(255,255,255,.8)"; g.fill();
  } },
};
// The stickers above (drawn in code) stay for the filters made with them, but the creator no longer offers them.
for (const st of Object.values(STICKERS)) st.legacy = true;

// ---------- accessories, particles and screen decorations from images (assets/filtros/*.webp) ----------
// Made in ChatGPT from _plantillas/filtros/guia-chatgpt.html and prepared with tools/procesar-accesorios.mjs, which
// prints these sizes (cropped to the visible pixels).
export const ASSET_DIR = "/assets/filtros/";
export const ASSET_SIZES = {"corona-flores":[768,504],"lentes-catrina":[768,378],"particula-cempasuchil":[256,250],"particula-petalo":[255,256],"papel-picado":[1024,340],"esquina-cempasuchil":[1017,1024],"sombrero-copa":[768,509],"lentes-catrin":[768,303],"bigote-catrin":[768,218],"mono-catrin":[768,462],"particula-calaverita":[204,256],"gorro-santa":[768,507],"diadema-reno":[768,505],"nariz-reno":[384,371],"lentes-navidad":[768,339],"particula-copo":[237,256],"particula-esfera":[210,256],"luces-navidad":[1024,330],"esquina-pino":[1024,1024],"gorro-fiesta":[515,768],"lentes-fiesta":[768,348],"particula-serpentina":[97,256],"particula-estrella":[256,255],"guirnalda-banderines":[1024,311],"esquina-globos":[1009,1024],"orejas-gato":[768,335],"nariz-gato":[768,225],"lentes-gato":[768,273],"particula-huella":[256,214],"lentes-corazon":[768,308],"diadema-corazones":[768,412],"corazon-mejilla":[384,317],"particula-corazon":[256,210],"esquina-corazones":[762,1024],"lentes-vortice":[768,362]};
export const assetUrl = key => ASSET_DIR + key + ".webp";
const ratioOf = key => ASSET_SIZES[key][1] / ASSET_SIZES[key][0];
// Accessories from images: where they go and their width s (cm). On the head "dy" is the gap from the point to the
// bottom edge (it sits on the head), on the chin the gap to the top edge (it hangs); elsewhere y is the center.
const ACC = [
  ["corona-flores", "Corona de flores", "Día de Muertos", "cabeza", 19, { dy: -0.6 }],
  ["lentes-catrina", "Lentes de catrina", "Día de Muertos", "ojos", 16.5, { y: -0.6 }],
  ["sombrero-copa", "Sombrero de copa", "Día de Muertos", "cabeza", 19.5, { dy: -0.2 }],
  ["lentes-catrin", "Lentes de catrín", "Día de Muertos", "ojos", 16, { y: -0.6 }],
  ["bigote-catrin", "Bigote de catrín", "Día de Muertos", "boca", 9.5, { y: 0.5 }],
  ["mono-catrin", "Moño", "Día de Muertos", "barbilla", 8.5, { dy: 0.8 }],
  ["gorro-santa", "Gorro de Santa", "Navidad", "cabeza", 19, { dy: -0.2 }],
  ["diadema-reno", "Cuernos de reno", "Navidad", "cabeza", 21, { dy: -0.5 }],
  ["nariz-reno", "Nariz de reno", "Navidad", "nariz", 3.4, { y: 0.1 }],
  ["lentes-navidad", "Lentes navideños", "Navidad", "ojos", 16.5, { y: -0.6 }],
  ["gorro-fiesta", "Gorro de fiesta", "Fiesta", "cabeza", 8, { dy: 1, x: -1.5, r: 12 }],
  ["lentes-fiesta", "Lentes de estrella", "Fiesta", "ojos", 17, { y: -0.6 }],
  ["orejas-gato", "Orejas de gato", "Gatito", "cabeza", 19, { dy: -0.4 }],
  ["nariz-gato", "Nariz y bigotes", "Gatito", "nariz", 13, { y: -0.7 }],
  ["lentes-gato", "Lentes ojo de gato", "Gatito", "ojos", 16.5, { y: -0.6 }],
  ["lentes-corazon", "Lentes de corazón", "Amor", "ojos", 16.5, { y: -0.6 }],
  ["diadema-corazones", "Antenitas de corazón", "Amor", "cabeza", 19, { dy: -0.4 }],
  ["corazon-mejilla", "Corazón", "Amor", "mejillas", 2.8, { y: 0 }],
  ["lentes-vortice", "Visor Vórtice VR", "Vórtice VR", "ojos", 17, { y: -0.4 }],
];
for (const [key, name, group, anchor, s, o] of ACC) {
  const ratio = ratioOf(key), h = s * ratio;
  const y = o.y != null ? o.y : anchor === "barbilla" ? -((o.dy || 0) + h / 2) : (o.dy || 0) + h / 2;
  STICKERS[key] = { name, group, anchor, x: o.x || 0, y: Math.round(y * 10) / 10, z: 0.8, s, r: o.r || 0, ratio, src: assetUrl(key) };
}
// Ready-made screen decorations (items "pantalla" with a key instead of an upload). side = the corner the picture was
// drawn for: on the other side it is mirrored, so a corner bouquet always opens toward the middle.
export const SCREEN_PRESETS = {
  "papel-picado": { name: "Papel picado", group: "Día de Muertos", pos: "ac", s: 1 },
  "esquina-cempasuchil": { name: "Ramo de cempasúchil", group: "Día de Muertos", pos: "bi", s: 0.42, side: "i" },
  "luces-navidad": { name: "Luces navideñas", group: "Navidad", pos: "ac", s: 1 },
  "esquina-pino": { name: "Rama de pino", group: "Navidad", pos: "bi", s: 0.42, side: "i" },
  "guirnalda-banderines": { name: "Banderines", group: "Fiesta", pos: "ac", s: 1 },
  "esquina-globos": { name: "Globos", group: "Fiesta", pos: "bi", s: 0.42, side: "i" },
  "esquina-corazones": { name: "Corazones", group: "Amor", pos: "bd", s: 0.36, side: "d" },
};
// what comes out of the mouth: images (white tint = their own colors)
const PARTICLES = { flores: ["particula-cempasuchil", "particula-petalo"], calaveritas: ["particula-calaverita", "particula-cempasuchil"], nieve: ["particula-copo", "particula-esfera"],
  confeti: ["particula-serpentina", "particula-estrella"], estrellas: ["particula-estrella"], corazones: ["particula-corazon"], huellas: ["particula-huella", "particula-corazon"] };

export function stickerCanvas(key, color, width = 512) {
  const st = STICKERS[key], c = document.createElement("canvas");
  c.width = width; c.height = Math.round(width * st.ratio);
  st.draw(c.getContext("2d"), c.width, c.height, okColor(color));
  return c;
}

// ---------- face paint, drawn in the face's UV space ----------
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const EYE_R = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
const EYE_L = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249];
const LIPS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const LIP_UP = [185, 40, 39, 37, 0, 267, 269, 270, 409], LIP_DN = [146, 91, 181, 84, 17, 314, 405, 321, 375];
const BROW_R = [70, 63, 105, 66, 107], BROW_L = [300, 293, 334, 296, 336];
const LIPS_IN = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
const NOSE = [168, 6, 197, 195, 5, 4], NOSTRILS = [98, 97, 2, 326, 327];
// helpers in the face's UV space (S px square, v up)
function uvTools(g, uvAt, S) {
  const P = i => { const [u, v] = uvAt(i); return [u * S, (1 - v) * S]; };
  const poly = (list, close = true) => { g.beginPath(); list.forEach((i, k) => { const [x, y] = P(i); k ? g.lineTo(x, y) : g.moveTo(x, y); }); if (close) g.closePath(); };
  const mid = list => { let x = 0, y = 0; for (const i of list) { const p = P(i); x += p[0]; y += p[1]; } return [x / list.length, y / list.length]; };
  return { P, poly, mid };
}
// the eyes and the inside of the mouth stay clear in every paint: the mesh has triangles across them, so painting
// there would cover the real eyes, and the teeth when the mouth opens
function clearHoles(g, uvAt, S) {
  const { poly, mid } = uvTools(g, uvAt, S);
  g.save(); g.globalCompositeOperation = "destination-out"; g.fillStyle = g.strokeStyle = "#000"; g.lineJoin = "round";
  for (const eye of [EYE_R, EYE_L]) { const m = mid(eye); g.save(); g.translate(m[0], m[1]); g.scale(1.2, 1.45); g.translate(-m[0], -m[1]); poly(eye); g.fill(); g.restore(); }
  poly(LIPS_IN); g.fill(); g.lineWidth = S * 0.007; g.stroke();
  g.restore();
}
function softEdge(g, uvAt, S) {   // fades the outline of the face, so a paint does not look like a cut-out mask
  const { poly } = uvTools(g, uvAt, S);
  g.save(); g.globalCompositeOperation = "destination-out";
  for (const [lw, a] of [[60, 0.18], [40, 0.22], [22, 0.3], [10, 0.4]]) { poly(OVAL); g.lineWidth = lw * S / 1024; g.strokeStyle = `rgba(0,0,0,${a})`; g.stroke(); }
  g.restore();
}
// The template ("machote") to paint your own face paint: the face unfolded in UV space with guides, and the steps.
// What is painted outside the outline is not seen; eyes and inside of the mouth are cleared on their own.
export function templateCanvas(uvAt, S = 1024) {
  const c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d"), { P, poly, mid } = uvTools(g, uvAt, S), k = S / 1024;
  poly(OVAL); g.fillStyle = "#f3ecfa"; g.fill(); g.lineWidth = 4 * k; g.strokeStyle = "#8b3fd6"; g.stroke();
  g.setLineDash([10 * k, 10 * k]); g.lineWidth = 2 * k; g.strokeStyle = "rgba(139,63,214,.45)"; g.beginPath(); g.moveTo(...P(10)); g.lineTo(...P(152)); g.stroke(); g.setLineDash([]);
  const hatch = (list, label, sy = 1) => {
    g.save(); poly(list); g.clip(); g.strokeStyle = "rgba(229,36,59,.55)"; g.lineWidth = 2 * k; const m = mid(list);
    for (let x = -80; x <= 80; x += 7) { g.beginPath(); g.moveTo(m[0] + x * k - 40 * k, m[1] + 40 * k); g.lineTo(m[0] + x * k + 40 * k, m[1] - 40 * k); g.stroke(); }
    g.restore(); poly(list); g.lineWidth = 3 * k; g.strokeStyle = "#e5243b"; g.stroke();
    g.font = `700 ${13 * k}px Sora, system-ui, sans-serif`; g.textAlign = "center"; g.fillStyle = "#e5243b"; g.fillText(label, m[0], m[1] + sy * 34 * k);
  };
  hatch(EYE_R, "OJO (queda libre)"); hatch(EYE_L, "OJO (queda libre)");
  poly(LIPS); g.lineWidth = 3 * k; g.strokeStyle = "#8b3fd6"; g.stroke();
  hatch(LIPS_IN, "BOCA (queda libre)", 1.4);
  for (const b of [BROW_R, BROW_L]) { poly(b, false); g.lineWidth = 5 * k; g.lineCap = "round"; g.strokeStyle = "rgba(139,63,214,.7)"; g.stroke(); }
  poly(NOSE, false); g.lineWidth = 3 * k; g.strokeStyle = "rgba(139,63,214,.7)"; g.stroke(); poly(NOSTRILS, false); g.stroke();
  g.font = `700 ${15 * k}px Sora, system-ui, sans-serif`; g.textAlign = "center"; g.fillStyle = "rgba(90,31,143,.75)";
  const lab = (t, p, dy = 0) => g.fillText(t, p[0], p[1] + dy * k);
  lab("FRENTE", P(151), -10); lab("NARIZ", P(4), 38); lab("BARBILLA", P(152), -30); lab("MEJILLA", mid([205, 50, 187, 123])); lab("MEJILLA", mid([425, 280, 411, 352]));
  g.textAlign = "left"; g.fillStyle = "#5a1f8f"; g.font = `800 ${20 * k}px Sora, system-ui, sans-serif`; g.fillText("Machote de pintura facial · Vórtice VR", 18 * k, 34 * k);
  g.font = `500 ${14 * k}px Sora, system-ui, sans-serif`; g.fillStyle = "#3b2160";
  ["1. Pinta en una capa nueva, encima de esta guía.", "2. Oculta o borra esta guía (deja solo tu pintura).", "3. Exporta en PNG de 1024 × 1024, con fondo transparente."].forEach((t, i) => g.fillText(t, 18 * k, (58 + i * 19) * k));
  g.textAlign = "right"; ["Lo que quede fuera del contorno no se ve.", "Ojos y boca se borran solos.", "Lo semitransparente se ve como maquillaje."].forEach((t, i) => g.fillText(t, S - 18 * k, (40 + i * 19) * k));
  return c;
}

export function paintCanvas(kind, uvAt, color, S = 1024, img = null) {
  const c = document.createElement("canvas"); c.width = c.height = S;
  if (kind === "propia") {   // the creator's own paint, painted over the template
    const g = c.getContext("2d"); if (img) g.drawImage(img, 0, 0, S, S);
    softEdge(g, uvAt, S); clearHoles(g, uvAt, S);
    return c;
  }
  const g = c.getContext("2d"), P = i => { const [u, v] = uvAt(i); return [u * S, (1 - v) * S]; };
  const poly = (list) => { g.beginPath(); list.forEach((i, k) => { const [x, y] = P(i); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
  const mid = list => { let x = 0, y = 0; for (const i of list) { const p = P(i); x += p[0]; y += p[1]; } return [x / list.length, y / list.length]; };
  const radius = (list, [cx, cy]) => Math.max(...list.map(i => { const [x, y] = P(i); return Math.hypot(x - cx, y - cy); }));
  const between = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  color = okColor(color);
  const cheeks = [mid([205, 50, 187, 123]), mid([425, 280, 411, 352])];
  if (kind === "catrina") {
    // white face with soft edges
    poly(OVAL); g.fillStyle = "rgba(255,251,246,.62)"; g.fill();   // like face paint: the skin shows through
    g.globalCompositeOperation = "destination-out";
    for (const [lw, a] of [[60, 0.18], [40, 0.22], [22, 0.3], [10, 0.4]]) { poly(OVAL); g.lineWidth = lw; g.strokeStyle = `rgba(0,0,0,${a})`; g.stroke(); }
    g.globalCompositeOperation = "source-over";
    // eye sockets: flower petals around a black circle
    const petals = [color, "#ff8c00", "#29c5f6", "#e4007c", "#ffc20e", "#16a663"];
    for (const eye of [EYE_R, EYE_L]) {
      const m = mid(eye), r = radius(eye, m) * 1.45;
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.ellipse(m[0] + Math.cos(a) * r * 1.2, m[1] + Math.sin(a) * r * 1.2, r * 0.42, r * 0.24, a, 0, TAU); g.fillStyle = petals[i % petals.length]; g.fill(); }
      for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU; g.beginPath(); g.arc(m[0] + Math.cos(a) * r * 1.62, m[1] + Math.sin(a) * r * 1.62, r * 0.07, 0, TAU); g.fillStyle = "#1a0f1a"; g.fill(); }
      g.beginPath(); g.arc(m[0], m[1], r, 0, TAU); g.fillStyle = "rgba(20,10,20,.82)"; g.fill();
    }
    // nose: an upside-down heart
    const nose = between(P(4), P(2), 0.55), nw = Math.hypot(P(98)[0] - P(327)[0], P(98)[1] - P(327)[1]) * 0.62;
    g.save(); g.translate(nose[0], nose[1]); g.scale(1, -1); g.beginPath(); heartPath(g, 0, 0, nw); g.fillStyle = "#140a14"; g.fill(); g.restore();
    // mouth: dark lips, a long stitched line out to the cheeks
    poly(LIPS); g.fillStyle = "rgba(20,10,20,.78)"; g.fill();
    const a = P(61), b = P(291), ext = (b[0] - a[0]) * 0.55;
    g.strokeStyle = "#140a14"; g.lineCap = "round"; g.lineWidth = S * 0.006;
    g.beginPath(); g.moveTo(a[0] - ext, a[1] - ext * 0.18); g.quadraticCurveTo(a[0] - ext * 0.4, a[1] + ext * 0.05, a[0], a[1]); g.moveTo(b[0], b[1]); g.quadraticCurveTo(b[0] + ext * 0.4, b[1] + ext * 0.05, b[0] + ext, b[1] - ext * 0.18); g.stroke();
    g.lineWidth = S * 0.004;
    for (let k = 1; k <= 3; k++) for (const [p, d] of [[a, -1], [b, 1]]) { const t = k / 3.6, x = p[0] + d * ext * t, y = p[1] - ext * 0.18 * t * t + ext * 0.04 * t; g.beginPath(); g.moveTo(x, y - S * 0.012); g.lineTo(x, y + S * 0.012); g.stroke(); }
    for (let k = 0; k < LIP_UP.length; k++) { const u = P(LIP_UP[k]), d = P(LIP_DN[k]); g.beginPath(); g.moveTo(u[0], u[1] - S * 0.008); g.lineTo(d[0], d[1] + S * 0.008); g.strokeStyle = "rgba(255,251,246,.85)"; g.stroke(); }
    // forehead: a flower and an arc of dots over the brows
    const fh = between(P(151), P(9), 0.2); blossom(g, fh[0], fh[1], S * 0.04, color, "#ffc20e", 8);
    for (const d of [-1, 1]) for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(fh[0] + d * S * (0.06 + k * 0.035), fh[1] + S * (0.004 + k * k * 0.006), S * 0.007, 0, TAU); g.fillStyle = petals[(k + 1) % petals.length]; g.fill(); }
    for (const brow of [BROW_R, BROW_L]) for (const i of brow) { const [x, y] = P(i); g.beginPath(); g.arc(x, y - S * 0.012, S * 0.006, 0, TAU); g.fillStyle = "#140a14"; g.fill(); }
    // cheeks: swirls · chin: three dots
    for (const [k, ch] of cheeks.entries()) {
      g.beginPath(); for (let t = 0; t < 14; t += 0.2) { const r = S * 0.0035 * t, x = ch[0] + Math.cos(t * (k ? 1 : -1)) * r, y = ch[1] + Math.sin(t) * r; t ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.strokeStyle = color; g.lineWidth = S * 0.006; g.stroke();
    }
    const chin = between(P(17), P(152), 0.5); for (let k = -1; k <= 1; k++) { g.beginPath(); g.arc(chin[0] + k * S * 0.03, chin[1] - Math.abs(k) * S * 0.01, S * 0.01, 0, TAU); g.fillStyle = "#140a14"; g.fill(); }
  } else if (kind === "corazones") {
    for (const ch of cheeks) { const gr = g.createRadialGradient(ch[0], ch[1], 0, ch[0], ch[1], S * 0.07); gr.addColorStop(0, "rgba(255,90,120,.35)"); gr.addColorStop(1, "rgba(255,90,120,0)"); g.fillStyle = gr; g.fillRect(ch[0] - S * 0.07, ch[1] - S * 0.07, S * 0.14, S * 0.14);
      g.beginPath(); heartPath(g, ch[0], ch[1], S * 0.03); g.fillStyle = "#ff2d55"; g.fill(); g.lineWidth = S * 0.004; g.strokeStyle = "#fff"; g.stroke();
      g.beginPath(); heartPath(g, ch[0] + S * 0.045 * (ch === cheeks[0] ? -1 : 1), ch[1] - S * 0.04, S * 0.013); g.fillStyle = "#ff7aa8"; g.fill(); }
  } else if (kind === "mexico") {
    for (const ch of cheeks) {
      const w = S * 0.03, h = S * 0.06; g.save(); g.translate(ch[0], ch[1]); g.rotate(ch === cheeks[0] ? 0.12 : -0.12);
      g.globalAlpha = 0.9; ["#006847", "#ffffff", "#ce1126"].forEach((c, k) => { g.fillStyle = c; g.fillRect(-w * 1.5 + k * w, -h / 2, w, h); });
      g.beginPath(); g.arc(0, 0, w * 0.32, 0, TAU); g.fillStyle = "#8a5a2b"; g.fill(); g.restore();
    }
  } else if (kind === "brillos") {
    for (const ch of cheeks) { const gr = g.createRadialGradient(ch[0], ch[1], 0, ch[0], ch[1], S * 0.08); gr.addColorStop(0, "rgba(255,110,160,.4)"); gr.addColorStop(1, "rgba(255,110,160,0)"); g.fillStyle = gr; g.fillRect(ch[0] - S * 0.08, ch[1] - S * 0.08, S * 0.16, S * 0.16); }
    for (const [eye, d] of [[EYE_R, -1], [EYE_L, 1]]) {
      const m = mid(eye), r = radius(eye, m);
      for (let k = 0; k < 7; k++) { const a = (d < 0 ? Math.PI : 0) + d * (0.2 + k * 0.18) * (d < 0 ? -1 : 1); sparkle(g, m[0] + Math.cos(a + (d < 0 ? 0.6 : -0.6)) * r * (1.6 + (k % 2) * 0.35), m[1] + Math.sin(a + 0.6) * r * (1.2 + (k % 3) * 0.3), S * (0.006 + (k % 3) * 0.004), k % 2 ? "#ffd23f" : "#ffffff"); }
    }
  } else if (kind === "gatito") {
    const n = P(4); g.beginPath(); g.moveTo(n[0] - S * 0.025, n[1] - S * 0.012); g.lineTo(n[0] + S * 0.025, n[1] - S * 0.012); g.lineTo(n[0], n[1] + S * 0.018); g.closePath(); g.fillStyle = "#ff7aa8"; g.fill();
    g.strokeStyle = "#1a1220"; g.lineWidth = S * 0.004; g.lineCap = "round";
    for (const [i, d] of [[205, -1], [425, 1]]) { const [x, y] = P(i); for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x - d * S * 0.03, y + k * S * 0.012); g.lineTo(x + d * S * 0.07, y + k * S * 0.03 - S * 0.005); g.stroke(); } }
    for (const ch of cheeks) for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(ch[0] + (k - 1) * S * 0.014, ch[1] - S * 0.03 + (k === 1 ? -S * 0.008 : 0), S * 0.0045, 0, TAU); g.fillStyle = "#1a1220"; g.fill(); }
  }
  clearHoles(g, uvAt, S);
  return c;
}

// ---------- the frame over the whole picture ----------
export function drawFrame(g, w, h, style, color, text) {
  g.clearRect(0, 0, w, h);
  if (!style || style === "ninguno") return;
  color = okColor(color);
  const S = Math.min(w, h), rr = (x, y, ww, hh, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, ww, hh, r); else g.rect(x, y, ww, hh); };
  const textAt = (y, fill, ink, band) => {
    if (!text) return;
    let size = S * 0.075; g.font = `700 ${size}px Sora, system-ui, sans-serif`;
    while (g.measureText(text).width > w * 0.78 && size > S * 0.035) { size -= 2; g.font = `700 ${size}px Sora, system-ui, sans-serif`; }
    const tw = g.measureText(text).width;
    if (band) { rr(w / 2 - tw / 2 - size * 0.7, y - size * 0.85, tw + size * 1.4, size * 1.7, size * 0.85); g.fillStyle = fill; g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = size * 0.4; g.fill(); g.shadowBlur = 0; g.lineWidth = size * 0.08; g.strokeStyle = "#fff"; g.stroke(); }
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = ink; g.fillText(text, w / 2, y + size * 0.04);
  };
  if (style === "brillo") {
    const m = S * 0.03;
    for (const [lw, c, blur] of [[S * 0.03, color, S * 0.05], [S * 0.008, "#fff", 0]]) { rr(m, m, w - 2 * m, h - 2 * m, S * 0.07); g.lineWidth = lw; g.strokeStyle = c; g.shadowColor = color; g.shadowBlur = blur; g.stroke(); g.shadowBlur = 0; }
    for (const [x, y] of [[m, m], [w - m, m], [m, h - m], [w - m, h - m]]) { sparkle(g, x, y, S * 0.06, "#fff3c4"); sparkle(g, x + (x < w / 2 ? 1 : -1) * S * 0.07, y + (y < h / 2 ? 1 : -1) * S * 0.04, S * 0.025, "#ffd23f"); }
    textAt(h * 0.8, color, "#fff", true);
  } else if (style === "polaroid") {
    const m = S * 0.04, bottom = h * 0.27;
    g.fillStyle = "#fffdf8"; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "destination-out"; rr(m, m, w - 2 * m, h - m - bottom, S * 0.015); g.fill(); g.globalCompositeOperation = "source-over";
    g.fillStyle = color; g.fillRect(0, h - S * 0.018, w, S * 0.018);
    textAt(h - bottom * 0.72, null, color, false);
  } else if (style === "cinta") {
    const y = h * 0.8, bh = S * 0.13;
    g.save(); g.translate(w / 2, y); g.rotate(-0.04);
    g.beginPath(); g.moveTo(-w * 0.55, -bh / 2); g.lineTo(w * 0.55, -bh / 2); g.lineTo(w * 0.5, 0); g.lineTo(w * 0.55, bh / 2); g.lineTo(-w * 0.55, bh / 2); g.lineTo(-w * 0.5, 0); g.closePath();
    g.fillStyle = color; g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = S * 0.03; g.fill(); g.shadowBlur = 0;
    g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = S * 0.006; g.setLineDash([S * 0.02, S * 0.014]); g.beginPath(); g.moveTo(-w * 0.5, -bh / 2 + S * 0.014); g.lineTo(w * 0.5, -bh / 2 + S * 0.014); g.moveTo(-w * 0.5, bh / 2 - S * 0.014); g.lineTo(w * 0.5, bh / 2 - S * 0.014); g.stroke(); g.setLineDash([]);
    g.restore();
    g.save(); g.translate(0, 0); textAt(y, null, "#fff", false); g.restore();
    for (const [x, yy, r] of [[w * 0.12, y - bh, S * 0.035], [w * 0.88, y + bh * 0.9, S * 0.03], [w * 0.8, y - bh * 1.1, S * 0.02]]) sparkle(g, x, yy, r, "#fff3c4");
  } else if (style === "muertos") {
    // papel picado hanging from a string under the logo
    const top = h * 0.1, n = Math.max(5, Math.round(w / (S * 0.21))), fw = w / n, fh = S * 0.19, cols = ["#e4007c", "#ff8c00", "#8b3fd6", "#00a6d6", "#ffc20e", "#16a663"];
    for (let i = 0; i < n; i++) {
      const x = i * fw + fw * 0.05, y = top + Math.sin((i + 0.5) / n * Math.PI) * S * 0.03, ww = fw * 0.9;
      g.save(); g.translate(x, y); g.beginPath(); g.moveTo(0, 0); g.lineTo(ww, 0); g.lineTo(ww, fh * 0.86);
      for (let k = 6; k >= 0; k--) g.lineTo(ww * k / 6, fh * (k % 2 ? 1 : 0.86));
      g.closePath(); g.fillStyle = i === 2 ? color : cols[i % cols.length]; g.globalAlpha = 0.93; g.fill(); g.globalAlpha = 1;
      g.globalCompositeOperation = "destination-out";
      g.beginPath(); heartPath(g, ww / 2, fh * 0.42, ww * 0.16); g.fill();
      for (const [a, b] of [[0.2, 0.18], [0.8, 0.18], [0.2, 0.68], [0.8, 0.68]]) { g.beginPath(); g.arc(ww * a, fh * b, ww * 0.055, 0, TAU); g.fill(); }
      for (let k = 0; k < 5; k++) { g.beginPath(); const cx = ww * (0.14 + k * 0.18), cy = fh * 0.86 - ww * 0.07; g.moveTo(cx, cy - ww * 0.05); g.lineTo(cx + ww * 0.035, cy); g.lineTo(cx, cy + ww * 0.05); g.lineTo(cx - ww * 0.035, cy); g.fill(); }
      g.globalCompositeOperation = "source-over"; g.restore();
    }
    g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = S * 0.005; g.beginPath(); for (let i = 0; i <= 40; i++) { const x = i / 40 * w, y = top + Math.sin(i / 40 * Math.PI) * S * 0.03; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    // marigolds in the bottom corners
    for (const [x, y, r] of [[S * 0.02, h - S * 0.04, S * 0.09], [S * 0.13, h - S * 0.015, S * 0.06], [w - S * 0.03, h - S * 0.05, S * 0.085], [w - S * 0.14, h - S * 0.01, S * 0.055]]) { leaf(g, x, y, r * 1.6, -0.9); marigold(g, x, y, r); }
    textAt(h * 0.8, color, "#fff", true);
  }
}

// ---------- an image stuck to the screen ----------
// pos = vertical (a arriba, m en medio, b abajo) + horizontal (i izquierda, c centro, d derecha); s = width as a part of
// the screen width (it never gets taller than 45 % of the screen). At the top, whatever reaches the center goes under the logo.
export const SCREEN_POS = { ai: "Arriba izquierda", ac: "Arriba al centro", ad: "Arriba derecha", mi: "En medio izquierda", md: "En medio derecha", bi: "Abajo izquierda", bc: "Abajo al centro", bd: "Abajo derecha" };
export function drawScreen(g, W, H, it, img) {
  const preset = it.key && SCREEN_PRESETS[it.key];
  const ratio = preset ? ratioOf(it.key) : (it.h || img.naturalHeight) / (it.w || img.naturalWidth);
  let w = Math.max(0.05, Math.min(1, it.s || 0.3)) * W, h = w * ratio;
  if (h > H * 0.45) { h = H * 0.45; w = h / ratio; }
  const pos = SCREEN_POS[it.pos] ? it.pos : "bd", v = pos[0], u = pos[1];
  const m = preset && v !== "a" ? 0 : Math.min(W, H) * 0.03;   // the ready-made corners touch the edges
  const x = u === "i" ? m : u === "d" ? W - m - w : (W - w) / 2;
  const underLogo = x < W * 0.7 && x + w > W * 0.3;   // it would reach the logo at the top center: it goes under it
  const y = v === "a" ? (underLogo ? Math.max(m, H * 0.11) : m) : v === "b" ? H - m - h : (H - h) / 2;
  if (preset && preset.side && u !== "c" && u !== preset.side) { g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(img, 0, 0, w, h); g.restore(); }   // a corner on the other side: mirrored
  else g.drawImage(img, x, y, w, h);
}

// ---------- particles that come out of the mouth ----------
function particleTextures(THREE, effect) {
  const make = draw => { const c = Object.assign(document.createElement("canvas"), { width: 96, height: 96 }), g = c.getContext("2d"); draw(g); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  if (effect === "corazones") return [make(g => { g.beginPath(); heartPath(g, 48, 50, 34); g.fillStyle = "#fff"; g.fill(); g.beginPath(); g.ellipse(36, 36, 8, 4, -0.7, 0, TAU); g.fillStyle = "rgba(255,255,255,.55)"; g.globalCompositeOperation = "destination-out"; g.fill(); })];
  if (effect === "estrellas") return [make(g => { g.beginPath(); starPath(g, 48, 52, 40); g.fillStyle = "#fff"; g.fill(); }), make(g => sparkle(g, 48, 48, 40, "#fff"))];
  if (effect === "flores") return [make(g => marigold(g, 48, 48, 40)), make(g => marigold(g, 48, 48, 40, ["#ffb000", "#ffc94d", "#ffe08a"])), make(g => blossom(g, 48, 48, 42, "#e4007c"))];
  return [make(g => { g.fillStyle = "#fff"; g.beginPath(); g.arc(48, 48, 30, 0, TAU); g.fill(); }), make(g => { g.fillStyle = "#fff"; g.fillRect(28, 14, 40, 68); }), make(g => { g.beginPath(); starPath(g, 48, 52, 40); g.fillStyle = "#fff"; g.fill(); })];
}
const IMG_CACHE = new Map();   // pictures already loaded (the creator builds the filter again on every change)
const TINTS = { corazones: ["#ff2d55", "#ff7aa8", "#e4007c", "#ff4f8b"], estrellas: ["#ffd23f", "#fff4b0", "#ffb000", "#ffffff"], flores: ["#ffffff"], confeti: ["#ffcf4d", "#ff6b8b", "#7dffc0", "#6fc8ff", "#c99bff", "#ff8c00"] };

/**
 * Builds the filter. anchor(i) returns an Object3D that follows face point i (cm units inside);
 * faceMesh: a mesh with the canonical face geometry (uv), whose material becomes the paint; uvAt(i) gives point i's UV.
 * Each frame: update(dt, {face, mouth}) then, after rendering the scene, overlay(renderer) for the frame.
 */
export async function createFilter({ THREE, scene, camera, anchor, faceMesh, uvAt, cfg, mediaUrl = id => id, onHint = () => {}, source = null, mirror = false, sound = false }) {
  const F = cfg.filtro || {}, color = okColor(F.color), made = [], textures = [];
  const keep = t => { textures.push(t); return t; };
  const loadImg = url => { if (!url) return Promise.resolve(null); if (!IMG_CACHE.has(url)) IMG_CACHE.set(url, new Promise(ok => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => { IMG_CACHE.delete(url); ok(null); }; i.src = url; })); return IMG_CACHE.get(url); };
  // start loading every picture at once (they are awaited one by one below)
  for (const it of (cfg.items || [])) loadImg(it.type === "sticker" ? STICKERS[it.key] && STICKERS[it.key].src : it.type === "pantalla" && it.key ? (SCREEN_PRESETS[it.key] ? assetUrl(it.key) : null) : mediaUrl(it));
  for (const k of PARTICLES[F.effect] || []) loadImg(assetUrl(k));
  // paint (the creator's own one is the item of type "pintura")
  if (faceMesh) {
    const own = F.paint === "propia" ? (cfg.items || []).find(i => i.type === "pintura") : null;
    const ownImg = own ? await loadImg(mediaUrl(own)) : null;
    if (F.paint && F.paint !== "ninguna" && PAINTS[F.paint] && (F.paint !== "propia" || ownImg)) {
      const tex = keep(new THREE.CanvasTexture(paintCanvas(F.paint, uvAt, color, 1024, ownImg))); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      faceMesh.material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
      faceMesh.renderOrder = 2; faceMesh.userData.painted = true;
    } else { faceMesh.material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); faceMesh.userData.painted = false; }
  }
  // items
  let order = 5;
  const parts3 = new Map();   // item id → its meshes ({m, side, z}), to move them without building again (the creator)
  const placeMesh = (m, it, side, z) => { m.position.set((it.x || 0) * side, it.y || 0, z); m.scale.setScalar(it.s || 6); m.rotation.z = THREE.MathUtils.degToRad(-(it.r || 0) * side); };
  for (const it of (cfg.items || [])) {
    let src = null, ratio = 1, z = 0.8;
    const st = it.type === "sticker" && STICKERS[it.key];
    if (st && st.src) { src = await loadImg(st.src); if (!src) continue; ratio = st.ratio; z = st.z; }
    else if (st) { src = stickerCanvas(it.key, color); ratio = st.ratio; z = st.z; }
    else if (it.type === "image") { src = await loadImg(mediaUrl(it)); if (!src) continue; ratio = (it.h || src.naturalHeight) / (it.w || src.naturalWidth); }
    else continue;
    const tex = keep(new THREE.CanvasTexture(src.tagName === "IMG" ? (() => { const c = document.createElement("canvas"); const k = Math.min(1, 1024 / Math.max(src.naturalWidth, src.naturalHeight)); c.width = Math.round(src.naturalWidth * k); c.height = Math.round(src.naturalHeight * k); c.getContext("2d").drawImage(src, 0, 0, c.width, c.height); return c; })() : src));
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const geo = new THREE.PlaneGeometry(1, ratio), at = ANCHORS[it.anchor] ?? ANCHORS.frente;
    for (const [k, idx] of (Array.isArray(at) ? at : [at]).entries()) {
      const m = new THREE.Mesh(geo, mat), side = k ? -1 : 1;
      placeMesh(m, it, side, z); m.userData.item = it.id;
      m.renderOrder = order; anchor(idx).add(m); made.push(m);
      if (!parts3.has(it.id)) parts3.set(it.id, []); parts3.get(it.id).push({ m, side, z });
    }
    order++;
  }
  // mouth effect
  const fx = F.effect && F.effect !== "ninguno" && EFFECTS[F.effect] ? F.effect : null, parts = [];
  const mouthA = fx ? [anchor(MOUTH[0]), anchor(MOUTH[1])] : null;
  if (fx) {
    // the pictures of the effect (their own colors); the drawn ones if they do not load
    const imgs = (await Promise.all((PARTICLES[fx] || []).map(k => loadImg(assetUrl(k))))).filter(Boolean);
    let looks;
    if (imgs.length) looks = imgs.map(im => { const t = keep(new THREE.Texture(im)); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; const r = im.naturalHeight / im.naturalWidth; return { t, geo: new THREE.PlaneGeometry(r > 1 ? 1 / r : 1, r > 1 ? 1 : r), tint: ["#ffffff"] }; });
    else { const geo = new THREE.PlaneGeometry(1, 1), tint = TINTS[fx] || ["#ffffff"]; looks = particleTextures(THREE, fx in TINTS ? fx : "confeti").map(keep).map(t => ({ t, geo, tint })); }
    for (let i = 0; i < 90; i++) {
      const lk = looks[i % looks.length];
      const m = new THREE.Mesh(lk.geo, new THREE.MeshBasicMaterial({ map: lk.t, color: lk.tint[(i * 7) % lk.tint.length], transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
      m.visible = false; m.renderOrder = 30; scene.add(m); made.push(m);
      parts.push({ m, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), spin: 0, size: 1, ph: 0 });
    }
  }
  // frame
  const ov = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), canvas: document.createElement("canvas") };
  ov.ctx = ov.canvas.getContext("2d"); ov.tex = keep(new THREE.CanvasTexture(ov.canvas)); ov.tex.colorSpace = THREE.SRGBColorSpace;
  ov.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: ov.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  // images on the screen (type "pantalla"): each one stuck to an edge or corner, its width a part of the screen width
  const screens = [];
  for (const it of (cfg.items || [])) if (it.type === "pantalla") { const img = await loadImg(it.key ? (SCREEN_PRESETS[it.key] ? assetUrl(it.key) : null) : mediaUrl(it)); if (img) screens.push({ it, img }); }
  ov.scene.add(ov.quad); ov.on = !!(F.frame && F.frame !== "ninguno" && FRAMES[F.frame]) || screens.length > 0;
  let view = { fx: 1, fy: 1, w: 0, h: 0 };
  function setView(v) {
    view = v; ov.quad.scale.set(v.fx, v.fy, 1);
    if (!ov.on) return;
    const k = Math.min(Math.min(devicePixelRatio || 1, 2), 1280 / Math.max(v.w, v.h, 1));
    const w = Math.max(2, Math.round(v.w * k)), h = Math.max(2, Math.round(v.h * k));
    if (ov.canvas.width !== w || ov.canvas.height !== h) { ov.canvas.width = w; ov.canvas.height = h; ov.tex.dispose(); }
    drawFrame(ov.ctx, w, h, F.frame, color, String(F.text || "").trim());
    for (const { it, img } of screens) drawScreen(ov.ctx, w, h, it, img);
    ov.tex.needsUpdate = true;
  }
  if (ov.on && document.fonts) document.fonts.load('700 40px "Sora"').then(() => setView(view)).catch(() => {});

  // per frame
  const tmp = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), fwd = new THREE.Vector3(), upv = new THREE.Vector3(), rgt = new THREE.Vector3();
  let open = false, emit = 0, cursor = 0, hintT = 0, hinted = false, everOpened = false, faceT = 0, clockT = 0;
  function spawn(n, scale) {
    const A0 = mouthA[0], A1 = mouthA[1];
    A0.getWorldPosition(a); A1.getWorldPosition(b); a.add(b).multiplyScalar(0.5);
    A0.matrixWorld.extractBasis(rgt, upv, fwd); rgt.normalize(); upv.normalize(); fwd.normalize();
    for (let i = 0; i < n; i++) {
      const q = parts[cursor++ % parts.length];
      q.life = 1.5 + Math.random() * 0.9; q.p.copy(a).addScaledVector(fwd, scale * 1.2);
      const ang = Math.random() * TAU, spread = scale * (14 + Math.random() * 14);   // a fountain toward the camera, opening in every direction
      q.v.copy(fwd).multiplyScalar(scale * (2 + Math.random() * 4)).addScaledVector(rgt, Math.cos(ang) * spread).addScaledVector(upv, Math.sin(ang) * spread * 0.8 + scale * 6);
      q.spin = (Math.random() - 0.5) * 5; q.size = scale * (1.3 + Math.random() * 1.2); q.ph = Math.random() * 6; q.m.visible = true;
    }
  }
  function update(dt, { face = true, mouth = 0 } = {}) {
    clockT += dt;
    if (fx) {
      faceT = face ? faceT + dt : 0;
      const isOpen = face && mouth > (open ? 0.35 : 0.5);   // a little hysteresis
      if (face) {
        mouthA[0].updateWorldMatrix(true, false);
        const scale = new THREE.Vector3().setFromMatrixScale(mouthA[0].matrixWorld).x || 1;
        if (isOpen && !open) { spawn(12, scale); everOpened = true; if (sound) sfx.sparkle(6); }   // the preview opens the mouth by itself: silent there
        if (isOpen) { emit += dt * 14; const n = Math.floor(emit); if (n) { emit -= n; spawn(n, scale); } }
      }
      open = isOpen;
      // tell people the trick once they are on camera
      if (!everOpened && faceT > 1.2 && !hinted) { hinted = true; hintT = 4; onHint("Abre la boca"); }
      if (hintT > 0) { hintT -= dt; if (hintT <= 0 || everOpened) { hintT = 0; onHint(""); } }
      const camQ = camera.quaternion;
      for (const q of parts) {
        if (q.life <= 0) continue;
        q.life -= dt; q.ph += dt * 4;
        q.v.multiplyScalar(1 - dt * 1.6); q.v.y -= (q.size * 2.2) * dt;
        q.p.addScaledVector(q.v, dt);
        q.m.position.copy(q.p).add(tmp.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(Math.sin(q.ph) * q.size * 0.08));
        q.m.quaternion.copy(camQ); q.m.rotateZ(q.spin * clockT);
        q.m.scale.setScalar(q.size * Math.min(1, (2.4 - q.life) * 6 + 0.2)); q.m.material.opacity = Math.min(1, q.life * 1.6);
        q.m.visible = q.life > 0;
      }
    }
  }
  function overlay(renderer) {
    if (!ov.on) return;
    const auto = renderer.autoClear; renderer.autoClear = false; renderer.render(ov.scene, ov.cam); renderer.autoClear = auto;
  }
  // color look and vignette over the WHOLE picture (camera + paint + accessories; the frame and screen images stay on
  // top, untouched): the camera image (source: the camera video, or a canvas in the preview) is drawn into a render
  // target with the scene, then a full-screen shader grades it. Only built when the filter has a look or a vignette.
  const look = LOOK_IDS.indexOf(F.look) > 0 ? LOOK_IDS.indexOf(F.look) : 0, vig = Math.max(0, Math.min(1, Number(F.vig) || 0));
  let post = null;
  if ((look || vig > 0) && source) {
    const bgTex = keep(source.tagName === "VIDEO" ? new THREE.VideoTexture(source) : new THREE.CanvasTexture(source)); bgTex.colorSpace = THREE.SRGBColorSpace;
    if (mirror) { bgTex.wrapS = THREE.RepeatWrapping; bgTex.repeat.x = -1; }
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: bgTex, depthTest: false, depthWrite: false, toneMapped: false }));
    const bgScene = new THREE.Scene(); bgScene.add(bg);
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
    const mat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: rt.texture }, look: { value: look }, vig: { value: vig }, time: { value: 0 }, vis: { value: new THREE.Vector2(1, 1) }, aspect: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }", fragmentShader: LOOK_SHADER, depthTest: false, depthWrite: false });
    const postScene = new THREE.Scene(); postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    post = { bgTex, bgScene, rt, mat, postScene, size: new THREE.Vector2() };
    made.push(bg, postScene.children[0]);
  }
  let clockP = 0;
  // draws a whole frame: the scene (graded when there is a look or a vignette) and then the frame/screen images
  function draw(renderer, dt = 0) {
    if (!post) { renderer.render(scene, camera); overlay(renderer); return; }
    clockP += dt;
    renderer.getDrawingBufferSize(post.size);
    if (post.rt.width !== post.size.x || post.rt.height !== post.size.y) post.rt.setSize(post.size.x, post.size.y);
    if (source.tagName === "VIDEO") post.bgTex.needsUpdate = true;   // iPhone: keep the camera texture fresh
    const auto = renderer.autoClear;
    renderer.setRenderTarget(post.rt); renderer.autoClear = true; renderer.render(post.bgScene, ov.cam);
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const u = post.mat.uniforms; u.time.value = clockP % 100; u.vis.value.set(view.fx || 1, view.fy || 1); u.aspect.value = (view.w || 1) / (view.h || 1);
    renderer.autoClear = true; renderer.render(post.postScene, ov.cam); renderer.autoClear = auto;
    overlay(renderer);
  }
  function dispose() {
    if (post) { post.rt.dispose(); post.mat.dispose(); }
    for (const m of made) { m.parent && m.parent.remove(m); if (m.material && m.material.dispose) m.material.dispose(); }
    for (const t of textures) t.dispose();
    if (faceMesh && faceMesh.material && faceMesh.material.dispose) faceMesh.material.dispose();
    onHint("");
  }
  // the creator: move an item right away (sliders, dragging) and find the item under the pointer
  function place(it) { for (const p of parts3.get(it.id) || []) placeMesh(p.m, it, p.side, p.z); }
  function pick(raycaster) {
    const hit = raycaster.intersectObjects([...parts3.values()].flat().map(p => p.m), false)[0];
    if (!hit) return null;
    const p = [...parts3.values()].flat().find(p => p.m === hit.object);
    return { id: hit.object.userData.item, mesh: hit.object, side: p.side, point: hit.point };
  }
  return { update, overlay, draw, setView, dispose, place, pick, hasEffect: !!fx };
}

// ---------- /x/: the camera ----------
export async function run({ THREE, MindARThree, container, cfg, setupCapture, started, hint, mediaUrl }) {
  // MindAR's own face smoothing (the strong one of the trivia makes a mask lag behind the face)
  const mind = new MindARThree({ container, uiLoading: "no", uiScanning: "no", uiError: "no" });
  const { renderer, scene, camera } = mind;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const anchors = new Map(), faceMesh = mind.addFaceMesh(); scene.add(faceMesh);
  // MindAR's landmark matrix is scaled by faceScale (the face width, ~15): an inner group scaled 1/faceScale brings it
  // back to the canonical cm the filter uses (as the face mesh and the preview do)
  const anchor = i => { if (!anchors.has(i)) { const a = mind.addAnchor(i), inner = new THREE.Group(); inner.scale.setScalar(1 / 15); a.group.add(inner); anchors.set(i, inner); } return anchors.get(i); };
  for (const i of [10, 151, 168, 4, 0, 152, 205, 425, 13, 14]) anchor(i);   // before start: MindAR keeps them all updated
  const uv = faceMesh.geometry.getAttribute("uv"), uvAt = i => [uv.getX(i), uv.getY(i)];
  const capture = setupCapture(mind);
  await mind.start();
  // after start: the camera video exists (a color look or vignette draws it in WebGL; the front camera is mirrored)
  const filter = await createFilter({ THREE, scene, camera, anchor, faceMesh, uvAt, cfg, mediaUrl, onHint: hint, source: mind.video, mirror: true, sound: true });
  started();
  const measure = () => { const c = renderer.domElement.getBoundingClientRect(), b = container.getBoundingClientRect(); filter.setView({ fx: Math.min(1, b.width / c.width), fy: Math.min(1, b.height / c.height), w: b.width, h: b.height }); };
  measure(); addEventListener("resize", () => setTimeout(measure, 300));
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta()), est = mind.getLatestEstimate();
    let mouth = 0;
    if (est) {
      const jaw = est.blendshapes && est.blendshapes.categories && est.blendshapes.categories.find(c => c.categoryName === "jawOpen");
      if (jaw) mouth = jaw.score / 0.45;
      else if (est.metricLandmarks) { const L = est.metricLandmarks; mouth = (dist(L[13], L[14]) / dist(L[10], L[152]) - 0.02) / 0.09; }
    }
    if (est && est.faceScale > 1) for (const inner of anchors.values()) inner.scale.setScalar(1 / est.faceScale);
    filter.update(dt, { face: !!est, mouth });
    filter.draw(renderer, dt); capture.afterRender();
  });
}
