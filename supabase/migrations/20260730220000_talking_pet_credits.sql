alter table public.credit_purchases
  add column if not exists credit_kind text not null default 'card';

alter table public.credit_purchases
  add constraint credit_purchases_credit_kind_check
  check (credit_kind in ('card', 'talking_video'));

-- A pre-deployment card checkout and a new video checkout are different
-- catalog obligations. Keep each kind idempotent without letting a legacy
-- pending row permanently block the new offer.
drop index if exists public.credit_purchases_one_pending_checkout_idx;
create unique index credit_purchases_one_pending_checkout_idx
  on public.credit_purchases (
    user_id,
    payment_provider,
    checkout_scope_id,
    credit_kind
  )
  where status = 'checkout_pending' and pending_checkout_guarded;

alter table public.credit_purchases
  drop constraint if exists credit_purchases_credits_granted_check;

alter table public.credit_purchases
  add constraint credit_purchases_credits_granted_check check (
    (credit_kind = 'card' and credits_granted = 5)
    or (credit_kind = 'talking_video' and credits_granted = 3)
  );

alter table public.analysis_requests
  add column if not exists dialogue_suggestions jsonb,
  add column if not exists selected_dialogue text;

alter table public.analysis_requests
  drop constraint if exists generation_states_have_entitlement;

alter table public.analysis_requests
  add constraint generation_states_have_entitlement check (
    status not in ('paid', 'processing', 'photo_rejected', 'completed')
    or paddle_transaction_id is not null
    or (
      credit_purchase_id is not null
      and (
        credit_state in ('reserved', 'consumed')
        or (
          credit_state = 'restored'
          and status in ('photo_rejected', 'completed')
        )
      )
    )
  );

alter table public.analysis_requests
  add constraint analysis_requests_selected_dialogue_check check (
    selected_dialogue is null
    or char_length(btrim(selected_dialogue)) between 1 and 120
  );

