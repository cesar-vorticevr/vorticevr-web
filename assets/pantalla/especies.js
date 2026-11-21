// Especies de la Pantalla mágica (/pantalla-magica/). Cada especie es una plantilla que se pinta en el celular y un
// modelo 3D que solo toma la textura de esa plantilla: mariposa, libélula, pez, medusa, farolito y globo, agrupadas en
// MUNDOS (al final). Figura nueva = un objeto con la misma forma, su nombre en ESPECIES, en un mundo y en KINDS de
// _pantalla/api.js. Además: mov (vuelo | nado | medusa | sube), vel, esc, mitad (pintar un ala), simetria (espejo),
// rx3d (cómo se ve en el celular), y el modelo tiene update(aleteo) (alas) o tick(t).
//   W, H        medidas de la textura que se pinta y se manda (px)
//   partes()    Path2D de cada zona que se rellena con la cubeta ({id, path}); juntas forman la silueta
//   silueta()   Path2D de toda la parte pintable
//   decorar(x)  líneas que se dibujan encima (venas y contorno): salen igual en el celular y en la textura
//   cuerpo(x)   lo que solo se ve en el celular para ubicarse (el cuerpo); no va en la textura
//   patron(x, rnd) un diseño bonito al azar (las de la pantalla cuando está vacía y "Sorpréndeme")
//   build(THREE, tex, glow) → { root, update(t, aleteo) }: el modelo 3D

export const rng = seed => { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 | 0, s = (s ^ (s + Math.imul(s ^ (s >>> 7), 61 | s))) ^ (s >>> 14)) >>> 0) / 4294967296; };

// ---------- mariposa ----------
const MW = 1024, MH = 512, CX = 512, HALF = 512;
// alas derechas en coordenadas del ala: u = 0 en el cuerpo → 1 en la punta, v = 0 arriba (cabeza) → 1 abajo
const ALA_ARRIBA = [[0.03, 0.40], [[0.10, 0.08], [0.55, -0.03], [0.93, 0.05]], [[1.00, 0.11], [0.98, 0.31], [0.86, 0.41]], [[0.70, 0.51], [0.30, 0.53], [0.05, 0.51]]];
const ALA_ABAJO = [[0.05, 0.47], [[0.36, 0.45], [0.74, 0.54], [0.76, 0.70]], [[0.78, 0.87], [0.56, 0.98], [0.38, 0.97]], [[0.21, 0.96], [0.07, 0.81], [0.03, 0.58]]];
const P = (side, [u, v]) => [CX + side * u * HALF, v * MH];
function wingPath(def, side, path = new Path2D()) {
  const [s, ...cs] = def;
  path.moveTo(...P(side, s));
  for (const c of cs) path.bezierCurveTo(...P(side, c[0]), ...P(side, c[1]), ...P(side, c[2]));
  path.closePath();
  return path;
}
const VENAS = [[0.92, 0.07], [0.80, 0.10], [0.62, 0.12], [0.90, 0.30], [0.70, 0.45], [0.45, 0.50], [0.70, 0.62], [0.68, 0.80], [0.50, 0.94], [0.30, 0.92], [0.15, 0.80]];

