alter table public.credit_purchases
  rename column paddle_transaction_id to provider_transaction_id;

alter table public.credit_purchases
  rename column paddle_adjustment_id to provider_adjustment_id;

alter table public.credit_purchases
  add column payment_provider text not null default 'paddle' check (
    payment_provider in ('paddle', 'lemon_squeezy')
  ),
  add column provider_checkout_id text;

update public.credit_purchases
set provider_checkout_id = provider_transaction_id
where provider_transaction_id is not null;

alter table public.credit_purchases
  drop constraint if exists credit_purchases_paddle_transaction_id_key,
  drop constraint if exists credit_purchases_paddle_adjustment_id_key;

alter table public.credit_purchases
  add constraint credit_purchases_provider_transaction_key
    unique (payment_provider, provider_transaction_id),
  add constraint credit_purchases_provider_adjustment_key
    unique (payment_provider, provider_adjustment_id),
  add constraint credit_purchases_provider_checkout_key
    unique (payment_provider, provider_checkout_id);

alter table public.payment_events
  add column payment_provider text not null default 'paddle' check (
    payment_provider in ('paddle', 'lemon_squeezy')
  );

drop function if exists public.grant_credit_purchase(uuid, uuid, text, integer);

create function public.grant_credit_purchase(
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
  if p_provider not in ('paddle', 'lemon_squeezy')
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
