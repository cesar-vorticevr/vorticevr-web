// Elements of a platform AR experience (video, image, text, 3D object): building and placing them, shared by
// /crear/ (editor) and /x/ (viewer) so everything sits in the same spot in both. Needs the import map entries
// "three" and "three/addons/".
//
// Units are the image's: the image is 1 wide and centered at 0,0 (x right, y up, z toward the camera).
// Every element (see cleanItems in worker.js) has:
//   x, y  its center on the image · z  lift off the image · s  width (3D: its largest side)
//   rx, ry, rz  rotation in degrees around the image axes (Euler XYZ). Pictures turn around their center; 3D objects
//         around the middle of their base, and they stand on the image with rx = 90.
//   in    entrance animation · scene  which scene it belongs to (0…4) · link  opened when tapped
//   mv    optional motion in a loop {k: girar | palpitar | vaiven | balancear, ax: x | y | z, a: 1…100 how much, v: 1…100 speed},
//         around the element's own axes and its middle (animate(); bakeMotion() turns it into a GLB clip)
// The experience can also have sparkles {c: color, n: 1…100 how many}: little stars that twinkle around it (Sparkles;
// bakeSparkles() for the GLB of "superficie", where they rest at scale 0 so Quick Look, without animations, hides them).
// Elements saved before rx/ry/rz have o ("frente" | "pie") and r instead: place() still reads them, and modernize()
// turns them into rx/ry/rz with the same look.
import * as THREE from "three";

export const FONTS = ["Sora", "Bebas Neue", "Pacifico", "Playfair Display", "Permanent Marker", "IBM Plex Sans"];
export const FONT_CSS = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Sans:wght@600&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:wght@700&family=Sora:wght@700&display=swap";
const WEIGHT = { "Sora": 700, "Playfair Display": 700, "IBM Plex Sans": 600 };
export const ENTRADAS = [["aparecer", "Aparecer"], ["crecer", "Crecer"], ["rebote", "Rebotar"], ["girar", "Girar"], ["subir", "Salir de la imagen"], ["ninguna", "Sin animación"]];
export const STAGGER = 0.12, DURATION = 0.7;   // seconds between elements and of each entrance

let gltfP = null;
function gltfLoader() {
  return gltfP ||= Promise.all([
    import("three/addons/loaders/GLTFLoader.js"), import("three/addons/loaders/DRACOLoader.js"), import("three/addons/libs/meshopt_decoder.module.js"),
  ]).then(([{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }]) => {
    const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/");
    return new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  });
}

// Lights for the 3D objects' PBR materials: a soft room environment plus a little direct light.
export async function light(renderer, scene) {
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pm.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 0.6));
  const d = new THREE.DirectionalLight(0xffffff, 1.2); d.position.set(0.5, 1, 1.5); scene.add(d);
}

// Text drawn on a canvas (any phone shows it the same): color, optional outline, one or more lines.
export async function textCanvas(it) {
  const font = FONTS.includes(it.font) ? it.font : "Sora", w = WEIGHT[font] || 400;
  const lines = String(it.text || " ").split("\n");
  try { await document.fonts.load(`${w} 120px "${font}"`, lines.join(" ")); } catch (e) {}
  const c = document.createElement("canvas"), g = c.getContext("2d");
  let px = 120;
  const measure = () => { g.font = `${w} ${px}px "${font}", sans-serif`; return Math.max(px * 0.5, ...lines.map(l => g.measureText(l).width)); };
  let lw = measure();
  if (lw > 1900) { px = Math.floor(px * 1900 / lw); lw = measure(); }
  const lh = px * 1.25, pad = it.stroke ? px * 0.2 : px * 0.08;
  c.width = Math.ceil(lw + pad * 2); c.height = Math.ceil(lh * lines.length + pad * 2);
  g.font = `${w} ${px}px "${font}", sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  lines.forEach((l, i) => {
    const y = pad + lh * (i + 0.5);
    if (it.stroke) { g.lineWidth = px * 0.16; g.strokeStyle = it.stroke; g.strokeText(l, c.width / 2, y); }
    g.fillStyle = it.color || "#ffffff"; g.fillText(l, c.width / 2, y);
  });
  return c;
}

// Video without its green (or any color) background: pixels close to the key color become transparent.
// The texture is read as-is (sRGB values) and written as-is, so the colors match the video.
function chromaMaterial(map, ch) {
  const hex = parseInt(String(ch.color || "#00ff00").slice(1), 16);
  return new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { map: { value: map }, key: { value: new THREE.Vector3((hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255) }, sim: { value: ch.tol ?? 0.3 }, opacity: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform sampler2D map; uniform vec3 key; uniform float sim; uniform float opacity; varying vec2 vUv;
      vec2 cbcr(vec3 c){ return vec2(-0.1687*c.r - 0.3313*c.g + 0.5*c.b, 0.5*c.r - 0.4187*c.g - 0.0813*c.b); }
      void main(){
        vec4 t = texture2D(map, vUv);
        float d = distance(cbcr(t.rgb), cbcr(key));
        float a = smoothstep(sim * 0.5, sim * 0.5 + 0.08, d);
        vec3 c = t.rgb;
        float spill = clamp(1.0 - d / (sim * 0.5 + 0.2), 0.0, 1.0);   // takes the green tint off the edges
        c = mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), spill * 0.6);
        gl_FragColor = vec4(c, a * opacity);
      }`,
  });
}

