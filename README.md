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

Create the three-video product, $10 price, and client token in Paddle. Set those
values plus `PADDLE_WEBHOOK_SECRET`, and register
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

### Legacy Google Play purchases

The Android wrapper is retired and no longer stored here. Keep Google Play
credentials and webhook configuration only while historical purchases still
need restoration, refund, or dispute handling. Web checkout uses Paddle.

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

## License

MIT
