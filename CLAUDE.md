# vorticevr-web: guía para Claude

Sitio de Vórtice VR (estudio de RA, RV, RM e IA aplicada de César García, Villahermosa, Tabasco).
Responder a César en español, directo y práctico.

## Publicación
- HTML estático, sin build. Cada página es una carpeta con su `index.html`.
- Se publica en **Cloudflare Workers (static assets)** al hacer push a `main` (`wrangler.jsonc`, `.assetsignore`).
- Dominios conectados al Worker `vorticevr-web`: `vorticevr.mx`, `www.vorticevr.mx`, `t.vorticevr.mx`.
- DNS en Cloudflare; el dominio está registrado en GoDaddy. Ya no se usa Wix.
- Rutas siempre relativas (funcionan en cualquier dominio o subdominio).
- `worker.js`: corre antes que los assets en todas las peticiones (`run_worker_first: true`). Responde `Range` (206) a los videos (el iPhone lo necesita), sirve las experiencias de la plataforma de RA y su API. Ver "Plataforma de RA".

## Estructura
| Ruta | Qué es |
|---|---|
| `/` | Página principal de Vórtice VR |
| `/tarjeta/` | Tarjeta digital de César (destino de sus tarjetas NFC) |
| `/johara/` | Portal de Johara De Leija, Directora General de OCV Tabasco (clienta) |
| `/ra/ocv-johara/` | RA sobre la tarjeta impresa de Johara |
| `/cuenta/`, `/crear/`, `/x/`, `/admin/` | Plataforma de RA (ver abajo) |
| `/proyectos/<nombre>/` | Experiencias de Vórtice VR que se abren desde la portada: `observatorio`, `orbita`, `deletreo-lsm`, `steal-a-pinata` (archivos de César, publicados tal cual; a `orbita` solo se le agregó el encabezado HTML) |
| `/assets/` | Logos e íconos compartidos |
| `/assets/proyectos/` | Imágenes de las tarjetas de la portada (capturas con Chrome headless; la del juego es su portada original) |
| `_clientes/`, `_plantillas/`, `tools/` | Fuentes para generar tarjetas de clientes (no se publican: `.assetsignore`) |

Las tarjetas NFC y QR de clientes apuntan a `https://vorticevr.mx/<cliente>/` (`t.vorticevr.mx` sigue funcionando como alias, pero no se usa en tarjetas nuevas: un subdominio nuevo puede tardar en reconocerse en algunas redes). **Nunca cambiar ni borrar una ruta ya impresa en tarjetas.**

## Reglas
- Páginas de clientes: `<meta name="robots" content="noindex">` y sin enlaces desde la página principal, salvo que César diga que el cliente autorizó mostrarlo.
- Logo de Vórtice VR: solo en su morado original o en blanco; no recolorearlo (los efectos alrededor sí pueden ser de otro color).
- No inventar proyectos ni datos de clientes en la página principal: solo lo que César haya confirmado.
- Commits con autor `Claude <noreply@anthropic.com>`.

