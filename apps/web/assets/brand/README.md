# Assets de marca de Timbo

Los archivos fuente de este directorio fueron proporcionados por el usuario para este proyecto. No se declara ni se infiere ninguna licencia o derecho adicional.

## Fuentes conservadas

- `source/timbo-wordmark-source.jpg`: wordmark blanco sobre azul, movido desde `data/LOGO TIMBO.jpg`.
- `source/timbo-facility-source.jpg`: fotografía aérea de la sede/fachada, movida desde `data/DJI_0300.JPG`.

El color dominante medido en el fondo del wordmark es `#1F245C` (RGB `31, 36, 92`). Se utiliza como fondo de los iconos derivados.

## Archivos derivados

- `../../public/brand/timbo-wordmark.webp`: wordmark completo, recortado al contenido y con padding visual.
- `../../public/brand/timbo-facility-640.webp`, `timbo-facility-960.webp` y `timbo-facility-1600.webp`: variantes WebP para `srcset`, corregidas según la orientación EXIF y sin ampliar la imagen original.
- `../../public/icons/timbo-app-192.png` y `timbo-app-512.png`: iconos de aplicación con el monograma `T` derivado de la primera letra del wordmark.
- `../../public/icons/timbo-maskable-512.png`: variante con el monograma dentro de una zona segura más amplia para máscaras de plataforma.
- `../../public/icons/apple-touch-icon.png`: icono de 180 px para Apple.
- `../../public/favicon.ico`: contenedor ICO con tamaños 16, 32 y 48 px.

## Regeneración

El proceso usa únicamente Pillow instalado localmente y no agrega dependencias de runtime. Desde la raíz del repositorio, ejecutar:

```bash
python apps/web/assets/brand/generate_brand_assets.py
```

El script conserva los originales de `source/`, detecta el blanco del wordmark, aplica la paleta medida y sobrescribe solamente los archivos derivados enumerados arriba.
