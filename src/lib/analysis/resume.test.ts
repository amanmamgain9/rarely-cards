import { describe, expect, it } from "vitest";
import {
  isDraftAnalysisStatus,
  isResumableAnalysisStatus,
} from "@/lib/analysis/resume";

describe("analysis resume policy", () => {
  it("resumes unfinished analysis workflows", () => {
    expect(isResumableAnalysisStatus("awaiting_name")).toBe(true);
    expect(isResumableAnalysisStatus("processing")).toBe(true);
  });

  it("does not resurrect work after a terminal result", () => {
    expect(isResumableAnalysisStatus("completed")).toBe(false);
    expect(isResumableAnalysisStatus("photo_rejected")).toBe(false);
    expect(isResumableAnalysisStatus("failed")).toBe(false);
  });

  it("only calls pre-submission work a draft", () => {
    expect(isDraftAnalysisStatus("awaiting_payment")).toBe(true);
    expect(isDraftAnalysisStatus("awaiting_name")).toBe(true);
    expect(isDraftAnalysisStatus("paid")).toBe(false);
    expect(isDraftAnalysisStatus("processing")).toBe(false);
    expect(isDraftAnalysisStatus("completed")).toBe(false);
  });
});
