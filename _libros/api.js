// Libros interactivos (data.kind = "libro", 2 de noviembre de 2026): libros digitales cortos que se leen, se escuchan y
// se juegan dentro de la biblioteca de Vórtice VR (vorticevr.mx/biblioteca/ y /biblioteca/<slug>/). Lo arma su creador
// en /crear/libro/ y lo lee assets/libro.js. Este archivo: la validación (cleanLibro), lo que ve el público (las páginas
// de pago nunca salen sin compra), el acceso con los archivos firmados de las páginas de pago, la compra y el "Apoyar
// al autor" (Stripe Checkout, pago único) y el directorio de la biblioteca.
// Las ventas y los apoyos se guardan en c_orders de los cursos (course_id = "libro:<id del libro>", item_kind = "libro" |
// "apoyo"): así la comisión (c_settings.commission_pct), los reembolsos (charge.refunded) y los cortes quincenales con la
// CLABE del autor (users.payout) son los mismos de los cursos.

export const LIBRO = {
  pages: { min: 3, max: 24 }, words: 60, chars: 420,
  tipos: ["cuento", "educativo", "libre"],
  edades: ["3-5", "6-8", "9-12", "todos"],
  temas: ["cuentos", "lectura", "ciencias", "naturaleza", "historia", "valores", "matematicas", "otro"],
  estilos: ["clasico", "acuarela", "comic", "cuaderno", "noche"],
  lays: ["portada", "imagen", "lado", "completa", "texto", "pregunta", "juego", "fin", "autores"],
  juegos: ["sopa", "memorama", "rompecabezas"],
  sell: ["pro", "premium", "empresarial", "escuela"],   // the plans that can sell or receive support (César: Pro y Premium; the legacy paid ones keep it)
  price: { min: 10, max: 999 }, apoyo: { min: 10, max: 5000 },
};
const ID = /^[a-z0-9]{6,16}$/;
const one = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
const para = (v, n) => String(v || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
const words = t => (String(t || "").match(/\S+/g) || []).length;
export const newBookId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

// Which pages are free: all of them, unless it is for sale (the first `gratis`, the cover included)
export const freeCount = L => L.venta && L.venta.modo === "venta" ? Math.max(1, Math.min(L.pages.length - 1, L.venta.gratis || 3)) : L.pages.length;
const filesOf = p => [p.img, p.aud, p.q && p.q.aud, ...(p.g && Array.isArray(p.g.pairs) ? p.g.pairs.flatMap(x => [x.a && x.a.img, x.b && x.b.img]) : [])].filter(Boolean);

// The book as the creator sends it → what is stored. list = data.items ({id, type: foto | audio, w, h}).
export function cleanLibro(d, list, P) {
  d = d || {};
  const all = new Map((Array.isArray(list) ? list : []).filter(i => i && ID.test(i.id) && (i.type === "foto" || i.type === "audio")).map(i => [i.id, i]));
  const items = [], used = new Map();
  const file = (id, type, what) => {
    if (!id) return null;
    const m = all.get(id);
    if (!m || m.type !== type) return { error: `Falta ${what}. Vuelve a subirla.` };
    if (!used.has(id)) {
      const it = { id, type };
      if (type === "foto") { it.w = Math.round(Number(m.w)) || 0; it.h = Math.round(Number(m.h)) || 0; if (!(it.w > 0 && it.w <= 4000 && it.h > 0 && it.h <= 4000)) return { error: "Faltan las medidas de una de tus imágenes." }; }
      used.set(id, it); items.push(it);
    }
    return id;
  };
  const src = Array.isArray(d.pages) ? d.pages : [];
  if (src.length < LIBRO.pages.min) return { error: `Tu libro necesita al menos ${LIBRO.pages.min} páginas.` };
  if (src.length > LIBRO.pages.max) return { error: `Un libro puede tener hasta ${LIBRO.pages.max} páginas: mejor cortito y que se disfrute.` };
  const pages = [], ids = new Set();
  for (const [k, p] of src.entries()) {
    const n = k + 1;
    if (!p || !ID.test(String(p.id || "")) || ids.has(p.id)) return { error: `La página ${n} no es válida.` };
    ids.add(p.id);
    const lay = LIBRO.lays.includes(p.lay) ? p.lay : "imagen", pg = { id: p.id, lay };
    const role = one(p.role, 20).replace(/[^a-z-]/g, ""); if (role) pg.role = role;
    const t = one(p.t, 80); if (t) pg.t = t;
    const raw = para(p.x, 4000), x = raw.slice(0, LIBRO.chars);
    if (raw.length > LIBRO.chars) return { error: `El texto de la página ${n} es muy largo (máximo ${LIBRO.chars} letras). Pártelo en dos páginas.` };
    if (x && words(x) > LIBRO.words && lay !== "autores") return { error: `La página ${n} tiene ${words(x)} palabras. Déjala en ${LIBRO.words} o menos: así se lee y se escucha mejor (puedes partirla en dos páginas).` };
    if (x) pg.x = x;
    const credit = one(p.credit, 120); if (credit) pg.credit = credit;
    for (const [k2, type, what] of [["img", "foto", `la imagen de la página ${n}`], ["aud", "audio", `el audio de la página ${n}`]]) {
      if (!p[k2]) continue;
      const r = file(p[k2], type, what); if (r && r.error) return r; pg[k2] = r;
    }
    if (lay === "portada" && !pg.t) return { error: "Escribe el título en la portada." };
    if (lay === "pregunta") {
      const q = p.q || {}, ops = (Array.isArray(q.ops) ? q.ops : []).map(o => one(o && o.t, 60)).filter(Boolean);
      const qp = one(q.p, 160);
      if (!qp) return { error: `Escribe la pregunta de la página ${n}.` };
      if (ops.length < 2 || ops.length > 4) return { error: `La pregunta de la página ${n} necesita de 2 a 4 respuestas.` };
      const ok = Math.round(Number(q.ok)); if (!(ok >= 0 && ok < ops.length)) return { error: `Marca la respuesta correcta de la página ${n}.` };
      pg.q = { p: qp, ops: ops.map(t => ({ t })), ok };
      const why = one(q.why, 200); if (why) pg.q.why = why;
    } else if (lay === "juego") {
      const g = p.g || {}, k3 = LIBRO.juegos.includes(g.k) ? g.k : null;
      if (!k3) return { error: `Elige el juego de la página ${n}.` };
      if (k3 === "sopa") {
        const w = (Array.isArray(g.words) ? g.words : []).map(v => one(v, 16)).filter(v => v && sopaLetters(v) >= 2 && sopaLetters(v) <= 10);
        if (w.length < 3 || w.length > 8) return { error: `La sopa de letras de la página ${n} necesita de 3 a 8 palabras (de 2 a 10 letras).` };
        pg.g = { k: k3, words: [...new Set(w)] };
      } else if (k3 === "memorama") {
        const mode = g.mode === "parejas" ? "parejas" : "iguales", pairs = [];
        for (const pr of (Array.isArray(g.pairs) ? g.pairs : []).slice(0, 6)) {
          const side = s => { if (s && s.img) { const r = file(s.img, "foto", `una imagen del memorama de la página ${n}`); return r && r.error ? r : { img: r }; } const tt = one(s && s.t, 30); return tt ? { t: tt } : null; };
          const a = side(pr && pr.a); if (a && a.error) return a;
          const b = mode === "parejas" ? side(pr && pr.b) : null; if (b && b.error) return b;
          if (a && (mode === "iguales" || b)) pairs.push(mode === "parejas" ? { a, b } : { a });
        }
        if (pairs.length < 3) return { error: `El memorama de la página ${n} necesita al menos 3 pares completos.` };
        pg.g = { k: k3, mode, pairs };
      } else {
        const r = file(g.img, "foto", `la imagen del rompecabezas de la página ${n}`);
        if (!r) return { error: `Elige la imagen del rompecabezas de la página ${n}.` };
        if (r.error) return r;
        pg.g = { k: k3, img: r, level: g.level === "normal" ? "normal" : "facil" };
      }
      if (!pg.t) pg.t = k3 === "sopa" ? "Encuentra las palabras" : k3 === "memorama" ? "Encuentra los pares" : "Arma la imagen";
    } else if (!pg.x && !pg.img && !pg.t) return { error: `La página ${n} está vacía: escribe algo o pon una imagen.` };
    pages.push(pg);
  }
  if (pages[0].lay !== "portada") return { error: "La primera página es la portada." };
  const tipo = LIBRO.tipos.includes(d.tipo) ? d.tipo : "cuento";
  const libro = {
    name: one(d.name, 80) || pages[0].t, autor: one(d.autor, 120), sub: para(d.sub, 300), tipo,
    edad: LIBRO.edades.includes(d.edad) ? d.edad : "todos", tema: LIBRO.temas.includes(d.tema) ? d.tema : tipo === "cuento" ? "cuentos" : "otro",
    estilo: LIBRO.estilos.includes(d.estilo) ? d.estilo : "clasico", pages,
  };
  if (ID.test(String(d.id || ""))) libro.id = d.id;   // the publish step keeps the stored one (a new book gets a new one)
  const v = d.venta || {}, modo = ["venta", "apoyo"].includes(v.modo) ? v.modo : "gratis";
  libro.venta = { modo };
  if (modo !== "gratis" && !LIBRO.sell.includes(P.id)) return { error: "Vender tu libro o recibir apoyos es de los planes Pro y Premium. Déjalo gratis o mejora tu plan.", plan: true };
  if (modo === "venta") {
    const precio = Math.round(Number(v.precio));
    if (!(precio >= LIBRO.price.min && precio <= LIBRO.price.max)) return { error: `El precio va de $${LIBRO.price.min} a $${LIBRO.price.max} pesos.` };
    libro.venta.precio = precio;
    libro.venta.gratis = Math.max(1, Math.min(pages.length - 1, Math.round(Number(v.gratis)) || 3));
  }
  // files only used by pages after the free ones are "locked": stored as p/<id> and served signed (see publish in worker.js)
  const free = freeCount(libro), open = new Set(pages.slice(0, free).flatMap(filesOf));
  for (const it of items) if (!open.has(it.id)) it.lock = 1;
  return { libro, items };
}
const sopaLetters = s => String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-ZÑ]/g, "").length;

