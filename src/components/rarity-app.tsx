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
  savePendingPhoto,
} from "@/lib/pending-photo";
import {
  canUseNativeFileShare,
  createShareAsset,
  downloadShareAsset,
  type ShareAsset,
} from "@/components/share-card";
import type { AcceptedAnalysis } from "@/lib/analysis/types";
import type { PublicVideoGeneration } from "@/lib/video/types";
import type { PetDialogueSuggestion } from "@/lib/video/dialogue";
import {
  startGooglePlayPurchase,
} from "@/lib/payments/google-play-client";
import { usePaymentRuntime } from "@/lib/payments/use-payment-channel";
import { createZazzlePrintCheckout } from "@/lib/printing/zazzle-client";
import {
  RarityFlowLayers,
  RarityResultScreen,
} from "@/components/rarity/rarity-flow-layers";
import { VideoWorkspace } from "@/components/rarity/video-workspace";
import { VoiceWorkspace } from "@/components/rarity/voice-workspace";
import { PendingPhotoResume } from "@/components/rarity/workflow-effects";
import { useRarelyWorkflowContext } from "@/components/rarity/rarely-workflow-provider";
import {
  AUTOMATIC_CARD_STYLE,
  clearResumeQuery,
  flowForAnalysis,
  flowForWorkflow,
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
  legacyCardMode,
  initialAnalysis,
  shouldRestorePendingPhoto,
  paddleConfigured,
  googlePlayConfigured,
  seedanceConfigured,
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
  const [dismissedNamingId, setDismissedNamingId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(
    initialAnalysis?.photoUrl ?? null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const workflow = useRarelyWorkflowContext();
  const { analysisId, setAnalysisId } = workflow;
  const [result, setResult] = useState<AcceptedAnalysis | null>(
    initialAnalysis?.result ?? null,
  );
  const [petName, setPetName] = useState(initialAnalysis?.petName ?? "");
  const [petPronouns, setPetPronouns] = useState<"he" | "she" | "they">(
    initialAnalysis?.result?.pronouns ?? "they",
  );
  const [dialogueSuggestions, setDialogueSuggestions] = useState<PetDialogueSuggestion[]>(
    initialAnalysis?.dialogueSuggestions ?? [],
  );
  const [selectedDialogue, setSelectedDialogue] = useState(
    initialAnalysis?.selectedDialogue ?? "",
  );
  const [customDialogue, setCustomDialogue] = useState("");
  const [suggestionsBusy, setSuggestionsBusy] = useState(
    initialAnalysis?.status === "awaiting_name" &&
      (initialAnalysis.dialogueSuggestions?.length ?? 0) === 0,
  );
  const [suggestionAttempt, setSuggestionAttempt] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareLabel, setShareLabel] = useState("Share my card");
  const [printLabel, setPrintLabel] = useState("Order a printed card");
  const [printBusy, setPrintBusy] = useState(false);
  const [videoGeneration, setVideoGeneration] =
    useState<PublicVideoGeneration | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoShareBusy, setVideoShareBusy] = useState(false);
  const [videoMessage, setVideoMessage] = useState<string | null>(null);
  const [videoMessageAnalysisId, setVideoMessageAnalysisId] =
    useState<string | null>(null);
  const [videoRefreshKey, setVideoRefreshKey] = useState(0);
  const resumedPaidVideo = useRef<string | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const petNameInput = useRef<HTMLInputElement>(null);
  const exportCardRef = useRef<HTMLElement>(null);
  const cachedShareAsset = useRef<ShareAsset | null>(null);
  const creditBalance = workflow.snapshot.creditBalance;
  const resultCreditBalance = legacyCardMode
    ? workflow.snapshot.legacyCardCreditBalance
    : creditBalance;
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
        "The AI could not use this photo. Your video credit was returned."
      : workflowAnalysis?.status === "refund_pending"
        ? "Refund started. Your payment provider may need to approve it."
        : workflowAnalysis?.status === "refunded"
          ? "Your refund was approved."
          : workflowAnalysis?.status === "failed"
            ? "A technical failure stopped this video. Your credit was returned."
            : null;
  const visibleMessage = workflowMessage ?? message;
  const visibleVideoGeneration =
    videoGeneration?.analysisId === analysisId ? videoGeneration : null;
  const visibleVideoMessage =
    videoMessageAnalysisId === analysisId ? videoMessage : null;
  const refreshWorkflow = workflow.refresh;

  useEffect(() => {
    if (!seedanceConfigured || visibleFlow !== "completed" || !analysisId) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loadVideo = async () => {
      try {
        const response = await fetch(`/api/analyses/${analysisId}/video`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("video_status_failed");
        const payload = (await response.json()) as PublicVideoGeneration | null;
        if (cancelled) return;
        if (!payload && workflowAnalysis?.selectedDialogue) {
          const started = await fetch(`/api/analyses/${analysisId}/video`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dialogue: workflowAnalysis.selectedDialogue }),
          });
          const startedPayload = await started.json().catch(() => ({}));
          if (!started.ok) {
            if (started.status === 409) {
              timer = setTimeout(loadVideo, 2_000);
              return;
            }
            throw new Error(startedPayload.error || "video_start_failed");
          }
          if (!cancelled) setVideoGeneration(startedPayload as PublicVideoGeneration);
          timer = setTimeout(loadVideo, 8_000);
          return;
        }
        setVideoGeneration(payload);
        if (payload?.status === "submitting" || payload?.status === "running") {
          timer = setTimeout(loadVideo, 8_000);
        }
      } catch {
        if (!cancelled) {
          setVideoMessageAnalysisId(analysisId);
          setVideoMessage("Video status paused. Refresh to check again.");
        }
      }
    };
    void loadVideo();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [analysisId, seedanceConfigured, videoRefreshKey, visibleFlow, workflowAnalysis?.selectedDialogue]);

  useEffect(() => {
    if (!seedanceConfigured || legacyCardMode || visibleFlow !== "naming" || !analysisId || dialogueSuggestions.length > 0) return;
    let cancelled = false;
    void fetch(`/api/analyses/${analysisId}/dialogue`, { method: "POST" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Suggestions could not be made.");
        if (payload.status === "rejected") {
          if (!cancelled) {
            setDialogueSuggestions([]);
            setSelectedDialogue("");
            setMessage(payload.message || "Choose a clearer photo of one cat or dog.");
            setFlow("retry");
            void refreshWorkflow();
          }
          return;
        }
        if (!cancelled) {
          setDialogueSuggestions(payload.suggestions);
          setSelectedDialogue(payload.suggestions[0]?.line ?? "");
        }
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Suggestions could not be made.");
      })
      .finally(() => {
        if (!cancelled) setSuggestionsBusy(false);
      });
    return () => { cancelled = true; };
  }, [analysisId, dialogueSuggestions.length, legacyCardMode, refreshWorkflow, seedanceConfigured, suggestionAttempt, visibleFlow]);

  useEffect(() => {
    const dialogue = workflowAnalysis?.selectedDialogue;
    if (
      visibleFlow !== "naming" ||
      legacyCardMode ||
      !analysisId ||
      !dialogue ||
      creditBalance < 1 ||
      resumedPaidVideo.current === analysisId
    ) {
      return;
    }
    resumedPaidVideo.current = analysisId;
    void fetch(`/api/analyses/${analysisId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start_talking_video",
        petName: petName.trim() || workflowAnalysis.petName || "My pet",
        dialogue,
      }),
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        resumedPaidVideo.current = null;
        setMessage(payload.error || "Your video could not continue after checkout.");
        return;
      }
      setFlow("processing");
      void refreshWorkflow();
    });
  }, [analysisId, creditBalance, legacyCardMode, petName, refreshWorkflow, visibleFlow, workflowAnalysis?.petName, workflowAnalysis?.selectedDialogue]);

  const uploadNewAnalysis = useCallback(async (file: File) => {
    setMessage(null);
    const response = await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardStyle: AUTOMATIC_CARD_STYLE,
        experienceKind: legacyCardMode ? "card" : "talking_video",
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
    setSuggestionsBusy(nextFlow === "naming");
    setCheckoutPromptOpen(nextFlow === "checkout");
  }, [legacyCardMode, setAnalysisId]);

  const acceptPhoto = useCallback(async (file: File) => {
    if (!seedanceConfigured && !legacyCardMode) {
      setMessage("Talking-pet videos are temporarily unavailable. Please try again shortly.");
      return;
    }
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
    setDialogueSuggestions([]);
    setPetPronouns("they");
    setSelectedDialogue("");
    setCustomDialogue("");
    setCheckoutPromptOpen(false);
    cachedShareAsset.current = null;
    setShareBusy(false);
    setShareLabel("Share my card");
    setPrintBusy(false);
    setPrintLabel("Order a printed card");
    await savePendingPhoto(file, AUTOMATIC_CARD_STYLE);
    setPendingPhotoHint(true);

    const hasCredit = creditBalance > 0;
    setFlow(hasCredit ? "naming" : "checkout");
    setCheckoutPromptOpen(!hasCredit);
    await uploadNewAnalysis(file);
  }, [creditBalance, legacyCardMode, seedanceConfigured, setAnalysisId, uploadNewAnalysis]);

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
    if (analysisId) setFlow("verifying");
    void refreshWorkflow();
  }, [analysisId, refreshWorkflow]);

  useEffect(() => {
    if (!legacyCardMode || visibleFlow !== "completed" || !visiblePhoto || !visibleResult) return;

    let cancelled = false;
    cachedShareAsset.current = null;

    const frame = requestAnimationFrame(() => {
      setShareBusy(true);
      setShareLabel("Preparing share…");
      const card = exportCardRef.current;
      if (!card) {
        setShareBusy(false);
        setShareLabel("Try sharing again");
        return;
      }

      void createShareAsset(card)
        .then((asset) => {
          if (cancelled) return;
          cachedShareAsset.current = asset;
          setShareLabel("Share my card");
        })
        .catch(() => {
          if (!cancelled) setShareLabel("Try sharing again");
        })
        .finally(() => {
          if (!cancelled) setShareBusy(false);
        });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [legacyCardMode, visibleFlow, visiblePhoto, visibleResult]);

  async function startCheckout(
    provider: "paddle" | "google_play",
    attachAnalysis = true,
  ) {
    if (checkoutBusy) return;
    if (
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
        body: JSON.stringify({
          provider,
          ...(attachAnalysis && analysisId ? { analysisId } : {}),
        }),
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
          ...(attachAnalysis && analysisId ? { analysisId } : {}),
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

  async function submitPetName(event: FormEvent) {
    event.preventDefault();
    const name = petName.trim() || "My pet";
    const dialogue = customDialogue.trim() || selectedDialogue.trim();
    if (!analysisId || (!legacyCardMode && !dialogue)) {
      return;
    }

    setMessage(null);
    const response = await fetch(`/api/analyses/${analysisId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        legacyCardMode
          ? { action: "set_pet_name", petName: name, pronouns: petPronouns }
          : { action: "start_talking_video", petName: name, dialogue },
      ),
    });
    const payload = await response.json();
    if (typeof payload.creditBalance === "number") {
      workflow.setSnapshot({
        ...workflow.snapshot,
        ...(legacyCardMode
          ? { legacyCardCreditBalance: payload.creditBalance }
          : { creditBalance: payload.creditBalance }),
      });
    }
    if (!response.ok) {
      setMessage(payload.error || "That name could not be saved.");
      if (payload.needsCredits) {
        setFlow("checkout");
        setCheckoutPromptOpen(true);
        void refreshWorkflow();
      }
      return;
    }
    setPetName(name);
    setSelectedDialogue(dialogue);
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
      if (canUseNativeFileShare(asset.file)) {
        await navigator.share({
          files: [asset.file],
          title: `${visibleResult.petName || "My pet"} — ${visibleResult.cardTitle}`,
          text: visibleResult.fieldNote || visibleResult.signatureRead.thought,
        });
        setShareLabel("Shared");
      } else {
        downloadShareAsset(asset, "rarely-card.png");
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

  async function generateVideo() {
    if (!analysisId || videoBusy) return;
    setVideoBusy(true);
    setVideoMessageAnalysisId(analysisId);
    setVideoMessage(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/video`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "The video could not start.");
      }
      setVideoGeneration(payload as PublicVideoGeneration);
      setVideoRefreshKey((key) => key + 1);
    } catch (error) {
      setVideoMessage(
        error instanceof Error ? error.message : "The video could not start. Try again.",
      );
      setVideoRefreshKey((key) => key + 1);
    } finally {
      setVideoBusy(false);
    }
  }

  async function shareVideo() {
    if (!visibleVideoGeneration?.videoUrl || videoShareBusy) return;
    setVideoShareBusy(true);
    setVideoMessageAnalysisId(analysisId);
    setVideoMessage(null);
    let objectUrl: string | null = null;
    try {
      const response = await fetch(visibleVideoGeneration.videoUrl);
      if (!response.ok) throw new Error("The saved video could not be opened.");
      const blob = await response.blob();
      const petSlug = (visibleResult?.petName || "my-pet")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const file = new File([blob], `rarely-${petSlug || "pet"}.mp4`, {
        type: "video/mp4",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${visibleResult?.petName || "My pet"}'s video`,
        });
      } else {
        objectUrl = URL.createObjectURL(blob);
        const download = document.createElement("a");
        download.href = objectUrl;
        download.download = file.name;
        download.click();
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setVideoMessage(
          error instanceof Error ? error.message : "The video could not be shared.",
        );
      }
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setVideoShareBusy(false);
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
    setDialogueSuggestions([]);
    setPetPronouns("they");
    setSelectedDialogue("");
    setCustomDialogue("");
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

  const checkoutAvailable =
    seedanceConfigured &&
    ((paymentChannel === "google_play" && googlePlayConfigured) ||
      (paymentChannel === "web" && paddleConfigured));
  const primaryProvider =
    paymentChannel === "google_play"
      ? ("google_play" as const)
      : ("paddle" as const);
  const checkoutPrice =
    paymentChannel === "google_play" ? playPrice : paymentChannel === "web" ? "$10" : null;

  return (
    <main className="relative overflow-hidden">
      <div className="fixed inset-0 -z-10 bg-background" aria-hidden="true" />
      <input
        ref={uploadInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFile}
        hidden
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        hidden
      />

      <PendingPhotoResume
        enabled={Boolean(
          initialUser &&
            (initialAnalysis || shouldRestorePendingPhoto),
        )}
        initialAnalysis={initialAnalysis}
        onMissing={handleMissingPendingPhoto}
        onRestore={restorePendingPhoto}
        onError={handlePendingPhotoError}
      />
      <RarityFlowLayers
        flow={
          visibleFlow === "naming" && legacyCardMode && dismissedNamingId === analysisId
            ? "idle"
            : visibleFlow
        }
        photo={visiblePhoto}
        petName={petName}
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
        onCloseNaming={() => setDismissedNamingId(analysisId)}
        onSubmitPetName={submitPetName}
        petNameInput={petNameInput}
        onPetNameChange={setPetName}
        petPronouns={petPronouns}
        onPetPronounsChange={setPetPronouns}
        legacyCardMode={legacyCardMode}
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
        creditBalance={resultCreditBalance}
        uploadInput={uploadInput}
        onReturnHome={returnToHomepage}
        seedanceConfigured={
          seedanceConfigured && Boolean(workflowAnalysis?.selectedDialogue)
        }
        videoGeneration={visibleVideoGeneration}
        videoBusy={
          videoBusy ||
          Boolean(
            workflowAnalysis?.selectedDialogue &&
              !visibleVideoGeneration &&
              !visibleVideoMessage,
          )
        }
        videoShareBusy={videoShareBusy}
        videoMessage={visibleVideoMessage}
        onGenerateVideo={() => void generateVideo()}
        onShareVideo={() => void shareVideo()}
        legacyCardMode={legacyCardMode}
      />

      {visibleFlow === "naming" && !legacyCardMode ? (
        <VoiceWorkspace
          creditBalance={creditBalance}
          onSignOut={() => void signOut()}
          photo={visiblePhoto}
          petName={petName}
          analysisId={analysisId}
          dialogueSuggestions={dialogueSuggestions}
          selectedDialogue={selectedDialogue}
          onSelectDialogue={(line) => {
            setSelectedDialogue(line);
            setCustomDialogue("");
          }}
          customDialogue={customDialogue}
          onCustomDialogueChange={(line) => {
            setCustomDialogue(line);
            if (line) setSelectedDialogue("");
          }}
          suggestionsBusy={suggestionsBusy}
          onRetrySuggestions={() => {
            setMessage(null);
            setSuggestionsBusy(true);
            setSuggestionAttempt((attempt) => attempt + 1);
          }}
          onSubmit={submitPetName}
          onRemovePhoto={returnToHomepage}
          uploadInput={uploadInput}
          message={visibleMessage}
        />
      ) : (
        <VideoWorkspace
          creditBalance={creditBalance}
          onSignOut={() => void signOut()}
          dragging={dragging}
          onDraggingChange={setDragging}
          onDrop={handleDrop}
          uploadInput={uploadInput}
          cameraInput={cameraInput}
          selectedFile={selectedFile}
          flow={visibleFlow}
          message={visibleMessage}
        />
      )}

    </main>
  );
}
