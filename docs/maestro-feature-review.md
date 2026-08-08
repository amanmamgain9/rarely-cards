# Maestro review for Rarely's video workflow

Reviewed [Blizaine/Maestro](https://github.com/Blizaine/Maestro) at commit [`7e7a1ad`](https://github.com/Blizaine/Maestro/commit/7e7a1ad5f79d89a5ca0052ed19beeb212fcc3989) on 2026-08-07 and compared it with this repository's production video flow and local video-agent prototype.

## Bottom line

Maestro is not primarily an autonomous agent. Its Director is a bounded, multi-pass production workflow: an LLM creates structured shot plans, deterministic code validates them, model-specific renderers compile prompts, and a durable pipeline executes and repairs individual artifacts.

That validates our current direction. Rarely should keep a conversational agent above a server-owned workflow. The best Maestro ideas for us are:

1. Resume and repair at the individual storyboard-frame level.
2. A canonical production plan separated from the final Seedance prompt.
3. Deterministic checks after each creative model pass.
4. Explicit identity, wardrobe, dialogue, timing, and continuity locks.
5. A visible project dashboard with per-frame retry and clear progress.

We should not copy Maestro's code or reproduce its full architecture.

## License boundary

Maestro uses the WanGP Non-Commercial Evaluation License 1.1. Its license explicitly prohibits using Maestro or derivatives in a paid product, hosted service, API, headless deployment, or end-user-accessible commercial integration.

Rarely may study its public behavior and independently implement general engineering ideas. We should not copy source, prompts, guides, schemas, tests, or distinctive implementation details. Any implementation based on this review must be written independently against Rarely's requirements and provider documentation.

Source: [Maestro license](https://github.com/Blizaine/Maestro/blob/7e7a1ad5f79d89a5ca0052ed19beeb212fcc3989/LICENSE).

## What Maestro actually does

Director follows this shape:

```text
User concept
    |
Mode-specific planner LLM
    |
Canonical ProductionPlan / ShotPlan
    |
Deterministic validation and normalization
    |
Mode-specific prompt renderer
    |
Image and video jobs
    |
Saved dashboard state, per-shot reruns, resume, repair, rejoin
```

Relevant source areas:

- [`schema.py`](https://github.com/Blizaine/Maestro/blob/7e7a1ad5f79d89a5ca0052ed19beeb212fcc3989/app/services/director/schema.py) defines shared character, dialogue, camera, audio, shot, and production-plan structures.
- [`orchestrator.py`](https://github.com/Blizaine/Maestro/blob/7e7a1ad5f79d89a5ca0052ed19beeb212fcc3989/app/services/director/orchestrator.py) chooses planners and render modes, then validates and compresses prompts.
- [`job_lifecycle.py`](https://github.com/Blizaine/Maestro/blob/7e7a1ad5f79d89a5ca0052ed19beeb212fcc3989/app/services/job_lifecycle.py) prevents cancellation and late completion from racing.
- [`director_pipeline.py`](https://github.com/Blizaine/Maestro/blob/7e7a1ad5f79d89a5ca0052ed19beeb212fcc3989/app/services/director_pipeline.py) persists pipeline state and supports resume, repair, per-clip regeneration, and rejoining.
- [`DirectorDashboard.tsx`](https://github.com/Blizaine/Maestro/blob/7e7a1ad5f79d89a5ca0052ed19beeb212fcc3989/ui/src/components/DirectorDashboard/DirectorDashboard.tsx) exposes saved runs and repair controls.

## Where Rarely is now

Rarely currently has two video architectures.

### Production path

The production app has separate `talking_video`, `birthday_video`, and `movie_scene` experiences. The API builds an experience-specific prompt, atomically reserves a credit, and submits one first-frame Seedance generation.

Existing strengths:

- Credit reservation is server-side and atomic.
- Submission uses guarded state transitions.
- Provider callbacks and polling both converge on persisted generation state.
- Failed pre-submission work can restore credit.
- Remote outputs are size-, content-, redirect-, and host-validated before storage.
- Discard requests survive provider cancellation limitations.

[`createSeedanceVideo`](../src/lib/video-agent/video_models/seedance.ts) supports Seedance 2.0 first/last-frame generation and multimodal image, video, and audio references. The current production submission still chooses first-frame mode; a future caller can supply reviewed references without changing the provider adapter.

### Local video-agent prototype

[`workflow.ts`](../src/lib/video-agent/workflow.ts) already implements several good Director-style ideas:

- Hook, treatment, and production design are separate structured generations.
- Zod enforces timing, scene count, reference ancestry, and dialogue preservation.
- `original`, `generate`, and `edit` reference strategies express a small continuity graph.
- Frames are saved after each completed scene.
- One pure function compiles the approved plan and references into a Seedance package.
- The outer Gemini tool loop can only select server-declared legal actions.
- The outer loop sees the source image, classifies pet/person/product/other identity, may redesign once for concrete diagnostics, and can retry failed tools.
- Interrupted storyboard runs can resume already-saved frames with `--resume`.

It remains a CLI experiment, not a production agent:

- State lives in a local `project.json`, not Supabase.
- Only preparation and storyboard tools exist.
- Revision, run status, approval, and final generation are documented but not implemented.
- User-directed revision and clarification still require a conversational app surface; CLI input remains one-shot.

## Features worth adopting

### P0: resumable storyboard repair

Highest-value Maestro lesson. Expensive multi-step generation must resume from persisted artifacts rather than restart the whole project.

For Rarely:

- Persist one row per planned scene/reference with `missing | queued | running | ready | failed`.
- Store the plan version and input fingerprint on every artifact.
- On resume, verify that the artifact exists and matches the current plan version.
- Regenerate only missing, failed, or stale frames.
- Let a failed run return the project to a legal retryable state.
- Prevent late completion from replacing an artifact invalidated by a newer revision.

This should replace the prototype's filesystem-only `storyboard` array when the workflow moves into the app.

### P0: production-grade multi-reference submission

The prototype produces a multi-reference manifest, while production accepts one `first_frame`. Before building more agent behavior, connect the smallest approved storyboard package to the real Seedance adapter.

Required checks:

- Provider-supported reference count and roles.
- Exact ordering between prompt labels and uploaded references.
- Total request-size limits.
- Plan/storyboard version match at credit reservation time.
- Idempotency around upload, provider submission, and credit consumption.

Keep one Seedance adapter. Do not add a renderer registry until a second provider is actually supported.

### P0: deterministic plan validation

Keep creative decisions in model calls, but enforce invariants in code. Add only checks tied to real failure modes:

- Scenes cover `0..duration` without gaps or overlaps.
- Every treatment beat appears in the plan.
- Dialogue is preserved exactly once and fits its allotted time.
- Reference ancestry is acyclic and points backward.
- Number of distinct references stays within provider limits.
- First scene fulfills the locked hook; final scene fulfills the payoff.
- A scene using speech keeps the subject's mouth visible.

Avoid Maestro-style generic prompt scoring and word-count heuristics unless production failures prove they predict quality.

### P1: canonical identity and continuity lock

Promote continuity from one free-text string into a small structured object:

```ts
{
  subjectIdentity: string,
  immutableTraits: string[],
  recurringPeople: string[],
  wardrobe: string[],
  recurringProps: string[],
  location: string,
}
```

Generate it once from the uploaded photo and approved treatment. Pass it unchanged into every storyboard edit and the final prompt compiler. Keep fields optional; one-photo pet videos do not need Maestro's full character system.

### P1: smallest-scope revision and invalidation

Implement `revise_project` as deterministic routing over saved dependencies:

- Hook change invalidates treatment, plan, affected frames, and final video.
- Dialogue-only change preserves frames unless mouth/framing requirements change.
- One-frame visual change invalidates that frame, descendants that edit from it, and final video.
- Music or title change preserves all images.

The LLM may classify the user's instruction and propose changes. Server code calculates actual invalidation.

### P1: review dashboard and per-frame retry

Reuse Rarely's existing studio patterns. Show:

- Public treatment summary.
- Four-frame maximum storyboard.
- Per-frame `ready`, `running`, or `failed` state.
- Natural-language revision box.
- Retry only on failed frame.
- One explicit paid `Generate video` button.

Do not expose model names, prompt editors, LoRA controls, or Maestro's manual studio complexity.

### P1: monotonic job lifecycle

Rarely's final-video flow already guards many transitions. Apply the same rule to planning and storyboard jobs:

```text
queued -> running -> ready | failed | cancelled
```

Terminal state must not be overwritten. Cancellation or revision wins over a late worker result. Use conditional database updates with run ID and plan version rather than an in-process lock.

### P2: prompt compiler diagnostics

Store the final provider package and compact diagnostics with each plan:

- Prompt length.
- Reference count and labels.
- Dialogue duration estimate.
- Which plan version produced it.
- Which continuity fields were injected.

This makes failures reproducible without exposing raw prompts to users.

### P2: optional auto/manual checkpoint

Maestro supports full auto and step-by-step review. Rarely only needs one distinction:

- Default: automatically prepare plan and storyboard, then stop before payment.
- Optional later: let advanced users approve the treatment before storyboard rendering.

Do not create separate product modes for this.

## Features not worth adopting now

- Multiple planner classes for birthday, movie, pet, or product videos. Our goal is one request language and one bounded pipeline.
- Renderer registry and feature flags for hypothetical providers.
- Local GPU detection, VRAM tuning, model downloads, quantization, and LoRA management.
- Long-video sliding windows, clip joining, beat analysis, and arbitrary multi-clip timelines.
- Prompt compression and generic completeness scores without measured correlation to Seedance results.
- Retake, recast, repaint, outpaint, and full manual editing controls.
- A second LLM refinement pass after every plan. Add only for a measured failure class.
- Open-ended agent autonomy. Paid generation and artifact invalidation must remain deterministic.

## Recommended implementation order

1. Move canonical plan, runs, and scene artifacts into Supabase.
2. Make storyboard rendering resumable and repair only stale/missing frames.
3. Wire approved multi-reference packages into the existing guarded Seedance submission path.
4. Add review UI and explicit paid approval.
5. Add `revise_project` with dependency-based invalidation.
6. Add research only after ordinary creative requests work reliably.

Do not start by making the outer agent smarter. First make each server action durable, idempotent, inspectable, and recoverable. Once those tools are trustworthy, the conversational loop is small.

## Success criteria

- Refresh or worker interruption never loses completed storyboard frames.
- Retrying one failed frame never regenerates unrelated frames.
- A stale plan cannot consume a credit.
- One user confirmation causes at most one paid provider generation.
- Exact dialogue survives planning, revision, compilation, and generation input unchanged.
- User can complete the flow without selecting a mode, model, shot type, or prompt syntax.
- Every failed run exposes one safe retry path or one clear terminal explanation.
