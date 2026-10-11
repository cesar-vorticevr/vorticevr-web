// Genera el portal de contacto (/<slug>/) y la RA (/ra/<ra.slug>/) de un cliente
// a partir de _clientes/<slug>/cliente.json y las plantillas de _plantillas/.
//
//   node tools/generar-cliente.mjs <slug>                 escribe en la raíz del sitio
//   node tools/generar-cliente.mjs <slug> --salida <dir>  escribe en otra carpeta (para revisar)
//   node tools/generar-cliente.mjs <slug> --forzar        permite sobrescribir páginas no generadas
//
// Nunca sobrescribe páginas hechas a mano (sin la marca del generador) salvo con --forzar,
// y nunca escribe en el sitio un cliente con "protegido": true (rutas ya impresas).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARK = "Generado con tools/generar-cliente.mjs";

const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--salida");
const outIdx = args.indexOf("--salida");
const outRoot = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : ROOT;
const force = args.includes("--forzar");

function fail(msg) { console.error("✗ " + msg); process.exit(1); }
if (!slug) fail("Uso: node tools/generar-cliente.mjs <slug> [--salida <carpeta>] [--forzar]");

const srcDir = path.join(ROOT, "_clientes", slug);
const jsonPath = path.join(srcDir, "cliente.json");
if (!fs.existsSync(jsonPath)) fail(`No existe ${path.relative(ROOT, jsonPath)}. Copia _clientes/_plantilla/ a _clientes/${slug}/ y llénalo.`);
const c = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
c.slug = c.slug || slug;

// ---------- validation ----------
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
if (!SLUG.test(c.slug)) fail(`slug inválido "${c.slug}": solo minúsculas, números y guiones.`);
if (c.ra && !SLUG.test(c.ra.slug || "")) fail(`ra.slug inválido "${c.ra && c.ra.slug}".`);
for (const k of ["nombre"]) if (!c[k]) fail(`Falta "${k}" en cliente.json.`);
if (c.protegido && outRoot === ROOT) fail(`"${c.slug}" está protegido (sus rutas ya están impresas). Solo se puede generar con --salida <carpeta> para revisar.`);
const RESERVED = ["assets", "ra", "tarjeta", "tools", "_clientes", "_plantillas", "node_modules"];
if (RESERVED.includes(c.slug)) fail(`"${c.slug}" es una ruta reservada del sitio.`);

const need = f => { if (f && !fs.existsSync(path.join(srcDir, f))) fail(`No encuentro ${f} en _clientes/${slug}/.`); return f; };
const img = c.imagenes || {};
Object.values(img).forEach(need);
if (c.pie && c.pie.imagen) need(c.pie.imagen);
if (c.ra) {
  for (const f of [c.ra.tarjeta, c.ra.modelo && c.ra.modelo.archivo, c.ra.logo && c.ra.logo.archivo, c.ra.logo_intro]) need(f);
  if (!fs.existsSync(path.join(srcDir, "targets.mind")))
    fail(`Falta _clientes/${slug}/targets.mind. Compílalo primero: node tools/compilar-target.mjs ${slug}`);
}

const colores = Object.assign({ fondo: "#f5f2ed", texto: "#1f1f1f", suave: "#5e5651", acento: "#5b2a86", acento_oscuro: "#3f1d5e", linea: "#ddd5ca" }, c.colores);

// ---------- helpers ----------
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const digits = s => String(s || "").replace(/[^\d]/g, "");
const prettyUrl = u => String(u).replace(/^https?:\/\//, "").replace(/\/$/, "");
const get = (o, k) => k.split(".").reduce((v, p) => (v == null ? v : v[p]), o);

function render(tpl, ctx) {
  return tpl
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, k) => { const v = get(ctx, k); if (v == null) fail(`La plantilla usa {{{${k}}}} y no tiene valor.`); return String(v); })
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => { const v = get(ctx, k); if (v == null) fail(`La plantilla usa {{${k}}} y no tiene valor.`); return esc(v); });
}

