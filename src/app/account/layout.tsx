import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Account — Rarely",
  robots: { index: false, follow: false },
};

export default async function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await requireUser();
  if (!user) redirect("/");

  return <AccountShell>{children}</AccountShell>;
}
