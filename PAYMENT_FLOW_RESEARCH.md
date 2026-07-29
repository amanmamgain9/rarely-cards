# Payment Flow Research

Date: 2026-07-25

## Scope

Audit and harden the current web (Paddle) and Android (Google Play) payment
flows. This document records both the original findings and their implemented
resolutions.

## Investigation checklist

- [x] Map checkout entry points and client payment-channel selection.
- [x] Trace Paddle checkout creation, client events, and webhook fulfillment.
- [x] Trace Google Play verification and Real-time Developer Notifications.
- [x] Trace entitlement reads, purchase records, refunds, and concurrency controls.
- [x] Review relevant migrations and generated database types.
- [x] Run focused tests, lint/type checks, and record reproducible failures.

## Flow map

1. The client selects Paddle on the web or Google Play inside the Android/TWA
   billing environment.
2. `POST /api/checkout` creates one `checkout_pending` credit purchase. A partial
   unique index prevents duplicate pending rows for the same user, provider, and
   optional analysis.
3. Paddle creates a transaction carrying server-authored purchase/user metadata;
   its signed webhook grants five credits. Google Play returns a purchase token;
   the authenticated verify route checks ProductPurchaseV2 and Order data,
   records the token, grants credits, and consumes the product.
4. `grant_credit_purchase` locks the purchase row and grants exactly five
   credits idempotently.
5. `reserve_credit_for_analysis` locks an active purchase, decrements one credit,
   and marks the analysis credit `reserved`. A valid accepted or rejected AI
   response changes it to `consumed`; a terminal technical failure attempts to
   restore it.
6. Refund requests freeze the purchase by changing it to `refund_pending`.
   Paddle adjustments or Google Play RTDN events later mark it refunded,
   disputed, or failed and zero unused credits.

## Confirmed findings

### 1. High: a credit can be consumed without durably delivering a result

`runAnalysis` calls `consume_analysis_credit` before writing the accepted or
rejected result. Both final analysis updates ignore their Supabase error and
whether any row was changed. A transient database failure after the credit RPC
therefore leaves the analysis in `processing` with a consumed credit and no
result. Stale recovery may eventually retry, but it is not bounded correctly by
the three-attempt failure/refund path because the failed success write never
enters `catch`.

Evidence:

- `src/lib/analysis/run-analysis.ts:92-113`
- `src/lib/analysis/run-analysis.ts:128-141`

### 2. High: refund/revocation does not invalidate already-reserved analyses

Paddle refund/dispute handling and Google Play cancellation/void handling set
the purchase balance to zero, but do not update analyses whose
`credit_purchase_id` points to that purchase. `claimAnalysis` treats
`credit_state = reserved` or `consumed` as sufficient entitlement without
checking the purchase status. A card reserved before the refund request can
therefore continue and complete after the purchase is refunded, disputed, or
voided. The published policy preserves cards already generated, but does not
promise that still-pending generations survive revocation.

Evidence:

- `src/lib/analysis/run-analysis.ts:24-45`
- `src/app/api/webhooks/paddle/route.ts:123-190`
- `src/app/api/webhooks/google-play/route.ts:40-60`
- `src/app/api/checkout/google-play/verify/route.ts:220-249`

### 3. High/conditional: Google Play retries can fail the event digest check

The Google webhook identifies an event by stable Pub/Sub `messageId`, but hashes
the entire raw push envelope. Pub/Sub can change envelope-level retry metadata
while preserving the message ID and message data; with a dead-letter policy,
the wrapped push body includes an incrementing `deliveryAttempt`. If the first
delivery stores the event and then fails processing, the retry has a different
digest and `claim_payment_event` returns `mismatch` forever. A cancellation or
void can consequently reach the dead-letter topic without being applied.

Evidence:

- `src/app/api/webhooks/google-play/route.ts:97-99`
- `src/app/api/webhooks/google-play/route.ts:125-139`
- `supabase/migrations/20260725130000_payment_flow_concurrency_hardening.sql:34-78`
- Google Cloud documents `deliveryAttempt` in wrapped push requests when a
  dead-letter policy is enabled.

