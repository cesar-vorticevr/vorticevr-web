// Weedland · demo jugable. Interfaz, stands, minijuegos, cultivo, vecinos, taller y mercado.
import { PAISES, ZONAS, PLANTILLAS, OBJETOS, SEMILLAS, RECETAS, CATEGORIAS_RECETA, QUIZ_GENERAL, LUGARES, VECINOS, LECCIONES, MISIONES, LOOKS, GUIA, RECOMENDADORES, FRASES_RECO } from "./datos.js";
import { TEXTOS } from "./textos.js";
import * as E from "./estado.js";
import { crearMapa } from "./mapa.js";
import { crearMundo, dibujarPersona, esClaro } from "./mundo.js";
import { sonido, volar, cartel, confeti, flotante, contar, alternarSonido, estaMudo } from "./efectos.js";

const $ = (s, r = document) => r.querySelector(s);
const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
const espera = (ms) => new Promise((r) => setTimeout(r, quieto ? 0 : ms));

let perfil = E.leerPerfil();
let juego = E.leerJuego();
let marcas = E.marcas();
let lang = perfil?.lang || ((navigator.language || "es").toLowerCase().startsWith("en") ? "en" : "es");
let mundo = null;
const mapa = crearMapa(marcas);

// ---------- utilidades ----------
const t = (k, v = {}) => (TEXTOS[lang][k] ?? TEXTOS.es[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => v[n] ?? "");
const tx = (o) => (o == null ? "" : typeof o === "string" ? o : o[lang] ?? o.es ?? "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nombrePais = (cc) => tx(PAISES.find((p) => p.id === cc)) || cc;
const hoy = () => new Date().toISOString().slice(0, 10);
const marcaPorId = (id) => marcas.find((m) => m.id === id);
const guardar = () => E.guardarJuego(juego);
const tiene = (obj) => (juego.inv[obj] || 0) > 0;
const vecino = (id) => VECINOS.find((v) => v.id === id);
const centro = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

function objeto(id) {
  if (id.startsWith("extra:")) {
    const m = marcaPorId(id.slice(6));
    return { icono: "🏆", tipo: "coleccion", rareza: "extra", es: `Edición de colección · ${m?.nombre || ""}`, en: `Collector's edition · ${m?.nombre || ""}`, efecto: { es: "Solo se obtiene con una compra real registrada", en: "Only earned with a registered real purchase" } };
  }
  if (id.startsWith("reg:")) {
    const s = infoSemilla(id);
    return { icono: s.icono, tipo: "semilla", rareza: "raro", es: s.nombre.es, en: s.nombre.en, efecto: { es: "Semilla registrada: crece rápido y da el doble", en: "Registered seed: grows fast, yields double" } };
  }
  return OBJETOS[id] || { icono: "❔", tipo: "coleccion", rareza: "comun", es: id, en: id };
}

function infoSemilla(tipo) {
  if (tipo.startsWith("reg:")) {
    const m = marcaPorId(tipo.slice(4));
    const s = m?.semilla, b = SEMILLAS[s?.base || "fibra"];
    const da = {};
    for (const [k, v] of Object.entries(b.da)) da[k] = v * (s?.mult || 2);
    return { icono: b.icono, nombre: s?.nombre || b, dur: b.dur * (s?.rapido || 0.75), hojas: b.hojas * 2, da, color: b.color, registrada: m?.color, marca: m };
  }
  const s = SEMILLAS[tipo];
  return { ...s, nombre: { es: s.es, en: s.en } };
}
const durSemilla = (tipo) => infoSemilla(tipo).dur * (tiene("lampara") ? 0.8 : 1) * 1000;
const progreso = (p) => Math.min(1, (Date.now() - p.t) / durSemilla(p.tipo));
const etapa = (p) => { const g = progreso(p); return g >= 1 ? 4 : 1 + Math.floor(g * 3); };
const restante = (p) => Math.max(0, Math.ceil((durSemilla(p.tipo) - (Date.now() - p.t)) / 1000));
const fmt = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min` : `${s} s`);

function toast(msg, ms = 2800) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.classList.add("sale"), ms);
  setTimeout(() => el.remove(), ms + 400);
}

function agregar(obj, n = 1) { juego.inv[obj] = (juego.inv[obj] || 0) + n; }
function dar({ hojas = 0, lunas = 0, obj = null, n = 1 }) {
  juego.hojas += hojas; juego.lunas += lunas;
  if (obj) agregar(obj, n);
  guardar(); hud();
  const partes = [];
  if (hojas) partes.push(`+${hojas} 🍃`);
  if (lunas) partes.push(`+${lunas} 🌟`);
  if (obj) partes.push(`${objeto(obj).icono} ${tx(objeto(obj))}${n > 1 ? ` ×${n}` : ""}`);
  return partes.join(" · ");
}
// Lo que regala una marca: ingrediente ×2, mejora ×1 o 2 lunas
function regaloDe(m) {
  if (m.regalo === "luna") return { lunas: 2, hojas: 5 };
  const o = OBJETOS[m.regalo];
  return { obj: m.regalo, n: o?.tipo === "mejora" ? 1 : 2, hojas: 5 };
}

// ---------- HUD ----------
function hud() {
  contar($("#hojas"), juego.hojas);
  contar($("#lunas"), juego.lunas);
  $("#btn-idioma").textContent = lang === "es" ? "EN" : "ES";
  $("#btn-sonido").textContent = estaMudo() ? "🔇" : "🔊";
  document.documentElement.lang = lang;
  const pend = MISIONES.filter((m) => !juego.misiones.includes(m.id)).length;
  $("#badge-misiones").textContent = pend; $("#badge-misiones").hidden = !pend;
  const listas = juego.parcelas.filter((p) => p && etapa(p) === 4).length;
  $("#badge-granja").textContent = listas; $("#badge-granja").hidden = !listas;
  for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
}

const avance = {
  visitar: () => juego.visitados.length, sembrar: () => juego.stats.sembradas, cosechar: () => juego.stats.cosechas,
  jugar: () => juego.stats.partidas, leccion: () => juego.lecciones.length, transformar: () => juego.stats.transformados,
  vender: () => juego.stats.vendidos, ayudar: () => juego.stats.ayudas, registrada: () => juego.stats.registradas,
};
function revisarMisiones() {
  let demora = 900;
  for (const m of MISIONES) {
    if (juego.misiones.includes(m.id) || avance[m.id]() < m.meta) continue;
    juego.misiones.push(m.id);
    const premio = dar({ hojas: m.hojas || 0, lunas: m.lunas || 0 });
    setTimeout(() => { sonido.mision(); toast(`<b>${t("mision_cumplida")}</b> ${m.icono} ${tx(m)} <span class="premio">${premio}</span>`, 3600); }, demora);
    demora += 900;
  }
  guardar(); hud();
  setTimeout(revisarGuia, 700);
}

// ---------- misión guiada (siempre visible arriba) ----------
const ayer = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
function marcaGuia() {
  if (!juego.guiaMarca || !marcaPorId(juego.guiaMarca)) {
    const buenas = marcas.filter((m) => m.juego === "ruleta" && m.regalo !== "luna" && OBJETOS[m.regalo]?.tipo === "ingrediente");
    juego.guiaMarca = (buenas.length ? buenas : marcas)[Math.floor(Math.random() * (buenas.length || marcas.length))].id;
    guardar();
  }
  return marcaPorId(juego.guiaMarca);
}
const nuevaMarca = () => marcas.find((m) => !juego.visitados.includes(m.id)) || marcas[Math.floor(Math.random() * marcas.length)];
const condGuia = {
  arbol: () => (juego.stats.arbol || 0) >= 1,
  stand: () => juego.visitados.includes(juego.guiaMarca),
  regalo: () => juego.regalos.includes(juego.guiaMarca),
  sembrar: () => juego.stats.sembradas >= 1,
  jugar: () => juego.stats.partidas >= 1,
  cosechar: () => juego.stats.cosechas >= 1,
  ayudar: () => juego.stats.ayudas >= 1,
  transformar: () => juego.stats.transformados >= 1,
  vender: () => juego.stats.vendidos >= 1,
  leccion: () => juego.lecciones.length >= 1,
  visitar: () => juego.visitados.length >= 5,
};
const DESTINO_MISION = { visitar: "nueva", sembrar: "granja", cosechar: "granja", jugar: "nueva", leccion: "universidad", transformar: "taller", vender: "taller", ayudar: "vecino", registrada: "registrada" };

function misionActual() {
  const g = juego.guia || 0;
  if (g < GUIA.length) {
    const p = GUIA[g], m = marcaGuia();
    return { id: p.id, icono: p.icono, texto: tx(p).replace("{marca}", m.nombre), premio: { hojas: p.hojas || 0, lunas: p.lunas || 0 }, destino: p.destino, paso: `${t("mision")} ${g + 1}/${GUIA.length}`, guia: true };
  }
  const m = MISIONES.find((x) => !juego.misiones.includes(x.id));
  if (m) return { id: m.id, icono: m.icono, texto: `${tx(m)} (${Math.min(m.meta, avance[m.id]())}/${m.meta})`, premio: { hojas: m.hojas || 0, lunas: m.lunas || 0 }, destino: DESTINO_MISION[m.id] || "nueva", paso: t("mision_extra") };
  return { id: "explorar", icono: "✦", texto: t("explora_todo"), premio: { hojas: 0, lunas: 0 }, destino: "nueva", paso: t("mision_extra") };
}

function objetivoDe(destino, id) {
  if (destino === "arbol") return { tipo: "centro" };
  if (destino === "marca") return { tipo: "edificio", id: juego.guiaMarca };
  if (destino === "taller" || destino === "universidad") return { tipo: "edificio", id: destino };
  if (destino === "granja") {
    const lista = juego.parcelas.findIndex((p) => p && etapa(p) === 4);
    const vacia = juego.parcelas.findIndex((p, i) => !p && i < juego.abiertas);
    return { tipo: "parcela", dueno: "yo", i: id === "cosechar" ? (lista >= 0 ? lista : Math.max(0, juego.parcelas.findIndex((p) => p))) : vacia >= 0 ? vacia : 0 };
  }
  if (destino === "vecino") { const i = juego.vecinos?.sol?.findIndex((p) => p && etapa(p) === 4); return { tipo: "parcela", dueno: "sol", i: i >= 0 ? i : 0 }; }
  if (destino === "registrada") return { tipo: "edificio", id: (marcas.find((m) => m.semilla && !tiene("reg:" + m.id)) || marcas.find((m) => m.semilla)).id };
  return { tipo: "edificio", id: nuevaMarca().id };
}

function pintarMision(nueva = false) {
  const el = $("#mision-actual");
  if (!el || !mundo) return;
  const m = misionActual();
  const obj0 = objetivoDe(m.destino, m.id);
  const clave = m.id + m.texto + lang;
  if (!nueva && el.dataset.clave === clave && !el.hidden) { mundo.setObjetivo(obj0); return; }
  el.dataset.clave = clave;
  const premio = [m.premio.hojas ? `+${m.premio.hojas} 🍃` : "", m.premio.lunas ? `+${m.premio.lunas} 🌟` : ""].filter(Boolean).join(" ");
  el.innerHTML = `<span class="mi-icono">${m.icono}</span>
    <div class="mi-texto"><small>${m.paso}</small><b>${esc(m.texto)}</b>${premio ? `<span class="mi-premio">${premio}</span>` : ""}</div>
    <button id="mi-ir" class="mi-ir">${t("ir_mision")}</button>`;
  el.hidden = false;
  if (nueva) { el.classList.remove("nueva"); void el.offsetWidth; el.classList.add("nueva"); }
  const obj = objetivoDe(m.destino, m.id);
  el.dataset.objetivo = JSON.stringify(obj);
  mundo.setObjetivo(obj);
  $("#mi-ir").onclick = () => { sonido.tap(); irAMision(m, obj); };
}

function irAMision(m, obj) {
  const d = m.destino;
  if (d === "arbol") { cerrarHoja(); sonido.teleport(); mundo.teletransportar(40, 42, () => { mundo.efectoYo("teleport", "#c6f36b"); toast(`👆 ${t("tocalo")}`); }); return; }
  if (d === "granja") {
    teletransporte("granja", null, () => {
      if (m.id === "sembrar") { const v = juego.parcelas.findIndex((p, i) => !p && i < juego.abiertas); if (v >= 0) return abrirSembrar(v); }
      if (m.id === "cosechar") {
        const l = juego.parcelas.findIndex((p) => p && etapa(p) === 4);
        if (l >= 0) return cosechar(l);
        const c = juego.parcelas.findIndex((p) => p);
        if (c >= 0) return abrirCreciendo(c);
        const v = juego.parcelas.findIndex((p, i) => !p && i < juego.abiertas);
        if (v >= 0) return abrirSembrar(v);
      }
      abrirGranja();
    });
    return;
  }
  if (d === "vecino") { cerrarHoja(); sonido.teleport(); mundo.teletransportar(54, 51, () => { mundo.efectoYo("teleport", "#ffd8a8"); toast(`👆 ${t("toca_planta_sol")}`); }); return; }
  if (d === "taller") return teletransporte("taller", m.id === "vender" ? "mercado" : "recetas");
  if (d === "marca") return teletransporte(juego.guiaMarca, m.id === "regalo" ? "regalo" : m.id === "jugar" ? "juego" : "inicio");
  if (d === "registrada") return teletransporte(obj.id, "regalo");
  teletransporte(obj.id || nuevaMarca().id);
}

let revisandoGuia = false;
function revisarGuia() {
  if (revisandoGuia || !mundo) return;
  const g = juego.guia || 0;
  if (g >= GUIA.length) { pintarMision(); return; }
  const p = GUIA[g];
  if (!condGuia[p.id]()) { pintarMision(); return; }
  revisandoGuia = true;
  juego.guia = g + 1;
  const msg = dar({ hojas: p.hojas || 0, lunas: p.lunas || 0 });
  sonido.jackpot();
  cartel({ titulo: t("mision_cumplida_g"), sub: `${p.icono} ${esc(tx(p).replace("{marca}", marcaGuia().nombre))} · ${msg}`, tipo: "dorada", ms: 2000 });
  const el = $("#mision-actual");
  if (el) { const c = centro(el); if (p.hojas) volar("🍃", 8, c, "#hojas"); if (p.lunas) volar("🌟", 4, c, "#lunas"); }
  setTimeout(() => { revisandoGuia = false; pintarMision(true); setTimeout(revisarGuia, 600); }, 2100);
}

// ---------- recomendaciones de personajes y vallas ----------
let ultimaReco = Date.now(), recoTimer = null;
const promotoresDatos = [];
function fraseReco(m) {
  const f = FRASES_RECO[Math.floor(Math.random() * FRASES_RECO.length)];
  const r = regaloDe(m);
  return tx(f).replace("{marca}", m.nombre).replace("{regalo}", r.obj ? tx(objeto(r.obj)) : t("polen_dos")).replace("{juego}", t("juego_" + m.juego)).replace("{producto}", tx(m.productos[0].nombre));
}
function mostrarReco(m, { quien, anuncio = false } = {}) {
  const el = $("#reco");
  if (!el || !m) return;
  clearTimeout(recoTimer);
  ultimaReco = Date.now();
  const nombre = quien || RECOMENDADORES[Math.floor(Math.random() * RECOMENDADORES.length)];
  el.style.setProperty("--c", m.color);
  el.innerHTML = `
    <div class="reco-cara">${anuncio ? esc(m.productos[0].icono) : esc(nombre.slice(0, 1))}</div>
    <div class="reco-texto"><small>${anuncio ? `📣 ${t("anuncio")} · ${esc(m.nombre)}` : `💬 ${esc(nombre)} ${t("te_recomienda")}`}</small>
      <p>${anuncio ? esc(`${m.productos[0].icono} ${tx(m.productos[0].nombre)} · ${tx(m.categoria)}`) : esc(fraseReco(m))}</p>
      <div class="reco-botones"><button class="btn pequeno" id="reco-ir">${t("llevame")}</button><button class="reco-cerrar" id="reco-x" aria-label="${t("cerrar")}">✕</button></div></div>`;
  el.hidden = false;
  el.classList.remove("entra"); void el.offsetWidth; el.classList.add("entra");
  sonido.pop();
  const cerrar = () => { el.hidden = true; clearTimeout(recoTimer); };
  $("#reco-x").onclick = cerrar;
  $("#reco-ir").onclick = () => { E.sumar(m.id, anuncio ? "vallas" : "recos"); cerrar(); teletransporte(m.id); };
  recoTimer = setTimeout(cerrar, 14000);
}
function recoAutomatica() {
  if (!mundo || document.hidden || !$("#hoja").hidden || document.querySelector(".video, .cartel")) return;
  if (Date.now() - ultimaReco < 45000) return;
  const pendientes = marcas.filter((m) => !juego.visitados.includes(m.id));
  const lista = pendientes.length ? pendientes : marcas;
  mostrarReco(lista[Math.floor(Math.random() * lista.length)]);
}
// anuncios de las vallas: rotan cada 7 segundos
const ordenAnuncios = [...marcas].sort((a, b) => (a.id.length * 7 + a.id.charCodeAt(1)) % 13 - (b.id.length * 7 + b.id.charCodeAt(1)) % 13);
const anuncioEnValla = [];
function anuncio(i, tiempo) {
  const m = ordenAnuncios[(i * 5 + Math.floor(tiempo / 7)) % ordenAnuncios.length];
  const actual = marcaPorId(m.id) || m;
  anuncioEnValla[i] = actual.id;
  return { nombre: actual.nombre, color: actual.color, icono: actual.productos[0].icono, lema: tx(actual.productos[0].nombre), cta: t("valla_cta"), fase: tiempo % 7 };
}

// ---------- regalo diario ----------
const PREMIO_DIA = [{ hojas: 15 }, { hojas: 20 }, { hojas: 20, lunas: 1 }, { hojas: 30 }, { hojas: 35 }, { hojas: 40 }, { hojas: 60, lunas: 3 }];
function abrirCofre(alTerminar) {
  const racha = juego.diario === ayer() ? (juego.racha || 0) + 1 : 1;
  const dia = ((racha - 1) % 7) + 1, p = PREMIO_DIA[dia - 1];
  const c = abrirHoja(`
    <div class="cofre">
      <h2>🎁 ${t("regalo_diario")}</h2>
      <p>${t("racha_dias", { n: racha })}</p>
      <div class="cofre-dias">${PREMIO_DIA.map((x, i) => `<div class="dia ${i + 1 < dia ? "pasado" : i + 1 === dia ? "hoy" : ""}"><small>${t("dia")} ${i + 1}</small><b>${x.lunas ? "🌟" : "🍃"}</b><span>${x.hojas}${x.lunas ? `+${x.lunas}🌟` : ""}</span></div>`).join("")}</div>
      <button class="cofre-caja" id="cofre" aria-label="${t("abrir_regalo")}">🎁</button>
      <p class="centrado"><b>${t("toca_cofre")}</b></p>
    </div>`, { color: "#f2c45a", entrada: true });
  $("#hoja-cerrar").hidden = true;
  $("#cofre", c).onclick = async (ev) => {
    const b = ev.currentTarget; b.disabled = true;
    b.classList.add("sacude"); sonido.sacudir();
    await espera(450);
    juego.diario = hoy(); juego.racha = racha; guardar();
    const msg = dar(p);
    sonido.jackpot();
    cartel({ titulo: t("dia_n", { n: dia }), sub: msg, tipo: "dorada", ms: 1800 });
    const pos = centro(b);
    volar("🍃", 10, pos, "#hojas"); if (p.lunas) setTimeout(() => volar("🌟", 4, pos, "#lunas"), 300);
    await espera(1600);
    $("#hoja-cerrar").hidden = false;
    cerrarHoja();
    alTerminar && alTerminar();
  };
}

// ---------- hoja (panel inferior) ----------
let relojHoja = null, animHoja = null;
function abrirHoja(html, { color = "#c6f36b", entrada = false } = {}) {
  clearInterval(relojHoja); relojHoja = null; cancelAnimationFrame(animHoja);
  const h = $("#hoja");
  h.style.setProperty("--acento", color);
  h.style.setProperty("--acento-txt", esClaro(color) ? "#160f2b" : "#fff");
  $("#hoja-cuerpo").innerHTML = html;
  const yaAbierta = h.classList.contains("abierta") && !h.hidden;
  h.hidden = false; $("#velo").hidden = false;
  h.classList.toggle("rebote", entrada || !yaAbierta);
  requestAnimationFrame(() => h.classList.add("abierta"));
  $("#hoja-cuerpo").scrollTop = 0;
  return $("#hoja-cuerpo");
}
function cerrarHoja() {
  clearInterval(relojHoja); relojHoja = null; cancelAnimationFrame(animHoja);
  const h = $("#hoja");
  h.classList.remove("abierta");
  $("#velo").hidden = true;
  setTimeout(() => { if (!h.classList.contains("abierta")) h.hidden = true; }, quieto ? 0 : 250);
}

// ---------- entrada ----------
function pantallaEntrada() {
  const el = $("#entrada");
  el.hidden = false;
  let pais = perfil?.pais || (lang === "en" ? "US" : "MX");
  const pintar = () => {
    const edad = PAISES.find((p) => p.id === pais)?.edad || 18;
    el.innerHTML = `
      <div class="caja-entrada">
        <div class="hojas-entrada" aria-hidden="true">${["🍃", "🌿", "✨", "🍀", "🍃", "✨"].map((c, i) => `<span style="--i:${i}">${c}</span>`).join("")}</div>
        <div class="logo-grande"><span class="hoja-logo">✦</span>Weedland</div>
        <p class="lema">${t("lema")}</p>
        <div class="idiomas">
          <button data-lang="es" class="${lang === "es" ? "activo" : ""}">Español</button>
          <button data-lang="en" class="${lang === "en" ? "activo" : ""}">English</button>
        </div>
        <label class="campo" for="sel-pais">${t("tu_pais")}</label>
        <select id="sel-pais" class="campo-control">${PAISES.map((p) => `<option value="${p.id}" ${p.id === pais ? "selected" : ""}>${tx(p)}</option>`).join("")}</select>
        <p class="pregunta-edad">${t("pregunta_edad", { edad })}</p>
        <button class="btn grande" id="si-edad">${t("si_edad", { edad })}</button>
        <button class="btn fantasma" id="no-edad">${t("no_edad")}</button>
        <p class="letra-chica">${t("aviso_entrada")}</p>
      </div>`;
    el.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = () => { lang = b.dataset.lang; sonido.tap(); pintar(); }));
    $("#sel-pais").onchange = (e) => { pais = e.target.value; pintar(); };
    $("#si-edad").onclick = () => {
      sonido.entrar();
      perfil = { ...(perfil || {}), lang, pais, edadOk: true };
      E.guardarPerfil(perfil);
      el.hidden = true;
      if (mundo) { $("#juego").hidden = false; hud(); }
      else perfil.look ? arrancar() : pantallaAvatar();
    };
    $("#no-edad").onclick = () => { el.innerHTML = `<div class="caja-entrada"><div class="logo-grande">Weedland</div><p class="lema">${t("menor")}</p></div>`; };
  };
  pintar();
}

function pantallaAvatar(desdeJuego = false) {
  const el = $("#crear");
  el.hidden = false;
  const look = { piel: LOOKS.pieles[1], pelo: LOOKS.pelos[0], ropa: LOOKS.ropas[0], gorra: false, nombre: "", ...(perfil.look || {}) };
  const muestras = (lista, campo) => lista.map((c) => `<button class="muestra ${look[campo] === c ? "activa" : ""}" data-campo="${campo}" data-valor="${c}" style="background:${c}" aria-label="${c}"></button>`).join("");
  let anim = null;
  const pintar = () => {
    cancelAnimationFrame(anim);
    el.innerHTML = `
      <div class="caja-entrada">
        <h2>${t("crea_avatar")}</h2>
        <canvas id="vista-avatar" width="200" height="200"></canvas>
        <label class="campo" for="nombre">${t("tu_nombre")}</label>
        <input id="nombre" class="campo-control" maxlength="14" value="${esc(look.nombre)}" placeholder="${t("nombre_ph")}">
        <div class="fila-muestras"><span>${t("piel")}</span>${muestras(LOOKS.pieles, "piel")}</div>
        <div class="fila-muestras"><span>${t("pelo")}</span>${muestras(LOOKS.pelos, "pelo")}</div>
        <div class="fila-muestras"><span>${t("ropa")}</span>${muestras(LOOKS.ropas, "ropa")}</div>
        <div class="fila-muestras"><span>${t("gorra")}</span>
          <button class="chip ${!look.gorra ? "activo" : ""}" data-gorra="0">${t("no")}</button>
          <button class="chip ${look.gorra ? "activo" : ""}" data-gorra="1">${t("si")}</button></div>
        <button class="btn grande" id="listo">${desdeJuego ? t("guardar") : t("entrar")}</button>
      </div>`;
    const cv = $("#vista-avatar"), c = cv.getContext("2d");
    const loop = (ms) => {
      c.clearRect(0, 0, 200, 200);
      c.fillStyle = "#24183f"; c.beginPath(); c.arc(100, 100, 96, 0, Math.PI * 2); c.fill();
      c.save(); c.translate(100, 172); c.scale(2.2, 2.2); dibujarPersona(c, 0, 0, look, 0, Math.sin(ms / 900) > 0 ? 1 : -1, false, quieto ? 0 : Math.abs(Math.sin(ms / 400)) * 3); c.restore();
      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    el.querySelectorAll(".muestra").forEach((b) => (b.onclick = () => { sonido.pop(); look[b.dataset.campo] = b.dataset.valor; look.nombre = $("#nombre").value; pintar(); }));
    el.querySelectorAll("[data-gorra]").forEach((b) => (b.onclick = () => { sonido.pop(); look.gorra = b.dataset.gorra === "1"; look.nombre = $("#nombre").value; pintar(); }));
    $("#listo").onclick = () => {
      cancelAnimationFrame(anim);
      look.nombre = $("#nombre").value.trim() || t("nombre_def");
      perfil.look = look; E.guardarPerfil(perfil);
      el.hidden = true;
      sonido.abrir(); confeti(30);
      if (desdeJuego) mundo.setLook(look); else arrancar();
    };
  };
  pintar();
}

// ---------- mundo ----------
function infoEdificios() {
  const info = {};
  for (const m of marcas) info[m.id] = { nombre: m.nombre, color: m.color, plantilla: PLANTILLAS[m.plantilla] ? m.plantilla : "cabana", tipo: "marca" };
  for (const l of Object.values(LUGARES)) info[l.id] = { nombre: tx(l), color: l.color, plantilla: l.plantilla, tipo: "lugar" };
  return info;
}

function iniciarVecinos() {
  if (juego.vecinos) return;
  juego.vecinos = {};
  const tipos = ["fibra", "grano", "flor"];
  for (const v of VECINOS) {
    juego.vecinos[v.id] = mapa.granjas.find((g) => g.dueno === v.id).plots.map((_, i) => {
      const tipo = tipos[(i + v.id.length) % 3];
      const ya = Math.random() < 0.6;
      return { tipo, t: Date.now() - SEMILLAS[tipo].dur * 1000 * (ya ? 1.05 : Math.random() * 0.6) };
    });
  }
  guardar();
}

function arrancar() {
  $("#juego").hidden = false;
  iniciarVecinos();
  marcaGuia();
  // 8 personajes que recomiendan marcas (primero las que no has visitado)
  const orden = [...marcas].sort(() => Math.random() - 0.5).sort((a, b) => juego.visitados.includes(a.id) - juego.visitados.includes(b.id));
  RECOMENDADORES.forEach((nombre, i) => { const m = orden[i % orden.length]; promotoresDatos.push({ nombre, marca: m.id, color: m.color, icono: ["💬", "🎁", "✨", "🎰"][i % 4] }); });
  hud();
  mundo = crearMundo($("#mundo"), {
    mapa, info: infoEdificios(), look: perfil.look, looks: LOOKS, vecinos: VECINOS,
    visitados: () => juego.visitados,
    planta: (dueno, i) => {
      const p = dueno === "yo" ? juego.parcelas[i] : juego.vecinos?.[dueno]?.[i];
      if (!p) return null;
      const s = infoSemilla(p.tipo);
      return { etapa: etapa(p), color: s.color, magia: !!s.magia, registrada: s.registrada || null };
    },
    bloqueada: (i) => i >= juego.abiertas,
    nombreZona: (z) => tx(ZONAS[z]),
    textoLetrero: (d) => (d === "yo" ? t("mi_terreno") : t("granja_de", { n: vecino(d).nombre })),
    alEntrar: (id) => entrar(id),
    alParcela: (dueno, i) => (dueno === "yo" ? tocarParcela(i) : tocarVecino(dueno, i)),
    alLetrero: (d) => (d === "yo" ? abrirGranja() : toast(t("granja_vecino", { n: vecino(d).nombre }))),
    alCentro: (c) => {
      sonido.abrir(); mundo.efectoYo("magia", c.color || "#c6f36b");
      toast(c.tipo === "arbolLuz" ? t("arbol_luz") : `✨ ${tx(ZONAS[c.zona])}: ${t("zona_" + c.zona)}`, 4000);
      if (c.tipo === "arbolLuz") { juego.stats.arbol = (juego.stats.arbol || 0) + 1; guardar(); revisarMisiones(); }
    },
    alSaltar: () => sonido.teleport(),
    promotores: promotoresDatos,
    alPromotor: (i) => { const p = promotoresDatos[i]; mostrarReco(marcaPorId(p.marca), { quien: p.nombre }); },
    anuncio,
    alValla: (i) => { const m = marcaPorId(anuncioEnValla[i]); if (m) { E.sumar(m.id, "vallas"); mostrarReco(m, { anuncio: true }); } },
  });
  procesarAvisos();
  const deep = decodeURIComponent(location.hash.slice(1));
  const despues = () => { pintarMision(true); setTimeout(revisarGuia, 800); };
  if (deep && marcaPorId(deep)) { setTimeout(() => teletransporte(deep), 400); despues(); }
  else if (juego.diario !== hoy()) setTimeout(() => abrirCofre(() => { despues(); toast(`☝️ ${t("sigue_mision")}`, 4500); }), 500);
  else despues();
  setInterval(tickVecinos, 3000);
  setInterval(() => { hud(); pintarMision(); }, 4000);
  setInterval(recoAutomatica, 8000);
  ultimaReco = Date.now() - 20000;
}

function entrar(id, vista) {
  sonido.entrar();
  mundo.efectoEdificio(id, "entrar");
  setTimeout(() => {
    if (id === "universidad") abrirUniversidad();
    else if (id === "taller") abrirTaller(vista === "mercado" ? "mercado" : "recetas");
    else {
      abrirStand(id);
      if (vista && vista !== "inicio") setTimeout(() => abrirStand(id, vista), quieto ? 0 : 500);
    }
  }, quieto ? 0 : 380);
}

function teletransporte(id, vista, alLlegar) {
  cerrarHoja();
  $("#reco") && ($("#reco").hidden = true);
  sonido.teleport();
  const f = $("#fundido");
  f.classList.add("activo");
  setTimeout(() => {
    if (id === "granja") mundo.teletransportar(48, 48, () => { mundo.efectoYo("teleport", "#c6f36b"); alLlegar ? alLlegar() : abrirGranja(); });
    else mundo.teletransportarA(id, (eid) => { mundo.efectoYo("teleport", marcaPorId(eid)?.color || "#c6f36b"); entrar(eid, vista); });
    f.classList.remove("activo");
  }, quieto ? 0 : 300);
}

function abrirBienvenida() {
  const c = abrirHoja(`
    <h2>${t("bienvenida_titulo", { nombre: esc(perfil.look.nombre) })}</h2>
    <p>${t("bienvenida_1")}</p>
    <ul class="lista-simple">
      <li>👆 ${t("bienvenida_tocar")}</li>
      <li>🏛️ ${t("bienvenida_stands")}</li>
      <li>🌱 ${t("bienvenida_granja")}</li>
      <li>⚗️ ${t("bienvenida_taller")}</li>
      <li>🤝 ${t("bienvenida_vecinos")}</li>
    </ul>
    <button class="btn grande" id="ok">${t("a_explorar")}</button>`, { entrada: true });
  $("#ok", c).onclick = () => { sonido.abrir(); confeti(24); cerrarHoja(); };
}

// ---------- cultivo propio ----------
function tocarParcela(i) {
  if (i >= juego.abiertas) return abrirCompraParcela(i);
  const p = juego.parcelas[i];
  if (!p) return abrirSembrar(i);
  if (etapa(p) === 4) return cosechar(i);
  abrirCreciendo(i);
}

function abrirCompraParcela(i) {
  const costo = 40 + (i - 6) * 30;
  const c = abrirHoja(`
    <h2>🔒 ${t("parcela_extra")}</h2>
    <p>${t("parcela_extra_txt")}</p>
    <button class="btn grande" id="comprar" ${juego.hojas < costo ? "disabled" : ""}>${t("abrir_por", { n: costo })}</button>`, { color: "#c6f36b" });
  $("#comprar", c).onclick = () => {
    juego.hojas -= costo; juego.abiertas = Math.max(juego.abiertas, i + 1); guardar(); hud();
    cerrarHoja(); sonido.premio(); mundo.efectoParcela("yo", i, "magia");
    cartel({ titulo: t("parcela_nueva"), ms: 1400 });
  };
}

function abrirSembrar(i) {
  const normales = Object.entries(SEMILLAS).map(([id, s]) => {
    const bloqueada = s.requiere && !juego.lecciones.includes(s.requiere);
    return `<button class="semilla" data-s="${id}" ${bloqueada || juego.hojas < s.costo ? "disabled" : ""}>
      <span class="icono-prod">${s.icono}</span>
      <span><b>${tx(s)}</b><small>${fmt(Math.round(durSemilla(id) / 1000))} · ${t("da")} ${Object.entries(s.da).map(([k, v]) => `${objeto(k).icono}×${v}`).join(" ")} + ${s.hojas} 🍃${s.lunas ? ` + ${s.lunas} 🌟` : ""}</small>
      ${bloqueada ? `<small class="bloq">🔒 ${t("requiere_leccion")}</small>` : ""}</span>
      <span class="precio">${s.costo} 🍃</span></button>`;
  }).join("");
  const regs = Object.keys(juego.inv).filter((k) => k.startsWith("reg:") && juego.inv[k] > 0);
  const registradas = regs.map((k) => {
    const s = infoSemilla(k);
    return `<button class="semilla registrada" data-s="${k}" style="--c:${s.registrada}">
      <span class="icono-prod">${s.icono}</span>
      <span><b>${esc(tx(s.nombre))}</b><small>${fmt(Math.round(durSemilla(k) / 1000))} · ${t("da")} ${Object.entries(s.da).map(([kk, v]) => `${objeto(kk).icono}×${v}`).join(" ")} + ${s.hojas} 🍃</small></span>
      <span class="precio">×${juego.inv[k]}</span></button>`;
  }).join("");
  const c = abrirHoja(`
    <h2>🌱 ${t("que_siembras")}</h2>
    ${registradas ? `<h3 class="subtitulo">🏷️ ${t("tus_registradas")}</h3><div class="semillas">${registradas}</div>` : ""}
    <h3 class="subtitulo">${t("semillas_normales")}</h3>
    <div class="semillas">${normales}</div>
    ${regs.length ? "" : `<p class="nota">${t("nota_registradas")}</p>`}
    <p class="nota">${t("nota_tiempos")}</p>`, { color: "#c6f36b" });
  c.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => sembrar(i, b.dataset.s)));
}

function sembrar(i, tipo) {
  if (tipo.startsWith("reg:")) { juego.inv[tipo]--; juego.stats.registradas++; E.sumar(tipo.slice(4), "semillas"); }
  else juego.hojas -= SEMILLAS[tipo].costo;
  juego.parcelas[i] = { tipo, t: Date.now() };
  juego.stats.sembradas++;
  guardar(); hud();
  cerrarHoja();
  sonido.siembra(); mundo.saltar();
  mundo.efectoParcela("yo", i, "siembra");
  const p = mundo.pantallaParcela("yo", i);
  flotante(`${infoSemilla(tipo).icono} ${t("sembrado")}`, p.x, p.y - 30);
  revisarMisiones();
}

function cosechar(i) {
  const p = juego.parcelas[i];
  const s = infoSemilla(p.tipo);
  const dorada = Math.random() < 0.12;
  const x = dorada ? 2 : 1;
  const extra = tiene("maceta") ? 1 : 0;
  const ganado = [];
  for (const [k, v] of Object.entries(s.da)) { agregar(k, (v + extra) * x); ganado.push(`${objeto(k).icono}×${(v + extra) * x}`); }
  const hojas = s.hojas * x, lunas = (s.lunas || 0) * x;
  juego.hojas += hojas; juego.lunas += lunas;
  juego.parcelas[i] = null;
  juego.stats.cosechas++;
  guardar();
  cerrarHoja();
  const pos = mundo.pantallaParcela("yo", i);
  mundo.efectoParcela("yo", i, dorada ? "dorada" : "cosecha"); mundo.saltar();
  dorada ? sonido.dorada() : sonido.cosecha();
  cartel({ titulo: dorada ? t("cosecha_dorada") : t("cosecha_magica"), sub: `${ganado.join("  ")}  +${hojas} 🍃${lunas ? `  +${lunas} 🌟` : ""}`, tipo: dorada ? "dorada" : "normal" });
  volar("🍃", Math.ceil(hojas / 2), pos, "#hojas", hud);
  setTimeout(() => volar(objeto(Object.keys(s.da)[0]).icono, 4, pos, "#btn-inventario"), 250);
  if (lunas) setTimeout(() => volar("🌟", lunas * 2, pos, "#lunas", hud), 400);
  setTimeout(revisarMisiones, 1200);
}

function abrirCreciendo(i) {
  const p = juego.parcelas[i];
  const s = infoSemilla(p.tipo);
  const pintar = () => {
    const c = abrirHoja(`
      <h2>${s.icono} ${esc(tx(s.nombre))}</h2>
      <div class="barra"><div style="width:${Math.round(progreso(p) * 100)}%"></div></div>
      <p class="centrado" id="falta">${t("falta", { t: fmt(restante(p)) })}</p>
      ${tiene("lampara") ? `<p class="centrado"><small>💡 ${t("lampara_activa")}</small></p>` : ""}
      ${videosHoy() < VIDEOS_DIA
        ? `<button class="btn video-btn" id="ver-video">${t("video_btn", { s: DUR_VIDEO })}</button><p class="centrado"><small>${t("video_quedan", { n: VIDEOS_DIA - videosHoy() })}</small></p>`
        : `<p class="centrado"><small>${t("video_agotado")}</small></p>`}
      <p class="nota">${tiene("campanita") ? "🔔 " + t("protegida") : "🤝 " + t("aviso_vecinos")}</p>`, { color: "#c6f36b" });
    $("#ver-video", c) && ($("#ver-video", c).onclick = () => verVideo(() => {
      p.t = Date.now() - durSemilla(p.tipo);
      juego.videos = { fecha: hoy(), n: videosHoy() + 1 };
      guardar(); hud();
      cosechar(i);
    }));
    relojHoja = setInterval(() => {
      const barra = document.querySelector("#hoja .barra div");
      if (!barra || juego.parcelas[i] !== p) { clearInterval(relojHoja); return; }
      barra.style.width = Math.round(progreso(p) * 100) + "%";
      if (etapa(p) === 4) { clearInterval(relojHoja); cerrarHoja(); toast(`✨ ${t("lista_toca")}`); hud(); return; }
      $("#falta").textContent = t("falta", { t: fmt(restante(p)) });
    }, 1000);
  };
  pintar();
}

function abrirGranja() {
  const c = abrirHoja(`
    <h2>🌱 ${t("mi_terreno")}</h2>
    <p>${t("granja_txt")}</p>
    <div class="parcelas">${juego.parcelas.map((p, i) => {
      if (i >= juego.abiertas) return `<button class="parcela vacia" data-i="${i}">🔒<small>${t("abrir")}</small></button>`;
      if (!p) return `<button class="parcela vacia" data-i="${i}">＋<small>${t("sembrar")}</small></button>`;
      const s = infoSemilla(p.tipo), e = etapa(p);
      return `<button class="parcela ${e === 4 ? "lista" : ""}" data-i="${i}">${s.icono}<small>${e === 4 ? t("lista") : fmt(restante(p))}</small></button>`;
    }).join("")}</div>
    <p class="nota">${t("nota_granja")}</p>`, { color: "#c6f36b" });
  c.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { sonido.tap(); tocarParcela(+b.dataset.i); }));
}

// ---------- vecinos ----------
const GRACIA = 45000;
function tocarVecino(dueno, i) {
  const p = juego.vecinos[dueno][i], v = vecino(dueno);
  if (!p) { toast(t("vecino_vacia", { n: v.nombre })); return; }
  if (etapa(p) < 4) { toast(t("vecino_crece", { n: v.nombre, t: fmt(restante(p)) })); return; }
  const s = infoSemilla(p.tipo), ganado = [];
  for (const [k, n] of Object.entries(s.da)) { const mitad = Math.ceil(n / 2); agregar(k, mitad); ganado.push(`${objeto(k).icono}×${mitad}`); }
  const hojas = Math.ceil(s.hojas / 2);
  juego.hojas += hojas;
  juego.vecinos[dueno][i] = null;
  juego.stats.ayudas++;
  guardar();
  const pos = mundo.pantallaParcela(dueno, i);
  mundo.efectoParcela(dueno, i, "cosecha"); mundo.saltar(); sonido.cosecha();
  cartel({ titulo: t("ayudaste", { n: v.nombre }), sub: `${t("te_toco_mitad")} ${ganado.join("  ")}  +${hojas} 🍃`, ms: 1700 });
  volar("🍃", Math.ceil(hojas / 2), pos, "#hojas", hud);
  setTimeout(revisarMisiones, 1200);
}

function tickVecinos() {
  if (!mundo) return;
  const ahora = Date.now();
  let cambio = false;
  for (const v of VECINOS) {
    const lista = juego.vecinos[v.id];
    lista.forEach((p, i) => {
      if (!p && Math.random() < 0.07) { const tipo = ["fibra", "grano", "flor"][Math.floor(Math.random() * 3)]; lista[i] = { tipo, t: ahora }; cambio = true; }
    });
  }
  // Tus plantas listas que nadie recoge: un vecino puede cosecharlas y dejarte la mitad
  juego.parcelas.forEach((p, i) => {
    if (!p || etapa(p) < 4) return;
    const listaDesde = p.t + durSemilla(p.tipo);
    if (ahora - listaDesde < GRACIA) return;
    const v = VECINOS[Math.floor(Math.random() * VECINOS.length)];
    if (tiene("campanita")) {
      if (!p.avisado) { p.avisado = true; cambio = true; sonido.tick(); toast(`🔔 ${t("campanita_aviso", { n: v.nombre })}`, 4200); }
      return;
    }
    if (Math.random() > 0.3) return;
    const s = infoSemilla(p.tipo), ganado = [];
    for (const [k, n] of Object.entries(s.da)) { const m = Math.floor(n / 2); if (m) { agregar(k, m); ganado.push(`${objeto(k).icono}×${m}`); } }
    juego.hojas += Math.floor(s.hojas / 2);
    juego.parcelas[i] = null;
    cambio = true;
    mundo.efectoParcela("yo", i, "magia");
    sonido.sacudir();
    toast(`🤝 ${t("vecino_cosecho", { n: v.nombre, s: tx(s.nombre) })} ${ganado.join(" ")} +${Math.floor(s.hojas / 2)} 🍃. ${t("revancha")}`, 5200);
  });
  if (cambio) { guardar(); hud(); }
}

// ---------- video patrocinado (siempre opcional, con tope diario) ----------
const VIDEOS_DIA = 3, DUR_VIDEO = 10;
const videosHoy = () => (juego.videos?.fecha === hoy() ? juego.videos.n : 0);
function verVideo(alTerminar) {
  clearInterval(relojHoja); relojHoja = null;
  const m = marcas[Math.floor(Math.random() * marcas.length)];
  const el = document.createElement("div");
  el.className = "video";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
  el.style.setProperty("--c", m.color);
  el.style.setProperty("--c-txt", esClaro(m.color) ? "#160f2b" : "#fff");
  el.innerHTML = `
    <div class="video-pantalla">
      <span class="video-tag">${t("anuncio")} · ${esc(m.nombre)}</span>
      <div class="video-escena"><div class="video-prod" id="video-prod">${esc(m.productos[0].icono)}</div><h2>${esc(m.nombre)}</h2><p id="video-txt">${esc(tx(m.productos[0].nombre))}</p></div>
      <div class="video-barra"><div id="video-avance"></div></div>
    </div>
    <div class="video-pie">
      <span id="video-cuenta" class="video-cuenta">${DUR_VIDEO} s</span>
      <button class="btn fantasma pequeno" id="video-salir">${t("salir_sin_premio")}</button>
      <button class="btn" id="video-listo" hidden>${t("reclamar")}</button>
    </div>
    <p class="video-nota">${t("nota_video")}</p>`;
  $("#juego").appendChild(el);
  let visto = 0, ultimo = performance.now(), escena = 0;
  const reloj = setInterval(() => {
    const ahora = performance.now();
    if (!document.hidden) visto += (ahora - ultimo) / 1000;
    ultimo = ahora;
    const k = Math.min(1, visto / DUR_VIDEO);
    $("#video-avance", el).style.width = k * 100 + "%";
    $("#video-cuenta", el).textContent = document.hidden ? t("video_pausa") : `${Math.ceil(DUR_VIDEO - visto)} s`;
    const e = Math.min(m.productos.length - 1, Math.floor(k * m.productos.length));
    if (e !== escena) { escena = e; sonido.pop(); $("#video-prod", el).textContent = m.productos[e].icono; $("#video-txt", el).textContent = tx(m.productos[e].nombre); }
    if (k >= 1) {
      clearInterval(reloj);
      E.sumar(m.id, "videos");
      sonido.premio();
      $("#video-cuenta", el).textContent = "✓";
      $("#video-salir", el).hidden = true;
      $("#video-listo", el).hidden = false;
      $("#video-listo", el).focus();
    }
  }, 200);
  $("#video-salir", el).onclick = () => { clearInterval(reloj); el.remove(); toast(t("video_sin_premio")); };
  $("#video-listo", el).onclick = () => { el.remove(); cerrarHoja(); alTerminar(m); };
}

// ---------- stand de marca ----------
const yaJugo = (m) => juego.dia[m.id] === hoy();
function lookAnfitrion(m) {
  const n = [...m.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return { piel: LOOKS.pieles[n % 5], pelo: LOOKS.pelos[(n >> 2) % 5], ropa: m.color, gorra: n % 3 === 0 };
}

function abrirStand(id, vista = "inicio") {
  const m = marcaPorId(id);
  if (!m) return;
  if (vista === "inicio") {
    E.sumar(id, "visitas");
    if (!juego.visitados.includes(id)) { juego.visitados.push(id); guardar(); revisarMisiones(); }
  }
  const cab = `
    <header class="cab-stand">
      ${vista !== "inicio" ? `<button class="volver" data-vista="inicio" aria-label="${t("volver")}">←</button>` : ""}
      <div><h2>${esc(m.nombre)}</h2><p>${esc(nombrePais(m.pais))} · ${esc(tx(m.categoria))} · <span class="ejemplo">${t("marca_ejemplo")}</span></p></div>
    </header>`;
  let cuerpo = "";
  if (vista === "inicio") {
    const sinRegalo = !juego.regalos.includes(m.id), sinJugar = !yaJugo(m), sinLeer = !juego.leidos.includes(m.id);
    const iconoJuego = { ruleta: "🎡", quiz: "❓", rasca: "🎫" }[m.juego] || "🎡";
    cuerpo = `
      <div class="anfitrion">
        <canvas class="cara-anfitrion" id="anfitrion" width="140" height="140"></canvas>
        <div class="globo"><b>${esc(m.anfitrion.nombre)}</b><p id="saludo"></p></div>
      </div>
      <div class="cinco">
        <button data-vista="vitrina" style="--i:0"><span>🛍️</span>${t("vitrina")}</button>
        <button data-vista="juego" style="--i:1"><span>${iconoJuego}</span>${t("juego_" + m.juego)}${sinJugar ? `<i class="chapita">${t("juega")}</i>` : ""}</button>
        <button data-vista="regalo" style="--i:2"><span>🎁</span>${t("mostrador")}${sinRegalo ? `<i class="chapita">${t("gratis")}</i>` : ""}</button>
        <button data-vista="taller" style="--i:3"><span>📖</span>${t("taller")}${sinLeer ? `<i class="chapita">+3 🍃</i>` : ""}</button>
      </div>
      <p class="nota">${t("nota_no_venta")}</p>`;
  } else if (vista === "vitrina") {
    cuerpo = `<p class="centrado"><small>${t("toca_producto")}</small></p><div class="productos">${m.productos.map((p, i) => {
      const fav = juego.favoritos.includes(`${m.id}:${i}`);
      return `<div class="carta" data-carta="${i}" style="--i:${i}"><div class="carta-in">
        <div class="cara frente"><div class="prod-grande">${esc(p.icono)}</div><h3>${esc(tx(p.nombre))}</h3></div>
        <div class="cara dorso"><h3>${esc(tx(p.nombre))}</h3><p>${esc(tx(p.desc))}</p>
          <div class="acciones-prod"><button class="chip ${fav ? "activo" : ""}" data-fav="${i}">${fav ? "❤️" : "🤍"} ${t("me_gusta")}</button><button class="chip" data-ra>📱 ${t("ver_ra")}</button><button class="chip" data-web>🔗 ${t("web_marca")}</button></div></div>
      </div></div>`;
    }).join("")}</div>`;
  } else if (vista === "juego") {
    cuerpo = m.juego === "quiz" ? htmlQuiz(m) : m.juego === "rasca" ? htmlRasca(m) : htmlRuleta(m);
  } else if (vista === "regalo") {
    cuerpo = htmlMostrador(m);
  } else if (vista === "taller") {
    const leido = juego.leidos.includes(m.id);
    cuerpo = `
      <h3 class="titulo-taller">${esc(tx(m.taller.titulo))}</h3>
      <div class="balanza">
        <div class="bueno"><h4>✅ ${t("lo_bueno")}</h4><p>${esc(tx(m.taller.bueno))}</p></div>
        <div class="ojo"><h4>⚠️ ${t("ojo_con")}</h4><p>${esc(tx(m.taller.ojo))}</p></div>
      </div>
      <button class="btn" id="leido" ${leido ? "disabled" : ""}>${leido ? "✓ " + t("leido") : t("ya_lo_lei")}</button>
      <p class="nota">${t("nota_taller")}</p>`;
  }
  const c = abrirHoja(cab + cuerpo, { color: m.color, entrada: vista === "inicio" });
  c.querySelectorAll("[data-vista]").forEach((b) => (b.onclick = () => { sonido.tap(); abrirStand(id, b.dataset.vista); }));
  if (vista === "inicio") animarAnfitrion(m, c);
  if (vista === "vitrina") montarVitrina(m, c);
  if (vista === "juego") (m.juego === "quiz" ? montarQuiz : m.juego === "rasca" ? montarRasca : montarRuleta)(m, c);
  if (vista === "regalo") montarMostrador(m, c);
  if (vista === "taller" && $("#leido", c)) $("#leido", c).onclick = (ev) => {
    juego.leidos.push(m.id);
    const pos = centro(ev.currentTarget);
    dar({ hojas: 3 }); sonido.bien(); volar("🍃", 3, pos, "#hojas");
    abrirStand(id, "taller");
  };
}

function animarAnfitrion(m, c) {
  const cv = $("#anfitrion", c), x = cv.getContext("2d"), look = lookAnfitrion(m);
  const texto = tx(m.anfitrion.saludo), el = $("#saludo", c);
  let n = 0;
  const t0 = performance.now();
  const loop = (ms) => {
    if (!document.body.contains(cv)) return;
    const k = (ms - t0) / 1000;
    x.clearRect(0, 0, 140, 140);
    x.save(); x.translate(70, 128); x.scale(1.9, 1.9);
    dibujarPersona(x, 0, 0, look, 0, Math.sin(k * 0.7) > 0 ? 1 : -1, false, quieto ? 0 : Math.abs(Math.sin(k * 3)) * (n < texto.length ? 2.5 : 0.8));
    x.restore();
    if (n < texto.length) {
      const objetivo = quieto ? texto.length : Math.floor(k * 45);
      if (objetivo > n) { n = Math.min(texto.length, objetivo); el.textContent = texto.slice(0, n); if (n % 3 === 0) sonido.hablar(); }
    }
    animHoja = requestAnimationFrame(loop);
  };
  animHoja = requestAnimationFrame(loop);
  el.onclick = () => { n = texto.length; el.textContent = texto; };
}

function montarVitrina(m, c) {
  c.querySelectorAll(".carta").forEach((carta) => (carta.onclick = (ev) => {
    if (ev.target.closest("button")) return;
    carta.classList.toggle("girada"); sonido.pop();
  }));
  c.querySelectorAll("[data-fav]").forEach((b) => (b.onclick = () => {
    const k = `${m.id}:${b.dataset.fav}`;
    if (juego.favoritos.includes(k)) { juego.favoritos = juego.favoritos.filter((x) => x !== k); b.textContent = `🤍 ${t("me_gusta")}`; b.classList.remove("activo"); }
    else { juego.favoritos.push(k); E.sumar(m.id, "favoritos"); b.textContent = `❤️ ${t("me_gusta")}`; b.classList.add("activo"); sonido.bien(); const p = centro(b); flotante("❤️", p.x, p.y - 10, "#ff7ad9"); }
    guardar();
  }));
  c.querySelectorAll("[data-ra]").forEach((b) => (b.onclick = () => toast(t("ra_demo"))));
  c.querySelectorAll("[data-web]").forEach((b) => (b.onclick = () => toast(t("web_demo"))));
}

function terminarPartida(m) {
  juego.dia[m.id] = hoy(); juego.stats.partidas++;
  E.sumar(m.id, "partidas");
  guardar();
}
function otraVez(m, c) { const b = $("#otra", c); if (b) b.onclick = () => { delete juego.dia[m.id]; guardar(); abrirStand(m.id, "juego"); }; }

// ---- ruleta de casino ----
const PREMIOS = [{ hojas: 5 }, { hojas: 15 }, { lunas: 1 }, { cupon: true }, { hojas: 10 }, { hojas: 25 }, { regalo: true }, { hojas: 20 }];
const etiquetaPremio = (p) => (p.cupon ? "🎟️" : p.regalo ? "🎁" : p.lunas ? `${p.lunas}🌟` : `${p.hojas}🍃`);
function htmlRuleta(m) {
  return `
    <div class="ruleta-caja"><div class="puntero">▼</div><canvas id="ruleta" width="600" height="600"></canvas></div>
    <p class="centrado msg-juego" id="msg-ruleta">${yaJugo(m) ? t("vuelve_manana") : t("un_giro")}</p>
    <button class="btn grande brilla" id="girar" ${yaJugo(m) ? "disabled" : ""}>${t("girar")}</button>
    ${yaJugo(m) ? `<button class="btn fantasma pequeno" id="otra">${t("demo_otra")}</button>` : ""}
    <p class="nota">${t("nota_ruleta")}</p>`;
}
function montarRuleta(m, c) {
  otraVez(m, c);
  const cv = $("#ruleta", c), ctx = cv.getContext("2d"), n = PREMIOS.length, seg = (Math.PI * 2) / n;
  let rot = 0, girando = false;
  const pintar = (ms) => {
    ctx.clearRect(0, 0, 600, 600);
    ctx.save(); ctx.translate(300, 300);
    // aro de focos de casino
    ctx.fillStyle = "#2a1d4a"; ctx.beginPath(); ctx.arc(0, 0, 296, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, on = quieto || (Math.floor(ms / (girando ? 80 : 300)) + i) % 2;
      ctx.fillStyle = on ? "#fff3a8" : "#6a5a30";
      ctx.beginPath(); ctx.arc(Math.cos(a) * 278, Math.sin(a) * 278, 8, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < n; i++) {
      const a0 = rot + i * seg;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 258, a0, a0 + seg); ctx.closePath();
      ctx.fillStyle = i % 2 ? m.color : "#3a2766"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 3; ctx.stroke();
      ctx.save(); ctx.rotate(a0 + seg / 2);
      ctx.fillStyle = i % 2 ? (esClaro(m.color) ? "#160f2b" : "#fff") : "#fff";
      ctx.font = "800 38px Nunito, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(etiquetaPremio(PREMIOS[i]), 235, 0);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fillStyle = "#160f2b"; ctx.fill();
    ctx.strokeStyle = m.color; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = m.color; ctx.font = "700 34px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("✦", 0, 2);
    ctx.restore();
  };
  const idle = (ms) => { if (!document.body.contains(cv)) return; if (!girando) pintar(ms); animHoja = requestAnimationFrame(idle); };
  animHoja = requestAnimationFrame(idle);
  $("#girar", c).onclick = (ev) => {
    ev.currentTarget.disabled = true; girando = true; sonido.tap();
    const idx = Math.floor(Math.random() * n);
    const TAU = Math.PI * 2, norm = (a) => ((a % TAU) + TAU) % TAU;
    const final = -Math.PI / 2 - (idx + 0.5) * seg, inicio = rot;
    const destino = inicio + TAU * 6 + norm(norm(final) - norm(inicio));
    const dur = quieto ? 200 : 3600, t0 = performance.now();
    let ultimoSeg = -1;
    const paso = (ahora) => {
      const k = Math.min(1, (ahora - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      rot = inicio + (destino - inicio) * e; pintar(ahora);
      const s = Math.floor(norm(-Math.PI / 2 - rot) / seg);
      if (s !== ultimoSeg) { ultimoSeg = s; sonido.tick(); }
      if (k < 1) requestAnimationFrame(paso); else { girando = false; premiar(idx); }
    };
    requestAnimationFrame(paso);
  };
  const premiar = (idx) => {
    terminarPartida(m);
    const p = PREMIOS[idx], pos = centro(cv);
    let msg;
    if (p.cupon) {
      if (m.paises.includes(perfil.pais)) msg = bajarCupon(m) ? t("ganaste_cupon") : t("ya_tenias_cupon") + " " + dar({ hojas: 10 });
      else msg = t("cupon_no_pais") + " " + dar({ hojas: 10 });
    } else if (p.regalo) {
      const r = regaloDe(m); r.hojas = 0; if (r.obj) r.n = 1; else r.lunas = 1;
      msg = `${t("ganaste")} ${dar(r)}`;
    } else msg = `${t("ganaste")} ${dar(p)}`;
    $("#msg-ruleta", c).innerHTML = `<b>${msg}</b>`;
    const grande = p.hojas >= 20 || p.lunas;
    if (grande) { sonido.jackpot(); cartel({ titulo: t("premio_mayor"), sub: msg, tipo: "dorada", ms: 1700 }); }
    else { sonido.premio(); confeti(18); }
    if (p.hojas) volar("🍃", Math.ceil(p.hojas / 2), pos, "#hojas");
    if (p.lunas) volar("🌟", 3, pos, "#lunas");
    revisarMisiones();
  };
}

// ---- rasca y gana ----
const SIMBOLOS = ["🍃", "🌟", "⭐", "🎟️"];
function htmlRasca(m) {
  if (yaJugo(m)) return `<p class="centrado msg-juego">${t("vuelve_manana_rasca")}</p><button class="btn fantasma pequeno" id="otra">${t("demo_otra")}</button>`;
  return `
    <p class="centrado msg-juego" id="msg-rasca">${t("rasca_instr")}</p>
    <div class="rasca" id="rasca-caja" style="--c:${m.color}">
      <div class="rasca-celdas" id="celdas"></div>
      <canvas id="rasca" width="540" height="540"></canvas>
    </div>
    <p class="nota">${t("nota_rasca")}</p>`;
}
function montarRasca(m, c) {
  otraVez(m, c);
  const cv = $("#rasca", c);
  if (!cv) return;
  const gana = Math.random() < 0.55;
  const ganador = SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)];
  // 3 iguales = premio. Los demás símbolos aparecen como máximo 2 veces.
  const relleno = [...SIMBOLOS, "🌀"];
  const celdas = gana ? [ganador, ganador, ganador] : [];
  const cuenta = {};
  while (celdas.length < 9) {
    const s = relleno[Math.floor(Math.random() * relleno.length)];
    if (s === ganador && gana) continue;
    if ((cuenta[s] || 0) >= 2) continue;
    cuenta[s] = (cuenta[s] || 0) + 1; celdas.push(s);
  }
  celdas.sort(() => Math.random() - 0.5);
  $("#celdas", c).innerHTML = celdas.map((s) => `<span>${s}</span>`).join("");
  const x = cv.getContext("2d");
  const g = x.createLinearGradient(0, 0, 540, 540);
  g.addColorStop(0, "#d9d4e8"); g.addColorStop(0.5, "#a9a2c2"); g.addColorStop(1, "#e8e4f2");
  x.fillStyle = g; x.fillRect(0, 0, 540, 540);
  x.fillStyle = "rgba(255,255,255,.25)"; for (let i = 0; i < 60; i++) x.fillRect(Math.random() * 540, Math.random() * 540, 30, 3);
  x.fillStyle = "#5a5078"; x.font = "800 44px Fredoka, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(m.nombre.slice(0, 18), 270, 230); x.font = "700 30px Nunito, sans-serif"; x.fillText(t("rasca_aqui"), 270, 300);
  x.globalCompositeOperation = "destination-out";
  let rascando = false, revelado = false, ultimo = null, trazos = 0;
  const punto = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 540, y: ((e.clientY - r.top) / r.height) * 540 }; };
  const rascar = (p) => {
    x.lineWidth = 64; x.lineCap = "round";
    x.beginPath(); x.moveTo((ultimo || p).x, (ultimo || p).y); x.lineTo(p.x, p.y); x.stroke();
    x.beginPath(); x.arc(p.x, p.y, 32, 0, Math.PI * 2); x.fill();
    ultimo = p;
    if (++trazos % 4 === 0) { sonido.rasca(); revisar(); }
  };
  const revisar = () => {
    if (revelado) return;
    const d = x.getImageData(0, 0, 540, 540).data;
    let vacio = 0, total = 0;
    for (let i = 3; i < d.length; i += 4 * 40) { total++; if (d[i] === 0) vacio++; }
    if (vacio / total > 0.55) revelar();
  };
  const revelar = () => {
    revelado = true;
    cv.style.transition = "opacity .4s"; cv.style.opacity = 0;
    terminarPartida(m);
    const pos = centro(cv);
    if (gana) {
      $("#celdas", c).querySelectorAll("span").forEach((s, i) => { if (celdas[i] === ganador) s.classList.add("ganadora"); });
      let msg;
      if (ganador === "🍃") { msg = dar({ hojas: 20 }); volar("🍃", 10, pos, "#hojas"); }
      else if (ganador === "🌟") { msg = dar({ lunas: 2 }); volar("🌟", 4, pos, "#lunas"); }
      else if (ganador === "⭐") { const r = regaloDe(m); r.hojas = 0; msg = dar(r); }
      else msg = m.paises.includes(perfil.pais) ? (bajarCupon(m) ? t("ganaste_cupon") : t("ya_tenias_cupon") + " " + dar({ hojas: 10 })) : t("cupon_no_pais") + " " + dar({ hojas: 10 });
      sonido.jackpot();
      cartel({ titulo: t("tres_iguales"), sub: msg, tipo: "dorada", ms: 1800 });
      $("#msg-rasca", c).innerHTML = `<b>${t("ganaste")} ${msg}</b>`;
    } else {
      const msg = dar({ hojas: 3 });
      sonido.mal();
      $("#msg-rasca", c).innerHTML = `${t("rasca_casi")} <b>${msg}</b>`;
    }
    revisarMisiones();
  };
  cv.addEventListener("pointerdown", (e) => { rascando = true; ultimo = null; try { cv.setPointerCapture(e.pointerId); } catch {} rascar(punto(e)); });
  cv.addEventListener("pointermove", (e) => { if (rascando && !revelado) rascar(punto(e)); });
  cv.addEventListener("pointerup", () => { rascando = false; ultimo = null; revisar(); });
}

// ---- trivia con reloj ----
function htmlQuiz(m) {
  if (yaJugo(m)) return `<p class="centrado msg-juego">${t("vuelve_manana_quiz")}</p><button class="btn fantasma pequeno" id="otra">${t("demo_otra")}</button>`;
  return `<div id="quiz"></div>`;
}
function montarQuiz(m, c) {
  otraVez(m, c);
  const caja = $("#quiz", c);
  if (!caja) return;
  const preguntas = m.quiz?.length ? m.quiz : QUIZ_GENERAL;
  let i = 0, aciertos = 0, racha = 0, reloj = null;
  const pintar = () => {
    clearTimeout(reloj);
    if (i >= preguntas.length) {
      terminarPartida(m);
      const perfecta = aciertos === preguntas.length;
      const msg = dar({ hojas: aciertos * 5 + (perfecta ? 5 : 0), lunas: perfecta ? 1 : 0 });
      caja.innerHTML = `<div class="resultado"><div class="grande-emoji salta">${perfecta ? "🏆" : aciertos ? "🌿" : "🌱"}</div>
        <h3>${t("aciertos", { n: aciertos, total: preguntas.length })}</h3><p>${msg || t("sin_premio")}</p>
        <button class="btn" data-vista="inicio">${t("volver_stand")}</button></div>`;
      caja.querySelector("[data-vista]").onclick = () => abrirStand(m.id, "inicio");
      if (perfecta) { sonido.jackpot(); cartel({ titulo: t("trivia_perfecta"), sub: msg, tipo: "dorada", ms: 1700 }); }
      else if (aciertos) { sonido.premio(); confeti(14); }
      if (aciertos) volar("🍃", aciertos * 2, centro(caja), "#hojas");
      revisarMisiones();
      return;
    }
    const q = preguntas[i];
    caja.innerHTML = `<div class="quiz-cab"><span class="paso">${i + 1} / ${preguntas.length}</span>${racha > 1 ? `<span class="racha">🔥 ${t("racha", { n: racha })}</span>` : ""}</div>
      <div class="reloj"><div></div></div>
      <h3 class="pregunta">${esc(tx(q.p))}</h3>
      <div class="opciones">${q.o.map((o, k) => `<button class="opcion" data-k="${k}" style="--i:${k}">${esc(tx(o))}</button>`).join("")}</div>`;
    const responder = (k) => {
      clearTimeout(reloj);
      const bien = k === q.ok;
      if (bien) { aciertos++; racha++; sonido.bien(); } else { racha = 0; sonido.mal(); }
      caja.querySelectorAll(".opcion").forEach((x) => { x.disabled = true; if (+x.dataset.k === q.ok) x.classList.add("bien"); });
      const b = caja.querySelector(`[data-k="${k}"]`);
      if (b && !bien) b.classList.add("mal");
      if (bien && b) { const p = centro(b); flotante("+5 🍃", p.x, p.y - 20); }
      setTimeout(() => { i++; pintar(); }, quieto ? 500 : 1100);
    };
    caja.querySelectorAll(".opcion").forEach((b) => (b.onclick = () => responder(+b.dataset.k)));
    reloj = setTimeout(() => responder(-1), 15000);
  };
  pintar();
}

// ---- mostrador: caja de regalo, cupón, semilla registrada ----
function bajarCupon(m) {
  if (juego.cupones.some((c) => c.marca === m.id && c.estado === "activo")) return false;
  juego.cupones.push({ marca: m.id, desc: m.cupon.desc, vence: Date.now() + (m.cupon.dias || 30) * 86400000, estado: "activo", calif: 0 });
  E.sumar(m.id, "cupones");
  guardar();
  return true;
}
function htmlMostrador(m) {
  const r = regaloDe(m);
  const yaRegalo = juego.regalos.includes(m.id);
  const enPais = m.paises.includes(perfil.pais);
  const tieneCupon = juego.cupones.some((c) => c.marca === m.id);
  const sem = m.semilla ? infoSemilla("reg:" + m.id) : null;
  return `
    <section class="caja-regalo ${yaRegalo ? "abierta" : ""}" id="caja-regalo" style="--c:${m.color}">
      ${yaRegalo
        ? `<div class="regalo-abierto"><span class="prod-grande">${r.obj ? objeto(r.obj).icono : "🌟"}</span><p>✓ ${t("ya_recibiste")}</p></div>`
        : `<button class="regalo-cerrado" id="abrir-regalo" aria-label="${t("abrir_regalo")}"><span class="moño">🎀</span><span class="caja">🎁</span></button><p class="centrado"><b>${t("toca_regalo")}</b></p>`}
    </section>
    ${sem ? `
    <section class="tarjeta-regalo semilla-reg" style="--c:${m.color}">
      <div class="icono-prod">${sem.icono}</div>
      <div><h3>🏷️ ${esc(tx(sem.nombre))}</h3><p><small>${t("semilla_reg_txt")}</small></p>
      <button class="btn" id="comprar-semilla" ${juego.lunas < m.semilla.precio.lunas ? "disabled" : ""}>${t("comprar_por", { n: m.semilla.precio.lunas })}</button>
      ${tiene("reg:" + m.id) ? `<small>${t("tienes", { n: juego.inv["reg:" + m.id] })}</small>` : ""}</div>
    </section>` : ""}
    <section class="tarjeta-regalo boleto" style="--c:${m.color}">
      <div class="icono-prod">🎟️</div>
      <div><h3>${esc(tx(m.cupon.desc))}</h3><p><small>${t("vigencia", { dias: m.cupon.dias })} · ${m.paises.map(nombrePais).join(", ")}</small></p>
      ${enPais
        ? `<button class="btn" id="cupon" ${tieneCupon ? "disabled" : ""}>${tieneCupon ? "✓ " + t("en_inventario") : t("bajar_cupon")}</button>`
        : `<p class="aviso-pais">${t("no_disponible_pais", { pais: nombrePais(perfil.pais) })}</p>`}</div>
    </section>
    <section class="tarjeta-regalo extra">
      <div class="icono-prod">🏆</div>
      <div><h3>${t("extra_raro")}</h3><p><small>${t("extra_raro_txt")}</small></p><p class="codigo-mini">${juego.codigo}</p></div>
    </section>`;
}
function montarMostrador(m, c) {
  const b = $("#abrir-regalo", c);
  if (b) {
    let toques = 0;
    b.onclick = () => {
      toques++;
      b.classList.remove("sacude"); void b.offsetWidth; b.classList.add("sacude");
      sonido.sacudir();
      if (toques < 3) return;
      juego.regalos.push(m.id);
      const r = regaloDe(m), pos = centro(b);
      const msg = dar(r);
      sonido.abrir(); setTimeout(() => sonido.premio(), 200);
      const caja = $("#caja-regalo", c);
      caja.classList.add("abierta", "explota");
      caja.innerHTML = `<div class="regalo-abierto revela"><span class="prod-grande">${r.obj ? objeto(r.obj).icono : "🌟"}</span><h3>${r.obj ? tx(objeto(r.obj)) : t("dos_lunas")}</h3><p>${msg}</p>${r.obj ? `<small>${tx(objeto(r.obj).efecto)}</small>` : ""}</div>`;
      confeti(28);
      setTimeout(revisarMisiones, 900);
      volar("🍃", 3, pos, "#hojas");
      if (r.obj) setTimeout(() => volar(objeto(r.obj).icono, 3, pos, "#btn-inventario"), 200);
      if (r.lunas) setTimeout(() => volar("🌟", 4, pos, "#lunas"), 200);
    };
  }
  const cu = $("#cupon", c);
  if (cu) cu.onclick = () => {
    bajarCupon(m); sonido.premio();
    const p = centro(cu); volar("🎟️", 1, p, "#btn-inventario");
    cu.closest(".boleto").classList.add("arrancado");
    setTimeout(() => abrirStand(m.id, "regalo"), quieto ? 0 : 600);
  };
  const cs = $("#comprar-semilla", c);
  if (cs) cs.onclick = () => {
    const precio = m.semilla.precio.lunas;
    if (juego.lunas < precio) return;
    juego.lunas -= precio; agregar("reg:" + m.id); guardar(); hud();
    sonido.premio();
    const p = centro(cs); volar(infoSemilla("reg:" + m.id).icono, 3, p, "#btn-inventario");
    toast(`🏷️ ${t("semilla_comprada")}`);
    setTimeout(() => abrirStand(m.id, "regalo"), quieto ? 0 : 500);
  };
}

// ---------- Taller de transformación y Mercado ----------
function abrirTaller(pestana = "recetas", cat = "textil") {
  const tabs = `<div class="tabs">${["recetas", "mercado"].map((p) => `<button data-tab="${p}" class="${p === pestana ? "activo" : ""}">${t("tab_" + p)}</button>`).join("")}</div>`;
  let cuerpo = "";
  if (pestana === "recetas") {
    const chips = `<div class="chips">${Object.entries(CATEGORIAS_RECETA).map(([k, v]) => `<button class="chip ${k === cat ? "activo" : ""}" data-cat="${k}">${v.icono} ${tx(v)}</button>`).join("")}</div>`;
    const lista = RECETAS.filter((r) => r.cat === cat).map((r) => {
      const bloqueada = r.requiere && !juego.lecciones.includes(r.requiere);
      const alcanza = Object.entries(r.pide).every(([k, n]) => (juego.inv[k] || 0) >= n);
      return `<div class="receta ${alcanza && !bloqueada ? "lista" : ""}">
        <span class="icono-prod">${r.icono}</span>
        <div><b>${tx(r)}</b>
          <div class="ingredientes">${Object.entries(r.pide).map(([k, n]) => `<span class="${(juego.inv[k] || 0) >= n ? "ok" : "falta"}">${objeto(k).icono} ${juego.inv[k] || 0}/${n}</span>`).join("")}</div>
          <small>${r.lunas ? `→ +${r.lunas} 🌟` : `${t("vale")} ${r.vale} 🍃`}${r.cat === "botica" ? ` · ${t("no_medicamento")}` : ""}</small>
          ${bloqueada ? `<small class="bloq">🔒 ${t("requiere_" + r.requiere)}</small>` : ""}
        </div>
        <button class="btn pequeno" data-r="${r.id}" ${alcanza && !bloqueada ? "" : "disabled"}>${t("transformar")}</button>
      </div>`;
    }).join("");
    cuerpo = `${chips}<div class="recetas">${lista}</div><p class="nota">${t("nota_taller_t")}</p>`;
  } else {
    const vendibles = Object.keys(juego.inv).filter((k) => juego.inv[k] > 0 && objeto(k).vende > 0 && !k.startsWith("reg:") && !k.startsWith("extra:"));
    cuerpo = vendibles.length ? `<div class="mercado">${vendibles.map((k) => { const o = objeto(k); return `
      <div class="fila-mercado"><span class="icono-prod">${o.icono}</span><span><b>${tx(o)} ×${juego.inv[k]}</b><small>${o.vende} 🍃 ${t("c_u")}</small></span>
      <button class="btn pequeno" data-v="${k}" data-n="1">${t("vender")} 1</button>${juego.inv[k] > 1 ? `<button class="btn pequeno fantasma" data-v="${k}" data-n="${juego.inv[k]}">${t("todo")}</button>` : ""}</div>`; }).join("")}</div>
      <p class="nota">${t("nota_mercado")}</p>` : `<p class="vacio">${t("mercado_vacio")}</p>`;
  }
  const c = abrirHoja(`<h2>⚗️ ${t("taller_t")}</h2>${tabs}${cuerpo}`, { color: "#ffb35c" });
  c.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { sonido.tap(); abrirTaller(b.dataset.tab, cat); }));
  c.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { sonido.tap(); abrirTaller("recetas", b.dataset.cat); }));
  c.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => transformar(RECETAS.find((r) => r.id === b.dataset.r), cat)));
  c.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => {
    const k = b.dataset.v, n = Math.min(+b.dataset.n, juego.inv[k] || 0), o = objeto(k);
    if (!n) return;
    juego.inv[k] -= n; juego.hojas += o.vende * n; juego.stats.vendidos += n; guardar();
    volar("🍃", Math.min(10, Math.ceil((o.vende * n) / 3)), centro(b), "#hojas", hud);
    flotante(`+${o.vende * n} 🍃`, centro(b).x, centro(b).y - 20);
    revisarMisiones();
    setTimeout(() => abrirTaller("mercado"), quieto ? 0 : 350);
  }));
}

async function transformar(r, cat) {
  for (const [k, n] of Object.entries(r.pide)) juego.inv[k] -= n;
  guardar();
  const c = abrirHoja(`<div class="caldero"><div class="olla">⚗️</div><div class="remolino">${["🍃", "✨", "🌿", "✨", "🍃", "✨"].map((x, i) => `<span style="--i:${i}">${x}</span>`).join("")}</div><p>${t("transformando")}</p></div>`, { color: "#ffb35c" });
  for (let i = 0; i < 6; i++) { sonido.burbuja(); await espera(220); }
  agregar(r.id); juego.stats.transformados++;
  if (r.lunas) juego.lunas += r.lunas;
  guardar(); hud();
  sonido.premio(); confeti(20);
  c.innerHTML = `<div class="resultado revela"><div class="grande-emoji salta">${r.icono}</div><h2>${tx(r)}</h2>
    <p>${r.lunas ? `+${r.lunas} 🌟` : `${t("vale")} ${r.vale} 🍃 ${t("en_mercado")}`}</p>
    <div class="fila-botones"><button class="btn" id="otra-receta">${t("seguir_transformando")}</button><button class="btn fantasma" id="ir-mercado">${t("ir_mercado")}</button></div></div>`;
  if (r.lunas) volar("🌟", 4, centro(c), "#lunas");
  $("#otra-receta", c).onclick = () => abrirTaller("recetas", cat);
  $("#ir-mercado", c).onclick = () => abrirTaller("mercado");
  revisarMisiones();
}

// ---------- universidad ----------
function abrirUniversidad(idLeccion) {
  if (!idLeccion) {
    const c = abrirHoja(`
      <h2>🎓 ${t("universidad")}</h2>
      <p>${t("uni_txt")}</p>
      <div class="lecciones">${LECCIONES.map((l) => `
        <button class="leccion" data-l="${l.id}"><span class="icono-prod">${l.icono}</span>
        <span><b>${tx(l.titulo)}</b><small>${juego.lecciones.includes(l.id) ? "✓ " + t("completada") : tx(l.premio) + ` · +${l.lunas} 🌟`}</small></span></button>`).join("")}</div>`, { color: "#8fa6ff" });
    c.querySelectorAll("[data-l]").forEach((b) => (b.onclick = () => { sonido.tap(); abrirUniversidad(b.dataset.l); }));
    return;
  }
  const l = LECCIONES.find((x) => x.id === idLeccion);
  const hecha = juego.lecciones.includes(l.id);
  const c = abrirHoja(`
    <header class="cab-stand"><button class="volver" id="volver-uni">←</button><div><h2>${l.icono} ${tx(l.titulo)}</h2></div></header>
    <div class="leccion-texto">${l.texto.map((p, i) => `<p style="--i:${i}">${tx(p)}</p>`).join("")}</div>
    <h3 class="pregunta">${tx(l.pregunta.p)}</h3>
    <div class="opciones">${l.pregunta.o.map((o, k) => `<button class="opcion" data-k="${k}" ${hecha ? "disabled" : ""}>${tx(o)}</button>`).join("")}</div>
    <p class="centrado" id="msg-leccion">${hecha ? "✓ " + t("completada") : ""}</p>`, { color: "#8fa6ff" });
  $("#volver-uni", c).onclick = () => abrirUniversidad();
  c.querySelectorAll(".opcion").forEach((b) => (b.onclick = () => {
    if (+b.dataset.k === l.pregunta.ok) {
      b.classList.add("bien");
      c.querySelectorAll(".opcion").forEach((x) => (x.disabled = true));
      juego.lecciones.push(l.id);
      const premio = dar({ lunas: l.lunas });
      sonido.jackpot();
      cartel({ titulo: t("leccion_lista"), sub: `${premio} · ${tx(l.premio)}`, ms: 2000 });
      volar("🌟", 4, centro(b), "#lunas");
      $("#msg-leccion", c).innerHTML = `<b>${tx(l.premio)}</b>`;
      revisarMisiones();
    } else { b.classList.add("mal"); sonido.mal(); $("#msg-leccion", c).textContent = t("intenta"); }
  }));
}

// ---------- mochila ----------
const GRUPOS = [["material", "grupo_materiales"], ["ingrediente", "grupo_ingredientes"], ["producto", "grupo_productos"], ["semilla", "grupo_semillas"], ["mejora", "grupo_mejoras"], ["coleccion", "grupo_coleccion"]];
function abrirInventario(pestana = "objetos") {
  const tabs = `<div class="tabs">${["objetos", "cupones", "codigo"].map((p) => `<button data-tab="${p}" class="${p === pestana ? "activo" : ""}">${t("tab_" + p)}</button>`).join("")}</div>`;
  let cuerpo = "";
  if (pestana === "objetos") {
    const ids = Object.keys(juego.inv).filter((k) => juego.inv[k] > 0);
    cuerpo = ids.length ? GRUPOS.map(([tipo, k]) => {
      const del = ids.filter((id) => objeto(id).tipo === tipo);
      if (!del.length) return "";
      return `<h3 class="subtitulo">${t(k)}</h3><div class="objetos">${del.map((id, i) => { const o = objeto(id); return `
        <div class="objeto r-${o.rareza}" style="--i:${i}"><span class="icono-prod">${o.icono}</span><b>${tx(o)}${juego.inv[id] > 1 ? ` ×${juego.inv[id]}` : ""}</b>
        <small class="rareza">${t("rareza_" + o.rareza)}</small><small>${tx(o.efecto)}</small></div>`; }).join("")}</div>`;
    }).join("") : `<p class="vacio">${t("inv_vacio")}</p>`;
  } else if (pestana === "cupones") {
    cuerpo = juego.cupones.length ? juego.cupones.map((cu, i) => {
      const m = marcaPorId(cu.marca);
      const estado = cu.estado === "activo" && Date.now() > cu.vence ? "vencido" : cu.estado;
      return `<div class="cupon" style="--c:${m?.color || "#c6f36b"}">
        <div><b>${esc(m?.nombre || cu.marca)}</b><p>${esc(tx(cu.desc))}</p><small>${t("vence")} ${new Date(cu.vence).toLocaleDateString(lang)}</small></div>
        <span class="estado e-${estado}">${t("estado_" + estado)}</span>
        ${cu.estado === "canjeado" ? `<div class="estrellas" data-i="${i}">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}" class="${cu.calif >= n ? "on" : ""}" ${cu.calif ? "disabled" : ""} aria-label="${n}">★</button>`).join("")}<small>${cu.calif ? t("gracias_calif") : t("califica")}</small></div>` : ""}
      </div>`;
    }).join("") + `<p class="nota">${t("nota_cupones")}</p>` : `<p class="vacio">${t("sin_cupones")}</p>`;
  } else {
    cuerpo = `<div class="mi-codigo"><p>${t("tu_codigo")}</p><div class="codigo">${juego.codigo}</div>
      <ol><li>${t("codigo_1")}</li><li>${t("codigo_2")}</li><li>${t("codigo_3")}</li></ol></div>`;
  }
  const c = abrirHoja(`<h2>🎒 ${t("inventario")}</h2>${tabs}${cuerpo}`, { color: "#f2c45a" });
  c.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { sonido.tap(); abrirInventario(b.dataset.tab); }));
  c.querySelectorAll(".estrellas").forEach((el) => el.querySelectorAll("button").forEach((b) => (b.onclick = () => {
    const cu = juego.cupones[+el.dataset.i];
    cu.calif = +b.dataset.n; E.calificar(cu.marca, cu.calif); guardar(); sonido.bien();
    abrirInventario("cupones");
  })));
}

