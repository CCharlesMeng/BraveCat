# Visual QA — Postcard status + Album empty v1

Status: **PASS FOR HUMAN VISUAL REVIEW / NON-SHIPPING / VISUAL-REVIEW-ONLY**

## Machine and physical checks

- **Postmark transparency — pass.** RGBA source and runtime derivative have zero RGB in fully transparent pixels; the live destination/date rectangle has maximum alpha 0.
- **Postmark mobile definition — pass.** Runtime ring is 57 CSS px across; core contrast against the current warm paper is 3.99:1 minimum / 5.73:1 median.
- **Fallback semantics — pass.** The opaque source is a fully covered paper photograph window, not scenery; it contains no landmark, cat, destination clue, pseudo-text, warning, UI, or emoji.
- **Layer order — pass.** The proof preserves ADR-0001 order: fallback → unchanged Minho review reuse → live copy → text-free postmark → live destination/date.
- **Album reuse-first gate — pass.** Existing stack, blank back, and navigation Album were rejected for explicit semantic reasons before the dedicated vignette was generated.
- **Album physical support — pass.** The open book, warm paper plane, and short contact shadow agree; all four page mounts are empty.
- **Mobile safety — pass.** Unavailable Postcard and empty Album are reviewed at 320×700, 390×844, and 430×932 with at least 24 px side margins and no clipping.
- **Immutable boundary — pass.** Before/after SHA-256 snapshots match for app code, runtime Scenes, Minho, landmarks, postcard-gifts, and the exact read-only presentation inputs. Unrelated parallel candidate drift is recorded separately.

## Visual approval requested

1. Approve or reject the warm gray-brown ring/waves at the actual 120×80 presentation size.
2. Approve or reject the covered-vellum fallback as unmistakably unavailable while remaining calm and non-alarming.
3. Approve or reject the dedicated open Album after the reuse evidence shows why the three existing assets do not communicate zero Postcards.

No runtime promotion, code integration, or commit should occur before those decisions.
