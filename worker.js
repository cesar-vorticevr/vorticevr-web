// Worker de vorticevr.mx (corre antes que los static assets: run_worker_first).
//  - Sitio estático: pasa directo a los assets; a los videos les responde peticiones Range (el iPhone las necesita).
//  - Plataforma de RA (vorticevr.mx/crear/):
//      nombre.vorticevr.mx  y  /e/nombre/   → visor /x/
//      /api/*                                 → cuentas (registro, sesión), publicar, consultar
//      /m/<slug>/<target|image|i/<id>>         → archivos de la experiencia en R2 (con Range); i/<id> = archivo de un elemento
//                                              (video, imagen o GLB). video y model: experiencias de antes de los elementos.
//    Requiere bindings DB (D1) y MEDIA (R2); secretos RESEND_API_KEY y SESSION_SECRET.
//    Sin bindings, el sitio funciona igual y la API responde 503.

const ROOT_DEFAULT = "vorticevr.mx";
const RESERVED = new Set(["www","t","api","admin","mail","email","smtp","crear","create","ra","x","e","m","preview","app","apps","static","assets","cdn","dev","test","staging","beta","demo","vorticevr","vortice","soporte","support","help","ayuda","blog","shop","tienda","login","cuenta","account","johara","tarjeta","proyectos","status","docs"]);
const LIMITS = { imageBytes: 3 * 1024 * 1024, targetBytes: 8 * 1024 * 1024, codeMinutes: 10, codeTries: 5, sessionDays: 30, pausedDays: 30 };
// Plans. exp = active experiences; days = how long each one lasts (0 = while the plan is active);
// views = most times each experience can be opened (Gratis only, so a viral free QR cannot run up costs);
// Experiences show the Vórtice VR logo on top; brand = may put its own logo instead (Premium). Video: size only, not duration.
// Since October 2026 only Gratis, Pro and Premium are offered (they count experiences of any kind). exp: UNLIMITED = no
// limit (fair use in the terms). year = price of a year (default 10 months). seats = team accounts (only the legacy
// Empresarial plan still has them): the owner hands each one part of the plan's experiences (users.quota).
// legacy = no longer offered (only kept for accounts that have it). Paid plans can also be set by an admin in /admin/.
// Elements (video, image, text, 3D) per experience: items = how many, totalMB = weight of all its files together
// (each video ≤ videoMB, each GLB ≤ modelMB). The Worker reads the whole upload in memory (128 MB): keep totalMB ≤ 60.
const PLANS = {
  gratis:  { name: "Gratis",  exp: 5,    days: 15, videoMB: 25, modelMB: 15, items: 3, totalMB: 30, price: 0, views: 1000 },
  basico:  { name: "Básico",  exp: 5,    days: 0,  videoMB: 25, modelMB: 15, items: 6, totalMB: 40, price: 199, year: 1990, legacy: true },
  pro:     { name: "Pro",     exp: 100,  days: 0,  videoMB: 50, modelMB: 30, items: 15, totalMB: 60, price: 499, year: 4990 },
  premium: { name: "Premium", exp: 1000000, brand: true, days: 0, videoMB: 50, modelMB: 30, items: 15, totalMB: 60, price: 1499, year: 14990 },
  empresarial: { name: "Empresarial", exp: 150, seats: 15, brand: true, days: 0, videoMB: 50, modelMB: 30, items: 15, totalMB: 60, price: 999, year: 9999, legacy: true },
  escuela: { name: "Escuela", exp: 1000, brand: true, days: 0,  videoMB: 50, modelMB: 30, items: 15, totalMB: 60, price: 1500, year: 15000, legacy: true },
};
const UNLIMITED = 1000000;   // PLANS.premium.exp: shown as "ilimitadas"
const yearPrice = plan => PLANS[plan].year || PLANS[plan].price * YEAR_MONTHS;
const FAR = 253402300799000; // expires of an experience on a paid plan: "while the plan is active" (year 9999)
const ADMINS_DEFAULT = "lad.cesargarcia@gmail.com";
// "Recomienda y gana": who can earn, how much, and when a commission can be paid out
const REF = { plans: ["pro", "premium", "empresarial"], rate: 0.10, discount: 10, holdDays: 30, minPayout: 50000 /* centavos: $500 */, coupon: "VVR_PRIMERO10" };
// Sellers (vendedores): an account with users.seller = {active, rates: {pro_mes, pro_anio, premium_mes, premium_anio} in pesos}.
// Its code is its ref_code: whoever signs up with it gets the same 10% off the first payment, and the seller earns the fixed
// amount of that plan and period, only for the customer's first payment (commissions.kind = "seller"). They are paid by
// transfer (users.payout = {clabe, banco, titular}): admin marks them paid. Their panel is /vendedor/ (/api/seller).
const SELLER_KEYS = ["pro_mes", "pro_anio", "premium_mes", "premium_anio"];
const sellerOf = u => { if (!u || !u.seller) return null; try { const s = JSON.parse(u.seller); return s && typeof s === "object" ? s : null; } catch { return null; } };
const ADMIN_SLUGS = new Set(["ejemplo"]); // only an admin can take these (the home page demo uses "ejemplo")
const VIDEO = /\.(mp4|m4v|webm|mov)$/i;
const MEDIA_KEYS = ["video", "target", "image", "model", "qr", "logo"]; // R2 files of an experience: exp/<slug>/<key> (+ i/<id> of its elements)
const ITEM_TYPES = ["video", "image", "text", "model", "audio"];
const ENTRANCES = ["aparecer", "crecer", "rebote", "girar", "subir", "ninguna"];
const FONTS = ["Sora", "Bebas Neue", "Pacifico", "Playfair Display", "Permanent Marker", "IBM Plex Sans"];
const ITEM_LIMITS = { videos: 2, scenes: 5, imageBytes: 5 * 1024 * 1024, audioBytes: 10 * 1024 * 1024 };   // audio: one per scene
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const BUTTONS = ["whatsapp", "facebook", "instagram", "youtube", "x", "tiktok", "web"];
const LABELS = { whatsapp: "WhatsApp", facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", x: "X", tiktok: "TikTok", web: "tu sitio web" };
// social networks accept just the username (or a pasted link); this is how a username becomes a link
const SOCIAL_BASE = { facebook: "https://facebook.com/", instagram: "https://instagram.com/", youtube: "https://youtube.com/@", x: "https://x.com/", tiktok: "https://tiktok.com/@" };

export default {
  async fetch(request, env, ctx) {
    return secure(await route(request, env, ctx), new URL(request.url));
  },

  // daily: delete expired experiences and their files
  async scheduled(event, env, ctx) {
    if (!env.DB || !env.MEDIA) return;
    await schema(env);
    // paid plans whose "paid until" date passed go back to free (extra experiences are paused 30 days, then deleted)
    const { results: lapsed } = await env.DB.prepare("SELECT * FROM users WHERE plan != 'gratis' AND plan_until IS NOT NULL AND plan_until < ? LIMIT 20").bind(Date.now()).all();
    for (const u of lapsed) await applyPlan(env, u, "gratis", null, u.plan_note);
    // commissions become available once the refund window passed
    await env.DB.prepare("UPDATE commissions SET status = 'disponible' WHERE status = 'pendiente' AND available_at < ?").bind(Date.now()).run();
    // …and go to the referrer's Stripe balance on their own (saldo a favor): their next charges are lower
    await creditCommissions(env).catch(e => console.error("credit", e.message));
    // expired experiences: files in bulk (one R2 call per 1000 keys), then the rows
    const now = Date.now();
    const { results } = await env.DB.prepare("SELECT slug, data FROM experiences WHERE expires < ? LIMIT 2000").bind(now).all();
    const keys = results.flatMap(r => mediaKeys(r.slug, r.data));
    for (let i = 0; i < keys.length; i += 1000) await env.MEDIA.delete(keys.slice(i, i + 1000));
    if (results.length) await env.DB.prepare("DELETE FROM experiences WHERE slug IN (SELECT slug FROM experiences WHERE expires < ? LIMIT 2000)").bind(now).run();
    await env.DB.prepare("DELETE FROM clicks WHERE slug NOT IN (SELECT slug FROM experiences)").run();
    await env.DB.prepare("DELETE FROM otp WHERE expires < ?").bind(Date.now() - 864e5).run();
    await env.DB.prepare("DELETE FROM sessions WHERE expires < ?").bind(Date.now()).run();
    await env.DB.prepare("DELETE FROM users WHERE verified = 0 AND created < ?").bind(Date.now() - 7 * 864e5).run();
    await env.DB.prepare("DELETE FROM ratelimit WHERE reset < ?").bind(Date.now()).run();
  },
};

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const root = env.ROOT_DOMAIN || ROOT_DEFAULT;
  try {
    if (url.pathname.startsWith("/api/")) return await api(request, env, ctx, url);
    if (url.pathname.startsWith("/m/")) return await media(request, env, url);
    const sub = subdomainOf(url.hostname, root);
    if (sub) {
      // nombre.vorticevr.mx: the page is the viewer; shared files (/assets/…) come from the site
      if (url.pathname === "/" || url.pathname === "/index.html") return viewerPage(request, env, url);
      return assets(request, env, url);
    }
    const e = url.pathname.match(/^\/e\/([a-z0-9-]+)\/?$/);
    if (e) {
      if (!url.pathname.endsWith("/")) return Response.redirect(url.origin + url.pathname + "/" + url.search, 301);
      return viewerPage(request, env, url);
    }
    return assets(request, env, url);
  } catch (err) {
    console.error(err);
    return json({ error: "Error interno. Intenta de nuevo.", detalle: /workers.dev$|localhost$|^127./.test(url.hostname) ? String(err && err.message || err).slice(0, 200) : undefined }, 500);
  }
}

// Security headers on every response: no MIME sniffing, no framing by other sites, only https, and the camera
// and microphone only for this site (the AR viewer and the projects use them).
function secure(res, url) {
  if (res.status === 101) return res;
  const h = new Headers(res.headers);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "SAMEORIGIN");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), payment=()");
  if (url.protocol === "https:") h.set("Strict-Transport-Security", "max-age=31536000");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}


function subdomainOf(host, root) {
  if (!host.endsWith("." + root)) return null;
  const sub = host.slice(0, -root.length - 1);
  if (!sub || sub.includes(".") || RESERVED.has(sub)) return null;
  return sub;
}

function viewerPage(request, env, url) {
  return env.ASSETS.fetch(new Request(new URL("/x/", url), request));
}

// ---------- static assets (with Range for videos) ----------
async function assets(request, env, url) {
  if (!VIDEO.test(url.pathname)) return env.ASSETS.fetch(request);
  const plain = new Headers(request.headers); plain.delete("Range");
  const res = await env.ASSETS.fetch(new Request(request, { headers: plain }));
  if (res.status !== 200) return res;
  return rangeFromBuffer(request, res.headers, await res.arrayBuffer());
}

function rangeFromBuffer(request, baseHeaders, buf) {
  const headers = new Headers(baseHeaders);
  headers.set("Accept-Ranges", "bytes");
  const size = buf.byteLength, range = request.headers.get("Range");
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || (m[1] === "" && m[2] === "")) { headers.set("Content-Length", String(size)); return new Response(request.method === "HEAD" ? null : buf, { status: 200, headers }); }
  let start, end;
  if (m[1] === "") { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } });
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(request.method === "HEAD" ? null : buf.slice(start, end + 1), { status: 206, headers });
}

// ---------- experience files from R2 ----------
async function media(request, env, url) {
  const m = url.pathname.match(/^\/m\/([a-z0-9-]+)\/(video|target|image|model|logo|i\/[a-z0-9]{6,16})$/);
  if (!m || !env.MEDIA || !env.DB) return new Response("No encontrado", { status: 404 });
  const [, slug, kind] = m;
  await schema(env);
  const exp = await env.DB.prepare("SELECT expires, paused FROM experiences WHERE slug = ?").bind(slug).first();
  if (!exp || exp.expires < Date.now() || (exp.paused && kind !== "image")) return new Response("No encontrado", { status: 404 }); // a paused one keeps its thumbnail for the dashboard
  const key = `exp/${slug}/${kind}`;
  const range = request.headers.get("Range");
  let obj;
  if (range) {
    const head = await env.MEDIA.head(key);
    if (!head) return new Response("No encontrado", { status: 404 });
    const size = head.size, r = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start = 0, end = size - 1;
    if (r && r[1] === "" && r[2] !== "") { start = Math.max(0, size - Number(r[2])); }
    else if (r) { start = Number(r[1] || 0); if (r[2] !== "") end = Math.min(Number(r[2]), size - 1); }
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    obj = await env.MEDIA.get(key, { range: { offset: start, length: end - start + 1 } });
    const h = mediaHeaders(obj);
    h.set("Content-Range", `bytes ${start}-${end}/${size}`); h.set("Content-Length", String(end - start + 1));
    return new Response(request.method === "HEAD" ? null : obj.body, { status: 206, headers: h });
  }
  obj = await env.MEDIA.get(key);
  if (!obj) return new Response("No encontrado", { status: 404 });
  const h = mediaHeaders(obj); h.set("Content-Length", String(obj.size));
  return new Response(request.method === "HEAD" ? null : obj.body, { status: 200, headers: h });
}
function mediaHeaders(obj) {
  const h = new Headers();
  h.set("Content-Type", (obj.httpMetadata && obj.httpMetadata.contentType) || "application/octet-stream");
  h.set("Accept-Ranges", "bytes");
  h.set("Cache-Control", "public, max-age=300");
  h.set("ETag", obj.httpEtag);
  return h;
}
// every file an experience can have: the fixed ones and its elements' (data = the row's data column)
function mediaKeys(slug, data) {
  let d = {}; try { d = typeof data === "string" ? JSON.parse(data || "{}") : data || {}; } catch {}
  const files = itemsOf(d).map(i => i.file).filter(Boolean);
  return [...new Set([...MEDIA_KEYS, ...files])].map(k => `exp/${slug}/${k}`);
}
async function deleteMedia(env, slug, data) {
  await env.MEDIA.delete(mediaKeys(slug, data));
}

