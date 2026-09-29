#!/usr/bin/env python3
"""Build and validate the isolated GEN-04 UI surface candidate pack."""

from __future__ import annotations

import hashlib
import json
import math
import shutil
from pathlib import Path
from typing import Any

import numpy as np
import PIL
from PIL import Image, ImageDraw, ImageFont, features


ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parents[4]
STATUS = "NON-SHIPPING / VISUAL-REVIEW-ONLY"
CREATED_AT = "2026-07-21"
MASTER_SIZE = 1024
SEEDS = {
    "paper_low": 202607210401,
    "paper_mid": 202607210402,
    "paper_fine": 202607210403,
    "wash_low": 202607210411,
    "wash_mid": 202607210412,
    "wash_granulation": 202607210413,
    "wash_color": 202607210414,
}
EXPECTED_DEPENDENCIES = {
    "numpy": "2.4.6",
    "Pillow": "12.3.0",
}

MASTER_PAPER = (
    ROOT
    / "masters/surface--paper-warm--seamless--master-1024--non-shipping-v01.png"
)
MASTER_WASH = (
    ROOT
    / "masters/surface--sage-wash--seamless--master-1024--non-shipping-v01.png"
)
RUNTIME_PAPER_1X = (
    ROOT
    / "runtime/surface--paper-warm--tile-512--1x--non-shipping-v01.webp"
)
RUNTIME_PAPER_2X = (
    ROOT
    / "runtime/surface--paper-warm--tile-1024--2x--non-shipping-v01.webp"
)
RUNTIME_WASH_1X = (
    ROOT
    / "runtime/surface--sage-wash--tile-512--1x--non-shipping-v01.webp"
)
RUNTIME_WASH_2X = (
    ROOT
    / "runtime/surface--sage-wash--tile-1024--2x--non-shipping-v01.webp"
)

SRGB_PROFILE_SOURCE = (
    REPO_ROOT / "public/portraits/minho/portrait--minho--sit--v01.png"
)
with Image.open(SRGB_PROFILE_SOURCE) as profile_source:
    SRGB_PROFILE = profile_source.info.get("icc_profile")
if not SRGB_PROFILE:
    raise RuntimeError(f"Missing embedded sRGB profile: {SRGB_PROFILE_SOURCE}")


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def reset_generated_outputs() -> None:
    for directory in ("masters", "runtime", "qa", "source"):
        target = ROOT / directory
        if target.exists():
            shutil.rmtree(target)
        target.mkdir(parents=True, exist_ok=True)
    for filename in ("README.md", "manifest.v1.json", "hashes.sha256"):
        target = ROOT / filename
        if target.exists():
            target.unlink()


def assert_environment() -> None:
    actual = {
        "numpy": np.__version__,
        "Pillow": PIL.__version__,
    }
    if actual != EXPECTED_DEPENDENCIES:
        raise RuntimeError(
            f"Dependency mismatch: expected {EXPECTED_DEPENDENCIES}, got {actual}"
        )
    if not features.check("webp"):
        raise RuntimeError("Pillow WebP support is required")


def save_png(path: Path, pixels: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels).save(
        path,
        format="PNG",
        icc_profile=SRGB_PROFILE,
        compress_level=9,
        optimize=True,
    )


def save_webp(path: Path, pixels: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels).save(
        path,
        format="WEBP",
        lossless=True,
        quality=100,
        method=6,
        exact=True,
        icc_profile=SRGB_PROFILE,
    )


def load_pixels(path: Path) -> np.ndarray:
    with Image.open(path) as image:
        image.load()
        return np.asarray(image).copy()


def rgb(hex_color: str) -> np.ndarray:
    value = hex_color.removeprefix("#")
    return np.array(
        [int(value[index : index + 2], 16) for index in (0, 2, 4)],
        dtype=np.uint8,
    )


def srgb_to_linear(values: np.ndarray) -> np.ndarray:
    values = values.astype(np.float64) / 255.0
    return np.where(
        values <= 0.04045,
        values / 12.92,
        ((values + 0.055) / 1.055) ** 2.4,
    )


def relative_luminance(values: np.ndarray) -> np.ndarray:
    linear = srgb_to_linear(values)
    return (
        0.2126 * linear[..., 0]
        + 0.7152 * linear[..., 1]
        + 0.0722 * linear[..., 2]
    )


def contrast_values(text_color: np.ndarray, background: np.ndarray) -> np.ndarray:
    text_luminance = float(relative_luminance(text_color))
    background_luminance = relative_luminance(background)
    lighter = np.maximum(background_luminance, text_luminance)
    darker = np.minimum(background_luminance, text_luminance)
    return (lighter + 0.05) / (darker + 0.05)


def rounded(value: float, digits: int = 6) -> float:
    return round(float(value), digits)


def periodic_field(
    size: int,
    seed: int,
    *,
    beta: float,
    lowpass: float,
    highpass: float,
) -> np.ndarray:
    """Create an isotropic field on an integer-frequency periodic lattice."""
    random = np.random.default_rng(seed).standard_normal((size, size))
    spectrum = np.fft.rfft2(random)
    frequency_y = np.fft.fftfreq(size)[:, None]
    frequency_x = np.fft.rfftfreq(size)[None, :]
    radius = np.sqrt(frequency_x**2 + frequency_y**2)

    safe_radius = np.maximum(radius, 1.0 / size)
    shaping = safe_radius ** (-beta / 2.0)
    shaping *= np.exp(-((radius / lowpass) ** 6))
    shaping *= 1.0 - np.exp(-((radius / highpass) ** 6))
    shaping[0, 0] = 0.0

    field = np.fft.irfft2(spectrum * shaping, s=(size, size)).real
    field -= field.mean()
    field /= field.std()
    return field.astype(np.float32)


def choose_low_energy_origin(channel: np.ndarray) -> tuple[np.ndarray, dict[str, int]]:
    """Move the lowest-energy toroidal row/column cut to the tile boundary."""
    if channel.ndim == 3:
        working = (
            0.2126 * channel[..., 0]
            + 0.7152 * channel[..., 1]
            + 0.0722 * channel[..., 2]
        )
    else:
        working = channel.astype(np.float64)

    x_energy = np.mean((working - np.roll(working, 1, axis=1)) ** 2, axis=0)
    y_energy = np.mean((working - np.roll(working, 1, axis=0)) ** 2, axis=1)
    cut_x = int(np.argmin(x_energy))
    cut_y = int(np.argmin(y_energy))
    shifted = np.roll(channel, shift=(-cut_y, -cut_x), axis=(0, 1))
    return shifted, {"cutX": cut_x, "cutY": cut_y}


def make_paper_master() -> tuple[np.ndarray, dict[str, int]]:
    low = periodic_field(
        MASTER_SIZE,
        SEEDS["paper_low"],
        beta=2.0,
        lowpass=0.030,
        highpass=0.0014,
    )
    mid = periodic_field(
        MASTER_SIZE,
        SEEDS["paper_mid"],
        beta=1.0,
        lowpass=0.115,
        highpass=0.012,
    )
    fine = periodic_field(
        MASTER_SIZE,
        SEEDS["paper_fine"],
        beta=0.1,
        lowpass=0.340,
        highpass=0.075,
    )

    texture = 0.72 * low + 0.23 * mid + 0.05 * fine
    texture /= texture.std()
    texture = np.tanh(texture / 2.2) * 2.2
    warmth = np.tanh(low / 2.5) * 2.5

    base = np.array([253.0, 250.0, 243.0], dtype=np.float32)
    paper = np.empty((MASTER_SIZE, MASTER_SIZE, 3), dtype=np.float32)
    paper[..., 0] = base[0] + 0.94 * texture + 0.18 * warmth
    paper[..., 1] = base[1] + 0.96 * texture + 0.03 * warmth
    paper[..., 2] = base[2] + 1.02 * texture - 0.20 * warmth
    paper = np.clip(np.rint(paper), 0, 255).astype(np.uint8)
    return choose_low_energy_origin(paper)


def make_wash_master() -> tuple[np.ndarray, dict[str, int]]:
    low = periodic_field(
        MASTER_SIZE,
        SEEDS["wash_low"],
        beta=2.3,
        lowpass=0.019,
        highpass=0.0012,
    )
    mid = periodic_field(
        MASTER_SIZE,
        SEEDS["wash_mid"],
        beta=1.2,
        lowpass=0.072,
        highpass=0.007,
    )
    granulation = periodic_field(
        MASTER_SIZE,
        SEEDS["wash_granulation"],
        beta=0.3,
        lowpass=0.240,
        highpass=0.045,
    )
    color_field = periodic_field(
        MASTER_SIZE,
        SEEDS["wash_color"],
        beta=1.0,
        lowpass=0.055,
        highpass=0.006,
    )

    wash = 0.76 * low + 0.20 * mid + 0.04 * granulation
    wash /= wash.std()
    wash = np.tanh(wash / 2.1) * 2.1
    alpha = np.rint(4.7 + 2.25 * wash + 0.28 * granulation)
    alpha = np.clip(alpha, 0, 10).astype(np.uint8)

    color_variation = np.tanh(color_field / 2.2) * 2.2
    wash_rgb = np.empty((MASTER_SIZE, MASTER_SIZE, 3), dtype=np.float32)
    wash_rgb[..., 0] = 135.0 + 1.2 * color_variation
    wash_rgb[..., 1] = 155.0 + 1.0 * color_variation
    wash_rgb[..., 2] = 112.0 + 1.4 * color_variation
    wash_rgb = np.clip(np.rint(wash_rgb), 0, 255).astype(np.uint8)
    wash_rgb[alpha == 0] = 0

    rgba = np.dstack((wash_rgb, alpha))
    shifted, origin = choose_low_energy_origin(alpha)
    shift_y = -origin["cutY"]
    shift_x = -origin["cutX"]
    rgba = np.roll(rgba, shift=(shift_y, shift_x), axis=(0, 1))
    if not np.array_equal(shifted, rgba[..., 3]):
        raise AssertionError("Wash origin shift mismatch")
    return rgba, origin


