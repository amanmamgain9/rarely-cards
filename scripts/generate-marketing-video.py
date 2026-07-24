#!/usr/bin/env python3
"""Render Rarely's vertical social spot from existing project artwork."""

from __future__ import annotations

import argparse
import math
import random
import subprocess
import sys
import wave
from array import array
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
except ImportError as exc:
    raise SystemExit(
        "Pillow is required. Run: python3 -m pip install --target "
        "scripts/.video-deps pillow"
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 1080, 1920
FPS = 30
DURATION = 20.0

INK = "#281832"
CREAM = "#fffaf5"
PINK = "#ff5d9e"
HOT_PINK = "#f52f87"
LAVENDER = "#e4adff"
PURPLE = "#a934dc"
MINT = "#70e6d2"
YELLOW = "#ffe56a"
WHITE = "#ffffff"

FONT_BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf")
FONT_REGULAR = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
FONT_MONO = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf")


def font(size: int, kind: str = "bold") -> ImageFont.FreeTypeFont:
    path = {
        "bold": FONT_BOLD,
        "regular": FONT_REGULAR,
        "mono": FONT_MONO,
    }[kind]
    return ImageFont.truetype(str(path), size)


def ease_out_back(value: float) -> float:
    value = max(0.0, min(1.0, value))
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (value - 1) ** 3 + c1 * (value - 1) ** 2


def ease_in_out(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return -(math.cos(math.pi * value) - 1) / 2


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    source = image.convert("RGB")
    target_ratio = size[0] / size[1]
    source_ratio = source.width / source.height
    if source_ratio > target_ratio:
        new_width = round(source.height * target_ratio)
        left = (source.width - new_width) // 2
        source = source.crop((left, 0, left + new_width, source.height))
    else:
        new_height = round(source.width / target_ratio)
        top = (source.height - new_height) // 2
        source = source.crop((0, top, source.width, top + new_height))
    return source.resize(size, Image.Resampling.LANCZOS)


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    result = image.copy()
    result.thumbnail(size, Image.Resampling.LANCZOS)
    return result


def rounded_photo(image: Image.Image, size: tuple[int, int], radius: int = 48) -> Image.Image:
    fitted = cover(image, size).convert("RGBA")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius, fill=255)
    fitted.putalpha(mask)
    return fitted


def paste_shadow(
    canvas: Image.Image,
    item: Image.Image,
    xy: tuple[int, int],
    shadow_radius: int = 28,
    shadow_offset: tuple[int, int] = (0, 22),
) -> None:
    shadow = Image.new("RGBA", item.size, (0, 0, 0, 0))
    alpha = item.getchannel("A") if item.mode == "RGBA" else Image.new("L", item.size, 255)
    shadow.putalpha(alpha.point(lambda value: round(value * 0.3)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(shadow_radius))
    canvas.alpha_composite(
        shadow,
        (xy[0] + shadow_offset[0], xy[1] + shadow_offset[1]),
    )
    canvas.alpha_composite(item.convert("RGBA"), xy)


def rotate_card(image: Image.Image, angle: float) -> Image.Image:
    return image.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        expand=True,
        fillcolor=(0, 0, 0, 0),
    )


def dotted_background(color: str = CREAM, dot_color: str = "#f7bad5") -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), color)
    draw = ImageDraw.Draw(canvas)
    for y in range(20, HEIGHT, 42):
        offset = 18 if (y // 42) % 2 else 0
        for x in range(20 + offset, WIDTH, 42):
            draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=dot_color)
    return canvas