// ---------- misiones ----------
function abrirMisiones() {
  abrirHoja(`
    <h2>📜 ${t("misiones")}</h2>
    <div class="misiones">${MISIONES.map((m, i) => {
      const hecha = juego.misiones.includes(m.id), a = Math.min(m.meta, avance[m.id]());
      return `<div class="mision ${hecha ? "hecha" : ""}" style="--i:${i}"><span class="icono-prod">${hecha ? "✅" : m.icono}</span>
        <span><b>${tx(m)}</b><span class="mini-barra"><span style="width:${(a / m.meta) * 100}%"></span></span><small>${a}/${m.meta} · ${m.hojas ? `+${m.hojas} 🍃` : ""}${m.lunas ? `+${m.lunas} 🌟` : ""}</small></span></div>`;
    }).join("")}</div>
    <p class="nota">${t("nota_misiones")}</p>`, { color: "#ff9be6" });
}

// ---------- buscador ----------
function abrirBuscador(zona = "todas") {
  const c = abrirHoja(`
    <h2>🔍 ${t("buscar")}</h2>
    <input id="q" class="buscador" placeholder="${t("buscar_ph")}" autocomplete="off">
    <div class="chips">${["todas", ...Object.keys(ZONAS)].map((z) => `<button class="chip ${z === zona ? "activo" : ""}" data-z="${z}">${z === "todas" ? t("todas") : tx(ZONAS[z])}</button>`).join("")}</div>
    <div id="resultados" class="resultados"></div>`, { color: "#8ff7ff" });
  const pintar = (q = "") => {
    const n = q.trim().toLowerCase();
    const lista = [
      ...(zona === "todas" ? [
        { id: "granja", nombre: t("mi_terreno"), sub: t("granja_sub"), color: "#c6f36b" },
        { id: "taller", nombre: t("taller_t"), sub: t("taller_sub"), color: "#ffb35c" },
        { id: "universidad", nombre: t("universidad"), sub: t("uni_sub"), color: "#8fa6ff" },
      ] : []),
      ...marcas.filter((m) => zona === "todas" || m.zona === zona).map((m) => ({ id: m.id, nombre: m.nombre, sub: `${nombrePais(m.pais)} · ${tx(m.categoria)} · ${tx(ZONAS[m.zona])}`, color: m.color, nuevo: !juego.visitados.includes(m.id) })),
    ].filter((x) => !n || (x.nombre + " " + x.sub).toLowerCase().includes(n));
    $("#resultados", c).innerHTML = lista.map((x) => `<button class="resultado" data-id="${x.id}"><span class="punto" style="background:${x.color}"></span><span><b>${esc(x.nombre)}${x.nuevo ? " <i class='nuevo'>✦</i>" : ""}</b><small>${esc(x.sub)}</small></span><span class="ir">${t("ir")}</span></button>`).join("") || `<p class="vacio">${t("sin_resultados")}</p>`;
    c.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => teletransporte(b.dataset.id)));
  };
  pintar();
  $("#q", c).oninput = (e) => pintar(e.target.value);
  c.querySelectorAll("[data-z]").forEach((b) => (b.onclick = () => { sonido.tap(); abrirBuscador(b.dataset.z); }));
}

