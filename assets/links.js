// Página de links, como Linktree (data.kind = "links"). La usan el visor (/x/) y la vista previa del creador (/crear/links/).
//  - run({root, cfg, src, brand, url, vcard, onClick, embedded}) dibuja la página dentro de root (que tiene su propio scroll):
//    foto, nombre, texto corto, "Guardar contacto" (vCard), íconos de redes y la lista de botones (links o títulos de sección,
//    con imagen opcional; los que llevan "hi" se mueven para llamar la atención). Abajo, el logo de Vórtice VR o el de la marca.
//  - onClick(id) se llama al tocar un botón (id del botón, la red social o "vcard"); el visor lo cuenta con sendBeacon.
//  - detect(url) adivina la red de un link (para ponerle su ícono).
// cfg = { title, links: {bio, list, social, contact, theme, font, btn, shape, color, avatar, bg, share} }. src(id) = URL de una imagen.

export const ICONS = {
  whatsapp: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1 2.6 11.4 11.4 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/>',
  instagram: '<path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6zm9.7 1.5a1.3 1.3 0 1 1 0 2.5 1.3 1.3 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>',
  tiktok: '<path d="M16.6 3c.4 2.2 1.8 3.7 4 3.9v3a7.4 7.4 0 0 1-4-1.3v6.2A5.8 5.8 0 1 1 10.8 9v3.1a2.8 2.8 0 1 0 2.8 2.8V3h3z"/>',
  facebook: '<path d="M20 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8.6v-7.7H10v-3h2.6V9c0-2.6 1.6-4 3.9-4 1.1 0 2.1.1 2.3.1v2.7h-1.6c-1.3 0-1.5.6-1.5 1.5v1.9h3l-.4 3h-2.6V22H20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>',
  youtube: '<path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3-5.2 3z"/>',
  x: '<path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/>',
  linkedin: '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zm6 0h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21H9z"/>',
  threads: '<path d="M12 2a10 10 0 1 0 5.3 18.5l-1-1.7A8 8 0 1 1 20 12v1a2 2 0 0 1-4 0V8h-2v.8A4.5 4.5 0 1 0 15.3 15 4 4 0 0 0 22 13v-1A10 10 0 0 0 12 2zm0 12.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>',
  telegram: '<path d="M21.9 4.3 18.8 19c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.8-7.9c.4-.3-.1-.5-.6-.2L6.7 13l-4.6-1.5c-1-.3-1-1 .2-1.5L20.5 3c.8-.3 1.6.2 1.4 1.3z"/>',
  pinterest: '<path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.5 2.1-.8 3.3-.2 1 .5 1.8 1.5 1.8 1.8 0 3.1-1.9 3.1-4.6 0-2.4-1.7-4.1-4.2-4.1-2.9 0-4.5 2.1-4.5 4.4 0 .9.3 1.8.8 2.3.1.1.1.2.1.3l-.3 1.2c0 .2-.2.2-.4.1-1.3-.6-2.1-2.5-2.1-4 0-3.3 2.4-6.3 6.9-6.3 3.6 0 6.4 2.6 6.4 6 0 3.6-2.3 6.5-5.4 6.5-1.1 0-2.1-.6-2.4-1.2l-.7 2.5c-.2.9-.9 2.1-1.3 2.8A10 10 0 1 0 12 2z"/>',
  twitch: '<path d="M4 2 2.5 6v14h5v3h3l3-3h4l5-5V2zm16 12-3 3h-4.5l-3 3v-3H5.5V4H20zM15 7.5h2v5h-2zm-5 0h2v5h-2z"/>',
  snapchat: '<path d="M12 2c3 0 5.3 2.3 5.3 5.3v2.3l1.6-.5c.6-.2 1.2.5.8 1-.4.5-1.6 1-2.2 1.2.4 1.5 2 3.3 4 3.8.4.1.5.6.1.8-.8.5-2 .6-2.4.8-.2.4-.1 1.1-.5 1.3-.6.2-1.8-.3-3 .1-1 .3-2 1.9-3.7 1.9s-2.7-1.6-3.7-1.9c-1.2-.4-2.4.1-3-.1-.4-.2-.3-.9-.5-1.3-.4-.2-1.6-.3-2.4-.8-.4-.2-.3-.7.1-.8 2-.5 3.6-2.3 4-3.8-.6-.2-1.8-.7-2.2-1.2-.4-.5.2-1.2.8-1l1.6.5V7.3C6.7 4.3 9 2 12 2z"/>',
  spotify: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.6.6 0 0 1-.9.2c-2.4-1.5-5.4-1.8-9-1a.6.6 0 1 1-.3-1.2c3.9-.9 7.2-.5 9.9 1.1.3.2.4.6.3.9zm1.2-2.7a.8.8 0 0 1-1.1.3c-2.7-1.7-6.9-2.2-10.1-1.2a.8.8 0 1 1-.5-1.5c3.7-1.1 8.3-.6 11.4 1.3.4.2.5.7.3 1.1zm.1-2.8C14.7 9 9.4 8.8 6.3 9.7a1 1 0 1 1-.6-1.8c3.5-1.1 9.4-.9 13.1 1.3a1 1 0 0 1-.9 1.7z"/>',
  web: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7.9 9h-3a15.6 15.6 0 0 0-1.3-5.5A8 8 0 0 1 19.9 11zM12 4c.9 1.1 1.8 3.6 2 7h-4c.2-3.4 1.1-5.9 2-7zM4.1 13h3c.1 2 .6 3.9 1.3 5.5A8 8 0 0 1 4.1 13zm3-2h-3a8 8 0 0 1 4.3-5.5A15.6 15.6 0 0 0 7.1 11zM12 20c-.9-1.1-1.8-3.6-2-7h4c-.2 3.4-1.1 5.9-2 7zm3.6-1.5c.7-1.6 1.2-3.5 1.3-5.5h3a8 8 0 0 1-4.3 5.5z"/>',
  email: '<path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm2.2 0L12 11.5 19.8 6zM20 8.1l-8 5.6-8-5.6V18h16z"/>',
  phone: '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.6 3.6a1 1 0 0 1-.25 1z"/>',
  maps: '<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>',
  link: '<path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.2-3.2a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0zM8.5 19.5a4 4 0 0 1-2.9-6.8l2.5-2.5a1 1 0 1 1 1.4 1.4L7 14.1a2 2 0 0 0 2.9 2.9l2.5-2.5a1 1 0 1 1 1.4 1.4l-2.5 2.5a4 4 0 0 1-2.8 1.1zm7-5.3a1 1 0 0 1-.7-1.7l2.5-2.5A2 2 0 0 0 14.4 7l-2.5 2.5a1 1 0 0 1-1.4-1.4L13 5.6a4 4 0 0 1 5.7 5.7l-2.5 2.5a1 1 0 0 1-.7.4z"/>',
  share: '<path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7a3 3 0 0 0 .1.8L8.4 11.2a3 3 0 1 0 0 1.6l6.7 3.4A3 3 0 1 0 18 16z"/>',
  contact: '<path d="M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-7 1.7-7 4v2h14v-2c0-2.3-3.7-4-7-4zm9-6V6h-2v2h-2v2h2v2h2v-2h2V8z"/>',
};
// social networks, in the order the creator offers them (u = it takes just the user)
export const SOCIAL = [
  { k: "whatsapp", t: "WhatsApp", ph: "10 dígitos" }, { k: "instagram", t: "Instagram", ph: "usuario", u: "https://instagram.com/" },
  { k: "tiktok", t: "TikTok", ph: "usuario", u: "https://tiktok.com/@" }, { k: "facebook", t: "Facebook", ph: "usuario o link", u: "https://facebook.com/" },
  { k: "youtube", t: "YouTube", ph: "usuario o link", u: "https://youtube.com/@" }, { k: "x", t: "X (Twitter)", ph: "usuario", u: "https://x.com/" },
  { k: "linkedin", t: "LinkedIn", ph: "usuario o link", u: "https://linkedin.com/in/" }, { k: "threads", t: "Threads", ph: "usuario", u: "https://threads.net/@" },
  { k: "telegram", t: "Telegram", ph: "usuario", u: "https://t.me/" }, { k: "pinterest", t: "Pinterest", ph: "usuario", u: "https://pinterest.com/" },
  { k: "twitch", t: "Twitch", ph: "usuario", u: "https://twitch.tv/" }, { k: "snapchat", t: "Snapchat", ph: "usuario", u: "https://snapchat.com/add/" },
  { k: "spotify", t: "Spotify", ph: "link de tu perfil o playlist" }, { k: "email", t: "Correo", ph: "tu@correo.com" },
  { k: "phone", t: "Teléfono", ph: "10 dígitos" }, { k: "maps", t: "Ubicación", ph: "link de Google Maps" }, { k: "web", t: "Sitio web", ph: "tusitio.com" },
];
export const SOCIAL_BY = Object.fromEntries(SOCIAL.map(s => [s.k, s]));
export const THEMES = {
  vortice: { t: "Vórtice", bg: "radial-gradient(120% 70% at 50% 0%,#3a1670 0%,#14072b 55%,#05020b 100%)", ink: "#f4eeff", mute: "rgba(244,238,255,.72)", card: "#1d0c3a", dark: true, color: "#8b3fd6", meta: "#14072b" },
  noche: { t: "Noche", bg: "#0c0c10", ink: "#f5f5f7", mute: "rgba(245,245,247,.66)", card: "#1a1a20", dark: true, color: "#ffffff", meta: "#0c0c10" },
  claro: { t: "Claro", bg: "#ffffff", ink: "#16151a", mute: "#5f5c68", card: "#ffffff", dark: false, color: "#16151a", meta: "#ffffff" },
  crema: { t: "Crema", bg: "#f5eee2", ink: "#2b1f15", mute: "#76634f", card: "#fffaf1", dark: false, color: "#b8572a", meta: "#f5eee2" },
  degradado: { t: "Degradado", bg: null, ink: "#ffffff", mute: "rgba(255,255,255,.8)", card: "#ffffff", dark: true, color: "#ffffff", meta: null },
  pastel: { t: "Pastel", bg: "linear-gradient(160deg,#ffd9e8 0%,#e5dcff 50%,#d4ecff 100%)", ink: "#2c2440", mute: "#5d5577", card: "#ffffff", dark: false, color: "#ffffff", meta: "#ffd9e8" },
};
export const FONTS = {
  sora: { t: "Moderna", f: '"Sora",system-ui,sans-serif', w: 700 }, playfair: { t: "Elegante", f: '"Playfair Display",Georgia,serif', w: 700 },
  plex: { t: "Sencilla", f: '"IBM Plex Sans",system-ui,sans-serif', w: 600 }, bebas: { t: "Impacto", f: '"Bebas Neue",Impact,sans-serif', w: 400, up: true },
  pacifico: { t: "Manuscrita", f: '"Pacifico",cursive', w: 400 },
};
export const BTNS = { relleno: "Relleno", contorno: "Contorno", sombra: "Sombra", cristal: "Cristal" };
export const SHAPES = { pill: "Redondos", round: "Suaves", square: "Rectos" };
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Sans:wght@400;500;600&family=Pacifico&family=Playfair+Display:wght@600;700&family=Sora:wght@500;600;700&display=swap";

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ICONS.link}</svg>`;
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lum = hex => { const c = rgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
export const onAccent = hex => lum(hex) > .42 ? "#16151a" : "#ffffff";
const mix = (hex, k, to = 0) => "#" + rgb(hex).map(v => Math.round(v + (to - v) * k).toString(16).padStart(2, "0")).join("");

// which network a link belongs to (for its icon)
export function detect(url) {
  const u = String(url || "").toLowerCase();
  if (u.startsWith("mailto:")) return "email";
  if (u.startsWith("tel:")) return "phone";
  const h = (u.match(/^(?:https?:\/\/)?([^/?#]+)/) || [])[1] || "";
  const P = [["whatsapp", /(^|\.)wa\.me$|whatsapp\.com$/], ["instagram", /instagram\.com$|instagr\.am$/], ["tiktok", /tiktok\.com$/], ["facebook", /facebook\.com$|fb\.com$|fb\.me$/],
    ["youtube", /youtube\.com$|youtu\.be$/], ["x", /(^|\.)x\.com$|twitter\.com$/], ["linkedin", /linkedin\.com$/], ["threads", /threads\.net$|threads\.com$/], ["telegram", /(^|\.)t\.me$|telegram\.me$/],
    ["pinterest", /pinterest\.|pin\.it$/], ["twitch", /twitch\.tv$/], ["snapchat", /snapchat\.com$/], ["spotify", /spotify\.com$|spotify\.link$/]];
  for (const [k, re] of P) if (re.test(h)) return k;
  if (/maps\.google\.|google\.[a-z.]+$/.test(h) && /\/maps/.test(u) || /maps\.app\.goo\.gl|goo\.gl$/.test(h) && /maps/.test(u) || /waze\.com$/.test(h)) return "maps";
  return null;
}
const initials = t => (String(t || "").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("") || "✦").toUpperCase();

const CSS = `
.lk{position:absolute;inset:0;overflow:hidden;font-family:"IBM Plex Sans",system-ui,-apple-system,sans-serif;color:var(--lk-ink);-webkit-tap-highlight-color:transparent}
.lk *{box-sizing:border-box}
.lk-bg{position:absolute;inset:0;background:var(--lk-bg)}
.lk-bg.img{background-size:cover;background-position:center}
.lk-bg.img::after{content:"";position:absolute;inset:0;background:var(--lk-veil)}
.lk-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.lk-in{position:relative;max-width:580px;margin:0 auto;padding:calc(54px + env(safe-area-inset-top,0px)) 16px calc(28px + env(safe-area-inset-bottom,0px));min-height:100%;display:flex;flex-direction:column}
.lk-share{position:absolute;right:14px;top:calc(12px + env(safe-area-inset-top,0px));width:42px;height:42px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;background:var(--lk-chip);color:var(--lk-ink);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.lk-share svg{width:19px;height:19px;fill:currentColor}
.lk-hero{text-align:center;display:flex;flex-direction:column;align-items:center}
.lk-av{width:104px;height:104px;border-radius:50%;object-fit:cover;display:block;box-shadow:0 0 0 3px var(--lk-ring),0 12px 30px -10px rgba(0,0,0,.45);background:var(--lk-card)}
.lk-av.ini{display:grid;place-items:center;background:var(--lk-c);color:var(--lk-cink);font:700 2.2rem "Sora",sans-serif}
.lk h1{font-family:var(--lk-fh);font-weight:var(--lk-fw);font-size:1.6rem;line-height:1.15;margin:16px 0 0;letter-spacing:.005em;text-wrap:balance;overflow-wrap:anywhere}
.lk.up h1{text-transform:uppercase;font-size:2.1rem;letter-spacing:.03em}
.lk-bio{margin:8px 0 0;color:var(--lk-mute);font-size:.98rem;line-height:1.45;white-space:pre-line;max-width:44ch;overflow-wrap:anywhere}
.lk-soc{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px;margin:16px 0 0}
.lk-soc a{width:42px;height:42px;display:grid;place-items:center;border-radius:50%;color:var(--lk-ink);transition:transform .15s,background .15s}
.lk-soc a:hover{background:var(--lk-chip);transform:translateY(-2px)}
.lk-soc svg{width:25px;height:25px;fill:currentColor}
.lk-list{display:flex;flex-direction:column;gap:14px;margin:26px 0 0}
.lk-b{position:relative;display:flex;align-items:center;min-height:58px;padding:8px 56px;border-radius:var(--lk-r);text-decoration:none;font-weight:600;font-size:1rem;line-height:1.25;text-align:center;justify-content:center;cursor:pointer;
  transition:transform .15s ease,box-shadow .15s ease,background .15s;font-family:inherit;width:100%;overflow-wrap:anywhere}
.lk-b:active{transform:scale(.98)}
.lk.relleno .lk-b{background:var(--lk-c);color:var(--lk-cink);box-shadow:0 6px 18px -10px rgba(0,0,0,.5)}
.lk.relleno .lk-b:hover{transform:translateY(-2px)}
.lk.contorno .lk-b{background:transparent;color:var(--lk-ink);border:2px solid var(--lk-line)}
.lk.contorno .lk-b:hover{background:var(--lk-chip)}
.lk.sombra .lk-b{background:var(--lk-card);color:var(--lk-cardink);border:2px solid var(--lk-shadow);box-shadow:5px 5px 0 var(--lk-shadow)}
.lk.sombra .lk-b:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 var(--lk-shadow)}
.lk.cristal .lk-b{background:var(--lk-glass);color:var(--lk-ink);border:1px solid var(--lk-glassline);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.lk.cristal .lk-b:hover{transform:translateY(-2px)}
.lk-b .th{position:absolute;left:8px;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:calc(var(--lk-r) * .7);object-fit:cover;display:block}
.lk-b .ic{position:absolute;left:16px;top:50%;transform:translateY(-50%);width:26px;height:26px;display:grid;place-items:center}
.lk-b .ic svg{width:24px;height:24px;fill:currentColor}
.lk-b.hi{animation:lk-hi 3.2s ease-in-out infinite}
.lk-b.hi::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.4) 50%,transparent 65%);background-size:250% 100%;animation:lk-shine 3.2s ease-in-out infinite}
@keyframes lk-hi{0%,72%,100%{transform:none}76%{transform:rotate(-1.6deg) scale(1.02)}80%{transform:rotate(1.6deg) scale(1.02)}84%{transform:rotate(-1deg)}88%{transform:none}}
@keyframes lk-shine{0%,55%{background-position:120% 0}85%,100%{background-position:-120% 0}}
.lk-h{margin:12px 0 -2px;text-align:center;font-family:var(--lk-fh);font-weight:var(--lk-fw);font-size:1.08rem;color:var(--lk-ink)}
.lk.up .lk-h{text-transform:uppercase;letter-spacing:.06em;font-size:1.3rem}
.lk-vc{display:inline-flex;align-items:center;gap:9px;margin:18px 0 0;padding:12px 22px;border-radius:999px;border:0;cursor:pointer;font:700 .95rem "Sora",system-ui,sans-serif;background:var(--lk-ink);color:var(--lk-inkon);box-shadow:0 10px 24px -12px rgba(0,0,0,.6)}
.lk-vc svg{width:20px;height:20px;fill:currentColor}
.lk-vc:active{transform:scale(.97)}
.lk-empty{margin:26px 0 0;padding:18px;border:1.5px dashed var(--lk-line);border-radius:16px;text-align:center;color:var(--lk-mute);font-size:.92rem}
.lk-foot{margin-top:auto;padding-top:38px;display:flex;justify-content:center}
.lk-foot a,.lk-foot span{display:inline-flex;align-items:center;padding:9px 16px;border-radius:999px;background:var(--lk-chip)}
.lk-foot img{height:20px;width:auto;display:block}
.lk-foot.own a,.lk-foot.own span{background:#fff}
.lk-foot.own img{height:26px;max-width:60vw}
.lk-toast{position:absolute;left:50%;bottom:calc(26px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);opacity:0;pointer-events:none;background:#16151a;color:#fff;padding:11px 18px;border-radius:999px;font-size:.9rem;font-weight:600;transition:.25s;box-shadow:0 10px 30px rgba(0,0,0,.35);white-space:nowrap;max-width:90%;overflow:hidden;text-overflow:ellipsis}
.lk-toast.on{opacity:1;transform:translate(-50%,0)}
.lk-in>*{animation:lk-up .5s cubic-bezier(.2,.8,.2,1) both}
.lk-list>*{animation:lk-up .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0) * 50ms + 120ms)}
.lk-list>.lk-b.hi{animation:lk-up .5s cubic-bezier(.2,.8,.2,1) both,lk-hi 3.2s ease-in-out 1.2s infinite;animation-delay:calc(var(--i,0) * 50ms + 120ms),1.2s}
.lk.still .lk-in>*,.lk.still .lk-list>*{animation:none}
.lk.still .lk-list>.lk-b.hi{animation:lk-hi 3.2s ease-in-out infinite}
@keyframes lk-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.lk *{animation:none!important;transition:none!important}}
`;

export function run(o) {
  const root = o.root;
  if (!document.getElementById("lk-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "lk-css", textContent: CSS }));
  if (!document.getElementById("lk-fonts")) document.head.appendChild(Object.assign(document.createElement("link"), { id: "lk-fonts", rel: "stylesheet", href: FONT_CSS }));
  const el = document.createElement("div"); el.className = "lk";
  el.innerHTML = '<div class="lk-bg"></div><div class="lk-scroll"><div class="lk-in"></div></div><div class="lk-toast" role="status" aria-live="polite"></div>';
  root.appendChild(el);
  const bgEl = el.querySelector(".lk-bg"), scroller = el.querySelector(".lk-scroll"), inner = el.querySelector(".lk-in"), toastEl = el.querySelector(".lk-toast");
  let cfg = o.cfg, first = true, tT = 0;
  const src = id => (id ? o.src(id) : "");
  const toast = t => { toastEl.textContent = t; toastEl.classList.add("on"); clearTimeout(tT); tT = setTimeout(() => toastEl.classList.remove("on"), 2200); };

  function theme() {
    const L = cfg.links || {}, T = THEMES[L.theme] || THEMES.vortice;
    const c = /^#[0-9a-f]{6}$/i.test(L.color || "") ? L.color.toLowerCase() : T.color;
    const bg = T.bg || `linear-gradient(160deg,${mix(c, .1, 255)} 0%,${c} 45%,${mix(c, .55)} 100%)`;
    const ink = T.bg ? T.ink : (lum(c) > .55 ? "#16151a" : "#ffffff"), mute = T.bg ? T.mute : (lum(c) > .55 ? "rgba(22,21,26,.7)" : "rgba(255,255,255,.82)");
    const dark = T.bg ? T.dark : ink === "#ffffff";
    const photo = L.bg && src(L.bg);
    const ink2 = photo ? "#ffffff" : ink, mute2 = photo ? "rgba(255,255,255,.85)" : mute, dark2 = photo ? true : dark;
    const btnC = T.bg ? c : "#ffffff";   // on "degradado" the color is the background and the buttons are white
    const F = FONTS[L.font] || FONTS.sora;
    el.className = `lk ${BTNS[L.btn] ? L.btn : "relleno"}${F.up ? " up" : ""}${first ? "" : " still"}`;
    el.style.cssText = [
      `--lk-bg:${bg}`, `--lk-ink:${ink2}`, `--lk-mute:${mute2}`, `--lk-c:${btnC}`, `--lk-cink:${onAccent(btnC)}`,
      `--lk-card:${dark2 && T.bg ? T.card : "#ffffff"}`, `--lk-cardink:${dark2 && T.bg ? T.ink : "#16151a"}`, `--lk-shadow:${dark2 ? "#000000" : "#16151a"}`,
      `--lk-line:${L.btn === "contorno" ? (btnC === (dark2 ? "#000000" : "#ffffff") ? ink2 : btnC) : ink2}`,
      `--lk-chip:${dark2 ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.07)"}`, `--lk-ring:${dark2 ? "rgba(255,255,255,.85)" : "#ffffff"}`,
      `--lk-glass:${dark2 ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.55)"}`, `--lk-glassline:${dark2 ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.9)"}`,
      `--lk-inkon:${dark2 ? "#16151a" : "#ffffff"}`, `--lk-veil:${"linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.62))"}`,
      `--lk-r:${L.shape === "square" ? "6px" : L.shape === "round" ? "16px" : "999px"}`, `--lk-fh:${F.f}`, `--lk-fw:${F.w}`,
    ].join(";");
    bgEl.className = "lk-bg" + (photo ? " img" : "");
    bgEl.style.backgroundImage = photo ? `url("${photo}")` : "";
    if (o.themeColor) o.themeColor(photo ? "#000000" : T.meta || mix(c, .1, 255));
  }
  function brandHtml() {
    const b = o.brand; if (!b) return "";
    const img = `<img src="${esc(b.src)}" alt="${b.own ? "" : "Vórtice VR"}">`;
    return `<footer class="lk-foot${b.own ? " own" : ""}">${b.href ? `<a href="${esc(b.href)}" target="_blank" rel="noopener">${img}</a>` : `<span>${img}</span>`}</footer>`;
  }
  function linkRow(b, i) {
    const net = detect(b.url);
    const lead = b.thumb && src(b.thumb) ? `<img class="th" src="${esc(src(b.thumb))}" alt="" loading="lazy">` : net ? `<span class="ic">${svg(net)}</span>` : "";
    const ext = /^https?:/i.test(b.url);
    return `<a class="lk-b${b.hi ? " hi" : ""}" style="--i:${i}" href="${esc(b.url)}"${ext ? ' target="_blank" rel="noopener"' : ""} data-c="${esc(b.id)}">${lead}<span>${esc(b.t)}</span></a>`;
  }
  function render() {
    const L = cfg.links || {}, top = scroller.scrollTop;
    theme();
    const name = cfg.title || "Tu nombre";
    let h = L.share !== false ? `<button class="lk-share" type="button" data-share aria-label="Compartir">${svg("share")}</button>` : "";
    const av = L.avatar && src(L.avatar);
    h += `<header class="lk-hero">${av ? `<img class="lk-av" src="${esc(av)}" alt="">` : `<div class="lk-av ini" aria-hidden="true">${esc(initials(name))}</div>`}<h1>${esc(name)}</h1>${L.bio ? `<p class="lk-bio">${esc(L.bio)}</p>` : ""}`;
    if (L.contact && L.contact.on) h += `<button class="lk-vc" type="button" data-vcard>${svg("contact")}Guardar contacto</button>`;
    const soc = (L.social || []).filter(s => s.v);
    if (soc.length) h += `<nav class="lk-soc" aria-label="Redes sociales">${soc.map(s => `<a href="${esc(s.v)}"${/^https?:/.test(s.v) ? ' target="_blank" rel="noopener"' : ""} aria-label="${esc((SOCIAL_BY[s.k] || {}).t || s.k)}" data-c="${esc(s.k)}">${svg(s.k)}</a>`).join("")}</nav>`;
    h += "</header>";
    const list = (L.list || []).filter(b => !b.off && b.t && (b.type === "header" || b.url));
    if (list.length) h += `<div class="lk-list">${list.map((b, i) => b.type === "header" ? `<h2 class="lk-h" style="--i:${i}">${esc(b.t)}</h2>` : linkRow(b, i)).join("")}</div>`;
    else if (o.embedded && !soc.length) h += `<div class="lk-empty">Aquí aparecerán tus botones.</div>`;
    h += brandHtml();
    inner.innerHTML = h;
    scroller.scrollTop = top;
    first = false;
  }
  inner.addEventListener("click", async e => {
    const sh = e.target.closest("[data-share]");
    if (sh) {
      const url = o.url || location.href;
      if (o.embedded) { toast("Así compartirán tu página"); return; }
      try { if (navigator.share) { await navigator.share({ title: cfg.title || "", url }); return; } } catch (err) { if (err && err.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(url); toast("Link copiado"); } catch { toast(url); }
      return;
    }
    if (e.target.closest("[data-vcard]")) {
      if (!o.vcard) { toast("Se activa al publicar tu página"); return; }
      if (o.onClick) o.onClick("vcard");
      location.href = o.vcard;
      return;
    }
    const a = e.target.closest("[data-c]");
    if (a && o.onClick) o.onClick(a.dataset.c);
  });
  render();
  return {
    update(c, brand) { cfg = c; if (brand !== undefined) o.brand = brand; render(); },
    destroy() { el.remove(); },
  };
}
