// Plataforma de cursos (cursos.vorticevr.mx → vorticevr.mx/cursos/), bloque 1: catálogo, página de venta, inscripción
// a cursos gratis, reproductor con avance, examen calificado en el servidor, constancia en PDF con folio y QR, y su
// verificación pública. Mismas cuentas y sesión que la plataforma de experiencias (tabla users de worker.js).
// Las tablas llevan el prefijo c_ (ya existe una tabla "coupons" de los planes). La seguridad que el documento pide
// como RLS vive aquí: el navegador nunca toca la base y cada consulta filtra por el dueño o el inscrito.
// Las respuestas correctas del examen nunca salen de este archivo mientras el alumno puede volver a intentarlo.
import { COURSE, MODULES, EXAM, SEED_VERSION, ONBOARDING_SLUG } from "./induccion.js";
import { certificatePdf } from "./pdf.js";
import { pagosApi, migratePagos, cursosWebhook, sellable, billingOn } from "./pagos.js";
import { estudioApi, migrateEstudio } from "./estudio.js";

let ready = false;
async function schema(env) {
  if (ready) return;
  const t = s => env.DB.prepare(s);
  await env.DB.batch([
    t("CREATE TABLE IF NOT EXISTS c_profiles (user_id INTEGER PRIMARY KEY, role TEXT DEFAULT 'student', headline TEXT, bio TEXT, avatar_url TEXT, phone TEXT, rfc TEXT, can_invoice INTEGER DEFAULT 0, city TEXT, state TEXT, instructor_status TEXT DEFAULT 'none', premier_status TEXT DEFAULT 'inactive', premier_until INTEGER, stripe_customer_id TEXT, stripe_subscription_id TEXT, onboarding_passed INTEGER DEFAULT 0, signature_url TEXT, logo_url TEXT, brand_theme TEXT, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_courses (id TEXT PRIMARY KEY, instructor_id INTEGER, slug TEXT UNIQUE NOT NULL, title TEXT, subtitle TEXT, description_md TEXT, category TEXT, level TEXT, modality TEXT DEFAULT 'recorded', price_mxn INTEGER DEFAULT 0, currency TEXT DEFAULT 'MXN', cover_url TEXT, promo_video_url TEXT, duration_hours REAL, status TEXT DEFAULT 'draft', certificate_kind TEXT DEFAULT 'vortice', objectives_md TEXT, syllabus_md TEXT, target_audience_md TEXT, prerequisites_md TEXT, stps_course_key TEXT, brand_theme TEXT, generation_json TEXT, sequential INTEGER DEFAULT 1, published_at INTEGER, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_modules (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, position INTEGER, title TEXT, description_md TEXT, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_lessons (id TEXT PRIMARY KEY, module_id TEXT NOT NULL, course_id TEXT NOT NULL, position INTEGER, title TEXT, kind TEXT DEFAULT 'text', video_url TEXT, body_md TEXT, duration_minutes INTEGER, is_preview INTEGER DEFAULT 0, exam_id TEXT, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_exams (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, title TEXT, passing_score INTEGER DEFAULT 80, max_attempts INTEGER DEFAULT 3, time_limit_minutes INTEGER, shuffle INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_questions (id TEXT PRIMARY KEY, exam_id TEXT NOT NULL, position INTEGER, prompt_md TEXT, kind TEXT DEFAULT 'single', options TEXT, explanation_md TEXT, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_enrollments (id TEXT PRIMARY KEY, student_id INTEGER NOT NULL, course_id TEXT NOT NULL, edition_id TEXT, order_id TEXT, status TEXT DEFAULT 'active', progress_pct INTEGER DEFAULT 0, completed_at INTEGER, created_at INTEGER, updated_at INTEGER, UNIQUE (student_id, course_id))"),
    t("CREATE TABLE IF NOT EXISTS c_lesson_progress (id TEXT PRIMARY KEY, enrollment_id TEXT NOT NULL, lesson_id TEXT NOT NULL, completed_at INTEGER, watched_seconds INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER, UNIQUE (enrollment_id, lesson_id))"),
    t("CREATE TABLE IF NOT EXISTS c_exam_attempts (id TEXT PRIMARY KEY, enrollment_id TEXT NOT NULL, exam_id TEXT NOT NULL, started_at INTEGER, submitted_at INTEGER, score INTEGER, passed INTEGER DEFAULT 0, answers TEXT, qorder TEXT, created_at INTEGER, updated_at INTEGER)"),
    // names, course and dates are copied at issue time: the certificate never changes if the course is edited later
    t("CREATE TABLE IF NOT EXISTS c_certificates (id TEXT PRIMARY KEY, enrollment_id TEXT, student_id INTEGER, course_id TEXT, edition_id TEXT, kind TEXT DEFAULT 'vortice', folio TEXT UNIQUE NOT NULL, issued_at INTEGER, pdf_url TEXT, verify_token TEXT UNIQUE NOT NULL, revoked INTEGER DEFAULT 0, revoked_reason TEXT, student_name TEXT, course_title TEXT, hours REAL, modality TEXT, period TEXT, instructor_name TEXT, course_key TEXT, objectives TEXT, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_folios (year INTEGER PRIMARY KEY, n INTEGER NOT NULL)"),
    t("CREATE TABLE IF NOT EXISTS c_settings (id INTEGER PRIMARY KEY CHECK (id = 1), premier_price_mxn INTEGER, commission_pct INTEGER DEFAULT 20, generation_limit_per_month INTEGER DEFAULT 5, regen_limit_per_course INTEGER DEFAULT 10, ace_registration_number TEXT, certificate_signer_name TEXT, certificate_signer_title TEXT, onboarding_course_id TEXT, usd_mxn_rate REAL DEFAULT 18.5, seed_version INTEGER DEFAULT 0, updated_at INTEGER)"),
    t("CREATE INDEX IF NOT EXISTS c_modules_course ON c_modules (course_id, position)"),
    t("CREATE INDEX IF NOT EXISTS c_lessons_course ON c_lessons (course_id)"),
    t("CREATE INDEX IF NOT EXISTS c_questions_exam ON c_questions (exam_id, position)"),
    t("CREATE INDEX IF NOT EXISTS c_enrollments_student ON c_enrollments (student_id)"),
    t("CREATE INDEX IF NOT EXISTS c_attempts_enrollment ON c_exam_attempts (enrollment_id)"),
  ]);
  await migratePagos(env);
  await migrateEstudio(env);
  await seed(env);
  ready = true;
}

