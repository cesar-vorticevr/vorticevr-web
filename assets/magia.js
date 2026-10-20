// Vórtice VR "magic": sparkle bursts on every tap or click, a soft sparkle trail behind the mouse,
// and a light sweep across buttons on hover. No sounds, no libraries. One fixed canvas that only
// draws while there are sparkles alive. Nothing runs with "reduce motion".
// Used by the home page and the account pages (not by the AR viewer: the camera needs every frame).
(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const fine = matchMedia("(pointer: fine)").matches;
  const COLORS = ["#ffbe55", "#ffd27f", "#d2b8ff", "#b98cff", "#ffffff"];

  // buttons: a light sweeps across on hover (adds a span so existing ::before/::after stay free)
  const css = document.createElement("style");
  css.textContent = `.vvr-sheen{position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none}
.vvr-sheen::before{content:"";position:absolute;top:-20%;bottom:-20%;width:40%;left:-60%;transform:skewX(-20deg);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);transition:left .7s cubic-bezier(.2,.8,.2,1)}
:is(.btn,.pill,.big,.create):hover>.vvr-sheen::before{left:120%}
#vvr-magic{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000}`;
  document.head.appendChild(css);
  const sheen = root => root.querySelectorAll(".btn,.pill,.big,.create").forEach(b => {
    if (b.querySelector(":scope>.vvr-sheen")) return;
    if (getComputedStyle(b).position === "static") b.style.position = "relative";
    const s = document.createElement("span"); s.className = "vvr-sheen"; s.setAttribute("aria-hidden", "true"); b.appendChild(s);
  });
  const start = () => { sheen(document); new MutationObserver(m => m.forEach(r => r.addedNodes.forEach(n => n.nodeType === 1 && sheen(n.parentNode || n)))).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else addEventListener("DOMContentLoaded", start);

  // sparkles
  const cv = document.createElement("canvas"); cv.id = "vvr-magic"; cv.setAttribute("aria-hidden", "true");
  const x = cv.getContext("2d"); let W = 0, H = 0, dpr = 1, parts = [], rings = [], raf = 0;
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; };
  addEventListener("resize", size); size();
  const ready = () => { if (!cv.isConnected) document.body.appendChild(cv); };
  function star(px, py, r, rot, c, a) {   // four-point sparkle
    x.save(); x.translate(px, py); x.rotate(rot); x.globalAlpha = a; x.fillStyle = c; x.shadowColor = c; x.shadowBlur = r * 3;
    x.beginPath();
    for (let i = 0; i < 8; i++) { const R = i % 2 ? r * .28 : r, t = i * Math.PI / 4; x.lineTo(Math.cos(t) * R, Math.sin(t) * R); }
    x.closePath(); x.fill(); x.restore();
  }
  function frame() {
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    rings = rings.filter(r => (r.t += 1) < r.life);
    for (const r of rings) { const k = r.t / r.life; x.globalAlpha = (1 - k) * .55; x.strokeStyle = r.c; x.lineWidth = 2 * (1 - k) + .5; x.beginPath(); x.arc(r.x, r.y, 6 + k * 46, 0, Math.PI * 2); x.stroke(); }
    parts = parts.filter(p => (p.t += 1) < p.life);
    for (const p of parts) {
      p.vx *= .96; p.vy = p.vy * .96 + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      const k = p.t / p.life, tw = .6 + .4 * Math.sin(p.t * .5 + p.ph);
      star(p.x, p.y, p.r * (1 - k * .6), p.rot, p.c, (1 - k) * tw);
    }
    x.globalAlpha = 1;
    raf = parts.length || rings.length ? requestAnimationFrame(frame) : 0;
  }
  const go = () => { ready(); if (!raf) raf = requestAnimationFrame(frame); };
  const pick = () => COLORS[Math.random() * COLORS.length | 0];
  function burst(px, py) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 4.5;
      parts.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, g: .09, r: 3 + Math.random() * 5, rot: Math.random() * 3, vr: (Math.random() - .5) * .3, c: pick(), t: 0, life: 38 + Math.random() * 26, ph: Math.random() * 6 });
    }
    rings.push({ x: px, y: py, t: 0, life: 26, c: "#ffd27f" });
    if (parts.length > 400) parts.splice(0, parts.length - 400);
    go();
  }
  window.vvrSparkle = burst;   // other scripts can throw sparkles too
  addEventListener("pointerdown", e => { if (e.button === 0 || e.pointerType !== "mouse") burst(e.clientX, e.clientY); }, { passive: true });
  if (fine) {   // trail behind the mouse
    let last = 0;
    addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return; const now = performance.now(); if (now - last < 45) return; last = now;
      parts.push({ x: e.clientX + (Math.random() - .5) * 6, y: e.clientY + (Math.random() - .5) * 6, vx: (Math.random() - .5) * .6, vy: .2 + Math.random() * .5, g: .015, r: 1.6 + Math.random() * 2.4, rot: 0, vr: .05, c: pick(), t: 0, life: 34 + Math.random() * 20, ph: Math.random() * 6 });
      go();
    }, { passive: true });
  }
})();
