import type { GoogleGenAI } from "@google/genai";
import { groundedResearch } from "../models/gemini.ts";
import type { ResearchPacket } from "../state.ts";

export function sanitizeResearchQuestion(question: string) {
  return question
    .replace(/https?:\/\/\S+|\b\S+@\S+\.\S+\b|\+?\d[\d\s().-]{7,}\d/gi, "[redacted]")
    .trim()
    .slice(0, 240);
}

export async function researchContextTool(ai: GoogleGenAI, model: string, question: string): Promise<ResearchPacket> {
  question = sanitizeResearchQuestion(question);
  if (!question) throw new Error("research_question_missing");
  return groundedResearch(ai, model, question, [
      "Research this sanitized question for a short entertainment video.",
      `Question: ${JSON.stringify(question)}.`,
      "Return a concise factual packet, not creative writing. Separate established facts from uncertainty.",
      "For medical, legal, or safety topics, prefer government, university, hospital, relevant professional, and primary sources.",
      "Do not diagnose, prescribe, or imply that entertainment is professional advice.",
    ].join(" "));
}
