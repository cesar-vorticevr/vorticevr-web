import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------------------
// Ajustes generales
// ---------------------------------------------------------------------------
const ES_TACTIL = matchMedia('(pointer: coarse)').matches;
if (ES_TACTIL) document.body.classList.add('es-tactil');
// en laptops con pantalla táctil, mostramos el joystick al primer toque
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') document.body.classList.add('es-tactil'); }, { passive: true });

const MUNDO = 260;            // medio lado de la zona jugable
const BORDE = 80;             // selva extra detrás del límite
const DENSIDAD = ES_TACTIL ? 0.55 : 1;
const TOTAL_VORTICE = 4;        // logos que convierten a la niña en mariposa
const FRUTAS = ['coco', 'platano', 'pina'];
const POR_FRUTA = 4;            // 4 de cada fruta = 12 logos de Tierra Lila
const TOTAL_LILA = FRUTAS.length * POR_FRUTA;
const TIEMPO_MARIPOSA = 30;
const ALTURA_MAX = 70;
const VEL_MAX = 15;
// Giro extra del modelo: la cabeza de la mariposa del .blend ya apunta a +Z.
const GIRO_MARIPOSA = 0;

const $ = (id) => document.getElementById(id);

// Aleatorio con semilla, para que la selva sea siempre la misma
let semilla = 7;
const azar = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
const entre = (a, b) => a + (b - a) * azar();

// ---------------------------------------------------------------------------
// Render, escena, luz
// ---------------------------------------------------------------------------
const canvas = $('mundo');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !ES_TACTIL, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, ES_TACTIL ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !ES_TACTIL;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const escena = new THREE.Scene();
const COLOR_NIEBLA = new THREE.Color(0x9fc9b4);
escena.fog = new THREE.FogExp2(COLOR_NIEBLA, 0.0055);

const camara = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);

escena.add(new THREE.HemisphereLight(0xdff3ff, 0x2f4a22, 1.25));
const sol = new THREE.DirectionalLight(0xfff0d0, 2.4);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 260 });
sol.shadow.bias = -0.0006;
sol.shadow.normalBias = 0.04;
escena.add(sol, sol.target);
const DIR_SOL = new THREE.Vector3(60, 110, 35).normalize();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(escena, camara));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.7, 0.55, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const uTiempo = { value: 0 };
const uCentro = { value: new THREE.Vector3() };
const uPx = { value: renderer.getPixelRatio() };

// ---------------------------------------------------------------------------
// Cielo
// ---------------------------------------------------------------------------
{
  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(800, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uSol: { value: DIR_SOL } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uSol; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 horizonte = vec3(0.62, 0.79, 0.71);
          vec3 cenit = vec3(0.22, 0.52, 0.78);
          vec3 c = mix(horizonte, cenit, pow(h, 0.55));
          float s = max(dot(normalize(vDir), uSol), 0.0);
          c += vec3(1.0, 0.85, 0.6) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.25);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  cielo.renderOrder = -1;
  escena.add(cielo);
}

// ---------------------------------------------------------------------------
// Terreno
// ---------------------------------------------------------------------------
function alturaEn(x, z) {
  return (
    Math.sin(x * 0.018) * Math.cos(z * 0.021) * 5 +
    Math.sin(x * 0.051 + 1.3) * Math.sin(z * 0.047 + 0.7) * 2 +
    Math.sin((x + z) * 0.11) * 0.6 + 4
  );
}

{
  const lado = (MUNDO + BORDE) * 2 + 120;
  const geo = new THREE.PlaneGeometry(lado, lado, 240, 240);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colores = new Float32Array(pos.count * 3);
  const musgo = new THREE.Color(0x3f7a2c), oscuro = new THREE.Color(0x24481c), tierra = new THREE.Color(0x6b5a33), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = alturaEn(x, z);
    pos.setY(i, y);
    const n = 0.5 + 0.5 * Math.sin(x * 0.13 + Math.sin(z * 0.09) * 2) * Math.cos(z * 0.11);
    c.copy(oscuro).lerp(musgo, n).lerp(tierra, Math.max(0, (y - 8) / 6) * 0.6 + (Math.sin(x * 0.4) * Math.sin(z * 0.37) > 0.8 ? 0.35 : 0));
    colores.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  geo.computeVertexNormals();
  const suelo = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  suelo.receiveShadow = true;
  escena.add(suelo);
}

// ---------------------------------------------------------------------------
// Claros: lugares sin vegetación donde pueden aparecer los logos
// ---------------------------------------------------------------------------
const claros = [];
while (claros.length < 30) {
  const x = entre(-MUNDO + 25, MUNDO - 25), z = entre(-MUNDO + 25, MUNDO - 25);
  if (Math.hypot(x, z) < 45) continue;
  if (claros.some((p) => Math.hypot(p.x - x, p.z - z) < 48)) continue;
  claros.push({ x, z });
}
const libreDeClaros = (x, z, r) => claros.every((p) => Math.hypot(p.x - x, p.z - z) > r);
const troncos = []; // { x, z, r, alto } para que la mariposa no atraviese los árboles

// ---------------------------------------------------------------------------
// Carga de recursos
// ---------------------------------------------------------------------------
const gestor = new THREE.LoadingManager();
gestor.onProgress = (_u, hechos, total) => ($('barra').style.width = `${(hechos / total) * 100}%`);
const cargador = new GLTFLoader(gestor);
const cargar = (url) => new Promise((ok, mal) => cargador.load(url, ok, undefined, mal));
const cargarImagen = (url) => new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = mal; im.src = url; });

const [selvaGltf, mariposaGltf, imgLogo, ninaGltf, palmaGltf, platanoGltf, pinaGltf, imgLila] = await Promise.all([
  cargar('assets/tropical.gltf.json'),
  cargar('assets/butterfly.gltf.json'),
  cargarImagen('assets/logo.png'),
  cargar('assets/nina.glb'),
  cargar('assets/palmera.glb'),
  cargar('assets/platano.glb'),
  cargar('assets/pina.glb'),
  cargarImagen('assets/tierralila.png'),
]);

// ---------------------------------------------------------------------------
// Vegetación instanciada (repite los modelos del paquete tropical)
// ---------------------------------------------------------------------------
const ESPECIES = {
  JungleTree01: { n: 75, s: [3.2, 4.8], arbol: true },
  JungleTree02: { n: 75, s: [3.2, 4.8], arbol: true },
  Palm01: { n: 50, s: [2.8, 3.8], arbol: true },
  Palm02: { n: 50, s: [2.8, 3.8], arbol: true },
  Palm03: { n: 45, s: [2.6, 3.6], arbol: true },
  BananaTree01: { n: 55, s: [2.2, 3.2], arbol: true },
  BananaTree02: { n: 22, s: [2.2, 3.0], arbol: true },
  TropicalPlant01: { n: 230, s: [1.6, 2.8] },
  TropicalPlant02: { n: 230, s: [1.6, 2.8] },
  TropicalPlant03: { n: 230, s: [1.6, 2.8] },
  TropicalFlower01: { n: 220, s: [1.8, 3.0] },
  PineapplePlant: { n: 90, s: [1.4, 2.2] },
  Coconut: { n: 40, s: [1.4, 2.0] },
  CoconutHalf: { n: 30, s: [1.4, 2.0] },
  Pineapple: { n: 25, s: [1.2, 1.8] },
  Banana: { n: 20, s: [1.6, 2.4] },
};

const materialesListos = new WeakSet();
function prepararMaterial(m) {
  if (materialesListos.has(m)) return m;
  materialesListos.add(m);
  m.transparent = false;
  m.alphaTest = 0.45;
  m.depthWrite = true;
  m.side = THREE.DoubleSide;
  m.metalness = 0;
  m.roughness = 0.9;
  if (m.map) m.map.anisotropy = 4;
  // viento: las partes altas se mecen
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTiempo = uTiempo;
    sh.vertexShader = 'uniform float uTiempo;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        float hh = max(position.y, 0.0);
        float fase = uTiempo * 1.3 + instanceMatrix[3][0] * 0.07 + instanceMatrix[3][2] * 0.05;
        transformed.x += sin(fase) * 0.010 * hh * hh;
        transformed.z += cos(fase * 0.8) * 0.007 * hh * hh;
      #endif`);
  };
  return m;
}

{
  selvaGltf.scene.updateMatrixWorld(true);
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const eje = new THREE.Vector3(0, 1, 0);
  for (const nodo of selvaGltf.scene.children) {
    const esp = ESPECIES[nodo.name];
    if (!esp) continue;
    const n = Math.round(esp.n * DENSIDAD);
    const matrices = [];
    let intentos = 0;
    while (matrices.length < n && intentos++ < n * 20) {
      const x = entre(-MUNDO - BORDE, MUNDO + BORDE), z = entre(-MUNDO - BORDE, MUNDO + BORDE);
      if (!libreDeClaros(x, z, esp.arbol ? 13 : 8)) continue;
      if (Math.hypot(x, z) < (esp.arbol ? 14 : 5)) continue;
      const k = entre(esp.s[0], esp.s[1]);
      p.set(x, alturaEn(x, z) - 0.15, z);
      q.setFromAxisAngle(eje, entre(0, Math.PI * 2));
      s.set(k, k, k);
      matrices.push(new THREE.Matrix4().compose(p, q, s));
      if (esp.arbol) troncos.push({ x, z, r: 0.45 * k, alto: p.y + 3.2 * k });
    }
    // los nodos ya están en el origen; conservamos su giro y escala horneándolos en la geometría
    nodo.traverse((malla) => {
      if (!malla.isMesh) return;
      const geo = malla.geometry.clone().applyMatrix4(malla.matrixWorld);
      const mats = Array.isArray(malla.material) ? malla.material.map(prepararMaterial) : prepararMaterial(malla.material);
      const inst = new THREE.InstancedMesh(geo, mats, matrices.length);
      matrices.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.castShadow = esp.arbol;
      inst.receiveShadow = true;
      inst.computeBoundingSphere();
      escena.add(inst);
    });
  }
}

