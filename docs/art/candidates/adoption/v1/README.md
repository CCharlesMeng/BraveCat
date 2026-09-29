# First-run Adoption Presentation Candidate v1

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** This isolated GEN-02 batch covers AA-015. Stop for visual approval; do not integrate or promote.

## Candidate asset

- `masters/adoption-welcome-base--master-1200x1600--non-shipping-v01.png` — exact 1200×1600 opaque embedded-sRGB welcome base.
- `source/adoption-welcome-base--generated-source-1024x1536--v01.png` — actual generated 1024×1536 source pixels, normalized only with an embedded sRGB profile.
- `source/generation-brief.v1.json` — generation references, constraints, raw hash, and normalization record.

The asset is text-free and contains no cat, name, copy, controls, labels, UI, emoji, logo, pseudo-text, or watermark. It uses restrained warm paper, sage, pale landscape wash, and warm wood. A broad wooden threshold defines the Portrait support plane while the center, top, and lower third retain generous low-detail space.

## Reuse and layer contract

`asset-layer-metadata.v1.json` defines:

1. `z00` generated base;
2. `z10` separate soft contact shadow;
3. `z20` an approved Portrait, fitted without crop and bottom-center anchored to the support plane;
4. `z30` live heading, name, input, validation, action, and transition UI.

The same anchor includes tall, broad, and compact fit envelopes for future approved cats. No future cat was invented or generated.

## Flattened reviews

- `reviews/adoption-review--320x700--validation-error--non-shipping-v01.png` — minimum-width validation-error safety.
- `reviews/adoption-review--320x700--keyboard-open--non-shipping-v01.png` — minimum-width keyboard-open safety with a 12-code-point live name.
- `reviews/adoption-review--390x844--default--non-shipping-v01.png` — 390×844 default with a short live name.
- `reviews/adoption-review--430x932--success-transition--non-shipping-v01.png` — 430×932 successful transition framing with a 12-code-point live name.
- `reviews/contact-sheet--adoption-presentation--1200x1600--non-shipping-v01.png` — asset, state, anchor, safe-zone, future-proportion, and layer contact sheet.

Approved Minho is hash-verified and used unchanged in identity and pixels only inside flattened reviews; the source file is uniformly scaled as a full 1024×1024 canvas and never copied into this candidate root. A separate neutral shadow provides contact without modifying the Portrait.

## QA

- Every PNG has exact named dimensions and an embedded sRGB profile.
- The master is opaque RGB; reviews are flattened opaque RGB.
- Paws and tail both lie within the broad wooden top plane in every state.
- Portrait pixels do not overlap input, validation, action, or keyboard zones.
- Short and maximum demonstrated 12-code-point names fit their live containers.
- The source/master contain no baked text or UI.
- `qa/qa-report.v1.json`, `qa/visual-review.v1.md`, `hashes.sha256`, and `manifest.v1.json` provide machine and visual evidence.

No app code, production Minho, production asset, home/cat candidate root, or git history was modified. No commit or integration was performed.