// the onboarding course (PLATAFORMA-CURSOS.md §9): upserted with fixed ids, so a new SEED_VERSION updates the text without touching anyone's progress
async function seed(env) {
  const s = await env.DB.prepare("SELECT seed_version FROM c_settings WHERE id = 1").first();
  if (s && s.seed_version >= SEED_VERSION) return;
  const now = Date.now(), st = [];
  const P = (sql, ...v) => st.push(env.DB.prepare(sql).bind(...v));
  P(`INSERT INTO c_settings (id, premier_price_mxn, onboarding_course_id, seed_version, updated_at) VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET onboarding_course_id = excluded.onboarding_course_id, seed_version = excluded.seed_version, updated_at = excluded.updated_at`,
    Math.round(Number(env.PREMIER_PRICE_MXN || 0) * 100) || null, COURSE.id, SEED_VERSION, now);
  const c = COURSE;
  P(`INSERT INTO c_courses (id, instructor_id, slug, title, subtitle, description_md, category, level, modality, price_mxn, duration_hours, status, certificate_kind, objectives_md, target_audience_md, prerequisites_md, sequential, published_at, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, 1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, title = excluded.title, subtitle = excluded.subtitle, description_md = excluded.description_md, category = excluded.category, level = excluded.level,
       modality = excluded.modality, price_mxn = excluded.price_mxn, duration_hours = excluded.duration_hours, certificate_kind = excluded.certificate_kind, objectives_md = excluded.objectives_md,
       target_audience_md = excluded.target_audience_md, prerequisites_md = excluded.prerequisites_md, updated_at = excluded.updated_at`,
    c.id, c.slug, c.title, c.subtitle, c.description_md, c.category, c.level, c.modality, c.price_mxn, c.duration_hours, c.certificate_kind, c.objectives_md, c.target_audience_md, c.prerequisites_md, now, now, now);
  MODULES.forEach((m, i) => {
    P(`INSERT INTO c_modules (id, course_id, position, title, description_md, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET position = excluded.position, title = excluded.title, description_md = excluded.description_md, updated_at = excluded.updated_at`, m.id, c.id, i + 1, m.title, m.description_md, now, now);
    m.lessons.forEach((l, j) => P(`INSERT INTO c_lessons (id, module_id, course_id, position, title, kind, body_md, duration_minutes, is_preview, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET module_id = excluded.module_id, position = excluded.position, title = excluded.title, kind = excluded.kind, body_md = excluded.body_md,
         duration_minutes = excluded.duration_minutes, is_preview = excluded.is_preview, updated_at = excluded.updated_at`, l.id, m.id, c.id, j + 1, l.title, l.kind, l.body_md, l.duration_minutes, l.is_preview, now, now));
  });
  const e = EXAM;
  P(`INSERT INTO c_exams (id, course_id, title, passing_score, max_attempts, time_limit_minutes, shuffle, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, passing_score = excluded.passing_score, max_attempts = excluded.max_attempts, time_limit_minutes = excluded.time_limit_minutes, shuffle = excluded.shuffle, updated_at = excluded.updated_at`,
    e.id, c.id, e.title, e.passing_score, e.max_attempts, e.time_limit_minutes, e.shuffle, now, now);
  e.questions.forEach((q, i) => P(`INSERT INTO c_questions (id, exam_id, position, prompt_md, kind, options, explanation_md, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET position = excluded.position, prompt_md = excluded.prompt_md, kind = excluded.kind, options = excluded.options, explanation_md = excluded.explanation_md, updated_at = excluded.updated_at`,
    q.id, e.id, i + 1, q.prompt_md, q.kind, JSON.stringify(q.options), q.explanation_md, now, now));
  await env.DB.batch(st);
}

