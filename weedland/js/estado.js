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
  // cultivo y tienda
  semillas: {}, aditamentos: {}, inv: {}, parcelas: Array(8).fill(null), tienda: [], ventas: [], talleresVistos: [], sabias: [], regaloSemilla: false,
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
  ["visitas", "Visitas al stand"], ["reproducciones", "Reproducciones de sus videos"], ["videos", "Videos vistos completos"], ["producto", "Productos abiertos"],
  ["web", "Clics a su tienda"], ["favoritos", "Favoritos"], ["seguidores", "Seguidores"],
  ["partidas", "Partidas jugadas"], ["cupones", "Cupones canjeados"], ["boletos", "Boletos de sorteo"],
  ["drones", "Clics en drones"], ["pantallas", "Clics en pantallas"], ["talleres", "Videos de taller"],
  ["semillas", "Semillas compradas (juego)"], ["sembradas", "Semillas sembradas"], ["aditamentos", "Aditamentos comprados"], ["transformados", "Productos hechos en su taller"],
];
export function metricas() { return leer(K.metricas, {}); }
export function sumar(id, campo, n = 1) {
  if (!id) return;
  const m = metricas();
  m[id] = m[id] || {};
  m[id][campo] = (m[id][campo] || 0) + n;
  escribir(K.metricas, m);
}

// ---------- reproducciones de los videos (anuncios) de cada marca ----------
// Cada navegador tiene un número anónimo (ws-uid) para contar personas distintas, sin pedir datos.
export function uid() {
  try {
    let u = localStorage.getItem("ws-uid");
    if (!u) { u = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join(""); localStorage.setItem("ws-uid", u); }
    return u;
  } catch { return Math.random().toString(16).slice(2, 18).padEnd(16, "0"); }
}
// En vorticevr.mx las vistas de todos se juntan en el servidor (worker.js, /api/weedland/). Sin servidor, solo cuenta este navegador.
const API = new URL("../../api/weedland/", import.meta.url).href;
// fase: "inicio" (empezó a reproducirse) o "fin" (lo vio completo) · origen: stand, cultivo, taller
export function registrarVista(marca, video, fase = "inicio", origen = "stand") {
  if (!marca || !video) return;
  const m = metricas();
  const r = (m[marca] = m[marca] || {});
  if (fase === "inicio") { r.reproducciones = (r.reproducciones || 0) + 1; r.porVideo = r.porVideo || {}; r.porVideo[video] = (r.porVideo[video] || 0) + 1; }
  else r.videos = (r.videos || 0) + 1;
  escribir(K.metricas, m);
  try {
    fetch(API + "vista", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marca, video, fase, origen, uid: uid() }) }).catch(() => {});
  } catch {}
}
// Lo que ve la marca en su panel: del servidor si responde, si no, lo de este navegador
export async function vistasMarca(marca) {
  try {
    const r = await fetch(API + "vistas?marca=" + encodeURIComponent(marca), { cache: "no-store" });
    if (r.ok && (r.headers.get("content-type") || "").includes("json")) return { ...(await r.json()), fuente: "servidor" };
  } catch {}
  const r = metricas()[marca] || {}, por = r.porVideo || {};
  return {
    fuente: "local", reproducciones: r.reproducciones || 0, completas: r.videos || 0, personas: r.reproducciones ? 1 : 0,
    videos: Object.entries(por).map(([video, n]) => ({ video, reproducciones: n, personas: 1 })),
  };
}

export function borrarTodo() {
  try { [K.perfil, K.juego].forEach((k) => localStorage.removeItem(k)); } catch {}
}
export const CLAVES = K;
