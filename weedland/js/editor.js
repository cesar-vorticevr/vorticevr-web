// Editor del stand en el panel de marca: logo e imágenes (con recorte a la medida pedida), videos, modelo 3D y promociones.
// Los archivos van a IndexedDB (medios.js) y lo que hay, con su versión, a la marca (guardarMarca), así la réplica y la estación se actualizan.
import { IMAGENES, PROMO_IMG, MAX_VIDEOS_MARCA, VIDEO_MB, MODELO_MB, guardarArchivo, borrarArchivo, urlDe, version } from "./medios.js";
import { guardarMarca } from "./estado.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MB = (b) => (b / 1048576).toFixed(1).replace(".0", "") + " MB";
const elegirArchivo = (accept) => new Promise((ok) => {
  const i = document.createElement("input"); i.type = "file"; i.accept = accept;
  i.onchange = () => ok(i.files[0] || null); i.click();
});

// ---------- recortador: cualquier imagen queda exactamente de la medida pedida ----------
// spec: { w, h, nombre, ayuda, modo ("llenar" | "contener"), tipo (image/png | image/jpeg) } · color = color de la marca
export function recortar(archivo, spec, color = "#7a3cff") {
  return new Promise((ok) => {
    const url = URL.createObjectURL(archivo), img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); alert("No se pudo abrir esa imagen. Prueba con JPG, PNG o WebP."); ok(null); };
    img.onload = () => {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const transparente = spec.tipo === "image/png";
      let fondo = transparente ? "transparente" : color;
      const base = (modo) => (modo === "llenar" ? Math.max(spec.w / iw, spec.h / ih) : Math.min(spec.w / iw, spec.h / ih));
      let modo = spec.modo || "llenar", zoom = 1, cx = 0, cy = 0; // cx, cy: desplazamiento en px de salida
      const fondoEl = document.createElement("div");
      fondoEl.className = "rec-fondo";
      const chica = iw < spec.w * 0.6 && ih < spec.h * 0.6;
      fondoEl.innerHTML = `<div class="rec" style="--c:${color}">
        <h3>${esc(spec.nombre)}</h3>
        <p class="suave chico-t" style="margin:0">Va a quedar de <b>${spec.w} × ${spec.h} px</b>. Arrastra para acomodarla y usa el zoom. Lo que está dentro del marco es lo que se verá.</p>
        ${chica ? `<p class="chico-t" style="color:#ffd76a;margin:6px 0 0">⚠️ Tu imagen mide ${iw} × ${ih} px: se puede ver borrosa. Si tienes una más grande, mejor súbela.</p>` : ""}
        <div class="rec-lienzo"><canvas></canvas><div class="marco"></div></div>
        <div class="rec-ctl">
          <div class="fila"><span>Encuadre</span><div class="segm" style="flex:1"><button data-modo="llenar">Llenar el espacio</button><button data-modo="contener">Que se vea completa</button></div></div>
          <div class="fila"><span>Zoom</span><input type="range" min="0.5" max="3" step="0.01" value="1" style="flex:1"></div>
          <div class="fila" data-fondos><span>Fondo</span>
            ${transparente ? `<button class="colorcito" data-f="transparente" title="Transparente" style="background:repeating-conic-gradient(#999 0 25%,#fff 0 50%) 0 0/10px 10px"></button>` : ""}
            <button class="colorcito" data-f="${color}" title="Color de tu marca" style="background:${color}"></button>
            <button class="colorcito" data-f="#000000" title="Negro" style="background:#000"></button>
            <button class="colorcito" data-f="#ffffff" title="Blanco" style="background:#fff"></button>
            <small class="suave">(se nota cuando la imagen no llena el espacio)</small></div>
          <div class="fila" style="justify-content:flex-end"><button class="btn sec chico" data-cancelar>Cancelar</button><button class="btn chico" data-listo>✓ Usar esta imagen</button></div>
        </div></div>`;
      document.body.appendChild(fondoEl);
      const lienzo = $(".rec-lienzo", fondoEl), cv = $("canvas", fondoEl), g = cv.getContext("2d");
      // vista previa a escala (máximo 640 de ancho y 52vh de alto)
      const maxW = Math.min(640, fondoEl.querySelector(".rec").clientWidth - 32), maxH = innerHeight * 0.52;
      const k = Math.min(maxW / spec.w, maxH / spec.h);
      lienzo.style.width = spec.w * k + "px"; lienzo.style.height = spec.h * k + "px";
      cv.width = Math.round(spec.w * k * devicePixelRatio); cv.height = Math.round(spec.h * k * devicePixelRatio);
      const dibujar = (ctx, W, H) => {
        const s = (W / spec.w), e = base(modo) * zoom;
        ctx.clearRect(0, 0, W, H);
        if (fondo !== "transparente") { ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H); }
        const dw = iw * e * s, dh = ih * e * s;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, W / 2 - dw / 2 + cx * s, H / 2 - dh / 2 + cy * s, dw, dh);
      };
      const pintar = () => {
        dibujar(g, cv.width, cv.height);
        $$("[data-modo]", fondoEl).forEach((b) => b.classList.toggle("activo", b.dataset.modo === modo));
        $$("[data-f]", fondoEl).forEach((b) => b.classList.toggle("activo", b.dataset.f === fondo));
      };
      $$("[data-modo]", fondoEl).forEach((b) => (b.onclick = () => { modo = b.dataset.modo; zoom = 1; cx = cy = 0; $("input[type=range]", fondoEl).value = 1; pintar(); }));
      $$("[data-f]", fondoEl).forEach((b) => (b.onclick = () => { fondo = b.dataset.f; pintar(); }));
      $("input[type=range]", fondoEl).oninput = (e) => { zoom = +e.target.value; pintar(); };
      lienzo.addEventListener("wheel", (e) => { e.preventDefault(); zoom = Math.max(0.5, Math.min(3, zoom * (e.deltaY < 0 ? 1.06 : 0.94))); $("input[type=range]", fondoEl).value = zoom; pintar(); }, { passive: false });
      // arrastrar con el dedo o el mouse (y pellizcar para el zoom)
      const toques = new Map(); let dist0 = 0, zoom0 = 1;
      lienzo.addEventListener("pointerdown", (e) => { lienzo.setPointerCapture(e.pointerId); toques.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (toques.size === 2) { const [a, b] = [...toques.values()]; dist0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = zoom; } });
      lienzo.addEventListener("pointermove", (e) => {
        const t = toques.get(e.pointerId); if (!t) return;
        if (toques.size === 1) { cx += (e.clientX - t.x) / k; cy += (e.clientY - t.y) / k; }
        t.x = e.clientX; t.y = e.clientY;
        if (toques.size === 2) { const [a, b] = [...toques.values()]; zoom = Math.max(0.5, Math.min(3, zoom0 * Math.hypot(a.x - b.x, a.y - b.y) / (dist0 || 1))); $("input[type=range]", fondoEl).value = zoom; }
        pintar();
      });
      const soltar = (e) => toques.delete(e.pointerId);
      lienzo.addEventListener("pointerup", soltar); lienzo.addEventListener("pointercancel", soltar);
      const cerrar = (res) => { URL.revokeObjectURL(url); fondoEl.remove(); ok(res); };
      $("[data-cancelar]", fondoEl).onclick = () => cerrar(null);
      $("[data-listo]", fondoEl).onclick = () => {
        const out = document.createElement("canvas"); out.width = spec.w; out.height = spec.h;
        dibujar(out.getContext("2d"), spec.w, spec.h);
        out.toBlob((b) => cerrar(b), spec.tipo || "image/jpeg", 0.88);
      };
      pintar();
    };
    img.src = url;
  });
}