const uid = () => crypto.randomUUID();
const token = () => { const b = crypto.getRandomValues(new Uint8Array(16)); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const shuffle = a => { const r = crypto.getRandomValues(new Uint32Array(a.length)); for (let i = a.length - 1; i > 0; i--) { const j = r[i] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// where the public pages live: cursos.vorticevr.mx in production (the worker sends it to vorticevr.mx/cursos/), the same origin when testing
const baseUrl = (env, url) => /^(localhost|127\.)/.test(url.hostname) ? url.origin + "/cursos" : (env.CURSOS_URL || "https://cursos.vorticevr.mx");

async function settings(env) { return (await env.DB.prepare("SELECT * FROM c_settings WHERE id = 1").first()) || {}; }
async function courseBySlug(env, slug) {
  return SLUG.test(slug) ? env.DB.prepare("SELECT c.*, u.name AS instructor_name, p.headline AS instructor_headline, p.bio AS instructor_bio, p.avatar_url AS instructor_avatar, p.premier_status, p.premier_until FROM c_courses c LEFT JOIN users u ON u.id = c.instructor_id LEFT JOIN c_profiles p ON p.user_id = c.instructor_id WHERE c.slug = ?").bind(slug).first() : null;
}
// can this user see a course that is not published yet (its instructor or an admin)
const canPreview = (h, env, user, c) => !!user && (c.instructor_id === user.id || h.isAdmin(env, user));
async function outline(env, courseId) {
  const [{ results: mods }, { results: less }] = await Promise.all([
    env.DB.prepare("SELECT id, position, title, description_md FROM c_modules WHERE course_id = ? ORDER BY position").bind(courseId).all(),
    env.DB.prepare("SELECT l.* FROM c_lessons l JOIN c_modules m ON m.id = l.module_id WHERE l.course_id = ? ORDER BY m.position, l.position").bind(courseId).all(),
  ]);
  return { mods, less };
}
const instructorOf = c => ({ name: c.instructor_name || "Vórtice VR", headline: c.instructor_headline || (c.instructor_id ? "" : "Estudio de tecnología inmersiva"), bio: c.instructor_bio || "", avatar: c.instructor_avatar || "" });
const courseCard = c => ({ slug: c.slug, title: c.title, subtitle: c.subtitle, category: c.category, level: c.level, modality: c.modality, price_mxn: c.price_mxn, cover_url: c.cover_url, duration_hours: c.duration_hours, certificate_kind: c.certificate_kind });
async function enrollmentOf(env, user, courseId) {
  return user ? env.DB.prepare("SELECT * FROM c_enrollments WHERE student_id = ? AND course_id = ?").bind(user.id, courseId).first() : null;
}

const LIB = { uid, settings, courseBySlug, ready: schema, onboardingSlug: ONBOARDING_SLUG };
// Stripe events of the courses (worker.js's webhook asks first; true = it was ours)
export const cursosStripeEvent = (env, ctx, ev, h) => cursosWebhook(env, ctx, ev, h, LIB);

export async function cursosApi(request, env, ctx, url, path, h) {
  await schema(env);
  const M = request.method, user = await h.auth(request, env);
  const { json } = h;
  const done3 = await estudioApi(request, env, ctx, url, path, h, user, LIB);   // block 3: the course studio, the manual, course review
  if (done3) return done3;
  const done2 = await pagosApi(request, env, ctx, url, path, h, user, LIB);   // block 2: instructors, Premier, buying, admin
  if (done2) return done2;
  const body = async () => { try { return await request.json(); } catch { return {}; } };
  let m;

  // catalog: every published course
  if (path === "/api/cursos/catalogo" && M === "GET") {
    const { results } = await env.DB.prepare("SELECT c.*, u.name AS instructor_name, p.premier_status, p.premier_until, (SELECT COUNT(*) FROM c_lessons l WHERE l.course_id = c.id) AS lessons FROM c_courses c LEFT JOIN users u ON u.id = c.instructor_id LEFT JOIN c_profiles p ON p.user_id = c.instructor_id WHERE c.status = 'published' ORDER BY c.published_at DESC LIMIT 300").all();
    results.splice(0, results.length, ...results.filter(sellable));   // an instructor without Premier (past the 7 days of grace) is not listed; enrolled students keep their course
    return json({ courses: results.map(c => ({ ...courseCard(c), instructor: c.instructor_name || "Vórtice VR", lessons: c.lessons })) }, 200, { "Cache-Control": "public, max-age=60" });
  }

  // sales page: the outline (titles only), the preview lessons in full, the instructor and whether this user is already in
  if ((m = path.match(/^\/api\/cursos\/curso\/([a-z0-9-]+)$/)) && M === "GET") {
    const c = await courseBySlug(env, m[1]);
    if (!c || (c.status !== "published" && !canPreview(h, env, user, c))) return json({ error: "Este curso no existe o todavía no se publica." }, 404);
    const { mods, less } = await outline(env, c.id);
    const exam = await env.DB.prepare("SELECT e.passing_score, (SELECT COUNT(*) FROM c_questions q WHERE q.exam_id = e.id) AS n FROM c_exams e WHERE e.course_id = ?").bind(c.id).first();
    const en = await enrollmentOf(env, user, c.id);
    return json({
      course: { ...courseCard(c), description_md: c.description_md, objectives_md: c.objectives_md, target_audience_md: c.target_audience_md, prerequisites_md: c.prerequisites_md, promo_video_url: c.promo_video_url, status: c.status, landing: landingOf(c), brand_theme: c.brand_theme || "vortice", logo_url: c.logo_url || "" },
      instructor: instructorOf(c),
      modules: mods.map(md => ({ title: md.title, description_md: md.description_md, lessons: less.filter(l => l.module_id === md.id).map(l => ({ id: l.id, title: l.title, kind: l.kind, duration_minutes: l.duration_minutes, preview: !!l.is_preview, ...(l.is_preview ? { body_md: l.body_md, video_url: l.video_url } : {}) })) })),
      exam: exam && exam.n ? { questions: exam.n, passing_score: exam.passing_score } : null,
      enrolled: !!(en && en.status !== "refunded"), signedIn: !!user, sellable: sellable(c), billing: !!user && billingOn(env, h, user),
    });
  }

  // enroll: free courses now; paid ones go through Stripe Checkout (block 2)
  if ((m = path.match(/^\/api\/cursos\/curso\/([a-z0-9-]+)\/inscribir$/)) && M === "POST") {
    if (!user) return json({ error: "Inicia sesión para inscribirte." }, 401);
    const c = await courseBySlug(env, m[1]);
    if (!c || c.status !== "published") return json({ error: "Este curso no está disponible." }, 404);
    const en = await enrollmentOf(env, user, c.id);
    if (en && en.status !== "refunded") return json({ ok: true, already: true });
    if (c.price_mxn > 0) return json({ error: "Este curso es de pago: cómpralo desde su página.", buy: true }, 402);
    const now = Date.now();
    if (en) await env.DB.prepare("UPDATE c_enrollments SET status = 'active', updated_at = ? WHERE id = ?").bind(now, en.id).run();
    else await env.DB.prepare("INSERT INTO c_enrollments (id, student_id, course_id, status, progress_pct, created_at, updated_at) VALUES (?, ?, ?, 'active', 0, ?, ?)").bind(uid(), user.id, c.id, now, now).run();
    return json({ ok: true });
  }

  // My learning: my courses, progress and certificates
  if (path === "/api/cursos/mis" && M === "GET") {
    if (!user) return json({ error: "Inicia sesión." }, 401);
    const { results } = await env.DB.prepare(`SELECT e.status, e.progress_pct, e.completed_at, e.created_at, c.slug, c.title, c.subtitle, c.cover_url, c.modality, c.duration_hours, k.folio, k.verify_token, k.revoked
      FROM c_enrollments e JOIN c_courses c ON c.id = e.course_id LEFT JOIN c_certificates k ON k.enrollment_id = e.id WHERE e.student_id = ? AND e.status != 'refunded' ORDER BY e.updated_at DESC`).bind(user.id).all();
    return json({ name: user.name, courses: results.map(r => ({ slug: r.slug, title: r.title, subtitle: r.subtitle, cover_url: r.cover_url, modality: r.modality, duration_hours: r.duration_hours, progress: r.progress_pct, completed: !!r.completed_at,
      certificate: r.folio ? { folio: r.folio, token: r.verify_token, revoked: !!r.revoked } : null })) });
  }

  // the player: everything of an enrolled course (except the exam's answers)
  if ((m = path.match(/^\/api\/cursos\/aprender\/([a-z0-9-]+)(\/leccion|\/examen|\/examen\/enviar)?$/))) {
    if (!user) return json({ error: "Inicia sesión.", login: true }, 401);
    const c = await courseBySlug(env, m[1]);
    if (!c) return json({ error: "Este curso no existe." }, 404);
    let en = await enrollmentOf(env, user, c.id);
    if (!en || en.status === "refunded") {
      if (!canPreview(h, env, user, c)) return json({ error: "No estás inscrito en este curso.", enroll: true }, 403);
      en = null;   // its instructor or an admin can look at it, without saving progress
    }
    const { mods, less } = await outline(env, c.id);
    const exam = await env.DB.prepare("SELECT * FROM c_exams WHERE course_id = ?").bind(c.id).first();
    const done = new Set(en ? (await env.DB.prepare("SELECT lesson_id FROM c_lesson_progress WHERE enrollment_id = ? AND completed_at IS NOT NULL").bind(en.id).all()).results.map(r => r.lesson_id) : []);
    const attempts = en && exam ? (await env.DB.prepare("SELECT * FROM c_exam_attempts WHERE enrollment_id = ? AND exam_id = ? ORDER BY started_at").bind(en.id, exam.id).all()).results : [];
    const allDone = less.every(l => done.has(l.id));

    if (!m[2] && M === "GET") {
      const cert = en ? await env.DB.prepare("SELECT folio, verify_token, revoked FROM c_certificates WHERE enrollment_id = ?").bind(en.id).first() : null;
      const sub = attempts.filter(a => a.submitted_at), passed = sub.some(a => a.passed);
      return json({
        course: { slug: c.slug, title: c.title, modality: c.modality, sequential: !!c.sequential, duration_hours: c.duration_hours },
        preview: !en, name: user.name,
        modules: mods.map(md => ({ title: md.title, lessons: less.filter(l => l.module_id === md.id).map(l => ({ id: l.id, title: l.title, kind: l.kind, duration_minutes: l.duration_minutes, body_md: l.body_md, video_url: l.video_url, done: done.has(l.id) })) })),
        progress: en ? en.progress_pct : 0,
        exam: exam ? { title: exam.title, passing_score: exam.passing_score, max_attempts: exam.max_attempts, time_limit_minutes: exam.time_limit_minutes, available: allDone, used: sub.length, passed,
          best: sub.reduce((b, a) => Math.max(b, a.score || 0), 0) } : null,
        certificate: cert ? { folio: cert.folio, token: cert.verify_token, revoked: !!cert.revoked } : null,
        manual: /"manual":\{/.test(c.generation_json || ""),
      });
    }

    if (m[2] === "/leccion" && M === "POST") {
      if (!en) return json({ ok: true, preview: true });
      const b = await body(), i = less.findIndex(l => l.id === b.lesson);
      if (i < 0) return json({ error: "Esa lección no es de este curso." }, 400);
      if (c.sequential && less.slice(0, i).some(l => !done.has(l.id))) return json({ error: "Completa primero las lecciones anteriores." }, 409);
      const now = Date.now();
      await env.DB.prepare(`INSERT INTO c_lesson_progress (id, enrollment_id, lesson_id, completed_at, watched_seconds, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(enrollment_id, lesson_id) DO UPDATE SET completed_at = COALESCE(c_lesson_progress.completed_at, excluded.completed_at), watched_seconds = MAX(c_lesson_progress.watched_seconds, excluded.watched_seconds), updated_at = excluded.updated_at`)
        .bind(uid(), en.id, b.lesson, now, Math.max(0, Math.round(Number(b.watched) || 0)), now, now).run();
      done.add(b.lesson);
      const pct = Math.round(100 * less.filter(l => done.has(l.id)).length / Math.max(1, less.length));
      await env.DB.prepare("UPDATE c_enrollments SET progress_pct = ?, updated_at = ? WHERE id = ?").bind(pct, now, en.id).run();
      return json({ ok: true, progress: pct, examAvailable: less.every(l => done.has(l.id)) });
    }

    if (!exam) return json({ error: "Este curso no tiene examen." }, 404);
    const qs = (await env.DB.prepare("SELECT * FROM c_questions WHERE exam_id = ? ORDER BY position").bind(exam.id).all()).results.map(q => ({ ...q, options: JSON.parse(q.options || "[]") }));
    const sub = attempts.filter(a => a.submitted_at);
    const limitMs = exam.time_limit_minutes ? exam.time_limit_minutes * 60e3 : 0;

    // start (or resume) an attempt: questions and options in this attempt's order, without what is correct
    if (m[2] === "/examen" && M === "POST") {
      if (!en) return json({ error: "La vista previa no presenta el examen." }, 403);
      if (!allDone) return json({ error: "Completa todas las lecciones para presentar el examen." }, 409);
      if (sub.some(a => a.passed)) return json({ error: "Ya aprobaste este examen." }, 409);
      if (sub.length >= exam.max_attempts) return json({ error: "Ya usaste todos tus intentos." }, 409);
      const now = Date.now();
      let at = attempts.find(a => !a.submitted_at && (!limitMs || a.started_at + limitMs > now));
      if (!at) {
        await env.DB.prepare("DELETE FROM c_exam_attempts WHERE enrollment_id = ? AND exam_id = ? AND submitted_at IS NULL").bind(en.id, exam.id).run();   // an abandoned one that ran out of time
        const order = (exam.shuffle ? shuffle([...qs]) : qs).map(q => ({ id: q.id, o: q.kind === "truefalse" || !exam.shuffle ? q.options.map(o => o.id) : shuffle(q.options.map(o => o.id)) }));
        at = { id: uid(), started_at: now, qorder: JSON.stringify(order) };
        await env.DB.prepare("INSERT INTO c_exam_attempts (id, enrollment_id, exam_id, started_at, qorder, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(at.id, en.id, exam.id, now, at.qorder, now, now).run();
      }
      const byId = Object.fromEntries(qs.map(q => [q.id, q]));
      return json({
        attempt: at.id, number: sub.length + 1, max_attempts: exam.max_attempts, passing_score: exam.passing_score,
        ends_at: limitMs ? at.started_at + limitMs : null, now,
        questions: JSON.parse(at.qorder).filter(o => byId[o.id]).map(o => { const q = byId[o.id]; return { id: q.id, kind: q.kind, prompt_md: q.prompt_md, options: o.o.map(id => q.options.find(x => x.id === id)).filter(Boolean).map(x => ({ id: x.id, text: x.text })) }; }),
      });
    }

    // grade: here, never in the browser
    if (m[2] === "/examen/enviar" && M === "POST") {
      if (!en) return json({ error: "La vista previa no presenta el examen." }, 403);
      const b = await body();
      const at = attempts.find(a => a.id === b.attempt && !a.submitted_at);
      if (!at) return json({ error: "Ese intento ya se envió o no existe." }, 409);
      const now = Date.now(), ans = b.answers && typeof b.answers === "object" ? b.answers : {};
      const late = limitMs && now > at.started_at + limitMs + 60e3;   // a minute of grace for the network
      let right = 0; const saved = {};
      const review = qs.map(q => {
        const chosen = late ? [] : [...new Set((Array.isArray(ans[q.id]) ? ans[q.id] : [ans[q.id]]).map(String))].filter(id => q.options.some(o => o.id === id)).slice(0, q.options.length);
        const want = q.options.filter(o => o.correct).map(o => o.id);
        const ok = chosen.length === want.length && want.every(id => chosen.includes(id));
        if (ok) right++;
        saved[q.id] = chosen;
        return { q, chosen, ok };
      });
      const score = Math.round(100 * right / Math.max(1, qs.length)), passed = score >= exam.passing_score;
      await env.DB.prepare("UPDATE c_exam_attempts SET submitted_at = ?, score = ?, passed = ?, answers = ?, updated_at = ? WHERE id = ?").bind(now, score, passed ? 1 : 0, JSON.stringify(saved), now, at.id).run();
      const left = exam.max_attempts - sub.length - 1, reveal = passed || left <= 0;
      let certificate = null;
      if (passed) certificate = await issueCertificate(env, ctx, url, h, user, c, en);
      return json({
        score, passed, right, total: qs.length, passing_score: exam.passing_score, attempts_left: Math.max(0, left), late: !!late, certificate,
        // what they answered and its feedback; what was correct only once they passed or have no attempts left
        review: review.map(({ q, chosen, ok }) => ({ id: q.id, prompt_md: q.prompt_md, ok,
          options: q.options.map(o => ({ id: o.id, text: o.text, chosen: chosen.includes(o.id), ...(chosen.includes(o.id) ? { feedback: o.feedback } : {}), ...(reveal ? { correct: !!o.correct } : {}) })),
          ...(reveal || ok ? { explanation_md: q.explanation_md } : {}) })),
      });
    }
    return json({ error: "No encontrado" }, 404);
  }

  // public verification (no sign-in)
  if ((m = path.match(/^\/api\/cursos\/verificar\/([A-Za-z0-9_-]{10,40})$/)) && M === "GET") {
    const k = await env.DB.prepare("SELECT * FROM c_certificates WHERE verify_token = ?").bind(m[1]).first();
    if (!k) return json({ error: "No encontramos esta constancia." }, 404);
    return json({ folio: k.folio, student: k.student_name, course: k.course_title, hours: k.hours, modality: k.modality, period: k.period, instructor: k.instructor_name, kind: k.kind,
      issued_at: k.issued_at, revoked: !!k.revoked, revoked_reason: k.revoked ? k.revoked_reason || "" : undefined, pdf: `/api/cursos/constancia/${k.verify_token}.pdf` });
  }
  if ((m = path.match(/^\/api\/cursos\/constancia\/([A-Za-z0-9_-]{10,40})\.pdf$/)) && M === "GET") {
    const k = await env.DB.prepare("SELECT * FROM c_certificates WHERE verify_token = ?").bind(m[1]).first();
    if (!k) return json({ error: "No encontramos esta constancia." }, 404);
    const pdf = certificatePdf(certData(k, await settings(env), baseUrl(env, url)));
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Constancia ${k.folio}.pdf"`, "Cache-Control": "no-store" } });
  }

  return json({ error: "No encontrado" }, 404);
}

// the sales page text: the generator's landing (block 3) when there is one, else from the course itself
function landingOf(c) {
  try { const g = JSON.parse(c.generation_json || "null"); if (g && g.landing) return g.landing; } catch {}
  return null;
}

const certData = (k, s, base) => ({ folio: k.folio, student: k.student_name, course: k.course_title, hours: k.hours, modality: k.modality, period: k.period, instructor: k.instructor_name, kind: k.kind,
  courseKey: k.course_key, objectives: k.objectives, verifyUrl: `${base}/verificar/${k.verify_token}`, ace: s.ace_registration_number || "", signer: s.certificate_signer_name || "", signerTitle: s.certificate_signer_title || "", revoked: !!k.revoked });

async function issueCertificate(env, ctx, url, h, user, c, en) {
  const old = await env.DB.prepare("SELECT folio, verify_token FROM c_certificates WHERE enrollment_id = ?").bind(en.id).first();
  if (old) return { folio: old.folio, token: old.verify_token };
  const now = Date.now(), year = Number(new Date(now - 6 * 3600e3).toISOString().slice(0, 4));   // Mexico (UTC−6)
  const row = await env.DB.prepare("INSERT INTO c_folios (year, n) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET n = n + 1 RETURNING n").bind(year).first();
  const folio = `VVR-${year}-${String(row.n).padStart(6, "0")}`, tk = token();
  const objectives = String(c.objectives_md || "").replace(/^[-*]\s*/gm, "").split("\n").map(s => s.trim()).filter(Boolean).join("; ").slice(0, 300);
  const k = { id: uid(), enrollment_id: en.id, student_id: user.id, course_id: c.id, kind: c.certificate_kind || "vortice", folio, issued_at: now, verify_token: tk,
    student_name: user.name || user.email, course_title: c.title, hours: c.duration_hours, modality: c.modality, period: h.fecha(now), instructor_name: c.instructor_name || "Vórtice VR",
    course_key: c.stps_course_key || "", objectives, revoked: 0 };
  const base = baseUrl(env, url);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO c_certificates (id, enrollment_id, student_id, course_id, kind, folio, issued_at, pdf_url, verify_token, student_name, course_title, hours, modality, period, instructor_name, course_key, objectives, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(k.id, en.id, user.id, c.id, k.kind, folio, now, `/api/cursos/constancia/${tk}.pdf`, tk, k.student_name, k.course_title, k.hours, k.modality, k.period, k.instructor_name, k.course_key, k.objectives, now, now),
    env.DB.prepare("UPDATE c_enrollments SET status = 'completed', progress_pct = 100, completed_at = ?, updated_at = ? WHERE id = ?").bind(now, now, en.id),
    // the onboarding course unlocks "Crear curso" (with the approved profile and Premier)
    ...(c.slug === ONBOARDING_SLUG ? [env.DB.prepare("INSERT INTO c_profiles (user_id, onboarding_passed, created_at, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(user_id) DO UPDATE SET onboarding_passed = 1, updated_at = excluded.updated_at").bind(user.id, now, now)] : []),
  ]);
  ctx.waitUntil((async () => {
    const pdf = certificatePdf(certData(k, await settings(env), base));
    let bin = ""; for (let i = 0; i < pdf.length; i += 0x8000) bin += String.fromCharCode.apply(null, pdf.subarray(i, i + 0x8000));
    const verify = `${base}/verificar/${tk}`;
    await h.sendMail(env, user.email, `Tu constancia de "${c.title}"`, h.shell(`<h1 style="font-size:20px">¡Felicidades, ${h.esc(k.student_name)}!</h1>
      <p>Aprobaste el curso <b>${h.esc(c.title)}</b>. Te adjuntamos tu constancia con folio <b>${folio}</b>.</p>
      <p>Cualquiera puede comprobar que es auténtica en su página de verificación (también con el código QR de la constancia).</p>${h.btnMail(verify, "Ver mi constancia")}`,
      "Recibiste este correo por tu cuenta en la plataforma de cursos de Vórtice VR."),
      [{ filename: `Constancia ${folio}.pdf`, content: btoa(bin) }]);
  })().catch(e => console.error("constancia", e.message)));
  return { folio, token: tk };
}
