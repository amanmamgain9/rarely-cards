import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function LegacyAppPage({
  searchParams,
}: {
  searchParams: Promise<{
    resume?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.resume === "1" || (Array.isArray(params.resume) && params.resume.includes("1"))) {
    query.set("resume", "1");
  }
  redirect(`/studio/generate${query.size ? `?${query}` : ""}`);
}
