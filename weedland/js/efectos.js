// Sonidos sintetizados (sin archivos) y efectos de pantalla: monedas que vuelan, carteles, confeti de hojas.
const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- sonido ----------
let ac = null, salida = null;
let mudo = (() => { try { return localStorage.getItem("ws-mudo") === "1"; } catch { return false; } })();
export const estaMudo = () => mudo;
export function alternarSonido() {
  mudo = !mudo;
  try { localStorage.setItem("ws-mudo", mudo ? "1" : "0"); } catch {}
  return mudo;
}
function audio() {
  if (mudo) return null;
  try {
    if (!ac) {
      // Seco y con la menor latencia posible (sin eco)
      ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
      salida = ac.createGain(); salida.gain.value = 0.6;
      salida.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  } catch { return null; }
}
function nota(f, t0, dur, { tipo = "sine", vol = 0.18, a = f } = {}) {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + 0.005 + t0;
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  if (a !== f) o.frequency.exponentialRampToValueAtTime(a, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(salida);
  o.start(t); o.stop(t + dur + 0.05);
}
function ruido(t0, dur, vol = 0.08, frec = 1800) {
  const c = audio(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = "bandpass"; f.frequency.value = frec; g.gain.value = vol;
  s.buffer = buf; s.connect(f); f.connect(g); g.connect(salida);
  s.start(c.currentTime + t0);
}
// El navegador solo deja sonar después del primer toque: se "despierta" el audio
// en ese primer toque para que el primer sonido no llegue tarde.
for (const ev of ["pointerdown", "keydown", "touchstart"]) {
  window.addEventListener(ev, () => { const c = audio(); if (c && c.state === "suspended") c.resume(); }, { capture: true, passive: true });
}

const ESCALA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093];

export const sonido = {
  tap: () => nota(880, 0, 0.06, { tipo: "triangle", vol: 0.08, a: 1200 }),
  pop: () => { nota(300, 0, 0.12, { tipo: "sine", vol: 0.22, a: 900 }); ruido(0, 0.05, 0.05, 900); },
  moneda: (i = 0) => { const f = ESCALA[Math.min(ESCALA.length - 2, 5 + (i % 5))]; nota(f, 0, 0.08, { tipo: "square", vol: 0.05 }); nota(f * 1.5, 0.06, 0.18, { tipo: "square", vol: 0.05 }); },
  tick: () => nota(1800, 0, 0.025, { tipo: "square", vol: 0.04 }),
  siembra: () => { ruido(0, 0.18, 0.09, 500); nota(220, 0, 0.15, { vol: 0.2, a: 440 }); [0, 1, 2].forEach((k) => nota(ESCALA[k * 2 + 2], 0.12 + k * 0.07, 0.2, { tipo: "triangle", vol: 0.1 })); },
  cosecha: () => {
    [0, 2, 4, 5, 7, 9].forEach((k, i) => nota(ESCALA[k], i * 0.06, 0.25, { tipo: "triangle", vol: 0.13 }));
    [0, 1, 2, 3, 4, 5].forEach((i) => nota(ESCALA[8 + (i % 3)], 0.4 + i * 0.05, 0.3, { tipo: "sine", vol: 0.06 }));
    ruido(0.35, 0.5, 0.04, 6000);
  },
  dorada: () => {
    [0, 2, 4, 7, 9, 10].forEach((k, i) => { nota(ESCALA[k], i * 0.08, 0.3, { tipo: "square", vol: 0.06 }); nota(ESCALA[k] / 2, i * 0.08, 0.3, { tipo: "triangle", vol: 0.1 }); });
    for (let i = 0; i < 12; i++) nota(ESCALA[6 + (i % 5)], 0.55 + i * 0.045, 0.12, { tipo: "square", vol: 0.04 });
  },
  entrar: () => { nota(392, 0, 0.5, { tipo: "sine", vol: 0.12, a: 1568 }); [4, 6, 8, 10].forEach((k, i) => nota(ESCALA[k], 0.15 + i * 0.06, 0.4, { tipo: "triangle", vol: 0.07 })); },
  abrir: () => { ruido(0, 0.25, 0.08, 3000); [5, 7, 9, 10].forEach((k, i) => nota(ESCALA[k], i * 0.05, 0.35, { tipo: "triangle", vol: 0.1 })); },
  sacudir: () => { ruido(0, 0.1, 0.06, 700); nota(180, 0, 0.1, { vol: 0.12, a: 140 }); },
  bien: () => { nota(ESCALA[4], 0, 0.12, { tipo: "square", vol: 0.06 }); nota(ESCALA[7], 0.09, 0.22, { tipo: "square", vol: 0.06 }); },
  mal: () => { nota(260, 0, 0.18, { tipo: "sawtooth", vol: 0.05, a: 180 }); },
  premio: () => { [0, 4, 7, 9].forEach((k, i) => nota(ESCALA[k], i * 0.09, 0.3, { tipo: "square", vol: 0.06 })); nota(ESCALA[10], 0.4, 0.6, { tipo: "triangle", vol: 0.1 }); },
  jackpot: () => {
    for (let i = 0; i < 16; i++) nota(ESCALA[i % 8 + 2], i * 0.06, 0.12, { tipo: "square", vol: 0.05 });
    [0, 4, 7].forEach((k) => nota(ESCALA[k] / 2, 1, 0.8, { tipo: "triangle", vol: 0.12 }));
  },
  mision: () => { [0, 2, 4, 7].forEach((k, i) => nota(ESCALA[k], i * 0.1, 0.22, { tipo: "triangle", vol: 0.12 })); nota(ESCALA[7], 0.4, 0.5, { tipo: "square", vol: 0.05 }); },
  rasca: () => ruido(0, 0.04, 0.03, 4000 + Math.random() * 2000),
  burbuja: () => nota(300 + Math.random() * 400, 0, 0.12, { vol: 0.1, a: 900 + Math.random() * 400 }),
  hablar: () => nota(500 + Math.random() * 300, 0, 0.04, { tipo: "triangle", vol: 0.03 }),
  paso: () => ruido(0, 0.035, 0.018, 500 + Math.random() * 200),
  teleport: () => { nota(200, 0, 0.45, { vol: 0.12, a: 1600 }); ruido(0.05, 0.35, 0.05, 5000); },
};

// ---------- efectos en pantalla ----------
let capa = null;
function fx() {
  if (!capa) { capa = document.createElement("div"); capa.id = "fx"; document.body.appendChild(capa); }
  return capa;
}

// Monedas o íconos que vuelan en arco hacia un elemento del HUD
export function volar(icono, n, desde, hacia, alLlegar) {
  const destino = typeof hacia === "string" ? document.querySelector(hacia) : hacia;
  if (!destino) return;
  const r = destino.getBoundingClientRect();
  const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  const total = Math.min(n, 14);
  for (let i = 0; i < total; i++) {
    const el = document.createElement("span");
    el.className = "volador";
    el.textContent = icono;
    fx().appendChild(el);
    const sx = desde.x + (Math.random() - 0.5) * 60, sy = desde.y + (Math.random() - 0.5) * 30;
    const cx = (sx + tx) / 2 + (Math.random() - 0.5) * 160, cy = Math.min(sy, ty) - 80 - Math.random() * 120;
    const dur = quieto ? 1 : 700 + Math.random() * 300, retraso = quieto ? 0 : i * 55, t0 = performance.now() + retraso;
    const paso = (ahora) => {
      const k = Math.max(0, Math.min(1, (ahora - t0) / dur));
      const u = 1 - k, e = k * k * (3 - 2 * k);
      const x = u * u * sx + 2 * u * k * cx + k * k * tx, y = u * u * sy + 2 * u * k * cy + k * k * ty;
      el.style.transform = `translate(${x}px, ${y}px) scale(${1.3 - e * 0.6}) rotate(${e * 360}deg)`;
      el.style.opacity = k === 0 && ahora < t0 ? 0 : 1;
      if (k < 1) requestAnimationFrame(paso);
      else {
        el.remove();
        sonido.moneda(i);
        destino.classList.remove("late"); void destino.offsetWidth; destino.classList.add("late");
        if (i === total - 1 && alLlegar) alLlegar();
      }
    };
    requestAnimationFrame(paso);
  }
}

// Cartel grande tipo casino: "¡COSECHA MÁGICA!"
export function cartel({ titulo, sub = "", tipo = "normal", ms = 1900 }) {
  const el = document.createElement("div");
  el.className = `cartel cartel-${tipo}`;
  el.innerHTML = `<div class="rayos"></div><div class="cartel-caja"><div class="cartel-titulo">${titulo}</div>${sub ? `<div class="cartel-sub">${sub}</div>` : ""}</div>`;
  fx().appendChild(el);
  const quitar = () => { el.classList.add("sale"); setTimeout(() => el.remove(), 350); };
  el.onclick = quitar;
  setTimeout(quitar, ms);
  confeti(tipo === "dorada" ? 46 : 26, tipo === "dorada");
}

// Lluvia de hojitas y destellos
const HOJAS = ["🍃", "🌿", "✨", "🍀", "💚", "⭐"];
export function confeti(n = 24, dorado = false) {
  if (quieto) return;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("span");
    el.className = "confeti";
    el.textContent = dorado && i % 2 ? "🪙" : HOJAS[i % HOJAS.length];
    el.style.left = Math.random() * 100 + "vw";
    el.style.fontSize = 16 + Math.random() * 18 + "px";
    el.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
    el.style.animationDelay = Math.random() * 0.4 + "s";
    el.style.setProperty("--giro", (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360) + "deg");
    el.style.setProperty("--deriva", (Math.random() - 0.5) * 160 + "px");
    fx().appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }
}

// Texto flotante (+12 🍃) en una posición de pantalla
export function flotante(texto, x, y, color = "#c6f36b") {
  const el = document.createElement("div");
  el.className = "flotante";
  el.textContent = texto;
  el.style.left = x + "px"; el.style.top = y + "px"; el.style.color = color;
  fx().appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// Contador que sube como tragamonedas
export function contar(el, hasta) {
  const desde = +el.dataset.valor || 0;
  el.dataset.valor = hasta;
  if (desde === hasta || quieto) { el.textContent = hasta; return; }
  const t0 = performance.now(), dur = 600;
  const paso = (ahora) => {
    const k = Math.min(1, (ahora - t0) / dur);
    el.textContent = Math.round(desde + (hasta - desde) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
