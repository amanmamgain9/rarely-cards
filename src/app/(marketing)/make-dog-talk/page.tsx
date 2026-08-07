import { IntentPage, intentMetadata } from "@/components/seo/intent-page";
import { makeDogTalk } from "@/lib/seo-intents";

export const metadata = intentMetadata(makeDogTalk);

export default function MakeDogTalkPage() {
  return <IntentPage intent={makeDogTalk} />;
}
