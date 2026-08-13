# Cinematic Four-Act Story Work

Use this page as the stable entry point for proposing, generating, or reviewing
BraveCat cinematic four-act stories. `AGENTS.md` only routes here; the detailed
art baseline remains in the art documentation.

## Read before story work

Read these sources before creating a proposal:

1. `CONTEXT.md`
2. `docs/art/cinematic-four-act-visual-principles.md`
3. `docs/art/cinematic-gameplay-concept-v1.md`
4. `docs/story/cinematic-journey-v1/rights-and-originality.md`
5. `docs/art/production/portraits/minho/manifest.json`

Treat a task-specific handoff as additional scope, not as a replacement for
these stable sources. Do not reuse an older story's plot, location, composition,
or prompt as the template for a new story. Existing cinematic story directory
names may be listed for slug and subject-collision checks. Before writing a new
proposal, also perform a plot-collision audit against the closest known prior
story summaries. Compare the Cat's desire, initiating cue, movement pattern,
Act 2 resistance and choice, Act 3 fulfillment mechanism, Act 4 retained trace
or changed relationship, and the stripped-down causal skeleton. Use only the
minimum approved story summary needed for this comparison; do not reopen an old
prompt or composition as creative reference.

## Proposal gate

Obtain explicit user approval for the written story before generating images.
A proposal must state:

- a new English slug and an original fictional location;
- one safe, autonomous, non-task-like goal for Cat;
- the four acts: establish, transit, fulfillment, and quiet aftermath;
- one Postcard line per act and one Album closing line;
- the continuity anchors, walkable route, time/weather progression, Perch,
  Cat Framing, Ambient Life, and originality exclusions;
- a nearest-neighbor plot-collision audit that names the closest prior story,
  states both stories' noun-free causal skeletons, and explains how the new
  desire, Act 2 choice, Act 3 fulfillment, and Act 4 aftermath are materially
  different.

Do not describe a proposal as complete merely because four attractive settings
have been named.

Reject a proposal when changing only the subject, destination, weather, visual
motif, or keepsake would make it the same story as an earlier one. In particular,
"notice a moving target, pursue it through a detour, reach or touch it, then end
with a remnant of it" is one causal skeleton whether the target is a bird, leaf,
light, toy, or another substitute. Surface novelty cannot satisfy the
originality gate.

## Narrative baseline

Apply the full reusable baseline in
`docs/art/cinematic-four-act-visual-principles.md`. In particular:

1. The sequence must remain understandable without titles or Postcard copy.
2. Act 1 establishes a visibly unfinished desire and a direction.
3. Act 2 makes resistance, judgment, or a change of course visible. It cannot
   merely repeat Act 1 in a different background.
4. Act 3 visibly fulfills the expectation accumulated by Acts 1 and 2.
5. Act 4 preserves a changed state, trace, or relationship caused by the
   journey, then lowers the emotional intensity.
6. Every adjacent pair both inherits something and changes something.
7. Each act has one primary narrative action or state.
8. Cat completes a small goal through its own safe movement and choices.
   Ambient people do not assign, direct, rescue, reward, or celebrate Cat.
9. The new story is materially distinct from prior stories at the level of
   desire, resistance, fulfillment, and aftermath, not merely nouns and scenery.

Reject or rewrite a story whose plot only amounts to finding a comfortable
place, unless the route, decision, fulfillment, and aftermath each cause a
distinct and visually legible change.

## Minho and Pack continuity

Use the approved Minho production manifest for identity and pose routing.

Unless a later approved production manifest explicitly supersedes it, the
cinematic travel Pack is locked as:

- one small olive-green canvas Pack;
- a tan flap and two tan buckle straps;
- one rolled cream blanket attached on top;
- the same silhouette, structure, color, and physically plausible scale in
  every act.

Every panel contains exactly one Minho and exactly one Pack. Do not recolor,
redesign, enlarge, omit, or duplicate the Pack. If a story intentionally changes
how the Pack is worn or placed, the change must be causally visible, physically
credible, and included in the approved written proposal.

Use the domain term `Pack` / `行囊`, not `背包` or `库存`.

## Literary references

Literary quotations are optional atmosphere, never a substitute for a readable
plot.

- Use only a short, source-verifiable passage whose rights status and edition
  are suitable for the intended use.
- Record author, work, original-language wording, edition/source URL, and access
  date.
- Prefer the original text. Label project-written Chinese as `项目自译` or
  `项目意译`; do not silently copy a modern Chinese translation.
- Keep the quotation outside generated artwork. The image itself contains no
  title, quotation, caption, number, annotation, readable text, or pseudo-text.
- Let the story answer or transform the borrowed image instead of paraphrasing
  it across all four Postcards.

For Rabindranath Tagore's *Stray Birds*, use the author-translated 1916 English
edition as the working source:
`https://www.gutenberg.org/files/6524/6524-h/6524-h.htm` (accessed
2026-07-28).

## Generation gate

After the story is approved:

1. Read the complete `imagegen` skill instructions.
2. Create a new versioned `batch-01-continuity-storyboard/` under a new
   `docs/art/candidates/cinematic-v6/<story-slug>/` directory.
3. Save the approved Chinese specification and complete generation prompt in
   the batch README.
4. Route identity and pose references through the approved Minho manifest.
   State the responsibility of every reference image and do not carry an old
   story's location or composition into the new prompt.
5. Generate one low-fidelity watercolor-and-colored-pencil 2x2 continuity
   storyboard before any separate polished Scene.
6. Review story order, Minho identity, Pack count and design, inherited space,
   cat-height viewpoint, support physics, time progression, fulfillment, and
   aftermath before judging finish quality.
7. Copy retained outputs into the workspace and record dimensions, color space,
   SHA-256, prompt, reference responsibilities, review results, and known
   limitations.

Create a `selected-four-act-vNN` baseline only after explicit user acceptance.
Do not modify the production Catalog, persistence, economy, landmark v1-v5
assets, or shipping state as part of candidate generation.
