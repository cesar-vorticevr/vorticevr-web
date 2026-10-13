// Worker de vorticevr.mx (corre antes que los static assets: run_worker_first).
//  - Sitio estático: pasa directo a los assets; a los videos les responde peticiones Range (el iPhone las necesita).
//  - Plataforma de RA (vorticevr.mx/crear/):
//      nombre.vorticevr.mx  y  /e/nombre/   → visor /x/
//      /api/*                                 → cuentas (registro, sesión), publicar, consultar
//      /m/<slug>/<video|target|image>         → archivos de la experiencia en R2 (con Range)
//    Requiere bindings DB (D1) y MEDIA (R2); secretos RESEND_API_KEY y SESSION_SECRET.
//    Sin bindings, el sitio funciona igual y la API responde 503.

const ROOT_DEFAULT = "vorticevr.mx";
const RESERVED = new Set(["www","t","api","admin","mail","email","smtp","crear","create","ra","x","e","m","preview","app","apps","static","assets","cdn","dev","test","staging","beta","demo","vorticevr","vortice","soporte","support","help","ayuda","blog","shop","tienda","login","cuenta","account","johara","tarjeta","proyectos","status","docs"]);
const LIMITS = { imageBytes: 3 * 1024 * 1024, targetBytes: 8 * 1024 * 1024, codeMinutes: 10, codeTries: 5, sessionDays: 30, pausedDays: 30 };
// Plans. exp = active experiences; days = how long each one lasts (0 = while the plan is active);
// brand = the viewer opens with the "Creado con Vórtice VR" screen. Video: limited by size only, not duration.
// Paid plans are activated by an admin in /admin/ (escuela always; basico/pro until Stripe is connected).
// Videos stay ≤ 50 MB: the Worker reads the whole upload in memory (128 MB).
const PLANS = {
  gratis:  { name: "Gratis",  exp: 1,    days: 30, videoMB: 25, brand: true,  price: 0 },
  basico:  { name: "Básico",  exp: 5,    days: 0,  videoMB: 25, brand: true,  price: 199 },
  pro:     { name: "Pro",     exp: 50,   days: 0,  videoMB: 50, brand: false, price: 499 },
  escuela: { name: "Escuela", exp: 1000, days: 0,  videoMB: 50, brand: false, price: 1500 },
};
const FAR = 253402300799000; // expires of an experience on a paid plan: "while the plan is active" (year 9999)
const ADMINS_DEFAULT = "lad.cesargarcia@gmail.com";
const ADMIN_SLUGS = new Set(["ejemplo"]); // only an admin can take these (the home page demo uses "ejemplo")
const VIDEO = /\.(mp4|m4v|webm|mov)$/i;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const BUTTONS = ["whatsapp", "facebook", "instagram", "youtube", "x", "tiktok", "web"];
const LABELS = { whatsapp: "WhatsApp", facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", x: "X", tiktok: "TikTok", web: "tu sitio web" };
// social networks accept just the username (or a pasted link); this is how a username becomes a link
const SOCIAL_BASE = { facebook: "https://facebook.com/", instagram: "https://instagram.com/", youtube: "https://youtube.com/@", x: "https://x.com/", tiktok: "https://tiktok.com/@" };

export default {
  async fetch(request, env, ctx) {
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
  },

  // daily: delete expired experiences and their files
  async scheduled(event, env, ctx) {
    if (!env.DB || !env.MEDIA) return;
    await schema(env);
    // paid plans whose "paid until" date passed go back to free (extra experiences are paused 30 days, then deleted)
    const { results: lapsed } = await env.DB.prepare("SELECT * FROM users WHERE plan != 'gratis' AND plan_until IS NOT NULL AND plan_until < ? LIMIT 20").bind(Date.now()).all();
    for (const u of lapsed) await applyPlan(env, u, "gratis", null, u.plan_note);
    // expired experiences: files in bulk (one R2 call per 1000 keys), then the rows
    const now = Date.now();
    const { results } = await env.DB.prepare("SELECT slug FROM experiences WHERE expires < ? LIMIT 2000").bind(now).all();
    const keys = results.flatMap(r => ["video", "target", "image", "qr"].map(k => `exp/${r.slug}/${k}`));
    for (let i = 0; i < keys.length; i += 1000) await env.MEDIA.delete(keys.slice(i, i + 1000));
    if (results.length) await env.DB.prepare("DELETE FROM experiences WHERE slug IN (SELECT slug FROM experiences WHERE expires < ? LIMIT 2000)").bind(now).run();
    await env.DB.prepare("DELETE FROM otp WHERE expires < ?").bind(Date.now() - 864e5).run();
    await env.DB.prepare("DELETE FROM sessions WHERE expires < ?").bind(Date.now()).run();
    await env.DB.prepare("DELETE FROM users WHERE verified = 0 AND created < ?").bind(Date.now() - 7 * 864e5).run();
    await env.DB.prepare("DELETE FROM ratelimit WHERE reset < ?").bind(Date.now()).run();
  },
};

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
  const m = url.pathname.match(/^\/m\/([a-z0-9-]+)\/(video|target|image)$/);
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
async function deleteMedia(env, slug) {
  await env.MEDIA.delete(["video", "target", "image", "qr"].map(k => `exp/${slug}/${k}`));
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
    const row = await env.DB.prepare("SELECT e.*, u.plan, u.plan_until FROM experiences e LEFT JOIN users u ON u.email = e.email WHERE e.slug = ?").bind(m[1]).first();
    if (!row) return json({ error: "No existe" }, 404);
    if (row.expires < Date.now()) return json({ error: "Expiró" }, 410);
    if (row.paused) return json({ error: "Pausada", paused: true }, 410);
    ctx.waitUntil(env.DB.prepare("UPDATE experiences SET views = views + 1 WHERE slug = ?").bind(row.slug).run());
    return json({ ...publicExp(row), brand: planOf(row).brand }, 200, { "Cache-Control": "no-store" });
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
    if (user) await env.DB.prepare("UPDATE users SET name = ?, pass = ? WHERE id = ?").bind(name, hash, user.id).run();
    else await env.DB.prepare("INSERT INTO users (email, name, pass, verified, created) VALUES (?, ?, ?, 0, ?)").bind(em, name, hash, Date.now()).run();
    return codeResponse(await sendCode(env, em, "verify"));
  }

  if (path === "/api/verify" && M === "POST") {
    const b = await request.json().catch(() => ({}));
    const em = normEmail(b.email);
    const bad = await checkCode(env, em, "verify", b.code);
    if (bad) return bad;
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(em).first();
    if (!user) return json({ error: "No encontramos esa cuenta. Regístrate de nuevo." }, 404);
    await env.DB.prepare("UPDATE users SET verified = 1 WHERE id = ?").bind(user.id).run();
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
    await env.DB.prepare("UPDATE users SET pass = ? WHERE id = ?").bind(await hashPassword(String(b.password)), me.id).run();
    return json({ ok: true });
  }
  m = path.match(/^\/api\/experience\/([a-z0-9-]+)$/);
  if (m && M === "DELETE") {
    if (!me) return json({ error: "Inicia sesión de nuevo." }, 401);
    const exp = await env.DB.prepare("SELECT slug FROM experiences WHERE slug = ? AND email = ?").bind(m[1], who).first();
    if (!exp) return json({ error: "No encontramos esa experiencia en tu cuenta." }, 404);
    await deleteMedia(env, exp.slug); await env.DB.prepare("DELETE FROM experiences WHERE slug = ?").bind(exp.slug).run();
    return json({ ok: true });
  }

  if (path === "/api/publish" && M === "POST") {
    if (!who) return json({ error: "Inicia sesión de nuevo." }, 401);
    if (!(await limit(env, "pub:" + who, 30, 3600e3))) return json({ error: "Demasiadas publicaciones seguidas. Espera un rato." }, 429);
    const P = planOf(me);
    const form = await request.formData();
    let meta; try { meta = JSON.parse(form.get("meta") || "{}"); } catch { return json({ error: "Datos inválidos." }, 400); }
    // editing: meta.original is the experience's current slug (it can move to a new one)
    const original = String(meta.original || "").toLowerCase();
    const mine = original ? await env.DB.prepare("SELECT * FROM experiences WHERE slug = ? AND email = ? AND expires > ?").bind(original, who, Date.now()).first() : null;
    if (original && !mine) return json({ error: "No encontramos esa experiencia en tu cuenta." }, 404);
    if (mine && mine.paused) return json({ error: `Esta experiencia está pausada: tu plan ${P.name} incluye ${expCount(P.exp)}. Mejora tu plan para reactivarla.` }, 403);
    if (!mine) {
      const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM experiences WHERE email = ? AND paused = 0 AND expires > ?").bind(who, Date.now()).first();
      if (n.n >= P.exp) return json({ error: `Tu plan ${P.name} incluye ${expCount(P.exp)}. Borra una o mejora tu plan para crear otra.` }, 403);
    }
    const slug = String(meta.slug || "").toLowerCase();
    const st = await slugStatus(env, slug, who, mine && mine.slug, isAdmin(env, me));
    if (!st.ok) return json({ error: st.reason }, 400);
    const data = cleanMeta(meta);
    if (data.error) return json({ error: data.error }, 400);
    const video = form.get("video"), image = form.get("image"), target = form.get("target"), qr = form.get("qr");
    const isNew = !mine;
    if (isNew && (!video || !image || !target)) return json({ error: "Faltan la imagen o el video." }, 400);
    if (video && (video.size > P.videoMB * 1048576 || !/^video\/(mp4|webm|quicktime)$/.test(video.type))) return json({ error: `El video debe ser MP4, WebM o MOV de máximo ${P.videoMB} MB.` }, 400);
    if (image && (image.size > LIMITS.imageBytes || !/^image\/(jpeg|png|webp)$/.test(image.type))) return json({ error: "La imagen es demasiado grande." }, 400);
    if (target && target.size > LIMITS.targetBytes) return json({ error: "La imagen no se pudo preparar. Intenta con otra." }, 400);
    // an expired row with this slug that the cron has not deleted yet (anyone's): clear it first
    if (!mine || mine.slug !== slug) {
      const stale = await env.DB.prepare("SELECT slug FROM experiences WHERE slug = ?").bind(slug).first();
      if (stale) { await deleteMedia(env, slug); await env.DB.prepare("DELETE FROM experiences WHERE slug = ?").bind(slug).run(); }
    }
    // changing the name moves the files
    if (mine && mine.slug !== slug) {
      for (const k of ["video", "target", "image"]) {
        const isReplaced = (k === "video" && video) || (k === "image" && image) || (k === "target" && target);
        if (!isReplaced) { const o = await env.MEDIA.get(`exp/${mine.slug}/${k}`); if (o) await env.MEDIA.put(`exp/${slug}/${k}`, o.body, { httpMetadata: o.httpMetadata }); }
      }
      await deleteMedia(env, mine.slug);
      await env.DB.prepare("DELETE FROM experiences WHERE slug = ?").bind(mine.slug).run();
    }
    if (video) await env.MEDIA.put(`exp/${slug}/video`, video, { httpMetadata: { contentType: video.type } });
    if (image) await env.MEDIA.put(`exp/${slug}/image`, await image.arrayBuffer(), { httpMetadata: { contentType: image.type } });
    if (target) await env.MEDIA.put(`exp/${slug}/target`, await target.arrayBuffer(), { httpMetadata: { contentType: "application/octet-stream" } });
    const now = Date.now();
    const created = mine ? mine.created : now;
    const expires = mine ? mine.expires : P.days ? now + P.days * 864e5 : FAR;
    await env.DB.prepare("INSERT INTO experiences (slug, email, title, data, created, updated, expires, views, paused) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, data = excluded.data, updated = excluded.updated")
      .bind(slug, who, data.title, JSON.stringify(data), created, now, expires, mine ? mine.views || 0 : 0).run();
    const row = await env.DB.prepare("SELECT * FROM experiences WHERE slug = ?").bind(slug).first();
    const out = ownerExp(row, request, env);
    if (meta.sendEmail !== false) ctx.waitUntil(sendMail(env, who, "Tu experiencia de realidad aumentada está lista", linkMail(out), qr && qr.size < 300e3 ? [{ filename: `QR-${slug}.png`, content: b64(await qr.arrayBuffer()) }] : undefined));
    return json({ ok: true, experience: out });
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
    if (!STRIPE_PRICES[b.plan]) return json({ error: "Plan inválido." }, 400);
    const period = b.period === "anio" ? "anio" : "mes";
    const price = await stripePrice(env, b.plan, period);
    const newCustomer = async () => {
      const c = await stripe(env, "POST", "customers", { email: me.email, name: me.name, metadata: { user_id: me.id } });
      await env.DB.prepare("UPDATE users SET stripe_customer = ?, stripe_mode = ? WHERE id = ?").bind(c.id, mode, me.id).run();
      return c.id;
    };
    if (!customer) customer = await newCustomer();
    const session = c => stripe(env, "POST", "checkout/sessions", {
      mode: "subscription", customer: c, client_reference_id: me.id, locale: "es-419", allow_promotion_codes: "true",
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
          (SELECT COUNT(*) FROM experiences e WHERE e.email = u.email AND e.paused = 0 AND e.expires > ?1) AS active,
          (SELECT COUNT(*) FROM experiences e WHERE e.email = u.email AND e.paused = 1 AND e.expires > ?1) AS paused,
          (SELECT COALESCE(SUM(views), 0) FROM experiences e WHERE e.email = u.email) AS views
        FROM users u WHERE (?2 = '' OR instr(lower(u.email), ?2) > 0 OR instr(lower(u.name), ?2) > 0)
        ORDER BY (COALESCE(u.plan, 'gratis') != 'gratis') DESC, u.created DESC LIMIT 300`).bind(now, q).all();
      const totals = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM users WHERE verified = 1) AS users,
          (SELECT COUNT(*) FROM users WHERE COALESCE(plan, 'gratis') != 'gratis') AS paid,
          (SELECT COUNT(*) FROM experiences WHERE paused = 0 AND expires > ?1) AS experiences,
          (SELECT COALESCE(SUM(views), 0) FROM experiences) AS views`).bind(now).first();
      return json({ users: results.map(u => ({ ...u, effective: planOf(u).id })), totals, plans: PLANS });
    }
    if (path === "/api/admin/experiences" && M === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM experiences WHERE email = ? AND expires > ? ORDER BY paused, updated DESC LIMIT 1000").bind(normEmail(url.searchParams.get("email")), now).all();
      return json({ experiences: results.map(r => ownerExp(r, request, env)) });
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
      await applyPlan(env, user, plan, until, String(b.note || "").trim().slice(0, 300));
      if (b.notify && plan !== "gratis") ctx.waitUntil(sendMail(env, user.email, `Tu plan ${PLANS[plan].name} de Vórtice VR está activo`, planMail(user, plan, until)));
      return json({ ok: true });
    }
  }
  return json({ error: "No encontrado" }, 404);
}

