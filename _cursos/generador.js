// Generador de cursos con la API de Claude (PLATAFORMA-CURSOS.md §4). Cada pieza (curso, manual, examen, página de venta,
// kit de marketing) es una llamada aparte, así una que falla no tira las demás y se puede regenerar sola.
// - SDK oficial (_cursos/vendor/anthropic.js), siempre desde el servidor: la clave nunca llega al navegador.
// - Salida estructurada (output_config.format con json_schema): nunca se interpreta prosa libre. Además se valida
//   aquí con el mismo esquema (check) antes de guardar, también lo que el instructor edita a mano.
// - Streaming (respuestas largas sin timeouts) y fallbacks: "default" para que una negativa del clasificador se reintente sola.
// - El contexto del curso (reglas + entrevista + material) va en el system con cache_control: las 5 piezas lo comparten.
// - Prompts versionados en _cursos/prompts/*.md (wrangler los importa como texto); PROMPT_VERSION se guarda en cada job.
import Anthropic from "./vendor/anthropic.js";
import SISTEMA from "./prompts/sistema.md";
import P_CURSO from "./prompts/curso.md";
import P_MANUAL from "./prompts/manual.md";
import P_EXAMEN from "./prompts/examen.md";
import P_LANDING from "./prompts/landing.md";
import P_MARKETING from "./prompts/marketing.md";
import P_RESUMEN from "./prompts/resumen.md";
import P_TITULOS from "./prompts/titulos.md";
import P_EDICION from "./prompts/edicion.md";

export const MODEL = "claude-sonnet-5-5";   // generation (the spec names it)
export const SMALL = "claude-haiku-5-5";    // small tasks: titles, summarizing long material
export const PROMPT_VERSION = 1;
const PRICE = { "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5] };   // USD per million tokens (input, output)
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

// ---------- schemas (the subset structured outputs accept: no min/max; counts are asked for in the prompts) ----------
const O = props => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });
const S = { type: "string" }, A = items => ({ type: "array", items }), I = { type: "integer" }, B = { type: "boolean" };
export const SCHEMAS = {
  course: O({
    title: S, subtitle: S, description_md: S, objectives_md: S, syllabus_md: S, target_audience_md: S, prerequisites_md: S,
    modules: A(O({ title: S, description_md: S, lessons: A(O({ title: S, kind: { type: "string", enum: ["video", "text"] }, duration_minutes: I, script_md: S, key_points: A(S) })) })),
  }),
  manual: O({ intro_md: S, chapters: A(O({ title: S, body_md: S })), glossary: A(O({ term: S, definition: S })), closing_md: S }),
  exam: O({ questions: A(O({ prompt_md: S, kind: { type: "string", enum: ["single", "multiple", "truefalse"] }, options: A(O({ text: S, correct: B, feedback: S })), explanation_md: S })) }),
  landing: O({ headline: S, subheadline: S, promise_md: S, for_whom: A(S), not_for_whom: A(S), outcomes: A(S), faq: A(O({ q: S, a: S })), promo_video_script_md: S, cta_text: S }),
  marketing: O({
    instagram_posts: A(O({ caption: S, image_headline: S, image_subline: S })), facebook_posts: A(O({ text: S })),
    tiktok_scripts: A(O({ hook: S, body: S, cta: S })), linkedin_post: O({ text: S }), whatsapp_message: O({ text: S }),
    email_sequence: A(O({ subject: S, body_md: S })), ad_copy: A(O({ headline: S, primary_text: S, cta: S })),
  }),
};
const TITLES = O({ options: A(O({ title: S, subtitle: S })) });
const MAIL = O({ subject: S, body_md: S });
export const EDITION_SCHEMA = O({ instagram_posts: A(O({ caption: S, image_headline: S, image_subline: S })), facebook_posts: A(O({ text: S })), whatsapp_message: O({ text: S }), reminder_7d: MAIL, reminder_1d: MAIL, reminder_1h: MAIL });
export const PIECES = {
  course: { prompt: P_CURSO, max: 32000, effort: "high", label: "Curso" },
  manual: { prompt: P_MANUAL, max: 64000, effort: "medium", label: "Manual" },
  exam: { prompt: P_EXAMEN, max: 24000, effort: "high", label: "Examen" },
  landing: { prompt: P_LANDING, max: 8000, effort: "medium", label: "Página de venta" },
  marketing: { prompt: P_MARKETING, max: 16000, effort: "medium", label: "Kit de marketing" },
};
export const PIECE_ORDER = ["course", "manual", "exam", "landing", "marketing"];

