# Cinematic v6 — Interior Revision v04

- Status: low-fidelity, non-shipping review
- Approved carry-forward Scene 01: retained canonically as selected Scene 01
- New Scene 02: retained canonically as selected Scene 02
- New Scene 03: retained canonically as selected Scene 03
- Current Scene 04: retained canonically as selected Scene 04
- Earlier Scene 04 sunrise/treats draft: `scene-04-interior-rest-v05-sunrise-treats-draft.png`
- Method: OpenAI built-in `image_gen`, one Scene per call

The four canonical selected files live under
`docs/art/candidates/cinematic-v6/night-watch-stargazing/selected-four-act-v01/`.
Their original batch filenames and verified hashes are recorded in the
2026-07-28 candidate archive README.

## Review

- Scene 02 replaces the repetitive corridor with a low cat-following stair climb.
- Scene 03 moves inside the exact dome and gives Minho a supported, reachable
  telescope eyepiece.
- Scene 03 known defect: the single olive pack is duplicated on Minho and on the
  floor. A targeted remove-only edit did not return. This must be fixed before any
  approval or higher-quality rendering.
- Scene 04 now uses Scene 02 as the Minho and travel-pack continuity anchor.
  Minho sleeps on the supported bench with the single matching pack held as a
  pillow; the former under-bench pack is removed. The sunrise, treats, arch/stair,
  telescope-room connection, cleaner and maintenance cart remain visible.

## Scene 02 final prompt

```text
Use case: identity-preserve
Asset type: revised Scene 02 low-fidelity 4:3 landscape storyboard draft, non-shipping
Input images: Image 1 is the approved Scene 01 and locks the rail station, same observatory, lanterns, mountains, stone materials, mustard-coat traveler, blue suitcase, Minho pack and rough watercolor-pencil style. Image 2 locks Minho identity and natural anatomy.
Continue immediately after Scene 01, but use a distinctly different composition: a steep yet realistic long stone stair climbing directly from the station level toward the observatory. Do not repeat the broad platform, train-side walking, wind ribbon, or corridor composition.
Camera is extremely low, 20–25 cm above a lower stair tread, positioned behind and slightly below Minho like another cat following. Level rectilinear 35 mm perspective; repeating stair risers, side walls, handrails and lamp posts create strong upward convergence. The same simple dome looms much larger at the top of the climb.
Minho is a small natural quadruped with the same compact olive pack, actively climbing on four paws with weight distributed believably across different stair treads. Tail balances naturally. No upright pose.
Keep only restrained fellow-traveler continuity: the same mustard-coat traveler and dark-blue wheeled suitcase are much farther ahead on a broad landing, with the suitcase being carefully lifted or carried over the steps rather than impossibly rolled; the second traveler is near the upper doorway. They remain minor scale references and do not look back at Minho.
Show a sliver of the station lamps far below through the lower opening, but no prominent rail car. Early-night indigo sky, warm stair lamps, increasing shelter near the dome.
Style: same rough simplified watercolor-and-colored-pencil storyboard, muted color, loose construction lines, low detail.
Physics: uniform plausible riser heights; wide dry treads suitable for a cat; handrails anchored; humans and suitcase contact correct treads; paws grip tread planes; Minho stays away from exposed edges; coherent vanishing points and human/cat scale.
No wind ribbon, no repeated station composition, no flat corridor, no giant cat, upright cat, giant pack, second cat, crowd, people watching cat, text, signs, logo, UI, watermark, famous observatory, sci-fi, spectacle, danger, fisheye, Dutch angle, human-eye-height view or warped stairs.
```

## Scene 03 final prompt

The successful prompt specified the same dome interior, a plain telescope on a
floor-anchored central pier, a 40 cm-high supported observation platform, a side
eyepiece 25–30 cm above the platform, Minho on four supported paws, an ordinary
star field through the roof slit, and one distant operator. It prohibited unsafe
perches, ladders, famous telescope shapes, text, branding, sci-fi and spectacle.

The generated image violated the single-pack invariant; it remains a draft only.
