"""Genera de forma determinista los assets públicos de marca de Timbo.

Requiere Pillow en el entorno local; no forma parte de las dependencias de la
aplicación ni modifica sus archivos de paquetes.
"""

from __future__ import annotations

from pathlib import Path

import numpy
from PIL import Image, ImageChops, ImageOps


BRAND_BLUE = (31, 36, 92)
RESAMPLING = Image.Resampling.LANCZOS
WEB_DIRECTORY = Path(__file__).resolve().parents[2]
SOURCE_DIRECTORY = Path(__file__).resolve().parent / "source"
PUBLIC_DIRECTORY = WEB_DIRECTORY / "public"


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


def timbo_monogram_mask(source: Image.Image) -> Image.Image:
    """Recorta la T inclinada del wordmark mediante su silueta original."""
    mask = foreground_mask(source)
    # La T ocupa el extremo izquierdo del wordmark; el polígono evita incorporar la I.
    polygon = Image.new("L", source.size, 0)
    from PIL import ImageDraw

    ImageDraw.Draw(polygon).polygon(
        [(90, 880), (490, 880), (465, 1015), (385, 1015), (350, 1248), (180, 1248), (220, 1015), (65, 1015)],
        fill=255,
    )
    return ImageChops.multiply(mask, polygon).crop((65, 880, 490, 1248))


def icon_asset(mask: Image.Image, size: int, content_ratio: float) -> Image.Image:
    bbox = non_empty_bbox(mask)
    glyph = mask.crop(bbox)
    maximum_side = round(size * content_ratio)
    scale = min(maximum_side / glyph.width, maximum_side / glyph.height)
    glyph_size = (round(glyph.width * scale), round(glyph.height * scale))
    glyph = glyph.resize(glyph_size, RESAMPLING)
    icon = Image.new("RGB", (size, size), BRAND_BLUE)
    offset = ((size - glyph.width) // 2, (size - glyph.height) // 2)
    icon.paste((255, 255, 255), offset, glyph)
    return icon


def write_icons(source: Image.Image, icons_directory: Path) -> None:
    mask = timbo_monogram_mask(source)
    icon_192 = icon_asset(mask, 192, 0.66)
    icon_512 = icon_asset(mask, 512, 0.66)
    maskable_512 = icon_asset(mask, 512, 0.58)
    apple_touch_icon = icon_asset(mask, 180, 0.66)
    icon_192.save(icons_directory / "timbo-app-192.png", "PNG", optimize=True)
    icon_512.save(icons_directory / "timbo-app-512.png", "PNG", optimize=True)
    maskable_512.save(icons_directory / "timbo-maskable-512.png", "PNG", optimize=True)
    apple_touch_icon.save(icons_directory / "apple-touch-icon.png", "PNG", optimize=True)
    icon_512.save(
        PUBLIC_DIRECTORY / "favicon.ico",
        "ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    # La primera versión del pipeline dejaba una copia fuera del contrato público.
    (icons_directory / "favicon.ico").unlink(missing_ok=True)


def main() -> None:
    brand_directory = PUBLIC_DIRECTORY / "brand"
    icons_directory = PUBLIC_DIRECTORY / "icons"
    brand_directory.mkdir(parents=True, exist_ok=True)
    icons_directory.mkdir(parents=True, exist_ok=True)

    with Image.open(SOURCE_DIRECTORY / "LOGO TIMBO-01.png") as wordmark_source:
        wordmark = wordmark_source.convert("RGB")
        wordmark_asset(wordmark, brand_directory / "timbo-wordmark.webp")
        wordmark_mark_asset(wordmark, brand_directory / "timbo-wordmark-mark.webp")
        write_icons(wordmark, icons_directory)

    with Image.open(SOURCE_DIRECTORY / "timbo-facility-source.jpg") as facility_source:
        for width in (640, 960, 1600):
            facility_asset(facility_source, width, brand_directory / f"timbo-facility-{width}.webp")


if __name__ == "__main__":
    main()