const mariposa = {
  nombre: "Mariposa", W: MW, H: MH,
  partes() {
    return [
      { id: "ad", path: wingPath(ALA_ARRIBA, 1) }, { id: "ai", path: wingPath(ALA_ARRIBA, -1) },
      { id: "bd", path: wingPath(ALA_ABAJO, 1) }, { id: "bi", path: wingPath(ALA_ABAJO, -1) },
    ];
  },
  silueta() {
    const p = new Path2D();
    for (const s of [1, -1]) { wingPath(ALA_ARRIBA, s, p); wingPath(ALA_ABAJO, s, p); }
    return p;
  },
  // quién es el espejo de cada parte (para la cubeta con espejo)
  espejo: { ad: "ai", ai: "ad", bd: "bi", bi: "bd" },
  decorar(x) {
    const sil = this.silueta();
    x.save(); x.clip(sil);
    x.strokeStyle = "rgba(28,8,48,.35)"; x.lineWidth = 3; x.lineCap = "round";
    for (const s of [1, -1]) for (const [u, v] of VENAS) {
      const [x0, y0] = P(s, [0.04, v < 0.5 ? 0.42 : 0.55]), [x1, y1] = P(s, [u, v]), [mx, my] = P(s, [u * 0.5, (v + (v < 0.5 ? 0.42 : 0.55)) / 2 + (v < 0.5 ? 0.04 : -0.03)]);
      x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(mx, my, x1, y1); x.stroke();
    }
    // contorno (por dentro: el clip corta la mitad de afuera)
    x.strokeStyle = "rgba(24,6,40,.9)"; x.lineWidth = 14; x.stroke(sil);
    x.restore();
  },
  cuerpo(x) {
    x.save();
    const g = x.createLinearGradient(CX - 14, 0, CX + 14, 0);
    g.addColorStop(0, "#1a0b2e"); g.addColorStop(0.5, "#4a2378"); g.addColorStop(1, "#1a0b2e");
    x.fillStyle = g;
    x.beginPath(); x.ellipse(CX, 260, 15, 150, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(CX, 100, 20, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "#2a1248"; x.lineWidth = 5; x.lineCap = "round";
    for (const s of [1, -1]) { x.beginPath(); x.moveTo(CX + s * 6, 86); x.quadraticCurveTo(CX + s * 30, 20, CX + s * 70, 8); x.stroke(); }
    x.fillStyle = "#ffbe55";
    for (const s of [1, -1]) { x.beginPath(); x.arc(CX + s * 70, 8, 8, 0, Math.PI * 2); x.fill(); }
    x.restore();
  },
  patron(x, rnd = Math.random) {
    const H = () => Math.floor(rnd() * 360);
    const h1 = H(), h2 = (h1 + 40 + rnd() * 140) % 360, h3 = (h1 + 180) % 360;
    const sil = this.silueta();
    x.save(); x.clip(sil);
    // degradado del cuerpo hacia las puntas
    const g = x.createRadialGradient(CX, MH * 0.48, 20, CX, MH * 0.48, HALF);
    g.addColorStop(0, `hsl(${h1} 95% 62%)`); g.addColorStop(0.55, `hsl(${h2} 90% 55%)`); g.addColorStop(1, `hsl(${h2} 85% 30%)`);
    x.fillStyle = g; x.fillRect(0, 0, MW, MH);
    // franja oscura en la orilla con puntitos blancos
    x.strokeStyle = `hsl(${h3} 60% 12%)`; x.lineWidth = 70; x.stroke(sil);
    const nDots = 9 + Math.floor(rnd() * 8);
    for (const s of [1, -1]) {
      for (let i = 0; i < nDots; i++) {
        const t = i / (nDots - 1), u = 0.35 + 0.58 * Math.sin(t * Math.PI * 0.5), v = 0.08 + t * 0.32;
        const [px, py] = P(s, [u * 0.95, v + 0.02]); x.fillStyle = "rgba(255,255,255,.92)"; x.beginPath(); x.arc(px, py, 6 + rnd() * 5, 0, 7); x.fill();
      }
      for (let i = 0; i < 7; i++) {
        const t = i / 6, [px, py] = P(s, [0.70 - t * 0.38, 0.72 + Math.sin(t * Math.PI) * 0.18]);
        x.fillStyle = "rgba(255,255,255,.85)"; x.beginPath(); x.arc(px, py, 5 + rnd() * 4, 0, 7); x.fill();
      }
      // ojo en el ala de abajo
      const [ex, ey] = P(s, [0.50, 0.72]), er = 30 + rnd() * 16;
      const eg = x.createRadialGradient(ex, ey, 2, ex, ey, er);
      eg.addColorStop(0, "#fff"); eg.addColorStop(0.25, `hsl(${h3} 90% 20%)`); eg.addColorStop(0.55, `hsl(${h1} 100% 60%)`); eg.addColorStop(0.8, `hsl(${h3} 70% 15%)`); eg.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = eg; x.beginPath(); x.arc(ex, ey, er, 0, 7); x.fill();
      // mancha en el ala de arriba
      if (rnd() < 0.7) {
        const [mx, my] = P(s, [0.55, 0.26]);
        x.fillStyle = `hsla(${(h1 + 60) % 360} 100% 75% / .85)`; x.beginPath(); x.ellipse(mx, my, 50 + rnd() * 30, 22 + rnd() * 12, s * -0.5, 0, 7); x.fill();
      }
    }
    x.restore();
  },
  // modelo 3D: cuerpo a lo largo de +Z (la cabeza hacia +Z), alas sobre X, arriba = +Y. Envergadura ≈ 2 unidades.
  build(THREE, tex, glow) {
    const root = new THREE.Group(), S = 1;
    const wingGeo = side => {
      const N = 14, pos = [], uv = [], idx = [];
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
        const u = i / N, v = j / N;
        pos.push(side * u * S, 0.10 * S * u * u + 0.03 * Math.sin(v * Math.PI) * u, (0.48 - v) * S);
        uv.push(0.5 + side * u * 0.5, 1 - v);
      }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.3, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.15, transparent: false });
    const glowMat = glow ? new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.45 }) : null;
    const wings = [];
    for (const side of [1, -1]) {
      const pivot = new THREE.Group(), g = wingGeo(side);
      const m = new THREE.Mesh(g, mat); m.userData.ala = true; pivot.add(m);
      if (glowMat) { const gm = new THREE.Mesh(g, glowMat); gm.scale.setScalar(1.07); gm.position.y = -0.01; gm.renderOrder = -1; pivot.add(gm); }
      pivot.userData.side = side;
      root.add(pivot); wings.push(pivot);
    }
    // cuerpo, cabeza y antenas con puntas que brillan
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d0c33, emissive: 0x5a2a99, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.035 * S, 0.55 * S, 6, 12), bodyMat);
    body.rotation.x = Math.PI / 2; body.position.z = -0.02 * S; root.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.055 * S, 16, 12), bodyMat); head.position.z = 0.36 * S; root.add(head);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    for (const s of [1, -1]) {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(s * 0.02, 0.03, 0.38 * S), new THREE.Vector3(s * 0.08, 0.16, 0.55 * S), new THREE.Vector3(s * 0.2, 0.22, 0.66 * S));
      root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.008 * S, 5), bodyMat));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022 * S, 10, 8), tipMat); tip.position.copy(curve.getPoint(1)); root.add(tip);
    }
    root.userData.mats = [mat, glowMat, bodyMat, tipMat].filter(Boolean);
    return {
      root, wings,
      // a = ángulo del aleteo en radianes (positivo = alas arriba)
      update(a) { for (const w of wings) w.rotation.z = w.userData.side * a; },
      // las puntas de las alas en coordenadas del mundo (para soltar destellos)
      tips(out, THREE_) {
        for (let i = 0; i < 2; i++) { const w = wings[i]; out[i].set(w.userData.side * 0.9 * S, 0.1, 0.25 * S); w.localToWorld(out[i]); }
        return out;
      },
    };
  },
};

