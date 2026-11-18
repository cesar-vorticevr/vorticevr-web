// Prepara la firma de César para las constancias en PDF (_cursos/pdf.js), igual que tools/logo-pdf.mjs:
// lee _cursos/firma-cesar.png (RGBA de 8 bits), vuelve transparente el papel (lo claro) y deja la tinta en azul
// de pluma, y guarda color y transparencia comprimidos en _cursos/firma-pdf.js.
//   node tools/firma-pdf.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const png = readFileSync(new URL("../_cursos/firma-cesar.png", import.meta.url));
let pos = 8, W = 0, H = 0, bits = 0, type = 0, inter = 0; const idat = [];
while (pos < png.length) {
  const len = png.readUInt32BE(pos), kind = png.toString("ascii", pos + 4, pos + 8), data = png.subarray(pos + 8, pos + 8 + len);
  if (kind === "IHDR") { W = data.readUInt32BE(0); H = data.readUInt32BE(4); bits = data[8]; type = data[9]; inter = data[12]; }
  if (kind === "IDAT") idat.push(data);
  pos += 12 + len;
}
if (bits !== 8 || (type !== 6 && type !== 2) || inter) throw new Error("Se espera un PNG RGB o RGBA de 8 bits sin entrelazado");
const bpp = type === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), stride = W * bpp, px = Buffer.alloc(H * stride);
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
for (let y = 0; y < H; y++) {
  const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  for (let x = 0; x < stride; x++) {
    const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
    px[y * stride + x] = (row[x] + [0, a, b, (a + b) >> 1, paeth(a, b, c)][f]) & 255;
  }
}
// ink = how far from the paper: transparent where it is light, pen blue where it is ink
const INK = [28, 40, 150];
const rgb = Buffer.alloc(W * H * 3), alpha = Buffer.alloc(W * H);
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let i = 0; i < W * H; i++) {
  const r = px[i * bpp], g = px[i * bpp + 1], b = px[i * bpp + 2], al = bpp === 4 ? px[i * bpp + 3] : 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b, ink = Math.max(0, Math.min(1, (235 - lum) / 120));
  const a = Math.round(al * ink);
  alpha[i] = a; rgb[i * 3] = INK[0]; rgb[i * 3 + 1] = INK[1]; rgb[i * 3 + 2] = INK[2];
  if (a > 20) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
}
// crop to the ink
const w = x1 - x0 + 1, h = y1 - y0 + 1, cr = Buffer.alloc(w * h * 3), ca = Buffer.alloc(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const s = (y + y0) * W + x + x0, o = y * w + x;
  rgb.copy(cr, o * 3, s * 3, s * 3 + 3); ca[o] = alpha[s];
}
const out = `// Generado con tools/firma-pdf.mjs desde _cursos/firma-cesar.png (no editar a mano).
export const FIRMA = { w: ${w}, h: ${h}, rgb: "${deflateSync(cr, { level: 9 }).toString("base64")}", alpha: "${deflateSync(ca, { level: 9 }).toString("base64")}" };
`;
writeFileSync(new URL("../_cursos/firma-pdf.js", import.meta.url), out);
console.log(`_cursos/firma-pdf.js: ${w}×${h}, ${(out.length / 1024).toFixed(0)} KB`);
