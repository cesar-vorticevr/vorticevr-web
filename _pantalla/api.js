// Pantalla mágica (/pantalla-magica/): una pantalla grande con mariposas 3D que vuelan; cada quien pinta la suya en el
// celular (/pantalla-magica/pintar/?sala=CÓDIGO) y la suelta en la pantalla en tiempo real (la pantalla pregunta cada 2 s).
//  - Sala = código de 4 a 8 letras que inventa la pantalla; la registra con una llave (solo esa pantalla puede quitar
//    mariposas). Un celular sin sala abierta no puede soltar nada.
//  - Cada celular (uid anónimo del navegador) tiene UNA mariposa en la pantalla: soltar otra reemplaza la suya.
//  - `kind` = especie (hoy "mariposa"); otras especies se agregan en KINDS y en assets/pantalla/especies.js.
// Tablas pm_salas y pm_items; texturas en R2 `pantalla/<id>`. El cron diario borra lo de más de 3 días.

const KINDS = ["mariposa"];
const MAX_VIVAS = 60;          // mariposas a la vez en una sala; las más viejas se van volando
const MAX_BYTES = 900 * 1024;  // textura (1024 × 512 WebP o PNG)
const SALA = /^[A-Z0-9]{4,8}$/;
const MALAS = /(put[oa]|pendej|verga|chinga|cabr[oó]n|mierda|culer|joto|puñet|naco|zorra|perra|pito|culo|fuck|shit|bitch|nazi)/i;

let ready = false;
async function tablas(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_salas (sala TEXT PRIMARY KEY, llave TEXT NOT NULL, created INTEGER, seen INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_items (id TEXT PRIMARY KEY, sala TEXT NOT NULL, kind TEXT NOT NULL, name TEXT, uid TEXT NOT NULL, at INTEGER NOT NULL, gone INTEGER DEFAULT 0, gone_at INTEGER)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS pm_items_sala ON pm_items (sala, gone, at)"),
  ]);
  ready = true;
}

