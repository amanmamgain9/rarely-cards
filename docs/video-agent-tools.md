# Conversational agent over a bounded video workflow

## Scope

This is an agent-assisted product, not autonomous video production.

The conversational agent handles natural language, ambiguity, user revisions, and selection among currently legal tools. The server owns the costly production workflow, state transitions, versions, retries, storage, and payment.

Birthday greetings, talking pets, product showcases, health updates, and movie trailers are user requests—not separate modes or pipelines.

Initial boundary:

- One uploaded photo
- Maximum 15-second vertical video
- Maximum four scenes; current package uses at most five images including the canonical identity image
- Seedance 2.0 multimodal API supports 1–9 reference images
- One final Seedance call
- Only the Seedance call consumes one user video credit

## Example requests

These real requests form the initial product test set:

1. “Make my dog flaunt the new bathrobe. Dog bathrobes are a new thing.”
2. “Make my pet talk about a condition, like the megacolon condition.”
3. “Make my baby into a Spider-Man trailer.”
4. “Make my baby ask for treats like The Godfather.”

All examples begin with one photo.

## Actual agent loop

```text
User request or job-completion event
        |
        v
LLM reads current project state
        |
        v
LLM chooses one allowed tool, asks one question, or stops
        |
        v
Server validates ownership, state, version, limits, and payment
        |
        v
Server executes tool
        |
        v
Tool result returns to LLM
```

The server calculates `allowedActions`. The LLM cannot create a new transition by naming a tool that is not currently allowed.

## Agent-facing tools

### 1. `get_project_state`

Reads canonical project state. Chat history is not the source of truth.

```ts
get_project_state({
  projectId: string,
}): {
  stage: string,
  request: string,
  sourceSummary: string,
  currentVersions: {
    identity?: number,
    hook?: number,
    treatment?: number,
    plan?: number,
  },
  storyboard: Array<{
    id: string,
    status: "missing" | "running" | "ready" | "failed",
    previewUrl?: string,
  }>,
  activeRuns: Array<{
    id: string,
    tool: string,
    status: "queued" | "running",
  }>,
  creditBalance: number,
  allowedActions: string[],
}
```

The server supplies this result at the start of each turn. The agent may call it again after a tool result or when the user asks about current state.

### 2. `set_identity`

Registers the uploaded photo as the canonical identity authority without another vision-model call.

```ts
set_identity({ projectId: string }): {
  status: "ready",
  identityVersion: number,
}
```

The server creates stable `char_primary` and `ref_original` IDs. Later scenes use the character ID, while the original image pixels—not a generated text description—define appearance.

### 3. `create_hook`

Locks only the first 0–2 seconds, curiosity gap, story promise, and payoff obligation. This is a separate saved and versioned agent tool so later revision can change the opening without hiding that decision inside a large planning call.

### 4. `write_video`

Expands the locked hook into story events, exact dialogue, narration, music arc, and ending. It cannot change the locked hook.

### 5. `design_video`

Assigns timing, visual states, camera purpose, reference strategy, and one-call feasibility. It cannot rewrite approved speech or story.

The server normally permits these actions in that order. They remain separate tool calls and artifacts even when the conversational agent advances through all three without asking the user to approve each layer.

#### Private research agent inside `create_hook`

When a hook depends on current or factual context, `create_hook` requests a bounded research session. The conversational agent does not call it directly.

```text
create_hook produces sanitized research question
        |
        v
research LLM
        +-- search_sources
        +-- read_source
        |
        v
cited research packet
        |
        v
create_hook resumes
```

Research limits:

- One session per hook attempt
- Maximum three searches and five opened sources
- No uploaded photo, pet name, owner name, or transcript in queries
- Research-only system prompt and tool allowlist
- No image, video, storage, payment, or creative-generation tools
- Every factual finding cites a returned source
- Unsupported claims remain uncertainties
- Authoritative sources required for medical, legal, and safety claims

Research is used for requests involving current trends, factual claims, real products, conditions, events, or exact cultural context. It is skipped for self-contained creative requests.

### 6. `render_storyboard`

Creates only the visual references required by the current plan.

