#!/usr/bin/env python3
"""Build the non-shipping opened-pack watercolor review pack."""

from __future__ import annotations

from collections import deque
from datetime import date
from hashlib import sha256
import json
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[4]
SOURCE = ROOT / "source"
MASTERS = ROOT / "masters"
RUNTIME = ROOT / "runtime"
REVIEWS = ROOT / "reviews"

GENERATED_SOURCE = SOURCE / "pack-opened-source-generated-v01.png"
ITEM_BOARD = (
    REPO
    / "docs/art/candidates/calibration"
    / "calibration-non-final--item-board--starter-set--candidate-a--v01.png"
)
HOME_REVIEWS = {
    (390, 844): (
        REPO
        / "docs/art/candidates/home/v3/reviews"
        / "mobile-review--390x844--at-home--non-shipping-v03.png"
    ),
    (430, 932): (
        REPO
        / "docs/art/candidates/home/v3/reviews"
        / "mobile-review--430x932--at-home--non-shipping-v03.png"
    ),
}

MASTER_SIZE = 1536
RUNTIME_SIZES = (342, 382)
STATUS = "NON-SHIPPING / VISUAL-REVIEW-ONLY"

BASE_MASTER = MASTERS / "pack-opened-base--master-1536--non-shipping-v01.png"
RIM_MASTER = (
    MASTERS
    / "pack-opened-foreground-rim--master-1536--non-shipping-v01.png"
)

GENERATION_PROMPT = (
    "Create one centered, physically believable opened travel satchel as a "
    "reusable watercolor game asset, matching the supplied approved closed "
    "navigation satchel: muted sage woven body, warm ochre-tan leather flap "
    "and straps, antique-brass buckles, and the rolled cream blanket secured "
    "on the left. Show the flap hinged upward and backward, a lined cavity, "
    "three believable organizing zones, and a broad curved foreground lip "
    "that can occlude inserted item art. Use the locked restrained watercolor "
    "B intensity, thin warm gray-brown contours, low saturation, soft "
    "imperfect edges, and a transparent square canvas. No products, cat, "
    "scene, floor, text, numbers, labels, emoji, UI, logo, or watermark."
)


def ensure_directories() -> None:
    for directory in (SOURCE, MASTERS, RUNTIME, REVIEWS):
        directory.mkdir(parents=True, exist_ok=True)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def flattened_pixels(image: Image.Image) -> list:
    getter = getattr(image, "get_flattened_data", None)
    return list(getter() if getter else image.getdata())


def zero_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = []
    for red, green, blue, alpha in flattened_pixels(rgba):
        pixels.append((red, green, blue, alpha) if alpha else (0, 0, 0, 0))
    rgba.putdata(pixels)
    return rgba


def dematte_connected_light_background(
    source: Image.Image,
    *,
    luminance_floor: int,
    chroma_ceiling: int,
    enclosed_seeds: Iterable[tuple[int, int]] = (),
) -> Image.Image:
    """Remove a generated checker/paper matte without erasing enclosed light art."""

    rgb = source.convert("RGB")
    width, height = rgb.size
    values = flattened_pixels(rgb)
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
    edge_values = flattened_pixels(edge_zone)

    output = []
    for index, (red, green, blue) in enumerate(values):
        if background[index]:
            output.append((0, 0, 0, 0))
            continue

        alpha = 255
        if edge_values[index]:
            luminance = (red * 54 + green * 183 + blue * 19) / 256
            chroma = max(red, green, blue) - min(red, green, blue)
            color_evidence = chroma / max(1, chroma_ceiling * 1.45)
            value_evidence = (242 - luminance) / 62
            foreground = clamp(max(color_evidence, value_evidence))
            foreground = foreground * foreground * (3 - 2 * foreground)
            alpha = round(255 * foreground)
        output.append((red, green, blue, alpha))

    rgba = Image.new("RGBA", (width, height))
    rgba.putdata(output)
    return zero_transparent_rgb(rgba)


