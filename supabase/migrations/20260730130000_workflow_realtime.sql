do $$
begin
  alter publication supabase_realtime add table public.analysis_requests;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.credit_purchases;
exception
  when duplicate_object then null;
end;
$$;
