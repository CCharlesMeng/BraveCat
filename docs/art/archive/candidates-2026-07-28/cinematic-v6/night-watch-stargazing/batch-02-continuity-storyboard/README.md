# Cinematic v6 — Night Watch Stargazing — Continuity Storyboards

- Status: low-fidelity, non-shipping story/content review
- File: `storyboard--continuity-v01.png`
- Dimensions: 1448 × 1086 px, 8-bit RGB PNG
- Generation method: OpenAI built-in `image_gen`, reference-based identity/setting continuation
- Inputs: the four batch-01 Scene candidates plus the existing Minho watercolor pose contact sheet
- SHA-256: `10f44cda668b36195577239460751c2494aa951f89612e65ac6c507be62cfde9`

This storyboard intentionally tests story continuity before individual high-quality
Scene production. It does not replace the Cat-free masters and must not enter the
production Catalog.

## v02 — Cat-eye Perspective and Physical Scale

- File: `storyboard--continuity-v02-cat-eye-perspective.png`
- Dimensions: 1254 × 1254 px, 8-bit RGB PNG
- Generation method: OpenAI built-in `image_gen`, rebuilt from the Minho identity anchor after two reference-heavy edit calls failed to return
- SHA-256: `30bedae91225fcc382f06980a78736f4f1fedf32eedb875a575b7cc33ed5d316`

### v02 review findings

- Pass: all four views are near ground level and read closer to a second cat's eye height.
- Pass: Minho remains quadrupedal/natural and is substantially smaller relative to doors, railings, train, paving, bench, and dome.
- Pass: paving convergence, foreground scale, contact shadows, and facility massing make the world feel human-sized rather than miniature.
- Pass: the compact olive pack is proportionally plausible and moves from harness to ground to under-bench storage.
- Pass: station, uphill route, dome, mountains, railings, and lighting continue across the four beats.
- Needs decision: panel 3 now reads as a sheltered platform looking across toward the dome, not a platform immediately beside the dome. This improves depth and scale but weakens the original “arrived beside the dome” beat.
- Needs decision: panel 2 uses a prominent generic windsock/ribbon as the wind cue; decide whether that ordinary device is visually too dominant.
- Still non-shipping: no separate Postcard crops, deterministic approved Portrait composites, final Perch QA, originality blind test, rights decision, or shipping gate.

### v02 final prompt

```text
Use case: identity-preserve
Asset type: new low-fidelity 2x2 continuity storyboard for physical-scale review, non-shipping
Input image: exact Minho identity and natural pose anchor.
Create one chronological 2x2 rough watercolor-pencil storyboard of the same silver-beige tabby Minho traveling through one connected fictional mountain observatory. Every panel is viewed from another cat's eye level, camera 35 cm above the ground, level rectilinear 35 mm-equivalent lens, with strong but natural paving convergence and realistic human-scale architecture. Doors are 7–9 times cat shoulder height; railings are 3–4 times shoulder height. The environment must feel large, not like a dollhouse.
Top-left twilight: small Minho, only 8–10% of panel height, naturally walking on four paws away from a plain rail car. A compact olive harness pack sits below back height. Far uphill the same dome and lamp path are visible.
Top-right early night: small Minho, 8–10%, all four paws down, sniffing the crosswind beside a low fluttering ribbon and ordinary wind instruments. The station remains visible far below; the same dome is closer ahead. No reaching or standing.
Bottom-left deep night: tiny distant Minho, 4–6%, seated in the natural gaze pose on a safe sheltered platform inside the railing. The compact pack sits beside Minho; corridor and station lights remain behind; same dome nearby.
Bottom-right dawn: closer but still correctly scaled Minho, 14–18%, curled in the natural sleep pose on a supported 40–45 cm-high stone bench under a canopy. Pack under bench. Same dome, platform, corridor, mountains, one tiny cleaner and plain cart remain behind.
Keep exactly the same facility across panels: same dome, stonework, lanterns, railing, mountain ridge and route. Lighting progresses lavender twilight, cool night, deep indigo, peach dawn. Thin neutral gutters, no text.
Physics: paws and body have real contact shadows; safe dry surfaces; coherent vanishing points; realistic steps, doors, railings, bench supports and load size.
Style: intentionally rough, simplified low-detail storyboard, not polished final art.
Avoid: upright anthropomorphic cat, bipedal pose, giant cat, giant bag, human-height camera, fisheye, Dutch angle, warped perspective, disconnected locations, second cat, text, logo, UI, watermark, sci-fi, spectacle, danger.
```

## Continuity design

- The same Minho and olive-green satchel recur in all four panels.
- The same dome, stone facility, lanterns, railing, mountain ridge, rail car, and
  uphill route establish one connected geography.