// What anyone can see: the free pages (and how many more there are)
export function publicLibro(row, d) {
  const L = d.libro || { pages: [] }, free = freeCount(L), pages = L.pages.slice(0, free);
  const open = new Set(pages.flatMap(filesOf));
  const { pages: _, ...rest } = L;
  return { slug: row.slug, kind: "libro", title: row.title, libro: { ...rest, pages, total: L.pages.length, locked: L.pages.length - free },
    items: (d.items || []).filter(i => open.has(i.id) && !i.lock), updated: row.updated, expires: row.expires };
}

// ---------- signed files of the pages for sale (/m/<slug>/p/<id>?k=<until>.<sig>) ----------
const enc = new TextEncoder();
async function sig(env, data) {
  if (!env.SESSION_SECRET) throw new Error("Falta SESSION_SECRET");   // never a guessable default
  const key = await crypto.subtle.importKey("raw", enc.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode("libro:" + data))))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 32);
}
export async function lockedMediaOk(env, slug, id, k) {
  const m = /^(\d{10,14})\.([\w-]{20,40})$/.exec(String(k || ""));
  if (!m || +m[1] <= Date.now()) return false;
  const want = await sig(env, `${slug}/${id}/${m[1]}`);   // compared in constant time
  let diff = want.length ^ m[2].length;
  for (let i = 0; i < Math.min(want.length, m[2].length); i++) diff |= want.charCodeAt(i) ^ m[2].charCodeAt(i);
  return diff === 0;
}

