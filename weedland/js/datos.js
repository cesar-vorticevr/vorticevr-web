// Datos del demo de Weedland. Todas las marcas son FICTICIAS (de ejemplo).
// Textos bilingües: { es, en }.

export const PAISES = [
  { id: "AR", es: "Argentina", en: "Argentina", edad: 18 },
  { id: "CL", es: "Chile", en: "Chile", edad: 18 },
  { id: "CO", es: "Colombia", en: "Colombia", edad: 18 },
  { id: "ES", es: "España", en: "Spain", edad: 18 },
  { id: "US", es: "Estados Unidos", en: "United States", edad: 21 },
  { id: "MX", es: "México", en: "Mexico", edad: 18 },
  { id: "UY", es: "Uruguay", en: "Uruguay", edad: 18 },
  { id: "XX", es: "Otro país", en: "Other country", edad: 21 },
];

export const ZONAS = {
  medicinal: { es: "Bosque Medicinal", en: "Healing Grove", color: "#c9a2ff", centro: { x: 40, y: 17 } },
  cultivo: { es: "Valle del Cultivo", en: "Grow Valley", color: "#9be36b", centro: { x: 63, y: 40 } },
  cultura: { es: "Barrio del Arte", en: "Art Quarter", color: "#ff9a76", centro: { x: 40, y: 63 } },
  fiesta: { es: "Feria de la Fiesta", en: "Festival Fair", color: "#ff7ad9", centro: { x: 17, y: 40 } },
};

export const PLANTILLAS = {
  hongo: { es: "Casa hongo", en: "Mushroom house" },
  torre: { es: "Torre", en: "Tower" },
  invernadero: { es: "Invernadero de cristal", en: "Glass greenhouse" },
  carpa: { es: "Carpa de feria", en: "Fair tent" },
  arbol: { es: "Casa del árbol", en: "Treehouse" },
  cabana: { es: "Cabaña", en: "Cottage" },
  cristal: { es: "Cristal mágico", en: "Magic crystal" },
};
const ESTILOS_ZONA = {
  medicinal: ["hongo", "cristal", "invernadero", "torre"],
  cultivo: ["invernadero", "cabana", "hongo", "arbol"],
  cultura: ["torre", "arbol", "cabana", "cristal"],
  fiesta: ["carpa", "torre", "cristal", "carpa"],
};
const COLORES_ZONA = {
  medicinal: ["#c9a2ff", "#a8e6ff", "#ffb3e6", "#b8f2d0", "#d6c2ff", "#9fd4ff"],
  cultivo: ["#9be36b", "#c6f36b", "#7fd1a8", "#ffd166", "#b6e36b", "#8fe3b0"],
  cultura: ["#ff9a76", "#ffcf6b", "#ff8fab", "#7fc8ff", "#e0a3ff", "#ffd8a8"],
  fiesta: ["#ff7ad9", "#f2c45a", "#6ff0ff", "#ff8a5c", "#b18cff", "#7dffb3"],
};

// ---------- objetos ----------
// tipo: material (cosecha), ingrediente (lo dan las marcas), mejora (efecto en el cultivo), producto (se fabrica), coleccion
export const OBJETOS = {
  fibra: { icono: "🧵", tipo: "material", rareza: "comun", vende: 2, es: "Fibra de cáñamo", en: "Hemp fiber", efecto: { es: "Para telas, cuerdas, papel y construcción", en: "For fabric, rope, paper and building" } },
  grano: { icono: "🌰", tipo: "material", rareza: "comun", vende: 3, es: "Semilla de cáñamo", en: "Hemp seed", efecto: { es: "Para aceite y cocina", en: "For oil and cooking" } },
  flor: { icono: "🌼", tipo: "material", rareza: "comun", vende: 4, es: "Flor de calma", en: "Calm flower", efecto: { es: "Para la botica del juego", en: "For the in-game apothecary" } },
  polvo_lumen: { icono: "✨", tipo: "material", rareza: "raro", vende: 10, es: "Polvo de Lumen", en: "Lumen dust", efecto: { es: "Material mágico", en: "Magic material" } },
  hilo: { icono: "🪡", tipo: "ingrediente", rareza: "comun", vende: 2, es: "Hilo dorado", en: "Golden thread", efecto: { es: "Para coser ropa", en: "For sewing clothes" } },
  cera: { icono: "🍯", tipo: "ingrediente", rareza: "comun", vende: 2, es: "Cera de abeja", en: "Beeswax", efecto: { es: "Para bálsamos", en: "For balms" } },
  frasco: { icono: "🫙", tipo: "ingrediente", rareza: "comun", vende: 2, es: "Frasco de vidrio", en: "Glass jar", efecto: { es: "Para tinturas y elixires", en: "For tinctures and elixirs" } },
  cal: { icono: "🪨", tipo: "ingrediente", rareza: "comun", vende: 2, es: "Cal", en: "Lime", efecto: { es: "Para bloques de construcción", en: "For building blocks" } },
  tinte: { icono: "🎨", tipo: "ingrediente", rareza: "comun", vende: 2, es: "Tinte natural", en: "Natural dye", efecto: { es: "Para teñir mochilas", en: "For dyeing backpacks" } },
  esencia: { icono: "💧", tipo: "ingrediente", rareza: "comun", vende: 2, es: "Esencia aromática", en: "Aromatic essence", efecto: { es: "Para tinturas", en: "For tinctures" } },
  lampara: { icono: "💡", tipo: "mejora", rareza: "raro", es: "Lámpara de cristal", en: "Crystal lamp", efecto: { es: "Tus plantas crecen 20% más rápido", en: "Your plants grow 20% faster" } },
  maceta: { icono: "🪴", tipo: "mejora", rareza: "comun", es: "Maceta mágica", en: "Magic pot", efecto: { es: "+1 material en cada cosecha", en: "+1 material per harvest" } },
  campanita: { icono: "🔔", tipo: "mejora", rareza: "raro", es: "Campanita guardiana", en: "Guardian bell", efecto: { es: "Te avisa y protege tus cosechas de los vecinos", en: "Guards your harvest from neighbors" } },
};

