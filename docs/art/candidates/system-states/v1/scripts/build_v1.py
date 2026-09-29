#!/usr/bin/env python3
"""Build the non-shipping GEN-03 loading-vignette review pack."""

from __future__ import annotations

import hashlib
import json
from collections import deque
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageCms, ImageDraw, ImageFilter, ImageFont

SCRIPT = Path(__file__).resolve()
V1 = SCRIPT.parents[1]
REPO = SCRIPT.parents[6]
STATUS = "NON-SHIPPING / VISUAL-REVIEW-ONLY"
CREATED_AT = "2026-07-21"
VIEWPORTS = ((320, 568), (390, 844), (430, 932))
MASTER_SIZE = 512
ART_SLOT = 160
LOADING_DISPLAY = 128
RESTORE_SLOT = 112
RESTORE_DISPLAY = 96

SONGTI = Path("/System/Library/Fonts/Supplemental/Songti.ttc")
ARIAL = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
SOURCES = V1 / "sources"
MASTERS = V1 / "masters"
RUNTIME = V1 / "runtime"
LOADING_REVIEWS = V1 / "reviews/loading"
REUSE_REVIEWS = V1 / "reviews/reuse"
CONTACT_SHEET = V1 / (
    "reviews/contact-sheet--gen03-loading-vignettes--"
    "1600x2000--non-shipping-v01.png"
)
METADATA_PATH = V1 / "placement-metadata.v1.json"
QA_PATH = V1 / "qa/qa-report.v1.json"
README_PATH = V1 / "README.md"
MANIFEST_PATH = V1 / "manifest.v1.json"
HASHES_PATH = V1 / "hashes.sha256"

STYLE_REFERENCES = (
    "docs/art/style-ref-home.png",
    "docs/art/style-ref-postcard.png",
    "docs/art/style-ref-poses.png",
    "docs/art/candidates/style-intensity/"
    "style-intensity-B-reference-calibration-non-final-20260720.png",
)
MINHO_REFERENCES = (
    "docs/art/candidates/calibration/"
    "calibration-non-final--portrait-board--minho--candidate-a--v02.png",
    "public/portraits/minho/portrait--minho--sit--v01.png",
)

SPECS: dict[str, dict[str, Any]] = {
    "letter-tray": {
        "label": "Candidate A · closed letter tray",
        "shortLabel": "A · LETTER TRAY",
        "sourceExternal": Path(
            "/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/"
            "assets/gen03-letter-tray-source.png"
        ),
        "sourceOriginalSha256": (
            "5de3365f5c2f3310792d0d28b984aebf65f35fab6f98caeb705aa5dac3835dc8"
        ),
        "source": SOURCES
        / "generated-source--letter-tray--1024--cursor-generate-image.png",
        "master": MASTERS
        / "loading-vignette--letter-tray--master-512--non-shipping-v01.png",
        "runtime256": RUNTIME
        / "loading-vignette--letter-tray--runtime-256--non-shipping-v01.png",
        "runtime128": RUNTIME
        / "loading-vignette--letter-tray--runtime-128--non-shipping-v01.png",
        "outerPolygons": [
            [
                (242, 238), (760, 252), (781, 279), (786, 653),
                (718, 691), (223, 667), (226, 286),
            ],
            [
                (245, 530), (770, 534), (839, 553), (889, 593),
                (898, 642), (878, 710), (820, 758), (747, 784),
                (267, 784), (201, 763), (157, 723), (138, 663),
                (141, 603), (178, 565),
            ],
        ],
        "crop": (130, 225, 905, 795),
        "maxContent": (380, 300),
        "cue": (
            "two restrained warm-gray tabby bands on the tied cord, sampled "
            "from approved Minho only as a color/pattern cue"
        ),
        "selectionRead": (
            "The closed envelope and roof-like flap most directly connect "
            "home, letter, and careful reassembly."
        ),
    },
    "house-box": {
        "label": "Candidate B · closed house keepsake",
        "shortLabel": "B · HOUSE BOX",
        "sourceExternal": Path(
            "/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/"
            "assets/gen03-house-box-source.png"
        ),
        "sourceOriginalSha256": (
            "b0d50157c83ec8f89184ab36d06dc3d476a64b32e710876c5f709a2eec95aa8c"
        ),
        "source": SOURCES
        / "generated-source--house-box--1024--cursor-generate-image.png",
        "master": MASTERS
        / "loading-vignette--house-box--master-512--non-shipping-v01.png",
        "runtime256": RUNTIME
        / "loading-vignette--house-box--runtime-256--non-shipping-v01.png",
        "runtime128": RUNTIME
        / "loading-vignette--house-box--runtime-128--non-shipping-v01.png",
        "outerPolygons": [
            [
                (199, 351), (271, 226), (301, 218), (690, 219),
                (815, 378), (825, 399), (807, 426), (808, 639),
                (746, 666), (247, 679), (206, 647), (195, 416),
            ],
            [
                (180, 520), (832, 521), (914, 558), (939, 598),
                (936, 677), (881, 723), (786, 781), (716, 805),
                (250, 805), (181, 786), (121, 748), (95, 685),
                (98, 596), (130, 555),
            ],
        ],
        "crop": (90, 210, 945, 812),
        "maxContent": (380, 300),
        "cue": (
            "two restrained warm-gray tabby bands inset into the oval latch, "
            "sampled from approved Minho only as a color/pattern cue"
        ),
        "selectionRead": (
            "The aligned roof lid and folded cloth give the clearest stable "
            "Home silhouette while remaining a neutral keepsake."
        ),
    },
}


