alter table public.credit_purchases
  add column if not exists pending_checkout_guarded boolean not null default true,
  add column if not exists checkout_scope_id uuid not null default
    '00000000-0000-0000-0000-000000000000'::uuid;

update public.credit_purchases
set
  pending_checkout_guarded = false,
  checkout_scope_id = coalesce(
    resume_analysis_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  )
where status = 'checkout_pending';

create unique index credit_purchases_one_pending_checkout_idx
  on public.credit_purchases (
    user_id,
    payment_provider,
    checkout_scope_id
  )
  where status = 'checkout_pending' and pending_checkout_guarded;

alter table public.payment_events
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_token uuid;

create or replace function public.claim_payment_event(
  p_event_id text,
  p_payload_digest text,
  p_processing_token uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_event public.payment_events%rowtype;
begin
  select *
  into payment_event
  from public.payment_events
  where event_id = p_event_id
  for update;

  if not found then
    return 'missing';
  end if;

  if payment_event.payload_digest <> p_payload_digest then
    return 'mismatch';
  end if;

  if payment_event.processed_at is not null then
    return 'processed';
  end if;

  if payment_event.processing_started_at is not null
    and payment_event.processing_started_at > now() - interval '5 minutes' then
    return 'busy';
  end if;

  update public.payment_events
  set
    processing_started_at = now(),
    processing_token = p_processing_token
  where event_id = p_event_id;

  return 'claimed';
end;
$$;

revoke all on function public.claim_payment_event(text, text, uuid) from public;
grant execute on function public.claim_payment_event(text, text, uuid)
  to service_role;
