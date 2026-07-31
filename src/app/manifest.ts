import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Rarely — Talking Pet Videos",
    short_name: "Rarely",
    description:
      "Turn one pet photo and one perfect line into a talking-pet video.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#fff8ee",
    theme_color: "#ff62a5",
    orientation: "any",
    categories: ["entertainment", "photo"],
    icons: [
      {
        src: "/icons/rarely-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/rarely-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/rarely-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/rarely-monochrome-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "monochrome",
      },
    ],
  };
}
