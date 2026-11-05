// Prepara el logo de Vórtice VR para las constancias en PDF (_cursos/pdf.js), sin librerías:
// lee el PNG (RGBA de 8 bits), lo reduce a 600 px de ancho y guarda color y transparencia por separado,
// ya comprimidos (FlateDecode), en _cursos/logo-pdf.js. Así el Worker solo pega los bytes en el PDF.
//   node tools/logo-pdf.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const src = new URL("../assets/logo-vorticevr.png", import.meta.url);
const png = readFileSync(src);
let pos = 8, W = 0, H = 0, bits = 0, type = 0, inter = 0; const idat = [];
while (pos < png.length) {
  const len = png.readUInt32BE(pos), kind = png.toString("ascii", pos + 4, pos + 8), data = png.subarray(pos + 8, pos + 8 + len);
  if (kind === "IHDR") { W = data.readUInt32BE(0); H = data.readUInt32BE(4); bits = data[8]; type = data[9]; inter = data[12]; }
  if (kind === "IDAT") idat.push(data);
  pos += 12 + len;
}
if (bits !== 8 || type !== 6 || inter) throw new Error("Se espera un PNG RGBA de 8 bits sin entrelazado");
const raw = inflateSync(Buffer.concat(idat)), bpp = 4, stride = W * bpp, px = Buffer.alloc(H * stride);
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
for (let y = 0; y < H; y++) {
  const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  for (let x = 0; x < stride; x++) {
    const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
    px[y * stride + x] = (row[x] + [0, a, b, (a + b) >> 1, paeth(a, b, c)][f]) & 255;
  }
}
// box filter down to 600 px wide (premultiplied, so the transparent edges do not turn dark)
const w = 600, h = Math.round(H * w / W), rgb = Buffer.alloc(w * h * 3), alpha = Buffer.alloc(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const x0 = Math.floor(x * W / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * W / w)), y0 = Math.floor(y * H / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * H / h));
  let r = 0, g = 0, b = 0, a = 0, n = 0;
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * W + xx) * 4, al = px[i + 3]; r += px[i] * al; g += px[i + 1] * al; b += px[i + 2] * al; a += al; n++; }
  const o = y * w + x;
  rgb[o * 3] = a ? Math.round(r / a) : 255; rgb[o * 3 + 1] = a ? Math.round(g / a) : 255; rgb[o * 3 + 2] = a ? Math.round(b / a) : 255;
  alpha[o] = Math.round(a / n);
}
const out = `// Generado con tools/logo-pdf.mjs desde assets/logo-vorticevr.png (no editar a mano).
export const LOGO = { w: ${w}, h: ${h}, rgb: "${deflateSync(rgb, { level: 9 }).toString("base64")}", alpha: "${deflateSync(alpha, { level: 9 }).toString("base64")}" };
`;
writeFileSync(new URL("../_cursos/logo-pdf.js", import.meta.url), out);
console.log(`_cursos/logo-pdf.js: ${w}×${h}, ${(out.length / 1024).toFixed(0)} KB`);