let migrated = false;
async function migrate(env, h) {
  if (migrated) return;
  await h.cursosReady(env);   // c_orders (with item_kind and item_title, _cursos/vivo.js) and c_settings live with the courses
  migrated = true;
}

async function bookRow(env, slug) {
  const r = await env.DB.prepare(`SELECT e.*, u.id AS uid, u.name AS u_name, u.email AS u_email, u.handle, u.plan, u.plan_until, u.owner_id, u.quota, o.plan AS o_plan, o.plan_until AS o_until
    FROM experiences e LEFT JOIN users u ON u.email = e.email LEFT JOIN users o ON o.id = u.owner_id WHERE e.slug = ?`).bind(slug).first();
  if (!r || r.expires < Date.now() || r.paused) return null;
  const d = JSON.parse(r.data || "{}");
  return d.kind === "libro" && d.libro ? { r, d, L: d.libro } : null;
}
const owns = async (env, user, b) => !!user && (user.email === b.r.email || !!(await env.DB.prepare("SELECT 1 FROM c_orders WHERE student_id = ? AND course_id = ? AND item_kind = 'libro' AND status = 'paid'").bind(user.id, "libro:" + b.L.id).first()));
const peso = c => "$" + (c / 100).toLocaleString("es-MX", { minimumFractionDigits: c % 100 ? 2 : 0 });