// ---------- cultivos ----------
export const SEMILLAS = {
  fibra: { icono: "🌿", es: "Cáñamo de fibra", en: "Fiber hemp", costo: 5, dur: 40, hojas: 8, da: { fibra: 3 }, color: "#4fc47e" },
  grano: { icono: "🌱", es: "Cáñamo de semilla", en: "Seed hemp", costo: 8, dur: 70, hojas: 12, da: { grano: 3 }, color: "#8fd46a" },
  flor: { icono: "🌼", es: "Flor de calma", en: "Calm flower", costo: 12, dur: 100, hojas: 15, da: { flor: 2 }, color: "#ffb3e6" },
  lumen: { icono: "🌸", es: "Flor Lumen", en: "Lumen flower", costo: 20, dur: 180, hojas: 25, lunas: 1, da: { polvo_lumen: 1 }, color: "#8ff7ff", requiere: "canamo", magia: true },
};

// ---------- recetas del Taller de transformación ----------
export const CATEGORIAS_RECETA = {
  textil: { icono: "👕", es: "Textiles", en: "Textiles" },
  construccion: { icono: "🧱", es: "Construcción", en: "Building" },
  cocina: { icono: "🍳", es: "Cocina", en: "Kitchen" },
  botica: { icono: "⚗️", es: "Botica", en: "Apothecary" },
  magia: { icono: "🔮", es: "Magia", en: "Magic" },
};
export const RECETAS = [
  { id: "cuerda", cat: "textil", icono: "🪢", es: "Cuerda de cáñamo", en: "Hemp rope", pide: { fibra: 2 }, vale: 16 },
  { id: "camiseta", cat: "textil", icono: "👕", es: "Camiseta de cáñamo", en: "Hemp tee", pide: { fibra: 3, hilo: 1 }, vale: 40, requiere: "canamo" },
  { id: "mochila", cat: "textil", icono: "🎒", es: "Mochila teñida", en: "Dyed backpack", pide: { fibra: 4, hilo: 1, tinte: 1 }, vale: 75, requiere: "canamo" },
  { id: "papel", cat: "construccion", icono: "📜", es: "Papel artesanal", en: "Handmade paper", pide: { fibra: 1, grano: 1 }, vale: 14 },
  { id: "bloque", cat: "construccion", icono: "🧱", es: "Bloque de cáñamo", en: "Hempcrete block", pide: { fibra: 3, cal: 1 }, vale: 48 },
  { id: "aceite", cat: "cocina", icono: "🫒", es: "Aceite de semilla", en: "Seed oil", pide: { grano: 3 }, vale: 26 },
  { id: "galletas", cat: "cocina", icono: "🍪", es: "Galletas de semilla", en: "Seed cookies", pide: { grano: 2, esencia: 1 }, vale: 30 },
  { id: "balsamo", cat: "botica", icono: "🧴", es: "Bálsamo herbal", en: "Herbal balm", pide: { flor: 2, cera: 1 }, vale: 55, requiere: "botica" },
  { id: "tintura", cat: "botica", icono: "🧪", es: "Tintura de flor", en: "Flower tincture", pide: { flor: 2, frasco: 1, esencia: 1 }, vale: 85, requiere: "botica" },
  { id: "elixir", cat: "magia", icono: "🔮", es: "Elixir Lumen", en: "Lumen elixir", pide: { polvo_lumen: 1, flor: 1, frasco: 1 }, vale: 0, lunas: 3 },
];
for (const r of RECETAS) {
  OBJETOS[r.id] = {
    icono: r.icono, tipo: "producto", rareza: r.cat === "magia" ? "raro" : "comun", vende: r.vale, es: r.es, en: r.en,
    efecto: r.cat === "botica" ? { es: "Objeto del juego, no es un medicamento real", en: "Game item, not a real medicine" } : { es: "Hecho en tu Taller", en: "Made in your Workshop" },
  };
}

// ---------- preguntas ----------
const q = (p, o, ok) => ({ p, o, ok });
const Q = {
  fibra: q({ es: "¿De qué parte del cáñamo se hacen las telas?", en: "Which part of hemp is used to make fabric?" },
    [{ es: "Del tallo (la fibra)", en: "The stalk (fiber)" }, { es: "De la raíz", en: "The root" }, { es: "De la flor", en: "The flower" }], 0),
  cbd: q({ es: "¿Qué compuesto de la planta NO produce efecto intoxicante?", en: "Which plant compound is NOT intoxicating?" },
    [{ es: "THC", en: "THC" }, { es: "CBD", en: "CBD" }, { es: "Los dos lo producen", en: "Both are" }], 1),
  manejar: q({ es: "Después de consumir cannabis, lo más seguro es…", en: "After using cannabis, the safest choice is…" },
    [{ es: "Manejar despacio", en: "Drive slowly" }, { es: "Tomar café y manejar", en: "Have coffee and drive" }, { es: "No manejar", en: "Don't drive" }], 2),
  alcohol: q({ es: "¿Qué combinación aumenta los riesgos?", en: "Which combination raises the risks?" },
    [{ es: "Cannabis y agua", en: "Cannabis and water" }, { es: "Cannabis y alcohol", en: "Cannabis and alcohol" }, { es: "Ninguna", en: "None" }], 1),
  edad: q({ es: "¿Hasta qué edad, más o menos, sigue desarrollándose el cerebro?", en: "Until roughly what age does the brain keep developing?" },
    [{ es: "12 años", en: "12" }, { es: "16 años", en: "16" }, { es: "Alrededor de 25 años", en: "Around 25" }], 2),
  agua: q({ es: "Comparado con el algodón, el cáñamo suele necesitar…", en: "Compared to cotton, hemp usually needs…" },
    [{ es: "Menos agua", en: "Less water" }, { es: "Mucha más agua", en: "Much more water" }, { es: "Exactamente lo mismo", en: "Exactly the same" }], 0),
  medicamentos: q({ es: "Si tomas medicamentos y quieres usar productos con CBD, lo correcto es…", en: "If you take medication and want to use CBD products, you should…" },
    [{ es: "Consultar a un profesional de salud", en: "Ask a health professional" }, { es: "No hacer nada", en: "Do nothing" }, { es: "Dejar tus medicamentos", en: "Stop your medication" }], 0),
  etiqueta: q({ es: "¿Cómo sabes qué contiene de verdad un producto?", en: "How do you know what a product really contains?" },
    [{ es: "Por el color del empaque", en: "By the package color" }, { es: "Por un análisis de laboratorio", en: "By a lab test" }, { es: "Porque lo dice un influencer", en: "Because an influencer says so" }], 1),
  ninos: q({ es: "¿Dónde se guarda cualquier producto con cannabis?", en: "Where should any cannabis product be stored?" },
    [{ es: "En la mesa de la sala", en: "On the living room table" }, { es: "Cerrado, fuera del alcance de niños y mascotas", en: "Locked, out of reach of kids and pets" }, { es: "En el refrigerador con la comida", en: "In the fridge with the food" }], 1),
  historia: q({ es: "¿Hace cuánto se usa el cáñamo para hacer cuerdas y telas?", en: "How long has hemp been used for rope and fabric?" },
    [{ es: "Unos 50 años", en: "About 50 years" }, { es: "Miles de años", en: "Thousands of years" }, { es: "Desde 1990", en: "Since 1990" }], 1),
  comestible: q({ es: "Los comestibles con THC…", en: "THC edibles…" },
    [{ es: "Hacen efecto al instante", en: "Work instantly" }, { es: "Tardan en hacer efecto; es fácil pasarse", en: "Take a while to kick in; easy to overdo" }, { es: "No hacen nada", en: "Do nothing" }], 1),
};
export const QUIZ_GENERAL = [Q.fibra, Q.cbd, Q.manejar];
const POOL = Object.values(Q);
const QUIZ_ZONA = {
  medicinal: [Q.cbd, Q.medicamentos, Q.etiqueta, Q.edad, Q.alcohol],
  cultivo: [Q.agua, Q.fibra, Q.historia, Q.ninos, Q.etiqueta],
  cultura: [Q.historia, Q.edad, Q.fibra, Q.manejar, Q.cbd],
  fiesta: [Q.alcohol, Q.manejar, Q.comestible, Q.ninos, Q.edad],
};

