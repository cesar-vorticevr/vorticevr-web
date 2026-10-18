// Menú interactivo para restaurantes (data.kind = "menu"). Lo usan el visor (/x/) y la vista previa del creador (/crear/menu/).
//  - run({root, cfg, src, brand, buttons, embedded}) dibuja la carta dentro de root (que tiene su propio scroll):
//    encabezado, "¿No sabes qué pedir?", platillos especiales (en 3D con <model-viewer> si subieron su GLB: "Verlo en tu mesa"
//    abre la realidad aumentada sobre una superficie: WebXR / Scene Viewer en Android, Quick Look en iPhone), secciones con
//    sus platillos y el menú original (páginas del PDF o fotos).
//  - El asistente hace hasta 4 preguntas elegidas según las etiquetas de los platillos que quedan (solo pregunta lo que
//    sirve para separar) y recomienda 3.
//  - parseMenuText(lines) convierte el texto de un PDF o de una imagen (OCR) en secciones y platillos con precio.
// cfg = { title, menu: {cats, pages, color, theme, currency, note, sub, helper, logo}, items }. src(id) = URL de un archivo.

export const TAGS = {
  picante: { e: "🌶️", t: "Picante" }, vegetariano: { e: "🌱", t: "Vegetariano" }, carne: { e: "🥩", t: "Carne" }, pollo: { e: "🍗", t: "Pollo" },
  mariscos: { e: "🦐", t: "Mariscos" }, ligero: { e: "🥗", t: "Ligero" }, abundante: { e: "🍽️", t: "Abundante" }, compartir: { e: "👥", t: "Para compartir" },
  fria: { e: "🧊", t: "Fría" }, caliente: { e: "☕", t: "Caliente" }, alcohol: { e: "🍸", t: "Con alcohol" }, nuevo: { e: "✨", t: "Nuevo" },
};
// tags that make sense for each kind of section (the creator shows only these)
export const TAGS_FOR = {
  comida: ["picante", "vegetariano", "carne", "pollo", "mariscos", "ligero", "abundante", "compartir", "nuevo"],
  bebida: ["fria", "caliente", "alcohol", "picante", "nuevo"],
  postre: ["fria", "caliente", "vegetariano", "compartir", "nuevo"],
};
export const KINDS = { comida: { e: "🍽️", t: "Comida" }, bebida: { e: "🥤", t: "Bebidas" }, postre: { e: "🍰", t: "Postres" } };
// on the dish rows only these icons show (the rest are for the helper)
const ROW_TAGS = ["picante", "vegetariano", "compartir", "alcohol"];
export const THEMES = {
  clasico: { t: "Clásico", bg: "#f6efe3", card: "#fffaf2", ink: "#2a1d14", mute: "#7a6656", line: "rgba(60,40,20,.14)", fh: '"Playfair Display",Georgia,serif', dark: false },
  oscuro: { t: "Oscuro", bg: "#0f0c10", card: "#1b161d", ink: "#f4eee8", mute: "#a99f9a", line: "rgba(255,255,255,.1)", fh: '"Sora",system-ui,sans-serif', dark: true },
  claro: { t: "Claro", bg: "#ffffff", card: "#f5f4f6", ink: "#18171c", mute: "#6b6874", line: "rgba(0,0,0,.09)", fh: '"Sora",system-ui,sans-serif', dark: false },
};
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Sora:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
const MV_SRC = "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js";

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const has = (d, t) => !!(d.tags && d.tags.includes(t));
export const priceText = (p, cur = "$") => !p ? "" : /^\d/.test(p) ? cur + p.replace(/\s*\/\s*/g, " / " + cur) : p;
const lum = hex => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
export const onAccent = hex => lum(hex) > .42 ? "#1b1208" : "#ffffff";

