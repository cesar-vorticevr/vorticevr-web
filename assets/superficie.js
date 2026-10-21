// "Realidad aumentada en superficie" (data.kind = "superficie"): 3D objects, images and texts that appear on the
// floor or on a table, with no image to look for. Used by /x/.
// The elements are built with assets/escena.js (same placement as the editor; 1 unit = 1 meter), joined into one GLB
// in the phone (GLTFExporter) and shown with <model-viewer>: Android opens it with WebXR (floor detection, walk around
// it) and iPhone with Quick Look (model-viewer turns it into USDZ; the animations of the 3D are not kept there).
import * as THREE from "three";
import * as ESC from "./escena.js";

const MV_SRC = "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js";
let mvP = null;
const loadModelViewer = () => mvP || (mvP = new Promise((ok, bad) => {
  if (customElements.get("model-viewer")) return ok();
  const s = document.createElement("script"); s.type = "module"; s.src = MV_SRC;
  s.onload = () => customElements.whenDefined("model-viewer").then(ok); s.onerror = () => { mvP = null; bad(new Error("model-viewer")); };
  document.head.appendChild(s);
}));

// Pictures and texts: unlit in the editor; in the GLB they become "emissive" so they keep their colors in any light
// (also in Quick Look, which has no unlit materials). The texture still gives the transparency.
function glowing(m) {
  return new THREE.MeshStandardMaterial({ color: 0x000000, map: m.map, emissive: 0xffffff, emissiveMap: m.map, roughness: 1, metalness: 0, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide });
}

// items → GLB (ArrayBuffer). url(it): its file.
export async function sceneGLB(items, url) {
  items = items.filter(i => i.type !== "audio");   // the page plays it
  if (items.some(i => i.type === "text") && !document.getElementById("fonts")) document.head.appendChild(Object.assign(document.createElement("link"), { id: "fonts", rel: "stylesheet", href: ESC.FONT_CSS }));
  const world = new THREE.Group(); world.name = "escena"; world.rotation.x = -Math.PI / 2;   // the editor's floor, lying down
  const clips = [];
  const nodes = await Promise.all(items.map(async (it, i) => {
    try { return await ESC.build(it, { url: url(it) }); } catch (e) { console.error(e); return null; }   // one that fails does not stop the rest
  }));
  nodes.forEach((n, i) => {
    if (!n) return;
    const it = items[i];
    ESC.place(n, it, 1, i); n.root.name = "e" + i; world.add(n.root);
    n.root.traverse(o => {
      if (!o.isMesh) return;
      if (n.plane) o.material = glowing(o.material);
    });
    // its animation: node names get a prefix so two 3D objects with the same names do not mix
    const clip = n.anims && it.anim >= 0 && n.anims[it.anim];
    if (clip) {
      const p = `e${i}_`, names = new Set();
      n.inner.traverse(o => { if (o.name) { names.add(o.name); o.name = p + o.name; } });
      const c = clip.clone(); c.name = p + (clip.name || "anim");
      c.tracks = c.tracks.filter(t => names.has(t.name.slice(0, t.name.lastIndexOf(".")))); c.tracks.forEach(t => { t.name = p + t.name; });
      if (c.tracks.length) clips.push(c);
    }
  });
  if (!world.children.length) throw new Error("items");
  world.updateMatrixWorld(true);
  const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
  return new GLTFExporter().parseAsync(world, { binary: true, animations: clips, onlyVisible: true, maxTextureSize: 2048 });
}

