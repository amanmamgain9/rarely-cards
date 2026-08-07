import { describe, expect, it } from "vitest";
import {
  analysisCreditKind,
  googlePlayCreditKind,
} from "@/lib/payments/catalog";

describe("payment catalog entitlement kinds", () => {
  it("keeps the current video product separate from delayed legacy products", () => {
    expect(
      googlePlayCreditKind(
        "three_talking_pet_videos",
        "three_talking_pet_videos",
        ["five_card_credits"],
      ),
    ).toBe("talking_video");
    expect(
      googlePlayCreditKind(
        "five_card_credits",
        "three_talking_pet_videos",
        ["five_card_credits"],
      ),
    ).toBe("card");
    expect(
      googlePlayCreditKind("unknown", "three_talking_pet_videos", [
        "five_card_credits",
      ]),
    ).toBeNull();
  });

  it("maps an analysis experience to its matching credit kind", () => {
    expect(analysisCreditKind("talking_video")).toBe("talking_video");
    expect(analysisCreditKind("birthday_video")).toBe("talking_video");
    expect(analysisCreditKind("movie_scene")).toBe("talking_video");
    expect(analysisCreditKind("card")).toBe("card");
  });
});