// ---------------------------------------------------------------------------
// Texturas del logo (fondo blanco → transparente, símbolo y texto separados)
// ---------------------------------------------------------------------------
function texturasLogo(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0);
  const datos = cx.getImageData(0, 0, w, h);
  const d = datos.data;
  for (let i = 0; i < d.length; i += 4) {
    const blanco = Math.min(d[i], d[i + 1], d[i + 2]);
    const a = THREE.MathUtils.clamp((255 - blanco) / 70, 0, 1);
    d[i + 3] = Math.min(d[i + 3], a * 255);
  }
  cx.putImageData(datos, 0, 0);
  // caja del símbolo: columnas con tinta en el primer cuarto de la imagen
  const limite = Math.floor(w * 0.27);
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < limite; x++) {
    if (d[(y * w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  // recorta una zona y le pone un halo; con blanco=true las letras quedan blancas con halo morado
  const recortar = (sx, sy, sw, sh, margen, blanco) => {
    const c = Object.assign(document.createElement('canvas'), { width: sw + margen * 2, height: sh + margen * 2 });
    const g = c.getContext('2d');
    let fuente = cv;
    if (blanco) {
      fuente = Object.assign(document.createElement('canvas'), { width: w, height: h });
      const f = fuente.getContext('2d');
      f.drawImage(cv, 0, 0);
      f.globalCompositeOperation = 'source-in';
      f.fillStyle = '#fff';
      f.fillRect(0, 0, w, h);
    }
    g.shadowColor = blanco ? 'rgba(150,70,230,1)' : 'rgba(255,255,255,1)';
    g.shadowBlur = margen * 0.8;
    for (let i = 0; i < 3; i++) g.drawImage(fuente, sx, sy, sw, sh, margen, margen, sw, sh);
    return c;
  };
  const simbolo = recortar(x0, y0, x1 - x0 + 1, y1 - y0 + 1, 28, false);
  const texto = recortar(x1 + 20, 0, w - x1 - 20, h, 28, true);
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  return { simbolo: tex(simbolo), texto: tex(texto), aspectoSimbolo: simbolo.width / simbolo.height, aspectoTexto: texto.width / texto.height, urlSimbolo: simbolo.toDataURL() };
}
const logoTex = texturasLogo(imgLogo);

function texturaResplandor(interior, exterior) {
  const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, interior); gr.addColorStop(0.35, exterior); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const texResplandor = texturaResplandor('rgba(255,255,255,1)', 'rgba(170,90,255,0.45)');

// Logo de Tierra Lila: viene blanco; le damos un halo lila para que se lea sobre la selva
const lilaTex = (() => {
  const m = 30, w = imgLila.naturalWidth, h = imgLila.naturalHeight;
  const c = Object.assign(document.createElement('canvas'), { width: w + m * 2, height: h + m * 2 });
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(150,80,220,1)';
  g.shadowBlur = m * 0.8;
  for (let i = 0; i < 3; i++) g.drawImage(imgLila, m, m);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, aspecto: c.width / c.height, url: c.toDataURL() };
})();

// ---------------------------------------------------------------------------
// Palmeras de coco (modelo Meshy) repartidas por la selva
// ---------------------------------------------------------------------------
function normalizar(raiz, alto) {
  // deja el modelo con la base en y=0, centrado y con la altura pedida
  raiz.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(raiz);
  const k = alto / (caja.max.y - caja.min.y);
  const centro = caja.getCenter(new THREE.Vector3());
  raiz.scale.multiplyScalar(k);
  raiz.position.set(-centro.x * k, -caja.min.y * k, -centro.z * k);
  const g = new THREE.Group();
  g.add(raiz);
  return g;
}
{
  let malla;
  palmaGltf.scene.updateMatrixWorld(true);
  palmaGltf.scene.traverse((o) => { if (o.isMesh && !malla) malla = o; });
  const geo = malla.geometry.clone().applyMatrix4(malla.matrixWorld);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  const escalaBase = 1 / (bb.max.y - bb.min.y);
  const mat = malla.material;
  mat.side = THREE.DoubleSide;
  const n = Math.round(70 * DENSIDAD);
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), eje = new THREE.Vector3(0, 1, 0);
  let i = 0, intentos = 0;
  while (i < n && intentos++ < n * 30) {
    const x = entre(-MUNDO - BORDE, MUNDO + BORDE), z = entre(-MUNDO - BORDE, MUNDO + BORDE);
    if (!libreDeClaros(x, z, 13) || Math.hypot(x, z) < 16) continue;
    const alto = entre(11, 17), k = alto * escalaBase;
    p.set(x, alturaEn(x, z) - 0.2, z);
    q.setFromAxisAngle(eje, entre(0, Math.PI * 2));
    s.set(k, k, k);
    inst.setMatrixAt(i++, new THREE.Matrix4().compose(p, q, s));
    troncos.push({ x, z, r: 0.5, alto: p.y + alto * 0.8 });
  }
  inst.count = i;
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.computeBoundingSphere();
  escena.add(inst);
}

// Premios: coco (la palmera Meshy en miniatura), plátano y piña
const PREMIOS = {
  coco: { gltf: palmaGltf, alto: 3.4, nombre: 'Coco', emoji: '🥥' },
  platano: { gltf: platanoGltf, alto: 2.0, nombre: 'Plátano', emoji: '🍌' },
  pina: { gltf: pinaGltf, alto: 2.3, nombre: 'Piña', emoji: '🍍' },
};
function crearPremio(tipo) {
  const p = PREMIOS[tipo];
  const modelo = normalizar(p.gltf.scene.clone(true), p.alto);
  modelo.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); o.material.emissive = new THREE.Color(0x221a08); } });
  return modelo;
}

// ---------------------------------------------------------------------------
// Mariposas
// ---------------------------------------------------------------------------
const plantillaMariposa = (() => {
  const raiz = mariposaGltf.scene;
  raiz.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;
      o.castShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { m.side = THREE.DoubleSide; if (m.map) { m.alphaTest = 0.3; } });
    }
  });
  const caja = new THREE.Box3().setFromObject(raiz);
  const tam = caja.getSize(new THREE.Vector3());
  const centro = caja.getCenter(new THREE.Vector3());
  return { raiz, escala: 1.5 / Math.max(tam.x, tam.z), centro };
})();

function crearMariposa(tinte) {
  const modelo = SkeletonUtils.clone(plantillaMariposa.raiz);
  if (tinte) modelo.traverse((o) => {
    if (o.isMesh) o.material = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => { const c = m.clone(); c.color.copy(tinte); return c; });
  });
  modelo.scale.setScalar(plantillaMariposa.escala);
  modelo.position.copy(plantillaMariposa.centro).multiplyScalar(-plantillaMariposa.escala);
  const giro = new THREE.Group();
  giro.rotation.y = GIRO_MARIPOSA;
  giro.add(modelo);
  const pivote = new THREE.Group();
  pivote.rotation.order = 'YXZ';
  pivote.add(giro);
  const mezclador = new THREE.AnimationMixer(modelo);
  const clip = mariposaGltf.animations[0];
  if (clip) mezclador.clipAction(clip).play();
  escena.add(pivote);
  return { pivote, mezclador };
}

// ---------------------------------------------------------------------------
// Jugador
// ---------------------------------------------------------------------------
// La niña: modelo Mixamo con idle, caminar, correr, saltar y hablar
const nina = (() => {
  const raiz = ninaGltf.scene;
  raiz.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  const modelo = normalizar(raiz, 2.1);
  const mezclador = new THREE.AnimationMixer(raiz);
  const acciones = {};
  for (const clip of ninaGltf.animations) {
    // quitamos el avance horizontal de la cadera: el juego mueve a la niña.
    // El esqueleto viene de Blender (Z arriba): avanza en Y y la altura es Z,
    // así que se fijan X y Y y se deja Z para el rebote del paso.
    for (const pista of clip.tracks) {
      if (!/Hips.position$/.test(pista.name)) continue;
      const v = pista.values, x0 = v[0], y0 = v[1];
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 1] = y0; }
    }
    acciones[clip.name] = mezclador.clipAction(clip);
  }
  acciones.saltar?.setLoop(THREE.LoopOnce, 1);
  if (acciones.saltar) acciones.saltar.clampWhenFinished = true;
  const pivote = new THREE.Group();
  pivote.add(modelo);
  escena.add(pivote);
  let actual = null;
  const poner = (nombre, mezcla = 0.25) => {
    const sig = acciones[nombre];
    if (!sig || sig === actual) return;
    sig.reset().setEffectiveWeight(1).play();
    if (actual) actual.crossFadeTo(sig, mezcla, false);
    actual = sig;
  };
  poner('idle');
  return { pivote, mezclador, acciones, poner, get actual() { return actual; } };
})();