const AR_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3 6.7 3.7L12 11.7 5.3 8 12 4.3zM5 9.7l6 3.4v6.6l-6-3.3V9.7zm8 10V13l6-3.4v6.7l-6 3.4z"/></svg>';
const SND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm16.6 3 2.1-2.1-1.4-1.4-2.1 2.1-2.1-2.1-1.4 1.4 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1 1.4-1.4-2.1-2.1z"/></svg>';
const CSS = `
.sf-snd{position:absolute;right:14px;top:10px;z-index:2;width:44px;height:44px;border-radius:50%;border:1px solid rgba(210,184,255,.35);background:rgba(10,4,22,.62);display:grid;place-items:center;cursor:pointer}
.sf-snd svg{width:22px;height:22px;fill:#fff}
.sf{position:fixed;inset:0;display:flex;flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch;background:radial-gradient(90% 60% at 50% 35%,#22104a,#05020b 72%);color:#f2ecff;font-family:"IBM Plex Sans",system-ui,sans-serif}
.sf-top{padding:calc(62px + env(safe-area-inset-top,0px)) 20px 0;text-align:center}
.sf-k{font:600 .74rem "Sora",system-ui,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#ffbe55}
.sf h1{font:700 clamp(1.4rem,5.6vw,2.1rem)/1.12 "Sora",system-ui,sans-serif;margin:8px auto 0;max-width:20ch;text-wrap:balance}
.sf-stage{position:relative;flex:1 0 auto;min-height:180px}
.sf-stage model-viewer{position:absolute;inset:0;width:100%;height:100%;--poster-color:transparent;background:transparent}
.sf-stage model-viewer::part(default-ar-button){display:none}
.sf-load{position:absolute;inset:0;display:grid;place-items:center;color:#b9addb;font-weight:600;text-align:center;padding:20px}
.sf-load::before{content:"";width:46px;height:46px;border-radius:50%;border:3px solid rgba(210,184,255,.25);border-top-color:#d2b8ff;animation:sfspin 1s linear infinite;display:block;margin:0 auto 12px}
.sf-load.err::before{display:none}
@keyframes sfspin{to{transform:rotate(360deg)}}
.sf-hint{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);font-size:.8rem;color:#b9addb;background:rgba(10,4,22,.55);padding:5px 12px;border-radius:999px;white-space:nowrap;pointer-events:none}
.sf-bot{display:flex;flex-direction:column;align-items:center;gap:12px;padding:6px 18px calc(22px + env(safe-area-inset-bottom,0px))}
.sf-ar{font:700 .95rem "Sora",system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;border:1px solid #d2b8ff;border-radius:999px;padding:16px 28px;color:#fff;background:linear-gradient(135deg,#8b3fd6,#5a1f8f);box-shadow:0 0 30px rgba(139,63,214,.55);display:inline-flex;align-items:center;gap:10px;cursor:pointer}
.sf-ar svg{width:22px;height:22px;fill:#fff}
.sf-ar:disabled{opacity:.55}
.sf-note{margin:0;max-width:36ch;text-align:center;color:#b9addb;font-size:.88rem;line-height:1.45}
.sf-steps{margin:0;padding:0;list-style:none;display:grid;gap:4px;color:#b9addb;font-size:.86rem;text-align:left;max-width:36ch}
.sf-steps b{color:#f2ecff}
.sf-soc{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
.sf-soc a{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(10,4,22,.62);border:1px solid rgba(210,184,255,.35)}
.sf-soc svg{width:21px;height:21px;fill:#fff}
@media (prefers-reduced-motion:reduce){.sf-load::before{animation:none}}
`;

