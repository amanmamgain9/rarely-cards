# Video agent implementation plan

## Purpose

Build a one-photo video system that accepts an ordinary-language request, develops a strong pet-specific creative plan, creates only the references it needs, lets the user review the result, and makes one paid Seedance call.

The user should not choose planners, models, prompt formats, reference strategies, camera terminology, or production modes. Specialization happens privately.

This document separates each capability so it can be implemented and reviewed independently.

## Product boundary

MVP includes:

- One uploaded photo
- One natural-language request
- Pet-specific creative direction
- Maximum 15-second vertical video
- Maximum four storyboard scenes
- Structured identity and continuity
- Storyboard review before payment
- One final Seedance call
- Saved progress and safe retry of technical failures

MVP excludes:

- User-directed image or video editing
- Retake, recast, repaint, and outpaint tools
- Local GPU execution
- Local model downloads, quantization, and LoRA management
- Long-video stitching and sliding windows
- Manual prompt editing
- Multiple video providers

## 1. Canonical identity system

### Goal

Treat identity as persistent project state, not repeated descriptive prompt text.

The uploaded photo remains the primary visual identity reference. Structured data explains who the subject is, connects that subject to each scene, and separates immutable identity from scene-specific appearance.

### Data model

```ts
type CharacterProfile = {
  id: string;
  role: "primary_pet" | "primary_person" | "primary_product" | "primary_subject" | "supporting_subject";
  subjectKind: "pet" | "person" | "product" | "other";
  displayName?: string;
  physicalDescription?: string;
  immutableTraits: string[];
  defaultAccessories: string[];
  voiceDescription?: string;
  identityReferenceId: string;
};

type ReferenceAsset = {
  id: string;
  kind: "upload" | "generated" | "edited";
  characterIds: string[];
  parentReferenceId?: string;
  planVersion: number;
  status: "missing" | "running" | "ready" | "failed";
};

type SceneSubject = {
  characterId: string;
  visibleDescription: string;
  wardrobe?: string;
  accessories?: string[];
  positionOrRelation?: string;
  expressionOrPose?: string;
};
```

### Identity layers

Identity must be split into three layers:

1. **Character identity:** stable physical traits that must not change.
2. **Scene appearance:** costume, expression, pose, dirt, lighting interaction, and story state for one scene.
3. **Reference lineage:** which uploaded or generated image visually anchors each scene.

The system must never treat wardrobe, lighting, or pose as immutable identity. A pet can wear a bathrobe in one scene and a crime-family costume in another while remaining the same pet.

### Creation flow

```text
Uploaded photo
    |
set_identity
    |
Server assigns char_primary and ref_original
    |
Original upload registered as identity ReferenceAsset
    |
Every scene identifies subjects by characterId
    |
Storyboard compiler resolves character + scene appearance + reference lineage
    |
Seedance compiler receives the same identity mapping
```

### Optional profile enrichment

- MVP does not require another vision call. The uploaded pixels remain identity truth.
- Reuse trusted information already available from photo analysis or explicit user input.
- Record only visible traits when enrichment is available.
- Do not infer health, temperament, ownership, exact age, or hidden anatomy.
- Prefer one concise physical description over many disconnected labels.
- Keep unusual markings, ear shape, eye color, muzzle shape, coat texture, body proportions, and visible permanent accessories.
- Store confidence or omit uncertain details; do not turn guesses into identity locks.
- Assign stable IDs in server code, not model output.

### Continuity rules

- Every scene subject references a known `characterId`.
- Every generated reference lists the characters it contains.
- An edited reference points to an earlier reference through `parentReferenceId`.
- Every scene resolves to one primary visual reference.
- The original upload remains available as identity guidance even when a prior generated scene supplies composition and wardrobe continuity.
- Character identity cannot be silently rewritten by hook, treatment, design, refinement, or prompt compilation.

### User experience

No new screen or question. `set_identity` runs privately after upload. Users continue to provide only a photo and request.

### Completion criteria

- Project stores a canonical character profile and original reference asset.
- Every scene uses `characterId` rather than free-floating identity prose.
- Storyboard and final prompt compilation resolve identity through the same profile.
- Tests reject unknown character IDs and broken reference lineage.
- Scene-specific costume changes do not mutate canonical identity.

## 2. Deterministic validation

### Goal

Protect structural correctness, cost boundaries, and approved content without grading creativity.

### Hard invariants

Hard failures may block or trigger one correction attempt:

- Duration is within 5–15 seconds.
- Scenes are ordered, contiguous, and cover the full duration.
- Scene and reference counts stay within provider limits.
- IDs are unique and references point to existing earlier artifacts.
- Every scene subject references an existing character.
- Every treatment beat appears in the production plan.
- Approved dialogue is preserved exactly.
- Final generation uses the approved plan and storyboard versions.
- A paid request cannot be submitted twice.

### Soft review signals

Soft signals inform the refinement pass but do not directly reject creative work:

- Dialogue may be too dense for its time slot.
- Hook may not be visually legible without sound.
- Tone may conflict with the selected planner's quality target.
- Pet behavior may feel too human or uncanny.
- Camera movement may be decorative rather than story-motivated.
- A generated reference may be unnecessary.
- Payoff may not satisfy the hook obligation.

Soft signals must be stored as diagnostics. They must not become generic numeric quality scores.

### Completion criteria

- Structural validators are pure functions with focused tests.
- Creative warnings do not mutate or reject work automatically.
- One correction attempt receives exact structural errors.
- No open-ended validation loop exists.

## 3. Second LLM creative-refinement pass

### Goal

Give a specialist creative director one deliberate pass over the first treatment before production design.

### Inputs

- Original user request
- Canonical character profiles
- Locked hook
- First-pass treatment
- Selected planner's quality brief
- Soft validation signals

### Responsibilities

- Improve emotional coherence and specificity.
- Improve dialogue performance and voice direction.
- Remove accidental tonal mismatch.
- Strengthen setup/payoff connection.
- Preserve explicit user details and factual boundaries.
- Preserve locked hook meaning unless the hook itself is being revised.
- Return a complete revised treatment using the same schema.

### Pet refinement target

Default pet output should feel:

- Extremely cute
- Warm and mushy
- Relatable to pet owners
- Playful or gently funny
- Animal-like rather than human-baby-like
- Emotionally safe unless the request explicitly asks for intensity

Pet voice should be warm, sweet, soft, expressive, and clear. It should not be shrill, nasal, whiny, exaggerated toddler speech, or baby-talk.

Genre requests remain valid. A crime-family or superhero treatment may retain cinematic style while keeping the pet lovable and avoiding accidental horror or menace.

### Completion criteria

- First draft and refined treatment are stored separately.
- Refinement is exactly one bounded model call.
- Planner-specific brief is visible in internal diagnostics.
- Tests verify the refined treatment still satisfies the shared schema.

## 4. Planner architecture

### Goal

Use one user language and one production pipeline while selecting a private specialist responsible for creative quality.

### Separation of responsibility

```text
Conversational coordinator
    |
selects planner from request + project context
    |
Specialist planner creates hook/treatment/refinement guidance
    |
Shared production designer creates feasible scenes
    |
Shared storyboard and Seedance tools execute plan
```

Planners specialize creative judgment. They do not own payment, storage, retries, provider calls, or workflow state.

### Initial planners

#### Pet planner

Required for MVP. Owns:

- Cute, warm, relatable emotional target
- Natural pet behavior
- Pet-owner relationship cues
- Pet-specific voice direction
- Avoiding uncanny child behavior
- Translating dramatic genre references into lovable pet stories

#### Generic planner

Fallback for requests that are not confidently pet-centered. It preserves user intent without applying pet-specific assumptions.

### Later planners

Add only after real demand and examples:

- Birthday planner
- Movie/trailer planner
- Product-showcase planner
- Health-update or awareness planner

These planners share the same hook, treatment, identity, scene, and production-plan schemas. They may supply different creative briefs and examples; they may not create separate generation pipelines.

### Planner selection

Selection uses structured project context, not visible user modes:

- Subject kind from visual analysis
- User request intent
- Existing project experience, when present
- Confidence threshold

Low-confidence selection falls back to the generic planner or asks one essential question only when the choice materially changes meaning.

### Completion criteria

- Pet and generic planners implement one small shared contract.
- Selected planner kind is saved with the project.
- Planner selection is testable without calling an LLM where structured context is decisive.
- Adding a planner does not change storyboard, payment, or provider code.

## 5. Outer agent coordinator

### Current problem

The outer agent currently has little value because every state exposes one obvious legal action:

```text
collecting -> create_hook
hook_ready -> write_video
treatment_ready -> design_video
planned -> render_storyboard
```

The system prompt tells the agent to choose that action. This is not coordinator failure; the coordinator has been given no meaningful choice.

### MVP role

Keep the coordinator narrow. It should:

