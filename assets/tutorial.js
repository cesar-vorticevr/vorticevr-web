// Guided tour of /crear/, shown the first time someone creates an experience (remembered in localStorage
// "vvr-tutorial"; "Ver tutorial" replays it). A soft spotlight with a glowing gold edge moves from step to step,
// a small card explains it, with Atrás / Siguiente / Omitir. Esc skips, arrows move. Sparkles on each step
// (assets/magia.js, if loaded). Calm without motion when "reduce motion" is on.
(function () {
  const KEY = "vvr-tutorial";
  const STEPS = [
    { title: "¡Vamos a crear tu realidad aumentada!", text: "Te guío en 4 pasos rápidos. En un par de minutos tendrás tu link y tu código QR listos para compartir." },
    { sel: "#s1", title: "1 · Tu imagen", text: "Sube la imagen que la gente va a enfocar con su celular: tu tarjeta, un cartel, una portada. Te diremos con estrellas qué tan bien se va a reconocer." },
    { sel: "#adds", title: "2 · Tu contenido", text: "Con estos botones agregas lo que aparece sobre tu imagen: videos, fotos, textos u objetos 3D. Un video entra a lo ancho de la imagen y luego lo acomodas." },
    { sel: "#ed", title: "Acomódalo", text: "Así se verá en el celular. Toca un elemento: arrástralo para moverlo, usa los anillos para girarlo y la rueda o dos dedos para su tamaño. A la derecha están sus opciones." },
    { sel: "#s4", title: "3 · Título, link y botones", text: "Ponle un título, elige tu link y, si quieres, agrega tu WhatsApp, tu sitio o tus redes como botones." },
    { sel: "#s6", title: "4 · ¡Publica!", text: "Al publicar recibes tu link y tu QR, también por correo. Imprime el QR junto a tu imagen y listo." },
  ];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = document.createElement("style");
  css.textContent = `
#vt-shade{position:fixed;inset:0;z-index:9000;pointer-events:auto}
#vt-spot{position:fixed;z-index:9001;border-radius:20px;pointer-events:none;box-shadow:0 0 0 9999px rgba(5,2,11,.74),0 0 0 2px rgba(255,210,127,.95),0 0 28px 6px rgba(255,190,85,.45);
  transition:top .45s cubic-bezier(.2,.8,.2,1),left .45s cubic-bezier(.2,.8,.2,1),width .45s cubic-bezier(.2,.8,.2,1),height .45s cubic-bezier(.2,.8,.2,1),border-radius .45s}
#vt-spot.center{top:50%!important;left:50%!important;width:0!important;height:0!important;box-shadow:0 0 0 9999px rgba(5,2,11,.74)}
#vt-spot::after{content:"";position:absolute;inset:-2px;border-radius:inherit;box-shadow:0 0 18px 2px rgba(210,184,255,.6);animation:vtpulse 2.2s ease-in-out infinite}
#vt-spot.center::after{display:none}
@keyframes vtpulse{0%,100%{opacity:.25}50%{opacity:1}}
#vt-card{position:fixed;z-index:9002;width:min(360px,calc(100vw - 32px));padding:18px 18px 14px;border-radius:18px;color:#f2ecff;
  background:linear-gradient(160deg,#1d0d3a,#0d0620);border:1px solid rgba(255,210,127,.55);box-shadow:0 24px 60px -12px rgba(0,0,0,.85),0 0 40px rgba(139,63,214,.35);
  font:400 .95rem/1.5 "IBM Plex Sans",system-ui,sans-serif;transition:top .45s cubic-bezier(.2,.8,.2,1),left .45s cubic-bezier(.2,.8,.2,1),opacity .3s}
#vt-card h3{margin:0 0 6px;font:700 1.08rem "Sora",system-ui,sans-serif;background:linear-gradient(100deg,#d2b8ff,#ffbe55);-webkit-background-clip:text;background-clip:text;color:transparent}
#vt-card p{margin:0 0 14px;color:#d8cdf0}
#vt-card .vt-row{display:flex;align-items:center;gap:8px}
#vt-card .vt-dots{display:flex;gap:5px;margin-right:auto}
#vt-card .vt-dots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.18);transition:background .3s,transform .3s}
#vt-card .vt-dots i.on{background:#ffbe55;transform:scale(1.3);box-shadow:0 0 8px #ffbe55}
#vt-card button{font:600 .78rem "Sora",system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;border-radius:999px;padding:9px 14px;cursor:pointer;border:1px solid rgba(190,150,255,.45);background:transparent;color:#f2ecff}
#vt-card button.vt-next{background:linear-gradient(110deg,#ffd27f,#ffbe55,#ff9f3a);color:#1a0d00;border-color:#ffe2a6}
#vt-card button.vt-skip{border:0;color:#a99bcb;padding:6px 4px;text-transform:none;letter-spacing:0;font:500 .82rem "IBM Plex Sans",system-ui,sans-serif;text-decoration:underline;text-underline-offset:3px}
#vt-card .vt-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
#vt-card .vt-n{font:600 .7rem "Sora",system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#ffbe55}
${reduce ? "#vt-spot,#vt-card{transition:none}#vt-spot::after{animation:none}" : ""}`;
  document.head.appendChild(css);

  let i = 0, els = null, onKey = null, onResize = null;
  function rectOf(step) {
    const a = document.querySelector(step.sel); if (!a || a.hidden) return null;
    const r = a.getBoundingClientRect();
    return { top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 };
  }
  function place() {
    const s = STEPS[i], { spot, card } = els, r = s.sel && rectOf(s), vw = innerWidth, vh = innerHeight;
    spot.classList.toggle("center", !r);
    if (r) Object.assign(spot.style, { top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px" });
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let top, left;
    if (!r) { top = (vh - ch) / 2; left = (vw - cw) / 2; }
    else {
      const below = r.top + r.height + 14, above = r.top - ch - 14;
      top = below + ch <= vh - 12 ? below : above >= 12 ? above : Math.max(12, vh - ch - 12);   // below, else above, else bottom
      left = Math.min(Math.max(16, r.left), vw - cw - 16);
    }
    Object.assign(card.style, { top: top + "px", left: left + "px" });
  }
  function show(n) {
    i = Math.max(0, Math.min(STEPS.length - 1, n));
    const s = STEPS[i], { card } = els;
    card.querySelector(".vt-n").textContent = i ? `Paso ${i} de ${STEPS.length - 1}` : "Bienvenida";
    card.querySelector("h3").textContent = s.title;
    card.querySelector("p").textContent = s.text;
    card.querySelectorAll(".vt-dots i").forEach((d, k) => d.classList.toggle("on", k === i));
    card.querySelector(".vt-back").hidden = i === 0;
    card.querySelector(".vt-next").textContent = i === 0 ? "Empezar" : i === STEPS.length - 1 ? "¡Entendido!" : "Siguiente";
    const target = s.sel && document.querySelector(s.sel);
    if (target) {
      const r = target.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight - 20) scrollTo({ top: scrollY + r.top - Math.max(80, (innerHeight - r.height) / 3), behavior: reduce ? "auto" : "smooth" });
    }
    place(); setTimeout(place, 420);
    if (window.vvrSparkle && target) { const r = target.getBoundingClientRect(); setTimeout(() => window.vvrSparkle(r.left + r.width / 2, Math.max(40, r.top + 30)), 380); }
    card.querySelector(".vt-next").focus({ preventScroll: true });
  }
  function end(done) {
    try { localStorage.setItem(KEY, done ? "visto" : "omitido"); } catch (e) {}
    removeEventListener("keydown", onKey); removeEventListener("resize", onResize); removeEventListener("scroll", onResize);
    els.card.style.opacity = "0"; els.spot.style.opacity = "0"; els.spot.style.transition = "opacity .3s";
    setTimeout(() => { els.shade.remove(); els.spot.remove(); els.card.remove(); els = null; }, 320);
    if (done && window.vvrSparkle) window.vvrSparkle(innerWidth / 2, innerHeight / 2);
  }
  function start() {
    if (els) return;
    const shade = document.createElement("div"); shade.id = "vt-shade";
    const spot = document.createElement("div"); spot.id = "vt-spot"; spot.className = "center";
    const card = document.createElement("div"); card.id = "vt-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-live", "polite"); card.setAttribute("aria-label", "Tutorial");
    card.innerHTML = `<div class="vt-top"><span class="vt-n"></span><button class="vt-skip" type="button">Omitir tutorial</button></div><h3></h3><p></p>
      <div class="vt-row"><span class="vt-dots">${STEPS.map(() => "<i></i>").join("")}</span><button class="vt-back" type="button">Atrás</button><button class="vt-next" type="button">Siguiente</button></div>`;
    document.body.append(shade, spot, card);
    els = { shade, spot, card };
    card.querySelector(".vt-skip").onclick = () => end(false);
    card.querySelector(".vt-back").onclick = () => show(i - 1);
    card.querySelector(".vt-next").onclick = () => i === STEPS.length - 1 ? end(true) : show(i + 1);
    shade.onclick = () => {};   // clicks outside do nothing: the card has the buttons
    onKey = e => { if (e.key === "Escape") end(false); else if (e.key === "ArrowRight") card.querySelector(".vt-next").click(); else if (e.key === "ArrowLeft" && i) show(i - 1); };
    onResize = () => els && place();
    addEventListener("keydown", onKey); addEventListener("resize", onResize); addEventListener("scroll", onResize, { passive: true });
    show(0);
  }
  const seen = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return true; } };
  window.vvrTutorial = { start, maybeStart: () => { if (!seen()) start(); } };
})();