## Portada (`/index.html`)
- Estética de los propios proyectos: fondo `#05020b`, morados `#8b3fd6`/`#d2b8ff`, dorado `#ffbe55`; Chakra Petch + IBM Plex Sans/Mono.
- Hero: three.js 0.160 (import map). ~14k partículas (8k en celular) giran en un vórtice y forman el isotipo, muestreado de `assets/icono.png` con su morado original (`#6b279b`); un tercio sigue orbitando. El cursor las empuja, un clic las dispersa y el scroll las devuelve al vórtice. Solo renderiza con el hero visible. Si no hay WebGL se muestra `icono.png`.
- Efectos sin librerías: revelado al hacer scroll, inclinación de tarjetas, botones magnéticos, cursor propio (solo mouse). Con "reducir movimiento" todo queda quieto.
- Sección `#crea` (justo después del hero, antes de Experiencias): "Haz que tus imágenes cobren vida". Sin la palabra "RA" ni "realidad aumentada" (mucha gente no la entiende): se habla de imagen, video y cámara. Prioridad: que la gente abra la cámara y lo pruebe. Animación de un celular que muestra la imagen con el video encima, pasos, usos, planes (Gratis, Básico, Pro; escuelas por WhatsApp).
- Demo "Pruébalo ya": si existe la experiencia `ejemplo` (de César, plan Pro), su imagen se muestra en la sección; en computadora sale un QR para escanearla y en celular el botón "Abrir la cámara". Si no existe, solo queda la animación. `ejemplo` es un nombre que solo un admin puede usar (`ADMIN_SLUGS`). Cada visita a la portada le suma una vista.
- La sección Nosotros solo usa datos confirmados (desde 2016, Villahermosa, director, áreas); César la va a completar.

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
2. Preview en internet: commit y push a la rama `preview`. Cloudflare sube una versión de prueba (no toca producción) en **https://preview-vorticevr-web.lad-cesargarcia.workers.dev/** (patrón `<rama>-vorticevr-web.lad-cesargarcia.workers.dev`; Cloudflare le pone `X-Robots-Tag: noindex`). Requiere el bloque `"previews": {}` en `wrangler.jsonc`.
3. Cuando César apruebe: `git switch main && git merge --ff-only preview && git push` (eso publica). Subir `main` y `preview` en pushes separados, no al mismo tiempo.

## Plataforma de RA (`/cuenta/` y `/crear/`)
Cualquiera crea una cuenta y experiencias (imagen + video + botones) y obtiene `https://<nombre>.vorticevr.mx/` y un QR.
- **Planes** (`PLANS` en `worker.js`): Gratis 1 experiencia, 30 días · Básico $199/mes 5 exp. · Pro $499/mes 50 exp. · Escuela $1,500/mes 1000 exp. (se vende por fuera, no aparece en la página; pago anual con descuento por definir). Los pagados: experiencias sin vencimiento mientras el plan esté vigente. Video sin límite de duración, solo de peso: 25 MB Gratis y Básico, 50 MB Pro y Escuela (no subir de 50 MB: el Worker lee el video completo en memoria).
- Gratis y Básico (`brand: true`): el visor abre con la pantalla "Experiencia creada con Vórtice VR" y botón Continuar. Pro y Escuela: sin esa pantalla, sin el logo de arriba ni "Hecho con Vórtice VR". `/api/exp/<slug>` manda `brand` según el plan del dueño.
- `users.plan`, `plan_until` (pagado hasta; null = sin fecha), `plan_note`. `experiences.paused`; una experiencia con plan pagado tiene `expires` = año 9999 (`FAR`).
- Cambiar de plan (`applyPlan`, una sola consulta): quedan activas las N más recientes; las demás se pausan (el visor dice "pausada") y se borran a los 30 días si no sube de plan. El cron diario regresa a Gratis las cuentas con `plan_until` vencido.
- **`/admin/`**: solo `ADMIN_EMAILS` (por defecto `lad.cesargarcia@gmail.com`; se puede cambiar con la variable). Busca cuentas, ve sus experiencias, cambia plan con "pagado hasta" y nota, y opcionalmente avisa por correo. Así se activan escuelas y, mientras no haya Stripe, Básico/Pro (el botón "Lo quiero" del dashboard abre WhatsApp).
- Stripe (decidido, por construir): Checkout + Customer Portal + webhook para Básico y Pro; Escuela sigue manual.
- La tabla `experiences` tenía `email UNIQUE` (1 por cuenta): `migrate()` la copia a una tabla sin esa restricción. Producción y preview comparten la D1: todo cambio de esquema debe dejar funcionando la otra versión.
- `/cuenta/`: registro (nombre, correo, contraseña) → código de 6 dígitos al correo **una sola vez** para confirmar → sesión de 30 días. Iniciar sesión con correo y contraseña; "Olvidé mi contraseña" con código. Dashboard: experiencias con imagen, link, QR descargable, vistas, días restantes, Editar (`/crear/?editar=<slug>`), Borrar; cambiar contraseña; cerrar sesión. `?siguiente=crear` regresa al creador después de entrar; `?publicada=<slug>` muestra el aviso de publicada.
- `/crear/`: requiere sesión (si no, manda a `/cuenta/`). Reduce la imagen a 1000 px, compila el `.mind` en el navegador, vista previa con ajuste al ancho / al alto / toda la imagen, redes con solo el usuario (o @usuario o link pegado; WhatsApp de 10 dígitos agrega 52). Al publicar regresa al dashboard.
- `assets/plataforma.js`: sesión (`localStorage` `vvr-sesion`), llamadas a la API y el QR con el isotipo (qrcode-generator).
- `/x/`: pantalla inicial sin tecnicismos ("Esta imagen tiene un video", 3 pasos numerados, botón "Abrir la cámara"). Visor genérico (video sobre la imagen, a pantalla si se pierde, pantalla completa, sonido, foto/video, redes, logo arriba, marca de agua). El import map necesita `three/addons/` porque MindAR importa `CSS3DRenderer`; las librerías se cargan al tocar "Activar cámara" para que el título y la imagen salgan aunque tarden.
- `worker.js`: `nombre.vorticevr.mx` y `/e/nombre/` → visor. API: `register`, `verify`, `login`, `forgot`, `reset`, `logout`, `me`, `password`, `slug`, `publish`, `experience/<slug>` (DELETE), `exp/<slug>` (público). Contraseñas PBKDF2-SHA256 de 16,000 iteraciones (≈8 ms; el plan gratis permite ~10 ms de CPU; se guarda el número con cada hash para subirlo en un plan de pago). Sesiones: token aleatorio, en D1 solo su hash. Tablas: `users`, `sessions`, `otp`, `experiences` (dueño por correo), `ratelimit`. Cron diario borra experiencias vencidas, sesiones y códigos viejos y cuentas sin confirmar de más de 7 días.
- Cloudflare: D1 `vorticevr-ar` (DB) y R2 `vorticevr-ar` (MEDIA) declarados arriba y también dentro de `previews` (las previews no heredan bindings). Secretos `SESSION_SECRET` y `RESEND_API_KEY` (correo desde `ra@vorticevr.mx`, dominio verificado en Resend) en Production **y en la preview** (los de "Previews Base" solo aplican a previews nuevas). DNS comodín `*` AAAA `100::` proxied y ruta `*.vorticevr.mx/*`.
- Pruebas locales: copiar el sitio a una carpeta temporal con los assets en `public/` (si no, `wrangler dev` se reinicia en bucle), `vars` `ROOT_DOMAIN=localhost`, `DEV_CODES=1` (el código sale en la respuesta, nunca en producción) y `SESSION_SECRET`.

