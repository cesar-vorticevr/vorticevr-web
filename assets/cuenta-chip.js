// Header account button on the public pages (home, /educacion/): "Iniciar sesión" for visitors, "Mi cuenta" with the
// initial when there is a session (vvr-sesion, saved by /cuenta/). With a session, "Crear gratis" links go straight to /crear/.
(function () {
  const a = document.getElementById("acct"); if (!a) return;
  let s = null; try { s = JSON.parse(localStorage.getItem("vvr-sesion") || "null"); } catch (e) {}
  if (!s || !s.token) return;
  const base = a.getAttribute("href").replace(/cuenta\/.*$/, "");
  const name = String((s.user && (s.user.name || s.user.email)) || "?").trim();
  const ini = name.charAt(0).toUpperCase().replace(/[<>&"]/g, "") || "·";
  const first = name.split(/[\s@]/)[0].replace(/[<>&"]/g, "").slice(0, 14);
  a.href = base + "cuenta/"; a.classList.add("in"); a.title = name;
  a.dataset.es = `<span class="av">${ini}</span><span class="nm">Mi cuenta</span>`;
  a.dataset.en = `<span class="av">${ini}</span><span class="nm">My account</span>`;
  a.setAttribute("aria-label", "Mi cuenta: " + first);
  a.innerHTML = window.vvrLang && vvrLang() === "en" ? a.dataset.en : a.dataset.es;
  document.querySelectorAll('a[href*="cuenta/?siguiente=crear"]').forEach(l => { l.href = base + "crear/"; });
})();
