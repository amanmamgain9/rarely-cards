import type { MetadataRoute } from "next";
import { seoIntents } from "@/lib/seo-intents";
import { SITE_URL } from "@/lib/site";
const lastModified = new Date("2026-08-04T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const intentPages: MetadataRoute.Sitemap = seoIntents.map((intent) => ({
    url: `${SITE_URL}${intent.path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: intent.path === "/talking-pet-video" ? 0.9 : 0.8,
    images: [`${SITE_URL}${intent.image}`],
  }));

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
      images: [`${SITE_URL}/social/rarely-pets.jpg`],
    },
    ...intentPages,
    {
      url: `${SITE_URL}/guides`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...["contact", "privacy", "refund-policy", "terms"].map((path) => ({
      url: `${SITE_URL}/${path}`,
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
