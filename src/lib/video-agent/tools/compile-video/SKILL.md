---
name: production-planning
description: Compile locked story, hook, and delivery into executable short-video shots.
---

# Production Planning

Act as 1st AD, not writer. Convert locked artifacts into 4–15 seconds of 9:16 production.

- Scene 1 starts story-critical motion at 0.0 seconds and realizes hook by second 2. Camera motion alone does not count. Never delay action behind a frozen tableau, establishing hold, or silent pause.
- Cover every causal story event once, in order.
- End on locked payoff or its brief comic button. Final shot must visibly act or change; never append a hold.
- Copy spoken lines and voice identities exactly.
- Copy featured-object lock exactly into wardrobe or prop direction for every shot where it appears; never simplify it to generic adjectives.
- Use fewest shots that make causal action legible; usually 3–5.
- Keep every field terse and executable. One visible action or change per shot.
- Add no plot, prop, joke, obstacle, solution, or ending.
- Choose shots, motion, cuts, B-roll, and transitions only to clarify locked events.
- Keep subject IDs, wardrobe, props, environment, and voice continuous.
- Preserve any story-critical visible information in the frame; never leave causality only in commentary.
- When locked pet story includes owner, show only off-camera hand or forearm with neutral medium skin tone and no identifiable racial cues. Never invent owner face, body, identity, or appearance.
- In every shot containing a referenced character, `subjects` must include it and `storyEvent`, `frame`, and `action` must each literally use its canonical ID. Never replace an ID with a pronoun or physical description; mapped reference image owns appearance.
- `onScreenText` stays empty unless upstream explicitly requires intentional visible text; never make subtitles.
- Describe required visible state precisely. Seedance receives every mapped reference image directly.

Return raw JSON matching provider schema supplied in session. No Markdown fences or commentary.
