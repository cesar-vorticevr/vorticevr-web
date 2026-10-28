// Curso de inducción para instructores (seed de la plataforma de cursos, PLATAFORMA-CURSOS.md §9).
// Gratis, de Vórtice VR, 5 módulos de lecciones de texto y un examen de 20 preguntas (80 para aprobar).
// Los ids son fijos: al cambiar el contenido, subir SEED_VERSION y se actualiza sin perder el avance de nadie.
export const SEED_VERSION = 1;
export const ONBOARDING_SLUG = "induccion-instructores";

export const COURSE = {
  id: "ind-curso", slug: ONBOARDING_SLUG,
  title: "Inducción para instructores",
  subtitle: "Todo lo que necesitas para crear, publicar y vender tus cursos con el aval de Vórtice VR",
  category: "Plataforma", level: "Básico", modality: "recorded", price_mxn: 0, duration_hours: 4, certificate_kind: "vortice",
  description_md: `Este es el primer paso para dar cursos en la plataforma de Vórtice VR. En unas cuatro horas de lectura conocerás cómo funciona el aval, qué necesitas para darte de alta, cómo responder la entrevista para que tu curso salga bien, cómo funcionan los exámenes y las constancias, y cómo vender.

Al aprobar el examen final recibes tu constancia y se habilita la creación de cursos (junto con tu perfil aprobado y la suscripción Premier activa).`,
  objectives_md: `- Explicar cómo funciona la plataforma y qué significa el aval de Vórtice VR.
- Completar correctamente el alta como instructor.
- Responder la entrevista guiada de forma que el material generado salga completo y útil.
- Elegir la modalidad adecuada (grabado, en vivo o mixto) y redactar la ficha del curso con los datos que pide la DC-3.
- Configurar el examen y entender cómo se emiten y verifican las constancias.
- Usar la página de venta, los cupones, el kit de marketing y las métricas para vender.`,
  target_audience_md: "Instructores, capacitadores, consultores y profesionistas que quieren vender cursos en línea o en vivo con el aval de Vórtice VR.",
  prerequisites_md: "Ninguno. Solo una cuenta en vorticevr.mx.",
};

const L = (id, title, minutes, body_md, is_preview = 0) => ({ id, title, kind: "text", duration_minutes: minutes, body_md: body_md.trim(), is_preview });

