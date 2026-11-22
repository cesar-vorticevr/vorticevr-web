// Weedland Hacienda: escena 3D (three.js). Hacienda wellness a la hora dorada: patio central con fuente y
// pantalla monumental, 4 claustros de marcas con portales, casas de marca, mercado-botica, invernadero,
// selva alrededor, paseo en globo y descenso a un cenote.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PABELLONES, catalogo } from "./datos.js";
import { PUESTOS } from "./cultivo.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mediosDe, dibujarEn, tieneMedios } from "./medios.js";
import { plantilla, copia, instancias, listaModelos } from "./modelos.js";
import { perfilDe } from "./gente.js";
import { crearFlora, PALETAS, cascada, matCascada } from "./jardin.js";

const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ligero = innerWidth < 760 || matchMedia("(pointer: coarse)").matches; // celular: menos selva y luces
// Medidas: patio central, claustros (12 stands en círculo) y módulos exteriores (casas de marca, mercado, invernadero)
const R_PLAZA = 15, R_PAB = 24, D_PAB = 48, R_ANILLO = 18, D_EXT = 92, R_ISLA = 17;
const R_MUNDO = 111; // hasta dónde se puede caminar (adentro de la albarrada)
const R_ARCOS = 22.6, R_MURO = 26; // portales de cada claustro: arquería y muro del fondo
const FUENTE = "'Cinzel', 'Cormorant Garamond', Georgia, serif";
const ORO = "#c9a25a", CREMA = "#f3ead8", CAFE = "#2b2016";
const rad = (g) => (g * Math.PI) / 180;

// ---------- utilidades de canvas ----------
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// Canvas para texturas. Se dibuja siempre en medidas "lógicas" (w × h) y "s" reduce la resolución real (memoria).
function texCanvas(w, h, s = 1) {
  const c = document.createElement("canvas"); c.width = Math.round(w * s); c.height = Math.round(h * s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const g = c.getContext("2d"); g.scale(s, s);
  return { c, g, t, wl: w, hl: h };
}
function ajustar(g, texto, max, tam, peso = 700) {
  let s = tam;
  do { g.font = `${peso} ${s}px ${FUENTE}`; s -= 2; } while (g.measureText(texto).width > max && s > 10);
}
function mezclar(hex, a, b = "#000000") {
  const c1 = new THREE.Color(hex), c2 = new THREE.Color(b);
  return "#" + c1.lerp(c2, a).getHexString();
}

// Pantalla principal del stand: 3 "diapositivas" que rotan
function dibujarPantalla(g, w, h, m, slide, productos) {
  const fondo = g.createLinearGradient(0, 0, w, h);
  fondo.addColorStop(0, m.color2); fondo.addColorStop(1, "#140d08");
  g.fillStyle = fondo; g.fillRect(0, 0, w, h);
  const brillo = g.createRadialGradient(w * 0.78, h * 0.45, 10, w * 0.78, h * 0.45, h * 0.7);
  brillo.addColorStop(0, m.color + "aa"); brillo.addColorStop(1, m.color + "00");
  g.fillStyle = brillo; g.fillRect(0, 0, w, h);
  g.textBaseline = "middle"; g.textAlign = "left";
  if (slide === 0) {
    g.font = `${h * 0.42}px serif`; g.textAlign = "center"; g.fillText(m.icono, w * 0.78, h * 0.47);
    g.textAlign = "left"; g.fillStyle = "#fff"; ajustar(g, m.nombre, w * 0.56, 92);
    g.fillText(m.nombre, 56, h * 0.36);
    g.fillStyle = m.color; ajustar(g, m.lema, w * 0.56, 40, 600); g.fillText(m.lema, 58, h * 0.52);
    g.fillStyle = "rgba(255,255,255,.85)"; rr(g, 56, h * 0.66, 300, 64, 32); g.fill();
    g.fillStyle = m.color2; g.font = `700 30px ${FUENTE}`; g.fillText("▶  Toca para entrar", 84, h * 0.66 + 33);
  } else if (slide === 1) {
    const p = productos[Math.floor(Math.random() * Math.min(productos.length, 12))] || { icono: m.icono, nombre: m.nombre, precio: "" };
    g.fillStyle = "rgba(255,255,255,.1)"; rr(g, w * 0.58, h * 0.12, w * 0.36, h * 0.76, 40); g.fill();
    g.font = `${h * 0.36}px serif`; g.textAlign = "center"; g.fillText(p.icono, w * 0.76, h * 0.5);
    g.textAlign = "left"; g.fillStyle = m.color; g.font = `700 34px ${FUENTE}`; g.fillText("DESTACADO", 58, h * 0.22);
    g.fillStyle = "#fff"; ajustar(g, p.nombre, w * 0.5, 64); g.fillText(p.nombre, 56, h * 0.4);
    g.fillStyle = "rgba(255,255,255,.75)"; g.font = `600 36px ${FUENTE}`; g.fillText(p.precio + "  · precio de referencia", 58, h * 0.55);
    g.fillStyle = "#fff"; g.font = `600 30px ${FUENTE}`; g.fillText(`Catálogo: ${productos.length} productos`, 58, h * 0.74);
  } else {
    g.textAlign = "center";
    g.fillStyle = "#e3c27a"; g.font = `700 40px ${FUENTE}`; g.fillText("CANJEA TUS ESTRELLAS", w / 2, h * 0.2);
    g.fillStyle = "#fff"; ajustar(g, m.cupon.texto, w * 0.86, 84); g.fillText(m.cupon.texto, w / 2, h * 0.44);
    g.fillStyle = m.color; g.font = `700 44px ${FUENTE}`; g.fillText(`por ${m.cupon.costo} 🌟 en ${m.nombre}`, w / 2, h * 0.64);
    g.fillStyle = "rgba(255,255,255,.6)"; g.font = `600 26px ${FUENTE}`; g.fillText("Sujeto a los términos de la marca y a la ley de tu país", w / 2, h * 0.84);
  }
  marcoOro(g, w, h);
}
// marco dorado doble con esquinas (como las grecas de la presentación)
function marcoOro(g, w, h, k = 1) {
  g.strokeStyle = "#c9a25a"; g.lineWidth = 8 * k; g.strokeRect(4 * k, 4 * k, w - 8 * k, h - 8 * k);
  g.lineWidth = 2 * k; g.strokeRect(18 * k, 18 * k, w - 36 * k, h - 36 * k);
  g.fillStyle = "#c9a25a";
  [[18, 18], [w / k - 18, 18], [18, h / k - 18], [w / k - 18, h / k - 18]].forEach(([x, y]) => { g.save(); g.translate(x * k, y * k); g.rotate(Math.PI / 4); g.fillRect(-7 * k, -7 * k, 14 * k, 14 * k); g.restore(); });
}

// "Video" de las pantallas extra (simulado): escenas que cambian con barra de avance
function dibujarVideo(g, w, h, m, k, avance, productos) {
  const escena = Math.floor(avance * 3), local = (avance * 3) % 1;
  const f = g.createLinearGradient(0, 0, w, h);
  f.addColorStop(0, k % 2 ? m.color2 : "#1d140d"); f.addColorStop(1, k % 2 ? "#140d08" : m.color2);
  g.fillStyle = f; g.fillRect(0, 0, w, h);
  const cx = w * (0.3 + 0.4 * local), b = g.createRadialGradient(cx, h * 0.45, 10, cx, h * 0.45, h * 0.8);
  b.addColorStop(0, m.color + "99"); b.addColorStop(1, m.color + "00"); g.fillStyle = b; g.fillRect(0, 0, w, h);
  const p = productos[(k * 4 + escena) % Math.max(1, productos.length)] || { icono: m.icono, nombre: m.nombre };
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `${h * (0.4 + local * 0.08)}px serif`; g.fillText(escena === 2 ? m.icono : p.icono, w / 2, h * 0.42);
  g.fillStyle = "#fff"; ajustar(g, escena === 2 ? m.nombre : p.nombre, w * 0.85, 64); g.fillText(escena === 2 ? m.nombre : p.nombre, w / 2, h * 0.76);
  g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(0, h - 26, w, 26);
  g.fillStyle = m.color; g.fillRect(0, h - 26, w * avance, 26);
  g.fillStyle = "rgba(0,0,0,.55)"; rr(g, 20, 20, 150, 52, 26); g.fill();
  g.fillStyle = "#f3ead8"; g.font = `700 26px ${FUENTE}`; g.fillText("▶ VIDEO", 95, 47);
  marcoOro(g, w, h);
}

function dibujarLetrero(g, w, h, m) {
  const f = g.createLinearGradient(0, 0, 0, h);
  f.addColorStop(0, mezclar(m.color2, 0.35, "#2b2016")); f.addColorStop(1, mezclar(m.color2, 0.6, "#140d08"));
  g.fillStyle = f; g.fillRect(0, 0, w, h);
  g.fillStyle = m.color; g.fillRect(0, h - 14, w, 14);
  g.strokeStyle = "#c9a25a"; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 34);
  g.fillStyle = "#f3ead8"; g.textAlign = "center"; g.textBaseline = "middle";
  ajustar(g, m.nombre.toUpperCase(), w - 220, 66); const tw = g.measureText(m.nombre.toUpperCase()).width;
  g.fillText(m.nombre.toUpperCase(), w / 2 + 34, h / 2 - 2);
  g.font = "64px serif"; g.fillText(m.icono, w / 2 - tw / 2 - 30, h / 2 - 2);
}

function dibujarTotem(g, w, h, m, p) {
  g.fillStyle = "#140d08"; g.fillRect(0, 0, w, h);
  const f = g.createLinearGradient(0, 0, 0, h);
  f.addColorStop(0, m.color + "55"); f.addColorStop(1, m.color2 + "00");
  g.fillStyle = f; g.fillRect(0, 0, w, h);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `${w * 0.5}px serif`; g.fillText(p.icono, w / 2, h * 0.34);
  g.fillStyle = "#fff"; ajustar(g, p.nombre, w - 24, 30); g.fillText(p.nombre, w / 2, h * 0.64);
  g.fillStyle = m.color; g.font = `700 32px ${FUENTE}`; g.fillText(p.precio, w / 2, h * 0.76);
  g.fillStyle = "rgba(243,234,216,.6)"; g.font = `600 20px ${FUENTE}`; g.fillText(p.cat, w / 2, h * 0.86);
  g.strokeStyle = "#c9a25a"; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.lineWidth = 1.5; g.strokeRect(12, 12, w - 24, h - 24);
}

function dibujarMostrador(g, w, h, m) {
  g.fillStyle = "#efe4cf"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#c9a25a"; g.lineWidth = 5; g.strokeRect(14, 14, w - 28, h - 28);
  g.fillStyle = mezclar(m.color2, 0.2, "#2b2016"); g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `700 ${h * 0.42}px ${FUENTE}`; g.fillText(m.sigla, w / 2, h / 2 + 6);
}