def srgb_profile() -> bytes:
    return ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()


SRGB = srgb_profile()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def save_rgb(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(
        path, "PNG", icc_profile=SRGB, optimize=True, compress_level=9
    )


def zero_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def save_rgba(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    zero_transparent_rgb(image).save(
        path, "PNG", icc_profile=SRGB, optimize=True, compress_level=9
    )


def font(size: int, *, sans: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(ARIAL if sans else SONGTI), size)


def draw_centered(
    draw: ImageDraw.ImageDraw,
    text: str,
    center_x: float,
    y: float,
    *,
    typeface: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
) -> None:
    bounds = draw.textbbox((0, 0), text, font=typeface)
    draw.text(
        (center_x - (bounds[2] - bounds[0]) / 2, y),
        text,
        font=typeface,
        fill=fill,
    )


def antialiased_polygon_mask(
    size: tuple[int, int],
    polygons: list[list[tuple[int, int]]],
) -> Image.Image:
    scale = 4
    high = Image.new("L", (size[0] * scale, size[1] * scale), 0)
    draw = ImageDraw.Draw(high)
    for polygon in polygons:
        draw.polygon(
            [(x * scale, y * scale) for x, y in polygon],
            fill=255,
        )
    high = high.filter(ImageFilter.GaussianBlur(1.4))
    return high.resize(size, Image.Resampling.LANCZOS)


def remove_connected_checker(
    source: Image.Image,
    polygon_mask: Image.Image,
) -> Image.Image:
    """Flood away neutral checker pixels connected to the silhouette exterior."""
    rgb = np.asarray(source.convert("RGB"), dtype=np.uint8)
    inside = np.asarray(polygon_mask, dtype=np.uint8) >= 128
    channels = rgb.astype(np.int16)
    chroma = channels.max(axis=2) - channels.min(axis=2)
    mean = channels.mean(axis=2)
    removable = inside & (chroma <= 8) & (mean >= 221)

    outside_neighbor = np.zeros_like(inside)
    outside_neighbor[1:, :] |= ~inside[:-1, :]
    outside_neighbor[:-1, :] |= ~inside[1:, :]
    outside_neighbor[:, 1:] |= ~inside[:, :-1]
    outside_neighbor[:, :-1] |= ~inside[:, 1:]
    seeds = np.argwhere(removable & outside_neighbor)

    removed = np.zeros_like(inside)
    queue: deque[tuple[int, int]] = deque()
    for y_value, x_value in seeds:
        y = int(y_value)
        x = int(x_value)
        if removed[y, x]:
            continue
        removed[y, x] = True
        queue.append((y, x))

    height, width = inside.shape
    while queue:
        y, x = queue.popleft()
        for next_y, next_x in (
            (y - 1, x),
            (y + 1, x),
            (y, x - 1),
            (y, x + 1),
        ):
            if (
                0 <= next_y < height
                and 0 <= next_x < width
                and removable[next_y, next_x]
                and not removed[next_y, next_x]
            ):
                removed[next_y, next_x] = True
                queue.append((next_y, next_x))

    cleaned = inside & ~removed
    return Image.fromarray((cleaned.astype(np.uint8) * 255), "L")


def package_generated_source(spec: dict[str, Any]) -> Image.Image:
    packaged: Path = spec["source"]
    if not packaged.exists():
        external: Path = spec["sourceExternal"]
        if not external.exists():
            raise FileNotFoundError(
                f"Generated source missing at {external} and {packaged}"
            )
        if sha256(external) != spec["sourceOriginalSha256"]:
            raise RuntimeError(f"Generated source hash changed: {external}")
        save_rgb(Image.open(external), packaged)
    source = Image.open(packaged).convert("RGB")
    if source.size != (1024, 1024):
        raise RuntimeError(f"Expected 1024x1024 generated source: {packaged}")
    return source


def build_master(source: Image.Image, spec: dict[str, Any]) -> Image.Image:
    """Recover a clean alpha asset from the generator's baked checker preview."""
    polygon_mask = antialiased_polygon_mask(source.size, spec["outerPolygons"])
    mask = remove_connected_checker(source, polygon_mask).filter(
        ImageFilter.MinFilter(5)
    )
    rgba = source.convert("RGBA")
    rgba.putalpha(mask)
    crop = rgba.crop(spec["crop"])
    max_width, max_height = spec["maxContent"]
    scale = min(max_width / crop.width, max_height / crop.height)
    crop = crop.resize(
        (round(crop.width * scale), round(crop.height * scale)),
        Image.Resampling.LANCZOS,
    )

    canvas = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), (0, 0, 0, 0))
    x = (MASTER_SIZE - crop.width) // 2
    y = (MASTER_SIZE - crop.height) // 2
    canvas.alpha_composite(crop, (x, y))
    return zero_transparent_rgb(canvas)


