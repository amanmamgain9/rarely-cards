alter table public.analysis_requests
  add column if not exists processing_token uuid,
  add column if not exists refund_attempt_id uuid,
  add column if not exists refund_attempted_at timestamptz,
  add column if not exists paddle_adjustment_occurred_at timestamptz,
  add column if not exists pre_dispute_status public.analysis_status,
  add column if not exists pre_dispute_adjustment_id text,
  add column if not exists pre_dispute_refund_attempt_id uuid,
  add column if not exists pre_dispute_refund_attempted_at timestamptz,
  add column if not exists pre_dispute_error_code text;

alter table public.analysis_requests
  drop constraint if exists analysis_requests_credit_state_check;

alter table public.analysis_requests
  add constraint analysis_requests_credit_state_check check (
    credit_state is null
    or credit_state in ('reserved', 'consumed', 'restored', 'revoked')
  );

alter table public.credit_purchases
  add column if not exists revoked_credits_remaining integer,
  add column if not exists provider_adjustment_occurred_at timestamptz,
  add column if not exists pre_dispute_status text,
  add column if not exists pre_dispute_adjustment_id text,
  add column if not exists pre_dispute_refund_requested_at timestamptz,
  add column if not exists pre_dispute_refund_attempt_id uuid,
  add column if not exists pre_dispute_refund_attempted_at timestamptz;

alter table public.credit_purchases
  add constraint credit_purchases_revoked_credits_check check (
    revoked_credits_remaining is null
    or revoked_credits_remaining between 0 and credits_granted
  );

alter table public.credit_purchases
  add constraint credit_purchases_pre_dispute_status_check check (
    pre_dispute_status is null
    or pre_dispute_status in (
      'checkout_pending',
      'active',
      'refund_pending',
      'refunded',
      'disputed',
      'failed'
    )
  );

-- Repair rows that an earlier version of the concurrency migration may have
-- failed while their provider checkout was still payable. Provider lookup or
-- webhook fulfillment remains authoritative for their eventual terminal state.
update public.credit_purchases
set
  status = 'checkout_pending',
  pending_checkout_guarded = false
where status = 'failed'
  and completed_at is null
  and (
    provider_checkout_id is not null
    or provider_transaction_id is not null
  );

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
  analysis_snapshot public.analysis_requests%rowtype;
  analysis public.analysis_requests%rowtype;
  purchase public.credit_purchases%rowtype;
begin
  if char_length(btrim(p_pet_name)) not between 1 and 30
    or p_pet_pronouns not in ('he', 'she', 'they') then
    raise exception 'Invalid pet details';
  end if;

  select *
  into analysis_snapshot
  from public.analysis_requests
  where id = p_analysis_id and user_id = p_user_id;

  if not found then
    raise exception 'Analysis not found';
  end if;

  if analysis_snapshot.credit_purchase_id is not null then
    select *
    into purchase
    from public.credit_purchases
    where id = analysis_snapshot.credit_purchase_id
    for update;

    select *
    into analysis
    from public.analysis_requests
    where id = p_analysis_id and user_id = p_user_id
    for update;

    if analysis.credit_state in ('reserved', 'consumed')
      and purchase.status in ('active', 'refund_pending') then
      return query
      select
        true,
        analysis.credit_purchase_id,
        coalesce(sum(cp.credits_remaining), 0)::integer
      from public.credit_purchases cp
      where cp.user_id = p_user_id and cp.status = 'active';
      return;
    end if;
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

  select *
  into analysis
  from public.analysis_requests
  where id = p_analysis_id and user_id = p_user_id
  for update;

  if analysis.status not in ('awaiting_name', 'awaiting_payment')
    or analysis.credit_state in ('reserved', 'consumed', 'revoked') then
    raise exception 'Analysis is not ready for a credit';
  end if;

  if purchase.id is null then
    return query select false, null::uuid, 0;
    return;
  end if;

  update public.credit_purchases
  set credits_remaining = credits_remaining - 1
  where id = purchase.id
    and status = 'active'
    and credits_remaining > 0;

  if not found then
    return query select false, null::uuid, 0;
    return;
  end if;

  update public.analysis_requests
  set
    pet_name = btrim(p_pet_name),
    pet_pronouns = p_pet_pronouns,
    status = 'paid',
    credit_purchase_id = purchase.id,
    credit_state = 'reserved',
    credit_reserved_at = now(),
    credit_consumed_at = null,
    credit_released_at = null,
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

