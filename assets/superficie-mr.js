// "Realidad aumentada en superficie" in a headset (Meta Quest and others with WebXR), used by assets/superficie.js
// when the page opens in the headset's browser, instead of model-viewer or the phone view (superficie-xr.js).
//   · mode "ar" = mixed reality (passthrough: your room and your real hands; nothing is drawn on the hands)
//     mode "vr" = virtual reality (a night floor with stars; the hands are subtle translucent hands)
//   · it appears on the floor, ~1.2 m in front of you, facing you
//   · one hand (pinch, or the controller's trigger / grip): take it, near or from afar with the ray, and it follows
//     your hand: move it, turn it, tilt it
//   · two hands: bigger or smaller (5 %–2000 %), turn it and move it at the same time
//   · the menu (Enderezar = upright and on the floor, Tamaño real, Traer = in front of you, Salir, and the size): with
//     hands it comes out of your left fist, as in the gallery (assets/galeria-vr.js): turn the fist toward you and open
//     it (a hint over the hand says so); closing it or turning it away hides it. César: the panel always there on the
//     side was uncomfortable. With controllers it follows you (lower left). Its buttons are held, not tapped: 1 s with
//     the right index finger or the ray, 2 s for Salir, filling up as you hold.
//     The size is remembered like on the phone (localStorage vvr-escala-<slug>).
// startMR() must be called right inside the tap: the session is asked for before anything else.
import * as THREE from "three";
import * as ESC from "./escena.js";
import { sfx } from "./sonidos.js";

const MIN = 0.05, MAX = 20;
const isHMD = () => /OculusBrowser|Quest|Pico|Wolvic|Mobile VR/i.test(navigator.userAgent);
export { isHMD };

// o: { glb (ArrayBuffer), slug, title, audio: <audio> | null, mode: "ar" | "vr", onEnd() }
export function startMR(o) {
  if (o.audio) { const au = o.audio; try { au.currentTime = 0; } catch (e) {} au.play().catch(() => {}); }   // inside the tap
  const req = navigator.xr.requestSession(o.mode === "vr" ? "immersive-vr" : "immersive-ar", { requiredFeatures: ["local-floor"], optionalFeatures: ["hand-tracking", "bounded-floor", "layers"] });
  return req.then(s => run(s, o)).catch(e => { if (o.audio) o.audio.pause(); throw e; });
}