// ---------- tipos de marca (plantillas de contenido) ----------
const P = (icono, es, en, des, den) => ({ icono, nombre: { es, en }, desc: { es: des, en: den } });
const T = (es, en) => ({ es, en });
const TIPOS = {
  cosmetica: {
    categoria: T("Cosmética con cáñamo", "Hemp cosmetics"), frase: T("Hacemos cosmética natural con aceite de semilla de cáñamo.", "We make natural cosmetics with hemp seed oil."),
    productos: [P("🧴", "Crema corporal", "Body cream", "Uso cosmético. Hidrata sin perfume sintético.", "Cosmetic use. Hydrates, no synthetic scent."), P("💧", "Aceite facial", "Face oil", "Aceite de semilla prensado en frío.", "Cold-pressed seed oil."), P("🧼", "Jabón artesanal", "Handmade soap", "Hecho en frío, sin colorantes.", "Cold-process, no dyes.")],
    taller: { titulo: T("Cosmética sin mitos", "Cosmetics without myths"), bueno: T("El aceite de semilla de cáñamo tiene ácidos grasos que ayudan a hidratar la piel.", "Hemp seed oil has fatty acids that help hydrate the skin."), ojo: T("Un cosmético no cura enfermedades. Si tienes una condición de la piel, consulta a un dermatólogo.", "A cosmetic doesn't cure disease. For a skin condition, see a dermatologist.") },
    cupon: T("15% en tu primera crema", "15% off your first cream"), regalo: "cera",
  },
  bienestar: {
    categoria: T("Bienestar y aromaterapia", "Wellness and aromatherapy"), frase: T("Creamos rituales de descanso con plantas aromáticas.", "We create rest rituals with aromatic plants."),
    productos: [P("🕯️", "Vela aromática", "Scented candle", "Cera de soya y lavanda.", "Soy wax and lavender."), P("🍵", "Infusión de hierbas", "Herbal tea", "Manzanilla y menta. Sin THC.", "Chamomile and mint. THC-free."), P("🛁", "Sales de baño", "Bath salts", "Sal marina y esencias.", "Sea salt and essences.")],
    taller: { titulo: T("Descansar también se aprende", "Rest is a skill too"), bueno: T("Rutinas de sueño, luz tenue y aromas suaves ayudan a relajarse.", "Sleep routines, dim light and soft scents help you relax."), ojo: T("Si tienes problemas de sueño persistentes, busca ayuda profesional; ningún producto lo resuelve solo.", "For persistent sleep problems, get professional help; no product fixes it alone.") },
    cupon: T("2×1 en velas", "Buy one candle, get one free"), regalo: "esencia",
  },
  laboratorio: {
    categoria: T("Análisis de laboratorio", "Lab testing"), frase: T("Analizamos productos para que sepas qué contienen.", "We test products so you know what's inside."),
    productos: [P("🔬", "Análisis de cannabinoides", "Cannabinoid test", "Mide CBD y THC reales.", "Measures real CBD and THC."), P("🧪", "Prueba de pureza", "Purity test", "Detecta pesticidas y metales.", "Detects pesticides and metals."), P("📋", "Etiquetado claro", "Clear labeling", "Te ayudamos a etiquetar bien.", "We help you label right.")],
    taller: { titulo: T("Saber qué hay en un producto", "Knowing what's in a product"), bueno: T("Un análisis de laboratorio te dice el contenido real de CBD y THC de un producto.", "A lab test tells you the real CBD and THC content of a product."), ojo: T("Desconfía de productos sin etiqueta clara ni análisis: el empaque puede no coincidir.", "Be wary of products without clear labels or tests: the package may not match.") },
    cupon: T("10% en tu primer análisis", "10% off your first test"), regalo: "frasco",
  },
  iluminacion: {
    categoria: T("Iluminación para cultivo", "Grow lighting"), frase: T("Diseñamos luces LED que gastan menos energía.", "We design LED lights that use less energy."),
    productos: [P("💡", "Panel LED", "LED panel", "Espectro completo, bajo consumo.", "Full spectrum, low power."), P("⏲️", "Temporizador", "Timer", "Programa ciclos de luz.", "Schedules light cycles."), P("🌡️", "Termómetro", "Thermometer", "Temperatura y humedad.", "Temperature and humidity.")],
    taller: { titulo: T("La luz y la planta", "Light and the plant"), bueno: T("Las luces LED producen menos calor y consumen menos electricidad que las lámparas antiguas.", "LEDs run cooler and use less electricity than old lamps."), ojo: T("Revisa la instalación eléctrica: cables sobrecargados pueden causar incendios.", "Check your wiring: overloaded cables can cause fires.") },
    cupon: T("Envío gratis en luces LED", "Free shipping on LEDs"), regalo: "lampara",
  },
  sustrato: {
    categoria: T("Sustratos y abonos", "Soil and compost"), frase: T("Hacemos tierra viva con composta y hongos buenos.", "We make living soil with compost and good fungi."),
    productos: [P("🪱", "Humus de lombriz", "Worm castings", "Nutrición suave y natural.", "Gentle natural nutrition."), P("🌾", "Sustrato aireado", "Airy substrate", "Coco, perlita y composta.", "Coco, perlite and compost."), P("🧺", "Kit de composta", "Compost kit", "Para tu cocina.", "For your kitchen.")],
    taller: { titulo: T("Tierra viva", "Living soil"), bueno: T("La composta devuelve nutrientes al suelo y reduce la basura orgánica.", "Compost returns nutrients to the soil and cuts organic waste."), ojo: T("Usa guantes al manejar abonos y guárdalos lejos de niños y mascotas.", "Wear gloves with fertilizers and keep them away from kids and pets.") },
    cupon: T("10% en humus", "10% off castings"), regalo: "cal",
  },
  macetas: {
    categoria: T("Macetas y jardinería", "Pots and gardening"), frase: T("Hacemos macetas de tela y barro que dejan respirar las raíces.", "We make fabric and clay pots that let roots breathe."),
    productos: [P("🪴", "Maceta de tela", "Fabric pot", "Mejor drenaje, raíces sanas.", "Better drainage, healthy roots."), P("🏺", "Maceta de barro", "Clay pot", "Hecha a mano.", "Handmade."), P("🧤", "Guantes de jardín", "Garden gloves", "Resistentes y cómodos.", "Tough and comfy.")],
    taller: { titulo: T("Raíces felices", "Happy roots"), bueno: T("Las macetas de tela evitan que las raíces se enreden y mejoran el drenaje.", "Fabric pots keep roots from circling and improve drainage."), ojo: T("Revisa las reglas de tu país antes de cultivar cualquier planta regulada.", "Check your country's rules before growing any regulated plant.") },
    cupon: T("3×2 en macetas", "3 for 2 on pots"), regalo: "maceta",
  },
  semillas: {
    categoria: T("Banco de semillas", "Seed bank"), frase: T("Conservamos variedades de cáñamo y plantas nativas.", "We preserve hemp varieties and native plants."),
    productos: [P("🌰", "Semillas de cáñamo industrial", "Industrial hemp seeds", "Para fibra y grano.", "For fiber and grain."), P("🌻", "Flores nativas", "Native flowers", "Para polinizadores.", "For pollinators."), P("📦", "Kit germinador", "Germination kit", "Todo para empezar.", "Everything to start.")],
    taller: { titulo: T("Guardianes de semillas", "Seed keepers"), bueno: T("Conservar semillas protege la diversidad de las plantas.", "Saving seeds protects plant diversity."), ojo: T("Comprar o cultivar semillas de cannabis solo es legal en algunos países. Revisa tu ley local.", "Buying or growing cannabis seeds is only legal in some countries. Check local law.") },
    cupon: T("Regalo de flores nativas", "Free native flower seeds"), regalo: "luna",
  },
  alimento: {
    categoria: T("Alimentos con semilla de cáñamo", "Hemp seed foods"), frase: T("Cocinamos con semilla de cáñamo: proteína y sabor.", "We cook with hemp seed: protein and flavor."),
    productos: [P("🥜", "Semillas peladas", "Hulled seeds", "Alimento, no para sembrar.", "Food, not for planting."), P("🍪", "Galletas de cáñamo", "Hemp cookies", "Sin THC.", "THC-free."), P("🫒", "Aceite de semilla", "Seed oil", "Prensado en frío.", "Cold-pressed.")],
    taller: { titulo: T("La semilla en la cocina", "The seed in the kitchen"), bueno: T("La semilla de cáñamo aporta proteína y grasas saludables, y no tiene cantidades relevantes de THC.", "Hemp seed brings protein and healthy fats, and no relevant THC."), ojo: T("No confundas alimentos de semilla con comestibles con THC: estos tardan en hacer efecto y es fácil pasarse.", "Don't confuse seed foods with THC edibles: those take a while to work and it's easy to overdo.") },
    cupon: T("20% en el kit de cocina", "20% off the kitchen kit"), regalo: "luna",
  },
  papel: {
    categoria: T("Papel de cáñamo", "Hemp paper"), frase: T("Hacemos papel sin talar árboles.", "We make paper without cutting trees."),
    productos: [P("📜", "Papel para dibujo", "Drawing paper", "180 g, sin cloro.", "180 g, chlorine-free."), P("📔", "Libreta cosida", "Sewn notebook", "Hecha a mano.", "Handmade."), P("🗒️", "Bitácora de cultivo", "Grow journal", "Riego, luz y cosechas.", "Water, light and harvests.")],
    taller: { titulo: T("Papel sin talar árboles", "Paper without cutting trees"), bueno: T("El papel de cáñamo se puede reciclar más veces que el de madera y amarillea menos.", "Hemp paper can be recycled more times than wood paper and yellows less."), ojo: T("Quemar cualquier material produce humo que irrita los pulmones.", "Burning any material produces smoke that irritates the lungs.") },
    cupon: T("2×1 en libretas", "Buy one notebook, get one free"), regalo: "tinte",
  },
  libros: {
    categoria: T("Libros y editorial", "Books and publishing"), frase: T("Publicamos libros sobre la historia y la ciencia de la planta.", "We publish books on the plant's history and science."),
    productos: [P("📚", "Historia del cáñamo", "History of hemp", "De la antigüedad a hoy.", "From ancient times to today."), P("📖", "Guía de cultivo legal", "Legal growing guide", "País por país.", "Country by country."), P("🗺️", "Atlas botánico", "Botanical atlas", "Ilustrado a mano.", "Hand-illustrated.")],
    taller: { titulo: T("Leer antes de opinar", "Read before you judge"), bueno: T("Informarte con fuentes serias te ayuda a tomar mejores decisiones.", "Serious sources help you make better decisions."), ojo: T("Desconfía de quien promete curas milagrosas: la ciencia avanza, pero con calma.", "Beware of miracle-cure promises: science moves, but slowly.") },
    cupon: T("15% en libros", "15% off books"), regalo: "luna",
  },
  arte: {
    categoria: T("Arte y diseño", "Art and design"), frase: T("Hacemos arte inspirado en la planta y su cultura.", "We make art inspired by the plant and its culture."),
    productos: [P("🖼️", "Serigrafía «Hoja nocturna»", "“Night leaf” print", "Edición de 50 firmadas.", "Edition of 50 signed."), P("🎨", "Taller de pintura", "Painting class", "Sesión de 3 horas.", "3-hour session."), P("🧩", "Rompecabezas botánico", "Botanical puzzle", "500 piezas.", "500 pieces.")],
    taller: { titulo: T("Arte y cultura de la planta", "Art and plant culture"), bueno: T("La planta ha inspirado textiles, música y arte popular en toda América Latina.", "The plant has inspired textiles, music and folk art across Latin America."), ojo: T("En menores de 25 años el consumo se asocia a más riesgos para el cerebro en desarrollo.", "Under 25, use is linked to more risks for the developing brain.") },
    cupon: T("10% en serigrafías", "10% off prints"), regalo: "tinte",
  },
  musica: {
    categoria: T("Música y sonido", "Music and sound"), frase: T("Producimos música y conciertos al aire libre.", "We produce music and open-air concerts."),
    productos: [P("💿", "Vinilo de edición limitada", "Limited vinyl", "Música local.", "Local music."), P("🎧", "Audífonos de cáñamo", "Hemp headphones", "Diadema de fibra.", "Fiber headband."), P("🎟️", "Pase de concierto", "Concert pass", "Para adultos.", "Adults only.")],
    taller: { titulo: T("Fiesta con cuidado", "Party with care"), bueno: T("La música une a la comunidad, y cuidarse entre amigos es parte de la fiesta.", "Music brings people together, and looking after friends is part of the party."), ojo: T("Mezclar cannabis con alcohol aumenta los riesgos. Hidrátate y nunca manejes.", "Mixing cannabis with alcohol raises the risks. Hydrate and never drive.") },
    cupon: T("10% en vinilos", "10% off vinyl"), regalo: "campanita",
  },
  textil: {
    categoria: T("Textiles de cáñamo", "Hemp textiles"), frase: T("Tejemos ropa y mochilas de fibra de cáñamo.", "We weave clothes and backpacks from hemp fiber."),
    productos: [P("🎒", "Mochila de cáñamo", "Hemp backpack", "Lona de cáñamo y algodón orgánico.", "Hemp and organic cotton canvas."), P("👕", "Camiseta respirable", "Breathable tee", "Más fresca que el algodón.", "Cooler than cotton."), P("🧣", "Bufanda tejida", "Knit scarf", "Suave y resistente.", "Soft and tough.")],
    taller: { titulo: T("La fibra de 10,000 años", "The 10,000-year fiber"), bueno: T("El cáñamo industrial da fibras largas y resistentes para telas, cuerdas y papel, y crece rápido.", "Industrial hemp gives long, strong fibers for fabric, rope and paper, and grows fast."), ojo: T("Cultivar cáñamo tiene reglas distintas en cada país. Revisa la ley local antes de sembrar.", "Growing hemp has different rules in every country. Check local law first.") },
    cupon: T("15% en tu primera mochila", "15% off your first backpack"), regalo: "hilo",
  },
  ceramica: {
    categoria: T("Cerámica", "Ceramics"), frase: T("Hacemos piezas de barro a mano.", "We make clay pieces by hand."),
    productos: [P("🏺", "Jarrón", "Vase", "Barro bruñido.", "Burnished clay."), P("🥣", "Cuenco", "Bowl", "Esmalte sin plomo.", "Lead-free glaze."), P("☕", "Taza", "Mug", "Para tu infusión.", "For your tea.")],
    taller: { titulo: T("Del barro a la mesa", "From clay to table"), bueno: T("La cerámica artesanal sostiene oficios tradicionales.", "Handmade ceramics keep traditional crafts alive."), ojo: T("Guarda todo lo relacionado con cannabis cerrado y fuera del alcance de niños y mascotas.", "Keep anything cannabis-related locked and away from kids and pets.") },
    cupon: T("10% en tazas", "10% off mugs"), regalo: "frasco",
  },
  ropa: {
    categoria: T("Ropa y gorras", "Clothing and caps"), frase: T("Diseñamos ropa con estampados de hojas.", "We design clothing with leaf prints."),
    productos: [P("🧢", "Gorra bordada", "Embroidered cap", "Hoja en hilo dorado.", "Leaf in gold thread."), P("👕", "Playera estampada", "Printed tee", "Tinta al agua.", "Water-based ink."), P("🧦", "Calcetines de hojas", "Leaf socks", "Divertidos y suaves.", "Fun and soft.")],
    taller: { titulo: T("Moda con identidad", "Fashion with identity"), bueno: T("Usar la hoja como símbolo cultural ayuda a quitarle el estigma.", "Using the leaf as a cultural symbol helps remove stigma."), ojo: T("La estética no es una invitación a consumir: infórmate y decide con calma.", "The look isn't an invitation to use: get informed and decide calmly.") },
    cupon: T("15% en gorras", "15% off caps"), regalo: "hilo",
  },
  vidrio: {
    categoria: T("Accesorios de vidrio", "Glass accessories"), frase: T("Soplamos vidrio a mano.", "We hand-blow glass."),
    productos: [P("🫙", "Frasco hermético", "Airtight jar", "Borosilicato con tapa de bambú.", "Borosilicate, bamboo lid."), P("🔮", "Esfera decorativa", "Decorative orb", "Pieza única.", "One of a kind."), P("🥣", "Cenicero de vidrio", "Glass ashtray", "Base pesada.", "Heavy base.")],
    taller: { titulo: T("Cómo se sopla el vidrio", "How glass is blown"), bueno: T("El vidrio de borosilicato aguanta cambios de temperatura y no suelta sabores ni químicos.", "Borosilicate glass handles heat changes and doesn't leach flavors or chemicals."), ojo: T("Guarda todo en frascos cerrados, etiquetados y fuera del alcance de niños y mascotas.", "Keep everything in closed, labeled jars, out of reach of kids and pets.") },
    cupon: T("10% en frascos herméticos", "10% off airtight jars"), regalo: "lampara",
  },
  accesorios: {
    categoria: T("Accesorios", "Accessories"), frase: T("Hacemos grinders, estuches y accesorios que duran.", "We make grinders, cases and accessories that last."),
    productos: [P("⚙️", "Grinder de aluminio", "Aluminum grinder", "Cuatro piezas.", "Four pieces."), P("👜", "Estuche antiolor", "Smell-proof case", "Forro de carbón.", "Carbon lining."), P("🔒", "Caja con candado", "Lock box", "Para guardar seguro.", "For safe storage.")],
    taller: { titulo: T("Guardar con responsabilidad", "Store responsibly"), bueno: T("Un estuche con candado mantiene todo fuera del alcance de niños y mascotas.", "A lock box keeps everything away from kids and pets."), ojo: T("Si consumes, no lo hagas frente a menores ni donde está prohibido.", "If you use, never in front of minors or where it's banned.") },
    cupon: T("10% en estuches", "10% off cases"), regalo: "campanita",
  },
  festival: {
    categoria: T("Festivales y eventos", "Festivals and events"), frase: T("Organizamos ferias y conciertos para adultos.", "We run fairs and concerts for adults."),
    productos: [P("🎪", "Entrada a la feria", "Fair ticket", "Acceso general.", "General admission."), P("🎆", "Noche de luces", "Night of lights", "Espectáculo final.", "Closing show."), P("🥤", "Bebidas sin alcohol", "Alcohol-free drinks", "Agua y jugos gratis.", "Free water and juice.")],
    taller: { titulo: T("Disfrutar sin pasarse", "Enjoy without overdoing it"), bueno: T("Los eventos con zonas de descanso y agua gratis cuidan a la gente.", "Events with chill zones and free water look after people."), ojo: T("Si alguien se siente mal, llévalo a un lugar tranquilo y pide ayuda al personal médico del evento.", "If someone feels unwell, take them somewhere calm and get the event's medical staff.") },
    cupon: T("Pase 2×1", "2-for-1 pass"), regalo: "luna",
  },
};