def centered_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    text_font: ImageFont.FreeTypeFont,
    fill: str = INK,
    spacing: int = 4,
    stroke_width: int = 0,
    stroke_fill: str | None = None,
) -> None:
    box = draw.multiline_textbbox((0, 0), text, font=text_font, spacing=spacing, align="center")
    width = box[2] - box[0]
    draw.multiline_text(
        ((WIDTH - width) // 2, y),
        text,
        font=text_font,
        fill=fill,
        spacing=spacing,
        align="center",
        stroke_width=stroke_width,
        stroke_fill=stroke_fill,
    )


def pill(
    draw: ImageDraw.ImageDraw,
    text: str,
    center: tuple[int, int],
    fill: str,
    text_fill: str = INK,
    size: int = 34,
    padding: tuple[int, int] = (32, 18),
) -> None:
    text_font = font(size, "bold")
    box = draw.textbbox((0, 0), text, font=text_font)
    width = box[2] - box[0] + padding[0] * 2
    height = box[3] - box[1] + padding[1] * 2
    x = center[0] - width // 2
    y = center[1] - height // 2
    draw.rounded_rectangle((x, y, x + width, y + height), height // 2, fill=fill)
    draw.text(
        (center[0], center[1] - 2),
        text,
        font=text_font,
        fill=text_fill,
        anchor="mm",
    )


def sparkle(draw: ImageDraw.ImageDraw, x: int, y: int, radius: int, color: str) -> None:
    points = [
        (x, y - radius),
        (x + radius // 4, y - radius // 4),
        (x + radius, y),
        (x + radius // 4, y + radius // 4),
        (x, y + radius),
        (x - radius // 4, y + radius // 4),
        (x - radius, y),
        (x - radius // 4, y - radius // 4),
    ]
    draw.polygon(points, fill=color)


def speech_bubble(
    draw: ImageDraw.ImageDraw,
    text: str,
    box: tuple[int, int, int, int],
    fill: str = WHITE,
    text_fill: str = INK,
    tail: str = "left",
    size: int = 43,
) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, 42, fill=fill, outline=INK, width=6)
    if tail == "left":
        points = [(x1 + 95, y2 - 4), (x1 + 45, y2 + 85), (x1 + 175, y2 - 4)]
    else:
        points = [(x2 - 175, y2 - 4), (x2 - 45, y2 + 85), (x2 - 95, y2 - 4)]
    draw.polygon(points, fill=fill)
    draw.line(points[:2], fill=INK, width=6)
    draw.line(points[1:], fill=INK, width=6)
    text_font = font(size, "bold")
    text_box = draw.multiline_textbbox(
        (0, 0),
        text,
        font=text_font,
        spacing=8,
        align="center",
    )
    text_width = text_box[2] - text_box[0]
    text_height = text_box[3] - text_box[1]
    draw.multiline_text(
        ((x1 + x2 - text_width) // 2, (y1 + y2 - text_height) // 2 - 5),
        text,
        font=text_font,
        fill=text_fill,
        spacing=8,
        align="center",
    )


def load_assets() -> dict[str, Image.Image]:
    card_box = (14, 94, 377, 754)
    return {
        "golden": Image.open(ROOT / "public/pets/golden-dog.jpg").convert("RGB"),
        "cat": Image.open(ROOT / "public/pets/window-cat.jpg").convert("RGB"),
        "dog": Image.open(ROOT / "public/pets/quiet-dog.jpg").convert("RGB"),
        "juno": Image.open(ROOT / "juno-card-preview.png").convert("RGBA").crop(card_box),
        "leo": Image.open(ROOT / "leo-card-preview.png").convert("RGBA").crop(card_box),
        "ziggy": Image.open(ROOT / "ziggy-card-preview.png").convert("RGBA").crop(card_box),
        "mochi": Image.open(ROOT / "mochi-snack-card-preview.png").convert("RGBA").crop(card_box),
    }


def brand_tag(draw: ImageDraw.ImageDraw, light: bool = False) -> None:
    color = WHITE if light else INK
    draw.text((64, 58), "RARELY", font=font(42, "bold"), fill=color)
    draw.text(
        (64, 112),
        "NOT BUILT TO BLEND IN",
        font=font(21, "mono"),
        fill=color,
    )


def scene_hook(t: float, assets: dict[str, Image.Image]) -> Image.Image:
    zoom = 1.0 + 0.045 * ease_in_out(t / 3.1)
    base = cover(assets["dog"], (round(WIDTH * zoom), round(HEIGHT * zoom)))
    left = (base.width - WIDTH) // 2
    top = (base.height - HEIGHT) // 2
    canvas = base.crop((left, top, left + WIDTH, top + HEIGHT)).convert("RGBA")
    canvas = ImageEnhance.Color(canvas).enhance(0.9)

    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    for y in range(0, 760, 8):
        alpha = round(210 * (1 - y / 760))
        overlay_draw.rectangle((0, y, WIDTH, y + 8), fill=(40, 24, 50, alpha))
    overlay_draw.rectangle((0, 1540, WIDTH, HEIGHT), fill=(40, 24, 50, 150))
    canvas.alpha_composite(overlay)

    draw = ImageDraw.Draw(canvas)
    brand_tag(draw, light=True)
    pop = ease_out_back(t / 0.65)
    headline_size = max(10, round(118 * pop))
    centered_text(
        draw,
        "YOUR PET ISN'T",
        245,
        font(headline_size, "bold"),
        WHITE,
        stroke_width=2,
        stroke_fill=INK,
    )
    centered_text(
        draw,
        "ORDINARY.",
        365,
        font(max(10, round(146 * pop)), "bold"),
        YELLOW,
        stroke_width=3,
        stroke_fill=INK,
    )
    pill(draw, "OBVIOUSLY.", (WIDTH // 2, 1690), PINK, WHITE, 40, (44, 20))
    return canvas


def scene_photo(t: float, assets: dict[str, Image.Image]) -> Image.Image:
    canvas = dotted_background()
    draw = ImageDraw.Draw(canvas)
    brand_tag(draw)
    centered_text(draw, "EVERY LOOK\nHAS A STORY.", 190, font(104), INK, spacing=-2)
    pill(draw, "START WITH ONE FAVORITE PHOTO", (WIDTH // 2, 475), YELLOW, INK, 28)

    first = rounded_photo(assets["golden"], (445, 850), 54)
    second = rounded_photo(assets["cat"], (445, 850), 54)
    progress = ease_out_back(t / 0.7)
    first = rotate_card(first, -5)
    second = rotate_card(second, 5)
    y = round(600 + (1 - progress) * 500)
    paste_shadow(canvas, first, (55, y))
    paste_shadow(canvas, second, (560, y + 65))

    draw = ImageDraw.Draw(canvas)
    pill(draw, "THE SWEET ONE", (285, 1540), PINK, WHITE, 25)
    pill(draw, "THE DRAMATIC ONE", (775, 1625), LAVENDER, INK, 25)
    return canvas


def scene_reveal(t: float, assets: dict[str, Image.Image]) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), LAVENDER)
    draw = ImageDraw.Draw(canvas)
    for index, color in enumerate((PINK, YELLOW, MINT)):
        radius = 580 - index * 135 + round(math.sin(t * 2 + index) * 15)
        draw.ellipse(
            (WIDTH // 2 - radius, 770 - radius, WIDTH // 2 + radius, 770 + radius),
            outline=color,
            width=26,
        )
    brand_tag(draw)
    centered_text(draw, "RARELY READS\nTHE MOMENT.", 170, font(96), INK, spacing=-2)

    scale = 0.88 + 0.12 * ease_out_back(t / 0.7)
    card = contain(assets["juno"], (round(700 * scale), round(1260 * scale)))
    card = rotate_card(card, -2 + math.sin(t * 1.4) * 1.1)
    paste_shadow(canvas, card, ((WIDTH - card.width) // 2, 500))

    draw = ImageDraw.Draw(canvas)
    pill(draw, "AURA", (160, 1580), MINT, INK, 28)
    pill(draw, "DRAMA", (430, 1640), PINK, WHITE, 28)
    pill(draw, "GAZE", (720, 1590), YELLOW, INK, 28)
    sparkle(draw, 920, 1650, 38, WHITE)
    return canvas


def scene_energy(t: float, assets: dict[str, Image.Image]) -> Image.Image:
    canvas = dotted_background(PINK, "#ffb2d0")
    draw = ImageDraw.Draw(canvas)
    brand_tag(draw)
    centered_text(
        draw,
        "TINY QUIRKS.\nBIG MAIN-CHARACTER\nENERGY.",
        170,
        font(83),
        WHITE,
        spacing=-2,
        stroke_width=3,
        stroke_fill=INK,
    )

    cards = [
        (assets["juno"], -12, 2, 40),
        (assets["ziggy"], 10, 0, 570),
        (assets["leo"], -1, 1, 305),
    ]
    for card_image, angle, order, x in sorted(cards, key=lambda item: item[2]):
        scale = 0.94 + 0.06 * ease_out_back((t - order * 0.14) / 0.65)
        card = contain(card_image, (round(475 * scale), round(865 * scale)))
        card = rotate_card(card, angle + math.sin(t * 1.7 + order) * 1.2)
        y = round(750 + math.sin(t * 1.8 + order) * 18)
        paste_shadow(canvas, card, (x, y), 22, (0, 18))

    draw = ImageDraw.Draw(canvas)
    pill(draw, "FUNNY  •  HEARTFELT  •  THEIRS", (WIDTH // 2, 1720), INK, WHITE, 29)
    return canvas


def scene_one_of_one(t: float, assets: dict[str, Image.Image]) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), "#8cebdc")
    draw = ImageDraw.Draw(canvas)
    for x, y, radius, color in (
        (100, 300, 55, YELLOW),
        (960, 420, 42, PINK),
        (890, 1500, 65, WHITE),
        (125, 1610, 34, PURPLE),
    ):
        sparkle(draw, x, y, radius, color)
    brand_tag(draw)
    centered_text(draw, "ONE-OF-ONE.", 190, font(124), INK)
    centered_text(draw, "JUST LIKE THEM.", 330, font(70), INK)

    scale = 0.92 + 0.08 * ease_out_back(t / 0.65)
    card = contain(assets["mochi"], (round(745 * scale), round(1325 * scale)))
    card = rotate_card(card, math.sin(t * 1.5) * 1.3)
    paste_shadow(canvas, card, ((WIDTH - card.width) // 2, 500), 35, (0, 25))
    return canvas


def scene_cta(t: float, assets: dict[str, Image.Image]) -> Image.Image:
    canvas = dotted_background(CREAM, "#f3bdd6")
    draw = ImageDraw.Draw(canvas)
    pill(draw, "YOUR CAMERA ROLL HAS A LEGEND", (WIDTH // 2, 120), YELLOW, INK, 28)
    centered_text(draw, "MEET THEM.", 230, font(130), INK)

    cards = [
        (assets["juno"], -11, 5),
        (assets["leo"], 11, 545),
        (assets["ziggy"], 0, 275),
    ]
    progress = ease_out_back(t / 0.75)
    for index, (card_image, angle, x) in enumerate(cards):
        card = contain(card_image, (530, 940))
        card = rotate_card(card, angle + math.sin(t * 1.8 + index) * 0.8)
        y = round(550 + (1 - progress) * 430 + index * 24)
        paste_shadow(canvas, card, (x, y), 24, (0, 18))

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((110, 1585, 970, 1765), 90, fill=INK)
    draw.text(
        (WIDTH // 2, 1675),
        "rarely.cards  →",
        font=font(58, "bold"),
        fill=WHITE,
        anchor="mm",
    )
    centered_text(draw, "MAKE THEIR ONE-OF-ONE CARD", 1792, font(24, "mono"), INK)
    sparkle(draw, 125, 1510, 32, PINK)
    sparkle(draw, 950, 1530, 38, PURPLE)
    return canvas


def scene_inner_hook(t: float, assets: dict[str, Image.Image]) -> Image.Image:
    zoom = 1.0 + 0.05 * ease_in_out(t / 3.4)
    base = cover(assets["dog"], (round(WIDTH * zoom), round(HEIGHT * zoom)))
    left = (base.width - WIDTH) // 2
    top = (base.height - HEIGHT) // 2
    canvas = base.crop((left, top, left + WIDTH, top + HEIGHT)).convert("RGBA")
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (40, 24, 50, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rectangle((0, 0, WIDTH, 690), fill=(40, 24, 50, 185))
    overlay_draw.rectangle((0, 1470, WIDTH, HEIGHT), fill=(40, 24, 50, 120))
    canvas.alpha_composite(overlay)

    draw = ImageDraw.Draw(canvas)
    brand_tag(draw, light=True)
    pop = ease_out_back(t / 0.7)
    centered_text(
        draw,
        "WHAT IS YOUR PET",
        235,
        font(max(10, round(90 * pop))),
        WHITE,
        stroke_width=2,
        stroke_fill=INK,
    )
    centered_text(
        draw,
        "THINKING\nRIGHT NOW?",
        335,
        font(max(10, round(116 * pop))),
        YELLOW,
        spacing=-4,
        stroke_width=3,
        stroke_fill=INK,
    )
    pill(draw, "THAT FACE IS SAYING SOMETHING.", (WIDTH // 2, 1695), PINK, WHITE, 29)
    return canvas


def scene_inner_know(t: float, assets: dict[str, Image.Image]) -> Image.Image:
    canvas = dotted_background()
    draw = ImageDraw.Draw(canvas)
    brand_tag(draw)
    centered_text(draw, "YOU PROBABLY\nALREADY KNOW.", 190, font(99), INK, spacing=-3)

    photo = rounded_photo(assets["golden"], (760, 930), 64)
    progress = ease_out_back(t / 0.7)
    photo = rotate_card(photo, -2 + math.sin(t * 1.5) * 0.8)
    paste_shadow(canvas, photo, (160, round(555 + (1 - progress) * 380)))

    draw = ImageDraw.Draw(canvas)
    speech_bubble(
        draw,
        "I BROUGHT YOU THIS.\nPLEASE REACT ACCORDINGLY.",
        (90, 1370, 900, 1605),
        YELLOW,
        INK,
        "left",
        37,
    )
    return canvas


def scene_inner_stare(t: float, assets: dict[str, Image.Image]) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), LAVENDER)
    draw = ImageDraw.Draw(canvas)
    for x, y, radius, color in (
        (105, 430, 35, YELLOW),
        (960, 610, 45, PINK),
        (120, 1660, 50, WHITE),
    ):
        sparkle(draw, x, y, radius, color)
    brand_tag(draw)
    centered_text(draw, "THAT STARE.\nTHAT SIGH.", 190, font(112), INK, spacing=-2)

    photo = rounded_photo(assets["cat"], (820, 870), 62)
    progress = ease_out_back(t / 0.7)
    photo = rotate_card(photo, 2 - math.sin(t * 1.5) * 0.8)
    paste_shadow(canvas, photo, (130, round(590 + (1 - progress) * 350)))

    draw = ImageDraw.Draw(canvas)
    speech_bubble(
        draw,
        "FIVE MORE MINUTES.\nTHE SUNSET ISN'T DONE.",
        (135, 1390, 945, 1625),
        WHITE,
        INK,
        "right",
        39,
    )
    return canvas


def scene_inner_reveal(t: float, assets: dict[str, Image.Image]) -> Image.Image:
    canvas = dotted_background(PINK, "#ffb1cf")
    draw = ImageDraw.Draw(canvas)
    brand_tag(draw)
    centered_text(
        draw,
        "RARELY GIVES\nTHAT LOOK A VOICE.",
        175,
        font(88),
        WHITE,
        spacing=-3,
        stroke_width=3,
        stroke_fill=INK,
    )

    scale = 0.9 + 0.1 * ease_out_back(t / 0.7)
    card = contain(assets["juno"], (round(700 * scale), round(1260 * scale)))
    card = rotate_card(card, -2 + math.sin(t * 1.4) * 1.0)
    paste_shadow(canvas, card, ((WIDTH - card.width) // 2, 525), 32, (0, 24))

    draw = ImageDraw.Draw(canvas)
    pill(draw, "“NEEDS FULL ATTENTION.”", (WIDTH // 2, 1710), INK, WHITE, 32)
    return canvas


def scene_inner_voice(t: float, assets: dict[str, Image.Image]) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), MINT)
    draw = ImageDraw.Draw(canvas)
    brand_tag(draw)
    centered_text(draw, "THE VOICE YOU\nALREADY HEAR.", 180, font(105), INK, spacing=-3)

    first = rounded_photo(assets["dog"], (420, 720), 54)
    second = rounded_photo(assets["cat"], (420, 720), 54)
    progress = ease_out_back(t / 0.7)
    paste_shadow(canvas, rotate_card(first, -5), (70, round(590 + (1 - progress) * 400)))
    paste_shadow(canvas, rotate_card(second, 5), (590, round(625 + (1 - progress) * 400)))

    draw = ImageDraw.Draw(canvas)
    speech_bubble(
        draw,
        "DINNER IS\nTHREE MINUTES LATE.",
        (55, 1390, 525, 1595),
        WHITE,
        INK,
        "left",
        31,
    )
    speech_bubble(
        draw,
        "THE SUNSET\nISN'T DONE.",
        (555, 1425, 1025, 1630),
        YELLOW,
        INK,
        "right",
        32,
    )
    return canvas


def scene_inner_cta(t: float, assets: dict[str, Image.Image]) -> Image.Image:
    canvas = dotted_background(CREAM, "#f3bdd6")
    draw = ImageDraw.Draw(canvas)
    pill(draw, "PLAYFUL. PERSONAL. UNIQUELY THEIRS.", (WIDTH // 2, 115), LAVENDER, INK, 25)
    centered_text(draw, "NOT MIND\nREADING.", 245, font(126), INK, spacing=-6)
    centered_text(draw, "JUST THE LOOK YOU KNOW BY HEART.", 530, font(44), HOT_PINK)

    cards = [
        (assets["juno"], -10, 25),
        (assets["ziggy"], 10, 530),
        (assets["leo"], 0, 280),
    ]
    progress = ease_out_back(t / 0.75)
    for index, (card_image, angle, x) in enumerate(cards):
        card = contain(card_image, (525, 940))
        card = rotate_card(card, angle + math.sin(t * 1.7 + index) * 0.8)
        y = round(700 + (1 - progress) * 420 + index * 18)
        paste_shadow(canvas, card, (x, y), 24, (0, 18))

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((95, 1570, 985, 1750), 90, fill=INK)
    draw.text(
        (WIDTH // 2, 1660),
        "Give their inner voice a card  →",
        font=font(39, "bold"),
        fill=WHITE,
        anchor="mm",
    )
    centered_text(draw, "rarely.cards", 1790, font(40, "mono"), INK)
    return canvas


ORIGINAL_SCENES = [
    (0.0, 3.2, scene_hook),
    (3.2, 6.3, scene_photo),
    (6.3, 9.8, scene_reveal),
    (9.8, 13.3, scene_energy),
    (13.3, 16.6, scene_one_of_one),
    (16.6, DURATION, scene_cta),
]

INNER_VOICE_SCENES = [
    (0.0, 3.3, scene_inner_hook),
    (3.3, 6.7, scene_inner_know),
    (6.7, 10.2, scene_inner_voice),
    (10.2, 13.8, scene_inner_reveal),
    (13.8, DURATION, scene_inner_cta),
]


def render_frame(
    timestamp: float,
    assets: dict[str, Image.Image],
    scenes: list[tuple[float, float, object]],
) -> Image.Image:
    scene_index = len(scenes) - 1
    for index, (start, end, _) in enumerate(scenes):
        if start <= timestamp < end:
            scene_index = index
            break

    start, _, renderer = scenes[scene_index]
    current = renderer(timestamp - start, assets)
    transition = 0.22
    if scene_index > 0 and timestamp - start < transition:
        previous_start, _, previous_renderer = scenes[scene_index - 1]
        previous = previous_renderer(timestamp - previous_start, assets)
        mix = ease_in_out((timestamp - start) / transition)
        current = Image.blend(previous.convert("RGB"), current.convert("RGB"), mix).convert("RGBA")
    return current.convert("RGB")


def generate_music(path: Path, duration: float = DURATION) -> None:
    sample_rate = 44100
    total_samples = round(duration * sample_rate)
    bpm = 132
    beat = 60 / bpm
    melody_midi = [72, 76, 79, 76, 69, 72, 76, 72, 65, 69, 72, 69, 67, 71, 74, 79]
    chord_roots = [48, 45, 41, 43]

    def frequency(midi: int) -> float:
        return 440 * 2 ** ((midi - 69) / 12)

    samples = array("h")
    for sample_index in range(total_samples):
        time = sample_index / sample_rate
        beat_index = int(time / beat)
        beat_time = time - beat_index * beat
        chord_index = (beat_index // 4) % len(chord_roots)
        root = chord_roots[chord_index]

        pad = 0.0
        for interval in (0, 4, 7):
            freq = frequency(root + interval)
            pad += math.sin(2 * math.pi * freq * time) * 0.045
        pad *= 0.7 + 0.3 * math.sin(math.pi * (time % (beat * 4)) / (beat * 4))

        note = frequency(melody_midi[beat_index % len(melody_midi)])
        envelope = math.exp(-beat_time * 8.5)
        pluck = envelope * (
            math.sin(2 * math.pi * note * beat_time) * 0.24
            + math.sin(2 * math.pi * note * 2 * beat_time) * 0.06
        )
        if beat_index % 4 == 0:
            pluck += math.exp(-beat_time * 5.0) * math.sin(
                2 * math.pi * frequency(root + 24) * beat_time
            ) * 0.11

        fade_in = min(1.0, time / 0.6)
        fade_out = min(1.0, max(0.0, duration - time) / 1.2)
        value = max(-1.0, min(1.0, (pad + pluck) * fade_in * fade_out))
        samples.append(round(value * 32767))

    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(samples.tobytes())


def run(command: list[str], **kwargs: object) -> None:
    print("+", " ".join(command), flush=True)
    subprocess.run(command, check=True, **kwargs)


def render_video(output: Path, narration: Path, concept: str) -> None:
    work = output.parent / ".rarely-video-work"
    work.mkdir(parents=True, exist_ok=True)
    silent_video = work / "silent.mp4"
    music = work / "music.wav"
    preview = output.with_name(f"{output.stem}-preview.jpg")

    assets = load_assets()
    scenes = INNER_VOICE_SCENES if concept == "inner-voice" else ORIGINAL_SCENES
    preview_frame = render_frame(17.3, assets, scenes)
    preview_frame.save(preview, quality=92)
    generate_music(music)

    command = [
        "ffmpeg",
        "-y",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{WIDTH}x{HEIGHT}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(silent_video),
    ]
    print("+ rendering frames with ffmpeg", flush=True)
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    try:
        for frame_index in range(round(DURATION * FPS)):
            frame = render_frame(frame_index / FPS, assets, scenes)
            process.stdin.write(frame.tobytes())
            if frame_index % FPS == 0:
                print(f"  {frame_index // FPS:02d}s / {DURATION:.0f}s", flush=True)
    finally:
        process.stdin.close()
    if process.wait() != 0:
        raise SystemExit("ffmpeg failed while encoding frames")

    audio_inputs = ["-i", str(music)]
    audio_filter = "[1:a]volume=0.32,pan=stereo|c0=c0|c1=c0[music]"
    if narration.exists():
        audio_inputs += ["-i", str(narration)]
        audio_filter += (
            ";[2:a]volume=1.28,highpass=f=90,lowpass=f=12000[voice]"
            ";[music][voice]amix=inputs=2:duration=longest:dropout_transition=0[raw]"
            ";[raw]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[mix]"
        )
    else:
        audio_filter += ";[music]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[mix]"

    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(silent_video),
            *audio_inputs,
            "-filter_complex",
            audio_filter if narration.exists() else audio_filter,
            "-map",
            "0:v:0",
            "-map",
            "[mix]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-t",
            str(DURATION),
            "-movflags",
            "+faststart",
            str(output),
        ]
    )
    silent_video.unlink(missing_ok=True)
    music.unlink(missing_ok=True)
    work.rmdir()
    print(f"Created {output.relative_to(ROOT)}", flush=True)
    print(f"Created {preview.relative_to(ROOT)}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--concept",
        choices=("original", "inner-voice"),
        default="original",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "marketing/rarely-marketing-vertical.mp4",
    )
    parser.add_argument(
        "--narration",
        type=Path,
        default=ROOT / "marketing/rarely-narration.mp3",
    )
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    render_video(args.output.resolve(), args.narration.resolve(), args.concept)


if __name__ == "__main__":
    random.seed(7)
    main()
