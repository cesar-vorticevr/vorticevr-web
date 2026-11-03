// Libro interactivo (data.kind = "libro"): se hojea con el dedo, se escucha con las palabras iluminadas (audio grabado por
// su autor o la voz del celular) y trae preguntas y juegos entre sus páginas. Pensado también para quien todavía no lee
// bien: letra grande, letra para aprender a leer, lectura despacio, tocar una palabra la dice y "Leer solo" pasa las
// páginas. Lo usan el visor (/biblioteca/<slug>/) y la vista previa de /crear/libro/.
import { sfx, setMuted, isMuted } from "./sonidos.js";

export const TIPOS = { cuento: "Cuento", educativo: "Educativo", libre: "Libre" };
export const EDADES = { "3-5": "3 a 5 años", "6-8": "6 a 8 años", "9-12": "9 a 12 años", todos: "Para todos" };
export const TEMAS = { cuentos: "Cuentos", lectura: "Lectura y lenguaje", ciencias: "Ciencias", naturaleza: "Naturaleza", historia: "Historia y cultura", valores: "Valores y emociones", matematicas: "Matemáticas", otro: "Otro" };
export const ESTILOS = { clasico: "Cuento clásico", acuarela: "Acuarela", comic: "Cómic", cuaderno: "Cuaderno", noche: "Noche de estrellas" };
export const LAYS = {
  portada: "Portada", imagen: "Imagen y texto", lado: "Imagen al lado", completa: "Ilustración completa", texto: "Solo texto",
  pregunta: "Pregunta", juego: "Juego", fin: "Fin", autores: "Autores",
};
export const JUEGOS = { sopa: "Sopa de letras", memorama: "Memorama", rompecabezas: "Rompecabezas" };
export const LIMITS = { pages: 24, words: 60, chars: 420 };
// what each page of a template is for, and the question that guides whoever writes it (the creator shows it)
export const ROLES = {
  portada: ["Portada", "¿Cómo se llama tu libro? Pon una ilustración que dé ganas de abrirlo."],
  dedicatoria: ["Dedicatoria", "¿A quién le dedican este libro? (a su familia, a su escuela, a su ciudad…)"],
  inicio: ["Inicio", "¿Quién es tu personaje, cómo es y dónde vive? Preséntalo en pocas palabras."],
  problema: ["El problema", "¿Qué le pasa a tu personaje? Algo cambia, se pierde o hay que resolver."],
  aventura: ["La aventura", "¿Qué hace para resolverlo? ¿A quién conoce en el camino?"],
  climax: ["El momento más emocionante", "¿Cuál es el momento más difícil o emocionante de la historia?"],
  desenlace: ["Desenlace", "¿Cómo se resuelve? ¿Cómo queda tu personaje?"],
  pregunta: ["Pregunta", "Una pregunta sobre lo que acaban de leer, para ver si se entendió."],
  fin: ["Fin", "¿Qué aprendió tu personaje? Una frase final o una moraleja."],
  autores: ["Autores", "Los nombres de quienes escribieron e ilustraron el libro, su grupo y su escuela."],
  tema: ["Tema", "¿De qué trata este tema? Explícalo como se lo contarías a un amigo."],
  explica: ["Explicación", "Un dato, un ejemplo o un paso. Una sola idea por página."],
  dato: ["¿Sabías que…?", "Un dato curioso que sorprenda a quien lee."],
  actividad: ["Actividad", "Un juego para practicar lo que aprendieron."],
  repaso: ["Repaso", "Una pregunta para repasar lo más importante."],
  libre: ["Página", "Escribe poco y deja que la imagen cuente lo demás."],
};
const P = (lay, role, extra = {}) => ({ lay, role, ...extra });
export const PLANTILLAS = {
  cuento: { t: "Cuento", d: "Inicio, problema, aventura y desenlace, con preguntas entre las páginas.", estilo: "clasico", pages: [
    P("portada", "portada"), P("texto", "dedicatoria"), P("imagen", "inicio"), P("imagen", "problema"), P("pregunta", "pregunta"),
    P("lado", "aventura"), P("completa", "climax"), P("imagen", "desenlace"), P("pregunta", "pregunta"), P("fin", "fin"), P("autores", "autores")] },
  educativo: { t: "Educativo", d: "Un tema con explicaciones cortas, datos curiosos, una actividad y un repaso.", estilo: "cuaderno", pages: [
    P("portada", "portada"), P("imagen", "tema"), P("lado", "explica"), P("lado", "explica"), P("completa", "dato"), P("juego", "actividad", { g: { k: "sopa", words: [] } }),
    P("imagen", "explica"), P("pregunta", "repaso"), P("pregunta", "repaso"), P("fin", "fin"), P("autores", "autores")] },
  libre: { t: "Libre", d: "Un álbum, un recetario, una biografía o lo que quieran: páginas libres.", estilo: "acuarela", pages: [
    P("portada", "portada"), P("imagen", "libre"), P("imagen", "libre"), P("imagen", "libre"), P("autores", "autores")] },
};
// a whole story ready to try (the maker's "Llenar con un cuento de ejemplo"): only the illustrations are missing
export const EJEMPLO = {
  name: "Balam y el río crecido", autor: "Un cuento de Vórtice VR", sub: "Un jaguarcito de la selva de Tabasco descubre que pedir ayuda también es ser valiente.",
  tipo: "cuento", edad: "6-8", tema: "cuentos", estilo: "acuarela",
  pages: [
    P("portada", "portada", { t: "Balam y el río crecido" }),
    P("texto", "dedicatoria", { t: "Para…", x: "Para todas las niñas y los niños que alguna vez tuvieron miedo y se atrevieron a pedir ayuda." }),
    P("imagen", "inicio", { t: "Balam", x: "En lo más verde de la selva de Tabasco vivía Balam, un jaguar pequeño con manchas como estrellas. Corría más rápido que nadie y trepaba los árboles más altos. Pero había algo que nunca hacía: meterse al agua." }),
    P("imagen", "problema", { t: "La gran lluvia", x: "Una tarde llovió y llovió. El río creció tanto que tapó el camino a casa. Del otro lado, su mamá lo llamaba: —¡Balam, ven! Pero Balam se quedó quieto en la orilla. ¡No sabía nadar!" }),
    P("pregunta", "pregunta", { q: { p: "¿Por qué Balam no podía volver a casa?", ops: [{ t: "El río creció y no sabía nadar" }, { t: "Se le olvidó el camino" }, { t: "Estaba jugando con sus amigos" }], ok: 0, why: "La lluvia hizo crecer el río y Balam nunca había aprendido a nadar." } }),
    P("lado", "aventura", { t: "Doña Tortuga", x: "Por la orilla pasó Doña Tortuga, una pochitoque muy sabia. —¿Por qué lloras, pequeño? —Quiero ir con mi mamá, pero me da miedo el agua —dijo Balam bajito. —Pedir ayuda no es de miedosos —sonrió ella—. Súbete a mi caparazón." }),
    P("completa", "climax", { t: "Ola tras ola", x: "Balam se agarró fuerte. El agua se movía y pasaban ramas flotando. —Respira y mira hacia adelante —le decía Doña Tortuga. Poco a poco, Balam dejó de temblar y hasta movió sus patas como si nadara." }),
    P("imagen", "desenlace", { t: "¡Mamá!", x: "En la otra orilla, su mamá lo abrazó con todas sus fuerzas. Balam le dio las gracias a Doña Tortuga y le pidió algo: —Mañana, ¿me enseñas a nadar?" }),
    P("pregunta", "pregunta", { q: { p: "¿Quién ayudó a Balam a cruzar el río?", ops: [{ t: "Doña Tortuga" }, { t: "Un cocodrilo" }, { t: "Nadie, cruzó solo" }], ok: 0, why: "Doña Tortuga, la pochitoque, lo llevó en su caparazón." } }),
    P("juego", "actividad", { t: "Encuentra las palabras del cuento", g: { k: "sopa", words: ["jaguar", "tortuga", "río", "selva", "lluvia", "mamá"] } }),
    P("fin", "fin", { t: "Fin", x: "Pedir ayuda también es ser valiente." }),
    P("autores", "autores", { t: "Hecho por", x: "Texto: Vórtice VR\nIlustraciones: ¡las de tu grupo!\nUn cuento de ejemplo para escribir el suyo" }),
  ],
};
export const wordsOf = t => (String(t || "").match(/\S+/g) || []).length;