- Panel 2 retains the station below and moves closer to the dome.
- Panel 3 retains the wind corridor and instruments behind Minho.
- Panel 4 retains the dome, platform, corridor entrance, and mountain silhouette.
- The action chain is arrival in wind → reading wind direction → finding the
  sheltered gaze platform → sleeping there after dawn.

## Review findings

- Pass: the four images now read as one journey rather than four independent mood pieces.
- Pass: Minho and the satchel provide a continuous protagonist and prop.
- Pass: lighting advances from twilight through night to dawn.
- Pass: prior locations remain visible in later panels.
- Needs decision: Minho is too anthropomorphic/upright in panels 1 and 2; panels 3
  and 4 follow the approved natural cat poses more closely.
- Needs decision: the draft is more detailed than a pure thumbnail storyboard, but
  it remains a single review sheet and has not been split into production Scenes.
- Not tested: exact Portrait compositing, final Perch geometry, contact shadows,
  postcard crop, blind originality review, rights approval, or shipping gate.

## Final prompt

```text
Use case: identity-preserve
Asset type: low-fidelity 2x2 continuity storyboard for BraveCat cinematic v6; content review only, non-shipping
Input images: Image 1 is the mountain station setting reference; Image 2 is the wind corridor setting reference; Image 3 is the dome platform setting reference; Image 4 is the dawn rest terrace setting reference; Image 5 is the exact Minho character identity and pose anchor.
Primary request: Rebuild the four scenes as one coherent chronological 2x2 storyboard. Prioritize complete story information, recurring geography, character identity, prop continuity, and readable actions over finish quality. This is deliberately a rough first-pass storyboard, not polished concept art.
Subject continuity: The same Minho from Image 5 appears in every panel with the same silver-beige tabby markings, round body, green eyes, proportions, and gentle personality. Do not redesign Minho. The same small olive-green canvas travel satchel appears in every panel, with a tan flap, two tan buckle straps, and a rolled cream blanket attached on top, always at the same physically plausible size. No other cat or animal.
Geographic continuity: Use one fictional facility across all panels: the same plain stone walls, same simple dome, same warm lantern design, same railing, same mountain silhouette, same station rail car, and the same uphill path. Each later panel must visibly retain at least one location or object from the prior panel so the journey reads as movement through one connected place.
Panel 1, top-left, twilight arrival: Minho steps down from the same plain mountain rail car carrying the green satchel. Crosswind pushes at the satchel strap and Minho pauses on the broad safe platform. Far uphill, the dome and a chain of warm lamps are clearly visible as the destination.
Panel 2, top-right, early night transit: Minho, still carrying the same satchel, pauses beside the low wall bench and studies ordinary wind vanes to understand the wind direction. Through the open rear view, show the station rail car and platform lights from panel 1 far below; ahead, the same dome is visibly closer.
Panel 3, bottom-left, deep-night discovery: Minho has reached the sheltered platform beside the same dome. The green satchel rests immediately beside Minho. Minho uses the recognizable gaze pose from Image 5 to look at the ordinary starry sky. Behind Minho, show the same wind corridor and instruments from panel 2, with station lamps tiny far downhill.
Panel 4, bottom-right, dawn aftermath: On a supported stone bench under the canopy beside the same dome, Minho sleeps curled in the recognizable sleep pose from Image 5, with the same green satchel tucked beside the bench. In the background retain the same viewing platform, railing, corridor entrance, and mountain silhouette from panel 3; one tiny cleaner and one plain cart recede as the night shift ends.
Style/medium: intentionally rough colored-pencil and light watercolor storyboard; visible loose construction lines; simplified architecture; broad muted color blocks; low surface detail; consistent shapes and palette across all four panels. Do not render as four unrelated finished paintings.
Composition/framing: one image with four equal landscape panels in a clean 2x2 grid, read top-left to top-right to bottom-left to bottom-right. Thin neutral gutters only. Keep Minho clearly readable in every panel while still varying from medium arrival, medium transit, distant gaze, to close sleep.
Lighting progression: lavender twilight -> cool early night -> deep indigo night -> pale peach dawn. Preserve the same mountain horizon and facility materials through the changes.
Constraints: preserve Minho identity and satchel design exactly across panels; original fictional place; no dialogue, captions, panel numbers, readable text, pseudo-text, signs, logos, badges, UI, postcard border, stamp, watermark, famous observatory, film still composition, recognizable franchise cues, robots, spacesuits, aliens, hero mission, celebration, rescue, danger, or fixed NPC protagonist.
Avoid: four disconnected locations; changing Minho markings or body shape; changing satchel color or design; disappearing dome; new architecture between panels; isolated close-ups without geographic context; polished final rendering; photorealism; cinematic spectacle.
```