// ---------- utilidades para las demás figuras ----------
const TAU = Math.PI * 2;
function grid(THREE, nx, ny, fn) {   // fn(u, v) → [x, y, z, U, V]
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const r = fn(i / nx, j / ny); pos.push(r[0], r[1], r[2]); uv.push(r[3], r[4]); }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const texMat = (THREE, tex, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.3, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.1 }, o));
const glowOf = (THREE, glow) => glow ? new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.45 }) : null;
const hex = c => c ? (Math.round(c[0] * 255) << 16 | Math.round(c[1] * 255) << 8 | Math.round(c[2] * 255)) : 0xd2b8ff;
// llamita o resplandor cálido (sprite aditivo)
function llama(THREE, color = "255,190,85") {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,240,1)"); g.addColorStop(0.25, `rgba(${color},.9)`); g.addColorStop(0.6, `rgba(${color},.25)`); g.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}
// alas de un lado (mitad de la textura) como en la mariposa
function alaGeo(THREE, side, S = 1, curva = 0.10) {
  return grid(THREE, 14, 14, (u, v) => [side * u * S, curva * S * u * u + 0.03 * Math.sin(v * Math.PI) * u, (0.48 - v) * S, 0.5 + side * u * 0.5, 1 - v]);
}
function alasDe(THREE, root, tex, glow, opts = {}) {
  const mat = texMat(THREE, tex, opts.mat || {}), gm = glowOf(THREE, glow), wings = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group(), g = alaGeo(THREE, side, 1, opts.curva);
    const m = new THREE.Mesh(g, mat); m.userData.ala = true; pivot.add(m);
    if (gm) { const k = new THREE.Mesh(g, gm); k.scale.setScalar(1.07); k.position.y = -0.01; k.renderOrder = -1; pivot.add(k); }
    pivot.userData.side = side; root.add(pivot); wings.push(pivot);
  }
  return { mat, gm, wings };
}

