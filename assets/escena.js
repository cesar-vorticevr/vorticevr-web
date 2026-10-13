// Elements of a platform AR experience (video, image, text, 3D object): building and placing them, shared by
// /crear/ (editor) and /x/ (viewer) so everything sits in the same spot in both. Needs the import map entries
// "three" and "three/addons/".
//
// Units are the image's: the image is 1 wide and centered at 0,0 (x right, y up, z toward the camera).
// Every element (see cleanItems in worker.js) has:
//   x, y  spot on the image · z  lift off the image · s  width (3D: its largest side) · r  turn in degrees
//   o     "frente": parallel to the image (a video or a picture lying on it; a 3D object facing the viewer, for walls)
//         "pie":    standing up out of the image (perpendicular; for images lying on a table)
//   in    entrance animation · scene  which scene it belongs to (0…4) · link  opened when tapped
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
  const root = new THREE.Group(), turn = new THREE.Group(), inner = new THREE.Group();
  root.add(turn); turn.add(inner);
  const n = { it, root, turn, inner, size: new THREE.Vector3(1, 1, 0), mats: [], update: () => {}, plane: it.type !== "model", clips: [] };
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
    n.clips = (gltf.animations || []).map((a, i) => a.name || `Animación ${i + 1}`);
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

// Which axis "r" turns: a 3D object and a standing picture spin around their vertical; a picture lying on the image
// turns within the image.
export const turnAxis = (n, it) => (n.plane && it.o !== "pie") ? "z" : "y";

// Puts a node where its element says. k: entrance progress (1 = done) · layer: order, so flat pictures do not flicker
export function place(n, it, k = 1, layer = 0) {
  const pie = it.o === "pie", e = entrance(it.in, k), s = it.s * e.scale;
  const front = n.plane ? (pie ? 0 : 0.003 + layer * 0.002) : (pie ? 0 : Math.max(n.size.x, n.size.z) / 2 * it.s);
  n.front = front;
  n.inner.position.y = n.plane && pie ? n.size.y / 2 : 0;
  n.root.rotation.set(pie ? Math.PI / 2 : 0, 0, 0);
  const ang = THREE.MathUtils.degToRad(it.r || 0) + e.spin;
  n.turn.rotation.set(0, 0, 0); n.turn.rotation[turnAxis(n, it)] = ang;
  n.root.scale.setScalar(Math.max(1e-4, s));
  n.root.position.set(it.x, it.y, (it.z || 0) + front + e.lift * it.s);
  n.root.visible = s > 1e-3;
  setOpacity(n, e.alpha);
}