// ---------------------------------------------------------------- the helper: "¿Qué se te antoja?"
// Each option keeps (filter), removes (avoid) or does not touch (any) the dishes that pass its test.
const DIMS = [
  { k: "tipo", q: "¿Qué se te antoja?", opts: [
    { t: "Algo de comer", e: "🍽️", mode: "filter", test: d => d.kind === "comida" },
    { t: "Algo de tomar", e: "🥤", mode: "filter", test: d => d.kind === "bebida" },
    { t: "Algo dulce", e: "🍰", mode: "filter", test: d => d.kind === "postre" }] },
  { k: "hambre", for: ["comida"], q: "¿Cuánta hambre traes?", opts: [
    { t: "Poquita, algo ligero", e: "🥗", mode: "filter", test: d => has(d, "ligero"), why: "Ligero" },
    { t: "¡Muchísima!", e: "🤤", mode: "filter", test: d => has(d, "abundante"), why: "Abundante" },
    { t: "Normal", e: "🙂", mode: "any" }] },
  { k: "prote", for: ["comida"], q: "¿Qué prefieres?", opts: [
    { t: "Carne", e: "🥩", mode: "filter", test: d => has(d, "carne"), why: "Carne" },
    { t: "Pollo", e: "🍗", mode: "filter", test: d => has(d, "pollo"), why: "Pollo" },
    { t: "Mariscos", e: "🦐", mode: "filter", test: d => has(d, "mariscos"), why: "Mariscos" },
    { t: "Sin carne", e: "🌱", mode: "filter", test: d => has(d, "vegetariano"), why: "Vegetariano" },
    { t: "Lo que sea", e: "😋", mode: "any" }] },
  { k: "picante", for: ["comida", "bebida"], q: "¿Le entras al picante?", opts: [
    { t: "¡Sí, que pique!", e: "🌶️", mode: "filter", test: d => has(d, "picante"), why: "Picante" },
    { t: "Nada picante", e: "🙅", mode: "avoid", test: d => has(d, "picante"), why: "Sin picante" },
    { t: "Me da igual", e: "🤷", mode: "any" }] },
  { k: "alcohol", for: ["bebida"], q: "¿Con alcohol o sin alcohol?", opts: [
    { t: "Con alcohol", e: "🍹", mode: "filter", test: d => has(d, "alcohol"), why: "Con alcohol" },
    { t: "Sin alcohol", e: "🧃", mode: "avoid", test: d => has(d, "alcohol"), why: "Sin alcohol" }] },
  { k: "temp", for: ["bebida", "postre"], q: "¿Algo frío o calientito?", opts: [
    { t: "Frío", e: "🧊", mode: "avoid", test: d => has(d, "caliente"), why: "Frío" },
    { t: "Calientito", e: "☕", mode: "filter", test: d => has(d, "caliente"), why: "Calientito" },
    { t: "Me da igual", e: "🤷", mode: "any" }] },
  { k: "compartir", for: ["comida", "postre"], q: "¿Es para ti o para compartir?", opts: [
    { t: "Para mí", e: "🙋", mode: "avoid", test: d => has(d, "compartir") },
    { t: "Para compartir", e: "👥", mode: "filter", test: d => has(d, "compartir"), why: "Para compartir" }] },
];
const MAX_Q = 4;
const apply = (list, o) => o.mode === "filter" ? list.filter(o.test) : o.mode === "avoid" ? list.filter(d => !o.test(d)) : list;
// The options of a question that actually split these dishes (null if it does not help)
function useful(dim, cands) {
  const kinds = new Set(cands.map(d => d.kind));
  if (dim.for && ![...kinds].some(k => dim.for.includes(k))) return null;
  const pool = dim.for ? cands.filter(d => dim.for.includes(d.kind)) : cands;
  const opts = dim.opts.map(o => ({ ...o, n: o.mode === "any" ? pool.length : apply(pool, o).length })).filter(o => o.n > 0);
  const real = opts.filter(o => o.mode !== "any");
  if (!real.length || opts.length < 2) return null;
  if (!real.some(o => o.n < pool.length)) return null;   // every answer leaves the same dishes
  return opts;
}
export function flatten(menu) {
  const out = [];
  for (const c of (menu && menu.cats) || []) for (const d of c.dishes || []) if (d.name) out.push({ ...d, kind: c.kind || "comida", cat: c.name });
  return out;
}
export function nextQuestion(all, answers) {
  let cands = all;
  for (const a of answers) { const r = apply(cands, a.opt); if (r.length) cands = r; }
  if (answers.length >= MAX_Q || cands.length <= 2) return { cands, q: null };
  const asked = new Set(answers.map(a => a.dim.k));
  for (const dim of DIMS) {
    if (asked.has(dim.k)) continue;
    if (dim.k !== "tipo" && answers.length === 0 && new Set(all.map(d => d.kind)).size > 1) continue;   // first: what kind
    const opts = useful(dim, cands);
    if (opts) return { cands, q: { dim, opts } };
  }
  return { cands, q: null };
}
export function recommend(cands, answers, n = 3) {
  const seed = Math.random;
  return cands.map(d => ({ d, s: answers.filter(a => a.opt.mode === "filter" && a.opt.test(d)).length + (d.special ? .6 : 0) + (d.photo ? .2 : 0) + seed() * .5 }))
    .sort((a, b) => b.s - a.s).slice(0, n).map(x => x.d);
}
// What the helper can ask with this menu (for the creator): every question that would split some dishes
export function possibleQuestions(menu) {
  const all = flatten(menu), out = [];
  if (all.length < 2) return out;
  for (const dim of DIMS) {
    const opts = dim.k === "tipo" ? (new Set(all.map(d => d.kind)).size > 1 ? useful(dim, all) : null)
      : Object.keys(KINDS).map(k => useful(dim, all.filter(d => d.kind === k))).find(Boolean);
    if (opts) out.push({ q: dim.q, opts: opts.map(o => o.e + " " + o.t) });
  }
  return out;
}