// Builds one element → node { it, root, turn, inner, size, mats, update(dt), dispose(), clips }
//   o.url: its file (image, 3D) · o.video: its <video> element (video)
// root gets the position and orientation, turn the turn r, inner the element at 1 wide (3D: largest side 1).
export async function build(it, o = {}) {
  const root = new THREE.Group(), turn = new THREE.Group(), motion = new THREE.Group(), pivot = new THREE.Group(), inner = new THREE.Group();
  root.add(turn); turn.add(motion); motion.add(pivot); pivot.add(inner);
  const n = { it, root, turn, motion, pivot, inner, size: new THREE.Vector3(1, 1, 0), mats: [], update: () => {}, plane: it.type !== "model", clips: [] };
  if (it.type === "audio") {   // nothing to draw: the page plays it (n.audio)
    n.audio = true; n.plane = false; n.size.set(0, 0, 0);
    n.dispose = () => { if (root.parent) root.parent.remove(root); };
    return n;
  }
  if (it.type === "model") {
    const loader = await gltfLoader();
    const gltf = o.buffer ? await loader.parseAsync(o.buffer, "") : await loader.loadAsync(o.url);
    const model = gltf.scene || gltf.scenes[0];
    model.traverse(x => {
      if (!x.isMesh) return;
      x.frustumCulled = false;
      (Array.isArray(x.material) ? x.material : [x.material]).forEach(m => { if (!m) return; if (m.map) m.map.anisotropy = 4; m.userData.t = m.transparent; m.userData.o = m.opacity; n.mats.push(m); });
    });
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = 1 / Math.max(size.x, size.y, size.z, 1e-6);
    model.position.set(-c.x, -box.min.y, -c.z); inner.add(model); inner.scale.setScalar(k);
    n.size.copy(size).multiplyScalar(k);
    motion.position.y = n.size.y / 2; pivot.position.y = -n.size.y / 2;   // a 3D object moves around its middle, not its base
    n.clips = (gltf.animations || []).map((a, i) => a.name || `Animación ${i + 1}`);
    n.anims = gltf.animations || [];
    if (gltf.animations && gltf.animations.length) {
      n.mixer = new THREE.AnimationMixer(model);
      n.setAnim = i => { n.mixer.stopAllAction(); if (i >= 0 && gltf.animations[i]) n.mixer.clipAction(gltf.animations[i]).play(); };
      n.setAnim(it.anim ?? 0);
      n.update = dt => n.mixer.update(dt);
    }
  } else {
    let tex, aspect;
    if (it.type === "video") {
      tex = new THREE.VideoTexture(o.video); aspect = it.ar || it.w / it.h;
      // a hidden <video> is not painted, so its frame callback stops (iPhone): push frames ourselves
      n.update = () => { if (o.video.readyState >= 2) tex.needsUpdate = true; };
    } else if (it.type === "image") {
      tex = await new THREE.TextureLoader().loadAsync(o.url); aspect = tex.image.width / tex.image.height;
    } else {
      const cv = await textCanvas(it); tex = new THREE.CanvasTexture(cv); aspect = cv.width / cv.height;
    }
    tex.anisotropy = 4;
    let mat;
    if (it.type === "video" && it.chroma) { tex.colorSpace = THREE.NoColorSpace; mat = chromaMaterial(tex, it.chroma); }
    else { tex.colorSpace = THREE.SRGBColorSpace; mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }); }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1 / aspect), mat);
    inner.add(mesh); n.mesh = mesh; n.mats.push(mat); n.size.set(1, 1 / aspect, 0);
  }
  n.dispose = () => {
    root.traverse(x => { if (x.geometry) x.geometry.dispose(); });
    n.mats.forEach(m => { if (m.map && it.type !== "model") m.map.dispose(); if (m.uniforms && m.uniforms.map) m.uniforms.map.value.dispose(); m.dispose(); });
    if (root.parent) root.parent.remove(root);
  };
  return n;
}

