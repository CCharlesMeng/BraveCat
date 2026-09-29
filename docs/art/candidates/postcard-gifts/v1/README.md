# Postcard + gifts candidate pack v1

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** Nothing in this directory is approved for runtime use. All files have `shippingEligible: false`; stop here for visual approval.

## Scope grounded in the current UI

The current album renders immutable 4:3 scene/Minho compositions inside a CSS paper card, followed by a CSS message panel and circular postmark. Its non-shipping scene fallback is CSS geometry, and the empty album uses character dots.

The visible reward/item presentation is also provisional:

- Treat balance: `🐟` at `1rem` (about 16 CSS px).
- Windowsill plate: two `🐟` at `0.75rem` (about 12 CSS px).
- Shop and Pack: a 46×46 slot containing the first character of each item name.
- Required current objects: 小鱼饼、旅行罐头、小毛毯、毛线球、小铃铛、小相机、小望远镜、车票.
- `STARTER_CATALOG.souvenirs` is empty. No destination souvenir or unsupported gift type was invented.
- No shipped gift-receive or detail component exists. Those review images are supplementary presentation studies using only Treat and current starter-item types.

## Candidate contents

### Transparent item/reward masters

`masters/items/` contains nine text-free 512×512 RGBA masters: one dried-fish Treat and the eight current `STARTER_ITEMS` objects. Each uses a 48 px safe margin.

`runtime/items/` contains:

- 96×96 review derivatives for 46 CSS px item slots at approximately 2× density.
- 32×32 and 24×24 dried-fish derivatives for the 16 px balance and 12 px windowsill presentations.

### Blank postcard presentation layers

`masters/presentation/` contains 1200×900 RGBA layers:

- Blank two-card stack holder.
- Blank postcard back.
- Envelope/pocket back.
- Separately compositable envelope/pocket front occlusion layer.

They contain no location names, captions, dates, stamps, production postcard image, or Minho art. `runtime/presentation/` contains 338×254 and 378×284 derivatives matching the calculated album widths at 390 px and 430 px viewports.

### Review material

- `reviews/390/`: album/postcard, Treat receive, and current-item detail at 390×844.
- `reviews/430/`: the same three states at 430×932.
- `reviews/contact-sheet--postcard-gifts-v1--1200x1600--non-shipping.png`.
- `qa/mobile-readability--390x420--non-shipping.png`: actual 46 px slots plus 16 px/12 px Treat checks.

The album review composites use an existing Kyoto production scene and existing Minho gaze file unchanged, review-only. No production postcard composition was written back.

## Metadata and QA

- `manifest.v1.json`: full asset inventory, dimensions, alpha, hashes, provenance, and UI findings.
- `placement-metadata.v1.json`: CSS-derived target sizes, insertion zones, anchors, and envelope layer order.
- `qa/generated-validation.v1.json`: machine checks for dimensions, RGBA, zeroed transparent RGB, and safe margins.
- `qa/visual-review.v1.md`: qualitative review and approval questions.
- `qa/immutable-verification.v1.json`: SHA-256 before/after comparison for app code, postcard code, Minho, production landmarks, runtime scenes, and existing candidate/review art.

No existing production landmark, postcard composition, postcard image, Minho file, app source, or other candidate folder was modified.
