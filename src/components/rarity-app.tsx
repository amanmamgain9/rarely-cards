"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import {
  clearPendingPhoto,
  savePendingPhoto,
} from "@/lib/pending-photo";
import {
  createShareAsset,
  type ShareAsset,
} from "@/components/share-card";
import type {
  AcceptedAnalysis,
  PetPronouns,
} from "@/lib/analysis/types";
import {
  startGooglePlayPurchase,
} from "@/lib/payments/google-play-client";
import { usePaymentRuntime } from "@/lib/payments/use-payment-channel";
import { createZazzlePrintCheckout } from "@/lib/printing/zazzle-client";
import {
  RarityFlowLayers,
  RarityResultScreen,
} from "@/components/rarity/rarity-flow-layers";
import { RarityMaker } from "@/components/rarity/rarity-maker";
import { RarityMarketing } from "@/components/rarity/rarity-marketing";
import { useHeroDemo } from "@/components/rarity/hero-demo-store";
import { PendingPhotoResume } from "@/components/rarity/workflow-effects";
import { useRarelyWorkflowContext } from "@/components/rarity/rarely-workflow-provider";
import {
  AUTOMATIC_CARD_STYLE,
  clearResumeQuery,
  flowForAnalysis,
  flowForWorkflow,
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
      ? initialAnalysis.status === "awaiting_payment" && initialCreditBalance > 0
        ? "naming"
        : flowForAnalysis(initialAnalysis)
      : shouldRestorePendingPhoto
        ? "restoring"
        : "idle",
  );
  const [checkoutPromptOpen, setCheckoutPromptOpen] = useState(
    initialAnalysis?.status === "awaiting_payment" && initialCreditBalance === 0,
  );
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(
    initialAnalysis?.photoUrl ?? null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const workflow = useRarelyWorkflowContext();
  const { analysisId, setAnalysisId } = workflow;
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
  const uploadInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const petNameInput = useRef<HTMLInputElement>(null);
  const exportCardRef = useRef<HTMLElement>(null);
  const cachedShareAsset = useRef<ShareAsset | null>(null);
  const heroDemo = useHeroDemo();
  const creditBalance = workflow.snapshot.creditBalance;
  const workflowAnalysis =
    workflow.snapshot.analysis?.id === analysisId
      ? workflow.snapshot.analysis
      : null;
  const visibleFlow: FlowState = flowForWorkflow(
    { ...workflow.snapshot, analysis: workflowAnalysis },
    flow,
  );
  const visiblePhoto = workflowAnalysis?.photoUrl ?? photo;
  const visibleResult = workflowAnalysis?.result ?? result;
  const workflowMessage =
    workflowAnalysis?.status === "photo_rejected"
      ? workflowAnalysis.rejectionMessage ||
        "The AI could not use this photo. This response used one card credit."
      : workflowAnalysis?.status === "refund_pending"
        ? "Refund started. Your payment provider may need to approve it."
        : workflowAnalysis?.status === "refunded"
          ? "Your refund was approved."
          : workflowAnalysis?.status === "failed"
            ? "A technical failure stopped this card. Your credit was returned."
            : null;
  const visibleMessage = workflowMessage ?? message;
  const refreshWorkflow = workflow.refresh;

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
  }, [setAnalysisId]);

  const acceptPhoto = useCallback(async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    setMessage(null);
    setCheckoutBusy(false);

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
  }, [creditBalance, initialUser, setAnalysisId, uploadNewAnalysis]);

  const restorePendingPhoto = useCallback(async (pending: {
    file: File;
  }) => {
    setSelectedFile(pending.file);
    setPhoto(await readPhoto(pending.file));
    await uploadNewAnalysis(pending.file);
  }, [uploadNewAnalysis]);
  const handleMissingPendingPhoto = useCallback(() => setFlow("idle"), []);
  const handlePendingPhotoError = useCallback(() => {
    setFlow("error");
    setMessage("Your saved photo could not be restored. Please add it again.");
  }, []);
  const confirmCreditPurchase = useCallback(() => {
    setCheckoutBusy(false);
    setFlow("verifying");
    void refreshWorkflow();
  }, [refreshWorkflow]);

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
        confirmCreditPurchase();
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
            confirmCreditPurchase();
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
    if (typeof payload.creditBalance === "number") {
      workflow.setSnapshot({
        ...workflow.snapshot,
        creditBalance: payload.creditBalance,
      });
    }
    if (!response.ok) {
      setMessage(payload.error || "That name could not be saved.");
      if (payload.needsCredits) {
        setFlow("checkout");
        setCheckoutPromptOpen(true);
      }
      return;
    }
    setPetName(name);
    setFlow("processing");
    void refreshWorkflow();
  }

  async function shareResult() {
    if (!visibleResult || !exportCardRef.current || shareBusy) return;
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
          title: `${visibleResult.petName || "My pet"} — ${visibleResult.cardTitle}`,
          text: `${visibleResult.fieldNote || visibleResult.signatureRead.thought} Not built to blend in.`,
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
    setCheckoutBusy(false);
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
  const heroCardResult = visibleResult || (visiblePhoto ? PENDING_CARD_RESULT : heroDemo.result);
  const heroCardPhoto = visiblePhoto || heroDemo.image;
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

      <PendingPhotoResume
        enabled={Boolean(
          initialUser &&
            supabaseConfigured &&
            (initialAnalysis || shouldRestorePendingPhoto),
        )}
        initialAnalysis={initialAnalysis}
        onMissing={handleMissingPendingPhoto}
        onRestore={restorePendingPhoto}
        onError={handlePendingPhotoError}
      />
      <RarityFlowLayers
        flow={visibleFlow}
        photo={visiblePhoto}
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
        message={visibleMessage}
        creditBalance={creditBalance}
        onSubmitPetName={submitPetName}
        petNameInput={petNameInput}
        onPetNameChange={setPetName}
        petPronouns={petPronouns}
        onPetPronounsChange={setPetPronouns}
      />
      <RarityResultScreen
        flow={visibleFlow}
        photo={visiblePhoto}
        result={visibleResult}
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
        flow={visibleFlow}
        onOpenCheckout={() => setCheckoutPromptOpen(true)}
        checkoutPrice={checkoutPrice}
        message={visibleMessage}
        photo={visiblePhoto}
        result={visibleResult}
        heroDemoImage={heroDemo.image}
        heroCardPhoto={heroCardPhoto}
        heroCardResult={heroCardResult}
      />

      <RarityMarketing />
    </main>
  );
}
