create extension if not exists "pgcrypto";
create type public.user_role as enum ('buyer', 'seller', 'admin');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.listing_mode as enum ('fixed', 'auction');
create type public.listing_status as enum ('draft', 'review', 'live', 'sold', 'rejected', 'archived');
create type public.order_status as enum ('payment_pending', 'paid', 'shipment_pending', 'shipped', 'delivered', 'rto', 'cancelled');
create type public.money_status as enum ('created', 'authorized', 'captured', 'refunded', 'failed');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'buyer',
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  instagram_handle text not null,
  city text not null,
  pickup_address jsonb not null default '{}'::jsonb,
  razorpay_account_id text unique,
  bank_status public.review_status not null default 'pending',
  status public.review_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home',
  recipient text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  created_at timestamptz not null default now()
);
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id),
  slug text not null unique,
  title text not null,
  brand text not null,
  category text not null,
  size text not null,
  condition text not null,
  description text not null,
  flaws text,
  measurements jsonb not null default '[]'::jsonb,
  original_price integer not null check (original_price > 0),
  price integer check (price > 0),
  mode public.listing_mode not null,
  status public.listing_status not null default 'draft',
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_price_by_mode check (
    (mode = 'fixed' and price is not null) or (mode = 'auction' and price is null)
  )
);
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  position smallint not null default 0,
  unique (listing_id, position)
);
create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings(id) on delete cascade,
  starting_bid integer not null check (starting_bid > 0),
  current_bid integer,
  current_bid_id uuid,
  bid_count integer not null default 0,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  closed_at timestamptz,
  winner_id uuid references public.profiles(id),
  winner_offer_expires_at timestamptz,
  fallback_rank integer not null default 0,
  check (ends_at > starts_at)
);
create table public.bidder_deposits (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder_id uuid not null references public.profiles(id),
  amount integer not null check (amount between 100 and 1000),
  intended_bid integer not null check (intended_bid > 0),
  payment_provider_id text unique,
  status public.money_status not null default 'created',
  forfeited_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (auction_id, bidder_id)
);
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder_id uuid not null references public.profiles(id),
  deposit_id uuid not null references public.bidder_deposits(id),
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);
alter table public.auctions
  add constraint auctions_current_bid_fk foreign key (current_bid_id) references public.bids(id);
