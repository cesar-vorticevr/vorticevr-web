// Plataforma de cursos, bloque 3: el estudio del instructor (/cursos/crear/). Entrevista guiada que se guarda paso a paso,
// material de apoyo (texto extraído en el navegador de PDF, DOCX, PPTX o TXT), generación de las 5 piezas con Claude
// (_cursos/generador.js) con límites por mes y por curso, edición a mano y regeneración por pieza, videos por lección,
// envío a revisión y la revisión del admin. Al enviar, las piezas se vuelven el curso de verdad (módulos, lecciones,
// examen) con ids fijos por posición, así el avance de un alumno sobrevive a una corrección.
import { SCHEMAS, PIECES, PIECE_ORDER, PROMPT_VERSION, MATERIAL_DIRECT, check, examProblems, courseContext, outlineOf, costOf,
  generatePiece, suggestTitles, summarizeMaterial, genMessage } from "./generador.js";
import { premierOk } from "./pagos.js";

export const THEMES = ["vortice", "aurora", "terracota", "oceano", "bosque", "carmin"];
export const CATEGORIES = ["Negocios y emprendimiento", "Marketing y ventas", "Finanzas y contabilidad", "Tecnología", "Diseño y creatividad", "Salud y bienestar",
  "Seguridad e higiene", "Industria y procesos", "Educación y docencia", "Idiomas", "Gastronomía", "Oficios", "Desarrollo personal", "Otro"];
const LEVELS = ["Básico", "Intermedio", "Avanzado"];
const MODALITIES = ["recorded", "live", "mixed"];
// the interview: field → [max length | type]
const FIELDS = { tema: 300, nombre: 120, categoria: "cat", nivel: "level", alumno: 1500, problema: 1500, resultados: 2000, temario: 6000, errores: 3000, ejemplos: 4000,
  modalidad: "mod", horas: "hours", fechas: 300, laboral: "bool", clave: 40, requisitos: 1000, precio: "price", tema_visual: "theme" };
const NEEDED = { tema: "de qué trata", alumno: "para quién es", problema: "qué problema tiene tu alumno", resultados: "qué podrá hacer al terminar", temario: "el temario", modalidad: "la modalidad", horas: "la duración" };
const MATERIAL_MAX = 600000;   // characters of material in all (the rest gets summarized before generating)
const VIDEO_HOSTS = /^(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com|vimeo\.com|player\.vimeo\.com|iframe\.mediadelivery\.net|player\.mediadelivery\.net)$/;
const STUCK = 15 * 60e3;   // a piece "running" longer than this was abandoned (closed tab)

export async function migrateEstudio(env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS c_generation_jobs (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, instructor_id INTEGER, kind TEXT NOT NULL, piece TEXT, parent_id TEXT, regen INTEGER DEFAULT 0, status TEXT DEFAULT 'queued', model TEXT, prompt_version INTEGER, input_json TEXT, output_json TEXT, tokens_in INTEGER DEFAULT 0, tokens_out INTEGER DEFAULT 0, cost_mxn REAL DEFAULT 0, error TEXT, started_at INTEGER, finished_at INTEGER, created_at INTEGER, updated_at INTEGER)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS c_jobs_course ON c_generation_jobs (course_id, created_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS c_jobs_instructor ON c_generation_jobs (instructor_id, created_at)"),
  ]);
  const row = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'c_courses'").first();
  if (row && !/\binterview_json\b/.test(row.sql)) {
    try { await env.DB.batch(["interview_json TEXT", "material_json TEXT", "material_summary TEXT", "review_note TEXT", "submitted_at INTEGER", "logo_url TEXT"].map(c => env.DB.prepare(`ALTER TABLE c_courses ADD COLUMN ${c}`))); }
    catch (e) { console.error("migración estudio", e.message); }
  }
}

