// Mensajes entre cuentas (5 de noviembre de 2026, César: Vórtice VR como escaparate artístico, para que a un creador le
// puedan escribir desde su perfil y ofrecer o pedir experiencias). Un chat entre dos cuentas que **nadie puede borrar ni
// editar** (solo un admin puede ocultar un mensaje, por un reporte o por la ley). Para cuidar a los menores y evitar el
// spam: el primer mensaje llega como **solicitud** y hasta que la otra persona responde o la acepta no se puede escribir
// otro; cada quien decide si recibe mensajes (users.dm: "solicitud" o "nadie"); se puede bloquear y reportar; hay límites
// por hora. Sin correos (Resend es solo para los códigos): el aviso es el número de no leídos en Mi cuenta.
// Tablas: dm_threads (a < b, los ids de las dos cuentas), dm_messages, dm_blocks, dm_reports.

const MAX_TEXT = 2000;
const LIMIT = { newPerDay: 15, msgPerHour: 60, reportsPerDay: 10 };

let migrated = false;
async function migrate(env) {
  if (migrated) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS dm_threads (id INTEGER PRIMARY KEY AUTOINCREMENT, a INTEGER NOT NULL, b INTEGER NOT NULL, started_by INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', blocked_by INTEGER, created INTEGER, last_at INTEGER DEFAULT 0, last_from INTEGER, last_text TEXT, a_read INTEGER DEFAULT 0, b_read INTEGER DEFAULT 0, UNIQUE (a, b))`),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS dm_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, thread INTEGER NOT NULL, from_id INTEGER NOT NULL, body TEXT NOT NULL, at INTEGER, hidden INTEGER DEFAULT 0)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS dm_messages_thread ON dm_messages (thread, id)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS dm_threads_a ON dm_threads (a, last_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS dm_threads_b ON dm_threads (b, last_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS dm_blocks (user_id INTEGER NOT NULL, blocked INTEGER NOT NULL, at INTEGER, PRIMARY KEY (user_id, blocked))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS dm_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, thread INTEGER NOT NULL, by_id INTEGER NOT NULL, note TEXT, at INTEGER, done INTEGER DEFAULT 0)"),
  ]);
  migrated = true;
}
const clean = t => String(t || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, MAX_TEXT);
const mine = (t, me) => t && (t.a === me.id || t.b === me.id);
const other = (t, me) => t.a === me.id ? t.b : t.a;
const readCol = (t, me) => t.a === me.id ? "a_read" : "b_read";
async function blockedBetween(env, x, y) {
  return !!(await env.DB.prepare("SELECT 1 FROM dm_blocks WHERE (user_id = ? AND blocked = ?) OR (user_id = ? AND blocked = ?)").bind(x, y, y, x).first());
}
function person(r, h) { return { id: r.id, name: r.name || r.handle || "Alguien", handle: r.handle || null, avatar: r.avatar ? h.avatarUrl(r.id, r.avatar) : null }; }
async function threadOut(env, t, me, h) {
  const u = await env.DB.prepare("SELECT id, name, handle, avatar FROM users WHERE id = ?").bind(other(t, me)).first();
  const read = t[readCol(t, me)] || 0;
  return { id: t.id, with: u ? person(u, h) : { id: 0, name: "Cuenta eliminada", handle: null, avatar: null }, status: t.status,
    mine: t.started_by === me.id, blockedByMe: t.status === "blocked" && t.blocked_by === me.id, last_at: t.last_at, last_text: t.last_text || "",
    last_mine: t.last_from === me.id, unread: !!t.last_at && t.last_from !== me.id && t.last_at > read };
}

