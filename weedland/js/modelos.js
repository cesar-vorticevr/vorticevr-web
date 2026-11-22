// Modelos 3D hechos en Meshy (GLB) que reemplazan las figuras dibujadas en código.
// Lista en ../modelos/modelos.json: { "id": { "archivo": "x.glb", "alto": 1.8, "ancho": 0, "giro": 0, "colocar": [[x, z, giroGrados], ...] } }
// Si un id no está en la lista, la escena se queda con su versión de siempre (no se pide ningún archivo).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as clonarEsqueleto } from "three/addons/utils/SkeletonUtils.js";

const BASE = new URL("../modelos/", import.meta.url);
const cargador = new GLTFLoader();
let lista = null;
const plantillas = {};

export function listaModelos() {
  if (!lista) lista = fetch(new URL("modelos.json", BASE)).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return lista;
}

// Carga una vez cada GLB: { escena, clips, cfg } o null si no hay
export async function plantilla(id) {
  const todos = await listaModelos(), cfg = todos[id];
  if (!cfg || !cfg.archivo) return null;
  if (!plantillas[id]) {
    plantillas[id] = cargador.loadAsync(new URL(cfg.archivo, BASE).href).then((r) => {
      r.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = !o.isSkinnedMesh; o.castShadow = o.receiveShadow = false; } });
      return { escena: r.scene, clips: r.animations || [], cfg };
    }).catch((e) => { console.warn("No se pudo cargar el modelo", id, e); return null; });
  }
  return plantillas[id];
}

// Escala y centra un objeto: base en y = 0, centrado en x/z, de cierto alto (o ancho) y con un giro en grados
export function ajustar(obj, { alto = 0, ancho = 0, giro = 0 } = {}) {
  obj.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(obj), tam = caja.getSize(new THREE.Vector3()), c = caja.getCenter(new THREE.Vector3());
  const k = ancho ? ancho / Math.max(tam.x, tam.z, 0.001) : alto ? alto / Math.max(tam.y, 0.001) : 1;
  const cont = new THREE.Group(), giroG = new THREE.Group();
  obj.scale.multiplyScalar(k);
  obj.position.set(-c.x * k, -caja.min.y * k, -c.z * k);
  giroG.rotation.y = THREE.MathUtils.degToRad(giro || 0);
  giroG.add(obj); cont.add(giroG);
  cont.userData.tam = tam.clone().multiplyScalar(k);
  return cont;
}

// Copia lista para usar (comparte geometría y materiales; con esqueleto si lo trae)
export function copia(p, medidas = {}) {
  const obj = clonarEsqueleto(p.escena);
  // personajes con esqueleto: se recortan fuera de cámara con la esfera de la pose base (un poco más grande)
  obj.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.boundingSphere = o.geometry.boundingSphere.clone(); o.boundingSphere.radius *= 1.4;
    o.frustumCulled = true;
  });
  const cont = ajustar(obj, { alto: medidas.alto ?? p.cfg.alto, ancho: medidas.ancho ?? p.cfg.ancho, giro: (p.cfg.giro || 0) + (medidas.giro || 0) });
  // animaciones: caminar, quieto, saludar, platicar y bailar (por nombre del clip que pone Meshy)
  let mixer = null, actual = null;
  const acciones = {};
  if (p.clips.length) {
    mixer = new THREE.AnimationMixer(obj);
    const busca = (re) => p.clips.find((c) => re.test(c.name));
    const clips = {
      caminar: busca(/walk|camin|run|corr/i),
      quieto: busca(/idle|quiet|stand|breath|respir/i) || p.clips[0],
      saludar: busca(/wave|salud|greet|hello|hola/i),
      platicar: busca(/talk|habl|plat|convers|chat/i),
      bailar: busca(/danc|bail/i),
    };
    for (const k in clips) if (clips[k]) acciones[k] = mixer.clipAction(clips[k]);
  }
  const poner = (nombre) => {
    const a = acciones[nombre] || acciones.quieto;
    if (!a || a === actual) return;
    a.reset().fadeIn(0.3).play();
    // que no se muevan todos igual: cada copia empieza su clip en otro momento
    if (nombre !== "caminar") a.time = Math.random() * a.getClip().duration;
    if (actual) actual.fadeOut(0.3);
    actual = a;
  };
  poner("quieto");
  // ritmo: velocidad del clip actual (p. ej. caminar más rápido si el personaje va más rápido)
  const ritmo = (k) => { if (actual) actual.timeScale = k; };
  return { obj: cont, mixer, tiene: (n) => !!acciones[n], poner, ritmo, update: (dt, estado) => { if (!mixer) return; if (estado) poner(estado); mixer.update(dt); } };
}

// Muchas copias de un modelo sin esqueleto con InstancedMesh (palmas, faroles): matrices = [Matrix4] del lugar de cada una
export function instancias(p, matrices, medidas = {}) {
  const cont = ajustar(p.escena.clone(), { alto: medidas.alto ?? 1, ancho: medidas.ancho, giro: p.cfg.giro || 0 });
  cont.updateMatrixWorld(true);
  const g = new THREE.Group(), m = new THREE.Matrix4();
  cont.traverse((o) => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, matrices.length);
    matrices.forEach((mt, i) => im.setMatrixAt(i, m.multiplyMatrices(mt, o.matrixWorld)));
    im.computeBoundingSphere();
    g.add(im);
  });
  return g;
}