async function run(session, o) {
  const AR = o.mode !== "vr";
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: AR });
  renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType("local-floor");
  renderer.domElement.style.display = "none"; document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100);
  await ESC.light(renderer, scene);
  if (!AR) world(scene);

  // ---- the experience, inside a holder that the hands move ----
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().parseAsync(o.glb.slice(0), "");
  const holder = new THREE.Group(); holder.visible = false; holder.add(gltf.scene); scene.add(holder);
  const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,.45)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(size.x, 0.1) * 1.4, Math.max(size.z, 0.1) * 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(mid.x, 0.002, mid.z); holder.add(sh);
  }
  const hitBox = box.clone().expandByScalar(0.03);
  const outline = new THREE.Box3Helper(hitBox, 0xffbe55); outline.material.transparent = true; outline.material.opacity = 0.45; outline.material.depthTest = false; outline.visible = false; holder.add(outline);
  const mixer = gltf.animations.length ? new THREE.AnimationMixer(gltf.scene) : null;
  if (mixer) gltf.animations.forEach(a => mixer.clipAction(a).play());

  // ---- size ----
  const KEY = "vvr-escala-" + (o.slug || "x");
  let scale = 1; try { const v = parseFloat(localStorage.getItem(KEY)); if (v >= MIN && v <= MAX) scale = v; } catch (e) {}
  const save = () => { try { if (Math.abs(scale - 1) < 0.02) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(scale)); } catch (e) {} };
  const target = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale };   // where the hands want it (smoothed)

  // ---- hands and controllers ----
  const srcs = [0, 1].map(i => {
    const ray = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i), hand = renderer.xr.getHand(i);
    scene.add(ray, grip, hand);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
      new THREE.LineBasicMaterial({ color: 0xd2b8ff, transparent: true, opacity: 0.55 }));
    line.visible = false; ray.add(line);
    const s = { i, ray, grip, hand, line, input: null, grab: null, hover: null };
    ray.addEventListener("connected", e => { s.input = e.data; });
    ray.addEventListener("disconnected", () => { s.input = null; release(s); });
    ray.addEventListener("selectstart", () => { s.selecting = true; press(s); });
    ray.addEventListener("selectend", () => { s.selecting = false; if (hold && hold.s === s && hold.ray) setHold(null); release(s); });
    ray.addEventListener("squeezestart", () => { if (!(s.input && s.input.hand)) press(s, true); });   // the grip button also takes it
    ray.addEventListener("squeezeend", () => { if (!(s.input && s.input.hand)) release(s); });
    return s;
  });
  if (!AR) hands(srcs).catch(e => console.error(e));   // in mixed reality your real hands are seen: nothing is drawn on them

  // the pose that holds it: for a hand, the pinch point with the wrist's turn; for a controller, its grip
  const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  function poseOf(s, out) {
    if (s.input && s.input.hand) {
      const j = s.hand.joints, w = j && j["wrist"], th = j && j["thumb-tip"], ix = j && j["index-finger-tip"];
      if (!w || !th || !ix || !w.visible) return false;
      tmpV.copy(th.position).add(ix.position).multiplyScalar(0.5);
      out.compose(tmpV, w.quaternion, one); return true;
    }
    const g = s.grip.visible ? s.grip : s.ray.visible ? s.ray : null;
    if (!g) return false;
    g.updateMatrixWorld(true); out.copy(g.matrixWorld); return true;
  }
  const pointOf = (s, out) => { if (!poseOf(s, tmpM)) return false; out.setFromMatrixPosition(tmpM); return true; };
  const pulse = (s, k = 0.4, ms = 40) => { try { const h = s.input && s.input.gamepad && s.input.gamepad.hapticActuators; h && h[0] && h[0].pulse(k, ms); } catch (e) {} };

  const raycaster = new THREE.Raycaster(), inv = new THREE.Matrix4();
  function aim(s) {   // what its ray points at: { what: "panel" | "obj", d, uv }
    if (!s.ray.visible) return null;
    s.ray.updateMatrixWorld(true);
    raycaster.ray.origin.setFromMatrixPosition(s.ray.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).transformDirection(s.ray.matrixWorld);
    let best = null;
    if (panel.mesh.visible) { const h = raycaster.intersectObject(panel.mesh, false)[0]; if (h) best = { what: "panel", d: h.distance, uv: h.uv }; }
    if (holder.visible) {
      holder.updateMatrixWorld(true); inv.copy(holder.matrixWorld).invert();
      const r = raycaster.ray.clone().applyMatrix4(inv), p = r.intersectBox(hitBox, new THREE.Vector3());
      if (p) { const d = p.applyMatrix4(holder.matrixWorld).distanceTo(raycaster.ray.origin); if (!best || d < best.d) best = { what: "obj", d }; }
    }
    return best;
  }
  function near(s) {   // the hand is touching it
    if (!holder.visible || !pointOf(s, tmpV)) return false;
    holder.updateMatrixWorld(true); inv.copy(holder.matrixWorld).invert();
    return hitBox.clone().expandByScalar(0.06 / scale).containsPoint(tmpV.applyMatrix4(inv));
  }

  let grabbedOnce = false, two = null;
  function press(s, squeeze) {
    if (s.grab) return;
    const a = squeeze ? null : aim(s);
    if (s.menuHand) return;   // the left palm is showing the menu
    if (a && a.what === "panel" && !near(s)) { const i = panel.at(a.uv); if (i >= 0) setHold({ i, t: 0, s, ray: true }); return; }   // held, not tapped
    if (!(near(s) || (a && a.what === "obj") || squeeze && near(s))) return;
    s.grab = { off: new THREE.Matrix4() };
    if (!grabbedOnce) { grabbedOnce = true; panel.hint = "Con las dos manos: más grande o más chico"; panel.draw(); }
    sfx.pop(); pulse(s, 0.5, 50);
    regrab();
  }
  function release(s) {
    if (!s.grab) return;
    s.grab = null; two = null; save(); regrab(); panel.draw();
  }
  // whenever the hands that hold it change, each one starts again from where it is now
  function regrab() {
    const held = srcs.filter(s => s.grab);
    const hm = new THREE.Matrix4().compose(target.pos, target.quat, one);
    for (const s of held) if (poseOf(s, tmpM)) s.grab.off.copy(tmpM).invert().multiply(hm);
    two = null;
    if (held.length === 2) {
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      if (pointOf(held[0], a) && pointOf(held[1], b)) two = { d: Math.max(0.02, a.distanceTo(b)), ang: Math.atan2(b.x - a.x, b.z - a.z), mid: a.clone().add(b).multiplyScalar(0.5), pos: target.pos.clone(), quat: target.quat.clone(), scale: target.scale };
    }
  }
  let ticks = 0;
  function follow() {
    const held = srcs.filter(s => s.grab);
    if (held.length === 1) {
      if (poseOf(held[0], tmpM)) { tmpM.multiply(held[0].grab.off); tmpM.decompose(target.pos, target.quat, tmpV); }
    } else if (held.length === 2 && two) {
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      if (!pointOf(held[0], a) || !pointOf(held[1], b)) return;
      const k = Math.min(MAX, Math.max(MIN, two.scale * a.distanceTo(b) / two.d)) / two.scale;
      const dy = Math.atan2(b.x - a.x, b.z - a.z) - two.ang, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dy);
      const m = a.clone().add(b).multiplyScalar(0.5);
      target.scale = two.scale * k;
      target.quat.copy(q).multiply(two.quat);
      // it grows and turns around the point between the hands, and moves with them
      target.pos.copy(two.pos).sub(two.mid).multiplyScalar(k).applyQuaternion(q).add(m);
      scale = target.scale;
      const step = Math.round(Math.log(scale) / Math.log(1.15)); if (step !== ticks) { ticks = step; sfx.tick(.6); held.forEach(s => pulse(s, 0.15, 15)); panel.draw(); }
    }
  }

  // ---- the panel ----
  const head = new THREE.Vector3(), fwd = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function headPose() {
    const c = renderer.xr.getCamera(); c.updateMatrixWorld(true);
    head.setFromMatrixPosition(c.matrixWorld); fwd.set(0, 0, -1).transformDirection(c.matrixWorld); fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1); fwd.normalize();
  }
  function inFront(dist) {   // on the floor, dist in front of you, facing you
    headPose();
    target.pos.set(head.x + fwd.x * dist, 0, head.z + fwd.z * dist);
    target.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-fwd.x, -fwd.z));
  }
  function upright() {   // only its turn around the vertical stays; its base back on the floor
    const e = new THREE.Euler().setFromQuaternion(target.quat, "YXZ");
    target.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), e.y); target.pos.y = 0;
  }
  const panel = makePanel(o.title, {
    upright: () => { upright(); sfx.pop(); },
    real: () => { target.scale = scale = 1; save(); sfx.pop(); },
    bring: () => { inFront(Math.max(0.8, 0.6 + size.length() * scale * 0.5)); sfx.appear(); },
    exit: () => session.end(),
  }, () => Math.round(scale * 100) + " %");
  scene.add(panel.mesh); panel.mesh.visible = false;
  let panelOut = true;
  function panelFollow(dt) {
    headPose();
    const left = new THREE.Vector3(fwd.z, 0, -fwd.x);   // to your left
    const want = head.clone().addScaledVector(fwd, 0.55).addScaledVector(left, 0.32); want.y = head.y - 0.32;
    const off = panel.mesh.position.distanceTo(want);
    if (off > 0.35) panelOut = true;
    if (panelOut) { panel.mesh.position.lerp(want, 1 - Math.exp(-dt * 3)); if (off < 0.03) panelOut = false; }
    panel.mesh.lookAt(head);
  }

  // ---- the menu on the left fist (hands) or following you (controllers) ----
  const isHand = s => !!(s.input && s.input.hand);
  const joint = (s, n) => { const j = s.hand.joints && s.hand.joints[n]; return j && j.visible ? j : null; };
  const curlOf = s => {   // the middle, ring and little fingertips near the wrist: open ≈ 1.8, a fist ≈ 1 (a pinch doesn't count)
    const w = joint(s, "wrist"), k = joint(s, "middle-finger-phalanx-proximal"); if (!w || !k) return null;
    const wp = w.getWorldPosition(new THREE.Vector3()), ref = Math.max(0.04, k.getWorldPosition(new THREE.Vector3()).distanceTo(wp));
    let sum = 0, n = 0;
    for (const t of ["middle-finger-tip", "ring-finger-tip", "pinky-finger-tip"]) { const j = joint(s, t); if (j) { sum += j.getWorldPosition(new THREE.Vector3()).distanceTo(wp); n++; } }
    return n ? sum / n / ref : null;
  };
  const curled = s => { const c = curlOf(s); if (c === null) return false; s.curled = s.curled ? c < 1.55 : c < 1.4; return s.curled; };
  const PALM = new THREE.Vector3(0, -1, 0);   // the wrist's -Y comes out of the palm
  const pal = { armed: false, open: false, away: 0 };
  const palmHint = (() => {
    const c = document.createElement("canvas"); c.width = 768; c.height = 150; const g = c.getContext("2d");
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2 * 150 / 768), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }));
    mesh.renderOrder = 11; mesh.visible = false; scene.add(mesh);
    return { mesh, t: "", set(t) { if (t === this.t) return; this.t = t; g.clearRect(0, 0, 768, 150);
      g.beginPath(); g.roundRect ? g.roundRect(4, 4, 760, 142, 70) : g.rect(4, 4, 760, 142); g.fillStyle = "rgba(14,6,30,.82)"; g.fill(); g.lineWidth = 3; g.strokeStyle = "rgba(255,190,85,.6)"; g.stroke();
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.font = "700 44px Sora, system-ui, sans-serif"; g.fillText(t, 384, 78); tex.needsUpdate = true; } };
  })();
  function menuPose(dt) {
    for (const s of srcs) s.menuHand = false;
    palmHint.mesh.visible = false;
    if (!srcs.some(isHand)) { panel.mesh.scale.setScalar(1); panel.mesh.visible = true; panelFollow(dt); return; }   // controllers
    panel.mesh.scale.setScalar(0.75);
    const L = srcs.find(s => isHand(s) && s.input.handedness === "left");
    const w = L && joint(L, "wrist"), mid = L && joint(L, "middle-finger-metacarpal");
    if (w && mid) {
      headPose();
      const wp = w.getWorldPosition(new THREE.Vector3()), n = PALM.clone().applyQuaternion(w.getWorldQuaternion(new THREE.Quaternion()));
      if (n.dot(head.clone().sub(wp).normalize()) > 0.55 && !L.grab) {
        L.menuHand = true; pal.away = 0;
        const fist = curled(L), mp = mid.getWorldPosition(new THREE.Vector3());
        // first a fist, then open it: the menu (closing it again hides it)
        if (fist) { if (pal.open) { pal.open = false; setHold(null); } pal.armed = true; }
        else if (pal.armed && !pal.open) { pal.open = true; pal.armed = false; sfx.sparkle(3); panel.draw(); }
        if (pal.open) {
          panel.mesh.position.copy(mp).addScaledVector(n, 0.07).addScaledVector(UP, 0.08);
          panel.mesh.lookAt(head); panel.mesh.visible = true; return;
        }
        palmHint.set(fist ? "Abre el puño: menú" : "Cierra el puño y ábrelo: menú");
        palmHint.mesh.position.copy(mp).addScaledVector(n, 0.06).addScaledVector(UP, 0.06); palmHint.mesh.lookAt(head); palmHint.mesh.visible = true;
      } else if ((pal.away += dt) > 0.4) { pal.open = false; pal.armed = false; }
    }
    panel.mesh.visible = false;
  }
  // a fingertip on a button
  function pokes() {
    for (const s of srcs) {
      const tip = isHand(s) ? joint(s, "index-finger-tip") : null;
      s.poke = false;
      if (!tip || s.menuHand || s.grab || !panel.mesh.visible) continue;
      const l = panel.mesh.worldToLocal(tip.getWorldPosition(new THREE.Vector3()));
      const W = 0.42, H = 0.42 * 300 / 1024;
      if (Math.abs(l.z) > 0.02 || Math.abs(l.x) > W / 2 || Math.abs(l.y) > H / 2) continue;
      const i = panel.at({ x: l.x / W + 0.5, y: l.y / H + 0.5 }); if (i < 0) continue;
      s.poke = true; panel.hoverIdx(i);
      if (!hold || hold.i !== i || hold.s !== s || hold.ray) setHold({ i, t: 0, s });
    }
  }
  // holding a button: 1 s (Salir 2 s), with the button filling up
  let hold = null;
  function setHold(h) { hold = h; panel.prog = h ? { i: h.i, f: 0 } : null; panel.draw(); }
  function holdTick(dt) {
    if (!hold) return;
    if (!panel.mesh.visible) return setHold(null);
    if (!hold.ray && !hold.s.poke) return setHold(null);
    if (hold.ray && !(hold.s.selecting && hold.s.aimBtn === hold.i)) return setHold(null);
    if (hold.done) return;
    const need = panel.key(hold.i) === "exit" ? 2 : 1;
    hold.t += dt; panel.prog.f = hold.t / need; panel.draw();
    if (Math.floor(hold.t * 4) !== Math.floor((hold.t - dt) * 4)) pulse(hold.s, 0.12, 10);
    if (hold.t >= need) { hold.done = true; panel.prog.f = 1; pulse(hold.s, 0.5, 50); sfx.pop(); panel.act(hold.i); }
  }

  await renderer.xr.setSession(session);
  if (o.debug) o.debug({ holder, target, panel, srcs, pal, palmHint, curlOf, get hold() { return hold; }, get scale() { return scale; } });   // tests with an emulated headset
  const clock = new THREE.Clock(); let started = false;
  renderer.setAnimationLoop((t, frame) => {
    const dt = Math.min(0.1, clock.getDelta()); if (!frame) return;
    if (!started) {   // the first pose: there it appears
      started = true; inFront(Math.max(1.1, 0.8 + size.length() * scale * 0.5));
      holder.position.copy(target.pos); holder.quaternion.copy(target.quat); holder.scale.setScalar(scale); holder.visible = true;
      headPose(); panel.mesh.position.copy(head).addScaledVector(fwd, 0.55); panel.mesh.position.y = head.y - 0.32;
      sfx.appear();
    }
    follow();
    const k = 1 - Math.exp(-dt * 22);   // smooths the trembling of the hands
    holder.position.lerp(target.pos, k); holder.quaternion.slerp(target.quat, k); holder.scale.setScalar(holder.scale.x + (target.scale - holder.scale.x) * k);
    let hoverObj = false, hoverPanel = null;
    for (const s of srcs) {
      const a = s.grab ? null : aim(s);
      s.line.visible = !!a && !near(s);
      if (s.line.visible) s.line.scale.z = a.d;
      if (a && a.what === "obj") hoverObj = true;
      if (a && a.what === "panel") hoverPanel = a.uv;
      s.aimBtn = a && a.what === "panel" ? panel.at(a.uv) : -1;
      if (!s.grab && near(s)) hoverObj = true;
    }
    outline.visible = hoverObj || srcs.some(s => s.grab);
    if (!srcs.some(s => s.poke)) panel.hover(hoverPanel);
    menuPose(dt); pokes(dt); holdTick(dt);
    if (mixer) mixer.update(dt);
    renderer.render(scene, camera);
  });

  session.addEventListener("end", () => {
    renderer.setAnimationLoop(null); save();
    renderer.dispose(); renderer.domElement.remove();
    if (o.audio) o.audio.pause();
    o.onEnd && o.onEnd();
  });
}

