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

revoke all on function public.restore_analysis_credit(uuid)
  from public, anon, authenticated;
grant execute on function public.restore_analysis_credit(uuid)
  to service_role;
