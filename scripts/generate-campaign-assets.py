#!/usr/bin/env python3
"""Generate ten Rarely vertical campaign images and captioned videos."""

from __future__ import annotations

import asyncio
import argparse
import math
import shutil
import subprocess
import sys
import wave
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEPS = ROOT / "scripts/.video-deps"
sys.path.insert(0, str(DEPS))

try:
    from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
    import edge_tts
except ImportError as exc:
    raise SystemExit(
        "Pillow and edge-tts are required. Run: python3 -m pip install --target "
        "scripts/.video-deps pillow edge-tts"
    ) from exc


WIDTH, HEIGHT = 1080, 1920
FPS = 30
MIN_VIDEO_SECONDS = 15.0

INK = "#241a44"
INK_RGB = (36, 26, 68)
CREAM = "#fffdf8"
PINK = "#f4458f"
SOFT_PINK = "#ff9cc5"
PALE_PINK = "#ffd3e5"
YELLOW = "#ffe36e"
PURPLE = "#a98cf4"
MINT = "#7ee3d1"
WHITE = "#ffffff"

FONT_BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf")
FONT_REGULAR = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
FONT_MONO = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf")

OUTPUT = ROOT / "marketing/campaigns"
IMAGE_OUTPUT = OUTPUT / "images"
VIDEO_OUTPUT = OUTPUT / "videos"
VOICE_OUTPUT = OUTPUT / "voiceovers"
SELECT_OUTPUT = OUTPUT / "production-selects"
WORK_OUTPUT = OUTPUT / ".render-work"


