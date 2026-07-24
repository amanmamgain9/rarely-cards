alter table public.credit_purchases
  drop constraint if exists credit_purchases_payment_provider_check;

alter table public.credit_purchases
  add constraint credit_purchases_payment_provider_check check (
    payment_provider in ('paddle', 'lemon_squeezy', 'google_play')
  );

alter table public.payment_events
  drop constraint if exists payment_events_payment_provider_check;

alter table public.payment_events
  add constraint payment_events_payment_provider_check check (
    payment_provider in ('paddle', 'lemon_squeezy', 'google_play')
  );

create table public.google_play_purchases (
  purchase_token text primary key,
  credit_purchase_id uuid not null unique
    references public.credit_purchases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  order_id text not null unique,
  purchase_state text not null check (
    purchase_state in ('purchased', 'consumed', 'canceled', 'voided')
  ),
  purchased_at timestamptz,
  consumed_at timestamptz,
  voided_at timestamptz,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index google_play_purchases_user_idx
  on public.google_play_purchases(user_id, created_at desc);

create trigger google_play_purchases_set_updated_at
before update on public.google_play_purchases
for each row execute function public.set_credit_purchase_updated_at();

alter table public.google_play_purchases enable row level security;
revoke all on public.google_play_purchases from public, anon, authenticated;
grant all on public.google_play_purchases to service_role;

create or replace function public.grant_credit_purchase(
  p_purchase_id uuid,
  p_user_id uuid,
  p_provider text,
  p_transaction_id text,
  p_credits integer default 5
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase public.credit_purchases%rowtype;
begin
  if p_provider not in ('paddle', 'lemon_squeezy', 'google_play')
    or p_credits <> 5
    or nullif(btrim(p_transaction_id), '') is null then
    raise exception 'Invalid credit grant';
  end if;

  select *
  into purchase
  from public.credit_purchases
  where id = p_purchase_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Credit purchase not found';
  end if;

  if purchase.status = 'active'
    and purchase.payment_provider = p_provider
    and purchase.provider_transaction_id = p_transaction_id then
    return false;
  end if;

  if purchase.status <> 'checkout_pending'
    or purchase.payment_provider <> p_provider
    or (
      purchase.provider_transaction_id is not null
      and purchase.provider_transaction_id <> p_transaction_id
    ) then
    raise exception 'Credit purchase state conflict';
  end if;

  update public.credit_purchases
  set
    provider_transaction_id = p_transaction_id,
    status = 'active',
    credits_granted = p_credits,
    credits_remaining = p_credits,
    completed_at = now()
  where id = purchase.id;

  return true;
end;
$$;

revoke all on function public.grant_credit_purchase(uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.grant_credit_purchase(uuid, uuid, text, text, integer)
  to service_role;
