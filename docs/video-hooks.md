# Video visual hooks

A visual hook is a concrete image event visible during the first 0–2 seconds. It must work muted. Dialogue, captions, sound effects, camera movement, mood, and abstract curiosity gaps can support a hook, but are not visual hooks by themselves.

Every hook must:

- visibly occur immediately;
- use the subject, object, or premise of the story;
- create a question that the story answers;
- affect the next event instead of becoming disposable decoration;
- remain understandable in one frozen thumbnail or a two-second muted clip.

Translate creator wording into its underlying desire, emotion, status change, or conflict. Do not substitute a stock literal action: “flaunting” does not automatically mean strutting, posing, royalty, or a runway; “reveal” does not automatically mean moving a curtain; “transformation” does not mean routine dressing.

## Catalog

1. **Clone:** Multiple identical versions of the canonical subject appear together in the opening frame, each performing a distinct story-relevant action.
2. **Scale shock:** The subject or key object appears impossibly tiny or enormous beside a familiar object that makes the scale instantly readable.
3. **Mid-transformation:** Open during a visually surprising state change already crossing the subject, object, or environment. Routine dressing or ordinary setup does not qualify.
4. **Foreground reveal:** A close foreground object moves, opens, tears, pours, or clears away to reveal an unexpected story state behind it.
5. **Camera charge:** The subject or a story-critical object moves rapidly toward the lens and forces an immediate reaction or near-collision.
6. **Gravity break:** A subject or object visibly falls upward, hangs sideways, floats, or otherwise violates gravity in a story-relevant way.
7. **Frozen world:** Everything visible is frozen mid-action except one moving subject or object whose goal becomes immediately clear.
8. **Match-cut swap:** One object, pose, or movement instantly match-cuts into a surprising counterpart with the same screen position and silhouette.
9. **Split reality:** Two incompatible versions of the same place or moment coexist in one frame with the subject crossing or reacting across the boundary.
10. **Impossible emergence:** The subject or key object emerges from a place visibly too small or physically impossible to contain it.
11. **Instant consequence:** Open on a visible consequence already in progress, then expose the action or choice causing it before viewers can explain it.

## Separate from story structure

Visual hook controls what viewers see first. Attention engine controls why they keep watching. Example: a clone hook can amplify a challenge, escalation, status flip, or misdirection already present in the finished story. Hook session preserves story; production plan realizes hook in shot one.

## Runtime source

Executable catalog and territory selector live inside `src/lib/video-agent/tools/create-visual-hook/`. Hook session samples multiple territories, may consult Visual Agent, and returns one free-text artifact. No creative JSON schema or scoring harness is used.
