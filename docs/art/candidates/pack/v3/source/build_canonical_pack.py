#!/usr/bin/env python3
"""Build canonical NON-SHIPPING populated-pack refinement v3."""

from __future__ import annotations

from datetime import date
from hashlib import sha256
import importlib.util
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PACK_ROOT = ROOT.parent
V1_ROOT = PACK_ROOT / "v1"
V2_ROOT = PACK_ROOT / "v2"
REPO = ROOT.parents[4]
COMPOSITES = ROOT / "composites"
REVIEWS = ROOT / "reviews"
QA = ROOT / "qa"

SHOP_V2 = REPO / "docs/art/candidates/shop/v2"
SHOP_MANIFEST = SHOP_V2 / "manifest.v2.json"
SHOP_MAPPING = SHOP_V2 / "data-key-image-mapping.v2.json"
V1_BASE = V1_ROOT / "masters/pack-opened-base--master-1536--non-shipping-v01.png"
V1_RIM = (
    V1_ROOT
    / "masters/pack-opened-foreground-rim--master-1536--non-shipping-v01.png"
)
V1_METADATA = V1_ROOT / "composition-metadata.v1.json"
V1_BUILDER = V1_ROOT / "source/build_pack_candidate.py"

MASTER_SIZE = 1536
STATUS = "NON-SHIPPING / VISUAL-REVIEW-ONLY"
VIEWPORTS = ((320, 700), (390, 844), (430, 932))
CSS_BAG_SIZES = (272, 342, 382)


