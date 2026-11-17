// Weedland Station: interfaz (entrada, stands, catálogo, juegos, premios, cultivo, mercado, tienda, nave, pasaporte).
import { PAISES, PABELLONES, PREMIO_DIA, catalogo, preguntasMarca, nombrePais, videosDe, NIVELES } from "./datos.js";
import { leerPerfil, guardarPerfil, leerJuego, guardarJuego, marcas, sumar, codigo, CLAVES } from "./estado.js";
import { sonido, volar, cartel, confeti, flotante, contar, alternarSonido, estaMudo } from "./efectos.js";
import { semillasRegistradas, ADITAMENTOS, aditamento, OBJETOS, PUESTOS, puesto, claseDe, progreso, faltan, rinde, factorVel, tiempoTexto, MAX_VIDEOS, COMPRADORES, MAX_TIENDA, esperaVenta } from "./cultivo.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const hoy = () => new Date().toISOString().slice(0, 10);
const movil = () => innerWidth < 760;

let J = leerJuego();
let MARCAS = marcas();
let est = null; // escena 3D
let actual = null; // { tipo, id, tab }
const marca = (id) => MARCAS.find((m) => m.id === id);
const pab = (id) => PABELLONES.find((p) => p.id === id);
const guardar = () => guardarJuego(J);
const vars = (m) => `--c:${m.color};--c2:${m.color2}`;

// ---------- entrada (edad según país) ----------
function entrada() {
  const caja = $("#entrada");
  caja.hidden = false;
  caja.innerHTML = `
    <div class="entrada-caja">
      <div class="planeta-entrada">🪐</div>
      <div class="entrada-logo">Weedland</div>
      <div class="entrada-sub">STATION</div>
      <p>La expo interactiva del sector cannábico legal. Recorre los stands, mira los catálogos de las marcas, juega y gana premios reales.</p>
      <label for="pais" class="suave chico-t">¿Desde qué país nos visitas?</label>
      <select id="pais">${PAISES.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join("")}</select>
      <button id="soy-mayor" class="btn ancho"></button>
      <button id="no-mayor" class="btn sec ancho" style="margin-top:8px">No, soy menor</button>
      <p class="legal">Solo para mayores de edad. Aquí no se vende nada: cada marca vende en su propia tienda y según la ley de tu país. Demo con marcas de ejemplo.</p>
    </div>`;
  const sel = $("#pais"), btn = $("#soy-mayor");
  const idioma = (navigator.language || "").toUpperCase();
  const sug = PAISES.find((p) => idioma.endsWith(p.id));
  if (sug) sel.value = sug.id;
  const pintar = () => { const p = PAISES.find((x) => x.id === sel.value); btn.textContent = `Tengo ${p.edad} años o más · Entrar`; };
  sel.onchange = pintar; pintar();
  btn.onclick = () => {
    sonido.pop();
    guardarPerfil({ pais: sel.value, fecha: hoy() });
    caja.hidden = true;
    iniciar();
  };
  $("#no-mayor").onclick = () => { caja.innerHTML = `<div class="entrada-caja"><div class="planeta-entrada">👋</div><h2>¡Nos vemos más adelante!</h2><p class="suave">Weedland es solo para personas adultas.</p></div>`; };
}

// ---------- arranque ----------
async function iniciar() {
  $("#app").hidden = false;
  contar($("#polen"), J.polen);
  $("#btn-sonido").textContent = estaMudo() ? "🔇" : "🔊";
  try {
    const { crearEstacion } = await import("./estacion.js");
    est = crearEstacion($("#escena"), {
      marcas: MARCAS,
      etiqueta: crearEtiqueta,
      alTocar,
      alCerca,
      alSoltar: () => { if (actual && actual.tipo === "stand") cerrarPanel(); },
      alPaso: () => sonido.paso(),
    });
  } catch (e) {
    console.error(e);
    $("#cargando").innerHTML = `<p>No se pudo cargar el 3D en este dispositivo.</p><button class="btn" onclick="location.reload()">Reintentar</button>`;
    return;
  }
  setTimeout(() => $("#cargando").classList.add("fuera"), 300);
  conectarHud();
  conectarStick();
  revisarVentas(true);
  est.setTienda(J.tienda.map((it) => ({ icono: OBJETOS[it.item].icono })));
  refrescarCultivo();
  setInterval(relojGranja, 1000);
  $("#saltar-tour").onclick = () => est.saltarTour();
  setTimeout(() => { if (!regaloDiario() && !J.guia) guia(0); }, 900);
}

function crearEtiqueta({ id, icono, nombre, color, isla }) {
  const b = document.createElement("button");
  b.className = "etiqueta" + (isla ? " isla" : ""); b.style.setProperty("--c", color);
  if (isla) { b.innerHTML = `<span>${icono}</span>${esc(nombre)}<em>ISLA</em>`; b.onclick = () => { sonido.tap(); caminarA("stand", id, () => abrirStand(id)); }; $("#etiquetas").appendChild(b); return b; }
  b.innerHTML = `<span>${icono}</span>${esc(nombre)}`;
  b.onclick = () => { sonido.tap(); if (id === "plaza") irPlaza(); else if (id === "mercado") caminarA("mercado", null, () => abrirMercado()); else if (id === "cultivo") caminarA("cultivo", null, () => abrirCultivo()); else if (id === "nave") caminarA("nave", null, () => abrirNave()); else caminarA("pabellon", id); };
  $("#etiquetas").appendChild(b);
  return b;
}

function conectarHud() {
  $("#btn-inicio").onclick = () => { sonido.tap(); irPlaza(); };
  $("#btn-polen").onclick = () => { sonido.tap(); abrirPremios(); };
  $("#btn-ayuda").onclick = () => { sonido.tap(); guia(0); };
  $("#btn-sonido").onclick = () => { $("#btn-sonido").textContent = alternarSonido() ? "🔇" : "🔊"; sonido.tap(); };
  $$(".nav button").forEach((b) => (b.onclick = () => {
    sonido.tap();
    const ir = b.dataset.ir;
    if (ir === "plaza") irPlaza();
    else if (ir === "directorio") abrirDirectorio();
    else if (ir === "cultivo") irLugar("cultivo", null, () => abrirCultivo());
    else if (ir === "mercado") irLugar("mercado", null, () => abrirMercado());
    else if (ir === "nave") irLugar("nave", null, () => abrirNave());
    else if (ir === "premios") abrirPremios();
  }));
  $("#panel-cerrar").onclick = () => { sonido.tap(); cerrarPanel(); };
  $("#modal").onclick = (e) => { if (e.target.id === "modal") cerrarModal(); };
  addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("#modal").hidden) cerrarModal(); else cerrarPanel(); } });
  addEventListener("resize", () => { if (!$("#panel").hidden) desplazar(); });
  // El panel de marca (otra pestaña) cambia los datos: actualizar el stand en vivo
  addEventListener("storage", (e) => {
    if (e.key === CLAVES.marcas) { MARCAS = marcas(); est && est.actualizarMarcas(MARCAS); if (actual && actual.tipo === "stand") abrirStand(actual.id, actual.tab, false); }
  });
}

// Tocar algo en el 3D: el avatar camina hasta ahí y, al llegar, se abre
function alTocar(tipo, id) {
  sonido.tap();
  if (tipo === "dron") sumar(id, "drones");
  if (tipo === "pantalla") sumar(id, "pantallas");
  if (tipo === "stand" || tipo === "dron" || tipo === "pantalla") caminarA("stand", id, () => abrirStand(id));
  else if (tipo === "pabellon") caminarA("pabellon", id);
  else if (tipo === "parcela") caminarA("parcela", id, () => abrirParcela(id));
  else if (tipo === "puesto") caminarA("puesto", id, () => abrirPuesto(id));
  else if (tipo === "tienda") caminarA("tienda", null, () => abrirTienda());
  else if (tipo === "nave") caminarA("nave", null, () => abrirNave());
}
function caminarA(tipo, id, cb) {
  if (actual) cerrarPanel();
  est && est.irA(tipo, id, { cb });
}
// Botón "Entrar" cuando el avatar está frente a un stand, un puesto del Mercado, tu tienda o la nave
let cercaDe = null;
function alCerca(id) {
  cercaDe = id;
  const b = $("#entrar");
  if (!id) { b.hidden = true; return; }
  const m = marca(id);
  const pu = id.startsWith("puesto:") ? puesto(id.slice(7)) : null;
  b.innerHTML = m ? `<span class="logo-mini" style="${vars(m)}">${m.icono}</span> Entrar a ${esc(m.nombre)} ▶`
    : pu ? `${pu.icono} ${esc(pu.nombre)} ▶` : id === "tienda" ? "🏪 Abrir tu tienda ▶" : "🚀 Subir a la nave ▶";
  b.style.cssText = m ? vars(m) : `--c:${pu ? pu.color : id === "tienda" ? "#7dffb3" : "#6ff0ff"}`;
  b.hidden = !!actual || document.body.classList.contains("en-tour");
  if (!b.hidden) sonido.burbuja();
}
function conectarStick() {
  const base = $("#stick"), bola = $(".bola", base);
  let id = null, cx = 0, cy = 0;
  const R = 46;
  const mover = (e) => {
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy); if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    bola.style.transform = `translate(${dx}px, ${dy}px)`;
    est && est.setStick(dx / R, -dy / R);
  };
  const soltar = () => { id = null; bola.style.transform = ""; est && est.setStick(0, 0); base.classList.remove("activo"); };
  base.addEventListener("pointerdown", (e) => {
    id = e.pointerId; const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    try { base.setPointerCapture(id); } catch {}
    base.classList.add("activo"); mover(e); e.preventDefault();
  });
  base.addEventListener("pointermove", (e) => { if (e.pointerId === id) mover(e); });
  base.addEventListener("pointerup", soltar); base.addEventListener("pointercancel", soltar);
  $("#entrar").onclick = () => {
    sonido.tap();
    if (!cercaDe) return;
    if (cercaDe.startsWith("puesto:")) abrirPuesto(cercaDe.slice(7));
    else if (cercaDe === "tienda") abrirTienda();
    else if (cercaDe === "nave") abrirNave();
    else abrirStand(cercaDe);
  };
}

