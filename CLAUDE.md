# vorticevr-web: guía para Claude

Sitio de Vórtice VR (estudio de RA, RV, RM e IA aplicada de César García, Villahermosa, Tabasco).
Responder a César en español, directo y práctico.

## Publicación
- HTML estático, sin build. Cada página es una carpeta con su `index.html`.
- Se publica en **Cloudflare Workers (static assets)** al hacer push a `main` (`wrangler.jsonc`, `.assetsignore`).
- Dominios conectados al Worker `vorticevr-web`: `vorticevr.mx`, `www.vorticevr.mx`, `t.vorticevr.mx`.
- DNS en Cloudflare; el dominio está registrado en GoDaddy. Ya no se usa Wix.
- Rutas siempre relativas (funcionan en cualquier dominio o subdominio).
- `worker.js`: Worker mínimo que solo corre en `/ra/*` (`run_worker_first`). Los static assets ignoran las peticiones `Range` y el iPhone las necesita para reproducir `<video>`; el Worker responde 206 para videos y deja pasar todo lo demás. Los videos nuevos deben ir bajo `/ra/` (o ampliar `run_worker_first`).

## Estructura
| Ruta | Qué es |
|---|---|
| `/` | Página principal de Vórtice VR |
| `/tarjeta/` | Tarjeta digital de César (destino de sus tarjetas NFC) |
| `/johara/` | Portal de Johara De Leija, Directora General de OCV Tabasco (clienta) |
| `/ra/ocv-johara/` | RA sobre la tarjeta impresa de Johara |
| `/assets/` | Logos e íconos compartidos |
| `_clientes/`, `_plantillas/`, `tools/` | Fuentes para generar tarjetas de clientes (no se publican: `.assetsignore`) |

Las tarjetas NFC y QR de clientes apuntan a `https://vorticevr.mx/<cliente>/` (`t.vorticevr.mx` sigue funcionando como alias, pero no se usa en tarjetas nuevas: un subdominio nuevo puede tardar en reconocerse en algunas redes). **Nunca cambiar ni borrar una ruta ya impresa en tarjetas.**

## Reglas
- Páginas de clientes: `<meta name="robots" content="noindex">` y sin enlaces desde la página principal, salvo que César diga que el cliente autorizó mostrarlo.
- Logo de Vórtice VR: solo en su morado original o en blanco; no recolorearlo (los efectos alrededor sí pueden ser de otro color).
- No inventar proyectos ni datos de clientes en la página principal: solo lo que César haya confirmado.
- Commits con autor `Claude <noreply@anthropic.com>`.

