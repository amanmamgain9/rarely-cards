import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getGooglePlayOrder: vi.fn(),
  getPaddle: vi.fn(),
  refundGooglePlayOrder: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/paddle", () => ({ getPaddle: mocks.getPaddle }));
vi.mock("@/lib/payments/google-play", () => ({
  getGooglePlayOrder: mocks.getGooglePlayOrder,
  refundGooglePlayOrder: mocks.refundGooglePlayOrder,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { startCreditPurchaseRefund } from "@/lib/payments/refunds";

function purchaseAdmin(
  providerAdjustmentId: string | null,
  claimAvailable = true,
  status: "active" | "refund_pending" = "refund_pending",
) {
  const query = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    lt: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.single.mockResolvedValue({
    data: {
      id: "purchase-id",
      user_id: "user-id",
      status,
      completed_at: "2026-07-25T00:00:00.000Z",
      payment_provider: "paddle",
      provider_transaction_id: "txn_123",
      provider_adjustment_id: providerAdjustmentId,
      refund_requested_at: "2026-07-24T00:00:00.000Z",
    },
    error: null,
  });
  query.maybeSingle.mockResolvedValue({
    data: claimAvailable ? { id: "purchase-id" } : null,
    error: null,
  });
  return {
    admin: {
      from: vi.fn().mockReturnValue(query),
      rpc: vi.fn().mockResolvedValue({ data: "applied", error: null }),
    },
    query,
  };
}

function adjustmentCollection(items: unknown[] = []) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

describe("startCreditPurchaseRefund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries an unconfirmed pending refund and reports provider failure", async () => {
    const create = vi.fn().mockRejectedValue(new Error("provider unavailable"));
    const list = vi.fn(() => adjustmentCollection());
    const { admin } = purchaseAdmin(null);
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.getPaddle.mockReturnValue({
      adjustments: { create, list },
    });

    await expect(
      startCreditPurchaseRefund("purchase-id", "user-id"),
    ).rejects.toThrow("provider unavailable");

    expect(create).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("does not resubmit a refund that already has an adjustment", async () => {
    const create = vi.fn();
    const { admin } = purchaseAdmin("adj_existing");
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.getPaddle.mockReturnValue({
      adjustments: { create, list: vi.fn() },
    });

    await expect(
      startCreditPurchaseRefund("purchase-id", "user-id"),
    ).resolves.toEqual({
      provider: "paddle",
      adjustmentId: "adj_existing",
      status: "refund_pending",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("does not call the provider while another refund attempt owns the claim", async () => {
    const create = vi.fn();
    const { admin } = purchaseAdmin(null, false);
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.getPaddle.mockReturnValue({
      adjustments: { create, list: vi.fn() },
    });

    await expect(
      startCreditPurchaseRefund("purchase-id", "user-id"),
    ).rejects.toThrow("refund_retry_later");
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps credits frozen when a failed request is not yet visible", async () => {
    const create = vi.fn().mockRejectedValue(new Error("provider unavailable"));
    const list = vi.fn(() => adjustmentCollection());
    const { admin, query } = purchaseAdmin(null, true, "active");
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.getPaddle.mockReturnValue({
      adjustments: { create, list },
    });

    await expect(
      startCreditPurchaseRefund("purchase-id", "user-id"),
    ).rejects.toThrow("provider unavailable");

    expect(query.update).toHaveBeenCalledTimes(1);
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "refund_pending",
        refund_attempt_id: expect.any(String),
      }),
    );
  });

  it("creates a new Paddle refund when only rejected history exists", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "adj_new",
      status: "pending_approval",
      updatedAt: "2026-07-25T01:00:00.000Z",
    });
    const list = vi.fn(() =>
      adjustmentCollection([
        {
          id: "adj_rejected",
          status: "rejected",
          updatedAt: "2026-07-25T00:30:00.000Z",
        },
      ]),
    );
    const { admin } = purchaseAdmin(null, true, "active");
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.getPaddle.mockReturnValue({
      adjustments: { create, list },
    });

    await expect(
      startCreditPurchaseRefund("purchase-id", "user-id"),
    ).resolves.toEqual({
      provider: "paddle",
      adjustmentId: "adj_new",
      status: "refund_pending",
    });
    expect(create).toHaveBeenCalledOnce();
  });
});
