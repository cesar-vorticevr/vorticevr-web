// Constancias de la plataforma de cursos y de los talleres: un PDF horizontal (carta) armado a mano, sin librerías.
// Diseño (17 de noviembre de 2026; tras tres versiones, César: "honorable pero moderno también, tecnológico", "sin
// tanto garigoleo ni figuritas"; las letras sí le gustaron): papel marfil limpio, una franja morada con filete dorado
// a la izquierda, un marco fino con esquinas de visor (como el de la realidad aumentada), arcos concéntricos tenues
// en una esquina (el vórtice), "CONSTANCIA" en Cinzel, el texto en EB Garamond, el nombre en caligrafía (Great Vibes),
// los datos como campos de una credencial digital en IBM Plex Mono, un sello circular moderno (disco morado con el
// isotipo en blanco y "VÓRTICE VR · CONSTANCIA AVALADA" alrededor), la firma de César y abajo una franja de
// "Verificación digital" con el enlace, la fecha de expedición y el QR.
// Las letras van incrustadas (recortadas a WinAnsi, _cursos/fuentes-pdf.js, tools/fuentes-pdf.mjs; licencia OFL);
// el logo, el isotipo y la firma vienen comprimidos (_cursos/logo-pdf.js, icono-pdf.js, firma-pdf.js).
import qrcode from "./vendor/qrcode.js";
import { LOGO } from "./logo-pdf.js";
import { ICONO } from "./icono-pdf.js";
import { FIRMA } from "./firma-pdf.js";
import { FONTS } from "./fuentes-pdf.js";

const W = 792, H = 612;
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
const F = { T: "cinzelB", t: "cinzel", G: "garamond", I: "garamondI", B: "garamondB", S: "script", M: "mono", N: "monoM" };
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
const mix = (a, b, t) => "#" + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
const MODALITY = { recorded: "En línea", live: "En vivo", mixed: "Mixta", presencial: "Presencial", en_linea: "En línea, en vivo" };
const C = { night: "#1d0b38", ink: "#1b0a36", purple: "#4f1a7d", gold: "#b8862c", goldD: "#7a5410", text: "#3d2f57", label: "#7b6d93", paper: "#fcfbf8", strip: "#f4f0fa", line: "#ddd2ea" };
const fechaMx = t => new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });

