insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'movie-voice-recordings',
  'movie-voice-recordings',
  false,
  5242880,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