// ---------- libélula ----------
const LALAS = { ad: [CX + 252, 178, 248, 46, -0.10], bd: [CX + 236, 272, 232, 54, 0.14] };
function lalaPath(id, side, p = new Path2D()) {
  const [x, y, rx, ry, r] = LALAS[id[0] + "d"];
  // moveTo antes de cada elipse: si no, el trazo une un ala con la otra con una línea recta y deja un triángulo sin pintar
  const ex = CX + side * (x - CX), a = side * r;
  p.moveTo(ex + rx * Math.cos(a), y + rx * Math.sin(a));
  p.ellipse(ex, y, rx, ry, a, 0, TAU);
  return p;
}
const libelula = {
  nombre: "Libélula", femenino: true, verbo: "vuela", W: MW, H: MH, mitad: true, simetria: true,
  mov: "vuelo", vel: 1.7, dardo: true, esc: [0.85, 1.15], aleteo: { frec: [20, 26], base: 0.12, amp: 0.36 }, rx3d: -1.1,
  partes() { return [{ id: "ad", path: lalaPath("ad", 1) }, { id: "ai", path: lalaPath("ad", -1) }, { id: "bd", path: lalaPath("bd", 1) }, { id: "bi", path: lalaPath("bd", -1) }]; },
  silueta() { const p = new Path2D(); for (const s of [1, -1]) { lalaPath("ad", s, p); lalaPath("bd", s, p); } return p; },
  espejo: { ad: "ai", ai: "ad", bd: "bi", bi: "bd" },
  decorar(x) {
    const sil = this.silueta();
    x.save(); x.clip(sil);
    x.strokeStyle = "rgba(28,8,48,.32)"; x.lineWidth = 3; x.lineCap = "round";
    for (const s of [1, -1]) for (const id of ["ad", "bd"]) {
      const [cx, cy, rx, ry, r] = LALAS[id];
      x.save(); x.translate(CX + s * (cx - CX), cy); x.rotate(s * r); x.scale(s, 1);
      for (const k of [-0.55, -0.15, 0.3]) { x.beginPath(); x.moveTo(-rx, k * ry * 0.4); x.quadraticCurveTo(0, k * ry, rx * 0.95, k * ry * 0.5); x.stroke(); }
      for (let i = -0.8; i < 0.9; i += 0.14) { x.beginPath(); x.moveTo(i * rx, -ry); x.lineTo(i * rx + 8, ry); x.stroke(); }
      x.fillStyle = "rgba(24,6,40,.75)"; x.beginPath(); x.ellipse(rx * 0.78, -ry * 0.55, 18, 7, 0, 0, TAU); x.fill();
      x.restore();
    }
    x.strokeStyle = "rgba(24,6,40,.85)"; x.lineWidth = 12; x.stroke(sil);
    x.restore();
  },
  cuerpo(x) {
    x.save();
    const g = x.createLinearGradient(CX - 12, 0, CX + 12, 0); g.addColorStop(0, "#0e3a4a"); g.addColorStop(0.5, "#2aa6b8"); g.addColorStop(1, "#0e3a4a");
    x.fillStyle = g;
    x.beginPath(); x.ellipse(CX, 225, 22, 50, 0, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(CX - 10, 260); x.lineTo(CX - 5, 505); x.lineTo(CX + 5, 505); x.lineTo(CX + 10, 260); x.fill();
    x.fillStyle = "#38d6ff"; for (const s of [1, -1]) { x.beginPath(); x.arc(CX + s * 17, 162, 22, 0, TAU); x.fill(); }
    x.restore();
  },
  patron(x, rnd = Math.random) {
    const h1 = Math.floor(rnd() * 360), h2 = (h1 + 30 + rnd() * 90) % 360;
    x.save(); x.clip(this.silueta());
    const g = x.createRadialGradient(CX, MH * 0.45, 20, CX, MH * 0.45, HALF);
    g.addColorStop(0, `hsl(${h1} 80% 85%)`); g.addColorStop(0.6, `hsl(${h2} 75% 70%)`); g.addColorStop(1, `hsl(${h2} 85% 42%)`);
    x.fillStyle = g; x.fillRect(0, 0, MW, MH);
    for (const s of [1, -1]) for (const id of ["ad", "bd"]) {
      const [cx, cy, rx, ry] = LALAS[id];
      const px = CX + s * (cx - CX + rx * 0.7), cg = x.createRadialGradient(px, cy, 4, px, cy, 90);
      cg.addColorStop(0, `hsla(${(h1 + 180) % 360} 90% 50% / .8)`); cg.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = cg; x.fillRect(px - 100, cy - 100, 200, 200);
    }
    x.restore();
  },
  build(THREE, tex, glow, col) {
    const root = new THREE.Group();
    const { mat, gm, wings } = alasDe(THREE, root, tex, glow, { curva: 0.05 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0d3340, emissive: hex(col), emissiveIntensity: 0.45, roughness: 0.3, metalness: 0.5 });
    const thorax = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.12, 6, 12), bodyMat); thorax.rotation.x = Math.PI / 2; thorax.position.z = 0.12; root.add(thorax);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.95, 4, 10), bodyMat); tail.rotation.x = Math.PI / 2; tail.position.z = -0.48; root.add(tail);
    const eyeMat = new THREE.MeshStandardMaterial({ color: hex(col), emissive: hex(col), emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.3 });
    for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), eyeMat); e.position.set(s * 0.045, 0.02, 0.27); root.add(e); }
    root.userData.mats = [mat, gm, bodyMat, eyeMat].filter(Boolean);
    return {
      root, wings,
      // dos pares de alas: se alternan un poco
      update(a) { wings[0].rotation.z = a; wings[1].rotation.z = -a; },
      tips(out) { for (let i = 0; i < 2; i++) { const w = wings[i]; out[i].set(w.userData.side * 0.9, 0.05, 0.1); w.localToWorld(out[i]); } return out; },
    };
  },
};

