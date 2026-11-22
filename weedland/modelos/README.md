# Modelos 3D de Weedland (GLB de Meshy)

1. Copia el `.glb` que bajaste de Meshy a esta carpeta con el nombre de la tabla.
2. Agrégalo en `modelos.json`. Ejemplo:

```json
{
  "avatar-hombre": { "archivo": "avatar-hombre.glb" },
  "anfitrion":     { "archivo": "anfitrion.glb" },
  "banca":         { "archivo": "banca.glb", "colocar": [[12, 20, 90], [-12, 20, -90]] }
}
```

3. Recarga `/weedland/`. Si un modelo no está en la lista, se ve la figura de siempre.

Opciones de cada modelo: `alto` (metros), `ancho` (metros; se usa en lugar de `alto`), `giro` (grados, por si el modelo viene viendo hacia otro lado; el frente debe mirar a +Z) y `colocar` (lista de `[x, z, giro]` para ponerlo suelto en el mundo, con obstáculo para caminar). Si no pones `alto` o `ancho`, se usa el de la tabla.

| id | Qué reemplaza | Medida que usa | Animaciones |
|---|---|---|---|
| `personaje1` … `personaje6` | Los que eliges en la entrada y la gente de la hacienda (sin repetir el tuyo). `genero` (mujer/hombre) y `foto` (en `fotos/`, 360×480) en el json | alto del json (~2.05, a escala de los stands) | quieto (Idle), caminar (Walk), platicar (Talk), bailar (Dance) |
| `avatar-hombre` | Tu avatar (y los bots si faltan los personajes) | alto 1.8 | caminar, quieto |
| `avatar-mujer` | Tu avatar si `ws-avatar` = `mujer` (y la otra mitad de los bots) | alto 1.8 | caminar, quieto |
| `anfitrion` | Anfitriones de stands, casas, mercado y tienda | alto 1.85 | quieto, saludar |
| `maceta-agave` | Macetas a los lados de cada stand | alto 1.5 | |
| `fuente` | Fuente del patio | ancho 7.4 | |
| `palma` | Todas las palmas (instanciadas: sin esqueleto) | alto de cada palma | |
| `farol` | Linterna arriba de cada poste | alto 0.75 | |
| `globo` | Globo aerostático del paseo | alto 10.3 | |
| `dron` | Cuerpo de los drones (el banner de la marca se queda) | ancho 2.4 | |
| `palapa-camastro` | Palapas de los jardines | ancho 6 | |
| cualquier otro | Se pone con `colocar` (bancas, etc.) | `alto` del json | |

Animaciones: se buscan por nombre del clip (`walk`/`caminar`, `idle`/`quieto`, `wave`/`saludar`, `talk`/`platicar`, `dance`/`bailar`). En Meshy: **Rig → Animate**, exporta GLB con esas animaciones.

Pendiente (las pantallas están medidas en código): stands, stand premium, casa de marca, templete, portal de arcos, invernadero y botica. Primero hay que ajustar las pantallas a cada modelo.

Peso recomendado: personajes ≤ 15k triángulos, objetos ≤ 3k, y GLB de menos de 5 MB (mejor < 2 MB para celular).

Los personajes vienen de Meshy a ~100k triángulos y texturas de hasta 8192 px (30 MB en total). Se aligeraron a 18k–42k triángulos, texturas de 1024 px y animación a 15 cuadros por segundo (12 MB en total). Si mandas nuevos, hay que aligerarlos igual antes de ponerlos aquí.
