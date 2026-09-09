"""Genera de forma determinista los assets públicos de marca de Timbo.

Requiere Pillow en el entorno local; no forma parte de las dependencias de la
aplicación ni modifica sus archivos de paquetes. Regenerar el favicon y los
íconos PWA además requiere el ejecutable de Inkscape instalado localmente,
solo para este script (no es una dependencia de la aplicación).
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from shutil import copyfile

import numpy
from PIL import Image, ImageChops, ImageOps


BRAND_BLUE = (31, 36, 92)
RESAMPLING = Image.Resampling.LANCZOS
WEB_DIRECTORY = Path(__file__).resolve().parents[2]
SOURCE_DIRECTORY = Path(__file__).resolve().parent / "originales"
PUBLIC_DIRECTORY = WEB_DIRECTORY / "public"
# Ícono vectorial trazado a mano en Inkscape (no derivado del wordmark JPG):
# reproduce la silueta de la T sin el aliasing de una máscara rasterizada.
ICON_SOURCE_SVG = PUBLIC_DIRECTORY / "iconos" / "icono-plataforma-timbo-sin-antilasing.svg"
_WINDOWS_INKSCAPE_FALLBACK = Path(r"C:\Program Files\Inkscape\bin\inkscape.exe")


def foreground_mask(image: Image.Image) -> Image.Image:
    """Aísla el wordmark blanco, descartando el fondo azul y artefactos JPEG."""
    red, green, blue = image.convert("RGB").split()
    minimum = ImageChops.darker(ImageChops.darker(red, green), blue)
    return minimum.point(lambda value: 255 if value >= 220 else 0)


def non_empty_bbox(mask: Image.Image) -> tuple[int, int, int, int]:
    bbox = mask.getbbox()
    if bbox is None:
        raise RuntimeError("No se detectó el wordmark blanco en el archivo fuente.")
    return bbox


def save_webp(image: Image.Image, destination: Path, quality: int) -> None:
    image.save(destination, "WEBP", quality=quality, method=6, exact=True)


def wordmark_asset(source: Image.Image, destination: Path) -> None:
    mask = foreground_mask(source)
    left, top, right, bottom = non_empty_bbox(mask)
    content_width = right - left
    content_height = bottom - top
    horizontal_padding = round(content_width * 0.07)
    vertical_padding = round(content_height * 0.30)
    crop = source.crop(
        (
            max(0, left - horizontal_padding),
            max(0, top - vertical_padding),
            min(source.width, right + horizontal_padding),
            min(source.height, bottom + vertical_padding),
        )
    )
    target_width = min(1400, crop.width)
    target_height = round(crop.height * target_width / crop.width)
    save_webp(crop.resize((target_width, target_height), RESAMPLING), destination, quality=88)


def wordmark_mark_asset(source: Image.Image, destination: Path) -> None:
    """Recorta el wordmark a un WebP con canal alfa real, para superponerlo sobre la
    fotografía de acceso sin arrastrar el fondo azul sólido del archivo fuente.

    Reutiliza el mismo encuadre que `wordmark_asset` (bbox del `foreground_mask`,
    probado contra artefactos de borde del JPEG fuente) y sustituye únicamente el
    fondo sólido por un canal alfa suave derivado de la luminancia real."""
    mask = foreground_mask(source)
    left, top, right, bottom = non_empty_bbox(mask)
    content_width = right - left
    content_height = bottom - top
    horizontal_padding = round(content_width * 0.07)
    vertical_padding = round(content_height * 0.30)
    crop = source.convert("RGB").crop(
        (
            max(0, left - horizontal_padding),
            max(0, top - vertical_padding),
            min(source.width, right + horizontal_padding),
            min(source.height, bottom + vertical_padding),
        )
    )

    rgb = numpy.asarray(crop, dtype=numpy.float64)
    weights = numpy.array([0.2126, 0.7152, 0.0722])
    brand_luminance = float(numpy.array(BRAND_BLUE, dtype=numpy.float64) @ weights)
    luminance = rgb @ weights
    alpha = (luminance - brand_luminance - 20) / (255 - brand_luminance - 20) * 255
    alpha = numpy.clip(alpha, 0, 255)
    alpha[alpha < 30] = 0

    cutout = Image.new("RGBA", crop.size, (255, 255, 255, 0))
    cutout.putalpha(Image.fromarray(alpha.astype(numpy.uint8), mode="L"))
    target_width = min(1400, cutout.width)
    target_height = round(cutout.height * target_width / cutout.width)
    cutout.resize((target_width, target_height), RESAMPLING).save(
        destination, "WEBP", quality=90, method=6, exact=True
    )


def facility_asset(source: Image.Image, target_width: int, destination: Path) -> None:
    image = ImageOps.exif_transpose(source).convert("RGB")
    output_width = min(target_width, image.width)
    output_height = round(image.height * output_width / image.width)
    save_webp(image.resize((output_width, output_height), RESAMPLING), destination, quality=82)


def inkscape_executable() -> str:
    found = shutil.which("inkscape")
    if found:
        return found
    if _WINDOWS_INKSCAPE_FALLBACK.exists():
        return str(_WINDOWS_INKSCAPE_FALLBACK)
    msg = (
        "No se encontró el ejecutable de Inkscape. Solo hace falta instalarlo "
        "localmente para regenerar el favicon y los íconos PWA desde el SVG "
        f"({ICON_SOURCE_SVG})."
    )
    raise RuntimeError(msg)


def render_svg_icon(size: int, destination: Path) -> None:
    """Rasteriza ICON_SOURCE_SVG nativamente al tamaño pedido (sin reescalar un PNG más grande)."""
    subprocess.run(
        [
            inkscape_executable(),
            str(ICON_SOURCE_SVG),
            "--export-type=png",
            f"--export-filename={destination}",
            "-w",
            str(size),
            "-h",
            str(size),
        ],
        check=True,
        capture_output=True,
    )


def write_icons(icons_directory: Path, scratch_directory: Path) -> None:
    png_targets = {
        "icono-plataforma-timbo-192.png": 192,
        "icono-plataforma-timbo-512.png": 512,
        # El SVG fuente ya deja ~21% de margen alrededor de la T (safe zone de
        # Android maskable, que exige >=19.4%), por eso reutiliza el mismo trazo.
        "icono-plataforma-timbo-enmascarable-512.png": 512,
        "icono-timbo-apple-180.png": 180,
    }
    for filename, size in png_targets.items():
        render_svg_icon(size, icons_directory / filename)

    favicon_sizes = [16, 32, 48]
    frames = {}
    for size in favicon_sizes:
        scratch_png = scratch_directory / f"favicon-{size}.png"
        render_svg_icon(size, scratch_png)
        frames[size] = Image.open(scratch_png).convert("RGBA")

    largest = max(favicon_sizes)
    frames[largest].save(
        PUBLIC_DIRECTORY / "favicon.ico",
        "ICO",
        sizes=[(size, size) for size in favicon_sizes],
        append_images=[frames[size] for size in favicon_sizes if size != largest],
    )


def main() -> None:
    brand_directory = PUBLIC_DIRECTORY / "marca"
    icons_directory = PUBLIC_DIRECTORY / "iconos"
    brand_directory.mkdir(parents=True, exist_ok=True)
    icons_directory.mkdir(parents=True, exist_ok=True)

    copyfile(
        SOURCE_DIRECTORY / "logotipo-timbo-blanco-transparente.png",
        brand_directory / "logotipo-timbo-blanco-transparente.png",
    )

    with Image.open(SOURCE_DIRECTORY / "logotipo-timbo-blanco-sobre-azul.jpg") as wordmark_source:
        wordmark = wordmark_source.convert("RGB")
        wordmark_asset(wordmark, brand_directory / "logotipo-timbo-blanco-sobre-azul.webp")
        wordmark_mark_asset(wordmark, brand_directory / "logotipo-timbo-blanco-transparente.webp")

    with Image.open(SOURCE_DIRECTORY / "fotografia-sede-timbo.jpg") as facility_source:
        for width in (640, 960, 1600):
            facility_asset(facility_source, width, brand_directory / f"fotografia-sede-timbo-{width}.webp")

    with tempfile.TemporaryDirectory() as scratch:
        write_icons(icons_directory, Path(scratch))


if __name__ == "__main__":
    main()
