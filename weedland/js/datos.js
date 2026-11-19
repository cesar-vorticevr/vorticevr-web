// Datos del demo de Weedland Station. Todas las marcas son FICTICIAS (de ejemplo).

export const PAISES = [
  { id: "AR", nombre: "Argentina", edad: 18 },
  { id: "CL", nombre: "Chile", edad: 18 },
  { id: "CO", nombre: "Colombia", edad: 18 },
  { id: "ES", nombre: "España", edad: 18 },
  { id: "US", nombre: "Estados Unidos", edad: 21 },
  { id: "MX", nombre: "México", edad: 18 },
  { id: "UY", nombre: "Uruguay", edad: 18 },
  { id: "XX", nombre: "Otro país", edad: 21 },
];
export const nombrePais = (id) => (PAISES.find((p) => p.id === id) || {}).nombre || id;

// Módulos de la estación. El ángulo es su lugar alrededor de la plaza central.
export const PABELLONES = [
  { id: "genetica", nombre: "Genética", icono: "🧬", color: "#7dffb3", angulo: 45, lema: "Bancos de semillas y genética (donde es legal)" },
  { id: "accesorios", nombre: "Accesorios", icono: "🛠️", color: "#ff7ad9", angulo: 135, lema: "Vaporizadores, vidrio, papeles y más" },
  { id: "canamo", nombre: "Cáñamo y bienestar", icono: "🌾", color: "#f2c45a", angulo: 225, lema: "Textiles, cosmética y productos de cáñamo" },
  { id: "cultivo", nombre: "Cultivo", icono: "💡", color: "#6ff0ff", angulo: 315, lema: "Iluminación, sustratos, riego e hidroponía" },
];
export const UNIVERSIDAD = { id: "universidad", nombre: "Universidad", icono: "🎓", color: "#b18cff", angulo: 90 };