## Realidad aumentada (`/ra/ocv-johara/`)
- MindAR 1.2.5 + three.js 0.160 desde jsDelivr (import map).
- `targets.mind`: image target compilado desde la cara del QR de la tarjeta impresa (1050×600). Si cambia el diseño impreso, hay que regenerarlo con `tools/compilar-target.mjs` (ver abajo).
- `video.mp4`: video promocional de OCV (960×540, H.264 + audio AAC 96k, ~12 MB; imagen y audio sacados de https://www.youtube.com/watch?v=XXbLnNzroYY y comprimido con ffmpeg). Se reproduce como `VideoTexture` del mismo `<video id="vid">` sobre la tarjeta; si se pierde el tracking, ese mismo elemento se muestra en pantalla (`#vbox`) sin reiniciar, con botón de pantalla completa (nativa; si el navegador no la permite, la página la simula). Al volver a detectar la tarjeta regresa a ella, salvo que esté en pantalla completa.
- `ocv-logo.svg`: logo de OCV vectorizado por color; se extruye en 3D con `SVGLoader` y colores planos (`MeshBasicMaterial`), acostado paralelo a la tarjeta arriba de su borde superior, sobre una placa blanca para que se lea el texto.
- Sonido: la reproducción se desbloquea con sonido en el toque de "Activar cámara"; si el navegador lo impide, el video sigue en silencio y el botón de bocina (arriba a la derecha) lo activa.
- iPhone: `requestVideoFrameCallback` no se dispara mientras el `<video>` está oculto (modo tarjeta), así que el loop fuerza `vtex.needsUpdate` en cada render; sin eso el video se ve congelado sobre la tarjeta.
- El botón "← Datos de contacto" (a `/johara/`) está visible siempre, también antes de activar la cámara.
- La jícara (`jicara.glb`) se quitó en octubre de 2026; sigue en `_clientes/johara/modelo.glb` como ejemplo de la plantilla.
- Captura de foto y video: compone el video de la cámara y el canvas WebGL justo después de cada render. Para guardar se usa Web Share (en iPhone: "Guardar imagen/video") o descarga.
- Para probar sin cámara: reemplazar `mindar-image-three` por un stub que exponga `renderer/scene/camera/addAnchor/start`.

## Tarjetas de clientes (NFC + RA) con plantilla
Cada cliente nuevo se genera desde datos; no se copia ni se edita HTML a mano.

| Archivo | Qué es |
|---|---|
| `_clientes/<slug>/cliente.json` | Datos del cliente: nombre, cargo, organización, teléfono, WhatsApp, correo, web, redes, dirección, banda, pie, colores, fuente, imágenes y bloque `ra` |
| `_clientes/<slug>/*` | Sus imágenes: logo, franja, textura, pie, `tarjeta.jpg` (ligera), imagen del target en alta, `modelo.glb`, logo de la RA (SVG o PNG) y `targets.mind` |
| `_clientes/_plantilla/cliente.json` | Ejemplo comentado de todos los campos (las claves con `_` son comentarios) |
| `_clientes/johara/` | Referencia completa. `"protegido": true`: sus páginas se hicieron a mano y ya están impresas; el generador nunca escribe en `/johara/` ni en `/ra/ocv-johara/` |
| `_plantillas/portal.html`, `_plantillas/ra.html` | Plantillas (`{{campo}}` se escapa, `{{{campo}}}` va tal cual). La RA lee todo de un objeto `CFG` |
| `tools/generar-cliente.mjs` | Genera `/<slug>/` y `/ra/<ra.slug>/` y copia los archivos |
| `tools/compilar-target.mjs` | Compila `targets.mind` desde la imagen de la tarjeta |

Pasos para un cliente nuevo (Node 22+ y Chrome o Edge instalados; no hay `npm install`):
1. Copiar `_clientes/_plantilla/` a `_clientes/<slug>/`, poner las imágenes y llenar `cliente.json`. `slug` = ruta de la tarjeta (`vorticevr.mx/<slug>/`), en minúsculas y con guiones.
2. `node tools/compilar-target.mjs <slug>` → escribe `_clientes/<slug>/targets.mind` desde `ra.imagen_target` (el diseño de la cara que se reconoce, 1000 px de ancho o más; avisa si es más chica).
3. Revisar sin publicar: `node tools/generar-cliente.mjs <slug> --salida <carpeta-temporal>` y abrirla con un servidor local.
4. `node tools/generar-cliente.mjs <slug>` → escribe en la raíz del sitio. Commit y push a `main`.
5. Link para grabar en la tarjeta NFC/QR: `https://vorticevr.mx/<slug>/`.

Detalles:
- El generador no sobrescribe un `index.html` que no tenga su marca (`Generado con tools/generar-cliente.mjs`) salvo con `--forzar`. Para cambiar un cliente generado: editar su JSON y volver a generar.
- Las páginas generadas llevan `noindex` y no se enlazan desde la página principal (misma regla de siempre).
- Posiciones de la RA en unidades del target: la tarjeta mide 1 de ancho y está centrada en 0,0 (x a la derecha, y hacia arriba, z hacia la cámara). `modelo.tamano` es el ancho del modelo; `modelo.forro` agrega la capa interior (para escaneos con huecos). `logo` en SVG con colores planos se extruye en 3D (paths con `data-part="t"` quedan delgados); en PNG/WebP es un plano.
- `compilar-target.mjs` levanta un servidor local, abre Chrome headless con `--use-angle=swiftshader` y usa `Compiler` de `mind-ar@1.2.5/dist/mindar-image.prod.js` por DevTools Protocol. Si no encuentra el navegador: variable `CHROME_PATH`. También acepta `node tools/compilar-target.mjs <imagen> <salida.mind>`.
- Para probar la RA sin cámara: en una copia generada con `--salida`, apuntar `mindar-image-three` del import map a un stub que exponga `renderer/scene/camera/addAnchor/start`.

## Probar antes de publicar
`main` = producción (vorticevr.mx). **No hacer push a `main` sin que César lo apruebe.** Los cambios a la página van primero a la rama `preview`.
1. Local: `node tools/servidor-local.mjs` → http://localhost:8080 (también muestra la IP para abrirlo desde el celular en el mismo wifi). La cámara de la RA en el celular requiere https: para eso usar la versión preview.
2. Preview en internet: commit y push a la rama `preview`. Cloudflare sube una versión de prueba (no toca producción) y la URL aparece en el check "Workers Builds" del commit en GitHub.
3. Cuando César apruebe: `git switch main && git merge --ff-only preview && git push` (eso publica). Subir `main` y `preview` en pushes separados, no al mismo tiempo.
