import type { DragEventHandler, RefObject } from "react";
import { AppStepRail, AppWorkspaceHeader } from "@/components/rarity/app-workspace-header";
import { Camera, Upload } from "@/components/rarity/rarity-icons";
import type { FlowState } from "@/components/rarity/rarity-model";

export function VideoWorkspace({
  creditBalance,
  onSignOut,
  dragging,
  onDraggingChange,
  onDrop,
  uploadInput,
  cameraInput,
  selectedFile,
  flow,
  message,
}: {
  creditBalance: number;
  onSignOut: () => void;
  dragging: boolean;
  onDraggingChange: (dragging: boolean) => void;
  onDrop: DragEventHandler<HTMLDivElement>;
  uploadInput: RefObject<HTMLInputElement | null>;
  cameraInput: RefObject<HTMLInputElement | null>;
  selectedFile: File | null;
  flow: FlowState;
  message: string | null;
}) {
  return (
    <>
      <AppWorkspaceHeader creditBalance={creditBalance} onSignOut={onSignOut} />
      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[920px] py-14 max-[700px]:w-[calc(100%-1.75rem)] max-[700px]:py-9" aria-labelledby="new-video-title">
        <div className="flex items-end justify-between gap-7">
          <div>
            <span className="mb-2 block font-mono text-[10px] font-semibold tracking-widest text-pink">NEW VIDEO</span>
            <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight" id="new-video-title">Choose a photo</h1>
            <p className="mt-2 text-[15px] font-bold text-ink-muted">Use a clear photo where your cat or dog&apos;s face is visible.</p>
          </div>
          <span className="rounded-lg bg-purple/15 px-3 py-2 font-mono text-[10px] text-ink-muted max-[700px]:hidden">1 credit per video</span>
        </div>

        <AppStepRail active={0} />

        <div
          className={`flex min-h-[340px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center shadow-xl shadow-ink/5 transition ${dragging ? "border-pink bg-[#fff4f8]" : "border-[#b9aec7] bg-cream"}`}
          onDragOver={(event) => {
            event.preventDefault();
            onDraggingChange(true);
          }}
          onDragLeave={() => onDraggingChange(false)}
          onDrop={onDrop}
        >
          <div className="grid size-14 place-items-center rounded-2xl bg-pink/10 text-pink [&>svg]:w-7"><Upload /></div>
          <h2 className="mb-1 mt-5 text-xl font-black">{selectedFile ? selectedFile.name : "Add a pet photo"}</h2>
          <p className="text-[13px] text-ink-muted">JPEG, PNG, or WebP · maximum 10 MB</p>
          <div className="mt-6 flex gap-3 max-[700px]:w-full max-[700px]:flex-col">
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-pink px-5 font-black text-white shadow-[3px_3px_0_#241a44] [&>svg]:w-4" type="button" onClick={() => uploadInput.current?.click()}>
              <Upload /> Choose a file
            </button>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-white px-5 font-black text-ink shadow-[3px_3px_0_#241a44] [&>svg]:w-4" type="button" onClick={() => cameraInput.current?.click()}>
              <Camera /> Take a photo
            </button>
          </div>
          <small className="mt-5 text-[11px] text-[#746983]">You can review the photo before a credit is used.</small>
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 px-1 text-xs text-ink-muted max-[700px]:grid-cols-[1fr_auto]">
          <span className="font-black">For best results</span>
          <p className="max-[700px]:hidden">Use one pet, good light, and an unobstructed face.</p>
          <a className="font-black underline" href="/privacy">Uploads are private</a>
        </div>
        {message && flow !== "retry" && (
          <p className="mt-5 rounded-lg border border-[#d73b75] bg-[#fff0f5] px-4 py-3 text-[13px] font-extrabold text-[#8f1945]" role="alert">{message}</p>
        )}
      </section>
    </>
  );
}
