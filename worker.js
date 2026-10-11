// Worker in front of the static assets, only for /ra/* (see run_worker_first in wrangler.jsonc).
// Static assets ignore HTTP Range requests; iPhone Safari needs them (206 Partial Content) to play
// <video> files. For video files this answers ranges itself; everything else passes straight through.
const VIDEO = /\.(mp4|m4v|webm|mov)$/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!VIDEO.test(url.pathname)) return env.ASSETS.fetch(request);

    const range = request.headers.get("Range");
    const plain = new Headers(request.headers); plain.delete("Range");
    const res = await env.ASSETS.fetch(new Request(request, { headers: plain }));
    if (res.status !== 200) return res;

    const headers = new Headers(res.headers);
    headers.set("Accept-Ranges", "bytes");
    const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) return new Response(res.body, { status: 200, headers });

    const buf = await res.arrayBuffer(), size = buf.byteLength;
    let start, end;
    if (m[1] === "") { start = Math.max(0, size - Number(m[2])); end = size - 1; } // bytes=-N (last N)
    else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(request.method === "HEAD" ? null : buf.slice(start, end + 1), { status: 206, headers });
  },
};