CAMPAIGNS = [
    {
        "slug": "01-the-most-them-photo",
        "name": "The Most Them Photo",
        "template": "camera",
        "hook": ["NOT THE BEST", "PHOTO.", "THE MOST THEM."],
        "sub": "You know exactly which one.",
        "proof": "PERSONALITY, NOT POLISH.",
        "detail": "Seen the way you see them.",
        "cta": "MAKE THEIR CARD",
        "voiceover": (
            "Not the best photo. The one where their ears do that thing—judging "
            "you or loving you, impossible to tell. That's the whole personality. "
            "Rarely turns it into a one-of-one card you can keep or share."
        ),
        "caption_hook": "the wrong photo",
        "caption_mid": "the most them",
        "caption_payoff": "seen the way you see them",
        "end_headline": "SEEN THE WAY\nYOU SEE THEM.",
        "end_line": "PERSONALITY, NOT POLISH",
        "photo": "juno_photo",
        "card": "juno",
        "bg": PALE_PINK,
        "accent": YELLOW,
    },
    {
        "slug": "02-group-chat-knows",
        "name": "The Group Chat Knows",
        "template": "chat",
        "hook": ["YOUR FRIENDS", "DON’T NEED", "THE NAME."],
        "sub": "One photo and they are already laughing.",
        "proof": "THE FACE THEY ALREADY KNOW.",
        "detail": "More than cute. Unmistakable.",
        "cta": "MAKE THEIR CARD",
        "voiceover": (
            "No caption needed. Your friend sees the tilt of the head and says "
            "their name before you type it. That's unmistakable. Rarely turns "
            "that recognition into a card made to drop straight back into the chat."
        ),
        "caption_hook": "no caption needed",
        "caption_mid": "before you say the name",
        "caption_payoff": "unmistakable",
        "end_headline": "THE FACE THEY\nALREADY KNOW.",
        "end_line": "MAKE THE UNMISTAKABLE VISIBLE",
        "photo": "leo_photo",
        "card": "leo",
        "bg": YELLOW,
        "accent": PINK,
    },
    {
        "slug": "03-the-private-voice",
        "name": "The Voice Nobody Hears",
        "template": "voice",
        "hook": ["YOU STILL TALK", "TO THEM IN", "THAT VOICE."],
        "sub": "Good. Put the full confession on a card.",
        "proof": "ONLY YOU TWO KNOW THE SCRIPT.",
        "detail": "Little phrases. Little judgments. Little love.",
        "cta": "GIVE THEIR VOICE A CARD",
        "voiceover": (
            "You still talk to them in that voice. Good. Love gets strange when "
            "it feels safe. Rarely turns those little phrases, judgments, and bits "
            "of love into a one-of-one card you can keep or share."
        ),
        "caption_hook": "that voice",
        "caption_mid": "only you two",
        "caption_payoff": "without making it smaller",
        "end_headline": "WRITE DOWN THE VOICE\nONLY YOU HEAR.",
        "end_line": "LITTLE PHRASES · LITTLE LOVE",
        "photo": "mochi_photo",
        "card": "mochi",
        "bg": PURPLE,
        "accent": YELLOW,
    },
    {
        "slug": "04-same-spot-every-day",
        "name": "Same Spot Every Day",
        "template": "camera",
        "hook": ["SAME SPOT.", "SAME ROUTINE.", "EVERY DAY."],
        "sub": "Not for the feed. Keep this one for yourself.",
        "proof": "THE WHOLE MAP OF HOME.",
        "detail": "The ritual you never had to name.",
        "cta": "MAKE THEIR CARD",
        "voiceover": (
            "Same cushion. Same hour. Same little sigh when the house gets quiet. "
            "It isn't boring. It's the whole map of home. Rarely gives that ritual "
            "a name, a card, and something beautiful to share."
        ),
        "caption_hook": "same cushion. same hour.",
        "caption_mid": "the whole map",
        "caption_payoff": "give the ritual a name",
        "end_headline": "GIVE THE RITUAL\nA NAME.",
        "end_line": "THE WHOLE MAP OF HOME",
        "photo": "juno_photo",
        "card": "juno",
        "bg": MINT,
        "accent": YELLOW,
    },
    {
        "slug": "05-the-ordinary-photo",
        "name": "The Ordinary Photo",
        "template": "milestone",
        "hook": ["TAKE THE", "ORDINARY", "PHOTO."],
        "sub": "The one where absolutely nothing is happening.",
        "proof": "A DAY WITH NO HEADLINE.",
        "detail": "Still worth holding onto.",
        "cta": "MAKE THEIR CARD",
        "voiceover": (
            "Nothing happened today. No party. No milestone. Just them, mid-yawn, "
            "stealing the good light. Rarely turns that unremarkable moment into "
            "a beautiful card you can keep, post, or send."
        ),
        "caption_hook": "nothing happened today",
        "caption_mid": "the almost-delete",
        "caption_payoff": "hold the unremarkable day",
        "end_headline": "HOLD THE\nUNREMARKABLE DAY.",
        "end_line": "A DAY WITH NO HEADLINE",
        "photo": "ziggy_photo",
        "card": "ziggy",
        "bg": CREAM,
        "accent": PINK,
    },
    {
        "slug": "06-first-ride-home",
        "name": "The First Ride Home",
        "template": "milestone",
        "hook": ["YOU REMEMBER", "THE FIRST", "RIDE HOME."],
        "sub": "Same face. Much better at crime now.",
        "proof": "BEFORE YOU KNEW EACH OTHER.",
        "detail": "Somehow, the beginning already looked like them.",
        "cta": "MAKE THEIR CARD",
        "voiceover": (
            "Car seat. Eyes too wide for the world. One photo, before you knew "
            "their habits or the shape they'd make in your life. Rarely turns the "
            "beginning into a one-of-one card worth keeping and sharing."
        ),
        "caption_hook": "the first ride home",
        "caption_mid": "before you knew each other",
        "caption_payoff": "the beginning already knew",
        "end_headline": "KEEP THE\nBEGINNING CLEAR.",
        "end_line": "THE START, STILL LEGIBLE",
        "photo": "leo_photo",
        "card": "leo",
        "bg": INK,
        "accent": PINK,
    },
    {
        "slug": "07-whole-cast-one-pet",
        "name": "One Pet, A Whole Cast",
        "template": "camera",
        "hook": ["SAME PET.", "FIVE DIFFERENT", "PERSONALITIES."],
        "sub": "Every version deserves its own frame.",
        "proof": "ONE PET. A WHOLE CAST.",
        "detail": "The angel, the suspect, the comedian, the boss.",
        "cta": "MAKE THEIR CARDS",
        "voiceover": (
            "Same pet. Completely different person every hour. The angel, the "
            "suspect, the comedian, the tiny boss. Rarely turns each unmistakable "
            "version into its own card, so the whole cast can be kept and shared."
        ),
        "caption_hook": "same pet",
        "caption_mid": "a whole cast",
        "caption_payoff": "each version gets a card",
        "end_headline": "ONE PET.\nA WHOLE CAST.",
        "end_line": "LET EACH VERSION TAKE THE FRAME",
        "photo": "ziggy_photo",
        "card": "ziggy",
        "bg": PALE_PINK,
        "accent": MINT,
    },
    {
        "slug": "08-the-pet-spammer",
        "name": "The Pet Spammer",
        "template": "gift",
        "hook": ["FOR THE PERSON", "WHO SENDS 12", "PET PHOTOS."],
        "sub": "Before breakfast. You know who.",
        "proof": "LOVE LANGUAGE: PET PHOTO.",
        "detail": "That is how they let you into their little life.",
        "cta": "MAKE A CARD",
        "voiceover": (
            "They don't text to ask how you are. They send a blurry ear at eleven "
            "p.m. That's a check-in. Rarely turns one of those photos into a card "
            "you can send back—a small way to say, I see why this little life matters."
        ),
        "caption_hook": "love language: pet photo",
        "caption_mid": "that's the check-in",
        "caption_payoff": "let them know you see it",
        "end_headline": "SEND THE INSIDE\nJOKE BACK.",
        "end_line": "LET THEM KNOW YOU SEE IT TOO",
        "photo": "mochi_photo",
        "card": "mochi",
        "bg": CREAM,
        "accent": PURPLE,
    },
    {
        "slug": "09-the-guilty-one",
        "name": "The Guilty One",
        "template": "suspicious",
        "hook": ["USE THE", "GUILTY ONE."],
        "sub": "Worst angle. No remorse. Full statement.",
        "proof": "DIGNITY QUESTIONABLE. LOVE UNDENIABLE.",
        "detail": "The wrong photo deserves to be taken seriously.",
        "cta": "SHOW US THE LOOK",
        "voiceover": (
            "Bad light. Guilty as charged. That's the face you get when nobody is "
            "performing—chin up, dignity questionable, love undeniable. Rarely "
            "turns the wrong photo into a wonderful one-of-one card worth sharing."
        ),
        "caption_hook": "bad light. guilty.",
        "caption_mid": "dignity questionable",
        "caption_payoff": "love undeniable",
        "end_headline": "TAKE THE WRONG PHOTO\nSERIOUSLY.",
        "end_line": "DIGNITY QUESTIONABLE · LOVE UNDENIABLE",
        "photo": "leo_photo",
        "card": "leo",
        "bg": SOFT_PINK,
        "accent": YELLOW,
    },
    {
        "slug": "10-the-quiet-parts",
        "name": "The Quiet Parts",
        "template": "recognition",
        "hook": ["THEY’RE IN", "ALL OF IT."],
        "sub": "The couch. The car. The quiet parts.",
        "proof": "CENTER WHAT WAS ALWAYS THERE.",
        "detail": "The quiet co-star of a whole life.",
        "cta": "MAKE THEIR CARD",
        "voiceover": (
            "They have no idea how much of your life has them in it. The couch. "
            "The car. The quiet parts. They think they're just sitting beside you. "
            "Rarely turns one quiet moment into a card you can keep and share—the "
            "little co-star finally centered."
        ),
        "caption_hook": "they're in all of it",
        "caption_mid": "the quiet parts",
        "caption_payoff": "holding whole years together",
        "end_headline": "CENTER WHAT WAS\nALWAYS THERE.",
        "end_line": "THE QUIET CO-STAR OF A WHOLE LIFE",
        "photo": "juno_photo",
        "card": "juno",
        "bg": CREAM,
        "accent": PINK,
    },
]


