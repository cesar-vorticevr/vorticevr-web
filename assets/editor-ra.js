// 3D editor of /crear/: the image with its elements (video, image, text, 3D) as they will look on the phone.
// The page keeps the list of elements (items) and the panel; this module draws them and lets you move them:
//   tap an element to select it: its handles appear (Mover = arrows, Girar = 3 rings, Tamaño = boxes; W / E / R)
//   drag its body to slide it over the image · pinch over it = size · twist two fingers = turn · the wheel only zooms the view
//   drag the background to turn the view · tap the background to deselect
// Same placement math as the viewer (assets/escena.js).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import * as ESC from "./escena.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r3 = v => Math.round(v * 1000) / 1000;
const deg = v => { v = Math.round(THREE.MathUtils.radToDeg(v)); return v > 180 ? v - 360 : v < -180 ? v + 360 : v; };

export async function createEditor(box, cb) {
  // cb: items() → the list (in order) · src(it) → { url, buffer } of its file · change(it, done) when moved here
  //     select(id) when the selection changes here · loaded(it, node) when an element finished building
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  box.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
  await ESC.light(renderer, scene);
  const world = new THREE.Group(); scene.add(world);   // the image's space, laid flat like on a table
  const imgMat = new THREE.MeshBasicMaterial({ color: 0x2a2140, toneMapped: false });
  const img = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), imgMat); world.add(img);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })); world.add(edge);
  // "Realidad aumentada en superficie": no image, a floor of 2 × 2 m in squares of 25 cm (1 unit = 1 meter)
  const grid = new THREE.GridHelper(2, 8, 0xd2b8ff, 0x6a4f9a); grid.rotation.x = Math.PI / 2; grid.material.transparent = true; grid.material.opacity = 0.55; grid.visible = false; world.add(grid);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ visible: false })); world.add(floor);   // for dragging
  const sel = new THREE.BoxHelper(undefined, 0xffbe55); sel.material.depthTest = false; sel.material.transparent = true; sel.material.opacity = 0.7; sel.renderOrder = 10; sel.visible = false; scene.add(sel);
  const orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true; orbit.minDistance = 0.4; orbit.maxDistance = 6;
  // right button (or two fingers on the background) slides the view; never so far that the scene gets lost
  orbit.screenSpacePanning = true;
  orbit.addEventListener("change", () => { const t = orbit.target, c = t.clone().clampScalar(-2.5, 2.5); if (!c.equals(t)) { camera.position.add(c.clone().sub(t)); t.copy(c); } });
  const tc = new TransformControls(camera, renderer.domElement); tc.size = 1.1; scene.add(tc);
  let startS = 1;   // size when a handle drag started: the scale handles move one axis, the size follows that one
  tc.addEventListener("dragging-changed", e => { orbit.enabled = !e.value; if (e.value) startS = itemOf(selected)?.s ?? 1; else done(); });

  // the experience's sparkles (setSparks): around the image (or the elements) in the image's space
  const sparks = new ESC.Sparkles(); world.add(sparks.group); let sparkCfg = null, boxT = 0;
  const nodes = new Map(), videos = new Map();
  let IH = 2 / 3, surface = false, lim = 0.75, place = "mesa", mode = "mover", selected = null, scene_ = 0, playT = -1, imgUrl = null;
  const items = () => cb.items();
  const itemOf = id => items().find(i => i.id === id);
  const layer = it => items().indexOf(it);
  const done = () => { const it = itemOf(selected); if (it) cb.change(it, true); };   // end of a gesture (for "undo")

  // ---- elements ----
  async function add(it) {
    const src = cb.src(it) || {};
    let video = null;
    if (it.type === "video") {
      video = videos.get(it.id) || Object.assign(document.createElement("video"), { muted: true, loop: true, playsInline: true, autoplay: true, crossOrigin: "anonymous" });
      if (video.src !== src.url) video.src = src.url;
      videos.set(it.id, video); video.play().catch(() => {});
    }
    const n = await ESC.build(it, { url: src.url, buffer: src.buffer && src.buffer.slice(0), video });
    const old = nodes.get(it.id); if (old) { if (tc.object && (tc.object === old.root)) tc.detach(); old.dispose(); }
    if (!itemOf(it.id)) { n.dispose(); return null; }   // removed while it loaded
    if (ESC.modernize(n, it)) cb.change(it);
    nodes.set(it.id, n); world.add(n.root); update(it);
    if (selected === it.id) attach();
    cb.loaded && cb.loaded(it, n);
    return n;
  }
  function remove(id) {
    const n = nodes.get(id); if (n) { if (selected === id) select(null); n.dispose(); nodes.delete(id); }
    const v = videos.get(id); if (v) { v.pause(); v.removeAttribute("src"); v.load(); videos.delete(id); }
  }
  function update(it) { const n = nodes.get(it.id); if (n) ESC.place(n, it, 1, layer(it)); }
  function updateAll() { for (const it of items()) update(it); }
  const nodeOf = id => nodes.get(id);
  function stand(id) { const it = itemOf(id), n = nodes.get(id); if (!it || !n) return; ESC.stand(n, it); update(it); cb.change(it, true); }

  // ---- the image and the view ----
  function setImage(url, w, h) {
    IH = h / w; img.scale.set(1, IH, 1); edge.scale.set(1, IH, 1);
    if (url && url !== imgUrl) { imgUrl = url; new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.SRGBColorSpace; imgMat.map = t; imgMat.color.set(0xffffff); imgMat.needsUpdate = true; }); }
  }
  // where the sparkles go: the image (a little above it) plus the elements on view, in the image's space
  const wInv = new THREE.Matrix4(), bb = new THREE.Box3();
  function sparkBox() {
    const b = surface ? new THREE.Box3(new THREE.Vector3(-.4, -.4, 0), new THREE.Vector3(.4, .4, .5)) : new THREE.Box3(new THREE.Vector3(-.55, -IH / 2 - .03, .02), new THREE.Vector3(.55, IH / 2 + .03, .3));
    world.updateMatrixWorld(true); wInv.copy(world.matrixWorld).invert();
    let any = false;
    for (const it of items()) { const n = nodes.get(it.id); if (!n || n.audio || !visible(it) || !n.root.visible) continue; bb.setFromObject(n.root).applyMatrix4(wInv); if (!bb.isEmpty()) { if (surface && !any) b.copy(bb); else b.union(bb); any = true; } }
    if (surface && any) b.expandByScalar(0.12);
    return b;
  }
  function setSparks(cfg) { sparkCfg = cfg || null; sparks.set(sparkCfg, sparkBox(), surface ? 0.06 : 0.05); }

  function setSurface(on) {
    surface = !!on; lim = surface ? 1.5 : 0.75; img.visible = edge.visible = !surface; grid.visible = surface;
    if (surface) IH = 1.4;   // only for the distance of the view
    view("inicio");
  }
  // a picture of the scene as it looks now (no handles), for the thumbnail in Mi cuenta
  function shot(type = "image/jpeg") {
    const keep = selected; select(null); sel.visible = false;
    renderer.setClearColor(0x1a0d33, 1); renderer.render(scene, camera);   // on the page's purple, not on black
    const p = new Promise(r => renderer.domElement.toBlob(r, type, 0.9));
    renderer.setClearColor(0x000000, 0); if (keep) select(keep);
    return p.then(blob => ({ blob, w: renderer.domElement.width, h: renderer.domElement.height }));
  }
  function setPlace(p) { place = p === "pared" ? "pared" : "mesa"; world.rotation.x = place === "mesa" ? -Math.PI / 2 : 0; view("inicio"); }
  function view(v) {
    const d = Math.max(1.25, IH * 1.7) * Math.max(1, 0.85 / camera.aspect);   // farther on a narrow screen
    if (v === "arriba") { if (place === "mesa") camera.position.set(0, d * 1.25, 0.001); else camera.position.set(0, 0, d * 1.25); orbit.target.set(0, 0, 0); }
    else if (place === "mesa") { camera.position.set(0, d * 0.95, d * 0.9); orbit.target.set(0, 0.06, 0); }
    else { camera.position.set(0.35, 0.12, d * 1.25); orbit.target.set(0, 0, 0); }
    orbit.update();
  }

  // ---- scenes: only the elements of the scene on view ----
  function setScene(k) { scene_ = k; if (selected && (itemOf(selected)?.scene || 0) !== k) select(null); }
  const visible = it => (it.scene || 0) === scene_;
  function play() { playT = 0; for (const v of videos.values()) { try { v.currentTime = 0; } catch (e) {} } }   // replay the entrances

  // ---- selection and handles ----
  function select(id) { selected = id || null; attach(); cb.select && cb.select(selected); }
  function attach() {
    const n = selected && nodes.get(selected);
    if (!n || n.audio) { tc.detach(); return; }   // an audio has nothing to move
    tc.setMode(mode === "girar" ? "rotate" : mode === "escalar" ? "scale" : "translate");
    tc.setSpace(mode === "mover" ? "world" : "local");
    tc.attach(n.root);
  }
  function setMode(m) { mode = m; attach(); }
  tc.addEventListener("objectChange", () => {
    const it = itemOf(selected), n = nodes.get(selected); if (!it || !n) return;
    if (mode === "mover") { it.x = r3(clamp(n.root.position.x, -2, 2)); it.y = r3(clamp(n.root.position.y, -2, 2)); it.z = r3(clamp(n.root.position.z - n.front, -1, 2)); }
    else if (mode === "girar") { const e = n.root.rotation; it.rx = deg(e.x); it.ry = deg(e.y); it.rz = deg(e.z); }
    else { const sc = n.root.scale, s = [sc.x, sc.y, sc.z].reduce((b, v) => Math.abs(v - startS) > Math.abs(b - startS) ? v : b, startS); it.s = r3(clamp(s, 0.02, 4)); }
    update(it); cb.change(it);
  });

  // ---- direct gestures: drag the body, wheel, pinch and twist ----
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), grab = new THREE.Vector2(), qz = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  const pts = new Map(); let drag = null, gest = null, down = null;
  const cast = (e, objs) => { const r = renderer.domElement.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ptr, camera); return ray.intersectObjects(objs, true)[0]; };
  const onImage = e => { const h = cast(e, [floor]); return h ? world.worldToLocal(h.point.clone()) : null; };
  function hitItem(e) {
    const list = items().filter(it => visible(it) && nodes.get(it.id)).map(it => nodes.get(it.id).root);
    const h = cast(e, list); if (!h) return null;
    for (const [id, n] of nodes) { for (let o = h.object; o; o = o.parent) if (o === n.root) return id; }
    return null;
  }
  const el = renderer.domElement;
  const capture = e => { try { el.setPointerCapture(e.pointerId); } catch (x) {} };
  el.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) { down = null; return; }   // right or middle button: the view (slide, zoom)
    down = { x: e.clientX, y: e.clientY, moved: false };
    if (tc.object && tc._getPointer && tc.pointerHover) { tc.pointerHover(tc._getPointer(e)); if (tc.axis) return; }   // on a handle: the handles work
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (drag && pts.size === 2) {   // second finger on a grabbed element: pinch and twist
      const it = itemOf(drag.id), n = nodes.get(drag.id), [a, b] = [...pts.values()];
      gest = { id: drag.id, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), s: it.s, q: n.root.quaternion.clone() };
      capture(e); e.stopImmediatePropagation(); e.preventDefault(); return;
    }
    const id = hitItem(e); if (!id) { pts.delete(e.pointerId); return; }
    const it = itemOf(id), p = onImage(e); if (!p) return;
    if (selected !== id) select(id);
    drag = { id, pid: e.pointerId }; grab.set(p.x - it.x, p.y - it.y);
    orbit.enabled = false; box.classList.add("drag");
    e.stopImmediatePropagation(); e.preventDefault(); capture(e);
  }, { capture: true });   // before OrbitControls and the handles: grabbing an element never turns the view
  el.addEventListener("pointermove", e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gest && pts.size >= 2) {
      const it = itemOf(gest.id), n = nodes.get(gest.id), [a, b] = [...pts.values()]; if (!it || !n) return;
      it.s = r3(clamp(gest.s * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(10, gest.d), 0.02, 4));
      // twisting turns it around the image's perpendicular, whatever its own rotation
      qz.setFromAxisAngle(Z, -(Math.atan2(b.y - a.y, b.x - a.x) - gest.ang));
      const e2 = new THREE.Euler().setFromQuaternion(qz.multiply(gest.q), "XYZ");
      it.rx = deg(e2.x); it.ry = deg(e2.y); it.rz = deg(e2.z);
      update(it); cb.change(it); return;
    }
    if (!drag || drag.pid !== e.pointerId) return;
    const it = itemOf(drag.id), p = onImage(e); if (!it || !p) return;
    it.x = r3(clamp(p.x - grab.x, -lim, lim)); it.y = r3(surface ? clamp(p.y - grab.y, -lim, lim) : clamp(p.y - grab.y, -IH / 2 - 0.25, IH / 2 + 0.25));
    update(it); cb.change(it);
  });
  const up = e => {
    const had = !!drag || !!gest;
    pts.delete(e.pointerId);
    if (gest && pts.size < 2) gest = null;
    if (drag && drag.pid === e.pointerId) drag = null;
    if (!pts.size) { drag = null; orbit.enabled = !tc.dragging; box.classList.remove("drag"); if (had) done(); }
    if (down && !down.moved && e.type === "pointerup" && !tc.axis && !hitItem(e)) select(null);   // tap on the background
    down = null;
  };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  // the wheel only zooms the view (OrbitControls), also over an element: sizes change with the handles, the panel or a pinch
  // (César, 25 de octubre de 2026: scrolling over an element resized it by accident)

  // ---- size and drawing ----
  function resize() { const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(box); resize();
  const clock = new THREE.Clock(); let time = 0;
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta(); time += dt;
    if (box.offsetParent === null || document.hidden) return;
    if (playT >= 0) playT += dt;
    const shown = items().filter(visible);
    for (const it of items()) {
      const n = nodes.get(it.id); if (!n) continue;
      if (!visible(it)) { n.root.visible = false; continue; }
      ESC.place(n, it, playT >= 0 ? (playT - shown.indexOf(it) * ESC.STAGGER) / ESC.DURATION : 1, layer(it));
      ESC.animate(n, it, time);   // its motion in a loop, if it has one
      n.update(dt);
    }
    if (playT > 3) playT = -1;
    const n = selected && nodes.get(selected);
    sel.visible = !!n && !n.audio && n.root.visible;
    if (sel.visible) sel.setFromObject(n.root);
    if (sparkCfg) { boxT -= dt; if (boxT <= 0) { boxT = 1; sparks.box.copy(sparkBox()); } sparks.update(dt); }
    orbit.update(); renderer.render(scene, camera);
  });
  setPlace("mesa");
  return { add, remove, update, updateAll, nodeOf, stand, setImage, setSurface, shot, setPlace, view, setScene, play, select, setMode, resize, videos, setSparks };
}
