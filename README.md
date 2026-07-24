# Rarely

Rarely turns a pet photo into a one-of-one digital card. The app uses Supabase
Auth and Storage, Gemini for analysis, and a five-credit one-time purchase sold
through Lemon Squeezy or Paddle.

## Getting started

Copy `.env.example` to `.env.local`, configure Supabase and Gemini, apply the
Supabase migrations, then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Payments

Lemon Squeezy is the primary checkout and Paddle is the fallback. Each provider
can be configured independently; the UI only offers providers whose complete
environment configuration is present.

### Lemon Squeezy

1. In Lemon Squeezy test mode, create a one-time product named
   `Rarely Five-Card Pack` with one $5 USD variant.
2. Set `LEMON_SQUEEZY_API_KEY`, `LEMON_SQUEEZY_STORE_ID`,
   `LEMON_SQUEEZY_VARIANT_ID`, `LEMON_SQUEEZY_WEBHOOK_SECRET`, and
   `LEMON_SQUEEZY_TEST_MODE=true`.
3. Register `https://your-domain/api/webhooks/lemon-squeezy` and select only
   `order_created` and `order_refunded`.
4. Run a test checkout and confirm that five credits appear in `/account`, then
   request a refund and confirm the remaining credits are removed.
5. Repeat with live credentials and `LEMON_SQUEEZY_TEST_MODE=false` after the
   store is activated.

### Paddle

Run `npm run paddle:setup` to create or find the five-card product, price, and
client token. Set the printed values plus `PADDLE_WEBHOOK_SECRET`, and register
`https://your-domain/api/webhooks/paddle` for transaction and adjustment events.

### Google Play / Android

The Android app is a Bubblewrap Trusted Web Activity in `android/`, using the
permanent package ID `cards.rarely.app`. Digital credits in that app are sold
only through the repeatable one-time Play product `five_card_credits`; web
browsers continue to use Lemon Squeezy or Paddle.

1. Apply `20260724170000_google_play_billing.sql`.
2. In Play Console, create the app and the `five_card_credits` one-time product.
3. Grant an Android Publisher service account access to the app. Store its JSON
   (or base64-encoded JSON) in `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`; set the other
   `GOOGLE_PLAY_*` variables from `.env.example`.
4. Create a Google Cloud Pub/Sub topic for Real-time Developer Notifications.
   Add an authenticated push subscription targeting
   `https://rarely.cards/api/webhooks/google-play`, using the exact audience and
   service-account email configured in the environment.
5. Build the unsigned wrapper with `cd android && ./gradlew lint bundleRelease`,
   or use Bubblewrap with a private upload keystore. Never commit the keystore.
6. Upload the first AAB to Play internal testing and enable Play App Signing.
   Copy the Play signing SHA-256 certificate (plus any local test certificate)
   into `ANDROID_ASSET_LINKS_SHA256_FINGERPRINTS`, redeploy, and verify
   `https://rarely.cards/.well-known/assetlinks.json` before testing the TWA.

Play Billing requires Bubblewrap's delegation service to be enabled, which also
adds Android's notification permission to the generated wrapper. Rarely does
not request or send notifications; the enabled service is used for the Digital
Goods bridge.

## Optional Zazzle printing

Zazzle printing is disabled by default and is separate from Rarely's digital
card payment. When enabled, Rarely sends the rendered card to a Zazzle product
template and redirects the customer to Zazzle for payment, tax, shipping,
fulfillment, and support.

1. Create a Zazzle product template with one image placeholder.
2. Register the Rarely image-hosting domain in Zazzle's developer settings.
3. Set `ZAZZLE_MEMBER_ID`, `ZAZZLE_TEMPLATE_ID`, and the placeholder's
   `ZAZZLE_IMAGE_PARAMETER`. `ZAZZLE_ASSOCIATE_ID` is optional.
4. Set `ZAZZLE_PRINT_ENABLED=true` only after ordering and reviewing a sample.

Turning `ZAZZLE_PRINT_ENABLED` back to `false` removes all print-order actions
without affecting card generation or existing digital purchases.

## Verification

```bash
npm test
npm run lint
npm run build
```
