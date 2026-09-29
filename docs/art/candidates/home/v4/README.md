# Home-State Physics Correction v4

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** This directory is isolated review work. It is not approved for production, runtime integration, or shipping.

v4 corrects only the two user-confirmed physical errors in v3 while reusing the approved v3 room, navigation, and unchanged production Minho in the mobile reviews.

## Corrected RGBA source art

- `state-art/away-note-with-wood-memo-stand--blank--master-512x640--non-shipping-v04.png` — 512×640 blank note visibly inserted into a simple wooden memo stand, with tabletop contact shadow.
- `state-art/dried-fish-sill-tray--master-512--non-shipping-v04.png` — 512×512 compact dried-fish sill tray.
- `state-art/dried-fish-sill-tray--runtime-128--non-shipping-v04.png` — 128×128 RGBA derivative.

Both are polished generated watercolor art with straight alpha, embedded sRGB, zero RGB in fully transparent pixels, and no source text. Representative away copy exists only in static reviews and receives the same card-plane transform.

## Mobile reviews

- `reviews/mobile-review--390x844--away-grounded--non-shipping-v04.png`
- `reviews/mobile-review--390x844--collectible-sill-safe--non-shipping-v04.png`
- `reviews/mobile-review--430x932--away-grounded--non-shipping-v04.png`
- `reviews/mobile-review--430x932--collectible-sill-safe--non-shipping-v04.png`

The v3 room pixels, v3 navigation pixels, and unchanged production Minho remain intact outside the corrected state-art regions.

## Physical-plausibility evidence

- `reviews/before-after--home-state-physical-plausibility--1200x1600--non-shipping-v04.png` — 1200×1600 before/after sheet.
- `placement-perspective-metadata.v4.json` — support polygons, note plane, transforms, and per-viewport safety margins.
- `qa-report.v4.json` — image, alpha, reuse, grounding, and pixel-isolation checks.

Calculated minimum dried-fish footprint safety margin:
- 390x844: **6.2px**
- 430x932: **7.1px**

Every declared footprint corner is inside the real sill top-plane polygon. The front face is excluded from the support polygon; no fish, tray edge, or contact footprint penetrates the frame or overhangs the sill.

No app code, v1/v2/v3 file, production asset, Minho file, landmark, postcard, or git history was modified. Stop here for visual approval.