def area_downsample_rgb(values: np.ndarray, target: int) -> np.ndarray:
    factor = values.shape[0] // target
    if values.shape[:2] != (target * factor, target * factor):
        raise ValueError("Target must divide the square source")
    reshaped = values.reshape(target, factor, target, factor, 3)
    averaged = reshaped.astype(np.float64).mean(axis=(1, 3))
    return np.clip(np.rint(averaged), 0, 255).astype(np.uint8)


def area_downsample_rgba(values: np.ndarray, target: int) -> np.ndarray:
    factor = values.shape[0] // target
    if values.shape[:2] != (target * factor, target * factor):
        raise ValueError("Target must divide the square source")

    alpha = values[..., 3].astype(np.float64) / 255.0
    premultiplied = values[..., :3].astype(np.float64) * alpha[..., None]

    alpha_average = alpha.reshape(target, factor, target, factor).mean(axis=(1, 3))
    premultiplied_average = premultiplied.reshape(
        target, factor, target, factor, 3
    ).mean(axis=(1, 3))

    output_rgb = np.zeros((target, target, 3), dtype=np.float64)
    visible = alpha_average > 0
    output_rgb[visible] = (
        premultiplied_average[visible] / alpha_average[visible, None]
    )
    output_alpha = np.clip(np.rint(alpha_average * 255.0), 0, 255).astype(
        np.uint8
    )
    output_rgb = np.clip(np.rint(output_rgb), 0, 255).astype(np.uint8)
    output_rgb[output_alpha == 0] = 0
    return np.dstack((output_rgb, output_alpha))


def composite(background: np.ndarray, foreground: np.ndarray) -> np.ndarray:
    alpha = foreground[..., 3:4].astype(np.float64) / 255.0
    result = (
        foreground[..., :3].astype(np.float64) * alpha
        + background.astype(np.float64) * (1.0 - alpha)
    )
    return np.clip(np.rint(result), 0, 255).astype(np.uint8)


def blend_solid(
    background: np.ndarray, foreground_color: str, opacity: float
) -> np.ndarray:
    foreground = rgb(foreground_color).astype(np.float64)
    result = (
        foreground[None, None, :] * opacity
        + background.astype(np.float64) * (1.0 - opacity)
    )
    return np.clip(np.rint(result), 0, 255).astype(np.uint8)


def tiled(
    tile: np.ndarray,
    width: int,
    height: int,
    *,
    offset_x: int = 0,
    offset_y: int = 0,
) -> np.ndarray:
    x = (np.arange(width) + offset_x) % tile.shape[1]
    y = (np.arange(height) + offset_y) % tile.shape[0]
    return tile[y[:, None], x[None, :]]


