import "server-only";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function hasPublicSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export function publicSupabaseEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function serverEnv() {
  return {
    ...publicSupabaseEnv(),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    appUrl: required("NEXT_PUBLIC_APP_URL"),
    paddleEnvironment:
      process.env.PADDLE_ENVIRONMENT === "production"
        ? ("production" as const)
        : ("sandbox" as const),
    paddleApiKey: required("PADDLE_API_KEY"),
    paddleClientToken: required("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN"),
    paddleWebhookSecret: required("PADDLE_WEBHOOK_SECRET"),
    paddlePriceId: required("PADDLE_PRICE_ID"),
    geminiApiKey: required("GEMINI_API_KEY"),
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
  };
}

