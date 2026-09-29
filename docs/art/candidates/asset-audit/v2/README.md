# BraveCat generation-closure asset audit v2

**Verdict: GENERATION CLOSED.** No `launch-now` image or art batch remains.

All decision-free candidate generation and required generation QA identified by the v1 audit is now present. This does **not** make issue #19 shipping-complete: the current candidate families still need user visual approval, production/app integration, and the separate policy, font, landmark-rights, and Souvenir decisions described below.

This audit is documentation-only. It generated no image, edited no candidate art, app code, production asset, or git history, and made no commit.

Machine-readable detail: `asset-audit.v2.json`.

## Audit boundary and evidence

- Worktree: `/Users/moon/Documents/Code/BraveCat-home-screen-v1`
- Branch: `art/home-screen-v1`
- HEAD: `8b2d00e3dd1272e9a3dde885ba4b31e39b004a2d`
- Authoring boundary: `docs/art/candidates/asset-audit/v2/`
- Sources read: v1 audit; `README.md`; `CONTEXT.md`; issues #1, #2, #7, and #19 with comments; all ADRs; art calibration, archive, production, review, supersession, and rights records; all 29 `src/` files; `index.html`; `vite.config.ts`; `public/icon.svg`; and every completed candidate pack listed in the request.
- Completed-pack snapshot: 25 roots, 938 files including the hygiene findings below.
- Integrity: 22 manifests / 815 path-hash pairs pass; 6 hash ledgers / 283 entries pass; 98 completed-pack JSON files parse; zero missing declared files and zero hash mismatches.
- Visual spot-check: 17 canonical review/contact sheets across Home, Shop, Pack, Postcard, identity, adoption, loading, surfaces, glyphs, all cat families, and cross-time QA agree with their recorded dispositions.
- Tracked source/production diff before audit authoring: none.

## Closure result

There is no non-overlapping output root or implementation brief to launch because no decision-free image/art batch remains.

The v1 queue closed as follows:

- GEN-01 App identity: complete Candidate A/B suites; choose one.
- GEN-02 Adoption: complete candidate and responsive evidence; approve it.
- GEN-03 Loading: complete letter-tray/house-box suites; choose one.
- GEN-04 UI surfaces: complete paper/sage tiles and QA; approve them.
- GEN-05 Utility glyphs: complete authored SVG family and QA; approve semantic recognition.
- GEN-06 Postcard status: complete postmark, unavailable fallback, Album-empty, and 320/390/430 evidence; approve them.
- Deferred Home follow-up: home/v5 plus v6 closes activity, narrow-width, Note/tray, and eat-bowl corrections.
- Cat follow-up: all nine candidate identities have six poses and complete v2 viewport evidence; cross-time QA covers all ten identities.

No required acceptance artifact can be generated now without either duplicating existing evidence or crossing an earlier human/product/legal gate. The legacy Home v1/v2 roots have no standalone manifests because they are superseded directions. British Shorthair v1 has no standalone manifest, but v2 baseline/integrity records hash-lock all 24 source masters and the referenced acceptance evidence; this is not an art-generation gap.

## Exact 19-need status matrix