function marcarNav(ir) { $$(".nav button").forEach((b) => b.classList.toggle("activo", b.dataset.ir === ir)); }

// ---------- panel ----------
function abrirPanel(html, { tipo, id, alto = false, c = null, nav = null } = {}) {
  const p = $("#panel");
  p.hidden = false; p.classList.toggle("alto", alto);
  p.style.cssText = c || "";
  $("#panel-cuerpo").innerHTML = html;
  $("#panel-cuerpo").scrollTop = 0;
  actual = { tipo, id };
  marcarNav(nav);
  $("#entrar").hidden = true;
  document.body.classList.add("con-panel");
  est && est.setEtiquetas(!movil());
  desplazar();
  cerrarGuia(true);
}
function desplazar() {
  if (!est) return;
  const p = $("#panel");
  if (p.hidden) return est.setDesplazamiento(0, 0);
  if (movil()) est.setDesplazamiento(0, p.offsetHeight / 2 - 30);
  else est.setDesplazamiento((p.offsetWidth + 12) / 2, 0);
}
function cerrarPanel() {
  if ($("#panel").hidden) return;
  const eraStand = actual && actual.tipo === "stand";
  $("#panel").hidden = true;
  actual = null;
  marcarNav(null);
  document.body.classList.remove("con-panel");
  if (est) { est.setDesplazamiento(0, 0); est.setEtiquetas(true); if (eraStand) est.seguir(); }
  alCerca(cercaDe);
}
function modal(html, c = "") {
  $("#modal").hidden = false;
  const caja = $("#modal-caja");
  caja.style.cssText = c; caja.innerHTML = html;
  return caja;
}
function cerrarModal() { $("#modal").hidden = true; $("#modal-caja").innerHTML = ""; }
function toast(t) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = t;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ---------- polen ----------
function ganar(n, motivo, desde) {
  J.polen += n; guardar();
  const r = desde || { x: innerWidth / 2, y: innerHeight / 2 };
  volar("🌟", Math.min(10, Math.ceil(n / 4)), r, "#btn-polen", () => contar($("#polen"), J.polen));
  flotante(`+${n} 🌟`, r.x, r.y, "#ffd76a");
  if (motivo) toast(`${motivo}: +${n} estrellas`);
}
function gastar(n) {
  if (J.polen < n) return false;
  J.polen -= n; guardar(); contar($("#polen"), J.polen);
  return true;
}
const centroDe = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

// ---------- navegación ----------
function irPlaza() {
  cerrarPanel(); cerrarModal();
  est && est.irA("plaza", null, { caminar: false });
  sonido.teleport();
  marcarNav("plaza");
}
function abrirPabellon(id) {
  const p = pab(id); if (!p) return;
  est && est.volarA("pabellon", id);
  sonido.teleport();
  const ms = MARCAS.filter((m) => m.pab === id);
  abrirPanel(`
    <div class="cab-marca"><div class="logo-m" style="--c:${p.color};--c2:#1e1446">${p.icono}</div>
      <div><h2>Pabellón ${esc(p.nombre)}</h2><p>${esc(p.lema)}</p></div></div>
    <div class="seccion"><h3>Stands (${ms.length})</h3><div class="lista-m">${ms.map(itemMarca).join("")}</div></div>
    <p class="nota">Toca un stand en el 3D o en la lista para entrar.</p>`, { tipo: "pabellon", id, c: `--c:${p.color}` });
  conectarItems();
}
const insignia = (m) => (m.nivel === "isla" ? `<span class="nivel isla">🏝️ Isla</span>` : m.nivel === "premium" ? `<span class="nivel">⭐ Premium</span>` : "");
const enPabellon = (m, pid) => m.pab === pid && m.nivel !== "isla";
function itemMarca(m) {
  const visto = J.visitados.includes(m.id);
  return `<button class="item-m" data-marca="${m.id}" style="${vars(m)}"><div class="logo-m">${m.icono}</div>
    <div class="txt"><b>${esc(m.nombre)} ${insignia(m)}</b><small>${esc(m.lema)} · ${esc(nombrePais(m.pais))}</small></div>
    ${visto ? `<span class="visto">✓ visto</span>` : `<span class="costo">+10 🌟</span>`}</button>`;
}
function conectarItems(r = document) { $$("[data-marca]", r).forEach((b) => (b.onclick = () => { sonido.tap(); abrirStand(b.dataset.marca); })); }

// ---------- stand ----------
function abrirStand(id, tab = "inicio", volarCam = true) {
  const m = marca(id); if (!m) return;
  if (volarCam) { est && est.enfocarStand(id); sonido.entrar(); }
  const cat = catalogo(m);
  abrirPanel(`
    <div class="cab-marca"><div class="logo-m">${m.icono}</div>
      <div><h2>${esc(m.nombre)}</h2><p>${esc(m.lema)}</p>
      <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">${m.nivel ? `<span class="chip c">${m.nivel === "isla" ? "🏝️" : "⭐"} ${NIVELES[m.nivel]}</span>` : ""}<span class="chip">${pab(m.pab).icono} ${esc(pab(m.pab).nombre)}</span><span class="chip">${esc(nombrePais(m.pais))}</span></div></div></div>
    <div class="tabs">
      <button data-tab="inicio">Inicio</button>
      <button data-tab="catalogo">Catálogo · ${cat.length}</button>
      <button data-tab="juega">🎰 Juega</button>
      <button data-tab="premios">🎁 Premios</button>
    </div>
    <div id="tab"></div>`, { tipo: "stand", id, c: vars(m) });
  actual.tab = tab;
  $$(".tabs button").forEach((b) => (b.onclick = () => { sonido.tap(); pintarTab(m, b.dataset.tab); }));
  pintarTab(m, tab);
  // Primera visita: sello + polen
  if (!J.visitados.includes(id)) {
    J.visitados.push(id); guardar(); sumar(id, "visitas");
    setTimeout(() => {
      ganar(10, null, { x: innerWidth / 2, y: innerHeight * 0.3 });
      flotante("🪪 Sello ✓", innerWidth / 2, innerHeight * 0.22, "#fff");
      revisarPabellon(m.pab);
    }, volarCam ? 900 : 100);
  } else if (volarCam) sumar(id, "visitas");
}

function pintarTab(m, tab) {
  actual.tab = tab;
  $$(".tabs button").forEach((b) => b.classList.toggle("activo", b.dataset.tab === tab));
  const caja = $("#tab");
  if (tab === "inicio") tabInicio(m, caja);
  else if (tab === "catalogo") tabCatalogo(m, caja);
  else if (tab === "juega") tabJuega(m, caja);
  else tabPremios(m, caja);
}

function tabInicio(m, caja) {
  const cat = catalogo(m), sigue = J.siguiendo.includes(m.id), vids = videosDe(m);
  const visto = (v) => J.videos.includes(v.id);
  caja.innerHTML = `
    <button class="video ancho" data-video="0">
      <div><div class="play">▶</div></div>
      <span class="lbl">${esc(vids[0].titulo)} · 10 s</span>
      <span class="premio-v chip ${visto(vids[0]) ? "" : "c"}">${visto(vids[0]) ? "✓ visto" : "+15 🌟"}</span>
    </button>
    ${vids.length > 1 ? `<div class="mini-videos">${vids.slice(1).map((v, i) => `<button class="mini-v" data-video="${i + 1}"><span class="mv-ico">${v.icono}</span><b>${esc(v.titulo)}</b><small>${visto(v) ? "✓ visto" : "+15 🌟"}</small></button>`).join("")}</div>` : ""}
    <p style="margin:12px 0 0">${esc(m.desc)}</p>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn chico" id="seguir">${sigue ? "✓ Siguiendo" : "＋ Seguir marca"}</button>
      <button class="btn chico sec" id="web">🌐 Su tienda en línea</button>
    </div>
    <div class="seccion"><h3>Destacados <button data-ir-tab="catalogo">Ver los ${cat.length} →</button></h3>
      <div class="grid-p">${cat.filter((p) => p.destacado).slice(0, 4).map(tarjetaProd).join("")}</div></div>
    <div class="seccion"><h3>Hoy en este stand</h3>
      <button class="tarjeta fila-t ancho" data-ir-tab="juega" style="text-align:left"><span class="grande">🎰</span><span class="txt"><b>${nombreJuego(m.actividad)}</b><small>${J.jugados[m.id] === hoy() ? "Ya jugaste hoy. Vuelve mañana." : "Una partida gratis al día"}</small></span><span class="costo">hasta 30 🌟</span></button>
      <button class="tarjeta fila-t ancho" data-ir-tab="premios" style="text-align:left"><span class="grande">🎟️</span><span class="txt"><b>${esc(m.cupon.texto)}</b><small>Cupón de la marca</small></span><span class="costo">${m.cupon.costo} 🌟</span></button>
    </div>`;
  $$("[data-video]", caja).forEach((b) => (b.onclick = () => verVideo(m, vids[+b.dataset.video])));
  $("#seguir").onclick = (e) => {
    const i = J.siguiendo.indexOf(m.id);
    if (i >= 0) J.siguiendo.splice(i, 1); else { J.siguiendo.push(m.id); sumar(m.id, "seguidores"); sonido.bien(); flotante("💜", centroDe(e.currentTarget).x, centroDe(e.currentTarget).y); }
    guardar(); tabInicio(m, caja);
  };
  $("#web").onclick = () => { sumar(m.id, "web"); modal(`<div class="ico-g">🌐</div><h3>Ir a la tienda de ${esc(m.nombre)}</h3><p class="suave">En la versión real este botón abre la tienda en línea de la marca. Weedland no vende: solo te lleva con ella.</p><div class="acciones"><button class="btn" onclick="this.closest('.modal').hidden=true">Entendido</button></div>`, vars(m)); };
  conectarTabs(caja, m); conectarProds(caja, m);
}
const nombreJuego = (a) => ({ ruleta: "Ruleta de la marca", quiz: "Trivia relámpago", rasca: "Rasca y gana" })[a];
function conectarTabs(r, m) { $$("[data-ir-tab]", r).forEach((b) => (b.onclick = () => { sonido.tap(); pintarTab(m, b.dataset.irTab); $("#panel-cuerpo").scrollTop = 0; })); }

