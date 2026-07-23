create extension if not exists pgcrypto;

create type public.card_style as enum ('feminine', 'masculine');
create type public.analysis_status as enum (
  'awaiting_upload',
  'awaiting_payment',
  'payment_pending',
  'paid',
  'processing',
  'photo_rejected',
  'completed',
  'refund_pending',
  'refunded',
  'failed',
  'disputed'
);

create table public.analysis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_style public.card_style not null,
  status public.analysis_status not null default 'awaiting_upload',
  object_path text,
  image_mime_type text,
  image_bytes integer,
  image_width integer,
  image_height integer,
  paddle_transaction_id text unique,
  paddle_adjustment_id text,
  result_json jsonb,
  rejection_reason text,
  rejection_message text,
  error_code text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  replacement_count integer not null default 0 check (replacement_count between 0 and 5),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  photo_uploaded_at timestamptz,
  paid_at timestamptz,
  processing_started_at timestamptz,
  completed_at timestamptz,
  refunded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint object_path_is_owned check (
    object_path is null or object_path like user_id::text || '/' || id::text || '/%'
  ),
  constraint completed_has_result check (
    status <> 'completed' or (result_json is not null and completed_at is not null)
  ),
  constraint payment_states_have_transaction check (
    status not in (
      'paid',
      'processing',
      'photo_rejected',
      'completed',
      'refund_pending',
      'refunded',
      'disputed'
    ) or paddle_transaction_id is not null
  )
);

create index analysis_requests_user_created_idx
  on public.analysis_requests (user_id, created_at desc);
create index analysis_requests_recovery_idx
  on public.analysis_requests (status, processing_started_at)
  where status in ('paid', 'processing', 'refund_pending');
create index analysis_requests_expiry_idx
  on public.analysis_requests (expires_at)
  where object_path is not null;

create table public.payment_events (
  event_id text primary key,
  event_type text not null,
  transaction_id text,
  analysis_request_id uuid references public.analysis_requests(id) on delete set null,
  occurred_at timestamptz,
  payload_digest text not null,
  processed_at timestamptz not null default now()
);

create index payment_events_transaction_idx
  on public.payment_events (transaction_id);

create table public.rate_limit_windows (
  rate_key text primary key,
  request_count integer not null default 1,
  window_started_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;

create trigger analysis_requests_set_updated_at
before update on public.analysis_requests
for each row execute function public.set_updated_at();

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.rate_limit_windows%rowtype;
  now_at timestamptz := clock_timestamp();
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit configuration';
  end if;

  insert into public.rate_limit_windows (
    rate_key,
    request_count,
    window_started_at,
    expires_at
  )
  values (
    p_key,
    1,
    now_at,
    now_at + make_interval(secs => p_window_seconds)
  )
  on conflict (rate_key) do update
  set
    request_count = case
      when public.rate_limit_windows.expires_at <= now_at then 1
      else public.rate_limit_windows.request_count + 1
    end,
    window_started_at = case
      when public.rate_limit_windows.expires_at <= now_at then now_at
      else public.rate_limit_windows.window_started_at
    end,
    expires_at = case
      when public.rate_limit_windows.expires_at <= now_at
        then now_at + make_interval(secs => p_window_seconds)
      else public.rate_limit_windows.expires_at
    end
  returning * into current_row;

  allowed := current_row.request_count <= p_limit;
  remaining := greatest(p_limit - current_row.request_count, 0);
  retry_after_seconds := greatest(
    ceil(extract(epoch from (current_row.expires_at - now_at)))::integer,
    0
  );
  return next;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

alter table public.analysis_requests enable row level security;
alter table public.payment_events enable row level security;
alter table public.rate_limit_windows enable row level security;

create policy "Users can read their own analyses"
on public.analysis_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own analyses"
on public.analysis_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'awaiting_upload'
  and paddle_transaction_id is null
  and result_json is null
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'analysis-photos',
  'analysis-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own analysis photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'analysis-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own analysis photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'analysis-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