alter table public.video_generations
  add column if not exists usage_total_tokens bigint,
  add column if not exists pricing_usd_per_million_tokens numeric(12, 6),
  add column if not exists estimated_cost_usd_micros bigint,
  add column if not exists provider_model text,
  add column if not exists duration_seconds integer not null default 8,
  add column if not exists resolution text not null default '720p',
  add column if not exists aspect_ratio text not null default '9:16',
  add column if not exists generate_audio boolean not null default true,
  add column if not exists credit_refunded_at timestamptz,
  add column if not exists discard_requested_at timestamptz;

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
  if nullif(btrim(p_transaction_id), '') is null
    or p_provider not in ('paddle', 'lemon_squeezy', 'google_play') then
    raise exception 'Invalid credit grant';
  end if;

  select * into purchase
  from public.credit_purchases
  where id = p_purchase_id and user_id = p_user_id
  for update;

  if not found then raise exception 'Credit purchase not found'; end if;
  if p_credits <> purchase.credits_granted
    or (purchase.credit_kind = 'card' and p_credits <> 5)
    or (purchase.credit_kind = 'talking_video' and p_credits <> 3) then
    raise exception 'Credit catalog mismatch';
  end if;

  if purchase.status = 'active'
    and purchase.payment_provider = p_provider
    and purchase.provider_transaction_id = p_transaction_id then
    return false;
  end if;

  if purchase.status <> 'checkout_pending'
    or purchase.payment_provider <> p_provider
    or (purchase.provider_transaction_id is not null
      and purchase.provider_transaction_id <> p_transaction_id) then
    raise exception 'Credit purchase state conflict';
  end if;

  update public.credit_purchases set
    provider_transaction_id = p_transaction_id,
    status = 'active',
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
returns table (reserved boolean, purchase_id uuid, remaining_balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot public.analysis_requests%rowtype;
  analysis public.analysis_requests%rowtype;
  purchase public.credit_purchases%rowtype;
begin
  if char_length(btrim(p_pet_name)) not between 1 and 30
    or p_pet_pronouns not in ('he', 'she', 'they') then
    raise exception 'Invalid pet details';
  end if;
  select * into snapshot from public.analysis_requests
  where id = p_analysis_id and user_id = p_user_id;
  if not found then raise exception 'Analysis not found'; end if;
  if snapshot.credit_purchase_id is not null then
    select * into purchase from public.credit_purchases
    where id = snapshot.credit_purchase_id for update;
    select * into analysis from public.analysis_requests
    where id = p_analysis_id and user_id = p_user_id for update;
    if analysis.credit_state in ('reserved', 'consumed')
      and purchase.id = analysis.credit_purchase_id
      and purchase.credit_kind = 'card'
      and purchase.status in ('active', 'refund_pending') then
      return query select true, analysis.credit_purchase_id,
        coalesce(sum(cp.credits_remaining), 0)::integer
        from public.credit_purchases cp
        where cp.user_id = p_user_id and cp.status = 'active'
          and cp.credit_kind = 'card';
      return;
    end if;
    if analysis.credit_state in ('reserved', 'consumed') then
      raise exception 'Analysis already uses another entitlement';
    end if;
  end if;
  select * into purchase from public.credit_purchases
  where user_id = p_user_id and status = 'active' and credit_kind = 'card'
    and credits_remaining > 0
  order by completed_at asc nulls last, created_at asc, id asc
  limit 1 for update;
  select * into analysis from public.analysis_requests
  where id = p_analysis_id and user_id = p_user_id for update;
  if analysis.status not in ('awaiting_name', 'awaiting_payment')
    or analysis.credit_state in ('reserved', 'consumed', 'revoked') then
    raise exception 'Analysis is not ready for a credit';
  end if;
  if purchase.id is null then return query select false, null::uuid, 0; return; end if;
  update public.credit_purchases set credits_remaining = credits_remaining - 1
    where id = purchase.id and status = 'active' and credits_remaining > 0;
  if not found then return query select false, null::uuid, 0; return; end if;
  update public.analysis_requests set
    pet_name = btrim(p_pet_name), pet_pronouns = p_pet_pronouns, status = 'paid',
    credit_purchase_id = purchase.id, credit_state = 'reserved',
    credit_reserved_at = now(), credit_consumed_at = null, credit_released_at = null,
    paid_at = now(), expires_at = now() + interval '24 hours', error_code = null
  where id = analysis.id;
  return query select true, purchase.id,
    coalesce(sum(cp.credits_remaining), 0)::integer
    from public.credit_purchases cp
    where cp.user_id = p_user_id and cp.status = 'active' and cp.credit_kind = 'card';
end;
$$;

create or replace function public.reserve_talking_video_credit(
  p_user_id uuid,
  p_analysis_id uuid,
  p_pet_name text,
  p_dialogue text
)
returns table (reserved boolean, purchase_id uuid, remaining_balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot public.analysis_requests%rowtype;
  analysis public.analysis_requests%rowtype;
  purchase public.credit_purchases%rowtype;
begin
  if char_length(btrim(p_pet_name)) not between 1 and 30
    or char_length(btrim(p_dialogue)) not between 1 and 120 then
    raise exception 'Invalid talking-pet details';
  end if;
  select * into snapshot from public.analysis_requests
  where id = p_analysis_id and user_id = p_user_id;
  if not found then raise exception 'Analysis not found'; end if;

  -- Refund/revocation functions lock purchase then analysis. Keep that global
  -- order here as well so concurrent reservation and refund cannot deadlock.
  if snapshot.credit_purchase_id is not null then
    select * into purchase from public.credit_purchases
    where id = snapshot.credit_purchase_id for update;
    select * into analysis from public.analysis_requests
    where id = p_analysis_id and user_id = p_user_id for update;
    if analysis.credit_state in ('reserved', 'consumed')
      and purchase.id = analysis.credit_purchase_id
      and purchase.credit_kind = 'talking_video'
      and purchase.status in ('active', 'refund_pending') then
      update public.analysis_requests set selected_dialogue = btrim(p_dialogue)
      where id = analysis.id and selected_dialogue is null;
      return query select true, purchase.id,
        coalesce(sum(cp.credits_remaining), 0)::integer
        from public.credit_purchases cp where cp.user_id = p_user_id
          and cp.status = 'active' and cp.credit_kind = 'talking_video';
      return;
    end if;
    if analysis.credit_state in ('reserved', 'consumed') then
      raise exception 'Analysis already uses another entitlement';
    end if;
  end if;

  select * into purchase from public.credit_purchases
  where user_id = p_user_id and status = 'active' and credit_kind = 'talking_video'
    and credits_remaining > 0
  order by completed_at asc nulls last, created_at asc, id asc
  limit 1 for update;
  select * into analysis from public.analysis_requests
  where id = p_analysis_id and user_id = p_user_id for update;
  if analysis.status not in ('awaiting_name', 'awaiting_payment', 'completed')
    or analysis.credit_state in ('reserved', 'consumed', 'revoked') then
    raise exception 'Analysis is not ready for a video credit';
  end if;
  if purchase.id is null then return query select false, null::uuid, 0; return; end if;
  update public.credit_purchases set credits_remaining = credits_remaining - 1
    where id = purchase.id and status = 'active' and credits_remaining > 0;
  if not found then return query select false, null::uuid, 0; return; end if;
  update public.analysis_requests set
    pet_name = btrim(p_pet_name), pet_pronouns = coalesce(pet_pronouns, 'they'),
    selected_dialogue = btrim(p_dialogue),
    status = case when status = 'completed' then status else 'paid' end,
    credit_purchase_id = purchase.id, credit_state = 'reserved',
    credit_reserved_at = now(), credit_consumed_at = null, credit_released_at = null,
    paid_at = coalesce(paid_at, now()), expires_at = null, error_code = null
  where id = analysis.id;
  return query select true, purchase.id,
    coalesce(sum(cp.credits_remaining), 0)::integer
    from public.credit_purchases cp where cp.user_id = p_user_id
      and cp.status = 'active' and cp.credit_kind = 'talking_video';
end;
$$;

create or replace function public.restore_talking_video_credit(p_analysis_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot public.analysis_requests%rowtype;
  analysis public.analysis_requests%rowtype;
  purchase public.credit_purchases%rowtype;
begin
  select * into snapshot from public.analysis_requests where id = p_analysis_id;
  if not found or snapshot.credit_purchase_id is null then return false; end if;
  select * into purchase from public.credit_purchases
  where id = snapshot.credit_purchase_id for update;
  select * into analysis from public.analysis_requests
  where id = p_analysis_id for update;
  if not found or analysis.credit_state not in ('reserved', 'consumed') then return false; end if;
  if purchase.id is null or purchase.credit_kind <> 'talking_video' then return false; end if;
  update public.credit_purchases set credits_remaining = least(credits_granted, credits_remaining + 1)
  where id = purchase.id and status in ('active', 'refund_pending');
  if not found then return false; end if;
  update public.analysis_requests set credit_state = 'restored', credit_released_at = now()
  where id = analysis.id;
  return true;
end;
$$;

revoke all on function public.reserve_talking_video_credit(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.restore_talking_video_credit(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_talking_video_credit(uuid, uuid, text, text)
  to service_role;
grant execute on function public.restore_talking_video_credit(uuid)
  to service_role;
