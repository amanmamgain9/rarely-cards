import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountDashboard } from "@/components/account-dashboard";
import { requireUser } from "@/lib/auth";
import { hasGooglePlayEnv, hasPaddleEnv } from "@/lib/env";
import { isZazzlePrintEnabled } from "@/lib/printing/zazzle";

export const metadata: Metadata = {
  title: "Your cards — Rarely",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const { user } = await requireUser();
  if (!user) redirect("/");

  return (
    <AccountDashboard
      paddleConfigured={hasPaddleEnv()}
      googlePlayConfigured={hasGooglePlayEnv()}
      zazzlePrintEnabled={isZazzlePrintEnabled()}
      paddleEnvironment={
        process.env.PADDLE_ENVIRONMENT === "production"
          ? "production"
          : "sandbox"
      }
    />
  );
}