const jugador = {
  ...crearMariposa(null),
  pos: new THREE.Vector3(0, alturaEn(0, 0), 0),
  rumbo: 0, vGiro: 0, vel: 0, vy: 0, aleteo: 0,
  modo: 'nina',            // 'nina' camina; 'mariposa' vuela por TIEMPO_MARIPOSA segundos
  tiempo: 0,               // segundos de mariposa que quedan
  enSuelo: true,
  quieto: false,           // true mientras contesta la trivia
};
jugador.pivote.visible = false;

const teclas = {};
const MAPA = {
  KeyW: 'adelante', ArrowUp: 'adelante', KeyS: 'atras', ArrowDown: 'atras',
  KeyA: 'izq', ArrowLeft: 'izq', KeyD: 'der', ArrowRight: 'der',
  Space: 'subir', KeyE: 'subir', ShiftLeft: 'bajar', ShiftRight: 'bajar', KeyQ: 'bajar', KeyC: 'bajar',
};
addEventListener('keydown', (e) => { if (MAPA[e.code]) { teclas[MAPA[e.code]] = true; e.preventDefault(); } });
addEventListener('keyup', (e) => { if (MAPA[e.code]) teclas[MAPA[e.code]] = false; });
addEventListener('blur', () => Object.keys(teclas).forEach((k) => (teclas[k] = false)));

// Joystick táctil
const joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
{
  const zona = $('zonaJoy'), base = $('joyBase'), perilla = $('joyPerilla');
  const R = 50;
  zona.addEventListener('pointerdown', (e) => {
    joy.id = e.pointerId; zona.setPointerCapture(e.pointerId);
    const r = zona.getBoundingClientRect();
    joy.ox = e.clientX; joy.oy = e.clientY;
    base.style.left = `${e.clientX - r.left}px`; base.style.top = `${e.clientY - r.top}px`;
  });
  zona.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    joy.x = dx / R; joy.y = dy / R;
    perilla.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const soltar = (e) => {
    if (e.pointerId !== joy.id) return;
    joy.id = null; joy.x = joy.y = 0; perilla.style.transform = '';
  };
  zona.addEventListener('pointerup', soltar);
  zona.addEventListener('pointercancel', soltar);

  const boton = (id, accion) => {
    const b = $(id);
    const on = (e) => { e.preventDefault(); teclas[accion] = true; b.classList.add('activo'); };
    const off = () => { teclas[accion] = false; b.classList.remove('activo'); };
    b.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, off));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  boton('btnSubir', 'subir');
  boton('btnBajar', 'bajar');
}

const amortiguar = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

function moverJugador(dt) {
  const j = jugador;
  const libre = !j.quieto;
  const giro = libre ? (teclas.izq ? 1 : 0) - (teclas.der ? 1 : 0) - joy.x : 0;
  const empuje = libre ? THREE.MathUtils.clamp((teclas.adelante ? 1 : 0) - (teclas.atras ? 1 : 0) - joy.y, -0.35, 1) : 0;
  const elevar = libre ? (teclas.subir ? 1 : 0) - (teclas.bajar ? 1 : 0) : 0;
  const volando = j.modo === 'mariposa';

  j.vGiro = amortiguar(j.vGiro, THREE.MathUtils.clamp(giro, -1, 1) * (volando ? 1.9 : 2.4), 6, dt);
  j.rumbo += j.vGiro * dt;
  if (volando) {
    j.vel = amortiguar(j.vel, empuje * VEL_MAX, 2.2, dt);
    j.vy = amortiguar(j.vy, elevar * 8, 3, dt);
  } else {
    j.vel = amortiguar(j.vel, empuje * (empuje > 0 ? 9 : 6), 5, dt);
    if (j.enSuelo && elevar > 0) { j.vy = 8.5; j.enSuelo = false; nina.poner('saltar', 0.1); sonidos.salto(); }
    j.vy -= 22 * dt;
  }

  j.pos.x += Math.sin(j.rumbo) * j.vel * dt;
  j.pos.z += Math.cos(j.rumbo) * j.vel * dt;
  j.pos.y += j.vy * dt;

  for (const t of troncos) {
    const dx = j.pos.x - t.x, dz = j.pos.z - t.z;
    if (Math.abs(dx) > 4 || Math.abs(dz) > 4 || j.pos.y > t.alto) continue;
    const d = Math.hypot(dx, dz), minimo = t.r + 0.6;
    if (d < minimo && d > 0.0001) { j.pos.x = t.x + (dx / d) * minimo; j.pos.z = t.z + (dz / d) * minimo; }
  }

  if (Math.abs(j.pos.x) > MUNDO || Math.abs(j.pos.z) > MUNDO) {
    j.pos.x = THREE.MathUtils.clamp(j.pos.x, -MUNDO, MUNDO);
    j.pos.z = THREE.MathUtils.clamp(j.pos.z, -MUNDO, MUNDO);
    avisar('Hasta aquí llega la selva 🌿', 1600);
  }

  const suelo = alturaEn(j.pos.x, j.pos.z);
  if (volando) {
    j.pos.y = THREE.MathUtils.clamp(j.pos.y, suelo + 1.0, ALTURA_MAX);
    const ritmo = 1.1 + Math.abs(j.vel) / 7 + Math.abs(j.vy) / 5;
    j.mezclador.timeScale = ritmo;
    j.mezclador.update(dt);
    j.aleteo += dt * ritmo * 6;
    j.pivote.position.copy(j.pos);
    j.pivote.position.y += Math.sin(j.aleteo) * 0.07;
    j.pivote.rotation.y = j.rumbo;
    j.pivote.rotation.x = amortiguar(j.pivote.rotation.x, -j.vy * 0.05 + j.vel * 0.012, 5, dt);
    j.pivote.rotation.z = amortiguar(j.pivote.rotation.z, -j.vGiro * 0.35, 5, dt);
    soltarDestellos(dt);
  } else {
    if (j.pos.y <= suelo) { j.pos.y = suelo; j.vy = 0; j.enSuelo = true; }
    // animación según lo que hace
    const rapidez = Math.abs(j.vel);
    if (j.quieto) nina.poner('hablar', 0.4);
    else if (!j.enSuelo) { /* deja terminar el salto */ }
    else if (rapidez > 5.5) nina.poner('correr');
    else if (rapidez > 0.6) nina.poner('caminar');
    else nina.poner('idle', 0.35);
    if (nina.acciones.correr) nina.acciones.correr.timeScale = THREE.MathUtils.clamp(rapidez / 8, 0.7, 1.3);
    if (nina.acciones.caminar) nina.acciones.caminar.timeScale = j.vel < 0 ? -1 : THREE.MathUtils.clamp(rapidez / 3, 0.7, 1.4);
    nina.mezclador.update(dt);
    nina.pivote.position.copy(j.pos);
    nina.pivote.rotation.y = j.rumbo;
  }
}

// Cámara de seguimiento
const camObjetivo = new THREE.Vector3(), camMira = new THREE.Vector3(), miraSuave = new THREE.Vector3();
let sacudida = 0;
let focoMagia = null;   // punto del logo que se está activando
let mezclaMagia = 0;    // 0 = cámara normal, 1 = cámara alejada mirando el logo
let mezclaVuelo = 0;    // 0 = cámara de la niña, 1 = cámara de la mariposa
function moverCamara(dt, primera = false) {
  const j = jugador;
  const fx = Math.sin(j.rumbo), fz = Math.cos(j.rumbo);
  mezclaMagia = amortiguar(mezclaMagia, focoMagia ? 1 : 0, 2.5, dt);
  const vuelo = j.modo === 'mariposa' ? 1 : 0;
  mezclaVuelo = primera ? vuelo : amortiguar(mezclaVuelo, vuelo, 2, dt);
  const lejos = THREE.MathUtils.lerp(5.2, 6, mezclaVuelo) + Math.max(j.vel, 0) * 0.12 + mezclaMagia * 16;
  const alto = THREE.MathUtils.lerp(2.6, 3.3, mezclaVuelo);
  camObjetivo.set(j.pos.x - fx * lejos, j.pos.y + alto + mezclaMagia * 4, j.pos.z - fz * lejos);
  camObjetivo.y = Math.max(camObjetivo.y, alturaEn(camObjetivo.x, camObjetivo.z) + 0.8);
  if (primera) camara.position.copy(camObjetivo);
  else camara.position.lerp(camObjetivo, 1 - Math.exp(-4 * dt));
  camMira.set(j.pos.x + fx * 2, j.pos.y + THREE.MathUtils.lerp(1.5, 0.5, mezclaVuelo), j.pos.z + fz * 2);
  if (focoMagia) camMira.lerp(focoMagia, mezclaMagia);
  if (primera) miraSuave.copy(camMira);
  else miraSuave.lerp(camMira, 1 - Math.exp(-6 * dt));
  camara.lookAt(miraSuave);
  if (sacudida > 0) {
    sacudida = Math.max(0, sacudida - dt * 1.5);
    camara.position.x += (Math.random() - 0.5) * sacudida * 0.6;
    camara.position.y += (Math.random() - 0.5) * sacudida * 0.6;
  }
  // el sol y su sombra siguen al jugador
  sol.target.position.copy(j.pos);
  sol.position.copy(j.pos).addScaledVector(DIR_SOL, 120);
}

