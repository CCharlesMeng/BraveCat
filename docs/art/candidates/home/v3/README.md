# Home Supporting Art v3

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** Every file in this directory is a candidate or review artifact. Nothing here is approved for runtime use, production export, or app integration.

This pack extends the approved v2 visual direction with layer-ready room assets, supporting watercolor art, and static mobile acceptance composites. Visual approval is required before any later production work.

## Layer-ready room

All room layers use a fixed 1200×1600 canvas, straight-alpha RGBA where transparent, embedded sRGB, zero RGB in fully transparent pixels, and placement at `(0, 0)`.

- `layers/home-interior-foreground--window-transparent--non-shipping-v03.png`
- `layers/home-exterior--morning--full-canvas--non-shipping-v03.png`
- `layers/home-exterior--noon--full-canvas--non-shipping-v03.png`
- `layers/home-exterior--dusk--full-canvas--non-shipping-v03.png`
- `layers/home-exterior--late-night--full-canvas--non-shipping-v03.png`
- `layers/home-lighting-overlay--morning--non-shipping-v03.png`
- `layers/home-lighting-overlay--dusk--non-shipping-v03.png`
- `layers/home-lighting-overlay--late-night--non-shipping-v03.png`
- `layers/home-layered-reconstruction--morning--non-shipping-v03.png`
- `layers/home-layered-reconstruction--noon--non-shipping-v03.png`
- `layers/home-layered-reconstruction--dusk--non-shipping-v03.png`
- `layers/home-layered-reconstruction--late-night--non-shipping-v03.png`

No noon lighting overlay exists because the neutral interior is the noon master. Each flattened layered reconstruction is pixel-identical to its approved v2 review source.

## Navigation icon family

Each text-free icon has a 512×512 RGBA master and a 128×128 RGBA derivative intended for the current 58×58 CSS slot and 50×50 compact slot.

- `icons/nav-icon--pack--master-512--non-shipping-v03.png`
- `icons/nav-icon--pack--runtime-128--non-shipping-v03.png`
- `icons/nav-icon--shop--master-512--non-shipping-v03.png`
- `icons/nav-icon--shop--runtime-128--non-shipping-v03.png`
- `icons/nav-icon--album--master-512--non-shipping-v03.png`
- `icons/nav-icon--album--runtime-128--non-shipping-v03.png`

## State-related art

- `state-art/dried-fish-reward--master-512--non-shipping-v03.png`
- `state-art/dried-fish-reward--runtime-128--non-shipping-v03.png`
- `state-art/away-note--blank--master-512x640--non-shipping-v03.png`

A contact-shadow asset was not created. Static placement at both review widths showed that the unchanged Minho sleep pose rests directly on the woven rug without a visible gap or floating silhouette.

## Review evidence

- `reviews/contact-sheet--nav-and-state-art--non-shipping-v03.png`
- `reviews/comparison--four-time-states-locked--non-shipping-v03.png`
- `reviews/mobile-review--390x844--at-home--non-shipping-v03.png`
- `reviews/mobile-review--390x844--away--non-shipping-v03.png`
- `reviews/mobile-review--390x844--collectible-ready--non-shipping-v03.png`
- `reviews/mobile-review--430x932--at-home--non-shipping-v03.png`
- `reviews/mobile-review--430x932--away--non-shipping-v03.png`
- `reviews/mobile-review--430x932--collectible-ready--non-shipping-v03.png`

The source art remains text-free. Labels, representative away-note copy, collection copy, navigation copy, and NON-SHIPPING marks appear only in review images.

## Metadata

- `composition-layer-metadata.v3.json` — coordinates, stable anchors, window mask, stack order, blend assumptions, export sizes, Minho review placement, and contact-shadow decision.
- `manifest.v3.json` — machine-readable file inventory, dimensions, modes, hashes, and shipping status.
- `README.md` — this NON-SHIPPING manifest.

No existing Minho file, app source, landmark, postcard composition, or production asset was modified. Stop here for visual approval.
