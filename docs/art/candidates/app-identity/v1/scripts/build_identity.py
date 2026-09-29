#!/usr/bin/env python3
"""Build the non-shipping BraveCat GEN-01 identity review pack."""

from __future__ import annotations

import hashlib
import json
import math
import shutil
import subprocess
from io import BytesIO
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageCms, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[4]
ASSET_STORE = Path(
    "/Users/moon/.cursor/projects/Users-moon-Documents-Code-BraveCat/assets"
)

GENERATED = ROOT / "generated"
MASTERS = ROOT / "masters"
RUNTIME = ROOT / "runtime"
PROOFS = ROOT / "proofs"
MOCKUPS = ROOT / "mockups"
QA = ROOT / "qa"

SRGB_ICC = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
RESAMPLE = Image.Resampling.LANCZOS

WARM_PAPER = (247, 243, 232)
PROOF_BG = (225, 218, 202)
INK = (91, 85, 70)
SAGE = (135, 155, 112)
OCHRE = (196, 164, 108)
TERRACOTTA = (193, 119, 91)

CANDIDATES: dict[str, dict[str, Any]] = {
    "a": {
        "id": "candidate-a",
        "slug": "minho-envelope",
        "title": "Front-facing Minho with open envelope",
        "source": "bravecat-app-identity-candidate-a-generated-v01.png",
        "scale": 0.78,
        "smallCrop": 0.105,
        "criticalBounds": [0.20, 0.15, 0.80, 0.88],
        "accent": SAGE,
        "composition": (
            "Face-dominant frontal Minho rising from a restrained open postcard "
            "envelope; paws and one unmarked seal dot remain secondary."
        ),
    },
    "b": {
        "id": "candidate-b",
        "slug": "minho-home-postcard",
        "title": "Three-quarter Minho in postcard home",
        "source": "bravecat-app-identity-candidate-b-generated-v01.png",
        "scale": 0.82,
        "smallCrop": 0.09,
        "criticalBounds": [0.20, 0.12, 0.80, 0.87],
        "accent": TERRACOTTA,
        "composition": (
            "Compact three-quarter seated Minho within a folded-postcard home "
            "silhouette; the broad ringed tail anchors the small-size mark."
        ),
    },
}

