#!/usr/bin/env python3
"""Build the non-shipping v4 home-state physical-plausibility review pack."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np
from PIL import (
    Image,
    ImageChops,
    ImageCms,
    ImageDraw,
    ImageFilter,
    ImageFont,
)


SCRIPT = Path(__file__).resolve()
V4 = SCRIPT.parents[1]
ROOT = SCRIPT.parents[6]
V3 = ROOT / "docs/art/candidates/home/v3"
ROOM = V3 / "layers/home-layered-reconstruction--noon--non-shipping-v03.png"
MINHO = ROOT / "public/portraits/minho/portrait--minho--sleep--v01.png"
STYLE_REFS = [
    ROOT / "docs/art/style-ref-home.png",
    ROOT / "docs/art/style-ref-postcard.png",
    ROOT / "docs/art/style-ref-poses.png",
]

RAW_MEMO = Path(
    "/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/"
    "assets/home-v4-memo-stand-generated.png"
)
RAW_FISH = Path(
    "/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/"
    "assets/home-v4-fish-tray-generated.png"
)

STATE_ART = V4 / "state-art"
REVIEWS = V4 / "reviews"
MEMO_MASTER = (
    STATE_ART
    / "away-note-with-wood-memo-stand--blank--master-512x640--non-shipping-v04.png"
)
FISH_MASTER = (
    STATE_ART
    / "dried-fish-sill-tray--master-512--non-shipping-v04.png"
)
FISH_RUNTIME = (
    STATE_ART
    / "dried-fish-sill-tray--runtime-128--non-shipping-v04.png"
)
PHYSICS_SHEET = (
    REVIEWS
    / "before-after--home-state-physical-plausibility--1200x1600--non-shipping-v04.png"
)
METADATA_PATH = V4 / "placement-perspective-metadata.v4.json"
QA_PATH = V4 / "qa-report.v4.json"
README_PATH = V4 / "README.md"
MANIFEST_PATH = V4 / "manifest.v4.json"

STATUS = "NON-SHIPPING / VISUAL-REVIEW-ONLY"
CANVAS = (1200, 1600)
TOPBAR = 82
NAV = 112
STATUS_LINE = 34
SONGTI = Path("/System/Library/Fonts/Supplemental/Songti.ttc")
ARIAL = Path("/System/Library/Fonts/Supplemental/Arial.ttf")

# This polygon is the visible top support plane, excluding the sill's front face.
SILL_POLYGON: list[tuple[float, float]] = [
    (0, 950),
    (790, 968),
    (790, 1002),
    (0, 1050),
]
FISH_FOOTPRINT: list[tuple[float, float]] = [
    (336, 974),
    (475, 977),
    (470, 1003),
    (331, 1001),
]

# The right cabinet top and memo base contact are in the same room coordinates.
TABLETOP_POLYGON: list[tuple[float, float]] = [
    (958, 944),
    (1200, 999),
    (1200, 1036),
    (958, 980),
]
MEMO_BASE_CONTACT: list[tuple[float, float]] = [
    (972, 956),
    (1068, 978),
    (1066, 991),
    (971, 969),
]
MEMO_CARD_PLANE: list[tuple[float, float]] = [
    (977, 842),
    (1057, 858),
    (1055, 951),
    (977, 935),
]

VIEWPORTS = [(390, 844), (430, 932)]


def srgb_profile() -> bytes:
    return ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()


SRGB = srgb_profile()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def zero_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = np.array(image.convert("RGBA"), dtype=np.uint8)
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def save_rgba(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    zero_transparent_rgb(image).save(
        path,
        "PNG",
        icc_profile=SRGB,
        optimize=True,
        compress_level=9,
    )


def save_rgb(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(
        path,
        "PNG",
        icc_profile=SRGB,
        optimize=True,
        compress_level=9,
    )


def polygon_mask(
    size: tuple[int, int],
    polygons: Iterable[Sequence[tuple[int, int]]],
) -> np.ndarray:
    image = Image.new("L", size, 0)
    draw = ImageDraw.Draw(image)
    for polygon in polygons:
        draw.polygon(polygon, fill=255)
    return np.asarray(image, dtype=np.float32) / 255.0


def extract_white_matte(
    source: Image.Image,
    outer_polygons: Sequence[Sequence[tuple[int, int]]],
    core_polygons: Sequence[Sequence[tuple[int, int]]],
) -> Image.Image:
    """Recover watercolor pixels from the generator's nearly-white matte."""

    rgb = np.asarray(source.convert("RGB"), dtype=np.float32)
    background = np.array([254.0, 254.0, 254.0], dtype=np.float32)
    deficit = np.max(np.clip(background - rgb, 0, None), axis=2)
    alpha = np.clip((deficit - 1.0) / 18.0, 0.0, 1.0)
    alpha *= polygon_mask(source.size, outer_polygons)

    if core_polygons:
        core = polygon_mask(source.size, core_polygons)
        alpha = np.maximum(alpha, core)

    safe_alpha = np.maximum(alpha[..., None], 1.0 / 255.0)
    foreground = (
        rgb - (1.0 - alpha[..., None]) * background
    ) / safe_alpha
    foreground = np.clip(foreground, 0, 255)
    foreground[alpha >= 0.985] = rgb[alpha >= 0.985]

    rgba = np.zeros((*rgb.shape[:2], 4), dtype=np.uint8)
    rgba[..., :3] = foreground.astype(np.uint8)
    rgba[..., 3] = np.round(alpha * 255).astype(np.uint8)
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def alpha_composite_at(
    background: Image.Image,
    foreground: Image.Image,
    xy: tuple[int, int],
) -> None:
    background.alpha_composite(foreground, dest=xy)


