// Estado del demo guardado en localStorage (solo este navegador).
// En la versión real esto vive en el servidor.
import { MARCAS_BASE } from "./datos.js";

const K = { perfil: "ws-perfil", juego: "ws-juego", marcas: "ws-marcas", metricas: "ws-metricas" };

function leer(k, def) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
}
function escribir(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function codigo(pre = "WS") {
  let c = "";
  for (let i = 0; i < 6; i++) c += LETRAS[Math.floor(Math.random() * LETRAS.length)];
  return `${pre}-${c}`;
}

export const leerPerfil = () => leer(K.perfil, null);
export const guardarPerfil = (p) => escribir(K.perfil, p);

const nuevo = () => ({
  polen: 20, visitados: [], videos: [], jugados: {}, clases: [], talleres: [],
  cupones: [], boletos: {}, favoritos: [], siguiendo: [], recordar: [], bonos: [],
  diario: { fecha: "", racha: 0 }, guia: false,
});
export function leerJuego() {
  const j = leer(K.juego, null);
  return j ? { ...nuevo(), ...j } : nuevo();
}
export const guardarJuego = (j) => escribir(K.juego, j);

// Marcas: datos base + lo que cada marca edita en su panel
export function marcas() {
  const o = leer(K.marcas, {});
  return MARCAS_BASE.map((m) => (o[m.id] ? { ...m, ...o[m.id], cupon: { ...m.cupon, ...(o[m.id].cupon || {}) } } : m));
}
export function guardarMarca(id, cambios) {
  const o = leer(K.marcas, {});
  o[id] = { ...(o[id] || {}), ...cambios };
  escribir(K.marcas, o);
}
export function restaurarMarca(id) {
  const o = leer(K.marcas, {});
  delete o[id];
  escribir(K.marcas, o);
}

// Métricas por marca (lo que se le reporta a cada marca)
export const CAMPOS = [
  ["visitas", "Visitas al stand"], ["videos", "Videos vistos"], ["producto", "Productos abiertos"],
  ["web", "Clics a su tienda"], ["favoritos", "Favoritos"], ["seguidores", "Seguidores"],
  ["partidas", "Partidas jugadas"], ["cupones", "Cupones canjeados"], ["boletos", "Boletos de sorteo"],
  ["drones", "Clics en drones"], ["pantallas", "Clics en pantallas"], ["talleres", "Talleres vistos"],
];
export function metricas() { return leer(K.metricas, {}); }
export function sumar(id, campo, n = 1) {
  if (!id) return;
  const m = metricas();
  m[id] = m[id] || {};
  m[id][campo] = (m[id][campo] || 0) + n;
  escribir(K.metricas, m);
}

export function borrarTodo() {
  try { [K.perfil, K.juego].forEach((k) => localStorage.removeItem(k)); } catch {}
}
export const CLAVES = K;