// ---------------------------------------------------------------------------
// Transformación niña ⇄ mariposa
// ---------------------------------------------------------------------------
function convertir(modo) {
  const j = jugador;
  const centro = j.pos.clone();
  centro.y += 1.2;
  explotar(centro, 0.45);
  sonidos.transformar(modo === 'mariposa');
  j.modo = modo;
  if (modo === 'mariposa') {
    j.tiempo = TIEMPO_MARIPOSA;
    j.pos.y += 2.5;
    j.vy = 4;
    nina.pivote.visible = false;
    j.pivote.visible = true;
    $('reloj').classList.add('on');
    narrador.contar();
  } else {
    j.vy = 0;
    j.enSuelo = false;
    j.pivote.visible = false;
    nina.pivote.visible = true;
    nina.poner('saltar', 0.1);
    $('reloj').classList.remove('on');
    narrador.callar();
    avisar('Volviste a ser niña · busca otro logo de Vórtice VR 🦋', 2600);
  }
}

function actualizarTiempoMariposa(dt) {
  const j = jugador;
  if (j.modo !== 'mariposa' || j.quieto) return;
  j.tiempo -= dt;
  const r = $('reloj');
  r.querySelector('i').style.width = `${Math.max(0, j.tiempo / TIEMPO_MARIPOSA) * 100}%`;
  r.querySelector('span').textContent = `${Math.ceil(Math.max(0, j.tiempo))} s`;
  r.classList.toggle('poco', j.tiempo < 6);
  if (j.tiempo <= 0) convertir('nina');
}

// Estela de destellos que deja la mariposa
const estela = (() => {
  const N = 700;
  const pos = new Float32Array(N * 3).fill(-9999), nac = new Float32Array(N).fill(-99), col = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aNace', new THREE.BufferAttribute(nac, 1));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uTiempo, uPx },
    vertexShader: `
      uniform float uTiempo, uPx; attribute float aNace; varying vec3 vColor; varying float vVida;
      void main(){
        float edad = uTiempo - aNace;
        vVida = clamp(1.0 - edad / 1.6, 0.0, 1.0);
        vec3 p = position; p.y -= edad * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vColor = color;
        gl_PointSize = (1.5 + 4.0 * vVida) * uPx * (25.0 / -mv.z) * (0.7 + 0.3 * sin(uTiempo * 30.0 + aNace * 50.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vVida;
      void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5 || vVida <= 0.0) discard;
        float estrella = max(0.0, 1.0 - abs(q.x) * abs(q.y) * 60.0) * smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor, (smoothstep(0.5, 0.0, d) * 0.5 + estrella) * vVida); }`,
  });
  const puntos = new THREE.Points(geo, mat);
  puntos.frustumCulled = false;
  escena.add(puntos);
  return { pos, nac, col, geo, i: 0, N, acumulado: 0 };
})();
const COLORES_ESTELA = [0xd9b8ff, 0xffffff, 0xffd36e, 0xb67cff, 0xff9ae6].map((c) => new THREE.Color(c).multiplyScalar(2.2));
const atras = new THREE.Vector3();
function soltarDestellos(dt) {
  estela.acumulado += dt * (40 + Math.abs(jugador.vel) * 6);
  atras.set(-Math.sin(jugador.rumbo), 0, -Math.cos(jugador.rumbo));
  while (estela.acumulado >= 1) {
    estela.acumulado--;
    const k = estela.i;
    estela.i = (estela.i + 1) % estela.N;
    estela.pos[k * 3] = jugador.pos.x + atras.x * 0.6 + (Math.random() - 0.5) * 1.2;
    estela.pos[k * 3 + 1] = jugador.pos.y + (Math.random() - 0.5) * 0.8;
    estela.pos[k * 3 + 2] = jugador.pos.z + atras.z * 0.6 + (Math.random() - 0.5) * 1.2;
    estela.nac[k] = uTiempo.value - Math.random() * 0.1;
    const c = COLORES_ESTELA[(Math.random() * COLORES_ESTELA.length) | 0];
    estela.col.set([c.r, c.g, c.b], k * 3);
  }
  estela.geo.attributes.position.needsUpdate = true;
  estela.geo.attributes.aNace.needsUpdate = true;
  estela.geo.attributes.color.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Mariposas que acompañan
// ---------------------------------------------------------------------------
const TINTES = [0xffb0e0, 0x9fd8ff, 0xfff1a0, 0xc9a8ff, 0xffffff, 0xa8ffcf];
const companeras = Array.from({ length: ES_TACTIL ? 8 : 14 }, (_, i) => {
  const m = crearMariposa(new THREE.Color(TINTES[i % TINTES.length]));
  m.pivote.scale.setScalar(0.75);
  m.pos = new THREE.Vector3();
  m.meta = new THREE.Vector3();
  m.rumbo = 0;
  m.mezclador.timeScale = 1.6 + Math.random();
  m.mezclador.update(Math.random());
  return m;
});
function reubicar(m, cerca) {
  const a = Math.random() * Math.PI * 2, r = cerca ? 15 + Math.random() * 40 : 60 + Math.random() * 30;
  const fx = Math.sin(jugador.rumbo + (cerca ? 0 : (Math.random() - 0.5) * 1.6)), fz = Math.cos(jugador.rumbo);
  m.pos.set(jugador.pos.x + (cerca ? Math.cos(a) * r : fx * r), 0, jugador.pos.z + (cerca ? Math.sin(a) * r : fz * r));
  m.pos.y = alturaEn(m.pos.x, m.pos.z) + 2 + Math.random() * 10;
  m.meta.copy(m.pos);
}
companeras.forEach((m) => reubicar(m, true));
function moverCompaneras(dt) {
  for (const m of companeras) {
    if (m.pos.distanceTo(jugador.pos) > 110) reubicar(m, false);
    if (m.pos.distanceTo(m.meta) < 2) {
      m.meta.set(m.pos.x + (Math.random() - 0.5) * 30, 0, m.pos.z + (Math.random() - 0.5) * 30);
      m.meta.y = alturaEn(m.meta.x, m.meta.z) + 1.5 + Math.random() * 12;
    }
    const dx = m.meta.x - m.pos.x, dz = m.meta.z - m.pos.z;
    const objetivo = Math.atan2(dx, dz);
    let dif = objetivo - m.rumbo;
    dif = Math.atan2(Math.sin(dif), Math.cos(dif));
    m.rumbo += dif * Math.min(1, dt * 2);
    m.pos.x += Math.sin(m.rumbo) * 4 * dt;
    m.pos.z += Math.cos(m.rumbo) * 4 * dt;
    m.pos.y = amortiguar(m.pos.y, m.meta.y, 0.8, dt);
    m.mezclador.update(dt);
    m.pivote.position.copy(m.pos);
    m.pivote.position.y += Math.sin(uTiempo.value * 9 + m.rumbo * 5) * 0.12;
    m.pivote.rotation.y = m.rumbo;
    m.pivote.rotation.z = -dif * 0.5;
  }
}

// ---------------------------------------------------------------------------
// Polen y luciérnagas alrededor de la mariposa
// ---------------------------------------------------------------------------
{
  const N = ES_TACTIL ? 500 : 1100;
  const p = new Float32Array(N * 3), f = new Float32Array(N);
  for (let i = 0; i < N; i++) { p.set([Math.random() * 140, Math.random() * 40, Math.random() * 140], i * 3); f[i] = Math.random() * 6.28; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('aFase', new THREE.BufferAttribute(f, 1));
  const polen = new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTiempo, uCentro, uPx },
    vertexShader: `
      uniform float uTiempo, uPx; uniform vec3 uCentro; attribute float aFase; varying float vBrillo;
      void main(){
        vec3 p = position;
        p.x += sin(uTiempo * 0.3 + aFase) * 3.0; p.z += cos(uTiempo * 0.25 + aFase) * 3.0; p.y += sin(uTiempo * 0.5 + aFase * 2.0) * 1.5;
        p.xz = mod(p.xz - uCentro.xz + 70.0, 140.0) - 70.0 + uCentro.xz;
        p.y = mod(p.y - uCentro.y + 20.0, 40.0) - 20.0 + uCentro.y;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vBrillo = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTiempo * 2.0 + aFase * 3.0), 3.0);
        gl_PointSize = (fract(aFase) > 0.85 ? 7.0 : 3.5) * uPx * (22.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vBrillo;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.65) * vBrillo, smoothstep(0.5, 0.0, d)); }`,
  }));
  polen.frustumCulled = false;
  escena.add(polen);
}

