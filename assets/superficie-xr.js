// Our own surface AR for Android (Chrome, WebXR), used by assets/superficie.js instead of model-viewer so it can have
// the photo / video button with the logo, like the image AR. iPhone has no WebXR: there it stays Quick Look.
//   · hit-test: a ring shows where it will go; a tap places it facing you (another tap moves it)
//   · two fingers pinch the whole scene bigger or smaller (10 %–1000 %); the size stays when it is moved and is
//     remembered on the phone (localStorage vvr-escala-<slug>); "Tamaño real" puts it back at 100 %
//   · dom-overlay: our buttons over the camera (close, shutter, photo / video)
//   · camera-access: the camera picture of each frame (XRWebGLBinding.getCameraImage). A capture draws it and the 3D
//     into a render target, reads it and adds the logo on a 2D canvas (the photo, or each frame of the video).
//     Without camera-access (a phone that does not give it) there is no shutter.
// startXR() must be called right inside the tap: the AR session is asked for before anything else.
import * as THREE from "three";
import * as ESC from "./escena.js";
import { sfx } from "./sonidos.js";

const CSS = `
.sx{position:fixed;inset:0;z-index:100;color:#fff;font-family:"IBM Plex Sans",system-ui,sans-serif;pointer-events:none}
.sx button,.sx a{pointer-events:auto;font:inherit;color:inherit;cursor:pointer}
.sx [hidden]{display:none!important}
.sx-top{position:absolute;left:0;right:0;top:0;display:flex;justify-content:center;align-items:center;padding:calc(12px + env(safe-area-inset-top,0px)) 60px 18px;background:linear-gradient(180deg,rgba(5,2,11,.6),rgba(5,2,11,0))}
.sx-top img{height:24px;width:auto;display:block}
.sx-top.own img{height:auto;max-height:28px;max-width:46vw;background:#fff;border-radius:999px;padding:5px 12px;box-sizing:content-box}
.sx-x{position:absolute;right:12px;top:calc(8px + env(safe-area-inset-top,0px));width:44px;height:44px;border-radius:50%;border:0;background:rgba(10,4,22,.62);font-size:1.2rem}
.sx-hint{position:absolute;left:50%;top:calc(70px + env(safe-area-inset-top,0px));transform:translateX(-50%);margin:0;background:rgba(10,4,22,.62);padding:9px 16px;border-radius:999px;font-weight:600;font-size:.9rem;white-space:nowrap;max-width:calc(100vw - 32px);overflow:hidden;text-overflow:ellipsis}
.sx-bot{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;gap:10px;padding:0 16px calc(18px + env(safe-area-inset-bottom,0px));background:linear-gradient(0deg,rgba(5,2,11,.5),rgba(5,2,11,0))}
.sx-modes{display:flex;gap:4px;background:rgba(10,4,22,.62);border-radius:999px;padding:4px;pointer-events:auto}
.sx-modes button{font-size:.8rem;font-weight:700;background:transparent;border:0;border-radius:999px;padding:7px 16px}
.sx-modes button[aria-pressed="true"]{background:#fff;color:#111}
.sx-shut{width:70px;height:70px;border-radius:50%;border:4px solid #fff;background:rgba(255,255,255,.22);padding:0;display:grid;place-items:center}
.sx-shut span{width:52px;height:52px;border-radius:50%;background:#fff;transition:all .2s}
.sx-shut.video span{background:#e5243b}
.sx-shut.rec span{width:24px;height:24px;border-radius:6px;background:#e5243b}
.sx-timer{font-weight:800;font-size:.85rem;background:#e5243b;padding:3px 10px;border-radius:999px;font-variant-numeric:tabular-nums}
.sx-flash{position:absolute;inset:0;background:#fff;opacity:0;transition:opacity .25s}
.sx-flash.on{opacity:.85;transition:none}
.sx-sheet{position:absolute;inset:0;background:rgba(10,8,12,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:20px 16px;pointer-events:auto}
.sx-media{max-width:100%;max-height:62vh;border-radius:14px;overflow:hidden;background:#000;display:flex}
.sx-media img,.sx-media video{max-width:100%;max-height:62vh;display:block}
.sx-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.sx-act{font-weight:800;font-size:.95rem;border:0;border-radius:999px;padding:13px 22px;text-decoration:none;background:rgba(255,255,255,.12)}
.sx-act.primary{background:#8b3fd6}
.sx-pinch{position:absolute;inset:0;pointer-events:auto;touch-action:none}
.sx-size{position:absolute;left:50%;top:calc(116px + env(safe-area-inset-top,0px));transform:translateX(-50%);display:flex;align-items:center;gap:8px}
.sx-pct{background:rgba(10,4,22,.72);padding:7px 14px;border-radius:999px;font-weight:800;font-size:1rem;font-variant-numeric:tabular-nums;transition:transform .15s}
.sx-pct.big{transform:scale(1.25);background:#8b3fd6}
.sx-real{border:0;border-radius:999px;padding:7px 14px;background:rgba(255,255,255,.9);color:#16101f!important;font-weight:700;font-size:.85rem}
`;

