// Panel de marca (demo): editar el stand, ver métricas y registrar compras.
import { PAISES, PLANTILLAS, ZONAS } from "./datos.js";
import * as E from "./estado.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const es = (o) => (typeof o === "string" ? o : o?.es ?? "");
const en = (o) => (typeof o === "string" ? o : o?.en ?? "");

let marcas = E.marcas();
let actual = (() => { try { return localStorage.getItem("wl-panel-marca"); } catch { return null; } })() || marcas[0].id;
if (!marcas.some((m) => m.id === actual)) actual = marcas[0].id;
const marca = () => marcas.find((m) => m.id === actual);

// ---- selector ----
const sel = $("#sel-marca");
function pintarSelector() {
  sel.innerHTML = marcas.map((m) => `<option value="${m.id}" ${m.id === actual ? "selected" : ""}>${esc(m.nombre)} · ${esc(PAISES.find((x) => x.id === m.pais)?.es || m.pais)} · ${esc(ZONAS[m.zona]?.es || "")}</option>`).join("");
}
sel.onchange = () => {
  actual = sel.value;
  try { localStorage.setItem("wl-panel-marca", actual); } catch {}
  todo();
};

// ---- métricas ----
function pintarMetricas() {
  const m = E.metricas()[actual] || { visitas: 0, partidas: 0, cupones: 0, canjes: 0, calif: [] };
  const prom = m.calif?.length ? (m.calif.reduce((a, b) => a + b, 0) / m.calif.length).toFixed(1) + " ★" : "–";
  const datos = [
    ["Visitas al stand", m.visitas], ["Partidas jugadas", m.partidas], ["Cupones guardados", m.cupones],
    ["Videos vistos completos", m.videos || 0], ["Me gusta en productos", m.favoritos || 0], ["Semillas registradas sembradas", m.semillas || 0], ["Compras registradas", m.canjes], ["Calificación", prom],
  ];
  $("#metricas").innerHTML = datos.map(([k, v]) => `<div class="metrica"><b>${v}</b><span>${k}</span></div>`).join("");
  const j = E.leerJuego();
  $("#pista-codigo").textContent = `Para probar: el código del jugador de este navegador es ${j.codigo}.`;
}
$("#refrescar").onclick = pintarMetricas;
window.addEventListener("storage", (e) => { if (e.key === E.CLAVES.metricas || e.key === E.CLAVES.juego) pintarMetricas(); });

// ---- registrar compra ----
$("#registrar").onclick = () => {
  const cod = $("#codigo").value.trim().toUpperCase();
  const msg = $("#msg-compra");
  const j = E.leerJuego();
  if (!cod || cod !== j.codigo) {
    msg.className = "msg error";
    msg.textContent = "No encontramos ese código. (En el demo solo existe el jugador de este navegador.)";
    return;
  }
  const m = marca();
  const cupon = j.cupones.find((c) => c.marca === m.id && c.estado === "activo");
  if (cupon) { cupon.estado = "canjeado"; cupon.canjeado = Date.now(); }
  j.lunas += 5;
  const extra = "extra:" + m.id;
  const nuevo = !j.inv[extra];
  j.inv[extra] = (j.inv[extra] || 0) + 1;
  j.avisos = j.avisos || [];
  j.avisos.push({
    es: `🏆 ${m.nombre} registró tu compra: +5 🌟${nuevo ? " y su coleccionable extra raro" : ""}.${cupon ? " Tu cupón quedó canjeado; califícalo en tu mochila." : ""}`,
    en: `🏆 ${m.nombre} registered your purchase: +5 🌟${nuevo ? " and its ultra-rare collectible" : ""}.${cupon ? " Your coupon is redeemed; rate it in your backpack." : ""}`,
  });
  E.guardarJuego(j);
  E.sumar(m.id, "canjes");
  msg.className = "msg ok";
  msg.textContent = `Compra registrada${cupon ? " con cupón" : " (sin cupón)"}. El jugador recibe 5 de polen dorado${nuevo ? " y tu coleccionable extra raro" : ""}.`;
  $("#codigo").value = "";
  pintarMetricas();
};

// ---- formulario del stand ----
const form = $("#form");
form.plantilla.innerHTML = Object.entries(PLANTILLAS).map(([k, v]) => `<option value="${k}">${v.es}</option>`).join("");

