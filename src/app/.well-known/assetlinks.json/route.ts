import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const fingerprintPattern = /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/i;

export function GET() {
  const fingerprints = (
    process.env.ANDROID_ASSET_LINKS_SHA256_FINGERPRINTS || ""
  )
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => fingerprintPattern.test(value));

  if (fingerprints.length === 0) {
    return NextResponse.json(
      { error: "Android signing fingerprints are not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "cards.rarely.app",
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