// ---------- menú ----------
function abrirMenu() {
  const c = abrirHoja(`
    <h2>✦ Weedland</h2>
    <p>${t("menu_txt")}</p>
    <div class="menu-lista">
      <a class="resultado" href="marca/index.html"><span class="icono-prod">🏪</span><span><b>${t("panel_marca")}</b><small>${t("panel_marca_sub")}</small></span></a>
      <button class="resultado" id="m-avatar"><span class="icono-prod">🧑‍🎨</span><span><b>${t("cambiar_avatar")}</b></span></button>
      <button class="resultado" id="m-pais"><span class="icono-prod">🌍</span><span><b>${t("cambiar_pais")}</b><small>${nombrePais(perfil.pais)}</small></span></button>
      <button class="resultado" id="m-reset"><span class="icono-prod">♻️</span><span><b>${t("reiniciar")}</b><small>${t("reiniciar_sub")}</small></span></button>
    </div>
    <p class="nota">${t("nota_demo")}</p>`);
  $("#m-avatar", c).onclick = () => { cerrarHoja(); pantallaAvatar(true); };
  $("#m-pais", c).onclick = () => { cerrarHoja(); perfil.edadOk = false; $("#juego").hidden = true; pantallaEntrada(); };
  $("#m-reset", c).onclick = (ev) => {
    const b = ev.currentTarget;
    if (!b.dataset.seguro) { b.dataset.seguro = "1"; b.querySelector("small").textContent = t("confirmar_reinicio"); return; }
    E.borrarTodo(); location.hash = ""; location.reload();
  };
}

