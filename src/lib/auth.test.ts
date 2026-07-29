import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
const supabase = { auth: { getClaims } };

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => supabase),
}));

import { requireUser } from "@/lib/auth";

describe("requireUser", () => {
  beforeEach(() => {
    getClaims.mockReset();
  });

  it("builds the application user from verified JWT claims", async () => {
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "11111111-1111-1111-1111-111111111111",
          email: "keeper@example.com",
        },
      },
      error: null,
    });

    await expect(requireUser()).resolves.toEqual({
      user: {
        id: "11111111-1111-1111-1111-111111111111",
        email: "keeper@example.com",
      },
      supabase,
    });
  });

  it("rejects missing or invalid claims", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("invalid") });

    await expect(requireUser()).resolves.toEqual({ user: null, supabase });
  });
});
