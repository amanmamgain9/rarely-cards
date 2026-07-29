import { createHash } from "node:crypto";

export function googlePlayPaymentEventIdentity(input: {
  messageId: string;
  data: string;
  subscription?: string;
}) {
  const digest = createHash("sha256")
    .update(Buffer.from(input.data, "base64"))
    .digest("hex");
  const subscription = input.subscription?.trim() || "default";
  return {
    eventId: `google_play:${subscription}:${input.messageId}`,
    digest,
  };
}
