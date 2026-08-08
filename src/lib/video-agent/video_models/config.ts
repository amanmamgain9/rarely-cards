function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function seedanceEnv() {
  const price = Number(process.env.SEEDANCE_USD_PER_MILLION_TOKENS);
  return {
    apiKey: required("BYTEPLUS_ARK_API_KEY"),
    appUrl: required("NEXT_PUBLIC_APP_URL").replace(/\/$/, ""),
    webhookSecret: required("BYTEPLUS_WEBHOOK_SECRET"),
    baseUrl: process.env.BYTEPLUS_ARK_BASE_URL?.trim() || "https://ark.ap-southeast.bytepluses.com",
    model: process.env.SEEDANCE_MODEL?.trim() || "dreamina-seedance-2-0-260128",
    pricingUsdPerMillionTokens: Number.isFinite(price) && price > 0 ? price : null,
  };
}
