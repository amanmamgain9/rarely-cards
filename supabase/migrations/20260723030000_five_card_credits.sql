create table public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paddle_transaction_id text unique,
  paddle_adjustment_id text unique,
  resume_analysis_id uuid references public.analysis_requests(id) on delete set null,
  status text not null default 'checkout_pending' check (
    status in (
      'checkout_pending',
      'active',
      'refund_pending',
      'refunded',
      'disputed',
      'failed'
    )
  ),
  credits_granted integer not null default 5 check (credits_granted = 5),
  credits_remaining integer not null default 0 check (
    credits_remaining between 0 and credits_granted
  ),
  amount_cents integer not null default 500 check (amount_cents >= 0),
  currency text not null default 'USD' check (currency = upper(currency)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  refund_requested_at timestamptz,
  refunded_at timestamptz
);

create index credit_purchases_user_created_idx
  on public.credit_purchases (user_id, created_at desc);
create index credit_purchases_available_idx
  on public.credit_purchases (user_id, completed_at, id)
  where status = 'active' and credits_remaining > 0;

alter table public.analysis_requests
  add column credit_purchase_id uuid references public.credit_purchases(id) on delete set null,
  add column credit_state text check (
    credit_state is null or credit_state in ('reserved', 'consumed', 'restored')
  ),
  add column credit_reserved_at timestamptz,
  add column credit_consumed_at timestamptz,
  add column credit_released_at timestamptz,
  add column card_photo_path text;

alter table public.analysis_requests
  drop constraint if exists payment_states_have_transaction;

alter table public.analysis_requests
  add constraint generation_states_have_entitlement check (
    status not in ('paid', 'processing', 'photo_rejected', 'completed')
    or paddle_transaction_id is not null
    or (
      credit_purchase_id is not null
      and credit_state in ('reserved', 'consumed')
    )
  ),
  add constraint card_photo_path_is_owned check (
    card_photo_path is null
    or card_photo_path like user_id::text || '/' || id::text || '/%'
  );

alter table public.payment_events
  add column credit_purchase_id uuid references public.credit_purchases(id) on delete set null;

create or replace function public.set_credit_purchase_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger credit_purchases_set_updated_at
before update on public.credit_purchases
for each row execute function public.set_credit_purchase_updated_at();

create or replace function public.grant_credit_purchase(
  p_purchase_id uuid,
  p_user_id uuid,
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
  if p_credits <> 5 or nullif(btrim(p_transaction_id), '') is null then
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
    and purchase.paddle_transaction_id = p_transaction_id then
    return false;
  end if;

  if purchase.status <> 'checkout_pending'
    or (
      purchase.paddle_transaction_id is not null
      and purchase.paddle_transaction_id <> p_transaction_id
    ) then
    raise exception 'Credit purchase state conflict';
  end if;

  update public.credit_purchases
  set
    paddle_transaction_id = p_transaction_id,
    status = 'active',
    credits_granted = p_credits,
    credits_remaining = p_credits,
    completed_at = now()
  where id = purchase.id;

  return true;
end;
$$;

create or replace function public.reserve_credit_for_analysis(
  p_user_id uuid,
  p_analysis_id uuid,
  p_pet_name text,
  p_pet_pronouns text
)
returns table (
  reserved boolean,
  purchase_id uuid,
  remaining_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  analysis public.analysis_requests%rowtype;
  purchase public.credit_purchases%rowtype;
begin
  if char_length(btrim(p_pet_name)) not between 1 and 30
    or p_pet_pronouns not in ('he', 'she', 'they') then
    raise exception 'Invalid pet details';
  end if;

  select *
  into analysis
  from public.analysis_requests
  where id = p_analysis_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Analysis not found';
  end if;

  if analysis.credit_state in ('reserved', 'consumed') then
    return query
    select
      true,
      analysis.credit_purchase_id,
      coalesce(sum(cp.credits_remaining), 0)::integer
    from public.credit_purchases cp
    where cp.user_id = p_user_id and cp.status = 'active';
    return;
  end if;

  if analysis.status not in ('awaiting_name', 'awaiting_payment') then
    raise exception 'Analysis is not ready for a credit';
  end if;

  select *
  into purchase
  from public.credit_purchases
  where user_id = p_user_id
    and status = 'active'
    and credits_remaining > 0
  order by completed_at asc nulls last, created_at asc, id asc
  limit 1
  for update;

  if not found then
    return query
    select false, null::uuid, 0;
    return;
  end if;

  update public.credit_purchases
  set credits_remaining = credits_remaining - 1
  where id = purchase.id;

  update public.analysis_requests
  set
    pet_name = btrim(p_pet_name),
    pet_pronouns = p_pet_pronouns,
    status = 'paid',
    credit_purchase_id = purchase.id,
    credit_state = 'reserved',
    credit_reserved_at = now(),
    paid_at = now(),
    expires_at = now() + interval '24 hours',
    error_code = null
  where id = analysis.id;

  return query
  select
    true,
    purchase.id,
    coalesce(sum(cp.credits_remaining), 0)::integer
  from public.credit_purchases cp
  where cp.user_id = p_user_id and cp.status = 'active';
end;
$$;

create or replace function public.consume_analysis_credit(p_analysis_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update public.analysis_requests
  set
    credit_state = 'consumed',
    credit_consumed_at = now(),
    credit_released_at = null
  where id = p_analysis_id and credit_state = 'reserved';

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.restore_analysis_credit(p_analysis_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  analysis public.analysis_requests%rowtype;
begin
  select *
  into analysis
  from public.analysis_requests
  where id = p_analysis_id
  for update;

  if not found or analysis.credit_state <> 'reserved' then
    return false;
  end if;

  update public.credit_purchases
  set credits_remaining = least(credits_granted, credits_remaining + 1)
  where id = analysis.credit_purchase_id
    and status in ('active', 'refund_pending');

  update public.analysis_requests
  set
    status = case
      when status in ('paid', 'processing') then 'failed'::public.analysis_status
      else status
    end,
    credit_state = 'restored',
    credit_released_at = now()
  where id = analysis.id;

  return true;
end;
$$;

alter table public.credit_purchases enable row level security;

create policy "Users can read their own credit purchases"
on public.credit_purchases
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.credit_purchases to authenticated;

revoke all on function public.grant_credit_purchase(uuid, uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.reserve_credit_for_analysis(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.consume_analysis_credit(uuid)
  from public, anon, authenticated;
revoke all on function public.restore_analysis_credit(uuid)
  from public, anon, authenticated;

grant execute on function public.grant_credit_purchase(uuid, uuid, text, integer)
  to service_role;
grant execute on function public.reserve_credit_for_analysis(uuid, uuid, text, text)
  to service_role;
grant execute on function public.consume_analysis_credit(uuid)
  to service_role;
grant execute on function public.restore_analysis_credit(uuid)
  to service_role;
