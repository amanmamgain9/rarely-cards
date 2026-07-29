export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CardStyle = "feminine" | "masculine" | "pet";
export type AnalysisStatus =
  | "awaiting_upload"
  | "awaiting_payment"
  | "payment_pending"
  | "awaiting_name"
  | "paid"
  | "processing"
  | "photo_rejected"
  | "completed"
  | "refund_pending"
  | "refunded"
  | "failed"
  | "disputed";

export type CreditPurchaseStatus =
  | "checkout_pending"
  | "active"
  | "refund_pending"
  | "refunded"
  | "disputed"
  | "failed";

// Lemon Squeezy is retained for historical rows only. New checkout and credit
// grant paths accept Paddle or Google Play.
export type PaymentProvider = "paddle" | "lemon_squeezy" | "google_play";

type AnalysisRequestRow = {
  id: string;
  user_id: string;
  card_style: CardStyle;
  pet_name: string | null;
  pet_pronouns: "he" | "she" | "they" | null;
  status: AnalysisStatus;
  object_path: string | null;
  image_mime_type: string | null;
  image_bytes: number | null;
  image_width: number | null;
  image_height: number | null;
  paddle_transaction_id: string | null;
  paddle_adjustment_id: string | null;
  paddle_adjustment_occurred_at: string | null;
  pre_dispute_status: AnalysisStatus | null;
  pre_dispute_adjustment_id: string | null;
  pre_dispute_refund_attempt_id: string | null;
  pre_dispute_refund_attempted_at: string | null;
  pre_dispute_error_code: string | null;
  credit_purchase_id: string | null;
  credit_state: "reserved" | "consumed" | "restored" | "revoked" | null;
  credit_reserved_at: string | null;
  credit_consumed_at: string | null;
  credit_released_at: string | null;
  processing_token: string | null;
  card_photo_path: string | null;
  result_json: Json | null;
  rejection_reason: string | null;
  rejection_message: string | null;
  error_code: string | null;
  attempt_count: number;
  replacement_count: number;
  version: number;
  created_at: string;
  updated_at: string;
  photo_uploaded_at: string | null;
  paid_at: string | null;
  processing_started_at: string | null;
  completed_at: string | null;
  refunded_at: string | null;
  refund_attempt_id: string | null;
  refund_attempted_at: string | null;
  expires_at: string | null;
};

type AnalysisRequestInsert = {
  id?: string;
  user_id: string;
  card_style: CardStyle;
  pet_name?: string | null;
  pet_pronouns?: "he" | "she" | "they" | null;
  status?: AnalysisStatus;
  object_path?: string | null;
  image_mime_type?: string | null;
  image_bytes?: number | null;
  image_width?: number | null;
  image_height?: number | null;
  paddle_transaction_id?: string | null;
  paddle_adjustment_id?: string | null;
  paddle_adjustment_occurred_at?: string | null;
  pre_dispute_status?: AnalysisStatus | null;
  pre_dispute_adjustment_id?: string | null;
  pre_dispute_refund_attempt_id?: string | null;
  pre_dispute_refund_attempted_at?: string | null;
  pre_dispute_error_code?: string | null;
  credit_purchase_id?: string | null;
  credit_state?: "reserved" | "consumed" | "restored" | "revoked" | null;
  credit_reserved_at?: string | null;
  credit_consumed_at?: string | null;
  credit_released_at?: string | null;
  processing_token?: string | null;
  card_photo_path?: string | null;
  result_json?: Json | null;
  rejection_reason?: string | null;
  rejection_message?: string | null;
  error_code?: string | null;
  attempt_count?: number;
  replacement_count?: number;
  version?: number;
  created_at?: string;
  updated_at?: string;
  photo_uploaded_at?: string | null;
  paid_at?: string | null;
  processing_started_at?: string | null;
  completed_at?: string | null;
  refunded_at?: string | null;
  refund_attempt_id?: string | null;
  refund_attempted_at?: string | null;
  expires_at?: string | null;
};

type AnalysisRequestUpdate = Partial<AnalysisRequestInsert>;