- Interpret the request.
- Ask one essential clarification when meaning is materially ambiguous.
- Select a specialist planner.
- Decide whether factual research is required.
- Continue legal automatic steps.
- Explain progress and results in ordinary language.
- Stop at storyboard review and paid confirmation.

The server still owns legal state transitions.

### Useful future freedom

The coordinator gains value when multiple legal actions exist, such as:

- Research or continue creatively without research.
- Ask clarification or use a safe default.
- Reuse original photo or request a better photo.
- Render storyboard now or present treatment first.
- Route feedback to hook, treatment, design, or one artifact.

Freedom should mean choosing among safe capabilities, not bypassing invariants or payment.

### Completion criteria

- Agent system prompt describes goals and boundaries, not a fixed action script.
- `allowedActions` may expose multiple safe choices where meaningful.
- Agent decisions are recorded with state and tool results.
- Fixed sequences may execute in server workflow without wasting an agent turn.

## 6. Storyboard execution and recovery

### Goal

Generate only required references and preserve successful work through failures.

### Requirements

- Persist each reference independently.
- Reuse the original upload when it already satisfies a scene.
- Generate a fresh reference for genuinely new composition or setting.
- Edit from an earlier reference for visual continuity.
- Supply both prior-scene composition and canonical identity guidance when useful.
- Retry only missing or failed references.
- Reject late results created for stale plan versions.
- Stop before paid video generation.

### Completion criteria

- Refresh or interruption does not lose completed frames.
- One failed frame can resume without regenerating siblings.
- Storyboard always identifies profile and reference lineage used for each scene.

## 7. Paid Seedance generation

### Goal

Compile the approved project into one provider request without giving the agent payment authority.

### Requirements

- Verify approved plan and storyboard versions.
- Resolve stable character IDs to ordered reference assets.
- Preserve exact dialogue and voice direction.
- Include canonical identity plus scene-specific appearance.
- Require explicit short-lived approval token.
- Reserve one credit atomically.
- Use one idempotency key.
- Make at most one paid provider call per confirmation.
- Restore credit only when failure occurs before valid paid generation begins.

## 8. Observability and evaluation

Store enough internal evidence to understand quality failures:

- Planner selected and why
- Character profiles and reference lineage
- Hook, first treatment, refined treatment, and production plan versions
- Soft validation signals
- Final provider prompt and reference map
- Model and configuration used for each internal pass
- User feedback linked to the generated artifact

Initial pet quality rubric:

- Does the pet remain visibly recognizable?
- Does the pet feel cute and lovable?
- Does behavior resemble something pet owners recognize?
- Does voice feel sweet rather than irritating or babyish?
- Does genre styling support rather than overwhelm the pet?
- Does the story produce affection, amusement, or warmth?

## Implementation order

Each item is separate work and should receive its own tests:

1. [x] Add `set_identity`, `CharacterProfile`, `SceneSubject`, and `ReferenceAsset` structures.
2. [x] Connect profiles to hook, treatment, production plan, storyboard, and final compilation.
3. [x] Add hard structural validators and separate soft review signals.
4. [x] Add one bounded treatment-refinement pass.
5. [x] Add planner contract, pet planner, generic fallback, and saved planner selection.
6. [ ] Make storyboard artifacts resumable and version-aware.
7. [ ] Connect multi-reference package to guarded production Seedance submission.
8. [ ] Add internal evaluation capture using real user feedback.

## Current implementation status

Implemented in the local prototype:

- Private `set_identity` tool with no additional vision call
- Server-assigned stable character and reference IDs
- Canonical `CharacterProfile`
- Original upload registered as identity `ReferenceAsset`
- Immutable identity separated from per-scene appearance and wardrobe
- Every scene maps visible subjects through `characterId`
- Every scene names its identity reference
- Edited references retain parent lineage
- Storyboard generation uses the original identity anchor plus the previous-scene image when continuity requires both
- Final Seedance compilation resolves the same character profiles and scene appearances
- Deterministic checks reject unknown character IDs, mismatched identity references, missing parents, and lineage cycles
- Hard plan validation protects timing, beat coverage, exact dialogue, and references
- Soft dialogue-density diagnostics do not reject creative work
- One bounded second treatment pass stores both draft and refined treatment
- Pet and generic planners share the production pipeline
- Pet planner defaults to cute, warm, relatable stories and avoids babyish voice direction

Durable storyboard recovery, production multi-reference submission, and evaluation capture remain later steps.