// virtual reality: night sky with stars and a soft floor
function world(scene) {
  scene.background = new THREE.Color(0x0b0418);
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
  const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  gr.addColorStop(0, "#3a1d6e"); gr.addColorStop(0.55, "#1d0c3d"); gr.addColorStop(1, "rgba(11,4,24,0)"); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(210,184,255,.18)"; g.lineWidth = 2;
  for (let r = 40; r < 256; r += 40) { g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke(); }
  const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const n = 1400, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * 0.9 + 0.05; v.normalize().multiplyScalar(40 + Math.random() * 20); p.set([v.x, v.y, v.z], i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe9ddff, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.8 })));
}

// virtual reality: subtle translucent hands (no dots, no bones); controllers with their own model
async function hands(srcs) {
  const [{ XRHandModelFactory }, { XRControllerModelFactory }] = await Promise.all([
    import("three/addons/webxr/XRHandModelFactory.js"), import("three/addons/webxr/XRControllerModelFactory.js")]);
  const hf = new XRHandModelFactory(); hf.setPath("https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/");
  const cf = new XRControllerModelFactory();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xe6dcff, transparent: true, opacity: 0.32, roughness: 0.35, metalness: 0, transmission: 0, depthWrite: false, emissive: 0x6b3fb0, emissiveIntensity: 0.25 });
  for (const s of srcs) {
    const hm = hf.createHandModel(s.hand, "mesh"); s.hand.add(hm);
    // the factory loads its own skin: once it is there, it becomes glass
    const glass = () => hm.traverse(o => { if (o.isMesh && o.material !== mat) { o.material = mat; o.renderOrder = 2; } });
    const iv = setInterval(glass, 500); setTimeout(() => clearInterval(iv), 20000);
    s.grip.add(cf.createControllerModel(s.grip));
    // the factories wait for "connected": if the hand or controller was already there, tell them again
    if (s.input) (s.input.hand ? s.hand : s.grip).dispatchEvent({ type: "connected", data: s.input });
  }
}