```ts
render_storyboard({
  projectId: string,
  planVersion: number,
}): {
  runId: string,
  status: "queued" | "running" | "ready",
}
```

The server:

- Reuses the original photo when suitable.
- Generates a reference only for a distinct location, composition, costume, prop, or story event.
- Edits a previous reference when continuity matters.
- Uses the original upload as the identity anchor.
- Deduplicates visual states and enforces Seedance's nine-image limit.
- Saves each completed frame immediately.
- Corrects only objective failures such as wrong subject, broken anatomy, missing prop, unreadable required object, wrong aspect ratio, or continuity mismatch.

### 7. `revise_project`

Routes natural-language feedback to the smallest affected layer.

```ts
revise_project({
  projectId: string,
  instruction: string,
}): {
  runId?: string,
  status: "ready" | "running" | "needs_clarification",
  clarification?: string,
  changedArtifacts: string[],
}
```

Examples:

- “Make the opening stronger” reruns hook, treatment, design, and affected images.
- “Use the same woman's hand in the final scene” changes only that reference.
- “Keep the pictures; change what she says” preserves images and invalidates only the final video.
- “Make it funnier” revises story, then redesigns only affected visual states.

The agent chooses `revise_project`; the server performs dependency analysis and version invalidation.

### 8. `generate_video`

Starts the only paid generation step.

```ts
generate_video({
  projectId: string,
  planVersion: number,
  approvalToken: string,
}): {
  generationId: string,
  status: "queued" | "running",
}
```

The server:

- Verifies that visible storyboard and approved plan versions match.
- Requires a short-lived confirmation token created by an explicit user action.
- Reserves one credit with an idempotency key.
- Chooses first-frame or multi-reference input from the plan.
- Compiles references, timing, dialogue, narration, music, and continuity into provider input.
- Makes one Seedance call.
- Adds titles, captions, and branding locally.
- Saves provider metadata and final output.
- Restores credit when submission fails before a valid paid generation begins.

### 9. `get_run_status`

Reads an asynchronous tool run and its result.

```ts
get_run_status({
  projectId: string,
  runId: string,
}): {
  tool: string,
  status: "queued" | "running" | "ready" | "failed",
  progress?: { completed: number; total: number },
  result?: unknown,
  retryable?: boolean,
  publicError?: string,
}
```

Normal completion arrives as a server event that starts another agent turn with the tool result. This status tool exists for explicit status questions, reconnects, recovery, and clients without event delivery. The LLM must not poll it in an open-ended loop.

## Legal workflow states

```text
collecting
    |
identity_ready
    |
planning
    |
storyboard_rendering
    |
review
    |
video_queued
    |
video_generating
    |
completed
```

Failure and revision transitions are server-defined. Examples:

- `review` may transition to `storyboard_rendering` through `revise_project`.
- `review` may transition to `video_queued` only through confirmed `generate_video`.
- `video_generating` cannot transition back to planning by an LLM tool call.
- Zero-credit users may reach and remain in `review`.

## Default behavior for the example requests

| Request | Clarification or research | Expected references |
|---|---|---:|
| Flaunt a new bathrobe | Research only when “new” means a current named trend; otherwise none | 0–2 |
| Talk about megacolon | Ask whether this is an explanation, personal update, or support request; research factual claims | 0–1 |
| Spider-Man trailer | No clarification unless “baby” is ambiguous after inspecting photo; cultural research only if an exact scene is requested | 3–4 |
| Ask for treats like The Godfather | No research for a general crime-family treatment; research only for an exact scene | 2–4 |

The agent does not expose reference count, camera language, model choice, prompt syntax, or provider details unless the user explicitly asks.

## Server invariants

- Every tool validates authentication and project ownership.
- Every mutation is versioned and idempotent.
- Raw provider prompts and storage paths never come from the LLM.
- No open-ended production or research loops.
- Objective failures may receive bounded automatic correction; subjective taste remains with the user.
- Successful artifacts survive later partial failures.
- Chat messages are stored for conversation, but structured project state controls execution.
- Paid generation always requires explicit confirmation and a legal state transition.
