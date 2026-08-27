# Recursos de marca de Timbo

Los originales de este directorio fueron proporcionados para este proyecto. No se declara ni se infiere ninguna licencia o derecho adicional.

## Convención

- Los recursos de marca usan nombres descriptivos en español, en minúsculas y con guiones medios.
- Los originales viven en `originales/`; los archivos publicados se separan en `../../public/marca/` e `../../public/iconos/`.
- `favicon.ico` conserva su nombre estándar porque los navegadores lo buscan por esa URL convencional.

## Originales conservados

- `originales/logotipo-timbo-azul-transparente.png`: wordmark azul con fondo transparente.
- `originales/logotipo-timbo-blanco-transparente.png`: wordmark blanco con fondo transparente.
- `originales/logotipo-timbo-blanco-sobre-azul.jpg`: wordmark blanco sobre azul, utilizado para producir las variantes WebP del wordmark.
- `originales/fotografia-sede-timbo.jpg`: fotografía aérea de la sede o fachada.
- `../../public/iconos/icono-plataforma-timbo-sin-antilasing.svg`: monograma `T` trazado a mano en Inkscape (no derivado del JPG). Es la fuente del favicon y de los iconos de aplicación — al ser vectorial, evita el aliasing que dejaba recortar y escalar la T desde el wordmark rasterizado.

El color dominante medido en el fondo del wordmark es `#1F245C` (RGB `31, 36, 92`), el mismo tono de fondo usado en el SVG del monograma.

## Archivos publicados o derivados

- `../../public/marca/logotipo-timbo-blanco-sobre-azul.webp`: wordmark completo, recortado al contenido y con padding visual.
- `../../public/marca/logotipo-timbo-blanco-transparente.webp`: wordmark recortado con canal alfa para superponerlo sobre la fotografía del acceso.
- `../../public/marca/logotipo-timbo-blanco-transparente.png`: copia del original blanco, usada durante la carga inicial del documento.
- `../../public/marca/fotografia-sede-timbo-640.webp`, `fotografia-sede-timbo-960.webp` y `fotografia-sede-timbo-1600.webp`: variantes WebP para `srcset`, corregidas según la orientación EXIF y sin ampliar la imagen original.
- `../../public/iconos/icono-plataforma-timbo-192.png`, `icono-plataforma-timbo-512.png` e `icono-plataforma-timbo-enmascarable-512.png`: iconos de aplicación rasterizados desde el SVG del monograma a cada tamaño nativo (el margen del SVG ya cumple la zona segura de íconos enmascarables de Android, por eso los tres reutilizan el mismo trazo).
- `../../public/iconos/icono-timbo-apple-180.png`: icono de 180 px para Apple.
- `../../public/favicon.ico`: contenedor ICO con tamaños 16, 32 y 48 px, cada uno rasterizado nativamente (no reescalado desde un PNG más grande).
- `index.html` además referencia `icono-plataforma-timbo-sin-antilasing.svg` directamente como `<link rel="icon" type="image/svg+xml">`, que los navegadores modernos priorizan sobre el `.ico`.

## Regeneración

El wordmark y la fotografía usan Pillow y NumPy instalados localmente; no agregan dependencias de runtime. El favicon y los iconos PWA además requieren el ejecutable de Inkscape instalado localmente (usado solo por este script, vía línea de comandos, para rasterizar el SVG del monograma). Desde la raíz del repositorio, ejecutar:

```bash
python apps/web/assets/brand/generate_brand_assets.py
```

El script conserva los originales de `originales/` y el SVG del monograma tal como están, y sobrescribe solamente los archivos publicados enumerados arriba.