// ---------- API ----------
async function api(request, env, ctx, url) {
  if (!env.DB || !env.MEDIA) return json({ error: "La plataforma todavía se está configurando." }, 503);
  await schema(env);
  const path = url.pathname.replace(/\/+$/, "");
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const M = request.method;

  // public: one experience's settings
  let m = path.match(/^\/api\/exp\/([a-z0-9-]+)$/);
  if (m && M === "GET") {
    const row = await env.DB.prepare("SELECT e.*, u.plan, u.plan_until, u.owner_id, u.quota, o.plan AS o_plan, o.plan_until AS o_until FROM experiences e LEFT JOIN users u ON u.email = e.email LEFT JOIN users o ON o.id = u.owner_id WHERE e.slug = ?").bind(m[1]).first();
    if (!row) return json({ error: "No existe" }, 404);
    if (row.expires < Date.now()) return json({ error: "Expiró" }, 410);
    if (row.paused) return json({ error: "Pausada", paused: true }, 410);
    const P = planOf(row);
    if (P.views && row.views >= P.views) return json({ error: "Límite de vistas", limit: true }, 410);
    ctx.waitUntil(env.DB.batch([env.DB.prepare("UPDATE experiences SET views = views + 1 WHERE slug = ?").bind(row.slug), bump(env, "views")]));
    const out = publicExp(row);
    if (out.brand && !P.brand) delete out.brand;   // its own logo (or none) only while the plan includes it (brand: Premium)
    return json(out, 200, { "Cache-Control": "no-store" });
  }

  // link page: one tap on a button; prize wheel: spins, each prize that came out, "lose", review… (navigator.sendBeacon); only counted while it is live
  m = path.match(/^\/api\/click\/([a-z0-9-]+)\/([a-z0-9]{1,16})$/);
  if (m && M === "POST") {
    ctx.waitUntil(env.DB.prepare("INSERT INTO clicks (slug, id, n) SELECT slug, ?, 1 FROM experiences WHERE slug = ? AND paused = 0 AND expires > ? AND (data LIKE '%\"kind\":\"links\"%' OR data LIKE '%\"kind\":\"ruleta\"%' OR data LIKE '%\"kind\":\"dispara\"%' OR data LIKE '%\"kind\":\"memorama\"%' OR data LIKE '%\"kind\":\"sopa\"%' OR data LIKE '%\"kind\":\"rompecabezas\"%') ON CONFLICT(slug, id) DO UPDATE SET n = n + 1")
      .bind(m[2], m[1], Date.now()).run().catch(e => console.error("click", e.message)));
    return new Response(null, { status: 204 });
  }
  // link page: "Guardar contacto" downloads its vCard
  m = path.match(/^\/api\/vcard\/([a-z0-9-]+)$/);
  if (m && M === "GET") {
    const row = await env.DB.prepare("SELECT * FROM experiences WHERE slug = ?").bind(m[1]).first();
    const d = row && JSON.parse(row.data || "{}");
    if (!row || row.expires < Date.now() || row.paused || d.kind !== "links" || !(d.links && d.links.contact && d.links.contact.on)) return json({ error: "No encontrado" }, 404);
    return new Response(await vcard(env, row, request), { headers: { "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": `attachment; filename="${row.slug}.vcf"`, "Cache-Control": "no-store" } });
  }

  // contact form of the home page → email to CONTACT_TO (hola@vorticevr.mx); reply goes straight to the person
  if (path === "/api/contact" && M === "POST") {
    const b = await request.json().catch(() => ({}));
    if (b.web) return json({ ok: true }); // honeypot: bots fill the hidden field
    const name = String(b.name || "").trim().slice(0, 80), em = normEmail(b.email), msg = String(b.message || "").trim().slice(0, 2000);
    const phone = String(b.phone || "").replace(/[^\d+ ()-]/g, "").slice(0, 20);
    const topic = { plataforma: "Plataforma de realidad aumentada", escuela: "Plan para escuela", empresa: "Plan para empresa", proyecto: "Proyecto a la medida", soporte: "Ayuda con su cuenta", otro: "Otra cosa" }[b.topic] || "Otra cosa";
    if (!name || !em || !msg) return json({ error: "Escribe tu nombre, un correo válido y tu mensaje." }, 400);
    if (!(await limit(env, "contact:" + ip, 5, 3600e3)) || !(await limit(env, "contact:all", 200, 864e5))) return json({ error: "Recibimos muchos mensajes seguidos. Intenta en un rato o escríbenos a hola@vorticevr.mx." }, 429);
    const html = shell(`<h1 style="font-size:20px">Nuevo mensaje desde vorticevr.mx</h1>
<p><b>${esc(name)}</b> · <a href="mailto:${esc(em)}" style="color:#ffbe55">${esc(em)}</a>${phone ? ` · ${esc(phone)}` : ""}</p>
<p style="color:#d2b8ff">Le interesa: <b>${esc(topic)}</b></p>
<div style="white-space:pre-wrap;background:#1b0a36;border-radius:10px;padding:14px">${esc(msg)}</div>
<p style="color:#a99bcb;font-size:12px">Contesta este correo para responderle directamente.</p>`);
    ctx.waitUntil(bump(env, "contacts").run());
    const sent = await sendMail(env, env.CONTACT_TO || "hola@vorticevr.mx", `Contacto: ${name} · ${topic}`, html, undefined, em);
    return sent ? json({ ok: true }) : json({ error: "No se pudo enviar. Escríbenos a hola@vorticevr.mx." }, 502);
  }

  m = path.match(/^\/api\/ref\/([A-Za-z0-9-]{3,20})$/);
  if (m && M === "GET") {
    const r = await env.DB.prepare("SELECT name FROM users WHERE ref_code = ?").bind(m[1].toUpperCase()).first();
    return r ? json({ ok: true, name: String(r.name || "").split(" ")[0], discount: REF.discount }) : json({ ok: false }, 404);
  }

  if (path === "/api/slug" && M === "GET") { const who0 = await auth(request, env); return json(await slugStatus(env, (url.searchParams.get("s") || "").toLowerCase(), null, null, isAdmin(env, who0))); }

  // ---- accounts: register → confirm email once → log in with password (session 30 days) ----
  if (path === "/api/register" && M === "POST") {
    const b = await request.json().catch(() => ({}));
    const em = normEmail(b.email), name = String(b.name || "").trim().slice(0, 60), pw = String(b.password || "");
    if (!name) return json({ error: "Escribe tu nombre." }, 400);
    if (!em) return json({ error: "Escribe un correo válido." }, 400);
    if (pw.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
    if (!(await limit(env, "reg:" + ip, 8, 3600e3))) return json({ error: "Demasiados intentos. Espera un rato." }, 429);
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(em).first();
    if (user && user.verified) return json({ error: "Ya existe una cuenta con ese correo. Inicia sesión." }, 409);
    const hash = await hashPassword(pw);
    const code = String(b.ref || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
    const by = code ? await env.DB.prepare("SELECT id, email FROM users WHERE ref_code = ?").bind(code).first() : null;
    const refBy = by && by.email !== em ? by.id : null;   // nobody refers themselves
    if (user) await env.DB.prepare("UPDATE users SET name = ?, pass = ?, ref_by = COALESCE(ref_by, ?) WHERE id = ?").bind(name, hash, refBy, user.id).run();
    else await env.DB.prepare("INSERT INTO users (email, name, pass, verified, created, ref_by) VALUES (?, ?, ?, 0, ?, ?)").bind(em, name, hash, Date.now(), refBy).run();
    return codeResponse(await sendCode(env, em, "verify"));
  }

  if (path === "/api/verify" && M === "POST") {
    const b = await request.json().catch(() => ({}));
    const em = normEmail(b.email);
    const bad = await checkCode(env, em, "verify", b.code);
    if (bad) return bad;
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(em).first();
    if (!user) return json({ error: "No encontramos esa cuenta. Regístrate de nuevo." }, 404);
    await env.DB.batch([env.DB.prepare("UPDATE users SET verified = 1 WHERE id = ?").bind(user.id), bump(env, "signups")]);
    return json(await sessionFor(env, request, { ...user, verified: 1 }));
  }

  if (path === "/api/login" && M === "POST") {
    const b = await request.json().catch(() => ({}));
    const em = normEmail(b.email), pw = String(b.password || "");
    if (!em || !pw) return json({ error: "Escribe tu correo y tu contraseña." }, 400);
    if (!(await limit(env, "login:" + ip, 20, 900e3)) || !(await limit(env, "loginmail:" + em, 8, 900e3))) return json({ error: "Demasiados intentos. Espera 15 minutos." }, 429);
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(em).first();
    if (!user || !(await verifyPassword(pw, user.pass))) return json({ error: "Correo o contraseña incorrectos." }, 401);
    if (!user.verified) { const r = await sendCode(env, em, "verify"); return r.error && r.status !== 429 ? codeResponse(r) : json({ ok: true, needCode: true, dev_code: r.dev_code }); } // 429 = a code was just sent
    return json(await sessionFor(env, request, user));
  }

  if (path === "/api/forgot" && M === "POST") {
    const b = await request.json().catch(() => ({}));
    const em = normEmail(b.email);
    if (!em) return json({ error: "Escribe un correo válido." }, 400);
    const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(em).first();
    if (!user) return json({ ok: true }); // same answer whether or not the account exists
    return codeResponse(await sendCode(env, em, "reset"));
  }

  if (path === "/api/reset" && M === "POST") {
    const b = await request.json().catch(() => ({}));
    const em = normEmail(b.email), pw = String(b.password || "");
    if (pw.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
    const bad = await checkCode(env, em, "reset", b.code);
    if (bad) return bad;
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(em).first();
    if (!user) return json({ error: "No encontramos esa cuenta." }, 404);
    await env.DB.prepare("UPDATE users SET pass = ?, verified = 1 WHERE id = ?").bind(await hashPassword(pw), user.id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();   // log out everywhere else
    return json(await sessionFor(env, request, { ...user, verified: 1 }));
  }

  // ---- Stripe webhook (signed by Stripe, no session) ----
  if (path === "/api/billing/webhook" && M === "POST") {
    const raw = await request.text();
    if (!(await stripeVerify(env, raw, request.headers.get("Stripe-Signature")))) return json({ error: "Firma inválida" }, 400);
    const ev = JSON.parse(raw), o = (ev.data && ev.data.object) || {};
    let sub = null;
    if (ev.type === "checkout.session.completed" && o.mode === "subscription") sub = o.subscription;
    else if (/^customer\.subscription\./.test(ev.type)) sub = o.id;
    else if (/^invoice\.(paid|payment_failed)$/.test(ev.type)) sub = o.subscription || (o.parent && o.parent.subscription_details && o.parent.subscription_details.subscription);
    if (sub) await stripeSync(env, ctx, typeof sub === "string" ? sub : sub.id);
    if (ev.type === "invoice.paid" && o.id) await commissionFor(env, o.id);
    if (ev.type === "charge.refunded") {
      const inv = typeof o.invoice === "string" ? o.invoice : o.invoice && o.invoice.id;
      if (inv) await env.DB.prepare("UPDATE commissions SET status = 'cancelada', note = 'Pago reembolsado' WHERE invoice = ? AND status IN ('pendiente', 'disponible')").bind(inv).run();
    }
    return json({ received: true });
  }

  // ---- signed-in ----
  const me = await auth(request, env);
  const who = me && me.email;
  if (path === "/api/logout" && M === "POST") {
    const t = bearer(request); if (t) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(await sha256hex(t)).run();
    return json({ ok: true });
  }
  if (path === "/api/me" && M === "GET") {
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    return json(await account(env, request, me));
  }
  if (path === "/api/password" && M === "POST") {
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    const b = await request.json().catch(() => ({}));
    if (String(b.password || "").length < 8) return json({ error: "La nueva contraseña debe tener al menos 8 caracteres." }, 400);
    const user = await env.DB.prepare("SELECT pass FROM users WHERE id = ?").bind(me.id).first();
    if (!(await verifyPassword(String(b.current || ""), user.pass))) return json({ error: "Tu contraseña actual no es correcta." }, 401);
    await env.DB.prepare("UPDATE users SET pass = ?, temp_pw = 0 WHERE id = ?").bind(await hashPassword(String(b.password)), me.id).run();
    return json({ ok: true });
  }
  m = path.match(/^\/api\/experience\/([a-z0-9-]+)$/);
  if (m && M === "DELETE") {
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    const exp = await env.DB.prepare("SELECT slug, data FROM experiences WHERE slug = ? AND email = ?").bind(m[1], who).first();
    if (!exp) return json({ error: "No encontramos esa experiencia en tu cuenta." }, 404);
    await deleteMedia(env, exp.slug, exp.data);
    await env.DB.batch([env.DB.prepare("DELETE FROM experiences WHERE slug = ?").bind(exp.slug), env.DB.prepare("DELETE FROM clicks WHERE slug = ?").bind(exp.slug)]);
    return json({ ok: true });
  }

  m = path.match(/^\/api\/clicks\/([a-z0-9-]+)$/);
  if (m && M === "GET") {
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    const exp = await env.DB.prepare("SELECT slug FROM experiences WHERE slug = ? AND email = ?").bind(m[1], who).first();
    if (!exp) return json({ error: "No encontramos esa experiencia en tu cuenta." }, 404);
    const { results } = await env.DB.prepare("SELECT id, n FROM clicks WHERE slug = ?").bind(exp.slug).all();
    return json({ clicks: Object.fromEntries(results.map(r => [r.id, r.n])) });
  }

  if (path === "/api/publish" && M === "POST") {
    if (!who) return json({ error: "Inicia sesión de nuevo." }, 401);
    if (!(await limit(env, "pub:" + who, 30, 3600e3))) return json({ error: "Demasiadas publicaciones seguidas. Espera un rato." }, 429);
    const P = planOf(me), LIM = await limitOf(env, me, P);
    const form = await request.formData();
    let meta; try { meta = JSON.parse(form.get("meta") || "{}"); } catch { return json({ error: "Datos inválidos." }, 400); }
    // editing: meta.original is the experience's current slug (it can move to a new one)
    const original = String(meta.original || "").toLowerCase();
    const mine = original ? await env.DB.prepare("SELECT * FROM experiences WHERE slug = ? AND email = ? AND expires > ?").bind(original, who, Date.now()).first() : null;
    if (original && !mine) return json({ error: "No encontramos esa experiencia en tu cuenta." }, 404);
    if (mine && mine.paused) return json({ error: `Esta experiencia está pausada: excede las experiencias que tienes disponibles. Borra otra o ${P.member ? "pide más a quien administra tu equipo" : "mejora tu plan"} para reactivarla.` }, 403);
    if (!mine) {
      const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM experiences WHERE email = ? AND paused = 0 AND expires > ?").bind(who, Date.now()).first();
      if (n.n >= LIM) return json({ error: P.member ? `Tienes ${expCount(LIM)} asignadas por tu equipo. Borra una o pide más a quien administra tu equipo.` : `Tu plan ${P.name} incluye ${expCount(LIM)}${P.seats ? " para tu cuenta (el resto está repartido en tu equipo)" : ""}. Borra una o mejora tu plan para crear otra.` }, 403);
    }
    const slug = String(meta.slug || "").toLowerCase();
    const st = await slugStatus(env, slug, who, mine && mine.slug, isAdmin(env, me));
    if (!st.ok) return json({ error: st.reason }, 400);
    const data = cleanMeta(meta, P);
    if (data.error) return json({ error: data.error }, 400);
    const image = form.get("image"), target = form.get("target"), qr = form.get("qr");
    // its own brand logo instead of Vórtice VR (plans with brand): uploaded now or kept from the version being edited
    const logo = form.get("logo"), newLogo = logo && typeof logo !== "string" ? logo : null;
    if (meta.brand === "own") {
      if (!P.brand) return json({ error: "Poner el logo de tu marca es del plan Premium." }, 403);
      const had = mine && JSON.parse(mine.data || "{}").brand === "own";
      if (!newLogo && !had) return json({ error: "Sube el logo de tu marca." }, 400);
      if (newLogo && (newLogo.size > 1048576 || !/^image\/(png|jpeg|webp)$/.test(newLogo.type))) return json({ error: "El logo debe ser PNG, JPG o WebP de máximo 1 MB." }, 400);
      data.brand = "own";
    } else if (meta.brand === "none") {   // no logo on top at all
      if (!P.brand) return json({ error: "Quitar el logo es del plan Premium." }, 403);
      data.brand = "none";
    }
    const isNew = !mine;
    if (data.kind === "trivia" && data.trivia.logo && !image && !(mine && (JSON.parse(mine.data || "{}").trivia || {}).logo)) data.trivia.logo = false;
    if (isNew) ctx.waitUntil(bump(env, "publishes").run());
    if (isNew && data.kind !== "trivia" && data.kind !== "filtro" && (!image || (!target && data.kind !== "colorear" && data.kind !== "menu" && data.kind !== "links" && data.kind !== "ruleta" && data.kind !== "dispara" && data.kind !== "memorama" && data.kind !== "sopa" && data.kind !== "rompecabezas" && data.kind !== "superficie"))) return json({ error: data.kind === "colorear" ? "Falta tu dibujo." : "Falta la imagen." }, 400);
    if (image && (image.size > LIMITS.imageBytes || !/^image\/(jpeg|png|webp)$/.test(image.type))) return json({ error: "La imagen es demasiado grande." }, 400);
    if (target && target.size > LIMITS.targetBytes) return json({ error: "La imagen no se pudo preparar. Intenta con otra." }, 400);
    // each element's file: uploaded now (field f_<id>) or kept from the version being edited (same id and type)
    const oldItems = mine ? itemsOf(JSON.parse(mine.data || "{}")) : [];
    const oldById = new Map(oldItems.map(i => [i.id, i]));
    const uploads = [];
    let total = 0;
    for (const it of data.items) {
      if (it.type === "text" || it.type === "sticker" || (it.type === "pantalla" && it.key)) continue;   // a face filter's stickers and ready-made screen pictures have no upload
      const file = form.get("f_" + it.id);
      if (file && typeof file !== "string") {
        if (it.type === "video" && (file.size > P.videoMB * 1048576 || !/^video\/(mp4|webm|quicktime)$/.test(file.type))) return json({ error: `Cada video debe ser MP4, WebM o MOV de máximo ${P.videoMB} MB.` }, 400);
        if (["image", "pintura", "pantalla", "foto", "pagina"].includes(it.type) && (file.size > ITEM_LIMITS.imageBytes || !/^image\/(jpeg|png|webp)$/.test(file.type))) return json({ error: "Cada imagen debe ser JPG, PNG o WebP de máximo 5 MB." }, 400);
        if (it.type === "audio" && (file.size > ITEM_LIMITS.audioBytes || !/^audio\/(mpeg|mp3|mp4|x-m4a|m4a|aac)$/.test(file.type))) return json({ error: "Cada audio debe ser MP3 o M4A de máximo 10 MB." }, 400);
        if (it.type === "model") {
          if (file.size > P.modelMB * 1048576) return json({ error: `Cada objeto 3D debe pesar máximo ${P.modelMB} MB.` }, 400);
          if (new TextDecoder().decode(new Uint8Array(await file.slice(0, 4).arrayBuffer())) !== "glTF") return json({ error: "Los objetos 3D deben ser archivos GLB." }, 400);
        }
        it.file = "i/" + it.id; it.bytes = file.size;
        uploads.push([it.file, file, it.type === "model" ? "model/gltf-binary" : file.type]);
      } else {
        const o = oldById.get(it.id);
        if (!o || !o.file || o.type !== it.type) return json({ error: "Falta el archivo de uno de tus elementos. Vuelve a subirlo." }, 400);
        it.file = o.file; it.bytes = o.bytes || 0;
      }
      total += it.bytes;
    }
    if (total > P.totalMB * 1048576) return json({ error: `Tus elementos pesan ${(total / 1048576).toFixed(1)} MB. Tu plan ${P.name} permite ${P.totalMB} MB por experiencia.` }, 400);
    // an expired row with this slug that the cron has not deleted yet (anyone's): clear it first
    if (!mine || mine.slug !== slug) {
      const stale = await env.DB.prepare("SELECT slug, data FROM experiences WHERE slug = ?").bind(slug).first();
      if (stale) { await deleteMedia(env, slug, stale.data); await env.DB.prepare("DELETE FROM experiences WHERE slug = ?").bind(slug).run(); }
    }
    // changing the name moves the files that stay
    if (mine && mine.slug !== slug) {
      const moving = new Set(data.items.map(i => i.file).filter(Boolean));
      if (!image) moving.add("image"); if (!target) moving.add("target"); if (data.brand === "own" && !newLogo) moving.add("logo");
      for (const u of uploads) moving.delete(u[0]);
      for (const k of moving) { const o = await env.MEDIA.get(`exp/${mine.slug}/${k}`); if (o) await env.MEDIA.put(`exp/${slug}/${k}`, o.body, { httpMetadata: o.httpMetadata }); }
      await deleteMedia(env, mine.slug, mine.data);
      await env.DB.batch([env.DB.prepare("DELETE FROM experiences WHERE slug = ?").bind(mine.slug), env.DB.prepare("DELETE FROM clicks WHERE slug = ?").bind(slug), env.DB.prepare("UPDATE clicks SET slug = ? WHERE slug = ?").bind(slug, mine.slug)]);
    }
    if (image) await env.MEDIA.put(`exp/${slug}/image`, await image.arrayBuffer(), { httpMetadata: { contentType: image.type } });
    if (target) await env.MEDIA.put(`exp/${slug}/target`, await target.arrayBuffer(), { httpMetadata: { contentType: "application/octet-stream" } });
    if (data.brand === "own" && newLogo) await env.MEDIA.put(`exp/${slug}/logo`, await newLogo.arrayBuffer(), { httpMetadata: { contentType: newLogo.type } });
    for (const [k, file, type] of uploads) await env.MEDIA.put(`exp/${slug}/${k}`, file, { httpMetadata: { contentType: type } });
    // files of elements that were removed (and the old single video / 3D object once they are no longer used)
    if (mine && mine.slug === slug) {
      const keep = new Set(["target", "image", "qr", ...(data.brand === "own" ? ["logo"] : []), ...data.items.map(i => i.file).filter(Boolean)]);
      const gone = mediaKeys(slug, mine.data).filter(k => !keep.has(k.slice(`exp/${slug}/`.length)));
      if (gone.length) await env.MEDIA.delete(gone);
    }
    const now = Date.now();
    const created = mine ? mine.created : now;
    const expires = mine ? mine.expires : P.days ? now + P.days * 864e5 : FAR;
    await env.DB.prepare("INSERT INTO experiences (slug, email, title, data, created, updated, expires, views, paused) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, data = excluded.data, updated = excluded.updated")
      .bind(slug, who, data.title, JSON.stringify(data), created, now, expires, mine ? mine.views || 0 : 0).run();
    const row = await env.DB.prepare("SELECT * FROM experiences WHERE slug = ?").bind(slug).first();
    const out = ownerExp(row, request, env);
    if (meta.sendEmail !== false) ctx.waitUntil(sendMail(env, who, data.kind === "colorear" ? "Tu dibujo para colorear está listo" : data.kind === "menu" ? "Tu menú interactivo está listo" : data.kind === "links" ? "Tu página de links está lista" : data.kind === "ruleta" ? "Tu ruleta de premios está lista" : data.kind === "dispara" ? "Tu juego Dispara y gana está listo" : data.kind === "memorama" ? "Tu memorama está listo" : data.kind === "sopa" ? "Tu sopa de letras está lista" : data.kind === "rompecabezas" ? "Tu rompecabezas está listo" : data.kind === "filtro" ? "Tu filtro para la cara está listo" : data.kind === "trivia" ? "Tu trivia está lista" : "Tu experiencia de realidad aumentada está lista", linkMail(out), qr && qr.size < 300e3 ? [{ filename: `QR-${slug}.png`, content: b64(await qr.arrayBuffer()) }] : undefined));
    return json({ ok: true, experience: out });
  }

  // ---- courtesy code ----
  //   who = "todos": gives its plan for N months (ends on its own; the cron moves the account back to Gratis); not for Stripe subscribers
  //   who = "plan": only for accounts that already have that plan active, as N free months: a Stripe subscriber gets
  //     the price of those months as balance in Stripe (its next charges are free); a plan with an end date gets the months added
  if (path === "/api/coupon" && M === "POST") {
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    if (!(await limit(env, "coupon:" + me.id, 10, 3600e3))) return json({ error: "Demasiados intentos. Espera un rato." }, 429);
    if (planOf(me).member) return json({ error: "Tu cuenta es parte de un equipo; quien lo administra maneja el plan." }, 409);
    const code = String((await request.json().catch(() => ({}))).code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
    const c = code && await env.DB.prepare("SELECT * FROM coupons WHERE code = ?").bind(code).first();
    const now = Date.now();
    if (!c || !c.active || (c.expires && c.expires < now)) return json({ error: "Ese código no es válido o ya venció." }, 404);
    if (c.uses >= c.max_uses) return json({ error: "Ese código ya se usó todas las veces posibles." }, 410);
    const cur = planOf(me), subscribed = billingInfo(env, me).subscribed, onlyPlan = c.who === "plan";
    const active = cur.id === c.plan && (!cur.until || cur.until > now);
    if (onlyPlan) {
      if (!active) return json({ error: `Este código es solo para cuentas con el plan ${PLANS[c.plan].name} activo.` }, 409);
      if (!subscribed && !cur.until) return json({ error: `Tu plan ${PLANS[c.plan].name} no tiene fecha de vencimiento: no necesitas este código.` }, 409);
    } else {
      if (subscribed) return json({ error: "Ya tienes una suscripción activa; este código es para cuentas sin suscripción." }, 409);
      if (PLAN_RANK[cur.id] > PLAN_RANK[c.plan]) return json({ error: `Tu plan actual (${cur.name}) ya incluye más que este código.` }, 409);
    }
    const got = await env.DB.prepare("INSERT OR IGNORE INTO redemptions (code, user_id, at) VALUES (?, ?, ?)").bind(code, me.id, now).run();
    if (!got.meta.changes) return json({ error: "Ya usaste este código en tu cuenta." }, 409);
    const undo = () => env.DB.prepare("DELETE FROM redemptions WHERE code = ? AND user_id = ?").bind(code, me.id).run();
    const took = await env.DB.prepare("UPDATE coupons SET uses = uses + 1 WHERE code = ? AND uses < max_uses").bind(code).run();
    if (!took.meta.changes) { await undo(); return json({ error: "Ese código ya se usó todas las veces posibles." }, 410); }
    const months = `${c.months} ${c.months === 1 ? "mes" : "meses"}`;
    if (onlyPlan && subscribed) {   // paying with Stripe: the months as balance, taken off its next charges
      const amount = PLANS[c.plan].price * c.months * 100;   // centavos, IVA included like the price
      try {
        await stripe(env, "POST", `customers/${me.stripe_customer}/balance_transactions`, { amount: -amount, currency: "mxn", description: `Cupón ${code}: ${months} gratis del plan ${PLANS[c.plan].name}`, metadata: { app: "vvr", coupon: code, user: String(me.id) } }, "vvr-cup-" + code + "-" + me.id);
      } catch (e) {
        console.error("coupon credit", e.message); await undo(); await env.DB.prepare("UPDATE coupons SET uses = uses - 1 WHERE code = ? AND uses > 0").bind(code).run();
        return json({ error: "No se pudo aplicar el código. Intenta de nuevo en un momento." }, 502);
      }
      ctx.waitUntil(sendMail(env, me.email, `Tienes ${months} gratis de tu plan ${PLANS[c.plan].name}`, `<p>¡Hola${me.name ? " " + esc(me.name) : ""}!</p><p>Activaste el código <b>${esc(code)}</b>: te regalamos <b>${months}</b> de tu plan ${PLANS[c.plan].name}. Quedó como saldo a favor de <b>$${(amount / 100).toLocaleString("es-MX")}</b> en tu suscripción, así que tus próximos cobros se descuentan de ahí.</p><p>Gracias por ser parte de Vórtice VR.</p>`));
      return json({ ok: true, plan: PLANS[c.plan].name, credit: amount / 100, message: `¡Listo! Te regalamos ${months} de tu plan ${PLANS[c.plan].name}: $${(amount / 100).toLocaleString("es-MX")} de saldo a favor que se descuentan de tus próximos cobros.` });
    }
    // same plan with an end date: add the months to it; otherwise the plan starts now
    const from = cur.id === c.plan && cur.until && cur.until > now ? cur.until : now;
    const until = addMonths(from, c.months);
    await applyPlan(env, me, c.plan, until, onlyPlan ? (me.plan_note ||`Cupón ${code}`) : `Cupón ${code}`);
    ctx.waitUntil(sendMail(env, me.email, `Tu cortesía del plan ${PLANS[c.plan].name} está activa`, planMail(me, c.plan, until)));
    return json({ ok: true, plan: PLANS[c.plan].name, until, message: onlyPlan ? `¡Listo! Te regalamos ${months} más de tu plan ${PLANS[c.plan].name}: ahora vence el ${new Date(until).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" })}.` : undefined });
  }

  // ---- Empresarial team: the owner creates accounts for its people and hands each part of the plan's experiences ----
  if (path === "/api/team" || path.startsWith("/api/team/")) {
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    const P = planOf(me);
    if (!P.seats || P.member) return json({ error: "Los equipos son del plan Empresarial." }, 403);
    const now = Date.now();
    const { results: members } = await env.DB.prepare(`SELECT u.id, u.name, u.email, u.quota, u.created, u.temp_pw,
        (SELECT COUNT(*) FROM experiences e WHERE e.email = u.email AND e.paused = 0 AND e.expires > ?2) AS active
      FROM users u WHERE u.owner_id = ?1 ORDER BY u.created`).bind(me.id, now).all();
    const handed = members.reduce((n, x) => n + (x.quota || 0), 0);
    const ownActive = (await env.DB.prepare("SELECT COUNT(*) AS n FROM experiences WHERE email = ? AND paused = 0 AND expires > ?").bind(me.email, now).first()).n;
    const free = P.exp - handed - ownActive;   // experiences nobody is using yet
    const tempPw = () => { const A = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = crypto.getRandomValues(new Uint8Array(10)); return [...r].map(x => A[x % A.length]).join("").replace(/^(.{5})/, "$1-"); };
    if (path === "/api/team" && M === "GET") return json({ seats: P.seats, total: P.exp, handed, ownActive, free, members: members.map(x => ({ ...x, temp_pw: !!x.temp_pw })) });
    if (path === "/api/team" && M === "POST") {
      const b = await request.json().catch(() => ({}));
      const em = normEmail(b.email), name = String(b.name || "").trim().slice(0, 60), quota = Math.max(0, Math.round(Number(b.quota) || 0));
      if (!name || !em) return json({ error: "Escribe el nombre y un correo válido." }, 400);
      if (members.length >= P.seats) return json({ error: `Tu plan incluye hasta ${P.seats} cuentas en tu equipo.` }, 403);
      if (quota > free) return json({ error: `Solo tienes ${expCount(Math.max(0, free))} libres para repartir.` }, 400);
      if (await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(em).first()) return json({ error: "Ya existe una cuenta con ese correo. Usa otro correo para tu equipo." }, 409);
      if (!(await limit(env, "team:" + me.id, 30, 3600e3))) return json({ error: "Demasiadas cuentas seguidas. Espera un rato." }, 429);
      const pw = tempPw();
      await env.DB.prepare("INSERT INTO users (email, name, pass, verified, created, plan, owner_id, quota, extra_exp, temp_pw) VALUES (?, ?, ?, 1, ?, 'gratis', ?, ?, 0, 1)")
        .bind(em, name, await hashPassword(pw), now, me.id, quota).run();
      if (b.notify) ctx.waitUntil(sendMail(env, em, `${me.name || "Tu equipo"} te dio acceso a Vórtice VR`, teamMail(me, name, em, pw, quota, new URL(request.url).origin)));
      return json({ ok: true, email: em, password: pw });
    }
    const tm = path.match(/^\/api\/team\/(\d+)(\/password)?$/);
    const member = tm && members.find(x => x.id === Number(tm[1]));
    if (!member) return json({ error: "No encontramos esa cuenta en tu equipo." }, 404);
    if (tm[2] && M === "POST") {   // new temporary password (to hand over again)
      const pw = tempPw();
      await env.DB.batch([env.DB.prepare("UPDATE users SET pass = ?, temp_pw = 1 WHERE id = ?").bind(await hashPassword(pw), member.id), env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(member.id)]);
      return json({ ok: true, password: pw });
    }
    if (M === "POST") {   // change its experiences: less than it uses pauses the rest
      const quota = Math.max(0, Math.round(Number((await request.json().catch(() => ({}))).quota) || 0));
      if (quota - (member.quota || 0) > free) return json({ error: `Solo tienes ${expCount(Math.max(0, free))} libres para repartir.` }, 400);
      await env.DB.batch([env.DB.prepare("UPDATE users SET quota = ? WHERE id = ?").bind(quota, member.id), fitExperiences(env, member.email, quota, 0)]);
      return json({ ok: true });
    }
    if (M === "DELETE") {   // leaves the team: becomes a free account of its own
      await env.DB.batch([env.DB.prepare("UPDATE users SET owner_id = NULL, quota = NULL WHERE id = ?").bind(member.id), fitExperiences(env, member.email, PLANS.gratis.exp, PLANS.gratis.days)]);
      return json({ ok: true });
    }
    return json({ error: "No encontrado" }, 404);
  }

  // ---- seller panel (/vendedor/): code, link, how much and for what, and where the money goes ----
  if (path === "/api/seller" && M === "GET") {
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    const S = sellerOf(me); if (!S) return json({ error: "Tu cuenta no es de vendedor." }, 403);
    const code = me.ref_code || await newRefCode(env, me);
    const [{ results: refs }, { results: rows }] = await env.DB.batch([
      env.DB.prepare("SELECT name, plan, plan_until, created, stripe_status FROM users WHERE ref_by = ? ORDER BY created DESC LIMIT 1000").bind(me.id),
      env.DB.prepare("SELECT c.*, u.name FROM commissions c LEFT JOIN users u ON u.id = c.user_id WHERE c.referrer_id = ? AND c.kind = 'seller' ORDER BY c.created DESC LIMIT 1000").bind(me.id),
    ]);
    const sum = st => rows.filter(r => r.status === st).reduce((n, r) => n + r.commission, 0) / 100;
    const short = n => { const p = String(n || "").trim().split(/\s+/); return p[0] + (p[1] ? " " + p[1][0] + "." : ""); };
    const pay = (() => { try { return JSON.parse(me.payout || "null"); } catch { return null; } })();
    return json({
      active: !!S.active, name: me.name, code, link: `${new URL(request.url).origin}/cuenta/?ref=${code}#registro`, discount: REF.discount, holdDays: REF.holdDays,
      rates: Object.fromEntries(SELLER_KEYS.map(k => [k, Number((S.rates || {})[k]) || 0])),
      registered: refs.length, sales: rows.filter(r => r.status !== "cancelada").length,
      totals: { pendiente: sum("pendiente"), porPagar: sum("disponible"), pagada: sum("pagada"), cancelada: sum("cancelada") },
      clients: refs.slice(0, 300).map(r => ({ name: short(r.name), plan: planOf(r).name, since: r.created, paying: STRIPE_LIVE.includes(r.stripe_status) })),
      rows: rows.map(r => ({ name: short(r.name), plan: PLANS[r.plan] ? PLANS[r.plan].name : r.plan, amount: r.amount / 100, commission: r.commission / 100, status: r.status, created: r.created, available_at: r.available_at, paid_at: r.paid_at, note: r.note })),
      payout: pay ? { clabe: pay.clabe ? "•••• " + String(pay.clabe).slice(-4) : "", banco: pay.banco || "", titular: pay.titular || "", rfc: pay.rfc || "" } : null,
    });
  }
  if (path === "/api/seller/payout" && M === "POST") {   // where the seller wants the transfers (the CLABE is shown back only by its last 4 digits)
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    if (!sellerOf(me)) return json({ error: "Tu cuenta no es de vendedor." }, 403);
    const b = await request.json().catch(() => ({})), clabe = String(b.clabe || "").replace(/\D/g, "");
    if (!clabeOk(clabe)) return json({ error: "Revisa tu CLABE: son 18 números (la encuentras en tu app del banco)." }, 400);
    const titular = String(b.titular || "").trim().slice(0, 100); if (!titular) return json({ error: "Escribe el nombre del titular de la cuenta." }, 400);
    const p = { clabe, banco: String(b.banco || "").trim().slice(0, 60) || CLABE_BANKS[clabe.slice(0, 3)] || "", titular, rfc: String(b.rfc || "").trim().toUpperCase().slice(0, 13), at: Date.now() };
    await env.DB.prepare("UPDATE users SET payout = ? WHERE id = ?").bind(JSON.stringify(p), me.id).run();
    return json({ ok: true, banco: p.banco });
  }

  // ---- Recomienda y gana: the account's code, link and report ----
  if (path === "/api/referral" && M === "GET") {
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    const P = planOf(me), eligible = REF.plans.includes(P.id) && !P.member;
    let code = me.ref_code;
    if (eligible && !code) code = await newRefCode(env, me);
    const [{ results: refs }, { results: rows }] = await env.DB.batch([
      env.DB.prepare("SELECT name, plan, plan_until, created, stripe_status FROM users WHERE ref_by = ? ORDER BY created DESC LIMIT 500").bind(me.id),
      env.DB.prepare("SELECT c.*, u.name FROM commissions c LEFT JOIN users u ON u.id = c.user_id WHERE c.referrer_id = ? AND COALESCE(c.kind, 'ref') = 'ref' ORDER BY c.created DESC LIMIT 300").bind(me.id),
    ]);
    const sum = st => rows.filter(r => r.status === st).reduce((n, r) => n + r.commission, 0);
    const short = n => { const p = String(n || "").trim().split(/\s+/); return p[0] + (p[1] ? " " + p[1][0] + "." : ""); };
    return json({
      eligible, code: eligible ? code : null, link: eligible && code ? `${new URL(request.url).origin}/cuenta/?ref=${code}#registro` : null,
      rate: REF.rate * 100, discount: REF.discount, holdDays: REF.holdDays, minPayout: REF.minPayout / 100,
      registered: refs.length, paying: refs.filter(r => STRIPE_LIVE.includes(r.stripe_status)).length,
      totals: { pendiente: sum("pendiente") / 100, disponible: sum("disponible") / 100, abonada: sum("abonada") / 100, pagada: sum("pagada") / 100 },
      referred: refs.slice(0, 100).map(r => ({ name: short(r.name), plan: planOf(r).name, since: r.created, paying: STRIPE_LIVE.includes(r.stripe_status) })),
      rows: rows.map(r => ({ name: short(r.name), plan: PLANS[r.plan] ? PLANS[r.plan].name : r.plan, amount: r.amount / 100, commission: r.commission / 100, status: r.status, created: r.created, available_at: r.available_at, paid_at: r.paid_at })),
    });
  }

  // ---- support from the dashboard: the message goes with the account details; paid plans are marked first ----
  if (path === "/api/support" && M === "POST") {
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    const b = await request.json().catch(() => ({}));
    const msg = String(b.message || "").trim().slice(0, 3000);
    if (msg.length < 5) return json({ error: "Cuéntanos qué pasó." }, 400);
    if (!(await limit(env, "support:" + me.id, 6, 3600e3))) return json({ error: "Ya recibimos varios mensajes tuyos; te respondemos pronto." }, 429);
    const P = planOf(me), n = await env.DB.prepare("SELECT COUNT(*) AS n FROM experiences WHERE email = ? AND expires > ?").bind(me.email, Date.now()).first();
    const slug = String(b.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
    const html = shell(`<h1 style="font-size:20px">Soporte · plan ${esc(P.name)}</h1>
<p><b>${esc(me.name || "")}</b> · <a href="mailto:${esc(me.email)}" style="color:#ffbe55">${esc(me.email)}</a></p>
<p style="color:#d2b8ff">Plan ${esc(P.name)}${me.stripe_status ? " · Stripe: " + esc(me.stripe_status) : ""} · ${n.n} experiencias${slug ? ` · sobre: <b>${esc(slug)}</b>` : ""}</p>
<div style="white-space:pre-wrap;background:#1b0a36;border-radius:10px;padding:14px">${esc(msg)}</div>
<p style="color:#a99bcb;font-size:12px">Contesta este correo para responderle directamente.</p>`);
    const tag = P.id === "gratis" ? "" : `[${P.name}] `;
    const sent = await sendMail(env, env.CONTACT_TO || "hola@vorticevr.mx", `${tag}Soporte: ${me.name || me.email}`, html, undefined, me.email);
    return sent ? json({ ok: true }) : json({ error: "No se pudo enviar. Escríbenos a hola@vorticevr.mx." }, 502);
  }

  // ---- payments: start a subscription (Stripe Checkout) or manage it (Customer Portal) ----
  if ((path === "/api/billing/checkout" || path === "/api/billing/portal") && M === "POST") {
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    const bi = billingInfo(env, me);
    if (!bi.enabled) return json({ error: env.STRIPE_SECRET_KEY ? "Los pagos en línea están en modo de prueba." : "El pago en línea todavía no está disponible." }, 503);
    const mode = stripeMode(env), origin = new URL(request.url).origin;
    let customer = me.stripe_mode === mode ? me.stripe_customer : null;
    if (path === "/api/billing/portal" || bi.subscribed) {   // already paying: switching plan or cancelling happens in the portal
      if (!customer) return json({ error: "No encontramos tu suscripción." }, 404);
      const s = await stripe(env, "POST", "billing_portal/sessions", { customer, return_url: `${origin}/cuenta/`, configuration: await stripePortalConfig(env) });
      return json({ url: s.url, portal: true });
    }
    const b = await request.json().catch(() => ({}));
    if (!STRIPE_PRICES[b.plan] || PLANS[b.plan].legacy) return json({ error: "Plan inválido." }, 400);
    const period = b.period === "anio" ? "anio" : "mes";
    const price = await stripePrice(env, b.plan, period);
    const newCustomer = async () => {
      const c = await stripe(env, "POST", "customers", { email: me.email, name: me.name, metadata: { user_id: me.id } });
      await env.DB.prepare("UPDATE users SET stripe_customer = ?, stripe_mode = ? WHERE id = ?").bind(c.id, mode, me.id).run();
      return c.id;
    };
    if (!customer) customer = await newCustomer();
    const refDiscount = me.ref_by && !me.stripe_sub ? await stripeRefCoupon(env) : null;   // 10% off the first year
    const session = c => stripe(env, "POST", "checkout/sessions", {
      mode: "subscription", customer: c, client_reference_id: me.id, locale: "es-419",
      ...(refDiscount ? { discounts: [{ coupon: refDiscount }] } : { allow_promotion_codes: "true" }),
      line_items: [{ price: price.id, quantity: 1 }],
      subscription_data: { metadata: { user_id: me.id, plan: b.plan, period } },
      success_url: `${origin}/cuenta/?pago=ok`, cancel_url: `${origin}/cuenta/?pago=cancelado#planes`,
    });
    let s;
    try { s = await session(customer); }
    catch (e) { if (e.code !== "resource_missing") throw e; s = await session(await newCustomer()); } // the customer was deleted in Stripe
    return json({ url: s.url });
  }

  // ---- admin (ADMIN_EMAILS; by default César): plans are activated by hand, schools pay outside the site ----
  if (path.startsWith("/api/admin/")) {
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    if (!isAdmin(env, me)) return json({ error: "No tienes acceso." }, 403);
    const now = Date.now();
    if (path === "/api/admin/users" && M === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 80);
      const { results } = await env.DB.prepare(`SELECT u.id, u.email, u.name, u.verified, u.created, u.plan, u.plan_until, u.plan_note, u.stripe_status, u.stripe_mode,
          u.owner_id, u.quota, u.extra_exp, o.plan AS o_plan, o.plan_until AS o_until, o.name AS o_name, o.email AS o_email,
          (SELECT COUNT(*) FROM users t WHERE t.owner_id = u.id) AS team,
          (SELECT COUNT(*) FROM experiences e WHERE e.email = u.email AND e.paused = 0 AND e.expires > ?1) AS active,
          (SELECT COUNT(*) FROM experiences e WHERE e.email = u.email AND e.paused = 1 AND e.expires > ?1) AS paused,
          (SELECT COALESCE(SUM(views), 0) FROM experiences e WHERE e.email = u.email) AS views
        FROM users u LEFT JOIN users o ON o.id = u.owner_id WHERE (?2 = '' OR instr(lower(u.email), ?2) > 0 OR instr(lower(u.name), ?2) > 0)
        ORDER BY (COALESCE(u.plan, 'gratis') != 'gratis') DESC, u.created DESC LIMIT 300`).bind(now, q).all();
      const totals = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM users WHERE verified = 1) AS users,
          (SELECT COUNT(*) FROM users WHERE COALESCE(plan, 'gratis') != 'gratis') AS paid,
          (SELECT COUNT(*) FROM experiences WHERE paused = 0 AND expires > ?1) AS experiences,
          (SELECT COALESCE(SUM(views), 0) FROM experiences) AS views`).bind(now).first();
      return json({ users: results.map(u => { const P = planOf(u); return { ...u, effective: P.id, limit: P.exp }; }), totals, plans: PLANS });
    }
    if (path === "/api/admin/experiences" && M === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM experiences WHERE email = ? AND expires > ? ORDER BY paused, updated DESC LIMIT 1000").bind(normEmail(url.searchParams.get("email")), now).all();
      return json({ experiences: results.map(r => ownerExp(r, request, env)) });
    }
    if (path === "/api/admin/coupons" && M === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM coupons ORDER BY created DESC LIMIT 200").all();
      return json({ coupons: results });
    }
    if (path === "/api/admin/coupons" && M === "POST") {
      const b = await request.json().catch(() => ({}));
      if (!["pro", "premium"].includes(b.plan)) return json({ error: "Elige el plan del cupón." }, 400);
      const months = Math.round(Number(b.months)), uses = Math.round(Number(b.max_uses));
      if (!(months >= 1 && months <= 24)) return json({ error: "Los meses deben ser de 1 a 24." }, 400);
      if (!(uses >= 1 && uses <= 10000)) return json({ error: "Las veces de uso deben ser de 1 a 10,000." }, 400);
      const who = b.who === "plan" ? "plan" : "todos";
      let code = String(b.code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 30);
      if (code && code.length < 4) return json({ error: "El código debe tener al menos 4 letras o números." }, 400);
      if (!code) { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = crypto.getRandomValues(new Uint8Array(8)); code = "VVR-" + [...r].map((x, i) => A[x % A.length] + (i === 3 ? "-" : "")).join(""); }
      let expires = null;
      if (b.expires) { const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b.expires)); if (!d) return json({ error: "Fecha inválida." }, 400); expires = Date.UTC(+d[1], +d[2] - 1, +d[3], 23, 59, 59) + 6 * 3600e3; }
      const r = await env.DB.prepare("INSERT OR IGNORE INTO coupons (code, plan, months, max_uses, uses, expires, note, active, created, who) VALUES (?, ?, ?, ?, 0, ?, ?, 1, ?, ?)")
        .bind(code, b.plan, months, uses, expires, String(b.note || "").trim().slice(0, 200), now, who).run();
      if (!r.meta.changes) return json({ error: "Ya existe un cupón con ese código." }, 409);
      return json({ ok: true, code });
    }
    m = path.match(/^\/api\/admin\/coupons\/([A-Z0-9-]+)$/);
    if (m && M === "POST") {
      const b = await request.json().catch(() => ({}));
      await env.DB.prepare("UPDATE coupons SET active = ? WHERE code = ?").bind(b.active ? 1 : 0, m[1]).run();
      return json({ ok: true });
    }
    if (path === "/api/admin/stats" && M === "GET") return json(await adminStats(env, request));
    if (path === "/api/admin/commissions" && M === "GET") {
      const { results: rows } = await env.DB.prepare(`SELECT c.*, r.name AS r_name, r.email AS r_email, u.name AS u_name, u.email AS u_email FROM commissions c
        LEFT JOIN users r ON r.id = c.referrer_id LEFT JOIN users u ON u.id = c.user_id ORDER BY c.created DESC LIMIT 2000`).all();
      if (url.searchParams.get("csv")) {
        const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`, d = t => t ? new Date(t - 6 * 3600e3).toISOString().slice(0, 10) : "";
        const csv = [["Fecha", "Tipo", "Recomendó", "Correo de quien recomendó", "Cliente", "Correo del cliente", "Plan", "Factura Stripe", "Pagó (MXN)", "Comisión (MXN)", "Estado", "Disponible desde", "Pagada el", "Nota"].map(q).join(",")]
          .concat(rows.map(r => [d(r.created), r.kind === "seller" ? "Vendedor" : "Recomienda y gana", r.r_name, r.r_email, r.u_name, r.u_email, r.plan, r.invoice, (r.amount / 100).toFixed(2), (r.commission / 100).toFixed(2), r.status, d(r.available_at), d(r.paid_at), r.note].map(q).join(","))).join("\r\n");
        return new Response("\ufeff" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="comisiones-${d(now)}.csv"` } });
      }
      const by = {};
      for (const r of rows) { const k = r.referrer_id, x = by[k] ||= { referrer_id: k, name: r.r_name, email: r.r_email, pendiente: 0, disponible: 0, abonada: 0, pagada: 0, cancelada: 0, payments: 0 };
        x[r.status] = (x[r.status] || 0) + r.commission / 100; if (r.status !== "cancelada") x.payments += r.amount / 100; }
      const t = st => rows.filter(r => r.status === st).reduce((n, r) => n + r.commission, 0) / 100;
      return json({ minPayout: REF.minPayout / 100, totals: { pendiente: t("pendiente"), disponible: t("disponible"), abonada: t("abonada"), pagada: t("pagada"), cancelada: t("cancelada"), ventas: rows.filter(r => r.status !== "cancelada").reduce((n, r) => n + r.amount, 0) / 100 },
        referrers: Object.values(by).sort((a, b) => b.disponible - a.disponible), rows: rows.slice(0, 300).map(r => ({ ...r, amount: r.amount / 100, commission: r.commission / 100 })) });
    }
    if (path === "/api/admin/commissions/credit" && M === "POST") return json(await creditCommissions(env));   // "Abonar ahora"
    if (path === "/api/admin/sellers" && M === "GET") {
      const { results: us } = await env.DB.prepare("SELECT id, name, email, ref_code, seller, payout FROM users WHERE seller IS NOT NULL ORDER BY name").all();
      const { results: cs } = await env.DB.prepare("SELECT referrer_id, status, COUNT(*) AS n, SUM(commission) AS c FROM commissions WHERE kind = 'seller' GROUP BY referrer_id, status").all();
      const { results: rg } = await env.DB.prepare("SELECT ref_by, COUNT(*) AS n FROM users WHERE ref_by IN (SELECT id FROM users WHERE seller IS NOT NULL) GROUP BY ref_by").all();
      return json({ sellers: us.map(u => { const S = sellerOf(u) || {}, mine = cs.filter(c => c.referrer_id === u.id), t = st => (mine.find(c => c.status === st) || {}).c / 100 || 0;
        let pay = null; try { pay = JSON.parse(u.payout || "null"); } catch {}
        return { id: u.id, name: u.name, email: u.email, code: u.ref_code, active: !!S.active, rates: Object.fromEntries(SELLER_KEYS.map(k => [k, Number((S.rates || {})[k]) || 0])),
          registered: (rg.find(r => r.ref_by === u.id) || {}).n || 0, sales: mine.filter(c => c.status !== "cancelada").reduce((n, c) => n + c.n, 0),
          totals: { pendiente: t("pendiente"), porPagar: t("disponible"), pagada: t("pagada") }, payout: pay }; }) });
    }
    if (path === "/api/admin/seller" && M === "POST") {
      const b = await request.json().catch(() => ({}));
      const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(normEmail(b.email)).first();
      if (!user) return json({ error: "No existe una cuenta con ese correo. Pídele que se registre primero en vorticevr.mx/cuenta/." }, 404);
      if (user.owner_id) return json({ error: "Esa cuenta es parte de un equipo; usa otra." }, 409);
      const old = sellerOf(user) || {}, rates = {};
      for (const k of SELLER_KEYS) { const v = Math.round(Number((b.rates || {})[k] ?? (old.rates || {})[k] ?? 0)); if (!(v >= 0 && v <= 100000)) return json({ error: "Las comisiones deben ser de $0 a $100,000." }, 400); rates[k] = v; }
      let code = String(b.code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
      if (code && code !== user.ref_code) {
        if (code.length < 3) return json({ error: "El código debe tener al menos 3 letras o números." }, 400);
        const r = await env.DB.prepare("UPDATE users SET ref_code = ? WHERE id = ? AND NOT EXISTS (SELECT 1 FROM users WHERE ref_code = ? AND id != ?)").bind(code, user.id, code, user.id).run();
        if (!r.meta.changes) return json({ error: "Ese código ya lo tiene otra cuenta." }, 409);
      } else if (!user.ref_code) code = await newRefCode(env, user);
      const S = { active: b.active !== false, rates, since: old.since || now };
      await env.DB.prepare("UPDATE users SET seller = ? WHERE id = ?").bind(JSON.stringify(S), user.id).run();
      return json({ ok: true, code: code || user.ref_code });
    }
    if (path === "/api/admin/commissions/pay" && M === "POST") {   // you transferred the money: mark everything available for that person as paid
      const b = await request.json().catch(() => ({}));
      const ref = String(b.note || "").trim().slice(0, 200);   // the transfer's reference goes after what the row already says (a seller's "Primer pago · Pro anual")
      const r = await env.DB.prepare("UPDATE commissions SET status = 'pagada', paid_at = ?, note = CASE WHEN ? = '' THEN note WHEN note IS NULL OR note = '' THEN ? ELSE note || ' · Pago: ' || ? END WHERE referrer_id = ? AND status = 'disponible'").bind(now, ref, ref, ref, Number(b.referrer_id)).run();
      return json({ ok: true, rows: r.meta.changes });
    }
    if (path === "/api/admin/plan" && M === "POST") {
      const b = await request.json().catch(() => ({}));
      const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(normEmail(b.email)).first();
      if (!user) return json({ error: "No existe una cuenta con ese correo. Pídele que se registre primero en vorticevr.mx/cuenta/." }, 404);
      const plan = String(b.plan || "");
      if (!PLANS[plan]) return json({ error: "Plan inválido." }, 400);
      let until = null;
      if (plan !== "gratis" && b.until) {
        const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b.until));
        if (!d) return json({ error: "Fecha inválida." }, 400);
        until = Date.UTC(+d[1], +d[2] - 1, +d[3], 23, 59, 59) + 6 * 3600e3; // end of that day in Mexico (UTC−6)
        if (until < now) return json({ error: "Esa fecha ya pasó." }, 400);
      }
      if (user.owner_id) return json({ error: "Esa cuenta es parte de un equipo Empresarial; su plan lo da su equipo." }, 409);
      const extra = Math.max(0, Math.min(100000, Math.round(Number(b.extra) || 0)));
      await env.DB.prepare("UPDATE users SET extra_exp = ? WHERE id = ?").bind(extra, user.id).run();
      await applyPlan(env, user, plan, until, String(b.note || "").trim().slice(0, 300));
      if (b.notify && plan !== "gratis") ctx.waitUntil(sendMail(env, user.email, `Tu plan ${PLANS[plan].name} de Vórtice VR está activo`, planMail(user, plan, until)));
      return json({ ok: true });
    }
  }
  return json({ error: "No encontrado" }, 404);
}

function publicExp(row) {
  const d = JSON.parse(row.data || "{}"), out = publicKind(row, d);
  if (d.brand === "own" || d.brand === "none") out.brand = d.brand;
  return out;
}
function publicKind(row, d) {
  if (d.kind === "trivia") return { slug: row.slug, kind: "trivia", title: row.title, trivia: d.trivia, buttons: d.buttons, expires: row.expires };
  if (d.kind === "filtro") return { slug: row.slug, kind: "filtro", title: row.title, filtro: d.filtro, items: d.items || [], buttons: d.buttons, expires: row.expires };
  if (d.kind === "colorear") return { slug: row.slug, kind: "colorear", title: row.title, img: d.img, color: d.color, buttons: d.buttons, expires: row.expires };
  if (d.kind === "menu") return { slug: row.slug, kind: "menu", title: row.title, menu: d.menu, items: d.items || [], buttons: d.buttons, updated: row.updated, expires: row.expires };
  if (d.kind === "links") return { slug: row.slug, kind: "links", title: row.title, links: d.links, items: d.items || [], updated: row.updated, expires: row.expires };
  if (d.kind === "rompecabezas") return { slug: row.slug, kind: "rompecabezas", title: row.title, img: d.img, rompecabezas: d.rompecabezas, updated: row.updated, expires: row.expires };
  if (d.kind === "sopa") return { slug: row.slug, kind: "sopa", title: row.title, sopa: d.sopa, updated: row.updated, expires: row.expires };
  if (d.kind === "memorama") return { slug: row.slug, kind: "memorama", title: row.title, memorama: d.memorama, items: d.items || [], updated: row.updated, expires: row.expires };
  if (d.kind === "dispara") return { slug: row.slug, kind: "dispara", title: row.title, dispara: d.dispara, items: d.items || [], updated: row.updated, expires: row.expires };
  if (d.kind === "ruleta") return { slug: row.slug, kind: "ruleta", title: row.title, ruleta: d.ruleta, items: d.items || [], updated: row.updated, expires: row.expires };
  if (d.kind === "superficie") return { slug: row.slug, kind: "superficie", title: row.title, img: d.img, items: d.items || [], sparks: d.sparks, buttons: d.buttons, updated: row.updated, expires: row.expires };
  return { slug: row.slug, kind: "ra", title: row.title, img: d.img, place: d.place || "mesa", sparks: d.sparks, scenes: d.scenes || 1, items: itemsOf(d), buttons: d.buttons, expires: row.expires };
}
function ownerExp(row, request, env) {
  return { ...publicExp(row), url: expUrl(row.slug, request, env), created: row.created, updated: row.updated, views: row.views, paused: !!row.paused, forever: row.expires >= FAR };
}
function expUrl(slug, request, env) {
  const root = env.ROOT_DOMAIN || ROOT_DEFAULT;
  const host = new URL(request.url).host;
  if (host === root || host.endsWith("." + root) || host === "www." + root) return `https://${slug}.${root}/`;
  return `${new URL(request.url).origin}/e/${slug}/`; // previews and local tests
}
// own = slug of the experience being edited (it may keep its name)
async function slugStatus(env, slug, owner, own, admin) {
  if (!SLUG.test(slug)) return { ok: false, reason: "Usa de 3 a 30 letras minúsculas, números o guiones (sin acentos ni espacios)." };
  if (RESERVED.has(slug) || (ADMIN_SLUGS.has(slug) && !admin)) return { ok: false, reason: "Ese nombre está reservado." };
  if (slug === own) return { ok: true };
  const row = await env.DB.prepare("SELECT email, expires FROM experiences WHERE slug = ?").bind(slug).first();
  if (row && row.expires > Date.now()) {
    // a free one close to it (tu-nombre-2…9): the creators take it while the link still follows the title
    const alts = [2, 3, 4, 5, 6, 7, 8, 9].map(n => slug.slice(0, 28) + "-" + n).filter(s => !RESERVED.has(s) && !ADMIN_SLUGS.has(s));
    const taken = new Set((await env.DB.prepare(`SELECT slug FROM experiences WHERE expires > ? AND slug IN (${alts.map(() => "?").join(",")})`).bind(Date.now(), ...alts).all()).results.map(r => r.slug));
    return { ok: false, reason: owner && row.email === owner ? "Ya tienes otra experiencia con ese link." : "Ese nombre ya está ocupado.", suggest: alts.find(s => !taken.has(s)) };
  }
  return { ok: true };
}
// Experiences made before elements had one video (fit) and/or one 3D object: the same thing as elements.
function itemsOf(d) {
  if (Array.isArray(d.items)) return d.items;
  const out = [];
  if (d.video && d.video.w) {
    const IH = d.img ? d.img.h / d.img.w : 1, VA = d.video.w / d.video.h;
    const v = { id: "video", type: "video", file: "video", w: d.video.w, h: d.video.h, x: 0, y: 0, z: 0, s: 1, r: 0, o: "frente", in: "aparecer", scene: 0, sound: true, chroma: null };
    if (d.fit === "height") v.s = IH * VA; else if (d.fit === "fill") v.ar = 1 / IH;
    out.push(v);
  }
  if (d.model) out.push({ id: "model", type: "model", file: "model", ...d.model, anim: 0, in: "aparecer", scene: 0 });
  return out;
}
const HEX = /^#[0-9a-f]{6}$/i;
// a link to open when an element is tapped: a web address, or a phone number (opens WhatsApp)
function cleanLink(v) {
  v = String(v || "").trim().slice(0, 300);
  if (!v) return null;
  if (/^\+?[\d\s().-]{8,}$/.test(v)) { let d = v.replace(/\D/g, ""); if (d.length === 10) d = "52" + d; return d.length >= 10 ? "https://wa.me/" + d : undefined; }
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try { const u = new URL(v); if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return undefined; return u.href; } catch { return undefined; }
}
// Elements on the image (see assets/escena.js for what each field means). Files are filled in by /api/publish.
const MOTIONS = ["girar", "palpitar", "vaiven", "balancear"];
// sparkles around the experience (both augmented realities): {c: color, n: how many 1-100}
function cleanSparks(f) { if (!f || typeof f !== "object") return null; const n = Math.round(Number(f.n)); return { c: HEX.test(String(f.c || "")) ? String(f.c).toLowerCase() : "#ffd27f", n: n >= 1 && n <= 100 ? n : 40 }; }
function cleanItems(list, P) {
  const f = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.round(Math.min(b, Math.max(a, v)) * 1e4) / 1e4 : d; };
  const int = (v, a, b) => { v = Math.round(Number(v)); return Number.isFinite(v) && v >= a && v <= b ? v : null; };
  if (!Array.isArray(list) || !list.length) return { error: "Agrega al menos un elemento: un video, una imagen, un texto o un objeto 3D." };
  if (list.length > P.items) return { error: `Tu plan ${P.name} permite hasta ${P.items} elementos por experiencia.` };
  const out = [], ids = new Set();
  let sound = false, videos = 0; const audioScenes = new Set();
  for (const m of list) {
    const id = String(m && m.id || "");
    if (!/^(video|model|[a-z0-9]{6,16})$/.test(id) || ids.has(id) || !ITEM_TYPES.includes(m.type)) return { error: "Uno de tus elementos no es válido." };
    ids.add(id);
    const it = { id, type: m.type, x: f(m.x, -2, 2, 0), y: f(m.y, -2, 2, 0), z: f(m.z, -1, 2, 0), s: f(m.s, 0.02, 4, 0.6) };
    // rotation on the 3 axes (degrees); elements saved before it have o ("frente" | "pie") and r
    if (m.rx != null || m.ry != null || m.rz != null) { it.rx = f(m.rx, -360, 360, 0); it.ry = f(m.ry, -360, 360, 0); it.rz = f(m.rz, -360, 360, 0); }
    else { it.o = m.o === "pie" ? "pie" : "frente"; it.r = f(m.r, -360, 360, 0); }
    it.in = ENTRANCES.includes(m.in) ? m.in : "aparecer"; it.scene = int(m.scene, 0, ITEM_LIMITS.scenes - 1) || 0;
    // motion in a loop (assets/escena.js): girar | palpitar | vaiven | balancear around x | y | z, how much and how fast (1-100)
    if (m.mv && MOTIONS.includes(m.mv.k) && m.type !== "audio") it.mv = { k: m.mv.k, ax: ["x", "y", "z"].includes(m.mv.ax) ? m.mv.ax : "y", a: int(m.mv.a, 1, 100) ?? 50, v: int(m.mv.v, 1, 100) ?? 50 };
    const name = String(m.name || "").trim().slice(0, 60); if (name) it.name = name;
    const link = cleanLink(m.link);
    if (link === undefined) return { error: `El enlace de "${name || "un elemento"}" no es válido. Escribe una dirección web o un número de WhatsApp.` };
    if (link) it.link = link;
    if (m.type === "video" || m.type === "image") {
      it.w = int(m.w, 1, 8000); it.h = int(m.h, 1, 8000);
      if (!it.w || !it.h) return { error: "Faltan las medidas de un video o una imagen." };
    }
    if (m.type === "video") {
      if (++videos > ITEM_LIMITS.videos) return { error: `Puedes poner hasta ${ITEM_LIMITS.videos} videos por experiencia.` };
      const ar = f(m.ar, 0.05, 20, null); if (ar) it.ar = ar;
      it.sound = !!m.sound && !sound; sound = sound || it.sound;   // only one video plays with sound
      it.chroma = m.chroma && HEX.test(m.chroma.color) ? { color: m.chroma.color.toLowerCase(), tol: f(m.chroma.tol, 0.05, 0.9, 0.3) } : null;
    }
    if (m.type === "text") {
      it.text = String(m.text || "").replace(/\r/g, "").trim().slice(0, 300);
      if (!it.text) return { error: "Uno de tus textos está vacío." };
      it.font = FONTS.includes(m.font) ? m.font : "Sora";
      it.color = HEX.test(m.color) ? m.color : "#ffffff";
      it.stroke = HEX.test(m.stroke) ? m.stroke : null;
    }
    if (m.type === "model") it.anim = int(m.anim, -1, 99) ?? 0;
    if (m.type === "audio") {   // MP3 / M4A: plays while its scene is on view; loop or once
      if (audioScenes.has(it.scene)) return { error: "Puedes poner un audio por escena." };
      audioScenes.add(it.scene); it.loop = m.loop !== false; delete it.link;
    }
    out.push(it);
  }
  return { items: out };
}
// Trivia with face tracking (assets/trivia.js): 1 to 5 questions, each with the answer on the left (a[0]) and on the right
// (a[1]); ok = which one is right. time = seconds to answer each one (0 = no limit). color = its bubbles' color; logo = it
// has its own picture/logo (uploaded as "image", shown on the question and in the intro).
const TRIVIA = { max: 5, times: [0, 5, 10, 15, 20] };
function cleanTrivia(t) {
  const list = Array.isArray(t && t.questions) ? t.questions : [];
  if (!list.length) return { error: "Agrega al menos una pregunta." };
  if (list.length > TRIVIA.max) return { error: `Puedes poner hasta ${TRIVIA.max} preguntas.` };
  const questions = [];
  for (const [i, x] of list.entries()) {
    const q = String(x && x.q || "").trim().slice(0, 140), a = (Array.isArray(x && x.a) ? x.a : []).slice(0, 2).map(v => String(v || "").trim().slice(0, 40));
    if (!q) return { error: `Escribe la pregunta ${i + 1}.` };
    if (a.length < 2 || !a[0] || !a[1]) return { error: `Escribe las dos respuestas de la pregunta ${i + 1}.` };
    questions.push({ q, a, ok: x.ok === 1 ? 1 : 0 });
  }
  const time = TRIVIA.times.includes(Number(t.time)) ? Number(t.time) : 10;
  const color = /^#[0-9a-f]{6}$/i.test(String(t.color || "")) ? String(t.color).toLowerCase() : "#8b3fd6";   // the bubbles' color
  return { questions, time, color, logo: !!t.logo };   // logo: its picture/logo is exp/<slug>/image
}
// Face filter (assets/filtro.js): paint on the face, stickers (drawn in code, type "sticker") or the creator's own images
// (type "image", uploaded like any element) pinned to a point of the face, an effect when the mouth opens and a frame.
// x, y = offset in cm from the point (the canonical face is ~15 cm wide), s = width in cm, r = turn in degrees.
// The image of the experience (exp/<slug>/image) is a picture of the creator's preview, for the dashboard and the intro.
const FILTRO = {
  items: 6, anchors: ["cabeza", "frente", "ojos", "nariz", "boca", "barbilla", "mejillas"],
  // drawn in code (the first ones, kept for the filters made with them) and pictures in assets/filtros/
  stickers: ["lentes-corazon", "lentes-sol", "corona", "flores", "orejas", "bigote", "gorro", "corazon",
    "corona-flores", "lentes-catrina", "sombrero-copa", "lentes-catrin", "bigote-catrin", "mono-catrin", "gorro-santa", "diadema-reno", "nariz-reno",
    "lentes-navidad", "gorro-fiesta", "lentes-fiesta", "orejas-gato", "nariz-gato", "lentes-gato", "diadema-corazones", "corazon-mejilla", "lentes-vortice"],
  paints: ["ninguna", "catrina", "corazones", "mexico", "brillos", "gatito", "propia"],
  effects: ["ninguno", "corazones", "estrellas", "flores", "confeti", "calaveritas", "nieve", "huellas"],
  // ready-made screen decorations (pictures in assets/filtros/, no upload)
  screenKeys: ["papel-picado", "esquina-cempasuchil", "luces-navidad", "esquina-pino", "guirnalda-banderines", "esquina-globos", "esquina-corazones"],
  frames: ["ninguno", "muertos", "brillo", "cinta", "polaroid"],
  looks: ["ninguno", "vivo", "calido", "frio", "bn", "sepia", "retro", "sueno"],
  screen: 4, screenPos:["ai", "ac", "ad", "mi", "md", "bi", "bc", "bd"],
};
function cleanFiltro(f, list, P) {
  f = f || {};
  const n = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.round(Math.min(b, Math.max(a, v)) * 100) / 100 : d; };
  const pick = (v, all) => all.includes(v) ? v : all[0];
  const filtro = { paint: pick(f.paint, FILTRO.paints), effect: pick(f.effect, FILTRO.effects), frame: pick(f.frame, FILTRO.frames),
    color: HEX.test(String(f.color || "")) ? String(f.color).toLowerCase() : "#8b3fd6", text: String(f.text || "").replace(/\s+/g, " ").trim().slice(0, 32),
    look: pick(f.look, FILTRO.looks), vig: n(f.vig, 0, 1, 0) };   // color look and vignette over the whole picture
  list = Array.isArray(list) ? list : [];
  // the creator's own face paint (paint "propia") is one item of type "pintura": a 1024 px PNG painted over the template
  const own = list.filter(m => m && m.type === "pintura");
  // images on the screen (type "pantalla"): pos = edge or corner (see SCREEN_POS in assets/filtro.js), s = part of the width
  const screen = list.filter(m => m && m.type === "pantalla");
  list = list.filter(m => m && m.type !== "pintura" && m.type !== "pantalla");
  if (screen.length > FILTRO.screen) return { error: `Puedes poner hasta ${FILTRO.screen} imágenes en la pantalla.` };
  if (filtro.paint === "propia" && own.length !== 1) return { error: "Sube tu pintura (el machote pintado)." };
  if (list.length > FILTRO.items) return { error: `Puedes poner hasta ${FILTRO.items} accesorios.` };
  const items = [], ids = new Set(), imgMax = Math.min(FILTRO.items, P.items || 3);
  if (filtro.paint === "propia") {
    const id = String(own[0].id || "");
    if (!/^[a-z0-9]{6,16}$/.test(id)) return { error: "Tu pintura no es válida." };
    ids.add(id); items.push({ id, type: "pintura", w: 1024, h: 1024 });
  }
  for (const m of screen) {
    const id = String(m.id || ""), key = FILTRO.screenKeys.includes(m.key) ? m.key : null, w = Math.round(n(m.w, 1, 8000, 0)), h = Math.round(n(m.h, 1, 8000, 0));
    if (!/^[a-z0-9]{6,16}$/.test(id) || ids.has(id) || (!key && (!w || !h)) || (m.key && !key)) return { error: "Una de tus imágenes de la pantalla no es válida." };
    ids.add(id);
    const it = { id, type: "pantalla", pos: FILTRO.screenPos.includes(m.pos) ? m.pos : "bd", s: n(m.s, 0.05, 1, 0.3) };
    if (key) it.key = key; else { it.w = w; it.h = h; }   // a ready-made one has no file
    const name = String(m.name || "").trim().slice(0, 40); if (name) it.name = name;
    items.push(it);
  }
  for (const m of list) {
    const id = String(m && m.id || "");
    if (!/^[a-z0-9]{6,16}$/.test(id) || ids.has(id) || !["sticker", "image"].includes(m.type)) return { error: "Uno de tus accesorios no es válido." };
    ids.add(id);
    const it = { id, type: m.type, anchor: pick(m.anchor, FILTRO.anchors), x: n(m.x, -20, 20, 0), y: n(m.y, -20, 20, 0), s: n(m.s, 0.5, 40, 6), r: n(m.r, -180, 180, 0) };
    if (m.type === "sticker") { if (!FILTRO.stickers.includes(m.key)) return { error: "Uno de tus accesorios no es válido." }; it.key = m.key; }
    else {
      it.w = Math.round(n(m.w, 1, 8000, 0)); it.h = Math.round(n(m.h, 1, 8000, 0));
      if (!it.w || !it.h) return { error: "Faltan las medidas de una de tus imágenes." };
      const name = String(m.name || "").trim().slice(0, 40); if (name) it.name = name;
    }
    items.push(it);
  }
  if (items.filter(i => i.type === "image").length > imgMax) return { error: `Tu plan ${P.name} permite hasta ${imgMax} imágenes propias por filtro.` };
  if (filtro.paint === "ninguna" && filtro.effect === "ninguno" && filtro.frame === "ninguno" && filtro.look === "ninguno" && !filtro.vig && !items.length) return { error: "Tu filtro está vacío: elige una plantilla o agrégale algo." };
  return { filtro, items };
}
// Coloring page (assets/colorear.js): the image is a line drawing that anyone with the link paints with a finger.
// th = how dark a pixel must be to count as a line (the fill stops there); palette = the colors offered first.
const COLOREAR = { palettes: ["vivos", "pastel", "naturaleza", "piel"], th: [90, 230] };
function cleanColor(c) {
  const th = Math.round(Number(c && c.th));
  return { palette: COLOREAR.palettes.includes(c && c.palette) ? c.palette : "vivos", th: th >= COLOREAR.th[0] && th <= COLOREAR.th[1] ? th : 170 };
}
// Interactive menu for restaurants (assets/menu.js): sections (kind comida | bebida | postre) with dishes (name, price,
// description, tags for the "¿Qué se te antoja?" helper), each with an optional photo (item "foto"); the special ones may
// have a 3D model (item "model", a GLB made with Polycam; cm = its real width, so it sits on the table at its size).
// pages = the restaurant's original menu (PDF pages or pictures, items "pagina"). logo = an item "foto". The image of the
// experience (exp/<slug>/image) is a card drawn by the creator for the dashboard. Files are referenced by item id.
const MENU = {
  cats: 30, dishes: 250, pages: 12, photos: 150, models: { gratis: 1, other: 3 },
  kinds: ["comida", "bebida", "postre"], themes: ["clasico", "oscuro", "claro"],
  tags: ["picante", "vegetariano", "carne", "pollo", "mariscos", "ligero", "abundante", "compartir", "fria", "caliente", "alcohol", "nuevo"],
};
function cleanMenu(mn, list, P) {
  mn = mn || {};
  const str = (v, max) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
  const idOk = v => /^[a-z0-9]{6,16}$/.test(String(v || ""));
  const byId = new Map();
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || !idOk(m.id) || byId.has(m.id) || !["foto", "pagina", "model"].includes(m.type)) return { error: "Uno de tus archivos no es válido." };
    const it = { id: m.id, type: m.type };
    if (m.type !== "model") { it.w = Math.round(Number(m.w)) || 0; it.h = Math.round(Number(m.h)) || 0; if (!(it.w > 0 && it.w <= 8000 && it.h > 0 && it.h <= 8000)) return { error: "Faltan las medidas de una de tus imágenes." }; }
    byId.set(m.id, it);
  }
  const used = new Set();
  const ref = (v, type) => { const it = idOk(v) && byId.get(v); if (!it || it.type !== type) return null; used.add(v); return v; };
  const cats = Array.isArray(mn.cats) ? mn.cats : [];
  if (!cats.length) return { error: "Agrega al menos una sección con un platillo." };
  if (cats.length > MENU.cats) return { error: `Puedes poner hasta ${MENU.cats} secciones.` };
  const out = [], ids = new Set(); let dishes = 0, models = 0;
  const maxModels = P.id === "gratis" ? MENU.models.gratis : MENU.models.other;
  for (const c of cats) {
    const name = str(c && c.name, 60), id = String(c && c.id || "");
    if (!name) return { error: "Una de tus secciones no tiene nombre." };
    if (!idOk(id) || ids.has(id)) return { error: "Una de tus secciones no es válida." };
    ids.add(id);
    const cat = { id, name, kind: MENU.kinds.includes(c.kind) ? c.kind : "comida", dishes: [] };
    for (const d of Array.isArray(c.dishes) ? c.dishes : []) {
      const dn = str(d && d.name, 80), did = String(d && d.id || "");
      if (!dn) return { error: `Un platillo de "${name}" no tiene nombre.` };
      if (!idOk(did) || ids.has(did)) return { error: "Uno de tus platillos no es válido." };
      ids.add(did);
      if (++dishes > MENU.dishes) return { error: `Puedes poner hasta ${MENU.dishes} platillos.` };
      const dish = { id: did, name: dn };
      const price = str(d.price, 24), desc = String(d.desc || "").replace(/\r/g, "").trim().slice(0, 300);
      if (price) dish.price = price;
      if (desc) dish.desc = desc;
      const tags = [...new Set((Array.isArray(d.tags) ? d.tags : []).filter(t => MENU.tags.includes(t)))];
      if (tags.length) dish.tags = tags;
      const photo = ref(d.photo, "foto"); if (photo) dish.photo = photo;
      if (d.special) dish.special = true;
      const model = d.special ? ref(d.model, "model") : null;
      if (model) {
        if (++models > maxModels) return { error: `Tu plan ${P.name} permite ${maxModels === 1 ? "un platillo" : maxModels + " platillos"} en 3D.` };
        dish.model = model; const cm = Math.round(Number(d.cm)); dish.cm = cm >= 5 && cm <= 120 ? cm : 28;
      }
      cat.dishes.push(dish);
    }
    out.push(cat);
  }
  if (!dishes) return { error: "Agrega al menos un platillo." };
  const pages = (Array.isArray(mn.pages) ? mn.pages : []).map(v => ref(v, "pagina")).filter(Boolean).slice(0, MENU.pages);
  const menu = { cats: out, pages, color: HEX.test(String(mn.color || "")) ? String(mn.color).toLowerCase() : "#b8322a",
    theme: MENU.themes.includes(mn.theme) ? mn.theme : "clasico", currency: str(mn.currency, 4) || "$", note: str(mn.note, 200), helper: mn.helper !== false };
  const sub = str(mn.sub, 80); if (sub) menu.sub = sub;
  const nm = str(mn.name, 80); if (nm) menu.name = nm;   // the restaurant's name on the menu (the experience title is apart; old menus use it)
  const logo = ref(mn.logo, "foto"); if (logo) menu.logo = logo;
  const items = [...byId.values()].filter(i => used.has(i.id));
  if (items.filter(i => i.type === "foto").length > MENU.photos) return { error: `Puedes poner hasta ${MENU.photos} fotos.` };
  return { menu, items };
}
// Link page, like Linktree (assets/links.js): a photo, name and short text, a row of social icons and a list of big buttons
// (links or section titles, each with an optional picture), plus "Guardar contacto" (a vCard from /api/vcard/<slug>).
// It is meant for NFC cards: the link never changes, the buttons do. Each tap on a button is counted (table clicks).
// social: [{k, v}] with v = the final href (wa.me, mailto:, tel: or https). Pictures are items "foto" referenced by id.
const LINKS = {
  list: 60, social: 16,
  themes: ["vortice", "noche", "claro", "crema", "degradado", "pastel"], fonts: ["sora", "playfair", "plex", "bebas", "pacifico"],
  btns: ["relleno", "contorno", "sombra", "cristal"], shapes: ["pill", "round", "square"],
  base: { instagram: "https://instagram.com/", tiktok: "https://tiktok.com/@", facebook: "https://facebook.com/", youtube: "https://youtube.com/@", x: "https://x.com/",
    linkedin: "https://linkedin.com/in/", threads: "https://threads.net/@", telegram: "https://t.me/", pinterest: "https://pinterest.com/", twitch: "https://twitch.tv/",
    snapchat: "https://snapchat.com/add/", spotify: null, web: null, whatsapp: null, email: null, phone: null, maps: null },
};
// a link typed by a person: https (also without the scheme), mailto: or tel:
function linkHref(v) {
  v = String(v || "").trim().slice(0, 500);
  if (!v) return "";
  if (/^mailto:/i.test(v)) { const e = normEmail(v.slice(7)); return e ? "mailto:" + e : null; }
  if (/^tel:/i.test(v)) { const d = v.slice(4).replace(/[^\d+]/g, ""); return d.replace(/\D/g, "").length >= 7 ? "tel:" + d : null; }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && /^[^\s/@]+@[^\s/@]+\.[a-z]{2,}$/i.test(v)) return "mailto:" + v.toLowerCase();
  if (!/^https?:\/\//i.test(v)) { if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return null; v = "https://" + v; }
  try { const u = new URL(v); if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null; return u.href; } catch { return null; }
}
const phoneDigits = v => { let d = String(v || "").replace(/\D/g, ""); if (d.length === 10) d = "52" + d; return d.length >= 10 && d.length <= 15 ? d : null; };
function socialHref(k, v) {
  v = String(v || "").trim().slice(0, 300);
  if (!v) return "";
  if (k === "whatsapp") { if (/wa\.me\/|whatsapp\.com/i.test(v)) return linkHref(v); const d = phoneDigits(v); return d ? "https://wa.me/" + d : null; }
  if (k === "phone") { const d = phoneDigits(v.replace(/^tel:/i, "")); return d ? "tel:+" + d : null; }
  if (k === "email") { const e = normEmail(v.replace(/^mailto:/i, "")); return e ? "mailto:" + e : null; }
  const base = LINKS.base[k];
  if (base && !/^https?:/i.test(v) && !v.includes("/")) {   // just the user (juan.perez or @juan.perez)
    const u = v.replace(/^@/, "");
    return /^[A-Za-z0-9._-]{1,60}$/.test(u) ? base + u : null;
  }
  const h = linkHref(v); return h && /^https?:/.test(h) ? h : null;
}
const SOCIAL_NAMES = { web: "sitio web", email: "correo", phone: "teléfono", whatsapp: "WhatsApp (10 dígitos)", maps: "link de Google Maps", x: "usuario de X" };
function cleanLinks(lk, list) {
  lk = lk || {};
  const str = (v, max) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
  const idOk = v => /^[a-z0-9]{6,16}$/.test(String(v || ""));
  const byId = new Map();
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || !idOk(m.id) || byId.has(m.id) || m.type !== "foto") return { error: "Una de tus imágenes no es válida." };
    const it = { id: m.id, type: "foto", w: Math.round(Number(m.w)) || 0, h: Math.round(Number(m.h)) || 0 };
    if (!(it.w > 0 && it.w <= 4000 && it.h > 0 && it.h <= 4000)) return { error: "Faltan las medidas de una de tus imágenes." };
    byId.set(m.id, it);
  }
  const used = new Set();
  const ref = v => { if (!idOk(v) || !byId.has(v)) return null; used.add(v); return v; };
  const social = [], seen = new Set();
  for (const s of Array.isArray(lk.social) ? lk.social : []) {
    const k = String(s && s.k || "");
    if (!(k in LINKS.base) || seen.has(k)) continue;
    const v = socialHref(k, s.v);
    if (v === "") continue;
    if (!v) return { error: `Revisa tu ${SOCIAL_NAMES[k] || "usuario de " + k[0].toUpperCase() + k.slice(1)}.` };
    seen.add(k); social.push({ k, v });
    if (social.length >= LINKS.social) break;
  }
  const out = [], ids = new Set();
  const raw = Array.isArray(lk.list) ? lk.list : [];
  if (raw.length > LINKS.list) return { error: `Puedes poner hasta ${LINKS.list} botones.` };
  for (const b of raw) {
    const id = String(b && b.id || "");
    if (!idOk(id) || ids.has(id)) return { error: "Uno de tus botones no es válido." };
    ids.add(id);
    const t = str(b.t, 80);
    if (b.type === "header") { if (t) out.push(b.off ? { id, type: "header", t, off: true } : { id, type: "header", t }); continue; }
    const url = linkHref(b.url);
    if (!t && !url) continue;
    if (!t) return { error: "Uno de tus botones no tiene texto." };
    if (!url) return { error: `El link del botón “${t}” no es válido.` };
    const it = { id, type: "link", t, url };
    const thumb = ref(b.thumb); if (thumb) it.thumb = thumb;
    if (b.hi) it.hi = true;
    if (b.off) it.off = true;   // hidden for now (kept in the list)
    out.push(it);
  }
  const c = lk.contact || {};
  const contact = { on: !!c.on, org: str(c.org, 80), role: str(c.role, 80), phone: str(c.phone, 24).replace(/[^\d+ ()-]/g, ""), email: normEmail(c.email) || "", web: c.web ? linkHref(c.web) || "" : "" };
  if (contact.on && !contact.phone && !contact.email) return { error: "Para “Guardar contacto” pon al menos tu teléfono o tu correo." };
  if (!out.some(b => b.type === "link" && !b.off) && !social.length && !contact.on) return { error: "Agrega al menos un link o una red social." };
  const links = { bio: String(lk.bio || "").replace(/\r/g, "").trim().slice(0, 240), list: out, social, contact,
    theme: LINKS.themes.includes(lk.theme) ? lk.theme : "vortice", font: LINKS.fonts.includes(lk.font) ? lk.font : "sora",
    btn: LINKS.btns.includes(lk.btn) ? lk.btn : "relleno", shape: LINKS.shapes.includes(lk.shape) ? lk.shape : "pill",
    color: HEX.test(String(lk.color || "")) ? String(lk.color).toLowerCase() : "#8b3fd6", share: lk.share !== false };
  const avatar = ref(lk.avatar); if (avatar) links.avatar = avatar;
  const bg = ref(lk.bg); if (bg) links.bg = bg;
  const nm = str(lk.name, 80); if (nm) links.name = nm;   // the name on the page (the experience title is apart; old pages use it)
  return { links, items: [...byId.values()].filter(i => used.has(i.id)) };
}
// Prize wheel (assets/ruleta.js): 10 spaces, all equally likely. 3 to 10 prizes {id, t}; with fewer than 10, fill = "repetir"
// (the prizes repeat) or "suerte" (the rest is "Suerte para la próxima"). The spin happens on the phone and the prize is kept
// there (a coupon with a code, the date and its days of validity; the business only looks at it). limit = spins per phone: una,
// dia (one a day) or libre. review = an optional link to leave a review, shown apart from the prize (Google does not allow
// prizes for reviews). logo = an item "foto" in the middle of the wheel. Spins and prizes are counted in clicks.
const RULETA = { min: 3, max: 10, fills: ["repetir", "suerte"], limits: ["una", "dia", "libre"], days: [0, 1, 3, 7, 15, 30], themes: ["vortice", "color", "claro"] };
function cleanRuleta(r, list) {
  r = r || {};
  const str = (v, max) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
  const idOk = v => /^[a-z0-9]{6,16}$/.test(String(v || ""));
  const prizes = [], ids = new Set();
  for (const p of Array.isArray(r.prizes) ? r.prizes.slice(0, 40) : []) {
    const t = str(p && p.t, 40);
    if (!t) continue;
    if (!idOk(p.id) || ids.has(p.id)) return { error: "Uno de tus premios no es válido." };
    ids.add(p.id); prizes.push({ id: p.id, t });
  }
  if (prizes.length < RULETA.min) return { error: `Escribe al menos ${RULETA.min} premios.` };
  if (prizes.length > RULETA.max) return { error: `Puedes poner hasta ${RULETA.max} premios.` };
  const ruleta = { prizes, fill: RULETA.fills.includes(r.fill) ? r.fill : "repetir", limit: RULETA.limits.includes(r.limit) ? r.limit : "una",
    days: RULETA.days.includes(Number(r.days)) ? Number(r.days) : 0, theme: RULETA.themes.includes(r.theme) ? r.theme : "vortice",
    color: HEX.test(String(r.color || "")) ? String(r.color).toLowerCase() : "#8b3fd6", color2: HEX.test(String(r.color2 || "")) ? String(r.color2).toLowerCase() : "#ffbe55" };
  const sub = String(r.sub || "").replace(/\r/g, "").trim().slice(0, 160); if (sub) ruleta.sub = sub;
  const cond = String(r.cond || "").replace(/\r/g, "").trim().slice(0, 200); if (cond) ruleta.cond = cond;
  if (r.review && String(r.review.url || "").trim()) {
    const url = linkHref(r.review.url);
    if (!url || !/^https?:/.test(url)) return { error: "El link para dejar tu reseña no es válido." };
    ruleta.review = { url, t: str(r.review.t, 40) || "Déjanos tu reseña" };
  }
  const nm = str(r.name, 80); if (nm) ruleta.name = nm;   // the business on the wheel and the coupon (the experience title is apart; old wheels use it)
  let items = [];
  if (r.logo) {
    const m = (Array.isArray(list) ? list : []).find(i => i && i.id === r.logo);
    if (!m || !idOk(m.id) || m.type !== "foto") return { error: "Tu logo no es válido." };
    const it = { id: m.id, type: "foto", w: Math.round(Number(m.w)) || 0, h: Math.round(Number(m.h)) || 0 };
    if (!(it.w > 0 && it.w <= 4000 && it.h > 0 && it.h <= 4000)) return { error: "Faltan las medidas de tu logo." };
    items = [it]; ruleta.logo = it.id;
  }
  return { ruleta, items };
}
// "Dispara y gana" (assets/dispara.js): a 360° game with the camera. objs = the characters {id, role: malo (1-4) | bueno (0-3) |
// dorado (0-1), key (a drawing of the game) | img (an item "foto")}; time in seconds and speed. prize (optional) = a coupon like the
// wheel's when the score reaches min (limit = una | dia | libre per phone); link (optional) = a button with a message at the end.
// Plays, prizes, saves, shares and link taps are counted in clicks.
const DISPARA = { times: [20, 30, 45, 60], speeds: ["lento", "normal", "rapido"], roles: { malo: 4, bueno: 3, dorado: 1 },
  keys: ["monstruo", "virus", "asteroide", "ovni", "bomba", "carbon", "fantasma", "calaverita", "regalo", "planeta", "cempasuchil", "corazon", "esfera", "copo", "estrella", "moneda"],
  limits: ["una", "dia", "libre"], days: [0, 1, 3, 7, 15, 30] };
function cleanDispara(d, list) {
  d = d || {};
  const str = (v, max) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
  const idOk = v => /^[a-z0-9]{6,16}$/.test(String(v || ""));
  const files = new Map((Array.isArray(list) ? list : []).filter(i => i && idOk(i.id) && i.type === "foto").map(i => [i.id, i]));
  const objs = [], n = { malo: 0, bueno: 0, dorado: 0 }, items = [];
  for (const ob of Array.isArray(d.objs) ? d.objs.slice(0, 12) : []) {
    if (!ob || !Object.hasOwn(DISPARA.roles, ob.role) || !idOk(ob.id)) return { error: "Uno de tus personajes no es válido." };
    if (++n[ob.role] > DISPARA.roles[ob.role]) return { error: ob.role === "malo" ? "Puedes poner hasta 4 malos." : ob.role === "bueno" ? "Puedes poner hasta 3 buenos." : "Solo puede haber un dorado." };
    if (ob.key) { if (!DISPARA.keys.includes(ob.key)) return { error: "Uno de tus personajes no es válido." }; objs.push({ id: ob.id, role: ob.role, key: ob.key }); continue; }
    const m = files.get(ob.img);
    if (!m) return { error: "Falta la imagen de uno de tus personajes. Vuelve a subirla." };
    const it = { id: m.id, type: "foto", w: Math.round(Number(m.w)) || 0, h: Math.round(Number(m.h)) || 0 };
    if (!(it.w > 0 && it.w <= 4000 && it.h > 0 && it.h <= 4000)) return { error: "Faltan las medidas de una de tus imágenes." };
    if (!items.some(i => i.id === it.id)) items.push(it);
    objs.push({ id: ob.id, role: ob.role, img: it.id });
  }
  if (!n.malo) return { error: "Agrega al menos un malo (a quien se le dispara)." };
  const dispara = { objs, time: DISPARA.times.includes(Number(d.time)) ? Number(d.time) : 30, speed: DISPARA.speeds.includes(d.speed) ? d.speed : "normal",
    color: HEX.test(String(d.color || "")) ? String(d.color).toLowerCase() : "#8b3fd6" };
  const nm = str(d.name, 80); if (nm) dispara.name = nm;   // the business or the game on its screens and the coupon (the experience title is apart)
  const sub = String(d.sub || "").replace(/\r/g, "").trim().slice(0, 160); if (sub) dispara.sub = sub;
  if (d.prize) {
    const t = str(d.prize.t, 40), min = Math.round(Number(d.prize.min));
    if (!t) return { error: "Escribe el premio o apaga esa opción." };
    if (!(min >= 10 && min <= 100000)) return { error: "El puntaje para ganar debe ser de 10 a 100,000." };
    dispara.prize = { t, min, days: DISPARA.days.includes(Number(d.prize.days)) ? Number(d.prize.days) : 7, limit: DISPARA.limits.includes(d.prize.limit) ? d.prize.limit : "una" };
    const cond = String(d.prize.cond || "").replace(/\r/g, "").trim().slice(0, 200); if (cond) dispara.prize.cond = cond;
  }
  if (d.link && String(d.link.url || "").trim()) {
    const url = linkHref(d.link.url);
    if (!url || !/^https?:/.test(url)) return { error: "El link del final no es válido." };
    dispara.link = { url, t: str(d.link.t, 40) || "Visítanos" };
    const msg = String(d.link.msg || "").replace(/\r/g, "").trim().slice(0, 140); if (msg) dispara.link.msg = msg;
  }
  return { dispara, items };
}
// Memorama (assets/memorama.js): find the pairs before the time runs out. mode = iguales (the same card twice) | parejas (two
// cards that go together); pairs = 3 to 10 {id, a: side, b?: side} (b only with parejas), side = {t} (text, up to 40) |
// {key} (a picture of assets/filtros/) | {img} (an item "foto"). Plays, wins and shares are counted in clicks.
const MEMORAMA = { min: 3, max: 10, times: [30, 45, 60, 90], modes: ["iguales", "parejas"],
  keys: ["particula-calaverita", "particula-cempasuchil", "particula-petalo", "corona-flores", "sombrero-copa", "lentes-catrina", "lentes-catrin", "bigote-catrin", "mono-catrin", "papel-picado",
    "gorro-santa", "diadema-reno", "nariz-reno", "lentes-navidad", "particula-copo", "particula-esfera", "luces-navidad", "esquina-pino",
    "gorro-fiesta", "lentes-fiesta", "particula-serpentina", "particula-estrella", "guirnalda-banderines", "esquina-globos",
    "orejas-gato", "nariz-gato", "lentes-gato", "particula-huella", "lentes-corazon", "diadema-corazones", "corazon-mejilla", "particula-corazon", "lentes-vortice"] };
function cleanMemorama(d, list) {
  d = d || {};
  const idOk = v => /^[a-z0-9]{6,16}$/.test(String(v || ""));
  const files = new Map((Array.isArray(list) ? list : []).filter(i => i && idOk(i.id) && i.type === "foto").map(i => [i.id, i]));
  const mode = MEMORAMA.modes.includes(d.mode) ? d.mode : "iguales", items = [];
  const side = (v, n) => {
    if (v && v.key) return MEMORAMA.keys.includes(v.key) ? { key: v.key } : { error: `Una de las imágenes del par ${n} no es válida.` };
    if (v && v.img) {
      const m = files.get(v.img); if (!m) return { error: `Falta la imagen del par ${n}. Vuelve a subirla.` };
      const it = { id: m.id, type: "foto", w: Math.round(Number(m.w)) || 0, h: Math.round(Number(m.h)) || 0 };
      if (!(it.w > 0 && it.w <= 4000 && it.h > 0 && it.h <= 4000)) return { error: "Faltan las medidas de una de tus imágenes." };
      if (!items.some(i => i.id === it.id)) items.push(it);
      return { img: it.id };
    }
    const t = String(v && v.t || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return t ? { t } : { error: `Llena las cartas del par ${n}.` };
  };
  const src = Array.isArray(d.pairs) ? d.pairs : [];
  if (src.length < MEMORAMA.min) return { error: `Pon al menos ${MEMORAMA.min} pares.` };
  if (src.length > MEMORAMA.max) return { error: `Puedes poner hasta ${MEMORAMA.max} pares.` };
  const pairs = [], ids = new Set();
  for (const [k, p] of src.entries()) {
    if (!p || !idOk(p.id) || ids.has(p.id)) return { error: "Uno de tus pares no es válido." };
    ids.add(p.id);
    const a = side(p.a, k + 1); if (a.error) return a;
    const pr = { id: p.id, a };
    if (mode === "parejas") { const b = side(p.b, k + 1); if (b.error) return b; pr.b = b; }
    pairs.push(pr);
  }
  const memorama = { mode, pairs, time: MEMORAMA.times.includes(Number(d.time)) ? Number(d.time) : 30, color: HEX.test(String(d.color || "")) ? String(d.color).toLowerCase() : "#8b3fd6" };
  const nm = String(d.name || "").replace(/\s+/g, " ").trim().slice(0, 80); if (nm) memorama.name = nm;   // on its screens (the experience title is apart)
  const sub = String(d.sub || "").replace(/\r/g, "").trim().slice(0, 160); if (sub) memorama.sub = sub;
  return { memorama, items };
}
// Sopa de letras (assets/sopa.js): the grid is made on the phone each game. mode = lista (the words are shown) | pistas
// (a clue for each word); level = facil | normal | dificil; time in seconds (0 = no limit); words = 3 to 12 {w (as typed,
// up to 20), h (the clue, up to 70)} of 2 to 12 letters once accents and spaces are taken out, 90 letters in all at most
// (the grid must fit on a phone). Plays, wins and shares are counted in clicks.
const SOPA = { min: 3, max: 12, letters: 12, total: 90, times: [0, 60, 90, 120, 180], modes: ["lista", "pistas"], levels: ["facil", "normal", "dificil"] };
const sopaNorm = s => String(s || "").toUpperCase().replace(/Ñ/g, "\u0001").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0001/g, "Ñ").replace(/[^A-ZÑ]/g, "");
function cleanSopa(d) {
  d = d || {};
  const mode = SOPA.modes.includes(d.mode) ? d.mode : "lista", src = Array.isArray(d.words) ? d.words : [];
  if (src.length < SOPA.min) return { error: `Pon al menos ${SOPA.min} palabras.` };
  if (src.length > SOPA.max) return { error: `Puedes poner hasta ${SOPA.max} palabras.` };
  const words = [], seen = new Set(); let total = 0;
  for (const [k, x] of src.entries()) {
    const w = String(x && x.w || "").replace(/\s+/g, " ").trim().slice(0, 20), n = sopaNorm(w);
    if (n.length < 2) return { error: `La palabra ${k + 1} necesita al menos 2 letras.` };
    if (n.length > SOPA.letters) return { error: `La palabra ${k + 1} tiene más de ${SOPA.letters} letras.` };
    if (seen.has(n)) return { error: `La palabra ${k + 1} está repetida.` };
    seen.add(n); total += n.length;
    const it = { w };
    if (mode === "pistas") { const h = String(x.h || "").replace(/\s+/g, " ").trim().slice(0, 70); if (!h) return { error: `Escribe la pista de la palabra ${k + 1}.` }; it.h = h; }
    words.push(it);
  }
  if (total > SOPA.total) return { error: `Son demasiadas letras (máximo ${SOPA.total}): quita una palabra o usa palabras más cortas.` };
  const sopa = { mode, words, level: SOPA.levels.includes(d.level) ? d.level : "normal", time: SOPA.times.includes(Number(d.time)) ? Number(d.time) : 90, color: HEX.test(String(d.color || "")) ? String(d.color).toLowerCase() : "#8b3fd6" };
  const nm = String(d.name || "").replace(/\s+/g, " ").trim().slice(0, 80); if (nm) sopa.name = nm;   // on its screens (the experience title is apart)
  const sub = String(d.sub || "").replace(/\r/g, "").trim().slice(0, 160); if (sub) sopa.sub = sub;
  return { sopa };
}
// Rompecabezas (assets/rompecabezas.js): a jigsaw of the experience's image (exp/<slug>/image, its size in img), cut on
// the phone each game. level = facil (6 pieces) | normal (12) | dificil (20) | experto (35); time in seconds (0 = no limit);
// info = an optional "¿Sabías que…?" shown with the whole picture at the end. Plays, wins and shares are counted in clicks.
const PUZZLE = { times: [0, 60, 120, 180, 300], levels: ["facil", "normal", "dificil", "experto"] };
function cleanPuzzle(d) {
  d = d || {};
  const p = { level: PUZZLE.levels.includes(d.level) ? d.level : "normal", time: PUZZLE.times.includes(Number(d.time)) ? Number(d.time) : 0, color: HEX.test(String(d.color || "")) ? String(d.color).toLowerCase() : "#8b3fd6" };
  const nm = String(d.name || "").replace(/\s+/g, " ").trim().slice(0, 80); if (nm) p.name = nm;   // on its screens (the experience title is apart)
  const sub = String(d.sub || "").replace(/\r/g, "").trim().slice(0, 160); if (sub) p.sub = sub;
  const info = String(d.info || "").replace(/\r/g, "").trim().slice(0, 300); if (info) p.info = info;
  return { rompecabezas: p };
}
// the contact card ("Guardar contacto"), with the profile picture when it is a JPEG
async function vcard(env, row, request) {
  const d = JSON.parse(row.data || "{}"), lk = d.links || {}, c = lk.contact || {};
  const v = s => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${v(lk.name || row.title)}`, `N:;${v(lk.name || row.title)};;;`];
  if (c.org) lines.push(`ORG:${v(c.org)}`);
  if (c.role) lines.push(`TITLE:${v(c.role)}`);
  if (c.phone) { const p = c.phone.replace(/[^\d+]/g, ""); lines.push(`TEL;TYPE=CELL:${/^\d{10}$/.test(p) ? "+52" + p : p}`); }   // a Mexican number without its country code
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${c.email}`);
  if (c.web) lines.push(`URL:${c.web}`);
  lines.push(`URL:${expUrl(row.slug, request, env)}`);
  for (const s of lk.social || []) if (/^https:/.test(s.v) && !["web", "whatsapp", "maps"].includes(s.k)) lines.push(`X-SOCIALPROFILE;TYPE=${s.k}:${s.v}`);
  if (lk.bio) lines.push(`NOTE:${v(lk.bio)}`);
  const av = lk.avatar && (d.items || []).find(i => i.id === lk.avatar);
  if (av && av.file) {
    const o = await env.MEDIA.get(`exp/${row.slug}/${av.file}`);
    if (o && o.httpMetadata && o.httpMetadata.contentType === "image/jpeg" && o.size < 200e3) lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${b64(await o.arrayBuffer())}`);
    else if (o) await o.body.cancel();
  }
  lines.push("END:VCARD");
  // vCard lines are folded at 75 characters
  return lines.map(l => l.length <= 75 ? l : l.match(/.{1,74}/gu).join("\r\n ")).join("\r\n") + "\r\n";
}
function cleanMeta(m, P) {
  const title = String(m.title || "").trim().slice(0, 80);
  if (!title) return { error: "Escribe un título." };
  const buttons = cleanButtons(m.buttons);
  if (buttons.error) return buttons;
  if (m.kind === "filtro") {
    const f = cleanFiltro(m.filtro, m.items, P);
    return f.error ? f : { kind: "filtro", title, filtro: f.filtro, items: f.items, buttons: {} };
  }
  if (m.kind === "menu") {
    const mn = cleanMenu(m.menu, m.items, P);
    return mn.error ? mn : { kind: "menu", title, menu: mn.menu, items: mn.items, buttons };
  }
  if (m.kind === "links") {
    const lk = cleanLinks(m.links, m.items);
    return lk.error ? lk : { kind: "links", title, links: lk.links, items: lk.items, buttons: {} };
  }
  if (m.kind === "ruleta") {
    const rl = cleanRuleta(m.ruleta, m.items);
    return rl.error ? rl : { kind: "ruleta", title, ruleta: rl.ruleta, items: rl.items, buttons: {} };
  }
  if (m.kind === "memorama") {
    const mm = cleanMemorama(m.memorama, m.items);
    return mm.error ? mm : { kind: "memorama", title, memorama: mm.memorama, items: mm.items, buttons: {} };
  }
  if (m.kind === "sopa") {
    const sp = cleanSopa(m.sopa);
    return sp.error ? sp : { kind: "sopa", title, sopa: sp.sopa, items: [], buttons: {} };
  }
  if (m.kind === "dispara") {
    const dp = cleanDispara(m.dispara, m.items);
    return dp.error ? dp : { kind: "dispara", title, dispara: dp.dispara, items: dp.items, buttons: {} };
  }
  if (m.kind === "trivia") {
    const trivia = cleanTrivia(m.trivia);
    return trivia.error ? trivia : { kind: "trivia", title, trivia, items: [], buttons };
  }
  const num = (v, a, b) => { v = Number(v); return Number.isFinite(v) && v >= a && v <= b ? Math.round(v) : null; };
  const img = { w: num(m.img && m.img.w, 50, 8000), h: num(m.img && m.img.h, 50, 8000) };
  if (!img.w || !img.h) return { error: "Faltan las medidas de la imagen." };
  if (m.kind === "colorear") return { kind: "colorear", title, img, color: cleanColor(m.color), items: [], buttons };
  if (m.kind === "rompecabezas") return { kind: "rompecabezas", title, img, rompecabezas: cleanPuzzle(m.rompecabezas).rompecabezas, items: [], buttons: {} };
  const ci = cleanItems(m.items, P);
  if (ci.error) return ci;
  // on the floor or a table (img = the picture of the scene for Mi cuenta): 3D, images and texts, one scene, no links
  if (m.kind === "superficie") {
    if (ci.items.some(i => i.type === "video")) return { error: "La realidad aumentada en superficie no lleva videos: usa objetos 3D, imágenes y textos." };
    if (!ci.items.some(i => i.type === "model")) return { error: "Agrega al menos un objeto 3D." };
    const sf = { kind: "superficie", title, img, items: ci.items.map(i => { delete i.link; i.scene = 0; return i; }), buttons };
    const sp = cleanSparks(m.sparks); if (sp) sf.sparks = sp;
    return sf;
  }
  const items = ci.items, scenes = Math.min(ITEM_LIMITS.scenes, Math.max(1, num(m.scenes, 1, ITEM_LIMITS.scenes) || 1, ...items.map(i => i.scene + 1)));
  const place = m.place === "pared" ? "pared" : "mesa";   // how the editor shows the image (on a table or on a wall)
  const out = { title, img, place, scenes, items, buttons };
  const sp = cleanSparks(m.sparks); if (sp) out.sparks = sp;
  return out;
}
function cleanButtons(b) {
  const buttons = {};
  for (const k of BUTTONS) {
    let v = String((b && b[k]) || "").trim().slice(0, 300);
    if (!v) continue;
    if (k === "whatsapp") { v = v.replace(/\D/g, ""); if (v.length === 10) v = "52" + v; /* Mexican number without country code */ if (v.length < 10) return { error: "El número de WhatsApp no es válido." }; }
    else if (SOCIAL_BASE[k] && !/^https?:/i.test(v) && !v.includes("/")) {
      const u = v.replace(/^@/, "");
      if (!/^[A-Za-z0-9._-]{1,60}$/.test(u)) return { error: `El usuario de ${LABELS[k]} no es válido (sin espacios).` };
      v = SOCIAL_BASE[k] + u;
    }
    else { if (!/^https?:\/\//i.test(v)) v = "https://" + v; try { const u = new URL(v); if (!/^https?:$/.test(u.protocol)) throw 0; v = u.href; } catch { return { error: `El enlace de ${LABELS[k]} no es válido.` }; } }
    buttons[k] = v;
  }
  return buttons;
}

// ---------- helpers ----------
let schemaReady = false;
async function schema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS experiences (${EXP_COLS})`),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS codes (email TEXT PRIMARY KEY, hash TEXT, expires INTEGER, tries INTEGER DEFAULT 0)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS ratelimit (k TEXT PRIMARY KEY, n INTEGER, reset INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT, pass TEXT, verified INTEGER DEFAULT 0, created INTEGER, plan TEXT DEFAULT 'gratis', plan_until INTEGER, plan_note TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER, created INTEGER)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS otp (email TEXT NOT NULL, purpose TEXT NOT NULL, hash TEXT, expires INTEGER, tries INTEGER DEFAULT 0, PRIMARY KEY (email, purpose))"),
    // courtesy codes made in /admin/: a plan for N months, usable max_uses times (once per account)
    env.DB.prepare("CREATE TABLE IF NOT EXISTS coupons (code TEXT PRIMARY KEY, plan TEXT NOT NULL, months INTEGER NOT NULL, max_uses INTEGER NOT NULL, uses INTEGER DEFAULT 0, expires INTEGER, note TEXT, active INTEGER DEFAULT 1, created INTEGER, who TEXT DEFAULT 'todos')"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS redemptions (code TEXT NOT NULL, user_id INTEGER NOT NULL, at INTEGER, PRIMARY KEY (code, user_id))"),
    // one row per day (Mexico time) for the admin charts
    // one row per Stripe invoice paid by a referred customer: 10% for the referrer (pendiente → disponible → abonada (saldo a favor) | pagada (by hand) | cancelada)
    env.DB.prepare("CREATE TABLE IF NOT EXISTS commissions (id TEXT PRIMARY KEY, referrer_id INTEGER NOT NULL, user_id INTEGER NOT NULL, invoice TEXT, plan TEXT, amount INTEGER, commission INTEGER, status TEXT, created INTEGER, available_at INTEGER, paid_at INTEGER, note TEXT, kind TEXT DEFAULT 'ref')"),
    // taps on each button of a link page (assets/links.js); id = the button's id or the social network
    env.DB.prepare("CREATE TABLE IF NOT EXISTS clicks (slug TEXT NOT NULL, id TEXT NOT NULL, n INTEGER DEFAULT 0, PRIMARY KEY (slug, id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS stats (day TEXT PRIMARY KEY, views INTEGER DEFAULT 0, signups INTEGER DEFAULT 0, publishes INTEGER DEFAULT 0, contacts INTEGER DEFAULT 0)"),
  ]);
  await migrate(env);
  schemaReady = true;
}
const EXP_COLS = "slug TEXT PRIMARY KEY, email TEXT NOT NULL, title TEXT, data TEXT, created INTEGER, updated INTEGER, expires INTEGER, views INTEGER DEFAULT 0, paused INTEGER DEFAULT 0";
// Tables from before the plans: experiences had email UNIQUE (one per account) and users had no plan.
// Production and the preview share this database: every change here has to keep the other version working.
async function migrate(env) {
  const { results } = await env.DB.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name IN ('experiences', 'users', 'coupons', 'commissions')").all();
  const sql = Object.fromEntries(results.map(r => [r.name, r.sql || ""]));
  const steps = [];
  if (!/\bplan_until\b/.test(sql.users)) steps.push(
    env.DB.prepare("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'gratis'"),
    env.DB.prepare("ALTER TABLE users ADD COLUMN plan_until INTEGER"),
    env.DB.prepare("ALTER TABLE users ADD COLUMN plan_note TEXT"));
  if (/email TEXT UNIQUE/i.test(sql.experiences)) steps.push(   // SQLite cannot drop a UNIQUE: copy into a new table
    env.DB.prepare("DROP TABLE IF EXISTS experiences_new"),
    env.DB.prepare(`CREATE TABLE experiences_new (${EXP_COLS})`),
    env.DB.prepare("INSERT INTO experiences_new (slug, email, title, data, created, updated, expires, views) SELECT slug, email, title, data, created, updated, expires, views FROM experiences"),
    env.DB.prepare("DROP TABLE experiences"),
    env.DB.prepare("ALTER TABLE experiences_new RENAME TO experiences"));
  if (steps.length) { try { await env.DB.batch(steps); } catch (e) { console.error("migración", e); /* another instance migrated first */ } }
  if (!/\bref_code\b/.test(sql.users)) {   // referrals: own code, and who brought this account
    try { await env.DB.batch(["ref_code TEXT", "ref_by INTEGER"].map(c => env.DB.prepare(`ALTER TABLE users ADD COLUMN ${c}`))); }
    catch (e) { console.error("migración referidos", e); }
  }
  if (!/\bowner_id\b/.test(sql.users)) {   // Empresarial teams: member → owner, experiences handed to it, extras, temporary password
    try { await env.DB.batch(["owner_id INTEGER", "quota INTEGER", "extra_exp INTEGER DEFAULT 0", "temp_pw INTEGER DEFAULT 0"].map(c => env.DB.prepare(`ALTER TABLE users ADD COLUMN ${c}`))); }
    catch (e) { console.error("migración equipos", e); }
  }
  if (!/\bseller\b/.test(sql.users)) {   // sellers: their role and commissions, and where to send their money
    try { await env.DB.batch(["seller TEXT", "payout TEXT"].map(c => env.DB.prepare(`ALTER TABLE users ADD COLUMN ${c}`))); }
    catch (e) { console.error("migración vendedores", e); }
  }
  if (sql.commissions && !/\bkind\b/.test(sql.commissions)) {   // "ref" = Recomienda y gana · "seller" = a seller's first payment
    try { await env.DB.prepare("ALTER TABLE commissions ADD COLUMN kind TEXT DEFAULT 'ref'").run(); }
    catch (e) { console.error("migración comisiones", e); }
  }
  if (sql.coupons && !/\bwho\b/.test(sql.coupons)) {   // coupons: for anyone ("todos") or only for accounts that already have its plan ("plan")
    try { await env.DB.prepare("ALTER TABLE coupons ADD COLUMN who TEXT DEFAULT 'todos'").run(); }
    catch (e) { console.error("migración cupones", e); }
  }
  if (!/\bstripe_mode\b/.test(sql.users)) {   // Stripe subscription of the account (test or live keys: never mix their ids)
    try { await env.DB.batch(["stripe_customer", "stripe_sub", "stripe_status", "stripe_mode"].map(c => env.DB.prepare(`ALTER TABLE users ADD COLUMN ${c} TEXT`))); }
    catch (e) { console.error("migración stripe", e); }
  }
  await env.DB.batch([
    env.DB.prepare("CREATE INDEX IF NOT EXISTS experiences_email ON experiences (email)"),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_ref_code ON users (ref_code)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS commissions_referrer ON commissions (referrer_id)"),
  ]);
}
async function limit(env, key, max, windowMs) {
  const now = Date.now();
  const row = await env.DB.prepare("SELECT n, reset FROM ratelimit WHERE k = ?").bind(key).first();
  if (!row || row.reset < now) { await env.DB.prepare("INSERT INTO ratelimit (k, n, reset) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = 1, reset = excluded.reset").bind(key, now + windowMs).run(); return true; }
  if (row.n >= max) return false;
  await env.DB.prepare("UPDATE ratelimit SET n = n + 1 WHERE k = ?").bind(key).run();
  return true;
}
const normEmail = e => { e = String(e || "").trim().toLowerCase(); return EMAIL.test(e) ? e : null; };
const enc = new TextEncoder();
function secret(env) { if (!env.SESSION_SECRET) throw new Error("Falta SESSION_SECRET"); return env.SESSION_SECRET; }
async function hmac(env, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret(env)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
const hashCode = (env, email, code) => hmac(env, `code:${email}:${code}`);

// ---------- accounts: passwords, sessions, one-time codes ----------
// PBKDF2-SHA256. 16,000 iterations ≈ 8 ms in a Worker (the free plan allows ~10 ms of CPU per request).
// The count is stored with each hash, so it can be raised later (paid plan) and old hashes keep working.
const PBKDF2_ITER = 16000;
async function pbkdf2(pw, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}
async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return ["pbkdf2", PBKDF2_ITER, b64(salt), b64(await pbkdf2(pw, salt, PBKDF2_ITER))].join("$");
}
async function verifyPassword(pw, stored) {
  const [kind, it, s, h] = String(stored || "").split("$");
  if (kind !== "pbkdf2" || !h) return false;
  const got = b64(await pbkdf2(pw, Uint8Array.from(atob(s), c => c.charCodeAt(0)), Number(it)));
  let diff = got.length ^ h.length;
  for (let i = 0; i < Math.min(got.length, h.length); i++) diff |= got.charCodeAt(i) ^ h.charCodeAt(i);
  return diff === 0;
}
async function sha256hex(s) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");
}
const bearer = request => (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
// sessions: random token for the browser, only its hash in the database
async function sessionFor(env, request, user) {
  const raw = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires, created) VALUES (?, ?, ?, ?)")
    .bind(await sha256hex(raw), user.id, Date.now() + LIMITS.sessionDays * 864e5, Date.now()).run();
  return { token: raw, ...(await account(env, request, user)) };
}
async function auth(request, env) {
  const t = bearer(request);
  if (!t) return null;
  const row = await env.DB.prepare(`SELECT u.id, u.email, u.name, u.verified, u.plan, u.plan_until, u.plan_note, u.stripe_customer, u.stripe_sub, u.stripe_status, u.stripe_mode,
      u.owner_id, u.quota, u.extra_exp, u.temp_pw, u.ref_code, u.ref_by, u.seller, u.payout, o.plan AS o_plan, o.plan_until AS o_until, o.name AS o_name, o.email AS o_email, s.expires
    FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN users o ON o.id = u.owner_id WHERE s.token = ?`).bind(await sha256hex(t)).first();
  return row && row.expires > Date.now() && row.verified ? row : null;
}
async function account(env, request, user) {
  const { results } = await env.DB.prepare("SELECT * FROM experiences WHERE email = ? AND expires > ? ORDER BY paused, created DESC").bind(user.email, Date.now()).all();
  const plan = planOf(user), lim = await limitOf(env, user, plan);
  const team = plan.member ? { role: "member", owner: plan.owner } : plan.seats ? { role: "owner", seats: plan.seats, total: plan.exp, mine: lim } : undefined;
  return { user: { name: user.name, email: user.email }, experiences: results.map(r => ownerExp(r, request, env)), plan, limit: lim, team,
    referral: { eligible: REF.plans.includes(plan.id) && !plan.member, discount: !!user.ref_by && !user.stripe_sub ? REF.discount : 0 },
    tempPassword: !!user.temp_pw || undefined, admin: isAdmin(env, user) || undefined, seller: !!(sellerOf(user) && sellerOf(user).active) || undefined, billing: billingInfo(env, user) };
}