const ANFITRIONES = ["Rocío", "Nico", "Lía", "Bruno", "Kai", "Maite", "Joaquín", "Vale", "Teo", "Ama", "Fede", "Zoe", "Iñaki", "Sami", "Paz", "Leo", "Dani", "Coco", "Juli", "Rafa", "Noa", "Gael", "Ivi", "Toña", "Pancho", "Emi", "Kiara", "Simón", "Abril", "Yago", "Luz", "Mati", "Cata", "Benja", "Olivia", "Tomás", "Flor", "Uma", "Santi", "Ale", "Pili", "Ramiro", "Jazmín", "Beto"];
const JUEGOS = ["ruleta", "quiz", "rasca"];
const BASES_SEMILLA = { fibra: T("Fibra Larga", "Long Fiber"), grano: T("Grano de Oro", "Golden Grain"), flor: T("Flor Serena", "Serene Flower") };

// Semilla registrada de un patrocinador: crece más rápido y da el doble
function semillaRegistrada(base, nombreMarca, lunas) {
  return { base, nombre: { es: `${BASES_SEMILLA[base].es} · ${nombreMarca}`, en: `${BASES_SEMILLA[base].en} · ${nombreMarca}` }, precio: { lunas }, rapido: 0.75, mult: 2 };
}

// [id, nombre, país, países donde vende, zona, tipo]
const GENERADAS = [
  ["bruma-natural", "Bruma Natural", "CL", ["CL", "AR"], "medicinal", "cosmetica"],
  ["kanna-skin", "Kanna Skin", "ES", ["ES"], "medicinal", "cosmetica"],
  ["aurora-wellness", "Aurora Wellness", "US", ["US"], "medicinal", "bienestar"],
  ["raiz-viva", "Raíz Viva", "CO", ["CO"], "medicinal", "bienestar"],
  ["sereno-lab", "Sereno Lab", "US", ["US"], "medicinal", "laboratorio"],
  ["botica-del-sur", "Botica del Sur", "AR", ["AR", "UY"], "medicinal", "cosmetica"],
  ["lavanda-canamo", "Lavanda & Cáñamo", "ES", ["ES"], "medicinal", "bienestar"],
  ["mar-de-hojas", "Mar de Hojas", "UY", ["UY"], "medicinal", "cosmetica"],
  ["alma-verde", "Alma Verde", "MX", ["MX"], "medicinal", "bienestar"],
  ["rocio-labs", "Rocío Labs", "CO", ["CO", "MX"], "medicinal", "laboratorio"],
  ["calma-andina", "Calma Andina", "CL", ["CL"], "medicinal", "laboratorio"],
  ["nube-blanca", "Nube Blanca", "AR", ["AR"], "medicinal", "laboratorio"],
  ["sol-de-huerta", "Sol de Huerta", "AR", ["AR", "UY"], "cultivo", "iluminacion"],
  ["lumen-grow", "Lumen Grow", "US", ["US"], "cultivo", "iluminacion"],
  ["luz-andina", "Luz Andina", "CL", ["CL"], "cultivo", "iluminacion"],
  ["tierra-madre", "Tierra Madre", "CL", ["CL", "AR"], "cultivo", "sustrato"],
  ["compost-club", "Compost Club", "CO", ["CO"], "cultivo", "sustrato"],
  ["abono-magico", "Abono Mágico", "MX", ["MX"], "cultivo", "sustrato"],
  ["brote-feliz", "Brote Feliz", "MX", ["MX"], "cultivo", "macetas"],
  ["raices-profundas", "Raíces Profundas", "AR", ["AR"], "cultivo", "macetas"],
  ["green-valley", "Green Valley Supply", "US", ["US"], "cultivo", "macetas"],
  ["la-semilleria", "La Semillería", "ES", ["ES"], "cultivo", "semillas"],
  ["semillero-sur", "Semillero del Sur", "UY", ["UY"], "cultivo", "semillas"],
  ["guardianes", "Guardianes de Semillas", "CL", ["CL"], "cultivo", "semillas"],
  ["tinta-verde", "Tinta Verde Editorial", "AR", ["AR", "UY", "CL"], "cultura", "libros"],
  ["libros-del-sur", "Libros del Sur", "CL", ["CL"], "cultura", "libros"],
  ["museo-canamo", "Museo del Cáñamo", "ES", ["ES"], "cultura", "libros"],
  ["grafiti-botanico", "Grafiti Botánico", "US", ["US"], "cultura", "arte"],
  ["pincel-selva", "Pincel de Selva", "CO", ["CO"], "cultura", "arte"],
  ["barro-y-hoja", "Barro y Hoja", "MX", ["MX"], "cultura", "ceramica"],
  ["alfar-andino", "Alfar Andino", "CL", ["CL"], "cultura", "ceramica"],
  ["hoja-sonora", "Hoja Sonora", "CO", ["CO", "MX"], "cultura", "musica"],
  ["papel-volcan", "Papel Volcán", "MX", ["MX"], "cultura", "papel"],
  ["gorra-loca", "Gorra Loca", "MX", ["MX"], "fiesta", "ropa"],
  ["neon-club", "Neón Club", "US", ["US"], "fiesta", "ropa"],
  ["hojarasca", "Hojarasca Ropa", "AR", ["AR"], "fiesta", "ropa"],
  ["grinder-galactico", "Grinder Galáctico", "US", ["US"], "fiesta", "accesorios"],
  ["estuche-andino", "Estuche Andino", "CL", ["CL"], "fiesta", "accesorios"],
  ["cofre-verde", "Cofre Verde", "ES", ["ES"], "fiesta", "accesorios"],
  ["cumbia-verde", "Cumbia Verde", "CO", ["CO"], "fiesta", "musica"],
  ["tango-hemp", "Tango Hemp Sound", "AR", ["AR"], "fiesta", "musica"],
  ["feria-de-luz", "Feria de Luz", "UY", ["UY"], "fiesta", "festival"],
  ["noche-de-hojas", "Noche de Hojas", "ES", ["ES"], "fiesta", "festival"],
  ["fiesta-andina", "Fiesta Andina", "CL", ["CL"], "fiesta", "festival"],
];

