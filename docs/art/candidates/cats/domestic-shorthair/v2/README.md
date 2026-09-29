# BraveCat domestic-shorthair acceptance supplement v2

**NON-SHIPPING / ACCEPTANCE-REVIEW-ONLY.** This supplement closes home-fit and style audit coverage for the approved, unchanged v1 orange tabby and Li Hua pose masters. It does not recolor, copy, or edit cat art.

## Coverage

- 36 required evidence slots: 3 viewport widths × 2 cats × 6 poses.
- 34 new full-resolution viewport composites in this v2 directory.
- 2 approved Li Hua v1 sleep composites at 390×844 and 430×932 referenced by path and SHA-256.
- All four existing v1 mobile proofs are hash-verified; orange sleep is regenerated only as a v2 review composite at the acceptance scale, without changing its master.
- The 320 px minimum-width acceptance viewport is defined as 320×700, exercising the compact-height layout.
- Three concise per-width contact matrices cover every slot.
- One 1:1 390×844 triptych compares production Minho, orange tabby, and Li Hua in the approved room at normal mobile size.

## Placement

All masters retain their v1 bottom-center anchor at `(512, 960)`. Orange tabby uses a fixed `1.05×` Minho review canvas in every pose; Li Hua uses the fixed `1.00×` adult baseline, preserving its long-legged lean morphology instead of equalizing visible bounds. Room placement uses `(690, 1395)`, except `eat` and `play`, which use `(720, 1395)` to separate the integrated bowl/yarn from fixed room props without changing identity scale.

No contact-shadow asset was added. Full-resolution review shows direct rug contact with no floating gap; a shadow would be redundant.

## Result

All 36 slots pass anchor, visible/opaque bounds, fixed scale, support, furniture/navigation/safe-area collision, crop, and edge-style checks. Eat bowls are grounded and separated from the fixed room bowls. Play yarn is grounded and clear of the cat tree, wand, bowls, and table. Li Hua's active tail clears every audited fixture and safe area.

The normal-mobile comparison retains the v1 warning that fur detail is denser than the room wash. It does not materially read as a hard photoreal cutout, so no individual pose was regenerated.

The v1 debris audit found no `.tools`, `*.dist-info`, native dependency libraries, or `__pycache__` artifacts requiring removal. All intended v1 hashes remain unchanged.

Stop here for approval. No app code, v1 file, production Minho asset, other candidate root, or git history was modified.
