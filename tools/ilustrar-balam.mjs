// Ilustraciones del cuento de ejemplo "Balam y el río crecido" (assets/libro.js → EJEMPLO): SVG planos, estilo naíf tropical.
// Uso: node tools/ilustrar-balam.mjs  → escribe assets/libros/balam/*.svg
import fs from "node:fs";
const OUT = new URL("../assets/libros/balam/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

const C = { gold: "#f2a23a", gold2: "#e08a22", cream: "#fff3d6", spot: "#5a3212", ink: "#2b1a0e", nose: "#4a2a14", cheek: "#ff9b8a",
  shell: "#6b7f2e", shell2: "#4f6020", skin: "#9bb04a", river: "#3aa0d8", river2: "#2479b5", foam: "#d9f2ff", leaf: "#2f9a5b", leaf2: "#1f7a46", leaf3: "#58c27a" };

// ---------- pieces ----------
const eye = (x, y, r, look = 0) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x + look * r * .35}" cy="${y + r * .1}" r="${r * .62}" fill="${C.ink}"/><circle cx="${x + look * r * .35 - r * .22}" cy="${y - r * .18}" r="${r * .22}" fill="#fff"/>`;
const rosette = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${C.spot}" stroke-width="${r * .55}" stroke-dasharray="${r * 1.2} ${r * .55}"/><circle cx="${x}" cy="${y}" r="${r * .35}" fill="${C.spot}" opacity=".55"/>`;
// a jaguar sitting, centered at (x, y) = feet; s = scale (1 = cub ~260 px tall); mood: smile | worried | happy; flip mirrors it
function jaguar(x, y, s = 1, { mood = "smile", flip = false, look = 0, adult = false } = {}) {
  const body = adult ? C.gold2 : C.gold;
  const mouth = mood === "worried" ? `<path d="M-16 52 q16 -12 32 0" fill="none" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>`
    : mood === "happy" ? `<path d="M-22 44 q22 30 44 0 z" fill="#b8323a"/><path d="M-22 44 q22 30 44 0" fill="none" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>`
    : `<path d="M-18 46 q9 12 18 0 q9 12 18 0" fill="none" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>`;
  const brows = mood === "worried" ? `<path d="M-52 -26 l26 8 M52 -26 l-26 8" stroke="${C.ink}" stroke-width="6" stroke-linecap="round"/>` : "";
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <path d="M70 -40 q90 -10 70 -100 q-8 -30 -30 -20 q20 30 0 70 q-20 30 -60 30z" fill="${body}"/>${rosette(118, -110, 9)}${rosette(122, -70, 9)}
    <ellipse cx="0" cy="-80" rx="88" ry="90" fill="${body}"/>
    <ellipse cx="0" cy="-60" rx="52" ry="62" fill="${C.cream}"/>
    ${rosette(-62, -110, 11)}${rosette(64, -96, 11)}${rosette(-70, -52, 10)}${rosette(70, -40, 9)}
    <ellipse cx="-44" cy="-8" rx="34" ry="20" fill="${body}"/><ellipse cx="44" cy="-8" rx="34" ry="20" fill="${body}"/>
    <path d="M-58 -8 v10 M-44 -6 v12 M-30 -8 v10 M58 -8 v10 M44 -6 v12 M30 -8 v10" stroke="${C.spot}" stroke-width="3" stroke-linecap="round" opacity=".6"/>
    <g transform="translate(0 -205)">
      <circle cx="-62" cy="-50" r="30" fill="${body}"/><circle cx="62" cy="-50" r="30" fill="${body}"/><circle cx="-62" cy="-48" r="16" fill="${C.spot}"/><circle cx="62" cy="-48" r="16" fill="${C.spot}"/>
      <ellipse cx="0" cy="0" rx="98" ry="86" fill="${body}"/>
      ${rosette(-60, -36, 10)}${rosette(58, -40, 10)}${rosette(-6, -60, 9)}${rosette(-80, 12, 8)}${rosette(82, 10, 8)}
      <ellipse cx="0" cy="34" rx="56" ry="42" fill="${C.cream}"/>
      ${eye(-34, -6, 22, look)}${eye(34, -6, 22, look)}${brows}
      <circle cx="-62" cy="30" r="13" fill="${C.cheek}" opacity=".55"/><circle cx="62" cy="30" r="13" fill="${C.cheek}" opacity=".55"/>
      <path d="M-14 18 h28 l-14 16z" fill="${C.nose}" stroke="${C.nose}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M0 34 v8" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>${mouth}
      <path d="M-40 34 h-40 M-40 44 l-36 10 M40 34 h40 M40 44 l36 10" stroke="${C.ink}" stroke-width="3" stroke-linecap="round" opacity=".5"/>
    </g></g>`;
}
// Doña Tortuga (a pochitoque): x, y = bottom center; s = scale (1 ≈ 300 px wide)
function tortuga(x, y, s = 1, { flip = false, wave = false } = {}) {
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <ellipse cx="-80" cy="-14" rx="34" ry="18" fill="${C.skin}"/><ellipse cx="80" cy="-14" rx="34" ry="18" fill="${C.skin}"/>
    <path d="M-150 -30 q0 -150 150 -150 q150 0 150 150 z" fill="${C.shell}"/>
    <path d="M-150 -30 h300" stroke="${C.shell2}" stroke-width="14" stroke-linecap="round"/>
    <path d="M-50 -160 l-40 60 l40 60 h100 l40 -60 l-40 -60z M-50 -40 l-50 -0 M50 -40 l50 0 M-90 -100 h-55 M90 -100 h55 M-50 -160 l-30 -0 M50 -160 l30 0" fill="none" stroke="${C.shell2}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>
    <circle cx="-30" cy="-140" r="10" fill="#fff" opacity=".18"/><circle cx="20" cy="-150" r="6" fill="#fff" opacity=".18"/>
    <g transform="translate(176 -70)"><path d="M-40 20 q20 -40 60 -40 q50 0 50 45 q0 40 -50 40 q-40 0 -60 -25z" fill="${C.skin}"/>
      ${eye(30, -2, 15, 0)}<path d="M28 36 q14 10 30 0" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="56" cy="22" r="8" fill="${C.cheek}" opacity=".5"/>
      <path d="M8 -26 q22 -20 46 -6" fill="none" stroke="${C.shell2}" stroke-width="5" stroke-linecap="round"/></g>
    ${wave ? `<path d="M-160 -60 q-40 -20 -40 -70 q0 -20 18 -16 q10 40 40 52z" fill="${C.skin}"/>` : `<ellipse cx="-160" cy="-30" rx="24" ry="14" fill="${C.skin}"/>`}
  </g>`;
}
const leaf = (x, y, r, rot, col = C.leaf) => `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0 q${r * .55} ${-r * .55} 0 ${-r} q${-r * .55} ${r * .45} 0 ${r}z" fill="${col}"/><path d="M0 0 v${-r * .92}" stroke="#ffffff" stroke-opacity=".35" stroke-width="${Math.max(2, r * .04)}"/></g>`;
const plant = (x, y, s = 1, cols = [C.leaf, C.leaf2, C.leaf3]) => `<g transform="translate(${x} ${y}) scale(${s})">${[-70, -40, -12, 14, 42, 72].map((a, i) => leaf(0, 0, 150 - Math.abs(a) * .5, a, cols[i % 3])).join("")}</g>`;
const palm = (x, y, h, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-8 0 q-20 ${-h * .5} 10 ${-h} h14 q-24 ${h * .5} -4 ${h}z" fill="#8a5a2b"/>${[-150, -110, -70, -30, 10].map((a, i) => `<g transform="translate(6 ${-h}) rotate(${a})"><path d="M0 0 q60 -30 130 10 q-70 -6 -130 -10z" fill="${[C.leaf, C.leaf2, C.leaf3][i % 3]}"/></g>`).join("")}</g>`;
const flower = (x, y, r, c) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="${-r}" rx="${r * .55}" ry="${r}" fill="${c}" transform="rotate(${a})"/>`).join("")}<circle r="${r * .5}" fill="#ffd34d"/></g>`;
const cloud = (x, y, s, c = "#fff") => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><circle cx="-60" cy="10" r="46"/><circle cx="0" cy="-14" r="62"/><circle cx="64" cy="8" r="48"/><rect x="-106" y="10" width="216" height="46" rx="23"/></g>`;
const sun = (x, y, r) => `<g transform="translate(${x} ${y})">${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${-r - 14} l10 ${-26} l10 26z" fill="#ffd34d" transform="rotate(${i * 30}) translate(-10 0)"/>`).join("")}<circle r="${r}" fill="#ffd34d"/><circle cx="${-r * .3}" cy="${-r * .1}" r="${r * .1}" fill="${C.ink}"/><circle cx="${r * .3}" cy="${-r * .1}" r="${r * .1}" fill="${C.ink}"/><path d="M${-r * .32} ${r * .25} q${r * .32} ${r * .3} ${r * .64} 0" fill="none" stroke="${C.ink}" stroke-width="${r * .08}" stroke-linecap="round"/></g>`;
const waves = (y, w, amp, col, n = 8) => { let d = `M0 ${y}`; const step = w / n; for (let i = 0; i < n; i++) d += ` q${step / 4} ${-amp} ${step / 2} 0 t${step / 2} 0`; return `<path d="${d} V${y + 2000} H0z" fill="${col}"/>`; };
const foam = (y, w, n = 10) => Array.from({ length: n }, (_, i) => `<path d="M${(i + .3) * w / n} ${y + (i % 2) * 18} q20 -14 40 0" fill="none" stroke="${C.foam}" stroke-width="6" stroke-linecap="round" opacity=".8"/>`).join("");
const rain = (w, h, n = 70) => { let s = ""; for (let i = 0; i < n; i++) { const x = (i * 97) % w, y = (i * 53) % h; s += `<path d="M${x} ${y} l-14 40" stroke="#cfe6ff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`; } return s; };
const heart = (x, y, s, c = "#ff6b8a") => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 12 C-30 -10 -18 -36 0 -20 C18 -36 30 -10 0 12z" fill="${c}"/>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`;
const grad = (id, a, b, vertical = true) => `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const hills = (w, y, cols) => cols.map((c, i) => `<path d="M0 ${y + i * 60} q${w * .25} -120 ${w * .5} -20 t${w * .5} -30 V2000 H0z" fill="${c}"/>`).join("");

const files = {
  // cover (portrait; the bottom 45% is under the title): Balam riding Doña Tortuga across the river at sunset
  portada: svg(900, 1200, `<defs>${grad("s", "#ff9a6b", "#ffd28a")}</defs><rect width="900" height="1200" fill="url(#s)"/>${sun(690, 230, 80)}${cloud(220, 190, .9)}
    ${palm(80, 600, 380, 1)}${palm(830, 580, 330, .9)}${plant(50, 600, 1)}${plant(870, 590, .9)}
    ${waves(560, 900, 26, C.river)}${foam(600, 900)}
    ${tortuga(440, 700, 1.7)}${jaguar(410, 450, 1.08, { mood: "happy" })}
    ${waves(700, 900, 22, C.river2, 6)}${foam(740, 900, 8)}`),
  // page 3 (landscape): Balam in the sunny jungle
  inicio: svg(1200, 900, `<defs>${grad("s", "#8fd8ff", "#e6f8ff")}</defs><rect width="1200" height="900" fill="url(#s)"/>${sun(1010, 150, 70)}${cloud(260, 140, .8)}${cloud(640, 110, .55)}
    ${hills(1200, 520, ["#7cc96a", "#4fae5e", "#3a944e"])}${palm(170, 640, 360, 1)}${palm(1060, 650, 330, .95)}
    ${plant(110, 860, 1.3)}${plant(1100, 870, 1.4)}${flower(330, 770, 22, "#ff6fa8")}${flower(880, 800, 20, "#ffffff")}${flower(950, 760, 16, "#ff9b3d")}
    ${jaguar(600, 820, 1.25, { mood: "smile" })}`),
  // page 4 (landscape): the storm; the river between Balam (left) and his mother (right)
  lluvia: svg(1200, 900, `<defs>${grad("s", "#5b6a86", "#9fb0c8")}</defs><rect width="1200" height="900" fill="url(#s)"/>${cloud(240, 130, 1.1, "#7c879c")}${cloud(700, 100, 1.3, "#6c768b")}${cloud(1080, 150, .9, "#7c879c")}
    <path d="M0 560 q200 -40 340 -10 V900 H0z" fill="#3e8e4f"/><path d="M1200 540 q-220 -30 -360 0 V900 H1200z" fill="#3e8e4f"/>
    <path d="M320 560 q280 -30 540 -20 V900 H300z" fill="${C.river}"/>${waves(640, 1200, 22, C.river2, 10)}${foam(600, 1200, 12)}
    ${plant(60, 700, .9, ["#2c7a45", "#24693b", "#3d8f55"])}${plant(1140, 690, .9, ["#2c7a45", "#24693b", "#3d8f55"])}
    ${jaguar(185, 590, .9, { mood: "worried", look: 1 })}${jaguar(1015, 570, .72, { mood: "worried", flip: true, adult: true, look: -1 })}
    ${rain(1200, 900)}`),
  // page 6 (landscape): Balam asks Doña Tortuga for help
  tortuga: svg(1200, 900, `<defs>${grad("s", "#bfe9ff", "#f2fbff")}</defs><rect width="1200" height="900" fill="url(#s)"/>${cloud(300, 160, .7)}
    ${hills(1200, 560, ["#86cf74", "#5bb566"])}<path d="M0 820 q600 -60 1200 0 V900 H0z" fill="${C.river}"/>${foam(840, 1200, 10)}
    ${plant(350, 800, .9)}${plant(860, 800, .9)}${flower(420, 740, 18, "#ff6fa8")}
    ${jaguar(440, 800, 1.3, { mood: "worried", look: 1 })}${tortuga(800, 810, 1, { flip: true })}`),
  // page 7 (full page, portrait; the text covers the bottom half: everything goes up): the crossing, wave after wave
  olas: svg(900, 1200, `<defs>${grad("s", "#7d8fb0", "#cfe3f2")}</defs><rect width="900" height="1200" fill="url(#s)"/>${cloud(200, 90, .6, "#eef3fb")}${cloud(700, 120, .5, "#eef3fb")}
    ${waves(330, 900, 34, C.river, 6)}${foam(370, 900, 9)}
    <path d="M70 380 l120 -20 l-30 22z M720 420 l130 -14 l-40 24z" fill="#8a5a2b"/>${leaf(140, 360, 60, 70, C.leaf2)}
    ${tortuga(450, 540, 1.15)}${jaguar(430, 360, .72, { mood: "smile", look: 1 })}
    ${waves(520, 900, 30, C.river2, 5)}${foam(560, 900, 7)}`),
  // page 8 (landscape): the hug, with Doña Tortuga waving from the river
  mama: svg(1200, 900, `<defs>${grad("s", "#ffd6a8", "#fff3e0")}</defs><rect width="1200" height="900" fill="url(#s)"/>${sun(170, 150, 60)}
    ${hills(1200, 560, ["#86cf74", "#5bb566", "#3f9c50"])}<path d="M0 760 q300 -40 520 -10 V900 H0z" fill="${C.river}"/>${foam(790, 520, 4)}
    ${tortuga(230, 820, .5, { flip: true, wave: true })}${palm(1110, 660, 320, .9)}${plant(1080, 880, 1.1)}
    ${jaguar(780, 840, 1.2, { mood: "happy", flip: true, adult: true })}${jaguar(610, 850, .82, { mood: "happy", look: 1 })}
    ${heart(700, 210, 2)}${heart(820, 150, 1.3, "#ff8fb1")}${heart(590, 170, 1.1, "#ffb3c8")}`),
  // the end (fitted, any shape): Balam learning to swim beside Doña Tortuga at sunrise
  fin: svg(1200, 900, `<defs>${grad("s", "#ffc7a1", "#fff1d9")}</defs><rect width="1200" height="900" fill="url(#s)"/>${sun(600, 330, 90)}
    ${waves(520, 1200, 20, C.river, 10)}${foam(560, 1200, 12)}
    ${tortuga(780, 680, .6, { flip: true })}${jaguar(430, 640, .6, { mood: "happy", look: 1 })}
    ${waves(640, 1200, 18, C.river2, 8)}${plant(80, 900, 1)}${plant(1120, 900, 1)}`),
};
for (const [k, s] of Object.entries(files)) fs.writeFileSync(new URL(k + ".svg", OUT), s);
console.log("ok", Object.keys(files).join(", "));
