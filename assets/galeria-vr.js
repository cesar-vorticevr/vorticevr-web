// Galería 3D in virtual reality (a headset's browser: Meta Quest and others with WebXR), started by assets/galeria.js
// with "Recorrer en realidad virtual". The same room, lights and pieces; only the way you move changes. Hands first
// (no controllers needed); controllers work too (trigger = pinch).
//  · You don't walk for real (César: it's dangerous): you jump. Raise your hand and point at the floor: a lilac arc
//    and a ring show where you'll land; pinch and you appear there (a quick fade, nothing moves you smoothly, so it
//    doesn't make you dizzy). Leaning in or crouching works as in real life. If you walk away from your spot, the view
//    darkens and asks you to stay ("Quédate en tu lugar").
//  · Point at a piece (or the room's text) and pinch: you land in front of it, at the distance that shows it whole,
//    and its card (cédula) floats beside you: title, size, story, Anterior / Siguiente.
//  · The 3D pieces are taken with the hand (pinch near it or from afar with the ray): move it, turn it, tilt it; with
//    both hands, bigger or smaller and turned. Let go while moving and it flies: it falls, bounces and rolls (a small
//    rigid body: gravity, the floor, the walls, the pedestals; in space it falls off the platform and comes back).
//    Out of its place, a glowing "Regresar" floats over its pedestal: pinch it and the piece flies home.
//  · The menu is on your left palm: turn it toward you (controllers: X or Y). Anterior / Siguiente (the tour),
//    girar 45°, Ordenar piezas (everything back home), the rooms and Salir. Tap it with your right index finger.
//  · The hands are subtle translucent hands (no dots, no bones), as in assets/superficie-mr.js.
// Changing rooms or leaving puts every piece back in its place first.
// startVR(session, api) → { tick(dt, t), onBuilt(), end() }; api comes from galeria.js (run → vrApi).
import * as THREE from "three";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), ONE = V(1, 1, 1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const SCALE = [.15, 6];      // how much smaller / bigger a piece can be made (times its size in the room)
const SPOTS = 5;             // reflectors lit in the headset (the room's own light stays): smoother on a Quest
const STAY = [.7, 1.35];     // you've walked away from your spot (m): the view starts darkening … all dark

export function startVR(session, A) {
  const { renderer, scene, camera, sfx } = A;
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType("local-floor");
  const rig = new THREE.Group(); scene.add(rig); rig.add(camera); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
  const tmpM = new THREE.Matrix4(), tmpV = V(), tmpQ = new THREE.Quaternion(), raycaster = new THREE.Raycaster();

  /* ---------- the head and the rig ---------- */
  const head = V(), fwd = V(), right = V();
  function headPose() {
    camera.updateMatrixWorld(true);
    head.setFromMatrixPosition(camera.matrixWorld);
    fwd.set(0, 0, -1).transformDirection(camera.matrixWorld); fwd.y = 0; if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1); fwd.normalize();
    right.set(-fwd.z, 0, fwd.x);
  }
  const headYawLocal = () => new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ").y;
  let anchor = V();   // where your head was (in the rig) when you last landed: walking away from it darkens the view
  // puts your head at x, z of the room, looking toward yaw
  function placeHead(x, z, yaw) {
    const hy = headYawLocal(), ry = yaw - hy, lx = camera.position.x, lz = camera.position.z;
    rig.rotation.set(0, ry, 0);
    rig.position.set(x - (Math.cos(ry) * lx + Math.sin(ry) * lz), 0, z - (-Math.sin(ry) * lx + Math.cos(ry) * lz));
    rig.updateMatrixWorld(true);
    anchor.set(lx, 0, lz);
  }

  /* ---------- fading ---------- */
  const fadeMat = new THREE.MeshBasicMaterial({ color: 0x05020b, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false });
  const fadeMesh = new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 8), fadeMat); fadeMesh.renderOrder = 1000; fadeMesh.frustumCulled = false; camera.add(fadeMesh);
  let fadeK = 0, fadeTo = 0, fadeRes = null, walkK = 0;
  const fade = (to, ms = 140) => new Promise(r => { fadeTo = to; fadeSpeed = 1000 / ms; fadeRes = r; });
  let fadeSpeed = 7;
  let busy = false;   // a jump or a room change is on its way
  async function jump(x, z, yaw, then) {
    if (busy) return; busy = true;
    sfx.whoosh(.3); await fade(1, 120);
    placeHead(x, z, yaw); if (then) then();
    await fade(0, 220); busy = false;
  }

  /* ---------- canvas panels (menu, card, hints) ---------- */
  function panel(W, H, widthM, draw, buttons = () => []) {
    const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
    mesh.renderOrder = 1001; mesh.visible = false; mesh.scale.set(widthM, widthM * H / W, 1);
    const p = { mesh, g, c, hov: null, W, H, widthM,
      resize(h) { if (h === c.height) return; c.height = p.H = h; mesh.scale.set(widthM, widthM * h / W, 1); },
      redraw() { g.clearRect(0, 0, c.width, c.height); draw(g, p); tex.needsUpdate = true; },
      at(uv) { if (!uv) return null; const x = uv.x * W, y = (1 - uv.y) * p.H; const b = buttons().find(b => !b.off && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); return b ? b.k : null; },
      hover(k) { if (k !== p.hov) { p.hov = k; p.redraw(); } },
    };
    return p;
  }
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  const lines = (g, text, font, maxW, max) => {
    g.font = font; const out = [];
    for (const para of String(text || "").split(/\n+/)) {
      let line = "";
      for (const w of para.split(/\s+/)) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
      if (line) out.push(line);
    }
    if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/\s*\S*$/, "") + "…"; }
    return out;
  };
  const btn = (g, p, b, label, kind) => {
    rr(g, b.x, b.y, b.w, b.h, b.h / 2);
    const on = p.hov === b.k;
    g.fillStyle = b.off ? "rgba(255,255,255,.05)" : kind === "exit" ? (on ? "#e5243b" : "rgba(229,36,59,.3)") : kind === "gold" ? (on ? "#ffd27f" : "#ffbe55") : on ? "#8b3fd6" : "rgba(255,255,255,.13)";
    g.fill();
    g.fillStyle = b.off ? "rgba(255,255,255,.3)" : kind === "gold" ? "#1b0f00" : "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "700 38px Sora, system-ui, sans-serif"; g.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 2);
  };

  // ---- the menu, on the left palm ----
  const MB = [
    { k: "prev", x: 40, y: 150, w: 462, h: 110 }, { k: "next", x: 522, y: 150, w: 462, h: 110 },
    { k: "turnL", x: 40, y: 280, w: 300, h: 110 }, { k: "tidy", x: 360, y: 280, w: 304, h: 110 }, { k: "turnR", x: 684, y: 280, w: 300, h: 110 },
    { k: "salaP", x: 40, y: 410, w: 300, h: 110 }, { k: "salaN", x: 360, y: 410, w: 304, h: 110 }, { k: "exit", x: 684, y: 410, w: 300, h: 110 },
  ];
  const menu = panel(1024, 560, .3, (g, p) => {
    rr(g, 4, 4, 1016, 552, 50); g.fillStyle = "rgba(14,6,30,.9)"; g.fill(); g.lineWidth = 3; g.strokeStyle = "rgba(210,184,255,.45)"; g.stroke();
    g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = "#ffbe55"; g.font = "700 40px Sora, system-ui, sans-serif";
    let t = A.title(); while (g.measureText(t).width > 620 && t.length > 4) t = t.slice(0, -2) + "…"; g.fillText(t, 44, 62);
    const n = A.salas().length; g.textAlign = "right"; g.fillStyle = "#d9ccf5"; g.font = "600 32px Sora, system-ui, sans-serif";
    g.fillText(n > 1 ? `Sala ${A.salaI + 1} de ${n}` : "Menú", 980, 62);
    const moved = [...pcs.values()].some(q => q.state !== "home");
    for (const b of MB) b.off = (b.k === "salaP" && A.salaI === 0) || (b.k === "salaN" && A.salaI >= n - 1) || (b.k === "tidy" && !moved) || ((b.k === "prev" || b.k === "next") && !A.order().length && n < 2);
    const lab = { prev: "◀  Anterior", next: focusKey === null ? "Iniciar recorrido  ▶" : "Siguiente  ▶", turnL: "⟲  Girar", tidy: "Ordenar piezas", turnR: "Girar  ⟳", salaP: "‹  Sala", salaN: "Sala  ›", exit: "Salir" };
    for (const b of MB) btn(g, p, b, lab[b.k], b.k === "exit" ? "exit" : b.k === "next" ? "gold" : "");
  }, () => MB);
  scene.add(menu.mesh);

  // ---- the card of the piece you're looking at ----
  let focusKey = null;
  const CB = [{ k: "cprev", x: 40, w: 330, h: 100 }, { k: "cnext", x: 390, w: 470, h: 100 }, { k: "close", x: 880, w: 104, h: 100 }];
  const card = panel(1024, 600, .62, (g, p) => {
    const I = focusKey === null ? null : A.info(focusKey); if (!I) return;
    const list = A.order(), n = A.salas().length;
    const title = lines(g, I.t, "700 58px Sora, system-ui, sans-serif", 940, 2);
    const body = lines(g, I.d, `400 ${I.txt ? 33 : 36}px 'IBM Plex Sans', system-ui, sans-serif`, 940, I.txt ? 24 : 12);
    const lh = I.txt ? 46 : 50, h = 60 + 46 + title.length * 68 + (I.s ? 54 : 0) + (body.length ? 16 + body.length * lh : 0) + 40 + 100 + 40;
    p.resize(Math.max(360, Math.ceil(h)));
    rr(g, 4, 4, 1016, p.H - 8, 50); g.fillStyle = "rgba(250,248,243,.97)"; g.fill();
    g.textAlign = "left"; g.textBaseline = "top"; let y = 56;
    g.fillStyle = "#7a2fc4"; g.font = "600 30px 'IBM Plex Mono', monospace";
    const at = list.indexOf(focusKey); g.fillText(`${at + 1} DE ${list.length}${n > 1 ? `  ·  SALA ${A.salaI + 1}` : ""}`, 44, y); y += 46;
    g.fillStyle = "#15101f"; g.font = "700 58px Sora, system-ui, sans-serif"; for (const l of title) { g.fillText(l, 44, y); y += 68; }
    if (I.s) { g.fillStyle = "#b8780f"; g.font = "500 34px 'IBM Plex Mono', monospace"; g.fillText(I.s, 44, y + 6); y += 54; }
    if (body.length) { y += 16; g.fillStyle = "#3a3248"; g.font = `400 ${I.txt ? 33 : 36}px 'IBM Plex Sans', system-ui, sans-serif`; for (const l of body) { g.fillText(l, 44, y); y += lh; } }
    const by = p.H - 140; for (const b of CB) b.y = by;
    // the buttons on the light card: purple
    for (const b of CB) {
      rr(g, b.x, b.y, b.w, b.h, 50); const on = p.hov === b.k;
      g.fillStyle = b.k === "cnext" ? (on ? "#a35ce8" : "#8b3fd6") : on ? "rgba(139,63,214,.3)" : "rgba(139,63,214,.12)"; g.fill();
      g.fillStyle = b.k === "cnext" ? "#fff" : "#5a2596"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "700 36px Sora, system-ui, sans-serif";
      g.fillText(b.k === "cprev" ? "◀  Anterior" : b.k === "cnext" ? "Siguiente  ▶" : "✕", b.x + b.w / 2, b.y + b.h / 2 + 2);
    }
  }, () => CB);
  scene.add(card.mesh);
  function showCard(key) {
    focusKey = key; card.hov = null;
    if (key === null) { card.mesh.visible = false; menu.redraw(); return; }
    card.redraw(); headPose();
    // to your right, a little lower than your eyes, facing you
    card.mesh.position.copy(head).addScaledVector(fwd, .8).addScaledVector(right, .5); card.mesh.position.y = head.y - .18;
    card.mesh.lookAt(head); card.mesh.visible = true; menu.redraw();
  }

  // ---- a message in front of you (welcome, "stay in your spot", the room's name) ----
  const msg = panel(1024, 300, .6, (g, p) => {
    rr(g, 4, 4, 1016, 292, 50); g.fillStyle = "rgba(14,6,30,.9)"; g.fill(); g.lineWidth = 3; g.strokeStyle = "rgba(255,190,85,.55)"; g.stroke();
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#ffbe55"; g.font = "700 46px Sora, system-ui, sans-serif"; g.fillText(p.t1 || "", 512, 92);
    g.fillStyle = "#efe6ff"; g.font = "500 32px 'IBM Plex Sans', system-ui, sans-serif";
    (p.t2 || []).forEach((l, i) => g.fillText(l, 512, 158 + i * 46));
  });
  msg.mesh.position.set(0, -.05, -.9); camera.add(msg.mesh);
  let msgT = 0, msgWalk = false;
  const say = (t1, t2, sec = 5) => { msg.t1 = t1; msg.t2 = t2; msg.redraw(); msg.mesh.visible = true; msgT = sec; };

  /* ---------- hands and controllers ---------- */
  const srcs = [0, 1].map(i => {
    const ray = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i), hand = renderer.xr.getHand(i);
    rig.add(ray, grip, hand);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(), V(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xd2b8ff, transparent: true, opacity: .6 }));
    line.visible = false; ray.add(line);
    const s = { i, ray, grip, hand, line, input: null, aim: null, grab: null, menuHand: false, poke: false, pokeT: 0, btnDown: false };
    ray.addEventListener("connected", e => { s.input = e.data; });
    ray.addEventListener("disconnected", () => { drop(s); s.input = null; });
    ray.addEventListener("selectstart", () => press(s));
    ray.addEventListener("selectend", () => drop(s));
    ray.addEventListener("squeezestart", () => { if (!isHand(s)) press(s, true); });
    ray.addEventListener("squeezeend", () => { if (!isHand(s)) drop(s); });
    return s;
  });
  const isHand = s => !!(s.input && s.input.hand);
  const side = s => s.input && s.input.handedness;
  hands(srcs).catch(e => console.warn(e));
  const pulse = (s, k = .4, ms = 40) => { try { const h = s.input && s.input.gamepad && s.input.gamepad.hapticActuators; h && h[0] && h[0].pulse(k, ms); } catch (e) {} };
  const joint = (s, n) => { const j = s.hand.joints && s.hand.joints[n]; return j && j.visible ? j : null; };
  // the pose that holds a piece: for a hand, the pinch point with the wrist's turn; for a controller, its grip
  function poseOf(s, out) {
    if (isHand(s)) {
      const w = joint(s, "wrist"), th = joint(s, "thumb-tip"), ix = joint(s, "index-finger-tip"); if (!w || !th || !ix) return false;
      th.getWorldPosition(tmpV); ix.getWorldPosition(V2); tmpV.add(V2).multiplyScalar(.5); w.getWorldQuaternion(tmpQ);
      out.compose(tmpV, tmpQ, ONE); return true;
    }
    const g = s.grip.visible ? s.grip : s.ray.visible ? s.ray : null; if (!g) return false;
    g.updateMatrixWorld(true); out.copy(g.matrixWorld); return true;
  }
  const V2 = V();
  const pointOf = (s, out) => { if (!poseOf(s, M2)) return false; out.setFromMatrixPosition(M2); return true; };
  const M2 = new THREE.Matrix4();

  /* ---------- the pieces the hands take ---------- */
  const pcs = new Map();   // key → { P, obj, home: {parent, pos, quat, scale}, box (local), state: home | held | free | back, body, hands: [], ghost }
  const ghostTex = (() => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 300; const g = c.getContext("2d");
    rr(g, 6, 6, 500, 288, 60); g.fillStyle = "rgba(20,8,40,.82)"; g.fill(); g.lineWidth = 6; g.strokeStyle = "#ffbe55"; g.stroke();
    g.strokeStyle = "#ffbe55"; g.lineWidth = 14; g.lineCap = "round"; g.beginPath(); g.arc(256, 118, 56, -.3, Math.PI * 1.55); g.stroke();
    g.fillStyle = "#ffbe55"; g.beginPath(); g.moveTo(318, 82); g.lineTo(330, 140); g.lineTo(280, 116); g.fill();
    g.fillStyle = "#fff"; g.font = "700 52px Sora, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Regresar", 256, 236);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  function localBox(obj) {   // the piece's box in its own coordinates
    obj.updateMatrixWorld(true); const inv = obj.matrixWorld.clone().invert(), b = new THREE.Box3(), m = new THREE.Matrix4();
    obj.traverse(x => { if (x.isMesh && x.geometry) { if (!x.geometry.boundingBox) x.geometry.computeBoundingBox(); m.multiplyMatrices(inv, x.matrixWorld); b.union(x.geometry.boundingBox.clone().applyMatrix4(m)); } });
    if (b.isEmpty()) b.setFromCenterAndSize(V(0, .15, 0), V(.3, .3, .3));
    return b;
  }
  let targets = [], spotsOff = [];
  function onBuilt() {
    for (const q of pcs.values()) if (q.ghost) { scene.remove(q.ghost); q.ghost.geometry.dispose(); q.ghost.material.dispose(); }
    pcs.clear();
    for (const [key, P] of A.placed) if (P.model && P.obj) pcs.set(key, { key, P, obj: P.obj, home: null, box: localBox(P.obj), state: "home", body: null, hands: [], ghost: null });
    // what a ray can point at: the pieces' tagged meshes and the portal, except the 3D (those use their boxes)
    const modelMeshes = new Set(); for (const q of pcs.values()) q.obj.traverse(x => modelMeshes.add(x));
    targets = []; A.pieces.traverse(x => { if (x.isMesh && !modelMeshes.has(x) && (x.userData.obra !== undefined || x.userData.portal !== undefined)) targets.push(x); });
    // a Quest copes with a few reflectors: the first ones stay
    spotsOff = []; let n = 0; A.pieces.traverse(x => { if (x.isSpotLight) { if (n++ >= SPOTS && x.visible) { x.visible = false; spotsOff.push(x); } } });
    buildBounds();
    if (focusKey !== null && !A.placed.has(focusKey)) showCard(null);
    menu.redraw();
  }
  function detach(q) {   // from its pedestal to the room
    if (q.state !== "home") return;
    q.home = { parent: q.obj.parent, pos: q.obj.position.clone(), quat: q.obj.quaternion.clone(), scale: q.obj.scale.clone() };
    const ti = A.turners.indexOf(q.obj); if (ti >= 0) A.turners.splice(ti, 1);
    scene.attach(q.obj);
    if (!q.ghost) {
      q.ghost = new THREE.Mesh(new THREE.PlaneGeometry(.36, .21), new THREE.MeshBasicMaterial({ map: ghostTex, transparent: true, depthWrite: false, toneMapped: false }));
      q.ghost.userData.ghost = q.key; scene.add(q.ghost);
    }
    q.ghost.position.set(q.P.ped.x, q.P.ped.top + .32, q.P.ped.z); q.ghost.visible = true;
  }
  function homeWorld(q) {   // where it goes back to, in the room
    const m = new THREE.Matrix4().compose(q.home.pos, q.home.quat, q.home.scale); q.home.parent.updateMatrixWorld(true);
    return m.premultiply(q.home.parent.matrixWorld);
  }
  function settle(q) {   // back on its pedestal, as it was
    q.home.parent.add(q.obj); q.obj.position.copy(q.home.pos); q.obj.quaternion.copy(q.home.quat); q.obj.scale.copy(q.home.scale);
    if (q.P.gira && !A.turners.includes(q.obj)) A.turners.push(q.obj);
    q.state = "home"; q.body = null; q.hands = []; if (q.ghost) q.ghost.visible = false;
  }
  function sendHome(q) {   // it flies back
    if (q.state === "home" || q.state === "back") return;
    for (const s of q.hands) s.grab = null;
    q.hands = []; q.body = null; q.state = "back";
    const to = new THREE.Matrix4(); to.copy(homeWorld(q));
    const p1 = V(), r1 = new THREE.Quaternion(), s1 = V(); to.decompose(p1, r1, s1);
    q.back = { t: 0, p0: q.obj.position.clone(), r0: q.obj.quaternion.clone(), s0: q.obj.scale.x, p1, r1, s1: s1.x };
    sfx.appear(); menu.redraw();
  }
  const snapAll = () => { for (const q of pcs.values()) if (q.state !== "home") settle(q); };
  const tidyAll = () => { let n = 0; for (const q of pcs.values()) if (q.state !== "home") { sendHome(q); n++; } return n; };

  // ---- taking and letting go ----
  function hitModel(q, ray) {   // the ray against the piece's box: the distance or null
    q.obj.updateMatrixWorld(true); const inv = q.obj.matrixWorld.clone().invert();
    const r = ray.clone().applyMatrix4(inv), p = r.intersectBox(q.box, V()); if (!p) return null;
    return p.applyMatrix4(q.obj.matrixWorld).distanceTo(ray.origin);
  }
  function nearModel(s) {   // the hand touching a piece
    if (!pointOf(s, tmpV)) return null;
    let best = null, bd = Infinity;
    for (const q of pcs.values()) {
      if (q.state === "back") continue;
      q.obj.updateMatrixWorld(true); const p = tmpV.clone().applyMatrix4(q.obj.matrixWorld.clone().invert());
      const pad = .06 / Math.max(.05, q.obj.scale.x), b = q.box.clone().expandByScalar(pad);
      if (b.containsPoint(p)) { const d = p.distanceTo(b.getCenter(V())); if (d < bd) { bd = d; best = q; } }
    }
    return best;
  }
  function press(s, squeeze) {
    if (s.grab || busy) return;
    if (s.menuHand) return;                      // the palm is showing the menu
    const near = nearModel(s);
    if (near) return take(s, near);
    const a = squeeze ? null : s.aim; if (!a) return;
    pulse(s, .3, 30);
    if (a.what === "menu") return menuAct(a.k);
    if (a.what === "card") return cardAct(a.k);
    if (a.what === "model") return take(s, a.q);
    if (a.what === "ghost") return sendHome(pcs.get(a.key));
    if (a.what === "portal") return goSala(a.next);
    if (a.what === "obra") return goPiece(a.key);
    if (a.what === "floor") { const [x, z] = a.p; return jump(x, z, rigYaw() + headYawLocal(), () => { if (focusKey !== null) showCard(null); }); }
  }
  const rigYaw = () => rig.rotation.y;
  function take(s, q) {
    if (q.state === "back") return;
    detach(q); q.state = "held"; q.body = null;
    s.grab = { q, off: new THREE.Matrix4() }; if (!q.hands.includes(s)) q.hands.push(s);
    q.hist = [];
    if (!q.target) q.target = { pos: V(), quat: new THREE.Quaternion(), scale: 1 };
    q.target.pos.copy(q.obj.position); q.target.quat.copy(q.obj.quaternion); q.target.scale = q.obj.scale.x;
    regrab(q); sfx.pop(); pulse(s, .5, 50); menu.redraw();
    if (!tookOnce) { tookOnce = true; say("¡La tienes!", ["Muévela y gírala con tu mano · con las dos, más grande o más chica", "Suéltala con impulso y sale volando"], 6); }
  }
  let tookOnce = false;
  function drop(s) {
    const gq = s.grab; if (!gq) return;
    const q = gq.q; s.grab = null; q.hands = q.hands.filter(x => x !== s);
    if (q.hands.length) { regrab(q); return; }
    // let go: it keeps the speed of the hand (a throw), then the physics takes it
    q.state = "free"; q.body = makeBody(q);
    const h = q.hist, now = performance.now(), old = h.find(e => now - e.t <= 110) || h[0];
    if (old && now - old.t > 8) {
      const dt = (now - old.t) / 1000;
      q.body.v.copy(q.obj.position).sub(old.p).divideScalar(dt);
      if (q.body.v.length() > 12) q.body.v.setLength(12);
      const dq = q.obj.quaternion.clone().multiply(old.q.clone().invert()); if (dq.w < 0) { dq.x *= -1; dq.y *= -1; dq.z *= -1; dq.w *= -1; }
      const ang = 2 * Math.acos(clamp(dq.w, -1, 1)), sn = Math.sqrt(Math.max(1e-9, 1 - dq.w * dq.w));
      if (ang > 1e-3) q.body.w.set(dq.x / sn, dq.y / sn, dq.z / sn).multiplyScalar(Math.min(ang / dt, 18));
      if (q.body.v.length() > 1.2) sfx.swoosh();
    }
    menu.redraw();
  }
  // whenever the hands that hold a piece change, each one starts again from where it is now
  function regrab(q) {
    const hm = new THREE.Matrix4().compose(q.target.pos, q.target.quat, V(q.target.scale, q.target.scale, q.target.scale));
    for (const s of q.hands) if (poseOf(s, tmpM)) s.grab.off.copy(tmpM).invert().multiply(hm);
    q.two = null;
    if (q.hands.length === 2) {
      const a = V(), b = V();
      if (pointOf(q.hands[0], a) && pointOf(q.hands[1], b)) q.two = { d: Math.max(.02, a.distanceTo(b)), ang: Math.atan2(b.x - a.x, b.z - a.z), mid: a.clone().add(b).multiplyScalar(.5), pos: q.target.pos.clone(), quat: q.target.quat.clone(), scale: q.target.scale };
    }
  }
  function follow(q, dt) {
    const T = q.target;
    if (q.hands.length === 1) {
      if (poseOf(q.hands[0], tmpM)) { tmpM.multiply(q.hands[0].grab.off); tmpM.decompose(T.pos, T.quat, tmpV); }
    } else if (q.hands.length === 2 && q.two) {
      const a = V(), b = V(); if (!pointOf(q.hands[0], a) || !pointOf(q.hands[1], b)) return;
      const base = q.home.scale.x, sc = clamp(q.two.scale * a.distanceTo(b) / q.two.d, base * SCALE[0], base * SCALE[1]), k = sc / q.two.scale;
      const rq = new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(b.x - a.x, b.z - a.z) - q.two.ang);
      T.scale = sc; T.quat.copy(rq).multiply(q.two.quat);
      T.pos.copy(q.two.pos).sub(q.two.mid).multiplyScalar(k).applyQuaternion(rq).add(a.add(b).multiplyScalar(.5));
      const step = Math.round(Math.log(sc / base) / Math.log(1.15)); if (step !== q.tick) { q.tick = step; sfx.tick(.6); q.hands.forEach(s => pulse(s, .15, 15)); }
    }
    const k = 1 - Math.exp(-dt * 22);   // smooths the trembling of the hands
    q.obj.position.lerp(T.pos, k); q.obj.quaternion.slerp(T.quat, k); const s = q.obj.scale.x + (T.scale - q.obj.scale.x) * k; q.obj.scale.setScalar(s);
    const now = performance.now(); q.hist.push({ t: now, p: q.obj.position.clone(), q: q.obj.quaternion.clone() }); while (q.hist.length > 12) q.hist.shift();
  }

  /* ---------- a small rigid body: gravity, floor, walls, pedestals ---------- */
  let planes = [], boxes = [], floorDisc = 0, ceil = 6;
  function buildBounds() {
    const S = A.spec; planes = []; boxes = [];
    ceil = S.H || 6;
    if (S.tipo === "espacio") floorDisc = S.R + 2.4;   // in space the platform ends: beyond it, it falls
    else { floorDisc = 0; planes.push({ n: V(1, 0, 0), d: -S.hw }, { n: V(-1, 0, 0), d: -S.hw }, { n: V(0, 0, 1), d: -S.hd }, { n: V(0, 0, -1), d: -S.hd }, { n: V(0, -1, 0), d: -ceil }); }
    for (const q of pcs.values()) { const p = q.P.ped; if (p.hw > 0) boxes.push({ min: V(p.x - p.hw, -1, p.z - p.hw), max: V(p.x + p.hw, p.top, p.z + p.hw) }); }
    for (const w of S.walls || []) boxes.push({ min: V(Math.min(w.x1, w.x2) - w.r, -1, Math.min(w.z1, w.z2) - w.r), max: V(Math.max(w.x1, w.x2) + w.r, 5.6, Math.max(w.z1, w.z2) + w.r) });
  }
  function makeBody(q) {
    const c = q.box.getCenter(V()), half = q.box.getSize(V()).multiplyScalar(.5);
    const corners = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push(V(sx * half.x, sy * half.y, sz * half.z));
    const b = { c, half, corners, v: V(), w: V(), x: V(), rest: 0, sleep: false };
    q.obj.updateMatrixWorld(true); b.x.copy(c).applyMatrix4(q.obj.matrixWorld);
    return b;
  }
  const Rm = new THREE.Matrix3(), Rt = new THREE.Matrix3(), Iw = new THREE.Matrix3(), D = new THREE.Matrix3(), M4 = new THREE.Matrix4();
  const r = V(), pw = V(), vr = V(), rn = V(), t1 = V(), tv = V();
  function contact(b, rr2, n, e) {
    vr.copy(b.w).cross(rr2).add(b.v); const vn = vr.dot(n); if (vn >= 0) return 0;
    rn.copy(rr2).cross(n); tv.copy(rn).applyMatrix3(Iw).cross(rr2);
    const j = -(1 + (vn < -.9 ? e : 0)) * vn / (1 + n.dot(tv));
    b.v.addScaledVector(n, j); b.w.add(tv.copy(rn).applyMatrix3(Iw).multiplyScalar(j));
    vr.copy(b.w).cross(rr2).add(b.v); t1.copy(vr).addScaledVector(n, -vr.dot(n)); const vt = t1.length();
    if (vt > 1e-4) {   // friction
      t1.divideScalar(vt); rn.copy(rr2).cross(t1); tv.copy(rn).applyMatrix3(Iw).cross(rr2);
      const jt = Math.max(-vt / (1 + t1.dot(tv)), -.6 * j);
      b.v.addScaledVector(t1, jt); b.w.add(tv.copy(rn).applyMatrix3(Iw).multiplyScalar(jt));
    }
    return -vn;
  }
  function stepBody(q, h) {
    const b = q.body, o = q.obj, s = o.scale.x;
    b.v.y -= 9.8 * h;
    b.x.addScaledVector(b.v, h);
    const wq = new THREE.Quaternion(b.w.x, b.w.y, b.w.z, 0).multiply(o.quaternion);
    o.quaternion.set(o.quaternion.x + wq.x * h * .5, o.quaternion.y + wq.y * h * .5, o.quaternion.z + wq.z * h * .5, o.quaternion.w + wq.w * h * .5).normalize();
    b.v.multiplyScalar(1 - .05 * h); b.w.multiplyScalar(1 - .4 * h);
    // inertia of a box of mass 1, in the room's axes
    const X = 2 * b.half.x * s, Y = 2 * b.half.y * s, Z = 2 * b.half.z * s;
    D.set(12 / Math.max(1e-4, Y * Y + Z * Z), 0, 0, 0, 12 / Math.max(1e-4, X * X + Z * Z), 0, 0, 0, 12 / Math.max(1e-4, X * X + Y * Y));
    M4.makeRotationFromQuaternion(o.quaternion); Rm.setFromMatrix4(M4); Rt.copy(Rm).transpose(); Iw.multiplyMatrices(Rm, D).multiply(Rt);
    let hit = 0;
    const solve = (n, d, test) => {   // a plane n·p ≥ d
      let deep = 0;
      for (const k of b.corners) {
        r.copy(k).multiplyScalar(s).applyMatrix3(Rm); pw.copy(b.x).add(r);
        if (test && !test(pw)) continue;
        const pen = d - n.dot(pw); if (pen > 0) { deep = Math.max(deep, pen); hit = Math.max(hit, contact(b, r, n, .3)); }
      }
      if (deep > 0) b.x.addScaledVector(n, deep);
    };
    // the floor (in space only on the platform), walls and ceiling
    solve(UP, 0, floorDisc ? p => p.x * p.x + p.z * p.z < floorDisc * floorDisc && p.y > -.4 : null);
    for (const P of planes) solve(P.n, P.d);
    for (const B of boxes) {   // pedestals and free-standing walls: pushed out through the nearest face
      for (const k of b.corners) {
        r.copy(k).multiplyScalar(s).applyMatrix3(Rm); pw.copy(b.x).add(r);
        if (pw.x <= B.min.x || pw.x >= B.max.x || pw.y >= B.max.y || pw.z <= B.min.z || pw.z >= B.max.z) continue;
        const f = [[pw.x - B.min.x, V(-1, 0, 0)], [B.max.x - pw.x, V(1, 0, 0)], [B.max.y - pw.y, V(0, 1, 0)], [pw.z - B.min.z, V(0, 0, -1)], [B.max.z - pw.z, V(0, 0, 1)]].sort((a, b2) => a[0] - b2[0])[0];
        hit = Math.max(hit, contact(b, r, f[1], .3)); b.x.addScaledVector(f[1], f[0]);
      }
    }
    o.position.copy(b.c).multiplyScalar(s).applyMatrix3(Rm).negate().add(b.x);
    return hit;
  }
  function physics(q, dt) {
    const b = q.body; if (!b || b.sleep) return;
    let hit = 0; const n = 6; for (let i = 0; i < n; i++) hit = Math.max(hit, stepBody(q, dt / n));
    if (hit > 1.6) { sfx.tick(clamp(hit / 4, .4, 1)); }
    if (b.v.length() < .06 && b.w.length() < .2) { if ((b.rest += dt) > .5) { b.sleep = true; b.v.set(0, 0, 0); b.w.set(0, 0, 0); } } else b.rest = 0;
    if (b.x.y < -12 || b.x.length() > 90) sendHome(q);   // it fell off (space) or flew too far: it comes back
  }

  /* ---------- pointing ---------- */
  const arcN = 22;
  const arc = new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd2b8ff, transparent: true, opacity: .85, toneMapped: false }), arcN * 2);
  arc.frustumCulled = false; arc.count = 0; scene.add(arc);
  const ringM = new THREE.MeshBasicMaterial({ color: 0xd2b8ff, transparent: true, opacity: .9, depthWrite: false, toneMapped: false });
  const landing = [0, 1].map(() => {
    const g = new THREE.Group(), ring = new THREE.Mesh(new THREE.RingGeometry(.2, .26, 40), ringM); ring.rotation.x = -Math.PI / 2; g.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(.07, 24), ringM); dot.rotation.x = -Math.PI / 2; g.add(dot); g.visible = false; scene.add(g); return g;
  });
  const hl = new THREE.Box3Helper(new THREE.Box3(), 0xffbe55); hl.material.depthTest = false; hl.material.transparent = true; hl.material.opacity = .7; hl.renderOrder = 999; hl.visible = false; scene.add(hl);
  const dummy = new THREE.Object3D();
  function aimOf(s, arcAt) {
    if (s.grab || s.menuHand || !s.ray.visible) return null;
    s.ray.updateMatrixWorld(true);
    const o = V().setFromMatrixPosition(s.ray.matrixWorld), d = V(0, 0, -1).transformDirection(s.ray.matrixWorld);
    // a hand only points when it's raised (a hand resting at your side doesn't): controllers always
    if (isHand(s) && o.y < head.y - .6) return null;
    raycaster.ray.set(o, d); raycaster.far = 40;
    let best = null;
    const consider = (what, dist, extra) => { if (!best || dist < best.d) best = Object.assign({ what, d: dist }, extra); };
    for (const [p, what] of [[menu, "menu"], [card, "card"]]) if (p.mesh.visible) { const h = raycaster.intersectObject(p.mesh, false)[0]; if (h) { const k = p.at(h.uv); consider(what, h.distance, { k, uv: h.uv, hard: true }); } }
    if (best) return best;   // the panels are in front of everything
    for (const q of pcs.values()) { if (q.state === "back") continue; const dd = hitModel(q, raycaster.ray); if (dd !== null) consider("model", dd, { q }); }
    for (const q of pcs.values()) if (q.ghost && q.ghost.visible) { const h = raycaster.intersectObject(q.ghost, false)[0]; if (h) consider("ghost", h.distance - .05, { key: q.key }); }
    const h = raycaster.intersectObjects(targets, false)[0];
    if (h) { if (h.object.userData.portal !== undefined) consider("portal", h.distance, { next: h.object.userData.portal }); else consider("obra", h.distance, { key: h.object.userData.obra }); }
    if (best) return best;
    // nothing there: an arc to the floor
    const v0 = d.clone().multiplyScalar(7.5), g = 9.8, a = -.5 * g, bq = v0.y, c = o.y;
    const disc = bq * bq - 4 * a * c; if (disc < 0) return null;
    let T = (-bq - Math.sqrt(disc)) / (2 * a); if (!(T > 0)) return null;
    const land = o.clone().addScaledVector(v0, T); land.y += a * T * T;
    if (Math.hypot(land.x - head.x, land.z - head.z) > 14) return null;
    const [x, z] = A.resolve(land.x, land.z);
    for (let i = 1; i <= arcN; i++) {
      const t = T * i / arcN; dummy.position.copy(o).addScaledVector(v0, t); dummy.position.y += a * t * t;
      if (i === arcN) dummy.position.set(x, .02, z);
      dummy.updateMatrix(); arc.setMatrixAt(arcAt + i - 1, dummy.matrix);
    }
    return { what: "floor", p: [x, z], arc: true };
  }

  /* ---------- the menu on the palm (or the controller's X / Y) ---------- */
  const PALM = V(0, -1, 0);   // the wrist's -Y comes out of the palm
  let menuFree = false;       // controllers: the menu floats in front of you
  function menuPose() {
    const L = srcs.find(s => side(s) === "left" && isHand(s));
    for (const s of srcs) s.menuHand = false;
    if (L) {
      const w = joint(L, "wrist"), mid = joint(L, "middle-finger-metacarpal");
      if (w && mid) {
        const wp = w.getWorldPosition(V()), n = PALM.clone().applyQuaternion(w.getWorldQuaternion(new THREE.Quaternion()));
        const toHead = head.clone().sub(wp).normalize();
        if (n.dot(toHead) > .55 && !L.grab) {
          L.menuHand = true;
          const mp = mid.getWorldPosition(V());
          menu.mesh.position.copy(mp).addScaledVector(n, .07).addScaledVector(UP, .1);
          menu.mesh.lookAt(head); menu.mesh.visible = true; return;
        }
      }
    }
    if (menuFree) {
      if (menu.mesh.position.distanceTo(head) > 1.2 || !menu.mesh.visible) { headPose(); menu.mesh.position.copy(head).addScaledVector(fwd, .55); menu.mesh.position.y = head.y - .2; }
      menu.mesh.lookAt(head); menu.mesh.visible = true; return;
    }
    menu.mesh.visible = false;
  }
  // a fingertip touching a panel's button
  function pokes(dt) {
    for (const s of srcs) {
      s.pokeT = Math.max(0, s.pokeT - dt);
      const tip = isHand(s) ? joint(s, "index-finger-tip") : null; if (!tip || s.menuHand || s.grab) { s.poke = false; continue; }
      const wp = tip.getWorldPosition(V()); let touching = null;
      for (const [p, what] of [[menu, "menu"], [card, "card"]]) {
        if (!p.mesh.visible) continue;
        const l = p.mesh.worldToLocal(wp.clone());
        if (Math.abs(l.z) < .02 / p.mesh.scale.z && Math.abs(l.x) <= .5 && Math.abs(l.y) <= .5) { const k = p.at({ x: l.x + .5, y: l.y + .5 }); if (k) touching = { what, k, p }; }
      }
      if (touching) touching.p.hover(touching.k);
      if (touching && !s.poke && s.pokeT <= 0) { s.pokeT = .45; sfx.tap(); pulse(s, .3, 20); touching.what === "menu" ? menuAct(touching.k) : cardAct(touching.k); }
      s.poke = !!touching;
    }
  }
  function menuAct(k) {
    if (!k) return;
    sfx.tap();
    if (k === "prev") step(-1);
    else if (k === "next") { if (focusKey === null) A.count("tour"); step(1); }
    else if (k === "turnL" || k === "turnR") turn(k === "turnL" ? 1 : -1);
    else if (k === "tidy") { if (!tidyAll()) say("Todo está en su lugar", [], 2); }
    else if (k === "salaP") goSala(A.salaI - 1);
    else if (k === "salaN") goSala(A.salaI + 1);
    else if (k === "exit") session.end();
    menu.redraw();
  }
  function cardAct(k) {
    if (!k) return;
    sfx.tap();
    if (k === "close") showCard(null); else step(k === "cprev" ? -1 : 1);
  }
  function turn(dir) {   // 45° around your head
    if (busy) return;
    headPose(); const a = dir * Math.PI / 4, hx = head.x, hz = head.z;
    rig.rotation.y += a;
    const dx = rig.position.x - hx, dz = rig.position.z - hz, c = Math.cos(a), sn = Math.sin(a);
    rig.position.x = hx + dx * c + dz * sn; rig.position.z = hz - dx * sn + dz * c;
    sfx.swoosh();
  }

  /* ---------- the tour: pieces and rooms ---------- */
  function goPiece(key) {
    const P = A.placed.get(key); if (!P) return;
    headPose();
    // far enough to see it whole (a headset sees wide), a 3D piece from where you are
    let dist = Math.max(P.h * .95, P.w * .9, P.model ? 1.25 : 1.2) + (P.model ? P.w * .45 : 0);
    let nx = P.nx, nz = P.nz;
    if (P.model) { const dx = head.x - P.cx, dz = head.z - P.cz, d = Math.hypot(dx, dz); if (d > .5) { nx = dx / d; nz = dz / d; } }
    const [x, z] = A.resolve(P.cx + nx * dist, P.cz + nz * dist);
    jump(x, z, Math.atan2(-(P.cx - x), -(P.cz - z)), () => showCard(key));
  }
  function step(dir) {
    const list = A.order(), at = focusKey === null ? -1 : list.indexOf(focusKey), n = A.salas().length;
    const k = at < 0 ? (dir > 0 ? 0 : list.length - 1) : at + dir;
    if (k >= list.length && A.salaI < n - 1) return goSala(A.salaI + 1, () => { const l = A.order(); if (l.length) goPiece(l[0]); });
    if (k < 0 && A.salaI > 0) return goSala(A.salaI - 1, () => { const l = A.order(); if (l.length) goPiece(l[l.length - 1]); });
    if (!list.length) return;
    goPiece(list[(k + list.length) % list.length]);
  }
  async function goSala(j, then) {
    if (busy || j < 0 || j >= A.salas().length || j === A.salaI) return;
    busy = true; showCard(null);
    for (const s of srcs) s.grab = null;
    sfx.whoosh(.6); await fade(1, 300);
    snapAll(); await A.goSala(j);
    const S = A.spec; placeHead(S.start.x, S.start.to, 0);
    say(A.salaName(A.sala(), A.salaI), A.sala().nombre ? [`Sala ${A.salaI + 1} de ${A.salas().length}`] : [], 3);
    await fade(0, 400); busy = false; menu.redraw();
    if (then) setTimeout(then, 250);
  }

  /* ---------- the loop ---------- */
  let started = false, frames = 0;
  const P0 = A.player;
  function tick(dt) {
    const frame = renderer.xr.getFrame && renderer.xr.getFrame();
    if (!frame) return;
    rig.updateMatrixWorld(true); headPose();
    if (!started && ++frames > 2) {   // the first pose: you're where you were looking, or at the entrance
      started = true;
      const S = A.spec, inside = Math.hypot(P0.x - S.start.x, P0.z - S.start.z) > .4;
      placeHead(inside ? P0.x : S.start.x, inside ? P0.z : S.start.to, inside ? P0.yaw : 0);
      say("Bienvenido a la galería", ["Apunta al piso y pellizca para ir · pellizca una obra para verla", "Voltea tu mano izquierda: ahí está el menú"], 9);
      sfx.appear();
    }
    // fading: jumps, and walking away from your spot
    if (fadeK !== fadeTo) { fadeK += Math.sign(fadeTo - fadeK) * Math.min(Math.abs(fadeTo - fadeK), dt * fadeSpeed); if (fadeK === fadeTo && fadeRes) { const r2 = fadeRes; fadeRes = null; r2(); } }
    const drift = Math.hypot(camera.position.x - anchor.x, camera.position.z - anchor.z);
    walkK = clamp((drift - STAY[0]) / (STAY[1] - STAY[0]), 0, 1) * .9;
    fadeMat.opacity = Math.max(fadeK, walkK); fadeMesh.visible = fadeMat.opacity > .001;
    if (walkK > .15 && !msgWalk) { msgWalk = true; say("Quédate en tu lugar", ["Para avanzar no camines: apunta al piso y pellizca"], 1e9); }
    else if (walkK < .05 && msgWalk) { msgWalk = false; msgT = 0; }
    if (!msgWalk && msgT > 0 && (msgT -= dt) <= 0) msg.mesh.visible = false;
    if (msgWalk) msg.mesh.visible = true;

    menuPose(); pokes(dt);
    // controllers: X / Y shows the menu, the stick turns
    for (const s of srcs) {
      const gp = s.input && s.input.gamepad; if (!gp || isHand(s)) continue;
      const b = gp.buttons, down = !!((b[4] && b[4].pressed) || (b[5] && b[5].pressed));
      if (down && !s.btnDown && side(s) === "left") { menuFree = !menuFree; sfx.tap(); }
      s.btnDown = down;
      const ax = gp.axes && (gp.axes[2] || 0);
      if (Math.abs(ax) > .7 && !s.stick) { s.stick = true; turn(ax > 0 ? -1 : 1); } else if (Math.abs(ax) < .3) s.stick = false;
    }

    // what each hand points at
    let arcs = 0, hov = null, menuHov = null, cardHov = null;
    srcs.forEach((s, i) => {
      const a = aimOf(s, arcs);
      s.aim = a;
      s.line.visible = !!a && !a.arc && !busy;
      if (s.line.visible) s.line.scale.z = a.d;
      landing[i].visible = !!(a && a.arc) && !busy;
      if (landing[i].visible) { landing[i].position.set(a.p[0], .015, a.p[1]); arcs += arcN; }
      if (a && (a.what === "model" || a.what === "obra" || a.what === "ghost")) hov = a;
      if (a && a.what === "menu") menuHov = a.k; if (a && a.what === "card") cardHov = a.k;
      if (!a && !s.grab) { const nq = nearModel(s); if (nq) hov = { what: "model", q: nq }; }
    });
    arc.count = busy ? 0 : arcs; arc.instanceMatrix.needsUpdate = true;
    if (!srcs.some(s => s.poke)) { menu.hover(menuHov); card.hover(cardHov); }
    // the outline of what you point at (or hold)
    const held = [...pcs.values()].find(q => q.state === "held");
    const hq = hov && hov.what === "model" ? hov.q : held;
    if (hq) { hl.box.setFromObject(hq.obj); hl.visible = true; }
    else if (hov && hov.what === "obra" && pcs.has(hov.key)) { hl.box.setFromObject(pcs.get(hov.key).obj); hl.visible = true; }
    else if (hov && hov.what === "obra" && A.placed.has(hov.key)) {   // a picture (or the text): its own size, along its wall
      const P = A.placed.get(hov.key), tx = Math.abs(P.nz), tz = Math.abs(P.nx);
      hl.box.min.set(P.cx - tx * P.w / 2 - tz * .06, P.cy - P.h / 2, P.cz - tz * P.w / 2 - tx * .06);
      hl.box.max.set(P.cx + tx * P.w / 2 + tz * .06, P.cy + P.h / 2, P.cz + tz * P.w / 2 + tx * .06); hl.visible = true;
    }
    else hl.visible = false;

    // the pieces: held, flying, coming back
    for (const q of pcs.values()) {
      if (q.state === "held") follow(q, dt);
      else if (q.state === "free") physics(q, dt);
      else if (q.state === "back") {
        const B = q.back; B.t = Math.min(1, B.t + dt / .9); const k = ease(B.t);
        q.obj.position.lerpVectors(B.p0, B.p1, k).y += Math.sin(k * Math.PI) * .35;
        q.obj.quaternion.slerpQuaternions(B.r0, B.r1, k); q.obj.scale.setScalar(B.s0 + (B.s1 - B.s0) * k);
        if (B.t >= 1) { settle(q); sfx.pop(); menu.redraw(); }
      }
      if (q.ghost && q.ghost.visible) { q.ghost.lookAt(head); q.ghost.position.y = q.P.ped.top + .32 + Math.sin(performance.now() / 400) * .03; }
    }
  }

  /* ---------- start and end ---------- */
  renderer.xr.setSession(session).then(() => { onBuilt(); menu.redraw(); }).catch(e => { console.warn(e); session.end().catch(() => {}); });
  let ended = false;
  session.addEventListener("end", () => {
    if (ended) return; ended = true;
    snapAll();
    for (const l of spotsOff) l.visible = true;
    // the computer view picks up where your head was
    headPose(); P0.x = head.x; P0.z = head.z; P0.yaw = Math.atan2(-fwd.x, -fwd.z); P0.pitch = -.03;
    for (const s of srcs) { rig.remove(s.ray, s.grip, s.hand); }
    for (const q of pcs.values()) if (q.ghost) scene.remove(q.ghost);
    scene.remove(menu.mesh, card.mesh, arc, hl, ...landing);
    camera.remove(fadeMesh, msg.mesh); rig.remove(camera); scene.remove(rig);
    camera.position.set(P0.x, A.EYE, P0.z); camera.quaternion.identity(); camera.rotation.set(P0.pitch, P0.yaw, 0);
    renderer.xr.enabled = false;
    A.ended();
  });
  const me = {
    tick, onBuilt,
    end() { if (!ended) session.end().catch(() => {}); },
    debug: { rig, srcs, pcs, take, drop, detach, makeBody, physics, onBuilt, menu, card, get focusKey() { return focusKey; }, goPiece, step, tidyAll, menuAct, get busy() { return busy; } },
  };
  if (A.debugVR) A.debugVR(me.debug);
  return me;
}

// subtle translucent hands (no dots, no bones); controllers with their own model
async function hands(srcs) {
  const [{ XRHandModelFactory }, { XRControllerModelFactory }] = await Promise.all([
    import("three/addons/webxr/XRHandModelFactory.js"), import("three/addons/webxr/XRControllerModelFactory.js")]);
  const hf = new XRHandModelFactory(); hf.setPath("https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/");
  const cf = new XRControllerModelFactory();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xe6dcff, transparent: true, opacity: .32, roughness: .35, metalness: 0, depthWrite: false, emissive: 0x6b3fb0, emissiveIntensity: .25 });
  for (const s of srcs) {
    const hm = hf.createHandModel(s.hand, "mesh"); s.hand.add(hm);
    const glass = () => hm.traverse(o => { if (o.isMesh && o.material !== mat) { o.material = mat; o.renderOrder = 2; } });
    const iv = setInterval(glass, 500); setTimeout(() => clearInterval(iv), 20000);
    s.grip.add(cf.createControllerModel(s.grip));
    if (s.input) (s.input.hand ? s.hand : s.grip).dispatchEvent({ type: "connected", data: s.input });
  }
}
