// Archivos que sube cada marca para su stand (logo, imágenes, videos y modelo 3D).
// Demo: viven en IndexedDB de este navegador (base "weedland-medios"); en la versión real se suben al servidor (R2).
// Los datos de qué hay y su versión van con la marca (ws-marcas → m.medios, m.videosMarca, m.promos), así un cambio avisa a la estación.

// Medidas que se piden: el editor recorta o ajusta cualquier imagen a esa medida exacta
export const IMAGENES = {
  logo: { w: 512, h: 512, nombre: "Logo", donde: "Letrero, mostrador, pantallas y tu panel", ayuda: "Cuadrado. Mejor PNG con fondo transparente.", modo: "contener", tipo: "image/png" },
  pantalla: { w: 1920, h: 1080, nombre: "Pantalla principal", donde: "La pantalla grande de tu stand (horizontal 16:9)", ayuda: "1920 × 1080 px, horizontal.", modo: "llenar", tipo: "image/jpeg" },
  totem: { w: 1080, h: 1920, nombre: "Tótems", donde: "Los 2 tótems al frente del stand (vertical 9:16)", ayuda: "1080 × 1920 px, vertical, como una historia de Instagram.", modo: "llenar", tipo: "image/jpeg" },
  banner: { w: 1280, h: 480, nombre: "Banner de drones", donde: "Lo que cargan los drones que vuelan por la estación (8:3)", ayuda: "1280 × 480 px, horizontal alargado.", modo: "llenar", tipo: "image/jpeg" },
};
export const PROMO_IMG = { w: 1080, h: 1080, nombre: "Imagen de la promoción", ayuda: "Cuadrada, 1080 × 1080 px.", modo: "llenar", tipo: "image/jpeg" };
// Cuántos videos según el tipo de stand
export const MAX_VIDEOS_MARCA = { stand: 2, premium: 5, isla: 5 };
export const VIDEO_MB = 60, MODELO_MB = 40;

// ---------- IndexedDB ----------
let base = null;
function abrir() {
  if (base) return base;
  base = new Promise((ok, mal) => {
    const r = indexedDB.open("weedland-medios", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("archivos");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  return base;
}
async function tx(modo, fn) {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const t = db.transaction("archivos", modo), st = t.objectStore("archivos");
    const r = fn(st);
    t.oncomplete = () => ok(r && "result" in r ? r.result : undefined);
    t.onerror = () => mal(t.error);
  });
}
export const guardarArchivo = (marca, slot, blob) => tx("readwrite", (st) => st.put(blob, `${marca}/${slot}`));
export const borrarArchivo = (marca, slot) => tx("readwrite", (st) => st.delete(`${marca}/${slot}`));
export async function leerArchivo(marca, slot) {
  try { return (await tx("readonly", (st) => st.get(`${marca}/${slot}`))) || null; } catch { return null; }
}

// URL de un archivo (se recuerda mientras la versión no cambie)
const urls = new Map();
export async function urlDe(marca, slot, v) {
  const k = `${marca}/${slot}`, prev = urls.get(k);
  if (prev && prev.v === v) return prev.url;
  const blob = await leerArchivo(marca, slot);
  if (prev) URL.revokeObjectURL(prev.url);
  if (!blob) { urls.delete(k); return null; }
  const url = URL.createObjectURL(blob);
  urls.set(k, { v, url });
  return url;
}
export function cargarImagen(url) {
  return new Promise((ok) => { if (!url) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url; });
}

// Todo lo de una marca, listo para dibujar: { logo, pantalla, totem, banner (Image), videos [{ url, titulo, orient, ajuste, id }], modelo { url, anim, alto } }
export async function mediosDe(m) {
  const md = m.medios || {}, out = { videos: [] };
  await Promise.all(Object.keys(IMAGENES).map(async (k) => { if (md[k]) out[k] = await cargarImagen(await urlDe(m.id, k, md[k])); }));
  for (const v of m.videosMarca || []) {
    const url = await urlDe(m.id, v.slot, v.v);
    if (url) out.videos.push({ ...v, url, id: `${m.id}#v-${v.slot}` });
  }
  if (md.modelo && md.modelo.v) { const url = await urlDe(m.id, "modelo", md.modelo.v); if (url) out.modelo = { ...md.modelo, url }; }
  out.promos = {};
  await Promise.all((m.promos || []).filter((p) => p.img).map(async (p) => { out.promos[p.id] = await cargarImagen(await urlDe(m.id, "promo-" + p.id, p.img)); }));
  return out;
}
export const tieneMedios = (m) => !!((m.medios && Object.keys(m.medios).length) || (m.videosMarca && m.videosMarca.length));

// Dibuja una imagen en un rectángulo: "llenar" recorta, "contener" deja todo visible
export function dibujarEn(g, img, x, y, w, h, modo = "llenar") {
  const iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const r = iw / ih, rr = w / h;
  let dw, dh;
  if ((modo === "llenar") === (r > rr)) { dh = h; dw = h * r; } else { dw = w; dh = w / r; }
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
export const version = () => Date.now().toString(36);
