# BraveCat asset archive

This directory is the canonical cross-batch inventory. Raw generation outputs and provenance stay under `docs/art/candidates`; approved PNG masters and manifests stay under `docs/art/production`. Optimized landmark derivatives under `public/scenes` are development-only staging and must be stripped from production builds until shipping approval.

- Machine QA: **pass**
- Approved Portraits: **1** (6 poses)
- Landmark candidates: **25 destinations / 61 active scenes**
- Landmark visual review: **approved**
- Minho composite review: **approved**
- Landmark rights review: **review-complete-not-cleared**
- Landmark shipping status: **blocked; rights review completed with open global and destination gates**

Regenerate with `npm run assets:archive`; verify without rewriting with `npm run assets:check`.
