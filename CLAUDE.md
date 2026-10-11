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

Las tarjetas NFC y QR de clientes apuntan a `t.vorticevr.mx/<cliente>/`. **Nunca cambiar ni borrar una ruta ya impresa en tarjetas.**

## Reglas
- Páginas de clientes: `<meta name="robots" content="noindex">` y sin enlaces desde la página principal, salvo que César diga que el cliente autorizó mostrarlo.
- Logo de Vórtice VR: solo en su morado original o en blanco; no recolorearlo (los efectos alrededor sí pueden ser de otro color).
- No inventar proyectos ni datos de clientes en la página principal: solo lo que César haya confirmado.
- Commits con autor `Claude <noreply@anthropic.com>`.

## Realidad aumentada (`/ra/ocv-johara/`)
- MindAR 1.2.5 + three.js 0.160 desde jsDelivr (import map).
- `targets.mind`: image target compilado desde la cara del QR de la tarjeta impresa (1050×600). Si cambia el diseño impreso, hay que regenerarlo con el compilador de MindAR (`Compiler.compileImageTargets` en un navegador headless con WebGL).
- `jicara.glb`: modelo con texturas a 1024 px y los huecos del escaneo rellenados. La función `addLiner()` agrega una capa interior para que no se vea a través del modelo.
- `ocv-logo.svg`: logo de OCV vectorizado por color; se extruye en 3D con `SVGLoader` y colores planos (`MeshBasicMaterial`).
- Captura de foto y video: compone el video de la cámara y el canvas WebGL justo después de cada render. Para guardar se usa Web Share (en iPhone: "Guardar imagen/video") o descarga.
- Para probar sin cámara: reemplazar `mindar-image-three` por un stub que exponga `renderer/scene/camera/addAnchor/start`.
