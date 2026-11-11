// The USDZ that iPhone opens in Quick Look ("Realidad aumentada en superficie"), made here instead of by model-viewer so
// it keeps what model-viewer leaves out:
//   · the motions in a loop and the sparkles: three's USDZExporter writes still meshes, so each mesh that moves gets its
//     transform as time samples (FPS per second over the "magia" clip; Quick Look plays them on its own, in a loop)
//   · the 3D's own animation (a character that dances): its skeleton and its frames as UsdSkel (skeletal(), below)
//   · the music, only when asked (?musica=archivo): inside the file, with Apple's AR behaviors (on entering the scene →
//     play, in a loop if it repeats). Quick Look then shows its player instead of its camera button, so by default the
//     page plays it.
// The zip is written again so every file starts at a multiple of 64 bytes (USDZ needs it).
import * as THREE from "three";

const FPS = 15;
const n6 = v => { if (Math.abs(v) < 1e-9) return 0; return Number(v.toPrecision(6)); };   // keeps tiny scales (a sparkle at rest) above zero
const matrix = m => { const e = m.elements; return `( (${n6(e[0])}, ${n6(e[1])}, ${n6(e[2])}, ${n6(e[3])}), (${n6(e[4])}, ${n6(e[5])}, ${n6(e[6])}, ${n6(e[7])}), (${n6(e[8])}, ${n6(e[9])}, ${n6(e[10])}, ${n6(e[11])}), (${n6(e[12])}, ${n6(e[13])}, ${n6(e[14])}, ${n6(e[15])}) )`; };

