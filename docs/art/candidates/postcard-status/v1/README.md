# Postcard status + Album-empty candidate pack v1

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** GEN-06 covers only the missing AA-010/AA-011 status and presentation assets. Nothing here is approved for runtime use or shipping.

## Generated status assets

- `masters/postmark--ring-waves--master-768x512--non-shipping-v01.png` — 768×512 straight-RGBA, text-free double ring plus four cancellation waves. The 120×80 runtime review derivative keeps a clear live destination/date center.
- `masters/scene--unavailable-covered-photo--master-1200x900--non-shipping-v01.png` — intentional opaque 1200×900 covered-photo fallback. It contains no landmark, Scene, cat, destination, date, pseudo-text, warning, UI, or emoji.
- `masters/album--empty-open--master-512--non-shipping-v01.png` — dedicated 512×512 straight-RGBA open Album with four visibly empty mounts, generated support plane/contact shadow, and live-copy quiet space.

## Album reuse decision

Reuse was tested first. The existing stack fails because it visibly contains multiple cards; the blank back fails because it is itself one Postcard; and the upright navigation Album identifies the destination but does not explicitly communicate empty pockets. The dedicated vignette is therefore justified. See:

- `qa/reuse-evaluation--album-empty--1200x800--non-shipping.png`

## Acceptance evidence

- `reviews/320/review--postcard-unavailable--320x700--non-shipping-v01.png`
- `reviews/320/review--album-empty--320x700--non-shipping-v01.png`
- `reviews/390/review--postcard-unavailable--390x844--non-shipping-v01.png`
- `reviews/390/review--album-empty--390x844--non-shipping-v01.png`
- `reviews/430/review--postcard-unavailable--430x932--non-shipping-v01.png`
- `reviews/430/review--album-empty--430x932--non-shipping-v01.png`
- `reviews/contact-sheet--postcard-status-v1--1600x1800--non-shipping.png`
- `qa/layer-order-proof--postcard-status-v1--1200x900--non-shipping.png`
- `qa/mobile-readability--postmark--1200x800--non-shipping.png`
- `placement-metadata.v1.json`
- `qa/physical-accessibility.v1.json`

The mobile reviews are deterministic composites at 320×700, 390×844, and 430×932. Review-only live copy, destination, date, headings, hints, and controls are not baked into source art.

## Scope boundary

GEN-06 authoring is confined to this directory. No landmark Scene, existing Postcard, starter item, Treat, holder, envelope, destination Souvenir, Minho file, or app file was modified. Other candidate assignments continued changing in parallel; their broad before/after drift is recorded separately and is not attributed to GEN-06. Existing stack/blank-back/Album/Minho assets are read-only review inputs with recorded hashes.

No commit or integration was performed. Stop here for visual approval.
