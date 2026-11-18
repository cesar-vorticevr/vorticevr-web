// Prepara las letras de las constancias (_cursos/pdf.js): Cinzel (títulos), EB Garamond (texto) y Great Vibes
// (el nombre, en caligrafía) e IBM Plex Mono (folio y datos). Todas de Google Fonts con licencia OFL. Las recorta a los caracteres de WinAnsi
// (español completo), fija el grosor de las variables y guarda en _cursos/fuentes-pdf.js cada TTF comprimido
// con sus medidas y anchos, para incrustarlas en el PDF sin librerías.
// Necesita, una sola vez y fuera del repo, una carpeta con `npm i subset-font@2 opentype.js@1` y los TTF:
//   node tools/fuentes-pdf.mjs <carpeta-con-node_modules> <carpeta-con-los-ttf>
// TTF esperados (de github.com/google/fonts/tree/main/ofl): Cinzel.ttf (Cinzel[wght]), EBG.ttf (EBGaramond[wght]),
// EBGi.ttf (EBGaramond-Italic[wght]), GreatVibes.ttf, PlexMono.ttf y PlexMonoM.ttf (IBMPlexMono-Regular y -Medium).
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createRequire } from "node:module";
import { join } from "node:path";

const [mods, src] = process.argv.slice(2);
if (!mods || !src) throw new Error("Uso: node tools/fuentes-pdf.mjs <carpeta-con-node_modules> <carpeta-con-los-ttf>");
const req = createRequire(join(mods, "x.js"));
const subsetFont = req("subset-font"), opentype = req("opentype.js");

// WinAnsi: code → Unicode (the encoding the PDF declares)
const WIN = { 0x80: 0x20ac, 0x82: 0x201a, 0x84: 0x201e, 0x85: 0x2026, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x99: 0x2122 };
const uni = c => (c >= 0x80 && c < 0xa0) ? WIN[c] : c;
const codes = []; for (let c = 32; c <= 255; c++) if (uni(c)) codes.push(c);
const text = String.fromCodePoint(...codes.map(uni));

const SPECS = [
  { key: "cinzel", file: "Cinzel.ttf", name: "VVR-Cinzel", axes: { wght: 500 } },
  { key: "cinzelB", file: "Cinzel.ttf", name: "VVR-CinzelBold", axes: { wght: 700 } },
  { key: "garamond", file: "EBG.ttf", name: "VVR-Garamond", axes: { wght: 420 } },
  { key: "garamondI", file: "EBGi.ttf", name: "VVR-GaramondItalic", axes: { wght: 420 }, italic: true },
  { key: "garamondB", file: "EBG.ttf", name: "VVR-GaramondSemibold", axes: { wght: 600 } },
  { key: "script", file: "GreatVibes.ttf", name: "VVR-GreatVibes", script: true },
  { key: "mono", file: "PlexMono.ttf", name: "VVR-PlexMono", fixed: true },
  { key: "monoM", file: "PlexMonoM.ttf", name: "VVR-PlexMonoMedium", fixed: true },
];
const out = {};
for (const s of SPECS) {
  const ttf = await subsetFont(readFileSync(join(src, s.file)), text, { targetFormat: "truetype", noLayoutClosure: true, noHinting: true, ...(s.axes ? { variationAxes: s.axes } : {}) });
  const f = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
  const k = 1000 / f.unitsPerEm, os2 = f.tables.os2, head = f.tables.head;
  const widths = [];
  for (let c = 32; c <= 255; c++) { const u = uni(c); const g = u ? f.charToGlyph(String.fromCodePoint(u)) : null; widths.push(g && g.index ? Math.round(g.advanceWidth * k) : 0); }
  out[s.key] = {
    name: s.name, flags: (s.script ? 8 : s.fixed ? 1 : 2) | 32 | (s.italic ? 64 : 0),   // serif or script, nonsymbolic, italic
    bbox: [head.xMin, head.yMin, head.xMax, head.yMax].map(v => Math.round(v * k)),
    asc: Math.round(f.ascender * k), desc: Math.round(f.descender * k), cap: Math.round((os2.sCapHeight || f.ascender * 0.7) * k),
    italic: s.italic ? -12 : 0, widths, len: ttf.length, ttf: deflateSync(ttf, { level: 9 }).toString("base64"),
  };
  console.log(`${s.key}: ${ttf.length} bytes, ${out[s.key].ttf.length} en base64`);
}
writeFileSync(new URL("../_cursos/fuentes-pdf.js", import.meta.url), `// Generado con tools/fuentes-pdf.mjs (no editar a mano). Cinzel, EB Garamond y Great Vibes: Google Fonts, licencia SIL OFL 1.1.
export const FONTS = ${JSON.stringify(out)};
`);
