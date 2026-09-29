# Open Pack Watercolor Candidate v1

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** Nothing in this directory is approved for production, runtime use, or integration. Stop for visual approval.

## Scope

This isolated candidate pack proposes an opened interior for the approved v3 navigation satchel. The design keeps the same muted sage woven shell, ochre-tan leather flap and straps, antique-brass buckles, and left-side rolled blanket. The flap is lifted behind a lined cavity with three organizing zones and a broad foreground shell that can occlude inserted item assets.

No app code, home/shop/postcard candidate directory, production asset, Minho asset, landmark, or postcard composition was changed.

## Current UI inventory

- `PACK_CAPACITY` is 3. A pack can hold three unique items and at most one wish ticket.
- The initial economy has 12 treats, no owned items, and an empty pack, so the actual first pack state is `0 / 3` with no available items.
- The current pack drawer is text/card based. It has no bag illustration and does not render `item.imageSrc`.
- Packed and available rows use a CSS `46×46` token containing the first Chinese character of the item name.
- Empty sections are dashed CSS boxes. The pack summary, cards, buttons, select, drawer, handle, and backdrop are CSS UI.
- Emoji remain in unrelated current UI: the top treat balance, windowsill fish, and shop price action. The pack drawer itself uses character tokens rather than emoji.
- Add/remove actions are disabled while traveling. The drawer content scrolls vertically.
- There is no standalone selected-item or detail state. The only item-specific detail control is the inline wish-destination `<select>` on an available ticket card.
- Catalog paths exist for eight item PNGs, but those files are absent from this worktree and the current pack UI does not use them.

## Layer contract

1. `z00` — `masters/pack-opened-base--master-1536--non-shipping-v01.png`
2. `z10` — real existing item assets supplied by the application; none are included in this pack
3. `z20` — `masters/pack-opened-foreground-rim--master-1536--non-shipping-v01.png`
4. `z30` — live UI count, copy, focus, buttons and badges

The base is deliberately a complete one-layer fallback. When items are added at `z10`, they may temporarily cover the base's front shell; the pixel-aligned `z20` shell/rim restores the physical occlusion. See `composition-metadata.v1.json` for exact slot bounds, bottom-center anchors, safe padding, overlay zones, and derivative mapping.

## Transparent art

- `source/pack-opened-source-generated-v01.png` — cleaned 1024×1024 RGBA generated source
- `masters/pack-opened-base--master-1536--non-shipping-v01.png`
- `masters/pack-opened-foreground-rim--master-1536--non-shipping-v01.png`
- `runtime/pack-opened-base--css-342--non-shipping-v01.png`
- `runtime/pack-opened-foreground-rim--css-342--non-shipping-v01.png`
- `runtime/pack-opened-base--css-382--non-shipping-v01.png`
- `runtime/pack-opened-foreground-rim--css-382--non-shipping-v01.png`

The 342 px and 382 px review derivatives come from the current drawer border-box widths at 390 px and 430 px viewports (`viewport width - 2 × 24 px drawer padding`). They are review-only, not a final density policy.

## Static reviews

Both 390×844 and 430×932 are provided for:

- `empty` — real initial `0 / 3` state
- `populated` — three filled anchors and `3 / 3`
- `selected-inline-detail` — the actual inline wish destination control, explicitly not a nonexistent standalone detail screen
- `overflow-scroll` — the current fixed drawer header plus vertically scrolled drawer content

Review item images are temporary crops of the existing non-final calibration item board and appear only inside flattened review composites. This pack emits no standalone item files and does not redefine shop products.

`reviews/contact-layer-sheet--1200x1600--non-shipping-v01.png` shows the empty base, populated depth test, isolated foreground rim, layer order, and findings.

## QA and approval gate

`qa-report.v1.json` records RGBA mode, alpha extrema, partial-alpha edge counts, zero RGB under fully transparent pixels, content padding, physical-depth findings, mobile legibility, and known limitations. Human approval remains required, especially for residual fringe color and final drawer placement.

Do not promote, integrate, rename as production, or treat this candidate as approved until the user explicitly selects it.