// validates (and trims) a value against one of the schemas above; throws with the path of the first problem
export function check(schema, v, path = "") {
  if (schema.type === "object") {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(`${path || "dato"}: se esperaba un objeto`);
    const out = {};
    for (const k of Object.keys(schema.properties)) {
      if (!(k in v)) throw new Error(`${path}${path ? "." : ""}${k}: falta`);
      out[k] = check(schema.properties[k], v[k], `${path}${path ? "." : ""}${k}`);
    }
    return out;
  }
  if (schema.type === "array") {
    if (!Array.isArray(v)) throw new Error(`${path}: se esperaba una lista`);
    if (v.length > 300) throw new Error(`${path}: demasiados elementos`);
    return v.map((x, i) => check(schema.items, x, `${path}[${i}]`));
  }
  if (schema.type === "string") {
    if (typeof v !== "string") throw new Error(`${path}: se esperaba texto`);
    const s = v.trim().slice(0, 40000);
    if (schema.enum && !schema.enum.includes(s)) throw new Error(`${path}: valor inválido`);
    return s;
  }
  if (schema.type === "integer") { const n = Math.round(Number(v)); if (!Number.isFinite(n) || n < 0 || n > 100000) throw new Error(`${path}: número inválido`); return n; }
  if (schema.type === "boolean") { if (typeof v !== "boolean") throw new Error(`${path}: se esperaba sí/no`); return v; }
  throw new Error("esquema desconocido");
}
// beyond the schema: rules the exam needs to be gradable
export function examProblems(exam) {
  const out = [];
  exam.questions.forEach((q, i) => {
    const n = q.options.filter(o => o.correct).length;
    if (q.options.length < 2) out.push(`Pregunta ${i + 1}: necesita al menos 2 opciones`);
    else if (q.kind === "truefalse" && q.options.length !== 2) out.push(`Pregunta ${i + 1}: verdadero o falso lleva exactamente 2 opciones`);
    if (!n) out.push(`Pregunta ${i + 1}: no tiene respuesta correcta`);
    else if (q.kind !== "multiple" && n > 1) out.push(`Pregunta ${i + 1}: solo puede tener una correcta (o cámbiala a opción múltiple)`);
  });
  return out;
}

// ---------- the course context: the interview, as the instructor wrote it, plus the material ----------
const QUESTIONS = [
  ["tema", "De qué trata el curso, en una frase"], ["nombre", "Nombre que el instructor tiene pensado"], ["categoria", "Categoría"], ["nivel", "Nivel"],
  ["alumno", "Para quién es: el alumno típico"], ["problema", "Qué problema tiene hoy ese alumno"],
  ["resultados", "Qué va a poder hacer al terminar (resultados)"], ["temario", "Temario, como lo explicaría a un amigo"],
  ["errores", "Errores más comunes que ve el instructor"], ["ejemplos", "Ejemplos, casos y anécdotas que usa"],
  ["modalidad", "Modalidad"], ["horas", "Duración total estimada (horas)"], ["fechas", "Fechas de la primera edición (en vivo)"],
  ["laboral", "¿Es capacitación laboral (DC-3)?"], ["clave", "Clave interna del curso"], ["requisitos", "Requisitos previos"],
];
const MOD = { recorded: "Grabado (videos que el alumno toma a su ritmo)", live: "En vivo (sesiones en Zoom o Meet)", mixed: "Mixto (videos y sesiones en vivo)" };
export function courseContext(iv, instructor, material) {
  const val = (k, v) => k === "modalidad" ? MOD[v] || v : k === "laboral" ? (v ? "Sí" : "No") : v;
  const lines = QUESTIONS.filter(([k]) => iv[k] !== undefined && iv[k] !== "" && iv[k] !== null).map(([k, q]) => `### ${q}\n${val(k, iv[k])}`);
  return `## Instructor\n${instructor.name}${instructor.headline ? ` · ${instructor.headline}` : ""}\n${instructor.bio ? `\n${instructor.bio}\n` : ""}\n## Entrevista con el instructor\n\n${lines.join("\n\n")}` +
    (material ? `\n\n## Material que subió el instructor (fuente para el contenido técnico)\n\n${material}` : "\n\n(El instructor no subió material: usa solo la entrevista.)");
}
// what the other pieces need to know about the generated course: its outline
export function outlineOf(course) {
  if (!course) return "";
  return `## Curso ya definido\n${course.title} — ${course.subtitle}\n\n${course.objectives_md}\n\n` + course.modules.map((m, i) =>
    `### Módulo ${i + 1}: ${m.title}\n` + m.lessons.map((l, j) => `- ${i + 1}.${j + 1} ${l.title} (${l.duration_minutes} min): ${l.key_points.join("; ")}`).join("\n")).join("\n\n");
}