create or replace function public.claim_analysis_for_processing(
  p_analysis_id uuid,
  p_processing_token uuid
)
returns table (
  id uuid,
  user_id uuid,
  object_path text,
  card_style public.card_style,
  pet_name text,
  pet_pronouns text,
  attempt_count integer,
  credit_purchase_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot public.analysis_requests%rowtype;
  analysis public.analysis_requests%rowtype;
  purchase public.credit_purchases%rowtype;
begin
  select *
  into snapshot
  from public.analysis_requests
  where analysis_requests.id = p_analysis_id;

  if not found then
    return;
  end if;

  if snapshot.credit_purchase_id is not null then
    select *
    into purchase
    from public.credit_purchases
    where credit_purchases.id = snapshot.credit_purchase_id
    for update;
  end if;

  select *
  into analysis
  from public.analysis_requests
  where analysis_requests.id = p_analysis_id
  for update;

  if not found
    or analysis.object_path is null
    or analysis.attempt_count >= 3
    or not (
      analysis.status = 'paid'
      or (
        analysis.status = 'processing'
        and analysis.processing_started_at < now() - interval '10 minutes'
      )
    ) then
    return;
  end if;

  if analysis.credit_purchase_id is not null then
    if purchase.id is null
      or purchase.id <> analysis.credit_purchase_id
      or purchase.status not in ('active', 'refund_pending')
      or analysis.credit_state not in ('reserved', 'consumed') then
      return;
    end if;
  elsif analysis.paddle_transaction_id is null then
    return;
  end if;

  update public.analysis_requests ar
  set
    status = 'processing',
    processing_started_at = now(),
    processing_token = p_processing_token,
    attempt_count = analysis.attempt_count + 1,
    error_code = null
  where ar.id = analysis.id;

  return query
  select
    ar.id,
    ar.user_id,
    ar.object_path,
    ar.card_style,
    ar.pet_name,
    ar.pet_pronouns,
    ar.attempt_count,
    ar.credit_purchase_id
  from public.analysis_requests ar
  where ar.id = analysis.id;
end;
$$;

create or replace function public.finalize_analysis_result(
  p_analysis_id uuid,
  p_processing_token uuid,
  p_outcome text,
  p_result_json jsonb,
  p_rejection_reason text,
  p_rejection_message text,
  p_card_photo_path text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot public.analysis_requests%rowtype;
  analysis public.analysis_requests%rowtype;
  purchase public.credit_purchases%rowtype;
begin
  if p_outcome not in ('completed', 'photo_rejected') then
    raise exception 'Invalid analysis outcome';
  end if;
  if p_outcome = 'completed'
    and (p_result_json is null or p_card_photo_path is null) then
    raise exception 'Completed analysis requires a result and photo';
  end if;
  if p_outcome = 'photo_rejected'
    and (p_rejection_reason is null or p_rejection_message is null) then
    raise exception 'Rejected analysis requires a reason and message';
  end if;

  select *
  into snapshot
  from public.analysis_requests
  where id = p_analysis_id;
  if not found then
    return 'missing';
  end if;

  if snapshot.credit_purchase_id is not null then
    select *
    into purchase
    from public.credit_purchases
    where id = snapshot.credit_purchase_id
    for update;
  end if;

  select *
  into analysis
  from public.analysis_requests
  where id = p_analysis_id
  for update;

  if analysis.status <> 'processing'
    or analysis.processing_token is distinct from p_processing_token then
    if analysis.status in ('completed', 'photo_rejected') then
      return 'already_finalized';
    end if;
    return 'stale_claim';
  end if;

  if analysis.credit_purchase_id is not null then
    if purchase.id is null
      or purchase.id <> analysis.credit_purchase_id
      or purchase.status not in ('active', 'refund_pending') then
      return 'revoked';
    end if;
    if analysis.credit_state not in ('reserved', 'consumed') then
      return 'credit_conflict';
    end if;
  elsif analysis.paddle_transaction_id is null then
    return 'entitlement_missing';
  end if;

  if p_outcome = 'completed' then
    update public.analysis_requests
    set
      status = 'completed',
      card_photo_path = p_card_photo_path,
      result_json = p_result_json,
      rejection_reason = null,
      rejection_message = null,
      completed_at = now(),
      processing_started_at = null,
      processing_token = null,
      expires_at = null,
      credit_state = case
        when credit_purchase_id is not null then 'consumed'
        else credit_state
      end,
      credit_consumed_at = case
        when credit_purchase_id is not null
          then coalesce(credit_consumed_at, now())
        else credit_consumed_at
      end,
      credit_released_at = null
    where id = analysis.id;
  else
    update public.analysis_requests
    set
      status = 'photo_rejected',
      result_json = null,
      rejection_reason = p_rejection_reason,
      rejection_message = p_rejection_message,
      completed_at = null,
      processing_started_at = null,
      processing_token = null,
      expires_at = null,
      credit_state = case
        when credit_purchase_id is not null then 'consumed'
        else credit_state
      end,
      credit_consumed_at = case
        when credit_purchase_id is not null
          then coalesce(credit_consumed_at, now())
        else credit_consumed_at
      end,
      credit_released_at = null
    where id = analysis.id;
  end if;

  return 'finalized';
end;
$$;

create or replace function public.retry_analysis_after_failure(
  p_analysis_id uuid,
  p_processing_token uuid,
  p_error_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot public.analysis_requests%rowtype;
  analysis public.analysis_requests%rowtype;
  purchase public.credit_purchases%rowtype;
begin
  select *
  into snapshot
  from public.analysis_requests
  where id = p_analysis_id;
  if not found then
    return 'missing';
  end if;

  if snapshot.credit_purchase_id is not null then
    select *
    into purchase
    from public.credit_purchases
    where id = snapshot.credit_purchase_id
    for update;
  end if;

  select *
  into analysis
  from public.analysis_requests
  where id = p_analysis_id
  for update;

  if analysis.status <> 'processing'
    or analysis.processing_token is distinct from p_processing_token then
    return 'stale_claim';
  end if;
  if analysis.credit_purchase_id is not null
    and (
      purchase.id is null
      or purchase.id <> analysis.credit_purchase_id
      or purchase.status not in ('active', 'refund_pending')
    ) then
    return 'revoked';
  end if;

  update public.analysis_requests
  set
    status = 'paid',
    processing_started_at = null,
    processing_token = null,
    error_code = p_error_code
  where id = analysis.id;

  return 'retry_scheduled';
end;
$$;

create or replace function public.fail_analysis_and_restore_credit(
  p_analysis_id uuid,
  p_processing_token uuid,
  p_error_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot public.analysis_requests%rowtype;
  analysis public.analysis_requests%rowtype;
  purchase public.credit_purchases%rowtype;
begin
  select *
  into snapshot
  from public.analysis_requests
  where id = p_analysis_id;
  if not found or snapshot.credit_purchase_id is null then
    return 'unsupported';
  end if;

  select *
  into purchase
  from public.credit_purchases
  where id = snapshot.credit_purchase_id
  for update;

  select *
  into analysis
  from public.analysis_requests
  where id = p_analysis_id
  for update;

  if analysis.status <> 'processing'
    or analysis.processing_token is distinct from p_processing_token then
    return 'stale_claim';
  end if;
  if purchase.id is null
    or purchase.id <> analysis.credit_purchase_id
    or purchase.status not in ('active', 'refund_pending') then
    return 'revoked';
  end if;
  if analysis.credit_state not in ('reserved', 'consumed') then
    return 'credit_conflict';
  end if;

  update public.credit_purchases
  set credits_remaining = least(credits_granted, credits_remaining + 1)
  where id = purchase.id;

  update public.analysis_requests
  set
    status = 'failed',
    processing_started_at = null,
    processing_token = null,
    error_code = p_error_code,
    credit_state = 'restored',
    credit_released_at = now(),
    expires_at = null
  where id = analysis.id;

  return 'restored';
end;
$$;

create or replace function public.recover_exhausted_analysis(
  p_analysis_id uuid,
  p_error_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot public.analysis_requests%rowtype;
  analysis public.analysis_requests%rowtype;
  purchase public.credit_purchases%rowtype;
  terminal_status public.analysis_status;
begin
  select *
  into snapshot
  from public.analysis_requests
  where id = p_analysis_id;
  if not found then
    return 'missing';
  end if;

  if snapshot.credit_purchase_id is not null then
    select *
    into purchase
    from public.credit_purchases
    where id = snapshot.credit_purchase_id
    for update;
  end if;

  select *
  into analysis
  from public.analysis_requests
  where id = p_analysis_id
  for update;

  if analysis.status <> 'processing'
    or analysis.attempt_count < 3
    or analysis.processing_started_at is null
    or analysis.processing_started_at >= now() - interval '10 minutes' then
    return 'not_exhausted';
  end if;

  if analysis.credit_purchase_id is null then
    if analysis.paddle_transaction_id is null then
      return 'entitlement_missing';
    end if;
    update public.analysis_requests
    set
      status = 'failed',
      processing_started_at = null,
      processing_token = null,
      error_code = p_error_code,
      expires_at = null
    where id = analysis.id;
    return 'legacy_refund_required';
  end if;

  if purchase.id is null or purchase.id <> analysis.credit_purchase_id then
    return 'entitlement_missing';
  end if;
  if purchase.status not in ('active', 'refund_pending') then
    terminal_status := case purchase.status
      when 'refunded' then 'refunded'::public.analysis_status
      when 'disputed' then 'disputed'::public.analysis_status
      else 'failed'::public.analysis_status
    end;
    update public.analysis_requests
    set
      status = terminal_status,
      processing_started_at = null,
      processing_token = null,
      credit_state = 'revoked',
      credit_released_at = now(),
      error_code = 'purchase_' || purchase.status,
      expires_at = null
    where id = analysis.id;
    return 'revoked';
  end if;
  if analysis.credit_state not in ('reserved', 'consumed') then
    return 'credit_conflict';
  end if;

  update public.credit_purchases
  set credits_remaining = least(credits_granted, credits_remaining + 1)
  where id = purchase.id;

  update public.analysis_requests
  set
    status = 'failed',
    processing_started_at = null,
    processing_token = null,
    error_code = p_error_code,
    credit_state = 'restored',
    credit_released_at = now(),
    expires_at = null
  where id = analysis.id;

  return 'restored';
end;
$$;

create or replace function public.revoke_credit_purchase(
  p_purchase_id uuid,
  p_status text,
  p_adjustment_id text,
  p_refunded_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase public.credit_purchases%rowtype;
  revoked_count integer;
  effective_status text;
  was_terminal boolean := false;
  next_analysis_status public.analysis_status;
begin
  if p_status not in ('failed', 'refunded', 'disputed')
    or nullif(btrim(p_adjustment_id), '') is null then
    raise exception 'Invalid purchase revocation';
  end if;

  select *
  into purchase
  from public.credit_purchases
  where id = p_purchase_id
  for update;

  if not found then
    return 'missing';
  end if;
  if purchase.status = 'refunded' then
    effective_status := 'refunded';
    was_terminal := true;
  elsif purchase.status = 'disputed' and p_status <> 'refunded' then
    effective_status := 'disputed';
    was_terminal := true;
  elsif purchase.status = 'failed' and p_status = 'failed' then
    effective_status := 'failed';
    was_terminal := true;
  else
    effective_status := p_status;
  end if;

  select count(*)::integer
  into revoked_count
  from public.analysis_requests
  where credit_purchase_id = purchase.id
    and status in ('paid', 'processing')
    and credit_state in ('reserved', 'consumed');

  if was_terminal then
    update public.credit_purchases
    set revoked_credits_remaining = coalesce(
      revoked_credits_remaining,
      least(credits_granted, credits_remaining + revoked_count)
    )
    where id = purchase.id;
  else
    update public.credit_purchases
    set
      status = effective_status,
      revoked_credits_remaining = coalesce(
        revoked_credits_remaining,
        least(credits_granted, credits_remaining + revoked_count)
      ),
      credits_remaining = 0,
      provider_adjustment_id = p_adjustment_id,
      refund_attempt_id = null,
      refund_attempted_at = null,
      pre_dispute_status = case
        when effective_status = 'disputed' then purchase.status
        else null
      end,
      pre_dispute_adjustment_id = case
        when effective_status = 'disputed' then purchase.provider_adjustment_id
        else null
      end,
      pre_dispute_refund_requested_at = case
        when effective_status = 'disputed' then purchase.refund_requested_at
        else null
      end,
      pre_dispute_refund_attempt_id = case
        when effective_status = 'disputed' then purchase.refund_attempt_id
        else null
      end,
      pre_dispute_refund_attempted_at = case
        when effective_status = 'disputed' then purchase.refund_attempted_at
        else null
      end,
      refunded_at = case
        when effective_status = 'refunded' then coalesce(p_refunded_at, now())
        else refunded_at
      end
    where id = purchase.id;
  end if;

  next_analysis_status := case effective_status
    when 'refunded' then 'refunded'::public.analysis_status
    when 'disputed' then 'disputed'::public.analysis_status
    else 'failed'::public.analysis_status
  end;

  update public.analysis_requests
  set
    status = next_analysis_status,
    credit_state = 'revoked',
    credit_released_at = now(),
    processing_started_at = null,
    processing_token = null,
    error_code = 'purchase_' || effective_status,
    refunded_at = case
      when effective_status = 'refunded' then coalesce(p_refunded_at, now())
      else refunded_at
    end,
    expires_at = null
  where credit_purchase_id = purchase.id
    and status in ('paid', 'processing')
    and credit_state in ('reserved', 'consumed');

  return case when was_terminal then 'already_terminal' else 'revoked' end;
end;
$$;

create or replace function public.reverse_credit_purchase_dispute(
  p_purchase_id uuid,
  p_adjustment_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase public.credit_purchases%rowtype;
begin
  if nullif(btrim(p_adjustment_id), '') is null then
    raise exception 'Invalid dispute reversal';
  end if;

  select *
  into purchase
  from public.credit_purchases
  where id = p_purchase_id
  for update;

  if not found then
    return 'missing';
  end if;
  if purchase.status <> 'disputed' then
    return 'not_disputed';
  end if;

  update public.credit_purchases
  set
    status = coalesce(pre_dispute_status, 'active'),
    credits_remaining = coalesce(revoked_credits_remaining, 0),
    revoked_credits_remaining = null,
    provider_adjustment_id = pre_dispute_adjustment_id,
    refund_requested_at = pre_dispute_refund_requested_at,
    refund_attempt_id = pre_dispute_refund_attempt_id,
    refund_attempted_at = pre_dispute_refund_attempted_at,
    pre_dispute_status = null,
    pre_dispute_adjustment_id = null,
    pre_dispute_refund_requested_at = null,
    pre_dispute_refund_attempt_id = null,
    pre_dispute_refund_attempted_at = null
  where id = purchase.id;

  return 'restored';
end;
$$;

create or replace function public.apply_legacy_analysis_adjustment(
  p_analysis_id uuid,
  p_decision text,
  p_adjustment_id text,
  p_occurred_at timestamptz,
  p_error_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  analysis public.analysis_requests%rowtype;
begin
  if p_decision not in (
    'disputed',
    'dispute_reversed',
    'refunded',
    'refund_pending',
    'refund_retry'
  ) or nullif(btrim(p_adjustment_id), '') is null then
    raise exception 'Invalid legacy adjustment';
  end if;

  select *
  into analysis
  from public.analysis_requests
  where id = p_analysis_id
  for update;

  if not found then
    return 'missing';
  end if;
  if analysis.paddle_adjustment_occurred_at is not null
    and p_occurred_at < analysis.paddle_adjustment_occurred_at then
    return 'stale';
  end if;
  if (
    p_decision = 'dispute_reversed' and analysis.status <> 'disputed'
  ) or (
    p_decision in ('refund_pending', 'refund_retry')
    and analysis.status = 'disputed'
  ) or (
    p_decision = 'disputed' and analysis.status = 'refunded'
  ) then
    update public.analysis_requests
    set paddle_adjustment_occurred_at = p_occurred_at
    where id = analysis.id;
    return 'ignored';
  end if;

  if p_decision = 'disputed' then
    update public.analysis_requests
    set
      status = 'disputed',
      pre_dispute_status = case
        when analysis.status <> 'disputed' then analysis.status
        else analysis.pre_dispute_status
      end,
      pre_dispute_adjustment_id = case
        when analysis.status <> 'disputed' then analysis.paddle_adjustment_id
        else analysis.pre_dispute_adjustment_id
      end,
      pre_dispute_refund_attempt_id = case
        when analysis.status <> 'disputed' then analysis.refund_attempt_id
        else analysis.pre_dispute_refund_attempt_id
      end,
      pre_dispute_refund_attempted_at = case
        when analysis.status <> 'disputed' then analysis.refund_attempted_at
        else analysis.pre_dispute_refund_attempted_at
      end,
      pre_dispute_error_code = case
        when analysis.status <> 'disputed' then analysis.error_code
        else analysis.pre_dispute_error_code
      end,
      paddle_adjustment_id = p_adjustment_id,
      paddle_adjustment_occurred_at = p_occurred_at,
      refund_attempt_id = null,
      refund_attempted_at = null,
      error_code = p_error_code
    where id = analysis.id;
  elsif p_decision = 'dispute_reversed' then
    update public.analysis_requests
    set
      status = coalesce(
        pre_dispute_status,
        case
          when result_json is not null then 'completed'
          when rejection_reason is not null then 'photo_rejected'
          when pet_name is null then 'awaiting_name'
          else 'paid'
        end
      ),
      paddle_adjustment_id = pre_dispute_adjustment_id,
      paddle_adjustment_occurred_at = p_occurred_at,
      refund_attempt_id = pre_dispute_refund_attempt_id,
      refund_attempted_at = pre_dispute_refund_attempted_at,
      error_code = pre_dispute_error_code,
      pre_dispute_status = null,
      pre_dispute_adjustment_id = null,
      pre_dispute_refund_attempt_id = null,
      pre_dispute_refund_attempted_at = null,
      pre_dispute_error_code = null
    where id = analysis.id;
  elsif p_decision = 'refunded' then
    update public.analysis_requests
    set
      status = case when status = 'completed' then status else 'refunded' end,
      paddle_adjustment_id = p_adjustment_id,
      paddle_adjustment_occurred_at = p_occurred_at,
      refunded_at = coalesce(refunded_at, p_occurred_at),
      refund_attempt_id = null,
      refund_attempted_at = p_occurred_at,
      error_code = null
    where id = analysis.id;
  elsif p_decision = 'refund_pending' then
    update public.analysis_requests
    set
      status = case when status = 'completed' then status else 'refund_pending' end,
      paddle_adjustment_id = p_adjustment_id,
      paddle_adjustment_occurred_at = p_occurred_at,
      refund_attempt_id = null,
      refund_attempted_at = p_occurred_at,
      error_code = 'refund_pending_approval'
    where id = analysis.id;
  else
    update public.analysis_requests
    set
      status = case when status = 'completed' then status else 'refund_pending' end,
      paddle_adjustment_id = null,
      paddle_adjustment_occurred_at = p_occurred_at,
      refund_attempt_id = null,
      refund_attempted_at = null,
      refunded_at = null,
      error_code = 'refund_rejected_retry'
    where id = analysis.id;
  end if;

  return 'applied';
end;
$$;

create or replace function public.apply_credit_purchase_adjustment(
  p_purchase_id uuid,
  p_decision text,
  p_adjustment_id text,
  p_occurred_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase public.credit_purchases%rowtype;
begin
  if p_decision not in (
    'refund_pending',
    'refund_rejected',
    'refund_reversed',
    'refunded',
    'disputed',
    'dispute_reversed'
  ) or nullif(btrim(p_adjustment_id), '') is null then
    raise exception 'Invalid purchase adjustment';
  end if;

  select *
  into purchase
  from public.credit_purchases
  where id = p_purchase_id
  for update;

  if not found then
    return 'missing';
  end if;
  if purchase.provider_adjustment_occurred_at is not null
    and p_occurred_at < purchase.provider_adjustment_occurred_at then
    return 'stale';
  end if;

  if p_decision = 'refund_pending' then
    if purchase.status in ('refunded', 'disputed') then
      update public.credit_purchases
      set provider_adjustment_occurred_at = p_occurred_at
      where id = purchase.id;
      return 'ignored';
    end if;
    update public.credit_purchases
    set
      status = 'refund_pending',
      provider_adjustment_id = p_adjustment_id,
      provider_adjustment_occurred_at = p_occurred_at,
      refund_requested_at = p_occurred_at,
      refund_attempt_id = null,
      refund_attempted_at = null
    where id = purchase.id;
  elsif p_decision = 'refund_rejected' then
    if purchase.status <> 'refund_pending'
      or purchase.provider_adjustment_id is distinct from p_adjustment_id then
      update public.credit_purchases
      set provider_adjustment_occurred_at = p_occurred_at
      where id = purchase.id;
      return 'ignored';
    end if;
    update public.credit_purchases
    set
      status = case
        when completed_at is null then 'checkout_pending'
        else 'active'
      end,
      provider_adjustment_id = null,
      provider_adjustment_occurred_at = p_occurred_at,
      refund_requested_at = null,
      refund_attempt_id = null,
      refund_attempted_at = null
    where id = purchase.id;
  elsif p_decision = 'refund_reversed' then
    if purchase.status not in ('refunded', 'refund_pending')
      or purchase.provider_adjustment_id is distinct from p_adjustment_id then
      update public.credit_purchases
      set provider_adjustment_occurred_at = p_occurred_at
      where id = purchase.id;
      return 'ignored';
    end if;
    update public.credit_purchases
    set
      status = case
        when completed_at is null then 'checkout_pending'
        else 'active'
      end,
      credits_remaining = case
        when completed_at is null then 0
        when purchase.status = 'refunded'
          then coalesce(revoked_credits_remaining, 0)
        else credits_remaining
      end,
      revoked_credits_remaining = null,
      provider_adjustment_id = null,
      provider_adjustment_occurred_at = p_occurred_at,
      refunded_at = null,
      refund_requested_at = null,
      refund_attempt_id = null,
      refund_attempted_at = null
    where id = purchase.id;
  elsif p_decision = 'refunded' then
    perform public.revoke_credit_purchase(
      purchase.id,
      'refunded',
      p_adjustment_id,
      p_occurred_at
    );
    update public.credit_purchases
    set provider_adjustment_occurred_at = p_occurred_at
    where id = purchase.id;
  elsif p_decision = 'disputed' then
    perform public.revoke_credit_purchase(
      purchase.id,
      'disputed',
      p_adjustment_id,
      null
    );
    update public.credit_purchases
    set provider_adjustment_occurred_at = p_occurred_at
    where id = purchase.id;
  else
    perform public.reverse_credit_purchase_dispute(
      purchase.id,
      p_adjustment_id
    );
    update public.credit_purchases
    set provider_adjustment_occurred_at = p_occurred_at
    where id = purchase.id;
  end if;

  return 'applied';
end;
$$;

do $$
declare
  purchase record;
begin
  for purchase in
    select id, status, provider_adjustment_id, refunded_at
    from public.credit_purchases
    where status in ('failed', 'refunded', 'disputed')
  loop
    perform public.revoke_credit_purchase(
      purchase.id,
      purchase.status,
      coalesce(
        purchase.provider_adjustment_id,
        'migration-terminal:' || purchase.id::text
      ),
      purchase.refunded_at
    );
  end loop;
end;
$$;

revoke all on function public.reserve_credit_for_analysis(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.claim_analysis_for_processing(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_analysis_result(
  uuid, uuid, text, jsonb, text, text, text
) from public, anon, authenticated;
revoke all on function public.retry_analysis_after_failure(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.fail_analysis_and_restore_credit(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.recover_exhausted_analysis(uuid, text)
  from public, anon, authenticated;
revoke all on function public.revoke_credit_purchase(
  uuid, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.reverse_credit_purchase_dispute(uuid, text)
  from public, anon, authenticated;
revoke all on function public.apply_credit_purchase_adjustment(
  uuid, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.apply_legacy_analysis_adjustment(
  uuid, text, text, timestamptz, text
) from public, anon, authenticated;

grant execute on function public.reserve_credit_for_analysis(uuid, uuid, text, text)
  to service_role;
grant execute on function public.claim_analysis_for_processing(uuid, uuid)
  to service_role;
grant execute on function public.finalize_analysis_result(
  uuid, uuid, text, jsonb, text, text, text
) to service_role;
grant execute on function public.retry_analysis_after_failure(uuid, uuid, text)
  to service_role;
grant execute on function public.fail_analysis_and_restore_credit(uuid, uuid, text)
  to service_role;
grant execute on function public.recover_exhausted_analysis(uuid, text)
  to service_role;
grant execute on function public.revoke_credit_purchase(
  uuid, text, text, timestamptz
) to service_role;
grant execute on function public.reverse_credit_purchase_dispute(uuid, text)
  to service_role;
grant execute on function public.apply_credit_purchase_adjustment(
  uuid, text, text, timestamptz
) to service_role;
grant execute on function public.apply_legacy_analysis_adjustment(
  uuid, text, text, timestamptz, text
) to service_role;
