// Weedland Station: escena 3D (three.js). Estación flotando en el espacio con plaza central,
// pabellones de marcas, Universidad, pantallas gigantes y drones que cargan publicidad.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PABELLONES, UNIVERSIDAD, catalogo } from "./datos.js";

const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
const D_MODULO = 38, R_PLAZA = 15, R_PAB = 13.5, D_STAND = 8.6;
const FUENTE = "'Fredoka', 'Nunito', system-ui, sans-serif";
const rad = (g) => (g * Math.PI) / 180;

// ---------- utilidades de canvas ----------
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function texCanvas(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { c, g: c.getContext("2d"), t };
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
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.6 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 2000);
  const VISTA_GENERAL = { pos: new THREE.Vector3(0, 52, 78), obj: new THREE.Vector3(0, 0, -4) };
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
  controls.minDistance = 7; controls.maxDistance = 200; controls.maxPolarAngle = 1.42;
  controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.9; controls.panSpeed = 0.8;
  controls.autoRotate = !quieto; controls.autoRotateSpeed = 0.35;

  // Cielo con degradado
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { arriba: { value: new THREE.Color("#120830") }, medio: { value: new THREE.Color("#3a1670") }, abajo: { value: new THREE.Color("#050314") } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: "uniform vec3 arriba, medio, abajo; varying vec3 vP; void main(){ float y=vP.y; vec3 c = y>0. ? mix(medio, arriba, smoothstep(0.,.6,y)) : mix(medio, abajo, smoothstep(0.,.5,-y)); gl_FragColor=vec4(c,1.); }",
  })));
  // Estrellas
  {
    const n = 2200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 500 + Math.random() * 300, s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * s * r, u * r, Math.sin(a) * s * r], i * 3);
      const c = new THREE.Color().setHSL(0.6 + Math.random() * 0.3, 0.6, 0.75 + Math.random() * 0.25);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, depthWrite: false })));
  }
  // Nebulosas
  [["#7a3cff", -300, 60, -500, 520], ["#ff3cb4", 380, -40, -420, 420], ["#2ec8ff", 120, 160, -600, 480], ["#5a2cff", -420, -120, 200, 500]].forEach(([c, x, y, z, s]) => {
    const n = spriteBrillo(c, s); n.material.opacity = 0.32; n.position.set(x, y, z); scene.add(n);
  });
  // Planeta con anillo
  {
    const { g, t } = texCanvas(512, 256);
    const f = g.createLinearGradient(0, 0, 0, 256);
    ["#2a1a6e", "#3fa7c9", "#7b4cd8", "#2fd0c0", "#5a2a9c", "#c06ad8", "#2a1a6e"].forEach((c, i, a) => f.addColorStop(i / (a.length - 1), c));
    g.fillStyle = f; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; g.fillRect(0, Math.random() * 256, 512, 2 + Math.random() * 8); }
    const planeta = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, emissive: "#1a0a40", emissiveIntensity: 0.6 }));
    planeta.position.set(-150, -45, -300); planeta.rotation.z = 0.35; scene.add(planeta);
    const ani = texCanvas(512, 8);
    for (let x = 0; x < 512; x++) { ani.g.fillStyle = `rgba(200,170,255,${0.15 + 0.5 * Math.abs(Math.sin(x * 0.09) * Math.sin(x * 0.023))})`; ani.g.fillRect(x, 0, 1, 8); }
    const geoA = new THREE.RingGeometry(105, 165, 96);
    const uv = geoA.attributes.uv, p = geoA.attributes.position;
    for (let i = 0; i < uv.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (r - 105) / 60, 0.5); }
    const anillo = new THREE.Mesh(geoA, new THREE.MeshBasicMaterial({ map: ani.t, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    anillo.position.copy(planeta.position); anillo.rotation.set(rad(72), rad(10), rad(20)); scene.add(anillo);
    const halo = spriteBrillo("#7f6bff", 260); halo.material.opacity = 0.35; halo.position.copy(planeta.position); scene.add(halo);
  }

  scene.add(new THREE.HemisphereLight("#d8e2ff", "#3a2266", 1.25));
  const sol = new THREE.DirectionalLight("#ffffff", 1.6); sol.position.set(40, 80, 50); scene.add(sol);
  const contraluz = new THREE.DirectionalLight("#b48cff", 0.8); contraluz.position.set(-60, 20, -60); scene.add(contraluz);

  const blanco = new THREE.MeshStandardMaterial({ color: "#eef0fb", roughness: 0.38, metalness: 0.12 });
  const gris = new THREE.MeshStandardMaterial({ color: "#c9cde0", roughness: 0.5, metalness: 0.2 });
  const oscuro = new THREE.MeshStandardMaterial({ color: "#1c1830", roughness: 0.4, metalness: 0.5 });
  const neon = (c) => new THREE.MeshBasicMaterial({ color: c });

  const tocables = [];
  const etiquetas = []; // { el, pos }
  const anim = []; // funciones (t, dt)
  const pantallas = []; // texturas que rotan

  // Plataforma flotante (disco con base en cono y aro de neón)
  function plataforma(radio, color, alto = 1.2) {
    const g = new THREE.Group();
    const piso = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, alto, 64), blanco); g.add(piso);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(radio * 0.92, radio * 0.35, radio * 0.45, 48), gris);
    base.position.y = -alto / 2 - radio * 0.225; g.add(base);
    const punta = new THREE.Mesh(new THREE.ConeGeometry(radio * 0.35, radio * 0.35, 32), gris);
    punta.rotation.x = Math.PI; punta.position.y = base.position.y - radio * 0.225 - radio * 0.175; g.add(punta);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(radio + 0.05, 0.12, 8, 96), neon(color));
    aro.rotation.x = Math.PI / 2; aro.position.y = alto / 2; g.add(aro);
    const aro2 = aro.clone(); aro2.position.y = -alto / 2; aro2.scale.setScalar(0.995); g.add(aro2);
    const inner = new THREE.Mesh(new THREE.RingGeometry(radio * 0.55, radio * 0.57, 64), neon(color));
    inner.rotation.x = -Math.PI / 2; inner.position.y = alto / 2 + 0.01; g.add(inner);
    const luz = spriteBrillo(color, radio * 0.9); luz.position.y = base.position.y - radio * 0.3; luz.material.opacity = 0.5; g.add(luz);
    return g;
  }
  // Puente entre la plaza y un módulo
  function puente(angulo, color) {
    const largo = D_MODULO - R_PLAZA - R_PAB + 1.2;
    const g = new THREE.Group();
    const piso = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.5, 3.6), blanco); g.add(piso);
    [-1.9, 1.9].forEach((z) => {
      const baranda = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.08, 0.08), neon(color)); baranda.position.set(0, 0.9, z); g.add(baranda);
      const vidrio = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.9, 0.05), new THREE.MeshStandardMaterial({ color: "#bfe8ff", transparent: true, opacity: 0.18 }));
      vidrio.position.set(0, 0.45, z); g.add(vidrio);
    });
    const tira = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.02, 0.25), neon(color)); tira.position.y = 0.26; g.add(tira);
    const d = R_PLAZA + largo / 2 - 0.6;
    g.position.set(Math.cos(rad(angulo)) * d, 0.2, -Math.sin(rad(angulo)) * d);
    g.rotation.y = rad(angulo);
    return g;
  }

  // ----- plaza central -----
  const plaza = plataforma(R_PLAZA, "#b18cff", 1.4);
  scene.add(plaza);
  {
    const torre = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.6, 9, 24), blanco); torre.position.y = 5.2; scene.add(torre);
    const anillos = [3, 5.5, 8].map((y) => { const a = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.1, 8, 32), neon("#ff7ad9")); a.rotation.x = Math.PI / 2; a.position.y = y; scene.add(a); return a; });
    anim.push((t) => anillos.forEach((a, i) => { a.position.y = 2 + ((t * 1.2 + i * 2.6) % 7.8); }));
    // Pantalla de 4 caras
    const caja = new THREE.Group(); caja.position.y = 13; scene.add(caja);
    const W = 8.4, H = 4.7;
    for (let i = 0; i < 4; i++) {
      const tx = texCanvas(1024, 576);
      const cara = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tx.t, toneMapped: false }));
      const a = (i * Math.PI) / 2;
      cara.position.set(Math.sin(a) * (W / 2 + 0.06), 0, Math.cos(a) * (W / 2 + 0.06)); cara.rotation.y = a;
      cara.userData = { tipo: "pantalla", cara: i };
      caja.add(cara); tocables.push(cara);
      pantallas.push({ tx, cara, i });
    }
    const marco = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, H + 0.3, W + 0.1), oscuro); caja.add(marco);
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
    // Torres turbina (como en Expoweed 2020)
    [[-9, -6], [9, -6]].forEach(([x, z], k) => {
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
    // Bancas y plantas en la plaza
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3, r = 11;
      if (Math.abs(Math.sin(a)) > 0.95) continue;
      const maceta = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.8, 16), blanco);
      maceta.position.set(Math.cos(a) * r, 1.1, Math.sin(a) * r); scene.add(maceta);
      const planta = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), new THREE.MeshStandardMaterial({ color: "#3fbf6a", roughness: 0.8, flatShading: true }));
      planta.position.set(maceta.position.x, 2, maceta.position.z); planta.scale.y = 1.4; scene.add(planta);
    }
  }

  // Partículas que flotan alrededor
  {
    const n = 380, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 60; pos.set([Math.cos(a) * r, -10 + Math.random() * 35, Math.sin(a) * r], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.35, color: "#d8c4ff", transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(pts);
    anim.push((t, dt) => { if (!quieto) pts.rotation.y += dt * 0.02; });
  }

  // ----- módulos -----
  const modulos = {}; // id -> { centro, haciaPlaza }
  function modulo(info) {
    const a = rad(info.angulo);
    const centro = new THREE.Vector3(Math.cos(a) * D_MODULO, 0, -Math.sin(a) * D_MODULO);
    const p = plataforma(R_PAB, info.color, 1.2); p.position.copy(centro); scene.add(p);
    scene.add(puente(info.angulo, info.color));
    const haciaPlaza = centro.clone().negate().normalize();
    modulos[info.id] = { centro, haciaPlaza, info };
    return modulos[info.id];
  }

  // Stand de marca
  const stands = {}; // marcaId -> { grupo, pos, frente, tex... }
  function crearStand(m, mod, k) {
    const afuera = mod.haciaPlaza.clone().negate();
    const base = Math.atan2(-afuera.z, afuera.x);
    const ang = base + rad((k - 1) * 62);
    const pos = new THREE.Vector3(mod.centro.x + Math.cos(ang) * D_STAND, 0.6, mod.centro.z - Math.sin(ang) * D_STAND);
    const g = new THREE.Group(); g.position.copy(pos);
    g.lookAt(mod.centro.x, 0.6, mod.centro.z); // el frente (+z) mira al centro del pabellón
    g.userData = { tipo: "stand", id: m.id };
    scene.add(g); tocables.push(g);

    const color = new THREE.Color(m.color);
    const piso = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 5.4), blanco); piso.position.y = 0.15; g.add(piso);
    const filo = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.08, 5.45), neon(m.color)); filo.position.y = 0.3; g.add(filo);
    const muro = new THREE.Mesh(new THREE.BoxGeometry(7, 4.6, 0.35), blanco); muro.position.set(0, 2.6, -2.5); g.add(muro);
    const alas = [-1, 1].map((s) => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.6, 1.8), blanco); w.position.set(s * 3.35, 2.6, -1.7); w.rotation.y = s * 0.35; g.add(w); return w; });
    // Pantalla principal
    const pt = texCanvas(1024, 576);
    const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.15), new THREE.MeshBasicMaterial({ map: pt.t, toneMapped: false }));
    pantalla.position.set(0, 2.75, -2.31); g.add(pantalla);
    // Letrero
    const lt = texCanvas(1024, 200);
    const letrero = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.05, 0.35), [oscuro, oscuro, oscuro, oscuro, new THREE.MeshBasicMaterial({ map: lt.t, toneMapped: false }), oscuro]);
    letrero.position.set(0, 5.45, -2.3); g.add(letrero);
    // Tótems laterales
    const totems = [-1, 1].map((s) => {
      const tt = texCanvas(256, 512);
      const tot = new THREE.Group(); tot.position.set(s * 2.9, 0, 1.1); tot.rotation.y = -s * 0.4; g.add(tot);
      const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.7, 0.25), oscuro); cuerpo.position.y = 1.65; tot.add(cuerpo);
      const cara = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), new THREE.MeshBasicMaterial({ map: tt.t, toneMapped: false })); cara.position.set(0, 1.65, 0.13); tot.add(cara);
      const luz = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.06, 0.3), neon(m.color)); luz.position.y = 3.05; tot.add(luz);
      return tt;
    });
    // Mostrador con logo
    const mt = texCanvas(512, 256);
    const most = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 0.9), [blanco, blanco, blanco, blanco, new THREE.MeshBasicMaterial({ map: mt.t, toneMapped: false }), blanco]);
    most.position.set(0.6, 0.82, 0.5); g.add(most);
    // Holograma sobre el mostrador
    const holo = new THREE.Group(); holo.position.set(0.6, 2.55, 0.5); g.add(holo);
    const malla = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.8 })); holo.add(malla);
    const emo = spriteEmoji(m.icono, 1.1); holo.add(emo);
    const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.55, 1.1, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    haz.position.y = -0.85; holo.add(haz);
    // Robot anfitrión
    const robot = new THREE.Group(); robot.position.set(-1.9, 0.3, 1.2); g.add(robot);
    const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 6, 16), blanco); cuerpo.position.y = 1.0; robot.add(cuerpo);
    const panza = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), neon(m.color)); panza.position.set(0, 1.05, 0.43); robot.add(panza);
    const cabeza = new THREE.Group(); cabeza.position.y = 1.95; robot.add(cabeza);
    cabeza.add(new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 16), blanco));
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 12, -0.9, 1.8, 1.1, 0.9), oscuro); visor.position.z = 0.1; cabeza.add(visor);
    const ojos = [-0.13, 0.13].map((x) => { const o = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), neon("#7ff6ff")); o.position.set(x, 0.02, 0.495); cabeza.add(o); return o; });
    const antena = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), neon(m.color)); antena.position.y = 0.6; cabeza.add(antena);
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2), gris); palo.position.y = 0.48; cabeza.add(palo);
    const brazos = [-1, 1].map((s) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.4, 4, 8), blanco); b.position.set(s * 0.55, 1.1, 0); b.rotation.z = s * 0.3; robot.add(b); return b; });
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.18 }));
    sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.02; robot.add(sombra);
    // Macetas decorativas
    [-2.9, 2.9].forEach((x) => {
      const mac = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.5, 12), blanco); mac.position.set(x, 0.55, -1.0); g.add(mac);
      const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), new THREE.MeshStandardMaterial({ color: "#46c46f", flatShading: true })); pl.position.set(x, 1.1, -1.0); pl.scale.y = 1.5; g.add(pl);
    });

    const fase = k * 1.7 + Math.random();
    let saludando = 0;
    anim.push((t, dt) => {
      if (quieto) return;
      holo.rotation.y += dt * 0.9; malla.rotation.x += dt * 0.4;
      holo.position.y = 2.55 + Math.sin(t * 1.6 + fase) * 0.12;
      robot.position.y = 0.3 + Math.sin(t * 2 + fase) * 0.08;
      cabeza.rotation.y = Math.sin(t * 0.7 + fase) * 0.5;
      ojos.forEach((o) => (o.scale.y = (t + fase) % 4 < 0.12 ? 0.15 : 1));
      if (saludando > 0) { saludando -= dt; brazos[1].rotation.z = -2.2 + Math.sin(t * 14) * 0.4; } else brazos[1].rotation.z = 0.3;
    });

    const s = { m, grupo: g, pos, frente: g.getWorldDirection(new THREE.Vector3()), pt, lt, mt, totems, slide: k % 3, totemI: k * 3, productos: catalogo(m), saludar: () => (saludando = 2.4) };
    stands[m.id] = s;
    pintarStand(s);
    return s;
  }
  function pintarStand(s, cambiarSlide = false) {
    if (cambiarSlide) s.slide = (s.slide + 1) % 3;
    dibujarPantalla(s.pt.g, 1024, 576, s.m, s.slide, s.productos); s.pt.t.needsUpdate = true;
    s.lt.g.clearRect(0, 0, 1024, 200); dibujarLetrero(s.lt.g, 1024, 200, s.m); s.lt.t.needsUpdate = true;
    dibujarMostrador(s.mt.g, 512, 256, s.m); s.mt.t.needsUpdate = true;
    pintarTotems(s);
  }
  function pintarTotems(s) {
    const lista = s.productos.length ? s.productos : [{ icono: s.m.icono, nombre: s.m.nombre, precio: "", cat: "" }];
    s.totems.forEach((tt, i) => { dibujarTotem(tt.g, 256, 512, s.m, lista[(s.totemI + i * 5) % lista.length]); tt.t.needsUpdate = true; });
  }

  // Universidad
  function crearUniversidad(mod) {
    const g = new THREE.Group(); g.position.copy(mod.centro); g.position.y = 0.6;
    g.lookAt(0, 0.6, 0); g.userData = { tipo: "uni", id: "universidad" };
    scene.add(g); tocables.push(g);
    const domo = new THREE.Mesh(new THREE.SphereGeometry(6.5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#e9e4ff", roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.55 }));
    domo.position.z = -2; g.add(domo);
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.15, 8, 96), neon("#b18cff")); anillo.rotation.x = Math.PI / 2; anillo.position.set(0, 0.1, -2); g.add(anillo);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.5, 12), blanco);
      c.position.set(Math.cos(a) * 6.2, 2.25, -2 + Math.sin(a) * 6.2); g.add(c);
    }
    const tx = texCanvas(1024, 400);
    const f = tx.g.createLinearGradient(0, 0, 1024, 400); f.addColorStop(0, "#3a1670"); f.addColorStop(1, "#0b0620");
    tx.g.fillStyle = f; tx.g.fillRect(0, 0, 1024, 400);
    tx.g.textAlign = "center"; tx.g.textBaseline = "middle"; tx.g.fillStyle = "#fff"; tx.g.font = `700 110px ${FUENTE}`; tx.g.fillText("🎓 UNIVERSIDAD", 512, 150);
    tx.g.fillStyle = "#c9b4ff"; tx.g.font = `600 48px ${FUENTE}`; tx.g.fillText("Clases · Talleres · Conferencias", 512, 270);
    tx.g.strokeStyle = "#b18cff"; tx.g.lineWidth = 12; tx.g.strokeRect(6, 6, 1012, 388);
    const pan = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.1), new THREE.MeshBasicMaterial({ map: tx.t, toneMapped: false }));
    pan.position.set(0, 2.4, 4.6); g.add(pan);
    const soporte = new THREE.Mesh(new THREE.BoxGeometry(8.3, 3.4, 0.3), oscuro); soporte.position.set(0, 2.4, 4.42); g.add(soporte);
    const birrete = spriteEmoji("🎓", 4.5); birrete.position.set(0, 5.5, -2); g.add(birrete);
    const libro = spriteEmoji("📚", 2.2); libro.position.set(-3.2, 3.2, -1); g.add(libro);
    const micro = spriteEmoji("🎤", 2.2); micro.position.set(3.2, 3.2, -1); g.add(micro);
    anim.push((t) => { if (quieto) return; birrete.position.y = 5.5 + Math.sin(t * 1.3) * 0.35; libro.position.y = 3.2 + Math.sin(t * 1.7 + 1) * 0.25; micro.position.y = 3.2 + Math.sin(t * 1.5 + 2) * 0.25; });
  }

  // ----- drones con publicidad -----
  const drones = [];
  function crearDron(m, i, total) {
    const g = new THREE.Group(); g.userData = { tipo: "dron", id: m.id };
    scene.add(g); tocables.push(g);
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.2), oscuro); g.add(cuerpo);
    const luz = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), neon(m.color)); luz.position.y = -0.2; g.add(luz);
    const helices = [];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
      const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), gris); brazo.position.set(x * 0.55, 0, z * 0.55); brazo.rotation.y = Math.atan2(z, x) * -1; g.add(brazo);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 16), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35 }));
      h.position.set(x * 0.85, 0.15, z * 0.85); g.add(h); helices.push(h);
    });
    const bt = texCanvas(640, 240);
    dibujarBanner(bt.g, 640, 240, m); bt.t.needsUpdate = true;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.95), new THREE.MeshBasicMaterial({ map: bt.t, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    banner.position.y = -2.1; g.add(banner);
    const cables = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.4, -0.2, 0), new THREE.Vector3(-2.4, -1.15, 0), new THREE.Vector3(0.4, -0.2, 0), new THREE.Vector3(2.4, -1.15, 0)]), new THREE.LineBasicMaterial({ color: "#c9cde0" }));
    g.add(cables);
    const R = 24 + (i % 3) * 13, h = 12 + (i % 4) * 3, w = (0.05 + (i % 2) * 0.025) * (i % 2 ? 1 : -1), fase = (i / total) * Math.PI * 2;
    const d = { m, g, bt, R, h, w, fase };
    drones.push(d);
    anim.push((t) => {
      const a = fase + t * (quieto ? 0.005 : w);
      g.position.set(Math.cos(a) * R, h + Math.sin(t * 0.8 + fase) * 1.2, Math.sin(a) * R);
      g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z);
      if (!quieto) helices.forEach((hh) => (hh.rotation.y += 0.6));
      banner.rotation.z = Math.sin(t * 1.3 + fase) * 0.04;
    });
  }

  // ----- construir según las marcas -----
  let lista = cfg.marcas;
  PABELLONES.forEach((p) => {
    const mod = modulo(p);
    // Holograma del centro del pabellón (se esconde cuando la cámara está encima para no tapar el stand)
    const centroG = new THREE.Group(); scene.add(centroG);
    const holo = spriteEmoji(p.icono, 4); holo.position.set(mod.centro.x, 4.2, mod.centro.z); centroG.add(holo);
    const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 1.5, 24), blanco); columna.position.set(mod.centro.x, 1.35, mod.centro.z); centroG.add(columna);
    const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.2, 2.4, 24, 1, true), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
    haz.position.set(mod.centro.x, 3.2, mod.centro.z); centroG.add(haz);
    anim.push((t) => {
      if (!quieto) holo.position.y = 4.2 + Math.sin(t * 1.2 + p.angulo) * 0.3;
      centroG.visible = enfoque !== p.id && Math.hypot(camera.position.x - mod.centro.x, camera.position.z - mod.centro.z) > 7;
    });
    const piso = new THREE.Mesh(new THREE.CircleGeometry(3, 32), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.25 }));
    piso.rotation.x = -Math.PI / 2; piso.position.set(mod.centro.x, 0.62, mod.centro.z); piso.userData = { tipo: "pabellon", id: p.id }; scene.add(piso); tocables.push(piso);
    lista.filter((m) => m.pab === p.id).forEach((m, k) => crearStand(m, mod, k));
    etiquetas.push({ el: cfg.etiqueta({ id: p.id, icono: p.icono, nombre: p.nombre, color: p.color }), pos: new THREE.Vector3(mod.centro.x, 9, mod.centro.z) });
  });
  {
    const mod = modulo(UNIVERSIDAD);
    crearUniversidad(mod);
    etiquetas.push({ el: cfg.etiqueta({ id: "universidad", icono: "🎓", nombre: "Universidad", color: UNIVERSIDAD.color }), pos: new THREE.Vector3(mod.centro.x, 10, mod.centro.z) });
  }
  const conDron = lista.filter((_, i) => i % 2 === 0).slice(0, 6);
  conDron.forEach((m, i) => crearDron(m, i, conDron.length));

  // Pantallas grandes: cada cara muestra una marca distinta y rota cada 6 s
  let turno = 0;
  function rotarPantallas() {
    pantallas.forEach((p) => {
      const m = lista[(turno + p.i * 3) % lista.length];
      p.cara.userData.id = m.id;
      dibujarAnuncioGrande(p.tx.g, 1024, 576, m); p.tx.t.needsUpdate = true;
    });
    turno++;
  }
  rotarPantallas();
  let reloj = 0, relojStand = 0;

  // ---------- cámara ----------
  let enfoque = null, vuelo = null, desp = { x: 0, y: 0 }, despObj = { x: 0, y: 0 };
  function volar(pos, obj, ms = 1300) {
    controls.autoRotate = false;
    if (quieto) { camera.position.copy(pos); controls.target.copy(obj); return; }
    vuelo = { p0: camera.position.clone(), o0: controls.target.clone(), p1: pos, o1: obj, t0: performance.now(), ms };
  }
  function volarA(tipo, id) {
    enfoque = tipo === "stand" && stands[id] ? stands[id].m.pab : null;
    if (tipo === "stand" && stands[id]) {
      const s = stands[id], f = s.frente.clone();
      const vertical = canvas.clientWidth / canvas.clientHeight < 0.8; // en celular, más lejos para que quepa el stand arriba del panel
      volar(s.pos.clone().addScaledVector(f, vertical ? 21 : 11.5).add(new THREE.Vector3(0, vertical ? 5.5 : 3.6, 0)), s.pos.clone().add(new THREE.Vector3(0, 2.8, 0)));
      s.saludar();
      return true;
    }
    if (tipo === "pabellon" || tipo === "universidad") {
      const mod = modulos[id]; if (!mod) return false;
      volar(mod.centro.clone().addScaledVector(mod.haciaPlaza, 26).add(new THREE.Vector3(0, 19, 0)), mod.centro.clone().add(new THREE.Vector3(0, 1, 0)));
      return true;
    }
    volar(posGeneral(), VISTA_GENERAL.obj.clone());
    setTimeout(() => (controls.autoRotate = !quieto), 1400);
    return true;
  }

  // ---------- toques ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let inicio = null;
  canvas.addEventListener("pointerdown", (e) => { inicio = { x: e.clientX, y: e.clientY, t: performance.now() }; controls.autoRotate = false; vuelo = null; });
  canvas.addEventListener("pointerup", (e) => {
    if (!inicio) return;
    const mov = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
    const dur = performance.now() - inicio.t;
    inicio = null;
    if (mov > 8 || dur > 600) return;
    const hit = tocado(e.clientX, e.clientY);
    if (hit) cfg.alTocar(hit.tipo, hit.id);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || inicio) return;
    canvas.style.cursor = tocado(e.clientX, e.clientY) ? "pointer" : "grab";
  });
  function tocado(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(tocables, true);
    for (const h of hits) {
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
  }
  addEventListener("resize", medir);
  medir();

  const v = new THREE.Vector3();
  let previo = performance.now(), ver = true;
  function cuadro(ahora) {
    requestAnimationFrame(cuadro);
    const dt = Math.max(0, Math.min(0.05, (ahora - previo) / 1000)); previo = ahora;
    const t = ahora / 1000;
    try {
      if (vuelo) {
        const k = Math.min(1, (ahora - vuelo.t0) / vuelo.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        camera.position.lerpVectors(vuelo.p0, vuelo.p1, e);
        controls.target.lerpVectors(vuelo.o0, vuelo.o1, e);
        if (k >= 1) vuelo = null;
      }
      controls.update();
      // Desplazamiento de la imagen cuando hay un panel abierto (el stand queda visible)
      desp.x += (despObj.x - desp.x) * 0.12; desp.y += (despObj.y - desp.y) * 0.12;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (Math.abs(desp.x) + Math.abs(desp.y) > 0.5) camera.setViewOffset(w, h, desp.x, desp.y, w, h); else camera.clearViewOffset();
      anim.forEach((f) => f(t, dt));
      reloj += dt; relojStand += dt;
      if (reloj > 6) { reloj = 0; rotarPantallas(); }
      if (relojStand > 4.5) {
        relojStand = 0;
        Object.values(stands).forEach((s, i) => { s.totemI++; pintarTotems(s); if (i % 2 === (Math.floor(t / 4.5) % 2)) pintarStand(s, true); });
      }
      renderer.render(scene, camera);
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

  return {
    volarA,
    setDesplazamiento(x, y) { despObj.x = x; despObj.y = y; },
    setEtiquetas(s) { ver = s; },
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