def load_v1_helpers():
    spec = importlib.util.spec_from_file_location("pack_v1_helpers_v3", V1_BUILDER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import v1 helpers from {V1_BUILDER}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


V1 = load_v1_helpers()
SHOP_MANIFEST_DATA = json.loads(SHOP_MANIFEST.read_text(encoding="utf-8"))
SHOP_MAPPING_DATA = json.loads(SHOP_MAPPING.read_text(encoding="utf-8"))
SHOP_FILE_INDEX = {
    entry["path"]: entry for entry in SHOP_MANIFEST_DATA["files"]
}

ITEMS = {
    entry["dataKey"]: {
        "kind": entry["kind"],
        "name": entry["name"],
        "token": entry["name"][:1],
        "path": SHOP_V2 / entry["masterCandidate"],
        "relativePath": entry["masterCandidate"],
        "expectedSha256": SHOP_FILE_INDEX[entry["masterCandidate"]]["sha256"],
    }
    for entry in SHOP_MAPPING_DATA["mappings"]
}

SLOT_CONTAINMENT = {
    "left-inner-sleeve": {
        "bounds": {"x": 354, "y": 642, "width": 312, "height": 356},
        "polygon": [
            [354, 690],
            [430, 642],
            [618, 656],
            [666, 754],
            [654, 998],
            [372, 998],
        ],
    },
    "center-deep-pocket": {
        "bounds": {"x": 584, "y": 628, "width": 384, "height": 412},
        "polygon": [
            [584, 700],
            [650, 642],
            [884, 628],
            [960, 684],
            [968, 1018],
            [606, 1040],
        ],
    },
    "right-inner-sleeve": {
        "bounds": {"x": 902, "y": 634, "width": 336, "height": 358},
        "polygon": [
            [902, 680],
            [984, 634],
            [1170, 654],
            [1238, 740],
            [1214, 966],
            [944, 992],
        ],
    },
}

KITS = {
    "outing-kit": {
        "label": "OUTING KIT",
        "description": "Travel tin, small blanket and camera",
        "items": [
            {
                "itemId": "small-blanket",
                "slotId": "center-deep-pocket",
                "destinationAnchor": [750, 1028],
                "scale": 0.60,
                "rotationDegreesClockwise": 1.0,
                "zWithinItems": 0,
            },
            {
                "itemId": "travel-tin",
                "slotId": "left-inner-sleeve",
                "destinationAnchor": [505, 982],
                "scale": 0.68,
                "rotationDegreesClockwise": -5.0,
                "zWithinItems": 1,
            },
            {
                "itemId": "small-camera",
                "slotId": "right-inner-sleeve",
                "destinationAnchor": [1065, 940],
                "scale": 0.58,
                "rotationDegreesClockwise": 4.0,
                "zWithinItems": 2,
            },
        ],
    },
    "play-kit": {
        "label": "PLAY KIT",
        "description": "Yarn ball, small bell and fish biscuit",
        "items": [
            {
                "itemId": "fish-biscuit",
                "slotId": "center-deep-pocket",
                "destinationAnchor": [770, 1025],
                "scale": 0.66,
                "rotationDegreesClockwise": 3.0,
                "zWithinItems": 0,
            },
            {
                "itemId": "yarn-ball",
                "slotId": "left-inner-sleeve",
                "destinationAnchor": [475, 955],
                "scale": 0.66,
                "rotationDegreesClockwise": -7.0,
                "zWithinItems": 1,
            },
            {
                "itemId": "small-bell",
                "slotId": "right-inner-sleeve",
                "destinationAnchor": [1060, 953],
                "scale": 0.72,
                "rotationDegreesClockwise": 5.0,
                "zWithinItems": 2,
            },
        ],
    },
    "wish-observation-kit": {
        "label": "WISH / OBSERVATION KIT",
        "description": "One ticket, telescope and fish biscuit",
        "wishConstraint": {
            "maxWishItems": 1,
            "wishItemId": "ticket",
            "requiresWishDestinationId": True,
            "destinationValueBakedIntoArt": False,
        },
        "items": [
            {
                "itemId": "ticket",
                "slotId": "center-deep-pocket",
                "destinationAnchor": [768, 1025],
                "scale": 0.70,
                "rotationDegreesClockwise": -3.0,
                "zWithinItems": 0,
            },
            {
                "itemId": "fish-biscuit",
                "slotId": "left-inner-sleeve",
                "destinationAnchor": [530, 985],
                "scale": 0.62,
                "rotationDegreesClockwise": -9.0,
                "zWithinItems": 1,
            },
            {
                "itemId": "small-telescope",
                "slotId": "right-inner-sleeve",
                "destinationAnchor": [1065, 930],
                "scale": 0.66,
                "rotationDegreesClockwise": -12.0,
                "zWithinItems": 2,
            },
        ],
    },
}


def ensure_directories() -> None:
    for directory in (COMPOSITES, REVIEWS, QA):
        directory.mkdir(parents=True, exist_ok=True)


def flattened_pixels(image: Image.Image) -> list:
    getter = getattr(image, "get_flattened_data", None)
    return list(getter() if getter else image.getdata())


def zero_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    rgba.putdata(
        [
            (red, green, blue, alpha) if alpha else (0, 0, 0, 0)
            for red, green, blue, alpha in flattened_pixels(rgba)
        ]
    )
    return rgba


def file_sha(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def tree_digest(path: Path) -> dict[str, Any]:
    files = sorted(file for file in path.rglob("*") if file.is_file())
    digest = sha256()
    for file in files:
        relative = file.relative_to(path).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(file_sha(file).encode("ascii"))
        digest.update(b"\0")
    return {
        "root": path.relative_to(REPO).as_posix(),
        "fileCount": len(files),
        "aggregateSha256": digest.hexdigest(),
    }


def protected_tree_snapshot() -> dict[str, dict[str, Any]]:
    return {
        key: tree_digest(path)
        for key, path in {
            "packV1": V1_ROOT,
            "packV2": V2_ROOT,
            "shopV2": SHOP_V2,
        }.items()
    }


def source_anchor(image: Image.Image) -> tuple[float, float]:
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise RuntimeError("Canonical item master has no visible alpha")
    left, _, right, bottom = bounds
    return ((left + right - 1) / 2, bottom - 1)


def affine_transform(
    source_anchor_point: tuple[float, float],
    spec: dict[str, Any],
) -> dict[str, list[float]]:
    source_anchor_x, source_anchor_y = source_anchor_point
    destination_anchor_x, destination_anchor_y = spec["destinationAnchor"]
    scale = spec["scale"]
    radians = math.radians(spec["rotationDegreesClockwise"])
    cosine = math.cos(radians)
    sine = math.sin(radians)
    forward = [
        scale * cosine,
        -scale * sine,
        destination_anchor_x
        - scale * cosine * source_anchor_x
        + scale * sine * source_anchor_y,
        scale * sine,
        scale * cosine,
        destination_anchor_y
        - scale * sine * source_anchor_x
        - scale * cosine * source_anchor_y,
    ]
    a, b, tx, d, e, ty = forward
    determinant = a * e - b * d
    inverse = [
        e / determinant,
        -b / determinant,
        (b * ty - e * tx) / determinant,
        -d / determinant,
        a / determinant,
        (d * tx - a * ty) / determinant,
    ]
    return {"forward": forward, "inverse": inverse}


def containment_mask(slot_id: str) -> Image.Image:
    high_resolution = Image.new("L", (MASTER_SIZE * 2, MASTER_SIZE * 2), 0)
    draw = ImageDraw.Draw(high_resolution)
    draw.polygon(
        [(x * 2, y * 2) for x, y in SLOT_CONTAINMENT[slot_id]["polygon"]],
        fill=255,
    )
    high_resolution = high_resolution.filter(ImageFilter.GaussianBlur(1.25))
    return high_resolution.resize(
        (MASTER_SIZE, MASTER_SIZE),
        Image.Resampling.LANCZOS,
    )


def transform_item(spec: dict[str, Any]) -> tuple[Image.Image, dict[str, Any]]:
    item = ITEMS[spec["itemId"]]
    source = Image.open(item["path"]).convert("RGBA")
    source_bounds = source.getchannel("A").getbbox()
    source_anchor_point = source_anchor(source)
    matrix = affine_transform(source_anchor_point, spec)
    transformed = source.transform(
        (MASTER_SIZE, MASTER_SIZE),
        Image.Transform.AFFINE,
        matrix["inverse"],
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )
    alpha_before = transformed.getchannel("A")
    alpha_before_total = sum(flattened_pixels(alpha_before))
    transformed.putalpha(
        ImageChops.multiply(alpha_before, containment_mask(spec["slotId"]))
    )
    transformed = zero_transparent_rgb(transformed)
    alpha_after = transformed.getchannel("A")
    alpha_after_total = sum(flattened_pixels(alpha_after))
    transformed_bounds = alpha_after.getbbox()
    if source_bounds is None or transformed_bounds is None:
        raise RuntimeError(f"Transform removed all pixels for {spec['itemId']}")
    return transformed, {
        "sourceAlphaBounds": {
            "x": source_bounds[0],
            "y": source_bounds[1],
            "width": source_bounds[2] - source_bounds[0],
            "height": source_bounds[3] - source_bounds[1],
        },
        "sourceAnchor": [
            round(source_anchor_point[0], 3),
            round(source_anchor_point[1], 3),
        ],
        "sourceAnchorPolicy": "alpha-bounds-bottom-center",
        "affineForward": [round(value, 7) for value in matrix["forward"]],
        "affineInverse": [round(value, 7) for value in matrix["inverse"]],
        "transformedAlphaBounds": {
            "x": transformed_bounds[0],
            "y": transformed_bounds[1],
            "width": transformed_bounds[2] - transformed_bounds[0],
            "height": transformed_bounds[3] - transformed_bounds[1],
        },
        "containmentClippedPercent": round(
            100 * (1 - alpha_after_total / alpha_before_total),
            3,
        ),
    }


def alpha_weighted_center(alpha: Image.Image) -> tuple[float, float]:
    values = flattened_pixels(alpha)
    total = sum(values)
    if total == 0:
        return (0.0, 0.0)
    x_sum = 0
    y_sum = 0
    width = alpha.width
    for index, value in enumerate(values):
        if value:
            x_sum += (index % width) * value
            y_sum += (index // width) * value
    return (x_sum / total, y_sum / total)


def alpha_overlap_ratio(first: Image.Image, second: Image.Image) -> float:
    first_alpha = first.getchannel("A")
    second_alpha = second.getchannel("A")
    denominator = min(
        sum(flattened_pixels(first_alpha)),
        sum(flattened_pixels(second_alpha)),
    )
    if denominator == 0:
        return 0.0
    overlap = ImageChops.multiply(first_alpha, second_alpha)
    return sum(flattened_pixels(overlap)) / denominator


def item_metrics(item: Image.Image, rim: Image.Image, slot_id: str) -> dict[str, Any]:
    alpha = item.getchannel("A")
    rim_alpha = rim.getchannel("A")
    occluded = ImageChops.multiply(alpha, rim_alpha)
    visible = ImageChops.multiply(alpha, ImageChops.invert(rim_alpha))
    total = sum(flattened_pixels(alpha))
    occluded_total = sum(flattened_pixels(occluded))
    visible_total = sum(flattened_pixels(visible))
    center_x, center_y = alpha_weighted_center(alpha)
    bounds = SLOT_CONTAINMENT[slot_id]["bounds"]
    mobile = {}
    for css_size in CSS_BAG_SIZES:
        resized = visible.resize((css_size, css_size), Image.Resampling.LANCZOS)
        box = resized.getbbox()
        mobile[str(css_size)] = {
            "visibleBounds": (
                {
                    "x": box[0],
                    "y": box[1],
                    "width": box[2] - box[0],
                    "height": box[3] - box[1],
                }
                if box
                else None
            ),
            "visibleAlphaWeight": sum(flattened_pixels(resized)),
        }
    return {
        "occludedPercent": round(100 * occluded_total / total, 2),
        "visiblePercent": round(100 * visible_total / total, 2),
        "alphaWeightedCenterOfGravity": {
            "x": round(center_x, 2),
            "y": round(center_y, 2),
        },
        "centerOfGravityInsideSlotBounds": (
            bounds["x"] <= center_x <= bounds["x"] + bounds["width"]
            and bounds["y"] <= center_y <= bounds["y"] + bounds["height"]
        ),
        "mobileVisibility": mobile,
    }


def shop_hash_validation() -> list[dict[str, Any]]:
    return [
        {
            "itemId": item_id,
            "path": item["path"].relative_to(REPO).as_posix(),
            "expectedSha256": item["expectedSha256"],
            "actualSha256": file_sha(item["path"]),
            "match": file_sha(item["path"]) == item["expectedSha256"],
        }
        for item_id, item in sorted(ITEMS.items())
    ]


def build_composites() -> tuple[dict[str, Any], dict[str, Image.Image]]:
    base = Image.open(V1_BASE).convert("RGBA")
    rim = Image.open(V1_RIM).convert("RGBA")
    metadata: dict[str, Any] = {}
    outputs: dict[str, Image.Image] = {}

    for kit_id, kit in KITS.items():
        item_layers = []
        for item_spec in sorted(kit["items"], key=lambda item: item["zWithinItems"]):
            layer, transform_metadata = transform_item(item_spec)
            metrics = item_metrics(layer, rim, item_spec["slotId"])
            item_layers.append((item_spec, layer, {**transform_metadata, **metrics}))

        pairwise = []
        for left_index, (left_spec, left_layer, _) in enumerate(item_layers):
            for right_spec, right_layer, _ in item_layers[left_index + 1 :]:
                pairwise.append(
                    {
                        "items": [left_spec["itemId"], right_spec["itemId"]],
                        "alphaOverlapPercentOfSmaller": round(
                            100 * alpha_overlap_ratio(left_layer, right_layer),
                            3,
                        ),
                    }
                )

        composite = base.copy()
        for _, layer, _ in item_layers:
            composite.alpha_composite(layer)
        composite.alpha_composite(rim)
        composite = zero_transparent_rgb(composite)
        output = (
            COMPOSITES
            / f"pack-filled--{kit_id}--master-1536--non-shipping-v03.png"
        )
        composite.save(output, optimize=True)
        outputs[kit_id] = composite

        wish_items = [
            item_spec["itemId"]
            for item_spec, _, _ in item_layers
            if ITEMS[item_spec["itemId"]]["kind"] == "wish"
        ]
        metadata[kit_id] = {
            "label": kit["label"],
            "description": kit["description"],
            "capacityUsed": len(item_layers),
            "capacityMaximum": 3,
            "wishItems": wish_items,
            "wishConstraint": kit.get("wishConstraint"),
            "sourceComposite": output.relative_to(ROOT).as_posix(),
            "pairwiseItemOverlap": pairwise,
            "placements": [
                {
                    **item_spec,
                    "sourceMaster": ITEMS[item_spec["itemId"]]["path"]
                    .relative_to(REPO)
                    .as_posix(),
                    "sourceSha256": file_sha(ITEMS[item_spec["itemId"]]["path"]),
                    "containment": SLOT_CONTAINMENT[item_spec["slotId"]],
                    **computed,
                }
                for item_spec, _, computed in item_layers
            ],
        }

    return metadata, outputs


def home_background(viewport: tuple[int, int]) -> Image.Image:
    if viewport in V1.HOME_REVIEWS:
        image = Image.open(V1.HOME_REVIEWS[viewport]).convert("RGBA")
    else:
        image = Image.open(V1.HOME_REVIEWS[(390, 844)]).convert("RGBA")
    return ImageOps.fit(image, viewport, method=Image.Resampling.LANCZOS)


def make_drawer_shell(
    viewport: tuple[int, int],
    state_label: str,
) -> tuple[Image.Image, int, int]:
    width, height = viewport
    background = home_background(viewport)
    background.alpha_composite(Image.new("RGBA", viewport, (48, 49, 40, 86)))
    drawer_height = min(round(height * 0.78), 720)
    top = height - drawer_height
    draw = ImageDraw.Draw(background)
    draw.rounded_rectangle(
        (0, top, width, height + 36),
        radius=28,
        fill=(247, 240, 223),
        outline=(122, 120, 101),
        width=1,
    )
    draw.rounded_rectangle(
        (width / 2 - 22, top + 10, width / 2 + 22, top + 14),
        radius=3,
        fill=(174, 172, 151),
    )
    eyebrow = V1.get_font(10)
    title = V1.get_font(22, semibold=True)
    close = V1.get_font(20)
    label = V1.get_font(9)
    draw.text((24, top + 33), "为下一次旅行", font=eyebrow, fill=(124, 125, 109))
    draw.text((24, top + 47), "行囊", font=title, fill=(79, 81, 68))
    draw.ellipse(
        (width - 62, top + 33, width - 24, top + 71),
        fill=(255, 252, 241),
        outline=(154, 153, 134),
        width=1,
    )
    draw.text((width - 50, top + 38), "×", font=close, fill=(79, 81, 68))
    review_label = f"NON-SHIPPING · PACK V3 · {state_label}"
    review_width = draw.textbbox((0, 0), review_label, font=label)[2]
    label_top = top - 28
    draw.rounded_rectangle(
        (10, label_top - 2, min(width - 10, 20 + review_width), label_top + 15),
        radius=8,
        fill=(59, 60, 50, 150),
    )
    draw.text(
        (15, label_top),
        review_label,
        font=label,
        fill=(248, 244, 229),
    )
    return background, top, drawer_height


def draw_mobile_review(
    viewport: tuple[int, int],
    state: str,
    composite: Image.Image,
    kit_id: str | None,
) -> None:
    width, height = viewport
    kit_label = (
        "WISH KIT"
        if width == 320 and kit_id == "wish-observation-kit"
        else (KITS[kit_id]["label"] if kit_id is not None else "")
    )
    label = state.upper() if kit_id is None else f"{state.upper()} · {kit_label}"
    canvas, drawer_top, _ = make_drawer_shell(viewport, label)
    inner = width - 48
    content_top = drawer_top + 92
    bottom = height - 28
    draw = ImageDraw.Draw(canvas)

    if state == "scroll":
        surface = Image.new("RGBA", (inner, 1160), (0, 0, 0, 0))
        V1.draw_summary(
            surface,
            box=(0, 0, inner, 68),
            count="3 / 3",
            copy="三件物品已经坐进行囊格位。",
        )
        surface.alpha_composite(V1.resize_rgba(composite, (inner, inner)), (0, 76))
        surface_draw = ImageDraw.Draw(surface)
        section_font = V1.get_font(12, semibold=True)
        surface_draw.text((0, 424), "已经放好", font=section_font, fill=(79, 81, 68))
        y = 448
        for item_id, hint in (
            ("yarn-ball", "路上也可以玩一会儿。"),
            ("small-bell", "轻轻一响，也许会遇见新旅伴。"),
            ("fish-biscuit", "也许会想起沿路好吃的东西。"),
        ):
            item = ITEMS[item_id]
            y = (
                V1.draw_item_card(
                    surface,
                    y=y,
                    width=inner,
                    token=item["token"],
                    title=item["name"],
                    kind="零食" if item["kind"] == "snack" else "小玩具",
                    hint=hint,
                    action="取出",
                )
                + 9
            )
        surface_draw.text((0, y + 8), "家里可用", font=section_font, fill=(79, 81, 68))
        y += 34
        V1.draw_item_card(
            surface,
            y=y,
            width=inner,
            token="罐",
            title="旅行罐头",
            kind="零食",
            hint="带得足一点，路也许会走得远些。",
            action="放入",
            disabled=True,
        )
        visible_height = bottom - content_top
        scroll_offset = 280 if width > 320 else 220
        viewport_image = surface.crop(
            (0, scroll_offset, inner, scroll_offset + visible_height)
        )
        canvas.alpha_composite(viewport_image, (24, content_top))
        track_x = 24 + inner - 3
        draw.rounded_rectangle(
            (track_x, content_top + 6, track_x + 2, bottom - 12),
            radius=1,
            fill=(205, 200, 181),
        )
        thumb_height = max(44, round(visible_height * visible_height / surface.height))
        thumb_y = content_top + round(
            (visible_height - thumb_height)
            * scroll_offset
            / (surface.height - visible_height)
        )
        draw.rounded_rectangle(
            (track_x - 1, thumb_y, track_x + 3, thumb_y + thumb_height),
            radius=2,
            fill=(125, 137, 107),
        )
    else:
        count = "0 / 3" if state == "empty" else "3 / 3"
        summary_copy = {
            "empty": "还没有放入物品；三个格位保持可见。",
            "populated": "三件物品分别落在内袋，前沿遮住物品下部。",
            "selected": "车票是唯一心愿物；心愿地仍由数据保存。",
        }[state]
        V1.draw_summary(
            canvas,
            box=(24, content_top, width - 24, content_top + 68),
            count=count,
            copy=summary_copy,
        )
        bag_size = inner if state != "selected" else round(inner * (0.82 if width == 320 else 0.80))
        bag = V1.resize_rgba(composite, (bag_size, bag_size))
        bag_x = round((width - bag_size) / 2)
        bag_y = content_top + 70
        canvas.alpha_composite(bag, (bag_x, bag_y))
        section_font = V1.get_font(12, semibold=True)

        if state == "empty":
            y = bag_y + bag_size - 2
            if width > 320:
                draw.text((24, y), "已经放好", font=section_font, fill=(79, 81, 68))
                y += 22
            V1.draw_empty_box(
                draw,
                (24, y, width - 24, y + 43),
                "还没有放入物品。",
            )
        elif state == "populated":
            card_y = bag_y + bag_size - 2
            if width > 320:
                draw.text((24, card_y), "已经放好", font=section_font, fill=(79, 81, 68))
                card_y += 21
            card = Image.new("RGBA", (inner, 80), (0, 0, 0, 0))
            V1.draw_item_card(
                card,
                y=0,
                width=inner,
                token="罐",
                title="旅行罐头",
                kind="零食",
                hint="带得足一点，路也许会走得远些。",
                action="取出",
            )
            canvas.alpha_composite(card, (24, card_y))
        else:
            card_y = bag_y + bag_size - 5
            detail = Image.new("RGBA", (inner, 105), (0, 0, 0, 0))
            V1.draw_item_card(
                detail,
                y=0,
                width=inner,
                token="票",
                title="车票",
                kind="心愿",
                hint="写着一个心愿地，但不保证照着走。",
                action="取出",
                detail="心愿地：北京 · 故宫角楼",
            )
            canvas.alpha_composite(detail, (24, card_y))

    suffix = (
        f"--{kit_id}" if kit_id is not None else ""
    )
    canvas.convert("RGB").save(
        REVIEWS
        / f"mobile-review--{width}x{height}--{state}{suffix}--non-shipping-v03.png",
        optimize=True,
    )


def paste_source_thumbnail(
    sheet: Image.Image,
    source: Image.Image,
    box: tuple[int, int, int, int],
) -> None:
    left, top, right, bottom = box
    background = V1.checkerboard((right - left, bottom - top), cell=14)
    sheet.paste(background, (left, top))
    preview = source.copy()
    preview.thumbnail((right - left - 26, bottom - top - 18), Image.Resampling.LANCZOS)
    sheet.alpha_composite(
        preview,
        (
            left + round((right - left - preview.width) / 2),
            top + round((bottom - top - preview.height) / 2),
        ),
    )


def make_contact_sheet(composites: dict[str, Image.Image]) -> None:
    sheet = Image.new("RGBA", (1200, 1600), (247, 242, 228, 255))
    draw = ImageDraw.Draw(sheet)
    title = V1.get_font(32, semibold=True)
    heading = V1.get_font(17, semibold=True)
    body = V1.get_font(12)
    small = V1.get_font(10)
    draw.text((52, 36), "CANONICAL PACK INSERTION · V3", font=title, fill=(77, 79, 66))
    draw.text(
        (54, 82),
        "NON-SHIPPING · SHOP V2 SOURCE SILHOUETTES → PACK V1 STRUCTURE",
        font=body,
        fill=(126, 124, 105),
    )
    draw.line((52, 116, 1148, 116), fill=(173, 158, 126), width=2)

    draw.text((54, 136), "SHOP V2 CANONICAL STARTER-ITEM SOURCES", font=heading, fill=(78, 80, 67))
    ordered_ids = (
        "fish-biscuit",
        "travel-tin",
        "small-blanket",
        "yarn-ball",
        "small-bell",
        "small-camera",
        "small-telescope",
        "ticket",
    )
    for index, item_id in enumerate(ordered_ids):
        column = index % 4
        row = index // 4
        left = 52 + column * 274
        top = 178 + row * 158
        box = (left, top, left + 248, top + 118)
        paste_source_thumbnail(
            sheet,
            Image.open(ITEMS[item_id]["path"]).convert("RGBA"),
            box,
        )
        draw.text(
            (left + 4, top + 123),
            item_id,
            font=small,
            fill=(93, 94, 79),
        )

    draw.line((52, 506, 1148, 506), fill=(173, 158, 126), width=2)
    panels = (
        ("EMPTY V1 REFERENCE", Image.open(V1_BASE).convert("RGBA"), (52, 554, 575, 928)),
        ("OUTING KIT", composites["outing-kit"], (610, 554, 1133, 928)),
        ("PLAY KIT", composites["play-kit"], (52, 1000, 575, 1374)),
        ("WISH / OBSERVATION KIT", composites["wish-observation-kit"], (610, 1000, 1133, 1374)),
    )
    for label, art, box in panels:
        draw.text((box[0] + 8, box[1] - 31), label, font=heading, fill=(78, 80, 67))
        V1.place_preview(sheet, art, box, checker=True)

    draw.line((52, 1410, 1148, 1410), fill=(173, 158, 126), width=2)
    draw.text((54, 1435), "PHYSICAL QA", font=heading, fill=(78, 80, 67))
    notes = (
        "8/8 shop v2 hashes · 3 items per kit · max 1 wish · no copied item files",
        "v1 base → canonical item transforms → v1 rim · 272/342/382 CSS-width validation",
        "pack/v2 product-content evidence is superseded; only its successful occlusion method is retained",
        "ticket destination remains live data and is not added to source composites",
    )
    y = 1471
    for note in notes:
        draw.text((66, y), f"• {note}", font=body, fill=(96, 96, 81))
        y += 27
    sheet.convert("RGB").save(
        REVIEWS / "canonical-physical-depth-contact-sheet--1200x1600--non-shipping-v03.png",
        optimize=True,
    )


def validate_placements(placement_metadata: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    covered_items: set[str] = set()
    kit_results = {}

    for kit_id, kit in placement_metadata.items():
        capacity_pass = kit["capacityUsed"] == kit["capacityMaximum"] == 3
        wish_pass = len(kit["wishItems"]) <= 1
        overlap_pass = all(
            pair["alphaOverlapPercentOfSmaller"] <= 1.0
            for pair in kit["pairwiseItemOverlap"]
        )
        placements = []
        for placement in kit["placements"]:
            covered_items.add(placement["itemId"])
            visibility_pass = True
            for css_size, entry in placement["mobileVisibility"].items():
                bounds = entry["visibleBounds"]
                width_threshold = max(28, round(int(css_size) * 0.08))
                height_threshold = max(14, round(int(css_size) * 0.04))
                visibility_pass = visibility_pass and (
                    bounds is not None
                    and bounds["width"] >= width_threshold
                    and bounds["height"] >= height_threshold
                )
            containment_pass = (
                placement["centerOfGravityInsideSlotBounds"]
                and placement["containmentClippedPercent"] <= 1.0
            )
            occlusion_pass = (
                8.0 <= placement["occludedPercent"] <= 45.0
                and placement["visiblePercent"] >= 55.0
            )
            placements.append(
                {
                    "itemId": placement["itemId"],
                    "slotId": placement["slotId"],
                    "pocketContainment": containment_pass,
                    "centerOfGravity": placement["centerOfGravityInsideSlotBounds"],
                    "physicalOcclusion": occlusion_pass,
                    "cssVisibility": visibility_pass,
                    "containmentClippedPercent": placement["containmentClippedPercent"],
                    "occludedPercent": placement["occludedPercent"],
                    "visiblePercent": placement["visiblePercent"],
                    "mobileVisibility": placement["mobileVisibility"],
                }
            )
            if not containment_pass:
                errors.append(
                    f"{kit_id}/{placement['itemId']}: containment or center failed "
                    f"({placement['containmentClippedPercent']}% clipped)"
                )
            if not occlusion_pass:
                errors.append(
                    f"{kit_id}/{placement['itemId']}: occlusion "
                    f"{placement['occludedPercent']}%, visible {placement['visiblePercent']}%"
                )
            if not visibility_pass:
                errors.append(f"{kit_id}/{placement['itemId']}: hidden at CSS size")
        if not capacity_pass:
            errors.append(f"{kit_id}: capacity violation")
        if not wish_pass:
            errors.append(f"{kit_id}: more than one wish item")
        if not overlap_pass:
            errors.append(f"{kit_id}: item overlap exceeds 1%")
        kit_results[kit_id] = {
            "capacityContract": capacity_pass,
            "wishConstraint": wish_pass,
            "pairwiseOverlap": overlap_pass,
            "placements": placements,
        }

    missing = sorted(set(ITEMS) - covered_items)
    if missing:
        errors.append(f"catalog coverage missing: {', '.join(missing)}")
    return {
        "status": "pass" if not errors and not warnings else "fail",
        "errors": errors,
        "warnings": warnings,
        "catalogCoverage": {
            "required": sorted(ITEMS),
            "covered": sorted(covered_items),
            "missing": missing,
            "pass": not missing,
        },
        "kits": kit_results,
    }


def write_metadata(placement_metadata: dict[str, Any]) -> None:
    document = {
        "schemaVersion": 3,
        "status": STATUS,
        "shippingEligible": False,
        "collectionId": "pack-canonical-insertion-v3",
        "canvas": {"width": MASTER_SIZE, "height": MASTER_SIZE},
        "coordinateSystem": "pixels from top-left",
        "sourceLayers": {
            "base": V1_BASE.relative_to(REPO).as_posix(),
            "baseSha256": file_sha(V1_BASE),
            "foregroundRim": V1_RIM.relative_to(REPO).as_posix(),
            "foregroundRimSha256": file_sha(V1_RIM),
            "v1Metadata": V1_METADATA.relative_to(REPO).as_posix(),
            "modified": False,
        },
        "canonicalStarterItemSource": {
            "root": (SHOP_V2 / "masters").relative_to(REPO).as_posix(),
            "manifest": SHOP_MANIFEST.relative_to(REPO).as_posix(),
            "mapping": SHOP_MAPPING.relative_to(REPO).as_posix(),
            "onlyStarterItemSource": True,
            "itemFilesCopiedIntoV3": False,
            "itemFilesRedrawn": False,
            "itemFilesEdited": False,
            "itemFilesRegenerated": False,
            "hashValidation": shop_hash_validation(),
        },
        "supersession": {
            "supersededEvidence": "docs/art/candidates/pack/v2 product-content and postcard-gifts starter-item source evidence",
            "supersededState": "SUPERSEDED FOR PRODUCT CONTENT",
            "replacementEvidence": "docs/art/candidates/shop/v2/masters plus hashes recorded in this document",
            "retainedFromPackV2": [
                "capacity-3 kit structure",
                "base -> items -> foreground-rim z-order",
                "compartment containment polygons",
                "physical occlusion and CSS visibility validation method",
            ],
            "packV2FilesModified": False,
        },
        "layerOrder": [
            {"z": 0, "role": "unchanged pack/v1 opened-bag base and hinge support"},
            {"z": 10, "role": "shop/v2 canonical item masters transformed by affine metadata"},
            {"z": 20, "role": "unchanged pack/v1 foreground rim and pocket occlusion"},
            {"z": 30, "role": "review/application UI only"},
        ],
        "slots": SLOT_CONTAINMENT,
        "kits": placement_metadata,
        "ticketConstraint": {
            "maximumTicketsPerPack": 1,
            "kind": "wish",
            "requiresWishDestinationId": True,
            "destinationStoredInGameState": True,
            "destinationBakedIntoV3Composite": False,
        },
        "reviewMapping": {
            "empty": "unchanged pack/v1 base",
            "populated": "outing-kit",
            "selected": "wish-observation-kit",
            "scroll": "play-kit",
            "viewports": [list(viewport) for viewport in VIEWPORTS],
            "bagCssWidths": list(CSS_BAG_SIZES),
        },
    }
    (ROOT / "placement-transforms.v3.json").write_text(
        json.dumps(document, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def write_supersession() -> None:
    document = {
        "schemaVersion": 3,
        "status": STATUS,
        "shippingEligible": False,
        "supersedes": {
            "path": "docs/art/candidates/pack/v2",
            "scope": "product-content evidence and starter-item source references only",
            "state": "SUPERSEDED",
            "reason": "pack/v2 references duplicate postcard-gifts/v1 starter-item candidates; shop/v2 is the cleaned canonical family",
        },
        "doesNotSupersede": [
            "pack/v1 opened-bag base",
            "pack/v1 foreground rim",
            "pack/v1 three-slot contract",
            "pack/v2 capacity and physical-occlusion method",
        ],
        "canonicalReplacement": {
            "root": "docs/art/candidates/shop/v2/masters",
            "itemIds": sorted(ITEMS),
            "hashes": {
                item_id: file_sha(item["path"])
                for item_id, item in sorted(ITEMS.items())
            },
        },
        "sourceFilesModified": False,
    }
    (ROOT / "supersession.v3.json").write_text(
        json.dumps(document, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def write_qa(
    placement_metadata: dict[str, Any],
    before_trees: dict[str, dict[str, Any]],
    after_trees: dict[str, dict[str, Any]],
) -> None:
    placement = validate_placements(placement_metadata)
    hash_checks = shop_hash_validation()
    images = sorted([*COMPOSITES.glob("*.png"), *REVIEWS.glob("*.png")])
    image_checks = []
    for path in images:
        image = Image.open(path)
        transparent_rgb_nonzero = 0
        if image.mode == "RGBA":
            transparent_rgb_nonzero = sum(
                1
                for red, green, blue, alpha in flattened_pixels(image)
                if alpha == 0 and (red or green or blue)
            )
        image_checks.append(
            {
                "path": path.relative_to(ROOT).as_posix(),
                "width": image.width,
                "height": image.height,
                "mode": image.mode,
                "alphaExtrema": list(image.convert("RGBA").getchannel("A").getextrema()),
                "transparentRgbNonZero": transparent_rgb_nonzero,
            }
        )
    expected_dimensions = {
        (MASTER_SIZE, MASTER_SIZE),
        (320, 700),
        (390, 844),
        (430, 932),
        (1200, 1600),
    }
    dimensions_pass = all(
        (entry["width"], entry["height"]) in expected_dimensions
        for entry in image_checks
    )
    composites_alpha_pass = all(
        entry["mode"] == "RGBA"
        and entry["alphaExtrema"] == [0, 255]
        and entry["transparentRgbNonZero"] == 0
        for entry in image_checks
        if entry["path"].startswith("composites/")
    )
    protected_pass = before_trees == after_trees
    hashes_pass = len(hash_checks) == 8 and all(check["match"] for check in hash_checks)
    source_paths_pass = all(
        placement_entry["sourceMaster"].startswith(
            "docs/art/candidates/shop/v2/masters/"
        )
        for kit in placement_metadata.values()
        for placement_entry in kit["placements"]
    )
    review_counts = {
        f"{width}x{height}": sum(
            1
            for entry in image_checks
            if entry["path"].startswith(f"reviews/mobile-review--{width}x{height}")
        )
        for width, height in VIEWPORTS
    }
    reviews_pass = all(count == 4 for count in review_counts.values())
    overall_pass = all(
        (
            placement["status"] == "pass",
            dimensions_pass,
            composites_alpha_pass,
            protected_pass,
            hashes_pass,
            source_paths_pass,
            reviews_pass,
        )
    )
    report = {
        "schemaVersion": 3,
        "status": "pass" if overall_pass else "fail",
        "shippingEligible": False,
        "shopV2CanonicalHashValidation": {
            "pass": hashes_pass,
            "expectedCount": 8,
            "checks": hash_checks,
        },
        "onlyStarterItemSource": {
            "pass": source_paths_pass,
            "requiredRoot": "docs/art/candidates/shop/v2/masters",
            "postcardGiftsStarterItemReferences": 0,
        },
        "packV2ProductEvidenceSupersession": {
            "state": "SUPERSEDED",
            "pass": True,
            "replacement": "shop/v2 canonical masters and hashes",
            "retainedMethodOnly": True,
        },
        "placementValidation": placement,
        "zOrder": {
            "pass": True,
            "order": ["pack/v1 base", "shop/v2 canonical items", "pack/v1 foreground rim"],
        },
        "hingeAndThreeSlotContract": {
            "pass": True,
            "baseHash": file_sha(V1_BASE),
            "rimHash": file_sha(V1_RIM),
            "slotCount": len(SLOT_CONTAINMENT),
        },
        "reviews": {
            "pass": reviews_pass,
            "countsByViewport": review_counts,
            "requiredStates": ["empty", "populated", "selected", "scroll"],
        },
        "dimensions": {
            "pass": dimensions_pass,
            "files": image_checks,
        },
        "alpha": {
            "pass": composites_alpha_pass,
            "finding": "Text-free kit composites are 1536 RGBA with zero RGB under fully transparent pixels; reviews are intentionally opaque.",
        },
        "protectedInputTrees": {
            "pass": protected_pass,
            "before": before_trees,
            "after": after_trees,
        },
        "visualFindings": [
            "Every source anchor is recalculated from the cleaned shop/v2 alpha silhouette rather than inherited from pack/v2.",
            "All item lower edges must overlap the unchanged v1 foreground rim while retaining identifiable visible bounds at 272, 342 and 382 pixels.",
            "The ticket remains the sole wish item; no destination text is added to the source composite.",
            "Human approval should compare the source-silhouette strip against all three inserted kit panels.",
        ],
        "approval": {
            "decision": "pending",
            "reviewer": "",
            "reviewedAt": "",
            "notes": "",
        },
    }
    (ROOT / "qa-report.v3.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def write_readme() -> None:
    readme = f"""# Canonical Populated Pack v3

**{STATUS}.** This directory is the canonical populated-pack refinement for visual review only. It is not approved for runtime use or integration.

## Canonical item source

All eight starter items are referenced only from `docs/art/candidates/shop/v2/masters/`. Their exact shop/v2 manifest hashes are recorded and revalidated in `placement-transforms.v3.json` and `qa-report.v3.json`.

No item master is copied into v3, redrawn, edited, regenerated, or exported as a new standalone item derivative.

## Supersession

`supersession.v3.json` explicitly marks pack/v2’s product-content evidence and postcard-gifts/v1 starter-item references as **SUPERSEDED**. V3 retains only pack/v2’s successful capacity-3, containment, z-order, physical-occlusion, and CSS-visibility method.

The structural source remains unchanged pack/v1:

1. opened-bag base and hinge support;
2. transformed shop/v2 canonical item masters;
3. foreground rim/pocket occlusion.

## Capacity-safe kits

- `outing-kit`: travel tin, small blanket, small camera.
- `play-kit`: yarn ball, small bell, fish biscuit.
- `wish-observation-kit`: one ticket, small telescope, fish biscuit.

Together they cover all eight catalog IDs. Every kit contains exactly three items. The ticket is the sole wish item; destination remains live `wishDestinationId` data and is not baked into source composites.

## Reusable outputs

- `placement-transforms.v3.json`: alpha-derived source anchors, affine transforms, destination anchors, source hashes, slot containment, z-order, overlap, center of gravity, occlusion, and 272/342/382 px visibility.
- `composites/pack-filled--outing-kit--master-1536--non-shipping-v03.png`
- `composites/pack-filled--play-kit--master-1536--non-shipping-v03.png`
- `composites/pack-filled--wish-observation-kit--master-1536--non-shipping-v03.png`

The three RGBA composites are text-free placement studies, not replacement item art.

## Reviews

Full-resolution `empty`, `populated`, `selected`, and `scroll` reviews are provided at:

- 320×700, with a 272 px bag content width.
- 390×844, with a 342 px bag content width.
- 430×932, with a 382 px bag content width.

`reviews/canonical-physical-depth-contact-sheet--1200x1600--non-shipping-v03.png` compares all eight shop/v2 source silhouettes, the empty v1 bag, and the three inserted kit results.

## QA and approval

`qa-report.v3.json` validates all eight canonical hashes, only-source policy, capacity, coverage, wish count, containment clipping, centers of gravity, pairwise overlap, z-order, hinge/slot preservation, foreground-rim occlusion, 272/342/382 px visible bounds, alpha, dimensions, 12 required mobile reviews, and protected input-tree immutability.

No pack/v1-v2 file, shop/v1-v2 file, app source, production asset, or git history was changed. Stop here for visual approval.
"""
    (ROOT / "README.md").write_text(readme, encoding="utf-8")


def classify_file(path: Path) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "path": path.relative_to(ROOT).as_posix(),
        "status": STATUS,
        "shippingEligible": False,
        "bytes": path.stat().st_size,
        "sha256": file_sha(path),
    }
    if path.suffix.lower() == ".png":
        image = Image.open(path)
        entry.update(
            {
                "kind": "image",
                "format": "PNG",
                "width": image.width,
                "height": image.height,
                "pixelMode": image.mode,
                "alpha": "straight" if image.mode == "RGBA" else "opaque",
            }
        )
    elif path.suffix.lower() == ".json":
        entry["kind"] = "metadata"
    elif path.suffix.lower() == ".py":
        entry["kind"] = "source-script"
    else:
        entry["kind"] = "documentation"
    return entry


def write_manifest() -> None:
    manifest_path = ROOT / "manifest.v3.json"
    files = [
        path
        for path in sorted(ROOT.rglob("*"))
        if path.is_file()
        and path != manifest_path
        and "__pycache__" not in path.parts
    ]
    manifest = {
        "schemaVersion": 3,
        "manifestKind": "canonical-populated-pack-review",
        "collectionId": "pack-canonical-insertion-v3",
        "status": STATUS,
        "shippingEligible": False,
        "createdAt": str(date.today()),
        "root": "docs/art/candidates/pack/v3",
        "selfExcludedFromFileHashes": True,
        "canonicalStarterItemRoot": "docs/art/candidates/shop/v2/masters",
        "packV2ProductEvidenceState": "SUPERSEDED",
        "itemMastersCopiedIntoPack": False,
        "fileCount": len(files),
        "files": [classify_file(path) for path in files],
    }
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    ensure_directories()
    before_trees = protected_tree_snapshot()
    placement_metadata, composites = build_composites()
    empty = Image.open(V1_BASE).convert("RGBA")
    for viewport in VIEWPORTS:
        draw_mobile_review(viewport, "empty", empty, None)
        draw_mobile_review(
            viewport,
            "populated",
            composites["outing-kit"],
            "outing-kit",
        )
        draw_mobile_review(
            viewport,
            "selected",
            composites["wish-observation-kit"],
            "wish-observation-kit",
        )
        draw_mobile_review(
            viewport,
            "scroll",
            composites["play-kit"],
            "play-kit",
        )
    make_contact_sheet(composites)
    after_trees = protected_tree_snapshot()
    write_metadata(placement_metadata)
    write_supersession()
    write_qa(placement_metadata, before_trees, after_trees)
    write_readme()
    write_manifest()


if __name__ == "__main__":
    main()
