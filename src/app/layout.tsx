import type { Metadata, Viewport } from "next";
import { Bungee, DM_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { WebPaymentScripts } from "@/components/web-payment-scripts";

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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://rarely.cards",
  ),
  title: "Rarely — Not Built to Blend In",
  description:
    "Turn one pet photo and one perfect line into an eight-second talking-pet video.",
  openGraph: {
    title: "Rarely — Not Built to Blend In",
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
    title: "Rarely — Not Built to Blend In",
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
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${bungee.variable} ${dmMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full overflow-x-hidden bg-background font-sans text-ink">
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
    </html>
  );
}