def build_derivatives(master: Image.Image, spec: dict[str, Any]) -> None:
    save_rgba(
        master.resize((256, 256), Image.Resampling.LANCZOS),
        spec["runtime256"],
    )
    save_rgba(
        master.resize((128, 128), Image.Resampling.LANCZOS),
        spec["runtime128"],
    )


def paper_canvas(size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGB", size, (246, 240, 223))
    draw = ImageDraw.Draw(image, "RGBA")
    for y in range(2, size[1], 6):
        for x in range(2 + (y % 12) // 2, size[0], 6):
            draw.ellipse((x, y, x + 1, y + 1), fill=(105, 96, 72, 12))
    return image


def loading_geometry(viewport: tuple[int, int]) -> dict[str, Any]:
    width, height = viewport
    content_height = 300
    content_top = round((height - content_height) / 2)
    slot_top = content_top + 68
    return {
        "viewport": {"width": width, "height": height},
        "contentFrame": {
            "x": 26,
            "y": content_top,
            "width": width - 52,
            "height": content_height,
        },
        "artSlot": {
            "x": round((width - ART_SLOT) / 2),
            "y": slot_top,
            "width": ART_SLOT,
            "height": ART_SLOT,
        },
        "artCanvas": {
            "x": round((width - LOADING_DISPLAY) / 2),
            "y": slot_top + round((ART_SLOT - LOADING_DISPLAY) / 2),
            "width": LOADING_DISPLAY,
            "height": LOADING_DISPLAY,
        },
        "statusCopySafeZone": {
            "x": 26,
            "y": slot_top + ART_SLOT + 12,
            "width": width - 52,
            "height": 48,
        },
    }


def draw_loading_review(
    candidate_id: str,
    master: Image.Image,
    viewport: tuple[int, int],
) -> Path:
    width, height = viewport
    geometry = loading_geometry(viewport)
    image = paper_canvas(viewport).convert("RGBA")
    draw = ImageDraw.Draw(image)
    content_top = geometry["contentFrame"]["y"]

    draw_centered(
        draw,
        "BraveCat",
        width / 2,
        content_top,
        typeface=font(11, sans=True),
        fill=(124, 125, 109),
    )
    draw_centered(
        draw,
        "咪游记",
        width / 2,
        content_top + 20,
        typeface=font(29),
        fill=(79, 81, 68),
    )

    art = master.resize(
        (LOADING_DISPLAY, LOADING_DISPLAY),
        Image.Resampling.LANCZOS,
    )
    art_canvas = geometry["artCanvas"]
    image.alpha_composite(art, (art_canvas["x"], art_canvas["y"]))
    status = geometry["statusCopySafeZone"]
    draw_centered(
        draw,
        "正在把家里的东西摆回原位……",
        width / 2,
        status["y"] + 11,
        typeface=font(13),
        fill=(124, 125, 109),
    )

    path = LOADING_REVIEWS / (
        f"loading-review--{candidate_id}--{width}x{height}"
        "--non-shipping-v01.png"
    )
    save_rgb(image, path)
    return path


def wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    typeface: ImageFont.FreeTypeFont,
    max_width: int,
) -> list[str]:
    lines: list[str] = []
    current = ""
    for character in text:
        trial = current + character
        bounds = draw.textbbox((0, 0), trial, font=typeface)
        if current and bounds[2] - bounds[0] > max_width:
            lines.append(current)
            current = character
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def draw_reuse_review(candidate_id: str, master: Image.Image) -> Path:
    width, height = 390, 844
    image = paper_canvas((width, height)).convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.text((22, 18), "BraveCat", font=font(10, sans=True), fill=(124, 125, 109))
    draw.text((22, 34), "咪游记", font=font(23), fill=(79, 81, 68))
    draw.rounded_rectangle(
        (18, 92, width - 18, 440),
        radius=28,
        fill=(224, 222, 205, 255),
        outline=(117, 113, 93, 35),
    )
    draw.ellipse((124, 180, 266, 322), fill=(190, 201, 169, 115))
    draw.rectangle((0, 0, width, height), fill=(48, 49, 40, 86))

    drawer_top = 252
    draw.rounded_rectangle(
        (0, drawer_top, width, height + 30),
        radius=28,
        fill=(247, 240, 223, 255),
        outline=(79, 78, 64, 86),
        width=1,
    )
    draw.rounded_rectangle(
        (173, drawer_top + 10, 217, drawer_top + 14),
        radius=3,
        fill=(83, 84, 70, 64),
    )
    draw.text(
        (24, drawer_top + 42),
        "寄回家的风景",
        font=font(10),
        fill=(124, 125, 109),
    )
    draw.text(
        (24, drawer_top + 58),
        "相册",
        font=font(25),
        fill=(79, 81, 68),
    )
    draw.ellipse(
        (328, drawer_top + 42, 366, drawer_top + 80),
        fill=(255, 252, 241, 158),
        outline=(82, 82, 68, 82),
    )
    draw.text(
        (341, drawer_top + 47),
        "×",
        font=font(18, sans=True),
        fill=(79, 81, 68),
    )
    draw.text(
        (24, drawer_top + 111),
        "已经寄到家的明信片会一直留在这里。",
        font=font(12),
        fill=(124, 125, 109),
    )
    draw.line(
        (24, drawer_top + 169, width - 24, drawer_top + 169),
        fill=(82, 82, 67, 45),
    )
    draw.text(
        (24, drawer_top + 190),
        "带走这个家",
        font=font(14),
        fill=(79, 81, 68),
    )
    draw.text(
        (24, drawer_top + 217),
        "导入时，状态文案保持为可访问的实时文字。",
        font=font(11),
        fill=(124, 125, 109),
    )

    progress = (24, drawer_top + 255, width - 24, drawer_top + 381)
    draw.rounded_rectangle(
        progress,
        radius=19,
        fill=(255, 252, 241, 174),
        outline=(90, 103, 73, 66),
    )
    art = master.resize(
        (RESTORE_DISPLAY, RESTORE_DISPLAY),
        Image.Resampling.LANCZOS,
    )
    art_x = progress[0] + (RESTORE_SLOT - RESTORE_DISPLAY) // 2
    art_y = progress[1] + (progress[3] - progress[1] - RESTORE_DISPLAY) // 2
    image.alpha_composite(art, (art_x, art_y))
    copy_font = font(13)
    lines = wrap_text(
        draw,
        "正在把存档里的家摆回原位……",
        copy_font,
        188,
    )
    line_y = progress[1] + 38
    for line in lines:
        draw.text(
            (progress[0] + RESTORE_SLOT + 12, line_y),
            line,
            font=copy_font,
            fill=(105, 119, 92),
        )
        line_y += 24

    action_top = drawer_top + 406
    for left, right, label in (
        (24, 187, "导出存档"),
        (196, 366, "导入存档"),
    ):
        draw.rounded_rectangle(
            (left, action_top, right, action_top + 40),
            radius=20,
            fill=(228, 234, 216, 209),
            outline=(90, 103, 73, 86),
        )
        draw_centered(
            draw,
            label,
            (left + right) / 2,
            action_top + 11,
            typeface=font(11),
            fill=(79, 81, 68),
        )

    path = REUSE_REVIEWS / (
        f"reuse-review--{candidate_id}--import-restore--390x844"
        "--non-shipping-v01.png"
    )
    save_rgb(image, path)
    return path


def checker(size: tuple[int, int], cell: int = 20) -> Image.Image:
    image = Image.new("RGB", size, (246, 246, 243))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle(
                    (x, y, x + cell - 1, y + cell - 1),
                    fill=(224, 226, 218),
                )
    return image


def fit(image: Image.Image, box: tuple[int, int]) -> Image.Image:
    scale = min(box[0] / image.width, box[1] / image.height)
    return image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )


