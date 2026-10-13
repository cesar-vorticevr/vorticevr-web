// 3D object (GLB) of a platform experience: loading and placement, shared by /crear/ (editor) and /x/ (viewer)
// so the object sits in the same spot in both. Needs the import map entries "three" and "three/addons/".
//
// Units are the image's: the image is 1 wide and centered at 0,0 (x right, y up, z toward the camera).
// cfg = { o, x, y, z, s, r } (see cleanMeta in worker.js):
//   o "pie"    → stands up out of the image (image lying on a table): the model's up is the image's z
//   o "frente" → upright facing the viewer (image on a wall): the model's up is the image's y
//   x, y = spot on the image · z = lift off the image · s = size of its largest side · r = turn (degrees) around its up
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export const DEFAULT = { o: "pie", x: 0, y: 0, z: 0, s: 0.6, r: 0 };

let loader = null;
function gltfLoader() {
  if (loader) return loader;
  const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/");
  loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

// Loads a GLB (URL or ArrayBuffer) → { root, inner, mixer, size }.
// root: what gets placed (position, orientation); inner: the model, centered on x/z with its base at y=0 and scaled
// so its largest side measures 1 (root.scale then gives the size in image widths).
export async function loadModel(src) {
  const gltf = typeof src === "string" ? await gltfLoader().loadAsync(src) : await gltfLoader().parseAsync(src, "");
  const model = gltf.scene || gltf.scenes[0];
  model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.anisotropy = 4; }); } });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = 1 / Math.max(size.x, size.y, size.z, 1e-6);
  const inner = new THREE.Group(); inner.add(model);
  model.position.set(-c.x, -box.min.y, -c.z); inner.scale.setScalar(k);
  const turn = new THREE.Group(); turn.add(inner);   // r: turn around the model's own up
  const root = new THREE.Group(); root.add(turn);
  let mixer = null;
  // only the first animation: files often bring several (walk, run, jump…) that should not play at once
  if (gltf.animations && gltf.animations.length) { mixer = new THREE.AnimationMixer(model); mixer.clipAction(gltf.animations[0]).play(); }
  return { root, turn, inner, mixer, size: size.multiplyScalar(k), animated: !!mixer };
}

// Puts the loaded model where cfg says (same math in the editor and in the viewer).
export function place(m, cfg) {
  const c = { ...DEFAULT, ...cfg };
  // "frente": pushed out so no part of it ends up behind the image, whatever its turn
  const front = c.o === "frente" ? Math.max(m.size.x, m.size.z) / 2 * c.s : 0;
  m.root.position.set(c.x, c.y, c.z + front);
  m.root.rotation.set(c.o === "pie" ? Math.PI / 2 : 0, 0, 0);
  m.root.scale.setScalar(c.s);
  m.turn.rotation.set(0, THREE.MathUtils.degToRad(c.r), 0);
}

// Lights for PBR materials: a soft room environment plus a little direct light.
export function light(renderer, scene) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pm.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 0.6));
  const d = new THREE.DirectionalLight(0xffffff, 1.2); d.position.set(0.5, 1, 1.5); scene.add(d);
}
