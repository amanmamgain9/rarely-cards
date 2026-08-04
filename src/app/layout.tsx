import type { Metadata, Viewport } from "next";
import { Bungee, DM_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { AppProviders } from "@/components/app-providers";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { WebPaymentScripts } from "@/components/web-payment-scripts";
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
  title: "AI Talking Pet Video Generator — Rarely",
  description:
    "Turn one pet photo and one perfect line into an eight-second talking-pet video.",
  openGraph: {
    title: "AI Talking Pet Video Generator — Rarely",
    description:
      "Upload a pet photo, pick what they say, and get a vertical talking-pet video made for sharing.",
    url: "/",
    siteName: "Rarely",
    type: "website",
    images: [
      {
        url: "/social/rarely-pets.jpg",
        width: 1200,
        height: 630,
        alt: "Rarely talking-pet video featuring a cat at sunset and a dog carrying a flower",
      },
      {
        url: "/social/rarely-dog.jpg",
        width: 1200,
        height: 630,
        alt: "Rarely talking-dog video",
      },
      {
        url: "/social/rarely-cat.jpg",
        width: 1200,
        height: 630,
        alt: "Rarely talking-cat video",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Talking Pet Video Generator — Rarely",
    description: "One pet photo. One perfect line. One tiny talking-pet video.",
    images: ["/social/rarely-pets.jpg"],
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
          "Turn one pet photo and one perfect line into an eight-second talking-pet video.",
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
          {gaMeasurementId ? <AnalyticsConsent measurementId={gaMeasurementId} /> : null}
        </AppProviders>
      </body>
    </html>
  );
}
