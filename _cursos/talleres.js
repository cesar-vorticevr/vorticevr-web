// Constancias de participación de los talleres (17 de noviembre de 2026, pedido de César).
// El admin crea un taller (concepto, fecha, horas; lugar y modalidad opcionales) y obtiene un link corto
// vorticevr.mx/constancia/<CÓDIGO> con QR. Cada participante entra con su cuenta y escribe su nombre completo
// (el link solo sirve desde el día del taller hasta el día siguiente, salvo que el admin lo abra o cierre a mano).
// El admin revisa la lista (corrige nombres, quita a quien no asistió, agrega a mano) y pulsa "Emitir": cada quien
// recibe su constancia con el folio de siempre (VVR-AAAA-NNNNNN, c_folios), en c_certificates con kind = 'taller',
// así la verificación pública, el PDF y "Revocar" de los cursos sirven igual. Los correos salen poco a poco
// (Resend gratis = 100 al día): hasta 25 al emitir y el resto en el cron de cada 15 minutos.
import { certificatePdf } from "./pdf.js";

const cut = (v, n) => String(v == null ? "" : v).trim().replace(/\s+/g, " ").slice(0, n);
const DAY = 864e5, MX = 6 * 3600e3;   // the center of Mexico is UTC−6 all year
const CODE_CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O, 1/I
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => CODE_CH[b % CODE_CH.length]).join("");
const dayStart = d => Date.parse(d + "T00:00:00Z") + MX;   // "2026-11-17" → 00:00 in Mexico
const MODS = ["presencial", "en_linea"];
const MAIL_NOW = 25, MAIL_TICK = 40;
// César's dedication in the certificate e-mail (each workshop can have its own; this one when it has none)
export const MAIL_MSG = "Gracias por darte el tiempo de aprender algo nuevo. La tecnología inmersiva ya no es el futuro: es una herramienta que hoy está en tus manos, y lo que hagas con ella depende de tu imaginación.\n\nMe dio mucho gusto compartir este taller contigo. Ojalá esta constancia sea el inicio de muchas experiencias que vas a crear; cuando tengas la primera, me encantará verla.";
const msgOf = t => (t && t.mail_msg && String(t.mail_msg).trim()) || MAIL_MSG;

export async function migrateTalleres(env) {
  const t = s => env.DB.prepare(s);
  await env.DB.batch([
    t("CREATE TABLE IF NOT EXISTS c_talleres (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, title TEXT, date TEXT, hours REAL, place TEXT, modality TEXT DEFAULT 'presencial', opens_at INTEGER, closes_at INTEGER, created_by INTEGER, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_taller_people (id TEXT PRIMARY KEY, taller_id TEXT NOT NULL, user_id INTEGER, email TEXT, name TEXT, status TEXT DEFAULT 'in', cert_id TEXT, mail_state TEXT, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE UNIQUE INDEX IF NOT EXISTS c_taller_people_user ON c_taller_people (taller_id, user_id) WHERE user_id IS NOT NULL"),
    t("CREATE INDEX IF NOT EXISTS c_taller_people_taller ON c_taller_people (taller_id)"),
  ]);
  // the place of the workshop on the certificate (courses leave it empty)
  const row = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'c_certificates'").first();
  if (row && !/\bplace\b/.test(row.sql)) {
    try { await env.DB.prepare("ALTER TABLE c_certificates ADD COLUMN place TEXT").run(); }
    catch (e) { console.error("migración talleres", e.message); }
  }
  // a workshop of several days (date = first day, date_end = last one) and whether the admin moved the sign-up window by hand
  const tr = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'c_talleres'").first();
  if (tr && !/\bdate_end\b/.test(tr.sql)) {
    try { await env.DB.batch(["date_end TEXT", "reg_manual INTEGER DEFAULT 0"].map(c => env.DB.prepare(`ALTER TABLE c_talleres ADD COLUMN ${c}`))); }
    catch (e) { console.error("migración talleres fechas", e.message); }
  }
  // the certificate's design of each workshop (logos and signatures), copied into each certificate when it is issued
  const tr2 = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'c_talleres'").first();
  if (tr2 && !/\bdesign\b/.test(tr2.sql)) {
    try { await env.DB.prepare("ALTER TABLE c_talleres ADD COLUMN design TEXT").run(); } catch (e) { console.error("migración talleres diseño", e.message); }
  }
  // César's dedication in the e-mail of each workshop
  if (tr2 && !/\bmail_msg\b/.test(tr2.sql)) {
    try { await env.DB.prepare("ALTER TABLE c_talleres ADD COLUMN mail_msg TEXT").run(); } catch (e) { console.error("migración talleres mensaje", e.message); }
  }
  const cr = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'c_certificates'").first();
  if (cr && !/\bdesign\b/.test(cr.sql)) {
    try { await env.DB.prepare("ALTER TABLE c_certificates ADD COLUMN design TEXT").run(); } catch (e) { console.error("migración constancias diseño", e.message); }
  }
}

