// Kino plugin — EroMe (es.erome.com)
// language: JavaScript (ES module), runtime: Kino QuickJS sandbox, apiVersion 8
//
// Kino loads exactly one file: this one. No imports, no require, no fetch —
// network goes through kino.fetch and is limited to the manifest's hosts
// (erome.com + *.erome.com, which covers the v*/s* media CDNs).
//
// EroMe has no public API and no /tag/ endpoint: the grid and the album pages
// are server-rendered HTML, so everything below is a scrape with a handful of
// regexes. Tags come from the site's own taxonomy (orientation, search) plus
// keyword matching on each album title.

const DEFAULT_DOMAIN = "es.erome.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
function domain() {
  const raw = String(kino.config.get("domain") || DEFAULT_DOMAIN).trim();
  return (raw || DEFAULT_DOMAIN).replace(/^https?:\/\//i, "").replace(/\/+$/, "") || DEFAULT_DOMAIN;
}

function site() {
  return "https://" + domain();
}

function showTags() {
  return kino.config.get("showTags") !== false;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
async function getHtml(url) {
  const r = await kino.fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      Referer: site() + "/explore",
    },
    // Sin cookies a propósito: al pasar por /version/straight el sitio deja una
    // cookie `erome_version` que recorta la búsqueda a un puñado de resultados
    // (36 → 1 en "petera"). Sin ella el sitio devuelve la página completa.
    cookies: false,
    timeoutMs: 15000,
  });
  if (!r.ok) throw kino.error("unavailable", "erome respondió " + r.status);
  return r.text();
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------
function unescapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

function stripTags(value) {
  return unescapeHtml(String(value == null ? "" : value).replace(/<[^>]*>/g, " "));
}

function squash(value) {
  return stripTags(value).replace(/\s+/g, " ").trim();
}