// ---------- pez (de lado, mirando a la derecha) ----------
function pezCuerpo(p = new Path2D()) {
  p.moveTo(965, 262);
  p.bezierCurveTo(930, 140, 700, 85, 470, 115); p.bezierCurveTo(360, 130, 300, 200, 262, 256);
  p.bezierCurveTo(300, 312, 360, 382, 470, 398); p.bezierCurveTo(700, 430, 930, 385, 965, 262); p.closePath();
  return p;
}
function pezCola(p = new Path2D()) { p.moveTo(290, 256); p.bezierCurveTo(200, 190, 120, 110, 40, 70); p.bezierCurveTo(95, 180, 95, 330, 40, 442); p.bezierCurveTo(120, 400, 200, 322, 290, 256); p.closePath(); return p; }
// las aletas apuntan hacia la cola (el pez mira a la derecha)
function pezDorsal(p = new Path2D()) { p.moveTo(740, 104); p.quadraticCurveTo(660, 6, 450, 36); p.quadraticCurveTo(500, 80, 480, 122); p.closePath(); return p; }
function pezAnal(p = new Path2D()) { p.moveTo(700, 414); p.quadraticCurveTo(640, 500, 500, 482); p.quadraticCurveTo(540, 444, 520, 394); p.closePath(); return p; }
const pez = {
  nombre: "Pez", femenino: false, verbo: "nada", W: MW, H: MH, mitad: false, simetria: false,
  mov: "nado", vel: 1.2, esc: [0.95, 1.3], rx3d: 0,
  partes() { return [{ id: "c", path: pezCuerpo() }, { id: "k", path: pezCola() }, { id: "d", path: pezDorsal() }, { id: "a", path: pezAnal() }]; },
  silueta() { const p = new Path2D(); pezCuerpo(p); pezCola(p); pezDorsal(p); pezAnal(p); return p; },
  decorar(x) {
    const sil = this.silueta();
    x.save(); x.clip(sil);
    x.strokeStyle = "rgba(20,10,40,.28)"; x.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.22; x.beginPath(); x.moveTo(285, 256); x.lineTo(285 - Math.cos(a) * 250, 256 + Math.sin(a) * 200); x.stroke(); }
    for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(500 + i * 36, 118); x.lineTo(450 + i * 34, 20); x.stroke(); }
    for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(530 + i * 36, 400); x.lineTo(500 + i * 34, 490); x.stroke(); }
    x.strokeStyle = "rgba(20,10,40,.5)"; x.lineWidth = 5;
    x.beginPath(); x.moveTo(790, 160); x.quadraticCurveTo(745, 262, 790, 365); x.stroke();
    x.beginPath(); x.moveTo(735, 300); x.quadraticCurveTo(660, 290, 640, 345); x.quadraticCurveTo(690, 340, 735, 318); x.stroke();
    x.fillStyle = "#fff"; x.beginPath(); x.arc(862, 220, 32, 0, TAU); x.fill();
    x.fillStyle = "#14081f"; x.beginPath(); x.arc(870, 220, 17, 0, TAU); x.fill();
    x.fillStyle = "#fff"; x.beginPath(); x.arc(876, 213, 6, 0, TAU); x.fill();
    x.strokeStyle = "rgba(20,10,40,.6)"; x.lineWidth = 4; x.beginPath(); x.moveTo(962, 268); x.quadraticCurveTo(935, 282, 912, 276); x.stroke();
    x.strokeStyle = "rgba(24,6,40,.85)"; x.lineWidth = 12; x.stroke(sil);
    x.restore();
  },
  cuerpo() {},
  patron(x, rnd = Math.random) {
    const h1 = Math.floor(rnd() * 360), h2 = (h1 + 40 + rnd() * 120) % 360;
    x.save(); x.clip(this.silueta());
    const g = x.createLinearGradient(0, 80, 0, 430); g.addColorStop(0, `hsl(${h1} 85% 38%)`); g.addColorStop(0.55, `hsl(${h1} 90% 58%)`); g.addColorStop(1, `hsl(${h1} 70% 88%)`);
    x.fillStyle = g; x.fillRect(0, 0, MW, MH);
    x.fillStyle = `hsl(${h2} 95% 60%)`; x.fill(pezCola()); x.fill(pezDorsal()); x.fill(pezAnal());
    if (rnd() < 0.5) { x.fillStyle = "rgba(255,255,255,.9)"; for (const sx of [600, 450]) { x.beginPath(); x.ellipse(sx, 256, 26, 150, 0, 0, TAU); x.fill(); } }
    else { for (let i = 0; i < 26; i++) { x.fillStyle = `hsla(${h2} 95% 70% / .85)`; x.beginPath(); x.arc(380 + rnd() * 520, 140 + rnd() * 240, 8 + rnd() * 14, 0, TAU); x.fill(); } }
    x.restore();
  },
  build(THREE, tex, glow) {
    const root = new THREE.Group(), S = 1;
    // un plano de 2 × 1 con la panza un poco inflada; la cola ondula
    const g = grid(THREE, 30, 12, (u, v) => [(u - 0.5) * 2 * S, (0.5 - v) * S, 0, u, 1 - v]);
    const base = g.attributes.position.array.slice(), uvs = g.attributes.uv.array;
    const mat = texMat(THREE, tex, { emissiveIntensity: 0.3 }), gm = glowOf(THREE, glow);
    const body = new THREE.Mesh(g, mat); body.userData.ala = true; root.add(body);
    if (gm) { const k = new THREE.Mesh(g, gm); k.scale.setScalar(1.06); k.position.z = -0.03; k.renderOrder = -1; root.add(k); }
    root.userData.mats = [mat, gm].filter(Boolean);
    const P = g.attributes.position;
    return {
      root,
      tick(t, k = 1) {
        for (let i = 0; i < P.count; i++) {
          const u = uvs[i * 2], v = 1 - uvs[i * 2 + 1];
          const panza = 0.13 * Math.max(0, 1 - Math.pow((v - 0.5) / 0.33, 2)) * Math.max(0, Math.min(1, (u - 0.25) / 0.2)) * Math.max(0, Math.min(1, (0.97 - u) / 0.15));
          const ola = Math.sin(u * 5 - t * 8 * k) * 0.16 * Math.pow(1 - u, 2) * (0.4 + 0.6 * k);
          P.array[i * 3] = base[i * 3]; P.array[i * 3 + 2] = panza + ola;
        }
        P.needsUpdate = true;
      },
      tips(out) { out[0].set(-0.9, 0.2, 0); out[1].set(-0.9, -0.2, 0); body.localToWorld(out[0]); body.localToWorld(out[1]); return out; },
    };
  },
};

