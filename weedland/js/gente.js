// La gente de la hacienda: quién es cada visitante (nombre, país, a qué vino), qué platica y con qué voz.
// Las voces son las del navegador (speechSynthesis): cambian según el equipo. Se busca una voz de mujer (o de hombre) del país
// de cada persona; si no hay, una del mismo idioma, y el tono cambia un poco para que no suenen iguales.

// Alternan español e inglés para que también en celular (8 visitantes) haya de los dos.
export const PERFILES = [
  { nombre: "Valeria", pais: "México", bandera: "🇲🇽", lang: "es-MX", tono: 1.12, papel: { es: "Tengo una tienda de accesorios en Guadalajara y vine a buscar marcas nuevas.", en: "" } },
  { nombre: "Emma", pais: "Estados Unidos", bandera: "🇺🇸", lang: "en-US", tono: 1.08, papel: { en: "I'm a buyer for a chain of wellness stores in Denver.", es: "Soy compradora de una cadena de tiendas wellness en Denver." } },
  { nombre: "Camila", pais: "Colombia", bandera: "🇨🇴", lang: "es-CO", tono: 1.18, papel: { es: "Soy diseñadora textil; trabajo con fibra de cáñamo en Medellín.", en: "" } },
  { nombre: "Olivia", pais: "Reino Unido", bandera: "🇬🇧", lang: "en-GB", tono: 1.05, papel: { en: "I write about design and sustainable materials for a magazine in London.", es: "Escribo de diseño y materiales sustentables para una revista en Londres." } },
  { nombre: "Lucía", pais: "España", bandera: "🇪🇸", lang: "es-ES", tono: 1.1, papel: { es: "Soy arquitecta y me interesan los bloques de cáñamo para construir.", en: "" } },
  { nombre: "Chloe", pais: "Canadá", bandera: "🇨🇦", lang: "en-CA", tono: 1.2, papel: { en: "I study agronomy in Manitoba, where they grow a lot of hemp.", es: "Estudio agronomía en Manitoba, donde se siembra mucho cáñamo." } },
  { nombre: "Martina", pais: "Argentina", bandera: "🇦🇷", lang: "es-AR", tono: 1.15, papel: { es: "Soy fotógrafa y vine a retratar la expo, che.", en: "" } },
  { nombre: "Mia", pais: "Australia", bandera: "🇦🇺", lang: "en-AU", tono: 1.12, papel: { en: "I run a small shop of hemp bags and clothes in Melbourne.", es: "Tengo una tiendita de bolsas y ropa de cáñamo en Melbourne." } },
  { nombre: "Fernanda", pais: "Chile", bandera: "🇨🇱", lang: "es-CL", tono: 1.22, papel: { es: "Hago cosmética natural en Valparaíso y busco proveedores.", en: "" } },
  { nombre: "Aoife", pais: "Irlanda", bandera: "🇮🇪", lang: "en-IE", tono: 1.1, papel: { en: "I'm a chef; I came for the seed workshops in the Market.", es: "Soy chef; vine a los talleres de semilla del Mercado." } },
  { nombre: "Ximena", pais: "Perú", bandera: "🇵🇪", lang: "es-PE", tono: 1.16, papel: { es: "Soy ingeniera agrónoma y estudio suelos en Arequipa.", en: "" } },
  { nombre: "Priya", pais: "India", bandera: "🇮🇳", lang: "en-IN", tono: 1.14, papel: { en: "My family makes rope and fabric; hemp is an old tradition back home.", es: "Mi familia hace cuerdas y telas; el cáñamo es una tradición antigua allá." } },
  { nombre: "Daniela", pais: "Uruguay", bandera: "🇺🇾", lang: "es-UY", tono: 1.1, papel: { es: "Trabajo en una cooperativa de productores y vengo a hacer contactos.", en: "" } },
  { nombre: "Zara", pais: "Sudáfrica", bandera: "🇿🇦", lang: "en-ZA", tono: 1.06, papel: { en: "I organize trade fairs in Cape Town and I'm taking notes.", es: "Organizo ferias en Ciudad del Cabo y vengo tomando notas." } },
  { nombre: "Sofía", pais: "Costa Rica", bandera: "🇨🇷", lang: "es-CR", tono: 1.2, papel: { es: "Soy guía de turismo y me encantó el paseo en globo, ¡pura vida!", en: "" } },
  { nombre: "Grace", pais: "Nueva Zelanda", bandera: "🇳🇿", lang: "en-NZ", tono: 1.16, papel: { en: "I'm an interior designer looking for natural fabrics.", es: "Soy diseñadora de interiores y busco telas naturales." } },
];
PERFILES.forEach((p) => (p.genero = "mujer"));
export const HOMBRES = [
  { nombre: "Diego", pais: "México", bandera: "🇲🇽", lang: "es-MX", tono: 0.95, papel: { es: "Soy de Oaxaca; vendo bolsas tejidas con fibra de cáñamo.", en: "" } },
  { nombre: "Jack", pais: "Estados Unidos", bandera: "🇺🇸", lang: "en-US", tono: 0.92, papel: { en: "I run a grow-light company in Oregon.", es: "Tengo una empresa de lámparas de cultivo en Oregon." } },
  { nombre: "Andrés", pais: "Colombia", bandera: "🇨🇴", lang: "es-CO", tono: 0.97, papel: { es: "Soy ingeniero y diseño sistemas de riego por goteo.", en: "" } },
  { nombre: "Oliver", pais: "Reino Unido", bandera: "🇬🇧", lang: "en-GB", tono: 0.9, papel: { en: "I make furniture from hemp-based boards in Bristol.", es: "Hago muebles con tableros de cáñamo en Bristol." } },
  { nombre: "Pablo", pais: "España", bandera: "🇪🇸", lang: "es-ES", tono: 0.94, papel: { es: "Tengo un banco de semillas registrado en Valencia.", en: "" } },
  { nombre: "Liam", pais: "Canadá", bandera: "🇨🇦", lang: "en-CA", tono: 0.96, papel: { en: "I'm a hemp farmer from Saskatchewan.", es: "Soy agricultor de cáñamo en Saskatchewan." } },
  { nombre: "Tomás", pais: "Argentina", bandera: "🇦🇷", lang: "es-AR", tono: 0.93, papel: { es: "Soy diseñador de vidrio artesanal en Córdoba.", en: "" } },
  { nombre: "Noah", pais: "Australia", bandera: "🇦🇺", lang: "en-AU", tono: 0.95, papel: { en: "I import natural textiles to Sydney.", es: "Importo textiles naturales a Sídney." } },
];
HOMBRES.forEach((p) => (p.genero = "hombre"));
// El perfil número n de ese género (se reparten en orden para que no se repitan)
export const perfilDe = (genero, n) => { const l = genero === "hombre" ? HOMBRES : PERFILES; return l[n % l.length]; };


