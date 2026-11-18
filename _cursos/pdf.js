// Constancias de la plataforma de cursos y de los talleres: un PDF horizontal (carta) armado a mano, sin librerías
// ni fuentes incrustadas (Helvetica y Courier del propio PDF, WinAnsi), para que el Worker lo haga en milisegundos.
// Diseño (17 de noviembre de 2026, César: "muy feo, Vórtice VR es muy innovador"): franja nocturna a la izquierda
// con un vórtice de anillos, destellos, el logo en blanco, el folio y el QR de verificación; a la derecha el nombre,
// el curso o taller, los datos en columnas, la firma de César (Mtro. César Adrián García Martínez) y un sello dorado.
// El logo y la firma vienen ya comprimidos (_cursos/logo-pdf.js y _cursos/firma-pdf.js) y el QR de qrcode-generator.
import qrcode from "./vendor/qrcode.js";
import { LOGO } from "./logo-pdf.js";
import { FIRMA } from "./firma-pdf.js";

const W = 792, H = 612;
export const SIGNER = "Mtro. César Adrián García Martínez";   // signs for Vórtice VR (his signature is FIRMA)
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
// rough Helvetica widths (to shrink, wrap and center; never needs to be exact)
function textW(s, size, bold, tc = 0) {
  let w = 0, n = 0;
  for (const ch of String(s)) { n++; w += /[ijlI.,:;'!|ft\s]/.test(ch) ? 0.28 : /[mwMW]/.test(ch) ? 0.86 : /[A-ZÁÉÍÓÚÑ]/.test(ch) ? 0.70 : 0.56; }
  return w * size * (bold ? 1.07 : 1) + n * tc;
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
const mix = (a, b, t) => "#" + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
const MODALITY = { recorded: "En línea (grabado)", live: "En vivo", mixed: "Mixto (en línea y en vivo)", presencial: "Presencial", en_linea: "En línea (en vivo)" };
const C = { night: "#12062a", ink: "#1b0a36", purple: "#6b279b", violet: "#8b3fd6", lav: "#d2b8ff", gold: "#c9952e", goldL: "#ffbe55", mute: "#5b4d78", paper: "#fdfcff", line: "#e6dcf7" };

// c = { folio, student, course, hours, modality, period, place, instructor, kind, courseKey, objectives, verifyUrl, ace, signer, signerTitle, revoked }
export function certificatePdf(c) {
  const ops = [];
  const text = (x, y, size, font, s, color = C.ink, tc = 0) => ops.push(`BT /${font} ${size} Tf ${tc} Tc ${rgb(color)} rg ${x.toFixed(1)} ${y.toFixed(1)} Td ${pstr(s)} Tj ET`);
  const center = (cx, y, size, font, s, color, tc = 0) => text(cx - textW(s, size, font === "F2", tc) / 2, y, size, font, s, color, tc);
  const rect = (x, y, w, h, color) => ops.push(`${rgb(color)} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
  const line = (x1, y1, x2, y2, color, w) => ops.push(`${rgb(color)} RG ${w} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
  const K = 0.5523;
  const ellipse = (rx, ry) => `${rx} 0 m ${rx} ${(ry * K).toFixed(2)} ${(rx * K).toFixed(2)} ${ry} 0 ${ry} c ${(-rx * K).toFixed(2)} ${ry} ${-rx} ${(ry * K).toFixed(2)} ${-rx} 0 c ${-rx} ${(-ry * K).toFixed(2)} ${(-rx * K).toFixed(2)} ${-ry} 0 ${-ry} c ${(rx * K).toFixed(2)} ${-ry} ${rx} ${(-ry * K).toFixed(2)} ${rx} 0 c h`;
  const circle = (cx, cy, r, color, fill = true, w = 1) => ops.push(`q 1 0 0 1 ${cx} ${cy} cm ${fill ? `${rgb(color)} rg ${ellipse(r, r)} f` : `${rgb(color)} RG ${w} w ${ellipse(r, r)} S`} Q`);
  const spark = (x, y, r, color) => ops.push(`${rgb(color)} rg ${x} ${y + r} m ${x + r * 0.22} ${y + r * 0.22} l ${x + r} ${y} l ${x + r * 0.22} ${y - r * 0.22} l ${x} ${y - r} l ${x - r * 0.22} ${y - r * 0.22} l ${x - r} ${y} l ${x - r * 0.22} ${y + r * 0.22} l h f`);
  const taller = c.kind === "taller";   // a workshop (_cursos/talleres.js): participation, not an exam

  // ---------- paper and the night band ----------
  rect(0, 0, W, H, C.paper);
  const BW = 238;
  rect(0, 0, BW, H, C.night);
  // the vortex: rotated rings that open up from the center of the band
  const vx = BW * 0.52, vy = 340;
  ops.push(`q 0 0 ${BW} ${H} re W n`);   // clipped to the band
  for (let i = 0; i < 14; i++) {
    const rx = 18 + i * 13, ry = rx * 0.42, col = mix(i < 7 ? C.violet : "#3a1670", C.night, i < 7 ? i / 9 : 0.25 + (i - 7) / 10);
    ops.push(`q ${Math.cos(i * 0.32).toFixed(4)} ${Math.sin(i * 0.32).toFixed(4)} ${(-Math.sin(i * 0.32)).toFixed(4)} ${Math.cos(i * 0.32).toFixed(4)} ${vx} ${vy} cm ${rgb(col)} RG ${(1.6 - i * 0.08).toFixed(2)} w ${ellipse(rx, ry)} S Q`);
  }
  ops.push("Q");
  circle(vx, vy, 5, C.lav);
  circle(vx, vy, 10, C.violet, false, 0.8);
  // gold sparkles around it
  [[44, 470, 7], [196, 420, 5], [62, 262, 4], [186, 250, 8], [120, 486, 3.5], [30, 352, 3], [214, 330, 3.5], [150, 214, 3]].forEach(([x, y, r], i) => spark(x, y, r, i % 3 === 2 ? C.lav : C.goldL));
  // the logo in white (its alpha over a white image), the folio
  const lh = 26, lw = lh * LOGO.w / LOGO.h;
  ops.push(`q ${lw.toFixed(1)} 0 0 ${lh} 30 ${H - 30 - lh} cm /LogoW Do Q`);
  line(30, H - 74, BW - 30, H - 74, "#3a1d63", 0.6);
  text(30, H - 92, 7, "F3", "FOLIO", C.lav, 1.6);
  text(30, H - 108, 11, "F3", c.folio, "#ffffff");
  // QR to the public verification page, on a white card
  const qr = qrcode(0, "M"); qr.addData(c.verifyUrl); qr.make();
  const n = qr.getModuleCount(), size = 104, cell = size / n, qx = 30, qy = 78;
  rect(qx - 8, qy - 8, size + 16, size + 16, "#ffffff");
  const q = [];
  for (let r = 0; r < n; r++) for (let col = 0; col < n; ) {
    if (!qr.isDark(r, col)) { col++; continue; }
    let e = col; while (e < n && qr.isDark(r, e)) e++;
    q.push(`${(qx + col * cell).toFixed(2)} ${(qy + (n - 1 - r) * cell).toFixed(2)} ${((e - col) * cell + 0.05).toFixed(2)} ${(cell + 0.05).toFixed(2)} re`);
    col = e;
  }
  ops.push(`${rgb(C.ink)} rg ${q.join(" ")} f`);
  text(30, qy + size + 22, 7, "F3", "VERIFICA SU VALIDEZ", C.lav, 1.6);
  const vu = c.verifyUrl.replace(/^https?:\/\//, ""), cut = vu.lastIndexOf("/") + 1;
  text(30, 52, 6.5, "F3", vu.slice(0, cut), "#b9a6dc");
  text(30, 42, 6.5, "F3", vu.slice(cut), "#b9a6dc");

  // ---------- the right side ----------
  const X = BW + 46, MAXW = W - X - 44;
  ops.push(`${rgb(C.line)} RG 0.8 w ${BW + 18} 18 ${W - BW - 36} ${H - 36} re S`);
  // gold corners
  for (const [x, y, dx, dy] of [[BW + 18, H - 18, 1, -1], [W - 18, H - 18, -1, -1], [BW + 18, 18, 1, 1], [W - 18, 18, -1, 1]])
    ops.push(`${rgb(C.gold)} RG 1.6 w ${x} ${y + dy * 26} m ${x} ${y} l ${x + dx * 26} ${y} l S`);

  let y = H - 78;
  text(X, y, 10.5, "F2", c.kind === "dc3" ? "CONSTANCIA DE CAPACITACIÓN" : taller ? "CONSTANCIA DE PARTICIPACIÓN" : "CONSTANCIA DE ACREDITACIÓN", "#a8741a", 3);
  y -= 34; text(X, y, 12, "F1", "Vórtice VR otorga la presente a", C.mute);
  let ns = 38; while (ns > 18 && textW(c.student, ns, true) > MAXW) ns -= 1;
  y -= ns + 8; text(X, y, ns, "F2", c.student, C.ink);
  y -= 16;
  rect(X, y, 64, 2.4, C.gold); rect(X + 68, y, 14, 2.4, C.violet);
  y -= 26; text(X, y, 12, "F1", taller ? "por su participación en el taller" : "por haber acreditado el curso", C.mute);
  const tl = wrap(c.course, 20, true, MAXW).slice(0, 2);
  for (const l of tl) { y -= 25; text(X, y, 20, "F2", l, C.purple); }

  // the details, as label/value columns
  const hrs = c.hours ? `${String(c.hours).replace(/\.0$/, "")} ${Number(c.hours) === 1 ? "hora" : "horas"}` : "";
  const cols = [["DURACIÓN", hrs], ["MODALIDAD", MODALITY[c.modality] || c.modality || ""], [taller ? "FECHA" : "PERIODO", c.period || ""]].filter(x => x[1]);
  y -= 38;
  let cx = X;
  cols.forEach(([k, v], i) => {
    if (i) { line(cx - 14, y - 6, cx - 14, y + 16, C.line, 1); }
    text(cx, y + 8, 6.5, "F3", k, C.mute, 1.4);
    text(cx, y - 6, 11, "F2", v, C.ink);
    cx += Math.max(textW(v, 11, true), textW(k, 6.5, false, 1.4)) + 30;
  });
  if (c.place) {
    y -= 34;
    text(X, y + 8, 6.5, "F3", "LUGAR", C.mute, 1.4);
    text(X, y - 6, 11, "F2", wrap(c.place, 11, true, MAXW)[0], C.ink);
  }
  if (c.kind === "dc3") {   // DC-3 fields printed on the Vórtice VR certificate (the official format is phase 3)
    const rows = [`Agente capacitador: Vórtice VR${c.ace ? "   ·   Registro STPS: " + c.ace : ""}${c.courseKey ? "   ·   Clave del curso: " + c.courseKey : ""}`];
    if (c.objectives) rows.push(...wrap("Objetivo: " + c.objectives, 8.5, false, MAXW).slice(0, 2));
    y -= 10;
    for (const r of rows) { y -= 13; text(X, y, 8.5, "F1", r, C.mute); }
  }

  // ---------- signatures and the seal ----------
  const SY = 104, SWD = taller ? 200 : 164;   // two signatures (courses) must leave room for the seal
  const signer = c.signer || SIGNER, withFirma = !c.signer || /c[ée]sar/i.test(c.signer);
  const sig = (x, name, role, firma) => {
    if (firma) { const fh = 96, fw = fh * FIRMA.w / FIRMA.h; ops.push(`q ${fw.toFixed(1)} 0 0 ${fh} ${(x + 30).toFixed(1)} ${SY - 6} cm /Firma Do Q`); }
    line(x, SY, x + SWD, SY, C.mute, 0.6);
    let s = 10.5; while (s > 7.5 && textW(name || "", s, true) > SWD) s -= 0.5;
    text(x, SY - 15, s, "F2", name || "", C.ink);
    text(x, SY - 28, 8.5, "F1", role, C.mute);
  };
  if (taller) sig(X, signer, c.signerTitle || "Vórtice VR", withFirma);   // Vórtice VR gives the workshop: one signature
  else { sig(X, c.instructor, "Instructor del curso", false); sig(X + SWD + 22, signer, c.signerTitle || "Por Vórtice VR", withFirma); }
  // the seal: a gold starburst with a ring of text-free ticks
  const sx = W - 92, sy = 100, pts = [];
  for (let i = 0; i < 48; i++) { const a = i * Math.PI / 24, r = i % 2 ? 44 : 48; pts.push(`${(sx + Math.cos(a) * r).toFixed(2)} ${(sy + Math.sin(a) * r).toFixed(2)}`); }
  ops.push(`${rgb("#d9a441")} rg ${pts[0]} m ${pts.slice(1).map(p => p + " l").join(" ")} h f`);
  circle(sx, sy, 40, "#f3d488");
  circle(sx, sy, 36, "#a8741a", false, 0.8);
  circle(sx, sy, 33, "#fff6dc");
  spark(sx, sy + 15, 6, "#c9952e");
  center(sx, sy - 3, 7.5, "F2", "VÓRTICE VR", "#7a5410", 0.6);
  center(sx, sy - 14, 6, "F3", "AVAL " + String(c.folio).slice(4, 8), "#7a5410", 0.8);
  text(X, 34, 6.5, "F3", "Emitida por Vórtice VR · vorticevr.mx" + (c.ace ? " · Agente Capacitador Externo, registro " + c.ace : ""), C.mute, 0.4);

  if (c.revoked) {   // a revoked certificate still opens, crossed out
    ops.push(`q 0.9 0.2 0.2 RG 4 w ${X - 10} 300 m ${W - 40} 300 l S Q`);
    text(X + 80, 268, 28, "F2", "CONSTANCIA REVOCADA", "#c62828", 1);
  }

  // ---------- assemble: header, objects, xref (byte offsets), trailer ----------
  const content = ops.join("\n");
  const parts = [], offsets = [];
  let len = 0;
  const push = p => { const b = typeof p === "string" ? asciiBytes(p) : p; parts.push(b); len += b.length; };
  const obj = (n, body, stream) => {
    offsets[n] = len;
    if (stream) { push(`${n} 0 obj\n${body.replace(/>>$/, ` /Length ${stream.length} >>`)}\nstream\n`); push(stream); push("\nendstream\nendobj\n"); }
    else push(`${n} 0 obj\n${body}\nendobj\n`);
  };
  const img = (w, h, cs, filter, smask) => `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /${cs} /BitsPerComponent 8 /Filter /${filter}${smask ? ` /SMask ${smask} 0 R` : ""} >>`;
  push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> /XObject << /LogoW 8 0 R /Firma 10 0 R >> >> /Contents 4 0 R >>`);
  obj(4, "<< >>", asciiBytes(content));
  const font = name => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
  obj(5, font("Helvetica")); obj(6, font("Helvetica-Bold")); obj(7, font("Courier"));
  obj(8, img(LOGO.w, LOGO.h, "DeviceGray", "RunLengthDecode", 9), whiteRun(LOGO.w * LOGO.h));   // the logo in white: a white image with the logo's alpha
  obj(9, img(LOGO.w, LOGO.h, "DeviceGray", "FlateDecode"), b64bytes(LOGO.alpha));
  obj(10, img(FIRMA.w, FIRMA.h, "DeviceRGB", "FlateDecode", 11), b64bytes(FIRMA.rgb));
  obj(11, img(FIRMA.w, FIRMA.h, "DeviceGray", "FlateDecode"), b64bytes(FIRMA.alpha));
  const xref = len;
  push(`xref\n0 12\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}`);
  push(`trailer\n<< /Size 12 /Root 1 0 R /Info << /Title ${pstr("Constancia " + c.folio)} /Producer (Vortice VR) >> >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len); let p = 0;
  for (const b of parts) { out.set(b, p); p += b.length; }
  return out;
}
// n bytes of 255 in RunLengthDecode (runs of 128, then EOD)
function whiteRun(n) {
  const out = [];
  while (n > 0) { const k = Math.min(128, n); out.push(k === 1 ? 0 : 257 - k, 255); n -= k; }   // a run of 1 is a literal
  out.push(128);
  return Uint8Array.from(out);
}
const asciiBytes = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
const b64bytes = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