// ---------- sellers' bank account ----------
function clabeOk(c) {
  if (!/^\d{18}$/.test(c)) return false;
  const w = [3, 7, 1]; let s = 0; for (let i = 0; i < 17; i++) s += (Number(c[i]) * w[i % 3]) % 10;
  return (10 - (s % 10)) % 10 === Number(c[17]);
}
const CLABE_BANKS = { "002": "Banamex", "012": "BBVA", "014": "Santander", "021": "HSBC", "030": "Bajío", "036": "Inbursa", "044": "Scotiabank", "058": "Banregio", "072": "Banorte", "127": "Azteca", "137": "BanCoppel", "638": "Nu", "646": "STP", "722": "Mercado Pago", "728": "Spin by OXXO" };

// ---------- Recomienda y gana ----------
// A code from the name (CESAR-7K2) — readable, unique.
async function newRefCode(env, user) {
  const base = String(user.name || user.email).normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 8) || "VVR";
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 6; i++) {
    const code = base + "-" + [...crypto.getRandomValues(new Uint8Array(3))].map(x => A[x % A.length]).join("");
    const r = await env.DB.prepare("UPDATE users SET ref_code = ? WHERE id = ? AND ref_code IS NULL AND NOT EXISTS (SELECT 1 FROM users WHERE ref_code = ?)").bind(code, user.id, code).run();
    if (r.meta.changes) return code;
    const cur = await env.DB.prepare("SELECT ref_code FROM users WHERE id = ?").bind(user.id).first(); if (cur && cur.ref_code) return cur.ref_code;
  }
  throw new Error("No se pudo crear el código");
}
// The invited customer's discount: a Stripe coupon, 10% on the first payment (monthly or yearly)
let refCouponReady = {};
async function stripeRefCoupon(env) {
  const mode = stripeMode(env); if (refCouponReady[mode]) return REF.coupon;
  try { await stripe(env, "GET", `coupons/${REF.coupon}`); }
  catch (e) { if (e.code !== "resource_missing") throw e; await stripe(env, "POST", "coupons", { id: REF.coupon, percent_off: REF.discount, duration: "once", name: "Invitado: 10% en el primer pago" }); }
  refCouponReady[mode] = true; return REF.coupon;
}
// "Recomienda y gana" pays as credit: every available commission (30 days after the payment) goes to the referrer's Stripe
// customer balance as a negative balance transaction, so Stripe takes it off their next invoices (status "abonada").
// Only referrers with a Stripe customer in the current mode; the rest stay "disponible" for a manual payout in /admin/.
// The idempotency key (the commission ids) makes a retry after a failure never credit twice.
async function creditCommissions(env) {
  if (!env.STRIPE_SECRET_KEY) return { credited: 0, amount: 0 };
  const { results } = await env.DB.prepare(`SELECT c.id, c.referrer_id, c.commission, u.stripe_customer FROM commissions c JOIN users u ON u.id = c.referrer_id
    WHERE c.status = 'disponible' AND c.commission > 0 AND COALESCE(c.kind, 'ref') = 'ref' AND u.stripe_customer IS NOT NULL AND u.stripe_mode = ? ORDER BY c.created LIMIT 1000`).bind(stripeMode(env)).all();
  const by = {};
  for (const r of results) { const x = by[r.referrer_id] ||= { cus: r.stripe_customer, ids: [], total: 0 }; if (x.ids.length < 80) { x.ids.push(r.id); x.total += r.commission; } }
  let credited = 0, amount = 0;
  for (const [rid, x] of Object.entries(by)) {
    try {
      const ids = x.ids.sort(), key = "vvr-ref-" + (await sha256hex(ids.join(","))).slice(0, 40);
      const t = await stripe(env, "POST", `customers/${x.cus}/balance_transactions`, { amount: -x.total, currency: "mxn", description: `Recomienda y gana: ${ids.length === 1 ? "1 comisión" : ids.length + " comisiones"} de Vórtice VR`, metadata: { app: "vvr", referrer: rid } }, key);
      await env.DB.prepare(`UPDATE commissions SET status = 'abonada', paid_at = ?, note = ? WHERE id IN (${ids.map(() => "?").join(",")})`).bind(Date.now(), "Saldo a favor " + t.id, ...ids).run();
      credited += ids.length; amount += x.total;
    } catch (e) { console.error("credit", rid, e.message); }
  }
  return { credited, amount: amount / 100 };
}
// invoice.paid: 10% of what the referred customer actually paid, if the referrer is on Pro or Premium right now
async function commissionFor(env, invoiceId) {
  const inv = await stripe(env, "GET", `invoices/${invoiceId}`);   // never trust the event's copy
  if (inv.status !== "paid" || !(inv.amount_paid > 0) || inv.currency !== "mxn") return;
  const user = await env.DB.prepare("SELECT * FROM users WHERE stripe_customer = ?").bind(inv.customer).first();
  if (!user || !user.ref_by) return;
  const ref = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.ref_by).first();
  const P = ref && planOf(ref);
  const line = inv.lines && inv.lines.data && inv.lines.data[0], lk = line && line.price && line.price.lookup_key;
  const K = stripeKeys().find(k => k.key === lk) || {}, plan = K.plan || user.plan;
  const S = sellerOf(ref);
  if (S) {   // a seller: only the customer's first payment, the amount set for that plan and period
    if (!S.active || inv.billing_reason !== "subscription_create") return;
    if (await env.DB.prepare("SELECT 1 FROM commissions WHERE user_id = ? AND kind = 'seller' LIMIT 1").bind(user.id).first()) return;
    const pesos = Math.max(0, Math.round(Number((S.rates || {})[`${plan}_${K.period || "mes"}`]) || 0));
    const now0 = Date.now(), paid0 = ((inv.status_transitions && inv.status_transitions.paid_at) || now0 / 1000) * 1000;
    await env.DB.prepare("INSERT OR IGNORE INTO commissions (id, referrer_id, user_id, invoice, plan, amount, commission, status, created, available_at, note, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seller')")
      .bind(inv.id, ref.id, user.id, inv.id, plan, inv.amount_paid, pesos * 100, pesos ? "pendiente" : "cancelada", now0, paid0 + REF.holdDays * 864e5,
        `Primer pago · ${PLANS[plan] ? PLANS[plan].name : plan} ${K.period === "anio" ? "anual" : "mensual"}${pesos ? "" : " (sin comisión para ese plan)"}`).run();
    return;
  }
  const ok = P && REF.plans.includes(P.id) && !ref.owner_id;   // only while the referrer also pays Pro or Premium
  const now = Date.now(), paidAt = ((inv.status_transitions && inv.status_transitions.paid_at) || now / 1000) * 1000;
  await env.DB.prepare("INSERT OR IGNORE INTO commissions (id, referrer_id, user_id, invoice, plan, amount, commission, status, created, available_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(inv.id, ref ? ref.id : user.ref_by, user.id, inv.id, plan, inv.amount_paid, ok ? Math.round(inv.amount_paid * REF.rate) : 0, ok ? "pendiente" : "cancelada", now, paidAt + REF.holdDays * 864e5,
      ok ? null : "Quien recomendó no tenía plan Pro o Premium ese día").run();
}

