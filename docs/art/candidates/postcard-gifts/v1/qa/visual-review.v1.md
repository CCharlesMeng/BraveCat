# Visual QA — postcard + gifts v1

Status: **PASS FOR HUMAN VISUAL REVIEW / NON-SHIPPING**

## Checks

- **Style consistency — pass.** Item objects share one generated source family and the presentation pieces use the same locked B-intensity references: low saturation, warm fine line, muted sage/ochre/faded coral, restrained watercolor texture.
- **Transparency — pass.** Every item and presentation master is RGBA with transparent outer space; fully transparent pixels have zero RGB. Checker, cream, sage, and charcoal review grounds show no opaque rectangle.
- **Physical recognition — pass.** All nine object silhouettes remain distinct in the actual 46 CSS px slot review. The 12 px windowsill Treat is necessarily simplified but keeps the tied-fish silhouette.
- **Text-free source art — pass.** Item masters have no labels/logos. Ticket and tin are deliberately blank. Presentation masters contain no stamp, caption, location, date, postcard image, or Minho.
- **Text-overlay space — pass.** The stack has a broad blank insertion rectangle; the postcard back has open left-copy space and unlabelled address guides; the envelope provides a clear upper insertion zone.
- **Physical layering — pass.** Envelope back → inserted content/object → separate front-pocket layer produces believable occlusion in both receive reviews.
- **Safe areas — pass.** Item alpha bounds retain at least 47 px on every side after antialias filtering (48 px target). Presentation subject and insertion bounds are recorded in placement metadata.
- **Mobile readability — pass.** Six state reviews cover both 390 px and 430 px widths. Primary art, close affordance, headline, and action remain inside mobile safe margins.
- **Immutable content — pass.** Before/after SHA-256 lists match for scoped app, postcard, Minho, landmark, runtime scene, production, and pre-existing candidate/review files.

## Approval decisions requested

1. Approve or reject the botanical envelope/pocket as the receive-state presentation language.
2. Approve or reject the slightly offset two-card stack around immutable postcard artwork.
3. Approve the nine-object color/outline family before any runtime integration or destination souvenir work.

No souvenir family is proposed because the current catalog contains none. Gift receive/detail screens remain studies, not a claim that those flows ship today.
