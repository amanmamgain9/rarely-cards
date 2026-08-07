import type { GoogleGenAI } from "@google/genai";
import type { ResearchPacket } from "../project.ts";

export function sanitizeResearchQuestion(question: string) {
  return question
    .replace(/https?:\/\/\S+|\b\S+@\S+\.\S+\b|\+?\d[\d\s().-]{7,}\d/gi, "[redacted]")
    .trim()
    .slice(0, 240);
}

export async function researchContextTool(ai: GoogleGenAI, model: string, question: string): Promise<ResearchPacket> {
  question = sanitizeResearchQuestion(question);
  if (!question) throw new Error("research_question_missing");
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: [
      "Research this sanitized question for a short entertainment video.",
      `Question: ${JSON.stringify(question)}.`,
      "Return a concise factual packet, not creative writing. Separate established facts from uncertainty.",
      "For medical, legal, or safety topics, prefer government, university, veterinary, hospital, and primary sources.",
      "Do not diagnose, prescribe, or imply that entertainment is professional advice.",
    ].join(" ") }] }],
    config: { tools: [{ googleSearch: {} }], temperature: 0.1 },
  });
  const metadata = response.candidates?.[0]?.groundingMetadata;
  const sources = (metadata?.groundingChunks ?? [])
    .flatMap((chunk) => chunk.web?.uri ? [{ title: chunk.web.title || new URL(chunk.web.uri).hostname, url: chunk.web.uri }] : [])
    .filter((source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index)
    .slice(0, 5);
  const summary = (response.text ?? "").trim().slice(0, 6000);
  if (!summary || sources.length === 0) throw new Error("research_grounding_missing");
  return { question, summary, sources };
}
