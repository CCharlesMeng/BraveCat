# Candidate archive — 2026-07-28

This archive contains non-active art moved out of `docs/art/candidates/` during
the 2026-07-28 cleanup. The move is organizational: files retained here remain
available for audit, provenance, and manual restoration.

## Archived groups

- `home-display-v1/`: superseded by the promoted Home Display v2 package.
- `unselected/style-intensity/`: standalone A, B, and C calibration sheets.
  The referenced ABC triptych remains under `docs/art/candidates/`.
- `unselected/home-display-v2/`: the superseded postcard-wall v01 candidate.
- `unselected/home-v4/`: an unused interior v01 generation. The noon QA image
  was byte-identical to the retained canonical Home composite and was
  deduplicated rather than stored twice.
- `cinematic-v6/night-watch-stargazing/batch-*`: low-fidelity intermediate
  batches superseded by `selected-four-act-v01`.

## Deduplicated files

Each removed duplicate was verified with SHA-256 immediately before removal.
The retained canonical files are:

| Removed historical path | SHA-256 | Retained canonical path |
| --- | --- | --- |
| `cinematic-v6/night-watch-stargazing/batch-03-sequential-drafts/scene-01-twilight-station-v03-draft.png` | `bbc9e46405bfd5c8579e917421d43364fc1b07c30ba6faa4115189167f6b3ae1` | `docs/art/candidates/cinematic-v6/night-watch-stargazing/selected-four-act-v01/scene-01-arrival.png` |
| `cinematic-v6/night-watch-stargazing/batch-04-interior-revision/scene-02-stair-climb-v04-draft.png` | `619916865c16cdfda1d70118e4e8c28e51cbb802c3e61d228ed18578ecbba9f2` | `docs/art/candidates/cinematic-v6/night-watch-stargazing/selected-four-act-v01/scene-02-ascent.png` |
| `cinematic-v6/night-watch-stargazing/batch-04-interior-revision/scene-03-interior-telescope-v04-draft-a.png` | `debbe5c84121c16839441083cf232e9c278c3cf8739282993648be95ecb8e29e` | `docs/art/candidates/cinematic-v6/night-watch-stargazing/selected-four-act-v01/scene-03-stargazing.png` |
| `cinematic-v6/night-watch-stargazing/batch-04-interior-revision/scene-04-interior-rest-v06-character-pack-continuity-draft.png` | `905796d632695afcd858d629ac12d46c7a51c1b6e092fe2f34da3765de93bc4d` | `docs/art/candidates/cinematic-v6/night-watch-stargazing/selected-four-act-v01/scene-04-dawn-rest.png` |
| `unselected/home-v4/home-composite-noon--candidate-v03--qa.png` | `41e34aa15ca585aa1cf78d53c9488a6a69c13fe650f9736d532dfe97839d61b1` | `docs/art/candidates/home-v4/home-composite--candidate-v03--qa.png` |

## Intentionally not moved

- Landmark historical overview and rejected images remain in place because
  historical QA reports, approval records, integration scripts, and active-set
  integrity checks reference or hash-lock them.
- `home-wall-prototype/layout-plan--variant-c.png` remains a candidate-side
  design record because Home v4 visual remediation explicitly references it.
- Active development and production-derived assets remain under
  `docs/art/candidates/`.
