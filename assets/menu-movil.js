// Menú del celular: agrega un botón ☰ al encabezado (header.top nav) cuando las
// secciones se esconden por falta de espacio. Muestra las secciones de la página
// y las principales del sitio. Sin dependencias; los estilos van aquí mismo.
(() => {
  const nav = document.querySelector('header.top nav');
  if (!nav || nav.querySelector('.mnu')) return;
  const brand = document.querySelector('header.top .brand');
  const root = new URL(brand ? brand.getAttribute('href') || './' : './', location.href);
  const SITE = [
    ['', 'Inicio', 'Home'],
    ['explora/', 'Explora', 'Explore'],
    ['galerias/', 'Galerías', 'Galleries'],
    ['educacion/', 'Educación', 'Education'],
    ['talleres/', 'Talleres para escuelas', 'School workshops'],
    ['#contacto', 'Contacto', 'Contact'],
  ];

  const css = document.createElement('style');
  css.textContent = `
.mnu{display:none;align-items:center;justify-content:center;width:38px;height:38px;flex:none;border-radius:999px;border:1px solid var(--line2,rgba(210,184,255,.25));background:transparent;color:var(--ink,#f3ecff);cursor:pointer;padding:0}
.mnu i,.mnu i::before,.mnu i::after{display:block;width:16px;height:2px;border-radius:2px;background:currentColor;transition:transform .3s,opacity .3s;content:"";position:relative}
.mnu i::before{position:absolute;top:-5px}.mnu i::after{position:absolute;top:5px}
.mnu[aria-expanded="true"] i{background:transparent}
.mnu[aria-expanded="true"] i::before{transform:translateY(5px) rotate(45deg)}
.mnu[aria-expanded="true"] i::after{transform:translateY(-5px) rotate(-45deg)}
@media (max-width:980px){.mnu{display:inline-flex}}
@media (max-width:480px){.mnu{width:34px;height:34px}}
.mnupanel{position:fixed;left:12px;right:12px;z-index:19;padding:10px;border-radius:20px;background:rgba(12,6,26,.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--line2,rgba(210,184,255,.25));box-shadow:0 24px 60px rgba(0,0,0,.55);opacity:0;transform:translateY(-8px);pointer-events:none;transition:opacity .25s,transform .25s;max-height:calc(100vh - 100px);overflow:auto}
.mnupanel.on{opacity:1;transform:none;pointer-events:auto}
.mnupanel a{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-radius:12px;color:var(--ink,#f3ecff);text-decoration:none;font:600 .86rem var(--fd,'Sora',sans-serif);letter-spacing:.12em;text-transform:uppercase}
.mnupanel a::after{content:"→";color:var(--sun,#ffbe55)}
.mnupanel a:hover,.mnupanel a:focus-visible{background:rgba(139,63,214,.22)}
.mnupanel hr{border:0;border-top:1px solid var(--line,rgba(210,184,255,.14));margin:6px 10px}
@media (prefers-reduced-motion:reduce){.mnupanel,.mnu i::before,.mnu i::after{transition:none}}`;
  document.head.appendChild(css);

  const en = () => document.documentElement.lang === 'en';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mnu';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'mnupanel');
  btn.innerHTML = '<i></i>';
  nav.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'mnupanel';
  panel.className = 'mnupanel';
  document.body.appendChild(panel);

  const clean = (u) => u.replace(/#$/, '').replace(/index\.html$/, '');
  const build = () => {
    panel.innerHTML = '';
    const seen = new Set();
    const add = (href, text) => {
      const key = clean(new URL(href, location.href).href);
      if (seen.has(key) || !text.trim()) return;
      seen.add(key);
      const a = document.createElement('a');
      a.href = href;
      a.textContent = text.trim();
      panel.appendChild(a);
    };
    nav.querySelectorAll('a:not(.pill)').forEach((a) => add(a.href, a.textContent));
    const n = panel.children.length;
    SITE.forEach(([p, es, enT]) => add(new URL(p, root).href, en() ? enT : es));
    if (n && panel.children.length > n) panel.insertBefore(document.createElement('hr'), panel.children[n]);
  };
  const place = () => {
    const h = document.querySelector('header.top');
    panel.style.top = (h ? h.getBoundingClientRect().bottom : 64) + 6 + 'px';
  };
  const set = (on) => {
    if (on) { build(); place(); }
    panel.classList.toggle('on', on);
    btn.setAttribute('aria-expanded', String(on));
    btn.setAttribute('aria-label', on ? (en() ? 'Close menu' : 'Cerrar menú') : (en() ? 'Open menu' : 'Abrir menú'));
  };
  set(false);
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(!panel.classList.contains('on')); });
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('click', (e) => { if (panel.classList.contains('on') && !panel.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  addEventListener('resize', () => { if (panel.classList.contains('on')) place(); });
})();
