# Candidate art cleanup audit — 2026-07-28

Scope: `docs/art/candidates/`

This document records both the initial inventory and the completed first cleanup
pass. Archived files remain recoverable under
`docs/art/archive/candidates-2026-07-28/`.

## Executive summary

- Current candidate size: 348 files, about 456 MB.
- Recoverable archive created by this cleanup: 22 files, about 35 MB.
- Five byte-identical binary copies were deduplicated, reducing total retained
  storage by about 14 MB.
- Runtime and review state are different:
  - Production uses copied derivatives under `public/`; it does not load PNGs from
    `docs/art/candidates/` directly.
  - Development currently loads Home v4, landmark v5, and Minho watercolor v2
    derivatives from `public/dev-art/`.
- `shippingEligible: true` is present only for the Home Display v2 candidate
  package. Other current candidate families are preview-only, pending human
  review, or blocked by later gates.
- Historical landmark QA remains in place because old QA reports, approvals,
  integration scripts, and active-set integrity checks reference or hash-lock it.

## Status vocabulary used here

- **Production-derived**: a candidate is the recorded source for a copied runtime
  derivative under `public/`.
- **Development-active**: a copied derivative is selected by the development
  catalog or Home preview.
- **Approved**: explicitly approved at the scope stated. Development-preview,
  visual-direction, and human-visual approvals are not shipping approvals.
- **Needs work**: a manifest or README records an unsatisfied review, correction,
  rights, composite, QA, or shipping gate.
- **Generated but unused**: not selected by the current production or development
  runtime. It may still have audit or regeneration value.

## Family inventory

| Candidate family | Files / size | Runtime use | Approval state | Recommended disposition |
| --- | ---: | --- | --- | --- |
| `calibration/` | 5 / 8.2 MB | Minho board is a production identity reference, not a rendered runtime asset | Minho identity approved; calico withdrawn; scene and item pending | Keep Minho board + manifest. Archive withdrawn/pending boards if those calibration tracks are closed. |
| `style-intensity/` | 1 / 5.5 MB | The retained triptych is referenced by landmark provenance | Style B is locked through manifests; sheet is non-final calibration | Retained. Three standalone sheets were archived. |
| `home-display-v1/` | 0 | Superseded by v2 | Non-shipping | Entire package archived. |
| `home-display-v2/` | 14 / 9.3 MB | Four candidate assets are production-derived and actively used | Package says `shippingEligible: true`; runtime QA recorded | Promoted candidates, manifest, report, source inputs, and QA retained. Superseded wall v01 archived. |
| `home-v4/` | 17 / 31 MB | Nine images are development-active via copied files in `public/dev-art/home-v4/` | Eight are approved only for development preview; eat foreground is used but not in the approval scope; shipping false | Active/build sources retained. Interior v01 archived; duplicate noon QA removed. |
| `home-wall-prototype/` | 1 / 0.5 MB | Referenced by the Home v4 visual-remediation record | Selected as the cabinet-referenced quadrilateral layout prototype | Retained as design evidence. |
| `portraits/minho-watercolor-v2/` | 23 / 20 MB | Ten normalized poses are development-active | Machine QA passes; human review pending; shipping false | Keep all ten normalized poses, manifest, and contact sheets for review. Mattes are build intermediates and can move to an archive after approval/promotion. |
| `landmarks/` | 275 / 366 MB | v3-derived set is used in production; v5 set is used in development | v3 visual scope approved but rights/composite/shipping remain uncleared; v5 exact set pending human approval | Do not bulk-delete. Separate current v5 review set, production provenance, and historical QA/rejected material first. |
| `cinematic-v6/` | 12 / 16 MB | Not integrated into runtime | Two selected baselines are accepted only as low-fidelity visual direction; the Reed Mist story is confirmed and awaiting its first image | Selected baselines and active story spec retained. Night Watch intermediate batches archived and deduplicated. |

## Currently used

### Production-derived

These candidate files are recorded sources for runtime copies:

- Home Display v2:
  - `home-display-v2/display--postcard-wall--candidate-v02.png`
  - `home-display-v2/display--souvenir-occlusion--candidate-v01.png`
  - `home-display-v2/souvenir--postmark-pin--candidate-v01.png`
  - `home-display-v2/souvenir--travel-charm--candidate-v01.png`
