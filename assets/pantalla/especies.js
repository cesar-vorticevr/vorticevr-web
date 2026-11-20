// Especies de la Pantalla mágica (/pantalla-magica/). Cada especie es una plantilla que se pinta en el celular y un
// modelo 3D que solo toma la textura de esa plantilla. Hoy: "mariposa". Para agregar otra (pez, flor, pájaro…):
// agregar aquí un objeto con la misma forma y su nombre en KINDS de _pantalla/api.js.
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
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.15, transparent: false });
    const glowMat = glow ? new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.9 }) : null;
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

export const ESPECIES = { mariposa };

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
