"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  clearPendingPhoto,
  savePendingPhoto,
} from "@/lib/pending-photo";
import {
  createAnalysisFromPhoto,
} from "@/lib/analysis/client";
import type { PetPronouns } from "@/lib/analysis/types";
import {
  DEFAULT_PET_VOICE_ACCENT,
  type PetVoiceAccent,
} from "@/lib/video/accent";
import { StudioHeader } from "@/components/studio-header";
import { RarityFlowLayers } from "@/components/rarity/rarity-flow-layers";
import { VideoWorkspace } from "@/components/rarity/video-workspace";
import { VoiceWorkspace } from "@/components/rarity/voice-workspace";
import { PendingPhotoResume } from "@/components/rarity/workflow-effects";
import { useRarelyWorkflowContext } from "@/components/rarity/rarely-workflow-provider";
import { useDialogueSuggestions } from "@/components/studio/use-dialogue-suggestions";
import {
  AUTOMATIC_CARD_STYLE,
  clearResumeQuery,
  flowForAnalysis,
  flowForWorkflow,
  readPhoto,
  setPendingPhotoHint,
  type FlowState,
  type GenerationWorkspaceProps,
} from "@/components/rarity/rarity-model";

export function GenerationWorkspace({
  initialAnalysis,
  shouldRestorePendingPhoto,
  seedanceConfigured,
}: GenerationWorkspaceProps) {
  const router = useRouter();
  const [flow, setFlow] = useState<FlowState>(() =>
    initialAnalysis
      ? flowForAnalysis(initialAnalysis)
      : shouldRestorePendingPhoto
        ? "restoring"
        : "idle",
  );
  const [photo, setPhoto] = useState<string | null>(
    initialAnalysis?.photoUrl ?? null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const workflow = useRarelyWorkflowContext();
  const { analysisId, setAnalysisId } = workflow;
  const [petName, setPetName] = useState(initialAnalysis?.petName ?? "");
  const [petPronouns, setPetPronouns] = useState<PetPronouns | null>(
    initialAnalysis?.petPronouns ?? null,
  );
  const [voiceAccent, setVoiceAccent] = useState<PetVoiceAccent>(
    DEFAULT_PET_VOICE_ACCENT,
  );
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
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
  const refreshWorkflow = workflow.refresh;
  const handleDialogueRejected = useCallback(() => setFlow("retry"), []);
  const handleDialogueMessage = useCallback(
    (nextMessage: string | null) => setMessage(nextMessage),
    [],
  );
  const {
    suggestions: dialogueSuggestions,
    selected: selectedDialogue,
    custom: customDialogue,
    busy: suggestionsBusy,
    select: selectDialogue,
    writeCustom: writeCustomDialogue,
    retry: retrySuggestions,
    reset: resetDialogue,
    setSelected: setSelectedDialogue,
  } = useDialogueSuggestions({
    analysisId,
    enabled: seedanceConfigured && visibleFlow === "naming",
    initialSuggestions: initialAnalysis?.dialogueSuggestions ?? [],
    initialSelectedDialogue: initialAnalysis?.selectedDialogue ?? "",
    initiallyBusy:
      initialAnalysis?.status === "awaiting_name" &&
      (initialAnalysis.dialogueSuggestions?.length ?? 0) === 0,
    onRejected: handleDialogueRejected,
    onMessage: handleDialogueMessage,
    onRefresh: refreshWorkflow,
  });
  const uploadNewAnalysis = useCallback(async (file: File) => {
    setMessage(null);
    const created = await createAnalysisFromPhoto({
      file,
      cardStyle: AUTOMATIC_CARD_STYLE,
    });
    setAnalysisId(created.id);
    await clearPendingPhoto().catch(() => undefined);
    setPendingPhotoHint(false);
    clearResumeQuery();
    setFlow("naming");
    resetDialogue({ busy: true });
  }, [resetDialogue, setAnalysisId]);

  const acceptPhoto = useCallback(async (file: File) => {
    if (!seedanceConfigured) {
      setMessage("Talking-pet videos are temporarily unavailable. Please try again shortly.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    setMessage(null);

    const preview = await readPhoto(file);
    setPhoto(preview);
    setSelectedFile(file);
    setAnalysisId(null);
    setPetPronouns(null);
    resetDialogue();
    await savePendingPhoto(file, AUTOMATIC_CARD_STYLE);
    setPendingPhotoHint(true);

    setFlow("naming");
    await uploadNewAnalysis(file);
  }, [resetDialogue, seedanceConfigured, setAnalysisId, uploadNewAnalysis]);

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
  async function submitPetName(event: FormEvent) {
    event.preventDefault();
    const name = petName.trim() || "My pet";
    const chosenDialogue = customDialogue.trim() || selectedDialogue.trim();
    if (!analysisId || !chosenDialogue || !petPronouns) {
      return;
    }

    if (creating) return;
    setCreating(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petName: name,
          dialogue: chosenDialogue,
          petPronouns,
          voiceAccent,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "The video could not start.");
        if (payload.needsCredits) {
          router.push(`/studio/credits?draft=${analysisId}`);
        }
        return;
      }
      setPetName(name);
      setSelectedDialogue(chosenDialogue);
      router.push(`/studio/videos/${payload.id}`);
    } catch {
      setMessage("The video could not start. Try again.");
    } finally {
      setCreating(false);
    }
  }

  function returnToHomepage() {
    setPendingPhotoHint(false);
    void clearPendingPhoto().catch(() => undefined);
    setAnalysisId(null);
    setSelectedFile(null);
    setPhoto(null);
    setPetPronouns(null);
    resetDialogue();
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

  return (
    <main className="relative overflow-hidden">
      <div className="fixed inset-0 -z-10 bg-background" aria-hidden="true" />
      <StudioHeader creditBalance={creditBalance} />
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
          initialAnalysis || shouldRestorePendingPhoto,
        )}
        initialAnalysis={initialAnalysis}
        onMissing={handleMissingPendingPhoto}
        onRestore={restorePendingPhoto}
        onError={handlePendingPhotoError}
      />
      <RarityFlowLayers
        flow={visibleFlow}
        uploadInput={uploadInput}
        message={visibleMessage}
      />
      {visibleFlow === "naming" ? (
        <VoiceWorkspace
          photo={visiblePhoto}
          petName={petName}
          analysisId={analysisId}
          dialogueSuggestions={dialogueSuggestions}
          selectedDialogue={selectedDialogue}
          onSelectDialogue={selectDialogue}
          customDialogue={customDialogue}
          onCustomDialogueChange={writeCustomDialogue}
          voiceAccent={voiceAccent}
          onVoiceAccentChange={setVoiceAccent}
          petPronouns={petPronouns}
          onPetPronounsChange={setPetPronouns}
          suggestionsBusy={suggestionsBusy}
          onRetrySuggestions={retrySuggestions}
          onSubmit={submitPetName}
          creating={creating}
          onRemovePhoto={returnToHomepage}
          uploadInput={uploadInput}
          message={visibleMessage}
        />
      ) : (
        <VideoWorkspace
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
