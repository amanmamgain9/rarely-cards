alter table public.analysis_requests
  add column if not exists experience_kind text;

update public.analysis_requests a
set experience_kind = case
  when a.selected_dialogue is not null
    or exists (
      select 1 from public.video_generations v where v.analysis_id = a.id
    )
    or exists (
      select 1
      from public.credit_purchases p
      where p.id = a.credit_purchase_id and p.credit_kind = 'talking_video'
    )
  then 'talking_video'
  else 'card'
end
where experience_kind is null;

alter table public.analysis_requests
  alter column experience_kind set default 'talking_video',
  alter column experience_kind set not null;

alter table public.analysis_requests
  add constraint analysis_requests_experience_kind_check
  check (experience_kind in ('card', 'talking_video'));