The digest should cover immutable message content, such as the decoded
`message.data`, rather than the delivery envelope.

### 4. High/deployment: migration can invalidate still-payable checkouts

The concurrency migration marks all but the newest duplicate pending purchase
as `failed` before adding the unique index. It does not cancel or reconcile the
corresponding provider-side payment. An older Paddle checkout can remain open
and payable. A Google Play PaymentRequest can likewise already be in flight
with the older local purchase ID. If payment completes afterward,
`grant_credit_purchase` rejects the failed purchase, leaving a charge without
credits.

Evidence:

- `supabase/migrations/20260725130000_payment_flow_concurrency_hardening.sql:1-28`
- `supabase/migrations/20260725120000_paddle_only_payment_hardening.sql:29-87`
- `src/app/api/checkout/google-play/verify/route.ts:267-276`

This cleanup needs a provider reconciliation/cancellation or a deployment grace
period; duplicate rows that have exposed a payable checkout cannot safely be
invalidated by SQL alone.

### 5. Medium: Paddle chargeback reversals leave purchases permanently disputed

The adjustment decision treats every `chargeback` or `chargeback_warning`
payload as disputed without considering a `reversed` status. It also does not
handle Paddle's `chargeback_reverse` or `chargeback_warning_reverse` actions.
The initial dispute destroys `credits_remaining` by setting it to zero, so even
adding a later state transition cannot restore the unused balance without
recording it elsewhere.

Evidence:

- `src/lib/analysis/credit-state.ts:20-32`
- `src/app/api/webhooks/paddle/route.ts:123-151`
- Paddle adjustment documentation lists both reversal actions.

### 6. High: an uncertain refund response can temporarily reactivate credits

If a provider refund call throws after the request may have reached Paddle or
Google, the catch path performs one immediate provider lookup. If that lookup
succeeds but does not yet show the refund, the code treats this as proof that no
refund exists and changes the purchase back to `active`. Provider reads can lag
writes, so a user can spend reactivated credits before the accepted refund
becomes visible and later removes them.

Evidence:

- `src/lib/payments/refunds.ts:187-218`
- The code comment recognizes a lost-response ambiguity, but a single
  immediately consistent read does not resolve that ambiguity.

### 7. Medium: retrying a rejected Paddle refund persists the old adjustment

On refund rejection, the webhook makes the purchase active but leaves the
rejected `provider_adjustment_id` on the row. A new refund attempt does not
clear that ID. After Paddle accepts a new adjustment, the local save requires
`provider_adjustment_id is null`, so it cannot save the new adjustment. The
fallback sees the old rejected ID and reports `refund_pending`; without the new
webhook, the row remains pending against the wrong adjustment and future calls
return early.

Evidence:

- `src/app/api/webhooks/paddle/route.ts:179-190`
- `src/lib/payments/refunds.ts:101-150`
- `src/lib/payments/refunds.ts:222-266`

### 8. Medium/configuration: Google checkout can be enabled while RTDN is disabled

`hasGooglePlayEnv` enables checkout with package ID, product ID, and service
account credentials only. The webhook additionally requires Pub/Sub audience
and Pub/Sub service-account values and returns 401 when either is absent. A
deployment can therefore sell and grant credits while being unable to process
later cancellations and voided purchases.

Evidence:

- `src/lib/env.ts:49-82`
- `src/app/api/webhooks/google-play/route.ts:63-68`

### 9. Low/conditional: unrelated Google Play one-time products retry forever

RTDN is package-wide. A valid one-time-product notification whose SKU differs
from this app's configured credit SKU is stored and then deliberately throws,
returning HTTP 500. Pub/Sub will keep redelivering an event that can never
succeed. This is dormant while the package has exactly one one-time product.

Evidence:

- `src/app/api/webhooks/google-play/route.ts:148-154`

