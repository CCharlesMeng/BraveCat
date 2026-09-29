# Canonical Populated Pack v3

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** This directory is the canonical populated-pack refinement for visual review only. It is not approved for runtime use or integration.

## Canonical item source

All eight starter items are referenced only from `docs/art/candidates/shop/v2/masters/`. Their exact shop/v2 manifest hashes are recorded and revalidated in `placement-transforms.v3.json` and `qa-report.v3.json`.

No item master is copied into v3, redrawn, edited, regenerated, or exported as a new standalone item derivative.

## Supersession

`supersession.v3.json` explicitly marks pack/v2’s product-content evidence and postcard-gifts/v1 starter-item references as **SUPERSEDED**. V3 retains only pack/v2’s successful capacity-3, containment, z-order, physical-occlusion, and CSS-visibility method.

The structural source remains unchanged pack/v1:

1. opened-bag base and hinge support;
2. transformed shop/v2 canonical item masters;
3. foreground rim/pocket occlusion.

## Capacity-safe kits

- `outing-kit`: travel tin, small blanket, small camera.
- `play-kit`: yarn ball, small bell, fish biscuit.
- `wish-observation-kit`: one ticket, small telescope, fish biscuit.

Together they cover all eight catalog IDs. Every kit contains exactly three items. The ticket is the sole wish item; destination remains live `wishDestinationId` data and is not baked into source composites.

## Reusable outputs

- `placement-transforms.v3.json`: alpha-derived source anchors, affine transforms, destination anchors, source hashes, slot containment, z-order, overlap, center of gravity, occlusion, and 272/342/382 px visibility.
- `composites/pack-filled--outing-kit--master-1536--non-shipping-v03.png`
- `composites/pack-filled--play-kit--master-1536--non-shipping-v03.png`
- `composites/pack-filled--wish-observation-kit--master-1536--non-shipping-v03.png`

The three RGBA composites are text-free placement studies, not replacement item art.

## Reviews

Full-resolution `empty`, `populated`, `selected`, and `scroll` reviews are provided at:

- 320×700, with a 272 px bag content width.
- 390×844, with a 342 px bag content width.
- 430×932, with a 382 px bag content width.

`reviews/canonical-physical-depth-contact-sheet--1200x1600--non-shipping-v03.png` compares all eight shop/v2 source silhouettes, the empty v1 bag, and the three inserted kit results.

## QA and approval

`qa-report.v3.json` validates all eight canonical hashes, only-source policy, capacity, coverage, wish count, containment clipping, centers of gravity, pairwise overlap, z-order, hinge/slot preservation, foreground-rim occlusion, 272/342/382 px visible bounds, alpha, dimensions, 12 required mobile reviews, and protected input-tree immutability.

No pack/v1-v2 file, shop/v1-v2 file, app source, production asset, or git history was changed. Stop here for visual approval.