// ---------- medusa (vista desde arriba: la campana) ----------
const ME = 768, MC = 384, MR = 360;
const anillo = (ro, ri) => { const p = new Path2D(); p.arc(MC, MC, ro, 0, TAU); if (ri) { p.moveTo(MC + ri, MC); p.arc(MC, MC, ri, 0, TAU, true); } return p; };
const medusa = {
  nombre: "Medusa", femenino: true, verbo: "flota", W: ME, H: ME, mitad: false, simetria: true,
  mov: "medusa", vel: 0.45, esc: [0.8, 1.15], rx3d: 0.55,
  partes() { return [{ id: "c", path: anillo(140) }, { id: "m", path: anillo(260, 140) }, { id: "b", path: anillo(MR, 260) }]; },
  silueta() { return anillo(MR); },
  decorar(x) {
    x.save(); x.clip(this.silueta());
    x.strokeStyle = "rgba(255,255,255,.45)"; x.lineWidth = 5;
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; x.beginPath(); x.moveTo(MC + Math.cos(a) * 70, MC + Math.sin(a) * 70); x.lineTo(MC + Math.cos(a) * MR, MC + Math.sin(a) * MR); x.stroke(); }
    x.strokeStyle = "rgba(255,255,255,.6)"; x.lineWidth = 10;
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + TAU / 8; x.beginPath(); x.arc(MC + Math.cos(a) * 95, MC + Math.sin(a) * 95, 38, a + 0.6, a + TAU - 0.6); x.stroke(); }
    x.strokeStyle = "rgba(24,6,40,.55)"; x.lineWidth = 12; x.stroke(this.silueta());
    x.restore();
  },
  cuerpo() {},
  patron(x, rnd = Math.random) {
    const h1 = Math.floor(rnd() * 360), h2 = (h1 + 40 + rnd() * 100) % 360;
    x.save(); x.clip(this.silueta());
    const g = x.createRadialGradient(MC, MC, 10, MC, MC, MR);
    g.addColorStop(0, `hsl(${h1} 90% 80%)`); g.addColorStop(0.5, `hsl(${h2} 85% 62%)`); g.addColorStop(1, `hsl(${h2} 90% 40%)`);
    x.fillStyle = g; x.fillRect(0, 0, ME, ME);
    for (let i = 0; i < 24; i++) { const a = i * TAU / 24; x.fillStyle = `hsla(${(h1 + 180) % 360} 100% 80% / .9)`; x.beginPath(); x.arc(MC + Math.cos(a) * 310, MC + Math.sin(a) * 310, 10, 0, TAU); x.fill(); }
    x.restore();
  },
  build(THREE, tex, glow, col) {
    const root = new THREE.Group(), Rb = 0.62, Hb = 0.48, k = MR / ME;
    const dome = new THREE.Mesh(grid(THREE, 40, 14, (u, v) => {
      const th = u * TAU, s = Math.sin(v * Math.PI / 2);
      return [Math.cos(th) * s * Rb, Math.cos(v * Math.PI / 2) * Hb, Math.sin(th) * s * Rb, 0.5 + Math.cos(th) * v * k, 0.5 - Math.sin(th) * v * k];
    }), texMat(THREE, tex, { alphaTest: 0.01, transparent: true, opacity: 0.9, emissiveIntensity: 0.42, depthWrite: false }));
    dome.userData.ala = true;
    const bell = new THREE.Group(); bell.add(dome); root.add(bell);
    const brillo = llama(THREE, `${Math.round(col?.[0] * 255 || 210)},${Math.round(col?.[1] * 255 || 184)},${Math.round(col?.[2] * 255 || 255)}`);
    brillo.scale.setScalar(1.9); brillo.position.y = 0.15; brillo.material.opacity = 0.18; bell.add(brillo);
    // tentáculos: cintas que ondulan
    const N = 12, SEG = 24, tMat = new THREE.MeshBasicMaterial({ color: hex(col), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const tents = [];
    for (let i = 0; i < N; i++) {
      const oral = i < 4, g = new THREE.BufferGeometry(), arr = new Float32Array((SEG + 1) * 2 * 3), idx = [];
      for (let j = 0; j < SEG; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setAttribute("position", new THREE.BufferAttribute(arr, 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, tMat); m.frustumCulled = false; root.add(m);
      tents.push({ g, arr, a: oral ? i * TAU / 4 + 0.4 : i * TAU / 8, r: oral ? 0.12 : Rb * 0.88, L: oral ? 0.9 : 1.5 + (i % 3) * 0.25, w: oral ? 0.09 : 0.022, f: i * 1.7 });
    }
    root.userData.mats = [dome.material, tMat, brillo.material];
    return {
      root,
      tick(t) {
        const c = Math.pow(Math.max(0, Math.sin(t * 1.6)), 2);
        bell.scale.set(1 - 0.12 * c, 1 + 0.1 * c, 1 - 0.12 * c);
        for (const T of tents) {
          const ca = Math.cos(T.a), sa = Math.sin(T.a);
          for (let j = 0; j <= SEG; j++) {
            const s = j / SEG, r = T.r * (1 - 0.12 * c) + Math.sin(s * 5 - t * 2.4 + T.f) * 0.09 * s + 0.05 * s * (1 - c);
            const y = -s * T.L * (1 + 0.05 * c), w = T.w * (1 - s * 0.85), sw = Math.sin(s * 7 - t * 3 + T.f) * 0.05 * s;
            const x0 = ca * r - sa * (w + sw), z0 = sa * r + ca * (w + sw), x1 = ca * r + sa * (w - sw), z1 = sa * r - ca * (w - sw);
            T.arr.set([x0, y, z0, x1, y, z1], j * 6);
          }
          T.g.attributes.position.needsUpdate = true;
        }
        return c;
      },
      tips(out) { const a = Math.random() * TAU; out[0].set(Math.cos(a) * Rb, 0, Math.sin(a) * Rb); out[1].set(0, -1 - Math.random(), 0); root.localToWorld(out[0]); root.localToWorld(out[1]); return out; },
    };
  },
};

// ---------- farolito de los deseos (la tela que lo envuelve) ----------
function franjas(n, W, H) { const out = []; for (let i = 0; i < n; i++) { const p = new Path2D(); p.rect(i * W / n, 0, W / n, H); out.push({ id: "p" + i, path: p }); } return out; }
function rect(W, H) { const p = new Path2D(); p.rect(0, 0, W, H); return p; }
const farolito = {
  nombre: "Farolito", femenino: false, verbo: "sube al cielo", W: MW, H: MH, mitad: false, simetria: false,
  mov: "sube", vel: 0.5, giro: 0.18, esc: [0.85, 1.25], rx3d: 0, tela: true,
  partes() { return franjas(4, MW, MH); },
  silueta() { return rect(MW, MH); },
  decorar(x) {
    x.save();
    x.strokeStyle = "rgba(120,60,20,.35)"; x.lineWidth = 4;
    for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * MW / 4, 0); x.lineTo(i * MW / 4, MH); x.stroke(); }
    x.fillStyle = "#8a5a2b"; x.fillRect(0, MH - 22, MW, 22); x.fillStyle = "#c48a45"; x.fillRect(0, MH - 22, MW, 5);
    x.restore();
  },
  cuerpo() {},
  patron(x, rnd = Math.random) {
    const h1 = 10 + Math.floor(rnd() * 50), h2 = Math.floor(rnd() * 360);
    const g = x.createLinearGradient(0, 0, 0, MH); g.addColorStop(0, `hsl(${h1} 95% 62%)`); g.addColorStop(1, `hsl(${h1 + 20} 100% 82%)`);
    x.fillStyle = g; x.fillRect(0, 0, MW, MH);
    for (let i = 0; i < 4; i++) {
      const cx = MW / 8 + i * MW / 4, cy = MH * 0.45;
      x.fillStyle = `hsla(${h2} 80% 45% / .85)`;
      x.beginPath(); for (let k = 0; k < 10; k++) { const a = k * TAU / 10 - Math.PI / 2, r = k % 2 ? 40 : 95; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.fill();
      x.fillStyle = "rgba(255,255,255,.7)"; x.beginPath(); x.arc(cx, cy, 22, 0, TAU); x.fill();
    }
    x.fillStyle = `hsla(${h2} 80% 40% / .6)`; for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(rnd() * MW, 40 + rnd() * 60, 4, 0, TAU); x.fill(); }
  },
  build(THREE, tex) {
    const root = new THREE.Group(), body = new THREE.Group(); body.position.y = -0.6; root.add(body);
    const prof = [[0.30, 0], [0.36, 0.25], [0.42, 0.6], [0.45, 0.9], [0.44, 1.0]].map(([r, y]) => new THREE.Vector2(r, y));
    const mat = texMat(THREE, tex, { alphaTest: 0, emissiveIntensity: 0.3, roughness: 0.9, metalness: 0 });
    const side = new THREE.Mesh(new THREE.LatheGeometry(prof, 36), mat); side.userData.ala = true; body.add(side);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb060, emissiveIntensity: 0.2, side: THREE.DoubleSide, roughness: 0.9 });
    const cap = new THREE.Mesh(new THREE.LatheGeometry([[0.44, 1.0], [0.38, 1.1], [0.22, 1.17], [0.001, 1.2]].map(([r, y]) => new THREE.Vector2(r, y)), 36), capMat); body.add(cap);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.014, 6, 36), ringMat); ring.rotation.x = Math.PI / 2; body.add(ring);
    const fuego = llama(THREE); fuego.position.y = 0.12; fuego.scale.setScalar(0.32); body.add(fuego);
    const dentro = llama(THREE, "255,150,60"); dentro.position.y = 0.3; dentro.scale.setScalar(0.7); dentro.material.opacity = 0.1; body.add(dentro);
    root.userData.mats = [mat, capMat, ringMat, fuego.material, dentro.material];
    return {
      root,
      tick(t) { const f = 0.3 + Math.sin(t * 13) * 0.03 + Math.sin(t * 7.3) * 0.02; fuego.scale.set(f * 0.8, f, 1); dentro.material.opacity = 0.09 + Math.sin(t * 9) * 0.02; },
      tips(out) { out[0].set(0, 0.1, 0); out[1].set((Math.random() - 0.5) * 0.5, 0.5, 0.3); body.localToWorld(out[0]); body.localToWorld(out[1]); return out; },
    };
  },
};

