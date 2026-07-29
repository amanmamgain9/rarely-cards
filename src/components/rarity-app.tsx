"use client";

import Image from "next/image";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clearPendingPhoto,
  loadPendingPhoto,
  savePendingPhoto,
} from "@/lib/pending-photo";
import {
  createShareAsset,
  ShareCard,
  type ShareAsset,
} from "@/components/share-card";
import type {
  AcceptedAnalysis,
  PetPronouns,
  PublicAnalysis,
} from "@/lib/analysis/types";
import { PENDING_PHOTO_COOKIE } from "@/lib/analysis/resume";
import {
  getGooglePlayProduct,
  restoreGooglePlayPurchases,
  startGooglePlayPurchase,
} from "@/lib/payments/google-play-client";
import { PADDLE_CHECKOUT_COMPLETED_EVENT } from "@/lib/payments/paddle-client-events";
import { usePaymentChannel } from "@/lib/payments/use-payment-channel";
import { createZazzlePrintCheckout } from "@/lib/printing/zazzle-client";
import { PET_DEMO_RESULT } from "@/lib/rarity/pet-config";

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/client");
  return createClient();
}

type IconProps = { className?: string };
type FlowState =
  | "idle"
  | "restoring"
  | "auth"
  | "checkout"
  | "verifying"
  | "naming"
  | "processing"
  | "completed"
  | "retry"
  | "refund_pending"
  | "refunded"
  | "error";

type AppProps = {
  initialUser: { id: string; email: string | null } | null;
  initialCreditBalance: number;
  initialAnalysis: PublicAnalysis | null;
  shouldRestorePendingPhoto: boolean;
  supabaseConfigured: boolean;
  paddleConfigured: boolean;
  googlePlayConfigured: boolean;
  zazzlePrintEnabled: boolean;
  paddleEnvironment: "sandbox" | "production";
};

function Star({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 1.5 2.65 7.22 7.65.28-6.02 4.73 2.1 7.35L12 16.8l-6.38 4.28 2.1-7.35L1.7 9l7.65-.28L12 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Camera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 7.5h3.1l1.5-2h5.8l1.5 2h3.1A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V9a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="13.3" r="3.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function Upload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v4A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Printer() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 8V3.5h10V8M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6.5H7V14Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.5" cy="11.5" r=".8" fill="currentColor" />
    </svg>
  );
}

