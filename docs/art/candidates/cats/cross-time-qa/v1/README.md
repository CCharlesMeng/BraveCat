# Cross-time cat visibility and physical-compositing QA v1

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** This pack is exhaustive review evidence only. It does not change or integrate a cat master, home layer, production Minho asset, app file, or other candidate root.

## Exact coverage

- Primary grid: **120/120** full 390×844 composites — 10 identities × 3 actual home activities (`sleep`, `play`, `eat`) × 4 approved time states.
- Late-night responsive stress grid: **18/18** proofs — solid blue, Li Hua, and Maine Coon × 3 activities × 320×700 and 430×932.
- Contact matrices: **10/10 per-cat** and **4/4 per-time**.

## Physical composition

The selected scene order is exterior → neutral interior/foreground → v6 food-bowl removal patch for eat → unchanged cat master at its documented scale/anchor → approved v3 time lighting → UI. Morning, dusk, and late-night lighting therefore changes cat pixels with the room instead of leaving a bright pasted cutout. Noon remains neutral. No cat-only grading, halo, glow, generated contact shadow, geometry move, or body-size equalization is used.

Eat retains exactly two visible vessels in every one of its 40 primary composites: the unchanged room water bowl and the pose-integrated baked eating bowl. The superseded room food bowl is removed before cat and lighting, with zero water-bowl delta and zero changed pixels outside the declared patch.

## Visibility result

Quantitative evidence is in `visibility-metrics.v1.json`; it compares each lit cat silhouette to the same lit scene with the cat omitted at actual display size. Lowest primary visibility scores: golden-shaded/eat/late-night 39.8, orange-tabby/eat/late-night 40.6, golden-shaded/sleep/late-night 41.5. These low late-night warm-coat cases remain readable in the full-size evidence and are recorded as review warnings. Dusk focus explicitly covers solid blue, Li Hua, Maine Coon, Siamese points, orange tabby, golden shaded, and blue-golden shaded.

No universal moonwash/bounce overlay was necessary; no overlay asset was created. All 30 late-night 390×844 cells and all 18 required 320/430 dark-coat stress proofs retain readable silhouettes, coat cues, and activities. Conservative quantitative threshold misses are retained as review warnings rather than hidden by scene brightening.

## Review entry points

- `reviews/by-cat/` — 10 identity matrices, each showing all 12 time/activity cells.
- `reviews/by-time/` — 4 time matrices, each showing all 30 cat/activity cells.
- `reviews/focus/dusk-coat-visibility--seven-identities-three-activities--390x844--non-shipping-v01.png` — required dusk coat review.
- `reviews/focus/late-night-worst-cases--solid-blue-li-hua-maine-coon--320x700-430x932--non-shipping-v01.png` — required 320/430 late-night worst cases.
- `reviews/focus/physical-z-order--late-night-solid-blue-sleep--390x844--non-shipping-v01.png` — selected physical z-order versus the bright-cutout failure mode.
- `coverage-matrix.v1.json`, `placement-z-order-metadata.v1.json`, `visibility-metrics.v1.json`, and `qa-report.v1.json` — exact coverage, transforms, metrics, and QA.
- `manifest.v1.json` and `hashes.sha256` — output inventory and hashes.

Stop for visual approval. No commit or integration was performed.