// ---------- daily stats and admin analytics ----------
const today = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);   // Mexico (UTC−6)
const bump = (env, field) => env.DB.prepare(`INSERT INTO stats (day, ${field}) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET ${field} = ${field} + 1`).bind(today());
function addMonths(t, n) { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + n); return d.getTime(); }
const PLAN_RANK = { gratis: 0, basico: 1, pro: 2, empresarial: 3, escuela: 3, premium: 4 };
// What matters to run the platform: accounts and growth, paying plans and monthly income, experiences and views,
// a 30-day daily series, and the most viewed experiences. About 10 queries.
async function adminStats(env, request) {
  const now = Date.now(), d30 = now - 30 * 864e5, d7 = now - 7 * 864e5;
  const [acc, plans, exps, top, days, cps] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS users, SUM(created > ?1) AS new7, SUM(created > ?2) AS new30 FROM users WHERE verified = 1`).bind(d7, d30),
    env.DB.prepare(`SELECT plan, plan_until, plan_note, stripe_status FROM users WHERE COALESCE(plan, 'gratis') != 'gratis' AND (plan_until IS NULL OR plan_until > ?)`).bind(now),
    env.DB.prepare(`SELECT SUM(paused = 0) AS active, SUM(paused = 1) AS paused, SUM(created > ?2) AS new30, COALESCE(SUM(views), 0) AS views FROM experiences WHERE expires > ?1`).bind(now, d30),
    env.DB.prepare(`SELECT slug, title, email, views FROM experiences WHERE expires > ? ORDER BY views DESC LIMIT 10`).bind(now),
    env.DB.prepare(`SELECT * FROM stats WHERE day >= ? ORDER BY day`).bind(new Date(d30 - 6 * 3600e3).toISOString().slice(0, 10)),
    env.DB.prepare(`SELECT COUNT(*) AS coupons, COALESCE(SUM(uses), 0) AS uses FROM coupons`),
  ]);
  const a = acc.results[0], e = exps.results[0];
  // paying accounts by plan; monthly income: Stripe (yearly ÷ 12) + plans activated by hand; courtesy codes are $0
  const byPlan = { basico: 0, pro: 0, premium: 0, empresarial: 0, escuela: 0 }, kind = { stripe: 0, manual: 0, cortesia: 0 }; let mrr = 0;
  for (const u of plans.results) {
    if (!PLANS[u.plan]) continue; byPlan[u.plan] = (byPlan[u.plan] || 0) + 1;
    const note = u.plan_note || "";
    if (/^Cupón/.test(note)) { kind.cortesia++; continue; }
    if (/^Stripe/.test(note) && ["active", "trialing", "past_due"].includes(u.stripe_status)) { kind.stripe++; mrr += /· anual$/.test(note) ? yearPrice(u.plan) / 12 : PLANS[u.plan].price; }
    else { kind.manual++; mrr += PLANS[u.plan].price; }
  }
  const series = []; const map = Object.fromEntries(days.results.map(r => [r.day, r]));
  for (let i = 29; i >= 0; i--) { const day = new Date(now - 6 * 3600e3 - i * 864e5).toISOString().slice(0, 10), r = map[day] || {}; series.push({ day, views: r.views || 0, signups: r.signups || 0, publishes: r.publishes || 0, contacts: r.contacts || 0 }); }
  const paid = byPlan.basico + byPlan.pro + byPlan.premium + byPlan.empresarial + byPlan.escuela;
  return {
    users: a.users || 0, new7: a.new7 || 0, new30: a.new30 || 0, paid, byPlan, kind, mrr: Math.round(mrr),
    conversion: a.users ? Math.round(1000 * (paid - kind.cortesia) / a.users) / 10 : 0,
    experiences: { active: e.active || 0, paused: e.paused || 0, new30: e.new30 || 0, views: e.views || 0 },
    views30: series.reduce((n, x) => n + x.views, 0), series,
    top: top.results.map(r => ({ ...r, url: expUrl(r.slug, request, env) })),
    coupons: cps.results[0],
  };
}

// ---------- plans ----------
// the plan in effect: a paid plan whose "paid until" date passed counts as free (the daily cron then applies it)
// A team member (owner_id) has its owner's plan while it lasts, with the experiences handed to it (quota).
// exp of an owner here is the plan total; what the owner can use itself is limitOf().
function planOf(user) {
  const live = (p, until) => PLANS[p] && (!until || until > Date.now());
  if (user.owner_id) {
    if (live(user.o_plan, user.o_until) && PLANS[user.o_plan].seats) return { id: user.o_plan, ...PLANS[user.o_plan], exp: user.quota || 0, until: user.o_until || null, member: true, owner: user.o_name || user.o_email || "" };
    return { id: "gratis", ...PLANS.gratis, until: null, member: true, owner: user.o_name || user.o_email || "" };
  }
  const id = live(user.plan, user.plan_until) ? user.plan : "gratis";
  return { id, ...PLANS[id], exp: PLANS[id].exp + (id === "gratis" ? 0 : user.extra_exp || 0), until: id === "gratis" ? null : user.plan_until || null };
}
// experiences the account itself can have active: a team owner keeps what it has not handed out
async function limitOf(env, user, P) {
  if (!P.seats || P.member) return P.exp;
  const r = await env.DB.prepare("SELECT COALESCE(SUM(quota), 0) AS q FROM users WHERE owner_id = ?").bind(user.id).first();
  return Math.max(0, P.exp - r.q);
}
const expCount = n => n >= UNLIMITED ? "experiencias ilimitadas" : n === 1 ? "1 experiencia" : `${n.toLocaleString("es-MX")} experiencias`;
const isAdmin = (env, user) => !!user && (env.ADMIN_EMAILS || ADMINS_DEFAULT).split(",").map(s => s.trim().toLowerCase()).includes(user.email);
// Sets the plan and fits the user's experiences to it in one statement (the free Workers plan allows 50 queries per request).
// The first `exp` (active first, most recently edited) stay active: on a paid plan with no end date, on the free plan for
// 15 days (or what they had left). The rest are paused: on a paid plan they are kept; on the free plan they are deleted
// after 30 days unless the plan goes up again.
async function applyPlan(env, user, plan, until, note) {
  const P = PLANS[plan];
  const [{ results: [u] }, { results: members }] = await env.DB.batch([
    env.DB.prepare("SELECT extra_exp FROM users WHERE id = ?").bind(user.id),
    env.DB.prepare("SELECT id, email, quota FROM users WHERE owner_id = ?").bind(user.id),
  ]);
  const total = P.exp + (plan === "gratis" ? 0 : (u && u.extra_exp) || 0), handed = members.reduce((n, x) => n + (x.quota || 0), 0);
  // a team plan: each member keeps its quota and the owner the rest; any other plan: members fall back to Gratis (1)
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET plan = ?, plan_until = ?, plan_note = ? WHERE id = ?").bind(plan, until, note || null, user.id),
    fitExperiences(env, user.email, P.seats ? Math.max(0, total - handed) : total, P.days),
    ...members.map(x => P.seats ? fitExperiences(env, x.email, x.quota || 0, 0) : fitExperiences(env, x.email, PLANS.gratis.exp, PLANS.gratis.days)),
  ]);
}
// The first `limit` experiences (active first, most recently edited) stay active; the rest are paused (see applyPlan).
function fitExperiences(env, email, limit, days) {
  const now = Date.now();
  return env.DB.prepare(`UPDATE experiences SET
        paused = CASE WHEN r.rn <= ?1 THEN 0 ELSE 1 END,
        expires = CASE WHEN r.rn <= ?1 THEN (CASE WHEN ?2 = 0 THEN ?3 WHEN experiences.paused = 0 AND experiences.expires < ?3 THEN experiences.expires ELSE ?4 END)
                       WHEN ?2 = 0 THEN ?3 WHEN experiences.paused = 1 AND experiences.expires < ?3 THEN experiences.expires ELSE ?5 END
      FROM (SELECT slug, ROW_NUMBER() OVER (ORDER BY paused, updated DESC, slug) AS rn FROM experiences WHERE email = ?6 AND expires > ?7) AS r
      WHERE experiences.slug = r.slug`).bind(limit, days, FAR, now + days * 864e5, now + LIMITS.pausedDays * 864e5, email, now);
}

// ---------- payments: Stripe subscriptions for Pro and Premium (monthly or yearly, IVA included; Básico and Empresarial
// keep working for the subscriptions that already exist, but are no longer sold) ----------
// Secrets STRIPE_SECRET_KEY (sk_test_ in the preview; in production sk_live_ or a restricted rk_live_ key with Products,
// Prices, Customers, Checkout Sessions, Customer portal and Coupons write + Subscriptions and Invoices read) and STRIPE_WEBHOOK_SECRET.
// Products and prices are created in Stripe on first use (found again by lookup_key). Stripe Checkout takes the payment,
// the webhook keeps users.plan in sync, and the Customer Portal lets people change card, switch plan or cancel.
// A paid month is "paid until" the period end + STRIPE_GRACE_DAYS; if a renewal fails and Stripe gives up, the daily
// cron moves the account back to Gratis on its own. With test keys only admins can pay (the preview shares the database).
// lookup keys per plan and period; a year costs 10 months (2 months free)
const STRIPE_PRICES = { basico: { mes: "vvr_basico_mes", anio: "vvr_basico_anual" }, pro: { mes: "vvr_pro_mes", anio: "vvr_pro_anual" }, premium: { mes: "vvr_premium_mes", anio: "vvr_premium_anual" }, empresarial: { mes: "vvr_empresarial_mes", anio: "vvr_empresarial_anual" } };
const YEAR_MONTHS = 10;
const STRIPE_PERIODS = { mes: "month", anio: "year" };
const stripeKeys = () => Object.entries(STRIPE_PRICES).flatMap(([plan, k]) => Object.entries(k).map(([period, key]) => ({ plan, period, key })));
const STRIPE_GRACE_DAYS = 7;
const STRIPE_LIVE = ["active", "trialing", "past_due"];
const stripeMode = env => /^(sk|rk)_live_/.test(String(env.STRIPE_SECRET_KEY || "")) ? "live" : "test";   // rk_ = restricted key (recommended)
function billingInfo(env, user) {
  if (!env.STRIPE_SECRET_KEY || user.owner_id) return { enabled: false };   // team members do not pay: their owner does
  const mode = stripeMode(env), mine = user.stripe_mode === mode;
  return { enabled: mode === "live" || isAdmin(env, user), test: mode === "test", subscribed: mine && STRIPE_LIVE.includes(user.stripe_status), pastDue: mine && user.stripe_status === "past_due", period: /· anual$/.test(user.plan_note || "") ? "anio" : "mes", yearMonths: YEAR_MONTHS };
}
async function stripe(env, method, path, params, idem) {
  const qs = params ? new URLSearchParams(flatParams(params)).toString() : "";
  const r = await fetch(`${env.STRIPE_API || "https://api.stripe.com"}/v1/${path}${method === "GET" && qs ? "?" + qs : ""}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": "2024-06-20", ...(method === "GET" ? {} : { "Content-Type": "application/x-www-form-urlencoded" }), ...(idem ? { "Idempotency-Key": idem } : {}) },
    body: method === "GET" ? undefined : qs,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || `Stripe ${r.status}`); e.code = j.error && j.error.code; throw e; }
  return j;
}
// {a: {b: 1}, c: ["x"]} → a[b]=1&c[0]=x (Stripe's form encoding)
function flatParams(o, pre = "", out = []) {
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    const key = pre ? `${pre}[${k}]` : k;
    if (typeof v === "object") flatParams(v, key, out); else out.push([key, String(v)]);
  }
  return out;
}
const priceCache = {};
// the plan's price for a period (mes | anio); created if missing, and replaced if PLANS changed its amount
async function stripePrice(env, plan, period = "mes") {
  const key = STRIPE_PRICES[plan][period], ck = stripeMode(env) + key, amount = (period === "anio" ? yearPrice(plan) : PLANS[plan].price) * 100;
  if (priceCache[ck]) return priceCache[ck];
  const found = (await stripe(env, "GET", "prices", { lookup_keys: [key], active: "true", limit: 1 })).data[0];
  // the product is shared by both periods of a plan: reuse the one of the other period if it exists
  const other = found ? null : (await stripe(env, "GET", "prices", { lookup_keys: Object.values(STRIPE_PRICES[plan]), active: "true", limit: 2 })).data[0];
  let price = found && found.unit_amount === amount && found.currency === "mxn" ? found : null;
  if (!price) {
    const product = found ? found.product : other ? other.product : (await stripe(env, "POST", "products", { name: `Vórtice VR · Plan ${PLANS[plan].name}`, description: `${expCount(PLANS[plan].exp)} de realidad aumentada`, metadata: { plan } })).id;
    price = await stripe(env, "POST", "prices", { product, currency: "mxn", unit_amount: amount, tax_behavior: "inclusive", recurring: { interval: STRIPE_PERIODS[period] }, lookup_key: key, transfer_lookup_key: "true", metadata: { plan, period } });
  }
  return (priceCache[ck] = { id: price.id, product: typeof price.product === "string" ? price.product : price.product.id });
}
// Customer Portal settings (made once by the API): card, invoices, cancel at period end, switch plan or period
async function stripePortalConfig(env) {
  const list = await stripe(env, "GET", "billing_portal/configurations", { active: "true", limit: 100 });
  const prices = []; // one after the other: the second period of a plan reuses the product made for the first
  for (const k of stripeKeys()) if (!PLANS[k.plan].legacy) prices.push(await stripePrice(env, k.plan, k.period));   // switch only to the plans on sale
  const want = prices.map(p => p.id).sort().join(",");
  const byProduct = {}; for (const p of prices) (byProduct[p.product] ||= []).push(p.id);
  const mine = list.data.find(c => c.metadata && c.metadata.app === "vvr" && c.metadata.prices === want);
  if (mine) return mine.id;
  return (await stripe(env, "POST", "billing_portal/configurations", {
    business_profile: { headline: "Vórtice VR · Experiencias inmersivas" },
    features: {
      payment_method_update: { enabled: "true" },
      invoice_history: { enabled: "true" },
      subscription_cancel: { enabled: "true", mode: "at_period_end" },
      subscription_update: { enabled: "true", default_allowed_updates: ["price"], proration_behavior: "create_prorations", products: Object.entries(byProduct).map(([product, ids]) => ({ product, prices: ids })) },
    },
    metadata: { app: "vvr", prices: want },
  })).id;
}
// Stripe-Signature: t=…,v1=… with HMAC-SHA256(secret, "t.body"); at most 5 minutes old
async function stripeVerify(env, raw, header) {
  if (!env.STRIPE_WEBHOOK_SECRET || !header) return false;
  const t = (/(?:^|,)t=(\d+)/.exec(header) || [])[1];
  const sigs = [...header.matchAll(/(?:^|,)v1=([0-9a-f]+)/g)].map(m => m[1]);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${raw}`)))].map(b => b.toString(16).padStart(2, "0")).join("");
  return sigs.some(s => s.length === mac.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ mac.charCodeAt(i)), 0) === 0);
}
// Reads the subscription from Stripe (never trusts the event's copy) and applies its plan to the account.
async function stripeSync(env, ctx, subId) {
  const sub = await stripe(env, "GET", `subscriptions/${subId}`);
  const uid = Number(sub.metadata && sub.metadata.user_id);
  let user = uid ? await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(uid).first() : null;
  if (!user) user = await env.DB.prepare("SELECT * FROM users WHERE stripe_customer = ?").bind(sub.customer).first();
  if (!user) { console.error("Stripe: suscripción sin cuenta", subId); return; }
  const item = sub.items && sub.items.data[0], price = item && item.price;
  const known = stripeKeys().find(k => price && k.key === price.lookup_key);
  const plan = (known && known.plan) || (price && price.metadata && price.metadata.plan) || (sub.metadata && sub.metadata.plan);
  const yearly = (known && known.period === "anio") || (price && price.recurring && price.recurring.interval === "year");
  const live = STRIPE_LIVE.includes(sub.status);
  if (!live && user.stripe_sub && user.stripe_sub !== sub.id) return; // an old subscription ending must not undo the current one
  await env.DB.prepare("UPDATE users SET stripe_customer = ?, stripe_sub = ?, stripe_status = ?, stripe_mode = ? WHERE id = ?").bind(sub.customer, sub.id, sub.status, sub.livemode ? "live" : "test", user.id).run();
  if (live && STRIPE_PRICES[plan]) {
    const end = (sub.current_period_end || (item && item.current_period_end) || 0) * 1000;
    const before = planOf(user).id;
    await applyPlan(env, user, plan, Math.max(end, Date.now()) + STRIPE_GRACE_DAYS * 864e5, `Stripe · ${sub.id}${yearly ? " · anual" : ""}`);
    if (before !== plan) ctx.waitUntil(sendMail(env, user.email, `Tu plan ${PLANS[plan].name} de Vórtice VR está activo`, planMail(user, plan, null)));
  } else if (!live && STRIPE_PRICES[user.plan]) {
    await applyPlan(env, user, "gratis", null, null);
  }
}
// one-time codes by email: confirm the account once, or reset the password
async function sendCode(env, em, purpose) {
  if (!(await limit(env, `code:${purpose}:${em}`, 1, 55e3))) return { error: "Ya te enviamos un código. Espera un minuto para pedir otro.", status: 429 };
  if (!(await limit(env, `codeday:${em}`, 10, 864e5))) return { error: "Demasiados códigos hoy para este correo. Intenta mañana.", status: 429 };
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  await env.DB.prepare("INSERT INTO otp (email, purpose, hash, expires, tries) VALUES (?, ?, ?, ?, 0) ON CONFLICT(email, purpose) DO UPDATE SET hash = excluded.hash, expires = excluded.expires, tries = 0")
    .bind(em, purpose, await hashCode(env, em, purpose + code), Date.now() + LIMITS.codeMinutes * 60e3).run();
  if (env.DEV_CODES === "1") return { ok: true, dev_code: code };
  const subject = purpose === "reset" ? `Código para cambiar tu contraseña: ${code}` : `Confirma tu cuenta de Vórtice VR: ${code}`;
  if (!(await sendMail(env, em, subject, codeMail(code, purpose)))) return { error: "No pudimos enviar el correo. Intenta más tarde.", status: 502 };
  return { ok: true };
}
function codeResponse(r) { const { status, ...rest } = r; return json(rest, status || 200); }
async function checkCode(env, em, purpose, code) {
  if (!em || !/^\d{6}$/.test(String(code || ""))) return json({ error: "Código incorrecto." }, 400);
  const row = await env.DB.prepare("SELECT * FROM otp WHERE email = ? AND purpose = ?").bind(em, purpose).first();
  if (!row || row.expires < Date.now()) return json({ error: "El código expiró. Pide uno nuevo." }, 400);
  if (row.tries >= LIMITS.codeTries) return json({ error: "Demasiados intentos. Pide un código nuevo." }, 429);
  if (row.hash !== (await hashCode(env, em, purpose + String(code)))) {
    await env.DB.prepare("UPDATE otp SET tries = tries + 1 WHERE email = ? AND purpose = ?").bind(em, purpose).run();
    return json({ error: "Código incorrecto." }, 400);
  }
  await env.DB.prepare("DELETE FROM otp WHERE email = ? AND purpose = ?").bind(em, purpose).run();
  return null;
}

function b64url(buf) { return b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function b64(buf) { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function unb64url(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); const b = atob(s + "=".repeat((4 - s.length % 4) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); }
function json(obj, status = 200, extra = {}) { return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } }); }

async function sendMail(env, to, subject, html, attachments, replyTo) {
  if (!env.RESEND_API_KEY) { console.log("[correo sin configurar]", to, subject); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM || "Vórtice VR <ra@vorticevr.mx>", to: [to], subject, html, attachments, reply_to: replyTo }),
  });
  if (!r.ok) console.error("Resend", r.status, await r.text());
  return r.ok;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shell = body => `<div style="font-family:Arial,sans-serif;background:#0d0620;color:#f2ecff;padding:28px;border-radius:14px;max-width:520px;margin:auto">
<div style="font-weight:700;letter-spacing:.2em;color:#d2b8ff;font-size:13px">VÓRTICE VR</div>${body}
<p style="color:#a99bcb;font-size:12px;margin-top:28px">Recibiste este correo por tu cuenta en vorticevr.mx. Si no fuiste tú, ignóralo.</p></div>`;
const codeMail = (code, purpose) => shell(`<h1 style="font-size:20px">${purpose === "reset" ? "Tu código para cambiar tu contraseña" : "Confirma tu cuenta de Vórtice VR"}</h1>
<p style="font-size:34px;font-weight:700;letter-spacing:.3em;color:#ffbe55;margin:18px 0">${code}</p><p>Vence en ${LIMITS.codeMinutes} minutos.</p>`);
const linkMail = e => shell(`<h1 style="font-size:20px">¡Tu experiencia de realidad aumentada está lista!</h1>
<p><b>${esc(e.title)}</b></p><p>Comparte este link (o el código QR adjunto):</p>
<p><a href="${esc(e.url)}" style="color:#ffbe55;font-size:20px;font-weight:700">${esc(e.url.replace(/^https:\/\//, "").replace(/\/$/, ""))}</a></p>
<p>Ábrelo en el celular, toca <b>Abrir la cámara</b> y apunta a tu imagen.</p>
<p>Para editarla o borrarla entra a tu cuenta en <a href="https://vorticevr.mx/cuenta/" style="color:#d2b8ff">vorticevr.mx/cuenta</a>.</p>
<p style="color:#a99bcb">${e.forever ? "Disponible mientras tu plan esté activo." : `Disponible hasta el ${fecha(e.expires)}.`}</p>`);
const fecha = t => new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
const teamMail = (owner, name, email, pw, quota, origin) => shell(`<h1 style="font-size:20px">¡Hola, ${esc(name)}! Ya tienes tu cuenta</h1>
<p><b>${esc(owner.name || owner.email)}</b> te agregó a su equipo en Vórtice VR para que crees experiencias de realidad aumentada${quota ? ` (tienes ${expCount(quota)} disponibles)` : ""}.</p>
<p>Entra en <a href="${esc(origin)}/cuenta/" style="color:#ffbe55;font-weight:700">${esc(origin.replace(/^https?:\/\//, ""))}/cuenta</a> con:</p>
<p style="background:#1b0a36;border-radius:10px;padding:14px;font-size:16px">Correo: <b>${esc(email)}</b><br>Contraseña temporal: <b style="font-family:monospace;letter-spacing:.06em">${esc(pw)}</b></p>
<p>Al entrar, cámbiala por una tuya en Mi cuenta → Cambiar contraseña.</p>`);
const planMail = (user, plan, until) => shell(`<h1 style="font-size:20px">¡Tu plan ${PLANS[plan].name} está activo!</h1>
<p>Hola ${esc(user.name || "")}, ya puedes tener hasta <b>${expCount(PLANS[plan].exp)}</b> activas al mismo tiempo, con videos de hasta ${PLANS[plan].videoMB} MB, sin fecha de vencimiento mientras tu plan esté vigente.</p>
${until ? `<p>Pagado hasta el <b>${fecha(until)}</b>.</p>` : ""}
<p>Entra a <a href="https://vorticevr.mx/cuenta/" style="color:#ffbe55;font-weight:700">vorticevr.mx/cuenta</a> para crear tus experiencias.</p>`);
