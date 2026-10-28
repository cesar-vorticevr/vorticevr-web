// Plataforma de cursos, bloque 4: ediciones en vivo (fechas, sesiones, cupo, liga de la reunión protegida, grabación,
// convocatoria generada), cupones del instructor, cortes quincenales con factura y pago, panel de ventas y alumnos del
// instructor, constancias en el admin y recordatorios de sesión por correo (cron cada 15 min).
// La liga de Zoom/Meet nunca sale en una página ni en un correo: solo la devuelve POST /api/cursos/sesion/<id>/entrar,
// a un inscrito de esa edición y desde 30 minutos antes de la sesión (o a su instructor).
import { generateEdition, courseContext, outlineOf, costOf, genMessage, PROMPT_VERSION } from "./generador.js";
import { premierOk } from "./pagos.js";

const TZ_MS = 6 * 3600e3;   // Mexico City is UTC−6 all year (no daylight saving since 2022)
const JOIN_BEFORE = 30 * 60e3, JOIN_AFTER = 15 * 60e3;
const ACTIVE = "('active', 'completed')";
const CODE = /^[A-Z0-9][A-Z0-9-]{2,23}$/;
const MAX_SESSIONS = 60;
const J = (s, d) => { try { return JSON.parse(s || "null") ?? d; } catch { return d; } };
const cut = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
// "2026-11-03" + "19:00" in Mexico City → ms
const mxTime = (date, time) => { const [y, m, d] = String(date).split("-").map(Number), [hh, mm] = String(time || "00:00").split(":").map(Number); const t = Date.UTC(y, m - 1, d, hh, mm) + TZ_MS; return Number.isFinite(t) ? t : NaN; };
const mxParts = t => { const d = new Date(t - TZ_MS); return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16), wd: d.getUTCDay() }; };
const fmt = (t, o) => new Date(t).toLocaleString("es-MX", { timeZone: "America/Mexico_City", ...o });
const fDate = t => fmt(t, { weekday: "long", day: "numeric", month: "long" });
const fTime = t => fmt(t, { hour: "numeric", minute: "2-digit", hour12: true });
export const periodText = (a, b) => { const d1 = fmt(a, { day: "numeric", month: "long", year: "numeric" }), d2 = fmt(b, { day: "numeric", month: "long", year: "numeric" }); return d1 === d2 ? d1 : `Del ${d1} al ${d2}`; };
const httpsUrl = v => { try { const u = new URL(String(v || "").trim()); return u.protocol === "https:" ? u.toString().slice(0, 500) : null; } catch { return null; } };

export async function migrateVivo(env) {
  const t = s => env.DB.prepare(s);
  await env.DB.batch([
    t("CREATE TABLE IF NOT EXISTS c_editions (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, name TEXT, starts_at INTEGER, ends_at INTEGER, timezone TEXT DEFAULT 'America/Mexico_City', capacity INTEGER, meeting_url TEXT, status TEXT DEFAULT 'scheduled', recording_url TEXT, assets_json TEXT, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_edition_sessions (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL, position INTEGER, title TEXT, starts_at INTEGER, ends_at INTEGER, meeting_url TEXT, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_coupons (id TEXT PRIMARY KEY, course_id TEXT, instructor_id INTEGER, code TEXT UNIQUE NOT NULL, pct_off INTEGER, amount_off_mxn INTEGER, starts_at INTEGER, ends_at INTEGER, max_uses INTEGER, uses INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_payouts (id TEXT PRIMARY KEY, instructor_id INTEGER NOT NULL, period_start INTEGER, period_end INTEGER, label TEXT, gross_mxn INTEGER, commission_mxn INTEGER, adjust_mxn INTEGER DEFAULT 0, net_mxn INTEGER, orders_count INTEGER, status TEXT DEFAULT 'pending', invoice_key TEXT, invoice_name TEXT, invoice_at INTEGER, payout_info TEXT, paid_at INTEGER, paid_reference TEXT, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_mails (k TEXT PRIMARY KEY, at INTEGER)"),
    t("CREATE INDEX IF NOT EXISTS c_editions_course ON c_editions (course_id)"),
    t("CREATE INDEX IF NOT EXISTS c_sessions_edition ON c_edition_sessions (edition_id, position)"),
    t("CREATE INDEX IF NOT EXISTS c_sessions_start ON c_edition_sessions (starts_at)"),
    t("CREATE INDEX IF NOT EXISTS c_payouts_instructor ON c_payouts (instructor_id, period_start)"),
  ]);
  const row = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'c_orders'").first();
  if (row && !/\bpayout_id\b/.test(row.sql)) {
    try { await env.DB.batch(["payout_id TEXT", "refund_payout_id TEXT"].map(c => env.DB.prepare(`ALTER TABLE c_orders ADD COLUMN ${c}`))); }
    catch (e) { console.error("migración cortes", e.message); }
  }
}

