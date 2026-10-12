// Worker de vorticevr.mx (corre antes que los static assets: run_worker_first).
//  - Sitio estático: pasa directo a los assets; a los videos les responde peticiones Range (el iPhone las necesita).
//  - Plataforma de RA (vorticevr.mx/crear/):
//      nombre.vorticevr.mx  y  /e/nombre/   → visor /x/
//      /api/*                                 → código por correo, publicar, consultar
//      /m/<slug>/<video|target|image>         → archivos de la experiencia en R2 (con Range)
//    Requiere bindings DB (D1) y MEDIA (R2); secretos RESEND_API_KEY y SESSION_SECRET.
//    Sin bindings, el sitio funciona igual y la API responde 503.

const ROOT_DEFAULT = "vorticevr.mx";
const RESERVED = new Set(["www","t","api","admin","mail","email","smtp","crear","create","ra","x","e","m","preview","app","apps","static","assets","cdn","dev","test","staging","beta","demo","vorticevr","vortice","soporte","support","help","ayuda","blog","shop","tienda","login","cuenta","account","johara","tarjeta","proyectos","status","docs"]);
const LIMITS = { videoBytes: 25 * 1024 * 1024, imageBytes: 3 * 1024 * 1024, targetBytes: 8 * 1024 * 1024, days: 30, codeMinutes: 10, codeTries: 5 };
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
    const { results } = await env.DB.prepare("SELECT slug FROM experiences WHERE expires < ?").bind(Date.now()).all();
    for (const r of results) {
      await deleteMedia(env, r.slug);
      await env.DB.prepare("DELETE FROM experiences WHERE slug = ?").bind(r.slug).run();
    }
    await env.DB.prepare("DELETE FROM codes WHERE expires < ?").bind(Date.now() - 864e5).run();
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
  const exp = await env.DB.prepare("SELECT expires FROM experiences WHERE slug = ?").bind(slug).first();
  if (!exp || exp.expires < Date.now()) return new Response("No encontrado", { status: 404 });
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
    const row = await env.DB.prepare("SELECT * FROM experiences WHERE slug = ?").bind(m[1]).first();
    if (!row) return json({ error: "No existe" }, 404);
    if (row.expires < Date.now()) return json({ error: "Expiró" }, 410);
    ctx.waitUntil(env.DB.prepare("UPDATE experiences SET views = views + 1 WHERE slug = ?").bind(row.slug).run());
    return json(publicExp(row), 200, { "Cache-Control": "no-store" });
  }

  if (path === "/api/slug" && M === "GET") return json(await slugStatus(env, (url.searchParams.get("s") || "").toLowerCase(), null));

  if (path === "/api/code" && M === "POST") {
    const { email } = await request.json().catch(() => ({}));
    const em = normEmail(email);
    if (!em) return json({ error: "Escribe un correo válido." }, 400);
    if (!(await limit(env, "ip:" + ip, 12, 3600e3))) return json({ error: "Demasiados intentos. Espera un rato." }, 429);
    if (!(await limit(env, "mail:" + em, 1, 55e3))) return json({ error: "Ya te enviamos un código. Espera un minuto para pedir otro." }, 429);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    await env.DB.prepare("INSERT INTO codes (email, hash, expires, tries) VALUES (?, ?, ?, 0) ON CONFLICT(email) DO UPDATE SET hash = excluded.hash, expires = excluded.expires, tries = 0")
      .bind(em, await hashCode(env, em, code), Date.now() + LIMITS.codeMinutes * 60e3).run();
    if (env.DEV_CODES === "1") return json({ ok: true, dev_code: code });
    const sent = await sendMail(env, em, "Tu código de Vórtice VR: " + code, codeMail(code));
    if (!sent) return json({ error: "No pudimos enviar el correo. Intenta más tarde." }, 502);
    return json({ ok: true });
  }

  if (path === "/api/verify" && M === "POST") {
    const { email, code } = await request.json().catch(() => ({}));
    const em = normEmail(email);
    if (!em || !/^\d{6}$/.test(String(code || ""))) return json({ error: "Código incorrecto." }, 400);
    const row = await env.DB.prepare("SELECT * FROM codes WHERE email = ?").bind(em).first();
    if (!row || row.expires < Date.now()) return json({ error: "El código expiró. Pide uno nuevo." }, 400);
    if (row.tries >= LIMITS.codeTries) return json({ error: "Demasiados intentos. Pide un código nuevo." }, 429);
    if (row.hash !== (await hashCode(env, em, String(code)))) {
      await env.DB.prepare("UPDATE codes SET tries = tries + 1 WHERE email = ?").bind(em).run();
      return json({ error: "Código incorrecto." }, 400);
    }
    await env.DB.prepare("DELETE FROM codes WHERE email = ?").bind(em).run();
    const token = await sign(env, { e: em, x: Date.now() + 24 * 3600e3 });
    const exp = await env.DB.prepare("SELECT * FROM experiences WHERE email = ?").bind(em).first();
    return json({ token, email: em, experience: exp && exp.expires > Date.now() ? ownerExp(exp, request, env) : null });
  }

  // ---- signed-in ----
  const who = await auth(request, env);
  if (path === "/api/me" && M === "GET") {
    if (!who) return json({ error: "Inicia sesión de nuevo." }, 401);
    const exp = await env.DB.prepare("SELECT * FROM experiences WHERE email = ?").bind(who).first();
    return json({ email: who, experience: exp && exp.expires > Date.now() ? ownerExp(exp, request, env) : null });
  }
  if (path === "/api/me" && M === "DELETE") {
    if (!who) return json({ error: "Inicia sesión de nuevo." }, 401);
    const exp = await env.DB.prepare("SELECT slug FROM experiences WHERE email = ?").bind(who).first();
    if (exp) { await deleteMedia(env, exp.slug); await env.DB.prepare("DELETE FROM experiences WHERE slug = ?").bind(exp.slug).run(); }
    return json({ ok: true });
  }
  if (path === "/api/publish" && M === "POST") {
    if (!who) return json({ error: "Inicia sesión de nuevo." }, 401);
    if (!(await limit(env, "pub:" + who, 10, 3600e3))) return json({ error: "Demasiadas publicaciones seguidas. Espera un rato." }, 429);
    const form = await request.formData();
    let meta; try { meta = JSON.parse(form.get("meta") || "{}"); } catch { return json({ error: "Datos inválidos." }, 400); }
    const mine = await env.DB.prepare("SELECT * FROM experiences WHERE email = ?").bind(who).first();
    const slug = String(meta.slug || "").toLowerCase();
    const st = await slugStatus(env, slug, who);
    if (!st.ok) return json({ error: st.reason }, 400);
    const data = cleanMeta(meta);
    if (data.error) return json({ error: data.error }, 400);
    const video = form.get("video"), image = form.get("image"), target = form.get("target"), qr = form.get("qr");
    const isNew = !mine;
    if (isNew && (!video || !image || !target)) return json({ error: "Faltan la imagen o el video." }, 400);
    if (video && (video.size > LIMITS.videoBytes || !/^video\/(mp4|webm|quicktime)$/.test(video.type))) return json({ error: "El video debe ser MP4, WebM o MOV de máximo 25 MB." }, 400);
    if (image && (image.size > LIMITS.imageBytes || !/^image\/(jpeg|png|webp)$/.test(image.type))) return json({ error: "La imagen es demasiado grande." }, 400);
    if (target && target.size > LIMITS.targetBytes) return json({ error: "La imagen no se pudo preparar. Intenta con otra." }, 400);
    // one experience per account: changing the name moves the files
    if (mine && mine.slug !== slug) {
      for (const k of ["video", "target", "image"]) {
        const isReplaced = (k === "video" && video) || (k === "image" && image) || (k === "target" && target);
        if (!isReplaced) { const o = await env.MEDIA.get(`exp/${mine.slug}/${k}`); if (o) await env.MEDIA.put(`exp/${slug}/${k}`, o.body, { httpMetadata: o.httpMetadata }); }
      }
      await deleteMedia(env, mine.slug);
      await env.DB.prepare("DELETE FROM experiences WHERE slug = ?").bind(mine.slug).run();
    }
    if (video) await env.MEDIA.put(`exp/${slug}/video`, await video.arrayBuffer(), { httpMetadata: { contentType: video.type } });
    if (image) await env.MEDIA.put(`exp/${slug}/image`, await image.arrayBuffer(), { httpMetadata: { contentType: image.type } });
    if (target) await env.MEDIA.put(`exp/${slug}/target`, await target.arrayBuffer(), { httpMetadata: { contentType: "application/octet-stream" } });
    const now = Date.now();
    const created = mine && mine.slug === slug ? mine.created : now;
    const expires = mine ? mine.expires : now + LIMITS.days * 864e5;
    await env.DB.prepare("INSERT INTO experiences (slug, email, title, data, created, updated, expires, views) VALUES (?, ?, ?, ?, ?, ?, ?, 0) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, data = excluded.data, updated = excluded.updated")
      .bind(slug, who, data.title, JSON.stringify(data), created, now, expires).run();
    const row = await env.DB.prepare("SELECT * FROM experiences WHERE slug = ?").bind(slug).first();
    const out = ownerExp(row, request, env);
    if (meta.sendEmail !== false) ctx.waitUntil(sendMail(env, who, "Tu experiencia de realidad aumentada está lista", linkMail(out), qr && qr.size < 300e3 ? [{ filename: `QR-${slug}.png`, content: b64(await qr.arrayBuffer()) }] : undefined));
    return json({ ok: true, experience: out });
  }
  return json({ error: "No encontrado" }, 404);
}