const AUTOMATIC_CARD_STYLE = "pet" as const;
const HERO_CARD_DEMOS = [
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

const PENDING_CARD_RESULT: AcceptedAnalysis = {
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

function readPhoto(file: File) {
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

function flowForAnalysis(analysis: PublicAnalysis): FlowState {
  switch (analysis.status) {
    case "awaiting_upload":
      return "restoring";
    case "awaiting_payment":
      return "checkout";
    case "payment_pending":
      return "verifying";
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

function setPendingPhotoHint(pending: boolean) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PENDING_PHOTO_COOKIE}=${pending ? "1" : ""}; Path=/; SameSite=Lax; Max-Age=${pending ? 86400 : 0}${secure}`;
}

function clearResumeQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("resume")) return;
  url.searchParams.delete("resume");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function RarityApp({
  initialUser,
  initialCreditBalance,
  initialAnalysis,
  shouldRestorePendingPhoto,
  supabaseConfigured,
  paddleConfigured,
  googlePlayConfigured,
  zazzlePrintEnabled,
  paddleEnvironment,
}: AppProps) {
  const paymentChannel = usePaymentChannel();
  const [flow, setFlow] = useState<FlowState>(() =>
    initialAnalysis
      ? flowForAnalysis(initialAnalysis)
      : shouldRestorePendingPhoto
        ? "restoring"
        : "idle",
  );
  const [checkoutPromptOpen, setCheckoutPromptOpen] = useState(
    initialAnalysis?.status === "awaiting_payment",
  );
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [playPrice, setPlayPrice] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(
    initialAnalysis?.photoUrl ?? null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(
    initialAnalysis?.id ?? null,
  );
  const [result, setResult] = useState<AcceptedAnalysis | null>(
    initialAnalysis?.result ?? null,
  );
  const [petName, setPetName] = useState("");
  const [petPronouns, setPetPronouns] = useState<PetPronouns>("they");
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [email, setEmail] = useState("");
  const [authSent, setAuthSent] = useState(false);
  const [shareReady, setShareReady] = useState(false);
  const [shareLabel, setShareLabel] = useState("Preparing share...");
  const [printLabel, setPrintLabel] = useState("Order a printed card");
  const [printBusy, setPrintBusy] = useState(false);
  const [heroDemoIndex, setHeroDemoIndex] = useState(0);
  const [creditBalance, setCreditBalance] = useState(initialCreditBalance);
  const uploadInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const petNameInput = useRef<HTMLInputElement>(null);
  const exportCardRef = useRef<HTMLElement>(null);
  const cachedShareAsset = useRef<ShareAsset | null>(null);
  const playRestoreAttempted = useRef(false);
  const heroDemo = HERO_CARD_DEMOS[heroDemoIndex];

  const applyStatus = useCallback((analysis: PublicAnalysis) => {
    if (analysis.photoUrl) setPhoto(analysis.photoUrl);
    if (
      ["completed", "photo_rejected", "failed", "refunded"].includes(
        analysis.status,
      )
    ) {
      setPendingPhotoHint(false);
      void clearPendingPhoto().catch(() => undefined);
    }
    if (analysis.status === "completed" && analysis.result) {
      setResult(analysis.result);
      setFlow("completed");
      setMessage(null);
    } else if (analysis.status === "photo_rejected") {
      setFlow("retry");
      setMessage(
        analysis.rejectionMessage ||
          "The AI could not use this photo. This response used one card credit.",
      );
    } else if (analysis.status === "refund_pending") {
      setFlow("refund_pending");
      setMessage("Refund started. Your payment provider may need to approve it.");
    } else if (analysis.status === "refunded") {
      setFlow("refunded");
      setMessage("Your refund was approved.");
    } else if (analysis.status === "awaiting_name") {
      setFlow("naming");
      setMessage(null);
    } else if (["paid", "processing"].includes(analysis.status)) {
      setFlow("processing");
      setMessage(null);
    } else if (analysis.status === "payment_pending") {
      setFlow("verifying");
    } else if (analysis.status === "awaiting_payment") {
      setFlow("checkout");
      setCheckoutPromptOpen(true);
    } else if (analysis.status === "failed") {
      setFlow("error");
      setMessage("A technical failure stopped this card. Your credit was returned.");
    }
  }, []);

  const refreshAnalysis = useCallback(async (id: string) => {
    const response = await fetch(`/api/analyses/${id}`, { cache: "no-store" });
    if (!response.ok) return null;
    const analysis = (await response.json()) as PublicAnalysis;
    applyStatus(analysis);
    return analysis;
  }, [applyStatus]);

  const refreshCreditBalance = useCallback(async () => {
    if (!initialUser) return;
    const response = await fetch("/api/account?view=balance", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const account = await response.json();
    if (typeof account.creditBalance === "number") {
      setCreditBalance(account.creditBalance);
    }
  }, [initialUser]);

  const confirmCreditPurchase = useCallback(async (id: string) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const response = await fetch(`/api/analyses/${id}`, { cache: "no-store" });
      if (!response.ok) continue;
      const analysis = (await response.json()) as PublicAnalysis;
      if (analysis.status !== "awaiting_payment") {
        applyStatus(analysis);
        setCheckoutBusy(false);
        void refreshCreditBalance();
        return;
      }
    }
    setCheckoutBusy(false);
    setFlow("checkout");
    setCheckoutPromptOpen(true);
    setMessage("Payment is complete. Your credits are still being confirmed; try again shortly.");
  }, [applyStatus, refreshCreditBalance]);

  useEffect(() => {
    const handleHostedCheckoutCompleted = () => {
      if (!analysisId) return;
      setCheckoutBusy(true);
      setFlow("verifying");
      void confirmCreditPurchase(analysisId);
    };
    window.addEventListener(
      PADDLE_CHECKOUT_COMPLETED_EVENT,
      handleHostedCheckoutCompleted,
    );
    return () =>
      window.removeEventListener(
        PADDLE_CHECKOUT_COMPLETED_EVENT,
        handleHostedCheckoutCompleted,
      );
  }, [analysisId, confirmCreditPurchase]);

  useEffect(() => {
    if (paymentChannel !== "google_play") return;
    let cancelled = false;
    void getGooglePlayProduct()
      .then((product) => {
        if (!cancelled) setPlayPrice(product.formattedPrice);
      })
      .catch(() => {
        if (!cancelled) setPlayPrice(null);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentChannel]);

  useEffect(() => {
    if (
      paymentChannel !== "google_play" ||
      !initialUser ||
      playRestoreAttempted.current
    ) {
      return;
    }
    playRestoreAttempted.current = true;
    void restoreGooglePlayPurchases(analysisId ?? undefined)
      .then((restored) => {
        const resumed = restored.find((purchase) => purchase.analysisId);
        if (resumed?.analysisId) {
          setFlow("verifying");
          void confirmCreditPurchase(resumed.analysisId);
        } else if (restored.length > 0) {
          void refreshCreditBalance();
        }
      })
      .catch(() => undefined);
  }, [
    analysisId,
    confirmCreditPurchase,
    initialUser,
    paymentChannel,
    refreshCreditBalance,
  ]);

  const uploadNewAnalysis = useCallback(async (file: File) => {
    setMessage(null);
    const response = await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardStyle: AUTOMATIC_CARD_STYLE,
        mimeType: file.type,
        size: file.size,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not start the upload.");

    const supabase = await getSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from("analysis-photos")
      .uploadToSignedUrl(payload.upload.path, payload.upload.token, file, {
        contentType: file.type,
      });
    if (uploadError) throw new Error("The photo upload failed. Please try again.");

    const confirmed = await fetch(`/api/analyses/${payload.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upload_complete" }),
    });
    const confirmedPayload = await confirmed.json();
    if (!confirmed.ok) {
      throw new Error(confirmedPayload.error || "The photo could not be verified.");
    }

    setAnalysisId(payload.id);
    await clearPendingPhoto().catch(() => undefined);
    setPendingPhotoHint(false);
    clearResumeQuery();
    const nextFlow =
      confirmedPayload.status === "paid"
        ? "processing"
        : confirmedPayload.status === "awaiting_name"
          ? "naming"
          : "checkout";
    setFlow(nextFlow);
    setCheckoutPromptOpen(nextFlow === "checkout");
  }, []);

  const acceptPhoto = useCallback(async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    setMessage(null);

    const preview = await readPhoto(file);
    setPhoto(preview);
    setSelectedFile(file);
    setAnalysisId(null);
    setResult(null);
    setCheckoutPromptOpen(false);
    cachedShareAsset.current = null;
    setShareReady(false);
    setShareLabel("Preparing share...");
    setPrintBusy(false);
    setPrintLabel("Order a printed card");
    await savePendingPhoto(file, AUTOMATIC_CARD_STYLE);
    setPendingPhotoHint(true);

    if (!initialUser) {
      setFlow("auth");
      return;
    }
    const hasCredit = creditBalance > 0;
    setFlow(hasCredit ? "naming" : "checkout");
    setCheckoutPromptOpen(!hasCredit);
    await uploadNewAnalysis(file);
  }, [creditBalance, initialUser, uploadNewAnalysis]);

  useEffect(() => {
    if (
      photo ||
      result ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setHeroDemoIndex((current) => (current + 1) % HERO_CARD_DEMOS.length);
    }, 3600);
    return () => window.clearInterval(timer);
  }, [photo, result]);

  useEffect(() => {
    localStorage.removeItem("rarely-analysis-id");
    if (!initialUser || !supabaseConfigured) return;

    if (initialAnalysis) {
      setPendingPhotoHint(false);
      clearResumeQuery();
      void clearPendingPhoto().catch(() => undefined);
      return;
    }
    if (!shouldRestorePendingPhoto) return;

    let cancelled = false;
    void loadPendingPhoto()
      .then(async (pending) => {
        if (cancelled) return;
        if (!pending) {
          setPendingPhotoHint(false);
          clearResumeQuery();
          setFlow("idle");
          return;
        }
        setSelectedFile(pending.file);
        setPhoto(await readPhoto(pending.file));
        if (cancelled) return;
        await uploadNewAnalysis(pending.file);
      })
      .catch(() => {
        if (cancelled) return;
        setFlow("error");
        setMessage("Your saved photo could not be restored. Please add it again.");
      });

    return () => {
      cancelled = true;
    };
  }, [
    initialAnalysis,
    initialUser,
    shouldRestorePendingPhoto,
    supabaseConfigured,
    uploadNewAnalysis,
  ]);

  useEffect(() => {
    if (
      !analysisId ||
      !["processing", "refund_pending"].includes(flow)
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshAnalysis(analysisId);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [analysisId, flow, refreshAnalysis]);

  useEffect(() => {
    const modalOpen =
      ["restoring", "auth", "verifying", "naming", "processing", "completed", "retry", "refund_pending", "refunded"].includes(flow) ||
      (flow === "checkout" && checkoutPromptOpen);
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [checkoutPromptOpen, flow]);

  useEffect(() => {
    if (flow !== "completed" || !photo || !result) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const card = exportCardRef.current;
      if (!card) return;
      void createShareAsset(card)
        .then((asset) => {
          if (cancelled) return;
          cachedShareAsset.current = asset;
          setShareReady(true);
          setShareLabel("Share my card");
        })
        .catch(() => setShareLabel("Couldn’t prepare card"));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [flow, photo, result]);

  async function startCheckout(
    provider: "paddle" | "google_play",
  ) {
    if (checkoutBusy) return;
    if (
      !analysisId ||
      (provider === "paddle" && !paddleConfigured) ||
      (provider === "google_play" &&
        (paymentChannel !== "google_play" || !googlePlayConfigured))
    ) {
      setMessage("Checkout is not configured yet.");
      return;
    }
    setCheckoutBusy(true);
    setMessage(null);
    let response: Response;
    try {
      response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId, provider }),
      });
    } catch {
      setMessage("Checkout could not be opened. Check your connection and try again.");
      setCheckoutBusy(false);
      return;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || "Checkout could not be opened.");
      setCheckoutBusy(false);
      return;
    }
    if (provider === "google_play") {
      try {
        await startGooglePlayPurchase({
          purchaseId: payload.purchaseId,
          analysisId,
        });
        setFlow("verifying");
        void confirmCreditPurchase(analysisId);
      } catch (error) {
        setCheckoutBusy(false);
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(
          error instanceof Error
            ? error.message
            : "Google Play checkout could not be completed.",
        );
      }
      return;
    }
    try {
      const { initializePaddle } = await import("@paddle/paddle-js");
      const paddle = await initializePaddle({
        token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!,
        environment: paddleEnvironment,
        eventCallback: (event) => {
          if (event.name === "checkout.completed") {
            setFlow("verifying");
            void confirmCreditPurchase(analysisId);
          } else if (event.name === "checkout.closed") {
            setCheckoutBusy(false);
          }
        },
        checkout: {
          settings: {
            displayMode: "overlay",
            theme: "light",
            allowLogout: false,
            showAddDiscounts: false,
          },
        },
      });
      if (!paddle) throw new Error("paddle_not_initialized");
      paddle.Checkout.open({ transactionId: payload.transactionId });
    } catch {
      setMessage("Checkout could not be opened. Please try again.");
      setCheckoutBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabaseConfigured) {
      setMessage("Authentication is not configured yet.");
      return;
    }
    const redirectTo = `${window.location.origin}/auth/callback?next=/?resume=1`;
    const supabase = await getSupabaseClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  async function signOut() {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage("Could not sign out. Please try again.");
      return;
    }
    setPendingPhotoHint(false);
    await clearPendingPhoto().catch(() => undefined);
    window.location.replace("/");
  }

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    if (!email || !supabaseConfigured) return;
    const redirectTo = `${window.location.origin}/auth/callback?next=/?resume=1`;
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setMessage("That sign-in link could not be sent.");
      return;
    }
    setAuthSent(true);
  }

  async function submitPetName(event: FormEvent) {
    event.preventDefault();
    const name = petName.trim();
    if (!analysisId || !name) {
      petNameInput.current?.focus();
      return;
    }

    setMessage(null);
    const response = await fetch(`/api/analyses/${analysisId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_pet_name",
        petName: name,
        pronouns: petPronouns,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "That name could not be saved.");
      if (payload.needsCredits) {
        setFlow("checkout");
        setCheckoutPromptOpen(true);
      }
      return;
    }
    setPetName(name);
    if (typeof payload.creditBalance === "number") {
      setCreditBalance(payload.creditBalance);
    }
    setFlow("processing");
  }

  async function shareResult() {
    const asset = cachedShareAsset.current;
    if (!asset || !result) return;
    try {
      if (navigator.share && navigator.canShare?.({ files: [asset.file] })) {
        await navigator.share({
          files: [asset.file],
          title: `${result.petName || "My pet"} — ${result.cardTitle}`,
          text: `${result.fieldNote || result.signatureRead.thought} Not built to blend in.`,
        });
        setShareLabel("Shared");
      } else {
        const download = document.createElement("a");
        download.href = asset.dataUrl;
        download.download = "rarely-card.png";
        download.click();
        setShareLabel("Image saved");
      }
    } catch (error) {
      setShareLabel(
        error instanceof DOMException && error.name === "AbortError"
          ? "Share my card"
          : "Try sharing again",
      );
    }
  }

  async function orderPrint() {
    const asset = cachedShareAsset.current;
    if (!analysisId || !asset || !zazzlePrintEnabled) return;

    setPrintBusy(true);
    setPrintLabel("Preparing Zazzle checkout…");
    try {
      const checkoutUrl = await createZazzlePrintCheckout(analysisId, asset.file);
      window.location.assign(checkoutUrl);
    } catch (error) {
      setPrintLabel(
        error instanceof Error ? error.message : "Try print checkout again",
      );
      setPrintBusy(false);
    }
  }

  function returnToHomepage() {
    setPendingPhotoHint(false);
    void clearPendingPhoto().catch(() => undefined);
    cachedShareAsset.current = null;
    setAnalysisId(null);
    setSelectedFile(null);
    setPhoto(null);
    setResult(null);
    setMessage(null);
    setFlow("idle");
    window.history.replaceState(null, "", window.location.pathname);
  }

  function reportClientError(error: unknown) {
    setFlow("error");
    setMessage(
      error instanceof Error ? error.message : "Something went wrong. Please try again.",
    );
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void acceptPhoto(file).catch(reportClientError);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void acceptPhoto(file).catch(reportClientError);
  }

  const busyLabel =
    flow === "verifying" ? "Confirming your payment" : "Making their card";
  const busyCopy =
    flow === "verifying"
      ? "Payment is complete. We are confirming it before their card begins."
      : "One credit is reserved. A technical failure returns it automatically.";
  const progressStage = flow === "processing" ? 1 : 0;
  const heroCardResult = result || (photo ? PENDING_CARD_RESULT : heroDemo.result);
  const heroCardPhoto = photo || heroDemo.image;
  const checkoutAvailable =
    (paymentChannel === "google_play" && googlePlayConfigured) ||
    (paymentChannel === "web" && paddleConfigured);
  const primaryProvider =
    paymentChannel === "google_play"
      ? ("google_play" as const)
      : ("paddle" as const);
  const checkoutPrice =
    paymentChannel === "google_play" ? playPrice : paymentChannel === "web" ? "$5" : null;

  return (
    <main className="app">
      <div className="dot-field" aria-hidden="true" />

      {flow === "restoring" && (
        <section className="flow-overlay" aria-live="polite">
          <div className="flow-dialog">
            <span className="pixel-label">YOUR PHOTO IS SAFE</span>
            <h2>PICKING UP<br /><em>WHERE YOU LEFT OFF.</em></h2>
            <p>
              Restoring their photo and the next step of their card.
            </p>
          </div>
        </section>
      )}

      {["verifying", "processing"].includes(flow) && photo && (
        <section className="analysis-overlay" aria-live="polite">
          <div className="analysis-noise" />
          <div className="analysis-shell">
            <div className="analysis-topline">
              <span>RLY / CARD CHECKOUT</span>
              <span>
                {flow === "processing"
                  ? "1 CREDIT RESERVED · MAKING THEIRS"
                  : "PAYMENT COMPLETE · ADDING 5 CREDITS"}
              </span>
            </div>
            <div className="scan-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" />
              <div className="scan-grid" />
              <div className="scan-line" />
            </div>
            <div className="analysis-copy">
              <span className="analysis-kicker">
                {flow === "processing" ? "THEIR CARD IS UNDERWAY" : "PAYMENT RECEIVED"}
              </span>
              <h2>{busyLabel}<i>...</i></h2>
              <p>{busyCopy}</p>
              <div className="analysis-progress">
                {["Confirm credit", "Make their card"].map((step, index) => (
                  <div
                    className={
                      index < progressStage
                        ? "complete"
                        : index === progressStage
                          ? "current"
                          : ""
                    }
                    key={step}
                  >
                    <span>0{index + 1}</span><b>{step}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {flow === "auth" && photo && (
        <section className="flow-overlay" aria-label="Sign in to continue">
          <div className="flow-dialog photo-flow-dialog">
            <figure className="photo-flow-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={`The photo you chose of ${petName || "your pet"}`} />
              <figcaption>THE PHOTO YOU CHOSE <span>★</span></figcaption>
            </figure>
            <div className="photo-flow-copy">
              <span className="pixel-label">SIGN IN · THEN USE A CREDIT</span>
              <h2>KEEP THIS LOOK.<br /><em>FINISH THE CARD.</em></h2>
              <p>
                Google briefly takes you away and brings you right back to this
                photo. If you already have a card credit, we continue. If not,
                one $5 pack adds five.
              </p>
              <button type="button" className="google-button" onClick={signInWithGoogle}>
                Continue with Google
              </button>
              <form onSubmit={sendMagicLink}>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address"
                  required
                />
                <button type="submit">Send my sign-in link</button>
              </form>
              {authSent && <strong>Check your inbox. Their photo is staying right here.</strong>}
              <button className="text-button" type="button" onClick={() => setFlow("idle")}>
                Not yet
              </button>
            </div>
          </div>
        </section>
      )}

      {flow === "checkout" && checkoutPromptOpen && photo && (
        <section className="flow-overlay" aria-label="Make your pet's card">
          <div className="flow-dialog photo-flow-dialog">
            <figure className="photo-flow-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={`The photo you chose of ${petName || "your pet"}`} />
              <figcaption>THIS IS THE ONE <span>★</span></figcaption>
            </figure>
            <div className="photo-flow-copy checkout-flow-copy">
              <span className="pixel-label">
                PHOTO READY · FIVE CREDITS
                {checkoutPrice ? ` FOR ${checkoutPrice.toUpperCase()}` : ""}
              </span>
              <h2>THEY GAVE YOU<br /><em>THIS MOMENT.</em></h2>
              <p>
                Five chances to turn the looks only you understand into cards
                you&apos;ll want to keep and share.
              </p>
              <button
                type="button"
                className="checkout-button"
                disabled={checkoutBusy || !analysisId || !checkoutAvailable}
                onClick={() => void startCheckout(primaryProvider)}
              >
                {checkoutBusy
                  ? "Opening checkout…"
                  : !analysisId || paymentChannel === "loading"
                  ? "Preparing secure checkout…"
                  : paymentChannel === "play_unavailable"
                    ? "Google Play Billing unavailable"
                    : paymentChannel === "google_play" && !googlePlayConfigured
                      ? "Google Play checkout temporarily unavailable"
                    : `Pay${checkoutPrice ? ` ${checkoutPrice}` : ""} · Get 5 card credits`}
              </button>
              {paymentChannel === "play_unavailable" && (
                <small>
                  Update Chrome or reopen Rarely from Google Play. Web checkout
                  is disabled inside the Android app.
                </small>
              )}
              <small>One-time payment · No subscription · Buy another pack anytime</small>
              <button
                type="button"
                className="text-button"
                onClick={() => setCheckoutPromptOpen(false)}
              >
                Not now
              </button>
              {message && <strong role="alert">{message}</strong>}
            </div>
          </div>
        </section>
      )}

      {flow === "naming" && (
        <section className="flow-overlay" aria-label="Name your pet">
          <div className="flow-dialog naming-dialog">
            <span className="pixel-label">
              {creditBalance} CREDIT{creditBalance === 1 ? "" : "S"} READY · ONE LAST THING
            </span>
            <h2>WHAT DO THEY<br /><em>ANSWER TO?</em></h2>
            <p>
              Give us the name that belongs at the top of the card. Then we read
              the photograph.
            </p>
            <form className="naming-form" onSubmit={submitPetName}>
              <input
                ref={petNameInput}
                type="text"
                value={petName}
                onChange={(event) => setPetName(event.target.value)}
                placeholder="Their name"
                maxLength={30}
                autoComplete="off"
                autoFocus
                required
              />
              <fieldset className="pronoun-picker">
                <legend>How should the card refer to them?</legend>
                {[
                  ["he", "He / him"],
                  ["she", "She / her"],
                  ["they", "They / them"],
                ].map(([value, label]) => (
                  <label
                    className={petPronouns === value ? "selected" : ""}
                    key={value}
                  >
                    <input
                      type="radio"
                      name="pet-pronouns"
                      value={value}
                      checked={petPronouns === value}
                      onChange={() => setPetPronouns(value as PetPronouns)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
              <button type="submit" disabled={!analysisId}>
                {analysisId ? "Make their card →" : "Preparing their photo…"}
              </button>
            </form>
            {message && <strong>{message}</strong>}
          </div>
        </section>
      )}

      {(flow === "retry" || flow === "refund_pending" || flow === "refunded") && (
        <section className="flow-overlay" aria-live="polite">
          <div className="flow-dialog">
            <span className="pixel-label">
              {flow === "retry" ? "AI RESPONSE COMPLETE · 1 CREDIT USED" : "PAYMENT UPDATE"}
            </span>
            <h2>
              {flow === "retry" ? <>WE NEED MORE<br /><em>OF THEM.</em></> : <>REFUND<br /><em>STARTED.</em></>}
            </h2>
            <p>{message}</p>
            {flow === "retry" && (
              <>
                <button type="button" onClick={() => uploadInput.current?.click()}>
                  Try another photo — uses 1 credit
                </button>
                <a className="text-button" href="/account">View credits and purchases</a>
              </>
            )}
          </div>
        </section>
      )}

      {flow === "completed" && photo && result && (
        <section className="result-screen" aria-label="Your rarity card result">
          <div className="story-result">
            <ShareCard photo={photo} result={result} ref={exportCardRef} />
            <div className="result-primary-actions">
              <button
                className="share-only-button"
                type="button"
                onClick={shareResult}
                disabled={!shareReady}
              >
                <span>{shareLabel}</span><i><Upload /></i>
              </button>
              {zazzlePrintEnabled && (
                <button
                  className="share-only-button print-order-button"
                  type="button"
                  onClick={() => void orderPrint()}
                  disabled={!shareReady || printBusy}
                >
                  <span>{printLabel}</span><i><Printer /></i>
                </button>
              )}
              {zazzlePrintEnabled && (
                <small className="print-provider-note">
                  Printing, payment, and delivery by Zazzle
                </small>
              )}
            </div>
            <div className="result-account-actions">
              <button type="button" onClick={() => uploadInput.current?.click()}>
                Make another · {creditBalance} left
              </button>
              <a href="/account">View all my cards</a>
              <button type="button" onClick={returnToHomepage}>
                Back to homepage
              </button>
            </div>
          </div>
        </section>
      )}

      <header className="nav">
        <a className="brand" href="#">RARELY <span><Star /></span></a>
        <div className="nav-center">
          <a href="#example">See an example</a>
          <a href="/pricing">Pricing</a>
          <a href="#stats">Why you&apos;ll keep it</a>
          <a href="#how">How it works</a>
        </div>
        {initialUser ? (
          <div className="nav-account">
            <a href="/account"><i /> {creditBalance} credits · Account</a>
            <button type="button" onClick={() => void signOut()}>Sign out</button>
          </div>
        ) : (
          <a className="nav-button" href="#maker">
            Make a card <span>→</span>
          </a>
        )}
      </header>

      <section className="hero" id="maker">
        <div className="hero-burst burst-one" aria-hidden="true"><Star /></div>
        <div className="hero-content">
          <div className="mini-tag"><span>AI PET CARDS</span> CAT OR DOG · 5 CARD CREDITS · $5</div>
          <h1>PET PHOTO<span>→ STORY CARD.</span></h1>
          <p className="hero-copy">
            Upload the photo that feels most like them. We turn that one look into
            a one-of-one card with the voice you already hear in your head—funny,
            specific, and unmistakably theirs.
          </p>
          <div className="upload-instruction">
            <span>01</span>
            <div>
              <small>SHOW US THEIR WORLD</small>
              <strong>ADD THEIR PHOTO</strong>
              <p>Close-up or full scene. One clear cat or dog. Let the room tell on them.</p>
            </div>
            <i aria-hidden="true">↓</i>
          </div>
          <div
            className={`photo-actions ${dragging ? "is-dragging" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} hidden />
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={handleFile} hidden />
            <button className="action-button selfie-button" type="button" onClick={() => cameraInput.current?.click()}>
              <span className="action-icon"><Camera /></span>
              <span><b>TAKE THEIR PHOTO</b><small>Open your camera</small></span>
            </button>
            <span className="action-or">OR</span>
            <button className="action-button upload-button" type="button" onClick={() => uploadInput.current?.click()}>
              <span className="action-icon"><Upload /></span>
              <span><b>{selectedFile ? "CHOOSE A DIFFERENT PHOTO" : "UPLOAD THEIR PHOTO"}</b><small>Pick from your camera roll</small></span>
            </button>
          </div>
          <p className="upload-consent">
            By adding a photo, you confirm you may use it and consent to private AI
            processing under our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
          </p>
          <button
            className="reveal-cta"
            type="button"
            disabled={flow !== "checkout"}
            onClick={() => setCheckoutPromptOpen(true)}
          >
            <span>
              {flow === "checkout"
                ? `Get 5 card credits${checkoutPrice ? ` — ${checkoutPrice}` : ""}`
                : selectedFile
                  ? initialUser
                    ? "Preparing secure checkout"
                    : "Sign in to continue"
                  : "Start with a pet photo ↑"}
            </span>
            <span className="cta-ball" aria-hidden="true"><i /></span>
          </button>
          <p className="privacy">
            <span>◆</span> Private upload · Saved securely with completed cards · 5 attempts for $5
          </p>
          {message && flow !== "retry" && <p className="photo-error" role="alert">{message}</p>}
        </div>

        <div className="card-zone">
          <div className="card-label label-top">
            {photo ? "YOUR PHOTO" : "REAL CARD PREVIEW"} <span>★</span>
          </div>
          <div className="card-label label-side">DOWNLOADABLE · 9:16</div>
          <div className="hero-story-card" key={photo || result ? "active-card" : heroDemo.image}>
            <ShareCard
              photo={heroCardPhoto}
              result={heroCardResult}
              pending={Boolean(photo && !result)}
              photoPriority
            />
          </div>
          <div className="card-shadow-pink" aria-hidden="true" />
        </div>
      </section>

      <section className="clarity-section" id="example">
        <div className="clarity-heading">
          <span className="pixel-label">WHAT RARELY ACTUALLY DOES</span>
          <h2>ONE PHOTOGRAPH GOES IN.<br />A CARD ONLY <em>THEY</em> COULD WEAR COMES OUT.</h2>
          <p>
            This is not a breed test or a generic compliment generator. We use
            visible evidence from the whole frame to make one funny, specific,
            emotionally honest card you can save or post.
          </p>
        </div>
        <div className="clarity-grid">
          <article className="clarity-step">
            <span className="clarity-number">01</span>
            <figure>
              <Image
                src="/pets/window-cat.jpg"
                alt="Cat watching a pink sunset through an open window"
                fill
                sizes="(max-width: 760px) 92vw, 30vw"
              />
              <figcaption>ONE CLEAR CAT OR DOG</figcaption>
            </figure>
            <h3>YOU SEND THE PHOTO</h3>
            <p>Close-up or full scene. We want the ears, stare, posture, light, and little territory they claimed.</p>
          </article>
          <article className="clarity-step clarity-read">
            <span className="clarity-number">02</span>
            <figure>
              <Image
                src="/pets/quiet-dog.jpg"
                alt="Beagle looking directly into the camera"
                fill
                sizes="(max-width: 760px) 92vw, 30vw"
              />
              <div className="trait-tags" aria-hidden="true">
                <i>AURA</i><i>SCENE LORE</i><i>DRAMA</i><i>GAZE</i>
              </div>
            </figure>
            <h3>WE READ THE WHOLE FRAME</h3>
            <p>No breed quiz. No personality form. Cat or dog is automatic; every claim must be visible in the image.</p>
          </article>
          <article className="clarity-step clarity-output">
            <span className="clarity-number">03</span>
            <div className="clarity-card-preview">
              <ShareCard
                photo={HERO_CARD_DEMOS[0].image}
                result={HERO_CARD_DEMOS[0].result}
              />
            </div>
            <h3>YOU GET THEIR CARD</h3>
            <p>Their look, their imagined voice, their one-of-one card—ready to keep or send to everyone who knows them.</p>
          </article>
        </div>
        <blockquote>
          YOU TOOK A THOUSAND PHOTOS BECAUSE SOME PART OF YOU UNDERSTOOD.
        </blockquote>
      </section>

      <section className="stats-strip" id="stats">
        <div className="ticker">
          <span>★ THE PHOTO YOU KEEP COMING BACK TO</span><span>★ THE PHOTO YOU KEEP COMING BACK TO</span>
          <span>★ THE PHOTO YOU KEEP COMING BACK TO</span><span>★ THE PHOTO YOU KEEP COMING BACK TO</span>
        </div>
        <div className="stats-content">
          <div className="stats-heading">
            <span className="pixel-label">THE LOOK ONLY YOU UNDERSTAND</span>
            <h2>DON&apos;T JUST SAVE<br />THE PHOTO. <em>SAVE THE LOOK.</em></h2>
            <p>
              Your camera roll holds the moment. Rarely gives it the voice you
              already hear—the line that makes you laugh because it could only be them.
            </p>
          </div>
          <div className="keepsake-proof">
            <span>THE REACTION WE&apos;RE AFTER</span>
            <blockquote>“THAT IS<br />SO THEM.”</blockquote>
            <p>
              The instant send-to-everyone kind of recognition. One photo becomes
              a card that feels less like content and more like an inside joke you get to keep.
            </p>
            <a href="#maker">Get 5 card credits — $5 <b>→</b></a>
          </div>
        </div>
      </section>

      <section className="how" id="how">
        <span className="pixel-label">THEY HAVE BEEN SAYING IT WITH THEIR FACE.</span>
        <h2>YOU KNOW THE LOOK.<br /><em>WE PUT IT ON A CARD.</em></h2>
        <div className="steps">
          {[
            ["01", "WE CATCH THE LOOK", "The stare, ears, posture, and tiny details that make you say, “there you are.”"],
            ["02", "WE FIND THEIR VOICE", "A funny inner thought that sounds like the version of them already living in your head."],
            ["03", "YOU KEEP THE PROOF", "A polished one-of-one card made to save, share, and send to everyone who knows them."],
          ].map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span><div className={`step-icon step-${number}`}><Star /><i /></div>
              <h3>{title}</h3><p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <footer>
        <a className="brand footer-brand" href="#">RARELY <span><Star /></span></a>
        <p>Not built to blend in.</p>
        <span className="footer-links">
          <a href="/pricing">Pricing</a> · <a href="/refund-policy">Refunds</a> ·{" "}
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> ·{" "}
          <a href="/contact">Contact</a>
        </span>
      </footer>
    </main>
  );
}
