# EroMe — plugin para Kino

Plugin de [Kino](https://github.com/kinotvapp/kino-light) que trae los vídeos públicos de
[es.erome.com](https://es.erome.com) a la app: filas en el Inicio, búsqueda, "Ver más" paginado,
álbumes con varios vídeos como series, y cada título con sus **etiquetas**, categoría, autor y visitas.

No es un addon de Kodi. Es un plugin de Kino (`kino-plugin.json` + `plugin.js`, JavaScript en el
sandbox QuickJS de la app).

---

## Qué muestra

| Dónde | Qué sale |
|---|---|
| **Inicio** | 9 filas: Populares, Nuevos, Hetero, Trans, Gay, Hentai, Latinas, MILF, Amateur |
| **Buscar** | La búsqueda real del sitio (`/search?q=…`), con páginas siguientes |
| **Ver más** | Cada fila pagina de verdad: 36 álbumes por página |
| **Título** | Álbum de 1 vídeo → película. Álbum de varios → serie, cada vídeo es un capítulo |
| **Sinopsis** | `Autor: … · 36 mil visitas · 3 vídeos · Etiquetas: Latinas, Culonas, Anal` |
| **Etiquetas** | En `genres` (chips de la app) y dentro de la sinopsis si lo dejas activado |

Las etiquetas salen de dos sitios, porque EroMe **no** publica un endpoint de etiquetas
(`/tag/algo` devuelve 404):

1. **Taxonomía del sitio** — orientación (`/version/straight|trans|gay|hentai`) y la propia
   búsqueda (`/search?q=`), que es la que alimenta las filas de Latinas, MILF, Amateur.
2. **Coincidencias en el título del álbum** — un vocabulario de 44 etiquetas (Lesbianas, Anal,
   Tríos, Creampie, Rubias, Morenas, Pelirrojas, Latinas, Asiáticas, Ebony, Tetas grandes, Culonas,
   Amateur, Webcam, Público, BDSM, Pies, Cosplay, Interracial, Vintage, Compilación, Hentai, Gay,
   Trans, Españolas, Rusas, Japonesas, Alemanas, Francesas, Italianas, Mexicanas, Colombianas,
   Argentinas, Brasileñas, Venezolanas, 4K, …). Se compara contra el título en minúsculas; una
   etiqueta por título, máximo 8.

Eso significa que un vídeo sin palabras clave en el título puede salir sin etiquetas. Es el límite
real del sitio, no del plugin.

---

## Requisitos

- **Kino 0.9.54 o superior** (el manifiesto usa `apiVersion: 8` para tener `adult: true` y el
  export `details`). En una versión más vieja Kino lo rechaza con "This plugin needs a newer version
  of Kino".
- Desbloquear el **código 18+** en Kino o el plugin se ve vacío (ver abajo).

---

## Instalación

### 1. Publicar el repo en GitHub

El repo tiene que ser **público** y la raíz tiene que contener `kino-plugin.json`. Desde esta carpeta:

```bash
git init
git add .
git commit -m "EroMe plugin para Kino 1.0.0"
git branch -M main
gh repo create erome-kino --public --source=. --remote=origin --push
```

Sin `gh`:

```bash
git remote add origin https://github.com/TU-USUARIO/erome-kino.git
git push -u origin main
```

### 2. Instalarlo en Kino

En el móvil o en la TV:

1. **Ajustes ▸ Plugins ▸ Agregar**.
2. Escribe `TU-USUARIO/erome-kino` (o pega
   `https://raw.githubusercontent.com/TU-USUARIO/erome-kino/main/kino-plugin.json`).
3. Kino enseña la hoja de permisos. Acepta. Pide:
   - `erome.com` y `*.erome.com` (el sitio y las CDN `v78.erome.com`, `s1.erome.com`, …)
   - Descargar vídeos para verlos sin conexión.
4. **Ajustes ▸ Control parental** → desbloquear el código 18+.

Sin el paso 4 todas las filas salen vacías: cada título va marcado `adult: true` y Kino los
esconde mientras el código esté bloqueado. No es un fallo del plugin.

### 3. Ajustes del plugin

**Ajustes ▸ EroMe** (o **Plugins ▸ Configurar**):

- **Dominio** — `es.erome.com` (por defecto) o `www.erome.com`.
- **Etiquetas en la sinopsis** — activado por defecto. Apágalo si prefieres la sinopsis limpia
  (las etiquetas siguen en `genres`).

---

## Estructura

```
kino-plugin-erome/
├── kino-plugin.json   # manifiesto: id erome, apiVersion 8, hosts, capabilities, settings
├── plugin.js          # todo el plugin (~23 KB): HTTP, parsers, home, browse, episodes, details, resolve, search
├── icon.png           # 256×256
├── sdk/               # kit de pruebas de Kino (validate.mjs, run.mjs)
├── contract.json      # constantes del contrato que lee el kit
└── kino.d.ts          # tipados
```

`entry` es `plugin.js`, sin `./`. Kino carga **un solo archivo**: no hay imports, ni `require`, ni
`fetch`. La red va por `kino.fetch`, limitada a los `hosts` del manifiesto.

### Referencias internas

| Ref | Significado |
|---|---|
| `m:<albumId>:0` | álbum de un solo vídeo |
| `s:<albumId>` | álbum con varios vídeos |
| `e:<albumId>:<n>` | vídeo `n` (base 0) de ese álbum |

`browse` recibe la URL absoluta del listado y un cursor que es el número de página.

### Streams

`resolve` devuelve el MP4 de mejor calidad del álbum (`res=` más alto entre las `<source>`) con
`Referer: https://es.erome.com/` y el User-Agent del navegador, porque EroMe pide no hacer hotlink.
Comprobado en vivo: `200`, `video/mp4`, 158 MB.

---

## Probar antes de publicar

```bash
node sdk/validate.mjs .
node sdk/run.mjs ./plugin.js home
node sdk/run.mjs ./plugin.js search "latina"
node sdk/run.mjs ./plugin.js browse "https://es.erome.com/explore" 2
node sdk/run.mjs ./plugin.js episodes "s:ALBUMID"
node sdk/run.mjs ./plugin.js resolve "e:ALBUMID:0"
```

`validate.mjs` tiene que terminar en `✓ Kino would accept this plugin`.

---

## Límites conocidos

- **Sin `/tag/`**: el sitio no tiene endpoint de etiquetas; ver arriba cómo se derivan.
- **Álbumes de solo fotos** se descartan: la rejilla los marca con `album-images` y sin
  `album-videos`, y no hay nada que reproducir.
- **Recuento de vídeos desconocido** → se trata como 1 vídeo (película). Si el álbum resulta tener
  varios, `episodes` los lista igual porque se releen de la página del álbum.
- **Caché en memoria**: hasta 30 álbumes por sesión del plugin. Cada llamada a Kino es un proceso
  nuevo, así que la caché solo ahorra dentro de una misma llamada.
- **Dominio**: si EroMe cambia de espejo, cámbialo en Ajustes sin tocar el código.
- **18+**: contenido para adultos entre adultos. El plugin solo indexa lo que el sitio sirve en
  público.

---

## Licencia

Uso personal. El contenido es de EroMe y de quien lo sube; el plugin solo lo indexa.
