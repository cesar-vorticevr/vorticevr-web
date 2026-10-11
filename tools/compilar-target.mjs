// Compila el image target de MindAR (targets.mind) desde la imagen de la tarjeta impresa.
// Usa el compilador oficial de MindAR 1.2.5 dentro de Chrome headless con WebGL por software
// (SwiftShader), controlado por DevTools Protocol. No necesita npm install: solo Node 22+ y Chrome/Edge.
//
//   node tools/compilar-target.mjs <slug>                 lee _clientes/<slug>/cliente.json (ra.imagen_target,
//                                                         o ra.tarjeta si no hay)
//                                                         y escribe _clientes/<slug>/targets.mind
//   node tools/compilar-target.mjs <imagen> <salida.mind> cualquier imagen → cualquier archivo
//
// Si no encuentra el navegador: CHROME_PATH="ruta/a/chrome" node tools/compilar-target.mjs ...
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MINDAR = "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js";
function fail(msg) { console.error("✗ " + msg); process.exit(1); }

// ---------- inputs ----------
const [a, b] = process.argv.slice(2);
if (!a) fail("Uso: node tools/compilar-target.mjs <slug>   o   node tools/compilar-target.mjs <imagen> <salida.mind>");
let imgPath, outPath;
if (b) { imgPath = path.resolve(a); outPath = path.resolve(b); }
else {
  const dir = path.join(ROOT, "_clientes", a), json = path.join(dir, "cliente.json");
  if (!fs.existsSync(json)) fail(`No existe _clientes/${a}/cliente.json`);
  const c = JSON.parse(fs.readFileSync(json, "utf8"));
  const src = c.ra && (c.ra.imagen_target || c.ra.tarjeta);
  if (!src) fail(`cliente.json no tiene ra.imagen_target (la imagen de la cara de la tarjeta que se va a reconocer).`);
  imgPath = path.join(dir, src); outPath = path.join(dir, "targets.mind");
}
if (!fs.existsSync(imgPath)) fail(`No encuentro la imagen ${imgPath}`);
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const mime = MIME[path.extname(imgPath).toLowerCase()] || fail("La imagen debe ser .jpg, .png o .webp");

// ---------- browser ----------
const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].filter(Boolean);
const chromePath = CANDIDATES.find(p => fs.existsSync(p)) || fail("No encontré Chrome ni Edge. Indica la ruta con CHROME_PATH.");

// Tiny local server: the compile page and the card image (same origin, so the canvas is not tainted).
const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
import { Compiler } from "${MINDAR}";
window.__job = (async () => {
  try {
    const img = new Image(); img.src = "/tarjeta"; await img.decode();
    const c = new Compiler();
    await c.compileImageTargets([img], p => { window.__progress = p; });
    const u8 = new Uint8Array(await c.exportData());
    let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { ok: true, w: img.naturalWidth, h: img.naturalHeight, data: btoa(s) };
  } catch (e) { return { ok: false, error: String(e && e.stack || e) }; }
})();
</script>`;
const server = http.createServer((req, res) => {
  if (req.url === "/tarjeta") { res.writeHead(200, { "content-type": mime }); return res.end(fs.readFileSync(imgPath)); }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(PAGE);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const pageUrl = `http://127.0.0.1:${server.address().port}/`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "mindar-"));
const chrome = spawn(chromePath, [
  "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
  "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });
let exited = false; chrome.on("exit", () => { exited = true; });

function cleanup() {
  try { chrome.kill(); } catch {}
  server.close();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 500);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  // Chrome writes the chosen debugging port to DevToolsActivePort in the profile.
  let port;
  for (let i = 0; i < 150 && !port; i++) {
    if (exited) throw new Error("El navegador se cerró al arrancar.");
    try { port = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0].trim(); } catch { await sleep(100); }
  }
  if (!port) throw new Error("El navegador no abrió el puerto de depuración.");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expr => {
    const m = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (m.error || m.result.exceptionDetails) throw new Error(JSON.stringify(m.error || m.result.exceptionDetails));
    return m.result.result.value;
  };

  await send("Page.navigate", { url: pageUrl });
  console.log(`Compilando ${path.relative(process.cwd(), imgPath)} con MindAR 1.2.5 (WebGL por software, puede tardar 1–2 min)…`);
  let last = -1, result;
  for (;;) {
    const st = await evaluate(`(async()=>{ if(!window.__job) return {wait:true}; const done = await Promise.race([window.__job, new Promise(r=>setTimeout(()=>r(null),1000))]); return done || {progress: window.__progress||0}; })()`);
    if (st && st.ok !== undefined) { result = st; break; }
    const p = Math.floor((st && st.progress) || 0);
    if (p >= last + 10) { last = p; process.stdout.write(`  ${p}%\n`); }
  }
  ws.close();
  if (!result.ok) throw new Error(result.error);
  const buf = Buffer.from(result.data, "base64");
  fs.writeFileSync(outPath, buf);
  console.log(`✓ ${path.relative(process.cwd(), outPath)}  (${Math.round(buf.length / 1024)} KB, imagen ${result.w}×${result.h})`);
  if (result.w < 900) console.warn(`⚠ La imagen mide ${result.w} px de ancho. Para que la RA reconozca bien la tarjeta usa el diseño a 1000 px o más.`);
} catch (e) {
  console.error("✗ " + (e.message || e));
  process.exitCode = 1;
} finally {
  cleanup();
}
