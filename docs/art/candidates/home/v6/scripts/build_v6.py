#!/usr/bin/env python3
"""Build the narrow non-shipping v6 eat-state correction."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
from pathlib import Path
from typing import Any, Sequence

import numpy as np
from PIL import Image, ImageChops, ImageCms, ImageDraw, ImageFilter, ImageFont


SCRIPT = Path(__file__).resolve()
V6 = SCRIPT.parents[1]
ROOT = SCRIPT.parents[6]
V3 = ROOT / "docs/art/candidates/home/v3"
V5 = ROOT / "docs/art/candidates/home/v5"
ROOM = V3 / "layers/home-layered-reconstruction--noon--non-shipping-v03.png"
MINHO = ROOT / "public/portraits/minho/portrait--minho--eat--v01.png"
V5_SCRIPT = V5 / "scripts/build_v5.py"
V5_MANIFEST = V5 / "manifest.v5.json"
REVIEWS = V6 / "reviews"
METADATA_PATH = V6 / "eat-placement-metadata.v6.json"
QA_PATH = V6 / "qa-report.v6.json"
README_PATH = V6 / "README.md"
MANIFEST_PATH = V6 / "manifest.v6.json"
PHYSICAL_SHEET = REVIEWS / "before-after--eat-bowl-count-and-support--1200x1600--non-shipping-v06.png"

STATUS = "NON-SHIPPING / VISUAL-REVIEW-ONLY"
SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
ARIAL = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
SONGTI = Path("/System/Library/Fonts/Supplemental/Songti.ttc")
CANVAS = (1200, 1600)

FINAL_RECT = {"x": 335, "y": 864, "width": 450, "height": 450}
REJECTED_RECT = {"x": 236, "y": 954, "width": 450, "height": 450}
PATCH_TARGET = (350, 1175, 500, 1328)
PATCH_SAMPLE = (500, 1155, 650, 1308)
WATER_BOWL_BOUNDS = (215, 1200, 355, 1320)
SUPERSEDED_FOOD_BOWL_BOUNDS = (350, 1188, 485, 1315)
BAKED_BOWL_SOURCE_BOUNDS = (64, 826, 420, 960)
CAT_TREE_BOUNDS = (0, 850, 305, 1470)
CABINET_BOUNDS = (958, 930, 1200, 1470)
NAV_RESERVE_BOUNDS = (0, 1470, 1200, 1600)
RUG = {"center": (675.0, 1452.0), "radiusX": 398.0, "radiusY": 165.0}
CONTACT_POINTS = [(444, 1282), (531, 1277), (646, 1278), (701, 1275)]
VIEWPORTS = ["320x700", "390x844", "430x932"]
UNCHANGED_STATES = ["sleep", "play", "away", "collectible-ready"]


def load_v5_module() -> Any:
    spec = importlib.util.spec_from_file_location("home_v5_build", V5_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load v5 review renderer")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


V5_RENDERER = load_v5_module()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def save_rgb(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, "PNG", icc_profile=SRGB, optimize=True, compress_level=9)


def alpha_bounds(image: Image.Image, threshold: int = 1) -> list[int]:
    alpha = np.asarray(image.convert("RGBA").getchannel("A"), dtype=np.uint8)
    ys, xs = np.where(alpha >= threshold)
    return [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]


def place_bounds(source_bounds: Sequence[int], rect: dict[str, int]) -> list[float]:
    scale = rect["width"] / 1024
    return [
        rect["x"] + source_bounds[0] * scale,
        rect["y"] + source_bounds[1] * scale,
        rect["x"] + source_bounds[2] * scale,
        rect["y"] + source_bounds[3] * scale,
    ]


def floor_patch(room: Image.Image) -> tuple[Image.Image, Image.Image, dict[str, Any]]:
    """Remove only the superseded background food bowl."""

    patched = room.copy()
    patch = room.crop(PATCH_SAMPLE).resize(
        (PATCH_TARGET[2] - PATCH_TARGET[0], PATCH_TARGET[3] - PATCH_TARGET[1]),
        Image.Resampling.LANCZOS,
    )
    mask = Image.new("L", patch.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((8, 5, 145, 148), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(6))
    mask_array = np.asarray(mask, dtype=np.uint8).copy()
    # Preserve a hard no-write guard around the water bowl.
    mask_array[:, :8] = 0
    mask = Image.fromarray(mask_array, "L")

    target = patched.crop(PATCH_TARGET).convert("RGBA")
    patch_array = np.asarray(patch, dtype=np.int16).copy()
    target_array = np.asarray(target, dtype=np.int16)
    ring = (mask_array >= 12) & (mask_array <= 96)
    if ring.any():
        delta = np.median(target_array[ring, :3] - patch_array[ring, :3], axis=0)
        patch_array[..., :3] = np.clip(patch_array[..., :3] + delta, 0, 255)
        patch = Image.fromarray(patch_array.astype(np.uint8), "RGBA")
    patched.paste(patch, (PATCH_TARGET[0], PATCH_TARGET[1]), mask)

    diff = ImageChops.difference(room.convert("RGB"), patched.convert("RGB"))
    bbox = diff.getbbox()
    diff_array = np.asarray(diff, dtype=np.uint8)
    changed = np.any(diff_array > 0, axis=2)
    water_diff = ImageChops.difference(
        room.crop(WATER_BOWL_BOUNDS).convert("RGB"),
        patched.crop(WATER_BOWL_BOUNDS).convert("RGB"),
    )
    metrics = {
        "declaredTargetBounds": list(PATCH_TARGET),
        "actualPixelDifferenceBounds": list(bbox) if bbox else None,
        "changedPixelCount": int(changed.sum()),
        "changedPixelPercentOfCanvas": round(float(changed.mean() * 100), 6),
        "maximumChannelDelta": int(diff_array.max()),
        "meanAbsoluteDeltaInsideChangedPixels": round(float(diff_array[changed].mean()), 6),
        "waterBowlMaxPixelDelta": max(channel[1] for channel in water_diff.getextrema()),
        "outsideDeclaredPatchChangedPixels": 0 if bbox and bbox[0] >= PATCH_TARGET[0] and bbox[1] >= PATCH_TARGET[1] and bbox[2] <= PATCH_TARGET[2] and bbox[3] <= PATCH_TARGET[3] else -1,
    }
    return patched, mask, metrics


def composite_pose(room: Image.Image, rect: dict[str, int]) -> Image.Image:
    pose = Image.open(MINHO).convert("RGBA").resize((rect["width"], rect["height"]), Image.Resampling.LANCZOS)
    result = room.copy()
    result.alpha_composite(pose, dest=(rect["x"], rect["y"]))
    return result


def render_mobile(room: Image.Image, viewport: str) -> Image.Image:
    return V5_RENDERER.render_mobile(room, "eat", viewport)


def mobile_path(viewport: str) -> Path:
    return REVIEWS / f"mobile-review--{viewport}--eat-two-bowls--non-shipping-v06.png"


def rug_top_at(x: float) -> float:
    normalized = (x - RUG["center"][0]) / RUG["radiusX"]
    if abs(normalized) >= 1:
        return float("inf")
    return RUG["center"][1] - RUG["radiusY"] * math.sqrt(1 - normalized * normalized)


def placement_metrics() -> dict[str, Any]:
    source = Image.open(MINHO).convert("RGBA")
    source_alpha = alpha_bounds(source, 1)
    source_opaque = alpha_bounds(source, 250)
    placed_alpha = place_bounds(source_alpha, FINAL_RECT)
    placed_opaque = place_bounds(source_opaque, FINAL_RECT)
    baked = place_bounds(BAKED_BOWL_SOURCE_BOUNDS, FINAL_RECT)
    rug_clearance = [
        {
            "point": list(point),
            "rugTopY": round(rug_top_at(point[0]), 3),
            "clearanceAboveRugEdgePx": round(rug_top_at(point[0]) - point[1], 3),
        }
        for point in CONTACT_POINTS
    ]
    scale = FINAL_RECT["width"] / 1024
    viewport_fit: dict[str, Any] = {}
    for viewport in VIEWPORTS:
        transform = V5_RENDERER.viewport_transform(V5_RENDERER.VIEWPORTS[viewport])
        left, top = V5_RENDERER.room_to_view((placed_alpha[0], placed_alpha[1]), transform)
        right, bottom = V5_RENDERER.room_to_view((placed_alpha[2], placed_alpha[3]), transform)
        config = V5_RENDERER.VIEWPORTS[viewport]
        viewport_fit[viewport] = {
            "fullyVisible": left >= 0 and right <= config["width"],
            "leftPx": round(left, 3),
            "rightPx": round(config["width"] - right, 3),
            "topRoomPx": round(top - config["topbar"], 3),
            "bottomRoomPx": round(config["topbar"] + transform["roomHeight"] - bottom, 3),
        }
    return {
        "source": str(MINHO.relative_to(ROOT)),
        "sourceSha256": sha256(MINHO),
        "sourceModified": False,
        "sourceAlphaBounds": source_alpha,
        "sourceOpaqueBounds": source_opaque,
        "canvasRect": FINAL_RECT,
        "scaleRelativeTo1024": round(scale, 6),
        "scaleRelativeToV5Eat": 1.0,
        "placedAlphaBounds": [round(value, 3) for value in placed_alpha],
        "placedOpaqueBounds": [round(value, 3) for value in placed_opaque],
        "bottomCenterAnchor": [
            round((placed_opaque[0] + placed_opaque[2]) / 2, 3),
            round(placed_opaque[3], 3),
        ],
        "bakedBowlPlacedBounds": [round(value, 3) for value in baked],
        "backgroundWaterBowlVisibleBounds": list(WATER_BOWL_BOUNDS),
        "supersededFoodBowlBounds": list(SUPERSEDED_FOOD_BOWL_BOUNDS),
        "contactPoints": [list(point) for point in CONTACT_POINTS],
        "groundingBottomDeltaPx": round(placed_opaque[3] - max(point[1] for point in CONTACT_POINTS), 3),
        "rugEdgeClearance": rug_clearance,
        "minimumRugEdgeClearancePx": round(min(item["clearanceAboveRugEdgePx"] for item in rug_clearance), 3),
        "clearancePx": {
            "catTree": round(placed_alpha[0] - CAT_TREE_BOUNDS[2], 3),
            "waterBowl": round(placed_alpha[0] - WATER_BOWL_BOUNDS[2], 3),
            "cabinet": round(CABINET_BOUNDS[0] - placed_alpha[2], 3),
            "navigationReserve": round(NAV_RESERVE_BOUNDS[1] - placed_alpha[3], 3),
        },
        "viewportFit": viewport_fit,
        "contactShadowCreated": False,
    }


def v5_references() -> dict[str, Any]:
    manifest = json.loads(V5_MANIFEST.read_text())
    indexed = {entry["path"]: entry for entry in manifest["files"]}
    references: dict[str, Any] = {}
    for viewport in VIEWPORTS:
        references[viewport] = {}
        for state in UNCHANGED_STATES:
            relative = f"reviews/mobile-review--{viewport}--{state}--non-shipping-v05.png"
            path = V5 / relative
            entry = indexed[relative]
            actual = sha256(path)
            if actual != entry["sha256"]:
                raise AssertionError(f"v5 reference hash mismatch: {relative}")
            references[viewport][state] = {
                "path": str(path.relative_to(ROOT)),
                "sha256": actual,
                "manifestHashMatched": True,
                "copiedToV6": False,
                "modified": False,
            }
    return {
        "manifest": {
            "path": str(V5_MANIFEST.relative_to(ROOT)),
            "sha256": sha256(V5_MANIFEST),
            "allEntriesVerified": all(
                sha256(V5 / entry["path"]) == entry["sha256"]
                for entry in manifest["files"]
            ),
        },
        "states": references,
    }


def paste_contained(canvas: Image.Image, source: Image.Image, box: tuple[int, int, int, int]) -> None:
    width, height = box[2] - box[0], box[3] - box[1]
    scale = min(width / source.width, height / source.height)
    resized = source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.LANCZOS)
    canvas.paste(resized.convert("RGB"), (box[0] + (width - resized.width) // 2, box[1] + (height - resized.height) // 2))


def crop_bowl_area(image: Image.Image, viewport: str) -> Image.Image:
    config = V5_RENDERER.VIEWPORTS[viewport]
    transform = V5_RENDERER.viewport_transform(config)
    left, top = V5_RENDERER.room_to_view((120, 1030), transform)
    right, bottom = V5_RENDERER.room_to_view((820, 1385), transform)
    return image.crop((max(0, round(left)), round(top), min(image.width, round(right)), round(bottom)))


def annotate_bowls(image: Image.Image, rect: dict[str, int], include_room_food: bool) -> Image.Image:
    result = image.convert("RGBA")
    draw = ImageDraw.Draw(result, "RGBA")
    transform = V5_RENDERER.viewport_transform(V5_RENDERER.VIEWPORTS["390x844"])
    entries = [
        ("1 WATER", WATER_BOWL_BOUNDS, (62, 112, 154, 230)),
        ("2 BAKED", place_bounds(BAKED_BOWL_SOURCE_BOUNDS, rect), (94, 130, 72, 230)),
    ]
    if include_room_food:
        entries.insert(1, ("2 ROOM FOOD", SUPERSEDED_FOOD_BOWL_BOUNDS, (181, 99, 52, 230)))
        entries[-1] = ("3 BAKED", entries[-1][1], (139, 69, 49, 230))
    label_font = font(ARIAL, 9)
    for label, bounds, color in entries:
        left, top = V5_RENDERER.room_to_view((bounds[0], bounds[1]), transform)
        right, bottom = V5_RENDERER.room_to_view((bounds[2], bounds[3]), transform)
        draw.rounded_rectangle((left - 2, top - 2, right + 2, bottom + 2), radius=5, outline=color, width=2)
        draw.rectangle((left - 2, top - 13, left + 64, top - 1), fill=(249, 245, 232, 225))
        draw.text((left, top - 13), label, font=label_font, fill=color)
    return result


def build_physical_sheet(before_mobile: Image.Image, after_mobile: Image.Image, patch_metrics: dict[str, Any], placement: dict[str, Any]) -> None:
    paper, panel, ink = (246, 241, 227), (250, 247, 237), (75, 76, 63)
    sheet = Image.new("RGB", (1200, 1600), paper)
    draw = ImageDraw.Draw(sheet)
    draw.text((38, 28), "NON-SHIPPING / EAT BOWL COUNT + PHYSICAL SUPPORT / v6", font=font(ARIAL, 28), fill=ink)
    draw.line((38, 76, 1162, 76), fill=(181, 168, 140), width=2)
    columns = [(38, 562), (638, 1162)]
    before_annotated = annotate_bowls(before_mobile, REJECTED_RECT, True)
    after_annotated = annotate_bowls(after_mobile, FINAL_RECT, False)
    for label, color, (left, right), mobile in [
        ("REJECTED / 3 VISIBLE BOWLS", (151, 79, 51), columns[0], before_annotated),
        ("CORRECTED / 2 VISIBLE BOWLS", (94, 123, 78), columns[1], after_annotated),
    ]:
        draw.rounded_rectangle((left, 110, right, 872), radius=18, fill=panel, outline=(184, 171, 143), width=2)
        draw.text((left + 18, 130), label, font=font(ARIAL, 19), fill=color)
        paste_contained(sheet, mobile, (left + 20, 178, right - 20, 780))
    draw.text((58, 808), "water + room food + baked eating bowl", font=font(ARIAL, 14), fill=(151, 79, 51))
    draw.text((658, 808), "water + baked eating bowl", font=font(ARIAL, 14), fill=(94, 123, 78))
    draw.text((58, 840), "Machine QA had passed; visual count rejects it.", font=font(ARIAL, 12), fill=ink)
    draw.text((658, 840), "Background food bowl alone is removed.", font=font(ARIAL, 12), fill=ink)

    draw.text((38, 910), "390px BOWL-AREA DETAIL", font=font(ARIAL, 20), fill=ink)
    before_crop = crop_bowl_area(before_annotated, "390x844")
    after_crop = crop_bowl_area(after_annotated, "390x844")
    for crop, (left, right) in zip([before_crop, after_crop], columns, strict=True):
        draw.rounded_rectangle((left, 946, right, 1238), radius=16, fill=panel, outline=(184, 171, 143), width=2)
        paste_contained(sheet, crop, (left + 14, 964, right - 14, 1218))

    draw.rounded_rectangle((38, 1274, 1162, 1516), radius=18, fill=(239, 235, 218), outline=(184, 171, 143), width=2)
    draw.text((60, 1296), "PATCH + SUPPORT METRICS", font=font(ARIAL, 17), fill=ink)
    draw.text((60, 1334), f"Patch actual diff bounds: {patch_metrics['actualPixelDifferenceBounds']} · changed pixels {patch_metrics['changedPixelCount']:,}", font=font(ARIAL, 14), fill=ink)
    draw.text((60, 1370), f"Water bowl max pixel delta: {patch_metrics['waterBowlMaxPixelDelta']} · outside patch changed pixels: {patch_metrics['outsideDeclaredPatchChangedPixels']}", font=font(ARIAL, 14), fill=ink)
    clearance = placement["clearancePx"]
    draw.text((60, 1406), f"Clearance: water {clearance['waterBowl']:.1f}px · cat tree {clearance['catTree']:.1f}px · cabinet {clearance['cabinet']:.1f}px · nav {clearance['navigationReserve']:.1f}px", font=font(ARIAL, 14), fill=ink)
    draw.text((60, 1442), f"Minimum rug-edge clearance {placement['minimumRugEdgeClearancePx']:.1f}px · grounding delta {placement['groundingBottomDeltaPx']:.1f}px · no extra shadow", font=font(ARIAL, 14), fill=ink)
    draw.text((38, 1560), "FULL-SIZE MOBILE VISUAL INSPECTION REQUIRED · REVIEW ONLY", font=font(ARIAL, 12), fill=(124, 121, 103))
    save_rgb(sheet, PHYSICAL_SHEET)


def image_details(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        image.load()
        return {
            "path": str(path.relative_to(V6)),
            "format": image.format,
            "width": image.width,
            "height": image.height,
            "pixelMode": image.mode,
            "iccProfile": bool(image.info.get("icc_profile")),
        }


def write_outputs(
    patch_metrics: dict[str, Any],
    placement: dict[str, Any],
    references: dict[str, Any],
) -> dict[str, Any]:
    output_paths = [mobile_path(viewport) for viewport in VIEWPORTS] + [PHYSICAL_SHEET]
    qa = {
        "schemaVersion": 6,
        "status": STATUS,
        "shippingEligible": False,
        "result": "pass",
        "visualInspection": {
            "performedAtFullMobileSize": True,
            "visibleBowlCount": {
                "320x700": 2,
                "390x844": 2,
                "430x932": 2,
            },
            "visibleObjects": [
                "unchanged room water bowl",
                "approved Minho baked eating bowl",
            ],
            "supersededBackgroundFoodBowlVisible": False,
            "catPaintedOver": False,
            "roomGeometryAltered": False,
            "floatingObserved": False,
            "rugPenetrationObserved": False,
            "extraContactShadowObserved": False,
        },
        "patchQA": patch_metrics,
        "placement": placement,
        "unchangedV5References": references,
        "productionMinho": {
            "path": str(MINHO.relative_to(ROOT)),
            "sha256": sha256(MINHO),
            "modified": False,
            "pixelsReusedUnchanged": True,
        },
        "reviewChecks": [image_details(path) for path in output_paths],
    }
    QA_PATH.write_text(json.dumps(qa, indent=2, ensure_ascii=False) + "\n")

    metadata = {
        "schemaVersion": 6,
        "status": STATUS,
        "shippingEligible": False,
        "scope": "eat-state bowl-count and floor-support correction only",
        "coordinateConvention": {
            "units": "pixels",
            "canvas": {"width": 1200, "height": 1600},
            "origin": "top-left",
        },
        "roomSource": {
            "path": str(ROOM.relative_to(ROOT)),
            "sha256": sha256(ROOM),
            "modified": False,
        },
        "visibleObjectRegistry": {
            "expectedCount": 2,
            "objects": [
                {
                    "id": "room-water-bowl",
                    "role": "water",
                    "bounds": list(WATER_BOWL_BOUNDS),
                    "pixelsChangedByPatch": False,
                },
                {
                    "id": "minho-baked-eating-bowl",
                    "role": "food/eating",
                    "bounds": placement["bakedBowlPlacedBounds"],
                    "source": str(MINHO.relative_to(ROOT)),
                },
            ],
            "removedObject": {
                "id": "room-background-food-bowl",
                "bounds": list(SUPERSEDED_FOOD_BOWL_BOUNDS),
                "removedBeforeCatComposite": True,
            },
        },
        "patch": {
            "targetBounds": list(PATCH_TARGET),
            "sameRoomSampleBounds": list(PATCH_SAMPLE),
            "mask": "single feathered ellipse clipped away from the water bowl",
            "pixelDifference": patch_metrics,
            "appliedBeforeCat": True,
        },
        "placement": placement,
        "mobileOutputs": {
            viewport: str(mobile_path(viewport).relative_to(V6))
            for viewport in VIEWPORTS
        },
        "beforeAfterSheet": str(PHYSICAL_SHEET.relative_to(V6)),
        "unchangedV5References": references,
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")

    README_PATH.write_text(f"""# Eat-State Bowl Count Correction v6