def alpha_preview(
    art: Image.Image,
    size: tuple[int, int],
    background: tuple[int, int, int] | None,
) -> Image.Image:
    base = (
        checker(size).convert("RGBA")
        if background is None
        else Image.new("RGBA", size, (*background, 255))
    )
    fitted = fit(art, (size[0] - 20, size[1] - 20))
    base.alpha_composite(
        fitted,
        ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2),
    )
    return base


def make_contact_sheet(
    masters: dict[str, Image.Image],
    loading_reviews: dict[str, list[Path]],
    reuse_reviews: dict[str, Path],
) -> None:
    sheet = Image.new("RGB", (1600, 2000), (244, 238, 221))
    draw = ImageDraw.Draw(sheet)
    draw.text((60, 45), "GEN-03 · LOADING VIGNETTES", font=font(38, sans=True), fill=(78, 80, 67))
    draw.text(
        (62, 100),
        "NON-SHIPPING · TWO DISTINCT COMPOSITIONS · STOP FOR SELECTION",
        font=font(18, sans=True),
        fill=(110, 112, 96),
    )

    for column, (candidate_id, spec) in enumerate(SPECS.items()):
        left = 55 + column * 770
        top = 160
        draw.rounded_rectangle(
            (left, top, left + 720, top + 600),
            radius=26,
            fill=(250, 246, 234),
            outline=(150, 141, 118),
            width=2,
        )
        draw.text(
            (left + 30, top + 25),
            spec["shortLabel"],
            font=font(23, sans=True),
            fill=(78, 80, 67),
        )
        master_preview = alpha_preview(masters[candidate_id], (350, 320), None)
        sheet.paste(master_preview.convert("RGB"), (left + 30, top + 80))
        light = alpha_preview(masters[candidate_id], (110, 110), (250, 246, 234))
        dark = alpha_preview(masters[candidate_id], (110, 110), (78, 82, 71))
        sheet.paste(light.convert("RGB"), (left + 485, top + 95))
        sheet.paste(dark.convert("RGB"), (left + 590, top + 95))
        draw.text(
            (left + 485, top + 220),
            "ALPHA · LIGHT / DARK",
            font=font(11, sans=True),
            fill=(110, 112, 96),
        )
        x = left + 200
        for display in (96, 128, 144):
            preview = alpha_preview(
                masters[candidate_id].resize(
                    (display, display), Image.Resampling.LANCZOS
                ),
                (display, display),
                (246, 240, 223),
            )
            sheet.paste(preview.convert("RGB"), (x, top + 420))
            draw.text(
                (x + 4, top + 420 + display + 6),
                f"{display}px",
                font=font(10, sans=True),
                fill=(110, 112, 96),
            )
            x += display + 12

    draw.text((60, 810), "BOOTSTRAP / HYDRATION FIT", font=font(25, sans=True), fill=(78, 80, 67))
    draw.text(
        (60, 850),
        "Fixed 160px slot, 128px image canvas, 48px live-copy reserve at every width.",
        font=font(14, sans=True),
        fill=(110, 112, 96),
    )
    for row, candidate_id in enumerate(SPECS):
        y = 900 + row * 350
        draw.text(
            (60, y + 5),
            SPECS[candidate_id]["shortLabel"],
            font=font(16, sans=True),
            fill=(78, 80, 67),
        )
        x = 250
        for path in loading_reviews[candidate_id]:
            viewport = Image.open(path).convert("RGB")
            thumb = fit(viewport, (235, 300))
            sheet.paste(thumb, (x, y))
            draw.text(
                (x, y + thumb.height + 8),
                f"{viewport.width}×{viewport.height}",
                font=font(11, sans=True),
                fill=(110, 112, 96),
            )
            x += 270

    reuse_top = 1580
    draw.text(
        (60, reuse_top),
        "IMPORT / RESTORE REUSE",
        font=font(25, sans=True),
        fill=(78, 80, 67),
    )
    draw.text(
        (60, reuse_top + 40),
        "Same neutral art at 96px; progress copy remains live and no failure state is implied.",
        font=font(14, sans=True),
        fill=(110, 112, 96),
    )
    x = 500
    for candidate_id in SPECS:
        review = Image.open(reuse_reviews[candidate_id]).convert("RGB")
        thumb = fit(review, (245, 330))
        sheet.paste(thumb, (x, reuse_top - 10))
        draw.text(
            (x, reuse_top + 330),
            SPECS[candidate_id]["shortLabel"],
            font=font(11, sans=True),
            fill=(78, 80, 67),
        )
        x += 310
    draw.text(
        (60, 1928),
        "Selection gate: choose A, choose B, or reject both. No runtime integration is included.",
        font=font(14, sans=True),
        fill=(90, 91, 77),
    )
    save_rgb(sheet, CONTACT_SHEET)


