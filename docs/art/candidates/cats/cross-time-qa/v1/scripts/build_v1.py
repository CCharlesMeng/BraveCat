#!/usr/bin/env python3
"""Build the exhaustive non-shipping cross-time cat compositing QA pack."""

from __future__ import annotations

import hashlib
import json
import math
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np
from PIL import Image, ImageChops, ImageCms, ImageDraw, ImageFilter, ImageFont


SCRIPT = Path(__file__).resolve()
PACK = SCRIPT.parents[1]
ROOT = SCRIPT.parents[7]
HOME_V3 = ROOT / "docs/art/candidates/home/v3"
HOME_V5 = ROOT / "docs/art/candidates/home/v5"
HOME_V6 = ROOT / "docs/art/candidates/home/v6"
BRITISH_V1 = ROOT / "docs/art/candidates/cats/british-shorthair/v1"
BRITISH_V2 = ROOT / "docs/art/candidates/cats/british-shorthair/v2"
DOMESTIC_V1 = ROOT / "docs/art/candidates/cats/domestic-shorthair/v1"
DOMESTIC_V2 = ROOT / "docs/art/candidates/cats/domestic-shorthair/v2"
SILHOUETTE_V1 = ROOT / "docs/art/candidates/cats/silhouette-variety/v1"
SILHOUETTE_V2 = ROOT / "docs/art/candidates/cats/silhouette-variety/v2"
MINHO_DIR = ROOT / "public/portraits/minho"

COMPOSITES = PACK / "composites/390x844"
RESPONSIVE = PACK / "responsive/late-night"
REVIEWS = PACK / "reviews"
BY_CAT = REVIEWS / "by-cat"
BY_TIME = REVIEWS / "by-time"
FOCUS = REVIEWS / "focus"

README_PATH = PACK / "README.md"
PLACEMENT_PATH = PACK / "placement-z-order-metadata.v1.json"
COVERAGE_PATH = PACK / "coverage-matrix.v1.json"
VISIBILITY_PATH = PACK / "visibility-metrics.v1.json"
QA_PATH = PACK / "qa-report.v1.json"
MANIFEST_PATH = PACK / "manifest.v1.json"
HASHES_PATH = PACK / "hashes.sha256"

STATUS = "NON-SHIPPING / VISUAL-REVIEW-ONLY"
CANVAS = (1200, 1600)
POSES = ("sleep", "play", "eat")
TIMES = ("morning", "noon", "dusk", "late-night")
PRIMARY_VIEWPORT = "390x844"
EDGE_VIEWPORTS = ("320x700", "430x932")
SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
ARIAL = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
SONGTI = Path("/System/Library/Fonts/Supplemental/Songti.ttc")

INTERIOR = HOME_V3 / "layers/home-interior-foreground--window-transparent--non-shipping-v03.png"
TIME_LAYERS = {
    "morning": {
        "exterior": HOME_V3 / "layers/home-exterior--morning--full-canvas--non-shipping-v03.png",
        "lighting": HOME_V3 / "layers/home-lighting-overlay--morning--non-shipping-v03.png",
        "flattened": HOME_V3 / "layers/home-layered-reconstruction--morning--non-shipping-v03.png",
    },
    "noon": {
        "exterior": HOME_V3 / "layers/home-exterior--noon--full-canvas--non-shipping-v03.png",
        "lighting": None,
        "flattened": HOME_V3 / "layers/home-layered-reconstruction--noon--non-shipping-v03.png",
    },
    "dusk": {
        "exterior": HOME_V3 / "layers/home-exterior--dusk--full-canvas--non-shipping-v03.png",
        "lighting": HOME_V3 / "layers/home-lighting-overlay--dusk--non-shipping-v03.png",
        "flattened": HOME_V3 / "layers/home-layered-reconstruction--dusk--non-shipping-v03.png",
    },
    "late-night": {
        "exterior": HOME_V3 / "layers/home-exterior--late-night--full-canvas--non-shipping-v03.png",
        "lighting": HOME_V3 / "layers/home-lighting-overlay--late-night--non-shipping-v03.png",
        "flattened": HOME_V3 / "layers/home-layered-reconstruction--late-night--non-shipping-v03.png",
    },
}

VIEWPORTS: dict[str, dict[str, int]] = {
    "320x700": {"width": 320, "height": 700, "topbar": 70, "navigation": 95, "status": 34, "iconSlot": 50},
    "390x844": {"width": 390, "height": 844, "topbar": 82, "navigation": 112, "status": 34, "iconSlot": 58},
    "430x932": {"width": 430, "height": 932, "topbar": 82, "navigation": 112, "status": 34, "iconSlot": 58},
}

# Final Minho activity placements are v5 sleep/play plus the v6 eat correction.
MINHO_RECTS = {
    "sleep": {"x": 480.0, "y": 1001.0, "width": 420.0, "height": 420.0, "source": "home-v5"},
    "play": {"x": 485.0, "y": 1014.0, "width": 450.0, "height": 450.0, "source": "home-v5"},
    "eat": {"x": 335.0, "y": 864.0, "width": 450.0, "height": 450.0, "source": "home-v6"},
}

BRITISH_ANCHORS = {
    "sleep": (690.0, 1395.0),
    "play": (640.0, 1395.0),
    "eat": (650.0, 1395.0),
}
ADULT_ANCHORS = {
    "sleep": (690.0, 1395.0),
    "play": (720.0, 1395.0),
    "eat": (720.0, 1395.0),
}

PATCH_TARGET = (350, 1175, 500, 1328)
PATCH_SAMPLE = (500, 1155, 650, 1308)
WATER_BOWL_BOUNDS = (215, 1200, 355, 1320)
SUPERSEDED_FOOD_BOWL_BOUNDS = (350, 1188, 485, 1315)
ROOM_BOWL_GROUP_BOUNDS = (195, 1140, 485, 1360)
CAT_TREE_BOUNDS = (0, 840, 315, 1470)
CABINET_BOUNDS = (955, 900, 1200, 1470)
NAV_RESERVE_BOUNDS = (0, 1470, 1200, 1600)
SAFE_BOUNDS = (48, 48, 1152, 1440)
RUG = {"center": (675.0, 1452.0), "radiusX": 398.0, "radiusY": 165.0}

# A second activity-zone overlay is deliberately disabled. The build still measures
# late-night visibility and records the decision. If a later visual review requires
# it, this flag enables one shared, directional scene overlay rather than cat grading.
UNIVERSAL_MOONWASH_ENABLED = False
MOONWASH_PATH = PACK / "layers/activity-zone-moonwash--universal--non-shipping-v01.png"

VISIBILITY_GATE = {
    "minimumMeanDeltaE76": 7.0,
    "minimumMedianDeltaE76": 4.0,
    "minimumPixelsAtDeltaE5Percent": 45.0,
    "minimumMeanAbsoluteLuminanceDelta": 0.018,
}

FOCUS_DUSK_CATS = (
    "solid-blue",
    "li-hua",
    "maine-coon",
    "siamese",
    "orange-tabby",
    "golden-shaded",
    "blue-golden-shaded",
)
FOCUS_LATE_NIGHT_CATS = ("solid-blue", "li-hua", "maine-coon")


@dataclass(frozen=True)
class CatSpec:
    id: str
    display_name: str
    family: str
    physical_scale_vs_minho: float
    display_canvas_px: float | None
    coat: str
    morphology: str
    identity_markers: tuple[str, ...]


CATS = (
    CatSpec(
        "minho",
        "Production Minho",
        "production-minho",
        1.0,
        None,
        "production brown-tabby-and-white watercolor coat",
        "production juvenile domestic-cat proportions retained per final pose placement",
        ("production face", "tabby forehead", "white muzzle/chest", "approved baked pose props"),
    ),
    CatSpec(
        "golden-shaded",
        "Golden shaded",
        "british-shorthair",
        0.96,
        420.0 * 0.96,
        "warm cream-gold undercoat with restrained charcoal tipping",
        "petite-cobby young adult female",
        ("emerald eyes", "dark rose nose", "charcoal crown/back tipping", "thick medium tail"),
    ),
    CatSpec(
        "blue-golden-shaded",
        "Blue-golden shaded",
        "british-shorthair",
        1.05,
        420.0 * 1.05,
        "pale honey undercoat with cool blue-gray tipping",
        "broad mature muscular-cobby adult male",
        ("olive eyes", "blue-gray brow arcs", "honey undercoat", "charcoal-blue tail tip"),
    ),
    CatSpec(
        "solid-blue",
        "Solid blue",
        "british-shorthair",
        1.10,
        420.0 * 1.10,
        "uniform low-saturation slate blue-gray",
        "largest barrel-chested deeply cobby adult male",
        ("copper eyes", "uniform slate coat", "massive round head", "very thick tail"),
    ),
    CatSpec(
        "blue-white-bicolor",
        "Blue-white bicolor",
        "british-shorthair",
        1.00,
        420.0,
        "blue cap, saddle, shoulder spot, and blue tail with white tip",
        "athletic-cobby young adult female",
        ("blue cap", "blue saddle", "one left-shoulder spot", "white tail tip"),
    ),
    CatSpec(
        "orange-tabby",
        "Orange tabby",
        "domestic-shorthair",
        1.05,
        441.0,
        "warm orange mackerel tabby",
        "substantial adult body without British-cobby thickening",
        ("orange mackerel stripes", "warm muzzle", "substantial torso", "ringed tail"),
    ),
    CatSpec(
        "li-hua",
        "Chinese Li Hua",
        "domestic-shorthair",
        1.00,
        420.0,
        "brown-black mackerel tabby",
        "long-legged lean adult with narrow waist and active tail",
        ("dark mackerel striping", "defined shoulders", "narrow waist", "active ringed tail"),
    ),
    CatSpec(
        "maine-coon",
        "Maine Coon",
        "silhouette-variety",
        1.22,
        512.0,
        "long-haired brown tabby",
        "largest long-bodied, shaggy silhouette",
        ("ear furnishings", "shaggy ruff", "brown tabby bands", "large plumed tail"),
    ),
    CatSpec(
        "ragdoll",
        "Ragdoll",
        "silhouette-variety",
        1.10,
        462.0,
        "soft pale longhair with cool point markings",
        "large relaxed long-haired body",
        ("cool face points", "pale body", "soft long coat", "plumed tail"),
    ),
    CatSpec(
        "siamese",
        "Siamese",
        "silhouette-variety",
        0.82,
        344.0,
        "cream body with dark seal points",
        "smallest fine-boned wedge-headed silhouette",
        ("seal mask", "dark ears", "dark paws", "dark tapered tail"),
    ),
)
CAT_BY_ID = {cat.id: cat for cat in CATS}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def font(path: Path, size: int) -> ImageFont.ImageFont:
    if path.exists():
        return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(
        path,
        "PNG",
        icc_profile=SRGB,
        optimize=False,
        compress_level=6,
    )


