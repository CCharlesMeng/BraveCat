# Canonical Shop Watercolor Candidate Pack v2

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** This directory supersedes `docs/art/candidates/shop/v1` for visual review, but nothing here is approved for runtime use. No app code, production asset, postcard-gifts file, shop/v1 file, or git history was changed.

## Canonical family

The pack contains exactly the eight current `STARTER_ITEMS` data keys:

- `fish-biscuit` / 小鱼饼.
- `travel-tin` / 旅行罐头.
- `small-blanket` / 小毛毯.
- `yarn-ball` / 毛线球.
- `small-bell` / 小铃铛.
- `small-camera` / 小相机.
- `small-telescope` / 小望远镜.
- `ticket` / 车票.

`data-key-image-mapping.v2.json` records each exact current `imageSrc` and its v2 candidate exports.

## Refinement from v1

The v1 object designs were retained. No product was regenerated.

Every master received deterministic lower-silhouette cleanup:

- remove the baked floor/contact region with an item-specific object-edge contour;
- feather the final five source pixels without adding a replacement shadow;
- bleed nearby interior object color into suspect exterior matte pixels;
- remove tiny disconnected alpha remnants;
- zero RGB beneath fully transparent pixels;
- repair only the accidental transparent checker holes inside the telescope lens from nearby lens pixels.

The result contains no floor patch, contact streak, synthetic grounding ellipse, light fringe, or dark fringe. Internal watercolor shading and object identity remain in the object itself.

## Exports

For every data key:

- `masters/`: cleaned 512×512 straight-alpha RGBA master.
- `runtime-128/`: 128×128 runtime candidate.
- `review-92/`: exact 92×92 2× derivative used at the current 46×46 CSS slot.

All exports embed sRGB, retain at least a 48 px master safe margin, and use zero RGB in fully transparent pixels.

## Shared Treat glyph

Price and balance reviews reuse only:

`docs/art/candidates/postcard-gifts/v1/runtime/items/reward--treat--dried-fish--runtime-32--non-shipping-v01.png`

The glyph remains an external shared dependency and was not copied into shop/v2. None of postcard-gifts/v1’s duplicate starter-item candidates were reused. No emoji appears in v2 price or balance reviews.

## Acceptance evidence

- `reviews/shop-review--320x700--mixed-affordability--non-shipping-v02.png`
- `reviews/shop-review--390x844--affordable-owned-top--non-shipping-v02.png`
- `reviews/shop-review--430x932--unaffordable-owned-bottom--non-shipping-v02.png`
- `reviews/before-after-edge-sheet--1200x1600--non-shipping-v02.png`
- `reviews/light-dark-split-qa--1200x900--non-shipping-v02.png`
- `reviews/contact-sheet--shop-v2--1200x1600--non-shipping-v02.png`
- `qa/legibility--46px--1200x500--non-shipping-v02.png`

The 320 px review checks minimum-width wrapping and mixed affordability. The 390 px and 430 px reviews cover the full catalog across affordable, unaffordable, and owned-count states. The current shop has no product-lock state, so none was invented.

## Metadata and QA

- `manifest.v2.json`: hashed file inventory, `supersedes`, mappings, and shared dependency.
- `data-key-image-mapping.v2.json`: exact data-key/current-`imageSrc` mapping.
- `placement-size-metadata.v2.json`: CSS slots, export sizes, review states, and Treat placements.
- `qa/cleanup-metrics.v2.json`: deterministic contour controls and before/after alpha metrics.
- `qa-report.v2.json`: machine and visual acceptance results.

Stop here for visual approval. No commit, promotion, or integration has been performed.