export async function mensajesApi(request, env, ctx, url, path, me, h) {
  if (!path.startsWith("/api/dm") && !path.startsWith("/api/admin/dm")) return null;
  const { json, limit } = h, M = request.method;
  if (!me) return json({ error: "Inicia sesión para ver tus mensajes.", login: true }, 401);
  await migrate(env);
  let m;

  // ---- admin: reported chats, read them and hide one message (the only way anything goes away)
  if (path.startsWith("/api/admin/dm")) {
    if (!h.isAdmin(env, me)) return json({ error: "Solo administradores." }, 403);
    if (path === "/api/admin/dm-reports" && M === "GET") {
      const { results } = await env.DB.prepare(`SELECT r.*, t.a, t.b, ua.handle AS a_handle, ua.email AS a_email, ub.handle AS b_handle, ub.email AS b_email, uby.handle AS by_handle
        FROM dm_reports r JOIN dm_threads t ON t.id = r.thread LEFT JOIN users ua ON ua.id = t.a LEFT JOIN users ub ON ub.id = t.b LEFT JOIN users uby ON uby.id = r.by_id
        ORDER BY r.done, r.at DESC LIMIT 200`).all();
      return json({ reports: results });
    }
    if ((m = path.match(/^\/api\/admin\/dm-reports\/(\d+)$/)) && M === "POST") {
      await env.DB.prepare("UPDATE dm_reports SET done = 1 WHERE id = ?").bind(+m[1]).run(); return json({ ok: true });
    }
    if ((m = path.match(/^\/api\/admin\/dm\/(\d+)$/)) && M === "GET") {
      const t = await env.DB.prepare("SELECT * FROM dm_threads WHERE id = ?").bind(+m[1]).first(); if (!t) return json({ error: "No existe" }, 404);
      const { results } = await env.DB.prepare("SELECT m.*, u.handle FROM dm_messages m LEFT JOIN users u ON u.id = m.from_id WHERE m.thread = ? ORDER BY m.id").bind(t.id).all();
      return json({ thread: t, messages: results });
    }
    if ((m = path.match(/^\/api\/admin\/dm\/msg\/(\d+)$/)) && M === "POST") {
      const b = await request.json().catch(() => ({}));
      await env.DB.prepare("UPDATE dm_messages SET hidden = ? WHERE id = ?").bind(b.hidden === false ? 0 : 1, +m[1]).run(); return json({ ok: true });
    }
    return json({ error: "No existe" }, 404);
  }

  // how many chats have something new (the number in Mi cuenta)
  if (path === "/api/dm/unread" && M === "GET") {
    const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM dm_threads WHERE status IN ('pending','ok') AND last_at > 0 AND last_from != ?
      AND ((a = ? AND last_at > a_read) OR (b = ? AND last_at > b_read))`).bind(me.id, me.id, me.id).first();
    return json({ unread: r.n });
  }
  // my chats, the newest first
  if (path === "/api/dm" && M === "GET") {
    const { results } = await env.DB.prepare(`SELECT t.*, u.id AS uid, u.name, u.handle, u.avatar FROM dm_threads t LEFT JOIN users u ON u.id = CASE WHEN t.a = ? THEN t.b ELSE t.a END
      WHERE (t.a = ? OR t.b = ?) AND t.last_at > 0 ORDER BY t.last_at DESC LIMIT 200`).bind(me.id, me.id, me.id).all();
    return json({ threads: results.map(t => {
      const read = t[readCol(t, me)] || 0;
      return { id: t.id, with: t.uid ? person({ id: t.uid, name: t.name, handle: t.handle, avatar: t.avatar }, h) : { id: 0, name: "Cuenta eliminada", handle: null, avatar: null },
        status: t.status, mine: t.started_by === me.id, blockedByMe: t.status === "blocked" && t.blocked_by === me.id, last_at: t.last_at, last_text: (t.last_text || "").slice(0, 140),
        last_mine: t.last_from === me.id, unread: t.last_from !== me.id && t.last_at > read };
    }) });
  }
  // open a chat with someone from their portal (it is created with the first message)
  if (path === "/api/dm/start" && M === "POST") {
    const b = await request.json().catch(() => ({}));
    const hd = String(b.handle || "").toLowerCase().replace(/^@/, "");
    const u = /^[a-z0-9_-]{3,24}$/.test(hd) ? await env.DB.prepare("SELECT id, name, handle, avatar, dm FROM users WHERE handle = ? AND verified = 1").bind(hd).first() : null;
    if (!u) return json({ error: "No encontramos esa cuenta." }, 404);
    if (u.id === me.id) return json({ error: "Ese es tu propio perfil." }, 400);
    const [a, bb] = me.id < u.id ? [me.id, u.id] : [u.id, me.id];
    const t = await env.DB.prepare("SELECT * FROM dm_threads WHERE a = ? AND b = ?").bind(a, bb).first();
    if (t) return json({ thread: await threadOut(env, t, me, h) });
    if (u.dm === "nadie") return json({ error: "Esta cuenta no recibe mensajes." }, 403);
    if (await blockedBetween(env, me.id, u.id)) return json({ error: "No puedes escribirle a esta cuenta." }, 403);
    return json({ thread: { id: 0, with: person(u, h), status: "new", mine: true, last_at: 0, last_text: "", unread: false } });
  }
  // the messages of one chat (?after=<id> brings only the new ones); reading them marks the chat as read
  if ((m = path.match(/^\/api\/dm\/(\d+)$/)) && M === "GET") {
    const t = await env.DB.prepare("SELECT * FROM dm_threads WHERE id = ?").bind(+m[1]).first();
    if (!mine(t, me)) return json({ error: "No existe" }, 404);
    const after = +url.searchParams.get("after") || 0;
    const { results } = await env.DB.prepare("SELECT id, from_id, body, at, hidden FROM dm_messages WHERE thread = ? AND id > ? ORDER BY id LIMIT 500").bind(t.id, after).all();
    await env.DB.prepare(`UPDATE dm_threads SET ${readCol(t, me)} = ? WHERE id = ?`).bind(Date.now(), t.id).run();
    return json({ thread: await threadOut(env, t, me, h), messages: results.map(x => x.hidden ? { id: x.id, mine: x.from_id === me.id, at: x.at, hidden: true } : { id: x.id, mine: x.from_id === me.id, at: x.at, body: x.body }) });
  }
  // send: to a chat (its id) or the first one to someone (handle). Nothing sent can be deleted or edited.
  if ((m = path.match(/^\/api\/dm\/(\d+|nuevo)\/enviar$/)) && M === "POST") {
    const b = await request.json().catch(() => ({})), text = clean(b.text);
    if (!text) return json({ error: "Escribe tu mensaje." }, 400);
    if (!(await limit(env, "dm:" + me.id, LIMIT.msgPerHour, 3600e3))) return json({ error: "Mandaste muchos mensajes seguidos. Espera un rato." }, 429);
    let t;
    if (m[1] === "nuevo") {
      const hd = String(b.handle || "").toLowerCase().replace(/^@/, "");
      const u = /^[a-z0-9_-]{3,24}$/.test(hd) ? await env.DB.prepare("SELECT id, dm FROM users WHERE handle = ? AND verified = 1").bind(hd).first() : null;
      if (!u) return json({ error: "No encontramos esa cuenta." }, 404);
      if (u.id === me.id) return json({ error: "Ese es tu propio perfil." }, 400);
      const [a, bb] = me.id < u.id ? [me.id, u.id] : [u.id, me.id];
      t = await env.DB.prepare("SELECT * FROM dm_threads WHERE a = ? AND b = ?").bind(a, bb).first();
      if (!t) {
        if (u.dm === "nadie") return json({ error: "Esta cuenta no recibe mensajes." }, 403);
        if (await blockedBetween(env, me.id, u.id)) return json({ error: "No puedes escribirle a esta cuenta." }, 403);
        if (!(await limit(env, "dmnew:" + me.id, LIMIT.newPerDay, 864e5))) return json({ error: "Ya empezaste muchas conversaciones hoy. Intenta mañana." }, 429);
        await env.DB.prepare("INSERT OR IGNORE INTO dm_threads (a, b, started_by, status, created) VALUES (?, ?, ?, 'pending', ?)").bind(a, bb, me.id, Date.now()).run();
        t = await env.DB.prepare("SELECT * FROM dm_threads WHERE a = ? AND b = ?").bind(a, bb).first();
      }
    } else t = await env.DB.prepare("SELECT * FROM dm_threads WHERE id = ?").bind(+m[1]).first();
    if (!mine(t, me)) return json({ error: "No existe" }, 404);
    if (t.status === "blocked") return json({ error: t.blocked_by === me.id ? "Bloqueaste esta conversación." : "No puedes escribir en esta conversación." }, 403);
    if (t.status === "rejected") return json({ error: t.started_by === me.id ? "Esta persona no aceptó tu solicitud." : "Rechazaste esta solicitud." }, 403);
    if (t.status === "pending") {
      if (t.started_by === me.id) {   // a request: one message until the other person answers or accepts it
        const sent = await env.DB.prepare("SELECT COUNT(*) AS n FROM dm_messages WHERE thread = ?").bind(t.id).first();
        if (sent.n >= 1) return json({ error: "Espera a que acepte tu solicitud para seguir escribiendo." }, 403);
      } else await env.DB.prepare("UPDATE dm_threads SET status = 'ok' WHERE id = ?").bind(t.id).run();   // answering = accepting
    }
    const now = Date.now();
    const r = await env.DB.prepare("INSERT INTO dm_messages (thread, from_id, body, at) VALUES (?, ?, ?, ?)").bind(t.id, me.id, text, now).run();
    await env.DB.prepare(`UPDATE dm_threads SET last_at = ?, last_from = ?, last_text = ?, ${readCol(t, me)} = ? WHERE id = ?`).bind(now, me.id, text.slice(0, 200), now, t.id).run();
    return json({ ok: true, thread: t.id, message: { id: r.meta.last_row_id, mine: true, at: now, body: text } });
  }
  // the person who got the request: accept or reject it; either one: block (and unblock), report
  if ((m = path.match(/^\/api\/dm\/(\d+)\/(aceptar|rechazar|bloquear|desbloquear|reportar)$/)) && M === "POST") {
    const t = await env.DB.prepare("SELECT * FROM dm_threads WHERE id = ?").bind(+m[1]).first();
    if (!mine(t, me)) return json({ error: "No existe" }, 404);
    const act = m[2], them = other(t, me);
    if (act === "aceptar" || act === "rechazar") {
      if (t.status !== "pending" || t.started_by === me.id) return json({ error: "No hay una solicitud que responder." }, 400);
      await env.DB.prepare("UPDATE dm_threads SET status = ? WHERE id = ?").bind(act === "aceptar" ? "ok" : "rejected", t.id).run();
    } else if (act === "bloquear") {
      await env.DB.batch([env.DB.prepare("INSERT OR IGNORE INTO dm_blocks (user_id, blocked, at) VALUES (?, ?, ?)").bind(me.id, them, Date.now()),
        env.DB.prepare("UPDATE dm_threads SET status = 'blocked', blocked_by = ? WHERE id = ?").bind(me.id, t.id)]);
    } else if (act === "desbloquear") {
      if (t.blocked_by !== me.id) return json({ error: "No bloqueaste esta conversación." }, 400);
      await env.DB.batch([env.DB.prepare("DELETE FROM dm_blocks WHERE user_id = ? AND blocked = ?").bind(me.id, them),
        env.DB.prepare("UPDATE dm_threads SET status = 'ok', blocked_by = NULL WHERE id = ?").bind(t.id)]);
    } else {
      if (!(await limit(env, "dmrep:" + me.id, LIMIT.reportsPerDay, 864e5))) return json({ error: "Ya recibimos varios reportes tuyos hoy." }, 429);
      const b = await request.json().catch(() => ({}));
      await env.DB.prepare("INSERT INTO dm_reports (thread, by_id, note, at) VALUES (?, ?, ?, ?)").bind(t.id, me.id, String(b.note || "").trim().slice(0, 500), Date.now()).run();
    }
    const t2 = await env.DB.prepare("SELECT * FROM dm_threads WHERE id = ?").bind(t.id).first();
    return json({ ok: true, thread: await threadOut(env, t2, me, h) });
  }
  return json({ error: "No existe" }, 404);
}