// ---------------------------------------------------------------- reading a menu from text (PDF or OCR)
// Word lists: whole words only, accents included (\b does not know that "é" is a letter)
const W = s => new RegExp(String.raw`(?<!\p{L})(?:${s})(?!\p{L})`, "iu");
const BEB = W("bebidas?|drinks?|tragos?|c[oó]cteles?|cocteler[ií]a|cervezas?|vinos?|mezcal(es)?|tequilas?|caf[eé]s?|cafeter[ií]a|jugos?|aguas?|refrescos?|licuados?|smoothies?|malteadas?|frapp?[eé]s?|t[eé]s|bar|destilados|licores|limonadas?|sodas?|naturales");
const POS = W("postres?|dulces?|reposter[ií]a|pasteles?|helados?|nieves?|desserts?");
export const guessKind = name => POS.test(name) ? "postre" : BEB.test(name) ? "bebida" : "comida";
const KW = {
  picante: W("picante|picosit[oa]|habanero|chipotle|jalape[nñ]o|serrano|diabla|chile de [aá]rbol|enchilados?|spicy|buffalo|sriracha|macha"),
  mariscos: W("camar[oó]n(es)?|pescado|pulpo|ceviche|marlin|mariscos?|at[uú]n|jaiba|ostion(es)?|salm[oó]n|langosta|aguachile|calamar(es)?|almejas?|tilapia|robalo|mojarra|pejelagarto|sushi"),
  pollo: W("pollo|pechuga|alitas?|boneless|nuggets|chicken"),
  carne: W("res|arrachera|cerdo|pastor|chorizo|costillas?|carnes?|hamburguesas?|sirloin|rib ?eye|bistec|cecina|tocino|jam[oó]n|carnitas|barbacoa|cochinita|chicharr[oó]n|asada|t-?bone|new york|picaña|filete de res|lomo|chuleta|longaniza|salchicha|hot ?dog|burger|beef|pork"),
  vegetariano: W("vegetarian[oa]s?|vegan[oa]s?|veggie|verduras|vegetales|nopales|champi[nñ]ones|hongos|setas|tofu"),
  ligero: W("ensaladas?|sopas?|caldo|consom[eé]|crema de|bowl|fruta|ligero|light|wrap|tostadas?|ceviche|aguachile|coctel de"),
  abundante: W("parrillada|plato fuerte|platillo fuerte|orden completa|combo|paquete|alambre|molcajete|costillas|chamorro|cortes?|mixiote|burritos?|tortas?|hamburguesas?|pizzas?"),
  compartir: W("para compartir|compartir|botanas?|nachos|parrillada|molcajete|tabla|charola|familiar|alitas|papas a la francesa|jarra|cubeta|para \d personas"),
  alcohol: W("cervezas?|mezcal|tequila|vinos?|c[oó]ctel(es)?|margaritas?|micheladas?|whisky|ron|vodka|gin(ebra)?|mojitos?|pi[nñ]a colada|clericot|sangr[ií]a|carajillo|cubas?|paloma|beer|brandy|cognac|aperol|spritz|lager|ipa|stout|chelas?"),
  caliente: W("caf[eé]|t[eé]|chocolate caliente|capuchino|cappuccino|latte|americano|espresso|expresso|moka|mocha|chai|atole|champurrado|carajillo|caliente"),
  fria: W("fr[ií]o|fr[ií]a|frapp?[eé]|helado|nieve|aguas?|jugo|limonada|naranjada|refresco|smoothie|malteada|cerveza|iced|soda|licuado|granizado|horchata|jamaica"),
};
export function guessTags(text, kind) {
  const out = [];
  for (const t of TAGS_FOR[kind] || TAGS_FOR.comida) if (KW[t] && KW[t].test(text)) out.push(t);
  if (out.includes("caliente") && out.includes("fria")) out.splice(out.indexOf(/frapp|iced|helad|nieve|fr[ií][oa]/i.test(text) ? "caliente" : "fria"), 1);   // "café frappé" is cold
  if (out.includes("vegetariano") && ["carne", "pollo", "mariscos"].some(t => out.includes(t))) out.splice(out.indexOf("vegetariano"), 1);
  return out;
}
const PRICE_END = /(?:^|[\s.·…_\-–—:|])\$?\s?(\d{1,4}(?:[.,]\d{2})?)(?:\s*(?:\/|-|·|,)\s*\$?\s?(\d{1,4}(?:[.,]\d{2})?))?\s*(?:mxn|m\.?n\.?|pesos|c\/u)?\s*$/i;
const ONLY_PRICE = /^\$?\s?\d{1,4}(?:[.,]\d{2})?(?:\s*(?:\/|-)\s*\$?\s?\d{1,4}(?:[.,]\d{2})?)?\s*(?:mxn|m\.?n\.?|pesos)?$/i;
const JUNK = /(www\.|https?:|@|\.com|tel[eé]fono|tel\.|whats|horario|facebook|instagram|direcci[oó]n|iva incluido|precios en|propina|servicio a domicilio|^p[aá]gina \d)/i;
const cleanName = s => s.replace(/[.·…_]{2,}.*$/, "").replace(/[\s.·…_\-–—:|$]+$/, "").replace(/^[\s•·\-–—*]+/, "").trim();
// 2 = surely a heading (all caps or ends in ":"); 1 = maybe (a short capitalized line: it is a dish if a price comes next)
const heading = s => {
  const letters = s.replace(/[^\p{L}]/gu, "");
  if (letters.length < 3 || s.length > 40 || /\.$/.test(s)) return 0;
  if (/:$/.test(s) || letters === letters.toUpperCase()) return 2;
  return s.split(/\s+/).length <= 3 && /^\p{Lu}/u.test(s) && !/\d/.test(s) ? 1 : 0;
};
const titleCase = s => s === s.toUpperCase() ? s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/(?<!\p{L})(De|Del|La|Las|El|Los|Y|Con|En|Al|A)(?!\p{L})/gu, w => w.toLowerCase()).replace(/^\p{L}/u, c => c.toUpperCase()) : s;
// lines → [{name, kind, dishes:[{name, price, desc, tags}]}]
export function parseMenuText(lines) {
  const cats = []; let cat = null, last = null, pending = null;
  const ensure = () => { if (!cat) { cat = { name: "Menú", kind: "comida", dishes: [] }; cats.push(cat); } return cat; };
  const addDish = (name, price) => {
    name = titleCase(cleanName(name)); if (name.replace(/[^\p{L}]/gu, "").length < 2) return;
    const c = ensure(); last = { name: name.slice(0, 80), price: price.replace(/\s+/g, ""), desc: "" }; c.dishes.push(last); pending = null;
  };
  const clean = lines.map(r => String(r).replace(/\s+/g, " ").trim()).filter(s => s && !JUNK.test(s));
  clean.forEach((s, i) => {
    const next = clean[i + 1] || "";
    if (ONLY_PRICE.test(s)) {
      const p = s.replace(/mxn|m\.?n\.?|pesos|\$|\s/gi, "").replace(/-/g, "/");
      if (pending) addDish(pending, p); else if (last && !last.price) last.price = p;
      return;
    }
    const m = PRICE_END.exec(s);
    if (m && /\p{L}{2}/u.test(s.slice(0, m.index))) {
      const p = m[1].replace(",", ".") + (m[2] ? "/" + m[2].replace(",", ".") : "");
      addDish(s.slice(0, m.index), p.replace(/\.00(?!\d)/g, ""));
      return;
    }
    const hd = heading(s);
    if (hd === 2 || (hd === 1 && !ONLY_PRICE.test(next))) {
      const name = titleCase(s.replace(/:$/, "").trim());
      cat = { name: name.slice(0, 60), kind: guessKind(name), dishes: [] }; cats.push(cat); last = null; pending = null;
      return;
    }
    if (last && last.desc.length < 200 && !ONLY_PRICE.test(next) && (/^[\p{Ll}(]/u.test(s) || s.length > 38 || /[,.]$/.test(s) || !last.desc)) { last.desc = (last.desc ? last.desc + " " : "") + s; return; }
    if (s.length <= 60) pending = s;
  });
  const out = cats.filter(c => c.dishes.length);
  for (const c of out) for (const d of c.dishes) { d.desc = d.desc.slice(0, 300); d.tags = guessTags(c.name + " " + d.name + " " + d.desc, c.kind); }
  return out;
}
// pdf.js text items of a page → lines in reading order (two-column menus: left column first, then the right one)
export function pdfLines(items, pageWidth) {
  const segs = [];
  const rows = [];
  for (const it of items) {
    const str = it.str; if (!str || !str.trim()) continue;
    const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || 10, w = it.width || str.length * h * .5;
    let row = rows.find(r => Math.abs(r.y - y) < h * .5);
    if (!row) { row = { y, h, items: [] }; rows.push(row); }
    row.items.push({ x, w, str, h });
  }
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x);
    let cur = null;
    for (const it of r.items) {
      const gap = cur ? it.x - (cur.x + cur.w) : 0;
      if (cur && gap < r.h * 2.2) { cur.str += (gap > r.h * .15 && !/\s$/.test(cur.str) ? " " : "") + it.str; cur.w = it.x + it.w - cur.x; }
      else { cur = { x: it.x, w: it.w, str: it.str, y: r.y }; segs.push(cur); }
    }
  }
  // a segment that is only a price goes with the text before it on the same row
  const merged = [];
  for (const s of segs.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const prev = merged[merged.length - 1];
    if (prev && prev.y === s.y && ONLY_PRICE.test(s.str.trim())) { prev.str += " " + s.str; prev.w = s.x + s.w - prev.x; continue; }
    merged.push({ ...s });
  }
  const mid = pageWidth / 2, twoCols = merged.filter(s => s.x > mid * 1.02).length > 4 && merged.filter(s => s.x < mid * .9).length > 4;
  const col = s => twoCols && s.x > mid * .96 ? 1 : 0;
  return merged.sort((a, b) => col(a) - col(b) || b.y - a.y || a.x - b.x).map(s => s.str);
}