export const MODULES = [
  { id: "ind-m1", title: "Qué es la plataforma y cómo funciona el aval", description_md: "El producto, los tres roles, el modelo de negocio y qué respalda Vórtice VR.", lessons: [
    L("ind-m1-l1", "Bienvenida: qué es la plataforma de cursos", 15, `
## Un generador de cursos listos para vender

La plataforma de cursos de Vórtice VR convierte lo que sabes en un curso completo. Tú aportas el conocimiento y la experiencia; la plataforma se encarga de darle forma.

A partir de una **entrevista guiada** (una conversación por pasos, no un formulario largo) la plataforma genera:

- **El curso**: módulos, lecciones con guion y puntos clave.
- **El manual**: un documento que se lee solo, sin necesidad del video.
- **El examen**: preguntas que evalúan lo que el alumno debe poder hacer al terminar.
- **La constancia**: con folio, código QR y verificación pública.
- **La página de venta**: título, promesa, para quién es, temario, preguntas frecuentes.
- **El kit de marketing**: publicaciones para Instagram, Facebook, TikTok y LinkedIn, mensaje de WhatsApp, secuencia de correos y textos para anuncios.

Todo lo generado es un **borrador**: tú lo revisas, lo corriges a mano y puedes regenerar una pieza en particular si no te convence.

## Dónde se publica

Tus cursos aparecen en el catálogo de la plataforma, en **cursos.vorticevr.mx**, cada uno con su propia página de venta. Los alumnos compran ahí mismo con tarjeta y toman el curso desde su celular o su computadora.

> Este curso de inducción es el mismo tipo de curso que tú vas a crear: tiene módulos, lecciones, un examen final y una constancia. Fíjate en cómo se siente desde el lado del alumno.
`, 1),
    L("ind-m1-l2", "Los tres roles: alumno, instructor y Vórtice VR", 15, `
## Alumno

El alumno compra un curso, lo toma a su ritmo (o asiste a las sesiones en vivo), presenta el examen y, si lo aprueba, recibe su constancia. Desde **Mi aprendizaje** ve sus cursos, su avance, sus próximas sesiones y sus constancias.

## Instructor

Eres tú. Para crear cursos necesitas tres cosas:

1. **Perfil aprobado**: subes tus datos y documentos y Vórtice VR los revisa.
2. **Este curso de inducción aprobado**.
3. **Suscripción Premier activa**.

Con eso se habilita el botón **Crear curso**. Después puedes abrir ediciones en vivo, crear cupones, ver tus ventas y tus alumnos, y recibir tus pagos.

## Vórtice VR (administración)

Vórtice VR revisa los perfiles de instructor, revisa cada curso antes de publicarlo, emite y respalda las constancias, cobra a los alumnos y te paga tu parte cada quincena.

**Ningún curso se publica sin revisión.** Es lo que le da valor al aval: el alumno sabe que alguien revisó que el curso es serio.
`),
    L("ind-m1-l3", "El aval de Vórtice VR y el modelo de negocio", 20, `
## Qué significa el aval

Cada constancia que emite la plataforma lleva el respaldo de Vórtice VR:

- Un **folio único** con el formato \`VVR-AAAA-NNNNNN\` (año y número consecutivo).
- Un **código QR** que abre una página pública donde cualquiera puede comprobar que la constancia es auténtica y que sigue vigente.
- Los datos del curso: horas, modalidad, periodo, instructor y quién firma por Vórtice VR.

Vórtice VR trabaja en su registro como **Agente Capacitador Externo** ante la Secretaría del Trabajo y Previsión Social (STPS). Cuando el registro está vigente, su número aparece impreso en las constancias.

Para cursos de capacitación laboral, la constancia de la plataforma ya imprime los datos que pide el formato **DC-3**. La emisión en el formato oficial DC-3 y la lista DC-4 llegarán en una etapa posterior.

## Cómo ganas dinero

- **Vórtice VR cobra el 100 %** de cada venta al alumno.
- La plataforma se queda con una **comisión del 20 %**; **tú recibes el 80 %**.
- Cada **quincena** se hace un corte con tus ventas pagadas. Tú envías tu factura por el monto neto y Vórtice VR te transfiere.
- Pagas una **suscripción Premier mensual**, que mantiene activa tu cuenta de instructor y tus cursos a la venta.

**Ejemplo**: vendes 10 lugares de un curso de $1,000. Ventas: $10,000. Comisión (20 %): $2,000. Tu pago de esa quincena: **$8,000**, contra tu factura.

> Si un alumno pide reembolso, esa venta se descuenta y su constancia (si ya tenía) se revoca.
`),
  ] },
  { id: "ind-m2", title: "Tu perfil y tu alta como instructor", description_md: "Qué datos y documentos se piden, por qué, y qué pasa después.", lessons: [
    L("ind-m2-l1", "Tu perfil público", 15, `
## Lo que ve el alumno de ti

Tu perfil aparece en la página de venta de cada uno de tus cursos. Es lo que convence a alguien de que tú eres la persona indicada para enseñarle. Se compone de:

- **Foto**: de frente, bien iluminada, con fondo limpio. Nada de logotipos en lugar de tu cara.
- **Titular** (una línea): qué haces y para quién. Ejemplo: *"Contadora pública, 12 años llevando la contabilidad de pequeños negocios"*.
- **Biografía**: tres o cuatro párrafos cortos. Tu experiencia real, a quién has ayudado y con qué resultados. Sin exagerar.
- **Ciudad y estado**.

## Escribe en primera persona y con datos

Compara:

- Débil: *"Experto apasionado con amplia trayectoria."*
- Fuerte: *"He capacitado a más de 300 cocineros en manejo higiénico de alimentos en hoteles de Cancún y Mérida."*

La segunda dice qué haces, a quién y cuánto. Usa solo datos que puedas comprobar.
`),
    L("ind-m2-l2", "Datos fiscales y documentos", 20, `
## RFC y facturación

Como Vórtice VR te paga contra factura, **necesitas poder facturar** (estar dado de alta en el SAT con un régimen que te permita emitir CFDI por servicios). Es requisito para activar Premier. Si todavía no puedes facturar, el alta se detiene ahí y te avisamos qué te falta; puedes regresar cuando lo tengas.

## Documentos que se piden

Se guardan en un espacio **privado**: solo los ve el equipo de Vórtice VR para verificar tu perfil.

- **CV** actualizado.
- **Título o cédula profesional**, si aplica a tu tema.
- **Comprobantes de experiencia**: constancias laborales, cartas de clientes, certificaciones, fotos de cursos que hayas dado.
- **Identificación oficial** vigente.

No todos los temas exigen título: alguien que enseña repostería puede comprobar su experiencia con su trayectoria. Lo importante es que lo que dices en tu perfil se pueda respaldar.
`),
    L("ind-m2-l3", "Revisión, aprobación y Premier", 15, `
## La revisión

Al enviar tu perfil queda **pendiente**. El equipo de Vórtice VR lo revisa y te llega un correo con el resultado:

- **Aprobado**: sigues con este curso de inducción.
- **Rechazado**: el correo explica el motivo (por ejemplo, un documento ilegible o datos que no coinciden). Lo corriges y vuelves a enviarlo.

## La suscripción Premier

Cuando tu perfil está aprobado y aprobaste este curso, activas **Premier** con tarjeta. Es una suscripción mensual:

- Mientras está activa, puedes crear cursos y tus cursos se pueden comprar.
- Si un cobro falla, conservas el acceso **7 días** para actualizar tu tarjeta.
- Si no se resuelve, tus cursos dejan de venderse, pero **los alumnos que ya los compraron los siguen tomando**.

Puedes cancelar cuando quieras; la cancelación aplica al final del periodo pagado.
`),
  ] },
  { id: "ind-m3", title: "Armar un curso que se venda", description_md: "Modalidades, la entrevista guiada y la ficha del curso.", lessons: [
    L("ind-m3-l1", "Grabado, en vivo o mixto", 20, `
## Curso grabado

Lecciones en video (y texto) que el alumno toma a su ritmo. Lo grabas una vez y lo vendes muchas veces.

- **Conviene** para temas estables que no cambian cada mes y para alumnos con horarios difíciles.
- **El video** se enlaza desde Vimeo, YouTube (como video *no listado*) o Bunny Stream. Pegas la liga en cada lección y la plataforma lo incrusta.

## Curso en vivo

Sesiones en Zoom o Meet con fecha y hora. Se vende por **ediciones**: cada edición tiene fechas, horario, cupo y su liga de reunión.

- **Conviene** para temas donde la práctica y las preguntas en tiempo real importan, y para grupos de empresa.
- **La liga de la reunión es privada**: solo la ven los inscritos y solo desde 30 minutos antes de cada sesión. Así nadie la comparte por fuera.
- Al terminar una edición puedes guardar la grabación y convertirla en un curso grabado.

## Mixto

Lecciones grabadas más sesiones en vivo de práctica o dudas. Combina la escala del grabado con el acompañamiento del vivo.

## Cómo elegir

Pregúntate: *¿mi alumno necesita que yo lo vea practicar?* Si sí, en vivo o mixto. Si lo que necesita es entender y aplicar a su ritmo, grabado.
`),
    L("ind-m3-l2", "Cómo responder la entrevista para que el material salga bien", 30, `
## La entrevista guiada

Crear un curso empieza con una conversación de 10 pasos. En cada paso hay una pregunta, un ejemplo de buena respuesta y un espacio para la tuya. Se guarda en cada paso, así que puedes dejarla y regresar.

La regla de oro: **la plataforma solo usa lo que tú le das**. No inventa datos, cifras ni normas. Donde falta información deja un marcador visible \`[COMPLETAR: …]\` para que tú lo llenes. Entre más concreto respondas, menos marcadores te quedan.

## Los pasos, y cómo responder cada uno

1. **De qué trata, en una frase.** Ejemplo: *"Enseño a dueños de fondas a calcular el costo real de cada platillo."*
2. **Para quién es y qué problema tiene hoy.** Describe a una persona, no a "todo el mundo": *"Dueña de fonda, 45 años, vende bien pero no sabe por qué no le queda dinero."*
3. **Qué podrá hacer al terminar** (3 a 6 resultados). Usa verbos que se puedan comprobar: *calcular, elaborar, identificar, aplicar*. Evita *conocer* o *entender*. De aquí sale el examen.
4. **El temario**, como se lo explicarías a un amigo. Si tienes material (PDF, apuntes, presentaciones), súbelo: se usa como fuente.
5. **Los errores más comunes** de tus alumnos. Son oro: se convierten en advertencias en el curso y en preguntas del examen.
6. **Tus ejemplos, casos y anécdotas.** Es lo que hace que el curso suene a ti y no a un libro.
7. **Modalidad y duración.** Si es en vivo, las fechas de la primera edición.
8. **¿Es capacitación laboral?** Si sí, la clave interna del curso y los requisitos previos (ver la siguiente lección).
9. **Precio e identidad**: precio en pesos, foto, logo (opcional) y uno de los 6 estilos visuales.
10. **Resumen y "Generar mi curso"**.

## Después de generar

Revisas cada pieza (curso, manual, examen, página, kit). Puedes editar el texto a mano y **regenerar una sola pieza** sin tocar las demás, hasta el límite de regeneraciones del curso. Luego enlazas tus videos lección por lección y lo **envías a revisión**.
`),
    L("ind-m3-l3", "La ficha del curso y la DC-3", 25, `
## Por qué importa la ficha

Muchas empresas en México están obligadas a capacitar a su personal y a comprobarlo con el formato **DC-3** ("Constancia de competencias o de habilidades laborales"). Si tu curso es de capacitación laboral (seguridad, procesos, normatividad, atención a clientes, manejo de equipo), una ficha bien hecha lo vuelve mucho más fácil de vender a empresas.

## Qué datos del curso pide la DC-3

- **Nombre del curso**, claro y específico.
- **Duración en horas**.
- **Periodo de ejecución** (fecha de inicio y de fin).
- **Área temática** del curso.
- **Agente capacitador** que lo imparte y su número de registro ante la STPS.

La DC-3 también lleva datos del trabajador (nombre, CURP, ocupación, puesto) y de la empresa (razón social, RFC); esos los aporta cada alumno o su empresa.

## Lo que capturas desde el principio

Aunque la emisión en el formato oficial DC-3 llegará después, la plataforma te pide desde ya:

- **Objetivos**: qué podrá hacer el participante (en verbos medibles).
- **Temario** con su duración.
- **A quién va dirigido**.
- **Requisitos previos**.
- **Clave interna del curso** (tú la defines; por ejemplo \`SEG-ALT-01\`).

Con esos campos, la constancia de Vórtice VR ya imprime los datos de la DC-3, y cuando llegue el formato oficial no tendrás que volver a capturar nada.

> Elige **"constancia tipo DC-3"** solo si el curso de verdad es capacitación laboral. Para un curso de interés personal (por ejemplo, fotografía con el celular) basta la constancia Vórtice VR.
`),
  ] },
  { id: "ind-m4", title: "Exámenes y constancias", description_md: "Cómo se evalúa, cómo se emite la constancia y cómo se verifica.", lessons: [
    L("ind-m4-l1", "Cómo funciona el examen", 20, `
## Reglas generales

- El examen se habilita cuando el alumno **completó todas las lecciones**.
- Por defecto se aprueba con **80 de 100** y hay **3 intentos**. Puedes ajustar ambos, además de un límite de tiempo opcional y si las preguntas se barajan.
- **La calificación ocurre en el servidor.** Las respuestas correctas nunca llegan al navegador del alumno, así que no se pueden "ver" en el código de la página.
- Al terminar cada intento, el alumno ve en qué preguntas acertó y la retroalimentación de su respuesta. Las respuestas correctas se muestran completas cuando aprueba o se le acaban los intentos.

## Tipos de pregunta

- **Opción única**: una respuesta correcta.
- **Opción múltiple**: varias correctas; hay que marcar exactamente todas.
- **Verdadero o falso**.

## Cómo se ve una buena pregunta

El generador crea al menos 20 preguntas a partir de tus resultados de aprendizaje. Al revisarlas, cuida que:

- Evalúen **lo que el alumno debe poder hacer**, no detalles para memorizar. Mejor un caso ("Una fonda vende un platillo en $80 y sus ingredientes cuestan $38. ¿Qué falta para saber si gana?") que un dato ("¿En qué año se fundó…?").
- Cada respuesta incorrecta tenga **retroalimentación** que explique por qué no.
- No haya pistas obvias (la respuesta más larga siempre correcta, "todas las anteriores" en todas).
`),
    L("ind-m4-l2", "La constancia y su verificación", 15, `
## Cuándo se emite

En cuanto el alumno aprueba el examen, la plataforma:

1. Marca el curso como **completado**.
2. Genera la constancia en PDF con un **folio consecutivo** del año (\`VVR-2026-000123\`).
3. Le manda un correo con el PDF y la liga de verificación.

También la puede descargar cuando quiera desde **Mi aprendizaje**.

## Qué lleva

Logo de Vórtice VR, nombre del alumno, nombre del curso, horas, modalidad, periodo (las fechas de la edición o la fecha en que terminó), tu nombre como instructor, quién firma por Vórtice VR, el folio y un **código QR**.

## La verificación pública

El QR abre una página en \`cursos.vorticevr.mx/verificar/…\` donde cualquiera (un reclutador, una empresa, un cliente) ve sin iniciar sesión:

- Alumno, curso, fecha y folio.
- Si la constancia es **válida** o fue **revocada**.
- El PDF.

## Revocación

Vórtice VR puede revocar una constancia con un motivo (por ejemplo, si la compra se reembolsó o se detectó un fraude). La página de verificación lo muestra de inmediato.
`),
  ] },
  { id: "ind-m5", title: "Vender: página, cupones, kit y métricas", description_md: "Cómo convertir visitas en alumnos.", lessons: [
    L("ind-m5-l1", "La página de venta", 20, `
## Qué lleva

Cada curso tiene su página en \`cursos.vorticevr.mx/<nombre-del-curso>/\`, con el estilo visual que elegiste y "Avalado por Vórtice VR":

- **Título y promesa**: qué logra el alumno, sin exagerar.
- **Para quién es** (y para quién no): ayuda a que compre la persona correcta.
- **Lo que vas a poder hacer**: tus resultados de aprendizaje.
- **Temario** con módulos y lecciones.
- **Tu perfil** de instructor.
- **Preguntas frecuentes**.
- **Precio y botón de compra**. En cursos en vivo, las ediciones abiertas con fechas y lugares disponibles.

## Lecciones de muestra

Marca una o dos lecciones como **vista previa**: se pueden ver sin comprar. Es la mejor prueba de que tu curso vale la pena. Elige una que resuelva algo real y rápido.

## Promesas honestas

Evita "transforma tu vida", "garantizado" o "hazte rico". Además de que la revisión de Vórtice VR no las aprueba, generan reembolsos. Promete lo que el curso de verdad enseña.
`),
    L("ind-m5-l2", "Cupones y kit de marketing", 20, `
## Cupones

Crea códigos de descuento para un curso o para todos tus cursos:

- Por **porcentaje** (20 % menos) o por **monto** ($200 menos).
- Con **fecha de inicio y de fin** y un **máximo de usos**.
- El alumno lo escribe antes de pagar y la plataforma lo valida.

Úsalos con intención: preventa a tu comunidad, una fecha especial, un grupo de una empresa. Un descuento permanente le quita valor a tu precio.

> La comisión del 20 % se calcula sobre lo que el alumno pagó de verdad, después del descuento.

## Kit de marketing

Junto con el curso se genera un kit listo para publicar:

- 6 publicaciones para **Instagram** (texto e imagen con tu estilo visual).
- 4 publicaciones para **Facebook**.
- 3 guiones para **TikTok** (gancho, desarrollo y llamado a la acción).
- Una publicación para **LinkedIn**.
- Un mensaje para **WhatsApp**.
- Una secuencia de 3 **correos**.
- 3 textos para **anuncios**.

Revísalo y ajústalo a tu voz antes de publicar. Para cursos en vivo, cada edición nueva genera sus propias convocatorias y recordatorios con las fechas.
`),
    L("ind-m5-l3", "Tus métricas y tus pagos", 15, `
## Qué ves en tu panel

- **Ventas** por curso y por periodo, con lo que te corresponde (80 %).
- **Alumnos** inscritos, su avance y quiénes ya aprobaron.
- **Ediciones** en vivo con su cupo.
- **Generaciones** de contenido que te quedan en el mes.

## Cómo leerlas

- Muchas visitas y pocas ventas: revisa la promesa, el precio y la lección de muestra.
- Muchas ventas y poco avance: tus lecciones pueden ser muy largas; divide en partes de 5 a 12 minutos.
- Muchos reprobados en la misma pregunta: o la pregunta es confusa o ese tema necesita una mejor lección.

## Tus pagos

Cada quincena se genera un **corte** con tus ventas pagadas del periodo: bruto, comisión del 20 % y neto. Recibes un correo; envías tu factura por el neto, Vórtice VR la registra y te transfiere. El estado de cada corte (pendiente, factura recibida, pagado) y su referencia de pago quedan en tu panel.

¡Listo! Presenta el examen final para recibir tu constancia y habilitar la creación de cursos.
`),
  ] },
];

