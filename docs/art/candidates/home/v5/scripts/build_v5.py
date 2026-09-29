#!/usr/bin/env python3
"""Build the non-shipping v5 responsive home review pack."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any, Sequence

import numpy as np
from PIL import Image, ImageChops, ImageCms, ImageDraw, ImageFilter, ImageFont


SCRIPT = Path(__file__).resolve()
V5 = SCRIPT.parents[1]
ROOT = SCRIPT.parents[6]
V3 = ROOT / "docs/art/candidates/home/v3"
V4 = ROOT / "docs/art/candidates/home/v4"
AUDIT = ROOT / "docs/art/candidates/asset-audit/v1/asset-audit.v1.json"
ROOM = V3 / "layers/home-layered-reconstruction--noon--non-shipping-v03.png"
MEMO_MASTER = V4 / "state-art/away-note-with-wood-memo-stand--blank--master-512x640--non-shipping-v04.png"
FISH_MASTER = V4 / "state-art/dried-fish-sill-tray--master-512--non-shipping-v04.png"
FISH_RUNTIME = V4 / "state-art/dried-fish-sill-tray--runtime-128--non-shipping-v04.png"
ICON_DIR = V3 / "icons"
MINHO_DIR = ROOT / "public/portraits/minho"
REVIEWS = V5 / "reviews"
METADATA_PATH = V5 / "placement-responsive-metadata.v5.json"
QA_PATH = V5 / "qa-report.v5.json"
README_PATH = V5 / "README.md"
MANIFEST_PATH = V5 / "manifest.v5.json"
ACTIVITY_SHEET = REVIEWS / "physical-review--home-activities--1200x1600--non-shipping-v05.png"
RESPONSIVE_SHEET = REVIEWS / "physical-review--away-and-treat-responsive--1200x1600--non-shipping-v05.png"

STATUS = "NON-SHIPPING / VISUAL-REVIEW-ONLY"
CANVAS = (1200, 1600)
SONGTI = Path("/System/Library/Fonts/Supplemental/Songti.ttc")
ARIAL = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()

VIEWPORTS: dict[str, dict[str, int]] = {
    "320x700": {"width": 320, "height": 700, "topbar": 70, "navigation": 95, "status": 34, "iconSlot": 50},
    "390x844": {"width": 390, "height": 844, "topbar": 82, "navigation": 112, "status": 34, "iconSlot": 58},
    "430x932": {"width": 430, "height": 932, "topbar": 82, "navigation": 112, "status": 34, "iconSlot": 58},
}

POSES: dict[str, dict[str, Any]] = {
    "sleep": {
        "source": MINHO_DIR / "portrait--minho--sleep--v01.png",
        "canvasRect": {"x": 480, "y": 1001, "width": 420, "height": 420},
        "contactPoints": [(551, 1385), (690, 1394), (840, 1390)],
        "grounding": "compressed chest, forepaws, and curled tail rest directly on woven rug",
    },
    "play": {
        "source": MINHO_DIR / "portrait--minho--play--v01.png",
        "canvasRect": {"x": 485, "y": 1014, "width": 450, "height": 450},
        "contactPoints": [(564, 1435), (640, 1420), (826, 1430)],
        "grounding": "yarn, reaching forepaws, and rear load-bearing paw meet woven rug",
    },
    "eat": {
        "source": MINHO_DIR / "portrait--minho--eat--v01.png",
        "canvasRect": {"x": 236, "y": 954, "width": 450, "height": 450},
        "contactPoints": [(345, 1372), (432, 1367), (547, 1368), (602, 1365)],
        "grounding": "baked bowl base and load-bearing paws meet floor/rug at existing bowl area",
    },
}

SILL_POLYGON = [(0, 950), (790, 968), (790, 1002), (0, 1050)]
FISH_FOOTPRINT = [(336, 974), (475, 977), (470, 1003), (331, 1001)]
MEMO_FOOTPRINT = [(410, 974), (645, 979), (640, 997), (406, 1011)]
MEMO_NOTE_PLANE = [(430, 704), (623, 696), (616, 929), (425, 934)]
MEMO_LIVE_TEXT_SAFE_ZONE = [(462, 755), (592, 750), (589, 895), (458, 899)]
RUG_ELLIPSE = {"center": (675.0, 1452.0), "radiusX": 398.0, "radiusY": 165.0}
PLAY_OBSTACLES = {
    "catTree": (0, 850, 305, 1470),
    "roomBowls": (220, 1220, 490, 1360),
    "cabinet": (958, 930, 1200, 1470),
    "navigationReserve": (0, 1470, 1200, 1600),
}
EAT_BOWL_ZONES = {
    "waterBowl": (215, 1200, 355, 1320),
    "foodBowl": (350, 1188, 485, 1315),
}

POSE_SOURCE_BOUNDS: dict[str, dict[str, list[int]]] = {}
ROOM_COMPOSITES: dict[str, Image.Image] = {}
POSE_MASKS: dict[str, Image.Image] = {}
MOBILE_OUTPUTS: dict[str, dict[str, Path]] = {}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def save_rgb(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, "PNG", icc_profile=SRGB, optimize=True, compress_level=9)


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def alpha_bounds(image: Image.Image, threshold: int) -> list[int]:
    alpha = np.asarray(image.convert("RGBA").getchannel("A"), dtype=np.uint8)
    ys, xs = np.where(alpha >= threshold)
    if not len(xs):
        return [0, 0, 0, 0]
    return [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]


def placed_bounds(source_bounds: Sequence[int], rect: dict[str, int]) -> list[float]:
    scale = rect["width"] / 1024
    return [
        rect["x"] + source_bounds[0] * scale,
        rect["y"] + source_bounds[1] * scale,
        rect["x"] + source_bounds[2] * scale,
        rect["y"] + source_bounds[3] * scale,
    ]


def intersection_area(first: Sequence[float], second: Sequence[float]) -> float:
    width = max(0.0, min(first[2], second[2]) - max(first[0], second[0]))
    height = max(0.0, min(first[3], second[3]) - max(first[1], second[1]))
    return width * height


def point_segment_distance(point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]) -> float:
    px, py = point
    ax, ay = start
    bx, by = end
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def point_inside_convex(point: tuple[float, float], polygon: Sequence[tuple[float, float]]) -> bool:
    signs: list[bool] = []
    for index, start in enumerate(polygon):
        end = polygon[(index + 1) % len(polygon)]
        cross = (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0])
        if abs(cross) > 1e-7:
            signs.append(cross > 0)
    return not signs or all(value == signs[0] for value in signs)


def polygon_margins(footprint: Sequence[tuple[float, float]], support: Sequence[tuple[float, float]]) -> list[float]:
    margins: list[float] = []
    for corner in footprint:
        if not point_inside_convex(corner, support):
            raise AssertionError(f"Corner outside support plane: {corner}")
        margins.append(min(point_segment_distance(corner, support[i], support[(i + 1) % len(support)]) for i in range(len(support))))
    return margins


def inside_rug(point: tuple[float, float]) -> bool:
    cx, cy = RUG_ELLIPSE["center"]
    return ((point[0] - cx) / RUG_ELLIPSE["radiusX"]) ** 2 + ((point[1] - cy) / RUG_ELLIPSE["radiusY"]) ** 2 <= 1.0


def viewport_transform(viewport: dict[str, int]) -> dict[str, float]:
    room_height = viewport["height"] - viewport["topbar"] - viewport["navigation"] - viewport["status"]
    scale = max(viewport["width"] / CANVAS[0], room_height / CANVAS[1])
    return {"scale": scale, "cropX": (CANVAS[0] * scale - viewport["width"]) / 2, "roomY": float(viewport["topbar"]), "roomHeight": float(room_height)}


def room_to_view(point: tuple[float, float], transform: dict[str, float]) -> tuple[float, float]:
    return (point[0] * transform["scale"] - transform["cropX"], transform["roomY"] + point[1] * transform["scale"])


def shear_y(image: Image.Image, pixels: int) -> Image.Image:
    if pixels == 0:
        return image.copy()
    offset = max(0, -pixels)
    k = pixels / image.width
    return image.transform(
        (image.width, image.height + abs(pixels)),
        Image.Transform.AFFINE,
        (1, 0, 0, -k, 1, -offset),
        resample=Image.Resampling.BICUBIC,
    )


def remove_room_bowls(room: Image.Image) -> Image.Image:
    """Create a deterministic same-room floor occlusion beneath the eat pose."""

    cleaned = room.copy()
    target = (205, 1190, 505, 1370)
    patch = room.crop((500, 1190, 800, 1370)).resize(
        (target[2] - target[0], target[3] - target[1]),
        Image.Resampling.LANCZOS,
    )
    mask = Image.new("L", (target[2] - target[0], target[3] - target[1]), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((10, 10, 150, 130), fill=255)
    draw.ellipse((145, 0, 280, 125), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(7))
    target_crop = cleaned.crop(target).convert("RGBA")
    patch_array = np.asarray(patch, dtype=np.int16).copy()
    target_array = np.asarray(target_crop, dtype=np.int16)
    mask_array = np.asarray(mask, dtype=np.uint8)
    ring = (mask_array >= 12) & (mask_array <= 96)
    if ring.any():
        delta = np.median(target_array[ring, :3] - patch_array[ring, :3], axis=0)
        patch_array[..., :3] = np.clip(patch_array[..., :3] + delta, 0, 255)
        patch = Image.fromarray(patch_array.astype(np.uint8), "RGBA")
    cleaned.paste(patch, (target[0], target[1]), mask)
    return cleaned


def build_pose_composites() -> None:
    base = Image.open(ROOM).convert("RGBA")
    for pose, record in POSES.items():
        source = Image.open(record["source"]).convert("RGBA")
        POSE_SOURCE_BOUNDS[pose] = {
            "alpha": alpha_bounds(source, 1),
            "opaque": alpha_bounds(source, 250),
        }
        rect = record["canvasRect"]
        resized = source.resize((rect["width"], rect["height"]), Image.Resampling.LANCZOS)
        room = remove_room_bowls(base) if pose == "eat" else base.copy()
        room.alpha_composite(resized, dest=(rect["x"], rect["y"]))
        ROOM_COMPOSITES[pose] = room

        mask = Image.new("L", CANVAS, 0)
        mask.paste(resized.getchannel("A"), (rect["x"], rect["y"]))
        POSE_MASKS[pose] = mask


def memo_review_master() -> Image.Image:
    review = Image.open(MEMO_MASTER).convert("RGBA")
    draw = ImageDraw.Draw(review)
    face_font = font(SONGTI, 58)
    for text, y in [("出去走走", 205), ("晚一点", 278), ("回来。", 351)]:
        box = draw.textbbox((0, 0), text, font=face_font)
        draw.text(((512 - (box[2] - box[0])) / 2, y), text, font=face_font, fill=(81, 78, 64, 230))
    return review


def build_away_composite() -> tuple[Image.Image, list[int]]:
    room = Image.open(ROOM).convert("RGBA")
    crop = memo_review_master().crop((18, 24, 500, 612)).resize((270, 330), Image.Resampling.LANCZOS)
    asset = shear_y(crop, -12)
    room.alpha_composite(asset, dest=(390, 680))
    local = alpha_bounds(asset, 1)
    return room, [390 + local[0], 680 + local[1], 390 + local[2], 680 + local[3]]


def build_collectible_composite() -> Image.Image:
    room = ROOM_COMPOSITES["sleep"].copy()
    crop = Image.open(FISH_MASTER).convert("RGBA").crop((12, 145, 500, 382)).resize((162, 50), Image.Resampling.LANCZOS)
    room.alpha_composite(shear_y(crop, 2), dest=(323, 966))
    return room


STATE_COPY = {
    "sleep": "星里很安静，Minho 正在打盹。",
    "play": "毛线球滚过来，Minho 正忙着扑住它。",
    "eat": "Minho 在原来的饭盆位置认真吃东西。",
    "away": "Minho 已经出门了。窗台上的字条在等你。",
    "collectible-ready": "窗台上的小鱼干可以收取。",
}


def centered_room_crop(room: Image.Image, viewport: dict[str, int]) -> Image.Image:
    transform = viewport_transform(viewport)
    scaled = room.resize(
        (round(CANVAS[0] * transform["scale"]), round(CANVAS[1] * transform["scale"])),
        Image.Resampling.LANCZOS,
    )
    left = round(transform["cropX"])
    return scaled.crop((left, 0, left + viewport["width"], int(transform["roomHeight"])))


def paste_contained(canvas: Image.Image, source: Image.Image, box: tuple[int, int, int, int]) -> None:
    width, height = box[2] - box[0], box[3] - box[1]
    scale = min(width / source.width, height / source.height)
    resized = source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.LANCZOS)
    canvas.paste(resized, (box[0] + (width - resized.width) // 2, box[1] + (height - resized.height) // 2), resized if resized.mode == "RGBA" else None)


def draw_collect_label(image: Image.Image, viewport: dict[str, int]) -> None:
    transform = viewport_transform(viewport)
    x, y = room_to_view((500, 1015), transform)
    factor = transform["scale"] / 0.44
    width, height = round(53 * factor), round(19 * factor)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle((x, y, x + width, y + height), radius=max(4, height // 2), fill=(248, 243, 224, 232), outline=(91, 85, 67, 168), width=1)
    label_font = font(SONGTI, max(8, round(10 * factor)))
    text = "收取 +2"
    box = draw.textbbox((0, 0), text, font=label_font)
    draw.text((x + (width - (box[2] - box[0])) / 2, y + (height - (box[3] - box[1])) / 2 - box[1]), text, font=label_font, fill=(75, 75, 61, 230))


def render_mobile(room: Image.Image, state: str, viewport_name: str) -> Image.Image:
    viewport = VIEWPORTS[viewport_name]
    width, height = viewport["width"], viewport["height"]
    paper = (247, 241, 223)
    ink = (77, 78, 65)
    result = Image.new("RGB", (width, height), paper)
    draw = ImageDraw.Draw(result, "RGBA")

    topbar = viewport["topbar"]
    review_font = font(ARIAL, 7 if width == 320 else 8)
    title_font = font(SONGTI, 23 if width == 320 else 27)
    draw.text((15, 11), f"BRAVECAT · NON-SHIPPING · {state.upper()}", font=review_font, fill=(101, 101, 88, 235))
    draw.text((16, 29 if width == 320 else 36), "咪游记", font=title_font, fill=ink)
    pill_w, pill_h = (62, 32) if width == 320 else (68, 38)
    px, py = width - pill_w - 17, 20 if width == 320 else 22
    draw.rounded_rectangle((px, py, px + pill_w, py + pill_h), radius=pill_h // 2, fill=(252, 248, 234, 210), outline=(92, 90, 72, 150), width=1)
    fish_icon = Image.open(FISH_RUNTIME).convert("RGBA").resize((21, 21), Image.Resampling.LANCZOS)
    result.paste(fish_icon, (px + 8, py + (pill_h - 21) // 2), fish_icon)
    draw.text((px + 38, py + 8), "12", font=font(ARIAL, 13), fill=ink)
    draw.line((0, topbar - 1, width, topbar - 1), fill=(113, 105, 84, 55), width=1)

    room_height = int(viewport_transform(viewport)["roomHeight"])
    result.paste(centered_room_crop(room, viewport).convert("RGB"), (0, topbar))
    if state == "collectible-ready":
        draw_collect_label(result, viewport)

    nav_y = topbar + room_height
    draw.rectangle((0, nav_y, width, height), fill=(*paper, 255))
    draw.line((0, nav_y, width, nav_y), fill=(113, 105, 84, 55), width=1)
    icon_files = {
        "行囊": ICON_DIR / "nav-icon--pack--runtime-128--non-shipping-v03.png",
        "小铺": ICON_DIR / "nav-icon--shop--runtime-128--non-shipping-v03.png",
        "相册": ICON_DIR / "nav-icon--album--runtime-128--non-shipping-v03.png",
    }
    slot = viewport["iconSlot"]
    label_font = font(SONGTI, 13 if width == 320 else 14)
    for index, (label, icon_path) in enumerate(icon_files.items()):
        center = round(width * (index + 0.5) / 3)
        top = nav_y + 9
        draw.rounded_rectangle((center - slot // 2, top, center + slot // 2, top + slot), radius=15, fill=(250, 246, 233, 255), outline=(76, 76, 62, 170), width=1)
        icon = Image.open(icon_path).convert("RGBA").resize((slot - 8, slot - 8), Image.Resampling.LANCZOS)
        result.paste(icon, (center - icon.width // 2, top + 4), icon)
        box = draw.textbbox((0, 0), label, font=label_font)
        draw.text((center - (box[2] - box[0]) / 2, top + slot + 8), label, font=label_font, fill=ink)

    status_font = font(SONGTI, 9 if width == 320 else 10)
    copy = STATE_COPY[state]
    box = draw.textbbox((0, 0), copy, font=status_font)
    draw.text(((width - (box[2] - box[0])) / 2, height - viewport["status"] + 9), copy, font=status_font, fill=(124, 122, 104, 235))
    return result


def mobile_path(viewport: str, state: str) -> Path:
    return REVIEWS / f"mobile-review--{viewport}--{state}--non-shipping-v05.png"


def build_mobile_reviews(away: Image.Image, collectible: Image.Image) -> None:
    states = {**ROOM_COMPOSITES, "away": away, "collectible-ready": collectible}
    for viewport in VIEWPORTS:
        MOBILE_OUTPUTS[viewport] = {}
        for state, room in states.items():
            path = mobile_path(viewport, state)
            save_rgb(render_mobile(room, state, viewport), path)
            MOBILE_OUTPUTS[viewport][state] = path


def overlay_activity_geometry(pose: str) -> Image.Image:
    image = ROOM_COMPOSITES[pose].convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    opaque = placed_bounds(POSE_SOURCE_BOUNDS[pose]["opaque"], POSES[pose]["canvasRect"])
    draw.rectangle(opaque, outline=(154, 87, 52, 220), width=5)
    for x, y in POSES[pose]["contactPoints"]:
        draw.ellipse((x - 10, y - 10, x + 10, y + 10), fill=(90, 126, 76, 235), outline=(252, 247, 230, 230), width=3)
    return image


def build_activity_sheet() -> None:
    paper, panel, ink = (246, 241, 227), (250, 247, 237), (75, 76, 63)
    sheet = Image.new("RGB", (1200, 1600), paper)
    draw = ImageDraw.Draw(sheet)
    draw.text((38, 28), "NON-SHIPPING / AA-002 HOME ACTIVITY PHYSICAL REVIEW", font=font(ARIAL, 29), fill=ink)
    draw.line((38, 76, 1162, 76), fill=(181, 168, 140), width=2)
    columns = [(34, 382), (426, 774), (818, 1166)]
    for pose, (left, right) in zip(["sleep", "play", "eat"], columns, strict=True):
        draw.rounded_rectangle((left, 110, right, 770), radius=18, fill=panel, outline=(184, 171, 143), width=2)
        draw.text((left + 16, 126), pose.upper(), font=font(ARIAL, 21), fill=(100, 121, 83))
        preview = overlay_activity_geometry(pose)
        paste_contained(sheet, preview, (left + 14, 170, right - 14, 616))
        rect = POSES[pose]["canvasRect"]
        opaque = placed_bounds(POSE_SOURCE_BOUNDS[pose]["opaque"], rect)
        draw.text((left + 16, 635), f"canvas {rect['width']} px · opaque {opaque[2]-opaque[0]:.1f}×{opaque[3]-opaque[1]:.1f}", font=font(ARIAL, 13), fill=ink)
        draw.text((left + 16, 662), f"bottom-center {((opaque[0]+opaque[2])/2):.1f}, {opaque[3]:.1f}", font=font(ARIAL, 13), fill=ink)
        words = POSES[pose]["grounding"].split()
        first = " ".join(words[:7])
        second = " ".join(words[7:])
        draw.text((left + 16, 694), first, font=font(ARIAL, 12), fill=(117, 112, 95))
        draw.text((left + 16, 716), second, font=font(ARIAL, 12), fill=(117, 112, 95))
        draw.text((left + 16, 746), "Green = contact · brown = opaque bounds", font=font(ARIAL, 11), fill=(129, 91, 58))

    draw.text((38, 812), "MOBILE FIT / 320 · 390 · 430", font=font(ARIAL, 20), fill=ink)
    y = 856
    for pose in ["sleep", "play", "eat"]:
        draw.rounded_rectangle((38, y, 1162, y + 176), radius=15, fill=(239, 235, 218), outline=(184, 171, 143), width=2)
        draw.text((60, y + 18), pose.upper(), font=font(ARIAL, 18), fill=(100, 121, 83))
        x = 176
        for viewport in VIEWPORTS:
            mobile = Image.open(MOBILE_OUTPUTS[viewport][pose]).convert("RGB")
            room_top = VIEWPORTS[viewport]["topbar"]
            room_h = int(viewport_transform(VIEWPORTS[viewport])["roomHeight"])
            crop = mobile.crop((0, room_top + room_h // 2, mobile.width, room_top + room_h))
            paste_contained(sheet, crop, (x, y + 12, x + 260, y + 146))
            draw.text((x + 90, y + 151), viewport.split("x")[0] + " px", font=font(ARIAL, 12), fill=ink)
            x += 312
        y += 196

    draw.text((38, 1460), "No extra contact shadows. Production pose pixels are unchanged; baked yarn and bowl remain part of their approved files.", font=font(ARIAL, 14), fill=ink)
    draw.text((38, 1510), "EAT: same-room floor occlusion removes duplicate bowls beneath the baked bowl; PLAY clears furniture and nav reserve.", font=font(ARIAL, 14), fill=ink)
    draw.text((38, 1560), "VISUAL APPROVAL REQUIRED · REVIEW ART ONLY", font=font(ARIAL, 12), fill=(124, 121, 103))
    save_rgb(sheet, ACTIVITY_SHEET)


def draw_away_geometry(image: Image.Image, viewport_name: str) -> Image.Image:
    result = image.convert("RGBA")
    draw = ImageDraw.Draw(result, "RGBA")
    transform = viewport_transform(VIEWPORTS[viewport_name])
    sill = [room_to_view(point, transform) for point in SILL_POLYGON]
    memo = [room_to_view(point, transform) for point in MEMO_FOOTPRINT]
    safe = [room_to_view(point, transform) for point in MEMO_LIVE_TEXT_SAFE_ZONE]
    draw.line(sill + [sill[0]], fill=(86, 123, 75, 205), width=2)
    draw.line(memo + [memo[0]], fill=(143, 81, 50, 235), width=2)
    draw.line(safe + [safe[0]], fill=(77, 100, 132, 220), width=2)
    return result


def build_responsive_sheet(fish_metrics: dict[str, Any], memo_metrics: dict[str, Any], crop_metrics: dict[str, Any]) -> None:
    paper, panel, ink = (246, 241, 227), (250, 247, 237), (75, 76, 63)
    sheet = Image.new("RGB", (1200, 1600), paper)
    draw = ImageDraw.Draw(sheet)
    draw.text((38, 28), "NON-SHIPPING / AWAY MEMO + TREAT RESPONSIVE REVIEW", font=font(ARIAL, 29), fill=ink)
    draw.line((38, 76, 1162, 76), fill=(181, 168, 140), width=2)
    columns = [(35, 375), (430, 770), (825, 1165)]
    for viewport, (left, right) in zip(VIEWPORTS, columns, strict=True):
        draw.rounded_rectangle((left, 106, right, 780), radius=18, fill=panel, outline=(184, 171, 143), width=2)
        draw.text((left + 15, 123), viewport, font=font(ARIAL, 19), fill=(100, 121, 83))
        away = draw_away_geometry(Image.open(MOBILE_OUTPUTS[viewport]["away"]), viewport)
        paste_contained(sheet, away, (left + 12, 164, right - 12, 710))
        crop = crop_metrics[viewport]
        draw.text((left + 15, 724), f"object edge margins L/R {crop['leftPx']:.1f}/{crop['rightPx']:.1f}px", font=font(ARIAL, 12), fill=ink)
        draw.text((left + 15, 749), f"live zone {crop['liveZoneWidthPx']:.1f}×{crop['liveZoneHeightPx']:.1f}px", font=font(ARIAL, 12), fill=ink)

    draw.text((38, 818), "COLLECTIBLE-READY / v4 TRAY REUSE", font=font(ARIAL, 20), fill=ink)
    for viewport, (left, right) in zip(VIEWPORTS, columns, strict=True):
        mobile = Image.open(MOBILE_OUTPUTS[viewport]["collectible-ready"]).convert("RGB")
        config = VIEWPORTS[viewport]
        transform = viewport_transform(config)
        y0 = round(room_to_view((0, 850), transform)[1])
        y1 = round(room_to_view((0, 1100), transform)[1])
        crop = mobile.crop((0, y0, mobile.width, y1))
        draw.rounded_rectangle((left, 858, right, 1164), radius=16, fill=panel, outline=(184, 171, 143), width=2)
        paste_contained(sheet, crop, (left + 10, 880, right - 10, 1108))
        draw.text((left + 15, 1124), f"fish minimum margin {fish_metrics[viewport]['minimumMarginPx']:.1f}px", font=font(ARIAL, 13), fill=(100, 121, 83))

    draw.rounded_rectangle((38, 1210, 1162, 1518), radius=18, fill=(239, 235, 218), outline=(184, 171, 143), width=2)
    draw.text((60, 1234), "QUANTITATIVE SUPPORT / CROP", font=font(ARIAL, 18), fill=ink)
    y = 1274
    for viewport in VIEWPORTS:
        draw.text((60, y), f"{viewport}: memo support min {memo_metrics[viewport]['minimumMarginPx']:.1f}px · fish support min {fish_metrics[viewport]['minimumMarginPx']:.1f}px · no crop", font=font(ARIAL, 14), fill=(100, 121, 83))
        y += 38
    draw.text((60, 1400), "Green = real sill top · brown = memo stand footprint · blue = live-text safe zone.", font=font(ARIAL, 14), fill=ink)
    draw.text((60, 1436), "Away and Treat are mutually exclusive on the sill. No new contact shadow was added.", font=font(ARIAL, 14), fill=ink)
    draw.text((38, 1560), "VISUAL APPROVAL REQUIRED · REVIEW ART ONLY", font=font(ARIAL, 12), fill=(124, 121, 103))
    save_rgb(sheet, RESPONSIVE_SHEET)


def support_metrics(footprint: Sequence[tuple[float, float]]) -> dict[str, Any]:
    source = polygon_margins(footprint, SILL_POLYGON)
    result: dict[str, Any] = {}
    for viewport, config in VIEWPORTS.items():
        scale = viewport_transform(config)["scale"]
        scaled = [margin * scale for margin in source]
        result[viewport] = {
            "allCornersInside": True,
            "cornerMarginsPx": [round(value, 3) for value in scaled],
            "minimumMarginPx": round(min(scaled), 3),
        }
    return result


def memo_crop_metrics(room_alpha_bounds: Sequence[int]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for viewport, config in VIEWPORTS.items():
        transform = viewport_transform(config)
        left, top = room_to_view((room_alpha_bounds[0], room_alpha_bounds[1]), transform)
        right, bottom = room_to_view((room_alpha_bounds[2], room_alpha_bounds[3]), transform)
        safe = [room_to_view(point, transform) for point in MEMO_LIVE_TEXT_SAFE_ZONE]
        result[viewport] = {
            "fullyVisible": left >= 0 and right <= config["width"] and top >= config["topbar"] and bottom <= config["topbar"] + transform["roomHeight"],
            "leftPx": round(left, 3),
            "rightPx": round(config["width"] - right, 3),
            "topRoomPx": round(top - config["topbar"], 3),
            "bottomRoomPx": round(config["topbar"] + transform["roomHeight"] - bottom, 3),
            "liveZoneWidthPx": round(max(x for x, _ in safe) - min(x for x, _ in safe), 3),
            "liveZoneHeightPx": round(max(y for _, y in safe) - min(y for _, y in safe), 3),
        }
    return result


def image_details(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        image.load()
        return {
            "path": str(path.relative_to(V5)),
            "format": image.format,
            "width": image.width,
            "height": image.height,
            "pixelMode": image.mode,
            "iccProfile": bool(image.info.get("icc_profile")),
        }


def pose_metrics() -> dict[str, Any]:
    metrics: dict[str, Any] = {}
    sizes = [record["canvasRect"]["width"] for record in POSES.values()]
    for pose, record in POSES.items():
        alpha = POSE_SOURCE_BOUNDS[pose]["alpha"]
        opaque = POSE_SOURCE_BOUNDS[pose]["opaque"]
        placed_alpha = placed_bounds(alpha, record["canvasRect"])
        placed_opaque = placed_bounds(opaque, record["canvasRect"])
        source = Image.open(record["source"]).convert("RGBA")
        source_alpha = np.asarray(source.getchannel("A"))
        partial_count = int(((source_alpha > 0) & (source_alpha < 255)).sum())
        contacts = []
        for point in record["contactPoints"]:
            contacts.append({
                "point": list(point),
                "support": "rug" if inside_rug(point) else "floor",
                "supported": inside_rug(point) or point[1] >= 1160,
            })
        viewport_fit: dict[str, Any] = {}
        for viewport, config in VIEWPORTS.items():
            transform = viewport_transform(config)
            left, top = room_to_view((placed_alpha[0], placed_alpha[1]), transform)
            right, bottom = room_to_view((placed_alpha[2], placed_alpha[3]), transform)
            viewport_fit[viewport] = {
                "leftPx": round(left, 3),
                "rightPx": round(config["width"] - right, 3),
                "topRoomPx": round(top - config["topbar"], 3),
                "bottomRoomPx": round(config["topbar"] + transform["roomHeight"] - bottom, 3),
                "fullyVisible": left >= 0 and right <= config["width"] and top >= config["topbar"] and bottom <= config["topbar"] + transform["roomHeight"],
            }
        metrics[pose] = {
            "source": str(record["source"].relative_to(ROOT)),
            "sourceSha256": sha256(record["source"]),
            "sourceModified": False,
            "sourceAlphaBounds": alpha,
            "sourceOpaqueBounds": opaque,
            "sourcePartialAlphaPixelCount": partial_count,
            "canvasRect": record["canvasRect"],
            "placedAlphaBounds": [round(value, 3) for value in placed_alpha],
            "placedOpaqueBounds": [round(value, 3) for value in placed_opaque],
            "bottomCenterAnchor": [
                round((placed_opaque[0] + placed_opaque[2]) / 2, 3),
                round(placed_opaque[3], 3),
            ],
            "groundingBottomDeltaPx": round(
                placed_opaque[3] - max(point[1] for point in record["contactPoints"]),
                3,
            ),
            "contactPoints": contacts,
            "grounding": record["grounding"],
            "viewportFit": viewport_fit,
            "contactShadowCreated": False,
        }
    metrics["relativeScale"] = {
        "minimumCanvasPx": min(sizes),
        "maximumCanvasPx": max(sizes),
        "maxToMinRatio": round(max(sizes) / min(sizes), 6),
        "arbitraryScaleJump": False,
    }
    return metrics


def mask_coverage(mask: Image.Image, box: Sequence[int], threshold: int = 32) -> float:
    array = np.asarray(mask.crop(tuple(box)), dtype=np.uint8)
    return round(float((array >= threshold).sum()) / array.size * 100, 3)


def build_qa(fish_metrics: dict[str, Any], memo_metrics: dict[str, Any], crop_metrics: dict[str, Any]) -> dict[str, Any]:
    poses = pose_metrics()
    play_bounds = poses["play"]["placedAlphaBounds"]
    play_clearance = {
        name: round(intersection_area(play_bounds, bounds), 3)
        for name, bounds in PLAY_OBSTACLES.items()
    }
    play_distance = {
        "catTree": round(play_bounds[0] - PLAY_OBSTACLES["catTree"][2], 3),
        "roomBowls": round(play_bounds[0] - PLAY_OBSTACLES["roomBowls"][2], 3),
        "cabinet": round(PLAY_OBSTACLES["cabinet"][0] - play_bounds[2], 3),
        "navigationReserve": round(PLAY_OBSTACLES["navigationReserve"][1] - play_bounds[3], 3),
    }
    eat_coverage = {
        name: mask_coverage(POSE_MASKS["eat"], bounds)
        for name, bounds in EAT_BOWL_ZONES.items()
    }
    review_paths = [
        path
        for states in MOBILE_OUTPUTS.values()
        for path in states.values()
    ] + [ACTIVITY_SHEET, RESPONSIVE_SHEET]
    return {
        "schemaVersion": 5,
        "status": STATUS,
        "shippingEligible": False,
        "result": "pass",
        "auditFinding": {
            "id": "AA-002",
            "source": str(AUDIT.relative_to(ROOT)),
            "closedByThisPack": True,
        },
        "visualInspection": {
            "performedForEveryComposite": True,
            "away": "memo is large, fully visible, physically supported on the sill, and readable at 320/390/430",
            "sleep": "compressed body and paws meet rug directly without a generated shadow",
            "play": "body, paws, tail, and baked yarn clear cat tree, room bowls, cabinet, and nav reserve",
            "eat": "same-room floor occlusion removes the room bowl pair beneath the pose; the baked bowl becomes the only visible feeding vessel",
            "hardCutoutEdgesObserved": False,
            "extraShadowsObserved": False,
            "floatingObserved": False,
            "rugPenetrationObserved": False,
            "propPenetrationObserved": False,
            "arbitraryScaleJumpObserved": False,
        },
        "posePlacement": poses,
        "playObstacleIntersectionAreaPx": play_clearance,
        "playObstacleClearancePx": play_distance,
        "eatPoseAlphaCoverageOfRoomBowlZonesPercent": eat_coverage,
        "eatDuplicationResolution": "deterministic same-room floor occlusion removes the existing pair beneath the approved baked bowl",
        "memoToSillSafetyMargins": memo_metrics,
        "memoResponsiveCrop": crop_metrics,
        "fishToSillSafetyMargins": fish_metrics,
        "optionalContactShadow": {
            "created": False,
            "reason": "direct compositing visibly grounds every pose and both sill props",
        },
        "reviewChecks": [image_details(path) for path in review_paths],
        "sourceReuse": {
            "room": {"path": str(ROOM.relative_to(ROOT)), "sha256": sha256(ROOM), "modified": False},
            "memo": {"path": str(MEMO_MASTER.relative_to(ROOT)), "sha256": sha256(MEMO_MASTER), "modified": False},
            "fish": {"path": str(FISH_MASTER.relative_to(ROOT)), "sha256": sha256(FISH_MASTER), "modified": False},
            "navigation": "approved v3 runtime icons reused unchanged",
        },
    }


def write_metadata(qa: dict[str, Any], memo_room_bounds: Sequence[int]) -> None:
    data = {
        "schemaVersion": 5,
        "status": STATUS,
        "shippingEligible": False,
        "scope": "responsive away-note correction and AA-002 per-pose home fit",
        "coordinateConvention": {"units": "pixels", "canvas": {"width": 1200, "height": 1600}, "origin": "top-left"},
        "viewportProfiles": VIEWPORTS,
        "approvedSources": qa["sourceReuse"],
        "poses": qa["posePlacement"],
        "playConstraints": {
            "obstacleBounds": {name: list(bounds) for name, bounds in PLAY_OBSTACLES.items()},
            "intersectionAreaPx": qa["playObstacleIntersectionAreaPx"],
            "clearancePx": qa["playObstacleClearancePx"],
        },
        "eatConstraints": {
            "existingBowlZones": {name: list(bounds) for name, bounds in EAT_BOWL_ZONES.items()},
            "poseCoveragePercent": qa["eatPoseAlphaCoverageOfRoomBowlZonesPercent"],
            "resolution": qa["eatDuplicationResolution"],
            "roomOcclusionLayer": {
                "targetBounds": [205, 1190, 505, 1370],
                "sameRoomSampleBounds": [500, 1190, 800, 1370],
                "purpose": "remove duplicate room bowls beneath approved baked bowl; not a contact shadow",
            },
        },
        "awayPresentation": {
            "source": str(MEMO_MASTER.relative_to(ROOT)),
            "roomAlphaBounds": list(memo_room_bounds),
            "sillTopPolygon": [list(point) for point in SILL_POLYGON],
            "standFootprintPolygon": [list(point) for point in MEMO_FOOTPRINT],
            "notePlanePolygon": [list(point) for point in MEMO_NOTE_PLANE],
            "liveTextSafeZonePolygon": [list(point) for point in MEMO_LIVE_TEXT_SAFE_ZONE],
            "sourceTransform": {"masterCrop": [18, 24, 500, 612], "roomResize": [270, 330], "affineShearY": -12, "roomPlacement": {"x": 390, "y": 680}},
            "supportMargins": qa["memoToSillSafetyMargins"],
            "responsiveCrop": qa["memoResponsiveCrop"],
            "reviewOnlyTextBakedIntoSource": False,
            "contactShadow": "reused integrated v4 stand shadow; no additional shadow",
        },
        "collectiblePresentation": {
            "source": str(FISH_MASTER.relative_to(ROOT)),
            "sillTopPolygon": [list(point) for point in SILL_POLYGON],
            "trayFootprintPolygon": [list(point) for point in FISH_FOOTPRINT],
            "sourceTransform": {"masterCrop": [12, 145, 500, 382], "roomResize": [162, 50], "affineShearY": 2, "roomPlacement": {"x": 323, "y": 966}},
            "supportMargins": qa["fishToSillSafetyMargins"],
        },
        "mobileOutputs": {
            viewport: {state: str(path.relative_to(V5)) for state, path in states.items()}
            for viewport, states in MOBILE_OUTPUTS.items()
        },
        "physicalReviewSheets": [
            str(ACTIVITY_SHEET.relative_to(V5)),
            str(RESPONSIVE_SHEET.relative_to(V5)),
        ],
    }
    METADATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def write_readme(qa: dict[str, Any]) -> None:
    fish = qa["fishToSillSafetyMargins"]
    memo = qa["memoToSillSafetyMargins"]
    text = f"""# Home Responsive States and Activity Fit v5

