import { AccountBilling } from "@/components/account-billing";
import { hasGooglePlayEnv, hasPaddleEnv, hasSeedanceEnv } from "@/lib/env";

export default async function AccountPage() {
  return (
    <AccountBilling
      paddleConfigured={hasPaddleEnv()}
      googlePlayConfigured={hasGooglePlayEnv()}
      seedanceConfigured={hasSeedanceEnv()}
      paddleEnvironment={
        process.env.PADDLE_ENVIRONMENT === "production"
          ? "production"
          : "sandbox"
      }
    />
  );
}
