-- Remove the marketplace application that previously shared this Supabase project.
-- Keep auth.users and the Rarely analysis/payment/rate-limit schema intact.

drop trigger if exists on_auth_user_created on auth.users;

drop policy if exists "public reads listing media" on storage.objects;
drop policy if exists "approved sellers upload listing media" on storage.objects;
drop policy if exists "owners manage listing media" on storage.objects;
drop policy if exists "owners delete listing media" on storage.objects;

drop table if exists
  public.listing_interests,
  public.email_deliveries,
  public.favorites,
  public.notifications,
  public.payouts,
  public.shipments,
  public.payments,
  public.orders,
  public.inventory_reservations,
  public.bids,
  public.bidder_deposits,
  public.auctions,
  public.listing_images,
  public.listings,
  public.addresses,
  public.seller_applications,
  public.audit_log,
  public.platform_settings,
  public.webhook_events,
  public.profiles
cascade;

drop function if exists public.bid_increment(integer) cascade;
drop function if exists public.place_bid(uuid, integer, uuid) cascade;
drop function if exists public.finalize_deposit_bid(uuid) cascade;
drop function if exists public.close_due_auctions() cascade;
drop function if exists public.advance_expired_winner(uuid) cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.record_listing_interest(uuid, text) cascade;
drop function if exists public.place_soft_bid(uuid, integer) cascade;
drop function if exists public.public_bid_history(uuid) cascade;
drop function if exists public.close_due_soft_auctions() cascade;
drop function if exists public.prevent_audit_changes() cascade;

drop type if exists public.interest_status cascade;
drop type if exists public.money_status cascade;
drop type if exists public.order_status cascade;
drop type if exists public.listing_status cascade;
drop type if exists public.listing_mode cascade;
drop type if exists public.review_status cascade;
drop type if exists public.user_role cascade;