function publicExp(row) {
  const d = JSON.parse(row.data || "{}");
  return { slug: row.slug, title: row.title, fit: d.fit, img: d.img, video: d.video, buttons: d.buttons, expires: row.expires };
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
  if (row && row.expires > Date.now()) return { ok: false, reason: owner && row.email === owner ? "Ya tienes otra experiencia con ese link." : "Ese nombre ya está ocupado." };
  return { ok: true };
}
function cleanMeta(m) {
  const title = String(m.title || "").trim().slice(0, 80);
  if (!title) return { error: "Escribe un título." };
  const fit = ["width", "height", "fill"].includes(m.fit) ? m.fit : "width";
  const num = (v, a, b) => { v = Number(v); return Number.isFinite(v) && v >= a && v <= b ? Math.round(v) : null; };
  const img = { w: num(m.img && m.img.w, 50, 8000), h: num(m.img && m.img.h, 50, 8000) };
  const video = { w: num(m.video && m.video.w, 16, 8000), h: num(m.video && m.video.h, 16, 8000) };
  if (!img.w || !img.h || !video.w || !video.h) return { error: "Faltan las medidas de la imagen o el video." };
  const buttons = {};
  for (const k of BUTTONS) {
    let v = String((m.buttons && m.buttons[k]) || "").trim().slice(0, 300);
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
  return { title, fit, img, video, buttons };
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
  ]);
  await migrate(env);
  schemaReady = true;
}
const EXP_COLS = "slug TEXT PRIMARY KEY, email TEXT NOT NULL, title TEXT, data TEXT, created INTEGER, updated INTEGER, expires INTEGER, views INTEGER DEFAULT 0, paused INTEGER DEFAULT 0";
// Tables from before the plans: experiences had email UNIQUE (one per account) and users had no plan.
// Production and the preview share this database: every change here has to keep the other version working.
async function migrate(env) {
  const { results } = await env.DB.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name IN ('experiences', 'users')").all();
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
  if (!/\bstripe_mode\b/.test(sql.users)) {   // Stripe subscription of the account (test or live keys: never mix their ids)
    try { await env.DB.batch(["stripe_customer", "stripe_sub", "stripe_status", "stripe_mode"].map(c => env.DB.prepare(`ALTER TABLE users ADD COLUMN ${c} TEXT`))); }
    catch (e) { console.error("migración stripe", e); }
  }
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS experiences_email ON experiences (email)").run();
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
  const row = await env.DB.prepare("SELECT u.id, u.email, u.name, u.verified, u.plan, u.plan_until, u.plan_note, u.stripe_customer, u.stripe_sub, u.stripe_status, u.stripe_mode, s.expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?").bind(await sha256hex(t)).first();
  return row && row.expires > Date.now() && row.verified ? row : null;
}
async function account(env, request, user) {
  const { results } = await env.DB.prepare("SELECT * FROM experiences WHERE email = ? AND expires > ? ORDER BY paused, created DESC").bind(user.email, Date.now()).all();
  const plan = planOf(user);
  return { user: { name: user.name, email: user.email }, experiences: results.map(r => ownerExp(r, request, env)), plan, limit: plan.exp, admin: isAdmin(env, user) || undefined, billing: billingInfo(env, user) };
}