function desdeTipo(id, nombre, pais, paises, zona, tipo, i) {
  const tp = TIPOS[tipo];
  const anf = ANFITRIONES[i % ANFITRIONES.length];
  const quiz = QUIZ_ZONA[zona];
  const m = {
    id, nombre, pais, paises, zona, tipo,
    categoria: tp.categoria,
    color: COLORES_ZONA[zona][i % 6],
    plantilla: ESTILOS_ZONA[zona][i % 4],
    anfitrion: {
      nombre: anf,
      saludo: { es: `¡Hola! Soy ${anf} y te doy la bienvenida a ${nombre}. ${tp.frase.es} Juega, aprende y llévate tu regalo.`, en: `Hi! I'm ${anf}, welcome to ${nombre}. ${tp.frase.en} Play, learn and take your gift.` },
    },
    productos: tp.productos,
    juego: JUEGOS[i % 3],
    quiz: [quiz[i % 5], quiz[(i + 1) % 5], quiz[(i + 3) % 5]],
    regalo: tp.regalo,
    cupon: { desc: tp.cupon, dias: 30 + (i % 3) * 15 },
    taller: tp.taller,
  };
  if (zona === "cultivo") m.semilla = semillaRegistrada(["fibra", "grano", "flor"][i % 3], nombre, 1 + (i % 3));
  if (tipo === "cosmetica") m.semilla = semillaRegistrada("flor", nombre, 2);
  return m;
}

