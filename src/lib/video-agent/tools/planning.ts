import type { GoogleGenAI } from "@google/genai";
import { validatePlanIdentity } from "../identity-validation.ts";
import { structuredGeneration } from "../model.ts";
import { getVideoPlanner, selectVideoPlanner } from "../planners/index.ts";
import { refineTreatment } from "../refinement.ts";
import { publicProjectState, runTool, saveProject, type LocalVideoProject } from "../project.ts";
import {
  hookJsonSchema,
  hookSchema,
  planJsonSchema,
  treatmentJsonSchema,
  videoPlanSchema,
  videoTreatmentSchema,
} from "../schemas.ts";
import { inspectPlan, validatePlanStructure } from "../validation.ts";
import { researchContextTool } from "./research.ts";

export async function createHookTool(project: LocalVideoProject, ai: GoogleGenAI, model: string, source: Buffer) {
  if (project.stage !== "identity_ready" || !project.characters[0] || !project.referenceAssets[0]) throw new Error("create_hook_not_allowed");
  return runTool(project, "create_hook", async () => {
    const planner = selectVideoPlanner(project.characters);
    project.plannerKind = planner.kind;
    await saveProject(project);
    let hook = await structuredGeneration({
      ai, model, schema: hookSchema, jsonSchema: hookJsonSchema, image: source, temperature: 0.7,
      prompt: planner.hookPrompt({ request: project.request, characters: project.characters }),
    });
    if (hook.researchNeeded) {
      const researchRun = await runTool(project, "research_context", () => researchContextTool(ai, model, hook.researchQuestion));
      project.research = researchRun.result;
      await saveProject(project);
      hook = await structuredGeneration({
        ai, model, schema: hookSchema, jsonSchema: hookJsonSchema, image: source, temperature: 0.5,
        prompt: [planner.hookPrompt({ request: project.request, characters: project.characters }),
          "Rewrite the hook using this completed bounded research packet.",
          `Research question: ${JSON.stringify(project.research.question)}.`,
          `Grounded summary: ${JSON.stringify(project.research.summary)}.`,
          `Sources: ${JSON.stringify(project.research.sources)}.`,
          "Use only facts supported by the packet. This is entertainment, never diagnosis or treatment advice.",
          "Research is complete: set researchNeeded false and researchQuestion empty. Return JSON only.",
        ].join(" "),
      });
      if (hook.researchNeeded) throw new Error("research_loop_forbidden");
    }
    project.hook = hook;
    project.versions.hook = (project.versions.hook ?? 0) + 1;
    project.stage = "hook_ready";
    await saveProject(project);
    return { status: "ready", hookVersion: project.versions.hook, state: publicProjectState(project) };
  });
}

export async function writeVideoTool(project: LocalVideoProject, ai: GoogleGenAI, model: string) {
  if (project.stage !== "hook_ready" || !project.hook) throw new Error("write_video_not_allowed");
  const planner = getVideoPlanner(project.plannerKind ?? "generic");
  const hook = project.hook;
  return runTool(project, "write_video", async () => {
    const treatmentDraft = await structuredGeneration({
      ai, model, schema: videoTreatmentSchema, jsonSchema: treatmentJsonSchema, temperature: 0.65,
      prompt: planner.treatmentPrompt({ request: project.request, characters: project.characters, hook }),
    });
    project.treatmentDraft = treatmentDraft;
    await saveProject(project);
    const treatment = await refineTreatment({
      ai,
      model,
      request: project.request,
      characters: project.characters,
      hook,
      draft: treatmentDraft,
      creativeBrief: planner.refinementBrief,
    });
    project.treatment = treatment;
    project.versions.treatment = (project.versions.treatment ?? 0) + 1;
    project.stage = "treatment_ready";
    await saveProject(project);
    return { status: "ready", publicSummary: treatment.summary, treatmentVersion: project.versions.treatment, state: publicProjectState(project) };
  });
}

export async function designVideoTool(project: LocalVideoProject, ai: GoogleGenAI, model: string, source: Buffer) {
  if ((project.stage !== "treatment_ready" && project.stage !== "planned") || !project.hook || !project.treatment || !project.characters[0]) {
    throw new Error("design_video_not_allowed");
  }
  const treatment = project.treatment;
  const planner = getVideoPlanner(project.plannerKind ?? "generic");
  const revisionContext = project.stage === "planned" && project.plan
    ? `Previous plan: ${JSON.stringify(project.plan)}. Diagnostics: ${JSON.stringify(project.planDiagnostics)}. Redesign specifically to fix those diagnostics while preserving approved treatment.`
    : "";
  return runTool(project, "design_video", async () => {
    const plan = await structuredGeneration({
      ai, model, schema: videoPlanSchema, jsonSchema: planJsonSchema, image: source, temperature: 0.45,
      prompt: [planner.designPrompt({ request: project.request, characters: project.characters, hook: project.hook, treatment }), revisionContext].filter(Boolean).join(" "),
    });
    validatePlanStructure(treatment, plan);
    validatePlanIdentity({ characters: project.characters, referenceAssets: project.referenceAssets, plan });
    project.planDiagnostics = inspectPlan(plan);
    project.plan = plan;
    project.versions.plan = (project.versions.plan ?? 0) + 1;
    project.stage = "planned";
    await saveProject(project);
    return { status: "ready", planVersion: project.versions.plan, state: publicProjectState(project) };
  });
}