// ---------- globo aerostático ----------
const globo = {
  nombre: "Globo", femenino: false, verbo: "sube al cielo", W: MW, H: MH, mitad: false, simetria: false,
  mov: "sube", vel: 0.32, giro: 0.08, esc: [0.65, 0.95], rx3d: 0, tela: true,
  partes() { return franjas(8, MW, MH); },
  silueta() { return rect(MW, MH); },
  decorar(x) {
    x.save(); x.strokeStyle = "rgba(40,20,60,.35)"; x.lineWidth = 4;
    for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(i * MW / 8, 0); x.lineTo(i * MW / 8, MH); x.stroke(); }
    x.restore();
  },
  cuerpo() {},
  patron(x, rnd = Math.random) {
    const h1 = Math.floor(rnd() * 360), h2 = (h1 + 120 + rnd() * 120) % 360;
    for (let i = 0; i < 8; i++) { x.fillStyle = `hsl(${i % 2 ? h1 : h2} 85% ${i % 2 ? 55 : 62}%)`; x.fillRect(i * MW / 8, 0, MW / 8, MH); }
    x.fillStyle = "rgba(255,255,255,.92)";
    x.beginPath(); for (let i = 0; i <= 32; i++) x.lineTo(i * MW / 32, MH * 0.55 + (i % 2 ? -34 : 34)); for (let i = 32; i >= 0; i--) x.lineTo(i * MW / 32, MH * 0.55 + (i % 2 ? -14 : 54)); x.fill();
    x.fillStyle = `hsl(${(h1 + 60) % 360} 95% 65%)`; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(MW / 16 + i * MW / 8, MH * 0.3, 18, 0, TAU); x.fill(); }
  },
  build(THREE, tex) {
    const root = new THREE.Group(), body = new THREE.Group(); body.position.y = -0.55; root.add(body);
    const prof = [[0.10, 0], [0.28, 0.12], [0.50, 0.38], [0.62, 0.70], [0.63, 0.95], [0.55, 1.2], [0.38, 1.40], [0.18, 1.50], [0.001, 1.53]].map(([r, y]) => new THREE.Vector2(r, y));
    const mat = texMat(THREE, tex, { alphaTest: 0, emissiveIntensity: 0.25, roughness: 0.5 });
    const env = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), mat); env.userData.ala = true; body.add(env);
    const cesto = new THREE.MeshStandardMaterial({ color: 0x7a4b25, roughness: 0.9 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), cesto); box.position.y = -0.4; body.add(box);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const a = new THREE.Vector3(sx * 0.1, -0.32, sz * 0.1), b = new THREE.Vector3(sx * 0.07, 0, sz * 0.07);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, a.distanceTo(b), 4), cesto);
      c.position.copy(a).add(b).multiplyScalar(0.5); c.lookAt(b); c.rotateX(Math.PI / 2); body.add(c);
    }
    const fuego = llama(THREE); fuego.position.y = -0.12; fuego.scale.setScalar(0.22); body.add(fuego);
    root.userData.mats = [mat, cesto, fuego.material];
    return {
      root,
      tick(t) { const f = 0.2 + Math.max(0, Math.sin(t * 2.1)) * 0.08 + Math.sin(t * 17) * 0.015; fuego.scale.setScalar(f); },
      tips(out) { out[0].set(0, -0.1, 0); out[1].set((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.8, 0.5); body.localToWorld(out[0]); body.localToWorld(out[1]); return out; },
    };
  },
};

