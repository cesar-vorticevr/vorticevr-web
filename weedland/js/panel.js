// Panel de marca del demo: editar stand, catálogo y ver métricas.
import { PABELLONES, catalogo } from "./datos.js";
import { marcas, guardarMarca, restaurarMarca, metricas, CAMPOS, CLAVES } from "./estado.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ICONOS = ["⭐", "🌱", "🧢", "👕", "🎒", "♨️", "🔮", "📜", "🧴", "🧼", "💡", "🪴", "💧", "📘", "🎁"];

let id = new URLSearchParams(location.hash.slice(1)).get("marca") || marcas()[0].id;

function pintar() {
  const lista = marcas(), m = lista.find((x) => x.id === id) || lista[0];
  id = m.id;
  document.body.style.setProperty("--c", m.color); document.body.style.setProperty("--c2", m.color2);
  $("#sel").innerHTML = PABELLONES.map((p) => `<optgroup label="${p.icono} ${esc(p.nombre)}">${lista.filter((x) => x.pab === p.id).map((x) => `<option value="${x.id}" ${x.id === id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}</optgroup>`).join("");

  $("#c-stand").innerHTML = `
    <h2>${m.icono} Tu stand</h2>
    <label>Nombre</label><input id="f-nombre" value="${esc(m.nombre)}" maxlength="28">
    <label>Lema (sale en la pantalla grande)</label><input id="f-lema" value="${esc(m.lema)}" maxlength="48">
    <label>Descripción</label><textarea id="f-desc" maxlength="220">${esc(m.desc)}</textarea>
    <div class="dos"><div><label>Color principal</label><input type="color" id="f-color" value="${m.color}"></div><div><label>Color de fondo</label><input type="color" id="f-color2" value="${m.color2}"></div></div>
    <label>Anuncio que cargan los drones</label><input id="f-anuncio" value="${esc(m.anuncio)}" maxlength="36">
    <label>Juego del stand</label><select id="f-act">${[["ruleta", "Ruleta"], ["quiz", "Trivia"], ["rasca", "Rasca y gana"]].map(([v, t]) => `<option value="${v}" ${m.actividad === v ? "selected" : ""}>${t}</option>`).join("")}</select>
    <div class="dos"><div><label>Cupón</label><input id="f-cupon" value="${esc(m.cupon.texto)}" maxlength="40"></div><div><label>Cuesta (polen)</label><input type="number" id="f-costo" min="10" max="500" step="5" value="${m.cupon.costo}"></div></div>
    <label>Premio del sorteo</label><input id="f-sorteo" value="${esc(m.sorteo)}" maxlength="40">
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn" id="guardar">Guardar cambios</button><button class="btn sec" id="restaurar">Restaurar original</button></div>
    <p class="nota">Los cambios se ven al instante en la estación si la tienes abierta en otra pestaña.</p>`;

  const cat = catalogo(m), extra = m.extra || [];
  $("#c-prods").innerHTML = `
    <h2>📦 Catálogo · ${cat.length} productos</h2>
    <p class="suave chico-t" style="margin:-6px 0 10px">En la versión real se importa el catálogo completo (CSV o su tienda en línea). Aquí puedes agregar productos destacados.</p>
    <div class="dos"><div><label>Producto</label><input id="p-nombre" maxlength="40" placeholder="Nombre"></div><div><label>Categoría</label><input id="p-cat" maxlength="24" placeholder="Ej. Novedades" value="Novedades"></div></div>
    <div class="dos"><div><label>Precio de referencia</label><input id="p-precio" maxlength="16" placeholder="US$ 25"></div><div><label>Ícono</label><select id="p-icono">${ICONOS.map((i) => `<option>${i}</option>`).join("")}</select></div></div>
    <label>Descripción</label><input id="p-desc" maxlength="140" placeholder="Corta y sin promesas de salud">
    <button class="btn chico" style="margin-top:12px" id="agregar">＋ Agregar al catálogo</button>
    <div style="margin-top:14px">${extra.map((p, i) => `<div class="prod-fila"><span>${p.icono}</span><div><b>${esc(p.nombre)}</b><small>${esc(p.cat)} · ${esc(p.precio)}</small></div><button class="btn sec chico" data-quitar="${i}">Quitar</button></div>`).join("")}
    ${cat.filter((p) => !p.id.includes("-x")).slice(0, 6).map((p) => `<div class="prod-fila"><span>${p.icono}</span><div><b>${esc(p.nombre)}</b><small>${esc(p.cat)} · ${esc(p.precio)}</small></div></div>`).join("")}
    <p class="suave chico-t">… y ${Math.max(0, cat.length - extra.length - 6)} más</p></div>`;

  $("#c-vista").innerHTML = `<h2>👀 Así se ve tu pantalla</h2>
    <div class="vista"><span class="e">${m.icono}</span><b>${esc(m.nombre)}</b><p>${esc(m.lema)}</p></div>
    <a class="btn chico" style="margin-top:12px" href="../" target="weedland">Abrir la estación ↗</a>`;

  const met = metricas()[id] || {};
  $("#c-met").innerHTML = `<h2>📊 Métricas</h2><div class="metricas">${CAMPOS.map(([k, t]) => `<div class="met"><b>${met[k] || 0}</b><small>${t}</small></div>`).join("")}</div>
    <p class="nota">Esto es lo que se le reporta a la marca cada mes. Demo: solo cuenta lo que pasa en este navegador.</p>`;

  $("#guardar").onclick = () => {
    guardarMarca(id, {
      nombre: $("#f-nombre").value.trim() || m.nombre, lema: $("#f-lema").value.trim(), desc: $("#f-desc").value.trim(),
      color: $("#f-color").value, color2: $("#f-color2").value, anuncio: $("#f-anuncio").value.trim(), actividad: $("#f-act").value,
      cupon: { texto: $("#f-cupon").value.trim() || m.cupon.texto, costo: Math.max(10, Math.min(500, +$("#f-costo").value || m.cupon.costo)) },
      sorteo: $("#f-sorteo").value.trim() || m.sorteo,
    });
    pintar(); aviso("Guardado ✓");
  };
  $("#restaurar").onclick = (e) => {
    if (e.currentTarget.dataset.ok) { restaurarMarca(id); pintar(); aviso("Restaurado"); return; }
    e.currentTarget.dataset.ok = "1"; e.currentTarget.textContent = "Toca otra vez para confirmar";
  };
  $("#agregar").onclick = () => {
    const nombre = $("#p-nombre").value.trim(); if (!nombre) return $("#p-nombre").focus();
    const nuevo = { nombre, cat: $("#p-cat").value.trim() || "Novedades", precio: $("#p-precio").value.trim() || "Consultar", icono: $("#p-icono").value, desc: $("#p-desc").value.trim() || `${nombre} de ${m.nombre}.` };
    guardarMarca(id, { extra: [...extra, nuevo] });
    pintar(); aviso("Producto agregado ✓");
  };
  document.querySelectorAll("[data-quitar]").forEach((b) => (b.onclick = () => {
    const e2 = extra.slice(); e2.splice(+b.dataset.quitar, 1); guardarMarca(id, { extra: e2 }); pintar();
  }));
}
function aviso(t) {
  const el = document.createElement("div"); el.className = "toast"; el.textContent = t;
  el.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:50";
  document.body.appendChild(el); setTimeout(() => el.remove(), 1800);
}
$("#sel").onchange = (e) => { id = e.target.value; location.hash = "marca=" + id; pintar(); };
addEventListener("storage", (e) => { if (e.key === CLAVES.metricas || e.key === CLAVES.marcas) pintar(); });
pintar();
