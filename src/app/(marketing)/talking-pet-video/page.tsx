import { IntentPage, intentMetadata } from "@/components/seo/intent-page";
import { talkingPetVideo } from "@/lib/seo-intents";

export const metadata = intentMetadata(talkingPetVideo);

export default function TalkingPetVideoPage() {
  return <IntentPage intent={talkingPetVideo} />;
}
