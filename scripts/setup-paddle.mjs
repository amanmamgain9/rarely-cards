import {
  Environment,
  Paddle,
} from "@paddle/paddle-node-sdk";

const apiKey = process.env.PADDLE_API_KEY;
if (!apiKey) throw new Error("Set PADDLE_API_KEY before running this script.");
const legacyPriceId = process.env.PADDLE_PRICE_ID?.trim() || null;

const environment =
  process.env.PADDLE_ENVIRONMENT === "production"
    ? Environment.production
    : Environment.sandbox;
const paddle = new Paddle(apiKey, { environment });

let product = null;
for await (const candidate of paddle.products.list({ include: ["prices"] })) {
  if (
    candidate.status === "active" &&
    candidate.customData?.app === "rarely" &&
    candidate.customData?.entitlement === "three_talking_pet_videos"
  ) {
    product = candidate;
    break;
  }
}

product ??= await paddle.products.create({
  name: "Rarely Talking Pet Video Pack",
  description:
    "Three eight-second vertical talking-pet videos with sound. One-time purchase; no subscription.",
  taxCategory: "standard",
  customData: {
    app: "rarely",
    entitlement: "three_talking_pet_videos",
    credits: 3,
  },
});

const existingPrices = product.prices ?? [];
product = await paddle.products.update(product.id, {
  name: "Rarely Talking Pet Video Pack",
  description:
    "Three eight-second vertical talking-pet videos with sound. One-time purchase; no subscription.",
  taxCategory: "standard",
  customData: {
    app: "rarely",
    entitlement: "three_talking_pet_videos",
    credits: 3,
  },
});

let price = existingPrices.find(
  (candidate) =>
    candidate.status === "active" &&
    candidate.billingCycle === null &&
    candidate.unitPrice.amount === "1000" &&
    candidate.unitPrice.currencyCode === "USD",
);

price ??= await paddle.prices.create({
  productId: product.id,
  description: "Rarely three talking-pet videos — USD 10.00 one time",
  name: "Three talking-pet videos",
  billingCycle: null,
  unitPrice: { amount: "1000", currencyCode: "USD" },
  quantity: { minimum: 1, maximum: 1 },
  customData: {
    app: "rarely",
    entitlement: "three_talking_pet_videos",
    credits: 3,
  },
});

price = await paddle.prices.update(price.id, {
  description: "Rarely three talking-pet videos — USD 10.00 one time",
  name: "Three talking-pet videos",
  customData: {
    app: "rarely",
    entitlement: "three_talking_pet_videos",
    credits: 3,
  },
});

let clientToken = null;
for await (const candidate of paddle.clientTokens.list({ status: ["active"] })) {
  if (candidate.name === "Rarely web checkout") {
    clientToken = candidate;
    break;
  }
}

clientToken ??= await paddle.clientTokens.create({
  name: "Rarely web checkout",
  description: "Browser checkout token for Rarely.",
});

console.log(`PADDLE_PRICE_ID=${price.id}`);
console.log(`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=${clientToken.token}`);
if (legacyPriceId && legacyPriceId !== price.id) {
  console.log(`PADDLE_LEGACY_CARD_PRICE_IDS=${legacyPriceId}`);
}