// the panel: a line of help and four buttons, drawn on a canvas
function makePanel(title, act, pct) {
  const W = 1024, H = 300, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42 * H / W), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }));
  mesh.renderOrder = 10;
  const BTN = [["upright", "Enderezar"], ["real", "Tamaño real"], ["bring", "Traer"], ["exit", "Salir"]];
  const p = { mesh, hint: "Pellizca para tomarlo · mantén oprimido un botón", hov: -1 };
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  p.draw = () => {
    g.clearRect(0, 0, W, H);
    rr(4, 4, W - 8, H - 8, 46); g.fillStyle = "rgba(14,6,30,.86)"; g.fill(); g.lineWidth = 3; g.strokeStyle = "rgba(210,184,255,.45)"; g.stroke();
    g.fillStyle = "#ffbe55"; g.font = "700 30px Sora, system-ui, sans-serif"; g.textBaseline = "middle"; g.textAlign = "left";
    g.fillText(String(title || "Vórtice VR").slice(0, 34), 40, 52);
    g.textAlign = "right"; g.fillStyle = "#fff"; g.font = "800 34px Sora, system-ui, sans-serif"; g.fillText(pct(), W - 40, 52);
    g.textAlign = "left"; g.fillStyle = "#d9ccf5"; g.font = "500 30px 'IBM Plex Sans', system-ui, sans-serif"; g.fillText(p.hint, 40, 106);
    const bw = (W - 80 - 3 * 18) / 4;
    BTN.forEach(([k, t], i) => {
      const x = 40 + i * (bw + 18), y = 150;
      rr(x, y, bw, 110, 55); g.fillStyle = i === p.hov ? (k === "exit" ? "#e5243b" : "#8b3fd6") : (k === "exit" ? "rgba(229,36,59,.28)" : "rgba(255,255,255,.12)"); g.fill();
      if (p.prog && p.prog.i === i) {   // held: it fills up from the left
        g.save(); rr(x, y, bw, 110, 55); g.clip(); g.fillStyle = k === "exit" ? "#ff4d63" : "#b07bff"; g.fillRect(x, y, bw * Math.min(1, p.prog.f), 110); g.restore();
        rr(x, y, bw, 110, 55); g.lineWidth = 5; g.strokeStyle = "#ffd27f"; g.stroke();
      }
      g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "700 32px Sora, system-ui, sans-serif"; g.fillText(t, x + bw / 2, y + 56);
    });
    tex.needsUpdate = true;
  };
  const at = uv => {
    if (!uv) return -1;
    const x = uv.x * W, y = (1 - uv.y) * H, bw = (W - 80 - 3 * 18) / 4;
    if (y < 150 || y > 260) return -1;
    const i = Math.floor((x - 40) / (bw + 18)); return i >= 0 && i < 4 && (x - 40) - i * (bw + 18) <= bw ? i : -1;
  };
  p.hover = uv => { const i = at(uv); if (i !== p.hov) { p.hov = i; p.draw(); } };
  p.click = uv => { const i = at(uv); if (i >= 0) { act[BTN[i][0]](); p.draw(); } };
  p.at = at; p.key = i => BTN[i][0];
  p.act = i => { act[BTN[i][0]](); p.draw(); };
  p.hoverIdx = i => { if (i !== p.hov) { p.hov = i; p.draw(); } };
  p.draw();
  return p;
}