const ICON = {
  tel: '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .6 3.6 1 1 0 0 1-.25 1z"/>',
  whatsapp: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1 2.6 11.4 11.4 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/>',
  correo: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v.5l8 5 8-5V6H4zm16 3l-8 5-8-5v9h16V9z"/>',
  web: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7.9 9h-3a15.6 15.6 0 0 0-1.3-5.5A8 8 0 0 1 19.9 11zM12 4c.9 1.1 1.8 3.6 2 7h-4c.2-3.4 1.1-5.9 2-7zM4.1 13h3c.1 2 .6 3.9 1.3 5.5A8 8 0 0 1 4.1 13zm3-2h-3a8 8 0 0 1 4.3-5.5A15.6 15.6 0 0 0 7.1 11zM12 20c-.9-1.1-1.8-3.6-2-7h4c-.2 3.4-1.1 5.9-2 7zm3.6-1.5c.7-1.6 1.2-3.5 1.3-5.5h3a8 8 0 0 1-4.3 5.5z"/>',
  facebook: '<path d="M20 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8.6v-7.7H10v-3h2.6V9c0-2.6 1.6-4 3.9-4 1.1 0 2.1.1 2.3.1v2.7h-1.6c-1.3 0-1.5.6-1.5 1.5v1.9h3l-.4 3h-2.6V22H20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>',
  instagram: '<path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6zm9.7 1.5a1.3 1.3 0 1 1 0 2.5 1.3 1.3 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>',
  linkedin: '<path d="M20 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM8.3 18.5H5.5v-9h2.8v9zM6.9 8.3a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2zm11.6 10.2h-2.8v-4.4c0-1 0-2.4-1.5-2.4s-1.7 1.1-1.7 2.3v4.5H9.7v-9h2.7v1.2a3 3 0 0 1 2.7-1.5c2.9 0 3.4 1.9 3.4 4.4v4.9z"/>',
  youtube: '<path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3-5.2 3z"/>',
  tiktok: '<path d="M16.6 3c.4 2.2 1.8 3.7 4 3.9v3a7.4 7.4 0 0 1-4-1.3v6.2A5.8 5.8 0 1 1 10.8 9v3.1a2.8 2.8 0 1 0 2.8 2.8V3h3z"/>',
  x: '<path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/>',
  mapa: '<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>',
  enlace: '<path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a3 3 0 0 1 4.2 4.2l-2.1 2.1a1 1 0 0 1-1.4-1.4l2.1-2.1a1 1 0 0 0-1.4-1.4L12 13.4a1 1 0 0 1-1.4 0zm2.8-2.8a1 1 0 0 1 0 1.4L9.9 15.5a3 3 0 0 1-4.2-4.2l2.1-2.1a1 1 0 0 1 1.4 1.4l-2.1 2.1a1 1 0 0 0 1.4 1.4l3.5-3.5a1 1 0 0 1 1.4 0z"/>',
  ra: '<path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3 6.6 3.7L12 11.7 5.4 8 12 4.3zM5 9.7l6 3.4v6.6l-6-3.4V9.7zm8 10v-6.6l6-3.4v6.6l-6 3.4z"/>',
};
const svg = k => `<svg viewBox="0 0 24 24">${ICON[k] || ICON.enlace}</svg>`;
const RED_LBL = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok", x: "X" };

const I = "      "; // row indentation
function row({ icon, lbl, val, href, copy, copyLabel, small }) {
  const inner = `\n${I}  <span class="ico">${svg(icon)}</span>\n${I}  <span class="txt"><span class="lbl">${esc(lbl)}</span><span class="val${small ? " small" : ""}">${esc(val)}</span></span>` +
    (copy ? `\n${I}  <button class="copy" type="button" data-copy="${esc(copy)}" aria-label="${esc(copyLabel)}">Copiar</button>` : "");
  return href
    ? `${I}<a class="row" href="${esc(href)}" target="_blank" rel="noopener">${inner}\n${I}</a>`
    : `${I}<div class="row">${inner}\n${I}</div>`;
}

