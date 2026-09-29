# Reusable UI Watercolor Surfaces v1

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** This isolated GEN-04 candidate pack covers AA-017. It is not
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
PYTHONDONTWRITEBYTECODE=1 uv run --with "numpy==2.4.6" --with "pillow==12.3.0" \
  python docs/art/candidates/ui-surfaces/v1/scripts/build_v1.py
```

The script rebuilds only this candidate root. `hashes.sha256` excludes itself
and the self-excluded manifest. No CSS, app code, production asset, other
candidate root, integration state, commit, or git history is modified.

Stop here for human visual approval.