def relative(path: Path) -> str:
    return path.relative_to(V1).as_posix()


def alpha_details(image: Image.Image) -> dict[str, Any]:
    alpha = image.convert("RGBA").getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise RuntimeError("Alpha image is empty")
    return {
        "alphaExtrema": list(alpha.getextrema()),
        "opaquePixelBounds": {
            "left": bounds[0],
            "top": bounds[1],
            "rightExclusive": bounds[2],
            "bottomExclusive": bounds[3],
        },
        "safeMarginsPx": {
            "left": bounds[0],
            "top": bounds[1],
            "right": image.width - bounds[2],
            "bottom": image.height - bounds[3],
        },
        "bottomCenterAnchor": {
            "x": round((bounds[0] + bounds[2]) / 2, 2),
            "y": bounds[3],
        },
    }


def write_placement_metadata(masters: dict[str, Image.Image]) -> dict[str, Any]:
    viewport_geometry = {
        f"{width}x{height}": loading_geometry((width, height))
        for width, height in VIEWPORTS
    }
    candidates = []
    for candidate_id, master in masters.items():
        candidates.append(
            {
                "id": candidate_id,
                "master": relative(SPECS[candidate_id]["master"]),
                **alpha_details(master),
                "loadingPlacement": {
                    "reservedSlotCssPx": {"width": ART_SLOT, "height": ART_SLOT},
                    "imageCanvasCssPx": {
                        "width": LOADING_DISPLAY,
                        "height": LOADING_DISPLAY,
                    },
                    "objectFit": "contain",
                    "alignment": "center center",
                },
                "importRestorePlacement": {
                    "reservedSlotCssPx": {
                        "width": RESTORE_SLOT,
                        "height": RESTORE_SLOT,
                    },
                    "imageCanvasCssPx": {
                        "width": RESTORE_DISPLAY,
                        "height": RESTORE_DISPLAY,
                    },
                    "objectFit": "contain",
                    "alignment": "center center",
                },
            }
        )
    metadata = {
        "schemaVersion": 1,
        "status": STATUS,
        "shippingEligible": False,
        "coordinateSystem": "pixels from top-left; right/bottom bounds are exclusive",
        "masterCanvas": {"width": 512, "height": 512},
        "displayRangeCssPx": {"minimum": 96, "maximum": 144},
        "loadingViewportGeometry": viewport_geometry,
        "layoutInvariants": {
            "states": ["bootstrap-hydrating", "slow-storage", "restore-progress"],
            "artSlotFixedAcrossStates": True,
            "artCanvasFixedAcrossStates": True,
            "statusCopySafeZoneFixedAcrossStates": True,
            "statusCopyRemainsLiveDomText": True,
            "layoutJumpPx": 0,
            "sourceArtBehindCopy": False,
        },
        "candidates": candidates,
    }
    METADATA_PATH.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return metadata