// ---------- logo e imágenes ----------
export function editorImagenes(caja, m, listo) {
  const md = m.medios || {};
  caja.innerHTML = `<h2>🖼️ Logo e imágenes</h2>
    <p class="ayuda">Sube cualquier imagen: el editor la deja de la medida exacta que pide cada lugar. Tú eliges cómo se encuadra.</p>
    <div class="slots">${Object.entries(IMAGENES).map(([k, s]) => `
      <div class="slot" data-slot="${k}">
        <div class="slot-vista" style="aspect-ratio:${s.w}/${s.h};${s.h > s.w ? "max-width:150px" : ""}">${md[k] ? `<img alt="">` : `<div class="vacio">Sin imagen<br>(se usa el diseño de Weedland)</div>`}</div>
        <b>${esc(s.nombre)}</b>
        <small>${esc(s.donde)}<br><span class="medida">${s.w} × ${s.h} px</span> ${esc(s.ayuda)}</small>
        <div class="fila-b"><button class="btn chico" data-subir>${md[k] ? "Cambiar" : "Subir imagen"}</button>${md[k] ? `<button class="btn sec chico" data-quitar>Quitar</button>` : ""}</div>
      </div>`).join("")}</div>`;
  $$("[data-slot]", caja).forEach(async (el) => {
    const k = el.dataset.slot, spec = IMAGENES[k];
    if (md[k]) { const u = await urlDe(m.id, k, md[k]); if (u) $("img", el).src = u; }
    $("[data-subir]", el).onclick = async () => {
      const f = await elegirArchivo("image/*"); if (!f) return;
      const blob = await recortar(f, spec, m.color); if (!blob) return;
      await guardarArchivo(m.id, k, blob);
      guardarMarca(m.id, { medios: { ...(m.medios || {}), [k]: version() } });
      listo(`${spec.nombre} lista ✓`);
    };
    const q = $("[data-quitar]", el);
    if (q) q.onclick = async () => {
      await borrarArchivo(m.id, k);
      const n = { ...(m.medios || {}) }; delete n[k];
      guardarMarca(m.id, { medios: n }); listo("Quitada");
    };
  });
}

