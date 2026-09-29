# GEN-03 bootstrap/system loading vignette v1

**Status:** NON-SHIPPING / VISUAL-REVIEW-ONLY  
**Scope:** AA-006 only. No app code, Minho file, production asset, or other candidate directory is modified.

This pack offers two small, text-free watercolor loading compositions for “putting the Home back in place.” Both are calm neutral keepsakes rather than success, warning, or failure art.

## Selection candidates

- **A — closed letter tray:** a tied closed envelope with a roof-like flap, fully supported by one shallow wooden tray. The only Minho cue is two muted tabby bands on the cord end.
- **B — closed house keepsake:** a closed house-shaped box with its sage roof lid aligned, fully supported by one folded cloth. The only Minho cue is two muted tabby bands inset into the latch.

Both remain viable and intentionally distinct: A is letter-led and horizontal; B is Home-led and roof-shaped. Choose one, reject both, or request a narrow revision. Do not integrate yet.

## Deliverables

- `masters/`: two 512×512 straight-alpha RGBA masters.
- `runtime/`: exact 256×256 and 128×128 RGBA derivatives for each master.
- `reviews/loading/`: 320×568, 390×844, and 430×932 hydration reviews for each candidate using the current live status copy.
- `reviews/reuse/`: 390×844 import/restore progress reuse proof for each candidate.
- `reviews/contact-sheet--gen03-loading-vignettes--1600x2000--non-shipping-v01.png`: alpha, 96/128/144 px, viewport, and reuse comparison.
- `placement-metadata.v1.json`: fixed art slot, live-copy safe zone, anchors, bounds, margins, and zero-layout-jump contract.
- `qa/qa-report.v1.json`: dimensions, mode, alpha, transparent RGB, sRGB profile, safe-margin, visual, and layout checks.
- `manifest.v1.json` and `hashes.sha256`: provenance and integrity.
- `sources/`: the two actual Cursor GenerateImage outputs retained as audit-only opaque generated-source records.

## Layout contract

Bootstrap/hydration reserves a fixed 160×160 CSS px art slot and renders the 512 source in a fixed 128×128 canvas. The live status copy has a separate 48 px-high safe zone. Hydration, slower storage, and restore-progress copy changes reuse the same geometry, so the recorded layout jump is 0 px. Import/restore reuse uses a fixed 112 px slot with a 96 px image canvas.

The import/restore image is a reuse proof only. The current app resolves import directly to live success/error copy; adding an in-progress state is a later integration decision.

## Generation and QA note

Actual image generation used locked style-intensity B references plus approved Minho sit only as a restrained color/pattern reference; no new Minho art was generated. The generator returned opaque checker previews. The build script converts only the connected keepsake silhouettes to straight RGBA, removes exterior-connected neutral checker pixels, applies a two-source-pixel edge inset, embeds sRGB ICC profiles, zeros RGB in fully transparent pixels, and creates deterministic derivatives/reviews.

Run the build with Python, Pillow, and NumPy:

`python3 scripts/build_v1.py`

Stop here for human selection. No commit or runtime integration is included.
