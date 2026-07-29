import { describe, expect, it } from "vitest";
import { googlePlayPaymentEventIdentity } from "@/lib/payments/google-play-events";

describe("Google Play payment event identity", () => {
  it("depends on immutable Pub/Sub message content", () => {
    const input = {
      messageId: "message-123",
      data: Buffer.from('{"packageName":"cards.rarely.app"}').toString("base64"),
      subscription: "projects/project/subscriptions/google-play",
    };

    expect(googlePlayPaymentEventIdentity(input)).toEqual(
      googlePlayPaymentEventIdentity(input),
    );
  });

  it("namespaces topic-scoped message IDs by subscription", () => {
    const data = Buffer.from("{}").toString("base64");
    const first = googlePlayPaymentEventIdentity({
      messageId: "same-id",
      data,
      subscription: "projects/a/subscriptions/one",
    });
    const second = googlePlayPaymentEventIdentity({
      messageId: "same-id",
      data,
      subscription: "projects/b/subscriptions/two",
    });

    expect(first.eventId).not.toBe(second.eventId);
    expect(first.digest).toBe(second.digest);
  });
});