// ---------- videos (horizontales y verticales) ----------
function medirVideo(url) {
  return new Promise((ok) => {
    const v = document.createElement("video"); v.preload = "metadata"; v.muted = true;
    v.onloadedmetadata = () => ok({ w: v.videoWidth, h: v.videoHeight, dur: v.duration });
    v.onerror = () => ok(null); v.src = url;
  });
}
const orientDe = (w, h) => (h > w * 1.1 ? "vertical" : w > h * 1.1 ? "horizontal" : "cuadrado");
const ORIENT = { horizontal: "Horizontal", vertical: "Vertical", cuadrado: "Cuadrado" };
export function editorVideos(caja, m, listo) {
  const lista = m.videosMarca || [], max = MAX_VIDEOS_MARCA[m.nivel || "stand"] || 2;
  const donde = (v) => v.orient === "vertical" ? "Se ve en los tótems del stand y, en el celular, a pantalla completa vertical." : (m.nivel ? "Se ve en el muro de pantallas del stand." : "Se ve en la pantalla grande del stand.");
  caja.innerHTML = `<h2>🎬 Tus videos <small class="suave">(${lista.length} de ${max})</small></h2>
    <p class="ayuda">MP4 (H.264) de hasta ${VIDEO_MB} MB. <b>Horizontal</b> 1920 × 1080 va en las pantallas; <b>vertical</b> 1080 × 1920 (como Reels o TikTok) va en los tótems. Los videos salen primero en Mi cultivo y en tu stand, y cada reproducción se cuenta.</p>
    <div class="slots">${lista.map((v, i) => `
      <div class="slot" data-v="${i}">
        <div class="slot-vista" style="aspect-ratio:${v.w || 16}/${v.h || 9};${v.orient === "vertical" ? "max-width:150px" : ""}"><video muted playsinline preload="metadata" controls></video></div>
        <div><span class="orient">${ORIENT[v.orient] || "Video"}${v.w ? ` · ${v.w} × ${v.h}` : ""}</span> ${v.dur ? `<small>${Math.round(v.dur)} s</small>` : ""}</div>
        <label style="margin:2px 0 0">Título</label><input data-titulo maxlength="40" value="${esc(v.titulo || "")}" placeholder="Ej. Conoce nuestra nueva línea">
        <label style="margin:2px 0 0">Cómo se ve en pantallas de otra forma</label>
        <div class="segm"><button data-ajuste="contener" class="${v.ajuste !== "llenar" ? "activo" : ""}">Completo (con barras)</button><button data-ajuste="llenar" class="${v.ajuste === "llenar" ? "activo" : ""}">Llenar (recorta orillas)</button></div>
        <small>${donde(v)}</small>
        <div class="fila-b"><button class="btn sec chico" data-quitar>Quitar video</button></div>
      </div>`).join("")}
      ${lista.length < max ? `<button class="slot" data-nuevo style="align-items:center;justify-content:center;min-height:170px;border-style:dashed"><span style="font-size:2rem">＋</span><b>Agregar video</b><small>Horizontal o vertical</small></button>` : ""}
    </div><p class="cargando-ed" id="v-estado"></p>`;
  $$("[data-v]", caja).forEach(async (el) => {
    const i = +el.dataset.v, v = lista[i];
    const u = await urlDe(m.id, v.slot, v.v); if (u) $("video", el).src = u;
    const cambiar = (c) => { const n = lista.slice(); n[i] = { ...v, ...c }; guardarMarca(m.id, { videosMarca: n }); };
    $("[data-titulo]", el).onchange = (e) => { cambiar({ titulo: e.target.value.trim() }); listo("Título guardado ✓"); };
    $$("[data-ajuste]", el).forEach((b) => (b.onclick = () => { cambiar({ ajuste: b.dataset.ajuste }); listo("Listo ✓"); }));
    $("[data-quitar]", el).onclick = async () => {
      await borrarArchivo(m.id, v.slot);
      guardarMarca(m.id, { videosMarca: lista.filter((_, k) => k !== i) }); listo("Video quitado");
    };
  });
  const nuevo = $("[data-nuevo]", caja);
  if (nuevo) nuevo.onclick = async () => {
    const f = await elegirArchivo("video/mp4,video/webm,video/quicktime,video/*"); if (!f) return;
    const st = $("#v-estado", caja);
    if (f.size > VIDEO_MB * 1048576) { st.textContent = `Ese video pesa ${MB(f.size)}; el máximo es ${VIDEO_MB} MB. Compártelo más ligero (por ejemplo, exportado a 1080p).`; return; }
    st.textContent = "Revisando el video…";
    const url = URL.createObjectURL(f), med = await medirVideo(url); URL.revokeObjectURL(url);
    if (!med || !med.w) { st.textContent = "Este navegador no puede leer ese video. Usa MP4 (H.264)."; return; }
    const slot = "v" + version();
    await guardarArchivo(m.id, slot, f);
    const o = orientDe(med.w, med.h);
    const v = { slot, v: version(), titulo: f.name.replace(/\.[^.]+$/, "").slice(0, 40), orient: o, w: med.w, h: med.h, dur: med.dur, ajuste: "contener" };
    guardarMarca(m.id, { videosMarca: [...lista, v] });
    listo(`Video ${ORIENT[o].toLowerCase()} agregado ✓`);
  };
}

