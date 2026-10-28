// Plataforma de cursos, bloque 2: alta de instructor (perfil, foto y documentos privados en R2) con revisión del admin,
// suscripción Premier (Stripe Billing) y compra de cursos (Stripe Checkout, pago único en MXN) con datos para factura,
// comisión de la plataforma y reembolsos. Usa la misma cuenta de Stripe y el mismo webhook que los planes de experiencias:
// todo lo de cursos lleva metadata.vvr = "premier" | "curso" y Premier tiene su propio cliente de Stripe
// (c_profiles.stripe_customer_id), así nunca se mezcla con users.stripe_* ni con las comisiones de "Recomienda y gana".

const DOC_KINDS = { cv: "CV", degree: "Título o cédula", id: "Identificación oficial", proof_experience: "Comprobante de experiencia", other: "Otro" };
const DOC_TYPES = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const LIM = { docBytes: 10 * 1024 * 1024, docs: 12, avatarBytes: 1024 * 1024, bio: 2000, headline: 140 };
const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const GRACE = 7 * 864e5;   // Premier past_due: 7 days before the courses stop selling
const PREMIER_LIVE = ["active", "trialing", "past_due"];
const PREMIER_KEY = "vvr_cursos_premier_mes";
const CFDI_USOS = ["G01", "G03", "D10", "S01", "CP01"];

export const premierOk = p => !!p && PREMIER_LIVE.includes(p.premier_status) && (p.premier_until || 0) > Date.now();
// can a course be bought: Vórtice VR's own courses always; an instructor's while their Premier is current (7 days of grace)
export const sellable = c => !c.instructor_id || (PREMIER_LIVE.includes(c.premier_status) && (c.premier_until || 0) > Date.now());
export const billingOn = (env, h, user) => !!env.STRIPE_SECRET_KEY && (h.stripeMode(env) === "live" || h.isAdmin(env, user));   // test keys: only admins pay (the preview shares the database)

export async function migratePagos(env) {
  const t = s => env.DB.prepare(s);
  await env.DB.batch([
    t("CREATE TABLE IF NOT EXISTS c_instructor_documents (id TEXT PRIMARY KEY, profile_id INTEGER NOT NULL, kind TEXT NOT NULL, file_key TEXT NOT NULL, name TEXT, mime TEXT, bytes INTEGER, note TEXT, reviewed INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE TABLE IF NOT EXISTS c_orders (id TEXT PRIMARY KEY, student_id INTEGER NOT NULL, course_id TEXT NOT NULL, instructor_id INTEGER, edition_id TEXT, amount_mxn INTEGER, commission_pct INTEGER, commission_mxn INTEGER, instructor_net_mxn INTEGER, coupon_id TEXT, stripe_checkout_session_id TEXT UNIQUE, stripe_payment_intent_id TEXT, stripe_mode TEXT, status TEXT DEFAULT 'pending', paid_at INTEGER, cfdi_requested INTEGER DEFAULT 0, cfdi_data TEXT, created_at INTEGER, updated_at INTEGER)"),
    t("CREATE INDEX IF NOT EXISTS c_docs_profile ON c_instructor_documents (profile_id)"),
    t("CREATE INDEX IF NOT EXISTS c_orders_student ON c_orders (student_id)"),
    t("CREATE INDEX IF NOT EXISTS c_orders_pi ON c_orders (stripe_payment_intent_id)"),
    t("CREATE INDEX IF NOT EXISTS c_orders_instructor ON c_orders (instructor_id, status, paid_at)"),
  ]);
  // c_profiles was made in block 1 (the preview and production share the database): add what block 2 needs
  const row = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'c_profiles'").first();
  if (row && !/\breview_note\b/.test(row.sql)) {
    try { await env.DB.batch(["review_note TEXT", "submitted_at INTEGER", "reviewed_at INTEGER", "stripe_mode TEXT"].map(c => env.DB.prepare(`ALTER TABLE c_profiles ADD COLUMN ${c}`))); }
    catch (e) { console.error("migración cursos", e.message); }
  }
}