| Need | Status | Final evidence and next gate |
| --- | --- | --- |
| AA-001 Home room and four time states | `needs-human-selection` | home/v3 layers and four exact reconstructions exist; cross-time passes 120/120. Approve, then integrate. |
| AA-002 Home activity grounding | `needs-human-selection` | home/v5 closes sleep/play/eat; home/v6 supersedes only v5 eat evidence. Approve, then integrate placements. |
| AA-003 Supported away Note | `needs-human-selection` | home/v5 moves the supported memo to the Windowsill and proves 320/390/430 support. Approve, then integrate live text. |
| AA-004 Treat currency and collectible | `needs-human-selection` | postcard-gifts has 24/32/96 glyphs; home/v4-v5 has the sill tray; shop/v2 reuses the shared glyph. |
| AA-005 Home navigation icons | `needs-human-selection` | home/v3 Pack/Shop/Album 512/128 family is reused in 320/390/430 evidence. |
| AA-006 Bootstrap vignette | `needs-human-selection` | system-states has complete letter-tray and house-box candidates. Choose one. |
| AA-007 Eight starter items | `needs-human-selection` | shop/v2 is canonical 8/8; 46px and 320/390/430 QA pass; pack/v3 hash-pins it. |
| AA-008 Shop shelf/card accents | `complete` | Review proved no separate shelf/card/lock/purchase accent is required; responsive chrome remains CSS. |
| AA-009 Open Pack | `needs-human-selection` | pack/v1 structure plus pack/v3 canonical population and 12 mobile reviews are complete. |
| AA-010 Postcard presentation/status | `needs-human-selection` | postcard-gifts presentation plus postcard-status postmark/fallback close the art scope. Landmark shipping is separate. |
| AA-011 Album empty | `needs-human-selection` | reuse-first evidence justified a dedicated empty Album; all three widths pass. |
| AA-012 Destination Souvenirs | `blocked` | No roster, IDs, object briefs, selection output, or renderer exists. |
| AA-013 Shipping Scene set | `blocked` | Existing 20/48 and candidate 25/61 sets are gated by exact-set review, provenance, rights, counsel/permission, and shipping approval. |
| AA-014 App identity | `needs-human-selection` | Candidate A/B have complete master, launcher, mask, favicon, and mockup suites. |
| AA-015 Adoption | `needs-human-selection` | 1200×1600 base and 320/390/430 state evidence pass. |
| AA-016 Offline handwriting/stamp font | `blocked` | Requires a licensed font choice, provenance, subset, layout QA, and offline caching. |
| AA-017 Paper/wash surfaces | `needs-human-selection` | Seamless 1x/2x paper and sage candidates pass seam, repetition, determinism, and contrast QA. |
| AA-018 Utility glyphs | `needs-human-selection` | Five canonical SVGs pass structural and size QA; semantic recognition and focus treatment need human/integration review. |
| AA-019 Additional Portrait packs | `blocked` | Nine six-pose candidates and all QA are complete, but issue #2 prohibits invented presets until policy changes. |

There are zero `launch-now` and zero current `integration-only` need rows. Each affected family still has an earlier approval, policy, licensing, or legal gate. Once that gate closes, no new image batch is needed; the row becomes integration-only.

## Exact 45-state status matrix

