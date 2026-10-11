# vorticevr-web

Sitio de Vórtice VR, publicado en Cloudflare Workers (static assets) con cada push a `main`. Dominios: vorticevr.mx, www.vorticevr.mx y t.vorticevr.mx (alias; las tarjetas de clientes usan vorticevr.mx/<cliente>/).

| Ruta | Qué es |
|---|---|
| `/` | Página principal de Vórtice VR |
| `/tarjeta/` | Tarjeta digital de César (destino de las tarjetas NFC) |
| `/johara/` | Portal de contacto de Johara De Leija (OCV Tabasco), no indexado |
| `/ra/ocv-johara/` | Realidad aumentada sobre la tarjeta de Johara (image target del lado del QR), no indexado |
| `/assets/` | Logos e íconos compartidos |

Cada página es HTML estático, sin build. Para agregar contenido nuevo se crea una carpeta con su `index.html`.
Las rutas son relativas para que funcionen igual en cualquier dominio o subdominio.

Tarjetas de clientes nuevos: se generan desde `_clientes/<slug>/cliente.json` con `tools/generar-cliente.mjs` (ver CLAUDE.md).

Notas de la RA (`/ra/ocv-johara/`):
- `targets.mind` se generó desde el lado del QR de la tarjeta impresa; si cambia ese diseño hay que regenerarlo.
- `jicara.glb` tiene texturas a 1024 px y los huecos del escaneo rellenados; la página agrega una capa interior para que no se vea a través.
