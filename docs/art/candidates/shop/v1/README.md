# Shop Watercolor Candidate Pack v1

**NON-SHIPPING / VISUAL-REVIEW-ONLY.** Nothing in this directory is approved for runtime use or app integration. This pack only replaces the visible product-token placeholders in review imagery; it does not change app code, production assets, home candidates, Minho, landmarks, or postcard composition.

## Source inventory

The current shop is driven by `STARTER_ITEMS` in `src/lib/assets/starterItems.ts` and rendered by the shop branch in `src/App.svelte`.

- Snack, price 4: `fish-biscuit` / 小鱼饼.
- Snack, price 4: `travel-tin` / 旅行罐头.
- Toy, price 6: `small-blanket` / 小毛毯.
- Toy, price 6: `yarn-ball` / 毛线球.
- Toy, price 6: `small-bell` / 小铃铛.
- Toy, price 6: `small-camera` / 小相机.
- Toy, price 6: `small-telescope` / 小望远镜.
- Wish, price 8: `ticket` / 车票.

The initial economy has 12 Treats and no owned items, so all eight products are initially affordable. Every product remains listed after purchase.

## Existing states and placeholders

- Normal / affordable: the purchase button is enabled and shows the live price plus the current fish emoji.
- Unaffordable: the same button is disabled and changes to live `还差 N` text.
- Purchased / owned: purchase subtracts Treats and increments the live `家里有 N 件` count. There is no separate owned badge, sold-out state, or art overlay.
- Locked: the current shop has no product-lock state. Travel only locks pack editing elsewhere, so this pack does not invent a shop lock, lock icon, or locked-product treatment.
- Product image placeholder: `.item-token` is a 46×46 CSS rounded tile containing `item.name.slice(0, 1)`, a Chinese character.
- Product cards, token tile, action pills, drawer, labels, descriptions, prices, and owned counts are CSS geometry or live text.
- The top balance and affordable purchase labels currently use `🐟`.
- Each item declares an `imageSrc`, but `App.svelte` does not render it and `public/assets/items/` does not exist on this branch.

## Candidate exports

Each of the eight products has:

- a 512×512 straight-alpha RGBA, embedded-sRGB master in `masters/`;
- a 92×92 RGBA derivative in `runtime/`, intended to render at the actual 46×46 CSS token slot on a 2× display.

The family uses restrained sage, warm wood/ochre, and off-white watercolor with thin warm gray-brown linework. Sources contain no labels, prices, letters, emoji, UI chrome, square backgrounds, cats, people, logos, or watermarks.

No blank card, shelf, lock, or purchase-state accent was added. The existing reusable CSS card and drawer remain functional; the only disconnected visual placeholder is the product token itself.

## Review evidence

- `reviews/shop-review--390x844--affordable-owned-top--non-shipping-v01.png` shows the top of the real catalog with 12 Treats, enabled prices, and representative owned counts.
- `reviews/shop-review--430x932--unaffordable-owned-bottom--non-shipping-v01.png` shows the lower catalog with 3 Treats, disabled `还差 N` actions, and representative owned counts.
- Together, the two mobile reviews show all eight current products in catalog order.
- `reviews/contact-sheet--shop-products-and-states--1200x1600--non-shipping-v01.png` compares all products and the applicable normal, unaffordable, and owned treatments.
- `reviews/transparency-edge-qa--1200x900--non-shipping-v01.png` checks the transparent exports across split sage and off-white placement backgrounds.

## QA summary

- All masters are 512×512 RGBA with alpha range 0–255, embedded sRGB, zero RGB in fully transparent pixels, and at least 55 px visible safe margin.
- All derivatives are 92×92 RGBA and remain recognizable when placed at 46×46 CSS px.
- Review composites are opaque embedded-sRGB PNGs at their named dimensions.
- Visual inspection passed silhouette readability, family color consistency, compact physical grounding, safe-area clearance, and absence of accidental text or watermarks.
- The generated contact washes were normalized to restrained translucent warm shadows; the split-background sheet remains the approval evidence for edge quality.

Stop here for visual approval. No commit, promotion, or integration has been performed.
