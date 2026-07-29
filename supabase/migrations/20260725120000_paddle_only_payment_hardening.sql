alter table public.payment_events
  alter column processed_at drop default,
  alter column processed_at drop not null;

alter table public.credit_purchases
  add column if not exists refund_attempt_id uuid,
  add column if not exists refund_attempted_at timestamptz;

alter table public.credit_purchases
  drop constraint if exists credit_purchases_payment_provider_check;

alter table public.credit_purchases
  add constraint credit_purchases_payment_provider_check check (
    -- Lemon Squeezy remains valid for historical purchases and webhook
    -- fulfillment. New checkout creation is restricted in application code.
    payment_provider in ('paddle', 'lemon_squeezy', 'google_play')
  );

alter table public.payment_events
  drop constraint if exists payment_events_payment_provider_check;

alter table public.payment_events
  add constraint payment_events_payment_provider_check check (
    -- Preserve historical webhook rows so this migration can be applied
    -- without rewriting their provider identity.
    payment_provider in ('paddle', 'lemon_squeezy', 'google_play')
  );

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

  if purchase.status in ('active', 'refund_pending')
    and purchase.payment_provider = p_provider
    and purchase.provider_transaction_id = p_transaction_id
    and purchase.completed_at is not null then
    return false;
  end if;

  if purchase.status not in ('checkout_pending', 'active', 'refund_pending')
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
    status = case
      when purchase.status = 'refund_pending' then 'refund_pending'
      else 'active'
    end,
    credits_granted = p_credits,
    credits_remaining = p_credits,
    completed_at = now()
  where id = purchase.id;

  return true;
end;
$$;