function tarjetaProd(p) {
  return `<button class="prod" data-prod="${p.id}">${p.nuevo ? `<span class="nuevo">NUEVO</span>` : ""}<div class="ico">${p.icono}</div><b>${esc(p.nombre)}</b><small>${esc(p.cat)}</small><span class="precio">${esc(p.precio)}</span></button>`;
}
function conectarProds(r, m) {
  $$("[data-prod]", r).forEach((b) => (b.onclick = () => { sonido.tap(); verProducto(m, b.dataset.prod); }));
}
function verProducto(m, pid) {
  const p = catalogo(m).find((x) => x.id === pid); if (!p) return;
  sumar(m.id, "producto");
  const fav = J.favoritos.includes(pid);
  const caja = modal(`
    <button class="cerrar" data-x>✕</button>
    <div class="ico-g">${p.icono}</div>
    <span class="chip c">${esc(p.cat)}</span>
    <h3 style="margin-top:8px">${esc(p.nombre)}</h3>
    <p style="font:700 1.3rem Fredoka,sans-serif;color:${m.color};margin:6px 0">${esc(p.precio)}</p>
    <p class="suave">${esc(p.desc)}</p>
    <div class="acciones">
      <button class="btn" data-web>🌐 Verlo en ${esc(m.nombre)}</button>
      <button class="btn sec" data-fav>${fav ? "💜 En favoritos" : "🤍 Favorito"}</button>
    </div>
    <p class="nota">Precio de referencia. La compra se hace en la tienda de la marca, según la ley de tu país.</p>`, vars(m));
  $("[data-x]", caja).onclick = cerrarModal;
  $("[data-web]", caja).onclick = () => { sumar(m.id, "web"); toast("En la versión real se abre la tienda de la marca"); };
  $("[data-fav]", caja).onclick = (e) => {
    const i = J.favoritos.indexOf(pid);
    if (i >= 0) J.favoritos.splice(i, 1); else { J.favoritos.push(pid); sumar(m.id, "favoritos"); sonido.bien(); }
    guardar(); e.currentTarget.textContent = J.favoritos.includes(pid) ? "💜 En favoritos" : "🤍 Favorito";
  };
}