async function profileOf(env, uid) {
  return (await env.DB.prepare("SELECT * FROM c_profiles WHERE user_id = ?").bind(uid).first()) || { user_id: uid, instructor_status: "none", premier_status: "inactive", onboarding_passed: 0 };
}
async function ensureProfile(env, uid) {
  const now = Date.now();
  await env.DB.prepare("INSERT INTO c_profiles (user_id, created_at, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO NOTHING").bind(uid, now, now).run();
}
const cut = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const avatarUrl = p => p.avatar_url || "";
function publicProfile(p, docs) {
  return { headline: p.headline || "", bio: p.bio || "", city: p.city || "", state: p.state || "", phone: p.phone || "", rfc: p.rfc || "", can_invoice: !!p.can_invoice,
    avatar: avatarUrl(p), status: p.instructor_status || "none", review_note: p.review_note || "", submitted_at: p.submitted_at || null,
    onboarding_passed: !!p.onboarding_passed, premier: { status: p.premier_status || "inactive", until: p.premier_until || null, active: premierOk(p) },
    documents: (docs || []).map(d => ({ id: d.id, kind: d.kind, label: DOC_KINDS[d.kind] || d.kind, name: d.name, bytes: d.bytes, note: d.note || "", created_at: d.created_at })) };
}
// what is missing before sending the profile for review
function missing(p, docs) {
  const out = [];
  if (!p.avatar_url) out.push("tu foto");
  if (cut(p.headline, 200).length < 10) out.push("tu titular");
  if (cut(p.bio, 3000).length < 80) out.push("tu biografía (al menos 80 letras)");
  if (!p.city || !p.state) out.push("tu ciudad y estado");
  if (!RFC.test(p.rfc || "")) out.push("tu RFC");
  if (!p.can_invoice) out.push("poder facturar");
  if (!docs.some(d => d.kind === "cv")) out.push("tu CV");
  if (!docs.some(d => d.kind === "id")) out.push("tu identificación oficial");
  return out;
}

// ---------- Stripe ----------
const priceCache = {};
async function premierPrice(env, h, amount) {
  const ck = h.stripeMode(env) + amount;
  if (priceCache[ck]) return priceCache[ck];
  const found = (await h.stripe(env, "GET", "prices", { lookup_keys: [PREMIER_KEY], active: "true", limit: 1 })).data[0];
  let price = found && found.unit_amount === amount && found.currency === "mxn" ? found : null;
  if (!price) {   // first time, or the price changed in Ajustes: a new price takes the lookup key
    const product = found ? (typeof found.product === "string" ? found.product : found.product.id)
      : (await h.stripe(env, "POST", "products", { name: "Vórtice VR · Cursos Premier", description: "Suscripción mensual de instructor en la plataforma de cursos de Vórtice VR", metadata: { vvr: "premier" } })).id;
    price = await h.stripe(env, "POST", "prices", { product, currency: "mxn", unit_amount: amount, tax_behavior: "inclusive", recurring: { interval: "month" }, lookup_key: PREMIER_KEY, transfer_lookup_key: "true", metadata: { vvr: "premier" } });
  }
  return (priceCache[ck] = price.id);
}
async function portalConfig(env, h) {   // card, invoices and cancel at period end (no plan switching)
  const list = await h.stripe(env, "GET", "billing_portal/configurations", { active: "true", limit: 100 });
  const mine = list.data.find(c => c.metadata && c.metadata.app === "vvr-cursos");
  if (mine) return mine.id;
  return (await h.stripe(env, "POST", "billing_portal/configurations", {
    business_profile: { headline: "Vórtice VR · Cursos Premier" },
    features: { payment_method_update: { enabled: "true" }, invoice_history: { enabled: "true" }, subscription_cancel: { enabled: "true", mode: "at_period_end" } },
    metadata: { app: "vvr-cursos" },
  })).id;
}
const PREMIER_MAP = { active: "active", trialing: "active", past_due: "past_due", canceled: "canceled", unpaid: "canceled", incomplete_expired: "canceled", incomplete: "inactive", paused: "canceled" };
// reads the subscription from Stripe (never the event's copy) and applies it to the instructor
async function premierSync(env, ctx, h, subId) {
  const sub = await h.stripe(env, "GET", `subscriptions/${subId}`);
  if (!sub.metadata || sub.metadata.vvr !== "premier") return;
  const uid = Number(sub.metadata.user_id);
  const p = uid && await env.DB.prepare("SELECT * FROM c_profiles WHERE user_id = ?").bind(uid).first();
  if (!p) { console.error("Premier sin perfil", subId); return; }
  if (p.stripe_subscription_id && p.stripe_subscription_id !== sub.id && !PREMIER_LIVE.includes(sub.status)) return;   // an old one ending must not undo the current one
  const item = sub.items && sub.items.data && sub.items.data[0];
  const end = (sub.current_period_end || (item && item.current_period_end) || 0) * 1000;
  const status = PREMIER_MAP[sub.status] || "inactive", live = PREMIER_LIVE.includes(sub.status);
  const until = live ? Math.max(end, Date.now()) + GRACE : Math.min(p.premier_until || 0, Date.now());
  await env.DB.prepare("UPDATE c_profiles SET premier_status = ?, premier_until = ?, stripe_subscription_id = ?, stripe_customer_id = ?, stripe_mode = ?, updated_at = ? WHERE user_id = ?")
    .bind(status, until, sub.id, sub.customer, sub.livemode ? "live" : "test", Date.now(), uid).run();
  if (status === "active" && p.premier_status !== "active") {
    const u = await env.DB.prepare("SELECT email, name FROM users WHERE id = ?").bind(uid).first();
    if (u) ctx.waitUntil(h.sendMail(env, u.email, "Tu Premier de Cursos Vórtice VR está activo", h.shell(`<h1 style="font-size:20px">¡Listo, ${h.esc(u.name || "")}! Premier está activo</h1>
      <p>Tus cursos ya se pueden vender. Desde tu panel de instructor puedes administrar tu suscripción.</p>${h.btnMail(h.siteUrl(env) + "/cursos/instructor/", "Ir a mi panel de instructor")}`)));
  }
  if (status === "past_due" && p.premier_status !== "past_due") {
    const u = await env.DB.prepare("SELECT email, name FROM users WHERE id = ?").bind(uid).first();
    if (u) ctx.waitUntil(h.sendMail(env, u.email, "No pudimos cobrar tu Premier", h.shell(`<h1 style="font-size:20px">No pudimos cobrar tu Premier</h1>
      <p>Actualiza tu tarjeta en los próximos 7 días para que tus cursos sigan a la venta. Tus alumnos inscritos no pierden su acceso.</p>${h.btnMail(h.siteUrl(env) + "/cursos/instructor/", "Actualizar mi tarjeta")}`)));
  }
}