// ---------- avisos desde el panel de marca ----------
function procesarAvisos() {
  if (!juego.avisos?.length) return;
  juego.avisos.forEach((a, i) => setTimeout(() => { sonido.jackpot(); confeti(30, true); toast(tx(a), 5000); }, 300 + i * 900));
  juego.avisos = [];
  guardar(); hud();
}
window.addEventListener("storage", (e) => {
  if (e.key === E.CLAVES.juego) { juego = E.leerJuego(); hud(); procesarAvisos(); }
  if (e.key === E.CLAVES.marcas && mundo) { marcas = E.marcas(); mundo.setInfo(infoEdificios()); }
});

// ---------- botones ----------
$("#velo").onclick = cerrarHoja;
$("#hoja-cerrar").onclick = () => { sonido.tap(); cerrarHoja(); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#hoja").hidden) cerrarHoja(); });
const boton = (sel, fn) => ($(sel).onclick = () => { sonido.tap(); fn(); });
boton("#btn-buscar", () => abrirBuscador());
boton("#btn-granja", () => teletransporte("granja"));
boton("#btn-inventario", () => abrirInventario());
boton("#btn-taller", () => teletransporte("taller"));
boton("#btn-misiones", abrirMisiones);
boton("#btn-uni", () => teletransporte("universidad"));
boton("#btn-menu", abrirMenu);
$("#zoom-mas").onclick = () => mundo && mundo.zoom(1.15);
$("#zoom-menos").onclick = () => mundo && mundo.zoom(0.87);
$("#btn-sonido").onclick = () => { alternarSonido(); hud(); sonido.tap(); };
$("#btn-idioma").onclick = () => {
  lang = lang === "es" ? "en" : "es";
  perfil.lang = lang; E.guardarPerfil(perfil);
  sonido.tap(); hud();
  if (mundo) mundo.setInfo(infoEdificios());
  cerrarHoja();
};

// ---------- inicio ----------
if (!perfil?.edadOk) pantallaEntrada();
else if (!perfil.look) pantallaAvatar();
else arrancar();