// ---------------------------------------------------------------------------
// Logos de Vórtice VR con hotspot
// ---------------------------------------------------------------------------
const MORADO = new THREE.Color(0x8a3fd6);
const materialHotspot = (color = MORADO) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTiempo, uOpacidad: { value: 1 }, uColor: { value: color } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform float uTiempo, uOpacidad; uniform vec3 uColor; varying vec2 vUv;
    void main(){
      float r = length(vUv - 0.5) * 2.0;
      float ondas = 0.5 + 0.5 * sin(r * 16.0 - uTiempo * 3.5);
      float borde = smoothstep(0.84, 0.93, r) * (1.0 - smoothstep(0.95, 1.0, r));
      float a = (0.22 + 0.25 * ondas) * (1.0 - smoothstep(0.82, 0.95, r)) + borde * 0.95;
      vec3 c = mix(uColor, vec3(0.9, 0.75, 1.0), borde * 0.7 + ondas * 0.15);
      gl_FragColor = vec4(c * (1.0 + borde * 1.5), a * uOpacidad);
    }`,
});

const materialHaz = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  uniforms: { uTiempo, uOpacidad: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform float uTiempo, uOpacidad; varying vec2 vUv;
    void main(){
      float a = pow(1.0 - vUv.y, 2.2) * (0.75 + 0.25 * sin(vUv.y * 30.0 - uTiempo * 4.0));
      gl_FragColor = vec4(vec3(0.6, 0.3, 1.0) * a * 0.45 * uOpacidad, 1.0);
    }`,
});

const materialOrbita = (c1 = 0x8c33ff, c2 = 0xf2ccff) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTiempo, uPx, uCarga: { value: 0 }, uOpacidad: { value: 1 }, uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(c2) } },
  vertexShader: `
    uniform float uTiempo, uPx, uCarga; attribute vec4 aDatos; varying float vMezcla;
    void main(){
      float ang = aDatos.x + uTiempo * aDatos.z * (1.0 + uCarga * 6.0);
      float rad = aDatos.y * (1.0 - uCarga * 0.75);
      float alto = mod(aDatos.w + uTiempo * 1.6, 16.0);
      alto = mix(alto, 9.0 + (alto - 8.0) * 0.25, uCarga);
      vec3 p = vec3(cos(ang) * rad, alto, sin(ang) * rad);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vMezcla = fract(aDatos.x * 3.7);
      gl_PointSize = (2.5 + vMezcla * 4.0) * (1.0 + uCarga * 1.5) * uPx * (30.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform float uOpacidad, uCarga; uniform vec3 uC1, uC2; varying float vMezcla;
    void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
      vec3 c = mix(uC1, uC2, vMezcla) * (1.4 + uCarga * 1.5);
      gl_FragColor = vec4(c, smoothstep(0.5, 0.0, d) * uOpacidad); }`,
});

const logos = [];
const ALTO_LOGO = 9;
const LILA = new THREE.Color(0xb98cf0);
const VERDE_HOJA = 0x7fe08a;

// tipo 'vortice': convierte a la niña en mariposa · tipo 'lila': trivia que regala una fruta
function crearLogo(x, z, tipo, fruta) {
  const base = alturaEn(x, z);
  const g = new THREE.Group();
  g.position.set(x, base, z);
  const esLila = tipo === 'lila';

  // círculo en el suelo que se adapta al terreno
  const disco = new THREE.CircleGeometry(6, 64);
  disco.rotateX(-Math.PI / 2);
  const dp = disco.attributes.position;
  for (let i = 0; i < dp.count; i++) dp.setY(i, alturaEn(x + dp.getX(i), z + dp.getZ(i)) - base + 0.18);
  const hotspot = new THREE.Mesh(disco, materialHotspot(esLila ? LILA : MORADO));
  hotspot.renderOrder = 2;

  const haz = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.6, 46, 32, 1, true), materialHaz());
  haz.position.y = ALTO_LOGO + 4 + 23; // el haz nace encima del logo para no taparlo
  haz.visible = !esLila;

  const flotante = new THREE.Group();
  flotante.position.y = ALTO_LOGO;
  let simbolo, texto;
  if (esLila) {
    // el logo de Tierra Lila es una palabra: siempre de frente a la cámara
    const ancho = 10;
    simbolo = new THREE.Sprite(new THREE.SpriteMaterial({ map: lilaTex.tex, transparent: true, depthWrite: false, toneMapped: false }));
    simbolo.scale.set(ancho, ancho / lilaTex.aspecto, 1);
    simbolo.material.color.setScalar(1.15);
    texto = simbolo;
  } else {
    const alto = 5.2;
    const matSimbolo = new THREE.MeshBasicMaterial({ map: logoTex.simbolo, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, toneMapped: false });
    matSimbolo.color.setScalar(1.1);
    simbolo = new THREE.Mesh(new THREE.PlaneGeometry(alto * logoTex.aspectoSimbolo, alto), matSimbolo);
    texto = new THREE.Sprite(new THREE.SpriteMaterial({ map: logoTex.texto, transparent: true, depthWrite: false, toneMapped: false }));
    texto.material.color.setScalar(1.2);
    const anchoTexto = 8.5;
    texto.scale.set(anchoTexto, anchoTexto / logoTex.aspectoTexto, 1);
    texto.position.y = -4.4;
  }
  const resplandor = new THREE.Sprite(new THREE.SpriteMaterial({ map: texResplandor, color: esLila ? 0xa8f0b0 : 0xc89bff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55, toneMapped: false }));
  resplandor.scale.setScalar(esLila ? 11 : 13);
  const luz = new THREE.PointLight(esLila ? 0xb0ffb8 : 0xb070ff, 30, 30, 1.6);
  flotante.add(resplandor, simbolo, luz);
  if (texto !== simbolo) flotante.add(texto);

  // la fruta que se gana, girando sobre el círculo
  let premio = null;
  if (esLila) {
    premio = crearPremio(fruta);
    premio.position.y = 2.2;
    const brillo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texResplandor, color: 0xffe08a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35, toneMapped: false }));
    brillo.scale.setScalar(4.5);
    brillo.position.y = PREMIOS[fruta].alto * 0.5;
    premio.add(brillo);
    g.add(premio);
  }

  const N = 220, datos = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) datos.set([Math.random() * 6.28, 1.5 + Math.random() * 4.5, 0.4 + Math.random() * 1.2, Math.random() * 16], i * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aDatos', new THREE.BufferAttribute(datos, 4));
  const orbita = new THREE.Points(geo, esLila ? materialOrbita(VERDE_HOJA, 0xe6ccff) : materialOrbita());
  orbita.frustumCulled = false;

  g.add(hotspot, haz, flotante, orbita);
  escena.add(g);
  const logo = { tipo, fruta, g, hotspot, haz, flotante, simbolo, resplandor, texto, luz, orbita, premio, estado: 'flotando', t: 0, fase: Math.random() * 6 };
  logos.push(logo);
  return logo;
}

function quitarLogo(logo) {
  escena.remove(logo.g);
  if (logo.premio) logo.g.remove(logo.premio); // su geometría se comparte con las demás frutas
  logo.g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
}

