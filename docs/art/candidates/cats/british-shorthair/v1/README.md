# British Shorthair Static Cat Candidates v1

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** These are static BraveCat app-art candidates, not Codex pet spritesheets. Nothing in this directory is integrated, promoted, or approved for production.

## App pose contract

Inspection of `src/lib/assets/index.ts`, `src/lib/assets/starterCatalog.ts`, `src/App.svelte`, and the postcard composition code resolves the current complete portrait contract to:

1. `sit` — upright alert
2. `sleep` — curled home/rest state
3. `walk` — grounded standing or walking-ready
4. `eat` — current home eating state
5. `play` — current home playful state
6. `gaze` — postcard/travel attention pose

No `drink` pose exists in the current typed contract. Returned travel presence changes copy and then reuses normal home activity art, so no separate return pose was generated.

## Individuals

- `golden-shaded` / 金渐层 — young petite-cobby female, warm gold shaded coat, emerald eyes, `0.96×` Minho review scale.
- `blue-golden-shaded` / 蓝金渐层 — mature broad-chested male, honey undercoat with cool blue-gray veil, olive eyes, `1.05×` Minho review scale.
- `solid-blue` / 蓝猫 — older heavy-cobby male, uniform slate-blue coat, copper eyes, `1.10×` Minho review scale.
- `blue-white-bicolor` / 蓝白 — young athletic-cobby female, fixed cap/saddle/left-shoulder spot/white-tip marking map, amber eyes, `1.00×` Minho review scale.

The four cats were generated as separate identities, not as one silhouette recolored. Each pose was generated independently with the individual sit image as the identity authority and the matching production Minho pose as anatomy/canvas convention only.

## Exports

- `sources/<individual>/` — six label-free `1024×1024` transparent RGBA PNG masters.
- `runtime/<individual>/` — six `512×512` transparent RGBA PNG review derivatives.
- `reviews/<individual>/` — labeled six-pose contact sheet, unchanged-room `1200×1600` sleep composite, and `390×844` plus `430×932` home mockups.
- `reviews/contact-sheet--all-individuals--identity-comparison--non-shipping-v01.png` — sit/sleep identity and morphology comparison.
- `generation-brief.v1.md` — final shared generator prompt, identity locks, pose briefs, and export calibration.
- `metadata.v1.json` — breed, morphology, coat, Minho-relative scale, baseline/anchor, intended state, and asset paths.
- `qa/alpha-and-layout-report.v1.json` — deterministic size, alpha, hidden-RGB, chroma-removal, bounds, and margin checks.
- `qa/visual-qa.v1.json` — identity, anatomy, physical-law, prop-contact, and home-rug findings.
- `tools/build-review-assets.swift` — deterministic alpha extraction, normalization, derivative, contact-sheet, and mockup builder. It does not draw cat art.

## Source and placement rules

- Masters use a `1024×1024` canvas, minimum `64 px` safe margin, zero RGB under fully transparent pixels, and a bottom-center alpha baseline at `(512, 960)`.
- Runtime-review derivatives use a bottom-center alpha baseline at `(256, 480)`.
- Home mockups preserve the approved v3 noon room unchanged and place sleep art at the established room anchor `(690, 1395)`.
- No source master contains text, UI, scenery, floor patches, baked shadows, watermarks, or detached effects.
- Eating bowls and yarn balls are state-relevant props and physically contact the cat/baseline.

## Visual review

Start with:

1. `reviews/contact-sheet--all-individuals--identity-comparison--non-shipping-v01.png`
2. Each individual six-pose contact sheet
3. Each individual `390×844` and `430×932` home mockup
4. `qa/visual-qa.v1.json`

The open approval question is the naturalistic watercolor detail level: it is intentionally more breed-anatomical than the simplified chibi cat in `style-ref-poses.png`, while retaining restrained color, dry-brush texture, quiet contrast, and soft edges. Stop here for user visual approval; do not integrate or commit.
