// Pantalla mágica (/pantalla-magica/): una pantalla grande con figuras 3D (mariposas, peces, farolitos…) que cada quien
// pinta en el celular (/pantalla-magica/pintar/?sala=CÓDIGO) y suelta en la pantalla en tiempo real con su deseo (la
// pantalla pregunta cada 2 s).
//  - Sala = código de 4 a 8 letras que inventa la pantalla; la registra con una llave (solo esa pantalla puede quitar
//    figuras) y con su mundo (jardín, océano, cielo), que dice al celular qué figuras ofrecer. Un celular sin sala
//    abierta no puede soltar nada.
//  - Cada celular (uid anónimo del navegador) tiene UNA figura en la pantalla: soltar otra reemplaza la suya (el modo
//    iPad manda un uid nuevo cada vez).
//  - `kind` = figura (KINDS, igual que ESPECIES de assets/pantalla/especies.js); `msg` = el deseo (sin groserías,
//    links, correos ni teléfonos).
// Tablas pm_salas y pm_items; texturas en R2 `pantalla/<id>`. El cron diario borra lo de más de 3 días.

const KINDS = ["mariposa", "libelula", "pez", "medusa", "farolito", "globo"];
const MUNDOS = ["jardin", "oceano", "cielo"];
const MAX_VIVAS = 60;          // figuras a la vez en una sala; las más viejas se van
const MAX_BYTES = 900 * 1024;  // textura (WebP o PNG)
const SALA = /^[A-Z0-9]{4,8}$/;
// groserías como palabra completa y sin acentos (para no bloquear "músculo" o "computadora")
const MALAS = /(^|[^a-zñ])(put[oa]s?|putiz\w*|pendej\w*|verga\w*|ching\w*|cabron\w*|mierd\w*|culer\w*|culo|jot[oa]s?|punet\w*|zorra\w*|perra\w*|pito|pinche\w*|mamad\w*|mamon\w*|naco|nacos|estupid\w*|idiota\w*|fuck\w*|shit|bitch\w*|nazi\w*|sexo?\w*|porno?\w*|drogas?|matar\w*|muerete)(?=$|[^a-zñ])/;
const plano = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const malo = s => MALAS.test(plano(s));
// links, correos, usuarios y teléfonos no se muestran en una pantalla pública
const datos = s => /https?:|www\.|\.(com|mx|net|org)\b|@/i.test(s) || /\d{7,}/.test(String(s).replace(/[\s.-]/g, ""));

let ready = false;
async function tablas(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_salas (sala TEXT PRIMARY KEY, llave TEXT NOT NULL, created INTEGER, seen INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_items (id TEXT PRIMARY KEY, sala TEXT NOT NULL, kind TEXT NOT NULL, name TEXT, uid TEXT NOT NULL, at INTEGER NOT NULL, gone INTEGER DEFAULT 0, gone_at INTEGER)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS pm_items_sala ON pm_items (sala, gone, at)"),
  ]);
  // columnas nuevas (21 de noviembre de 2026): el mundo de la pantalla y el deseo de cada figura
  for (const q of ["ALTER TABLE pm_salas ADD COLUMN mundo TEXT", "ALTER TABLE pm_items ADD COLUMN msg TEXT"]) await env.DB.prepare(q).run().catch(() => {});
  ready = true;
}