// a paid Checkout session → the order is paid and the student enrolled (from the webhook or from the return page; only once)
async function fulfill(env, ctx, h, lib, sessionId) {
  const s = await h.stripe(env, "GET", `checkout/sessions/${sessionId}`);
  if (!s.metadata || s.metadata.vvr !== "curso" || s.payment_status !== "paid") return null;
  const o = await env.DB.prepare("SELECT * FROM c_orders WHERE id = ?").bind(s.metadata.order_id).first();
  if (!o) return null;
  const c = await env.DB.prepare("SELECT slug, title FROM c_courses WHERE id = ?").bind(o.course_id).first();
  if (o.status !== "pending") return { order: o, slug: c && c.slug };
  const set = await lib.settings(env), now = Date.now(), amount = s.amount_total || 0;
  const pct = Number(set.commission_pct ?? 20), commission = o.instructor_id ? Math.round(amount * pct / 100) : amount;
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent && s.payment_intent.id;
  const r = await env.DB.prepare("UPDATE c_orders SET status = 'paid', paid_at = ?, amount_mxn = ?, commission_pct = ?, commission_mxn = ?, instructor_net_mxn = ?, stripe_payment_intent_id = ?, updated_at = ? WHERE id = ? AND status = 'pending'")
    .bind(now, amount, pct, commission, amount - commission, pi || null, now, o.id).run();
  if (!r.meta || !r.meta.changes) return { order: o, slug: c && c.slug };   // the webhook and the return page raced: the other one did it
  await env.DB.prepare(`INSERT INTO c_enrollments (id, student_id, course_id, edition_id, order_id, status, progress_pct, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', 0, ?, ?)
    ON CONFLICT(student_id, course_id) DO UPDATE SET status = CASE WHEN c_enrollments.status = 'completed' THEN 'completed' ELSE 'active' END, order_id = excluded.order_id, updated_at = excluded.updated_at`)
    .bind(lib.uid(), o.student_id, o.course_id, o.edition_id, o.id, now, now).run();
  const u = await env.DB.prepare("SELECT email, name FROM users WHERE id = ?").bind(o.student_id).first();
  if (u && c) ctx.waitUntil(h.sendMail(env, u.email, `Ya tienes acceso a "${c.title}"`, h.shell(`<h1 style="font-size:20px">¡Gracias por tu compra, ${h.esc((u.name || "").split(" ")[0])}!</h1>
    <p>Ya puedes tomar <b>${h.esc(c.title)}</b>. Pagaste <b>$${(amount / 100).toLocaleString("es-MX")} MXN</b>.${o.cfdi_requested ? " Recibimos tus datos para la factura; te la enviaremos por correo." : ""}</p>
    ${h.btnMail(h.siteUrl(env) + `/cursos/aprender/${c.slug}/`, "Empezar el curso")}`, "Recibiste este correo por tu compra en la plataforma de cursos de Vórtice VR.")));
  return { order: { ...o, status: "paid" }, slug: c && c.slug };
}