// ---------- editions: what the sales page, the checkout and the player need ----------
const seatsTaken = (env, editionId) => env.DB.prepare(`SELECT COUNT(*) AS n FROM c_enrollments WHERE edition_id = ? AND status IN ${ACTIVE}`).bind(editionId).first().then(r => r.n);
const stateOf = (e, now = Date.now()) => e.status === "open" && now >= e.starts_at && now <= e.ends_at ? "in_progress" : e.status === "open" && now > e.ends_at ? "finished" : e.status;
export async function publicEditions(env, courseId) {
  const { results } = await env.DB.prepare("SELECT * FROM c_editions WHERE course_id = ? AND status = 'open' AND ends_at > ? ORDER BY starts_at").bind(courseId, Date.now()).all();
  return Promise.all(results.map(async e => {
    const { results: ss } = await env.DB.prepare("SELECT title, starts_at, ends_at FROM c_edition_sessions WHERE edition_id = ? ORDER BY position").bind(e.id).all();
    const taken = await seatsTaken(env, e.id);
    return { id: e.id, name: e.name, starts_at: e.starts_at, ends_at: e.ends_at, seats: e.capacity ? Math.max(0, e.capacity - taken) : null, capacity: e.capacity, state: stateOf(e), sessions: ss };
  }));
}
// the edition a student picks when buying or enrolling in a live/mixed course: open, not over, with seats
export async function editionCheck(env, c, editionId) {
  if (c.modality === "recorded") return { edition: null };
  const e = editionId && await env.DB.prepare("SELECT * FROM c_editions WHERE id = ? AND course_id = ?").bind(String(editionId), c.id).first();
  if (!e) return { error: "Elige la edición (fechas) a la que te quieres inscribir." };
  if (e.status !== "open" || e.ends_at < Date.now()) return { error: "Esa edición ya no tiene inscripciones abiertas." };
  if (e.capacity && (await seatsTaken(env, e.id)) >= e.capacity) return { error: "Esa edición ya se llenó. Elige otra o espera la siguiente." };
  return { edition: e };
}
// the live part of the player: the student's edition and its sessions (never the meeting link)
export async function liveFor(env, c, en, own) {
  let e = en && en.edition_id ? await env.DB.prepare("SELECT * FROM c_editions WHERE id = ?").bind(en.edition_id).first() : null;
  if (!e && own) e = await env.DB.prepare("SELECT * FROM c_editions WHERE course_id = ? AND status != 'canceled' ORDER BY starts_at DESC LIMIT 1").bind(c.id).first();
  if (!e) return null;
  const now = Date.now(), { results } = await env.DB.prepare("SELECT id, title, starts_at, ends_at FROM c_edition_sessions WHERE edition_id = ? ORDER BY position").bind(e.id).all();
  return { edition: { id: e.id, name: e.name, starts_at: e.starts_at, ends_at: e.ends_at, state: stateOf(e), canceled: e.status === "canceled" },
    sessions: results.map(s => ({ ...s, open: now >= s.starts_at - JOIN_BEFORE && now <= s.ends_at + JOIN_AFTER, past: now > s.ends_at + JOIN_AFTER })),
    recording_url: e.recording_url || null };
}
// a coupon for this course: the instructor's, active, in its dates and with uses left → the price with it (centavos)
export async function couponFor(env, c, code) {
  const k = cut(code, 24).toUpperCase();
  if (!k) return { error: "Escribe tu cupón." };
  const cp = await env.DB.prepare("SELECT * FROM c_coupons WHERE code = ?").bind(k).first(), now = Date.now();
  if (!cp || !cp.active || !c.instructor_id || cp.instructor_id !== c.instructor_id || (cp.course_id && cp.course_id !== c.id)) return { error: "Ese cupón no existe o no es para este curso." };
  if ((cp.starts_at && now < cp.starts_at) || (cp.ends_at && now > cp.ends_at)) return { error: "Ese cupón no está vigente." };
  if (cp.max_uses && cp.uses >= cp.max_uses) return { error: "Ese cupón ya se usó todas las veces posibles." };
  const price = cp.pct_off ? Math.round(c.price_mxn * (100 - cp.pct_off) / 100) : Math.max(0, c.price_mxn - (cp.amount_off_mxn || 0));
  return { coupon: cp, price, label: cp.pct_off ? `${cp.pct_off} % de descuento` : `$${((cp.amount_off_mxn || 0) / 100).toLocaleString("es-MX")} de descuento` };
}
export const useCoupon = (env, id) => id ? env.DB.prepare("UPDATE c_coupons SET uses = uses + 1, updated_at = ? WHERE id = ?").bind(Date.now(), id).run() : null;

// the half-month (quincena) periods, Mexico time: 1–15 and 16–end
function quincena(y, mo, half) { const a = Date.UTC(y, mo - 1, half === 1 ? 1 : 16) + TZ_MS, b = half === 1 ? Date.UTC(y, mo - 1, 16) + TZ_MS : Date.UTC(y, mo, 1) + TZ_MS; return { a, b, label: `${half === 1 ? "1ª" : "2ª"} quincena de ${fmt(a, { month: "long", year: "numeric" })}` }; }
function lastQuincena() { const d = new Date(Date.now() - TZ_MS), y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1; return d.getUTCDate() >= 16 ? { y, mo, half: 1 } : mo === 1 ? { y: y - 1, mo: 12, half: 2 } : { y, mo: mo - 1, half: 2 }; }

async function ownCourse(env, h, user, id) {
  const c = await env.DB.prepare("SELECT * FROM c_courses WHERE id = ?").bind(String(id || "")).first();
  return c && (c.instructor_id === user.id || h.isAdmin(env, user)) ? c : null;
}
async function canTeach(env, h, user) {
  if (h.isAdmin(env, user)) return true;
  const p = await env.DB.prepare("SELECT * FROM c_profiles WHERE user_id = ?").bind(user.id).first();
  return !!p && p.instructor_status === "approved" && premierOk(p);
}
function sessionsFrom(b) {   // dates between start and end on the chosen weekdays, at the same hours
  const days = (Array.isArray(b.days) ? b.days : []).map(Number).filter(d => d >= 0 && d <= 6), out = [];
  const t0 = mxTime(b.start_date, "00:00"), t1 = mxTime(b.end_date, "00:00");
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) return { error: "Revisa las fechas de inicio y fin." };
  if (!/^\d{2}:\d{2}$/.test(b.start_time || "") || !/^\d{2}:\d{2}$/.test(b.end_time || "") || b.end_time <= b.start_time) return { error: "Revisa el horario: la hora de fin va después de la de inicio." };
  if (!days.length) return { error: "Elige los días de la semana de las sesiones." };
  for (let t = t0; t <= t1 && out.length <= MAX_SESSIONS; t += 864e5) {
    const p = mxParts(t);
    if (days.includes(p.wd)) out.push({ starts_at: mxTime(p.date, b.start_time), ends_at: mxTime(p.date, b.end_time) });
  }
  if (!out.length) return { error: "Con esas fechas y días no queda ninguna sesión." };
  if (out.length > MAX_SESSIONS) return { error: `Máximo ${MAX_SESSIONS} sesiones por edición.` };
  return { sessions: out };
}