function tabCatalogo(m, caja) {
  const cat = catalogo(m), cats = [...new Set(cat.map((p) => p.cat))];
  let filtro = "Todo", q = "", n = 20;
  caja.innerHTML = `<input class="buscar" id="q" placeholder="Buscar en ${cat.length} productos…" autocomplete="off">
    <div class="chips" id="cats">${["Todo", ...cats].map((c) => `<button data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <div class="grid-p" id="prods"></div><div id="mas" style="text-align:center;margin-top:12px"></div>`;
  const pintar = () => {
    const lista = cat.filter((p) => (filtro === "Todo" || p.cat === filtro) && (!q || (p.nombre + " " + p.cat).toLowerCase().includes(q)));
    $("#prods").innerHTML = lista.slice(0, n).map(tarjetaProd).join("") || `<p class="suave">Nada por aquí. Prueba otra búsqueda.</p>`;
    $("#mas").innerHTML = lista.length > n ? `<button class="btn sec chico">Ver más (${lista.length - n})</button>` : "";
    const b = $("#mas button"); if (b) b.onclick = () => { n += 20; pintar(); };
    $$("#cats button").forEach((b) => b.classList.toggle("activo", b.dataset.c === filtro));
    conectarProds($("#prods"), m);
  };
  $("#q").oninput = (e) => { q = e.target.value.trim().toLowerCase(); n = 20; pintar(); };
  $$("#cats button").forEach((b) => (b.onclick = () => { sonido.tap(); filtro = b.dataset.c; n = 20; pintar(); }));
  pintar();
}

// ---------- video de marca (simulado: en la versión real es el video que sube la marca) ----------
function verVideo(m, v = videosDe(m)[0]) {
  const cat = catalogo(m).filter((p) => p.destacado);
  const k = Math.max(0, videosDe(m).findIndex((x) => x.id === v.id)), p0 = cat[k % Math.max(1, cat.length)] || {};
  const caja = modal(`
    <div class="rep">
      <div class="esc"><div class="e">${m.icono}</div><b>${esc(m.nombre)}</b><span>${esc(m.lema)}</span></div>
      <div class="esc"><div class="e">${k ? v.icono : p0.icono || m.icono}</div><b>${esc(k ? v.titulo : p0.nombre || m.nombre)}</b><span>${esc(m.anuncio)}</span></div>
      <div class="esc"><div class="e">🎟️</div><b>${esc(m.cupon.texto)}</b><span>Canjéalo con tus estrellas en este stand</span></div>
      <div class="prog"></div>
    </div>
    <p class="suave chico-t" style="margin:10px 0 0">Video de ejemplo. Aquí va el video que sube cada marca.</p>
    <div class="acciones"><button class="btn sec" data-x>Cerrar</button></div>`, vars(m));
  $("[data-x]", caja).onclick = () => { clearTimeout(fin); cerrarModal(); };
  const fin = setTimeout(() => {
    sumar(m.id, "videos");
    if (!J.videos.includes(v.id)) {
      J.videos.push(v.id); guardar();
      cerrarModal();
      ganar(15, "Video completo", { x: innerWidth / 2, y: innerHeight / 2 });
      sonido.premio();
      if (actual && actual.tipo === "stand" && actual.id === m.id) pintarTab(m, "inicio");
    } else { $(".acciones", caja).innerHTML = `<button class="btn" data-x>Listo</button>`; $("[data-x]", caja).onclick = cerrarModal; }
  }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 1500 : 10200);
}

// ---------- juegos ----------
function tabJuega(m, caja) {
  if (J.jugados[m.id] === hoy()) {
    caja.innerHTML = `<div class="tarjeta" style="text-align:center"><div style="font-size:3rem">⏳</div><h3>Ya jugaste hoy aquí</h3><p class="suave">Mañana tienes otra partida gratis. Mientras, visita otros stands: cada uno tiene su juego.</p>
      <button class="btn" id="otro">Llévame a otro stand</button></div>`;
    $("#otro").onclick = () => { const o = MARCAS.find((x) => x.id !== m.id && J.jugados[x.id] !== hoy()); if (o) abrirStand(o.id, "juega"); };
    return;
  }
  const fin = (premio, el) => {
    J.jugados[m.id] = hoy(); guardar(); sumar(m.id, "partidas");
    setTimeout(() => {
      if (premio >= 25) { cartel({ titulo: "¡JACKPOT!", sub: `+${premio} 🌟 de ${m.nombre}`, tipo: "dorada" }); sonido.jackpot(); }
      else if (premio > 0) { cartel({ titulo: "¡GANASTE!", sub: `+${premio} 🌟`, tipo: "normal", ms: 1500 }); sonido.premio(); }
      if (premio > 0) ganar(premio, null, el ? centroDe(el) : null);
      setTimeout(() => { if (actual && actual.id === m.id) tabJuega(m, caja); }, 1800);
    }, 300);
  };
  if (m.actividad === "ruleta") ruleta(m, caja, fin);
  else if (m.actividad === "rasca") rasca(m, caja, fin);
  else quiz(m, caja, fin);
}

function ruleta(m, caja, fin) {
  const premios = [5, 10, 30, 5, 15, 10, 20, 5];
  const colores = [m.color, m.color2, "#b18cff", m.color2, m.color, m.color2, "#ff7ad9", m.color2];
  const paso = 360 / premios.length;
  const fondo = `conic-gradient(${colores.map((c, i) => `${c} ${i * paso}deg ${(i + 1) * paso}deg`).join(",")})`;
  caja.innerHTML = `<h3 style="text-align:center">Ruleta de ${esc(m.nombre)}</h3><p class="suave" style="text-align:center;margin:4px 0">Gira gratis una vez al día</p>
    <div class="ruleta"><div class="flecha"></div><div class="rueda" id="rueda" style="background:${fondo}">
      ${premios.map((p, i) => `<span style="transform:rotate(${i * paso + paso / 2 - 90}deg) translate(28%, -50%)">${p} 🌟</span>`).join("")}
    </div><div class="centro">${m.icono}</div></div>
    <button class="btn oro ancho" id="girar">🎰 ¡Girar!</button>`;
  $("#girar").onclick = (e) => {
    e.currentTarget.disabled = true;
    const i = Math.floor(Math.random() * premios.length);
    const giro = 360 * 6 + (360 - (i * paso + paso / 2));
    $("#rueda").style.transform = `rotate(${giro}deg)`;
    let k = 0; const tic = setInterval(() => { sonido.tick(); if (++k > 26) clearInterval(tic); }, 140);
    setTimeout(() => fin(premios[i], $("#rueda")), 4100);
  };
}

function rasca(m, caja, fin) {
  const simb = [m.icono, "🌟", "🍀", "💎", "🌀"];
  const gana = Math.random() < 0.55;
  const s = gana ? simb[Math.floor(Math.random() * 4)] : null;
  let celdas = [];
  if (gana) { celdas = [s, s, s]; while (celdas.length < 9) { const o = simb[Math.floor(Math.random() * 5)]; if (o !== s && celdas.filter((x) => x === o).length < 2) celdas.push(o); } }
  else { while (celdas.length < 9) { const o = simb[Math.floor(Math.random() * 5)]; if (celdas.filter((x) => x === o).length < 2) celdas.push(o); } }
  celdas.sort(() => Math.random() - 0.5);
  const premioDe = { "💎": 30, "🌟": 20, "🍀": 15 }; const premio = gana ? premioDe[s] || 25 : 5;
  caja.innerHTML = `<h3 style="text-align:center">Rasca y gana · ${esc(m.nombre)}</h3><p class="suave" style="text-align:center;margin:4px 0">Toca las 9 casillas. Tres iguales = premio</p>
    <div class="rasca">${celdas.map((c, i) => `<button data-i="${i}">${c}</button>`).join("")}</div>
    <p class="suave chico-t" style="text-align:center">💎 30 · 🌟 20 · 🍀 15 · ${m.icono} 25 · Si no sale trío, igual te llevas 5 🌟</p>`;
  let abiertas = 0;
  $$(".rasca button", caja).forEach((b) => (b.onclick = () => {
    if (b.classList.contains("ab")) return;
    b.classList.add("ab"); sonido.rasca(); abiertas++;
    if (abiertas === 9) {
      if (gana) $$(".rasca button", caja).forEach((x) => x.textContent === s && x.classList.add("gana"));
      fin(premio, $(".rasca", caja));
    }
  }));
}

function quiz(m, caja, fin) {
  const qs = preguntasMarca(m);
  let i = 0, bien = 0;
  const pintar = () => {
    const q = qs[i];
    caja.innerHTML = `<h3 style="text-align:center">Trivia relámpago</h3><p class="suave" style="text-align:center;margin:4px 0">Pregunta ${i + 1} de ${qs.length} · 10 🌟 por acierto</p>
      <div class="tarjeta" style="margin-top:10px"><b>${esc(q.p)}</b>${q.ops.map((o, k) => `<button class="op" data-k="${k}">${esc(o)}</button>`).join("")}</div>`;
    $$(".op", caja).forEach((b) => (b.onclick = () => {
      $$(".op", caja).forEach((x) => (x.disabled = true));
      const k = +b.dataset.k;
      if (k === q.ok) { b.classList.add("bien"); bien++; sonido.bien(); } else { b.classList.add("mal"); $$(".op", caja)[q.ok].classList.add("bien"); sonido.mal(); }
      setTimeout(() => { i++; if (i < qs.length) pintar(); else fin(bien * 10, $(".tarjeta", caja)); }, 900);
    }));
  };
  pintar();
}

// ---------- premios del stand ----------
function tabPremios(m, caja) {
  const mios = J.cupones.filter((c) => c.marca === m.id), bol = J.boletos[m.id] || 0;
  caja.innerHTML = `
    <div class="tarjeta"><div class="fila-t"><span class="grande">🎟️</span><div class="txt"><b>${esc(m.cupon.texto)}</b><small>Cupón para la tienda de ${esc(m.nombre)}</small></div><span class="costo">${m.cupon.costo} 🌟</span></div>
      <button class="btn oro ancho" style="margin-top:10px" id="canjear" ${J.polen < m.cupon.costo ? "disabled" : ""}>${J.polen < m.cupon.costo ? `Te faltan ${m.cupon.costo - J.polen} 🌟` : "Canjear cupón"}</button></div>
    ${semillasDe().some((x) => x.marca === m.id) ? `<button class="tarjeta fila-t ancho" id="semillas-marca" style="text-align:left"><span class="grande">🌱</span><span class="txt"><b>Semillas de ${esc(m.nombre)} para tu cultivo</b><small>${semillasDe().filter((x) => x.marca === m.id).length} variedades registradas · se compran con estrellas</small></span><span class="costo">▶</span></button>` : ""}
    <div class="tarjeta"><div class="fila-t"><span class="grande">🎁</span><div class="txt"><b>Sorteo: ${esc(m.sorteo)}</b><small>Cada boleto es una oportunidad. Tienes ${bol}.</small></div><span class="costo">20 🌟</span></div>
      <button class="btn ancho" style="margin-top:10px" id="boleto" ${J.polen < 20 ? "disabled" : ""}>Comprar boleto con estrellas</button></div>
    ${mios.length ? `<div class="seccion"><h3>Tus cupones de ${esc(m.nombre)}</h3>${mios.map((c) => `<div class="tarjeta"><b>${esc(c.texto)}</b><div style="margin-top:8px"><span class="codigo">${c.codigo}</span></div></div>`).join("")}</div>` : ""}
    <p class="nota">¿Te faltan estrellas? Gánalas visitando stands (+10), viendo videos (+15), jugando (hasta 30), aprendiendo en el Mercado (+10) y vendiendo en tu tienda. Cupones sujetos a los términos de la marca y a la ley de tu país.</p>`;
  const sm = $("#semillas-marca"); if (sm) sm.onclick = () => irLugar("puesto", "semillas", () => abrirPuesto("semillas", m.nombre.toLowerCase()));
  $("#canjear").onclick = (e) => {
    if (!gastar(m.cupon.costo)) return;
    const c = { marca: m.id, texto: m.cupon.texto, codigo: codigo(m.sigla), fecha: hoy() };
    J.cupones.push(c); guardar(); sumar(m.id, "cupones");
    sonido.jackpot(); cartel({ titulo: "¡CUPÓN TUYO!", sub: `${m.cupon.texto} · ${c.codigo}`, tipo: "dorada", ms: 2600 });
    tabPremios(m, caja);
  };
  $("#boleto").onclick = (e) => {
    if (!gastar(20)) return;
    J.boletos[m.id] = bol + 1; guardar(); sumar(m.id, "boletos");
    sonido.premio(); flotante("🎟️ +1", centroDe(e.currentTarget).x, centroDe(e.currentTarget).y, "#fff"); confeti(14);
    tabPremios(m, caja);
  };
}

// ---------- directorio de marcas (y buscador de productos) ----------
function abrirDirectorio() {
  abrirPanel(`
    <h2>Marcas de la expo</h2>
    <p class="suave" style="margin:4px 0 12px">${MARCAS.length} stands en ${PABELLONES.length} pabellones · ${J.visitados.length} visitados</p>
    <input class="buscar" id="qd" placeholder="Busca una marca o un producto…" autocomplete="off">
    <div id="dir"></div>`, { tipo: "directorio", nav: "directorio", alto: true });
  const pintar = (q = "") => {
    let html = "";
    if (q.length > 1) {
      const res = [];
      MARCAS.forEach((m) => catalogo(m).forEach((p) => { if ((p.nombre + " " + p.cat).toLowerCase().includes(q)) res.push({ m, p }); }));
      const ms = MARCAS.filter((m) => (m.nombre + " " + m.lema).toLowerCase().includes(q));
      html += ms.length ? `<div class="grupo-t">Marcas</div><div class="lista-m">${ms.map(itemMarca).join("")}</div>` : "";
      html += res.length ? `<div class="grupo-t">Productos (${res.length})</div><div class="lista-m">${res.slice(0, 30).map(({ m, p }) => `<button class="item-m" data-pm="${m.id}|${p.id}" style="${vars(m)}"><div class="logo-m">${p.icono}</div><div class="txt"><b>${esc(p.nombre)}</b><small>${esc(m.nombre)} · ${esc(p.precio)}</small></div></button>`).join("")}</div>` : "";
      if (!html) html = `<p class="suave">No encontramos “${esc(q)}”.</p>`;
    } else {
      html = `<div class="grupo-t" style="--c:#ffd76a">🏝️ Islas de marca</div><div class="lista-m">${MARCAS.filter((m) => m.nivel === "isla").map(itemMarca).join("")}</div>` +
        PABELLONES.map((p) => `<div class="grupo-t" style="--c:${p.color}">${p.icono} ${esc(p.nombre)}</div><div class="lista-m">${MARCAS.filter((m) => enPabellon(m, p.id)).sort((a, b) => (b.nivel ? 1 : 0) - (a.nivel ? 1 : 0)).map(itemMarca).join("")}</div>`).join("");
    }
    $("#dir").innerHTML = html;
    conectarItems($("#dir"));
    $$("[data-pm]", $("#dir")).forEach((b) => (b.onclick = () => { const [mid, pid] = b.dataset.pm.split("|"); abrirStand(mid, "catalogo"); setTimeout(() => verProducto(marca(mid), pid), 400); }));
  };
  $("#qd").oninput = (e) => pintar(e.target.value.trim().toLowerCase());
  pintar();
}

// ---------- premios (canje de estrellas) ----------
function abrirPremios() {
  const cupones = MARCAS.slice().sort((a, b) => a.cupon.costo - b.cupon.costo);
  abrirPanel(`
    <h2>🎁 Premios</h2>
    <div class="tarjeta" style="margin-top:12px;text-align:center;border-color:var(--oro)">
      <div style="font:700 2.2rem Fredoka,sans-serif;color:var(--oro)">🌟 ${J.polen}</div>
      <div class="suave">estrellas</div>
      <p style="margin:10px 0 0;font-size:.9rem">Cámbialo por <b>cupones reales</b> en la tienda de cada marca o por <b>boletos para sus sorteos</b>.</p>
    </div>
    <div class="seccion"><h3>¿Cómo gano más?</h3>
      <div class="tarjeta"><div class="fila-t"><span class="grande">🏛️</span><div class="txt"><b>Visita un stand nuevo</b><small>${J.visitados.length} de ${MARCAS.length} visitados</small></div><span class="costo">+10</span></div></div>
      <div class="tarjeta"><div class="fila-t"><span class="grande">🎬</span><div class="txt"><b>Ve el video de una marca</b><small>10 segundos</small></div><span class="costo">+15</span></div></div>
      <div class="tarjeta"><div class="fila-t"><span class="grande">🎰</span><div class="txt"><b>Juega en cada stand</b><small>Una partida gratis al día por stand</small></div><span class="costo">hasta 30</span></div></div>
      <div class="tarjeta"><div class="fila-t"><span class="grande">🏪</span><div class="txt"><b>Vende en tu tienda</b><small>Cosecha, transforma en el Mercado y vende</small></div><span class="costo">+12 a +40</span></div></div>
      <div class="tarjeta"><div class="fila-t"><span class="grande">💡</span><div class="txt"><b>Aprende en el Mercado</b><small>Cada puesto te cuenta algo</small></div><span class="costo">+10</span></div></div>
      <div class="tarjeta"><div class="fila-t"><span class="grande">🪪</span><div class="txt"><b>Completa un pabellón</b><small>Visita todos sus stands</small></div><span class="costo">+50</span></div></div>
    </div>
    ${J.cupones.length ? `<div class="seccion"><h3>Mis cupones (${J.cupones.length})</h3>${J.cupones.map((c) => { const m = marca(c.marca); return `<div class="tarjeta" style="${vars(m)}"><div class="fila-t"><span class="grande">${m.icono}</span><div class="txt"><b>${esc(c.texto)}</b><small>${esc(m.nombre)}</small></div></div><div style="margin-top:8px"><span class="codigo">${c.codigo}</span></div></div>`; }).join("")}</div>` : ""}
    <div class="seccion"><h3>Cupones de las marcas</h3><div class="lista-m">
      ${cupones.map((m) => `<button class="item-m" data-cupon="${m.id}" style="${vars(m)}"><div class="logo-m">${m.icono}</div><div class="txt"><b>${esc(m.cupon.texto)}</b><small>${esc(m.nombre)}</small></div><span class="costo">${m.cupon.costo} 🌟</span></button>`).join("")}
    </div></div>
    <button class="btn sec ancho" id="ver-pasaporte" style="margin-top:14px">🪪 Ver tu pasaporte</button>
    <p class="nota">Los cupones son descuentos o regalos en la tienda de cada marca, sujetos a sus términos y a la ley de tu país. Weedland no vende productos.</p>`, { tipo: "premios", nav: "premios" });
  $("#ver-pasaporte").onclick = () => { sonido.tap(); abrirPasaporte(); };
  $$("[data-cupon]").forEach((b) => (b.onclick = () => { sonido.tap(); abrirStand(b.dataset.cupon, "premios"); }));
}

// ---------- pasaporte ----------
function revisarPabellon(pid) {
  const ids = MARCAS.filter((m) => enPabellon(m, pid)).map((m) => m.id);
  if (ids.every((id) => J.visitados.includes(id)) && !J.bonos.includes(pid)) {
    J.bonos.push(pid); guardar();
    setTimeout(() => { cartel({ titulo: "¡PABELLÓN COMPLETO!", sub: `${pab(pid).icono} ${pab(pid).nombre} · +50 🌟`, tipo: "dorada", ms: 2600 }); sonido.jackpot(); ganar(50); }, 1600);
  }
}
function abrirPasaporte() {
  const total = MARCAS.length, vistos = J.visitados.length;
  abrirPanel(`
    <h2>🪪 Tu pasaporte</h2>
    <p class="suave" style="margin:4px 0 10px">Cada stand que visitas te pone un sello. Completa un pabellón y ganas 50 🌟.</p>
    <div class="barra"><i style="width:${(vistos / total) * 100}%"></i></div>
    <p class="chico-t suave" style="margin:6px 0 0">${vistos} de ${total} stands · ${J.cupones.length} cupones · ${Object.values(J.boletos).reduce((a, b) => a + b, 0)} boletos · ${J.sabias.length} lecciones del Mercado</p>
    ${PABELLONES.map((p) => {
      const ms = MARCAS.filter((m) => enPabellon(m, p.id));
      return `<div class="grupo-t" style="--c:${p.color}">${p.icono} ${esc(p.nombre)} ${J.bonos.includes(p.id) ? `<span class="hecho">✓ completo</span>` : ""}</div>
        <div class="sellos">${ms.map((m) => `<button class="sello ${J.visitados.includes(m.id) ? "si" : ""}" data-marca="${m.id}" style="${vars(m)}"><div><span>${J.visitados.includes(m.id) ? m.icono : "？"}</span>${esc(m.nombre)}</div></button>`).join("")}</div>`;
    }).join("")}
    <div class="grupo-t" style="--c:#ffd76a">🏝️ Islas de marca</div>
    <div class="sellos">${MARCAS.filter((m) => m.nivel === "isla").map((m) => `<button class="sello ${J.visitados.includes(m.id) ? "si" : ""}" data-marca="${m.id}" style="${vars(m)}"><div><span>${J.visitados.includes(m.id) ? m.icono : "？"}</span>${esc(m.nombre)}</div></button>`).join("")}</div>
    <div class="grupo-t" style="--c:#ffd76a">🛒 Mercado</div>
    <div class="sellos">${PUESTOS.map((pu) => `<div class="sello ${J.sabias.includes(pu.id) || J.talleresVistos.includes(pu.id) ? "si" : ""}" style="--c:${pu.color}"><div><span>${pu.icono}</span>${esc(pu.nombre)}</div></div>`).join("")}</div>`,
  { tipo: "pasaporte", nav: "premios", alto: true });
  conectarItems($("#panel-cuerpo"));
}

// ---------- cultivo, mercado, tienda y nave ----------
const semillasDe = () => semillasRegistradas(MARCAS);
const semillaPorId = (id) => semillasDe().find((s) => s.id === id);
const objNombre = (k) => (OBJETOS[k] ? `${OBJETOS[k].icono} ${OBJETOS[k].nombre}` : k);
const total = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
function sumarInv(bolsa, k, n = 1) { J[bolsa][k] = (J[bolsa][k] || 0) + n; if (J[bolsa][k] <= 0) delete J[bolsa][k]; }
const PATROCINIO_CULTIVO = ["lumen", "tierra", "aqua", "clima-grow", "sensor-verde", "maceta-viva", "abono-andino", "luz-solar-pro", "hidro-lab"];

function estadoParcelas() {
  return J.parcelas.map((p) => p && { tipo: p.tipo, prog: progreso(p), listo: progreso(p) >= 1, aditamentos: p.aditamentos || [] });
}
function refrescarCultivo() {
  if (!est) return;
  est.setParcelas(estadoParcelas());
  const listas = J.parcelas.filter((p) => p && progreso(p) >= 1).length;
  const b = $('.nav [data-ir="cultivo"]'); if (b) b.dataset.aviso = listas ? String(listas) : "";
}
// Reloj: plantas que crecen y compradores que llegan a tu tienda
function relojGranja() {
  refrescarCultivo();
  const c = $("#cuenta-atras");
  if (c && actual && actual.tipo === "parcela") {
    const p = J.parcelas[actual.id];
    if (!p) return;
    if (progreso(p) >= 1) abrirParcela(actual.id);
    else { c.textContent = tiempoTexto(faltan(p)); const bar = $("#barra-parcela"); if (bar) bar.style.width = progreso(p) * 100 + "%"; }
  }
  revisarVentas(false);
}
function revisarVentas(silencioso) {
  const ahora = Date.now(), vendidos = J.tienda.filter((it) => it.vence <= ahora);
  if (!vendidos.length) return;
  J.tienda = J.tienda.filter((it) => it.vence > ahora);
  let suma = 0;
  vendidos.forEach((it) => {
    const quien = COMPRADORES[Math.floor(Math.random() * COMPRADORES.length)];
    J.ventas.unshift({ item: it.item, precio: it.precio, quien, fecha: Date.now() }); suma += it.precio;
    if (!silencioso) { toast(`🛍️ ${quien} compró tu ${OBJETOS[it.item].nombre}: +${it.precio} ⭐`); est && est.venta(); }
  });
  J.ventas = J.ventas.slice(0, 12);
  if (silencioso) { J.polen += suma; guardar(); contar($("#polen"), J.polen); setTimeout(() => toast(`Mientras no estabas, tu tienda vendió ${vendidos.length}: +${suma} ⭐`), 2500); }
  else { ganar(suma); sonido.moneda(); }
  est && est.setTienda(J.tienda.map((it) => ({ icono: OBJETOS[it.item].icono })));
  if (actual && actual.tipo === "tienda") abrirTienda();
}

// Ir a un lugar de las islas: caminando si estás cerca, de un salto si estás lejos
function irLugar(tipo, id, cb, saltar = true) {
  if (actual) cerrarPanel();
  est && est.irA(tipo, id, { caminar: !saltar, cb });
  if (saltar) sonido.teleport();
}

function abrirCultivo() {
  refrescarCultivo();
  if (!J.regaloSemilla) {
    const s = semillasDe()[0];
    if (s) { J.regaloSemilla = true; sumarInv("semillas", s.id); guardar(); setTimeout(() => { cartel({ titulo: "¡SEMILLA DE REGALO!", sub: `🌱 ${s.nombre} de ${marca(s.marca).nombre}`, ms: 2200 }); sonido.premio(); }, 500); }
  }
  const celdas = J.parcelas.map((p, i) => {
    if (!p) return `<button class="parcela-c" data-parcela="${i}"><span class="pc-ico">🟫</span><b>Parcela ${i + 1}</b><small>Vacía · sembrar</small></button>`;
    const pr = progreso(p);
    return `<button class="parcela-c ${pr >= 1 ? "lista" : ""}" data-parcela="${i}"><span class="pc-ico">${pr >= 1 ? "✨" : p.tipo === "canamo" ? "🌾" : "🌱"}</span><b>${esc(p.nombre)}</b>
      <small>${pr >= 1 ? "¡Lista para cosechar!" : `${Math.floor(pr * 100)}% · ${tiempoTexto(faltan(p))}`}</small><i style="width:${pr * 100}%"></i></button>`;
  }).join("");
  abrirPanel(`
    <div class="cab-marca"><div class="logo-m" style="--c:#7dffb3;--c2:#0f5d43">🌱</div>
      <div><h2>Mi cultivo</h2><p>Cada planta tarda 2 horas. Los aditamentos y los videos de las marcas la aceleran.</p></div></div>
    <div class="parcelas">${celdas}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="btn chico" id="ir-mercado">🛒 Ir al Mercado</button>
      <button class="btn chico sec" id="ir-tienda">🏪 Tu tienda (${J.tienda.length})</button>
    </div>
    ${mochila()}`, { tipo: "cultivo", nav: "cultivo", c: "--c:#7dffb3" });
  $$("[data-parcela]").forEach((b) => (b.onclick = () => { sonido.tap(); abrirParcela(+b.dataset.parcela); }));
  $("#ir-mercado").onclick = () => irLugar("mercado", null, () => abrirMercado());
  $("#ir-tienda").onclick = () => irLugar("tienda", null, () => abrirTienda(), false);
}
function mochila() {
  const sem = Object.entries(J.semillas).map(([id, n]) => { const s = semillaPorId(id); return s ? `<span class="chip">${s.icono} ${esc(s.nombre)} ×${n}</span>` : ""; }).join("");
  const adi = Object.entries(J.aditamentos).map(([id, n]) => { const a = aditamento(id); return a ? `<span class="chip">${a.icono} ${esc(a.nombre)} ×${n}</span>` : ""; }).join("");
  const inv = Object.entries(J.inv).map(([k, n]) => `<span class="chip">${objNombre(k)} ×${n}</span>`).join("");
  return `<div class="seccion"><h3>🎒 Tu mochila</h3>
    <div class="mochila"><b>Semillas</b><div>${sem || `<span class="suave chico-t">Ninguna. Cómpralas en el Banco de semillas del Mercado.</span>`}</div>
    <b>Aditamentos</b><div>${adi || `<span class="suave chico-t">Ninguno. Están en la Tienda de cultivo.</span>`}</div>
    <b>Cosecha y productos</b><div>${inv || `<span class="suave chico-t">Aún nada. Cosecha y transforma en los talleres.</span>`}</div></div></div>`;
}

function abrirParcela(i) {
  const p = J.parcelas[i];
  const cab = (sub) => `<div class="cab-marca"><div class="logo-m" style="--c:#7dffb3;--c2:#0f5d43">${p ? (p.tipo === "canamo" ? "🌾" : "🌱") : "🟫"}</div><div><h2>Parcela ${i + 1}</h2><p>${sub}</p></div></div>`;
  if (!p) {
    const mias = Object.entries(J.semillas).map(([id, n]) => ({ s: semillaPorId(id), n })).filter((x) => x.s);
    abrirPanel(`${cab("Vacía: elige una semilla de tu mochila")}
      ${mias.length ? `<div class="lista-m" style="margin-top:12px">${mias.map(({ s, n }) => { const m = marca(s.marca); return `<button class="item-m" data-sembrar="${s.id}" style="${vars(m)}"><div class="logo-m">${s.icono}</div><div class="txt"><b>${esc(s.nombre)}</b><small>${esc(m.nombre)} · tienes ${n}</small></div><span class="costo">Sembrar</span></button>`; }).join("")}</div>`
        : `<div class="tarjeta" style="margin-top:12px;text-align:center"><div style="font-size:2.4rem">🌰</div><b>No tienes semillas</b><p class="suave">Las semillas son las que registran las marcas. Cómpralas con estrellas en el Banco de semillas.</p><button class="btn" id="ir-banco">🌱 Ir al Banco de semillas</button></div>`}
      <p class="nota">Juego virtual: aquí no se venden semillas reales.</p>`, { tipo: "parcela", id: i, nav: "cultivo", c: "--c:#7dffb3" });
    $$("[data-sembrar]").forEach((b) => (b.onclick = () => sembrar(i, b.dataset.sembrar)));
    const ib = $("#ir-banco"); if (ib) ib.onclick = () => irLugar("puesto", "semillas", () => abrirPuesto("semillas"));
    return;
  }
  const m = marca(p.marca), pr = progreso(p);
  if (pr >= 1) {
    const r = rinde(p);
    abrirPanel(`${cab(`${esc(p.nombre)} de ${esc(m.nombre)}`)}
      <div class="tarjeta lista-cosecha"><div style="font-size:3rem">✨🌿✨</div><h3>¡Lista para cosechar!</h3>
      <p class="suave">Vas a recibir: ${Object.entries(r).map(([k, n]) => `${objNombre(k)} ×${n}`).join(" · ")}</p>
      <button class="btn oro ancho" id="cosechar">🧺 Cosechar</button></div>`, { tipo: "parcela", id: i, nav: "cultivo", c: "--c:#7dffb3" });
    $("#cosechar").onclick = (e) => cosechar(i, centroDe(e.currentTarget));
    return;
  }
  const tengo = Object.entries(J.aditamentos).map(([id, n]) => ({ a: aditamento(id), n })).filter((x) => x.a && !p.aditamentos.includes(x.a.id));
  const sponsor = marca(PATROCINIO_CULTIVO[(p.videos + i) % PATROCINIO_CULTIVO.length]) || m;
  abrirPanel(`${cab(`${esc(p.nombre)} de ${esc(m.nombre)}`)}
    <div class="tarjeta" style="margin-top:12px"><div class="fila-t"><span class="grande">⏳</span><div class="txt"><b>Faltan <span id="cuenta-atras">${tiempoTexto(faltan(p))}</span></b><small>Velocidad: ${Math.round((1 / factorVel(p)) * 100)}% · videos vistos ${p.videos}/${MAX_VIDEOS}</small></div></div>
      <div class="barra" style="margin-top:10px"><i id="barra-parcela" style="width:${pr * 100}%"></i></div></div>
    ${p.videos < MAX_VIDEOS ? `<button class="tarjeta fila-t ancho" id="ver-anuncio" style="text-align:left;margin-top:10px;${vars(sponsor)}"><span class="grande">📺</span><span class="txt"><b>Ver video de ${esc(sponsor.nombre)}</b><small>10 segundos y tu planta crece 15 minutos</small></span><span class="costo">−15 min</span></button>` : ""}
    <div class="seccion"><h3>Aditamentos</h3>
      ${p.aditamentos.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${p.aditamentos.map((id) => `<span class="chip c">${aditamento(id).icono} ${esc(aditamento(id).nombre)} ✓</span>`).join("")}</div>` : ""}
      ${tengo.length ? `<div class="lista-m">${tengo.map(({ a, n }) => `<button class="item-m" data-aplicar="${a.id}"><div class="logo-m" style="--c:#6ff0ff;--c2:#0c3d5a">${a.icono}</div><div class="txt"><b>${esc(a.nombre)} ×${n}</b><small>${esc(a.desc)}</small></div><span class="costo">Usar</span></button>`).join("")}</div>`
        : `<p class="suave chico-t">No tienes aditamentos para esta planta. <button class="enlace" id="ir-aditamentos">Cómpralos en la Tienda de cultivo →</button></p>`}
    </div>`, { tipo: "parcela", id: i, nav: "cultivo", c: "--c:#7dffb3" });
  $$("[data-aplicar]").forEach((b) => (b.onclick = () => {
    const a = aditamento(b.dataset.aplicar);
    p.aditamentos.push(a.id); sumarInv("aditamentos", a.id, -1); sumar(a.marca, "aditamentosUsados"); guardar();
    sonido.burbuja(); flotante(`${a.icono} ¡${a.vel ? "más rápido" : "más cosecha"}!`, centroDe(b).x, centroDe(b).y, "#6ff0ff");
    refrescarCultivo(); abrirParcela(i);
  }));
  const va = $("#ver-anuncio"); if (va) va.onclick = () => verAnuncio(sponsor, () => { p.videos++; guardar(); sumar(sponsor.id, "videos"); flotante("−15 min ⏩", innerWidth / 2, innerHeight / 2, "#6ff0ff"); sonido.premio(); refrescarCultivo(); abrirParcela(i); });
  const ia = $("#ir-aditamentos"); if (ia) ia.onclick = () => irLugar("puesto", "aditamentos", () => abrirPuesto("aditamentos"));
}
function sembrar(i, sid) {
  const s = semillaPorId(sid); if (!s || !J.semillas[sid]) return;
  sumarInv("semillas", sid, -1);
  J.parcelas[i] = { semilla: sid, marca: s.marca, nombre: s.nombre, tipo: s.tipo, plantada: Date.now(), aditamentos: [], videos: 0 };
  guardar(); sumar(s.marca, "sembradas");
  sonido.siembra(); confeti(10);
  refrescarCultivo(); abrirParcela(i);
}
function cosechar(i, desde) {
  const p = J.parcelas[i]; if (!p || progreso(p) < 1) return;
  const r = rinde(p);
  Object.entries(r).forEach(([k, n]) => sumarInv("inv", k, n));
  const vuelve = Math.random() < 0.35;
  if (vuelve) sumarInv("semillas", p.semilla, 1);
  J.parcelas[i] = null; guardar();
  cartel({ titulo: "¡COSECHA!", sub: Object.entries(r).map(([k, n]) => `${OBJETOS[k].icono}×${n}`).join("  ") + (vuelve ? "  +🌱 semilla" : ""), tipo: "dorada", ms: 2200 });
  sonido.cosecha();
  Object.entries(r).forEach(([k, n]) => volar(OBJETOS[k].icono, n, desde, '.nav [data-ir="cultivo"]'));
  refrescarCultivo();
  setTimeout(() => abrirParcela(i), 600);
}
// Video patrocinado de 10 segundos (simulado)
function verAnuncio(m, alTerminar) {
  const caja = modal(`
    <div class="rep">
      <div class="esc"><div class="e">${m.icono}</div><b>${esc(m.nombre)}</b><span>${esc(m.lema)}</span></div>
      <div class="esc"><div class="e">${(catalogo(m)[0] || {}).icono || m.icono}</div><b>${esc((catalogo(m)[0] || {}).nombre || m.nombre)}</b><span>${esc(m.anuncio)}</span></div>
      <div class="esc"><div class="e">🌱</div><b>¡Gracias por ver!</b><span>Tu planta creció un poco más</span></div>
      <div class="prog"></div>
    </div>
    <p class="suave chico-t" style="margin:10px 0 0">Video de ejemplo de la marca.</p>
    <div class="acciones"><button class="btn sec" data-x>Cerrar</button></div>`, vars(m));
  const fin = setTimeout(() => { cerrarModal(); alTerminar(); }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 1500 : 10200);
  $("[data-x]", caja).onclick = () => { clearTimeout(fin); cerrarModal(); };
}