// ---------- marcas ----------
// cats: categorías del catálogo. Cada base se multiplica por sus variantes para simular catálogos grandes.
const MARCAS_MANO = [
  {
    id: "aurora", nivel: "premium", nombre: "Semillas Aurora", pab: "genetica", pais: "ES", color: "#7dffb3", color2: "#0f5d43", icono: "🌅", sigla: "SA",
    lema: "Genética europea desde 2009",
    desc: "Banco de semillas con más de 120 variedades registradas. Venta solo en países donde es legal.",
    actividad: "ruleta",
    cupon: { texto: "15% en tu primer pedido", costo: 60 }, sorteo: "Kit de coleccionista Aurora",
    anuncio: "Nuevas variedades de otoño",
    cats: [
      { nombre: "Feminizadas", items: ["Aurora Kush", "Lemon Dawn", "Northern Aurora", "Blue Horizon", "Amnesia Sol"], variantes: ["3 u.", "5 u.", "10 u."], icono: "🌱", precio: [24, 70] },
      { nombre: "Autoflorecientes", items: ["Auto Aurora", "Auto Lemon", "Auto Cream"], variantes: ["3 u.", "5 u."], icono: "⏱️", precio: [22, 55] },
      { nombre: "Merch", items: ["Gorra Aurora", "Playera Dawn", "Libreta de cultivo"], variantes: ["única"], icono: "🧢", precio: [12, 30] },
    ],
  },
  {
    id: "andes", nombre: "GenLab Andes", pab: "genetica", pais: "CL", color: "#9be36b", color2: "#2d5a12", icono: "🏔️", sigla: "GA",
    lema: "Genética de altura, hecha en Chile",
    desc: "Laboratorio chileno de genética adaptada a climas fríos. Trabaja con cultivadores registrados.",
    actividad: "quiz",
    cupon: { texto: "Envío gratis en Chile", costo: 40 }, sorteo: "Visita guiada al laboratorio",
    anuncio: "Genética para clima frío",
    cats: [
      { nombre: "Regulares", items: ["Cordillera", "Volcán Azul", "Patagonia", "Atacama Haze"], variantes: ["6 u.", "12 u."], icono: "🌱", precio: [30, 80] },
      { nombre: "Feminizadas", items: ["Andina", "Pacífico", "Nieve Dulce"], variantes: ["3 u.", "5 u."], icono: "🌿", precio: [28, 60] },
      { nombre: "Libros", items: ["Guía del cultivador andino", "Manual de genética"], variantes: ["impreso", "digital"], icono: "📘", precio: [9, 25] },
    ],
  },
  {
    id: "selva", nombre: "Selva Seeds", pab: "genetica", pais: "CO", color: "#c6f36b", color2: "#3d5a0c", icono: "🦜", sigla: "SS",
    lema: "Biodiversidad colombiana",
    desc: "Semillas de cáñamo y genética tropical con licencia en Colombia.",
    actividad: "rasca",
    cupon: { texto: "2x1 en semillas de cáñamo", costo: 50 }, sorteo: "Canasta de productos de cáñamo",
    anuncio: "Genética tropical con licencia",
    cats: [
      { nombre: "Cáñamo industrial", items: ["Fibra Caribe", "Grano Andino", "Dual Selva"], variantes: ["100 g", "500 g", "1 kg"], icono: "🌾", precio: [10, 90] },
      { nombre: "Tropicales", items: ["Guacamaya", "Colibrí", "Tayrona", "Amazonia"], variantes: ["3 u.", "5 u."], icono: "🌴", precio: [25, 60] },
    ],
  },
  {
    id: "vapor", nivel: "isla", angulo: 180, nombre: "Vapor Norte", pab: "accesorios", pais: "US", color: "#ff7ad9", color2: "#5a1149", icono: "♨️", sigla: "VN",
    lema: "Vaporizadores de diseño",
    desc: "Vaporizadores de hierbas secas, repuestos y accesorios. Garantía de 2 años.",
    actividad: "ruleta",
    cupon: { texto: "US$ 20 de descuento", costo: 90 }, sorteo: "Vaporizador Norte One",
    anuncio: "Norte One: diseño que se nota",
    cats: [
      { nombre: "Vaporizadores", items: ["Norte One", "Norte Mini", "Norte Pro", "Norte Desk"], variantes: ["negro", "blanco", "rosa"], icono: "♨️", precio: [89, 320] },
      { nombre: "Repuestos", items: ["Boquilla", "Cámara", "Filtros", "Batería"], variantes: ["One", "Mini", "Pro"], icono: "🔧", precio: [8, 45] },
      { nombre: "Estuches", items: ["Estuche rígido", "Funda de viaje"], variantes: ["S", "M"], icono: "👜", precio: [15, 35] },
    ],
  },
  {
    id: "kaleido", nivel: "premium", nombre: "Kaleido Glass", pab: "accesorios", pais: "AR", color: "#6ff0ff", color2: "#0c4b5a", icono: "🔮", sigla: "KG",
    lema: "Vidrio soplado de autor",
    desc: "Piezas de vidrio artesanal hechas a mano en Buenos Aires. Cada pieza es única.",
    actividad: "rasca",
    cupon: { texto: "10% en piezas de autor", costo: 50 }, sorteo: "Pieza única firmada",
    anuncio: "Cada pieza es única",
    cats: [
      { nombre: "Pipas", items: ["Spoon Kaleido", "Sherlock", "Chillum Prisma"], variantes: ["azul", "ámbar", "verde", "arcoíris"], icono: "🔮", precio: [25, 120] },
      { nombre: "Bongs", items: ["Beaker Luz", "Tubo Recto", "Reciclador Ola"], variantes: ["20 cm", "30 cm"], icono: "🧪", precio: [70, 260] },
      { nombre: "Accesorios", items: ["Bowl", "Ash catcher", "Limpiador"], variantes: ["14 mm", "18 mm"], icono: "🧽", precio: [10, 40] },
    ],
  },
  {
    id: "brisa", nombre: "Papeles Brisa", pab: "accesorios", pais: "UY", color: "#f2f2f2", color2: "#3a3a4a", icono: "📜", sigla: "PB",
    lema: "Papeles finos sin blanquear",
    desc: "Papeles de fibra natural, filtros y bandejas. Hecho en Uruguay.",
    actividad: "quiz",
    cupon: { texto: "Bandeja gratis en compras +US$30", costo: 45 }, sorteo: "Caja de colección Brisa",
    anuncio: "Fibra natural, sin blanquear",
    cats: [
      { nombre: "Papeles", items: ["Brisa King Size", "Brisa 1¼", "Brisa Cáñamo", "Brisa Arroz"], variantes: ["librito", "caja x24", "caja x50"], icono: "📜", precio: [1, 40] },
      { nombre: "Filtros", items: ["Filtros de cartón", "Filtros de vidrio"], variantes: ["x50", "x100"], icono: "🔘", precio: [2, 18] },
      { nombre: "Bandejas", items: ["Bandeja Ola", "Bandeja Faro", "Bandeja Montevideo"], variantes: ["S", "M", "L"], icono: "🟫", precio: [8, 25] },
    ],
  },
  {
    id: "telaverde", nivel: "premium", nombre: "Tela Verde", pab: "canamo", pais: "AR", color: "#f2c45a", color2: "#5a4310", icono: "🧵", sigla: "TV",
    lema: "Ropa de cáñamo para todos los días",
    desc: "Moda sostenible con fibra de cáñamo: playeras, mochilas y tenis.",
    actividad: "rasca",
    cupon: { texto: "20% en la colección de verano", costo: 70 }, sorteo: "Mochila Tela Verde",
    anuncio: "Colección de verano en cáñamo",
    cats: [
      { nombre: "Playeras", items: ["Básica", "Oversize", "Estampada Hoja", "Manga larga"], variantes: ["S", "M", "L", "XL"], icono: "👕", precio: [22, 40] },
      { nombre: "Mochilas", items: ["Mochila Urbana", "Tote", "Riñonera"], variantes: ["arena", "verde", "negro"], icono: "🎒", precio: [25, 70] },
      { nombre: "Tenis", items: ["Tenis Lino", "Tenis Trail"], variantes: ["25", "26", "27", "28"], icono: "👟", precio: [60, 95] },
    ],
  },
  {
    id: "hempa", nombre: "Cosmética Hempa", pab: "canamo", pais: "ES", color: "#ffb3e6", color2: "#5a2049", icono: "🧴", sigla: "CH",
    lema: "Cosmética con aceite de semilla de cáñamo",
    desc: "Cremas, jabones y bálsamos con aceite de semilla de cáñamo. Productos cosméticos, no medicamentos.",
    actividad: "ruleta",
    cupon: { texto: "Muestra gratis con tu pedido", costo: 30 }, sorteo: "Set completo de cuidado",
    anuncio: "Cuidado diario con cáñamo",
    cats: [
      { nombre: "Cremas", items: ["Crema facial", "Crema de manos", "Crema corporal"], variantes: ["50 ml", "100 ml"], icono: "🧴", precio: [12, 35] },
      { nombre: "Jabones", items: ["Jabón Lavanda", "Jabón Avena", "Jabón Cítrico"], variantes: ["barra", "líquido"], icono: "🧼", precio: [6, 14] },
      { nombre: "Bálsamos", items: ["Bálsamo labial", "Bálsamo de barba"], variantes: ["única"], icono: "💄", precio: [5, 18] },
    ],
  },
  {
    id: "nativa", nombre: "Nativa Hemp", pab: "canamo", pais: "US", color: "#b6e36b", color2: "#2f4a10", icono: "🌾", sigla: "NH",
    lema: "Alimentos de semilla de cáñamo",
    desc: "Semilla pelada, proteína y aceite de semilla de cáñamo para cocinar.",
    actividad: "quiz",
    cupon: { texto: "US$ 10 en tu primera compra", costo: 55 }, sorteo: "Despensa Nativa por un mes",
    anuncio: "Proteína vegetal de cáñamo",
    cats: [
      { nombre: "Despensa", items: ["Semilla pelada", "Proteína en polvo", "Harina de cáñamo"], variantes: ["250 g", "500 g", "1 kg"], icono: "🥣", precio: [8, 40] },
      { nombre: "Aceites", items: ["Aceite de semilla", "Aceite con ajo"], variantes: ["250 ml", "500 ml"], icono: "🫒", precio: [10, 25] },
      { nombre: "Snacks", items: ["Barra Cacao", "Barra Maní", "Granola"], variantes: ["x1", "x6", "x12"], icono: "🍫", precio: [2, 30] },
    ],
  },
  {
    id: "lumen", nivel: "isla", angulo: 0, nombre: "LumenGrow", pab: "cultivo", pais: "US", color: "#6ff0ff", color2: "#0c3d5a", icono: "💡", sigla: "LG",
    lema: "Iluminación LED de espectro completo",
    desc: "Lámparas LED eficientes para cultivo interior. Hasta 40% menos consumo.",
    actividad: "quiz",
    cupon: { texto: "8% en lámparas Pro", costo: 80 }, sorteo: "Lámpara Lumen 300",
    anuncio: "40% menos consumo",
    cats: [
      { nombre: "Lámparas LED", items: ["Lumen 100", "Lumen 200", "Lumen 300", "Lumen 600 Pro"], variantes: ["estándar", "con controlador"], icono: "💡", precio: [90, 780] },
      { nombre: "Controladores", items: ["Temporizador", "Dimmer", "Controlador Wi-Fi"], variantes: ["única"], icono: "🎛️", precio: [15, 120] },
      { nombre: "Carpas", items: ["Carpa 60", "Carpa 80", "Carpa 120"], variantes: ["altura 160", "altura 200"], icono: "⛺", precio: [70, 260] },
    ],
  },
  {
    id: "tierra", nombre: "Tierra Madre", pab: "cultivo", pais: "MX", color: "#ff9a76", color2: "#5a2a10", icono: "🪴", sigla: "TM",
    lema: "Sustratos orgánicos",
    desc: "Sustratos, compostas y fertilizantes orgánicos para jardinería y cultivo.",
    actividad: "rasca",
    cupon: { texto: "Saco extra en pedidos de 3", costo: 45 }, sorteo: "Kit de huerto en casa",
    anuncio: "Lo orgánico se nota",
    cats: [
      { nombre: "Sustratos", items: ["Sustrato Universal", "Mezcla Light", "Fibra de coco"], variantes: ["10 L", "25 L", "50 L"], icono: "🟤", precio: [6, 40] },
      { nombre: "Fertilizantes", items: ["Humus de lombriz", "Té de compost", "Guano"], variantes: ["1 kg", "5 kg"], icono: "🪱", precio: [5, 35] },
      { nombre: "Macetas", items: ["Maceta de tela", "Maceta de barro"], variantes: ["10 L", "20 L", "40 L"], icono: "🪴", precio: [3, 25] },
    ],
  },
  {
    id: "aqua", nivel: "premium", nombre: "AquaRaíz", pab: "cultivo", pais: "CL", color: "#7fc8ff", color2: "#103a5a", icono: "💧", sigla: "AR",
    lema: "Riego e hidroponía",
    desc: "Sistemas de riego por goteo e hidroponía para casa y profesionales.",
    actividad: "ruleta",
    cupon: { texto: "Instalación gratis en Santiago", costo: 75 }, sorteo: "Sistema hidropónico de 12 plantas",
    anuncio: "Riega sin pensar",
    cats: [
      { nombre: "Hidroponía", items: ["Sistema DWC", "Torre vertical", "Mesa NFT"], variantes: ["6 plantas", "12 plantas", "24 plantas"], icono: "💧", precio: [80, 600] },
      { nombre: "Riego", items: ["Kit de goteo", "Bomba", "Programador"], variantes: ["básico", "pro"], icono: "🚿", precio: [20, 150] },
      { nombre: "Medición", items: ["Medidor de pH", "Medidor EC", "Termohigrómetro"], variantes: ["única"], icono: "📟", precio: [12, 90] },
    ],
  },
];

