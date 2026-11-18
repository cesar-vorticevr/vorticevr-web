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
      <details class="panel"><summary style="cursor:pointer;font-weight:600">Editar datos del taller</summary>
        <p class="mute" style="font-size:.88rem">Las constancias ya emitidas no cambian.</p>
        <form class="set" id="edit">${fields(t)}<div class="acts"><button class="btn sun" type="submit">Guardar</button>${issued.length ? "" : `<button class="btn no" type="button" id="del">Borrar taller</button>`}</div></form></details>`;
    qrSvg(link).then(svg => { $("qr").innerHTML = svg; }).catch(() => { $("qr").textContent = "No se pudo dibujar el QR."; });
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
