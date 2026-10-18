// "Logo de la experiencia" for the makers (/crear/, /crear/trivia/, /crear/colorear/): Vórtice VR (every plan), the
// customer's own brand or no logo at all (both on plans with `brand`: Premium). The logo goes on top of the experience and on its photos and
// videos. Any image (PNG, JPG, WebP or SVG) is turned into a PNG of at most 800 px here; the server keeps it as exp/<slug>/logo.
// Usage: const m = VVRMarca.mount(element, { plan, exp, api, base }); m.get() → { brand: "own"|"none"|"vortice", file, ok, preview }.
(function () {
  const CSS = `
.vm-seg{display:flex;gap:6px;flex-wrap:wrap}
.vm-seg button{font:600 .9rem var(--fb,system-ui);color:var(--ink,#f2ecff);background:rgba(5,2,11,.6);border:1px solid var(--line2,rgba(190,150,255,.45));border-radius:999px;padding:9px 16px;cursor:pointer;display:flex;align-items:center;gap:8px}
.vm-seg button[aria-pressed="true"]{background:var(--vortex,#8b3fd6);border-color:var(--lav,#d2b8ff)}
.vm-seg button:disabled{opacity:.5;cursor:not-allowed}
.vm-seg img{height:16px;width:auto}
.vm-lock{margin-top:10px;font-size:.9rem;color:var(--mute,#a99bcb)}
.vm-lock b{color:#ffbe55}
.vm-own{margin-top:12px;display:grid;gap:10px}
.vm-drop{display:flex;align-items:center;gap:14px;border:1.5px dashed var(--line2,rgba(190,150,255,.45));border-radius:12px;padding:14px;cursor:pointer}
.vm-drop:hover{border-color:var(--lav,#d2b8ff);background:rgba(139,63,214,.12)}
.vm-drop input{position:absolute;width:1px;height:1px;opacity:0}
.vm-prev{display:flex;gap:10px;flex-wrap:wrap}
.vm-prev div{flex:1 1 140px;height:70px;border-radius:10px;display:grid;place-items:center;padding:10px;border:1px solid var(--line,rgba(190,150,255,.2))}
.vm-prev div:first-child{background:#0d0620}.vm-prev div:last-child{background:#fff}
.vm-prev img{max-height:46px;max-width:100%}
.vm-prev .pill{background:#fff;border-radius:999px;padding:6px 14px;display:flex}
.vm-prev .pill img{max-height:30px}
.vm-msg{font-size:.88rem;color:var(--mute,#a99bcb)}
.vm-msg.bad{color:#ff8a9e}`;

  function mount(el, o) {
    if (!document.getElementById("vm-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "vm-css", textContent: CSS }));
    const plan = o.plan || {}, can = !!plan.brand, exp = o.exp || null, base = o.base || "../";
    const had = !!(exp && exp.brand === "own");
    const st = { brand: can && exp && (exp.brand === "own" || exp.brand === "none") ? exp.brand : "vortice", file: null, url: had ? `${o.api}/m/${exp.slug}/logo?v=${exp.updated || exp.created}` : null };
    el.innerHTML = `<h2><span class="n done">✦</span>Logo de la experiencia</h2>
      <p class="hint">Sale arriba en la experiencia y en las fotos y videos que se tomen dentro.</p>
      <div class="vm-seg"><button type="button" data-b="vortice"><img src="${base}assets/logo-vorticevr-blanco.png" alt="">Vórtice VR</button><button type="button" data-b="own" ${can ? "" : "disabled"}>${can ? "" : "🔒 "}El de mi marca</button><button type="button" data-b="none" ${can ? "" : "disabled"}>${can ? "" : "🔒 "}Sin logo</button></div>
      ${can ? "" : `<p class="vm-lock">✦ Poner el logo de tu marca en lugar del de Vórtice VR o quitarlo es del plan <b>Premium</b>. <a href="${base}cuenta/#planes">Ver planes</a></p>`}
      <p class="vm-none vm-msg" hidden>La experiencia no llevará ningún logo arriba, ni en las fotos y videos que se tomen.</p>
      <div class="vm-own" hidden>
        <label class="vm-drop"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"><span><b class="vm-t">Sube el logo de tu marca</b><br><small class="vm-msg">PNG con fondo transparente o SVG. Mejor a color u oscuro (no blanco).</small></span></label>
        <div class="vm-prev" hidden><div><span class="pill"><img alt="Tu logo sobre la experiencia"></span></div><div><img alt="Tu logo en las fotos"></div></div>
      </div>`;
    const own = el.querySelector(".vm-own"), prev = el.querySelector(".vm-prev"), msg = el.querySelector(".vm-msg");
    const paint = () => {
      el.querySelectorAll(".vm-seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.b === st.brand)));
      own.hidden = st.brand !== "own"; el.querySelector(".vm-none").hidden = st.brand !== "none";
      const src = st.file ? URL.createObjectURL(st.file) : st.url;
      prev.hidden = !src; if (src) prev.querySelectorAll("img").forEach(i => i.src = src);
      if (src) el.querySelector(".vm-t").textContent = "Cambiar el logo";
      o.onChange && o.onChange();
    };
    el.querySelector(".vm-seg").addEventListener("click", e => { const b = e.target.closest("[data-b]"); if (!b || b.disabled) return; st.brand = b.dataset.b; paint(); });
    el.querySelector("input").addEventListener("change", async e => {
      const f = e.target.files[0]; if (!f) return;
      msg.className = "vm-msg"; msg.textContent = "Preparando tu logo…";
      try { st.file = await toPng(f); msg.textContent = "Listo. Así se verá:"; }
      catch (err) { msg.className = "vm-msg bad"; msg.textContent = "No pude abrir ese archivo. Usa PNG, JPG, WebP o SVG."; }
      paint();
    });
    paint();
    // preview = a URL of the logo to show it in a live preview (the menu maker)
    let pvFile = null, pvUrl = null;
    const pv = () => { if (st.file && st.file !== pvFile) { pvFile = st.file; pvUrl = URL.createObjectURL(st.file); } return st.file ? pvUrl : st.url; };
    return { get: () => ({ brand: st.brand, file: st.brand === "own" ? st.file : null, ok: st.brand !== "own" || !!(st.file || st.url), preview: st.brand === "own" ? pv() : null }) };
  }

  // any image → PNG, longest side at most 800 px, transparency kept
  function toPng(file) {
    return new Promise((ok, bad) => {
      const i = new Image(), u = URL.createObjectURL(file);
      i.onload = () => {
        let w = i.naturalWidth || 600, h = i.naturalHeight || 200; const k = Math.min(1, 800 / Math.max(w, h)); w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
        const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(i, 0, 0, w, h);
        c.toBlob(b => { URL.revokeObjectURL(u); b && b.size <= 1048576 ? ok(b) : bad(new Error("size")); }, "image/png");
      };
      i.onerror = () => { URL.revokeObjectURL(u); bad(new Error("img")); };
      i.src = u;
    });
  }
  window.VVRMarca = { mount };
})();
