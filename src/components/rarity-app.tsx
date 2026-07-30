"use client";

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
  type ShareAsset,
} from "@/components/share-card";
import type {
  AcceptedAnalysis,
  PetPronouns,
  PublicAnalysis,
} from "@/lib/analysis/types";
import {
  restoreGooglePlayPurchases,
  startGooglePlayPurchase,
} from "@/lib/payments/google-play-client";
import { PADDLE_CHECKOUT_COMPLETED_EVENT } from "@/lib/payments/paddle-client-events";
import { usePaymentRuntime } from "@/lib/payments/use-payment-channel";
import { createZazzlePrintCheckout } from "@/lib/printing/zazzle-client";
import {
  RarityFlowLayers,
  RarityResultScreen,
} from "@/components/rarity/rarity-flow-layers";
import { RarityMaker } from "@/components/rarity/rarity-maker";
import { RarityMarketing } from "@/components/rarity/rarity-marketing";
import {
  AUTOMATIC_CARD_STYLE,
  clearResumeQuery,
  flowForAnalysis,
  HERO_CARD_DEMOS,
  PENDING_CARD_RESULT,
  readPhoto,
  setPendingPhotoHint,
  type FlowState,
  type RarityAppProps,
} from "@/components/rarity/rarity-model";

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/client");
  return createClient();
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
}: RarityAppProps) {
  const { channel: paymentChannel, playPrice } = usePaymentRuntime();
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
  const [shareBusy, setShareBusy] = useState(false);
  const [shareLabel, setShareLabel] = useState("Share my card");
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

  const refreshAnalysis = useCallback(async (id: string, signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/analyses/${id}`, {
        cache: "no-store",
        signal,
      });
      if (!response.ok) return null;
      const analysis = (await response.json()) as PublicAnalysis;
      applyStatus(analysis);
      return analysis;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      return null;
    }
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
    setShareBusy(false);
    setShareLabel("Share my card");
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
    let cancelled = false;
    let timer: number | undefined;
    const controller = new AbortController();
    const poll = async () => {
      await refreshAnalysis(analysisId, controller.signal);
      if (!cancelled) timer = window.setTimeout(poll, 2000);
    };
    timer = window.setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [analysisId, flow, refreshAnalysis]);

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
    if (!result || !exportCardRef.current || shareBusy) return;
    setShareBusy(true);
    setShareLabel("Preparing share…");
    try {
      const asset =
        cachedShareAsset.current ??
        (await createShareAsset(exportCardRef.current));
      cachedShareAsset.current = asset;
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
    } finally {
      setShareBusy(false);
    }
  }

  async function orderPrint() {
    if (
      !analysisId ||
      !exportCardRef.current ||
      !zazzlePrintEnabled ||
      printBusy
    ) {
      return;
    }

    setPrintBusy(true);
    setPrintLabel("Preparing Zazzle checkout…");
    try {
      const asset =
        cachedShareAsset.current ??
        (await createShareAsset(exportCardRef.current));
      cachedShareAsset.current = asset;
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

      <RarityFlowLayers
        flow={flow}
        photo={photo}
        petName={petName}
        busyLabel={busyLabel}
        busyCopy={busyCopy}
        progressStage={progressStage}
        onSignInWithGoogle={() => void signInWithGoogle()}
        onSendMagicLink={sendMagicLink}
        email={email}
        onEmailChange={setEmail}
        authSent={authSent}
        onDismissAuth={() => setFlow("idle")}
        checkoutPromptOpen={checkoutPromptOpen}
        checkoutPrice={checkoutPrice}
        checkoutBusy={checkoutBusy}
        analysisId={analysisId}
        checkoutAvailable={checkoutAvailable}
        onStartCheckout={() => void startCheckout(primaryProvider)}
        paymentChannel={paymentChannel}
        googlePlayConfigured={googlePlayConfigured}
        uploadInput={uploadInput}
        onCloseCheckout={() => setCheckoutPromptOpen(false)}
        message={message}
        creditBalance={creditBalance}
        onSubmitPetName={submitPetName}
        petNameInput={petNameInput}
        onPetNameChange={setPetName}
        petPronouns={petPronouns}
        onPetPronounsChange={setPetPronouns}
      />
      <RarityResultScreen
        flow={flow}
        photo={photo}
        result={result}
        exportCardRef={exportCardRef}
        onShare={() => void shareResult()}
        shareBusy={shareBusy}
        shareLabel={shareLabel}
        zazzlePrintEnabled={zazzlePrintEnabled}
        onOrderPrint={() => void orderPrint()}
        printBusy={printBusy}
        printLabel={printLabel}
        creditBalance={creditBalance}
        uploadInput={uploadInput}
        onReturnHome={returnToHomepage}
      />

      <RarityMaker
        signedIn={Boolean(initialUser)}
        creditBalance={creditBalance}
        onSignOut={() => void signOut()}
        dragging={dragging}
        onDraggingChange={setDragging}
        onDrop={handleDrop}
        uploadInput={uploadInput}
        cameraInput={cameraInput}
        onFileChange={handleFile}
        selectedFile={selectedFile}
        flow={flow}
        onOpenCheckout={() => setCheckoutPromptOpen(true)}
        checkoutPrice={checkoutPrice}
        message={message}
        photo={photo}
        result={result}
        heroDemoImage={heroDemo.image}
        heroCardPhoto={heroCardPhoto}
        heroCardResult={heroCardResult}
      />

      <RarityMarketing />
    </main>
  );
}
