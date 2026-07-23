alter table public.analysis_requests
  add column if not exists pet_pronouns text;

alter table public.analysis_requests
  add constraint analysis_requests_pet_pronouns
  check (
    pet_pronouns is null
    or pet_pronouns in ('he', 'she', 'they')
  );