async function refundOrder(env, pi) {
  const o = await env.DB.prepare("SELECT * FROM c_orders WHERE stripe_payment_intent_id = ?").bind(pi).first();
  if (!o || o.status === "refunded") return !!o;
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE c_orders SET status = 'refunded', updated_at = ? WHERE id = ?").bind(now, o.id),
    env.DB.prepare("UPDATE c_enrollments SET status = 'refunded', updated_at = ? WHERE order_id = ?").bind(now, o.id),
    env.DB.prepare("UPDATE c_certificates SET revoked = 1, revoked_reason = 'Pago reembolsado', updated_at = ? WHERE enrollment_id IN (SELECT id FROM c_enrollments WHERE order_id = ?)").bind(now, o.id),
  ]);
  return true;
}

// called by worker.js's webhook (already verified) before its own handling: true = it was a courses event
export async function cursosWebhook(env, ctx, ev, h, lib) {
  const o = (ev.data && ev.data.object) || {}, meta = o.metadata || {};
  if (ev.type === "checkout.session.completed" && meta.vvr === "curso") { await lib.ready(env); await fulfill(env, ctx, h, lib, o.id); return true; }
  if (ev.type === "checkout.session.completed" && meta.vvr === "premier") { await lib.ready(env); if (o.subscription) await premierSync(env, ctx, h, typeof o.subscription === "string" ? o.subscription : o.subscription.id); return true; }
  if (/^customer\.subscription\./.test(ev.type) && meta.vvr === "premier") { await lib.ready(env); await premierSync(env, ctx, h, o.id); return true; }
  if (/^invoice\./.test(ev.type)) {
    const sd = o.subscription_details || (o.parent && o.parent.subscription_details) || {};
    if (sd.metadata && sd.metadata.vvr === "premier") {
      const sub = o.subscription || sd.subscription;
      await lib.ready(env); if (sub) await premierSync(env, ctx, h, typeof sub === "string" ? sub : sub.id);
      return true;
    }
  }
  if (ev.type === "charge.refunded" && o.refunded && o.payment_intent) { await lib.ready(env); return refundOrder(env, typeof o.payment_intent === "string" ? o.payment_intent : o.payment_intent.id); }
  return false;
}