def resize_rgba(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return zero_transparent_rgb(
        image.convert("RGBA").resize(size, Image.Resampling.LANCZOS)
    )


def build_source_and_layers() -> None:
    source = Image.open(GENERATED_SOURCE)
    if source.mode == "RGBA" and source.getextrema()[3][0] == 0:
        clean = zero_transparent_rgb(source)
    else:
        clean = dematte_connected_light_background(
            source,
            luminance_floor=214,
            chroma_ceiling=20,
            enclosed_seeds=((384, 72), (580, 68)),
        )

    clean.save(GENERATED_SOURCE, optimize=True)
    master = resize_rgba(clean, (MASTER_SIZE, MASTER_SIZE))
    master.save(BASE_MASTER, optimize=True)

    scale = MASTER_SIZE / 1024
    rim_points_source = (
        (156, 528),
        (190, 536),
        (222, 562),
        (256, 598),
        (330, 630),
        (420, 648),
        (514, 653),
        (610, 641),
        (702, 616),
        (780, 578),
        (834, 530),
        (872, 552),
        (908, 668),
        (900, 792),
        (856, 862),
        (780, 904),
        (640, 926),
        (460, 936),
        (286, 926),
        (188, 892),
        (128, 830),
        (110, 706),
        (118, 606),
    )
    antialias = 4
    mask = Image.new("L", (MASTER_SIZE * antialias, MASTER_SIZE * antialias), 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(
        [
            (
                round(x * scale * antialias),
                round(y * scale * antialias),
            )
            for x, y in rim_points_source
        ],
        fill=255,
    )
    blanket_points_source = (
        (102, 494),
        (124, 470),
        (206, 470),
        (240, 505),
        (244, 588),
        (212, 620),
        (118, 620),
        (96, 574),
    )
    draw.polygon(
        [
            (
                round(x * scale * antialias),
                round(y * scale * antialias),
            )
            for x, y in blanket_points_source
        ],
        fill=255,
    )
    mask = mask.resize((MASTER_SIZE, MASTER_SIZE), Image.Resampling.LANCZOS)
    rim = master.copy()
    rim.putalpha(ImageChops.multiply(master.getchannel("A"), mask))
    rim = zero_transparent_rgb(rim)
    rim.save(RIM_MASTER, optimize=True)

    for size in RUNTIME_SIZES:
        resize_rgba(master, (size, size)).save(
            RUNTIME
            / f"pack-opened-base--css-{size}--non-shipping-v01.png",
            optimize=True,
        )
        resize_rgba(rim, (size, size)).save(
            RUNTIME
            / f"pack-opened-foreground-rim--css-{size}--non-shipping-v01.png",
            optimize=True,
        )


def get_font(size: int, *, semibold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("/System/Library/Fonts/PingFang.ttc"),
        Path("/System/Library/Fonts/Supplemental/Songti.ttc"),
        Path("/System/Library/Fonts/Hiragino Sans GB.ttc"),
        Path("/Library/Fonts/Arial Unicode.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            try:
                return ImageFont.truetype(
                    str(candidate),
                    size=size,
                    index=1 if semibold else 0,
                )
            except OSError:
                continue
    return ImageFont.load_default()


def fit_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    *,
    font: ImageFont.ImageFont,
    max_width: int,
) -> list[str]:
    lines: list[str] = []
    current = ""
    for character in text:
        proposal = current + character
        if current and draw.textbbox((0, 0), proposal, font=font)[2] > max_width:
            lines.append(current)
            current = character
        else:
            current = proposal
    if current:
        lines.append(current)
    return lines


def draw_wrapped_text(
    draw: ImageDraw.ImageDraw,
    position: tuple[int, int],
    text: str,
    *,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    max_width: int,
    line_height: int,
    max_lines: int = 3,
) -> int:
    x, y = position
    lines = fit_text(draw, text, font=font, max_width=max_width)[:max_lines]
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        y += line_height
    return y


def trim_alpha(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    box = alpha.getbbox()
    return image.crop(box) if box else image


def load_review_items() -> dict[str, Image.Image]:
    board = Image.open(ITEM_BOARD).convert("RGB")
    crops = {
        "ticket": (540, 82, 990, 382),
        "yarn": (1010, 66, 1455, 390),
        "camera": (160, 585, 655, 1008),
    }
    items: dict[str, Image.Image] = {}
    for item_id, box in crops.items():
        crop = board.crop(box)
        clean = dematte_connected_light_background(
            crop,
            luminance_floor=207,
            chroma_ceiling=42,
        )
        items[item_id] = trim_alpha(clean)
    return items


def paste_contain(
    destination: Image.Image,
    source: Image.Image,
    *,
    center_x: int,
    bottom_y: int,
    max_width: int,
    max_height: int,
) -> None:
    item = source.copy()
    item.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    x = round(center_x - item.width / 2)
    y = bottom_y - item.height
    destination.alpha_composite(item, (x, y))


def render_bag(
    size: int,
    *,
    items: tuple[str, ...],
    item_art: dict[str, Image.Image],
) -> Image.Image:
    base_path = RUNTIME / f"pack-opened-base--css-{size}--non-shipping-v01.png"
    rim_path = (
        RUNTIME
        / f"pack-opened-foreground-rim--css-{size}--non-shipping-v01.png"
    )
    base = (
        Image.open(base_path).convert("RGBA")
        if base_path.exists()
        else resize_rgba(Image.open(BASE_MASTER), (size, size))
    )
    rim = (
        Image.open(rim_path).convert("RGBA")
        if rim_path.exists()
        else resize_rgba(Image.open(RIM_MASTER), (size, size))
    )
    result = base.copy()
    slots = (
        (0.325, 0.635),
        (0.500, 0.642),
        (0.690, 0.622),
    )
    for index, item_id in enumerate(items[:3]):
        x, y = slots[index]
        paste_contain(
            result,
            item_art[item_id],
            center_x=round(size * x),
            bottom_y=round(size * y),
            max_width=round(size * 0.21),
            max_height=round(size * 0.23),
        )
    result.alpha_composite(rim)
    return result


def draw_summary(
    canvas: Image.Image,
    *,
    box: tuple[int, int, int, int],
    count: str,
    copy: str,
) -> None:
    draw = ImageDraw.Draw(canvas)
    left, top, right, bottom = box
    draw.rounded_rectangle(box, radius=16, fill=(233, 238, 223, 238))
    count_font = get_font(16, semibold=True)
    label_font = get_font(10)
    copy_font = get_font(11)
    count_width = draw.textbbox((0, 0), count, font=count_font)[2]
    draw.text(
        (left + 43 - count_width / 2, top + 12),
        count,
        font=count_font,
        fill=(96, 112, 80),
    )
    draw.text(
        (left + 17, top + 38),
        "行囊格数",
        font=label_font,
        fill=(124, 125, 109),
    )
    draw_wrapped_text(
        draw,
        (left + 88, top + 12),
        copy,
        font=copy_font,
        fill=(112, 113, 98),
        max_width=right - left - 102,
        line_height=17,
        max_lines=3,
    )


def draw_empty_box(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
) -> None:
    draw.rounded_rectangle(
        box,
        radius=13,
        fill=(255, 252, 241, 120),
        outline=(156, 154, 137),
        width=1,
    )
    font = get_font(11)
    bounds = draw.textbbox((0, 0), text, font=font)
    x = (box[0] + box[2] - (bounds[2] - bounds[0])) / 2
    y = (box[1] + box[3] - (bounds[3] - bounds[1])) / 2 - 2
    draw.text((x, y), text, font=font, fill=(124, 125, 109))


def draw_item_card(
    canvas: Image.Image,
    *,
    y: int,
    width: int,
    token: str,
    title: str,
    kind: str,
    hint: str,
    action: str,
    detail: str | None = None,
    disabled: bool = False,
) -> int:
    draw = ImageDraw.Draw(canvas)
    x = 0
    height = 92 if detail else 72
    draw.rounded_rectangle(
        (x, y, width, y + height),
        radius=15,
        fill=(255, 252, 241, 222),
        outline=(174, 171, 151),
        width=1,
    )
    draw.rounded_rectangle(
        (x + 10, y + 12, x + 56, y + 58),
        radius=13,
        fill=(238, 231, 211),
        outline=(164, 166, 142),
        width=1,
    )
    token_font = get_font(16, semibold=True)
    title_font = get_font(13, semibold=True)
    small_font = get_font(10)
    action_font = get_font(10, semibold=True)
    draw.text((x + 25, y + 24), token, font=token_font, fill=(101, 113, 87))
    draw.text((x + 68, y + 12), title, font=title_font, fill=(79, 81, 68))
    draw.text((x + 68, y + 32), kind, font=small_font, fill=(124, 125, 109))
    draw.text((x + 68, y + 48), hint, font=small_font, fill=(124, 125, 109))
    button_fill = (230, 235, 219) if not disabled else (233, 232, 222)
    button_ink = (91, 105, 77) if not disabled else (157, 156, 143)
    draw.rounded_rectangle(
        (width - 64, y + 21, width - 10, y + 51),
        radius=15,
        fill=button_fill,
        outline=(139, 151, 121),
        width=1,
    )
    action_bounds = draw.textbbox((0, 0), action, font=action_font)
    action_width = action_bounds[2] - action_bounds[0]
    draw.text(
        (width - 37 - action_width / 2, y + 28),
        action,
        font=action_font,
        fill=button_ink,
    )
    if detail:
        draw.text(
            (x + 68, y + 67),
            detail,
            font=small_font,
            fill=(105, 116, 91),
        )
    return y + height


def make_drawer_shell(
    viewport: tuple[int, int],
    state_label: str,
) -> tuple[Image.Image, int, int]:
    width, height = viewport
    background = Image.open(HOME_REVIEWS[viewport]).convert("RGBA")
    if background.size != viewport:
        background = background.resize(viewport, Image.Resampling.LANCZOS)
    dim = Image.new("RGBA", viewport, (48, 49, 40, 86))
    background.alpha_composite(dim)

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
    eyebrow = get_font(10)
    title = get_font(22, semibold=True)
    close = get_font(20)
    label = get_font(9)
    draw.text((24, top + 33), "为下一次旅行", font=eyebrow, fill=(124, 125, 109))
    draw.text((24, top + 47), "行囊", font=title, fill=(79, 81, 68))
    draw.ellipse(
        (width - 62, top + 33, width - 24, top + 71),
        fill=(255, 252, 241),
        outline=(154, 153, 134),
        width=1,
    )
    draw.text((width - 50, top + 38), "×", font=close, fill=(79, 81, 68))
    review_label = f"NON-SHIPPING · PACK V1 · {state_label}"
    review_bounds = draw.textbbox((0, 0), review_label, font=label)
    review_width = review_bounds[2] - review_bounds[0]
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


def draw_overflow_state(
    canvas: Image.Image,
    *,
    content_top: int,
    bottom: int,
    inner: int,
    bag: Image.Image,
) -> None:
    visible_height = bottom - content_top
    surface = Image.new("RGBA", (inner, 1150), (0, 0, 0, 0))
    draw_summary(
        surface,
        box=(0, 0, inner, 68),
        count="3 / 3",
        copy="已经准备好了。还可以调整，但不能命令它立刻出发。",
    )
    surface.alpha_composite(bag, (0, 76))
    draw = ImageDraw.Draw(surface)
    section_font = get_font(12, semibold=True)
    draw.text((0, 424), "已经放好", font=section_font, fill=(79, 81, 68))
    y = 448
    y = draw_item_card(
        surface,
        y=y,
        width=inner,
        token="球",
        title="毛线球",
        kind="小玩具",
        hint="路上也可以玩一会儿。",
        action="取出",
    ) + 9
    y = draw_item_card(
        surface,
        y=y,
        width=inner,
        token="票",
        title="车票",
        kind="心愿",
        hint="写着一个心愿地。",
        action="取出",
        detail="心愿地：北京 · 故宫角楼",
    ) + 9
    y = draw_item_card(
        surface,
        y=y,
        width=inner,
        token="相",
        title="小相机",
        kind="小玩具",
        hint="说不定会多寄一张风景回来。",
        action="取出",
    ) + 18
    draw.text((0, y), "家里可用", font=section_font, fill=(79, 81, 68))
    y += 25
    y = draw_item_card(
        surface,
        y=y,
        width=inner,
        token="饼",
        title="小鱼饼",
        kind="有 2",
        hint="也许会想起沿路好吃的东西。",
        action="放入",
        disabled=True,
    ) + 9
    draw_item_card(
        surface,
        y=y,
        width=inner,
        token="毯",
        title="小毛毯",
        kind="有 1",
        hint="困了就找个安静的地方蜷起来。",
        action="放入",
        disabled=True,
    )

    scroll_offset = 280
    viewport = surface.crop((0, scroll_offset, inner, scroll_offset + visible_height))
    canvas.alpha_composite(viewport, (24, content_top))
    overlay = ImageDraw.Draw(canvas)
    track_x = 24 + inner - 3
    overlay.rounded_rectangle(
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
    overlay.rounded_rectangle(
        (track_x - 1, thumb_y, track_x + 3, thumb_y + thumb_height),
        radius=2,
        fill=(125, 137, 107),
    )


def make_mobile_review(
    viewport: tuple[int, int],
    state: str,
    item_art: dict[str, Image.Image],
) -> None:
    width, height = viewport
    canvas, drawer_top, _ = make_drawer_shell(viewport, state.upper())
    inner = width - 48
    content_top = drawer_top + 92
    bottom = height - 28
    draw = ImageDraw.Draw(canvas)

    if state == "overflow-scroll":
        bag = render_bag(
            inner,
            items=("yarn", "ticket", "camera"),
            item_art=item_art,
        )
        draw_overflow_state(
            canvas,
            content_top=content_top,
            bottom=bottom,
            inner=inner,
            bag=bag,
        )
    else:
        if state == "empty":
            count = "0 / 3"
            summary = "放入第一件物品后，小猫会自己等待合适的出发时机。"
            bag_items: tuple[str, ...] = ()
        elif state == "populated":
            count = "3 / 3"
            summary = "已经准备好了。还可以调整，但不能命令它立刻出发。"
            bag_items = ("yarn", "ticket", "camera")
        else:
            count = "2 / 3"
            summary = "车票仍在家里；当前界面只提供行内心愿地选择。"
            bag_items = ("yarn", "camera")

        draw_summary(
            canvas,
            box=(24, content_top, width - 24, content_top + 68),
            count=count,
            copy=summary,
        )
        bag_y = content_top + 70
        bag_size = inner if state != "selected-inline-detail" else round(inner * 0.78)
        bag = render_bag(bag_size, items=bag_items, item_art=item_art)
        bag_x = round((width - bag_size) / 2)
        canvas.alpha_composite(bag, (bag_x, bag_y))

        section_font = get_font(12, semibold=True)
        small_font = get_font(10)
        if state == "empty":
            y = bag_y + bag_size - 3
            draw.text((24, y), "已经放好", font=section_font, fill=(79, 81, 68))
            draw_empty_box(
                draw,
                (24, y + 22, width - 24, y + 65),
                "还没有放入物品。",
            )
            draw.text(
                (24, y + 77),
                "家里可用",
                font=section_font,
                fill=(79, 81, 68),
            )
            draw.text(
                (24, y + 98),
                "先去小铺挑一件小物吧。",
                font=small_font,
                fill=(124, 125, 109),
            )
        elif state == "populated":
            y = bag_y + bag_size - 3
            draw.text((24, y), "已经放好", font=section_font, fill=(79, 81, 68))
            card = Image.new("RGBA", (inner, 80), (0, 0, 0, 0))
            draw_item_card(
                card,
                y=0,
                width=inner,
                token="球",
                title="毛线球",
                kind="小玩具",
                hint="路上也可以玩一会儿。",
                action="取出",
            )
            canvas.alpha_composite(card, (24, y + 21))
        else:
            card_y = bag_y + bag_size - 6
            detail_card = Image.new("RGBA", (inner, 102), (0, 0, 0, 0))
            draw_item_card(
                detail_card,
                y=0,
                width=inner,
                token="票",
                title="车票",
                kind="心愿",
                hint="写着一个心愿地，但不保证照着走。",
                action="放入",
                detail="心愿地：北京 · 故宫角楼  ▾",
            )
            canvas.alpha_composite(detail_card, (24, card_y))

    output = (
        REVIEWS
        / f"mobile-review--{width}x{height}--{state}--non-shipping-v01.png"
    )
    canvas.convert("RGB").save(output, optimize=True)


def checkerboard(size: tuple[int, int], cell: int = 18) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size, (247, 244, 235))
    draw = ImageDraw.Draw(image)
    for y in range(0, height, cell):
        for x in range(0, width, cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle(
                    (x, y, min(x + cell - 1, width), min(y + cell - 1, height)),
                    fill=(230, 229, 221),
                )
    return image


def place_preview(
    sheet: Image.Image,
    art: Image.Image,
    box: tuple[int, int, int, int],
    *,
    checker: bool,
) -> None:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    if checker:
        background = checkerboard((width, height))
        sheet.paste(background, (left, top))
    preview = art.copy()
    preview.thumbnail((width, height), Image.Resampling.LANCZOS)
    x = left + round((width - preview.width) / 2)
    y = top + round((height - preview.height) / 2)
    sheet.alpha_composite(preview.convert("RGBA"), (x, y))


def make_contact_sheet(item_art: dict[str, Image.Image]) -> None:
    sheet = Image.new("RGBA", (1200, 1600), (247, 242, 228, 255))
    draw = ImageDraw.Draw(sheet)
    title = get_font(34, semibold=True)
    heading = get_font(19, semibold=True)
    body = get_font(14)
    small = get_font(12)
    draw.text(
        (52, 42),
        "OPEN PACK · CANDIDATE V1",
        font=title,
        fill=(77, 79, 66),
    )
    draw.text(
        (54, 90),
        "NON-SHIPPING / VISUAL-REVIEW-ONLY · 1200×1600",
        font=body,
        fill=(126, 124, 105),
    )
    draw.line((52, 126, 1148, 126), fill=(173, 158, 126), width=2)

    base = Image.open(BASE_MASTER).convert("RGBA")
    rim = Image.open(RIM_MASTER).convert("RGBA")
    populated = render_bag(
        512,
        items=("yarn", "ticket", "camera"),
        item_art=item_art,
    )

    draw.text((64, 158), "1 · EMPTY COMPOSITE / FALLBACK BASE", font=heading, fill=(78, 80, 67))
    draw.text((622, 158), "2 · POPULATED DEPTH TEST", font=heading, fill=(78, 80, 67))
    place_preview(sheet, base, (52, 195, 575, 700), checker=True)
    place_preview(sheet, populated, (610, 195, 1133, 700), checker=True)

    draw.text((64, 732), "3 · FOREGROUND OCCLUSION RIM", font=heading, fill=(78, 80, 67))
    draw.text((622, 732), "4 · LAYER ORDER / SLOT CONTRACT", font=heading, fill=(78, 80, 67))
    place_preview(sheet, rim, (52, 770, 575, 1255), checker=True)

    panel = (610, 770, 1133, 1255)
    draw.rounded_rectangle(panel, radius=22, fill=(238, 234, 220), outline=(172, 163, 140), width=2)
    layer_rows = (
        ("z30", "UI count, focus and text overlays"),
        ("z20", "generated watercolor foreground rim"),
        ("z10", "existing item art at three anchors"),
        ("z00", "generated full opened-satchel base"),
    )
    y = 815
    for index, (z_value, label) in enumerate(layer_rows):
        fill = (
            (225, 214, 184),
            (198, 203, 162),
            (226, 198, 155),
            (205, 213, 184),
        )[index]
        draw.rounded_rectangle((646, y, 1097, y + 74), radius=14, fill=fill, outline=(139, 131, 108), width=1)
        draw.text((666, y + 14), z_value, font=heading, fill=(76, 78, 65))
        draw.text((730, y + 18), label, font=small, fill=(83, 84, 70))
        y += 96

    draw.line((52, 1290, 1148, 1290), fill=(173, 158, 126), width=2)
    draw.text((54, 1320), "REVIEW FINDINGS", font=heading, fill=(78, 80, 67))
    findings = (
        "• The lifted leather flap, lined cavity and curved shell read as one believable opened version of the v3 navigation satchel.",
        "• Three item anchors sit behind the duplicated front shell, so lower item edges are physically occluded instead of floating.",
        "• Source layers contain no text, count, UI, emoji or product art. Existing calibration-board item art appears only in reviews.",
        "• 342 px and 382 px derivatives map to the current drawer border-box widths at 390 px and 430 px viewports.",
        "• The app has no standalone selected-item detail state; the selected review depicts the actual inline wish-destination control.",
    )
    y = 1360
    for finding in findings:
        y = draw_wrapped_text(
            draw,
            (66, y),
            finding,
            font=body,
            fill=(96, 96, 81),
            max_width=1060,
            line_height=22,
            max_lines=2,
        ) + 7
    sheet.convert("RGB").save(
        REVIEWS / "contact-layer-sheet--1200x1600--non-shipping-v01.png",
        optimize=True,
    )


def alpha_metrics(path: Path) -> dict[str, object]:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    alpha_values = flattened_pixels(alpha)
    transparent_indices = [
        index for index, value in enumerate(alpha_values) if value == 0
    ]
    rgba_values = flattened_pixels(image)
    zero_rgb_pass = all(
        rgba_values[index][:3] == (0, 0, 0) for index in transparent_indices
    )
    partial_count = sum(1 for value in alpha_values if 0 < value < 255)
    box = alpha.getbbox()
    if box:
        left, top, right, bottom = box
        padding = {
            "left": left,
            "top": top,
            "right": image.width - right,
            "bottom": image.height - bottom,
        }
    else:
        padding = {"left": 0, "top": 0, "right": 0, "bottom": 0}
    return {
        "path": path.relative_to(ROOT).as_posix(),
        "width": image.width,
        "height": image.height,
        "mode": Image.open(path).mode,
        "alphaExtrema": list(alpha.getextrema()),
        "partialAlphaPixelCount": partial_count,
        "transparentPixelRgbZero": zero_rgb_pass,
        "contentPadding": padding,
    }


def write_metadata() -> None:
    metadata = {
        "schemaVersion": 1,
        "status": STATUS,
        "shippingEligible": False,
        "collectionId": "pack-opened-watercolor-v1",
        "coordinateConvention": {
            "units": "pixels",
            "canvas": {"width": MASTER_SIZE, "height": MASTER_SIZE},
            "origin": "top-left",
            "bounds": "x/y are top-left; width extends right; height extends down",
            "itemAnchor": "bottom-center point",
        },
        "sourceEvidence": {
            "issue": "https://github.com/CCharlesMeng/BraveCat/issues/19",
            "filesRead": [
                "CONTEXT.md",
                "src/App.svelte",
                "src/app.css",
                "src/lib/assets/starterItems.ts",
                "src/lib/economy/index.ts",
                "docs/art/prompt-pack.calibration.v1.json",
                "docs/art/style-ref-home.png",
                "docs/art/style-ref-postcard.png",
                "docs/art/style-ref-poses.png",
                "docs/art/candidates/home/v3/icons/nav-icon--pack--master-512--non-shipping-v03.png",
            ],
        },
        "runtimeLayoutEvidence": {
            "drawerMaxWidth": 470,
            "drawerInlinePadding": 24,
            "drawerMaxHeight": "min(78dvh, 720px)",
            "drawerContentOverflow": "overflow-y: auto",
            "viewportSlots": [
                {
                    "viewport": {"width": 390, "height": 844},
                    "drawerContentBorderBoxWidth": 342,
                    "drawerContentUsableWidthAfterRightPadding": 340,
                },
                {
                    "viewport": {"width": 430, "height": 932},
                    "drawerContentBorderBoxWidth": 382,
                    "drawerContentUsableWidthAfterRightPadding": 380,
                },
            ],
            "currentItemTokenSlot": {"width": 46, "height": 46},
            "compactItemCardMinHeight": 72,
            "packCapacity": 3,
        },
        "layerStack": [
            {
                "z": 0,
                "role": "complete opened-satchel base and one-layer fallback",
                "file": BASE_MASTER.relative_to(ROOT).as_posix(),
                "note": "The complete base intentionally retains the front shell. Item layers cover it; z20 restores that shell for deterministic occlusion.",
            },
            {
                "z": 10,
                "role": "external existing item assets",
                "file": None,
                "note": "No product art is included or redefined by this pack. Review composites use crops from the existing calibration item board only.",
            },
            {
                "z": 20,
                "role": "foreground shell and curved rim occluder",
                "file": RIM_MASTER.relative_to(ROOT).as_posix(),
            },
            {
                "z": 30,
                "role": "application UI overlays",
                "file": None,
                "note": "Counts, copy, focus, actions and badges remain live UI.",
            },
        ],
        "itemSlots": [
            {
                "id": "left-inner-sleeve",
                "bounds": {"x": 372, "y": 675, "width": 270, "height": 285},
                "anchor": {"x": 499, "y": 975},
                "recommendedItemMax": {"width": 230, "height": 260},
            },
            {
                "id": "center-deep-pocket",
                "bounds": {"x": 612, "y": 668, "width": 330, "height": 323},
                "anchor": {"x": 768, "y": 986},
                "recommendedItemMax": {"width": 255, "height": 280},
            },
            {
                "id": "right-inner-sleeve",
                "bounds": {"x": 930, "y": 675, "width": 270, "height": 270},
                "anchor": {"x": 1060, "y": 956},
                "recommendedItemMax": {"width": 230, "height": 250},
            },
        ],
        "safePadding": {
            "minimumTransparentCanvasPadding": 72,
            "measuredOnBaseMaster": alpha_metrics(BASE_MASTER)["contentPadding"],
        },
        "overlayZones": {
            "countBadge": {
                "bounds": {"x": 1280, "y": 70, "width": 190, "height": 112},
                "note": "Transparent upper-right reserve; do not bake count into art.",
            },
            "supportingText": {
                "bounds": {"x": 220, "y": 1435, "width": 1096, "height": 78},
                "note": "Optional one-line review reserve only; production copy should normally sit outside the art element.",
            },
            "selectedSlotFocus": {
                "bounds": {"x": 598, "y": 650, "width": 360, "height": 350},
                "note": "UI-only focus affordance around center slot; absent from source art.",
            },
        },
        "runtimeDerivatives": [
            {
                "cssDisplay": {"width": size, "height": size},
                "base": f"runtime/pack-opened-base--css-{size}--non-shipping-v01.png",
                "foregroundRim": f"runtime/pack-opened-foreground-rim--css-{size}--non-shipping-v01.png",
                "reviewOnly": True,
            }
            for size in RUNTIME_SIZES
        ],
        "stateContract": {
            "empty": "No item layers; all three lined organizing zones remain visible.",
            "populated": "Up to three unique items, one per slot; at most one wish item under current reducer rules.",
            "travelingLocked": "Items remain visible while current add/remove actions are disabled.",
            "selectedItemDetail": {
                "supportedAsStandaloneState": False,
                "currentEquivalent": "The ticket card exposes an inline wish destination select; there is no selected-item state or detail panel.",
            },
            "overflow": "The drawer header stays fixed while .drawer-content scrolls vertically.",
        },
    }
    (ROOT / "composition-metadata.v1.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def write_generation_brief() -> None:
    brief = {
        "schemaVersion": 1,
        "status": STATUS,
        "shippingEligible": False,
        "createdAt": str(date.today()),
        "tool": "Cursor GenerateImage",
        "model": "not-reported",
        "seed": None,
        "prompt": GENERATION_PROMPT,
        "referenceImages": [
            "docs/art/candidates/home/v3/icons/nav-icon--pack--master-512--non-shipping-v03.png",
            "docs/art/style-ref-home.png",
            "docs/art/style-ref-poses.png",
        ],
        "output": GENERATED_SOURCE.relative_to(ROOT).as_posix(),
        "postprocess": [
            "Removed the generator's baked neutral checker matte by edge-connected dematting.",
            "Converted to straight-alpha RGBA and zeroed RGB in fully transparent pixels.",
            "Upscaled the clean 1024 source to 1536 masters with Lanczos resampling.",
            "Derived the aligned foreground shell/rim occlusion layer from the generated watercolor source.",
        ],
        "sourceArtProhibitions": [
            "no baked text or numbers",
            "no labels or emoji",
            "no UI chrome",
            "no watermark or signature",
            "no product-item art",
        ],
    }
    (SOURCE / "generation-brief.v1.json").write_text(
        json.dumps(brief, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def write_qa_report() -> None:
    transparent_files = [
        BASE_MASTER,
        RIM_MASTER,
        GENERATED_SOURCE,
        *sorted(RUNTIME.glob("*.png")),
    ]
    checks = [alpha_metrics(path) for path in transparent_files]
    report = {
        "schemaVersion": 1,
        "status": STATUS,
        "shippingEligible": False,
        "automatedChecks": {
            "allTransparentPixelRgbZero": all(
                check["transparentPixelRgbZero"] for check in checks
            ),
            "allSourceAndLayerFilesRgba": all(
                check["mode"] == "RGBA" for check in checks
            ),
            "allHaveSoftAlphaEdges": all(
                check["partialAlphaPixelCount"] > 0 for check in checks
            ),
            "files": checks,
        },
        "visualChecks": [
            {
                "check": "alpha edges",
                "result": "pass-with-human-approval-pending",
                "finding": "Neutral generator checker matte removed; soft partial-alpha perimeter retained; no paper rectangle remains.",
            },
            {
                "check": "pocket and item occlusion",
                "result": "pass",
                "finding": "Review item bottoms are restored behind the generated front shell/rim layer.",
            },
            {
                "check": "physical depth",
                "result": "pass",
                "finding": "Raised flap, back lining, stitched dividers, deep center pocket, side sleeves and front shell establish a coherent cavity.",
            },
            {
                "check": "mobile legibility",
                "result": "pass",
                "finding": "Bag silhouette, three slots and populated-item separation remain readable at 342 px and 382 px.",
            },
            {
                "check": "safe areas",
                "result": "pass",
                "finding": "Transparent padding survives both derivatives; upper-right count reserve and lower text reserve do not intersect critical buckles or slots.",
            },
            {
                "check": "v3 navigation consistency",
                "result": "pass-with-human-approval-pending",
                "finding": "Sage shell, tan flap, twin leather straps, brass buckles and left blanket roll match the approved closed satchel family.",
            },
            {
                "check": "source art exclusions",
                "result": "pass",
                "finding": "Masters and runtime derivatives contain no text, numbers, labels, emoji, UI, watermark, cat, landmark, postcard content or product item art.",
            },
        ],
        "reviewOnlyItemProxies": {
            "source": "docs/art/candidates/calibration/calibration-non-final--item-board--starter-set--candidate-a--v01.png",
            "usedIn": [
                "populated reviews",
                "selected-inline-detail reviews",
                "overflow-scroll reviews",
                "contact/layer sheet",
            ],
            "emittedAsStandaloneAssets": False,
            "items": ["yarn-ball", "ticket", "small-camera"],
        },
        "knownLimitations": [
            "The source was generated at 1024×1024; 1536×1536 masters are deterministic upscales for review, not approved production redraws.",
            "The app does not currently render item imageSrc in pack cards and has no standalone selected-item/detail state.",
            "Review composites propose where the opened bag could sit; no application integration or CSS change has been made.",
            "Final approval must inspect any remaining fringe color against the intended drawer paper and dark backdrop before promotion.",
        ],
        "approval": {
            "decision": "pending",
            "reviewer": "",
            "reviewedAt": "",
            "notes": "",
        },
    }
    (ROOT / "qa-report.v1.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def write_readme() -> None:
    readme = f"""# Open Pack Watercolor Candidate v1

**{STATUS}.** Nothing in this directory is approved for production, runtime use, or integration. Stop for visual approval.

## Scope

This isolated candidate pack proposes an opened interior for the approved v3 navigation satchel. The design keeps the same muted sage woven shell, ochre-tan leather flap and straps, antique-brass buckles, and left-side rolled blanket. The flap is lifted behind a lined cavity with three organizing zones and a broad foreground shell that can occlude inserted item assets.

No app code, home/shop/postcard candidate directory, production asset, Minho asset, landmark, or postcard composition was changed.

## Current UI inventory

- `PACK_CAPACITY` is 3. A pack can hold three unique items and at most one wish ticket.
- The initial economy has 12 treats, no owned items, and an empty pack, so the actual first pack state is `0 / 3` with no available items.
- The current pack drawer is text/card based. It has no bag illustration and does not render `item.imageSrc`.
- Packed and available rows use a CSS `46×46` token containing the first Chinese character of the item name.
- Empty sections are dashed CSS boxes. The pack summary, cards, buttons, select, drawer, handle, and backdrop are CSS UI.
- Emoji remain in unrelated current UI: the top treat balance, windowsill fish, and shop price action. The pack drawer itself uses character tokens rather than emoji.
- Add/remove actions are disabled while traveling. The drawer content scrolls vertically.
- There is no standalone selected-item or detail state. The only item-specific detail control is the inline wish-destination `<select>` on an available ticket card.
- Catalog paths exist for eight item PNGs, but those files are absent from this worktree and the current pack UI does not use them.

## Layer contract

1. `z00` — `masters/pack-opened-base--master-1536--non-shipping-v01.png`
2. `z10` — real existing item assets supplied by the application; none are included in this pack
3. `z20` — `masters/pack-opened-foreground-rim--master-1536--non-shipping-v01.png`
4. `z30` — live UI count, copy, focus, buttons and badges

The base is deliberately a complete one-layer fallback. When items are added at `z10`, they may temporarily cover the base's front shell; the pixel-aligned `z20` shell/rim restores the physical occlusion. See `composition-metadata.v1.json` for exact slot bounds, bottom-center anchors, safe padding, overlay zones, and derivative mapping.

## Transparent art

- `source/pack-opened-source-generated-v01.png` — cleaned 1024×1024 RGBA generated source
- `masters/pack-opened-base--master-1536--non-shipping-v01.png`
- `masters/pack-opened-foreground-rim--master-1536--non-shipping-v01.png`
- `runtime/pack-opened-base--css-342--non-shipping-v01.png`
- `runtime/pack-opened-foreground-rim--css-342--non-shipping-v01.png`
- `runtime/pack-opened-base--css-382--non-shipping-v01.png`
- `runtime/pack-opened-foreground-rim--css-382--non-shipping-v01.png`

The 342 px and 382 px review derivatives come from the current drawer border-box widths at 390 px and 430 px viewports (`viewport width - 2 × 24 px drawer padding`). They are review-only, not a final density policy.

## Static reviews

Both 390×844 and 430×932 are provided for:

- `empty` — real initial `0 / 3` state
- `populated` — three filled anchors and `3 / 3`
- `selected-inline-detail` — the actual inline wish destination control, explicitly not a nonexistent standalone detail screen
- `overflow-scroll` — the current fixed drawer header plus vertically scrolled drawer content

Review item images are temporary crops of the existing non-final calibration item board and appear only inside flattened review composites. This pack emits no standalone item files and does not redefine shop products.

`reviews/contact-layer-sheet--1200x1600--non-shipping-v01.png` shows the empty base, populated depth test, isolated foreground rim, layer order, and findings.

## QA and approval gate

`qa-report.v1.json` records RGBA mode, alpha extrema, partial-alpha edge counts, zero RGB under fully transparent pixels, content padding, physical-depth findings, mobile legibility, and known limitations. Human approval remains required, especially for residual fringe color and final drawer placement.

Do not promote, integrate, rename as production, or treat this candidate as approved until the user explicitly selects it.
"""
    (ROOT / "README.md").write_text(readme, encoding="utf-8")


def classify_file(path: Path) -> dict[str, object]:
    relative = path.relative_to(ROOT).as_posix()
    item: dict[str, object] = {
        "path": relative,
        "status": STATUS,
        "shippingEligible": False,
        "bytes": path.stat().st_size,
        "sha256": sha256(path.read_bytes()).hexdigest(),
    }
    if path.suffix.lower() == ".png":
        image = Image.open(path)
        item.update(
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
        item["kind"] = "metadata"
    elif path.suffix.lower() == ".py":
        item["kind"] = "source-script"
    else:
        item["kind"] = "documentation"
    return item


def write_manifest() -> None:
    manifest_path = ROOT / "manifest.v1.json"
    files = [
        path
        for path in sorted(ROOT.rglob("*"))
        if path.is_file()
        and path != manifest_path
        and "__pycache__" not in path.parts
        and path.name != "pack-opened-source-grid.png"
    ]
    manifest = {
        "schemaVersion": 1,
        "manifestKind": "pack-opened-watercolor-review-pack",
        "collectionId": "pack-opened-watercolor-v1",
        "status": STATUS,
        "shippingEligible": False,
        "createdAt": str(date.today()),
        "root": "docs/art/candidates/pack/v1",
        "selfExcludedFromFileHashes": True,
        "fileCount": len(files),
        "files": [classify_file(path) for path in files],
    }
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    ensure_directories()
    build_source_and_layers()
    item_art = load_review_items()
    for viewport in HOME_REVIEWS:
        for state in (
            "empty",
            "populated",
            "selected-inline-detail",
            "overflow-scroll",
        ):
            make_mobile_review(viewport, state, item_art)
    make_contact_sheet(item_art)
    write_generation_brief()
    write_metadata()
    write_qa_report()
    write_readme()
    write_manifest()


if __name__ == "__main__":
    main()
