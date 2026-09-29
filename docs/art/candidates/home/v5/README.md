# Home Responsive States and Activity Fit v5

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** This pack is review-only and is not approved for production, integration, or shipping.

v5 moves the supported blank memo from the edge-clipped cabinet to the away-state windowsill, closes AA-002 with stable sleep/play/eat placements using unchanged approved production Minho, and adds 320px evidence for both away and collectible-ready.

## Outputs

- `placement-responsive-metadata.v5.json` — per-pose bounds/anchors, support geometry, live-text safe zone, and viewport transforms.
- `qa-report.v5.json` — hashes, dimensions, grounding, collision, crop, and safety-margin checks.
- `reviews/physical-review--home-activities--1200x1600--non-shipping-v05.png`
- `reviews/physical-review--away-and-treat-responsive--1200x1600--non-shipping-v05.png`
- Fifteen mobile reviews: sleep, play, eat, away, and collectible-ready at 320×700, 390×844, and 430×932.

## Quantitative results

- Memo minimum support margin: 320 `4.4px`; 390 `5.4px`; 430 `6.2px`.
- Treat minimum support margin: 320 `5.1px`; 390 `6.2px`; 430 `7.1px`.
- Memo is fully visible at every width with a transformed live-text safe zone.
- Pose canvas sizes are 420/450/450px; maximum scale ratio is 1.071.
- Play has zero overlap with cat tree, room bowls, cabinet, and navigation reserve.
- Eat uses a feathered same-room floor occlusion under the approved baked bowl, leaving one visible feeding set.
- No optional contact shadow was needed.

No v1-v4 file, app code, production Minho, other candidate, or git history was modified. Stop for visual approval.