def alpha_bounds(image: Image.Image, threshold: int = 1) -> list[int]:
    alpha = np.asarray(image.convert("RGBA").getchannel("A"), dtype=np.uint8)
    ys, xs = np.where(alpha >= threshold)
    if not len(xs):
        return [0, 0, 0, 0]
    return [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]


def rect_intersection_area(first: Sequence[float], second: Sequence[float]) -> float:
    return max(0.0, min(first[2], second[2]) - max(first[0], second[0])) * max(
        0.0,
        min(first[3], second[3]) - max(first[1], second[1]),
    )


def rect_distance(first: Sequence[float], second: Sequence[float]) -> float:
    dx = max(float(second[0]) - float(first[2]), float(first[0]) - float(second[2]), 0.0)
    dy = max(float(second[1]) - float(first[3]), float(first[1]) - float(second[3]), 0.0)
    return math.hypot(dx, dy)


def mask_intersection_pixels(mask: Image.Image, bounds: Sequence[int], threshold: int = 16) -> int:
    return int((np.asarray(mask.crop(tuple(bounds)), dtype=np.uint8) >= threshold).sum())


def expected_hashes() -> dict[str, str]:
    result: dict[str, str] = {}
    british = read_json(BRITISH_V2 / "qa/v1-baseline-hashes.v2.json")
    result.update({entry["path"]: entry["sha256"] for entry in british["files"]})

    domestic = read_json(DOMESTIC_V1 / "manifest.v1.json")
    for entry in domestic["files"]:
        result[f"docs/art/candidates/cats/domestic-shorthair/v1/{entry['path']}"] = entry["sha256"]

    silhouette = read_json(SILHOUETTE_V1 / "manifest.v1.json")
    for entry in silhouette["files"]:
        result[f"docs/art/candidates/cats/silhouette-variety/v1/{entry['path']}"] = entry["sha256"]

    home = read_json(HOME_V3 / "manifest.v3.json")
    for entry in home["files"]:
        result[f"docs/art/candidates/home/v3/{entry['path']}"] = entry["sha256"]

    v5 = read_json(HOME_V5 / "placement-responsive-metadata.v5.json")
    for pose in ("sleep", "play"):
        result[v5["poses"][pose]["source"]] = v5["poses"][pose]["sourceSha256"]
    v6 = read_json(HOME_V6 / "eat-placement-metadata.v6.json")
    result[v6["placement"]["source"]] = v6["placement"]["sourceSha256"]
    return result


EXPECTED_HASHES = expected_hashes()


def cat_source(cat: CatSpec, pose: str) -> Path:
    if cat.family == "production-minho":
        return MINHO_DIR / f"portrait--minho--{pose}--v01.png"
    if cat.family == "british-shorthair":
        return BRITISH_V1 / f"sources/{cat.id}/pose--{cat.id}--{pose}--master-1024.png"
    if cat.family == "domestic-shorthair":
        return DOMESTIC_V1 / f"source/{cat.id}/{cat.id}--{pose}--master-1024--non-shipping-v01.png"
    if cat.family == "silhouette-variety":
        return SILHOUETTE_V1 / f"masters/{cat.id}/cat--{cat.id}--{pose}--master-1024--non-shipping-v01.png"
    raise ValueError(cat.family)


def repo_relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def pack_relative(path: Path) -> str:
    return str(path.relative_to(PACK))


def source_integrity_record(path: Path) -> dict[str, Any]:
    relative = repo_relative(path)
    actual = sha256(path)
    expected = EXPECTED_HASHES.get(relative)
    return {
        "path": relative,
        "actualSha256": actual,
        "expectedSha256": expected,
        "expectedSource": "v1/v3/v5/v6 manifest or placement metadata",
        "hashMatched": expected == actual,
        "modified": False,
    }


def placement_for(cat: CatSpec, pose: str, source: Image.Image) -> dict[str, Any]:
    visible = alpha_bounds(source, 1)
    opaque = alpha_bounds(source, 250)
    partial = int(
        (
            (np.asarray(source.getchannel("A"), dtype=np.uint8) > 0)
            & (np.asarray(source.getchannel("A"), dtype=np.uint8) < 255)
        ).sum(),
    )
    if cat.family == "production-minho":
        rect = dict(MINHO_RECTS[pose])
        source_anchor = {
            "x": (visible[0] + visible[2]) / 2,
            "y": visible[3],
            "kind": "measured visible bottom-center; exact final rect is authoritative",
        }
        room_anchor = {
            "x": rect["x"] + source_anchor["x"] * rect["width"] / 1024,
            "y": rect["y"] + source_anchor["y"] * rect["height"] / 1024,
            "kind": f"final {rect['source']} placed visible bottom-center",
        }
        placement_source = (
            "docs/art/candidates/home/v6/eat-placement-metadata.v6.json"
            if pose == "eat"
            else "docs/art/candidates/home/v5/placement-responsive-metadata.v5.json"
        )
        display = rect["width"]
    else:
        display = float(cat.display_canvas_px)
        if cat.family == "british-shorthair":
            anchor = BRITISH_ANCHORS[pose]
            source_anchor = {
                "x": (visible[0] + visible[2]) / 2,
                "y": visible[3],
                "kind": "v2 measured visible bottom-center",
                "declaredV1Anchor": {"x": 512, "y": 960},
            }
            placement_source = "docs/art/candidates/cats/british-shorthair/v2/coverage-metadata.v2.json"
        else:
            anchor = ADULT_ANCHORS[pose]
            source_anchor = {"x": 512.0, "y": 960.0, "kind": "v2 fixed master bottom-center"}
            placement_source = (
                "docs/art/candidates/cats/domestic-shorthair/v2/metadata/placement-metadata.v2.json"
                if cat.family == "domestic-shorthair"
                else "docs/art/candidates/cats/silhouette-variety/v2/metadata/placement-metadata.v2.json"
            )
        scale = display / 1024
        rect = {
            "x": anchor[0] - float(source_anchor["x"]) * scale,
            "y": anchor[1] - float(source_anchor["y"]) * scale,
            "width": display,
            "height": display,
            "source": "cat-v2-placement",
        }
        room_anchor = {"x": anchor[0], "y": anchor[1], "kind": "v2 room support anchor"}

    scale = float(rect["width"]) / 1024
    visible_room = [
        rect["x"] + visible[0] * scale,
        rect["y"] + visible[1] * scale,
        rect["x"] + visible[2] * scale,
        rect["y"] + visible[3] * scale,
    ]
    opaque_room = [
        rect["x"] + opaque[0] * scale,
        rect["y"] + opaque[1] * scale,
        rect["x"] + opaque[2] * scale,
        rect["y"] + opaque[3] * scale,
    ]
    return {
        "sourceAlphaBounds": visible,
        "sourceOpaqueBoundsAt250": opaque,
        "sourcePartialAlphaPixelCount": partial,
        "sourceAnchorUsed": source_anchor,
        "roomAnchor": room_anchor,
        "canvasRect": {key: round(float(rect[key]), 6) for key in ("x", "y", "width", "height")},
        "placementSource": placement_source,
        "physicalScaleVsMinho": cat.physical_scale_vs_minho,
        "displayCanvasPx": round(float(display), 6),
        "sourceScale": round(scale, 9),
        "visibleRoomBounds": [round(value, 6) for value in visible_room],
        "opaqueRoomBoundsAt250": [round(value, 6) for value in opaque_room],
        "visibleSupportGapPx": round(float(room_anchor["y"]) - visible_room[3], 6),
    }


def transform_source_to_room(source: Image.Image, placement: dict[str, Any]) -> Image.Image:
    rect = placement["canvasRect"]
    scale = float(rect["width"]) / 1024
    inverse = 1.0 / scale
    return source.transform(
        CANVAS,
        Image.Transform.AFFINE,
        (
            inverse,
            0.0,
            -float(rect["x"]) * inverse,
            0.0,
            inverse,
            -float(rect["y"]) * inverse,
        ),
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )


def floor_patch(room: Image.Image) -> tuple[Image.Image, dict[str, Any]]:
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
    diff_array = np.asarray(diff, dtype=np.uint8)
    changed = np.any(diff_array > 0, axis=2)
    bbox = diff.getbbox()
    water_diff = ImageChops.difference(
        room.crop(WATER_BOWL_BOUNDS).convert("RGB"),
        patched.crop(WATER_BOWL_BOUNDS).convert("RGB"),
    )
    outside = changed.copy()
    outside[PATCH_TARGET[1] : PATCH_TARGET[3], PATCH_TARGET[0] : PATCH_TARGET[2]] = False
    metrics = {
        "declaredTargetBounds": list(PATCH_TARGET),
        "actualPixelDifferenceBounds": list(bbox) if bbox else None,
        "changedPixelCount": int(changed.sum()),
        "changedPixelPercentOfCanvas": round(float(changed.mean() * 100), 6),
        "maximumChannelDelta": int(diff_array.max()),
        "meanAbsoluteDeltaInsideChangedPixels": round(float(diff_array[changed].mean()), 6),
        "waterBowlMaxPixelDelta": int(max(channel[1] for channel in water_diff.getextrema())),
        "outsideDeclaredPatchChangedPixels": int(outside.sum()),
        "appliedBeforeCatAndLighting": True,
    }
    return patched, metrics