def font(size: int, kind: str = "bold") -> ImageFont.FreeTypeFont:
    path = {"bold": FONT_BOLD, "regular": FONT_REGULAR, "mono": FONT_MONO}[kind]
    return ImageFont.truetype(str(path), size)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    source = image.convert("RGB")
    target_ratio = size[0] / size[1]
    source_ratio = source.width / source.height
    if source_ratio > target_ratio:
        width = round(source.height * target_ratio)
        left = (source.width - width) // 2
        source = source.crop((left, 0, left + width, source.height))
    else:
        height = round(source.width / target_ratio)
        top = (source.height - height) // 2
        source = source.crop((0, top, source.width, top + height))
    return source.resize(size, Image.Resampling.LANCZOS)


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = min(size[0] / image.width, size[1] / image.height)
    dimensions = (
        max(1, round(image.width * scale)),
        max(1, round(image.height * scale)),
    )
    return image.resize(dimensions, Image.Resampling.LANCZOS)


def rounded_image(
    image: Image.Image,
    size: tuple[int, int],
    radius: int = 48,
    border: int = 0,
) -> Image.Image:
    fitted = cover(image, size).convert("RGBA")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (border, border, size[0] - border, size[1] - border),
        radius,
        fill=255,
    )
    fitted.putalpha(mask)
    if border:
        frame = Image.new("RGBA", size, (0, 0, 0, 0))
        ImageDraw.Draw(frame).rounded_rectangle(
            (border // 2, border // 2, size[0] - border // 2, size[1] - border // 2),
            radius,
            outline=INK,
            width=border,
        )
        fitted.alpha_composite(frame)
    return fitted


def paste_shadow(
    canvas: Image.Image,
    item: Image.Image,
    xy: tuple[int, int],
    blur: int = 24,
    offset: tuple[int, int] = (12, 18),
) -> None:
    rgba = item.convert("RGBA")
    shadow = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    alpha = rgba.getchannel("A")
    shadow.putalpha(alpha.point(lambda value: round(value * 0.28)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(shadow, (xy[0] + offset[0], xy[1] + offset[1]))
    canvas.alpha_composite(rgba, xy)


def rotate(image: Image.Image, degrees: float) -> Image.Image:
    return image.convert("RGBA").rotate(
        degrees,
        resample=Image.Resampling.BICUBIC,
        expand=True,
        fillcolor=(0, 0, 0, 0),
    )


def wrap(draw: ImageDraw.ImageDraw, text: str, text_font: ImageFont.FreeTypeFont, width: int) -> str:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        box = draw.textbbox((0, 0), candidate, font=text_font)
        if current and box[2] - box[0] > width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return "\n".join(lines)


def centered(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    size: int,
    fill: str = INK,
    kind: str = "bold",
    max_width: int = 940,
    spacing: int = 4,
    stroke: int = 0,
    stroke_fill: str = INK,
) -> int:
    text_font = font(size, kind)
    wrapped = "\n".join(
        wrap(draw, line, text_font, max_width) for line in text.splitlines()
    )
    box = draw.multiline_textbbox(
        (0, 0), wrapped, font=text_font, spacing=spacing, align="center",
        stroke_width=stroke,
    )
    text_width = box[2] - box[0]
    text_height = box[3] - box[1]
    draw.multiline_text(
        ((WIDTH - text_width) // 2, y),
        wrapped,
        font=text_font,
        fill=fill,
        spacing=spacing,
        align="center",
        stroke_width=stroke,
        stroke_fill=stroke_fill,
    )
    return y + text_height


def pill(
    draw: ImageDraw.ImageDraw,
    text: str,
    center: tuple[int, int],
    fill: str,
    text_fill: str = INK,
    size: int = 32,
    outline: str | None = INK,
) -> None:
    text_font = font(size)
    box = draw.textbbox((0, 0), text, font=text_font)
    width = box[2] - box[0] + 70
    height = box[3] - box[1] + 42
    x = center[0] - width // 2
    y = center[1] - height // 2
    draw.rounded_rectangle(
        (x, y, x + width, y + height),
        height // 2,
        fill=fill,
        outline=outline,
        width=5 if outline else 0,
    )
    draw.text(center, text, font=text_font, fill=text_fill, anchor="mm")


def star(draw: ImageDraw.ImageDraw, x: int, y: int, radius: int, fill: str) -> None:
    points = []
    for index in range(16):
        angle = -math.pi / 2 + index * math.pi / 8
        length = radius if index % 2 == 0 else radius * 0.32
        points.append((x + math.cos(angle) * length, y + math.sin(angle) * length))
    draw.polygon(points, fill=fill)


def background(color: str, motif: str = "dots") -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), color)
    draw = ImageDraw.Draw(canvas)
    pattern = PINK if color in (CREAM, PALE_PINK) else WHITE
    if motif == "dots":
        for y in range(20, HEIGHT, 42):
            for x in range(20 + (y // 42 % 2) * 18, WIDTH, 42):
                draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=pattern)
    elif motif == "grid":
        for x in range(0, WIDTH, 90):
            draw.line((x, 0, x, HEIGHT), fill=pattern, width=2)
        for y in range(0, HEIGHT, 90):
            draw.line((0, y, WIDTH, y), fill=pattern, width=2)
    elif motif == "rays":
        for angle in range(0, 360, 20):
            end = (
                WIDTH // 2 + math.cos(math.radians(angle)) * 1500,
                980 + math.sin(math.radians(angle)) * 1500,
            )
            draw.line((WIDTH // 2, 980, *end), fill=pattern, width=16)
    return canvas


def brand(draw: ImageDraw.ImageDraw, light: bool = False) -> None:
    color = WHITE if light else INK
    draw.text((58, 55), "RARELY ★", font=font(43), fill=color)
    draw.text((58, 112), "ONE PHOTO · ONE-OF-ONE", font=font(20, "mono"), fill=color)


def load_assets() -> dict[str, Image.Image]:
    card_crop = (14, 94, 377, 754)
    photo_crop = (31, 176, 358, 484)
    juno = Image.open(ROOT / "juno-card-preview.png").convert("RGBA")
    leo = Image.open(ROOT / "leo-card-preview.png").convert("RGBA")
    ziggy = Image.open(ROOT / "ziggy-card-preview.png").convert("RGBA")
    mochi = Image.open(ROOT / "mochi-snack-card-preview.png").convert("RGBA")
    return {
        "golden": Image.open(ROOT / "public/pets/golden-dog.jpg").convert("RGB"),
        "cat": Image.open(ROOT / "public/pets/window-cat.jpg").convert("RGB"),
        "dog": Image.open(ROOT / "public/pets/quiet-dog.jpg").convert("RGB"),
        "juno": juno.crop(card_crop),
        "leo": leo.crop(card_crop),
        "ziggy": ziggy.crop(card_crop),
        "mochi": mochi.crop(card_crop),
        "juno_photo": juno.crop(photo_crop).convert("RGB"),
        "leo_photo": leo.crop(photo_crop).convert("RGB"),
        "ziggy_photo": ziggy.crop(photo_crop).convert("RGB"),
        "mochi_photo": mochi.crop(photo_crop).convert("RGB"),
    }


def headline(draw: ImageDraw.ImageDraw, campaign: dict[str, str], light: bool = False) -> int:
    fill = WHITE if light else INK
    return centered(
        draw,
        "\n".join(campaign["hook"]),
        190,
        91 if len(campaign["hook"]) > 2 else 108,
        fill,
        spacing=-5,
        stroke=3 if light else 0,
    )


def footer(draw: ImageDraw.ImageDraw, campaign: dict[str, str], light: bool = False) -> None:
    fill = WHITE if light else INK
    pill(draw, campaign["cta"], (WIDTH // 2, 1730), campaign["accent"], INK, 30)
    draw.text((WIDTH // 2, 1834), "rarely.cards", font=font(38, "mono"), fill=fill, anchor="mm")


def render_poster(campaign: dict[str, str], assets: dict[str, Image.Image]) -> Image.Image:
    template = campaign["template"]
    light = campaign["bg"] == INK
    canvas = background(campaign["bg"], "rays" if template == "rarity" else "dots")
    draw = ImageDraw.Draw(canvas)
    brand(draw, light)
    bottom = headline(draw, campaign, light)
    photo = assets[campaign["photo"]]
    card = assets[campaign["card"]]

    if template == "recognition":
        portrait = rounded_image(photo, (690, 820), 56, 7)
        paste_shadow(canvas, rotate(portrait, -3), (45, 575))
        card_art = rotate(contain(card, (470, 855)), 6)
        paste_shadow(canvas, card_art, (570, 705))
        pill(draw, campaign["sub"], (WIDTH // 2, 1510), WHITE, INK, 24)
    elif template == "suspicious":
        draw.rounded_rectangle((70, 540, 1010, 1440), 24, fill=CREAM, outline=INK, width=8)
        draw.text((105, 575), "CASE FILE  /  LOOK #001", font=font(25, "mono"), fill=PINK)
        portrait = rounded_image(photo, (770, 680), 28)
        canvas.alpha_composite(portrait, (155, 650))
        draw.rectangle((105, 1255, 975, 1375), fill=PINK)
        draw.text((540, 1315), "STATUS: EXTREMELY SUSPICIOUS", font=font(31), fill=WHITE, anchor="mm")
        draw.line((80, 520, 1015, 1450), fill=INK, width=5)
    elif template == "rarity":
        portrait = rounded_image(photo, (820, 790), 70, 8)
        paste_shadow(canvas, portrait, (130, 585))
        draw.rounded_rectangle((730, 1150, 980, 1400), 42, fill=CREAM, outline=INK, width=8)
        draw.text((855, 1200), "RARITY", font=font(28, "mono"), fill=PINK, anchor="mm")
        draw.text((855, 1305), "??", font=font(108), fill=INK, anchor="mm")
        pill(draw, "COMMENT YOUR GUESS", (WIDTH // 2, 1510), YELLOW, INK, 28)
    elif template == "voice":
        portrait = rounded_image(photo, (760, 790), 66, 7)
        paste_shadow(canvas, rotate(portrait, -2), (160, 560))
        draw.rounded_rectangle((105, 1315, 975, 1530), 48, fill=WHITE, outline=INK, width=7)
        draw.polygon(((200, 1525), (130, 1610), (290, 1525)), fill=WHITE)
        draw.line((200, 1525, 130, 1610, 290, 1525), fill=INK, width=7)
        centered(draw, "“I BROUGHT YOU THIS.\nREACT ACCORDINGLY.”", 1370, 38, INK, max_width=760)
    elif template == "five":
        cards = ["juno", "mochi", "ziggy", "leo", "juno"]
        for index, key in enumerate(cards):
            item = contain(assets[key], (330, 600))
            item = rotate(item, -14 + index * 7)
            paste_shadow(canvas, item, (25 + index * 185, 610 + abs(2 - index) * 45), 14, (5, 10))
        draw.rounded_rectangle((210, 1340, 870, 1555), 30, fill=YELLOW, outline=INK, width=8)
        draw.text((540, 1400), "LOVED ACCURATELY", font=font(39, "mono"), fill=INK, anchor="mm")
        draw.text((540, 1490), "A HOUSEHOLD, NOT A CROWD", font=font(27), fill=INK, anchor="mm")
    elif template == "camera":
        draw.rounded_rectangle((105, 545, 720, 1510), 75, fill="#111019", outline=WHITE, width=8)
        draw.rounded_rectangle((132, 610, 693, 1435), 35, fill=CREAM)
        portrait = rounded_image(photo, (520, 700), 25)
        canvas.alpha_composite(portrait, (152, 675))
        draw.text((412, 650), "THE ONE YOU KEEP OPENING", font=font(20, "mono"), fill=INK, anchor="mm")
        card_art = rotate(contain(card, (430, 785)), 6)
        paste_shadow(canvas, card_art, (615, 745))
        pill(draw, "PRIVATE UNTIL YOU SHARE", (WIDTH // 2, 1575), PINK, WHITE, 24)
    elif template == "chat":
        portrait = rounded_image(photo, (650, 620), 48, 6)
        paste_shadow(canvas, portrait, (215, 560))
        draw.rounded_rectangle((85, 1220, 760, 1375), 50, fill=WHITE, outline=INK, width=6)
        draw.text((125, 1270), "okay this is literally them", font=font(37), fill=INK)
        draw.rounded_rectangle((320, 1410, 990, 1565), 50, fill=MINT, outline=INK, width=6)
        draw.text((655, 1488), "send the full card immediately", font=font(31), fill=INK, anchor="mm")
    elif template == "process":
        labels = [("01", "ADD PHOTO", photo), ("02", "READ FRAME", photo), ("03", "KEEP CARD", card)]
        for index, (number, label, image) in enumerate(labels):
            x = 55 + index * 340
            draw.rounded_rectangle((x, 585, x + 300, 1435), 38, fill=WHITE, outline=INK, width=7)
            draw.text((x + 30, 620), number, font=font(43, "mono"), fill=PINK)
            draw.text((x + 30, 690), label, font=font(27), fill=INK)
            art = rounded_image(image.convert("RGB"), (250, 610), 25) if index < 2 else contain(image, (250, 610))
            canvas.alpha_composite(art.convert("RGBA"), (x + 25, 775))
        centered(draw, campaign["sub"], 1490, 28, INK, max_width=900)
    elif template == "gift":
        draw.polygon(((105, 720), (975, 720), (900, 1510), (180, 1510)), fill=CREAM, outline=INK)
        draw.line((105, 720, 540, 1120, 975, 720), fill=INK, width=8)
        card_art = rotate(contain(card, (515, 935)), -4)
        paste_shadow(canvas, card_art, (300, 655))
        draw.polygon(((105, 720), (540, 1170), (975, 720)), fill=YELLOW, outline=INK)
        draw.text((540, 960), "FOR YOUR FAVORITE\nPET PERSON", font=font(43), fill=INK, anchor="mm", align="center")
        pill(draw, "THE INSIDE JOKE, SENT BACK", (WIDTH // 2, 1555), WHITE, INK, 24)
    elif template == "milestone":
        draw.rounded_rectangle((80, 535, 1000, 1510), 20, fill=WHITE, outline=INK, width=7)
        portrait = rounded_image(photo, (790, 670), 8)
        canvas.alpha_composite(portrait, (145, 600))
        draw.rectangle((125, 1320, 955, 1435), fill=campaign["accent"])
        draw.text((540, 1378), "THE LOOK WE STILL TALK ABOUT", font=font(33), fill=WHITE, anchor="mm")
        draw.text((850, 565), "★  KEEP THIS ONE", font=font(20, "mono"), fill=PINK, anchor="mm")

    footer(draw, campaign, light)
    return canvas.convert("RGB")


def caption_plate(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    *,
    light: bool = False,
    size: int = 63,
) -> None:
    text_font = font(size)
    wrapped = wrap(draw, text.upper(), text_font, 850)
    box = draw.multiline_textbbox((0, 0), wrapped, font=text_font, spacing=-2, align="center")
    width = box[2] - box[0] + 72
    height = box[3] - box[1] + 54
    x = (WIDTH - width) // 2
    fill = INK if light else CREAM
    text_fill = CREAM if light else INK
    draw.rounded_rectangle((x, y, x + width, y + height), 28, fill=fill)
    draw.multiline_text(
        (WIDTH // 2, y + height // 2),
        wrapped,
        font=text_font,
        fill=text_fill,
        spacing=-2,
        align="center",
        anchor="mm",
    )


def render_hook_scene(campaign: dict[str, str], assets: dict[str, Image.Image]) -> Image.Image:
    photo = assets[campaign["photo"]]
    canvas = cover(photo, (WIDTH, HEIGHT)).filter(ImageFilter.GaussianBlur(34)).convert("RGBA")
    canvas = ImageEnhance.Brightness(canvas).enhance(0.48)
    portrait = rounded_image(photo, (920, 1060), 38, 5)
    paste_shadow(canvas, portrait, (80, 250), 28, (0, 22))
    draw = ImageDraw.Draw(canvas)
    draw.text((55, 75), "sound on  ↑", font=font(23, "mono"), fill=WHITE)
    caption_plate(draw, campaign["caption_hook"], 1395, light=True, size=66)
    return canvas.convert("RGB")


def render_photo_scene(campaign: dict[str, str], assets: dict[str, Image.Image]) -> Image.Image:
    photo = assets[campaign["photo"]]
    canvas = background(CREAM)
    draw = ImageDraw.Draw(canvas)
    draw.text((58, 58), "THE PHOTO YOU KNOW", font=font(23, "mono"), fill=PINK)
    draw.rounded_rectangle((95, 210, 985, 1425), 68, fill=INK, outline=INK, width=6)
    draw.rounded_rectangle((128, 270, 952, 1350), 40, fill="#111019")
    portrait = rounded_image(photo, (780, 900), 24)
    canvas.alpha_composite(portrait, (150, 350))
    draw.ellipse((500, 295, 580, 375), fill=INK, outline=WHITE, width=3)
    caption_plate(draw, campaign["caption_mid"], 1515, size=58)
    draw.text(
        (WIDTH // 2, 1785),
        "one real photo",
        font=font(24, "mono"),
        fill=INK,
        anchor="mm",
    )
    return canvas.convert("RGB")


def render_card_scene(campaign: dict[str, str], assets: dict[str, Image.Image]) -> Image.Image:
    canvas = background(campaign["accent"])
    draw = ImageDraw.Draw(canvas)
    draw.text((58, 58), "RARELY ★", font=font(39), fill=INK)
    caption_plate(draw, campaign["caption_payoff"], 165, size=58)
    card = contain(assets[campaign["card"]], (740, 1335))
    card = rotate(card, -2)
    paste_shadow(canvas, card, ((WIDTH - card.width) // 2, 385), 34, (12, 24))
    centered(draw, "title · rarity · ratings · their take", 1740, 22, INK, kind="mono")
    return canvas.convert("RGB")


def render_cta_scene(campaign: dict[str, str], assets: dict[str, Image.Image]) -> Image.Image:
    canvas = background(CREAM)
    draw = ImageDraw.Draw(canvas)
    draw.text((58, 58), "RARELY ★", font=font(43), fill=INK)
    centered(draw, campaign["end_headline"], 190, 72, INK, spacing=-3)
    photo = rounded_image(assets[campaign["photo"]], (495, 720), 45, 6)
    card = contain(assets[campaign["card"]], (500, 900))
    paste_shadow(canvas, rotate(photo, -5), (65, 690), 22, (5, 16))
    paste_shadow(canvas, rotate(card, 5), (520, 620), 22, (5, 16))
    pill(draw, campaign["end_line"], (WIDTH // 2, 1515), YELLOW, INK, 23)
    draw.rounded_rectangle((90, 1615, 990, 1775), 80, fill=INK)
    draw.text((WIDTH // 2, 1695), "rarely.cards  →", font=font(40), fill=WHITE, anchor="mm")
    centered(draw, "ONE-OF-ONE CARD · KEEP OR SHARE", 1820, 22, PINK, kind="mono")
    return canvas.convert("RGB")


def generate_music(path: Path, seed: int, duration: float) -> None:
    sample_rate = 44100
    total_samples = round(duration * sample_rate)
    base_notes = [110, 123.47, 130.81, 146.83, 164.81]
    root = base_notes[seed % len(base_notes)]
    samples = array("h")
    for index in range(total_samples):
        time = index / sample_rate
        chord_step = int(time / 4) % 4
        chord_root = root * (2 ** ([0, -2, 3, 5][chord_step] / 12))
        swell = 0.55 + 0.45 * math.sin(math.pi * (time % 4) / 4)
        pad = swell * (
            math.sin(2 * math.pi * chord_root * time) * 0.09
            + math.sin(2 * math.pi * chord_root * 1.5 * time) * 0.045
            + math.sin(2 * math.pi * chord_root * 2 * time) * 0.025
        )
        bell_time = time % 2
        bell = (
            math.exp(-bell_time * 5)
            * math.sin(2 * math.pi * chord_root * 4 * bell_time)
            * 0.035
        )
        fade = min(1.0, time / 1.2, (duration - time) / 1.5)
        value = max(-1.0, min(1.0, (pad + bell) * max(0.0, fade)))
        samples.append(round(value * 32767))
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(samples.tobytes())


def audio_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


async def synthesize_voiceover(campaign: dict[str, str]) -> Path:
    VOICE_OUTPUT.mkdir(parents=True, exist_ok=True)
    media = VOICE_OUTPUT / f"{campaign['slug']}.mp3"
    script = VOICE_OUTPUT / f"{campaign['slug']}.txt"
    text = campaign["voiceover"]
    if media.exists() and script.exists() and script.read_text() == text:
        return media
    rate = "-3%" if campaign["template"] in {"chat", "five", "gift", "suspicious"} else "-8%"
    communicate = edge_tts.Communicate(
        text,
        "en-US-AvaMultilingualNeural",
        rate=rate,
        pitch="-2Hz",
        volume="+0%",
    )
    await communicate.save(str(media))
    script.write_text(text)
    return media


def render_video(
    slug: str,
    scene_paths: list[Path],
    voiceover: Path,
    index: int,
) -> Path:
    output = VIDEO_OUTPUT / f"{slug}.mp4"
    music = WORK_OUTPUT / f"{slug}-music.wav"
    duration = max(MIN_VIDEO_SECONDS, audio_duration(voiceover) + 1.0)
    total_frames = math.ceil(duration * FPS)
    ratios = [0.18, 0.22, 0.35, 0.25]
    frame_counts = [round(total_frames * ratio) for ratio in ratios[:-1]]
    frame_counts.append(total_frames - sum(frame_counts))
    duration = total_frames / FPS
    generate_music(music, index, duration)
    command = ["ffmpeg", "-y"]
    for scene in scene_paths:
        command.extend(["-i", str(scene)])
    command.extend(["-i", str(music)])
    command.extend(["-i", str(voiceover)])
    filters = []
    for scene_index in range(4):
        frames = frame_counts[scene_index]
        # Hold each composition still. Simulated handheld motion and per-shot
        # zoom resets made pet photos appear to shake on mobile screens.
        filters.append(
            f"[{scene_index}:v]loop=loop={frames - 1}:size=1:start=0,"
            f"trim=end_frame={frames},setpts=N/({FPS}*TB),"
            "format=yuv420p,setsar=1"
            f"[v{scene_index}]"
        )
    filters.append("[v0][v1][v2][v3]concat=n=4:v=1:a=0[outv]")
    filters.append(
        f"[4:a]volume=0.10,afade=t=in:st=0:d=1,"
        f"afade=t=out:st={max(0, duration - 1.5):.2f}:d=1.5,"
        "aformat=sample_rates=48000:channel_layouts=stereo[music]"
    )
    filters.append(
        "[5:a]adelay=120|120,volume=1.12,highpass=f=75,"
        "lowpass=f=11000,"
        "aformat=sample_rates=48000:channel_layouts=stereo[voice]"
    )
    filters.append(
        "[music][voice]amix=inputs=2:duration=longest:dropout_transition=0,"
        "loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000[aout]"
    )
    command.extend(
        [
            "-filter_complex",
            ";".join(filters),
            "-map",
            "[outv]",
            "-map",
            "[aout]",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "21",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-t",
            f"{duration:.3f}",
            "-movflags",
            "+faststart",
            str(output),
        ]
    )
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL)
    return output


def create_contact_sheet(images: list[Image.Image], output: Path) -> None:
    thumb_width, thumb_height = 270, 480
    rows = math.ceil(len(images) / 5)
    sheet = Image.new("RGB", (thumb_width * 5, thumb_height * rows), CREAM)
    for index, image in enumerate(images):
        thumbnail = image.copy().convert("RGB")
        thumbnail.thumbnail((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        sheet.paste(thumbnail, ((index % 5) * thumb_width, (index // 5) * thumb_height))
    sheet.save(output, quality=92)


def main(*, visuals_only: bool = False) -> None:
    IMAGE_OUTPUT.mkdir(parents=True, exist_ok=True)
    VIDEO_OUTPUT.mkdir(parents=True, exist_ok=True)
    VOICE_OUTPUT.mkdir(parents=True, exist_ok=True)
    SELECT_OUTPUT.mkdir(parents=True, exist_ok=True)
    WORK_OUTPUT.mkdir(parents=True, exist_ok=True)
    assets = load_assets()
    posters: list[Image.Image] = []
    video_frames: list[Image.Image] = []
    production_frames: list[Image.Image] = []

    for index, campaign in enumerate(CAMPAIGNS, start=1):
        slug = campaign["slug"]
        print(f"[{index:02d}/10] {campaign['name']}", flush=True)
        poster = render_poster(campaign, assets)
        scenes = [
            render_hook_scene(campaign, assets),
            render_photo_scene(campaign, assets),
            render_card_scene(campaign, assets),
            render_cta_scene(campaign, assets),
        ]
        scene_paths = []
        for scene_index, scene in enumerate(scenes):
            path = WORK_OUTPUT / f"{slug}-{scene_index}.png"
            scene.save(path, optimize=True)
            scene_paths.append(path)
        poster_path = IMAGE_OUTPUT / f"{slug}.png"
        poster.save(poster_path, optimize=True)
        real_photo_path = SELECT_OUTPUT / f"{index:02d}-real-photo.png"
        real_card_path = SELECT_OUTPUT / f"{index:02d}-actual-card.png"
        scenes[1].save(real_photo_path, optimize=True)
        scenes[2].save(real_card_path, optimize=True)
        posters.append(poster)
        video_frames.append(scenes[0])
        production_frames.extend((scenes[1], scenes[2]))
        print(f"  image: {poster_path.relative_to(ROOT)}", flush=True)
        if not visuals_only:
            voiceover = asyncio.run(synthesize_voiceover(campaign))
            video = render_video(slug, scene_paths, voiceover, index)
            print(f"  voice: {voiceover.relative_to(ROOT)}", flush=True)
            print(f"  video: {video.relative_to(ROOT)}", flush=True)

    create_contact_sheet(posters, OUTPUT / "campaign-contact-sheet.jpg")
    create_contact_sheet(video_frames, OUTPUT / "video-frame-contact-sheet.jpg")
    create_contact_sheet(production_frames, OUTPUT / "production-contact-sheet.jpg")
    shutil.rmtree(WORK_OUTPUT)
    result = (
        f"Created {len(posters)} images and {len(production_frames)} production selects."
        if visuals_only
        else f"Created {len(posters)} images and {len(posters)} videos."
    )
    print(result, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--visuals-only",
        action="store_true",
        help="Regenerate still images and contact sheets without audio or video.",
    )
    main(visuals_only=parser.parse_args().visuals_only)