// ---------- 38 marcas más, generadas (también ficticias) para llegar a 50 stands ----------
// Cada pabellón tiene 12 stands (1 premium + 11 normales). Las islas de marca van aparte.
const TIPOS = {
  semillas: { cat: "Semillas", icono: "🌱", precio: [22, 70], variantes: ["3 u.", "5 u.", "10 u."], items: null, lema: "Genética seleccionada", desc: "Banco de semillas con variedades registradas. Venta solo en países donde es legal." },
  molinos: { cat: "Grinders", icono: "⚙️", precio: [12, 80], variantes: ["chico", "mediano", "grande"], items: ["Grinder 2 piezas", "Grinder 4 piezas", "Grinder eléctrico", "Grinder de bolsillo"], lema: "Grinders de aluminio", desc: "Grinders de aluminio aeroespacial con garantía de por vida." },
  frascos: { cat: "Almacenamiento", icono: "🫙", precio: [6, 40], variantes: ["250 ml", "500 ml", "1 L"], items: ["Frasco hermético", "Frasco UV", "Set de frascos", "Bote con humedad"], lema: "Guarda todo fresco", desc: "Frascos herméticos y de vidrio UV." },
  encendedores: { cat: "Encendedores", icono: "🔥", precio: [3, 45], variantes: ["negro", "plata", "neón"], items: ["Encendedor recargable", "Encendedor de mesa", "Funda de encendedor"], lema: "Encendedores de diseño", desc: "Encendedores recargables y accesorios de diseño." },
  cajas: { cat: "Cajas", icono: "📦", precio: [15, 90], variantes: ["pino", "nogal", "bambú"], items: ["Caja de madera", "Caja con llave", "Organizador", "Charola con tapa"], lema: "Orden con estilo", desc: "Cajas y organizadores de madera hechos a mano." },
  basculas: { cat: "Básculas", icono: "⚖️", precio: [10, 120], variantes: ["0.01 g", "0.1 g"], items: ["Báscula de bolsillo", "Báscula de precisión", "Báscula de mesa", "Pesas de calibración"], lema: "Precisión en cada gramo", desc: "Básculas digitales de precisión." },
  bandejas: { cat: "Bandejas", icono: "🌈", precio: [8, 40], variantes: ["S", "M", "L"], items: ["Bandeja neón", "Bandeja con tapa", "Bandeja XL", "Bandeja con luz"], lema: "Bandejas que brillan", desc: "Bandejas de metal con diseños de artistas." },
  vidrio: { cat: "Vidrio", icono: "🧪", precio: [15, 200], variantes: ["14 mm", "18 mm"], items: ["Pipa de vidrio", "Bong recto", "Bowl", "Ash catcher"], lema: "Vidrio de borosilicato", desc: "Piezas de vidrio de borosilicato resistentes." },
  bolsos: { cat: "Bolsos", icono: "👝", precio: [15, 90], variantes: ["negro", "verde", "arena"], items: ["Bolso antiolor", "Mochila", "Riñonera", "Estuche"], lema: "Discreto y resistente", desc: "Bolsos con forro de carbón activado y cierre hermético." },
  pipas: { cat: "Pipas", icono: "🎨", precio: [12, 90], variantes: ["chica", "grande"], items: ["Pipa de madera", "Pipa de cerámica", "Pipa artesanal", "Pipa de piedra"], lema: "Piezas de autor", desc: "Pipas artesanales de madera y cerámica." },
  filtros: { cat: "Filtros", icono: "🔘", precio: [2, 25], variantes: ["x50", "x100", "x300"], items: ["Filtros de cartón", "Filtros de carbón", "Filtros de vidrio"], lema: "Filtros para todos", desc: "Filtros de cartón, carbón y vidrio." },
  construccion: { cat: "Construcción", icono: "🧱", precio: [5, 120], variantes: ["unidad", "caja"], items: ["Bloque de hempcrete", "Panel aislante", "Cal de cáñamo", "Mortero"], lema: "Construye con cáñamo", desc: "Materiales de construcción de cáñamo: ligeros, aislantes y sostenibles." },
  papel: { cat: "Papelería", icono: "📄", precio: [2, 30], variantes: ["chico", "grande"], items: ["Cuaderno", "Papel para impresora", "Sobres", "Cajas de cartón"], lema: "Papel sin talar árboles", desc: "Papel y empaques hechos con fibra de cáñamo." },
  textil: { cat: "Textiles", icono: "🧶", precio: [10, 80], variantes: ["S", "M", "L"], items: ["Suéter", "Calcetines", "Tela por metro", "Gorro"], lema: "Fibra natural que dura", desc: "Ropa y telas de fibra de cáñamo." },
  jabon: { cat: "Cuidado personal", icono: "🧼", precio: [4, 25], variantes: ["barra", "líquido"], items: ["Jabón de lavanda", "Shampoo sólido", "Crema de manos", "Desodorante"], lema: "Cosmética natural", desc: "Cosmética con aceite de semilla de cáñamo. No son medicamentos." },
  alimento: { cat: "Despensa", icono: "🥣", precio: [4, 35], variantes: ["250 g", "500 g", "1 kg"], items: ["Semilla pelada", "Proteína", "Harina", "Galletas"], lema: "Proteína vegetal", desc: "Alimentos con semilla de cáñamo." },
  bioplastico: { cat: "Bioplásticos", icono: "♻️", precio: [3, 30], variantes: ["x10", "x50"], items: ["Vasos", "Cubiertos", "Funda de celular", "Bolsas"], lema: "Plástico de planta", desc: "Bioplásticos compostables hechos con cáñamo." },
  mascota: { cat: "Mascotas", icono: "🐾", precio: [6, 60], variantes: ["S", "M", "L"], items: ["Collar de cáñamo", "Correa", "Cama", "Juguete de cuerda"], lema: "Para tu mejor amigo", desc: "Accesorios para mascotas con fibra de cáñamo." },
  aceite: { cat: "Aceites de cocina", icono: "🫒", precio: [6, 30], variantes: ["250 ml", "500 ml"], items: ["Aceite de semilla", "Aderezo", "Mantequilla de semilla"], lema: "Del campo a tu mesa", desc: "Aceite de semilla de cáñamo para cocinar." },
  calzado: { cat: "Calzado", icono: "👟", precio: [40, 120], variantes: ["25", "26", "27"], items: ["Tenis", "Sandalias", "Botas"], lema: "Camina ligero", desc: "Calzado con lona de cáñamo." },
  macetas: { cat: "Macetas", icono: "🪴", precio: [3, 40], variantes: ["10 L", "20 L", "40 L"], items: ["Maceta de tela", "Maceta de barro", "Maceta autorriego"], lema: "Raíces felices", desc: "Macetas de tela, barro y autorriego." },
  clima: { cat: "Clima", icono: "🌀", precio: [20, 250], variantes: ["10 cm", "15 cm", "20 cm"], items: ["Extractor", "Ventilador", "Filtro de carbón", "Ducto"], lema: "Aire fresco siempre", desc: "Extracción y ventilación para cultivo interior." },
  riego: { cat: "Riego", icono: "🚿", precio: [10, 150], variantes: ["básico", "pro"], items: ["Kit de goteo", "Bomba", "Programador", "Manguera"], lema: "Agua justa", desc: "Riego por goteo y programadores." },
  luz: { cat: "Iluminación", icono: "☀️", precio: [40, 600], variantes: ["100 W", "300 W", "600 W"], items: ["Panel LED", "Barra LED", "Reflector"], lema: "Luz que rinde", desc: "Iluminación LED eficiente." },
  abono: { cat: "Fertilizantes", icono: "🪱", precio: [5, 40], variantes: ["1 kg", "5 kg"], items: ["Humus", "Composta", "Té de compost", "Micorrizas"], lema: "Suelo vivo", desc: "Fertilizantes orgánicos." },
  hidro: { cat: "Hidroponía", icono: "🧪", precio: [30, 400], variantes: ["6 plantas", "12 plantas"], items: ["Sistema DWC", "Torre vertical", "Bomba de aire"], lema: "Cultivo sin tierra", desc: "Sistemas hidropónicos para casa." },
  carpas: { cat: "Carpas", icono: "⛺", precio: [60, 300], variantes: ["60 cm", "80 cm", "120 cm"], items: ["Carpa", "Carpa con ventana", "Kit completo"], lema: "Tu espacio de cultivo", desc: "Carpas de cultivo reflectantes." },
  sensores: { cat: "Sensores", icono: "📟", precio: [10, 120], variantes: ["única"], items: ["Medidor de pH", "Medidor EC", "Termohigrómetro", "Sensor Wi-Fi"], lema: "Mide, no adivines", desc: "Sensores y medidores para cultivo." },
  semilleros: { cat: "Semilleros", icono: "🌱", precio: [3, 40], variantes: ["12", "24", "72"], items: ["Charola", "Domo", "Tapete térmico", "Pastillas de turba"], lema: "Todo empieza aquí", desc: "Charolas, domos y accesorios para germinar." },
  herramientas: { cat: "Herramientas", icono: "✂️", precio: [5, 60], variantes: ["única"], items: ["Tijeras de poda", "Guantes", "Lupa", "Delantal"], lema: "Herramienta fina", desc: "Herramientas de jardinería de precisión." },
};
const NUEVAS = {
  genetica: [["Pampa Genetics", "AR", "🌾", "semillas"], ["Bosque Seeds", "CL", "🌲", "semillas"], ["Origen Banco", "UY", "🧬", "semillas"], ["Sol de Montaña", "CO", "⛰️", "semillas"], ["Hoja Alta", "ES", "🍃", "semillas"], ["Raíz Pura", "US", "🌱", "semillas"], ["Valle Verde Seeds", "CL", "🏞️", "semillas"], ["Cumbre Andina", "AR", "🌄", "semillas"], ["Brote Lab", "ES", "🔬", "semillas"]],
  accesorios: [["Molino Andino", "AR", "⚙️", "molinos"], ["Frasco Fresco", "UY", "🫙", "frascos"], ["Chispa Lighters", "CO", "🔥", "encendedores"], ["Caja Zen", "ES", "📦", "cajas"], ["Báscula Fina", "CL", "⚖️", "basculas"], ["Neón Rolling", "US", "🌈", "bandejas"], ["Vidrio Sur", "AR", "🧪", "vidrio"], ["Bolso Discreto", "MX", "👝", "bolsos"], ["Pipa Arte", "CO", "🎨", "pipas"], ["Filtro Puro", "US", "🔘", "filtros"]],
  canamo: [["Cáñamo Vivo", "ES", "🧱", "construccion"], ["Papel Verde", "CL", "📄", "papel"], ["Hilo Natural", "AR", "🧶", "textil"], ["Jabón de Monte", "CO", "🧼", "jabon"], ["Semilla Nutri", "UY", "🥣", "alimento"], ["Bioplast Hemp", "US", "♻️", "bioplastico"], ["Huellita Hemp", "MX", "🐾", "mascota"], ["Aceite Andino", "CL", "🫒", "aceite"], ["Calzado Raíz", "ES", "👟", "calzado"]],
  cultivo: [["Maceta Viva", "MX", "🪴", "macetas"], ["Clima Grow", "US", "🌀", "clima"], ["Riego Sur", "AR", "🚿", "riego"], ["Luz Solar Pro", "CL", "☀️", "luz"], ["Abono Andino", "CO", "🪱", "abono"], ["Hidro Lab", "ES", "🧪", "hidro"], ["Carpa Max", "US", "⛺", "carpas"], ["Sensor Verde", "UY", "📟", "sensores"], ["Semillero Pro", "CL", "🌱", "semilleros"], ["Poda Fina", "AR", "✂️", "herramientas"]],
};
const PALETA = [["#7dffb3", "#0f5d43"], ["#ff9ae6", "#5a1149"], ["#8ff0ff", "#0c4b5a"], ["#ffd76a", "#5a4310"], ["#c9a2ff", "#2e1660"], ["#ff9a76", "#5a2a10"], ["#b6e36b", "#2f4a10"], ["#7fc8ff", "#103a5a"], ["#ff7a9c", "#5a1028"], ["#9be3d0", "#10443a"], ["#f2a2ff", "#4a1650"], ["#ffe08a", "#4a3a08"]];
const CUPONES = ["10% en tu primera compra", "Envío gratis", "2x1 en accesorios", "Regalo con tu pedido", "15% en kits", "20% en tu segunda compra", "Muestra gratis"];
const CEPAS_A = ["Luna", "Brisa", "Cumbre", "Selva", "Nieve", "Río", "Cielo", "Lima", "Menta", "Cacao", "Ámbar", "Coral"];
const CEPAS_B = ["Kush", "Haze", "Dream", "Gold", "Express", "Dulce", "Mística", "Real"];
let semillaGen = 7;
const azar = () => { semillaGen = (semillaGen * 9301 + 49297) % 233280; return semillaGen / 233280; };
const tomar = (a) => a[Math.floor(azar() * a.length)];
const GENERADAS = [];
Object.entries(NUEVAS).forEach(([pab, lista]) => lista.forEach(([nombre, pais, icono, tipo]) => {
  const T = TIPOS[tipo], [color, color2] = PALETA[(GENERADAS.length * 5) % PALETA.length];
  const items = T.items || [...new Set(Array.from({ length: 6 }, () => `${tomar(CEPAS_A)} ${tomar(CEPAS_B)}`))].slice(0, 5);
  const sigla = nombre.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  GENERADAS.push({
    id: nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    nombre, pab, pais, color, color2, icono, sigla,
    lema: T.lema, desc: T.desc, anuncio: T.lema,
    actividad: ["ruleta", "quiz", "rasca"][GENERADAS.length % 3],
    cupon: { texto: tomar(CUPONES), costo: 30 + Math.floor(azar() * 12) * 5 }, sorteo: `Kit de ${nombre}`,
    cats: [
      { nombre: T.cat, items, variantes: T.variantes, icono: T.icono, precio: T.precio },
      { nombre: "Kits", items: ["Kit de inicio", "Kit completo"], variantes: ["única"], icono: "🎁", precio: [T.precio[0] * 2, Math.round(T.precio[1] * 1.5)] },
      { nombre: "Merch", items: ["Gorra", "Playera"], variantes: ["S", "M", "L"], icono: "🧢", precio: [12, 30] },
    ],
  });
}));
export const MARCAS_BASE = [...MARCAS_MANO, ...GENERADAS];