- Landmark v3: 61 active scene PNGs in
  `landmarks/manifest.candidates.v3.json`. They were visually approved and
  copied to production PNG/WebP outputs. The runtime still marks the set
  `shippingEligible: false` because rights and final composite gates are open.
- `calibration/calibration-non-final--portrait-board--minho--candidate-a--v02.png`
  remains the identity reference in the production Minho manifest. The six
  production poses are separate files under `public/portraits/minho/`.

### Development-active

- Home v4 copied derivatives:
  - `exterior-{morning,noon,dusk,late-night}--candidate-v01.png`
  - `lighting-{morning,dusk,late-night}--candidate-v01.png`
  - `interior-foreground--candidate-v03.png`
  - `interior-foreground-eat--candidate-v01.png`
- Landmark v5: all 76 active scene paths in
  `landmarks/manifest.candidates.v5.json` are copied into the development
  catalog. The exact v5 set is pending human review.
- Minho watercolor v2: all ten files under
  `portraits/minho-watercolor-v2/poses/` are copied into the development
  catalog. Human portrait review is pending.
- Home Display v2 runtime derivatives are used in both development and
  production.

## Explicitly approved, with scope

### Approved and production-eligible

- Home Display v2's four promoted candidate assets. The candidate and production
  manifests both record `shippingEligible: true`.

### Approved, but not shipping-approved

- Minho calibration identity board: approved as an identity reference.
- Home v4 eight-file scope in `docs/art/reviews/home-v4/approval.v1.json`:
  interior foreground v03, four exterior layers, and three lighting layers.
  Approval is only for development preview.
- Landmark v3's 61-scene exact visual scope in
  `docs/art/reviews/landmarks/visual-approval.v2.json`. Rights review is
  `review-complete-not-cleared`, composite approval was rejected/superseded,
  and the runtime manifest remains non-shipping.
- `cinematic-v6/night-watch-stargazing/selected-four-act-v01/`: accepted
  low-fidelity visual-direction baseline.
- `cinematic-v6/mist-harbor-returning-boats/selected-four-act-v01/`: user-accepted
  low-fidelity visual-direction baseline.

## Needs continued work

### Home v4

- `interior-foreground-eat--candidate-v01.png` is used by the development Home
  but is not listed in the current approval scope.
- Multi-width runtime QA and shipping approval remain required.
- The candidate manifest itself still says `shippingEligible: false`.

### Minho watercolor v2

- All ten poses pass machine QA.
- Human checks remain pending for identity consistency, watercolor style,
  pose semantics, support/contact, interaction fit, and alpha edges.
- Dedicated scene-composite approval is required before promotion.

### Landmark v5

- 76 scenes are development-active, machine QA passes, and shipping is disabled.
- Fifteen v5 generated candidates require exact-set visual/placement review:
  ten superseding revisions and five distant-overlook additions.
- Rights/cultural/source-independence review, final Minho composites, and
  shipping approval remain open.
- Compared with the v3 production-derived set:
  - 56 scene source files overlap.
  - 5 v3 production sources are no longer selected by v5.
  - 20 v5 sources are not in v3.

### Cinematic v6

- Night Watch Stargazing:
  - Selected Scene 03 contains a duplicate olive travel pack.
  - Generate/fix a v05 Scene 03, then create `selected-four-act-v02`.
- Mist Harbor Returning Boats:
  - Selected Scene 02 repeats the sleeping pose from Scene 04.
  - The Scene 02 olive pack is not clearly present.
  - After correction, it still needs independent 4:3 Cat-free Scene masters,
    Portrait composites, Perch QA, originality review, rights review, and
    shipping approval.
- The Mist Harbor README now explicitly records that the batch-04 intermediate
  was removed after the selected master was frozen, so that cleanup is
  provenance-safe.
- Reed Mist Morning Flight:
  - Story direction is user-confirmed.
  - The low-fidelity continuity image is still generating/not yet recorded.
  - It remains non-shipping and should stay in `candidates` while active.

### Unresolved calibration tracks

- `calibration-non-final--scene-board--hillside-railway--candidate-a--v01.png`
  and `calibration-non-final--item-board--starter-set--candidate-a--v01.png`
  still say `pending`. Decide whether these tracks are still active; otherwise
  archive them rather than leaving indefinite pending candidates.