// Las seis marcas originales, con contenido escrito a mano
const BASE = [
  {
    ...desdeTipo("golden-coast", "Golden Coast Glass", "US", ["US"], "fiesta", "vidrio", 1),
    plantilla: "cristal", color: "#f2c45a", juego: "ruleta",
    anfitrion: { nombre: "Sunny", saludo: { es: "¡Hola! Todo lo que ves aquí está soplado a mano en California. Gira la ruleta y llévate tu regalo.", en: "Hi! Everything here is hand-blown in California. Spin the wheel and grab your gift." } },
  },
  {
    ...desdeTipo("andes-hemp", "Andes Hemp Co.", "CL", ["CL", "AR"], "cultura", "textil", 2),
    plantilla: "arbol", color: "#7fd1a8", juego: "quiz", quiz: [Q.historia, Q.fibra, Q.agua],
    anfitrion: { nombre: "Ñuke", saludo: { es: "Bienvenida, bienvenido. Hacemos mochilas y ropa de cáñamo en el sur de Chile. ¿Cuánto sabes de esta fibra?", en: "Welcome. We make hemp backpacks and clothing in southern Chile. How much do you know about this fiber?" } },
    semilla: semillaRegistrada("fibra", "Andes Hemp", 2),
  },
  {
    ...desdeTipo("pampa-papers", "Pampa Papers", "AR", ["AR", "UY", "CL"], "cultura", "papel", 3),
    plantilla: "cabana", juego: "rasca",
    anfitrion: { nombre: "Tano", saludo: { es: "¡Che, qué bueno verte! Hacemos papel de cáñamo para arte y libretas cosidas a mano en Buenos Aires.", en: "Hey, great to see you! We make hemp paper for art and hand-sewn notebooks in Buenos Aires." } },
  },
  {
    ...desdeTipo("luna-botanica", "Luna Botánica", "ES", ["ES"], "medicinal", "cosmetica", 0),
    plantilla: "hongo", color: "#c9a2ff", juego: "quiz", quiz: [Q.cbd, Q.medicamentos, Q.etiqueta],
    anfitrion: { nombre: "Alba", saludo: { es: "Hola, soy Alba. Hacemos cosmética natural con cáñamo en Valencia. Aquí te contamos qué es el CBD, sin exagerar.", en: "Hi, I'm Alba. We make natural hemp cosmetics in Valencia. Here we explain what CBD is, without the hype." } },
  },
  {
    ...desdeTipo("mate-canamo", "Mate & Cáñamo", "UY", ["UY", "AR"], "cultivo", "alimento", 4),
    plantilla: "invernadero", color: "#b6e36b", juego: "ruleta",
    anfitrion: { nombre: "Lucía", saludo: { es: "¡Buenas! En Montevideo cocinamos con semilla de cáñamo. Gira la ruleta, capaz te toca algo.", en: "Hello! In Montevideo we cook with hemp seed. Spin the wheel, you might win something." } },
    semilla: semillaRegistrada("grano", "Mate & Cáñamo", 1),
  },
  {
    ...desdeTipo("casa-verde", "Casa Verde Arte", "CO", ["CO"], "cultura", "arte", 5),
    plantilla: "torre", color: "#ff7ad9", juego: "quiz",
    anfitrion: { nombre: "Mafe", saludo: { es: "¡Bienvenido a la casa! Somos un colectivo de Medellín: serigrafía, cerámica y libros sobre la planta.", en: "Welcome to the house! We're a Medellín collective: screenprints, ceramics and books on the plant." } },
  },
];