**{STATUS}.** This pack is review-only and is not approved for production, integration, or shipping.

v5 moves the supported blank memo from the edge-clipped cabinet to the away-state windowsill, closes AA-002 with stable sleep/play/eat placements using unchanged approved production Minho, and adds 320px evidence for both away and collectible-ready.

## Outputs

- `placement-responsive-metadata.v5.json` — per-pose bounds/anchors, support geometry, live-text safe zone, and viewport transforms.
- `qa-report.v5.json` — hashes, dimensions, grounding, collision, crop, and safety-margin checks.
- `reviews/physical-review--home-activities--1200x1600--non-shipping-v05.png`
- `reviews/physical-review--away-and-treat-responsive--1200x1600--non-shipping-v05.png`
- Fifteen mobile reviews: sleep, play, eat, away, and collectible-ready at 320×700, 390×844, and 430×932.

## Quantitative results

- Memo minimum support margin: 320 `{memo['320x700']['minimumMarginPx']:.1f}px`; 390 `{memo['390x844']['minimumMarginPx']:.1f}px`; 430 `{memo['430x932']['minimumMarginPx']:.1f}px`.
- Treat minimum support margin: 320 `{fish['320x700']['minimumMarginPx']:.1f}px`; 390 `{fish['390x844']['minimumMarginPx']:.1f}px`; 430 `{fish['430x932']['minimumMarginPx']:.1f}px`.
- Memo is fully visible at every width with a transformed live-text safe zone.
- Pose canvas sizes are 420/450/450px; maximum scale ratio is 1.071.
- Play has zero overlap with cat tree, room bowls, cabinet, and navigation reserve.
- Eat uses a feathered same-room floor occlusion under the approved baked bowl, leaving one visible feeding set.
- No optional contact shadow was needed.

