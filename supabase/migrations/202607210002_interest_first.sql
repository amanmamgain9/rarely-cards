create type public.interest_status as enum ('new', 'contacted', 'closed');
alter table public.profiles add column if not exists email text;
create table public.listing_interests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  note text check (char_length(note) <= 500),
  status public.interest_status not null default 'new',
  admin_note text check (char_length(admin_note) <= 2000),
  contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  recipient text not null,
  template text not null,
  provider_id text,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.seller_applications add column if not exists inventory_summary text;
alter table public.bids alter column deposit_id drop not null;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "users manage own application" on public.seller_applications;
drop policy if exists "sellers manage own listings" on public.listings;
drop policy if exists "public reads bid amounts" on public.bids;
drop policy if exists "approved sellers upload listing media" on storage.objects;
drop policy if exists "owners manage listing media" on storage.objects;
drop policy if exists "owners delete listing media" on storage.objects;
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, updated_at) on public.profiles to authenticated;
create policy "users update safe profile fields"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());
create policy "users submit seller applications"
on public.seller_applications for insert
with check (user_id = auth.uid() and status = 'pending' and bank_status = 'pending');
create policy "users read own seller applications"
on public.seller_applications for select
using (user_id = auth.uid() or public.is_admin());
create policy "admins manage listings"
on public.listings for all
using (public.is_admin())
with check (public.is_admin());
create policy "bidders read own bids"
on public.bids for select
using (bidder_id = auth.uid() or public.is_admin());
alter table public.listing_interests enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.webhook_events enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_log enable row level security;
alter table public.email_deliveries enable row level security;
create policy "buyers read own interests"
on public.listing_interests for select
using (buyer_id = auth.uid() or public.is_admin());
create policy "admins manage interests"
on public.listing_interests for all
using (public.is_admin())
with check (public.is_admin());
create policy "admins manage seller applications"
on public.seller_applications for all
using (public.is_admin())
with check (public.is_admin());
create policy "admins manage listing images"
on public.listing_images for all
using (public.is_admin())
with check (public.is_admin());
create policy "admins manage auctions"
on public.auctions for all
using (public.is_admin())
with check (public.is_admin());
create policy "admins read audit log"
on public.audit_log for select
using (public.is_admin());
create policy "admins write audit log"
on public.audit_log for insert
with check (public.is_admin());
create policy "admins manage settings"
on public.platform_settings for all
using (public.is_admin())
with check (public.is_admin());
grant select on public.listing_interests to authenticated;
grant select on public.listings, public.listing_images, public.auctions to anon, authenticated;
grant select on public.bids to authenticated;
create or replace function public.record_listing_interest(
  p_listing_id uuid,
  p_note text default null
)
returns public.listing_interests
language plpgsql
security definer
set search_path = public
as $$
declare
  interest_row public.listing_interests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_note is not null and char_length(p_note) > 500 then raise exception 'NOTE_TOO_LONG'; end if;
  perform 1 from public.listings
    where id = p_listing_id and status = 'live' and mode = 'fixed';
  if not found then raise exception 'LISTING_NOT_AVAILABLE'; end if;
  select * into interest_row from public.listing_interests
    where listing_id = p_listing_id and buyer_id = auth.uid();
  if found and interest_row.updated_at > now() - interval '5 minutes' then
    return interest_row;
  end if;

  insert into public.listing_interests(listing_id, buyer_id, note)
  values (p_listing_id, auth.uid(), nullif(trim(p_note), ''))
  on conflict (listing_id, buyer_id) do update
    set note = excluded.note, updated_at = now()
  returning * into interest_row;

  insert into public.audit_log(actor_id, action, entity_type, entity_id, after_data)
  values (
    auth.uid(),
    'interest.recorded',
    'listing_interest',
    interest_row.id::text,
    jsonb_build_object('listing_id', p_listing_id)
  );
  return interest_row;