async function sha(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const cleanName = s => {
  s = String(s || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 18);
  return MALAS.test(s) ? "" : s;
};

export async function pantallaApi(request, env, ctx, url, path, ip, h) {
  if (!path.startsWith("/api/pantalla/")) return null;
  const { json, limit } = h;
  await tablas(env);
  const M = request.method, now = Date.now();

  // the texture of one butterfly (never changes: long cache)
  let m = path.match(/^\/api\/pantalla\/img\/([a-z0-9]{12,32})$/);
  if (m && M === "GET") {
    const o = await env.MEDIA.get("pantalla/" + m[1]);
    if (!o) return new Response("No existe", { status: 404 });
    return new Response(o.body, { headers: { "Content-Type": o.httpMetadata?.contentType || "image/webp", "Cache-Control": "public, max-age=604800, immutable" } });
  }

  m = path.match(/^\/api\/pantalla\/([A-Z0-9]{4,8})(?:\/(abrir|soltar|quitar))?$/);
  if (!m || !SALA.test(m[1])) return null;
  const sala = m[1], act = m[2] || "";

  // the screen opens (or takes back) its room with its key
  if (act === "abrir" && M === "POST") {
    const b = await request.json().catch(() => ({}));
    const llave = String(b.llave || "");
    if (!/^[a-z0-9]{16,64}$/.test(llave)) return json({ error: "Llave inválida" }, 400);
    if (!(await limit(env, "pm-abrir:" + ip, 60, 3600e3))) return json({ error: "Demasiadas salas. Intenta en un rato." }, 429);
    const hash = await sha(llave);
    const row = await env.DB.prepare("SELECT llave FROM pm_salas WHERE sala = ?").bind(sala).first();
    if (row && row.llave !== hash) return json({ error: "Esa sala ya es de otra pantalla.", ocupada: true }, 409);
    if (!row) await env.DB.prepare("INSERT INTO pm_salas (sala, llave, created, seen) VALUES (?, ?, ?, ?)").bind(sala, hash, now, now).run();
    else await env.DB.prepare("UPDATE pm_salas SET seen = ? WHERE sala = ?").bind(now, sala).run();
    return json({ ok: true });
  }

  // the screen asks what changed since its last look (2 s overlap: the client ignores ids it already has)
  if (!act && M === "GET") {
    const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
    let items, gone = [];
    if (!since) {
      ({ results: items } = await env.DB.prepare("SELECT id, kind, name, at FROM pm_items WHERE sala = ? AND gone = 0 ORDER BY at DESC LIMIT ?").bind(sala, MAX_VIVAS).all());
      items.reverse();
    } else {
      const s = since - 3000;
      ({ results: items } = await env.DB.prepare("SELECT id, kind, name, at FROM pm_items WHERE sala = ? AND gone = 0 AND at > ? ORDER BY at LIMIT 40").bind(sala, s).all());
      ({ results: gone } = await env.DB.prepare("SELECT id FROM pm_items WHERE sala = ? AND gone = 1 AND gone_at > ? LIMIT 100").bind(sala, s).all());
      gone = gone.map(r => r.id);
    }
    return json({ now, items, gone });
  }

  // a phone releases its butterfly (replaces the one it already had)
  if (act === "soltar" && M === "POST") {
    const salaRow = await env.DB.prepare("SELECT sala FROM pm_salas WHERE sala = ?").bind(sala).first();
    if (!salaRow) return json({ error: "Esa pantalla no está encendida. Revisa el código." }, 404);
    const f = await request.formData().catch(() => null);
    if (!f) return json({ error: "No llegó tu dibujo." }, 400);
    const uid = String(f.get("uid") || ""), kind = String(f.get("kind") || "mariposa"), img = f.get("img");
    if (!/^[a-z0-9]{12,40}$/.test(uid)) return json({ error: "Datos inválidos" }, 400);
    if (!KINDS.includes(kind)) return json({ error: "Tipo inválido" }, 400);
    if (!img || typeof img === "string" || !/^image\/(webp|png)$/.test(img.type) || img.size > MAX_BYTES || img.size < 500) return json({ error: "Tu dibujo no se pudo leer. Intenta de nuevo." }, 400);
    if (!(await limit(env, "pm-u:" + uid, 1, 10e3))) return json({ error: "Espera unos segundos para soltar otra.", espera: true }, 429);
    if (!(await limit(env, "pm-ip:" + ip, 400, 3600e3))) return json({ error: "Muchas mariposas desde esta red. Intenta en un rato." }, 429);
    const id = [...crypto.getRandomValues(new Uint8Array(10))].map(b => b.toString(16).padStart(2, "0")).join("");
    await env.MEDIA.put("pantalla/" + id, await img.arrayBuffer(), { httpMetadata: { contentType: img.type } });
    const name = cleanName(f.get("name"));
    await env.DB.batch([
      env.DB.prepare("UPDATE pm_items SET gone = 1, gone_at = ? WHERE sala = ? AND uid = ? AND gone = 0").bind(now, sala, uid),
      env.DB.prepare("INSERT INTO pm_items (id, sala, kind, name, uid, at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, sala, kind, name, uid, now),
      // too many: the oldest leave
      env.DB.prepare(`UPDATE pm_items SET gone = 1, gone_at = ? WHERE id IN (SELECT id FROM pm_items WHERE sala = ? AND gone = 0 ORDER BY at DESC LIMIT -1 OFFSET ${MAX_VIVAS})`).bind(now, sala),
    ]);
    return json({ ok: true, id });
  }

  // the screen removes one (moderation: double click on it)
  if (act === "quitar" && M === "POST") {
    const b = await request.json().catch(() => ({}));
    const row = await env.DB.prepare("SELECT llave FROM pm_salas WHERE sala = ?").bind(sala).first();
    if (!row || row.llave !== await sha(String(b.llave || ""))) return json({ error: "Solo la pantalla puede quitar mariposas." }, 403);
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
