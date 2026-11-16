// Mundo isométrico de Weedland: isla flotante orgánica, edificios redondos y mágicos,
// partículas (hojitas, destellos) y navegación por toque. Canvas 2D, sin dependencias.
import { N, C } from "./mapa.js";

const TW = 96, TH = 48;
const iso = (x, y) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 });
const RX = TW / Math.SQRT2, RY = TH / Math.SQRT2; // radio de un círculo de 1 casilla en pantalla

// ---------- color ----------
function rgb(c) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
  if (m) return [+m[1], +m[2], +m[3]];
  const h = c.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function tono(c, f) {
  const [r, g, b] = rgb(c);
  const m = (v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
export function alfa(c, a) { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; }
export function esClaro(c) { const [r, g, b] = rgb(c); return (r * 299 + g * 587 + b * 114) / 1000 > 140; }

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function estrella(ctx, x, y, r, puntas = 4) {
  ctx.beginPath();
  for (let i = 0; i < puntas * 2; i++) {
    const a = (i / (puntas * 2)) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.38 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

// Hoja palmeada estilizada (7 foliolos)
export function hojaPalmeada(ctx, x, y, size, color, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color;
  for (let i = -3; i <= 3; i++) {
    const len = size * (1 - Math.abs(i) * 0.17);
    ctx.save(); ctx.rotate(i * 0.36);
    ctx.beginPath(); ctx.ellipse(0, -len / 2, len * 0.15, len / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
const sprites = {};
function spriteHoja(color) {
  if (sprites[color]) return sprites[color];
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  x.shadowColor = color; x.shadowBlur = 8;
  hojaPalmeada(x, 32, 50, 40, color);
  x.fillStyle = tono(color, -0.3); x.fillRect(31, 46, 2, 14);
  return (sprites[color] = c);
}

// ---------- personaje ----------
export function dibujarPersona(ctx, x, y, look, fase = 0, dir = 1, andando = false, salto = 0) {
  const sw = andando ? Math.sin(fase) : 0;
  const bob = (andando ? -Math.abs(Math.sin(fase)) * 2 : 0) - salto;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.ellipse(0, 0, 13 - salto * 0.2, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, bob);
  ctx.fillStyle = "#2a2340";
  rrect(ctx, -8, -17 + Math.max(0, sw) * 3, 6, 16 - Math.max(0, sw) * 3, 3); ctx.fill();
  rrect(ctx, 2, -17 + Math.max(0, -sw) * 3, 6, 16 - Math.max(0, -sw) * 3, 3); ctx.fill();
  ctx.fillStyle = tono(look.ropa, -0.2);
  ctx.beginPath(); ctx.ellipse(-12, -27 + sw * 2, 3.5, 8, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(12, -27 - sw * 2, 3.5, 8, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = look.ropa; rrect(ctx, -11, -38, 22, 24, 9); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.18)"; rrect(ctx, -8, -36, 7, 10, 4); ctx.fill();
  ctx.fillStyle = look.piel; ctx.beginPath(); ctx.arc(0, -49, 11.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = look.pelo;
  ctx.beginPath(); ctx.arc(0, -51, 12, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-dir * 8, -50, 4.5, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1b1430";
  ctx.beginPath(); ctx.arc(dir * 2 - 3.5, -48, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(dir * 2 + 3.5, -48, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,120,120,.35)";
  ctx.beginPath(); ctx.arc(dir * 2 - 6, -44, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(dir * 2 + 6, -44, 2.4, 0, Math.PI * 2); ctx.fill();
  if (look.gorra) {
    ctx.fillStyle = tono(look.ropa, -0.35);
    ctx.beginPath(); ctx.arc(0, -53, 12.5, Math.PI, 0); ctx.fill();
    rrect(ctx, dir > 0 ? 2 : -18, -55, 16, 4, 2); ctx.fill();
  }
  ctx.restore();
}

// ---------- mundo ----------
export function crearMundo(canvas, cfg) {
  const ctx = canvas.getContext("2d");
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mapa = cfg.mapa;
  const bloq = mapa.bloq;
  const id = (x, y) => y * N + x;
  const dentro = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  let W = 0, H = 0, dpr = 1;
  let info = cfg.info; // id -> { nombre, color, plantilla, tipo }

  const parcelas = [];
  for (const g of mapa.granjas) g.plots.forEach((p, i) => parcelas.push({ dueno: g.dueno, i, x: p.x, y: p.y }));
  const parcelaEn = (x, y) => parcelas.find((p) => p.x === x && p.y === y);

  // ---------- cámara ----------
  const inicio = { x: C.x + 0.5, y: C.y + 3.5 };
  const cam = { x: iso(inicio.x, inicio.y).x, y: iso(inicio.x, inicio.y).y, z: 1 };
  let seguir = true;
  function ajustar() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (!cam.listo) { cam.z = W < 600 ? 0.72 : 0.9; cam.listo = true; }
  }
  window.addEventListener("resize", ajustar);
  ajustar();

  // ---------- entidades ----------
  const yo = { x: inicio.x, y: inicio.y, ruta: [], fase: 0, dir: 1, vel: 6.5, look: cfg.look, alLlegar: null, salto: 0 };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const lookAzar = () => ({ piel: pick(cfg.looks.pieles), pelo: pick(cfg.looks.pelos), ropa: pick(cfg.looks.ropas), gorra: Math.random() > 0.6 });
  const npcs = [];
  for (let i = 0; i < 28; i++) {
    let x, y, k = 0;
    const p = i < 8 ? mapa.plazas[0] : mapa.plazas[1 + (i % 4)];
    do { x = Math.floor(p.x + (Math.random() - 0.5) * 12); y = Math.floor(p.y + (Math.random() - 0.5) * 12); k++; } while ((!dentro(x, y) || bloq[id(x, y)]) && k < 50);
    if (k < 50) npcs.push({ x: x + 0.5, y: y + 0.5, ruta: [], fase: 0, dir: 1, vel: 1.7, espera: Math.random() * 4, look: lookAzar() });
  }
  const granjeros = mapa.letreros.filter((l) => l.dueno !== "yo").map((l) => {
    const v = cfg.vecinos.find((x) => x.id === l.dueno);
    return { x: l.x + 1.5, y: l.y + 0.5, look: v.look, nombre: v.nombre, fase: Math.random() * 6, dir: 1, ruta: [], vel: 1.2, espera: 2, casa: { x: l.x + 1, y: l.y } };
  });

  // Personajes que recomiendan marcas (con globito de diálogo)
  const promotores = (cfg.promotores || []).map((pr, i) => {
    const pl = mapa.plazas[i % mapa.plazas.length];
    let x = 0, y = 0, k = 0;
    do {
      const a = Math.random() * Math.PI * 2, r = pl.r + 1.2 + Math.random() * 2;
      x = Math.floor(pl.x + Math.cos(a) * r); y = Math.floor(pl.y + Math.sin(a) * r); k++;
    } while ((!dentro(x, y) || bloq[id(x, y)]) && k < 80);
    return { ...pr, i, x: x + 0.5, y: y + 0.5, casa: { x, y }, fase: 0, dir: 1, ruta: [], vel: 1.3, espera: Math.random() * 3, look: { piel: pick(cfg.looks.pieles), pelo: pick(cfg.looks.pelos), ropa: pr.color, gorra: true } };
  });
  let objetivo = null;

  // ---------- partículas ----------
  const parts = [];
  const COLORES_HOJA = ["#5fd38d", "#c6f36b", "#7fe0a0", "#f2c45a", "#ff9be6", "#8ff7ff"];
  const ambiente = [];
  const pops = new Map(); // parcela -> momento en que se sembró (para animar)

  function emitir(p) { if (parts.length < 500) parts.push(p); }
  function efecto(nombre, tx, ty, color = "#c6f36b") {
    if (quieto) return;
    const o = iso(tx, ty);
    const dorado = nombre === "dorada";
    if (nombre === "cosecha" || dorado) {
      emitir({ k: "pilar", x: o.x, y: o.y, vida: 0, max: 0.9, color: dorado ? "#ffd75e" : "#c6f36b" });
      emitir({ k: "anillo", x: o.x, y: o.y, vida: 0, max: 0.8, r: 10, vr: 220, color: dorado ? "#ffd75e" : "#c6f36b" });
      emitir({ k: "anillo", x: o.x, y: o.y, vida: -0.15, max: 0.8, r: 10, vr: 160, color: "#fff" });
      const n = dorado ? 46 : 30;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 220 + Math.random() * 260;
        emitir({ k: "hoja", x: o.x, y: o.y - 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 520, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, s: 0.35 + Math.random() * 0.45, vida: 0, max: 1.3 + Math.random() * 0.6, color: dorado && i % 2 ? "#f2c45a" : pick(COLORES_HOJA) });
      }
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 200;
        emitir({ k: "chispa", x: o.x, y: o.y - 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 60, g: 60, s: 3 + Math.random() * 4, vida: 0, max: 0.8 + Math.random() * 0.6, color: dorado ? "#fff3a8" : pick(["#fff", "#c6f36b", "#8ff7ff", "#ffe27a"]) });
      }
    } else if (nombre === "siembra") {
      emitir({ k: "anillo", x: o.x, y: o.y, vida: 0, max: 0.6, r: 6, vr: 110, color: "#c6f36b" });
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 70;
        emitir({ k: "polvo", x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 20, g: 0, s: 5 + Math.random() * 6, vida: 0, max: 0.7, color: "#8a6a4a" });
      }
      for (let i = 0; i < 16; i++) emitir({ k: "chispa", x: o.x + (Math.random() - 0.5) * 40, y: o.y, vx: 0, vy: -60 - Math.random() * 90, g: 0, s: 2.5 + Math.random() * 3, vida: -Math.random() * 0.3, max: 0.9, color: pick(["#c6f36b", "#5fd38d", "#fff"]) });
    } else if (nombre === "entrar" || nombre === "teleport") {
      if (nombre === "teleport") emitir({ k: "pilar", x: o.x, y: o.y, vida: 0, max: 0.8, color });
      emitir({ k: "anillo", x: o.x, y: o.y, vida: 0, max: 0.7, r: 8, vr: 150, color });
      for (let i = 0; i < 26; i++) emitir({ k: "orbita", cx: o.x, cy: o.y, a: (i / 26) * Math.PI * 2, r: 50, vida: -i * 0.012, max: 1.1, s: 0.3 + Math.random() * 0.25, color: i % 3 ? color : "#c6f36b" });
      for (let i = 0; i < 18; i++) emitir({ k: "chispa", x: o.x + (Math.random() - 0.5) * 60, y: o.y - Math.random() * 30, vx: 0, vy: -90 - Math.random() * 120, g: 0, s: 2 + Math.random() * 3, vida: 0, max: 1, color: "#fff" });
    } else {
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 120;
        emitir({ k: "chispa", x: o.x, y: o.y - 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 40, s: 2 + Math.random() * 3, vida: 0, max: 0.9, color: pick(["#fff", color, "#ffe27a"]) });
      }
    }
  }

  function actualizarParticulas(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vida += dt;
      if (p.vida > p.max) { parts.splice(i, 1); continue; }
      if (p.vida < 0) continue;
      if (p.k === "hoja" || p.k === "chispa" || p.k === "polvo") {
        p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.k === "hoja") { p.rot += p.vr * dt; p.vx *= 0.985; }
      } else if (p.k === "anillo") p.r += p.vr * dt;
      else if (p.k === "orbita") { p.a += dt * 6; p.r = Math.max(4, p.r - dt * 30); }
    }
    // hojitas que caen del cielo alrededor de la cámara
    const vw = W / cam.z, vh = H / cam.z;
    while (!quieto && ambiente.length < 24) {
      ambiente.push({ x: cam.x + (Math.random() - 0.5) * vw * 1.2, y: cam.y - vh / 2 - Math.random() * vh * 0.6, vx: 10 + Math.random() * 20, vy: 25 + Math.random() * 30, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2, s: 0.22 + Math.random() * 0.25, f: Math.random() * 6, color: pick(COLORES_HOJA), a: 0.35 + Math.random() * 0.35 });
    }
    for (let i = ambiente.length - 1; i >= 0; i--) {
      const h = ambiente[i];
      h.f += dt; h.x += (h.vx + Math.sin(h.f * 1.5) * 25) * dt; h.y += h.vy * dt; h.rot += h.vr * dt;
      if (h.y > cam.y + vh / 2 + 40 || Math.abs(h.x - cam.x) > vw) ambiente.splice(i, 1);
    }
  }

  function dibujarParticulas() {
    ctx.save();
    for (const h of ambiente) {
      const sp = spriteHoja(h.color);
      ctx.globalAlpha = h.a;
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot); ctx.scale(h.s, h.s); ctx.drawImage(sp, -32, -50); ctx.restore();
    }
    for (const p of parts) {
      if (p.vida < 0) continue;
      const k = p.vida / p.max, a = 1 - k;
      if (p.k === "hoja") {
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(p.s, p.s); ctx.drawImage(spriteHoja(p.color), -32, -50); ctx.restore();
      } else if (p.k === "chispa") {
        ctx.globalAlpha = a; ctx.fillStyle = p.color; estrella(ctx, p.x, p.y, p.s * (1 + Math.sin(p.vida * 20) * 0.3));
      } else if (p.k === "polvo") {
        ctx.globalAlpha = a * 0.6; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 + k), 0, Math.PI * 2); ctx.fill();
      } else if (p.k === "anillo") {
        ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 4 * a + 1;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r / 2, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (p.k === "pilar") {
        const h = 260, w = 70 * (1 - k * 0.6);
        const g = ctx.createLinearGradient(0, p.y - h, 0, p.y);
        g.addColorStop(0, alfa(p.color, 0)); g.addColorStop(1, alfa(p.color, 0.55 * a));
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(p.x - w / 2, p.y - h, w, h);
      } else if (p.k === "orbita") {
        const x = p.cx + Math.cos(p.a) * p.r * 1.4, y = p.cy - p.vida * 90 + Math.sin(p.a) * p.r * 0.5;
        ctx.globalAlpha = a; ctx.save(); ctx.translate(x, y); ctx.rotate(p.a); ctx.scale(p.s, p.s); ctx.drawImage(spriteHoja(p.color), -32, -50); ctx.restore();
      }
    }
    ctx.restore();
  }

  // ---------- caminos (A* con montículo) ----------
  function camino(sx, sy, tx, ty) {
    if (!dentro(tx, ty) || bloq[id(tx, ty)]) return null;
    const total = N * N, g = new Float32Array(total).fill(Infinity), prev = new Int32Array(total).fill(-1), cerrado = new Uint8Array(total);
    const h = (i) => { const dx = Math.abs((i % N) - tx), dy = Math.abs(((i / N) | 0) - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const heap = [], f = [];
    const push = (n, pr) => { heap.push(n); f.push(pr); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (f[p] <= f[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [f[p], f[i]] = [f[i], f[p]]; i = p; } };
    const pop = () => { const top = heap[0], ln = heap.pop(), lf = f.pop(); if (heap.length) { heap[0] = ln; f[0] = lf; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && f[l] < f[m]) m = l; if (r < heap.length && f[r] < f[m]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; [f[m], f[i]] = [f[i], f[m]]; i = m; } } return top; };
    const ini = id(sx, sy), fin = id(tx, ty);
    g[ini] = 0; push(ini, h(ini));
    let pasos = 0;
    while (heap.length && pasos++ < 9000) {
      const c = pop();
      if (c === fin) { const r = []; let i = c; while (i !== ini && i !== -1) { r.push({ x: (i % N) + 0.5, y: ((i / N) | 0) + 0.5 }); i = prev[i]; } return r.reverse(); }
      if (cerrado[c]) continue;
      cerrado[c] = 1;
      const cx = c % N, cy = (c / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!dentro(nx, ny) || bloq[id(nx, ny)]) continue;
        if (dx && dy && (bloq[id(cx + dx, cy)] || bloq[id(cx, cy + dy)])) continue;
        const n = id(nx, ny), costo = g[c] + (dx && dy ? 1.414 : 1);
        if (costo < g[n]) { g[n] = costo; prev[n] = c; push(n, costo + h(n)); }
      }
    }
    return null;
  }
  function vecinoLibre(tx, ty, desde = yo) {
    let mejor = null, md = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx, y = ty + dy;
      if (!dentro(x, y) || bloq[id(x, y)]) continue;
      const d = Math.hypot(x + 0.5 - desde.x, y + 0.5 - desde.y) + (dx && dy ? 0.6 : 0);
      if (d < md) { md = d; mejor = { x, y }; }
    }
    return mejor;
  }
  let marca = null;
  function caminarA(tx, ty, alLlegar) {
    let destino = { x: tx, y: ty };
    if (!dentro(tx, ty)) return;
    if (bloq[id(tx, ty)]) destino = vecinoLibre(tx, ty);
    if (!destino) return;
    const sx = Math.floor(yo.x), sy = Math.floor(yo.y);
    if (sx === destino.x && sy === destino.y) { yo.ruta = []; alLlegar && alLlegar(); return; }
    const r = camino(sx, sy, destino.x, destino.y);
    if (!r) return;
    // Viajes largos: salto mágico en vez de caminar tanto
    if (r.length > 22) {
      efecto("teleport", yo.x, yo.y, "#c6f36b");
      yo.x = destino.x + 0.5; yo.y = destino.y + 0.5; yo.ruta = []; seguir = true;
      efecto("teleport", yo.x, yo.y, "#c6f36b");
      cfg.alSaltar && cfg.alSaltar();
      alLlegar && setTimeout(alLlegar, 250);
      return;
    }
    yo.ruta = r; yo.alLlegar = alLlegar || null; seguir = true;
    marca = { x: destino.x + 0.5, y: destino.y + 0.5, t: 0 };
  }

  // ---------- toque ----------
  const ALTO = { hongo: 135, torre: 200, invernadero: 105, carpa: 160, arbol: 175, cabana: 120, cristal: 135, universidad: 200, tallerT: 140 };
  function caja(e) {
    const c = iso(e.x, e.y), rx = e.r * RX, alto = ALTO[info[e.id]?.plantilla] || 130;
    return { x0: c.x - rx * 1.2, x1: c.x + rx * 1.2, y0: c.y - alto - 30, y1: c.y + e.r * RY };
  }
  function aMundo(sx, sy) {
    const r = canvas.getBoundingClientRect();
    return { x: (sx - r.left - W / 2) / cam.z + cam.x, y: (sy - r.top - H / 2) / cam.z + cam.y };
  }
  function tocar(sx, sy) {
    const w = aMundo(sx, sy);
    const gx = Math.floor((w.x / (TW / 2) + w.y / (TH / 2)) / 2), gy = Math.floor((w.y / (TH / 2) - w.x / (TW / 2)) / 2);
    // parcelas primero: vale tocar la tierra o la planta dibujada encima
    const pa = [...parcelas].sort((a, b) => b.x + b.y - (a.x + a.y)).find((q) => {
      const c = iso(q.x + 0.5, q.y + 0.5);
      return Math.abs(w.x - c.x) < RX * 0.6 && w.y > c.y - 75 && w.y < c.y + RY * 0.6;
    }) || parcelaEn(gx, gy);
    if (pa) { caminarA(pa.x, pa.y, () => cfg.alParcela(pa.dueno, pa.i)); return; }
    for (const pr of promotores) {
      const c = iso(pr.x, pr.y);
      if (Math.abs(w.x - c.x) < 26 && w.y < c.y + 10 && w.y > c.y - 100) { pr.dir = c.x > iso(yo.x, yo.y).x ? -1 : 1; cfg.alPromotor && cfg.alPromotor(pr.i); return; }
    }
    for (let i = 0; i < (mapa.vallas || []).length; i++) {
      const c = iso(mapa.vallas[i].x, mapa.vallas[i].y);
      if (Math.abs(w.x - c.x) < 76 && w.y > c.y - 150 && w.y < c.y + 6) { cfg.alValla && cfg.alValla(i); return; }
    }
    const orden = [...mapa.edificios].sort((a, b) => b.x + b.y - (a.x + a.y));
    for (const e of orden) { const b = caja(e); if (w.x > b.x0 && w.x < b.x1 && w.y > b.y0 && w.y < b.y1) { irA(e.id); return; } }
    for (const c of mapa.centros) {
      const p = iso(c.x, c.y);
      if (Math.abs(w.x - p.x) < 70 && w.y < p.y + 20 && w.y > p.y - 170) { caminarA(Math.floor(c.x), Math.floor(c.y)); cfg.alCentro && cfg.alCentro(c); return; }
    }
    const le = mapa.letreros.find((l) => l.x === gx && l.y === gy);
    if (le) { caminarA(gx, gy, () => cfg.alLetrero && cfg.alLetrero(le.dueno)); return; }
    caminarA(gx, gy);
  }

  const punteros = new Map();
  let arrastre = null, pinza = null;
  const distPinza = () => { const [a, b] = [...punteros.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  canvas.addEventListener("pointerdown", (e) => {
    if (e.isPrimary) { punteros.clear(); pinza = null; } // limpia punteros que se quedaron pegados
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 1) arrastre = { x0: e.clientX, y0: e.clientY, cx: cam.x, cy: cam.y, movio: false };
    else if (punteros.size === 2) { pinza = { d0: distPinza(), z0: cam.z }; arrastre = null; }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!punteros.has(e.pointerId)) return;
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinza && punteros.size === 2) { cam.z = Math.min(1.6, Math.max(0.35, pinza.z0 * distPinza() / pinza.d0)); return; }
    if (arrastre) {
      const dx = e.clientX - arrastre.x0, dy = e.clientY - arrastre.y0;
      if (!arrastre.movio && Math.hypot(dx, dy) > 9) { arrastre.movio = true; seguir = false; }
      if (arrastre.movio) { cam.x = arrastre.cx - dx / cam.z; cam.y = arrastre.cy - dy / cam.z; }
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (arrastre && !arrastre.movio && !pinza) tocar(e.clientX, e.clientY);
    punteros.delete(e.pointerId);
    if (punteros.size < 2) pinza = null;
    arrastre = null;
  });
  canvas.addEventListener("pointercancel", (e) => { punteros.delete(e.pointerId); arrastre = null; pinza = null; });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); cam.z = Math.min(1.6, Math.max(0.35, cam.z * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });

  // ---------- movimiento ----------
  function mover(ent, dt) {
    if (!ent.ruta.length) return false;
    const obj = ent.ruta[0], dx = obj.x - ent.x, dy = obj.y - ent.y, d = Math.hypot(dx, dy), paso = ent.vel * dt;
    if (Math.abs(dx - dy) > 0.01) ent.dir = dx - dy > 0 ? 1 : -1;
    if (d <= paso) { ent.x = obj.x; ent.y = obj.y; ent.ruta.shift(); } else { ent.x += (dx / d) * paso; ent.y += (dy / d) * paso; }
    ent.fase += dt * 12;
    return true;
  }
  function actualizar(dt) {
    const antes = yo.ruta.length;
    mover(yo, dt);
    if (antes && !yo.ruta.length) { marca = null; const cb = yo.alLlegar; yo.alLlegar = null; cb && cb(); }
    if (yo.salto > 0) yo.salto = Math.max(0, yo.salto - dt * 60);
    for (const n of [...npcs, ...granjeros, ...promotores]) {
      if (!mover(n, dt)) {
        n.espera -= dt;
        if (n.espera <= 0) {
          n.espera = 3 + Math.random() * 6;
          const radio = n.casa ? 2 : 5;
          const bx = n.casa ? n.casa.x : Math.floor(n.x), by = n.casa ? n.casa.y : Math.floor(n.y);
          const r = camino(Math.floor(n.x), Math.floor(n.y), bx + Math.round((Math.random() - 0.5) * radio * 2), by + Math.round((Math.random() - 0.5) * radio * 2));
          if (r) n.ruta = r.slice(0, 12);
        }
      }
    }
    if (seguir) {
      const p = iso(yo.x, yo.y), k = quieto ? 1 : Math.min(1, dt * 5);
      cam.x += (p.x - cam.x) * k; cam.y += (p.y - 40 - cam.y) * k;
    }
    cam.x = Math.max(-N * TW / 2, Math.min(N * TW / 2, cam.x));
    cam.y = Math.max(0, Math.min(N * TH, cam.y));
    if (marca) marca.t += dt;
    actualizarParticulas(dt);
  }

  // ---------- dibujo del suelo ----------
  const proy = (pts) => pts.map((p) => iso(p.x, p.y));
  const contorno = proy(mapa.contorno);
  const caminosP = mapa.caminos.map(proy);
  function trazo(pts) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); }
  function elipseTiles(cx, cy, rx, ry, pasos = 36) {
    const pts = [];
    for (let i = 0; i < pasos; i++) { const a = (i / pasos) * Math.PI * 2; pts.push(iso(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry)); }
    return pts;
  }
  const estanquesP = mapa.estanques.map((e) => ({ ...e, pts: elipseTiles(e.x, e.y, e.rx, e.ry), c: iso(e.x, e.y) }));
  const COLORES_FLOR = ["#ff9be6", "#8ff7ff", "#ffe27a", "#c9a2ff", "#ffffff"];

  function visible(p, m = 200) {
    const vw = W / cam.z / 2 + m, vh = H / cam.z / 2 + m;
    return Math.abs(p.x - cam.x) < vw && Math.abs(p.y - cam.y) < vh + 120;
  }

  function dibujarSuelo(t) {
    // acantilado en capas
    for (const [d, col] of [[70, "#1c1230"], [48, "#2e1f45"], [26, "#45305c"]]) {
      ctx.beginPath(); contorno.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + d) : ctx.moveTo(p.x, p.y + d))); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
    }
    // raíces y cristales colgando del borde frontal
    for (let i = 0; i < contorno.length; i += 4) {
      const p = contorno[i];
      if (p.y < iso(C.x, C.y).y + 200) continue;
      const largo = 30 + ((i * 37) % 50);
      ctx.strokeStyle = "rgba(90,60,110,.8)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x, p.y + 60); ctx.quadraticCurveTo(p.x + 8, p.y + 60 + largo / 2, p.x - 4, p.y + 60 + largo); ctx.stroke();
      if (i % 12 === 0) { ctx.fillStyle = `rgba(143,247,255,${0.5 + Math.sin(t * 2 + i) * 0.3})`; estrella(ctx, p.x - 4, p.y + 64 + largo, 4); }
    }
    // pasto
    const cc = iso(C.x, C.y);
    const g = ctx.createRadialGradient(cc.x, cc.y, 50, cc.x, cc.y, N * TW * 0.5);
    g.addColorStop(0, "#2f7a5a"); g.addColorStop(0.7, "#24614b"); g.addColorStop(1, "#1c4a3c");
    ctx.beginPath(); contorno.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "rgba(198,243,107,.35)"; ctx.lineWidth = 3; ctx.stroke();
    for (const m of mapa.manchas) {
      const p = iso(m.x, m.y);
      if (!visible(p, 300)) continue;
      ctx.fillStyle = m.claro ? "rgba(140,230,160,.07)" : "rgba(0,30,20,.12)";
      ctx.beginPath(); ctx.ellipse(p.x, p.y, m.r * RX, m.r * RY, 0, 0, Math.PI * 2); ctx.fill();
    }
    // granjas: pasto más claro y cerca de madera
    for (const gr of mapa.granjas) {
      const r = gr.rect, pts = [iso(r.x, r.y), iso(r.x + r.w, r.y), iso(r.x + r.w, r.y + r.h), iso(r.x, r.y + r.h)];
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      ctx.fillStyle = gr.dueno === "yo" ? "rgba(198,243,107,.16)" : "rgba(255,230,160,.08)"; ctx.fill();
      ctx.strokeStyle = "#8a6440"; ctx.lineWidth = 3; ctx.stroke();
      for (let k = 0; k < 4; k++) { const a = pts[k], b = pts[(k + 1) % 4]; for (let s = 0; s <= 1.001; s += 0.2) { const x = a.x + (b.x - a.x) * s, y = a.y + (b.y - a.y) * s; ctx.fillStyle = "#6e4c2e"; ctx.fillRect(x - 2, y - 12, 4, 12); } }
    }
    // caminos de piedra
    ctx.lineJoin = ctx.lineCap = "round";
    for (const pts of caminosP) { trazo(pts); ctx.strokeStyle = "#3d3460"; ctx.lineWidth = 50; ctx.stroke(); }
    for (const pts of caminosP) { trazo(pts); ctx.strokeStyle = "#6b5f98"; ctx.lineWidth = 40; ctx.stroke(); }
    for (const pts of caminosP) { trazo(pts); ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 6; ctx.setLineDash([2, 18]); ctx.stroke(); }
    ctx.setLineDash([]);
    // plazas
    for (const pl of mapa.plazas) {
      const p = iso(pl.x, pl.y);
      if (!visible(p, pl.r * RX + 50)) continue;
      const rx = pl.r * RX, ry = pl.r * RY;
      ctx.fillStyle = "#3d3460"; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, rx + 6, ry + 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7466a6"; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.lineWidth = 2;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * k / 4, ry * k / 4, 0, 0, Math.PI * 2); ctx.stroke(); }
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * rx * 0.25, p.y + Math.sin(a) * ry * 0.25); ctx.lineTo(p.x + Math.cos(a) * rx, p.y + Math.sin(a) * ry); ctx.stroke(); }
      const brillo = quieto ? 0.6 : 0.45 + Math.sin(t * 1.5 + pl.x) * 0.2;
      ctx.strokeStyle = alfa(pl.color, brillo); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      // runas que giran
      if (!quieto) for (let k = 0; k < 8; k++) {
        const a = t * 0.3 + (k / 8) * Math.PI * 2;
        ctx.fillStyle = alfa(pl.color, 0.8); estrella(ctx, p.x + Math.cos(a) * rx * 0.88, p.y + Math.sin(a) * ry * 0.88, 4);
      }
    }
    // estanques
    for (const e of estanquesP) {
      if (!visible(e.c, 200)) continue;
      ctx.beginPath(); e.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + 5) : ctx.moveTo(p.x, p.y + 5))); ctx.closePath(); ctx.fillStyle = "#2a2148"; ctx.fill();
      ctx.beginPath(); e.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      const ag = ctx.createRadialGradient(e.c.x, e.c.y, 5, e.c.x, e.c.y, e.rx * RX);
      ag.addColorStop(0, "#5ad8e6"); ag.addColorStop(1, "#2a6f9a");
      ctx.fillStyle = ag; ctx.fill(); ctx.strokeStyle = "#a6f0ff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const r = ((t * 20 + k * 25) % 75);
        ctx.globalAlpha = quieto ? 0.3 : 1 - r / 75;
        ctx.beginPath(); ctx.ellipse(e.c.x + (k - 1) * 30, e.c.y + (k % 2) * 10, r, r / 2, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (let k = 0; k < 4; k++) {
        const lx = e.c.x + Math.cos(k * 1.7) * e.rx * RX * 0.5, ly = e.c.y + Math.sin(k * 1.7) * e.ry * RY * 0.5;
        ctx.fillStyle = "#3fae74"; ctx.beginPath(); ctx.ellipse(lx, ly, 13, 6, 0, 0.3, Math.PI * 2); ctx.fill();
        if (k % 2 === 0) { ctx.fillStyle = "#ff9be6"; ctx.beginPath(); ctx.arc(lx + 3, ly - 3, 4, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    // flores y pasto
    for (const f of mapa.flores) {
      const p = iso(f.x, f.y);
      if (!visible(p, 40)) continue;
      if (f.t === "pasto") {
        ctx.strokeStyle = "rgba(150,230,170,.35)"; ctx.lineWidth = 2;
        const s = 6 * f.s, m = quieto ? 0 : Math.sin(t * 2 + f.x) * 2;
        ctx.beginPath(); ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x - 5 + m, p.y - s); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + m, p.y - s * 1.4); ctx.moveTo(p.x + 3, p.y); ctx.lineTo(p.x + 5 + m, p.y - s); ctx.stroke();
      } else {
        ctx.fillStyle = "#3d8a5a"; ctx.fillRect(p.x - 1, p.y - 8 * f.s, 2, 8 * f.s);
        ctx.fillStyle = COLORES_FLOR[f.c];
        const r = 3.2 * f.s;
        for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * r, p.y - 9 * f.s + Math.sin(a) * r, r * 0.7, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "#ffe27a"; ctx.beginPath(); ctx.arc(p.x, p.y - 9 * f.s, r * 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    // parcelas (tierra)
    for (const pa of parcelas) {
      const p = iso(pa.x + 0.5, pa.y + 0.5);
      if (!visible(p, 80)) continue;
      const bloqueada = pa.dueno === "yo" && cfg.bloqueada(pa.i);
      ctx.fillStyle = "#2d1c12"; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, RX * 0.62, RY * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = bloqueada ? "#3a2c3a" : "#5a3a24"; ctx.beginPath(); ctx.ellipse(p.x, p.y, RX * 0.6, RY * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 2;
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.ellipse(p.x, p.y + k * 7, RX * 0.42 * (1 - Math.abs(k) * 0.25), 3, 0, 0, Math.PI); ctx.stroke(); }
      if (bloqueada) { ctx.font = "20px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🔒", p.x, p.y - 4); }
      else if (pa.dueno === "yo" && !cfg.planta("yo", pa.i)) {
        const a = quieto ? 0.5 : 0.35 + Math.sin(t * 3 + pa.i) * 0.25;
        ctx.strokeStyle = `rgba(198,243,107,${a})`; ctx.lineWidth = 2.5; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, RX * 0.6, RY * 0.6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = `rgba(198,243,107,${a + 0.2})`; ctx.font = "800 22px Nunito, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("+", p.x, p.y);
      }
    }
    // tapetes de luz en las puertas
    for (const e of mapa.edificios) {
      const p = iso(e.puerta.x + 0.5, e.puerta.y + 0.5);
      if (!visible(p, 60)) continue;
      brillo(p.x, p.y, 34, alfa(info[e.id]?.color || "#c6f36b", quieto ? 0.35 : 0.22 + Math.sin(t * 2.4 + e.x) * 0.12));
    }
    if (marca) {
      const p = iso(marca.x, marca.y), k = (marca.t * 1.4) % 1;
      ctx.strokeStyle = `rgba(198,243,107,${1 - k})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 10 + k * 18, (10 + k * 18) / 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function brillo(x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- piezas de edificios ----------
  function cilindro(cx, cy, rx, ry, h, claro, oscuro) {
    const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, claro); g.addColorStop(0.35, claro); g.addColorStop(1, oscuro);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy - h); ctx.lineTo(cx - rx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, cy - h);
    ctx.ellipse(cx, cy - h, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function puerta(cx, by, color, t, ancho = 20, alto = 30) {
    ctx.fillStyle = "#1d1233";
    ctx.beginPath(); ctx.moveTo(cx - ancho / 2, by); ctx.lineTo(cx - ancho / 2, by - alto + ancho / 2); ctx.arc(cx, by - alto + ancho / 2, ancho / 2, Math.PI, 0); ctx.lineTo(cx + ancho / 2, by); ctx.closePath(); ctx.fill();
    const a = quieto ? 0.6 : 0.45 + Math.sin(t * 2) * 0.12;
    ctx.fillStyle = `rgba(255,205,130,${a})`;
    ctx.beginPath(); ctx.moveTo(cx - ancho / 2 + 3, by); ctx.lineTo(cx - ancho / 2 + 3, by - alto + ancho / 2); ctx.arc(cx, by - alto + ancho / 2, ancho / 2 - 3, Math.PI, 0); ctx.lineTo(cx + ancho / 2 - 3, by); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, by - alto + ancho / 2, ancho / 2 + 2, Math.PI, 0); ctx.stroke();
  }
  function ventana(x, y, r, t, k = 0) {
    ctx.fillStyle = "#2a1c40"; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,214,138,${quieto ? 0.85 : 0.7 + Math.sin(t * 1.3 + k) * 0.15})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(42,28,64,.7)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  }
  function banderin(x, y, color, t) {
    ctx.strokeStyle = "#3a2c50"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 30); ctx.stroke();
    const o = quieto ? 0 : Math.sin(t * 4) * 4;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.quadraticCurveTo(x + 12, y - 28 + o, x + 24, y - 24 + o); ctx.lineTo(x, y - 18); ctx.closePath(); ctx.fill();
  }

  function dibujarEdificio(e, t) {
    const c = iso(e.x, e.y);
    if (!visible(c, 260)) return;
    const d = info[e.id] || { color: "#c6f36b", plantilla: "cabana", nombre: e.id };
    const col = d.color, est = d.plantilla, rx = e.r * RX, ry = e.r * RY;
    // sombra
    ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(c.x + 14, c.y + 6, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2); ctx.fill();
    let cima = c.y - 120;
    if (est === "hongo") {
      const h = 58;
      cilindro(c.x, c.y, rx * 0.6, ry * 0.6, h, "#f6ead2", "#c4ad86");
      puerta(c.x, c.y + ry * 0.6 - 2, col, t);
      ventana(c.x + rx * 0.33, c.y - 36, 7, t, 1);
      const cy = c.y - h, crx = rx * 1.12;
      ctx.fillStyle = tono(col, -0.35); ctx.beginPath(); ctx.ellipse(c.x, cy + 4, crx, ry * 1.1, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(c.x - crx * 0.3, cy - 55, 5, c.x, cy - 20, crx * 1.1);
      g.addColorStop(0, tono(col, 0.5)); g.addColorStop(0.5, col); g.addColorStop(1, tono(col, -0.3));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, cy, crx, 74, 0, Math.PI, 0); ctx.ellipse(c.x, cy, crx, ry * 1.1, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.85)";
      for (const [dx, dy, r] of [[-0.5, -30, 9], [0.1, -52, 11], [0.55, -26, 8], [-0.15, -14, 6], [0.35, -58, 5], [-0.62, -8, 5]]) { ctx.beginPath(); ctx.ellipse(c.x + dx * crx, cy + dy, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
      cima = cy - 74;
    } else if (est === "torre") {
      const h = 100, trx = rx * 0.66;
      cilindro(c.x, c.y, trx, ry * 0.66, h, tono(col, 0.6), tono(col, -0.05));
      ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 1.5;
      for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.ellipse(c.x, c.y - (h * k) / 6, trx, ry * 0.66, 0, 0, Math.PI); ctx.stroke(); }
      puerta(c.x, c.y + ry * 0.66 - 2, tono(col, -0.3), t);
      ventana(c.x - trx * 0.4, c.y - 62, 7, t, 2); ventana(c.x + trx * 0.45, c.y - 78, 6, t, 3);
      const base = c.y - h, ap = base - 88;
      ctx.fillStyle = tono(col, -0.4); ctx.beginPath(); ctx.ellipse(c.x, base, trx * 1.3, ry * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createLinearGradient(c.x - trx, 0, c.x + trx, 0);
      g.addColorStop(0, tono(col, 0.25)); g.addColorStop(1, tono(col, -0.35));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(c.x - trx * 1.3, base); ctx.lineTo(c.x, ap); ctx.lineTo(c.x + trx * 1.3, base); ctx.ellipse(c.x, base, trx * 1.3, ry * 0.85, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
      banderin(c.x, ap + 2, tono(col, 0.4), t);
      cima = ap - 32;
    } else if (est === "invernadero" || est === "universidad") {
      const uni = est === "universidad";
      const baseH = uni ? 70 : 14, dome = uni ? 70 : 92;
      if (uni) {
        cilindro(c.x, c.y, rx * 0.8, ry * 0.8, baseH, "#f3ead6", "#bfae8c");
        for (let k = -3; k <= 3; k++) { const x = c.x + (k / 3.5) * rx * 0.8; ctx.fillStyle = "#fffaf0"; ctx.fillRect(x - 3, c.y - baseH + 6, 6, baseH - 6 + Math.sqrt(Math.max(0, 1 - (k / 3.5) ** 2)) * ry * 0.8 - 4); }
        puerta(c.x, c.y + ry * 0.8 - 2, "#3f4f99", t, 26, 40);
      } else {
        cilindro(c.x, c.y, rx, ry, baseH, "#8e86a8", "#5a5278");
        for (let k = -2; k <= 2; k++) hojaPalmeada(ctx, c.x + k * rx * 0.32, c.y - baseH - 6 - (2 - Math.abs(k)) * 10, 30 + (2 - Math.abs(k)) * 8, k % 2 ? "#3fae74" : "#58c98a", k * 0.2);
      }
      const drx = uni ? rx * 0.82 : rx, top = c.y - baseH;
      if (uni) {
        const g = ctx.createRadialGradient(c.x - drx * 0.3, top - dome * 0.6, 5, c.x, top, drx);
        g.addColorStop(0, "#9fb0ff"); g.addColorStop(1, "#2f3d86");
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, top, drx, dome, 0, Math.PI, 0); ctx.ellipse(c.x, top, drx, ry * 0.82, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = `rgba(255,226,122,${quieto ? 1 : 0.7 + Math.sin(t * 2) * 0.3})`; estrella(ctx, c.x, top - dome - 12, 12, 5);
        ctx.font = "26px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("📖", c.x, top - dome * 0.45);
      } else {
        ctx.fillStyle = "rgba(190,255,235,.22)"; ctx.beginPath(); ctx.ellipse(c.x, top, drx, dome, 0, Math.PI, 0); ctx.ellipse(c.x, top, drx, ry, 0, 0, Math.PI); ctx.fill();
        ctx.strokeStyle = alfa(col, 0.95); ctx.lineWidth = 2.5;
        for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(c.x, top, drx * (k / 3.3), dome, 0, Math.PI, 0); ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(c.x, top, drx, dome, 0, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(c.x, top - dome * 0.5, drx * 0.87, ry * 0.7, 0, 0, Math.PI); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(c.x - drx * 0.2, top - dome * 0.25, drx * 0.6, dome * 0.7, 0, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(c.x, top - dome - 16); ctx.lineTo(c.x + 7, top - dome - 4); ctx.lineTo(c.x, top - dome + 2); ctx.lineTo(c.x - 7, top - dome - 4); ctx.closePath(); ctx.fill();
        brillo(c.x, top - dome - 6, 22, alfa(col, 0.45));
        puerta(c.x, c.y + ry - 2, col, t);
      }
      cima = top - dome - 22;
    } else if (est === "carpa") {
      const fy = c.y - 34, ap = c.y - 150, n = 10;
      const P = (a, y) => ({ x: c.x + Math.cos(a) * rx, y: y + Math.sin(a) * ry });
      ctx.fillStyle = tono(col, -0.45); ctx.beginPath(); ctx.moveTo(c.x - rx, fy); ctx.lineTo(c.x, ap); ctx.lineTo(c.x + rx, fy); ctx.closePath(); ctx.fill();
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI;
        const p0 = P(a0, c.y), p1 = P(a1, c.y), q0 = P(a0, fy), q1 = P(a1, fy);
        ctx.fillStyle = i % 2 ? "#fff6ea" : col;
        ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p0.x, p0.y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = i % 2 ? tono(col, -0.1) : "#fff";
        ctx.beginPath(); ctx.moveTo(c.x, ap); ctx.lineTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = i % 2 ? col : "#fff6ea";
        ctx.beginPath(); ctx.arc((q0.x + q1.x) / 2, (q0.y + q1.y) / 2, Math.hypot(q1.x - q0.x, q1.y - q0.y) / 2, 0, Math.PI); ctx.fill();
      }
      ctx.fillStyle = "#1d1233"; ctx.beginPath(); ctx.moveTo(c.x - 16, c.y + ry - 1); ctx.lineTo(c.x, c.y + ry - 44); ctx.lineTo(c.x + 16, c.y + ry - 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,205,130,${quieto ? 0.6 : 0.4 + Math.sin(t * 2) * 0.15})`; ctx.beginPath(); ctx.moveTo(c.x - 11, c.y + ry - 1); ctx.lineTo(c.x, c.y + ry - 36); ctx.lineTo(c.x + 11, c.y + ry - 1); ctx.closePath(); ctx.fill();
      for (let i = 0; i <= 12; i++) {
        const p = P((i / 12) * Math.PI, fy - 2), on = quieto || (Math.floor(t * 4) + i) % 2;
        ctx.fillStyle = on ? "#fff3a8" : "#7a6a40"; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
        if (on && !quieto) brillo(p.x, p.y, 9, "rgba(255,243,168,.5)");
      }
      banderin(c.x, ap + 2, tono(col, 0.3), t);
      cima = ap - 34;
    } else if (est === "arbol") {
      const h = 72, trx = rx * 0.42;
      cilindro(c.x, c.y, trx, ry * 0.42, h, "#9a6a46", "#5e3b24");
      ctx.strokeStyle = "rgba(0,0,0,.2)"; ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(c.x - trx * 0.6 + k * trx * 0.4, c.y - h); ctx.quadraticCurveTo(c.x - trx * 0.5 + k * trx * 0.4, c.y - h / 2, c.x - trx * 0.7 + k * trx * 0.45, c.y); ctx.stroke(); }
      puerta(c.x, c.y + ry * 0.42 - 2, col, t, 18, 28);
      const cy = c.y - h - 34;
      const verdes = [tono("#2f8a5e", 0), tono(col, -0.35), "#3fae74", tono(col, -0.1)];
      [[-0.55, 10, 0.55], [0.55, 8, 0.55], [0, -18, 0.7], [-0.2, 22, 0.5], [0.3, 26, 0.45]].forEach(([dx, dy, r], k) => {
        ctx.fillStyle = verdes[k % 4]; ctx.beginPath(); ctx.arc(c.x + dx * rx, cy + dy, r * rx, 0, Math.PI * 2); ctx.fill();
      });
      ventana(c.x + rx * 0.15, cy + 4, 9, t, 5);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7, x = c.x + Math.cos(a) * rx * 0.95, y = cy + 10 + Math.sin(a) * 34;
        const on = quieto || (Math.floor(t * 3) + i) % 3;
        ctx.fillStyle = on ? (i % 2 ? "#ffe27a" : col) : "#554"; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
      cima = cy - rx * 0.7 - 8;
    } else if (est === "cabana" || est === "tallerT") {
      const taller = est === "tallerT", h = taller ? 62 : 52, brx = rx * (taller ? 0.82 : 0.85);
      cilindro(c.x, c.y, brx, ry * 0.85, h, "#d9a66e", "#8a5a34");
      ctx.strokeStyle = "rgba(0,0,0,.15)"; ctx.lineWidth = 1.5;
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(c.x, c.y - (h * k) / 4, brx, ry * 0.85, 0, 0, Math.PI); ctx.stroke(); }
      puerta(c.x, c.y + ry * 0.85 - 2, col, t, 22, 34);
      ventana(c.x - brx * 0.55, c.y - 30, 8, t, 6); ventana(c.x + brx * 0.55, c.y - 30, 8, t, 7);
      ctx.fillStyle = "#6e452d"; ctx.fillRect(c.x - brx * 0.7, c.y - 20, 22, 6);
      ctx.fillStyle = "#ff9be6"; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(c.x - brx * 0.7 + 4 + k * 7, c.y - 22, 3, 0, Math.PI * 2); ctx.fill(); }
      const top = c.y - h, rh = taller ? 58 : 66;
      ctx.fillStyle = tono(col, -0.4); ctx.beginPath(); ctx.ellipse(c.x, top + 6, brx * 1.22, ry * 1.05, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(c.x - brx * 0.4, top - rh * 0.7, 4, c.x, top, brx * 1.3);
      g.addColorStop(0, tono(col, 0.35)); g.addColorStop(1, tono(col, -0.3));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, top, brx * 1.2, rh, 0, Math.PI, 0); ctx.ellipse(c.x, top, brx * 1.2, ry * 1.02, 0, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 2;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(c.x, top - (rh * k) / 4, brx * 1.2 * Math.sqrt(1 - (k / 4) ** 2), ry * 0.8, 0, 0.1, Math.PI - 0.1); ctx.stroke(); }
      const chx = c.x + brx * 0.5, chy = top - rh * 0.55;
      ctx.fillStyle = "#6a4a3a"; ctx.fillRect(chx - 7, chy - 26, 14, 26);
      if (!quieto) { for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k / 3) % 1; ctx.fillStyle = `rgba(230,225,255,${0.25 * (1 - ph)})`; ctx.beginPath(); ctx.arc(chx + Math.sin(ph * 6 + k) * 6, chy - 32 - ph * 40, 6 + ph * 9, 0, Math.PI * 2); ctx.fill(); } }
      if (taller) {
        // caldero mágico
        const kx = c.x + rx * 1.05, ky = c.y + ry * 0.6;
        ctx.fillStyle = "#2a2340"; ctx.beginPath(); ctx.ellipse(kx, ky - 14, 24, 18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(150,255,120,${quieto ? 0.9 : 0.75 + Math.sin(t * 3) * 0.2})`; ctx.beginPath(); ctx.ellipse(kx, ky - 26, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
        brillo(kx, ky - 30, 40, "rgba(150,255,120,.35)");
        if (!quieto) for (let k = 0; k < 4; k++) { const ph = (t * 0.8 + k / 4) % 1; ctx.fillStyle = `rgba(190,255,160,${1 - ph})`; ctx.beginPath(); ctx.arc(kx + Math.sin(k * 2 + t) * 10, ky - 30 - ph * 40, 3 + ph * 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.font = "24px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⚙️", c.x, top - rh * 0.4);
      }
      cima = top - rh - 10;
    } else if (est === "cristal") {
      ctx.fillStyle = "#3d3456"; ctx.beginPath(); ctx.ellipse(c.x, c.y - 6, rx * 0.9, ry * 0.9 + 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4e4470"; ctx.beginPath(); ctx.ellipse(c.x, c.y - 14, rx * 0.8, ry * 0.75 + 6, 0, Math.PI, 0); ctx.fill();
      const pul = quieto ? 1 : 0.8 + Math.sin(t * 2) * 0.2;
      brillo(c.x, c.y - 70, 110 * pul, alfa(col, 0.28));
      const cristales = [[-0.42, 78, 20, -0.18], [0.45, 70, 18, 0.2], [0, 118, 26, 0], [-0.15, 56, 14, -0.35], [0.22, 50, 12, 0.35]];
      for (const [dx, h, w, inc] of cristales) {
        const bx = c.x + dx * rx, by = c.y - 18, tx = bx + inc * h * 0.5, ty = by - h;
        ctx.fillStyle = tono(col, 0.35); ctx.beginPath(); ctx.moveTo(bx - w / 2, by); ctx.lineTo(tx - w * 0.35, ty + w * 0.6); ctx.lineTo(tx, ty); ctx.lineTo(bx, by + 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = tono(col, -0.25); ctx.beginPath(); ctx.moveTo(bx, by + 4); ctx.lineTo(tx, ty); ctx.lineTo(tx + w * 0.35, ty + w * 0.6); ctx.lineTo(bx + w / 2, by); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, by + 4); ctx.lineTo(tx, ty); ctx.stroke();
      }
      puerta(c.x, c.y + ry * 0.8 + 4, col, t, 20, 30);
      cima = c.y - 18 - 118 - 10;
    }
    // letrero con el nombre
    const z = cam.z, fs = Math.max(13, Math.min(24, 14 / z));
    ctx.font = `700 ${fs}px Fredoka, Nunito, sans-serif`;
    const tw = ctx.measureText(d.nombre).width + fs * 1.4, lh = fs * 1.75, ly = cima - lh - 4;
    ctx.fillStyle = "rgba(0,0,0,.35)"; rrect(ctx, c.x - tw / 2 + 2, ly + 3, tw, lh, lh / 2); ctx.fill();
    ctx.fillStyle = col; rrect(ctx, c.x - tw / 2, ly, tw, lh, lh / 2); ctx.fill();
    ctx.fillStyle = esClaro(col) ? "#160f2b" : "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(d.nombre, c.x, ly + lh / 2 + 1);
    if (d.tipo === "marca" && !cfg.visitados().includes(e.id)) {
      const b = quieto ? 0 : Math.sin(t * 3 + e.x) * 4;
      ctx.fillStyle = "#ffe27a"; estrella(ctx, c.x + tw / 2 + 2, ly - 2 + b, 9);
    }
  }

  // ---------- decoración ----------
  function dibujarDeco(o, t) {
    const p = iso(o.x, o.y);
    if (!visible(p, 120)) return;
    const s = o.s || 1;
    if (o.t === "arbol") {
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 22 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4b3424"; ctx.fillRect(p.x - 4 * s, p.y - 34 * s, 8 * s, 34 * s);
      if (o.v < 0.33) { // árbol redondo con frutos de luz
        ctx.fillStyle = "#1f5a4a"; ctx.beginPath(); ctx.arc(p.x, p.y - 52 * s, 27 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2a7560"; ctx.beginPath(); ctx.arc(p.x - 9 * s, p.y - 61 * s, 16 * s, 0, Math.PI * 2); ctx.fill();
      } else if (o.v < 0.66) { // pino mágico
        for (let k = 0; k < 3; k++) { ctx.fillStyle = k % 2 ? "#245e4e" : "#1c4f42"; ctx.beginPath(); ctx.moveTo(p.x - (26 - k * 6) * s, p.y - (24 + k * 20) * s); ctx.lineTo(p.x, p.y - (62 + k * 20) * s); ctx.lineTo(p.x + (26 - k * 6) * s, p.y - (24 + k * 20) * s); ctx.closePath(); ctx.fill(); }
      } else { // sauce con gotas que brillan
        ctx.fillStyle = "#2b6b5a"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 56 * s, 30 * s, 22 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#3f8f72"; ctx.lineWidth = 3 * s;
        for (let k = -3; k <= 3; k++) { const m = quieto ? 0 : Math.sin(t * 1.5 + k) * 3; ctx.beginPath(); ctx.moveTo(p.x + k * 8 * s, p.y - 46 * s); ctx.quadraticCurveTo(p.x + k * 9 * s + m, p.y - 30 * s, p.x + k * 10 * s + m, p.y - 16 * s); ctx.stroke(); }
      }
      for (let k = 0; k < 3; k++) {
        const a = quieto ? 0.8 : 0.5 + Math.sin(t * 2 + k + o.v * 9) * 0.4;
        ctx.fillStyle = o.v > 0.5 ? `rgba(143,247,255,${a})` : `rgba(255,155,230,${a})`;
        ctx.beginPath(); ctx.arc(p.x + (k - 1) * 13 * s, p.y - (48 + (k % 2) * 12) * s, 2.8, 0, Math.PI * 2); ctx.fill();
      }
    } else if (o.t === "hongo") {
      const cols = ["#ff7ad9", "#8ff7ff", "#ffb35c", "#c9a2ff"], col = cols[Math.floor(o.v * 4)];
      for (const [dx, h, r] of [[-8, 16, 10], [7, 24, 13], [0, 10, 7]]) {
        ctx.fillStyle = "#efe2cc"; ctx.fillRect(p.x + dx * s - 2.5 * s, p.y - h * s, 5 * s, h * s);
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(p.x + dx * s, p.y - h * s, r * s, r * 0.65 * s, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.beginPath(); ctx.arc(p.x + dx * s - r * 0.3 * s, p.y - h * s - r * 0.3 * s, 1.8 * s, 0, Math.PI * 2); ctx.fill();
      }
      brillo(p.x, p.y - 18 * s, 26 * s, alfa(col, quieto ? 0.3 : 0.2 + Math.sin(t * 2 + o.v * 7) * 0.12));
    } else if (o.t === "cristal") {
      const col = o.v > 0.5 ? "#8ff7ff" : "#c9a2ff";
      brillo(p.x, p.y - 18, 30 * s, alfa(col, quieto ? 0.3 : 0.2 + Math.sin(t * 2.5 + o.v * 5) * 0.15));
      for (const [dx, h, w] of [[-6, 22, 8], [5, 30, 10], [0, 14, 6]]) {
        ctx.fillStyle = tono(col, 0.2); ctx.beginPath(); ctx.moveTo(p.x + dx * s - w / 2 * s, p.y); ctx.lineTo(p.x + dx * s, p.y - h * s); ctx.lineTo(p.x + dx * s, p.y + 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = tono(col, -0.3); ctx.beginPath(); ctx.moveTo(p.x + dx * s, p.y + 2); ctx.lineTo(p.x + dx * s, p.y - h * s); ctx.lineTo(p.x + dx * s + w / 2 * s, p.y); ctx.closePath(); ctx.fill();
      }
    } else if (o.t === "roca") {
      ctx.fillStyle = "#4a4560"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 6 * s, 16 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5e5878"; ctx.beginPath(); ctx.ellipse(p.x - 3 * s, p.y - 9 * s, 10 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3fae74"; ctx.beginPath(); ctx.ellipse(p.x + 4 * s, p.y - 14 * s, 8 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
    } else if (o.t === "arbusto") {
      ctx.fillStyle = "#2a6b52"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 9 * s, 17 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#348064"; ctx.beginPath(); ctx.ellipse(p.x - 5 * s, p.y - 13 * s, 10 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORES_FLOR[Math.floor(o.v * 5)];
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(p.x + (k - 1.5) * 7 * s, p.y - (10 + (k % 2) * 6) * s, 2.5 * s, 0, Math.PI * 2); ctx.fill(); }
    } else if (o.t === "farol") {
      ctx.fillStyle = "#2c2540"; ctx.fillRect(p.x - 2.5, p.y - 54, 5, 54);
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 54); ctx.quadraticCurveTo(p.x + 10, p.y - 64, p.x + 14, p.y - 56); ctx.strokeStyle = "#2c2540"; ctx.lineWidth = 3; ctx.stroke();
      brillo(p.x + 14, p.y - 50, 32, `rgba(255,214,138,${quieto ? 0.4 : 0.3 + Math.sin(t * 1.7 + o.x) * 0.07})`);
      ctx.fillStyle = "#ffe3a3"; ctx.beginPath(); ctx.arc(p.x + 14, p.y - 50, 5.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function dibujarCentro(o, t) {
    const p = iso(o.x, o.y);
    if (!visible(p, 260)) return;
    if (o.tipo === "arbolLuz") {
      const pul = quieto ? 1 : 0.85 + Math.sin(t * 1.4) * 0.15;
      brillo(p.x, p.y - 90, 170 * pul, "rgba(198,243,107,.22)");
      ctx.fillStyle = "#4a4170"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 54, 24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3a325c"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 5, 46, 19, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#6a4a3a"; ctx.lineWidth = 13; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 5); ctx.quadraticCurveTo(p.x - 12, p.y - 55, p.x, p.y - 100); ctx.stroke();
      const m = quieto ? 0 : Math.sin(t) * 0.05;
      hojaPalmeada(ctx, p.x - 40, p.y - 92, 64, "#3fae74", -0.8 + m);
      hojaPalmeada(ctx, p.x + 40, p.y - 92, 64, "#3fae74", 0.8 - m);
      hojaPalmeada(ctx, p.x - 22, p.y - 104, 72, "#5fd38d", -0.35 + m);
      hojaPalmeada(ctx, p.x + 22, p.y - 104, 72, "#5fd38d", 0.35 - m);
      hojaPalmeada(ctx, p.x, p.y - 110, 92, "#c6f36b", m);
      for (let k = 0; k < 12; k++) {
        const a = t * 0.6 + k * 0.52, rr = 70 + Math.sin(t + k) * 10;
        ctx.fillStyle = ["#fff3a8", "#8ff7ff", "#ff9be6"][k % 3];
        estrella(ctx, p.x + Math.cos(a) * rr, p.y - 130 + Math.sin(a) * rr * 0.4, quieto ? 3 : 3 + Math.sin(t * 3 + k) * 1.5);
      }
    } else if (o.tipo === "totem") {
      const col = o.color;
      brillo(p.x, p.y - 60, 110, alfa(col, 0.2));
      ctx.fillStyle = "#4a4170"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 36, 17, 0, 0, Math.PI * 2); ctx.fill();
      if (o.zona === "medicinal") { // hongo gigante
        ctx.fillStyle = "#f6ead2"; ctx.fillRect(p.x - 9, p.y - 80, 18, 80);
        const g = ctx.createRadialGradient(p.x - 20, p.y - 120, 5, p.x, p.y - 90, 70);
        g.addColorStop(0, "#f0e2ff"); g.addColorStop(1, col);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y - 80, 62, 50, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.8)"; for (const [dx, dy] of [[-30, -95], [8, -112], [32, -92]]) { ctx.beginPath(); ctx.arc(p.x + dx, p.y + dy, 7, 0, Math.PI * 2); ctx.fill(); }
      } else if (o.zona === "cultivo") { // girasol con hoja
        ctx.strokeStyle = "#3d8a5a"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x, p.y - 110); ctx.stroke();
        hojaPalmeada(ctx, p.x - 22, p.y - 50, 44, "#5fd38d", -1);
        hojaPalmeada(ctx, p.x + 22, p.y - 70, 40, "#7fe0a0", 1);
        const giro = quieto ? 0 : t * 0.4;
        ctx.fillStyle = "#ffd166";
        for (let k = 0; k < 14; k++) { const a = giro + (k / 14) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(p.x + Math.cos(a) * 30, p.y - 125 + Math.sin(a) * 30, 14, 6, a, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "#6e452d"; ctx.beginPath(); ctx.arc(p.x, p.y - 125, 20, 0, Math.PI * 2); ctx.fill();
      } else if (o.zona === "cultura") { // fuente
        ctx.fillStyle = "#8e86a8"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 10, 44, 20, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5ad8e6"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 14, 38, 15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#b9b0d0"; ctx.fillRect(p.x - 6, p.y - 70, 12, 58);
        ctx.fillStyle = "#8e86a8"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 70, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(166,240,255,.85)"; ctx.lineWidth = 3;
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, f = quieto ? 0 : Math.sin(t * 4 + k) * 3; ctx.beginPath(); ctx.moveTo(p.x, p.y - 80); ctx.quadraticCurveTo(p.x + Math.cos(a) * 30, p.y - 110 + f, p.x + Math.cos(a) * 34, p.y - 16 + Math.sin(a) * 12); ctx.stroke(); }
        hojaPalmeada(ctx, p.x, p.y - 84, 30, col, 0);
      } else { // carrusel de la feria
        const giro = quieto ? 0 : t * 0.8;
        ctx.fillStyle = "#fff6ea"; ctx.fillRect(p.x - 4, p.y - 120, 8, 120);
        for (let k = 0; k < 8; k++) {
          const a = giro + (k / 8) * Math.PI * 2, x = p.x + Math.cos(a) * 48, y = p.y - 30 + Math.sin(a) * 20;
          ctx.strokeStyle = ["#ff7ad9", "#6ff0ff", "#f2c45a", "#7dffb3"][k % 4]; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(p.x, p.y - 118); ctx.lineTo(x, y); ctx.stroke();
          ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(p.x - 30, p.y - 112); ctx.lineTo(p.x, p.y - 140); ctx.lineTo(p.x + 30, p.y - 112); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#ffe27a"; estrella(ctx, p.x, p.y - 146, 9, 5);
      }
      // nombre de la zona
      const nombre = cfg.nombreZona(o.zona), fs = Math.max(16, Math.min(30, 18 / cam.z));
      ctx.font = `700 ${fs}px Fredoka, Nunito, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(18,12,36,.85)"; ctx.strokeText(nombre, p.x, p.y - 175);
      ctx.fillStyle = col; ctx.fillText(nombre, p.x, p.y - 175);
    }
  }

  function dibujarLetrero(l) {
    const p = iso(l.x + 0.5, l.y + 0.5);
    if (!visible(p, 100)) return;
    ctx.fillStyle = "#5a3a2a"; ctx.fillRect(p.x - 3, p.y - 40, 6, 40);
    const txt = cfg.textoLetrero(l.dueno);
    ctx.font = "700 14px Fredoka, Nunito, sans-serif";
    const tw = ctx.measureText(txt).width + 20, col = l.dueno === "yo" ? "#c6f36b" : "#ffd8a8";
    ctx.fillStyle = col; rrect(ctx, p.x - tw / 2, p.y - 66, tw, 26, 8); ctx.fill();
    ctx.fillStyle = "#16220e"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, p.x, p.y - 52.5);
  }

  function dibujarPlanta(pa, t) {
    const info2 = cfg.planta(pa.dueno, pa.i);
    if (!info2) return;
    const p = iso(pa.x + 0.5, pa.y + 0.5);
    if (!visible(p, 80)) return;
    const { etapa, color, magia, registrada } = info2;
    const clave = pa.dueno + pa.i;
    const tp = pops.get(clave);
    let esc = 1;
    if (tp != null) { const k = (performance.now() - tp) / 450; if (k >= 1) pops.delete(clave); else esc = 1 + Math.sin(k * Math.PI) * 0.5; }
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(esc, esc);
    const mece = quieto ? 0 : Math.sin(t * 1.6 + pa.i + pa.x) * 0.07;
    const c2 = tono(color, 0.3);
    if (registrada) brillo(0, -16, 34, alfa(registrada, 0.35));
    if (etapa === 1) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(-5, -9, 7, 3.5, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5, -9, 7, 3.5, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = tono(color, -0.3); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.stroke();
    } else {
      const alto = etapa === 2 ? 20 : 34, tam = etapa === 2 ? 18 : 28;
      const lista = etapa === 4;
      const salto = lista && !quieto ? Math.abs(Math.sin(t * 3 + pa.i)) * 4 : 0;
      ctx.translate(0, -salto);
      if (lista) brillo(0, -alto, 46, magia ? "rgba(143,247,255,.5)" : alfa(color, 0.5));
      ctx.strokeStyle = "#3d8a5a"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -alto); ctx.stroke();
      if (etapa >= 3) {
        hojaPalmeada(ctx, -9, -alto * 0.5, tam * 0.7, c2, -0.95 + mece);
        hojaPalmeada(ctx, 9, -alto * 0.5, tam * 0.7, c2, 0.95 + mece);
      }
      hojaPalmeada(ctx, 0, -alto, tam, color, mece);
      if (lista) {
        if (color === "#ffb3e6" || magia) { ctx.fillStyle = magia ? "#ffffff" : "#ffe27a"; ctx.beginPath(); ctx.arc(0, -alto - tam * 0.55, 5, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "#fff6b0";
        estrella(ctx, 16, -alto - 20 + (quieto ? 0 : Math.sin(t * 4 + pa.i) * 3), 7);
        estrella(ctx, -14, -alto - 8 + (quieto ? 0 : Math.cos(t * 4 + pa.i) * 3), 4.5);
      }
      if (registrada) { ctx.fillStyle = registrada; ctx.fillRect(10, -alto + 4, 2, 16); ctx.beginPath(); ctx.moveTo(12, -alto + 4); ctx.lineTo(22, -alto + 8); ctx.lineTo(12, -alto + 12); ctx.closePath(); ctx.fill(); }
    }
    ctx.restore();
  }

  // ---------- vallas publicitarias ----------
  function dibujarValla(v, i, t) {
    const p = iso(v.x, v.y);
    if (!visible(p, 160)) return;
    const ad = cfg.anuncio(i, t);
    if (!ad) return;
    const w = 150, h = 84, x0 = p.x - w / 2, y0 = p.y - 150;
    // patas
    ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 50, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2c2540"; ctx.fillRect(p.x - 46, y0 + h - 4, 7, 150 - h + 4); ctx.fillRect(p.x + 39, y0 + h - 4, 7, 150 - h + 4);
    // giro al cambiar de anuncio
    const flip = quieto ? 1 : Math.min(1, ad.fase / 0.35);
    ctx.save(); ctx.translate(p.x, y0 + h / 2); ctx.scale(Math.max(0.05, flip), 1); ctx.translate(-p.x, -(y0 + h / 2));
    brillo(p.x, y0 + h / 2, 110, alfa(ad.color, 0.25));
    ctx.fillStyle = "#1d1233"; rrect(ctx, x0 - 6, y0 - 6, w + 12, h + 12, 12); ctx.fill();
    const g = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h);
    g.addColorStop(0, tono(ad.color, 0.25)); g.addColorStop(1, tono(ad.color, -0.25));
    ctx.fillStyle = g; rrect(ctx, x0, y0, w, h, 8); ctx.fill();
    const txt = esClaro(ad.color) ? "#160f2b" : "#fff";
    ctx.font = "38px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(ad.icono, x0 + 30, y0 + h / 2 + (quieto ? 0 : Math.sin(t * 3) * 3));
    ctx.fillStyle = txt; ctx.textAlign = "left";
    let fs = 17; ctx.font = `700 ${fs}px Fredoka, Nunito, sans-serif`;
    while (ctx.measureText(ad.nombre).width > w - 62 && fs > 10) { fs--; ctx.font = `700 ${fs}px Fredoka, Nunito, sans-serif`; }
    ctx.fillText(ad.nombre, x0 + 56, y0 + 28);
    fs = 11; ctx.font = `700 ${fs}px Nunito, sans-serif`;
    while (ctx.measureText(ad.lema).width > w - 62 && fs > 8) { fs--; ctx.font = `700 ${fs}px Nunito, sans-serif`; }
    ctx.fillText(ad.lema, x0 + 56, y0 + 48);
    ctx.fillStyle = "#160f2b"; rrect(ctx, x0 + 56, y0 + 58, 64, 18, 9); ctx.fill();
    ctx.fillStyle = "#ffe27a"; ctx.font = "800 10px Nunito, sans-serif"; ctx.fillText(ad.cta, x0 + 63, y0 + 67.5);
    ctx.restore();
    // focos de casino alrededor
    for (let k = 0; k < 18; k++) {
      const per = 2 * (w + h + 24), d = (k / 18) * per;
      let bx, by;
      if (d < w + 12) { bx = x0 - 6 + d; by = y0 - 6; }
      else if (d < w + h + 24) { bx = x0 + w + 6; by = y0 - 6 + (d - w - 12); }
      else if (d < 2 * w + h + 36) { bx = x0 + w + 6 - (d - w - h - 24); by = y0 + h + 6; }
      else { bx = x0 - 6; by = y0 + h + 6 - (d - 2 * w - h - 36); }
      const on = quieto || (Math.floor(t * 5) + k) % 3 !== 0;
      ctx.fillStyle = on ? "#fff3a8" : "#6a5a30"; ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function dibujarPromotor(pr, t) {
    const p = iso(pr.x, pr.y);
    if (!visible(p, 80)) return;
    dibujarPersona(ctx, p.x, p.y, pr.look, pr.fase, pr.dir, pr.ruta.length > 0);
    const b = quieto ? 0 : Math.sin(t * 3 + pr.i) * 4;
    const by = p.y - 98 + b;
    ctx.fillStyle = "#fff"; rrect(ctx, p.x - 20, by - 16, 40, 30, 12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(p.x - 6, by + 13); ctx.lineTo(p.x, by + 22); ctx.lineTo(p.x + 5, by + 13); ctx.fill();
    ctx.font = "18px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(pr.icono || "💬", p.x, by - 1);
    ctx.strokeStyle = pr.color; ctx.lineWidth = 2.5; rrect(ctx, p.x - 20, by - 16, 40, 30, 12); ctx.stroke();
  }

  // Flecha dorada que marca el objetivo de la misión
  function dibujarObjetivo(t) {
    if (!objetivo) return;
    const p = iso(objetivo.x, objetivo.y);
    const k = quieto ? 0 : (t * 1.2) % 1;
    ctx.strokeStyle = `rgba(255,226,122,${1 - k})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 20 + k * 40, (20 + k * 40) / 2, 0, 0, Math.PI * 2); ctx.stroke();
    const b = quieto ? 0 : Math.abs(Math.sin(t * 3.5)) * -18;
    const ay = p.y - (objetivo.alto || 130) + b;
    brillo(p.x, ay, 46, "rgba(255,226,122,.55)");
    ctx.fillStyle = "#ffe27a"; ctx.strokeStyle = "#5a3a00"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x - 13, ay - 30); ctx.lineTo(p.x + 13, ay - 30); ctx.lineTo(p.x + 13, ay - 6); ctx.lineTo(p.x + 26, ay - 6); ctx.lineTo(p.x, ay + 22); ctx.lineTo(p.x - 26, ay - 6); ctx.lineTo(p.x - 13, ay - 6); ctx.closePath();
    ctx.stroke(); ctx.fill();
  }
  function dibujarFlechaBorde(t) {
    if (!objetivo) return;
    const p = iso(objetivo.x, objetivo.y);
    const sx = W / 2 + (p.x - cam.x) * cam.z, sy = H / 2 + (p.y - 60 - cam.y) * cam.z;
    const m = 46, top = 190, bot = 130;
    if (sx > m && sx < W - m && sy > top && sy < H - bot) return;
    const cx = Math.max(m, Math.min(W - m, sx)), cy = Math.max(top, Math.min(H - bot, sy));
    const a = Math.atan2(sy - cy || (sy - H / 2), sx - cx || (sx - W / 2));
    const pul = quieto ? 1 : 1 + Math.sin(t * 6) * 0.08;
    brillo(cx, cy, 40, "rgba(255,226,122,.45)");
    ctx.save(); ctx.translate(cx, cy); ctx.scale(pul, pul);
    ctx.fillStyle = "#ffe27a"; ctx.strokeStyle = "#5a3a00"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.rotate(a); ctx.fillStyle = "#5a3a00";
    ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-7, -10); ctx.lineTo(-3, 0); ctx.lineTo(-7, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------- bucle ----------
  let tiempo = 0, previo = performance.now();
  function cuadro(ahora) {
    const dt = Math.min(0.05, (ahora - previo) / 1000); previo = ahora; tiempo += dt;
    actualizar(dt);
    dibujar(tiempo);
    requestAnimationFrame(cuadro);
  }
  const lunaFondo = { x: 0.82, y: 0.14 };
  const nubes = Array.from({ length: 7 }, (_, i) => ({ x: Math.random(), y: 0.55 + Math.random() * 0.45, r: 80 + Math.random() * 120, v: 4 + Math.random() * 6 }));
  const estrellas = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + 0.3, f: Math.random() * 6 }));

  function dibujar(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cielo = ctx.createLinearGradient(0, 0, 0, H);
    cielo.addColorStop(0, "#0d0820"); cielo.addColorStop(0.55, "#1d1240"); cielo.addColorStop(1, "#3a1d55");
    ctx.fillStyle = cielo; ctx.fillRect(0, 0, W, H);
    for (const s of estrellas) { ctx.fillStyle = `rgba(255,255,255,${quieto ? 0.6 : 0.35 + Math.sin(t * 1.5 + s.f) * 0.3})`; ctx.fillRect(s.x * W, s.y * H, s.r, s.r); }
    const lx = lunaFondo.x * W - cam.x * 0.02, ly = lunaFondo.y * H - cam.y * 0.02;
    brillo(lx, ly, 90, "rgba(255,240,200,.18)");
    ctx.fillStyle = "#fff4d6"; ctx.beginPath(); ctx.arc(lx, ly, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1d1240"; ctx.beginPath(); ctx.arc(lx + 12, ly - 6, 26, 0, Math.PI * 2); ctx.fill();
    for (const n of nubes) {
      const x = ((n.x * W + t * n.v - cam.x * 0.05) % (W + 400) + W + 400) % (W + 400) - 200, y = n.y * H - cam.y * 0.04;
      ctx.fillStyle = "rgba(160,120,220,.08)";
      ctx.beginPath(); ctx.ellipse(x, y, n.r, n.r * 0.35, 0, 0, Math.PI * 2); ctx.ellipse(x + n.r * 0.5, y - 10, n.r * 0.6, n.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
    const z = cam.z;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 - cam.y * z));
    dibujarSuelo(t);

    const cosas = [];
    for (const e of mapa.edificios) cosas.push({ k: e.x + e.y, f: () => dibujarEdificio(e, t) });
    for (const o of mapa.deco) cosas.push({ k: o.x + o.y, f: () => dibujarDeco(o, t) });
    for (const o of mapa.centros) cosas.push({ k: o.x + o.y, f: () => dibujarCentro(o, t) });
    for (const l of mapa.letreros) cosas.push({ k: l.x + l.y + 1, f: () => dibujarLetrero(l) });
    (mapa.vallas || []).forEach((v, i) => cosas.push({ k: v.x + v.y, f: () => dibujarValla(v, i, t) }));
    for (const pr of promotores) cosas.push({ k: pr.x + pr.y + 0.01, f: () => dibujarPromotor(pr, t) });
    for (const pa of parcelas) cosas.push({ k: pa.x + pa.y + 1, f: () => dibujarPlanta(pa, t) });
    for (const n of npcs) { const p = iso(n.x, n.y); if (visible(p, 60)) cosas.push({ k: n.x + n.y + 0.01, f: () => dibujarPersona(ctx, p.x, p.y, n.look, n.fase, n.dir, n.ruta.length > 0) }); }
    for (const g of granjeros) {
      const p = iso(g.x, g.y);
      if (!visible(p, 60)) continue;
      cosas.push({ k: g.x + g.y + 0.01, f: () => {
        dibujarPersona(ctx, p.x, p.y, g.look, g.fase, g.dir, g.ruta.length > 0);
        ctx.font = "700 12px Nunito, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const tw = ctx.measureText(g.nombre).width + 12;
        ctx.fillStyle = "rgba(10,6,24,.7)"; rrect(ctx, p.x - tw / 2, p.y - 80, tw, 18, 9); ctx.fill();
        ctx.fillStyle = "#ffd8a8"; ctx.fillText(g.nombre, p.x, p.y - 70.5);
      } });
    }
    cosas.push({ k: yo.x + yo.y + 0.02, f: () => {
      const p = iso(yo.x, yo.y);
      brillo(p.x, p.y, 28, "rgba(198,243,107,.3)");
      dibujarPersona(ctx, p.x, p.y, yo.look, yo.fase, yo.dir, yo.ruta.length > 0, yo.salto > 0 ? Math.sin((yo.salto / 30) * Math.PI) * 14 : 0);
      if (yo.look.nombre) {
        ctx.font = "700 13px Nunito, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const tw = ctx.measureText(yo.look.nombre).width + 14;
        ctx.fillStyle = "rgba(10,6,24,.7)"; rrect(ctx, p.x - tw / 2, p.y - 84, tw, 20, 10); ctx.fill();
        ctx.fillStyle = "#c6f36b"; ctx.fillText(yo.look.nombre, p.x, p.y - 73.5);
      }
    } });
    cosas.sort((a, b) => a.k - b.k);
    for (const c of cosas) c.f();

    // luciérnagas
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 30; i++) {
      const fx = cam.x + Math.sin(i * 12.9 + t * 0.15) * (W / z) * 0.55, fy = cam.y + Math.cos(i * 7.3 + t * 0.12) * (H / z) * 0.5;
      const a = quieto ? 0.4 : 0.25 + Math.sin(t * 2 + i) * 0.25;
      brillo(fx, fy, 9, `rgba(210,255,140,${Math.max(0, a)})`);
    }
    ctx.globalCompositeOperation = "source-over";
    dibujarParticulas();
    dibujarObjetivo(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dibujarFlechaBorde(t);
  }
  requestAnimationFrame(cuadro);

  // ---------- API ----------
  function irA(idEd, cb) {
    const e = mapa.edificios.find((x) => x.id === idEd);
    if (!e) return;
    caminarA(e.puerta.x, e.puerta.y, () => (cb ? cb(e.id) : cfg.alEntrar(e.id)));
  }
  function teletransportar(tx, ty, cb) {
    yo.x = tx + 0.5; yo.y = ty + 0.5; yo.ruta = []; yo.alLlegar = null; marca = null; seguir = true;
    const p = iso(yo.x, yo.y); cam.x = p.x; cam.y = p.y - 40;
    cb && cb();
  }
  function aPantalla(tx, ty) {
    const p = iso(tx, ty), r = canvas.getBoundingClientRect();
    return { x: r.left + W / 2 + (p.x - cam.x) * cam.z, y: r.top + H / 2 + (p.y - cam.y) * cam.z };
  }
  return {
    irA, teletransportar, aPantalla,
    teletransportarA(idEd, cb) { const e = mapa.edificios.find((x) => x.id === idEd); if (e) teletransportar(e.puerta.x, e.puerta.y, () => cb && cb(e.id)); },
    efecto,
    efectoParcela(dueno, i, nombre) { const pa = parcelas.find((p) => p.dueno === dueno && p.i === i); if (!pa) return; if (nombre === "siembra") pops.set(dueno + i, performance.now()); efecto(nombre, pa.x + 0.5, pa.y + 0.5); },
    pantallaParcela(dueno, i) { const pa = parcelas.find((p) => p.dueno === dueno && p.i === i); return pa ? aPantalla(pa.x + 0.5, pa.y + 0.5) : { x: W / 2, y: H / 2 }; },
    efectoEdificio(idEd, nombre) { const e = mapa.edificios.find((x) => x.id === idEd); if (e) efecto(nombre, e.puerta.x + 0.5, e.puerta.y + 0.5, info[e.id]?.color); },
    efectoYo(nombre, color) { efecto(nombre, yo.x, yo.y, color); },
    saltar() { yo.salto = 30; },
    setLook(l) { yo.look = l; },
    // objetivo de la misión: {tipo:"edificio",id} | {tipo:"parcela",dueno,i} | {tipo:"centro"} | null
    setObjetivo(o) {
      if (!o) { objetivo = null; return; }
      if (o.tipo === "edificio") { const e = mapa.edificios.find((x) => x.id === o.id); objetivo = e ? { x: e.x, y: e.y, alto: (ALTO[info[e.id]?.plantilla] || 130) + 70 } : null; }
      else if (o.tipo === "parcela") { const pa = parcelas.find((p) => p.dueno === o.dueno && p.i === o.i); objetivo = pa ? { x: pa.x + 0.5, y: pa.y + 0.5, alto: 90 } : null; }
      else if (o.tipo === "centro") objetivo = { x: C.x, y: C.y, alto: 230 };
    },
    setInfo(i) { info = i; },
    zoom(f) { cam.z = Math.min(1.6, Math.max(0.35, cam.z * f)); },
    centrar() { seguir = true; },
  };
}