async function sha(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const limpio = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const cleanName = s => { s = limpio(s, 18); return malo(s) || datos(s) ? "" : s; };

export async function pantallaApi(request, env, ctx, url, path, ip, h) {
  if (!path.startsWith("/api/pantalla/")) return null;
  const { json, limit } = h;
  await tablas(env);
  const M = request.method, now = Date.now();

  // the texture of one figure (never changes: long cache)
  let m = path.match(/^\/api\/pantalla\/img\/([a-z0-9]{12,32})$/);
  if (m && M === "GET") {
    const o = await env.MEDIA.get("pantalla/" + m[1]);
    if (!o) return new Response("No existe", { status: 404 });
    return new Response(o.body, { headers: { "Content-Type": o.httpMetadata?.contentType || "image/webp", "Cache-Control": "public, max-age=604800, immutable" } });
  }

  m = path.match(/^\/api\/pantalla\/([A-Z0-9]{4,8})(?:\/(abrir|soltar|quitar|info))?$/);
  if (!m || !SALA.test(m[1])) return null;
  const sala = m[1], act = m[2] || "";

  // the screen opens (or takes back) its room with its key and its world
  if (act === "abrir" && M === "POST") {
    const b = await request.json().catch(() => ({}));
    const llave = String(b.llave || ""), mundo = MUNDOS.includes(b.mundo) ? b.mundo : "jardin";
    if (!/^[a-z0-9]{16,64}$/.test(llave)) return json({ error: "Llave inválida" }, 400);
    if (!(await limit(env, "pm-abrir:" + ip, 60, 3600e3))) return json({ error: "Demasiadas salas. Intenta en un rato." }, 429);
    const hash = await sha(llave);
    const row = await env.DB.prepare("SELECT llave FROM pm_salas WHERE sala = ?").bind(sala).first();
    if (row && row.llave !== hash) return json({ error: "Esa sala ya es de otra pantalla.", ocupada: true }, 409);
    if (!row) await env.DB.prepare("INSERT INTO pm_salas (sala, llave, created, seen, mundo) VALUES (?, ?, ?, ?, ?)").bind(sala, hash, now, now, mundo).run();
    else await env.DB.prepare("UPDATE pm_salas SET seen = ?, mundo = ? WHERE sala = ?").bind(now, mundo, sala).run();
    return json({ ok: true });
  }

  // the phone asks which world the screen shows (to offer its figures)
  if (act === "info" && M === "GET") {
    const row = await env.DB.prepare("SELECT mundo FROM pm_salas WHERE sala = ?").bind(sala).first();
    if (!row) return json({ error: "Esa pantalla no está encendida. Revisa el código." }, 404);
    return json({ mundo: row.mundo || "jardin" });
  }

  // the screen asks what changed since its last look (3 s overlap: the client ignores ids it already has)
  if (!act && M === "GET") {
    const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
    let items, gone = [];
    if (!since) {
      ({ results: items } = await env.DB.prepare("SELECT id, kind, name, msg, at FROM pm_items WHERE sala = ? AND gone = 0 ORDER BY at DESC LIMIT ?").bind(sala, MAX_VIVAS).all());
      items.reverse();
    } else {
      const s = since - 3000;
      ({ results: items } = await env.DB.prepare("SELECT id, kind, name, msg, at FROM pm_items WHERE sala = ? AND gone = 0 AND at > ? ORDER BY at LIMIT 40").bind(sala, s).all());
      ({ results: gone } = await env.DB.prepare("SELECT id FROM pm_items WHERE sala = ? AND gone = 1 AND gone_at > ? LIMIT 100").bind(sala, s).all());
      gone = gone.map(r => r.id);
    }
    return json({ now, items, gone });
  }

  // a phone releases its figure with its wish (replaces the one it already had)
  if (act === "soltar" && M === "POST") {
    const salaRow = await env.DB.prepare("SELECT sala FROM pm_salas WHERE sala = ?").bind(sala).first();
    if (!salaRow) return json({ error: "Esa pantalla no está encendida. Revisa el código." }, 404);
    const f = await request.formData().catch(() => null);
    if (!f) return json({ error: "No llegó tu dibujo." }, 400);
    const uid = String(f.get("uid") || ""), kind = String(f.get("kind") || "mariposa"), img = f.get("img");
    if (!/^[a-z0-9]{12,40}$/.test(uid)) return json({ error: "Datos inválidos" }, 400);
    if (!KINDS.includes(kind)) return json({ error: "Tipo inválido" }, 400);
    if (!img || typeof img === "string" || !/^image\/(webp|png)$/.test(img.type) || img.size > MAX_BYTES || img.size < 500) return json({ error: "Tu dibujo no se pudo leer. Intenta de nuevo." }, 400);
    const msg = limpio(f.get("msg"), 90);
    if (msg && (malo(msg) || datos(msg))) return json({ error: "Tu deseo no se puede mostrar en la pantalla: sin groserías, links, correos ni teléfonos.", deseo: true }, 400);
    if (!(await limit(env, "pm-u:" + uid, 1, 10e3))) return json({ error: "Espera unos segundos para soltar otra.", espera: true }, 429);
    if (!(await limit(env, "pm-ip:" + ip, 400, 3600e3))) return json({ error: "Muchas figuras desde esta red. Intenta en un rato." }, 429);
    const id = [...crypto.getRandomValues(new Uint8Array(10))].map(b => b.toString(16).padStart(2, "0")).join("");
    await env.MEDIA.put("pantalla/" + id, await img.arrayBuffer(), { httpMetadata: { contentType: img.type } });
    const name = cleanName(f.get("name"));
    await env.DB.batch([
      env.DB.prepare("UPDATE pm_items SET gone = 1, gone_at = ? WHERE sala = ? AND uid = ? AND gone = 0").bind(now, sala, uid),
      env.DB.prepare("INSERT INTO pm_items (id, sala, kind, name, msg, uid, at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, sala, kind, name, msg, uid, now),
      // too many: the oldest leave
      env.DB.prepare(`UPDATE pm_items SET gone = 1, gone_at = ? WHERE id IN (SELECT id FROM pm_items WHERE sala = ? AND gone = 0 ORDER BY at DESC LIMIT -1 OFFSET ${MAX_VIVAS})`).bind(now, sala),
    ]);
    return json({ ok: true, id });
  }

  // the screen removes one (moderation: double click on it)
  if (act === "quitar" && M === "POST") {
    const b = await request.json().catch(() => ({}));
    const row = await env.DB.prepare("SELECT llave FROM pm_salas WHERE sala = ?").bind(sala).first();
    if (!row || row.llave !== await sha(String(b.llave || ""))) return json({ error: "Solo la pantalla puede quitar figuras." }, 403);
    if (b.todas) await env.DB.prepare("UPDATE pm_items SET gone = 1, gone_at = ? WHERE sala = ? AND gone = 0").bind(now, sala).run();
    else await env.DB.prepare("UPDATE pm_items SET gone = 1, gone_at = ? WHERE sala = ? AND id = ?").bind(now, sala, String(b.id || "")).run();
    return json({ ok: true });
  }
  return json({ error: "No encontrado" }, 404);
}

// cron diario: lo de más de 3 días se borra (filas y texturas)
export async function pantallaLimpieza(env) {
  await tablas(env);
  const old = Date.now() - 3 * 864e5;
  const { results } = await env.DB.prepare("SELECT id FROM pm_items WHERE at < ? LIMIT 1000").bind(old).all();
  if (results.length) {
    await env.MEDIA.delete(results.map(r => "pantalla/" + r.id));
    await env.DB.prepare("DELETE FROM pm_items WHERE id IN (SELECT id FROM pm_items WHERE at < ? LIMIT 1000)").bind(old).run();
  }
  await env.DB.prepare("DELETE FROM pm_salas WHERE seen < ? AND sala NOT IN (SELECT DISTINCT sala FROM pm_items)").bind(Date.now() - 30 * 864e5).run();
}
