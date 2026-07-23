import {
  Environment,
  Paddle,
} from "@paddle/paddle-node-sdk";

const apiKey = process.env.PADDLE_API_KEY;
if (!apiKey) throw new Error("Set PADDLE_API_KEY before running this script.");

const environment =
  process.env.PADDLE_ENVIRONMENT === "production"
    ? Environment.production
    : Environment.sandbox;
const paddle = new Paddle(apiKey, { environment });

let product = null;
for await (const candidate of paddle.products.list({ include: ["prices"] })) {
  if (candidate.status === "active" && candidate.customData?.app === "rarely") {
    product = candidate;
    break;
  }
}

product ??= await paddle.products.create({
  name: "Rarely Five-Card Pack",
  description:
    "Five AI pet-card credits for cat or dog photographs. One-time purchase; no subscription.",
  taxCategory: "standard",
  customData: {
    app: "rarely",
    entitlement: "five_card_credits",
    credits: 5,
  },
});

const existingPrices = product.prices ?? [];
product = await paddle.products.update(product.id, {
  name: "Rarely Five-Card Pack",
  description:
    "Five AI pet-card credits for cat or dog photographs. One-time purchase; no subscription.",
  taxCategory: "standard",
  customData: {
    app: "rarely",
    entitlement: "five_card_credits",
    credits: 5,
  },
});

let price = existingPrices.find(
  (candidate) =>
    candidate.status === "active" &&
    candidate.billingCycle === null &&
    candidate.unitPrice.amount === "500" &&
    candidate.unitPrice.currencyCode === "USD",
);

price ??= await paddle.prices.create({
  productId: product.id,
  description: "Rarely five-card credit pack — USD 5.00 one time",
  name: "Five pet-card credits",
  billingCycle: null,
  unitPrice: { amount: "500", currencyCode: "USD" },
  quantity: { minimum: 1, maximum: 1 },
  customData: {
    app: "rarely",
    entitlement: "five_card_credits",
    credits: 5,
  },
});

price = await paddle.prices.update(price.id, {
  description: "Rarely five-card credit pack — USD 5.00 one time",
  name: "Five pet-card credits",
  customData: {
    app: "rarely",
    entitlement: "five_card_credits",
    credits: 5,
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

