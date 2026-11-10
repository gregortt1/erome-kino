# EroMe — plugin para Kino

Plugin de [Kino](https://github.com/kinotvapp/kino-light) que trae los vídeos públicos de
[es.erome.com](https://es.erome.com) a la app.

## Qué hace

- **Inicio** con 9 filas: Populares, Nuevos, Hetero, Trans, Gay, Hentai, Latinas, MILF, Amateur.
- **Búsqueda** en el sitio, con páginas siguientes.
- **Ver más** en cada fila, 36 álbumes por página.
- **Álbum de un vídeo** → película. **Álbum con varios** → serie, un capítulo por vídeo.
- Cada título muestra **autor, visitas, número de vídeos y etiquetas**.
- Reproduce el MP4 de mejor calidad disponible y permite descargarlo.

Las etiquetas salen de la orientación y la búsqueda del sitio, más las palabras clave del título del
álbum. EroMe no tiene un endpoint de etiquetas, así que un título sin palabras clave puede salir sin
ninguna.

## Requisitos

- **Kino 0.9.54 o superior.**
- Código 18+ desbloqueado en **Ajustes ▸ Control parental**. Con el código bloqueado las filas salen
  vacías: todo el contenido va marcado como adulto.

## Instalación

1. **Ajustes ▸ Plugins ▸ Agregar**.
2. Escribe `Gregortt1/erome-kino`.
3. Acepta los permisos (`erome.com` y `*.erome.com`).
4. Desbloquea el código 18+.

## Ajustes del plugin

En **Ajustes ▸ EroMe**:

- **Dominio** — `es.erome.com` o `www.erome.com`.
- **Etiquetas en la sinopsis** — activado por defecto.

## Nota

Plugin de uso personal. No aparece en la tienda de Kino. El repositorio se mantiene público porque
Kino lee los archivos sin credenciales y un repo privado no se puede instalar.
