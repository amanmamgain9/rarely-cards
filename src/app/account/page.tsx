import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountDashboard } from "@/components/account-dashboard";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Your cards — Rarely",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const { user } = await requireUser();
  if (!user) redirect("/");

  return (
    <AccountDashboard
      paddleConfigured={Boolean(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN)}
      paddleEnvironment={
        process.env.PADDLE_ENVIRONMENT === "production"
          ? "production"
          : "sandbox"
      }
    />
  );
}