// Videos de cada marca: 1 en stand normal, 3 en premium, 4 en isla (en la versión real los sube la marca)
export function videosDe(m) {
  const v = [{ id: m.id, titulo: `Conoce ${m.nombre}`, icono: m.icono }];
  if (m.nivel === "premium" || m.nivel === "isla") v.push({ id: `${m.id}#2`, titulo: "Así se hace", icono: "🎬" }, { id: `${m.id}#3`, titulo: "Producto estrella", icono: "⭐" });
  if (m.nivel === "isla") v.push({ id: `${m.id}#4`, titulo: "Detrás de cámaras", icono: "🎥" });
  return v;
}
export const NIVELES = { stand: "Stand", premium: "Stand premium", isla: "Casa de marca" };

// Arma el catálogo completo de una marca (base × variantes + productos que la marca agregó en su panel)
export function catalogo(m) {
  const lista = [];
  let n = 0;
  (m.cats || []).forEach((c) => {
    c.items.forEach((it, i) => {
      c.variantes.forEach((v, j) => {
        const k = (i * 7 + j * 3 + n) % 10;
        const precio = Math.round(c.precio[0] + ((c.precio[1] - c.precio[0]) * ((i + j * 0.6) % (c.items.length + 1))) / (c.items.length + 1));
        lista.push({
          id: `${m.id}-${n++}`, nombre: v === "única" ? it : `${it} · ${v}`, cat: c.nombre, icono: c.icono,
          precio: `US$ ${precio}`, nuevo: k === 0, destacado: j === 0 && i < 2,
          desc: `${it} de ${m.nombre}. ${m.pab === "genetica" ? "Venta solo donde la ley lo permite. " : ""}Precio de referencia; consulta disponibilidad en la tienda de la marca.`,
        });
      });
    });
  });
  (m.extra || []).forEach((p, i) => lista.unshift({ id: `${m.id}-x${i}`, nuevo: true, destacado: true, icono: "⭐", ...p }));
  return lista;
}

