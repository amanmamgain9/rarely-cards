create table public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_generation_id uuid references public.video_generations(id) on delete set null,
  kind text not null check (kind in ('video_experience', 'feature_request')),
  rating text check (rating in ('loved', 'okay', 'needs_work')),
  message text not null default '' check (char_length(message) <= 1000),
  created_at timestamptz not null default now(),
  constraint product_feedback_shape check (
    (kind = 'video_experience' and rating is not null)
    or
    (kind = 'feature_request' and rating is null and char_length(trim(message)) >= 3)
  )
);

create index product_feedback_user_created_idx
  on public.product_feedback (user_id, created_at desc);
create index product_feedback_kind_created_idx
  on public.product_feedback (kind, created_at desc);

alter table public.product_feedback enable row level security;
revoke all on table public.product_feedback from public, anon, authenticated;
grant all on table public.product_feedback to service_role;
