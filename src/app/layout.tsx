import type { Metadata, Viewport } from "next";
import { Bungee, DM_Mono, Nunito } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { WebPaymentScripts } from "@/components/payments/web-payment-scripts";
import { SITE_URL } from "@/lib/site";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const bungee = Bungee({
  variable: "--font-bungee",
  subsets: ["latin"],
  weight: "400",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "AI Talking Pet & Birthday Video Maker — Rarely",
  description:
    "Make AI talking-pet and personalized pet birthday videos from your photos. Download short MP4 videos with sound.",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "AI Talking Pet & Birthday Video Maker — Rarely",
    description:
      "Make talking-pet and personalized pet birthday videos from your photos.",
    url: "/",
    siteName: "Rarely",
    type: "website",
    images: [
      {
        url: "/social/og-home.jpg",
        width: 1200,
        height: 630,
        alt: "Rarely talking-pet and personalized pet birthday video examples",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Talking Pet & Birthday Video Maker — Rarely",
    description: "Make talking-pet and personalized pet birthday videos from your photos.",
    images: ["/social/og-home.jpg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rarely",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ff62a5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const gaMeasurementIdJson = JSON.stringify(gaMeasurementId);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Rarely",
        url: SITE_URL,
        logo: `${SITE_URL}/icons/rarely-512.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Rarely",
        url: SITE_URL,
        description:
          "Make AI talking-pet and personalized pet birthday videos from your photos.",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };

  return (
    <html
      lang="en"
      className={`${nunito.variable} ${bungee.variable} ${dmMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full overflow-x-hidden bg-background font-sans text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <AppProviders>
          {children}
          <ServiceWorkerRegistration />
          <WebPaymentScripts
            paddleToken={process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? null}
            paddleEnvironment={
              process.env.PADDLE_ENVIRONMENT === "production"
                ? "production"
                : "sandbox"
            }
          />
        </AppProviders>
      </body>
      {gaMeasurementId ? (
        <>
          <Script
            id="google-analytics-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){window.dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', ${gaMeasurementIdJson}, {
                  allow_google_signals: false,
                  allow_ad_personalization_signals: false
                });
              `,
            }}
          />
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`}
          />
        </>
      ) : null}
    </html>
  );
}