// ---------- portal ----------
const rows = [];
if (c.telefono) rows.push(row({ icon: "tel", lbl: c.telefono_etiqueta || "Celular", val: c.telefono, copy: c.telefono, copyLabel: "Copiar número" }));
if (c.correo) rows.push(row({ icon: "correo", lbl: "Correo", val: c.correo, copy: c.correo, copyLabel: "Copiar correo" }));
if (c.web) rows.push(row({ icon: "web", lbl: "Sitio web", val: prettyUrl(c.web), href: c.web }));
for (const r of c.redes || []) rows.push(row({ icon: r.tipo, lbl: r.etiqueta || RED_LBL[r.tipo] || "Enlace", val: r.texto || prettyUrl(r.url), href: r.url }));
if (c.direccion) {
  const q = (c.direccion.mapa || c.direccion.texto).replace(/#/g, "").trim().replace(/\s+/g, "+");
  rows.push(row({ icon: "mapa", lbl: c.direccion.etiqueta || "Dirección", val: c.direccion.texto, href: `https://www.google.com/maps/search/?api=1&query=${q}`, small: true }));
}

const cta = [];
if (c.whatsapp) cta.push(`<a href="https://wa.me/${digits(c.whatsapp)}" target="_blank" rel="noopener">${svg("whatsapp")}WhatsApp</a>`);
if (c.telefono) cta.push(`<a class="${c.whatsapp ? "alt" : ""}" href="tel:+${digits(c.telefono)}">${svg("tel")}Llamar</a>`.replace(' class=""', ""));
else if (c.correo) cta.push(`<a class="${c.whatsapp ? "alt" : ""}" href="mailto:${esc(c.correo)}">${svg("correo")}Correo</a>`.replace(' class=""', ""));

const fuente = c.fuente || null;
const tex = img.textura ? `url("${img.textura}")` : "";
const ctx = {
  ...c,
  colores,
  imagenes: { franja: img.franja || "", ...img },
  fuente_link: fuente ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fuente).replace(/%20/g, "+")}:wght@500;600;800&display=swap">` : "",
  fuente_css: fuente ? `"${fuente}",system-ui,sans-serif` : "system-ui,sans-serif",
  textura_css_ra: tex ? `${tex} center/260px repeat` : "",
  textura_css_banda: tex ? `${tex} center/300px repeat` : "",
  franja: img.franja ? '<div class="strip" role="presentation"></div>' : "",
  cabecera: `<header${img.logo ? "" : ' class="nologo"'}>\n` +
    (img.logo ? `      <img src="${esc(img.logo)}" alt="">\n` : "") +
    `      <div class="id">\n        <h1>${esc(c.nombre)}</h1>\n` +
    (c.cargo ? `        <p class="role">${esc(c.cargo)}</p>\n` : "") +
    (c.organizacion ? `        <p class="org">${esc(c.organizacion)}</p>\n` : "") +
    `      </div>\n    </header>`,
  cta: cta.length ? `<div class="cta">\n      ${cta.join("\n      ")}\n    </div>` : "",
  boton_ra: c.ra ? `<a class="ra" href="../ra/${c.ra.slug}/">\n      <span class="ra-ico">${svg("ra")}</span>\n      <span class="ra-txt"><span class="ra-k">Realidad aumentada</span><span class="ra-v">Apunta tu cámara a la tarjeta</span></span>\n      <span class="ra-go" aria-hidden="true">→</span>\n    </a>` : "",
  filas: rows.join("\n"),
  // banda.html is trusted markup written by us in cliente.json (may contain links).
  banda: c.banda ? `<div class="band">\n      ${c.banda.titulo ? `<span class="k">${esc(c.banda.titulo)}</span>\n      ` : ""}<p>${c.banda.html || esc(c.banda.texto)}</p>\n    </div>` : "",
  pie: c.pie ? `<footer>\n      ${c.pie.imagen ? `<img src="${esc(c.pie.imagen)}" alt="${esc(c.pie.alt || "")}">\n      ` : ""}${c.pie.texto ? `<small>${esc(c.pie.texto)}</small>\n    ` : ""}</footer>` : "",
};

function writePage(dir, html, files) {
  const index = path.join(dir, "index.html");
  if (fs.existsSync(index) && !force && !fs.readFileSync(index, "utf8").includes(MARK))
    fail(`${path.relative(outRoot, index)} ya existe y no fue generado por la plantilla. No lo sobrescribo (usa --forzar si de verdad quieres).`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(index, html);
  for (const f of files) fs.copyFileSync(path.join(srcDir, f), path.join(dir, f));
  console.log(`✓ ${path.relative(outRoot, dir).replace(/\\/g, "/")}/  (${files.length} archivos + index.html)`);
}

const portalTpl = fs.readFileSync(path.join(ROOT, "_plantillas", "portal.html"), "utf8");
const portalFiles = [img.logo, img.franja, img.textura, c.pie && c.pie.imagen].filter(Boolean);
writePage(path.join(outRoot, c.slug), render(portalTpl, ctx), [...new Set(portalFiles)]);

// ---------- RA ----------
if (c.ra) {
  const r = c.ra;
  const cfg = {
    titulo: r.titulo || `${c.nombre} · Realidad aumentada`,
    archivo: r.archivo || `${c.slug}-RA`,
    modelo: Object.assign({ x: -0.32, y: 0, tamano: 0.3, forro: false }, r.modelo),
    logo: r.logo ? Object.assign({ x: 0.2, y: 0.22, z: 0.16, ancho: 0.42 }, r.logo) : null,
    destellos: r.destellos !== false,
  };
  const raCtx = {
    ...ctx,
    ra: { titulo: cfg.titulo, tarjeta: r.tarjeta, tarjeta_alt: r.tarjeta_alt || "Tarjeta impresa", instruccion: r.instruccion || "la cara impresa de la tarjeta" },
    ra_logo_intro: r.logo_intro ? `<img class="logo" src="${esc(r.logo_intro)}" alt="${esc(r.logo_intro_alt || "")}">` : "",
    ra_config: JSON.stringify(cfg).replace(/</g, "\\u003c"),
  };
  const raTpl = fs.readFileSync(path.join(ROOT, "_plantillas", "ra.html"), "utf8");
  const raFiles = [r.tarjeta, cfg.modelo.archivo, cfg.logo && cfg.logo.archivo, r.logo_intro, "targets.mind"].filter(Boolean);
  writePage(path.join(outRoot, "ra", r.slug), render(raTpl, raCtx), [...new Set(raFiles)]);
}

const base = outRoot === ROOT ? "https://t.vorticevr.mx" : outRoot;
console.log(`\nLink para la tarjeta NFC/QR: ${base}/${c.slug}/`);