// ---------- Mercado ----------
function abrirMercado() {
  abrirPanel(`
    <div class="cab-marca"><div class="logo-m" style="--c:#ffd76a;--c2:#5a4310">🛒</div>
      <div><h2>Mercado</h2><p>Compra semillas y aditamentos, y transforma tu cosecha en productos para tu tienda.</p></div></div>
    <div class="lista-m" style="margin-top:12px">${PUESTOS.map((pu) => `<button class="item-m" data-puesto="${pu.id}" style="--c:${pu.color};--c2:#1e1446"><div class="logo-m">${pu.icono}</div><div class="txt"><b>${esc(pu.nombre)}</b><small>${pu.marca ? `Patrocina ${esc(marca(pu.marca).nombre)}` : pu.tipo === "semillas" ? "Semillas registradas por las marcas" : "Aditamentos de las marcas de Cultivo"}</small></div><span class="costo">▶</span></button>`).join("")}</div>`,
  { tipo: "mercado", nav: "mercado", c: "--c:#ffd76a" });
  $$("[data-puesto]").forEach((b) => (b.onclick = () => { sonido.tap(); irLugar("puesto", b.dataset.puesto, () => abrirPuesto(b.dataset.puesto), false); }));
}
function abrirPuesto(id, filtro = "") {
  const pu = puesto(id); if (!pu) return;
  const pat = pu.marca ? marca(pu.marca) : null;
  let cuerpo = "";
  if (pu.tipo === "semillas") {
    const todas = semillasDe();
    const lista = todas.filter((s) => !filtro || (s.nombre + " " + marca(s.marca).nombre).toLowerCase().includes(filtro));
    cuerpo = `<input class="buscar" id="q-sem" placeholder="Buscar entre ${todas.length} semillas registradas…" value="${esc(filtro)}" autocomplete="off">
      <div class="lista-m" style="margin-top:10px">${lista.slice(0, 40).map((s) => { const m = marca(s.marca); const n = J.semillas[s.id] || 0; return `<div class="item-m" style="${vars(m)}"><div class="logo-m">${s.icono}</div><div class="txt"><b>${esc(s.nombre)}</b><small>${esc(m.nombre)} · ${s.tipo === "canamo" ? "fibra y grano" : "flor"}${n ? ` · tienes ${n}` : ""}</small></div><button class="btn chico oro" data-comprar-s="${s.id}" ${J.polen < s.costo ? "disabled" : ""}>${s.costo} ⭐</button></div>`; }).join("")}</div>
      ${lista.length > 40 ? `<p class="suave chico-t">…y ${lista.length - 40} más. Usa el buscador.</p>` : ""}`;
  } else if (pu.tipo === "aditamentos") {
    cuerpo = `<div class="lista-m">${ADITAMENTOS.map((a) => { const m = marca(a.marca) || { color: "#6ff0ff", color2: "#0c3d5a", nombre: "" }; const n = J.aditamentos[a.id] || 0; return `<div class="item-m" style="${vars(m)}"><div class="logo-m">${a.icono}</div><div class="txt"><b>${esc(a.nombre)}</b><small>${esc(m.nombre)} · ${esc(a.desc)}${n ? ` · tienes ${n}` : ""}</small></div><button class="btn chico oro" data-comprar-a="${a.id}" ${J.polen < a.costo ? "disabled" : ""}>${a.costo} ⭐</button></div>`; }).join("")}</div>`;
  } else {
    cuerpo = `<div class="lista-m">${pu.recetas.map(([prod, ing]) => {
      const ok = Object.entries(ing).every(([k, n]) => (J.inv[k] || 0) >= n);
      return `<div class="item-m"><div class="logo-m" style="--c:${pu.color};--c2:#1e1446">${OBJETOS[prod].icono}</div><div class="txt"><b>${esc(OBJETOS[prod].nombre)}</b><small>${Object.entries(ing).map(([k, n]) => `${OBJETOS[k].icono}${J.inv[k] || 0}/${n}`).join(" · ")} · vale ~${OBJETOS[prod].valor} ⭐</small></div><button class="btn chico" data-hacer="${prod}" ${ok ? "" : "disabled"}>Hacer</button></div>`;
    }).join("")}</div>
    ${pat ? `<button class="tarjeta fila-t ancho" id="video-taller" style="text-align:left;margin-top:10px;${vars(pat)}"><span class="grande">🎬</span><span class="txt"><b>Así se hace · video de ${esc(pat.nombre)}</b><small>Patrocinador del ${esc(pu.nombre)}</small></span><span class="costo">${J.talleresVistos.includes(id) ? "✓" : "+10 ⭐"}</span></button>` : ""}`;
  }
  const clase = claseDe(pu);
  abrirPanel(`
    <div class="cab-marca"><div class="logo-m" style="--c:${pu.color};--c2:#1e1446">${pu.icono}</div>
      <div><h2>${esc(pu.nombre)}</h2><p>${pat ? `Patrocinado por ${esc(pat.nombre)}` : "Mercado de Weedland"}</p></div></div>
    <div class="tarjeta sabias"><b>💡 ¿Sabías que…?</b><p>${esc(pu.sabias)}</p>${pu.aviso ? `<p class="nota">⚠️ ${esc(pu.aviso)}</p>` : ""}
      ${clase ? `<button class="btn chico sec" id="aprender">${J.sabias.includes(id) ? "✓ Ya aprendiste esto" : "Aprende más · +10 ⭐"}</button>` : ""}</div>
    <div class="seccion">${cuerpo}</div>
    <p class="nota">Saldo: ${J.polen} ⭐ · Todo es virtual dentro del juego.</p>`, { tipo: "puesto", id, nav: "mercado", c: `--c:${pu.color}` });
  const q = $("#q-sem"); if (q) { q.oninput = (e) => { const v = e.target.value.trim().toLowerCase(); abrirPuesto(id, v); const nq = $("#q-sem"); nq.focus(); nq.setSelectionRange(v.length, v.length); }; }
  $$("[data-comprar-s]").forEach((b) => (b.onclick = () => {
    const s = semillaPorId(b.dataset.comprarS); if (!s || !gastar(s.costo)) return;
    sumarInv("semillas", s.id); sumar(s.marca, "semillas"); guardar();
    sonido.moneda(); flotante(`🌱 +1 ${s.nombre}`, centroDe(b).x, centroDe(b).y, "#7dffb3");
    abrirPuesto(id, filtro);
  }));
  $$("[data-comprar-a]").forEach((b) => (b.onclick = () => {
    const a = aditamento(b.dataset.comprarA); if (!a || !gastar(a.costo)) return;
    sumarInv("aditamentos", a.id); sumar(a.marca, "aditamentos"); guardar();
    sonido.moneda(); flotante(`${a.icono} +1`, centroDe(b).x, centroDe(b).y, "#6ff0ff");
    abrirPuesto(id);
  }));
  $$("[data-hacer]").forEach((b) => (b.onclick = () => {
    const prod = b.dataset.hacer, ing = pu.recetas.find((r) => r[0] === prod)[1];
    if (!Object.entries(ing).every(([k, n]) => (J.inv[k] || 0) >= n)) return;
    Object.entries(ing).forEach(([k, n]) => sumarInv("inv", k, -n));
    sumarInv("inv", prod, 1); guardar(); if (pat) sumar(pat.id, "transformados");
    cartel({ titulo: "¡LISTO!", sub: `${OBJETOS[prod].icono} ${OBJETOS[prod].nombre}`, ms: 1400 }); sonido.abrir();
    abrirPuesto(id);
  }));
  const vt = $("#video-taller"); if (vt) vt.onclick = () => verAnuncio(pat, () => {
    sumar(pat.id, "talleres");
    if (!J.talleresVistos.includes(id)) { J.talleresVistos.push(id); guardar(); ganar(10, "Video del taller"); }
    abrirPuesto(id);
  });
  const ap = $("#aprender"); if (ap && clase) ap.onclick = () => aprender(clase, id);
}
function aprender(c, pid) {
  let i = 0;
  const paso = () => {
    if (i < c.pasos.length) {
      const caja = modal(`<button class="cerrar" data-x>✕</button><div class="ico-g">${c.icono}</div><h3>${esc(c.titulo)}</h3>
        <p style="font-size:1.1rem;margin:14px 0">${esc(c.pasos[i])}</p><p class="suave chico-t">${i + 1} / ${c.pasos.length}</p>
        <div class="acciones"><button class="btn" data-sig>Siguiente ▶</button></div>`);
      $("[data-x]", caja).onclick = cerrarModal;
      $("[data-sig]", caja).onclick = () => { sonido.tap(); i++; paso(); };
      return;
    }
    const q = c.pregunta;
    const caja = modal(`<button class="cerrar" data-x>✕</button><div class="ico-g">❓</div><h3>${esc(q.p)}</h3>${q.ops.map((o, k) => `<button class="op" data-k="${k}">${esc(o)}</button>`).join("")}`);
    $("[data-x]", caja).onclick = cerrarModal;
    $$(".op", caja).forEach((b) => (b.onclick = () => {
      if (+b.dataset.k !== q.ok) { b.classList.add("mal"); sonido.mal(); return; }
      b.classList.add("bien"); sonido.bien();
      setTimeout(() => {
        cerrarModal();
        if (!J.sabias.includes(pid)) { J.sabias.push(pid); guardar(); cartel({ titulo: "¡APRENDISTE!", sub: `${c.icono} +10 ⭐`, ms: 1600 }); ganar(10); }
        abrirPuesto(pid);
      }, 700);
    }));
  };
  paso();
}

