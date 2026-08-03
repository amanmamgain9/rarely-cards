-- Dialogue suggestions validate a talking-pet photo before a credit is
-- reserved. Let that validation reject an unusable upload without inventing
-- dialogue or attaching an entitlement that was never consumed.
alter table public.analysis_requests
  drop constraint if exists generation_states_have_entitlement;

alter table public.analysis_requests
  add constraint generation_states_have_entitlement check (
    status not in ('paid', 'processing', 'photo_rejected', 'completed')
    or (
      status = 'photo_rejected'
      and paddle_transaction_id is null
      and credit_purchase_id is null
    )
    or paddle_transaction_id is not null
    or (
      credit_purchase_id is not null
      and (
        credit_state in ('reserved', 'consumed')
        or (
          credit_state = 'restored'
          and status in ('photo_rejected', 'completed')
        )
      )
    )
  );
