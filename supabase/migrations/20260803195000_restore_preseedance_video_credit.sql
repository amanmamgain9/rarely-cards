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
  if not found or analysis.credit_state <> 'reserved' then return false; end if;
  if purchase.id is null or purchase.credit_kind <> 'talking_video' then return false; end if;
  update public.credit_purchases
  set credits_remaining = least(credits_granted, credits_remaining + 1)
  where id = purchase.id and status in ('active', 'refund_pending');
  if not found then return false; end if;
  update public.analysis_requests set
    credit_state = 'restored',
    credit_released_at = now(),
    status = case when status in ('paid', 'processing') then 'failed' else status end,
    error_code = case
      when status in ('paid', 'processing') then coalesce(error_code, 'video_submission_failed')
      else error_code
    end,
    processing_started_at = case when status in ('paid', 'processing') then null else processing_started_at end,
    processing_token = case when status in ('paid', 'processing') then null else processing_token end
  where id = analysis.id;
  return true;
end;
$$;

revoke all on function public.restore_talking_video_credit(uuid)
  from public, anon, authenticated;
grant execute on function public.restore_talking_video_credit(uuid)
  to service_role;
