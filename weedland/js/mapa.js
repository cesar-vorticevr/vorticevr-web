// Distribución del mundo de Weedland: isla orgánica, plaza central, 4 zonas con sus stands,
// lugares (Universidad, Taller), granjas, estanques, caminos y decoración.
// Es determinista: siempre genera el mismo mapa.
import { ZONAS, LUGARES, VECINOS } from "./datos.js";

export const N = 80;
export const C = { x: 40, y: 40 };

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const radioIsla = (a) => 36 + 1.2 * Math.sin(3 * a + 0.5) + 0.8 * Math.sin(5 * a + 2) + 0.5 * Math.sin(9 * a);
export const enIsla = (x, y, margen = 0) => Math.hypot(x - C.x, y - C.y) < radioIsla(Math.atan2(y - C.y, x - C.x)) - margen;

function bezier(a, b, curva, pasos = 24) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / L) * curva, cy = my + (dx / L) * curva;
  const pts = [];
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos, u = 1 - t;
    pts.push({ x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y });
  }
  return pts;
}
function circulo(c, r, pasos = 36) {
  const pts = [];
  for (let i = 0; i <= pasos; i++) { const a = (i / pasos) * Math.PI * 2; pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }); }
  return pts;
}

export function crearMapa(marcas) {
  const R = rng(20261116);
  const id = (x, y) => y * N + x;
  const dentro = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const bloq = new Uint8Array(N * N);
  const camino = new Uint8Array(N * N);
  const reservado = new Uint8Array(N * N); // sin decoración aquí
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!enIsla(x + 0.5, y + 0.5, 0.8)) bloq[id(x, y)] = 1;

  const marcarCirculo = (arr, cx, cy, r) => {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++)
      if (dentro(x, y) && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) arr[id(x, y)] = 1;
  };

  const plazas = [{ x: C.x, y: C.y, r: 5.5, color: "#c6f36b", tipo: "central" }];
  const centros = [{ tipo: "arbolLuz", x: C.x, y: C.y }];
  const caminos = [];
  const edificios = [];
  marcarCirculo(bloq, C.x, C.y, 1.3);
  marcarCirculo(reservado, C.x, C.y, 6.2);

  function puertaDe(e) {
    const prefs = [[1.9, 1.9], [2.3, 1.2], [1.2, 2.3], [2.6, 0.4], [0.4, 2.6], [2.8, 2.8]];
    for (const [dx, dy] of prefs) {
      const px = Math.floor(e.x + dx), py = Math.floor(e.y + dy);
      if (dentro(px, py) && !bloq[id(px, py)]) return { x: px, y: py };
    }
    return { x: Math.floor(e.x + 2), y: Math.floor(e.y + 2) };
  }
  function agregarEdificio(e) {
    edificios.push(e);
    marcarCirculo(bloq, e.x, e.y, e.r + 0.15);
    marcarCirculo(reservado, e.x, e.y, e.r + 1.6);
  }

  // Zonas: plaza, tótem, camino curvo desde el centro, anillo y stands alrededor
  let signo = 1;
  for (const [zid, z] of Object.entries(ZONAS)) {
    const c = z.centro;
    plazas.push({ x: c.x, y: c.y, r: 4, color: z.color, tipo: zid });
    centros.push({ tipo: "totem", zona: zid, x: c.x, y: c.y, color: z.color });
    marcarCirculo(bloq, c.x, c.y, 1.0);
    marcarCirculo(reservado, c.x, c.y, 4.6);
    caminos.push(bezier(C, c, 4 * signo)); signo = -signo;
    caminos.push(circulo(c, 6.2));
    const lista = marcas.filter((m) => m.zona === zid);
    const a0 = Math.atan2(C.y - c.y, C.x - c.x), hueco = (26 * Math.PI) / 180;
    const arco = Math.PI * 2 - hueco * 2;
    lista.forEach((m, j) => {
      const a = a0 + hueco + (lista.length > 1 ? (j * arco) / (lista.length - 1) : arco / 2);
      const e = { id: m.id, tipo: "marca", zona: zid, x: c.x + Math.cos(a) * 8.9, y: c.y + Math.sin(a) * 8.9, r: 1.3 };
      agregarEdificio(e);
    });
  }
  // Lugares especiales
  for (const l of Object.values(LUGARES)) {
    agregarEdificio({ id: l.id, tipo: "lugar", x: l.x, y: l.y, r: 1.7 });
    caminos.push(bezier(C, { x: l.x, y: l.y }, 2.5));
  }

  // Granjas
  const granjas = [];
  const crearGranja = (dueno, x0, y0, columnas, filas) => {
    const plots = [];
    for (let f = 0; f < filas; f++) for (let k = 0; k < columnas; k++) {
      const x = x0 + k, y = y0 + f * 2;
      plots.push({ x, y });
      bloq[id(x, y)] = 1;
    }
    const rect = { x: x0 - 1, y: y0 - 1, w: columnas + 2, h: filas * 2 + 1 };
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) if (dentro(x, y)) reservado[id(x, y)] = 1;
    granjas.push({ dueno, plots, rect });
  };
  crearGranja("yo", 47, 47, 4, 2);
  crearGranja(VECINOS[0].id, 29, 48, 4, 1);
  crearGranja(VECINOS[1].id, 53, 52, 4, 1);
  crearGranja(VECINOS[2].id, 24, 25, 4, 1);
  caminos.push(bezier(C, { x: 48.5, y: 46 }, -2));
  // Letreros de granja (bloquean su casilla)
  const letreros = granjas.map((g) => ({ dueno: g.dueno, x: g.rect.x, y: g.rect.y + g.rect.h - 1 }));
  for (const l of letreros) bloq[id(l.x, l.y)] = 1;

  // Estanques
  const estanques = [{ x: 56, y: 24, rx: 3.2, ry: 2.3 }, { x: 26, y: 58, rx: 2.8, ry: 2.2 }, { x: 62, y: 60, rx: 2.6, ry: 2 }, { x: 22, y: 20, rx: 2.2, ry: 1.8 }];
  for (const p of estanques) {
    for (let y = Math.floor(p.y - p.ry - 1); y <= p.y + p.ry + 1; y++) for (let x = Math.floor(p.x - p.rx - 1); x <= p.x + p.rx + 1; x++) {
      if (!dentro(x, y)) continue;
      const d = ((x + 0.5 - p.x) / p.rx) ** 2 + ((y + 0.5 - p.y) / p.ry) ** 2;
      if (d <= 1) bloq[id(x, y)] = 1;
      if (d <= 1.9) reservado[id(x, y)] = 1;
    }
  }

  // Caminos: marcar casillas para no poner decoración encima
  for (const pts of caminos) for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y);
    for (let s = 0; s <= L; s += 0.35) {
      const x = a.x + ((b.x - a.x) * s) / L, y = a.y + ((b.y - a.y) * s) / L;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const tx = Math.floor(x + dx * 0.7), ty = Math.floor(y + dy * 0.7);
        if (dentro(tx, ty)) camino[id(tx, ty)] = 1;
      }
    }
  }

  // Puertas (después de bloquear todo)
  for (const e of edificios) { e.puerta = puertaDe(e); reservado[id(e.puerta.x, e.puerta.y)] = 1; }

  // Faroles a lo largo de los caminos
  const deco = [];
  const libre = (x, y) => dentro(x, y) && !bloq[id(x, y)] && !camino[id(x, y)] && !reservado[id(x, y)] && enIsla(x + 0.5, y + 0.5, 1.5);

  // Vallas publicitarias junto a los caminos principales (del centro a cada zona y a los lugares)
  const vallas = [];
  const principales = [0, 2, 4, 6, 8, 9].map((i) => caminos[i]).filter(Boolean);
  principales.forEach((pts, n) => {
    for (const k of [0.38, 0.72]) {
      const i = Math.floor(k * (pts.length - 1)), a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      for (const lado of n % 2 ? [1, -1] : [-1, 1]) {
        const x = Math.floor(a.x - (dy / L) * 2.3 * lado), y = Math.floor(a.y + (dx / L) * 2.3 * lado);
        if (libre(x, y)) { vallas.push({ x: x + 0.5, y: y + 0.5 }); bloq[id(x, y)] = 1; marcarCirculo(reservado, x + 0.5, y + 0.5, 1.6); break; }
      }
    }
  });
  for (const pts of caminos) {
    let acum = 0;
    for (let i = 1; i < pts.length; i++) {
      acum += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (acum > 5) {
        acum = 0;
        const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y, L = Math.hypot(dx, dy) || 1;
        const x = Math.floor(pts[i].x - (dy / L) * 1.6), y = Math.floor(pts[i].y + (dx / L) * 1.6);
        if (libre(x, y)) { deco.push({ t: "farol", x: x + 0.5, y: y + 0.5 }); bloq[id(x, y)] = 1; reservado[id(x, y)] = 1; }
      }
    }
  }
  // Árboles, hongos, cristales, rocas, arbustos
  const poner = (t, n, bloquea = true, intentos = 30) => {
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < intentos; i++) {
        const x = Math.floor(R() * N), y = Math.floor(R() * N);
        if (!libre(x, y)) continue;
        deco.push({ t, x: x + 0.3 + R() * 0.4, y: y + 0.3 + R() * 0.4, s: 0.8 + R() * 0.5, v: R() });
        if (bloquea) bloq[id(x, y)] = 1;
        reservado[id(x, y)] = 1;
        break;
      }
    }
  };
  poner("arbol", 170); poner("hongo", 80); poner("cristal", 36); poner("roca", 40); poner("arbusto", 90, false);

  // Flores y pasto (solo suelo, no bloquean)
  const flores = [];
  for (let i = 0; i < 900; i++) {
    const x = R() * N, y = R() * N;
    if (!enIsla(x, y, 1) || bloq[id(Math.floor(x), Math.floor(y))]) continue;
    flores.push({ x, y, t: R() < 0.55 ? "pasto" : "flor", c: Math.floor(R() * 5), s: 0.7 + R() * 0.6 });
  }
  // Manchas de pasto para dar textura
  const manchas = [];
  for (let i = 0; i < 140; i++) {
    const x = R() * N, y = R() * N;
    if (enIsla(x, y, 3)) manchas.push({ x, y, r: 1.5 + R() * 3.5, claro: R() > 0.5 });
  }
  // Contorno de la isla
  const contorno = [];
  for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2, r = radioIsla(a) - 0.4; contorno.push({ x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r }); }

  return { N, bloq, edificios, plazas, centros, caminos, granjas, letreros, estanques, deco, flores, manchas, contorno, vallas };
}
