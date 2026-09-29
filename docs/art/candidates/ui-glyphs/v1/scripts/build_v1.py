#!/usr/bin/env python3
"""Build the deterministic, non-shipping GEN-05 utility-glyph review pack."""

from __future__ import annotations

import binascii
import hashlib
import json
import math
import re
import struct
import zlib
from collections import deque
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
STATUS = "NON-SHIPPING / VISUAL-REVIEW-ONLY"
VERSION = "v01"
CREATED_AT = "2026-07-21"
VIEWBOX = 24.0
STROKE_WIDTH = 1.75
GLYPH_ORDER = ["close", "export", "import", "lock", "retry"]

COLORS = {
    "ink": (79, 81, 68),
    "line_preview": (95, 91, 78),
    "ink_soft": (124, 125, 109),
    "paper": (246, 240, 223),
    "paper_deep": (235, 224, 201),
    "paper_light": (255, 250, 240),
    "sage": (135, 155, 112),
    "sage_action": (228, 234, 216),
    "focus": (102, 125, 78),
    "error": (155, 95, 80),
    "dark_paper": (79, 81, 68),
}


def sample_arc(
    cx: float,
    cy: float,
    radius: float,
    start_degrees: float,
    end_degrees: float,
    steps: int,
) -> list[tuple[float, float]]:
    return [
        (
            cx + radius * math.cos(math.radians(start_degrees + (end_degrees - start_degrees) * index / steps)),
            cy + radius * math.sin(math.radians(start_degrees + (end_degrees - start_degrees) * index / steps)),
        )
        for index in range(steps + 1)
    ]


def rounded_rect_points(
    left: float,
    top: float,
    right: float,
    bottom: float,
    radius: float,
    corner_steps: int = 5,
) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for cx, cy, start, end in (
        (right - radius, top + radius, -90, 0),
        (right - radius, bottom - radius, 0, 90),
        (left + radius, bottom - radius, 90, 180),
        (left + radius, top + radius, 180, 270),
    ):
        arc = sample_arc(cx, cy, radius, start, end, corner_steps)
        if points:
            arc = arc[1:]
        points.extend(arc)
    points.append(points[0])
    return points


LOCK_SHACKLE = (
    [(8.75, 10.25), (8.75, 8.25)]
    + sample_arc(12.0, 8.25, 3.25, 180, 360, 14)[1:]
    + [(15.25, 10.25)]
)
RETRY_ARC = sample_arc(12.0, 12.0, 7.0, -30, -340, 52)
RETRY_ARC[0] = (18.0, 8.5)
RETRY_ARC[-1] = (18.5, 14.5)

GLYPHS = [
    {
        "id": "close",
        "purpose": "drawer close",
        "semanticCue": "two equal crossing diagonals",
        "svg": [
            '<path d="M6.25 6.25L17.75 17.75M17.75 6.25L6.25 17.75"/>',
        ],
        "strokes": [
            [(6.25, 6.25), (17.75, 17.75)],
            [(17.75, 6.25), (6.25, 17.75)],
        ],
        "linearGridAligned": True,
        "allowedComponentCountsAtAlpha32": [1],
    },
    {
        "id": "export",
        "purpose": "save export",
        "semanticCue": "upward arrow leaving a shared open tray",
        "svg": [
            '<path d="M5.5 13.5v3l1.75 1.75h9.5l1.75-1.75v-3"/>',
            '<path d="M12 14.5V5.25M8.75 8.5L12 5.25l3.25 3.25"/>',
        ],
        "strokes": [
            [(5.5, 13.5), (5.5, 16.5), (7.25, 18.25), (16.75, 18.25), (18.5, 16.5), (18.5, 13.5)],
            [(12.0, 14.5), (12.0, 5.25)],
            [(8.75, 8.5), (12.0, 5.25), (15.25, 8.5)],
        ],
        "linearGridAligned": True,
        "allowedComponentCountsAtAlpha32": [2],
    },
    {
        "id": "import",
        "purpose": "save import",
        "semanticCue": "downward arrow entering the same open tray",
        "svg": [
            '<path d="M5.5 13.5v3l1.75 1.75h9.5l1.75-1.75v-3"/>',
            '<path d="M12 5.25v9.5M8.75 11.5L12 14.75l3.25-3.25"/>',
        ],
        "strokes": [
            [(5.5, 13.5), (5.5, 16.5), (7.25, 18.25), (16.75, 18.25), (18.5, 16.5), (18.5, 13.5)],
            [(12.0, 5.25), (12.0, 14.75)],
            [(8.75, 11.5), (12.0, 14.75), (15.25, 11.5)],
        ],
        "linearGridAligned": True,
        "allowedComponentCountsAtAlpha32": [2],
    },
    {
        "id": "lock",
        "purpose": "traveling Pack locked",
        "semanticCue": "closed shackle, enclosed body, and short keyway",
        "svg": [
            '<rect x="6.5" y="10.25" width="11" height="8" rx="2"/>',
            '<path d="M8.75 10.25v-2a3.25 3.25 0 0 1 6.5 0v2M12 13.75v1.5"/>',
        ],
        "strokes": [
            rounded_rect_points(6.5, 10.25, 17.5, 18.25, 2.0),
            LOCK_SHACKLE,
            [(12.0, 13.75), (12.0, 15.25)],
        ],
        "linearGridAligned": True,
        "allowedComponentCountsAtAlpha32": [1, 2],
    },
    {
        "id": "retry",
        "purpose": "optional recoverable error",
        "semanticCue": "single near-complete circular arrow",
        "svg": [
            '<path d="M18 8.5A7 7 0 1 0 18.5 14.5"/>',
            '<path d="M14.75 7.5L18 8.5l-1-3.25"/>',
        ],
        "strokes": [
            RETRY_ARC,
            [(14.75, 7.5), (18.0, 8.5), (17.0, 5.25)],
        ],
        "linearGridAligned": True,
        "allowedComponentCountsAtAlpha32": [1],
        "curveAlignmentNote": "Circular arc endpoints are optically fitted; straight arrow anchors remain on the quarter-unit grid.",
    },
]


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_json(path: Path, payload: object) -> None:
    write_text(path, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def png_chunk(chunk_type: bytes, payload: bytes) -> bytes:
    checksum = binascii.crc32(chunk_type + payload) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + chunk_type + payload + struct.pack(">I", checksum)


def write_png_rgba(path: Path, width: int, height: int, pixels: bytes | bytearray) -> None:
    assert len(pixels) == width * height * 4
    raw = b"".join(
        b"\x00" + bytes(pixels[row * width * 4 : (row + 1) * width * 4])
        for row in range(height)
    )
    payload = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(raw, level=9))
        + png_chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def read_png_rgba(path: Path) -> tuple[int, int, bytearray]:
    data = path.read_bytes()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError(f"{path} is not PNG")
    offset = 8
    width = height = 0
    compressed = bytearray()
    while offset < len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        chunk_type = data[offset + 4 : offset + 8]
        payload = data[offset + 8 : offset + 8 + length]
        if chunk_type == b"IHDR":
            width, height, depth, color_type, compression, filtering, interlace = struct.unpack(
                ">IIBBBBB", payload
            )
            if (depth, color_type, compression, filtering, interlace) != (8, 6, 0, 0, 0):
                raise ValueError(f"{path} is not an 8-bit non-interlaced RGBA PNG")
        elif chunk_type == b"IDAT":
            compressed.extend(payload)
        elif chunk_type == b"IEND":
            break
        offset += 12 + length
    raw = zlib.decompress(bytes(compressed))
    stride = width * 4
    pixels = bytearray(width * height * 4)
    cursor = 0
    for row in range(height):
        filter_type = raw[cursor]
        if filter_type != 0:
            raise ValueError(f"{path} uses unsupported PNG filter {filter_type}")
        cursor += 1
        pixels[row * stride : (row + 1) * stride] = raw[cursor : cursor + stride]
        cursor += stride
    return width, height, pixels


