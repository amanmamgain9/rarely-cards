import { describe, expect, it } from "vitest";
import { selectVideoSpecialist } from ".";
import { createBasicIdentity } from "../tools/set-identity";

describe("pet planner", () => {
  it("owns pet detection, voice sound, and visual styling", () => {
    const identity = createBasicIdentity("/tmp/source.jpg", "dog");
    const specialist = selectVideoSpecialist(identity.characters);
    expect(specialist?.kind).toBe("pet");
    expect(specialist?.voiceBrief).toContain("as cute and baby-like as possible");
    expect(specialist?.voiceBrief).toContain("acoustic identity only");
    expect(specialist?.designBrief).toContain("pet-scaled");
  });
});
