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
    // "superficie": the 3D objects themselves, rendered clean (assets/poster-3d.js), instead of the editor's shot with its grid
    const hero = kind === "superficie" ? import(new URL(base + "poster-3d.js?v=3", location.href).href).then(m => m.render(exp, api)).catch(() => null) : null;
    const [pic3d, pic2d, top, logo, icon] = await Promise.all([hero, hero ? null : img(picSrc),img(brand === "own" ? `${api}/m/${exp.slug}/logo?v=${v}` : brand === "vortice" ? base + "logo-vorticevr-blanco.png" : null), img(base + "logo-vorticevr.png"), img(base + "icono.png")]);
    const pic = pic3d || pic2d || (hero ? await img(picSrc) : null), stage = !!pic3d;
    const big = K[3] === "scan", band = big ? 1000 : BAND;   // AR with an image: its own layout (scanLayout)

    canvas.width = W; canvas.height = H; const x = canvas.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
    // band: the experience's color into deep night, with glows, rings and sparkles
    const g = x.createLinearGradient(0, 0, W * .3, band); g.addColorStop(0, mix(accent, INK, .25)); g.addColorStop(1, mix(accent, "#05020b", .82));
    x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, band - 120); x.quadraticCurveTo(W / 2, band + 120, 0, band - 120); x.closePath(); x.fill();
    x.save(); x.clip();
    for (const [cx, cy, r, a] of [[W * .1, 260, 900, .45], [W * .95, band * .8, 1000, .35]]) { const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, mix(accent, "#ffffff", .25) + Math.round(a * 255).toString(16).padStart(2, "0")); rg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = rg; x.fillRect(0, 0, W, band); }
    x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 6;
    for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(W / 2, band * 1.6, 1500 + i * 260, 0, Math.PI * 2); x.stroke(); }
    for (let i = 0; i < 46; i++) { x.fillStyle = R() < .3 ? "#ffbe55" : `rgba(255,255,255,${.35 + R() * .6})`; star(x, R() * W, R() * (band - 150), 8 + R() * R() * 46); }
    x.restore();
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    // logo: Vórtice VR in white, the brand's own (Premium) or none
    let y = big ? 110 : 150;
    if (top) { const h = brand === "own" ? (big ? 160 : 220) : (big ? 100 : 130), w = Math.min(1100, h * top.naturalWidth / top.naturalHeight), hh = w * top.naturalHeight / top.naturalWidth;
      if (brand === "own") { x.save(); x.shadowColor = "rgba(0,0,0,.45)"; x.shadowBlur = 30; x.drawImage(top, (W - w) / 2, y, w, hh); x.restore(); } else x.drawImage(top, (W - w) / 2, y, w, hh);
      y += hh + (big ? 60 : 90); } else y += 60;
    const steps = K[2].slice();
    if (kind === "dispara" && d.prize && d.prize.min) steps[2] += ` y llega a ${d.prize.min} puntos para ganar un premio`;
    if (big) return scanLayout(x, { pic, name, accent, url: exp.url, brand, logo, icon, steps, y });
    // kind pill
    x.font = "700 58px Sora"; const label = K[0].toUpperCase(); if ("letterSpacing" in x) x.letterSpacing = "8px";
    const pw = x.measureText(label).width + 120; x.fillStyle = "#ffbe55"; rr(x, (W - pw) / 2, y, pw, 110, 55); x.fill();
    x.fillStyle = "#1a0d00"; x.fillText(label, W / 2 + 4, y + 76); if ("letterSpacing" in x) x.letterSpacing = "0px";
    y += 110 + 60;
    // name: as big as fits in 3 lines
    let fs = 200, tl;
    for (; fs >= 96; fs -= 8) { x.font = `700 ${fs}px Sora`; tl = lines(x, name, 2200); if (tl.length <= (fs > 150 ? 2 : 3)) break; }
    const maxL = 3; if (tl.length > maxL) { tl = tl.slice(0, maxL); tl[maxL - 1] = tl[maxL - 1].replace(/\s*\S*$/, "") + "…"; }
    x.fillStyle = "#fff"; x.save(); x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 24;
    for (const l of tl) { y += fs * 1.02; x.fillText(l, W / 2, y); } x.restore();
    x.font = "500 76px 'IBM Plex Sans'"; x.fillStyle = mix(accent, "#ffffff", .75); const sl = lines(x, sub, 2100).slice(0, 2);
    y += 40; for (const l of sl) { y += 96; x.fillText(l, W / 2, y); }
    y += 80;
    // the picture, on a white card that crosses the edge of the band
    const below = stage ? 290 : 156, maxW = stage ? 1500 : 1900, maxH = Math.max(520, 2200 - below - y);   // the steps and the QR need from 2200 down
    let pr = pic ? (pic.naturalWidth || pic.width) / (pic.naturalHeight || pic.height) : 1.6, iw = maxW, ih = iw / pr; if (ih > maxH) { ih = maxH; iw = ih * pr; }
    const ix = (W - iw) / 2, iy = y, pad = 26;
    if (stage) { // the object on a glowing golden stage, with its sparkles: no card
      const pih = ih, piw = pih * pr, px = (W - piw) / 2, floor = iy + ih + 10, ex = Math.max(piw * .62, 520), ey = ex * .17;
      const gl = x.createRadialGradient(W / 2, iy + ih * .5, 0, W / 2, iy + ih * .5, Math.max(piw, pih) * .85);
      gl.addColorStop(0, mix(accent, "#ffffff", .55) + "cc"); gl.addColorStop(.45, accent + "55"); gl.addColorStop(1, accent + "00");
      x.fillStyle = gl; x.fillRect(0, iy - 300, W, ih + 600);
      const sp = x.createLinearGradient(0, iy - 260, 0, floor); sp.addColorStop(0, "rgba(255,255,255,0)"); sp.addColorStop(1, "rgba(255,255,255,.22)");   // light from above onto the stage
      x.fillStyle = sp; x.beginPath(); x.moveTo(W / 2 - 140, iy - 260); x.lineTo(W / 2 + 140, iy - 260); x.lineTo(W / 2 + ex * .95, floor); x.lineTo(W / 2 - ex * .95, floor); x.closePath(); x.fill();
      x.save(); x.translate(W / 2, floor); x.scale(1, ey / ex);   // round stage seen from above: shadow, gold disk, light ring
      x.shadowColor = "rgba(30,8,60,.55)"; x.shadowBlur = 90; x.shadowOffsetY = 70;
      const dg = x.createLinearGradient(0, -ex, 0, ex); dg.addColorStop(0, "#ffe2a3"); dg.addColorStop(.5, "#ffbe55"); dg.addColorStop(1, "#c77b1c");
      x.fillStyle = dg; x.beginPath(); x.arc(0, 0, ex, 0, Math.PI * 2); x.fill(); x.shadowColor = "transparent";
      const tg = x.createRadialGradient(0, 0, 0, 0, 0, ex * .92); tg.addColorStop(0, "#ffffff"); tg.addColorStop(.6, mix(accent, "#ffffff", .7)); tg.addColorStop(1, mix(accent, "#ffffff", .35));
      x.fillStyle = tg; x.beginPath(); x.arc(0, -ex * .08, ex * .92, 0, Math.PI * 2); x.fill();
      x.strokeStyle = "#ffbe55"; x.lineWidth = 14; x.beginPath(); x.arc(0, -ex * .08, ex * .8, 0, Math.PI * 2); x.stroke();
      x.restore();
      x.save(); x.shadowColor = "rgba(20,5,40,.45)"; x.shadowBlur = 40; x.shadowOffsetY = 18; x.drawImage(pic, px, floor - ey * .25 - pih, piw, pih); x.restore();
      const sc = hex(exp.sparks && exp.sparks.c) || "#ffbe55";
      for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, rr2 = .55 + R() * .5; x.fillStyle = i % 3 ? sc : "#ffffff";
        star(x, W / 2 + Math.cos(a) * (piw / 2 + 120) * rr2 * 1.25, iy + ih * .45 + Math.sin(a) * (pih / 2 + 80) * rr2, 10 + R() * 36); }
      x.font = "700 54px Sora"; const t = "MÍRALO EN TU ESPACIO", tw = x.measureText(t).width + 90, ty = floor + ey + 30;
      x.fillStyle = INK; rr(x, (W - tw) / 2, ty, tw, 100, 50); x.fill(); x.fillStyle = "#ffbe55"; x.fillText(t, W / 2, ty + 68);
    }
    if (!stage) {
    x.save(); x.shadowColor = "rgba(20,5,40,.5)"; x.shadowBlur = 80; x.shadowOffsetY = 30; x.fillStyle = "#fff"; rr(x, ix - pad, iy - pad, iw + pad * 2, ih + pad * 2, 50); x.fill(); x.restore();
    x.save(); rr(x, ix, iy, iw, ih, 30); x.clip();
    if (pic) x.drawImage(pic, ix, iy, iw, ih);
    else { const fg = x.createLinearGradient(ix, iy, ix + iw, iy + ih); fg.addColorStop(0, accent); fg.addColorStop(1, mix(accent, INK, .6)); x.fillStyle = fg; x.fillRect(ix, iy, iw, ih);
      x.fillStyle = "rgba(255,255,255,.9)"; for (let i = 0; i < 14; i++) star(x, ix + R() * iw, iy + R() * ih, 14 + R() * 40);
      x.font = "700 120px Sora"; x.fillStyle = "#fff"; x.fillText(K[0], W / 2, iy + ih / 2 + 40); }
    x.restore();
    }
    // bottom: how it works (left) and the QR (right)
    const foot = brand === "vortice" ? 3110 : 3200, by = Math.max(iy + ih + below, 2000);
    const qs = Math.max(540, Math.min(900, foot - by - 330)), qx = W - 170 - qs, lx = 190;
    x.textAlign = "left"; x.fillStyle = INK; x.font = "700 96px Sora"; x.fillText("¿Cómo funciona?", lx, by + 90);
    drawSteps(x, steps, lx, by + 200, qx - lx - 130, accent, { r: 62, f: 62, lh: 78 });
    drawQR(x, exp.url, qx, by + 110, qs, accent, icon, 44);
    drawFooter(x, foot, brand, logo);
  }

  // AR with an image: the printed image is what the camera looks for, so it is as big as the page allows. No kind label
  // or subtitle. A tall image gets the QR and the steps in a column at its right; a wide one, in a strip below.
  function scanLayout(x, o) {
    const { pic, accent, brand } = o, foot = brand === "vortice" ? 3110 : 3200, pad = 26, m = 64;   // m: room for the scan corners
    let y = o.y, fs = 150, tl;
    for (; fs >= 84; fs -= 6) { x.font = `700 ${fs}px Sora`; tl = lines(x, o.name, 2250); if (tl.length <= (fs > 110 ? 1 : 2)) break; }
    if (tl.length > 2) { tl = tl.slice(0, 2); tl[1] = tl[1].replace(/\s*\S*$/, "") + "…"; }
    x.fillStyle = "#fff"; x.save(); x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 24;
    for (const l of tl) { y += fs * 1.02; x.fillText(l, W / 2, y); } x.restore();
    y += 60 + m;
    const pr = pic ? (pic.naturalWidth || pic.width) / (pic.naturalHeight || pic.height) : .75, side = pr < .95, col = 600;
    const left = 130 + m, right = side ? W - 130 - col - 70 - m : W - 130 - m, bottom = side ? foot - 70 - m : foot - 760;
    let iw = right - left, ih = iw / pr; if (ih > bottom - y) { ih = bottom - y; iw = ih * pr; }
    const ix = left + (right - left - iw) / 2, iy = y + (side ? (bottom - y - ih) / 2 : 0);
    x.save(); x.shadowColor = "rgba(20,5,40,.5)"; x.shadowBlur = 80; x.shadowOffsetY = 30; x.fillStyle = "#fff"; rr(x, ix - pad, iy - pad, iw + pad * 2, ih + pad * 2, 44); x.fill(); x.restore();
    x.save(); rr(x, ix, iy, iw, ih, 26); x.clip();
    if (pic) x.drawImage(pic, ix, iy, iw, ih); else { x.fillStyle = accent; x.fillRect(ix, iy, iw, ih); }
    x.restore();
    const c = 130, k = pad + 30; x.strokeStyle = "#ffbe55"; x.lineWidth = 22; x.lineCap = "round";   // gold scan corners
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const px = sx < 0 ? ix - k : ix + iw + k, py = sy < 0 ? iy - k : iy + ih + k; x.beginPath(); x.moveTo(px, py - sy * c); x.lineTo(px, py); x.lineTo(px - sx * c, py); x.stroke(); }
    x.textAlign = "center"; x.font = "700 54px Sora"; const t = "APUNTA TU CÁMARA AQUÍ", tw = x.measureText(t).width + 90, ty = iy + ih + pad - 50;   // on the card's lower edge
    x.fillStyle = INK; rr(x, ix + iw / 2 - tw / 2, ty, tw, 100, 50); x.fill(); x.fillStyle = "#ffbe55"; x.fillText(t, ix + iw / 2, ty + 68);
    if (side) {   // column at the right: QR on top, steps under it
      const cx = W - 130 - col, qs = col - 80, qy = Math.max(iy + 150, 1000);
      drawQR(x, o.url, cx + 40, qy, qs, accent, o.icon, 34);
      x.textAlign = "left"; x.fillStyle = INK; x.font = "700 64px Sora"; x.fillText("¿Cómo funciona?", cx, qy + qs + 210);
      drawSteps(x, o.steps, cx - 20, qy + qs + 270, col + 20, accent, { r: 40, f: 44, lh: 54 });
    } else {      // strip below: steps at the left, QR at the right
      const qs = 520, qx = W - 170 - qs, by = iy + ih + pad + 110;
      drawQR(x, o.url, qx, by + 130, qs, accent, o.icon, 36);
      x.textAlign = "left"; x.fillStyle = INK; x.font = "700 76px Sora"; x.fillText("¿Cómo funciona?", 190, by + 90);
      drawSteps(x, o.steps, 190, by + 170, qx - 190 - 120, accent, { r: 50, f: 54, lh: 66 });
    }
    drawFooter(x, foot, brand, o.logo);
  }

  // numbered steps; st: circle radius, font size, line height
  function drawSteps(x, steps, lx, sy, w, accent, st) {
    const cx = lx + st.r + 2, tx = lx + st.r * 2 + 44;
    for (let i = 0; i < steps.length; i++) {
      x.fillStyle = accent; x.beginPath(); x.arc(cx, sy + st.r, st.r, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#fff"; x.font = `700 ${Math.round(st.r * 1.12)}px Sora`; x.textAlign = "center"; x.fillText(String(i + 1), cx, sy + st.r * 1.4); x.textAlign = "left";
      x.fillStyle = "#2d1b4e"; x.font = `500 ${st.f}px 'IBM Plex Sans'`; const L = lines(x, steps[i], lx + w - tx);
      L.forEach((l, j) => x.fillText(l, tx, sy + st.r + st.f * .33 + j * st.lh)); sy += Math.max(st.r * 2 + 26, (L.length - 1) * st.lh + st.r * 2 + 30);
    }
  }
  // QR: deep purple modules, the Vórtice VR mark in the middle, "¡Escanéame!" on top and the link under it
  function drawQR(x, url, qx, qy, qs, accent, icon, urlPx) {
    x.fillStyle = "#fff"; x.strokeStyle = accent; x.lineWidth = 14; rr(x, qx - 40, qy - 40, qs + 80, qs + 80, 50); x.fill(); x.stroke();
    const qr = qrcode(0, "H"); qr.addData(url); qr.make(); const n = qr.getModuleCount(), cell = qs / n;
    x.fillStyle = INK; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) x.fillRect(qx + c * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
    if (icon) { const s = qs * .2, p = qx + (qs - s) / 2, q = qy + (qs - s) / 2; x.fillStyle = "#fff"; rr(x, p - 18, q - 18, s + 36, s + 36, 28); x.fill(); x.drawImage(icon, p, q, s, s); }
    x.textAlign = "center"; x.font = "700 64px Sora"; const et = "¡ESCANÉAME!", ew = x.measureText(et).width + 100;
    x.fillStyle = accent; rr(x, qx + qs / 2 - ew / 2, qy - 150, ew, 104, 52); x.fill(); x.fillStyle = "#fff"; x.fillText(et, qx + qs / 2, qy - 76);
    x.fillStyle = "#5b4a7a"; x.font = `500 ${urlPx}px 'IBM Plex Mono'`; let u = String(url).replace(/^https?:\/\//, "").replace(/\/$/, "");
    while (x.measureText(u).width > qs + 100 && u.length > 10) u = u.slice(0, -2) + "…";
    x.fillText(u, qx + qs / 2, qy + qs + 40 + urlPx * 1.6);
  }
  // footer: made with Vórtice VR (not with the brand's own logo or none)
  function drawFooter(x, foot, brand, logo) {
    if (brand !== "vortice") return;
    x.fillStyle = "#eadff8"; x.fillRect(190, foot, W - 380, 4);
    x.fillStyle = "#6b279b"; x.font = "500 48px 'IBM Plex Sans'"; x.textAlign = "left"; const ft = "Crea la tuya en vorticevr.mx";
    const lw = logo ? 300 : 0, lh = logo ? lw * logo.naturalHeight / logo.naturalWidth : 0, tw = x.measureText(ft).width, gx = (W - (tw + lw + 60)) / 2;
    x.fillText(ft, gx, foot + 115); if (logo) x.drawImage(logo, gx + tw + 60, foot + 100 - lh / 2, lw, lh);
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
