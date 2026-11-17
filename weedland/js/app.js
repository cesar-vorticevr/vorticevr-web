// Weedland Station: interfaz (entrada, stands, catálogo, juegos, premios, universidad, pasaporte).
import { PAISES, PABELLONES, UNIVERSIDAD, CLASES, TALLERES, CONFERENCIAS, PREMIO_DIA, catalogo, preguntasMarca, nombrePais } from "./datos.js";
import { leerPerfil, guardarPerfil, leerJuego, guardarJuego, marcas, sumar, codigo, CLAVES } from "./estado.js";
import { sonido, volar, cartel, confeti, flotante, contar, alternarSonido, estaMudo } from "./efectos.js";

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
  setTimeout(() => { if (!regaloDiario() && !J.guia) guia(0); }, 900);
}

function crearEtiqueta({ id, icono, nombre, color }) {
  const b = document.createElement("button");
  b.className = "etiqueta"; b.style.setProperty("--c", color);
  b.innerHTML = `<span>${icono}</span>${esc(nombre)}`;
  b.onclick = () => { sonido.tap(); if (id === "plaza") irPlaza(); else if (id === "universidad") abrirUniversidad(); else caminarA("pabellon", id); };
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
    else if (ir === "universidad") abrirUniversidad();
    else if (ir === "premios") abrirPremios();
    else if (ir === "pasaporte") abrirPasaporte();
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
  else if (tipo === "uni") caminarA("universidad", "universidad", () => abrirUniversidad());
}
function caminarA(tipo, id, cb) {
  if (actual) cerrarPanel();
  est && est.irA(tipo, id, { cb });
}
// Botón "Entrar" cuando el avatar está frente a un stand o la Universidad
let cercaDe = null;
function alCerca(id) {
  cercaDe = id;
  const b = $("#entrar");
  if (!id) { b.hidden = true; return; }
  const m = marca(id);
  b.innerHTML = m ? `<span class="logo-mini" style="${vars(m)}">${m.icono}</span> Entrar a ${esc(m.nombre)} ▶` : `🎓 Entrar a la Universidad ▶`;
  b.style.cssText = m ? vars(m) : `--c:${UNIVERSIDAD.color}`;
  b.hidden = actual && (actual.id === id || actual.tipo === "uni");
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
  $("#entrar").onclick = () => { sonido.tap(); if (cercaDe === "universidad") abrirUniversidad(); else if (cercaDe) abrirStand(cercaDe); };
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
  if (motivo) toast(`${motivo}: +${n} polen dorado`);
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
function itemMarca(m) {
  const visto = J.visitados.includes(m.id);
  return `<button class="item-m" data-marca="${m.id}" style="${vars(m)}"><div class="logo-m">${m.icono}</div>
    <div class="txt"><b>${esc(m.nombre)}</b><small>${esc(m.lema)} · ${esc(nombrePais(m.pais))}</small></div>
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
      <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><span class="chip c">${pab(m.pab).icono} ${esc(pab(m.pab).nombre)}</span><span class="chip">${esc(nombrePais(m.pais))}</span></div></div></div>
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
  const cat = catalogo(m), visto = J.videos.includes(m.id), sigue = J.siguiendo.includes(m.id);
  caja.innerHTML = `
    <button class="video ancho" id="ver-video">
      <div><div class="play">▶</div></div>
      <span class="lbl">Video de ${esc(m.nombre)} · 10 s</span>
      <span class="premio-v chip ${visto ? "" : "c"}">${visto ? "✓ visto" : "+15 🌟"}</span>
    </button>
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
  $("#ver-video").onclick = () => verVideo(m);
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
function verVideo(m) {
  const cat = catalogo(m).filter((p) => p.destacado);
  const caja = modal(`
    <div class="rep">
      <div class="esc"><div class="e">${m.icono}</div><b>${esc(m.nombre)}</b><span>${esc(m.lema)}</span></div>
      <div class="esc"><div class="e">${(cat[0] || {}).icono || m.icono}</div><b>${esc((cat[0] || {}).nombre || m.nombre)}</b><span>${esc(m.anuncio)}</span></div>
      <div class="esc"><div class="e">🎟️</div><b>${esc(m.cupon.texto)}</b><span>Canjéalo con tu polen en este stand</span></div>
      <div class="prog"></div>
    </div>
    <p class="suave chico-t" style="margin:10px 0 0">Video de ejemplo. Aquí va el video que sube cada marca.</p>
    <div class="acciones"><button class="btn sec" data-x>Cerrar</button></div>`, vars(m));
  $("[data-x]", caja).onclick = () => { clearTimeout(fin); cerrarModal(); };
  const fin = setTimeout(() => {
    sumar(m.id, "videos");
    if (!J.videos.includes(m.id)) {
      J.videos.push(m.id); guardar();
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
    <div class="tarjeta"><div class="fila-t"><span class="grande">🎁</span><div class="txt"><b>Sorteo: ${esc(m.sorteo)}</b><small>Cada boleto es una oportunidad. Tienes ${bol}.</small></div><span class="costo">20 🌟</span></div>
      <button class="btn ancho" style="margin-top:10px" id="boleto" ${J.polen < 20 ? "disabled" : ""}>Comprar boleto con polen</button></div>
    ${mios.length ? `<div class="seccion"><h3>Tus cupones de ${esc(m.nombre)}</h3>${mios.map((c) => `<div class="tarjeta"><b>${esc(c.texto)}</b><div style="margin-top:8px"><span class="codigo">${c.codigo}</span></div></div>`).join("")}</div>` : ""}
    <p class="nota">¿Te falta polen? Gánalo visitando stands (+10), viendo videos (+15), jugando (hasta 30) y tomando clases en la Universidad (+20). Cupones sujetos a los términos de la marca y a la ley de tu país.</p>`;
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
      html = PABELLONES.map((p) => `<div class="grupo-t" style="--c:${p.color}">${p.icono} ${esc(p.nombre)}</div><div class="lista-m">${MARCAS.filter((m) => m.pab === p.id).map(itemMarca).join("")}</div>`).join("");
    }
    $("#dir").innerHTML = html;
    conectarItems($("#dir"));
    $$("[data-pm]", $("#dir")).forEach((b) => (b.onclick = () => { const [mid, pid] = b.dataset.pm.split("|"); abrirStand(mid, "catalogo"); setTimeout(() => verProducto(marca(mid), pid), 400); }));
  };
  $("#qd").oninput = (e) => pintar(e.target.value.trim().toLowerCase());
  pintar();
}

// ---------- premios (tienda de polen) ----------
function abrirPremios() {
  const cupones = MARCAS.slice().sort((a, b) => a.cupon.costo - b.cupon.costo);
  abrirPanel(`
    <h2>🎁 Premios</h2>
    <div class="tarjeta" style="margin-top:12px;text-align:center;border-color:var(--oro)">
      <div style="font:700 2.2rem Fredoka,sans-serif;color:var(--oro)">🌟 ${J.polen}</div>
      <div class="suave">polen dorado</div>
      <p style="margin:10px 0 0;font-size:.9rem">Cámbialo por <b>cupones reales</b> en la tienda de cada marca o por <b>boletos para sus sorteos</b>.</p>
    </div>
    <div class="seccion"><h3>¿Cómo gano más?</h3>
      <div class="tarjeta"><div class="fila-t"><span class="grande">🏛️</span><div class="txt"><b>Visita un stand nuevo</b><small>${J.visitados.length} de ${MARCAS.length} visitados</small></div><span class="costo">+10</span></div></div>
      <div class="tarjeta"><div class="fila-t"><span class="grande">🎬</span><div class="txt"><b>Ve el video de una marca</b><small>10 segundos</small></div><span class="costo">+15</span></div></div>
      <div class="tarjeta"><div class="fila-t"><span class="grande">🎰</span><div class="txt"><b>Juega en cada stand</b><small>Una partida gratis al día por stand</small></div><span class="costo">hasta 30</span></div></div>
      <div class="tarjeta"><div class="fila-t"><span class="grande">🎓</span><div class="txt"><b>Toma una clase</b><small>En la Universidad</small></div><span class="costo">+20</span></div></div>
      <div class="tarjeta"><div class="fila-t"><span class="grande">🪪</span><div class="txt"><b>Completa un pabellón</b><small>Visita todos sus stands</small></div><span class="costo">+50</span></div></div>
    </div>
    ${J.cupones.length ? `<div class="seccion"><h3>Mis cupones (${J.cupones.length})</h3>${J.cupones.map((c) => { const m = marca(c.marca); return `<div class="tarjeta" style="${vars(m)}"><div class="fila-t"><span class="grande">${m.icono}</span><div class="txt"><b>${esc(c.texto)}</b><small>${esc(m.nombre)}</small></div></div><div style="margin-top:8px"><span class="codigo">${c.codigo}</span></div></div>`; }).join("")}</div>` : ""}
    <div class="seccion"><h3>Cupones de las marcas</h3><div class="lista-m">
      ${cupones.map((m) => `<button class="item-m" data-cupon="${m.id}" style="${vars(m)}"><div class="logo-m">${m.icono}</div><div class="txt"><b>${esc(m.cupon.texto)}</b><small>${esc(m.nombre)}</small></div><span class="costo">${m.cupon.costo} 🌟</span></button>`).join("")}
    </div></div>
    <p class="nota">Los cupones son descuentos o regalos en la tienda de cada marca, sujetos a sus términos y a la ley de tu país. Weedland no vende productos.</p>`, { tipo: "premios", nav: "premios" });
  $$("[data-cupon]").forEach((b) => (b.onclick = () => { sonido.tap(); abrirStand(b.dataset.cupon, "premios"); }));
}

// ---------- pasaporte ----------
function revisarPabellon(pid) {
  const ids = MARCAS.filter((m) => m.pab === pid).map((m) => m.id);
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
    <p class="chico-t suave" style="margin:6px 0 0">${vistos} de ${total} stands · ${J.cupones.length} cupones · ${Object.values(J.boletos).reduce((a, b) => a + b, 0)} boletos · ${J.clases.length} clases</p>
    ${PABELLONES.map((p) => {
      const ms = MARCAS.filter((m) => m.pab === p.id);
      return `<div class="grupo-t" style="--c:${p.color}">${p.icono} ${esc(p.nombre)} ${J.bonos.includes(p.id) ? `<span class="hecho">✓ completo</span>` : ""}</div>
        <div class="sellos">${ms.map((m) => `<button class="sello ${J.visitados.includes(m.id) ? "si" : ""}" data-marca="${m.id}" style="${vars(m)}"><div><span>${J.visitados.includes(m.id) ? m.icono : "？"}</span>${esc(m.nombre)}</div></button>`).join("")}</div>`;
    }).join("")}
    <div class="grupo-t" style="--c:${UNIVERSIDAD.color}">🎓 Universidad</div>
    <div class="sellos">${CLASES.map((c) => `<div class="sello ${J.clases.includes(c.id) ? "si" : ""}" style="--c:${UNIVERSIDAD.color}"><div><span>${J.clases.includes(c.id) ? c.icono : "？"}</span>${esc(c.titulo.split(":")[0])}</div></div>`).join("")}</div>`,
  { tipo: "pasaporte", nav: "pasaporte", alto: true });
  conectarItems($("#panel-cuerpo"));
}

// ---------- universidad ----------
function abrirUniversidad(tab = "clases") {
  if (cercaDe !== "universidad" && (!actual || actual.tipo !== "uni")) { est && est.irA("universidad", "universidad", { caminar: false }); sonido.teleport(); }
  abrirPanel(`
    <div class="cab-marca"><div class="logo-m" style="--c:${UNIVERSIDAD.color};--c2:#2a1660">🎓</div>
      <div><h2>Universidad Weedland</h2><p>Aprende, mira talleres de las marcas y apúntate a conferencias.</p></div></div>
    <div class="tabs"><button data-t="clases">Clases</button><button data-t="talleres">Talleres</button><button data-t="conferencias">Conferencias</button></div>
    <div id="utab"></div>`, { tipo: "uni", nav: "universidad", c: `--c:${UNIVERSIDAD.color}` });
  const pintar = (t) => {
    $$(".tabs button").forEach((b) => b.classList.toggle("activo", b.dataset.t === t));
    const caja = $("#utab");
    if (t === "clases") {
      caja.innerHTML = CLASES.map((c) => `<button class="tarjeta fila-t ancho" data-clase="${c.id}" style="text-align:left"><span class="grande">${c.icono}</span><span class="txt"><b>${esc(c.titulo)}</b><small>${c.pasos.length} pasos + 1 pregunta</small></span>${J.clases.includes(c.id) ? `<span class="hecho">✓</span>` : `<span class="costo">+${c.polen} 🌟</span>`}</button>`).join("");
      $$("[data-clase]", caja).forEach((b) => (b.onclick = () => { sonido.tap(); clase(CLASES.find((c) => c.id === b.dataset.clase)); }));
    } else if (t === "talleres") {
      caja.innerHTML = TALLERES.map((ta) => { const m = marca(ta.marca); return `<button class="tarjeta fila-t ancho" data-taller="${ta.id}" style="text-align:left;${vars(m)}"><span class="grande">${ta.icono}</span><span class="txt"><b>${esc(ta.titulo)}</b><small>Taller de ${esc(m.nombre)} · ${ta.dur}</small></span>${J.talleres.includes(ta.id) ? `<span class="hecho">✓</span>` : `<span class="costo">+10 🌟</span>`}</button>`; }).join("") +
        `<p class="nota">Cada taller lo patrocina una marca: es otro espacio que se les vende.</p>`;
      $$("[data-taller]", caja).forEach((b) => (b.onclick = () => { sonido.tap(); taller(TALLERES.find((x) => x.id === b.dataset.taller)); }));
    } else {
      caja.innerHTML = CONFERENCIAS.map((c) => `<div class="tarjeta"><span class="chip c">${esc(c.fecha)}</span><h3 style="margin:8px 0 2px;font-size:1.05rem">${esc(c.titulo)}</h3><p class="suave" style="margin:0 0 10px">${esc(c.ponente)}</p>
        <button class="btn chico ${J.recordar.includes(c.id) ? "sec" : ""}" data-rec="${c.id}">${J.recordar.includes(c.id) ? "✓ Te avisaremos" : "🔔 Recordarme"}</button></div>`).join("") +
        `<p class="nota">Conferencias en vivo dentro de la estación. Fechas de ejemplo.</p>`;
      $$("[data-rec]", caja).forEach((b) => (b.onclick = () => { const i = J.recordar.indexOf(b.dataset.rec); if (i >= 0) J.recordar.splice(i, 1); else { J.recordar.push(b.dataset.rec); sonido.bien(); } guardar(); pintar("conferencias"); }));
    }
  };
  $$(".tabs button").forEach((b) => (b.onclick = () => { sonido.tap(); pintar(b.dataset.t); }));
  pintar(tab);
}
function clase(c) {
  let i = 0;
  const c2 = `--c:${UNIVERSIDAD.color}`;
  const paso = () => {
    if (i < c.pasos.length) {
      const caja = modal(`<button class="cerrar" data-x>✕</button><div class="ico-g">${c.icono}</div><h3>${esc(c.titulo)}</h3>
        <p style="font-size:1.1rem;margin:14px 0">${esc(c.pasos[i])}</p><p class="suave chico-t">${i + 1} / ${c.pasos.length}</p>
        <div class="acciones"><button class="btn" data-sig>Siguiente ▶</button></div>`, c2);
      $("[data-x]", caja).onclick = cerrarModal;
      $("[data-sig]", caja).onclick = () => { sonido.tap(); i++; paso(); };
    } else {
      const q = c.pregunta;
      const caja = modal(`<button class="cerrar" data-x>✕</button><div class="ico-g">❓</div><h3>${esc(q.p)}</h3>${q.ops.map((o, k) => `<button class="op" data-k="${k}">${esc(o)}</button>`).join("")}`, c2);
      $("[data-x]", caja).onclick = cerrarModal;
      $$(".op", caja).forEach((b) => (b.onclick = () => {
        const k = +b.dataset.k;
        if (k !== q.ok) { b.classList.add("mal"); sonido.mal(); return; }
        b.classList.add("bien"); sonido.bien();
        setTimeout(() => {
          cerrarModal();
          if (!J.clases.includes(c.id)) {
            J.clases.push(c.id); guardar();
            cartel({ titulo: "¡CLASE APROBADA!", sub: `${c.icono} +${c.polen} 🌟`, ms: 1800 }); sonido.premio(); ganar(c.polen);
          } else toast("Clase repasada");
          if (actual && actual.tipo === "uni") abrirUniversidad("clases");
        }, 700);
      }));
    }
  };
  paso();
}
function taller(ta) {
  const m = marca(ta.marca);
  const caja = modal(`
    <div class="rep">
      <div class="esc"><div class="e">${ta.icono}</div><b>${esc(ta.titulo)}</b><span>Taller de ${esc(m.nombre)}</span></div>
      <div class="esc"><div class="e">${m.icono}</div><b>${esc(m.nombre)}</b><span>${esc(m.lema)}</span></div>
      <div class="esc"><div class="e">🎓</div><b>¡Gracias por ver!</b><span>Visita su stand en el pabellón ${esc(pab(m.pab).nombre)}</span></div>
      <div class="prog"></div>
    </div>
    <p class="suave chico-t" style="margin:10px 0 0">Vista previa de ejemplo. Aquí va el video completo del taller.</p>
    <div class="acciones"><button class="btn sec" data-x>Cerrar</button></div>`, vars(m));
  const fin = setTimeout(() => {
    sumar(m.id, "talleres");
    if (!J.talleres.includes(ta.id)) { J.talleres.push(ta.id); guardar(); ganar(10, "Taller visto"); sonido.premio(); }
    $(".acciones", caja).innerHTML = `<button class="btn" data-stand>Ir al stand de ${esc(m.nombre)}</button><button class="btn sec" data-x>Cerrar</button>`;
    $("[data-stand]", caja).onclick = () => { cerrarModal(); abrirStand(m.id); };
    $("[data-x]", caja).onclick = () => { cerrarModal(); if (actual && actual.tipo === "uni") abrirUniversidad("talleres"); };
  }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 1500 : 10200);
  $("[data-x]", caja).onclick = () => { clearTimeout(fin); cerrarModal(); };
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
  { t: "Gana polen dorado 🌟", p: "Ganas polen al visitar stands, ver videos, jugar y tomar clases. Lo cambias por cupones reales y boletos para sorteos en 🎁 Premios." },
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
