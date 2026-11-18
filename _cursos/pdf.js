// Constancias de la plataforma de cursos y de los talleres: un PDF horizontal (carta) armado a mano, sin librerías.
// Diseño de diploma (17 de noviembre de 2026, César: "que se vea algo honorable y más complejo", "las letras se ven
// básicas"): papel marfil con una roseta guilloché de fondo, marco de banda morada con una trenza guilloché dorada,
// rosetas en las esquinas, filetes dorados, "CONSTANCIA" en Cinzel, el texto en EB Garamond, el nombre en caligrafía
// (Great Vibes), la firma de César, el QR de verificación con el folio y un sello dorado con texto alrededor y listones.
// Las letras van incrustadas (recortadas a WinAnsi, _cursos/fuentes-pdf.js, tools/fuentes-pdf.mjs; licencia OFL);
// el logo y la firma vienen comprimidos (_cursos/logo-pdf.js, _cursos/firma-pdf.js) y el QR de qrcode-generator.
import qrcode from "./vendor/qrcode.js";
import { LOGO } from "./logo-pdf.js";
import { FIRMA } from "./firma-pdf.js";
import { FONTS } from "./fuentes-pdf.js";

const W = 792, H = 612, CX = W / 2;
export const SIGNER = "Mtro. César Adrián García Martínez";   // signs for Vórtice VR (his signature is FIRMA)
const WIN = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99 };
const code = ch => { const c = ch.codePointAt(0); return WIN[ch] || (c > 255 || (c >= 0x80 && c < 0xa0) ? 63 : c); };
// a PDF literal string in WinAnsi
function pstr(s) {
  let o = "(";
  for (const ch of String(s)) {
    const c = code(ch);
    if (ch === "(" || ch === ")" || ch === "\\") o += "\\" + ch;
    else if (c < 32 || c > 126) o += "\\" + c.toString(8).padStart(3, "0");
    else o += ch;
  }
  return o + ")";
}
// the fonts used: resource name → FONTS key
const F = { T: "cinzelB", t: "cinzel", G: "garamond", I: "garamondI", B: "garamondB", S: "script" };
// exact widths from the embedded fonts
function tw(s, size, f, tc = 0) {
  const wd = FONTS[F[f]].widths; let w = 0, n = 0;
  for (const ch of String(s)) { const c = code(ch); w += c >= 32 ? wd[c - 32] || 500 : 500; n++; }
  return w * size / 1000 + tc * Math.max(0, n - 1);
}
function wrap(s, size, f, max) {
  const lines = []; let cur = "";
  for (const word of String(s).split(/\s+/)) {
    const t = cur ? cur + " " + word : word;
    if (cur && tw(t, size, f) > max) { lines.push(cur); cur = word; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
const rgb = hex => [1, 3, 5].map(i => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(" ");
const MODALITY = { recorded: "en línea", live: "en vivo", mixed: "mixta (en línea y en vivo)", presencial: "presencial", en_linea: "en línea, en vivo" };
const C = { night: "#1d0b38", ink: "#1b0a36", purple: "#5b1f8a", violet: "#8b3fd6", gold: "#b8862c", goldL: "#e2bd62", goldD: "#7a5410", text: "#3d2f57", paper: "#fbf8f1", faint: "#ece3f3" };
const fechaMx = t => new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });

// c = { folio, issued, student, course, hours, modality, period, place, instructor, kind, courseKey, objectives, verifyUrl, ace, signer, signerTitle, revoked }
export function certificatePdf(c) {
  const ops = [], P = v => v.toFixed(2);
  const text = (x, y, size, f, s, color = C.ink, tc = 0) => ops.push(`BT /${f} ${size} Tf ${tc} Tc ${rgb(color)} rg ${P(x)} ${P(y)} Td ${pstr(s)} Tj ET`);
  const center = (y, size, f, s, color, tc = 0, cx = CX) => text(cx - tw(s, size, f, tc) / 2, y, size, f, s, color, tc);
  const rect = (x, y, w, h, color) => ops.push(`${rgb(color)} rg ${P(x)} ${P(y)} ${P(w)} ${P(h)} re f`);
  const frame = (i, color, w) => ops.push(`${rgb(color)} RG ${w} w ${P(i)} ${P(i)} ${P(W - 2 * i)} ${P(H - 2 * i)} re S`);
  const line = (x1, y1, x2, y2, color, w) => ops.push(`${rgb(color)} RG ${w} w ${P(x1)} ${P(y1)} m ${P(x2)} ${P(y2)} l S`);
  const poly = (pts, close) => pts.map((p, i) => `${p[0].toFixed(1)} ${p[1].toFixed(1)} ${i ? "l" : "m"}`).join(" ") + (close ? " h" : "");
  const stroke = (pts, color, w, close) => ops.push(`${rgb(color)} RG ${w} w 1 j ${poly(pts, close)} S`);
  const fill = (pts, color) => ops.push(`${rgb(color)} rg ${poly(pts, true)} f`);
  const circle = (cx, cy, r, color, w) => { const pts = []; for (let i = 0; i <= 72; i++) { const a = i * Math.PI / 36; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } w ? stroke(pts, color, w, true) : fill(pts, color); };
  // a guilloché rosette: overlapping polar waves
  const rosette = (cx, cy, r0, amp, k, copies, color, w, steps = 360) => {
    for (let j = 0; j < copies; j++) {
      const pts = []; for (let i = 0; i <= steps; i++) { const a = i * 2 * Math.PI / steps, r = r0 + amp * Math.sin(k * a + j * 2 * Math.PI / copies); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      stroke(pts, color, w, true);
    }
  };
  const diamond = (x, y, r, color) => fill([[x, y + r], [x + r * 0.6, y], [x, y - r], [x - r * 0.6, y]], color);
  const taller = c.kind === "taller";

  // ---------- paper, background rosette ----------
  rect(0, 0, W, H, C.paper);
  rosette(CX, 316, 168, 30, 14, 10, C.faint, 0.35, 360);
  rosette(CX, 316, 96, 14, 11, 6, "#f1eaf6", 0.3, 260);

  // ---------- the frame: purple band with a gold guilloché braid ----------
  const o = 14, b = 20, mid = o + b / 2;
  ops.push(`${rgb(C.night)} rg ${o} ${o} ${W - 2 * o} ${H - 2 * o} re ${o + b} ${o + b} ${W - 2 * (o + b)} ${H - 2 * (o + b)} re f*`);
  const per = 2 * (W - 2 * mid) + 2 * (H - 2 * mid);
  const along = s => {   // point on the band's center line and its inward normal
    const w = W - 2 * mid, h = H - 2 * mid;
    if (s < w) return [mid + s, mid, 0, 1];
    if ((s -= w) < h) return [W - mid, mid + s, -1, 0];
    if ((s -= h) < w) return [W - mid - s, H - mid, 0, -1];
    s -= w; return [mid, H - mid - s, 1, 0];
  };
  const waves = 4, lam = per / Math.round(per / 16);
  for (let j = 0; j < waves; j++) {
    const pts = [];
    for (let s = 0; s <= per; s += 2.2) { const [x, y, nx, ny] = along(Math.min(s, per - 0.01)), d = 6.4 * Math.sin(2 * Math.PI * s / lam + j * Math.PI / waves * 2); pts.push([x + nx * d, y + ny * d]); }
    stroke(pts, j % 2 ? "#9b74d3" : C.goldL, j % 2 ? 0.35 : 0.5, true);
  }
  frame(o + 0.8, C.goldL, 0.6); frame(o + b - 0.8, C.goldL, 0.6);
  frame(o + b + 5, C.gold, 1.1); frame(o + b + 8.5, C.gold, 0.35);
  // corner rosettes
  for (const [x, y] of [[mid, mid], [W - mid, mid], [mid, H - mid], [W - mid, H - mid]]) {
    circle(x, y, 19, C.night); circle(x, y, 19, C.goldL, 0.8);
    rosette(x, y, 12, 4.5, 9, 4, C.goldL, 0.35, 220);
    circle(x, y, 4, C.goldL);
  }
  // small ornaments in the middle of the inner rule
  for (const [x, y] of [[CX, o + b + 5], [CX, H - o - b - 5], [o + b + 5, H / 2], [W - o - b - 5, H / 2]]) { rect(x - 7, y - 7, 14, 14, C.paper); diamond(x, y, 5.5, C.gold); }

  // ---------- heading ----------
  const lh = 30, lw = lh * LOGO.w / LOGO.h;
  ops.push(`q ${P(lw)} 0 0 ${lh} ${P(CX - lw / 2)} 516 cm /Logo Do Q`);
  center(470, 40, "T", "CONSTANCIA", C.purple, 9);
  const sub = c.kind === "dc3" ? "DE CAPACITACIÓN" : taller ? "DE PARTICIPACIÓN" : "DE ACREDITACIÓN";
  const sw = tw(sub, 12.5, "t", 5.5);
  center(446, 12.5, "t", sub, C.goldD, 5.5);
  for (const sgn of [-1, 1]) { const x0 = CX + sgn * (sw / 2 + 14), x1 = x0 + sgn * 70; line(x0, 450, x1, 450, C.gold, 0.7); diamond(x1 + sgn * 4, 450, 3, C.gold); diamond(x0, 450, 2, C.gold); }
  center(414, 14.5, "I", "Vórtice VR otorga la presente a", C.text);

  // ---------- the name, in calligraphy ----------
  // the script's own space is too narrow: extra word spacing (Tw), counted in the width
  const nsp = (String(c.student).match(/ /g) || []).length, nw = s => tw(c.student, s, "S") + nsp * s * 0.16;
  let ns = 50; while (ns > 24 && nw(ns) > 600) ns -= 1;
  ops.push(`BT /S ${ns} Tf ${P(ns * 0.16)} Tw ${rgb(C.ink)} rg ${P(CX - nw(ns) / 2)} 366 Td ${pstr(c.student)} Tj 0 Tw ET`);
  line(CX - 200, 350, CX - 12, 350, C.gold, 0.8); line(CX + 12, 350, CX + 200, 350, C.gold, 0.8);
  diamond(CX, 350, 5, C.gold); diamond(CX - 204, 350, 2.2, C.gold); diamond(CX + 204, 350, 2.2, C.gold);

  // ---------- what for ----------
  center(326, 14, "I", taller ? "por su participación en el taller" : "por haber acreditado satisfactoriamente el curso", C.text);
  let y = 326;
  for (const l of wrap(c.course, 19, "T", 590).slice(0, 2)) { y -= 25; center(y, 19, "T", l, C.purple, 0.6); }
  const hrs = c.hours ? `${String(c.hours).replace(/\.0$/, "")} ${Number(c.hours) === 1 ? "hora" : "horas"}` : "";
  const facts = [hrs && `con una duración de ${hrs}`, c.modality && `en modalidad ${MODALITY[c.modality] || c.modality}`,
    c.period && (taller ? `impartido el ${c.period}` : /^del /i.test(c.period) ? c.period.replace(/^D/, "d") : `concluido el ${c.period}`), ].filter(Boolean);
  y -= 6;
  // the facts, and the place on its own line
  const fl = wrap(facts.join(", ") + (c.place ? "," : "."), 12.5, "G", 580).slice(0, 2);
  if (c.place) fl.push(...wrap(`en ${c.place}.`, 12.5, "G", 580).slice(0, 1));
  for (const l of fl.slice(0, 3)) { y -= 17; center(y, 12.5, "G", l, C.text); }
  if (c.kind === "dc3") {   // DC-3 fields printed on the Vórtice VR certificate (the official format is phase 3)
    const rows = [`Agente capacitador: Vórtice VR${c.ace ? " · Registro STPS: " + c.ace : ""}${c.courseKey ? " · Clave del curso: " + c.courseKey : ""}`];
    if (c.objectives) rows.push(...wrap("Objetivo: " + c.objectives, 9.5, "I", 560).slice(0, 1));
    for (const r of rows) { y -= 13; center(y, 9.5, "I", r, C.text); }
  }
  if (c.issued) { y -= 18; center(y, 10.5, "I", `Expedida en México, el ${fechaMx(c.issued)}.`, C.text); }

  // ---------- signatures ----------
  const SY = 104;
  const signer = c.signer || SIGNER, withFirma = !c.signer || /c[ée]sar/i.test(c.signer);
  const sig = (cx, name, role, firma) => {
    if (firma) { const fh = 84, fw = fh * FIRMA.w / FIRMA.h; ops.push(`q ${P(fw)} 0 0 ${fh} ${P(cx - fw / 2 + 6)} ${SY - 8} cm /Firma Do Q`); }
    line(cx - 92, SY, cx + 92, SY, C.text, 0.6);
    let s = 12; while (s > 8.5 && tw(name || "", s, "B") > 196) s -= 0.5;
    center(SY - 15, s, "B", name || "", C.ink, 0, cx);
    center(SY - 28, 10, "I", role, C.text, 0, cx);
  };
  if (taller) sig(CX, signer, c.signerTitle || "Vórtice VR", withFirma);
  else { sig(CX - 108, c.instructor, "Instructor del curso", false); sig(CX + 108, signer, c.signerTitle || "Por Vórtice VR", withFirma); }

  // ---------- QR and folio (left) ----------
  const qr = qrcode(0, "M"); qr.addData(c.verifyUrl); qr.make();
  const n = qr.getModuleCount(), size = 66, cell = size / n, qx = 70, qy = 82;
  rect(qx - 5, qy - 5, size + 10, size + 10, "#ffffff");
  ops.push(`${rgb(C.gold)} RG 0.6 w ${qx - 5} ${qy - 5} ${size + 10} ${size + 10} re S`);
  const q = [];
  for (let r = 0; r < n; r++) for (let col = 0; col < n; ) {
    if (!qr.isDark(r, col)) { col++; continue; }
    let e = col; while (e < n && qr.isDark(r, e)) e++;
    q.push(`${P(qx + col * cell)} ${P(qy + (n - 1 - r) * cell)} ${P((e - col) * cell + 0.05)} ${P(cell + 0.05)} re`);
    col = e;
  }
  ops.push(`${rgb(C.ink)} rg ${q.join(" ")} f`);
  center(qy + size + 22, 6.5, "t", "VERIFIQUE SU", C.goldD, 1.2, qx + size / 2);
  center(qy + size + 13, 6.5, "t", "AUTENTICIDAD", C.goldD, 1.2, qx + size / 2);
  center(66, 6.5, "t", "FOLIO", C.goldD, 1.5, qx + size / 2);
  center(56, 9.5, "B", c.folio, C.ink, 0.3, qx + size / 2);

  // ---------- the seal (right): ribbons, scalloped gold, guilloché, text around ----------
  const sx = W - 112, sy = 112;
  fill([[sx - 8, sy], [sx - 36, sy - 66], [sx - 24, sy - 58], [sx - 15, sy - 72], [sx + 6, sy - 8]], "#4a1d7a");
  fill([[sx + 8, sy], [sx + 36, sy - 66], [sx + 24, sy - 58], [sx + 15, sy - 72], [sx - 6, sy - 8]], C.purple);
  const sc = []; for (let i = 0; i < 64; i++) { const a = i * Math.PI / 32, r = i % 2 ? 44 : 47.5; sc.push([sx + r * Math.cos(a), sy + r * Math.sin(a)]); }
  fill(sc, C.gold);
  circle(sx, sy, 42.5, C.goldL);
  circle(sx, sy, 41.5, C.goldD, 0.5); circle(sx, sy, 31.5, C.goldD, 0.5);
  rosette(sx, sy, 24, 5, 12, 5, "#a77a24", 0.35, 240);
  circle(sx, sy, 17, "#f7e7b8"); circle(sx, sy, 17, C.goldD, 0.5);
  // the ring text, clockwise from the top
  const ring = "VÓRTICE VR · CONSTANCIA AVALADA · ", rr = 34.2, rs = 6.4, rtc = 0.9;
  const rw = tw(ring, rs, "T", rtc) + rtc, scaleTc = (2 * Math.PI * rr - tw(ring, rs, "T", 0)) / ring.length;
  let phi = Math.PI / 2 + (tw("VÓRTICE VR", rs, "T") + 9 * scaleTc) / 2 / rr;   // "VÓRTICE VR" centered on top
  for (const ch of ring) {
    const cw = tw(ch, rs, "T") + scaleTc, mid = phi - cw / 2 / rr, th = mid - Math.PI / 2;
    const x = sx + rr * Math.cos(mid) - Math.cos(th) * tw(ch, rs, "T") / 2, yy = sy + rr * Math.sin(mid) - Math.sin(th) * tw(ch, rs, "T") / 2;
    if (ch !== " ") ops.push(`BT /T ${rs} Tf ${rgb(C.goldD)} rg ${Math.cos(th).toFixed(4)} ${Math.sin(th).toFixed(4)} ${(-Math.sin(th)).toFixed(4)} ${Math.cos(th).toFixed(4)} ${P(x)} ${P(yy)} Tm ${pstr(ch)} Tj ET`);
    phi -= cw / rr;
  }
  void rw;
  center(sy + 1, 8.5, "T", "AVAL", C.goldD, 1.2, sx);
  center(sy - 9, 7, "t", String(new Date(c.issued || Date.now()).getFullYear()), C.goldD, 1, sx);
  diamond(sx, sy + 11, 2.6, C.goldD);

  if (c.revoked) {   // a revoked certificate still opens, crossed out
    ops.push(`q 0.9 0.2 0.2 RG 4 w 90 300 m ${W - 90} 300 l S Q`);
    center(268, 30, "T", "CONSTANCIA REVOCADA", "#c62828", 2);
  }

  // ---------- assemble ----------
  const content = asciiBytes(ops.join("\n"));
  const objs = [];   // [body, stream?]
  const add = (body, stream) => (objs.push([body, stream]), objs.length);
  const catalog = add(null), pages = add(null), page = add(null);
  const contents = add("<< >>", content);
  const img = (w, h, cs, filter, smask) => `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /${cs} /BitsPerComponent 8 /Filter /${filter}${smask ? ` /SMask ${smask} 0 R` : ""} >>`;
  const logoA = add(img(LOGO.w, LOGO.h, "DeviceGray", "FlateDecode"), b64bytes(LOGO.alpha));
  const logo = add(img(LOGO.w, LOGO.h, "DeviceRGB", "FlateDecode", logoA), b64bytes(LOGO.rgb));
  const firmaA = add(img(FIRMA.w, FIRMA.h, "DeviceGray", "FlateDecode"), b64bytes(FIRMA.alpha));
  const firma = add(img(FIRMA.w, FIRMA.h, "DeviceRGB", "FlateDecode", firmaA), b64bytes(FIRMA.rgb));
  const fontRefs = {};
  for (const [res, key] of Object.entries(F)) {
    const f = FONTS[key];
    const file = add(`<< /Filter /FlateDecode /Length1 ${f.len} >>`, b64bytes(f.ttf));
    const desc = add(`<< /Type /FontDescriptor /FontName /${f.name} /Flags ${f.flags} /FontBBox [${f.bbox.join(" ")}] /ItalicAngle ${f.italic} /Ascent ${f.asc} /Descent ${f.desc} /CapHeight ${f.cap} /StemV 80 /FontFile2 ${file} 0 R >>`);
    fontRefs[res] = add(`<< /Type /Font /Subtype /TrueType /BaseFont /${f.name} /FirstChar 32 /LastChar 255 /Widths [${f.widths.join(" ")}] /Encoding /WinAnsiEncoding /FontDescriptor ${desc} 0 R >>`);
  }
  objs[catalog - 1][0] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objs[pages - 1][0] = `<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`;
  objs[page - 1][0] = `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << ${Object.entries(fontRefs).map(([r, id]) => `/${r} ${id} 0 R`).join(" ")} >> /XObject << /Logo ${logo} 0 R /Firma ${firma} 0 R >> >> /Contents ${contents} 0 R >>`;
  const parts = [], offsets = [];
  let len = 0;
  const push = p => { const b = typeof p === "string" ? asciiBytes(p) : p; parts.push(b); len += b.length; };
  push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  objs.forEach(([body, stream], i) => {
    offsets[i + 1] = len;
    if (stream) { push(`${i + 1} 0 obj\n${body.replace(/>>$/, ` /Length ${stream.length} >>`)}\nstream\n`); push(stream); push("\nendstream\nendobj\n"); }
    else push(`${i + 1} 0 obj\n${body}\nendobj\n`);
  });
  const xref = len, N = objs.length + 1;
  push(`xref\n0 ${N}\n0000000000 65535 f \n${offsets.slice(1).map(o2 => String(o2).padStart(10, "0") + " 00000 n \n").join("")}`);
  push(`trailer\n<< /Size ${N} /Root ${catalog} 0 R /Info << /Title ${pstr("Constancia " + c.folio)} /Producer (Vortice VR) >> >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len); let p = 0;
  for (const b2 of parts) { out.set(b2, p); p += b2.length; }
  return out;
}
const asciiBytes = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
const b64bytes = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
