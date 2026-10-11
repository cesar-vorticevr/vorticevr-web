// Servidor local para probar el sitio antes de publicarlo.
//
//   node tools/servidor-local.mjs          → http://localhost:8080
//   node tools/servidor-local.mjs 3000     → otro puerto
//
// Se comporta como Cloudflare: /carpeta redirige a /carpeta/ y sirve su index.html.
// También muestra la dirección de red local para abrirlo desde el celular en el mismo wifi
// (la cámara de la RA solo funciona en el celular con https: para eso usar la versión preview).
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 8080;
const HIDDEN = ["_clientes", "_plantillas", "tools", ".git"]; // not published, so not served either
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".glb": "model/gltf-binary", ".mp4": "video/mp4", ".webm": "video/webm",
  ".mind": "application/octet-stream", ".woff2": "font/woff2",
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || HIDDEN.some(h => url.startsWith("/" + h))) { res.writeHead(404); return res.end("404"); }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      if (!url.endsWith("/")) { res.writeHead(307, { location: url + "/" }); return res.end(); }
      return send(path.join(file, "index.html"), res);
    }
    send(file, res);
  });
}).listen(PORT, () => {
  console.log(`Sitio local: http://localhost:${PORT}/`);
  for (const n of Object.values(os.networkInterfaces()).flat())
    if (n && n.family === "IPv4" && !n.internal) console.log(`Desde el celular (mismo wifi): http://${n.address}:${PORT}/`);
  console.log("Ctrl+C para detener.");
});

function send(file, res) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); return res.end("404 · no existe"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  });
}
