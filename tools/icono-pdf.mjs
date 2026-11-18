// Prepara el isotipo de Vórtice VR (solo el símbolo, sin las letras) para el sello de las constancias (_cursos/pdf.js):
// lo recorta del logo grande (assets/logo-vorticevr.png, el primer grupo de columnas con tinta) y guarda solo su
// transparencia comprimida en _cursos/icono-pdf.js; el PDF lo pinta en blanco o en su morado original.
//   node tools/icono-pdf.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const png = readFileSync(new URL("../assets/logo-vorticevr.png", import.meta.url));
let pos = 8, W = 0, H = 0; const idat = [];
while (pos < png.length) {
  const len = png.readUInt32BE(pos), kind = png.toString("ascii", pos + 4, pos + 8), data = png.subarray(pos + 8, pos + 8 + len);
  if (kind === "IHDR") { W = data.readUInt32BE(0); H = data.readUInt32BE(4); if (data[8] !== 8 || data[9] !== 6 || data[12]) throw new Error("Se espera un PNG RGBA de 8 bits"); }
  if (kind === "IDAT") idat.push(data);
  pos += 12 + len;
}
const raw = inflateSync(Buffer.concat(idat)), bpp = 4, stride = W * bpp, px = Buffer.alloc(H * stride);
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
for (let y = 0; y < H; y++) {
  const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  for (let x = 0; x < stride; x++) {
    const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
    px[y * stride + x] = (row[x] + [0, a, b, (a + b) >> 1, paeth(a, b, c)][f]) & 255;
  }
}
const A = (x, y) => px[(y * W + x) * 4 + 3];
const colInk = x => { for (let y = 0; y < H; y++) if (A(x, y) > 20) return true; return false; };
let x0 = 0; while (x0 < W && !colInk(x0)) x0++;
let x1 = x0, gap = 0;   // the symbol ends at the first run of 12 empty columns
for (let x = x0; x < W; x++) { if (colInk(x)) { x1 = x; gap = 0; } else if (++gap >= 12) break; }
let y0 = H, y1 = 0;
for (let y = 0; y < H; y++) for (let x = x0; x <= x1; x++) if (A(x, y) > 20) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
const w = x1 - x0 + 1, h = y1 - y0 + 1, alpha = Buffer.alloc(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) alpha[y * w + x] = A(x + x0, y + y0);
writeFileSync(new URL("../_cursos/icono-pdf.js", import.meta.url), `// Generado con tools/icono-pdf.mjs desde assets/logo-vorticevr.png (no editar a mano): la transparencia del isotipo.
export const ICONO = { w: ${w}, h: ${h}, alpha: "${deflateSync(alpha, { level: 9 }).toString("base64")}" };
`);
console.log(`_cursos/icono-pdf.js: ${w}×${h}`);
