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
  rejectionMessage: string | null;
  creditState: "reserved" | "consumed" | "restored" | "revoked" | null;
  createdAt: string;
  completedAt: string | null;
};

export type AccountData = {
  email: string | null;
  creditBalance: number;
  purchases: AccountPurchase[];
  cards: AccountCard[];
};
