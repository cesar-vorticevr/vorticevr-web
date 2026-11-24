// Cabina mágica (/cabina-magica/): la foto grupal se sube para que cada quien se la lleve con un QR.
//  - POST /api/cabina/foto (cuerpo = el JPEG) → { id }. Máximo 4 MB; 120 por hora por IP (la cabina es una sola compu).
//  - GET /api/cabina/foto/<id> → la imagen (`?bajar=1` la manda como descarga).
//  - El celular abre /cabina-magica/foto/?id=<id> (página estática que la muestra y la guarda).
// Solo R2 (`cabina/<id>`), sin tablas. El id es aleatorio de 20 letras, así que nadie adivina las fotos de otros.
// El cron diario borra las de más de 3 días.

const MAX_BYTES = 4 * 1024 * 1024;
const DIAS = 3;
const ID = /^[a-z0-9]{20}$/;

function newId() {
  const a = "abcdefghijkmnpqrstuvwxyz23456789", b = crypto.getRandomValues(new Uint8Array(20));
  return [...b].map(x => a[x % a.length]).join("");
}

export async function cabinaApi(request, env, ctx, url, path, ip, h) {
  if (!path.startsWith("/api/cabina/")) return null;
  const { json, limit } = h, M = request.method;

  if (path === "/api/cabina/foto" && M === "POST") {
    if (!(await limit(env, "cabina:" + ip, 120, 3600e3))) return json({ error: "Demasiadas fotos; espera un rato." }, 429);
    const type = (request.headers.get("Content-Type") || "").split(";")[0];
    if (type !== "image/jpeg") return json({ error: "La foto debe ser JPEG." }, 400);
    const buf = await request.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > MAX_BYTES) return json({ error: "La foto pesa demasiado." }, 413);
    const u = new Uint8Array(buf, 0, 3);
    if (u[0] !== 0xff || u[1] !== 0xd8 || u[2] !== 0xff) return json({ error: "La foto debe ser JPEG." }, 400);
    const id = newId();
    await env.MEDIA.put("cabina/" + id, buf, { httpMetadata: { contentType: "image/jpeg" }, customMetadata: { at: String(Date.now()) } });
    return json({ id, dias: DIAS });
  }

  const m = path.match(/^\/api\/cabina\/foto\/([a-z0-9]+)$/);
  if (m && (M === "GET" || M === "HEAD")) {
    if (!ID.test(m[1])) return json({ error: "No existe." }, 404);
    const o = await env.MEDIA.get("cabina/" + m[1]);
    if (!o || Date.now() - o.uploaded.getTime() > DIAS * 864e5) return json({ error: "Esta foto ya no está disponible." }, 404);
    const hd = { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400", "X-Robots-Tag": "noindex" };
    if (url.searchParams.has("bajar")) hd["Content-Disposition"] = 'attachment; filename="cabina-magica-vorticevr.jpg"';
    return new Response(M === "HEAD" ? null : o.body, { headers: hd });
  }
  return json({ error: "No existe." }, 404);
}

// cron diario: borra las fotos de más de DIAS días
export async function cabinaLimpieza(env) {
  const old = Date.now() - DIAS * 864e5;
  let cursor;
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    const r = await env.MEDIA.list({ prefix: "cabina/", cursor, limit: 1000 });
    const viejas = r.objects.filter(o => o.uploaded.getTime() < old).map(o => o.key);
    if (viejas.length) await env.MEDIA.delete(viejas);
    if (!r.truncated) break;
    cursor = r.cursor;
  }
}