// ---------- calls ----------
const client = env => {
  if (!env.ANTHROPIC_API_KEY) throw Object.assign(new Error("El generador todavía no está configurado (falta la clave de la API)."), { status: 503 });
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: 2, timeout: 15 * 60e3 });
};
export function costOf(usage, model, rate) {
  const [pi, po] = PRICE[model] || PRICE[MODEL];
  const inTok = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  const usd = ((usage.input_tokens || 0) * pi + (usage.cache_creation_input_tokens || 0) * pi * 1.25 + (usage.cache_read_input_tokens || 0) * pi * 0.1 + (usage.output_tokens || 0) * po) / 1e6;
  return { tokens_in: inTok, tokens_out: usage.output_tokens || 0, cost_mxn: Math.round(usd * (rate || 18.5) * 100) / 100 };
}
// the JSON text of the final message: after the last fallback block, if a fallback model took over mid-stream
function finalText(msg) {
  const blocks = msg.content || [], last = blocks.map(b => b.type).lastIndexOf("fallback");
  return blocks.slice(last + 1).filter(b => b.type === "text").map(b => b.text).join("");
}
export class GenError extends Error {}
// an error of the call → what the instructor reads (typed SDK errors, most specific first)
export function genMessage(e) {
  if (e instanceof GenError || e.status === 503) return e.message;
  if (e instanceof Anthropic.RateLimitError) return "Hay mucha demanda en este momento. Espera un minuto y vuelve a intentarlo.";
  if (e instanceof Anthropic.APIConnectionError) return "Se perdió la conexión con el generador. Vuelve a intentarlo.";
  if (e instanceof Anthropic.APIError) return e.status >= 500 ? "El generador tuvo un problema. Vuelve a intentarlo en unos minutos." : "No se pudo generar esta pieza. Vuelve a intentarlo.";
  return "No se pudo generar esta pieza. Vuelve a intentarlo.";
}
function finish(msg, schema) {
  if (msg.stop_reason === "refusal") throw new GenError("El modelo no pudo generar esta pieza con lo que diste. Revisa la entrevista o agrega una nota y vuelve a intentarlo.");
  if (msg.stop_reason === "max_tokens") throw new GenError("La pieza salió demasiado larga y se cortó. Vuelve a generarla con una nota como \"más breve\".");
  let data;
  try { data = JSON.parse(finalText(msg)); } catch { throw new GenError("La respuesta llegó incompleta. Vuelve a intentarlo."); }
  try { return check(schema, data); } catch (e) { throw new GenError("La respuesta no tiene la forma esperada (" + e.message + "). Vuelve a intentarlo."); }
}

// one piece, streamed; onProgress(characters) while it writes
export async function generatePiece(env, { piece, context, outline, note, onProgress }) {
  const P = PIECES[piece], schema = SCHEMAS[piece];
  const user = [P.prompt, outline && piece !== "course" ? outline : "", note ? `## Indicaciones del instructor para esta versión\n${note}` : ""].filter(Boolean).join("\n\n");
  const stream = client(env).beta.messages.stream({
    model: MODEL, max_tokens: P.max,
    betas: [FALLBACK_BETA], fallbacks: "default",
    output_config: { effort: P.effort, format: { type: "json_schema", schema } },
    system: [{ type: "text", text: SISTEMA }, { type: "text", text: context, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  let chars = 0;
  stream.on("text", d => { chars += d.length; onProgress && onProgress(chars); });
  const msg = await stream.finalMessage();
  return { data: finish(msg, schema), usage: msg.usage, model: msg.model };
}

// the dated pieces of a live edition (edition_assets): short, so one streamed call at low effort
export async function generateEdition(env, { context, outline, edition }) {
  const stream = client(env).beta.messages.stream({
    model: MODEL, max_tokens: 12000, betas: [FALLBACK_BETA], fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: EDITION_SCHEMA } },
    system: [{ type: "text", text: SISTEMA }, { type: "text", text: context, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `${P_EDICION}\n\n${outline}\n\n## La edición\n${edition}` }],
  });
  const msg = await stream.finalMessage();
  return { data: finish(msg, EDITION_SCHEMA), usage: msg.usage, model: msg.model };
}

// small task: title ideas (Haiku 5.5, structured)
export async function suggestTitles(env, context) {
  const msg = await client(env).messages.create({
    model: SMALL, max_tokens: 2000, output_config: { effort: "low", format: { type: "json_schema", schema: TITLES } },
    system: SISTEMA, messages: [{ role: "user", content: `${P_TITULOS}\n\n${context}` }],
  });
  return { data: finish(msg, TITLES).options.slice(0, 5), usage: msg.usage, model: SMALL };
}

// material over ~60k tokens: summarize it by sections first (Haiku 5.5), in parallel
export const MATERIAL_DIRECT = 240000;   // characters (~60k tokens) that go in as they are
export async function summarizeMaterial(env, text) {
  const parts = [];
  for (let i = 0; i < text.length; i += 60000) parts.push(text.slice(i, i + 60000));
  const out = await Promise.all(parts.map(async (p, i) => {
    const msg = await client(env).messages.create({ model: SMALL, max_tokens: 8000, system: P_RESUMEN, messages: [{ role: "user", content: `Parte ${i + 1} de ${parts.length}:\n\n${p}` }] });
    if (msg.stop_reason === "refusal") throw new GenError("No se pudo resumir el material. Quita la parte que no sea del curso y vuelve a intentarlo.");
    return { text: msg.content.filter(b => b.type === "text").map(b => b.text).join(""), usage: msg.usage };
  }));
  const usage = out.reduce((a, o) => { for (const k of ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"]) a[k] = (a[k] || 0) + (o.usage[k] || 0); return a; }, {});
  return { text: out.map((o, i) => `### Parte ${i + 1}\n${o.text}`).join("\n\n"), usage, model: SMALL };
}
