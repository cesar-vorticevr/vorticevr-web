// Public experiences as posters, shared by the home page (#explora), /explora/ and the portals (/@nombre).
// VVRExplora.render(el, list, { by, append }) draws one card per experience: its own poster (assets/poster.js) in small,
// drawn when the card comes into view, one at a time. Tapping a card opens the poster big, and from there: open the
// experience, download the PDF or the image, share it or report it. Needs qrcode-generator and assets/poster.js on the page,
// and the three import map (with three/addons/) for the 3D of "superficie" (assets/poster-3d.js).
// Class names start with xv- so the pages' own styles (.btn, .ac, dialog…) do not reach them.
// ♥: anyone sees how many hearts each one has; only an account gives one (POST /api/like/<slug>, the session of vvr-sesion).
// Without a session, tapping the heart invites to sign in and comes back to this page.
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
  const nf = n => Number(n || 0).toLocaleString("es-MX");
  const token = () => { try { const s = JSON.parse(localStorage.getItem("vvr-sesion") || "null"); return s && s.token; } catch (e) { return null; } };
  // profile photo, or a generic one (a silhouette on a gradient picked from the name; never an emoji)
  const HUES = [[139, 63, 214], [214, 63, 160], [63, 120, 214], [36, 160, 130], [214, 120, 40], [110, 63, 214]];
  function avatar(url, name, size = 40) {
    if (url) return `<img class="xv-av" src="${esc(url)}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px" loading="lazy">`;
    let h = 0; for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const [r, g, b] = HUES[h % HUES.length], id = "g" + h.toString(36);
    return `<svg class="xv-av" viewBox="0 0 40 40" width="${size}" height="${size}" style="width:${size}px;height:${size}px" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgb(${r},${g},${b})"/><stop offset="1" stop-color="#1b0a36"/></linearGradient></defs><rect width="40" height="40" rx="20" fill="url(#${id})"/><circle cx="20" cy="16" r="7" fill="#f4eeff" opacity=".92"/><path d="M6.5 36c1.8-7.6 7.2-11.4 13.5-11.4S31.7 28.4 33.5 36A20 20 0 0 1 6.5 36z" fill="#f4eeff" opacity=".92"/></svg>`;
  }
  const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8.1 3 4.5 6.6 4.2c2.1-.2 3.9.9 5.4 2.9 1.5-2 3.3-3.1 5.4-2.9 3.6.3 5.7 3.9 4.2 7.4C19.5 16.4 12 21 12 21z"/></svg>`;

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
.xv-row2{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.xv-by{display:flex;align-items:center;gap:7px;min-width:0}.xv-by a{min-width:0}
.xv-av{flex:none;border-radius:50%;object-fit:cover;display:block;background:#1b0a36}
.xv-like{all:unset;box-sizing:border-box;position:relative;flex:none;display:inline-flex;align-items:center;gap:5px;cursor:pointer;font:600 13px/1 "IBM Plex Sans",sans-serif;color:#b3a4d2;padding:6px 9px;border-radius:999px;transition:color .2s,background .2s}
.xv-like:hover{background:rgba(255,77,125,.12);color:#ffd0dc}.xv-like:focus-visible{outline:2px solid #ff4d7d;outline-offset:2px}
.xv-like svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;overflow:visible;transition:transform .2s}
.xv-like.on{color:#ff4d7d}.xv-like.on svg{fill:#ff4d7d;stroke:#ff4d7d;filter:drop-shadow(0 0 6px rgba(255,77,125,.7))}
.xv-like.pop svg{animation:xv-pop .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes xv-pop{0%{transform:scale(.4)}45%{transform:scale(1.45)}100%{transform:scale(1)}}
.xv-like i{position:absolute;left:18px;top:50%;width:7px;height:7px;margin:-3.5px;border-radius:50%;pointer-events:none;animation:xv-bit .7s ease-out forwards}
@keyframes xv-bit{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--x),var(--y)) scale(0);opacity:0}}
.xv-like .xv-ring{position:absolute;left:18px;top:50%;width:40px;height:40px;margin:-20px;border-radius:50%;border:3px solid #ff4d7d;pointer-events:none;animation:xv-ring .55s ease-out forwards}
@keyframes xv-ring{0%{transform:scale(.2);opacity:1}100%{transform:scale(1.4);opacity:0}}
.xv-big .xv-heart{position:absolute;left:50%;top:50%;width:38%;margin-left:-19%;margin-top:-19%;fill:#ff4d7d;filter:drop-shadow(0 8px 30px rgba(255,77,125,.8));pointer-events:none;animation:xv-bigheart .9s ease forwards}
@keyframes xv-bigheart{0%{transform:scale(0);opacity:0}25%{transform:scale(1.15);opacity:1}55%{transform:scale(.95)}100%{transform:scale(1.1);opacity:0}}
.xv-pv .xv-like{font-size:15px;padding:10px 14px;border:1px solid rgba(255,77,125,.35);width:max-content}.xv-pv .xv-like svg{width:24px;height:24px}
.xv-pv .xv-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.xv-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 32px);box-sizing:border-box;padding:14px 18px;border-radius:16px;background:#1b0a36;border:1px solid rgba(255,77,125,.45);box-shadow:0 20px 50px -10px rgba(0,0,0,.9);color:#f4eeff;font:500 14px/1.4 "IBM Plex Sans",sans-serif;animation:xv-in .25s ease both}
.xv-toast a{color:#1b0f00;background:linear-gradient(135deg,#ffe0a0,#ffbe55);text-decoration:none;font:600 12px Sora,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:9px 14px;border-radius:999px}
.xv-toast a.alt{background:none;color:#d2b8ff;border:1px solid rgba(210,184,255,.4)}
@media (prefers-reduced-motion:reduce){.xv-po,.xv-po canvas{transition:none;animation:none}.xv-po .xv-sh{animation:none}.xv-like.pop svg,.xv-like i,.xv-like .xv-ring,.xv-big .xv-heart{animation:none;display:none}}
` }));

  // ---- the posters: experience data (cached), drawn one at a time on one big canvas, kept in small
  const data = new Map(), thumbs = new Map();
  const expOf = x => data.get(x.slug) || data.set(x.slug, api(`/api/exp/${x.slug}?sin_vista=1`).then(e => { e.url = x.url; e.updated = e.updated || x.updated; return e; })).get(x.slug);
  const drawBig = async (cv, x) => VVRPoster.draw(cv, await expOf(x), { api: location.origin, base, plan: { brand: true }, by: x.by && x.by.handle });   // the API already drops a brand's logo its plan does not include
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
      <div class="xv-cap"><b title="${esc(x.title)}">${esc(x.title)}</b><div class="xv-row2">${o.by !== false && x.by ? `<span class="xv-by">${avatar(x.by.avatar, x.by.handle, 22)}<a href="/@${esc(x.by.handle)}">@${esc(x.by.handle)}</a></span>` : `<span>${K[0]} ${esc(K[1])}</span>`}${likeBtn(x)}</div></div>`;
    wireLike(el.querySelector(".xv-like"), x);
    const po = el.querySelector(".xv-po");
    po._load = () => thumb(x).then(t => { po.classList.remove("white"); po.replaceChildren(t); }).catch(() => { const s = po.querySelector(".xv-sh"); if (s) s.remove(); });
    if (seen) seen.observe(po); else po._load();
    po.onclick = () => open(x, o);
    return el;
  }
  function render(el, list, o = {}) {
    const grid = el.classList.contains("xgrid") ? el : (el.querySelector(".xgrid") || el.appendChild(Object.assign(document.createElement("div"), { className: "xgrid" })));
    if (!o.append) grid.replaceChildren();
    for (const x of list) { if (!likes.has(x.slug)) likes.set(x.slug, { n: x.likes || 0, on: false }); grid.appendChild(card(x, o)); }
    mine(list.map(x => x.slug));
  }

  // ---- ♥: one state per experience, shared by its card and the big poster
  const likes = new Map();
  const likeBtn = x => `<button class="xv-like" type="button" data-like="${esc(x.slug)}" aria-pressed="false" aria-label="Darle corazón a ${esc(x.title)}">${HEART}<span>${nf((likes.get(x.slug) || {}).n)}</span></button>`;
  function paint(slug) {
    const L = likes.get(slug) || { n: 0, on: false };
    document.querySelectorAll(`.xv-like[data-like="${CSS.escape(slug)}"]`).forEach(b => {
      b.classList.toggle("on", L.on); b.setAttribute("aria-pressed", String(L.on)); b.querySelector("span").textContent = nf(L.n);
      b.title = L.on ? "Ya le diste corazón (toca para quitarlo)" : "Darle corazón";
    });
  }
  async function mine(slugs) {   // which ones already have my heart (Explora is cached for everyone)
    const t = token(); if (!t || !slugs.length) return;
    for (let i = 0; i < slugs.length; i += 100) {
      try {
        const r = await fetch("/api/likes?s=" + slugs.slice(i, i + 100).join(","), { headers: { Authorization: "Bearer " + t } }).then(r => r.json());
        for (const s of r.liked || []) { const L = likes.get(s); if (L) { L.on = true; paint(s); } }
      } catch (e) {}
    }
  }
  function burst(b) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
    const ring = document.createElement("span"); ring.className = "xv-ring"; b.appendChild(ring);
    const cols = ["#ff4d7d", "#ffbe55", "#d2b8ff", "#ff8fb1"];
    for (let i = 0; i < 12; i++) {
      const p = document.createElement("i"), a = i / 12 * Math.PI * 2, d = 22 + Math.random() * 18;
      p.style.cssText = `--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px;background:${cols[i % 4]}`; b.appendChild(p);
    }
    setTimeout(() => b.querySelectorAll("i,.xv-ring").forEach(n => n.remove()), 800);
  }
  function wireLike(b, x) {
    if (!b) return;
    paint(x.slug);
    b.onclick = async e => {
      e.preventDefault(); e.stopPropagation();
      if (!token()) return askLogin();
      const L = likes.get(x.slug), want = !L.on;
      L.on = want; L.n = Math.max(0, L.n + (want ? 1 : -1)); paint(x.slug);   // at once; the server confirms
      if (want) { document.querySelectorAll(`.xv-like[data-like="${CSS.escape(x.slug)}"]`).forEach(burst); if (pv && pv.open && pv._slug === x.slug) bigHeart(); }
      try {
        const r = await fetch(`/api/like/${x.slug}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() }, body: JSON.stringify({ on: want }) });
        const j = await r.json().catch(() => ({}));
        if (r.status === 401) { try { localStorage.removeItem("vvr-sesion"); } catch (err) {} L.on = !want; L.n = Math.max(0, L.n + (want ? -1 : 1)); paint(x.slug); return askLogin(); }
        if (!r.ok) throw new Error(j.error);
        L.on = j.liked; L.n = j.likes; paint(x.slug);
      } catch (err) { L.on = !want; L.n = Math.max(0, L.n + (want ? -1 : 1)); paint(x.slug); }
    };
  }
  function bigHeart() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = pv.querySelector(".xv-big"), h = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    h.setAttribute("viewBox", "0 0 24 24"); h.classList.add("xv-heart"); h.innerHTML = HEART.replace(/^<svg[^>]*>|<\/svg>$/g, "");
    box.appendChild(h); setTimeout(() => h.remove(), 950);
  }
  let toast;
  function askLogin() {
    const back = location.pathname.replace(/^\/+|\/+$/g, "") || "inicio";
    const q = /^(explora|@[a-z0-9_-]{3,24})$/i.test(back) ? back : "inicio";
    if (toast) toast.remove();
    toast = document.createElement("div"); toast.className = "xv-toast"; toast.setAttribute("role", "status");
    toast.innerHTML = `<span>Para darle corazón necesitas tu cuenta (es gratis).</span><a href="/cuenta/?siguiente=${encodeURIComponent(q)}#registro">Crear cuenta</a><a class="alt" href="/cuenta/?siguiente=${encodeURIComponent(q)}#entrar">Entrar</a>`;
    (pv && pv.open ? pv : document.body).appendChild(toast);
    clearTimeout(askLogin.t); askLogin.t = setTimeout(() => toast && toast.remove(), 6000);
  }

  // ---- the poster, big: open the experience, download, share, report
  let pv;
  async function open(x, o) {
    if (!pv) {
      pv = document.createElement("dialog"); pv.className = "xv-pv";
      pv.innerHTML = `<button class="xv-x" type="button" aria-label="Cerrar">×</button><div class="xv-in"><div class="xv-big"><canvas></canvas><span class="xv-wait">Preparando el póster…</span></div>
        <div class="xv-side"><h2></h2><div class="xv-meta"></div><div class="xv-likebox"></div><a class="xv-b go" target="_blank" rel="noopener">Abrir experiencia</a>
        <button class="xv-b" type="button" data-a="pdf">Descargar PDF</button><button class="xv-b" type="button" data-a="png">Descargar imagen</button><button class="xv-b" type="button" data-a="share">Compartir</button>
        <p class="xv-note">Tamaño carta, listo para imprimir: quien escanee el QR abre la experiencia.</p><button class="xv-rep" type="button">⚑ Reportar esta experiencia</button></div></div>`;
      document.body.appendChild(pv);
      pv.querySelector(".xv-x").onclick = () => pv.close();
      pv.addEventListener("click", e => { if (e.target === pv) pv.close(); });   // tap outside
    }
    const run = (pv._run = (pv._run || 0) + 1), K = KINDS[x.kind] || KINDS.ra, cv = pv.querySelector("canvas"), wait = pv.querySelector(".xv-wait");
    const btns = [...pv.querySelectorAll("[data-a=pdf],[data-a=png]")];
    pv.querySelector("h2").textContent = x.title;
    pv._slug = x.slug;
    pv.querySelector(".xv-meta").innerHTML = `${o.by !== false && x.by ? `<span class="xv-by">${avatar(x.by.avatar, x.by.handle, 28)}<a href="/@${esc(x.by.handle)}">@${esc(x.by.handle)}</a></span> · ` : ""}${K[0]} ${esc(K[1])}`;
    const lk = pv.querySelector(".xv-likebox"); lk.innerHTML = likeBtn(x); wireLike(lk.firstChild, x);
    pv.querySelector(".go").href = x.url;
    btns.forEach(b => b.setAttribute("aria-disabled", "true")); wait.hidden = false;
    const ctx = cv.getContext("2d"); cv.width = TW; cv.height = TH; ctx.clearRect(0, 0, TW, TH);
    thumb(x).then(t => { if (pv._run === run && wait.hidden === false) ctx.drawImage(t, 0, 0); }).catch(() => {});   // the small one first
    const file = `poster-${x.by ? x.by.handle + "-" : ""}${x.slug}`;   // the artist's name goes in the file too
    pv.querySelector("[data-a=pdf]").onclick = () => VVRPoster.pdf(cv, file + ".pdf");
    pv.querySelector("[data-a=png]").onclick = () => VVRPoster.png(cv, file + ".png");
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

  window.VVRExplora = { KINDS, render, kinds, avatar, load: (q = "") => api("/api/explora" + q) };
})();
