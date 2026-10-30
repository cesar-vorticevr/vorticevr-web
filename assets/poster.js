// Printable poster of an experience (letter size, 8.5 × 11 in at 300 dpi = 2550 × 3300):
// its image, name, logo, how-to steps for its kind and a big QR. Downloads as PDF (the JPEG inside a one-page PDF) or PNG.
// Usage: VVRPoster.draw(canvas, exp, { api, base, plan }) → Promise; VVRPoster.pdf(canvas, name); VVRPoster.png(canvas, name).
// Needs qrcode-generator (window.qrcode) and the Sora / IBM Plex fonts on the page.
(function () {
  const W = 2550, H = 3300, BAND = 1850, INK = "#1b0a36";
  const STEP1 = "Escanea el código QR con la cámara de tu celular";
  // per kind: label, subtitle when the experience has none, the 3 steps and what the image is
  const KINDS = {
    ra: ["Realidad aumentada", "Esta imagen tiene una sorpresa", [STEP1, "Toca «Abrir la cámara»", "Apunta tu celular a esta imagen y mira cómo cobra vida"], "scan"],
    superficie: ["Realidad aumentada", "Ponlo en tu espacio", [STEP1, "Toca «Verlo en tu espacio»", "Apunta al piso o a una mesa y camina alrededor"]],
    colorear: ["Colorea mi dibujo", "Colorea con tu dedo", [STEP1, "Elige tus colores y pinta con el dedo", "Guarda tu obra y compártela"]],
    trivia: ["Trivia", "Contesta con tu cara", [STEP1, "Permite la cámara y ponte frente a ella", "Inclina la cabeza hacia la respuesta correcta"]],
    filtro: ["Filtro para tu cara", "Pruébate el filtro", [STEP1, "Permite la cámara y ponte frente a ella", "Abre la boca, tómate una foto o un video y compártelo"]],
    menu: ["Menú interactivo", "Nuestra carta en tu celular", [STEP1, "Mira los platillos, sus fotos y precios", "¿No sabes qué pedir? Te ayudamos a elegir"]],
    links: ["Todos mis links", "Todo en un solo lugar", [STEP1, "Toca el botón que buscas", "Síguenos y guarda el contacto en tu celular"]],
    ruleta: ["Ruleta de premios", "¡Gira y gana!", [STEP1, "Gira la ruleta con tu dedo", "Guarda tu cupón y muéstralo para canjearlo"]],
    dispara: ["Dispara y gana", "¡Pon a prueba tu puntería!", [STEP1, "Toca «¡Jugar!» y gira con tu celular para buscar", "Toca la pantalla para disparar antes de que se acabe el tiempo"]],
    memorama: ["Memorama", "Encuentra todos los pares", [STEP1, "Memoriza las cartas mientras están boca arriba", "Voltea dos cartas y encuentra los pares a tiempo"]],
    sopa: ["Sopa de letras", "Encuentra todas las palabras", [STEP1, "Busca las palabras en la sopa", "Desliza el dedo sobre cada palabra para marcarla"]],
    rompecabezas: ["Rompecabezas", "Arma la imagen", [STEP1, "Arrastra cada pieza a su lugar", "Termínalo antes de que se acabe el tiempo"]],
    galeria: ["Galería en 3D", "Una exposición que se recorre", [STEP1, "Camina por la sala con el joystick o tocando el piso", "Toca una obra para acercarte y leer su ficha"]],
  };
  const hex = c => /^#[0-9a-f]{6}$/i.test(c || "") ? c : null;
  const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const img = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i.naturalWidth ? i : null); i.onerror = () => r(null); i.src = src; });
  function rnd(seed) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
  function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function star(x, cx, cy, s) { x.beginPath(); x.moveTo(cx, cy - s); x.quadraticCurveTo(cx, cy, cx + s, cy); x.quadraticCurveTo(cx, cy, cx, cy + s); x.quadraticCurveTo(cx, cy, cx - s, cy); x.quadraticCurveTo(cx, cy, cx, cy - s); x.fill(); }
  function lines(x, text, max) { // word wrap; a word longer than the line is split
    const out = []; let cur = "";
    for (let w of String(text).split(/\s+/).filter(Boolean)) {
      while (x.measureText(w).width > max) { let i = w.length; while (i > 1 && x.measureText(w.slice(0, i)).width > max) i--; if (cur) { out.push(cur); cur = ""; } out.push(w.slice(0, i)); w = w.slice(i); }
      const t = cur ? cur + " " + w : w; if (x.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t;
    }
    if (cur) out.push(cur); return out;
  }

  async function draw(canvas, exp, o = {}) {
    const api = o.api || "..", base = o.base || "../assets/", plan = o.plan || {};
    const kind = KINDS[exp.kind] ? exp.kind : "ra", K = KINDS[kind], d = exp[kind] || {};
    const name = (d.name || exp.title || "").trim(), sub = (d.sub || (kind === "galeria" && d.autor ? "Presenta: " + d.autor : "") || K[1]).trim();
    const accent = hex(d.color) || "#8b3fd6", R = rnd(exp.slug || name);
    const brand = plan.brand && (exp.brand === "own" || exp.brand === "none") ? exp.brand : "vortice";
    const v = exp.updated || exp.created || "";
    const picSrc = kind === "trivia" && !(d.logo) ? base + "trivia.svg" : `${api}/m/${exp.slug}/image?v=${v}`;
    await Promise.all(["700 100px Sora", "600 100px Sora", "500 100px 'IBM Plex Sans'", "600 100px 'IBM Plex Sans'", "500 100px 'IBM Plex Mono'"].map(f => document.fonts ? document.fonts.load(f).catch(() => {}) : 0));
    const [pic, top, logo, icon] = await Promise.all([img(picSrc), img(brand === "own" ? `${api}/m/${exp.slug}/logo?v=${v}` : brand === "vortice" ? base + "logo-vorticevr-blanco.png" : null), img(base + "logo-vorticevr.png"), img(base + "icono.png")]);

    canvas.width = W; canvas.height = H; const x = canvas.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
    // band: the experience's color into deep night, with glows, rings and sparkles
    const g = x.createLinearGradient(0, 0, W * .3, BAND); g.addColorStop(0, mix(accent, INK, .25)); g.addColorStop(1, mix(accent, "#05020b", .82));
    x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, BAND - 120); x.quadraticCurveTo(W / 2, BAND + 120, 0, BAND - 120); x.closePath(); x.fill();
    x.save(); x.clip();
    for (const [cx, cy, r, a] of [[W * .1, 260, 900, .45], [W * .95, BAND * .8, 1000, .35]]) { const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, mix(accent, "#ffffff", .25) + Math.round(a * 255).toString(16).padStart(2, "0")); rg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = rg; x.fillRect(0, 0, W, BAND); }
    x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 6;
    for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(W / 2, BAND * 1.6, 1500 + i * 260, 0, Math.PI * 2); x.stroke(); }
    for (let i = 0; i < 46; i++) { x.fillStyle = R() < .3 ? "#ffbe55" : `rgba(255,255,255,${.35 + R() * .6})`; star(x, R() * W, R() * (BAND - 150), 8 + R() * R() * 46); }
    x.restore();
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    // logo: Vórtice VR in white, the brand's own (Premium) or none
    let y = 150;
    if (top) { const h = brand === "own" ? 220 : 130, w = Math.min(1100, h * top.naturalWidth / top.naturalHeight), hh = w * top.naturalHeight / top.naturalWidth;
      if (brand === "own") { x.save(); x.shadowColor = "rgba(0,0,0,.45)"; x.shadowBlur = 30; x.drawImage(top, (W - w) / 2, y, w, hh); x.restore(); } else x.drawImage(top, (W - w) / 2, y, w, hh);
      y += hh + 90; } else y += 60;
    // kind pill
    x.font = "700 58px Sora"; const label = K[0].toUpperCase(); if ("letterSpacing" in x) x.letterSpacing = "8px";
    const pw = x.measureText(label).width + 120; x.fillStyle = "#ffbe55"; rr(x, (W - pw) / 2, y, pw, 110, 55); x.fill();
    x.fillStyle = "#1a0d00"; x.fillText(label, W / 2 + 4, y + 76); if ("letterSpacing" in x) x.letterSpacing = "0px";
    y += 110 + 60;
    // name: as big as fits in 3 lines
    let fs = 200, tl;
    for (; fs >= 96; fs -= 8) { x.font = `700 ${fs}px Sora`; tl = lines(x, name, 2200); if (tl.length <= (fs > 150 ? 2 : 3)) break; }
    if (tl.length > 3) { tl = tl.slice(0, 3); tl[2] = tl[2].replace(/\s*\S*$/, "") + "…"; }
    x.fillStyle = "#fff"; x.save(); x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 24;
    for (const l of tl) { y += fs * 1.02; x.fillText(l, W / 2, y); } x.restore();
    x.font = "500 76px 'IBM Plex Sans'"; x.fillStyle = mix(accent, "#ffffff", .75); const sl = lines(x, sub, 2100).slice(0, 2);
    y += 40; for (const l of sl) { y += 96; x.fillText(l, W / 2, y); }
    y += 80;
    // the picture, on a white card that crosses the edge of the band
    const maxW = 1900, maxH = Math.max(520, 2200 - (K[3] === "scan" ? 190 : 130) - 26 - y);   // the steps and the QR need from 2200 down
    let pr = pic ? pic.naturalWidth / pic.naturalHeight : 1.6, iw = maxW, ih = iw / pr; if (ih > maxH) { ih = maxH; iw = ih * pr; }
    const ix = (W - iw) / 2, iy = y, pad = 26;
    x.save(); x.shadowColor = "rgba(20,5,40,.5)"; x.shadowBlur = 80; x.shadowOffsetY = 30; x.fillStyle = "#fff"; rr(x, ix - pad, iy - pad, iw + pad * 2, ih + pad * 2, 50); x.fill(); x.restore();
    x.save(); rr(x, ix, iy, iw, ih, 30); x.clip();
    if (pic) x.drawImage(pic, ix, iy, iw, ih);
    else { const fg = x.createLinearGradient(ix, iy, ix + iw, iy + ih); fg.addColorStop(0, accent); fg.addColorStop(1, mix(accent, INK, .6)); x.fillStyle = fg; x.fillRect(ix, iy, iw, ih);
      x.fillStyle = "rgba(255,255,255,.9)"; for (let i = 0; i < 14; i++) star(x, ix + R() * iw, iy + R() * ih, 14 + R() * 40);
      x.font = "700 120px Sora"; x.fillStyle = "#fff"; x.fillText(K[0], W / 2, iy + ih / 2 + 40); }
    x.restore();
    if (K[3] === "scan") { // AR: gold scan corners and "point here"
      const c = 120, m = pad + 34; x.strokeStyle = "#ffbe55"; x.lineWidth = 22; x.lineCap = "round";
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const px = sx < 0 ? ix - m : ix + iw + m, py = sy < 0 ? iy - m : iy + ih + m; x.beginPath(); x.moveTo(px, py - sy * c); x.lineTo(px, py); x.lineTo(px - sx * c, py); x.stroke(); }
      x.font = "700 54px Sora"; const t = "APUNTA TU CÁMARA AQUÍ", tw = x.measureText(t).width + 90, ty = iy + ih + pad - 10;
      x.fillStyle = INK; rr(x, (W - tw) / 2, ty - 10, tw, 100, 50); x.fill(); x.fillStyle = "#ffbe55"; x.fillText(t, W / 2, ty + 58);
    }
    // bottom: how it works (left) and the QR (right)
    const foot = brand === "vortice" ? 3110 : 3200;
    let by = Math.max(iy + ih + pad + (K[3] === "scan" ? 190 : 130), 2000);
    const qs = Math.max(540, Math.min(900, foot - by - 330)), qx = W - 170 - qs, lx = 190, lw = qx - lx - 130;
    x.textAlign = "left"; x.fillStyle = INK; x.font = "700 96px Sora"; x.fillText("¿Cómo funciona?", lx, by + 90);
    let sy = by + 200; const steps = K[2].slice();
    if (kind === "dispara" && d.prize && d.prize.min) steps[2] += ` y llega a ${d.prize.min} puntos para ganar un premio`;
    for (let i = 0; i < 3; i++) {
      x.fillStyle = accent; x.beginPath(); x.arc(lx + 60, sy + 52, 62, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#fff"; x.font = "700 70px Sora"; x.textAlign = "center"; x.fillText(String(i + 1), lx + 60, sy + 77); x.textAlign = "left";
      x.fillStyle = "#2d1b4e"; x.font = "500 62px 'IBM Plex Sans'"; const L = lines(x, steps[i], lw - 170);
      L.forEach((l, j) => x.fillText(l, lx + 170, sy + 72 + j * 78)); sy += Math.max(150, L.length * 78 + 70);
    }
    // QR: deep purple modules, the Vórtice VR mark in the middle, "¡Escanéame!" on top
    const qy = by + 110;
    x.fillStyle = "#fff"; x.strokeStyle = accent; x.lineWidth = 14; rr(x, qx - 40, qy - 40, qs + 80, qs + 80, 50); x.fill(); x.stroke();
    const qr = qrcode(0, "H"); qr.addData(exp.url); qr.make(); const n = qr.getModuleCount(), cell = qs / n;
    x.fillStyle = INK; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) x.fillRect(qx + c * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
    if (icon) { const s = qs * .2, p = qx + (qs - s) / 2, q = qy + (qs - s) / 2; x.fillStyle = "#fff"; rr(x, p - 18, q - 18, s + 36, s + 36, 28); x.fill(); x.drawImage(icon, p, q, s, s); }
    x.textAlign = "center"; x.font = "700 64px Sora"; const et = "¡ESCANÉAME!", ew = x.measureText(et).width + 100;
    x.fillStyle = accent; rr(x, qx + qs / 2 - ew / 2, qy - 150, ew, 104, 52); x.fill(); x.fillStyle = "#fff"; x.fillText(et, qx + qs / 2, qy - 76);
    x.fillStyle = "#5b4a7a"; x.font = "500 44px 'IBM Plex Mono'"; let u = String(exp.url).replace(/^https?:\/\//, "").replace(/\/$/, "");
    while (x.measureText(u).width > qs + 120 && u.length > 10) u = u.slice(0, -2) + "…";
    x.fillText(u, qx + qs / 2, qy + qs + 112);
    // footer: made with Vórtice VR (not with the brand's own logo or none)
    if (brand === "vortice") {
      x.fillStyle = "#eadff8"; x.fillRect(190, foot, W - 380, 4);
      x.fillStyle = "#6b279b"; x.font = "500 48px 'IBM Plex Sans'"; x.textAlign = "left"; const ft = "Crea la tuya en vorticevr.mx";
      const lw2 = logo ? 300 : 0, lh = logo ? lw2 * logo.naturalHeight / logo.naturalWidth : 0, tw = x.measureText(ft).width, gx = (W - (tw + lw2 + 60)) / 2;
      x.fillText(ft, gx, foot + 115); if (logo) x.drawImage(logo, gx + tw + 60, foot + 100 - lh / 2, lw2, lh);
    }
  }

  // one-page letter PDF with the canvas as a JPEG (DCTDecode): no library needed
  function pdf(canvas, name) {
    return new Promise(res => canvas.toBlob(async b => {
      const jpg = new Uint8Array(await b.arrayBuffer()), enc = new TextEncoder(), parts = [], offs = []; let len = 0;
      const add = p => { const u = typeof p === "string" ? enc.encode(p) : p; parts.push(u); len += u.length; };
      const obj = (n, body, stream) => { offs[n] = len; add(`${n} 0 obj\n${body}\n`); if (stream) { add("stream\n"); add(stream); add("\nendstream\n"); } add("endobj\n"); };
      const draw = "q 612 0 0 792 0 0 cm /Im0 Do Q";
      add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
      obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
      obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
      obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>");
      obj(4, `<< /Length ${draw.length} >>`, enc.encode(draw));
      obj(5, `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`, jpg);
      const xref = len; add(`xref\n0 6\n0000000000 65535 f \n${offs.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
      save(new Blob(parts, { type: "application/pdf" }), name); res();
    }, "image/jpeg", .92));
  }
  function png(canvas, name) { return new Promise(res => canvas.toBlob(b => { save(b, name); res(); }, "image/png")); }
  function save(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

  window.VVRPoster = { draw, pdf, png };
})();