const q = (id, kind, prompt_md, opts, explanation_md) => ({ id, kind, prompt_md, explanation_md, options: opts.map(([text, correct, feedback], i) => ({ id: String.fromCharCode(97 + i), text, correct: !!correct, feedback })) });
export const EXAM = {
  id: "ind-examen", title: "Examen final de la inducción", passing_score: 80, max_attempts: 3, time_limit_minutes: null, shuffle: 1,
  questions: [
    q("ind-q01", "single", "¿Qué necesita un instructor para que se habilite el botón **Crear curso**?", [
      ["Perfil aprobado, este curso de inducción aprobado y Premier activa", 1, "Correcto: son los tres requisitos."],
      ["Solo pagar Premier", 0, "Premier sola no basta: también se necesita el perfil aprobado y la inducción."],
      ["Tener al menos un alumno inscrito", 0, "Los alumnos llegan después de publicar; no son requisito para crear."],
      ["Subir un video de presentación", 0, "El video de presentación es opcional y no habilita la creación."],
    ], "Los tres requisitos son perfil aprobado, inducción aprobada y Premier activa."),
    q("ind-q02", "single", "Vendes 5 lugares de un curso de $2,000 sin cupones. ¿Cuánto recibes en el corte de la quincena?", [
      ["$8,000", 1, "Correcto: $10,000 de ventas menos 20 % de comisión."],
      ["$10,000", 0, "Falta descontar la comisión del 20 %."],
      ["$2,000", 0, "Esa es la comisión de la plataforma, no tu parte."],
      ["$9,000", 0, "La comisión es del 20 %, no del 10 %."],
    ], "Recibes el 80 % de lo vendido: 0.8 × $10,000 = $8,000."),
    q("ind-q03", "truefalse", "Un curso puede publicarse sin que Vórtice VR lo revise si el instructor ya tiene Premier.", [
      ["Verdadero", 0, "Todo curso pasa por revisión antes de publicarse."],
      ["Falso", 1, "Correcto: ningún curso se publica sin revisión; eso respalda el aval."],
    ], "La revisión previa aplica a todos los cursos."),
    q("ind-q04", "single", "¿Por qué se pide al instructor que pueda facturar?", [
      ["Porque Vórtice VR le paga contra factura cada quincena", 1, "Correcto."],
      ["Para que pueda facturarle al alumno directamente", 0, "A los alumnos les cobra y factura Vórtice VR."],
      ["Para calcular su comisión", 0, "La comisión no depende de facturar."],
      ["Es opcional; solo sirve para descuentos", 0, "Es requisito para activar Premier."],
    ], "Los pagos al instructor se hacen contra su factura por el monto neto."),
    q("ind-q05", "multiple", "¿Qué datos del **curso** pide el formato DC-3? Marca todos los que apliquen.", [
      ["Nombre del curso", 1, "Sí, lo pide."],
      ["Duración en horas", 1, "Sí, lo pide."],
      ["Periodo de ejecución", 1, "Sí, lo pide."],
      ["Número de seguidores del instructor en redes", 0, "No tiene nada que ver con la DC-3."],
      ["Agente capacitador y su registro", 1, "Sí, lo pide."],
    ], "La DC-3 pide nombre, duración, periodo, área temática y agente capacitador, entre otros datos."),
    q("ind-q06", "single", "Al responder **qué podrá hacer el alumno al terminar**, ¿cuál es la mejor respuesta?", [
      ["Calcular el costo real de un platillo y fijar su precio de venta", 1, "Correcto: es concreto y se puede evaluar."],
      ["Conocer la importancia de los costos", 0, "\"Conocer la importancia\" no se puede comprobar en un examen."],
      ["Transformar su negocio para siempre", 0, "Es una promesa exagerada y no medible."],
      ["Entender muchos temas de finanzas", 0, "Es vago: no dice qué podrá hacer."],
    ], "Los resultados se escriben con verbos comprobables; de ellos sale el examen."),
    q("ind-q07", "single", "Si en tu entrevista no diste un dato que el curso necesita, ¿qué hace el generador?", [
      ["Deja un marcador [COMPLETAR: …] para que tú lo llenes", 1, "Correcto: nunca inventa datos."],
      ["Lo busca en internet y lo agrega", 0, "El generador solo usa lo que aportas tú y tu material."],
      ["Inventa un dato razonable", 0, "No inventa datos, cifras ni normas."],
      ["Cancela la generación", 0, "La generación sigue y marca lo que falta."],
    ], "Lo que falta queda marcado y visible para que lo completes."),
    q("ind-q08", "truefalse", "En un curso en vivo, la liga de Zoom o Meet se muestra en la página de venta para que los interesados la vean.", [
      ["Verdadero", 0, "La liga es privada."],
      ["Falso", 1, "Correcto: solo la ven los inscritos y solo desde 30 minutos antes de cada sesión."],
    ], "La liga de la reunión se entrega desde el servidor solo a inscritos y dentro de la ventana de tiempo."),
    q("ind-q09", "single", "¿Desde cuándo pueden los inscritos entrar a una sesión en vivo?", [
      ["Desde 30 minutos antes de cada sesión", 1, "Correcto."],
      ["Desde que compran", 0, "La liga no se muestra desde la compra."],
      ["Desde 24 horas antes", 0, "La ventana es de 30 minutos."],
      ["Solo a la hora exacta", 0, "Se habilita 30 minutos antes."],
    ], "El botón \"Entrar a la sesión\" se activa 30 minutos antes."),
    q("ind-q10", "single", "Tu tema es estable y tus alumnos tienen horarios muy distintos. ¿Qué modalidad conviene más?", [
      ["Grabado", 1, "Correcto: cada quien avanza a su ritmo y lo grabas una vez."],
      ["En vivo", 0, "Exige que todos coincidan en horario."],
      ["Ninguna; no se puede vender", 0, "Sí se puede: el grabado es ideal para esto."],
      ["En vivo con sesiones diarias", 0, "Agrava el problema de horarios."],
    ], "El grabado funciona para temas estables y alumnos con horarios distintos."),
    q("ind-q11", "single", "¿Dónde se pueden alojar los videos de un curso grabado en esta etapa?", [
      ["Vimeo, YouTube no listado o Bunny Stream, pegando la liga", 1, "Correcto."],
      ["Se suben directo a la plataforma como archivo", 0, "Por ahora se enlazan; la subida directa llegará después."],
      ["Solo en Google Drive", 0, "Drive no es una de las opciones."],
      ["Se mandan por WhatsApp a cada alumno", 0, "Los videos se ven dentro del reproductor del curso."],
    ], "Cada lección lleva la liga del video y la plataforma lo incrusta."),
    q("ind-q12", "truefalse", "Las respuestas correctas del examen llegan al navegador del alumno y se califican ahí.", [
      ["Verdadero", 0, "Eso permitiría hacer trampa."],
      ["Falso", 1, "Correcto: la calificación ocurre en el servidor."],
    ], "Las respuestas correctas nunca viajan al navegador durante el examen."),
    q("ind-q13", "single", "¿Cuál es la configuración del examen por defecto?", [
      ["80 para aprobar y 3 intentos", 1, "Correcto."],
      ["60 para aprobar e intentos ilimitados", 0, "No es la configuración por defecto."],
      ["100 para aprobar y 1 intento", 0, "No es la configuración por defecto."],
      ["70 para aprobar y 5 intentos", 0, "No es la configuración por defecto."],
    ], "Se aprueba con 80 y hay 3 intentos; el instructor puede ajustarlos."),
    q("ind-q14", "single", "¿Cuál pregunta de examen evalúa mejor un resultado de aprendizaje?", [
      ["Un caso: \"Un platillo se vende en $80 y sus ingredientes cuestan $38. ¿Qué falta para saber si deja ganancia?\"", 1, "Correcto: pide aplicar lo aprendido."],
      ["\"¿En qué año se publicó el libro que cita el instructor?\"", 0, "Es un dato de memoria, no una habilidad."],
      ["\"¿Cómo se llama el módulo 3?\"", 0, "No evalúa nada útil."],
      ["\"¿Te gustó el curso?\"", 0, "Es una encuesta, no una evaluación."],
    ], "Las preguntas deben evaluar lo que el alumno puede hacer, no detalles triviales."),
    q("ind-q15", "single", "¿Qué formato tiene el folio de una constancia?", [
      ["VVR-AAAA-NNNNNN", 1, "Correcto: año y número consecutivo."],
      ["Un número al azar de 4 dígitos", 0, "El folio es consecutivo por año."],
      ["El correo del alumno", 0, "El folio no lleva datos personales."],
      ["El nombre del curso", 0, "El folio es un código único."],
    ], "Ejemplo: VVR-2026-000123."),
    q("ind-q16", "multiple", "¿Qué puede ver cualquier persona en la página de verificación de una constancia? Marca todas.", [
      ["Alumno, curso, fecha y folio", 1, "Sí."],
      ["Si es válida o fue revocada", 1, "Sí."],
      ["El PDF de la constancia", 1, "Sí."],
      ["Las respuestas que dio el alumno en el examen", 0, "Eso es privado."],
    ], "La verificación es pública y sin iniciar sesión, pero no muestra el examen."),
    q("ind-q17", "single", "Un alumno pide reembolso de un curso que ya aprobó. ¿Qué pasa con su constancia?", [
      ["Se revoca, y la verificación lo muestra", 1, "Correcto."],
      ["Sigue válida para siempre", 0, "Un reembolso revoca la constancia."],
      ["Se borra el folio y se reutiliza", 0, "Los folios no se reutilizan."],
      ["El instructor decide si sigue válida", 0, "La revocación por reembolso es automática."],
    ], "El reembolso cancela la venta y revoca la constancia."),
    q("ind-q18", "single", "¿Para qué sirven las lecciones marcadas como **vista previa**?", [
      ["Se ven sin comprar y muestran la calidad del curso", 1, "Correcto."],
      ["Son lecciones que no cuentan para el avance", 0, "Sí cuentan; además se ven sin comprar."],
      ["Solo las ve el administrador", 0, "Las ve cualquier visitante."],
      ["Son lecciones que aún no terminas", 0, "No; son lecciones completas que regalas como muestra."],
    ], "Una buena lección de muestra convence más que cualquier promesa."),
    q("ind-q19", "truefalse", "La comisión del 20 % se calcula sobre lo que el alumno pagó después de aplicar un cupón.", [
      ["Verdadero", 1, "Correcto: sobre el monto realmente pagado."],
      ["Falso", 0, "Se calcula sobre lo que de verdad se pagó."],
    ], "Con cupón, tanto la comisión como tu parte salen del monto pagado."),
    q("ind-q20", "single", "Si un cobro de Premier falla, ¿qué pasa?", [
      ["Conservas el acceso 7 días; si no se resuelve, tus cursos dejan de venderse pero los inscritos siguen tomándolos", 1, "Correcto."],
      ["Se borran tus cursos de inmediato", 0, "No se borra nada."],
      ["Tus alumnos pierden el acceso", 0, "Los alumnos inscritos conservan su acceso."],
      ["No pasa nada nunca", 0, "Después de 7 días tus cursos dejan de venderse."],
    ], "Hay 7 días de gracia; los inscritos nunca pierden su curso."),
  ],
};