REFERENCE_PATHS = [
    "public/portraits/minho/portrait--minho--sit--v01.png",
    "public/portraits/minho/portrait--minho--gaze--v01.png",
    "docs/art/production/portraits/minho/manifest.json",
    "docs/art/production/portraits/minho/validation.json",
    "docs/art/style-ref-home.png",
    "docs/art/style-ref-postcard.png",
    "docs/art/style-ref-poses.png",
    (
        "docs/art/candidates/calibration/"
        "calibration-non-final--portrait-board--minho--candidate-a--v02.png"
    ),
    "public/icon.svg",
    "vite.config.ts",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def rel(path: Path) -> str:
    return path.relative_to(REPO).as_posix()


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(
        path,
        format="PNG",
        compress_level=9,
        icc_profile=SRGB_ICC,
        dpi=(72, 72),
    )


def deterministic_paper(
    size: tuple[int, int],
    seed: int,
    base: tuple[int, int, int] = WARM_PAPER,
    noise_sigma: float = 1.15,
) -> Image.Image:
    rng = np.random.default_rng(seed)
    array = np.empty((size[1], size[0], 3), dtype=np.float32)
    array[:] = np.asarray(base, dtype=np.float32)
    paper_noise = rng.normal(0.0, noise_sigma, (size[1], size[0], 1))
    broad = rng.normal(0.0, 0.45, (max(2, size[1] // 24), max(2, size[0] // 24)))
    broad_image = Image.fromarray(
        np.clip(broad * 15 + 127, 0, 255).astype(np.uint8), mode="L"
    ).resize(size, Image.Resampling.BICUBIC)
    broad_array = (np.asarray(broad_image, dtype=np.float32) - 127.0)[..., None] * 0.075
    array += paper_noise + broad_array
    return Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), mode="RGB")


def edge_feather_mask(size: int, feather: int) -> Image.Image:
    yy, xx = np.indices((size, size), dtype=np.float32)
    distance = np.minimum.reduce([xx, yy, size - 1 - xx, size - 1 - yy])
    t = np.clip(distance / feather, 0.0, 1.0)
    smooth = t * t * (3.0 - 2.0 * t)
    return Image.fromarray(np.round(smooth * 255).astype(np.uint8), mode="L")


def normalized_master(source: Image.Image, key: str) -> Image.Image:
    config = CANDIDATES[key]
    source = source.convert("RGB").resize((1024, 1024), RESAMPLE)

    corner = 112
    corner_samples = np.concatenate(
        [
            np.asarray(source)[:corner, :corner].reshape(-1, 3),
            np.asarray(source)[:corner, -corner:].reshape(-1, 3),
            np.asarray(source)[-corner:, :corner].reshape(-1, 3),
            np.asarray(source)[-corner:, -corner:].reshape(-1, 3),
        ]
    )
    corner_color = tuple(
        int(value) for value in np.median(corner_samples, axis=0).round()
    )
    base_color = tuple(
        int(round(corner_color[channel] * 0.68 + WARM_PAPER[channel] * 0.32))
        for channel in range(3)
    )
    base = deterministic_paper((1024, 1024), 20260721 + ord(key), base_color)

    blurred = source.resize((96, 96), Image.Resampling.BILINEAR).resize(
        (1024, 1024), Image.Resampling.BICUBIC
    )
    blurred = blurred.filter(ImageFilter.GaussianBlur(30))
    blurred = ImageEnhance.Color(blurred).enhance(0.34)
    blurred = ImageEnhance.Brightness(blurred).enhance(1.035)
    base = Image.blend(base, blurred, 0.18)

    fitted_size = int(round(1024 * float(config["scale"])))
    fitted = source.resize((fitted_size, fitted_size), RESAMPLE)
    mask = edge_feather_mask(fitted_size, max(42, fitted_size // 11))
    offset = ((1024 - fitted_size) // 2, (1024 - fitted_size) // 2)
    base.paste(fitted, offset, mask)
    return base


def simplified_small(master: Image.Image, key: str, size: int) -> Image.Image:
    crop_fraction = float(CANDIDATES[key]["smallCrop"])
    inset = int(round(master.width * crop_fraction))
    cropped = master.crop((inset, inset, master.width - inset, master.height - inset))
    cropped = cropped.filter(ImageFilter.GaussianBlur(0.72))
    cropped = ImageEnhance.Color(cropped).enhance(0.92)
    cropped = ImageEnhance.Contrast(cropped).enhance(1.09)
    small = cropped.resize((size, size), RESAMPLE)
    return ImageEnhance.Sharpness(small).enhance(1.22)


def circle_mask(size: int, inset: int = 0) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse(
        (inset, inset, size - 1 - inset, size - 1 - inset), fill=255
    )
    return mask


def squircle_mask(size: int, exponent: float = 4.5, inset: float = 0.0) -> Image.Image:
    yy, xx = np.indices((size, size), dtype=np.float32)
    center = (size - 1) / 2
    radius = center * (1.0 - inset)
    nx = np.abs((xx - center) / radius)
    ny = np.abs((yy - center) / radius)
    inside = np.power(nx, exponent) + np.power(ny, exponent) <= 1.0
    return Image.fromarray(np.where(inside, 255, 0).astype(np.uint8), mode="L")


def dashed_rectangle(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int],
    width: int = 3,
    dash: int = 14,
    gap: int = 10,
) -> None:
    x0, y0, x1, y1 = box
    for start in range(x0, x1, dash + gap):
        draw.line((start, y0, min(start + dash, x1), y0), fill=fill, width=width)
        draw.line((start, y1, min(start + dash, x1), y1), fill=fill, width=width)
    for start in range(y0, y1, dash + gap):
        draw.line((x0, start, x0, min(start + dash, y1)), fill=fill, width=width)
        draw.line((x1, start, x1, min(start + dash, y1)), fill=fill, width=width)


def paste_masked_with_shadow(
    canvas: Image.Image,
    icon: Image.Image,
    position: tuple[int, int],
    mask: Image.Image,
    shadow_radius: int = 12,
) -> None:
    x, y = position
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_tile = Image.new("RGBA", icon.size, (68, 61, 49, 78))
    shadow_tile.putalpha(mask.filter(ImageFilter.GaussianBlur(shadow_radius)))
    shadow.alpha_composite(shadow_tile, (x, y + max(3, shadow_radius // 2)))
    canvas.paste(shadow.convert("RGB"), (0, 0), shadow.getchannel("A"))
    canvas.paste(icon, (x, y), mask)


def make_mask_proof(master: Image.Image, key: str) -> Image.Image:
    canvas = deterministic_paper((1520, 520), 7210 + ord(key), PROOF_BG, 0.75)
    icon_size = 400
    icon = master.resize((icon_size, icon_size), RESAMPLE)
    positions = [(70, 60), (560, 60), (1050, 60)]

    square_shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow = Image.new("RGBA", (icon_size, icon_size), (60, 54, 44, 50))
    shadow.putalpha(
        Image.new("L", (icon_size, icon_size), 75).filter(ImageFilter.GaussianBlur(14))
    )
    square_shadow.alpha_composite(shadow, (positions[0][0], positions[0][1] + 7))
    canvas.paste(square_shadow.convert("RGB"), (0, 0), square_shadow.getchannel("A"))
    canvas.paste(icon, positions[0])
    draw = ImageDraw.Draw(canvas)
    inset = icon_size // 10
    dashed_rectangle(
        draw,
        (
            positions[0][0] + inset,
            positions[0][1] + inset,
            positions[0][0] + icon_size - inset,
            positions[0][1] + icon_size - inset,
        ),
        TERRACOTTA,
        4,
        16,
        11,
    )

    paste_masked_with_shadow(
        canvas, icon, positions[1], circle_mask(icon_size), shadow_radius=14
    )
    paste_masked_with_shadow(
        canvas, icon, positions[2], squircle_mask(icon_size), shadow_radius=14
    )
    return canvas


def make_selection_board(masters: dict[str, Image.Image]) -> Image.Image:
    canvas = deterministic_paper((1580, 820), 20260721, (233, 227, 214), 0.7)
    tile_size = 680
    y = 70
    for index, key in enumerate(("a", "b")):
        x = 70 + index * 790
        icon = masters[key].resize((tile_size, tile_size), RESAMPLE)
        mask = squircle_mask(tile_size, inset=0.015)
        paste_masked_with_shadow(canvas, icon, (x, y), mask, shadow_radius=20)
        dot_color = CANDIDATES[key]["accent"]
        ImageDraw.Draw(canvas).ellipse(
            (x + tile_size - 26, y + tile_size - 26, x + tile_size - 10, y + tile_size - 10),
            fill=dot_color,
        )
    return canvas


def make_legibility_sheet(
    smalls: dict[str, dict[int, Image.Image]],
) -> Image.Image:
    canvas = deterministic_paper((1580, 650), 32048, (235, 230, 217), 0.65)
    draw = ImageDraw.Draw(canvas)
    row_y = {"a": 38, "b": 338}
    for key in ("a", "b"):
        y = row_y[key]
        draw.rounded_rectangle(
            (28, y, 48, y + 270),
            radius=10,
            fill=CANDIDATES[key]["accent"],
        )
        icon32 = smalls[key][32]
        icon48 = smalls[key][48]
        canvas.paste(icon32, (82, y + 98))
        canvas.paste(icon48, (142, y + 90))
        canvas.paste(icon32.resize((256, 256), Image.Resampling.NEAREST), (230, y + 7))
        canvas.paste(icon48.resize((288, 288), Image.Resampling.NEAREST), (530, y - 9))

        circle = circle_mask(48)
        circle_tile = Image.new("RGB", (48, 48), PROOF_BG)
        circle_tile.paste(icon48, (0, 0), circle)
        canvas.paste(
            circle_tile.resize((288, 288), Image.Resampling.NEAREST), (860, y - 9)
        )

        squircle = squircle_mask(48)
        squircle_tile = Image.new("RGB", (48, 48), PROOF_BG)
        squircle_tile.paste(icon48, (0, 0), squircle)
        canvas.paste(
            squircle_tile.resize((288, 288), Image.Resampling.NEAREST),
            (1190, y - 9),
        )
    return canvas


def rounded_tile(
    image: Image.Image,
    size: int,
    shape: str = "squircle",
) -> tuple[Image.Image, Image.Image]:
    icon = image.resize((size, size), RESAMPLE)
    mask = circle_mask(size) if shape == "circle" else squircle_mask(size)
    return icon, mask


def draw_launcher_grid(
    canvas: Image.Image,
    candidate_icon: Image.Image,
    viewport: tuple[int, int],
    mask_shape: str,
    muted: bool = False,
) -> None:
    width, height = viewport
    draw = ImageDraw.Draw(canvas, "RGBA")
    icon_size = 62 if width == 390 else 68
    columns = 4
    gap_x = (width - columns * icon_size) // (columns + 1)
    start_y = int(height * 0.17)
    gap_y = int(height * 0.088)
    palette = [
        (171, 184, 148),
        (215, 184, 135),
        (201, 143, 119),
        (145, 169, 171),
        (194, 181, 157),
        (165, 155, 181),
    ]
    target = (1, 1)
    for row in range(5):
        for column in range(columns):
            x = gap_x + column * (icon_size + gap_x)
            y = start_y + row * (icon_size + gap_y)
            if (row, column) == target:
                icon, mask = rounded_tile(candidate_icon, icon_size, mask_shape)
                if muted:
                    icon = ImageEnhance.Brightness(icon).enhance(0.76)
                paste_masked_with_shadow(canvas, icon, (x, y), mask, shadow_radius=5)
                continue
            color = palette[(row * columns + column) % len(palette)]
            alpha = 118 if muted else 176
            tile_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
            tile_draw = ImageDraw.Draw(tile_layer, "RGBA")
            if mask_shape == "circle":
                tile_draw.ellipse(
                    (x, y, x + icon_size, y + icon_size),
                    fill=(*color, alpha),
                )
            else:
                tile_draw.rounded_rectangle(
                    (x, y, x + icon_size, y + icon_size),
                    radius=int(icon_size * 0.25),
                    fill=(*color, alpha),
                )
            canvas.paste(tile_layer.convert("RGB"), (0, 0), tile_layer.getchannel("A"))

    dock_y = height - int(height * 0.115)
    draw.rounded_rectangle(
        (int(width * 0.14), dock_y, int(width * 0.86), dock_y + int(height * 0.075)),
        radius=24,
        fill=(248, 245, 235, 112 if muted else 164),
    )
    draw.rounded_rectangle(
        (
            int(width * 0.41),
            height - 16,
            int(width * 0.59),
            height - 11,
        ),
        radius=3,
        fill=(91, 85, 70, 82),
    )


def make_launcher_mockup(
    candidate_icon: Image.Image,
    viewport: tuple[int, int],
) -> Image.Image:
    width, height = viewport
    canvas = deterministic_paper(viewport, width * 1000 + height, (228, 224, 207), 0.65)
    wash = Image.new("RGBA", viewport, (0, 0, 0, 0))
    draw = ImageDraw.Draw(wash, "RGBA")
    draw.ellipse(
        (-width * 0.28, -height * 0.12, width * 1.06, height * 0.58),
        fill=(*SAGE, 70),
    )
    draw.ellipse(
        (width * 0.28, height * 0.42, width * 1.18, height * 1.05),
        fill=(*OCHRE, 48),
    )
    wash = wash.filter(ImageFilter.GaussianBlur(int(width * 0.12)))
    canvas.paste(wash.convert("RGB"), (0, 0), wash.getchannel("A"))
    mask_shape = "circle" if width == 390 else "squircle"
    draw_launcher_grid(canvas, candidate_icon, viewport, mask_shape)
    return canvas


def make_install_mockup(
    candidate_icon: Image.Image,
    viewport: tuple[int, int],
) -> Image.Image:
    width, height = viewport
    canvas = make_launcher_mockup(candidate_icon, viewport)
    dim = Image.new("RGBA", viewport, (70, 67, 59, 92))
    canvas.paste(dim.convert("RGB"), (0, 0), dim.getchannel("A"))

    sheet = Image.new("RGBA", viewport, (0, 0, 0, 0))
    draw = ImageDraw.Draw(sheet, "RGBA")
    margin = 22 if width == 390 else 26
    top = int(height * 0.45)
    draw.rounded_rectangle(
        (margin, top, width - margin, height - margin),
        radius=30,
        fill=(249, 246, 237, 248),
        outline=(139, 128, 109, 90),
        width=2,
    )
    canvas.paste(sheet.convert("RGB"), (0, 0), sheet.getchannel("A"))

    icon_size = 104 if width == 390 else 114
    icon_x = (width - icon_size) // 2
    icon_y = top + 44
    mask_shape = "circle" if width == 390 else "squircle"
    icon, mask = rounded_tile(candidate_icon, icon_size, mask_shape)
    paste_masked_with_shadow(canvas, icon, (icon_x, icon_y), mask, shadow_radius=8)

    controls = ImageDraw.Draw(canvas, "RGBA")
    button_y = icon_y + icon_size + 62
    controls.rounded_rectangle(
        (margin + 42, button_y, width - margin - 42, button_y + 52),
        radius=26,
        fill=(*SAGE, 192),
    )
    controls.ellipse(
        (
            width // 2 - 5,
            button_y + 21,
            width // 2 + 5,
            button_y + 31,
        ),
        fill=(248, 245, 234, 192),
    )
    controls.rounded_rectangle(
        (
            margin + 76,
            button_y + 74,
            width - margin - 76,
            button_y + 112,
        ),
        radius=19,
        outline=(105, 99, 83, 94),
        width=2,
    )
    return canvas


def copy_generated_sources() -> dict[str, dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}
    GENERATED.mkdir(parents=True, exist_ok=True)
    for key, config in CANDIDATES.items():
        source = ASSET_STORE / config["source"]
        destination = GENERATED / config["source"]
        if source.exists():
            shutil.copy2(source, destination)
        elif not destination.exists():
            raise FileNotFoundError(
                f"Missing generated image source in both locations: {source}"
            )
        image = Image.open(destination)
        records[key] = {
            "path": rel(destination),
            "sha256": sha256(destination),
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
            "embeddedIccProfile": bool(image.info.get("icc_profile")),
            "generationTool": "Cursor GenerateImage",
            "generationMode": "reference-conditioned painterly identity art",
        }
    return records


def build_artifacts() -> tuple[dict[str, Image.Image], list[dict[str, Any]]]:
    masters: dict[str, Image.Image] = {}
    smalls: dict[str, dict[int, Image.Image]] = {}
    artifacts: list[dict[str, Any]] = []

    for key, config in CANDIDATES.items():
        source = Image.open(GENERATED / config["source"])
        master = normalized_master(source, key)
        masters[key] = master
        master_path = (
            MASTERS
            / f"app-icon--{config['slug']}--master-1024--{config['id']}--non-shipping-v01.png"
        )
        save_png(master, master_path)

        derivative_specs = [
            (
                512,
                "maskable-any",
                RUNTIME
                / (
                    f"app-icon--{config['slug']}--512--maskable-any--"
                    f"{config['id']}--non-shipping-v01.png"
                ),
            ),
            (
                192,
                "any",
                RUNTIME
                / (
                    f"app-icon--{config['slug']}--192--any--"
                    f"{config['id']}--non-shipping-v01.png"
                ),
            ),
            (
                180,
                "apple-touch",
                RUNTIME
                / (
                    f"app-icon--{config['slug']}--180--apple--"
                    f"{config['id']}--non-shipping-v01.png"
                ),
            ),
        ]
        for size, purpose, path in derivative_specs:
            save_png(master.resize((size, size), RESAMPLE), path)
            artifacts.append(
                {
                    "candidate": config["id"],
                    "role": purpose,
                    "path": rel(path),
                    "expectedDimensions": [size, size],
                }
            )

        smalls[key] = {}
        for size in (48, 32):
            small = simplified_small(master, key, size)
            smalls[key][size] = small
            path = (
                RUNTIME
                / (
                    f"app-icon--{config['slug']}--{size}--simplified--"
                    f"{config['id']}--non-shipping-v01.png"
                )
            )
            save_png(small, path)
            artifacts.append(
                {
                    "candidate": config["id"],
                    "role": "simplified-favicon",
                    "path": rel(path),
                    "expectedDimensions": [size, size],
                }
            )

        artifacts.append(
            {
                "candidate": config["id"],
                "role": "master",
                "path": rel(master_path),
                "expectedDimensions": [1024, 1024],
            }
        )

        proof_path = (
            PROOFS
            / f"mask-safe--{config['id']}--circle-squircle--non-shipping-v01.png"
        )
        save_png(make_mask_proof(master, key), proof_path)
        artifacts.append(
            {
                "candidate": config["id"],
                "role": "mask-safe-proof",
                "path": rel(proof_path),
                "expectedDimensions": [1520, 520],
            }
        )

        for viewport in ((390, 844), (430, 932)):
            width, height = viewport
            launcher_path = (
                MOCKUPS
                / (
                    f"launcher--{config['id']}--{width}x{height}--"
                    "non-shipping-v01.png"
                )
            )
            install_path = (
                MOCKUPS
                / (
                    f"install--{config['id']}--{width}x{height}--"
                    "non-shipping-v01.png"
                )
            )
            save_png(make_launcher_mockup(master, viewport), launcher_path)
            save_png(make_install_mockup(master, viewport), install_path)
            artifacts.extend(
                [
                    {
                        "candidate": config["id"],
                        "role": "launcher-mockup",
                        "path": rel(launcher_path),
                        "expectedDimensions": [width, height],
                    },
                    {
                        "candidate": config["id"],
                        "role": "install-mockup",
                        "path": rel(install_path),
                        "expectedDimensions": [width, height],
                    },
                ]
            )

    selection_path = PROOFS / "selection-board--both--non-shipping-v01.png"
    save_png(make_selection_board(masters), selection_path)
    artifacts.append(
        {
            "candidate": "both",
            "role": "visual-selection-board",
            "path": rel(selection_path),
            "expectedDimensions": [1580, 820],
        }
    )

    legibility_path = (
        PROOFS / "legibility--both--32-48--non-shipping-v01.png"
    )
    save_png(make_legibility_sheet(smalls), legibility_path)
    artifacts.append(
        {
            "candidate": "both",
            "role": "small-size-legibility-proof",
            "path": rel(legibility_path),
            "expectedDimensions": [1580, 650],
        }
    )

    return masters, artifacts


def expected_hashes() -> dict[str, str]:
    manifest_path = REPO / "docs/art/production/portraits/minho/manifest.json"
    production_manifest = json.loads(manifest_path.read_text())
    return {
        data["repoPath"]: data["sha256"]
        for data in production_manifest["production"]["artifacts"].values()
    }


def outside_status() -> list[str]:
    result = subprocess.run(
        ["git", "status", "--porcelain=v1", "--untracked-files=normal"],
        cwd=REPO,
        check=True,
        capture_output=True,
        text=True,
    )
    prefix = "docs/art/candidates/app-identity/"
    return sorted(
        line
        for line in result.stdout.splitlines()
        if prefix not in line.replace("\\", "/")
    )


def validate_artifacts(
    artifacts: list[dict[str, Any]],
    source_records: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    validations: list[dict[str, Any]] = []
    all_ok = True
    for artifact in artifacts:
        path = REPO / artifact["path"]
        image = Image.open(path)
        expected = tuple(artifact["expectedDimensions"])
        actual = image.size
        icc = image.info.get("icc_profile")
        profile_name = ""
        if icc:
            try:
                profile_name = ImageCms.getProfileName(
                    ImageCms.ImageCmsProfile(BytesIO(icc))
                ).strip()
            except Exception:
                profile_name = "embedded-profile-unreadable"
        checks = {
            "dimensions": list(actual) == list(expected),
            "modeRgb": image.mode == "RGB",
            "opaque": "A" not in image.getbands(),
            "embeddedColorProfile": bool(icc),
            "profileIdentifiesSrgb": "sRGB" in profile_name,
        }
        ok = all(checks.values())
        all_ok = all_ok and ok
        artifact.update(
            {
                "width": image.width,
                "height": image.height,
                "mode": image.mode,
                "alpha": "opaque",
                "colorProfile": profile_name or "none",
                "sha256": sha256(path),
            }
        )
        validations.append(
            {
                "path": artifact["path"],
                "role": artifact["role"],
                "checks": checks,
                "ok": ok,
            }
        )

    safe_checks = {}
    for key, config in CANDIDATES.items():
        x0, y0, x1, y1 = config["criticalBounds"]
        corners = [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]
        circle_clearance = min(
            0.5 - math.hypot(x - 0.5, y - 0.5) for x, y in corners
        )
        safe_checks[config["id"]] = {
            "declaredCriticalBoundsNormalized": config["criticalBounds"],
            "insideCentral80Percent": (
                x0 >= 0.1 and y0 >= 0.1 and x1 <= 0.9 and y1 <= 0.9
            ),
            "declaredBoundingCornersInsideUnitCircleMask": circle_clearance >= 0,
            "minimumCircleClearanceNormalized": round(circle_clearance, 4),
            "squircleProofGenerated": True,
        }
        all_ok = all_ok and all(safe_checks[config["id"]].values())

    small_metrics = {}
    for key, config in CANDIDATES.items():
        small_path = next(
            REPO / item["path"]
            for item in artifacts
            if item["candidate"] == config["id"]
            and item["role"] == "simplified-favicon"
            and item["expectedDimensions"] == [32, 32]
        )
        small = np.asarray(Image.open(small_path).convert("L"), dtype=np.float32)
        contrast = float(small.std())
        edge_x = np.abs(np.diff(small, axis=1)).mean()
        edge_y = np.abs(np.diff(small, axis=0)).mean()
        small_metrics[config["id"]] = {
            "luminanceStandardDeviation": round(contrast, 3),
            "meanNeighborEdgeDelta": round(float((edge_x + edge_y) / 2), 3),
            "machineContrastPresent": contrast >= 18.0,
            "humanRecognitionReviewedIn": (
                "docs/art/candidates/app-identity/v1/"
                "proofs/legibility--both--32-48--non-shipping-v01.png"
            ),
        }
        all_ok = all_ok and small_metrics[config["id"]]["machineContrastPresent"]

    production_checks = []
    for repo_path, expected in expected_hashes().items():
        path = REPO / repo_path
        actual = sha256(path)
        production_checks.append(
            {
                "path": repo_path,
                "expectedSha256": expected,
                "actualSha256": actual,
                "unchanged": expected == actual,
            }
        )
        all_ok = all_ok and expected == actual

    return {
        "schemaVersion": 1,
        "batchId": "GEN-01",
        "status": "pass" if all_ok else "fail",
        "checks": {
            "generatedSourceInputs": source_records,
            "artifactValidation": validations,
            "maskSafety": safe_checks,
            "smallSizeMetrics": small_metrics,
            "approvedMinhoProductionHashes": production_checks,
        },
        "notes": [
            (
                "GenerateImage source PNGs are opaque RGB but did not include an ICC "
                "profile; all normalized candidate masters, derivatives, proofs, and "
                "mockups embed the Pillow sRGB profile."
            ),
            (
                "Mask safety uses declared visual critical bounds confirmed against "
                "the generated proofs; background wash is intentionally excluded."
            ),
            (
                "Small-size metrics establish contrast only. Human identity and "
                "recognition findings are recorded in qa/visual-review.md."
            ),
        ],
    }


def write_hashes() -> None:
    paths = sorted(
        path
        for path in ROOT.rglob("*")
        if path.is_file()
        and path.name != "hashes.sha256"
    )
    content = "".join(f"{sha256(path)}  {rel(path)}\n" for path in paths)
    (ROOT / "hashes.sha256").write_text(content)


def build_manifest(
    artifacts: list[dict[str, Any]],
    source_records: dict[str, dict[str, Any]],
    outside_before: list[str],
    outside_after: list[str],
) -> dict[str, Any]:
    references = []
    for repo_path in REFERENCE_PATHS:
        path = REPO / repo_path
        references.append(
            {
                "path": repo_path,
                "sha256": sha256(path),
            }
        )
    return {
        "schemaVersion": 1,
        "manifestKind": "app-identity-candidate-pack",
        "batchId": "GEN-01",
        "assetNeedId": "AA-014",
        "status": "NON-SHIPPING / VISUAL-SELECTION-REQUIRED",
        "outputRoot": "docs/art/candidates/app-identity/v1/",
        "productionModified": False,
        "appCodeModified": False,
        "generation": {
            "tool": "Cursor GenerateImage",
            "actualPainterlyGeneration": True,
            "deterministicPostProcessing": (
                "Pillow sRGB normalization, mask-safe fitting, Lanczos derivatives, "
                "small-size simplification, mask proofs, and viewport mockups"
            ),
            "sourceInputs": source_records,
        },
        "references": references,
        "approvedIdentity": {
            "portraitId": "minho",
            "status": "approved",
            "identityLocks": {
                "eyeColor": "blue-green",
                "coat": "silver-shaded",
                "tail": "thick-tapered-with-soft-ring-markings",
                "body": "compact-sturdy-athletic",
                "accessories": "none",
            },
        },
        "currentPwaContract": {
            "master": "1024x1024 opaque sRGB candidate",
            "manifest192": {"size": "192x192", "purpose": "any"},
            "manifest512": {"size": "512x512", "purpose": "any maskable"},
            "appleTouch": {"size": "180x180"},
            "favicon": ["48x48 simplified", "32x32 simplified"],
        },
        "constraints": {
            "styleIntensity": "B",
            "style": "restrained low-saturation watercolor",
            "criticalSubjectRegion": "central 80%",
            "requiredMasks": ["circle", "squircle"],
            "minimumRecognitionSizePx": 32,
            "forbidden": [
                "text",
                "logo lettering",
                "emoji",
                "hard black outline",
                "pseudo-text",
                "invented or substitute cat",
                "fragile critical detail",
            ],
        },
        "candidates": [
            {
                "id": config["id"],
                "slug": config["slug"],
                "title": config["title"],
                "composition": config["composition"],
                "criticalBoundsNormalized": config["criticalBounds"],
                "distinctFromOtherCandidate": True,
            }
            for config in CANDIDATES.values()
        ],
        "artifacts": sorted(artifacts, key=lambda item: item["path"]),
        "scopeBoundary": {
            "outsideStatusBefore": outside_before,
            "outsideStatusAfter": outside_after,
            "outsideStatusStableDuringBuild": outside_before == outside_after,
            "authoredPaths": ["docs/art/candidates/app-identity/v1/"],
        },
        "selectionGate": {
            "decision": "pending",
            "choices": ["candidate-a", "candidate-b"],
            "nextAction": "stop for user visual selection; do not integrate",
        },
    }


def main() -> None:
    for directory in (GENERATED, MASTERS, RUNTIME, PROOFS, MOCKUPS, QA):
        directory.mkdir(parents=True, exist_ok=True)

    outside_before = outside_status()
    source_records = copy_generated_sources()
    _, artifacts = build_artifacts()
    validation = validate_artifacts(artifacts, source_records)
    (QA / "generated-validation.v1.json").write_text(
        json.dumps(validation, ensure_ascii=False, indent=2) + "\n"
    )
    if validation["status"] != "pass":
        raise RuntimeError("Generated artifact validation failed")

    outside_after = outside_status()
    manifest = build_manifest(
        artifacts, source_records, outside_before, outside_after
    )
    (ROOT / "manifest.v1.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    )
    write_hashes()
    print(
        json.dumps(
            {
                "status": validation["status"],
                "artifactCount": len(artifacts),
                "outsideStatusStable": outside_before == outside_after,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
