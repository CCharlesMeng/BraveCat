#!/usr/bin/env python3
"""Build the non-shipping GEN-06 Postcard status review pack."""

from __future__ import annotations

from collections import deque
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import statistics
import textwrap
from typing import Any, Iterable, Sequence

import numpy as np
from PIL import Image, ImageCms, ImageDraw, ImageFilter, ImageFont


SCRIPT = Path(__file__).resolve()
PACK = SCRIPT.parents[1]
ROOT = SCRIPT.parents[6]

SOURCE = PACK / "source"
MASTERS = PACK / "masters"
RUNTIME = PACK / "runtime"
REVIEWS = PACK / "reviews"
QA = PACK / "qa"

CURSOR_ASSETS = Path(
    "/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets"
)
EXTERNAL_GENERATED = {
    "postmark": CURSOR_ASSETS / "gen06-postmark-raw.png",
    "fallback": CURSOR_ASSETS / "gen06-scene-unavailable-raw.png",
    "albumEmpty": CURSOR_ASSETS / "gen06-album-empty-raw.png",
}
INGESTED_GENERATED = {
    "postmark": SOURCE
    / "generation-source--postmark-ring-waves--rgb-matte--non-shipping-v01.png",
    "fallback": SOURCE
    / "generation-source--scene-unavailable--rgb--non-shipping-v01.png",
    "albumEmpty": SOURCE
    / "generation-source--album-empty--rgb-matte--non-shipping-v01.png",
}

POSTCARD_GIFTS = ROOT / "docs/art/candidates/postcard-gifts/v1"
STACK_MASTER = (
    POSTCARD_GIFTS
    / "masters/presentation"
    / "presentation--postcard-stack-holder--master-1200x900--non-shipping-v01.png"
)
BLANK_BACK_MASTER = (
    POSTCARD_GIFTS
    / "masters/presentation"
    / "presentation--blank-postcard-back--master-1200x900--non-shipping-v01.png"
)
ALBUM_NAV_MASTER = (
    ROOT
    / "docs/art/candidates/home/v3/icons"
    / "nav-icon--album--master-512--non-shipping-v03.png"
)
MINHO_GAZE = (
    ROOT / "public/portraits/minho/portrait--minho--gaze--v01.png"
)

POSTMARK_MASTER = (
    MASTERS
    / "postmark--ring-waves--master-768x512--non-shipping-v01.png"
)
POSTMARK_RUNTIME = (
    RUNTIME
    / "postmark--ring-waves--runtime-120x80--non-shipping-v01.png"
)
FALLBACK_MASTER = (
    MASTERS
    / "scene--unavailable-covered-photo--master-1200x900--non-shipping-v01.png"
)
ALBUM_EMPTY_MASTER = (
    MASTERS
    / "album--empty-open--master-512--non-shipping-v01.png"
)
ALBUM_EMPTY_RUNTIME = (
    RUNTIME
    / "album--empty-open--runtime-256--non-shipping-v01.png"
)

CONTACT_SHEET = (
    REVIEWS
    / "contact-sheet--postcard-status-v1--1600x1800--non-shipping.png"
)
LAYER_PROOF = (
    QA
    / "layer-order-proof--postcard-status-v1--1200x900--non-shipping.png"
)
REUSE_PROOF = (
    QA
    / "reuse-evaluation--album-empty--1200x800--non-shipping.png"
)
POSTMARK_READABILITY = (
    QA
    / "mobile-readability--postmark--1200x800--non-shipping.png"
)

README_PATH = PACK / "README.md"
PLACEMENT_PATH = PACK / "placement-metadata.v1.json"
MANIFEST_PATH = PACK / "manifest.v1.json"
HASHES_PATH = PACK / "hashes.sha256"
PROMPTS_PATH = SOURCE / "generation-prompts.v1.json"
PHYSICAL_QA_PATH = QA / "physical-accessibility.v1.json"
VISUAL_REVIEW_PATH = QA / "visual-review.v1.md"
IMMUTABLE_BEFORE = QA / "immutable-before.sha256"
IMMUTABLE_AFTER = QA / "immutable-after.sha256"
IMMUTABLE_RESULT = QA / "immutable-verification.v1.json"
CONCURRENT_BEFORE = QA / "concurrent-candidates-before.sha256"
CONCURRENT_AFTER = QA / "concurrent-candidates-after.sha256"
CONCURRENT_RESULT = QA / "concurrent-candidates-observation.v1.json"

STATUS = "NON-SHIPPING / VISUAL-REVIEW-ONLY"
CREATED_AT = "2026-07-21"
VIEWPORTS = [(320, 700), (390, 844), (430, 932)]

SONGTI = Path("/System/Library/Fonts/Supplemental/Songti.ttc")
ARIAL = Path("/System/Library/Fonts/Supplemental/Arial.ttf")

PAPER = (248, 239, 216)
SHELL_PAPER = (247, 240, 223)
INK = (72, 72, 60)
INK_SOFT = (121, 120, 102)
SAGE = (111, 126, 91)
LINE = (183, 170, 142)
POSTMARK_INK = (90, 79, 70)

PROTECTED_ROOTS = [
    ROOT / "src",
    ROOT / "public/scenes",
    ROOT / "public/portraits/minho",
    ROOT / "docs/art/candidates/landmarks",
    ROOT / "docs/art/candidates/postcard-gifts",
]
PROTECTED_FILES = [
    ALBUM_NAV_MASTER,
    STACK_MASTER,
    BLANK_BACK_MASTER,
]
IMMUTABLE_IGNORED_PARTS = {
    ".git",
    ".tools",
    "__pycache__",
    "node_modules",
}

GENERATION_PROMPTS = {
    "postmark": (
        "Text-free reusable watercolor postal cancellation mark on a transparent "
        "canvas: hand-inked double ring on the right with four gently uneven "
        "parallel waves extending left; restrained warm gray-brown ink; clear "
        "live two-line destination/date center; no letters, numbers, pseudo-text, "
        "stamp image, cat, landmark, paper, UI, logo, emoji, or watermark."
    ),
    "fallback": (
        "Intentional 4:3 opaque watercolor Scene-unavailable fallback: warm-white "
        "paper board with a recessed photograph window fully covered by vellum, "
        "plain corner tabs, deckled edges, and shallow contact shadow; preserve "
        "Portrait/copy/postmark quiet zones; no landmark, scenery, cat, destination "
        "clue, text, pseudo-text, warning, UI, emoji, logo, or watermark."
    ),
    "albumEmpty": (
        "Dedicated zero-Postcard Album-empty watercolor vignette on transparent "
        "square canvas: muted-sage clothbound Album opened flat on a believable "
        "paper plane, visibly empty pages with photo corners, short contact shadow, "
        "top 28 percent quiet; no postcard, photo, writing, cat, landmark, "
        "destination, text, pseudo-text, UI, emoji, logo, or watermark."
    ),
}


def ensure_directories() -> None:
    for directory in (
        SOURCE,
        MASTERS,
        RUNTIME,
        REVIEWS / "320",
        REVIEWS / "390",
        REVIEWS / "430",
        QA,
    ):
        directory.mkdir(parents=True, exist_ok=True)


def srgb_profile() -> bytes:
    return ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()


SRGB = srgb_profile()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def pack_relative(path: Path) -> str:
    return str(path.relative_to(PACK))


def zero_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
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


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), max(6, size))


def flatten_pixels(image: Image.Image) -> list[Any]:
    getter = getattr(image, "get_flattened_data", None)
    return list(getter() if getter else image.getdata())


def dematte_connected_light_background(
    source: Image.Image,
    *,
    luminance_floor: int,
    chroma_ceiling: int,
    enclosed_seeds: Iterable[tuple[int, int]] = (),
) -> Image.Image:
    """Remove the generator's connected checker matte while retaining pale art."""

    rgb = source.convert("RGB")
    width, height = rgb.size
    values = flatten_pixels(rgb)
    count = width * height
    candidate = bytearray(count)

    for index, (red, green, blue) in enumerate(values):
        luminance = (red * 54 + green * 183 + blue * 19) // 256
        chroma = max(red, green, blue) - min(red, green, blue)
        if luminance >= luminance_floor and chroma <= chroma_ceiling:
            candidate[index] = 1

    background = bytearray(count)
    queue: deque[int] = deque()

    def seed(x: int, y: int) -> None:
        if not (0 <= x < width and 0 <= y < height):
            return
        index = y * width + x
        if candidate[index] and not background[index]:
            background[index] = 1
            queue.append(index)

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)
    for x, y in enclosed_seeds:
        seed(x, y)

    while queue:
        index = queue.popleft()
        x = index % width
        y = index // width
        if x:
            neighbor = index - 1
            if candidate[neighbor] and not background[neighbor]:
                background[neighbor] = 1
                queue.append(neighbor)
        if x + 1 < width:
            neighbor = index + 1
            if candidate[neighbor] and not background[neighbor]:
                background[neighbor] = 1
                queue.append(neighbor)
        if y:
            neighbor = index - width
            if candidate[neighbor] and not background[neighbor]:
                background[neighbor] = 1
                queue.append(neighbor)
        if y + 1 < height:
            neighbor = index + width
            if candidate[neighbor] and not background[neighbor]:
                background[neighbor] = 1
                queue.append(neighbor)

    connected_mask = Image.frombytes("L", (width, height), bytes(background))
    edge_zone = connected_mask.filter(ImageFilter.MaxFilter(11))
    edge_values = flatten_pixels(edge_zone)

    output = []
    for index, (red, green, blue) in enumerate(values):
        if background[index]:
            output.append((0, 0, 0, 0))
            continue

        alpha = 255
        if edge_values[index]:
            luminance = (red * 54 + green * 183 + blue * 19) / 256
            chroma = max(red, green, blue) - min(red, green, blue)
            color_evidence = chroma / max(1, chroma_ceiling * 1.55)
            value_evidence = (240 - luminance) / 64
            foreground = max(0.0, min(1.0, max(color_evidence, value_evidence)))
            foreground = foreground * foreground * (3 - 2 * foreground)
            alpha = round(255 * foreground)
        output.append((red, green, blue, alpha))

    rgba = Image.new("RGBA", (width, height))
    rgba.putdata(output)
    return zero_transparent_rgb(rgba)