## Generated but not selected by current runtime

### Archived superseded or unused groups

- Entire `home-display-v1/`.
- `home-display-v2/display--postcard-wall--candidate-v01.png`.
- The three standalone style-intensity A/B/C sheets; the referenced triptych
  remains in `candidates`.
- All Cinematic v6 images, including selected baselines, are unused by runtime.
  Selected baselines and the active Reed Mist spec remain in `candidates`;
  earlier Night Watch batches are archived.

### Home v4 intermediates and QA-only images

- `interior-foreground--candidate-v01.png` (archived)
- `interior-foreground--candidate-v02.png` (still a recorded build source)
- `source--interior-no-food-bowl--imagegen-v01.png` (build source)
- all `home-composite*--qa.png` files

These are not runtime images. Preserve build inputs if deterministic rebuilding
matters; archive QA-only outputs after the approval record is sufficient.

### Home Display v2 build/QA-only images

- `source--postcard-wall--generated-v01.png`
- `source--souvenirs--generated-v01.png`
- `display--home-composite*--qa-v01.png`
- `runtime--*--mobile-470--qa-v01.png`

These support rebuilding or review but are not runtime-loaded.

### Landmark historical material

- 109 candidate Scene PNGs exist; 76 are active in v5.
- 33 Scene PNGs, about 56.2 MB, are not selected by v5.
  - Five of those remain sources for the v3-derived production runtime.
  - The other 28 are superseded/rejected historical candidates.
- Sixteen root-level pre-v5 overview contact sheets occupy about 56.1 MB.
- Six v5 root overview/placement sheets occupy about 14.5 MB and are part of
  the current review.
- Forty-one per-destination contact sheets occupy about 63.2 MB. Ten staging-v5
  sheets are referenced by the v5 QA report; the rest are historical review
  artifacts.
- Ten v5 Minho placement-preview sheets occupy about 20.8 MB and are required
  for the current review.
- Nine files have rejected filenames or live under rejected groups. They are
  audit-only and should move to an archive if retained.

## Deduplicated bytes

The following duplicate copies were removed after SHA-256 verification:

- Night Watch selected Scene 01 duplicates its batch-03 source.
- Night Watch selected Scenes 02, 03, and 04 duplicate their batch-04 sources.
- Home v4 `home-composite--candidate-v03--qa.png` duplicates
  `home-composite-noon--candidate-v03--qa.png`.

Canonical paths, removed historical paths, and hashes are recorded in
`docs/art/archive/candidates-2026-07-28/README.md`. About 14 MB was recovered.

## Cleanup result

Completed:

- Active Home, Display, portrait, landmark, and cinematic selected sets frozen.
- Home Display v1, unreferenced calibration sheets, superseded Home assets, and
  Night Watch intermediate batches moved to a recoverable archive.
- Five exact binary duplicates removed with canonical-path records.
- Night Watch selected provenance updated.
- The broken landmark v2 composite-approval link now targets the existing
  `approval.superseded.v1.json`.

Intentionally deferred:

- Landmark pre-v5 overviews and rejected generations. Moving them would require
  coordinated rewrites of historical QA, approvals, scripts, and hash locks.
- Pending calibration scene/item boards. Their product track should be closed or
  reviewed before archival.
- The withdrawn calico board remains audit-only beside its calibration manifest.
- Home v4 eat-layer human approval, landmark v5 human/rights review, watercolor
  portrait human review, and cinematic corrections.

## Validation after cleanup

Passed:

- Home v4: 9 non-shipping development layers.
- Home Display assets.
- Minho watercolor: 10 poses.
- Latest development art: 25 destinations, 76 scenes, 10 watercolor poses.
- Cinematic integration script: syntax-only mode; the ten chapter Scene
  fragments are not generated yet.
- Markdown link scan for candidates and the new archive.

Existing generated-output drift, not rewritten during this cleanup:

- `assets:check-landmark-staging` reports the v5 overview sheet 01 as stale.
- `assets:check` reports `docs/art/archive/asset-archive.v2.json` as stale.

Regenerate those outputs only as a separate landmark/archive maintenance change;
doing so can rewrite broad generated artifacts.
