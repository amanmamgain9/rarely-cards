import { PENDING_PHOTO_COOKIE } from "@/lib/analysis/resume";
import type { AcceptedAnalysis, PublicAnalysis } from "@/lib/analysis/types";
import type { WorkflowSnapshot } from "@/lib/workflow/types";
import { PET_DEMO_RESULT } from "@/lib/rarity/pet-config";

export type FlowState =
  | "idle"
  | "restoring"
  | "naming"
  | "processing"
  | "completed"
  | "retry"
  | "refund_pending"
  | "refunded"
  | "error";

export type GenerationWorkspaceProps = {
  initialAnalysis: PublicAnalysis | null;
  shouldRestorePendingPhoto: boolean;
  seedanceConfigured: boolean;
};

export const AUTOMATIC_CARD_STYLE = "pet" as const;

export const HERO_CARD_DEMOS = [
  {
    image: "/pets/golden-dog.jpg",
    imageAlt: "Golden retriever holding a flower",
    result: {
      status: "accepted",
      ...PET_DEMO_RESULT,
      ratings: PET_DEMO_RESULT.ratings.map((rating) => ({ ...rating })),
    },
  },
  {
    image: "/pets/window-cat.jpg",
    imageAlt: "Cat watching a pink sunset through an open window",
    result: {
      status: "accepted",
      petName: "Miso",
      pronouns: "they",
      species: "cat",
      energy: "serene",
      cardTitle: "Watching The Sunset",
      rarityScore: 94,
      signatureRead: {
        title: "Just One More Minute",
        score: 97,
        thought:
          "The light is leaving, and I would prefer the room stay exactly like this.",
      },
      ratings: [
        {
          key: "aura",
          label: "Aura",
          score: 93,
          phrase: "Quietly Holding Time",
          reason: "Miso sits still in the soft window light.",
        },
        {
          key: "sceneLore",
          label: "Scene Lore",
          score: 96,
          phrase: "Sunset Under Watch",
          reason: "Miso faces the bright open window.",
        },
        {
          key: "drama",
          label: "Drama",
          score: 85,
          phrase: "Softly Refusing Change",
          reason: "The still posture makes the fading light feel important.",
        },
        {
          key: "gaze",
          label: "Gaze",
          score: 90,
          phrase: "Watching The Distance",
          reason: "Miso's attention stays beyond the window.",
        },
      ],
    },
  },
] satisfies readonly {
  image: string;
  imageAlt: string;
  result: AcceptedAnalysis;
}[];

export const PENDING_CARD_RESULT: AcceptedAnalysis = {
  status: "accepted",
  petName: "Your pet",
  cardTitle: "Their Story Starts Here",
  rarityScore: 80,
  signatureRead: {
    title: "The Look You Know",
    score: 80,
    thought:
      "You already know what this face means. Their card will put it into words.",
  },
  ratings: PET_DEMO_RESULT.ratings.map((rating) => ({ ...rating })),
};

export function readPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("photo_read_failed"));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function flowForAnalysis(analysis: PublicAnalysis): FlowState {
  switch (analysis.status) {
    case "awaiting_upload":
      return "restoring";
    case "awaiting_payment":
    case "payment_pending":
    case "awaiting_name":
      return "naming";
    case "paid":
    case "processing":
      return "processing";
    case "photo_rejected":
      return "retry";
    case "completed":
      return "completed";
    case "refund_pending":
      return "refund_pending";
    case "refunded":
      return "refunded";
    case "failed":
    case "disputed":
      return "error";
  }
}

export function flowForWorkflow(
  snapshot: WorkflowSnapshot,
  transientFlow: FlowState,
): FlowState {
  if (!snapshot.analysis) {
    return transientFlow;
  }

  const serverFlow = flowForAnalysis(snapshot.analysis);
  if (
    transientFlow === "processing" &&
    ["naming", "processing"].includes(serverFlow)
  ) {
    return "processing";
  }
  return serverFlow;
}

export function setPendingPhotoHint(pending: boolean) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PENDING_PHOTO_COOKIE}=${pending ? "1" : ""}; Path=/; SameSite=Lax; Max-Age=${pending ? 86400 : 0}${secure}`;
}

export function clearResumeQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("resume")) return;
  url.searchParams.delete("resume");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
