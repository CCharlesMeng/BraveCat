# BraveCat silhouette-variety cat candidates v1

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** These are static app-art candidates, not Codex pet spritesheets and not production portrait assets.

## Contents

- Three deliberately contrasting identities: Maine Coon (缅因), Ragdoll (布偶), and Siamese (暹罗).
- The complete current six-pose app convention for each identity: `sit`, `sleep`, `walk`, `eat`, `play`, and `gaze`.
- 1024×1024 transparent RGBA masters and 256×256 transparent runtime-review derivatives.
- Breed contact sheets, a Minho-relative silhouette/anchor/scale comparison, and 390×844 plus 430×932 approved-room review mockups.
- Morphology, coat-map, anchor, physical-scale, layout, provenance, hash, and QA metadata.

## Review boundary

Nothing in this directory is shipping-eligible. The source cat PNGs contain no text, UI, scenery, floor patch, baked shadow, or watermark. A simple bowl in `eat` and a grounded yarn ball in `play` are pose-integrated convention props. Labels and room scenery occur only in review artifacts.

The Maine Coon is reviewed at 1.22× Minho, the Ragdoll at 1.10×, and the Siamese at 0.82×. All use a bottom-center master anchor at `(512, 960)`; the approved home-room review anchor remains `(690, 1395)` on the 1200×1600 room canvas.

Large-cat implication: preserve the documented physical scale and use the wider room activity zone. Do not force every breed into Minho's 420 px review canvas. At the reviewed 512 px Maine Coon canvas, all six silhouettes remain inside the room activity zone without furniture collision or impossible shrinkage.

Stop here for visual approval. No app code, production Minho file, other candidate directory, or git history is changed by this pack.