| State | Status | Basis |
| --- | --- | --- |
| COV-001 bootstrap/hydrating | `needs-human-selection` | Two complete loading candidates. |
| COV-002 adoption/default | `needs-human-selection` | Adoption candidate complete. |
| COV-003 adoption/validation-error | `needs-human-selection` | 320 validation/keyboard evidence passes. |
| COV-004 home/sleep | `needs-human-selection` | Home and cross-time evidence complete. |
| COV-005 home/play | `needs-human-selection` | Home and cross-time evidence complete. |
| COV-006 home/eat | `needs-human-selection` | v6 and cross-time evidence complete. |
| COV-007 home/waiting | `needs-human-selection` | Reuses activity art with live copy. |
| COV-008 home/traveling-away | `needs-human-selection` | Supported Note evidence complete. |
| COV-009 home/returned | `needs-human-selection` | Reuses activity art with live copy. |
| COV-010 Windowsill empty/disabled | `needs-human-selection` | Covered by pending Home approval. |
| COV-011 Windowsill collectible 1–24 | `needs-human-selection` | Tray passes all widths. |
| COV-012 topbar Treat balance | `needs-human-selection` | Shared glyph complete. |
| COV-013 unread count/title | `complete` | Correctly remains live numeric UI. |
| COV-014 Home navigation/default | `needs-human-selection` | Three-icon family complete. |
| COV-015 Home navigation/compact | `needs-human-selection` | 50px evidence present. |
| COV-016 developer clock | `complete` | Development-only live controls need no art. |
| COV-017 drawer common chrome | `needs-human-selection` | Chrome stays CSS; optional shared surfaces await approval. |
| COV-018 drawer close | `needs-human-selection` | Close SVG complete. |
| COV-019 Shop affordable | `needs-human-selection` | Canonical items and Treat complete. |
| COV-020 Shop unaffordable | `needs-human-selection` | Neutral art plus live disabled treatment complete. |
| COV-021 Shop owned/feedback | `needs-human-selection` | Neutral art plus live count complete. |
| COV-022 Pack empty | `needs-human-selection` | Structural and viewport evidence complete. |
| COV-023 Pack available items | `needs-human-selection` | shop/v2 plus pack/v3 complete. |
| COV-024 Pack one/two/three items | `needs-human-selection` | Capacity and insertion QA complete. |
| COV-025 Pack wish select | `needs-human-selection` | Ticket remains text-free; destination stays live. |
| COV-026 Pack waiting/editable | `needs-human-selection` | Same candidate with live state. |
| COV-027 Pack traveling/locked | `needs-human-selection` | Same Pack plus pending lock glyph. |
| COV-028 Album empty | `needs-human-selection` | Explicit zero-Postcard art complete. |
| COV-029 Album populated/development | `needs-human-selection` | Presentation art awaits approval; dev Scenes remain available. |
| COV-030 Album populated/production | `blocked` | Shipping gate false; build strips Scenes. |
| COV-031 Postcard ordinary Scene | `blocked` | Exact-set and rights/shipping gates. |
| COV-032 Postcard companion Scene | `blocked` | Same landmark gates. |
| COV-033 Postcard read/unread | `complete` | Metadata and live badge need no alternate image. |
| COV-034 Postcard message/postmark | `blocked` | Postmark art awaits approval; licensed font remains blocked. |
| COV-035 Souvenir receive/list/detail | `blocked` | Roster, art, selection, and renderer absent. |
| COV-036 Save export/import idle | `needs-human-selection` | Export/import SVGs complete. |
| COV-037 Save import success/error | `complete` | Live notice is correct; no unique art. |
| COV-038 Persistence load failure | `complete` | Live status is correct; no error illustration. |
| COV-039 responsive 320px | `needs-human-selection` | Defined minimum-width grids complete. |
| COV-040 responsive 390×844 | `needs-human-selection` | Defined common-width grids complete. |
| COV-041 responsive 430×932 | `needs-human-selection` | Defined common-width grids complete. |
| COV-042 responsive 470px/desktop inset | `complete` | Shell/chrome remain CSS. |
| COV-043 reduced motion | `complete` | Static art needs no alternate. |
| COV-044 PWA launcher | `needs-human-selection` | Candidate A/B suites complete. |
| COV-045 future Portrait chooser | `blocked` | Issue #2 policy plus catalog/chooser decision. |

## Canonical ownership and supersession

The starter-item ownership chain is unambiguous:

1. `docs/art/candidates/shop/v2/` is the sole canonical candidate family for all eight current `STARTER_ITEMS`.
2. `docs/art/candidates/pack/v3/` consumes only `shop/v2/masters/`; all eight actual hashes match.
3. `docs/art/candidates/shop/v1/` is superseded by shop/v2.
4. `docs/art/candidates/postcard-gifts/v1/masters/items/` is **superseded for starter-item product content**. Those eight files must never be promoted to Shop or Pack paths. Its dried-fish Treat and presentation assets remain valid review candidates.
5. `docs/art/candidates/pack/v2/` is **superseded for product content** because it used the postcard-gifts duplicates. Pack/v3 retains only v2's capacity, containment, z-order, physical-occlusion, and visibility method.

Evidence:

- `docs/art/candidates/shop/v2/manifest.v2.json`
- `docs/art/candidates/shop/v2/data-key-image-mapping.v2.json`
- `docs/art/candidates/pack/v3/manifest.v3.json`
- `docs/art/candidates/pack/v3/placement-transforms.v3.json`
- `docs/art/candidates/pack/v3/supersession.v3.json`
- `docs/art/candidates/pack/v3/qa-report.v3.json`

