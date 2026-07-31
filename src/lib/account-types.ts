import type { AcceptedAnalysis, AnalysisStatus } from "@/lib/analysis/types";
import type {
  CreditPurchaseStatus,
  PaymentProvider,
} from "@/lib/supabase/database.types";

export type AccountPurchase = {
  id: string;
  paymentProvider: PaymentProvider;
  status: CreditPurchaseStatus;
  creditsGranted: number;
  creditsRemaining: number;
  creditKind: "card" | "talking_video";
  amountCents: number;
  currency: string;
  purchasedAt: string | null;
  createdAt: string;
  refundableUntil: string | null;
  refundable: boolean;
};

export type AccountCard = {
  id: string;
  status: AnalysisStatus;
  petName: string | null;
  result: AcceptedAnalysis | null;
  photoUrl: string | null;
  videoUrl: string | null;
  videoStatus: "submitting" | "running" | "succeeded" | "failed" | null;
  videoEligible: boolean;
  creditKind: "card" | "talking_video";
  rejectionMessage: string | null;
  creditState: "reserved" | "consumed" | "restored" | "revoked" | null;
  createdAt: string;
  completedAt: string | null;
};

export type AccountData = {
  email: string | null;
  creditBalance: number;
  legacyCardCreditBalance: number;
  purchases: AccountPurchase[];
  cards: AccountCard[];
};
