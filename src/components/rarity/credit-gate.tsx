import Link from "next/link";
import { AppStepRail, AppWorkspaceHeader } from "@/components/rarity/app-workspace-header";
import type { PaymentChannel } from "@/lib/payments/use-payment-channel";

export function CreditGate({
  creditPrice,
  busy,
  available,
  paymentChannel,
  googlePlayConfigured,
  message,
  onBuy,
  onSignOut,
}: {
  creditPrice: string | null;
  busy: boolean;
  available: boolean;
  paymentChannel: PaymentChannel;
  googlePlayConfigured: boolean;
  message: string | null;
  onBuy: () => void;
  onSignOut: () => void;
}) {
  const buttonLabel = busy
    ? "Opening checkout…"
    : paymentChannel === "loading"
      ? "Preparing checkout…"
      : paymentChannel === "play_unavailable"
        ? "Google Play Billing unavailable"
        : paymentChannel === "google_play" && !googlePlayConfigured
          ? "Google Play checkout unavailable"
          : !available
            ? "Checkout temporarily unavailable"
            : `Buy 3 video credits${creditPrice ? ` · ${creditPrice}` : ""}`;

  return (
    <>
      <AppWorkspaceHeader creditBalance={0} onSignOut={onSignOut} />
      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[920px] py-14 max-[700px]:w-[calc(100%-1.75rem)] max-[700px]:py-9" aria-labelledby="credit-gate-title">
        <div className="flex items-end justify-between gap-7">
          <div>
            <span className="mb-2 block font-mono text-[10px] font-semibold tracking-widest text-pink">GET STARTED</span>
            <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight" id="credit-gate-title">Add video credits</h1>
            <p className="mt-2 text-[15px] font-bold text-ink-muted">Credits are required before you upload a photo.</p>
          </div>
        </div>

        <AppStepRail active={0} />

        <div className="grid gap-10 rounded-2xl border border-ink/20 bg-cream p-8 shadow-xl shadow-ink/5 md:grid-cols-[1fr_minmax(260px,0.72fr)] max-[700px]:p-6">
          <div>
            <span className="font-mono text-[9px] font-semibold tracking-widest text-pink">VIDEO CREDIT PACK</span>
            <h2 className="mb-1 mt-2 text-3xl font-black">3 video credits</h2>
            <p className="text-[13px] text-ink-muted">One credit creates one eight-second talking-pet video.</p>
            <dl className="mt-6">
              <div className="flex justify-between gap-5 border-t border-[#e3dce8] py-3 text-xs"><dt className="text-ink-muted">Price</dt><dd className="m-0 font-black">{creditPrice ?? "Loading…"}</dd></div>
              <div className="flex justify-between gap-5 border-t border-[#e3dce8] py-3 text-xs"><dt className="text-ink-muted">Billing</dt><dd className="m-0 font-black">One-time payment</dd></div>
              <div className="flex justify-between gap-5 border-t border-[#e3dce8] py-3 text-xs"><dt className="text-ink-muted">Subscription</dt><dd className="m-0 font-black">None</dd></div>
            </dl>
          </div>
          <div className="flex flex-col justify-center border-l border-[#e3dce8] pl-10 text-center max-md:border-l-0 max-md:border-t max-md:pl-0 max-md:pt-6">
            <button
              className="min-h-12 w-full rounded-xl border-2 border-ink bg-pink px-5 font-black text-white shadow-[3px_3px_0_#241a44] disabled:cursor-wait disabled:opacity-60"
              type="button"
              disabled={busy || !available}
              onClick={onBuy}
            >
              {buttonLabel}
            </button>
            <small className="mt-3 leading-snug text-ink-muted">Failed generations automatically return the credit.</small>
            <Link className="mt-4 text-xs font-black underline" href="/pricing">View pricing details</Link>
          </div>
        </div>

        {paymentChannel === "play_unavailable" && (
          <p className="mt-5 rounded-lg border border-[#d73b75] bg-[#fff0f5] px-4 py-3 text-[13px] font-extrabold text-[#8f1945]">
            Update Chrome or reopen Rarely from Google Play to buy credits.
          </p>
        )}
        {message && <p className="mt-5 rounded-lg border border-[#d73b75] bg-[#fff0f5] px-4 py-3 text-[13px] font-extrabold text-[#8f1945]" role="alert">{message}</p>}
      </section>
    </>
  );
}