// Preguntas del quiz de cada marca (se arman con sus datos) + preguntas generales
export function preguntasMarca(m) {
  const otros = MARCAS_BASE.filter((o) => o.id !== m.id);
  const pais = nombrePais(m.pais);
  const paisOtro = [...new Set(otros.map((o) => nombrePais(o.pais)).filter((p) => p !== pais))];
  const mezclar = (a) => a.sort(() => Math.random() - 0.5);
  const q1ops = mezclar([pais, paisOtro[0], paisOtro[1]]);
  const q2ops = mezclar([m.lema, otros[3].lema, otros[7].lema]);
  const gen = GENERALES[Math.floor(Math.random() * GENERALES.length)];
  return [
    { p: `¿De qué país es ${m.nombre}?`, ops: q1ops, ok: q1ops.indexOf(pais) },
    { p: `¿Cuál es el lema de ${m.nombre}?`, ops: q2ops, ok: q2ops.indexOf(m.lema) },
    gen,
  ];
}
const GENERALES = [
  { p: "¿Qué se puede hacer con fibra de cáñamo?", ops: ["Solo cuerdas", "Telas, papel y materiales de construcción", "Nada útil"], ok: 1 },
  { p: "En Estados Unidos, ¿desde qué edad se entra a Weedland?", ops: ["18 años", "21 años", "16 años"], ok: 1 },
  { p: "¿Dónde se puede vender semilla de cannabis?", ops: ["En cualquier país", "Solo donde la ley lo permite", "En ningún lado"], ok: 1 },
];