// ---------------------------------------------------------------------------
// Explosión mágica
// ---------------------------------------------------------------------------
const explosiones = [];
const COLORES_CHISPA = [0xa45cff, 0xd9b8ff, 0xffffff, 0xff7ae6, 0xffd36e].map((c) => new THREE.Color(c));
function explotar(centro, escala = 1, colores = COLORES_CHISPA) {
  const N = Math.round((ES_TACTIL ? 500 : 900) * Math.max(escala, 0.4));
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), col = new Float32Array(N * 3), tam = new Float32Array(N);
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    pos.set([centro.x, centro.y, centro.z], i * 3);
    v.randomDirection().multiplyScalar((6 + Math.random() * 26) * escala);
    v.y += 4 * escala;
    vel.set([v.x, v.y, v.z], i * 3);
    const c = colores[(Math.random() * colores.length) | 0];
    col.set([c.r * 3, c.g * 3, c.b * 3], i * 3);
    tam[i] = 2 + Math.random() * 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aTam', new THREE.BufferAttribute(tam, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uVida: { value: 1 }, uPx, uTiempo },
    vertexShader: `
      uniform float uVida, uPx, uTiempo; attribute float aTam; varying vec3 vColor; varying float vParpadeo;
      void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vParpadeo = 0.6 + 0.4 * sin(uTiempo * 25.0 + aTam * 13.0);
        gl_PointSize = aTam * uPx * (40.0 / -mv.z) * (0.4 + uVida * 0.6); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform float uVida; varying vec3 vColor; varying float vParpadeo;
      void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5) discard;
        float estrella = max(0.0, 1.0 - abs(q.x) * abs(q.y) * 60.0) * smoothstep(0.5, 0.0, d);
        float a = (smoothstep(0.5, 0.0, d) * 0.6 + estrella) * uVida * vParpadeo;
        gl_FragColor = vec4(vColor, a); }`,
  });
  const puntos = new THREE.Points(geo, mat);
  puntos.frustumCulled = false;

  const onda = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.2, 64), new THREE.MeshBasicMaterial({ color: 0xc08cff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  onda.position.copy(centro);
  onda.rotation.x = -Math.PI / 2;
  const onda2 = onda.clone();
  onda2.material = onda.material.clone();
  onda2.rotation.set(0, 0, 0);
  const destello = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  destello.position.copy(centro);
  const luz = new THREE.PointLight(0xc9a0ff, 300, 80, 1.5);
  luz.position.copy(centro);
  escena.add(puntos, onda, onda2, destello, luz);
  explosiones.push({ puntos, vel, onda, onda2, destello, luz, t: 0, escala });
}

function actualizarExplosiones(dt) {
  for (let k = explosiones.length - 1; k >= 0; k--) {
    const e = explosiones[k];
    e.t += dt;
    const p = e.puntos.geometry.attributes.position;
    const arr = p.array, v = e.vel;
    const freno = Math.exp(-1.6 * dt);
    for (let i = 0; i < arr.length; i += 3) {
      v[i] *= freno; v[i + 1] = v[i + 1] * freno - 2.5 * dt; v[i + 2] *= freno;
      arr[i] += v[i] * dt; arr[i + 1] += v[i + 1] * dt; arr[i + 2] += v[i + 2] * dt;
    }
    p.needsUpdate = true;
    const vida = Math.max(0, 1 - e.t / 3.2);
    e.puntos.material.uniforms.uVida.value = vida;
    const s = 1 + e.t * 45 * e.escala;
    e.onda.scale.setScalar(s);
    e.onda.material.color.setRGB(0.75, 0.55, 1).multiplyScalar(Math.max(0, 1 - e.t / 1.1) * 3);
    e.onda2.scale.setScalar(s * 0.6);
    e.onda2.lookAt(camara.position);
    e.onda2.material.color.setRGB(0.9, 0.7, 1).multiplyScalar(Math.max(0, 1 - e.t / 0.8) * 3);
    e.destello.scale.setScalar((2 + e.t * 22) * e.escala);
    e.destello.material.color.setScalar(Math.max(0, 1 - e.t / 0.35) * 2.2);
    e.luz.intensity = 300 * e.escala * Math.max(0, 1 - e.t / 1.2);
    if (e.t > 3.3) {
      [e.puntos, e.onda, e.onda2, e.destello, e.luz].forEach((o) => { escena.remove(o); o.geometry?.dispose(); o.material?.dispose(); });
      explosiones.splice(k, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Trivia de Tierra Lila (preguntas a partir de «División de Tabasco»)
// ---------------------------------------------------------------------------
const SUBREGIONES = ['Centro', 'Chontalpa', 'Sierra', 'Pantanos', 'Los Ríos'];
const MUNICIPIOS = {
  Centro: ['Centro', 'Nacajuca', 'Jalpa de Méndez'],
  Chontalpa: ['Huimanguillo', 'Cárdenas', 'Comalcalco', 'Paraíso', 'Cunduacán'],
  Sierra: ['Teapa', 'Jalapa', 'Tacotalpa'],
  Pantanos: ['Centla', 'Jonuta', 'Macuspana'],
  'Los Ríos': ['Emiliano Zapata', 'Balancán', 'Tenosique'],
};
const PREGUNTAS = [
  { p: '¿Cuántos municipios tiene Tabasco?', r: '17', o: ['12', '15', '21'] },
  { p: '¿En cuántas subregiones productivas se divide Tabasco?', r: 'Cinco', o: ['Tres', 'Cuatro', 'Siete'] },
  { p: '¿En qué subregión está Villahermosa, la capital del estado?', r: 'Centro', o: ['Chontalpa', 'Sierra', 'Los Ríos'] },
  { p: '¿Cuál es la subregión más montañosa y la más lluviosa?', r: 'Sierra', o: ['Pantanos', 'Centro', 'Chontalpa'] },
  { p: '¿Cuál es la ciudad más importante de la subregión Sierra?', r: 'Teapa', o: ['Tacotalpa', 'Jalapa', 'Macuspana'] },
  { p: '¿De dónde viene el nombre de la Chontalpa?', r: 'Del grupo étnico chontal', o: ['De un río', 'De un volcán', 'De una fruta'] },
  { p: '¿Cuál es la ciudad más importante de la Chontalpa?', r: 'Heroica Cárdenas', o: ['Comalcalco', 'Paraíso', 'Huimanguillo'] },
  { p: '¿En qué subregión se unen los ríos Grijalva y Usumacinta?', r: 'Pantanos', o: ['Sierra', 'Centro', 'Chontalpa'] },
  { p: '¿Cuál es la ciudad más importante de la subregión Pantanos?', r: 'Macuspana', o: ['Jonuta', 'Centla', 'Teapa'] },
  { p: '¿Cuál es el río más caudaloso de México, que cruza la subregión Los Ríos?', r: 'Usumacinta', o: ['Grijalva', 'San Pedro Mártir', 'Papaloapan'] },
  { p: '¿Cuál es la ciudad más importante de la subregión Los Ríos?', r: 'Tenosique', o: ['Balancán', 'Emiliano Zapata', 'Jonuta'] },
  { p: '¿Qué subregión limita con Campeche y con Guatemala?', r: 'Los Ríos', o: ['Sierra', 'Chontalpa', 'Centro'] },
  { p: '¿Qué subregión está al sur, en el límite con Chiapas?', r: 'Sierra', o: ['Pantanos', 'Chontalpa', 'Los Ríos'] },
  { p: '¿Qué subregión está en la parte más occidental del estado?', r: 'Chontalpa', o: ['Los Ríos', 'Sierra', 'Centro'] },
  { p: '¿Qué subregión está en la parte más oriental del estado?', r: 'Los Ríos', o: ['Chontalpa', 'Centro', 'Pantanos'] },
  { p: '¿Cuántos municipios forman la Chontalpa?', r: 'Cinco', o: ['Tres', 'Cuatro', 'Dos'] },
  { p: 'Además del Usumacinta, ¿qué río cruza la subregión Los Ríos?', r: 'San Pedro Mártir', o: ['Grijalva', 'Mezcalapa', 'Papaloapan'] },
  { p: '¿Por qué la subregión Pantanos tiene marismas y lagunas?', r: 'Su relieve es plano y el agua se estanca', o: ['Porque es muy montañosa', 'Porque está junto al desierto', 'Porque casi no llueve'] },
  { p: '¿Cuál de estos municipios NO pertenece a la Sierra?', r: 'Macuspana', o: ['Teapa', 'Jalapa', 'Tacotalpa'] },
  { p: '¿Cuál de estos municipios NO pertenece a la Chontalpa?', r: 'Nacajuca', o: ['Comalcalco', 'Paraíso', 'Cunduacán'] },
];
// y una pregunta por municipio: «¿A qué subregión pertenece…?»
for (const [region, lista] of Object.entries(MUNICIPIOS)) {
  for (const m of lista) {
    if (m === 'Centro') continue;
    PREGUNTAS.push({ p: `¿A qué subregión pertenece el municipio de ${m}?`, r: region, o: SUBREGIONES.filter((s) => s !== region).sort(() => Math.random() - 0.5).slice(0, 3) });
  }
}
let mazo = [];
function sacarPregunta() {
  if (!mazo.length) mazo = [...PREGUNTAS].sort(() => Math.random() - 0.5);
  return mazo.pop();
}

let triviaAbierta = null;
function abrirTrivia(logo) {
  const q = sacarPregunta();
  triviaAbierta = { logo, q, respondida: false };
  jugador.quieto = true;
  jugador.vel = 0;
  const premio = PREMIOS[logo.fruta];
  $('triviaPremio').textContent = `${premio.emoji} Gana un ${premio.nombre.toLowerCase()}`;
  $('triviaPregunta').textContent = q.p;
  $('triviaNota').textContent = '';
  const caja = $('triviaOpciones');
  caja.innerHTML = '';
  [q.r, ...q.o].sort(() => Math.random() - 0.5).forEach((texto, i) => {
    const b = document.createElement('button');
    b.className = 'opcion';
    b.innerHTML = `<kbd>${i + 1}</kbd><span></span>`;
    b.querySelector('span').textContent = texto;
    b.addEventListener('click', () => responder(b, texto));
    caja.appendChild(b);
  });
  $('trivia').classList.remove('oculta');
  sonidos.pregunta();
}
addEventListener('keydown', (e) => {
  if (!triviaAbierta || triviaAbierta.respondida) return;
  const n = Number(e.key);
  const b = $('triviaOpciones').children[n - 1];
  if (b) b.click();
});

function responder(boton, texto) {
  const t = triviaAbierta;
  if (!t || t.respondida) return;
  t.respondida = true;
  const bien = texto === t.q.r;
  [...$('triviaOpciones').children].forEach((b) => {
    b.disabled = true;
    if (b.querySelector('span').textContent === t.q.r) b.classList.add('correcta');
  });
  if (!bien) boton.classList.add('incorrecta');
  $('triviaNota').textContent = bien
    ? `¡Correcto! Ganaste un ${PREMIOS[t.logo.fruta].nombre.toLowerCase()} ${PREMIOS[t.logo.fruta].emoji}`
    : `Casi… la respuesta es «${t.q.r}». Sal del círculo y vuelve a intentarlo.`;
  bien ? sonidos.acierto() : sonidos.error();
  setTimeout(() => {
    $('trivia').classList.add('oculta');
    jugador.quieto = false;
    triviaAbierta = null;
    if (bien) activarLogo(t.logo);
    else t.logo.estado = 'esperando';
  }, bien ? 1500 : 2600);
}

// ---------------------------------------------------------------------------
// La mariposa narra la historia de Tabasco mientras vuelas
// ---------------------------------------------------------------------------
const HISTORIA = [
  ['¡Hola! Soy Lila, la mariposa de Tierra Lila y Vórtice VR.',
    'Mientras vuelas conmigo te cuento un secreto de esta tierra.',
    'Tabasco tiene 17 municipios agrupados en cinco subregiones.',
    'Se llaman Centro, Chontalpa, Sierra, Pantanos y Los Ríos.',
    'Escúchame bien: en los logos de Tierra Lila te harán preguntas.'],
  ['En la subregión Centro late el corazón del estado.',
    'Ahí está Villahermosa, la capital, con los poderes del estado.',
    'La forman tres municipios: Centro, Nacajuca y Jalpa de Méndez.',
    'Su nombre habla de su lugar en el mapa… y de su importancia.'],
  ['Ahora volemos al oeste, a la Chontalpa.',
    'Su nombre viene del pueblo chontal, que vive ahí desde antes de los españoles.',
    'Sus municipios son Huimanguillo, Cárdenas, Comalcalco, Paraíso y Cunduacán.',
    'Su ciudad más importante es Heroica Cárdenas.'],
  ['Mira al sur: ahí se levanta la Sierra.',
    'Es la zona más montañosa y la más lluviosa de Tabasco.',
    'Llega hasta el límite con Chiapas.',
    'La forman Teapa, Jalapa y Tacotalpa. Teapa es su ciudad más importante.'],
  ['Bajemos a los Pantanos, donde el agua se queda a descansar.',
    'Aquí se unen los ríos Grijalva y Usumacinta.',
    'El suelo es tan plano que se forman marismas, lagunas y pantanos.',
    'Sus municipios son Centla, Jonuta y Macuspana, su ciudad más importante.'],
  ['Por último, al este, la subregión Los Ríos.',
    'Limita con Campeche y con Guatemala.',
    'La cruza el Usumacinta, el río más caudaloso del país, y el San Pedro Mártir.',
    'La forman Emiliano Zapata, Balancán y Tenosique, su ciudad más importante.'],
];
const narrador = (() => {
  let capitulo = 0, temporizadores = [];
  const caja = $('narracion'), texto = $('narracionTexto');
  const voz = () => {
    const voces = speechSynthesis.getVoices();
    return voces.find((v) => /es[-_]MX/i.test(v.lang)) || voces.find((v) => /^es/i.test(v.lang));
  };
  function decir(frase) {
    texto.textContent = frase;
    caja.classList.remove('nueva');
    void caja.offsetWidth;
    caja.classList.add('on', 'nueva');
    if (!sonidos.silencio && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(frase);
      const v = voz();
      if (v) u.voice = v;
      u.lang = v?.lang || 'es-MX';
      u.rate = 1.02;
      u.pitch = 1.35;
      speechSynthesis.speak(u);
    }
  }
  return {
    contar() {
      this.callar();
      const lineas = HISTORIA[capitulo % HISTORIA.length];
      capitulo++;
      const paso = (TIEMPO_MARIPOSA - 2) / lineas.length;
      lineas.forEach((l, i) => temporizadores.push(setTimeout(() => decir(l), 600 + i * paso * 1000)));
    },
    callar() {
      temporizadores.forEach(clearTimeout);
      temporizadores = [];
      caja.classList.remove('on');
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    },
    reiniciar() { capitulo = 0; this.callar(); },
  };
})();

// ---------------------------------------------------------------------------
// Partida
// ---------------------------------------------------------------------------
const cosecha = { coco: 0, platano: 0, pina: 0 };
let jugando = false;
const totalCosecha = () => cosecha.coco + cosecha.platano + cosecha.pina;

function clarosLibres(lejosDe, minimo) {
  return claros.filter((c) => !logos.some((l) => Math.hypot(l.g.position.x - c.x, l.g.position.z - c.z) < 5) &&
    (!lejosDe || Math.hypot(c.x - lejosDe.x, c.z - lejosDe.z) > minimo));
}

function nuevaPartida() {
  logos.splice(0).forEach(quitarLogo);
  FRUTAS.forEach((f) => (cosecha[f] = 0));
  mazo = [];
  narrador.reiniciar();
  if (jugador.modo === 'mariposa') { jugador.modo = 'nina'; jugador.pivote.visible = false; $('reloj').classList.remove('on'); }
  nina.pivote.visible = true;
  const elegidos = [...claros].sort(() => Math.random() - 0.5).slice(0, TOTAL_LILA + TOTAL_VORTICE);
  elegidos.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  // el más cercano al inicio es de Vórtice VR, para descubrir la transformación
  const vortice = [elegidos.shift()];
  // el resto de Vórtice VR, repartidos entre los demás
  for (let i = 0; i < TOTAL_VORTICE - 1; i++) vortice.push(elegidos.splice(Math.floor(((i + 1) / TOTAL_VORTICE) * elegidos.length), 1)[0]);
  vortice.forEach((c) => crearLogo(c.x, c.z, 'vortice'));
  const frutas = FRUTAS.flatMap((f) => Array(POR_FRUTA).fill(f)).sort(() => Math.random() - 0.5);
  elegidos.forEach((c, i) => crearLogo(c.x, c.z, 'lila', frutas[i]));
  jugador.pos.set(0, alturaEn(0, 0), 0);
  jugador.rumbo = Math.atan2(vortice[0].x, vortice[0].z);
  jugador.vel = jugador.vy = jugador.vGiro = 0;
  jugador.quieto = false;
  actualizarContador();
}

function actualizarContador() {
  for (const f of FRUTAS) $(`cuenta-${f}`).textContent = `${cosecha[f]}/${POR_FRUTA}`;
}

// Un logo de Vórtice VR usado vuelve a aparecer en otro claro, lejos del jugador
function reaparecerVortice() {
  const libres = clarosLibres(jugador.pos, 70);
  if (!libres.length) return;
  const c = libres[(Math.random() * libres.length) | 0];
  crearLogo(c.x, c.z, 'vortice');
}

const DURACION_CARGA = 1.7;
const COLORES_LILA = [0x7fe08a, 0xd9b8ff, 0xffffff, 0xffe08a, 0xb98cf0].map((c) => new THREE.Color(c));

function activarLogo(l) {
  l.estado = 'cargando'; l.t = 0;
  focoMagia = l.g.position.clone().setY(l.g.position.y + ALTO_LOGO);
  sonidos.carga();
}

function actualizarLogos(dt) {
  for (let k = logos.length - 1; k >= 0; k--) {
    const l = logos[k];
    l.t += dt;
    const fl = l.flotante;
    const dx = jugador.pos.x - l.g.position.x, dz = jugador.pos.z - l.g.position.z;
    const dentro = Math.hypot(dx, dz) < 6 && jugador.pos.y - l.g.position.y < ALTO_LOGO + 5;
    if (l.premio && l.estado !== 'premio') {
      l.premio.rotation.y += dt * 1.2;
      l.premio.position.y = 2.2 + Math.sin(uTiempo.value * 1.8 + l.fase) * 0.25;
    }
    if (l.estado === 'flotando' || l.estado === 'esperando') {
      fl.position.y = ALTO_LOGO + Math.sin(uTiempo.value * 1.2 + l.fase) * 0.6;
      if (l.tipo === 'vortice') l.simbolo.rotation.y += dt * 0.9;
      l.resplandor.material.opacity = 0.45 + Math.sin(uTiempo.value * 2 + l.fase) * 0.12;
      if (l.estado === 'esperando') { if (Math.hypot(dx, dz) > 8) l.estado = 'flotando'; continue; }
      if (jugando && !jugador.quieto && dentro) {
        if (l.tipo === 'vortice') {
          activarLogo(l);
          avisar(jugador.modo === 'mariposa' ? '✨ ¡Más tiempo de mariposa!' : '✨ ¡Vórtice VR! Prepárate para volar', 1800);
        } else {
          l.estado = 'pregunta';
          abrirTrivia(l);
        }
      }
    } else if (l.estado === 'cargando') {
      const c = Math.min(1, l.t / DURACION_CARGA);
      const e = c * c;
      if (l.tipo === 'vortice') l.simbolo.rotation.y += dt * (0.9 + e * 28);
      fl.scale.setScalar(1 + e * 0.45 + Math.sin(l.t * 40) * 0.03 * e);
      l.simbolo.material.color.setScalar(1.1 + e * 4);
      l.texto.material.color.setScalar(1.2 + e * 3);
      l.resplandor.scale.setScalar(13 + e * 12);
      l.resplandor.material.opacity = 0.55 + e * 0.3;
      l.luz.intensity = 30 + e * 150;
      l.orbita.material.uniforms.uCarga.value = e;
      l.hotspot.material.uniforms.uOpacidad.value = 1 + e;
      sacudida = Math.max(sacudida, e * 0.35);
      if (c >= 1) {
        l.estado = 'desvaneciendo'; l.t = 0;
        fl.visible = false;
        explotar(l.g.position.clone().add(fl.position), 1, l.tipo === 'lila' ? COLORES_LILA : COLORES_CHISPA);
        sonidos.explosion();
        sacudida = 1;
        setTimeout(() => (focoMagia = null), 1600);
        if (l.tipo === 'vortice') {
          setTimeout(() => (jugador.modo === 'mariposa' ? recargarMariposa() : convertir('mariposa')), 700);
          setTimeout(reaparecerVortice, 20000);
        } else {
          l.estado = 'premio';
        }
      }
    } else if (l.estado === 'premio') {
      // la fruta sube girando hacia el jugador y se guarda en la canasta
      const p = l.premio, f = Math.min(1, l.t / 1.4);
      p.rotation.y += dt * (3 + f * 12);
      p.position.lerp(new THREE.Vector3(dx, jugador.pos.y - l.g.position.y + 2.5, dz), f * f * 0.25);
      p.scale.setScalar(1 - f * f * 0.9);
      const desvanecer = Math.max(0, 1 - l.t / 1.6);
      l.hotspot.material.uniforms.uOpacidad.value = desvanecer;
      l.orbita.material.uniforms.uOpacidad.value = desvanecer;
      if (f >= 1) {
        cosecha[l.fruta]++;
        actualizarContador();
        const chip = $(`cuenta-${l.fruta}`).parentElement;
        chip.classList.remove('gano'); void chip.offsetWidth; chip.classList.add('gano');
        sonidos.fruta();
        const faltan = TOTAL_LILA - totalCosecha();
        avisar(faltan ? `${PREMIOS[l.fruta].emoji} ¡A la canasta! Te faltan ${faltan}` : '¡Canasta completa!', 2400);
        if (!faltan) setTimeout(terminar, 2600);
        quitarLogo(l); logos.splice(k, 1);
      }
    } else if (l.estado === 'desvaneciendo') {
      const f = Math.max(0, 1 - l.t / 1.6);
      l.hotspot.material.uniforms.uOpacidad.value = f;
      l.haz.material.uniforms.uOpacidad.value = f;
      l.orbita.material.uniforms.uOpacidad.value = f;
      if (l.t > 1.7) { quitarLogo(l); logos.splice(k, 1); }
    }
  }
}

function recargarMariposa() {
  jugador.tiempo = TIEMPO_MARIPOSA;
  explotar(jugador.pos.clone(), 0.35);
  narrador.contar();
}

// Brújula hacia el logo de Tierra Lila más cercano
const flecha = $('flecha'), textoDistancia = $('distancia');
function actualizarBrujula() {
  let mejor = null, dist = Infinity;
  for (const l of logos) {
    if (l.tipo !== 'lila' || (l.estado !== 'flotando' && l.estado !== 'esperando')) continue;
    const d = Math.hypot(l.g.position.x - jugador.pos.x, l.g.position.z - jugador.pos.z);
    if (d < dist) { dist = d; mejor = l; }
  }
  if (!mejor) { textoDistancia.textContent = '—'; flecha.style.opacity = 0.3; return; }
  flecha.style.opacity = 1;
  const ang = Math.atan2(mejor.g.position.x - jugador.pos.x, mejor.g.position.z - jugador.pos.z) - jugador.rumbo;
  flecha.style.transform = `rotate(${-ang}rad)`;
  textoDistancia.textContent = `${PREMIOS[mejor.fruta].emoji} ${Math.round(dist)} m`;
}

let temporizadorAviso;
function avisar(texto, ms) {
  const a = $('aviso');
  if (a.textContent === texto && a.classList.contains('on')) return;
  a.textContent = texto;
  a.classList.add('on');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => a.classList.remove('on'), ms);
}

function terminar() {
  jugando = false;
  narrador.callar();
  $('final').classList.remove('oculta');
}

// ---------------------------------------------------------------------------
// Sonido sintetizado (selva, campanitas y explosión mágica)
// ---------------------------------------------------------------------------
const sonidos = (() => {
  let ctx, salida, silencio = false;
  function iniciar() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    salida = ctx.createGain();
    salida.gain.value = 0.8;
    salida.connect(ctx.destination);
    // viento suave
    const ruido = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = ruido.getChannelData(0);
    let ultimo = 0;
    for (let i = 0; i < d.length; i++) { ultimo = (ultimo + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = ultimo * 3.5; }
    const fuente = ctx.createBufferSource();
    fuente.buffer = ruido; fuente.loop = true;
    const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 500;
    const vol = ctx.createGain(); vol.gain.value = 0.18;
    fuente.connect(filtro).connect(vol).connect(salida);
    fuente.start();
    pajaro();
  }
  function pajaro() {
    setTimeout(pajaro, 2500 + Math.random() * 5000);
    if (!ctx || silencio) return;
    const t0 = ctx.currentTime, base = 1800 + Math.random() * 1800, veces = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < veces; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + i * 0.16;
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), t + 0.08);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(salida); o.start(t); o.stop(t + 0.14);
    }
  }
  function tono(freq, t, dur, vol, tipo = 'sine') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(salida); o.start(t); o.stop(t + dur + 0.05);
  }
  return {
    iniciar,
    get silencio() { return silencio; },
    salto() { if (ctx) tono(520, ctx.currentTime, 0.18, 0.05, 'triangle'); },
    transformar(aMariposa) {
      if (!ctx) return;
      const t = ctx.currentTime, notas = [659, 784, 988, 1319, 1568, 1976];
      (aMariposa ? notas : [...notas].reverse()).forEach((f, i) => tono(f, t + i * 0.07, 0.6, 0.06));
    },
    pregunta() { if (ctx) [784, 1047].forEach((f, i) => tono(f, ctx.currentTime + i * 0.12, 0.3, 0.06, 'triangle')); },
    acierto() { if (ctx) [784, 988, 1175, 1568].forEach((f, i) => tono(f, ctx.currentTime + i * 0.09, 0.45, 0.07, 'triangle')); },
    error() { if (ctx) [330, 262].forEach((f, i) => tono(f, ctx.currentTime + i * 0.18, 0.35, 0.06, 'square')); },
    fruta() { if (ctx) [1047, 1319, 1568, 2093].forEach((f, i) => tono(f, ctx.currentTime + i * 0.05, 0.3, 0.05)); },
    alternar() { silencio = !silencio; if (salida) salida.gain.value = silencio ? 0 : 0.8; return silencio; },
    carga() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [523, 659, 784, 988, 1175, 1319, 1568, 1976].forEach((f, i) => tono(f, t + i * 0.19, 0.5, 0.08, 'triangle'));
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + DURACION_CARGA);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + DURACION_CARGA); g.gain.linearRampToValueAtTime(0, t + DURACION_CARGA + 0.05);
      o.connect(f).connect(g).connect(salida); o.start(t); o.stop(t + DURACION_CARGA + 0.1);
    },
    explosion() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const b = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const s = ctx.createBufferSource(); s.buffer = b;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(4000, t); f.frequency.exponentialRampToValueAtTime(200, t + 1.2);
      const g = ctx.createGain(); g.gain.value = 0.5;
      s.connect(f).connect(g).connect(salida); s.start(t);
      [1047, 1319, 1568, 2093, 2637].forEach((fr, i) => tono(fr, t + 0.05 + i * 0.06, 2.2, 0.07));
      for (let i = 0; i < 14; i++) tono(2000 + Math.random() * 3000, t + 0.2 + Math.random() * 1.4, 0.25, 0.03);
    },
  };
})();