// ---------- tu tienda virtual ----------
function abrirTienda() {
  const vendibles = Object.entries(J.inv).filter(([k, n]) => n > 0 && OBJETOS[k]);
  abrirPanel(`
    <div class="cab-marca"><div class="logo-m" style="--c:#7dffb3;--c2:#0f5d43">🏪</div>
      <div><h2>Tu tienda</h2><p>Pon a la venta lo que cosechas y fabricas. Los visitantes de la estación llegan a comprar y te pagan en estrellas.</p></div></div>
    <div class="seccion"><h3>En venta (${J.tienda.length}/${MAX_TIENDA})</h3>
      ${J.tienda.length ? `<div class="lista-m">${J.tienda.map((it, k) => `<div class="item-m"><div class="logo-m" style="--c:#7dffb3;--c2:#0f5d43">${OBJETOS[it.item].icono}</div><div class="txt"><b>${esc(OBJETOS[it.item].nombre)}</b><small>Esperando comprador…</small></div><span class="costo">${it.precio} ⭐</span><button class="btn chico sec" data-quitar="${k}">✕</button></div>`).join("")}</div>` : `<p class="suave chico-t">Tu tienda está vacía.</p>`}
    </div>
    <div class="seccion"><h3>Poner a la venta</h3>
      ${vendibles.length ? `<div class="lista-m">${vendibles.map(([k, n]) => `<div class="item-m"><div class="logo-m" style="--c:#ffd76a;--c2:#5a4310">${OBJETOS[k].icono}</div><div class="txt"><b>${esc(OBJETOS[k].nombre)} ×${n}</b><small>Precio justo: ${OBJETOS[k].valor} ⭐ (si lo subes, tarda más en venderse)</small></div>
        <div class="precio-ctl"><button data-menos="${k}">−</button><span id="pr-${k}">${OBJETOS[k].valor}</span><button data-mas="${k}">＋</button></div><button class="btn chico oro" data-vender="${k}" ${J.tienda.length >= MAX_TIENDA ? "disabled" : ""}>Vender</button></div>`).join("")}</div>`
        : `<p class="suave chico-t">No tienes nada para vender. Cosecha en tus parcelas y transforma en los talleres del Mercado.</p>`}
    </div>
    ${J.ventas.length ? `<div class="seccion"><h3>Ventas recientes</h3>${J.ventas.slice(0, 6).map((v) => `<p class="chico-t" style="margin:4px 0">🛍️ <b>${esc(v.quien)}</b> compró ${OBJETOS[v.item].icono} ${esc(OBJETOS[v.item].nombre)} · <span style="color:var(--oro)">+${v.precio} ⭐</span></p>`).join("")}</div>` : ""}
    <p class="nota">Demo: los compradores son simulados. En la versión real serán otros jugadores.</p>`, { tipo: "tienda", nav: "cultivo", c: "--c:#7dffb3" });
  const precios = {};
  vendibles.forEach(([k]) => (precios[k] = OBJETOS[k].valor));
  const ajustar = (k, d) => { precios[k] = Math.max(1, Math.min(OBJETOS[k].valor * 3, precios[k] + d)); $("#pr-" + k).textContent = precios[k]; sonido.tick(); };
  $$("[data-menos]").forEach((b) => (b.onclick = () => ajustar(b.dataset.menos, -1)));
  $$("[data-mas]").forEach((b) => (b.onclick = () => ajustar(b.dataset.mas, 1)));
  $$("[data-vender]").forEach((b) => (b.onclick = () => {
    const k = b.dataset.vender; if (J.tienda.length >= MAX_TIENDA || !J.inv[k]) return;
    sumarInv("inv", k, -1);
    J.tienda.push({ item: k, precio: precios[k], vence: Date.now() + esperaVenta(k, precios[k]) }); guardar();
    sonido.pop(); est && est.setTienda(J.tienda.map((it) => ({ icono: OBJETOS[it.item].icono })));
    abrirTienda();
  }));
  $$("[data-quitar]").forEach((b) => (b.onclick = () => {
    const it = J.tienda.splice(+b.dataset.quitar, 1)[0]; if (it) sumarInv("inv", it.item, 1); guardar();
    est && est.setTienda(J.tienda.map((x) => ({ icono: OBJETOS[x.item].icono }))); abrirTienda();
  }));
}

