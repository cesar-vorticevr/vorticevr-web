// Weedland Station: escena 3D (three.js). Estación flotando en el espacio con plaza central,
// pabellones de marcas, Universidad, pantallas gigantes y drones que cargan publicidad.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PABELLONES, catalogo } from "./datos.js";
import { PUESTOS } from "./cultivo.js";

const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Medidas: plaza central, pabellones (12 stands en círculo) y módulos exteriores (universidad e islas de marca)
const R_PLAZA = 15, R_PAB = 24, D_PAB = 48, R_ANILLO = 18, D_EXT = 92, R_ISLA = 17, R_UNI = 14;
const FUENTE = "'Fredoka', 'Nunito', system-ui, sans-serif";
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
  return { c, g, t };
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
  fondo.addColorStop(0, m.color2); fondo.addColorStop(1, "#06030f");
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
    g.fillStyle = "#ffd76a"; g.font = `700 40px ${FUENTE}`; g.fillText("🌟 CANJEA TU POLEN 🌟", w / 2, h * 0.2);
    g.fillStyle = "#fff"; ajustar(g, m.cupon.texto, w * 0.86, 84); g.fillText(m.cupon.texto, w / 2, h * 0.44);
    g.fillStyle = m.color; g.font = `700 44px ${FUENTE}`; g.fillText(`por ${m.cupon.costo} 🌟 en ${m.nombre}`, w / 2, h * 0.64);
    g.fillStyle = "rgba(255,255,255,.6)"; g.font = `600 26px ${FUENTE}`; g.fillText("Sujeto a los términos de la marca y a la ley de tu país", w / 2, h * 0.84);
  }
  // marco
  g.strokeStyle = m.color; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
}

// "Video" de las pantallas extra (simulado): escenas que cambian con barra de avance
function dibujarVideo(g, w, h, m, k, avance, productos) {
  const escena = Math.floor(avance * 3), local = (avance * 3) % 1;
  const f = g.createLinearGradient(0, 0, w, h);
  f.addColorStop(0, k % 2 ? m.color2 : "#120a2a"); f.addColorStop(1, k % 2 ? "#06030f" : m.color2);
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
  g.fillStyle = "#fff"; g.font = `700 30px ${FUENTE}`; g.fillText("▶ VIDEO", 95, 47);
}

function dibujarLetrero(g, w, h, m) {
  const f = g.createLinearGradient(0, 0, w, 0);
  f.addColorStop(0, m.color); f.addColorStop(1, mezclar(m.color, 0.25, "#ffffff"));
  g.fillStyle = f; g.fillRect(0, 0, w, h);
  g.fillStyle = m.color2; g.textAlign = "center"; g.textBaseline = "middle";
  ajustar(g, `${m.icono} ${m.nombre}`, w - 40, 70); g.fillText(`${m.icono} ${m.nombre}`, w / 2, h / 2 + 4);
}

function dibujarTotem(g, w, h, m, p) {
  g.fillStyle = "#0b0718"; g.fillRect(0, 0, w, h);
  const f = g.createLinearGradient(0, 0, 0, h);
  f.addColorStop(0, m.color + "55"); f.addColorStop(1, m.color2 + "00");
  g.fillStyle = f; g.fillRect(0, 0, w, h);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `${w * 0.5}px serif`; g.fillText(p.icono, w / 2, h * 0.34);
  g.fillStyle = "#fff"; ajustar(g, p.nombre, w - 24, 30); g.fillText(p.nombre, w / 2, h * 0.64);
  g.fillStyle = m.color; g.font = `700 32px ${FUENTE}`; g.fillText(p.precio, w / 2, h * 0.76);
  g.fillStyle = "rgba(255,255,255,.55)"; g.font = `600 20px ${FUENTE}`; g.fillText(p.cat, w / 2, h * 0.86);
  g.strokeStyle = m.color; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
}

function dibujarMostrador(g, w, h, m) {
  g.fillStyle = m.color2; g.fillRect(0, 0, w, h);
  g.fillStyle = m.color; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `700 ${h * 0.5}px ${FUENTE}`; g.fillText(m.sigla, w / 2, h / 2 + 6);
}