def image_details(path: Path) -> dict[str, Any]:
    image = Image.open(path)
    details: dict[str, Any] = {
        "path": relative(path),
        "format": image.format,
        "width": image.width,
        "height": image.height,
        "pixelMode": image.mode,
        "iccProfile": bool(image.info.get("icc_profile")),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }
    if image.mode == "RGBA":
        rgba = np.asarray(image, dtype=np.uint8)
        alpha = rgba[..., 3]
        transparent = alpha == 0
        details["alphaExtrema"] = [int(alpha.min()), int(alpha.max())]
        details["transparentPixelRgbZero"] = bool(
            np.all(rgba[transparent, :3] == 0)
        )
        details.update(alpha_details(image))
    return details


def write_qa_report(
    masters: dict[str, Image.Image],
    loading_reviews: dict[str, list[Path]],
    reuse_reviews: dict[str, Path],
    metadata: dict[str, Any],
) -> dict[str, Any]:
    expected: dict[str, tuple[int, int, str]] = {}
    for candidate_id, spec in SPECS.items():
        expected[relative(spec["master"])] = (512, 512, "RGBA")
        expected[relative(spec["runtime256"])] = (256, 256, "RGBA")
        expected[relative(spec["runtime128"])] = (128, 128, "RGBA")
        for viewport, path in zip(VIEWPORTS, loading_reviews[candidate_id]):
            expected[relative(path)] = (*viewport, "RGB")
        expected[relative(reuse_reviews[candidate_id])] = (390, 844, "RGB")
    expected[relative(CONTACT_SHEET)] = (1600, 2000, "RGB")

    checks = []
    for path_string, (width, height, mode) in expected.items():
        details = image_details(V1 / path_string)
        details["expected"] = {
            "width": width,
            "height": height,
            "pixelMode": mode,
        }
        details["pass"] = (
            details["width"] == width
            and details["height"] == height
            and details["pixelMode"] == mode
            and details["iccProfile"]
            and (
                mode != "RGBA"
                or (
                    details["alphaExtrema"] == [0, 255]
                    and details["transparentPixelRgbZero"]
                )
            )
        )
        checks.append(details)

    safe_margin_minimum = min(
        min(candidate["safeMarginsPx"].values())
        for candidate in metadata["candidates"]
    )
    report = {
        "schemaVersion": 1,
        "status": STATUS,
        "shippingEligible": False,
        "result": "pass" if all(item["pass"] for item in checks) else "fail",
        "machineChecks": {
            "dimensionsPixelModesProfilesAlpha": checks,
            "allExpectedDimensionsPass": all(item["pass"] for item in checks),
            "allExportsEmbedSrgbIccProfile": all(
                item["iccProfile"] for item in checks
            ),
            "allRgbaExportsUseFullRangeAlpha": all(
                item.get("alphaExtrema") == [0, 255]
                for item in checks
                if item["pixelMode"] == "RGBA"
            ),
            "allFullyTransparentPixelsHaveZeroRgb": all(
                item.get("transparentPixelRgbZero", True) for item in checks
            ),
            "masterMinimumTransparentMarginPx": safe_margin_minimum,
            "masterSafeMarginPass": safe_margin_minimum >= 56,
        },
        "layoutChecks": {
            "reviewedViewports": [
                {"width": width, "height": height}
                for width, height in VIEWPORTS
            ],
            "loadingArtSlotCssPx": ART_SLOT,
            "loadingArtCanvasCssPx": LOADING_DISPLAY,
            "liveStatusCopySafeHeightCssPx": 48,
            "layoutJumpPx": 0,
            "sameGeometryForHydrationAndSlowStorage": True,
            "sameNeutralAssetSupportsImportRestore": True,
        },
        "manualVisualChecks": {
            "performed": True,
            "textFreeSourceArt": True,
            "noPseudoTextEmojiUiSpinnerOrWatermark": True,
            "noDetachedEffects": True,
            "noCheckerResidueInCandidateExports": True,
            "doesNotImplyError": True,
            "lowDetailLowSaturation": True,
            "physicallyCoherent": {
                "letter-tray": (
                    "closed envelope is tied and fully supported by one shallow tray"
                ),
                "house-box": (
                    "closed aligned roof lid is supported by one box on one folded cloth"
                ),
            },
            "approvedMinhoCueIsRestrained": {
                candidate_id: spec["cue"]
                for candidate_id, spec in SPECS.items()
            },
            "readabilityProofCssPx": [96, 128, 144],
            "candidateDistinctness": (
                "A is letter-led and horizontal; B is house-led and roof-shaped."
            ),
        },
        "sourceRecovery": {
            "generatedSourceCount": 2,
            "generatedSourcesWereOpaqueCheckerPreviews": True,
            "recoveryMethod": (
                "hand-authored connected silhouette masks, exterior-connected "
                "neutral-checker flood cleanup, two-source-pixel edge inset, "
                "deterministic fit, and zero-RGB alpha cleanup"
            ),
            "rawGeneratedSourcesAreAuditOnly": True,
        },
    }
    QA_PATH.parent.mkdir(parents=True, exist_ok=True)
    QA_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if report["result"] != "pass" or not report["machineChecks"]["masterSafeMarginPass"]:
        raise RuntimeError("GEN-03 QA failed")
    return report