// ---------- nave: tour espacial ----------
const COSTO_TOUR = 25;
function abrirNave() {
  const caja = modal(`<div class="ico-g">🚀</div><h3>Tour espacial</h3>
    <p class="suave">Nova te lleva volando por toda la estación, te narra cada lugar y luego… atraviesan un agujero negro. Dura 1 minuto y medio.</p>
    <p class="nota">⚠️ El túnel tiene colores y movimiento intensos. Si eres sensible a la luz o te mareas, mejor no lo tomes.</p>
    <div class="acciones"><button class="btn oro" data-ok ${J.polen < COSTO_TOUR ? "disabled" : ""}>Despegar · ${COSTO_TOUR} ⭐</button><button class="btn sec" data-x>Ahora no</button></div>
    ${J.polen < COSTO_TOUR ? `<p class="nota">Te faltan ${COSTO_TOUR - J.polen} ⭐.</p>` : ""}`, "--c:#6ff0ff");
  $("[data-x]", caja).onclick = cerrarModal;
  $("[data-ok]", caja).onclick = () => { if (!gastar(COSTO_TOUR)) return; cerrarModal(); despegar(); };
}
function decir(texto) {
  $("#subtitulo").textContent = texto;
  try {
    if (estaMudo() || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    const voces = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("es"));
    u.voice = voces.find((v) => /mx|419|us/i.test(v.lang)) || voces[0] || null; u.lang = (u.voice && u.voice.lang) || "es-MX";
    u.rate = 1.03; u.pitch = 1.05;
    speechSynthesis.speak(u);
  } catch {}
}
function destello() { const d = $("#destello"); d.classList.remove("on"); void d.offsetWidth; d.classList.add("on"); }
function despegar() {
  if (actual) cerrarPanel();
  document.body.classList.add("en-tour");
  $("#tour-ui").hidden = false;
  sonido.teleport();
  est.iniciarTour({
    alTexto: decir,
    alFase: (f) => { destello(); if (f === "tunel") sonido.tunel(); else sonido.entrar(); },
    alFin: () => {
      document.body.classList.remove("en-tour"); $("#tour-ui").hidden = true; destello();
      try { speechSynthesis.cancel(); } catch {}
      toast("¡Bienvenido de regreso a la base! 🚀");
    },
  });
}