export const MARCAS = [...BASE, ...GENERADAS.map((g, i) => desdeTipo(...g, i + 6))];

export const LUGARES = {
  universidad: { id: "universidad", es: "Universidad", en: "University", color: "#8fa6ff", plantilla: "universidad", x: 49, y: 31 },
  taller: { id: "taller", es: "Taller de transformación", en: "Transformation Workshop", color: "#ffb35c", plantilla: "tallerT", x: 31, y: 31 },
};

export const VECINOS = [
  { id: "kim", nombre: "Kim", look: { piel: "#f6d5b8", pelo: "#2b1d14", ropa: "#6f8cff", gorra: true } },
  { id: "sol", nombre: "Sol", look: { piel: "#c68a5e", pelo: "#e0b04a", ropa: "#ff8a5c", gorra: false } },
  { id: "tomi", nombre: "Tomi", look: { piel: "#8d5a3b", pelo: "#cfd0da", ropa: "#c9a2ff", gorra: true } },
];

export const LECCIONES = [
  {
    id: "canamo", icono: "🌿", lunas: 2,
    titulo: { es: "El cáñamo: una planta, mil usos", en: "Hemp: one plant, a thousand uses" },
    texto: [
      { es: "Del tallo sale la fibra: telas, cuerdas y papel.", en: "The stalk gives fiber: fabric, rope and paper." },
      { es: "De la semilla sale alimento y aceite.", en: "The seed gives food and oil." },
      { es: "Mezclado con cal, el tallo sirve para hacer bloques de construcción ligeros.", en: "Mixed with lime, the stalk makes light building blocks." },
    ],
    premio: { es: "Desbloquea la Flor Lumen y la ropa en el Taller", en: "Unlocks the Lumen flower and clothing in the Workshop" },
    pregunta: q({ es: "¿Cuál de estas cosas se puede hacer con cáñamo?", en: "Which of these can be made from hemp?" },
      [{ es: "Solo cuerdas", en: "Only rope" }, { es: "Telas, papel y bloques de construcción", en: "Fabric, paper and building blocks" }, { es: "Nada útil", en: "Nothing useful" }], 1),
  },
  {
    id: "riesgos", icono: "⚖️", lunas: 2,
    titulo: { es: "Beneficios y riesgos, a la misma altura", en: "Benefits and risks, side by side" },
    texto: [
      { es: "Los efectos cambian mucho de una persona a otra. Empieza por informarte.", en: "Effects vary a lot from person to person. Start by getting informed." },
      { es: "No manejes ni operes máquinas después de consumir.", en: "Don't drive or operate machinery after using." },
      { es: "Mezclar con alcohol aumenta los riesgos. En embarazo y lactancia, evítalo.", en: "Mixing with alcohol raises the risks. Avoid it while pregnant or breastfeeding." },
      { es: "Si tomas medicamentos, consulta a un profesional de salud.", en: "If you take medication, talk to a health professional." },
    ],
    premio: { es: "+2 de polen dorado", en: "+2 golden pollen" },
    pregunta: Q.alcohol,
  },
  {
    id: "botica", icono: "⚗️", lunas: 2,
    titulo: { es: "La planta como medicina: lo que se sabe", en: "The plant as medicine: what we know" },
    texto: [
      { es: "En varios países hay medicamentos con cannabinoides que receta un médico para casos específicos.", en: "Several countries have cannabinoid medicines that doctors prescribe for specific cases." },
      { es: "La investigación sigue: para muchos usos todavía no hay pruebas suficientes.", en: "Research continues: for many uses there isn't enough evidence yet." },
      { es: "Automedicarse tiene riesgos. El camino seguro es hablar con un profesional de salud.", en: "Self-medicating has risks. The safe path is talking to a health professional." },
    ],
    premio: { es: "Desbloquea la Botica en el Taller", en: "Unlocks the Apothecary in the Workshop" },
    pregunta: q({ es: "Si quieres usar cannabis medicinal, ¿qué es lo más seguro?", en: "If you want to use medical cannabis, what's safest?" },
      [{ es: "Seguir lo que dice un video", en: "Follow what a video says" }, { es: "Hablarlo con un profesional de salud", en: "Talk it through with a health professional" }, { es: "Probar dosis hasta que funcione", en: "Try doses until it works" }], 1),
  },
];