Other scope-specific supersession:

- Home v1 is the initial direction sheet; v2 supersedes it.
- Home v2 remains provenance for the selected flattened direction; v3 is the canonical layered foundation.
- Home v4's cabinet memo placement is superseded by v5's Windowsill placement. V5 still reuses the v4 memo/tray source bytes.
- Home v5 eat evidence is superseded by v6. V5 sleep/play/away/collectible evidence remains active.
- The old 48-scene Minho composite approval is explicitly superseded because the approved Portrait bytes changed. The current 48-scene composite sheets exist but need a new approval.

## Responsive, time, physics, and cat closure

### Home

- v3 has one stable interior, four exterior plates, three lighting overlays, and four reconstructions that are pixel-exact to the approved v2 review sources.
- v5 supplies sleep, play, eat, away, and collectible-ready at 320×700, 390×844, and 430×932.
- v6 is the canonical eat correction at all three widths: exactly two vessels remain, water-bowl delta is zero, changed pixels outside the declared patch are zero, and minimum rug-edge clearance is 9.439px.
- The supported memo has 4.411/5.424/6.199px minimum support margins at 320/390/430.
- The Treat tray has 5.064/6.227/7.116px minimum support margins at 320/390/430.

### Shop, Pack, and Postcard

- Shop v2 covers 320/390/430, all eight IDs, 46px legibility, affordability, shortfall, and owned-count states.
- Pack v3 covers empty, populated, selected, and scroll at 320/390/430, while validating three physical slots and shop/v2 hashes.
- Postcard-status covers unavailable Postcard and Album-empty at 320/390/430.
- Adoption covers 320 validation/keyboard, 390 default, and 430 transition.
- Both system-state candidates cover 320/390/430 with zero layout jump.

### Ten cats

The ten identities are Minho plus golden shaded, blue-golden shaded, solid blue, blue-white bicolor, orange tabby, Li Hua, Maine Coon, Ragdoll, and Siamese.

- 60/60 required pose masters exist: 6 production Minho plus 54 candidate masters.
- British Shorthair v2: 72/72 identity × pose × viewport slots pass.
- Domestic Shorthair v2: 36/36 pass.
- Silhouette Variety v2: 54/54 pass.
- Cross-time primary: 120/120 ten-cat × activity × time cells pass at 390×844.
- Cross-time late-night responsive stress: 18/18 pass at 320×700 and 430×932.
- Morning/noon/dusk/late-night lighting is applied above the cat, avoiding bright pasted cutouts.
- No universal brightening overlay was needed or generated.

This is complete candidate evidence, not permission to ship the nine invented identities. Issue #2 remains the controlling content-policy blocker.

## Genuine blockers and selection gates

Only these gates remain; none is another image-generation assignment.

### Human visual selection/approval

- Approve the canonical Home stack: v3 foundation, v5 sleep/play/away/collectible, v6 eat, and cross-time QA.
- Approve shop/v2.
- Approve pack/v1 structure plus pack/v3 canonical population.
- Approve postcard-gifts presentation/Treat while excluding its starter-item duplicates.
- Approve postcard-status postmark, unavailable fallback, and Album-empty.
- Choose app-identity Candidate A or B.
- Approve adoption/v1.
- Choose system-states letter-tray or house-box.
- Approve UI surfaces and utility glyphs.
- Approve the exact current 48-scene Minho composite sheets.
- Select the 13 new v3 landmark scenes before 61-scene composite QA.
- If issue #2 changes, select/approve the nine candidate cat identities.

### Blocked decisions

- **Souvenirs:** lock destination-to-Souvenir roster, IDs, names, cultural/rights briefs, selection behavior, and Album behavior.
- **Landmarks:** close global provenance, similarity, trademark, destination permission/counsel, exact-set approval, and explicit shipping gates.
- **Font:** choose a licensed offline handwriting/stamp family and record provenance before subsetting.
- **Portrait policy:** explicitly change issue #2 before any invented preset cat is promoted.

