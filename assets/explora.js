// Public experiences as posters, shared by the home page (#explora), /explora/ and the portals (/@nombre).
// VVRExplora.render(el, list, { by, append }) draws one card per experience: its own poster (assets/poster.js) in small,
// drawn when the card comes into view, one at a time. Tapping a card opens the poster big, and from there: open the
// experience, download the PDF or the image, share it or report it. Needs qrcode-generator and assets/poster.js on the page,
// and the three import map (with three/addons/) for the 3D of "superficie" (assets/poster-3d.js).
// Class names start with xv- so the pages' own styles (.btn, .ac, dialog…) do not reach them.
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
  const TW = 600, TH = Math.round(600 * 11 / 8.5);   // thumbnail of the letter poster

  document.head.appendChild(Object.assign(document.createElement("style"), { textContent: `
.xv-kinds{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:0 0 28px}
@media (max-width:560px){.xv-kinds{flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;scrollbar-width:none;margin-left:-20px;margin-right:-20px;padding:0 20px 4px}.xv-kinds::-webkit-scrollbar{display:none}.xv-kinds button{flex:none;white-space:nowrap}}
.xv-kinds button{all:unset;flex:none;white-space:nowrap;cursor:pointer;font:600 13px/1.2 "IBM Plex Sans",sans-serif;border:1px solid rgba(210,184,255,.38);border-radius:999px;padding:8px 14px;background:rgba(5,2,11,.5);color:#b3a4d2}
.xv-kinds button:hover{color:#f4eeff}.xv-kinds button[aria-pressed=true]{background:#d2b8ff;color:#1b0a36;border-color:#d2b8ff}
.xv-kinds button:focus-visible{outline:2px solid #d2b8ff;outline-offset:2px}
.xgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:26px 22px}
@media (max-width:520px){.xgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 14px}.xv-cap b{font-size:14px}}
.xv-c{display:flex;flex-direction:column;gap:10px;min-width:0}
.xv-po{all:unset;box-sizing:border-box;display:block;position:relative;cursor:pointer;border-radius:10px;overflow:hidden;aspect-ratio:8.5/11;background:radial-gradient(circle at 50% 35%,#5a1f8f,#1b0a36 70%);box-shadow:0 22px 44px -20px rgba(0,0,0,.95),0 0 0 1px rgba(210,184,255,.14);transition:transform .35s ease,box-shadow .35s ease}
.xv-po:hover,.xv-po:focus-visible{transform:translateY(-6px) rotate(-.6deg);box-shadow:0 30px 60px -18px rgba(139,63,214,.75),0 0 0 2px rgba(255,190,85,.6)}
.xv-po:focus-visible{outline:2px solid #d2b8ff;outline-offset:3px}
.xv-po img,.xv-po canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.xv-po.white img{object-fit:contain;background:#fff;padding:8%}
.xv-po canvas{animation:xv-in .5s ease both}
@keyframes xv-in{from{opacity:0}to{opacity:1}}
.xv-po .xv-kd{position:absolute;left:8px;top:8px;font:600 11px/1.4 "IBM Plex Sans",sans-serif;padding:3px 9px;border-radius:999px;background:rgba(5,2,11,.8);color:#fff;border:1px solid rgba(255,255,255,.2)}
.xv-po .xv-sh{position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.14) 50%,transparent 70%);background-size:250% 100%;animation:xv-sh 1.4s linear infinite}
@keyframes xv-sh{from{background-position:120% 0}to{background-position:-120% 0}}
.xv-cap{display:flex;flex-direction:column;min-width:0;padding:0 2px;font:400 13px/1.35 "IBM Plex Sans",sans-serif;color:#b3a4d2}
.xv-cap b{font:600 15px/1.3 Sora,sans-serif;color:#f4eeff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xv-cap a{color:#d2b8ff;text-decoration:none;width:max-content;max-width:100%;overflow:hidden;text-overflow:ellipsis}.xv-cap a:hover{text-decoration:underline}
.xv-pv,.xv-rp{box-sizing:border-box;border:1px solid rgba(210,184,255,.4);border-radius:20px;background:#0d0620;color:#f4eeff;padding:0;font:400 15px/1.5 "IBM Plex Sans",sans-serif;max-width:none;max-height:none}
.xv-pv::backdrop,.xv-rp::backdrop{background:rgba(5,2,11,.82);backdrop-filter:blur(4px)}
.xv-pv{width:min(94vw,900px)}
.xv-pv .xv-in{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:22px;padding:22px;align-items:start}
.xv-pv .xv-big{position:relative;aspect-ratio:8.5/11;max-height:calc(100vh - 90px);margin:0 auto;width:100%;border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 20px 50px -20px rgba(0,0,0,.9)}
.xv-pv .xv-big canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.xv-pv .xv-big .xv-wait{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);font:600 12px Sora,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:rgba(5,2,11,.75);padding:6px 12px;border-radius:999px}
.xv-pv .xv-side{display:flex;flex-direction:column;gap:10px}
.xv-pv h2{margin:0;font:700 22px/1.2 Sora,sans-serif;overflow-wrap:anywhere}
.xv-pv .xv-meta{color:#b3a4d2;font-size:14px}.xv-pv .xv-meta a{color:#d2b8ff}
.xv-pv .xv-b{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;text-align:center;font:600 12px/1.2 Sora,sans-serif;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:13px 16px;border:1px solid rgba(210,184,255,.4);background:rgba(20,9,40,.6);color:#f4eeff;cursor:pointer}
.xv-pv .xv-b:hover{border-color:#d2b8ff}.xv-pv .xv-b:focus-visible{outline:2px solid #d2b8ff;outline-offset:2px}
.xv-pv .xv-b.go{background:linear-gradient(135deg,#ffe0a0,#ffbe55);color:#1b0f00;border-color:#ffbe55;font-size:13px;padding:15px 16px}
.xv-pv .xv-b[aria-disabled=true]{opacity:.5;pointer-events:none}
.xv-pv .xv-note{font-size:12.5px;color:#8f80b0;margin:2px 0 0}
.xv-pv .xv-x{all:unset;position:absolute;right:12px;top:10px;width:36px;height:36px;display:grid;place-items:center;border-radius:50%;font:400 22px/1 sans-serif;color:#f4eeff;background:rgba(5,2,11,.7);cursor:pointer;z-index:2}
.xv-pv .xv-rep{all:unset;cursor:pointer;color:#8f80b0;font-size:13px;margin-top:6px;width:max-content}.xv-pv .xv-rep:hover{color:#ff8a9e}
@media (max-width:720px){.xv-pv .xv-in{grid-template-columns:minmax(0,1fr);padding:16px}.xv-pv .xv-big{max-height:none;width:min(100%,calc(58vh * 8.5 / 11))}}
.xv-rp{width:min(92vw,400px);padding:22px}
.xv-rp h2{margin:0 0 6px;font:700 18px Sora,sans-serif}.xv-rp p{margin:0 0 12px;color:#b3a4d2;font-size:14px}
.xv-rp label{display:flex;gap:10px;align-items:center;padding:7px 0;cursor:pointer}
.xv-rp textarea{box-sizing:border-box;width:100%;font:inherit;color:#f4eeff;background:rgba(5,2,11,.7);border:1px solid rgba(210,184,255,.38);border-radius:10px;padding:10px;margin-top:6px;min-height:70px}
.xv-rp .xv-row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
.xv-rp button{all:unset;font:600 12px Sora,sans-serif;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:11px 18px;border:1px solid rgba(210,184,255,.38);background:rgba(20,9,40,.6);color:#f4eeff;cursor:pointer}
.xv-rp button.go{background:linear-gradient(135deg,#ffe0a0,#ffbe55);color:#1b0f00;border-color:#ffbe55}
.xv-rp .xv-msg{min-height:1.2em;font-size:14px;color:#74e8ba;margin:8px 0 0}
@media (prefers-reduced-motion:reduce){.xv-po,.xv-po canvas{transition:none;animation:none}.xv-po .xv-sh{animation:none}}
` }));

  // ---- the posters: experience data (cached), drawn one at a time on one big canvas, kept in small
  const data = new Map(), thumbs = new Map();
  const expOf = x => data.get(x.slug) || data.set(x.slug, api(`/api/exp/${x.slug}?sin_vista=1`).then(e => { e.url = x.url; e.updated = e.updated || x.updated; return e; })).get(x.slug);
  const drawBig = async (cv, x) => VVRPoster.draw(cv, await expOf(x), { api: location.origin, base, plan: { brand: true } });   // the API already drops a brand's logo its plan does not include
  let chain = Promise.resolve(), work;
  const queue = fn => (chain = chain.then(fn, fn));
  function thumb(x) {
    if (thumbs.has(x.slug)) return thumbs.get(x.slug);
    const p = queue(async () => {
      work = work || document.createElement("canvas");
      await drawBig(work, x);
      const t = document.createElement("canvas"); t.width = TW; t.height = TH;
      const c = t.getContext("2d"); c.imageSmoothingQuality = "high"; c.drawImage(work, 0, 0, TW, TH);
      return t;
    });
    thumbs.set(x.slug, p); p.catch(() => thumbs.delete(x.slug));
    return p;
  }
  const seen = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { seen.unobserve(e.target); e.target._load(); } }), { rootMargin: "300px" }) : null;

  function card(x, o) {
    const el = document.createElement("article"), K = KINDS[x.kind] || KINDS.ra;
    const white = x.kind === "colorear" || (x.kind === "trivia" && !x.image);
    el.className = "xv-c";
    el.innerHTML = `<button class="xv-po${white ? " white" : ""}" type="button" aria-label="Ver el póster de ${esc(x.title)}"><img loading="lazy" src="${esc(x.image || base + "trivia.svg")}" alt=""><span class="xv-sh"></span><span class="xv-kd">${K[0]} ${esc(K[1])}</span></button>
      <div class="xv-cap"><b title="${esc(x.title)}">${esc(x.title)}</b>${o.by !== false && x.by ? `<a href="/@${esc(x.by.handle)}">por @${esc(x.by.handle)}</a>` : `<span>${K[0]} ${esc(K[1])}</span>`}</div>`;
    const po = el.querySelector(".xv-po");
    po._load = () => thumb(x).then(t => { po.classList.remove("white"); po.replaceChildren(t); }).catch(() => { const s = po.querySelector(".xv-sh"); if (s) s.remove(); });
    if (seen) seen.observe(po); else po._load();
    po.onclick = () => open(x, o);
    return el;
  }
  function render(el, list, o = {}) {
    const grid = el.classList.contains("xgrid") ? el : (el.querySelector(".xgrid") || el.appendChild(Object.assign(document.createElement("div"), { className: "xgrid" })));
    if (!o.append) grid.replaceChildren();
    for (const x of list) grid.appendChild(card(x, o));
  }

  // ---- the poster, big: open the experience, download, share, report
  let pv;
  async function open(x, o) {
    if (!pv) {
      pv = document.createElement("dialog"); pv.className = "xv-pv";
      pv.innerHTML = `<button class="xv-x" type="button" aria-label="Cerrar">×</button><div class="xv-in"><div class="xv-big"><canvas></canvas><span class="xv-wait">Preparando el póster…</span></div>
        <div class="xv-side"><h2></h2><div class="xv-meta"></div><a class="xv-b go" target="_blank" rel="noopener">Abrir experiencia</a>
        <button class="xv-b" type="button" data-a="pdf">Descargar PDF</button><button class="xv-b" type="button" data-a="png">Descargar imagen</button><button class="xv-b" type="button" data-a="share">Compartir</button>
        <p class="xv-note">Tamaño carta, listo para imprimir: quien escanee el QR abre la experiencia.</p><button class="xv-rep" type="button">⚑ Reportar esta experiencia</button></div></div>`;
      document.body.appendChild(pv);
      pv.querySelector(".xv-x").onclick = () => pv.close();
      pv.addEventListener("click", e => { if (e.target === pv) pv.close(); });   // tap outside
    }
    const run = (pv._run = (pv._run || 0) + 1), K = KINDS[x.kind] || KINDS.ra, cv = pv.querySelector("canvas"), wait = pv.querySelector(".xv-wait");
    const btns = [...pv.querySelectorAll("[data-a=pdf],[data-a=png]")];
    pv.querySelector("h2").textContent = x.title;
    pv.querySelector(".xv-meta").innerHTML = `${K[0]} ${esc(K[1])}${o.by !== false && x.by ? ` · <a href="/@${esc(x.by.handle)}">por @${esc(x.by.handle)}</a>` : ""}`;
    pv.querySelector(".go").href = x.url;
    btns.forEach(b => b.setAttribute("aria-disabled", "true")); wait.hidden = false;
    const ctx = cv.getContext("2d"); cv.width = TW; cv.height = TH; ctx.clearRect(0, 0, TW, TH);
    thumb(x).then(t => { if (pv._run === run && wait.hidden === false) ctx.drawImage(t, 0, 0); }).catch(() => {});   // the small one first
    pv.querySelector("[data-a=pdf]").onclick = () => VVRPoster.pdf(cv, `poster-${x.slug}.pdf`);
    pv.querySelector("[data-a=png]").onclick = () => VVRPoster.png(cv, `poster-${x.slug}.png`);
    pv.querySelector("[data-a=share]").onclick = async e => {
      const b = e.currentTarget;
      try { if (navigator.share) await navigator.share({ title: x.title, text: `Mira «${x.title}» en Vórtice VR:`, url: x.url }); else { await navigator.clipboard.writeText(x.url); b.textContent = "¡Link copiado!"; setTimeout(() => b.textContent = "Compartir", 1800); } } catch (err) {}
    };
    pv.querySelector(".xv-rep").onclick = () => report(x);
    if (!pv.open) pv.showModal();
    try {
      const big = document.createElement("canvas");
      await queue(() => drawBig(big, x));
      if (pv._run !== run) return;
      cv.width = big.width; cv.height = big.height; cv.getContext("2d").drawImage(big, 0, 0);
      wait.hidden = true; btns.forEach(b => b.removeAttribute("aria-disabled"));
    } catch (e) { if (pv._run === run) wait.textContent = "No se pudo preparar el póster"; }
  }

  let rp;
  function report(x) {
    if (!rp) {
      rp = document.createElement("dialog"); rp.className = "xv-rp";
      rp.innerHTML = `<form method="dialog"><h2>Reportar experiencia</h2><p class="xv-who"></p>${REASONS.map(([k, t], i) => `<label><input type="radio" name="r" value="${k}"${i ? "" : " checked"}> ${t}</label>`).join("")}
        <textarea name="note" maxlength="500" placeholder="¿Algo más que debamos saber? (opcional)"></textarea><p class="xv-msg" role="status"></p>
        <div class="xv-row"><button type="button" data-a="x">Cancelar</button><button type="submit" class="go">Enviar reporte</button></div></form>`;
      document.body.appendChild(rp);
      rp.querySelector("[data-a=x]").onclick = () => rp.close();
    }
    const f = rp.querySelector("form"), msg = rp.querySelector(".xv-msg"), send = f.querySelector(".go");
    rp.querySelector(".xv-who").textContent = `“${x.title}”. Lo revisamos y, si no cumple las reglas, la quitamos.`;
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
    rp.showModal();
  }

  // type filter chips: kinds(el, current, onPick(kind)); "" = all
  function kinds(el, cur, pick) {
    el.classList.add("xv-kinds"); el.setAttribute("role", "group"); el.setAttribute("aria-label", "Tipo de experiencia");
    el.innerHTML = `<button type="button" data-k="">Todas</button>` + Object.entries(KINDS).map(([k, v]) => `<button type="button" data-k="${k}">${v[0]} ${esc(v[1])}</button>`).join("");
    const mark = k => el.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
    el.onclick = e => { const b = e.target.closest("[data-k]"); if (!b) return; mark(b.dataset.k); pick(b.dataset.k); };
    mark(cur || "");
  }

  window.VVRExplora = { KINDS, render, kinds, load: (q = "") => api("/api/explora" + q) };
})();
