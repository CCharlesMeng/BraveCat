#!/usr/bin/env python3
"""Build NON-SHIPPING physical item insertion studies for the opened pack."""

from __future__ import annotations

from datetime import date
from hashlib import sha256
import importlib.util
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PACK_ROOT = ROOT.parent
V1_ROOT = PACK_ROOT / "v1"
REPO = ROOT.parents[4]
COMPOSITES = ROOT / "composites"
REVIEWS = ROOT / "reviews"
QA = ROOT / "qa"

POSTCARD_GIFTS = REPO / "docs/art/candidates/postcard-gifts/v1"
ITEM_ROOT = POSTCARD_GIFTS / "masters/items"
V1_BASE = V1_ROOT / "masters/pack-opened-base--master-1536--non-shipping-v01.png"
V1_RIM = (
    V1_ROOT
    / "masters/pack-opened-foreground-rim--master-1536--non-shipping-v01.png"
)
V1_METADATA = V1_ROOT / "composition-metadata.v1.json"
V1_BUILDER = V1_ROOT / "source/build_pack_candidate.py"

MASTER_SIZE = 1536
STATUS = "NON-SHIPPING / VISUAL-REVIEW-ONLY"


def load_v1_helpers():
    spec = importlib.util.spec_from_file_location("pack_v1_helpers", V1_BUILDER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import v1 helpers from {V1_BUILDER}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


V1 = load_v1_helpers()

ITEMS = {
    "fish-biscuit": {
        "kind": "snack",
        "name": "小鱼饼",
        "token": "饼",
        "path": ITEM_ROOT
        / "item--snack--fish-biscuit--master-512--non-shipping-v01.png",
    },
    "travel-tin": {
        "kind": "snack",
        "name": "旅行罐头",
        "token": "罐",
        "path": ITEM_ROOT
        / "item--snack--travel-tin--master-512--non-shipping-v01.png",
    },
    "small-blanket": {
        "kind": "toy",
        "name": "小毛毯",
        "token": "毯",
        "path": ITEM_ROOT
        / "item--toy--small-blanket--master-512--non-shipping-v01.png",
    },
    "yarn-ball": {
        "kind": "toy",
        "name": "毛线球",
        "token": "球",
        "path": ITEM_ROOT
        / "item--toy--yarn-ball--master-512--non-shipping-v01.png",
    },
    "small-bell": {
        "kind": "toy",
        "name": "小铃铛",
        "token": "铃",
        "path": ITEM_ROOT
        / "item--toy--small-bell--master-512--non-shipping-v01.png",
    },
    "small-camera": {
        "kind": "toy",
        "name": "小相机",
        "token": "相",
        "path": ITEM_ROOT
        / "item--toy--small-camera--master-512--non-shipping-v01.png",
    },
    "small-telescope": {
        "kind": "toy",
        "name": "小望远镜",
        "token": "镜",
        "path": ITEM_ROOT
        / "item--toy--small-telescope--master-512--non-shipping-v01.png",
    },
    "ticket": {
        "kind": "wish",
        "name": "车票",
        "token": "票",
        "path": ITEM_ROOT
        / "item--wish--ticket--master-512--non-shipping-v01.png",
    },
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
        "description": "Travel tin, folded blanket and camera",
        "items": [
            {
                "itemId": "small-blanket",
                "slotId": "center-deep-pocket",
                "sourceAnchor": [256, 464],
                "destinationAnchor": [768, 1080],
                "scale": 0.61,
                "rotationDegreesClockwise": 2.5,
                "zWithinItems": 0,
            },
            {
                "itemId": "travel-tin",
                "slotId": "left-inner-sleeve",
                "sourceAnchor": [256, 464],
                "destinationAnchor": [506, 1005],
                "scale": 0.52,
                "rotationDegreesClockwise": -6.0,
                "zWithinItems": 1,
            },
            {
                "itemId": "small-camera",
                "slotId": "right-inner-sleeve",
                "sourceAnchor": [256, 464],
                "destinationAnchor": [1068, 954],
                "scale": 0.54,
                "rotationDegreesClockwise": 5.0,
                "zWithinItems": 2,
            },
        ],
    },
    "play-kit": {
        "label": "PLAY KIT",
        "description": "Yarn ball, bell and fish biscuit",
        "items": [
            {
                "itemId": "fish-biscuit",
                "slotId": "center-deep-pocket",
                "sourceAnchor": [256, 464],
                "destinationAnchor": [770, 1055],
                "scale": 0.54,
                "rotationDegreesClockwise": 3.5,
                "zWithinItems": 0,
            },
            {
                "itemId": "yarn-ball",
                "slotId": "left-inner-sleeve",
                "sourceAnchor": [256, 464],
                "destinationAnchor": [475, 974],
                "scale": 0.49,
                "rotationDegreesClockwise": -7.0,
                "zWithinItems": 1,
            },
            {
                "itemId": "small-bell",
                "slotId": "right-inner-sleeve",
                "sourceAnchor": [256, 464],
                "destinationAnchor": [1060, 950],
                "scale": 0.54,
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
                "sourceAnchor": [256, 464],
                "destinationAnchor": [768, 1070],
                "scale": 0.60,
                "rotationDegreesClockwise": -3.0,
                "zWithinItems": 0,
            },
            {
                "itemId": "fish-biscuit",
                "slotId": "left-inner-sleeve",
                "sourceAnchor": [256, 464],
                "destinationAnchor": [535, 1020],
                "scale": 0.49,
                "rotationDegreesClockwise": -9.0,
                "zWithinItems": 1,
            },
            {
                "itemId": "small-telescope",
                "slotId": "right-inner-sleeve",
                "sourceAnchor": [256, 464],
                "destinationAnchor": [1070, 1000],
                "scale": 0.49,
                "rotationDegreesClockwise": -18.0,
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
    pixels = [
        (red, green, blue, alpha) if alpha else (0, 0, 0, 0)
        for red, green, blue, alpha in flattened_pixels(rgba)
    ]
    rgba.putdata(pixels)
    return rgba


def file_sha(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def input_files() -> list[Path]:
    return [V1_BASE, V1_RIM, V1_METADATA, *[entry["path"] for entry in ITEMS.values()]]


def snapshot_inputs() -> dict[str, str]:
    return {
        path.relative_to(REPO).as_posix(): file_sha(path)
        for path in input_files()
    }


def affine_transform(spec: dict[str, Any]) -> dict[str, Any]:
    source_anchor_x, source_anchor_y = spec["sourceAnchor"]
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
    mask = Image.new("L", (MASTER_SIZE, MASTER_SIZE), 0)
    high_resolution = Image.new("L", (MASTER_SIZE * 2, MASTER_SIZE * 2), 0)
    draw = ImageDraw.Draw(high_resolution)
    draw.polygon(
        [(x * 2, y * 2) for x, y in SLOT_CONTAINMENT[slot_id]["polygon"]],
        fill=255,
    )
    high_resolution = high_resolution.filter(ImageFilter.GaussianBlur(1.25))
    mask = high_resolution.resize(
        (MASTER_SIZE, MASTER_SIZE),
        Image.Resampling.LANCZOS,
    )
    return mask


def transform_item(spec: dict[str, Any]) -> tuple[Image.Image, dict[str, Any]]:
    source = Image.open(ITEMS[spec["itemId"]]["path"]).convert("RGBA")
    matrix = affine_transform(spec)
    transformed = source.transform(
        (MASTER_SIZE, MASTER_SIZE),
        Image.Transform.AFFINE,
        matrix["inverse"],
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )
    alpha_before = transformed.getchannel("A")
    alpha_before_total = sum(flattened_pixels(alpha_before))
    mask = containment_mask(spec["slotId"])
    transformed.putalpha(ImageChops.multiply(alpha_before, mask))
    transformed = zero_transparent_rgb(transformed)
    alpha_after_total = sum(flattened_pixels(transformed.getchannel("A")))
    bounds = transformed.getchannel("A").getbbox()
    if bounds is None:
        raise RuntimeError(f"Transform removed all pixels for {spec['itemId']}")
    return transformed, {
        "affineForward": [round(value, 7) for value in matrix["forward"]],
        "affineInverse": [round(value, 7) for value in matrix["inverse"]],
        "transformedAlphaBounds": {
            "x": bounds[0],
            "y": bounds[1],
            "width": bounds[2] - bounds[0],
            "height": bounds[3] - bounds[1],
        },
        "containmentClippedPercent": round(
            100 * (1 - alpha_after_total / alpha_before_total),
            3,
        ),
    }


def alpha_weighted_center(alpha: Image.Image) -> tuple[float, float]:
    width, height = alpha.size
    values = flattened_pixels(alpha)
    total = sum(values)
    if total == 0:
        return (0.0, 0.0)
    x_sum = 0
    y_sum = 0
    for index, value in enumerate(values):
        if not value:
            continue
        x_sum += (index % width) * value
        y_sum += (index // width) * value
    return (x_sum / total, y_sum / total)


def alpha_overlap_ratio(first: Image.Image, second: Image.Image) -> float:
    first_alpha = first.getchannel("A")
    second_alpha = second.getchannel("A")
    overlap = ImageChops.multiply(first_alpha, second_alpha)
    first_total = sum(flattened_pixels(first_alpha))
    second_total = sum(flattened_pixels(second_alpha))
    denominator = min(first_total, second_total)
    return 0.0 if denominator == 0 else sum(flattened_pixels(overlap)) / denominator


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
    for css_size in (342, 382):
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


def build_composites() -> tuple[dict[str, Any], dict[str, Image.Image]]:
    base = Image.open(V1_BASE).convert("RGBA")
    rim = Image.open(V1_RIM).convert("RGBA")
    metadata: dict[str, Any] = {}
    outputs: dict[str, Image.Image] = {}

    for kit_id, kit in KITS.items():
        item_layers: list[tuple[dict[str, Any], Image.Image, dict[str, Any]]] = []
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
            / f"pack-filled--{kit_id}--master-1536--non-shipping-v02.png"
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


def make_drawer_shell(
    viewport: tuple[int, int],
    state_label: str,
) -> tuple[Image.Image, int, int]:
    width, height = viewport
    background = Image.open(V1.HOME_REVIEWS[viewport]).convert("RGBA")
    if background.size != viewport:
        background = background.resize(viewport, Image.Resampling.LANCZOS)
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
    review_label = f"NON-SHIPPING · PACK V2 · {state_label}"
    review_width = draw.textbbox((0, 0), review_label, font=label)[2]
    label_top = top - 28
    draw.rounded_rectangle(
        (10, label_top - 2, 20 + review_width, label_top + 15),
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
    kit_id: str,
    composite: Image.Image,
) -> None:
    width, height = viewport
    state_label = f"{state.upper()} · {KITS[kit_id]['label']}"
    canvas, drawer_top, _ = make_drawer_shell(viewport, state_label)
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
            copy="已经准备好了。三件物品分别坐进行囊格位。",
        )
        bag = V1.resize_rgba(composite, (inner, inner))
        surface.alpha_composite(bag, (0, 76))
        surface_draw = ImageDraw.Draw(surface)
        section_font = V1.get_font(12, semibold=True)
        surface_draw.text(
            (0, 424),
            "已经放好",
            font=section_font,
            fill=(79, 81, 68),
        )
        y = 448
        cards = (
            ("yarn-ball", "路上也可以玩一会儿。", None),
            ("small-bell", "轻轻一响，也许会遇见新旅伴。", None),
            ("fish-biscuit", "也许会想起沿路好吃的东西。", None),
        )
        for item_id, hint, detail in cards:
            item = ITEMS[item_id]
            y = (
                V1.draw_item_card(
                    surface,
                    y=y,
                    width=inner,
                    token=item["token"],
                    title=item["name"],
                    kind="心愿" if item["kind"] == "wish" else ("零食" if item["kind"] == "snack" else "小玩具"),
                    hint=hint,
                    action="取出",
                    detail=detail,
                )
                + 9
            )
        surface_draw.text(
            (0, y + 8),
            "家里可用",
            font=section_font,
            fill=(79, 81, 68),
        )
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
        scroll_offset = 280
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
        summary_copy = (
            "三件物品分别放入内袋，前沿会遮住物品下部。"
            if state == "populated"
            else "车票是唯一心愿物；心愿地仍由界面数据保存。"
        )
        V1.draw_summary(
            canvas,
            box=(24, content_top, width - 24, content_top + 68),
            count="3 / 3",
            copy=summary_copy,
        )
        bag_size = inner if state == "populated" else round(inner * 0.80)
        bag = V1.resize_rgba(composite, (bag_size, bag_size))
        bag_x = round((width - bag_size) / 2)
        bag_y = content_top + 70
        canvas.alpha_composite(bag, (bag_x, bag_y))
        section_font = V1.get_font(12, semibold=True)
        if state == "populated":
            card_y = bag_y + bag_size - 3
            draw.text(
                (24, card_y),
                "已经放好",
                font=section_font,
                fill=(79, 81, 68),
            )
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
            canvas.alpha_composite(card, (24, card_y + 21))
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

    canvas.convert("RGB").save(
        REVIEWS
        / f"mobile-review--{width}x{height}--{state}--{kit_id}--non-shipping-v02.png",
        optimize=True,
    )


def make_contact_sheet(composites: dict[str, Image.Image]) -> None:
    sheet = Image.new("RGBA", (1200, 1600), (247, 242, 228, 255))
    draw = ImageDraw.Draw(sheet)
    title = V1.get_font(34, semibold=True)
    heading = V1.get_font(18, semibold=True)
    body = V1.get_font(13)
    small = V1.get_font(11)
    draw.text(
        (52, 40),
        "PACK PHYSICAL INSERTION · V2",
        font=title,
        fill=(77, 79, 66),
    )
    draw.text(
        (54, 88),
        "NON-SHIPPING / VISUAL-REVIEW-ONLY · ACTUAL CATALOG MASTERS",
        font=body,
        fill=(126, 124, 105),
    )
    draw.line((52, 124, 1148, 124), fill=(173, 158, 126), width=2)

    panels = (
        (
            "EMPTY V1 REFERENCE",
            Image.open(V1_BASE).convert("RGBA"),
            (52, 174, 575, 680),
        ),
        (
            "OUTING KIT · TIN / BLANKET / CAMERA",
            composites["outing-kit"],
            (610, 174, 1133, 680),
        ),
        (
            "PLAY KIT · YARN / BELL / BISCUIT",
            composites["play-kit"],
            (52, 760, 575, 1266),
        ),
        (
            "WISH KIT · TICKET / TELESCOPE / BISCUIT",
            composites["wish-observation-kit"],
            (610, 760, 1133, 1266),
        ),
    )
    for label, art, box in panels:
        draw.text((box[0] + 8, box[1] - 34), label, font=heading, fill=(78, 80, 67))
        V1.place_preview(sheet, art, box, checker=True)

    draw.line((52, 1310, 1148, 1310), fill=(173, 158, 126), width=2)
    draw.text((54, 1338), "PHYSICAL-DEPTH CHECKS", font=heading, fill=(78, 80, 67))
    checks = (
        "• Exactly three current-catalog objects per kit; all eight catalog objects appear across the set.",
        "• Each transformed master uses one named v1 slot and is clipped to its compartment containment polygon.",
        "• The unchanged v1 foreground rim restores lower-edge occlusion after item placement.",
        "• Pairwise item overlap, center of gravity, visible alpha and 342/382 px readability are machine-recorded.",
        "• The ticket is the only wish item; destination data remains live metadata and is not painted into the ticket.",
    )
    y = 1380
    for check in checks:
        y = (
            V1.draw_wrapped_text(
                draw,
                (66, y),
                check,
                font=body,
                fill=(96, 96, 81),
                max_width=1060,
                line_height=21,
                max_lines=2,
            )
            + 8
        )
    draw.text(
        (66, 1540),
        "No item master was copied, redrawn or modified. Source composites contain no text.",
        font=small,
        fill=(126, 124, 105),
    )
    sheet.convert("RGB").save(
        REVIEWS / "physical-depth-contact-sheet--1200x1600--non-shipping-v02.png",
        optimize=True,
    )


def validate_placements(placement_metadata: dict[str, Any]) -> dict[str, Any]:
    errors = []
    warnings = []
    covered_items: set[str] = set()
    kit_results = {}
    for kit_id, kit in placement_metadata.items():
        capacity_pass = kit["capacityUsed"] <= kit["capacityMaximum"] == 3
        wish_pass = len(kit["wishItems"]) <= 1
        overlap_pass = all(
            pair["alphaOverlapPercentOfSmaller"] <= 1.0
            for pair in kit["pairwiseItemOverlap"]
        )
        placements = []
        for placement in kit["placements"]:
            covered_items.add(placement["itemId"])
            css_pass = all(
                entry["visibleBounds"] is not None
                and entry["visibleBounds"]["width"] >= 16
                and entry["visibleBounds"]["height"] >= 12
                for entry in placement["mobileVisibility"].values()
            )
            occlusion_pass = (
                placement["occludedPercent"] >= 2.0
                and placement["visiblePercent"] >= 35.0
            )
            center_pass = placement["centerOfGravityInsideSlotBounds"]
            containment_pass = (
                center_pass and placement["containmentClippedPercent"] <= 1.0
            )
            placements.append(
                {
                    "itemId": placement["itemId"],
                    "slotId": placement["slotId"],
                    "pocketContainment": containment_pass,
                    "centerOfGravity": center_pass,
                    "physicalOcclusion": occlusion_pass,
                    "cssVisibility": css_pass,
                    "containmentClippedPercent": placement[
                        "containmentClippedPercent"
                    ],
                    "occludedPercent": placement["occludedPercent"],
                    "visiblePercent": placement["visiblePercent"],
                    "mobileVisibility": placement["mobileVisibility"],
                }
            )
            if not center_pass:
                errors.append(f"{kit_id}/{placement['itemId']}: center outside slot")
            if placement["containmentClippedPercent"] > 1.0:
                errors.append(
                    f"{kit_id}/{placement['itemId']}: "
                    f"{placement['containmentClippedPercent']}% clipped by slot"
                )
            if not occlusion_pass:
                warnings.append(
                    f"{kit_id}/{placement['itemId']}: review occlusion "
                    f"{placement['occludedPercent']}%, visible "
                    f"{placement['visiblePercent']}%"
                )
            if not css_pass:
                errors.append(f"{kit_id}/{placement['itemId']}: too small at CSS size")
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
        "status": (
            "pass"
            if not errors and not warnings
            else ("fail" if errors else "pass-with-warnings")
        ),
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
        "schemaVersion": 2,
        "status": STATUS,
        "shippingEligible": False,
        "collectionId": "pack-physical-insertion-v2",
        "canvas": {"width": MASTER_SIZE, "height": MASTER_SIZE},
        "coordinateSystem": "pixels from top-left",
        "sourceLayers": {
            "base": V1_BASE.relative_to(REPO).as_posix(),
            "foregroundRim": V1_RIM.relative_to(REPO).as_posix(),
            "v1Metadata": V1_METADATA.relative_to(REPO).as_posix(),
            "modified": False,
        },
        "layerOrder": [
            {"z": 0, "role": "unchanged v1 opened-bag base"},
            {"z": 10, "role": "referenced catalog item masters transformed by this metadata"},
            {"z": 20, "role": "unchanged v1 foreground rim/pocket occlusion"},
            {"z": 30, "role": "review/application UI only"},
        ],
        "sourceItemPolicy": {
            "root": ITEM_ROOT.relative_to(REPO).as_posix(),
            "itemFilesCopiedIntoV2": False,
            "itemFilesRedrawn": False,
            "itemDerivativesExported": False,
            "placementCompositesAreFlattenedTextFreeStudies": True,
        },
        "slots": SLOT_CONTAINMENT,
        "kits": placement_metadata,
        "ticketConstraint": {
            "maximumTicketsPerPack": 1,
            "kind": "wish",
            "requiresWishDestinationId": True,
            "destinationStoredInGameState": True,
            "destinationBakedIntoArt": False,
        },
        "reviewMapping": {
            "populated": "outing-kit",
            "selected": "wish-observation-kit",
            "scroll": "play-kit",
            "viewports": [[390, 844], [430, 932]],
        },
    }
    (ROOT / "placement-transforms.v2.json").write_text(
        json.dumps(document, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def write_qa(
    placement_metadata: dict[str, Any],
    before_inputs: dict[str, str],
    after_inputs: dict[str, str],
) -> None:
    placement_validation = validate_placements(placement_metadata)
    images = sorted(
        [
            *COMPOSITES.glob("*.png"),
            *REVIEWS.glob("*.png"),
        ]
    )
    image_checks = []
    for path in images:
        image = Image.open(path)
        alpha = image.convert("RGBA").getchannel("A")
        transparent_rgb_nonzero = 0
        if image.mode == "RGBA":
            transparent_rgb_nonzero = sum(
                1
                for red, green, blue, alpha_value in flattened_pixels(image)
                if alpha_value == 0 and (red or green or blue)
            )
        image_checks.append(
            {
                "path": path.relative_to(ROOT).as_posix(),
                "width": image.width,
                "height": image.height,
                "mode": image.mode,
                "alphaExtrema": list(alpha.getextrema()),
                "transparentRgbNonZero": transparent_rgb_nonzero,
            }
        )
    expected_dimensions = {
        "composites": [MASTER_SIZE, MASTER_SIZE],
        "mobile390": [390, 844],
        "mobile430": [430, 932],
        "contactSheet": [1200, 1600],
    }
    dimensions_pass = all(
        (
            [check["width"], check["height"]]
            in expected_dimensions.values()
        )
        for check in image_checks
    )
    immutability_pass = before_inputs == after_inputs
    alpha_pass = all(
        check["mode"] == "RGBA"
        and check["alphaExtrema"] == [0, 255]
        and check["transparentRgbNonZero"] == 0
        for check in image_checks
        if check["path"].startswith("composites/")
    )
    report = {
        "schemaVersion": 2,
        "status": (
            "pass"
            if placement_validation["status"] == "pass"
            and dimensions_pass
            and immutability_pass
            and alpha_pass
            else "fail"
        ),
        "shippingEligible": False,
        "placementValidation": placement_validation,
        "zOrder": {
            "pass": True,
            "order": ["v1 base", "three transformed item masters", "v1 foreground rim"],
        },
        "dimensions": {
            "pass": dimensions_pass,
            "expected": expected_dimensions,
            "files": image_checks,
        },
        "alpha": {
            "pass": alpha_pass,
            "finding": "All three source composites retain straight RGBA transparency with zero RGB beneath fully transparent pixels; review boards are intentionally opaque.",
        },
        "inputImmutability": {
            "pass": immutability_pass,
            "before": before_inputs,
            "after": after_inputs,
        },
        "visualFindings": [
            "Items are scaled to the v1 compartment bounds rather than the larger 46px inventory-token visual weight.",
            "The unchanged foreground rim hides each lower item portion and establishes gravity.",
            "The center ticket remains blank; destination text appears only in flattened UI reviews.",
            "Human approval should check whether telescope and bell angles feel natural before any integration.",
        ],
        "approval": {
            "decision": "pending",
            "reviewer": "",
            "reviewedAt": "",
            "notes": "",
        },
    }
    (ROOT / "qa-report.v2.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def write_readme() -> None:
    readme = f"""# Open Pack Physical Insertion v2

**{STATUS}.** This directory is a physical-placement refinement only. It is not approved for runtime use or integration.

## What changed from v1

The opened-bag structure remains exactly the v1 base and foreground rim. V2 replaces the illustrative calibration-board review proxies with transforms of the actual transparent current-catalog masters from `docs/art/candidates/postcard-gifts/v1/masters/items/`.

No item master is copied into this directory, redrawn, modified, or exported as a new item derivative. `placement-transforms.v2.json` is the reusable contract: source path and hash, source/destination anchors, affine transform, named compartment, containment polygon, item z-order, center of gravity, physical occlusion, and 342/382 px visibility.

## Capacity-3 configurations

- `outing-kit`: travel tin, small blanket, small camera
- `play-kit`: yarn ball, small bell, fish biscuit
- `wish-observation-kit`: one ticket, small telescope, fish biscuit

Together the three studies cover all eight real catalog items. Every configuration contains exactly three objects. The wish kit contains the only ticket, never more than one wish item. Its destination remains `wishDestinationId` data and is not painted into the blank ticket.

## Layer order

1. unchanged v1 opened-bag base
2. three referenced item masters transformed according to `placement-transforms.v2.json`
3. unchanged v1 foreground shell/rim
4. review or application UI

Each item uses one compartment containment polygon. The foreground rim restores lower-edge occlusion, so objects read as seated inside rather than floating above the shell.

## Text-free source composites

- `composites/pack-filled--outing-kit--master-1536--non-shipping-v02.png`
- `composites/pack-filled--play-kit--master-1536--non-shipping-v02.png`
- `composites/pack-filled--wish-observation-kit--master-1536--non-shipping-v02.png`

These RGBA files are flattened placement studies, not replacement item art. They contain no text, numbers, labels, UI, emoji, or watermarks.

## Reviews

At both 390×844 and 430×932:

- `populated` uses the outing kit.
- `selected` uses the wish/observation kit and review-only ticket destination UI.
- `scroll` uses the play kit in the real vertically scrolling drawer pattern.

`reviews/physical-depth-contact-sheet--1200x1600--non-shipping-v02.png` compares the empty v1 bag with all three physical configurations.

## QA

`qa-report.v2.json` validates capacity, wish count, pairwise overlap, slot containment, center of gravity, foreground-rim occlusion, actual CSS-size visibility, dimensions, alpha, and source-file immutability. Visual approval remains pending.

No pack/v1 file, postcard-gifts/v1 file, app source, production asset, or git history was changed. Stop here for visual approval.
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
    manifest_path = ROOT / "manifest.v2.json"
    files = [
        path
        for path in sorted(ROOT.rglob("*"))
        if path.is_file()
        and path != manifest_path
        and "__pycache__" not in path.parts
    ]
    manifest = {
        "schemaVersion": 2,
        "manifestKind": "pack-physical-insertion-review-pack",
        "collectionId": "pack-physical-insertion-v2",
        "status": STATUS,
        "shippingEligible": False,
        "createdAt": str(date.today()),
        "root": "docs/art/candidates/pack/v2",
        "selfExcludedFromFileHashes": True,
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
    before_inputs = snapshot_inputs()
    placement_metadata, composites = build_composites()
    for viewport in ((390, 844), (430, 932)):
        draw_mobile_review(
            viewport,
            "populated",
            "outing-kit",
            composites["outing-kit"],
        )
        draw_mobile_review(
            viewport,
            "selected",
            "wish-observation-kit",
            composites["wish-observation-kit"],
        )
        draw_mobile_review(
            viewport,
            "scroll",
            "play-kit",
            composites["play-kit"],
        )
    make_contact_sheet(composites)
    after_inputs = snapshot_inputs()
    write_metadata(placement_metadata)
    write_qa(placement_metadata, before_inputs, after_inputs)
    write_readme()
    write_manifest()


if __name__ == "__main__":
    main()