function dibujarBanner(g, w, h, m) {
  const f = g.createLinearGradient(0, 0, w, h);
  f.addColorStop(0, mezclar(m.color, 0.35, "#2b2016")); f.addColorStop(1, "#140d08");
  g.fillStyle = f; rr(g, 0, 0, w, h, 26); g.fill();
  g.strokeStyle = "#c9a25a"; g.lineWidth = 6; rr(g, 3, 3, w - 6, h - 6, 24); g.stroke();
  g.font = `${h * 0.55}px serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(m.icono, h * 0.55, h / 2);
  g.textAlign = "left"; g.fillStyle = "#fff"; g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = 8;
  ajustar(g, m.nombre, w - h * 1.25, 52); g.fillText(m.nombre, h * 1.05, h * 0.3);
  g.font = `600 30px ${FUENTE}`; ajustar(g, m.anuncio, w - h * 1.25, 32, 600); g.fillText(m.anuncio, h * 1.05, h * 0.58);
  g.shadowBlur = 0; g.fillStyle = "rgba(0,0,0,.35)"; rr(g, h * 1.05, h * 0.72, 250, 40, 20); g.fill();
  g.fillStyle = "#fff"; g.font = `700 24px ${FUENTE}`; g.fillText("Toca para visitar ▶", h * 1.05 + 18, h * 0.72 + 21);
}

function dibujarAnuncioGrande(g, w, h, m) {
  dibujarPantalla(g, w, h, m, 0, []);
  g.fillStyle = "rgba(20,13,8,.75)"; g.fillRect(0, h - 70, w, 70);
  g.fillStyle = "#e3c27a"; g.textAlign = "center"; g.font = `700 30px ${FUENTE}`;
  g.fillText(`${m.anuncio}  ·  Claustro ${(PABELLONES.find((p) => p.id === m.pab) || {}).nombre || ""}`, w / 2, h - 34);
}

function spriteEmoji(emoji, tam = 2.4) {
  const { g, t } = texCanvas(256, 256);
  g.font = "190px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(emoji, 128, 140);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(tam, tam, 1);
  return s;
}
function spriteBrillo(color, tam) {
  const { g, t } = texCanvas(128, 128);
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, color); r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.set(tam, tam, 1);
  return s;
}

// ---------- escena ----------
export function crearEstacion(canvas, cfg) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 2500);
  const VISTA_GENERAL = { pos: new THREE.Vector3(0, 125, 175), obj: new THREE.Vector3(0, 0, -8) };
  // En pantallas verticales (celular) la vista general se aleja para que quepa toda la estación
  const posGeneral = () => {
    const a = (canvas.clientWidth || innerWidth) / (canvas.clientHeight || innerHeight);
    const k = a < 1 ? Math.pow(0.95 / a, 0.8) : 1;
    return VISTA_GENERAL.obj.clone().add(VISTA_GENERAL.pos.clone().sub(VISTA_GENERAL.obj).multiplyScalar(k));
  };
  camera.position.copy(posGeneral());

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(VISTA_GENERAL.obj);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 7; controls.maxDistance = 400; controls.maxPolarAngle = 1.42;
  controls.enableZoom = false; controls.enablePan = false; // sin zoom: solo se gira la cámara alrededor del avatar
  controls.rotateSpeed = 0.6;
  controls.autoRotate = false;

  // ---------- Jardín de fantasía al atardecer: cielo rosa y lila, sol bajo, mar de nubes y neblina rosada ----------
  const SOL_DIR = new THREE.Vector3(-0.62, 0.14, -0.76).normalize();
  scene.fog = new THREE.Fog("#eec3c4", 150, 600);
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sol: { value: SOL_DIR } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `uniform vec3 sol; varying vec3 vP;
      void main(){
        float y = vP.y;
        vec3 alto = vec3(0.47,0.45,0.72), medio = vec3(0.93,0.66,0.74), horiz = vec3(1.0,0.84,0.7), abajo = vec3(0.93,0.8,0.82);
        vec3 c = y > 0. ? mix(horiz, mix(medio, alto, smoothstep(0.1, 0.75, y)), smoothstep(0.0, 0.14, y)) : mix(horiz, abajo, smoothstep(0., .25, -y));
        float s = max(0., dot(vP, sol));
        c += vec3(1.0,0.66,0.45) * pow(s, 8.) * 0.55 + vec3(1.,0.97,0.85) * pow(s, 900.) * 1.6;
        gl_FragColor = vec4(c, 1.);
      }`,
  }));
  scene.add(cielo);
  // nubes suaves teñidas de durazno
  {
    const n = texCanvas(256, 128);
    for (let i = 0; i < 14; i++) {
      const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 20 + Math.random() * 34;
      const gr = n.g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,240,225,.55)"); gr.addColorStop(1, "rgba(255,240,225,0)");
      n.g.fillStyle = gr; n.g.fillRect(0, 0, 256, 128);
    }
    for (let i = 0; i < 9; i++) {
      const a = -2.4 + i * 0.6 + Math.random() * 0.3, d = 640 + Math.random() * 180;
      const nube = new THREE.Sprite(new THREE.SpriteMaterial({ map: n.t, transparent: true, depthWrite: false, fog: false, color: i % 3 === 0 ? "#e9c4e6" : i % 2 ? "#ffcfd2" : "#ffe3d6", opacity: 0.8 }));
      nube.position.set(Math.cos(a) * d, 120 + Math.random() * 140, Math.sin(a) * d); nube.scale.set(260 + Math.random() * 160, 80 + Math.random() * 40, 1);
      scene.add(nube);
    }
    const sol = spriteBrillo("#ffd59a", 260); sol.position.copy(SOL_DIR).multiplyScalar(900); sol.material.opacity = 0.9; scene.add(sol);
    // mar de nubes alrededor: la hacienda parece flotar sobre ellas
    for (let i = 0; i < (ligero ? 26 : 44); i++) {
      const a = (i / (ligero ? 26 : 44)) * Math.PI * 2 + Math.random() * 0.2, d = 470 + Math.random() * 160;
      const nube = new THREE.Sprite(new THREE.SpriteMaterial({ map: n.t, transparent: true, depthWrite: false, fog: false, color: i % 3 ? "#fff0ee" : "#f6d4e4", opacity: 0.95 }));
      nube.position.set(Math.cos(a) * d, -6 + Math.random() * 18, Math.sin(a) * d); nube.scale.set(240 + Math.random() * 180, 46 + Math.random() * 30, 1);
      scene.add(nube);
    }
  }

  scene.add(new THREE.HemisphereLight("#ffe4e8", "#7a6a58", 1.1));
  const sol = new THREE.DirectionalLight("#ffc9a0", 2.0); sol.position.copy(SOL_DIR).multiplyScalar(120); scene.add(sol);
  const relleno = new THREE.DirectionalLight("#d7c2ff", 0.5); relleno.position.set(70, 50, 90); scene.add(relleno);
  // reflejos cálidos del propio cielo (para el dorado y el agua)
  {
    const pm = new THREE.PMREMGenerator(renderer), solo = new THREE.Scene();
    solo.add(new THREE.Mesh(cielo.geometry, cielo.material));
    scene.environment = pm.fromScene(solo, 0.04, 0.1, 2500).texture;
  }

  // Materiales: piedra caliza (clara y labrada), madera, follaje y dorado
  const blanco = new THREE.MeshStandardMaterial({ color: "#efe7d8", roughness: 0.9 });
  const gris = new THREE.MeshStandardMaterial({ color: "#d9cdb6", roughness: 0.93 });
  const oscuro = new THREE.MeshStandardMaterial({ color: "#3a291c", roughness: 0.62 });
  const madera = new THREE.MeshStandardMaterial({ color: "#8a6240", roughness: 0.7 });
  const verde = new THREE.MeshStandardMaterial({ color: "#4f7a3a", flatShading: true, roughness: 0.85 });
  const barro = new THREE.MeshStandardMaterial({ color: "#b86a43", roughness: 0.8 });
  const oro = new THREE.MeshStandardMaterial({ color: "#d4ad62", roughness: 0.28, metalness: 0.9 });
  const tela = new THREE.MeshStandardMaterial({ color: "#f6efe2", roughness: 0.95 });
  const neones = {};
  // acentos con el color de cada marca: mate, con un brillo suave (ya no neón)
  const neon = (c) => neones[c] || (neones[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.2, emissive: c, emissiveIntensity: 0.18 }));
  const conMapa = (t) => new THREE.MeshBasicMaterial({ map: t, toneMapped: false });

  const tocables = [];
  const suelos = []; // pisos donde se puede caminar (para tocar y caminar)
  const obst = []; // obstáculos: { c: [x, z, r] } círculos o { caja: objeto3D, x0, x1, z0, z1 } cajas en coordenadas locales
  const claustros = []; // muros con arcos de cada claustro: anillo que no se cruza, salvo por su portón
  const muros = []; // mallas que la cámara no debe atravesar
  const etiquetas = []; // { el, pos }
  const anim = []; // funciones (t, dt)
  const pantallas = []; // pantallas gigantes del patio central

  // ---------- texturas pintadas a mano (canvas) ----------
  function repetir(t, rx, ry) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; }
  // mosaico de pasta yucateco: estrella de 8 puntas en terracota, crema y verde
  function texMosaico(c1 = "#b4683f", c2 = "#efe3cc", c3 = "#5e7a55") {
    const m = texCanvas(256, 256);
    const g = m.g;
    g.fillStyle = c2; g.fillRect(0, 0, 256, 256);
    g.fillStyle = c1;
    [[0, 0], [256, 0], [0, 256], [256, 256]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 58, 0, Math.PI * 2); g.fill(); });
    g.save(); g.translate(128, 128);
    for (let k = 0; k < 2; k++) { g.rotate(Math.PI / 4); g.fillStyle = k ? c3 : c1; g.fillRect(-46, -46, 92, 92); }
    g.restore();
    g.fillStyle = c2; g.beginPath(); g.arc(128, 128, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#c9a25a"; g.beginPath(); g.arc(128, 128, 12, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(60,40,25,.25)"; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256);
    return m.t;
  }
  function texPiedra(base = "#e9e0cd", junta = "rgba(130,115,90,.3)", w = 256) {
    const m = texCanvas(w, w), g = m.g;
    g.fillStyle = base; g.fillRect(0, 0, w, w);
    // poros y manchas de la caliza
    for (let i = 0; i < 1100; i++) { const v = Math.random(); g.fillStyle = v < 0.7 ? `rgba(${110 + Math.random() * 50},${100 + Math.random() * 40},${80 + Math.random() * 30},${Math.random() * 0.08})` : `rgba(255,250,240,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * w, 1 + Math.random() * 5, 1 + Math.random() * 5); }
    g.strokeStyle = junta; g.lineWidth = 2;
    const f = w / 4;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) g.strokeRect(x * w / 2 + (y % 2) * f, y * f, w / 2, f);
    return m.t;
  }
  function texLosas(base = "#ebe2d0", tinte = null) {
    const m = texCanvas(512, 512), g = m.g;
    g.fillStyle = "#cfc2a8"; g.fillRect(0, 0, 512, 512);
    // losas de tamaños distintos en hileras
    let y = 0;
    while (y < 512) {
      const h = 60 + Math.floor(Math.random() * 3) * 22; let x = -Math.random() * 80;
      while (x < 512) {
        const w = 70 + Math.random() * 90, c = new THREE.Color(base).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
        if (tinte && Math.random() < 0.25) c.lerp(new THREE.Color(tinte), 0.18);
        g.fillStyle = "#" + c.getHexString(); g.fillRect(x + 2, y + 2, w - 4, Math.min(h, 512 - y) - 4);
        for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(120,105,80,${Math.random() * 0.08})`; g.fillRect(x + Math.random() * w, y + Math.random() * h, 2 + Math.random() * 4, 2 + Math.random() * 4); }
        x += w;
      }
      y += h;
    }
    return m.t;
  }
  function texPasto() {
    const m = texCanvas(256, 256), g = m.g;
    g.fillStyle = "#6f9650"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { const v = Math.random(); g.fillStyle = v < 0.5 ? `rgba(70,112,56,${0.25 + Math.random() * 0.3})` : `rgba(170,190,100,${Math.random() * 0.25})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 3 + Math.random() * 5); }
    return m.t;
  }
  // hoja de palma con transparencia (se dobla en 3D)
  function texHoja() {
    const m = texCanvas(128, 512), g = m.g;
    g.clearRect(0, 0, 128, 512);
    g.strokeStyle = "#3f6a2e"; g.lineWidth = 5; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 512); g.stroke();
    for (let y = 16; y < 500; y += 11) {
      const l = 58 * Math.sin((y / 512) * Math.PI) + 6;
      g.strokeStyle = y % 22 ? "#4f8137" : "#5d9140"; g.lineWidth = 7;
      g.beginPath(); g.moveTo(64, y); g.lineTo(64 - l, y + 26); g.stroke();
      g.beginPath(); g.moveTo(64, y); g.lineTo(64 + l, y + 26); g.stroke();
    }
    return m.t;
  }

  // ---------- suelo: un solo terreno abierto (pasto), con hueco para el cenote ----------
  const CENOTE = new THREE.Vector3(0, 0, -168);
  {
    const forma = new THREE.Shape(); forma.absarc(0, 0, 900, 0, Math.PI * 2, false);
    const hueco = new THREE.Path(); hueco.absarc(CENOTE.x, CENOTE.z, 10, 0, Math.PI * 2, true); forma.holes.push(hueco);
    const geo = new THREE.ShapeGeometry(forma, 96);
    geo.rotateX(Math.PI / 2); // (x, y) de la forma → (x, z) del mundo
    const suelo = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: repetir(texPasto(), 1, 1), roughness: 0.95, side: THREE.DoubleSide }));
    // UV en metros del mundo (cada 6 m se repite)
    const uv = geo.attributes.uv, p = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 6, p.getZ(i) / 6);
    suelo.position.y = 0.56; suelo.userData.suelo = true; suelos.push(suelo); scene.add(suelo);
  }
  // capa sobre el pasto (sendero, patio): plana, sin pelearse con el suelo
  function capa(geo, mat, y = 0.6) {
    mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
  }
  const matPiedraPiso = new THREE.MeshStandardMaterial({ map: repetir(texPiedra(), 1, 1), roughness: 0.9 });

  // ---------- palmeras (instanciadas: cientos sin trabar el celular) ----------
  const geoTronco = (() => {
    const g = new THREE.CylinderGeometry(0.16, 0.3, 1, 7, 6, false); g.translate(0, 0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.pow(y, 2) * 0.6); }
    g.computeVertexNormals(); return g;
  })();
  const geoCopa = (() => {
    const hojas = [];
    for (let k = 0; k < 11; k++) {
      const h = new THREE.PlaneGeometry(1.1, 4.2, 1, 8); h.translate(0, 2.1, 0);
      const p = h.attributes.position;
      const caida = k < 8 ? 1 : 0.35;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -Math.pow(y / 4.2, 2) * 2.4 * caida); p.setX(i, p.getX(i) * (1 - (y / 4.2) * 0.5)); }
      h.rotateX(-Math.PI / 2 + (k < 8 ? 0.55 : 1.15)); // hacia afuera
      h.rotateY((k / (k < 8 ? 8 : 3)) * Math.PI * 2 + k * 0.3);
      hojas.push(h);
    }
    const g = mergeGeometries(hojas); g.computeVertexNormals(); return g;
  })();
  const matTronco = new THREE.MeshStandardMaterial({ color: "#8b7356", roughness: 0.95 });
  const matCopa = new THREE.MeshStandardMaterial({ map: texHoja(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
  const palmasLista = []; // [x, z, alto, giro, obstaculo?]
  function palma(x, z, alto = 8, choca = true) { palmasLista.push([x, z, alto, Math.random() * Math.PI * 2]); if (choca) obst.push({ c: [x, z, 0.45] }); }
  function plantarPalmas() {
    const n = palmasLista.length, tr = new THREE.InstancedMesh(geoTronco, matTronco, n), co = new THREE.InstancedMesh(geoCopa, matCopa, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    palmasLista.forEach(([x, z, alto, giro], i) => {
      q.setFromEuler(e.set(0, giro, 0));
      m.compose(ps.set(x, 0.56, z), q, sc.set(1, alto, 1)); tr.setMatrixAt(i, m);
      // la punta del tronco se curva: la copa va donde termina
      const dx = Math.cos(giro) * 0.6 * 1, dz = -Math.sin(giro) * 0.6 * 1;
      m.compose(ps.set(x + dx, 0.56 + alto, z + dz), q, sc.setScalar(0.8 + alto / 22)); co.setMatrixAt(i, m);
    });
    scene.add(tr, co);
    plantilla("palma").then((p) => {
      if (!p) return;
      const ms = palmasLista.map(([x, z, alto, giro]) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0.56, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, giro, 0)), new THREE.Vector3(alto, alto, alto)));
      scene.add(instancias(p, ms, { alto: 1 })); tr.visible = co.visible = false;
    });
  }
  // matas bajas (agaves y helechos) instanciadas
  const geoAgave = (() => {
    const ps = [];
    for (let k = 0; k < 9; k++) { const c = new THREE.ConeGeometry(0.13, 1.5, 4); c.translate(0, 0.75, 0); c.rotateZ(0.55 + (k % 3) * 0.15); c.rotateY((k / 9) * Math.PI * 2); ps.push(c); }
    const c = new THREE.ConeGeometry(0.12, 1.4, 4); c.translate(0, 0.7, 0); ps.push(c);
    return mergeGeometries(ps);
  })();
  const matAgave = new THREE.MeshStandardMaterial({ color: "#7aa08c", roughness: 0.6, flatShading: true });
  const matasLista = [];
  function mata(x, z, k = 1) { matasLista.push([x, z, k]); }
  const geoArbusto = new THREE.IcosahedronGeometry(1, 0);
  const matArbusto = new THREE.MeshStandardMaterial({ color: "#3f6331", roughness: 0.9, flatShading: true });
  const arbustosLista = [];
  function plantarMatas() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    const ag = new THREE.InstancedMesh(geoAgave, matAgave, matasLista.length);
    matasLista.forEach(([x, z, k], i) => { m.compose(ps.set(x, 0.56, z), q.setFromEuler(e.set(0, Math.random() * 6, 0)), sc.setScalar(k)); ag.setMatrixAt(i, m); });
    const ar = new THREE.InstancedMesh(geoArbusto, matArbusto, arbustosLista.length);
    arbustosLista.forEach(([x, z, k], i) => { m.compose(ps.set(x, 0.56 + k * 0.4, z), q.setFromEuler(e.set(Math.random(), Math.random() * 6, 0)), sc.set(k * 1.3, k, k * 1.3)); ar.setMatrixAt(i, m); });
    scene.add(ag, ar);
  }

  // ---------- agua (fuentes, estanques y el cenote) ----------
  const matAgua = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, claro: { value: new THREE.Color("#8fd0c4") }, hondo: { value: new THREE.Color("#2f6f73") } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }",
    fragmentShader: `uniform float t; uniform vec3 claro, hondo; varying vec3 vW;
      void main(){
        vec2 p = vW.xz;
        float o = sin(p.x*1.3 + t*1.1) + sin(p.y*1.7 - t*0.9) + sin((p.x+p.y)*0.9 + t*0.7);
        float brillo = pow(max(0., sin(o*1.6)), 8.);
        vec3 c = mix(hondo, claro, 0.45 + 0.12*o) + vec3(1.,0.86,0.6)*brillo*0.35;
        gl_FragColor = vec4(pow(c, vec3(1.0/2.2)), 0.93);
      }`,
    transparent: true,
  });
  anim.push((t) => (matAgua.uniforms.t.value = t));
  // flores, árboles y cascadas del jardín de fantasía (se plantan todas juntas al final)
  const flora = crearFlora(scene, { ligero });
  const matCaida = matCascada();
  anim.push((t) => { if (!quieto) matCaida.uniforms.t.value = t; });


  // ---------- faroles con luz cálida (sin luces reales: un brillo que no cuesta) ----------
  const geoPoste = new THREE.CylinderGeometry(0.07, 0.1, 2.2, 6); geoPoste.translate(0, 1.1, 0);
  const geoLinterna = new THREE.BoxGeometry(0.34, 0.46, 0.34);
  const matLinterna = new THREE.MeshBasicMaterial({ color: "#ffd58a" });
  const farolesLista = [];
  function farol(x, z, choca = true) { farolesLista.push([x, z]); if (choca) obst.push({ c: [x, z, 0.25] }); }
  function encenderFaroles() {
    const n = farolesLista.length, po = new THREE.InstancedMesh(geoPoste, oscuro, n), li = new THREE.InstancedMesh(geoLinterna, matLinterna, n);
    const m = new THREE.Matrix4();
    farolesLista.forEach(([x, z], i) => {
      m.makeTranslation(x, 0.56, z); po.setMatrixAt(i, m);
      m.makeTranslation(x, 2.95, z); li.setMatrixAt(i, m);
      const b = spriteBrillo("#ffcf7a", 1.5); b.position.set(x, 2.95, z); b.material.opacity = 0.55; scene.add(b);
    });
    scene.add(po, li);
    plantilla("farol").then((p) => {
      if (!p) return;
      scene.add(instancias(p, farolesLista.map(([x, z]) => new THREE.Matrix4().makeTranslation(x, 2.7, z)), { alto: 0.75 })); li.visible = false;
    });
  }

  // ---------- patio central: piso de mosaico, fuente, templete con pantalla de 4 caras ----------
  function patio(radio, alto, tex, rep) {
    const g = new THREE.Group();
    const lado = new THREE.MeshStandardMaterial({ map: repetir(texPiedra("#ddd1ba"), radio, 0.3), roughness: 0.9 });
    const arriba = new THREE.MeshStandardMaterial({ map: repetir(tex, rep, rep), roughness: 0.75 });
    const piso = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio + 0.25, 0.5, 72), [lado, arriba, lado]);
    piso.position.y = alto - 0.25; g.add(piso);
    const filo = new THREE.Mesh(new THREE.TorusGeometry(radio - 0.6, 0.06, 6, 96), oro); filo.rotation.x = Math.PI / 2; filo.position.y = alto + 0.01; g.add(filo);
    return g;
  }
  scene.add(patio(R_PLAZA, 0.7, texLosas("#efe7d6", "#f2b8c8"), 6));
  {
    // fuente
    const fuenteG = new THREE.Group(); scene.add(fuenteG);
    const borde = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.7, 40), gris); borde.position.y = 1.0; fuenteG.add(borde);
    const agua = new THREE.Mesh(new THREE.CircleGeometry(3.05, 40), matAgua); agua.rotation.x = -Math.PI / 2; agua.position.y = 1.3; fuenteG.add(agua);
    const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 1.8, 16), gris); pie.position.y = 2.1; fuenteG.add(pie);
    const taza = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.2, 0), new THREE.Vector2(1.3, 0.25), new THREE.Vector2(1.45, 0.45), new THREE.Vector2(1.35, 0.5)], 24), gris);
    taza.position.y = 2.95; fuenteG.add(taza);
    const aguaT = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), matAgua); aguaT.rotation.x = -Math.PI / 2; aguaT.position.y = 3.38; fuenteG.add(aguaT);
    const chorro = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.4, 10, 1, true), new THREE.MeshBasicMaterial({ color: "#e9fbff", transparent: true, opacity: 0.45, depthWrite: false }));
    chorro.position.y = 3.95; fuenteG.add(chorro);
    vestir(fuenteG, "fuente", { ancho: 7.4, y: 0.7 });
    anim.push((t) => { if (!quieto) chorro.scale.y = 1 + Math.sin(t * 5) * 0.08; });
    obst.push({ c: [0, 0, 3.7] });
    for (let k = 0; k < 7; k++) { const a = k * 0.9 + Math.random() * 0.4, r = 1.8 + Math.random() * 0.9; flora.loto(Math.cos(a) * r, 1.3, Math.sin(a) * r); }
    // orilla del patio: flores y lavanda entre senderos
    for (let k = 0; k < 8; k++) for (let a = rad(k * 45 + 9); a < rad(k * 45 + 36); a += 0.06) {
      const x = Math.cos(a) * (R_PLAZA - 1.1), z = Math.sin(a) * (R_PLAZA - 1.1);
      if (k % 2) flora.lavanda(x, z, 1, PALETAS.lavanda, 0.7); else flora.flor(x, z, 1.1, PALETAS.rosa, 0.7);
    }
    // templete: 4 columnas que cargan la pantalla de 4 caras
    const W = 8.4, H = 4.7, C = 4.75;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const x = sx * C, z = sz * C;
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), gris); base.position.set(x, 1.0, z); scene.add(base);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 9.2, 20), blanco); col.position.set(x, 5.9, z); scene.add(col);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.35, 1.15), oro); cap.position.set(x, 10.62, z); scene.add(cap);
      obst.push({ c: [x, z, 0.8] });
    });
    const viga = new THREE.Mesh(new THREE.BoxGeometry(2 * C + 1.3, 0.55, 2 * C + 1.3), blanco); viga.position.y = 10.92; scene.add(viga);
    // buganvilia que sube por las columnas y cuelga de la viga
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      for (let y = 2; y < 10.5; y += 0.9) { const a = Math.random() * 6.3; flora.racimo(sx * C + Math.cos(a) * 0.55, y, sz * C + Math.sin(a) * 0.55, 0.4 + Math.random() * 0.25); }
    });
    for (let i = 0; i < 40; i++) { const lado = i % 4, t = Math.random() * 2 - 1, d = C + 0.6; const x = lado < 2 ? t * d : (lado === 2 ? d : -d), z = lado < 2 ? (lado ? d : -d) : t * d; flora.racimo(x, 10.6 + Math.random() * 0.6, z, 0.5 + Math.random() * 0.4); }
    const filoV = new THREE.Mesh(new THREE.BoxGeometry(2 * C + 1.4, 0.08, 2 * C + 1.4), oro); filoV.position.y = 11.2; scene.add(filoV);
    const caja = new THREE.Group(); caja.position.y = 13.55; scene.add(caja);
    for (let i = 0; i < 4; i++) {
      const tx = texCanvas(1024, 576, 0.75);
      const cara = new THREE.Mesh(new THREE.PlaneGeometry(W, H), conMapa(tx.t));
      const a = (i * Math.PI) / 2;
      cara.position.set(Math.sin(a) * (W / 2 + 0.06), 0, Math.cos(a) * (W / 2 + 0.06)); cara.rotation.y = a;
      cara.userData = { tipo: "pantalla", cara: i };
      caja.add(cara); tocables.push(cara);
      pantallas.push({ tx, cara, i });
    }
    caja.add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, H + 0.3, W + 0.1), oscuro));
    [H / 2 + 0.25, -H / 2 - 0.25].forEach((y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.22, W + 0.5), oro); b.position.y = y; caja.add(b); });
    const cornisa = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 0.5, W + 1.2), blanco); cornisa.position.y = 16.5; scene.add(cornisa);
    const cupula = new THREE.Mesh(new THREE.SphereGeometry(2.6, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), oro); cupula.position.y = 16.75; scene.add(cupula);
    const remate = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), oro); remate.position.y = 19.55; scene.add(remate);
    // Letrero WEEDLAND dorado sobre el templete
    const lt = texCanvas(1024, 200);
    lt.g.textAlign = "center"; lt.g.textBaseline = "middle"; lt.g.font = `700 128px ${FUENTE}`;
    const grad = lt.g.createLinearGradient(0, 30, 0, 170); grad.addColorStop(0, "#fff2cf"); grad.addColorStop(0.55, "#d9b06a"); grad.addColorStop(1, "#9c7232");
    lt.g.shadowColor = "rgba(60,35,10,.55)"; lt.g.shadowBlur = 14; lt.g.shadowOffsetY = 4; lt.g.fillStyle = grad; lt.g.fillText("WEEDLAND", 512, 104);
    const letrero = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt.t, transparent: true, depthWrite: false, fog: false }));
    letrero.scale.set(15, 2.9, 1); letrero.position.y = 22.6; scene.add(letrero);
    const st = texCanvas(1024, 80); st.g.fillStyle = "#fff4dc"; st.g.textAlign = "center"; st.g.font = `600 46px ${FUENTE}`; st.g.shadowColor = "rgba(60,35,10,.6)"; st.g.shadowBlur = 8; st.g.fillText("HACIENDA  ·  WELLNESS  ·  EXPO", 512, 56);
    const sub = new THREE.Sprite(new THREE.SpriteMaterial({ map: st.t, transparent: true, depthWrite: false, fog: false }));
    sub.scale.set(11, 0.86, 1); sub.position.y = 20.8; scene.add(sub);
    // Urnas de piedra con agave y palmas en el borde del patio, entre los senderos
    [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].forEach((ga, k) => {
      if (ga === 157.5) return; // ahí está el globo
      const x = Math.cos(rad(ga)) * 11.6, z = Math.sin(rad(ga)) * 11.6;
      const urna = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.45, 0), new THREE.Vector2(0.6, 0.15), new THREE.Vector2(0.45, 0.5), new THREE.Vector2(0.85, 1.1), new THREE.Vector2(0.9, 1.25)], 18), gris);
      urna.position.set(x, 0.7, z); scene.add(urna);
      obst.push({ c: [x, z, 1] });
      if (k % 2) palma(x, z, 7 + Math.random() * 2, false); else mata(x, z, 0.9);
    });
  }

  // Luciérnagas: puntitos dorados que flotan bajito
  {
    const n = ligero ? 260 : 520, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 120; pos.set([Math.cos(a) * r, 1 + Math.random() * 7, Math.sin(a) * r], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const punto = texCanvas(64, 64); { const r = punto.g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)"); punto.g.fillStyle = r; punto.g.fillRect(0, 0, 64, 64); }
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, map: punto.t, color: "#ffd98a", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(pts);
    anim.push((t) => { if (!quieto) { pts.rotation.y = t * 0.004; pts.position.y = Math.sin(t * 0.5) * 0.3; pts.material.opacity = 0.6 + Math.sin(t * 1.7) * 0.25; } });
  }

  // ----- módulos: patios unidos al patio central por senderos blancos (sacbé) con faroles y palmas -----
  const modulos = {}; // id -> { centro, haciaPlaza, r, d }
  const texSacbe = texPiedra("#f1e7d3", "rgba(150,120,85,.28)");
  function modulo(id, angulo, d, r, color, piso = {}) {
    const a = rad(angulo);
    const centro = new THREE.Vector3(Math.cos(a) * d, 0, -Math.sin(a) * d);
    const rp = piso.radio || r;
    if (piso.tex) { const p = patio(rp, 0.61, piso.tex, piso.rep || rp / 2.4); p.position.copy(centro); scene.add(p); }
    // sendero
    const ini = R_PLAZA - 0.5, fin = d - rp + 0.5, largo = fin - ini, medio = (ini + fin) / 2;
    const ax = Math.cos(a), az = -Math.sin(a);
    const t = texSacbe.clone(); t.needsUpdate = true; repetir(t, largo / 4.4, 1);
    const camino = capa(new THREE.PlaneGeometry(largo, 4.4), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), 0.6);
    camino.position.set(ax * medio, 0.6, az * medio); camino.rotation.z = a; scene.add(camino);
    // faroles a los lados y, en los largos, una avenida de palmas
    const px = -az, pz = ax; // perpendicular
    for (let k = ini + 3; k < fin - 1.5; k += 7) [-1, 1].forEach((s) => farol(ax * k + px * s * 3, az * k + pz * s * 3));
    if (largo > 30) for (let k = ini + 7; k < fin - 4; k += 10) [-1, 1].forEach((s) => {
      const x = ax * k + px * s * 5.2, z = az * k + pz * s * 5.2;
      if (Math.round(k / 10) % 2) { flora.cipres(x, z, 9 + Math.random() * 3); obst.push({ c: [x, z, 0.7] }); } else palma(x, z, 8 + Math.random() * 3);
    });
    // lavanda y flores a la orilla del sendero
    for (let k = ini + 1.5; k < fin - 1; k += ligero ? 2.2 : 1.4) [-1, 1].forEach((s) => {
      const x = ax * k + px * s * 3.9, z = az * k + pz * s * 3.9;
      if (Math.round(k / 7) % 2) flora.lavanda(x, z, 0.95); else flora.flor(x, z, 1, Math.random() < 0.5 ? PALETAS.rosa : PALETAS.blanco);
    });
    const haciaPlaza = centro.clone().negate().normalize();
    return (modulos[id] = { id, centro, haciaPlaza, r, d, angulo });
  }

  // ----- claustro: arquería (portales) y muro alrededor de cada pabellón, abierto solo al frente -----
  const texArcos = (() => {
    const m = texCanvas(256, 512), g = m.g;
    const f = g.createLinearGradient(0, 0, 0, 512); f.addColorStop(0, "#f3ece0"); f.addColorStop(1, "#ddd2bd");
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(120,105,80,${Math.random() * 0.07})`; g.fillRect(Math.random() * 256, Math.random() * 512, 2 + Math.random() * 6, 2 + Math.random() * 6); }
    g.fillStyle = f; g.globalAlpha = 0.85; g.fillRect(0, 0, 256, 512); g.globalAlpha = 1;
    g.fillStyle = f; g.fillRect(0, 0, 256, 512);
    // hueco del arco (transparente)
    g.globalCompositeOperation = "destination-out";
    g.beginPath(); g.moveTo(40, 512); g.lineTo(40, 250); g.arc(128, 250, 88, Math.PI, 0); g.lineTo(216, 512); g.closePath(); g.fill();
    g.globalCompositeOperation = "source-over";
    g.strokeStyle = "#cbbd9f"; g.lineWidth = 10; g.beginPath(); g.moveTo(40, 512); g.lineTo(40, 250); g.arc(128, 250, 88, Math.PI, 0); g.lineTo(216, 512); g.stroke();
    g.fillStyle = "#d6c9ad"; g.fillRect(0, 66, 256, 10); g.fillStyle = "#c9a25a"; g.fillRect(0, 22, 256, 3);
    g.fillStyle = "rgba(120,90,55,.18)"; g.fillRect(0, 0, 14, 512); g.fillRect(242, 0, 14, 512);
    return m.t;
  })();
  const texMuro = (() => {
    const m = texCanvas(256, 512), g = m.g;
    g.fillStyle = "#e6dcc9"; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(120,105,80,${Math.random() * 0.07})`; g.fillRect(Math.random() * 256, Math.random() * 512, 3 + Math.random() * 10, 3 + Math.random() * 10); }
    g.strokeStyle = "rgba(150,110,60,.35)"; g.lineWidth = 4; g.beginPath(); g.moveTo(52, 512); g.lineTo(52, 250); g.arc(128, 250, 76, Math.PI, 0); g.lineTo(204, 512); g.stroke();
    g.fillStyle = "#c9a25a"; g.fillRect(0, 70, 256, 5);
    return m.t;
  })();
  // Cada claustro es un jardín distinto (al recorrer la hacienda cambia el ambiente)
  const ZONAS = {
    genetica: { nombre: "Jardín botánico", tinte: "#b9a6e0", flores: PALETAS.lavanda, flores2: PALETAS.blanco, bugan: PALETAS.buganvilia, arbol: "cipres", lavanda: true },
    accesorios: { nombre: "Patio de los limoneros", tinte: "#f2d98a", flores: PALETAS.amarillo, flores2: PALETAS.coral, bugan: PALETAS.coral, arbol: "limonero" },
    canamo: { nombre: "Terrazas del spa", tinte: "#f2b8c8", flores: PALETAS.rosa, flores2: PALETAS.blanco, bugan: PALETAS.buganvilia, arbol: "cipres", cascada: true },
    cultivo: { nombre: "Huerto de las cascadas", tinte: "#a9cf9a", flores: PALETAS.blanco, flores2: PALETAS.amarillo, bugan: PALETAS.rosa, arbol: "limonero", lavanda: true, cascada: true },
  };
  // flores y árboles por fuera del claustro, y una cascada detrás en algunas zonas
  function decorarZona(mod, z) {
    const base = Math.atan2(-mod.haciaPlaza.z, mod.haciaPlaza.x), gap = rad(24);
    const cx = mod.centro.x, cz = mod.centro.z;
    const enAng = (a, r) => [cx + Math.cos(a) * r, cz - Math.sin(a) * r];
    const paso = ligero ? 0.11 : 0.075;
    for (let a = base + gap; a < base + Math.PI * 2 - gap; a += paso) {
      const [x1, z1] = enAng(a, R_MURO + 1.8), [x2, z2] = enAng(a + paso / 2, R_MURO + 2.9);
      if (z.lavanda && Math.floor(a / paso) % 2) flora.lavanda(x1, z1, 1.1); else flora.flor(x1, z1, 1.2, z.flores);
      flora.flor(x2, z2, 1, z.flores2);
    }
    // árboles cada tanto (se esquivan al caminar)
    for (let a = base + gap + 0.15; a < base + Math.PI * 2 - gap; a += ligero ? 0.42 : 0.3) {
      if (Math.cos(a - base) > 0.2 && z.cascada) continue; // al fondo va la cascada
      const [x, zz] = enAng(a, R_MURO + 5.2);
      if (z.arbol === "cipres") { flora.cipres(x, zz, 8 + Math.random() * 4); obst.push({ c: [x, zz, 0.7] }); }
      else { flora.limonero(x, zz, 0.9 + Math.random() * 0.3); obst.push({ c: [x, zz, 0.6] }); }
    }
    // buganvilias encima de los portales, colgando sobre los arcos
    const H = 6.6;
    for (let a = base + rad(17); a < base + Math.PI * 2 - rad(17); a += ligero ? 0.05 : 0.032) {
      if (Math.random() < 0.35) continue;
      const r = R_ARCOS + Math.random() * (R_MURO - R_ARCOS);
      const [x, zz] = enAng(a, r);
      flora.racimo(x, 0.6 + H + 0.3 + Math.random() * 0.4, zz, 0.55 + Math.random() * 0.45, z.bugan);
      if (Math.random() < 0.35) { const [x2, z2] = enAng(a, R_ARCOS - 0.3); flora.racimo(x2, 0.6 + H - 0.6 - Math.random() * 1.6, z2, 0.45 + Math.random() * 0.35, z.bugan); }
    }
    // cascada detrás del claustro (del lado contrario a la plaza)
    if (z.cascada) {
      const [x, zz] = enAng(base + Math.PI, R_MURO + 10.5);
      const c = cascada({ x, z: zz, frente: Math.atan2(cx - x, cz - zz), matPiedra: gris, matAgua, matCaida, flora });
      scene.add(c); obst.push({ c: [x, zz, 6.2] });
      const atras = new THREE.Vector3(0, 0, -9).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.rotation.y).add(c.position);
      obst.push({ c: [atras.x, atras.z, 5] });
    }
  }
  function claustro(mod, p, zona) {
    const base = Math.atan2(-mod.haciaPlaza.z, mod.haciaPlaza.x), gap = rad(17);
    const a1 = base + gap, largoA = Math.PI * 2 - 2 * gap;
    const g = new THREE.Group(); g.position.set(mod.centro.x, 0.6, mod.centro.z); scene.add(g);
    const H = 6.6;
    const nA = Math.round((R_ARCOS * largoA) / 3.6);
    const tA = texArcos.clone(); tA.needsUpdate = true; repetir(tA, nA, 1);
    const arcos = new THREE.Mesh(new THREE.CylinderGeometry(R_ARCOS, R_ARCOS, H, nA * 4, 1, true, a1 + Math.PI / 2, largoA),
      new THREE.MeshStandardMaterial({ map: tA, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }));
    arcos.position.y = H / 2; g.add(arcos);
    const tM = texMuro.clone(); tM.needsUpdate = true; repetir(tM, Math.round((R_MURO * largoA) / 4), 1);
    const muro = new THREE.Mesh(new THREE.CylinderGeometry(R_MURO, R_MURO, H + 0.4, 96, 1, true, a1 + Math.PI / 2, largoA), new THREE.MeshStandardMaterial({ map: tM, side: THREE.DoubleSide, roughness: 0.9 }));
    muro.position.y = (H + 0.4) / 2; g.add(muro);
    const techo = new THREE.Mesh(new THREE.RingGeometry(R_ARCOS - 0.4, R_MURO + 0.5, 96, 1, a1, largoA), new THREE.MeshStandardMaterial({ color: "#d8ccb4", roughness: 0.95, side: THREE.DoubleSide }));
    techo.rotation.x = -Math.PI / 2; techo.position.y = H + 0.15; g.add(techo);
    const cornisa = new THREE.Mesh(new THREE.TorusGeometry(R_ARCOS - 0.35, 0.12, 6, 120, largoA), oro);
    cornisa.geometry.rotateX(-Math.PI / 2); cornisa.rotation.y = a1; cornisa.position.y = H + 0.12; g.add(cornisa);
    // portón de entrada: dos pilares y un gran arco con el nombre del claustro
    const ent = new THREE.Group(); ent.position.set(Math.cos(base) * (R_ARCOS + 1.6), 0, -Math.sin(base) * (R_ARCOS + 1.6)); ent.rotation.y = base + Math.PI / 2; g.add(ent);
    const ancho = R_ARCOS * Math.sin(gap);
    [-1, 1].forEach((s) => {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(1.6, H + 2.4, R_MURO - R_ARCOS + 0.4), blanco); pil.position.set(s * (ancho + 0.3), (H + 2.4) / 2, 0); ent.add(pil);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, R_MURO - R_ARCOS + 0.6), oro); cap.position.set(s * (ancho + 0.3), H + 2.45, 0); ent.add(cap);
      const urna = spriteBrillo("#ffcf7a", 2.4); urna.position.set(s * (ancho + 0.3), H + 3.1, 0); urna.material.opacity = 0.7; ent.add(urna);
    });
    const arco = new THREE.Mesh(new THREE.TorusGeometry(ancho - 0.1, 0.38, 10, 40, Math.PI), blanco); arco.position.y = H - 0.6; arco.scale.y = 0.45; ent.add(arco);
    const filo = new THREE.Mesh(new THREE.TorusGeometry(ancho - 0.1, 0.1, 6, 40, Math.PI), oro); filo.position.set(0, H - 0.6, 0.38); filo.scale.y = 0.45; ent.add(filo);
    const cartel = letreroPlano(`${p.icono} ${p.nombre.toUpperCase()}`, ORO, 8.4, "#2b2016"); cartel.position.set(0, H + 1.2, 0.45); ent.add(cartel);
    const cartel2 = cartel.clone(); cartel2.position.z = -0.45; cartel2.rotation.y = Math.PI; ent.add(cartel2);
    if (zona) { const sub = letreroPlano(zona.nombre.toUpperCase(), "#fff4dc", 5.4, "#7a5a3e"); sub.position.set(0, H + 0.05, 0.47); sub.scale.multiplyScalar(0.62); ent.add(sub); }
    // buganvilia sobre el portón
    for (let i = 0; i < 16; i++) { const v = new THREE.Vector3((Math.random() - 0.5) * (ancho * 2 + 2.4), H + 2.6 + Math.random() * 0.6, (Math.random() - 0.5) * 2.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), ent.rotation.y).add(ent.position).add(g.position); flora.racimo(v.x, v.y, v.z, 0.6 + Math.random() * 0.5, zona ? zona.bugan : PALETAS.buganvilia); }
    // palmas y faroles junto al portón, por fuera
    [-1, 1].forEach((s) => {
      const q = new THREE.Vector3(s * (ancho + 2.6), 0, 2.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), ent.rotation.y).add(ent.position).add(g.position);
      palma(q.x, q.z, 9 + Math.random() * 2);
    });
    g.updateMatrixWorld(true);
    [-1, 1].forEach((s) => obst.push({ caja: ent, x0: s * (ancho + 0.3) - 1.0, x1: s * (ancho + 0.3) + 1.0, z0: -2.2, z1: 2.2 }));
    claustros.push({ x: mod.centro.x, z: mod.centro.z, a: base, gap: gap * 0.92, r0: R_ARCOS - 0.4, r1: R_MURO + 0.5 });
    muros.push(arcos, muro);
  }

  // ----- anfitrión: persona con guayabera de lino y sombrero de jipi (reutilizable) -----
  const PIELES = ["#8d5a3b", "#b07a52", "#c99472", "#e0b48f", "#6e4530", "#a86c47"];
  const geoH = {
    pierna: new THREE.CapsuleGeometry(0.13, 0.62, 4, 10), torso: new THREE.CapsuleGeometry(0.3, 0.5, 6, 14), brazo: new THREE.CapsuleGeometry(0.085, 0.5, 4, 8),
    cabeza: new THREE.SphereGeometry(0.24, 18, 14), ala: new THREE.CylinderGeometry(0.44, 0.46, 0.03, 24), copa: new THREE.CylinderGeometry(0.19, 0.24, 0.22, 20), cinta: new THREE.CylinderGeometry(0.245, 0.245, 0.06, 20),
    mano: new THREE.SphereGeometry(0.08, 8, 6),
  };
  const matJipi = new THREE.MeshStandardMaterial({ color: "#e9d6a8", roughness: 0.9 });
  const matPantalon = new THREE.MeshStandardMaterial({ color: "#d8c8ab", roughness: 0.9 });
  const matPiel = {};
  const piel = (c) => matPiel[c] || (matPiel[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
  // Cambia las figuras de un grupo por un modelo GLB de Meshy, si ya está en modelos/modelos.json.
  // conservar: hijos que se quedan (sombra, globo de emoji...). Devuelve el control de animación o null.
  async function vestir(g, id, medidas = {}, conservar = []) {
    const p = await plantilla(id);
    if (!p) return null;
    const c = copia(p, medidas);
    g.children.forEach((h) => { if (!conservar.includes(h)) h.visible = false; });
    if (medidas.y) c.obj.position.y = medidas.y;
    g.add(c.obj);
    g.userData.ctl = c;
    return c;
  }
  function sombrero(color) {
    const s = new THREE.Group();
    s.add(new THREE.Mesh(geoH.ala, matJipi));
    const copa = new THREE.Mesh(geoH.copa, matJipi); copa.position.y = 0.12; s.add(copa);
    const cinta = new THREE.Mesh(geoH.cinta, neon(color)); cinta.position.y = 0.05; s.add(cinta);
    return s;
  }
  function robot(color, x, z, escala = 1) {
    const r = new THREE.Group(); r.position.set(x, 0.3, z); r.scale.setScalar(escala * 0.88);
    const tono = piel(PIELES[Math.floor(Math.random() * PIELES.length)]);
    [-1, 1].forEach((s) => { const p = new THREE.Mesh(geoH.pierna, matPantalon); p.position.set(s * 0.14, 0.45, 0); r.add(p); });
    const cuerpo = new THREE.Mesh(geoH.torso, tela); cuerpo.position.y = 1.28; r.add(cuerpo);
    const cabeza = new THREE.Group(); cabeza.position.y = 1.98; r.add(cabeza);
    cabeza.add(new THREE.Mesh(geoH.cabeza, tono));
    const so = sombrero(color); so.position.y = 0.17; cabeza.add(so);
    const brazos = [-1, 1].map((s) => {
      const b = new THREE.Group(); b.position.set(s * 0.38, 1.6, 0); r.add(b);
      const m = new THREE.Mesh(geoH.brazo, tela); m.position.y = -0.3; b.add(m);
      const mano = new THREE.Mesh(geoH.mano, tono); mano.position.y = -0.62; b.add(mano);
      b.rotation.z = s * 0.12; return b;
    });
    const fase = Math.random() * 6;
    let saludando = 0;
    r.userData.saludar = () => (saludando = 2.4);
    vestir(r, "anfitrion", { alto: 1.85 });
    r.userData.animar = (t, dt) => {
      if (r.userData.ctl) r.userData.ctl.update(dt, saludando > 0 && r.userData.ctl.tiene("saludar") ? "saludar" : "quieto");
      cuerpo.scale.set(1, 1 + Math.sin(t * 1.6 + fase) * 0.015, 1);
      cabeza.rotation.y = Math.sin(t * 0.5 + fase) * 0.45;
      if (saludando > 0) { saludando -= dt; brazos[1].rotation.z = 2.5 + Math.sin(t * 12) * 0.25; } else brazos[1].rotation.z = 0.12;
    };
    return r;
  }
  // vitrina: campana de cristal sobre base dorada con el producto o logo flotando
  const matCristal = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  function holograma(m, x, y, z, tam = 1) {
    const holo = new THREE.Group(); holo.position.set(x, y, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * tam, 0.62 * tam, 0.14 * tam, 24), oro); base.position.y = -1.15 * tam; holo.add(base);
    const campana = new THREE.Mesh(new THREE.CapsuleGeometry(0.5 * tam, 0.55 * tam, 6, 20), matCristal); campana.position.y = -0.35 * tam; holo.add(campana);
    const emoji = spriteEmoji(m.icono, 0.9 * tam); emoji.position.y = -0.35 * tam; holo.add(emoji);
    const luz = spriteBrillo("#ffe2a8", 1.6 * tam); luz.position.y = -0.35 * tam; luz.material.opacity = 0.35; holo.add(luz);
    const fase = Math.random() * 6;
    holo.userData.animar = (t) => { emoji.position.y = (-0.35 + Math.sin(t * 1.4 + fase) * 0.08) * tam; emoji.material.rotation = Math.sin(t * 0.8 + fase) * 0.15; };
    return holo;
  }
  function totem(m, s, x, z, rotY, alto = 2.7) {
    const tt = texCanvas(256, 512, 0.5);
    const tot = new THREE.Group(); tot.position.set(x, 0, z); tot.rotation.y = rotY;
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(1.3, alto, 0.25), oscuro); cuerpo.position.y = 0.3 + alto / 2; tot.add(cuerpo);
    const cara = new THREE.Mesh(new THREE.PlaneGeometry(1.2, alto - 0.3), conMapa(tt.t)); cara.position.set(0, 0.3 + alto / 2, 0.13); tot.add(cara);
    const luz = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.32), oro); luz.position.y = 0.3 + alto; tot.add(luz);
    const pie = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.14, 0.4), oro); pie.position.y = 0.37; tot.add(pie);
    s.totems.push(tt);
    return tot;
  }

  // ----- stands -----
  const stands = {}; // marcaId -> datos del stand
  // tipo "stand": 7 m de frente, 1 pantalla. tipo "premium": 11.5 m, muro de video con 5 pantallas.
  function crearStand(m, mod, ang, premium) {
    const pos = new THREE.Vector3(mod.centro.x + Math.cos(ang) * R_ANILLO, 0.6, mod.centro.z - Math.sin(ang) * R_ANILLO);
    const g = new THREE.Group(); g.position.copy(pos);
    g.lookAt(mod.centro.x, 0.6, mod.centro.z); // el frente (+z) mira al centro del pabellón
    g.userData = { tipo: "stand", id: m.id };
    scene.add(g); tocables.push(g);
    const A = premium ? 11.5 : 7, H = premium ? 6.4 : 4.6, P = premium ? 6.6 : 5.4;
    const s = { m, grupo: g, pos, ancho: A, alto: H, pt: null, lt: null, mt: null, totems: [], videos: [], slide: 0, totemI: Math.floor(Math.random() * 9), productos: catalogo(m), anim: [] };
    const piso = new THREE.Mesh(new THREE.BoxGeometry(A, 0.3, P), matPiedraPiso); piso.position.y = 0.15; g.add(piso);
    const filo = new THREE.Mesh(new THREE.BoxGeometry(A + 0.05, 0.06, P + 0.05), oro); filo.position.y = 0.3; g.add(filo);
    const tapete = new THREE.Mesh(new THREE.PlaneGeometry(A * 0.62, P * 0.5), new THREE.MeshStandardMaterial({ color: mezclar(m.color2, 0.25, "#3a291c"), roughness: 0.95 }));
    tapete.rotation.x = -Math.PI / 2; tapete.position.set(0, 0.31, P * 0.12); g.add(tapete);
    const zMuro = -P / 2 + 0.2;
    const muro = new THREE.Mesh(new THREE.BoxGeometry(A, H, 0.35), blanco); muro.position.set(0, 0.3 + H / 2, zMuro); g.add(muro);
    // franja con el color de la marca detrás de la pantalla, y alas de madera
    const franja = new THREE.Mesh(new THREE.BoxGeometry(A - 0.6, H - 0.5, 0.05), new THREE.MeshStandardMaterial({ color: mezclar(m.color2, 0.3, "#2b2016"), roughness: 0.8 }));
    franja.position.set(0, 0.3 + H / 2 - 0.05, zMuro + 0.18); g.add(franja);
    [-1, 1].forEach((sg) => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, H, 1.8), madera); w.position.set(sg * (A / 2 - 0.15), 0.3 + H / 2, zMuro + 0.8); w.rotation.y = sg * 0.35; g.add(w);
      const vara = new THREE.Mesh(new THREE.BoxGeometry(0.08, H, 0.08), oro); vara.position.set(sg * (A / 2 - 0.02), 0.3 + H / 2, zMuro + 1.55); g.add(vara);
    });
    // Pantalla principal
    s.pt = texCanvas(1024, 576, premium ? 0.75 : 0.5);
    const pw = premium ? 6.4 : 5.6, ph = pw * 0.5625;
    const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), conMapa(s.pt.t));
    pantalla.position.set(0, premium ? 3.5 : 2.75, zMuro + 0.23); g.add(pantalla);
    const marcoP = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.24, ph + 0.24, 0.05), oro); marcoP.position.set(0, pantalla.position.y, zMuro + 0.2); g.add(marcoP);
    if (premium) {
      // Muro de video: 4 pantallas más, cada una con su propio video
      [[-1, 1], [-1, -1], [1, 1], [1, -1]].forEach(([sx, sy], i) => {
        const vt = texCanvas(1024, 576, 0.375);
        const v = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.3), conMapa(vt.t));
        v.position.set(sx * 4.35, 3.5 + sy * 0.95, zMuro + 0.25); g.add(v);
        const marco = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.45, 0.05), oro); marco.position.set(v.position.x, v.position.y, zMuro + 0.21); g.add(marco);
        s.videos.push({ tx: vt, k: i, avance: Math.random() });
      });
      // Arco de luz en la parte alta
      const arco = new THREE.Mesh(new THREE.TorusGeometry(A / 2 - 0.3, 0.14, 8, 48, Math.PI), oro);
      arco.position.set(0, H - 2.6, zMuro + 0.25); arco.scale.y = 0.55; g.add(arco);
    }
    // Letrero
    s.lt = texCanvas(1024, 200, 0.5);
    const lw = premium ? 8 : 5.4;
    const letrero = new THREE.Mesh(new THREE.BoxGeometry(lw, premium ? 1.4 : 1.05, 0.35), [oscuro, oscuro, oscuro, oscuro, conMapa(s.lt.t), oscuro]);
    letrero.position.set(0, 0.3 + H + (premium ? 0.75 : 0.55), zMuro); g.add(letrero);
    const marcoL = new THREE.Mesh(new THREE.BoxGeometry(lw + 0.2, (premium ? 1.4 : 1.05) + 0.2, 0.3), oro); marcoL.position.set(0, letrero.position.y, zMuro - 0.05); g.add(marcoL);
    if (premium) { const est = spriteEmoji("✨", 1.3); est.position.set(lw / 2 + 0.6, 0.3 + H + 0.8, zMuro); g.add(est); }
    // Tótems
    const tz = P / 2 - 1.6;
    g.add(totem(m, s, -(A / 2 - 1.1), tz, 0.4, premium ? 3.2 : 2.7), totem(m, s, A / 2 - 1.1, tz, -0.4, premium ? 3.2 : 2.7));
    // Mostrador con logo
    s.mt = texCanvas(512, 256, 0.5);
    const most = new THREE.Mesh(new THREE.BoxGeometry(premium ? 3.4 : 2.6, 1.05, 0.9), [madera, madera, gris, madera, conMapa(s.mt.t), madera]);
    most.position.set(0.6, 0.82, P / 2 - 2.2); g.add(most);
    const cubierta = new THREE.Mesh(new THREE.BoxGeometry((premium ? 3.4 : 2.6) + 0.14, 0.07, 1.02), oro); cubierta.position.set(0.6, 1.37, P / 2 - 2.2); g.add(cubierta);
    const holo = holograma(m, 0.6, 2.55, P / 2 - 2.2, premium ? 1.3 : 1); g.add(holo); s.anim.push(holo.userData.animar);
    const rob = robot(m.color, -(premium ? 2.6 : 1.9), P / 2 - 1.5); g.add(rob); s.anim.push(rob.userData.animar); s.rob = rob;
    s.saludar = rob.userData.saludar;
    if (premium) { const rob2 = robot(m.color, 3.4, P / 2 - 1.5, 0.9); g.add(rob2); s.anim.push(rob2.userData.animar); }
    // Macetas de barro con helecho
    [-(A / 2 - 1.1), A / 2 - 1.1].forEach((x) => {
      const mg = new THREE.Group(); mg.position.set(x, 0.3, zMuro + 1.4); g.add(mg);
      const mac = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.26, 0.6, 14), barro); mac.position.y = 0.3; mg.add(mac);
      const pl = new THREE.Mesh(geoAgave, matAgave); pl.position.y = 0.55; pl.scale.setScalar(0.7); mg.add(pl);
      vestir(mg, "maceta-agave", { alto: 1.5 });
    });
    s.frente = g.getWorldDirection(new THREE.Vector3());
    g.updateMatrixWorld(true);
    obst.push({ caja: g, x0: -A / 2 - 0.2, x1: A / 2 + 0.2, z0: -P / 2, z1: P / 2 - 1.1 });
    s.puerta = pos.clone().addScaledVector(s.frente, P / 2 + 1.6);
    stands[m.id] = s;
    pintarStand(s);
    return s;
  }

  // Isla de marca: una plataforma completa para una sola marca
  function crearIsla(m) {
    const mod = modulo(m.id, m.angulo, D_EXT, R_ISLA, m.color, { tex: texPiedra("#e9dcc3", "rgba(120,95,65,.3)"), rep: 7 });
    const g = new THREE.Group(); g.position.set(mod.centro.x, 0.6, mod.centro.z);
    g.lookAt(0, 0.6, 0); // el frente mira a la plaza
    g.userData = { tipo: "stand", id: m.id };
    scene.add(g); tocables.push(g);
    const s = { m, grupo: g, pos: g.position.clone(), ancho: 20, alto: 9, isla: true, pt: null, lt: null, mt: null, totems: [], videos: [], slide: 0, totemI: 0, productos: catalogo(m), anim: [] };
    // Piso de piedra con un anillo del color de la marca
    const anilloP = capa(new THREE.RingGeometry(R_ISLA - 2.2, R_ISLA - 1.6, 72), new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.6 }), 0.035); g.add(anilloP);
    const centroP = capa(new THREE.CircleGeometry(4.2, 48), new THREE.MeshStandardMaterial({ color: mezclar(m.color2, 0.3, "#3a291c"), roughness: 0.8 }), 0.035); centroP.position.z = -3; g.add(centroP);
    // Muro curvo de video detrás (mirando hacia la entrada)
    const RM = 10.5, ARCO = rad(150);
    // la casa: muro curvo de estuco pintado con el color de la marca (como las haciendas), con cornisa dorada
    const muro = new THREE.Mesh(new THREE.CylinderGeometry(RM, RM, 8.4, 64, 1, true, Math.PI - ARCO / 2, ARCO), new THREE.MeshStandardMaterial({ map: (() => { const t = texMuro.clone(); t.needsUpdate = true; return repetir(t, 9, 1); })(), color: mezclar(m.color, 0.84, "#f3ece0"), roughness: 0.9, side: THREE.DoubleSide }));
    muro.position.y = 4.2; g.add(muro); muros.push(muro);
    const zoc = new THREE.Mesh(new THREE.CylinderGeometry(RM + 0.05, RM + 0.05, 0.9, 64, 1, true, Math.PI - ARCO / 2, ARCO), new THREE.MeshStandardMaterial({ color: "#e6d8bd", roughness: 0.9, side: THREE.DoubleSide }));
    zoc.position.y = 0.45; g.add(zoc);
    const tapa = new THREE.Mesh(new THREE.TorusGeometry(RM, 0.22, 8, 64, ARCO), oro); tapa.rotation.set(Math.PI / 2, 0, -Math.PI / 2 - ARCO / 2); tapa.position.y = 8.4; g.add(tapa);
    for (let k = 0; k <= 10; k++) { const a = Math.PI - ARCO / 2 + (ARCO * k) / 10; obst.push({ caja: g, x0: Math.sin(a) * RM - 0.9, x1: Math.sin(a) * RM + 0.9, z0: Math.cos(a) * RM - 0.9, z1: Math.cos(a) * RM + 0.9 }); }
    // 3 pantallas grandes en el muro: la del centro es la principal
    s.pt = texCanvas(1024, 576, 0.75);
    [-1, 0, 1].forEach((i) => {
      const a = Math.PI + i * rad(42);
      const tx = i === 0 ? s.pt : texCanvas(1024, 576, 0.6);
      const w = i === 0 ? 7.2 : 5.6;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5625), conMapa(tx.t));
      p.position.set(Math.sin(a) * (RM - 0.25), 4.2, Math.cos(a) * (RM - 0.25)); p.rotation.y = Math.atan2(-p.position.x, -p.position.z); g.add(p);
      const mp = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, w * 0.5625 + 0.3, 0.06), oro); mp.position.copy(p.position).multiplyScalar((RM - 0.18) / (RM - 0.25)); mp.position.y = 4.2; mp.rotation.y = p.rotation.y; g.add(mp);
      if (i !== 0) s.videos.push({ tx, k: i + 1, avance: Math.random() });
    });
    // Letrero gigante sobre el muro
    s.lt = texCanvas(1024, 200, 0.75);
    const letrero = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.35), new THREE.MeshBasicMaterial({ map: s.lt.t, toneMapped: false, side: THREE.DoubleSide }));
    letrero.position.set(0, 9.6, -RM + 0.6); g.add(letrero);
    // Logo gigante flotando con anillos
    const logo = spriteEmoji(m.icono, 6); logo.position.set(0, 13.5, -3); g.add(logo); s.logoSprite = logo;
    const halo = spriteBrillo(m.color, 12); halo.position.copy(logo.position); halo.material.opacity = 0.55; g.add(halo); s.logoHalo = halo;
    // medallón dorado alrededor del logo, girando despacio
    const aros = [0, 1].map((k) => { const a = new THREE.Mesh(new THREE.TorusGeometry(3.4 + k * 0.45, k ? 0.06 : 0.16, 8, 72), oro); a.position.copy(logo.position); g.add(a); return a; });
    halo.material.opacity = 0.25;
    s.anim.push((t) => { logo.position.y = 13.5 + Math.sin(t * 0.8) * 0.25; aros[0].rotation.set(0, Math.sin(t * 0.3) * 0.5, 0); aros[1].rotation.set(0, -Math.sin(t * 0.3) * 0.5, 0); aros.forEach((a) => a.position.y = logo.position.y); });
    // Mostrador central con holograma
    s.mt = texCanvas(512, 256, 0.5);
    const most = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 1.2), [madera, madera, gris, madera, conMapa(s.mt.t), madera]); most.position.set(0, 0.55, -3); g.add(most);
    const cub = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.08, 1.32), oro); cub.position.set(0, 1.12, -3); g.add(cub);
    obst.push({ caja: g, x0: -2.3, x1: 2.3, z0: -3.8, z1: -2.2 });
    const holo = holograma(m, 0, 2.6, -3, 1.6); g.add(holo); s.anim.push(holo.userData.animar);
    // Vitrinas con productos que giran (tocarlas abre el catálogo)
    const pedestales = [];
    [-62, -36, 36, 62].forEach((gr, i) => {
      const a = rad(gr), x = Math.sin(a) * 6.5, z = -Math.cos(a) * 6.5 + 1;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.3, 24), gris); ped.position.set(x, 0.65, z); g.add(ped);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 32), oro); aro.rotation.x = Math.PI / 2; aro.position.set(x, 1.32, z); g.add(aro);
      const vidrio = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.5, 24, 1, true), matCristal); vidrio.position.set(x, 2.1, z); g.add(vidrio);
      const prod = s.productos[(i * 3) % Math.max(1, s.productos.length)] || { icono: m.icono };
      const sp = spriteEmoji(prod.icono, 1.1); sp.position.set(x, 2.1, z); g.add(sp); pedestales.push(sp);
      obst.push({ caja: g, x0: x - 1.1, x1: x + 1.1, z0: z - 1.1, z1: z + 1.1 });
    });
    s.anim.push((t) => pedestales.forEach((p, i) => { p.position.y = 2.1 + Math.sin(t * 2 + i) * 0.12; p.material.rotation = Math.sin(t + i) * 0.2; }));
    // Tótems a los lados de la entrada
    [[-1, 0.3], [1, -0.3]].forEach(([sg, r]) => g.add(totem(m, s, sg * 5.5, 5, r, 3.4)));
    [[-5.5, 5], [5.5, 5]].forEach(([x, z]) => obst.push({ caja: g, x0: x - 0.9, x1: x + 0.9, z0: z - 0.5, z1: z + 0.5 }));
    // Robots anfitriones
    [[-2.8, -1], [2.8, -1]].forEach(([x, z], i) => { const r = robot(m.color, x, z, 1.1); g.add(r); s.anim.push(r.userData.animar); if (!i) { s.saludar = r.userData.saludar; s.rob = r; } });
    // Portón de la casa, al final del sendero
    const ent = new THREE.Group(); ent.position.set(0, 0, R_ISLA - 1.2); g.add(ent);
    portal(ent, 2.6, m.color);
    [-2.6, 2.6].forEach((x) => obst.push({ caja: g, x0: x - 0.7, x1: x + 0.7, z0: R_ISLA - 1.9, z1: R_ISLA - 0.5 }));
    const et = texCanvas(1024, 200, 0.5);
    const viga = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.1, 0.5), [oscuro, oscuro, oscuro, oscuro, conMapa(et.t), conMapa(et.t)]); viga.position.y = 5.3; ent.add(viga);
    s.entrada = et;
    g.updateMatrixWorld(true);
    // jardín de la casa: palmas y agaves a los lados del muro
    [-1, 1].forEach((sg) => { const q = g.localToWorld(new THREE.Vector3(sg * 12.5, 0, -6)); palma(q.x, q.z, 9 + Math.random() * 2); const q2 = g.localToWorld(new THREE.Vector3(sg * 9.5, 0, 7)); mata(q2.x, q2.z, 1); obst.push({ c: [q2.x, q2.z, 0.9] }); });
    // Drones propios dando vueltas a la isla
    s.frente = g.getWorldDirection(new THREE.Vector3());
    g.updateMatrixWorld(true);
    s.puerta = g.localToWorld(new THREE.Vector3(0, 0, 2.2)); s.puerta.y = 0;
    s.mira = g.localToWorld(new THREE.Vector3(0, 0, -6));
    stands[m.id] = s;
    pintarStand(s);
    etiquetas.push({ el: cfg.etiqueta({ id: m.id, icono: m.icono, nombre: m.nombre, color: m.color, isla: true }), pos: new THREE.Vector3(mod.centro.x, 17, mod.centro.z) });
    return s;
  }

  function pintarStand(s, cambiarSlide = false) {
    const md = s.med, promos = (s.m.promos || []).filter(promoVigente);
    if (cambiarSlide) { s.slide = (s.slide + 1) % 3; if (s.slide === 2) s.promoI = (s.promoI || 0) + 1; }
    if (!s.vidPantalla) {
      dibujarPantalla(s.pt.g, 1024, 576, s.m, s.slide, s.productos);
      if (md && md.pantalla && s.slide === 0) { dibujarEn(s.pt.g, md.pantalla, 0, 0, 1024, 576, "llenar"); s.pt.g.strokeStyle = s.m.color; s.pt.g.lineWidth = 10; s.pt.g.strokeRect(5, 5, 1014, 566); }
      if (s.slide === 2 && promos.length) { const p = promos[(s.promoI || 0) % promos.length]; dibujarPromo(s.pt.g, 1024, 576, s.m, p, md && md.promos && md.promos[p.id]); }
      if (md && md.logo && !(md.pantalla && s.slide === 0)) { s.pt.g.fillStyle = "rgba(255,255,255,.92)"; rr(s.pt.g, 1024 - 150, 22, 128, 128, 22); s.pt.g.fill(); dibujarEn(s.pt.g, md.logo, 1024 - 142, 30, 112, 112, "contener"); }
      s.pt.t.needsUpdate = true;
    }
    const letrero = (tx) => {
      tx.g.clearRect(0, 0, 1024, 200); dibujarLetrero(tx.g, 1024, 200, s.m);
      if (md && md.logo) { // logo a la izquierda y el nombre a su lado
        const f = tx.g.createLinearGradient(0, 0, 1024, 0); f.addColorStop(0, s.m.color); f.addColorStop(1, mezclar(s.m.color, 0.25, "#ffffff"));
        tx.g.fillStyle = f; tx.g.fillRect(0, 0, 1024, 200);
        tx.g.fillStyle = "#fff"; rr(tx.g, 18, 14, 172, 172, 28); tx.g.fill(); dibujarEn(tx.g, md.logo, 26, 22, 156, 156, "contener");
        tx.g.fillStyle = s.m.color2; tx.g.textAlign = "center"; tx.g.textBaseline = "middle"; ajustar(tx.g, s.m.nombre, 780, 76); tx.g.fillText(s.m.nombre, 610, 104);
      }
      tx.t.needsUpdate = true;
    };
    letrero(s.lt); if (s.entrada) letrero(s.entrada);
    dibujarMostrador(s.mt.g, 512, 256, s.m);
    if (md && md.logo) { s.mt.g.fillStyle = s.m.color2; s.mt.g.fillRect(0, 0, 512, 256); dibujarEn(s.mt.g, md.logo, 156, 28, 200, 200, "contener"); }
    s.mt.t.needsUpdate = true;
    pintarTotems(s); pintarVideos(s, 0);
  }
  function pintarTotems(s) {
    const md = s.med, lista = s.productos.length ? s.productos : [{ icono: s.m.icono, nombre: s.m.nombre, precio: "", cat: "" }];
    s.totems.forEach((tt, i) => {
      if (s.vidTotem) return; // los tótems están pasando un video vertical
      if (md && md.totem && (i === 0 || s.totemI % 2)) { tt.g.fillStyle = "#0b0718"; tt.g.fillRect(0, 0, 256, 512); dibujarEn(tt.g, md.totem, 0, 0, 256, 512, "llenar"); tt.g.strokeStyle = s.m.color; tt.g.lineWidth = 6; tt.g.strokeRect(3, 3, 250, 506); }
      else dibujarTotem(tt.g, 256, 512, s.m, lista[(s.totemI + i * 5) % lista.length]);
      tt.t.needsUpdate = true;
    });
  }
  function pintarVideos(s, dt) {
    s.videos.forEach((v) => {
      if (v.real) return; // esta pantalla pasa un video de la marca (se dibuja en cada cuadro)
      v.avance = (v.avance + dt / 12) % 1; dibujarVideo(v.tx.g, 1024, 576, s.m, v.k, v.avance, s.productos); v.tx.t.needsUpdate = true;
    });
  }

  // ---------- lo que sube cada marca: imágenes, videos, modelo 3D y promociones ----------
  const hoyMx = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  function promoVigente(p) { return p && p.titulo && (!p.hasta || p.hasta >= hoyMx()); }
  function dibujarPromo(g, w, h, m, p, img) {
    const f = g.createLinearGradient(0, 0, w, h); f.addColorStop(0, m.color2); f.addColorStop(1, "#140d08");
    g.fillStyle = f; g.fillRect(0, 0, w, h);
    let x0 = 56;
    if (img) { g.save(); rr(g, w - h + 40, 40, h - 80, h - 80, 30); g.clip(); dibujarEn(g, img, w - h + 40, 40, h - 80, h - 80, "llenar"); g.restore(); }
    const ancho = (img ? w - h : w) - 90;
    g.textAlign = "left"; g.textBaseline = "middle";
    g.fillStyle = "#e3c27a"; g.font = `700 34px ${FUENTE}`; g.fillText("PROMOCIÓN", x0, h * 0.18);
    g.fillStyle = "#fff"; ajustar(g, p.titulo, ancho, 76); g.fillText(p.titulo, x0, h * 0.38);
    if (p.texto) {
      g.fillStyle = "rgba(255,255,255,.85)"; g.font = `600 30px ${FUENTE}`;
      const pal = String(p.texto).split(/\s+/), lineas = []; let l = "";
      pal.forEach((x) => { const t = l ? l + " " + x : x; if (g.measureText(t).width > ancho && l) { lineas.push(l); l = x; } else l = t; });
      if (l) lineas.push(l);
      lineas.slice(0, 3).forEach((t, i) => g.fillText(t, x0, h * 0.56 + i * 40));
    }
    if (p.hasta) { g.fillStyle = m.color; g.font = `700 26px ${FUENTE}`; g.fillText(`Válida hasta el ${p.hasta.split("-").reverse().join("/")}`, x0, h * 0.86); }
    marcoOro(g, w, h);
  }
  // más resolución para el canvas de una pantalla cuando trae fotos o video de la marca
  function nitido(tx, w, h) {
    if (tx.c.width >= w) return;
    tx.c.width = w; tx.c.height = h; tx.g.setTransform(w / tx.wl, 0, 0, h / tx.hl, 0, 0);
    tx.t.dispose(); tx.t.needsUpdate = true;
  }
  const gltf = new GLTFLoader();
  async function aplicarMedios(s) {
    const m = s.m, clave = JSON.stringify([m.medios || null, m.videosMarca || null, m.promos || null]);
    if (s.clave === clave) return;
    s.clave = clave;
    const md = await mediosDe(m);
    if (s.clave !== clave) return; // llegó otro cambio mientras cargaba
    // videos: se detienen los de antes
    (s.vidEls || []).forEach((x) => { x.el.pause(); x.el.removeAttribute("src"); x.el.load(); });
    s.vidEls = []; s.vidPantalla = null; s.vidTotem = null;
    s.videos.forEach((v) => (v.real = null));
    s.med = md;
    if (md.pantalla || md.logo) { nitido(s.pt, 1024, 576); nitido(s.lt, 1024, 200); nitido(s.mt, 512, 256); if (s.entrada) nitido(s.entrada, 1024, 200); }
    if (md.totem) s.totems.forEach((tt) => nitido(tt, 512, 1024));
    // en las islas, el logo gigante que flota es el de la marca
    if (s.logoSprite) {
      if (!s.logoEmoji) s.logoEmoji = s.logoSprite.material.map;
      if (md.logo) { const t = new THREE.Texture(md.logo); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; s.logoSprite.material.map = t; }
      else s.logoSprite.material.map = s.logoEmoji;
      s.logoSprite.material.needsUpdate = true; s.logoSprite.material.toneMapped = !md.logo;
      if (s.logoHalo) { s.logoHalo.material.opacity = md.logo ? 0.18 : 0.55; s.logoHalo.position.z = md.logo ? -3.6 : -3; }
    }
    const nuevoVideo = (v) => {
      const el = document.createElement("video");
      el.muted = true; el.loop = true; el.playsInline = true; el.preload = "auto"; el.src = v.url;
      const x = { el, v }; s.vidEls.push(x); return x;
    };
    const H = md.videos.filter((v) => v.orient !== "vertical"), V = md.videos.filter((v) => v.orient === "vertical");
    if (H.length) {
      if (s.videos.length) s.videos.forEach((pv, i) => { pv.real = nuevoVideo(H[i % H.length]); nitido(pv.tx, 1024, 576); });
      else { s.vidPantalla = nuevoVideo(H[0]); nitido(s.pt, 1024, 576); }
    }
    if (V.length) { s.vidTotem = s.totems.map((tt, i) => nuevoVideo(V[i % V.length])); s.totems.forEach((tt) => nitido(tt, 512, 1024)); }
    // modelo 3D en lugar del robot (con su animación, si tiene)
    if (s.modelo) { s.modelo.removeFromParent(); s.anim.splice(s.anim.indexOf(s.modeloAnim), 1); s.modelo = null; }
    if (s.rob) s.rob.visible = true;
    if (md.modelo && s.rob) {
      try {
        const r = await gltf.loadAsync(md.modelo.url);
        if (s.clave !== clave) return;
        const obj = r.scene, caja = new THREE.Box3().setFromObject(obj), tam = caja.getSize(new THREE.Vector3());
        const k = (md.modelo.alto || 2) / Math.max(tam.y, 0.001);
        obj.scale.setScalar(k);
        const c = caja.getCenter(new THREE.Vector3());
        const cont = new THREE.Group(); cont.add(obj);
        obj.position.set(-c.x * k, -caja.min.y * k, -c.z * k);
        cont.position.copy(s.rob.position); cont.position.y = 0.3; cont.rotation.y = md.modelo.giro ? rad(md.modelo.giro) : 0;
        s.rob.parent.add(cont); s.rob.visible = false;
        let mixer = null;
        if (r.animations.length && md.modelo.anim !== "ninguna") {
          mixer = new THREE.AnimationMixer(obj);
          const clip = r.animations.find((a) => a.name === md.modelo.anim) || r.animations[0];
          mixer.clipAction(clip).play();
        }
        s.modelo = cont;
        s.modeloAnim = (t, dt) => { if (mixer && !quieto) mixer.update(dt); };
        s.anim.push(s.modeloAnim);
      } catch (e) { console.warn("No se pudo cargar el modelo 3D de", m.nombre, e); }
    }
    pintarStand(s);
    drones.filter((d) => d.m.id === m.id).forEach((d) => pintarDron(d));
    revisarVideos();
  }
  // Los videos de la marca solo corren en los stands cercanos (o el que tienes enfocado)
  function revisarVideos() {
    Object.values(stands).forEach((s) => {
      if (!s.vidEls || !s.vidEls.length) return;
      const d = Math.hypot(yo.position.x - s.pos.x, yo.position.z - s.pos.z);
      const ver = d < 34 || (enfocado && enfoqueId === s.m.id);
      s.vidEls.forEach((x) => { if (ver && x.el.paused) x.el.play().catch(() => {}); else if (!ver && !x.el.paused) x.el.pause(); });
      s.vidVivo = ver;
    });
  }
  function dibujarVideosReales() {
    for (const s of Object.values(stands)) {
      if (!s.vidVivo) continue;
      const cuadro = (x, tx, w, h) => {
        if (!x || x.el.readyState < 2) return;
        tx.g.fillStyle = "#000"; tx.g.fillRect(0, 0, w, h);
        dibujarEn(tx.g, x.el, 0, 0, w, h, x.v.ajuste === "llenar" ? "llenar" : "contener");
        tx.g.strokeStyle = s.m.color; tx.g.lineWidth = 6; tx.g.strokeRect(3, 3, w - 6, h - 6);
        tx.t.needsUpdate = true;
      };
      if (s.vidPantalla) cuadro(s.vidPantalla, s.pt, 1024, 576);
      s.videos.forEach((pv) => cuadro(pv.real, pv.tx, 1024, 576));
      if (s.vidTotem) s.totems.forEach((tt, i) => cuadro(s.vidTotem[i], tt, 256, 512));
    }
  }

  // Lugares a los que se puede ir caminando (puestos, parcelas, tu tienda, la nave): id -> { p, mirar, entrar }
  const lugares = {};
  function lugar(id, g, local, mirarLocal, entrar = true) {
    g.updateMatrixWorld(true);
    const p = g.localToWorld(local.clone()); p.y = 0;
    const mirar = g.localToWorld(mirarLocal.clone()); mirar.y = 0;
    lugares[id] = { p, mirar, entrar };
  }
  function letreroPlano(texto, color, ancho = 4, fondo = CREMA) {
    const t = texCanvas(1024, 220, 0.5);
    const claro = new THREE.Color(fondo).getHSL({}).l > 0.5;
    t.g.fillStyle = fondo; rr(t.g, 0, 0, 1024, 220, 18); t.g.fill();
    t.g.strokeStyle = ORO; t.g.lineWidth = 10; rr(t.g, 6, 6, 1012, 208, 16); t.g.stroke();
    t.g.lineWidth = 3; rr(t.g, 22, 22, 980, 176, 10); t.g.stroke();
    t.g.fillStyle = color; t.g.fillRect(470, 196, 84, 8);
    t.g.fillStyle = claro ? CAFE : CREMA; t.g.textAlign = "center"; t.g.textBaseline = "middle"; ajustar(t.g, texto, 900, 96); t.g.fillText(texto, 512, 114);
    return new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho * 0.215), new THREE.MeshBasicMaterial({ map: t.t, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  }
  // portón de piedra: dos pilares con capitel dorado, arco y farolitos
  function portal(ent, x, color) {
    [-x, x].forEach((px) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.2, 0.9), blanco); c.position.set(px, 2.6, 0); ent.add(c);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.22, 1.05), oro); cap.position.set(px, 5.3, 0); ent.add(cap);
      const zoc = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.5, 1.05), gris); zoc.position.set(px, 0.25, 0); ent.add(zoc);
      const b = spriteBrillo("#ffcf7a", 1.8); b.position.set(px, 5.8, 0); b.material.opacity = 0.7; ent.add(b);
    });
    const arco = new THREE.Mesh(new THREE.TorusGeometry(x, 0.3, 8, 32, Math.PI), blanco); arco.position.y = 5.2; arco.scale.y = 0.35; ent.add(arco);
    const filo = new THREE.Mesh(new THREE.TorusGeometry(x, 0.07, 6, 32, Math.PI), oro); filo.position.set(0, 5.2, 0.31); filo.scale.y = 0.35; ent.add(filo);
  }
  function arcoEntrada(g, texto, color, z) {
    const ent = new THREE.Group(); ent.position.set(0, 0, z); g.add(ent);
    portal(ent, 2.6, color);
    [-2.6, 2.6].forEach((x) => obst.push({ caja: g, x0: x - 0.7, x1: x + 0.7, z0: z - 0.7, z1: z + 0.7 }));
    const viga = letreroPlano(texto, color, 6.4); viga.material.side = THREE.FrontSide; viga.position.set(0, 4.3, 0.5); ent.add(viga);
    const atras = viga.clone(); atras.rotation.y = Math.PI; atras.position.z = -0.5; ent.add(atras);
  }

  // ----- Mercado: puestos para comprar semillas y aditamentos, y talleres para transformar la cosecha -----
  const puestos3d = {};
  function crearMercado() {
    const mod = modulo("mercado", 90, D_EXT, R_ISLA, "#ffd76a", { tex: texMosaico("#b07a52", "#ecdcc0", "#6f8a74"), rep: 20 });
    const g = new THREE.Group(); g.position.set(mod.centro.x, 0.6, mod.centro.z); g.lookAt(0, 0.6, 0);
    scene.add(g); g.updateMatrixWorld(true);
    // letrero central flotante
    const centro = new THREE.Group(); centro.position.set(0, 0, -1); g.add(centro);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 0.6, 32), gris); base.position.y = 0.3; centro.add(base);
    obst.push({ caja: g, x0: -2.1, x1: 2.1, z0: -3.1, z1: 1.1 });
    const carrito = spriteEmoji("🧺", 1.6); carrito.position.y = 1.5; centro.add(carrito);
    const sign = new THREE.Group(); sign.position.y = 10; centro.add(sign);
    { const c1 = letreroPlano("MERCADO Y BOTICA", ORO, 6, CAFE); c1.material.side = THREE.FrontSide; c1.position.z = 0.02; const c2 = c1.clone(); c2.rotation.y = Math.PI; c2.position.z = -0.02; sign.add(c1, c2); }
    anim.push((t) => { carrito.position.y = 1.5 + Math.sin(t * 1.4) * 0.15; sign.rotation.y = t * 0.2; });
    arcoEntrada(g, "MERCADO", ORO, R_ISLA - 1.2);
    // pérgola de madera con lonas en el centro
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.6, 8), madera); p.position.set(sx * 2.4, 2.3, -1 + sz * 2.4); g.add(p); });
    const lona = new THREE.Mesh(new THREE.ConeGeometry(3.9, 1.2, 4, 1, true), tela); lona.material = new THREE.MeshStandardMaterial({ color: "#f3e9d6", roughness: 0.95, side: THREE.DoubleSide }); lona.rotation.y = Math.PI / 4; lona.position.set(0, 5.2, -1); g.add(lona);
    // 5 puestos en semicírculo mirando al centro
    PUESTOS.forEach((pu, i) => {
      const a = rad(-84 + i * 42), R = 10.5;
      const pg = new THREE.Group(); pg.position.set(Math.sin(a) * R, 0, -Math.cos(a) * R);
      pg.userData = { tipo: "puesto", id: pu.id }; g.add(pg); tocables.push(pg);
      pg.rotation.y = Math.atan2(0 - pg.position.x, -1 - pg.position.z); // mira al centro del mercado
      const color = new THREE.Color(pu.color);
      const mostrador = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1.3), madera); mostrador.position.set(0, 0.55, 0); pg.add(mostrador);
      const frente = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.7), new THREE.MeshStandardMaterial({ color: mezclar(pu.color, 0.45, "#6b4a2e"), roughness: 0.8 })); frente.position.set(0, 0.55, 0.66); pg.add(frente);
      const tapa = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.5), gris); tapa.position.y = 1.15; pg.add(tapa);
      const filoT = new THREE.Mesh(new THREE.BoxGeometry(4.22, 0.04, 1.52), oro); filoT.position.y = 1.21; pg.add(filoT);
      [-1.9, 1.9].forEach((x) => { const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 8), oscuro); poste.position.set(x, 1.7, -0.6); pg.add(poste); });
      // toldo de lona a rayas (crema y el color del puesto, apagado)
      const rayas = texCanvas(256, 64, 1);
      for (let k = 0; k < 8; k++) { rayas.g.fillStyle = k % 2 ? "#f3e9d6" : mezclar(pu.color, 0.4, "#8a6a4a"); rayas.g.fillRect(k * 32, 0, 32, 64); }
      const toldo = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.08, 2.2), [tela, tela, new THREE.MeshStandardMaterial({ map: rayas.t, roughness: 0.95 }), tela, tela, tela]);
      toldo.position.set(0, 3.45, 0); toldo.rotation.x = 0.25; pg.add(toldo);
      const borde = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.04, 0.06), oro); borde.position.set(0, 3.17, 1.07); pg.add(borde);
      const letrero = letreroPlano(`${pu.icono} ${pu.nombre}`, pu.color, 3.8); letrero.position.set(0, 4.25, -0.2); pg.add(letrero);
      const b = spriteBrillo("#ffcf7a", 1.4); b.position.set(0, 3.1, 0.6); b.material.opacity = 0.5; pg.add(b);
      // mercancía sobre el mostrador
      pu.mercancia.forEach((e, k) => { const sp = spriteEmoji(e, 0.75); sp.position.set(-1.2 + k * 1.2, 1.6, 0.1); pg.add(sp); });
      const rob = robot(pu.color, 0, -1.4, 0.9); pg.add(rob); anim.push((t, dt) => { if (!quieto) rob.userData.animar(t, dt); });
      pg.updateMatrixWorld(true);
      obst.push({ caja: pg, x0: -2.3, x1: 2.3, z0: -2.2, z1: 0.8 });
      lugar("puesto:" + pu.id, pg, new THREE.Vector3(0, 0, 2.6), new THREE.Vector3(0, 0, 0));
      puestos3d[pu.id] = { pg, rob };
    });
    etiquetas.push({ el: cfg.etiqueta({ id: "mercado", icono: "🛒", nombre: "Mercado", color: "#ffd76a" }), pos: new THREE.Vector3(mod.centro.x, 12, mod.centro.z) });
    lugar("mercado", g, new THREE.Vector3(0, 0, 4.5), new THREE.Vector3(0, 0, -1), false);
  }

  // ----- Mi cultivo: 8 parcelas y tu tienda virtual -----
  const parcelas3d = [];
  let tienda3d = null;
  function crearCultivo() {
    const mod = modulo("micultivo", 270, D_EXT, R_ISLA, "#7dffb3", { tex: texPiedra("#d9cbb0", "rgba(120,95,65,.3)"), rep: 6 });
    const g = new THREE.Group(); g.position.set(mod.centro.x, 0.6, mod.centro.z); g.lookAt(0, 0.6, 0);
    scene.add(g);
    arcoEntrada(g, "MI CULTIVO", "#7a9a5a", R_ISLA - 1.2);
    // invernadero victoriano: costillas de hierro blanco y cristal sobre las parcelas
    const hierro = new THREE.MeshStandardMaterial({ color: "#f4f0e6", roughness: 0.4, metalness: 0.5 });
    [-8.2, -4.6, -1, 2.6].forEach((z) => {
      const costilla = new THREE.Mesh(new THREE.TorusGeometry(10, 0.1, 6, 48, Math.PI), hierro); costilla.position.set(0, 0, z); costilla.scale.y = 0.62; g.add(costilla);
    });
    const cristal = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 10.8, 40, 1, true, -Math.PI / 2, Math.PI), matCristal);
    cristal.rotation.x = -Math.PI / 2; cristal.scale.set(1, 1, 0.62); cristal.position.set(0, 0, -2.8); g.add(cristal);
    const cumbrera = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 10.8), oro); cumbrera.position.set(0, 6.2, -2.8); g.add(cumbrera);
    const tierra = new THREE.MeshStandardMaterial({ color: "#4a2f1c", roughness: 1 });
    for (let i = 0; i < 8; i++) {
      const x = [-6.9, -2.3, 2.3, 6.9][i % 4], z = i < 4 ? 1.2 : -4.6;
      const pg = new THREE.Group(); pg.position.set(x, 0, z); pg.userData = { tipo: "parcela", id: i };
      g.add(pg); tocables.push(pg);
      const cama = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 3), madera); cama.position.y = 0.3; pg.add(cama);
      const suelo = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 2.7), tierra); suelo.position.y = 0.62; pg.add(suelo);
      const filo = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.05, 3.05), oro); filo.position.y = 0.6; pg.add(filo);
      const planta = new THREE.Group(); planta.position.y = 0.66; pg.add(planta);
      const extras = new THREE.Group(); pg.add(extras);
      const num = letreroPlano(`${i + 1}`, "#7a9a5a", 0.9); num.position.set(0, 0.35, 1.52); pg.add(num);
      obst.push({ caja: g, x0: x - 1.6, x1: x + 1.6, z0: z - 1.6, z1: z + 1.6 });
      lugar("parcela:" + i, g, new THREE.Vector3(x, 0, z + 2.5), new THREE.Vector3(x, 0, z), false);
      parcelas3d.push({ pg, planta, extras, clave: "" });
    }
    // tu tienda virtual al fondo
    const tg = new THREE.Group(); tg.position.set(0, 0, -11); tg.userData = { tipo: "tienda", id: "tienda" }; g.add(tg); tocables.push(tg);
    const muro = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 0.4), blanco); muro.position.set(0, 2, -1.2); tg.add(muro);
    const repisa = [0.9, 1.9, 2.9].map((y) => { const r = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 0.6), madera); r.position.set(0, y, -0.8); tg.add(r); return r; });
    const most = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1), madera); most.position.set(0, 0.55, 1); tg.add(most);
    const cubT = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.06, 1.1), oro); cubT.position.set(0, 1.12, 1); tg.add(cubT);
    const letrero = letreroPlano("TU TIENDA", "#7a9a5a", 5); letrero.position.set(0, 4.7, -1); tg.add(letrero);
    const rob = robot("#7a9a5a", 2.6, 0.6, 0.9); tg.add(rob); anim.push((t, dt) => { if (!quieto) rob.userData.animar(t, dt); });
    const productos = new THREE.Group(); tg.add(productos);
    obst.push({ caja: g, x0: -4.2, x1: 4.2, z0: -12.6, z1: -9.4 });
    lugar("tienda", g, new THREE.Vector3(0, 0, -7.6), new THREE.Vector3(0, 0, -11));
    tienda3d = { productos, rob };
    etiquetas.push({ el: cfg.etiqueta({ id: "micultivo", icono: "🌱", nombre: "Mi cultivo", color: "#7dffb3" }), pos: new THREE.Vector3(mod.centro.x, 12, mod.centro.z) });
    lugar("micultivo", g, new THREE.Vector3(0, 0, 3.5), new THREE.Vector3(0, 0, -3), false);
  }
  // Dibuja las plantas según el estado (lo manda la interfaz)
  function setParcelas(lista) {
    lista.forEach((p, i) => {
      const P = parcelas3d[i]; if (!P) return;
      const etapa = !p ? -1 : p.listo ? 4 : Math.min(3, Math.floor(p.prog * 4));
      const clave = `${etapa}|${p ? p.tipo : ""}|${p ? p.aditamentos.join(",") : ""}`;
      if (clave === P.clave) return;
      P.clave = clave;
      P.planta.clear(); P.extras.clear();
      if (!p) return;
      if (etapa === 0) { const b = spriteEmoji("🌱", 0.9); b.position.y = 0.4; P.planta.add(b); }
      else {
        const alto = [0, 0.9, 1.6, 2.3, 2.6][etapa];
        const tallo = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, alto, 8), verde); tallo.position.y = alto / 2; P.planta.add(tallo);
        const hojas = etapa + 2;
        for (let k = 0; k < hojas; k++) {
          const a = (k / hojas) * Math.PI * 2, y = alto * (0.35 + 0.6 * (k / hojas));
          const h = spriteEmoji(p.tipo === "canamo" ? "🌾" : "🌿", 0.7 + etapa * 0.18); h.position.set(Math.cos(a) * 0.35, y, Math.sin(a) * 0.35); P.planta.add(h);
        }
        if (etapa === 4) {
          const flor = spriteEmoji(p.tipo === "canamo" ? "🌾" : "🌼", 1.1); flor.position.y = alto + 0.3; P.planta.add(flor);
          const brillo = spriteBrillo("#ffd76a", 3.2); brillo.position.y = alto * 0.7; brillo.material.opacity = 0.7; P.planta.add(brillo);
          const chispa = spriteEmoji("✨", 0.8); chispa.position.set(0.7, alto + 0.6, 0); P.planta.add(chispa);
        }
      }
      // aditamentos visibles
      if (p.aditamentos.includes("lampara")) {
        const lam = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.8), matLinterna); lam.position.y = 3.8; P.extras.add(lam);
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5), gris); cable.position.y = 4.6; P.extras.add(cable);
        const luz = spriteBrillo("#fff1a8", 3); luz.position.y = 3.6; luz.material.opacity = 0.6; P.extras.add(luz);
      }
      p.aditamentos.filter((a) => a !== "lampara").forEach((a, k) => {
        const ico = { nutrientes: "🧪", riego: "💧", extractor: "🌀", sensor: "📟", maceta: "🪴", micorrizas: "🍄" }[a] || "✨";
        const sp = spriteEmoji(ico, 0.45); sp.position.set(-1.1 + k * 0.45, 0.95, 1.3); P.extras.add(sp);
      });
    });
  }
  function setTienda(items) {
    if (!tienda3d) return;
    tienda3d.productos.clear();
    items.forEach((it, k) => { const sp = spriteEmoji(it.icono, 0.8); sp.position.set(-2.6 + (k % 3) * 2.6, [1.35, 2.35][Math.floor(k / 3)] || 2.35, -0.7); tienda3d.productos.add(sp); });
  }
  // Un comprador llega a tu tienda: el robot saluda y sale una bolsita
  function venta() {
    if (!tienda3d) return;
    tienda3d.rob.userData.saludar();
    const b = spriteEmoji("🛍️", 1); b.position.set(0, 2, 1.4); tienda3d.productos.parent.add(b);
    let t = 0; const f = (tt, dt) => { t += dt; b.position.y = 2 + t * 2; b.material.opacity = Math.max(0, 1 - t / 1.5); if (t > 1.5) { b.removeFromParent(); anim.splice(anim.indexOf(f), 1); } };
    anim.push(f);
  }

  // ----- el globo aerostático del paseo (anclado en el patio central) -----
  const NAVE_BASE = new THREE.Vector3(-8.8, 0.7, 3.6); // fondo de la canasta (a un lado, para no tapar la pantalla)
  const nave = new THREE.Group(); nave.position.copy(NAVE_BASE); nave.userData = { tipo: "nave", id: "nave" };
  scene.add(nave); tocables.push(nave);
  const envoltura = new THREE.Group(); nave.add(envoltura);
  {
    const mimbre = new THREE.MeshStandardMaterial({ color: "#9a6b3c", roughness: 0.9 });
    const canasta = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.8, 1.1, 16), mimbre); canasta.position.y = 0.55; nave.add(canasta);
    const borde = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.08, 6, 24), new THREE.MeshStandardMaterial({ color: "#5a3b22", roughness: 0.8 })); borde.rotation.x = Math.PI / 2; borde.position.y = 1.1; nave.add(borde);
    // gajos de la tela: crema, terracota, dorado y salvia
    const tx = texCanvas(512, 256);
    const cols = ["#f3ead8", "#b4683f", "#f3ead8", "#d4ad62", "#f3ead8", "#7a9a7a"];
    for (let i = 0; i < 24; i++) { tx.g.fillStyle = cols[i % cols.length]; tx.g.fillRect((i * 512) / 24, 0, 512 / 24 + 1, 256); }
    tx.g.fillStyle = "#2b2016"; tx.g.fillRect(0, 150, 512, 22); tx.g.fillStyle = "#d4ad62"; tx.g.fillRect(0, 146, 512, 3); tx.g.fillRect(0, 173, 512, 3);
    tx.g.fillStyle = "#f3ead8"; tx.g.font = `700 15px ${FUENTE}`; tx.g.textAlign = "center"; tx.g.textBaseline = "middle";
    for (let k = 0; k < 4; k++) tx.g.fillText("WEEDLAND", 64 + k * 128, 162);
    const perfil = [];
    for (let i = 0; i <= 20; i++) { const u = i / 20, y = u * 7.2; const r = u < 0.5 ? 0.8 + Math.sin((u / 0.5) * Math.PI / 2) * 2.3 : 3.1 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.5) / 0.5, 2))) + (u < 1 ? 0 : 0); perfil.push(new THREE.Vector2(Math.max(0.001, r), y)); }
    const tela3d = new THREE.Mesh(new THREE.LatheGeometry(perfil, 32), new THREE.MeshStandardMaterial({ map: tx.t, roughness: 0.75, side: THREE.DoubleSide }));
    tela3d.position.y = 3.1; envoltura.add(tela3d);
    const cuerdas = [];
    [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(([x, z]) => cuerdas.push(new THREE.Vector3(x * 0.85, 1.1, z * 0.85), new THREE.Vector3(x, 3.15, z)));
    nave.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cuerdas), new THREE.LineBasicMaterial({ color: "#5a3b22" })));
    const fuego = spriteBrillo("#ffb45a", 1.6); fuego.position.y = 2.6; nave.add(fuego);
    anim.push((t) => { if (!tour) { envoltura.rotation.z = Math.sin(t * 0.7) * 0.025; envoltura.rotation.x = Math.sin(t * 0.5) * 0.02; } fuego.material.opacity = 0.5 + Math.sin(t * 9) * 0.2; });
    // con el globo de Meshy: se esconden canasta, cuerdas y tela, y el modelo va en la envoltura (se mece igual)
    plantilla("globo").then((p) => {
      if (!p) return;
      const c = copia(p, { alto: 10.3 });
      nave.children.forEach((h) => { if (h !== envoltura && h !== fuego) h.visible = false; });
      tela3d.visible = false; envoltura.add(c.obj);
    });
    obst.push({ c: [NAVE_BASE.x, NAVE_BASE.z, 1.3] });
    etiquetas.push({ el: cfg.etiqueta({ id: "nave", icono: "🎈", nombre: "Paseo en globo", color: ORO }), pos: new THREE.Vector3(NAVE_BASE.x, 11.8, NAVE_BASE.z) });
    lugares.nave = { p: new THREE.Vector3(-6.0, 0, 6.6), mirar: NAVE_BASE.clone(), entrar: true };
  }

  // ----- el cenote: un ojo de agua en la selva, al fondo, detrás del Mercado -----
  const matCenote = matAgua.clone(); matCenote.uniforms = { t: matAgua.uniforms.t, claro: { value: new THREE.Color("#55e3d2") }, hondo: { value: new THREE.Color("#0b5c6a") } };
  {
    const roca = new THREE.MeshStandardMaterial({ map: repetir(texPiedra("#8a7a62", "rgba(40,30,20,.45)"), 6, 3), roughness: 0.95, side: THREE.DoubleSide });
    const pared = new THREE.Mesh(new THREE.CylinderGeometry(10, 8.6, 24, 40, 3, true), roca); pared.position.set(CENOTE.x, 0.56 - 12, CENOTE.z); scene.add(pared);
    const agua = new THREE.Mesh(new THREE.CircleGeometry(8.8, 40), matCenote); agua.rotation.x = -Math.PI / 2; agua.position.set(CENOTE.x, -10, CENOTE.z); scene.add(agua);
    const haz = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 4.5, 18, 20, 1, true), new THREE.MeshBasicMaterial({ color: "#fff2c8", transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    haz.position.set(CENOTE.x + 1.5, -3, CENOTE.z); haz.rotation.z = 0.15; scene.add(haz);
    for (let k = 0; k < 26; k++) { const a = (k / 26) * Math.PI * 2; arbustosLista.push([CENOTE.x + Math.cos(a) * 11.2, CENOTE.z + Math.sin(a) * 11.2, 0.6 + Math.random() * 0.6]); }
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + 0.3; palma(CENOTE.x + Math.cos(a) * 14, CENOTE.z + Math.sin(a) * 14, 9 + Math.random() * 4, false); }
  }

  // ----- paseo en globo: recorrido narrado + descenso al cenote + regreso -----
  const RUTA_TOUR = new THREE.CatmullRomCurve3([
    NAVE_BASE.clone(), new THREE.Vector3(0, 12, 24), new THREE.Vector3(0, 22, 70), new THREE.Vector3(30, 24, 82), new THREE.Vector3(52, 24, 50),
    new THREE.Vector3(96, 24, 22), new THREE.Vector3(66, 25, -36), new THREE.Vector3(30, 25, -80), new THREE.Vector3(-24, 25, -82),
    new THREE.Vector3(-62, 25, -40), new THREE.Vector3(-98, 24, 6), new THREE.Vector3(-58, 25, 54), new THREE.Vector3(-24, 30, 18),
    new THREE.Vector3(-6, 32, -70), new THREE.Vector3(0, 24, -128), new THREE.Vector3(0, 12, -160), new THREE.Vector3(0, 1, -167), new THREE.Vector3(0, -14, -171),
  ]);
  const RUTA_REGRESO = new THREE.CatmullRomCurve3([new THREE.Vector3(30, 120, 220), new THREE.Vector3(26, 60, 110), new THREE.Vector3(8, 18, 34), NAVE_BASE.clone()]);
  const T_IDA = 58, T_TUNEL = 18, T_REGRESO = 14;
  const GUION = [
    [0, "Bienvenido a bordo. Soy Nova y hoy te llevo en globo sobre la hacienda Weedland."],
    [5, "Abajo está el invernadero de Mi cultivo: ahí siembras las semillas registradas de las marcas y abres tu propia tienda."],
    [13, "Este es el claustro de Cultivo: iluminación, riego y sustratos, cada marca bajo sus portales."],
    [19, "A la derecha, la casa de LumenGrow: una marca con su propia casa, su jardín y sus pantallas."],
    [24, "El claustro de Genética: bancos de semillas de varios países."],
    [29, "Ese es el Mercado y botica. Ahí compras aditamentos y transformas tu cosecha en cuerdas, telas, aceites y más."],
    [34, "El claustro de Accesorios: vidrio, papeles, básculas y diseño."],
    [39, "Y la casa de Vapor Norte, otra marca con su propio espacio."],
    [44, "Por último, el claustro de Cáñamo y bienestar: ropa, cosmética y alimentos."],
    [50, "Respira profundo… vamos a bajar al cenote."],
    [T_IDA + 2, "Agua, luz y color. Déjate llevar."],
    [T_IDA + T_TUNEL + 1, "De regreso en la hacienda. Gracias por volar con Weedland."],
  ];
  let tour = null;
  // escena del cenote (descenso)
  const tunel = new THREE.Scene();
  const camTunel = new THREE.PerspectiveCamera(75, 1, 0.1, 1200);
  const matTunel = new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { t: { value: 0 } },
    vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `uniform float t; varying vec2 vU;
      vec3 pal(float x){ return 0.5 + 0.5*cos(6.2831*(x + vec3(0.0,0.33,0.67))); }
      void main(){
        float a = vU.x*6.2831, y = vU.y*60.0;
        float k = smoothstep(3.0, 10.0, t) * (1.0 - smoothstep(15.0, 18.0, t) * 0.5);
        // agua turquesa con cáusticas
        float o = sin(a*5.0 + y*0.5 + t*1.3) + sin(a*7.0 - y*0.35 - t*1.7) + sin(y*0.9 + t*0.8 + a*2.0);
        float caus = pow(abs(sin(o*1.2)), 6.0);
        vec3 agua = mix(vec3(0.02,0.16,0.2), vec3(0.16,0.62,0.64), 0.5 + 0.5*sin(y*0.15 - t*0.8)) + vec3(0.75,1.0,0.92)*caus*0.5;
        // bioluminiscencia: colores que fluyen
        float giro = sin(a*3.0 + y*0.35 - t*2.0);
        float banda = 0.5 + 0.5*sin(y*1.3 - t*5.0 + giro*1.6);
        vec3 bio = pal(vU.y*1.2 + t*0.05 + giro*0.08 + 0.45) * (0.3 + 0.7*banda);
        bio = mix(bio, vec3(0.1,0.95,0.8)*banda, 0.3);
        vec3 c = mix(agua, bio, k*0.85);
        c += vec3(1.0,0.95,0.8) * pow(max(0.0, sin(a*8.0 + y*0.6 - t*3.0)), 18.0) * 0.45 * k;
        float fondo = smoothstep(0.0, 0.25, vU.y);
        gl_FragColor = vec4(c*fondo, 1.0);
      }`,
  });
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 900, 48, 1, true), matTunel);
  tubo.rotation.x = Math.PI / 2; tubo.position.z = -440; tunel.add(tubo);
  const estrellasT = (() => {
    const n = 500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const tonos = ["#9ff7ea", "#ffe7a8", "#7fd6ff", "#c8ffb0"].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = 1 + Math.random() * 7; pos.set([Math.cos(a) * r, Math.sin(a) * r, -Math.random() * 400], i * 3); const c = tonos[i % 4]; col.set([c.r, c.g, c.b], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pt = texCanvas(64, 64); { const r = pt.g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)"); pt.g.fillStyle = r; pt.g.fillRect(0, 0, 64, 64); }
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.25, map: pt.t, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    tunel.add(p); return p;
  })();

  function iniciarTour(cb) {
    if (tour) return;
    ruta = []; aro.visible = false; stick.x = stick.y = 0;
    tour = { t0: performance.now(), cb, dicho: -1, fase: "ida" };
    controls.enabled = false; yo.visible = false; ver = false;
    cfg.alCerca && cfg.alCerca(null);
  }
  function terminarTour() {
    if (!tour) return;
    const cb = tour.cb; tour = null;
    nave.position.copy(NAVE_BASE); nave.rotation.set(0, 0, 0);
    controls.enabled = true; yo.visible = true; ver = true;
    saltarA(lugares.nave.p, NAVE_BASE);
    camera.position.copy(objYo().add(offset)); controls.target.copy(objYo());
    mirarHacia(NAVE_BASE.clone());
    cb && cb.alFin && cb.alFin();
  }
  const tg1 = new THREE.Vector3(), tg2 = new THREE.Vector3(), mira = new THREE.Vector3();
  // vas dentro de la canasta: la cámara va a la altura de tus ojos y mira hacia adelante y abajo
  function vistaCanasta(dt, bajar = 7, alCentro = 0) {
    const dir = tg2.clone().sub(tg1); dir.y *= 0.3; if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); dir.normalize();
    const giro = Math.atan2(dir.x, dir.z);
    let dA = giro - nave.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); nave.rotation.y += dA * Math.min(1, dt * 2);
    const frente = new THREE.Vector3(Math.sin(nave.rotation.y), 0, Math.cos(nave.rotation.y));
    camera.position.copy(nave.position).add(new THREE.Vector3(0, 2.6, 0)).addScaledVector(frente, -0.5);
    mira.copy(nave.position).addScaledVector(frente, 20).add(new THREE.Vector3(0, 2.6 - bajar, 0));
    // mientras recorre, mira también hacia la hacienda (lo que Nova va narrando)
    if (alCentro > 0) { const c = new THREE.Vector3(-nave.position.x, 0, -nave.position.z); const d = Math.min(34, c.length()); c.setLength(d).add(nave.position); c.y = 0.6; mira.lerp(c, alCentro); }
    controls.target.lerp(mira, Math.min(1, dt * 3)); camera.lookAt(controls.target);
  }
  function actualizarTour(ahora, dt) {
    const s = (ahora - tour.t0) / 1000;
    // narración
    for (let i = tour.dicho + 1; i < GUION.length && GUION[i][0] <= s; i++) { tour.dicho = i; tour.cb.alTexto && tour.cb.alTexto(GUION[i][1]); }
    if (s < T_IDA) {
      const u = Math.min(1, s / T_IDA);
      RUTA_TOUR.getPoint(u, tg1); RUTA_TOUR.getPoint(Math.min(1, u + 0.004), tg2);
      nave.position.copy(tg1);
      vistaCanasta(dt, u > 0.88 ? 7 + (u - 0.88) * 120 : 7, u < 0.78 ? 0.55 : Math.max(0, 0.55 - (u - 0.78) * 6));
      return scene;
    }
    if (s < T_IDA + T_TUNEL) {
      if (tour.fase !== "tunel") { tour.fase = "tunel"; tour.cb.alFase && tour.cb.alFase("tunel"); }
      const k = s - T_IDA;
      matTunel.uniforms.t.value = k;
      camTunel.position.set(Math.sin(k * 0.6) * 1.3, Math.cos(k * 0.45) * 1.0, 0);
      camTunel.rotation.set(0, 0, k * 0.18);
      const pos = estrellasT.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { let z = pos.getZ(i) + dt * 90; if (z > 5) z -= 400; pos.setZ(i, z); }
      pos.needsUpdate = true;
      return tunel;
    }
    if (s < T_IDA + T_TUNEL + T_REGRESO) {
      if (tour.fase !== "regreso") { tour.fase = "regreso"; tour.cb.alFase && tour.cb.alFase("regreso"); }
      const u = Math.min(1, (s - T_IDA - T_TUNEL) / T_REGRESO), e = 1 - Math.pow(1 - u, 2);
      RUTA_REGRESO.getPoint(e, tg1); RUTA_REGRESO.getPoint(Math.min(1, e + 0.01), tg2);
      nave.position.copy(tg1);
      if (u < 0.9) vistaCanasta(dt, 9);
      else { // al final, la cámara sale de la canasta y queda detrás del globo ya anclado
        const atras = tg1.clone().add(new THREE.Vector3(0, 9, 16));
        camera.position.lerp(atras, Math.min(1, dt * 3)); controls.target.lerp(tg1.clone().add(new THREE.Vector3(0, 3, 0)), Math.min(1, dt * 3)); camera.lookAt(controls.target);
      }
      return scene;
    }
    terminarTour();
    return scene;
  }

  // ----- drones dorados con publicidad (discretos) -----
  const drones = [];
  function pintarDron(d) {
    const img = (stands[d.m.id] && stands[d.m.id].med || {}).banner;
    d.bt.g.clearRect(0, 0, 640, 240);
    if (img) { d.bt.g.save(); rr(d.bt.g, 0, 0, 640, 240, 26); d.bt.g.clip(); dibujarEn(d.bt.g, img, 0, 0, 640, 240, "llenar"); d.bt.g.restore(); d.bt.g.strokeStyle = ORO; d.bt.g.lineWidth = 6; rr(d.bt.g, 3, 3, 634, 234, 24); d.bt.g.stroke(); }
    else dibujarBanner(d.bt.g, 640, 240, d.m);
    d.bt.t.needsUpdate = true;
  }
  function crearDron(m, i, total) {
    const g = new THREE.Group(); g.userData = { tipo: "dron", id: m.id };
    scene.add(g); tocables.push(g);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.3, 16), blanco));
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 24), oro); anillo.rotation.x = Math.PI / 2; g.add(anillo);
    const luz = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), neon(m.color)); luz.position.y = -0.2; g.add(luz);
    const helices = [];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
      const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), oro); brazo.position.set(x * 0.55, 0, z * 0.55); brazo.rotation.y = Math.atan2(z, x) * -1; g.add(brazo);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 16), new THREE.MeshBasicMaterial({ color: "#fff6e0", transparent: true, opacity: 0.3 }));
      h.position.set(x * 0.85, 0.15, z * 0.85); g.add(h); helices.push(h);
    });
    const bt = texCanvas(640, 240, 0.75);
    dibujarBanner(bt.g, 640, 240, m); bt.t.needsUpdate = true;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.95), new THREE.MeshBasicMaterial({ map: bt.t, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    banner.position.y = -2.1; g.add(banner);
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.4, -0.2, 0), new THREE.Vector3(-2.4, -1.15, 0), new THREE.Vector3(0.4, -0.2, 0), new THREE.Vector3(2.4, -1.15, 0)]), new THREE.LineBasicMaterial({ color: ORO })));
    const R = 22 + (i % 4) * 18, h = 14 + (i % 3) * 4, w = (0.035 + (i % 2) * 0.015) * (i % 2 ? 1 : -1), fase = (i / total) * Math.PI * 2;
    drones.push({ m, g, bt });
    vestir(g, "dron", { ancho: 2.4, y: -0.3 }).then((c) => { if (c) g.children.forEach((h) => { if (h === banner || h.isLineSegments) h.visible = true; }); });
    anim.push((t) => {
      const a = fase + t * (quieto ? 0.004 : w);
      g.position.set(Math.cos(a) * R, h + Math.sin(t * 0.8 + fase) * 1.0, Math.sin(a) * R);
      g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z);
      if (!quieto) helices.forEach((hh) => (hh.rotation.y += 0.6));
      banner.rotation.z = Math.sin(t * 1.3 + fase) * 0.03;
    });
  }

  // ----- construir según las marcas -----
  let lista = cfg.marcas;
  PABELLONES.forEach((p) => {
    const zona = ZONAS[p.id] || ZONAS.genetica;
    const mod = modulo(p.id, p.angulo, D_PAB, R_PAB, p.color, { radio: R_MURO + 0.8, tex: texLosas("#ece3d1", zona.tinte), rep: 7 });
    claustro(mod, p, zona);
    decorarZona(mod, zona);
    // Medallón en el piso del centro (se puede caminar encima)
    const em = texCanvas(512, 512, 0.5);
    em.g.fillStyle = "#f3ead8"; em.g.beginPath(); em.g.arc(256, 256, 252, 0, Math.PI * 2); em.g.fill();
    em.g.strokeStyle = ORO; em.g.lineWidth = 12; em.g.beginPath(); em.g.arc(256, 256, 238, 0, Math.PI * 2); em.g.stroke();
    em.g.lineWidth = 3; em.g.beginPath(); em.g.arc(256, 256, 214, 0, Math.PI * 2); em.g.stroke();
    em.g.textAlign = "center"; em.g.textBaseline = "middle"; em.g.font = "170px serif"; em.g.fillText(p.icono, 256, 220);
    em.g.fillStyle = CAFE; ajustar(em.g, p.nombre.toUpperCase(), 360, 50); em.g.fillText(p.nombre.toUpperCase(), 256, 380);
    const emb = capa(new THREE.CircleGeometry(5, 48), new THREE.MeshStandardMaterial({ map: em.t, transparent: true, roughness: 0.6 }), 0.625);
    emb.position.set(mod.centro.x, 0.625, mod.centro.z);
    emb.rotation.z = Math.atan2(mod.haciaPlaza.x, mod.haciaPlaza.z) + Math.PI; scene.add(emb);
    // 12 stands en círculo: el premium queda enfrente de la entrada
    const ms = lista.filter((m) => m.pab === p.id && m.nivel !== "isla");
    const prem = ms.find((m) => m.nivel === "premium");
    const normales = ms.filter((m) => m !== prem);
    const orden = [...normales.slice(0, Math.ceil(normales.length / 2)), ...(prem ? [prem] : []), ...normales.slice(Math.ceil(normales.length / 2))];
    const anchoAng = (m) => ((m.nivel === "premium" ? 12.3 : 7.8) / R_ANILLO);
    const hueco = rad(34), total = orden.reduce((a, m) => a + anchoAng(m), 0), sobra = (Math.PI * 2 - hueco - total) / orden.length;
    const baseAng = Math.atan2(-mod.haciaPlaza.z, mod.haciaPlaza.x); // ángulo (sistema x,-z) que apunta a la plaza
    let a = baseAng + hueco / 2 + sobra / 2;
    orden.forEach((m) => { const w = anchoAng(m); crearStand(m, mod, a + w / 2, m.nivel === "premium"); a += w + sobra; });
    etiquetas.push({ el: cfg.etiqueta({ id: p.id, icono: p.icono, nombre: p.nombre, color: p.color }), pos: new THREE.Vector3(mod.centro.x, 12, mod.centro.z) });
  });
  crearMercado();
  crearCultivo();
  lista.filter((m) => m.nivel === "isla").forEach(crearIsla);
  const conDron = [...lista.filter((m) => m.nivel === "isla"), ...lista.filter((m) => m.nivel === "premium"), ...lista.filter((m) => !m.nivel)].slice(0, 9);
  conDron.forEach((m, i) => crearDron(m, i, conDron.length));
  Object.values(stands).forEach((s) => anim.push((t, dt) => { if (!quieto && s.cerca) s.anim.forEach((f) => f(t, dt)); }));

  // ----- jardines entre los claustros: estanques con palmas y palapas con camastros -----
  const jardines = [];
  {
    const paja = new THREE.MeshStandardMaterial({ color: "#b8925a", roughness: 1, flatShading: true });
    for (let k = 0; k < 8; k++) {
      const a = rad(22.5 + k * 45), x = Math.cos(a) * 78, z = -Math.sin(a) * 78;
      jardines.push([x, z]);
      if (k % 2 === 0) {
        // cascada de terrazas que cae a un estanque con lotos, mirando a la plaza
        const c = cascada({ x, z, frente: Math.atan2(-x, -z), matPiedra: gris, matAgua, matCaida, flora, pisos: 3 });
        scene.add(c);
        obst.push({ c: [x, z, 6.2] });
        const atras = new THREE.Vector3(0, 0, -8.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.rotation.y).add(c.position); obst.push({ c: [atras.x, atras.z, 5] });
        for (let i = 0; i < 4; i++) { const b = a + 0.4 + i * (Math.PI / 2); palma(x + Math.cos(b) * 6.6, z - Math.sin(b) * 6.6, 8 + Math.random() * 3); mata(x + Math.cos(b + 0.7) * 6, z - Math.sin(b + 0.7) * 6, 0.9); }

      } else {
        const pg = new THREE.Group(); pg.position.set(x, 0.56, z); pg.rotation.y = Math.atan2(-x, -z); scene.add(pg);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.2, 8), madera); p.position.set(sx * 2.6, 1.6, sz * 2.6); pg.add(p); });
        const techoP = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.4, 10), paja); techoP.position.y = 4.3; pg.add(techoP);
        [-1.1, 1.1].forEach((cx) => {
          const cama = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 2.4), madera); cama.position.set(cx, 0.3, 0.2); pg.add(cama);
          const coj = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.18, 2.2), tela); coj.position.set(cx, 0.6, 0.2); pg.add(coj);
          const resp = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.18, 0.8), tela); resp.position.set(cx, 0.85, -0.85); resp.rotation.x = -0.6; pg.add(resp);
        });
        const mesita = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.5, 12), gris); mesita.position.set(0, 0.25, 0.9); pg.add(mesita);
        const vela = spriteBrillo("#ffcf7a", 1.4); vela.position.set(0, 0.7, 0.9); vela.material.opacity = 0.8; pg.add(vela);
        pg.updateMatrixWorld(true);
        vestir(pg, "palapa-camastro", { ancho: 6 });
        obst.push({ caja: pg, x0: -2.9, x1: 2.9, z0: -2.9, z1: 2.9 });
        [-1, 1].forEach((s) => palma(x + Math.cos(a + s * 0.12) * 7, z - Math.sin(a + s * 0.12) * 7, 9 + Math.random() * 2));
        for (let i = 0; i < 22; i++) { const b = (i / 22) * Math.PI * 2; flora.flor(x + Math.cos(b) * 4.4, z + Math.sin(b) * 4.4, 1, i % 2 ? PALETAS.coral : PALETAS.rosa); }
      }
    }
  }
  // ----- modelos sueltos que se acomodan desde modelos.json ("colocar": [[x, z, giro], ...]), p. ej. bancas -----
  listaModelos().then((l) => Object.entries(l).forEach(([id, c]) => {
    if (!c || !Array.isArray(c.colocar) || !c.colocar.length) return;
    plantilla(id).then((p) => {
      if (!p) return;
      c.colocar.forEach(([x, z, gr = 0]) => {
        const k = copia(p, { giro: gr }); k.obj.position.set(x, altura(x, z), z); scene.add(k.obj);
        if (k.mixer) anim.push((t, dt) => { if (!quieto) k.update(dt); });
        const tm = k.obj.userData.tam; obst.push({ c: [x, z, Math.max(tm.x, tm.z) * 0.45] });
      });
      libreCache.clear(); // las rutas ya cuentan los nuevos obstáculos
    });
  }));

  // ----- palmas sueltas en el pasto (lejos de patios, senderos y jardines) -----
  {
    const lejosDeTodo = (x, z, m) => {
      const r = Math.hypot(x, z); if (r < R_PLAZA + 5 || r > R_MUNDO - 4) return false;
      for (const id in modulos) { const mo = modulos[id]; const lim = (mo.d === D_PAB ? R_MURO + 1 : mo.r) + m; if (Math.hypot(x - mo.centro.x, z - mo.centro.z) < lim) return false; }
      for (let k = 0; k < 8; k++) { const a = rad(k * 45), ax = Math.cos(a), az = -Math.sin(a), largo = x * ax + z * az, lado = Math.abs(-x * az + z * ax); if (largo > 0 && lado < 7) return false; }
      for (const [jx, jz] of jardines) if (Math.hypot(x - jx, z - jz) < 10) return false;
      return true;
    };
    let n = 0, intentos = 0;
    while (n < (ligero ? 34 : 60) && intentos++ < 3000) { const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 90, x = Math.cos(a) * r, z = Math.sin(a) * r; if (lejosDeTodo(x, z, 4)) { if (n % 2) { flora.cipres(x, z, 8 + Math.random() * 5); obst.push({ c: [x, z, 0.7] }); } else palma(x, z, 7 + Math.random() * 5); n++; } }
    n = 0; intentos = 0;
    while (n < (ligero ? 40 : 80) && intentos++ < 3000) { const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 90, x = Math.cos(a) * r, z = Math.sin(a) * r; if (lejosDeTodo(x, z, 2)) { const pal = [PALETAS.buganvilia, PALETAS.rosa, PALETAS.coral, PALETAS.blanco, PALETAS.amarillo][n % 5]; for (let i = 0; i < 5; i++) flora.flor(x + (Math.random() - 0.5) * 3, z + (Math.random() - 0.5) * 3, 1 + Math.random() * 0.6, pal); n++; } }
    n = 0; intentos = 0;
    while (n < (ligero ? 50 : 90) && intentos++ < 3000) { const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 90, x = Math.cos(a) * r, z = Math.sin(a) * r; if (lejosDeTodo(x, z, 2)) { mata(x, z, 0.7 + Math.random() * 0.6); n++; } }
  }
  // ----- albarrada (muro bajo de piedra seca) y la selva alrededor -----
  {
    const piedras = new THREE.MeshStandardMaterial({ map: repetir(texPiedra("#bfae90", "rgba(70,55,40,.5)", 128), 160, 1), roughness: 1, side: THREE.DoubleSide });
    const alb = new THREE.Mesh(new THREE.CylinderGeometry(R_MUNDO + 2, R_MUNDO + 2.3, 1.3, 180, 1, true), piedras); alb.position.y = 1.2; scene.add(alb);
    const n = ligero ? 170 : 330;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = R_MUNDO + 7 + Math.pow(Math.random(), 0.7) * 110, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - CENOTE.x, z - CENOTE.z) < 20) continue;
      palma(x, z, 8 + Math.random() * 8, false);
    }
    for (let i = 0; i < (ligero ? 150 : 300); i++) {
      const a = Math.random() * Math.PI * 2, r = R_MUNDO + 4 + Math.random() * 120, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - CENOTE.x, z - CENOTE.z) < 13) continue;
      arbustosLista.push([x, z, 1 + Math.random() * 2.2]);
    }
    // silueta de selva y cerros a lo lejos (se pierde en la neblina dorada)
    const s = texCanvas(2048, 128);
    s.g.clearRect(0, 0, 2048, 128);
    s.g.fillStyle = "#8a7a9a";
    s.g.beginPath(); s.g.moveTo(0, 128);
    for (let x = 0; x <= 2048; x += 8) s.g.lineTo(x, 70 - Math.sin(x * 0.004) * 18 - Math.sin(x * 0.021) * 8 - Math.random() * 10);
    s.g.lineTo(2048, 128); s.g.fill();
    const sil = new THREE.Mesh(new THREE.CylinderGeometry(430, 430, 60, 96, 1, true), new THREE.MeshBasicMaterial({ map: s.t, transparent: true, side: THREE.BackSide, depthWrite: false }));
    sil.position.y = 20; scene.add(sil);
  }
  plantarPalmas(); plantarMatas(); encenderFaroles(); flora.plantar();

  // Pantallas grandes: cada cara muestra una marca distinta y rota cada 6 s (primero islas y premium)
  const destacadas = [...lista.filter((m) => m.nivel), ...lista.filter((m) => !m.nivel)];
  let turno = 0;
  function rotarPantallas() {
    pantallas.forEach((p) => {
      const m = destacadas[(turno + p.i * 5) % destacadas.length];
      p.cara.userData.id = m.id;
      dibujarAnuncioGrande(p.tx.g, 1024, 576, m); p.tx.t.needsUpdate = true;
    });
    turno++;
  }
  rotarPantallas();
  let reloj = 0, relojStand = 99, relojVideo = 0;

  // ---------- avatar ----------
  const yo = new THREE.Group(); scene.add(yo);
  // la figura de siempre medía 2.25 m con sombrero: se ajusta al alto de los personajes (~2.05 m, a escala de los stands)
  const figYo = new THREE.Group(); figYo.scale.setScalar(0.92); yo.add(figYo);
  const traje = new THREE.MeshStandardMaterial({ color: "#f6efe2", roughness: 0.9 });
  const acento = new THREE.MeshStandardMaterial({ color: "#7a8f6a", roughness: 0.85 });
  const tonoYo = piel("#b98a63");
  const piernas = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * 0.15, 0.9, 0); figYo.add(p);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.62, 4, 10), matPantalon); m.position.y = -0.44; p.add(m);
    return p;
  });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.31, 0.5, 6, 16), traje); torso.position.y = 1.3; figYo.add(torso);
  const cinto = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.035, 6, 24), oro); cinto.rotation.x = Math.PI / 2; cinto.position.y = 1.0; figYo.add(cinto);
  const mochila = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.14), acento); mochila.position.set(0.18, 1.08, -0.3); mochila.rotation.z = -0.2; figYo.add(mochila);
  const brazosYo = [-1, 1].map((s) => {
    const b = new THREE.Group(); b.position.set(s * 0.4, 1.62, 0); figYo.add(b);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), traje); m.position.y = -0.3; b.add(m);
    const mano = new THREE.Mesh(geoH.mano, tonoYo); mano.position.y = -0.63; b.add(mano);
    return b;
  });
  const casco = new THREE.Group(); casco.position.y = 2.0; figYo.add(casco);
  casco.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 14), tonoYo));
  const somYo = sombrero("#2b2016"); somYo.position.y = 0.17; somYo.scale.setScalar(1.05); casco.add(somYo);
  const sombraYo = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.22, depthWrite: false }));
  sombraYo.rotation.x = -Math.PI / 2; sombraYo.position.y = 0.02; yo.add(sombraYo);
  // con el avatar de Meshy (ws-avatar: "mujer" o "hombre"); si solo hay uno, ese
  {
    let cual = "hombre"; try { cual = localStorage.getItem("ws-avatar") || cual; } catch (e) {}
    listaModelos().then((l) => {
      const id = cfg.personaje && l[cfg.personaje] ? cfg.personaje : l["avatar-" + cual] ? "avatar-" + cual : l["avatar-hombre"] ? "avatar-hombre" : "avatar-mujer";
      vestir(yo, id, { alto: (l[id] && l[id].alto) || 2.05 }, [sombraYo]);
    });
  }
  const aro = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 32), new THREE.MeshBasicMaterial({ color: "#f3d48c", transparent: true, opacity: 0.9, depthWrite: false }));
  aro.rotation.x = -Math.PI / 2; aro.visible = false; scene.add(aro);

  const RADIO = 0.45, VEL = 8;
  const INICIO = new THREE.Vector3(0, 0, 12);
  yo.position.copy(INICIO); yo.rotation.y = Math.PI;
  const altura = (x, z) => (Math.hypot(x, z) < R_PLAZA + 0.2 ? 0.7 : 0.6);
  yo.position.y = altura(yo.position.x, yo.position.z);

  // ¿Se puede pisar este punto?
  const local = new THREE.Vector3();
  function libre(x, z) {
    if (Math.hypot(x, z) > R_MUNDO - RADIO) return false;
    for (const c of claustros) {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
      if (d > c.r0 - RADIO && d < c.r1 + RADIO) { let da = Math.atan2(-dz, dx) - c.a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > c.gap) return false; }
    }
    for (const o of obst) {
      if (o.c) { if (Math.hypot(x - o.c[0], z - o.c[1]) < o.c[2] + RADIO) return false; }
      else {
        // los obstáculos no se mueven: su matriz inversa y un círculo que los envuelve se calculan una sola vez
        if (!o.inv) {
          o.caja.updateWorldMatrix(true, false);
          o.inv = o.caja.matrixWorld.clone().invert();
          const c = new THREE.Vector3((o.x0 + o.x1) / 2, 0, (o.z0 + o.z1) / 2).applyMatrix4(o.caja.matrixWorld);
          o.cx = c.x; o.cz = c.z; o.cr = Math.hypot(o.x1 - o.x0, o.z1 - o.z0) / 2 + RADIO + 0.1;
        }
        if (Math.abs(x - o.cx) > o.cr || Math.abs(z - o.cz) > o.cr) continue;
        local.set(x, o.caja.position.y, z).applyMatrix4(o.inv);
        if (local.x > o.x0 - RADIO && local.x < o.x1 + RADIO && local.z > o.z0 - RADIO && local.z < o.z1 + RADIO) return false;
      }
    }
    return true;
  }
  function despejado(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.4));
    for (let i = 1; i <= n; i++) { const k = i / n; if (!libre(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k)) return false; }
    return true;
  }
  // En qué zona está un punto: "plaza" o el id de un módulo (incluye su puente)
  function zona(p) {
    if (Math.hypot(p.x, p.z) < R_PLAZA + 0.5) return "plaza";
    let mejor = "plaza", dmin = Infinity;
    for (const id in modulos) {
      const mo = modulos[id], d = Math.hypot(p.x - mo.centro.x, p.z - mo.centro.z);
      if (d < dmin) { dmin = d; mejor = id; }
    }
    return mejor;
  }
  // Arco de puntos alrededor de un centro (para rodear torres y columnas)
  function arco(cx, cz, r, a1, a2) {
    let d = a2 - a1; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    const n = Math.max(1, Math.ceil(Math.abs(d) / rad(45))), pts = [];
    for (let i = 0; i <= n; i++) { const a = a1 + (d * i) / n; pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r)); }
    return pts;
  }
  const ang = (p, cx = 0, cz = 0) => Math.atan2(p.z - cz, p.x - cx);
  function dentroDe(z, desde, hasta) {
    // camino dentro de una misma zona: directo si está libre, si no rodeando el centro
    if (despejado(desde, hasta)) return [hasta];
    const c = z === "plaza" ? { x: 0, z: 0, r: 8.6 } : { x: modulos[z].centro.x, z: modulos[z].centro.z, r: modulos[z].r * 0.45 };
    return [...arco(c.x, c.z, c.r, ang(desde, c.x, c.z), ang(hasta, c.x, c.z)), hasta];
  }
  const bocaPlaza = (id) => modulos[id].haciaPlaza.clone().multiplyScalar(-(R_PLAZA - 1.5));
  const bocaModulo = (id) => modulos[id].centro.clone().addScaledVector(modulos[id].haciaPlaza, modulos[id].r - 1.2);
  function trazar(desde, hasta) {
    const zd = zona(desde), zh = zona(hasta);
    if (zd === zh) return dentroDe(zd, desde, hasta);
    let pts = [], p = desde.clone();
    if (zd !== "plaza") {
      const b = bocaModulo(zd);
      if (Math.hypot(p.x - modulos[zd].centro.x, p.z - modulos[zd].centro.z) < modulos[zd].r) pts.push(...dentroDe(zd, p, b)); else pts.push(b);
      pts.push(bocaPlaza(zd)); p = bocaPlaza(zd);
    }
    if (zh === "plaza") return [...pts, ...dentroDe("plaza", p, hasta)];
    pts.push(...dentroDe("plaza", p, bocaPlaza(zh)), bocaModulo(zh));
    return [...pts, ...dentroDe(zh, bocaModulo(zh), hasta)];
  }

  // Ruta continua: A* sobre una cuadrícula del piso caminable (se recuerda qué celdas están libres) y luego
  // se quitan los puntos que sobran, dejando solo tramos rectos despejados. Si no encuentra, usa el trazado por zonas.
  const CELDA = 0.5, libreCache = new Map();
  const llave = (i, j) => (i + 2000) * 4000 + (j + 2000);
  const deLlave = (k) => [Math.floor(k / 4000) - 2000, (k % 4000) - 2000];
  function celdaLibre(i, j) {
    const k = llave(i, j);
    let v = libreCache.get(k);
    if (v === undefined) { v = libre(i * CELDA, j * CELDA); libreCache.set(k, v); }
    return v;
  }
  function celdaCercana(p) {
    const i0 = Math.round(p.x / CELDA), j0 = Math.round(p.z / CELDA);
    for (let r = 0; r <= 8; r++) {
      let mejor = null, dmin = Infinity;
      for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r || !celdaLibre(i, j)) continue;
        const d = Math.hypot(i * CELDA - p.x, j * CELDA - p.z); if (d < dmin) { dmin = d; mejor = [i, j]; }
      }
      if (mejor) return mejor;
    }
    return null;
  }
  function aEstrella(desde, hasta, max = 60000) {
    const a = celdaCercana(desde), b = celdaCercana(hasta);
    if (!a || !b) return null;
    const h = (i, j) => { const dx = Math.abs(i - b[0]), dz = Math.abs(j - b[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const heap = []; // montículo binario de [f, llave]
    const push = (n) => { let k = heap.length; heap.push(n); while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= n[0]) break; heap[k] = heap[p]; k = p; } heap[k] = n; };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        let k = 0;
        for (;;) { const l = 2 * k + 1, r = l + 1; let m = -1, mv = last[0]; if (l < heap.length && heap[l][0] < mv) { m = l; mv = heap[l][0]; } if (r < heap.length && heap[r][0] < mv) m = r; if (m < 0) break; heap[k] = heap[m]; k = m; }
        heap[k] = last;
      }
      return top;
    };
    const g = new Map(), de = new Map(), cerrado = new Set(), ka = llave(a[0], a[1]), kb = llave(b[0], b[1]);
    g.set(ka, 0); push([h(a[0], a[1]), ka]);
    const VEC = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let vueltas = 0;
    while (heap.length && vueltas++ < max) {
      const k = pop()[1];
      if (cerrado.has(k)) continue;
      cerrado.add(k);
      if (k === kb) {
        const pts = []; let c = k;
        while (c !== undefined) { const [ii, jj] = deLlave(c); pts.push(new THREE.Vector3(ii * CELDA, 0, jj * CELDA)); c = de.get(c); }
        return pts.reverse();
      }
      const [i, j] = deLlave(k), gk = g.get(k);
      for (const [di, dj, w] of VEC) {
        const ni = i + di, nj = j + dj;
        if (!celdaLibre(ni, nj)) continue;
        if (di && dj && (!celdaLibre(i + di, j) || !celdaLibre(i, j + dj))) continue; // sin cortar esquinas
        const nk = llave(ni, nj), ng = gk + w;
        if (ng < (g.has(nk) ? g.get(nk) : Infinity)) { g.set(nk, ng); de.set(nk, k); push([ng + h(ni, nj), nk]); }
      }
    }
    return null;
  }
  // deja solo los puntos donde cambia de dirección (cada tramo recto, despejado)
  // tramo libre según la cuadrícula ya calculada (rápido; lo usan los bots)
  function despejadoCeldas(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.25));
    for (let i = 0; i <= n; i++) {
      const x = (a.x + (b.x - a.x) * (i / n)) / CELDA, z = (a.z + (b.z - a.z) * (i / n)) / CELDA;
      if (!celdaLibre(Math.round(x), Math.round(z))) return false;
    }
    return true;
  }
  function suavizar(desde, pts, hasta, rapido) {
    const libreTramo = rapido ? despejadoCeldas : despejado;
    const todos = [desde, ...pts];
    if (despejado(pts[pts.length - 1], hasta)) todos.push(hasta);
    const out = []; let k = 0;
    while (k < todos.length - 1) {
      let lejos = k + 1;
      for (let m = k + 2; m < todos.length && libreTramo(todos[k], todos[m]); m++) lejos = m;
      out.push(todos[lejos].clone()); k = lejos;
    }
    return out;
  }
  // calcula la cuadrícula completa poco a poco (unas celdas por cuadro) para que luego planear rutas sea instantáneo
  const LIM = Math.ceil(R_MUNDO / CELDA);
  let calI = -LIM, calJ = -LIM;
  function precalentar(n) {
    while (n-- > 0 && calI <= LIM) {
      celdaLibre(calI, calJ);
      if (++calJ > LIM) { calJ = -LIM; calI++; }
    }
  }
  function planear(desde, hasta, max) {
    if (despejado(desde, hasta)) return [hasta.clone()];
    const pts = aEstrella(desde, hasta, max);
    return pts && pts.length ? suavizar(desde, pts, hasta, !!max) : max ? [] : trazar(desde, hasta);
  }

  let ruta = [], alLlegar = null, atorado = 0, rapido = false, intentos = 0, metaRuta = null;
  function caminarA(destino, cb, reintento = false) {
    const d = destino.clone(); d.y = 0;
    const desde = yo.position.clone(); desde.y = 0;
    ruta = planear(desde, d); alLlegar = cb || null; atorado = 0; metaRuta = d;
    if (!reintento) intentos = 0;
    let largo = 0, prev = yo.position;
    ruta.forEach((q) => { largo += Math.hypot(q.x - prev.x, q.z - prev.z); prev = q; });
    rapido = largo > 30;
    aro.visible = true; aro.position.set(d.x, altura(d.x, d.z) + 0.04, d.z);
  }
  function saltarA(destino, mirar) {
    ruta = []; alLlegar = null; aro.visible = false;
    const dx = destino.x - yo.position.x, dz = destino.z - yo.position.z;
    yo.position.set(destino.x, altura(destino.x, destino.z), destino.z);
    if (mirar) yo.rotation.y = Math.atan2(mirar.x - destino.x, mirar.z - destino.z);
    camera.position.x += dx; camera.position.z += dz; controls.target.x += dx; controls.target.z += dz;
    destello();
  }
  // brillito al aparecer
  const chispa = spriteBrillo("#ffe2a0", 4); chispa.material.opacity = 0; scene.add(chispa);
  let chispaT = 1;
  function destello() { chispaT = 0; }

  // ---------- otros visitantes (bots): recorren la expo, se detienen en los stands y siguen ----------
  const NOMBRES_BOT = ["Kim", "Sol", "Tomi", "Luna", "Rafa", "Vale", "Nico", "Abril", "Leo", "Maia", "Iker", "Dani", "Emi", "Zoe"];
  const COLORES_BOT = ["#b4683f", "#7a9a7a", "#d4ad62", "#8a6a8f", "#5f7f99", "#c98f6a", "#3f5f4f", "#e8d6b5"];
  const AVISOS_BOT = ["⭐", "💜", "🎰", "🛍️", "🌱", "🎟️", "👋", "📸"];
  const geoBot = {
    torso: new THREE.CapsuleGeometry(0.28, 0.46, 4, 10), pierna: new THREE.CapsuleGeometry(0.12, 0.4, 3, 8),
    casco: new THREE.SphereGeometry(0.24, 14, 10), pelo: new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    sombra: new THREE.CircleGeometry(0.5, 16),
  };
  const matPelo = ["#2a1c14", "#4a3020", "#15100c", "#7a5534"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  const matSombra = new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.2, depthWrite: false });
  const bots = [], matGlobo = {};
  function crearBot(k, id, cfgM) {
    const color = COLORES_BOT[k % COLORES_BOT.length];
    const traj = new THREE.MeshStandardMaterial({ color: k % 2 ? "#f6efe2" : "#efe3cf", roughness: 0.9 }), acc = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const g = new THREE.Group(); g.scale.setScalar(0.92 + Math.random() * 0.12); scene.add(g);
    const pies = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.15, 0.62, 0); g.add(p); const m = new THREE.Mesh(geoBot.pierna, k % 3 ? matPantalon : acc); m.position.y = -0.3; p.add(m); return p; });
    const torso = new THREE.Mesh(geoBot.torso, k % 3 ? acc : traj); torso.position.y = 1.12; g.add(torso);
    const cab = new THREE.Group(); cab.position.y = 1.78; g.add(cab);
    cab.add(new THREE.Mesh(geoBot.casco, piel(PIELES[k % PIELES.length])));
    if (k % 3 === 0) { const so = sombrero(color); so.position.y = 0.16; so.scale.setScalar(0.95); cab.add(so); }
    else { const pe = new THREE.Mesh(geoBot.pelo, matPelo[k % matPelo.length]); pe.rotation.x = -0.2; cab.add(pe); }
    const so = new THREE.Mesh(geoBot.sombra, matSombra); so.rotation.x = -Math.PI / 2; so.position.y = 0.02; g.add(so);
    const globo = spriteEmoji("⭐", 0.7); globo.position.y = 2.75; globo.visible = false; g.add(globo);
    // los 4 personajes de Meshy (si están en modelos.json); si no, el avatar de Meshy o la figura de siempre
    const alto = (cfgM && cfgM.alto) || 2.05, genero = (cfgM && cfgM.genero) || (k % 2 ? "mujer" : "hombre");
    vestir(g, id || (genero === "mujer" ? "avatar-mujer" : "avatar-hombre"), { alto }, [so, globo]).then((c) => { if (c) g.scale.setScalar(0.96 + Math.random() * 0.06); });
    const perfil = perfilDe(genero, cuentaGenero[genero] = (cuentaGenero[genero] ?? -1) + 1);
    return { g, pies, cab, globo, k, perfil, alto, nombre: perfil.nombre, ruta: [], espera: 1 + Math.random() * 4, paso: Math.random() * 6, vel: 1.5 + Math.random() * 0.5, globoT: 0, mira: null, accion: "quieto", lejosT: 0 };
  }
  // destinos: frente a los stands (lo más visitado), los puestos del Mercado, la plaza y las islas
  function destinoBot(cerca) {
    // casi siempre algo cercano (rutas cortas: no traban la animación); a veces cruzan a otra zona
    if (cerca && Math.random() < 0.8) { for (let t = 0; t < 12; t++) { const d = destinoBot(); if (d.p.distanceTo(cerca) < 32) return d; } }
    const ids = Object.keys(stands), r = Math.random();
    if (r < 0.65 && ids.length) { const s = stands[ids[Math.floor(Math.random() * ids.length)]]; return { p: s.puerta.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, 0, (Math.random() - 0.5) * 2.4)), mira: s.mira || s.pos }; }
    const ks = Object.keys(lugares);
    if (r < 0.85 && ks.length) { const L = lugares[ks[Math.floor(Math.random() * ks.length)]]; return { p: L.p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)), mira: L.mirar }; }
    const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 8;
    return { p: new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), mira: new THREE.Vector3(0, 0, 0) };
  }

  // Pista de baile en el patio: los bailarines se acomodan en círculo mirando al centro
  const PISTA = (() => {
    for (const [x, z] of [[0, 10.5], [10.5, 0], [0, -10.5], [-10.5, 0], [7.5, 7.5]]) {
      let ok = true;
      for (let a = 0; a < 6 && ok; a++) ok = libre(x + Math.cos(a) * 2.2, z + Math.sin(a) * 2.2);
      if (ok) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(0, 0, 10.5);
  })();
  const lugarBaile = (b) => { const a = (b.lugarBaile || 0) + (Math.random() - 0.5) * 0.3, r = 1.8 + Math.random() * 0.6; return { p: new THREE.Vector3(PISTA.x + Math.cos(a) * r, 0, PISTA.z + Math.sin(a) * r), mira: PISTA }; };
  const girarHacia = (b, p, dt, k = 4) => { const dA = Math.atan2(p.x - b.g.position.x, p.z - b.g.position.z) - b.g.rotation.y; b.g.rotation.y += Math.atan2(Math.sin(dA), Math.cos(dA)) * Math.min(1, dt * k); };
  const ir = (b, d) => {
    if (!libre(d.p.x, d.p.z)) { const c = celdaCercana(d.p); if (!c) return false; d.p.set(c[0] * CELDA, 0, c[1] * CELDA); }
    const desde = b.g.position.clone(); desde.y = 0;
    b.ruta = planear(desde, d.p, 4000); b.mira = d.mira; b.accion = "caminar";
    return b.ruta.length > 0;
  };
  const avisar = (b, e) => { b.globo.material = matGlobo[e] || (matGlobo[e] = spriteEmoji(e, 0.7).material); b.globo.visible = true; b.globoT = 2.4; };

  // Qué hace cada visitante cuando se queda sin ruta:
  // - baile: baila un rato en la pista; a veces da una vuelta por un stand cercano y regresa
  // - guia + sigue (pareja): el guía escoge a dónde van, el otro camina a su lado; al llegar se miran y platican
  // - solo: va a stands y puestos; a veces platica con el anfitrión
  function pensarBot(b) {
    if (b.conYo || b.charla) return;
    if (b.rol === "baile") {
      if (b.accion === "bailar" && Math.random() < 0.3) { ir(b, destinoBot(PISTA)); b.espera = 5 + Math.random() * 5; return; }
      ir(b, lugarBaile(b)); b.espera = 2; return;
    }
    const d = destinoBot(b.g.position);
    if (!ir(b, d)) { b.espera = 1 + Math.random() * 2; return; }
    b.espera = 8 + Math.random() * 10;
    if (b.pareja && !b.pareja.conYo && !b.pareja.charla) {
      // el acompañante va al mismo lugar, un paso al lado
      const o = b.pareja, lado = new THREE.Vector3(d.p.z - b.g.position.z, 0, b.g.position.x - d.p.x).normalize().multiplyScalar(1.25);
      ir(o, { p: d.p.clone().add(lado), mira: d.mira }); o.vel = b.vel;
    }
  }

  // Cuando bailas, la gente cercana llega a bailar contigo en círculo. Cuando paras, unas se quedan platicando entre ellas y otras se van.
  let bailabas = false;
  function gentePorBaile() {
    if (bailoYo && !bailabas) bailabas = true;
    if (!bailoYo && bailabas) {
      bailabas = false;
      const salen = bots.filter((b) => b.conYo);
      salen.forEach((b) => (b.conYo = false));
      const quedan = salen.filter(() => Math.random() < 0.6);
      // se juntan de dos en dos (o tres) a platicar; las demás se van a caminar
      for (let i = 0; i < quedan.length; i += 2) {
        const a = quedan[i], c = quedan[i + 1] || quedan[i - 1];
        if (!c || c === a) { a.espera = 0; continue; }
        const t = 8 + Math.random() * 10;
        [[a, c], [c, a]].forEach(([x, y]) => { x.ruta = []; x.accion = "platicar"; x.mira = y.g.position; x.espera = Math.max(x.espera, t); });
        if (Math.random() < 0.6) avisar(a, ["💬", "😄", "😂", "💃"][Math.floor(Math.random() * 4)]);
      }
      salen.filter((b) => !quedan.includes(b)).forEach((b) => { b.espera = Math.random() * 1.5; b.accion = "quieto"; });
    }
    if (!bailoYo) return 0;
    // se unen las que están a menos de 12 m (hasta 7), de una por cuadro
    const ya = bots.filter((b) => b.conYo).length;
    if (ya >= 7) return 0;
    let mejor = null, dmin = 12;
    for (const b of bots) {
      if (b.conYo || b.charla) continue;
      const d = b.g.position.distanceTo(yo.position);
      if (d < dmin) { dmin = d; mejor = b; }
    }
    if (!mejor) return 0;
    const ang = Math.atan2(mejor.g.position.z - yo.position.z, mejor.g.position.x - yo.position.x) + (Math.random() - 0.5) * 0.5, r = 2 + Math.random() * 0.7;
    mejor.conYo = true;
    ir(mejor, { p: new THREE.Vector3(yo.position.x + Math.cos(ang) * r, 0, yo.position.z + Math.sin(ang) * r), mira: yo.position });
    mejor.vel = Math.max(mejor.vel, 2);
    if (Math.random() < 0.5) avisar(mejor, ["💃", "🎶", "🙌"][Math.floor(Math.random() * 3)]);
    return 1;
  }

  function moverBots(dt) {
    let planes = gentePorBaile();
    for (const b of bots) {
      const ctl = b.g.userData.ctl, o = b.pareja;
      if (b.charla) {
        // platicando contigo: se para y te mira
        b.ruta = []; b.accion = "platicar"; b.mira = yo.position; girarHacia(b, yo.position, dt, 6);
      } else if (b.conYo && !b.ruta.length) {
        // bailando contigo
        if (b.accion !== "bailar") b.accion = "bailar";
        girarHacia(b, yo.position, dt, 3);
      } else if (!b.ruta.length) {
        if (b.accion === "caminar") {
          // acaba de llegar
          const enPista = b.g.position.distanceTo(PISTA) < 3.5;
          b.accion = b.rol === "baile" && enPista ? "bailar" : "quieto";
          if (b.accion === "bailar") { b.espera = 18 + Math.random() * 25; if (Math.random() < 0.3) avisar(b, "🎶"); }
          else if (b.rol === "baile") b.espera = 4 + Math.random() * 4; // se asomó a un stand y regresa
          else if (b.rol === "guia") b.espera = Math.max(b.espera, 9 + Math.random() * 8);
          else if (b.rol === "solo" && Math.random() < 0.45) { b.accion = "platicar"; b.espera = 6 + Math.random() * 6; if (Math.random() < 0.5) avisar(b, "💬"); }
          else if (b.rol === "solo" && Math.random() < 0.5) avisar(b, AVISOS_BOT[Math.floor(Math.random() * AVISOS_BOT.length)]);
        }
        if (o && !o.ruta.length && b.g.position.distanceTo(o.g.position) < 3) {
          // la pareja ya llegó junta: se miran y platican
          b.accion = "platicar"; girarHacia(b, o.g.position, dt);
          if (b.rol === "guia" && b.globoT <= 0 && Math.random() < dt * 0.12) avisar(b, ["💬", "😄", "👍", "🌿"][Math.floor(Math.random() * 4)]);
        } else if (b.mira) girarHacia(b, b.mira, dt);
        b.pies.forEach((p) => (p.rotation.x *= 0.8));
        if (b.rol !== "sigue") {
          b.espera -= dt;
          // un plan por cuadro para no trabar la animación; el guía espera a que su acompañante llegue
          if (b.espera <= 0 && planes < 1 && !(o && o.ruta.length)) { planes++; pensarBot(b); }
        }
      } else {
        const q = b.ruta[0], dx = q.x - b.g.position.x, dz = q.z - b.g.position.z, d = Math.hypot(dx, dz), st = b.vel * dt;
        if (d <= st) { b.g.position.x = q.x; b.g.position.z = q.z; b.ruta.shift(); }
        else {
          b.g.position.x += (dx / d) * st; b.g.position.z += (dz / d) * st;
          const dA = Math.atan2(dx, dz) - b.g.rotation.y; b.g.rotation.y += Math.atan2(Math.sin(dA), Math.cos(dA)) * Math.min(1, dt * 8);
        }
        b.paso += dt * 9 * (b.vel / 3.5);
        const sw = Math.sin(b.paso);
        b.pies[0].rotation.x = sw * 0.6; b.pies[1].rotation.x = -sw * 0.6;
      }
      if (ctl) {
        // los que están lejos de la cámara se animan con menos frecuencia
        b.lejosT += dt;
        if (b.lejosT > 0.12 || b.g.position.distanceToSquared(camera.position) < 70 * 70) {
          const estado = b.ruta.length ? "caminar" : ctl.tiene(b.accion) ? b.accion : "quieto";
          ctl.update(quieto ? 0 : b.lejosT, estado);
          ctl.ritmo(estado === "caminar" ? b.vel / (1.45 * b.alto / 1.78) : 1);
          b.lejosT = 0;
        }
      }
      b.g.position.y = altura(b.g.position.x, b.g.position.z) + (ctl ? 0 : Math.abs(Math.sin(b.paso)) * (b.ruta.length ? 0.05 : 0));
      if (b.globoT > 0) { b.globoT -= dt; b.globo.position.y = 2.75 + (2.4 - b.globoT) * 0.25; if (b.globoT <= 0) b.globo.visible = false; }
    }
  }
  const cuentaGenero = {};
  // Los personajes de modelos.json ("personaje1", "personaje2"...) menos el que tú elegiste: nadie se ve igual que tú
  function crearBots(l) {
    const n = innerWidth < 760 ? 8 : 16, nBaile = innerWidth < 760 ? 3 : 5, nParejas = innerWidth < 760 ? 1 : 3;
    const pool = Object.keys(l).filter((id) => /^personaje\d+$/.test(id) && id !== cfg.personaje);
    for (let k = 0; k < n; k++) {
      const id = pool.length ? pool[k % pool.length] : null;
      const b = crearBot(k, id, id ? l[id] : null);
      // papeles: primero los que bailan, luego parejas (guía + acompañante), el resto va solo
      if (k < nBaile) { b.rol = "baile"; b.lugarBaile = (k / nBaile) * Math.PI * 2; }
      else if (k < nBaile + nParejas * 2) b.rol = (k - nBaile) % 2 ? "sigue" : "guia";
      else b.rol = "solo";
      if (b.rol === "sigue") { const g = bots[k - 1]; b.pareja = g; g.pareja = b; }
      const d = b.rol === "baile" ? lugarBaile(b) : b.rol === "sigue" ? { p: b.pareja.g.position.clone().add(new THREE.Vector3(1.2, 0, 0)), mira: b.pareja.mira } : destinoBot();
      const c = celdaCercana(d.p); // aparecen ya repartidos por la hacienda
      if (c) b.g.position.set(c[0] * CELDA, 0, c[1] * CELDA);
      b.mira = d.mira; b.g.rotation.y = Math.random() * Math.PI * 2;
      if (b.rol === "baile") { b.accion = "bailar"; b.espera = 10 + Math.random() * 20; }
      bots.push(b);
    }
  }
  if (!cfg.replica) setTimeout(() => listaModelos().then(crearBots), 600);

  // Entrada: teclado y joystick
  const teclas = {};
  addEventListener("keydown", (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    teclas[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === "b" && !e.repeat && !cfg.replica && !tour && (!cfg.puedeBailar || cfg.puedeBailar())) bailar(!bailoYo);
  });
  addEventListener("keyup", (e) => { teclas[e.key.toLowerCase()] = false; });
  addEventListener("blur", () => { for (const k in teclas) teclas[k] = false; });
  const stick = { x: 0, y: 0 };

  // ---------- cámara ----------
  let enfoqueId = null, listo = false, enfoque = null, enfocado = false, vuelo = null, desp = { x: 0, y: 0 }, despObj = { x: 0, y: 0 };
  const offset = canvas.clientWidth / canvas.clientHeight < 0.8 ? new THREE.Vector3(0, 9, 16) : new THREE.Vector3(0, 6.5, 11); // cámara respecto al avatar (más lejos en celular)
  function volar(pos, obj, ms = 1300) {
    controls.autoRotate = false;
    if (quieto) { camera.position.copy(pos); controls.target.copy(obj); vuelo = null; return; }
    vuelo = { p0: camera.position.clone(), o0: controls.target.clone(), p1: pos, o1: obj, t0: performance.now(), ms };
  }
  const objYo = () => yo.position.clone().add(new THREE.Vector3(0, 1.6, 0));
  function seguir(ms = 1000) {
    enfocado = false; enfoque = null; listo = true;
    volar(objYo().add(offset), objYo(), ms);
  }
  function enfocarStand(id) {
    const s = stands[id]; if (!s) return false;
    const mira = s.mira || s.pos;
    if (Math.hypot(yo.position.x - s.puerta.x, yo.position.z - s.puerta.z) > 6) saltarA(s.puerta, mira);
    else { ruta = []; aro.visible = false; yo.rotation.y = Math.atan2(mira.x - yo.position.x, mira.z - yo.position.z); }
    enfoque = s.m.pab; enfocado = true; enfoqueId = id; setTimeout(revisarVideos, 50);
    const f = s.frente.clone(), vertical = canvas.clientWidth / canvas.clientHeight < 0.8;
    // la distancia depende del tamaño: stand, premium o isla completa
    const k = s.ancho / 7, centro = s.isla ? s.pos.clone().addScaledVector(f, -3) : s.pos;
    volar(centro.clone().addScaledVector(f, (vertical ? 21 : 11.5) * k).add(new THREE.Vector3(0, (vertical ? 6.5 : 4.8) * Math.sqrt(k) + (s.isla ? 4 : 0), 0)), centro.clone().add(new THREE.Vector3(0, 2.6 * Math.sqrt(k) + (s.isla ? 1.5 : 0), 0)));
    s.saludar();
    return true;
  }
  function destinoDe(tipo, id) {
    if (tipo === "stand" && stands[id]) return { p: stands[id].puerta, mirar: stands[id].mira || stands[id].pos };
    const L = lugares[id != null ? `${tipo}:${id}` : tipo] || lugares[tipo];
    if (L) return { p: L.p, mirar: L.mirar };
    if (tipo === "pabellon" && modulos[id]) return { p: modulos[id].centro.clone().addScaledVector(modulos[id].haciaPlaza, 5), mirar: modulos[id].centro };
    return { p: INICIO, mirar: new THREE.Vector3(0, 0, 0) };
  }
  // Al llegar, la cámara se pone detrás del avatar mirando hacia lo que fue a ver
  function mirarHacia(q) {
    const dx = q.x - yo.position.x, dz = q.z - yo.position.z, d = Math.hypot(dx, dz); if (d < 0.1) return;
    yo.rotation.y = Math.atan2(dx, dz);
    const h = Math.hypot(offset.x, offset.z);
    offset.set((-dx / d) * h, offset.y, (-dz / d) * h);
    if (!enfocado) volar(objYo().add(offset), objYo(), 700);
  }
  // Ir caminando (o de un salto) a un stand, pabellón, la universidad o la plaza
  function irA(tipo, id, { caminar = true, cb } = {}) {
    const d = destinoDe(tipo, id);
    if (enfocado) seguir(600);
    if (caminar) caminarA(d.p, () => { mirarHacia(d.mirar); cb && cb(); });
    else { saltarA(d.p, d.mirar); if (!enfocado) mirarHacia(d.mirar); cb && cb(); }
  }

  // ---------- toques ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let inicio = null;
  canvas.addEventListener("pointerdown", (e) => { inicio = { x: e.clientX, y: e.clientY, t: performance.now() }; controls.autoRotate = false; });
  canvas.addEventListener("pointerup", (e) => {
    if (cfg.replica) { inicio = null; return; } // en la réplica solo se gira la cámara
    if (!inicio) return;
    const mov = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
    const dur = performance.now() - inicio.t;
    inicio = null;
    if (mov > 8 || dur > 600) return;
    const hit = tocado(e.clientX, e.clientY);
    if (!hit) return;
    if (hit.tipo === "suelo") {
      if (!libre(hit.punto.x, hit.punto.z)) return;
      if (enfocado) cfg.alSoltar && cfg.alSoltar();
      caminarA(hit.punto, null);
      return;
    }
    cfg.alTocar(hit.tipo, hit.id);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || inicio) return;
    const h = tocado(e.clientX, e.clientY);
    canvas.style.cursor = h && h.tipo !== "suelo" ? "pointer" : h ? "crosshair" : "grab";
  });
  function tocado(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...tocables, ...suelos], true);
    for (const h of hits) {
      if (h.object.userData.suelo) return { tipo: "suelo", punto: h.point };
      let o = h.object;
      while (o && !o.userData.tipo) o = o.parent;
      if (o) return o.userData;
    }
    return null;
  }

  // ---------- tamaño y bucle ----------
  function medir() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camTunel.aspect = w / h; camTunel.updateProjectionMatrix();
  }
  addEventListener("resize", medir);
  medir();

  const fwd = new THREE.Vector3(), der = new THREE.Vector3(), mover = new THREE.Vector3(), antes = new THREE.Vector3();
  let paso = 0, cercaId = null, pasoSon = 0, bailoYo = false, charlaCon = null, tBaile = 0;
  // bailar: con la tecla B o el botón; caminar lo detiene
  function bailar(si) {
    si = !!si;
    if (si === bailoYo) return;
    bailoYo = si;
    if (si) { if (ruta.length) { ruta = []; alLlegar = null; aro.visible = false; } terminarCharla(); }
    cfg.alBaile && cfg.alBaile(si);
  }
  function terminarCharla() {
    if (!charlaCon) return;
    const b = charlaCon; charlaCon = null; b.charla = false; b.accion = "quieto"; b.espera = 1 + Math.random() * 3;
  }
  function moverYo(dt) {
    antes.copy(yo.position);
    // dirección desde teclado o joystick, relativa a la cámara
    let ix = stick.x, iy = stick.y;
    if (teclas.w || teclas.arrowup) iy += 1;
    if (teclas.s || teclas.arrowdown) iy -= 1;
    if (teclas.a || teclas.arrowleft) ix -= 1;
    if (teclas.d || teclas.arrowright) ix += 1;
    const mag = Math.min(1, Math.hypot(ix, iy));
    mover.set(0, 0, 0);
    let vel = VEL;
    if (mag > 0.12) {
      if (bailoYo) bailar(false);
      if (ruta.length) { ruta = []; alLlegar = null; aro.visible = false; }
      if (enfocado) { cfg.alSoltar && cfg.alSoltar(); }
      camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      der.crossVectors(fwd, camera.up).normalize();
      mover.addScaledVector(fwd, iy / Math.max(1, Math.hypot(ix, iy))).addScaledVector(der, ix / Math.max(1, Math.hypot(ix, iy)));
      mover.multiplyScalar(mag);
    } else if (ruta.length) {
      vel = rapido ? 16 : 10;
      const paso1 = vel * Math.max(dt, 1e-3);
      let q = ruta[0], dx = q.x - yo.position.x, dz = q.z - yo.position.z, d = Math.hypot(dx, dz);
      // al alcanzar un punto pasa al siguiente en el mismo cuadro: sin frenar ni zigzaguear
      while (d < Math.max(0.08, paso1 * 0.5)) {
        ruta.shift();
        if (!ruta.length) { aro.visible = false; const cb = alLlegar; alLlegar = null; cb && cb(); break; }
        q = ruta[0]; dx = q.x - yo.position.x; dz = q.z - yo.position.z; d = Math.hypot(dx, dz);
      }
      if (ruta.length && d > 1e-4) mover.set(dx / d, 0, dz / d).multiplyScalar(Math.min(1, d / paso1));
    }
    if (mover.lengthSq() > 0) {
      const sx = mover.x * vel * dt, sz = mover.z * vel * dt, x = yo.position.x, z = yo.position.z;
      // si por algo quedó dentro de un obstáculo, puede salir caminando hacia cualquier lado
      if (!libre(x, z)) yo.position.x += sx, yo.position.z += sz;
      else if (libre(x + sx, z + sz)) yo.position.x += sx, yo.position.z += sz;
      else if (libre(x + sx, z)) yo.position.x += sx;
      else if (libre(x, z + sz)) yo.position.z += sz;
      const objetivo = Math.atan2(mover.x, mover.z);
      let dA = objetivo - yo.rotation.y; while (dA > Math.PI) dA -= Math.PI * 2; while (dA < -Math.PI) dA += Math.PI * 2;
      yo.rotation.y += dA * Math.min(1, dt * 12);
      // si sigue una ruta y no avanza, la vuelve a calcular desde donde está (sin brincar); si tampoco, se queda ahí
      const avance = Math.hypot(yo.position.x - x, yo.position.z - z);
      if (ruta.length && avance < vel * dt * 0.2 * mover.length()) {
        atorado += dt;
        if (atorado > 0.4) {
          const cb = alLlegar;
          if (intentos++ < 2 && metaRuta) caminarA(metaRuta, cb, true);
          else { ruta = []; alLlegar = null; aro.visible = false; cb && cb(); }
        }
      } else atorado = 0;
    }
    yo.position.y = altura(yo.position.x, yo.position.z);
    // animación de caminar
    const andando = Math.hypot(yo.position.x - antes.x, yo.position.z - antes.z) > 0.001;
    if (andando) {
      paso += dt * (vel > 9 ? 16 : 11);
      pasoSon += dt; if (pasoSon > 0.32) { pasoSon = 0; cfg.alPaso && cfg.alPaso(); }
    } else paso *= 0.8;
    const sw = andando ? Math.sin(paso) : 0;
    piernas[0].rotation.x = sw * 0.7; piernas[1].rotation.x = -sw * 0.7;
    brazosYo[0].rotation.x = -sw * 0.6; brazosYo[1].rotation.x = sw * 0.6;
    if (andando && bailoYo && ruta.length) bailar(false);
    if (charlaCon) { const p = charlaCon.g.position, dA = Math.atan2(p.x - yo.position.x, p.z - yo.position.z) - yo.rotation.y; yo.rotation.y += Math.atan2(Math.sin(dA), Math.cos(dA)) * Math.min(1, dt * 6); if (andando || p.distanceTo(yo.position) > 4.5) { terminarCharla(); cfg.alFinCharla && cfg.alFinCharla(); } }
    const estadoYo = andando ? "caminar" : bailoYo ? "bailar" : charlaCon ? "platicar" : "quieto";
    if (yo.userData.ctl) yo.userData.ctl.update(quieto ? 0 : dt, yo.userData.ctl.tiene(estadoYo) ? estadoYo : "quieto");
    torso.position.y = 1.3 + Math.abs(Math.sin(paso)) * (andando ? 0.05 : 0);
    casco.position.y = 2.0 + Math.abs(Math.sin(paso)) * (andando ? 0.05 : 0) + (andando ? 0 : Math.sin(performance.now() / 600) * 0.015);
    // la figura de siempre (sin modelo) también baila: brazos arriba, rebote y vaivén
    if (bailoYo && !andando && !yo.userData.ctl) {
      tBaile += quieto ? 0 : dt;
      const t = tBaile * 7.5;
      brazosYo[0].rotation.z = -2.4 - Math.sin(t) * 0.35; brazosYo[1].rotation.z = 2.4 - Math.sin(t + 1.5) * 0.35;
      piernas[0].rotation.x = Math.max(0, Math.sin(t)) * 0.5; piernas[1].rotation.x = Math.max(0, -Math.sin(t)) * 0.5;
      figYo.position.y = Math.abs(Math.sin(t)) * 0.12; figYo.rotation.y = Math.sin(t * 0.5) * 0.45; figYo.rotation.z = Math.sin(t) * 0.06;
    } else if (figYo.position.y || figYo.rotation.y) {
      brazosYo[0].rotation.z = brazosYo[1].rotation.z = 0; figYo.position.y = figYo.rotation.y = figYo.rotation.z = 0;
    }
    // la cámara acompaña al avatar
    if (!enfocado && !vuelo) {
      const dx = yo.position.x - antes.x, dz = yo.position.z - antes.z;
      camera.position.x += dx; camera.position.z += dz; controls.target.x += dx; controls.target.z += dz;
      camera.position.y += (yo.position.y - antes.y); controls.target.y += (yo.position.y - antes.y);
    }
    // ¿cerca de un stand o de la universidad?
    let cerca = null, dmin = 3.6;
    for (const id in stands) { const p = stands[id].puerta, d = Math.hypot(yo.position.x - p.x, yo.position.z - p.z); if (d < dmin) { dmin = d; cerca = id; } }
    if (!cerca) for (const k in lugares) { const L = lugares[k]; if (L.entrar && Math.hypot(yo.position.x - L.p.x, yo.position.z - L.p.z) < 3.4) { cerca = k; break; } }
    if (!cerca && !bailoYo && !charlaCon) {
      let dp = 2.6;
      for (const b of bots) { if (b.conYo) continue; const d = Math.hypot(yo.position.x - b.g.position.x, yo.position.z - b.g.position.z); if (d < dp) { dp = d; cerca = "persona:" + b.k; } }
    }
    if (cerca !== cercaId) { cercaId = cerca; cfg.alCerca && cfg.alCerca(cerca); }
  }

  const v = new THREE.Vector3(), camReal = new THREE.Vector3(), dirCam = new THREE.Vector3(), rayCam = new THREE.Raycaster();
  rayCam.camera = camera;
  let previo = performance.now(), ver = true;
  function cuadro(ahora) {
    requestAnimationFrame(cuadro);
    const dt = Math.max(0, Math.min(0.05, (ahora - previo) / 1000)); previo = ahora;
    const t = ahora / 1000;
    try {
      if (tour) {
        const esc = actualizarTour(ahora, dt);
        if (tour || esc === tunel) {
          anim.forEach((fn) => fn(t, dt));
          renderer.render(esc, esc === tunel ? camTunel : camera);
          etiquetas.forEach((et) => (et.el.style.display = "none"));
          return;
        }
      }
      moverYo(dt);
      if (!quieto) moverBots(dt);
      precalentar(500);
      dibujarVideosReales();
      if (vuelo) {
        const k = Math.min(1, (ahora - vuelo.t0) / vuelo.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        camera.position.lerpVectors(vuelo.p0, vuelo.p1, e);
        controls.target.lerpVectors(vuelo.o0, vuelo.o1, e);
        if (k >= 1) vuelo = null;
      }
      controls.update();
      if (listo && !enfocado && !vuelo) offset.copy(camera.position).sub(controls.target);
      if (aro.visible) { aro.rotation.z += dt * 2; aro.scale.setScalar(1 + Math.sin(t * 6) * 0.08); }
      if (chispaT < 1) { chispaT = Math.min(1, chispaT + dt * 1.6); chispa.position.copy(yo.position).add(new THREE.Vector3(0, 1.2, 0)); chispa.material.opacity = 1 - chispaT; chispa.scale.setScalar(2 + chispaT * 6); }
      // Desplazamiento de la imagen cuando hay un panel abierto (el stand queda visible)
      desp.x += (despObj.x - desp.x) * 0.12; desp.y += (despObj.y - desp.y) * 0.12;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (Math.abs(desp.x) + Math.abs(desp.y) > 0.5) camera.setViewOffset(w, h, desp.x, desp.y, w, h); else camera.clearViewOffset();
      anim.forEach((f) => f(t, dt));
      reloj += dt; relojStand += dt;
      if (reloj > 6) { reloj = 0; rotarPantallas(); }
      // Solo se redibujan las pantallas de los stands cercanos (rendimiento en celular)
      relojVideo += dt;
      if (relojVideo > 0.25) {
        Object.values(stands).forEach((s) => { if (s.cerca && s.videos.length) pintarVideos(s, relojVideo); });
        relojVideo = 0;
      }
      if (relojStand > 4.5) {
        relojStand = 0; revisarVideos();
        Object.values(stands).forEach((s, i) => {
          s.cerca = Math.hypot(yo.position.x - s.pos.x, yo.position.z - s.pos.z) < 42 || (enfocado && enfoqueId === s.m.id);
          if (!s.cerca) return;
          s.totemI++; pintarTotems(s); if (i % 2 === (Math.floor(t / 4.5) % 2)) pintarStand(s, true);
        });
      }
      // Si un stand tapa al avatar, la cámara se acerca solo para este cuadro (luego vuelve a su lugar)
      let movida = false;
      if (!enfocado && !vuelo) {
        camReal.copy(camera.position);
        dirCam.copy(camera.position).sub(controls.target);
        const largo = dirCam.length(); dirCam.normalize();
        rayCam.set(controls.target, dirCam); rayCam.far = largo;
        const cercanos = [...Object.values(stands).filter((s) => s.cerca).map((s) => s.grupo), ...muros];
        const hit = rayCam.intersectObjects(cercanos, true)[0];
        if (hit) { camera.position.copy(controls.target).addScaledVector(dirCam, Math.max(0.3, hit.distance - 0.5)); movida = true; yo.visible = hit.distance > 3; }
      }
      renderer.render(scene, camera);
      if (movida) { camera.position.copy(camReal); yo.visible = true; }
      // Etiquetas HTML
      etiquetas.forEach((et) => {
        v.copy(et.pos).project(camera);
        const visible = ver && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        et.el.style.display = visible ? "" : "none";
        if (visible) et.el.style.transform = `translate(${((v.x + 1) / 2) * w - desp.x}px, ${((1 - v.y) / 2) * h - desp.y}px) translate(-50%, -100%)`;
      });
    } catch (err) { console.error(err); }
  }
  requestAnimationFrame(cuadro);
  if (document.fonts) Promise.all([document.fonts.load(`700 40px Cinzel`), document.fonts.load(`600 40px Cinzel`)]).catch(() => {}).then(() => document.fonts.ready).then(() => { Object.values(stands).forEach((s) => pintarStand(s)); drones.forEach((d) => pintarDron(d)); rotarPantallas(); });
  // fotos, videos, modelo 3D y promociones que subió cada marca
  Object.values(stands).forEach((s) => { if (tieneMedios(s.m) || (s.m.promos && s.m.promos.length)) aplicarMedios(s); });

  // Al cargar: vista general y luego la cámara baja hasta el avatar.
  // Modo réplica (panel de marca): directo al stand de esa marca, sin visitantes, para girarlo y verlo mientras se edita.
  controls.autoRotate = false;
  if (cfg.replica && stands[cfg.replica]) {
    setTimeout(() => { enfocarStand(cfg.replica); if (vuelo) { camera.position.copy(vuelo.p1); controls.target.copy(vuelo.o1); vuelo = null; } listo = true; }, 50);
  } else setTimeout(() => seguir(quieto ? 0 : 2200), 900);

  return {
    irA, enfocarStand, seguir, setParcelas, setTienda, venta, iniciarTour,
    enTour: () => !!tour,
    bailar, bailando: () => bailoYo,
    perfilDe: (k) => { const b = bots.find((x) => x.k === k); return b ? b.perfil : null; },
    // platicar con un visitante: se detiene y te mira; devuelve su perfil y su papel en la hacienda
    platicarCon(k) {
      const b = bots.find((x) => x.k === k);
      if (!b) return null;
      terminarCharla(); bailar(false);
      charlaCon = b; b.charla = true; b.ruta = [];
      return { perfil: b.perfil, rol: b.rol };
    },
    terminarCharla,
    _prueba: { camera, controls, libre, trazar, yo, lugares, stands, modulos, ruta: () => ruta, mover: (dt) => moverYo(dt), bots, bailar, moverBots, precalentar },
    saltarTour: () => terminarTour(),
    setStick(x, y) { stick.x = x; stick.y = y; },
    setDesplazamiento(x, y) { despObj.x = x; despObj.y = y; },
    setEtiquetas(s) { ver = s; },
    nombreDe: (id) => (stands[id] ? stands[id].m.nombre : id),
    actualizarMarcas(nuevas) {
      lista = nuevas;
      nuevas.forEach((m) => {
        const s = stands[m.id];
        if (s) { s.m = m; s.productos = catalogo(m); pintarStand(s); aplicarMedios(s); }
        drones.filter((d) => d.m.id === m.id).forEach((d) => { d.m = m; pintarDron(d); });
      });
      rotarPantallas();
    },
  };
}