export const habla = (p) => (p.lang.startsWith("en") ? "en" : "es");

// Lo que dice según lo que está haciendo y lo que hay en la hacienda. {marca} se cambia por una marca real del demo.
const TEMAS = {
  saludo: [
    { es: "{apodo}Soy {nombre}, de {pais}.", en: "{apodo}I'm {nombre}, from {pais}." },
  ],
  baile: [
    { es: "¡Qué buena música en el patio! Aquí nos juntamos a bailar entre stand y stand.", en: "The music in the courtyard is great! We meet here to dance between booths." },
    { es: "Si te quedas quieto y bailas, la gente de alrededor se une. ¡Pruébalo!", en: "If you stand still and dance, people around you join in. Try it!" },
  ],
  pareja: [
    { es: "Venimos juntas recorriendo los claustros; vamos comparando catálogos.", en: "We're walking the cloisters together, comparing catalogs." },
    { es: "Ya llevamos varios sellos en el pasaporte. ¿Tú cuántos llevas?", en: "We already have a few stamps in our passport. How many do you have?" },
  ],
  solo: [
    { es: "Estoy viendo stand por stand; los anfitriones te explican todo.", en: "I'm going booth by booth; the hosts explain everything." },
  ],
  general: [
    { es: "¿Ya pasaste por {marca}? Su catálogo está muy completo.", en: "Have you been to {marca}? Their catalog is really complete." },
    { es: "En el Mercado y botica hay talleres que enseñan cómo se hace la cuerda y la tela de cáñamo.", en: "At the Market there are workshops that show how hemp rope and fabric are made." },
    { es: "Subí al globo y termina bajando a un cenote. ¡No te lo pierdas!", en: "I took the balloon ride, and it ends down in a cenote. Don't miss it!" },
    { es: "Cada marca tiene un juego diario: ruleta, trivia o rasca. Ahí se ganan estrellas.", en: "Every brand has a daily game: wheel, trivia or scratch card. That's how you earn stars." },
    { es: "En Mi cultivo las parcelas crecen mientras recorres la expo. Los videos lo adelantan.", en: "In My Garden the plots grow while you walk around. The videos speed them up." },
    { es: "Me encanta que todo sea de marcas legales y con la información clara.", en: "I love that everything here is from legal brands, with clear information." },
    { es: "Las estrellas se cambian por cupones y boletos de sorteo en Premios.", en: "You can trade your stars for coupons and raffle tickets in Prizes." },
  ],
  adios: [
    { es: "¡Un gusto! Nos vemos en el patio.", en: "Nice to meet you! See you in the courtyard." },
    { es: "¡Disfruta la hacienda!", en: "Enjoy the hacienda!" },
  ],
};