### Integration after approval

After the corresponding approvals, integration can proceed without another generation batch:

- promote selected assets and create production manifests/runtime derivatives;
- replace Home CSS scenery, Note, tray, characters, and activity placement;
- export only shop/v2 items to `public/assets/items` and render `item.imageSrc`;
- implement Pack base → items → rim compositing;
- integrate loading, adoption, Postcard status/presentation, Album-empty, surfaces, and glyphs;
- replace favicon/Apple/PWA icons;
- fix the pre-existing caption/focus contrast advisories while integrating;
- add font, Portrait chooser, or Souvenirs only after their blocking decisions.

## Candidate hygiene

Current candidate hygiene is **not clean**. Do not commit the following 14 artifacts. They are not referenced by active manifests or hash ledgers.

### Finder/cache debris

- `docs/art/candidates/home/v3/.DS_Store`
- `docs/art/candidates/home/v5/scripts/__pycache__/build_v5.cpython-314.pyc`
- `docs/art/candidates/pack/v1/source/__pycache__/build_pack_candidate.cpython-314.pyc`

Safe cleanup: delete the exact `.DS_Store` and the two containing `__pycache__/` directories. Rebuild Python packs with `PYTHONDONTWRITEBYTECODE=1`.

### Shop v1 stale intermediates

- `docs/art/candidates/shop/v1/masters/item--snack--fish-biscuit--master-512--non-shipping-v01.png.tmp`
- `docs/art/candidates/shop/v1/masters/item--snack--travel-tin--master-512--non-shipping-v01.png.tmp`
- `docs/art/candidates/shop/v1/masters/item--toy--small-bell--master-512--non-shipping-v01.png.tmp`
- `docs/art/candidates/shop/v1/masters/item--toy--small-blanket--master-512--non-shipping-v01.png.tmp`
- `docs/art/candidates/shop/v1/masters/item--toy--small-camera--master-512--non-shipping-v01.png.tmp`
- `docs/art/candidates/shop/v1/masters/item--toy--small-telescope--master-512--non-shipping-v01.png.tmp`
- `docs/art/candidates/shop/v1/masters/item--toy--yarn-ball--master-512--non-shipping-v01.png.tmp`
- `docs/art/candidates/shop/v1/masters/item--wish--ticket--master-512--non-shipping-v01.png.tmp`
- `docs/art/candidates/shop/v1/reviews/contact-sheet--shop-products-and-states--1200x1600--non-shipping-v01.png.tmp`
- `docs/art/candidates/shop/v1/reviews/shop-review--390x844--affordable-owned-top--non-shipping-v01.png.tmp`
- `docs/art/candidates/shop/v1/reviews/shop-review--430x932--unaffordable-owned-bottom--non-shipping-v01.png.tmp`

These `.tmp` files are byte-different from their manifest-listed final counterparts, but they are unmanifested stale logical duplicates inside already-superseded shop/v1. Safe cleanup is to delete only these exact `.tmp` paths; do not replace a final file and do not promote shop/v1.

No current `.tools`, virtualenv/site-packages tree, `*.dist-info`, `node_modules`, native library, or extra debug/diagnostic PNG remains.

The full byte-duplicate scan found only three intentional groups:

- Home v2 noon preview equals its documented noon reference.
- postcard-gifts immutable before/after ledgers match.
- postcard-status immutable before/after ledgers match.

## Verification

- Audit directory expected set: `README.md`, `asset-audit.v2.json`.
- JSON target: 19 asset needs and 45 screen states.
- No `launch-now` image/art batch.
- No app/code/production edit.
- No candidate-art edit or deletion.
- No git-history change or commit.

Exact hashes for every hygiene finding and the complete machine-readable matrices are in `asset-audit.v2.json`.
