// Cultivo, Mercado y tienda virtual del demo de Weedland Station.
// Todo es virtual: las semillas son las que cada marca registra en su catálogo,
// las plantas crecen en tiempo real (45 minutos) y los aditamentos de las marcas aceleran o aumentan la cosecha.
import { catalogo, CLASES } from "./datos.js";

export const HORA = 3600 * 1000;
export const TIEMPO_BASE = 45 * 60 * 1000; // una planta tarda 45 minutos sin aditamentos
export const MIN_VIDEO = 15 * 60 * 1000; // cada video patrocinado le quita 15 minutos
export const MAX_VIDEOS = 2; // cada semilla trae 2 videos: el de su marca y el de un complemento de la Tienda de cultivo
export const PARCELAS = 8;

// ---------- registro de semillas ----------
// Una categoría del catálogo cuenta como semilla si es de una marca de Genética (menos merch/libros/kits)
// o si la marca marcó el producto como "semilla registrada" en su panel.
const NO_SEMILLA = /merch|libro|kit/i;
export function esSemilla(m, p) {
  if (p.semilla) return true;
  return m.pab === "genetica" && !NO_SEMILLA.test(p.cat) && !p.id.includes("-x");
}
export function semillasRegistradas(marcas) {
  const lista = [];
  marcas.forEach((m) => catalogo(m).forEach((p) => {
    if (!esSemilla(m, p)) return;
    const canamo = /cáñamo|canamo|fibra|grano/i.test(p.cat + " " + p.nombre);
    lista.push({
      id: "s:" + p.id, producto: p.id, marca: m.id, nombre: p.nombre.split(" · ")[0], icono: canamo ? "🌾" : "🌱",
      tipo: canamo ? "canamo" : "flor", costo: 20 + (p.nombre.length % 4) * 5,
    });
  }));
  // una sola entrada por variedad (los paquetes 3/5/10 son la misma semilla)
  const vistos = new Set();
  return lista.filter((s) => { const k = s.marca + "|" + s.nombre; if (vistos.has(k)) return false; vistos.add(k); return true; });
}

// ---------- aditamentos (los venden las marcas de Cultivo en el Mercado) ----------
// vel: fracción de tiempo que ahorra · rinde: material extra al cosechar
export const ADITAMENTOS = [
  { id: "lampara", nombre: "Lámpara LED", icono: "💡", marca: "lumen", vel: 0.3, costo: 40, desc: "Luz de espectro completo: la planta crece 30% más rápido." },
  { id: "nutrientes", nombre: "Nutrientes orgánicos", icono: "🧪", marca: "tierra", vel: 0.2, costo: 25, desc: "Comida para la tierra: 20% más rápido." },
  { id: "riego", nombre: "Riego automático", icono: "💧", marca: "aqua", vel: 0.15, costo: 20, desc: "Agua justa a la hora justa: 15% más rápido." },
  { id: "extractor", nombre: "Extractor de aire", icono: "🌀", marca: "clima-grow", vel: 0.1, costo: 15, desc: "Aire fresco: 10% más rápido." },
  { id: "sensor", nombre: "Sensor de pH", icono: "📟", marca: "sensor-verde", vel: 0.1, costo: 15, desc: "Mide y ajusta: 10% más rápido." },
  { id: "maceta", nombre: "Maceta de tela", icono: "🪴", marca: "maceta-viva", rinde: 1, costo: 20, desc: "Raíces sanas: +1 de cosecha." },
  { id: "micorrizas", nombre: "Micorrizas", icono: "🍄", marca: "abono-andino", rinde: 1, costo: 25, desc: "Hongos amigos de la raíz: +1 de cosecha." },
];
export const aditamento = (id) => ADITAMENTOS.find((a) => a.id === id);

// ---------- materiales y productos ----------
export const OBJETOS = {
  flor: { nombre: "Flor", icono: "🌼", valor: 10 },
  fibra: { nombre: "Fibra de cáñamo", icono: "🧵", valor: 8 },
  grano: { nombre: "Grano de cáñamo", icono: "🌰", valor: 8 },
  cuerda: { nombre: "Cuerda", icono: "🪢", valor: 35 },
  tela: { nombre: "Tela", icono: "🧶", valor: 50 },
  papel: { nombre: "Papel", icono: "📄", valor: 30 },
  bolsa: { nombre: "Bolsa de tela", icono: "👜", valor: 95 },
  balsamo: { nombre: "Bálsamo", icono: "🧴", valor: 40 },
  tintura: { nombre: "Tintura", icono: "🫙", valor: 60 },
  esencia: { nombre: "Aceite aromático", icono: "💧", valor: 55 },
  aceite: { nombre: "Aceite de cocina", icono: "🫒", valor: 45 },
  proteina: { nombre: "Proteína", icono: "🥣", valor: 35 },
  bloque: { nombre: "Bloque de construcción", icono: "🧱", valor: 70 },
};
export const COSECHA = { flor: { flor: 3 }, canamo: { fibra: 3, grano: 2 } };