// c = { folio, issued, student, course, hours, modality, period, place, instructor, kind, courseKey, objectives, verifyUrl, ace, signer, signerTitle, revoked }
export function certificatePdf(c) {
  const ops = [], P = v => v.toFixed(2);
  const text = (x, y, size, f, s, color = C.ink, tc = 0) => ops.push(`BT /${f} ${size} Tf ${tc} Tc ${rgb(color)} rg ${P(x)} ${P(y)} Td ${pstr(s)} Tj ET`);
  const center = (cx, y, size, f, s, color, tc = 0) => text(cx - tw(s, size, f, tc) / 2, y, size, f, s, color, tc);
  const right = (rx, y, size, f, s, color, tc = 0) => text(rx - tw(s, size, f, tc), y, size, f, s, color, tc);
  const rect = (x, y, w, h, color) => ops.push(`${rgb(color)} rg ${P(x)} ${P(y)} ${P(w)} ${P(h)} re f`);
  const line = (x1, y1, x2, y2, color, w) => ops.push(`${rgb(color)} RG ${w} w ${P(x1)} ${P(y1)} m ${P(x2)} ${P(y2)} l S`);
  const K = 0.5523;
  const circ = (cx, cy, r) => `${P(cx + r)} ${P(cy)} m ${P(cx + r)} ${P(cy + r * K)} ${P(cx + r * K)} ${P(cy + r)} ${P(cx)} ${P(cy + r)} c ${P(cx - r * K)} ${P(cy + r)} ${P(cx - r)} ${P(cy + r * K)} ${P(cx - r)} ${P(cy)} c ${P(cx - r)} ${P(cy - r * K)} ${P(cx - r * K)} ${P(cy - r)} ${P(cx)} ${P(cy - r)} c ${P(cx + r * K)} ${P(cy - r)} ${P(cx + r)} ${P(cy - r * K)} ${P(cx + r)} ${P(cy)} c h`;
  const ring = (cx, cy, r, color, w) => ops.push(`${rgb(color)} RG ${w} w ${circ(cx, cy, r)} S`);
  const disc = (cx, cy, r, color) => ops.push(`${rgb(color)} rg ${circ(cx, cy, r)} f`);
  const taller = c.kind === "taller";

  // ---------- paper, the purple edge, a fine frame with viewfinder corners, the vortex arcs ----------
  const L = 34, R = W - 26, B = 26, T = H - 26;   // the inner frame
  rect(0, 0, W, H, C.paper);
  ops.push(`q ${L} ${B} ${R - L} ${T - B} re W n`);
  for (let i = 0; i < 16; i++) { const r = 34 + i * 15; ring(R, T, r, mix("#cdb8ea", C.paper, i / 17), 0.55); }
  ops.push("Q");
  rect(0, 0, 14, H, C.night);
  line(18.5, 0, 18.5, H, C.gold, 0.8);
  ops.push(`${rgb(C.line)} RG 0.5 w ${L} ${B} ${R - L} ${T - B} re S`);
  for (const [x, y, dx, dy] of [[L, T, 1, -1], [R, T, -1, -1], [L, B, 1, 1], [R, B, -1, 1]])
    ops.push(`${rgb(C.gold)} RG 1.3 w ${P(x)} ${P(y + dy * 16)} m ${P(x)} ${P(y)} l ${P(x + dx * 16)} ${P(y)} l S`);

  // ---------- header: the logos (Vórtice VR unless the workshop took it off, then the workshop's own) and the folio ----------
  const X = 82, MAXW = 468, extra = [];   // the workshop's images: [resource name, image]
  let hx = X;
  if (c.vvrLogo !== false) { const lh = 24, lw = lh * LOGO.w / LOGO.h; ops.push(`q ${P(lw)} 0 0 ${lh} ${X} 542 cm /Logo Do Q`); hx += lw; }
  (c.logos || []).slice(0, 3).forEach((im, i) => {
    let h = 32, w = h * im.w / im.h; if (w > 150) { w = 150; h = w * im.h / im.w; }
    if (hx > X) { hx += 14; line(hx, 538, hx, 570, C.line, 0.8); hx += 14; }
    extra.push(["L" + i, im]);
    ops.push(`q ${P(w)} 0 0 ${P(h)} ${P(hx)} ${P(554 - h / 2)} cm /L${i} Do Q`);
    hx += w;
  });
  right(R - 30, 558, 6.5, "N", "FOLIO", C.label, 1.6);
  right(R - 30, 543, 11, "N", c.folio, C.ink, 0.4);

  // ---------- title ----------
  text(X, 468, 46, "T", "CONSTANCIA", C.purple, 6);
  const sub = c.kind === "dc3" ? "DE CAPACITACIÓN" : taller ? "DE PARTICIPACIÓN" : "DE ACREDITACIÓN";
  line(X, 450.5, X + 34, 450.5, C.gold, 1.4);
  text(X + 46, 446, 12.5, "t", sub, C.goldD, 4.5);
  text(X, 404, 15, "I", "Vórtice VR otorga la presente a", C.text);

  // ---------- the name, in calligraphy (extra word spacing: the script's own space is narrow) ----------
  const nsp = (String(c.student).match(/ /g) || []).length, nw = s => tw(c.student, s, "S") + nsp * s * 0.16;
  let ns = 56; while (ns > 24 && nw(ns) > MAXW) ns -= 1;
  ops.push(`BT /S ${ns} Tf ${P(ns * 0.16)} Tw ${rgb(C.ink)} rg ${X} 350 Td ${pstr(c.student)} Tj 0 Tw ET`);
  line(X, 332, X + MAXW, 332, C.gold, 0.6);

  // ---------- what for ----------
  text(X, 306, 14, "I", taller ? "por su participación en el taller" : "por haber acreditado satisfactoriamente el curso", C.text);
  let y = 306;
  let ts = 20; while (ts > 13 && wrap(c.course, ts, "T", MAXW).length > 2) ts -= 0.5;   // long titles shrink to two lines
  for (const l of wrap(c.course, ts, "T", MAXW).slice(0, 2)) { y -= ts + 5; text(X, y, ts, "T", l, C.purple, 0.5); }

  // ---------- the data, as the fields of a digital credential ----------
  const hrs = c.hours ? `${String(c.hours).replace(/\.0$/, "")} ${Number(c.hours) === 1 ? "hora" : "horas"}` : "";
  const per = c.period ? c.period.replace(/^del /, "Del ") : "";
  const fields = [["DURACIÓN", hrs], ["MODALIDAD", MODALITY[c.modality] || c.modality || ""], [taller ? (/^del /i.test(c.period || "") ? "FECHAS" : "FECHA") : "PERIODO", per]].filter(x => x[1]);
  const rows = [[]]; let used = 0;
  for (const f of fields) {   // a row while they fit; the date can go to its own row
    const w = Math.max(tw(f[1], 12, "B"), tw(f[0], 6.5, "N", 1.4)) + 34;
    if (used + w > MAXW + 34 && rows[rows.length - 1].length) { rows.push([]); used = 0; }
    rows[rows.length - 1].push([...f, w]); used += w;
  }
  if (c.place) rows.push([["LUGAR", wrap(c.place, 12, "B", MAXW)[0], MAXW]]);
  y -= 36;
  for (const row of rows) {
    let x = X;
    row.forEach(([k, v, w], i) => {
      if (i) line(x - 17, y - 5, x - 17, y + 14, C.line, 0.8);
      text(x, y + 7, 6.5, "N", k, C.label, 1.4);
      text(x, y - 7, 12, "B", v, C.ink);
      x += w;
    });
    y -= 36;
  }

  // ---------- the seal (right): a night disc with the isotipo in white, gold rings, text around ----------
  const RX = W - 150, SY = 398;
  ring(RX, SY, 66, C.gold, 1);
  ring(RX, SY, 62.5, C.gold, 0.35);
  disc(RX, SY, 44, C.night);
  ring(RX, SY, 44, C.gold, 1.2);
  ring(RX, SY, 40, "#4a2a78", 0.5);
  const ih = 40, iw = ih * ICONO.w / ICONO.h;
  ops.push(`q ${P(iw)} 0 0 ${ih} ${P(RX - iw / 2)} ${P(SY - ih / 2)} cm /Icono Do Q`);
  const ringTxt = "VÓRTICE VR · CONSTANCIA AVALADA · ", rr = 50.5, rs = 7.4;
  const gap = (2 * Math.PI * rr - tw(ringTxt, rs, "T")) / ringTxt.length;
  let phi = Math.PI / 2 + (tw("VÓRTICE VR", rs, "T") + 9 * gap) / 2 / rr;   // "VÓRTICE VR" centered on top, clockwise
  for (const ch of ringTxt) {
    const w = tw(ch, rs, "T"), cw = w + gap, mid = phi - cw / 2 / rr, th = mid - Math.PI / 2;
    const x = RX + rr * Math.cos(mid) - Math.cos(th) * w / 2, yy = SY + rr * Math.sin(mid) - Math.sin(th) * w / 2;   // baseline 2.6 below the ring line, so the letters sit on it
    if (ch !== " ") ops.push(`BT /T ${rs} Tf ${rgb(C.goldD)} rg ${Math.cos(th).toFixed(4)} ${Math.sin(th).toFixed(4)} ${(-Math.sin(th)).toFixed(4)} ${Math.cos(th).toFixed(4)} ${P(x - Math.cos(mid) * 2.6)} ${P(yy - Math.sin(mid) * 2.6)} Tm ${pstr(ch)} Tj ET`);
    phi -= cw / rr;
  }

  // ---------- signatures ----------
  const SLY = 150;
  const signer = c.signer || SIGNER, withFirma = !c.signer || /c[ée]sar/i.test(c.signer);
  const sig = (cx, name, role, firma) => {
    if (firma) { const fh = 78, fw = fh * FIRMA.w / FIRMA.h; ops.push(`q ${P(fw)} 0 0 ${fh} ${P(cx - fw / 2 + 6)} ${SLY - 8} cm /Firma Do Q`); }
    line(cx - 96, SLY, cx + 96, SLY, C.text, 0.6);
    let s = 11.5; while (s > 8.5 && tw(name || "", s, "B") > 200) s -= 0.5;
    center(cx, SLY - 15, s, "B", name || "", C.ink);
    center(cx, SLY - 28, 10, "I", role, C.text);
  };
  if (!taller) { sig(RX, signer, c.signerTitle || "Por Vórtice VR", withFirma); sig(X + 110, c.instructor, "Instructor del curso", false); }
  else {
    // a workshop: César's (unless taken off) and up to 3 more, each with its own PNG; one goes on the right, several in a row
    const sigs = [];
    if (c.cesar !== false) sigs.push({ name: signer, role: c.signerTitle || "Vórtice VR", res: withFirma ? "Firma" : null, im: FIRMA });
    (c.signers || []).slice(0, 3).forEach((g, i) => { if (g.img) extra.push(["G" + i, g.img]); sigs.push({ name: g.name, role: g.title || "", res: g.img ? "G" + i : null, im: g.img }); });
    const draw = (g, cx, ly, hmax, wmax) => {
      if (!g.res) return;
      let h2 = hmax, w2 = h2 * g.im.w / g.im.h; if (w2 > wmax) { w2 = wmax; h2 = w2 * g.im.h / g.im.w; }
      ops.push(`q ${P(w2)} 0 0 ${P(h2)} ${P(cx - w2 / 2 + (g.res === "Firma" ? 6 : 0))} ${P(ly - (g.res === "Firma" ? 8 : 6))} cm /${g.res} Do Q`);
    };
    if (sigs.length === 1) { draw(sigs[0], RX, SLY, 78, 190); sig(RX, sigs[0].name, sigs[0].role, false); }
    else if (sigs.length) {
      // under the data: the images may grow up to where the last field ends
      const yEnd = y + 23, ly = 128, colW = (R - 30 - X) / sigs.length, lw2 = Math.min(190, colW - 22), hmax = Math.max(34, Math.min(66, yEnd - (ly - 6)));
      sigs.forEach((g, i) => {
        const cx = X + colW * (i + 0.5);
        draw(g, cx, ly, hmax, lw2);
        line(cx - lw2 / 2, ly, cx + lw2 / 2, ly, C.text, 0.6);
        let s2 = 11; while (s2 > 7.5 && tw(g.name || "", s2, "B") > lw2 + 10) s2 -= 0.5;
        center(cx, ly - 14, s2, "B", g.name || "", C.ink);
        let s3 = 9.5; while (s3 > 7 && tw(g.role, s3, "I") > lw2 + 10) s3 -= 0.5;
        center(cx, ly - 26, s3, "I", g.role, C.text);
      });
    }
  }

  // ---------- digital verification strip ----------
  const SB = 96;
  rect(L, B, R - L, SB - B, C.strip);
  line(L, SB, R, SB, C.line, 0.6);
  text(X, 78, 6.5, "N", "VERIFICACIÓN DIGITAL", C.goldD, 1.6);
  text(X, 64, 8.5, "M", c.verifyUrl.replace(/^https?:\/\//, ""), C.ink);
  if (c.issued) text(X, 47, 11, "I", `Expedida en México, el ${fechaMx(c.issued)}.`, C.text);
  if (c.kind === "dc3") {   // DC-3 fields printed on the Vórtice VR certificate (the official format is phase 3)
    text(X, 34, 6.5, "M", `Agente capacitador: Vórtice VR${c.ace ? " · Registro STPS " + c.ace : ""}${c.courseKey ? " · Clave del curso " + c.courseKey : ""}`, C.label);
  }
  const qr = qrcode(0, "M"); qr.addData(c.verifyUrl); qr.make();
  const n = qr.getModuleCount(), size = 60, cell = size / n, qx = R - 14 - size, qy = 31;
  rect(qx - 4, qy - 4, size + 8, size + 8, "#ffffff");
  const q = [];
  for (let r = 0; r < n; r++) for (let col = 0; col < n; ) {
    if (!qr.isDark(r, col)) { col++; continue; }
    let e = col; while (e < n && qr.isDark(r, e)) e++;
    q.push(`${P(qx + col * cell)} ${P(qy + (n - 1 - r) * cell)} ${P((e - col) * cell + 0.05)} ${P(cell + 0.05)} re`);
    col = e;
  }
  ops.push(`${rgb(C.ink)} rg ${q.join(" ")} f`);
  right(qx - 14, 64, 6.5, "N", "ESCANEE PARA", C.label, 1.4);
  right(qx - 14, 54, 6.5, "N", "VERIFICAR", C.label, 1.4);

  if (c.revoked) {   // a revoked certificate still opens, crossed out
    ops.push(`q 0.85 0.15 0.15 RG 3 w 70 300 m ${W - 60} 300 l S Q`);
    center(W / 2, 272, 28, "T", "CONSTANCIA REVOCADA", "#c62828", 2);
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
  const icono = add(img(ICONO.w, ICONO.h, "DeviceGray", "RunLengthDecode", add(img(ICONO.w, ICONO.h, "DeviceGray", "FlateDecode"), b64bytes(ICONO.alpha))), whiteRun(ICONO.w * ICONO.h));   // the isotipo in white: a white image with its alpha
  const firmaA = add(img(FIRMA.w, FIRMA.h, "DeviceGray", "FlateDecode"), b64bytes(FIRMA.alpha));
  const firma = add(img(FIRMA.w, FIRMA.h, "DeviceRGB", "FlateDecode", firmaA), b64bytes(FIRMA.rgb));
  // the workshop's logos and signatures: { w, h, rgb, alpha? } prepared in the admin's browser (zlib, base64)
  const extraRefs = extra.map(([res, im]) => {
    const a = im.alpha ? add(img(im.w, im.h, "DeviceGray", "FlateDecode"), b64bytes(im.alpha)) : 0;
    return `/${res} ${add(img(im.w, im.h, "DeviceRGB", "FlateDecode", a), b64bytes(im.rgb))} 0 R`;
  }).join(" ");
  const fontRefs = {};
  for (const [res, key] of Object.entries(F)) {
    const f = FONTS[key];
    const file = add(`<< /Filter /FlateDecode /Length1 ${f.len} >>`, b64bytes(f.ttf));
    const desc = add(`<< /Type /FontDescriptor /FontName /${f.name} /Flags ${f.flags} /FontBBox [${f.bbox.join(" ")}] /ItalicAngle ${f.italic} /Ascent ${f.asc} /Descent ${f.desc} /CapHeight ${f.cap} /StemV 80 /FontFile2 ${file} 0 R >>`);
    fontRefs[res] = add(`<< /Type /Font /Subtype /TrueType /BaseFont /${f.name} /FirstChar 32 /LastChar 255 /Widths [${f.widths.join(" ")}] /Encoding /WinAnsiEncoding /FontDescriptor ${desc} 0 R >>`);
  }
  objs[catalog - 1][0] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objs[pages - 1][0] = `<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`;
  objs[page - 1][0] = `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << ${Object.entries(fontRefs).map(([r, id]) => `/${r} ${id} 0 R`).join(" ")} >> /XObject << /Logo ${logo} 0 R /Firma ${firma} 0 R /Icono ${icono} 0 R ${extraRefs} >> >> /Contents ${contents} 0 R >>`;
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
// n bytes of 255 in RunLengthDecode (runs of up to 128, then EOD)
function whiteRun(n) {
  const out = [];
  while (n > 0) { const k = Math.min(128, n); out.push(k === 1 ? 0 : 257 - k, 255); n -= k; }
  out.push(128);
  return Uint8Array.from(out);
}
const asciiBytes = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
const b64bytes = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
