// Los 6 estilos visuales que el instructor elige para su curso (paso 9 de la entrevista). Un solo archivo de tokens para
// la página de venta, el manual y las imágenes del kit de marketing. La plataforma (catálogo, reproductor, panel, admin)
// siempre usa la identidad de Vórtice VR. Los ids están repetidos en THEMES de _cursos/estudio.js.
(function () {
  const T = {
    vortice: { name: "Vórtice", dark: true, head: "Sora", fonts: "Sora:wght@600;700",
      c: { bg: "#05020b", surface: "rgba(20,9,40,.72)", solid: "#120826", ink: "#f2ecff", mute: "#a99bcb", accent: "#ffbe55", accent2: "#8b3fd6", soft: "#d2b8ff", onAccent: "#1a0d00", line: "rgba(190,150,255,.18)", line2: "rgba(190,150,255,.42)" } },
    aurora: { name: "Aurora", dark: false, head: "Playfair Display", fonts: "Playfair+Display:wght@600;700",
      c: { bg: "#fbf7ef", surface: "#ffffff", solid: "#ffffff", ink: "#1d1a16", mute: "#6b645a", accent: "#0f8b8d", accent2: "#e3b23c", soft: "#0f6f71", onAccent: "#ffffff", line: "rgba(29,26,22,.1)", line2: "rgba(29,26,22,.22)" } },
    terracota: { name: "Terracota", dark: true, head: "Sora", fonts: "Sora:wght@600;700",
      c: { bg: "#24130d", surface: "rgba(64,34,23,.78)", solid: "#3a2016", ink: "#fbeee6", mute: "#d1b3a3", accent: "#e9a15b", accent2: "#c4623a", soft: "#f1c6ad", onAccent: "#2a1206", line: "rgba(241,198,173,.18)", line2: "rgba(241,198,173,.4)" } },
    oceano: { name: "Océano", dark: true, head: "Bebas Neue", fonts: "Bebas+Neue",
      c: { bg: "#04131f", surface: "rgba(10,40,60,.75)", solid: "#0a2536", ink: "#e8f6ff", mute: "#9bbfd4", accent: "#38d2e0", accent2: "#1b6ea8", soft: "#9fe3ff", onAccent: "#02202a", line: "rgba(159,227,255,.16)", line2: "rgba(159,227,255,.4)" } },
    bosque: { name: "Bosque", dark: false, head: "Playfair Display", fonts: "Playfair+Display:wght@600;700",
      c: { bg: "#f3f6ef", surface: "#ffffff", solid: "#ffffff", ink: "#18241a", mute: "#5d6b5f", accent: "#2f7d4f", accent2: "#c9a227", soft: "#24613d", onAccent: "#ffffff", line: "rgba(24,36,26,.1)", line2: "rgba(24,36,26,.24)" } },
    carmin: { name: "Carmín", dark: false, head: "Bebas Neue", fonts: "Bebas+Neue",
      c: { bg: "#ffffff", surface: "#f6f6f7", solid: "#f6f6f7", ink: "#111111", mute: "#55565c", accent: "#c8102e", accent2: "#111111", soft: "#9b0c23", onAccent: "#ffffff", line: "rgba(0,0,0,.1)", line2: "rgba(0,0,0,.25)" } },
  };
  // a course page in its style: CSS variables of cursos.css, its heading font, and the logo that suits the background
  function apply(id) {
    const t = T[id]; if (!t || id === "vortice") return T.vortice;
    const r = document.documentElement.style, c = t.c;
    const v = { "--void": c.bg, "--deep": c.bg, "--surface": c.surface, "--surface-solid": c.solid, "--ink": c.ink, "--mute": c.mute, "--sun": c.accent, "--vortex": c.accent2, "--lav": c.soft, "--line": c.line, "--line2": c.line2, "--on-sun": c.onAccent, "--fd": `"${t.head}",ui-sans-serif,system-ui,sans-serif` };
    for (const [k, x] of Object.entries(v)) r.setProperty(k, x);
    document.documentElement.classList.add("themed", t.dark ? "theme-dark" : "theme-light");
    document.documentElement.style.colorScheme = t.dark ? "dark" : "light";
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = `https://fonts.googleapis.com/css2?family=${t.fonts}&display=swap`; document.head.appendChild(l);
    if (!t.dark) document.querySelectorAll("img[data-logo]").forEach(i => { i.src = "/assets/logo-vorticevr.png"; });   // purple logo on light backgrounds (never recolored)
    return t;
  }
  window.VC_TEMAS = { list: T, apply };
})();