// ---------- modelo 3D en lugar del robot ----------
export function editorModelo(caja, m, listo) {
  const mo = (m.medios || {}).modelo;
  caja.innerHTML = `<h2>🧊 Modelo 3D</h2>
    <p class="ayuda">Pon tu mascota, tu producto o tu personaje en lugar del robot anfitrión. Archivo <b>GLB</b> de hasta ${MODELO_MB} MB. Si trae animación, se queda moviéndose.</p>
    ${mo ? `<div class="slot">
        <b>📦 ${esc(mo.nombre || "Tu modelo")}</b>
        <small>${mo.anims && mo.anims.length ? `${mo.anims.length} animación(es) en el archivo` : "Sin animaciones en el archivo"}</small>
        ${mo.anims && mo.anims.length ? `<label style="margin:4px 0 0">Animación</label><select data-anim>${["ninguna", ...mo.anims].map((a) => `<option value="${esc(a)}" ${a === (mo.anim || mo.anims[0]) ? "selected" : ""}>${a === "ninguna" ? "Sin animación (quieto)" : esc(a)}</option>`).join("")}</select>` : ""}
        <label style="margin:4px 0 0">Altura en el stand: <b data-alto-t>${(mo.alto || 2).toFixed(1)} m</b></label><input type="range" data-alto min="0.6" max="4" step="0.1" value="${mo.alto || 2}">
        <label style="margin:4px 0 0">Hacia dónde mira: <b data-giro-t>${mo.giro || 0}°</b></label><input type="range" data-giro min="0" max="355" step="5" value="${mo.giro || 0}">
        <div class="fila-b" style="margin-top:6px"><button class="btn chico" data-cambiar>Cambiar modelo</button><button class="btn sec chico" data-quitar>Quitar (vuelve el robot)</button></div>
      </div>` : `<button class="slot" data-subir style="align-items:center;justify-content:center;min-height:170px;border-style:dashed;width:100%"><span style="font-size:2rem">🧊</span><b>Subir modelo GLB</b><small>Exporta desde Blender, Meshy o Polycam como .glb</small></button>`}
    <p class="cargando-ed" id="m-estado"></p>`;
  const st = $("#m-estado", caja);
  const subir = async () => {
    const f = await elegirArchivo(".glb,model/gltf-binary"); if (!f) return;
    if (!/\.glb$/i.test(f.name)) { st.textContent = "Tiene que ser un archivo .glb."; return; }
    if (f.size > MODELO_MB * 1048576) { st.textContent = `Pesa ${MB(f.size)}; el máximo es ${MODELO_MB} MB.`; return; }
    st.textContent = "Leyendo el modelo…";
    let anims = [];
    try {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const r = await new GLTFLoader().parseAsync(await f.arrayBuffer(), "");
      anims = r.animations.map((a, k) => a.name || `Animación ${k + 1}`);
    } catch (e) { console.error(e); st.textContent = "No se pudo leer ese GLB. Revisa que se abra en https://gltf-viewer.donmccurdy.com"; return; }
    await guardarArchivo(m.id, "modelo", f);
    guardarMarca(m.id, { medios: { ...(m.medios || {}), modelo: { v: version(), nombre: f.name, anims, anim: anims[0] || "ninguna", alto: (mo && mo.alto) || 2, giro: (mo && mo.giro) || 0 } } });
    listo(anims.length ? "Modelo listo, con su animación ✓" : "Modelo listo ✓");
  };
  const b = $("[data-subir]", caja) || $("[data-cambiar]", caja); if (b) b.onclick = subir;
  if (!mo) return;
  const cambiar = (c) => guardarMarca(m.id, { medios: { ...(m.medios || {}), modelo: { ...mo, ...c } } });
  const an = $("[data-anim]", caja); if (an) an.onchange = (e) => { cambiar({ anim: e.target.value }); listo("Animación cambiada ✓"); };
  $("[data-alto]", caja).oninput = (e) => ($("[data-alto-t]", caja).textContent = (+e.target.value).toFixed(1) + " m");
  $("[data-alto]", caja).onchange = (e) => { cambiar({ alto: +e.target.value }); listo("Altura guardada ✓"); };
  $("[data-giro]", caja).oninput = (e) => ($("[data-giro-t]", caja).textContent = e.target.value + "°");
  $("[data-giro]", caja).onchange = (e) => { cambiar({ giro: +e.target.value }); listo("Listo ✓"); };
  $("[data-quitar]", caja).onclick = async () => {
    await borrarArchivo(m.id, "modelo");
    const n = { ...(m.medios || {}) }; delete n.modelo;
    guardarMarca(m.id, { medios: n }); listo("Volvió el robot");
  };
}

