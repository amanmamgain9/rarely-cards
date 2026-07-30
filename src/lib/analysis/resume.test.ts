import { describe, expect, it } from "vitest";
import { isResumableAnalysisStatus } from "@/lib/analysis/resume";

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
});
