import type { RefObject } from "react";
import type { FlowState } from "@/components/rarity/rarity-model";

type RarityFlowLayersProps = {
  flow: FlowState;
  uploadInput: RefObject<HTMLInputElement | null>;
  message: string | null;
};

export function RarityFlowLayers({
  flow,
  uploadInput,
  message,
}: RarityFlowLayersProps) {
  return (
    <>
      {(flow === "retry" || flow === "refund_pending" || flow === "refunded") && (
        <section className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-ink/85 p-5 backdrop-blur-xl" aria-live="polite">
          <div className="w-full max-w-lg rounded-3xl border-4 border-ink bg-cream p-9 text-center shadow-[10px_11px_0_#f4458f,17px_18px_0_#ffe36e]">
            <span className="inline-flex rounded-md border-2 border-ink bg-yellow px-3 py-1 font-mono text-[9px] font-bold">
              {flow === "retry" ? "PHOTO COULD NOT BE USED" : "PAYMENT UPDATE"}
            </span>
            <h2 className="my-5 font-display text-[clamp(2.375rem,8vw,3.625rem)] font-normal leading-none">
              {flow === "retry" ? "Choose another photo" : "Refund started"}
            </h2>
            <p className="mb-5 font-extrabold leading-relaxed text-ink-muted">{message}</p>
            {flow === "retry" && (
              <>
                <button className="min-h-12 rounded-xl border-2 border-ink bg-pink px-4 font-black text-white shadow-[3px_3px_0_#241a44]" type="button" onClick={() => uploadInput.current?.click()}>
                  Choose another photo
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
}
