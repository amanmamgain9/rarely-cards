import type { DragEventHandler, RefObject } from "react";
import { Camera, Upload } from "@/components/rarity/rarity-icons";
import type { FlowState } from "@/components/rarity/rarity-model";

export function VideoWorkspace({
  dragging,
  onDraggingChange,
  onDrop,
  uploadInput,
  cameraInput,
  selectedFile,
  flow,
  message,
}: {
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
    <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[920px] py-14 max-[700px]:w-[calc(100%-1.75rem)] max-[700px]:py-9" aria-labelledby="new-video-title">
        <h1 className="mb-8 font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight" id="new-video-title">Choose a photo</h1>

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
          {selectedFile && <strong className="mt-5 max-w-full truncate text-sm">{selectedFile.name}</strong>}
          <div className="mt-6 flex gap-3 max-[700px]:w-full max-[700px]:flex-col">
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-pink px-5 font-black text-white shadow-[3px_3px_0_#241a44] [&>svg]:w-4" type="button" onClick={() => uploadInput.current?.click()}>
              <Upload /> Choose a file
            </button>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-white px-5 font-black text-ink shadow-[3px_3px_0_#241a44] [&>svg]:w-4" type="button" onClick={() => cameraInput.current?.click()}>
              <Camera /> Take a photo
            </button>
          </div>
          <small className="mt-5 text-[11px] text-[#746983]">JPEG, PNG or WebP · 10 MB max</small>
        </div>
        {message && flow !== "retry" && (
          <p className="mt-5 rounded-lg border border-[#d73b75] bg-[#fff0f5] px-4 py-3 text-[13px] font-extrabold text-[#8f1945]" role="alert">{message}</p>
        )}
    </section>
  );
}