Object.assign(mariposa, { femenino: true, verbo: "vuela", mitad: true, simetria: true, mov: "vuelo", vel: 1, esc: [0.9, 1.25], aleteo: { frec: [7, 10], base: 0.32, amp: 0.62 }, rx3d: -1.1 });

// mundos: cada pantalla elige uno; el celular ofrece sus figuras
export const MUNDOS = {
  jardin: { nombre: "Jardín", titulo: "Jardín de deseos", especies: ["mariposa", "libelula"], deseo: "Ej. Que mi familia siempre esté unida" },
  oceano: { nombre: "Océano", titulo: "Océano de deseos", especies: ["pez", "medusa"], deseo: "Ej. Que el mar siempre esté limpio" },
  cielo: { nombre: "Cielo", titulo: "Cielo de deseos", especies: ["farolito", "globo"], deseo: "Ej. Que este año cumpla mi sueño" },
};

export const ESPECIES = { mariposa, libelula, pez, medusa, farolito, globo };

// textura final de lo que se pintó: lo pintado (solo dentro de la silueta) + venas y contorno, fondo transparente
export function componer(esp, pintura, out = document.createElement("canvas")) {
  out.width = esp.W; out.height = esp.H;
  const x = out.getContext("2d");
  x.clearRect(0, 0, esp.W, esp.H);
  x.save(); x.clip(esp.silueta()); x.drawImage(pintura, 0, 0); x.restore();
  esp.decorar(x);
  return out;
}

// aura: la silueta borrosa del color promedio de la textura (se dibuja detrás de las alas con brillo aditivo)
export function aura(esp, textura) {
  const c = document.createElement("canvas"); c.width = esp.W / 2; c.height = esp.H / 2;
  const x = c.getContext("2d");
  // color promedio
  const s = document.createElement("canvas"); s.width = 32; s.height = 16;
  const sx = s.getContext("2d"); sx.drawImage(textura, 0, 0, 32, 16);
  const d = sx.getImageData(0, 0, 32, 16).data; let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  n = n || 1; r /= n; g /= n; b /= n;
  // más saturado y claro para que brille
  const mx = Math.max(r, g, b, 1), k = 255 / mx; r = Math.min(255, r * k * 0.9 + 40); g = Math.min(255, g * k * 0.9 + 40); b = Math.min(255, b * k * 0.9 + 40);
  x.filter = "blur(10px)";
  x.scale(0.5, 0.5);
  x.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
  x.fill(esp.silueta());
  return { canvas: c, color: [r / 255, g / 255, b / 255] };
}
