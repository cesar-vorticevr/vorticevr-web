// Clean picture of a "superficie" experience for its poster (assets/poster.js): its 3D objects, images and texts built
// with assets/escena.js (same placement as the editor), rendered on a transparent background from a 3/4 view and
// cropped to what is drawn. No floor grid: the poster puts it on its own stage. Needs the import map "three" and "three/addons/".
import * as THREE from "three";
import * as ESC from "./escena.js";

// → canvas (cropped, transparent) or null
export async function render(exp, api, size = 1800) {
  const items = (exp.items || []).filter(i => i.type === "model" || i.type === "image" || i.type === "text");
  if (!items.length) return null;
  if (items.some(i => i.type === "text") && document.fonts) await Promise.all(ESC.FONTS.map(f => document.fonts.load(`700 80px "${f}"`).catch(() => {})));
  const v = exp.updated || exp.created || "";
  const scene = new THREE.Scene(), world = new THREE.Group(); world.rotation.x = -Math.PI / 2; scene.add(world);   // the editor's floor, lying down
  const nodes = await Promise.all(items.map(it => ESC.build(it, { url: `${api}/m/${exp.slug}/${it.file}?v=${v}` }).catch(() => null)));
  nodes.forEach((n, i) => { if (!n) return; ESC.place(n, items[i], 1, i); if (n.mixer) n.update(0); world.add(n.root); });
  if (!world.children.length) return null;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  try {
    r.setClearColor(0x000000, 0); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    await ESC.light(r, scene);
    const rim = new THREE.DirectionalLight(0xd2b8ff, 1.4); rim.position.set(-1.5, 1.2, -1.5); scene.add(rim);   // a purple edge light from behind
    world.updateMatrixWorld(true);
    const sph = new THREE.Box3().setFromObject(world).getBoundingSphere(new THREE.Sphere());
    const cam = new THREE.PerspectiveCamera(28, 1, sph.radius / 50, sph.radius * 50);
    cam.position.copy(sph.center).addScaledVector(new THREE.Vector3(0.45, 0.4, 1).normalize(), sph.radius / Math.sin(THREE.MathUtils.degToRad(14)) * 1.04);
    cam.lookAt(sph.center);
    r.render(scene, cam);
    return crop(canvas);
  } finally { nodes.forEach(n => n && n.dispose && n.dispose()); r.dispose(); r.forceContextLoss(); }
}

function crop(src) {
  const W = src.width, H = src.height, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let i = y * W * 4 + 3, xx = 0; xx < W; xx++, i += 4) if (d[i] > 10) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; y1 = y; }
  if (x1 < 0) return null;
  const out = document.createElement("canvas"); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext("2d").drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
