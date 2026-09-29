# BraveCat British Shorthair home-fit supplement v2

**NON-SHIPPING / ACCEPTANCE-EVIDENCE-ONLY.** This directory is review evidence only. It does not integrate or replace production cat art.

## Coverage

- 72/72 slots: 4 identities × 6 poses × 320×700, 390×844, and 430×932.
- 64 full-resolution v2 composites; 8 existing v1 sleep reviews at 390×844 and 430×932 are referenced by verified SHA-256.
- The recovery retained 40 valid partial composites and generated 24 missing 320×700 composites.
- Three per-width contact matrices and four per-identity matrices cover the complete grid.

## Physical and style result

Every pose keeps one identity-fixed Minho-relative scale: golden shaded 0.96×, blue-golden shaded 1.05×, solid blue 1.10×, and blue-white bicolor 1.00×. Bottom-center anchors, visible and opaque bounds, rug support, furniture/navigation/safe-area clearance, crop behavior, and soft-edge compatibility are recorded in `coverage-metadata.v2.json`.

Eat bowls and play yarn remain integrated once, grounded on the rug, and in physical cat contact. No duplicate room bowls, furniture penetration, floating, extra limbs, or per-pose scale changes remain. Solid blue passes the sage-rug visibility check. The blue-white cap, saddle, one left-shoulder spot, and white tail tip remain identifiable across all six poses.

`reviews/style/style-comparison--minho-and-four-british-shorthairs--390x844-1to1--non-shipping-v02.png` compares production Minho and the four candidates at normal 1:1 mobile size. The denser naturalistic fur remains a review warning, not a material failure, so all 24 v1 pose masters are retained byte-for-byte.

## Integrity

`qa/verification.v2.json` records 72/72 passing coverage. `qa/v1-integrity.v2.json` verifies every protected v1 cat master and referenced review before and after the build. `manifest.v2.json` lists v2 paths, dimensions, byte sizes, and SHA-256 hashes.

Stop here for review. No app code, production Minho, v1 cat master, other candidate root, or git history was modified.