// Entrance: k goes 0 → 1 over the animation (1 = in place).
function entrance(kind, k) {
  if (k >= 1 || kind === "ninguna") return { scale: 1, alpha: 1, spin: 0, lift: 0 };
  k = Math.max(0, k);
  const o = 1 - Math.pow(1 - k, 3);
  switch (kind) {
    case "crecer": return { scale: o, alpha: 1, spin: 0, lift: 0 };
    case "rebote": { const c1 = 1.70158, c3 = c1 + 1; return { scale: Math.max(0, 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2)), alpha: Math.min(1, k * 4), spin: 0, lift: 0 }; }
    case "girar": return { scale: 0.3 + 0.7 * o, alpha: o, spin: (1 - o) * Math.PI * 2, lift: 0 };
    case "subir": return { scale: 1, alpha: o, spin: 0, lift: -(1 - o) * 0.6 };
    default: return { scale: 0.6 + 0.4 * o, alpha: o, spin: 0, lift: 0 };   // "aparecer"
  }
}

function setOpacity(n, a) {
  if (n.alpha === a) return; n.alpha = a;
  for (const m of n.mats) {
    if (m.uniforms) { m.uniforms.opacity.value = a; continue; }
    if (n.plane) { m.opacity = a; continue; }
    const t = a < 1 || m.userData.t; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; }
    m.opacity = (m.userData.o ?? 1) * a;
  }
}

const RAD = Math.PI / 180;
const round = v => Math.round(v * 1000) / 1000;
// An element saved with o/r → rx/ry/rz (+ the lift the old placement added on its own)
export function modernize(n, it) {
  if (it.rx != null) return false;
  const pie = it.o === "pie", r = it.r || 0;
  if (n.plane) { if (pie) { it.rx = 90; it.ry = r; it.rz = 0; it.z = round((it.z || 0) + n.size.y * it.s / 2); } else { it.rx = 0; it.ry = 0; it.rz = r; } }
  else if (pie) { it.rx = 90; it.ry = r; it.rz = 0; }
  else { it.rx = 0; it.ry = r; it.rz = 0; it.z = round((it.z || 0) + Math.max(n.size.x, n.size.z) / 2 * it.s); }
  delete it.o; delete it.r;
  return true;
}
// standing up or lying on the image (the button "Parar / Acostar")
export function stand(n, it) {
  const up = Math.abs(((it.rx || 0) % 360 + 360) % 360 - 90) > 45;
  it.rx = up ? 90 : 0; it.ry = 0; it.rz = 0;
  it.z = n.plane && up ? round(n.size.y * it.s / 2) : 0;
}

