// Trivia with face tracking (/x/ when the experience is kind "trivia"; made in /crear/trivia/).
// The front camera finds the face (MindAR face, MediaPipe). The question and its two answers float ABOVE the head (the
// face stays clear for the video): tilting the head toward an answer picks it almost at once; tapping that side works too.
// Everything is drawn in the 3D scene (not HTML), so the recording includes the game. With rec.on the video starts at the
// countdown and stops a moment after the result, then the share sheet opens on its own.
// Look: the creator's color (cfg.trivia.color) and, if there is one, its logo/picture (cfg.logo) on the question bubble.
// Flow: waiting for a face → 3, 2, 1 → questions (with timer if set) → result with stars and confetti → play again.
export async function run({ THREE, MindARThree, container, cfg, setupCapture, started, rec = {} }) {
  const QS = cfg.trivia.questions, N = QS.length, TIME = cfg.trivia.time || 0;
  const TILT = 11, NEUTRAL = 9, HOLD = 0.12;   // degrees to answer (held HOLD s), and back near the middle for the next one
  const mind = new MindARThree({ container, uiLoading: "no", uiScanning: "no", uiError: "no", filterMinCF: 0.0001, filterBeta: 0.001 });
  const { renderer, scene, camera } = mind;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const A = { top: mind.addAnchor(10), chin: mind.addAnchor(152), eyeA: mind.addAnchor(33), eyeB: mind.addAnchor(263) };
  const capture = setupCapture(mind, { maxSec: 180 });
  await mind.start();
  await Promise.all([document.fonts.load('800 60px "Sora"'), document.fonts.load('700 60px "Sora"')]).catch(() => {});
  const logo = cfg.logo ? await new Promise(ok => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = cfg.logo; }) : null;
  started();

  // ---------- colors from the creator's color ----------
  const hex = String(cfg.trivia.color || "#8b3fd6").match(/^#([0-9a-f]{6})$/i) ? cfg.trivia.color : "#8b3fd6";
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const mix = (t, to) => "#" + rgb.map((c, i) => Math.round(c + (to[i] - c) * t).toString(16).padStart(2, "0")).join("");
  const C = { light: mix(0.28, [255, 255, 255]), base: hex, dark: mix(0.35, [10, 4, 22]), ink: mix(0.55, [10, 4, 22]) };
  const GOLD = ["#ffe08a", "#ffab3d"], GREEN = ["#6ff0b2", "#16a663"], RED = ["#ff8fa0", "#d02c48"];

  // ---------- cards: canvas textures on planes that always face the camera ----------
  const hud = new THREE.Group(); scene.add(hud);
  const rr = (g, x, y, w, h, r) => { r = Math.min(r, h / 2, w / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  function lines(g, text, maxW, size, weight = 800) {
    g.font = `${weight} ${size}px Sora, system-ui, sans-serif`;
    const out = []; let cur = "";
    for (const word of String(text).split(/\s+/)) { const t = cur ? cur + " " + word : word; if (g.measureText(t).width > maxW && cur) { out.push(cur); cur = word; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  function fit(g, text, maxW, maxH, big, small, weight = 800) {   // the biggest size where the text fits
    for (let s = big; s >= small; s -= 3) { const l = lines(g, text, maxW, s, weight); if (l.length * s * 1.15 <= maxH && l.every(t => g.measureText(t).width <= maxW)) return { l, s }; }
    return { l: lines(g, text, maxW, small, weight), s: small };
  }
  class Card {
    constructor(w, h) {
      this.cv = Object.assign(document.createElement("canvas"), { width: w, height: h }); this.g = this.cv.getContext("2d");
      this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
      this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, h / w), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
      this.mesh.renderOrder = 10; this.mesh.visible = false; hud.add(this.mesh);
      this.ratio = h / w; this.s = 0; this.v = 0; this.to = 0; this.shake = 0; this.k = 190; this.d = 11; this.rot = 0;
    }
    draw(fn) { const { g, cv } = this; g.clearRect(0, 0, cv.width, cv.height); fn(g, cv.width, cv.height); this.tex.needsUpdate = true; return this; }
    show(on = true) { this.to = on ? 1 : 0; if (on && this.s < 0.05) { this.s = 0.05; this.v = 0; } return this; }
    step(dt) { const a = this.k * (this.to - this.s) - this.d * this.v; this.v += a * dt; this.s += this.v * dt; this.shake = Math.max(0, this.shake - dt * 2.5); }
  }
  // a soft rounded "bubble" with a gradient, a glossy top and a white rim
  function bubble(g, x, y, w, h, r, [c1, c2], rim = "rgba(255,255,255,.95)", glow = null, tail = 0) {
    g.save();
    if (glow) { g.shadowColor = glow; g.shadowBlur = 34; }
    rr(g, x, y, w, h, r);
    if (tail) { g.moveTo(x + w / 2 - tail, y + h - 2); g.lineTo(x + w / 2, y + h + tail * 0.9); g.lineTo(x + w / 2 + tail, y + h - 2); }
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fill();
    g.shadowBlur = 0; g.lineWidth = 8; g.strokeStyle = rim; g.stroke();
    rr(g, x + 14, y + 10, w - 28, h * 0.38, r * 0.8); g.fillStyle = "rgba(255,255,255,.16)"; g.fill();   // gloss
    g.restore();
  }
  function star(g, cx, cy, R, fill, line) {
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.46 : R; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath();
    g.fillStyle = fill; g.fill(); if (line) { g.lineJoin = "round"; g.lineWidth = R * 0.12; g.strokeStyle = line; g.stroke(); }
  }
  function chevron(g, cx, cy, s, dir, color) {   // ‹ or › drawn (no emoji glyphs)
    g.save(); g.strokeStyle = color; g.lineWidth = s * 0.32; g.lineCap = g.lineJoin = "round";
    g.beginPath(); g.moveTo(cx + dir * s * 0.25, cy - s * 0.5); g.lineTo(cx - dir * s * 0.25, cy); g.lineTo(cx + dir * s * 0.25, cy + s * 0.5); g.stroke(); g.restore();
  }

  const qCard = new Card(1024, 420), aCard = [new Card(560, 210), new Card(560, 210)], big = new Card(900, 600), count = new Card(420, 420), bar = new Card(800, 36);
  const stars = Array.from({ length: N }, () => new Card(170, 170)), plus = new Card(360, 170), crown = new Card(300, 220);
  crown.draw((g, w, h) => {   // a drawn crown
    g.save(); g.translate(w / 2, h / 2 + 10); g.beginPath(); g.moveTo(-110, 60); g.lineTo(-125, -40); g.lineTo(-60, 5); g.lineTo(0, -75); g.lineTo(60, 5); g.lineTo(125, -40); g.lineTo(110, 60); g.closePath();
    const gr = g.createLinearGradient(0, -75, 0, 60); gr.addColorStop(0, GOLD[0]); gr.addColorStop(1, GOLD[1]); g.fillStyle = gr; g.shadowColor = "rgba(255,190,85,.9)"; g.shadowBlur = 24; g.fill(); g.shadowBlur = 0;
    g.lineWidth = 9; g.lineJoin = "round"; g.strokeStyle = "#fff6dc"; g.stroke();
    [[-125, -40], [0, -75], [125, -40]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 14, 0, 7); g.fillStyle = "#ff6b8b"; g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 5; g.stroke(); });
    g.restore();
  });
  plus.draw((g, w, h) => { g.font = "800 112px Sora, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = 18; g.strokeStyle = "#0b6b3f"; g.strokeText("¡+1!", w / 2, h / 2); g.fillStyle = "#7dffc0"; g.fillText("¡+1!", w / 2, h / 2); });

  function drawQuestion(i) {
    qCard.draw((g, w, h) => {
      bubble(g, 20, 20, w - 40, h - 70, 70, [C.light, C.base], "rgba(255,255,255,.95)", "rgba(0,0,0,.35)", 34);
      // brand: its logo/picture on the left, then the title; progress on the right
      let x = 66;
      if (logo) {
        g.save(); g.beginPath(); g.arc(x + 34, 82, 38, 0, 7); g.fillStyle = "#fff"; g.fill(); g.clip();
        const k = Math.max(76 / logo.naturalWidth, 76 / logo.naturalHeight); g.drawImage(logo, x + 34 - logo.naturalWidth * k / 2, 82 - logo.naturalHeight * k / 2, logo.naturalWidth * k, logo.naturalHeight * k); g.restore();
        x += 88;
      }
      g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = "rgba(255,255,255,.92)";
      const { l: tl, s: ts } = fit(g, cfg.title || "Trivia", w - x - 200, 40, 32, 22, 700); g.font = `700 ${ts}px Sora, sans-serif`; g.fillText(tl[0] + (tl.length > 1 ? "…" : ""), x, 82);
      g.textAlign = "right"; g.font = "800 30px Sora, sans-serif"; g.fillStyle = "#fff"; g.fillText(`${i + 1}/${N}`, w - 70, 82);
      const { l, s } = fit(g, QS[i].q, w - 140, h - 200, 64, 32);
      g.textAlign = "center"; g.fillStyle = "#fff"; g.font = `800 ${s}px Sora, sans-serif`;
      g.shadowColor = "rgba(0,0,0,.25)"; g.shadowOffsetY = 3; g.shadowBlur = 6;
      l.forEach((t, k) => g.fillText(t, w / 2, 128 + (h - 210) / 2 + (k - (l.length - 1) / 2) * s * 1.15));
    });
  }
  function drawAnswer(side, state, hot = 0) {
    const text = QS[qi].a[side];
    aCard[side].draw((g, w, h) => {
      const on = state || hot > 0.5;
      const colors = state === "ok" ? GREEN : state === "bad" ? RED : hot > 0.5 ? GOLD : ["rgba(255,255,255,.96)", "rgba(240,232,255,.9)"];
      bubble(g, 16, 16, w - 32, h - 32, 999, colors, on ? "#fff" : C.base, state === "ok" ? "rgba(71,226,154,.95)" : hot > 0.5 ? "rgba(255,190,85,.95)" : "rgba(0,0,0,.25)");
      const ink = state ? "#fff" : hot > 0.5 ? "#4a2400" : C.ink;
      g.textAlign = "center"; g.textBaseline = "middle";
      if (state === "ok" || state === "bad") {   // ✓ or ✕ drawn
        g.save(); g.strokeStyle = "#fff"; g.lineWidth = 14; g.lineCap = g.lineJoin = "round"; const cx = side === 0 ? 74 : w - 74, cy = h / 2;
        g.beginPath(); if (state === "ok") { g.moveTo(cx - 22, cy); g.lineTo(cx - 6, cy + 18); g.lineTo(cx + 24, cy - 18); } else { g.moveTo(cx - 18, cy - 18); g.lineTo(cx + 18, cy + 18); g.moveTo(cx + 18, cy - 18); g.lineTo(cx - 18, cy + 18); } g.stroke(); g.restore();
      } else chevron(g, side === 0 ? 66 : w - 66, h / 2, 34, side === 0 ? 1 : -1, hot > 0.5 ? "#4a2400" : C.base);
      const { l, s } = fit(g, text, w - 190, h - 60, 58, 26);
      g.fillStyle = ink; g.font = `800 ${s}px Sora, sans-serif`;
      l.forEach((t, k) => g.fillText(t, w / 2 + (side === 0 ? 22 : -22), h / 2 + 3 + (k - (l.length - 1) / 2) * s * 1.1));
    });
  }
  function drawCount(n) {
    count.draw((g, w, h) => {
      g.save(); g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 30; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 30, 0, 7);
      const go = n === 0, gr = g.createRadialGradient(w / 2, h / 3, 20, w / 2, h / 2, w / 2);
      gr.addColorStop(0, go ? GOLD[0] : C.light); gr.addColorStop(1, go ? GOLD[1] : C.base); g.fillStyle = gr; g.fill(); g.shadowBlur = 0;
      g.lineWidth = 12; g.strokeStyle = "#fff"; g.stroke(); g.restore();
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = go ? "#4a2400" : "#fff"; g.font = `800 ${go ? 120 : 200}px Sora, sans-serif`; g.fillText(go ? "¡YA!" : String(n), w / 2, h / 2 + 8);
    });
  }
  function drawBig(title, sub, gold) {
    big.draw((g, w, h) => {
      bubble(g, 24, 24, w - 48, h - 48, 90, gold ? GOLD : [C.light, C.base], "#fff", gold ? "rgba(255,190,85,.95)" : "rgba(0,0,0,.35)");
      g.textAlign = "center"; g.textBaseline = "middle";
      if (logo) { g.save(); g.beginPath(); g.arc(w / 2, 104, 44, 0, 7); g.fillStyle = "#fff"; g.fill(); g.clip(); const k = Math.max(88 / logo.naturalWidth, 88 / logo.naturalHeight); g.drawImage(logo, w / 2 - logo.naturalWidth * k / 2, 104 - logo.naturalHeight * k / 2, logo.naturalWidth * k, logo.naturalHeight * k); g.restore(); }
      g.fillStyle = gold ? "#4a2400" : "#fff"; g.font = "800 190px Sora, sans-serif"; g.fillText(title, w / 2, h / 2 + (logo ? 30 : 0) - (sub ? 30 : 0));
      if (sub) { const { l, s } = fit(g, sub, w - 140, 110, 60, 30); g.font = `800 ${s}px Sora, sans-serif`; g.fillStyle = gold ? "#6b3500" : "#fff"; l.forEach((t, k) => g.fillText(t, w / 2, h - 110 + (k - (l.length - 1) / 2) * s * 1.1)); }
    });
  }
  function drawStar(c, on) { c.draw((g, w, h) => star(g, w / 2, h / 2 + 4, 70, on ? "#ffcf4d" : "rgba(255,255,255,.25)", on ? "#fff6dc" : "rgba(255,255,255,.5)")); }
  function drawBar(p) { bar.draw((g, w, h) => { rr(g, 4, 6, w - 8, h - 12, 999); g.fillStyle = "rgba(10,4,22,.45)"; g.fill(); if (p > 0) { rr(g, 4, 6, Math.max(24, (w - 8) * p), h - 12, 999); g.fillStyle = p > 0.3 ? "#ffcf4d" : "#ff5f7a"; g.fill(); } }); }

  // ---------- confetti: circles, stars, streamers and hearts that flutter as they fall ----------
  const SHAPES = ["circle", "star", "ribbon", "heart"].map(kind => {
    const c = Object.assign(document.createElement("canvas"), { width: 64, height: 64 }), g = c.getContext("2d"); g.fillStyle = "#fff"; g.strokeStyle = "#fff";
    if (kind === "circle") { g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill(); }
    else if (kind === "star") star(g, 32, 34, 28, "#fff");
    else if (kind === "ribbon") { g.lineWidth = 10; g.lineCap = "round"; g.beginPath(); g.moveTo(6, 32); for (let x = 6; x <= 58; x += 2) g.lineTo(x, 32 + Math.sin(x / 6) * 12); g.stroke(); }
    else { g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(4, 34, 10, 8, 32, 22); g.bezierCurveTo(54, 8, 60, 34, 32, 54); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
  const CONF = ["#ffcf4d", "#ff6b8b", "#7dffc0", "#6fc8ff", "#c99bff", "#ffffff", C.light];
  const confGeo = new THREE.PlaneGeometry(1, 1), confetti = [];
  for (let i = 0; i < 180; i++) {
    const m = new THREE.Mesh(confGeo, new THREE.MeshBasicMaterial({ map: SHAPES[i % SHAPES.length], color: CONF[(i * 7) % CONF.length], side: THREE.DoubleSide, transparent: true, depthTest: false, toneMapped: false }));
    m.renderOrder = 9; m.visible = false; hud.add(m); confetti.push({ m, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), ph: 0, sp: 0, rz: 0, size: 0 });
  }
  let ci = 0;
  function burst(at, n, spread, up) {   // at: world position · spread: world size of the burst
    for (let i = 0; i < n; i++) {
      const c = confetti[ci++ % confetti.length];
      c.life = 2 + Math.random() * 1.2; c.p.copy(at); c.size = spread * (0.07 + Math.random() * 0.06);
      const a = Math.random() * Math.PI * 2, r = Math.random();
      c.v.set(Math.cos(a) * r * spread * 2.4, (up ? 1.4 + Math.random() * 1.6 : Math.random() * 0.3) * spread, Math.sin(a) * r * spread * 0.5);
      c.ph = Math.random() * 6; c.sp = 5 + Math.random() * 7; c.rz = (Math.random() - 0.5) * 6; c.m.visible = true;
    }
  }

  // ---------- where things go: the visible part of the camera image, at the face's distance ----------
  const P = { top: new THREE.Vector3(), chin: new THREE.Vector3(), eA: new THREE.Vector3(), eB: new THREE.Vector3() };
  let face = false, dist = 50, headU = 0, headV = 0.35, faceH = 0.5, tilt = 0, fx = 1, fy = 1, W = 1, H = 1;
  const toNdc = v => v.clone().project(camera);
  function measure() {
    const c = renderer.domElement.getBoundingClientRect(), b = container.getBoundingClientRect();
    fx = Math.min(1, b.width / c.width); fy = Math.min(1, b.height / c.height); W = b.width; H = b.height;
  }
  measure(); addEventListener("resize", () => setTimeout(measure, 300));
  const at = (u, v, out = new THREE.Vector3()) => out.set(u * fx, v * fy, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(dist).add(camera.position);
  const visW = () => 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect * fx;
  function track(dt) {
    face = A.top.group.visible;
    if (!face) return;
    scene.updateMatrixWorld(true);
    A.top.group.getWorldPosition(P.top); A.chin.group.getWorldPosition(P.chin); A.eyeA.group.getWorldPosition(P.eA); A.eyeB.group.getWorldPosition(P.eB);
    const d = P.top.clone().add(P.chin).multiplyScalar(0.5).distanceTo(camera.position); if (d > 1e-6) dist += (d - dist) * Math.min(1, dt * 8);
    const t = toNdc(P.top), ch = toNdc(P.chin), k = Math.min(1, dt * 10);
    headU += (t.x / fx - headU) * k; headV += (t.y / fy - headV) * k; faceH += ((t.y - ch.y) / fy - faceH) * k;
    // tilt from the eyes as they look on screen: positive = head leaning to the right side of the screen
    let a = toNdc(P.eA), b = toNdc(P.eB); if (a.x > b.x) [a, b] = [b, a];
    const ang = THREE.MathUtils.radToDeg(Math.atan2((b.y - a.y) * H / fy, (b.x - a.x) * W / fx));
    tilt += (-ang - tilt) * Math.min(1, dt * 22);
  }
  const tmp = new THREE.Vector3();
  function put(card, u, v, wf, extra = 0, rot = 0) {   // wf: width as a part of the visible width
    const w = wf * visW() * Math.max(0, card.s) * (1 + extra);
    at(u, v, card.mesh.position);
    if (card.shake > 0) card.mesh.position.add(tmp.set(Math.sin(clockT * 70) * card.shake * 0.04 * visW(), 0, 0));
    card.mesh.scale.setScalar(Math.max(1e-4, w)); card.mesh.quaternion.copy(camera.quaternion);
    if (rot) card.mesh.rotateZ(rot);
    card.mesh.visible = card.s > 0.02;
  }
  const hOf = (card, wf) => wf * card.ratio * (W / H) * 2;   // a card's height in v units

  // ---------- the game ----------
  const hint = Object.assign(document.createElement("div"), { id: "tvHint" });
  const again = Object.assign(document.createElement("button"), { id: "tvAgain", type: "button", textContent: rec.on ? "Jugar y grabar otra vez" : "Jugar otra vez", hidden: true });
  document.body.append(hint, again);
  const say = t => { hint.textContent = t || ""; hint.classList.toggle("on", !!t); };
  let state = "wait", qi = 0, score = 0, timer = 0, armed = false, phaseT = 0, clockT = 0, picked = -1, hot = [0, 0], lastHot = [-1, -1], shown = 0, held = 0, stopAt = 0;
  const go = (s) => { state = s; phaseT = 0; };
  function start() {
    qi = 0; score = 0; shown = 0; stopAt = 0; again.hidden = true; stars.forEach(c => c.show(false)); crown.show(false); big.show(false);
    if (rec.on && capture.startRec) capture.startRec();
    go("count");
  }
  function ask() { drawQuestion(qi); drawAnswer(0, null); drawAnswer(1, null); lastHot = [0, 0]; qCard.show(); aCard[0].show(); aCard[1].show(); timer = TIME; armed = false; picked = -1; held = 0; go("q"); }
  function answer(side) {
    if (state !== "q") return;
    picked = side; const ok = side === QS[qi].ok; if (ok) score++;
    if (side >= 0) drawAnswer(side, ok ? "ok" : "bad");
    if (!ok) { drawAnswer(QS[qi].ok, "ok"); if (side >= 0) aCard[side].shake = 1; }
    if (ok) { burst(aCard[side].mesh.position, 40, visW() * 0.28, true); plus.s = 0.05; plus.show(); }
    else { const other = aCard[QS[qi].ok]; other.s = 0.7; other.show(); }
    if (side < 0) say("¡Se acabó el tiempo!");
    go("reveal");
  }
  again.addEventListener("click", start);
  container.addEventListener("pointerdown", e => { if (state === "q" && armed) answer(e.clientX < innerWidth / 2 ? 0 : 1); });
  const MSG = [[1, "¡Perfecto!"], [0.8, "¡Eres un genio!"], [0.6, "¡Muy bien!"], [0.4, "¡Nada mal!"], [0.01, "¡Sigue intentando!"], [0, "¡Otra vez!"]];

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta()); clockT += dt; phaseT += dt;
    track(dt);
    // layout: everything above the head (the face stays clear). Answers right over the forehead, the question above them.
    const qW = 0.9, aW = 0.44,   // widths as parts of the screen (u runs -1…1, so a card spans 2·wf in u)
    qH = hOf(qCard, qW), aH = hOf(aCard[0], aW), gap = 0.03;
    let aV = headV + 0.03 + aH / 2, qV = aV + aH / 2 + gap + qH / 2;
    const roof = 0.84;   // under the logo
    if (qV + qH / 2 > roof) { const d = qV + qH / 2 - roof; qV -= d; aV -= d; }
    const cx = Math.max(-0.08, Math.min(0.08, headU * 0.35));
    if (state === "wait") {
      say(face ? "" : "Pon tu cara frente a la cámara");
      if (face && phaseT > 0.6) start();
    } else if (state === "count") {
      const n = 3 - Math.floor(phaseT / 0.8);
      if (n !== shown) { shown = n; if (n >= 0) { drawCount(n); count.s = 0.35; count.show(); } say(n > 0 ? "Inclina la cabeza hacia la respuesta" : ""); }
      if (phaseT > 3.0) { count.show(false); say(""); ask(); }
    } else if (state === "q") {
      if (!face) say("Vuelve a poner tu cara frente a la cámara"); else say(qi === 0 && phaseT < 3.5 ? "Inclina la cabeza hacia tu respuesta" : "");
      if (!armed && Math.abs(tilt) < NEUTRAL && phaseT > 0.35) armed = true;
      for (const side of [0, 1]) {   // the side you lean to lights up and grows
        const lean = side === 0 ? -tilt : tilt, h = armed && face ? Math.min(1, Math.max(0, lean / TILT)) : 0;
        hot[side] += (h - hot[side]) * Math.min(1, dt * 16);
        const lvl = h > 0.6 ? 1 : 0; if (lvl !== lastHot[side]) { lastHot[side] = lvl; drawAnswer(side, null, lvl); }
      }
      if (armed && face && Math.abs(tilt) >= TILT) { held += dt; if (held >= HOLD) answer(tilt < 0 ? 0 : 1); } else held = 0;
      if (state === "q" && TIME && face) { timer -= dt; drawBar(Math.max(0, timer / TIME)); bar.show(); if (timer <= 0) answer(-1); }
    } else if (state === "reveal") {
      if (phaseT > 1.4) {
        say(""); plus.show(false); bar.show(false);
        qCard.show(false); aCard[0].show(false); aCard[1].show(false);
        if (phaseT > 1.75) { qi++; if (qi < N) ask(); else { go("end"); shown = -1; } }
      }
    } else if (state === "end") {
      const shownNow = Math.min(score, Math.floor(phaseT / 0.18));   // the score counts up
      if (shownNow !== shown) {
        shown = shownNow; const r = score / N, msg = MSG.find(([p]) => r >= p)[1];
        drawBig(`${shownNow}/${N}`, shownNow === score ? msg : "Respuestas correctas…", score === N); big.show();
        if (shownNow === score) {
          if (score) burst(big.mesh.position, score === N ? 140 : 70, visW() * 0.6, true);
          if (score === N) crown.show();
          stopAt = phaseT + 3.2;   // keep recording the celebration a little
          if (!rec.on) again.hidden = false;
        }
      }
      stars.forEach((c, k) => { if (phaseT > 0.5 + k * 0.22 && c.to === 0) { drawStar(c, k < score); c.show(); if (k < score) burst(c.mesh.position, 10, visW() * 0.12, true); } });
      if (score && phaseT > 1 && phaseT < 4.5 && Math.random() < dt * 16) burst(at((Math.random() - 0.5) * 1.8, 1.05), 3, visW() * 0.22, false);   // confetti rain
      if (rec.on && stopAt && phaseT > stopAt) { stopAt = 0; if (capture.stopRec) capture.stopRec(); again.hidden = false; }
    }
    // springs and placement
    for (const c of [qCard, ...aCard, big, count, bar, plus, crown, ...stars]) c.step(dt);
    const bob = Math.sin(clockT * 2.2) * 0.008;
    put(qCard, cx, qV + bob, qW);
    put(bar, cx, qV - qH / 2 + 0.035, qW * 0.6);
    put(aCard[0], cx - aW - 0.025 - hot[0] * 0.04, aV + Math.sin(clockT * 3) * 0.01, aW, hot[0] * 0.16, 0.05 + hot[0] * 0.08);
    put(aCard[1], cx + aW + 0.025 + hot[1] * 0.04, aV - Math.sin(clockT * 3) * 0.01, aW, hot[1] * 0.16, -0.05 - hot[1] * 0.08);
    put(count, cx, Math.min(0.6, headV + 0.25), 0.42, 0, Math.sin(clockT * 6) * 0.05);
    const bigV = Math.min(0.62, headV + 0.32), bigH = hOf(big, 0.8);
    put(big, cx, bigV, 0.8);
    put(crown, headU, Math.min(0.95, bigV + bigH / 2 + 0.06 + Math.sin(clockT * 3) * 0.01), 0.26, 0, Math.sin(clockT * 2) * 0.08);
    stars.forEach((c, k) => put(c, cx + (k - (N - 1) / 2) * 0.34, bigV - bigH / 2 - 0.08 + Math.sin(clockT * 4 + k) * 0.01, 0.15, 0, Math.sin(clockT * 3 + k) * 0.15));
    if (picked >= 0 && state === "reveal" && picked === QS[qi].ok) put(plus, picked === 0 ? cx - aW : cx + aW, aV + aH / 2 + 0.05 + phaseT * 0.2, 0.26);
    else put(plus, 0, -2, 0.2);
    for (const c of confetti) {
      if (c.life <= 0) continue;
      c.life -= dt; c.ph += c.sp * dt;
      c.v.y -= visW() * 0.55 * dt; c.v.multiplyScalar(1 - dt * 1.4);   // light: they float down
      c.p.addScaledVector(c.v, dt); c.p.addScaledVector(tmp.setFromMatrixColumn(camera.matrixWorld, 0), Math.sin(c.ph * 0.6) * visW() * 0.03 * dt);   // sideways sway
      c.m.position.copy(c.p); c.m.quaternion.copy(camera.quaternion); c.m.rotateZ(c.rz * clockT); c.m.rotateY(c.ph);   // flutter
      c.m.scale.setScalar(c.size); c.m.material.opacity = Math.min(1, c.life * 1.5); c.m.visible = c.life > 0;
    }
    renderer.render(scene, camera); capture.afterRender();
  });
}
