// The portal's own printables (vorticevr.mx/@nombre): a letter poster and a business card, both with the QR to the portal.
// VVRKit.poster(canvas, p) and VVRKit.card(canvas, p) → Promise; p = { name, handle, avatar, likes, experiences } (from /api/portal).
// Download with VVRPoster.pdf (the card: VVRKit.CARD_PT, 3.5 × 2 in) or VVRPoster.png. Needs qrcode-generator on the page.
(function () {
  const base = (document.currentScript && document.currentScript.src || "").replace(/perfil-kit\.js.*$/, "");
  const INK = "#1b0a36", SUN = "#ffbe55", LAV = "#d2b8ff";
  const HUES = [[139, 63, 214], [214, 63, 160], [63, 120, 214], [36, 160, 130], [214, 120, 40], [110, 63, 214]];   // same as assets/explora.js
  const img = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  const nf = n => Number(n || 0).toLocaleString("es-MX");
  const rr = (x, a, b, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(a, b, w, h, r) : x.rect(a, b, w, h); };
  const url = p => `${location.origin}/@${p.handle}`;
  const pretty = p => `vorticevr.mx/@${p.handle}`;
  function star(x, cx, cy, r) { x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, d = i % 2 ? r * .28 : r; x.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); } x.closePath(); x.fill(); }
  function rnd(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1e6) / 1e6; }
  function fit(x, t, max, size, weight = 700, font = "Sora", min = 20) {
    for (let s = size; s >= min; s -= 2) { x.font = `${weight} ${s}px ${font}`; if (x.measureText(t).width <= max) return s; }
    return min;
  }
  // round photo, or the generic silhouette
  function face(x, pic, p, cx, cy, r) {
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
    if (pic) { const s = Math.min(pic.naturalWidth, pic.naturalHeight); x.drawImage(pic, (pic.naturalWidth - s) / 2, (pic.naturalHeight - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2); }
    else {
      let h = 0; for (const c of String(p.handle || p.name || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      const [R, G, B] = HUES[h % HUES.length], g = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      g.addColorStop(0, `rgb(${R},${G},${B})`); g.addColorStop(1, INK); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
      x.translate(cx - r, cy - r); x.scale(r / 20, r / 20); x.fillStyle = "rgba(244,238,255,.92)";
      x.beginPath(); x.arc(20, 16, 7, 0, Math.PI * 2); x.fill(); x.fill(new Path2D("M6.5 36c1.8-7.6 7.2-11.4 13.5-11.4S31.7 28.4 33.5 36A20 20 0 0 1 6.5 36z"));
    }
    x.restore();
  }
  function qr(x, text, qx, qy, qs, icon) {
    const q = qrcode(0, "H"); q.addData(text); q.make(); const n = q.getModuleCount(), c = qs / n;
    x.fillStyle = INK; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(qx + k * c, qy + r * c, Math.ceil(c), Math.ceil(c));
    if (icon) { const s = qs * .2, a = qx + (qs - s) / 2, b = qy + (qs - s) / 2, m = s * .12; x.fillStyle = "#fff"; rr(x, a - m, b - m, s + m * 2, s + m * 2, m * 1.6); x.fill(); x.drawImage(icon, a, b, s, s); }
  }
  function night(x, W, H, seed, n) {
    const g = x.createLinearGradient(0, 0, W * .4, H); g.addColorStop(0, "#5a1f8f"); g.addColorStop(.55, "#1b0a36"); g.addColorStop(1, "#05020b");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (const [cx, cy, r, a] of [[W * .15, H * .1, W * .7, .5], [W * .95, H * .6, W * .6, .3]]) { const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, `rgba(210,184,255,${a})`); rg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = rg; x.fillRect(0, 0, W, H); }
    const R = rnd(seed); for (let i = 0; i < n; i++) { x.fillStyle = R() < .3 ? SUN : `rgba(255,255,255,${.3 + R() * .6})`; star(x, R() * W, R() * H, (2 + R() * R() * 14) * W / 1050); }
  }
  const fonts = () => Promise.all(["700 100px Sora", "600 100px Sora", "500 100px 'IBM Plex Sans'", "600 100px 'IBM Plex Mono'"].map(f => document.fonts ? document.fonts.load(f).catch(() => {}) : 0));

  // letter poster, 2550 × 3300 (300 dpi): photo, name, @, up to 3 of the experiences and the big QR
  async function poster(canvas, p) {
    const W = 2550, H = 3300, list = (p.experiences || []).filter(e => e.image).slice(0, 3);
    const [, pic, logo, icon, ...thumbs] = await Promise.all([fonts(), img(p.avatar), img(base + "logo-vorticevr-blanco.png"), img(base + "icono.png"), ...list.map(e => img(e.image))]);
    canvas.width = W; canvas.height = H; const x = canvas.getContext("2d");
    night(x, W, H, p.handle, 120);
    x.textAlign = "center";
    if (logo) { const w = 560, h = w * logo.naturalHeight / logo.naturalWidth; x.drawImage(logo, (W - w) / 2, 150, w, h); }
    // photo with a gold ring
    const cy = 650, r = 260;
    x.save(); x.shadowColor = "rgba(139,63,214,.9)"; x.shadowBlur = 120; x.fillStyle = SUN; x.beginPath(); x.arc(W / 2, cy, r + 26, 0, Math.PI * 2); x.fill(); x.restore();
    face(x, pic, p, W / 2, cy, r);
    let y = cy + r + 190;
    x.fillStyle = "#fff"; fit(x, p.name || p.handle, 2200, 190); x.fillText(p.name || p.handle, W / 2, y);
    y += 120; x.fillStyle = SUN; x.font = "600 96px 'IBM Plex Mono'"; x.fillText("@" + p.handle, W / 2, y);
    const n = (p.experiences || []).length;
    y += 110; x.fillStyle = LAV; x.font = "500 66px 'IBM Plex Sans'";
    x.fillText(`${nf(n)} ${n === 1 ? "experiencia inmersiva" : "experiencias inmersivas"}${p.likes ? ` · ♥ ${nf(p.likes)}` : ""}`, W / 2, y);
    // the experiences, as small cards
    y += 110;
    if (thumbs.length) {
      const cols = thumbs.length, rows = 1, gap = 50, cw = Math.min(640, (2100 - gap * (cols - 1)) / cols), ch = 520;
      const x0 = (W - (cw * cols + gap * (cols - 1))) / 2;
      thumbs.forEach((t, i) => {
        const cx = x0 + (i % cols) * (cw + gap), ty = y + Math.floor(i / cols) * (ch + gap);
        x.save(); x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 50; x.shadowOffsetY = 20; x.fillStyle = "#fff"; rr(x, cx, ty, cw, ch, 34); x.fill(); x.restore();
        x.save(); rr(x, cx + 16, ty + 16, cw - 32, ch - 120, 22); x.clip();
        if (t) { const s = Math.max((cw - 32) / t.naturalWidth, (ch - 120) / t.naturalHeight); x.drawImage(t, cx + 16 + (cw - 32 - t.naturalWidth * s) / 2, ty + 16 + (ch - 120 - t.naturalHeight * s) / 2, t.naturalWidth * s, t.naturalHeight * s); }
        else { x.fillStyle = "#8b3fd6"; x.fillRect(cx, ty, cw, ch); }
        x.restore();
        x.fillStyle = INK; const tt = list[i].title || ""; fit(x, tt, cw - 60, 48, 600, "Sora", 28);
        let s = tt; while (x.measureText(s).width > cw - 60 && s.length > 1) s = s.slice(0, -2) + "…";
        x.fillText(s, cx + cw / 2, ty + ch - 40);
      });
      y += rows * ch + (rows - 1) * gap + 110;
    }
    // QR to the portal
    const qs = Math.max(520, Math.min(820, H - y - 620)), qx = (W - qs) / 2, qy = y + 230, pad = 50;
    x.font = "700 70px Sora"; const et = "¡ESCANÉAME!", ew = x.measureText(et).width + 110;
    x.fillStyle = SUN; rr(x, W / 2 - ew / 2, qy - pad - 140, ew, 112, 56); x.fill(); x.fillStyle = "#1a0d00"; x.fillText(et, W / 2, qy - pad - 60);
    x.fillStyle = "#fff"; rr(x, qx - pad, qy - pad, qs + pad * 2, qs + pad * 2, 50); x.fill();
    qr(x, url(p), qx, qy, qs, icon);
    x.fillStyle = "#fff"; x.font = "600 76px 'IBM Plex Mono'"; x.fillText(pretty(p), W / 2, qy + qs + pad + 120);
    x.fillStyle = LAV; x.font = "500 52px 'IBM Plex Sans'"; x.fillText("Mira todas mis experiencias · Crea la tuya en vorticevr.mx", W / 2, H - 120);
  }

  // business card, 3.5 × 2 in at 300 dpi (1050 × 600): photo, name, @ and the QR
  const CARD_PT = [252, 144];
  async function card(canvas, p) {
    const W = 1050, H = 600;
    const [, pic, logo, icon] = await Promise.all([fonts(), img(p.avatar), img(base + "logo-vorticevr-blanco.png"), img(base + "icono.png")]);
    canvas.width = W; canvas.height = H; const x = canvas.getContext("2d");
    night(x, W, H, p.handle, 40);
    // QR on a white tile at the right
    const qs = 300, qx = W - qs - 70, qy = (H - qs) / 2 - 18, pad = 22;
    x.fillStyle = "#fff"; rr(x, qx - pad, qy - pad, qs + pad * 2, qs + pad * 2, 26); x.fill();
    qr(x, url(p), qx, qy, qs, icon);
    x.textAlign = "center"; x.fillStyle = LAV; x.font = "600 22px Sora"; x.fillText("ESCANÉAME", qx + qs / 2, qy + qs + pad + 38);
    // photo, name and @ at the left
    const lx = 70, maxW = qx - pad - lx - 50, r = 82;
    x.save(); x.fillStyle = SUN; x.beginPath(); x.arc(lx + r, 150, r + 7, 0, Math.PI * 2); x.fill(); x.restore();
    face(x, pic, p, lx + r, 150, r);
    x.textAlign = "left"; x.fillStyle = "#fff"; fit(x, p.name || p.handle, maxW, 58, 700, "Sora", 30); x.fillText(p.name || p.handle, lx, 320);
    x.fillStyle = SUN; fit(x, "@" + p.handle, maxW, 36, 600, "'IBM Plex Mono'", 22); x.fillText("@" + p.handle, lx, 372);
    x.fillStyle = LAV; x.font = "500 25px 'IBM Plex Sans'"; x.fillText("Experiencias inmersivas", lx, 420);
    x.fillStyle = "rgba(255,255,255,.85)"; fit(x, pretty(p), maxW, 25, 500, "'IBM Plex Mono'", 16); x.fillText(pretty(p), lx, 460);
    if (logo) { const w = 190, h = w * logo.naturalHeight / logo.naturalWidth; x.globalAlpha = .9; x.drawImage(logo, lx, H - 60 - h, w, h); x.globalAlpha = 1; }
  }

  window.VVRKit = { poster, card, CARD_PT };
})();
