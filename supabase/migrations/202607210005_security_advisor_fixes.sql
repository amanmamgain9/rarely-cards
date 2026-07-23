alter function public.bid_increment(integer) set search_path = public;
drop policy if exists "public reads listing media" on storage.objects;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
