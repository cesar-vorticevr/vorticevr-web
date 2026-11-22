// Jardín de fantasía: buganvilias, lavanda, flores, cipreses, limoneros y cascadas de piedra caliza.
// Todo instanciado (una malla por tipo) para que no pese en el celular. Se llenan las listas y al final se llama plantar().
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const PALETAS = {
  // con hojas verdes entre las flores para que no se vea como un bloque de color
  buganvilia: ["#c8226e", "#d93a86", "#a8237e", "#e2508f", "#b52d8f", "#4f7a3a", "#5e8a45"],
  lavanda: ["#9a7bd0", "#8c6cc4", "#b195de", "#7d5fb8"],
  coral: ["#f07a4c", "#f6924f", "#ef6151", "#e8673a", "#5e8a45"],
  blanco: ["#fbf6ec", "#f3ead8", "#fff8f0"],
  amarillo: ["#f6d34a", "#f2c23a", "#ffe07a"],
  rosa: ["#f08ab0", "#e86f9e", "#f6a6c1", "#d95c8c", "#5e8a45"],
};
const azar = (l) => l[Math.floor(Math.random() * l.length)];

export function crearFlora(scene, { ligero = false } = {}) {
  const L = { racimo: [], lavanda: [], flor: [], cipres: [], limon: [], loto: [] };
  const color = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();

  // racimo de buganvilia o mata florida: bola facetada que se pinta por instancia
  const geoRacimo = new THREE.IcosahedronGeometry(1, 2);
  // bulto irregular: la deformación depende de la posición (los vértices repetidos se mueven igual y no se abren grietas)
  { const pos = geoRacimo.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = 1 + 0.16 * Math.sin(x * 7.1 + y * 3.3) * Math.cos(z * 5.7 - y * 2.1); pos.setXYZ(i, x * k, y * k * 0.85, z * k); } geoRacimo.computeVertexNormals(); }
  const matRacimo = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  // lavanda: espigas moradas sobre una mata verde
  const geoEspigas = (() => {
    const ps = [];
    for (let k = 0; k < 11; k++) { const c = new THREE.CylinderGeometry(0.035, 0.06, 0.42, 5); c.translate(0, 0.62, 0); c.rotateZ((Math.random() - 0.5) * 0.7); c.rotateY(Math.random() * 6.3); c.translate((Math.random() - 0.5) * 0.35, 0, (Math.random() - 0.5) * 0.35); ps.push(c); }
    return mergeGeometries(ps);
  })();
  const geoMataL = new THREE.IcosahedronGeometry(0.42, 0); geoMataL.scale(1, 0.75, 1); geoMataL.translate(0, 0.28, 0);
  const matEspiga = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
  const matMataL = new THREE.MeshStandardMaterial({ color: "#7d9a6a", roughness: 0.9, flatShading: true });
  // ciprés: flama alta y oscura
  const geoCipres = new THREE.LatheGeometry([0, 0.9, 1.15, 1.1, 0.85, 0.5, 0.0].map((r, i) => new THREE.Vector2(r * 0.55, i / 6)), 8);
  const matCipres = new THREE.MeshStandardMaterial({ color: "#3b5a34", roughness: 0.95, flatShading: true });
  // limonero: tronco, copa redonda y limones
  const geoTronco = new THREE.CylinderGeometry(0.12, 0.18, 1.6, 6); geoTronco.translate(0, 0.8, 0);
  const geoCopa = new THREE.IcosahedronGeometry(1.4, 1); geoCopa.translate(0, 2.6, 0);
  const matTronco = new THREE.MeshStandardMaterial({ color: "#7a5a3e", roughness: 0.95 });
  const matCopa = new THREE.MeshStandardMaterial({ color: "#5a8a3e", roughness: 0.85, flatShading: true });
  const geoFruta = new THREE.SphereGeometry(0.12, 6, 5);
  const matFruta = new THREE.MeshStandardMaterial({ color: "#f4d23c", roughness: 0.5 });
  // loto sobre el agua: hoja verde y flor rosa
  const geoHojaLoto = new THREE.CircleGeometry(0.45, 10, 0.3, Math.PI * 2 - 0.6); geoHojaLoto.rotateX(-Math.PI / 2);
  const geoFlorLoto = new THREE.ConeGeometry(0.22, 0.28, 7, 1, true); geoFlorLoto.rotateX(Math.PI); geoFlorLoto.translate(0, 0.14, 0);
  const matHojaLoto = new THREE.MeshStandardMaterial({ color: "#5f8f4a", roughness: 0.7, side: THREE.DoubleSide });
  const matFlorLoto = new THREE.MeshStandardMaterial({ color: "#f6a6c1", roughness: 0.6, side: THREE.DoubleSide, emissive: "#f28fb4", emissiveIntensity: 0.15 });

  const api = {
    // racimo de buganvilia (en techos, arcos y columnas): x, y, z, tamaño, paleta
    racimo(x, y, z, k = 1, paleta = PALETAS.buganvilia) { L.racimo.push([x, y, z, k, azar(paleta)]); },
    // cama de flores (bolitas de color sobre el pasto)
    flor(x, z, k = 1, paleta = PALETAS.rosa, y = 0.56) { L.flor.push([x, y, z, k, azar(paleta)]); },
    lavanda(x, z, k = 1, paleta = PALETAS.lavanda, y = 0.56) { L.lavanda.push([x, y, z, k, azar(paleta)]); },
    cipres(x, z, alto = 9, y = 0.56) { L.cipres.push([x, y, z, alto]); },
    limonero(x, z, k = 1, y = 0.56) { L.limon.push([x, y, z, k]); },
    loto(x, y, z) { L.loto.push([x, y, z]); },
    // fila de algo entre dos puntos (para orillas de senderos)
    fila(tipo, x0, z0, x1, z1, paso, ...args) {
      const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(d / paso));
      for (let i = 0; i <= n; i++) api[tipo](x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, ...args);
    },
    plantar() {
      const mallas = [];
      const inst = (geo, mat, lista, fn, conColor) => {
        if (!lista.length) return null;
        const im = new THREE.InstancedMesh(geo, mat, lista.length);
        lista.forEach((it, i) => { fn(it); im.setMatrixAt(i, m); if (conColor) im.setColorAt(i, color.set(it[4]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06)); });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere(); scene.add(im); mallas.push(im); return im;
      };
      inst(geoRacimo, matRacimo, L.racimo, ([x, y, z, k]) => m.compose(p.set(x, y, z), q.setFromEuler(e.set(Math.random(), Math.random() * 6, 0)), s.set(k * (0.9 + Math.random() * 0.3), k * (0.7 + Math.random() * 0.2), k * (0.9 + Math.random() * 0.3))), true);
      inst(geoRacimo, matRacimo, L.flor, ([x, y, z, k]) => m.compose(p.set(x, y + 0.18 * k, z), q.setFromEuler(e.set(0, Math.random() * 6, 0)), s.set(0.55 * k, 0.32 * k, 0.55 * k)), true);
      inst(geoEspigas, matEspiga, L.lavanda, ([x, y, z, k]) => m.compose(p.set(x, y, z), q.setFromEuler(e.set(0, Math.random() * 6, 0)), s.setScalar(k)), true);
      inst(geoMataL, matMataL, L.lavanda, ([x, y, z, k]) => m.compose(p.set(x, y, z), q.setFromEuler(e.set(0, Math.random() * 6, 0)), s.setScalar(k)));
      inst(geoCipres, matCipres, L.cipres, ([x, y, z, h]) => m.compose(p.set(x, y, z), q.identity(), s.set(h * 0.16, h, h * 0.16)));
      inst(geoTronco, matTronco, L.limon, ([x, y, z, k]) => m.compose(p.set(x, y, z), q.identity(), s.setScalar(k)));
      inst(geoCopa, matCopa, L.limon, ([x, y, z, k]) => m.compose(p.set(x, y, z), q.setFromEuler(e.set(0, Math.random() * 6, 0)), s.setScalar(k)));
      const frutas = [];
      L.limon.forEach(([x, y, z, k]) => { for (let i = 0; i < 9; i++) { const a = Math.random() * 6.3, b = Math.random() * 1.2 - 0.2; frutas.push([x + Math.cos(a) * Math.cos(b) * 1.35 * k, y + (2.6 + Math.sin(b) * 1.3) * k, z + Math.sin(a) * Math.cos(b) * 1.35 * k]); } });
      inst(geoFruta, matFruta, frutas, ([x, y, z]) => m.compose(p.set(x, y, z), q.identity(), s.setScalar(1)));
      inst(geoHojaLoto, matHojaLoto, L.loto, ([x, y, z]) => m.compose(p.set(x, y + 0.01, z), q.setFromEuler(e.set(0, Math.random() * 6, 0)), s.setScalar(0.8 + Math.random() * 0.6)));
      inst(geoFlorLoto, matFlorLoto, L.loto.filter((_, i) => i % 2 === 0), ([x, y, z]) => m.compose(p.set(x + 0.1, y + 0.02, z), q.identity(), s.setScalar(1)));
      return mallas;
    },
  };
  return api;
}