// ---------- Universidad ----------
export const CLASES = [
  {
    id: "canamo", icono: "🌾", polen: 20, titulo: "El cáñamo: una planta, mil usos",
    pasos: ["Del tallo sale la fibra: telas, cuerdas y papel.", "De la semilla sale alimento y aceite para cocinar.", "Mezclado con cal, el tallo sirve para bloques de construcción ligeros."],
    pregunta: { p: "¿Cuál de estas cosas se puede hacer con cáñamo?", ops: ["Solo cuerdas", "Telas, papel y bloques", "Nada útil"], ok: 1 },
  },
  {
    id: "riesgos", icono: "⚖️", polen: 20, titulo: "Beneficios y riesgos, a la misma altura",
    pasos: ["Los efectos cambian mucho de una persona a otra: infórmate antes.", "No manejes ni operes máquinas después de consumir.", "Mezclar con alcohol aumenta los riesgos. En embarazo y lactancia, evítalo.", "Si tomas medicamentos, consulta a un profesional de salud."],
    pregunta: { p: "¿Qué pasa al mezclar con alcohol?", ops: ["Nada", "Aumentan los riesgos", "Se cancelan los efectos"], ok: 1 },
  },
  {
    id: "etiqueta", icono: "🏷️", polen: 20, titulo: "Cómo leer una etiqueta",
    pasos: ["Busca el nombre del fabricante y su país.", "Revisa lote, fecha y registro sanitario cuando aplica.", "Desconfía de productos que prometen curar enfermedades."],
    pregunta: { p: "Un producto que promete curar todo es…", ops: ["Confiable", "Una señal de alerta", "Obligatorio"], ok: 1 },
  },
  {
    id: "leyes", icono: "🌎", polen: 20, titulo: "Las leyes cambian según el país",
    pasos: ["Cada país (y a veces cada estado) tiene reglas distintas.", "Lo que es legal en un lugar puede no serlo en otro, aunque lo compres en línea.", "Antes de viajar o comprar, revisa la ley de tu lugar."],
    pregunta: { p: "Si algo es legal en otro país, en el tuyo…", ops: ["También lo es", "Hay que revisar la ley local", "Da igual"], ok: 1 },
  },
];
export const TALLERES = [
  { id: "t-luz", marca: "lumen", titulo: "Cómo elegir tu iluminación", dur: "8 min", icono: "💡" },
  { id: "t-tela", marca: "telaverde", titulo: "De la planta a la playera", dur: "6 min", icono: "👕" },
  { id: "t-vidrio", marca: "kaleido", titulo: "Así se sopla una pieza de vidrio", dur: "10 min", icono: "🔥" },
  { id: "t-sustrato", marca: "tierra", titulo: "Sustrato vivo en casa", dur: "7 min", icono: "🪱" },
  { id: "t-cocina", marca: "nativa", titulo: "Cocina con semilla de cáñamo", dur: "9 min", icono: "🥣" },
];
export const CONFERENCIAS = [
  { id: "c1", fecha: "Jue 20 nov · 19:00", titulo: "El mapa legal de América Latina", ponente: "Panel de abogados (ejemplo)" },
  { id: "c2", fecha: "Sáb 22 nov · 17:00", titulo: "Cáñamo industrial: la oportunidad", ponente: "Invitada especial (ejemplo)" },
  { id: "c3", fecha: "Mar 25 nov · 20:00", titulo: "Marcas que cuidan a su comunidad", ponente: "Mesa de marcas (ejemplo)" },
];

// Regalo diario (racha de 7 días)
export const PREMIO_DIA = [10, 10, 15, 15, 20, 25, 40];