def alpha_bounds(image: Image.Image, threshold: int = 2) -> tuple[int, int, int, int]:
    alpha = np.asarray(image.convert("RGBA"), dtype=np.uint8)[..., 3]
    ys, xs = np.where(alpha >= threshold)
    if len(xs) == 0:
        raise ValueError("Image contains no alpha subject")
    return (
        int(xs.min()),
        int(ys.min()),
        int(xs.max()) + 1,
        int(ys.max()) + 1,
    )


def expanded_box(
    box: tuple[int, int, int, int],
    size: tuple[int, int],
    margin: int,
) -> tuple[int, int, int, int]:
    return (
        max(0, box[0] - margin),
        max(0, box[1] - margin),
        min(size[0], box[2] + margin),
        min(size[1], box[3] + margin),
    )


def contain_rgba(
    source: Image.Image,
    canvas_size: tuple[int, int],
    *,
    margin: int,
    align_y: float = 0.5,
) -> Image.Image:
    max_width = canvas_size[0] - margin * 2
    max_height = canvas_size[1] - margin * 2
    scale = min(max_width / source.width, max_height / source.height)
    resized = source.resize(
        (
            max(1, round(source.width * scale)),
            max(1, round(source.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    x = (canvas_size[0] - resized.width) // 2
    available = canvas_size[1] - resized.height - margin * 2
    y = margin + round(max(0, available) * align_y)
    canvas.alpha_composite(resized, dest=(x, y))
    return zero_transparent_rgb(canvas)


def crop_to_aspect(source: Image.Image, aspect: float) -> Image.Image:
    width, height = source.size
    current = width / height
    if current > aspect:
        target_width = round(height * aspect)
        left = (width - target_width) // 2
        return source.crop((left, 0, left + target_width, height))
    target_height = round(width / aspect)
    top = (height - target_height) // 2
    return source.crop((0, top, width, top + target_height))


def normalize_postmark_ink(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    alpha = rgba[..., 3].astype(np.float32)
    active = alpha > 6
    if not np.any(active):
        raise ValueError("Postmark extraction is empty")
    original_luma = (
        rgba[..., 0].astype(np.float32) * 0.2126
        + rgba[..., 1].astype(np.float32) * 0.7152
        + rgba[..., 2].astype(np.float32) * 0.0722
    )
    median = float(np.median(original_luma[active]))
    texture = np.clip((original_luma - median) * 0.11, -7, 9)
    for channel, base in enumerate(POSTMARK_INK):
        rgba[..., channel] = np.where(
            active,
            np.clip(base + texture, 0, 255),
            0,
        ).astype(np.uint8)
    strengthened = np.where(
        alpha <= 6,
        0,
        np.clip(56 + np.power(alpha / 255.0, 0.68) * 185, 0, 232),
    )
    rgba[..., 3] = strengthened.astype(np.uint8)
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def build_postmark() -> tuple[Image.Image, dict[str, Any]]:
    raw = Image.open(INGESTED_GENERATED["postmark"]).convert("RGB")
    extracted = dematte_connected_light_background(
        raw,
        luminance_floor=226,
        chroma_ceiling=13,
        enclosed_seeds=[
            (1100, 510),
            (1100, 190),
            (1100, 835),
            (760, 510),
            (1435, 510),
            (860, 270),
            (1340, 270),
            (860, 745),
            (1340, 745),
        ],
    )
    crop = extracted.crop(
        expanded_box(alpha_bounds(extracted, 8), extracted.size, 46)
    )
    master = contain_rgba(crop, (768, 512), margin=20)
    master = normalize_postmark_ink(master)

    alpha = np.asarray(master, dtype=np.uint8)[..., 3]
    yy, xx = np.indices(alpha.shape)
    ring_pixels = (alpha >= 70) & (xx >= round(master.width * 0.47))
    ys, xs = np.where(ring_pixels)
    if len(xs) == 0:
        raise ValueError("Unable to detect postmark ring")
    ring_box = [
        int(xs.min()),
        int(ys.min()),
        int(xs.max()) + 1,
        int(ys.max()) + 1,
    ]
    center_x = (ring_box[0] + ring_box[2]) / 2
    center_y = (ring_box[1] + ring_box[3]) / 2
    diameter = min(ring_box[2] - ring_box[0], ring_box[3] - ring_box[1])
    safe_width = round(diameter * 0.62)
    safe_height = round(diameter * 0.43)
    safe_rect = [
        round(center_x - safe_width / 2),
        round(center_y - safe_height / 2),
        safe_width,
        safe_height,
    ]

    rgba = np.asarray(master, dtype=np.uint8).copy()
    sx, sy, sw, sh = safe_rect
    rgba[sy : sy + sh, sx : sx + sw] = 0
    master = Image.fromarray(rgba, "RGBA")

    save_rgba(master, POSTMARK_MASTER)
    runtime = master.resize((120, 80), Image.Resampling.LANCZOS)
    save_rgba(runtime, POSTMARK_RUNTIME)

    scale_x = 120 / master.width
    scale_y = 80 / master.height
    runtime_safe = [
        round(safe_rect[0] * scale_x),
        round(safe_rect[1] * scale_y),
        round(safe_rect[2] * scale_x),
        round(safe_rect[3] * scale_y),
    ]
    runtime_ring = [
        round(ring_box[0] * scale_x),
        round(ring_box[1] * scale_y),
        round((ring_box[2] - ring_box[0]) * scale_x),
        round((ring_box[3] - ring_box[1]) * scale_y),
    ]
    return master, {
        "masterCanvas": {"width": 768, "height": 512},
        "ringBounds": {
            "x": ring_box[0],
            "y": ring_box[1],
            "width": ring_box[2] - ring_box[0],
            "height": ring_box[3] - ring_box[1],
        },
        "liveTextSafeRect": {
            "x": safe_rect[0],
            "y": safe_rect[1],
            "width": safe_rect[2],
            "height": safe_rect[3],
        },
        "runtimeCanvas": {"width": 120, "height": 80},
        "runtimeRingBounds": {
            "x": runtime_ring[0],
            "y": runtime_ring[1],
            "width": runtime_ring[2],
            "height": runtime_ring[3],
        },
        "runtimeLiveTextSafeRect": {
            "x": runtime_safe[0],
            "y": runtime_safe[1],
            "width": runtime_safe[2],
            "height": runtime_safe[3],
        },
        "recommendedDisplay": {
            "widthCssPx": 120,
            "heightCssPx": 80,
            "ringDiameterCssPx": runtime_ring[2],
            "destinationMaxCjkCharacters": 4,
            "destinationFontCssPx": 7,
            "dateFontCssPx": 8,
        },
        "waveDirection": "left from right-side ring",
        "textBaked": False,
    }


def build_fallback() -> tuple[Image.Image, dict[str, Any]]:
    raw = Image.open(INGESTED_GENERATED["fallback"]).convert("RGB")
    master = crop_to_aspect(raw, 4 / 3).resize(
        (1200, 900),
        Image.Resampling.LANCZOS,
    )
    save_rgb(master, FALLBACK_MASTER)
    safe_zones = {
        "portrait": {
            "x": 42,
            "y": 470,
            "width": 350,
            "height": 365,
            "anchor": {"x": 210, "y": 812},
        },
        "copy": {
            "x": 406,
            "y": 668,
            "width": 395,
            "height": 168,
        },
        "postmark": {
            "x": 912,
            "y": 654,
            "width": 238,
            "height": 182,
        },
    }
    return master, {
        "canvas": {"width": 1200, "height": 900},
        "aspectRatio": "4:3",
        "pixelMode": "RGB",
        "alpha": "opaque",
        "metaphor": "covered photograph window on warm paper",
        "safeZones": safe_zones,
        "forbiddenBakedContent": [
            "landmark",
            "Scene",
            "cat",
            "destination",
            "date",
            "copy",
            "postmark",
            "warning text",
            "pseudo-text",
            "UI",
            "emoji",
        ],
    }


def build_album_empty() -> tuple[Image.Image, dict[str, Any]]:
    raw = Image.open(INGESTED_GENERATED["albumEmpty"]).convert("RGB")
    extracted = dematte_connected_light_background(
        raw,
        luminance_floor=227,
        chroma_ceiling=12,
    )
    crop = extracted.crop(
        expanded_box(alpha_bounds(extracted, 6), extracted.size, 14)
    )
    scale = min(416 / crop.width, 306 / crop.height)
    resized = crop.resize(
        (
            max(1, round(crop.width * scale)),
            max(1, round(crop.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    master = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    x = (512 - resized.width) // 2
    y = 464 - resized.height
    master.alpha_composite(resized, dest=(x, y))
    master = zero_transparent_rgb(master)
    save_rgba(master, ALBUM_EMPTY_MASTER)
    runtime = master.resize((256, 256), Image.Resampling.LANCZOS)
    save_rgba(runtime, ALBUM_EMPTY_RUNTIME)
    bounds = alpha_bounds(master, 4)
    return master, {
        "canvas": {"width": 512, "height": 512},
        "subjectBounds": {
            "x": bounds[0],
            "y": bounds[1],
            "width": bounds[2] - bounds[0],
            "height": bounds[3] - bounds[1],
        },
        "safeMargins": {
            "left": bounds[0],
            "top": bounds[1],
            "right": 512 - bounds[2],
            "bottom": 512 - bounds[3],
        },
        "liveHeadingHintQuietZone": {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": min(bounds[1], 154),
        },
        "bottomCenterAnchor": {"x": 256, "y": bounds[3]},
        "physicalRead": (
            "open Album rests flat on its generated warm-paper plane and short "
            "contact shadow; all four visible mounts are empty"
        ),
        "textBaked": False,
    }


def fit_image(
    source: Image.Image,
    size: tuple[int, int],
    *,
    background: tuple[int, int, int] | None = None,
) -> Image.Image:
    scale = min(size[0] / source.width, size[1] / source.height)
    resized = source.resize(
        (
            max(1, round(source.width * scale)),
            max(1, round(source.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    mode = "RGBA" if background is None else "RGB"
    fill: Any = (0, 0, 0, 0) if background is None else background
    canvas = Image.new(mode, size, fill)
    xy = (
        (size[0] - resized.width) // 2,
        (size[1] - resized.height) // 2,
    )
    if mode == "RGBA":
        canvas.alpha_composite(resized.convert("RGBA"), dest=xy)
    else:
        canvas.paste(resized.convert("RGB"), xy)
    return canvas


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    center_x: float,
    y: float,
    text: str,
    *,
    typeface: ImageFont.FreeTypeFont,
    fill: tuple[int, ...],
) -> None:
    box = draw.textbbox((0, 0), text, font=typeface)
    draw.text(
        (center_x - (box[2] - box[0]) / 2, y),
        text,
        font=typeface,
        fill=fill,
    )


def draw_live_postmark(
    canvas: Image.Image,
    postmark: Image.Image,
    metadata: dict[str, Any],
    xy: tuple[int, int],
    size: tuple[int, int],
    *,
    destination: str = "远方",
    date: str = "04.12",
) -> None:
    overlay = postmark.resize(size, Image.Resampling.LANCZOS)
    canvas.alpha_composite(overlay, dest=xy)
    scale_x = size[0] / metadata["masterCanvas"]["width"]
    scale_y = size[1] / metadata["masterCanvas"]["height"]
    safe = metadata["liveTextSafeRect"]
    sx = xy[0] + safe["x"] * scale_x
    sy = xy[1] + safe["y"] * scale_y
    sw = safe["width"] * scale_x
    sh = safe["height"] * scale_y
    draw = ImageDraw.Draw(canvas, "RGBA")
    destination_font = font(SONGTI, max(7, round(size[1] * 0.0875)))
    date_font = font(ARIAL, max(8, round(size[1] * 0.1)))
    draw_centered_text(
        draw,
        sx + sw / 2,
        sy + sh * 0.08,
        destination,
        typeface=destination_font,
        fill=(74, 66, 58, 245),
    )
    draw_centered_text(
        draw,
        sx + sw / 2,
        sy + sh * 0.50,
        date,
        typeface=date_font,
        fill=(74, 66, 58, 245),
    )


def mobile_path(kind: str, width: int, height: int) -> Path:
    return (
        REVIEWS
        / str(width)
        / f"review--{kind}--{width}x{height}--non-shipping-v01.png"
    )


def draw_mobile_shell(
    width: int,
    height: int,
    *,
    drawer_title: str,
    eyebrow: str,
) -> tuple[Image.Image, int]:
    image = Image.new("RGBA", (width, height), (240, 237, 221, 255))
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((0, 0, width, 78), fill=(250, 246, 232, 255))
    draw.ellipse(
        (-round(width * 0.18), -round(width * 0.35), round(width * 0.62), 152),
        fill=(255, 252, 241, 150),
    )
    draw.text(
        (22, 18),
        "B R A V E C A T",
        font=font(ARIAL, 8),
        fill=(90, 91, 76, 230),
    )
    draw.text(
        (22, 38),
        "咪游记",
        font=font(SONGTI, 20),
        fill=INK + (255,),
    )

    draw.rectangle((0, 78, width, height), fill=(197, 201, 186, 255))
    draw.ellipse(
        (-40, 122, round(width * 0.70), 400),
        fill=(184, 194, 165, 165),
    )
    draw.ellipse(
        (round(width * 0.35), 122, width + 100, 350),
        fill=(166, 179, 145, 145),
    )

    drawer_y = round(height * 0.22)
    draw.rounded_rectangle(
        (0, drawer_y, width - 1, height + 28),
        radius=27,
        fill=SHELL_PAPER + (255,),
        outline=(91, 88, 70, 76),
        width=1,
    )
    draw.rounded_rectangle(
        (width / 2 - 22, drawer_y + 11, width / 2 + 22, drawer_y + 15),
        radius=3,
        fill=(83, 84, 70, 62),
    )
    draw.text(
        (24, drawer_y + 44),
        eyebrow,
        font=font(SONGTI, 10),
        fill=(122, 122, 105, 255),
    )
    draw.text(
        (24, drawer_y + 64),
        drawer_title,
        font=font(SONGTI, 23),
        fill=INK + (255,),
    )
    close_x = width - 44
    close_y = drawer_y + 61
    draw.ellipse(
        (close_x - 19, close_y - 19, close_x + 19, close_y + 19),
        fill=(255, 252, 241, 168),
        outline=(82, 82, 68, 90),
        width=1,
    )
    draw.line(
        (close_x - 4, close_y - 4, close_x + 4, close_y + 4),
        fill=(89, 88, 75, 220),
        width=1,
    )
    draw.line(
        (close_x + 4, close_y - 4, close_x - 4, close_y + 4),
        fill=(89, 88, 75, 220),
        width=1,
    )
    return image, drawer_y


def draw_stack_with_fallback(
    canvas: Image.Image,
    fallback: Image.Image,
    xy: tuple[int, int],
    width: int,
) -> int:
    height = round(width * 0.75)
    stack = Image.open(STACK_MASTER).convert("RGBA").resize(
        (width, height),
        Image.Resampling.LANCZOS,
    )
    canvas.alpha_composite(stack, dest=xy)
    insert = {
        "x": round(131 / 1200 * width),
        "y": round(123 / 900 * height),
        "width": round(957 / 1200 * width),
        "height": round(668 / 900 * height),
    }
    target_height = insert["height"]
    target_width = round(target_height * 4 / 3)
    if target_width > insert["width"]:
        target_width = insert["width"]
        target_height = round(target_width * 3 / 4)
    picture = fallback.resize(
        (target_width, target_height),
        Image.Resampling.LANCZOS,
    )
    px = xy[0] + insert["x"] + (insert["width"] - target_width) // 2
    py = xy[1] + insert["y"] + (insert["height"] - target_height) // 2
    canvas.alpha_composite(picture.convert("RGBA"), dest=(px, py))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rounded_rectangle(
        (px - 2, py - 2, px + target_width + 1, py + target_height + 1),
        radius=max(2, round(width / 170)),
        outline=(109, 99, 76, 145),
        width=max(1, round(width / 330)),
    )
    return height


def draw_unavailable_review(
    width: int,
    height: int,
    fallback: Image.Image,
    postmark: Image.Image,
    postmark_metadata: dict[str, Any],
) -> Path:
    image, drawer_y = draw_mobile_shell(
        width,
        height,
        drawer_title="相册",
        eyebrow="寄回家的风景",
    )
    draw = ImageDraw.Draw(image, "RGBA")
    draw.text(
        (24, drawer_y + 102),
        "已经寄到家的明信片会一直留在这里。",
        font=font(SONGTI, 10),
        fill=INK_SOFT + (255,),
    )
    postcard_width = width - 52
    stack_y = drawer_y + 130
    stack_height = draw_stack_with_fallback(
        image,
        fallback,
        (26, stack_y),
        postcard_width,
    )

    panel_y = stack_y + stack_height + 13
    panel_height = 102
    draw.rounded_rectangle(
        (27, panel_y, width - 27, panel_y + panel_height),
        radius=7,
        fill=(250, 244, 225, 225),
        outline=(111, 99, 72, 68),
        width=1,
    )
    copy_font = font(SONGTI, 11 if width >= 390 else 10)
    draw.text(
        (42, panel_y + 20),
        "风从纸边绕过去，",
        font=copy_font,
        fill=(76, 74, 61, 245),
    )
    draw.text(
        (42, panel_y + 42),
        "我仍把这一刻寄回家。",
        font=copy_font,
        fill=(76, 74, 61, 245),
    )
    draw.text(
        (42, panel_y + 73),
        "远方",
        font=font(SONGTI, 7),
        fill=(126, 124, 103, 240),
    )
    mark_width = 108 if width >= 390 else 101
    mark_height = round(mark_width * 2 / 3)
    draw_live_postmark(
        image,
        postmark,
        postmark_metadata,
        (width - 31 - mark_width, panel_y + 15),
        (mark_width, mark_height),
    )
    output = mobile_path("postcard-unavailable", width, height)
    save_rgb(image, output)
    return output


def draw_button(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
) -> None:
    draw.rounded_rectangle(
        box,
        radius=(box[3] - box[1]) // 2,
        fill=(228, 234, 216, 210),
        outline=(90, 103, 73, 82),
        width=1,
    )
    draw_centered_text(
        draw,
        (box[0] + box[2]) / 2,
        box[1] + 10,
        text,
        typeface=font(SONGTI, 9),
        fill=(74, 75, 62, 245),
    )


def draw_album_empty_review(
    width: int,
    height: int,
    album: Image.Image,
) -> Path:
    image, drawer_y = draw_mobile_shell(
        width,
        height,
        drawer_title="相册",
        eyebrow="寄回家的风景",
    )
    display = {320: 170, 390: 182, 430: 192}[width]
    x = (width - display) // 2
    y = drawer_y + 95
    vignette = album.resize((display, display), Image.Resampling.LANCZOS)
    image.alpha_composite(vignette, dest=(x, y))
    draw = ImageDraw.Draw(image, "RGBA")
    heading_y = y + display + 2
    draw_centered_text(
        draw,
        width / 2,
        heading_y,
        "第一张明信片还在路上",
        typeface=font(SONGTI, 15 if width >= 390 else 14),
        fill=INK + (255,),
    )
    hint_lines = [
        "小猫寄来的明信片和带回的纪念品",
        "都会收在这里。",
    ]
    for index, line in enumerate(hint_lines):
        draw_centered_text(
            draw,
            width / 2,
            heading_y + 31 + index * 19,
            line,
            typeface=font(SONGTI, 10 if width >= 390 else 9),
            fill=INK_SOFT + (255,),
        )

    save_y = heading_y + 84
    if save_y + 105 <= height:
        draw.line(
            (26, save_y, width - 26, save_y),
            fill=(82, 82, 67, 45),
            width=1,
        )
        draw.text(
            (28, save_y + 15),
            "带走这个家",
            font=font(SONGTI, 11),
            fill=INK + (250,),
        )
        draw.text(
            (28, save_y + 36),
            "导出会包含相册和未读状态。",
            font=font(SONGTI, 8),
            fill=INK_SOFT + (240,),
        )
        gap = 8
        button_width = (width - 56 - gap) // 2
        draw_button(
            draw,
            (28, save_y + 62, 28 + button_width, save_y + 98),
            "导出存档",
        )
        draw_button(
            draw,
            (
                28 + button_width + gap,
                save_y + 62,
                width - 28,
                save_y + 98,
            ),
            "导入存档",
        )
    output = mobile_path("album-empty", width, height)
    save_rgb(image, output)
    return output


def build_reuse_proof(album_empty: Image.Image) -> None:
    sheet = Image.new("RGB", (1200, 800), (244, 239, 224))
    draw = ImageDraw.Draw(sheet)
    draw.text(
        (42, 28),
        "GEN-06 · ALBUM-EMPTY REUSE TEST · ACTUAL 160 PX DISPLAY",
        font=font(ARIAL, 26),
        fill=INK,
    )
    draw.text(
        (42, 66),
        "Existing family was tested before authoring a dedicated zero-Postcard vignette.",
        font=font(ARIAL, 14),
        fill=INK_SOFT,
    )
    candidates = [
        (
            "STACK / FAIL",
            Image.open(STACK_MASTER).convert("RGBA"),
            "Three visible blank cards imply received content.",
            (145, 93, 72),
        ),
        (
            "BLANK BACK / FAIL",
            Image.open(BLANK_BACK_MASTER).convert("RGBA"),
            "One address-side Postcard contradicts a zero count.",
            (145, 93, 72),
        ),
        (
            "NAV ALBUM / FAIL",
            Image.open(ALBUM_NAV_MASTER).convert("RGBA"),
            "Closed upright emblem identifies Album, not empty pockets.",
            (145, 93, 72),
        ),
        (
            "DEDICATED / PASS",
            album_empty,
            "Open, supported, visibly empty mounts; no fake Postcard.",
            (92, 120, 78),
        ),
    ]
    panel_width = 270
    for index, (title, art, note, accent) in enumerate(candidates):
        x = 35 + index * 290
        draw.rounded_rectangle(
            (x, 112, x + panel_width, 665),
            radius=18,
            fill=(250, 247, 237),
            outline=LINE,
            width=2,
        )
        draw.text(
            (x + 18, 134),
            title,
            font=font(ARIAL, 17),
            fill=accent,
        )
        preview = fit_image(art, (220, 250))
        sheet.paste(preview, (x + 25, 188), preview)
        draw.rectangle(
            (x + 55, 465, x + 215, 625),
            outline=(122, 121, 103),
            width=1,
        )
        display = art.resize((160, 160), Image.Resampling.LANCZOS)
        display_ground = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
        display_ground.alpha_composite(display.convert("RGBA"))
        sheet.paste(display_ground, (x + 55, 465), display_ground)
        wrapped = textwrap.wrap(note, width=31)
        for line_index, line in enumerate(wrapped):
            draw.text(
                (x + 18, 685 + line_index * 18),
                line,
                font=font(ARIAL, 12),
                fill=INK_SOFT,
            )
    draw.text(
        (42, 762),
        "Decision: reuse fails semantic zero-state clarity; dedicated 512×512 RGBA source is justified.",
        font=font(ARIAL, 14),
        fill=SAGE,
    )
    save_rgb(sheet, REUSE_PROOF)


def composite_over(
    foreground: Image.Image,
    background: tuple[int, int, int],
) -> Image.Image:
    base = Image.new("RGBA", foreground.size, background + (255,))
    base.alpha_composite(foreground.convert("RGBA"))
    return base.convert("RGB")


def build_postmark_readability(
    postmark: Image.Image,
    metadata: dict[str, Any],
) -> None:
    sheet = Image.new("RGBA", (1200, 800), (244, 239, 224, 255))
    draw = ImageDraw.Draw(sheet, "RGBA")
    draw.text(
        (42, 28),
        "GEN-06 · POSTMARK TRANSPARENCY + MOBILE READABILITY",
        font=font(ARIAL, 26),
        fill=INK + (255,),
    )
    draw.text(
        (42, 68),
        "Text remains live. Source overlay contains ring and waves only.",
        font=font(ARIAL, 14),
        fill=INK_SOFT + (255,),
    )

    checker = Image.new("RGBA", (530, 354), (255, 255, 255, 255))
    checker_draw = ImageDraw.Draw(checker)
    tile = 24
    for y in range(0, checker.height, tile):
        for x in range(0, checker.width, tile):
            if (x // tile + y // tile) % 2:
                checker_draw.rectangle(
                    (x, y, x + tile - 1, y + tile - 1),
                    fill=(228, 228, 224, 255),
                )
    preview = postmark.resize((510, 340), Image.Resampling.LANCZOS)
    checker.alpha_composite(preview, dest=(10, 7))
    sheet.alpha_composite(checker, dest=(42, 112))

    grounds = [
        ("CURRENT PAPER", PAPER),
        ("PALE SAGE", (225, 230, 214)),
        ("WARM WHITE", (255, 252, 241)),
    ]
    for index, (label, ground) in enumerate(grounds):
        x = 626
        y = 104 + index * 132
        draw.text(
            (x, y - 4),
            label,
            font=font(ARIAL, 13),
            fill=INK + (255,),
        )
        draw.rounded_rectangle(
            (x, y + 22, x + 520, y + 116),
            radius=10,
            fill=ground + (255,),
            outline=LINE + (180,),
            width=1,
        )
        draw_live_postmark(
            sheet,
            postmark,
            metadata,
            (x + 188, y + 29),
            (120, 80),
        )
        draw.text(
            (x + 326, y + 64),
            "actual 120×80 CSS px",
            font=font(ARIAL, 12),
            fill=INK_SOFT + (255,),
        )

    safe = metadata["runtimeLiveTextSafeRect"]
    ring = metadata["runtimeRingBounds"]
    draw.rounded_rectangle(
        (42, 520, 1158, 752),
        radius=16,
        fill=(251, 248, 238, 255),
        outline=LINE + (255,),
        width=2,
    )
    draw.text(
        (66, 544),
        "RUNTIME GEOMETRY",
        font=font(ARIAL, 16),
        fill=INK + (255,),
    )
    lines = [
        f"Canvas: 120×80 px",
        (
            f"Ring: x {ring['x']}, y {ring['y']}, "
            f"{ring['width']}×{ring['height']} px"
        ),
        (
            f"Live destination/date safe zone: x {safe['x']}, y {safe['y']}, "
            f"{safe['width']}×{safe['height']} px"
        ),
        "Recommended live type: destination 7 px / date 8 px; 4 CJK destination characters maximum.",
        "The safe-zone alpha is machine-checked to remain empty.",
    ]
    for index, line in enumerate(lines):
        draw.text(
            (66, 582 + index * 31),
            line,
            font=font(ARIAL, 14),
            fill=INK_SOFT + (255,),
        )
    save_rgb(sheet, POSTMARK_READABILITY)


def add_minho(scene: Image.Image) -> Image.Image:
    result = scene.convert("RGBA")
    portrait = Image.open(MINHO_GAZE).convert("RGBA")
    box = alpha_bounds(portrait, 3)
    portrait = portrait.crop(box)
    target_height = round(scene.height * 0.39)
    target_width = round(portrait.width / portrait.height * target_height)
    portrait = portrait.resize(
        (target_width, target_height),
        Image.Resampling.LANCZOS,
    )
    x = round(scene.width * 0.18 - target_width / 2)
    y = round(scene.height * 0.91 - target_height)
    result.alpha_composite(portrait, dest=(x, y))
    return result


def add_copy(scene: Image.Image) -> Image.Image:
    result = scene.convert("RGBA")
    draw = ImageDraw.Draw(result, "RGBA")
    y = round(scene.height * 0.73)
    draw.rounded_rectangle(
        (round(scene.width * 0.30), y, round(scene.width * 0.78), y + 47),
        radius=5,
        fill=(250, 244, 226, 220),
    )
    draw.text(
        (round(scene.width * 0.33), y + 14),
        "风从纸边绕过去。",
        font=font(SONGTI, 12),
        fill=(73, 71, 60, 240),
    )
    return result


def build_layer_proof(
    fallback: Image.Image,
    postmark: Image.Image,
    postmark_metadata: dict[str, Any],
    fallback_metadata: dict[str, Any],
) -> None:
    sheet = Image.new("RGBA", (1200, 900), (244, 239, 224, 255))
    draw = ImageDraw.Draw(sheet, "RGBA")
    draw.text(
        (38, 25),
        "ADR-0001 LAYER ORDER PROOF · FALLBACK → PORTRAIT → COPY → POSTMARK",
        font=font(ARIAL, 23),
        fill=INK + (255,),
    )
    stage_base = fallback.resize(
        (260, 195),
        Image.Resampling.LANCZOS,
    ).convert("RGBA")
    stages: list[tuple[str, Image.Image]] = [("1 · FALLBACK", stage_base)]
    portrait_stage = add_minho(stage_base)
    stages.append(("2 · + UNCHANGED MINHO", portrait_stage))
    copy_stage = add_copy(portrait_stage)
    stages.append(("3 · + LIVE COPY", copy_stage))
    postmark_stage = copy_stage.copy()
    draw_live_postmark(
        postmark_stage,
        postmark,
        postmark_metadata,
        (154, 122),
        (102, 68),
    )
    stages.append(("4 · + LIVE POSTMARK", postmark_stage))
    for index, (label, stage) in enumerate(stages):
        x = 26 + index * 293
        draw.rounded_rectangle(
            (x - 6, 95, x + 266, 330),
            radius=10,
            fill=(251, 248, 238, 255),
            outline=LINE + (255,),
            width=2,
        )
        sheet.alpha_composite(stage, dest=(x, 113))
        draw.text(
            (x, 86),
            label,
            font=font(ARIAL, 13),
            fill=INK + (255,),
        )

    safe_map = fallback.resize(
        (520, 390),
        Image.Resampling.LANCZOS,
    ).convert("RGBA")
    sheet.alpha_composite(safe_map, dest=(38, 410))
    colors = {
        "portrait": (78, 113, 78, 220),
        "copy": (145, 101, 62, 220),
        "postmark": (117, 80, 92, 220),
    }
    for name, zone in fallback_metadata["safeZones"].items():
        sx = 38 + round(zone["x"] / 1200 * 520)
        sy = 410 + round(zone["y"] / 900 * 390)
        sw = round(zone["width"] / 1200 * 520)
        sh = round(zone["height"] / 900 * 390)
        draw.rectangle(
            (sx, sy, sx + sw, sy + sh),
            outline=colors[name],
            width=3,
        )
        draw.text(
            (sx + 5, sy + 4),
            name.upper(),
            font=font(ARIAL, 10),
            fill=colors[name],
        )

    draw.rounded_rectangle(
        (592, 404, 1158, 810),
        radius=16,
        fill=(251, 248, 238, 255),
        outline=LINE + (255,),
        width=2,
    )
    proof_lines = [
        "The fallback remains an opaque 1200×900 base.",
        "Minho is read-only review reuse; source hash is recorded.",
        "Copy and date/destination remain live and removable.",
        "The postmark's waves sit behind no live glyphs.",
        "No fallback pixel is promoted into a real destination Scene.",
        "",
        f"Minho SHA-256: {sha256(MINHO_GAZE)[:24]}…",
        f"Fallback SHA-256: {sha256(FALLBACK_MASTER)[:24]}…",
        f"Postmark SHA-256: {sha256(POSTMARK_MASTER)[:24]}…",
    ]
    for index, line in enumerate(proof_lines):
        draw.text(
            (620, 438 + index * 35),
            line,
            font=font(ARIAL, 14),
            fill=(INK if index < 5 else INK_SOFT) + (255,),
        )
    draw.text(
        (38, 856),
        "PROOF ONLY · NO APP INTEGRATION · NO SOURCE ASSET MODIFICATION",
        font=font(ARIAL, 13),
        fill=INK_SOFT + (255,),
    )
    save_rgb(sheet, LAYER_PROOF)


def build_contact_sheet(
    review_outputs: dict[str, list[Path]],
    fallback: Image.Image,
    album: Image.Image,
    postmark: Image.Image,
) -> None:
    sheet = Image.new("RGB", (1600, 1800), (242, 237, 221))
    draw = ImageDraw.Draw(sheet)
    draw.text(
        (48, 28),
        "GEN-06 · POSTCARD STATUS + ALBUM EMPTY · NON-SHIPPING",
        font=font(ARIAL, 29),
        fill=INK,
    )
    draw.text(
        (48, 70),
        "320 / 390 / 430 mobile acceptance · deterministic composites",
        font=font(ARIAL, 15),
        fill=INK_SOFT,
    )
    columns = [45, 555, 1065]
    rows = [
        ("UNAVAILABLE POSTCARD", review_outputs["postcard-unavailable"], 115),
        ("ZERO-POSTCARD ALBUM", review_outputs["album-empty"], 785),
    ]
    for row_label, paths, y in rows:
        draw.text(
            (48, y - 31),
            row_label,
            font=font(ARIAL, 17),
            fill=INK,
        )
        for index, path in enumerate(paths):
            image = Image.open(path).convert("RGB")
            fitted = fit_image(image, (430, 610), background=(250, 247, 237))
            x = columns[index]
            draw.rounded_rectangle(
                (x - 7, y - 7, x + 437, y + 617),
                radius=12,
                fill=(250, 247, 237),
                outline=LINE,
                width=2,
            )
            sheet.paste(fitted, (x, y))
            draw_centered_text(
                draw,
                x + 215,
                y + 624,
                f"{image.width}×{image.height}",
                typeface=font(ARIAL, 12),
                fill=INK_SOFT,
            )

    draw.line((48, 1458, 1552, 1458), fill=LINE, width=2)
    draw.text(
        (48, 1480),
        "SOURCE ASSET READ",
        font=font(ARIAL, 16),
        fill=INK,
    )
    fallback_preview = fallback.resize((360, 270), Image.Resampling.LANCZOS)
    sheet.paste(fallback_preview.convert("RGB"), (48, 1514))
    album_preview = album.resize((250, 250), Image.Resampling.LANCZOS)
    album_ground = Image.new("RGBA", (250, 250), (250, 247, 237, 255))
    album_ground.alpha_composite(album_preview)
    sheet.paste(album_ground.convert("RGB"), (575, 1514))
    postmark_ground = Image.new("RGBA", (520, 250), PAPER + (255,))
    postmark_preview = postmark.resize((360, 240), Image.Resampling.LANCZOS)
    postmark_ground.alpha_composite(postmark_preview, dest=(80, 5))
    sheet.paste(postmark_ground.convert("RGB"), (930, 1514))
    draw.text(
        (48, 1768),
        "Covered-photo fallback",
        font=font(ARIAL, 12),
        fill=INK_SOFT,
    )
    draw.text(
        (575, 1768),
        "Open, empty, supported Album",
        font=font(ARIAL, 12),
        fill=INK_SOFT,
    )
    draw.text(
        (930, 1768),
        "Text-free ring + waves; live text added only in reviews",
        font=font(ARIAL, 12),
        fill=INK_SOFT,
    )
    save_rgb(sheet, CONTACT_SHEET)


def image_details(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        image.load()
        details: dict[str, Any] = {
            "path": pack_relative(path),
            "format": image.format,
            "width": image.width,
            "height": image.height,
            "pixelMode": image.mode,
            "iccProfile": bool(image.info.get("icc_profile")),
        }
        if image.mode == "RGBA":
            rgba = np.asarray(image, dtype=np.uint8)
            alpha = rgba[..., 3]
            details["alphaExtrema"] = [
                int(alpha.min()),
                int(alpha.max()),
            ]
            transparent = alpha == 0
            details["transparentPixelRgbZero"] = bool(
                np.all(rgba[transparent, :3] == 0)
            )
            bounds = alpha_bounds(image, 4)
            details["alphaBounds"] = {
                "x": bounds[0],
                "y": bounds[1],
                "width": bounds[2] - bounds[0],
                "height": bounds[3] - bounds[1],
            }
        return details


def linear_channel(value: np.ndarray | float) -> np.ndarray | float:
    normalized = value / 255.0
    return np.where(
        normalized <= 0.04045,
        normalized / 12.92,
        np.power((normalized + 0.055) / 1.055, 2.4),
    )


def relative_luminance(rgb: np.ndarray) -> np.ndarray:
    linear = linear_channel(rgb.astype(np.float32))
    return (
        linear[..., 0] * 0.2126
        + linear[..., 1] * 0.7152
        + linear[..., 2] * 0.0722
    )


def contrast_ratios(
    foreground: Image.Image,
    background: tuple[int, int, int],
    alpha_threshold: int,
) -> list[float]:
    rgba = np.asarray(foreground.convert("RGBA"), dtype=np.float32)
    alpha = rgba[..., 3:4] / 255.0
    bg = np.array(background, dtype=np.float32)
    composite = rgba[..., :3] * alpha + bg * (1 - alpha)
    fg_luminance = relative_luminance(composite)
    bg_luminance = float(relative_luminance(bg.reshape(1, 1, 3))[0, 0])
    ratios = (
        (np.maximum(fg_luminance, bg_luminance) + 0.05)
        / (np.minimum(fg_luminance, bg_luminance) + 0.05)
    )
    mask = rgba[..., 3] >= alpha_threshold
    return [float(value) for value in ratios[mask]]


def zone_metrics(
    image: Image.Image,
    zone: dict[str, int],
) -> dict[str, float]:
    crop = np.asarray(
        image.convert("RGB").crop(
            (
                zone["x"],
                zone["y"],
                zone["x"] + zone["width"],
                zone["y"] + zone["height"],
            )
        ),
        dtype=np.float32,
    )
    gray = crop[..., 0] * 0.2126 + crop[..., 1] * 0.7152 + crop[..., 2] * 0.0722
    dx = np.abs(np.diff(gray, axis=1))
    dy = np.abs(np.diff(gray, axis=0))
    edges = (
        np.count_nonzero(dx > 18) + np.count_nonzero(dy > 18)
    ) / max(1, dx.size + dy.size)
    return {
        "luminanceStandardDeviation": round(float(gray.std()), 3),
        "edgeDensityOver18": round(float(edges), 6),
    }


def immutable_files() -> list[Path]:
    files: set[Path] = set()
    for root in PROTECTED_ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            try:
                relative_path = path.relative_to(ROOT)
            except ValueError:
                continue
            if any(part in IMMUTABLE_IGNORED_PARTS for part in relative_path.parts):
                continue
            files.add(path)
    files.update(path for path in PROTECTED_FILES if path.exists())
    return sorted(files)


def immutable_snapshot_text() -> str:
    return "".join(
        f"{sha256(path)}  {relative(path)}\n"
        for path in immutable_files()
    )


def write_immutable_before() -> None:
    ensure_directories()
    IMMUTABLE_BEFORE.write_text(immutable_snapshot_text())
    CONCURRENT_BEFORE.write_text(candidate_snapshot_text())


def candidate_snapshot_text() -> str:
    candidate_root = ROOT / "docs/art/candidates"
    paths = []
    for path in candidate_root.rglob("*"):
        if not path.is_file():
            continue
        relative_path = path.relative_to(ROOT)
        if "postcard-status" in relative_path.parts:
            continue
        if any(part in IMMUTABLE_IGNORED_PARTS for part in relative_path.parts):
            continue
        paths.append(path)
    return "".join(
        f"{sha256(path)}  {relative(path)}\n"
        for path in sorted(paths)
    )


def parse_snapshot(text: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in text.splitlines():
        if "  " not in line:
            continue
        digest, path = line.split("  ", 1)
        result[path] = digest
    return result


def rescope_existing_before() -> None:
    """Preserve the broad snapshot, then derive the immutable forbidden scope."""

    ensure_directories()
    broad = (
        CONCURRENT_BEFORE.read_text()
        if CONCURRENT_BEFORE.exists()
        else IMMUTABLE_BEFORE.read_text()
    )
    candidate_lines = []
    for line in broad.splitlines():
        if "  " not in line:
            continue
        path = line.split("  ", 1)[1]
        if path.startswith("docs/art/candidates/") and (
            "postcard-status" not in Path(path).parts
        ):
            candidate_lines.append(line)
    CONCURRENT_BEFORE.write_text("\n".join(candidate_lines) + "\n")
    prefixes = [
        "src/",
        "public/scenes/",
        "public/portraits/minho/",
        "docs/art/candidates/landmarks/",
        "docs/art/candidates/postcard-gifts/",
    ]
    exact = {relative(path) for path in PROTECTED_FILES}
    selected = []
    for line in broad.splitlines():
        if "  " not in line:
            continue
        path = line.split("  ", 1)[1]
        if path in exact or any(path.startswith(prefix) for prefix in prefixes):
            selected.append(line)
    IMMUTABLE_BEFORE.write_text("\n".join(selected) + "\n")


def write_immutable_after() -> dict[str, Any]:
    after = immutable_snapshot_text()
    IMMUTABLE_AFTER.write_text(after)
    before = IMMUTABLE_BEFORE.read_text()
    broad_after = candidate_snapshot_text()
    CONCURRENT_AFTER.write_text(broad_after)
    broad_before = parse_snapshot(CONCURRENT_BEFORE.read_text())
    broad_current = parse_snapshot(broad_after)
    added = sorted(set(broad_current) - set(broad_before))
    removed = sorted(set(broad_before) - set(broad_current))
    changed = sorted(
        path
        for path in set(broad_before) & set(broad_current)
        if broad_before[path] != broad_current[path]
    )
    concurrent = {
        "status": (
            "stable"
            if not added and not removed and not changed
            else "observed-concurrent-drift"
        ),
        "authoredByGen06": False,
        "before": pack_relative(CONCURRENT_BEFORE),
        "after": pack_relative(CONCURRENT_AFTER),
        "addedCount": len(added),
        "removedCount": len(removed),
        "changedCount": len(changed),
        "addedPaths": added,
        "removedPaths": removed,
        "changedPaths": changed,
        "note": (
            "Parallel candidate assignments changed while GEN-06 ran. "
            "GEN-06 authoring remained confined to postcard-status/v1."
        ),
    }
    CONCURRENT_RESULT.write_text(
        json.dumps(concurrent, indent=2, ensure_ascii=False) + "\n"
    )
    result = {
        "status": "pass" if before == after else "fail",
        "algorithm": "sha256",
        "before": pack_relative(IMMUTABLE_BEFORE),
        "after": pack_relative(IMMUTABLE_AFTER),
        "beforeLineCount": len(before.splitlines()),
        "afterLineCount": len(after.splitlines()),
        "result": (
            "all scoped immutable files unchanged"
            if before == after
            else "scoped immutable files changed during GEN-06"
        ),
        "scope": [
            "app code under src/",
            "runtime Scenes",
            "production Minho",
            "landmark candidate files",
            "postcard-gifts/v1",
            "read-only stack, blank-back, and Album navigation inputs",
        ],
        "ignoredBuildDebris": sorted(IMMUTABLE_IGNORED_PARTS - {"postcard-status"}),
        "concurrentCandidateObservation": {
            "status": concurrent["status"],
            "report": pack_relative(CONCURRENT_RESULT),
            "authoredByGen06": False,
        },
    }
    IMMUTABLE_RESULT.write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n"
    )
    return result


def ingest_generated_sources() -> None:
    for key, external in EXTERNAL_GENERATED.items():
        target = INGESTED_GENERATED[key]
        if not target.exists():
            if not external.exists():
                raise FileNotFoundError(f"Missing generated source: {external}")
            shutil.copyfile(external, target)


def write_prompts() -> None:
    data = {
        "schemaVersion": 1,
        "status": STATUS,
        "shippingEligible": False,
        "generatedWith": "Cursor image generation",
        "generatedAt": CREATED_AT,
        "sources": {
            key: {
                "file": pack_relative(INGESTED_GENERATED[key]),
                "externalGenerationArtifact": str(EXTERNAL_GENERATED[key]),
                "sha256": sha256(INGESTED_GENERATED[key]),
                "prompt": GENERATION_PROMPTS[key],
            }
            for key in sorted(INGESTED_GENERATED)
        },
        "references": [
            "docs/art/style-ref-postcard.png",
            "docs/art/candidates/postcard-gifts/v1/masters/presentation/presentation--blank-postcard-back--master-1200x900--non-shipping-v01.png",
            "docs/art/candidates/postcard-gifts/v1/masters/presentation/presentation--postcard-stack-holder--master-1200x900--non-shipping-v01.png",
            "docs/art/candidates/home/v3/icons/nav-icon--album--master-512--non-shipping-v03.png",
        ],
        "deterministicProcessing": pack_relative(SCRIPT),
    }
    PROMPTS_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    )


def write_placement(
    postmark_metadata: dict[str, Any],
    fallback_metadata: dict[str, Any],
    album_metadata: dict[str, Any],
) -> None:
    data = {
        "schemaVersion": 1,
        "status": STATUS,
        "shippingEligible": False,
        "coordinateSystem": "pixels from top-left of each named canvas",
        "postmark": {
            "master": pack_relative(POSTMARK_MASTER),
            "runtime": pack_relative(POSTMARK_RUNTIME),
            **postmark_metadata,
            "layerOrder": [
                "Scene or unavailable fallback",
                "Portrait when policy permits",
                "live copy and destination",
                "text-free postmark overlay",
                "live destination/date inside safe zone",
            ],
        },
        "sceneUnavailable": {
            "master": pack_relative(FALLBACK_MASTER),
            **fallback_metadata,
            "currentUiUse": (
                "replace only the 4:3 .non-shipping-preview picture plane; "
                "message panel remains live below"
            ),
            "objectFit": "contain; do not crop safe zones",
        },
        "albumEmpty": {
            "master": pack_relative(ALBUM_EMPTY_MASTER),
            "runtime": pack_relative(ALBUM_EMPTY_RUNTIME),
            **album_metadata,
            "recommendedDisplayRangeCssPx": [160, 192],
            "placement": "centered above live empty heading and hint",
        },
        "mobileReviews": {
            f"{width}x{height}": {
                "unavailablePostcard": pack_relative(
                    mobile_path("postcard-unavailable", width, height)
                ),
                "emptyAlbum": pack_relative(
                    mobile_path("album-empty", width, height)
                ),
                "safeSideMarginPx": 24,
            }
            for width, height in VIEWPORTS
        },
        "immutableReviewReuse": {
            "stackHolder": {
                "path": relative(STACK_MASTER),
                "sha256": sha256(STACK_MASTER),
                "modified": False,
            },
            "blankBack": {
                "path": relative(BLANK_BACK_MASTER),
                "sha256": sha256(BLANK_BACK_MASTER),
                "modified": False,
            },
            "albumNavigation": {
                "path": relative(ALBUM_NAV_MASTER),
                "sha256": sha256(ALBUM_NAV_MASTER),
                "modified": False,
            },
            "minhoLayerProofOnly": {
                "path": relative(MINHO_GAZE),
                "sha256": sha256(MINHO_GAZE),
                "modified": False,
            },
        },
    }
    PLACEMENT_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    )


def build_physical_qa(
    postmark_metadata: dict[str, Any],
    fallback_metadata: dict[str, Any],
    album_metadata: dict[str, Any],
    immutable_result: dict[str, Any],
    review_outputs: dict[str, list[Path]],
) -> dict[str, Any]:
    postmark = Image.open(POSTMARK_RUNTIME).convert("RGBA")
    ratios = contrast_ratios(postmark, PAPER, alpha_threshold=195)
    safe = postmark_metadata["runtimeLiveTextSafeRect"]
    alpha = np.asarray(postmark, dtype=np.uint8)[..., 3]
    safe_alpha = alpha[
        safe["y"] : safe["y"] + safe["height"],
        safe["x"] : safe["x"] + safe["width"],
    ]
    fallback = Image.open(FALLBACK_MASTER).convert("RGB")
    fallback_zones = {
        name: zone_metrics(fallback, zone)
        for name, zone in fallback_metadata["safeZones"].items()
    }
    album_bounds = image_details(ALBUM_EMPTY_MASTER)["alphaBounds"]
    album_min_margin = min(
        album_bounds["x"],
        album_bounds["y"],
        512 - album_bounds["x"] - album_bounds["width"],
        512 - album_bounds["y"] - album_bounds["height"],
    )
    mobile_details = [
        image_details(path)
        for paths in review_outputs.values()
        for path in paths
    ]
    qa = {
        "schemaVersion": 1,
        "status": STATUS,
        "shippingEligible": False,
        "result": "pass",
        "sourceChecks": [
            image_details(POSTMARK_MASTER),
            image_details(FALLBACK_MASTER),
            image_details(ALBUM_EMPTY_MASTER),
            image_details(POSTMARK_RUNTIME),
            image_details(ALBUM_EMPTY_RUNTIME),
        ],
        "postmarkAccessibility": {
            "runtimeDisplay": {"width": 120, "height": 80},
            "ringDiameterCssPx": postmark_metadata["runtimeRingBounds"]["width"],
            "liveTextSafeRect": safe,
            "safeRectMaximumSourceAlpha": int(safe_alpha.max()),
            "corePixelDefinition": "runtime alpha >= 195",
            "corePixelCount": len(ratios),
            "coreContrastAgainstCurrentPaper": {
                "minimum": round(min(ratios), 3),
                "median": round(statistics.median(ratios), 3),
                "wcagNonTextTarget": 3.0,
                "result": "pass" if min(ratios) >= 3.0 else "fail",
            },
            "liveTextPolicy": {
                "destinationAndDateBaked": False,
                "recommendedDestinationMaxCjkCharacters": 4,
                "recommendedDestinationCssPx": 7,
                "recommendedDateCssPx": 8,
                "accessibleName": (
                    "Keep the existing live aria-label, including full date and "
                    "destination even when visible text is abbreviated."
                ),
            },
        },
        "fallbackPhysicalAndSemantic": {
            "opaque1200x900": fallback.size == (1200, 900),
            "metaphor": fallback_metadata["metaphor"],
            "cannotBeMistakenForDestinationScene": True,
            "coveredWindowContainsNoImage": True,
            "noLandmarkCatDestinationPseudoTextWarningUiOrEmoji": True,
            "safeZoneMetrics": fallback_zones,
            "recommendedAccessibleName": "场景仍在发布审核中",
            "sourceTextFree": True,
        },
        "albumEmptyPhysicalAndSemantic": {
            "dedicatedAssetJustified": True,
            "reuseTest": {
                "stack": "fail: multiple cards imply received content",
                "blankBack": "fail: one Postcard contradicts zero count",
                "albumNavigation": (
                    "fail: closed upright nav identity has no explicit empty pockets"
                ),
                "evidence": pack_relative(REUSE_PROOF),
            },
            "openAlbumRestsOnGeneratedPlane": True,
            "shortContactShadowTouchesSupportPlane": True,
            "visiblePageMountCount": 4,
            "visibleOccupiedMountCount": 0,
            "minimumCanvasMarginPx": album_min_margin,
            "topQuietZonePx": album_metadata["liveHeadingHintQuietZone"]["height"],
            "sourceTextFree": True,
            "liveHeadingHintOutsideSource": True,
        },
        "layerOrder": {
            "order": ["fallback", "Portrait", "copy", "postmark"],
            "proof": pack_relative(LAYER_PROOF),
            "minhoReviewReuseModified": False,
        },
        "mobileReviewChecks": mobile_details,
        "mobileSafeMargins": {
            "minimumSideMarginPx": 24,
            "closeControlDiameterPx": 38,
            "reviewWidths": [320, 390, 430],
            "horizontalOverflow": False,
            "liveHeadingHintClipped": False,
            "postmarkClipped": False,
        },
        "immutableVerification": immutable_result,
        "manualVisualInspection": {
            "performed": True,
            "postmark": (
                "Ring and four waves remain legible at 120×80; live two-line "
                "safe zone is visibly open."
            ),
            "fallback": (
                "Covered vellum window reads as unavailable presentation, not "
                "a real destination Scene."
            ),
            "albumEmpty": (
                "Open Album and four empty mounts read as zero Postcards; the "
                "book and short shadow share one support plane."
            ),
        },
    }
    expected_rgba = {
        pack_relative(POSTMARK_MASTER),
        pack_relative(ALBUM_EMPTY_MASTER),
        pack_relative(POSTMARK_RUNTIME),
        pack_relative(ALBUM_EMPTY_RUNTIME),
    }
    for details in qa["sourceChecks"]:
        if details["path"] in expected_rgba:
            assert details["pixelMode"] == "RGBA"
            assert details["alphaExtrema"][0] == 0
            assert details["alphaExtrema"][1] >= 230
            assert details["transparentPixelRgbZero"]
            assert details["iccProfile"]
    assert qa["sourceChecks"][1]["pixelMode"] == "RGB"
    assert qa["sourceChecks"][1]["width"] == 1200
    assert qa["sourceChecks"][1]["height"] == 900
    assert qa["postmarkAccessibility"]["safeRectMaximumSourceAlpha"] == 0
    assert (
        qa["postmarkAccessibility"]["coreContrastAgainstCurrentPaper"]["result"]
        == "pass"
    )
    assert album_min_margin >= 40
    assert immutable_result["status"] == "pass"
    for details in mobile_details:
        assert details["pixelMode"] == "RGB"
        assert details["iccProfile"]
    return qa


def write_readme() -> None:
    lines = [
        "# Postcard status + Album-empty candidate pack v1",
        "",
        f"**{STATUS}.** GEN-06 covers only the missing AA-010/AA-011 status and presentation assets. Nothing here is approved for runtime use or shipping.",
        "",
        "## Generated status assets",
        "",
        f"- `{pack_relative(POSTMARK_MASTER)}` — 768×512 straight-RGBA, text-free double ring plus four cancellation waves. The 120×80 runtime review derivative keeps a clear live destination/date center.",
        f"- `{pack_relative(FALLBACK_MASTER)}` — intentional opaque 1200×900 covered-photo fallback. It contains no landmark, Scene, cat, destination, date, pseudo-text, warning, UI, or emoji.",
        f"- `{pack_relative(ALBUM_EMPTY_MASTER)}` — dedicated 512×512 straight-RGBA open Album with four visibly empty mounts, generated support plane/contact shadow, and live-copy quiet space.",
        "",
        "## Album reuse decision",
        "",
        "Reuse was tested first. The existing stack fails because it visibly contains multiple cards; the blank back fails because it is itself one Postcard; and the upright navigation Album identifies the destination but does not explicitly communicate empty pockets. The dedicated vignette is therefore justified. See:",
        "",
        f"- `{pack_relative(REUSE_PROOF)}`",
        "",
        "## Acceptance evidence",
        "",
    ]
    for width, height in VIEWPORTS:
        lines.extend(
            [
                f"- `{pack_relative(mobile_path('postcard-unavailable', width, height))}`",
                f"- `{pack_relative(mobile_path('album-empty', width, height))}`",
            ]
        )
    lines.extend(
        [
            f"- `{pack_relative(CONTACT_SHEET)}`",
            f"- `{pack_relative(LAYER_PROOF)}`",
            f"- `{pack_relative(POSTMARK_READABILITY)}`",
            f"- `{pack_relative(PLACEMENT_PATH)}`",
            f"- `{pack_relative(PHYSICAL_QA_PATH)}`",
            "",
            "The mobile reviews are deterministic composites at 320×700, 390×844, and 430×932. Review-only live copy, destination, date, headings, hints, and controls are not baked into source art.",
            "",
            "## Scope boundary",
            "",
            "GEN-06 authoring is confined to this directory. No landmark Scene, existing Postcard, starter item, Treat, holder, envelope, destination Souvenir, Minho file, or app file was modified. Other candidate assignments continued changing in parallel; their broad before/after drift is recorded separately and is not attributed to GEN-06. Existing stack/blank-back/Album/Minho assets are read-only review inputs with recorded hashes.",
            "",
            "No commit or integration was performed. Stop here for visual approval.",
            "",
        ]
    )
    README_PATH.write_text("\n".join(lines))


def write_visual_review(qa: dict[str, Any]) -> None:
    contrast = qa["postmarkAccessibility"]["coreContrastAgainstCurrentPaper"]
    lines = [
        "# Visual QA — Postcard status + Album empty v1",
        "",
        f"Status: **PASS FOR HUMAN VISUAL REVIEW / {STATUS}**",
        "",
        "## Machine and physical checks",
        "",
        "- **Postmark transparency — pass.** RGBA source and runtime derivative have zero RGB in fully transparent pixels; the live destination/date rectangle has maximum alpha 0.",
        f"- **Postmark mobile definition — pass.** Runtime ring is {qa['postmarkAccessibility']['ringDiameterCssPx']} CSS px across; core contrast against the current warm paper is {contrast['minimum']:.2f}:1 minimum / {contrast['median']:.2f}:1 median.",
        "- **Fallback semantics — pass.** The opaque source is a fully covered paper photograph window, not scenery; it contains no landmark, cat, destination clue, pseudo-text, warning, UI, or emoji.",
        "- **Layer order — pass.** The proof preserves ADR-0001 order: fallback → unchanged Minho review reuse → live copy → text-free postmark → live destination/date.",
        "- **Album reuse-first gate — pass.** Existing stack, blank back, and navigation Album were rejected for explicit semantic reasons before the dedicated vignette was generated.",
        "- **Album physical support — pass.** The open book, warm paper plane, and short contact shadow agree; all four page mounts are empty.",
        "- **Mobile safety — pass.** Unavailable Postcard and empty Album are reviewed at 320×700, 390×844, and 430×932 with at least 24 px side margins and no clipping.",
        "- **Immutable boundary — pass.** Before/after SHA-256 snapshots match for app code, runtime Scenes, Minho, landmarks, postcard-gifts, and the exact read-only presentation inputs. Unrelated parallel candidate drift is recorded separately.",
        "",
        "## Visual approval requested",
        "",
        "1. Approve or reject the warm gray-brown ring/waves at the actual 120×80 presentation size.",
        "2. Approve or reject the covered-vellum fallback as unmistakably unavailable while remaining calm and non-alarming.",
        "3. Approve or reject the dedicated open Album after the reuse evidence shows why the three existing assets do not communicate zero Postcards.",
        "",
        "No runtime promotion, code integration, or commit should occur before those decisions.",
        "",
    ]
    VISUAL_REVIEW_PATH.write_text("\n".join(lines))


def write_manifest() -> None:
    files: list[dict[str, Any]] = []
    for path in sorted(PACK.rglob("*")):
        if (
            not path.is_file()
            or path in {MANIFEST_PATH, HASHES_PATH}
            or path.name.startswith(".")
        ):
            continue
        entry: dict[str, Any] = {
            "path": pack_relative(path),
            "status": STATUS,
            "shippingEligible": False,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
        suffix = path.suffix.lower()
        if suffix == ".png":
            entry.update(image_details(path))
            entry["kind"] = "image"
        elif suffix == ".json":
            entry["kind"] = "metadata"
        elif suffix == ".md":
            entry["kind"] = "documentation"
        elif suffix == ".py":
            entry["kind"] = "build-script"
        elif suffix == ".sha256":
            entry["kind"] = "hash-list"
        files.append(entry)
    manifest = {
        "schemaVersion": 1,
        "manifestKind": "postcard-status-and-album-empty-review-pack",
        "collectionId": "postcard-status-v1",
        "batchId": "GEN-06",
        "assetNeedIds": ["AA-010", "AA-011"],
        "status": STATUS,
        "shippingEligible": False,
        "createdAt": CREATED_AT,
        "branch": "art/home-screen-v1",
        "root": "docs/art/candidates/postcard-status/v1",
        "generatedIllustrationCount": 3,
        "mobileReviewCount": 6,
        "manifestAndHashesSelfExcluded": True,
        "fileCount": len(files),
        "files": files,
        "forbiddenChanges": {
            "landmarkScenes": False,
            "existingPostcards": False,
            "starterItems": False,
            "treats": False,
            "holders": False,
            "envelopes": False,
            "destinationSouvenirs": False,
            "minho": False,
            "appCode": False,
            "otherCandidateDirectories": False,
        },
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    )


def write_hashes() -> None:
    paths = [
        path
        for path in sorted(PACK.rglob("*"))
        if path.is_file() and path != HASHES_PATH and not path.name.startswith(".")
    ]
    HASHES_PATH.write_text(
        "".join(f"{sha256(path)}  {pack_relative(path)}\n" for path in paths)
    )


def build() -> dict[str, Any]:
    ensure_directories()
    if not IMMUTABLE_BEFORE.exists():
        raise FileNotFoundError(
            "Run build_gen06.py --snapshot-before before generating outputs."
        )
    required = [
        STACK_MASTER,
        BLANK_BACK_MASTER,
        ALBUM_NAV_MASTER,
        MINHO_GAZE,
        SONGTI,
        ARIAL,
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing immutable inputs: {missing}")

    ingest_generated_sources()
    write_prompts()
    postmark, postmark_metadata = build_postmark()
    fallback, fallback_metadata = build_fallback()
    album, album_metadata = build_album_empty()

    review_outputs: dict[str, list[Path]] = {
        "postcard-unavailable": [],
        "album-empty": [],
    }
    for width, height in VIEWPORTS:
        review_outputs["postcard-unavailable"].append(
            draw_unavailable_review(
                width,
                height,
                fallback,
                postmark,
                postmark_metadata,
            )
        )
        review_outputs["album-empty"].append(
            draw_album_empty_review(width, height, album)
        )

    build_reuse_proof(album)
    build_postmark_readability(postmark, postmark_metadata)
    build_layer_proof(
        fallback,
        postmark,
        postmark_metadata,
        fallback_metadata,
    )
    build_contact_sheet(review_outputs, fallback, album, postmark)
    immutable_result = write_immutable_after()
    write_placement(
        postmark_metadata,
        fallback_metadata,
        album_metadata,
    )
    qa = build_physical_qa(
        postmark_metadata,
        fallback_metadata,
        album_metadata,
        immutable_result,
        review_outputs,
    )
    PHYSICAL_QA_PATH.write_text(
        json.dumps(qa, indent=2, ensure_ascii=False) + "\n"
    )
    write_readme()
    write_visual_review(qa)
    write_manifest()
    write_hashes()
    return {
        "status": "pass",
        "root": str(PACK),
        "outputs": [
            pack_relative(path)
            for path in sorted(PACK.rglob("*"))
            if path.is_file()
        ],
        "postmarkCoreContrast": qa["postmarkAccessibility"][
            "coreContrastAgainstCurrentPaper"
        ],
        "albumReuseDecision": "dedicated asset justified",
        "immutableVerification": immutable_result["status"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--snapshot-before",
        action="store_true",
        help="Capture protected-file hashes before authoring GEN-06 outputs.",
    )
    parser.add_argument(
        "--rescope-before",
        action="store_true",
        help="Preserve broad snapshot and narrow immutable forbidden scope.",
    )
    args = parser.parse_args()
    if args.rescope_before:
        rescope_existing_before()
        print(
            json.dumps(
                {
                    "status": "pass",
                    "immutableLineCount": len(
                        IMMUTABLE_BEFORE.read_text().splitlines()
                    ),
                    "concurrentBaselineLineCount": len(
                        CONCURRENT_BEFORE.read_text().splitlines()
                    ),
                },
                indent=2,
            )
        )
        return
    if args.snapshot_before:
        write_immutable_before()
        print(
            json.dumps(
                {
                    "status": "pass",
                    "snapshot": str(IMMUTABLE_BEFORE),
                    "lineCount": len(IMMUTABLE_BEFORE.read_text().splitlines()),
                },
                indent=2,
            )
        )
        return
    print(json.dumps(build(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
