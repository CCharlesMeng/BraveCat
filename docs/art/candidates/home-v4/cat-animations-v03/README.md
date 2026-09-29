# Home cat animations v03

> 2026-09-29 当前决策：用户已批准全部现有素材，见 `docs/art/reviews/all-existing-assets-approval-2026-09-29.json`。下文旧日期的待用户审批描述保留为历史；剩余生产/接入/技术验证事项见 `docs/plans/next-step-plan-2026-09-29.md`。


This development-preview revision preserves the approved Minho v02 artwork and
changes only temporal continuity and frame registration.

- `sleep` increases to 128 frames; `play`, `eat`, and `gaze` use 64 frames.
- Every animated WebP page uses one fixed transparent `512×512` canvas.
- The first approved frame keeps its original placement. The other seven source
  keyframes are integer-shifted to the same ground anchor before interpolation.
- Sleep is rebuilt from its approved resting frame: only a feathered abdomen
  region breathes, while the head, back, paws, tail, silhouette, and ground
  anchor remain locked. Other intermediate frames use bidirectional
  motion-compensated interpolation rather than opacity crossfades. `gaze` keeps
  all pixels below the head alpha-locked.
- The app renders the animated WebP as one image, removing responsive
  `background-position` rounding from the frame path.
- Reduced-motion users receive the matching `--poster--v03.webp` first frame.

Evidence:

- `manifest.candidate.json` records source hashes, keyframe shifts, anchor
  measurements, frame count, duration, output hashes, and continuity deltas.
- `contact-sheet.png` shows the eight registered source keyframes for each row.
- `motion-contact-sheet.png` shows 16 evenly spaced samples per activity at
  approximately in-app cat size.

Rebuild candidates with `npm run assets:build-home-cat-animations`. Pass
`-- --integrate` to copy byte-identical validated assets into the runtime
development-preview directory.