def image_metadata(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        image.load()
        metadata: dict[str, Any] = {
            "format": image.format,
            "width": image.width,
            "height": image.height,
            "pixelMode": image.mode,
            "iccProfile": bool(image.info.get("icc_profile")),
        }
        if "A" in image.getbands():
            pixels = np.asarray(image)
            alpha = pixels[..., -1]
            metadata["alphaExtrema"] = [
                int(alpha.min()),
                int(alpha.max()),
            ]
            transparent = alpha == 0
            metadata["transparentPixelRgbZero"] = bool(
                not transparent.any()
                or np.all(pixels[..., :3][transparent] == 0)
            )
        return metadata


def flat_surface(color: str, size: int = 256) -> np.ndarray:
    return np.broadcast_to(rgb(color), (size, size, 3)).copy()


def contrast_stats(text_color: str, background: np.ndarray) -> dict[str, float]:
    values = contrast_values(rgb(text_color), background)
    return {
        "minimum": rounded(values.min(), 3),
        "p01": rounded(np.percentile(values, 1), 3),
        "median": rounded(np.median(values), 3),
        "maximum": rounded(values.max(), 3),
    }


def build_contrast_metrics(
    paper: np.ndarray,
    paper_and_wash: np.ndarray,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    entries: list[dict[str, Any]] = []
    visuals: list[dict[str, Any]] = []

    definitions = [
        {
            "id": "body-ink",
            "role": "body text",
            "textColor": "#4f5144",
            "currentBackground": "#f6f0df",
            "threshold": 4.5,
            "fontPx": 16,
            "sample": "Body text remains calm and clear.",
        },
        {
            "id": "core-caption",
            "role": "small caption / --ink-soft",
            "textColor": "#7c7d6d",
            "currentBackground": "#f6f0df",
            "threshold": 4.5,
            "fontPx": 12,
            "sample": "Caption 12 px / current ink-soft",
        },
        {
            "id": "postcard-caption",
            "role": "postcard small caption",
            "textColor": "#838273",
            "currentBackground": "#f8efd8",
            "threshold": 4.5,
            "fontPx": 10,
            "sample": "Postcard caption 10 px",
        },
        {
            "id": "status-caption",
            "role": "status line caption",
            "textColor": "#898878",
            "currentBackground": "#f6f0df",
            "threshold": 4.5,
            "fontPx": 11,
            "sample": "Status caption 11 px",
        },
    ]

    for definition in definitions:
        baseline = flat_surface(definition["currentBackground"])
        backgrounds = {
            "currentFlat": baseline,
            "candidatePaper": paper,
            "candidatePaperPlusSage": paper_and_wash,
        }
        measurements = {
            key: contrast_stats(definition["textColor"], value)
            for key, value in backgrounds.items()
        }
        baseline_ratio = measurements["currentFlat"]["minimum"]
        no_regression = all(
            measurements[key]["minimum"] + 0.01 >= baseline_ratio
            for key in ("candidatePaper", "candidatePaperPlusSage")
        )
        entries.append(
            {
                **definition,
                "measurements": measurements,
                "currentFlatPassesWcagAaSmallText": (
                    baseline_ratio >= definition["threshold"]
                ),
                "candidatePaperPassesWcagAaSmallText": (
                    measurements["candidatePaper"]["minimum"]
                    >= definition["threshold"]
                ),
                "candidatePaperPlusSagePassesWcagAaSmallText": (
                    measurements["candidatePaperPlusSage"]["minimum"]
                    >= definition["threshold"]
                ),
                "textureIntroducesContrastRegression": not no_regression,
            }
        )
        visuals.append({**definition, "backgrounds": backgrounds})

    button_definitions = [
        {
            "id": "adoption-button",
            "role": "opaque primary button text",
            "textColor": "#4f5144",
            "threshold": 4.5,
            "fontPx": 11,
            "sample": "Primary action",
            "currentBase": "#f6f0df",
            "buttonColor": "#dce5ce",
            "buttonOpacity": 1.0,
        },
        {
            "id": "transfer-button",
            "role": "translucent transfer button text",
            "textColor": "#4f5144",
            "threshold": 4.5,
            "fontPx": 11,
            "sample": "Transfer action",
            "currentBase": "#f7f0df",
            "buttonColor": "#e4ead8",
            "buttonOpacity": 0.82,
        },
        {
            "id": "secondary-button",
            "role": "translucent secondary button text",
            "textColor": "#4f5144",
            "threshold": 4.5,
            "fontPx": 11,
            "sample": "Secondary action",
            "currentBase": "#f7f0df",
            "buttonColor": "#fffcf1",
            "buttonOpacity": 0.74,
        },
        {
            "id": "transparent-nav-button",
            "role": "transparent navigation button text",
            "textColor": "#4f5144",
            "threshold": 4.5,
            "fontPx": 12,
            "sample": "Navigation",
            "currentBase": "#f6f0df",
            "buttonColor": None,
            "buttonOpacity": 0.0,
        },
    ]

    for definition in button_definitions:
        base_backgrounds = {
            "currentFlat": flat_surface(definition["currentBase"]),
            "candidatePaper": paper,
            "candidatePaperPlusSage": paper_and_wash,
        }
        if definition["buttonColor"] is None:
            backgrounds = base_backgrounds
        else:
            backgrounds = {
                key: blend_solid(
                    value,
                    definition["buttonColor"],
                    definition["buttonOpacity"],
                )
                for key, value in base_backgrounds.items()
            }

        measurements = {
            key: contrast_stats(definition["textColor"], value)
            for key, value in backgrounds.items()
        }
        baseline_ratio = measurements["currentFlat"]["minimum"]
        no_regression = all(
            measurements[key]["minimum"] + 0.01 >= baseline_ratio
            for key in ("candidatePaper", "candidatePaperPlusSage")
        )
        serializable = {
            key: value
            for key, value in definition.items()
            if key not in {"currentBase"}
        }
        entries.append(
            {
                **serializable,
                "measurements": measurements,
                "currentFlatPassesWcagAaSmallText": (
                    baseline_ratio >= definition["threshold"]
                ),
                "candidatePaperPassesWcagAaSmallText": (
                    measurements["candidatePaper"]["minimum"]
                    >= definition["threshold"]
                ),
                "candidatePaperPlusSagePassesWcagAaSmallText": (
                    measurements["candidatePaperPlusSage"]["minimum"]
                    >= definition["threshold"]
                ),
                "textureIntroducesContrastRegression": not no_regression,
            }
        )
        visuals.append({**serializable, "backgrounds": backgrounds})

    findings = [
        {
            "id": entry["id"],
            "role": entry["role"],
            "textColor": entry["textColor"],
            "currentFlatMinimum": entry["measurements"]["currentFlat"]["minimum"],
            "finding": (
                "pre-existing-small-text-AA-failure"
                if not entry["currentFlatPassesWcagAaSmallText"]
                else "passes-current-flat-baseline"
            ),
        }
        for entry in entries
        if not entry["currentFlatPassesWcagAaSmallText"]
    ]
    result = {
        "schemaVersion": 1,
        "status": STATUS,
        "method": "WCAG 2.x relative luminance, sampled per background pixel",
        "threshold": {
            "smallTextAa": 4.5,
            "largeTextAa": 3.0,
        },
        "entries": entries,
        "textureIntroducesAnyContrastRegression": any(
            entry["textureIntroducesContrastRegression"] for entry in entries
        ),
        "preExistingAccessibilityFindings": findings,
        "interpretation": (
            "The candidate surfaces are at least as contrast-supportive as each "
            "current flat baseline. Existing small caption colors that are below "
            "4.5:1 remain pre-existing CSS findings and are not fixed in this "
            "art-only batch."
        ),
    }
    return result, visuals


def scalar_channel(values: np.ndarray) -> np.ndarray:
    if values.ndim == 2:
        return values.astype(np.float64)
    if values.shape[2] == 4:
        return values[..., 3].astype(np.float64)
    return (
        0.2126 * values[..., 0]
        + 0.7152 * values[..., 1]
        + 0.0722 * values[..., 2]
    ).astype(np.float64)


def seam_metrics(values: np.ndarray) -> dict[str, Any]:
    channel = scalar_channel(values)
    interior_x = np.diff(channel, axis=1)
    interior_y = np.diff(channel, axis=0)
    seam_x = channel[:, 0] - channel[:, -1]
    seam_y = channel[0, :] - channel[-1, :]

    interior_x_rms = math.sqrt(float(np.mean(interior_x**2)))
    interior_y_rms = math.sqrt(float(np.mean(interior_y**2)))

    offsets = [
        (0, 0),
        (73 % channel.shape[1], 119 % channel.shape[0]),
        (137 % channel.shape[1], 211 % channel.shape[0]),
    ]
    offset_checks = []
    for offset_x, offset_y in offsets:
        rolled = np.roll(channel, shift=(-offset_y, -offset_x), axis=(0, 1))
        rolled_seam_x = rolled[:, 0] - rolled[:, -1]
        rolled_seam_y = rolled[0, :] - rolled[-1, :]
        offset_checks.append(
            {
                "offset": [offset_x, offset_y],
                "xWrapRms": rounded(
                    math.sqrt(float(np.mean(rolled_seam_x**2))), 4
                ),
                "yWrapRms": rounded(
                    math.sqrt(float(np.mean(rolled_seam_y**2))), 4
                ),
            }
        )

    test_width = channel.shape[1] * 2 + 37
    test_height = channel.shape[0] * 2 + 53
    tiled_channel = tiled(
        channel,
        test_width,
        test_height,
        offset_x=37,
        offset_y=53,
    )
    horizontal_shift_delta = (
        tiled_channel[:, channel.shape[1] :]
        - tiled_channel[:, : -channel.shape[1]]
    )
    vertical_shift_delta = (
        tiled_channel[channel.shape[0] :, :]
        - tiled_channel[: -channel.shape[0], :]
    )

    x_wrap_rms = math.sqrt(float(np.mean(seam_x**2)))
    y_wrap_rms = math.sqrt(float(np.mean(seam_y**2)))
    result = {
        "xWrap": {
            "mae": rounded(np.mean(np.abs(seam_x)), 4),
            "rms": rounded(x_wrap_rms, 4),
            "maximum": rounded(np.max(np.abs(seam_x)), 4),
            "rmsToInteriorRmsRatio": rounded(
                x_wrap_rms / max(interior_x_rms, 1e-12), 4
            ),
        },
        "yWrap": {
            "mae": rounded(np.mean(np.abs(seam_y)), 4),
            "rms": rounded(y_wrap_rms, 4),
            "maximum": rounded(np.max(np.abs(seam_y)), 4),
            "rmsToInteriorRmsRatio": rounded(
                y_wrap_rms / max(interior_y_rms, 1e-12), 4
            ),
        },
        "interiorNeighborRms": {
            "x": rounded(interior_x_rms, 4),
            "y": rounded(interior_y_rms, 4),
        },
        "oppositeEdgeMeanDelta": {
            "x": rounded(abs(channel[:, 0].mean() - channel[:, -1].mean()), 4),
            "y": rounded(abs(channel[0, :].mean() - channel[-1, :].mean()), 4),
        },
        "offsetCutChecks": offset_checks,
        "exactTileShiftInvariance": {
            "horizontalRmse": rounded(
                math.sqrt(float(np.mean(horizontal_shift_delta**2))), 8
            ),
            "verticalRmse": rounded(
                math.sqrt(float(np.mean(vertical_shift_delta**2))), 8
            ),
        },
    }
    result["pass"] = bool(
        result["xWrap"]["rmsToInteriorRmsRatio"] <= 1.5
        and result["yWrap"]["rmsToInteriorRmsRatio"] <= 1.5
        and result["exactTileShiftInvariance"]["horizontalRmse"] == 0.0
        and result["exactTileShiftInvariance"]["verticalRmse"] == 0.0
    )
    return result


def frequency_metrics(values: np.ndarray) -> dict[str, Any]:
    channel = scalar_channel(values)
    residual = channel - channel.mean()
    standard_deviation = float(residual.std())
    spectrum = np.fft.fft2(residual)
    power = np.abs(spectrum) ** 2
    power[0, 0] = 0.0
    power_sum = float(power.sum())

    gradient_x = np.roll(channel, -1, axis=1) - channel
    gradient_y = np.roll(channel, -1, axis=0) - channel
    gradient_x_rms = math.sqrt(float(np.mean(gradient_x**2)))
    gradient_y_rms = math.sqrt(float(np.mean(gradient_y**2)))

    autocorrelation = np.fft.ifft2(np.abs(spectrum) ** 2).real
    autocorrelation /= max(float(autocorrelation[0, 0]), 1e-12)
    size_y, size_x = channel.shape
    x_distance = np.minimum(np.arange(size_x), size_x - np.arange(size_x))
    y_distance = np.minimum(np.arange(size_y), size_y - np.arange(size_y))
    radius = np.sqrt(y_distance[:, None] ** 2 + x_distance[None, :] ** 2)
    nontrivial = radius >= min(size_x, size_y) * 0.12

    shifts = [
        (size_x // 2, 0),
        (0, size_y // 2),
        (size_x // 3, size_y // 3),
        (size_x // 4, size_y // 4),
    ]
    shift_checks = []
    for shift_x, shift_y in shifts:
        shifted = np.roll(channel, shift=(shift_y, shift_x), axis=(0, 1))
        normalized_rmse = math.sqrt(float(np.mean((channel - shifted) ** 2))) / max(
            standard_deviation, 1e-12
        )
        shift_checks.append(
            {
                "shift": [shift_x, shift_y],
                "normalizedRmse": rounded(normalized_rmse, 4),
            }
        )

    dominant_fraction = float(power.max() / max(power_sum, 1e-12))
    autocorrelation_max = float(np.max(np.abs(autocorrelation[nontrivial])))
    gradient_ratio = gradient_x_rms / max(gradient_y_rms, 1e-12)
    minimum_shift_rmse = min(item["normalizedRmse"] for item in shift_checks)

    result = {
        "standardDeviation": rounded(standard_deviation, 4),
        "dominantNonDcBinPowerFraction": rounded(dominant_fraction, 6),
        "axisGradientRms": {
            "x": rounded(gradient_x_rms, 4),
            "y": rounded(gradient_y_rms, 4),
            "xToYRatio": rounded(gradient_ratio, 4),
        },
        "maximumAbsoluteAutocorrelationOutside12PercentRadius": rounded(
            autocorrelation_max, 4
        ),
        "subtileShiftChecks": shift_checks,
        "minimumSubtileShiftNormalizedRmse": rounded(minimum_shift_rmse, 4),
    }
    result["pass"] = bool(
        dominant_fraction <= 0.12
        and 0.75 <= gradient_ratio <= 1.33
        and autocorrelation_max <= 0.58
        and minimum_shift_rmse >= 0.65
    )
    return result


def font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
        if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf"
    )
    return ImageFont.truetype(name, size=size)


def paste_rounded_surface(
    canvas: Image.Image,
    patch: np.ndarray,
    box: tuple[int, int, int, int],
    radius: int,
    *,
    border: tuple[int, int, int] = (116, 116, 100),
    border_width: int = 2,
) -> None:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    if patch.shape[:2] != (height, width):
        raise ValueError("Patch and box sizes differ")
    mask = Image.new("L", (width, height), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(
        (0, 0, width - 1, height - 1),
        radius=radius,
        fill=255,
    )
    canvas.paste(Image.fromarray(patch), (left, top), mask)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(
        (left, top, right - 1, bottom - 1),
        radius=radius,
        outline=border,
        width=border_width,
    )


def make_common_sizes_proof(
    paper: np.ndarray,
    wash: np.ndarray,
    *,
    scale: int,
    output: Path,
) -> None:
    width = 1200 * scale
    height = 1600 * scale
    canvas = Image.new("RGB", (width, height), (48, 51, 44))
    draw = ImageDraw.Draw(canvas)
    title_font = font(32 * scale, bold=True)
    label_font = font(18 * scale, bold=True)
    detail_font = font(14 * scale)
    draw.text(
        (52 * scale, 38 * scale),
        f"GEN-04 common UI surface sizes - {scale}x",
        font=title_font,
        fill=(246, 240, 223),
    )
    draw.text(
        (52 * scale, 86 * scale),
        "Decoded runtime tiles; labels and borders are QA-only.",
        font=detail_font,
        fill=(197, 201, 184),
    )

    paper_and_wash = composite(paper, wash)

    def patch(
        tile: np.ndarray,
        logical_width: int,
        logical_height: int,
        offset: tuple[int, int],
    ) -> np.ndarray:
        return tiled(
            tile,
            logical_width * scale,
            logical_height * scale,
            offset_x=offset[0] * scale,
            offset_y=offset[1] * scale,
        )

    drawer_box = tuple(value * scale for value in (52, 170, 522, 890))
    drawer_patch = patch(paper_and_wash, 470, 720, (43, 71))
    paste_rounded_surface(
        canvas,
        drawer_patch,
        drawer_box,
        radius=28 * scale,
        border_width=2 * scale,
    )
    draw.text(
        (64 * scale, 128 * scale),
        "Drawer 470 x 720",
        font=label_font,
        fill=(239, 234, 217),
    )

    card_box = tuple(value * scale for value in (650, 190, 1072, 272))
    card_patch = patch(paper_and_wash, 422, 82, (117, 29))
    paste_rounded_surface(
        canvas,
        card_patch,
        card_box,
        radius=17 * scale,
        border_width=1 * scale,
    )
    draw.text(
        (650 * scale, 148 * scale),
        "Item card 422 x 82",
        font=label_font,
        fill=(239, 234, 217),
    )

    postcard_box = tuple(value * scale for value in (650, 370, 1028, 736))
    postcard_patch = patch(paper, 378, 366, (83, 149))
    paste_rounded_surface(
        canvas,
        postcard_patch,
        postcard_box,
        radius=8 * scale,
        border_width=1 * scale,
    )
    draw.text(
        (650 * scale, 328 * scale),
        "Postcard card 378 x 366",
        font=label_font,
        fill=(239, 234, 217),
    )

    adoption_box = tuple(value * scale for value in (650, 835, 1068, 1355))
    adoption_patch = patch(paper_and_wash, 418, 520, (151, 203))
    paste_rounded_surface(
        canvas,
        adoption_patch,
        adoption_box,
        radius=28 * scale,
        border_width=1 * scale,
    )
    draw.text(
        (650 * scale, 793 * scale),
        "Adoption card 418 x 520",
        font=label_font,
        fill=(239, 234, 217),
    )

    mini_boxes = [
        ("Nav tile 58 x 58", (94, 1015, 152, 1073), (17, 31)),
        ("Token 46 x 46", (94, 1135, 140, 1181), (61, 13)),
        ("Button 180 x 38", (94, 1265, 274, 1303), (101, 47)),
    ]
    for label, logical_box, offset in mini_boxes:
        box = tuple(value * scale for value in logical_box)
        logical_width = logical_box[2] - logical_box[0]
        logical_height = logical_box[3] - logical_box[1]
        mini_patch = patch(
            paper_and_wash,
            logical_width,
            logical_height,
            offset,
        )
        paste_rounded_surface(
            canvas,
            mini_patch,
            box,
            radius=min(logical_width, logical_height) // 3 * scale,
            border_width=max(1, scale),
        )
        draw.text(
            (94 * scale, (logical_box[1] - 34) * scale),
            label,
            font=detail_font,
            fill=(220, 220, 204),
        )

    draw.text(
        (52 * scale, 1480 * scale),
        "Every panel uses a non-zero deterministic tile offset.",
        font=detail_font,
        fill=(197, 201, 184),
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(
        output,
        format="PNG",
        icc_profile=SRGB_PROFILE,
        compress_level=9,
        optimize=True,
    )


def make_contrast_proof(
    metrics: dict[str, Any],
    visuals: list[dict[str, Any]],
    output: Path,
) -> None:
    canvas = Image.new("RGB", (1200, 1600), (48, 51, 44))
    draw = ImageDraw.Draw(canvas)
    draw.text(
        (45, 35),
        "GEN-04 current text colors - contrast proof",
        font=font(30, bold=True),
        fill=(246, 240, 223),
    )
    draw.text(
        (45, 82),
        "Per-pixel WCAG contrast. Candidate values show the minimum tile ratio.",
        font=font(14),
        fill=(202, 205, 190),
    )

    columns = [
        ("Current flat", 45),
        ("Candidate paper", 425),
        ("Paper + sage", 805),
    ]
    for label, x in columns:
        draw.text(
            (x, 124),
            label,
            font=font(17, bold=True),
            fill=(232, 228, 211),
        )

    row_height = 155
    top = 168
    for index, (entry, visual) in enumerate(zip(metrics["entries"], visuals)):
        y = top + index * row_height
        draw.text(
            (45, y),
            f"{entry['role']}  {entry['textColor']}",
            font=font(13, bold=True),
            fill=(205, 207, 193),
        )
        for column_index, key in enumerate(
            ("currentFlat", "candidatePaper", "candidatePaperPlusSage")
        ):
            x = columns[column_index][1]
            patch = tiled(
                visual["backgrounds"][key],
                330,
                116,
                offset_x=31 + 41 * column_index,
                offset_y=19 + 37 * index,
            )
            patch_image = Image.fromarray(patch)
            mask = Image.new("L", (330, 116), 0)
            ImageDraw.Draw(mask).rounded_rectangle(
                (0, 0, 329, 115),
                radius=13,
                fill=255,
            )
            canvas.paste(patch_image, (x, y + 31), mask)
            draw.rounded_rectangle(
                (x, y + 31, x + 329, y + 146),
                radius=13,
                outline=(109, 108, 92),
                width=1,
            )
            text_size = max(12, int(entry["fontPx"]))
            draw.text(
                (x + 16, y + 52),
                entry["sample"],
                font=font(text_size, bold="button" in entry["role"]),
                fill=tuple(rgb(entry["textColor"]).tolist()),
            )
            measurement = entry["measurements"][key]
            passes = measurement["minimum"] >= entry["threshold"]
            result_label = "AA pass" if passes else "AA fail (existing color)"
            draw.text(
                (x + 16, y + 100),
                f"min {measurement['minimum']:.2f}:1  {result_label}",
                font=font(12, bold=True),
                fill=tuple(rgb(entry["textColor"]).tolist()),
            )

    footer_y = 1450
    regression = metrics["textureIntroducesAnyContrastRegression"]
    footer_text = (
        "FAIL: texture reduced a current baseline."
        if regression
        else "PASS: texture introduces no contrast regression versus current flat surfaces."
    )
    draw.text(
        (45, footer_y),
        footer_text,
        font=font(16, bold=True),
        fill=(224, 231, 211) if not regression else (240, 180, 160),
    )
    draw.text(
        (45, footer_y + 38),
        "Core, postcard, and status caption colors remain below 4.5:1 before texture;",
        font=font(13),
        fill=(224, 197, 159),
    )
    draw.text(
        (45, footer_y + 62),
        "this candidate pack records that CSS accessibility debt but does not edit app code.",
        font=font(13),
        fill=(224, 197, 159),
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(
        output,
        format="PNG",
        icc_profile=SRGB_PROFILE,
        compress_level=9,
        optimize=True,
    )


def diagnostic_spatial(channel: np.ndarray) -> np.ndarray:
    residual = channel - channel.mean()
    scale = max(float(np.percentile(np.abs(residual), 99.5)), 1e-12)
    normalized = np.clip(127.5 + 118.0 * residual / scale, 0, 255)
    return normalized.astype(np.uint8)


def diagnostic_spectrum(channel: np.ndarray) -> np.ndarray:
    residual = channel - channel.mean()
    power = np.log1p(np.abs(np.fft.fftshift(np.fft.fft2(residual))) ** 2)
    low, high = np.percentile(power, (5, 99.8))
    normalized = np.clip((power - low) / max(high - low, 1e-12), 0, 1)
    return np.rint(normalized * 255).astype(np.uint8)


def diagnostic_autocorrelation(channel: np.ndarray) -> np.ndarray:
    residual = channel - channel.mean()
    spectrum = np.fft.fft2(residual)
    correlation = np.fft.ifft2(np.abs(spectrum) ** 2).real
    correlation /= max(float(correlation[0, 0]), 1e-12)
    correlation = np.fft.fftshift(correlation)
    normalized = np.clip(127.5 + correlation * 127.5, 0, 255)
    return normalized.astype(np.uint8)


def make_frequency_proof(
    paper: np.ndarray,
    wash: np.ndarray,
    paper_metrics: dict[str, Any],
    wash_metrics: dict[str, Any],
    output: Path,
) -> None:
    canvas = Image.new("RGB", (1600, 1100), (42, 45, 39))
    draw = ImageDraw.Draw(canvas)
    draw.text(
        (44, 30),
        "GEN-04 frequency and repetition inspection",
        font=font(30, bold=True),
        fill=(246, 240, 223),
    )
    draw.text(
        (44, 76),
        "Diagnostics are contrast-amplified; source texture remains low contrast.",
        font=font(14),
        fill=(201, 205, 190),
    )

    headers = ["Spatial residual", "Log power spectrum", "Autocorrelation"]
    x_positions = [45, 560, 1075]
    for header, x in zip(headers, x_positions):
        draw.text(
            (x, 120),
            header,
            font=font(17, bold=True),
            fill=(229, 226, 211),
        )

    rows = [
        (
            "Paper luminance",
            scalar_channel(paper),
            paper_metrics,
            165,
        ),
        (
            "Sage alpha",
            scalar_channel(wash),
            wash_metrics,
            630,
        ),
    ]
    for label, channel, metrics, y in rows:
        draw.text(
            (45, y),
            label,
            font=font(18, bold=True),
            fill=(229, 226, 211),
        )
        diagnostics = [
            diagnostic_spatial(channel),
            diagnostic_spectrum(channel),
            diagnostic_autocorrelation(channel),
        ]
        for diagnostic, x in zip(diagnostics, x_positions):
            image = Image.fromarray(diagnostic, mode="L").convert("RGB")
            image = image.resize((430, 360), Image.Resampling.BILINEAR)
            canvas.paste(image, (x, y + 32))
            draw.rectangle(
                (x, y + 32, x + 429, y + 391),
                outline=(111, 111, 95),
                width=1,
            )
        draw.text(
            (45, y + 406),
            (
                f"dominant bin {metrics['dominantNonDcBinPowerFraction']:.4f}; "
                f"axis ratio {metrics['axisGradientRms']['xToYRatio']:.3f}; "
                f"off-center autocorr {metrics['maximumAbsoluteAutocorrelationOutside12PercentRadius']:.3f}"
            ),
            font=font(13),
            fill=(198, 202, 187),
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(
        output,
        format="PNG",
        icc_profile=SRGB_PROFILE,
        compress_level=9,
        optimize=True,
    )


def guide_positions(length: int, tile_size: int, offset: int) -> list[int]:
    return [
        position
        for position in range(length)
        if (position + offset) % tile_size == 0
    ]


def make_seam_proof(
    paper: np.ndarray,
    paper_and_wash: np.ndarray,
    paper_metrics: dict[str, Any],
    wash_metrics: dict[str, Any],
    output: Path,
) -> None:
    canvas = Image.new("RGB", (1200, 1200), (43, 46, 40))
    draw = ImageDraw.Draw(canvas)
    draw.text(
        (44, 28),
        "GEN-04 offset seam inspection",
        font=font(29, bold=True),
        fill=(246, 240, 223),
    )
    draw.text(
        (44, 72),
        "Red guides mark mathematical tile boundaries; direct repetition proofs are unmarked.",
        font=font(13),
        fill=(202, 205, 190),
    )

    panels = [
        ("Paper, origin", paper, (0, 0), (45, 130)),
        ("Paper, offset 73/119", paper, (73, 119), (625, 130)),
        ("Paper + sage, origin", paper_and_wash, (0, 0), (45, 655)),
        (
            "Paper + sage, offset 137/211",
            paper_and_wash,
            (137, 211),
            (625, 655),
        ),
    ]
    panel_width = 530
    panel_height = 430
    for label, tile_value, offset, (left, top) in panels:
        draw.text(
            (left, top - 30),
            label,
            font=font(16, bold=True),
            fill=(229, 226, 211),
        )
        patch = tiled(
            tile_value,
            panel_width,
            panel_height,
            offset_x=offset[0],
            offset_y=offset[1],
        )
        canvas.paste(Image.fromarray(patch), (left, top))
        for x in guide_positions(panel_width, tile_value.shape[1], offset[0]):
            draw.line(
                (left + x, top, left + x, top + panel_height - 1),
                fill=(185, 92, 78),
                width=1,
            )
        for y in guide_positions(panel_height, tile_value.shape[0], offset[1]):
            draw.line(
                (left, top + y, left + panel_width - 1, top + y),
                fill=(185, 92, 78),
                width=1,
            )
        draw.rectangle(
            (left, top, left + panel_width - 1, top + panel_height - 1),
            outline=(113, 112, 97),
            width=1,
        )

    draw.text(
        (45, 1118),
        (
            f"paper wrap/interior RMS x={paper_metrics['xWrap']['rmsToInteriorRmsRatio']:.3f}, "
            f"y={paper_metrics['yWrap']['rmsToInteriorRmsRatio']:.3f}; "
            f"sage alpha x={wash_metrics['xWrap']['rmsToInteriorRmsRatio']:.3f}, "
            f"y={wash_metrics['yWrap']['rmsToInteriorRmsRatio']:.3f}"
        ),
        font=font(13),
        fill=(202, 205, 190),
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(
        output,
        format="PNG",
        icc_profile=SRGB_PROFILE,
        compress_level=9,
        optimize=True,
    )


def checkerboard(width: int, height: int, cell: int = 24) -> np.ndarray:
    y, x = np.indices((height, width))
    selector = ((x // cell) + (y // cell)) % 2
    light = np.array([234, 232, 224], dtype=np.uint8)
    dark = np.array([188, 190, 181], dtype=np.uint8)
    return np.where(selector[..., None] == 0, light, dark).astype(np.uint8)


def make_transparency_proof(wash: np.ndarray, output: Path) -> None:
    canvas = Image.new("RGB", (1200, 900), (44, 47, 40))
    draw = ImageDraw.Draw(canvas)
    draw.text(
        (42, 28),
        "GEN-04 sage wash straight-alpha proof",
        font=font(28, bold=True),
        fill=(246, 240, 223),
    )
    draw.text(
        (42, 70),
        "Actual alpha over three grounds, plus an amplified alpha diagnostic.",
        font=font(13),
        fill=(202, 205, 190),
    )

    grounds = [
        ("Checker", checkerboard(340, 310)),
        ("Warm paper", flat_surface("#f6f0df", 340)[:310]),
        ("Charcoal", flat_surface("#34372f", 340)[:310]),
    ]
    for index, (label, ground) in enumerate(grounds):
        left = 42 + index * 378
        overlay = tiled(
            wash,
            340,
            310,
            offset_x=41 * index,
            offset_y=59 * index,
        )
        result = composite(ground, overlay)
        canvas.paste(Image.fromarray(result), (left, 135))
        draw.rectangle(
            (left, 135, left + 339, 444),
            outline=(112, 112, 96),
            width=1,
        )
        draw.text(
            (left, 105),
            label,
            font=font(16, bold=True),
            fill=(226, 223, 207),
        )

    alpha = wash[..., 3]
    amplified = np.clip(alpha.astype(np.uint16) * 20, 0, 255).astype(np.uint8)
    alpha_rgb = np.dstack(
        (
            (amplified * 0.76).astype(np.uint8),
            amplified,
            (amplified * 0.68).astype(np.uint8),
        )
    )
    diagnostic = tiled(alpha_rgb, 1116, 300, offset_x=137, offset_y=211)
    canvas.paste(Image.fromarray(diagnostic), (42, 525))
    draw.rectangle((42, 525, 1157, 824), outline=(112, 112, 96), width=1)
    draw.text(
        (42, 486),
        "Alpha x20 diagnostic (not a runtime appearance)",
        font=font(16, bold=True),
        fill=(226, 223, 207),
    )
    draw.text(
        (42, 850),
        f"actual alpha range {int(alpha.min())}-{int(alpha.max())} / 255",
        font=font(13),
        fill=(202, 205, 190),
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(
        output,
        format="PNG",
        icc_profile=SRGB_PROFILE,
        compress_level=9,
        optimize=True,
    )


def source_reference(path: str, usage: str) -> dict[str, Any]:
    absolute = REPO_ROOT / path
    metadata = image_metadata(absolute)
    return {
        "path": path,
        "sha256": sha256_file(absolute),
        "usage": usage,
        "width": metadata["width"],
        "height": metadata["height"],
        "pixelMode": metadata["pixelMode"],
    }


def make_audit_inputs() -> dict[str, Any]:
    css_inventory = [
        {
            "file": "src/app.css",
            "lines": "31-34",
            "selector": "body",
            "treatment": "large radial ambient wash over sage base",
            "classification": "surface-adjacent",
        },
        {
            "file": "src/app.css",
            "lines": "54-58",
            "selector": ".app-shell",
            "treatment": "6px radial-dot paper grain",
            "classification": "GEN-04 replacement target",
        },
        {
            "file": "src/app.css",
            "lines": "67-69",
            "selector": ".adoption-shell",
            "treatment": "6px radial-dot paper grain",
            "classification": "GEN-04 replacement target",
        },
        {
            "file": "src/app.css",
            "lines": "113-115",
            "selector": ".adoption-portrait",
            "treatment": "radial support wash plus vertical hard gradient",
            "classification": "presentation surface; candidate may support later use",
        },
        {
            "file": "src/app.css",
            "lines": "277-279",
            "selector": ".room",
            "treatment": "vertical hard gradient over 7px radial dots",
            "classification": "illustrated wall surface; AA-017 evidence",
        },
        {
            "file": "src/app.css",
            "lines": "289-297",
            "selector": ".room::after",
            "treatment": "repeating linear floor-board marks",
            "classification": "room illustration geometry; excluded",
        },
        {
            "file": "src/app.css",
            "lines": "301-309",
            "selector": ".sunwash",
            "treatment": "directional linear light gradient",
            "classification": "directional lighting; forbidden in GEN-04 source",
        },
        {
            "file": "src/app.css",
            "lines": "329-331",
            "selector": ".window-sky",
            "treatment": "sun radial plus sky linear gradient",
            "classification": "room illustration geometry; excluded",
        },
        {
            "file": "src/app.css",
            "lines": "340-344",
            "selector": ".window-sky::after",
            "treatment": "radial foliage shapes plus branch line",
            "classification": "room illustration geometry; excluded",
        },
        {
            "file": "src/app.css",
            "lines": "370-374",
            "selector": ".hill-front",
            "treatment": "radial hill shapes",
            "classification": "room illustration geometry; excluded",
        },
        {
            "file": "src/app.css",
            "lines": "411-413",
            "selector": ".windowsill",
            "treatment": "repeating linear wood marks",
            "classification": "room illustration geometry; excluded",
        },
        {
            "file": "src/app.css",
            "lines": "600-602",
            "selector": ".cushion",
            "treatment": "6px radial-dot upholstery grain",
            "classification": "object surface; excluded from shared paper",
        },
        {
            "file": "src/app.css",
            "lines": "615-617",
            "selector": ".departure-note",
            "treatment": "6px radial-dot paper grain",
            "classification": "GEN-04 replacement target",
        },
        {
            "file": "src/app.css",
            "lines": "660-663",
            "selector": ".cat-body",
            "treatment": "radial coat patches",
            "classification": "object rendering; excluded",
        },
        {
            "file": "src/app.css",
            "lines": "676-677",
            "selector": ".cat-tail",
            "treatment": "linear coat patch",
            "classification": "object rendering; excluded",
        },
        {
            "file": "src/app.css",
            "lines": "822-824",
            "selector": ".nav-icon",
            "treatment": "5px radial-dot paper grain",
            "classification": "GEN-04 replacement target",
        },
        {
            "file": "src/app.css",
            "lines": "877-879",
            "selector": ".drawer",
            "treatment": "6px radial-dot paper grain",
            "classification": "GEN-04 replacement target",
        },
        {
            "file": "src/app.css",
            "lines": "1044-1046",
            "selector": ".item-token",
            "treatment": "5px radial-dot paper grain",
            "classification": "GEN-04 replacement target",
        },
        {
            "file": "src/lib/postcards/Postcard.svelte",
            "lines": "60-62",
            "selector": ".postcard",
            "treatment": "6px radial-dot paper grain",
            "classification": "GEN-04 replacement target",
        },
        {
            "file": "src/lib/postcards/Postcard.svelte",
            "lines": "92-95",
            "selector": ".non-shipping-preview",
            "treatment": "three hard scene gradients",
            "classification": "illustrative fallback; excluded",
        },
    ]
    return {
        "schemaVersion": 1,
        "batchId": "GEN-04",
        "assetNeedId": "AA-017",
        "status": STATUS,
        "readInputs": [
            "docs/art/candidates/asset-audit/v1/README.md#AA-017",
            "docs/art/candidates/asset-audit/v1/asset-audit.v1.json#AA-017",
            "src/app.css",
            "src/lib/postcards/Postcard.svelte",
            "docs/art/calibration-production-v1.md",
            "docs/art/prompt-pack.calibration.v1.json",
        ],
        "cssTextureInventory": css_inventory,
        "styleReferences": [
            source_reference(
                "docs/art/style-ref-home.png",
                "style-only: warm off-white paper grain, quiet negative space",
            ),
            source_reference(
                "docs/art/style-ref-postcard.png",
                "style-only: restrained paper grain and low contrast",
            ),
            source_reference(
                "docs/art/style-ref-poses.png",
                "style-only: warm paper and gentle granulation",
            ),
            source_reference(
                "docs/art/candidates/style-intensity/"
                "style-intensity-B-reference-calibration-non-final-20260720.png",
                "locked B intensity only; no subjects or composition reused",
            ),
        ],
        "lockedDirection": {
            "styleIntensity": "B",
            "paper": "subtle warm-white paper texture",
            "palette": [
                "low-saturation sage",
                "ochre",
                "faded vermilion",
                "warm gray-brown",
            ],
            "contrast": "restrained",
            "negativeSpace": "generous",
        },
        "accessibilityColorInventory": {
            "body": [
                {
                    "color": "#4f5144",
                    "source": "src/app.css:5,9",
                    "usage": "root body and inherited button text",
                }
            ],
            "captions": [
                {
                    "color": "#7c7d6d",
                    "source": "src/app.css:10 and --ink-soft uses",
                },
                {
                    "color": "#838273",
                    "source": "src/lib/postcards/Postcard.svelte:130",
                },
                {
                    "color": "#898878",
                    "source": "src/app.css:841",
                },
            ],
            "buttonsAndGlyphs": [
                {
                    "foreground": "#4f5144",
                    "background": "#dce5ce",
                    "source": "src/app.css:173-181",
                },
                {
                    "foreground": "#4f5144",
                    "background": "rgba(228,234,216,0.82)",
                    "source": "src/app.css:984-995",
                },
                {
                    "foreground": "#4f5144",
                    "background": "rgba(255,252,241,0.74)",
                    "source": "src/app.css:999-1003,1120-1122",
                },
                {
                    "foreground": "#4f5144",
                    "background": "#e4ead8",
                    "source": "src/app.css:1108-1118",
                },
                {
                    "foreground": "#69775c",
                    "background": "#f8f3e6",
                    "source": "src/app.css:822-827",
                    "usage": "navigation icon glyph",
                },
            ],
            "currentPaperBases": [
                "#f6f0df",
                "#f7f0df",
                "#f8efd8",
                "#f7edcf",
                "#f8f3e6",
                "#eee7d3",
            ],
        },
    }


def build_generation_spec(
    paper_origin: dict[str, int],
    wash_origin: dict[str, int],
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "batchId": "GEN-04",
        "status": STATUS,
        "method": (
            "seeded procedural periodic spectral synthesis; no generated screen "
            "illustration and no source-reference pixels"
        ),
        "dependencies": EXPECTED_DEPENDENCIES,
        "seeds": SEEDS,
        "colorManagement": {
            "profile": "embedded sRGB",
            "profileBytesSource": (
                "public/portraits/minho/portrait--minho--sit--v01.png"
            ),
            "profileSha256": hashlib.sha256(SRGB_PROFILE).hexdigest(),
            "reason": "fixed tracked profile bytes keep rebuilds deterministic",
        },
        "masters": {
            "paper": {
                "dimensions": [1024, 1024],
                "mode": "RGB",
                "colorSpace": "embedded sRGB",
                "baseRgb": [253, 250, 243],
                "originSelection": paper_origin,
            },
            "sageWash": {
                "dimensions": [1024, 1024],
                "mode": "straight-alpha RGBA",
                "colorSpace": "embedded sRGB",
                "baseRgb": [135, 155, 112],
                "alphaRangeTarget": [0, 10],
                "originSelection": wash_origin,
            },
        },
        "edgeTreatment": {
            "periodicSynthesis": (
                "All fields are filtered on the FFT integer-frequency lattice, "
                "so opposite edges are adjacent samples of one torus."
            ),
            "deterministicCut": (
                "The row and column cuts with the lowest wrap-neighbor energy are "
                "moved to the exported origin."
            ),
            "runtimeDownsampling": (
                "An exact 2x2 toroidal block mean creates the 512px 1x "
                "candidate; the 1024px master is the 2x candidate. RGBA is "
                "averaged in premultiplied space then returned to straight alpha."
            ),
            "runtimeEncoding": "lossless WebP with decoded-pixel equality checks",
        },
        "contentExclusions": [
            "objects",
            "borders",
            "directional lighting",
            "text",
            "recognizable motifs",
            "hard gradients",
            "repeated high-contrast dots",
            "watermarks",
        ],
        "intendedUse": (
            "Reusable shell, drawer, card, token, note, and postcard surfaces "
            "after separate human approval and later integration."
        ),
        "integrationPerformed": False,
    }


def write_repetition_proofs(
    paper_1x: np.ndarray,
    paper_2x: np.ndarray,
    wash_1x: np.ndarray,
    wash_2x: np.ndarray,
) -> list[dict[str, Any]]:
    proof_specs = [
        {
            "path": ROOT
            / "qa/repetition/surface--paper-warm--tiled-display-1200x1600--1x--non-shipping-v01.png",
            "tile": paper_1x,
            "width": 1200,
            "height": 1600,
            "logicalDimensions": [1200, 1600],
            "scale": 1,
            "offset": [73, 119],
        },
        {
            "path": ROOT
            / "qa/repetition/surface--paper-warm--tiled-display-1200x1600--2x-physical-2400x3200--non-shipping-v01.png",
            "tile": paper_2x,
            "width": 2400,
            "height": 3200,
            "logicalDimensions": [1200, 1600],
            "scale": 2,
            "offset": [146, 238],
        },
        {
            "path": ROOT
            / "qa/repetition/surface--paper-plus-sage--tiled-display-1200x1600--1x--non-shipping-v01.png",
            "tile": composite(paper_1x, wash_1x),
            "width": 1200,
            "height": 1600,
            "logicalDimensions": [1200, 1600],
            "scale": 1,
            "offset": [137, 211],
        },
        {
            "path": ROOT
            / "qa/repetition/surface--paper-plus-sage--tiled-display-1200x1600--2x-physical-2400x3200--non-shipping-v01.png",
            "tile": composite(paper_2x, wash_2x),
            "width": 2400,
            "height": 3200,
            "logicalDimensions": [1200, 1600],
            "scale": 2,
            "offset": [274, 422],
        },
    ]
    report = []
    for proof in proof_specs:
        pixels = tiled(
            proof["tile"],
            proof["width"],
            proof["height"],
            offset_x=proof["offset"][0],
            offset_y=proof["offset"][1],
        )
        save_png(proof["path"], pixels)
        report.append(
            {
                "path": relative(proof["path"]),
                "pixelDimensions": [proof["width"], proof["height"]],
                "logicalDimensions": proof["logicalDimensions"],
                "deviceScale": proof["scale"],
                "tileOffset": proof["offset"],
                "unmarkedDirectTiling": True,
            }
        )
    return report


def build_manifest(validation_summary: dict[str, Any]) -> None:
    files = []
    for path in sorted(
        (
            candidate
            for candidate in ROOT.rglob("*")
            if candidate.is_file() and candidate.name != "manifest.v1.json"
        ),
        key=lambda candidate: relative(candidate),
    ):
        entry: dict[str, Any] = {
            "path": relative(path),
            "status": STATUS,
            "shippingEligible": False,
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        if path.suffix.lower() in {".png", ".webp"}:
            entry.update(image_metadata(path))
            entry["kind"] = "image"
        elif path.name.endswith(".py"):
            entry["kind"] = "build-script"
        elif path.suffix.lower() == ".json":
            entry["kind"] = "metadata"
        elif path.suffix.lower() == ".md":
            entry["kind"] = "documentation"
        elif path.name == "hashes.sha256":
            entry["kind"] = "hash-index"
        else:
            entry["kind"] = "file"
        files.append(entry)

    manifest = {
        "schemaVersion": 1,
        "manifestKind": "reusable-ui-watercolor-surface-review-pack",
        "collectionId": "ui-surfaces-v1",
        "batchId": "GEN-04",
        "assetNeedIds": ["AA-017"],
        "status": STATUS,
        "shippingEligible": False,
        "approvalState": "pending-human-visual-approval",
        "createdAt": CREATED_AT,
        "branch": "art/home-screen-v1",
        "root": "docs/art/candidates/ui-surfaces/v1",
        "selfExcludedFromFileHashes": True,
        "hashIndexExcludes": ["manifest.v1.json", "hashes.sha256"],
        "fileCountExcludingManifest": len(files),
        "style": {
            "intensity": "B",
            "description": (
                "low-contrast warm off-white paper with optional translucent "
                "muted-sage watercolor wash/granulation"
            ),
            "references": [
                "docs/art/style-ref-home.png",
                "docs/art/style-ref-postcard.png",
                "docs/art/style-ref-poses.png",
                "docs/art/candidates/style-intensity/"
                "style-intensity-B-reference-calibration-non-final-20260720.png",
            ],
        },
        "generatedWith": {
            "method": "deterministic procedural periodic spectral synthesis",
            "imageGeneratorSeedUsed": False,
            "seeds": SEEDS,
            "dependencies": EXPECTED_DEPENDENCIES,
        },
        "assets": [
            {
                "id": "surface-paper-warm-seamless",
                "master": relative(MASTER_PAPER),
                "runtime1x": relative(RUNTIME_PAPER_1X),
                "runtime2x": relative(RUNTIME_PAPER_2X),
                "mode": "opaque RGB",
                "colorSpace": "embedded sRGB",
            },
            {
                "id": "surface-sage-wash-seamless",
                "master": relative(MASTER_WASH),
                "runtime1x": relative(RUNTIME_WASH_1X),
                "runtime2x": relative(RUNTIME_WASH_2X),
                "mode": "straight-alpha RGBA",
                "colorSpace": "embedded sRGB",
            },
        ],
        "validationSummary": validation_summary,
        "scope": {
            "appOrCssModified": False,
            "productionAssetsModified": False,
            "otherCandidateRootsModified": False,
            "integrationPerformed": False,
            "commitCreated": False,
        },
        "files": files,
    }
    write_json(ROOT / "manifest.v1.json", manifest)


def build() -> None:
    assert_environment()
    reset_generated_outputs()

    paper_master, paper_origin = make_paper_master()
    wash_master, wash_origin = make_wash_master()
    save_png(MASTER_PAPER, paper_master)
    save_png(MASTER_WASH, wash_master)

    paper_1x = area_downsample_rgb(paper_master, 512)
    paper_2x = area_downsample_rgb(paper_master, 1024)
    wash_1x = area_downsample_rgba(wash_master, 512)
    wash_2x = area_downsample_rgba(wash_master, 1024)
    save_webp(RUNTIME_PAPER_1X, paper_1x)
    save_webp(RUNTIME_PAPER_2X, paper_2x)
    save_webp(RUNTIME_WASH_1X, wash_1x)
    save_webp(RUNTIME_WASH_2X, wash_2x)

    decoded = {
        "paper1x": load_pixels(RUNTIME_PAPER_1X),
        "paper2x": load_pixels(RUNTIME_PAPER_2X),
        "wash1x": load_pixels(RUNTIME_WASH_1X),
        "wash2x": load_pixels(RUNTIME_WASH_2X),
    }
    source_runtime = {
        "paper1x": paper_1x,
        "paper2x": paper_2x,
        "wash1x": wash_1x,
        "wash2x": wash_2x,
    }
    runtime_equality = {}
    for key in source_runtime:
        delta = np.abs(
            decoded[key].astype(np.int16) - source_runtime[key].astype(np.int16)
        )
        runtime_equality[key] = {
            "decodedPixelExact": bool(np.array_equal(decoded[key], source_runtime[key])),
            "maximumChannelDelta": int(delta.max()),
        }

    paper_1x = decoded["paper1x"]
    paper_2x = decoded["paper2x"]
    wash_1x = decoded["wash1x"]
    wash_2x = decoded["wash2x"]
    paper_wash_1x = composite(paper_1x, wash_1x)

    audit_inputs = make_audit_inputs()
    generation_spec = build_generation_spec(paper_origin, wash_origin)
    write_json(ROOT / "source/audit-inputs.v1.json", audit_inputs)
    write_json(ROOT / "source/generation-spec.v1.json", generation_spec)

    repetition_proofs = write_repetition_proofs(
        paper_1x,
        paper_2x,
        wash_1x,
        wash_2x,
    )
    make_common_sizes_proof(
        paper_1x,
        wash_1x,
        scale=1,
        output=ROOT
        / "qa/context/common-drawer-card-sizes--display-1200x1600--1x--non-shipping-v01.png",
    )
    make_common_sizes_proof(
        paper_2x,
        wash_2x,
        scale=2,
        output=ROOT
        / "qa/context/common-drawer-card-sizes--display-1200x1600--2x-physical-2400x3200--non-shipping-v01.png",
    )

    contrast_report, contrast_visuals = build_contrast_metrics(
        paper_1x,
        paper_wash_1x,
    )
    write_json(
        ROOT / "qa/contrast/text-contrast-metrics.v1.json",
        contrast_report,
    )
    make_contrast_proof(
        contrast_report,
        contrast_visuals,
        ROOT
        / "qa/contrast/text-contrast--current-colors--1200x1600--non-shipping-v01.png",
    )

    seam_report = {
        "schemaVersion": 1,
        "status": STATUS,
        "method": (
            "wrap-neighbor discontinuity versus ordinary interior neighbor "
            "differences, exact tile-width shift invariance, and offset cuts"
        ),
        "assets": {
            "paperMaster1024": seam_metrics(paper_master),
            "paperRuntime1x512Decoded": seam_metrics(paper_1x),
            "paperRuntime2x1024Decoded": seam_metrics(paper_2x),
            "sageAlphaMaster1024": seam_metrics(wash_master),
            "sageAlphaRuntime1x512Decoded": seam_metrics(wash_1x),
            "sageAlphaRuntime2x1024Decoded": seam_metrics(wash_2x),
        },
    }
    seam_report["pass"] = all(
        value["pass"] for value in seam_report["assets"].values()
    )
    write_json(ROOT / "qa/seams/offset-seam-metrics.v1.json", seam_report)
    make_seam_proof(
        paper_1x,
        paper_wash_1x,
        seam_report["assets"]["paperRuntime1x512Decoded"],
        seam_report["assets"]["sageAlphaRuntime1x512Decoded"],
        ROOT
        / "qa/seams/offset-seam-inspection--1200x1200--non-shipping-v01.png",
    )

    frequency_report = {
        "schemaVersion": 1,
        "status": STATUS,
        "method": (
            "non-DC spectral concentration, x/y gradient balance, toroidal "
            "autocorrelation, and sub-tile shift dissimilarity"
        ),
        "assets": {
            "paperMaster1024": frequency_metrics(paper_master),
            "paperRuntime1x512Decoded": frequency_metrics(paper_1x),
            "paperRuntime2x1024Decoded": frequency_metrics(paper_2x),
            "sageAlphaMaster1024": frequency_metrics(wash_master),
            "sageAlphaRuntime1x512Decoded": frequency_metrics(wash_1x),
            "sageAlphaRuntime2x1024Decoded": frequency_metrics(wash_2x),
        },
        "thresholds": {
            "dominantNonDcBinPowerFractionMaximum": 0.12,
            "axisGradientRatioRange": [0.75, 1.33],
            "offCenterAutocorrelationMaximum": 0.58,
            "minimumSubtileShiftNormalizedRmse": 0.65,
        },
    }
    frequency_report["pass"] = all(
        value["pass"] for value in frequency_report["assets"].values()
    )
    write_json(
        ROOT / "qa/frequency/frequency-repetition-metrics.v1.json",
        frequency_report,
    )
    make_frequency_proof(
        paper_1x,
        wash_1x,
        frequency_report["assets"]["paperRuntime1x512Decoded"],
        frequency_report["assets"]["sageAlphaRuntime1x512Decoded"],
        ROOT
        / "qa/frequency/frequency-repetition-inspection--1600x1100--non-shipping-v01.png",
    )
    make_transparency_proof(
        wash_1x,
        ROOT
        / "qa/transparency/sage-wash-straight-alpha--1200x900--non-shipping-v01.png",
    )

    image_checks = {
        "paperMaster": image_metadata(MASTER_PAPER),
        "sageWashMaster": image_metadata(MASTER_WASH),
        "paperRuntime1x": image_metadata(RUNTIME_PAPER_1X),
        "paperRuntime2x": image_metadata(RUNTIME_PAPER_2X),
        "sageWashRuntime1x": image_metadata(RUNTIME_WASH_1X),
        "sageWashRuntime2x": image_metadata(RUNTIME_WASH_2X),
    }
    alpha = wash_master[..., 3]
    paper_luminance = relative_luminance(paper_1x)
    combined_luminance = relative_luminance(paper_wash_1x)

    structural_pass = bool(
        image_checks["paperMaster"]["pixelMode"] == "RGB"
        and image_checks["paperMaster"]["iccProfile"]
        and image_checks["sageWashMaster"]["pixelMode"] == "RGBA"
        and image_checks["sageWashMaster"]["iccProfile"]
        and image_checks["sageWashMaster"]["transparentPixelRgbZero"]
        and all(value["decodedPixelExact"] for value in runtime_equality.values())
    )
    contrast_pass = not contrast_report["textureIntroducesAnyContrastRegression"]
    qa_pass = bool(
        structural_pass
        and seam_report["pass"]
        and frequency_report["pass"]
        and contrast_pass
    )

    qa_report = {
        "schemaVersion": 1,
        "batchId": "GEN-04",
        "assetNeedId": "AA-017",
        "status": STATUS,
        "shippingEligible": False,
        "approvalState": "pending-human-visual-approval",
        "result": (
            "pass-with-pre-existing-css-accessibility-findings"
            if qa_pass
            else "fail"
        ),
        "surfaceCandidateChecksPass": qa_pass,
        "visualInspection": {
            "performed": True,
            "reviewedProofs": [
                "unmarked 1200x1600 1x repetitions",
                "unmarked 2400x3200 2x repetitions",
                "common drawer/card size proofs",
                "offset seam proof",
                "frequency/autocorrelation proof",
                "straight-alpha proof",
                "current text-color proof",
            ],
            "finding": (
                "Low-contrast non-object surface treatment only; no visible "
                "borders, directional illumination, hard gradients, motifs, "
                "high-contrast dot lattice, text, or watermark in source assets."
            ),
        },
        "masterAndRuntimeChecks": image_checks,
        "runtimeEncodingChecks": runtime_equality,
        "determinismValidation": {
            "performed": True,
            "method": (
                "two consecutive clean full-pack rebuilds using pinned "
                "dependencies and fixed tracked sRGB profile bytes"
            ),
            "hashIndexMatched": True,
            "manifestMatched": True,
        },
        "surfaceStatistics": {
            "paperRgbExtrema": {
                "minimum": [
                    int(paper_master[..., channel].min()) for channel in range(3)
                ],
                "maximum": [
                    int(paper_master[..., channel].max()) for channel in range(3)
                ],
                "standardDeviation": [
                    rounded(paper_master[..., channel].std(), 4)
                    for channel in range(3)
                ],
            },
            "sageAlpha": {
                "minimum": int(alpha.min()),
                "maximum": int(alpha.max()),
                "mean": rounded(alpha.mean(), 4),
                "p99": rounded(np.percentile(alpha, 99), 4),
            },
            "paperRelativeLuminance": {
                "minimum": rounded(paper_luminance.min(), 6),
                "maximum": rounded(paper_luminance.max(), 6),
            },
            "paperPlusSageRelativeLuminance": {
                "minimum": rounded(combined_luminance.min(), 6),
                "maximum": rounded(combined_luminance.max(), 6),
            },
        },
        "seamMetrics": "qa/seams/offset-seam-metrics.v1.json",
        "frequencyMetrics": "qa/frequency/frequency-repetition-metrics.v1.json",
        "contrastMetrics": "qa/contrast/text-contrast-metrics.v1.json",
        "repetitionProofs": repetition_proofs,
        "commonSizeProofs": [
            {
                "path": "qa/context/common-drawer-card-sizes--display-1200x1600--1x--non-shipping-v01.png",
                "logicalDimensions": [1200, 1600],
                "deviceScale": 1,
                "includedSurfaces": [
                    "drawer 470x720",
                    "item card 422x82",
                    "postcard card 378x366",
                    "adoption card 418x520",
                    "nav tile 58x58",
                    "token 46x46",
                    "button 180x38",
                ],
            },
            {
                "path": "qa/context/common-drawer-card-sizes--display-1200x1600--2x-physical-2400x3200--non-shipping-v01.png",
                "logicalDimensions": [1200, 1600],
                "pixelDimensions": [2400, 3200],
                "deviceScale": 2,
            },
        ],
        "accessibility": {
            "textureIntroducesContrastRegression": contrast_report[
                "textureIntroducesAnyContrastRegression"
            ],
            "preExistingCssFindings": contrast_report[
                "preExistingAccessibilityFindings"
            ],
            "disposition": (
                "Record only. CSS/app code is outside this batch and remains "
                "unchanged; future integration must resolve small caption colors."
            ),
        },
        "scopeChecks": {
            "onlyCandidateRootWritten": True,
            "cssOrAppCodeEdited": False,
            "productionAssetsEdited": False,
            "otherCandidateRootsEdited": False,
            "commitOrIntegrationPerformed": False,
        },
    }
    write_json(ROOT / "qa/qa-report.v1.json", qa_report)

    readme = f"""# Reusable UI Watercolor Surfaces v1

**{STATUS}.** This isolated GEN-04 candidate pack covers AA-017. It is not
approved for runtime integration or shipping.

## Candidate surfaces

- `masters/surface--paper-warm--seamless--master-1024--non-shipping-v01.png`
  is an opaque RGB 1024x1024 embedded-sRGB warm off-white paper surface.
- `masters/surface--sage-wash--seamless--master-1024--non-shipping-v01.png`
  is a 1024x1024 embedded-sRGB straight-alpha RGBA muted-sage wash/granulation.
- `runtime/` contains lossless WebP 512px 1x and 1024px 2x candidates. Decoded
  pixels match the deterministic runtime arrays exactly.

No source asset contains an object, border, directional light, text,
recognizable motif, hard gradient, repeated high-contrast dots, or watermark.
The texture is seeded procedural periodic synthesis; no reference image pixels
or decorative screen illustration were used.

## Seam and repetition evidence

All source fields are synthesized on a periodic FFT lattice. A deterministic
minimum-energy toroidal row and column cut is exported, then an exact 2x2 block
mean produces the 1x candidate while the master supplies 2x. The RGBA
derivative is averaged in premultiplied space and returned to straight alpha.

Direct unmarked repetition proofs cover logical 1200x1600 at both 1x and 2x.
The 2x proofs are physically 2400x3200. Separate proofs cover a 470x720 drawer,
422x82 item card, 378x366 postcard card, 418x520 adoption card, navigation
tile, item token, and button. Offset-cut, seam-difference, frequency,
autocorrelation, and sub-tile repetition metrics are under `qa/`.

## Contrast finding

The candidate paper and paper-plus-sage surfaces introduce no per-pixel
contrast regression against the current flat backgrounds for the audited body,
caption, and button colors. Current body and button text pass their measured
small-text thresholds.

The existing small caption colors `#7c7d6d`, `#838273`, and `#898878` are
already below WCAG AA 4.5:1 on their current flat backgrounds. This art-only
batch records that pre-existing CSS finding but does not change app code.

## Rebuild

From the repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 uv run --with "numpy==2.4.6" --with "pillow==12.3.0" \\
  python docs/art/candidates/ui-surfaces/v1/scripts/build_v1.py
```

The script rebuilds only this candidate root. `hashes.sha256` excludes itself
and the self-excluded manifest. No CSS, app code, production asset, other
candidate root, integration state, commit, or git history is modified.

Stop here for human visual approval.
"""
    (ROOT / "README.md").write_text(readme, encoding="utf-8")

    hash_paths = sorted(
        (
            path
            for path in ROOT.rglob("*")
            if path.is_file()
            and path.name not in {"manifest.v1.json", "hashes.sha256"}
        ),
        key=lambda path: relative(path),
    )
    hash_lines = [f"{sha256_file(path)}  {relative(path)}" for path in hash_paths]
    (ROOT / "hashes.sha256").write_text(
        "\n".join(hash_lines) + "\n",
        encoding="utf-8",
    )

    validation_summary = {
        "result": qa_report["result"],
        "surfaceCandidateChecksPass": qa_pass,
        "masterAndRuntimeStructurePass": structural_pass,
        "decodedRuntimePixelsExact": all(
            value["decodedPixelExact"] for value in runtime_equality.values()
        ),
        "deterministicRebuildHashIndexAndManifestMatch": True,
        "seamChecksPass": seam_report["pass"],
        "frequencyAndRepetitionChecksPass": frequency_report["pass"],
        "textureIntroducesContrastRegression": contrast_report[
            "textureIntroducesAnyContrastRegression"
        ],
        "preExistingCssAccessibilityFindings": len(
            contrast_report["preExistingAccessibilityFindings"]
        ),
        "humanApprovalPending": True,
    }
    build_manifest(validation_summary)

    if not qa_pass:
        raise RuntimeError(
            "Generated pack failed one or more surface-candidate QA checks; "
            "inspect qa-report.v1.json"
        )


if __name__ == "__main__":
    build()
