// Shrinks a GLB in the browser before it is uploaded (used by /crear/): textures down to 2048 px in WebP (JPEG or
// PNG where the browser can't write WebP), very heavy meshes simplified to ~500k triangles, and the geometry
// compressed with EXT_meshopt_compression (the viewer's GLTFLoader already has the Meshopt decoder).
// A 40 MB scan usually ends at 4–8 MB and looks the same on a phone. Returns the original if it doesn't get smaller.
const LIB = new URL("./vendor/gltf-transform.js", import.meta.url).href;
const DRACO = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/";
const TEX = 2048, MAX_TRIS = 500000;

let dracoP = null;
function dracoDecoder() {   // only for GLBs that come with Draco (we read them and write Meshopt instead)
  return dracoP ||= new Promise((ok, bad) => {
    const s = document.createElement("script"); s.src = DRACO + "draco_decoder.js";
    s.onload = () => window.DracoDecoderModule({ locateFile: f => DRACO + f, onModuleLoaded: m => ok(m) });
    s.onerror = () => bad(new Error("draco")); document.head.appendChild(s);
  });
}

const tick = () => new Promise(r => setTimeout(r, 30));   // lets the progress message paint

async function encode(cv, alpha) {
  const blob = t => new Promise(r => cv.toBlob(r, t, .88));
  const webp = await blob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  return alpha ? blob("image/png") : blob("image/jpeg");
}

async function shrinkTexture(tex, webpExt) {
  const mime = tex.getMimeType(), img = tex.getImage();
  if (!img || !/^image\/(png|jpeg|webp)$/.test(mime)) return false;
  const bmp = await createImageBitmap(new Blob([img], { type: mime })).catch(() => null);
  if (!bmp) return false;
  if (Math.max(bmp.width, bmp.height) <= TEX && mime !== "image/png" && img.byteLength < 1.5 * 1048576) return false;
  const k = Math.min(1, TEX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(bmp, 0, 0, w, h); bmp.close?.();
  let alpha = false;
  if (mime !== "image/jpeg") { const d = g.getImageData(0, 0, w, h).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) { alpha = true; break; } }
  const out = await encode(cv, alpha);
  if (!out || out.size >= img.byteLength) return false;
  tex.setImage(new Uint8Array(await out.arrayBuffer())).setMimeType(out.type);
  if (out.type === "image/webp") webpExt();
  return true;
}

function triangles(doc) {
  let n = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    if (p.getMode() !== 4) continue;
    const idx = p.getIndices(), pos = p.getAttribute("POSITION");
    n += (idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3;
  }
  return n;
}

// buf: ArrayBuffer of a .glb · step(text): progress · returns { buffer, before, after, changed }
export async function compressGLB(buf, step = () => {}) {
  const before = buf.byteLength;
  step("Preparando…"); await tick();
  const L = await import(LIB);
  await Promise.all([L.MeshoptEncoder.ready, L.MeshoptDecoder.ready, L.MeshoptSimplifier.ready]);
  const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 400000)));
  const deps = { "meshopt.decoder": L.MeshoptDecoder, "meshopt.encoder": L.MeshoptEncoder };
  if (head.includes("KHR_draco_mesh_compression")) deps["draco3d.decoder"] = await dracoDecoder();
  const io = new L.WebIO().registerExtensions(L.ALL_EXTENSIONS).registerDependencies(deps);

  step("Leyendo el modelo…"); await tick();
  const doc = await io.readBinary(new Uint8Array(buf));
  const root = doc.getRoot();
  for (const e of root.listExtensionsUsed()) if (e.extensionName === "KHR_draco_mesh_compression") e.dispose();

  await doc.transform(L.dedup(), L.prune(), L.resample());

  const texs = root.listTextures();
  let webp = null;
  for (let i = 0; i < texs.length; i++) {
    step(`Reduciendo texturas (${i + 1} de ${texs.length})…`); await tick();
    await shrinkTexture(texs[i], () => { webp ||= doc.createExtension(L.EXTTextureWebP).setRequired(true); });
  }

  const tris = triangles(doc);
  if (tris > MAX_TRIS) {
    step(`Simplificando la malla (${Math.round(tris / 1000)} mil triángulos)…`); await tick();
    await doc.transform(L.weld(), L.simplify({ simplifier: L.MeshoptSimplifier, ratio: Math.max(.2, MAX_TRIS / tris), error: .002 }));
  }

  step("Comprimiendo la geometría…"); await tick();
  await doc.transform(L.meshopt({ encoder: L.MeshoptEncoder, level: "medium" }));

  step("Guardando…"); await tick();
  const out = await io.writeBinary(doc);
  if (out.byteLength >= before) return { buffer: buf, before, after: before, changed: false };
  return { buffer: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength), before, after: out.byteLength, changed: true };
}