function pintarForm() {
  const m = marca();
  form.nombre.value = m.nombre;
  form.color.value = m.color;
  form.plantilla.value = m.plantilla;
  form.anf_nombre.value = m.anfitrion.nombre;
  form.saludo_es.value = es(m.anfitrion.saludo);
  form.saludo_en.value = en(m.anfitrion.saludo);
  form.juego.value = m.juego;
  form.cupon_es.value = es(m.cupon.desc);
  form.cupon_en.value = en(m.cupon.desc);
  form.cupon_dias.value = m.cupon.dias;
  form.bueno_es.value = es(m.taller.bueno);
  form.bueno_en.value = en(m.taller.bueno);
  form.ojo_es.value = es(m.taller.ojo);
  form.ojo_en.value = en(m.taller.ojo);
  $("#productos").innerHTML = m.productos.map((p, i) => `
    <div class="producto-fila">
      <label class="campo">Ícono<input name="p${i}_icono" value="${esc(p.icono)}" maxlength="4"></label>
      <label class="campo">Producto<input name="p${i}_nombre" value="${esc(es(p.nombre))}" maxlength="40"></label>
      <label class="campo ancho">Descripción (ES)<input name="p${i}_desc_es" value="${esc(es(p.desc))}" maxlength="90"></label>
      <label class="campo ancho">Description (EN)<input name="p${i}_desc_en" value="${esc(en(p.desc))}" maxlength="90"></label>
    </div>`).join("");
  $("#paises").innerHTML = PAISES.filter((p) => p.id !== "XX").map((p) => `<label><input type="checkbox" value="${p.id}" ${m.paises.includes(p.id) ? "checked" : ""}> ${p.es}</label>`).join("");
  $("#ver-stand").href = `../index.html#${encodeURIComponent(m.id)}`;
  pintarVista();
}

function pintarVista() {
  const c = form.color.value;
  const v = $("#vista");
  v.style.background = c;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  v.style.color = (r * 299 + g * 587 + b * 114) / 1000 > 140 ? "#160f2b" : "#fff";
  v.textContent = `${form.nombre.value || "Tu marca"} · ${PLANTILLAS[form.plantilla.value]?.es || ""}`;
}
form.addEventListener("input", pintarVista);

form.onsubmit = (e) => {
  e.preventDefault();
  const m = marca();
  const paises = [...document.querySelectorAll("#paises input:checked")].map((x) => x.value);
  const msg = $("#msg-form");
  if (!paises.length) { msg.className = "msg error"; msg.textContent = "Elige al menos un país donde vendes."; return; }
  const productos = m.productos.map((p, i) => {
    const nombre = form[`p${i}_nombre`].value.trim();
    return {
      icono: form[`p${i}_icono`].value.trim() || p.icono,
      nombre: nombre && nombre !== es(p.nombre) ? nombre : p.nombre,
      desc: { es: form[`p${i}_desc_es`].value.trim(), en: form[`p${i}_desc_en`].value.trim() || form[`p${i}_desc_es`].value.trim() },
    };
  });
  E.guardarMarca(m.id, {
    nombre: form.nombre.value.trim() || m.nombre,
    color: form.color.value,
    plantilla: form.plantilla.value,
    juego: form.juego.value,
    anfitrion: { nombre: form.anf_nombre.value.trim() || m.anfitrion.nombre, saludo: { es: form.saludo_es.value.trim(), en: form.saludo_en.value.trim() || form.saludo_es.value.trim() } },
    cupon: { desc: { es: form.cupon_es.value.trim(), en: form.cupon_en.value.trim() || form.cupon_es.value.trim() }, dias: Math.max(1, Math.min(120, +form.cupon_dias.value || 30)) },
    paises,
    taller: {
      titulo: m.taller.titulo,
      bueno: { es: form.bueno_es.value.trim(), en: form.bueno_en.value.trim() || form.bueno_es.value.trim() },
      ojo: { es: form.ojo_es.value.trim(), en: form.ojo_en.value.trim() || form.ojo_es.value.trim() },
    },
    productos,
  });
  marcas = E.marcas();
  pintarSelector();
  msg.className = "msg ok";
  msg.textContent = "Publicado. Si tienes el mundo abierto en otra pestaña, el stand cambia al instante.";
};

$("#restaurar").onclick = (ev) => {
  const b = ev.currentTarget;
  if (!b.dataset.seguro) { b.dataset.seguro = "1"; b.textContent = "Toca otra vez para restaurar"; return; }
  delete b.dataset.seguro; b.textContent = "Restaurar original";
  E.restaurarMarca(actual);
  marcas = E.marcas();
  todo();
  $("#msg-form").className = "msg ok";
  $("#msg-form").textContent = "Stand restaurado.";
};

function todo() { pintarSelector(); pintarMetricas(); pintarForm(); }
todo();
