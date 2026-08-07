import { IntentPage, intentMetadata } from "@/components/seo/intent-page";
import { personalizedPetVideo } from "@/lib/seo-intents";

export const metadata = intentMetadata(personalizedPetVideo);

export default function PersonalizedPetVideoPage() {
  return <IntentPage intent={personalizedPetVideo} />;
}
