# Video Agent Architecture V3

Status: **implemented**

## One-breath summary

Two agents. A pipeline of identical sessions, each turning artifacts into one new artifact. Pixel work only in the Visual Agent.

## Core rules

1. Context assembly and loop termination share one owner.
2. Director-to-tool creative context crosses by artifact ID only. Retry focus is the sole text exception. Runtime resolves request and canon.
3. Session context, drafts, alternatives, critiques, and rejected pixels are ephemeral.
4. Text work belongs to sessions. Pixel generation, direction, revision, and acceptance belong to Visual Agent.
5. Skills are owner-local data. Sessions own model calls and stop conditions.

## Agents

### Director

Director owns conversation, sequencing, fitness judgment, coherence, retry routing, budgets, and escalation. It loads `director/SKILL.md`. It may inspect accepted board frames but never authors story, lines, poses, shots, or pixels.

Every rejection names a rubric criterion and failing artifact section. Novelty is never a rejection ground. Two retries are allowed per stage; third concern returns to user.

### Visual Agent

Visual Agent owns canon setup, composition, blocking, performance, lighting, continuity, image generation, pixel inspection, revision, storyboard selection, and final Seedance-payload review. It always loads `visual/SKILL.md`.

Rejected generations remain in memory and disappear with session. Only accepted frame media and concise verdicts persist.

## Setup and pipeline

```text
setup:    persist request + references | Visual Agent creates canon | Director starts
pipeline: story | hook | delivery | plan | board | video
```

Setup records are not creative artifacts. Six slots are versioned; one current version exists per slot.

| Stage | Reads | Writes | Owner skill |
|---|---|---|---|
| `create_story` | runtime-resolved verbatim request | story | `tools/create-story/SKILL.md` |
| `create_visual_hook` | story ID | hook | `tools/create-visual-hook/SKILL.md` |
| `write_delivery` | story + hook IDs | delivery | `tools/write-delivery/SKILL.md` |
| `compile_video` | story + hook + delivery IDs | plan | `tools/compile-video/SKILL.md` |
| `create_storyboard` | plan + delivery IDs | board | Visual Agent |
| `generate_video` | plan + board + delivery IDs + spend grant | video | Visual Agent preflight, then Seedance |

Story, hook, and delivery are Markdown. Plan is provider-boundary JSON. Board is a JSON manifest referencing accepted frame media. Video is provider metadata and eventual media.

## Session runtime

```text
session(skill, input artifact IDs) = one artifact
```

Runtime loads owner-local skill, resolves IDs, injects canon, exposes private tools, and lets controller decide when to call `finish_artifact`. Qwen is an optional drafting callee when configured; Gemini remains session controller. Hook session can sample hook territories and request a text verdict from Visual Agent.

## Canon

Visual Agent creates canon once from reference pixels. Canon stores stable IDs, identity traits, voice identity, references, and continuity facts. Runtime injects it read-only into every session. It is data, not a skill and never appears in creative tool signatures.

## Lineage and invalidation

Replacing an upstream current artifact invalidates all downstream current pointers while preserving old versions as history:

- story invalidates hook, delivery, plan, board, video;
- hook invalidates delivery, plan, board, video;
- delivery invalidates plan, board, video;
- plan invalidates board and video;
- board invalidates video.

Tools reject stale input IDs. Paid generation requires current plan, board, and delivery.

## Spend boundary

Director obtains explicit user confirmation above tool boundary. Store creates one-use Seedance spend grant. `generate_video` runs Visual Agent preflight first, consumes grant immediately before provider submission, then persists provider task ID. Rejected preflight leaves grant available. Every resubmission requires a fresh grant.

## Packages

```text
director | tools | runtime | visual | providers | store
```

- `director` imports tool surface only for creative work.
- `tools` bind owner-local skills to runtime or delegate to Visual Agent.
- `runtime` assembles private text sessions.
- `visual` is only image-generation caller.
- `providers` contain transport clients without creative ownership.
- `store` owns setup records, artifacts, media, traces, lineage, and spend grants; no model calls.
- `tools/generate-video` is sole video-agent Seedance submitter.

## Deliberate omissions

No editor stage, queue, database adapter, plugin framework, alternate video provider, persisted rejected draft, or global skills directory. Add an editor only after raw Seedance output proves insufficient; it belongs after video generation and requires another user-controlled spend path when regeneration is needed.
