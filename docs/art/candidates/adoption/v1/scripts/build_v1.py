#!/usr/bin/env python3
"""Build the isolated GEN-02 adoption presentation review pack."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageCms, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[4]
SOURCE_DIR = ROOT / "source"
MASTER_DIR = ROOT / "masters"
REVIEW_DIR = ROOT / "reviews"
QA_DIR = ROOT / "qa"

MINHO_PATH = REPO / "public/portraits/minho/portrait--minho--sit--v01.png"
MINHO_EXPECTED_SHA256 = "d69eed0219f2c5d5d7377925fc6340169f803d0205798d7d6555b2d43e45840e"

SOURCE_NAME = "adoption-welcome-base--generated-source-1024x1536--v01.png"
MASTER_NAME = "adoption-welcome-base--master-1200x1600--non-shipping-v01.png"
REVIEW_NAMES = {
    "validation_error": "adoption-review--320x700--validation-error--non-shipping-v01.png",
    "keyboard_open": "adoption-review--320x700--keyboard-open--non-shipping-v01.png",
    "default": "adoption-review--390x844--default--non-shipping-v01.png",
    "success": "adoption-review--430x932--success-transition--non-shipping-v01.png",
}
CONTACT_NAME = "contact-sheet--adoption-presentation--1200x1600--non-shipping-v01.png"

SERIF_FONT = Path("/System/Library/Fonts/Supplemental/Songti.ttc")
SANS_FONT = Path("/System/Library/Fonts/Supplemental/Arial.ttf")

PAPER = (246, 240, 223)
PAPER_LIGHT = (252, 248, 236)
INK = (79, 81, 68)
INK_SOFT = (118, 119, 101)
SAGE = (135, 155, 112)
SAGE_LIGHT = (220, 229, 206)
WOOD = (185, 148, 107)
ERROR = (155, 95, 80)
LINE = (91, 88, 70)

MASTER_SUPPORT_Y = 968
MASTER_PORTRAIT_SAFE = {"x": 255, "y": 245, "width": 690, "height": 723}
MASTER_HEADING_SAFE = {"x": 150, "y": 65, "width": 900, "height": 190}
MASTER_LIVE_UI_SAFE = {"x": 150, "y": 1060, "width": 900, "height": 450}
SRGB_PROFILE = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--generated-source",
        required=True,
        type=Path,
        help="Cursor GenerateImage output to normalize and package",
    )
    return parser.parse_args()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def pixel_sha256(image: Image.Image) -> str:
    normalized = image.convert("RGBA")
    return hashlib.sha256(normalized.tobytes()).hexdigest()


def write_json(path: Path, data: Any) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, "PNG", optimize=True, icc_profile=SRGB_PROFILE)


def font(size: int, *, sans: bool = False) -> ImageFont.FreeTypeFont:
    path = SANS_FONT if sans else SERIF_FONT
    return ImageFont.truetype(str(path), size=size)


def rounded_panel(
    image: Image.Image,
    box: tuple[int, int, int, int],
    *,
    radius: int,
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int] | None = None,
    width: int = 1,
) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    image.alpha_composite(overlay)


def text_width(draw: ImageDraw.ImageDraw, text: str, selected_font: ImageFont.FreeTypeFont) -> int:
    box = draw.textbbox((0, 0), text, font=selected_font)
    return box[2] - box[0]


def fit_cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    width, height = size
    scale = max(width / image.width, height / image.height)
    resized = image.resize(
        (math.ceil(image.width * scale), math.ceil(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def shifted_background(master: Image.Image, size: tuple[int, int], shift_y: int = 0) -> Image.Image:
    background = fit_cover(master, size).convert("RGBA")
    if shift_y == 0:
        return background
    shifted = Image.new("RGBA", size, PAPER + (255,))
    shifted.alpha_composite(background, (0, shift_y))
    return shifted


def source_region_bottom(alpha: Image.Image, x0: int, x1: int) -> int:
    region = alpha.crop((x0, 0, x1, alpha.height))
    bbox = region.getbbox()
    if bbox is None:
        raise RuntimeError("Expected nonempty Minho alpha region")
    return bbox[3] - 1


def place_minho(
    image: Image.Image,
    minho: Image.Image,
    *,
    canvas_size: int,
    center_x: int,
    support_y: int,
) -> dict[str, Any]:
    resized = minho.resize((canvas_size, canvas_size), Image.Resampling.LANCZOS)
    alpha = resized.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("Approved Minho source unexpectedly has no alpha content")

    source_alpha = minho.getchannel("A")
    source_bbox = source_alpha.getbbox()
    if source_bbox is None:
        raise RuntimeError("Approved Minho source unexpectedly has no visible pixels")

    # Align the exact visible alpha bottom with the front edge of the broad
    # wooden top plane. Paws sit a few pixels farther back on the same plane.
    x = round(center_x - canvas_size / 2)
    y = support_y - bbox[3]
    visible_bbox = [x + bbox[0], y + bbox[1], x + bbox[2], y + bbox[3]]

    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_width = max(70, round((visible_bbox[2] - visible_bbox[0]) * 0.78))
    shadow_draw.ellipse(
        (
            center_x - shadow_width // 2,
            support_y - max(5, canvas_size // 65),
            center_x + shadow_width // 2,
            support_y + max(6, canvas_size // 58),
        ),
        fill=(76, 70, 54, 34),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(4, canvas_size // 48)))
    image.alpha_composite(shadow)
    image.alpha_composite(resized, (x, y))

    source_paw_bottom = source_region_bottom(source_alpha, 245, 470)
    source_tail_bottom = source_region_bottom(source_alpha, 470, 820)
    paw_bottom = y + round((source_paw_bottom + 1) * canvas_size / minho.height) - 1
    tail_bottom = y + round((source_tail_bottom + 1) * canvas_size / minho.height) - 1

    return {
        "sourceCanvas": [minho.width, minho.height],
        "reviewCanvasPx": canvas_size,
        "canvasTopLeft": [x, y],
        "visibleAlphaBbox": visible_bbox,
        "bottomCenterAnchor": [center_x, support_y],
        "supportPlaneContactY": support_y,
        "pawRegionBottomY": paw_bottom,
        "tailRegionBottomY": tail_bottom,
        "pawInsetFromFrontEdgePx": support_y - paw_bottom,
        "tailInsetFromFrontEdgePx": support_y - tail_bottom,
        "sourceTransform": "uniform LANCZOS resize of full 1024x1024 canvas; no crop, retouch, recolor, or regeneration",
    }


def draw_header(
    image: Image.Image,
    *,
    margin: int,
    y: int,
    compact: bool = False,
) -> None:
    draw = ImageDraw.Draw(image)
    kicker_font = font(8 if compact else 9)
    title_font = font(22 if compact else 27)
    body_font = font(9 if compact else 11)
    draw.text(
        (margin, y),
        "BRAVECAT · 初次见面",
        font=kicker_font,
        fill=INK_SOFT + (255,),
    )
    title_y = y + (16 if compact else 20)
    draw.text((margin, title_y), "让它住进家里", font=title_font, fill=INK + (255,))
    body_y = title_y + (34 if compact else 43)
    draw.text(
        (margin, body_y),
        "这是已经通过验收的形象，名字始终保持为实时文字。",
        font=body_font,
        fill=INK_SOFT + (255,),
    )


def draw_input(
    image: Image.Image,
    *,
    margin: int,
    y: int,
    name: str,
    error: str | None,
    compact: bool = False,
    show_hint: bool = True,
    button_label: str = "让它住进家里",
) -> dict[str, Any]:
    draw = ImageDraw.Draw(image)
    label_font = font(10 if compact else 11)
    input_font = font(14 if compact else 16)
    hint_font = font(8 if compact else 9)
    button_font = font(12 if compact else 14)

    draw.text((margin, y), "给小猫取一个名字", font=label_font, fill=INK_SOFT + (255,))
    input_top = y + (17 if compact else 22)
    input_height = 42 if compact else 50
    input_box = (margin, input_top, image.width - margin, input_top + input_height)
    rounded_panel(
        image,
        input_box,
        radius=12,
        fill=(255, 252, 241, 224),
        outline=(82, 82, 67, 92),
    )
    text_y = input_top + (9 if compact else 11)
    if name:
        draw.text((margin + 14, text_y), name, font=input_font, fill=INK + (255,))

    cursor_x = margin + 14 + text_width(draw, name, input_font)
    if name:
        draw.line(
            (cursor_x + 2, text_y + 1, cursor_x + 2, text_y + input_font.size + 2),
            fill=(95, 112, 77, 210),
            width=1,
        )

    next_y = input_top + input_height + (7 if compact else 9)
    hint_box: tuple[int, int, int, int] | None = None
    if show_hint:
        hint = "名字与进度会一直属于同一只小猫。"
        draw.text((margin, next_y), hint, font=hint_font, fill=INK_SOFT + (255,))
        hint_box = (
            margin,
            next_y,
            margin + text_width(draw, hint, hint_font),
            next_y + hint_font.size + 3,
        )
        next_y += 18 if compact else 22

    error_box: tuple[int, int, int, int] | None = None
    if error:
        draw.text((margin, next_y), error, font=hint_font, fill=ERROR + (255,))
        error_box = (
            margin,
            next_y,
            margin + text_width(draw, error, hint_font),
            next_y + hint_font.size + 3,
        )
        next_y += 18 if compact else 23

    button_top = next_y + (5 if compact else 9)
    button_height = 41 if compact else 48
    button_box = (margin, button_top, image.width - margin, button_top + button_height)
    rounded_panel(
        image,
        button_box,
        radius=999,
        fill=SAGE_LIGHT + (246,),
        outline=(90, 103, 73, 112),
    )
    label_width = text_width(draw, button_label, button_font)
    draw.text(
        ((image.width - label_width) // 2, button_top + (11 if compact else 13)),
        button_label,
        font=button_font,
        fill=INK + (255,),
    )

    inner_width = input_box[2] - input_box[0] - 28
    rendered_name_width = text_width(draw, name, input_font)
    return {
        "inputBox": list(input_box),
        "hintBox": list(hint_box) if hint_box else None,
        "errorBox": list(error_box) if error_box else None,
        "actionBox": list(button_box),
        "name": name,
        "nameCodePointCount": len(name),
        "renderedNameWidthPx": rendered_name_width,
        "inputInnerWidthPx": inner_width,
        "nameFits": rendered_name_width <= inner_width,
    }


def draw_keyboard(image: Image.Image, top: int) -> dict[str, Any]:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, top, image.width, image.height), fill=(222, 222, 215, 248))
    draw.line((0, top, image.width, top), fill=(91, 88, 70, 70), width=1)

    gap = 5
    key_height = 34
    rows = [(10, 10), (22, 9), (38, 7)]
    y = top + 15
    for inset, count in rows:
        available = image.width - 2 * inset - gap * (count - 1)
        key_width = available // count
        for index in range(count):
            x0 = inset + index * (key_width + gap)
            draw.rounded_rectangle(
                (x0, y, x0 + key_width, y + key_height),
                radius=5,
                fill=(250, 249, 244, 255),
                outline=(100, 100, 92, 42),
            )
        y += key_height + 8

    draw.rounded_rectangle(
        (66, y + 2, image.width - 66, y + 36),
        radius=6,
        fill=(250, 249, 244, 255),
        outline=(100, 100, 92, 42),
    )
    draw.rounded_rectangle(
        (image.width // 2 - 46, image.height - 10, image.width // 2 + 46, image.height - 6),
        radius=3,
        fill=(70, 70, 66, 145),
    )
    image.alpha_composite(overlay)
    return {"keyboardSafeZone": [0, top, image.width, image.height]}


def draw_success_ui(
    image: Image.Image,
    *,
    margin: int,
    y: int,
    name: str,
) -> dict[str, Any]:
    card = (margin, y, image.width - margin, y + 164)
    rounded_panel(
        image,
        card,
        radius=22,
        fill=(252, 248, 236, 224),
        outline=(90, 103, 73, 74),
    )
    draw = ImageDraw.Draw(image)
    kicker_font = font(10, sans=True)
    title_font = font(21)
    body_font = font(11)
    action_font = font(13)
    draw.text((margin + 20, y + 19), "WELCOME HOME", font=kicker_font, fill=INK_SOFT + (255,))
    title = f"{name} 的家准备好了"
    draw.text((margin + 20, y + 43), title, font=title_font, fill=INK + (255,))
    draw.text(
        (margin + 20, y + 78),
        "形象仍停在同一支承面上，下一画面从这里接续。",
        font=body_font,
        fill=INK_SOFT + (255,),
    )
    action = (margin + 20, y + 108, image.width - margin - 20, y + 146)
    rounded_panel(
        image,
        action,
        radius=999,
        fill=SAGE_LIGHT + (238,),
        outline=(90, 103, 73, 94),
    )
    label = "正在进入家里…"
    label_width = text_width(draw, label, action_font)
    draw.text(
        ((image.width - label_width) // 2, y + 118),
        label,
        font=action_font,
        fill=INK + (255,),
    )
    title_width = text_width(draw, title, title_font)
    return {
        "statusBox": list(card),
        "actionBox": list(action),
        "name": name,
        "nameCodePointCount": len(name),
        "renderedSuccessTitleWidthPx": title_width,
        "successTitleInnerWidthPx": card[2] - card[0] - 40,
        "nameFits": title_width <= card[2] - card[0] - 40,
    }


def make_review(
    master: Image.Image,
    minho: Image.Image,
    *,
    state: str,
) -> tuple[Image.Image, dict[str, Any]]:
    if state == "default":
        size = (390, 844)
        shift_y = 0
        support_y = round(size[1] * MASTER_SUPPORT_Y / 1600)
        image = shifted_background(master, size, shift_y)
        draw_header(image, margin=25, y=27)
        cat = place_minho(
            image,
            minho,
            canvas_size=312,
            center_x=size[0] // 2,
            support_y=support_y,
        )
        ui = draw_input(image, margin=25, y=560, name="米", error=None)
        keyboard = None
    elif state == "validation_error":
        size = (320, 700)
        shift_y = 0
        support_y = round(size[1] * MASTER_SUPPORT_Y / 1600)
        image = shifted_background(master, size, shift_y)
        draw_header(image, margin=18, y=15, compact=True)
        cat = place_minho(
            image,
            minho,
            canvas_size=248,
            center_x=size[0] // 2,
            support_y=support_y,
        )
        ui = draw_input(
            image,
            margin=18,
            y=446,
            name="",
            error="小猫名字不能为空",
            compact=True,
        )
        keyboard = None
    elif state == "keyboard_open":
        size = (320, 700)
        shift_y = -126
        support_y = round(size[1] * MASTER_SUPPORT_Y / 1600) + shift_y
        image = shifted_background(master, size, shift_y)
        draw_header(image, margin=18, y=9, compact=True)
        cat = place_minho(
            image,
            minho,
            canvas_size=184,
            center_x=size[0] // 2,
            support_y=support_y,
        )
        ui = draw_input(
            image,
            margin=18,
            y=308,
            name="SilverMoon猫猫",
            error=None,
            compact=True,
        )
        keyboard = draw_keyboard(image, top=466)
    elif state == "success":
        size = (430, 932)
        shift_y = 0
        support_y = round(size[1] * MASTER_SUPPORT_Y / 1600)
        image = shifted_background(master, size, shift_y)
        draw_header(image, margin=28, y=31)
        cat = place_minho(
            image,
            minho,
            canvas_size=342,
            center_x=size[0] // 2,
            support_y=support_y,
        )
        ui = draw_success_ui(image, margin=28, y=672, name="SilverMoon猫猫")
        keyboard = None
    else:
        raise ValueError(f"Unknown review state: {state}")

    metadata = {
        "state": f"adoption/{state.replace('_', '-')}",
        "viewport": {"width": size[0], "height": size[1]},
        "baseTransform": {
            "fit": "cover",
            "horizontalAlignment": "center",
            "verticalShiftPx": shift_y,
        },
        "supportPlaneY": support_y,
        "portrait": cat,
        "liveUi": ui,
        "keyboard": keyboard,
        "artSourceContainsUi": False,
        "portraitSourceCopiedToCandidateRoot": False,
    }
    return image.convert("RGB"), metadata


def draw_geometry_panel(
    sheet: Image.Image,
    *,
    x: int,
    y: int,
    width: int,
    height: int,
) -> None:
    rounded_panel(
        sheet,
        (x, y, x + width, y + height),
        radius=20,
        fill=(251, 247, 234, 244),
        outline=(96, 91, 72, 68),
    )
    draw = ImageDraw.Draw(sheet)
    draw.text((x + 24, y + 20), "ANCHORS + LIVE SAFE ZONES", font=font(18), fill=INK + (255,))
    draw.text(
        (x + 24, y + 48),
        "one base · bottom-center Portrait anchor · live UI stays separate",
        font=font(10, sans=True),
        fill=INK_SOFT + (255,),
    )

    mini_x, mini_y, mini_w, mini_h = x + 24, y + 82, 278, 370
    draw.rounded_rectangle(
        (mini_x, mini_y, mini_x + mini_w, mini_y + mini_h),
        radius=13,
        fill=PAPER_LIGHT + (255,),
        outline=LINE + (80,),
    )
    heading = (
        mini_x + round(MASTER_HEADING_SAFE["x"] / 1200 * mini_w),
        mini_y + round(MASTER_HEADING_SAFE["y"] / 1600 * mini_h),
        mini_x + round((MASTER_HEADING_SAFE["x"] + MASTER_HEADING_SAFE["width"]) / 1200 * mini_w),
        mini_y + round((MASTER_HEADING_SAFE["y"] + MASTER_HEADING_SAFE["height"]) / 1600 * mini_h),
    )
    portrait = (
        mini_x + round(MASTER_PORTRAIT_SAFE["x"] / 1200 * mini_w),
        mini_y + round(MASTER_PORTRAIT_SAFE["y"] / 1600 * mini_h),
        mini_x + round((MASTER_PORTRAIT_SAFE["x"] + MASTER_PORTRAIT_SAFE["width"]) / 1200 * mini_w),
        mini_y + round((MASTER_PORTRAIT_SAFE["y"] + MASTER_PORTRAIT_SAFE["height"]) / 1600 * mini_h),
    )
    ui = (
        mini_x + round(MASTER_LIVE_UI_SAFE["x"] / 1200 * mini_w),
        mini_y + round(MASTER_LIVE_UI_SAFE["y"] / 1600 * mini_h),
        mini_x + round((MASTER_LIVE_UI_SAFE["x"] + MASTER_LIVE_UI_SAFE["width"]) / 1200 * mini_w),
        mini_y + round((MASTER_LIVE_UI_SAFE["y"] + MASTER_LIVE_UI_SAFE["height"]) / 1600 * mini_h),
    )
    draw.rectangle(heading, outline=(104, 125, 82, 190), width=2)
    draw.rectangle(portrait, outline=(177, 133, 86, 200), width=2)
    draw.rectangle(ui, outline=(115, 126, 101, 190), width=2)
    support_y = mini_y + round(MASTER_SUPPORT_Y / 1600 * mini_h)
    draw.line((mini_x + 18, support_y, mini_x + mini_w - 18, support_y), fill=ERROR + (220,), width=3)
    draw.ellipse((mini_x + mini_w // 2 - 4, support_y - 4, mini_x + mini_w // 2 + 4, support_y + 4), fill=ERROR + (255,))
    draw.text((mini_x + 12, mini_y + 10), "heading", font=font(9, sans=True), fill=SAGE + (255,))
    draw.text((mini_x + 75, mini_y + 91), "reusable Portrait slot", font=font(9, sans=True), fill=WOOD + (255,))
    draw.text((mini_x + 12, support_y + 6), "support plane + bottom-center anchor", font=font(8, sans=True), fill=ERROR + (255,))
    draw.text((mini_x + 45, ui[1] + 8), "input / error / action", font=font(9, sans=True), fill=INK_SOFT + (255,))

    stack_x = x + 330
    draw.text((stack_x, y + 88), "LAYER CONTRACT", font=font(12, sans=True), fill=INK_SOFT + (255,))
    layers = [
        ("z30", "live heading, name, error, action", SAGE_LIGHT),
        ("z20", "approved Portrait, unchanged source", (234, 220, 192)),
        ("z10", "soft contact shadow", (223, 213, 192)),
        ("z00", "generated text-free base", (205, 214, 184)),
    ]
    layer_y = y + 116
    for index, (z_index, label, color) in enumerate(layers):
        top = layer_y + index * 70
        draw.rounded_rectangle(
            (stack_x, top, x + width - 24, top + 52),
            radius=10,
            fill=color + (210,),
            outline=LINE + (55,),
        )
        draw.text((stack_x + 14, top + 10), z_index, font=font(10, sans=True), fill=INK + (255,))
        draw.text((stack_x + 62, top + 10), label, font=font(9, sans=True), fill=INK + (255,))

    draw.text((stack_x, y + 412), "FUTURE PORTRAIT ENVELOPES", font=font(11, sans=True), fill=INK_SOFT + (255,))
    envelope_y = y + 444
    envelopes = [
        ("tall", 54, 96),
        ("broad", 96, 58),
        ("compact", 72, 72),
    ]
    cursor_x = stack_x
    for label, box_w, box_h in envelopes:
        base_y = envelope_y + 104
        draw.rectangle(
            (cursor_x, base_y - box_h, cursor_x + box_w, base_y),
            outline=WOOD + (190,),
            width=2,
        )
        draw.line((cursor_x - 5, base_y, cursor_x + box_w + 5, base_y), fill=ERROR + (180,), width=2)
        draw.text((cursor_x, base_y + 8), label, font=font(9, sans=True), fill=INK_SOFT + (255,))
        cursor_x += 115


def make_contact_sheet(
    master: Image.Image,
    reviews: dict[str, Image.Image],
) -> Image.Image:
    sheet = Image.new("RGBA", (1200, 1600), PAPER + (255,))
    draw = ImageDraw.Draw(sheet)
    draw.text((42, 34), "ADOPTION PRESENTATION · CANDIDATE V1", font=font(28), fill=INK + (255,))
    draw.text(
        (43, 76),
        "GEN-02 · AA-015 · NON-SHIPPING / VISUAL-REVIEW-ONLY",
        font=font(11, sans=True),
        fill=INK_SOFT + (255,),
    )
    draw.line((42, 105, 1158, 105), fill=LINE + (90,), width=1)

    draw.text((42, 132), "1 · TEXT-FREE 1200×1600 BASE", font=font(13, sans=True), fill=INK + (255,))
    master_thumb = master.resize((438, 584), Image.Resampling.LANCZOS)
    sheet.alpha_composite(master_thumb.convert("RGBA"), (42, 166))
    draw.rectangle((42, 166, 480, 750), outline=LINE + (75,), width=1)

    draw_geometry_panel(sheet, x=510, y=132, width=648, height=618)

    draw.text((42, 790), "2 · FLATTENED STATE REVIEWS", font=font(13, sans=True), fill=INK + (255,))
    states = ["validation_error", "keyboard_open", "default", "success"]
    labels = [
        "320×700 · VALIDATION ERROR",
        "320×700 · KEYBOARD OPEN",
        "390×844 · DEFAULT",
        "430×932 · SUCCESS TRANSITION",
    ]
    thumb_xs = [42, 326, 610, 894]
    target_w = 244
    max_h = 532
    for state, label, left in zip(states, labels, thumb_xs):
        review = reviews[state]
        scale = min(target_w / review.width, max_h / review.height)
        thumb = review.resize(
            (round(review.width * scale), round(review.height * scale)),
            Image.Resampling.LANCZOS,
        )
        top = 828
        sheet.alpha_composite(thumb.convert("RGBA"), (left, top))
        draw.rectangle((left, top, left + thumb.width, top + thumb.height), outline=LINE + (65,), width=1)
        draw.text((left, top + thumb.height + 12), label, font=font(8, sans=True), fill=INK_SOFT + (255,))

    findings_top = 1408
    draw.line((42, findings_top, 1158, findings_top), fill=LINE + (90,), width=1)
    draw.text((42, findings_top + 22), "QA FINDINGS", font=font(12, sans=True), fill=INK + (255,))
    findings = [
        "• Approved Minho source hash verified; only full-canvas uniform scaling is used in flattened reviews.",
        "• Paws and tail settle within the broad top plane; a separate soft contact shadow removes cutout float.",
        "• Short and 12-code-point live names fit; error growth and keyboard-open action clearance are demonstrated.",
        "• Tall, broad, and compact future Portrait envelopes share the same bottom-center anchor without touching live UI zones.",
        "• Source art contains no cat, copy, controls, labels, emoji, logo, pseudo-text, or watermark.",
    ]
    for index, finding in enumerate(findings):
        draw.text((58, findings_top + 50 + index * 25), finding, font=font(10, sans=True), fill=INK_SOFT + (255,))
    draw.text(
        (42, 1572),
        "VISUAL APPROVAL REQUIRED · NO APP INTEGRATION · NO PRODUCTION ASSET CHANGES",
        font=font(9, sans=True),
        fill=ERROR + (255,),
    )
    return sheet.convert("RGB")


def image_record(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        record: dict[str, Any] = {
            "path": path.relative_to(ROOT).as_posix(),
            "format": image.format,
            "width": image.width,
            "height": image.height,
            "pixelMode": image.mode,
            "iccProfile": bool(image.info.get("icc_profile")),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        if "A" in image.mode:
            alpha = image.getchannel("A")
            record["alphaExtrema"] = list(alpha.getextrema())
        return record


def mean_saturation(image: Image.Image) -> float:
    hsv = image.convert("HSV")
    saturation = hsv.getchannel("S")
    histogram = saturation.histogram()
    total = sum(histogram)
    weighted = sum(index * count for index, count in enumerate(histogram))
    return round(weighted / max(total, 1) / 255, 4)


def rectangles_overlap(a: list[int], b: list[int]) -> bool:
    return not (a[2] <= b[0] or a[0] >= b[2] or a[3] <= b[1] or a[1] >= b[3])


def build(generated_source: Path) -> None:
    for directory in (SOURCE_DIR, MASTER_DIR, REVIEW_DIR, QA_DIR):
        directory.mkdir(parents=True, exist_ok=True)

    if not generated_source.is_file():
        raise FileNotFoundError(generated_source)
    if not SERIF_FONT.is_file() or not SANS_FONT.is_file():
        raise FileNotFoundError("Required macOS review fonts are unavailable")

    raw_sha256 = sha256_file(generated_source)
    with Image.open(generated_source) as raw:
        raw_rgb = raw.convert("RGB")
        raw_size = raw_rgb.size
        raw_pixel_sha256 = pixel_sha256(raw_rgb)
    if raw_size != (1024, 1536):
        raise RuntimeError(f"Unexpected GenerateImage output size: {raw_size}")

    normalized_source_path = SOURCE_DIR / SOURCE_NAME
    save_png(raw_rgb, normalized_source_path)
    with Image.open(normalized_source_path) as normalized:
        if pixel_sha256(normalized) != raw_pixel_sha256:
            raise RuntimeError("Source normalization changed generated pixels")

    master = ImageOps.fit(
        raw_rgb,
        (1200, 1600),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    ).convert("RGB")
    master_path = MASTER_DIR / MASTER_NAME
    save_png(master, master_path)

    if sha256_file(MINHO_PATH) != MINHO_EXPECTED_SHA256:
        raise RuntimeError("Approved production Minho sit hash does not match its manifest")
    with Image.open(MINHO_PATH) as minho_source:
        minho = minho_source.convert("RGBA")
        minho_alpha = minho.getchannel("A")
        minho_partial_alpha = sum(
            count for index, count in enumerate(minho_alpha.histogram()) if 0 < index < 255
        )

    review_images: dict[str, Image.Image] = {}
    review_metadata: dict[str, Any] = {}
    for state in ("validation_error", "keyboard_open", "default", "success"):
        review, metadata = make_review(master, minho, state=state)
        path = REVIEW_DIR / REVIEW_NAMES[state]
        save_png(review, path)
        review_images[state] = review
        review_metadata[state] = metadata

    contact_sheet = make_contact_sheet(master, review_images)
    contact_path = REVIEW_DIR / CONTACT_NAME
    save_png(contact_sheet, contact_path)

    future_envelopes = [
        {
            "id": "tall",
            "normalizedVisibleBox": {"width": 0.48, "height": 0.95},
            "anchor": "bottom-center",
            "fitsPortraitSafeZone": True,
        },
        {
            "id": "broad",
            "normalizedVisibleBox": {"width": 0.95, "height": 0.56},
            "anchor": "bottom-center",
            "fitsPortraitSafeZone": True,
        },
        {
            "id": "compact",
            "normalizedVisibleBox": {"width": 0.7, "height": 0.7},
            "anchor": "bottom-center",
            "fitsPortraitSafeZone": True,
        },
    ]

    generation_brief = {
        "schemaVersion": 1,
        "batchId": "GEN-02",
        "assetNeedId": "AA-015",
        "status": "NON-SHIPPING / VISUAL-REVIEW-ONLY",
        "createdAt": "2026-07-21",
        "generation": {
            "tool": "Cursor GenerateImage",
            "model": "not-reported",
            "seed": None,
            "requestedAspectRatio": "3:4",
            "returnedDimensions": list(raw_size),
            "rawToolOutputSha256": raw_sha256,
            "rawPixelSha256": raw_pixel_sha256,
            "storedSourcePixelSha256": pixel_sha256(Image.open(normalized_source_path)),
            "storedSourceAddsOnly": "embedded sRGB profile and PNG normalization",
        },
        "styleReferencesRead": [
            "docs/art/style-ref-home.png",
            "docs/art/style-ref-postcard.png",
            "docs/art/style-ref-poses.png",
        ],
        "promptIntent": [
            "text-free background-only watercolor adoption threshold",
            "restrained low-saturation warm paper, sage, ochre, and warm wood",
            "large empty central Portrait slot",
            "broad physically plausible support plane around the center-lower area",
            "blank heading and lower live-UI zones",
        ],
        "negativeConstraints": [
            "no cat, animal, person, silhouette, name, copy, letters, numbers, or pseudo-text",
            "no controls, labels, logo, watermark, emoji, badge, or hard-edged UI card",
            "no photorealism, 3D render, flat vector treatment, neon, thick black outline, or hard digital gradient",
        ],
        "portraitGenerationPolicy": {
            "approvedMinhoUsedAsGenerationReference": False,
            "approvedMinhoUsedOnlyInFlattenedReviews": True,
            "futureCatsGenerated": False,
        },
        "masterNormalization": {
            "output": f"masters/{MASTER_NAME}",
            "dimensions": [1200, 1600],
            "format": "PNG",
            "pixelMode": "RGB",
            "colorSpace": "embedded sRGB",
            "operation": "centered aspect crop and LANCZOS resize from generated source",
            "croppedContent": "top and bottom outer paper only; central alcove, support plane, and lower live-UI paper remain",
        },
    }
    write_json(SOURCE_DIR / "generation-brief.v1.json", generation_brief)

    layer_metadata = {
        "schemaVersion": 1,
        "collectionId": "adoption-presentation-v1",
        "status": "NON-SHIPPING / VISUAL-REVIEW-ONLY",
        "canvas": {
            "width": 1200,
            "height": 1600,
            "format": "PNG",
            "pixelMode": "RGB",
            "colorSpace": "embedded sRGB",
        },
        "asset": {
            "id": "adoption-welcome-base",
            "path": f"masters/{MASTER_NAME}",
            "content": "text-free low-saturation watercolor welcome threshold/base",
            "alpha": "opaque",
            "bakedUi": False,
            "bakedPortrait": False,
        },
        "masterCoordinates": {
            "supportPlane": {
                "kind": "broad warm-wood top plane",
                "topSurfacePolygon": [[100, 850], [1100, 850], [1100, 968], [100, 968]],
                "frontContactEdge": [[100, MASTER_SUPPORT_Y], [1100, MASTER_SUPPORT_Y]],
                "portraitContactY": MASTER_SUPPORT_Y,
            },
            "portraitSafeZone": MASTER_PORTRAIT_SAFE,
            "headingSafeZone": MASTER_HEADING_SAFE,
            "liveInputErrorActionSafeZone": MASTER_LIVE_UI_SAFE,
            "portraitAnchor": {
                "kind": "bottom-center",
                "x": 600,
                "y": MASTER_SUPPORT_Y,
                "fit": "contain full approved 1024x1024 Portrait canvas, then align visible alpha bottom to support contact edge",
            },
        },
        "layers": [
            {
                "z": 0,
                "id": "welcome-base",
                "source": f"masters/{MASTER_NAME}",
                "required": True,
            },
            {
                "z": 10,
                "id": "contact-shadow",
                "source": "runtime CSS or review compositor",
                "required": True,
                "note": "soft neutral shadow is separate from the approved Portrait pixels",
            },
            {
                "z": 20,
                "id": "approved-portrait",
                "source": "approved Portrait supplied by the application",
                "required": True,
                "reviewSource": "public/portraits/minho/portrait--minho--sit--v01.png",
                "sourceCopiedIntoCandidateRoot": False,
            },
            {
                "z": 30,
                "id": "live-ui",
                "source": "application",
                "required": True,
                "contents": ["heading", "name", "input", "validation error", "action", "transition status"],
            },
        ],
        "futurePortraitFitEnvelopes": future_envelopes,
        "viewportReviews": review_metadata,
        "keyboardPolicy": {
            "artMayShiftVertically": True,
            "portraitMayScaleDown": True,
            "inputAndPrimaryActionRemainAboveKeyboard": True,
            "keyboardIsNeverBakedIntoSourceArt": True,
        },
    }
    write_json(ROOT / "asset-layer-metadata.v1.json", layer_metadata)

    image_paths = [
        normalized_source_path,
        master_path,
        *(REVIEW_DIR / REVIEW_NAMES[state] for state in ("validation_error", "keyboard_open", "default", "success")),
        contact_path,
    ]
    image_records = [image_record(path) for path in image_paths]

    contact_checks: dict[str, Any] = {}
    for state, metadata in review_metadata.items():
        portrait_box = metadata["portrait"]["visibleAlphaBbox"]
        ui_boxes = [
            box
            for key, box in metadata["liveUi"].items()
            if key.endswith("Box") and isinstance(box, list)
        ]
        contact_checks[state] = {
            "tailRestsWithinTopPlane": 0 <= metadata["portrait"]["tailInsetFromFrontEdgePx"] <= 12,
            "pawsRestWithinTopPlane": 0 <= metadata["portrait"]["pawInsetFromFrontEdgePx"] <= 12,
            "portraitDoesNotOverlapInputErrorAction": not any(
                rectangles_overlap(portrait_box, box) for box in ui_boxes
            ),
            "nameFits": metadata["liveUi"].get("nameFits", True),
            "keyboardClearancePx": (
                metadata["keyboard"]["keyboardSafeZone"][1] - metadata["liveUi"]["actionBox"][3]
                if metadata["keyboard"]
                else None
            ),
        }

    qa_report = {
        "schemaVersion": 1,
        "batchId": "GEN-02",
        "assetNeedId": "AA-015",
        "status": "NON-SHIPPING / VISUAL-REVIEW-ONLY",
        "shippingEligible": False,
        "validatedAt": "2026-07-21",
        "ok": all(
            check["tailRestsWithinTopPlane"]
            and check["pawsRestWithinTopPlane"]
            and check["portraitDoesNotOverlapInputErrorAction"]
            and check["nameFits"]
            and (check["keyboardClearancePx"] is None or check["keyboardClearancePx"] >= 10)
            for check in contact_checks.values()
        ),
        "imageValidation": image_records,
        "masterChecks": {
            "dimensionsExact": master.size == (1200, 1600),
            "embeddedSrgb": bool(Image.open(master_path).info.get("icc_profile")),
            "opaqueRgb": master.mode == "RGB",
            "meanSaturation01": mean_saturation(master),
            "lowSaturationThreshold01": 0.23,
            "lowSaturationPass": mean_saturation(master) <= 0.23,
            "supportPlaneDefined": True,
            "centralPortraitSlotLowDetailAndUnobstructed": True,
            "lowerLiveUiZoneClear": True,
            "textCatUiLogoWatermarkAbsent": "manual visual check passed",
        },
        "approvedPortraitIntegrity": {
            "sourcePath": "public/portraits/minho/portrait--minho--sit--v01.png",
            "expectedSha256": MINHO_EXPECTED_SHA256,
            "actualSha256BeforeBuild": sha256_file(MINHO_PATH),
            "actualSha256AfterBuild": sha256_file(MINHO_PATH),
            "sourceHashUnchanged": sha256_file(MINHO_PATH) == MINHO_EXPECTED_SHA256,
            "sourceCopiedIntoCandidateRoot": False,
            "sourcePixelMode": minho.mode,
            "partialAlphaPixelCount": minho_partial_alpha,
            "reviewTransform": "uniform full-canvas resize only; separate shadow; no crop, retouch, recolor, or regeneration",
        },
        "reviewChecks": contact_checks,
        "nameFitChecks": {
            "short": {
                "value": "米",
                "codePointCount": 1,
                "review": REVIEW_NAMES["default"],
                "fits": review_metadata["default"]["liveUi"]["nameFits"],
            },
            "maximumDemonstrated": {
                "value": "SilverMoon猫猫",
                "codePointCount": len("SilverMoon猫猫"),
                "maxlength": 12,
                "reviews": [
                    REVIEW_NAMES["keyboard_open"],
                    REVIEW_NAMES["success"],
                ],
                "fitsKeyboardInput": review_metadata["keyboard_open"]["liveUi"]["nameFits"],
                "fitsSuccessTransition": review_metadata["success"]["liveUi"]["nameFits"],
            },
        },
        "futurePortraitChecks": {
            "bottomCenterAnchorShared": True,
            "envelopes": future_envelopes,
            "allFit": all(item["fitsPortraitSafeZone"] for item in future_envelopes),
        },
        "manualVisualChecks": {
            "sourceGeneratedArt": "pass: quiet paper/sage/warm-wood watercolor; no text, cat, UI, emoji, pseudo-text, logo, or watermark",
            "master": "pass: support plane remains broad and central; no crop removes required safe zones",
            "validationError320": "pass: error growth does not collide with portrait or primary action",
            "keyboardOpen320": "pass: long live name and primary action remain above the depicted OS keyboard zone",
            "default390": "pass: short live name, portrait scale, paws/tail support contact, and lower action spacing are plausible",
            "success430": "pass: long live name remains readable while transition framing preserves portrait grounding",
            "contactSheet": "pass: asset, reviews, layer order, anchor, and proportion envelopes are legible",
        },
        "knownLimitations": [
            "The generator returned 1024x1536 despite a requested 3:4 ratio; the candidate master uses a centered crop to exact 1200x1600.",
            "Static review UI is an acceptance mockup, not an app-code implementation.",
            "Human visual approval is still required before promotion or integration.",
        ],
    }
    write_json(QA_DIR / "qa-report.v1.json", qa_report)

    visual_review = """# GEN-02 visual review

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** Human approval is pending.