// a paid Checkout session → the order counts (from the webhook or from the return page; only once)
async function fulfill(env, ctx, h, sessionId) {
  const s = await h.stripe(env, "GET", `checkout/sessions/${sessionId}`);
  if (!s.metadata || s.metadata.vvr !== "libro" || s.payment_status !== "paid") return null;
  const o = await env.DB.prepare("SELECT * FROM c_orders WHERE id = ?").bind(s.metadata.order_id).first();
  if (!o) return null;
  if (o.status !== "pending") return o;
  const set = await env.DB.prepare("SELECT commission_pct FROM c_settings WHERE id = 1").first(), now = Date.now(), amount = s.amount_total || 0;
  const pct = Number(set && set.commission_pct != null ? set.commission_pct : 20), commission = Math.round(amount * pct / 100);
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent && s.payment_intent.id;
  const r = await env.DB.prepare("UPDATE c_orders SET status = 'paid', paid_at = ?, amount_mxn = ?, commission_pct = ?, commission_mxn = ?, instructor_net_mxn = ?, stripe_payment_intent_id = ?, updated_at = ? WHERE id = ? AND status = 'pending'")
    .bind(now, amount, pct, commission, amount - commission, pi || null, now, o.id).run();
  if (!r.meta || !r.meta.changes) return { ...o, status: "paid" };   // the webhook and the return page raced
  const [u, a] = await Promise.all([env.DB.prepare("SELECT email, name FROM users WHERE id = ?").bind(o.student_id).first(), env.DB.prepare("SELECT email, name FROM users WHERE id = ?").bind(o.instructor_id).first()]);
  const link = h.siteUrl(env) + `/biblioteca/${s.metadata.slug}/`, title = h.esc(o.item_title || "tu libro"), first = n => h.esc(String(n || "").split(" ")[0]);
  const apoyo = o.item_kind === "apoyo";
  if (u) ctx.waitUntil(h.sendMail(env, u.email, apoyo ? `Gracias por apoyar "${o.item_title}"` : `Ya puedes leer "${o.item_title}"`, h.shell(apoyo
    ? `<h1 style="font-size:20px">¡Gracias, ${first(u.name)}!</h1><p>Tu apoyo de <b>${peso(amount)} MXN</b> le llega a quien escribió <b>${title}</b>.</p>${h.btnMail(link, "Volver al libro")}`
    : `<h1 style="font-size:20px">¡Gracias por tu compra, ${first(u.name)}!</h1><p>Ya puedes leer <b>${title}</b> completo cuando quieras, entrando con tu cuenta de Vórtice VR. Pagaste <b>${peso(amount)} MXN</b>.</p>${h.btnMail(link, "Leer el libro")}`,
    "Recibiste este correo por tu compra en la biblioteca de Vórtice VR.")));
  if (a) ctx.waitUntil(h.sendMail(env, a.email, apoyo ? `Recibiste un apoyo por "${o.item_title}"` : `Vendiste "${o.item_title}"`, h.shell(
    `<h1 style="font-size:20px">${apoyo ? "¡Alguien apoyó tu libro!" : "¡Vendiste tu libro!"}</h1><p><b>${title}</b>: ${peso(amount)} MXN. Para ti, después de la comisión de Vórtice VR (${pct} %): <b>${peso(amount - commission)} MXN</b>.</p><p>Te lo pagamos en el corte de cada quincena a la cuenta que registres en tu panel de ventas.</p>${h.btnMail(h.siteUrl(env) + "/cursos/ventas/", "Ver mis ventas")}`,
    "Recibiste este correo porque publicaste un libro en Vórtice VR.")));
  return { ...o, status: "paid" };
}

