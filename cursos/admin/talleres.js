// Admin de cursos → Talleres: constancias de participación (_cursos/talleres.js). Crear un taller (concepto, fecha,
// horas; lugar y modalidad opcionales), su link vorticevr.mx/constancia/<CÓDIGO> con QR para proyectar, la lista de
// quienes se registraron (corregir nombres, quitar, agregar a mano) y "Emitir constancias".
(function () {
  const E = VC.esc, $ = id => document.getElementById(id);
  const fecha = d => new Date(d + "T12:00:00Z").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const when = t => new Date(t).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const MOD = { presencial: "Presencial", en_linea: "En línea" };
  const linkOf = code => location.origin + "/constancia/" + code + "/";
  const today = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  let qrLib = null;
  const loadQr = () => qrLib || (qrLib = new Promise((ok, no) => { if (window.qrcode) return ok(); const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); }));
  async function qrSvg(text) {
    await loadQr();
    const q = qrcode(0, "M"); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  }
  const fields = (t = {}) => `
    <label>Concepto del taller<input type="text" name="title" maxlength="140" required value="${E(t.title || "")}" placeholder="Ej. Taller de realidad aumentada para docentes"></label>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px">
      <label>Fecha en que se impartió<input type="date" name="date" required value="${E(t.date || "")}"></label>
      <label>Último día (si duró varios días)<input type="date" name="date_end" value="${E(t.date_end || "")}"></label>
      <label>Horas<input type="number" name="hours" min="0.5" max="200" step="0.5" required value="${E(t.hours || 3)}"></label>
      <label>Modalidad<select name="modality"><option value="presencial"${t.modality !== "en_linea" ? " selected" : ""}>Presencial</option><option value="en_linea"${t.modality === "en_linea" ? " selected" : ""}>En línea</option></select></label>
    </div>
    <label>Lugar o escuela (opcional, sale en la constancia)<input type="text" name="place" maxlength="120" value="${E(t.place || "")}" placeholder="Ej. Escuela Secundaria Técnica 5, Villahermosa"></label>`;
  const formData = f => ({ title: f.title.value, date: f.date.value, date_end: f.date_end.value, hours: Number(f.hours.value), modality: f.modality.value, place: f.place.value });

  async function list() {
    const r = await VC.call("admin/talleres");
    $("view").innerHTML = `<div class="panel" style="margin-bottom:16px"><h2 style="margin-top:0">Nuevo taller</h2>
      <p class="mute" style="margin-top:-4px">Te da un link y un QR para proyectar. Cada participante entra con su cuenta y escribe su nombre; tú revisas la lista y emites las constancias.</p>
      <form class="set" id="tnew">${fields()}<div><button class="btn sun" type="submit">Crear taller</button></div></form></div>
      <div class="panel tw">${r.list.length ? `<table><thead><tr><th>Fecha</th><th>Taller</th><th>Código</th><th>En la lista</th><th>Emitidas</th><th>Registro</th></tr></thead><tbody>
        ${r.list.map(t => `<tr data-id="${E(t.id)}" style="cursor:pointer"><td>${E(t.period)}</td><td><a href="#taller=${E(t.id)}">${E(t.title)}</a><div class="mute">${VC.hours(t.hours)}${t.place ? " · " + E(t.place) : ""}</div></td>
          <td class="mono" style="color:var(--ink)">${E(t.code)}</td><td>${t.n}</td><td>${t.issued}</td><td>${t.open ? `<span style="color:var(--ok)">Abierto</span>` : Date.now() < t.opens_at ? "Se abre el día" : "Cerrado"}</td></tr>`).join("")}</tbody></table>`
        : `<div class="empty">Todavía no hay talleres.</div>`}</div>`;
    $("tnew").onsubmit = async e => {
      e.preventDefault();
      try { const x = await VC.call("admin/talleres", { json: formData(e.target) }); VC.toast("Taller creado."); location.hash = "taller=" + x.id; }
      catch (err) { VC.toast(err.message); }
    };
    document.querySelectorAll("tr[data-id]").forEach(tr => tr.onclick = e => { if (!e.target.closest("a")) location.hash = "taller=" + tr.dataset.id; });
  }

  async function detail(id) {
    const r = await VC.call("admin/talleres/" + id), t = r.taller, ppl = r.people, link = linkOf(t.code);
    const inList = ppl.filter(p => p.status === "in"), pending = inList.filter(p => !p.folio), issued = ppl.filter(p => p.folio);
    const reg = t.open ? `<span style="color:var(--ok)">Abierto</span> hasta el ${E(when(t.closes_at - 60e3))}` : Date.now() < t.opens_at ? `Se abre el ${E(when(t.opens_at))}` : "Cerrado";
    $("view").innerHTML = `<p><a href="#talleres">← Todos los talleres</a></p>
      <div class="panel" style="margin-bottom:16px;display:grid;gap:18px;grid-template-columns:minmax(0,1fr) auto;align-items:start">
        <div><div class="kick">Taller · ${E(MOD[t.modality] || "")}</div><h2 style="margin:4px 0 6px">${E(t.title)}</h2>
          <div class="mute">${E(t.period)} · ${VC.hours(t.hours)}${t.place ? " · " + E(t.place) : ""}</div>
          <div style="margin:16px 0 6px">Link para los participantes:</div>
          <div style="color:var(--ink);font:500 1.05rem 'IBM Plex Mono',monospace;overflow-wrap:anywhere">${E(link.replace(/^https?:\/\//, ""))}</div>
          <div class="mute" style="margin-top:4px">Código: <b class="mono" style="color:var(--sun);letter-spacing:.15em">${E(t.code)}</b> (también se escribe en ${E(location.host)}/constancia)</div>
          <div class="acts"><button class="btn sun" id="proj">Proyectar QR</button><button class="btn" id="copy">Copiar link</button></div>
          <div style="margin-top:16px">Registro: ${reg}</div>
          <div class="acts">${t.open ? `<button class="btn" id="close">Cerrar registro ya</button>` : ""}<button class="btn" id="open">${t.open ? "Dar 24 horas más" : "Abrir 24 horas"}</button></div></div>
        <div id="qr" style="width:170px;background:#fff;border-radius:14px;padding:8px"></div>
      </div>
      <div class="panel" style="margin-bottom:16px"><div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
          <h2 style="margin:0">Participantes <span class="mute" style="font-weight:400">· ${inList.length} en la lista · ${issued.length} emitidas</span></h2>
          <div class="acts" style="margin:0;align-items:center"><label class="mute" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="mail" checked> Mandarlas por correo</label>
            <button class="btn sun" id="emit"${pending.length ? "" : " disabled"}>Emitir constancias${pending.length ? ` (${pending.length})` : ""}</button></div></div>
        <p class="mute" style="font-size:.88rem">Revisa los nombres antes de emitir: una vez emitida, la constancia ya no cambia (si una sale con error, revócala en Constancias, corrige aquí el nombre y vuelve a emitir). Los correos salen poco a poco (Resend gratis manda 100 al día, contando los códigos de registro).</p>
        <div class="tw">${ppl.length ? `<table><thead><tr><th>#</th><th>Nombre en la constancia</th><th>Cuenta</th><th>Constancia</th><th></th></tr></thead><tbody>
          ${ppl.map((p, i) => `<tr style="${p.status === "out" ? "opacity:.5" : ""}"><td>${i + 1}</td>
            <td>${(p.folio && !p.revoked) || p.status === "out" ? E(p.name) : `<input type="text" data-nm="${E(p.id)}" value="${E(p.name)}" maxlength="90" style="width:100%;min-width:200px">`}</td>
            <td class="mute">${E(p.email || "—")}${p.user_id ? "" : " <span class='tag'>a mano</span>"}</td>
            <td>${p.folio ? `<a class="mono" href="/cursos/verificar/${E(p.verify_token)}/" target="_blank">${E(p.folio)}</a>${p.revoked ? ` <span style="color:var(--bad)">revocada</span><div class="mute" style="font-size:.8rem">Corrige el nombre y vuelve a emitir</div>` : ""}<div class="mute" style="font-size:.8rem">${p.mail_state === "sent" ? "Correo enviado" : p.mail_state === "pending" || p.mail_state === "sending" ? "Correo en camino" : p.email ? "Sin correo" : ""}</div>` : p.status === "out" ? "Quitado" : "Por emitir"}</td>
            <td>${p.folio ? "" : `<a href="#" data-out="${E(p.id)}" data-v="${p.status === "out" ? "0" : "1"}" style="color:${p.status === "out" ? "var(--ok)" : "var(--bad)"}">${p.status === "out" ? "Regresar" : "Quitar"}</a>`}</td></tr>`).join("")}</tbody></table>`
          : `<div class="empty">Todavía no se registra nadie. Proyecta el QR al final del taller.</div>`}</div>
        <form id="add" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;align-items:center"><span class="mute">Agregar a mano:</span>
          <input type="text" name="name" maxlength="90" placeholder="Nombre completo" required style="flex:2;min-width:200px"><input type="text" name="email" maxlength="120" placeholder="Correo (opcional)" style="flex:1;min-width:180px"><button class="btn" type="submit">Agregar</button></form>
      </div>
      <div class="panel" style="margin-bottom:16px" id="dz"></div>
      <details class="panel"><summary style="cursor:pointer;font-weight:600">Editar datos del taller</summary>
        <p class="mute" style="font-size:.88rem">Las constancias ya emitidas no cambian.</p>
        <form class="set" id="edit">${fields(t)}<div class="acts"><button class="btn sun" type="submit">Guardar</button>${issued.length ? "" : `<button class="btn no" type="button" id="del">Borrar taller</button>`}</div></form></details>`;
    qrSvg(link).then(svg => { $("qr").innerHTML = svg; }).catch(() => { $("qr").textContent = "No se pudo dibujar el QR."; });
    designPanel(t);
    const redo = () => detail(id).catch(e => VC.toast(e.message));
    const act = async (fn, ok) => { try { await fn(); if (ok) VC.toast(ok); redo(); } catch (e) { VC.toast(e.message, 5000); } };
    $("copy").onclick = () => navigator.clipboard.writeText(link).then(() => VC.toast("Link copiado."));
    $("proj").onclick = () => project(t, link);
    if ($("close")) $("close").onclick = () => act(() => VC.call("admin/talleres/" + id, { json: { registro: "cerrar" } }), "Registro cerrado.");
    $("open").onclick = () => act(() => VC.call("admin/talleres/" + id, { json: { registro: "abrir" } }), "Registro abierto 24 horas.");
    document.querySelectorAll("[data-nm]").forEach(inp => inp.onchange = () => act(() => VC.call("admin/talleres/persona/" + inp.dataset.nm, { json: { name: inp.value } }), "Nombre guardado."));
    document.querySelectorAll("[data-out]").forEach(a => a.onclick = ev => { ev.preventDefault(); act(() => VC.call("admin/talleres/persona/" + a.dataset.out, { json: { out: a.dataset.v === "1" } })); });
    $("add").onsubmit = e => { e.preventDefault(); const f = e.target; act(() => VC.call(`admin/talleres/${id}/personas`, { json: { name: f.name.value, email: f.email.value } }), "Agregado a la lista."); };
    $("emit").onclick = () => {
      if (!confirm(`¿Emitir ${pending.length} constancia${pending.length === 1 ? "" : "s"}? Revisa los nombres: después ya no cambian.`)) return;
      act(async () => { const x = await VC.call(`admin/talleres/${id}/emitir`, { json: { mail: $("mail").checked } }); VC.toast(`Listo: ${x.issued} emitida${x.issued === 1 ? "" : "s"}${x.mails ? `; ${x.mails} correo${x.mails === 1 ? "" : "s"} en camino` : ""}.`, 5000); });
    };
    $("edit").onsubmit = e => { e.preventDefault(); act(() => VC.call("admin/talleres/" + id, { json: formData(e.target) }), "Guardado."); };
    if ($("del")) $("del").onclick = async () => {
      if (!confirm("¿Borrar este taller y su lista? No se puede deshacer.")) return;
      try { await VC.call("admin/talleres/" + id, { method: "DELETE" }); VC.toast("Taller borrado."); location.hash = "talleres"; } catch (e) { VC.toast(e.message); }
    };
  }

  // ---------- the certificate's design: logos and signatures ----------
  // An image becomes what the PDF wants right here: cropped to its ink, at most 700 px, RGB and alpha apart,
  // compressed with zlib (CompressionStream "deflate") and in base64; plus a PNG to show it.
  const b64 = async bytes => {
    const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
    const z = new Uint8Array(await new Response(cs).arrayBuffer());
    let s = ""; for (let i = 0; i < z.length; i += 0x8000) s += String.fromCharCode.apply(null, z.subarray(i, i + 0x8000));
    return btoa(s);
  };
  async function prepImage(file, paper) {
    const bmp = await createImageBitmap(file).catch(async () => {   // SVG: through an <img>
      const im = new Image(); im.src = URL.createObjectURL(file); await im.decode();
      if (!im.naturalWidth) throw 0; im.width = Math.max(im.naturalWidth, 800); im.height = Math.round(im.width * im.naturalHeight / im.naturalWidth); return im;
    }).catch(() => null);
    if (!bmp) throw new Error("No se pudo abrir la imagen. Usa PNG o JPG.");
    let w = bmp.width, h = bmp.height; const k = Math.min(1, 1400 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const cx = cv.getContext("2d"); cx.drawImage(bmp, 0, 0, w, h);
    const px = cx.getImageData(0, 0, w, h).data;
    if (paper) for (let i = 0; i < px.length; i += 4) {   // a signature on white paper: the paper turns transparent, the ink stays
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2], ink = Math.max(0, Math.min(1, (235 - lum) / 120));
      px[i + 3] = Math.round(px[i + 3] * ink);
    }
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) throw new Error("La imagen está vacía (o toda blanca).");
    let cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const s = Math.min(1, 700 / Math.max(cw, ch)), ow = Math.max(1, Math.round(cw * s)), oh = Math.max(1, Math.round(ch * s));
    const src = document.createElement("canvas"); src.width = cw; src.height = ch;
    const id = new ImageData(cw, ch); for (let y = 0; y < ch; y++) id.data.set(px.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + cw) * 4), y * cw * 4);
    src.getContext("2d").putImageData(id, 0, 0);
    const out = document.createElement("canvas"); out.width = ow; out.height = oh;
    const oc = out.getContext("2d"); oc.imageSmoothingQuality = "high"; oc.drawImage(src, 0, 0, ow, oh);
    const d = oc.getImageData(0, 0, ow, oh).data, rgb = new Uint8Array(ow * oh * 3), alpha = new Uint8Array(ow * oh);
    let opaque = true;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const a = d[i + 3]; alpha[j] = a; if (a < 250) opaque = false;
      // canvas pixels are premultiplied-then-unpremultiplied: transparent ones go white so the edges never darken
      rgb[j * 3] = a ? d[i] : 255; rgb[j * 3 + 1] = a ? d[i + 1] : 255; rgb[j * 3 + 2] = a ? d[i + 2] : 255;
    }
    const png = await new Promise(r => out.toBlob(r, "image/png"));
    return { data: { w: ow, h: oh, rgb: await b64(rgb), ...(opaque ? {} : { alpha: await b64(alpha) }) }, png };
  }
  const imgUrls = {};
  async function adminImg(tid, k) {   // the images need the admin's session: fetched and shown as blobs
    if (imgUrls[k]) return imgUrls[k];
    const r = await fetch(`/api/cursos/admin/talleres/${tid}/img/${k}.png`, { headers: { Authorization: "Bearer " + VC.session().token } });
    return (imgUrls[k] = r.ok ? URL.createObjectURL(await r.blob()) : "");
  }
  function designPanel(t) {
    const d = JSON.parse(JSON.stringify(t.design || { vvr: true, cesar: true, logos: [], signers: [] }));
    const box = $("dz");
    const save = async (ok) => {
      try { const r = await VC.call("admin/talleres/" + t.id, { json: { design: d } }); Object.assign(d, r.design); t.design = r.design; if (ok) VC.toast(ok); }
      catch (e) { VC.toast(e.message, 5000); }
      render();
    };
    const upload = async (file, paper) => {
      const { data, png } = await prepImage(file, paper);
      const fd = new FormData(); fd.append("data", JSON.stringify(data)); fd.append("png", png, "img.png");
      const r = await fetch(`/api/cursos/admin/talleres/${t.id}/archivo`, { method: "POST", headers: { Authorization: "Bearer " + VC.session().token }, body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "No se pudo subir.");
      return j.k;
    };
    const thumb = k => `<span class="dzimg" data-img="${E(k)}"></span>`;
    function render() {
      box.innerHTML = `<style>
        .dz h2{margin:0 0 4px}.dzrow{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}
        .dzc{display:flex;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--line2);border-radius:14px;background:rgba(5,2,11,.35);min-width:240px}
        .dzimg{display:grid;place-items:center;width:96px;height:52px;border-radius:8px;background:#fcfbf8;overflow:hidden;flex:none}.dzimg img{max-width:90%;max-height:46px}
        .dzc b{display:block}.dzc .mute{display:block;font-size:.85rem}.dzc a{display:inline-block;margin-top:2px;color:var(--bad);font-size:.85rem}
        .dzf{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px}.dzf input[type=text]{flex:1;min-width:180px}
        .dz label.ck{display:flex;gap:8px;align-items:center;cursor:pointer}
      </style><div class="dz">
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between"><h2>Diseño de la constancia</h2><button class="btn sun" type="button" id="dzSample">Ver constancia de muestra (PDF)</button></div>
        <p class="mute" style="font-size:.88rem;margin-top:4px">Aplica a las constancias que emitas desde ahora; las ya emitidas se quedan como salieron.</p>
        <h3 style="margin:18px 0 0">Logos</h3>
        <div class="dzrow"><label class="dzc ck"><input type="checkbox" id="dzVvr"${d.vvr !== false ? " checked" : ""}><span class="dzimg"><img src="/assets/logo-vorticevr.png" alt=""></span><span><b>Vórtice VR</b><span class="mute">Arriba a la izquierda</span></span></label>
          ${d.logos.map((l, i) => `<div class="dzc">${thumb(l.k)}<span><b>Logo ${i + 2}</b><a href="#" data-dl="${i}">Quitar</a></span></div>`).join("")}</div>
        ${d.logos.length < 3 ? `<div class="dzf"><label class="btn" style="cursor:pointer">+ Agregar logo<input type="file" id="dzLogo" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label>
          <label class="ck mute" style="font-size:.88rem"><input type="checkbox" id="dzLogoBg"> Quitar fondo blanco</label><span class="mute" style="font-size:.85rem">PNG con fondo transparente se ve mejor.</span></div>` : ""}
        <h3 style="margin:22px 0 0">Firmas</h3>
        <div class="dzrow"><label class="dzc ck"><input type="checkbox" id="dzCesar"${d.cesar !== false ? " checked" : ""}><span class="dzimg"><b style="font:italic 600 .8rem var(--fb);color:#2836a0">Firma</b></span><span><b>Mtro. César Adrián García Martínez</b><span class="mute">Vórtice VR</span></span></label>
          ${d.signers.map((g, i) => `<div class="dzc">${g.k ? thumb(g.k) : `<span class="dzimg mute" style="font-size:.75rem">Sin firma</span>`}<span><b>${E(g.name)}</b><span class="mute">${E(g.title || "")}</span><a href="#" data-ds="${i}">Quitar</a></span></div>`).join("")}</div>
        ${d.signers.length < 3 ? `<form class="dzf" id="dzSig"><input type="text" name="name" maxlength="80" placeholder="Nombre de quien firma (ej. Dra. Laura Méndez Ruiz)" required>
            <input type="text" name="title" maxlength="80" placeholder="Cargo (ej. Directora de la Escuela Secundaria Técnica 5)">
            <label class="btn" style="cursor:pointer"><span id="dzSigFile">Elegir firma (PNG)</span><input type="file" name="file" accept="image/png,image/jpeg,image/webp" hidden></label>
            <label class="ck mute" style="font-size:.88rem"><input type="checkbox" name="paper" checked> Quitar fondo blanco</label>
            <button class="btn sun" type="submit">Agregar firma</button></form>
          <p class="mute" style="font-size:.85rem;margin:6px 0 0">Hasta 4 firmas en total. Firma en papel blanco con pluma oscura y tómale foto, o usa un PNG con fondo transparente.</p>` : ""}
      </div>`;
      box.querySelectorAll("[data-img]").forEach(async s => { const u = await adminImg(t.id, s.dataset.img); if (u) s.innerHTML = `<img src="${u}" alt="">`; });
      $("dzVvr").onchange = e => { d.vvr = e.target.checked; save(e.target.checked ? "Con el logo de Vórtice VR." : "Sin el logo de Vórtice VR."); };
      $("dzCesar").onchange = e => { d.cesar = e.target.checked; save(e.target.checked ? "Con tu firma." : "Sin tu firma."); };
      box.querySelectorAll("[data-dl]").forEach(a => a.onclick = ev => { ev.preventDefault(); d.logos.splice(+a.dataset.dl, 1); save("Logo quitado."); });
      box.querySelectorAll("[data-ds]").forEach(a => a.onclick = ev => { ev.preventDefault(); d.signers.splice(+a.dataset.ds, 1); save("Firma quitada."); });
      if ($("dzLogo")) $("dzLogo").onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try { VC.toast("Subiendo logo…"); d.logos.push({ k: await upload(f, $("dzLogoBg").checked) }); save("Logo agregado."); } catch (err) { VC.toast(err.message, 5000); }
      };
      const sf = $("dzSig");
      if (sf) {
        sf.file.onchange = () => { $("dzSigFile").textContent = sf.file.files[0] ? "✓ " + sf.file.files[0].name.slice(0, 24) : "Elegir firma (PNG)"; };
        sf.onsubmit = async e => {
          e.preventDefault();
          const f = sf.file.files[0];
          if (!f && !confirm("¿Agregar sin imagen de firma? Saldrá solo la línea con el nombre.")) return;
          const b = sf.querySelector("[type=submit]"); b.disabled = true;
          // (form.name and form.title are the form's own attributes: the inputs go through .elements)
          try { const k = f ? await upload(f, sf.paper.checked) : null; d.signers.push({ name: sf.elements.name.value.trim(), title: sf.elements.title.value.trim(), ...(k ? { k } : {}) }); await save("Firma agregada."); }
          catch (err) { VC.toast(err.message, 5000); b.disabled = false; }
        };
      }
      $("dzSample").onclick = async () => {
        const w = window.open("", "_blank");
        try {
          const r = await fetch(`/api/cursos/admin/talleres/${t.id}/muestra.pdf`, { headers: { Authorization: "Bearer " + VC.session().token } });
          if (!r.ok) throw new Error("No se pudo hacer la muestra.");
          const u = URL.createObjectURL(new Blob([await r.arrayBuffer()], { type: "application/pdf" }));
          if (w) w.location = u; else location.href = u;
        } catch (err) { if (w) w.close(); VC.toast(err.message); }
      };
    }
    render();
  }

  // big QR on the screen of the room (Esc or a tap closes it)
  async function project(t, link) {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;inset:0;z-index:100;background:#05020b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.5vh;padding:24px;text-align:center;cursor:pointer";
    d.innerHTML = `<div style="font:600 clamp(1rem,2.6vw,1.6rem) var(--fd);color:var(--sun);letter-spacing:.12em;text-transform:uppercase">Pide tu constancia</div>
      <div style="font:700 clamp(1.4rem,4vw,2.8rem) var(--fd);max-width:90vw">${E(t.title)}</div>
      <div id="pqr" style="background:#fff;border-radius:18px;padding:1.5vh;width:min(58vh,80vw)"></div>
      <div style="font:500 clamp(1rem,2.6vw,1.7rem) var(--fm,monospace)">${E(link.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</div>
      <div class="mute" style="font-size:clamp(.9rem,1.8vw,1.2rem)">Escanéalo, entra con tu cuenta y escribe tu nombre completo · Código <b style="color:var(--sun);letter-spacing:.15em">${E(t.code)}</b></div>`;
    document.body.appendChild(d);
    d.querySelector("#pqr").innerHTML = await qrSvg(link);
    const close = () => { d.remove(); document.removeEventListener("keydown", key); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
    const key = e => { if (e.key === "Escape") close(); };
    d.onclick = close; document.addEventListener("keydown", key);
    if (d.requestFullscreen) d.requestFullscreen().catch(() => {});
  }

  window.VVRTalleres = { show: hash => { const m = /taller=([0-9a-f-]{36})/.exec(hash || ""); return m ? detail(m[1]) : list(); } };
})();
