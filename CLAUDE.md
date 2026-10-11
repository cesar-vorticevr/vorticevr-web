# vorticevr-web: guía para Claude

Sitio de Vórtice VR (estudio de RA, RV, RM e IA aplicada de César García, Villahermosa, Tabasco).
Responder a César en español, directo y práctico.

## Publicación
- HTML estático, sin build. Cada página es una carpeta con su `index.html`.
- Se publica en **Cloudflare Workers (static assets)** al hacer push a `main` (`wrangler.jsonc`, `.assetsignore`).
- Dominios conectados al Worker `vorticevr-web`: `vorticevr.mx`, `www.vorticevr.mx`, `t.vorticevr.mx`.
- DNS en Cloudflare; el dominio está registrado en GoDaddy. Ya no se usa Wix.
- Rutas siempre relativas (funcionan en cualquier dominio o subdominio).

## Estructura
| Ruta | Qué es |
|---|---|
| `/` | Página principal de Vórtice VR |
| `/tarjeta/` | Tarjeta digital de César (destino de sus tarjetas NFC) |
| `/johara/` | Portal de Johara De Leija, Directora General de OCV Tabasco (clienta) |
| `/ra/ocv-johara/` | RA sobre la tarjeta impresa de Johara |
| `/assets/` | Logos e íconos compartidos |
| `_clientes/`, `_plantillas/`, `tools/` | Fuentes para generar tarjetas de clientes (no se publican: `.assetsignore`) |

Las tarjetas NFC y QR de clientes apuntan a `t.vorticevr.mx/<cliente>/`. **Nunca cambiar ni borrar una ruta ya impresa en tarjetas.**

## Reglas
- Páginas de clientes: `<meta name="robots" content="noindex">` y sin enlaces desde la página principal, salvo que César diga que el cliente autorizó mostrarlo.
- Logo de Vórtice VR: solo en su morado original o en blanco; no recolorearlo (los efectos alrededor sí pueden ser de otro color).
- No inventar proyectos ni datos de clientes en la página principal: solo lo que César haya confirmado.
- Commits con autor `Claude <noreply@anthropic.com>`.

## Realidad aumentada (`/ra/ocv-johara/`)
- MindAR 1.2.5 + three.js 0.160 desde jsDelivr (import map).
- `targets.mind`: image target compilado desde la cara del QR de la tarjeta impresa (1050×600). Si cambia el diseño impreso, hay que regenerarlo con `tools/compilar-target.mjs` (ver abajo).
- `jicara.glb`: modelo con texturas a 1024 px y los huecos del escaneo rellenados. La función `addLiner()` agrega una capa interior para que no se vea a través del modelo.
- `ocv-logo.svg`: logo de OCV vectorizado por color; se extruye en 3D con `SVGLoader` y colores planos (`MeshBasicMaterial`).
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
1. Copiar `_clientes/_plantilla/` a `_clientes/<slug>/`, poner las imágenes y llenar `cliente.json`. `slug` = ruta de la tarjeta (`t.vorticevr.mx/<slug>/`), en minúsculas y con guiones.
2. `node tools/compilar-target.mjs <slug>` → escribe `_clientes/<slug>/targets.mind` desde `ra.imagen_target` (el diseño de la cara que se reconoce, 1000 px de ancho o más; avisa si es más chica).
3. Revisar sin publicar: `node tools/generar-cliente.mjs <slug> --salida <carpeta-temporal>` y abrirla con un servidor local.
4. `node tools/generar-cliente.mjs <slug>` → escribe en la raíz del sitio. Commit y push a `main`.
5. Link para grabar en la tarjeta NFC/QR: `https://t.vorticevr.mx/<slug>/`.

Detalles:
- El generador no sobrescribe un `index.html` que no tenga su marca (`Generado con tools/generar-cliente.mjs`) salvo con `--forzar`. Para cambiar un cliente generado: editar su JSON y volver a generar.
- Las páginas generadas llevan `noindex` y no se enlazan desde la página principal (misma regla de siempre).
- Posiciones de la RA en unidades del target: la tarjeta mide 1 de ancho y está centrada en 0,0 (x a la derecha, y hacia arriba, z hacia la cámara). `modelo.tamano` es el ancho del modelo; `modelo.forro` agrega la capa interior (para escaneos con huecos). `logo` en SVG con colores planos se extruye en 3D (paths con `data-part="t"` quedan delgados); en PNG/WebP es un plano.
- `compilar-target.mjs` levanta un servidor local, abre Chrome headless con `--use-angle=swiftshader` y usa `Compiler` de `mind-ar@1.2.5/dist/mindar-image.prod.js` por DevTools Protocol. Si no encuentra el navegador: variable `CHROME_PATH`. También acepta `node tools/compilar-target.mjs <imagen> <salida.mind>`.
- Para probar la RA sin cámara: en una copia generada con `--salida`, apuntar `mindar-image-three` del import map a un stub que exponga `renderer/scene/camera/addAnchor/start`.