$('sonido').addEventListener('click', () => {
  const callado = sonidos.alternar();
  $('sonido').textContent = callado ? '🔇' : '🔊';
  if (callado && 'speechSynthesis' in window) speechSynthesis.cancel();
});

// ---------------------------------------------------------------------------
// Bucle
// ---------------------------------------------------------------------------
const reloj = new THREE.Clock();
function cuadro() {
  const dt = Math.min(reloj.getDelta(), 0.05);
  uTiempo.value += dt;
  if (jugando) { moverJugador(dt); actualizarTiempoMariposa(dt); }
  else { nina.mezclador.update(dt); jugador.rumbo += dt * 0.15; nina.pivote.position.copy(jugador.pos); nina.pivote.rotation.y = jugador.rumbo; }
  moverCamara(dt);
  moverCompaneras(dt);
  actualizarLogos(dt);
  actualizarExplosiones(dt);
  actualizarBrujula();
  uCentro.value.copy(jugador.pos);
  revisarTamano();
  composer.render();
  requestAnimationFrame(cuadro);
}

// Ajusta el tamaño cuando cambia la ventana (también si la página arrancó oculta, con tamaño 0)
const tamano = new THREE.Vector2();
function revisarTamano() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h || (renderer.getSize(tamano).x === w && tamano.y === h)) return;
  camara.aspect = w / h;
  camara.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  uPx.value = renderer.getPixelRatio();
}

nuevaPartida();
moverCamara(0, true);
cuadro();

const botonComenzar = $('comenzar');
botonComenzar.disabled = false;
botonComenzar.textContent = 'Entrar a la selva 🌿';
botonComenzar.addEventListener('click', () => {
  sonidos.iniciar();
  $('inicio').classList.add('oculta');
  $('hud').classList.add('on');
  jugando = true;
  setTimeout(() => ($('ayuda').style.opacity = 0), 12000);
  avisar('Busca el logo de Vórtice VR para volverte mariposa 🦋', 3500);
});
$('otraVez').addEventListener('click', () => {
  $('final').classList.add('oculta');
  nuevaPartida();
  jugando = true;
});

// para depurar desde la consola
window.selva = { jugador, nina, logos, camara, escena, renderer, composer, bloom, cosecha, convertir, abrirTrivia };