def segment_distance_squared(
    px: float,
    py: float,
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    length_squared = dx * dx + dy * dy
    if length_squared == 0:
        return (px - x1) ** 2 + (py - y1) ** 2
    position = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length_squared))
    nearest_x = x1 + position * dx
    nearest_y = y1 + position * dy
    return (px - nearest_x) ** 2 + (py - nearest_y) ** 2


MASK_CACHE: dict[tuple[str, int], bytes] = {}


def render_mask(spec: dict[str, object], size: int) -> bytes:
    cache_key = (str(spec["id"]), size)
    if cache_key in MASK_CACHE:
        return MASK_CACHE[cache_key]
    scale = size / VIEWBOX
    strokes = [
        [[point[0] * scale, point[1] * scale] for point in stroke]
        for stroke in spec["strokes"]  # type: ignore[index]
    ]
    segments = [
        (tuple(stroke[index]), tuple(stroke[index + 1]))
        for stroke in strokes
        for index in range(len(stroke) - 1)
    ]
    radius = STROKE_WIDTH * scale / 2
    radius_squared = radius * radius
    all_points = [point for stroke in strokes for point in stroke]
    min_x = max(0, math.floor(min(point[0] for point in all_points) - radius - 1))
    max_x = min(size - 1, math.ceil(max(point[0] for point in all_points) + radius + 1))
    min_y = max(0, math.floor(min(point[1] for point in all_points) - radius - 1))
    max_y = min(size - 1, math.ceil(max(point[1] for point in all_points) + radius + 1))
    supersample = 3 if size >= 64 else 4
    sample_count = supersample * supersample
    mask = bytearray(size * size)
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            hits = 0
            for sy in range(supersample):
                py = y + (sy + 0.5) / supersample
                for sx in range(supersample):
                    px = x + (sx + 0.5) / supersample
                    if any(
                        segment_distance_squared(px, py, start, end) <= radius_squared
                        for start, end in segments
                    ):
                        hits += 1
            if hits:
                mask[y * size + x] = round(255 * hits / sample_count)
    rendered = bytes(mask)
    MASK_CACHE[cache_key] = rendered
    return rendered


def rgba_from_mask(mask: bytes, color: tuple[int, int, int]) -> bytearray:
    pixels = bytearray(len(mask) * 4)
    for index, alpha in enumerate(mask):
        offset = index * 4
        if alpha:
            pixels[offset : offset + 4] = bytes((*color, alpha))
    return pixels


def mask_bounds(mask: bytes, size: int, threshold: int = 0) -> dict[str, object]:
    coordinates = [
        (index % size, index // size)
        for index, alpha in enumerate(mask)
        if alpha > threshold
    ]
    if not coordinates:
        raise ValueError("empty glyph mask")
    left = min(point[0] for point in coordinates)
    top = min(point[1] for point in coordinates)
    right = max(point[0] for point in coordinates)
    bottom = max(point[1] for point in coordinates)
    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "width": right - left + 1,
        "height": bottom - top + 1,
        "padding": {
            "left": left,
            "top": top,
            "right": size - 1 - right,
            "bottom": size - 1 - bottom,
        },
    }


def connected_components(mask: bytes, size: int, threshold: int = 32) -> int:
    return len(component_pixel_counts(mask, size, threshold))


def component_pixel_counts(mask: bytes, size: int, threshold: int = 32) -> list[int]:
    active = {index for index, alpha in enumerate(mask) if alpha > threshold}
    counts: list[int] = []
    while active:
        component_count = 1
        queue = deque([active.pop()])
        while queue:
            index = queue.popleft()
            x = index % size
            y = index // size
            for dx, dy in ((-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)):
                nx = x + dx
                ny = y + dy
                if 0 <= nx < size and 0 <= ny < size:
                    neighbor = ny * size + nx
                    if neighbor in active:
                        active.remove(neighbor)
                        queue.append(neighbor)
                        component_count += 1
        counts.append(component_count)
    return sorted(counts, reverse=True)


