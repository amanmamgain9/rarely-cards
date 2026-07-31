create table public.video_generations (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null unique references public.analysis_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'seedance' check (provider = 'seedance'),
  status text not null default 'submitting'
    check (status in ('submitting', 'running', 'succeeded', 'failed')),
  provider_task_id text unique,
  prompt text not null,
  output_path text,
  error_code text,
  attempt_count integer not null default 1 check (attempt_count between 1 and 3),
  last_synced_at timestamptz,
  sync_token uuid,
  sync_started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index video_generations_user_created_idx
  on public.video_generations(user_id, created_at desc);

alter table public.video_generations enable row level security;

create policy "Users can read their own video generations"
on public.video_generations
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.video_generations to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'generated-videos',
  'generated-videos',
  false,
  104857600,
  array['video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  alter publication supabase_realtime add table public.video_generations;
exception
  when duplicate_object then null;
end;
$$;
