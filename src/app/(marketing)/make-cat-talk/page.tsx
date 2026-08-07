import { IntentPage, intentMetadata } from "@/components/seo/intent-page";
import { makeCatTalk } from "@/lib/seo-intents";

export const metadata = intentMetadata(makeCatTalk);

export default function MakeCatTalkPage() {
  return <IntentPage intent={makeCatTalk} />;
}