function cleanTitle(value) {
  let title = squash(value);
  title = title.replace(/\s*#[A-Za-z0-9]{5,}\s*$/, "").trim();
  return title.slice(0, 200) || "Sin título";
}

function parseCount(value) {
  const text = String(value == null ? "" : value)
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .trim();
  const m = /([\d.,]+)\s*(mil|k|m)?/.exec(text);
  if (!m) return 0;
  let n = Number(m[1].replace(/\./g, "").replace(",", "."));
  if (!isFinite(n) || n < 0) return 0;
  if (m[2] === "mil" || m[2] === "k") n *= 1000;
  else if (m[2] === "m") n *= 1000000;
  return Math.round(n);
}

function formatCount(n) {
  const value = Number(n) || 0;
  if (value >= 1000000) return (Math.round(value / 100000) / 10) + " M";
  if (value >= 10000) return Math.round(value / 1000) + " mil";
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseDuration(text) {
  const parts = String(text == null ? "" : text).trim().split(":");
  if (parts.length < 2 || parts.length > 3) return 0;
  let seconds = 0;
  for (let i = 0; i < parts.length; i++) {
    const n = Number(parts[i]);
    if (!isFinite(n)) return 0;
    seconds = seconds * 60 + n;
  }
  return seconds;
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------
// Cada etiqueta es un nombre legible + la búsqueda real del sitio (`query`) +
// los trozos de título que la activan (`match`). EroMe no publica un endpoint
// de etiquetas, así que esta es la taxonomía que el plugin puede sostener.
const TAGS = {
  Lesbianas: { query: "lesbian", match: ["lesbian", "lesbi", "lésbic", "lesbic"] },
  MILF: { query: "milf", match: ["milf", "madura"] },
  Maduras: { query: "mature", match: ["mature", "madura", "señora"] },
  Anal: { query: "anal", match: ["anal", "culo abierto"] },
  "Doble penetración": { query: "double penetration", match: ["double penetration", "doble penetra", "dp ", "dap "] },
  Tríos: { query: "threesome", match: ["threesome", "3some", "trio", "trío", "tríos"] },
  Gangbang: { query: "gangbang", match: ["gangbang", "gang bang", "bukake", "bukkake"] },
  Creampie: { query: "creampie", match: ["creampie", "cream pie", "cum inside", "adentro"] },
  Facial: { query: "facial", match: ["facial", "corrida en la cara"] },
  Squirt: { query: "squirt", match: ["squirt"] },
  Rubias: { query: "blonde", match: ["blonde", "rubia", "rubio"] },
  Morenas: { query: "brunette", match: ["brunette", "morena", "moreno"] },
  Pelirrojas: { query: "redhead", match: ["redhead", "pelirroja", "pelirrojo"] },
  Latinas: { query: "latina", match: ["latina", "latino", "latinoamericana"] },
  Asiáticas: { query: "asian", match: ["asian", "asiatic", "japanese", "chinese", "korean", "thai", "japonesa", "china"] },
  Ebony: { query: "ebony", match: ["ebony", "black girl", "negra", "negro"] },
  "Teen 18+": { query: "teen", match: ["teen", "18yo", "18 yo", "18 añ", "adolescente"] },
  "Tetas grandes": { query: "big tits", match: ["big tits", "bigtit", "tetas", "tits", "tetona"] },
  Culonas: { query: "big ass", match: ["big ass", "bigass", "culona", "pawg", "culo grande"] },
  Amateur: { query: "amateur", match: ["amateur", "casero", "homemade", "aficionad"] },
  Webcam: { query: "webcam", match: ["webcam", "camgirl", "onlyfans", "live privado", "privado"] },
  Público: { query: "public", match: ["public", "outdoor", "playa", "beach", "calle", "parque"] },
  BDSM: { query: "bdsm", match: ["bdsm", "bondage", "dominatrix", "sumisa", "esclava"] },
  Fetichismo: { query: "fetish", match: ["fetish", "fetiche", "fetiche"] },
  Pies: { query: "feet", match: ["feet", "foot", "pies", "footjob"] },
  Cosplay: { query: "cosplay", match: ["cosplay", "uniforme"] },
  Interracial: { query: "interracial", match: ["interracial", "bbc", "interracial"] },
  Vintage: { query: "vintage", match: ["vintage", "retro", "clásico"] },
  Compilación: { query: "compilation", match: ["compilation", "compilacion", "compilación", "recopilación"] },
  Hentai: { query: "hentai", match: ["hentai", "anime", "dibujo"] },
  Gay: { query: "gay", match: ["gay", "twink", "chico con chico"] },
  Trans: { query: "trans", match: ["trans", "shemale", "tgirl", "travesti", "transgénero"] },
  Españolas: { query: "spanish", match: ["spanish", "español", "espanola", "española", "castellano"] },
  Rusas: { query: "russian", match: ["russian", "rusa", "ruso"] },
  Japonesas: { query: "japanese", match: ["japanese", "japonesa", "japones"] },
  Alemanas: { query: "german", match: ["german", "alemana", "aleman"] },
  Francesas: { query: "french", match: ["french", "francesa", "frances"] },
  Italianas: { query: "italian", match: ["italian", "italiana", "italiano"] },
  Mexicanas: { query: "mexican", match: ["mexican", "mexicana", "mexicano"] },
  Colombianas: { query: "colombian", match: ["colombian", "colombiana", "colombiano"] },
  Argentinas: { query: "argentinian", match: ["argentinian", "argentina", "argentino"] },
  Brasileñas: { query: "brazilian", match: ["brazilian", "brasileña", "brasilena", "brasilera"] },
  Venezolanas: { query: "venezuelan", match: ["venezuelan", "venezolana", "venezolano"] },
  "4K": { query: "4k", match: ["4k", "uhd", "2160"] },
};

const CATEGORY_TAGS = {
  Todos: 1,
  Populares: 1,
  Nuevos: 1,
  Buscar: 1,
  Etiquetas: 1,
};

function extractTags(title, category) {
  const haystack = " " + String(title || "").toLowerCase() + " ";
  const found = [];
  const seen = new Set();
  for (const label of Object.keys(TAGS)) {
    const needles = TAGS[label].match;
    for (let i = 0; i < needles.length; i++) {
      if (haystack.indexOf(needles[i]) !== -1) {
        if (!seen.has(label)) {
          seen.add(label);
          found.push(label);
        }
        break;
      }
    }
  }
  const extra = String(category || "").trim();
  if (extra && !CATEGORY_TAGS[extra] && !seen.has(extra) && extra.length <= 30) {
    seen.add(extra);
    found.unshift(extra);
  }
  return found.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Sinopsis y distintivos
// ---------------------------------------------------------------------------
// La rejilla trae el número de vídeos; la página de álbum trae la lista. Ambas formas valen.
function countOf(value) {
  if (Array.isArray(value)) return value.length;
  const n = Number(value);
  return isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function overviewOf(album) {
  const parts = [];
  const videos = countOf(album.videos);
  const images = countOf(album.images);
  if (album.user) parts.push("Autor: " + album.user);
  if (album.views) parts.push(formatCount(album.views) + " visitas");
  if (videos) parts.push(videos + (videos === 1 ? " vídeo" : " vídeos"));
  if (images) parts.push(images + (images === 1 ? " imagen" : " imágenes"));
  if (showTags() && album.tags && album.tags.length) {
    parts.push("Etiquetas: " + album.tags.join(", "));
  }
  return parts.join(" · ").slice(0, 2000);
}

function badgesOf(category, videoCount) {
  const out = [];
  const label = String(category || "").trim();
  if (label && label.length <= 20 && !CATEGORY_TAGS[label]) out.push(label);
  if (videoCount > 1 && out.length < 3) out.push(videoCount + " vídeos");
  return out;
}

// ---------------------------------------------------------------------------
// Rejilla de álbumes
// ---------------------------------------------------------------------------
const CARD_RE = /<div class="col-lg-\d[^"]*album"[^>]*id="album-\d+"/g;

function itemFromCard(block, category) {
  const idMatch = /\/a\/([A-Za-z0-9]+)/.exec(block);
  if (!idMatch) return null;
  const id = idMatch[1];

  const hasVideoCount = /class="album-videos"/.test(block);
  const hasImageCount = /class="album-images"/.test(block);
  // Un álbum solo de fotos no se puede reproducir: fuera del catálogo de vídeo.
  if (!hasVideoCount && hasImageCount) return null;

  const videosMatch = /class="album-videos"[^>]*>[\s\S]*?<\/svg>\s*(\d+)/.exec(block);
  const videoCount = videosMatch ? Number(videosMatch[1]) : 1;

  const titleMatch = /class="album-title"[^>]*>([\s\S]*?)<\/a>/.exec(block);
  const title = cleanTitle(titleMatch ? titleMatch[1] : "");

  const userMatch = /class="album-user"[^>]*>([\s\S]*?)<\/span>/.exec(block);
  const user = userMatch ? squash(userMatch[1]) : "";

  let poster = "";
  const thumbMatch = /class="album-thumbnail[^"]*"[^>]*?\ssrc="([^"]+)"/.exec(block);
  if (thumbMatch) poster = unescapeHtml(thumbMatch[1]);
  if (!poster || poster.indexOf("data:") === 0) {
    const rotateMatch = /data-rotate-src="([^"]+)"/.exec(block);
    poster = rotateMatch ? unescapeHtml(rotateMatch[1]) : "";
  }

  const viewsMatch = /class="album-bottom-views"[^>]*>[\s\S]*?<\/svg>\s*([^<]*)</.exec(block);
  const views = viewsMatch ? parseCount(viewsMatch[1]) : 0;

  const tags = extractTags(title, category);
  const isSeries = videoCount > 1;

  return {
    id: id,
    ref: isSeries ? "s:" + id : "m:" + id + ":0",
    title: title,
    kind: isSeries ? "series" : "movie",
    poster: poster || undefined,
    overview: overviewOf({ user: user, views: views, videos: videoCount, tags: tags }),
    genres: tags.slice(0, 5),
    badges: badgesOf(category, videoCount),
    adult: true,
  };
}

function parseListing(html, category) {
  const starts = [];
  CARD_RE.lastIndex = 0;
  let m;
  while ((m = CARD_RE.exec(html)) !== null) starts.push(m.index);

  const items = [];
  const seen = new Set();
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : html.length;
    const item = itemFromCard(html.slice(starts[i], end), category);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

function lastPageOf(html, current) {
  let last = current;
  // El sitio escapa el separador en los enlaces: `?q=x&amp;page=7`. Sin desescapar
  // solo coincide el `rel="next"`, y el plugin cree que hay 2 páginas y corta ahí.
  const text = String(html == null ? "" : html).replace(/&amp;/gi, "&");
  const re = /[?&]page=(\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (isFinite(n) && n > last) last = n;
  }
  return last;
}

function withPage(url, page) {
  const u = new URL(url);
  u.searchParams.set("page", String(page));
  return u.toString();
}

const VERSION_LABELS = {
  all: "Todos",
  straight: "Hetero",
  trans: "Trans",
  gay: "Gay",
  hentai: "Hentai",
};

function categoryOfUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    if (path === "/explore") return "Populares";
    if (path === "/explore/new") return "Nuevos";
    if (path.indexOf("/version/") === 0) {
      const key = path.slice("/version/".length);
      return VERSION_LABELS[key] || "";
    }
    if (path === "/search") {
      const q = u.searchParams.get("q") || "";
      return q ? q.slice(0, 30) : "Buscar";
    }
    const name = path.replace(/^\//, "");
    return name ? "Perfil: " + name.slice(0, 20) : "";
  } catch (e) {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Página de álbum
// ---------------------------------------------------------------------------
function parseAlbum(html, id) {
  const titleMatch = /class="album-title-page"[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  const title = cleanTitle(titleMatch ? titleMatch[1] : "");

  const userMatch = /id="user_name"[^>]*>([\s\S]*?)<\/a>/.exec(html);
  const user = userMatch ? squash(userMatch[1]) : "";

  const viewsMatch = /class="mr-5"[^>]*>[\s\S]*?<\/svg>\s*([\d.,]+(?:\s*(?:mil|k|m))?)/i.exec(html);
  const views = viewsMatch ? parseCount(viewsMatch[1]) : 0;

  const groupStarts = [];
  const groupRe = /<div class="media-group" id="(\d+)"/g;
  let g;
  while ((g = groupRe.exec(html)) !== null) groupStarts.push(g.index);

  const videos = [];
  const seen = new Set();
  let poster = "";

  for (let i = 0; i < groupStarts.length; i++) {
    const end = i + 1 < groupStarts.length ? groupStarts[i + 1] : html.length;
    const block = html.slice(groupStarts[i], end);

    const posterMatch = /poster="([^"]+)"/.exec(block);
    const groupPoster = posterMatch ? unescapeHtml(posterMatch[1]) : "";
    if (!poster && groupPoster) poster = groupPoster;

    const durationMatch = /class="duration"[^>]*>([^<]+)</.exec(block);
    const duration = durationMatch ? parseDuration(durationMatch[1]) : 0;

    // Un grupo puede repetir la misma fuente o traer varias calidades: se queda la mejor.
    let best = null;
    const sourceRe = /<source[^>]+src="([^"]+)"([^>]*)>/g;
    let s;
    while ((s = sourceRe.exec(block)) !== null) {
      const url = unescapeHtml(s[1]);
      if (!/^https?:\/\//i.test(url)) continue;
      const resMatch = /res=['"](\d+)['"]/.exec(s[2] || "");
      const res = resMatch ? Number(resMatch[1]) : 0;
      if (!best || res > best.res) best = { url: url, res: res };
    }
    if (!best || seen.has(best.url)) continue;
    seen.add(best.url);
    videos.push({
      url: best.url,
      poster: groupPoster || poster,
      duration: duration,
      index: videos.length + 1,
    });
  }

  return {
    id: id,
    title: title,
    user: user,
    views: views,
    videos: videos,
    images: [],
    poster: poster || (videos[0] && videos[0].poster) || "",
    tags: extractTags(title, ""),
  };
}

const albumCache = new Map();

async function loadAlbum(id) {
  if (albumCache.has(id)) return albumCache.get(id);
  const html = await getHtml(site() + "/a/" + encodeURIComponent(id));
  const album = parseAlbum(html, id);
  if (albumCache.size >= 30) albumCache.clear();
  albumCache.set(id, album);
  return album;
}

function albumIdOf(ref) {
  const parts = String(ref == null ? "" : ref).split(":");
  if (parts.length >= 2 && /^[A-Za-z0-9]{1,128}$/.test(parts[1])) return parts[1];
  return String(ref == null ? "" : ref).replace(/[^A-Za-z0-9]/g, "").slice(0, 128);
}

function indexOf(ref) {
  const parts = String(ref == null ? "" : ref).split(":");
  if (parts.length < 3) return 0;
  const n = Number(parts[2]);
  return isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------
const HOME_ROWS = [
  { id: "populares", title: "Populares", path: "/explore" },
  { id: "nuevos", title: "Nuevos", path: "/explore/new" },
  { id: "hetero", title: "Hetero", path: "/version/straight" },
  { id: "hentai", title: "Hentai", path: "/version/hentai" },
  { id: "latinas", title: "Latinas", path: "/search?q=latina" },
  { id: "milf", title: "MILF", path: "/search?q=milf" },
  { id: "amateur", title: "Amateur", path: "/search?q=amateur" },
];

export async function home() {
  const settled = await Promise.allSettled(
    HOME_ROWS.map(async (row) => {
      const url = site() + row.path;
      const html = await getHtml(url);
      const items = parseListing(html, row.title);
      return { id: row.id, title: row.title, ref: url, genre: "peliculas", items: items };
    })
  );

  const rows = [];
  for (let i = 0; i < settled.length; i++) {
    const answer = settled[i];
    if (answer.status !== "fulfilled") {
      const reason = answer.reason && answer.reason.message ? answer.reason.message : "error";
      try {
        kino.log("fila " + HOME_ROWS[i].id + " falló: " + reason);
      } catch (e) {
        // el log no puede romper la fila
      }
      continue;
    }
    if (!answer.value.items.length) continue;
    rows.push(answer.value);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// "Ver más" de cada fila
// ---------------------------------------------------------------------------
export async function browse(ref, cursor) {
  await null;
  const url = String(ref == null ? "" : ref);
  if (!/^https:\/\//i.test(url)) throw kino.error("not_found", "esa fila ya no existe");

  const raw = cursor ? Number(cursor) : 1;
  const page = isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;

  const html = await getHtml(page > 1 ? withPage(url, page) : url);
  const items = parseListing(html, categoryOfUrl(url));
  const last = lastPageOf(html, page);
  return { items: items, next: page < last ? String(page + 1) : undefined };
}

// ---------------------------------------------------------------------------
// Álbum con varios vídeos = serie; cada vídeo es un capítulo
// ---------------------------------------------------------------------------
export async function episodes(ref) {
  await null;
  const id = albumIdOf(ref);
  const album = await loadAlbum(id);
  if (!album.videos.length) throw kino.error("not_found", "este álbum no tiene vídeos");

  const many = album.videos.length > 1;
  return {
    series: {
      title: album.title,
      poster: album.poster || undefined,
      backdrop: (album.videos[0] && album.videos[0].poster) || undefined,
      overview: overviewOf(album),
      genres: album.tags.slice(0, 5),
    },
    episodes: album.videos.map((video, i) => ({
      season: 1,
      number: i + 1,
      ref: "e:" + id + ":" + i,
      title: many ? album.title + " · " + (i + 1) : album.title,
      still: video.poster || undefined,
      runtimeMinutes: video.duration ? Math.max(1, Math.round(video.duration / 60)) : undefined,
    })),
  };
}

// ---------------------------------------------------------------------------
// Detalles del título (apiVersion 8)
// ---------------------------------------------------------------------------
export async function details(ref) {
  await null;
  const album = await loadAlbum(albumIdOf(ref));
  return {
    overview: overviewOf(album),
    genres: album.tags.slice(0, 5),
    poster: album.poster || undefined,
    backdrop: (album.videos[0] && album.videos[0].poster) || undefined,
  };
}

// ---------------------------------------------------------------------------
// Reproducción
// ---------------------------------------------------------------------------
export async function resolve(ref) {
  await null;
  const album = await loadAlbum(albumIdOf(ref));
  const index = indexOf(ref);
  const video = album.videos[index] || album.videos[0];
  if (!video) throw kino.error("not_found", "este álbum no tiene vídeo");

  return {
    url: video.url,
    mime: "video/mp4",
    // EroMe pide no hacer hotlink: el reproductor manda el Referer del sitio.
    headers: { Referer: site() + "/", "User-Agent": UA },
    durationMs: video.duration ? video.duration * 1000 : undefined,
  };
}

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------
function searchUrl(query, page) {
  const params = new URLSearchParams();
  params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return site() + "/search?" + params.toString();
}

export async function search(query) {
  const q = String((query && query.q) || "").trim();
  if (!q) return [];

  // `query.within` llega cuando la persona busca dentro de una fila ("Ver más").
  // Sin esto Kino filtra en local los ~36 títulos ya cargados y una palabra que
  // no esté entre ellos no devuelve nada. EroMe no tiene búsqueda por categoría,
  // así que se contesta con la búsqueda global del sitio: resultados reales
  // desde cualquier pantalla.
  const raw = query && query.cursor ? Number(query.cursor) : 1;
  const page = isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;

  const html = await getHtml(searchUrl(q, page));
  let items = parseListing(html, "Buscar");

  // Si el título no aparece con lo tecleado, se prueban los títulos que Kino conoce.
  if (!items.length && page === 1) {
    const forms = [];
    const given = [query.originalTitle].concat(Array.isArray(query.altTitles) ? query.altTitles : []);
    for (let i = 0; i < given.length && forms.length < 2; i++) {
      const text = String(given[i] || "").trim();
      if (text && text.toLowerCase() !== q.toLowerCase() && forms.indexOf(text) === -1) forms.push(text);
    }
    for (let i = 0; i < forms.length && !items.length; i++) {
      const extra = await getHtml(searchUrl(forms[i], 1));
      items = parseListing(extra, "Buscar");
    }
  }

  const last = lastPageOf(html, page);
  return { items: items, next: page < last ? String(page + 1) : undefined };
}
