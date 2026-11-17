// Vórtice VR's own educational experiences: each one has a short code to type at vorticevr.mx/codigo,
// a QR and a printable poster. Used by /educacion/, /realidad-virtual/ and /codigo/.
// Share button: <button class="ve-share" data-compartir="LSM">Compartir</button> (inside the card's <article>, outside its link).
// New experience = one more entry in LIST (its code: short, capitals, no accents, never reused) and its image in assets/proyectos/.
(function () {
  const S = document.currentScript, base = S ? S.src.replace(/educativas\.js.*$/, "") : "/assets/";
  const SITE = /(^|\.)vorticevr\.mx$/.test(location.hostname) ? location.origin : "https://vorticevr.mx";   // printed QRs always point to the real site
  const STEP = "Escanea el código QR con tu celular";
  const LIST = [
    { code: "ASTRO", name: "Observatorio Orbital", path: "proyectos/observatorio/", img: "observatorio.webp", color: "#3d5bd9",
      label: "3D interactivo", sub: "Un laboratorio espacial en 3D",
      steps: [STEP + " o escribe el código en la computadora", "Recorre el sistema solar, las estaciones y los eclipses", "Lee las fichas y sigue al astronauta que te guía"] },
    { code: "LSM", name: "Deletreo LSM", path: "proyectos/deletreo-lsm/", img: "deletreo-lsm.webp", color: "#8b3fd6",
      label: "Inteligencia artificial", sub: "El alfabeto de la Lengua de Señas Mexicana",
      steps: ["Ábrelo en una computadora con cámara: escribe el código", "Permite la cámara y muestra tu mano", "Forma cada letra: la IA te dice qué ajustar"] },
    { code: "PINATA", name: "Steal a Piñata · Edición Tabasco", path: "proyectos/pinata-tabasco/", img: "pinata-tabasco.webp", color: "#d9466f",
      label: "Juego en 3D", sub: "La cultura de Tabasco en piñatas",
      steps: [STEP + " o escribe el código en la computadora", "Consigue piñatas en el desfile y cuida tu base", "Toca cada piñata para aprender de Tabasco"] },
    { code: "LILA", name: "La cosecha de Tierra Lila", path: "proyectos/selva-tierra-lila/", img: "selva-tierra-lila.webp", color: "#2f9e5b",
      label: "Mundo en 3D", sub: "Las subregiones de Tabasco",
      steps: [STEP + " o escribe el código en la computadora", "Llena tu canasta con cocos, plátanos y piñas", "Contesta las preguntas sobre las subregiones"] },
    { code: "CACAO", name: "Del Cacao al Chocolate", path: "realidad-virtual/cacao/", img: "cacao-chocolate.webp", color: "#9a5a2c",
      label: "Realidad virtual", sub: "Para visores Meta Quest",
      steps: ["En tu visor Meta Quest, abre el navegador", "Entra a vorticevr.mx/codigo y escribe el código", "Activa el seguimiento de manos y vive las 7 fases"] },
  ];
  const norm = c => String(c || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  const find = c => LIST.find(e => e.code === norm(c));
  const urlOf = e => SITE + "/" + e.path;

  // lazy libraries: the QR generator and the poster
  const loaded = {};
  const script = src => loaded[src] || (loaded[src] = new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }));
  const libs = () => Promise.all([window.qrcode ? 0 : script("https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"), window.VVRPoster ? 0 : script(base + "poster.js?v=7")]);
  const image = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

  // QR image (1024 × 1290): QR with the mark, the code and the Vórtice VR logo
  async function drawQR(c, e) {
    const [icon, logo] = await Promise.all([image(base + "icono.png"), image(base + "logo-vorticevr.png")]);
    const qr = qrcode(0, "H"); qr.addData(urlOf(e)); qr.make(); const n = qr.getModuleCount(), W = 1024, M = 80, cell = Math.floor((W - 2 * M) / n), off = Math.floor((W - cell * n) / 2);
    c.width = W; c.height = 1290; const x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, W, c.height); x.fillStyle = "#1b0a36";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect(off + k * cell, off + r * cell, cell, cell);
    if (icon) { const s = cell * n * .2, p = (W - s) / 2; x.fillStyle = "#fff"; x.fillRect(p - 14, p - 14, s + 28, s + 28); x.drawImage(icon, p, p, s, s); }
    x.textAlign = "center"; x.fillStyle = "#6b279b"; x.font = "500 34px 'IBM Plex Sans', sans-serif"; x.fillText("Escanéalo o escribe el código en vorticevr.mx/codigo", W / 2, W + 10);
    x.font = "700 92px Sora, sans-serif"; if ("letterSpacing" in x) x.letterSpacing = "12px";
    const tw = x.measureText(e.code).width + 110; x.fillStyle = "#ffbe55"; x.beginPath(); x.roundRect ? x.roundRect((W - tw) / 2, W + 40, tw, 130, 65) : x.rect((W - tw) / 2, W + 40, tw, 130); x.fill();
    x.fillStyle = "#1a0d00"; x.fillText(e.code, W / 2 + 6, W + 136); if ("letterSpacing" in x) x.letterSpacing = "0px";
    if (logo) { const w = 220, h = w * logo.naturalHeight / logo.naturalWidth; x.drawImage(logo, (W - w) / 2, W + 200, w, h); }
  }
  const poster = (c, e) => VVRPoster.draw(c, { slug: e.code.toLowerCase(), title: e.name, url: urlOf(e), edu: { color: e.color } },   // poster.js reads the color from exp[kind]
    { base, edu: { label: e.label, sub: e.sub, steps: e.steps, pic: base + "proyectos/" + e.img, code: e.code, foot: "Más para aprender en vorticevr.mx/educacion" } });
  const file = e => "vorticevr-" + e.code.toLowerCase();
  function save(canvas, name) { canvas.toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, "image/png"); }

  const CSS = `
.ve-share{position:absolute;top:14px;right:14px;z-index:5;display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(10,4,22,.62);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#fff;font:600 .86rem/1 'IBM Plex Sans',system-ui,sans-serif;cursor:pointer;transition:background .2s,border-color .2s,transform .2s}
.ve-share:hover{background:rgba(139,63,214,.85);border-color:#d2b8ff;transform:translateY(-1px)}
.ve-share svg{width:16px;height:16px}
.ve-share b{font:700 .74rem/1 'IBM Plex Mono',monospace;letter-spacing:.08em;color:#ffbe55}
#veDlg{border:1px solid rgba(210,184,255,.25);border-radius:22px;padding:0;background:#120826;color:#f3ecff;width:min(860px,calc(100vw - 32px));max-height:calc(100dvh - 32px);font-family:'IBM Plex Sans',system-ui,sans-serif;box-shadow:0 30px 90px rgba(0,0,0,.6)}
#veDlg::backdrop{background:rgba(5,2,11,.78);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
#veDlg .ve-in{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:26px;padding:28px}
#veDlg .ve-x{position:absolute;top:12px;right:12px;width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#fff;font-size:22px;line-height:1;cursor:pointer}
#veDlg canvas{display:block;width:100%;height:auto;border-radius:14px;background:#fff}
#veDlg .ve-k{font:500 .72rem/1 'IBM Plex Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:#d2b8ff;margin:0 0 8px}
#veDlg h3{font:700 1.45rem/1.2 Sora,sans-serif;margin:0 40px 14px 0;color:#fff}
#veDlg .ve-code{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 6px}
#veDlg .ve-code strong{font:700 2.3rem/1 Sora,sans-serif;letter-spacing:.14em;color:#1a0d00;background:#ffbe55;border-radius:999px;padding:12px 24px 12px 30px}
#veDlg .ve-hint{color:#c9b8e8;font-size:.95rem;margin:10px 0 18px;line-height:1.5}
#veDlg .ve-hint a{color:#ffbe55}
#veDlg .ve-row{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
#veDlg .ve-b{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:11px 16px;border-radius:12px;border:1px solid rgba(210,184,255,.3);background:rgba(255,255,255,.06);color:#fff;font:600 .9rem/1.1 'IBM Plex Sans',sans-serif;cursor:pointer;text-decoration:none}
#veDlg .ve-b:hover{border-color:#d2b8ff;background:rgba(139,63,214,.35)}
#veDlg .ve-b.sun{background:#ffbe55;border-color:#ffbe55;color:#1a0d00}
#veDlg .ve-b[disabled]{opacity:.5;cursor:wait}
#veDlg .ve-tabs{display:flex;gap:6px;margin:0 0 12px}
#veDlg .ve-tabs button{flex:1;padding:9px;border-radius:10px;border:1px solid rgba(210,184,255,.25);background:transparent;color:#c9b8e8;font:600 .85rem 'IBM Plex Sans',sans-serif;cursor:pointer}
#veDlg .ve-tabs button.on{background:rgba(139,63,214,.45);color:#fff;border-color:#d2b8ff}
#veDlg .ve-pv{position:relative;min-height:200px}
#veDlg .ve-wait{position:absolute;inset:0;display:grid;place-items:center;color:#c9b8e8;font-size:.9rem}
#veDlg .ve-sm{font-size:.82rem;color:#a996cc;margin:12px 0 0}
@media (max-width:700px){#veDlg .ve-in{grid-template-columns:1fr;padding:22px 18px}#veDlg .ve-in>div:last-child{order:-1}#veDlg .ve-pv{max-width:340px;margin:0 auto;width:100%}#veDlg .ve-code strong{font-size:2rem}}`;

  let dlg, cur;
  function build() {
    style(); dlg =document.createElement("dialog"); dlg.id = "veDlg"; dlg.setAttribute("aria-labelledby", "veName");
    dlg.innerHTML = `<button class="ve-x" type="button" aria-label="Cerrar">×</button><div class="ve-in">
      <div><div class="ve-tabs"><button type="button" class="on" data-t="qr">QR</button><button type="button" data-t="poster">Póster</button></div>
        <div class="ve-pv"><canvas id="veQR" aria-label="Código QR"></canvas><canvas id="vePoster" hidden aria-label="Póster para imprimir"></canvas><div class="ve-wait" id="veWait">Preparando…</div></div></div>
      <div><p class="ve-k">Compártela con tu grupo</p><h3 id="veName"></h3>
        <div class="ve-code"><strong id="veCode"></strong><button class="ve-b" type="button" data-a="code">Copiar código</button></div>
        <p class="ve-hint">Tus alumnos entran a <a id="veCodeLink" href="" target="_blank" rel="noopener">vorticevr.mx/codigo</a> y escriben el código. Sirve en la computadora y en el navegador de un visor, donde no se puede escanear.</p>
        <div class="ve-row"><button class="ve-b" type="button" data-a="link">Copiar link</button><button class="ve-b" type="button" data-a="share">Compartir</button><a class="ve-b" id="veOpen" href="" target="_blank" rel="noopener">Abrir ↗</a></div>
        <div class="ve-row"><button class="ve-b" type="button" data-a="qr">Descargar QR</button><button class="ve-b sun" type="button" data-a="pdf">Póster en PDF</button><button class="ve-b" type="button" data-a="png">Póster en imagen</button></div>
        <p class="ve-sm">El póster es tamaño carta, con el QR, el código y los pasos: imprímelo y pégalo en el salón.</p></div></div>`;
    document.body.appendChild(dlg);
    const $ = id => dlg.querySelector("#" + id);
    dlg.querySelector(".ve-x").onclick = () => dlg.close();
    dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
    dlg.querySelectorAll(".ve-tabs button").forEach(b => b.onclick = () => tab(b.dataset.t));
    const copy = async (t, b, label) => { try { await navigator.clipboard.writeText(t); b.textContent = "¡Copiado!"; } catch (er) { prompt("Cópialo:", t); } setTimeout(() => b.textContent = label, 1600); };
    dlg.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-a]"); if (!b || !cur) return; const e = cur, a = b.dataset.a;
      if (a === "code") copy(e.code, b, "Copiar código");
      if (a === "link") copy(urlOf(e), b, "Copiar link");
      if (a === "share") { const text = `${e.name}: ábrela en ${urlOf(e)} o escribe el código ${e.code} en ${SITE}/codigo/`;
        if (navigator.share) navigator.share({ title: e.name, text, url: urlOf(e) }).catch(() => {}); else copy(text, b, "Compartir"); }
      if (a === "qr") { await ready; save($("veQR"), file(e) + "-qr.png"); }
      if (a === "pdf" || a === "png") { b.disabled = true; try { await posterReady(); a === "pdf" ? await VVRPoster.pdf($("vePoster"), file(e) + "-poster.pdf") : await VVRPoster.png($("vePoster"), file(e) + "-poster.png"); } finally { b.disabled = false; } }
    });
  }
  let ready, pReady;
  const tab = t => { dlg.querySelectorAll(".ve-tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
    const q = dlg.querySelector("#veQR"), p = dlg.querySelector("#vePoster"), w = dlg.querySelector("#veWait");
    q.hidden = t !== "qr"; p.hidden = t !== "poster";
    const job = t === "qr" ? ready : posterReady(); w.hidden = false; job.then(() => w.hidden = true, () => w.textContent = "No se pudo preparar. Revisa tu conexión."); };
  const posterReady = () => pReady || (pReady = ready.then(() => poster(dlg.querySelector("#vePoster"), cur)));

  function open(code) {
    const e = find(code); if (!e) return;
    if (!dlg) build(); cur = e; pReady = null;
    dlg.querySelector("#veName").textContent = e.name; dlg.querySelector("#veCode").textContent = e.code;
    dlg.querySelector("#veOpen").href = urlOf(e); dlg.querySelector("#veCodeLink").href = SITE + "/codigo/";
    ready = libs().then(() => drawQR(dlg.querySelector("#veQR"), e));
    tab("qr"); if (!dlg.open) dlg.showModal();
  }

  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>';
  function init() {
    document.querySelectorAll("[data-compartir]").forEach(b => {
      if (b.dataset.veOk) return; b.dataset.veOk = 1; const e = find(b.dataset.compartir); if (!e) return;
      if (b.classList.contains("ve-share")) { b.innerHTML = `${icon}<span>Compartir</span><b>${e.code}</b>`; b.title = `QR, código ${e.code} y póster`; b.setAttribute("aria-label", `Compartir ${e.name}: QR, código ${e.code} y póster`); }
      b.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); open(e.code); });
    });
    if (document.querySelector(".ve-share")) style();
  }
  function style() { if (document.getElementById("veStyle")) return; const st = document.createElement("style"); st.id = "veStyle"; st.textContent = CSS; document.head.appendChild(st); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.VVREdu = { list: LIST, find, norm, url: urlOf, open };
})();