end;
$$;
create or replace function public.place_soft_bid(
  p_auction_id uuid,
  p_amount integer
)
returns public.bids
language plpgsql
security definer
set search_path = public
as $$
declare
  auction_row public.auctions;
  required_amount integer;
  new_bid public.bids;
  previous_bidder uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if (
    select count(*) from public.bids
    where bidder_id = auth.uid() and created_at > now() - interval '1 minute'
  ) >= 10 then raise exception 'RATE_LIMITED'; end if;

  select * into auction_row from public.auctions where id = p_auction_id for update;
  if not found or now() < auction_row.starts_at or now() >= auction_row.ends_at
    or auction_row.closed_at is not null then raise exception 'AUCTION_NOT_OPEN'; end if;
  select bidder_id into previous_bidder from public.bids where id = auction_row.current_bid_id;
  required_amount := coalesce(
    auction_row.current_bid + public.bid_increment(auction_row.current_bid),
    auction_row.starting_bid
  );
  if p_amount < required_amount then raise exception 'BID_TOO_LOW'; end if;

  insert into public.bids(auction_id, bidder_id, deposit_id, amount)
  values (p_auction_id, auth.uid(), null, p_amount)
  returning * into new_bid;

  update public.auctions set
    current_bid = new_bid.amount,
    current_bid_id = new_bid.id,
    bid_count = bid_count + 1
  where id = p_auction_id;

  if previous_bidder is not null and previous_bidder <> auth.uid() then
    insert into public.notifications(user_id, kind, title, body, data)
    values (
      previous_bidder,
      'outbid',
      'You have been outbid',
      'Another buyer placed a higher non-binding bid.',
      jsonb_build_object('auction_id', p_auction_id)
    );
  end if;

  insert into public.audit_log(actor_id, action, entity_type, entity_id, after_data)
  values (
    auth.uid(),
    'soft_bid.placed',
    'bid',
    new_bid.id::text,
    jsonb_build_object('auction_id', p_auction_id, 'amount', p_amount)
  );
  return new_bid;
end;
$$;
create or replace function public.public_bid_history(p_auction_id uuid)
returns table (
  id uuid,
  bidder_mask text,
  amount integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    left(coalesce(nullif(p.full_name, ''), 'Bidder'), 1) || '•••' as bidder_mask,
    b.amount,
    b.created_at
  from public.bids b
  join public.profiles p on p.id = b.bidder_id
  join public.auctions a on a.id = b.auction_id
  join public.listings l on l.id = a.listing_id
  where b.auction_id = p_auction_id and l.status = 'live'
  order by b.amount desc, b.created_at asc
  limit 50
$$;
grant execute on function public.record_listing_interest(uuid, text) to authenticated;
grant execute on function public.place_soft_bid(uuid, integer) to authenticated;
grant execute on function public.public_bid_history(uuid) to anon, authenticated;
create or replace function public.close_due_soft_auctions()
returns table (
  auction_id uuid,
  listing_id uuid,
  listing_title text,
  winner_id uuid,
  winning_bid integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with closed as (
    update public.auctions a
      set
        closed_at = now(),
        winner_id = (select b.bidder_id from public.bids b where b.id = a.current_bid_id),
        winner_offer_expires_at = null
      where a.ends_at <= now() and a.closed_at is null
      returning a.*
  )
  select
    c.id,
    c.listing_id,
    l.title,
    c.winner_id,
    c.current_bid
  from closed c
  join public.listings l on l.id = c.listing_id;
end;
$$;
create index listing_interests_created_idx on public.listing_interests(created_at desc);
create index listing_interests_listing_idx on public.listing_interests(listing_id);
create index bids_rate_limit_idx on public.bids(bidder_id, created_at desc);
create or replace function public.prevent_audit_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'AUDIT_LOG_IMMUTABLE';
end;
$$;
create trigger audit_log_immutable
before update or delete on public.audit_log
for each row execute function public.prevent_audit_changes();
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;