// ---------------------------------------------------------------- the menu on screen
const CSS = `
.mn{position:absolute;inset:0;overflow:hidden;background:var(--mbg);color:var(--mink);font-family:"IBM Plex Sans",system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent}
.mn *{box-sizing:border-box}
.mn [hidden]{display:none!important}
.mn button{font:inherit;color:inherit;cursor:pointer}
.mn-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;scroll-behavior:smooth}
.mn-in{max-width:640px;margin:0 auto;padding:0 0 calc(40px + env(safe-area-inset-bottom,0px))}
.mn-brand{display:flex;justify-content:center;padding:calc(12px + env(safe-area-inset-top,0px)) 16px 0}
.mn-brand a,.mn-brand span{display:block}
.mn-brand img{height:20px;width:auto;display:block;opacity:.9}
.mn-brand.own a,.mn-brand.own span{background:#fff;border-radius:999px;padding:5px 12px;box-shadow:0 2px 10px rgba(0,0,0,.15)}
.mn-brand.own img{height:auto;max-height:26px;max-width:46vw;opacity:1}
.mn-hero{text-align:center;padding:22px 20px 18px;position:relative}
.mn-hero::before{content:"";position:absolute;left:50%;top:0;width:min(520px,120%);height:100%;transform:translateX(-50%);background:radial-gradient(60% 70% at 50% 30%,var(--mac-soft),transparent 70%);pointer-events:none}
.mn-logo{position:relative;width:96px;height:96px;margin:0 auto 12px;border-radius:50%;background:#fff;display:grid;place-items:center;overflow:hidden;box-shadow:0 6px 24px -6px rgba(0,0,0,.3),0 0 0 3px var(--mac)}
.mn-logo img{width:86%;height:86%;object-fit:contain}
.mn-hero h1{position:relative;margin:0;font-family:var(--mfh);font-weight:700;font-size:clamp(1.7rem,7vw,2.4rem);line-height:1.08;text-wrap:balance}
.mn-hero p{position:relative;margin:6px 0 0;color:var(--mmute);font-size:.95rem}
.mn-help{margin:4px 16px 18px;border-radius:20px;padding:18px;display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,var(--mac),var(--mac2));color:var(--macink);box-shadow:0 14px 30px -14px var(--mac);border:0;width:calc(100% - 32px);text-align:left;position:relative;overflow:hidden}
.mn-help::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.28) 45%,transparent 60%);transform:translateX(-100%);animation:mnShine 3.8s ease-in-out infinite 1s}
@keyframes mnShine{0%,60%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.mn-help .e{font-size:2rem;flex:none;line-height:1}
.mn-help b{display:block;font-family:var(--mfh);font-size:1.15rem;line-height:1.15}
.mn-help small{display:block;opacity:.85;font-size:.86rem;margin-top:2px}
.mn-help .go{margin-left:auto;flex:none;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-size:1.2rem;font-weight:700;background:rgba(255,255,255,.22)}
.mn-nav{position:sticky;top:0;z-index:5;background:var(--mbg);border-bottom:1px solid var(--mline);display:flex;gap:8px;overflow-x:auto;padding:10px 16px;scrollbar-width:none}
.mn-nav::-webkit-scrollbar{display:none}
.mn-nav button{flex:none;border:1px solid var(--mline);background:var(--mcard);border-radius:999px;padding:7px 14px;font-size:.86rem;font-weight:600;white-space:nowrap}
.mn-nav button.on{background:var(--mac);border-color:var(--mac);color:var(--macink)}
.mn-sec{padding:18px 16px 4px;scroll-margin-top:56px}
.mn-sec h2{margin:0 0 10px;font-family:var(--mfh);font-size:1.45rem;display:flex;align-items:center;gap:10px}
.mn-sec h2::after{content:"";flex:1;height:1px;background:var(--mline)}
.mn-dish{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--mline);cursor:pointer;scroll-margin-top:70px;transition:background .3s;border-radius:10px}
.mn-dish:last-child{border-bottom:0}
.mn-dish.flash{animation:mnFlash 1.8s ease}
@keyframes mnFlash{0%,40%{background:var(--mac-soft);box-shadow:0 0 0 8px var(--mac-soft)}100%{background:transparent;box-shadow:0 0 0 8px transparent}}
.mn-dt{flex:1;min-width:0}
.mn-dt h3{margin:0;font-size:1.02rem;font-weight:600;line-height:1.3}
.mn-dt h3 .ic{font-size:.85rem;margin-left:4px;white-space:nowrap}
.mn-dt h3 .nw{font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;background:var(--mac);color:var(--macink);border-radius:999px;padding:2px 7px;margin-left:6px;vertical-align:2px}
.mn-dt p{margin:3px 0 0;color:var(--mmute);font-size:.88rem;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mn-pr{display:block;margin-top:5px;font-weight:700;color:var(--mpr)}
.mn-th{flex:none;width:84px;height:84px;border-radius:14px;object-fit:cover;background:var(--mcard)}
.mn-spec{margin:6px 16px 10px;border-radius:22px;background:var(--mcard);border:1px solid var(--mline);overflow:hidden;box-shadow:0 18px 40px -24px rgba(0,0,0,.45)}
.mn-spec .k{display:flex;align-items:center;gap:8px;padding:12px 16px 0;font-weight:700;font-size:.74rem;letter-spacing:.16em;text-transform:uppercase;color:var(--mpr)}
.mn-spec .stage{position:relative;height:260px;margin-top:8px;background:radial-gradient(70% 70% at 50% 60%,var(--mac-soft),transparent 75%)}
.mn-spec model-viewer{width:100%;height:100%;--poster-color:transparent;background:transparent}
.mn-spec model-viewer::part(default-ar-button){display:none}
.mn-spec .stage .mvload{position:absolute;inset:0;display:grid;place-items:center;color:var(--mmute);font-size:.86rem;pointer-events:none}
.mn-spec .stage .hint3d{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);font-size:.74rem;color:var(--mmute);background:var(--mcard);padding:3px 10px;border-radius:999px;pointer-events:none;white-space:nowrap}
.mn-spec .ph{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;margin-top:10px}
.mn-spec .bd{padding:12px 16px 16px}
.mn-spec h3{margin:0;font-family:var(--mfh);font-size:1.35rem}
.mn-spec p{margin:4px 0 0;color:var(--mmute);font-size:.92rem;line-height:1.45}
.mn-spec .row{display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap}
.mn-ar{border:0;border-radius:999px;padding:12px 18px;font-weight:700;background:var(--mac);color:var(--macink);display:inline-flex;align-items:center;gap:8px;box-shadow:0 8px 20px -8px var(--mac)}
.mn-ar svg{width:20px;height:20px;fill:currentColor}
.mn-arno{font-size:.82rem;color:var(--mmute)}
.mn-foot{padding:24px 16px 0;text-align:center;color:var(--mmute);font-size:.85rem}
.mn-foot .legend{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 14px;margin-bottom:12px}
.mn-social{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;margin:14px 0}
.mn-social a{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--mcard);border:1px solid var(--mline)}
.mn-social svg{width:21px;height:21px;fill:var(--mink)}
.mn-orig{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--mline);background:var(--mcard);border-radius:999px;padding:10px 16px;font-weight:600;margin:6px 0 10px}
.mn-sheet{position:absolute;inset:0;z-index:20;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .25s}
.mn-sheet.on{opacity:1;pointer-events:auto}
.mn-card{position:relative;width:100%;max-width:560px;max-height:92%;overflow-y:auto;background:var(--mbg);border-radius:24px 24px 0 0;padding:18px 18px calc(22px + env(safe-area-inset-bottom,0px));transform:translateY(30px);transition:transform .3s cubic-bezier(.2,.9,.3,1.2);box-shadow:0 -10px 40px rgba(0,0,0,.3)}
.mn-sheet.on .mn-card{transform:none}
.mn-x{position:absolute;right:12px;top:12px;width:38px;height:38px;border-radius:50%;border:0;background:var(--mcard);font-size:1.2rem;line-height:1;display:grid;place-items:center;z-index:2}
.mn-dots{display:flex;gap:6px;margin:4px 0 14px}
.mn-dots i{width:22px;height:5px;border-radius:3px;background:var(--mline)}
.mn-dots i.on{background:var(--mac)}
.mn-q{margin:0 44px 16px 0;font-family:var(--mfh);font-size:1.55rem;line-height:1.15}
.mn-opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.mn-opts button{border:1.5px solid var(--mline);background:var(--mcard);border-radius:18px;padding:16px 10px;display:flex;flex-direction:column;align-items:center;gap:6px;font-weight:600;font-size:.95rem;text-align:center;transition:transform .15s,border-color .15s}
.mn-opts button:active{transform:scale(.96)}
.mn-opts button:hover{border-color:var(--mac)}
.mn-opts button .e{font-size:2rem;line-height:1}
.mn-opts button.any{grid-column:1/-1;flex-direction:row;justify-content:center;padding:11px;font-size:.88rem;color:var(--mmute);background:transparent}
.mn-opts button.any .e{font-size:1.1rem}
.mn-opts.n1 button:not(.any),.mn-opts.n3 button:first-child:not(.any){grid-column:1/-1}
.mn-back{margin-top:12px;border:0;background:none;color:var(--mmute);font-size:.88rem;text-decoration:underline;padding:4px 0}
.mn-res .k{font-weight:700;font-size:.74rem;letter-spacing:.16em;text-transform:uppercase;color:var(--mpr);margin:2px 0 8px}
.mn-top{border-radius:20px;overflow:hidden;background:var(--mcard);border:2px solid var(--mac);box-shadow:0 14px 34px -18px var(--mac)}
.mn-top img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block}
.mn-top .bd{padding:14px 16px}
.mn-top h3{margin:0;font-family:var(--mfh);font-size:1.4rem;line-height:1.15}
.mn-top p{margin:5px 0 0;color:var(--mmute);font-size:.9rem;line-height:1.45}
.mn-why{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.mn-why span{font-size:.76rem;font-weight:600;border-radius:999px;padding:4px 10px;background:var(--mac-soft);color:var(--mink)}
.mn-alt{display:flex;gap:10px;align-items:center;padding:10px;border-radius:14px;background:var(--mcard);margin-top:8px;cursor:pointer;border:1px solid var(--mline)}
.mn-alt img{width:56px;height:56px;border-radius:10px;object-fit:cover;flex:none}
.mn-alt b{display:block;font-size:.95rem}
.mn-alt small{color:var(--mpr);font-weight:700}
.mn-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.mn-btn{border:0;border-radius:999px;padding:12px 18px;font-weight:700;font-size:.92rem;background:var(--mac);color:var(--macink)}
.mn-btn.gh{background:var(--mcard);color:var(--mink);border:1px solid var(--mline)}
.mn-surp{display:block;margin:14px auto 0;border:0;background:none;color:var(--mmute);font-size:.88rem;text-decoration:underline}
.mn-det img{width:calc(100% + 36px);margin:-18px -18px 14px;aspect-ratio:4/3;object-fit:cover;display:block;border-radius:24px 24px 0 0}
.mn-det h3{margin:0 44px 0 0;font-family:var(--mfh);font-size:1.5rem;line-height:1.15}
.mn-det p{color:var(--mmute);line-height:1.5;margin:8px 0 0}
.mn-pages{position:absolute;inset:0;z-index:25;background:#111;overflow-y:auto;padding:calc(56px + env(safe-area-inset-top,0px)) 0 30px}
.mn-pages img{display:block;width:100%;max-width:900px;margin:0 auto 10px;background:#fff}
.mn-pages .mn-x{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));right:12px;background:rgba(255,255,255,.9);color:#111}
.mn-pages .t{position:fixed;top:calc(14px + env(safe-area-inset-top,0px));left:16px;color:#fff;font-weight:700;background:rgba(0,0,0,.5);padding:6px 12px;border-radius:999px;font-size:.85rem}
.mn-empty{padding:40px 24px;text-align:center;color:var(--mmute)}
@media (prefers-reduced-motion:reduce){.mn-help::after{animation:none}.mn-card,.mn-sheet{transition:none}.mn-scroll{scroll-behavior:auto}}
`;
const AR_ICON = '<svg viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3 6.7 3.7L12 11.7 5.3 8 12 4.3zM5 9.7l6 3.4v6.6l-6-3.3V9.7zm8 10V13l6-3.4v6.7l-6 3.4z"/></svg>';

