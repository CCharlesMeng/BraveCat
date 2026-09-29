# Utility Glyph Family v1

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** This is the isolated GEN-05 / AA-018 candidate pack. Nothing here is approved for runtime use. No application code, production asset, or other candidate directory was edited, and no commit or integration was performed.

## Family

The canonical sources are five hand-authored `0 0 24 24` SVGs in this order:

1. close
2. export
3. import
4. lock
5. retry

Every source uses `currentColor`, `fill="none"`, a shared 1.75-unit stroke, round caps, and round joins. The family deliberately uses compact warm gray-brown line character rather than watercolor raster mass. Critical marks retain roughly 4–5 viewBox units of internal whitespace, so a 20–24 px glyph can sit inside a generous touch target without becoming visually crowded.

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
- Neutral preview ink on warm paper is **5.96:1**; light ink on dark paper is **7.78:1**; error tint on warm paper is **4.45:1**. These exceed the 3:1 graphical-object proof target.
- Disabled contrast is documented but not treated as a pass/fail threshold for an inactive control.
- The current semi-transparent focus outline composites to **1.73:1** on warm paper, below a 3:1 integration target. Focus remains app-owned CSS, so this candidate records the advisory without changing source or app code.
- Export/import intentionally share one tray and differ only by arrow direction. Their 24 px distinction is the primary approval check.

Semantic recognition remains a human visual gate. Stop here for approval; do not promote, integrate, or commit this family yet.