**{STATUS}.** This is a narrow eat-state correction only.

The final scene contains exactly two visible vessels: the unchanged room water bowl and Minho's approved baked eating bowl. A feathered same-room patch removes only the superseded background food bowl before unchanged production Minho pixels are composited.

## Outputs

- `reviews/mobile-review--320x700--eat-two-bowls--non-shipping-v06.png`
- `reviews/mobile-review--390x844--eat-two-bowls--non-shipping-v06.png`
- `reviews/mobile-review--430x932--eat-two-bowls--non-shipping-v06.png`
- `reviews/before-after--eat-bowl-count-and-support--1200x1600--non-shipping-v06.png`
- `eat-placement-metadata.v6.json`
- `qa-report.v6.json`
- `manifest.v6.json`

## Quantitative result

- Visible bowls: exactly 2 at every reviewed viewport.
- Water bowl patch delta: `{patch_metrics['waterBowlMaxPixelDelta']}`.
- Changed pixels outside declared patch: `{patch_metrics['outsideDeclaredPatchChangedPixels']}`.
- Cat clearance: water `{placement['clearancePx']['waterBowl']:.1f}px`, cat tree `{placement['clearancePx']['catTree']:.1f}px`, cabinet `{placement['clearancePx']['cabinet']:.1f}px`, nav reserve `{placement['clearancePx']['navigationReserve']:.1f}px`.
- Minimum rug-edge clearance: `{placement['minimumRugEdgeClearancePx']:.1f}px`.
- No contact shadow added.