let mvP = null;
const loadModelViewer = () => mvP || (mvP = new Promise((ok, bad) => {
  if (customElements.get("model-viewer")) return ok();
  const s = document.createElement("script"); s.type = "module"; s.src = MV_SRC;
  s.onload = () => customElements.whenDefined("model-viewer").then(ok); s.onerror = () => { mvP = null; bad(new Error("model-viewer")); };
  document.head.appendChild(s);
}));

export function run(o) {
  const root = o.root;
  if (!document.getElementById("mn-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "mn-css", textContent: CSS }));
  if (!document.getElementById("mn-fonts")) document.head.appendChild(Object.assign(document.createElement("link"), { id: "mn-fonts", rel: "stylesheet", href: FONT_CSS }));
  const el = document.createElement("div"); el.className = "mn";
  el.innerHTML = '<div class="mn-scroll"><div class="mn-in"></div></div><div class="mn-sheet" role="dialog" aria-modal="true"><div class="mn-card"></div></div>';
  root.appendChild(el);
  const scroller = el.querySelector(".mn-scroll"), inner = el.querySelector(".mn-in"), sheet = el.querySelector(".mn-sheet"), card = el.querySelector(".mn-card");
  const models = new Map();   // src → <model-viewer> kept between renders (the preview re-renders while typing)
  let cfg = o.cfg, all = [], byId = new Map();

  const src = id => (id ? o.src(id) : "");
  function theme() {
    const m = cfg.menu || {}, T = THEMES[m.theme] || THEMES.clasico, ac = /^#[0-9a-f]{6}$/i.test(m.color || "") ? m.color : "#b8322a";
    const n = parseInt(ac.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, dk = (v, k) => Math.round(v * k);
    el.style.cssText = `--mbg:${T.bg};--mcard:${T.card};--mink:${T.ink};--mmute:${T.mute};--mline:${T.line};--mfh:${T.fh};--mac:${ac};--mac2:rgb(${dk(r, .72)},${dk(g, .72)},${dk(b, .72)});--macink:${onAccent(ac)};--mac-soft:rgba(${r},${g},${b},${T.dark ? .22 : .14});--mpr:${T.dark && lum(ac) < .08 ? "#f4eee8" : !T.dark && lum(ac) > .5 ? T.ink : ac}`;
  }
  function brandHtml() {
    const b = o.brand; if (!b) return "";
    const img = `<img src="${esc(b.src)}" alt="${b.own ? "" : "Vórtice VR"}">`;
    return `<div class="mn-brand${b.own ? " own" : ""}">${b.href ? `<a href="${esc(b.href)}" target="_blank" rel="noopener">${img}</a>` : `<span>${img}</span>`}</div>`;
  }
  function dishRow(d, cur) {
    const ic = (d.tags || []).filter(t => ROW_TAGS.includes(t)).map(t => TAGS[t].e).join(" ");
    return `<article class="mn-dish" id="mnd-${d.id}" data-d="${d.id}"><div class="mn-dt"><h3>${esc(d.name)}${ic ? `<span class="ic" aria-label="${(d.tags || []).filter(t => ROW_TAGS.includes(t)).map(t => TAGS[t].t).join(", ")}">${ic}</span>` : ""}${has(d, "nuevo") ? '<span class="nw">Nuevo</span>' : ""}</h3>${d.desc ? `<p>${esc(d.desc)}</p>` : ""}${d.price ? `<span class="mn-pr">${esc(priceText(d.price, cur))}</span>` : ""}</div>${d.photo ? `<img class="mn-th" loading="lazy" src="${esc(src(d.photo))}" alt="">` : ""}</article>`;
  }
  function specHtml(d, cur) {
    const stage = d.model ? `<div class="stage" data-mv="${esc(src(d.model))}" data-cm="${d.cm || 28}"><div class="mvload">Cargando 3D…</div></div>` : d.photo ? `<img class="ph" src="${esc(src(d.photo))}" alt="">` : "";
    return `<section class="mn-spec" data-spec="${d.id}"><div class="k">✦ Platillo especial</div>${stage}<div class="bd"><h3>${esc(d.name)}</h3>${d.desc ? `<p>${esc(d.desc)}</p>` : ""}<div class="row">${d.price ? `<b class="mn-pr" style="margin:0;font-size:1.1rem">${esc(priceText(d.price, cur))}</b>` : ""}${d.model ? `<button class="mn-ar" type="button" data-ar hidden>${AR_ICON}Verlo en tu mesa</button><span class="mn-arno" data-arno hidden>Abre este menú en tu celular para verlo en tu mesa.</span>` : ""}</div></div></section>`;
  }
  function render() {
    const m = cfg.menu || {}, cur = m.currency || "$", top = scroller.scrollTop;
    all = flatten(m); byId = new Map(all.map(d => [d.id, d]));
    theme();
    const cats = (m.cats || []).filter(c => (c.dishes || []).some(d => d.name));
    const specials = all.filter(d => d.special);
    const usedTags = new Set(all.flatMap(d => d.tags || []).filter(t => ROW_TAGS.includes(t)));
    let h = brandHtml();
    h += `<header class="mn-hero">${m.logo ? `<div class="mn-logo"><img src="${esc(src(m.logo))}" alt=""></div>` : ""}<h1>${esc(cfg.title || "Nuestro menú")}</h1>${m.sub ? `<p>${esc(m.sub)}</p>` : ""}</header>`;
    if (m.helper !== false && all.length >= 2) h += `<button class="mn-help" type="button" data-help><span class="e" aria-hidden="true">🤔</span><span><b>¿No sabes qué pedir?</b><small>Te hago unas preguntas y te digo qué se te antoja.</small></span><span class="go" aria-hidden="true">→</span></button>`;
    h += specials.map(d => specHtml(d, cur)).join("");
    if (cats.length > 1 || m.pages && m.pages.length) h += `<nav class="mn-nav" aria-label="Secciones">${cats.map(c => `<button type="button" data-go="${c.id}">${esc(c.name)}</button>`).join("")}${m.pages && m.pages.length ? '<button type="button" data-orig>📄 Menú original</button>' : ""}</nav>`;
    h += cats.map(c => `<section class="mn-sec" id="mns-${c.id}" data-sec="${c.id}"><h2>${esc(c.name)}</h2>${c.dishes.filter(d => d.name).map(d => dishRow(d, cur)).join("")}</section>`).join("");
    if (!cats.length) h += `<div class="mn-empty">Aquí aparecerán tus platillos.</div>`;
    h += `<footer class="mn-foot">${usedTags.size ? `<div class="legend">${[...usedTags].map(t => `<span>${TAGS[t].e} ${TAGS[t].t}</span>`).join("")}</div>` : ""}${m.pages && m.pages.length ? '<button class="mn-orig" type="button" data-orig>📄 Ver el menú original</button>' : ""}${(o.buttons || []).length ? `<div class="mn-social">${o.buttons.map(b => `<a href="${esc(b.href)}" target="_blank" rel="noopener" aria-label="${esc(b.label)}">${b.svg}</a>`).join("")}</div>` : ""}${m.note ? `<p>${esc(m.note)}</p>` : ""}</footer>`;
    inner.innerHTML = h;
    // 3D stages: the same <model-viewer> is moved back in (no reload while the creator types)
    inner.querySelectorAll("[data-mv]").forEach(st => mountModel(st));
    scroller.scrollTop = top;
    spy();
  }
  function mountModel(st) {
    const url = st.dataset.mv, cm = +st.dataset.cm || 28;
    let mv = models.get(url);
    const ready = () => {
      st.querySelector(".mvload")?.remove();
      const sec = st.closest(".mn-spec"), btn = sec.querySelector("[data-ar]"), no = sec.querySelector("[data-arno]");
      if (!st.querySelector(".hint3d")) st.appendChild(Object.assign(document.createElement("span"), { className: "hint3d", textContent: "Gíralo con el dedo" }));
      if (btn) {
        const show = () => { btn.hidden = !mv.canActivateAR; no.hidden = !!mv.canActivateAR || !!o.embedded; };
        show(); setTimeout(show, 600); setTimeout(show, 2500);   // canActivateAR is known a moment after the model loads
        btn.onclick = () => mv.activateAR();
      }
    };
    const fit = () => {   // real size: its widest side on the table = cm
      try {
        if (!mv.baseW) { const d = mv.getDimensions(); mv.baseW = Math.max(d.x, d.z) || 1; }   // getDimensions() already includes the scale: measure once, at 1
        const k = (cm / 100) / mv.baseW; mv.scale = `${k} ${k} ${k}`; mv.dataset.cm = cm;
      } catch (e) {}
    };
    if (!mv) {
      loadModelViewer().then(() => {
        mv = document.createElement("model-viewer");
        Object.assign(mv, {});
        mv.setAttribute("src", url); mv.setAttribute("alt", "Platillo en 3D");
        for (const [k, v] of [["camera-controls", ""], ["auto-rotate", ""], ["auto-rotate-delay", "800"], ["rotation-per-second", "24deg"], ["shadow-intensity", "1"], ["environment-image", "neutral"], ["exposure", "1.05"], ["ar", ""], ["ar-modes", "webxr scene-viewer quick-look"], ["ar-scale", "fixed"], ["ar-placement", "floor"], ["interaction-prompt", "none"], ["touch-action", "pan-y"], ["loading", "eager"]]) mv.setAttribute(k, v);
        mv.addEventListener("load", () => { fit(); mv.vvrReady = true; const s = mv.parentElement; if (s) ready(); });
        mv.addEventListener("error", () => { const s = mv.parentElement; if (s) { const l = s.querySelector(".mvload"); if (l) l.textContent = "No se pudo cargar el 3D."; } });
        models.set(url, mv);
        if (st.isConnected) { st.prepend(mv); }
      }).catch(() => { const l = st.querySelector(".mvload"); if (l) l.textContent = "No se pudo cargar el 3D."; });
      return;
    }
    st.prepend(mv);
    if (mv.vvrReady) { if (+mv.dataset.cm !== cm) fit(); ready(); }
  }
  // the chip of the section on view
  let spyT = 0;
  function spy() {
    const nav = inner.querySelector(".mn-nav"); if (!nav) return;
    const secs = [...inner.querySelectorAll("[data-sec]")], y = scroller.scrollTop + 80;
    let on = secs[0]; for (const s of secs) if (s.offsetTop <= y) on = s;
    nav.querySelectorAll("[data-go]").forEach(b => { const a = on && b.dataset.go === on.dataset.sec; if (a !== b.classList.contains("on")) { b.classList.toggle("on", a); if (a) b.scrollIntoView({ block: "nearest", inline: "center" }); } });
  }
  scroller.addEventListener("scroll", () => { cancelAnimationFrame(spyT); spyT = requestAnimationFrame(spy); }, { passive: true });

  // ---- sheets: dish detail, helper, original menu
  const open = html => { card.innerHTML = `<button class="mn-x" type="button" data-close aria-label="Cerrar">✕</button>` + html; card.scrollTop = 0; sheet.classList.add("on"); };
  const close = () => sheet.classList.remove("on");
  sheet.addEventListener("click", e => { if (e.target === sheet || e.target.closest("[data-close]")) close(); });
  function detail(d) {
    const cur = (cfg.menu || {}).currency || "$";
    open(`<div class="mn-det">${d.photo ? `<img src="${esc(src(d.photo))}" alt="">` : ""}<h3>${esc(d.name)}</h3>${d.price ? `<b class="mn-pr" style="font-size:1.15rem">${esc(priceText(d.price, cur))}</b>` : ""}${d.desc ? `<p>${esc(d.desc)}</p>` : ""}${(d.tags || []).length ? `<div class="mn-why">${d.tags.map(t => `<span>${TAGS[t].e} ${TAGS[t].t}</span>`).join("")}</div>` : ""}${d.special && d.model ? '<div class="mn-acts"><button class="mn-btn" type="button" data-see3d>Ver en 3D ✦</button></div>' : ""}</div>`);
    const b = card.querySelector("[data-see3d]"); if (b) b.onclick = () => { close(); const s = inner.querySelector(`[data-spec="${d.id}"]`); if (s) scroller.scrollTo({ top: s.offsetTop - 10 }); };
  }
  function goDish(id) {
    close();
    const r = inner.querySelector("#mnd-" + id); if (!r) return;
    scroller.scrollTo({ top: r.offsetTop - 70 });
    r.classList.remove("flash"); void r.offsetWidth; r.classList.add("flash");
  }
  // the helper: one question at a time, then 3 dishes
  let answers = [];
  function helper(preset) {
    answers = preset ? [preset] : [];
    step();
  }
  function step() {
    const { cands, q } = nextQuestion(all, answers);
    if (!q) return results(cands);
    const total = Math.min(MAX_Q, answers.length + 1 + (q.dim.k === "tipo" ? 2 : 1));
    const dots = Array.from({ length: Math.max(total, answers.length + 1) }, (_, i) => `<i class="${i <= answers.length ? "on" : ""}"></i>`).join("");
    const real = q.opts.filter(x => x.mode !== "any");
    open(`<div class="mn-dots">${dots}</div><h3 class="mn-q">${esc(q.dim.q)}</h3><div class="mn-opts n${real.length}">${q.opts.map((x, i) => `<button type="button" class="${x.mode === "any" ? "any" : ""}" data-o="${i}"><span class="e" aria-hidden="true">${x.e}</span>${esc(x.t)}</button>`).join("")}</div>${answers.length ? '<button class="mn-back" type="button" data-back>← Atrás</button>' : '<button class="mn-surp" type="button" data-surp>Mejor sorpréndeme 🎲</button>'}`);
    card.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { answers.push({ dim: q.dim, opt: q.opts[+b.dataset.o] }); if (window.vvrSparkle) try { const r = b.getBoundingClientRect(); window.vvrSparkle(r.left + r.width / 2, r.top + r.height / 2); } catch (e) {} step(); });
    const bk = card.querySelector("[data-back]"); if (bk) bk.onclick = () => { answers.pop(); step(); };
    const sp = card.querySelector("[data-surp]"); if (sp) sp.onclick = () => results(all, true);
  }
  function results(cands, surprise) {
    const cur = (cfg.menu || {}).currency || "$";
    const list = surprise ? recommend(cands, [], 3) : recommend(cands, answers, 3);
    if (!surprise && list.length < 3) {   // few left: fill with dishes of the same kind
      const tipo = answers.find(a => a.dim.k === "tipo"), pool = (tipo ? all.filter(tipo.opt.test) : all).filter(d => !list.includes(d) && !list.some(x => x.id === d.id));
      list.push(...recommend(pool, answers, 3 - list.length));
    }
    if (!list.length) { open('<p class="mn-q">Todavía no hay platillos.</p>'); return; }
    const [top, ...rest] = list;
    const why = surprise ? ["🎲 Sorpresa"] : answers.filter(a => a.opt.why && a.opt.test && (a.opt.mode === "avoid" ? !a.opt.test(top) : a.opt.test(top))).map(a => a.opt.why);
    if (top.special) why.unshift("✦ Especial de la casa");
    const kinds = new Set(all.map(d => d.kind)), chosen = answers.find(a => a.dim.k === "tipo");
    const more = !surprise && chosen && chosen.opt.t === "Algo de comer" && kinds.has("bebida") ? '<button class="mn-btn gh" type="button" data-drink>¿Y de tomar? 🥤</button>' : "";
    open(`<div class="mn-res"><div class="k">${surprise ? "¿Qué tal esto?" : "Te recomiendo"}</div><div class="mn-top" data-pick="${top.id}">${top.photo ? `<img src="${esc(src(top.photo))}" alt="">` : ""}<div class="bd"><h3>${esc(top.name)}</h3>${top.price ? `<b class="mn-pr">${esc(priceText(top.price, cur))}</b>` : ""}${top.desc ? `<p>${esc(top.desc)}</p>` : ""}${why.length ? `<div class="mn-why">${why.map(w => `<span>${esc(w)}</span>`).join("")}</div>` : ""}</div></div>${rest.length ? `<div class="k" style="margin-top:16px">También te puede gustar</div>${rest.map(d => `<div class="mn-alt" data-pick="${d.id}">${d.photo ? `<img src="${esc(src(d.photo))}" alt="">` : ""}<div><b>${esc(d.name)}</b>${d.price ? `<small>${esc(priceText(d.price, cur))}</small>` : ""}</div></div>`).join("")}` : ""}<div class="mn-acts"><button class="mn-btn" type="button" data-see="${top.id}">Ver en el menú</button>${more}<button class="mn-btn gh" type="button" data-again>Otra vez</button></div></div>`);
    card.querySelectorAll("[data-pick]").forEach(x => x.onclick = () => goDish(x.dataset.pick));
    card.querySelector("[data-see]").onclick = () => goDish(top.id);
    card.querySelector("[data-again]").onclick = () => helper();
    const dr = card.querySelector("[data-drink]"); if (dr) dr.onclick = () => helper({ dim: DIMS[0], opt: DIMS[0].opts[1] });
    if (window.vvrSparkle && !o.embedded) try { const r = card.getBoundingClientRect(); for (let i = 0; i < 3; i++) setTimeout(() => window.vvrSparkle(r.left + r.width * (.25 + .25 * i), r.top + 80), i * 120); } catch (e) {}
  }
  function pages() {
    const m = cfg.menu || {}; if (!m.pages || !m.pages.length) return;
    const p = document.createElement("div"); p.className = "mn-pages";
    p.innerHTML = `<span class="t">Menú original</span><button class="mn-x" type="button" aria-label="Cerrar">✕</button>${m.pages.map((id, i) => `<img src="${esc(src(id))}" alt="Página ${i + 1} del menú" loading="${i < 2 ? "eager" : "lazy"}">`).join("")}`;
    p.querySelector(".mn-x").onclick = () => p.remove();
    el.appendChild(p);
  }
  inner.addEventListener("click", e => {
    const t = e.target;
    if (t.closest("[data-help]")) return helper();
    if (t.closest("[data-orig]")) return pages();
    const go = t.closest("[data-go]"); if (go) { const s = inner.querySelector("#mns-" + go.dataset.go); if (s) scroller.scrollTo({ top: s.offsetTop - 52 }); return; }
    if (t.closest("model-viewer,[data-ar],a")) return;
    const d = t.closest("[data-d]"); if (d && byId.get(d.dataset.d)) detail(byId.get(d.dataset.d));
  });
  render();
  return {
    update(c) { cfg = c; render(); if (sheet.classList.contains("on")) close(); },
    openHelper() { scroller.scrollTop = 0; helper(); },
    destroy() { el.remove(); },
  };
}
