// Constancias de la plataforma de cursos: un PDF horizontal (carta) armado a mano, sin librerías ni fuentes
// incrustadas (Helvetica y Courier del propio PDF, WinAnsi), para que el Worker lo haga en milisegundos.
// El logo viene ya comprimido de _cursos/logo-pdf.js y el QR de qrcode-generator.
import qrcode from "./vendor/qrcode.js";
import { LOGO } from "./logo-pdf.js";

const W = 792, H = 612;
const WIN = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99 };
// a PDF literal string in WinAnsi: Latin-1 as is, a few typographic signs mapped, anything else "?"
function pstr(s) {
  let o = "(";
  for (const ch of String(s)) {
    let c = ch.codePointAt(0);
    if (WIN[ch]) c = WIN[ch]; else if (c > 255 || (c >= 0x80 && c < 0xa0)) c = 63;
    if (ch === "(" || ch === ")" || ch === "\\") o += "\\" + ch;
    else if (c < 32 || c > 126) o += "\\" + c.toString(8).padStart(3, "0");
    else o += ch;
  }
  return o + ")";
}
// rough Helvetica widths (only used to shrink and wrap; the layout is left-aligned so it never needs to be exact)
function textW(s, size, bold) {
  let w = 0;
  for (const ch of String(s)) w += /[ijlI.,:;'!|ft\s]/.test(ch) ? 0.28 : /[mwMW]/.test(ch) ? 0.86 : /[A-ZÁÉÍÓÚÑ]/.test(ch) ? 0.70 : 0.56;
  return w * size * (bold ? 1.07 : 1);
}
function wrap(s, size, bold, max) {
  const lines = []; let cur = "";
  for (const word of String(s).split(/\s+/)) {
    const t = cur ? cur + " " + word : word;
    if (cur && textW(t, size, bold) > max) { lines.push(cur); cur = word; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
const rgb = hex => [1, 3, 5].map(i => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(" ");
const MODALITY = { recorded: "En línea (grabado)", live: "En vivo", mixed: "Mixto (en línea y en vivo)" };

// c = { folio, student, course, hours, modality, period, instructor, kind, courseKey, objectives, verifyUrl, ace, signer, signerTitle, revoked }
export function certificatePdf(c) {
  const ops = [];
  const text = (x, y, size, font, s, color = "#1b0a36", tc = 0) => ops.push(`BT /${font} ${size} Tf ${tc} Tc ${rgb(color)} rg ${x.toFixed(1)} ${y.toFixed(1)} Td ${pstr(s)} Tj ET`);
  const rect = (x, y, w, h, color) => ops.push(`${rgb(color)} rg ${x} ${y} ${w} ${h} re f`);
  const line = (x1, y1, x2, y2, color, w) => ops.push(`${rgb(color)} RG ${w} w ${x1} ${y1} m ${x2} ${y2} l S`);

  rect(0, 0, W, H, "#fbf9ff");
  ops.push(`${rgb("#6b279b")} RG 1.4 w 22 22 ${W - 44} ${H - 44} re S`);
  ops.push(`${rgb("#c9952e")} RG 0.6 w 29 29 ${W - 58} ${H - 58} re S`);
  rect(29, H - 37, W - 58, 8, "#6b279b");
  // logo (its original purple) and the folio
  const lh = 34, lw = lh * LOGO.w / LOGO.h;
  ops.push(`q ${lw.toFixed(1)} 0 0 ${lh} 60 ${H - 60 - lh} cm /Logo Do Q`);
  const fol = "FOLIO " + c.folio;
  text(W - 60 - fol.length * 0.6 * 10, H - 60 - 22, 10, "F3", fol, "#4a3a66");

  let y = 440;
  text(60, y, 12, "F2", c.kind === "dc3" ? "CONSTANCIA DE CAPACITACIÓN" : "CONSTANCIA DE ACREDITACIÓN", "#a8741a", 2.2);
  y -= 34; text(60, y, 13, "F1", "Se otorga a", "#4a3a66");
  let ns = 34; while (ns > 18 && textW(c.student, ns, true) > W - 120) ns -= 1;
  y -= ns + 8; text(60, y, ns, "F2", c.student, "#1b0a36");
  y -= 30; text(60, y, 13, "F1", "por haber acreditado el curso", "#4a3a66");
  const tl = wrap(c.course, 20, true, W - 120).slice(0, 2);
  for (const l of tl) { y -= 26; text(60, y, 20, "F2", l, "#6b279b"); }
  const det = [c.hours ? `Duración: ${c.hours} ${Number(c.hours) === 1 ? "hora" : "horas"}` : "", `Modalidad: ${MODALITY[c.modality] || c.modality || ""}`, c.period ? `Periodo: ${c.period}` : ""].filter(Boolean).join("   ·   ");
  y -= 26; text(60, y, 11, "F1", det, "#4a3a66");
  if (c.kind === "dc3") {   // DC-3 fields printed on the Vórtice VR certificate (the official format is phase 3)
    const rows = [`Agente capacitador: Vórtice VR${c.ace ? "   ·   Registro STPS: " + c.ace : ""}${c.courseKey ? "   ·   Clave del curso: " + c.courseKey : ""}`];
    if (c.objectives) rows.push(...wrap("Objetivo: " + c.objectives, 9, false, W - 120).slice(0, 2));
    for (const r of rows) { y -= 15; text(60, y, 9, "F1", r, "#4a3a66"); }
  }

  // signatures
  const sig = (x, name, role) => { line(x, 128, x + 210, 128, "#4a3a66", 0.6); text(x, 112, 11, "F2", name || "", "#1b0a36"); text(x, 98, 9, "F1", role, "#4a3a66"); };
  sig(60, c.instructor, "Instructor del curso");
  sig(300, c.signer || "Vórtice VR", c.signerTitle || "Por Vórtice VR");

  // QR to the public verification page
  const qr = qrcode(0, "M"); qr.addData(c.verifyUrl); qr.make();
  const n = qr.getModuleCount(), size = 96, cell = size / n, qx = W - 60 - size, qy = 64;
  rect(qx - 6, qy - 6, size + 12, size + 12, "#ffffff");
  const q = [];
  for (let r = 0; r < n; r++) for (let col = 0; col < n; ) {
    if (!qr.isDark(r, col)) { col++; continue; }
    let e = col; while (e < n && qr.isDark(r, e)) e++;
    q.push(`${(qx + col * cell).toFixed(2)} ${(qy + (n - 1 - r) * cell).toFixed(2)} ${((e - col) * cell + 0.05).toFixed(2)} ${(cell + 0.05).toFixed(2)} re`);
    col = e;
  }
  ops.push(`${rgb("#1b0a36")} rg ${q.join(" ")} f`);
  text(60, 62, 8, "F3", "Verifica su validez en " + c.verifyUrl.replace(/^https?:\/\//, ""), "#4a3a66");
  text(60, 50, 8, "F3", "Avalada por Vórtice VR" + (c.ace ? " · Agente Capacitador Externo, registro " + c.ace : ""), "#4a3a66");
  if (c.revoked) {   // a revoked certificate still opens, crossed out
    ops.push(`q 0.85 0.1 0.1 RG 4 w 0.9 0.2 0.2 rg 60 300 m 732 300 l S Q`);
    text(250, 270, 28, "F2", "CONSTANCIA REVOCADA", "#c62828", 1);
  }

  // assemble: header, objects, xref (byte offsets), trailer
  const content = ops.join("\n");
  const rgbBytes = b64bytes(LOGO.rgb), alphaBytes = b64bytes(LOGO.alpha);
  const parts = [], offsets = [];
  let len = 0;
  const push = p => { const b = typeof p === "string" ? asciiBytes(p) : p; parts.push(b); len += b.length; };
  const obj = (n, body, stream) => {
    offsets[n] = len;
    if (stream) { push(`${n} 0 obj\n${body.replace(/>>$/, ` /Length ${stream.length} >>`)}\nstream\n`); push(stream); push("\nendstream\nendobj\n"); }
    else push(`${n} 0 obj\n${body}\nendobj\n`);
  };
  push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> /XObject << /Logo 8 0 R >> >> /Contents 4 0 R >>`);
  obj(4, "<< >>", asciiBytes(content));
  const font = name => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
  obj(5, font("Helvetica")); obj(6, font("Helvetica-Bold")); obj(7, font("Courier"));
  obj(8, `<< /Type /XObject /Subtype /Image /Width ${LOGO.w} /Height ${LOGO.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 9 0 R >>`, rgbBytes);
  obj(9, `<< /Type /XObject /Subtype /Image /Width ${LOGO.w} /Height ${LOGO.h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode >>`, alphaBytes);
  const xref = len;
  push(`xref\n0 10\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}`);
  push(`trailer\n<< /Size 10 /Root 1 0 R /Info << /Title ${pstr("Constancia " + c.folio)} /Producer (Vortice VR) >> >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len); let p = 0;
  for (const b of parts) { out.set(b, p); p += b.length; }
  return out;
}
const asciiBytes = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
const b64bytes = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