// ---------- plans ----------
// the plan in effect: a paid plan whose "paid until" date passed counts as free (the daily cron then applies it)
function planOf(user) {
  const id = PLANS[user.plan] && (!user.plan_until || user.plan_until > Date.now()) ? user.plan : "gratis";
  return { id, ...PLANS[id], until: id === "gratis" ? null : user.plan_until || null };
}
const expCount = n => n === 1 ? "1 experiencia" : `${n.toLocaleString("es-MX")} experiencias`;
const isAdmin = (env, user) => !!user && (env.ADMIN_EMAILS || ADMINS_DEFAULT).split(",").map(s => s.trim().toLowerCase()).includes(user.email);
// Sets the plan and fits the user's experiences to it in one statement (the free Workers plan allows 50 queries per request).
// The first `exp` (active first, most recently edited) stay active: on a paid plan with no end date, on the free plan for
// 30 days (or what they had left). The rest are paused and deleted after 30 days unless the plan goes up again.
async function applyPlan(env, user, plan, until, note) {
  const P = PLANS[plan], now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET plan = ?, plan_until = ?, plan_note = ? WHERE id = ?").bind(plan, until, note || null, user.id),
    env.DB.prepare(`UPDATE experiences SET
        paused = CASE WHEN r.rn <= ?1 THEN 0 ELSE 1 END,
        expires = CASE WHEN r.rn <= ?1 THEN (CASE WHEN ?2 = 0 THEN ?3 WHEN experiences.paused = 0 AND experiences.expires < ?3 THEN experiences.expires ELSE ?4 END)
                       WHEN experiences.paused = 1 THEN experiences.expires ELSE ?5 END
      FROM (SELECT slug, ROW_NUMBER() OVER (ORDER BY paused, updated DESC, slug) AS rn FROM experiences WHERE email = ?6 AND expires > ?7) AS r
      WHERE experiences.slug = r.slug`).bind(P.exp, P.days, FAR, now + P.days * 864e5, now + LIMITS.pausedDays * 864e5, user.email, now),
  ]);
}