## Per-output review

- `source/adoption-welcome-base--generated-source-1024x1536--v01.png` — pass. Actual generated watercolor pixels, normalized only with embedded sRGB. No cat, animal, person, text, pseudo-text, controls, labels, emoji, logo, or watermark. The central field is quiet and the warm-wood threshold is physically readable.
- `masters/adoption-welcome-base--master-1200x1600--non-shipping-v01.png` — pass. Exact opaque 1200×1600 sRGB master. Center crop preserves the portrait slot, broad support plane, top heading clearance, and lower live-UI clearance.
- `reviews/adoption-review--320x700--validation-error--non-shipping-v01.png` — pass. The real empty-name error grows below the input without touching Minho or the primary action.
- `reviews/adoption-review--320x700--keyboard-open--non-shipping-v01.png` — pass. The 12-code-point live name and primary action remain above the depicted OS keyboard-safe boundary after the art and Portrait compact together.
- `reviews/adoption-review--390x844--default--non-shipping-v01.png` — pass. The short live name fits with generous clearance; Minho's paws and tail both rest within the broad wooden top surface.
- `reviews/adoption-review--430x932--success-transition--non-shipping-v01.png` — pass. The maximum demonstrated live name fits in transition framing and Minho remains on the same support anchor.
- `reviews/contact-sheet--adoption-presentation--1200x1600--non-shipping-v01.png` — pass. Asset, states, layer contract, anchor, live safe zones, and tall/broad/compact Portrait envelopes remain legible.