// ---------- promociones ----------
const MAX_PROMOS = 6;
export function editorPromos(caja, m, listo) {
  const lista = m.promos || [];
  caja.innerHTML = `<h2>🔥 Promociones <small class="suave">(${lista.length} de ${MAX_PROMOS})</small></h2>
    <p class="ayuda">Salen en la pantalla grande de tu stand (se van turnando) y en la pestaña Inicio de tu stand. Al pasar la fecha se ocultan solas.</p>
    ${lista.map((p, i) => `<div class="promo-ed" data-p="${i}">
      <div class="arriba">
        <button class="pimg" data-pimg title="Imagen cuadrada 1080 × 1080">${p.img ? "" : "＋ Imagen<br>1080 × 1080"}</button>
        <div class="campos">
          <label>Título</label><input data-t maxlength="48" value="${esc(p.titulo)}" placeholder="Ej. 2×1 en accesorios">
          <label>Detalle</label><textarea data-x maxlength="140" placeholder="Corto y claro, sin promesas de salud">${esc(p.texto || "")}</textarea>
          <div class="dos"><div><label>Válida hasta</label><input type="date" data-h value="${esc(p.hasta || "")}"></div>
          <div style="display:flex;align-items:flex-end;gap:6px"><button class="btn chico" data-g>Guardar</button><button class="btn sec chico" data-q>Quitar</button></div></div>
        </div>
      </div></div>`).join("")}
    ${lista.length < MAX_PROMOS ? `<button class="btn chico" data-nueva style="margin-top:12px">＋ Nueva promoción</button>` : ""}
    <p class="nota">Las promociones son responsabilidad de la marca y deben cumplir la ley del país donde vende. Nada de mensajes que inviten a consumir.</p>`;
  $$("[data-p]", caja).forEach(async (el) => {
    const i = +el.dataset.p, p = lista[i];
    const cambiar = (c) => { const n = lista.slice(); n[i] = { ...p, ...c }; guardarMarca(m.id, { promos: n }); };
    if (p.img) { const u = await urlDe(m.id, "promo-" + p.id, p.img); if (u) $("[data-pimg]", el).style.backgroundImage = `url("${u}")`; }
    $("[data-g]", el).onclick = () => { cambiar({ titulo: $("[data-t]", el).value.trim(), texto: $("[data-x]", el).value.trim(), hasta: $("[data-h]", el).value }); listo("Promoción guardada ✓"); };
    $("[data-q]", el).onclick = async () => { if (p.img) await borrarArchivo(m.id, "promo-" + p.id); guardarMarca(m.id, { promos: lista.filter((_, k) => k !== i) }); listo("Promoción quitada"); };
    $("[data-pimg]", el).onclick = async () => {
      const f = await elegirArchivo("image/*"); if (!f) return;
      const blob = await recortar(f, PROMO_IMG, m.color); if (!blob) return;
      await guardarArchivo(m.id, "promo-" + p.id, blob);
      cambiar({ titulo: $("[data-t]", el).value.trim() || p.titulo, texto: $("[data-x]", el).value.trim(), hasta: $("[data-h]", el).value, img: version() });
      listo("Imagen lista ✓");
    };
  });
  const n = $("[data-nueva]", caja);
  if (n) n.onclick = () => { guardarMarca(m.id, { promos: [...lista, { id: version(), titulo: "Nueva promoción", texto: "", hasta: "" }] }); listo("Escribe tu promoción y guarda"); };
}
