# Recursos de marca de Timbo

Los originales de este directorio fueron proporcionados para este proyecto. No se declara ni se infiere ninguna licencia o derecho adicional.

## Convención

- Los recursos de marca usan nombres descriptivos en español, en minúsculas y con guiones medios.
- Los originales viven en `originales/`; los archivos publicados se separan en `../../public/marca/` e `../../public/iconos/`.
- `favicon.ico` conserva su nombre estándar porque los navegadores lo buscan por esa URL convencional.

## Originales conservados

- `originales/logotipo-timbo-azul-transparente.png`: wordmark azul con fondo transparente.
- `originales/logotipo-timbo-blanco-transparente.png`: wordmark blanco con fondo transparente.
- `originales/logotipo-timbo-blanco-sobre-azul.jpg`: wordmark blanco sobre azul, utilizado para producir el monograma y las variantes WebP.
- `originales/fotografia-sede-timbo.jpg`: fotografía aérea de la sede o fachada.

El color dominante medido en el fondo del wordmark es `#1F245C` (RGB `31, 36, 92`). Se utiliza como fondo de los iconos derivados.

## Archivos publicados o derivados

- `../../public/marca/logotipo-timbo-blanco-sobre-azul.webp`: wordmark completo, recortado al contenido y con padding visual.
- `../../public/marca/logotipo-timbo-blanco-transparente.webp`: wordmark recortado con canal alfa para superponerlo sobre la fotografía del acceso.
- `../../public/marca/logotipo-timbo-blanco-transparente.png`: copia del original blanco, usada durante la carga inicial del documento.
- `../../public/marca/fotografia-sede-timbo-640.webp`, `fotografia-sede-timbo-960.webp` y `fotografia-sede-timbo-1600.webp`: variantes WebP para `srcset`, corregidas según la orientación EXIF y sin ampliar la imagen original.
- `../../public/iconos/icono-plataforma-timbo-192.png` e `icono-plataforma-timbo-512.png`: iconos de aplicación con el monograma `T` derivado del wordmark.
- `../../public/iconos/icono-plataforma-timbo-enmascarable-512.png`: variante con el monograma dentro de una zona segura más amplia para máscaras de plataforma.
- `../../public/iconos/icono-timbo-apple-180.png`: icono de 180 px para Apple.
- `../../public/favicon.ico`: contenedor ICO con tamaños 16, 32 y 48 px.

## Regeneración

El proceso usa Pillow y NumPy instalados localmente y no agrega dependencias de runtime. Desde la raíz del repositorio, ejecutar:

```bash
python apps/web/assets/brand/generate_brand_assets.py
```

El script conserva los originales de `originales/`, detecta el blanco del wordmark, aplica la paleta medida y sobrescribe solamente los archivos publicados enumerados arriba.
