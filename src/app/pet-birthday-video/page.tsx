import { IntentPage, intentMetadata } from "@/components/seo/intent-page";
import { petBirthdayVideo } from "@/lib/seo-intents";

export const metadata = intentMetadata(petBirthdayVideo);

export default function PetBirthdayVideoPage() {
  return <IntentPage intent={petBirthdayVideo} />;
}