const FONTS = "https://fonts.googleapis.com/css2?family=Andika:wght@400;700&family=Bangers&family=Comic+Neue:wght@400;700&family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Fredoka:wght@500;700&family=Nunito:wght@500;700;800&family=Patrick+Hand&display=swap";
const CSS = `
.lb{position:absolute;inset:0;overflow:hidden;display:flex;flex-direction:column;font-family:var(--lbB);color:var(--lbInk);background:var(--lbBg);-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:pan-y}
.lb *{box-sizing:border-box}.lb [hidden]{display:none!important}
.lb button{font:inherit;color:inherit;cursor:pointer}
.lb.clasico{--lbBg:radial-gradient(120% 80% at 50% 0%,#5b3a1f,#2a170a);--lbPaper:#fbf3e2;--lbInk:#2d1d0e;--lbAcc:#b4532a;--lbT:"Fraunces",Georgia,serif;--lbB:"Nunito",system-ui,sans-serif;--lbBar:rgba(30,16,6,.72)}
.lb.acuarela{--lbBg:linear-gradient(160deg,#9fd3e6,#f5c6d9 55%,#fde3b5);--lbPaper:#fffdf9;--lbInk:#33405a;--lbAcc:#e0658d;--lbT:"Fredoka",system-ui,sans-serif;--lbB:"Nunito",system-ui,sans-serif;--lbBar:rgba(51,64,90,.62)}
.lb.comic{--lbBg:radial-gradient(circle at 20% 20%,#ffd23f 0 12%,transparent 13%) 0 0/34px 34px,#ff5d5d;--lbPaper:#fff;--lbInk:#111;--lbAcc:#1e6fe0;--lbT:"Bangers",Impact,sans-serif;--lbB:"Comic Neue","Comic Sans MS",sans-serif;--lbBar:rgba(17,17,17,.82)}
.lb.cuaderno{--lbBg:linear-gradient(160deg,#2f6db5,#183d74);--lbPaper:#fdfdf7;--lbInk:#1f2a44;--lbAcc:#e2453c;--lbT:"Patrick Hand","Comic Sans MS",cursive;--lbB:"Patrick Hand","Comic Sans MS",cursive;--lbBar:rgba(15,32,64,.75)}
.lb.noche{--lbBg:radial-gradient(circle at 15% 25%,#fff 0 1px,transparent 1.5px) 0 0/61px 61px,radial-gradient(circle at 70% 60%,#d9ccff 0 1px,transparent 1.6px) 0 0/43px 43px,linear-gradient(180deg,#0d0a26,#2a1660);--lbPaper:#1c1641;--lbInk:#f4eeff;--lbAcc:#ffbe55;--lbT:"Fredoka",system-ui,sans-serif;--lbB:"Nunito",system-ui,sans-serif;--lbBar:rgba(8,5,24,.75)}
.lb.easy{--lbB:"Andika","Nunito",system-ui,sans-serif}
.lb-top{flex:none;display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 8px;color:#fff;z-index:3}
.lb-top .lb-logo{height:24px;width:auto;max-width:120px;object-fit:contain;filter:drop-shadow(0 1px 3px rgba(0,0,0,.4))}
.lb-top .lb-name{flex:1;min-width:0;font:700 .9rem var(--lbB);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 4px rgba(0,0,0,.45)}
.lb-ic{width:40px;height:40px;border-radius:50%;border:0;background:var(--lbBar);display:grid;place-items:center;flex:none;color:#fff}
.lb-ic svg{width:22px;height:22px}
.lb-stage{flex:1;min-height:0;position:relative;display:grid;place-items:center;padding:4px 14px;perspective:1600px}
.lb-sheet{position:relative;width:min(100%,calc((100dvh - 190px) * .74),560px);aspect-ratio:3/4;max-height:100%;background:var(--lbPaper);border-radius:6px 16px 16px 6px;box-shadow:0 26px 50px -18px rgba(0,0,0,.6),inset 10px 0 18px -12px rgba(0,0,0,.35);overflow:hidden;display:flex;flex-direction:column;transform-origin:left center}
.lb.comic .lb-sheet{border:4px solid #111;border-radius:10px;box-shadow:8px 8px 0 #111}
.lb.cuaderno .lb-sheet{background:linear-gradient(90deg,transparent 34px,#f3a3a0 34px 36px,transparent 36px),repeating-linear-gradient(180deg,var(--lbPaper) 0 31px,#cfe0f5 31px 32px)}
.lb.acuarela .lb-sheet{background:radial-gradient(60% 40% at 10% 0%,rgba(159,211,230,.35),transparent 70%),radial-gradient(50% 40% at 100% 100%,rgba(245,198,217,.4),transparent 70%),var(--lbPaper)}
.lb-sheet.out{animation:lbOut .55s ease-in forwards;z-index:2;position:absolute}
.lb-sheet.outb{animation:lbOutB .45s ease-in forwards;z-index:2;position:absolute}
.lb-sheet.in{animation:lbIn .5s ease-out}
@keyframes lbOut{to{transform:rotateY(-105deg);opacity:.2;box-shadow:-30px 0 40px rgba(0,0,0,.35)}}
@keyframes lbOutB{to{transform:translateX(40%) rotate(4deg);opacity:0}}
@keyframes lbIn{from{opacity:.4;transform:scale(.97)}}
.lb-pic{position:relative;flex:1 1 auto;min-height:0;display:grid;place-items:center;overflow:hidden}
.lb-pic img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.lb-pic.fit img{object-fit:contain}
.lb-txt{flex:none;padding:16px 20px 18px;font-size:calc(var(--lbFs,1.12rem));line-height:1.5;font-weight:600}
.lb-txt h2{margin:0 0 6px;font:800 1.35em/1.15 var(--lbT);color:var(--lbAcc);letter-spacing:.01em}
.lb.comic .lb-txt h2{font-weight:400;letter-spacing:.04em}
.lb-txt p{margin:0 0 .5em;white-space:pre-line}.lb-txt p:last-child{margin:0}
.lb .w{border-radius:6px;transition:background .12s,color .12s;padding:0 1px;cursor:pointer}
.lb .w.on{background:var(--lbAcc);color:#fff;box-shadow:0 0 0 2px var(--lbAcc)}
.lb.nohl .w.on{background:none;color:inherit;box-shadow:none}
.lb .w.tap{animation:lbTap .5s}
@keyframes lbTap{40%{transform:scale(1.15);display:inline-block}}
.lb-credit{font-size:.72rem;opacity:.7;margin-top:8px;font-weight:600}
/* layouts */
.lb-sheet.portada .lb-pic{position:absolute;inset:0}
.lb-sheet.portada .lb-cov{position:absolute;inset:auto 0 0 0;padding:70px 20px 22px;background:linear-gradient(transparent,rgba(0,0,0,.78));color:#fff;text-align:center}
.lb-sheet.portada.nopic{background:linear-gradient(160deg,var(--lbAcc),#2b1450)}
.lb-sheet.portada.nopic .lb-cov{top:0;background:none;display:flex;flex-direction:column;justify-content:center}
.lb-cov h1{margin:0;font:800 clamp(1.7rem,7vw,2.6rem)/1.05 var(--lbT);text-wrap:balance;text-shadow:0 2px 12px rgba(0,0,0,.4)}
.lb.comic .lb-cov h1{font-weight:400;letter-spacing:.05em}
.lb-cov .by{margin-top:8px;font-weight:700;opacity:.92}
.lb-cov .kick{display:inline-block;margin-bottom:10px;font:800 .66rem var(--lbB);letter-spacing:.2em;text-transform:uppercase;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:4px 10px}
.lb-go{margin-top:16px;display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:13px 24px;background:#ffbe55;color:#2b1300;font:800 1rem var(--lbB);box-shadow:0 8px 22px -6px rgba(0,0,0,.5)}
.lb-go.sec{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.45);box-shadow:none;margin-left:6px}
.lb-sheet.lado{flex-direction:row}
.lb-sheet.lado .lb-pic{flex:0 0 46%}
.lb-sheet.lado .lb-txt{flex:1;align-self:center}
.lb-sheet.completa .lb-pic{position:absolute;inset:0}
.lb-sheet.completa .lb-txt{position:absolute;left:12px;right:12px;bottom:12px;background:color-mix(in srgb,var(--lbPaper) 88%,transparent);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.lb-sheet.texto,.lb-sheet.fin,.lb-sheet.autores{justify-content:center;text-align:center}
.lb-sheet.texto .lb-pic,.lb-sheet.fin .lb-pic,.lb-sheet.autores .lb-pic{flex:0 1 38%;margin:18px 18px 0;border-radius:12px}
.lb-sheet.texto .lb-txt{font-size:calc(var(--lbFs,1.12rem) * 1.18)}
.lb-sheet.fin .lb-end{font:800 3.2rem var(--lbT);color:var(--lbAcc);margin:6px 0 0;line-height:1}
.lb-sheet.autores .lb-txt p{white-space:pre-line}
.lb-chip{display:inline-flex;align-items:center;gap:6px;font:800 .7rem var(--lbB);letter-spacing:.16em;text-transform:uppercase;color:#fff;background:var(--lbAcc);border-radius:999px;padding:5px 11px;margin-bottom:10px}
.lb-sheet.pregunta,.lb-sheet.juego,.lb-sheet.lock{padding:18px;justify-content:center;gap:10px;overflow:auto}
.lb-sheet.pregunta .lb-pic{flex:0 1 30%;border-radius:12px;min-height:80px}
.lb-q{font:800 1.3em/1.25 var(--lbT);margin:0;font-size:calc(var(--lbFs,1.12rem) * 1.2)}
.lb-ops{display:grid;gap:10px;margin-top:4px}
.lb-op{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:3px solid color-mix(in srgb,var(--lbInk) 18%,transparent);background:color-mix(in srgb,var(--lbPaper) 92%,var(--lbAcc));border-radius:16px;padding:12px 12px;font:700 calc(var(--lbFs,1.12rem) * .98)/1.25 var(--lbB);color:var(--lbInk)}
.lb-op .say{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--lbAcc);color:#fff}
.lb-op .say svg{width:18px;height:18px}
.lb-op.ok{border-color:#2fb67c;background:#d9f7e9;color:#0f3d29}
.lb-op.no{border-color:#e2453c;background:#ffe1df;color:#5c1410;animation:lbShake .4s}
@keyframes lbShake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.lb-why{margin:4px 0 0;font-weight:700;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,#2fb67c 16%,transparent)}
.lb-game{display:grid;place-items:center;gap:12px;text-align:center}
.lb-game .ico{width:96px;height:96px;border-radius:24px;display:grid;place-items:center;background:var(--lbAcc);color:#fff;font:800 2.4rem var(--lbT);box-shadow:0 10px 26px -10px rgba(0,0,0,.5)}
.lb-sheet.lock{text-align:center;align-items:center}
.lb-sheet.lock img.cv{width:42%;max-width:180px;aspect-ratio:3/4;object-fit:cover;border-radius:6px 12px 12px 6px;box-shadow:0 14px 30px -12px rgba(0,0,0,.55)}
.lb-buy{border:0;border-radius:999px;padding:14px 22px;background:var(--lbAcc);color:#fff;font:800 1rem var(--lbB);box-shadow:0 10px 24px -10px rgba(0,0,0,.55)}
.lb-link{border:0;background:none;text-decoration:underline;font-weight:700;opacity:.8;padding:6px}
.lb-stars{display:flex;gap:6px;justify-content:center;margin:8px 0}
.lb-stars svg{width:36px;height:36px}
.lb-acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}
.lb-acts button,.lb-acts a{border:2px solid var(--lbAcc);background:none;color:var(--lbAcc);border-radius:999px;padding:9px 15px;font:800 .88rem var(--lbB);text-decoration:none}
.lb-acts .main{background:var(--lbAcc);color:#fff}
/* bottom bar */
.lb-bot{flex:none;display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 14px calc(12px + env(safe-area-inset-bottom,0px));z-index:3}
.lb-nav{width:52px;height:52px;border-radius:50%;border:2px solid rgba(255,255,255,.35);background:var(--lbBar);color:#fff;display:grid;place-items:center}
.lb-nav svg{width:26px;height:26px}.lb-nav:disabled{opacity:.3}
.lb-say{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:0 20px;height:56px;background:#ffbe55;color:#2b1300;font:800 1rem var(--lbB);box-shadow:0 10px 24px -8px rgba(0,0,0,.55)}
.lb-say svg{width:24px;height:24px}
.lb-say.on{background:#fff;animation:lbPulse 1.4s ease-in-out infinite}
@keyframes lbPulse{50%{box-shadow:0 0 0 8px rgba(255,190,85,.35)}}
.lb-count{flex:none;font:800 .72rem var(--lbB);color:#fff;background:var(--lbBar);border-radius:999px;padding:4px 10px;letter-spacing:.06em}
.lb-count:empty{display:none}
.lb-auto{flex:none;font:800 .74rem var(--lbB);border:0;border-radius:999px;padding:0 12px;height:40px;background:var(--lbBar);color:#fff}
.lb-auto.on{background:#2fb67c}
/* sheets (settings, support) */
.lb-modal{position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;z-index:6}
.lb-box{width:100%;max-width:520px;background:#fffdf8;color:#1f1a2e;border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));font-family:"Nunito",system-ui,sans-serif;max-height:90%;overflow:auto}
.lb-box h3{margin:0 0 12px;font:800 1.15rem "Nunito",sans-serif}
.lb-box .row{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 14px}
.lb-box .lab{font:800 .74rem "Nunito",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#6b6380}
.lb-box .opt{border:2px solid #ddd3ee;background:#fff;border-radius:999px;padding:9px 15px;font:800 .92rem "Nunito",sans-serif;color:#1f1a2e}
.lb-box .opt[aria-pressed="true"]{border-color:#8b3fd6;background:#8b3fd6;color:#fff}
.lb-box input{font:700 1rem "Nunito",sans-serif;border:2px solid #ddd3ee;border-radius:12px;padding:10px 12px;width:130px}
.lb-box .close{width:100%;border:0;border-radius:999px;padding:13px;background:#1f1a2e;color:#fff;font:800 1rem "Nunito",sans-serif;margin-top:6px}
.lb-box .note{font-size:.85rem;color:#6b6380;margin:0 0 10px}
.lb-play{position:absolute;inset:0;z-index:7;background:#0b0418}
.lb-play .x{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));right:12px;z-index:9;width:44px;height:44px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:1.2rem}
.lb-toast{position:absolute;left:50%;top:calc(64px + env(safe-area-inset-top,0px));transform:translateX(-50%);background:rgba(10,4,22,.88);color:#fff;padding:10px 16px;border-radius:999px;font:700 .88rem "Nunito",sans-serif;z-index:8;max-width:90%;text-align:center}
.lb-conf{position:absolute;inset:0;pointer-events:none;z-index:5}
@media (min-width:760px){.lb-sheet{width:min(100%,calc((100dvh - 190px) * .74),600px)}}
@media (max-width:420px){.lb-top .lb-name{display:none}.lb-top{justify-content:flex-end}.lb-top>a,.lb-top>.lb-logo{margin-right:auto}.lb-sheet.lado{flex-direction:column}.lb-sheet.lado .lb-pic{flex:1 1 auto}.lb-sheet.lado .lb-txt{align-self:stretch}}
@media (prefers-reduced-motion:reduce){.lb-sheet.out,.lb-sheet.outb,.lb-sheet.in,.lb-say.on,.lb .w.tap,.lb-op.no{animation:none}.lb-sheet.out,.lb-sheet.outb{display:none}}
`;
const I = {
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  say: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>',
  aa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18l5-12 5 12M4.8 14h6.4M15 18l3-7 3 7M15.8 16h4.4"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3 4.8 6.4 4.8c2 0 3.3 1.1 4 2.3h3.2c.7-1.2 2-2.3 4-2.3 3.4 0 5.2 3.4 3.6 6.6C19 15.6 12 20 12 20z" fill="currentColor"/></svg>',
};
const STAR = on => `<svg viewBox="0 0 24 24"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" fill="${on ? "#ffbe55" : "rgba(127,127,127,.25)"}" stroke="${on ? "#c9851d" : "rgba(127,127,127,.35)"}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const peso = n => "$" + Number(n || 0).toLocaleString("es-MX");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// the voice of the phone: the best Spanish one (México first)
let voice = null;
function pickVoice() {
  if (!("speechSynthesis" in window)) return null;
  const vs = speechSynthesis.getVoices().filter(v => /^es\b|^es-/i.test(v.lang));
  const score = v => (/es-MX/i.test(v.lang) ? 40 : /es-US|es-419/i.test(v.lang) ? 30 : /es-ES/i.test(v.lang) ? 10 : 20) + (/natural|neural|premium|enhanced|google/i.test(v.name) ? 8 : 0) + (v.localService ? 2 : 0);
  voice = vs.sort((a, b) => score(b) - score(a))[0] || null; return voice;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", pickVoice); }
export const canSpeak = () => "speechSynthesis" in window;

/**
 * o: { root, cfg (an experience: slug, title, libro {name, autor, sub, estilo, pages, total, locked, venta}),
 *      src(id) → url of a picture or audio of the book, brand: {src, own, href} | null (null = no logo; without src = Vórtice VR's),
 *      access: {owned, mine, venta, author} (what /api/libro/<slug> said), buy(kind, amount) → Promise (the viewer goes to Stripe),
 *      url (to share), onClick(id), embedded (the maker's preview: nothing is saved, counted or paid), page (start on that page) }
 * returns { update(cfg, brand), go(i), destroy() }
 */
export function run(o) {
  if (!document.getElementById("lb-css")) {
    document.head.appendChild(Object.assign(document.createElement("style"), { id: "lb-css", textContent: CSS }));
    document.head.appendChild(Object.assign(document.createElement("link"), { rel: "stylesheet", href: FONTS }));
  }
  let cfg = o.cfg, brand = o.brand, at = 0, busy = false, timers = [], audio = null, hlRaf = 0, speaking = false, game = null, auto = false;
  const KEY = "vvr-libro-" + (cfg.slug || "x");
  const SET_KEY = "vvr-libro-ajustes";
  let set = { fs: 1, slow: false, easy: false, hl: true };
  try { Object.assign(set, JSON.parse(localStorage.getItem(SET_KEY) || "{}")); } catch {}
  let saved = {}; if (!o.embedded) try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
  const answers = {};   // page id → right on the first try
  const L = () => cfg.libro || { pages: [] };
  const acc = () => o.access || { owned: true, venta: L().venta || { modo: "gratis" } };
  const count = id => { if (!o.embedded && o.onClick) o.onClick(id); };
  const later = (f, ms) => { const t = setTimeout(f, ms); timers.push(t); return t; };
  const el = document.createElement("div"); o.root.appendChild(el);
  // the pages to turn: the book's, and a "keep reading" page where the free ones end (for sale and not bought)
  const seq = () => {
    const ps = L().pages.slice(), a = acc(), lockedN = L().locked || 0;
    if (o.embedded && a.venta && a.venta.modo === "venta" && a.venta.gratis < ps.length) ps.splice(a.venta.gratis, 0, { id: "_lock", lay: "lock", preview: true });
    else if (!a.owned && lockedN > 0) ps.push({ id: "_lock", lay: "lock" });
    return ps;
  };
  const src = id => id && o.src ? o.src(id) : "";
  const name = () => L().name || cfg.title || "Libro";

  function frame() {
    el.className = `lb ${L().estilo || "clasico"}${set.easy ? " easy" : ""}${set.hl ? "" : " nohl"}`;
    el.style.setProperty("--lbFs", (1.12 * set.fs).toFixed(2) + "rem");
    const dark = (L().estilo || "clasico") !== "acuarela";
    const logo = brand === null ? "" : brand && brand.own ? `<img class="lb-logo" src="${esc(brand.src)}" alt="">` : `<img class="lb-logo" src="${esc(new URL(dark ? "./logo-vorticevr-blanco.png" : "./logo-vorticevr.png", import.meta.url).href)}" alt="Vórtice VR">`;
    el.innerHTML = `<div class="lb-top">${brand && brand.href && !o.embedded ? `<a href="${esc(brand.href)}" target="_blank" rel="noopener">${logo}</a>` : logo}<div class="lb-name">${esc(name())}</div><span class="lb-count"></span><button class="lb-auto" type="button" data-auto aria-pressed="false">▶ Leer solo</button>
        ${acc().venta && acc().venta.modo === "apoyo" && !acc().mine ? `<button class="lb-ic" type="button" data-apoyo aria-label="Apoyar al autor">${I.heart}</button>` : ""}
        <button class="lb-ic" type="button" data-set aria-label="Ajustes de lectura">${I.aa}</button></div>
      <div class="lb-stage"></div>
      <div class="lb-bot"><button class="lb-nav" type="button" data-prev aria-label="Página anterior">${I.prev}</button>
        <button class="lb-say" type="button" data-say>${I.say}<span>Escuchar</span></button>
        <button class="lb-nav" type="button" data-next aria-label="Página siguiente">${I.next}</button></div>`;
    el.querySelector("[data-prev]").onclick = () => turn(-1);
    el.querySelector("[data-next]").onclick = () => turn(1);
    el.querySelector("[data-say]").onclick = () => { sfx.tap(); speaking ? stopVoice() : (count("listen"), readPage()); };
    el.querySelector("[data-set]").onclick = settings;
    el.querySelector("[data-auto]").onclick = () => { auto = !auto; sfx.tap(); paintAuto(); if (auto) { count("auto"); readPage(); } else stopVoice(); };
    const ap = el.querySelector("[data-apoyo]"); if (ap) ap.onclick = support;
    paintAuto(); show(at, 0);
  }
  const paintAuto = () => { const b = el.querySelector("[data-auto]"); if (b) { b.classList.toggle("on", auto); b.setAttribute("aria-pressed", auto); b.textContent = auto ? "■ Parar" : "▶ Leer solo"; } };

  // a text as words that light up (and say themselves when touched)
  const wordsHtml = t => esc(t).split(/(\s+)/).map(s => /\S/.test(s) ? `<span class="w">${s}</span>` : s).join("");
  const paras = x => String(x || "").split(/\n+/).filter(s => s.trim()).map(p => `<p>${wordsHtml(p)}</p>`).join("");
  const pic = (id, fit) => id ? `<div class="lb-pic${fit ? " fit" : ""}"><img src="${esc(src(id))}" alt="" draggable="false"></div>` : "";
  function pageHtml(p) {
    const T = p.t ? `<h2>${wordsHtml(p.t)}</h2>` : "", X = paras(p.x), C = p.credit ? `<div class="lb-credit">${esc(p.credit)}</div>` : "";
    switch (p.lay) {
      case "portada": {
        const resume = !o.embedded && saved.p > 0 && saved.p < seq().length - 1;
        return `${pic(p.img)}<div class="lb-cov"><span class="kick">Libro interactivo</span><h1>${wordsHtml(p.t || name())}</h1>${L().autor ? `<div class="by">${esc(L().autor)}</div>` : ""}
          <div><button class="lb-go" type="button" data-start>${resume ? "Volver a empezar" : "Empezar a leer"}</button>${resume ? `<button class="lb-go sec" type="button" data-resume>Seguir en la página ${saved.p + 1}</button>` : ""}</div></div>`;
      }
      case "lado": case "imagen": return `${pic(p.img)}<div class="lb-txt">${T}${X}${C}</div>`;
      case "completa": return `${pic(p.img)}${T || X ? `<div class="lb-txt">${T}${X}${C}</div>` : ""}`;
      case "texto": return `${pic(p.img, 1)}<div class="lb-txt">${T}${X}${C}</div>`;
      case "fin": return `${pic(p.img, 1)}<div class="lb-txt"><div class="lb-end">${wordsHtml(p.t || "Fin")}</div>${X}${C}${endHtml()}</div>`;
      case "autores": return `${pic(p.img, 1)}<div class="lb-txt"><h2>${wordsHtml(p.t || "Hecho por")}</h2>${X}${C}</div>`;
      case "pregunta": {
        const q = p.q || { p: "", ops: [] }, done = answers[p.id] !== undefined;
        return `<span class="lb-chip">${p.role === "repaso" ? "Repaso" : "Pregunta"}</span>${pic(p.img, 1)}<p class="lb-q">${wordsHtml(q.p)}</p>
          <div class="lb-ops">${q.ops.map((op, i) => `<button class="lb-op${done && i === q.ok ? " ok" : ""}" type="button" data-op="${i}"><span class="say" data-sayop="${i}" aria-label="Escuchar la respuesta">${I.say}</span><span>${wordsHtml(op.t)}</span></button>`).join("")}</div>
          ${done && q.why ? `<p class="lb-why">${wordsHtml(q.why)}</p>` : ""}`;
      }
      case "juego": {
        const g = p.g || {}, ico = g.k === "sopa" ? "ABC" : g.k === "memorama" ? "?" : "✦";
        return `<div class="lb-game"><span class="lb-chip">Juego · ${esc(JUEGOS[g.k] || "")}</span><div class="ico">${ico}</div><p class="lb-q">${wordsHtml(p.t || JUEGOS[g.k] || "")}</p>${X ? `<div>${X}</div>` : ""}<button class="lb-go" type="button" data-game>¡Jugar!</button></div>`;
      }
      case "lock": {
        const a = acc(), cover = L().pages[0], left = o.embedded ? L().pages.length - a.venta.gratis : L().locked;
        return `${cover && cover.img ? `<img class="cv" src="${esc(src(cover.img))}" alt="">` : ""}<p class="lb-q">¿Te está gustando?</p>
          <p style="margin:0;font-weight:700">Faltan ${left} ${left === 1 ? "página" : "páginas"} de «${esc(name())}».</p>
          <button class="lb-buy" type="button" data-buy>Comprar el libro · ${peso(a.venta && a.venta.precio)}</button>
          <p style="margin:0;font-size:.85rem;opacity:.75">Pago seguro con tarjeta. Queda en tu cuenta de Vórtice VR para leerlo cuando quieras.</p>
          ${p.preview ? `<button class="lb-link" type="button" data-next2>Seguir (solo en la vista previa)</button>` : !o.signed ? `<button class="lb-link" type="button" data-login>Ya lo compré: entrar con mi cuenta</button>` : ""}`;
      }
    }
    return "";
  }
  function endHtml() {
    const qs = L().pages.filter(p => p.lay === "pregunta"), right = qs.filter(p => answers[p.id] === true).length;
    const st = !qs.length ? 3 : right === qs.length ? 3 : right >= qs.length * .6 ? 2 : right > 0 ? 1 : 0;
    const a = acc();
    return `${qs.length ? `<div class="lb-stars">${[1, 2, 3].map(i => STAR(i <= st)).join("")}</div><div style="font-weight:800;font-size:.95rem">Contestaste bien ${right} de ${qs.length}</div>` : ""}
      <div class="lb-acts"><button class="main" type="button" data-again>Leer otra vez</button><button type="button" data-share>Compartir</button>
      ${a.venta && a.venta.modo === "apoyo" && !a.mine ? `<button type="button" data-apoyo2>♥ Apoyar al autor</button>` : ""}${o.embedded ? "" : `<a href="/biblioteca/">Más libros</a>`}</div>`;
  }

  // ---------- show and turn pages ----------
  function show(i, dir) {
    const S = seq(); i = Math.max(0, Math.min(S.length - 1, i)); const p = S[i];
    const stage = el.querySelector(".lb-stage"), old = stage.querySelector(".lb-sheet:not(.out):not(.outb)");
    const sh = document.createElement("div");
    sh.className = `lb-sheet ${p.lay}${(p.lay === "portada" && !p.img) ? " nopic" : ""}${dir ? " in" : ""}`;
    sh.innerHTML = pageHtml(p);
    if (old && dir && !reduced) { old.classList.add(dir > 0 ? "out" : "outb"); later(() => old.remove(), 560); } else if (old) old.remove();
    stage.appendChild(sh);
    at = i;
    el.querySelector("[data-prev]").disabled = i === 0;
    el.querySelector("[data-next]").disabled = i >= S.length - 1 || p.lay === "lock" && !p.preview;
    el.querySelector(".lb-count").textContent = p.lay === "lock" ? "" : `${Math.min(i + 1, L().total || L().pages.length)} / ${L().total || L().pages.length}`;
    const say = el.querySelector("[data-say]"); say.hidden = p.lay === "juego" || p.lay === "lock";
    wire(sh, p);
    if (!o.embedded && p.lay !== "lock") { saved.p = i; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} }
    if (p.lay === "fin") { count("fin"); if (!o.embedded) { saved.done = 1; saved.p = 0; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} } later(() => { sfx.win(); confetti(); }, 350); }
    if (p.lay === "lock") count("lock");
    if (auto && dir) later(() => { if (at === i) readPage(); }, 650);
  }
  function turn(d) {
    const S = seq(), n = at + d;
    if (n < 0 || n >= S.length || busy) return;
    if (d > 0 && S[at].lay === "lock" && !S[at].preview) return;
    stopVoice(true); busy = true; later(() => busy = false, reduced ? 50 : 420);
    sfx.page(); show(n, d);
  }
  function wire(sh, p) {
    sh.querySelectorAll(".w").forEach(w => !w.closest(".lb-op") && w.addEventListener("click", e => { e.stopPropagation(); sayWord(w); }));
    const q = (s, f) => { const b = sh.querySelector(s); if (b) b.onclick = e => { e.stopPropagation(); f(b, e); }; };
    q("[data-start]", () => { sfx.sparkle(5); count("open"); turn(1); });
    q("[data-resume]", () => { sfx.sparkle(5); count("open"); stopVoice(true); sfx.page(); show(saved.p, 1); });
    q("[data-game]", () => openGame(p));
    q("[data-buy]", b => { sfx.coin(); count("buy"); if (o.embedded) return toast("Así lo compran: con tarjeta y su cuenta de Vórtice VR"); b.disabled = true; b.textContent = "Abriendo el pago…"; Promise.resolve(o.buy && o.buy("comprar")).catch(err => toast(err && err.message || "No se pudo abrir el pago.")).finally(() => { b.disabled = false; b.textContent = `Comprar el libro · ${peso(acc().venta.precio)}`; }); });
    q("[data-login]", () => o.buy && o.buy("login"));
    q("[data-next2]", () => turn(1));
    q("[data-again]", () => { sfx.tap(); for (const k in answers) delete answers[k]; stopVoice(true); sfx.page(); show(0, -1); });
    q("[data-share]", () => { sfx.tap(); share(); });
    q("[data-apoyo2]", support);
    sh.querySelectorAll("[data-op]").forEach(b => b.onclick = e => {
      const say = e.target.closest("[data-sayop]");
      if (say) { e.stopPropagation(); sfx.tap(); speakText(p.q.ops[+say.dataset.sayop].t, b); return; }
      answer(p, +b.dataset.op, b);
    });
  }
  function answer(p, i, b) {
    const q = p.q; if (!q || answers[p.id] === true || b.classList.contains("ok")) return;
    if (i === q.ok) {
      if (answers[p.id] === undefined) answers[p.id] = true;
      sfx.correct(); b.classList.add("ok"); confetti(60);
      later(() => { const sh = b.closest(".lb-sheet"); if (!sh) return; if (q.why && !sh.querySelector(".lb-why")) { const w = Object.assign(document.createElement("p"), { className: "lb-why", innerHTML: wordsHtml(q.why) }); sh.appendChild(w); w.querySelectorAll(".w").forEach(x => x.onclick = ev => { ev.stopPropagation(); sayWord(x); }); if (auto || speaking) speakText(q.why, w); } }, 300);
      speakText("¡Muy bien!");
      if (auto) later(() => { if (seq()[at] === p) turn(1); }, q.why ? 5200 : 2200);
    } else {
      answers[p.id] = false; sfx.wrong(); b.classList.remove("no"); void b.offsetWidth; b.classList.add("no");
      if (navigator.vibrate && !o.embedded) try { navigator.vibrate(30); } catch {}
      speakText("Inténtalo otra vez");
    }
  }

  // ---------- reading aloud: the author's recording or the phone's voice, with the words lighting up ----------
  const rate = () => set.slow ? .78 : 1;
  function stopVoice(silent) {
    speaking = false; cancelAnimationFrame(hlRaf);
    if (audio) { audio.pause(); audio = null; }
    if (canSpeak()) try { speechSynthesis.cancel(); } catch {}
    el.querySelectorAll(".w.on").forEach(w => w.classList.remove("on"));
    paintSay(); if (!silent && auto) { auto = false; paintAuto(); }
  }
  const paintSay = () => { const b = el.querySelector("[data-say]"); if (!b) return; b.classList.toggle("on", speaking); b.innerHTML = speaking ? `${I.stop}<span>Parar</span>` : `${I.say}<span>Escuchar</span>`; };
  function readPage() {
    const S = seq(), p = S[at], sh = el.querySelector(".lb-sheet:not(.out):not(.outb)");
    if (!p || !sh) return;
    if (p.lay === "lock" || p.lay === "juego") { if (auto) { auto = false; paintAuto(); } return; }
    stopVoice(true);
    const ws = [...sh.querySelectorAll(p.lay === "pregunta" ? ".lb-q .w, .lb-op .w" : p.lay === "portada" ? ".lb-cov .w" : ".lb-txt .w")];
    const done = () => { speaking = false; paintSay(); el.querySelectorAll(".w.on").forEach(w => w.classList.remove("on"));
      if (auto && seq()[at] === p && p.lay !== "pregunta" && at < seq().length - 1) later(() => { if (auto && seq()[at] === p) turn(1); }, 1100);
      else if (auto && p.lay !== "pregunta") { auto = false; paintAuto(); } };
    if (!ws.length) { done(); return; }
    speaking = true; paintSay();
    if (p.aud && src(p.aud)) { playRecording(src(p.aud), ws, done); return; }
    speakWords(ws, done);
  }
  // the recording has no timing of its words: they light up in proportion to their length (with a pause after . , ! ?)
  function playRecording(url, ws, done) {
    const a = audio = new Audio(url); a.playbackRate = rate(); a.preservesPitch = true;
    const wt = ws.map(w => w.textContent.replace(/[^\p{L}\p{N}]/gu, "").length + 2 + (/[.!?…]$/.test(w.textContent) ? 6 : /[,;:]$/.test(w.textContent) ? 3 : 0));
    const tot = wt.reduce((x, y) => x + y, 0), cum = []; wt.reduce((x, y, i) => (cum[i] = x, x + y), 0);
    let cur = -1;
    const loop = () => { if (audio !== a) return; if (a.duration > 0) { const k = a.currentTime / a.duration * tot; let i = cum.length - 1; while (i > 0 && cum[i] > k) i--; if (i !== cur) { if (ws[cur]) ws[cur].classList.remove("on"); cur = i; ws[i].classList.add("on"); } } hlRaf = requestAnimationFrame(loop); };
    a.onended = () => { if (audio === a) { audio = null; cancelAnimationFrame(hlRaf); done(); } };
    a.onerror = () => { if (audio === a) { audio = null; speakWords(ws, done); } };
    a.play().then(() => { hlRaf = requestAnimationFrame(loop); }).catch(() => { audio = null; speakWords(ws, done); });
  }
  function speakWords(ws, done) {
    if (!canSpeak()) { speaking = false; paintSay(); toast("Este celular no puede leer en voz alta."); if (auto) { auto = false; paintAuto(); } return; }
    const parts = ws.map(w => w.textContent), text = parts.join(" "), starts = []; parts.reduce((x, t, i) => (starts[i] = x, x + t.length + 1), 0);
    const u = new SpeechSynthesisUtterance(text); u.lang = voice ? voice.lang : "es-MX"; if (voice) u.voice = voice; u.rate = rate() * .95; u.pitch = 1.05;
    let cur = -1, got = false, fake = 0;
    const light = i => { if (i === cur || !ws[i]) return; if (ws[cur]) ws[cur].classList.remove("on"); cur = i; ws[i].classList.add("on"); };
    u.onboundary = e => { if (e.name && e.name !== "word") return; got = true; clearInterval(fake); let i = starts.length - 1; while (i > 0 && starts[i] > e.charIndex) i--; light(i); };
    u.onstart = () => { // some voices tell no word boundaries: light them up at a steady pace
      later(() => { if (got || !speaking) return; const per = 60000 / (150 * rate()); let i = 0; light(0); fake = setInterval(() => { i++; if (i >= ws.length) clearInterval(fake); else light(i); }, per); timers.push(fake); }, 700);
    };
    u.onend = () => { clearInterval(fake); if (speaking) done(); };
    u.onerror = () => { clearInterval(fake); if (speaking) done(); };
    try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { done(); }
  }
  function speakText(t, node) {
    if (!canSpeak() || !t) return;
    const u = new SpeechSynthesisUtterance(t); u.lang = voice ? voice.lang : "es-MX"; if (voice) u.voice = voice; u.rate = rate() * .95;
    try { if (!speaking) speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {}
  }
  function sayWord(w) {
    sfx.pop(); w.classList.remove("tap"); void w.offsetWidth; w.classList.add("tap");
    const t = w.textContent.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!t || speaking) return;
    if (!canSpeak()) return;
    const u = new SpeechSynthesisUtterance(t); u.lang = voice ? voice.lang : "es-MX"; if (voice) u.voice = voice; u.rate = .75;
    try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {}
  }

  // ---------- the games of the book (the same engines as the experiences) ----------
  async function openGame(p) {
    const g = p.g || {}; sfx.swoosh(); count("game");
    stopVoice();
    const box = document.createElement("div"); box.className = "lb-play"; box.innerHTML = `<button class="x" type="button" aria-label="Volver al libro">✕</button>`;
    el.appendChild(box);
    const close = () => { try { game && game.destroy(); } catch {} game = null; box.remove(); sfx.swoosh(); };
    box.querySelector(".x").onclick = close;
    const color = getComputedStyle(el).getPropertyValue("--lbAcc").trim() || "#8b3fd6";
    const base = { slug: `${cfg.slug || "x"}-${p.id}`, title: p.t || JUEGOS[g.k] };
    const gb = brand === null ? null : brand && brand.own ? brand : { src: new URL("./logo-vorticevr-blanco.png", import.meta.url).href };
    try {
      if (g.k === "sopa") { const M = await import("./sopa.js"); game = M.run({ root: box, cfg: { ...base, sopa: { name: p.t || "Sopa de letras", mode: "lista", level: "facil", time: 0, color, words: (g.words || []).map(w => ({ w })) } }, brand: gb, url: o.url, embedded: o.embedded }); }
      else if (g.k === "memorama") { const M = await import("./memorama.js"); game = M.run({ root: box, cfg: { ...base, memorama: { name: p.t || "Memorama", mode: g.mode || "iguales", time: 60, color, pairs: (g.pairs || []).map((x, i) => ({ id: "p" + i, a: x.a, b: x.b })) } }, src, brand: gb, url: o.url, embedded: o.embedded }); }
      else if (g.k === "rompecabezas") {
        const M = await import("./rompecabezas.js"), it = (cfg.items || []).find(i => i.id === g.img) || { w: 1200, h: 900 };
        game = M.run({ root: box, cfg: { ...base, img: { w: it.w, h: it.h }, rompecabezas: { name: p.t || "Rompecabezas", level: g.level || "facil", time: 120, color } }, image: src(g.img), brand: gb, url: o.url, embedded: o.embedded });
      }
      box.appendChild(box.querySelector(".x"));
    } catch (e) { console.error(e); close(); toast("No se pudo abrir el juego."); }
  }

  // ---------- settings, support, share ----------
  function modal(html, wireUp) {
    const m = document.createElement("div"); m.className = "lb-modal"; m.innerHTML = `<div class="lb-box">${html}</div>`;
    m.onclick = e => { if (e.target === m) m.remove(); };
    el.appendChild(m); sfx.swoosh(); wireUp(m); return m;
  }
  function settings() {
    const opt = (k, v, t) => `<button class="opt" type="button" data-k="${k}" data-v="${v}" aria-pressed="${String(set[k]) === String(v)}">${t}</button>`;
    modal(`<h3>Cómo quieres leer</h3>
      <div class="lab">Tamaño de la letra</div><div class="row">${opt("fs", 1, "Normal")}${opt("fs", 1.25, "Grande")}${opt("fs", 1.5, "Enorme")}</div>
      <div class="lab">Letra</div><div class="row">${opt("easy", false, "La del libro")}${opt("easy", true, "Para aprender a leer")}</div>
      <div class="lab">Voz</div><div class="row">${opt("slow", false, "Normal")}${opt("slow", true, "Más despacio")}</div>
      <div class="lab">Iluminar las palabras</div><div class="row">${opt("hl", true, "Sí")}${opt("hl", false, "No")}</div>
      <div class="lab">Sonidos</div><div class="row"><button class="opt" type="button" data-mute="0" aria-pressed="${!isMuted()}">Con sonidos</button><button class="opt" type="button" data-mute="1" aria-pressed="${isMuted()}">Sin sonidos</button></div>
      <p class="note">Toca cualquier palabra para escucharla.</p><button class="close" type="button">Listo</button>`, m => {
      m.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
        const k = b.dataset.k, v = b.dataset.v; set[k] = k === "fs" ? +v : v === "true";
        try { localStorage.setItem(SET_KEY, JSON.stringify(set)); } catch {}
        m.querySelectorAll(`[data-k="${k}"]`).forEach(x => x.setAttribute("aria-pressed", x === b)); sfx.tap();
        el.classList.toggle("easy", set.easy); el.classList.toggle("nohl", !set.hl); el.style.setProperty("--lbFs", (1.12 * set.fs).toFixed(2) + "rem");
      });
      m.querySelectorAll("[data-mute]").forEach(b => b.onclick = () => { setMuted(b.dataset.mute === "1"); m.querySelectorAll("[data-mute]").forEach(x => x.setAttribute("aria-pressed", x === b)); sfx.tap(); });
      m.querySelector(".close").onclick = () => m.remove();
    });
  }
  function support() {
    sfx.tap(); count("apoyo-abrir");
    let amount = 50;
    modal(`<h3>Apoya a quien escribió «${esc(name())}»</h3><p class="note">Este libro es gratis. Si te gustó, puedes darle un apoyo a su autor. Se paga con tarjeta y con tu cuenta de Vórtice VR.</p>
      <div class="row">${[20, 50, 100, 200].map(v => `<button class="opt" type="button" data-a="${v}" aria-pressed="${v === amount}">${peso(v)}</button>`).join("")}<input type="number" inputmode="numeric" min="10" max="5000" placeholder="Otra" aria-label="Otra cantidad en pesos"></div>
      <button class="close" type="button" data-go style="background:#e0658d">♥ Apoyar con ${peso(amount)}</button><button class="close" type="button" data-x style="background:none;color:#6b6380">Ahora no</button>`, m => {
      const go = m.querySelector("[data-go]"), inp = m.querySelector("input");
      const paint = () => { go.textContent = `♥ Apoyar con ${peso(amount)}`; go.disabled = !(amount >= 10 && amount <= 5000); };
      m.querySelectorAll("[data-a]").forEach(b => b.onclick = () => { amount = +b.dataset.a; inp.value = ""; m.querySelectorAll("[data-a]").forEach(x => x.setAttribute("aria-pressed", x === b)); sfx.tap(); paint(); });
      inp.oninput = () => { amount = Math.round(+inp.value) || 0; m.querySelectorAll("[data-a]").forEach(x => x.setAttribute("aria-pressed", "false")); paint(); };
      m.querySelector("[data-x]").onclick = () => m.remove();
      go.onclick = () => { sfx.coin(); count("apoyo"); if (o.embedded) { m.remove(); toast("Así apoyan a su autor: con tarjeta y su cuenta de Vórtice VR"); return; }
        go.disabled = true; go.textContent = "Abriendo el pago…"; Promise.resolve(o.buy && o.buy("apoyar", amount)).catch(err => toast(err && err.message || "No se pudo abrir el pago.")).finally(paint); };
    });
  }
  async function share() {
    count("share");
    if (o.embedded) { toast("Así lo comparten con sus amigos"); return; }
    const text = `Te recomiendo el libro «${name()}»${L().autor ? ` de ${L().autor}` : ""}: se lee, se escucha y trae juegos.`;
    try { if (navigator.share) { await navigator.share({ title: name(), text, url: o.url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text + " " + o.url); toast("Copiado: pégalo donde quieras"); } catch { toast(o.url); }
  }
  function toast(t) { const s = Object.assign(document.createElement("div"), { className: "lb-toast", textContent: t }); el.appendChild(s); later(() => s.remove(), 2600); }
  function confetti(n = 140) {
    if (reduced) return;
    const c = Object.assign(document.createElement("canvas"), { className: "lb-conf" }); el.appendChild(c);
    const W = c.width = el.clientWidth * (devicePixelRatio || 1), H = c.height = el.clientHeight * (devicePixelRatio || 1), g = c.getContext("2d");
    const cols = ["#ffd27f", "#ff8fb1", "#6ff0b2", "#6fc8ff", "#c99bff", "#ffbe55"];
    const ps = Array.from({ length: n }, () => ({ x: W * Math.random(), y: -H * Math.random() * .5, vx: (Math.random() - .5) * W * .004, vy: H * (.004 + Math.random() * .006), r: Math.random() * 6, vr: (Math.random() - .5) * .3, s: (6 + Math.random() * 8) * (devicePixelRatio || 1), c: cols[Math.floor(Math.random() * cols.length)] }));
    const t0 = performance.now();
    const fr = () => { if (!c.isConnected) return; const k = (performance.now() - t0) / 3000; g.clearRect(0, 0, W, H);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - k * k); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
      if (k < 1) requestAnimationFrame(fr); else c.remove(); };
    fr();
  }

  // swipe to turn, arrows on a keyboard
  let sx = 0, sy = 0, st = 0;
  el.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; st = performance.now(); }, { passive: true });
  el.addEventListener("pointerup", e => {
    if (game || el.querySelector(".lb-modal")) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4 && performance.now() - st < 700) turn(dx < 0 ? 1 : -1);
  }, { passive: true });
  const key = e => { if (game || el.querySelector(".lb-modal") || /input|textarea/i.test((e.target && e.target.tagName) || "")) return; if (e.key === "ArrowRight") turn(1); else if (e.key === "ArrowLeft") turn(-1); };
  if (!o.embedded) addEventListener("keydown", key);
  const vis = () => { if (document.hidden) stopVoice(); };
  document.addEventListener("visibilitychange", vis);

  at = Math.max(0, Math.min(seq().length - 1, o.page || 0));
  frame();
  return {
    update(c, b, access) { cfg = c; if (b !== undefined) brand = b; if (access !== undefined) o.access = access; stopVoice(true); at = Math.min(at, seq().length - 1); frame(); },
    go(i) { stopVoice(true); if (i !== at) { sfx.page(); show(i, i > at ? 1 : -1); } },
    destroy() { stopVoice(true); timers.forEach(clearTimeout); try { game && game.destroy(); } catch {} removeEventListener("keydown", key); document.removeEventListener("visibilitychange", vis); el.remove(); },
  };
}
