// Prepara los accesorios de los filtros para la web: recorta el espacio transparente sobrante, reduce y guarda WebP
// con transparencia en assets/filtros/ (sin el número del nombre: 05-papel-picado.png → papel-picado.webp).
//
//   node tools/procesar-accesorios.mjs [carpeta]      (por defecto _plantillas/filtros/accesorios)
//
// Tamaño máximo (lado mayor): partículas (particula-*) 256 px, nariz-reno y corazon-mejilla 384 px, adornos de pantalla (esquina-*, papel-picado,
// luces-navidad, guirnalda-banderines) 1024 px, el resto 768 px. Al final imprime las medidas para assets/filtro.js.
// Usa Chrome o Edge sin ventana (como tools/compilar-target.mjs). Si no lo encuentra: CHROME_PATH="ruta".
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.resolve(process.argv[2] || path.join(ROOT, "_plantillas/filtros/accesorios"));
const OUT = path.join(ROOT, "assets/filtros");
const fail = m => { console.error("✗ " + m); process.exit(1); };
const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter(f => /\.png$/i.test(f)).sort() : fail("No existe " + SRC);
if (!files.length) fail("No hay PNG en " + SRC);
fs.mkdirSync(OUT, { recursive: true });
const SCREEN = /^(esquina-|papel-picado|luces-navidad|guirnalda-banderines)/;
const maxOf = n => n.startsWith("particula-") ? 256 : /^(nariz-reno|corazon-mejilla)$/.test(n) ? 384 : SCREEN.test(n) ? 1024 : 768;

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].filter(Boolean);
const chromePath = CANDIDATES.find(p => fs.existsSync(p)) || fail("No encontré Chrome ni Edge. Indica la ruta con CHROME_PATH.");

// the page crops to the visible pixels (alpha > 8) with a small margin, scales down and encodes WebP
const PAGE = `<!doctype html><meta charset="utf-8"><script>
window.job = async (file, max) => {
  const img = new Image(); img.src = "/img/" + encodeURIComponent(file); await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight, c = new OffscreenCanvas(W, H), g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { error: "imagen vacía" };
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.015); x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, k = Math.min(1, max / Math.max(cw, ch)), w = Math.round(cw * k), h = Math.round(ch * k);
  const o = new OffscreenCanvas(w, h), og = o.getContext("2d"); og.imageSmoothingQuality = "high"; og.drawImage(img, x0, y0, cw, ch, 0, 0, w, h);
  const blob = await o.convertToBlob({ type: "image/webp", quality: 0.88 }), u8 = new Uint8Array(await blob.arrayBuffer());
  let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return { w, h, data: btoa(s), from: W + "×" + H };
};
</script>`;
const server = http.createServer((req, res) => {
  if (req.url.startsWith("/img/")) { const f = path.join(SRC, path.basename(decodeURIComponent(req.url.slice(5)))); res.writeHead(200, { "content-type": "image/png" }); return res.end(fs.readFileSync(f)); }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(PAGE);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "accesorios-"));
const chrome = spawn(chromePath, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
let exited = false; chrome.on("exit", () => { exited = true; });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sizes = {};
try {
  let port;
  for (let i = 0; i < 150 && !port; i++) {
    if (exited) throw new Error("El navegador se cerró al arrancar.");
    try { port = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0].trim(); } catch { await sleep(100); }
  }
  if (!port) throw new Error("El navegador no abrió el puerto de depuración.");
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expr => { const m = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (m.error || m.result.exceptionDetails) throw new Error(JSON.stringify(m.error || m.result.exceptionDetails)); return m.result.result.value; };
  await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/` });
  for (let i = 0; i < 50 && !(await evaluate("typeof window.job === 'function'").catch(() => false)); i++) await sleep(100);
  let before = 0, after = 0;
  for (const f of files) {
    const name = f.replace(/\.png$/i, "").replace(/^\d+-/, "");
    const r = await evaluate(`window.job(${JSON.stringify(f)}, ${maxOf(name)})`);
    if (r.error) { console.warn(`⚠ ${f}: ${r.error}`); continue; }
    const buf = Buffer.from(r.data, "base64"); fs.writeFileSync(path.join(OUT, name + ".webp"), buf);
    before += fs.statSync(path.join(SRC, f)).size; after += buf.length; sizes[name] = [r.w, r.h];
    console.log(`✓ ${name}.webp  ${r.w}×${r.h}  ${Math.round(buf.length / 1024)} KB  (de ${r.from})`);
  }
  ws.close();
  console.log(`\n${Object.keys(sizes).length} imágenes: ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB en assets/filtros/`);
  console.log("\nMedidas (para ASSET_SIZES en assets/filtro.js):\n" + JSON.stringify(sizes));
} catch (e) { console.error("✗ " + (e.message || e)); process.exitCode = 1; }
finally { try { chrome.kill(); } catch {} server.close(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 500); }