// o: { glb (ArrayBuffer), brand: {src, own} | null, slug, title, audio: <audio> | null, onEnd() }
export function startXR(o) {
  if (!document.getElementById("sx-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "sx-css", textContent: CSS }));
  const ui = document.createElement("div"); ui.className = "sx";
  ui.innerHTML = `<div class="sx-pinch"></div><div class="sx-top${o.brand && o.brand.own ? " own" : ""}">${o.brand ? `<img alt="" src="${o.brand.src}">` : ""}<button class="sx-x" type="button" aria-label="Cerrar">✕</button></div>
    <p class="sx-hint">Apunta al piso o a una mesa y mueve el celular despacio</p>
    <div class="sx-size" hidden><span class="sx-pct">100 %</span><button class="sx-real" type="button" hidden>Tamaño real</button></div>
    <div class="sx-bot" hidden><span class="sx-timer" hidden>0:00</span><button class="sx-shut" type="button" aria-label="Tomar foto"><span></span></button>
      <div class="sx-modes" role="group" aria-label="Modo de captura"><button type="button" data-m="photo" aria-pressed="true">Foto</button><button type="button" data-m="video" aria-pressed="false">Video</button></div></div>
    <div class="sx-flash"></div>
    <div class="sx-sheet" hidden><div class="sx-media"></div><div class="sx-row"><button class="sx-act primary sx-share" type="button">Guardar o compartir</button><a class="sx-act sx-dl" href="#" download>Descargar</a><button class="sx-act sx-close" type="button">Seguir</button></div></div>`;
  document.body.appendChild(ui);
  const q = s => ui.querySelector(s);
  // taps on our buttons do not place the object
  for (const s of [".sx-top", ".sx-bot", ".sx-sheet", ".sx-size"]) q(s).addEventListener("beforexrselect", e => e.preventDefault());
  if (o.audio) { try { o.audio.currentTime = 0; } catch (e) {} o.audio.play().catch(() => {}); }   // inside the tap

  // the session first (it needs the tap); the rest after
  const req = navigator.xr.requestSession("immersive-ar", { requiredFeatures: ["hit-test"], optionalFeatures: ["dom-overlay", "camera-access"], domOverlay: { root: ui } });
  return req.then(session => run(session, ui, q, o)).catch(e => { ui.remove(); if (o.audio) o.audio.pause(); throw e; });
}

async function run(session, ui, q, o) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType("local");
  renderer.domElement.style.display = "none"; document.body.appendChild(renderer.domElement);
  const gl = renderer.getContext();
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 50);
  await ESC.light(renderer, scene);

  // the experience (the GLB that superficie.js made) with a soft shadow under it
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().parseAsync(o.glb.slice(0), "");
  const content = new THREE.Group(); content.visible = false; content.add(gltf.scene); scene.add(content);
  const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,.45)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(size.x, 0.1) * 1.4, Math.max(size.z, 0.1) * 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(mid.x, 0.002, mid.z); content.add(sh);
  }
  const mixer = gltf.animations.length ? new THREE.AnimationMixer(gltf.scene) : null;
  if (mixer) gltf.animations.forEach(a => mixer.clipAction(a).play());

  const reticle = new THREE.Group(); reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);
  reticle.add(new THREE.Mesh(new THREE.RingGeometry(0.075, 0.095, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff })));
  reticle.add(new THREE.Mesh(new THREE.CircleGeometry(0.015, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffbe55 })));

  await renderer.xr.setSession(session);
  const viewer = await session.requestReferenceSpace("viewer");
  const hitSource = await session.requestHitTestSource({ space: viewer });
  const hint = q(".sx-hint"), hit = new THREE.Matrix4(); let hasHit = false, placed = false;

  // ---- size: pinch with two fingers (all the elements together, as they were placed in the editor) ----
  const KEY = "vvr-escala-" + (o.slug || "x"), MIN = 0.1, MAX = 10;
  let scale = 1; try { const v = parseFloat(localStorage.getItem(KEY)); if (v >= MIN && v <= MAX) scale = v; } catch (e) {}
  const pct = q(".sx-pct"), real = q(".sx-real");
  function setScale(s, save) {
    scale = Math.min(MAX, Math.max(MIN, s)); content.scale.setScalar(scale);
    pct.textContent = Math.round(scale * 100) + " %"; real.hidden = Math.abs(scale - 1) < 0.02;
    if (save) try { if (Math.abs(scale - 1) < 0.02) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(scale)); } catch (e) {}
  }
  setScale(scale, false);
  let pinch = null, pinchedAt = 0, ticks = 0, gesture = false, fingers = 0;   // gesture = this touch already pinched
  const touchDist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const pad = q(".sx-pinch");
  pad.addEventListener("touchstart", e => {
    fingers = e.touches.length; if (fingers === 1) gesture = false;
    if (e.touches.length === 2 && placed) { gesture = true; pinch = { d: touchDist(e.touches), s: scale }; pct.classList.add("big"); pinchedAt = performance.now(); }
  }, { passive: true });
  pad.addEventListener("touchmove", e => {
    if (!pinch || e.touches.length < 2) return;
    setScale(pinch.s * touchDist(e.touches) / Math.max(1, pinch.d), false); pinchedAt = performance.now();
    const step = Math.round(Math.log(scale) / Math.log(1.15)); if (step !== ticks) { ticks = step; sfx.tick(.7); }   // a little click as it grows or shrinks
  }, { passive: true });
  const pinchEnd = e => {
    fingers = e.touches.length;
    if (pinch && e.touches.length < 2) { pinch = null; pct.classList.remove("big"); setScale(scale, true); }
    if (gesture) pinchedAt = performance.now();   // until the last finger is up
  };
  pad.addEventListener("touchend", pinchEnd); pad.addEventListener("touchcancel", pinchEnd);
  real.addEventListener("click", () => { setScale(1, true); sfx.pop(); });

  session.addEventListener("select", () => {
    if (!hasHit) return;
    if (pinch || (gesture && fingers > 0) || performance.now() - pinchedAt < 450) return;   // the fingers of a pinch do not move it
    const p = new THREE.Vector3().setFromMatrixPosition(hit), cam = new THREE.Vector3().setFromMatrixPosition(renderer.xr.getCamera().matrixWorld);
    content.position.copy(p); content.rotation.set(0, Math.atan2(cam.x - p.x, cam.z - p.z), 0);   // facing you
    content.visible = true; placed = true; reticle.visible = false; sfx.appear();
    hint.textContent = "Pellizca con dos dedos para cambiar su tamaño · toca otro lugar para moverlo";
    q(".sx-size").hidden = false; q(".sx-bot").hidden = !camOk;
  });

  // ---- capture: camera picture + 3D → render target → 2D canvas with the logo ----
  let camOk = !session.enabledFeatures || session.enabledFeatures.includes("camera-access"), binding = null, ended = false;
  const camTex = new THREE.Texture();   // its WebGL texture is the camera's, set each frame
  const bg = new THREE.Scene(), bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  bg.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { map: { value: camTex } }, depthTest: false, depthWrite: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    // the camera gives sRGB values and the sRGB render target encodes on write: decode first so they come out as they were
    fragmentShader: "uniform sampler2D map; varying vec2 vUv; void main(){ vec4 c = texture2D(map, vUv); gl_FragColor = vec4(mix(c.rgb / 12.92, pow((c.rgb + 0.055) / 1.055, vec3(2.4)), step(0.04045, c.rgb)), 1.0); }",
  })));
  const shotCam = new THREE.PerspectiveCamera(); shotCam.matrixAutoUpdate = false; shotCam.matrixWorldAutoUpdate = false;
  const rt = new THREE.WebGLRenderTarget(2, 2); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const out = document.createElement("canvas"), ctx = out.getContext("2d");
  let pixels = null, img = null;
  const logo = o.brand ? Object.assign(new Image(), { src: o.brand.src }) : null;

  function grab(frame) {   // inside the frame: the camera picture only lives during it
    const pose = frame.getViewerPose(renderer.xr.getReferenceSpace()), view = pose && pose.views[0];
    if (!view || !view.camera) return false;
    binding ||= new XRWebGLBinding(session, gl);
    const glTex = binding.getCameraImage(view.camera); if (!glTex) return false;
    const k = Math.min(1, 1280 / Math.max(view.camera.width, view.camera.height));
    const W = Math.round(view.camera.width * k) & ~1, H = Math.round(view.camera.height * k) & ~1;
    if (rt.width !== W || rt.height !== H) { rt.setSize(W, H); out.width = W; out.height = H; pixels = new Uint8Array(W * H * 4); img = ctx.createImageData(W, H); }
    const props = renderer.properties.get(camTex); props.__webglTexture = glTex; props.__webglInit = true;
    shotCam.projectionMatrix.fromArray(view.projectionMatrix); shotCam.projectionMatrixInverse.copy(shotCam.projectionMatrix).invert();
    shotCam.matrixWorld.fromArray(view.transform.matrix); shotCam.matrixWorldInverse.copy(shotCam.matrixWorld).invert();
    const prev = renderer.getRenderTarget(), wasHit = reticle.visible;
    reticle.visible = false; renderer.xr.enabled = false;
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(bg, bgCam);
    renderer.autoClear = false; renderer.render(scene, shotCam); renderer.autoClear = true;
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, pixels);
    renderer.xr.enabled = true; renderer.setRenderTarget(prev); reticle.visible = wasHit;
    props.__webglTexture = null;
    // GL rows go bottom-up
    const row = W * 4; for (let y = 0; y < H; y++) img.data.set(pixels.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    ctx.putImageData(img, 0, 0);
    if (logo && logo.complete && logo.naturalWidth) {   // same place and size as the image AR's captures
      let lw = W * 0.32, lh = lw * logo.naturalHeight / logo.naturalWidth; const mh = H * 0.07; if (lh > mh) { lh = mh; lw = lh * logo.naturalWidth / logo.naturalHeight; }
      const lx = (W - lw) / 2, ly = H * 0.03;
      if (o.brand.own) { const p = lh * 0.3; ctx.fillStyle = "#fff"; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(lx - p * 2, ly - p, lw + p * 4, lh + p * 2, lh / 2 + p); else ctx.rect(lx - p * 2, ly - p, lw + p * 4, lh + p * 2); ctx.fill(); }
      ctx.drawImage(logo, lx, ly, lw, lh);
    }
    return true;
  }

  let mode = "photo", wantPhoto = false, recorder = null, chunks = [], recStart = 0, tick = 0, lastUrl = null, audioDest = null;
  const shut = q(".sx-shut"), timer = q(".sx-timer");
  ui.querySelectorAll(".sx-modes button").forEach(b => b.addEventListener("click", () => {
    if (recorder) return; mode = b.dataset.m;
    ui.querySelectorAll(".sx-modes button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    shut.classList.toggle("video", mode === "video"); shut.setAttribute("aria-label", mode === "video" ? "Grabar video" : "Tomar foto");
  }));
  const type = () => { for (const t of ["video/mp4;codecs=avc1,mp4a", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"]) if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t; return ""; };
  function startRec() {
    if (!window.MediaRecorder || !out.captureStream) return;
    const stream = out.captureStream(30);
    if (o.audio) try {   // the experience's audio goes into the video too
      if (!audioDest) { const ac = new (window.AudioContext || window.webkitAudioContext)(), src = ac.createMediaElementSource(o.audio); audioDest = ac.createMediaStreamDestination(); src.connect(ac.destination); src.connect(audioDest); }
      audioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    } catch (e) {}
    const t = type(); recorder = new MediaRecorder(stream, t ? { mimeType: t, videoBitsPerSecond: 6e6 } : undefined); chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => { const mt = recorder.mimeType || t || "video/webm"; recorder = null; show(new Blob(chunks, { type: mt }), "video"); };
    recorder.start(250); recStart = performance.now(); shut.classList.add("rec"); shut.setAttribute("aria-label", "Detener grabación"); timer.hidden = false;
    tick = setInterval(() => { const s = Math.floor((performance.now() - recStart) / 1000); timer.textContent = `0:${String(s).padStart(2, "0")}`; if (s >= 30) stopRec(); }, 250);
  }
  function stopRec() { clearInterval(tick); timer.hidden = true; timer.textContent = "0:00"; shut.classList.remove("rec"); shut.setAttribute("aria-label", "Grabar video"); if (recorder && recorder.state !== "inactive") recorder.stop(); }
  shut.addEventListener("click", () => {
    if (mode === "photo") { sfx.shutter(); q(".sx-flash").classList.add("on"); setTimeout(() => q(".sx-flash").classList.remove("on"), 80); wantPhoto = true; }
    else if (recorder) { sfx.recStop(); stopRec(); } else { sfx.recStart(); startRec(); }
  });
  const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
  function show(blob, kind) {
    if (!blob || !blob.size) return;
    if (lastUrl) URL.revokeObjectURL(lastUrl); lastUrl = URL.createObjectURL(blob);
    const name = `VorticeVR-${o.slug}-${stamp()}.${kind === "image" ? "jpg" : (blob.type.includes("mp4") ? "mp4" : "webm")}`;
    const media = q(".sx-media"); media.replaceChildren();
    const el = document.createElement(kind === "image" ? "img" : "video"); el.src = lastUrl;
    if (kind === "video") { el.controls = true; el.playsInline = true; el.autoplay = true; el.muted = true; el.loop = true; } else el.alt = "Tu foto en realidad aumentada";
    media.appendChild(el); q(".sx-dl").href = lastUrl; q(".sx-dl").download = name;
    const file = new File([blob], name, { type: blob.type });
    q(".sx-share").hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    q(".sx-share").onclick = async () => { try { await navigator.share({ files: [file], title: o.title || "Realidad aumentada" }); } catch (e) {} };
    q(".sx-sheet").hidden = false;
  }
  q(".sx-close").addEventListener("click", () => { q(".sx-sheet").hidden = true; q(".sx-media").replaceChildren(); if (ended) ui.remove(); });
  q(".sx-x").addEventListener("click", () => session.end());

  const clock = new THREE.Clock();
  renderer.setAnimationLoop((t, frame) => {
    const dt = clock.getDelta(); if (!frame) return;
    const hits = frame.getHitTestResults(hitSource);
    hasHit = hits.length > 0;
    if (hasHit) hit.fromArray(hits[0].getPose(renderer.xr.getReferenceSpace()).transform.matrix);
    reticle.visible = hasHit && !placed; if (reticle.visible) reticle.matrix.copy(hit);
    if (!placed) hint.textContent = hasHit ? "Toca la pantalla para ponerlo aquí" : "Apunta al piso o a una mesa y mueve el celular despacio";
    if (mixer) mixer.update(dt);
    renderer.render(scene, camera);
    if (placed && (wantPhoto || recorder)) {
      let ok = false; try { ok = grab(frame); } catch (e) { console.error(e); }
      if (!ok && camOk) { camOk = false; q(".sx-bot").hidden = true; stopRec(); hint.textContent = "Tu celular no permite tomar fotos aquí: usa la captura de pantalla"; }
      if (wantPhoto) { wantPhoto = false; if (ok) out.toBlob(b => show(b, "image"), "image/jpeg", 0.92); }
    }
  });

  session.addEventListener("end", () => {
    ended = true; stopRec(); renderer.setAnimationLoop(null); hitSource.cancel && hitSource.cancel();
    rt.dispose(); renderer.dispose(); renderer.domElement.remove();
    if (o.audio) o.audio.pause();
    if (q(".sx-sheet").hidden) ui.remove(); else { q(".sx-top").hidden = true; q(".sx-hint").hidden = true; q(".sx-bot").hidden = true; q(".sx-size").hidden = true; q(".sx-pinch").hidden = true; }   // a capture still on view stays
    o.onEnd && o.onEnd();
  });
}
