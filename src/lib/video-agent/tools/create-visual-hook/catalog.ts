import { createHash } from "node:crypto";

export const ATTENTION_ENGINES = {
  status_flip: "An ordinary subject gains unexpected status, authority, or confidence and behaves differently because of it.",
  desire_obstacle_payoff: "A specific desire meets resistance; every attempt changes the situation before a satisfying payoff.",
  misdirection_reframe: "The opening creates one interpretation; the ending reveals a more delightful meaning.",
  transformation: "A clear before-state becomes a surprising after-state with emotional or social consequences.",
  escalation: "A simple behavior repeats with rising intensity, stakes, absurdity, or commitment.",
  secret_confession: "A precise missing truth creates curiosity until a revealing confession or discovery.",
  challenge_test: "A visible test with a clear success condition creates immediate tension and proof.",
  dramatic_irony: "The audience knows something the subject does not, making each action more charged.",
  expectation_violation: "A familiar setup produces a surprising but retrospectively fitting response.",
  callback_loop: "The ending changes the meaning of the opening and creates a natural reason to replay.",
} as const;

export const VISUAL_HOOKS = {
  clone: "Multiple identical versions of the canonical subject appear together in the opening frame, each performing a distinct story-relevant action.",
  scale_shock: "The canonical subject or key object appears impossibly tiny or enormous beside a familiar object that makes the scale instantly readable.",
  mid_transformation: "Open during a visually surprising state change already crossing the subject, object, or environment. Routine dressing or ordinary setup does not qualify.",
  foreground_reveal: "A close foreground object moves, opens, tears, pours, or clears away to reveal an unexpected story state behind it.",
  camera_charge: "The subject or a story-critical object moves rapidly toward the lens and forces an immediate reaction or near-collision.",
  gravity_break: "A subject or object visibly falls upward, hangs sideways, floats, or otherwise violates gravity in a story-relevant way.",
  frozen_world: "Everything visible is frozen mid-action except one moving subject or object whose goal becomes immediately clear.",
  match_cut_swap: "One object, pose, or movement instantly match-cuts into a surprising counterpart with the same screen position and silhouette.",
  split_reality: "Two incompatible versions of the same place or moment coexist in one frame with the subject crossing or reacting across the boundary.",
  impossible_emergence: "The subject or key object emerges from a place visibly too small or physically impossible to contain it.",
  instant_consequence: "Open on a visible consequence already in progress, then expose the action or choice causing it before viewers can explain it.",
} as const;

export const VERBAL_HOOKS = {
  contradiction: "Pair two apparently incompatible truths to create unresolved tension.",
  hyper_specific_moment: "Name one concrete lived moment that makes the right viewer feel precisely recognized.",
  timeframe_tension: "Contrast a surprising duration with a meaningful result, using only real grounded numbers.",
  pov_scenario: "Frame useful advice as a relatable situation instead of announcing instruction.",
  problem_diagnosis: "Open with the precise problem being experienced, not a general fact about the topic.",
  payoff_first: "Reveal a compelling result or consequence before explaining how it happened.",
  unfinished_loop: "Begin a concrete thought whose missing answer is delivered by the video; never use empty clickbait.",
  mistake_callout: "Name a specific likely mistake so viewers stay to verify whether they make it.",
  relatable_frustration: "State a familiar frustrating moment with enough specificity to trigger recognition.",
  stakes_warning: "Name a credible near-term consequence and what viewers must understand before acting.",
  confession_reversal: "Admit an expectation, mistake, or belief, then immediately reveal that reality contradicted it.",
  belief_challenge: "Challenge one familiar assumption and promise visible evidence rather than unsupported controversy.",
} as const;

function sample<T extends Record<string, string>>(values: T, seed: string, count: number) {
  return Object.entries(values)
    .map(([name, description]) => ({ name, description, rank: createHash("sha256").update(`${seed}:${name}`).digest().readUInt32BE(0) }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, count)
    .map(({ name, description }) => ({ name, description }));
}

export function sampleHookTerritories(seed: string) {
  return {
    attentionEngines: sample(ATTENTION_ENGINES, seed, 4),
    visualHooks: sample(VISUAL_HOOKS, seed, 5),
    verbalHooks: sample(VERBAL_HOOKS, seed, 3),
  };
}