def write_readme() -> None:
    text = f"""# GEN-03 bootstrap/system loading vignette v1

**Status:** {STATUS}  
**Scope:** AA-006 only. No app code, Minho file, production asset, or other candidate directory is modified.

This pack offers two small, text-free watercolor loading compositions for “putting the Home back in place.” Both are calm neutral keepsakes rather than success, warning, or failure art.

## Selection candidates

- **A — closed letter tray:** a tied closed envelope with a roof-like flap, fully supported by one shallow wooden tray. The only Minho cue is two muted tabby bands on the cord end.
- **B — closed house keepsake:** a closed house-shaped box with its sage roof lid aligned, fully supported by one folded cloth. The only Minho cue is two muted tabby bands inset into the latch.

Both remain viable and intentionally distinct: A is letter-led and horizontal; B is Home-led and roof-shaped. Choose one, reject both, or request a narrow revision. Do not integrate yet.

## Deliverables

- `masters/`: two 512×512 straight-alpha RGBA masters.
- `runtime/`: exact 256×256 and 128×128 RGBA derivatives for each master.
- `reviews/loading/`: 320×568, 390×844, and 430×932 hydration reviews for each candidate using the current live status copy.
- `reviews/reuse/`: 390×844 import/restore progress reuse proof for each candidate.
- `reviews/contact-sheet--gen03-loading-vignettes--1600x2000--non-shipping-v01.png`: alpha, 96/128/144 px, viewport, and reuse comparison.
- `placement-metadata.v1.json`: fixed art slot, live-copy safe zone, anchors, bounds, margins, and zero-layout-jump contract.
- `qa/qa-report.v1.json`: dimensions, mode, alpha, transparent RGB, sRGB profile, safe-margin, visual, and layout checks.
- `manifest.v1.json` and `hashes.sha256`: provenance and integrity.
- `sources/`: the two actual Cursor GenerateImage outputs retained as audit-only opaque generated-source records.

## Layout contract

Bootstrap/hydration reserves a fixed 160×160 CSS px art slot and renders the 512 source in a fixed 128×128 canvas. The live status copy has a separate 48 px-high safe zone. Hydration, slower storage, and restore-progress copy changes reuse the same geometry, so the recorded layout jump is 0 px. Import/restore reuse uses a fixed 112 px slot with a 96 px image canvas.

The import/restore image is a reuse proof only. The current app resolves import directly to live success/error copy; adding an in-progress state is a later integration decision.

## Generation and QA note

Actual image generation used locked style-intensity B references plus approved Minho sit only as a restrained color/pattern reference; no new Minho art was generated. The generator returned opaque checker previews. The build script converts only the connected keepsake silhouettes to straight RGBA, removes exterior-connected neutral checker pixels, applies a two-source-pixel edge inset, embeds sRGB ICC profiles, zeros RGB in fully transparent pixels, and creates deterministic derivatives/reviews.

Run the build with Python, Pillow, and NumPy:

`python3 scripts/build_v1.py`

Stop here for human selection. No commit or runtime integration is included.
"""
    README_PATH.write_text(text, encoding="utf-8")


def classify(path: Path) -> str:
    rel = relative(path)
    if rel.startswith("sources/"):
        return "generated-source-audit"
    if rel.startswith("masters/"):
        return "candidate-master"
    if rel.startswith("runtime/"):
        return "candidate-derivative"
    if rel.startswith("reviews/"):
        return "review"
    if rel.startswith("qa/") or path.suffix == ".json":
        return "metadata"
    if rel.startswith("scripts/"):
        return "build-script"
    return "documentation"