// ---------- the certificate's design: Vórtice VR's logo on/off, César's signature on/off, up to 3 more logos and signatures ----------
// The images are prepared in the admin's browser (cursos/admin/talleres.js) as the PDF wants them ({w, h, rgb, alpha}:
// zlib + base64) and stored in R2 next to a PNG to show them: cursos/talleres/<taller>/<k>.json and .png. They are
// never deleted, so an issued certificate (which keeps its own copy of the design) always finds its images.
const KEY = /^[a-f0-9]{12}$/;
const assetKey = (tid, k, ext) => `cursos/talleres/${tid}/${k}.${ext}`;
export const designOf = t => { try { const d = JSON.parse(t.design || "null"); if (d) return d; } catch {} return { vvr: true, cesar: true, logos: [], signers: [] }; };
async function cleanDesign(env, tid, d) {
  if (!d || typeof d !== "object") return { error: "Diseño inválido." };
  const logos = Array.isArray(d.logos) ? d.logos.slice(0, 3) : [], signers = Array.isArray(d.signers) ? d.signers.slice(0, 3) : [];
  const out = { vvr: d.vvr !== false, cesar: d.cesar !== false, logos: [], signers: [] };
  for (const l of logos) {
    if (!KEY.test(String(l && l.k)) || !(await env.MEDIA.head(assetKey(tid, l.k, "json")))) return { error: "Uno de los logos no se subió bien. Súbelo otra vez." };
    out.logos.push({ k: l.k });
  }
  for (const g of signers) {
    const name = cut(g && g.name, 80), title = cut(g && g.title, 80);
    if (name.length < 3) return { error: "Escribe el nombre de quien firma." };
    if (g.k && (!KEY.test(String(g.k)) || !(await env.MEDIA.head(assetKey(tid, g.k, "json"))))) return { error: "Una de las firmas no se subió bien. Súbela otra vez." };
    out.signers.push({ name, title, ...(g.k ? { k: g.k } : {}) });
  }
  return { design: out };
}
// what the PDF needs: the design with its images read from R2 (an empty object for courses and old certificates)
export async function loadDesign(env, json) {
  let d; try { d = JSON.parse(json || "null"); } catch {}
  if (!d || !d.t) return {};
  const read = async k => { const o = await env.MEDIA.get(assetKey(d.t, k, "json")); return o ? o.json() : null; };
  return {
    vvrLogo: d.vvr !== false, cesar: d.cesar !== false,
    logos: (await Promise.all((d.logos || []).map(l => read(l.k)))).filter(Boolean),
    signers: await Promise.all((d.signers || []).map(async g => ({ name: g.name, title: g.title, img: g.k ? await read(g.k) : null }))),
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function cleanTaller(b, old = {}) {
  const title = b.title !== undefined ? cut(b.title, 140) : old.title;
  const date = b.date !== undefined ? String(b.date || "") : old.date;
  let end = b.date_end !== undefined ? String(b.date_end || "") : old.date_end || "";
  const hours = b.hours !== undefined ? Math.round(Number(b.hours) * 2) / 2 : old.hours;
  const place = b.place !== undefined ? cut(b.place, 120) : old.place || "";
  const modality = b.modality !== undefined ? (MODS.includes(b.modality) ? b.modality : "presencial") : old.modality || "presencial";
  if (!title || title.length < 4) return { error: "Escribe el concepto del taller." };
  if (!DATE.test(date) || isNaN(dayStart(date))) return { error: "Elige la fecha en que se impartió el taller." };
  if (end === date) end = "";
  if (end && (!DATE.test(end) || isNaN(dayStart(end)))) return { error: "El último día no es una fecha válida." };
  if (end && end < date) return { error: "El último día no puede ser antes del primero." };
  if (end && dayStart(end) - dayStart(date) > 366 * DAY) return { error: "Un taller no puede durar más de un año." };
  if (!(hours >= 0.5 && hours <= 200)) return { error: "Las horas van de 0.5 a 200." };
  return { title, date, date_end: end || null, hours, place, modality };
}
// the sign-up opens as soon as the workshop is created (also for one given days ago) and closes 2 days after
// its last day, or 2 days after it was created if that is later; "Cerrar" / "Abrir 24 horas" override it
const windowOf = (c, now) => ({ opens: Math.min(now, dayStart(c.date)), closes: Math.max(dayStart(c.date_end || c.date) + 2 * DAY, now + 2 * DAY) });
const isOpen = (t, now = Date.now()) => now >= t.opens_at && now < t.closes_at;
const publicTaller = t => {
  const d = designOf(t);   // for the participant's preview: the logos (public) and who signs (names only, never the signatures)
  return { code: t.code, title: t.title, date: t.date, date_end: t.date_end || "", period: periodoDe(t), hours: t.hours, place: t.place || "", modality: t.modality, opens_at: t.opens_at, closes_at: t.closes_at, open: isOpen(t),
    design: { vvr: d.vvr !== false, cesar: d.cesar !== false, logos: d.logos.map(l => `/api/cursos/taller/${t.code}/logo/${l.k}.png`), signers: d.signers.map(g => ({ name: g.name, title: g.title })) } };
};
const parts = d => { const [y, m, dd] = d.split("-").map(Number); return { y, m, d: dd }; };
const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// "17 de noviembre de 2026", "del 10 al 14 de noviembre de 2026", "del 28 de octubre al 3 de noviembre de 2026"…
export function periodoDe(t) {
  const a = parts(t.date);
  if (!t.date_end || t.date_end === t.date) return `${a.d} de ${MES[a.m - 1]} de ${a.y}`;
  const b = parts(t.date_end);
  if (a.y !== b.y) return `del ${a.d} de ${MES[a.m - 1]} de ${a.y} al ${b.d} de ${MES[b.m - 1]} de ${b.y}`;
  if (a.m !== b.m) return `del ${a.d} de ${MES[a.m - 1]} al ${b.d} de ${MES[b.m - 1]} de ${b.y}`;
  return `del ${a.d} al ${b.d} de ${MES[b.m - 1]} de ${b.y}`;
}

export async function talleresApi(request, env, ctx, url, path, h, user, LIB) {
  if (!path.startsWith("/api/cursos/taller/") && !path.startsWith("/api/cursos/admin/talleres") && path !== "/api/cursos/talleres/mias") return null;
  const M = request.method, { json } = h, now = Date.now();
  const body = async () => { try { return await request.json(); } catch { return {}; } };
  let m;

  // ---------- participants ----------
  if ((m = path.match(/^\/api\/cursos\/taller\/([A-Z0-9]{4,10})$/i)) && M === "GET") {
    const t = await env.DB.prepare("SELECT * FROM c_talleres WHERE code = ?").bind(m[1].toUpperCase()).first();
    if (!t) return json({ error: "No encontramos este taller. Revisa el link o el código." }, 404);
    let me = null;
    if (user) {
      const p = await env.DB.prepare("SELECT p.name, p.status, k.folio, k.verify_token, k.revoked FROM c_taller_people p LEFT JOIN c_certificates k ON k.id = p.cert_id WHERE p.taller_id = ? AND p.user_id = ?").bind(t.id, user.id).first();
      me = p ? { name: p.name, status: p.status, cert: p.folio ? { folio: p.folio, token: p.verify_token, revoked: !!p.revoked } : null } : null;
    }
    return json({ taller: publicTaller(t), signedIn: !!user, accountName: user ? user.name || "" : "", me });
  }
  // the workshop's logos for the participant's preview (only the logos of its design; signatures are never public)
  if ((m = path.match(/^\/api\/cursos\/taller\/([A-Z0-9]{4,10})\/logo\/([a-f0-9]{12})\.png$/i)) && M === "GET") {
    const t = await env.DB.prepare("SELECT id, design FROM c_talleres WHERE code = ?").bind(m[1].toUpperCase()).first();
    if (!t || !designOf(t).logos.some(l => l.k === m[2])) return json({ error: "No existe." }, 404);
    const o = await env.MEDIA.get(assetKey(t.id, m[2], "png"));
    return o ? new Response(o.body, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } }) : json({ error: "No existe." }, 404);
  }
  if ((m = path.match(/^\/api\/cursos\/taller\/([A-Z0-9]{4,10})\/unirme$/i)) && M === "POST") {
    if (!user) return json({ error: "Entra a tu cuenta para pedir tu constancia." }, 401);
    if (!(await h.limit(env, `taller:${user.id}`, 30, 3600e3))) return json({ error: "Demasiados intentos. Espera un rato." }, 429);
    const t = await env.DB.prepare("SELECT * FROM c_talleres WHERE code = ?").bind(m[1].toUpperCase()).first();
    if (!t) return json({ error: "No encontramos este taller." }, 404);
    const name = cut((await body()).name, 90);
    if (name.length < 5 || !/\S+\s+\S+/.test(name)) return json({ error: "Escribe tu nombre completo, con apellidos, tal como debe salir en la constancia." }, 400);
    const p = await env.DB.prepare("SELECT * FROM c_taller_people WHERE taller_id = ? AND user_id = ?").bind(t.id, user.id).first();
    if (p && p.cert_id) return json({ error: "Tu constancia ya se emitió; tu nombre ya no se puede cambiar. Si tiene un error, escríbenos a hola@vorticevr.mx." }, 409);
    if (!isOpen(t, now) && !(p && p.status === "in")) return json({ error: now < t.opens_at ? "El registro se abre el día del taller." : "El registro de este taller ya cerró." }, 410);
    if (p && p.status === "out") return json({ error: "No apareces en la lista de este taller. Si fue un error, avísale a quien lo impartió." }, 403);
    if (p) await env.DB.prepare("UPDATE c_taller_people SET name = ?, updated_at = ? WHERE id = ?").bind(name, now, p.id).run();
    else await env.DB.prepare("INSERT INTO c_taller_people (id, taller_id, user_id, email, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'in', ?, ?)").bind(LIB.uid(), t.id, user.id, user.email, name, now, now).run();
    return json({ ok: true, name });
  }
  // My learning: my workshop certificates
  if (path === "/api/cursos/talleres/mias" && M === "GET") {
    if (!user) return json({ error: "Inicia sesión." }, 401);
    const { results } = await env.DB.prepare("SELECT folio, verify_token, revoked, course_title, period FROM c_certificates WHERE student_id = ? AND kind = 'taller' ORDER BY issued_at DESC LIMIT 100").bind(user.id).all();
    return json({ list: results.map(k => ({ folio: k.folio, token: k.verify_token, revoked: !!k.revoked, title: k.course_title, period: k.period })) });
  }

  // ---------- admin ----------
  if (!path.startsWith("/api/cursos/admin/talleres")) return null;
  if (!h.isAdmin(env, user)) return json({ error: "No tienes acceso." }, 403);
  const people = id => env.DB.prepare(`SELECT p.id, p.name, p.email, p.status, p.user_id, p.created_at, p.mail_state, k.folio, k.verify_token, k.revoked FROM c_taller_people p LEFT JOIN c_certificates k ON k.id = p.cert_id
    WHERE p.taller_id = ? ORDER BY p.created_at`).bind(id).all().then(r => r.results);

  if (path === "/api/cursos/admin/talleres" && M === "GET") {
    const { results } = await env.DB.prepare(`SELECT t.*, (SELECT COUNT(*) FROM c_taller_people p WHERE p.taller_id = t.id AND p.status = 'in') AS n,
      (SELECT COUNT(*) FROM c_taller_people p WHERE p.taller_id = t.id AND p.cert_id IS NOT NULL) AS issued FROM c_talleres t ORDER BY t.date DESC, t.created_at DESC LIMIT 200`).all();
    return json({ list: results.map(t => ({ ...publicTaller(t), id: t.id, n: t.n, issued: t.issued })) });
  }
  if (path === "/api/cursos/admin/talleres" && M === "POST") {
    const c = cleanTaller(await body());
    if (c.error) return json(c, 400);
    let code = newCode();
    for (let i = 0; i < 5 && (await env.DB.prepare("SELECT 1 FROM c_talleres WHERE code = ?").bind(code).first()); i++) code = newCode();
    const id = LIB.uid(), w = windowOf(c, now);
    await env.DB.prepare("INSERT INTO c_talleres (id, code, title, date, date_end, hours, place, modality, opens_at, closes_at, reg_manual, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)")
      .bind(id, code, c.title, c.date, c.date_end, c.hours, c.place, c.modality, w.opens, w.closes, user.id, now, now).run();
    return json({ ok: true, id, code });
  }
  const tid = path.match(/^\/api\/cursos\/admin\/talleres\/([0-9a-f-]{36})/);
  const t = tid ? await env.DB.prepare("SELECT * FROM c_talleres WHERE id = ?").bind(tid[1]).first() : null;
  if (tid && !t) return json({ error: "No existe ese taller." }, 404);

  if (t && path === `/api/cursos/admin/talleres/${t.id}` && M === "GET") {
    return json({ taller: { ...publicTaller(t), id: t.id, design: designOf(t), mail_msg: msgOf(t), mail_default: !(t.mail_msg && String(t.mail_msg).trim()) }, people: await people(t.id) });
  }
  // a logo or a signature, already prepared by the browser: data = {w, h, rgb, alpha?} for the PDF and png to show it
  if (t && path === `/api/cursos/admin/talleres/${t.id}/archivo` && M === "POST") {
    let fd; try { fd = await request.formData(); } catch { return json({ error: "No llegó el archivo." }, 400); }
    const raw = String(fd.get("data") || ""), png = fd.get("png");
    if (raw.length > 3e6 || !png || typeof png === "string" || png.size > 2e6) return json({ error: "La imagen es muy pesada. Prueba con una más chica." }, 413);
    let d; try { d = JSON.parse(raw); } catch { return json({ error: "La imagen no se pudo leer." }, 400); }
    const B64 = /^[A-Za-z0-9+/]+=*$/;
    if (!(Number.isInteger(d.w) && Number.isInteger(d.h) && d.w > 0 && d.h > 0 && d.w <= 1600 && d.h <= 1600) || !B64.test(d.rgb || "") || (d.alpha && !B64.test(d.alpha))) return json({ error: "La imagen no se pudo leer." }, 400);
    const k = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, "0")).join("");
    await env.MEDIA.put(assetKey(t.id, k, "json"), JSON.stringify({ w: d.w, h: d.h, rgb: d.rgb, ...(d.alpha ? { alpha: d.alpha } : {}) }), { httpMetadata: { contentType: "application/json" } });
    await env.MEDIA.put(assetKey(t.id, k, "png"), await png.arrayBuffer(), { httpMetadata: { contentType: "image/png" } });
    return json({ ok: true, k });
  }
  if (t && (m = path.match(/^\/api\/cursos\/admin\/talleres\/[0-9a-f-]{36}\/img\/([a-f0-9]{12})\.png$/)) && M === "GET") {
    const o = await env.MEDIA.get(assetKey(t.id, m[1], "png"));
    return o ? new Response(o.body, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" } }) : json({ error: "No existe." }, 404);
  }
  // a sample certificate with this workshop's data and design, to see it before issuing
  if (t && path === `/api/cursos/admin/talleres/${t.id}/muestra.pdf` && M === "GET") {
    const k = { folio: "VVR-0000-000000", issued_at: now, student_name: "Nombre Apellido Apellido", course_title: t.title, hours: t.hours, modality: t.modality, period: periodoDe(t), place: t.place || "", kind: "taller", verify_token: "muestra", instructor_name: "Vórtice VR" };
    const pdf = certificatePdf({ ...LIB.certData(k, await LIB.settings(env), LIB.baseUrl(env, url)), ...(await loadDesign(env, JSON.stringify({ t: t.id, ...designOf(t) }))) });
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="Constancia de muestra.pdf"', "Cache-Control": "no-store" } });
  }
  if (t && path === `/api/cursos/admin/talleres/${t.id}` && M === "POST") {
    const b = await body();
    if (b.design !== undefined) {   // only the design (it applies to the certificates issued from now on)
      const r = await cleanDesign(env, t.id, b.design);
      if (r.error) return json(r, 400);
      await env.DB.prepare("UPDATE c_talleres SET design = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(r.design), now, t.id).run();
      return json({ ok: true, design: r.design });
    }
    if (b.mail_msg !== undefined) {   // the dedication of the e-mail (empty = the default one)
      const msg = String(b.mail_msg || "").replace(/\r/g, "").trim().slice(0, 1500);
      await env.DB.prepare("UPDATE c_talleres SET mail_msg = ?, updated_at = ? WHERE id = ?").bind(msg && msg !== MAIL_MSG ? msg : null, now, t.id).run();
      return json({ ok: true, mail_msg: msg || MAIL_MSG });
    }
    if (b.registro === "cerrar") { await env.DB.prepare("UPDATE c_talleres SET closes_at = ?, reg_manual = 1, updated_at = ? WHERE id = ?").bind(now, now, t.id).run(); return json({ ok: true }); }
    if (b.registro === "abrir") {   // 24 hours more from now
      await env.DB.prepare("UPDATE c_talleres SET opens_at = MIN(opens_at, ?), closes_at = ?, reg_manual = 1, updated_at = ? WHERE id = ?").bind(now, now + DAY, now, t.id).run(); return json({ ok: true });
    }
    const c = cleanTaller(b, t);
    if (c.error) return json(c, 400);
    // new dates move the window (unless the admin opened or closed it by hand); it never closes earlier than it was
    let opens = t.opens_at, closes = t.closes_at;
    if (!t.reg_manual && (c.date !== t.date || (c.date_end || null) !== (t.date_end || null))) { const w = windowOf(c, now); opens = Math.min(t.opens_at, w.opens); closes = Math.max(w.closes, Math.min(t.closes_at, now + 2 * DAY)); }
    await env.DB.prepare("UPDATE c_talleres SET title = ?, date = ?, date_end = ?, hours = ?, place = ?, modality = ?, opens_at = ?, closes_at = ?, updated_at = ? WHERE id = ?")
      .bind(c.title, c.date, c.date_end, c.hours, c.place, c.modality, opens, closes, now, t.id).run();
    return json({ ok: true });
  }
  if (t && path === `/api/cursos/admin/talleres/${t.id}` && M === "DELETE") {
    const k = await env.DB.prepare("SELECT 1 FROM c_taller_people WHERE taller_id = ? AND cert_id IS NOT NULL").bind(t.id).first();
    if (k) return json({ error: "Este taller ya tiene constancias emitidas: no se puede borrar (puedes revocarlas en Constancias)." }, 409);
    await env.DB.batch([env.DB.prepare("DELETE FROM c_taller_people WHERE taller_id = ?").bind(t.id), env.DB.prepare("DELETE FROM c_talleres WHERE id = ?").bind(t.id)]);
    return json({ ok: true });
  }
  // add someone by hand (no phone, no account): name and, optionally, their e-mail for the PDF
  if (t && path === `/api/cursos/admin/talleres/${t.id}/personas` && M === "POST") {
    const b = await body(), name = cut(b.name, 90), email = cut(b.email, 120).toLowerCase();
    if (name.length < 5) return json({ error: "Escribe el nombre completo." }, 400);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Ese correo no se ve bien." }, 400);
    const u = email ? await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first() : null;
    if (u && (await env.DB.prepare("SELECT 1 FROM c_taller_people WHERE taller_id = ? AND user_id = ?").bind(t.id, u.id).first())) return json({ error: "Esa cuenta ya está en la lista." }, 409);
    await env.DB.prepare("INSERT INTO c_taller_people (id, taller_id, user_id, email, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'in', ?, ?)").bind(LIB.uid(), t.id, u ? u.id : null, email || null, name, now, now).run();
    return json({ ok: true });
  }
  if ((m = path.match(/^\/api\/cursos\/admin\/talleres\/persona\/([0-9a-f-]{36})$/)) && M === "POST") {
    const p = await env.DB.prepare("SELECT * FROM c_taller_people WHERE id = ?").bind(m[1]).first();
    if (!p) return json({ error: "No existe." }, 404);
    // an issued one is fixed; once revoked (Constancias → Revocar) the person goes back to "to issue" with the name corrected
    const k = p.cert_id ? await env.DB.prepare("SELECT revoked FROM c_certificates WHERE id = ?").bind(p.cert_id).first() : null;
    if (k && !k.revoked) return json({ error: "Su constancia ya se emitió. Para corregirla, revócala en Constancias y después corrige el nombre aquí." }, 409);
    const b = await body();
    const name = b.name !== undefined ? cut(b.name, 90) : p.name, status = b.out === undefined ? p.status : b.out ? "out" : "in";
    if (name.length < 5) return json({ error: "Escribe el nombre completo." }, 400);
    await env.DB.prepare("UPDATE c_taller_people SET name = ?, status = ?, cert_id = NULL, mail_state = NULL, updated_at = ? WHERE id = ?").bind(name, status, now, p.id).run();
    return json({ ok: true });
  }
  // send the certificate e-mail again: to everyone with an issued (not revoked) certificate and an e-mail, or to one person
  if (t && path === `/api/cursos/admin/talleres/${t.id}/reenviar` && M === "POST") {
    const b = await body(), one = b.person ? String(b.person) : null;
    const r = await env.DB.prepare(`UPDATE c_taller_people SET mail_state = 'pending', updated_at = ? WHERE taller_id = ? AND status = 'in' AND email IS NOT NULL AND email <> ''
      AND cert_id IN (SELECT id FROM c_certificates WHERE revoked = 0 OR revoked IS NULL)${one ? " AND id = ?" : ""}`).bind(...[now, t.id, ...(one ? [one] : [])]).run();
    const n = (r.meta && r.meta.changes) || 0;
    if (!n) return json({ error: one ? "No se puede reenviar: no tiene correo o su constancia no está emitida." : "No hay a quién reenviarle: nadie con constancia emitida y correo." }, 400);
    ctx.waitUntil(sendPending(env, h, LIB, url, MAIL_NOW).catch(e => console.error("talleres correo", e.message)));
    return json({ ok: true, mails: n });
  }
  // issue: everyone on the list without a certificate yet (can be pressed again for late additions)
  if (t && path === `/api/cursos/admin/talleres/${t.id}/emitir` && M === "POST") {
    const mail = (await body()).mail !== false;
    const { results } = await env.DB.prepare("SELECT * FROM c_taller_people WHERE taller_id = ? AND status = 'in' AND cert_id IS NULL").bind(t.id).all();
    if (!results.length) return json({ error: "No hay a quién emitirle: todos los de la lista ya tienen su constancia." }, 400);
    const year = Number(new Date(now - MX).toISOString().slice(0, 4));
    const last = await env.DB.prepare("INSERT INTO c_folios (year, n) VALUES (?, ?) ON CONFLICT(year) DO UPDATE SET n = n + ? RETURNING n").bind(year, results.length, results.length).first();
    let n = last.n - results.length;   // a block of consecutive folios, taken in one statement
    const st = [], period = periodoDe(t), design = JSON.stringify({ t: t.id, ...designOf(t) });   // each certificate keeps the design it was issued with
    for (const p of results) {
      const id = LIB.uid(), tk = LIB.token(), folio = `VVR-${year}-${String(++n).padStart(6, "0")}`;
      st.push(env.DB.prepare(`INSERT INTO c_certificates (id, enrollment_id, student_id, course_id, edition_id, kind, folio, issued_at, pdf_url, verify_token, student_name, course_title, hours, modality, period, instructor_name, course_key, objectives, place, design, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, 'taller', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Vórtice VR', '', '', ?, ?, ?, ?)`).bind(id, "taller:" + p.id, p.user_id, "taller:" + t.id, folio, now, `/api/cursos/constancia/${tk}.pdf`, tk, p.name, t.title, t.hours, t.modality, period, t.place || "", design, now, now));
      st.push(env.DB.prepare("UPDATE c_taller_people SET cert_id = ?, mail_state = ?, updated_at = ? WHERE id = ?").bind(id, mail && p.email ? "pending" : null, now, p.id));
    }
    await env.DB.batch(st);
    if (mail) ctx.waitUntil(sendPending(env, h, LIB, url, MAIL_NOW).catch(e => console.error("talleres correo", e.message)));
    const queued = mail ? results.filter(p => p.email).length : 0;
    return json({ ok: true, issued: results.length, mails: queued });
  }
  return json({ error: "No encontrado" }, 404);
}

// the e-mails with the PDF, a few at a time (also from the 15-minute cron)
export async function sendPending(env, h, LIB, url, max = MAIL_TICK) {
  const now = Date.now();
  // one that got stuck half-way (the Worker stopped while sending) goes back to the line after 10 minutes
  await env.DB.prepare("UPDATE c_taller_people SET mail_state = 'pending' WHERE mail_state = 'sending' AND updated_at < ?").bind(now - 600e3).run();
  // ojo: k.* also has an "id" (the certificate's); the person's goes as pid
  const { results } = await env.DB.prepare(`SELECT k.*, p.id AS pid, p.email AS pemail, t.mail_msg AS tmsg FROM c_taller_people p JOIN c_certificates k ON k.id = p.cert_id
    LEFT JOIN c_talleres t ON t.id = p.taller_id WHERE p.mail_state = 'pending' ORDER BY p.updated_at LIMIT ?`).bind(max).all();
  if (!results.length) return 0;
  const s = await LIB.settings(env), base = LIB.baseUrl(env, url);
  let sent = 0;
  for (const k of results) {
    // claim it first, so the cron and the button never send the same one twice
    const claim = await env.DB.prepare("UPDATE c_taller_people SET mail_state = 'sending', updated_at = ? WHERE id = ? AND mail_state = 'pending'").bind(Date.now(), k.pid).run();
    if (!claim.meta || !claim.meta.changes) continue;
    let ok = false;
    try {
      const pdf = certificatePdf({ ...LIB.certData(k, s, base), ...(await loadDesign(env, k.design)) });
      let bin = ""; for (let i = 0; i < pdf.length; i += 0x8000) bin += String.fromCharCode.apply(null, pdf.subarray(i, i + 0x8000));
      ok = await h.sendMail(env, k.pemail, `Tu constancia del taller "${k.course_title}"`, certMail(h, k, base, msgOf({ mail_msg: k.tmsg })),
        [{ filename: `Constancia ${k.folio}.pdf`, content: btoa(bin) }], env.CONTACT_TO || "hola@vorticevr.mx");
    } catch (e) { console.error("talleres correo", k.folio, e.message); }
    await env.DB.prepare("UPDATE c_taller_people SET mail_state = ?, updated_at = ? WHERE id = ?").bind(ok ? "sent" : "pending", Date.now(), k.pid).run();
    if (!ok) break;   // Resend is out of quota or down: the cron tries again later
    sent++;
    await new Promise(r => setTimeout(r, 550));   // Resend: 2 per second
  }
  return sent;
}

// the e-mail: César's dedication (signed by him), the workshop's data, the PDF attached and its verification
function certMail(h, k, base, msg) {
  const first = String(k.student_name || "").trim().split(/\s+/)[0] || "";
  const verify = `${base}/verificar/${k.verify_token}`;
  const paras = msg.split(/\n{2,}/).map(p => `<p style="margin:0 0 12px;line-height:1.6">${h.esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return h.shell(`<h1 style="font-size:22px;margin:14px 0 6px">¡Felicidades, ${h.esc(first)}!</h1>
    <p style="margin:0 0 18px;color:#d2b8ff">Tu constancia del taller <b style="color:#fff">${h.esc(k.course_title)}</b> ya está lista.</p>
    <div style="border-left:3px solid #ffbe55;background:#1b0a36;border-radius:0 12px 12px 0;padding:16px 18px;margin:0 0 18px">${paras}
      <p style="margin:14px 0 0;font-family:Georgia,serif;font-style:italic;color:#ffbe55">Mtro. César Adrián García Martínez</p><p style="margin:2px 0 0;font-size:12px;color:#a99bcb">Vórtice VR</p></div>
    <table style="font-size:14px;color:#f2ecff;margin:0 0 6px" cellpadding="3"><tr><td style="color:#a99bcb">Participante</td><td><b>${h.esc(k.student_name)}</b></td></tr>
      <tr><td style="color:#a99bcb">Fecha</td><td>${h.esc(k.period || "")}</td></tr><tr><td style="color:#a99bcb">Folio</td><td style="font-family:monospace">${h.esc(k.folio)}</td></tr></table>
    <p style="font-size:14px">Te la adjuntamos en PDF. Cualquiera puede comprobar que es auténtica en su página de verificación o con el código QR de la constancia.</p>${h.btnMail(verify, "Ver mi constancia")}`,
    "Recibiste este correo porque participaste en un taller de Vórtice VR. Si respondes, le llega a nuestro equipo.");
}