// Agua que cae: franjas que bajan y espuma abajo (sin texturas)
export function matCascada() {
  return new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `uniform float t; varying vec2 vU;
      float h(float x){ return fract(sin(x*91.3)*47453.1); }
      void main(){
        float col = floor(vU.x*40.);
        float v = fract(vU.y*3. + t*(1.2 + h(col)*0.8) + h(col)*7.);
        float raya = smoothstep(0.0, 0.5, v) * (0.55 + 0.45*h(col+3.));
        vec3 c = mix(vec3(0.62,0.86,0.88), vec3(1.), raya*0.7);
        float espuma = smoothstep(0.18, 0.0, vU.y);
        c = mix(c, vec3(1.), espuma*0.8);
        float a = (0.55 + raya*0.35 + espuma*0.3) * smoothstep(0.0, 0.08, vU.x) * smoothstep(1.0, 0.92, vU.x);
        gl_FragColor = vec4(c, a);
      }`,
  });
}

// Cascada de terrazas de piedra caliza que cae a un estanque con lotos.
// Devuelve el grupo; el que llama pone obstáculos. frente: hacia dónde mira la caída (radianes, eje y).
export function cascada({ x, z, frente = 0, matPiedra, matAgua, matCaida, flora, ancho = 5, pisos = 3 }) {
  const g = new THREE.Group(); g.position.set(x, 0.56, z); g.rotation.y = frente; g.updateMatrixWorld(true);
  const R = 5.2;
  // estanque de abajo
  // borde de piedra (aro) y el agua adentro, un poco abajo del filo
  const borde = new THREE.Mesh(new THREE.TorusGeometry(R + 0.2, 0.42, 8, 48), matPiedra); borde.rotation.x = Math.PI / 2; borde.scale.z = 1.4; borde.position.y = 0.42; g.add(borde);
  const agua = new THREE.Mesh(new THREE.CircleGeometry(R + 0.1, 40), matAgua); agua.rotation.x = -Math.PI / 2; agua.position.y = 0.5; g.add(agua);
  // terrazas detrás (hacia -z), cada una más alta
  for (let i = 0; i < pisos; i++) {
    const alto = 1.6 + i * 1.7, fondo = 2.6, zc = -R - 0.4 - i * (fondo - 0.6) - fondo / 2 + 1.2, w = ancho + 3 - i * 0.6;
    const bloque = new THREE.Mesh(new THREE.BoxGeometry(w, alto, fondo), matPiedra); bloque.position.set(0, alto / 2, zc); g.add(bloque);
    const aguaT = new THREE.Mesh(new THREE.PlaneGeometry(ancho - i * 0.6, fondo - 0.5), matAgua); aguaT.rotation.x = -Math.PI / 2; aguaT.position.set(0, alto + 0.02, zc); g.add(aguaT);
    const caida = new THREE.Mesh(new THREE.PlaneGeometry(ancho - i * 0.6 - 0.4, i ? 1.7 : alto - 0.4), matCaida);
    caida.position.set(0, i ? alto - 0.85 : (alto + 0.4) / 2, zc + fondo / 2 + 0.03); g.add(caida);
    // flores colgando a los lados de cada terraza
    if (flora) [-1, 1].forEach((sg) => { const v = g.localToWorld(new THREE.Vector3(sg * (w / 2 - 0.3), 0, zc)); flora.racimo(v.x, alto + 0.6 + g.position.y, v.z, 0.9); });
  }
  g.updateMatrixWorld(true);
  if (flora) {
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 1.4 + Math.PI * 0.8, v = g.localToWorld(new THREE.Vector3(Math.cos(a) * (R - 1.2) * Math.random(), 0, Math.sin(a) * (R - 1.4) * Math.random() + 0.8)); flora.loto(v.x, g.position.y + 0.5, v.z); }
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, v = g.localToWorld(new THREE.Vector3(Math.cos(a) * (R + 1.6), 0, Math.sin(a) * (R + 1.6))); if (Math.sin(a) < -0.3) continue; (k % 3 ? flora.lavanda : flora.flor)(v.x, v.z, 1); }
  }
  return g;
}
