import type { NextConfig } from "next";

const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : "";
  } catch {
    return "";
  }
})();
const developmentEval = process.env.NODE_ENV === "development"
  ? " 'unsafe-eval'"
  : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${developmentEval} https://cdn.paddle.com https://*.paddle.com https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin} https://*.supabase.co https://*.paddle.com https://*.paddlecdn.com https://www.googletagmanager.com https://*.google-analytics.com https://*.g.doubleclick.net https://*.google.com https://*.google.co.in`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} https://*.supabase.co wss://*.supabase.co https://*.paddle.com https://*.paddlecdn.com https://*.ingest.sentry.io https://www.googletagmanager.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://*.g.doubleclick.net https://*.google.com https://*.google.co.in https://pagead2.googlesyndication.com`,
  "frame-src https://*.paddle.com https://www.googletagmanager.com",
  "worker-src 'self' blob:",
  `media-src 'self' blob: ${supabaseOrigin} https://*.supabase.co`,
  "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(), geolocation=(), payment=(self \"https://*.paddle.com\")",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