export async function pagosApi(request, env, ctx, url, path, h, user, lib) {
  const M = request.method, { json } = h;
  const body = async () => { try { return await request.json(); } catch { return {}; } };
  const origin = url.origin;
  let m;

  // public: an instructor's photo (shown on the sales pages)
  if ((m = path.match(/^\/api\/cursos\/archivo\/avatar\/(\d+)$/)) && M === "GET") {
    const obj = await env.MEDIA.get(`cursos/avatar/${m[1]}`);
    if (!obj) return json({ error: "No existe" }, 404);
    return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata && obj.httpMetadata.contentType || "image/jpeg", "Cache-Control": "public, max-age=86400" } });
  }

  // ---------- the instructor's own panel ----------
  if (path.startsWith("/api/cursos/instructor")) {
    if (!user) return json({ error: "Inicia sesión.", login: true }, 401);
    const p = await profileOf(env, user.id);
    const docs = () => env.DB.prepare("SELECT * FROM c_instructor_documents WHERE profile_id = ? ORDER BY created_at").bind(user.id).all().then(r => r.results);
    const editable = p.instructor_status !== "pending";   // while in review nothing changes

    if (path === "/api/cursos/instructor" && M === "GET") {
      const set = await lib.settings(env), list = await docs();
      return json({ name: user.name, email: user.email, profile: publicProfile(p, list), missing: missing(p, list), kinds: DOC_KINDS,
        premier: { price_mxn: set.premier_price_mxn || null, billing: billingOn(env, h, user), test: !!env.STRIPE_SECRET_KEY && h.stripeMode(env) === "test" },
        onboarding: lib.onboardingSlug, canCreate: p.instructor_status === "approved" && !!p.onboarding_passed && premierOk(p) });
    }
    if (path === "/api/cursos/instructor/perfil" && M === "POST") {
      if (!editable) return json({ error: "Tu perfil está en revisión; podrás cambiarlo cuando termine." }, 409);
      const b = await body(), rfc = cut(b.rfc, 13).toUpperCase().replace(/\s/g, "");
      if (rfc && !RFC.test(rfc)) return json({ error: "Revisa tu RFC: 12 o 13 caracteres, como XAXX010101000." }, 400);
      await ensureProfile(env, user.id);
      await env.DB.prepare("UPDATE c_profiles SET role = CASE WHEN role = 'admin' THEN role ELSE 'instructor' END, headline = ?, bio = ?, city = ?, state = ?, phone = ?, rfc = ?, can_invoice = ?, updated_at = ? WHERE user_id = ?")
        .bind(cut(b.headline, LIM.headline), cut(b.bio, LIM.bio), cut(b.city, 60), cut(b.state, 60), cut(b.phone, 20).replace(/[^\d+ ]/g, ""), rfc || null, b.can_invoice ? 1 : 0, Date.now(), user.id).run();
      return json({ ok: true });
    }
    if (path === "/api/cursos/instructor/foto" && M === "POST") {
      if (!editable) return json({ error: "Tu perfil está en revisión." }, 409);
      const f = (await request.formData()).get("file");
      if (!f || typeof f === "string" || !/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > LIM.avatarBytes) return json({ error: "Sube una foto JPG, PNG o WebP de menos de 1 MB." }, 400);
      await env.MEDIA.put(`cursos/avatar/${user.id}`, await f.arrayBuffer(), { httpMetadata: { contentType: f.type } });
      await ensureProfile(env, user.id);
      const u = `/api/cursos/archivo/avatar/${user.id}?v=${Date.now()}`;
      await env.DB.prepare("UPDATE c_profiles SET avatar_url = ?, updated_at = ? WHERE user_id = ?").bind(u, Date.now(), user.id).run();
      return json({ ok: true, avatar: u });
    }
    if (path === "/api/cursos/instructor/documento" && M === "POST") {
      if (!editable || p.instructor_status === "approved") return json({ error: "Ya no puedes cambiar tus documentos." }, 409);
      if (!(await h.limit(env, `cdoc:${user.id}`, 30, 3600e3))) return json({ error: "Demasiados archivos. Intenta en una hora." }, 429);
      const fd = await request.formData(), f = fd.get("file"), kind = String(fd.get("kind") || "");
      if (!DOC_KINDS[kind]) return json({ error: "Elige qué documento es." }, 400);
      if (!f || typeof f === "string" || !DOC_TYPES[f.type]) return json({ error: "Sube un PDF, JPG, PNG o WebP." }, 400);
      if (f.size > LIM.docBytes) return json({ error: "El archivo pesa más de 10 MB." }, 400);
      if ((await docs()).length >= LIM.docs) return json({ error: `Máximo ${LIM.docs} documentos.` }, 400);
      const id = lib.uid(), key = `cursos/docs/${user.id}/${id}`, now = Date.now();
      await env.MEDIA.put(key, await f.arrayBuffer(), { httpMetadata: { contentType: f.type } });
      await ensureProfile(env, user.id);
      await env.DB.prepare("INSERT INTO c_instructor_documents (id, profile_id, kind, file_key, name, mime, bytes, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, user.id, kind, key, cut(f.name, 120), f.type, f.size, cut(fd.get("note"), 200), now, now).run();
      return json({ ok: true, id });
    }
    if ((m = path.match(/^\/api\/cursos\/instructor\/documento\/([\w-]+)$/)) && M === "DELETE") {
      if (!editable || p.instructor_status === "approved") return json({ error: "Ya no puedes cambiar tus documentos." }, 409);
      const d = await env.DB.prepare("SELECT * FROM c_instructor_documents WHERE id = ? AND profile_id = ?").bind(m[1], user.id).first();
      if (!d) return json({ error: "No encontramos ese documento." }, 404);
      await env.MEDIA.delete(d.file_key);
      await env.DB.prepare("DELETE FROM c_instructor_documents WHERE id = ?").bind(d.id).run();
      return json({ ok: true });
    }
    if (path === "/api/cursos/instructor/enviar" && M === "POST") {
      if (p.instructor_status === "pending" || p.instructor_status === "approved") return json({ error: "Tu perfil ya se envió." }, 409);
      const list = await docs(), miss = missing(p, list);
      if (miss.length) return json({ error: "Te falta: " + miss.join(", ") + ".", missing: miss }, 400);
      const now = Date.now();
      await env.DB.prepare("UPDATE c_profiles SET instructor_status = 'pending', submitted_at = ?, review_note = NULL, updated_at = ? WHERE user_id = ?").bind(now, now, user.id).run();
      ctx.waitUntil(h.sendMail(env, env.CONTACT_TO || "hola@vorticevr.mx", `[Cursos] Nuevo instructor por revisar: ${user.name}`, h.shell(`<h1 style="font-size:20px">Nuevo instructor por revisar</h1>
        <p><b>${h.esc(user.name || "")}</b> (${h.esc(user.email)})<br>${h.esc(p.headline || "")}<br>${h.esc(p.city || "")}, ${h.esc(p.state || "")} · ${list.length} documentos</p>
        ${h.btnMail(h.siteUrl(env) + "/cursos/admin/", "Revisar en el admin de cursos")}`, "Aviso automático de la plataforma de cursos.")));
      return json({ ok: true });
    }
    // Premier: Checkout the first time, the Customer Portal (card, invoices, cancel) once subscribed
    if (path === "/api/cursos/instructor/premier" && M === "POST") {
      if (!billingOn(env, h, user)) return json({ error: env.STRIPE_SECRET_KEY ? "Los pagos están en modo de prueba." : "El pago en línea todavía no está disponible." }, 503);
      if (p.instructor_status !== "approved") return json({ error: "Primero se tiene que aprobar tu perfil." }, 409);
      if (!p.can_invoice) return json({ error: "Para Premier necesitas poder facturar." }, 409);
      if (!p.onboarding_passed) return json({ error: "Primero aprueba el curso de inducción." }, 409);
      const mode = h.stripeMode(env);
      let customer = p.stripe_mode === mode ? p.stripe_customer_id : null;
      if (customer && p.stripe_subscription_id && PREMIER_LIVE.includes(p.premier_status)) {
        const s = await h.stripe(env, "POST", "billing_portal/sessions", { customer, return_url: `${origin}/cursos/instructor/`, configuration: await portalConfig(env, h) });
        return json({ url: s.url, portal: true });
      }
      const set = await lib.settings(env);
      if (!set.premier_price_mxn) return json({ error: "Premier todavía no tiene precio. Escríbenos a hola@vorticevr.mx." }, 503);
      const price = await premierPrice(env, h, set.premier_price_mxn);
      const newCustomer = async () => {
        const c = await h.stripe(env, "POST", "customers", { email: user.email, name: user.name, metadata: { user_id: user.id, vvr: "cursos" } });
        await env.DB.prepare("UPDATE c_profiles SET stripe_customer_id = ?, stripe_mode = ? WHERE user_id = ?").bind(c.id, mode, user.id).run();
        return c.id;
      };
      if (!customer) customer = await newCustomer();
      const session = c => h.stripe(env, "POST", "checkout/sessions", {
        mode: "subscription", customer: c, client_reference_id: user.id, locale: "es-419",
        line_items: [{ price, quantity: 1 }], metadata: { vvr: "premier", user_id: user.id },
        subscription_data: { metadata: { vvr: "premier", user_id: user.id } },
        success_url: `${origin}/cursos/instructor/?premier=ok`, cancel_url: `${origin}/cursos/instructor/?premier=cancelado`,
      });
      let s;
      try { s = await session(customer); }
      catch (e) { if (e.code !== "resource_missing") throw e; s = await session(await newCustomer()); }
      return json({ url: s.url });
    }
    // back from Checkout: do not wait for the webhook
    if (path === "/api/cursos/instructor/premier/sync" && M === "POST") {
      if (!env.STRIPE_SECRET_KEY || !p.stripe_customer_id || p.stripe_mode !== h.stripeMode(env)) return json({ ok: true });
      const list = await h.stripe(env, "GET", "subscriptions", { customer: p.stripe_customer_id, status: "all", limit: 3 });
      const sub = list.data.find(s => s.metadata && s.metadata.vvr === "premier");
      if (sub) await premierSync(env, ctx, h, sub.id);
      return json({ ok: true });
    }
    return json({ error: "No encontrado" }, 404);
  }

  // ---------- buying a course ----------
  if ((m = path.match(/^\/api\/cursos\/curso\/([a-z0-9-]+)\/comprar$/)) && M === "POST") {
    if (!user) return json({ error: "Inicia sesión para comprar.", login: true }, 401);
    const c = await lib.courseBySlug(env, m[1]);
    if (!c || c.status !== "published") return json({ error: "Este curso no está disponible." }, 404);
    if (!(c.price_mxn > 0)) return json({ error: "Este curso es gratis: inscríbete directo." }, 400);
    if (!sellable(c)) return json({ error: "Este curso no está a la venta por ahora." }, 409);
    if (!billingOn(env, h, user)) return json({ error: "La compra con tarjeta llega muy pronto.", soon: true }, 503);
    const en = await env.DB.prepare("SELECT status FROM c_enrollments WHERE student_id = ? AND course_id = ?").bind(user.id, c.id).first();
    if (en && en.status !== "refunded") return json({ error: "Ya tienes este curso.", enrolled: true }, 409);
    if (!(await h.limit(env, `cbuy:${user.id}`, 20, 3600e3))) return json({ error: "Demasiados intentos. Intenta en una hora." }, 429);
    const b = await body();
    let cfdi = null;
    if (b.cfdi) {
      const rfc = cut(b.cfdi.rfc, 13).toUpperCase().replace(/\s/g, ""), cp = cut(b.cfdi.cp, 5);
      if (!RFC.test(rfc)) return json({ error: "Revisa el RFC para tu factura." }, 400);
      if (!/^\d{5}$/.test(cp)) return json({ error: "El código postal fiscal tiene 5 dígitos." }, 400);
      const name = cut(b.cfdi.name, 200), regimen = cut(b.cfdi.regimen, 3);
      if (name.length < 3 || !/^\d{3}$/.test(regimen)) return json({ error: "Completa la razón social y el régimen fiscal." }, 400);
      cfdi = { rfc, name, cp, regimen, uso: CFDI_USOS.includes(b.cfdi.uso) ? b.cfdi.uso : "G03", email: user.email };
    }
    const id = lib.uid(), now = Date.now(), mode = h.stripeMode(env);
    const s = await h.stripe(env, "POST", "checkout/sessions", {
      mode: "payment", customer_email: user.email, client_reference_id: user.id, locale: "es-419",
      line_items: [{ quantity: 1, price_data: { currency: "mxn", unit_amount: c.price_mxn, tax_behavior: "inclusive", product_data: { name: c.title, description: (c.subtitle || "Curso con constancia avalada por Vórtice VR").slice(0, 300) } } }],
      metadata: { vvr: "curso", order_id: id, user_id: user.id, course_id: c.id },
      payment_intent_data: { metadata: { vvr: "curso", order_id: id }, description: `Curso: ${c.title}`.slice(0, 200) },
      success_url: `${origin}/cursos/${c.slug}/?pago=ok&s={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/cursos/${c.slug}/?pago=cancelado`,
    }, `vvr-curso-${id}`);
    await env.DB.prepare("INSERT INTO c_orders (id, student_id, course_id, instructor_id, amount_mxn, stripe_checkout_session_id, stripe_mode, status, cfdi_requested, cfdi_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)")
      .bind(id, user.id, c.id, c.instructor_id, c.price_mxn, s.id, mode, cfdi ? 1 : 0, cfdi ? JSON.stringify(cfdi) : null, now, now).run();
    return json({ url: s.url });
  }
  // back from Checkout: enroll right away if it is paid (the webhook does the same; only one of them counts)
  if ((m = path.match(/^\/api\/cursos\/pago\/(cs_[\w]+)$/)) && M === "POST") {
    if (!user) return json({ error: "Inicia sesión.", login: true }, 401);
    const o = await env.DB.prepare("SELECT id FROM c_orders WHERE stripe_checkout_session_id = ? AND student_id = ?").bind(m[1], user.id).first();
    if (!o) return json({ error: "No encontramos ese pago." }, 404);
    const r = await fulfill(env, ctx, h, lib, m[1]);
    return json({ paid: !!(r && r.order.status === "paid"), slug: r && r.slug });
  }

  // ---------- admin of the courses (instructors and settings; reviewing courses and payouts come in later blocks) ----------
  if (path.startsWith("/api/cursos/admin/")) {
    if (!user) return json({ error: "Inicia sesión.", login: true }, 401);
    if (!h.isAdmin(env, user)) return json({ error: "No tienes acceso." }, 403);
    if (path === "/api/cursos/admin/instructores" && M === "GET") {
      const st = ["pending", "approved", "rejected"].includes(url.searchParams.get("estado")) ? url.searchParams.get("estado") : "pending";
      const { results } = await env.DB.prepare(`SELECT p.*, u.name, u.email FROM c_profiles p JOIN users u ON u.id = p.user_id WHERE p.instructor_status = ? ORDER BY p.submitted_at DESC LIMIT 200`).bind(st).all();
      const ids = results.map(r => r.user_id);
      const docs = ids.length ? (await env.DB.prepare(`SELECT * FROM c_instructor_documents WHERE profile_id IN (${ids.map(() => "?").join(",")}) ORDER BY created_at`).bind(...ids).all()).results : [];
      const counts = Object.fromEntries((await env.DB.prepare("SELECT instructor_status AS s, COUNT(*) AS n FROM c_profiles WHERE instructor_status IN ('pending','approved','rejected') GROUP BY instructor_status").all()).results.map(r => [r.s, r.n]));
      return json({ counts, list: results.map(r => ({ id: r.user_id, name: r.name, email: r.email, ...publicProfile(r, docs.filter(d => d.profile_id === r.user_id)) })) });
    }
    if ((m = path.match(/^\/api\/cursos\/admin\/documento\/([\w-]+)$/)) && M === "GET") {
      const d = await env.DB.prepare("SELECT * FROM c_instructor_documents WHERE id = ?").bind(m[1]).first();
      const obj = d && await env.MEDIA.get(d.file_key);
      if (!obj) return json({ error: "No existe" }, 404);
      return new Response(obj.body, { headers: { "Content-Type": d.mime || "application/octet-stream", "Content-Disposition": `inline; filename="${(d.name || "documento").replace(/["\\\r\n]/g, "")}"`, "Cache-Control": "no-store" } });
    }
    if ((m = path.match(/^\/api\/cursos\/admin\/instructores\/(\d+)$/)) && M === "POST") {
      const b = await body(), uid = Number(m[1]), approve = b.action === "approve", note = cut(b.note, 600);
      if (!approve && b.action !== "reject") return json({ error: "Acción inválida." }, 400);
      if (!approve && note.length < 5) return json({ error: "Escribe el motivo del rechazo: le llega al instructor." }, 400);
      const u = await env.DB.prepare("SELECT u.email, u.name FROM users u JOIN c_profiles p ON p.user_id = u.id WHERE u.id = ?").bind(uid).first();
      if (!u) return json({ error: "No existe ese instructor." }, 404);
      const now = Date.now();
      await env.DB.batch([
        env.DB.prepare("UPDATE c_profiles SET instructor_status = ?, review_note = ?, reviewed_at = ?, updated_at = ? WHERE user_id = ?").bind(approve ? "approved" : "rejected", note || null, now, now, uid),
        env.DB.prepare("UPDATE c_instructor_documents SET reviewed = 1 WHERE profile_id = ?").bind(uid),
      ]);
      const link = h.siteUrl(env) + "/cursos/instructor/";
      ctx.waitUntil(h.sendMail(env, u.email, approve ? "¡Tu perfil de instructor fue aprobado!" : "Tu perfil de instructor necesita cambios", h.shell(approve
        ? `<h1 style="font-size:20px">¡Bienvenido, ${h.esc((u.name || "").split(" ")[0])}!</h1><p>Aprobamos tu perfil de instructor. Sigue con el curso de inducción y activa Premier para crear tus cursos.</p>${note ? `<p>${h.esc(note)}</p>` : ""}${h.btnMail(link, "Ir a mi panel de instructor")}`
        : `<h1 style="font-size:20px">Tu perfil necesita cambios</h1><p>Revisamos tu perfil de instructor y antes de aprobarlo necesitamos lo siguiente:</p><p style="background:#1b0a36;padding:12px;border-radius:10px">${h.esc(note)}</p><p>Corrígelo y vuelve a enviarlo.</p>${h.btnMail(link, "Corregir mi perfil")}`,
        "Recibiste este correo por tu solicitud de instructor en la plataforma de cursos de Vórtice VR.")));
      return json({ ok: true });
    }
    if (path === "/api/cursos/admin/ajustes") {
      if (M === "POST") {
        const b = await body(), money = v => v === "" || v == null ? null : Math.round(Number(v) * 100);
        const price = money(b.premier_price_mxn), pct = Math.round(Number(b.commission_pct));
        if (price !== null && !(price >= 1000 && price <= 10000000)) return json({ error: "El precio de Premier debe ir de $10 a $100,000." }, 400);
        if (!(pct >= 0 && pct <= 90)) return json({ error: "La comisión va de 0 a 90 %." }, 400);
        await env.DB.prepare("UPDATE c_settings SET premier_price_mxn = ?, commission_pct = ?, ace_registration_number = ?, certificate_signer_name = ?, certificate_signer_title = ?, updated_at = ? WHERE id = 1")
          .bind(price, pct, cut(b.ace_registration_number, 40) || null, cut(b.certificate_signer_name, 80) || null, cut(b.certificate_signer_title, 80) || null, Date.now()).run();
      }
      const s = await lib.settings(env);
      return json({ premier_price_mxn: s.premier_price_mxn ? s.premier_price_mxn / 100 : "", commission_pct: s.commission_pct ?? 20, ace_registration_number: s.ace_registration_number || "",
        certificate_signer_name: s.certificate_signer_name || "", certificate_signer_title: s.certificate_signer_title || "", stripe: env.STRIPE_SECRET_KEY ? h.stripeMode(env) : "" });
    }
    if (path === "/api/cursos/admin/ventas" && M === "GET") {
      const { results } = await env.DB.prepare(`SELECT o.*, c.title, u.name, u.email FROM c_orders o JOIN c_courses c ON c.id = o.course_id JOIN users u ON u.id = o.student_id WHERE o.status != 'pending' ORDER BY o.paid_at DESC LIMIT 200`).all();
      return json({ list: results.map(o => ({ id: o.id, course: o.title, student: o.name, email: o.email, amount: o.amount_mxn, commission: o.commission_mxn, net: o.instructor_net_mxn, status: o.status, paid_at: o.paid_at, mode: o.stripe_mode, cfdi: o.cfdi_requested ? JSON.parse(o.cfdi_data || "null") : null })) });
    }
    return json({ error: "No encontrado" }, 404);
  }
  return null;
}
