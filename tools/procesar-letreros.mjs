// Prepara los letreros de "Del Cacao al Chocolate" (los hizo César con IA, con fondo blanco):
// quita el fondo blanco rellenando desde las orillas, suaviza la orilla, recorta lo transparente, reduce y guarda
// WebP en realidad-virtual/cacao/letreros/. Misma lógica que tools/procesar-defensa.mjs.
//
//   node tools/procesar-letreros.mjs <carpeta-con-las-originales>
//
// Originales esperadas: 1.webp título, 2.webp desgranado, 3.webp cosecha, 4.webp fermentado, 5.webp secado,
// 6.webp molido y 7.webp tostado. Usa Chrome sin ventana; no necesita npm install.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.argv[2] || process.exit(console.error("Uso: node tools/procesar-letreros.mjs <carpeta>") || 1);
const OUT = path.join(ROOT, "realidad-virtual", "cacao", "letreros");
fs.mkdirSync(OUT, { recursive: true });

// nombre de salida, original y lado mayor
const JOBS = [
  { out: "titulo", src: "1.webp", max: 1024 },
  { out: "desgrane", src: "2.webp", max: 1024 },
  { out: "cosecha", src: "3.webp", max: 1024 },
  { out: "fermentado", src: "4.webp", max: 1024 },
  { out: "secado", src: "5.webp", max: 1024 },
  { out: "molido", src: "6.webp", max: 1024 },
  { out: "tostado", src: "7.webp", max: 1024 },
];

const PAGE = `<!doctype html><meta charset="utf-8"><script>
const JOBS = ${JSON.stringify(JOBS)};
async function one(j) {
  const img = new Image(); img.src = "/src/" + j.src; await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight, c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, w, h), d = id.data;
  // ¿ya trae transparencia? (esquinas transparentes)
  const a = i => d[i * 4 + 3];
  const hasAlpha = [0, w - 1, (h - 1) * w, h * w - 1].some(i => a(i) < 200);
  const white = i => { const r = d[i*4], g = d[i*4+1], b = d[i*4+2]; return Math.min(r, g, b) > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 30; };   // blanco y la sombra gris clara de abajo
  if (!hasAlpha) {
    const seen = new Uint8Array(w * h), st = [];
    const push = i => { if (!seen[i] && white(i)) { seen[i] = 1; st.push(i); } };
    for (let X = 0; X < w; X++) { push(X); push((h - 1) * w + X); }
    for (let Y = 0; Y < h; Y++) { push(Y * w); push(Y * w + w - 1); }
    for (const [fx, fy] of j.seeds || []) push(Math.round(fy * h) * w + Math.round(fx * w));
    while (st.length) { const i = st.pop(), X = i % w, Y = (i / w) | 0;
      if (X > 0) push(i - 1); if (X < w - 1) push(i + 1); if (Y > 0) push(i - w); if (Y < h - 1) push(i + w); }
    for (let i = 0; i < w * h; i++) if (seen[i]) d[i * 4 + 3] = 0;
    // orilla suave: pixeles claros junto a lo borrado quedan semitransparentes
    for (let Y = 1; Y < h - 1; Y++) for (let X = 1; X < w - 1; X++) {
      const i = Y * w + X; if (seen[i]) continue;
      const n = seen[i - 1] + seen[i + 1] + seen[i - w] + seen[i + w]; if (!n) continue;
      const l = (d[i*4] + d[i*4+1] + d[i*4+2]) / 3;
      d[i * 4 + 3] = Math.min(d[i * 4 + 3], Math.round(255 * Math.min(1, Math.max(.25, (255 - l) / 60))));
    }
    x.putImageData(id, 0, 0);
  }
  // recorta lo transparente
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) if (d[(Y * w + X) * 4 + 3] > 12) { if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, s = Math.min(1, j.max / Math.max(cw, ch));
  const o = document.createElement("canvas"); o.width = Math.round(cw * s); o.height = Math.round(ch * s);
  const ox = o.getContext("2d"); ox.imageSmoothingQuality = "high"; ox.drawImage(c, x0, y0, cw, ch, 0, 0, o.width, o.height);
  const blob = await new Promise(r => o.toBlob(r, "image/webp", .86));
  await fetch("/out/" + j.out, { method: "POST", body: blob });
  return { out: j.out, w: o.width, h: o.height, kb: Math.round(blob.size / 1024), hadAlpha: hasAlpha };
}
(async () => { const r = []; for (const j of JOBS) { try { r.push(await one(j)); } catch (e) { r.push({ out: j.out, error: String(e) }); } }
  await fetch("/done", { method: "POST", body: JSON.stringify(r) }); })();
</script>`;

let done;
const finished = new Promise(r => { done = r; });
const server = http.createServer((req, res) => {
  const body = []; req.on("data", c => body.push(c)); req.on("end", () => {
    const buf = Buffer.concat(body);
    if (req.url.startsWith("/src/")) { res.writeHead(200, { "content-type": "image/webp" }); return res.end(fs.readFileSync(path.join(SRC, path.basename(req.url)))); }
    if (req.url.startsWith("/out/")) { fs.writeFileSync(path.join(OUT, path.basename(req.url) + ".webp"), buf); res.end("ok"); return; }
    if (req.url === "/done") { res.end("ok"); done(JSON.parse(buf.toString())); return; }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(PAGE);
  });
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const chromePath = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p => fs.existsSync(p));
if (!chromePath) { console.error("No encontré Chrome ni Edge (CHROME_PATH)."); process.exit(1); }
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "letreros-"));
const chrome = spawn(chromePath, ["--headless=new", `--user-data-dir=${profile}`, "--no-first-run", `http://127.0.0.1:${server.address().port}/`], { stdio: "ignore" });
const t = setTimeout(() => { console.error("Tardó demasiado."); chrome.kill(); process.exit(1); }, 120000);
const r = await finished;
clearTimeout(t); chrome.kill(); server.close();
for (const x of r) console.log(x.error ? `✗ ${x.out}: ${x.error}` : `✓ ${x.out}.webp ${x.w}×${x.h} ${x.kb} KB${x.hadAlpha ? " (ya era transparente)" : ""}`);
setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} process.exit(0); }, 500);
