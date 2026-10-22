// "Logo de la experiencia" for the makers (every /crear/ that has it): Vórtice VR (every plan), the customer's own brand or no
// logo at all (both on plans with `brand`: Premium). The logo goes on top of the experience and on its photos and videos.
// Any image (PNG, JPG, WebP or SVG) is turned into a PNG of at most 800 px here; the server keeps it as exp/<slug>/logo.
// Once there is a logo the upload box turns into a confirmation (the logo, "✓ Tu logo está listo", its name) with how it
// will look on the experience and on the photos.
// Usage: const m = VVRMarca.mount(element, { plan, exp, api, base }); m.get() → { brand: "own"|"none"|"vortice", file, ok, preview }.
(function () {
  const CSS = `
.vm-seg{display:flex;gap:6px;flex-wrap:wrap}
.vm-seg button{font:600 .9rem var(--fb,system-ui);color:var(--ink,#f2ecff);background:rgba(5,2,11,.6);border:1px solid var(--line2,rgba(190,150,255,.45));border-radius:999px;padding:9px 16px;cursor:pointer;display:flex;align-items:center;gap:8px}
.vm-seg button[aria-pressed="true"]{background:var(--vortex,#8b3fd6);border-color:var(--lav,#d2b8ff)}
.vm-seg button:disabled{opacity:.5;cursor:not-allowed}
.vm-seg img{height:16px;width:auto}
.vm-seg .vm-mini{height:20px;max-width:56px;object-fit:contain;background:#fff;border-radius:999px;padding:2px 6px}
.vm-lock{margin-top:10px;font-size:.9rem;color:var(--mute,#a99bcb)}
.vm-lock b{color:#ffbe55}
.vm-own{margin-top:12px;display:grid;gap:12px}
.vm-drop{position:relative;display:flex;align-items:center;gap:14px;border:1.5px dashed var(--line2,rgba(190,150,255,.45));border-radius:12px;padding:14px;cursor:pointer;transition:border-color .2s,background .2s}
.vm-drop:hover{border-color:var(--lav,#d2b8ff);background:rgba(139,63,214,.12)}
.vm-drop input{position:absolute;width:1px;height:1px;opacity:0}
.vm-drop .vm-ic{width:56px;height:56px;flex:none;border-radius:12px;display:grid;place-items:center;font-size:1.5rem;background:rgba(139,63,214,.2);border:1px solid var(--line2,rgba(190,150,255,.45))}
.vm-drop .vm-ic img{max-width:46px;max-height:46px;object-fit:contain}
.vm-drop.has{border-style:solid;border-color:#74e8ba;background:rgba(116,232,186,.08)}
.vm-drop.has .vm-ic{background:#fff;border-color:#74e8ba}
.vm-drop.has .vm-t{color:#74e8ba}
.vm-drop.pop{animation:vm-pop .5s cubic-bezier(.2,1.5,.4,1)}
@keyframes vm-pop{40%{transform:scale(1.03);box-shadow:0 0 0 6px rgba(116,232,186,.25)}}
.vm-drop .vm-go{margin-left:auto;flex:none;font:600 .78rem var(--fd,system-ui);letter-spacing:.1em;text-transform:uppercase;padding:8px 12px;border-radius:999px;border:1px solid var(--line2,rgba(190,150,255,.45));color:var(--ink,#f2ecff)}
.vm-busy .vm-ic{animation:vm-spin 1s linear infinite}
@keyframes vm-spin{to{transform:rotate(360deg)}}
.vm-prev{display:flex;gap:10px;flex-wrap:wrap}
.vm-prev figure{flex:1 1 150px;margin:0;display:grid;gap:6px}
.vm-prev figure>div{height:76px;border-radius:10px;display:grid;place-items:center;padding:10px;border:1px solid var(--line,rgba(190,150,255,.2))}
.vm-prev figure:first-child>div{background:radial-gradient(120% 120% at 50% 0%,#3a1670,#0d0620)}
.vm-prev figure:last-child>div{background:linear-gradient(135deg,#7a8ba3,#c8b79b)}
.vm-prev figcaption{font-size:.78rem;color:var(--mute,#a99bcb);text-align:center}
.vm-prev img{max-height:46px;max-width:100%}
.vm-prev .pill{background:#fff;border-radius:999px;padding:6px 14px;display:flex}
.vm-prev .pill img{max-height:30px}
.vm-msg{font-size:.88rem;color:var(--mute,#a99bcb)}
.vm-msg.bad{color:#ff8a9e}
@media (prefers-reduced-motion:reduce){.vm-drop.pop,.vm-busy .vm-ic{animation:none}}`;

  function mount(el, o) {
    if (!document.getElementById("vm-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "vm-css", textContent: CSS }));
    const plan = o.plan || {}, can = !!plan.brand, exp = o.exp || null, base = o.base || "../";
    const had = !!(exp && exp.brand === "own");
    const st = { brand: can && exp && (exp.brand === "own" || exp.brand === "none") ? exp.brand : "vortice", file: null, name: had ? "El logo que ya tenías" : "", url: had ? `${o.api}/m/${exp.slug}/logo?v=${exp.updated || exp.created}` : null, err: "", busy: false };
    el.innerHTML = `<h2><span class="n done">✦</span>Logo de la experiencia</h2>
      <p class="hint">Sale arriba en la experiencia y en las fotos y videos que se tomen dentro.</p>
      <div class="vm-seg"><button type="button" data-b="vortice"><img src="${base}assets/logo-vorticevr-blanco.png" alt="">Vórtice VR</button><button type="button" data-b="own" ${can ? "" : "disabled"}>${can ? "" : "🔒 "}<img class="vm-mini" alt="" hidden>El de mi marca</button><button type="button" data-b="none" ${can ? "" : "disabled"}>${can ? "" : "🔒 "}Sin logo</button></div>
      ${can ? "" : `<p class="vm-lock">✦ Poner el logo de tu marca en lugar del de Vórtice VR o quitarlo es del plan <b>Premium</b>. <a href="${base}cuenta/#planes">Ver planes</a></p>`}
      <p class="vm-none vm-msg" hidden>La experiencia no llevará ningún logo arriba, ni en las fotos y videos que se tomen.</p>
      <div class="vm-own" hidden>
        <label class="vm-drop"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"><span class="vm-ic" aria-hidden="true">⬆</span><span><b class="vm-t"></b><br><small class="vm-sub vm-msg"></small></span><span class="vm-go" hidden>Cambiar</span></label>
        <div class="vm-prev" hidden><figure><div><span class="pill"><img alt="Tu logo sobre la experiencia"></span></div><figcaption>Arriba de tu experiencia</figcaption></figure><figure><div><img alt="Tu logo en las fotos"></div><figcaption>En las fotos y videos</figcaption></figure></div>
      </div>`;
    const own = el.querySelector(".vm-own"), prev = el.querySelector(".vm-prev"), drop = el.querySelector(".vm-drop");
    let src = st.url, srcFile = null;
    const paint = () => {
      el.querySelectorAll(".vm-seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.b === st.brand)));
      own.hidden = st.brand !== "own"; el.querySelector(".vm-none").hidden = st.brand !== "none";
      if (st.file && st.file !== srcFile) { srcFile = st.file; src = URL.createObjectURL(st.file); }
      const has = !!src && !st.busy;
      prev.hidden = !has; if (has) prev.querySelectorAll("img").forEach(i => i.src = src);
      const mini = el.querySelector(".vm-mini"); mini.hidden = !has; if (has) mini.src = src;
      drop.classList.toggle("has", has); drop.classList.toggle("vm-busy", st.busy);
      el.querySelector(".vm-ic").innerHTML = st.busy ? "◌" : has ? `<img src="${src}" alt="">` : "⬆";
      el.querySelector(".vm-t").textContent = st.busy ? "Preparando tu logo…" : has ? "✓ Tu logo está listo" : "Sube el logo de tu marca";
      const sub = el.querySelector(".vm-sub");
      sub.className = "vm-sub vm-msg" + (st.err ? " bad" : "");
      sub.textContent = st.err || (has ? `${st.name || "Tu logo"} · así se verá:` : "PNG con fondo transparente o SVG. Mejor a color u oscuro (no blanco).");
      el.querySelector(".vm-go").hidden = !has;
      o.onChange && o.onChange();
    };
    el.querySelector(".vm-seg").addEventListener("click", e => { const b = e.target.closest("[data-b]"); if (!b || b.disabled) return; st.brand = b.dataset.b; paint(); });
    el.querySelector("input").addEventListener("change", async e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      st.busy = true; st.err = ""; paint();
      try { st.file = await toPng(f); st.name = f.name; st.busy = false; paint(); drop.classList.remove("pop"); void drop.offsetWidth; drop.classList.add("pop"); }
      catch (err) { st.busy = false; st.err = err && err.message === "size" ? "Ese logo pesa demasiado. Prueba con uno más sencillo o más chico." : "No pude abrir ese archivo. Usa PNG, JPG, WebP o SVG."; paint(); }
    });
    paint();
    return { get: () => ({ brand: st.brand, file: st.brand === "own" ? st.file : null, ok: st.brand !== "own" || !!(st.file || st.url), preview: st.brand === "own" ? src : null }) };
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
  // shows the chosen logo in a maker's phone preview: img = the <img> that holds the Vórtice VR logo there
  function paintPreview(img, m, vortice) {
    if (!img) return;
    const g = m && m.get ? m.get() : { brand: "vortice" };
    const box = img.parentElement;
    box.hidden = g.brand === "none";
    if (g.brand === "own" && g.preview) { img.src = g.preview; Object.assign(img.style, { height: "26px", maxWidth: "70%", objectFit: "contain", filter: "drop-shadow(0 0 1.5px rgba(255,255,255,.75)) drop-shadow(0 2px 8px rgba(0,0,0,.45))" }); }
    else { img.src = vortice; img.removeAttribute("style"); }
  }
  window.VVRMarca = { mount, paintPreview };
})();
