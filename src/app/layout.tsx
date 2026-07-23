import type { Metadata } from "next";
import { Bungee, DM_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { PaddleDefaultCheckout } from "@/components/paddle-default-checkout";

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
    "Turn one photograph of your cat or dog into a funny, heartfelt, one-of-one rarity card.",
  openGraph: {
    title: "Rarely — Not Built to Blend In",
    description:
      "We read the pet, the posture, the light, and the world they claimed—then make their one-of-one card.",
    url: "/",
    siteName: "Rarely",
    type: "website",
    images: [
      {
        url: "/social/rarely-pets.jpg",
        width: 1200,
        height: 630,
        alt: "Rarely pet story cards featuring a cat at sunset and a dog carrying a flower",
      },
      {
        url: "/social/rarely-dog.jpg",
        width: 1200,
        height: 630,
        alt: "Rarely dog story card",
      },
      {
        url: "/social/rarely-cat.jpg",
        width: 1200,
        height: 630,
        alt: "Rarely cat story card",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rarely — Not Built to Blend In",
    description: "Make the one-of-one card only your pet could carry.",
    images: ["/social/rarely-pets.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${bungee.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <PaddleDefaultCheckout
          token={process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? null}
          environment={
            process.env.PADDLE_ENVIRONMENT === "production"
              ? "production"
              : "sandbox"
          }
        />
      </body>
    </html>
  );
}