export const MISIONES = [
  { id: "visitar", meta: 5, icono: "🏛️", hojas: 20, es: "Visita 5 stands", en: "Visit 5 stands" },
  { id: "sembrar", meta: 1, icono: "🌱", hojas: 10, es: "Siembra tu primera semilla", en: "Plant your first seed" },
  { id: "cosechar", meta: 3, icono: "🧺", hojas: 20, es: "Cosecha 3 veces", en: "Harvest 3 times" },
  { id: "jugar", meta: 2, icono: "🎰", hojas: 15, es: "Juega 2 minijuegos de marca", en: "Play 2 brand mini-games" },
  { id: "leccion", meta: 1, icono: "🎓", lunas: 1, es: "Completa una lección", en: "Complete a lesson" },
  { id: "transformar", meta: 1, icono: "⚗️", hojas: 15, es: "Transforma algo en el Taller", en: "Craft something in the Workshop" },
  { id: "vender", meta: 1, icono: "🪙", hojas: 10, es: "Vende en el Mercado", en: "Sell at the Market" },
  { id: "ayudar", meta: 1, icono: "🤝", lunas: 1, es: "Cosecha la parcela de un vecino", en: "Harvest a neighbor's plot" },
  { id: "registrada", meta: 1, icono: "🏷️", lunas: 1, es: "Siembra una semilla registrada", en: "Plant a registered seed" },
];

export const LOOKS = {
  pieles: ["#f6d5b8", "#e3b088", "#c68a5e", "#8d5a3b", "#5c3a24"],
  pelos: ["#2b1d14", "#7a4520", "#e0b04a", "#cfd0da", "#ff7ad9"],
  ropas: ["#5fd38d", "#6f8cff", "#ff8a5c", "#c9a2ff", "#f2c45a", "#2fd3c9"],
};