function dibujarBanner(g, w, h, m) {
  const f = g.createLinearGradient(0, 0, w, h);
  f.addColorStop(0, m.color); f.addColorStop(1, mezclar(m.color, 0.55));
  g.fillStyle = f; rr(g, 0, 0, w, h, 26); g.fill();
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
  g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(0, h - 70, w, 70);
  g.fillStyle = m.color; g.textAlign = "center"; g.font = `700 34px ${FUENTE}`;
  g.fillText(`${m.anuncio}  ·  Pabellón ${(PABELLONES.find((p) => p.id === m.pab) || {}).nombre || ""}`, w / 2, h - 34);
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
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
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

  // Cielo con degradado
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { arriba: { value: new THREE.Color("#120830") }, medio: { value: new THREE.Color("#3a1670") }, abajo: { value: new THREE.Color("#050314") } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: "uniform vec3 arriba, medio, abajo; varying vec3 vP; void main(){ float y=vP.y; vec3 c = y>0. ? mix(medio, arriba, smoothstep(0.,.6,y)) : mix(medio, abajo, smoothstep(0.,.5,-y)); gl_FragColor=vec4(c,1.); }",
  })));
  // Estrellas
  {
    const n = 2200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 650 + Math.random() * 350, s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * s * r, u * r, Math.sin(a) * s * r], i * 3);
      const c = new THREE.Color().setHSL(0.6 + Math.random() * 0.3, 0.6, 0.75 + Math.random() * 0.25);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, depthWrite: false })));
  }
  // Nebulosas
  [["#7a3cff", -380, 60, -650, 620], ["#ff3cb4", 480, -40, -520, 520], ["#2ec8ff", 150, 200, -750, 580], ["#5a2cff", -520, -150, 260, 600]].forEach(([c, x, y, z, s]) => {
    const n = spriteBrillo(c, s); n.material.opacity = 0.32; n.position.set(x, y, z); scene.add(n);
  });
  // Planeta con anillo
  {
    const { g, t } = texCanvas(512, 256);
    const f = g.createLinearGradient(0, 0, 0, 256);
    ["#2a1a6e", "#3fa7c9", "#7b4cd8", "#2fd0c0", "#5a2a9c", "#c06ad8", "#2a1a6e"].forEach((c, i, a) => f.addColorStop(i / (a.length - 1), c));
    g.fillStyle = f; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; g.fillRect(0, Math.random() * 256, 512, 2 + Math.random() * 8); }
    const planeta = new THREE.Mesh(new THREE.SphereGeometry(110, 48, 32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, emissive: "#1a0a40", emissiveIntensity: 0.6 }));
    planeta.position.set(-230, -70, -460); planeta.rotation.z = 0.35; scene.add(planeta);
    const ani = texCanvas(512, 8);
    for (let x = 0; x < 512; x++) { ani.g.fillStyle = `rgba(200,170,255,${0.15 + 0.5 * Math.abs(Math.sin(x * 0.09) * Math.sin(x * 0.023))})`; ani.g.fillRect(x, 0, 1, 8); }
    const geoA = new THREE.RingGeometry(145, 225, 96);
    const uv = geoA.attributes.uv, p = geoA.attributes.position;
    for (let i = 0; i < uv.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (r - 145) / 80, 0.5); }
    const anillo = new THREE.Mesh(geoA, new THREE.MeshBasicMaterial({ map: ani.t, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    anillo.position.copy(planeta.position); anillo.rotation.set(rad(72), rad(10), rad(20)); scene.add(anillo);
    const halo = spriteBrillo("#7f6bff", 360); halo.material.opacity = 0.35; halo.position.copy(planeta.position); scene.add(halo);
  }

  scene.add(new THREE.HemisphereLight("#d8e2ff", "#3a2266", 1.25));
  const sol = new THREE.DirectionalLight("#ffffff", 1.6); sol.position.set(40, 80, 50); scene.add(sol);
  const contraluz = new THREE.DirectionalLight("#b48cff", 0.8); contraluz.position.set(-60, 20, -60); scene.add(contraluz);

  const blanco = new THREE.MeshStandardMaterial({ color: "#eef0fb", roughness: 0.38, metalness: 0.12 });
  const gris = new THREE.MeshStandardMaterial({ color: "#c9cde0", roughness: 0.5, metalness: 0.2 });
  const oscuro = new THREE.MeshStandardMaterial({ color: "#1c1830", roughness: 0.4, metalness: 0.5 });
  const verde = new THREE.MeshStandardMaterial({ color: "#46c46f", flatShading: true, roughness: 0.8 });
  const neones = {};
  const neon = (c) => neones[c] || (neones[c] = new THREE.MeshBasicMaterial({ color: c }));
  const conMapa = (t) => new THREE.MeshBasicMaterial({ map: t, toneMapped: false });

  const tocables = [];
  const suelos = []; // pisos donde se puede caminar (para tocar y caminar)
  const obst = []; // obstáculos: { c: [x, z, r] } círculos o { caja: objeto3D, x0, x1, z0, z1 } cajas en coordenadas locales
  const etiquetas = []; // { el, pos }
  const anim = []; // funciones (t, dt)
  const pantallas = []; // pantallas gigantes de la plaza

  // Plataforma flotante (disco con base en cono y aro de neón)
  function plataforma(radio, color, alto = 1.2) {
    const g = new THREE.Group();
    const piso = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, alto, 72), blanco); g.add(piso);
    piso.userData.suelo = true; suelos.push(piso);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(radio * 0.92, radio * 0.35, radio * 0.45, 48), gris);
    base.position.y = -alto / 2 - radio * 0.225; g.add(base);
    const punta = new THREE.Mesh(new THREE.ConeGeometry(radio * 0.35, radio * 0.35, 32), gris);
    punta.rotation.x = Math.PI; punta.position.y = base.position.y - radio * 0.225 - radio * 0.175; g.add(punta);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(radio + 0.05, 0.14, 8, 120), neon(color));
    aro.rotation.x = Math.PI / 2; aro.position.y = alto / 2; g.add(aro);
    const aro2 = aro.clone(); aro2.position.y = -alto / 2; aro2.scale.setScalar(0.995); g.add(aro2);
    const luz = spriteBrillo(color, radio * 0.9); luz.position.y = base.position.y - radio * 0.3; luz.material.opacity = 0.5; g.add(luz);
    return g;
  }
  // Puente entre la plaza y un módulo
  function puente(angulo, color, d, r) {
    const largo = d - R_PLAZA - r + 1.2;
    const g = new THREE.Group();
    const piso = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.5, 3.6), blanco); g.add(piso);
    piso.userData.suelo = true; suelos.push(piso);
    [-1.9, 1.9].forEach((z) => {
      const baranda = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.08, 0.08), neon(color)); baranda.position.set(0, 0.9, z); g.add(baranda);
      const vidrio = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.9, 0.05), new THREE.MeshStandardMaterial({ color: "#bfe8ff", transparent: true, opacity: 0.18 }));
      vidrio.position.set(0, 0.45, z); g.add(vidrio);
    });
    const tira = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.02, 0.25), neon(color)); tira.position.y = 0.26; g.add(tira);
    const m = R_PLAZA + largo / 2 - 0.6;
    g.position.set(Math.cos(rad(angulo)) * m, 0.35, -Math.sin(rad(angulo)) * m);
    g.rotation.y = rad(angulo);
    scene.add(g);
  }

  // ----- plaza central -----
  scene.add(plataforma(R_PLAZA, "#b18cff", 1.4));
  {
    const torre = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.6, 9, 24), blanco); torre.position.y = 5.2; scene.add(torre);
    obst.push({ c: [0, 0, 2] });
    const anillos = [3, 5.5, 8].map((y) => { const a = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.1, 8, 32), neon("#ff7ad9")); a.rotation.x = Math.PI / 2; a.position.y = y; scene.add(a); return a; });
    anim.push((t) => anillos.forEach((a, i) => { a.position.y = 2 + ((t * 1.2 + i * 2.6) % 7.8); }));
    // Pantalla de 4 caras
    const caja = new THREE.Group(); caja.position.y = 13; scene.add(caja);
    const W = 8.4, H = 4.7;
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
    [H / 2 + 0.2, -H / 2 - 0.2].forEach((y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.14, W + 0.4), neon("#b18cff")); b.position.y = y; caja.add(b); });
    anim.push((t, dt) => { if (!quieto) caja.rotation.y += dt * 0.12; });
    // Letrero WEEDLAND sobre la pantalla
    const lt = texCanvas(1024, 200);
    lt.g.textAlign = "center"; lt.g.textBaseline = "middle"; lt.g.font = `700 150px ${FUENTE}`;
    const grad = lt.g.createLinearGradient(0, 0, 1024, 0); grad.addColorStop(0, "#ff9ae6"); grad.addColorStop(0.5, "#ffffff"); grad.addColorStop(1, "#8ff0ff");
    lt.g.shadowColor = "#ff7ad9"; lt.g.shadowBlur = 30; lt.g.fillStyle = grad; lt.g.fillText("WEEDLAND", 512, 104);
    const letrero = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt.t, transparent: true, depthWrite: false }));
    letrero.scale.set(14, 2.7, 1); letrero.position.y = 18.4; scene.add(letrero);
    const st = texCanvas(512, 80); st.g.fillStyle = "#cfe6ff"; st.g.textAlign = "center"; st.g.font = `600 52px ${FUENTE}`; st.g.fillText("· S T A T I O N ·", 256, 56);
    const sub = new THREE.Sprite(new THREE.SpriteMaterial({ map: st.t, transparent: true, depthWrite: false }));
    sub.scale.set(6.4, 1, 1); sub.position.y = 16.6; scene.add(sub);
    // Torres turbina (como en Expoweed 2020), al frente, donde no hay puentes
    [67.5, 112.5].forEach((ga, k) => {
      const x = Math.cos(rad(ga)) * 10, z = Math.sin(rad(ga)) * 10;
      obst.push({ c: [x, z, 2] });
      const g = new THREE.Group(); g.position.set(x, 0.7, z); scene.add(g);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.2, 24), blanco); base.position.y = 0.6; g.add(base);
      const nucleo = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 11, 16), neon(k ? "#8ff0ff" : "#ff7ad9")); nucleo.position.y = 6.6; g.add(nucleo);
      const brillo = spriteBrillo(k ? "#8ff0ff" : "#ff7ad9", 6); brillo.position.y = 6.6; brillo.scale.set(4, 13, 1); brillo.material.opacity = 0.6; g.add(brillo);
      const aspas = new THREE.Group(); aspas.position.y = 6.6; g.add(aspas);
      for (let i = 0; i < 3; i++) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.25, 11, 0.9), blanco);
        const ang = (i * Math.PI * 2) / 3; a.position.set(Math.cos(ang) * 1.5, 0, Math.sin(ang) * 1.5); a.rotation.y = -ang; aspas.add(a);
      }
      const tapa = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 24), blanco); tapa.position.y = 12.3; g.add(tapa);
      anim.push((t, dt) => { if (!quieto) aspas.rotation.y += dt * (k ? 0.8 : -0.8); });
    });
    // Plantas en la plaza, entre los puentes
    [22.5, 157.5, 202.5, 247.5, 292.5, 337.5].forEach((ga) => {
      const x = Math.cos(rad(ga)) * 11, z = Math.sin(rad(ga)) * 11;
      const maceta = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.8, 16), blanco); maceta.position.set(x, 1.1, z); scene.add(maceta);
      obst.push({ c: [x, z, 0.7] });
      const planta = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), verde); planta.position.set(x, 2, z); planta.scale.y = 1.4; scene.add(planta);
    });
  }

  // Partículas que flotan alrededor
  {
    const n = 600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 110; pos.set([Math.cos(a) * r, -10 + Math.random() * 40, Math.sin(a) * r], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const punto = texCanvas(64, 64); { const r = punto.g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)"); punto.g.fillStyle = r; punto.g.fillRect(0, 0, 64, 64); }
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.3, map: punto.t, color: "#d8c4ff", transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(pts);
    anim.push((t, dt) => { if (!quieto) pts.rotation.y += dt * 0.01; });
  }

  // ----- módulos (pabellones, universidad, islas) -----
  const modulos = {}; // id -> { centro, haciaPlaza, r, d }
  function modulo(id, angulo, d, r, color) {
    const a = rad(angulo);
    const centro = new THREE.Vector3(Math.cos(a) * d, 0, -Math.sin(a) * d);
    const p = plataforma(r, color, 1.2); p.position.copy(centro); scene.add(p);
    puente(angulo, color, d, r);
    const haciaPlaza = centro.clone().negate().normalize();
    return (modulos[id] = { id, centro, haciaPlaza, r, d, angulo });
  }

  // ----- robot anfitrión (reutilizable) -----
  function robot(color, x, z, escala = 1) {
    const r = new THREE.Group(); r.position.set(x, 0.3, z); r.scale.setScalar(escala);
    const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 6, 16), blanco); cuerpo.position.y = 1.0; r.add(cuerpo);
    const panza = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), neon(color)); panza.position.set(0, 1.05, 0.43); r.add(panza);
    const cabeza = new THREE.Group(); cabeza.position.y = 1.95; r.add(cabeza);
    cabeza.add(new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 16), blanco));
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 12, -0.9, 1.8, 1.1, 0.9), oscuro); visor.position.z = 0.1; cabeza.add(visor);
    const ojos = [-0.13, 0.13].map((ox) => { const o = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), neon("#7ff6ff")); o.position.set(ox, 0.02, 0.495); cabeza.add(o); return o; });
    const antena = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), neon(color)); antena.position.y = 0.6; cabeza.add(antena);
    const brazos = [-1, 1].map((s) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.4, 4, 8), blanco); b.position.set(s * 0.55, 1.1, 0); b.rotation.z = s * 0.3; r.add(b); return b; });
    const fase = Math.random() * 6;
    let saludando = 0;
    r.userData.saludar = () => (saludando = 2.4);
    r.userData.animar = (t, dt) => {
      r.position.y = 0.3 + Math.sin(t * 2 + fase) * 0.08;
      cabeza.rotation.y = Math.sin(t * 0.7 + fase) * 0.5;
      ojos.forEach((o) => (o.scale.y = (t + fase) % 4 < 0.12 ? 0.15 : 1));
      if (saludando > 0) { saludando -= dt; brazos[1].rotation.z = -2.2 + Math.sin(t * 14) * 0.4; } else brazos[1].rotation.z = 0.3;
    };
    return r;
  }
  function holograma(m, x, y, z, tam = 1) {
    const holo = new THREE.Group(); holo.position.set(x, y, z);
    const color = new THREE.Color(m.color);
    const malla = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 * tam, 0), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.8 })); holo.add(malla);
    holo.add(spriteEmoji(m.icono, 1.1 * tam));
    const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.55 * tam, 1.1 * tam, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    haz.position.y = -0.85 * tam; holo.add(haz);
    const fase = Math.random() * 6;
    holo.userData.animar = (t, dt) => { holo.rotation.y += dt * 0.9; malla.rotation.x += dt * 0.4; holo.position.y = y + Math.sin(t * 1.6 + fase) * 0.12 * tam; };
    return holo;
  }
  function totem(m, s, x, z, rotY, alto = 2.7) {
    const tt = texCanvas(256, 512, 0.5);
    const tot = new THREE.Group(); tot.position.set(x, 0, z); tot.rotation.y = rotY;
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(1.3, alto, 0.25), oscuro); cuerpo.position.y = 0.3 + alto / 2; tot.add(cuerpo);
    const cara = new THREE.Mesh(new THREE.PlaneGeometry(1.2, alto - 0.3), conMapa(tt.t)); cara.position.set(0, 0.3 + alto / 2, 0.13); tot.add(cara);
    const luz = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.06, 0.3), neon(m.color)); luz.position.y = 0.3 + alto; tot.add(luz);
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
    const piso = new THREE.Mesh(new THREE.BoxGeometry(A, 0.3, P), blanco); piso.position.y = 0.15; g.add(piso);
    const filo = new THREE.Mesh(new THREE.BoxGeometry(A + 0.05, 0.08, P + 0.05), neon(m.color)); filo.position.y = 0.3; g.add(filo);
    const zMuro = -P / 2 + 0.2;
    const muro = new THREE.Mesh(new THREE.BoxGeometry(A, H, 0.35), blanco); muro.position.set(0, 0.3 + H / 2, zMuro); g.add(muro);
    [-1, 1].forEach((sg) => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, H, 1.8), blanco); w.position.set(sg * (A / 2 - 0.15), 0.3 + H / 2, zMuro + 0.8); w.rotation.y = sg * 0.35; g.add(w); });
    // Pantalla principal
    s.pt = texCanvas(1024, 576, premium ? 0.75 : 0.5);
    const pw = premium ? 6.4 : 5.6, ph = pw * 0.5625;
    const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), conMapa(s.pt.t));
    pantalla.position.set(0, premium ? 3.5 : 2.75, zMuro + 0.19); g.add(pantalla);
    if (premium) {
      // Muro de video: 4 pantallas más, cada una con su propio video
      [[-1, 1], [-1, -1], [1, 1], [1, -1]].forEach(([sx, sy], i) => {
        const vt = texCanvas(1024, 576, 0.375);
        const v = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.3), conMapa(vt.t));
        v.position.set(sx * 4.35, 3.5 + sy * 0.95, zMuro + 0.21); g.add(v);
        const marco = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.45, 0.05), neon(m.color)); marco.position.set(v.position.x, v.position.y, zMuro + 0.15); g.add(marco);
        s.videos.push({ tx: vt, k: i, avance: Math.random() });
      });
      // Arco de luz en la parte alta
      const arco = new THREE.Mesh(new THREE.TorusGeometry(A / 2 - 0.3, 0.12, 8, 48, Math.PI), neon(m.color));
      arco.position.set(0, H - 2.6, zMuro + 0.25); arco.scale.y = 0.55; g.add(arco);
    }
    // Letrero
    s.lt = texCanvas(1024, 200, 0.5);
    const lw = premium ? 8 : 5.4;
    const letrero = new THREE.Mesh(new THREE.BoxGeometry(lw, premium ? 1.4 : 1.05, 0.35), [oscuro, oscuro, oscuro, oscuro, conMapa(s.lt.t), oscuro]);
    letrero.position.set(0, 0.3 + H + (premium ? 0.75 : 0.55), zMuro); g.add(letrero);
    if (premium) { const est = spriteEmoji("⭐", 1.4); est.position.set(lw / 2 + 0.6, 0.3 + H + 0.8, zMuro); g.add(est); }
    // Tótems
    const tz = P / 2 - 1.6;
    g.add(totem(m, s, -(A / 2 - 1.1), tz, 0.4, premium ? 3.2 : 2.7), totem(m, s, A / 2 - 1.1, tz, -0.4, premium ? 3.2 : 2.7));
    // Mostrador con logo
    s.mt = texCanvas(512, 256, 0.5);
    const most = new THREE.Mesh(new THREE.BoxGeometry(premium ? 3.4 : 2.6, 1.05, 0.9), [blanco, blanco, blanco, blanco, conMapa(s.mt.t), blanco]);
    most.position.set(0.6, 0.82, P / 2 - 2.2); g.add(most);
    const holo = holograma(m, 0.6, 2.55, P / 2 - 2.2, premium ? 1.3 : 1); g.add(holo); s.anim.push(holo.userData.animar);
    const rob = robot(m.color, -(premium ? 2.6 : 1.9), P / 2 - 1.5); g.add(rob); s.anim.push(rob.userData.animar);
    s.saludar = rob.userData.saludar;
    if (premium) { const rob2 = robot(m.color, 3.4, P / 2 - 1.5, 0.9); g.add(rob2); s.anim.push(rob2.userData.animar); }
    // Macetas
    [-(A / 2 - 1.1), A / 2 - 1.1].forEach((x) => {
      const mac = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.5, 12), blanco); mac.position.set(x, 0.55, zMuro + 1.4); g.add(mac);
      const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), verde); pl.position.set(x, 1.1, zMuro + 1.4); pl.scale.y = 1.5; g.add(pl);
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
    const mod = modulo(m.id, m.angulo, D_EXT, R_ISLA, m.color);
    const g = new THREE.Group(); g.position.set(mod.centro.x, 0.6, mod.centro.z);
    g.lookAt(0, 0.6, 0); // el frente mira a la plaza
    g.userData = { tipo: "stand", id: m.id };
    scene.add(g); tocables.push(g);
    const s = { m, grupo: g, pos: g.position.clone(), ancho: 20, alto: 9, isla: true, pt: null, lt: null, mt: null, totems: [], videos: [], slide: 0, totemI: 0, productos: catalogo(m), anim: [] };
    // Piso con el color de la marca
    const alfombra = new THREE.Mesh(new THREE.CircleGeometry(R_ISLA - 1.5, 64), new THREE.MeshStandardMaterial({ color: m.color2, roughness: 0.6 }));
    alfombra.rotation.x = -Math.PI / 2; alfombra.position.y = 0.02; g.add(alfombra);
    const anilloP = new THREE.Mesh(new THREE.RingGeometry(R_ISLA - 1.7, R_ISLA - 1.5, 64), neon(m.color)); anilloP.rotation.x = -Math.PI / 2; anilloP.position.y = 0.03; g.add(anilloP);
    // Muro curvo de video detrás (mirando hacia la entrada)
    const RM = 10.5, ARCO = rad(150);
    const muro = new THREE.Mesh(new THREE.CylinderGeometry(RM, RM, 8, 48, 1, true, Math.PI - ARCO / 2, ARCO), new THREE.MeshStandardMaterial({ color: "#eef0fb", roughness: 0.4, side: THREE.DoubleSide }));
    muro.position.y = 4; g.add(muro);
    const tapa = new THREE.Mesh(new THREE.TorusGeometry(RM, 0.18, 8, 64, ARCO), neon(m.color)); tapa.rotation.set(Math.PI / 2, 0, -Math.PI / 2 - ARCO / 2); tapa.position.y = 8; g.add(tapa);
    for (let k = 0; k <= 10; k++) { const a = Math.PI - ARCO / 2 + (ARCO * k) / 10; obst.push({ caja: g, x0: Math.sin(a) * RM - 0.9, x1: Math.sin(a) * RM + 0.9, z0: Math.cos(a) * RM - 0.9, z1: Math.cos(a) * RM + 0.9 }); }
    // 3 pantallas grandes en el muro: la del centro es la principal
    s.pt = texCanvas(1024, 576, 0.75);
    [-1, 0, 1].forEach((i) => {
      const a = Math.PI + i * rad(42);
      const tx = i === 0 ? s.pt : texCanvas(1024, 576, 0.6);
      const w = i === 0 ? 7.2 : 5.6;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5625), conMapa(tx.t));
      p.position.set(Math.sin(a) * (RM - 0.25), 4.2, Math.cos(a) * (RM - 0.25)); p.rotation.y = Math.atan2(-p.position.x, -p.position.z); g.add(p);
      if (i !== 0) s.videos.push({ tx, k: i + 1, avance: Math.random() });
    });
    // Letrero gigante sobre el muro
    s.lt = texCanvas(1024, 200, 0.75);
    const letrero = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.35), new THREE.MeshBasicMaterial({ map: s.lt.t, toneMapped: false, side: THREE.DoubleSide }));
    letrero.position.set(0, 9.6, -RM + 0.6); g.add(letrero);
    // Logo gigante flotando con anillos
    const logo = spriteEmoji(m.icono, 6); logo.position.set(0, 13.5, -3); g.add(logo);
    const halo = spriteBrillo(m.color, 12); halo.position.copy(logo.position); halo.material.opacity = 0.55; g.add(halo);
    const aros = [0, 1].map((k) => { const a = new THREE.Mesh(new THREE.TorusGeometry(3.6 + k * 0.8, 0.08, 8, 64), neon(k ? "#ffffff" : m.color)); a.position.copy(logo.position); g.add(a); return a; });
    s.anim.push((t) => { logo.position.y = 13.5 + Math.sin(t * 1.1) * 0.4; aros[0].rotation.set(t * 0.6, t * 0.4, 0); aros[1].rotation.set(-t * 0.3, 0, t * 0.5); aros.forEach((a) => a.position.y = logo.position.y); });
    // Mostrador central con holograma
    s.mt = texCanvas(512, 256, 0.5);
    const most = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 1.2), [blanco, blanco, blanco, blanco, conMapa(s.mt.t), blanco]); most.position.set(0, 0.55, -3); g.add(most);
    obst.push({ caja: g, x0: -2.3, x1: 2.3, z0: -3.8, z1: -2.2 });
    const holo = holograma(m, 0, 2.6, -3, 1.6); g.add(holo); s.anim.push(holo.userData.animar);
    // Vitrinas con productos que giran (tocarlas abre el catálogo)
    const pedestales = [];
    [-62, -36, 36, 62].forEach((gr, i) => {
      const a = rad(gr), x = Math.sin(a) * 6.5, z = -Math.cos(a) * 6.5 + 1;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.3, 24), blanco); ped.position.set(x, 0.65, z); g.add(ped);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 32), neon(m.color)); aro.rotation.x = Math.PI / 2; aro.position.set(x, 1.32, z); g.add(aro);
      const vidrio = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.5, 24, 1, true), new THREE.MeshStandardMaterial({ color: "#bfe8ff", transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })); vidrio.position.set(x, 2.1, z); g.add(vidrio);
      const prod = s.productos[(i * 3) % Math.max(1, s.productos.length)] || { icono: m.icono };
      const sp = spriteEmoji(prod.icono, 1.1); sp.position.set(x, 2.1, z); g.add(sp); pedestales.push(sp);
      obst.push({ caja: g, x0: x - 1.1, x1: x + 1.1, z0: z - 1.1, z1: z + 1.1 });
    });
    s.anim.push((t) => pedestales.forEach((p, i) => { p.position.y = 2.1 + Math.sin(t * 2 + i) * 0.12; p.material.rotation = Math.sin(t + i) * 0.2; }));
    // Tótems a los lados de la entrada
    [[-1, 0.3], [1, -0.3]].forEach(([sg, r]) => g.add(totem(m, s, sg * 5.5, 5, r, 3.4)));
    [[-5.5, 5], [5.5, 5]].forEach(([x, z]) => obst.push({ caja: g, x0: x - 0.9, x1: x + 0.9, z0: z - 0.5, z1: z + 0.5 }));
    // Robots anfitriones
    [[-2.8, -1], [2.8, -1]].forEach(([x, z], i) => { const r = robot(m.color, x, z, 1.1); g.add(r); s.anim.push(r.userData.animar); if (!i) s.saludar = r.userData.saludar; });
    // Arco de entrada en la punta del puente
    const ent = new THREE.Group(); ent.position.set(0, 0, R_ISLA - 1.2); g.add(ent);
    [-2.6, 2.6].forEach((x) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), blanco); c.position.set(x, 2.5, 0); ent.add(c); const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.6, 0.65), neon(m.color)); l.position.set(x, 2.5, 0); ent.add(l); obst.push({ caja: g, x0: x - 0.6, x1: x + 0.6, z0: R_ISLA - 1.8, z1: R_ISLA - 0.6 }); });
    const et = texCanvas(1024, 200, 0.5);
    const viga = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.1, 0.5), [oscuro, oscuro, oscuro, oscuro, conMapa(et.t), conMapa(et.t)]); viga.position.y = 5.3; ent.add(viga);
    s.entrada = et;
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
    if (cambiarSlide) s.slide = (s.slide + 1) % 3;
    dibujarPantalla(s.pt.g, 1024, 576, s.m, s.slide, s.productos); s.pt.t.needsUpdate = true;
    s.lt.g.clearRect(0, 0, 1024, 200); dibujarLetrero(s.lt.g, 1024, 200, s.m); s.lt.t.needsUpdate = true;
    if (s.entrada) { s.entrada.g.clearRect(0, 0, 1024, 200); dibujarLetrero(s.entrada.g, 1024, 200, s.m); s.entrada.t.needsUpdate = true; }
    dibujarMostrador(s.mt.g, 512, 256, s.m); s.mt.t.needsUpdate = true;
    pintarTotems(s); pintarVideos(s, 0);
  }
  function pintarTotems(s) {
    const lista = s.productos.length ? s.productos : [{ icono: s.m.icono, nombre: s.m.nombre, precio: "", cat: "" }];
    s.totems.forEach((tt, i) => { dibujarTotem(tt.g, 256, 512, s.m, lista[(s.totemI + i * 5) % lista.length]); tt.t.needsUpdate = true; });
  }
  function pintarVideos(s, dt) {
    s.videos.forEach((v) => { v.avance = (v.avance + dt / 12) % 1; dibujarVideo(v.tx.g, 1024, 576, s.m, v.k, v.avance, s.productos); v.tx.t.needsUpdate = true; });
  }

  // Lugares a los que se puede ir caminando (puestos, parcelas, tu tienda, la nave): id -> { p, mirar, entrar }
  const lugares = {};
  function lugar(id, g, local, mirarLocal, entrar = true) {
    g.updateMatrixWorld(true);
    const p = g.localToWorld(local.clone()); p.y = 0;
    const mirar = g.localToWorld(mirarLocal.clone()); mirar.y = 0;
    lugares[id] = { p, mirar, entrar };
  }
  function letreroPlano(texto, color, ancho = 4, fondo = "#120a2a") {
    const t = texCanvas(1024, 220, 0.5);
    t.g.fillStyle = fondo; rr(t.g, 0, 0, 1024, 220, 40); t.g.fill();
    t.g.strokeStyle = color; t.g.lineWidth = 14; rr(t.g, 7, 7, 1010, 206, 36); t.g.stroke();
    t.g.fillStyle = "#fff"; t.g.textAlign = "center"; t.g.textBaseline = "middle"; ajustar(t.g, texto, 940, 110); t.g.fillText(texto, 512, 116);
    return new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho * 0.215), new THREE.MeshBasicMaterial({ map: t.t, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  }
  function arcoEntrada(g, texto, color, z) {
    const ent = new THREE.Group(); ent.position.set(0, 0, z); g.add(ent);
    [-2.6, 2.6].forEach((x) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), blanco); c.position.set(x, 2.5, 0); ent.add(c); const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.6, 0.65), neon(color)); l.position.set(x, 2.5, 0); ent.add(l); obst.push({ caja: g, x0: x - 0.6, x1: x + 0.6, z0: z - 0.6, z1: z + 0.6 }); });
    const viga = letreroPlano(texto, color, 6.4); viga.material.side = THREE.FrontSide; viga.position.y = 5.4; ent.add(viga);
    const atras = viga.clone(); atras.rotation.y = Math.PI; ent.add(atras);
  }

  // ----- Mercado: puestos para comprar semillas y aditamentos, y talleres para transformar la cosecha -----
  const puestos3d = {};
  function crearMercado() {
    const mod = modulo("mercado", 90, D_EXT, R_ISLA, "#ffd76a");
    const g = new THREE.Group(); g.position.set(mod.centro.x, 0.6, mod.centro.z); g.lookAt(0, 0.6, 0);
    scene.add(g); g.updateMatrixWorld(true);
    const alfombra = new THREE.Mesh(new THREE.CircleGeometry(R_ISLA - 1.5, 64), new THREE.MeshStandardMaterial({ color: "#3a2a10", roughness: 0.7 }));
    alfombra.rotation.x = -Math.PI / 2; alfombra.position.y = 0.02; g.add(alfombra);
    // letrero central flotante
    const centro = new THREE.Group(); centro.position.set(0, 0, -1); g.add(centro);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 0.6, 32), blanco); base.position.y = 0.3; centro.add(base);
    obst.push({ caja: g, x0: -2.1, x1: 2.1, z0: -3.1, z1: 1.1 });
    const carrito = spriteEmoji("🛒", 1.6); carrito.position.y = 1.5; centro.add(carrito);
    const sign = letreroPlano("MERCADO", "#ffd76a", 6, "#3a2a10"); sign.position.y = 10; centro.add(sign);
    anim.push((t) => { carrito.position.y = 1.5 + Math.sin(t * 1.4) * 0.15; sign.rotation.y = t * 0.3; });
    arcoEntrada(g, "🛒 Mercado", "#ffd76a", R_ISLA - 1.2);
    // 5 puestos en semicírculo mirando al centro
    PUESTOS.forEach((pu, i) => {
      const a = rad(-84 + i * 42), R = 10.5;
      const pg = new THREE.Group(); pg.position.set(Math.sin(a) * R, 0, -Math.cos(a) * R);
      pg.userData = { tipo: "puesto", id: pu.id }; g.add(pg); tocables.push(pg);
      pg.rotation.y = Math.atan2(0 - pg.position.x, -1 - pg.position.z); // mira al centro del mercado
      const color = new THREE.Color(pu.color);
      const mostrador = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1.3), new THREE.MeshStandardMaterial({ color: pu.color, roughness: 0.5 })); mostrador.position.set(0, 0.55, 0); pg.add(mostrador);
      const tapa = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 1.5), blanco); tapa.position.y = 1.16; pg.add(tapa);
      [-1.9, 1.9].forEach((x) => { const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 8), blanco); poste.position.set(x, 1.7, -0.6); pg.add(poste); });
      // toldo a rayas
      const rayas = texCanvas(256, 64, 1);
      for (let k = 0; k < 8; k++) { rayas.g.fillStyle = k % 2 ? "#ffffff" : pu.color; rayas.g.fillRect(k * 32, 0, 32, 64); }
      const toldo = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.1, 2.2), [blanco, blanco, new THREE.MeshStandardMaterial({ map: rayas.t }), blanco, blanco, blanco]);
      toldo.position.set(0, 3.45, 0); toldo.rotation.x = 0.25; pg.add(toldo);
      const borde = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 0.06), neon(pu.color)); borde.position.set(0, 3.15, 1.05); pg.add(borde);
      const letrero = letreroPlano(`${pu.icono} ${pu.nombre}`, pu.color, 3.8); letrero.position.set(0, 4.25, -0.2); pg.add(letrero);
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
    const mod = modulo("cultivo", 270, D_EXT, R_ISLA, "#7dffb3");
    const g = new THREE.Group(); g.position.set(mod.centro.x, 0.6, mod.centro.z); g.lookAt(0, 0.6, 0);
    scene.add(g);
    const pasto = new THREE.Mesh(new THREE.CircleGeometry(R_ISLA - 1.5, 64), new THREE.MeshStandardMaterial({ color: "#2f6b3e", roughness: 0.9 }));
    pasto.rotation.x = -Math.PI / 2; pasto.position.y = 0.02; g.add(pasto);
    arcoEntrada(g, "🌱 Mi cultivo", "#7dffb3", R_ISLA - 1.2);
    // invernadero: costillas de cristal sobre las parcelas
    [-6.5, -1.8, 2.9].forEach((z) => {
      const costilla = new THREE.Mesh(new THREE.TorusGeometry(10, 0.12, 8, 48, Math.PI), neon("#bfffe0")); costilla.position.set(0, 0, z); costilla.scale.y = 0.62; g.add(costilla);
    });
    const tierra = new THREE.MeshStandardMaterial({ color: "#4a2f1c", roughness: 1 });
    for (let i = 0; i < 8; i++) {
      const x = [-6.9, -2.3, 2.3, 6.9][i % 4], z = i < 4 ? 1.2 : -4.6;
      const pg = new THREE.Group(); pg.position.set(x, 0, z); pg.userData = { tipo: "parcela", id: i };
      g.add(pg); tocables.push(pg);
      const cama = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 3), blanco); cama.position.y = 0.3; pg.add(cama);
      const suelo = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 2.7), tierra); suelo.position.y = 0.62; pg.add(suelo);
      const filo = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.06, 3.05), neon("#7dffb3")); filo.position.y = 0.6; pg.add(filo);
      const planta = new THREE.Group(); planta.position.y = 0.66; pg.add(planta);
      const extras = new THREE.Group(); pg.add(extras);
      const num = letreroPlano(`${i + 1}`, "#7dffb3", 0.9); num.position.set(0, 0.35, 1.52); pg.add(num);
      obst.push({ caja: g, x0: x - 1.6, x1: x + 1.6, z0: z - 1.6, z1: z + 1.6 });
      lugar("parcela:" + i, g, new THREE.Vector3(x, 0, z + 2.5), new THREE.Vector3(x, 0, z), false);
      parcelas3d.push({ pg, planta, extras, clave: "" });
    }
    // tu tienda virtual al fondo
    const tg = new THREE.Group(); tg.position.set(0, 0, -11); tg.userData = { tipo: "tienda", id: "tienda" }; g.add(tg); tocables.push(tg);
    const muro = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 0.4), blanco); muro.position.set(0, 2, -1.2); tg.add(muro);
    const repisa = [0.9, 1.9, 2.9].map((y) => { const r = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 0.6), gris); r.position.set(0, y, -0.8); tg.add(r); return r; });
    const most = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1), new THREE.MeshStandardMaterial({ color: "#7dffb3", roughness: 0.5 })); most.position.set(0, 0.55, 1); tg.add(most);
    const letrero = letreroPlano("🏪 Tu tienda", "#7dffb3", 5); letrero.position.set(0, 4.7, -1); tg.add(letrero);
    const rob = robot("#7dffb3", 2.6, 0.6, 0.9); tg.add(rob); anim.push((t, dt) => { if (!quieto) rob.userData.animar(t, dt); });
    const productos = new THREE.Group(); tg.add(productos);
    obst.push({ caja: g, x0: -4.2, x1: 4.2, z0: -12.6, z1: -9.4 });
    lugar("tienda", g, new THREE.Vector3(0, 0, -7.6), new THREE.Vector3(0, 0, -11));
    tienda3d = { productos, rob };
    etiquetas.push({ el: cfg.etiqueta({ id: "cultivo", icono: "🌱", nombre: "Mi cultivo", color: "#7dffb3" }), pos: new THREE.Vector3(mod.centro.x, 12, mod.centro.z) });
    lugar("cultivo", g, new THREE.Vector3(0, 0, 3.5), new THREE.Vector3(0, 0, -3), false);
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
        const lam = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.8), neon("#fff6c8")); lam.position.y = 3.8; P.extras.add(lam);
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

  // ----- la nave del tour (flotando en la plaza) -----
  const NAVE_BASE = new THREE.Vector3(0, 5.2, 6.6);
  const nave = new THREE.Group(); nave.position.copy(NAVE_BASE); nave.userData = { tipo: "nave", id: "nave" };
  scene.add(nave); tocables.push(nave);
  {
    const casco = new THREE.Mesh(new THREE.CapsuleGeometry(1.25, 3.6, 8, 24), blanco); casco.rotation.x = Math.PI / 2; nave.add(casco);
    const cabina = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), new THREE.MeshStandardMaterial({ color: "#6ff0ff", roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.75, emissive: "#1b6f80", emissiveIntensity: 0.5 }));
    cabina.position.set(0, 0.55, 1.4); cabina.scale.set(1, 0.75, 1.3); nave.add(cabina);
    [-1, 1].forEach((s) => {
      const ala = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 1.8), blanco); ala.position.set(s * 2.2, -0.2, -0.6); ala.rotation.y = s * 0.35; ala.rotation.z = s * -0.12; nave.add(ala);
      const punta = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 1.2), neon(s < 0 ? "#ff7ad9" : "#6ff0ff")); punta.position.set(s * 3.75, -0.05, -1); nave.add(punta);
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.4, 16), gris); motor.rotation.x = Math.PI / 2; motor.position.set(s * 0.95, -0.35, -2.7); nave.add(motor);
      const fuego = spriteBrillo(s < 0 ? "#ff7ad9" : "#6ff0ff", 2.2); fuego.position.set(s * 0.95, -0.35, -3.5); nave.add(fuego);
    });
    const aleta = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 1.4), blanco); aleta.position.set(0, 1.2, -2.2); aleta.rotation.x = -0.4; nave.add(aleta);
    const franja = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.06, 8, 32), neon("#b18cff")); franja.position.z = 0.2; nave.add(franja);
    const plataformaN = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.75, 48), neon("#6ff0ff")); plataformaN.rotation.x = -Math.PI / 2; plataformaN.position.set(NAVE_BASE.x, 0.72, NAVE_BASE.z); scene.add(plataformaN);
    const haz = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.6, 4.4, 24, 1, true), new THREE.MeshBasicMaterial({ color: "#6ff0ff", transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    haz.position.set(NAVE_BASE.x, 2.9, NAVE_BASE.z); scene.add(haz);
    anim.push((t) => { if (!tour) { nave.position.y = NAVE_BASE.y + Math.sin(t * 1.3) * 0.25; nave.rotation.z = Math.sin(t * 0.9) * 0.04; } haz.visible = !tour; });
    etiquetas.push({ el: cfg.etiqueta({ id: "nave", icono: "🚀", nombre: "Tour espacial", color: "#6ff0ff" }), pos: new THREE.Vector3(NAVE_BASE.x, 8.5, NAVE_BASE.z) });
    lugares.nave = { p: new THREE.Vector3(NAVE_BASE.x + 3.2, 0, NAVE_BASE.z + 1.5), mirar: NAVE_BASE.clone(), entrar: true };
  }

  // ----- agujero negro en el cielo -----
  const HOYO = new THREE.Vector3(0, 170, -620);
  {
    const negro = new THREE.Mesh(new THREE.SphereGeometry(34, 32, 16), new THREE.MeshBasicMaterial({ color: "#000000" })); negro.position.copy(HOYO); scene.add(negro);
    const d = texCanvas(512, 512, 1);
    const gr = d.g.createRadialGradient(256, 256, 70, 256, 256, 256);
    gr.addColorStop(0, "rgba(255,240,200,1)"); gr.addColorStop(0.25, "rgba(255,140,220,.9)"); gr.addColorStop(0.55, "rgba(140,90,255,.6)"); gr.addColorStop(1, "rgba(40,20,120,0)");
    d.g.fillStyle = gr; d.g.fillRect(0, 0, 512, 512);
    const disco = new THREE.Mesh(new THREE.RingGeometry(38, 120, 96), new THREE.MeshBasicMaterial({ map: d.t, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    const uv = disco.geometry.attributes.uv, pp = disco.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) { uv.setXY(i, 0.5 + pp.getX(i) / 240, 0.5 + pp.getY(i) / 240); }
    disco.position.copy(HOYO); disco.rotation.set(rad(70), 0, 0); scene.add(disco);
    const halo = spriteBrillo("#a56bff", 330); halo.position.copy(HOYO); halo.material.opacity = 0.45; scene.add(halo);
    anim.push((t, dt) => { disco.rotation.z += dt * 0.15; });
  }

  // ----- tour en la nave: recorrido narrado + túnel del agujero negro + regreso -----
  const RUTA_TOUR = new THREE.CatmullRomCurve3([
    NAVE_BASE.clone(), new THREE.Vector3(0, 16, 40), new THREE.Vector3(0, 26, 108), new THREE.Vector3(48, 22, 58),
    new THREE.Vector3(108, 22, 10), new THREE.Vector3(56, 24, -52), new THREE.Vector3(8, 24, -114), new THREE.Vector3(-52, 24, -56),
    new THREE.Vector3(-110, 22, 0), new THREE.Vector3(-56, 24, 54), new THREE.Vector3(-10, 45, 62), new THREE.Vector3(0, 95, -60), HOYO.clone().add(new THREE.Vector3(0, -10, 110)),
  ]);
  const RUTA_REGRESO = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 160, 300), new THREE.Vector3(30, 70, 130), new THREE.Vector3(10, 22, 40), NAVE_BASE.clone()]);
  const T_IDA = 58, T_TUNEL = 18, T_REGRESO = 14;
  const GUION = [
    [0, "¡Bienvenido a bordo! Soy Nova, tu guía. Despegamos de la plaza central de Weedland Station."],
    [5, "Allá abajo está Mi cultivo: ahí siembras las semillas registradas de las marcas y abres tu propia tienda."],
    [14, "Este es el pabellón de Cultivo: iluminación, riego, sustratos y todo para que tus plantas crezcan."],
    [19, "A la derecha, la isla de LumenGrow: una marca con su isla completa, con pantallas gigantes."],
    [24, "El pabellón de Genética: bancos de semillas de varios países."],
    [29, "Al fondo, el Mercado. Ahí compras aditamentos y transformas tu cosecha en cuerdas, telas, aceites y más."],
    [34, "El pabellón de Accesorios: vidrio, papeles, básculas y diseño."],
    [39, "Y la isla de Vapor Norte, otra marca que tiene su propio mundo."],
    [44, "Por último, el pabellón de Cáñamo y bienestar: ropa, cosmética y alimentos."],
    [50, "Ahora sujétate fuerte… vamos directo al agujero negro."],
    [T_IDA + 2, "Atravesamos el túnel… luz, color y estrellas."],
    [T_IDA + T_TUNEL + 1, "¡Regresamos a la base! Gracias por volar con Weedland."],
  ];
  let tour = null;
  // escena del túnel
  const tunel = new THREE.Scene();
  const camTunel = new THREE.PerspectiveCamera(75, 1, 0.1, 1200);
  const matTunel = new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { t: { value: 0 } },
    vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `uniform float t; varying vec2 vU;
      vec3 pal(float x){ return 0.5 + 0.5*cos(6.2831*(x + vec3(0.0,0.33,0.67))); }
      void main(){
        float a = vU.x*6.2831, y = vU.y*60.0;
        float giro = sin(a*3.0 + y*0.35 - t*2.2);
        float banda = 0.5 + 0.5*sin(y*1.4 - t*6.0 + giro*1.6);
        vec3 c = pal(vU.y*1.5 + t*0.06 + giro*0.08) * (0.35 + 0.65*banda);
        c += vec3(1.0,0.9,1.0) * pow(max(0.0, sin(a*8.0 + y*0.6 - t*3.0)), 18.0) * 0.6;
        float fondo = smoothstep(0.0, 0.25, vU.y);
        gl_FragColor = vec4(c*fondo, 1.0);
      }`,
  });
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 900, 48, 1, true), matTunel);
  tubo.rotation.x = Math.PI / 2; tubo.position.z = -440; tunel.add(tubo);
  const estrellasT = (() => {
    const n = 500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = 1 + Math.random() * 7; pos.set([Math.cos(a) * r, Math.sin(a) * r, -Math.random() * 400], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pt = texCanvas(64, 64); { const r = pt.g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)"); pt.g.fillStyle = r; pt.g.fillRect(0, 0, 64, 64); }
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.25, map: pt.t, color: "#ffffff", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
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
    mirarHacia(new THREE.Vector3(NAVE_BASE.x, 0, NAVE_BASE.z - 6));
    cb && cb.alFin && cb.alFin();
  }
  const tg1 = new THREE.Vector3(), tg2 = new THREE.Vector3();
  function actualizarTour(ahora, dt) {
    const s = (ahora - tour.t0) / 1000;
    // narración
    for (let i = tour.dicho + 1; i < GUION.length && GUION[i][0] <= s; i++) { tour.dicho = i; tour.cb.alTexto && tour.cb.alTexto(GUION[i][1]); }
    if (s < T_IDA) {
      const u = Math.min(1, s / T_IDA);
      RUTA_TOUR.getPoint(u, tg1); RUTA_TOUR.getPoint(Math.min(1, u + 0.004), tg2);
      nave.position.copy(tg1); nave.lookAt(tg2);
      const dir = tg2.clone().sub(tg1).normalize();
      const deseo = tg1.clone().addScaledVector(dir, -12).add(new THREE.Vector3(0, 4.5, 0));
      camera.position.lerp(deseo, Math.min(1, dt * 3)); controls.target.lerp(tg1.clone().addScaledVector(dir, 6), Math.min(1, dt * 4));
      camera.lookAt(controls.target);
      return scene;
    }
    if (s < T_IDA + T_TUNEL) {
      if (tour.fase !== "tunel") { tour.fase = "tunel"; tour.cb.alFase && tour.cb.alFase("tunel"); }
      const k = s - T_IDA;
      matTunel.uniforms.t.value = k;
      camTunel.position.set(Math.sin(k * 0.7) * 1.5, Math.cos(k * 0.5) * 1.2, 0);
      camTunel.rotation.set(0, 0, k * 0.25);
      const pos = estrellasT.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { let z = pos.getZ(i) + dt * 120; if (z > 5) z -= 400; pos.setZ(i, z); }
      pos.needsUpdate = true;
      return tunel;
    }
    if (s < T_IDA + T_TUNEL + T_REGRESO) {
      if (tour.fase !== "regreso") { tour.fase = "regreso"; tour.cb.alFase && tour.cb.alFase("regreso"); camera.position.set(0, 175, 330); }
      const u = Math.min(1, (s - T_IDA - T_TUNEL) / T_REGRESO), e = 1 - Math.pow(1 - u, 2);
      RUTA_REGRESO.getPoint(e, tg1); RUTA_REGRESO.getPoint(Math.min(1, e + 0.01), tg2);
      nave.position.copy(tg1); if (u < 0.97) nave.lookAt(tg2);
      const dir = tg2.clone().sub(tg1); if (dir.lengthSq() > 1e-6) dir.normalize(); else dir.set(0, 0, -1);
      camera.position.lerp(tg1.clone().addScaledVector(dir, -13).add(new THREE.Vector3(0, 5, 0)), Math.min(1, dt * 3));
      controls.target.lerp(tg1, Math.min(1, dt * 4)); camera.lookAt(controls.target);
      return scene;
    }
    terminarTour();
    return scene;
  }

  // ----- drones con publicidad -----
  const drones = [];
  function crearDron(m, i, total) {
    const g = new THREE.Group(); g.userData = { tipo: "dron", id: m.id };
    scene.add(g); tocables.push(g);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.2), oscuro));
    const luz = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), neon(m.color)); luz.position.y = -0.2; g.add(luz);
    const helices = [];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
      const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), gris); brazo.position.set(x * 0.55, 0, z * 0.55); brazo.rotation.y = Math.atan2(z, x) * -1; g.add(brazo);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 16), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35 }));
      h.position.set(x * 0.85, 0.15, z * 0.85); g.add(h); helices.push(h);
    });
    const bt = texCanvas(640, 240, 0.75);
    dibujarBanner(bt.g, 640, 240, m); bt.t.needsUpdate = true;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.95), new THREE.MeshBasicMaterial({ map: bt.t, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    banner.position.y = -2.1; g.add(banner);
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.4, -0.2, 0), new THREE.Vector3(-2.4, -1.15, 0), new THREE.Vector3(0.4, -0.2, 0), new THREE.Vector3(2.4, -1.15, 0)]), new THREE.LineBasicMaterial({ color: "#c9cde0" })));
    const R = 22 + (i % 4) * 18, h = 13 + (i % 3) * 4, w = (0.04 + (i % 2) * 0.02) * (i % 2 ? 1 : -1), fase = (i / total) * Math.PI * 2;
    drones.push({ m, g, bt });
    anim.push((t) => {
      const a = fase + t * (quieto ? 0.004 : w);
      g.position.set(Math.cos(a) * R, h + Math.sin(t * 0.8 + fase) * 1.2, Math.sin(a) * R);
      g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z);
      if (!quieto) helices.forEach((hh) => (hh.rotation.y += 0.6));
      banner.rotation.z = Math.sin(t * 1.3 + fase) * 0.04;
    });
  }

  // ----- construir según las marcas -----
  let lista = cfg.marcas;
  PABELLONES.forEach((p) => {
    const mod = modulo(p.id, p.angulo, D_PAB, R_PAB, p.color);
    // Emblema en el piso del centro (se puede caminar encima: ya no hay escultura)
    const em = texCanvas(512, 512, 0.5);
    em.g.fillStyle = p.color + "33"; em.g.beginPath(); em.g.arc(256, 256, 250, 0, Math.PI * 2); em.g.fill();
    em.g.strokeStyle = p.color; em.g.lineWidth = 10; em.g.beginPath(); em.g.arc(256, 256, 236, 0, Math.PI * 2); em.g.stroke();
    em.g.textAlign = "center"; em.g.textBaseline = "middle"; em.g.font = "200px serif"; em.g.fillText(p.icono, 256, 220);
    em.g.fillStyle = "#ffffff"; ajustar(em.g, p.nombre.toUpperCase(), 400, 56); em.g.fillText(p.nombre.toUpperCase(), 256, 390);
    const emb = new THREE.Mesh(new THREE.CircleGeometry(5, 48), new THREE.MeshBasicMaterial({ map: em.t, transparent: true, depthWrite: false }));
    emb.rotation.x = -Math.PI / 2; emb.position.set(mod.centro.x, 0.62, mod.centro.z);
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
  const traje = new THREE.MeshStandardMaterial({ color: "#f4f1ff", roughness: 0.35, metalness: 0.1 });
  const acento = new THREE.MeshStandardMaterial({ color: "#b18cff", roughness: 0.4, emissive: "#3a1670", emissiveIntensity: 0.4 });
  const piernas = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * 0.2, 0.62, 0); yo.add(p);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.38, 4, 10), acento); m.position.y = -0.3; p.add(m);
    return p;
  });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.45, 6, 16), traje); torso.position.y = 1.15; yo.add(torso);
  const cinto = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.05, 8, 24), neon("#ff7ad9")); cinto.rotation.x = Math.PI / 2; cinto.position.y = 0.95; yo.add(cinto);
  const mochila = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.25), acento); mochila.position.set(0, 1.2, -0.38); yo.add(mochila);
  const brazosYo = [-1, 1].map((s) => {
    const b = new THREE.Group(); b.position.set(s * 0.45, 1.42, 0); yo.add(b);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.36, 4, 8), traje); m.position.y = -0.28; b.add(m);
    return b;
  });
  const casco = new THREE.Group(); casco.position.y = 1.95; yo.add(casco);
  casco.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), traje));
  const visorYo = new THREE.Mesh(new THREE.SphereGeometry(0.37, 24, 12, -1, 2, 1.05, 1), new THREE.MeshStandardMaterial({ color: "#2a1660", roughness: 0.1, metalness: 0.6, emissive: "#6ff0ff", emissiveIntensity: 0.35 }));
  visorYo.position.z = 0.08; casco.add(visorYo);
  const antenaYo = spriteEmoji("🌿", 0.55); antenaYo.position.y = 0.62; casco.add(antenaYo);
  const sombraYo = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.22, depthWrite: false }));
  sombraYo.rotation.x = -Math.PI / 2; sombraYo.position.y = 0.02; yo.add(sombraYo);
  const aro = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 32), new THREE.MeshBasicMaterial({ color: "#6ff0ff", transparent: true, opacity: 0.9, depthWrite: false }));
  aro.rotation.x = -Math.PI / 2; aro.visible = false; scene.add(aro);

  const RADIO = 0.45, VEL = 8;
  const INICIO = new THREE.Vector3(0, 0, 12);
  yo.position.copy(INICIO); yo.rotation.y = Math.PI;
  const altura = (x, z) => (Math.hypot(x, z) < R_PLAZA + 0.2 ? 0.7 : 0.6);
  yo.position.y = altura(yo.position.x, yo.position.z);

  // ¿Se puede pisar este punto?
  const local = new THREE.Vector3();
  function libre(x, z) {
    let piso = Math.hypot(x, z) < R_PLAZA - RADIO;
    if (!piso) for (const id in modulos) {
      const mo = modulos[id];
      if (Math.hypot(x - mo.centro.x, z - mo.centro.z) < mo.r - RADIO) { piso = true; break; }
      // puente: a lo largo del eje del módulo
      const ax = -mo.haciaPlaza.x, az = -mo.haciaPlaza.z, largo = x * ax + z * az, lado = Math.abs(-x * az + z * ax);
      if (lado < 1.4 && largo > R_PLAZA - 2 && largo < mo.d - mo.r + 2) { piso = true; break; }
    }
    if (!piso) return false;
    for (const o of obst) {
      if (o.c) { if (Math.hypot(x - o.c[0], z - o.c[1]) < o.c[2] + RADIO) return false; }
      else {
        local.set(x, o.caja.position.y, z); o.caja.worldToLocal(local);
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
    const c = z === "plaza" ? { x: 0, z: 0, r: 6.5 } : { x: modulos[z].centro.x, z: modulos[z].centro.z, r: modulos[z].r * 0.45 };
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

  let ruta = [], alLlegar = null, atorado = 0, rapido = false;
  function caminarA(destino, cb) {
    const d = destino.clone(); d.y = 0;
    ruta = trazar(yo.position.clone(), d); alLlegar = cb || null; atorado = 0;
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
  const chispa = spriteBrillo("#6ff0ff", 4); chispa.material.opacity = 0; scene.add(chispa);
  let chispaT = 1;
  function destello() { chispaT = 0; }

  // Entrada: teclado y joystick
  const teclas = {};
  addEventListener("keydown", (e) => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; teclas[e.key.toLowerCase()] = true; });
  addEventListener("keyup", (e) => { teclas[e.key.toLowerCase()] = false; });
  addEventListener("blur", () => { for (const k in teclas) teclas[k] = false; });
  const stick = { x: 0, y: 0 };

  // ---------- cámara ----------
  let listo = false, enfoque = null, enfocado = false, vuelo = null, desp = { x: 0, y: 0 }, despObj = { x: 0, y: 0 };
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
    enfoque = s.m.pab; enfocado = true;
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
  let paso = 0, cercaId = null, pasoSon = 0;
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
      if (ruta.length) { ruta = []; alLlegar = null; aro.visible = false; }
      if (enfocado) { cfg.alSoltar && cfg.alSoltar(); }
      camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      der.crossVectors(fwd, camera.up).normalize();
      mover.addScaledVector(fwd, iy / Math.max(1, Math.hypot(ix, iy))).addScaledVector(der, ix / Math.max(1, Math.hypot(ix, iy)));
      mover.multiplyScalar(mag);
    } else if (ruta.length) {
      const q = ruta[0], dx = q.x - yo.position.x, dz = q.z - yo.position.z, d = Math.hypot(dx, dz);
      if (d < 0.35) {
        ruta.shift();
        if (!ruta.length) { aro.visible = false; const cb = alLlegar; alLlegar = null; cb && cb(); }
      } else mover.set(dx / d, 0, dz / d);
      vel = rapido ? 16 : 10;
    }
    if (mover.lengthSq() > 0) {
      const sx = mover.x * vel * dt, sz = mover.z * vel * dt, x = yo.position.x, z = yo.position.z;
      if (libre(x + sx, z + sz)) yo.position.x += sx, yo.position.z += sz;
      else if (libre(x + sx, z)) yo.position.x += sx;
      else if (libre(x, z + sz)) yo.position.z += sz;
      const objetivo = Math.atan2(mover.x, mover.z);
      let dA = objetivo - yo.rotation.y; while (dA > Math.PI) dA -= Math.PI * 2; while (dA < -Math.PI) dA += Math.PI * 2;
      yo.rotation.y += dA * Math.min(1, dt * 12);
      // si sigue una ruta y no avanza, salta al siguiente punto
      const avance = Math.hypot(yo.position.x - x, yo.position.z - z);
      if (ruta.length && avance < vel * dt * 0.2) { atorado += dt; if (atorado > 0.5) { const q = ruta[0]; yo.position.x = q.x; yo.position.z = q.z; atorado = 0; } } else atorado = 0;
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
    torso.position.y = 1.15 + Math.abs(Math.sin(paso)) * (andando ? 0.06 : 0);
    casco.position.y = 1.95 + Math.abs(Math.sin(paso)) * (andando ? 0.06 : 0) + (andando ? 0 : Math.sin(performance.now() / 600) * 0.02);
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
        relojStand = 0;
        Object.values(stands).forEach((s, i) => {
          s.cerca = Math.hypot(yo.position.x - s.pos.x, yo.position.z - s.pos.z) < 42;
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
        const cercanos = Object.values(stands).filter((s) => s.cerca).map((s) => s.grupo);
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
  if (document.fonts) document.fonts.ready.then(() => { Object.values(stands).forEach((s) => pintarStand(s)); drones.forEach((d) => { dibujarBanner(d.bt.g, 640, 240, d.m); d.bt.t.needsUpdate = true; }); rotarPantallas(); });

  // Al cargar: vista general y luego la cámara baja hasta el avatar
  controls.autoRotate = false;
  setTimeout(() => seguir(quieto ? 0 : 2200), 900);

  return {
    irA, enfocarStand, seguir, setParcelas, setTienda, venta, iniciarTour,
    enTour: () => !!tour,
    saltarTour: () => terminarTour(),
    setStick(x, y) { stick.x = x; stick.y = y; },
    setDesplazamiento(x, y) { despObj.x = x; despObj.y = y; },
    setEtiquetas(s) { ver = s; },
    nombreDe: (id) => (stands[id] ? stands[id].m.nombre : id),
    actualizarMarcas(nuevas) {
      lista = nuevas;
      nuevas.forEach((m) => {
        const s = stands[m.id];
        if (s) { s.m = m; s.productos = catalogo(m); pintarStand(s); }
        drones.filter((d) => d.m.id === m.id).forEach((d) => { d.m = m; d.bt.g.clearRect(0, 0, 640, 240); dibujarBanner(d.bt.g, 640, 240, m); d.bt.t.needsUpdate = true; });
      });
      rotarPantallas();
    },
  };
}
