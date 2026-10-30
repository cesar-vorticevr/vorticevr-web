// Cards of public experiences, shared by the home page (#explora), /explora/ and the portals (/@nombre).
// VVRExplora.render(el, list, { by }) draws them; each card opens the experience, downloads its poster (assets/poster.js) and
// can be reported. "superficie" cards swap the editor's shot for a clean 3D render (assets/poster-3d.js, needs the three import map).
// Needs qrcode-generator and assets/poster.js on the page for the poster.
(function () {
  const base = (document.currentScript && document.currentScript.src || "").replace(/explora\.js.*$/, "");
  const KINDS = {
    ra: ["🪄", "Realidad aumentada"], superficie: ["🛋️", "En tu espacio"], filtro: ["🕶️", "Filtro"], dispara: ["🎯", "Dispara y gana"],
    colorear: ["🎨", "Colorear"], trivia: ["🤔", "Trivia"], ruleta: ["🎡", "Ruleta"], memorama: ["🃏", "Memorama"], sopa: ["🔤", "Sopa de letras"],
    rompecabezas: ["🧩", "Rompecabezas"], galeria: ["🖼️", "Galería 3D"], menu: ["🍽️", "Menú"], links: ["🔗", "Links"],
  };
  const REASONS = [["inapropiado", "Contenido inapropiado"], ["spam", "Spam o engaño"], ["derechos", "Usa algo que no es suyo"], ["otro", "Otra cosa"]];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const api = p => fetch(p).then(r => r.ok ? r.json() : Promise.reject(r));

  document.head.appendChild(Object.assign(document.createElement("style"), { textContent: `
.xgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:22px}
.xc{position:relative;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;background:#120826;border:1px solid rgba(210,184,255,.16);box-shadow:0 24px 50px -24px rgba(0,0,0,.9);transition:transform .3s ease,border-color .3s}
.xc:hover{transform:translateY(-4px);border-color:rgba(210,184,255,.45)}
.xc .th{position:relative;display:block;aspect-ratio:3/4;overflow:hidden;background:radial-gradient(circle at 50% 35%,#5a1f8f,#1b0a36 70%)}
.xc .th img,.xc .th canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.xc .th.white{background:#fff}.xc .th.white img{object-fit:contain;padding:10px}
.xc .th.stage img,.xc .th.stage canvas{object-fit:contain;padding:12% 10% 18%}
.xc .th.stage::after{content:"";position:absolute;left:18%;right:18%;bottom:11%;height:9%;border-radius:50%;background:radial-gradient(ellipse,#ffe2a3,#ffbe55 55%,transparent 72%);opacity:.75;z-index:-0}
.xc .th.stage canvas{z-index:1}
.xc .th::before{content:"";position:absolute;inset:auto 0 0 0;height:46%;background:linear-gradient(180deg,transparent,rgba(5,2,11,.92));z-index:2;pointer-events:none}
.xc .kd{position:absolute;left:10px;top:10px;z-index:3;font:600 .72rem "IBM Plex Sans",sans-serif;padding:4px 10px;border-radius:999px;background:rgba(5,2,11,.78);color:#fff;border:1px solid rgba(255,255,255,.2)}
.xc .pic{position:relative}
.xc .tt{pointer-events:none;position:absolute;left:14px;right:14px;bottom:12px;z-index:3;color:#fff}
.xc .tt h3{margin:0;font:700 1.05rem/1.2 Sora,sans-serif;overflow-wrap:anywhere;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.xc .tt a{color:#d2b8ff;font-size:.82rem;text-decoration:none;position:relative;z-index:4}.xc .tt a:hover{text-decoration:underline}
.xc .ac{display:flex;gap:6px;padding:10px}
.xc .ac>*{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;font:600 .72rem Sora,sans-serif;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;border-radius:999px;padding:9px 8px;border:1px solid rgba(210,184,255,.38);background:rgba(20,9,40,.6);color:#f4eeff;cursor:pointer}
.xc .ac .go{background:linear-gradient(135deg,#ffe0a0,#ffbe55);color:#1b0f00;border-color:#ffbe55}
.xc .ac .more{flex:0 0 38px;padding:9px 0;letter-spacing:0}
.xc .ac>*:disabled{opacity:.6;cursor:wait}
.xdlg{border:1px solid rgba(210,184,255,.45);border-radius:18px;background:#0d0620;color:#f4eeff;padding:22px;width:min(92vw,400px);font-family:"IBM Plex Sans",sans-serif}
.xdlg::backdrop{background:rgba(5,2,11,.75)}
.xdlg h2{margin:0 0 6px;font:700 1.15rem Sora,sans-serif}.xdlg p{margin:0 0 12px;color:#b3a4d2;font-size:.92rem}
.xdlg label{display:flex;gap:10px;align-items:center;padding:8px 0;cursor:pointer}
.xdlg textarea{width:100%;font:inherit;color:#f4eeff;background:rgba(5,2,11,.7);border:1px solid rgba(210,184,255,.38);border-radius:10px;padding:10px;margin-top:6px;min-height:70px}
.xdlg .row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
.xdlg button{font:600 .78rem Sora,sans-serif;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:11px 18px;border:1px solid rgba(210,184,255,.38);background:rgba(20,9,40,.6);color:#f4eeff;cursor:pointer}
.xdlg button.go{background:linear-gradient(135deg,#ffe0a0,#ffbe55);color:#1b0f00;border-color:#ffbe55}
.xdlg .msg{min-height:1.2em;font-size:.88rem;color:#74e8ba;margin:8px 0 0}
` }));

  function card(x, o) {
    const el = document.createElement("article"), K = KINDS[x.kind] || KINDS.ra;
    const img = x.image || base + "trivia.svg", white = x.kind === "colorear" || (x.kind === "trivia" && !x.image);
    el.className = "xc";
    el.innerHTML = `<div class="pic"><a class="th${white ? " white" : ""}${x.kind === "superficie" ? " stage" : ""}" href="${esc(x.url)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(img)}" alt=""><span class="kd">${K[0]} ${esc(K[1])}</span></a>
      <div class="tt"><h3>${esc(x.title)}</h3>${o.by !== false && x.by ? `<a href="/@${esc(x.by.handle)}" style="pointer-events:auto">por @${esc(x.by.handle)}</a>` : ""}</div></div>
      <div class="ac"><a class="go" href="${esc(x.url)}" target="_blank" rel="noopener">Abrir</a><button type="button" data-a="poster">Póster</button><button type="button" class="more" data-a="report" aria-label="Reportar ${esc(x.title)}" title="Reportar">⚑</button></div>`;
    el.querySelector("[data-a=poster]").onclick = e => poster(x, e.currentTarget);
    el.querySelector("[data-a=report]").onclick = () => report(x);
    if (x.kind === "superficie") stage3d.push([x, el.querySelector(".th")]);
    return el;
  }
  function render(el, list, o = {}) {
    const grid = el.classList.contains("xgrid") ? el : (el.querySelector(".xgrid") || el.appendChild(Object.assign(document.createElement("div"), { className: "xgrid" })));
    if (!o.append) grid.replaceChildren();
    for (const x of list) grid.appendChild(card(x, o));
    run3d();
  }

  // "superficie": its 3D objects drawn clean, one card at a time (each one loads its models)
  const stage3d = []; let busy3d = false, P3 = null;
  async function run3d() {
    if (busy3d || !stage3d.length) return; busy3d = true;
    try {
      P3 = P3 || import(base + "poster-3d.js?v=4");
      const m = await P3;
      while (stage3d.length) {
        const [x, th] = stage3d.shift();
        try { const exp = await api(`/api/exp/${x.slug}?sin_vista=1`); const cv = await m.render(exp, location.origin, 900); if (cv) { th.querySelector("img").replaceWith(cv); } } catch (e) {}
      }
    } catch (e) { stage3d.length = 0; }   // no three.js on this page: the shot stays
    busy3d = false;
  }

  // poster (letter PDF) of any public experience, the same one its maker downloads in Mi cuenta
  async function poster(x, btn) {
    if (!window.VVRPoster) return;
    const t = btn.textContent; btn.disabled = true; btn.textContent = "Preparando…";
    try {
      const exp = await api(`/api/exp/${x.slug}?sin_vista=1`); exp.url = x.url; exp.updated = exp.updated || x.updated;
      const cv = document.createElement("canvas");
      await VVRPoster.draw(cv, exp, { api: location.origin, base, plan: { brand: true } });   // the API already drops the brand's logo if its plan has no brand
      await VVRPoster.pdf(cv, `poster-${x.slug}.pdf`);
    } catch (e) { alert("No se pudo preparar el póster. Intenta de nuevo."); }
    btn.disabled = false; btn.textContent = t;
  }

  let dlg;
  function report(x) {
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.className = "xdlg";
      dlg.innerHTML = `<form method="dialog"><h2>Reportar experiencia</h2><p class="who"></p>${REASONS.map(([k, t], i) => `<label><input type="radio" name="r" value="${k}"${i ? "" : " checked"}> ${t}</label>`).join("")}
        <textarea name="note" maxlength="500" placeholder="¿Algo más que debamos saber? (opcional)"></textarea><p class="msg" role="status"></p>
        <div class="row"><button type="button" data-a="x">Cancelar</button><button type="submit" class="go">Enviar reporte</button></div></form>`;
      document.body.appendChild(dlg);
      dlg.querySelector("[data-a=x]").onclick = () => dlg.close();
    }
    const f = dlg.querySelector("form"), msg = dlg.querySelector(".msg"), send = f.querySelector(".go");
    dlg.querySelector(".who").textContent = `“${x.title}”. Lo revisamos y, si no cumple las reglas, la quitamos.`;
    f.reset(); msg.textContent = ""; send.hidden = false;
    f.onsubmit = async e => {
      e.preventDefault(); send.disabled = true;
      try {
        const r = await fetch(`/api/report/${x.slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: f.r.value, note: f.note.value }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "No se pudo enviar.");
        msg.style.color = "#74e8ba"; msg.textContent = "Gracias. Ya nos llegó tu reporte."; send.hidden = true;
      } catch (err) { msg.style.color = "#ff8a9e"; msg.textContent = err.message; }
      send.disabled = false;
    };
    dlg.showModal();
  }

  window.VVRExplora = { KINDS, render, load: (q = "") => api("/api/explora" + q) };
})();
