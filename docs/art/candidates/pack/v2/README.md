# Open Pack Physical Insertion v2

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** This directory is a physical-placement refinement only. It is not approved for runtime use or integration.

## What changed from v1

The opened-bag structure remains exactly the v1 base and foreground rim. V2 replaces the illustrative calibration-board review proxies with transforms of the actual transparent current-catalog masters from `docs/art/candidates/postcard-gifts/v1/masters/items/`.

No item master is copied into this directory, redrawn, modified, or exported as a new item derivative. `placement-transforms.v2.json` is the reusable contract: source path and hash, source/destination anchors, affine transform, named compartment, containment polygon, item z-order, center of gravity, physical occlusion, and 342/382 px visibility.

## Capacity-3 configurations

- `outing-kit`: travel tin, small blanket, small camera
- `play-kit`: yarn ball, small bell, fish biscuit
- `wish-observation-kit`: one ticket, small telescope, fish biscuit

Together the three studies cover all eight real catalog items. Every configuration contains exactly three objects. The wish kit contains the only ticket, never more than one wish item. Its destination remains `wishDestinationId` data and is not painted into the blank ticket.

## Layer order

1. unchanged v1 opened-bag base
2. three referenced item masters transformed according to `placement-transforms.v2.json`
3. unchanged v1 foreground shell/rim
4. review or application UI

Each item uses one compartment containment polygon. The foreground rim restores lower-edge occlusion, so objects read as seated inside rather than floating above the shell.

## Text-free source composites

- `composites/pack-filled--outing-kit--master-1536--non-shipping-v02.png`
- `composites/pack-filled--play-kit--master-1536--non-shipping-v02.png`
- `composites/pack-filled--wish-observation-kit--master-1536--non-shipping-v02.png`

These RGBA files are flattened placement studies, not replacement item art. They contain no text, numbers, labels, UI, emoji, or watermarks.

## Reviews

At both 390×844 and 430×932:

- `populated` uses the outing kit.
- `selected` uses the wish/observation kit and review-only ticket destination UI.
- `scroll` uses the play kit in the real vertically scrolling drawer pattern.

`reviews/physical-depth-contact-sheet--1200x1600--non-shipping-v02.png` compares the empty v1 bag with all three physical configurations.

## QA

`qa-report.v2.json` validates capacity, wish count, pairwise overlap, slot containment, center of gravity, foreground-rim occlusion, actual CSS-size visibility, dimensions, alpha, and source-file immutability. Visual approval remains pending.

No pack/v1 file, postcard-gifts/v1 file, app source, production asset, or git history was changed. Stop here for visual approval.
