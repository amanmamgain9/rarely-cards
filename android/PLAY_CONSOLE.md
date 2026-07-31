# Rarely Play Console checklist

## App and signing

- Package ID: `cards.rarely.app`
- App name: `Rarely`
- Release format: Android App Bundle
- Enable Play App Signing.
- Keep the upload keystore outside this repository.
- Add both local-test and Play App Signing SHA-256 fingerprints to
  `ANDROID_ASSET_LINKS_SHA256_FINGERPRINTS`, then confirm the asset-links URL
  returns HTTP 200 before testing.

## Product and API

- Create an active repeatable one-time product named `three_talking_pet_videos`.
- Keep `five_card_credits` available for restoration of historical purchases,
  but do not feature it or offer it in new checkout flows.
- Configure the base price and review Play's localized prices.
- Enable the Google Play Android Developer API.
- Grant the backend service account app-level order and financial permissions
  needed to verify, consume, and refund one-time products.
- Configure Real-time Developer Notifications, including one-time products and
  voided purchases.
- Use an authenticated Pub/Sub push subscription:
  `https://rarely.cards/api/webhooks/google-play`.

## Listing and policy

- Declare that the app contains in-app purchases and no ads.
- Use `https://rarely.cards/privacy` as the privacy-policy URL.
- Supply reviewer access instructions for Google/email sign-in.
- Complete Data Safety for account/email, user photos, purchases, app activity,
  and optional redacted diagnostics.
- Complete content rating and the adults-only audience declaration.
- State clearly that three talking-pet video credits are a one-time purchase.

## Release gates

- Internal: license-test purchase, repeat purchase, cancel, network recovery,
  restore, refund, and RTDN test notification.
- Closed: verify OAuth, camera/gallery, download/share, offline fallback, and
  fullscreen TWA behavior on multiple Android versions.
- Production: use a staged rollout and monitor verification, consume, RTDN, and
  entitlement errors before increasing exposure.
