# Propuesta: Destellos ✦, planes nuevos, apoyos y comentarios

Platicado con César el 4 y 5 de noviembre de 2026. **En pausa** ("es muy tardado y hay que descansar"): no se ha construido nada. Lo que sigue es la propuesta tal como quedó, con sus decisiones pendientes.

## La idea de César
- Una moneda virtual que la gente compra y **dona a las experiencias que más le gustan** (filtros, juegos, libros, galerías), con **una súper animación** al apoyar. Donar dinero directo "se ve feo".
- Vórtice VR se queda con el **20 %** de todo lo que entre.
- Que también sirva para **activar una experiencia por un mes**, como recargas en lugar de mensualidad.
- **Para recibir apoyos hay que tener un plan activo.**
- Cambiar los planes a **Gratis, Creador y Empresarial**, y que Gratis regale destellos para tener una experiencia un mes.
- **Comentarios** en cada experiencia, solo con sesión iniciada.
- **Juegos** como sección propia del sitio (ver "Estructura del sitio").

## Destellos ✦
- Nombre propio de Vórtice VR (no "gemas" ni "diamantes"); encaja con los destellos de la magia del sitio.
- **1 ✦ = $1 MXN.** Paquetes: 50 ✦ $50 · 100 ✦ $100 (+5) · 250 ✦ $250 (+15) · 500 ✦ $500 (+40). Mínimo $50 (Stripe cobra ~$3 fijos por pago). Los regalos de los paquetes salen del 20 % de Vórtice VR, por eso son chicos.
- No se reembolsan, quien compra nunca los cambia por dinero, no vencen, solo los compran adultos (con límite al mes).
- Se pagan con Stripe Checkout (pago único, MXN, IVA incluido), con **OXXO y SPEI** prendidos para quien no tiene tarjeta. Reembolso (`charge.refunded`) = se quitan del saldo.
- Usos: (1) activar una experiencia 30 días, (2) apoyar a un creador, (3) más adelante, gastarlos en juegos.

## Recargas en lugar de mensualidad
- **Activar una experiencia 30 días = 49 ✦** (pendiente de decidir: 39, 49 o 99). Activa = no vence y sin tope de 1,000 vistas.
- Se renueva otro mes con destellos, sin suscripción. Con 10 o más experiencias conviene el plan Creador.
- Lo que se gasta en activaciones es 100 % de Vórtice VR.

## Planes
| | Gratis | Creador ($499/mes) | Empresarial ($1,499/mes) |
|---|---|---|---|
| Experiencias | 3 de prueba, 15 días | 100 | Ilimitadas |
| Regalo | 50 ✦ de bienvenida | 50 ✦ al mes | 150 ✦ al mes |
| Recibir apoyos | No | Sí | Sí |
| Vender libros y cursos | No | Sí | Sí |
| Galería 3D | No | 1 sala | 5 salas |
| Logo propio o sin logo | No | No | Sí |

- Por dentro se conservan los ids `pro` y `premium` (nadie que ya paga pierde nada); solo cambian los nombres en pantalla y en Stripe.
- **Ojo:** `empresarial` ya es un plan `legacy` (equipos) en `PLANS`; pasaría a llamarse "Equipo (anterior)".

## Apoyos con destellos
- Botón **"✦ Apoyar"** en las experiencias públicas (montos rápidos 10, 25, 50, 100), con una animación grande de destellos; la experiencia muestra cuántos destellos ha recibido junto a los corazones.
- Solo si el creador tiene plan activo. Cada ✦ = $0.80 para el creador y $0.20 para Vórtice VR.
- **Antes de encenderlo**: (1) preguntar a Stripe por escrito, porque sus reglas restringen monedas virtuales que se pueden convertir en dinero (el creador cambia lo recibido por pesos); o usar **Stripe Connect** para pagar a los creadores (es lo correcto para plataformas que pagan a terceros y también resolvería los cortes de libros y cursos). (2) Revisar con el contador el régimen de **plataformas digitales** del SAT (Vórtice VR retiene ISR e IVA y así se puede pagar a creadores que no facturan).
- Nunca gemas a cambio de una oportunidad de ganar un premio (sería un sorteo regulado por Gobernación).

## Mis ganancias
Una pantalla en Mi cuenta con todo lo que deja dinero: apoyos recibidos, ventas de libros y cursos, comisiones de recomendados y de vendedor. Disponible, pendiente (30 días) y pagado; movimientos; cobro a la CLABE desde $500 con los cortes quincenales de siempre. Hoy eso está repartido en `/cursos/ventas/`, Recomienda y gana y `/vendedor/`.

## Comentarios
- Solo con sesión; en el póster grande de Explora, en el portal y al final de cada juego, libro o galería.
- Un comentario puede ir con destellos (sale destacado en dorado).
- Moderación: el creador borra comentarios o los apaga en su experiencia, botón Reportar, el admin los quita, límite por hora y filtro de groserías (hay escuelas y menores).

## Estructura del sitio (acordada "ándale, tal vez")
Explora (todo) · **Juegos** (de Vórtice VR y de la comunidad: Dispara, Memorama, Sopa, Rompecabezas, Trivia, Ruleta; con filtro "Educativos", ahí se mudan Piñata Tabasco, Tierra Lila, Observatorio, Deletreo LSM) · Biblioteca · Galerías · **Aprende ▾** (cursos, talleres, tutoriales, manual; reemplaza a Educación, conservando `/educacion/`) · Crear · Mi cuenta. Lo que creas aparece en la sección que le toca; el catálogo de Crear se agrupa igual.

## Orden propuesto
1. Planes renombrados + Gratis con 50 ✦ de regalo.
2. Destellos: compra, saldo y activar una experiencia 30 días.
3. Apoyos + Mis ganancias (después de Stripe y el contador).
4. Comentarios.

## Decisiones pendientes de César
1. Precio de activar una experiencia un mes (39, 49 o 99 ✦).
2. Destellos de regalo: 50 al registrarse, 50/mes Creador, 150/mes Empresarial.
3. Confirmar los nombres Creador y Empresarial con los precios de hoy.