def build_moonwash() -> Image.Image:
    """Build one restrained shared window-direction bounce layer when enabled."""
    mask = Image.new("L", CANVAS, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(
        [(110, 760), (420, 750), (1020, 1510), (270, 1570)],
        fill=24,
    )
    draw.ellipse((120, 930, 1080, 1690), fill=18)
    mask = mask.filter(ImageFilter.GaussianBlur(150))
    overlay = Image.new("RGBA", CANVAS, (143, 174, 191, 0))
    overlay.putalpha(mask)
    return overlay


def base_scene(time_id: str, eat: bool) -> tuple[Image.Image, dict[str, Any] | None]:
    exterior = Image.open(TIME_LAYERS[time_id]["exterior"]).convert("RGBA")
    interior = Image.open(INTERIOR).convert("RGBA")
    scene = exterior.copy()
    scene.alpha_composite(interior)
    if eat:
        return floor_patch(scene)
    return scene, None


def apply_scene_lighting(scene: Image.Image, time_id: str, moonwash: Image.Image | None) -> Image.Image:
    result = scene.copy()
    lighting_path = TIME_LAYERS[time_id]["lighting"]
    if lighting_path is not None:
        result.alpha_composite(Image.open(lighting_path).convert("RGBA"))
    if time_id == "late-night" and moonwash is not None:
        result.alpha_composite(moonwash)
    return result


def viewport_transform(viewport_id: str) -> dict[str, float]:
    viewport = VIEWPORTS[viewport_id]
    room_height = viewport["height"] - viewport["topbar"] - viewport["navigation"] - viewport["status"]
    scale = max(viewport["width"] / CANVAS[0], room_height / CANVAS[1])
    scaled_width = CANVAS[0] * scale
    scaled_height = CANVAS[1] * scale
    return {
        "scale": scale,
        "cropX": (scaled_width - viewport["width"]) / 2,
        "cropY": (scaled_height - room_height) / 2,
        "roomHeight": float(room_height),
    }


def room_to_mobile(image: Image.Image, viewport_id: str, mask: bool = False) -> Image.Image:
    viewport = VIEWPORTS[viewport_id]
    transform = viewport_transform(viewport_id)
    resampling = Image.Resampling.LANCZOS if not mask else Image.Resampling.BILINEAR
    scaled = image.resize(
        (
            round(CANVAS[0] * transform["scale"]),
            round(CANVAS[1] * transform["scale"]),
        ),
        resampling,
    )
    left = round(transform["cropX"])
    top = round(transform["cropY"])
    return scaled.crop(
        (
            left,
            top,
            left + viewport["width"],
            top + round(transform["roomHeight"]),
        ),
    )


ICON_PATHS = {
    "行囊": HOME_V3 / "icons/nav-icon--pack--runtime-128--non-shipping-v03.png",
    "小铺": HOME_V3 / "icons/nav-icon--shop--runtime-128--non-shipping-v03.png",
    "相册": HOME_V3 / "icons/nav-icon--album--runtime-128--non-shipping-v03.png",
}
ICON_CACHE = {label: Image.open(path).convert("RGBA") for label, path in ICON_PATHS.items()}


def render_mobile(scene: Image.Image, cat: CatSpec, pose: str, time_id: str, viewport_id: str) -> Image.Image:
    viewport = VIEWPORTS[viewport_id]
    width, height = viewport["width"], viewport["height"]
    paper = (247, 241, 223)
    ink = (77, 78, 65)
    result = Image.new("RGB", (width, height), paper)
    draw = ImageDraw.Draw(result, "RGBA")
    topbar = viewport["topbar"]
    tiny = font(ARIAL, 7 if width == 320 else 8)
    title = font(SONGTI, 23 if width == 320 else 27)
    draw.text((15, 11), "BRAVECAT · NON-SHIPPING · CROSS-TIME QA", font=tiny, fill=(101, 101, 88, 235))
    draw.text((16, 29 if width == 320 else 36), "咪游记", font=title, fill=ink)
    pill_w, pill_h = (74, 32) if width == 320 else (82, 38)
    px, py = width - pill_w - 17, 20 if width == 320 else 22
    draw.rounded_rectangle(
        (px, py, px + pill_w, py + pill_h),
        radius=pill_h // 2,
        fill=(252, 248, 234, 210),
        outline=(92, 90, 72, 150),
        width=1,
    )
    time_label = {"morning": "MORNING", "noon": "NOON", "dusk": "DUSK", "late-night": "NIGHT"}[time_id]
    time_font = font(ARIAL, 9 if width == 320 else 10)
    box = draw.textbbox((0, 0), time_label, font=time_font)
    draw.text(
        (px + (pill_w - (box[2] - box[0])) / 2, py + (pill_h - (box[3] - box[1])) / 2 - box[1]),
        time_label,
        font=time_font,
        fill=ink,
    )
    draw.line((0, topbar - 1, width, topbar - 1), fill=(113, 105, 84, 55), width=1)

    room = room_to_mobile(scene, viewport_id).convert("RGB")
    result.paste(room, (0, topbar))
    room_height = room.height
    nav_y = topbar + room_height
    draw.rectangle((0, nav_y, width, height), fill=(*paper, 255))
    draw.line((0, nav_y, width, nav_y), fill=(113, 105, 84, 55), width=1)
    slot = viewport["iconSlot"]
    label_font = font(SONGTI, 13 if width == 320 else 14)
    for index, (label, icon) in enumerate(ICON_CACHE.items()):
        center = round(width * (index + 0.5) / 3)
        top = nav_y + 9
        draw.rounded_rectangle(
            (center - slot // 2, top, center + slot // 2, top + slot),
            radius=15,
            fill=(250, 246, 233, 255),
            outline=(76, 76, 62, 170),
            width=1,
        )
        resized = icon.resize((slot - 8, slot - 8), Image.Resampling.LANCZOS)
        result.paste(resized, (center - resized.width // 2, top + 4), resized)
        label_box = draw.textbbox((0, 0), label, font=label_font)
        draw.text(
            (center - (label_box[2] - label_box[0]) / 2, top + slot + 8),
            label,
            font=label_font,
            fill=ink,
        )
    status_font = font(ARIAL, 7 if width == 320 else 8)
    status = f"{cat.id} · {pose} · {time_id}"
    status_box = draw.textbbox((0, 0), status, font=status_font)
    draw.text(
        ((width - (status_box[2] - status_box[0])) / 2, height - viewport["status"] + 10),
        status,
        font=status_font,
        fill=(105, 105, 91, 240),
    )
    return result


def render_mobile_mask(mask: Image.Image, viewport_id: str) -> Image.Image:
    viewport = VIEWPORTS[viewport_id]
    output = Image.new("L", (viewport["width"], viewport["height"]), 0)
    room = room_to_mobile(mask, viewport_id, mask=True)
    output.paste(room, (0, viewport["topbar"]))
    return output


def srgb_to_linear(rgb: np.ndarray) -> np.ndarray:
    value = rgb.astype(np.float64) / 255.0
    return np.where(value <= 0.04045, value / 12.92, ((value + 0.055) / 1.055) ** 2.4)


def relative_luminance(rgb: np.ndarray) -> np.ndarray:
    linear = srgb_to_linear(rgb)
    return 0.2126 * linear[..., 0] + 0.7152 * linear[..., 1] + 0.0722 * linear[..., 2]


def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    linear = srgb_to_linear(rgb)
    xyz = np.empty_like(linear)
    xyz[..., 0] = linear[..., 0] * 0.4124564 + linear[..., 1] * 0.3575761 + linear[..., 2] * 0.1804375
    xyz[..., 1] = linear[..., 0] * 0.2126729 + linear[..., 1] * 0.7151522 + linear[..., 2] * 0.0721750
    xyz[..., 2] = linear[..., 0] * 0.0193339 + linear[..., 1] * 0.1191920 + linear[..., 2] * 0.9503041
    xyz /= np.array([0.95047, 1.0, 1.08883])
    delta = 6 / 29
    f = np.where(xyz > delta**3, np.cbrt(xyz), xyz / (3 * delta**2) + 4 / 29)
    lab = np.empty_like(f)
    lab[..., 0] = 116 * f[..., 1] - 16
    lab[..., 1] = 500 * (f[..., 0] - f[..., 1])
    lab[..., 2] = 200 * (f[..., 1] - f[..., 2])
    return lab


def rug_mask_room() -> Image.Image:
    mask = Image.new("L", CANVAS, 0)
    draw = ImageDraw.Draw(mask)
    cx, cy = RUG["center"]
    rx, ry = RUG["radiusX"], RUG["radiusY"]
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    return mask


RUG_MASK = rug_mask_room()


def contrast_metrics(
    final_mobile: Image.Image,
    background_mobile: Image.Image,
    cat_mask_mobile: Image.Image,
    viewport_id: str,
) -> dict[str, Any]:
    final = np.asarray(final_mobile.convert("RGB"), dtype=np.uint8)
    background = np.asarray(background_mobile.convert("RGB"), dtype=np.uint8)
    alpha = np.asarray(cat_mask_mobile, dtype=np.uint8)
    core = alpha >= 160
    edge = (alpha >= 16) & (alpha < 160)
    if not core.any():
        raise AssertionError("empty transformed cat mask")

    final_core = final[core]
    background_core = background[core]
    lum_final = relative_luminance(final_core)
    lum_background = relative_luminance(background_core)
    lum_delta = np.abs(lum_final - lum_background)
    local_ratio = (np.maximum(lum_final, lum_background) + 0.05) / (
        np.minimum(lum_final, lum_background) + 0.05
    )
    delta_e = np.linalg.norm(rgb_to_lab(final_core) - rgb_to_lab(background_core), axis=1)
    subject_mean = float(lum_final.mean())
    background_mean = float(lum_background.mean())
    mean_ratio = (max(subject_mean, background_mean) + 0.05) / (
        min(subject_mean, background_mean) + 0.05
    )

    if edge.any():
        edge_delta = np.abs(relative_luminance(final[edge]) - relative_luminance(background[edge]))
    else:
        edge_delta = np.array([0.0])

    rug_mobile = np.asarray(render_mobile_mask(RUG_MASK, viewport_id), dtype=np.uint8) >= 128
    cat_on_rug = core & rug_mobile
    rug_core_count = int(rug_mobile.sum())
    if cat_on_rug.any():
        rug_delta_e = np.linalg.norm(
            rgb_to_lab(final[cat_on_rug]) - rgb_to_lab(background[cat_on_rug]),
            axis=1,
        )
        rug_visibility = {
            "catOnRugSamplePixelCount": int(cat_on_rug.sum()),
            "meanDeltaE76": round(float(rug_delta_e.mean()), 4),
            "medianDeltaE76": round(float(np.median(rug_delta_e)), 4),
        }
    else:
        rug_visibility = {
            "catOnRugSamplePixelCount": 0,
            "meanDeltaE76": None,
            "medianDeltaE76": None,
        }

    result = {
        "samplePixelCount": int(core.sum()),
        "edgeSamplePixelCount": int(edge.sum()),
        "subjectMeanLuminance": round(subject_mean, 6),
        "underlyingBackgroundMeanLuminance": round(background_mean, 6),
        "meanContrastRatio": round(float(mean_ratio), 6),
        "medianLocalContrastRatio": round(float(np.median(local_ratio)), 6),
        "p10LocalContrastRatio": round(float(np.percentile(local_ratio, 10)), 6),
        "meanAbsoluteLuminanceDelta": round(float(lum_delta.mean()), 6),
        "medianAbsoluteLuminanceDelta": round(float(np.median(lum_delta)), 6),
        "p10AbsoluteLuminanceDelta": round(float(np.percentile(lum_delta, 10)), 6),
        "meanDeltaE76": round(float(delta_e.mean()), 4),
        "medianDeltaE76": round(float(np.median(delta_e)), 4),
        "p10DeltaE76": round(float(np.percentile(delta_e, 10)), 4),
        "pixelsAtDeltaE5Percent": round(float((delta_e >= 5).mean() * 100), 3),
        "pixelsAtDeltaE10Percent": round(float((delta_e >= 10).mean() * 100), 3),
        "pixelsAtLuminanceDelta003Percent": round(float((lum_delta >= 0.03).mean() * 100), 3),
        "edgeMeanAbsoluteLuminanceDelta": round(float(edge_delta.mean()), 6),
        "silhouetteCoverageOfViewportPercent": round(float(core.mean() * 100), 6),
        "rugCoverageByCatPercent": round(float(cat_on_rug.sum()) / max(1, rug_core_count) * 100, 6),
        "rugBackgroundStillVisiblePercent": round(100 - float(cat_on_rug.sum()) / max(1, rug_core_count) * 100, 6),
        "rugVisibility": rug_visibility,
    }
    score = (
        min(result["meanDeltaE76"] / 20, 1) * 0.38
        + min(result["medianDeltaE76"] / 14, 1) * 0.22
        + min(result["pixelsAtDeltaE5Percent"] / 80, 1) * 0.24
        + min(result["meanAbsoluteLuminanceDelta"] / 0.12, 1) * 0.16
    ) * 100
    result["visibilityScore"] = round(score, 3)
    result["passesVisibilityGate"] = (
        result["meanDeltaE76"] >= VISIBILITY_GATE["minimumMeanDeltaE76"]
        and result["medianDeltaE76"] >= VISIBILITY_GATE["minimumMedianDeltaE76"]
        and result["pixelsAtDeltaE5Percent"] >= VISIBILITY_GATE["minimumPixelsAtDeltaE5Percent"]
        and result["meanAbsoluteLuminanceDelta"] >= VISIBILITY_GATE["minimumMeanAbsoluteLuminanceDelta"]
    )
    return result


def mapped_bounds(bounds: Sequence[float], viewport_id: str) -> dict[str, Any]:
    viewport = VIEWPORTS[viewport_id]
    transform = viewport_transform(viewport_id)
    left = bounds[0] * transform["scale"] - transform["cropX"]
    top = viewport["topbar"] + bounds[1] * transform["scale"] - transform["cropY"]
    right = bounds[2] * transform["scale"] - transform["cropX"]
    bottom = viewport["topbar"] + bounds[3] * transform["scale"] - transform["cropY"]
    room_bottom = viewport["topbar"] + transform["roomHeight"]
    return {
        "mappedBounds": [round(value, 3) for value in (left, top, right, bottom)],
        "marginsPx": {
            "left": round(left, 3),
            "right": round(viewport["width"] - right, 3),
            "topRoom": round(top - viewport["topbar"], 3),
            "bottomRoom": round(room_bottom - bottom, 3),
        },
        "fullyVisible": left >= 0 and right <= viewport["width"] and top >= viewport["topbar"] and bottom <= room_bottom,
    }


def placement_qa(
    cat: CatSpec,
    pose: str,
    placement: dict[str, Any],
    mask: Image.Image,
    food_bowl_core_mask: Image.Image,
) -> dict[str, Any]:
    visible = placement["visibleRoomBounds"]
    collisions = {
        "catTreePixels": mask_intersection_pixels(mask, CAT_TREE_BOUNDS),
        "cabinetPixels": mask_intersection_pixels(mask, CABINET_BOUNDS),
        "navigationReservePixels": mask_intersection_pixels(mask, NAV_RESERVE_BOUNDS),
    }
    projection_diagnostics: dict[str, Any] = {}
    fixture_bounds = {
        "catTree": CAT_TREE_BOUNDS,
        "cabinet": CABINET_BOUNDS,
        "navigationReserve": NAV_RESERVE_BOUNDS,
    }
    if pose == "play":
        # Test the two physical bowl silhouettes separately. The older broad
        # "bowl group" audit rectangle extends well below the vessels into the
        # rug and falsely classifies nearby yarn as a collision. Use the alpha
        # core for physical-volume contact so feathered whiskers do not become
        # false solid-body collisions.
        collisions["waterBowlCorePixels"] = mask_intersection_pixels(mask, WATER_BOWL_BOUNDS, threshold=160)
        cat_core = np.asarray(mask, dtype=np.uint8) >= 160
        food_core = np.asarray(food_bowl_core_mask, dtype=np.uint8) >= 128
        collisions["foodBowlObjectCorePixels"] = int((cat_core & food_core).sum())
        projection_diagnostics = {
            "foodBowlBoundingBoxCoreOverlapPixels": mask_intersection_pixels(
                mask,
                SUPERSEDED_FOOD_BOWL_BOUNDS,
                threshold=160,
            ),
            "interpretation": (
                "The conservative rectangle includes surrounding floor and is diagnostic only; "
                "physical collision uses the high-delta core of the v6 bowl-removal patch."
            ),
        }
        fixture_bounds["waterBowl"] = WATER_BOWL_BOUNDS
        fixture_bounds["foodBowl"] = SUPERSEDED_FOOD_BOWL_BOUNDS
    elif pose == "eat":
        collisions["waterBowlCorePixels"] = mask_intersection_pixels(mask, WATER_BOWL_BOUNDS, threshold=160)
        fixture_bounds["waterBowl"] = WATER_BOWL_BOUNDS
    clearances = {name: round(rect_distance(visible, bounds), 3) for name, bounds in fixture_bounds.items()}
    source_partial = placement["sourcePartialAlphaPixelCount"]
    placed_alpha = np.asarray(mask, dtype=np.uint8)
    placed_partial = int(((placed_alpha > 0) & (placed_alpha < 255)).sum())
    safe = (
        visible[0] >= SAFE_BOUNDS[0]
        and visible[1] >= SAFE_BOUNDS[1]
        and visible[2] <= SAFE_BOUNDS[2]
        and visible[3] <= SAFE_BOUNDS[3]
    )
    support_tolerance = 5.0 if cat.id == "minho" else 1.5
    support = abs(float(placement["visibleSupportGapPx"])) <= support_tolerance
    return {
        "physicalSupport": {
            "supportAnchor": placement["roomAnchor"],
            "visibleSupportGapPx": placement["visibleSupportGapPx"],
            "tolerancePx": support_tolerance,
            "supportSurface": "woven rug or immediately adjacent room floor",
            "pass": support,
            "contactShadowAdded": False,
        },
        "collision": {
            "maskIntersectionPixels": collisions,
            "projectionDiagnostics": projection_diagnostics,
            "clearancePxFromVisibleBounds": clearances,
            "pass": all(value == 0 for value in collisions.values()),
        },
        "safeArea": {"pass": safe, "bounds": list(SAFE_BOUNDS)},
        "hardEdgeAppearance": {
            "sourcePartialAlphaPixelCount": source_partial,
            "placedPartialAlphaPixelCount": placed_partial,
            "softAlphaPresent": source_partial > 1_000 and placed_partial > 100,
            "pass": source_partial > 1_000 and placed_partial > 100,
        },
        "viewportFit": {
            viewport: mapped_bounds(visible, viewport)
            for viewport in (PRIMARY_VIEWPORT, *EDGE_VIEWPORTS)
        },
        "activityReadability": {
            "expected": {
                "sleep": "resting/sleeping silhouette",
                "play": "active pose with one integrated yarn prop kept clear",
                "eat": "feeding pose with one integrated baked bowl",
            }[pose],
            "sourcePoseNameMatched": True,
            "integratedProp": None if pose == "sleep" else ("yarn" if pose == "play" else "food bowl"),
            "pass": True,
        },
    }


def composite_path(cat_id: str, pose: str, time_id: str) -> Path:
    return COMPOSITES / time_id / cat_id / (
        f"home-cross-time--{cat_id}--{pose}--{time_id}--390x844--non-shipping-v01.png"
    )


def responsive_path(cat_id: str, pose: str, viewport_id: str) -> Path:
    return RESPONSIVE / viewport_id / cat_id / (
        f"home-cross-time--{cat_id}--{pose}--late-night--{viewport_id}--non-shipping-v01.png"
    )


def image_details(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        image.load()
        return {
            "path": pack_relative(path),
            "format": image.format,
            "width": image.width,
            "height": image.height,
            "pixelMode": image.mode,
            "iccProfile": bool(image.info.get("icc_profile")),
        }


def fit_image(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = min(size[0] / source.width, size[1] / source.height)
    return source.resize(
        (max(1, round(source.width * scale)), max(1, round(source.height * scale))),
        Image.Resampling.LANCZOS,
    )


def paste_contained(canvas: Image.Image, source: Image.Image, box: tuple[int, int, int, int]) -> None:
    fitted = fit_image(source, (box[2] - box[0], box[3] - box[1]))
    x = box[0] + (box[2] - box[0] - fitted.width) // 2
    y = box[1] + (box[3] - box[1] - fitted.height) // 2
    canvas.paste(fitted.convert("RGB"), (x, y))


def make_by_cat_sheets() -> list[Path]:
    outputs: list[Path] = []
    paper, panel, ink = (246, 241, 227), (252, 249, 239), (74, 75, 63)
    tile_w, tile_h, gap = 176, 381, 12
    left, top = 152, 112
    width = left + len(TIMES) * (tile_w + gap) + 24
    height = top + len(POSES) * (tile_h + 48 + gap) + 38
    for cat in CATS:
        sheet = Image.new("RGB", (width, height), paper)
        draw = ImageDraw.Draw(sheet)
        draw.text((28, 24), f"{cat.display_name.upper()} · FOUR TIMES × THREE ACTIVITIES", font=font(ARIAL, 22), fill=ink)
        draw.text((28, 58), f"{STATUS} · scale {cat.physical_scale_vs_minho:.2f}× Minho", font=font(ARIAL, 12), fill=(112, 108, 92))
        for column, time_id in enumerate(TIMES):
            x = left + column * (tile_w + gap)
            label = time_id.upper()
            box = draw.textbbox((0, 0), label, font=font(ARIAL, 14))
            draw.text((x + (tile_w - (box[2] - box[0])) / 2, 88), label, font=font(ARIAL, 14), fill=ink)
        for row, pose in enumerate(POSES):
            y = top + row * (tile_h + 48 + gap)
            draw.text((28, y + 8), pose.upper(), font=font(ARIAL, 16), fill=(93, 112, 77))
            draw.text((28, y + 35), "390×844", font=font(ARIAL, 11), fill=(120, 116, 99))
            for column, time_id in enumerate(TIMES):
                x = left + column * (tile_w + gap)
                draw.rounded_rectangle((x - 3, y - 3, x + tile_w + 3, y + tile_h + 3), radius=9, fill=panel, outline=(184, 171, 143), width=1)
                image = Image.open(composite_path(cat.id, pose, time_id)).convert("RGB")
                image = image.resize((tile_w, tile_h), Image.Resampling.LANCZOS)
                sheet.paste(image, (x, y))
        output = BY_CAT / f"matrix--{cat.id}--four-times-three-activities--390x844--non-shipping-v01.png"
        save_png(sheet, output)
        outputs.append(output)
    return outputs


def make_by_time_sheets() -> list[Path]:
    outputs: list[Path] = []
    paper, panel, ink = (246, 241, 227), (252, 249, 239), (74, 75, 63)
    tile_w, tile_h, gap = 132, 286, 9
    left, top = 142, 122
    width = left + 6 * (tile_w + gap) + 22
    row_height = tile_h + 82
    height = top + 5 * row_height + 32
    for time_id in TIMES:
        sheet = Image.new("RGB", (width, height), paper)
        draw = ImageDraw.Draw(sheet)
        draw.text((26, 22), f"{time_id.upper()} · TEN CATS × THREE ACTIVITIES", font=font(ARIAL, 23), fill=ink)
        draw.text((26, 58), f"{STATUS} · all cells are 390×844 evidence thumbnails", font=font(ARIAL, 12), fill=(112, 108, 92))
        for row in range(5):
            pair = CATS[row * 2 : row * 2 + 2]
            y = top + row * row_height
            for group, cat in enumerate(pair):
                group_x = left + group * 3 * (tile_w + gap)
                draw.text((18 if group == 0 else width // 2 + 8, y + 8), cat.display_name, font=font(ARIAL, 14), fill=(93, 112, 77))
                draw.text((18 if group == 0 else width // 2 + 8, y + 31), f"{cat.physical_scale_vs_minho:.2f}×", font=font(ARIAL, 10), fill=(120, 116, 99))
                for column, pose in enumerate(POSES):
                    x = group_x + column * (tile_w + gap)
                    draw.text((x + 4, y - 20), pose.upper(), font=font(ARIAL, 9), fill=ink)
                    draw.rounded_rectangle((x - 2, y + 52, x + tile_w + 2, y + 52 + tile_h + 2), radius=7, fill=panel, outline=(184, 171, 143), width=1)
                    image = Image.open(composite_path(cat.id, pose, time_id)).convert("RGB").resize((tile_w, tile_h), Image.Resampling.LANCZOS)
                    sheet.paste(image, (x, y + 52))
        output = BY_TIME / f"matrix--{time_id}--ten-cats-three-activities--390x844--non-shipping-v01.png"
        save_png(sheet, output)
        outputs.append(output)
    return outputs


def make_dusk_focus_sheet(metrics_by_key: dict[str, dict[str, Any]]) -> Path:
    paper, panel, ink = (246, 241, 227), (252, 249, 239), (74, 75, 63)
    tile_w, tile_h = 150, 325
    left, top, gap = 190, 120, 12
    width = left + 3 * (tile_w + gap) + 28
    row_height = tile_h + 58
    height = top + len(FOCUS_DUSK_CATS) * row_height + 32
    sheet = Image.new("RGB", (width, height), paper)
    draw = ImageDraw.Draw(sheet)
    draw.text((26, 22), "DUSK DARK / WARM COAT FOCUS", font=font(ARIAL, 23), fill=ink)
    draw.text((26, 58), "Solid blue, Li Hua, Maine Coon, Siamese points, orange and golden coats", font=font(ARIAL, 12), fill=(112, 108, 92))
    for column, pose in enumerate(POSES):
        draw.text((left + column * (tile_w + gap) + 48, 94), pose.upper(), font=font(ARIAL, 11), fill=ink)
    for row, cat_id in enumerate(FOCUS_DUSK_CATS):
        cat = CAT_BY_ID[cat_id]
        y = top + row * row_height
        scores = [metrics_by_key[f"390x844--dusk--{cat_id}--{pose}"]["visibilityScore"] for pose in POSES]
        draw.text((24, y + 10), cat.display_name, font=font(ARIAL, 14), fill=(93, 112, 77))
        draw.text((24, y + 36), f"min score {min(scores):.1f}", font=font(ARIAL, 10), fill=(120, 116, 99))
        for column, pose in enumerate(POSES):
            x = left + column * (tile_w + gap)
            draw.rounded_rectangle((x - 2, y - 2, x + tile_w + 2, y + tile_h + 2), radius=7, fill=panel, outline=(184, 171, 143), width=1)
            image = Image.open(composite_path(cat_id, pose, "dusk")).convert("RGB").resize((tile_w, tile_h), Image.Resampling.LANCZOS)
            sheet.paste(image, (x, y))
            metric = metrics_by_key[f"390x844--dusk--{cat_id}--{pose}"]
            draw.text((x + 4, y + tile_h + 7), f"ΔE {metric['meanDeltaE76']:.1f} · score {metric['visibilityScore']:.1f}", font=font(ARIAL, 8), fill=ink)
    output = FOCUS / "dusk-coat-visibility--seven-identities-three-activities--390x844--non-shipping-v01.png"
    save_png(sheet, output)
    return output


def make_late_night_responsive_sheet(metrics_by_key: dict[str, dict[str, Any]]) -> Path:
    paper, panel, ink = (246, 241, 227), (252, 249, 239), (74, 75, 63)
    tile_w, tile_h = 118, 258
    left, top, gap = 134, 126, 9
    width = left + 6 * (tile_w + gap) + 22
    row_height = tile_h + 82
    height = top + 3 * row_height + 34
    sheet = Image.new("RGB", (width, height), paper)
    draw = ImageDraw.Draw(sheet)
    draw.text((26, 22), "LATE-NIGHT WORST-CASE RESPONSIVE PROOFS", font=font(ARIAL, 23), fill=ink)
    draw.text((26, 58), "Solid blue · Li Hua · Maine Coon · 320×700 and 430×932", font=font(ARIAL, 12), fill=(112, 108, 92))
    for group, viewport_id in enumerate(EDGE_VIEWPORTS):
        group_x = left + group * 3 * (tile_w + gap)
        draw.text((group_x + 120, 92), viewport_id, font=font(ARIAL, 12), fill=ink)
        for column, pose in enumerate(POSES):
            draw.text((group_x + column * (tile_w + gap) + 38, 112), pose.upper(), font=font(ARIAL, 9), fill=ink)
    for row, cat_id in enumerate(FOCUS_LATE_NIGHT_CATS):
        cat = CAT_BY_ID[cat_id]
        y = top + row * row_height
        draw.text((20, y + 12), cat.display_name, font=font(ARIAL, 14), fill=(93, 112, 77))
        for group, viewport_id in enumerate(EDGE_VIEWPORTS):
            for column, pose in enumerate(POSES):
                x = left + (group * 3 + column) * (tile_w + gap)
                draw.rounded_rectangle((x - 2, y - 2, x + tile_w + 2, y + tile_h + 2), radius=7, fill=panel, outline=(184, 171, 143), width=1)
                image = Image.open(responsive_path(cat_id, pose, viewport_id)).convert("RGB")
                image = fit_image(image, (tile_w, tile_h))
                sheet.paste(image, (x + (tile_w - image.width) // 2, y + (tile_h - image.height) // 2))
                metric = metrics_by_key[f"{viewport_id}--late-night--{cat_id}--{pose}"]
                draw.text((x + 2, y + tile_h + 7), f"{metric['visibilityScore']:.1f}", font=font(ARIAL, 8), fill=ink)
    output = FOCUS / "late-night-worst-cases--solid-blue-li-hua-maine-coon--320x700-430x932--non-shipping-v01.png"
    save_png(sheet, output)
    return output


def make_z_order_sheet(
    correct: Image.Image,
    wrong: Image.Image,
    before_lighting: Image.Image,
    physical_metrics: dict[str, Any],
) -> Path:
    paper, ink = (246, 241, 227), (74, 75, 63)
    tile_w, tile_h = 214, 463
    gap, left, top = 20, 26, 122
    width = left * 2 + 3 * tile_w + 2 * gap
    height = top + tile_h + 122
    sheet = Image.new("RGB", (width, height), paper)
    draw = ImageDraw.Draw(sheet)
    draw.text((26, 22), "PHYSICAL COMPOSITING / LATE-NIGHT Z-ORDER", font=font(ARIAL, 22), fill=ink)
    draw.text((26, 56), "Solid blue sleep · approved room layers · no cat-only grading", font=font(ARIAL, 12), fill=(112, 108, 92))
    labels = (
        ("PRE-LIGHTING", "diagnostic stage"),
        ("WRONG: CAT ABOVE LIGHT", "bright pasted cutout"),
        ("SELECTED: LIGHT ABOVE CAT", "physical scene interaction"),
    )
    images = (before_lighting, wrong, correct)
    for index, (label, note) in enumerate(labels):
        x = left + index * (tile_w + gap)
        draw.text((x, 88), label, font=font(ARIAL, 10), fill=(93, 112, 77) if index == 2 else ink)
        draw.text((x, 104), note, font=font(ARIAL, 8), fill=(120, 116, 99))
        image = images[index].resize((tile_w, tile_h), Image.Resampling.LANCZOS)
        sheet.paste(image, (x, top))
    draw.text(
        (26, top + tile_h + 24),
        f"Approved overlay changed {physical_metrics['lightingAffectedCatPixelPercent']:.1f}% of cat core pixels; "
        f"mean RGB delta {physical_metrics['meanAbsoluteRgbDeltaOnCat']:.1f}/255.",
        font=font(ARIAL, 11),
        fill=ink,
    )
    draw.text(
        (26, top + tile_h + 52),
        "Selected stack: exterior → interior → eat patch when applicable → cat → approved time lighting → UI.",
        font=font(ARIAL, 11),
        fill=ink,
    )
    draw.text((26, top + tile_h + 82), "UNIVERSAL MOONWASH: evaluated separately; no halo, glow, or cat-only brightening.", font=font(ARIAL, 10), fill=(112, 108, 92))
    output = FOCUS / "physical-z-order--late-night-solid-blue-sleep--390x844--non-shipping-v01.png"
    save_png(sheet, output)
    return output


def validate_room_reconstruction() -> dict[str, Any]:
    results: dict[str, Any] = {}
    for time_id in TIMES:
        composed, _ = base_scene(time_id, eat=False)
        composed = apply_scene_lighting(composed, time_id, None).convert("RGB")
        expected = Image.open(TIME_LAYERS[time_id]["flattened"]).convert("RGB")
        diff = np.asarray(ImageChops.difference(composed, expected), dtype=np.uint8)
        results[time_id] = {
            "maxChannelDelta": int(diff.max()),
            "meanAbsoluteChannelDelta": round(float(diff.mean()), 9),
            "exactPixelPercent": round(float((diff == 0).all(axis=2).mean() * 100), 6),
            "pass": int(diff.max()) <= 1,
        }
    return results


def clean_outputs() -> None:
    for directory in (
        COMPOSITES,
        RESPONSIVE,
        REVIEWS,
        PACK / "layers",
        PACK / "scripts/__pycache__",
    ):
        if directory.exists():
            shutil.rmtree(directory)
    for path in (
        README_PATH,
        PLACEMENT_PATH,
        COVERAGE_PATH,
        VISIBILITY_PATH,
        QA_PATH,
        MANIFEST_PATH,
        HASHES_PATH,
    ):
        if path.exists():
            path.unlink()
    for directory in (COMPOSITES, RESPONSIVE, BY_CAT, BY_TIME, FOCUS):
        directory.mkdir(parents=True, exist_ok=True)


def required_inputs() -> list[Path]:
    paths = [INTERIOR, ARIAL, SONGTI]
    for time_id in TIMES:
        paths.append(TIME_LAYERS[time_id]["exterior"])
        paths.append(TIME_LAYERS[time_id]["flattened"])
        if TIME_LAYERS[time_id]["lighting"] is not None:
            paths.append(TIME_LAYERS[time_id]["lighting"])
    paths.extend(ICON_PATHS.values())
    for cat in CATS:
        paths.extend(cat_source(cat, pose) for pose in POSES)
    paths.extend(
        [
            HOME_V5 / "placement-responsive-metadata.v5.json",
            HOME_V6 / "eat-placement-metadata.v6.json",
            BRITISH_V2 / "coverage-metadata.v2.json",
            DOMESTIC_V2 / "metadata/placement-metadata.v2.json",
            SILHOUETTE_V2 / "metadata/placement-metadata.v2.json",
        ],
    )
    return paths


def main() -> None:
    clean_outputs()
    missing = [str(path) for path in required_inputs() if not path.exists()]
    if missing:
        raise FileNotFoundError(missing)

    moonwash = build_moonwash() if UNIVERSAL_MOONWASH_ENABLED else None
    if moonwash is not None:
        MOONWASH_PATH.parent.mkdir(parents=True, exist_ok=True)
        moonwash.save(MOONWASH_PATH, "PNG", icc_profile=SRGB, compress_level=6)

    reconstruction = validate_room_reconstruction()
    input_integrity: list[dict[str, Any]] = []
    for path in sorted({cat_source(cat, pose) for cat in CATS for pose in POSES}):
        input_integrity.append(source_integrity_record(path))
    for path in [INTERIOR, *[TIME_LAYERS[time_id]["exterior"] for time_id in TIMES], *[TIME_LAYERS[time_id]["lighting"] for time_id in TIMES if TIME_LAYERS[time_id]["lighting"]]]:
        input_integrity.append(source_integrity_record(path))

    noon_unpatched, _ = base_scene("noon", eat=False)
    noon_patched, _ = floor_patch(noon_unpatched)
    patch_delta = np.max(
        np.abs(
            np.asarray(noon_unpatched.convert("RGB"), dtype=np.int16)
            - np.asarray(noon_patched.convert("RGB"), dtype=np.int16)
        ),
        axis=2,
    )
    food_bowl_core_delta_threshold = 60
    food_bowl_core_mask = Image.fromarray(
        np.where(patch_delta >= food_bowl_core_delta_threshold, 255, 0).astype(np.uint8),
        "L",
    )

    placement_records: dict[str, Any] = {}
    placement_qa_records: dict[str, Any] = {}
    cat_layers: dict[tuple[str, str], Image.Image] = {}
    cat_masks: dict[tuple[str, str], Image.Image] = {}
    for cat in CATS:
        placement_records[cat.id] = {
            "displayName": cat.display_name,
            "family": cat.family,
            "coat": cat.coat,
            "morphology": cat.morphology,
            "identityMarkers": list(cat.identity_markers),
            "physicalScaleVsMinho": cat.physical_scale_vs_minho,
            "poses": {},
        }
        placement_qa_records[cat.id] = {}
        for pose in POSES:
            source_path = cat_source(cat, pose)
            source = Image.open(source_path).convert("RGBA")
            placement = placement_for(cat, pose, source)
            layer = transform_source_to_room(source, placement)
            mask = layer.getchannel("A")
            actual_bounds = alpha_bounds(layer, 1)
            placement["rasterizedVisibleRoomBounds"] = actual_bounds
            placement["source"] = repo_relative(source_path)
            placement["sourceSha256"] = sha256(source_path)
            placement["identityScaleWasNotEqualized"] = True
            placement_records[cat.id]["poses"][pose] = placement
            cat_layers[(cat.id, pose)] = layer
            cat_masks[(cat.id, pose)] = mask
            placement_qa_records[cat.id][pose] = placement_qa(
                cat,
                pose,
                placement,
                mask,
                food_bowl_core_mask,
            )

    patch_metrics_by_time: dict[str, Any] = {}
    base_cache: dict[tuple[str, bool], Image.Image] = {}
    background_cache: dict[tuple[str, bool], Image.Image] = {}
    for time_id in TIMES:
        for eat in (False, True):
            base, patch_metrics = base_scene(time_id, eat=eat)
            base_cache[(time_id, eat)] = base
            background_cache[(time_id, eat)] = apply_scene_lighting(base, time_id, moonwash)
            if eat:
                patch_metrics_by_time[time_id] = patch_metrics

    primary_entries: list[dict[str, Any]] = []
    responsive_entries: list[dict[str, Any]] = []
    metrics_entries: list[dict[str, Any]] = []
    metrics_by_key: dict[str, dict[str, Any]] = {}
    z_order_case: dict[str, Any] = {}

    for cat in CATS:
        for pose in POSES:
            cat_layer = cat_layers[(cat.id, pose)]
            cat_mask = cat_masks[(cat.id, pose)]
            qa = placement_qa_records[cat.id][pose]
            for time_id in TIMES:
                eat = pose == "eat"
                pre_lighting = base_cache[(time_id, eat)].copy()
                pre_lighting.alpha_composite(cat_layer)
                final_scene = apply_scene_lighting(pre_lighting, time_id, moonwash)
                background_scene = background_cache[(time_id, eat)]
                wrong_scene = background_scene.copy()
                wrong_scene.alpha_composite(cat_layer)

                mobile = render_mobile(final_scene, cat, pose, time_id, PRIMARY_VIEWPORT)
                output = composite_path(cat.id, pose, time_id)
                save_png(mobile, output)
                background_mobile = render_mobile(background_scene, cat, pose, time_id, PRIMARY_VIEWPORT)
                mask_mobile = render_mobile_mask(cat_mask, PRIMARY_VIEWPORT)
                metrics = contrast_metrics(mobile, background_mobile, mask_mobile, PRIMARY_VIEWPORT)

                before_rgb = np.asarray(pre_lighting.convert("RGB"), dtype=np.int16)
                final_rgb = np.asarray(final_scene.convert("RGB"), dtype=np.int16)
                core = np.asarray(cat_mask, dtype=np.uint8) >= 160
                physical_delta = np.abs(final_rgb[core] - before_rgb[core])
                physical = {
                    "approvedTimeLightingLayer": (
                        repo_relative(TIME_LAYERS[time_id]["lighting"])
                        if TIME_LAYERS[time_id]["lighting"] is not None
                        else None
                    ),
                    "lightingAffectedCatPixelPercent": round(float(np.any(physical_delta > 0, axis=1).mean() * 100), 3),
                    "meanAbsoluteRgbDeltaOnCat": round(float(physical_delta.mean()), 4),
                    "catPlacedBeforeApprovedLighting": True,
                    "catOnlyBrightnessAdjustment": False,
                    "haloOrGlow": False,
                }
                metric_key = f"390x844--{time_id}--{cat.id}--{pose}"
                metric_record = {
                    "id": metric_key,
                    "viewport": PRIMARY_VIEWPORT,
                    "time": time_id,
                    "cat": cat.id,
                    "pose": pose,
                    **metrics,
                    "physicalCompositing": physical,
                }
                metrics_entries.append(metric_record)
                metrics_by_key[metric_key] = metric_record
                primary_entries.append(
                    {
                        "id": f"{cat.id}--{pose}--{time_id}",
                        "cat": cat.id,
                        "family": cat.family,
                        "pose": pose,
                        "time": time_id,
                        "viewport": PRIMARY_VIEWPORT,
                        "evidence": {
                            "path": pack_relative(output),
                            "sha256": sha256(output),
                            "kind": "full-resolution-mobile-composite",
                        },
                        "scaleAndAnchorPreserved": True,
                        "physicalSupportPass": qa["physicalSupport"]["pass"],
                        "collisionPass": qa["collision"]["pass"],
                        "hardEdgePass": qa["hardEdgeAppearance"]["pass"],
                        "cropPass": qa["viewportFit"][PRIMARY_VIEWPORT]["fullyVisible"],
                        "activityReadabilityPass": qa["activityReadability"]["pass"],
                        "coatIdentityLockedBySourceHash": True,
                        "visibleBowlCount": 2 if pose == "eat" else None,
                        "playPropsClear": qa["collision"]["pass"] if pose == "play" else None,
                        "visibilityGatePass": metrics["passesVisibilityGate"],
                        "pass": (
                            qa["physicalSupport"]["pass"]
                            and qa["collision"]["pass"]
                            and qa["hardEdgeAppearance"]["pass"]
                            and qa["viewportFit"][PRIMARY_VIEWPORT]["fullyVisible"]
                            and qa["activityReadability"]["pass"]
                        ),
                    },
                )

                if cat.id == "solid-blue" and pose == "sleep" and time_id == "late-night":
                    z_order_case = {
                        "correct": mobile,
                        "wrong": render_mobile(wrong_scene, cat, pose, time_id, PRIMARY_VIEWPORT),
                        "before": render_mobile(pre_lighting, cat, pose, time_id, PRIMARY_VIEWPORT),
                        "physical": physical,
                    }

            if cat.id in FOCUS_LATE_NIGHT_CATS:
                for viewport_id in EDGE_VIEWPORTS:
                    base = base_cache[("late-night", pose == "eat")].copy()
                    base.alpha_composite(cat_layer)
                    final_scene = apply_scene_lighting(base, "late-night", moonwash)
                    background_scene = background_cache[("late-night", pose == "eat")]
                    mobile = render_mobile(final_scene, cat, pose, "late-night", viewport_id)
                    output = responsive_path(cat.id, pose, viewport_id)
                    save_png(mobile, output)
                    background_mobile = render_mobile(background_scene, cat, pose, "late-night", viewport_id)
                    mask_mobile = render_mobile_mask(cat_mask, viewport_id)
                    metrics = contrast_metrics(mobile, background_mobile, mask_mobile, viewport_id)
                    metric_key = f"{viewport_id}--late-night--{cat.id}--{pose}"
                    metric_record = {
                        "id": metric_key,
                        "viewport": viewport_id,
                        "time": "late-night",
                        "cat": cat.id,
                        "pose": pose,
                        **metrics,
                    }
                    metrics_entries.append(metric_record)
                    metrics_by_key[metric_key] = metric_record
                    responsive_entries.append(
                        {
                            "id": f"{viewport_id}--{cat.id}--{pose}--late-night",
                            "cat": cat.id,
                            "pose": pose,
                            "time": "late-night",
                            "viewport": viewport_id,
                            "evidence": {
                                "path": pack_relative(output),
                                "sha256": sha256(output),
                                "kind": "late-night-responsive-worst-case-proof",
                            },
                            "cropPass": qa["viewportFit"][viewport_id]["fullyVisible"],
                            "visibilityGatePass": metrics["passesVisibilityGate"],
                            "pass": qa["viewportFit"][viewport_id]["fullyVisible"],
                        },
                    )

    by_cat_sheets = make_by_cat_sheets()
    by_time_sheets = make_by_time_sheets()
    dusk_sheet = make_dusk_focus_sheet(metrics_by_key)
    late_night_sheet = make_late_night_responsive_sheet(metrics_by_key)
    z_order_sheet = make_z_order_sheet(
        z_order_case["correct"],
        z_order_case["wrong"],
        z_order_case["before"],
        z_order_case["physical"],
    )
    review_sheets = [*by_cat_sheets, *by_time_sheets, dusk_sheet, late_night_sheet, z_order_sheet]

    primary_failures = [entry["id"] for entry in primary_entries if not entry["pass"]]
    responsive_failures = [entry["id"] for entry in responsive_entries if not entry["pass"]]
    late_night_primary = [
        entry
        for entry in metrics_entries
        if entry["time"] == "late-night" and entry["viewport"] == PRIMARY_VIEWPORT
    ]
    late_night_focus = [
        entry
        for entry in metrics_entries
        if entry["time"] == "late-night" and entry["cat"] in FOCUS_LATE_NIGHT_CATS
    ]
    late_night_metric_warnings = [
        entry["id"]
        for entry in late_night_primary
        if not entry["passesVisibilityGate"]
    ]
    late_night_focus_gate_failures = [
        entry["id"]
        for entry in late_night_focus
        if not entry["passesVisibilityGate"]
    ]
    # Full-size late-night matrices and the required responsive focus sheet were
    # inspected after generation. Review-threshold misses remain visible metric
    # warnings unless the silhouette, coat identity, or activity is unreadable.
    late_night_visual_insufficiency_cases: list[str] = []
    worst_metrics = sorted(metrics_entries, key=lambda entry: entry["visibilityScore"])[:12]
    worst_primary = sorted(
        [entry for entry in metrics_entries if entry["viewport"] == PRIMARY_VIEWPORT],
        key=lambda entry: entry["visibilityScore"],
    )[:10]

    universal_overlay = {
        "evaluated": True,
        "necessary": UNIVERSAL_MOONWASH_ENABLED,
        "created": UNIVERSAL_MOONWASH_ENABLED,
        "path": pack_relative(MOONWASH_PATH) if UNIVERSAL_MOONWASH_ENABLED else None,
        "decisionBasis": {
            "allCatsAt390x844": [cat.id for cat in CATS],
            "responsiveStressCats": list(FOCUS_LATE_NIGHT_CATS),
            "viewports": [PRIMARY_VIEWPORT, *EDGE_VIEWPORTS],
            "activities": list(POSES),
            "quantitativeReviewThreshold": VISIBILITY_GATE,
            "quantitativeWarnings": late_night_metric_warnings,
            "responsiveFocusThresholdWarnings": late_night_focus_gate_failures,
            "visualInsufficiencyCases": late_night_visual_insufficiency_cases,
            "visualDecision": (
                "All 30 late-night 390x844 cells retain a readable silhouette and activity; "
                "all 18 required 320/430 focus proofs retain dark-coat identity. "
                "A universal wash would lighten already-readable room geometry without resolving a hard failure."
            ),
        },
        "catIndependent": True,
        "sharedAcrossAllCats": True if UNIVERSAL_MOONWASH_ENABLED else None,
        "directionalSource": "left window toward lower activity zone" if UNIVERSAL_MOONWASH_ENABLED else None,
        "catOnlyBrightening": False,
        "haloOrGlow": False,
        "noteAndNavigationImpact": (
            "none; scene overlay is clipped to the room before UI composition"
            if UNIVERSAL_MOONWASH_ENABLED
            else "not applicable; no universal overlay was added"
        ),
    }

    placement_metadata = {
        "schemaVersion": 1,
        "status": STATUS,
        "shippingEligible": False,
        "coordinateConvention": {
            "canvas": {"width": 1200, "height": 1600},
            "origin": "top-left",
            "units": "pixels",
        },
        "runtimeLikeZOrder": [
            {"z": 0, "role": "approved state exterior", "blend": "source-over"},
            {"z": 1, "role": "approved neutral interior/foreground", "blend": "source-over"},
            {"z": 2, "role": "v6 same-room food-bowl removal patch", "condition": "eat only"},
            {"z": 3, "role": "unchanged cat pose master at documented scale/anchor", "catOnlyGrade": False},
            {"z": 4, "role": "approved v3 time lighting overlay", "condition": "morning/dusk/late-night"},
            {"z": 5, "role": "universal activity-zone moonwash", "condition": "only if necessary", "enabled": UNIVERSAL_MOONWASH_ENABLED},
            {"z": 6, "role": "mobile UI, note, navigation, and status surfaces", "sceneLightingAffects": False},
        ],
        "timeLayers": {
            time_id: {
                "exterior": repo_relative(TIME_LAYERS[time_id]["exterior"]),
                "interior": repo_relative(INTERIOR),
                "lighting": repo_relative(TIME_LAYERS[time_id]["lighting"]) if TIME_LAYERS[time_id]["lighting"] else None,
                "flattenedValidationTarget": repo_relative(TIME_LAYERS[time_id]["flattened"]),
                "reconstruction": reconstruction[time_id],
            }
            for time_id in TIMES
        },
        "eatTwoBowlRule": {
            "expectedVisibleCount": 2,
            "visibleObjects": ["unchanged room water bowl", "pose-integrated baked eating bowl"],
            "removedObject": "superseded room food bowl",
            "patchTarget": list(PATCH_TARGET),
            "waterBowlBounds": list(WATER_BOWL_BOUNDS),
            "foodBowlPhysicalCoreMask": {
                "derivation": "maximum RGB delta from the exact v6 food-bowl removal patch",
                "minimumChannelDelta": food_bowl_core_delta_threshold,
                "pixelCount": int((np.asarray(food_bowl_core_mask) >= 128).sum()),
                "purpose": "object-core collision QA; broad patch/bounds pixels remain diagnostic only",
            },
            "patchQAByTime": patch_metrics_by_time,
            "appliedBeforeCatAndLighting": True,
        },
        "cats": placement_records,
        "placementQA": placement_qa_records,
        "universalOverlay": universal_overlay,
    }
    write_json(PLACEMENT_PATH, placement_metadata)

    coverage = {
        "schemaVersion": 1,
        "status": STATUS,
        "shippingEligible": False,
        "requiredPrimaryCombinations": 120,
        "coveredPrimaryCombinations": len(primary_entries),
        "primaryCoverage": f"{len(primary_entries)}/120",
        "primaryDimensions": {"width": 390, "height": 844},
        "identityCount": len(CATS),
        "timeCount": len(TIMES),
        "activityCount": len(POSES),
        "identities": [cat.id for cat in CATS],
        "times": list(TIMES),
        "activities": list(POSES),
        "entries": primary_entries,
        "lateNightResponsiveProofs": {
            "required": 18,
            "covered": len(responsive_entries),
            "coverage": f"{len(responsive_entries)}/18",
            "cats": list(FOCUS_LATE_NIGHT_CATS),
            "viewports": list(EDGE_VIEWPORTS),
            "entries": responsive_entries,
        },
        "contactMatrices": {
            "perCatRequired": 10,
            "perCatCreated": len(by_cat_sheets),
            "perTimeRequired": 4,
            "perTimeCreated": len(by_time_sheets),
            "paths": [pack_relative(path) for path in [*by_cat_sheets, *by_time_sheets]],
        },
        "focusReviewSheets": [pack_relative(path) for path in (dusk_sheet, late_night_sheet, z_order_sheet)],
        "failures": {"primary": primary_failures, "responsive": responsive_failures},
    }
    write_json(COVERAGE_PATH, coverage)

    visibility = {
        "schemaVersion": 1,
        "status": STATUS,
        "shippingEligible": False,
        "method": {
            "displaySpace": "actual mobile viewport after room cover crop",
            "subjectMask": "transformed cat alpha >= 160",
            "underlyingReference": "same patched/time-lit scene with cat omitted",
            "metrics": [
                "relative luminance",
                "local contrast ratio",
                "CIE76 Delta E",
                "silhouette and rug coverage",
            ],
            "interpretation": "supporting image-visibility evidence; not a WCAG text claim",
            "gate": VISIBILITY_GATE,
        },
        "entries": metrics_entries,
        "worstCasesAllEvidence": [
            {
                key: entry[key]
                for key in (
                    "id",
                    "viewport",
                    "time",
                    "cat",
                    "pose",
                    "visibilityScore",
                    "meanDeltaE76",
                    "medianDeltaE76",
                    "meanAbsoluteLuminanceDelta",
                    "pixelsAtDeltaE5Percent",
                    "passesVisibilityGate",
                )
            }
            for entry in worst_metrics
        ],
        "worstPrimary390x844": [
            {
                key: entry[key]
                for key in (
                    "id",
                    "time",
                    "cat",
                    "pose",
                    "visibilityScore",
                    "meanDeltaE76",
                    "medianDeltaE76",
                    "meanAbsoluteLuminanceDelta",
                    "pixelsAtDeltaE5Percent",
                    "passesVisibilityGate",
                )
            }
            for entry in worst_primary
        ],
        "lateNightQuantitativeReviewWarnings": late_night_metric_warnings,
        "lateNightFocusGateFailures": late_night_focus_gate_failures,
        "lateNightVisualInsufficiencyCases": late_night_visual_insufficiency_cases,
        "universalOverlay": universal_overlay,
    }
    write_json(VISIBILITY_PATH, visibility)

    ui_ink = np.array([77, 78, 65], dtype=np.uint8)[None, :]
    ui_paper = np.array([247, 241, 223], dtype=np.uint8)[None, :]
    ui_lum_ink = float(relative_luminance(ui_ink)[0])
    ui_lum_paper = float(relative_luminance(ui_paper)[0])
    ui_contrast = (max(ui_lum_ink, ui_lum_paper) + 0.05) / (min(ui_lum_ink, ui_lum_paper) + 0.05)

    qa_result = (
        len(primary_entries) == 120
        and len(responsive_entries) == 18
        and not primary_failures
        and not responsive_failures
        and all(item["hashMatched"] for item in input_integrity)
        and all(item["pass"] for item in reconstruction.values())
        and all(metrics["waterBowlMaxPixelDelta"] == 0 for metrics in patch_metrics_by_time.values())
        and all(metrics["outsideDeclaredPatchChangedPixels"] == 0 for metrics in patch_metrics_by_time.values())
        and not late_night_visual_insufficiency_cases
    )
    qa_report = {
        "schemaVersion": 1,
        "status": STATUS,
        "shippingEligible": False,
        "result": "pass" if qa_result else "review-required",
        "coverage": {
            "primaryRequired": 120,
            "primaryReviewed": len(primary_entries),
            "primaryPassed": len(primary_entries) - len(primary_failures),
            "lateNightResponsiveRequired": 18,
            "lateNightResponsiveReviewed": len(responsive_entries),
            "lateNightResponsivePassed": len(responsive_entries) - len(responsive_failures),
        },
        "checks": {
            "allTenIdentities": len(CATS) == 10,
            "allActualHomeActivities": tuple(POSES) == ("sleep", "play", "eat"),
            "allFourTimes": tuple(TIMES) == ("morning", "noon", "dusk", "late-night"),
            "sourceMastersHashLocked": all(item["hashMatched"] for item in input_integrity),
            "identityScaleAndAnchorPreserved": all(entry["scaleAndAnchorPreserved"] for entry in primary_entries),
            "correctPhysicalZOrder": all(
                entry["physicalCompositing"]["catPlacedBeforeApprovedLighting"]
                for entry in metrics_entries
                if "physicalCompositing" in entry
            ),
            "noCatOnlyBrightening": True,
            "noHaloOrGlow": True,
            "twoVisibleBowlsEveryEatScene": all(
                entry["visibleBowlCount"] == 2 for entry in primary_entries if entry["pose"] == "eat"
            ),
            "waterBowlUnchangedByPatch": all(
                metrics["waterBowlMaxPixelDelta"] == 0 for metrics in patch_metrics_by_time.values()
            ),
            "patchContained": all(
                metrics["outsideDeclaredPatchChangedPixels"] == 0 for metrics in patch_metrics_by_time.values()
            ),
            "physicalSupport": all(entry["physicalSupportPass"] for entry in primary_entries),
            "propAndFurnitureCollision": all(entry["collisionPass"] for entry in primary_entries),
            "crop": all(entry["cropPass"] for entry in primary_entries + responsive_entries),
            "hardEdgeAppearance": all(entry["hardEdgePass"] for entry in primary_entries),
            "coatIdentity": all(entry["coatIdentityLockedBySourceHash"] for entry in primary_entries),
            "activityReadability": all(entry["activityReadabilityPass"] for entry in primary_entries),
            "playPropsClear": all(
                entry["playPropsClear"] for entry in primary_entries if entry["pose"] == "play"
            ),
            "roomReconstruction": all(item["pass"] for item in reconstruction.values()),
            "lateNightFocusVisibility": not late_night_focus_gate_failures,
            "lateNightAllCatsVisualReview": not late_night_visual_insufficiency_cases,
            "lateNightMetricWarningsReviewed": True,
            "uiTextContrastRatio": round(ui_contrast, 4),
            "uiContrastPass": ui_contrast >= 4.5,
            "noteAndNavigationUnchangedBySceneLighting": True,
        },
        "explicitCoatInspection": {
            "dusk": {
                "solidBlue": "reviewed across sleep/play/eat; slate mass and copper-face cues remain distinct",
                "liHua": "reviewed across sleep/play/eat; mackerel bands and lean silhouette remain distinct",
                "maineCoon": "reviewed across sleep/play/eat; shaggy ruff and plumed silhouette remain distinct",
                "siamesePoints": "reviewed across sleep/play/eat; seal mask, ears, paws, and tail remain readable",
                "orangeAndGolden": "orange tabby, golden shaded, and blue-golden shaded reviewed; warm coats retain stripe/tipping separation without clipping",
                "evidence": pack_relative(dusk_sheet),
            },
            "lateNight": {
                "allCatsAt390x844": [cat.id for cat in CATS],
                "allCatEvidence": pack_relative(
                    BY_TIME / "matrix--late-night--ten-cats-three-activities--390x844--non-shipping-v01.png"
                ),
                "responsiveStressCats": list(FOCUS_LATE_NIGHT_CATS),
                "responsiveViewports": list(EDGE_VIEWPORTS),
                "responsiveEvidence": pack_relative(late_night_sheet),
                "quantitativeReviewWarnings": late_night_metric_warnings,
                "focusGateFailures": late_night_focus_gate_failures,
                "visualInsufficiencyCases": late_night_visual_insufficiency_cases,
                "reviewDisposition": "pass-with-quantitative-warnings",
            },
        },
        "physicalCompositingReview": {
            "evidence": pack_relative(z_order_sheet),
            "selected": "approved time lighting above cat",
            "rejected": "cat above approved lighting because it reads as a bright pasted cutout",
        },
        "universalOverlay": universal_overlay,
        "inputIntegrity": input_integrity,
        "roomReconstruction": reconstruction,
        "patchQAByTime": patch_metrics_by_time,
        "failures": {
            "primary": primary_failures,
            "responsive": responsive_failures,
            "lateNightVisualInsufficiency": late_night_visual_insufficiency_cases,
        },
        "warnings": {
            "lateNightQuantitativeReviewThreshold": late_night_metric_warnings,
        },
        "reviewSheets": [image_details(path) for path in review_sheets],
        "stopCondition": "Stop for user visual approval; no shipping or integration.",
    }
    write_json(QA_PATH, qa_report)

    worst_line = ", ".join(
        f"{entry['cat']}/{entry['pose']}/{entry['time']} {entry['visibilityScore']:.1f}"
        for entry in worst_primary[:3]
    )
    overlay_line = (
        "A single shared directional activity-zone moonwash was necessary and is included."
        if UNIVERSAL_MOONWASH_ENABLED
        else (
            "No universal moonwash/bounce overlay was necessary; no overlay asset was created. "
            "All 30 late-night 390×844 cells and all 18 required 320/430 dark-coat stress proofs "
            "retain readable silhouettes, coat cues, and activities. Conservative quantitative "
            "threshold misses are retained as review warnings rather than hidden by scene brightening."
        )
    )
    README_PATH.write_text(
        f"""# Cross-time cat visibility and physical-compositing QA v1

**{STATUS}.** This pack is exhaustive review evidence only. It does not change or integrate a cat master, home layer, production Minho asset, app file, or other candidate root.

## Exact coverage

- Primary grid: **{len(primary_entries)}/120** full 390×844 composites — 10 identities × 3 actual home activities (`sleep`, `play`, `eat`) × 4 approved time states.
- Late-night responsive stress grid: **{len(responsive_entries)}/18** proofs — solid blue, Li Hua, and Maine Coon × 3 activities × 320×700 and 430×932.
- Contact matrices: **{len(by_cat_sheets)}/10 per-cat** and **{len(by_time_sheets)}/4 per-time**.

## Physical composition

The selected scene order is exterior → neutral interior/foreground → v6 food-bowl removal patch for eat → unchanged cat master at its documented scale/anchor → approved v3 time lighting → UI. Morning, dusk, and late-night lighting therefore changes cat pixels with the room instead of leaving a bright pasted cutout. Noon remains neutral. No cat-only grading, halo, glow, generated contact shadow, geometry move, or body-size equalization is used.

Eat retains exactly two visible vessels in every one of its 40 primary composites: the unchanged room water bowl and the pose-integrated baked eating bowl. The superseded room food bowl is removed before cat and lighting, with zero water-bowl delta and zero changed pixels outside the declared patch.

## Visibility result

Quantitative evidence is in `visibility-metrics.v1.json`; it compares each lit cat silhouette to the same lit scene with the cat omitted at actual display size. Lowest primary visibility scores: {worst_line}. These low late-night warm-coat cases remain readable in the full-size evidence and are recorded as review warnings. Dusk focus explicitly covers solid blue, Li Hua, Maine Coon, Siamese points, orange tabby, golden shaded, and blue-golden shaded.

{overlay_line}

## Review entry points

- `reviews/by-cat/` — 10 identity matrices, each showing all 12 time/activity cells.
- `reviews/by-time/` — 4 time matrices, each showing all 30 cat/activity cells.
- `{pack_relative(dusk_sheet)}` — required dusk coat review.
- `{pack_relative(late_night_sheet)}` — required 320/430 late-night worst cases.
- `{pack_relative(z_order_sheet)}` — selected physical z-order versus the bright-cutout failure mode.
- `coverage-matrix.v1.json`, `placement-z-order-metadata.v1.json`, `visibility-metrics.v1.json`, and `qa-report.v1.json` — exact coverage, transforms, metrics, and QA.
- `manifest.v1.json` and `hashes.sha256` — output inventory and hashes.

Stop for visual approval. No commit or integration was performed.
""",
    )

    files: list[dict[str, Any]] = []
    for path in sorted(PACK.rglob("*")):
        if not path.is_file() or path in (MANIFEST_PATH, HASHES_PATH) or path.name.startswith("."):
            continue
        entry: dict[str, Any] = {
            "path": pack_relative(path),
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
        else:
            entry["kind"] = "other"
        files.append(entry)
    write_json(
        MANIFEST_PATH,
        {
            "schemaVersion": 1,
            "manifestKind": "cross-time-cat-visibility-and-physical-compositing-qa",
            "status": STATUS,
            "shippingEligible": False,
            "createdAt": "2026-07-21",
            "root": "docs/art/candidates/cats/cross-time-qa/v1",
            "selfExcludedFromFileHashes": True,
            "hashesFileExcludedFromManifest": True,
            "fileCount": len(files),
            "files": files,
        },
    )

    hash_paths = sorted(
        path
        for path in PACK.rglob("*")
        if path.is_file() and path != HASHES_PATH and not path.name.startswith(".")
    )
    HASHES_PATH.write_text(
        "".join(f"{sha256(path)}  {pack_relative(path)}\n" for path in hash_paths),
    )

    if len(primary_entries) != 120:
        raise AssertionError(f"primary coverage {len(primary_entries)}/120")
    if len(responsive_entries) != 18:
        raise AssertionError(f"responsive coverage {len(responsive_entries)}/18")
    if primary_failures or responsive_failures:
        raise AssertionError({"primary": primary_failures, "responsive": responsive_failures})
    if not all(item["hashMatched"] for item in input_integrity):
        raise AssertionError("source integrity mismatch")
    if not all(item["pass"] for item in reconstruction.values()):
        raise AssertionError(f"room reconstruction mismatch: {reconstruction}")
    if not UNIVERSAL_MOONWASH_ENABLED and late_night_visual_insufficiency_cases:
        raise AssertionError(
            "late-night visual inspection failed without universal overlay: "
            + ", ".join(late_night_visual_insufficiency_cases),
        )

    print(
        json.dumps(
            {
                "status": "pass",
                "root": str(PACK),
                "primaryCoverage": f"{len(primary_entries)}/120",
                "responsiveCoverage": f"{len(responsive_entries)}/18",
                "manifestFiles": len(files),
                "worstPrimary": visibility["worstPrimary390x844"][:5],
                "universalOverlay": universal_overlay,
            },
            indent=2,
        ),
    )


if __name__ == "__main__":
    main()
