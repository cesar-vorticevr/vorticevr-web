// Where a visitor came from (shown per source in /admin/ → Resumen): utm_* of an ad or post, an ad click id, a referral
// code, a search engine or social network, or an experience (nombre.vorticevr.mx or /e/nombre/). Kept 60 days in this
// browser (vvr-origen) and sent once with the sign-up. A new outside source replaces the saved one; moving inside the
// site or coming back directly keeps it. Nothing goes to third parties.
(function () {
  const K = "vvr-origen", DAYS = 60, cut = s => String(s || "").trim().toLowerCase().replace(/[^\w.\-:/ áéíóúñü]/g, "").slice(0, 60);
  let saved = null; try { saved = JSON.parse(localStorage.getItem(K) || "null"); } catch (e) {}
  if (saved && !(Date.now() - saved.t < DAYS * 864e5)) saved = null;
  const q = new URLSearchParams(location.search);
  const NETS = [[/(^|\.)google\./, "google", "organico"], [/(^|\.)bing\.com$/, "bing", "organico"], [/duckduckgo\.com$/, "duckduckgo", "organico"], [/(^|\.)yahoo\./, "yahoo", "organico"],
    [/(^|\.)facebook\.com$|^fb\.me$/, "facebook", "social"], [/(^|\.)instagram\.com$/, "instagram", "social"], [/(^|\.)tiktok\.com$/, "tiktok", "social"],
    [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube", "social"], [/^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, "x", "social"], [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin", "social"],
    [/whatsapp\.com$|^wa\.me$/, "whatsapp", "social"], [/(^|\.)pinterest\./, "pinterest", "social"], [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$|(^|\.)perplexity\.ai$|(^|\.)claude\.ai$/, "ia", "referido"]];
  function now() {
    if (q.get("utm_source")) return { src: q.get("utm_source"), med: q.get("utm_medium"), camp: q.get("utm_campaign") };
    if (q.get("gclid")) return { src: "google", med: "anuncio" };
    if (q.get("fbclid")) return { src: "facebook", med: q.get("utm_medium") || "social" };
    if (q.get("ttclid")) return { src: "tiktok", med: "anuncio" };
    if (q.get("ref")) return { src: "recomendado", med: "codigo", camp: q.get("ref") };
    let r = null; try { r = document.referrer ? new URL(document.referrer) : null; } catch (e) {}
    if (!r) return null;
    const h = r.hostname.replace(/^www\./, ""), sub = h.match(/^([a-z0-9-]+)\.vorticevr\.mx$/);
    if (sub && sub[1] !== "t") return { src: "experiencia", med: "viral", camp: sub[1] };   // someone saw an experience and came to make theirs
    if (r.origin === location.origin || h === "vorticevr.mx") { const e = r.pathname.match(/^\/e\/([a-z0-9-]+)/); return e ? { src: "experiencia", med: "viral", camp: e[1] } : null; }
    const n = NETS.find(([re]) => re.test(h));
    return n ? { src: n[1], med: n[2] } : { src: h, med: "referido" };
  }
  const o = now();
  if (o) {
    saved = { src: cut(o.src), med: cut(o.med), camp: cut(o.camp), land: cut(location.pathname), t: Date.now() };
    try { localStorage.setItem(K, JSON.stringify(saved)); } catch (e) {}
  }
  window.vvrOrigen = () => saved || { src: "directo", land: cut(location.pathname), t: Date.now() };
})();
