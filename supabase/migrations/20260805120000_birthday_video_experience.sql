alter table public.analysis_requests
  drop constraint if exists analysis_requests_experience_kind_check;

alter table public.analysis_requests
  add constraint analysis_requests_experience_kind_check
  check (experience_kind in ('card', 'talking_video', 'birthday_video'));