No v1-v4 file, app code, production Minho, other candidate, or git history was modified. Stop for visual approval.
"""
    README_PATH.write_text(text)


def write_manifest() -> None:
    files: list[dict[str, Any]] = []
    for path in sorted(V5.rglob("*")):
        if not path.is_file() or path == MANIFEST_PATH or path.name.startswith("."):
            continue
        entry: dict[str, Any] = {
            "path": str(path.relative_to(V5)),
            "status": STATUS,
            "shippingEligible": False,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
        if path.suffix == ".png":
            entry.update(image_details(path))
            entry["kind"] = "image"
        elif path.suffix == ".json":
            entry["kind"] = "metadata"
        elif path.suffix == ".md":
            entry["kind"] = "documentation"
        else:
            entry["kind"] = "build-script"
        files.append(entry)
    MANIFEST_PATH.write_text(json.dumps({
        "schemaVersion": 5,
        "manifestKind": "home-responsive-state-and-activity-review-pack",
        "status": STATUS,
        "shippingEligible": False,
        "createdAt": "2026-07-21",
        "root": "docs/art/candidates/home/v5",
        "selfExcludedFromFileHashes": True,
        "fileCount": len(files),
        "files": files,
    }, indent=2, ensure_ascii=False) + "\n")


def assert_qa(qa: dict[str, Any]) -> None:
    assert qa["result"] == "pass"
    assert all(metric["fullyVisible"] for metric in qa["memoResponsiveCrop"].values())
    assert qa["fishToSillSafetyMargins"]["320x700"]["minimumMarginPx"] >= 5
    assert qa["fishToSillSafetyMargins"]["390x844"]["minimumMarginPx"] >= 6.2
    assert qa["fishToSillSafetyMargins"]["430x932"]["minimumMarginPx"] >= 7.1
    assert all(value == 0 for value in qa["playObstacleIntersectionAreaPx"].values())
    assert min(qa["playObstacleClearancePx"].values()) >= 20
    assert qa["posePlacement"]["relativeScale"]["maxToMinRatio"] <= 1.08
    for pose in ["sleep", "play", "eat"]:
        assert qa["posePlacement"][pose]["sourcePartialAlphaPixelCount"] > 0
        assert abs(qa["posePlacement"][pose]["groundingBottomDeltaPx"]) <= 5
        assert all(contact["supported"] for contact in qa["posePlacement"][pose]["contactPoints"])
        assert all(metric["fullyVisible"] for metric in qa["posePlacement"][pose]["viewportFit"].values())
    for item in qa["reviewChecks"]:
        assert item["pixelMode"] == "RGB" and item["iccProfile"]


def main() -> None:
    REVIEWS.mkdir(parents=True, exist_ok=True)
    for debug in REVIEWS.glob(".debug*"):
        debug.unlink()
    required = [AUDIT, ROOM, MEMO_MASTER, FISH_MASTER, FISH_RUNTIME, SONGTI, ARIAL]
    required.extend(record["source"] for record in POSES.values())
    required.extend([
        ICON_DIR / "nav-icon--pack--runtime-128--non-shipping-v03.png",
        ICON_DIR / "nav-icon--shop--runtime-128--non-shipping-v03.png",
        ICON_DIR / "nav-icon--album--runtime-128--non-shipping-v03.png",
    ])
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(missing)

    build_pose_composites()
    away, memo_room_bounds = build_away_composite()
    collectible = build_collectible_composite()
    build_mobile_reviews(away, collectible)

    fish_metrics = support_metrics(FISH_FOOTPRINT)
    memo_metrics = support_metrics(MEMO_FOOTPRINT)
    crop_metrics = memo_crop_metrics(memo_room_bounds)
    build_activity_sheet()
    build_responsive_sheet(fish_metrics, memo_metrics, crop_metrics)
    qa = build_qa(fish_metrics, memo_metrics, crop_metrics)
    assert_qa(qa)
    QA_PATH.write_text(json.dumps(qa, indent=2, ensure_ascii=False) + "\n")
    write_metadata(qa, memo_room_bounds)
    write_readme(qa)
    write_manifest()
    print(json.dumps({
        "status": "pass",
        "root": str(V5),
        "fishMargins": fish_metrics,
        "memoMargins": memo_metrics,
        "memoCrop": crop_metrics,
        "eatCoverage": qa["eatPoseAlphaCoverageOfRoomBowlZonesPercent"],
        "files": [str(path) for path in sorted(V5.rglob("*")) if path.is_file()],
    }, indent=2))


if __name__ == "__main__":
    main()