function publicExp(row) {
  const d = JSON.parse(row.data || "{}");
  return { slug: row.slug, title: row.title, fit: d.fit, img: d.img, video: d.video, buttons: d.buttons, expires: row.expires };
}
function ownerExp(row, request, env) {
  return { ...publicExp(row), url: expUrl(row.slug, request, env), created: row.created, updated: row.updated, views: row.views };
}
function expUrl(slug, request, env) {
  const root = env.ROOT_DOMAIN || ROOT_DEFAULT;
  const host = new URL(request.url).host;
  if (host === root || host.endsWith("." + root) || host === "www." + root) return `https://${slug}.${root}/`;
  return `${new URL(request.url).origin}/e/${slug}/`; // previews and local tests
}
async function slugStatus(env, slug, owner) {
  if (!SLUG.test(slug)) return { ok: false, reason: "Usa de 3 a 30 letras minúsculas, números o guiones (sin acentos ni espacios)." };
  if (RESERVED.has(slug)) return { ok: false, reason: "Ese nombre está reservado." };
  const row = await env.DB.prepare("SELECT email, expires FROM experiences WHERE slug = ?").bind(slug).first();
  if (row && row.email !== owner && row.expires > Date.now()) return { ok: false, reason: "Ese nombre ya está ocupado." };
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
    env.DB.prepare("CREATE TABLE IF NOT EXISTS experiences (slug TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, title TEXT, data TEXT, created INTEGER, updated INTEGER, expires INTEGER, views INTEGER DEFAULT 0)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS codes (email TEXT PRIMARY KEY, hash TEXT, expires INTEGER, tries INTEGER DEFAULT 0)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS ratelimit (k TEXT PRIMARY KEY, n INTEGER, reset INTEGER)"),
  ]);
  schemaReady = true;
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
async function sign(env, obj) { const p = b64url(enc.encode(JSON.stringify(obj))); return `${p}.${await hmac(env, p)}`; }
async function auth(request, env) {
  const t = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const [p, s] = t.split(".");
  if (!p || !s || s !== (await hmac(env, p))) return null;
  try { const o = JSON.parse(new TextDecoder().decode(unb64url(p))); return o.x > Date.now() ? o.e : null; } catch { return null; }
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
<p style="color:#a99bcb;font-size:12px;margin-top:28px">Recibiste este correo porque lo pediste en vorticevr.mx/crear. Si no fuiste tú, ignóralo.</p></div>`;
const codeMail = code => shell(`<h1 style="font-size:20px">Tu código para crear tu experiencia</h1>
<p style="font-size:34px;font-weight:700;letter-spacing:.3em;color:#ffbe55;margin:18px 0">${code}</p><p>Vence en ${LIMITS.codeMinutes} minutos.</p>`);
const linkMail = e => shell(`<h1 style="font-size:20px">¡Tu experiencia de realidad aumentada está lista!</h1>
<p><b>${esc(e.title)}</b></p><p>Comparte este link (o el código QR adjunto):</p>
<p><a href="${esc(e.url)}" style="color:#ffbe55;font-size:20px;font-weight:700">${esc(e.url.replace(/^https:\/\//, "").replace(/\/$/, ""))}</a></p>
<p>Ábrelo en el celular, toca <b>Activar cámara</b> y apunta a tu imagen.</p>
<p>Para editarla o borrarla entra a <a href="https://vorticevr.mx/crear/" style="color:#d2b8ff">vorticevr.mx/crear</a>, toca <b>Mi experiencia</b> y escribe este correo.</p>
<p style="color:#a99bcb">Disponible hasta el ${new Date(e.expires).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}.</p>`);