// o: { root, cfg, url(it), buttons: [{href, label, svg}], brand: {src, own} | null (logo on the captures) }
export async function run(o) {
  const cfg = o.cfg;
  if (!document.getElementById("sf-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "sf-css", textContent: CSS }));
  const el = document.createElement("div"); el.className = "sf";
  const types = new Set((cfg.items || []).map(i => i.type));
  el.innerHTML = `<div class="sf-top"><div class="sf-k"></div><h1></h1></div>
    <div class="sf-stage"><div class="sf-load">Preparando tu experiencia…</div></div>
    <div class="sf-bot"><button class="sf-ar" type="button" hidden>${AR_ICON}<span>Verlo en tu espacio</span></button>
      <ol class="sf-steps" hidden><li>1. Toca <b>Verlo en tu espacio</b>.</li><li>2. Apunta al <b>piso o a una mesa</b> y mueve el celular despacio.</li><li>3. Cuando aparezca, camina a su alrededor.</li></ol>
      <p class="sf-note" hidden></p><nav class="sf-soc" aria-label="Redes"></nav></div>`;
  el.querySelector(".sf-k").textContent = types.size === 1 && types.has("model") ? "Objeto en 3D para tu espacio" : "Realidad aumentada en tu espacio";
  el.querySelector("h1").textContent = cfg.title || "Realidad aumentada";
  const soc = el.querySelector(".sf-soc");
  for (const b of o.buttons || []) { const a = document.createElement("a"); a.href = b.href; a.target = "_blank"; a.rel = "noopener"; a.setAttribute("aria-label", b.label); a.innerHTML = b.svg; soc.appendChild(a); }
  o.root.appendChild(el);
  const stage = el.querySelector(".sf-stage"), load = el.querySelector(".sf-load"), btn = el.querySelector(".sf-ar"), note = el.querySelector(".sf-note"), steps = el.querySelector(".sf-steps");
  const fail = t => { load.classList.add("err"); load.textContent = t; };

  let glb;
  try { [glb] = await Promise.all([sceneGLB(cfg.items || [], o.url), loadModelViewer()]); }
  catch (e) { console.error(e); fail("No se pudo cargar la experiencia. Revisa tu conexión y vuelve a abrir el link."); return; }

  const mv = document.createElement("model-viewer");
  mv.setAttribute("alt", cfg.title || "Experiencia en 3D");
  for (const [k, v] of [["camera-controls", ""], ["auto-rotate", ""], ["auto-rotate-delay", "1500"], ["rotation-per-second", "20deg"], ["autoplay", ""], ["shadow-intensity", "1"],
    ["environment-image", "neutral"], ["exposure", "1.05"], ["ar", ""], ["ar-modes", "webxr quick-look"], ["ar-scale", "auto"], ["ar-placement", "floor"],
    ["interaction-prompt", "none"], ["touch-action", "pan-y"], ["camera-orbit", "0deg 70deg auto"]]) mv.setAttribute(k, v);
  mv.setAttribute("src", URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" })));
  // Android (WebXR): our own view, with photo and video with the logo (assets/superficie-xr.js). iPhone: Quick Look.
  let XR = null;
  try { if (navigator.xr && await navigator.xr.isSessionSupported("immersive-ar")) XR = await import("./superficie-xr.js"); } catch (e) { XR = null; }
  steps.lastElementChild.innerHTML = XR ? "3. Toca la pantalla para ponerlo, <b>pellizca con dos dedos</b> para hacerlo más grande o más chico y toma tu <b>foto o video</b>." : "3. <b>Pellizca con dos dedos</b> para hacerlo más grande o más chico y camina a su alrededor. Para tu <b>foto</b>, toca el botón blanco de abajo; para <b>video</b>, mantenlo presionado.";
  mv.addEventListener("load", () => {
    load.remove();
    stage.appendChild(Object.assign(document.createElement("span"), { className: "sf-hint", textContent: "Gíralo con el dedo" }));
    const show = () => {
      const can = !!XR || !!mv.canActivateAR, phone = matchMedia("(hover: none)").matches;
      btn.hidden = !can; steps.hidden = !can; note.hidden = can;
      note.textContent = phone ? "Tu celular no permite ver esto en tu espacio. Puedes girarlo aquí con el dedo." : "Abre este link en tu celular para verlo en tu espacio, sobre el piso o una mesa.";
    };
    show(); setTimeout(show, 700); setTimeout(show, 2500);   // canActivateAR is known a moment after the model loads
  });
  mv.addEventListener("error", () => fail("No se pudo mostrar la experiencia."));

  // its audio: it starts with "Verlo en tu espacio" (inside the tap, so phones let it sound) and stops when the camera
  // closes (Android); the button on the stage plays or stops it at any time (also to try it here)
  const au = (cfg.items || []).find(i => i.type === "audio");
  let audio = null, sndBtn = null;
  if (au) {
    audio = new Audio(); audio.preload = "auto"; audio.loop = au.loop !== false; audio.src = o.url(au);
    sndBtn = Object.assign(document.createElement("button"), { type: "button", className: "sf-snd" });
    const paint = () => { sndBtn.innerHTML = audio.paused ? SND_OFF : SND_ON; sndBtn.setAttribute("aria-label", audio.paused ? "Escuchar el audio" : "Parar el audio"); };
    ["play", "pause", "ended"].forEach(ev => audio.addEventListener(ev, paint)); paint();
    sndBtn.onclick = () => { if (audio.paused) { if (audio.ended) audio.currentTime = 0; audio.play().catch(() => {}); } else audio.pause(); };
    stage.appendChild(sndBtn);
  }
  mv.addEventListener("ar-status", e => {
    const st = e.detail.status;
    if (st === "failed") { note.hidden = false; note.textContent = "No se pudo abrir la cámara. Prueba en Chrome (Android) o Safari (iPhone), no dentro de Instagram o WhatsApp."; }
    if (audio && (st === "not-presenting" || st === "failed")) audio.pause();
  });
  btn.onclick = () => {
    if (XR) {   // the session is asked for right inside this tap
      if (sndBtn) sndBtn.hidden = true;
      XR.startXR({ glb, brand: o.brand, slug: cfg.slug, title: cfg.title, audio, onEnd: () => { if (sndBtn) sndBtn.hidden = false; } })
        .catch(e => { console.error(e); if (sndBtn) sndBtn.hidden = false; note.hidden = false; note.textContent = "No se pudo abrir la cámara. Prueba en Chrome, no dentro de Instagram o WhatsApp."; });
      return;
    }
    if (audio) { try { audio.currentTime = 0; } catch (e) {} audio.play().catch(() => {}); }
    mv.activateAR();
  };
  stage.prepend(mv);
}
