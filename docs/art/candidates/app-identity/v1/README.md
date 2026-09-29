# BraveCat app identity candidates v1

**Status:** NON-SHIPPING / VISUAL-SELECTION-REQUIRED  
**Batch:** GEN-01 / AA-014  
**Scope:** this directory only; no production icon, Minho, manifest integration, or app-code changes.

This review pack replaces the invented flat-vector orange-white cat concept with two reference-conditioned watercolor marks built from the approved Minho identity. Both use the locked B-intensity art direction, keep their critical mark within the central 80% mask-safe region, and remain text-free.

## Candidates

### Candidate A — Minho + open envelope

Face-dominant frontal Minho with two paws resting inside a restrained cream-and-sage envelope. This is the strongest 32 px identity read: the approved blue-green eyes, silver-shaded forehead, ear shape, and compact face remain primary. The unmarked terracotta seal dot is decorative and intentionally non-critical.

### Candidate B — Minho + postcard home

Compact three-quarter seated Minho inside a folded-postcard home silhouette. This is genuinely different from A: the broad body, thick softly ringed tail, upward gaze, doorway/roof mass, and folded paper threshold carry the mark. It reads as cat + home at 32 px, while facial identity is less dominant than in A.

## Required outputs

Each candidate has:

- one 1024×1024 opaque RGB master with an embedded sRGB profile;
- 512×512 `maskable any`, 192×192 `any`, and 180×180 Apple derivatives;
- simplified opaque 48×48 and 32×32 derivatives;
- central-80%, circle-mask, and squircle-mask proof;
- launcher and install mockups at 390×844 and 430×932.

Shared review files:

- `proofs/selection-board--both--non-shipping-v01.png`
- `proofs/legibility--both--32-48--non-shipping-v01.png`
- `manifest.v1.json`
- `hashes.sha256`
- `qa/generated-validation.v1.json`
- `qa/visual-review.md`

The raster review images contain no labels or pseudo-text. Candidate identity is encoded by left/right order and filenames.

## Production references

The generation pass used the approved production Minho `sit` and `gaze` poses, the approved Minho calibration board, and the three locked art references. The production manifest identity locks remain:

- blue-green eyes;
- silver-shaded coat;
- compact, sturdy, athletic body;
- thick tapered tail with soft rings;
- no accessories.

Raw GenerateImage sources are preserved under `generated/`. The tool returned opaque RGB PNGs without embedded ICC profiles. The deterministic build normalizes every master, derivative, proof, and mockup to opaque RGB with an embedded sRGB profile.

## Rebuild

Run with the existing Pillow environment:

```sh
"/tmp/bravecat-home-art-venv/bin/python" \
  "docs/art/candidates/app-identity/v1/scripts/build_identity.py"
```

The builder uses the preserved local generated sources when Cursor's transient generated-asset copies are unavailable.

## Selection gate

Stop here for visual selection. Choose Candidate A or Candidate B before any production export, icon replacement, PWA manifest change, or app integration.