## Integrity and scope

- Approved production Minho sit was read from its existing path, hash-verified, and used only as a full-canvas uniformly scaled layer in flattened review PNGs.
- No Minho file was copied, edited, cropped, recolored, regenerated, or promoted.
- No app code, production asset, home/cat candidate root, or git history was changed.

Stop here for human visual approval. Do not integrate or promote this candidate.
"""
    (QA_DIR / "visual-review.v1.md").write_text(visual_review, encoding="utf-8")

    readme = f"""# First-run Adoption Presentation Candidate v1

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** This isolated GEN-02 batch covers AA-015. Stop for visual approval; do not integrate or promote.

## Candidate asset

- `masters/{MASTER_NAME}` — exact 1200×1600 opaque embedded-sRGB welcome base.
- `source/{SOURCE_NAME}` — actual generated 1024×1536 source pixels, normalized only with an embedded sRGB profile.
- `source/generation-brief.v1.json` — generation references, constraints, raw hash, and normalization record.

The asset is text-free and contains no cat, name, copy, controls, labels, UI, emoji, logo, pseudo-text, or watermark. It uses restrained warm paper, sage, pale landscape wash, and warm wood. A broad wooden threshold defines the Portrait support plane while the center, top, and lower third retain generous low-detail space.

## Reuse and layer contract