### 10. Low: Google Play charged amount can remain recorded as zero

Google Play pending purchases are initialized with `amount_cents = 0`. The
verified order amount update ignores database errors, so verification can still
grant credits and return success while account purchase history permanently
shows a zero charge.

Evidence:

- `src/app/api/checkout/google-play/verify/route.ts:125-140`
- `src/app/api/checkout/google-play/verify/route.ts:255-265`

## Resolution status

All ten original findings are resolved in the current working tree:

1. Analysis worker claims now carry a fencing token. Result persistence and
   credit consumption are committed together by `finalize_analysis_result`;
   exhausted failures restore credits transactionally and have stale recovery.
2. One revocation RPC now locks the purchase first, invalidates reserved or
   in-flight analyses, preserves completed cards, and is shared by Paddle,
   Google Play, direct reconciliation, and the retained legacy webhook.
3. Google event identity hashes decoded `message.data`, namespaces IDs by
   subscription, and ignores mutable delivery-envelope metadata.
4. Existing payable checkout rows remain fulfillable. Only newly guarded rows
   participate in the uniqueness constraint, and ambiguous provider creation
   failures release the current slot without failing the payable purchase.
5. Disputes snapshot the exact unused balance and interrupted refund state.
   Reversal restores that state rather than guessing or blindly reactivating.
6. Lost or ambiguous refund responses remain `refund_pending`; an immediate
   negative lookup can no longer reactivate credits.
7. Rejected Paddle adjustments are matched exactly, cleared atomically, and
   ignored when searching for a fresh retry.
8. New Google Play sales require API credentials, RTDN authentication values,
   and explicit `GOOGLE_PLAY_CHECKOUT_ENABLED=true` activation after a test
   notification. Existing verification and restoration remain available.
9. Valid RTDN messages for unrelated SKUs are acknowledged as ignored.
10. Google Play amount persistence errors now fail verification and retry.

Iterative GPT-5.6 Sol CLI reviews found and drove fixes for additional sibling
high-severity cases:

- stale workers overwriting newer claims and third attempts becoming stranded;
- historical Lemon Squeezy checkout URLs losing fulfillment/refund handling;
- terminal purchases created before the revocation migration retaining runnable
  analyses;
- out-of-order Paddle completion, pending, rejection, refund, dispute, and
  reversal events overwriting newer state;
- provider-side refund reversals leaving users charged with zero credits;
- historical per-analysis refunds lacking durable retry and reconciliation;
- chargeback reversals abandoning an interrupted refund workflow.

The final GPT-5.6 Sol high-severity audit returned `CLEAN`.

## Checked and not found to be bugs

- Paddle webhook signatures are checked against the raw request body.
- Paddle and Google Play event claims use a payload digest, lease token, and
  stale-lease recovery; duplicate processing is guarded.
- The credit-grant SQL locks the purchase and is idempotent for the same
  provider transaction.
- Google Play verification checks purchased state, product ID, quantity,
  order/token identity, and processed order state before granting credits.
- Early Google Play cancellation/void notifications are reconciled by the
  verify route even when RTDN arrived before the local token record.
- The implemented Google Play RTDN constants are current: notification type 2
  is pending one-time-purchase cancellation and product type 2 is a voided
  one-time product.
- The Google Play `orders.refund?...revoke=true` endpoint used by the code is a
  valid current API.
- Multiple Paddle loader calls use Paddle's `Update` path after initialization;
  this does not itself create multiple Paddle instances.

## Verification log

- Static source trace completed for checkout, provider verification, webhooks,
  grants, reservations, analysis finalization, account balance, and refunds.
- Provider constants and endpoint semantics checked against current Google Play
  and Paddle documentation.
- `npm test`: passed, 7 files and 52 tests.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `git diff --check`: passed.
- Iterative Cursor CLI reviews used only `gpt-5.6-sol-high`; the final
  high-severity pass returned `CLEAN`.
- The new SQL migration was statically reviewed but was not executed against a
  local Postgres instance in this environment.
