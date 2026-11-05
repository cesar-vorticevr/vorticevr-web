// Compartido por las páginas de /cursos/: sesión (la misma de vorticevr.mx, localStorage "vvr-sesion"), API,
// encabezado, Markdown seguro (todo se escapa antes de dar formato) y videos incrustados (YouTube, Vimeo, Bunny).
// Las rutas son absolutas: las páginas viven a distintas profundidades (/cursos/<curso>/, /cursos/aprender/<curso>/).
(function () {
  const KEY = "vvr-sesion";
  const session = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); return s && s.token ? s : null; } catch (e) { return null; } };
  async function call(path, opt = {}) {
    const headers = {}, s = session();
    if (s) headers.Authorization = "Bearer " + s.token;
    if (opt.json !== undefined) headers["Content-Type"] = "application/json";
    const r = await fetch("/api/cursos/" + path, { method: opt.method || (opt.json !== undefined ? "POST" : "GET"), headers, body: opt.json !== undefined ? JSON.stringify(opt.json) : undefined });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (r.status === 401 && s) { try { localStorage.removeItem(KEY); } catch (e) {} }
    if (!r.ok) { const err = new Error(j.error || "Algo salió mal. Intenta de nuevo."); err.status = r.status; err.data = j; throw err; }
    return j;
  }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const loginUrl = next => "/cuenta/?siguiente=" + encodeURIComponent(next).replace(/%2F/g, "/") + "#entrar";

  // Markdown: headings, lists, quotes, bold, italics, code and http(s) links
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
  }
  function md(src) {
    const lines = String(src || "").replace(/\r/g, "").split("\n"), out = [];
    let list = null, para = [], quote = [];
    const flushP = () => { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } };
    const flushL = () => { if (list) { out.push(`<${list.t}>` + list.items.map(i => "<li>" + inline(i) + "</li>").join("") + `</${list.t}>`); list = null; } };
    const flushQ = () => { if (quote.length) { out.push("<blockquote><p>" + inline(quote.join(" ")) + "</p></blockquote>"); quote = []; } };
    const flush = () => { flushP(); flushL(); flushQ(); };
    for (const raw of lines) {
      const l = raw.trim();
      let m;
      if (!l) { flush(); continue; }
      if ((m = l.match(/^(#{1,3})\s+(.*)$/))) { flush(); const n = Math.min(4, m[1].length + 1); out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
      if ((m = l.match(/^>\s?(.*)$/))) { flushP(); flushL(); quote.push(m[1]); continue; }
      if ((m = l.match(/^[-*]\s+(.*)$/)) || (m = l.match(/^\d+[.)]\s+(.*)$/))) {
        const t = /^\d/.test(l) ? "ol" : "ul"; flushP(); flushQ();
        if (!list || list.t !== t) { flushL(); list = { t, items: [] }; }
        list.items.push(m[1]); continue;
      }
      if (list && /^\s{2,}/.test(raw)) { list.items[list.items.length - 1] += " " + l; continue; }
      flushL(); flushQ(); para.push(l);
    }
    flush();
    return out.join("");
  }

  // a video link → an embedded player (YouTube, Vimeo, Bunny Stream); anything else → null
  function embed(url) {
    let u; try { u = new URL(String(url || "")); } catch (e) { return null; }
    let m, src = null;
    if (/(^|\.)youtube\.com$/.test(u.hostname) && (m = u.searchParams.get("v"))) src = "https://www.youtube-nocookie.com/embed/" + m;
    else if (/(^|\.)youtube\.com$/.test(u.hostname) && (m = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/))) src = "https://www.youtube-nocookie.com/embed/" + m[1];
    else if (u.hostname === "youtu.be" && (m = u.pathname.match(/^\/([\w-]{6,})/))) src = "https://www.youtube-nocookie.com/embed/" + m[1];
    else if (/(^|\.)vimeo\.com$/.test(u.hostname) && (m = u.pathname.match(/(\d{6,})(?:\/([\da-f]+))?/))) src = "https://player.vimeo.com/video/" + m[1] + (m[2] ? "?h=" + m[2] : "");
    else if (/^(iframe|player)\.mediadelivery\.net$/.test(u.hostname) && (m = u.pathname.match(/^\/(?:embed|play)\/(\d+)\/([\w-]+)/))) src = `https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}`;
    return src ? `<div class="video"><iframe src="${esc(src)}" title="Video de la lección" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen loading="lazy"></iframe></div>` : null;
  }

  const money = c => !c ? "Gratis" : "$" + (c / 100).toLocaleString("es-MX", { maximumFractionDigits: 2 }) + " MXN";
  const MODALITY = { recorded: "Grabado", live: "En vivo", mixed: "Mixto" };
  const hours = h => h ? `${String(h).replace(/\.0$/, "")} ${Number(h) === 1 ? "hora" : "horas"}` : "";

  function header(active) {
    const el = document.querySelector("header.top"); if (!el) return;
    const s = session();
    el.innerHTML = `<div class="wrap"><a class="brand" href="/cursos/" aria-label="Cursos Vórtice VR"><img src="/assets/logo-vorticevr-blanco.png" alt="Vórtice VR" data-logo><span>Cursos</span></a>
      <nav><a href="/cursos/" class="${active === "catalogo" ? "on" : ""}">Catálogo</a><a href="/cursos/mi-aprendizaje/" class="${active === "mis" ? "on" : ""}">Mi aprendizaje</a><a href="/cursos/instructor/" class="hide-sm ${active === "instructor" ? "on" : ""}">Dar cursos</a>
      ${s ? `<a class="pill hide-sm" href="/cuenta/">${esc((s.user && s.user.name || "Mi cuenta").split(" ")[0])}</a>` : `<a class="pill" href="${loginUrl(location.pathname.replace(/^\/|\/$/g, ""))}">Entrar</a>`}</nav></div>`;
  }
  function footer() {
    const el = document.querySelector("footer.bot"); if (!el) return;
    el.innerHTML = `<div class="wrap"><span>© ${new Date().getFullYear()} Vórtice VR · Cursos con aval de Vórtice VR</span><span><a href="/">vorticevr.mx</a> · <a href="/privacidad/">Privacidad</a> · <a href="/terminos/">Términos</a></span></div>`;
  }
  function toast(t, ms = 3200) {
    const d = document.createElement("div"); d.className = "toast"; d.setAttribute("role", "status"); d.textContent = t; document.body.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }
  // the name in the address: /cursos/<x>/ or /cursos/aprender/<x>/ → x
  const slugFromPath = () => decodeURIComponent(location.pathname.replace(/\/+$/, "").split("/").pop() || "");

  window.VC = { session, call, esc, md, inline, embed, money, MODALITY, hours, header, footer, toast, loginUrl, slugFromPath };
})();
