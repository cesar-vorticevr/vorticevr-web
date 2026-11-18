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
}

function cleanTaller(b, old = {}) {
  const title = b.title !== undefined ? cut(b.title, 140) : old.title;
  const date = b.date !== undefined ? String(b.date || "") : old.date;
  const hours = b.hours !== undefined ? Math.round(Number(b.hours) * 2) / 2 : old.hours;
  const place = b.place !== undefined ? cut(b.place, 120) : old.place || "";
  const modality = b.modality !== undefined ? (MODS.includes(b.modality) ? b.modality : "presencial") : old.modality || "presencial";
  if (!title || title.length < 4) return { error: "Escribe el concepto del taller." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(dayStart(date))) return { error: "Elige la fecha del taller." };
  if (!(hours >= 0.5 && hours <= 200)) return { error: "Las horas van de 0.5 a 200." };
  return { title, date, hours, place, modality };
}
const isOpen = (t, now = Date.now()) => now >= t.opens_at && now < t.closes_at;
const publicTaller = t => ({ code: t.code, title: t.title, date: t.date, hours: t.hours, place: t.place || "", modality: t.modality, opens_at: t.opens_at, closes_at: t.closes_at, open: isOpen(t) });
const fechaDe = d => new Date(dayStart(d) + MX).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

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
    const id = LIB.uid(), opens = dayStart(c.date), closes = opens + 2 * DAY;   // the day of the workshop and the next one
    await env.DB.prepare("INSERT INTO c_talleres (id, code, title, date, hours, place, modality, opens_at, closes_at, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, code, c.title, c.date, c.hours, c.place, c.modality, opens, closes, user.id, now, now).run();
    return json({ ok: true, id, code });
  }
  const tid = path.match(/^\/api\/cursos\/admin\/talleres\/([0-9a-f-]{36})/);
  const t = tid ? await env.DB.prepare("SELECT * FROM c_talleres WHERE id = ?").bind(tid[1]).first() : null;
  if (tid && !t) return json({ error: "No existe ese taller." }, 404);

  if (t && path === `/api/cursos/admin/talleres/${t.id}` && M === "GET") {
    return json({ taller: { ...publicTaller(t), id: t.id }, people: await people(t.id) });
  }
  if (t && path === `/api/cursos/admin/talleres/${t.id}` && M === "POST") {
    const b = await body();
    if (b.registro === "cerrar") { await env.DB.prepare("UPDATE c_talleres SET closes_at = ?, updated_at = ? WHERE id = ?").bind(now, now, t.id).run(); return json({ ok: true }); }
    if (b.registro === "abrir") {   // 24 hours more from now (also before the day of the workshop)
      await env.DB.prepare("UPDATE c_talleres SET opens_at = MIN(opens_at, ?), closes_at = ?, updated_at = ? WHERE id = ?").bind(now, now + DAY, now, t.id).run(); return json({ ok: true });
    }
    const c = cleanTaller(b, t);
    if (c.error) return json(c, 400);
    // a new date moves the window (only while it was the automatic one)
    const auto = t.opens_at === dayStart(t.date) && t.closes_at === dayStart(t.date) + 2 * DAY;
    const opens = auto && c.date !== t.date ? dayStart(c.date) : t.opens_at, closes = auto && c.date !== t.date ? dayStart(c.date) + 2 * DAY : t.closes_at;
    await env.DB.prepare("UPDATE c_talleres SET title = ?, date = ?, hours = ?, place = ?, modality = ?, opens_at = ?, closes_at = ?, updated_at = ? WHERE id = ?")
      .bind(c.title, c.date, c.hours, c.place, c.modality, opens, closes, now, t.id).run();
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
  // issue: everyone on the list without a certificate yet (can be pressed again for late additions)
  if (t && path === `/api/cursos/admin/talleres/${t.id}/emitir` && M === "POST") {
    const mail = (await body()).mail !== false;
    const { results } = await env.DB.prepare("SELECT * FROM c_taller_people WHERE taller_id = ? AND status = 'in' AND cert_id IS NULL").bind(t.id).all();
    if (!results.length) return json({ error: "No hay a quién emitirle: todos los de la lista ya tienen su constancia." }, 400);
    const year = Number(new Date(now - MX).toISOString().slice(0, 4));
    const last = await env.DB.prepare("INSERT INTO c_folios (year, n) VALUES (?, ?) ON CONFLICT(year) DO UPDATE SET n = n + ? RETURNING n").bind(year, results.length, results.length).first();
    let n = last.n - results.length;   // a block of consecutive folios, taken in one statement
    const st = [], period = fechaDe(t.date);
    for (const p of results) {
      const id = LIB.uid(), tk = LIB.token(), folio = `VVR-${year}-${String(++n).padStart(6, "0")}`;
      st.push(env.DB.prepare(`INSERT INTO c_certificates (id, enrollment_id, student_id, course_id, edition_id, kind, folio, issued_at, pdf_url, verify_token, student_name, course_title, hours, modality, period, instructor_name, course_key, objectives, place, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, 'taller', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Vórtice VR', '', '', ?, ?, ?)`).bind(id, "taller:" + p.id, p.user_id, "taller:" + t.id, folio, now, `/api/cursos/constancia/${tk}.pdf`, tk, p.name, t.title, t.hours, t.modality, period, t.place || "", now, now));
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
  const { results } = await env.DB.prepare(`SELECT p.id, p.email, k.* FROM c_taller_people p JOIN c_certificates k ON k.id = p.cert_id WHERE p.mail_state = 'pending' ORDER BY p.updated_at LIMIT ?`).bind(max).all();
  if (!results.length) return 0;
  const s = await LIB.settings(env), base = LIB.baseUrl(env, url);
  let sent = 0;
  for (const k of results) {
    // claim it first, so the cron and the button never send the same one twice
    const claim = await env.DB.prepare("UPDATE c_taller_people SET mail_state = 'sending' WHERE id = ? AND mail_state = 'pending'").bind(k.id).run();
    if (!claim.meta || !claim.meta.changes) continue;
    const pdf = certificatePdf(LIB.certData(k, s, base));
    let bin = ""; for (let i = 0; i < pdf.length; i += 0x8000) bin += String.fromCharCode.apply(null, pdf.subarray(i, i + 0x8000));
    const verify = `${base}/verificar/${k.verify_token}`;
    const ok = await h.sendMail(env, k.email, `Tu constancia del taller "${k.course_title}"`, h.shell(`<h1 style="font-size:20px">¡Gracias por participar, ${h.esc(k.student_name)}!</h1>
      <p>Te adjuntamos tu constancia de participación en el taller <b>${h.esc(k.course_title)}</b> (${h.esc(k.period)}), con folio <b>${k.folio}</b>.</p>
      <p>Cualquiera puede comprobar que es auténtica en su página de verificación (también con el código QR de la constancia).</p>${h.btnMail(verify, "Ver mi constancia")}`,
      "Recibiste este correo porque participaste en un taller de Vórtice VR."), [{ filename: `Constancia ${k.folio}.pdf`, content: btoa(bin) }]);
    await env.DB.prepare("UPDATE c_taller_people SET mail_state = ? WHERE id = ?").bind(ok ? "sent" : "pending", k.id).run();
    if (!ok) break;   // Resend is out of quota or down: the cron tries again later
    sent++;
    await new Promise(r => setTimeout(r, 550));   // Resend: 2 per second
  }
  return sent;
}
