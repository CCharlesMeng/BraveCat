# Generation brief v1

Built-in image generation was used once per individual/pose. Each non-sit call used that individual's generated sit as the identity authority, `docs/art/style-ref-poses.png` as the watercolor/pose-readability reference, and the matching production Minho pose as anatomy/canvas convention only.

## Shared prompt

> Create exactly one full-body British Shorthair static app-art pose. Preserve a cobby/stocky torso, short sturdy legs, round head, small rounded ears, dense plush coat, and thick continuously attached tail. Use restrained low-saturation storybook watercolor, fine warm gray-brown contour, dry-brush plush texture, quiet contrast, and soft pigment edges. Keep a natural head-to-body ratio; do not make a chibi kitten or photoreal cutout. Enforce believable load-bearing paws, limb occlusion, spine/tail continuity, four limbs only, stable center of gravity, and no clipping or floating. Place the complete subject with generous padding on one perfectly uniform flat magenta chroma plate. No text, UI, scenery, floor, floor patch, cast/contact shadow, watermark, collar, accessories, motion marks, or detached effects.

Eating allows one low ceramic bowl on the paw baseline. Play allows one muted yarn ball in direct paw contact with only a short attached thread.

## Identity locks

- **Golden shaded / 金渐层:** young petite-cobby female; warm cream-gold undercoat; charcoal crown/back/flank tipping and dark tail tip; emerald eyes; dark rose nose; modest cheeks.
- **Blue-golden shaded / 蓝金渐层:** mature broad-chested male; pale honey undercoat with cool blue-gray veil and charcoal-blue tail tip; muted olive eyes; brick-rose nose; broad jowls and darker brow arcs.
- **Solid blue / 蓝猫:** older, largest heavy-cobby male; uniform slate-blue coat with no stripes or white; copper eyes; dark gray nose; massive jowls, tiny wide-set ears, and very thick tail.
- **Blue-white bicolor / 蓝白:** young athletic-cobby female; amber eyes and pink nose; blue cap above centered white inverted-V blaze; blue upper-back saddle; white muzzle/chest/belly/legs; one rounded left-shoulder spot; blue tail with a small white tip.

## Pose briefs

- `sit`: upright alert, paired forepaws and haunches grounded, tail wrapped along the baseline.
- `sleep`: curled crescent/oval rest, cheek or head on forepaws, hindquarters tucked, tail following the body.
- `walk`: grounded walking-ready gait, one modest forward step and three-leg support/transition, level compact spine.
- `eat`: low standing or crouched interaction with one bowl; neck, shoulders, paws, muzzle, and bowl rim remain physically coherent.
- `play`: individual-appropriate grounded play posture with one forepaw touching yarn; support paw and hindquarters stay loaded.
- `gaze`: seated attentive upward turn with a believable spinal/neck twist, grounded haunches, readable profile eye, and low tail support.

## Export calibration

Generated chroma plates were converted to soft transparent alpha, desaturated slightly by coat family, normalized to `1024×1024` with a `64 px` minimum safe margin and `(512, 960)` baseline, then downscaled to `512×512` review derivatives. Cat pixels were generated; local code only performed alpha extraction, normalization, labeling, and compositing.