const J = (s, d) => { try { return JSON.parse(s || "null") ?? d; } catch { return d; } };
const monthStart = () => { const d = new Date(Date.now() - 6 * 3600e3); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + 6 * 3600e3; };   // Mexico (UTC−6)
const slugify = s => String(s || "curso").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "curso";
const hasMissing = v => /\[COMPLETAR/i.test(JSON.stringify(v || ""));

async function canCreate(env, h, user) {
  if (h.isAdmin(env, user)) return true;
  const p = await env.DB.prepare("SELECT * FROM c_profiles WHERE user_id = ?").bind(user.id).first();
  return !!p && p.instructor_status === "approved" && !!p.onboarding_passed && premierOk(p);
}
async function limits(env, lib, user, courseId) {
  const s = await lib.settings(env);
  const month = (await env.DB.prepare("SELECT COUNT(*) AS n FROM c_generation_jobs WHERE instructor_id = ? AND kind = 'full' AND created_at >= ? AND status != 'failed'").bind(user.id, monthStart()).first()).n;
  const regen = courseId ? (await env.DB.prepare("SELECT COUNT(*) AS n FROM c_generation_jobs WHERE course_id = ? AND kind = 'piece' AND regen = 1 AND status = 'done'").bind(courseId).first()).n : 0;
  const perMonth = s.generation_limit_per_month ?? 5, perCourse = s.regen_limit_per_course ?? 10;
  return { month: { used: month, max: perMonth, left: Math.max(0, perMonth - month) }, regen: { used: regen, max: perCourse, left: Math.max(0, perCourse - regen) }, rate: s.usd_mxn_rate || 18.5 };
}
function cleanInterview(prev, b) {
  const iv = { ...prev };
  for (const [k, t] of Object.entries(FIELDS)) {
    if (!(k in b)) continue;
    const v = b[k];
    if (typeof t === "number") iv[k] = String(v ?? "").trim().slice(0, t);
    else if (t === "cat") iv[k] = CATEGORIES.includes(v) ? v : "";
    else if (t === "level") iv[k] = LEVELS.includes(v) ? v : "";
    else if (t === "mod") iv[k] = MODALITIES.includes(v) ? v : "";
    else if (t === "hours") { const n = Math.round(Number(v) * 2) / 2; iv[k] = n >= 0.5 && n <= 300 ? n : ""; }
    else if (t === "price") { const n = Math.round(Number(v)); iv[k] = v === "" || v == null ? "" : n >= 0 && n <= 200000 ? n : ""; }
    else if (t === "bool") iv[k] = !!v;
    else if (t === "theme") iv[k] = THEMES.includes(v) ? v : "vortice";
  }
  return iv;
}
// lessons of the generated course, with the instructor's video links and preview marks (generation_json.media["m-l"])
function lessonsOf(g) {
  const out = [];
  (g.course ? g.course.modules : []).forEach((m, i) => m.lessons.forEach((l, j) => out.push({ key: `${i}-${j}`, i, j, l, media: (g.media || {})[`${i}-${j}`] || {} })));
  return out;
}
const lessonBody = l => `${l.script_md}${l.key_points.length ? `\n\n## Puntos clave\n${l.key_points.map(p => `- ${p}`).join("\n")}` : ""}`;

// the generated pieces → the course students take (modules, lessons, exam); ids by position, so progress survives a re-apply
async function materialize(env, c, g, iv) {
  const now = Date.now(), st = [], P = (sql, ...v) => st.push(env.DB.prepare(sql).bind(...v));
  const co = g.course, ex = g.exam, examId = `${c.id}-ex`;
  P("DELETE FROM c_lessons WHERE course_id = ?", c.id);
  P("DELETE FROM c_modules WHERE course_id = ?", c.id);
  P("DELETE FROM c_questions WHERE exam_id = ?", examId);
  co.modules.forEach((m, i) => {
    P("INSERT INTO c_modules (id, course_id, position, title, description_md, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", `${c.id}-m${i}`, c.id, i + 1, m.title, m.description_md, now, now);
    m.lessons.forEach((l, j) => {
      const md = (g.media || {})[`${i}-${j}`] || {};
      P("INSERT INTO c_lessons (id, module_id, course_id, position, title, kind, video_url, body_md, duration_minutes, is_preview, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        `${c.id}-m${i}-l${j}`, `${c.id}-m${i}`, c.id, j + 1, l.title, md.video ? "video" : "text", md.video || null, lessonBody(l), l.duration_minutes, md.preview ? 1 : 0, now, now);
    });
  });
  P(`INSERT INTO c_exams (id, course_id, title, passing_score, max_attempts, shuffle, created_at, updated_at) VALUES (?, ?, 'Examen final', 80, 3, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`, examId, c.id, now, now);
  ex.questions.forEach((q, k) => P("INSERT INTO c_questions (id, exam_id, position, prompt_md, kind, options, explanation_md, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    `${c.id}-q${k}`, examId, k + 1, q.prompt_md, q.kind, JSON.stringify(q.options.map((o, n) => ({ id: String.fromCharCode(97 + n), text: o.text, correct: o.correct, feedback: o.feedback }))), q.explanation_md, now, now));
  P(`UPDATE c_courses SET title = ?, subtitle = ?, description_md = ?, objectives_md = ?, syllabus_md = ?, target_audience_md = ?, prerequisites_md = ?, category = ?, level = ?, modality = ?,
      price_mxn = ?, duration_hours = ?, certificate_kind = ?, stps_course_key = ?, brand_theme = ?, updated_at = ? WHERE id = ?`,
    co.title, co.subtitle, co.description_md, co.objectives_md, co.syllabus_md, co.target_audience_md, iv.requisitos || co.prerequisites_md, iv.categoria || "Otro", iv.nivel || "Básico",
    iv.modalidad || "recorded", Math.round((Number(iv.precio) || 0) * 100), Number(iv.horas) || null, iv.laboral ? "dc3" : "vortice", iv.laboral ? iv.clave || null : null, iv.tema_visual || "vortice", now, c.id);
  await env.DB.batch(st);
}
// what still stops a course from going to review
function sendProblems(c, g, iv) {
  const out = [];
  for (const p of PIECE_ORDER) if (!g[p]) out.push(`Falta generar: ${PIECES[p].label}`);
  if (out.length) return out;
  if (!c.cover_url) out.push("Sube la foto de portada (paso 9)");
  if (iv.precio === "" || iv.precio == null) out.push("Pon el precio (paso 9; 0 = gratis)");
  if (g.exam.questions.length < 10) out.push("El examen necesita al menos 10 preguntas");
  out.push(...examProblems(g.exam));
  if (iv.modalidad === "recorded") { const sin = lessonsOf(g).filter(x => x.l.kind === "video" && !x.media.video); if (sin.length) out.push(`Faltan ${sin.length} videos: enlaza uno en cada lección de video (pestaña Videos)`); }
  for (const p of ["course", "manual", "exam", "landing"]) if (hasMissing(g[p])) out.push(`${PIECES[p].label}: quedan marcadores [COMPLETAR: …] por llenar`);
  return out;
}

export async function estudioApi(request, env, ctx, url, path, h, user, lib) {
  const M = request.method, { json } = h;
  const body = async () => { try { return await request.json(); } catch { return {}; } };
  let m;

  // public files of a course
  if ((m = path.match(/^\/api\/cursos\/archivo\/(portada|logo)\/([\w-]+)$/)) && M === "GET") {
    const obj = await env.MEDIA.get(`cursos/${m[1]}/${m[2]}`);
    if (!obj) return json({ error: "No existe" }, 404);
    return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata && obj.httpMetadata.contentType || "image/jpeg", "Cache-Control": "public, max-age=86400" } });
  }

  // the manual (printable): its instructor, an admin, or an enrolled student
  if ((m = path.match(/^\/api\/cursos\/manual\/([a-z0-9-]+)$/)) && M === "GET") {
    if (!user) return json({ error: "Inicia sesión.", login: true }, 401);
    const c = await lib.courseBySlug(env, m[1]);
    if (!c) return json({ error: "Este curso no existe." }, 404);
    const own = c.instructor_id === user.id || h.isAdmin(env, user);
    const en = own ? null : await env.DB.prepare("SELECT status FROM c_enrollments WHERE student_id = ? AND course_id = ?").bind(user.id, c.id).first();
    if (!own && !(en && en.status !== "refunded")) return json({ error: "El manual es para los inscritos en el curso." }, 403);
    const g = J(c.generation_json, {});
    if (!g.manual) return json({ error: "Este curso no tiene manual." }, 404);
    return json({ title: c.title, subtitle: c.subtitle, theme: c.brand_theme || "vortice", instructor: c.instructor_name || "Vórtice VR", logo: c.logo_url || "", cover: c.cover_url || "", manual: g.manual, modules: (g.course || {}).modules ? g.course.modules.map(x => x.title) : [] });
  }

  // ---------- admin: courses in review and API usage ----------
  if (path.startsWith("/api/cursos/admin/cursos") || path === "/api/cursos/admin/consumo") {
    if (!user) return json({ error: "Inicia sesión.", login: true }, 401);
    if (!h.isAdmin(env, user)) return json({ error: "No tienes acceso." }, 403);
    if (path === "/api/cursos/admin/consumo" && M === "GET") {
      const { results } = await env.DB.prepare(`SELECT j.instructor_id, u.name, u.email, strftime('%Y-%m', (j.created_at - 21600000) / 1000, 'unixepoch') AS month, SUM(CASE WHEN j.kind != 'full' THEN 1 ELSE 0 END) AS calls,
          SUM(CASE WHEN j.kind != 'full' THEN j.tokens_in ELSE 0 END) AS tin, SUM(CASE WHEN j.kind != 'full' THEN j.tokens_out ELSE 0 END) AS tout,
          ROUND(SUM(CASE WHEN j.kind != 'full' THEN j.cost_mxn ELSE 0 END), 2) AS cost, SUM(CASE WHEN j.kind = 'full' AND j.status != 'failed' THEN 1 ELSE 0 END) AS fulls
        FROM c_generation_jobs j LEFT JOIN users u ON u.id = j.instructor_id GROUP BY j.instructor_id, month ORDER BY month DESC, cost DESC LIMIT 300`).all();
      return json({ list: results });
    }
    if (path === "/api/cursos/admin/cursos" && M === "GET") {
      const st = ["in_review", "published", "draft"].includes(url.searchParams.get("estado")) ? url.searchParams.get("estado") : "in_review";
      const { results } = await env.DB.prepare(`SELECT c.id, c.slug, c.title, c.subtitle, c.status, c.price_mxn, c.modality, c.duration_hours, c.certificate_kind, c.submitted_at, c.published_at, c.review_note, c.cover_url,
          u.name, u.email, (SELECT COUNT(*) FROM c_lessons l WHERE l.course_id = c.id) AS lessons, (SELECT COUNT(*) FROM c_questions q WHERE q.exam_id = c.id || '-ex') AS questions
        FROM c_courses c LEFT JOIN users u ON u.id = c.instructor_id WHERE c.status = ? AND c.instructor_id IS NOT NULL ORDER BY COALESCE(c.submitted_at, c.updated_at) DESC LIMIT 200`).bind(st).all();
      return json({ list: results });
    }
    if ((m = path.match(/^\/api\/cursos\/admin\/cursos\/([\w-]+)$/)) && M === "POST") {
      const b = await body(), approve = b.action === "approve", note = String(b.note || "").trim().slice(0, 1000);
      if (!approve && b.action !== "reject") return json({ error: "Acción inválida." }, 400);
      if (!approve && note.length < 5) return json({ error: "Escribe qué necesita corregir: le llega al instructor." }, 400);
      const c = await env.DB.prepare("SELECT c.*, u.email, u.name FROM c_courses c JOIN users u ON u.id = c.instructor_id WHERE c.id = ?").bind(m[1]).first();
      if (!c || c.status !== "in_review") return json({ error: "Ese curso no está en revisión." }, 409);
      const now = Date.now();
      await env.DB.prepare("UPDATE c_courses SET status = ?, review_note = ?, published_at = CASE WHEN ? THEN ? ELSE published_at END, updated_at = ? WHERE id = ?")
        .bind(approve ? "published" : "draft", note || null, approve ? 1 : 0, now, now, c.id).run();
      const link = `${h.siteUrl(env)}/cursos/${approve ? c.slug + "/" : "crear/?id=" + c.id}`;
      ctx.waitUntil(h.sendMail(env, c.email, approve ? `¡Tu curso "${c.title}" ya está publicado!` : `Tu curso "${c.title}" necesita cambios`, h.shell(approve
        ? `<h1 style="font-size:20px">¡Tu curso ya está a la venta!</h1><p>Aprobamos <b>${h.esc(c.title)}</b>. Ya aparece en el catálogo y en su página de venta.</p>${note ? `<p>${h.esc(note)}</p>` : ""}${h.btnMail(link, "Ver la página de mi curso")}`
        : `<h1 style="font-size:20px">Tu curso necesita cambios</h1><p>Revisamos <b>${h.esc(c.title)}</b> y antes de publicarlo necesitamos lo siguiente:</p><p style="background:#1b0a36;padding:12px;border-radius:10px;white-space:pre-wrap">${h.esc(note)}</p>${h.btnMail(link, "Corregir mi curso")}`,
        "Recibiste este correo por tu curso en la plataforma de cursos de Vórtice VR.")));
      return json({ ok: true });
    }
    return json({ error: "No encontrado" }, 404);
  }

  if (!path.startsWith("/api/cursos/estudio")) return null;
  if (!user) return json({ error: "Inicia sesión.", login: true }, 401);

  // my courses
  if (path === "/api/cursos/estudio" && M === "GET") {
    const { results } = await env.DB.prepare(`SELECT c.id, c.slug, c.title, c.status, c.modality, c.updated_at, c.cover_url, c.review_note, c.generation_json, c.interview_json,
        (SELECT COUNT(*) FROM c_enrollments e WHERE e.course_id = c.id AND e.status != 'refunded') AS students,
        (SELECT COALESCE(SUM(o.instructor_net_mxn), 0) FROM c_orders o WHERE o.course_id = c.id AND o.status = 'paid') AS net
      FROM c_courses c WHERE c.instructor_id = ? ORDER BY c.updated_at DESC LIMIT 100`).bind(user.id).all();
    return json({ canCreate: await canCreate(env, h, user), limits: await limits(env, lib, user), courses: results.map(c => {
      const g = J(c.generation_json, {}), iv = J(c.interview_json, {});
      return { id: c.id, slug: c.slug, title: (g.course && g.course.title) || iv.nombre || iv.tema || "Curso sin nombre", status: c.status, modality: c.modality, updated_at: c.updated_at, cover: c.cover_url, review_note: c.review_note,
        pieces: PIECE_ORDER.filter(p => g[p]).length, students: c.students, net: c.net };
    }) });
  }
  if (path === "/api/cursos/estudio" && M === "POST") {
    if (!(await canCreate(env, h, user))) return json({ error: "Para crear cursos necesitas tu perfil aprobado, la inducción aprobada y Premier activo." }, 403);
    const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM c_courses WHERE instructor_id = ? AND status IN ('draft', 'generating')").bind(user.id).first()).n;
    if (n >= 10) return json({ error: "Tienes 10 cursos en borrador. Termina o borra alguno antes de empezar otro." }, 409);
    const id = lib.uid(), now = Date.now(), slug = "borrador-" + id.slice(0, 8);
    await env.DB.prepare("INSERT INTO c_courses (id, instructor_id, slug, title, status, interview_json, brand_theme, created_at, updated_at) VALUES (?, ?, ?, 'Curso sin nombre', 'draft', ?, 'vortice', ?, ?)")
      .bind(id, user.id, slug, JSON.stringify({ tema_visual: "vortice", modalidad: "recorded" }), now, now).run();
    return json({ id });
  }

  m = path.match(/^\/api\/cursos\/estudio\/([\w-]+)(\/[\w/-]+)?$/);
  if (!m) return json({ error: "No encontrado" }, 404);
  const c = await env.DB.prepare("SELECT * FROM c_courses WHERE id = ?").bind(m[1]).first();
  if (!c || (c.instructor_id !== user.id && !h.isAdmin(env, user))) return json({ error: "No encontramos ese curso." }, 404);
  const sub = m[2] || "", iv = J(c.interview_json, {}), g = J(c.generation_json, {}), mat = J(c.material_json, []);
  const editable = c.status === "draft" || c.status === "generating";
  const now = Date.now();
  const saveG = gg => env.DB.prepare("UPDATE c_courses SET generation_json = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(gg), Date.now(), c.id).run();

  if (!sub && M === "GET") {
    const running = (await env.DB.prepare("SELECT piece, parent_id, started_at FROM c_generation_jobs WHERE course_id = ? AND kind = 'piece' AND status = 'running' AND started_at > ?").bind(c.id, now - STUCK).all()).results;
    const { results: jobs } = await env.DB.prepare("SELECT piece, status, error, finished_at FROM c_generation_jobs WHERE course_id = ? AND kind = 'piece' ORDER BY created_at DESC LIMIT 40").bind(c.id).all();
    return json({ id: c.id, slug: c.slug, status: c.status, editable, review_note: c.review_note, cover: c.cover_url || "", logo: c.logo_url || "", interview: iv,
      material: mat.map((x, i) => ({ i, name: x.name, chars: x.text.length })), materialChars: mat.reduce((a, x) => a + x.text.length, 0), materialSummarized: !!c.material_summary,
      generation: g, running: running.map(r => r.piece), lastErrors: Object.fromEntries(PIECE_ORDER.map(p => [p, (jobs.find(j => j.piece === p) || {})]).filter(([, j]) => j.status === "failed").map(([p, j]) => [p, j.error])),
      limits: await limits(env, lib, user, c.id), problems: g.course ? sendProblems(c, g, iv) : null, categories: CATEGORIES, themes: THEMES });
  }
  if (sub === "" && M === "DELETE") {
    if (!editable) return json({ error: "Solo se borran cursos en borrador." }, 409);
    if ((await env.DB.prepare("SELECT 1 FROM c_enrollments WHERE course_id = ? LIMIT 1").bind(c.id).first())) return json({ error: "Este curso tiene alumnos." }, 409);
    await env.MEDIA.delete([`cursos/portada/${c.id}`, `cursos/logo/${c.id}`]);
    await env.DB.batch([env.DB.prepare("DELETE FROM c_lessons WHERE course_id = ?").bind(c.id), env.DB.prepare("DELETE FROM c_modules WHERE course_id = ?").bind(c.id),
      env.DB.prepare("DELETE FROM c_questions WHERE exam_id = ?").bind(c.id + "-ex"), env.DB.prepare("DELETE FROM c_exams WHERE course_id = ?").bind(c.id), env.DB.prepare("DELETE FROM c_courses WHERE id = ?").bind(c.id)]);
    return json({ ok: true });
  }
  if (!editable && M !== "GET") return json({ error: c.status === "in_review" ? "Tu curso está en revisión: espera la respuesta." : "Este curso ya está publicado. Para cambiarlo, escríbenos a hola@vorticevr.mx." }, 409);

  // the interview, step by step
  if (sub === "/entrevista" && M === "PUT") {
    const b = await body(), next = cleanInterview(iv, b.answers || {});
    await env.DB.prepare("UPDATE c_courses SET interview_json = ?, brand_theme = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(next), next.tema_visual || "vortice", now, c.id).run();
    return json({ ok: true, interview: next });
  }
  // material: text extracted in the browser (PDF, DOCX, PPTX, TXT)
  if (sub === "/material" && M === "POST") {
    const b = await body(), text = String(b.text || "").replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 50) return json({ error: "No encontramos texto en ese archivo. Si es un escaneo o puras imágenes, copia el texto y pégalo." }, 400);
    if (mat.length >= 10) return json({ error: "Máximo 10 archivos de material." }, 400);
    const total = mat.reduce((a, x) => a + x.text.length, 0);
    if (total + text.length > MATERIAL_MAX) return json({ error: `Tu material ya es muy largo (máximo ${MATERIAL_MAX.toLocaleString("es-MX")} caracteres en total). Quita algo o sube solo lo más importante.` }, 400);
    mat.push({ name: String(b.name || "material").slice(0, 120), text });
    await env.DB.prepare("UPDATE c_courses SET material_json = ?, material_summary = NULL, updated_at = ? WHERE id = ?").bind(JSON.stringify(mat), now, c.id).run();
    return json({ ok: true, chars: text.length });
  }
  if ((m = sub.match(/^\/material\/(\d+)$/)) && M === "DELETE") {
    mat.splice(Number(m[1]), 1);
    await env.DB.prepare("UPDATE c_courses SET material_json = ?, material_summary = NULL, updated_at = ? WHERE id = ?").bind(JSON.stringify(mat), now, c.id).run();
    return json({ ok: true });
  }
  if ((m = sub.match(/^\/(portada|logo)$/)) && M === "POST") {
    const f = (await request.formData()).get("file");
    if (!f || typeof f === "string" || !/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 3 * 1024 * 1024) return json({ error: "Sube una imagen JPG, PNG o WebP de menos de 3 MB." }, 400);
    await env.MEDIA.put(`cursos/${m[1]}/${c.id}`, await f.arrayBuffer(), { httpMetadata: { contentType: f.type } });
    const u = `/api/cursos/archivo/${m[1]}/${c.id}?v=${now}`;
    await env.DB.prepare(`UPDATE c_courses SET ${m[1] === "portada" ? "cover_url" : "logo_url"} = ?, updated_at = ? WHERE id = ?`).bind(u, now, c.id).run();
    return json({ ok: true, url: u });
  }

  const instructor = await env.DB.prepare("SELECT u.name, p.headline, p.bio FROM users u LEFT JOIN c_profiles p ON p.user_id = u.id WHERE u.id = ?").bind(c.instructor_id).first() || {};
  const rate = (await lib.settings(env)).usd_mxn_rate || 18.5;
  const logJob = (j, usage, model, status, error) => env.DB.prepare("UPDATE c_generation_jobs SET status = ?, model = ?, tokens_in = ?, tokens_out = ?, cost_mxn = ?, error = ?, finished_at = ?, updated_at = ? WHERE id = ?")
    .bind(status, model || null, ...(usage ? Object.values(costOf(usage, model, rate)) : [0, 0, 0]), error || null, Date.now(), Date.now(), j).run();
  const newJob = (kind, extra = {}) => { const id = lib.uid(); return env.DB.prepare("INSERT INTO c_generation_jobs (id, course_id, instructor_id, kind, piece, parent_id, regen, status, prompt_version, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?)")
    .bind(id, c.id, c.instructor_id, kind, extra.piece || null, extra.parent || null, extra.regen ? 1 : 0, PROMPT_VERSION, Date.now(), Date.now(), Date.now()).run().then(() => id); };
  const context = () => courseContext(iv, instructor, c.material_summary || mat.map(x => `### ${x.name}\n${x.text}`).join("\n\n"));

  // title ideas (Haiku 5.5)
  if (sub === "/titulos" && M === "POST") {
    if (!iv.tema) return json({ error: "Primero escribe de qué trata tu curso." }, 400);
    if (!(await h.limit(env, `ctit:${user.id}`, 15, 864e5))) return json({ error: "Ya pediste muchas ideas hoy. Intenta mañana." }, 429);
    const j = await newJob("titles");
    try { const r = await suggestTitles(env, courseContext(iv, instructor, "")); await logJob(j, r.usage, r.model, "done"); return json({ options: r.data }); }
    catch (e) { await logJob(j, null, null, "failed", e.message); return json({ error: genMessage(e) }, e.status === 503 ? 503 : 502); }
  }

  // start a full generation: limits, material summary if it is long, then the browser asks for each piece
  if (sub === "/generar" && M === "POST") {
    const miss = Object.entries(NEEDED).filter(([k]) => iv[k] === undefined || iv[k] === "" || iv[k] === null).map(([, t]) => t);
    if (miss.length) return json({ error: "Antes de generar, completa: " + miss.join(", ") + "." }, 400);
    if (!(await canCreate(env, h, user))) return json({ error: "Tu Premier no está activo." }, 403);
    const L = await limits(env, lib, user, c.id);
    if (!L.month.left) return json({ error: `Ya usaste tus ${L.month.max} generaciones de este mes. Puedes regenerar piezas sueltas o esperar al mes que entra.` }, 429);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "El generador todavía no está configurado (falta la clave de la API)." }, 503);
    const total = mat.reduce((a, x) => a + x.text.length, 0);
    if (total > MATERIAL_DIRECT && !c.material_summary) {
      const j = await newJob("summary");
      try {
        const r = await summarizeMaterial(env, mat.map(x => `### ${x.name}\n${x.text}`).join("\n\n"));
        await env.DB.prepare("UPDATE c_courses SET material_summary = ? WHERE id = ?").bind(r.text, c.id).run();
        c.material_summary = r.text; await logJob(j, r.usage, r.model, "done");
      } catch (e) { await logJob(j, null, null, "failed", e.message); return json({ error: genMessage(e) }, 502); }
    }
    const job = await newJob("full");
    await env.DB.prepare("UPDATE c_courses SET status = 'generating', updated_at = ? WHERE id = ?").bind(now, c.id).run();
    return json({ job, pieces: PIECE_ORDER, limits: await limits(env, lib, user, c.id) });
  }

  // generate one piece: as part of a full generation (job) or a regeneration (regen, with an optional note); streams NDJSON progress
  if ((m = sub.match(/^\/pieza\/(\w+)$/)) && M === "POST" && PIECES[m[1]]) {
    const piece = m[1], b = await body(), note = String(b.note || "").trim().slice(0, 1000);
    let parent = null;
    if (b.regen) {
      if (!g[piece]) return json({ error: "Esa pieza todavía no se genera." }, 409);
      const L = await limits(env, lib, user, c.id);
      if (!L.regen.left) return json({ error: `Ya usaste las ${L.regen.max} regeneraciones de este curso. Puedes editar el texto a mano.` }, 429);
    } else {
      const full = await env.DB.prepare("SELECT * FROM c_generation_jobs WHERE id = ? AND course_id = ? AND kind = 'full'").bind(String(b.job || ""), c.id).first();
      if (!full || full.started_at < now - 2 * 3600e3) return json({ error: "Empieza la generación de nuevo." }, 409);
      if (await env.DB.prepare("SELECT 1 FROM c_generation_jobs WHERE parent_id = ? AND piece = ? AND status = 'done'").bind(full.id, piece).first()) return json({ error: "Esa pieza ya se generó." }, 409);
      parent = full.id;
    }
    if (piece !== "course" && !g.course) return json({ error: "Primero se genera el curso." }, 409);
    if (await env.DB.prepare("SELECT 1 FROM c_generation_jobs WHERE course_id = ? AND piece = ? AND status = 'running' AND started_at > ?").bind(c.id, piece, now - STUCK).first())
      return json({ error: "Esa pieza ya se está generando." }, 409);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "El generador todavía no está configurado (falta la clave de la API)." }, 503);
    const j = await newJob("piece", { piece, parent, regen: !!b.regen });
    const { readable, writable } = new TransformStream(), w = writable.getWriter(), te = new TextEncoder();
    const send = o => w.write(te.encode(JSON.stringify(o) + "\n")).catch(() => {});
    const work = (async () => {
      let last = 0;
      const beat = setInterval(() => send({ alive: 1 }), 10000);   // keeps the connection open while the model thinks
      try {
        const r = await generatePiece(env, { piece, context: context(), outline: outlineOf(g.course), note, onProgress: n => { if (n - last >= 1500) { last = n; send({ chars: n }); } } });
        const fresh = J((await env.DB.prepare("SELECT generation_json FROM c_courses WHERE id = ?").bind(c.id).first()).generation_json, {});   // other pieces may have finished meanwhile
        fresh[piece] = r.data;
        await saveG(fresh);
        await logJob(j, r.usage, r.model, "done");
        send({ ok: true, piece, data: r.data, warnings: piece === "exam" ? examProblems(r.data) : [] });
      } catch (e) {
        console.error("generador", piece, e && e.message);
        await logJob(j, null, null, "failed", genMessage(e));
        send({ error: genMessage(e) });
      } finally {
        clearInterval(beat);
        if (parent) {   // the full generation ends when none of its pieces is still running
          const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM c_generation_jobs WHERE course_id = ? AND kind = 'piece' AND status = 'running' AND started_at > ?").bind(c.id, Date.now() - STUCK).first();
          if (!left.n) {
            const ok = await env.DB.prepare("SELECT COUNT(DISTINCT piece) AS n FROM c_generation_jobs WHERE parent_id = ? AND status = 'done'").bind(parent).first();
            await env.DB.batch([env.DB.prepare(`UPDATE c_generation_jobs SET status = ?1, finished_at = ?2, tokens_in = (SELECT COALESCE(SUM(tokens_in), 0) FROM c_generation_jobs WHERE parent_id = ?3),
                tokens_out = (SELECT COALESCE(SUM(tokens_out), 0) FROM c_generation_jobs WHERE parent_id = ?3), cost_mxn = (SELECT COALESCE(SUM(cost_mxn), 0) FROM c_generation_jobs WHERE parent_id = ?3) WHERE id = ?3`)
                .bind(ok.n ? "done" : "failed", Date.now(), parent),
              env.DB.prepare("UPDATE c_courses SET status = 'draft' WHERE id = ? AND status = 'generating'").bind(c.id)]);
          }
        }
        await w.close().catch(() => {});
      }
    })();
    ctx.waitUntil(work);
    return new Response(readable, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  }

  // the instructor edits a piece by hand
  if ((m = sub.match(/^\/pieza\/(\w+)$/)) && M === "PUT" && PIECES[m[1]]) {
    const b = await body();
    let data;
    try { data = check(SCHEMAS[m[1]], b.data); } catch (e) { return json({ error: "Revisa lo que editaste: " + e.message }, 400); }
    g[m[1]] = data;
    await saveG(g);
    return json({ ok: true, warnings: m[1] === "exam" ? examProblems(data) : [], problems: sendProblems(c, g, iv) });
  }
  // videos and preview lessons
  if (sub === "/videos" && M === "PUT") {
    const b = await body(), media = {}, keys = new Set(lessonsOf(g).map(x => x.key));
    for (const [k, v] of Object.entries(b.media || {})) {
      if (!keys.has(k) || !v || typeof v !== "object") continue;
      let video = String(v.video || "").trim();
      if (video) {
        let u; try { u = new URL(video); } catch { return json({ error: "Revisa el link del video de la lección " + k.replace("-", ".") }, 400); }
        if (u.protocol !== "https:" || !VIDEO_HOSTS.test(u.hostname)) return json({ error: "Los videos van en YouTube (no listado), Vimeo o Bunny Stream: pega el link de ahí." }, 400);
        video = u.toString().slice(0, 400);
      }
      if (video || v.preview) media[k] = { video, preview: !!v.preview };
    }
    g.media = media;
    await saveG(g);
    return json({ ok: true, problems: sendProblems(c, g, iv) });
  }
  // send to review: everything ready → the course is built, gets its address and waits for Vórtice VR
  if (sub === "/enviar" && M === "POST") {
    if (!(await canCreate(env, h, user))) return json({ error: "Tu Premier no está activo." }, 403);
    const probs = sendProblems(c, g, iv);
    if (probs.length) return json({ error: "Antes de enviarlo: " + probs.join(" · "), problems: probs }, 400);
    let slug = c.slug;
    if (slug.startsWith("borrador-")) {
      const base = slugify(g.course.title);
      for (let i = 1; i < 50; i++) {
        const s = i === 1 ? base : `${base}-${i}`;
        if (["aprender", "verificar", "mi-aprendizaje", "curso", "instructor", "admin", "crear", "manual", "ediciones", "ventas"].includes(s)) continue;
        if (!(await env.DB.prepare("SELECT 1 FROM c_courses WHERE slug = ? AND id != ?").bind(s, c.id).first())) { slug = s; break; }
      }
    }
    await materialize(env, c, g, iv);
    await env.DB.prepare("UPDATE c_courses SET slug = ?, status = 'in_review', submitted_at = ?, review_note = NULL, updated_at = ? WHERE id = ?").bind(slug, now, now, c.id).run();
    ctx.waitUntil(h.sendMail(env, env.CONTACT_TO || "hola@vorticevr.mx", `[Cursos] Curso por revisar: ${g.course.title}`, h.shell(`<h1 style="font-size:20px">Curso por revisar</h1>
      <p><b>${h.esc(g.course.title)}</b><br>${h.esc(instructor.name || "")} · ${lessonsOf(g).length} lecciones · ${g.exam.questions.length} preguntas · $${Number(iv.precio || 0).toLocaleString("es-MX")} MXN</p>
      ${h.btnMail(h.siteUrl(env) + "/cursos/admin/", "Revisar en el admin de cursos")}`, "Aviso automático de la plataforma de cursos.")));
    return json({ ok: true, slug });
  }
  // preview while editing: build the course as it is now (only drafts; the sales page and player show it to its instructor)
  if (sub === "/vista-previa" && M === "POST") {
    if (PIECE_ORDER.slice(0, 3).some(p => !g[p])) return json({ error: "Primero genera el curso, el manual y el examen." }, 409);
    await materialize(env, c, g, iv);
    return json({ ok: true, slug: c.slug });
  }
  return json({ error: "No encontrado" }, 404);
}
