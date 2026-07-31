# Rarely

Rarely turns a pet photo and one short line into an eight-second vertical
talking-pet video. Gemini suggests funny, sweet, and chaotic lines from the
photo; Seedance 2.0 generates synchronized speech.

New purchases are USD $10 one-time packs of three video credits. Historical
five-card purchases remain stored as `card` credits and keep their existing
refund/entitlement records. Video generation is hidden unless
`BYTEPLUS_ARK_API_KEY` is configured. Apply the latest Supabase migration to
create the private `generated-videos` bucket and video job table; generated MP4s
are copied out of ModelArk as soon as they finish so provider URL expiry does
not affect saved videos.

## Getting started

Copy `.env.example` to `.env.local`, configure Supabase and Gemini, apply the
Supabase migrations, then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Payments

### Paddle

Run `npm run paddle:setup` to create or find the three-video product, $10 price, and
client token. Set the printed values plus `PADDLE_WEBHOOK_SECRET`, and register
`https://your-domain/api/webhooks/paddle` for transaction and adjustment events.
The Paddle API key must include customer read/write access as well as the
existing product, price, transaction, adjustment, and client-token permissions.
Set `PADDLE_LEGACY_CARD_PRICE_IDS` to old card-pack price IDs so delayed legacy
transactions remain fulfillable;
checkout uses it to bind each transaction to the signed-in account email.

The legacy `/api/webhooks/lemon-squeezy` endpoint remains enabled only to honor
checkout URLs and refunds issued before the Paddle migration. Keep its store,
variant, and webhook-secret environment values configured until those payments
have been reconciled or canceled; the app cannot create new Lemon checkouts.

### Google Play / Android

The Android app is a Bubblewrap Trusted Web Activity in `android/`, using the
permanent package ID `cards.rarely.app`. Digital credits in that app are sold
only through the repeatable one-time Play product `three_talking_pet_videos`; web
browsers use Paddle.

1. Apply `20260724170000_google_play_billing.sql`.
2. In Play Console, create `three_talking_pet_videos` at the localized equivalent
   of USD $10. Keep `five_card_credits` active only for restoration and add it to
   `GOOGLE_PLAY_LEGACY_CARD_PRODUCT_IDS`.
3. Grant an Android Publisher service account access to the app. Store its JSON
   (or base64-encoded JSON) in `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`; set the other
   `GOOGLE_PLAY_*` variables from `.env.example`.
4. Create a Google Cloud Pub/Sub topic for Real-time Developer Notifications.
   Add an authenticated push subscription targeting
   `https://rarely.cards/api/webhooks/google-play`, using the exact audience and
   service-account email configured in the environment.
5. Send a Play test notification and confirm the webhook accepts it, then set
   `GOOGLE_PLAY_CHECKOUT_ENABLED=true`. Leave this false when RTDN is unhealthy;
   verification and restoration of existing purchases remain available.
6. Build the unsigned wrapper with `cd android && ./gradlew lint bundleRelease`,
   or use Bubblewrap with a private upload keystore. Never commit the keystore.
7. Upload the first AAB to Play internal testing and enable Play App Signing.
   Copy the Play signing SHA-256 certificate (plus any local test certificate)
   into `ANDROID_ASSET_LINKS_SHA256_FINGERPRINTS`, redeploy, and verify
   `https://rarely.cards/.well-known/assetlinks.json` before testing the TWA.

Play Billing requires Bubblewrap's delegation service to be enabled, which also
adds Android's notification permission to the generated wrapper. Rarely does
not request or send notifications; the enabled service is used for the Digital
Goods bridge.

## Legacy Zazzle printing

Zazzle printing is disabled by default and remains available only for historical
card customers. When enabled, Rarely sends the rendered card to a Zazzle product
template and redirects the customer to Zazzle for payment, tax, shipping,
fulfillment, and support.

1. Create a Zazzle product template with one image placeholder.
2. Register the Rarely image-hosting domain in Zazzle's developer settings.
3. Set `ZAZZLE_MEMBER_ID`, `ZAZZLE_TEMPLATE_ID`, and the placeholder's
   `ZAZZLE_IMAGE_PARAMETER`. `ZAZZLE_ASSOCIATE_ID` is optional.
4. Set `ZAZZLE_PRINT_ENABLED=true` only after ordering and reviewing a sample.

Turning `ZAZZLE_PRINT_ENABLED` back to `false` removes all legacy print-order
actions without affecting existing digital purchases.

## Verification

```bash
npm test
npm run lint
npm run build
```