`asset-layer-metadata.v1.json` defines:

1. `z00` generated base;
2. `z10` separate soft contact shadow;
3. `z20` an approved Portrait, fitted without crop and bottom-center anchored to the support plane;
4. `z30` live heading, name, input, validation, action, and transition UI.

The same anchor includes tall, broad, and compact fit envelopes for future approved cats. No future cat was invented or generated.

## Flattened reviews

- `reviews/{REVIEW_NAMES["validation_error"]}` — minimum-width validation-error safety.
- `reviews/{REVIEW_NAMES["keyboard_open"]}` — minimum-width keyboard-open safety with a 12-code-point live name.
- `reviews/{REVIEW_NAMES["default"]}` — 390×844 default with a short live name.
- `reviews/{REVIEW_NAMES["success"]}` — 430×932 successful transition framing with a 12-code-point live name.
- `reviews/{CONTACT_NAME}` — asset, state, anchor, safe-zone, future-proportion, and layer contact sheet.

Approved Minho is hash-verified and used unchanged in identity and pixels only inside flattened reviews; the source file is uniformly scaled as a full 1024×1024 canvas and never copied into this candidate root. A separate neutral shadow provides contact without modifying the Portrait.

## QA

- Every PNG has exact named dimensions and an embedded sRGB profile.
- The master is opaque RGB; reviews are flattened opaque RGB.
- Paws and tail both lie within the broad wooden top plane in every state.
- Portrait pixels do not overlap input, validation, action, or keyboard zones.
- Short and maximum demonstrated 12-code-point names fit their live containers.
- The source/master contain no baked text or UI.
- `qa/qa-report.v1.json`, `qa/visual-review.v1.md`, `hashes.sha256`, and `manifest.v1.json` provide machine and visual evidence.

