alter type public.analysis_status
  add value if not exists 'awaiting_name' after 'payment_pending';