// ---------- payments: Stripe subscriptions for Básico and Pro (monthly or yearly, IVA included) ----------
// Secrets STRIPE_SECRET_KEY (sk_test_ in the preview, sk_live_ in production) and STRIPE_WEBHOOK_SECRET.
// Products and prices are created in Stripe on first use (found again by lookup_key). Stripe Checkout takes the payment,
// the webhook keeps users.plan in sync, and the Customer Portal lets people change card, switch plan or cancel.
// A paid month is "paid until" the period end + STRIPE_GRACE_DAYS; if a renewal fails and Stripe gives up, the daily
// cron moves the account back to Gratis on its own. With test keys only admins can pay (the preview shares the database).
// lookup keys per plan and period; a year costs 10 months (2 months free)
const STRIPE_PRICES = { basico: { mes: "vvr_basico_mes", anio: "vvr_basico_anual" }, pro: { mes: "vvr_pro_mes", anio: "vvr_pro_anual" } };
const YEAR_MONTHS = 10;
const STRIPE_PERIODS = { mes: "month", anio: "year" };
const stripeKeys = () => Object.entries(STRIPE_PRICES).flatMap(([plan, k]) => Object.entries(k).map(([period, key]) => ({ plan, period, key })));
const STRIPE_GRACE_DAYS = 7;
const STRIPE_LIVE = ["active", "trialing", "past_due"];
const stripeMode = env => String(env.STRIPE_SECRET_KEY || "").startsWith("sk_live_") ? "live" : "test";
function billingInfo(env, user) {
  if (!env.STRIPE_SECRET_KEY) return { enabled: false };
  const mode = stripeMode(env), mine = user.stripe_mode === mode;
  return { enabled: mode === "live" || isAdmin(env, user), test: mode === "test", subscribed: mine && STRIPE_LIVE.includes(user.stripe_status), pastDue: mine && user.stripe_status === "past_due", period: /· anual$/.test(user.plan_note || "") ? "anio" : "mes", yearMonths: YEAR_MONTHS };
}
async function stripe(env, method, path, params) {
  const qs = params ? new URLSearchParams(flatParams(params)).toString() : "";
  const r = await fetch(`${env.STRIPE_API || "https://api.stripe.com"}/v1/${path}${method === "GET" && qs ? "?" + qs : ""}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": "2024-06-20", ...(method === "GET" ? {} : { "Content-Type": "application/x-www-form-urlencoded" }) },
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
  const key = STRIPE_PRICES[plan][period], ck = stripeMode(env) + key, amount = PLANS[plan].price * (period === "anio" ? YEAR_MONTHS : 1) * 100;
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
  for (const k of stripeKeys()) prices.push(await stripePrice(env, k.plan, k.period));
  const want = prices.map(p => p.id).sort().join(",");
  const byProduct = {}; for (const p of prices) (byProduct[p.product] ||= []).push(p.id);
  const mine = list.data.find(c => c.metadata && c.metadata.app === "vvr" && c.metadata.prices === want);
  if (mine) return mine.id;
  return (await stripe(env, "POST", "billing_portal/configurations", {
    business_profile: { headline: "Vórtice VR · Realidad aumentada" },
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

async function sendMail(env, to, subject, html, attachments) {
  if (!env.RESEND_API_KEY) { console.log("[correo sin configurar]", to, subject); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM || "Vórtice VR <ra@vorticevr.mx>", to: [to], subject, html, attachments }),
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
const planMail = (user, plan, until) => shell(`<h1 style="font-size:20px">¡Tu plan ${PLANS[plan].name} está activo!</h1>
<p>Hola ${esc(user.name || "")}, ya puedes tener hasta <b>${expCount(PLANS[plan].exp)}</b> activas al mismo tiempo, con videos de hasta ${PLANS[plan].videoMB} MB, sin fecha de vencimiento mientras tu plan esté vigente${PLANS[plan].brand ? "" : " y sin la pantalla de Vórtice VR al abrirlas"}.</p>
${until ? `<p>Pagado hasta el <b>${fecha(until)}</b>.</p>` : ""}
<p>Entra a <a href="https://vorticevr.mx/cuenta/" style="color:#ffbe55;font-weight:700">vorticevr.mx/cuenta</a> para crear tus experiencias.</p>`);