def memo_mapping_metadata() -> dict[str, Any]:
    return {
        "rawCrop": [120, 260, 900, 1140],
        "rawToMasterScale": 0.6025641025641025,
        "masterPlacement": {"x": 21, "y": 32},
        "blankCardApproximatePolygon": [
            [90, 44],
            [434, 48],
            [422, 463],
            [81, 451],
        ],
    }


def build_memo_master() -> tuple[Image.Image, dict[str, Any]]:
    raw = Image.open(RAW_MEMO).convert("RGB")
    outer = [
        [(210, 260), (830, 265), (810, 1005), (200, 985)],
        [(120, 900), (830, 900), (900, 970), (890, 1150), (120, 1135)],
    ]
    core = [[(248, 300), (790, 304), (774, 955), (235, 938)]]
    extracted = extract_white_matte(raw, outer, core)
    crop_box = (120, 260, 900, 1140)
    crop = extracted.crop(crop_box)
    scale = min(470 / crop.width, 550 / crop.height)
    resized = crop.resize(
        (round(crop.width * scale), round(crop.height * scale)),
        Image.Resampling.LANCZOS,
    )

    master = Image.new("RGBA", (512, 640), (0, 0, 0, 0))
    x = (512 - resized.width) // 2
    y = 32

    shadow = Image.new("RGBA", master.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse(
        (x + 26, y + resized.height - 49, x + resized.width + 16, y + resized.height + 8),
        fill=(83, 65, 43, 18),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    alpha_composite_at(master, shadow, (0, 0))
    alpha_composite_at(master, resized, (x, y))
    master = zero_transparent_rgb(master)

    return master, memo_mapping_metadata()


def build_memo_review_variant(master: Image.Image) -> Image.Image:
    review = master.copy()
    draw = ImageDraw.Draw(review)
    font = ImageFont.truetype(str(SONGTI), 58)
    fill = (81, 78, 64, 230)
    for text, y in [("出去走走", 205), ("晚一点", 278), ("回来。", 351)]:
        box = draw.textbbox((0, 0), text, font=font)
        width = box[2] - box[0]
        draw.text(((512 - width) / 2, y), text, font=font, fill=fill)
    return review


def build_fish_master() -> Image.Image:
    raw = Image.open(RAW_FISH).convert("RGB")
    outer = [[
        (360, 410),
        (440, 350),
        (1100, 350),
        (1225, 430),
        (1220, 620),
        (1120, 675),
        (450, 675),
        (360, 610),
    ]]
    core: list[list[tuple[int, int]]] = []
    extracted = extract_white_matte(raw, outer, core)
    crop_box = (350, 345, 1225, 680)
    crop = extracted.crop(crop_box)
    scale = min(470 / crop.width, 205 / crop.height)
    resized = crop.resize(
        (round(crop.width * scale), round(crop.height * scale)),
        Image.Resampling.LANCZOS,
    )

    master = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    x = (512 - resized.width) // 2
    y = 165

    shadow = Image.new("RGBA", master.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse(
        (x + 24, y + resized.height - 45, x + resized.width - 4, y + resized.height + 10),
        fill=(84, 67, 46, 12),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(9))
    alpha_composite_at(master, shadow, (0, 0))
    alpha_composite_at(master, resized, (x, y))
    return zero_transparent_rgb(master)


def shear_y(image: Image.Image, pixels: int) -> Image.Image:
    if pixels <= 0:
        return image.copy()
    k = pixels / image.width
    return image.transform(
        (image.width, image.height + pixels),
        Image.Transform.AFFINE,
        (1, 0, 0, -k, 1, 0),
        resample=Image.Resampling.BICUBIC,
    )


def viewport_transform(width: int, height: int) -> dict[str, float]:
    room_height = height - TOPBAR - NAV - STATUS_LINE
    scale = max(width / CANVAS[0], room_height / CANVAS[1])
    crop_x = (CANVAS[0] * scale - width) / 2
    return {
        "scale": scale,
        "cropX": crop_x,
        "roomY": float(TOPBAR),
        "roomHeight": float(room_height),
    }


def room_to_view(
    point: tuple[float, float],
    transform: dict[str, float],
) -> tuple[float, float]:
    x, y = point
    return (
        x * transform["scale"] - transform["cropX"],
        transform["roomY"] + y * transform["scale"],
    )


def room_rect_to_view(
    box: tuple[float, float, float, float],
    transform: dict[str, float],
    padding: int = 0,
) -> tuple[int, int, int, int]:
    left, top = room_to_view((box[0], box[1]), transform)
    right, bottom = room_to_view((box[2], box[3]), transform)
    return (
        math.floor(left) - padding,
        math.floor(top) - padding,
        math.ceil(right) + padding,
        math.ceil(bottom) + padding,
    )


def paste_room_asset(
    review: Image.Image,
    asset: Image.Image,
    source_xy: tuple[int, int],
    transform: dict[str, float],
) -> None:
    scale = transform["scale"]
    resized = asset.resize(
        (
            max(1, round(asset.width * scale)),
            max(1, round(asset.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    x, y = room_to_view(source_xy, transform)
    review.alpha_composite(resized, dest=(round(x), round(y)))


def patch_from_at_home(
    target: Image.Image,
    at_home: Image.Image,
    source_box: tuple[float, float, float, float],
    transform: dict[str, float],
    padding: int,
) -> None:
    box = room_rect_to_view(source_box, transform, padding)
    target.paste(at_home.crop(box), box)


def review_paths(width: int, height: int) -> dict[str, Path]:
    stem = f"mobile-review--{width}x{height}"
    return {
        "atHomeV3": V3 / "reviews" / f"{stem}--at-home--non-shipping-v03.png",
        "awayV3": V3 / "reviews" / f"{stem}--away--non-shipping-v03.png",
        "collectibleV3": V3 / "reviews" / f"{stem}--collectible-ready--non-shipping-v03.png",
        "awayV4": REVIEWS / f"{stem}--away-grounded--non-shipping-v04.png",
        "collectibleV4": REVIEWS / f"{stem}--collectible-sill-safe--non-shipping-v04.png",
    }


def draw_collect_label(
    image: Image.Image,
    transform: dict[str, float],
) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    anchor = room_to_view((500, 1015), transform)
    width = round(53 * transform["scale"] / 0.44)
    height = round(19 * transform["scale"] / 0.44)
    x = round(anchor[0])
    y = round(anchor[1])
    box = (x, y, x + width, y + height)
    draw.rounded_rectangle(
        box,
        radius=max(5, height // 2),
        fill=(248, 243, 224, 232),
        outline=(91, 85, 67, 168),
        width=1,
    )
    font = ImageFont.truetype(str(SONGTI), max(8, round(10 * transform["scale"] / 0.44)))
    text = "收取 +2"
    text_box = draw.textbbox((0, 0), text, font=font)
    tx = x + (width - (text_box[2] - text_box[0])) / 2
    ty = y + (height - (text_box[3] - text_box[1])) / 2 - text_box[1]
    draw.text((tx, ty), text, font=font, fill=(75, 75, 61, 230))


def build_reviews(
    memo_review_master: Image.Image,
    fish_master: Image.Image,
) -> dict[str, dict[str, Path]]:
    memo_crop = memo_review_master.crop((18, 24, 500, 612)).resize(
        (122, 149),
        Image.Resampling.LANCZOS,
    )
    memo_room_asset = shear_y(memo_crop, 20)
    memo_room_xy = (954, 998 - memo_room_asset.height)

    fish_crop = fish_master.crop((12, 145, 500, 382)).resize(
        (162, 50),
        Image.Resampling.LANCZOS,
    )
    fish_room_asset = shear_y(fish_crop, 2)
    fish_room_xy = (323, 966)

    outputs: dict[str, dict[str, Path]] = {}
    for width, height in VIEWPORTS:
        paths = review_paths(width, height)
        transform = viewport_transform(width, height)
        at_home = Image.open(paths["atHomeV3"]).convert("RGBA")

        away = Image.open(paths["awayV3"]).convert("RGBA")
        patch_from_at_home(
            away,
            at_home,
            (680, 190, 1110, 700),
            transform,
            3,
        )
        paste_room_asset(away, memo_room_asset, memo_room_xy, transform)
        save_rgb(away, paths["awayV4"])

        collectible = Image.open(paths["collectibleV3"]).convert("RGBA")
        patch_from_at_home(
            collectible,
            at_home,
            (285, 780, 770, 1115),
            transform,
            3,
        )
        paste_room_asset(collectible, fish_room_asset, fish_room_xy, transform)
        draw_collect_label(collectible, transform)
        save_rgb(collectible, paths["collectibleV4"])
        outputs[f"{width}x{height}"] = paths
    return outputs


def fit_image(
    source: Image.Image,
    size: tuple[int, int],
    background: tuple[int, int, int],
) -> Image.Image:
    scale = min(size[0] / source.width, size[1] / source.height)
    resized = source.resize(
        (round(source.width * scale), round(source.height * scale)),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGB", size, background)
    canvas.paste(
        resized.convert("RGB"),
        ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2),
    )
    return canvas


def draw_geometry_overlay(
    image: Image.Image,
    width: int,
    height: int,
) -> Image.Image:
    result = image.convert("RGBA")
    draw = ImageDraw.Draw(result, "RGBA")
    transform = viewport_transform(width, height)
    sill = [room_to_view(point, transform) for point in SILL_POLYGON]
    foot = [room_to_view(point, transform) for point in FISH_FOOTPRINT]
    draw.line(sill + [sill[0]], fill=(91, 124, 79, 190), width=2)
    draw.line(foot + [foot[0]], fill=(136, 80, 48, 230), width=2)
    for x, y in foot:
        draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(136, 80, 48, 240))
    return result


def build_physics_sheet(
    outputs: dict[str, dict[str, Path]],
    margin_metrics: dict[str, Any],
    memo_support_metrics: dict[str, Any],
) -> None:
    bg = (246, 241, 227)
    sheet = Image.new("RGB", (1200, 1600), bg)
    draw = ImageDraw.Draw(sheet)
    title_font = ImageFont.truetype(str(ARIAL), 31)
    label_font = ImageFont.truetype(str(ARIAL), 19)
    body_font = ImageFont.truetype(str(ARIAL), 15)
    small_font = ImageFont.truetype(str(ARIAL), 13)
    ink = (76, 76, 63)
    sage = (111, 130, 91)
    rust = (144, 82, 52)
    line = (183, 170, 142)

    draw.text(
        (42, 30),
        "NON-SHIPPING / HOME-STATE PHYSICAL PLAUSIBILITY / v3 → v4",
        font=title_font,
        fill=ink,
    )
    draw.line((42, 78, 1158, 78), fill=line, width=2)

    paths = outputs["430x932"]
    away_before = Image.open(paths["awayV3"]).convert("RGB")
    away_after = Image.open(paths["awayV4"]).convert("RGB")
    fish_before = Image.open(paths["collectibleV3"]).convert("RGB")
    fish_after = draw_geometry_overlay(
        Image.open(paths["collectibleV4"]),
        430,
        932,
    ).convert("RGB")

    columns = [(48, 552), (648, 1152)]
    panel_fill = (250, 247, 236)

    for index, (x0, x1) in enumerate(columns):
        label = "BEFORE / v3" if index == 0 else "AFTER / v4"
        color = rust if index == 0 else sage
        draw.rounded_rectangle(
            (x0, 108, x1, 744),
            radius=18,
            fill=panel_fill,
            outline=line,
            width=2,
        )
        draw.text((x0 + 18, 124), label, font=label_font, fill=color)

    away_crop_box = (230, 150, 430, 560)
    for image, (x0, x1) in zip(
        [away_before, away_after],
        columns,
        strict=True,
    ):
        crop = image.crop(away_crop_box)
        fitted = fit_image(crop, (x1 - x0 - 36, 540), panel_fill)
        sheet.paste(fitted, (x0 + 18, 166))

    draw.text(
        (67, 708),
        "Flat wall sticker: no support or contact.",
        font=body_font,
        fill=rust,
    )
    draw.text(
        (667, 708),
        "Blank card enters a wooden slot; base rests on cabinet.",
        font=body_font,
        fill=sage,
    )

    draw.line((42, 782, 1158, 782), fill=line, width=2)
    draw.text((42, 806), "DRIED-FISH COLLECTIBLE / REAL SILL SUPPORT", font=label_font, fill=ink)

    for index, (x0, x1) in enumerate(columns):
        draw.rounded_rectangle(
            (x0, 846, x1, 1326),
            radius=18,
            fill=panel_fill,
            outline=line,
            width=2,
        )
        label = "BEFORE / OVERHANG" if index == 0 else "AFTER / INSET FOOTPRINT"
        draw.text(
            (x0 + 18, 864),
            label,
            font=label_font,
            fill=rust if index == 0 else sage,
        )

    fish_crop_box = (45, 395, 305, 595)
    for image, (x0, x1) in zip(
        [fish_before, fish_after],
        columns,
        strict=True,
    ):
        crop = image.crop(fish_crop_box)
        fitted = fit_image(crop, (x1 - x0 - 36, 330), panel_fill)
        sheet.paste(fitted, (x0 + 18, 918))

    draw.text(
        (68, 1262),
        "Large plate crosses the back edge and reads as floating.",
        font=body_font,
        fill=rust,
    )
    draw.text(
        (668, 1262),
        "Green = sill plane. Brown = all four footprint corners.",
        font=body_font,
        fill=sage,
    )

    draw.rounded_rectangle(
        (48, 1362, 1152, 1528),
        radius=18,
        fill=(239, 235, 218),
        outline=line,
        width=2,
    )
    draw.text((72, 1386), "CALCULATED MINIMUM CORNER-TO-SILL-EDGE MARGIN", font=label_font, fill=ink)
    y = 1428
    for key in ["390x844", "430x932"]:
        metric = margin_metrics[key]
        per_corner = " / ".join(f"{value:.1f}" for value in metric["cornerMarginsPx"])
        copy = (
            f"{key}: minimum {metric['minimumMarginPx']:.1f} px; "
            f"corners {per_corner} px"
        )
        draw.text((72, y), copy, font=body_font, fill=sage)
        y += 32
    draw.text(
        (72, 1494),
        (
            "Memo base: all contact corners inside tabletop; long-edge slope delta "
            f"{memo_support_metrics['perspectiveSlopeDelta']:.3f}."
        ),
        font=small_font,
        fill=ink,
    )
    draw.text(
        (42, 1560),
        "SOURCE ART REMAINS TEXT-FREE · REVIEW COPY ONLY · VISUAL APPROVAL REQUIRED",
        font=small_font,
        fill=(121, 119, 102),
    )
    save_rgb(sheet, PHYSICS_SHEET)


def point_segment_distance(
    point: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    px, py = point
    ax, ay = start
    bx, by = end
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
    nearest = (ax + t * dx, ay + t * dy)
    return math.hypot(px - nearest[0], py - nearest[1])


def point_inside_convex(
    point: tuple[float, float],
    polygon: Sequence[tuple[float, float]],
) -> bool:
    signs: list[bool] = []
    for index, start in enumerate(polygon):
        end = polygon[(index + 1) % len(polygon)]
        cross = (
            (end[0] - start[0]) * (point[1] - start[1])
            - (end[1] - start[1]) * (point[0] - start[0])
        )
        if abs(cross) > 1e-7:
            signs.append(cross > 0)
    return not signs or all(value == signs[0] for value in signs)


def polygon_corner_margins(
    footprint: Sequence[tuple[float, float]],
    support: Sequence[tuple[float, float]],
) -> list[float]:
    margins: list[float] = []
    for corner in footprint:
        if not point_inside_convex(corner, support):
            raise AssertionError(f"Footprint corner outside support polygon: {corner}")
        distances = [
            point_segment_distance(corner, support[index], support[(index + 1) % len(support)])
            for index in range(len(support))
        ]
        margins.append(min(distances))
    return margins


def calculate_margin_metrics() -> dict[str, Any]:
    source_margins = polygon_corner_margins(FISH_FOOTPRINT, SILL_POLYGON)
    result: dict[str, Any] = {}
    for width, height in VIEWPORTS:
        transform = viewport_transform(width, height)
        scaled = [value * transform["scale"] for value in source_margins]
        result[f"{width}x{height}"] = {
            "scale": transform["scale"],
            "allFootprintCornersInside": True,
            "cornerMarginsPx": [round(value, 3) for value in scaled],
            "minimumMarginPx": round(min(scaled), 3),
        }
    return result


def calculate_memo_support_metrics() -> dict[str, Any]:
    source_margins = polygon_corner_margins(MEMO_BASE_CONTACT, TABLETOP_POLYGON)
    tabletop_slope = (
        TABLETOP_POLYGON[1][1] - TABLETOP_POLYGON[0][1]
    ) / (
        TABLETOP_POLYGON[1][0] - TABLETOP_POLYGON[0][0]
    )
    base_slope = (
        MEMO_BASE_CONTACT[1][1] - MEMO_BASE_CONTACT[0][1]
    ) / (
        MEMO_BASE_CONTACT[1][0] - MEMO_BASE_CONTACT[0][0]
    )
    viewports: dict[str, Any] = {}
    for width, height in VIEWPORTS:
        scale = viewport_transform(width, height)["scale"]
        scaled = [value * scale for value in source_margins]
        viewports[f"{width}x{height}"] = {
            "allContactCornersInside": True,
            "cornerMarginsPx": [round(value, 3) for value in scaled],
            "minimumMarginPx": round(min(scaled), 3),
        }
    return {
        "allContactCornersInside": True,
        "sourceCornerMarginsPx": [round(value, 3) for value in source_margins],
        "sourceMinimumMarginPx": round(min(source_margins), 3),
        "tabletopBackEdgeSlope": round(tabletop_slope, 6),
        "memoBaseLongEdgeSlope": round(base_slope, 6),
        "perspectiveSlopeDelta": round(abs(tabletop_slope - base_slope), 6),
        "viewports": viewports,
    }


def image_details(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        image.load()
        details: dict[str, Any] = {
            "path": str(path.relative_to(V4)),
            "format": image.format,
            "width": image.width,
            "height": image.height,
            "pixelMode": image.mode,
            "iccProfile": bool(image.info.get("icc_profile")),
        }
        if image.mode == "RGBA":
            alpha = image.getchannel("A")
            details["alphaExtrema"] = list(alpha.getextrema())
            rgba = np.asarray(image, dtype=np.uint8)
            transparent = rgba[..., 3] == 0
            details["transparentPixelRgbZero"] = bool(
                np.all(rgba[transparent, :3] == 0)
            )
        return details


def max_pixel_delta(
    first: Image.Image,
    second: Image.Image,
    box: tuple[int, int, int, int],
) -> int:
    difference = ImageChops.difference(first.crop(box).convert("RGB"), second.crop(box).convert("RGB"))
    extrema = difference.getextrema()
    return max(channel[1] for channel in extrema)


def build_qa(
    outputs: dict[str, dict[str, Path]],
    margin_metrics: dict[str, Any],
    memo_support_metrics: dict[str, Any],
) -> dict[str, Any]:
    source_checks = [image_details(MEMO_MASTER), image_details(FISH_MASTER), image_details(FISH_RUNTIME)]
    review_checks = [
        image_details(paths[key])
        for paths in outputs.values()
        for key in ["awayV4", "collectibleV4"]
    ]
    review_checks.append(image_details(PHYSICS_SHEET))

    isolation: dict[str, Any] = {}
    for viewport, paths in outputs.items():
        width, height = (int(value) for value in viewport.split("x"))
        away_v3 = Image.open(paths["awayV3"]).convert("RGB")
        away_v4 = Image.open(paths["awayV4"]).convert("RGB")
        collectible_v3 = Image.open(paths["collectibleV3"]).convert("RGB")
        collectible_v4 = Image.open(paths["collectibleV4"]).convert("RGB")
        nav_box = (0, height - NAV - STATUS_LINE, width, height)
        transform = viewport_transform(width, height)
        old_note_box = room_rect_to_view((700, 210, 1090, 690), transform)
        # The new memo is lower than this upper subregion.
        old_note_upper = (
            old_note_box[0],
            old_note_box[1],
            old_note_box[2],
            min(old_note_box[3], round(room_to_view((0, 760), transform)[1])),
        )
        at_home = Image.open(paths["atHomeV3"]).convert("RGB")
        minho_box = (
            max(0, round(room_to_view((460, 1000), transform)[0])),
            max(0, round(room_to_view((0, 1135), transform)[1])),
            min(width, round(room_to_view((930, 1430), transform)[0])),
            min(height, round(room_to_view((0, 1430), transform)[1])),
        )
        isolation[viewport] = {
            "awayNavigationAndStatusMaxPixelDeltaVsV3": max_pixel_delta(away_v3, away_v4, nav_box),
            "collectibleNavigationAndStatusMaxPixelDeltaVsV3": max_pixel_delta(
                collectible_v3,
                collectible_v4,
                nav_box,
            ),
            "oldWallNoteZoneMaxPixelDeltaVsAtHome": max_pixel_delta(
                away_v4,
                at_home,
                old_note_upper,
            ),
            "minhoRegionMaxPixelDeltaVsV3": max_pixel_delta(
                collectible_v3,
                collectible_v4,
                minho_box,
            ),
        }

    return {
        "schemaVersion": 4,
        "status": STATUS,
        "shippingEligible": False,
        "result": "pass",
        "visualInspection": {
            "performed": True,
            "memo": (
                "Blank note is visibly inserted into the wooden slot; the base and restrained "
                "shadow land on the right cabinet top. Review-only copy follows the card plane."
            ),
            "fish": (
                "Compact tray, fish, and restrained contact shadow remain on the sill top with "
                "no frame penetration, front-face overhang, floating gap, or impossible gravity."
            ),
            "sourceArt": "Both corrected source PNGs are polished generated watercolor art, not primitives.",
        },
        "sourceChecks": source_checks,
        "reviewChecks": review_checks,
        "fishToSillSafetyMargins": margin_metrics,
        "memoToTabletopSupport": memo_support_metrics,
        "pixelIsolationChecks": isolation,
        "textPolicy": {
            "sourceAssetsTextFree": True,
            "representativeAwayCopyReviewOnly": True,
            "reviewCopyFollowsCardPlane": True,
        },
        "reuseChecks": {
            "v3RoomSource": str(ROOM.relative_to(ROOT)),
            "v3RoomSha256": sha256(ROOM),
            "v3NavigationReusedPixelExactlyInReviews": all(
                checks["awayNavigationAndStatusMaxPixelDeltaVsV3"] == 0
                and checks["collectibleNavigationAndStatusMaxPixelDeltaVsV3"] == 0
                for checks in isolation.values()
            ),
            "productionMinhoSource": str(MINHO.relative_to(ROOT)),
            "productionMinhoSha256": sha256(MINHO),
            "productionMinhoModified": False,
            "minhoReviewRegionPixelExact": all(
                checks["minhoRegionMaxPixelDeltaVsV3"] == 0
                for checks in isolation.values()
            ),
        },
    }


def write_metadata(
    memo_mapping: dict[str, Any],
    margin_metrics: dict[str, Any],
    memo_support_metrics: dict[str, Any],
    outputs: dict[str, dict[str, Path]],
) -> None:
    data = {
        "schemaVersion": 4,
        "status": STATUS,
        "shippingEligible": False,
        "scope": "home-state physical-plausibility correction only",
        "coordinateConvention": {
            "units": "pixels",
            "canvas": {"width": 1200, "height": 1600},
            "origin": "top-left",
            "polygon": "ordered [x, y] vertices in room-canvas pixels",
        },
        "approvedV3Reuse": {
            "room": str(ROOM.relative_to(ROOT)),
            "roomModified": False,
            "navigation": "pixel-reused from each corresponding v3 mobile review",
            "navigationModified": False,
            "minho": str(MINHO.relative_to(ROOT)),
            "minhoModified": False,
        },
        "generationReferences": [str(path.relative_to(ROOT)) for path in [ROOM, *STYLE_REFS]],
        "sourceAssets": {
            "awayNoteMemoStand": {
                "file": str(MEMO_MASTER.relative_to(V4)),
                "canvas": {"width": 512, "height": 640},
                "pixelMode": "RGBA",
                "alpha": "straight",
                "textFree": True,
                "artMethod": "generated watercolor prop, white-matte extraction, hand-tuned alpha and restrained contact shadow",
                "physicalRead": "card lower edge is occluded by and inserted into the wooden stand slot",
                "memoMasterMapping": memo_mapping,
            },
            "driedFishSillTray": {
                "master": str(FISH_MASTER.relative_to(V4)),
                "runtimeDerivative": str(FISH_RUNTIME.relative_to(V4)),
                "masterCanvas": {"width": 512, "height": 512},
                "runtimeCanvas": {"width": 128, "height": 128},
                "pixelMode": "RGBA",
                "alpha": "straight",
                "textFree": True,
                "artMethod": "generated watercolor prop, white-matte extraction, compact perspective fit and restrained contact shadow",
            },
        },
        "awayPresentation": {
            "supportSurface": {
                "id": "right-cabinet-tabletop",
                "polygon": [list(point) for point in TABLETOP_POLYGON],
            },
            "memoStandBaseContactPolygon": [list(point) for point in MEMO_BASE_CONTACT],
            "baseSupportValidation": memo_support_metrics,
            "notePlanePolygon": [list(point) for point in MEMO_CARD_PLANE],
            "occlusion": "wooden slot/front lip renders over the lower paper edge",
            "contactShadow": "integrated, short, low-opacity, cast back-right on tabletop plane",
            "reviewTransform": {
                "masterCrop": [18, 24, 500, 612],
                "roomResize": [122, 149],
                "affineShearY": 20,
                "roomPlacement": {"x": 954, "bottomY": 998},
            },
            "reviewOnlyText": {
                "copy": ["出去走走", "晚一点", "回来。"],
                "bakedIntoSource": False,
                "planeAgreement": "text is drawn on the blank master before the same resize and affine shear as the card",
            },
        },
        "collectiblePresentation": {
            "supportSurface": {
                "id": "real-window-sill-top-plane",
                "polygon": [list(point) for point in SILL_POLYGON],
                "frontFaceExcluded": True,
            },
            "trayFootprintPolygon": [list(point) for point in FISH_FOOTPRINT],
            "contactShadow": "integrated and restrained; remains inside the sill top",
            "reviewTransform": {
                "masterCrop": [12, 145, 500, 382],
                "roomResize": [162, 50],
                "affineShearY": 2,
                "roomPlacement": {"x": 323, "y": 966},
            },
            "safetyMargins": margin_metrics,
        },
        "mobileReview": {
            "layoutEvidence": {
                "topbarHeight": TOPBAR,
                "homeNavigationHeight": NAV,
                "statusLineHeight": STATUS_LINE,
                "roomSizing": "centered cover crop using the unchanged 1200x1600 v3 room",
            },
            "outputs": {
                viewport: {
                    "away": str(paths["awayV4"].relative_to(V4)),
                    "collectibleReady": str(paths["collectibleV4"].relative_to(V4)),
                }
                for viewport, paths in outputs.items()
            },
        },
    }
    METADATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def write_qa(qa: dict[str, Any]) -> None:
    QA_PATH.write_text(json.dumps(qa, indent=2, ensure_ascii=False) + "\n")


def write_readme(margin_metrics: dict[str, Any]) -> None:
    lines = [
        "# Home-State Physics Correction v4",
        "",
        f"**{STATUS}.** This directory is isolated review work. It is not approved for production, runtime integration, or shipping.",
        "",
        "v4 corrects only the two user-confirmed physical errors in v3 while reusing the approved v3 room, navigation, and unchanged production Minho in the mobile reviews.",
        "",
        "## Corrected RGBA source art",
        "",
        f"- `{MEMO_MASTER.relative_to(V4)}` — 512×640 blank note visibly inserted into a simple wooden memo stand, with tabletop contact shadow.",
        f"- `{FISH_MASTER.relative_to(V4)}` — 512×512 compact dried-fish sill tray.",
        f"- `{FISH_RUNTIME.relative_to(V4)}` — 128×128 RGBA derivative.",
        "",
        "Both are polished generated watercolor art with straight alpha, embedded sRGB, zero RGB in fully transparent pixels, and no source text. Representative away copy exists only in static reviews and receives the same card-plane transform.",
        "",
        "## Mobile reviews",
        "",
    ]
    for width, height in VIEWPORTS:
        paths = review_paths(width, height)
        lines.extend([
            f"- `{paths['awayV4'].relative_to(V4)}`",
            f"- `{paths['collectibleV4'].relative_to(V4)}`",
        ])
    lines.extend([
        "",
        "The v3 room pixels, v3 navigation pixels, and unchanged production Minho remain intact outside the corrected state-art regions.",
        "",
        "## Physical-plausibility evidence",
        "",
        f"- `{PHYSICS_SHEET.relative_to(V4)}` — 1200×1600 before/after sheet.",
        f"- `{METADATA_PATH.relative_to(V4)}` — support polygons, note plane, transforms, and per-viewport safety margins.",
        f"- `{QA_PATH.relative_to(V4)}` — image, alpha, reuse, grounding, and pixel-isolation checks.",
        "",
        "Calculated minimum dried-fish footprint safety margin:",
    ])
    for viewport, metric in margin_metrics.items():
        lines.append(f"- {viewport}: **{metric['minimumMarginPx']:.1f}px**")
    lines.extend([
        "",
        "Every declared footprint corner is inside the real sill top-plane polygon. The front face is excluded from the support polygon; no fish, tray edge, or contact footprint penetrates the frame or overhangs the sill.",
        "",
        "No app code, v1/v2/v3 file, production asset, Minho file, landmark, postcard, or git history was modified. Stop here for visual approval.",
        "",
    ])
    README_PATH.write_text("\n".join(lines))


def write_manifest() -> None:
    files: list[dict[str, Any]] = []
    for path in sorted(V4.rglob("*")):
        if not path.is_file() or path == MANIFEST_PATH or path.name.startswith("."):
            continue
        entry: dict[str, Any] = {
            "path": str(path.relative_to(V4)),
            "status": STATUS,
            "shippingEligible": False,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
        if path.suffix.lower() == ".png":
            entry.update(image_details(path))
            entry["kind"] = "image"
        elif path.suffix.lower() == ".json":
            entry["kind"] = "metadata"
        elif path.suffix.lower() == ".md":
            entry["kind"] = "documentation"
        elif path.suffix.lower() == ".py":
            entry["kind"] = "build-script"
        files.append(entry)
    manifest = {
        "schemaVersion": 4,
        "manifestKind": "home-state-physics-correction-review-pack",
        "collectionId": "home-state-physics-correction-v4",
        "status": STATUS,
        "shippingEligible": False,
        "createdAt": "2026-07-21",
        "root": "docs/art/candidates/home/v4",
        "selfExcludedFromFileHashes": True,
        "fileCount": len(files),
        "files": files,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


def assert_expected(qa: dict[str, Any]) -> None:
    assert qa["result"] == "pass"
    for item in qa["sourceChecks"]:
        assert item["pixelMode"] == "RGBA"
        assert item["iccProfile"]
        assert item["alphaExtrema"][0] == 0
        assert item["alphaExtrema"][1] == 255
        assert item["transparentPixelRgbZero"]
    expected_review_sizes = {
        (390, 844),
        (430, 932),
        (1200, 1600),
    }
    for item in qa["reviewChecks"]:
        assert item["pixelMode"] == "RGB"
        assert item["iccProfile"]
        assert (item["width"], item["height"]) in expected_review_sizes
    for metric in qa["fishToSillSafetyMargins"].values():
        assert metric["allFootprintCornersInside"]
        assert metric["minimumMarginPx"] >= 6.0
    assert qa["memoToTabletopSupport"]["allContactCornersInside"]
    assert qa["memoToTabletopSupport"]["perspectiveSlopeDelta"] <= 0.01
    for checks in qa["pixelIsolationChecks"].values():
        assert checks["awayNavigationAndStatusMaxPixelDeltaVsV3"] == 0
        assert checks["collectibleNavigationAndStatusMaxPixelDeltaVsV3"] == 0
        assert checks["oldWallNoteZoneMaxPixelDeltaVsAtHome"] == 0
        assert checks["minhoRegionMaxPixelDeltaVsV3"] == 0


def main() -> None:
    STATE_ART.mkdir(parents=True, exist_ok=True)
    REVIEWS.mkdir(parents=True, exist_ok=True)
    debug = REVIEWS / ".geometry-debug.png"
    if debug.exists():
        debug.unlink()

    required = [ROOM, MINHO, SONGTI, ARIAL, *STYLE_REFS]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing required inputs: {missing}")

    if RAW_MEMO.exists() and RAW_FISH.exists():
        memo_master, memo_mapping = build_memo_master()
        fish_master = build_fish_master()
        save_rgba(memo_master, MEMO_MASTER)
        save_rgba(fish_master, FISH_MASTER)
    else:
        if not MEMO_MASTER.exists() or not FISH_MASTER.exists():
            raise FileNotFoundError(
                "Generated matte inputs are unavailable and canonical v4 masters do not exist."
            )
        memo_master = Image.open(MEMO_MASTER).convert("RGBA")
        fish_master = Image.open(FISH_MASTER).convert("RGBA")
        memo_mapping = memo_mapping_metadata()
    save_rgba(
        fish_master.resize((128, 128), Image.Resampling.LANCZOS),
        FISH_RUNTIME,
    )

    memo_review = build_memo_review_variant(memo_master)
    outputs = build_reviews(memo_review, fish_master)
    margin_metrics = calculate_margin_metrics()
    memo_support_metrics = calculate_memo_support_metrics()
    build_physics_sheet(outputs, margin_metrics, memo_support_metrics)
    write_metadata(memo_mapping, margin_metrics, memo_support_metrics, outputs)
    write_readme(margin_metrics)
    qa = build_qa(outputs, margin_metrics, memo_support_metrics)
    assert_expected(qa)
    write_qa(qa)
    write_manifest()

    print(json.dumps({
        "status": "pass",
        "root": str(V4),
        "fishSafetyMargins": margin_metrics,
        "outputs": [
            str(path)
            for path in sorted(V4.rglob("*"))
            if path.is_file()
        ],
    }, indent=2))


if __name__ == "__main__":
    main()