def write_manifest() -> None:
    excluded = {MANIFEST_PATH, HASHES_PATH}
    files = sorted(
        path
        for path in V1.rglob("*")
        if path.is_file() and path not in excluded and path.name != ".DS_Store"
    )
    entries = []
    for path in files:
        entry: dict[str, Any] = {
            "path": relative(path),
            "kind": classify(path),
            "status": STATUS,
            "shippingEligible": False,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
        if path.suffix.lower() == ".png":
            image = Image.open(path)
            entry.update(
                {
                    "format": "PNG",
                    "width": image.width,
                    "height": image.height,
                    "pixelMode": image.mode,
                    "iccProfile": bool(image.info.get("icc_profile")),
                }
            )
            if image.mode == "RGBA":
                rgba = np.asarray(image, dtype=np.uint8)
                entry["alphaExtrema"] = [
                    int(rgba[..., 3].min()),
                    int(rgba[..., 3].max()),
                ]
        entries.append(entry)

    manifest = {
        "schemaVersion": 1,
        "packId": "system-states-v1-gen03",
        "auditBatch": "GEN-03",
        "assetNeedIds": ["AA-006"],
        "status": STATUS,
        "shippingEligible": False,
        "branch": "art/home-screen-v1",
        "root": "docs/art/candidates/system-states/v1",
        "createdAt": CREATED_AT,
        "selectionStatus": "pending-human-selection",
        "candidateIds": list(SPECS),
        "generation": {
            "tool": "Cursor GenerateImage",
            "model": "not-reported",
            "actualGeneratedSourceCount": 2,
            "sourceOriginalSha256": {
                candidate_id: spec["sourceOriginalSha256"]
                for candidate_id, spec in SPECS.items()
            },
            "styleIntensity": "B (locked)",
            "styleReferences": list(STYLE_REFERENCES),
            "identityReferences": list(MINHO_REFERENCES),
            "identityUse": (
                "approved Minho color and restrained tabby-band cue only; "
                "no Minho file altered and no new Portrait generated"
            ),
            "sharedPromptConstraints": [
                "isolated centered connected keepsake",
                "restrained low-saturation watercolor",
                "thin warm gray-brown definition",
                "warm paper grain",
                "readable at 96-144 CSS px",
                "no text or pseudo-text",
                "no emoji, UI, spinner, progress ring, or watermark",
                "no detached effects",
                "no error implication",
            ],
            "candidatePromptIntents": {
                "letter-tray": (
                    "closed cream envelope with roof-like flap, tied cord, "
                    "sage button, shallow pale-wood tray"
                ),
                "house-box": (
                    "closed cream house-shaped box, aligned sage roof lid, "
                    "tabby-band latch, folded warm-white cloth"
                ),
            },
        },
        "runtimeEvidence": {
            "bootstrapLoading": {
                "file": "src/App.svelte",
                "lines": "455-460",
                "selector": ".adoption-shell.loading",
                "currentState": "text-only",
                "liveCopy": "正在把家里的东西摆回原位……",
            },
            "hydrationAndLoadFailure": {
                "file": "src/App.svelte",
                "lines": "363-389",
                "currentState": (
                    "IndexedDB load hydrates the Home; failure sets a live "
                    "neutral persistence notice after leaving loading"
                ),
            },
            "saveFailure": {
                "file": "src/App.svelte",
                "lines": "192-200",
                "currentState": "live persistence notice; no error art required",
            },
            "importRestore": {
                "file": "src/App.svelte",
                "lines": "302-323",
                "currentState": (
                    "import resolves directly to live success/error copy; "
                    "the review in this pack proves neutral in-progress reuse only"
                ),
            },
            "loadingLayout": {
                "file": "src/app.css",
                "lines": "60-77",
                "currentState": "centered 320-470px paper shell",
            },
        },
        "exports": {
            candidate_id: {
                "master": relative(spec["master"]),
                "runtime256": relative(spec["runtime256"]),
                "runtime128": relative(spec["runtime128"]),
                "loadingReviews": [
                    (
                        f"reviews/loading/loading-review--{candidate_id}--"
                        f"{width}x{height}--non-shipping-v01.png"
                    )
                    for width, height in VIEWPORTS
                ],
                "reuseReview": (
                    f"reviews/reuse/reuse-review--{candidate_id}--"
                    "import-restore--390x844--non-shipping-v01.png"
                ),
            }
            for candidate_id, spec in SPECS.items()
        },
        "scopeGuard": {
            "appCodeModified": False,
            "approvedMinhoModified": False,
            "productionAssetsModified": False,
            "otherCandidateDirectoriesModified": False,
            "integrationPerformed": False,
            "commitCreated": False,
        },
        "selfExcludedFromFileHashes": True,
        "hashLedger": "hashes.sha256 includes this manifest and excludes itself",
        "fileCountExcludingManifestAndHashLedger": len(entries),
        "files": entries,
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def write_hashes() -> None:
    files = sorted(
        path
        for path in V1.rglob("*")
        if path.is_file() and path != HASHES_PATH and path.name != ".DS_Store"
    )
    HASHES_PATH.write_text(
        "".join(f"{sha256(path)}  {relative(path)}\n" for path in files),
        encoding="utf-8",
    )


def main() -> None:
    masters: dict[str, Image.Image] = {}
    loading_reviews: dict[str, list[Path]] = {}
    reuse_reviews: dict[str, Path] = {}

    for candidate_id, spec in SPECS.items():
        source = package_generated_source(spec)
        master = build_master(source, spec)
        save_rgba(master, spec["master"])
        build_derivatives(master, spec)
        masters[candidate_id] = master
        loading_reviews[candidate_id] = [
            draw_loading_review(candidate_id, master, viewport)
            for viewport in VIEWPORTS
        ]
        reuse_reviews[candidate_id] = draw_reuse_review(candidate_id, master)

    make_contact_sheet(masters, loading_reviews, reuse_reviews)
    metadata = write_placement_metadata(masters)
    write_qa_report(masters, loading_reviews, reuse_reviews, metadata)
    write_readme()
    write_manifest()
    write_hashes()

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    qa = json.loads(QA_PATH.read_text(encoding="utf-8"))
    assert manifest["auditBatch"] == "GEN-03"
    assert len(manifest["candidateIds"]) == 2
    assert qa["result"] == "pass"
    assert len(HASHES_PATH.read_text(encoding="utf-8").splitlines()) >= 20
    print("GEN-03 build complete: two candidates, QA pass, selection pending.")


if __name__ == "__main__":
    main()