def mask_metrics(mask: bytes, size: int) -> dict[str, object]:
    alpha_sum = sum(mask)
    weighted = [(index % size, index // size, alpha) for index, alpha in enumerate(mask) if alpha]
    return {
        "bounds": mask_bounds(mask, size),
        "boundsAtAlpha32": mask_bounds(mask, size, 32),
        "alphaExtrema": [min(mask), max(mask)],
        "partialAlphaPixelCount": sum(1 for alpha in mask if 0 < alpha < 255),
        "opaquePixelCount": sum(1 for alpha in mask if alpha == 255),
        "equivalentInkPixels": round(alpha_sum / 255, 2),
        "canvasCoverage": round(alpha_sum / (255 * size * size), 6),
        "centerOfMass": {
            "x": round(sum(x * alpha for x, _, alpha in weighted) / alpha_sum, 3),
            "y": round(sum(y * alpha for _, y, alpha in weighted) / alpha_sum, 3),
        },
        "connectedComponentsAtAlpha32": connected_components(mask, size, 32),
        "componentPixelCountsAtAlpha32": component_pixel_counts(mask, size, 32),
    }


def design_bounds(spec: dict[str, object]) -> dict[str, float]:
    points = [
        point
        for stroke in spec["strokes"]  # type: ignore[index]
        for point in stroke
    ]
    radius = STROKE_WIDTH / 2
    left = min(point[0] for point in points) - radius
    top = min(point[1] for point in points) - radius
    right = max(point[0] for point in points) + radius
    bottom = max(point[1] for point in points) + radius
    return {
        "left": round(left, 3),
        "top": round(top, 3),
        "right": round(right, 3),
        "bottom": round(bottom, 3),
        "width": round(right - left, 3),
        "height": round(bottom - top, 3),
    }


def new_canvas(width: int, height: int, color: tuple[int, int, int]) -> bytearray:
    return bytearray(bytes((*color, 255)) * (width * height))


def blend_pixel(
    canvas: bytearray,
    width: int,
    x: int,
    y: int,
    color: tuple[int, int, int],
    alpha: float,
) -> None:
    if alpha <= 0:
        return
    offset = (y * width + x) * 4
    alpha = max(0.0, min(1.0, alpha))
    for channel in range(3):
        canvas[offset + channel] = round(color[channel] * alpha + canvas[offset + channel] * (1 - alpha))
    canvas[offset + 3] = 255


def fill_rect(
    canvas: bytearray,
    width: int,
    height: int,
    left: int,
    top: int,
    right: int,
    bottom: int,
    color: tuple[int, int, int],
    alpha: float = 1.0,
) -> None:
    for y in range(max(0, top), min(height, bottom)):
        for x in range(max(0, left), min(width, right)):
            blend_pixel(canvas, width, x, y, color, alpha)


def point_inside_rounded_rect(
    px: float,
    py: float,
    left: float,
    top: float,
    right: float,
    bottom: float,
    radius: float,
) -> bool:
    if not (left <= px <= right and top <= py <= bottom):
        return False
    nearest_x = min(max(px, left + radius), right - radius)
    nearest_y = min(max(py, top + radius), bottom - radius)
    return (px - nearest_x) ** 2 + (py - nearest_y) ** 2 <= radius * radius


def fill_rounded_rect(
    canvas: bytearray,
    width: int,
    height: int,
    left: int,
    top: int,
    right: int,
    bottom: int,
    radius: int,
    color: tuple[int, int, int],
    alpha: float = 1.0,
) -> None:
    for y in range(max(0, top), min(height, bottom)):
        for x in range(max(0, left), min(width, right)):
            if point_inside_rounded_rect(x + 0.5, y + 0.5, left, top, right, bottom, radius):
                blend_pixel(canvas, width, x, y, color, alpha)


def stroke_rounded_rect(
    canvas: bytearray,
    width: int,
    height: int,
    left: int,
    top: int,
    right: int,
    bottom: int,
    radius: int,
    stroke_width: int,
    color: tuple[int, int, int],
    alpha: float = 1.0,
) -> None:
    inner_left = left + stroke_width
    inner_top = top + stroke_width
    inner_right = right - stroke_width
    inner_bottom = bottom - stroke_width
    inner_radius = max(0, radius - stroke_width)
    for y in range(max(0, top), min(height, bottom)):
        for x in range(max(0, left), min(width, right)):
            outer = point_inside_rounded_rect(x + 0.5, y + 0.5, left, top, right, bottom, radius)
            inner = point_inside_rounded_rect(
                x + 0.5,
                y + 0.5,
                inner_left,
                inner_top,
                inner_right,
                inner_bottom,
                inner_radius,
            )
            if outer and not inner:
                blend_pixel(canvas, width, x, y, color, alpha)


def composite_mask(
    canvas: bytearray,
    canvas_width: int,
    canvas_height: int,
    mask: bytes,
    mask_width: int,
    mask_height: int,
    left: int,
    top: int,
    color: tuple[int, int, int],
    opacity: float = 1.0,
) -> None:
    for y in range(mask_height):
        target_y = top + y
        if not 0 <= target_y < canvas_height:
            continue
        for x in range(mask_width):
            target_x = left + x
            if not 0 <= target_x < canvas_width:
                continue
            alpha = mask[y * mask_width + x] / 255 * opacity
            blend_pixel(canvas, canvas_width, target_x, target_y, color, alpha)


def scale_mask_nearest(mask: bytes, size: int, factor: int) -> tuple[bytes, int]:
    target_size = size * factor
    scaled = bytearray(target_size * target_size)
    for y in range(target_size):
        source_y = y // factor
        for x in range(target_size):
            scaled[y * target_size + x] = mask[source_y * size + x // factor]
    return bytes(scaled), target_size


def draw_target(
    canvas: bytearray,
    width: int,
    height: int,
    center_x: int,
    center_y: int,
    size: int,
    fill: tuple[int, int, int],
    border: tuple[int, int, int],
    opacity: float = 1.0,
) -> None:
    half = size // 2
    fill_rounded_rect(
        canvas,
        width,
        height,
        center_x - half,
        center_y - half,
        center_x + half,
        center_y + half,
        half,
        fill,
        0.72 * opacity,
    )
    stroke_rounded_rect(
        canvas,
        width,
        height,
        center_x - half,
        center_y - half,
        center_x + half,
        center_y + half,
        half,
        max(1, size // 44),
        border,
        0.32 * opacity,
    )


def emit_svg_sources() -> list[Path]:
    paths = []
    for spec in GLYPHS:
        body = "\n    ".join(spec["svg"])
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" '
            'viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">\n'
            f'  <g stroke="currentColor" stroke-width="{STROKE_WIDTH}" '
            'stroke-linecap="round" stroke-linejoin="round">\n'
            f"    {body}\n"
            "  </g>\n"
            "</svg>\n"
        )
        path = ROOT / "sources" / f"glyph-{spec['id']}--source--non-shipping-{VERSION}.svg"
        write_text(path, svg)
        paths.append(path)
    return paths


def emit_glyph_pngs() -> list[Path]:
    paths = []
    for spec in GLYPHS:
        for size, directory, role in (
            (128, "masters", "master-preview"),
            (32, "runtime", "32"),
            (24, "runtime", "24"),
        ):
            mask = render_mask(spec, size)
            pixels = rgba_from_mask(mask, COLORS["line_preview"])
            filename = f"glyph-{spec['id']}--{role}--non-shipping-{VERSION}.png"
            path = ROOT / directory / filename
            write_png_rgba(path, size, size, pixels)
            paths.append(path)
    return paths


def emit_legibility_sheet() -> Path:
    width, height = 1200, 420
    canvas = new_canvas(width, height, COLORS["paper"])
    fill_rect(canvas, width, height, 0, 210, width, height, COLORS["paper_light"], 0.32)
    fill_rect(canvas, width, height, 72, 209, width - 72, 211, COLORS["ink"], 0.10)
    centers_x = [160, 380, 600, 820, 1040]
    for row, size in enumerate((24, 32)):
        center_y = 112 + row * 196
        for center_x, spec in zip(centers_x, GLYPHS):
            draw_target(
                canvas,
                width,
                height,
                center_x,
                center_y,
                44,
                COLORS["paper_light"],
                COLORS["ink"],
            )
            mask = render_mask(spec, size)
            composite_mask(
                canvas,
                width,
                height,
                mask,
                size,
                size,
                center_x - size // 2,
                center_y - size // 2,
                COLORS["line_preview"],
            )
    path = ROOT / "reviews" / f"legibility-sheet--24-32--non-shipping-{VERSION}.png"
    write_png_rgba(path, width, height, canvas)
    return path


def emit_optical_weight_sheet() -> Path:
    width, height = 1200, 590
    canvas = new_canvas(width, height, COLORS["paper_light"])
    centers_x = [160, 380, 600, 820, 1040]
    rows = [(145, 24, 5), (445, 32, 4)]
    for center_y, size, factor in rows:
        fill_rect(canvas, width, height, 62, center_y, width - 62, center_y + 1, COLORS["ink"], 0.10)
        for center_x, spec in zip(centers_x, GLYPHS):
            guide = 144
            stroke_rounded_rect(
                canvas,
                width,
                height,
                center_x - guide // 2,
                center_y - guide // 2,
                center_x + guide // 2,
                center_y + guide // 2,
                8,
                1,
                COLORS["ink"],
                0.12,
            )
            fill_rect(canvas, width, height, center_x, center_y - 68, center_x + 1, center_y + 69, COLORS["ink"], 0.08)
            source = render_mask(spec, size)
            scaled, scaled_size = scale_mask_nearest(source, size, factor)
            composite_mask(
                canvas,
                width,
                height,
                scaled,
                scaled_size,
                scaled_size,
                center_x - scaled_size // 2,
                center_y - scaled_size // 2,
                COLORS["line_preview"],
            )
    path = ROOT / "reviews" / f"optical-weight-sheet--24-32--non-shipping-{VERSION}.png"
    write_png_rgba(path, width, height, canvas)
    return path


def emit_contrast_proof() -> Path:
    width, height = 1200, 480
    canvas = new_canvas(width, height, COLORS["paper"])
    fill_rect(canvas, width, height, 0, 240, width, height, COLORS["dark_paper"])
    fill_rect(canvas, width, height, 64, 239, width - 64, 241, COLORS["paper_deep"], 0.32)
    centers_x = [160, 380, 600, 820, 1040]
    for center_y, color in ((120, COLORS["line_preview"]), (360, COLORS["paper_light"])):
        for center_x, spec in zip(centers_x, GLYPHS):
            mask = render_mask(spec, 64)
            composite_mask(
                canvas,
                width,
                height,
                mask,
                64,
                64,
                center_x - 32,
                center_y - 32,
                color,
            )
    path = ROOT / "reviews" / f"contrast-proof--light-dark-paper--non-shipping-{VERSION}.png"
    write_png_rgba(path, width, height, canvas)
    return path


def emit_state_tint_proof() -> Path:
    width, height = 1200, 660
    canvas = new_canvas(width, height, COLORS["paper"])
    centers_x = [160, 380, 600, 820, 1040]
    row_centers = [112, 330, 548]
    for divider_y in (220, 438):
        fill_rect(canvas, width, height, 64, divider_y, width - 64, divider_y + 1, COLORS["ink"], 0.10)
    for state_index, center_y in enumerate(row_centers):
        for center_x, spec in zip(centers_x, GLYPHS):
            if state_index == 0:
                stroke_rounded_rect(
                    canvas,
                    width,
                    height,
                    center_x - 56,
                    center_y - 56,
                    center_x + 56,
                    center_y + 56,
                    56,
                    6,
                    COLORS["focus"],
                    0.45,
                )
                draw_target(
                    canvas,
                    width,
                    height,
                    center_x,
                    center_y,
                    88,
                    COLORS["paper_light"],
                    COLORS["ink"],
                )
                glyph_color = COLORS["line_preview"]
                glyph_opacity = 1.0
            elif state_index == 1:
                draw_target(
                    canvas,
                    width,
                    height,
                    center_x,
                    center_y,
                    88,
                    COLORS["sage_action"],
                    COLORS["focus"],
                    0.52,
                )
                glyph_color = COLORS["line_preview"]
                glyph_opacity = 0.52
            else:
                draw_target(
                    canvas,
                    width,
                    height,
                    center_x,
                    center_y,
                    88,
                    COLORS["paper_light"],
                    COLORS["error"],
                )
                glyph_color = COLORS["error"]
                glyph_opacity = 1.0
            mask = render_mask(spec, 48)
            composite_mask(
                canvas,
                width,
                height,
                mask,
                48,
                48,
                center_x - 24,
                center_y - 24,
                glyph_color,
                glyph_opacity,
            )
    path = ROOT / "reviews" / f"state-tint-proof--focus-disabled-error--non-shipping-{VERSION}.png"
    write_png_rgba(path, width, height, canvas)
    return path


def svg_validation(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    root = ElementTree.fromstring(text)
    namespace = "{http://www.w3.org/2000/svg}"
    tags = [element.tag.removeprefix(namespace) for element in root.iter()]
    disallowed_tags = sorted(set(tags) & {"text", "image", "foreignObject", "filter", "style", "script"})
    disallowed_tokens = sorted(
        token
        for token in ("shadow", "url(", "font-family", "<title", "<desc")
        if token in text.lower()
    )
    colors = re.findall(r"#[0-9a-fA-F]{3,8}|rgba?\(", text)
    return {
        "path": path.relative_to(ROOT).as_posix(),
        "xmlWellFormed": True,
        "rootTag": root.tag.removeprefix(namespace),
        "viewBox": root.attrib.get("viewBox"),
        "fill": root.attrib.get("fill"),
        "ariaHidden": root.attrib.get("aria-hidden"),
        "focusable": root.attrib.get("focusable"),
        "usesCurrentColor": 'stroke="currentColor"' in text,
        "literalColorCount": len(colors),
        "elementTags": tags,
        "disallowedTags": disallowed_tags,
        "disallowedTokens": disallowed_tokens,
        "passes": (
            root.tag == f"{namespace}svg"
            and root.attrib.get("viewBox") == "0 0 24 24"
            and root.attrib.get("fill") == "none"
            and root.attrib.get("aria-hidden") == "true"
            and root.attrib.get("focusable") == "false"
            and 'stroke="currentColor"' in text
            and not colors
            and not disallowed_tags
            and not disallowed_tokens
        ),
    }


def srgb_channel(value: int) -> float:
    channel = value / 255
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def relative_luminance(color: tuple[int, int, int]) -> float:
    red, green, blue = (srgb_channel(value) for value in color)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast_ratio(first: tuple[int, int, int], second: tuple[int, int, int]) -> float:
    light = max(relative_luminance(first), relative_luminance(second))
    dark = min(relative_luminance(first), relative_luminance(second))
    return (light + 0.05) / (dark + 0.05)


def composite_color(
    foreground: tuple[int, int, int],
    background: tuple[int, int, int],
    alpha: float,
) -> tuple[int, int, int]:
    return tuple(round(foreground[index] * alpha + background[index] * (1 - alpha)) for index in range(3))


def color_hex(color: tuple[int, int, int]) -> str:
    return "#" + "".join(f"{value:02x}" for value in color)


def make_geometry_metadata() -> dict[str, object]:
    glyph_records = []
    for spec in GLYPHS:
        raster = {
            f"{size}px": mask_metrics(render_mask(spec, size), size)
            for size in (20, 24, 32, 128)
        }
        glyph_records.append(
            {
                "id": f"glyph-{spec['id']}",
                "purpose": spec["purpose"],
                "semanticCue": spec["semanticCue"],
                "source": f"sources/glyph-{spec['id']}--source--non-shipping-{VERSION}.svg",
                "masterPreview": f"masters/glyph-{spec['id']}--master-preview--non-shipping-{VERSION}.png",
                "derivatives": {
                    "32px": f"runtime/glyph-{spec['id']}--32--non-shipping-{VERSION}.png",
                    "24px": f"runtime/glyph-{spec['id']}--24--non-shipping-{VERSION}.png",
                },
                "designBoundsInViewBox": design_bounds(spec),
                "linearCoordinateGrid": 0.25,
                "linearGridAligned": spec["linearGridAligned"],
                "allowedComponentCountsAtAlpha32": spec["allowedComponentCountsAtAlpha32"],
                "curveAlignmentNote": spec.get("curveAlignmentNote"),
                "rasterMetrics": raster,
            }
        )
    return {
        "schemaVersion": 1,
        "collectionId": "utility-glyph-family-v1",
        "batchId": "GEN-05",
        "assetNeedId": "AA-018",
        "status": STATUS,
        "shippingEligible": False,
        "canonicalSource": {
            "format": "SVG",
            "viewBox": [0, 0, 24, 24],
            "paint": "currentColor",
            "fill": "none",
            "strokeWidth": STROKE_WIDTH,
            "strokeLinecap": "round",
            "strokeLinejoin": "round",
            "background": "transparent",
        },
        "opticalSystem": {
            "intendedGlyphDisplayPx": [20, 24],
            "exportedDerivativePx": [24, 32],
            "masterPreviewPx": 128,
            "canonicalOrder": GLYPH_ORDER,
            "sharedStrokeWeight": True,
            "internalWhitespace": "approximately 4-5 viewBox units around critical marks",
            "touchTargetProofCssPx": 44,
            "currentControlsRead": {
                "drawerCloseCssPx": [38, 38],
                "saveTransferMinHeightCssPx": 38,
                "itemActionMinWidthCssPx": 62,
            },
            "integrationRecommendation": "Keep the glyph at 20-24 CSS px inside a target of at least 44 CSS px when layout permits; do not encode the target in the SVG.",
        },
        "paletteReference": {
            "canonicalSvg": "no literal color; inherits currentColor",
            "neutralPreview": color_hex(COLORS["line_preview"]),
            "homeInk": color_hex(COLORS["ink"]),
            "paper": color_hex(COLORS["paper"]),
            "paperDeep": color_hex(COLORS["paper_deep"]),
            "focusCss": "rgba(102, 125, 78, 0.45)",
            "disabledCssOpacity": 0.52,
            "errorCss": color_hex(COLORS["error"]),
        },
        "proofLayout": {
            "glyphOrderLeftToRight": GLYPH_ORDER,
            "legibilitySheetRowsTopToBottom": ["24px in 44px target", "32px in 44px target"],
            "opticalWeightRowsTopToBottom": ["24px derivative enlarged 5x nearest-neighbor", "32px derivative enlarged 4x nearest-neighbor"],
            "contrastRowsTopToBottom": ["dark glyph on warm-light paper", "light glyph on dark paper"],
            "stateTintRowsTopToBottom": ["focus at 2x CSS scale", "disabled at 2x CSS scale", "error at 2x CSS scale"],
        },
        "glyphs": glyph_records,
    }


def make_validation(
    svg_paths: list[Path],
    asset_png_paths: list[Path],
    review_paths: list[Path],
    geometry: dict[str, object],
) -> dict[str, object]:
    svg_records = [svg_validation(path) for path in svg_paths]
    png_records = []
    for path in asset_png_paths + review_paths:
        width, height, pixels = read_png_rgba(path)
        alpha = pixels[3::4]
        transparent_rgb_zero = all(
            pixels[index : index + 3] == b"\x00\x00\x00"
            for index in range(0, len(pixels), 4)
            if pixels[index + 3] == 0
        )
        record: dict[str, object] = {
            "path": path.relative_to(ROOT).as_posix(),
            "width": width,
            "height": height,
            "pixelMode": "RGBA",
            "alphaExtrema": [min(alpha), max(alpha)],
            "partialAlphaPixelCount": sum(1 for value in alpha if 0 < value < 255),
            "transparentPixelRgbZero": transparent_rgb_zero,
            "opaqueReview": path in review_paths,
        }
        if path in asset_png_paths:
            record["visibleBounds"] = mask_bounds(bytes(alpha), width)
            record["connectedComponentsAtAlpha32"] = connected_components(bytes(alpha), width, 32)
            record["componentPixelCountsAtAlpha32"] = component_pixel_counts(bytes(alpha), width, 32)
        png_records.append(record)

    paper = COLORS["paper"]
    current_focus = composite_color(COLORS["focus"], paper, 0.45)
    disabled_ink = composite_color(COLORS["line_preview"], paper, 0.52)
    contrast_checks = [
        {
            "pair": "neutral warm gray-brown glyph / warm paper",
            "foreground": color_hex(COLORS["line_preview"]),
            "background": color_hex(paper),
            "ratio": round(contrast_ratio(COLORS["line_preview"], paper), 2),
            "threshold": "3:1 non-text graphical object",
            "passes": contrast_ratio(COLORS["line_preview"], paper) >= 3,
        },
        {
            "pair": "light glyph / dark paper",
            "foreground": color_hex(COLORS["paper_light"]),
            "background": color_hex(COLORS["dark_paper"]),
            "ratio": round(contrast_ratio(COLORS["paper_light"], COLORS["dark_paper"]), 2),
            "threshold": "3:1 non-text graphical object",
            "passes": contrast_ratio(COLORS["paper_light"], COLORS["dark_paper"]) >= 3,
        },
        {
            "pair": "error glyph / warm paper",
            "foreground": color_hex(COLORS["error"]),
            "background": color_hex(paper),
            "ratio": round(contrast_ratio(COLORS["error"], paper), 2),
            "threshold": "3:1 non-text graphical object",
            "passes": contrast_ratio(COLORS["error"], paper) >= 3,
        },
        {
            "pair": "current focus outline composite / warm paper",
            "foreground": color_hex(current_focus),
            "background": color_hex(paper),
            "ratio": round(contrast_ratio(current_focus, paper), 2),
            "threshold": "3:1 integration target",
            "passes": contrast_ratio(current_focus, paper) >= 3,
            "advisory": "Existing app CSS owns this ring; the candidate does not alter it.",
        },
        {
            "pair": "disabled glyph at current 0.52 opacity / warm paper",
            "foreground": color_hex(disabled_ink),
            "background": color_hex(paper),
            "ratio": round(contrast_ratio(disabled_ink, paper), 2),
            "threshold": "inactive controls are exempt; differentiation must not rely on color alone",
            "passes": None,
        },
    ]
    glyph_geometry = geometry["glyphs"]  # type: ignore[index]
    bounds_pass = all(
        all(
            min(metrics["bounds"]["padding"].values()) >= (3 if size == "20px" else 4)  # type: ignore[index]
            for size, metrics in glyph["rasterMetrics"].items()  # type: ignore[index]
            if size in {"20px", "24px", "32px"}
        )
        for glyph in glyph_geometry
    )
    spec_by_id = {f"glyph-{spec['id']}": spec for spec in GLYPHS}
    component_pass = all(
        all(
            (
                metrics["connectedComponentsAtAlpha32"]
                in spec_by_id[glyph["id"]]["allowedComponentCountsAtAlpha32"]
                and min(metrics["componentPixelCountsAtAlpha32"]) >= 3
            )
            for size, metrics in glyph["rasterMetrics"].items()  # type: ignore[index]
            if size in {"20px", "24px", "32px"}
        )
        for glyph in glyph_geometry
    )
    source_png_records = [record for record in png_records if not record["opaqueReview"]]
    review_png_records = [record for record in png_records if record["opaqueReview"]]
    svg_pass = all(record["passes"] for record in svg_records)
    alpha_pass = all(record["transparentPixelRgbZero"] for record in source_png_records)
    dimensions_pass = all(
        (
            ("master-preview" in record["path"] and record["width"] == record["height"] == 128)
            or ("--32--" in record["path"] and record["width"] == record["height"] == 32)
            or ("--24--" in record["path"] and record["width"] == record["height"] == 24)
        )
        for record in source_png_records
    )
    reviews_opaque = all(record["alphaExtrema"] == [255, 255] for record in review_png_records)
    return {
        "schemaVersion": 1,
        "collectionId": "utility-glyph-family-v1",
        "status": STATUS,
        "shippingEligible": False,
        "result": "pass-with-integration-advisory-human-approval-pending",
        "automatedChecks": {
            "svgStructure": {
                "passes": svg_pass,
                "files": svg_records,
                "requirements": [
                    "well-formed XML",
                    "0 0 24 24 viewBox",
                    "currentColor stroke",
                    "transparent fill",
                    "no literal colors, text, images, filters, scripts, titles, or descriptions",
                ],
            },
            "pngAlphaAndDimensions": {
                "passes": alpha_pass and dimensions_pass and reviews_opaque,
                "sourceTransparentRgbZero": alpha_pass,
                "sourceDimensionsPass": dimensions_pass,
                "reviewProofsOpaque": reviews_opaque,
                "files": png_records,
            },
            "pixelAlignmentAndBounds": {
                "passes": bounds_pass and component_pass,
                "linearAnchorGrid": 0.25,
                "constantStrokeWidth": STROKE_WIDTH,
                "minimumPaddingPass": bounds_pass,
                "semanticComponentTopologyPass": component_pass,
                "minimumComponentPixelCountAtAlpha32": 3,
                "curvePolicy": "Arcs are analytic optical curves; straight endpoints and shared tray/body anchors use the quarter-unit grid.",
            },
            "contrast": {
                "sourcePolicy": "SVGs inherit CSS currentColor; listed colors are proof-only simulations.",
                "checks": contrast_checks,
            },
        },
        "semanticRecognizability": {
            "result": "proofs-prepared-human-approval-pending",
            "checks": [
                {
                    "glyph": f"glyph-{spec['id']}",
                    "cue": spec["semanticCue"],
                    "sizesReviewed": [20, 24, 32],
                    "machineEvidence": "expected semantic component topology, no clipping, and no sub-three-pixel fragment",
                }
                for spec in GLYPHS
            ],
            "pairwiseRisk": {
                "exportImport": "The shared tray is identical and the arrow direction is the sole semantic difference; inspect the 24px row before approval.",
                "closeRetry": "Cross and circular-arrow silhouettes do not share topology.",
                "lock": "Only enclosed-body glyph; no collision with transfer actions.",
            },
        },
        "accessibilityReview": {
            "sourceSvgIsDecorative": True,
            "sourceAttributes": {"aria-hidden": "true", "focusable": "false"},
            "requiredLiveNames": {
                "close": "retain the existing drawer-specific aria-label",
                "export": "retain visible export text or an equivalent accessible name",
                "import": "retain visible import text and the associated file-input label",
                "lock": "provide live locked-state text or an accessible name at integration",
                "retry": "provide action-specific retry text or an accessible name at integration",
            },
            "touchTargets": {
                "currentDrawerCloseCssPx": [38, 38],
                "currentSaveTransferMinHeightCssPx": 38,
                "proofTargetCssPx": 44,
                "note": "The art carries internal whitespace but does not replace CSS hit areas.",
            },
            "stateOwnership": "focus, hover, disabled, and error remain CSS; no state is baked into canonical SVG.",
            "integrationAdvisory": "The existing semi-transparent focus outline does not reach the 3:1 proof target on warm paper; app CSS was intentionally not edited in this batch.",
        },
        "exclusions": {
            "textOrLetters": True,
            "emoji": True,
            "bakedStateColorsInSvg": True,
            "backgroundsInSources": True,
            "shadows": True,
            "decorativeFlourishes": True,
            "appOrProductionChanges": True,
        },
        "approval": {
            "decision": "pending",
            "reviewer": "",
            "reviewedAt": "",
            "notes": "",
        },
    }


def make_readme(validation: dict[str, object]) -> str:
    contrast = validation["automatedChecks"]["contrast"]["checks"]  # type: ignore[index]
    ratios = {entry["pair"]: entry["ratio"] for entry in contrast}
    return f"""# Utility Glyph Family v1

**{STATUS}.** This is the isolated GEN-05 / AA-018 candidate pack. Nothing here is approved for runtime use. No application code, production asset, or other candidate directory was edited, and no commit or integration was performed.

## Family

The canonical sources are five hand-authored `0 0 24 24` SVGs in this order:

1. close
2. export
3. import
4. lock
5. retry

Every source uses `currentColor`, `fill="none"`, a shared {STROKE_WIDTH:g}-unit stroke, round caps, and round joins. The family deliberately uses compact warm gray-brown line character rather than watercolor raster mass. Critical marks retain roughly 4–5 viewBox units of internal whitespace, so a 20–24 px glyph can sit inside a generous touch target without becoming visually crowded.

The SVGs contain no labels, letters, emoji, literal colors, backgrounds, shadows, filters, decorative flourishes, or baked interaction states. The 128, 32, and 24 px PNGs are neutral warm-line review previews only; the SVG remains the integration source.

## Current UI evidence read

- Drawer close is currently a 38×38 CSS-pixel circle with a one-pixel warm line, translucent paper fill, Unicode `×`, and a drawer-specific live `aria-label`.
- Save export/import controls are text-led pills with `min-height: 38px`; export is a button, while import remains a visible label associated with the visually hidden file input.
- Pack item actions use a 62 px minimum width. Disabled treatment is live CSS opacity `0.52`.
- Global button focus is a 3 px `rgba(102, 125, 78, 0.45)` outline with a 3 px offset; the import label uses a 2 px focus-within outline.

No candidate embeds any of that control chrome. Integration should keep the glyph at 20–24 CSS px and preserve the live label. The proof uses 44 px targets as the preferred touch size; the existing 38 px targets were inspected but intentionally not modified.

## Exports

- `sources/`: five canonical text-free SVGs.
- `masters/`: five transparent 128×128 neutral preview PNGs.
- `runtime/`: transparent 32×32 and 24×24 review derivatives.
- `geometry-metadata.v1.json`: viewBox geometry, optical bounds, 20/24/32/128 raster measurements, target-size evidence, palette references, and proof ordering.
- `qa/validation.v1.json`: SVG structure, PNG dimensions/alpha, clipping, connected-mark, contrast, semantic-cue, and accessibility checks.
- `manifest.v1.json`: hashes and format metadata for every deliverable except the self-referential manifest.
- `scripts/build_v1.py`: deterministic standard-library builder; no vendored dependency tree.

## Text-free review proofs

All proof sheets use the left-to-right order **close, export, import, lock, retry**. The order is recorded in metadata rather than baked into the pixels.

- `reviews/legibility-sheet--24-32--non-shipping-v01.png`: top row 24 px, bottom row 32 px, each centered in a 44 px target.
- `reviews/optical-weight-sheet--24-32--non-shipping-v01.png`: top row is the 24 px derivative enlarged 5× nearest-neighbor; bottom row is the 32 px derivative enlarged 4×. Guides expose pixel distribution and optical scale.
- `reviews/contrast-proof--light-dark-paper--non-shipping-v01.png`: dark-on-warm-paper above, light-on-dark-paper below.
- `reviews/state-tint-proof--focus-disabled-error--non-shipping-v01.png`: focus, disabled, and error rows at 2× CSS scale. These are simulations only.

## QA result

- All five SVGs are well-formed, use the same viewBox/stroke system, inherit `currentColor`, and contain no disallowed visible content.
- Every source PNG is straight RGBA with transparent backgrounds, soft antialiasing, zero RGB in fully transparent pixels, safe bounds, expected semantic component topology, and no sub-three-pixel fragment at 20, 24, or 32 px.
- Neutral preview ink on warm paper is **{ratios['neutral warm gray-brown glyph / warm paper']}:1**; light ink on dark paper is **{ratios['light glyph / dark paper']}:1**; error tint on warm paper is **{ratios['error glyph / warm paper']}:1**. These exceed the 3:1 graphical-object proof target.
- Disabled contrast is documented but not treated as a pass/fail threshold for an inactive control.
- The current semi-transparent focus outline composites to **{ratios['current focus outline composite / warm paper']}:1** on warm paper, below a 3:1 integration target. Focus remains app-owned CSS, so this candidate records the advisory without changing source or app code.
- Export/import intentionally share one tray and differ only by arrow direction. Their 24 px distinction is the primary approval check.

Semantic recognition remains a human visual gate. Stop here for approval; do not promote, integrate, or commit this family yet.
"""


def classify_file(path: Path) -> dict[str, object]:
    relative = path.relative_to(ROOT).as_posix()
    payload: dict[str, object] = {
        "path": relative,
        "status": STATUS,
        "shippingEligible": False,
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }
    if path.suffix == ".png":
        width, height, pixels = read_png_rgba(path)
        alpha = pixels[3::4]
        payload.update(
            {
                "kind": "review-proof" if relative.startswith("reviews/") else "image-preview",
                "format": "PNG",
                "width": width,
                "height": height,
                "pixelMode": "RGBA",
                "alpha": "opaque" if min(alpha) == 255 else "straight",
            }
        )
    elif path.suffix == ".svg":
        payload.update(
            {
                "kind": "canonical-vector-source",
                "format": "SVG",
                "viewBox": "0 0 24 24",
                "paint": "currentColor",
            }
        )
    elif path.suffix == ".json":
        payload["kind"] = "metadata"
    elif path.suffix == ".py":
        payload["kind"] = "source-script"
    else:
        payload["kind"] = "documentation"
    return payload


def emit_manifest() -> Path:
    manifest_path = ROOT / "manifest.v1.json"
    files = sorted(
        (
            path
            for path in ROOT.rglob("*")
            if path.is_file() and path != manifest_path and "__pycache__" not in path.parts
        ),
        key=lambda path: path.relative_to(ROOT).as_posix(),
    )
    manifest = {
        "schemaVersion": 1,
        "manifestKind": "utility-glyph-family-review-pack",
        "collectionId": "utility-glyph-family-v1",
        "batchId": "GEN-05",
        "assetNeedId": "AA-018",
        "status": STATUS,
        "shippingEligible": False,
        "createdAt": CREATED_AT,
        "root": "docs/art/candidates/ui-glyphs/v1",
        "canonicalGlyphOrder": GLYPH_ORDER,
        "selfExcludedFromFileHashes": True,
        "fileCount": len(files),
        "files": [classify_file(path) for path in files],
    }
    write_json(manifest_path, manifest)
    return manifest_path


def main() -> None:
    for directory in ("sources", "masters", "runtime", "reviews", "qa"):
        (ROOT / directory).mkdir(parents=True, exist_ok=True)
    svg_paths = emit_svg_sources()
    asset_png_paths = emit_glyph_pngs()
    review_paths = [
        emit_legibility_sheet(),
        emit_optical_weight_sheet(),
        emit_contrast_proof(),
        emit_state_tint_proof(),
    ]
    geometry = make_geometry_metadata()
    write_json(ROOT / "geometry-metadata.v1.json", geometry)
    validation = make_validation(svg_paths, asset_png_paths, review_paths, geometry)
    write_json(ROOT / "qa" / "validation.v1.json", validation)
    write_text(ROOT / "README.md", make_readme(validation))
    emit_manifest()


if __name__ == "__main__":
    main()
