// Menú del sitio: el mismo encabezado en todas las páginas públicas (4 de noviembre de 2026; la gente se perdía porque
// cada página traía otro menú). Uso: <header data-menu> y justo después <script src="assets/navegacion.js"></script>; la
// página puede cambiar el botón dorado con data-menu-cta="enlace|Texto|English". Los cursos lo montan con
// VVRMenu.mount(header, {tag, sub}). Los enlaces con # del menú viejo pasan al menú del celular ("En esta página").
// Sin dependencias; los estilos van aquí mismo y empiezan con vm-.
(() => {
  if (window.VVRMenu) return;
  const ROOT = new URL("../", document.currentScript ? document.currentScript.src : location.href);
  const u = p => new URL(p, ROOT).href;
  const MAIN = [
    ["explora/", "Explora", "Explore"],
    ["biblioteca/", "Biblioteca", "Library"],
    ["galerias/", "Galerías", "Galleries"],
  ];
  const EDU = [
    ["educacion/", "Proyectos educativos", "Education projects", "Experiencias para aprender jugando", "Learn by playing"],
    ["talleres/", "Talleres para escuelas", "School workshops", "Capacitación con realidad aumentada", "Augmented reality training"],
    ["cursos/", "Cursos", "Courses", "Con constancia de Vórtice VR", "With a Vórtice VR certificate"],
  ];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const here = p => { const q = new URL(p, ROOT).pathname; return q === ROOT.pathname ? location.pathname === q : location.pathname.startsWith(q); };
  const en = () => document.documentElement.lang === "en";

  const css = document.createElement("style");
  css.textContent = `
header.vm{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:40!important;display:block!important;max-width:none!important;margin:0!important;padding:0!important;height:auto!important;background:transparent;border-bottom:1px solid transparent;transition:background .35s,border-color .35s}
header.vm.vm-solid,header.vm.solid{background:rgba(5,2,11,.84);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom-color:rgba(210,184,255,.14)}
.vm-space{height:64px}
header.vm .vm-bar{box-sizing:border-box;display:flex;align-items:center;gap:18px;max-width:1240px;margin:0 auto;padding:calc(12px + env(safe-area-inset-top,0px)) clamp(16px,3vw,32px) 12px;font-family:'Sora',system-ui,sans-serif}
header.vm .vm-brand{display:flex;align-items:center;gap:10px;flex:none;text-decoration:none;color:#f3ecff}
header.vm .vm-brand img{height:36px;width:auto;display:block}
header.vm .vm-tag{font:600 .74rem 'Sora',sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#ffbe55;border-left:1px solid rgba(210,184,255,.25);padding-left:10px}
header.vm .vm-links{display:flex;align-items:center;gap:4px;margin-left:12px}
header.vm .vm-l,header.vm .vm-ddb{display:inline-flex;align-items:center;gap:6px;padding:9px 13px;border:0;border-radius:999px;background:transparent;color:#b9acd6;font:600 .78rem 'Sora',sans-serif;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;white-space:nowrap;cursor:pointer;transition:color .2s,background .2s}
header.vm .vm-l:hover,header.vm .vm-ddb:hover,header.vm .vm-dd.on .vm-ddb{color:#f3ecff;background:rgba(139,63,214,.18)}
header.vm .vm-l.on,header.vm .vm-ddb.on{color:#f3ecff;box-shadow:inset 0 -2px 0 #ffbe55;border-radius:6px}
header.vm .vm-ddb::after{content:"";width:6px;height:6px;border:solid currentColor;border-width:0 1.6px 1.6px 0;transform:translateY(-2px) rotate(45deg);transition:transform .2s}
header.vm .vm-dd.on .vm-ddb::after{transform:translateY(1px) rotate(-135deg)}
header.vm .vm-dd{position:relative}
header.vm .vm-ddp{position:absolute;top:calc(100% + 8px);left:-8px;min-width:280px;padding:8px;border-radius:18px;background:rgba(14,7,30,.97);border:1px solid rgba(210,184,255,.22);box-shadow:0 24px 60px rgba(0,0,0,.55);opacity:0;transform:translateY(-6px);pointer-events:none;transition:opacity .2s,transform .2s}
header.vm .vm-dd.on .vm-ddp{opacity:1;transform:none;pointer-events:auto}
header.vm .vm-ddp a{display:block;padding:11px 14px;border-radius:12px;text-decoration:none;color:#f3ecff;font:600 .9rem 'Sora',sans-serif}
header.vm .vm-ddp a small{display:block;margin-top:2px;font:400 .76rem 'IBM Plex Sans',sans-serif;color:#a99bcb}
header.vm .vm-ddp a:hover,header.vm .vm-ddp a.on{background:rgba(139,63,214,.22)}
header.vm .vm-acts{display:flex;align-items:center;gap:10px;margin-left:auto}
header.vm .vm-cta{display:inline-block;line-height:1.2;padding:10px 18px;border-radius:999px;background:linear-gradient(135deg,#ffd27f,#ff9f3a);color:#1a0d00;font:700 .78rem 'Sora',sans-serif;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;white-space:nowrap;box-shadow:0 6px 24px rgba(255,159,58,.28)}
header.vm .vm-cta:hover{filter:brightness(1.07)}
header.vm .vm-acct{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;border:1px solid rgba(210,184,255,.28);background:transparent;color:#f3ecff;font:600 .78rem 'Sora',sans-serif;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;white-space:nowrap}
header.vm .vm-acct.in{padding:5px 14px 5px 5px;background:rgba(139,63,214,.18)}
header.vm .vm-acct .av{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#8b3fd6,#5b1fa0);font-size:.8rem;letter-spacing:0;color:#fff}
header.vm .lang{flex:none}
header.vm .vm-burger{display:none;align-items:center;justify-content:center;width:40px;height:40px;flex:none;padding:0;border-radius:999px;border:1px solid rgba(210,184,255,.28);background:transparent;color:#f3ecff;cursor:pointer}
header.vm .vm-burger i,header.vm .vm-burger i::before,header.vm .vm-burger i::after{display:block;width:16px;height:2px;border-radius:2px;background:currentColor;content:"";position:relative;transition:transform .3s,background .3s}
header.vm .vm-burger i::before{position:absolute;top:-5px}header.vm .vm-burger i::after{position:absolute;top:5px}
header.vm .vm-burger[aria-expanded="true"] i{background:transparent}
header.vm .vm-burger[aria-expanded="true"] i::before{transform:translateY(5px) rotate(45deg)}
header.vm .vm-burger[aria-expanded="true"] i::after{transform:translateY(-5px) rotate(-45deg)}
header.vm .vm-sub{display:flex;gap:4px;max-width:1240px;margin:0 auto;padding:0 clamp(16px,3vw,32px) 8px;overflow-x:auto;scrollbar-width:none}
header.vm .vm-sub a{padding:6px 12px;border-radius:999px;color:#b9acd6;font:600 .72rem 'Sora',sans-serif;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;white-space:nowrap}
header.vm .vm-sub a:hover{color:#f3ecff}header.vm .vm-sub a.on{color:#1a0d00;background:#ffbe55}
.vm-panel{position:fixed;left:12px;right:12px;z-index:39;padding:10px;border-radius:20px;background:rgba(12,6,26,.97);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(210,184,255,.25);box-shadow:0 24px 60px rgba(0,0,0,.55);opacity:0;transform:translateY(-8px);pointer-events:none;transition:opacity .25s,transform .25s;max-height:calc(100dvh - 96px);overflow:auto;font-family:'Sora',sans-serif}
.vm-panel.on{opacity:1;transform:none;pointer-events:auto}
.vm-panel a{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;border-radius:12px;color:#f3ecff;text-decoration:none;font:600 .86rem 'Sora',sans-serif;letter-spacing:.1em;text-transform:uppercase}
.vm-panel a::after{content:"→";color:#ffbe55}
.vm-panel a.on{background:rgba(139,63,214,.22)}
.vm-panel a:hover,.vm-panel a:focus-visible{background:rgba(139,63,214,.22)}
.vm-panel a.vm-in{padding-left:30px;font-size:.8rem;color:#d2b8ff}
.vm-panel .vm-h{padding:12px 16px 4px;font:600 .68rem 'IBM Plex Mono',monospace;letter-spacing:.18em;text-transform:uppercase;color:#a99bcb}
.vm-panel hr{border:0;border-top:1px solid rgba(210,184,255,.14);margin:6px 10px}
.vm-panel a.vm-pcta{margin-top:6px;justify-content:center;background:linear-gradient(135deg,#ffd27f,#ff9f3a);color:#1a0d00}
.vm-panel a.vm-pcta::after{content:none}
@media (max-width:980px){header.vm .vm-links{display:none}header.vm .vm-burger{display:inline-flex}}
@media (max-width:560px){header.vm .vm-bar{gap:8px;padding-inline:14px}header.vm .vm-brand img{height:26px}header.vm .vm-tag{display:none}header.vm .vm-acts{gap:6px}header.vm .vm-cta{padding:8px 12px;font-size:.68rem;letter-spacing:.06em}header.vm .vm-cta .l2{display:none}header.vm .vm-acct{padding:8px 12px;font-size:.68rem}header.vm .vm-acct.in{padding:4px}header.vm .vm-acct.in .nm{display:none}header.vm .vm-burger{width:36px;height:36px}header.vm .lang{min-width:38px!important;height:34px!important;padding-inline:6px!important}}
@media (max-width:370px){header.vm .vm-acct:not(.in){display:none}}
@media (prefers-reduced-motion:reduce){header.vm,header.vm .vm-ddp,.vm-panel,header.vm .vm-burger i::before,header.vm .vm-burger i::after{transition:none}}
@media print{header.vm,.vm-space,.vm-panel{display:none!important}}`;
  document.head.appendChild(css);

  function session() { try { const s = JSON.parse(localStorage.getItem("vvr-sesion") || "null"); return s && s.token ? s : null; } catch (e) { return null; } }

  function mount(h, o = {}) {
    if (!h || h.classList.contains("vm")) return;
    // the old header: its position decides if it covered the page (fixed/absolute: the hero already leaves room) or
    // took space (then a spacer keeps the content from going under the bar); its # links go to the phone menu
    const pos = getComputedStyle(h).position, inFlow = pos !== "fixed" && pos !== "absolute";
    const anchors = [...h.querySelectorAll('a[href^="#"]')].filter(a => a.getAttribute("href").length > 1 && a.textContent.trim())
      .map(a => [a.getAttribute("href"), a.textContent.trim(), a.dataset.en || a.textContent.trim()]);
    const lang = h.querySelector("#lang");
    const ctaAttr = (h.dataset.menuCta || "").split("|");
    const cta = o.cta || (ctaAttr[0] ? { href: ctaAttr[0], t: ctaAttr[1], en: ctaAttr[2] || ctaAttr[1] } : { href: u("crear/"), t: 'Crear<span class="l2"> experiencia</span>', en: 'Create<span class="l2"> experience</span>' });
    const s = session();
    const name = s ? String((s.user && (s.user.name || s.user.email)) || "?").trim() : "";
    const ini = esc(name.charAt(0).toUpperCase() || "·");
    const acct = s ? { href: u("cuenta/"), es: `<span class="av">${ini}</span><span class="nm">Mi cuenta</span>`, en: `<span class="av">${ini}</span><span class="nm">My account</span>` }
      : { href: o.login || u("cuenta/#entrar"), es: "Entrar", en: "Sign in" };
    const eduOn = EDU.some(([p]) => here(p));

    h.classList.add("vm");
    h.innerHTML = `<div class="vm-bar">
  <a class="vm-brand" href="${u("")}" aria-label="Vórtice VR, inicio"><img src="${u("assets/logo-vorticevr-blanco.png")}" alt="Vórtice VR">${o.tag ? `<span class="vm-tag">${esc(o.tag)}</span>` : ""}</a>
  <div class="vm-links" role="navigation" aria-label="Menú del sitio">
    ${MAIN.map(([p, es, e]) => `<a class="vm-l${here(p) ? " on" : ""}" href="${u(p)}" data-en="${e}"${here(p) ? ' aria-current="page"' : ""}>${es}</a>`).join("")}
    <div class="vm-dd"><button type="button" class="vm-ddb${eduOn ? " on" : ""}" aria-expanded="false" data-en="Education">Educación</button>
      <div class="vm-ddp">${EDU.map(([p, es, e, d, de]) => `<a href="${u(p)}" class="${here(p) ? "on" : ""}"><span data-en="${e}">${es}</span><small data-en="${de}">${d}</small></a>`).join("")}</div></div>
  </div>
  <div class="vm-acts">
    <a class="vm-cta mag" href="${esc(cta.href)}" data-en="${esc(cta.en)}">${cta.t}</a>
    <a class="vm-acct mag${s ? " in" : ""}" id="acct" href="${esc(acct.href)}" data-en="${esc(acct.en)}"${s ? ` title="${esc(name)}"` : ""}>${acct.es}</a>
    <button type="button" class="vm-burger" aria-expanded="false" aria-controls="vm-panel" aria-label="Abrir menú"><i></i></button>
  </div>
</div>${o.sub ? `<nav class="vm-sub" aria-label="${esc(o.tag || "Sección")}">${o.sub.map(x => `<a href="${esc(x.href)}" class="${x.on ? "on" : ""}">${esc(x.t)}</a>`).join("")}</nav>` : ""}`;
    if (lang) h.querySelector(".vm-acts").insertBefore(lang, h.querySelector(".vm-burger"));
    if (inFlow && !h.nextElementSibling?.classList.contains("vm-space")) {
      const sp = document.createElement("div"); sp.className = "vm-space"; h.after(sp);
      const fit = () => { sp.style.height = h.offsetHeight + "px"; }; fit(); addEventListener("resize", fit);
    }
    const solid = () => h.classList.toggle("vm-solid", inFlow || scrollY > 24);
    solid(); addEventListener("scroll", solid, { passive: true });

    // Educación: opens on hover with a mouse and on click (touch, keyboard)
    const dd = h.querySelector(".vm-dd"), ddb = dd.querySelector(".vm-ddb");
    const open = on => { dd.classList.toggle("on", on); ddb.setAttribute("aria-expanded", String(on)); };
    let t, hovered = 0;
    dd.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") { clearTimeout(t); if (!dd.classList.contains("on")) hovered = Date.now(); open(true); } });
    dd.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") t = setTimeout(() => open(false), 180); });
    ddb.addEventListener("click", e => { e.stopPropagation(); open(Date.now() - hovered < 600 || !dd.classList.contains("on")); });   // a click right after the hover opened it keeps it open

    // the phone menu: the whole site, plus this page's sections
    const btn = h.querySelector(".vm-burger");
    const panel = document.createElement("div"); panel.id = "vm-panel"; panel.className = "vm-panel"; document.body.appendChild(panel);
    const L = (es, e) => en() ? e : es;
    const build = () => {
      const a = (href, t, cls = "") => `<a href="${esc(href)}" class="${cls}${here(href) && !href.includes("#") ? " on" : ""}">${esc(t)}</a>`;
      panel.innerHTML = [
        a(u(""), L("Inicio", "Home")),
        ...MAIN.map(([p, es, e]) => a(u(p), L(es, e))),
        `<div class="vm-h">${L("Educación", "Education")}</div>`,
        ...EDU.map(([p, es, e]) => a(u(p), L(es, e), "vm-in")),
        "<hr>",
        a(u("#contacto"), L("Contacto", "Contact")),
        a(acct.href, s ? L("Mi cuenta", "My account") : L("Entrar", "Sign in")),
        ...(anchors.length ? [`<div class="vm-h">${L("En esta página", "On this page")}</div>`, ...anchors.filter(([hr]) => hr !== cta.href).map(([hr, es, e]) => a(hr, L(es, e), "vm-in"))] : []),
        `<a href="${esc(cta.href)}" class="vm-pcta">${L(cta.t, cta.en).replace(/<[^>]+>/g, "")}</a>`,
      ].join("");
    };
    const set = on => {
      if (on) { build(); panel.style.top = h.getBoundingClientRect().bottom + 6 + "px"; }
      panel.classList.toggle("on", on); btn.setAttribute("aria-expanded", String(on));
      btn.setAttribute("aria-label", on ? L("Cerrar menú", "Close menu") : L("Abrir menú", "Open menu"));
    };
    btn.addEventListener("click", e => { e.stopPropagation(); set(!panel.classList.contains("on")); });
    panel.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
    document.addEventListener("click", e => { if (!panel.contains(e.target)) set(false); if (!dd.contains(e.target)) open(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") { set(false); open(false); } });
  }

  window.VVRMenu = { mount, root: ROOT.href };
  document.querySelectorAll("header[data-menu]").forEach(h => mount(h));
})();
