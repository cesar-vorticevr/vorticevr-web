// The USDZ that iPhone opens in Quick Look ("Realidad aumentada en superficie"), made here instead of by model-viewer so
// it keeps what model-viewer leaves out:
//   · the motions in a loop and the sparkles: three's USDZExporter writes still meshes, so each mesh that moves gets its
//     transform as time samples (FPS per second over the "magia" clip; Quick Look plays them on its own, in a loop)
//   · the music: inside the file, with Apple's AR behaviors (on entering the scene → play, in a loop if it repeats)
// The zip is written again so every file starts at a multiple of 64 bytes (USDZ needs it).
import * as THREE from "three";

const FPS = 15;
const n6 = v => { if (Math.abs(v) < 1e-9) return 0; return Number(v.toPrecision(6)); };   // keeps tiny scales (a sparkle at rest) above zero
const matrix = m => { const e = m.elements; return `( (${n6(e[0])}, ${n6(e[1])}, ${n6(e[2])}, ${n6(e[3])}), (${n6(e[4])}, ${n6(e[5])}, ${n6(e[6])}, ${n6(e[7])}), (${n6(e[8])}, ${n6(e[9])}, ${n6(e[10])}, ${n6(e[11])}), (${n6(e[12])}, ${n6(e[13])}, ${n6(e[14])}, ${n6(e[15])}) )`; };

// world: the scene (the floor group of superficie.js) · clip: its "magia" clip or null · audio: {url, loop} or null
export async function sceneUSDZ(world, clip, audio) {
  const [{ USDZExporter }, ff] = await Promise.all([import("three/addons/exporters/USDZExporter.js"), import("three/addons/libs/fflate.module.js")]);
  const meshes = []; world.traverse(o => { if (o.isMesh) meshes.push(o); });

  // where every mesh is at each frame of the clip (only the ones that move keep them)
  let frames = 0, moving = [];
  if (clip) {
    const mixer = new THREE.AnimationMixer(world); mixer.clipAction(clip).play();
    frames = Math.round(clip.duration * FPS);
    const at = meshes.map(() => []);
    for (let f = 0; f <= frames; f++) {
      mixer.setTime(Math.min(clip.duration - 1e-4, f / FPS)); world.updateMatrixWorld(true);
      meshes.forEach((m, i) => at[i].push(m.matrixWorld.clone()));
    }
    mixer.setTime(0); mixer.stopAllAction(); mixer.uncacheRoot(world); world.updateMatrixWorld(true);
    moving = meshes.map((m, i) => ({ m, list: at[i] })).filter(x => x.list.some(mt => !mt.equals(x.list[0])));
  }

  const usdz = await new USDZExporter().parse(world, { quickLookCompatible: true, maxTextureSize: 2048 });
  const files = ff.unzipSync(usdz);
  let usda = ff.strFromU8(files["model.usda"]);

  if (moving.length) {
    usda = usda.replace('\tupAxis = "Y"\n', `\tupAxis = "Y"\n\tstartTimeCode = 0\n\tendTimeCode = ${frames}\n\ttimeCodesPerSecond = ${FPS}\n`);
    for (const { m, list } of moving) {
      const head = usda.indexOf(`def Xform "Object_${m.id}"`); if (head < 0) continue;
      const a = usda.indexOf("matrix4d xformOp:transform = ", head), b = usda.indexOf("\n", a); if (a < 0 || b < 0) continue;
      // a frame equal to the one before and the one after adds nothing (values in between are interpolated)
      const keep = list.map((mt, f) => f === 0 || f === list.length - 1 || !mt.equals(list[f - 1]) || !mt.equals(list[f + 1]));
      usda = usda.slice(0, a) + `matrix4d xformOp:transform.timeSamples = {\n${list.map((mt, f) => keep[f] ? `\t\t${f}: ${matrix(mt)},` : "").filter(Boolean).join("\n")}\n\t}` + usda.slice(b);
    }
  }

  if (audio && audio.url) {
    const r = await fetch(audio.url); if (!r.ok) throw new Error("audio");
    const type = r.headers.get("content-type") || "", ext = /mpeg|mp3/.test(type) ? "mp3" : "m4a";
    files["audio." + ext] = new Uint8Array(await r.arrayBuffer());
    const anchor = 'token preliminary:planeAnchoring:alignment = "horizontal"\n';
    if (audio.mode === "ambiente") {   // test: a plain audio of the file (UsdMedia SpatialAudio), without behaviors
      const prim = `\n\t\tdef SpatialAudio "Musica"\n\t\t{\n\t\t\tuniform asset filePath = @audio.${ext}@\n\t\t\tuniform token auralMode = "nonSpatial"\n\t\t\tuniform token playbackMode = "${audio.loop ? "loopFromStart" : "onceFromStart"}"\n\t\t\tuniform timecode startTime = 0\n\t\t\tdouble gain = 1\n\t\t}\n`;
      const at = usda.indexOf(anchor); if (at >= 0) usda = usda.slice(0, at + anchor.length) + prim + usda.slice(at + anchor.length);
      files["model.usda"] = ff.strToU8(usda);
      return zip(files);
    }
    const S = "/Root/Scenes/Scene/Musica";
    const play = (name, ind) => `${ind}def Preliminary_Action "${name}"\n${ind}{\n${ind}\trel affectedObjects = </Root/Scenes/Scene>\n${ind}\ttoken info:id = "Audio"\n${ind}\ttoken type = "play"\n${ind}\tasset audio = @audio.${ext}@\n${ind}\tdouble gain = 1\n${ind}\ttoken auralMode = "nonSpatial"\n${ind}\ttoken multiplePerformOperation = "allow"\n${ind}}\n`;
    const action = audio.loop
      ? `\t\t\tdef Preliminary_Action "Repetir"\n\t\t\t{\n\t\t\t\trel actions = [ <${S}/Repetir/Sonar> ]\n\t\t\t\ttoken info:id = "Group"\n\t\t\t\tbool loops = 1\n\t\t\t\tint performCount = 0\n\t\t\t\ttoken type = "serial"\n\n${play("Sonar", "\t\t\t\t")}\t\t\t}\n`
      : play("Sonar", "\t\t\t");
    const behavior = `\n\t\tdef Preliminary_Behavior "Musica"\n\t\t{\n\t\t\trel triggers = [ <${S}/Inicio> ]\n\t\t\trel actions = [ <${S}/${audio.loop ? "Repetir" : "Sonar"}> ]\n\t\t\tuniform bool exclusive = 0\n\n\t\t\tdef Preliminary_Trigger "Inicio"\n\t\t\t{\n\t\t\t\ttoken info:id = "SceneTransition"\n\t\t\t\ttoken type = "enter"\n\t\t\t}\n\n${action}\t\t}\n`;
    const at = usda.indexOf(anchor); if (at >= 0) usda = usda.slice(0, at + anchor.length) + behavior + usda.slice(at + anchor.length);
  }
  files["model.usda"] = ff.strToU8(usda);
  return zip(files);

  // zip again, model.usda first, each file's data aligned to 64 bytes (an "extra" field pads the local header)
  function zip(files) {
  const out = {}, order = ["model.usda", ...Object.keys(files).filter(k => k !== "model.usda")];
  let offset = 0;
  for (const name of order) {
    const data = files[name], head = 30 + name.length + 4, pad = (64 - ((offset + head) % 64)) % 64;
    out[name] = [data, { level: 0, extra: { 12345: new Uint8Array(pad) } }];
    offset += head + pad + data.length;
  }
  return new Blob([ff.zipSync(out, { level: 0 })], { type: "model/vnd.usdz+zip" });
  }
}