create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  buyer_id uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  converted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_active_reservation on public.inventory_reservations(listing_id)
  where converted_at is null;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  listing_id uuid not null unique references public.listings(id),
  buyer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  auction_id uuid references public.auctions(id),
  address_id uuid not null references public.addresses(id),
  item_amount integer not null,
  shipping_amount integer not null default 0,
  buyer_fee integer not null default 0,
  commission_amount integer not null,
  deposit_credit integer not null default 0,
  total_amount integer not null,
  status public.order_status not null default 'payment_pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  deposit_id uuid references public.bidder_deposits(id),
  provider_order_id text unique,
  provider_payment_id text unique,
  amount integer not null check (amount > 0),
  status public.money_status not null default 'created',
  signature_verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_target check (
    (order_id is not null and deposit_id is null) or (order_id is null and deposit_id is not null)
  )
);
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  provider_order_id text,
  shipment_id text unique,
  awb text unique,
  courier_name text,
  label_url text,
  status text not null default 'pending',
  tracking jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  seller_id uuid not null references public.profiles(id),
  amount integer not null,
  provider_transfer_id text unique,
  status text not null default 'pending',
  held_reason text,
  released_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.webhook_events (
  id text primary key,
  provider text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(key, value) values
  ('commission_rate', '0.15'),
  ('buyer_fee_rate', '0.03'),
  ('auction_offer_minutes', '30');
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create or replace function public.bid_increment(amount integer)
returns integer language sql immutable as $$
  select case
    when amount < 5000 then 250
    when amount < 10000 then 500
    when amount < 25000 then 1000
    else 2500
  end;
$$;
create or replace function public.place_bid(p_auction_id uuid, p_amount integer, p_deposit_id uuid)
returns public.bids
language plpgsql
security definer
set search_path = public
as $$
declare
  auction_row public.auctions;
  deposit_row public.bidder_deposits;
  required_amount integer;
  new_bid public.bids;
begin
  select * into auction_row from public.auctions where id = p_auction_id for update;
  if not found or now() < auction_row.starts_at or now() >= auction_row.ends_at or auction_row.closed_at is not null then
    raise exception 'AUCTION_NOT_OPEN';
  end if;

  select * into deposit_row from public.bidder_deposits
  where id = p_deposit_id and auction_id = p_auction_id and bidder_id = auth.uid() for update;
  if not found or deposit_row.status <> 'captured' then raise exception 'DEPOSIT_NOT_CAPTURED'; end if;

  required_amount := coalesce(auction_row.current_bid + public.bid_increment(auction_row.current_bid), auction_row.starting_bid);
  if p_amount < required_amount then raise exception 'BID_TOO_LOW'; end if;

  insert into public.bids(auction_id, bidder_id, deposit_id, amount)
  values (p_auction_id, auth.uid(), p_deposit_id, p_amount) returning * into new_bid;

  update public.auctions set
    current_bid = p_amount,
    current_bid_id = new_bid.id,
    bid_count = bid_count + 1
  where id = p_auction_id;
  return new_bid;
end;
$$;
create or replace function public.finalize_deposit_bid(p_deposit_id uuid)
returns public.bids
language plpgsql
security definer
set search_path = public
as $$
declare
  deposit_row public.bidder_deposits;
  auction_row public.auctions;
  required_amount integer;
  new_bid public.bids;
begin
  select * into deposit_row from public.bidder_deposits where id = p_deposit_id for update;
  if not found or deposit_row.status <> 'captured' then raise exception 'DEPOSIT_NOT_CAPTURED'; end if;
  if exists(select 1 from public.bids where deposit_id = p_deposit_id and amount = deposit_row.intended_bid) then
    select * into new_bid from public.bids where deposit_id = p_deposit_id and amount = deposit_row.intended_bid;
    return new_bid;
  end if;
  select * into auction_row from public.auctions where id = deposit_row.auction_id for update;
  if now() >= auction_row.ends_at or auction_row.closed_at is not null then raise exception 'AUCTION_NOT_OPEN'; end if;
  required_amount := coalesce(auction_row.current_bid + public.bid_increment(auction_row.current_bid), auction_row.starting_bid);
  if deposit_row.intended_bid < required_amount then raise exception 'BID_TOO_LOW'; end if;
  insert into public.bids(auction_id, bidder_id, deposit_id, amount)
  values (deposit_row.auction_id, deposit_row.bidder_id, deposit_row.id, deposit_row.intended_bid)
  returning * into new_bid;
  update public.auctions set current_bid = new_bid.amount, current_bid_id = new_bid.id, bid_count = bid_count + 1
  where id = deposit_row.auction_id;
  return new_bid;
end;
$$;
create or replace function public.close_due_auctions()
returns setof public.auctions
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.auctions a
  set
    closed_at = now(),
    winner_id = (select b.bidder_id from public.bids b where b.id = a.current_bid_id),
    winner_offer_expires_at = case when a.current_bid_id is null then null else now() + interval '30 minutes' end
  where a.ends_at <= now()
    and a.closed_at is null
  returning a.*;
end;
$$;
create or replace function public.advance_expired_winner(p_auction_id uuid)
returns public.auctions
language plpgsql
security definer
set search_path = public
as $$
declare
  auction_row public.auctions;
  next_bid public.bids;
begin
  select * into auction_row from public.auctions where id = p_auction_id for update;
  if auction_row.winner_offer_expires_at is null or auction_row.winner_offer_expires_at > now() then
    raise exception 'OFFER_NOT_EXPIRED';
  end if;
  update public.bidder_deposits
    set forfeited_at = now()
    where auction_id = p_auction_id and bidder_id = auction_row.winner_id;
  select * into next_bid from public.bids
    where auction_id = p_auction_id and bidder_id <> auction_row.winner_id
    order by amount desc, created_at asc
    offset auction_row.fallback_rank limit 1;
  update public.auctions set
    winner_id = next_bid.bidder_id,
    winner_offer_expires_at = case when next_bid.id is null then null else now() + interval '30 minutes' end,
    fallback_rank = fallback_rank + 1
  where id = p_auction_id
  returning * into auction_row;
  return auction_row;
end;
$$;
alter table public.profiles enable row level security;
alter table public.seller_applications enable row level security;
alter table public.addresses enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;
alter table public.bidder_deposits enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;
alter table public.payouts enable row level security;
alter table public.favorites enable row level security;
alter table public.notifications enable row level security;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
create policy "public reads live listings" on public.listings for select using (status = 'live' or seller_id = auth.uid() or public.is_admin());
create policy "public reads listing images" on public.listing_images for select using (
  exists(select 1 from public.listings where id = listing_id and (status = 'live' or seller_id = auth.uid() or public.is_admin()))
);
create policy "public reads live auctions" on public.auctions for select using (
  exists(select 1 from public.listings where id = listing_id and status = 'live')
);
create policy "public reads bid amounts" on public.bids for select using (
  exists(select 1 from public.auctions a join public.listings l on l.id = a.listing_id where a.id = auction_id and l.status = 'live')
);
create policy "users read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "users update own profile" on public.profiles for update using (id = auth.uid());
create policy "users manage own addresses" on public.addresses for all using (user_id = auth.uid());
create policy "users manage own application" on public.seller_applications for all using (user_id = auth.uid() or public.is_admin());
create policy "sellers manage own listings" on public.listings for all using (seller_id = auth.uid() or public.is_admin());
create policy "users manage own favorites" on public.favorites for all using (user_id = auth.uid());
create policy "users read own deposits" on public.bidder_deposits for select using (bidder_id = auth.uid() or public.is_admin());
create policy "order participants read orders" on public.orders for select using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy "order participants read payments" on public.payments for select using (
  public.is_admin() or exists(select 1 from public.orders where id = order_id and (buyer_id = auth.uid() or seller_id = auth.uid()))
);
create policy "order participants read shipments" on public.shipments for select using (
  public.is_admin() or exists(select 1 from public.orders where id = order_id and (buyer_id = auth.uid() or seller_id = auth.uid()))
);
create policy "seller reads payouts" on public.payouts for select using (seller_id = auth.uid() or public.is_admin());
create policy "users read notifications" on public.notifications for select using (user_id = auth.uid());
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "public reads listing media" on storage.objects for select
using (bucket_id = 'listing-images');
create policy "approved sellers upload listing media" on storage.objects for insert
with check (
  bucket_id = 'listing-images'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1 from public.seller_applications
    where user_id = auth.uid() and status = 'approved'
  )
);
create policy "owners manage listing media" on storage.objects for update
using (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owners delete listing media" on storage.objects for delete
using (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]);