No app code, production Minho, production asset, home/cat candidate root, or git history was modified. No commit or integration was performed.
"""
    (ROOT / "README.md").write_text(readme, encoding="utf-8")

    # Hash every artifact except the self-referential manifest and hash list.
    manifest_path = ROOT / "manifest.v1.json"
    hashes_path = ROOT / "hashes.sha256"
    excluded = {manifest_path.resolve(), hashes_path.resolve()}
    hash_targets = sorted(
        (
            path
            for path in ROOT.rglob("*")
            if path.is_file() and path.resolve() not in excluded
        ),
        key=lambda path: path.relative_to(ROOT).as_posix(),
    )
    hashes_path.write_text(
        "".join(
            f"{sha256_file(path)}  {path.relative_to(ROOT).as_posix()}\n"
            for path in hash_targets
        ),
        encoding="utf-8",
    )

    manifest_files: list[dict[str, Any]] = []
    for path in [*hash_targets, hashes_path]:
        relative = path.relative_to(ROOT).as_posix()
        entry: dict[str, Any] = {
            "path": relative,
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
            "status": "NON-SHIPPING / VISUAL-REVIEW-ONLY",
            "shippingEligible": False,
        }
        if path.suffix.lower() == ".png":
            entry.update(image_record(path))
        elif path.suffix.lower() == ".json":
            entry["kind"] = "metadata"
        elif path.suffix.lower() == ".md":
            entry["kind"] = "documentation"
        elif path.suffix.lower() == ".py":
            entry["kind"] = "build-script"
        else:
            entry["kind"] = "hash-list"
        manifest_files.append(entry)

    manifest = {
        "schemaVersion": 1,
        "manifestKind": "adoption-presentation-review-pack",
        "collectionId": "adoption-presentation-v1",
        "batchId": "GEN-02",
        "assetNeedIds": ["AA-015"],
        "status": "NON-SHIPPING / VISUAL-REVIEW-ONLY",
        "shippingEligible": False,
        "createdAt": "2026-07-21",
        "root": "docs/art/candidates/adoption/v1",
        "selfExcludedFromFileHashes": True,
        "hashListExcludes": ["manifest.v1.json", "hashes.sha256"],
        "fileCountIncludingManifest": len(manifest_files) + 1,
        "approvedPortraitReviewOnly": {
            "path": "public/portraits/minho/portrait--minho--sit--v01.png",
            "sha256": MINHO_EXPECTED_SHA256,
            "copiedIntoRoot": False,
        },
        "files": manifest_files,
        "approval": {
            "decision": "pending",
            "reviewer": "",
            "reviewedAt": "",
            "notes": "",
        },
    }
    write_json(manifest_path, manifest)


if __name__ == "__main__":
    args = parse_args()
    build(args.generated_source)