## Siguiente etapa (acordado con César, octubre 2026)
- **Respuestas siempre en español**, aunque César escriba en inglés.
- **Multi-tenant**: todas las escuelas en el mismo Worker, D1 y R2. Cada escuela = organización (nombre, logo, colores, admins, maestros, alumnos, límites). Se identifica por subdominio (`escuela.vorticevr.mx`) o dominio propio (Cloudflare for SaaS). Todos los datos y consultas llevan la organización; videos en R2 bajo `org/<org>/...`. Pruebas automáticas de aislamiento entre escuelas. Respaldos (D1 Time Travel 30 días + respaldo propio).
- **Planes**: ver "Plataforma de RA" (Gratis, Básico $199, Pro $499 y Escuela $1,500 por fuera). Falta confirmar si los precios incluyen IVA.
- **Por construir**: cobros con Stripe para Básico y Pro; cuentas de maestros dentro del plan Escuela (organizaciones); marca blanca y dominio propio; compresión de video en el navegador antes de subir; aviso de privacidad y términos (datos de menores); facturación CFDI.
- **Al empezar a cobrar**: pasar a Workers de pago (5 USD/mes) y subir `PBKDF2_ITER` (las contraseñas guardadas siguen funcionando). Costos estimados: 5–30 USD/mes para ~10 escuelas (R2 0.015 USD/GB después de 10 GB, tráfico gratis; Resend Pro 20 USD/mes si pasan de 100 correos/día).
- **Pendientes de César**: confirmar que llegan los códigos por correo en producción; decidir si cambiar Villahermosa en el Observatorio; si "CEO" está bien en inglés; si se traducen los proyectos; probar la grabación de video de la RA en iPhone.