// ---------- regalo diario ----------
function regaloDiario() {
  if (J.diario.fecha === hoy()) return false;
  const ayer = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const racha = J.diario.fecha === ayer ? (J.diario.racha % 7) + 1 : 1;
  const n = PREMIO_DIA[racha - 1];
  const caja = modal(`<div class="ico-g">🎁</div><h3>Regalo del día</h3><p class="suave">Día ${racha} de 7 · vuelve mañana y sube el premio</p>
    <div style="display:flex;gap:6px;justify-content:center;margin:12px 0">${PREMIO_DIA.map((p, i) => `<span class="chip ${i < racha ? "c" : ""}" style="--c:var(--oro)">${p}</span>`).join("")}</div>
    <div class="acciones"><button class="btn oro" data-ok>Recoger +${n} 🌟</button></div>`, "--c:var(--oro)");
  $("[data-ok]", caja).onclick = (e) => {
    const r = centroDe(e.currentTarget);
    J.diario = { fecha: hoy(), racha }; guardar();
    cerrarModal(); sonido.abrir(); confeti(18); ganar(n, null, r);
    if (!J.guia) setTimeout(() => guia(0), 1200);
  };
  return true;
}

// ---------- guía (Nova): opcional, se cierra con ✕ y no vuelve sola ----------
const PASOS = [
  { t: "¡Hola! Soy Nova 👋", p: "Bienvenido a Weedland Station: una expo en el espacio con los stands de las marcas." },
  { t: "Camina por la expo", p: matchMedia("(pointer: coarse)").matches ? "Muévete con el joystick o toca el suelo para caminar. Si tocas un stand, una pantalla o un dron, tu astronauta va solito hasta ahí." : "Camina con W A S D o las flechas, o haz clic en el suelo. Si das clic en un stand, una pantalla o un dron, tu astronauta va solito hasta ahí." },
  { t: "Gana estrellas 🌟", p: "Ganas estrellas al visitar stands, ver videos, jugar y vender en tu tienda. Con ellas compras semillas, aditamentos, el tour en la nave… o cupones reales de las marcas en 🎁 Premios." },
  { t: "Tu cultivo 🌱", p: "En Mi cultivo siembras semillas registradas de las marcas. En el Mercado las aceleras, transformas la cosecha y luego la vendes en tu tienda." },
];
function guia(i) {
  const el = $("#guia");
  if (i >= PASOS.length) return cerrarGuia(true);
  el.hidden = false;
  const ult = i === PASOS.length - 1;
  el.innerHTML = `<div class="nova">🤖</div><button class="cerrar" data-x aria-label="Cerrar guía">✕</button>
    <h4>${PASOS[i].t}</h4><p>${PASOS[i].p}</p>
    <div class="fila">${ult ? `<button class="btn chico" data-stand>Llévame a un stand</button>` : `<button class="btn chico" data-sig>Siguiente ▶</button>`}
    <span class="puntos">${PASOS.map((_, k) => `<i class="${k <= i ? "si" : ""}"></i>`).join("")}</span></div>`;
  sonido.hablar();
  $("[data-x]", el).onclick = () => { sonido.tap(); cerrarGuia(true); };
  const sig = $("[data-sig]", el); if (sig) sig.onclick = () => { sonido.tap(); guia(i + 1); };
  const st = $("[data-stand]", el); if (st) st.onclick = () => { cerrarGuia(true); const m = MARCAS.find((x) => !J.visitados.includes(x.id)) || MARCAS[0]; abrirStand(m.id); };
}
function cerrarGuia(marcar) {
  $("#guia").hidden = true;
  if (marcar && !J.guia) { J.guia = true; guardar(); }
}

// ---------- sin zoom de página (doble toque o pellizco) ----------
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
let ultimoToque = 0;
document.addEventListener("touchend", (e) => {
  const ahora = Date.now();
  if (ahora - ultimoToque < 320 && !e.target.closest("button, a, input, textarea, select, #stick")) e.preventDefault();
  ultimoToque = ahora;
}, { passive: false });

// ---------- inicio ----------
if (leerPerfil()) iniciar(); else entrada();
