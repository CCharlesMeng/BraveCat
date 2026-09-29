# Home Background v2 Refinement Brief

**NON-SHIPPING / REFINEMENT BRIEF.** This document records a direction for the next visual review only. It is not final production approval, shipping authorization, permission to integrate assets, or approval to proceed to Phase 2.

**Date:** 2026-07-20

## Exact user-selection summary

- Use candidate B's painting/rendering style.
- Use candidate A's broad window view/composition outside the window.
- New requirement: the exterior view changes with time of day, with four distinct states: morning, noon, dusk/evening, late night.
- Add a modest amount of lived-in cat furniture/props: cat tree, teaser wand, water bowl, food bowl, while preserving simplicity and the existing reserved overlay areas.

## Chosen hybrid direction

- Apply candidate B's painting/rendering language consistently across the room, props, glass, and exterior.
- Retain candidate A's broad window view and outside-the-window composition; do not inherit candidate B's tighter, oblique exterior framing.
- Keep the established low-saturation sage, warm wood, and off-white watercolor palette. The result should feel quiet, tactile, and lived-in rather than decorated or busy.
- Build one coherent v2 composition at the v1 review format of 1200×1600. Do not bake in a cat, UI, copy, controls, labels, signatures, or watermarks.

## Asset strategy

1. Create one stable interior/base composition containing the room architecture, window frame and sill, floor, cat furniture, props, camera, and perspective.
2. Create four interchangeable window-exterior plates—morning, noon, dusk/evening, and late night—locked to the same window aperture, crop, horizon, perspective, and exterior landmark/layout.
3. If needed, add restrained state-specific lighting and/or glass-reflection overlays above the stable base. These overlays may change color and opacity only; they must not move furniture, alter geometry, or shift UI anchors.
4. Composite every state from the same base and transforms. Only exterior atmosphere and restrained light response should change, so the interior, props, and UI reserves never jump between states.

## Time-state art direction

- **Morning:** Pale warm light, cool sage shadows, light atmospheric softness, and a gently waking exterior. Keep contrast low and avoid a golden-hour look.
- **Noon:** Neutral-warm daylight with the clearest exterior read and slightly shorter, softer shadows. Preserve watercolor diffusion; avoid hard white glare or high saturation.
- **Dusk/evening:** Muted dusty peach, ochre, and gray-lavender outside, with a restrained warm response on wood and off-white surfaces. Keep the scene calm, not theatrical.
- **Late night:** Deep desaturated blue-gray and ink-sage values, a readable but quiet exterior silhouette, and only sparse subdued warm window points if useful. No neon, electric blue, saturated purple, or nightlife glow.

Across all four states, preserve the same exterior forms and layout. Make the time change legible through sky value, color temperature, atmosphere, and light response—not through moving or replacing scenery.

## Furniture, props, and reserved areas

- Use a slim, modest cat tree in the left-side midground, floor-anchored and lateral to the lower cat activity/rest zone. Keep its platforms and silhouette clear of the top-left windowsill collection overlay and the broad exterior read.
- Rest the teaser wand against the lower cat-tree base, contained within that prop cluster; do not let its diagonal cross any overlay reserve.
- Place the water and food bowls as two small, distinct forms along the left or mid-left baseboard, above the bottom navigation safe reserve and outside the lower cat activity/rest zone.
- Keep the lower cat activity/rest zone open and visually calm. Keep the right away-note zone low-detail and free of props or high-contrast edges. Keep the bottom navigation safe reserve free of furniture silhouettes and important art details.
- Hold every furniture and prop position identical across all time variants. Favor breathing room and a few believable signs of use over additional clutter.

## Stable composition metadata

`catAnchor`, `windowsillBounds`, `awayNoteBounds`, and `safeBounds` must remain identical across all four time variants. Their v2 values are provisional and must be finalized only after the full v2 composite is visually approved; do not publish per-state offsets, crops, or alternate bounds. The v1 metadata is reference context, not automatic approval of final v2 coordinates.

## Next review gate

The next output must be one **NON-SHIPPING v2 composite/reference** showing the full hybrid room and prop layout, plus four aligned **NON-SHIPPING window-state previews** for morning, noon, dusk/evening, and late night. Review these before any production export.

Do not claim final approval, export production assets, integrate runtime assets, edit app code, or proceed to Phase 2 until the v2 composite and all four window-state previews receive explicit visual approval.

## Generated visual-review set

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** The following files are candidates awaiting explicit visual approval. They are not production assets and have not been integrated:

- `home-room--hybrid-reference-noon--non-shipping-v02.png` — neutral full-room reference composite.
- `home-room--state-morning--non-shipping-v02.png` — aligned morning preview.
- `home-room--state-noon--non-shipping-v02.png` — aligned noon preview.
- `home-room--state-dusk--non-shipping-v02.png` — aligned dusk/evening preview.
- `home-room--state-late-night--non-shipping-v02.png` — aligned late-night preview.
- `contact-sheet--home-time-states--non-shipping-v02.png` — labeled four-state art-review sheet.
- `composition-metadata.v2.json` — shared anchors, reserved bounds, window mask, and deterministic pipeline metadata.
- `README.md` — this NON-SHIPPING refinement brief and manifest.

All PNGs are 1200×1600, 8-bit RGB, and carry an sRGB profile. The neutral reference and noon preview are intentionally pixel-identical. Morning, dusk, and late-night were deterministically color-graded and composited from that same master through one locked window mask; no state was regenerated, resized, recropped, or repositioned.

The five full-room source images contain no cat, copy, UI, emoji, navigation buttons, labels, signatures, or watermarks. Text appears only on the contact sheet for visual-review identification. Stop here for visual approval; this set does not authorize production export, app integration, or Phase 2.