// world: the scene (the floor group of superficie.js) · clips: its clips ("magia" and each 3D's own animation; they all
// play at once, like in our Android view) · audio: {url, loop} or null
export async function sceneUSDZ(world, clips, audio) {
  const [{ USDZExporter }, ff] = await Promise.all([import("three/addons/exporters/USDZExporter.js"), import("three/addons/libs/fflate.module.js")]);
  const meshes = []; world.traverse(o => { if (o.isMesh) meshes.push(o); });
  clips = (clips || []).filter(Boolean);

  // where every mesh (and every bone of a character) is at each frame. Quick Look repeats the whole timeline, so it
  // lasts whole turns of the longest 3D animation (close to the "magia" clip, so a dance is never cut) or, without
  // one, the "magia" clip; the shorter ones repeat inside it. Only what moves keeps its frames.
  let frames = 0, moving = [], skels = [];
  if (clips.length) {
    const magic = clips.find(c => c.name === "magia"), own = Math.max(0, ...clips.filter(c => c !== magic).map(c => c.duration));
    const D = own ? own * Math.max(1, Math.round((magic ? magic.duration : own) / own)) : magic.duration;
    const mixer = new THREE.AnimationMixer(world); clips.forEach(c => mixer.clipAction(c).play());
    frames = Math.round(D * FPS);
    const at = meshes.map(() => []), bones = meshes.map(() => []);
    for (let f = 0; f <= frames; f++) {
      mixer.setTime(Math.min(D - 1e-4, f / FPS)); world.updateMatrixWorld(true);
      meshes.forEach((m, i) => { at[i].push(m.matrixWorld.clone()); if (m.isSkinnedMesh) bones[i].push(m.skeleton.bones.map(b => b.matrixWorld.clone())); });
    }
    mixer.setTime(0); mixer.stopAllAction(); mixer.uncacheRoot(world); world.updateMatrixWorld(true);
    moving = meshes.map((m, i) => ({ m, list: at[i] })).filter(x => !x.m.isSkinnedMesh && x.list.some(mt => !mt.equals(x.list[0])));
    skels = meshes.map((m, i) => ({ m, list: bones[i] })).filter(x => x.m.isSkinnedMesh && x.list.some(fr => fr.some((mt, j) => !mt.equals(x.list[0][j]))));
  }

  const usdz = await new USDZExporter().parse(world, { quickLookCompatible: true, maxTextureSize: 2048 });
  const files = ff.unzipSync(usdz);
  let usda = ff.strFromU8(files["model.usda"]);

  if (moving.length || skels.length) usda = usda.replace('\tupAxis = "Y"\n', `\tupAxis = "Y"\n\tstartTimeCode = 0\n\tendTimeCode = ${frames}\n\ttimeCodesPerSecond = ${FPS}\n`);
  for (const { m, list } of moving) {
    const head = usda.indexOf(`def Xform "Object_${m.id}"`); if (head < 0) continue;
    const a = usda.indexOf("matrix4d xformOp:transform = ", head), b = usda.indexOf("\n", a); if (a < 0 || b < 0) continue;
    // a frame equal to the one before and the one after adds nothing (values in between are interpolated)
    const keep = list.map((mt, f) => f === 0 || f === list.length - 1 || !mt.equals(list[f - 1]) || !mt.equals(list[f + 1]));
    usda = usda.slice(0, a) + `matrix4d xformOp:transform.timeSamples = {\n${list.map((mt, f) => keep[f] ? `\t\t${f}: ${matrix(mt)},` : "").filter(Boolean).join("\n")}\n\t}` + usda.slice(b);
  }
  for (const s of skels) usda = skeletal(usda, files, ff, s);

  if (audio && audio.url) {
    const r = await fetch(audio.url); if (!r.ok) throw new Error("audio");
    const type = r.headers.get("content-type") || "", ext = /mpeg|mp3/.test(type) ? "mp3" : "m4a";
    files["audio." + ext] = new Uint8Array(await r.arrayBuffer());
    const anchor = 'token preliminary:planeAnchoring:alignment = "horizontal"\n';
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

// A character with its animation (a dance, walking…): three's USDZExporter writes the mesh still, in its bind pose (the
// "T"), so its Xform becomes a SkelRoot with the mesh inline, its Skeleton and a SkelAnimation (UsdSkel, which Quick
// Look plays). Three draws world = Σ w · bone.matrixWorld · boneInverse · bindMatrix · v; here the skeleton's space is
// the mesh's (M), so each joint is M⁻¹ · bone.matrixWorld (S). Quick Look puts the lowest point of the mesh *without*
// skinning on the floor, so the points are written already where the root joint has them in the first frame
// (v' = A · v, A = S_root · boneInverse_root · bindMatrix; without it the character floated half its height) and each
// bind transform is A · bindMatrix⁻¹ · boneInverse⁻¹, which keeps the same result. Joints go parents first (UsdSkel
// needs it), so the vertices' joint indices are renumbered.
function skeletal(usda, files, ff, { m, list }) {
  const head = usda.indexOf(`def Xform "Object_${m.id}"`), end = usda.indexOf("\n}\n", head);
  const geoName = `geometries/Geometry_${m.geometry.id}.usda`, geo = files[geoName] && ff.strFromU8(files[geoName]);
  const sIdx = m.geometry.attributes.skinIndex, sW = m.geometry.attributes.skinWeight;
  if (head < 0 || end < 0 || !geo || !sIdx || !sW) return usda;
  const g0 = geo.indexOf("{", geo.indexOf('def Mesh "Geometry"')) + 1, g1 = geo.indexOf("uniform token subdivisionScheme", g0);
  if (g0 < 1 || g1 < 0) return usda;
  const block = usda.slice(head, end) + "\n";   // its last line ends here too
  const line = k => { const a = block.indexOf(k); return a < 0 ? "" : block.slice(a, block.indexOf("\n", a)); };

  const bones = m.skeleton.bones, inv = m.skeleton.boneInverses;
  const parent = bones.map(b => { let p = b.parent; while (p && !bones.includes(p)) p = p.parent; return p ? bones.indexOf(p) : -1; });
  const order = [], walk = i => { order.push(i); bones.forEach((_, c) => { if (parent[c] === i) walk(c); }); };
  bones.forEach((_, i) => { if (parent[i] < 0) walk(i); });
  const pos = []; order.forEach((o, k) => { pos[o] = k; });
  const path = i => (parent[i] < 0 ? "" : path(parent[i]) + "/") + "j" + i;
  const joints = `[${order.map(i => `"${path(i)}"`).join(", ")}]`;

  const Minv = m.matrixWorld.clone().invert(), tmp = new THREE.Matrix4();
  const local = (fr, i) => parent[i] < 0 ? tmp.multiplyMatrices(Minv, fr[i]).clone() : tmp.copy(fr[parent[i]]).invert().multiply(fr[i]).clone();
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const r0 = order[0], A = Minv.clone().multiply(list[0][r0]).multiply(inv[r0]).multiply(m.bindMatrix);
  const toA = A.clone().multiply(m.bindMatrix.clone().invert()), bindOf = i => toA.clone().multiply(inv[i].clone().invert());
  const N = new THREE.Matrix3().getNormalMatrix(A), attr = m.geometry.attributes;
  const vec = (a, mt, normal) => { const out = []; for (let v = 0; v < a.count; v++) { p.fromBufferAttribute(a, v); if (normal) p.applyMatrix3(mt).normalize(); else p.applyMatrix4(mt); out.push(`(${n6(p.x)}, ${n6(p.y)}, ${n6(p.z)})`); } return out.join(", "); };
  let body = geo.slice(g0, g1).trimEnd().replace(/point3f\[\] points = \[[^\]]*\]/, () => `point3f[] points = [${vec(attr.position, A)}]`);
  if (attr.normal) body = body.replace(/normal3f\[\] normals = \[[^\]]*\]/, () => `normal3f[] normals = [${vec(attr.normal, N, true)}]`);
  const T = [], R = [], S = [];
  list.forEach((fr, f) => {
    const t = [], r = [], sc = [];
    for (const i of order) {
      local(fr, i).decompose(p, q, s); q.normalize();
      t.push(`(${n6(p.x)}, ${n6(p.y)}, ${n6(p.z)})`); r.push(`(${n6(q.w)}, ${n6(q.x)}, ${n6(q.y)}, ${n6(q.z)})`); sc.push(`(${n6(s.x)}, ${n6(s.y)}, ${n6(s.z)})`);
    }
    T.push(`\t\t\t${f}: [${t.join(", ")}],`); R.push(`\t\t\t${f}: [${r.join(", ")}],`); S.push(`\t\t\t${f}: [${sc.join(", ")}],`);
  });

  const ji = [], jw = [];
  for (let v = 0; v < sIdx.count; v++) {
    ji.push(pos[sIdx.getX(v)] ?? 0, pos[sIdx.getY(v)] ?? 0, pos[sIdx.getZ(v)] ?? 0, pos[sIdx.getW(v)] ?? 0);
    jw.push(n6(sW.getX(v)), n6(sW.getY(v)), n6(sW.getZ(v)), n6(sW.getW(v)));
  }
  const at = `/Root/Scenes/Scene/Object_${m.id}`;
  const out = `def SkelRoot "Object_${m.id}" (
	prepend apiSchemas = ["MaterialBindingAPI"]
)
{
	${line("matrix4d xformOp:transform")}
	uniform token[] xformOpOrder = ["xformOp:transform"]
	${line("rel material:binding")}

	def Skeleton "Skel" (
		prepend apiSchemas = ["SkelBindingAPI"]
	)
	{
		uniform token[] joints = ${joints}
		uniform matrix4d[] bindTransforms = [${order.map(i => matrix(bindOf(i))).join(", ")}]
		uniform matrix4d[] restTransforms = [${order.map(i => matrix(local(list[0], i))).join(", ")}]
		rel skel:animationSource = <${at}/Anim>
	}

	def SkelAnimation "Anim"
	{
		uniform token[] joints = ${joints}
		float3[] translations.timeSamples = {
${T.join("\n")}
		}
		quatf[] rotations.timeSamples = {
${R.join("\n")}
		}
		half3[] scales.timeSamples = {
${S.join("\n")}
		}
	}

	def Mesh "Geometry" (
		prepend apiSchemas = ["SkelBindingAPI"]
	)
	{${body}
		int[] primvars:skel:jointIndices = [${ji.join(", ")}] (
			elementSize = 4
			interpolation = "vertex"
		)
		float[] primvars:skel:jointWeights = [${jw.join(", ")}] (
			elementSize = 4
			interpolation = "vertex"
		)
		matrix4d primvars:skel:geomBindTransform = ${matrix(new THREE.Matrix4())}
		rel skel:skeleton = <${at}/Skel>
		uniform token subdivisionScheme = "none"
	}`;
  usda = usda.slice(0, head) + out + usda.slice(end);
  if (!usda.includes(`@./${geoName}@`)) delete files[geoName];   // nobody else uses that geometry
  return usda;
}
