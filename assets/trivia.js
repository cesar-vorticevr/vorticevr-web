// Trivia with face tracking (/x/ when the experience is kind "trivia"; made in /crear/trivia/).
// The front camera finds the face (MindAR face, MediaPipe). Each question floats over the head and the two answers sit
// on the left and on the right: tilting the head toward one picks it (tapping that side of the screen does too).
// Everything is drawn in the 3D scene (not HTML), so photos and videos taken with the shutter include the game.
// Flow: waiting for a face → 3, 2, 1 → questions (with timer if set) → result with stars and confetti → play again.
export async function run({ THREE, MindARThree, container, cfg, setupCapture, started }) {
  const QS = cfg.trivia.questions, N = QS.length, TIME = cfg.trivia.time || 0;
  const TILT = 16, NEUTRAL = 8;   // degrees: to answer, and to be ready for the next question
  const mind = new MindARThree({ container, uiLoading: "no", uiScanning: "no", uiError: "no", filterMinCF: 0.0001, filterBeta: 0.001 });
  const { renderer, scene, camera } = mind;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const A = { top: mind.addAnchor(10), chin: mind.addAnchor(152), eyeA: mind.addAnchor(33), eyeB: mind.addAnchor(263) };
  const capture = setupCapture(mind);
  await mind.start();
  await document.fonts.load('700 60px "Sora"').catch(() => {});
  started();

  // ---------- cards: canvas textures on planes that always face the camera ----------
  const hud = new THREE.Group(); scene.add(hud);
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  function lines(g, text, maxW, size, weight = 700) {
    g.font = `${weight} ${size}px Sora, system-ui, sans-serif`;
    const out = []; let cur = "";
    for (const word of String(text).split(/\s+/)) { const t = cur ? cur + " " + word : word; if (g.measureText(t).width > maxW && cur) { out.push(cur); cur = word; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  function fit(g, text, maxW, maxH, big, small) {   // the biggest size where the text fits
    for (let s = big; s >= small; s -= 4) { const l = lines(g, text, maxW, s); if (l.length * s * 1.18 <= maxH) return { l, s }; }
    return { l: lines(g, text, maxW, small), s: small };
  }
  class Card {
    constructor(w, h) {
      this.cv = Object.assign(document.createElement("canvas"), { width: w, height: h }); this.g = this.cv.getContext("2d");
      this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
      this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, h / w), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
      this.mesh.renderOrder = 10; this.mesh.visible = false; hud.add(this.mesh);
      this.ratio = h / w; this.s = 0; this.v = 0; this.to = 0; this.shake = 0; this.k = 170; this.d = 13;
    }
    draw(fn) { const { g, cv } = this; g.clearRect(0, 0, cv.width, cv.height); fn(g, cv.width, cv.height); this.tex.needsUpdate = true; return this; }
    show(on = true) { this.to = on ? 1 : 0; if (on && this.s < 0.05) { this.s = 0.05; this.v = 0; } return this; }
    step(dt) { const a = this.k * (this.to - this.s) - this.d * this.v; this.v += a * dt; this.s += this.v * dt; this.shake = Math.max(0, this.shake - dt * 2.5); }
  }
  const PURPLE = ["#a35cf0", "#5a1f8f"], GOLD = ["#ffd27f", "#ff9f3a"], GREEN = ["#47e29a", "#159a5b"], RED = ["#ff7b8f", "#c4243f"], DARK = ["rgba(30,14,58,.94)", "rgba(12,5,26,.94)"];
  function panel(g, w, h, [c1, c2], border, glow) {
    const pad = 18, gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    if (glow) { g.shadowColor = glow; g.shadowBlur = 26; }
    rr(g, pad, pad, w - pad * 2, h - pad * 2, 48); g.fillStyle = gr; g.fill(); g.shadowBlur = 0;
    if (border) { g.lineWidth = 7; g.strokeStyle = border; g.stroke(); }
  }
  const qCard = new Card(1024, 440), aCard = [new Card(560, 300), new Card(560, 300)], big = new Card(900, 520), bar = new Card(1024, 40);
  const stars = Array.from({ length: N }, () => new Card(160, 160)), plus = new Card(300, 160), crown = new Card(260, 220);
  crown.draw(g => { g.font = "180px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("👑", 130, 118); });
  plus.draw((g, w, h) => { g.font = "800 120px Sora, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 14; g.strokeStyle = "#0d5c36"; g.strokeText("+1", w / 2, h / 2); g.fillStyle = "#6dffb4"; g.fillText("+1", w / 2, h / 2); });
  function drawQuestion(i) {
    qCard.draw((g, w, h) => {
      panel(g, w, h, PURPLE, "rgba(232,214,255,.95)", "rgba(139,63,214,.9)");
      g.textAlign = "center"; g.fillStyle = "#ffe0a3"; g.font = "700 34px Sora, sans-serif"; g.fillText(`PREGUNTA ${i + 1} DE ${N}`, w / 2, 78);
      for (let k = 0; k < N; k++) { g.beginPath(); g.arc(w / 2 + (k - (N - 1) / 2) * 30, 106, 8, 0, 7); g.fillStyle = k < i ? "#ffd27f" : k === i ? "#fff" : "rgba(255,255,255,.3)"; g.fill(); }
      const { l, s } = fit(g, QS[i].q, w - 120, h - 170, 70, 34);
      g.fillStyle = "#fff"; g.font = `700 ${s}px Sora, sans-serif`; g.textBaseline = "middle";
      l.forEach((t, k) => g.fillText(t, w / 2, 134 + (h - 150) / 2 + (k - (l.length - 1) / 2) * s * 1.18));
    });
  }
  function drawAnswer(side, state, hot = 0) {
    const text = QS[qi].a[side];
    aCard[side].draw((g, w, h) => {
      const colors = state === "ok" ? GREEN : state === "bad" ? RED : hot > 0.5 ? GOLD : DARK;
      panel(g, w, h, colors, state ? "#fff" : hot > 0.5 ? "#fff3d6" : "rgba(210,184,255,.8)", state === "ok" ? "rgba(71,226,154,.9)" : hot > 0.5 ? "rgba(255,190,85,.9)" : null);
      const dark = colors === GOLD;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = dark ? "#5a2a00" : "#ffd27f"; g.font = "800 44px Sora, sans-serif";
      g.fillText(state === "ok" ? "✓" : state === "bad" ? "✕" : side === 0 ? "◀" : "▶", side === 0 ? 70 : w - 70, h / 2);
      const { l, s } = fit(g, text, w - 190, h - 70, 64, 28);
      g.fillStyle = dark ? "#2b1300" : "#fff"; g.font = `700 ${s}px Sora, sans-serif`;
      l.forEach((t, k) => g.fillText(t, w / 2 + (side === 0 ? 30 : -30), h / 2 + (k - (l.length - 1) / 2) * s * 1.15));
    });
  }
  function drawBig(title, sub, colors = PURPLE, size = 230) {
    big.draw((g, w, h) => {
      panel(g, w, h, colors, "#fff", colors === GOLD ? "rgba(255,190,85,.95)" : "rgba(139,63,214,.9)");
      const dark = colors === GOLD;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = dark ? "#2b1300" : "#fff"; g.font = `800 ${size}px Sora, sans-serif`; g.fillText(title, w / 2, sub ? h / 2 - 50 : h / 2 + 6);
      if (sub) { const { l, s } = fit(g, sub, w - 120, 140, 64, 30); g.font = `700 ${s}px Sora, sans-serif`; g.fillStyle = dark ? "#5a2a00" : "#ffe0a3"; l.forEach((t, k) => g.fillText(t, w / 2, h - 110 + (k - (l.length - 1) / 2) * s * 1.1)); }
    });
  }
  function drawStar(c, on) { c.draw((g, w, h) => { g.font = "130px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.globalAlpha = on ? 1 : 0.28; g.fillText(on ? "⭐" : "☆", w / 2, h / 2 + 8); }); }
  function drawBar(p) { bar.draw((g, w, h) => { rr(g, 4, 6, w - 8, h - 12, 14); g.fillStyle = "rgba(10,4,22,.6)"; g.fill(); if (p > 0) { rr(g, 4, 6, Math.max(28, (w - 8) * p), h - 12, 14); g.fillStyle = p > 0.3 ? "#ffbe55" : "#ff5f7a"; g.fill(); } }); }

  // ---------- confetti ----------
  const CONF = ["#ffbe55", "#d2b8ff", "#8b3fd6", "#47e29a", "#ff7bb0", "#ffffff"];
  const confGeo = new THREE.PlaneGeometry(1, 0.55), confetti = [];
  for (let i = 0; i < 140; i++) {
    const m = new THREE.Mesh(confGeo, new THREE.MeshBasicMaterial({ color: CONF[i % CONF.length], side: THREE.DoubleSide, transparent: true, depthTest: false, toneMapped: false }));
    m.renderOrder = 9; m.visible = false; hud.add(m); confetti.push({ m, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), spin: new THREE.Vector3() });
  }
  let ci = 0;
  function burst(at, n, spread, up) {   // at: world position · spread: world size of the burst
    for (let i = 0; i < n; i++) {
      const c = confetti[ci++ % confetti.length];
      c.life = 1.6 + Math.random(); c.p.copy(at); c.size = spread * (0.08 + Math.random() * 0.06);
      c.v.set((Math.random() - 0.5) * spread * 3.2, (up ? 1.2 + Math.random() * 1.6 : Math.random() * 0.6) * spread, (Math.random() - 0.5) * spread);
      c.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12); c.m.visible = true;
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
  // u, v: -1…1 across the visible screen → a point in the scene at the face's distance
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
    tilt += (-ang - tilt) * Math.min(1, dt * 14);
  }
  const tmp = new THREE.Vector3();
  function put(card, u, v, wf, extra = 0) {   // wf: width as a part of the visible width
    const w = wf * visW() * Math.max(0, card.s) * (1 + extra);
    at(u, v, card.mesh.position);
    if (card.shake > 0) card.mesh.position.add(tmp.set(Math.sin(clockT * 70) * card.shake * 0.04 * visW(), 0, 0));
    card.mesh.scale.setScalar(Math.max(1e-4, w)); card.mesh.quaternion.copy(camera.quaternion); card.mesh.visible = card.s > 0.02;
  }
  const qHeight = wf => wf * qCard.ratio * (W / H) * 2;   // a card's height in v units

  // ---------- the game ----------
  const hint = Object.assign(document.createElement("div"), { id: "tvHint" });
  const again = Object.assign(document.createElement("button"), { id: "tvAgain", type: "button", textContent: "Jugar otra vez", hidden: true });
  document.body.append(hint, again);
  const say = t => { hint.textContent = t || ""; hint.classList.toggle("on", !!t); };
  let state = "wait", qi = 0, score = 0, timer = 0, armed = false, phaseT = 0, clockT = 0, picked = -1, hot = [0, 0], lastHot = [-1, -1], shown = 0;
  const go = (s) => { state = s; phaseT = 0; };
  function start() { qi = 0; score = 0; shown = 0; again.hidden = true; stars.forEach(c => c.show(false)); crown.show(false); big.show(false); go("count"); }
  function ask() { big.to = 0; big.s = 0; big.v = 0; drawQuestion(qi); drawAnswer(0, null); drawAnswer(1, null); lastHot = [0, 0]; qCard.show(); aCard[0].show(); aCard[1].show(); timer = TIME; armed = false; picked = -1; go("q"); }
  function answer(side) {
    if (state !== "q") return;
    picked = side; const ok = side === QS[qi].ok; if (ok) score++;
    if (side >= 0) drawAnswer(side, ok ? "ok" : "bad");
    if (!ok) { drawAnswer(QS[qi].ok, "ok"); if (side >= 0) aCard[side].shake = 1; }
    if (ok) { burst(aCard[side].mesh.position, 34, visW() * 0.3, true); plus.s = 0.05; plus.show(); }
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
    // layout follows the head: question above it, answers at both sides of the face, results over it
    const top = Math.min(0.92, headV + 0.06), qW = Math.min(0.9, 0.62 + 0.2 * (1 - faceH));
    const qV = Math.min(0.97 - qHeight(qW) / 2, top + qHeight(qW) / 2), aV = Math.max(-0.75, headV - faceH * 0.55);
    if (state === "wait") {
      say(face ? "" : "Pon tu cara frente a la cámara");
      if (face && phaseT > 0.6) start();
    } else if (state === "count") {
      const n = 3 - Math.floor(phaseT / 0.8);
      if (n !== shown) { shown = n; if (n > 0) { drawBig(String(n), "¡Prepárate!", PURPLE); big.s = 0.3; big.show(); say("Inclina la cabeza hacia la respuesta"); } else if (n === 0) { drawBig("¡YA!", "", GOLD, 200); big.s = 0.3; big.show(); } }
      if (phaseT > 3.0) { big.show(false); say(""); ask(); }
    } else if (state === "q") {
      if (!face) say("Vuelve a poner tu cara frente a la cámara"); else say(qi === 0 && phaseT < 4 ? "◀ Inclina la cabeza para responder ▶" : "");
      if (!armed && Math.abs(tilt) < NEUTRAL && phaseT > 0.7) armed = true;
      for (const side of [0, 1]) {   // the side you lean to lights up and grows
        const lean = side === 0 ? -tilt : tilt, h = armed && face ? Math.min(1, Math.max(0, lean / TILT)) : 0;
        hot[side] += (h - hot[side]) * Math.min(1, dt * 12);
        const lvl = h > 0.5 ? 1 : 0; if (lvl !== lastHot[side]) { lastHot[side] = lvl; drawAnswer(side, null, lvl); }
      }
      if (armed && face) { if (tilt <= -TILT) answer(0); else if (tilt >= TILT) answer(1); }
      if (state === "q" && TIME && face) { timer -= dt; drawBar(Math.max(0, timer / TIME)); bar.show(); if (timer <= 0) answer(-1); }
    } else if (state === "reveal") {
      if (phaseT > 1.6) {
        say(""); plus.show(false); bar.show(false);
        qCard.show(false); aCard[0].show(false); aCard[1].show(false);
        if (phaseT > 1.95) { qi++; if (qi < N) ask(); else { go("end"); shown = -1; } }
      }
    } else if (state === "end") {
      const shownNow = Math.min(score, Math.floor(phaseT / 0.18));   // the score counts up
      if (shownNow !== shown) {
        shown = shownNow; const r = score / N, msg = MSG.find(([p]) => r >= p)[1];
        drawBig(`${shownNow}/${N}`, shownNow === score ? msg : "Respuestas correctas…", score === N ? GOLD : PURPLE, 210); big.show();
        if (shownNow === score) { if (score) burst(big.mesh.position, score === N ? 120 : 60, visW() * 0.6, true); if (score === N) crown.show(); again.hidden = false; }
      }
      stars.forEach((c, k) => { if (phaseT > 0.5 + k * 0.22 && c.to === 0) { drawStar(c, k < score); c.show(); if (k < score) burst(c.mesh.position, 8, visW() * 0.12, true); } });
      if (score && phaseT > 1 && phaseT < 4 && Math.random() < dt * 14) burst(at((Math.random() - 0.5) * 1.8, 1.05), 2, visW() * 0.25, false);   // confetti rain
    }
    // springs and placement
    for (const c of [qCard, ...aCard, big, bar, plus, crown, ...stars]) c.step(dt);
    put(qCard, headU * 0.6, qV, qW);
    put(bar, headU * 0.6, qV - qHeight(qW) / 2 - 0.03, qW * 0.82);
    const float = Math.sin(clockT * 2.4) * 0.012;
    put(aCard[0], -0.52, aV + float, 0.44, hot[0] * 0.18);
    put(aCard[1], 0.52, aV - float, 0.44, hot[1] * 0.18);
    const bigV = Math.min(0.75, headV + 0.2), bigH = 0.78 * big.ratio * (W / H) * 2;
    put(big, headU * 0.6, bigV, 0.78);
    put(crown, headU, Math.min(0.95, headV + 0.08 + Math.sin(clockT * 3) * 0.01), 0.22);
    stars.forEach((c, k) => put(c, headU * 0.6 + (k - (N - 1) / 2) * 0.17, bigV - bigH / 2 - 0.1, 0.15));   // right under the score
    if (picked >= 0 && state === "reveal" && picked === QS[qi].ok) put(plus, picked === 0 ? -0.52 : 0.52, aV + 0.2 + phaseT * 0.25, 0.22);
    else put(plus, 0, -2, 0.2);
    for (const c of confetti) {
      if (c.life <= 0) continue;
      c.life -= dt; c.v.y -= visW() * 0.9 * dt; c.v.multiplyScalar(1 - dt * 0.6); c.p.addScaledVector(c.v, dt);
      c.m.position.copy(c.p); c.m.rotation.x += c.spin.x * dt; c.m.rotation.y += c.spin.y * dt; c.m.rotation.z += c.spin.z * dt;
      c.m.scale.setScalar(c.size); c.m.material.opacity = Math.min(1, c.life * 2); c.m.visible = c.life > 0;
    }
    renderer.render(scene, camera); capture.afterRender();
  });
}
