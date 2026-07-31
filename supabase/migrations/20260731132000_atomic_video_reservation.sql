create or replace function public.reserve_and_create_talking_video(
  p_user_id uuid,
  p_analysis_id uuid,
  p_pet_name text,
  p_dialogue text,
  p_prompt text,
  p_provider_model text,
  p_pricing_usd_per_million_tokens numeric
)
returns table (video_id uuid, reserved boolean, remaining_balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation record;
  created_id uuid;
begin
  select * into reservation
  from public.reserve_talking_video_credit(
    p_user_id,
    p_analysis_id,
    p_pet_name,
    p_dialogue
  );
  if not coalesce(reservation.reserved, false) then
    return query select null::uuid, false, coalesce(reservation.remaining_balance, 0);
    return;
  end if;

  insert into public.video_generations (
    analysis_id,
    user_id,
    prompt,
    provider_model,
    pricing_usd_per_million_tokens,
    duration_seconds,
    resolution,
    aspect_ratio,
    generate_audio
  ) values (
    p_analysis_id,
    p_user_id,
    p_prompt,
    p_provider_model,
    p_pricing_usd_per_million_tokens,
    8,
    '720p',
    '9:16',
    true
  )
  returning id into created_id;

  return query
    select created_id, true, reservation.remaining_balance;
end;
$$;

revoke all on function public.reserve_and_create_talking_video(
  uuid, uuid, text, text, text, text, numeric
) from public, anon, authenticated;
grant execute on function public.reserve_and_create_talking_video(
  uuid, uuid, text, text, text, text, numeric
) to service_role;