// called by worker.js's webhook (already verified) before the courses: true = it was a book purchase or support
export async function librosWebhook(env, ctx, ev, h) {
  const o = (ev.data && ev.data.object) || {};
  if (ev.type === "checkout.session.completed" && o.metadata && o.metadata.vvr === "libro") { await migrate(env, h); await fulfill(env, ctx, h, o.id); return true; }
  return false;   // refunds: the courses' charge.refunded marks the c_orders row as refunded (and access goes away)
}

export async function librosApi(request, env, ctx, url, path, h) {
  const M = request.method, { json } = h;
  let m;
  // the public library: listed books, newest first, by age and topic
  if (path === "/api/biblioteca" && M === "GET") {
    const q = url.searchParams, edad = q.get("edad") || "", tema = q.get("tema") || "", before = +q.get("antes") || 0, n = Math.min(48, Math.max(1, Math.round(+q.get("n")) || 24));
    let sql = `SELECT e.slug, e.title, e.data, e.updated, e.views, u.name, u.handle, u.plan, u.plan_until, u.owner_id, u.quota, o.plan AS o_plan, o.plan_until AS o_until
      FROM experiences e LEFT JOIN users u ON u.email = e.email LEFT JOIN users o ON o.id = u.owner_id
      WHERE e.listed = 1 AND e.hidden = 0 AND e.paused = 0 AND e.expires > ? AND e.data LIKE '%"kind":"libro"%'`;
    const args = [Date.now()];
    if (before) { sql += " AND e.updated < ?"; args.push(before); }
    const { results } = await env.DB.prepare(sql + " ORDER BY e.updated DESC LIMIT 400").bind(...args).all();
    const out = []; let more = false;
    for (const r of results) {
      const d = JSON.parse(r.data || "{}"), L = d.libro, P = h.planOf(r);
      if (d.kind !== "libro" || !L) continue;
      if (P.views && r.views >= P.views) continue;
      if (edad && L.edad !== edad && L.edad !== "todos") continue;
      if (tema && L.tema !== tema) continue;
      if (out.length >= n) { more = true; break; }
      const sells = LIBRO.sell.includes(P.id);
      out.push({ slug: r.slug, name: L.name || r.title, autor: L.autor || "", sub: L.sub || "", tipo: L.tipo, edad: L.edad, tema: L.tema, estilo: L.estilo, pages: L.pages.length,
        venta: L.venta && L.venta.modo === "venta" && sells ? { modo: "venta", precio: L.venta.precio } : { modo: L.venta && L.venta.modo === "apoyo" && sells ? "apoyo" : "gratis" },
        image: `/m/${r.slug}/image?v=${r.updated}`, url: `/biblioteca/${r.slug}/`, updated: r.updated, by: r.handle ? { name: r.name || r.handle, handle: r.handle } : null });
    }
    return json({ books: out, next: more ? out[out.length - 1].updated : null }, 200, { "Cache-Control": "public, max-age=60" });
  }

  // the whole book for whoever may read it: free books to anyone, for sale only after buying (or its author / an admin).
  // The files of the pages for sale go signed for 6 hours.
  if ((m = path.match(/^\/api\/libro\/([a-z0-9-]+)$/)) && M === "GET") {
    const b = await bookRow(env, m[1]); if (!b) return json({ error: "No encontramos ese libro." }, 404);
    await migrate(env, h);
    const user = await h.auth(request, env), L = b.L, free = freeCount(L), P = h.planOf(b.r), sells = LIBRO.sell.includes(P.id);
    const mine = !!user && user.email === b.r.email, owned = free >= L.pages.length || mine || h.isAdmin(env, user) || await owns(env, user, b);
    const venta = L.venta && L.venta.modo !== "gratis" && sells ? L.venta : { modo: "gratis" };
    const out = { owned, mine, venta: { modo: venta.modo, precio: venta.precio, gratis: venta.gratis }, author: { name: b.r.u_name || "", handle: b.r.handle || null }, bought: owned && !mine && free < L.pages.length };
    if (!owned) return json(out, 200, { "Cache-Control": "private, no-store" });
    const until = Date.now() + 6 * 3600e3, files = {};
    for (const it of b.d.items || []) files[it.id] = it.lock ? `/m/${b.r.slug}/p/${it.id}?k=${until}.${await sig(env, `${b.r.slug}/${it.id}/${until}`)}` : `/m/${b.r.slug}/${it.file}?v=${b.r.updated}`;
    return json({ ...out, pages: L.pages, items: b.d.items || [], files }, 200, { "Cache-Control": "private, no-store" });
  }

  // buy it (venta) or support its author (apoyo, any amount): Stripe Checkout with the account
  if ((m = path.match(/^\/api\/libro\/([a-z0-9-]+)\/(comprar|apoyar)$/)) && M === "POST") {
    const user = await h.auth(request, env);
    if (!user) return json({ error: "Entra con tu cuenta de Vórtice VR.", login: true }, 401);
    if (!(await h.limit(env, "libro:" + user.id, 20, 3600e3))) return json({ error: "Demasiados intentos. Espera un rato." }, 429);
    const b = await bookRow(env, m[1]); if (!b) return json({ error: "No encontramos ese libro." }, 404);
    await migrate(env, h);
    const L = b.L, P = h.planOf(b.r), kind = m[2] === "comprar" ? "libro" : "apoyo";
    if (!LIBRO.sell.includes(P.id) || !L.venta || L.venta.modo !== (kind === "libro" ? "venta" : "apoyo"))
      return json({ error: kind === "libro" ? "Este libro no está a la venta por ahora." : "Este libro no recibe apoyos por ahora." }, 409);
    if (user.email === b.r.email) return json({ error: "Es tu libro: no puedes comprarlo ni apoyarlo tú." }, 409);
    if (kind === "libro" && await owns(env, user, b)) return json({ owned: true });
    const body = await request.json().catch(() => ({}));
    const pesos = kind === "libro" ? L.venta.precio : Math.round(Number(body.monto));
    if (kind === "apoyo" && !(pesos >= LIBRO.apoyo.min && pesos <= LIBRO.apoyo.max)) return json({ error: `El apoyo va de $${LIBRO.apoyo.min} a $${LIBRO.apoyo.max.toLocaleString("es-MX")} pesos.` }, 400);
    if (!(env.STRIPE_SECRET_KEY && (h.stripeMode(env) === "live" || h.isAdmin(env, user)))) return json({ error: "El pago con tarjeta llega muy pronto.", soon: true }, 503);
    const id = crypto.randomUUID(), now = Date.now(), name = L.name || b.r.title, origin = url.origin;
    const s = await h.stripe(env, "POST", "checkout/sessions", {
      mode: "payment", customer_email: user.email, client_reference_id: user.id, locale: "es-419",
      line_items: [{ quantity: 1, price_data: { currency: "mxn", unit_amount: pesos * 100, tax_behavior: "inclusive", product_data: { name: (kind === "libro" ? `Libro: ${name}` : `Apoyo para «${name}»`).slice(0, 200), description: (kind === "libro" ? "Libro interactivo en la biblioteca de Vórtice VR" : "Un apoyo para quien escribió este libro") + (L.autor ? ` · ${L.autor}` : "") } } }],
      metadata: { vvr: "libro", order_id: id, kind, slug: b.r.slug, book: L.id || "" },
      payment_intent_data: { metadata: { vvr: "libro", order_id: id }, description: `${kind === "libro" ? "Libro" : "Apoyo"}: ${name}`.slice(0, 200) },
      success_url: `${origin}/biblioteca/${b.r.slug}/?pago=ok&cs={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/biblioteca/${b.r.slug}/?pago=cancelado`,
    }, `vvr-libro-${id}`);
    await env.DB.prepare("INSERT INTO c_orders (id, student_id, course_id, instructor_id, amount_mxn, stripe_checkout_session_id, stripe_mode, status, item_kind, item_title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)")
      .bind(id, user.id, "libro:" + L.id, b.r.uid, pesos * 100, s.id, h.stripeMode(env), kind, name, now, now).run();
    return json({ url: s.url });
  }
  // back from Checkout: it counts right away if it is paid (the webhook does the same; only one of them counts)
  if ((m = path.match(/^\/api\/libro\/pago\/(cs_[\w]+)$/)) && M === "POST") {
    const user = await h.auth(request, env);
    if (!user) return json({ error: "Entra con tu cuenta.", login: true }, 401);
    await migrate(env, h);
    const o = await env.DB.prepare("SELECT id FROM c_orders WHERE stripe_checkout_session_id = ? AND student_id = ?").bind(m[1], user.id).first();
    if (!o) return json({ error: "No encontramos ese pago." }, 404);
    const r = await fulfill(env, ctx, h, m[1]);
    return json({ paid: !!(r && r.status === "paid"), kind: r && r.item_kind });
  }
  // its author: sales and support of one book
  if ((m = path.match(/^\/api\/libro\/([a-z0-9-]+)\/ventas$/)) && M === "GET") {
    const user = await h.auth(request, env);
    if (!user) return json({ error: "Inicia sesión de nuevo." }, 401);
    const r = await env.DB.prepare("SELECT data FROM experiences WHERE slug = ? AND email = ?").bind(m[1], user.email).first();
    if (!r) return json({ error: "No encontramos ese libro en tu cuenta." }, 404);
    await migrate(env, h);
    const L = (JSON.parse(r.data || "{}").libro) || {};
    const { results } = await env.DB.prepare("SELECT item_kind, COUNT(*) AS n, COALESCE(SUM(amount_mxn), 0) AS gross, COALESCE(SUM(instructor_net_mxn), 0) AS net FROM c_orders WHERE course_id = ? AND status = 'paid' GROUP BY item_kind").bind("libro:" + L.id).all();
    const by = Object.fromEntries(results.map(x => [x.item_kind, x]));
    return json({ ventas: (by.libro || {}).n || 0, apoyos: (by.apoyo || {}).n || 0, gross: results.reduce((a, x) => a + x.gross, 0), net: results.reduce((a, x) => a + x.net, 0) });
  }
  return null;
}
