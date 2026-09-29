# Domestic Shorthair Static Cat Candidates v1

**NON-SHIPPING / VISUAL-APPROVAL-REQUIRED.** These are static BraveCat app-art candidates, not Codex pet spritesheets. Nothing in this pack is integrated into the app or approved for production use.

## Candidate identities

- `orange-tabby` — substantial medium-large adult orange mackerel tabby; rectangular torso, sturdy moderate-length legs, amber-gold eyes, muted apricot coat, and a long five-ring tail.
- `li-hua` — lean athletic Chinese Li Hua / brown mackerel tabby; longer legs, defined shoulders, wedge-leaning face, yellow-green eyes, and a long active seven-ring tail.

The two cats were generated as separate anatomical identities. They do not share a recolored base.

## Pose coverage

Current app conventions require all six static portrait poses:

- `sit` — upright / alert
- `sleep` — curled sleep / rest
- `walk` — grounded stand / walk-ready
- `eat` — bowl interaction required by the current home activity and portrait catalog
- `play` — yarn interaction required by the current home activity and portrait catalog
- `gaze` — attentive travel / postcard pose

## Artifacts

- `source/<cat>/` — 1024×1024 transparent RGBA masters with at least 64 px safe margin and a shared bottom anchor.
- `runtime/<cat>/` — 512×512 transparent RGBA runtime-review derivatives.
- `reviews/contact-sheets/contact-sheet--two-cats-six-poses--non-shipping-v01.png` — labeled identity, anatomy, and transparency review sheet.
- `reviews/mockups/` — approved-room home composites at 390×844 and 430×932 for each cat.
- `candidate-metadata.v1.json` — identity locks, pose semantics, references, and placement metadata.
- `qa-report.v1.json` — visual anatomy, identity, style, and scale findings.
- `validation.v1.json` — machine checks for dimensions, alpha, margins, and hidden RGB.
- `manifest.v1.json` — file inventory and hashes.

Source art contains no text, UI, scenery, floor patch, baked shadow, border, or watermark. Labels and the approved room appear only in review artifacts.

No app code, production Minho asset, or other candidate directory was modified. Stop here for visual approval.