// Arma la plática con una persona: saludo + a qué vino + lo que está haciendo + temas al azar. Cada línea en su idioma y en español.
export function platica(p, rol, marcas = [], apodo = "") {
  const idioma = habla(p), azar = (l) => l[Math.floor(Math.random() * l.length)];
  const llenar = (t) => {
    const marca = marcas.length ? azar(marcas) : "Valle Verde Seeds";
    const f = (s, en) => s.replace("{apodo}", apodo ? (en ? "Hi, " : "¡Hola, ") + apodo + "! " : en ? "Hi! " : "¡Hola! ").replace("{nombre}", p.nombre).replace("{pais}", en ? PAIS_EN[p.pais] || p.pais : p.pais).replace("{marca}", marca);
    return { dice: f(t[idioma], idioma === "en"), es: f(t.es, false) };
  };
  const propio = rol === "baile" ? TEMAS.baile : rol === "guia" || rol === "sigue" ? TEMAS.pareja : TEMAS.solo;
  const generales = [...TEMAS.general].sort(() => Math.random() - 0.5).slice(0, 3);
  return [
    llenar(TEMAS.saludo[0]),
    { dice: p.papel[idioma], es: p.papel.es },
    llenar(azar(propio)),
    ...generales.map(llenar),
    llenar(azar(TEMAS.adios)),
  ];
}
const PAIS_EN = { "México": "Mexico", "España": "Spain", "Perú": "Peru", "Reino Unido": "the UK", "Estados Unidos": "the US", "Canadá": "Canada", "Sudáfrica": "South Africa", "Nueva Zelanda": "New Zealand", "Irlanda": "Ireland" };

// ---------- voces ----------
const MUJER = /female|mujer|woman|zira|sabina|helena|laura|paulina|m[oó]nica|elvira|dalia|salom[eé]|elena|camila|valentina|luc[ií]a|sonia|libby|hazel|susan|aria|jenny|natasha|clara|emily|neerja|heera|leah|molly|catherine|samantha|karen|moira|tessa|veena|fiona|serena|paloma|ximena|catalina|elsa|abril|irene|sof[ií]a|ana\b|isabel|luciana|renata|beatriz|yolanda|ver[oó]nica|emma|ava|sonia|maisie|imani|leni|luna|nora|michelle|ana /i;
const HOMBRE = /\bmale\b|hombre|david|pablo|ra[uú]l|jorge|diego|mark|george|james|guy|ryan|william|liam|prabhat|[aá]lvaro|gonzalo|tom[aá]s|carlos|juan|alex|daniel\b|fred|rishi|thomas|gerardo|emilio|federico|lorenzo|mateo|nicol[aá]s|sergio|andr[eé]s|christopher|eric|roger|brian|conrad|wayne|william|mitchell|connor|luke|ken\b/i;
let voces = [];
const cargar = () => { try { voces = speechSynthesis.getVoices(); } catch { voces = []; } };
if (typeof speechSynthesis !== "undefined") { cargar(); speechSynthesis.addEventListener?.("voiceschanged", cargar); }

export function vozDe(p) {
  if (!voces.length) cargar();
  const norm = (l) => (l || "").replace("_", "-").toLowerCase(), meta = p.lang.toLowerCase(), base = meta.slice(0, 2);
  // voz de mujer o de hombre según la persona
  const [SI, NO] = p.genero === "hombre" ? [HOMBRE, MUJER] : [MUJER, HOMBRE];
  const deMujer = (v) => SI.test(v.name) && !NO.test(v.name), noHombre = (v) => !NO.test(v.name);
  const delPais = voces.filter((v) => norm(v.lang) === meta), delIdioma = voces.filter((v) => norm(v.lang).startsWith(base));
  // para español de un país sin voz propia, mejor una latina que una de España (y viceversa)
  const latina = (v) => /-(mx|us|419|co|ar|cl|pe|uy|cr)$/.test(norm(v.lang));
  const cercanas = base === "es" ? delIdioma.filter((v) => (meta === "es-es") !== latina(v)) : delIdioma;
  const v = delPais.find(deMujer) || delPais.find(noHombre) || cercanas.find(deMujer) || delIdioma.find(deMujer) || cercanas.find(noHombre) || delIdioma.find(noHombre) || delIdioma[0] || null;
  return { voz: v, exacta: !!v && norm(v.lang) === meta };
}

// Dice un texto con la voz de esa persona. Si la voz no es de su país, el tono la distingue.
// Si el equipo no tiene ninguna voz en su idioma (p. ej. solo voces en español), dice la traducción (enEspanol) con voz en español.
export function decirComo(p, texto, alTerminar, enEspanol) {
  try {
    if (typeof speechSynthesis === "undefined") return alTerminar && alTerminar();
    speechSynthesis.cancel();
    let { voz, exacta } = vozDe(p);
    if ((!voz || !voz.lang.toLowerCase().startsWith(p.lang.slice(0, 2))) && enEspanol && habla(p) !== "es") {
      ({ voz } = vozDe({ ...p, lang: "es-MX" })); texto = enEspanol; exacta = false;
    }
    const u = new SpeechSynthesisUtterance(texto);
    if (voz) u.voice = voz;
    u.lang = voz ? voz.lang : p.lang;
    u.pitch = exacta ? 1.05 : p.tono; u.rate = habla(p) === "en" ? 1 : 1.02;
    if (alTerminar) u.onend = alTerminar;
    speechSynthesis.speak(u);
  } catch { alTerminar && alTerminar(); }
}
export function callar() { try { speechSynthesis.cancel(); } catch {} }