// ---------- motion in a loop ----------
export const MOVES = [["", "Sin movimiento"], ["girar", "Girar"], ["palpitar", "Palpitar"], ["vaiven", "Vaivén"], ["balancear", "Balancear"]];
const lerp = (a, b, k) => a + (b - a) * k;
// the numbers of a motion: period in seconds and how much (girar: always a whole turn)
export function motionOf(mv) {
  if (!mv || !MOVES.some(m => m[0] && m[0] === mv.k)) return null;
  const a = Math.min(100, Math.max(1, mv.a ?? 50)) / 100, v = Math.min(100, Math.max(1, mv.v ?? 50)) / 100, ax = ["x", "y", "z"].includes(mv.ax) ? mv.ax : "y";
  const period = mv.k === "girar" ? lerp(12, 1.2, v) : lerp(3.2, 0.45, v);
  const amount = mv.k === "palpitar" ? lerp(0.03, 0.4, a) : mv.k === "vaiven" ? lerp(0.03, 0.6, a) : mv.k === "balancear" ? lerp(5, 50, a) * RAD : 1;
  return { k: mv.k, ax, period, amount };
}
// its pose at time t (seconds) → {rot: [x, y, z], pos: [x, y, z], s}
function poseAt(M, t) {
  const ph = (t / M.period) % 1, w = Math.sin(ph * Math.PI * 2), i = { x: 0, y: 1, z: 2 }[M.ax];
  const rot = [0, 0, 0], pos = [0, 0, 0]; let s = 1;
  if (M.k === "girar") rot[i] = ph * Math.PI * 2;
  else if (M.k === "balancear") rot[i] = w * M.amount;
  else if (M.k === "vaiven") pos[i] = w * M.amount;
  else if (M.k === "palpitar") s = 1 + M.amount * Math.pow((w + 1) / 2, 1.6);   // a beat: quick to grow, soft to come back
  return { rot, pos, s };
}
// moves an element at time t (call it after place())
export function animate(n, it, t) {
  if (!n.motion) return;
  const M = motionOf(it.mv), base = n.plane ? 0 : n.size.y / 2;
  if (!M) { n.motion.rotation.set(0, 0, 0); n.motion.scale.setScalar(1); n.motion.position.set(0, base, 0); return; }
  const p = poseAt(M, t);
  n.motion.rotation.set(p.rot[0], p.rot[1], p.rot[2]); n.motion.scale.setScalar(p.s); n.motion.position.set(p.pos[0], base + p.pos[1], p.pos[2]);
}
// the same motion as GLB keyframes for a clip of D seconds (its period is rounded so it loops seamlessly in D)
export function bakeMotion(n, it, D, name) {
  const M0 = motionOf(it.mv); if (!M0) return [];
  const M = { ...M0, period: D / Math.max(1, Math.round(D / M0.period)) }, steps = Math.max(24, Math.round(D / M.period) * 24);
  n.motion.name = name; const base = n.plane ? 0 : n.size.y / 2;
  const times = [], q = [], pos = [], sc = [], e = new THREE.Euler(), qq = new THREE.Quaternion();
  for (let k = 0; k <= steps; k++) {
    const t = D * k / steps, p = poseAt(M, k === steps ? D : t); times.push(t);
    qq.setFromEuler(e.set(p.rot[0], p.rot[1], p.rot[2])); q.push(qq.x, qq.y, qq.z, qq.w);
    pos.push(p.pos[0], base + p.pos[1], p.pos[2]); sc.push(p.s, p.s, p.s);
  }
  return [new THREE.QuaternionKeyframeTrack(name + ".quaternion", times, q), new THREE.VectorKeyframeTrack(name + ".position", times, pos), new THREE.VectorKeyframeTrack(name + ".scale", times, sc)];
}

