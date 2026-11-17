// Estado del demo guardado en localStorage (solo este navegador).
// En la versión real esto vive en el servidor (Supabase u otro).
import { MARCAS } from "./datos.js";

const K = { perfil: "wl-perfil", juego: "wl-juego", marcas: "wl-marcas", metricas: "wl-metricas" };
const VERSION = 2;

function leer(k, def) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
}
function escribir(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function codigo() {
  let c = "";
  for (let i = 0; i < 6; i++) c += LETRAS[Math.floor(Math.random() * LETRAS.length)];
  return "WL-" + c;
}

export const leerPerfil = () => leer(K.perfil, null);
export const guardarPerfil = (p) => escribir(K.perfil, p);

export function juegoNuevo(cod) {
  return {
    v: VERSION, hojas: 30, lunas: 2, inv: {}, cupones: [],
    parcelas: Array(8).fill(null), abiertas: 6, vecinos: null,
    visitados: [], misiones: [], lecciones: [], dia: {}, regalos: [], leidos: [], favoritos: [],
    stats: { sembradas: 0, cosechas: 0, partidas: 0, transformados: 0, vendidos: 0, ayudas: 0, registradas: 0 },
    avisos: [], videos: null, codigo: cod || codigo(),
  };
}
export function leerJuego() {
  const j = leer(K.juego, null);
  if (!j) return juegoNuevo();
  if (j.v !== VERSION) return juegoNuevo(j.codigo); // el demo cambió: empezar de nuevo conservando el código
  const base = juegoNuevo(j.codigo);
  return { ...base, ...j, stats: { ...base.stats, ...(j.stats || {}) } };
}
export const guardarJuego = (j) => escribir(K.juego, j);

// Marcas: datos base + lo que cada marca edita en su panel
export function marcas() {
  const o = leer(K.marcas, {});
  return MARCAS.map((m) => (o[m.id] ? { ...m, ...o[m.id] } : m));
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

// Métricas por marca
const vacia = () => ({ visitas: 0, partidas: 0, cupones: 0, canjes: 0, videos: 0, favoritos: 0, semillas: 0, calif: [] });
export function metricas() { return leer(K.metricas, {}); }
export function sumar(id, campo, n = 1) {
  const m = metricas();
  m[id] = { ...vacia(), ...(m[id] || {}) };
  m[id][campo] = (m[id][campo] || 0) + n;
  escribir(K.metricas, m);
}
export function calificar(id, estrellas) {
  const m = metricas();
  m[id] = { ...vacia(), ...(m[id] || {}) };
  m[id].calif.push(estrellas);
  escribir(K.metricas, m);
}

export function borrarTodo() {
  try { Object.values(K).forEach((k) => localStorage.removeItem(k)); } catch {}
}
export const CLAVES = K;
