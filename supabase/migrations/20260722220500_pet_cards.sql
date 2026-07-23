alter type public.card_style add value if not exists 'pet';

alter table public.analysis_requests
  add column if not exists pet_name text;

alter table public.analysis_requests
  add constraint analysis_requests_pet_name_length
  check (
    pet_name is null
    or char_length(btrim(pet_name)) between 1 and 30
  );