// ---------- sparkles ----------
let starTex = null;
// a soft four-pointed star (white: the material gives its color)
export function starTexture() {
  if (starTex) return starTex;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.18, "rgba(255,255,255,.75)"); r.addColorStop(.45, "rgba(255,255,255,.12)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#fff"; for (const a of [0, Math.PI / 2]) { g.save(); g.translate(64, 64); g.rotate(a); g.beginPath(); g.moveTo(-62, 0); g.quadraticCurveTo(0, -5, 62, 0); g.quadraticCurveTo(0, 5, -62, 0); g.fill(); g.restore(); }
  starTex = new THREE.CanvasTexture(c); starTex.colorSpace = THREE.SRGBColorSpace; return starTex;
}
export const sparkCount = n => Math.round(lerp(4, 70, Math.min(100, Math.max(1, n ?? 40)) / 100));
// live sparkles (editor and viewers): each one appears somewhere in box, twinkles and fades, then shows up somewhere else
export class Sparkles {
  constructor() { this.group = new THREE.Group(); this.group.name = "destellos"; this.list = []; this.box = new THREE.Box3(new THREE.Vector3(-.5, -.5, 0), new THREE.Vector3(.5, .5, .3)); this.size = 0.045; }
  set(cfg, box, size) {
    if (box) this.box.copy(box); if (size) this.size = size;
    const n = cfg ? sparkCount(cfg.n) : 0, color = new THREE.Color(cfg && cfg.c || "#ffd27f");
    while (this.list.length > n) { const s = this.list.pop(); this.group.remove(s.m); s.m.material.dispose(); }
    while (this.list.length < n) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      const s = { m, t: -Math.random() * 2.5, life: 1 }; this.respawn(s); this.group.add(m); this.list.push(s);
    }
    for (const s of this.list) s.m.material.color.copy(color);
    this.group.visible = n > 0;
  }
  respawn(s) {
    const b = this.box; s.m.position.set(lerp(b.min.x, b.max.x, Math.random()), lerp(b.min.y, b.max.y, Math.random()), lerp(b.min.z, b.max.z, Math.random()));
    s.life = 0.9 + Math.random() * 1.4; s.big = this.size * (0.5 + Math.random() * 0.9); s.spin = (Math.random() - .5) * 2;
  }
  update(dt) {
    for (const s of this.list) {
      s.t += dt; if (s.t < 0) { s.m.visible = false; continue; }
      if (s.t >= s.life) { s.t = -Math.random() * 1.2; this.respawn(s); s.m.visible = false; continue; }
      const k = s.t / s.life, a = Math.sin(k * Math.PI);   // in and out
      s.m.visible = true; s.m.scale.setScalar(s.big * (0.3 + 0.7 * a)); s.m.material.opacity = a; s.m.material.rotation += s.spin * dt;
    }
  }
  dispose() { for (const s of this.list) s.m.material.dispose(); this.list = []; if (this.group.parent) this.group.parent.remove(this.group); }
}
// sparkles for the GLB: crossed glowing cards that twinkle with scale keyframes over D seconds (scale 0 at rest)
export function bakeSparkles(cfg, box, size, D) {
  const group = new THREE.Group(); group.name = "destellos"; const tracks = [];
  if (!cfg) return { group, tracks };
  const n = sparkCount(cfg.n), tex = starTexture(), col = new THREE.Color(cfg.c || "#ffd27f");
  const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: col, emissiveMap: tex, map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
  const geo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group(); g.name = "destello" + i;
    const a = new THREE.Mesh(geo, mat), b = new THREE.Mesh(geo, mat); b.rotation.y = Math.PI / 2; g.add(a, b);
    g.position.set(lerp(box.min.x, box.max.x, Math.random()), lerp(box.min.y, box.max.y, Math.random()), lerp(box.min.z, box.max.z, Math.random()));
    g.scale.setScalar(1e-4); group.add(g);
    // two or three twinkles at random moments in the loop
    const big = size * (0.6 + Math.random() * 0.8), times = [0], vals = [1e-4, 1e-4, 1e-4], per = 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < per; k++) {
      const t0 = (k + Math.random() * 0.6) * D / per, life = 0.8 + Math.random() * 0.9;
      for (const [dt, s] of [[0, 1e-4], [life / 2, big], [life, 1e-4]]) { const t = Math.min(D - 0.01, t0 + dt); if (t > times[times.length - 1]) { times.push(t); vals.push(s, s, s); } }
    }
    times.push(D); vals.push(1e-4, 1e-4, 1e-4);
    tracks.push(new THREE.VectorKeyframeTrack(g.name + ".scale", times, vals));
  }
  return { group, tracks };
}

// Puts a node where its element says. k: entrance progress (1 = done) · layer: order, so flat pictures do not flicker
export function place(n, it, k = 1, layer = 0) {
  if (it.rx != null) {
    const e = entrance(it.in, k), s = it.s * e.scale;
    n.front = n.plane ? 0.003 + layer * 0.002 : 0;
    n.inner.position.y = 0;
    n.root.rotation.set((it.rx || 0) * RAD, (it.ry || 0) * RAD, (it.rz || 0) * RAD, "XYZ");
    n.turn.rotation.set(0, e.spin, 0);
    n.root.scale.setScalar(Math.max(1e-4, s));
    n.root.position.set(it.x, it.y, (it.z || 0) + n.front + e.lift * it.s);
    n.root.visible = s > 1e-3;
    setOpacity(n, e.alpha);
    return;
  }
  const pie = it.o === "pie", e = entrance(it.in, k), s = it.s * e.scale;
  const front = n.plane ? (pie ? 0 : 0.003 + layer * 0.002) : (pie ? 0 : Math.max(n.size.x, n.size.z) / 2 * it.s);
  n.front = front;
  n.inner.position.y = n.plane && pie ? n.size.y / 2 : 0;
  n.root.rotation.set(pie ? Math.PI / 2 : 0, 0, 0);
  const ang = THREE.MathUtils.degToRad(it.r || 0) + e.spin;
  n.turn.rotation.set(0, 0, 0); n.turn.rotation[n.plane && !pie ? "z" : "y"] = ang;
  n.root.scale.setScalar(Math.max(1e-4, s));
  n.root.position.set(it.x, it.y, (it.z || 0) + front + e.lift * it.s);
  n.root.visible = s > 1e-3;
  setOpacity(n, e.alpha);
}