// Puestos del Mercado. Cada taller lo patrocina una marca y te cuenta qué se puede hacer.
export const PUESTOS = [
  { id: "semillas", nombre: "Banco de semillas", icono: "🌱", color: "#7dffb3", tipo: "semillas", marca: null, mercancia: ["🌱", "🌾", "🌿"],
    sabias: "Todas las semillas que ves aquí son las que las marcas tienen registradas en su catálogo. En el mundo real, solo se venden donde la ley lo permite." },
  { id: "aditamentos", nombre: "Tienda de cultivo", icono: "💡", color: "#6ff0ff", tipo: "aditamentos", marca: null, mercancia: ["💡", "🧪", "💧"],
    sabias: "Luz, agua, aire y nutrientes: cada aditamento lo trae una marca y hace que tu planta crezca más rápido o dé más cosecha." },
  { id: "textil", nombre: "Taller textil", icono: "🧵", color: "#f2c45a", tipo: "taller", marca: "telaverde", clase: "canamo", mercancia: ["🪢", "🧶", "📄"],
    recetas: [["cuerda", { fibra: 2 }], ["papel", { fibra: 2 }], ["tela", { fibra: 3 }], ["bolsa", { tela: 1, cuerda: 1 }], ["bloque", { fibra: 3, grano: 1 }]],
    sabias: "Del tallo del cáñamo sale una de las fibras más resistentes: con ella se hacen cuerdas, telas, papel y hasta bloques para construir casas." },
  { id: "botica", nombre: "Botica", icono: "🧴", color: "#ffb3e6", tipo: "taller", marca: "hempa", clase: "etiqueta", mercancia: ["🧴", "🫙", "💧"],
    recetas: [["balsamo", { flor: 2 }], ["esencia", { flor: 2, grano: 1 }], ["tintura", { flor: 3 }]],
    sabias: "En la Botica del juego haces bálsamos, aceites y tinturas virtuales. En la vida real, los productos de salud necesitan registro sanitario y la guía de un profesional.",
    aviso: "Objetos del juego. No son medicamentos ni prometen efectos." },
  { id: "cocina", nombre: "Cocina", icono: "🥣", color: "#b6e36b", tipo: "taller", marca: "nativa", clase: "leyes", mercancia: ["🫒", "🥣", "🌰"],
    recetas: [["aceite", { grano: 3 }], ["proteina", { grano: 2 }]],
    sabias: "La semilla de cáñamo es un alimento: tiene proteína y aceite. Se come pelada, en harina o en aceite para cocinar." },
];
export const puesto = (id) => PUESTOS.find((p) => p.id === id);
export const claseDe = (pu) => CLASES.find((c) => c.id === pu.clase);

// ---------- crecimiento ----------
export function factorVel(p) {
  const ahorro = (p.aditamentos || []).reduce((a, id) => a + ((aditamento(id) || {}).vel || 0), 0);
  return Math.max(0.25, 1 - ahorro);
}
export function duracion(p) {
  return Math.max(5 * 60 * 1000, TIEMPO_BASE * factorVel(p) - (p.videos || 0) * MIN_VIDEO);
}
export function progreso(p, ahora = Date.now()) {
  if (!p) return 0;
  return Math.max(0, Math.min(1, (ahora - p.plantada) / duracion(p)));
}
export const faltan = (p, ahora = Date.now()) => Math.max(0, p.plantada + duracion(p) - ahora);
export function rinde(p) {
  const extra = (p.aditamentos || []).reduce((a, id) => a + ((aditamento(id) || {}).rinde || 0), 0);
  const base = COSECHA[p.tipo] || COSECHA.flor;
  const out = {};
  Object.entries(base).forEach(([k, n]) => (out[k] = n + extra));
  return out;
}
export function tiempoTexto(ms) {
  const m = Math.ceil(ms / 60000);
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return `${m} min`;
}

// ---------- tu tienda virtual ----------
// Los visitantes (simulados) compran lo que pones a la venta. Si el precio es justo, se vende más rápido.
export const COMPRADORES = ["Kim", "Sol", "Tomi", "Luna", "Rafa", "Vale", "Nico", "Abril", "Leo", "Maia"];
export const MAX_TIENDA = 6;
export const PRECIO_MAX = 4; // puedes pedir hasta 4 veces el precio justo (tarda más en venderse)
export const precioJusto = (k) => (OBJETOS[k] ? OBJETOS[k].valor : 0);
export function esperaVenta(item, precio) {
  const base = OBJETOS[item].valor, caro = precio / base;
  const min = (2 + Math.random() * 6) * Math.max(0.6, Math.pow(caro, 1.6)); // minutos
  return min * 60 * 1000;
}