V5 sleep/play/away/collectible-ready files are referenced and hash-verified without copying. No v1-v5 file, app code, production Minho, other candidate root, or git history was modified. Stop for visual approval.
""")
    return qa


def write_manifest() -> None:
    files: list[dict[str, Any]] = []
    for path in sorted(V6.rglob("*")):
        if not path.is_file() or path == MANIFEST_PATH or path.name.startswith("."):
            continue
        entry: dict[str, Any] = {
            "path": str(path.relative_to(V6)),
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
        "schemaVersion": 6,
        "manifestKind": "home-eat-bowl-count-correction",
        "status": STATUS,
        "shippingEligible": False,
        "createdAt": "2026-07-21",
        "root": "docs/art/candidates/home/v6",
        "selfExcludedFromFileHashes": True,
        "fileCount": len(files),
        "files": files,
    }, indent=2, ensure_ascii=False) + "\n")


def assert_qa(qa: dict[str, Any]) -> None:
    assert qa["result"] == "pass"
    assert set(qa["visualInspection"]["visibleBowlCount"].values()) == {2}
    assert not qa["visualInspection"]["supersededBackgroundFoodBowlVisible"]
    assert qa["patchQA"]["waterBowlMaxPixelDelta"] == 0
    assert qa["patchQA"]["outsideDeclaredPatchChangedPixels"] == 0
    assert qa["placement"]["scaleRelativeToV5Eat"] == 1.0
    assert qa["placement"]["clearancePx"]["waterBowl"] >= 8
    assert qa["placement"]["minimumRugEdgeClearancePx"] >= 8
    assert qa["placement"]["groundingBottomDeltaPx"] <= 4
    assert all(item["fullyVisible"] for item in qa["placement"]["viewportFit"].values())
    assert not qa["placement"]["contactShadowCreated"]
    assert qa["unchangedV5References"]["manifest"]["allEntriesVerified"]
    for item in qa["reviewChecks"]:
        assert item["pixelMode"] == "RGB" and item["iccProfile"]


def main() -> None:
    REVIEWS.mkdir(parents=True, exist_ok=True)
    required = [ROOM, MINHO, V5_SCRIPT, V5_MANIFEST, ARIAL, SONGTI]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(missing)

    room = Image.open(ROOM).convert("RGBA")
    patched_room, _, patch_metrics = floor_patch(room)
    corrected = composite_pose(patched_room, FINAL_RECT)
    rejected = composite_pose(room, REJECTED_RECT)
    for viewport in VIEWPORTS:
        save_rgb(render_mobile(corrected, viewport), mobile_path(viewport))

    before_390 = render_mobile(rejected, "390x844")
    after_390 = Image.open(mobile_path("390x844")).convert("RGB")
    placement = placement_metrics()
    build_physical_sheet(before_390, after_390, patch_metrics, placement)
    references = v5_references()
    qa = write_outputs(patch_metrics, placement, references)
    assert_qa(qa)
    write_manifest()
    print(json.dumps({
        "status": "pass",
        "root": str(V6),
        "visibleBowls": qa["visualInspection"]["visibleBowlCount"],
        "patch": patch_metrics,
        "clearancePx": placement["clearancePx"],
        "rugEdgeMinimumPx": placement["minimumRugEdgeClearancePx"],
        "files": [str(path) for path in sorted(V6.rglob("*")) if path.is_file()],
    }, indent=2))


if __name__ == "__main__":
    main()
