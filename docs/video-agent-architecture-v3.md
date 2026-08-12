# Video Agent Architecture V3

Status: **implemented**

## Summary

Gemini reads supplied character references at setup. DeepSeek V4 Pro owns creative text sessions. Optional production references are prompted and inspected by Visual Agent after plan lock. Seedance receives final plan plus role-scoped references. No storyboard stage.

```text
setup:    character references | Gemini | canon
text:     request | story | hook | delivery | plan       (DeepSeek V4 Pro)
optional: plan + existing references | Visual Agent | zero or minimum production references
video:    plan + delivery + references | Seedance
```

## Director and sessions

DeepSeek Director controls sequencing, artifact fitness, retries, and escalation through `director/SKILL.md`. It never authors specialist work.

Each specialist call creates one private DeepSeek session:

| Tool | Inputs | Skill | Output |
|---|---|---|---|
| `create_story` | runtime request + canon | `create-story/SKILL.md` | Markdown story |
| `create_visual_hook` | story ID + canon | `create-visual-hook/SKILL.md` | Markdown hook |
| `write_delivery` | story + hook IDs + canon | `write-delivery/SKILL.md` | Markdown delivery |
| `compile_video` | story + hook + delivery IDs + canon | `compile-video/SKILL.md` | provider-boundary JSON plan |

Sessions own context, private tool calls, judgment, and stop condition. Only final artifact survives. DeepSeek thinking-mode tool messages retain `reasoning_content` across calls.

## Canon

Project setup uses Gemini vision to extract stable identity, continuity, and voice facts into `canon.json`. All DeepSeek sessions receive canon as read-only text. Supplied pixels still reach Seedance; canon never replaces reference pixels.

After plan lock, Visual Agent loads `reference-image-prompting/SKILL.md` and decides whether extra pixels help. Caller supplies no generated asset roles or prompts. Agent starts at zero, chooses smallest non-overlapping set, writes prompts, generates pixels, inspects whole set against existing references, and retries once. Coupled setting and UI use one `production` reference instead of redundant environment and interface images.

## Lineage

Current slots are `story`, `hook`, `delivery`, `plan`, and `video`. Replacing upstream artifact invalidates every downstream current pointer. Old versions remain for inspection.

## Seedance boundary

`generate_video` requires current plan, current delivery, and one-use spend grant. It builds concise timed prompt, attaches role-scoped references, consumes grant immediately before submission, and stores task ID. No storyboard, Gemini payload review, or post-generation retry happens automatically.

## Providers

- Gemini: canon extraction and optional Visual Agent reference prompting, generation, and inspection.
- DeepSeek official API: Director and all text sessions.
- Seedance: final video only.

Transport retries DeepSeek `429` and `5xx` twice. Creative artifacts stay Markdown; only production plan uses JSON because Seedance execution needs explicit timing.