export async function vivoApi(request, env, ctx, url, path, h, user, lib) {
  const M = request.method, { json } = h;
  const body = async () => { try { return await request.json(); } catch { return {}; } };
  const now = Date.now();
  let m;

  // a coupon on the sales page (shows the new price; the checkout checks it again)
  if ((m = path.match(/^\/api\/cursos\/curso\/([a-z0-9-]+)\/cupon$/)) && M === "POST") {
    if (!(await h.limit(env, `ccup:${request.headers.get("CF-Connecting-IP") || "x"}`, 30, 3600e3))) return json({ error: "Demasiados intentos. Intenta en una hora." }, 429);
    const c = await lib.courseBySlug(env, m[1]);
    if (!c || c.status !== "published" || !(c.price_mxn > 0)) return json({ error: "Este curso no acepta cupones." }, 404);
    const r = await couponFor(env, c, (await body()).code);
    if (r.error) return json({ error: r.error }, 400);
    return json({ code: r.coupon.code, price_mxn: r.price, before_mxn: c.price_mxn, label: r.label });
  }

  // "Entrar a la sesión": the meeting link, only now and only for whoever may enter
  if ((m = path.match(/^\/api\/cursos\/sesion\/([\w-]+)\/entrar$/)) && M === "POST") {
    if (!user) return json({ error: "Inicia sesión.", login: true }, 401);
    const s = await env.DB.prepare("SELECT s.*, e.course_id, e.meeting_url AS e_url, e.status AS e_status, c.instructor_id FROM c_edition_sessions s JOIN c_editions e ON e.id = s.edition_id JOIN c_courses c ON c.id = e.course_id WHERE s.id = ?").bind(m[1]).first();
    if (!s) return json({ error: "No encontramos esa sesión." }, 404);
    const own = s.instructor_id === user.id || h.isAdmin(env, user);
    if (!own) {
      const en = await env.DB.prepare(`SELECT 1 FROM c_enrollments WHERE student_id = ? AND course_id = ? AND edition_id = ? AND status IN ${ACTIVE}`).bind(user.id, s.course_id, s.edition_id).first();
      if (!en) return json({ error: "Esta sesión es para los inscritos en esta edición." }, 403);
      if (s.e_status === "canceled") return json({ error: "Esta edición se canceló." }, 409);
      if (now < s.starts_at - JOIN_BEFORE) return json({ error: `La sesión se abre 30 minutos antes: ${fDate(s.starts_at)} a las ${fTime(s.starts_at - JOIN_BEFORE)}.`, opens_at: s.starts_at - JOIN_BEFORE }, 425);
      if (now > s.ends_at + JOIN_AFTER) return json({ error: "Esta sesión ya terminó." }, 410);
    }
    const link = s.meeting_url || s.e_url;
    if (!link) return json({ error: "El instructor todavía no pone la liga de la reunión." }, 409);
    return json({ url: link });
  }

  // ---------- the instructor's editions ----------
  if (path.startsWith("/api/cursos/ediciones")) {
    if (!user) return json({ error: "Inicia sesión.", login: true }, 401);
    if (path === "/api/cursos/ediciones" && M === "GET") {
      const c = await ownCourse(env, h, user, url.searchParams.get("curso"));
      if (!c) return json({ error: "No encontramos ese curso." }, 404);
      const { results: eds } = await env.DB.prepare("SELECT * FROM c_editions WHERE course_id = ? ORDER BY starts_at DESC").bind(c.id).all();
      const out = [];
      for (const e of eds) {
        const { results: ss } = await env.DB.prepare("SELECT * FROM c_edition_sessions WHERE edition_id = ? ORDER BY position").bind(e.id).all();
        const { results: st } = await env.DB.prepare(`SELECT u.name, en.progress_pct, en.completed_at FROM c_enrollments en JOIN users u ON u.id = en.student_id WHERE en.edition_id = ? AND en.status IN ${ACTIVE} ORDER BY en.created_at`).bind(e.id).all();
        out.push({ id: e.id, name: e.name, starts_at: e.starts_at, ends_at: e.ends_at, capacity: e.capacity, meeting_url: e.meeting_url || "", status: e.status, state: stateOf(e), recording_url: e.recording_url || "",
          assets: J(e.assets_json, null), sessions: ss.map(s => ({ id: s.id, title: s.title, starts_at: s.starts_at, ends_at: s.ends_at, meeting_url: s.meeting_url || "", ...mxParts(s.starts_at), end_time: mxParts(s.ends_at).time })),
          students: st.map(x => ({ name: String(x.name || "").split(" ").slice(0, 2).join(" "), progress: x.progress_pct, completed: !!x.completed_at })) });
      }
      return json({ course: { id: c.id, slug: c.slug, title: c.title, modality: c.modality, status: c.status }, editions: out, canTeach: await canTeach(env, h, user) });
    }
    if (path === "/api/cursos/ediciones" && M === "POST") {
      const b = await body(), c = await ownCourse(env, h, user, b.course);
      if (!c) return json({ error: "No encontramos ese curso." }, 404);
      if (c.modality === "recorded") return json({ error: "Las ediciones son para cursos en vivo o mixtos." }, 400);
      if (!["published", "in_review", "draft"].includes(c.status)) return json({ error: "Este curso no admite ediciones." }, 409);
      if (!(await canTeach(env, h, user))) return json({ error: "Necesitas tu Premier activo para abrir ediciones." }, 403);
      const r = sessionsFrom(b); if (r.error) return json({ error: r.error }, 400);
      if (r.sessions[0].starts_at < now) return json({ error: "La primera sesión ya pasó: elige fechas futuras." }, 400);
      const meet = b.meeting_url ? httpsUrl(b.meeting_url) : null;
      if (b.meeting_url && !meet) return json({ error: "Revisa la liga de la reunión (https://…)." }, 400);
      const cap = Math.round(Number(b.capacity)) || null;
      if (cap !== null && (cap < 1 || cap > 5000)) return json({ error: "El cupo va de 1 a 5,000 lugares." }, 400);
      const id = lib.uid(), st = [];
      st.push(env.DB.prepare("INSERT INTO c_editions (id, course_id, name, starts_at, ends_at, capacity, meeting_url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, c.id, cut(b.name, 80) || `Edición de ${fmt(r.sessions[0].starts_at, { month: "long", year: "numeric" })}`, r.sessions[0].starts_at, r.sessions[r.sessions.length - 1].ends_at, cap, meet, b.open && c.status === "published" ? "open" : "scheduled", now, now));
      r.sessions.forEach((s, i) => st.push(env.DB.prepare("INSERT INTO c_edition_sessions (id, edition_id, position, title, starts_at, ends_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(lib.uid(), id, i + 1, `Sesión ${i + 1}`, s.starts_at, s.ends_at, now, now)));
      await env.DB.batch(st);
      return json({ ok: true, id, sessions: r.sessions.length });
    }
    if ((m = path.match(/^\/api\/cursos\/ediciones\/([\w-]+)(\/convocatoria)?$/)) && (M === "PUT" || M === "POST")) {
      const e = await env.DB.prepare("SELECT * FROM c_editions WHERE id = ?").bind(m[1]).first();
      const c = e && await ownCourse(env, h, user, e.course_id);
      if (!c) return json({ error: "No encontramos esa edición." }, 404);
      const taken = await seatsTaken(env, e.id);
      if (m[2] && M === "POST") {   // the dated pieces (posts, WhatsApp, reminder e-mails), generated
        const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM c_generation_jobs WHERE course_id = ? AND kind = 'edition_assets' AND piece = ? AND status = 'done'").bind(c.id, e.id).first()).n;
        if (n >= 5) return json({ error: "Ya generaste la convocatoria de esta edición 5 veces. Edita los textos a mano." }, 429);
        const { results: ss } = await env.DB.prepare("SELECT title, starts_at, ends_at FROM c_edition_sessions WHERE edition_id = ? ORDER BY position").bind(e.id).all();
        const instructor = await env.DB.prepare("SELECT u.name, p.headline, p.bio FROM users u LEFT JOIN c_profiles p ON p.user_id = u.id WHERE u.id = ?").bind(c.instructor_id).first() || {};
        const g = J(c.generation_json, {}), iv = J(c.interview_json, {});
        const text = `${e.name}\nCupo: ${e.capacity ? e.capacity + " lugares" : "sin límite"}\nSesiones (hora del centro de México):\n` + ss.map(s => `- ${s.title}: ${fDate(s.starts_at)}, de ${fTime(s.starts_at)} a ${fTime(s.ends_at)}`).join("\n");
        const job = lib.uid();
        await env.DB.prepare("INSERT INTO c_generation_jobs (id, course_id, instructor_id, kind, piece, status, prompt_version, started_at, created_at, updated_at) VALUES (?, ?, ?, 'edition_assets', ?, 'running', ?, ?, ?, ?)").bind(job, c.id, c.instructor_id, e.id, PROMPT_VERSION, now, now, now).run();
        try {
          const r = await generateEdition(env, { context: courseContext(iv, instructor, ""), outline: outlineOf(g.course) || `## Curso\n${c.title} — ${c.subtitle || ""}`, edition: text });
          const rate = (await lib.settings(env)).usd_mxn_rate || 18.5, k = costOf(r.usage, r.model, rate);
          await env.DB.batch([env.DB.prepare("UPDATE c_editions SET assets_json = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(r.data), Date.now(), e.id),
            env.DB.prepare("UPDATE c_generation_jobs SET status = 'done', model = ?, tokens_in = ?, tokens_out = ?, cost_mxn = ?, finished_at = ? WHERE id = ?").bind(r.model, k.tokens_in, k.tokens_out, k.cost_mxn, Date.now(), job)]);
          return json({ ok: true, assets: r.data });
        } catch (err) {
          await env.DB.prepare("UPDATE c_generation_jobs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?").bind(genMessage(err), Date.now(), job).run();
          return json({ error: genMessage(err) }, err.status === 503 ? 503 : 502);
        }
      }
      const b = await body(), st = [];
      const status = ["scheduled", "open", "finished", "canceled"].includes(b.status) ? b.status : e.status;
      if (status === "open" && c.status !== "published") return json({ error: "Abre inscripciones cuando tu curso esté publicado." }, 409);
      if (status === "canceled" && taken && e.status !== "canceled") return json({ error: `Esta edición tiene ${taken} inscritos. Para cancelarla escríbenos a hola@vorticevr.mx y vemos los reembolsos.` }, 409);
      const meet = b.meeting_url ? httpsUrl(b.meeting_url) : null;
      if (b.meeting_url && !meet) return json({ error: "Revisa la liga de la reunión (https://…)." }, 400);
      const rec = b.recording_url ? httpsUrl(b.recording_url) : null;
      if (b.recording_url && !rec) return json({ error: "Revisa la liga de la grabación (https://…)." }, 400);
      const cap = b.capacity === "" || b.capacity == null ? null : Math.round(Number(b.capacity));
      if (cap !== null && (!(cap >= 1) || cap > 5000)) return json({ error: "El cupo va de 1 a 5,000 lugares." }, 400);
      if (cap !== null && cap < taken) return json({ error: `Ya hay ${taken} inscritos: el cupo no puede ser menor.` }, 400);
      let first = e.starts_at, last = e.ends_at;
      if (Array.isArray(b.sessions)) {   // titles, dates and hours of each session, and its own link if it changes
        const { results: ss } = await env.DB.prepare("SELECT id FROM c_edition_sessions WHERE edition_id = ?").bind(e.id).all(), ids = new Set(ss.map(s => s.id));
        const rows = [];
        for (const s of b.sessions.slice(0, MAX_SESSIONS)) {
          if (!ids.has(s.id)) continue;
          const a = mxTime(s.date, s.time), z = mxTime(s.date, s.end_time);
          if (!Number.isFinite(a) || !Number.isFinite(z) || z <= a) return json({ error: `Revisa la fecha y el horario de "${cut(s.title, 60) || "una sesión"}".` }, 400);
          const su = s.meeting_url ? httpsUrl(s.meeting_url) : null;
          if (s.meeting_url && !su) return json({ error: "Revisa la liga de una sesión (https://…)." }, 400);
          rows.push({ id: s.id, title: cut(s.title, 120) || "Sesión", a, z, su });
        }
        rows.sort((x, y) => x.a - y.a);
        rows.forEach((r, i) => st.push(env.DB.prepare("UPDATE c_edition_sessions SET position = ?, title = ?, starts_at = ?, ends_at = ?, meeting_url = ?, updated_at = ? WHERE id = ?").bind(i + 1, r.title, r.a, r.z, r.su, now, r.id)));
        if (rows.length) { first = rows[0].a; last = Math.max(...rows.map(r => r.z)); }
      }
      if (b.assets && typeof b.assets === "object") st.push(env.DB.prepare("UPDATE c_editions SET assets_json = ? WHERE id = ?").bind(JSON.stringify(b.assets).slice(0, 60000), e.id));
      st.push(env.DB.prepare("UPDATE c_editions SET name = ?, capacity = ?, meeting_url = ?, recording_url = ?, status = ?, starts_at = ?, ends_at = ?, updated_at = ? WHERE id = ?")
        .bind(cut(b.name, 80) || e.name, cap, meet, rec, status, first, last, now, e.id));
      await env.DB.batch(st);
      return json({ ok: true });
    }
    if ((m = path.match(/^\/api\/cursos\/ediciones\/([\w-]+)$/)) && M === "DELETE") {
      const e = await env.DB.prepare("SELECT * FROM c_editions WHERE id = ?").bind(m[1]).first();
      const c = e && await ownCourse(env, h, user, e.course_id);
      if (!c) return json({ error: "No encontramos esa edición." }, 404);
      if (await seatsTaken(env, e.id)) return json({ error: "Esta edición tiene inscritos." }, 409);
      await env.DB.batch([env.DB.prepare("DELETE FROM c_edition_sessions WHERE edition_id = ?").bind(e.id), env.DB.prepare("DELETE FROM c_editions WHERE id = ?").bind(e.id)]);
      return json({ ok: true });
    }
    return json({ error: "No encontrado" }, 404);
  }

  // ---------- the instructor's sales, students, coupons, payouts and bank account ----------
  if (path.startsWith("/api/cursos/ventas")) {
    if (!user) return json({ error: "Inicia sesión.", login: true }, 401);
    if (path === "/api/cursos/ventas" && M === "GET") {
      const [{ results: orders }, { results: pays }, { results: coupons }, { results: courses }] = await Promise.all([
        env.DB.prepare(`SELECT o.id, o.amount_mxn, o.commission_mxn, o.instructor_net_mxn, o.status, o.paid_at, o.payout_id, o.coupon_id, c.title, u.name FROM c_orders o JOIN c_courses c ON c.id = o.course_id JOIN users u ON u.id = o.student_id
          WHERE o.instructor_id = ? AND o.status IN ('paid', 'refunded') ORDER BY o.paid_at DESC LIMIT 300`).bind(user.id).all(),
        env.DB.prepare("SELECT * FROM c_payouts WHERE instructor_id = ? ORDER BY period_start DESC LIMIT 48").bind(user.id).all(),
        env.DB.prepare("SELECT k.*, c.title FROM c_coupons k LEFT JOIN c_courses c ON c.id = k.course_id WHERE k.instructor_id = ? ORDER BY k.created_at DESC").bind(user.id).all(),
        env.DB.prepare(`SELECT c.id, c.slug, c.title, c.status, c.modality, c.price_mxn, (SELECT COUNT(*) FROM c_enrollments e WHERE e.course_id = c.id AND e.status IN ${ACTIVE}) AS students,
          (SELECT COUNT(*) FROM c_enrollments e WHERE e.course_id = c.id AND e.completed_at IS NOT NULL AND e.status IN ${ACTIVE}) AS completed FROM c_courses c WHERE c.instructor_id = ? ORDER BY c.updated_at DESC`).bind(user.id).all(),
      ]);
      const paid = orders.filter(o => o.status === "paid"), sum = (a, k) => a.reduce((x, o) => x + (o[k] || 0), 0);
      const pay = J((await env.DB.prepare("SELECT payout FROM users WHERE id = ?").bind(user.id).first() || {}).payout, null);
      return json({
        totals: { sales: paid.length, gross: sum(paid, "amount_mxn"), commission: sum(paid, "commission_mxn"), net: sum(paid, "instructor_net_mxn"),
          pending: sum(paid.filter(o => !o.payout_id), "instructor_net_mxn"), paidOut: sum(pays.filter(p => p.status === "paid"), "net_mxn"), refunds: orders.length - paid.length },
        orders: orders.map(o => ({ course: o.title, student: String(o.name || "").split(" ")[0], amount: o.amount_mxn, commission: o.commission_mxn, net: o.instructor_net_mxn, status: o.status, paid_at: o.paid_at, coupon: !!o.coupon_id, cut: !!o.payout_id })),
        payouts: pays.map(p => ({ id: p.id, label: p.label, gross: p.gross_mxn, commission: p.commission_mxn, adjust: p.adjust_mxn, net: p.net_mxn, orders: p.orders_count, status: p.status, invoice: !!p.invoice_key, paid_at: p.paid_at, reference: p.paid_reference })),
        coupons: coupons.map(k => ({ id: k.id, code: k.code, course: k.title || "Todos mis cursos", course_id: k.course_id, pct_off: k.pct_off, amount_off: k.amount_off_mxn, starts_at: k.starts_at, ends_at: k.ends_at, max_uses: k.max_uses, uses: k.uses, active: !!k.active })),
        courses, account: pay ? { clabe: "•••• " + String(pay.clabe || "").slice(-4), banco: pay.banco || "", titular: pay.titular || "" } : null,
        commission_pct: (await lib.settings(env)).commission_pct ?? 20,
      });
    }
    if (path === "/api/cursos/ventas/alumnos" && M === "GET") {
      const c = await ownCourse(env, h, user, url.searchParams.get("curso"));
      if (!c) return json({ error: "No encontramos ese curso." }, 404);
      const { results } = await env.DB.prepare(`SELECT u.name, en.progress_pct, en.completed_at, en.created_at, ed.name AS edition, k.folio,
          (SELECT MAX(score) FROM c_exam_attempts a WHERE a.enrollment_id = en.id) AS best
        FROM c_enrollments en JOIN users u ON u.id = en.student_id LEFT JOIN c_editions ed ON ed.id = en.edition_id LEFT JOIN c_certificates k ON k.enrollment_id = en.id
        WHERE en.course_id = ? AND en.status IN ${ACTIVE} ORDER BY en.created_at DESC LIMIT 1000`).bind(c.id).all();
      return json({ course: c.title, students: results.map(r => ({ name: String(r.name || "").split(" ").slice(0, 2).join(" "), progress: r.progress_pct, completed_at: r.completed_at, enrolled_at: r.created_at, edition: r.edition || "", best: r.best, folio: r.folio || "" })) });
    }
    if (path === "/api/cursos/ventas/cupones" && M === "POST") {
      if (!(await canTeach(env, h, user))) return json({ error: "Necesitas tu Premier activo." }, 403);
      const b = await body();
      const course = b.course_id ? await ownCourse(env, h, user, b.course_id) : null;
      if (b.course_id && (!course || course.instructor_id !== user.id)) return json({ error: "Elige uno de tus cursos." }, 400);
      const code = cut(b.code, 24).toUpperCase().replace(/\s+/g, "") || ("VVR-" + [...crypto.getRandomValues(new Uint8Array(5))].map(x => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32]).join(""));
      if (!CODE.test(code)) return json({ error: "El código lleva de 3 a 24 letras, números o guiones." }, 400);
      const pct = Math.round(Number(b.pct_off) || 0), amt = Math.round(Number(b.amount_off) * 100 || 0);
      if (!!pct === !!amt) return json({ error: "Elige un descuento: porcentaje o monto." }, 400);
      if (pct && (pct < 1 || pct > 100)) return json({ error: "El porcentaje va de 1 a 100." }, 400);
      if (amt && (amt < 100 || amt > 20000000)) return json({ error: "Revisa el monto del descuento." }, 400);
      const a = b.starts ? mxTime(b.starts, "00:00") : null, z = b.ends ? mxTime(b.ends, "23:59") + 59999 : null;
      if ((b.starts && !Number.isFinite(a)) || (b.ends && !Number.isFinite(z)) || (a && z && z < a)) return json({ error: "Revisa las fechas del cupón." }, 400);
      const max = b.max_uses ? Math.round(Number(b.max_uses)) : null;
      if (max !== null && !(max >= 1 && max <= 100000)) return json({ error: "Revisa el máximo de usos." }, 400);
      if (await env.DB.prepare("SELECT 1 FROM c_coupons WHERE code = ?").bind(code).first()) return json({ error: "Ese código ya existe. Elige otro." }, 409);
      await env.DB.prepare("INSERT INTO c_coupons (id, course_id, instructor_id, code, pct_off, amount_off_mxn, starts_at, ends_at, max_uses, uses, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)")
        .bind(lib.uid(), course ? course.id : null, user.id, code, pct || null, amt || null, a, z, max, now, now).run();
      return json({ ok: true, code });
    }
    if ((m = path.match(/^\/api\/cursos\/ventas\/cupones\/([\w-]+)$/)) && M === "PUT") {
      const b = await body();
      const r = await env.DB.prepare("UPDATE c_coupons SET active = ?, updated_at = ? WHERE id = ? AND instructor_id = ?").bind(b.active ? 1 : 0, now, m[1], user.id).run();
      return r.meta && r.meta.changes ? json({ ok: true }) : json({ error: "No encontramos ese cupón." }, 404);
    }
    if (path === "/api/cursos/ventas/cuenta" && M === "POST") {   // the same bank account field the sellers use (users.payout)
      const b = await body(), clabe = String(b.clabe || "").replace(/\D/g, "");
      if (!h.clabeOk(clabe)) return json({ error: "Revisa tu CLABE: son 18 números (la encuentras en tu app del banco)." }, 400);
      const titular = cut(b.titular, 100); if (!titular) return json({ error: "Escribe el nombre del titular de la cuenta." }, 400);
      const p = { clabe, banco: cut(b.banco, 60) || h.CLABE_BANKS[clabe.slice(0, 3)] || "", titular, rfc: cut(b.rfc, 13).toUpperCase(), at: now };
      await env.DB.prepare("UPDATE users SET payout = ? WHERE id = ?").bind(JSON.stringify(p), user.id).run();
      return json({ ok: true, banco: p.banco });
    }
    if ((m = path.match(/^\/api\/cursos\/ventas\/cortes\/([\w-]+)\/factura$/)) && M === "POST") {
      const p = await env.DB.prepare("SELECT * FROM c_payouts WHERE id = ? AND instructor_id = ?").bind(m[1], user.id).first();
      if (!p) return json({ error: "No encontramos ese corte." }, 404);
      if (p.status === "paid") return json({ error: "Ese corte ya se pagó." }, 409);
      const f = (await request.formData()).get("file");
      const okType = f && typeof f !== "string" && (/pdf$/.test(f.type) || /\.(pdf|xml|zip)$/i.test(f.name || ""));
      if (!okType || f.size > 5 * 1024 * 1024) return json({ error: "Sube tu factura en PDF (o el PDF y el XML en un .zip), de menos de 5 MB." }, 400);
      const key = `cursos/facturas/${p.id}`;
      await env.MEDIA.put(key, await f.arrayBuffer(), { httpMetadata: { contentType: f.type || "application/octet-stream" } });
      await env.DB.prepare("UPDATE c_payouts SET invoice_key = ?, invoice_name = ?, invoice_at = ?, status = 'invoice_received', updated_at = ? WHERE id = ?").bind(key, cut(f.name, 120), now, now, p.id).run();
      ctx.waitUntil(h.sendMail(env, env.CONTACT_TO || "hola@vorticevr.mx", `[Cursos] Factura recibida: ${user.name} · ${p.label}`, h.shell(`<h1 style="font-size:20px">Factura recibida</h1>
        <p><b>${h.esc(user.name || "")}</b> subió su factura del corte <b>${h.esc(p.label)}</b> por <b>$${(p.net_mxn / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN</b>.</p>${h.btnMail(h.siteUrl(env) + "/cursos/admin/", "Ver en el admin de cursos")}`, "Aviso automático de la plataforma de cursos.")));
      return json({ ok: true });
    }
    return json({ error: "No encontrado" }, 404);
  }

  // ---------- admin: payouts (cortes) and certificates ----------
  if (path.startsWith("/api/cursos/admin/cortes") || path.startsWith("/api/cursos/admin/constancias")) {
    if (!user) return json({ error: "Inicia sesión.", login: true }, 401);
    if (!h.isAdmin(env, user)) return json({ error: "No tienes acceso." }, 403);
    if (path === "/api/cursos/admin/cortes" && M === "GET") {
      const { results } = await env.DB.prepare("SELECT p.*, u.name, u.email FROM c_payouts p JOIN users u ON u.id = p.instructor_id ORDER BY p.period_start DESC, u.name LIMIT 300").all();
      const pending = await env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(instructor_net_mxn), 0) AS net FROM c_orders WHERE status = 'paid' AND instructor_id IS NOT NULL AND payout_id IS NULL").first();
      const L = lastQuincena(), q = quincena(L.y, L.mo, L.half);
      return json({ next: { period: `${L.y}-${L.mo}-${L.half}`, label: q.label }, pending, list: results.map(p => ({ id: p.id, name: p.name, email: p.email, label: p.label, gross: p.gross_mxn, commission: p.commission_mxn, adjust: p.adjust_mxn, net: p.net_mxn, orders: p.orders_count,
        status: p.status, invoice: !!p.invoice_key, invoice_name: p.invoice_name, account: J(p.payout_info, null), paid_at: p.paid_at, reference: p.paid_reference })) });
    }
    if (path === "/api/cursos/admin/cortes" && M === "POST") {   // the cut of one half-month: paid orders of each instructor not cut yet, minus refunds of orders already paid out
      const b = await body(), L = lastQuincena();
      const [y, mo, half] = String(b.period || `${L.y}-${L.mo}-${L.half}`).split("-").map(Number);
      if (!(y > 2025 && mo >= 1 && mo <= 12 && (half === 1 || half === 2))) return json({ error: "Periodo inválido." }, 400);
      const q = quincena(y, mo, half);
      if (q.b > now) return json({ error: "Esa quincena todavía no termina." }, 409);
      const { results: orders } = await env.DB.prepare("SELECT * FROM c_orders WHERE status = 'paid' AND instructor_id IS NOT NULL AND payout_id IS NULL AND paid_at >= ? AND paid_at < ?").bind(q.a, q.b).all();
      const { results: refunds } = await env.DB.prepare("SELECT * FROM c_orders WHERE status = 'refunded' AND instructor_id IS NOT NULL AND payout_id IS NOT NULL AND refund_payout_id IS NULL").all();
      const by = {};
      for (const o of orders) (by[o.instructor_id] ||= { o: [], r: [] }).o.push(o);
      for (const o of refunds) (by[o.instructor_id] ||= { o: [], r: [] }).r.push(o);
      const made = [];
      for (const [iid, g] of Object.entries(by)) {
        if (await env.DB.prepare("SELECT 1 FROM c_payouts WHERE instructor_id = ? AND period_start = ?").bind(Number(iid), q.a).first()) continue;
        const id = lib.uid(), u = await env.DB.prepare("SELECT name, email, payout FROM users WHERE id = ?").bind(Number(iid)).first();
        const gross = g.o.reduce((a, o) => a + o.amount_mxn, 0), commission = g.o.reduce((a, o) => a + o.commission_mxn, 0), adjust = -g.r.reduce((a, o) => a + o.instructor_net_mxn, 0);
        const net = gross - commission + adjust, st = [];
        st.push(env.DB.prepare("INSERT INTO c_payouts (id, instructor_id, period_start, period_end, label, gross_mxn, commission_mxn, adjust_mxn, net_mxn, orders_count, status, payout_info, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)")
          .bind(id, Number(iid), q.a, q.b, q.label, gross, commission, adjust, net, g.o.length, u && u.payout || null, now, now));
        for (const o of g.o) st.push(env.DB.prepare("UPDATE c_orders SET payout_id = ? WHERE id = ?").bind(id, o.id));
        for (const o of g.r) st.push(env.DB.prepare("UPDATE c_orders SET refund_payout_id = ? WHERE id = ?").bind(id, o.id));
        await env.DB.batch(st);
        made.push({ name: u && u.name, net });
        if (u) ctx.waitUntil(h.sendMail(env, u.email, `Tu corte de cursos: ${q.label}`, h.shell(`<h1 style="font-size:20px">Tu corte de la ${h.esc(q.label)}</h1>
          <p>Ventas: <b>${g.o.length}</b> · Vendido: <b>$${(gross / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</b> · Comisión: <b>$${(commission / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</b>${adjust ? ` · Reembolsos: <b>−$${(-adjust / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</b>` : ""}</p>
          <p style="font-size:18px">Para ti: <b>$${(net / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN</b></p>
          <p>${net > 0 ? "Emite tu factura por ese monto a nombre de Vórtice VR y súbela en tu panel de ventas; en cuanto la recibamos te transferimos." : "Este corte no tiene saldo a tu favor."}</p>${h.btnMail(h.siteUrl(env) + "/cursos/ventas/", "Ir a mis ventas")}`,
          "Recibiste este correo por tus cursos en la plataforma de cursos de Vórtice VR.")));
      }
      return json({ ok: true, label: q.label, made });
    }
    if ((m = path.match(/^\/api\/cursos\/admin\/cortes\/([\w-]+)\/factura$/)) && M === "GET") {
      const p = await env.DB.prepare("SELECT invoice_key, invoice_name FROM c_payouts WHERE id = ?").bind(m[1]).first();
      const obj = p && p.invoice_key && await env.MEDIA.get(p.invoice_key);
      if (!obj) return json({ error: "No hay factura." }, 404);
      return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata && obj.httpMetadata.contentType || "application/octet-stream", "Content-Disposition": `inline; filename="${String(p.invoice_name || "factura").replace(/["\\\r\n]/g, "")}"`, "Cache-Control": "no-store" } });
    }
    if ((m = path.match(/^\/api\/cursos\/admin\/cortes\/([\w-]+)\/pagado$/)) && M === "POST") {
      const b = await body(), ref = cut(b.reference, 120);
      if (ref.length < 3) return json({ error: "Escribe la referencia de la transferencia." }, 400);
      const p = await env.DB.prepare("SELECT p.*, u.email, u.name FROM c_payouts p JOIN users u ON u.id = p.instructor_id WHERE p.id = ?").bind(m[1]).first();
      if (!p) return json({ error: "No existe ese corte." }, 404);
      if (p.status === "paid") return json({ error: "Ese corte ya está pagado." }, 409);
      await env.DB.prepare("UPDATE c_payouts SET status = 'paid', paid_at = ?, paid_reference = ?, updated_at = ? WHERE id = ?").bind(now, ref, now, p.id).run();
      ctx.waitUntil(h.sendMail(env, p.email, `Te pagamos tu corte: ${p.label}`, h.shell(`<h1 style="font-size:20px">¡Listo, te pagamos!</h1>
        <p>Transferimos <b>$${(p.net_mxn / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN</b> de tu corte <b>${h.esc(p.label)}</b>. Referencia: <b>${h.esc(ref)}</b>.</p>${h.btnMail(h.siteUrl(env) + "/cursos/ventas/", "Ver mis ventas")}`,
        "Recibiste este correo por tus cursos en la plataforma de cursos de Vórtice VR.")));
      return json({ ok: true });
    }
    if (path === "/api/cursos/admin/constancias" && M === "GET") {
      const q = cut(url.searchParams.get("q"), 80);
      const { results } = await env.DB.prepare(`SELECT folio, verify_token, student_name, course_title, issued_at, revoked, revoked_reason FROM c_certificates
        WHERE (?1 = '' OR folio LIKE '%' || ?1 || '%' OR lower(student_name) LIKE '%' || lower(?1) || '%' OR lower(course_title) LIKE '%' || lower(?1) || '%') ORDER BY issued_at DESC LIMIT 200`).bind(q).all();
      return json({ list: results });
    }
    if ((m = path.match(/^\/api\/cursos\/admin\/constancias\/(VVR-\d{4}-\d{6})\/revocar$/)) && M === "POST") {
      const b = await body(), reason = cut(b.reason, 300);
      if (reason.length < 5) return json({ error: "Escribe el motivo: se muestra en la página de verificación." }, 400);
      const r = await env.DB.prepare("UPDATE c_certificates SET revoked = 1, revoked_reason = ?, updated_at = ? WHERE folio = ? AND revoked = 0").bind(reason, now, m[1]).run();
      return r.meta && r.meta.changes ? json({ ok: true }) : json({ error: "No existe o ya está revocada." }, 404);
    }
    return json({ error: "No encontrado" }, 404);
  }
  return null;
}

// ---------- reminders before each live session (cron every 15 min): 7 days (first session), 1 day and 1 hour ----------
const KINDS = [["7d", 7 * 864e5, 864e5, "Falta una semana"], ["1d", 864e5, 3600e3, "Es mañana"], ["1h", 3600e3, 0, "Empieza en una hora"]];
export async function cursosCron(env, h) {
  const now = Date.now();
  const { results } = await env.DB.prepare(`SELECT s.*, e.name AS edition, e.assets_json, c.title AS course, c.slug FROM c_edition_sessions s JOIN c_editions e ON e.id = s.edition_id JOIN c_courses c ON c.id = e.course_id
    WHERE e.status = 'open' AND s.starts_at > ? AND s.starts_at <= ? ORDER BY s.starts_at LIMIT 200`).bind(now, now + 7 * 864e5).all();
  let sent = 0;
  for (const s of results) {
    const left = s.starts_at - now, kind = KINDS.find(([k, hi, lo]) => left <= hi && left > lo && (k !== "7d" || s.position === 1));
    if (!kind) continue;
    const { results: st } = await env.DB.prepare(`SELECT u.id, u.email, u.name FROM c_enrollments en JOIN users u ON u.id = en.student_id WHERE en.edition_id = ? AND en.status IN ${ACTIVE}`).bind(s.edition_id).all();
    const a = J(s.assets_json, {}), tpl = a[`reminder_${kind[0]}`];
    for (const u of st) {
      if (sent >= 40) return sent;   // Resend's free daily quota is shared with the rest of the site
      const k = `cur:${s.id}:${kind[0]}:${u.id}`;
      if (await env.DB.prepare("SELECT 1 FROM c_mails WHERE k = ?").bind(k).first()) continue;
      const when = `${fDate(s.starts_at)}, de ${fTime(s.starts_at)} a ${fTime(s.ends_at)} (hora del centro de México)`;
      const link = `${h.siteUrl(env)}/cursos/aprender/${s.slug}/`;
      const text = tpl ? String(tpl.body_md).replace(/\{\{link\}\}/g, link) : `Te esperamos en tu sesión en vivo de "${s.course}". Ten listo tu equipo: computadora o celular con internet.`;
      const html = h.shell(`<h1 style="font-size:20px">${h.esc(kind[3])}: ${h.esc(s.title)}</h1><p><b>${h.esc(s.course)}</b> · ${h.esc(s.edition)}<br>${h.esc(when)}</p>
        <p style="white-space:pre-wrap">${h.esc(text)}</p>
        <p>La liga para entrar está en tu curso y se activa 30 minutos antes.</p>${h.btnMail(link, "Ir a mi curso")}`, "Recibiste este correo porque estás inscrito en una edición en vivo de la plataforma de cursos de Vórtice VR.");
      const subject = tpl && tpl.subject ? tpl.subject : `${kind[3]}: ${s.title} de ${s.course}`;
      if (await h.sendMail(env, u.email, subject.slice(0, 140), html)) { await env.DB.prepare("INSERT OR IGNORE INTO c_mails (k, at) VALUES (?, ?)").bind(k, now).run(); sent++; }
    }
  }
  return sent;
}