export type Database = {
  public: {
    Tables: {
      analysis_requests: {
        Row: AnalysisRequestRow;
        Insert: AnalysisRequestInsert;
        Update: AnalysisRequestUpdate;
        Relationships: [];
      };
      credit_purchases: {
        Row: {
          id: string;
          user_id: string;
          payment_provider: PaymentProvider;
          provider_checkout_id: string | null;
          provider_transaction_id: string | null;
          provider_adjustment_id: string | null;
          provider_adjustment_occurred_at: string | null;
          pre_dispute_status: CreditPurchaseStatus | null;
          pre_dispute_adjustment_id: string | null;
          pre_dispute_refund_requested_at: string | null;
          pre_dispute_refund_attempt_id: string | null;
          pre_dispute_refund_attempted_at: string | null;
          resume_analysis_id: string | null;
          checkout_scope_id: string;
          pending_checkout_guarded: boolean;
          status: CreditPurchaseStatus;
          credits_granted: number;
          credits_remaining: number;
          revoked_credits_remaining: number | null;
          amount_cents: number;
          currency: string;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          refund_requested_at: string | null;
          refund_attempt_id: string | null;
          refund_attempted_at: string | null;
          refunded_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          payment_provider?: PaymentProvider;
          provider_checkout_id?: string | null;
          provider_transaction_id?: string | null;
          provider_adjustment_id?: string | null;
          provider_adjustment_occurred_at?: string | null;
          pre_dispute_status?: CreditPurchaseStatus | null;
          pre_dispute_adjustment_id?: string | null;
          pre_dispute_refund_requested_at?: string | null;
          pre_dispute_refund_attempt_id?: string | null;
          pre_dispute_refund_attempted_at?: string | null;
          resume_analysis_id?: string | null;
          checkout_scope_id?: string;
          pending_checkout_guarded?: boolean;
          status?: CreditPurchaseStatus;
          credits_granted?: number;
          credits_remaining?: number;
          revoked_credits_remaining?: number | null;
          amount_cents?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          refund_requested_at?: string | null;
          refund_attempt_id?: string | null;
          refund_attempted_at?: string | null;
          refunded_at?: string | null;
        };
        Update: {
          payment_provider?: PaymentProvider;
          provider_checkout_id?: string | null;
          provider_transaction_id?: string | null;
          provider_adjustment_id?: string | null;
          provider_adjustment_occurred_at?: string | null;
          pre_dispute_status?: CreditPurchaseStatus | null;
          pre_dispute_adjustment_id?: string | null;
          pre_dispute_refund_requested_at?: string | null;
          pre_dispute_refund_attempt_id?: string | null;
          pre_dispute_refund_attempted_at?: string | null;
          resume_analysis_id?: string | null;
          checkout_scope_id?: string;
          pending_checkout_guarded?: boolean;
          status?: CreditPurchaseStatus;
          credits_granted?: number;
          credits_remaining?: number;
          revoked_credits_remaining?: number | null;
          amount_cents?: number;
          currency?: string;
          updated_at?: string;
          completed_at?: string | null;
          refund_requested_at?: string | null;
          refund_attempt_id?: string | null;
          refund_attempted_at?: string | null;
          refunded_at?: string | null;
        };
        Relationships: [];
      };
      google_play_purchases: {
        Row: {
          purchase_token: string;
          credit_purchase_id: string;
          user_id: string;
          product_id: string;
          order_id: string;
          purchase_state: "purchased" | "consumed" | "canceled" | "voided";
          purchased_at: string | null;
          consumed_at: string | null;
          voided_at: string | null;
          last_verified_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          purchase_token: string;
          credit_purchase_id: string;
          user_id: string;
          product_id: string;
          order_id: string;
          purchase_state: "purchased" | "consumed" | "canceled" | "voided";
          purchased_at?: string | null;
          consumed_at?: string | null;
          voided_at?: string | null;
          last_verified_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          purchase_state?: "purchased" | "consumed" | "canceled" | "voided";
          consumed_at?: string | null;
          voided_at?: string | null;
          last_verified_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_events: {
        Row: {
          event_id: string;
          event_type: string;
          payment_provider: PaymentProvider;
          transaction_id: string | null;
          analysis_request_id: string | null;
          credit_purchase_id: string | null;
          occurred_at: string | null;
          payload_digest: string;
          processed_at: string | null;
          processing_started_at: string | null;
          processing_token: string | null;
        };
        Insert: {
          event_id: string;
          event_type: string;
          payment_provider?: PaymentProvider;
          transaction_id?: string | null;
          analysis_request_id?: string | null;
          credit_purchase_id?: string | null;
          occurred_at?: string | null;
          payload_digest: string;
          processed_at?: string | null;
          processing_started_at?: string | null;
          processing_token?: string | null;
        };
        Update: {
          event_type?: string;
          payment_provider?: PaymentProvider;
          transaction_id?: string | null;
          analysis_request_id?: string | null;
          credit_purchase_id?: string | null;
          occurred_at?: string | null;
          payload_digest?: string;
          processed_at?: string | null;
          processing_started_at?: string | null;
          processing_token?: string | null;
        };
        Relationships: [];
      };
      rate_limit_windows: {
        Row: {
          rate_key: string;
          request_count: number;
          window_started_at: string;
          expires_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_rate_limit: {
        Args: {
          p_key: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          remaining: number;
          retry_after_seconds: number;
        }[];
      };
      consume_analysis_credit: {
        Args: { p_analysis_id: string };
        Returns: boolean;
      };
      claim_payment_event: {
        Args: {
          p_event_id: string;
          p_payload_digest: string;
          p_processing_token: string;
        };
        Returns: "missing" | "mismatch" | "processed" | "busy" | "claimed";
      };
      claim_analysis_for_processing: {
        Args: {
          p_analysis_id: string;
          p_processing_token: string;
        };
        Returns: {
          id: string;
          user_id: string;
          object_path: string;
          card_style: CardStyle;
          pet_name: string | null;
          pet_pronouns: "he" | "she" | "they" | null;
          attempt_count: number;
          credit_purchase_id: string | null;
        }[];
      };
      finalize_analysis_result: {
        Args: {
          p_analysis_id: string;
          p_processing_token: string;
          p_outcome: "completed" | "photo_rejected";
          p_result_json: Json | null;
          p_rejection_reason: string | null;
          p_rejection_message: string | null;
          p_card_photo_path: string | null;
        };
        Returns:
          | "missing"
          | "already_finalized"
          | "stale_claim"
          | "revoked"
          | "credit_conflict"
          | "entitlement_missing"
          | "finalized";
      };
      retry_analysis_after_failure: {
        Args: {
          p_analysis_id: string;
          p_processing_token: string;
          p_error_code: string;
        };
        Returns:
          | "missing"
          | "stale_claim"
          | "revoked"
          | "retry_scheduled";
      };
      fail_analysis_and_restore_credit: {
        Args: {
          p_analysis_id: string;
          p_processing_token: string;
          p_error_code: string;
        };
        Returns:
          | "unsupported"
          | "stale_claim"
          | "revoked"
          | "credit_conflict"
          | "restored";
      };
      recover_exhausted_analysis: {
        Args: {
          p_analysis_id: string;
          p_error_code: string;
        };
        Returns:
          | "missing"
          | "not_exhausted"
          | "entitlement_missing"
          | "legacy_refund_required"
          | "revoked"
          | "credit_conflict"
          | "restored";
      };
      grant_credit_purchase: {
        Args: {
          p_purchase_id: string;
          p_user_id: string;
          p_provider: PaymentProvider;
          p_transaction_id: string;
          p_credits?: number;
        };
        Returns: boolean;
      };
      reserve_credit_for_analysis: {
        Args: {
          p_user_id: string;
          p_analysis_id: string;
          p_pet_name: string;
          p_pet_pronouns: string;
        };
        Returns: {
          reserved: boolean;
          purchase_id: string | null;
          remaining_balance: number;
        }[];
      };
      restore_analysis_credit: {
        Args: { p_analysis_id: string };
        Returns: boolean;
      };
      revoke_credit_purchase: {
        Args: {
          p_purchase_id: string;
          p_status: "failed" | "refunded" | "disputed";
          p_adjustment_id: string;
          p_refunded_at?: string | null;
        };
        Returns: "missing" | "already_terminal" | "revoked";
      };
      reverse_credit_purchase_dispute: {
        Args: {
          p_purchase_id: string;
          p_adjustment_id: string;
        };
        Returns: "missing" | "not_disputed" | "restored";
      };
      apply_credit_purchase_adjustment: {
        Args: {
          p_purchase_id: string;
          p_decision:
            | "refund_pending"
            | "refund_rejected"
            | "refund_reversed"
            | "refunded"
            | "disputed"
            | "dispute_reversed";
          p_adjustment_id: string;
          p_occurred_at: string;
        };
        Returns: "missing" | "stale" | "ignored" | "applied";
      };
      apply_legacy_analysis_adjustment: {
        Args: {
          p_analysis_id: string;
          p_decision:
            | "disputed"
            | "dispute_reversed"
            | "refunded"
            | "refund_pending"
            | "refund_retry";
          p_adjustment_id: string;
          p_occurred_at: string;
          p_error_code: string;
        };
        Returns: "missing" | "stale" | "ignored" | "applied";
      };
    };
    Enums: {
      card_style: CardStyle;
      analysis_status: AnalysisStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

