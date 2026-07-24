alter table public.analysis_requests
  alter column expires_at drop not null;

update public.analysis_requests
set expires_at = null
where (object_path is not null or card_photo_path is not null)
  and status in (
    'awaiting_payment',
    'awaiting_name',
    'paid',
    'processing',
    'photo_rejected',
    'completed',
    'failed',
    'refund_pending',
    'refunded'
  );
