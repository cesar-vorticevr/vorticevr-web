// Soniditos de las experiencias (ruleta, trivia, colorear, filtro, menú, links, realidad aumentada).
// Todo se sintetiza con Web Audio: no hay archivos que descargar y suenan al instante.
//  - sfx.tick() clic de la ruleta, sfx.tap() botón, sfx.pop() burbuja, sfx.whoosh() giro o barrido, sfx.sparkle() destellos,
//    sfx.win() fanfarria, sfx.lose() "uy", sfx.correct() / sfx.wrong(), sfx.count() / sfx.go() cuenta regresiva,
//    sfx.shutter() foto, sfx.recStart() / sfx.recStop(), sfx.splash() cubeta de pintura, sfx.appear() algo aparece,
//    sfx.coin() moneda, sfx.swoosh() abrir un panel, sfx.laser() disparo, sfx.boom() explosión.
//  - El navegador solo deja sonar después de un toque: el contexto se crea y se reanuda en el primer toque o tecla.
//  - setMuted(true) los apaga y se recuerda en el celular (localStorage vvr-sonido). En iPhone el interruptor de silencio
//    también los calla.
// La portada y el sitio siguen sin sonidos (regla de César): esto solo lo importan las experiencias.

let ctx = null, out = null;
const last = {};
let muted = false;
try { muted = localStorage.getItem("vvr-sonido") === "0"; } catch {}

export function setMuted(v) { muted = !!v; try { localStorage.setItem("vvr-sonido", muted ? "0" : "1"); } catch {} }
export function isMuted() { return muted; }

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { ctx = new C(); } catch { return null; }
    const comp = ctx.createDynamicsCompressor();
    out = ctx.createGain(); out.gain.value = .5;
    out.connect(comp); comp.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
for (const ev of ["pointerdown", "touchend", "keydown"]) addEventListener(ev, () => ac(), { capture: true, passive: true });

// one note: freq (Hz) that can glide to `to`, with a quick attack and an exponential fade
function tone(freq, { t = 0, dur = .12, type = "sine", vol = .3, to = 0, attack = .004, q = 0 } = {}) {
  const c = ctx, t0 = c.currentTime + t;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  let n = o;
  if (q) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = q; o.connect(f); n = f; }
  n.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + .02);
}
let noiseBuf = null;
function noise({ t = 0, dur = .2, vol = .2, type = "bandpass", f = 1200, to = 0, Q = 1 } = {}) {
  const c = ctx, t0 = c.currentTime + t;
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.Q.value = Q; fl.frequency.setValueAtTime(f, t0);
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + Math.min(.03, dur / 3)); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(out); s.start(t0, Math.random() * .5); s.stop(t0 + dur + .02);
}
// plays fn only when sound is on, the context runs and the same sound did not just play (gap in ms)
const play = (name, gap, fn) => (...a) => {
  if (muted) return;
  const c = ac(); if (!c || c.state === "closed") return;   // still "suspended" on the very first tap: it plays as soon as it resumes
  const now = performance.now(); if (last[name] && now - last[name] < gap) return; last[name] = now;
  try { fn(...a); } catch {}
};
const PENTA = [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637, 3136];
const pick = a => a[Math.floor(Math.random() * a.length)];

export const sfx = {
  tick: play("tick", 22, (k = 1) => { tone(1500 + Math.random() * 300, { dur: .035, type: "triangle", vol: .16 * k }); noise({ dur: .02, vol: .08 * k, type: "highpass", f: 3000 }); }),
  tap: play("tap", 40, () => tone(620, { dur: .07, to: 940, vol: .16 })),
  pop: play("pop", 30, () => tone(380 + Math.random() * 120, { dur: .09, to: 1300, vol: .2 })),
  whoosh: play("whoosh", 120, (dur = .45) => noise({ dur, vol: .22, f: 300, to: 2600, Q: .8 })),
  swoosh: play("swoosh", 80, () => noise({ dur: .22, vol: .12, f: 1800, to: 600, Q: .7 })),
  sparkle: play("sparkle", 60, (n = 5) => { for (let i = 0; i < n; i++) tone(pick(PENTA), { t: i * .045 + Math.random() * .02, dur: .25, vol: .09, type: "sine" }); }),
  appear: play("appear", 300, () => { tone(520, { dur: .5, to: 1560, vol: .12, type: "triangle", attack: .03 }); for (let i = 0; i < 4; i++) tone(pick(PENTA), { t: .18 + i * .06, dur: .3, vol: .07 }); }),
  win: play("win", 400, () => {
    [523, 659, 784, 1047].forEach((f, i) => { tone(f, { t: i * .1, dur: .22, type: "triangle", vol: .22 }); tone(f * 2, { t: i * .1, dur: .16, vol: .05 }); });
    tone(1047, { t: .42, dur: .7, type: "triangle", vol: .2 }); tone(1319, { t: .42, dur: .7, type: "sine", vol: .12 }); tone(1568, { t: .42, dur: .7, type: "sine", vol: .1 });
    for (let i = 0; i < 7; i++) tone(pick(PENTA) * 1.5, { t: .5 + i * .06, dur: .25, vol: .06 });
  }),
  lose: play("lose", 400, () => { [392, 370, 349].forEach((f, i) => tone(f, { t: i * .22, dur: .24, type: "triangle", vol: .16, q: 1400 })); tone(330, { t: .66, dur: .6, to: 247, type: "triangle", vol: .16, q: 1200 }); }),
  correct: play("correct", 150, () => { tone(880, { dur: .12, type: "triangle", vol: .2 }); tone(1319, { t: .09, dur: .3, type: "triangle", vol: .2 }); sfx.sparkle(3); }),
  wrong: play("wrong", 150, () => { tone(180, { dur: .32, to: 110, type: "sawtooth", vol: .14, q: 900 }); tone(186, { dur: .32, to: 114, type: "square", vol: .06, q: 700 }); }),
  count: play("count", 200, () => tone(660, { dur: .1, type: "triangle", vol: .16 })),
  go: play("go", 200, () => tone(990, { dur: .28, type: "triangle", vol: .2 })),
  shutter: play("shutter", 150, () => { noise({ dur: .05, vol: .3, type: "highpass", f: 2500 }); noise({ t: .06, dur: .08, vol: .2, type: "bandpass", f: 1500, Q: 2 }); }),
  recStart: play("rec", 300, () => { tone(660, { dur: .1, type: "triangle", vol: .16 }); tone(990, { t: .1, dur: .16, type: "triangle", vol: .16 }); }),
  recStop: play("rec", 300, () => { tone(990, { dur: .1, type: "triangle", vol: .16 }); tone(660, { t: .1, dur: .18, type: "triangle", vol: .16 }); }),
  splash: play("splash", 50, () => { tone(260, { dur: .16, to: 820, vol: .2, q: 2000 }); noise({ t: .02, dur: .12, vol: .06, f: 900, to: 2400 }); }),
  coin: play("coin", 80, () => { tone(988, { dur: .08, type: "square", vol: .07 }); tone(1319, { t: .07, dur: .3, type: "square", vol: .07 }); }),
  laser: play("laser", 45, () => { tone(1400, { dur: .13, to: 260, type: "square", vol: .06, q: 3000 }); tone(2100, { dur: .08, to: 500, vol: .05 }); }),
  boom: play("boom", 40, () => { noise({ dur: .35, vol: .3, type: "lowpass", f: 1800, to: 120, Q: .7 }); tone(140, { dur: .25, to: 50, type: "sine", vol: .25 }); }),
};
