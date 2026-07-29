import "server-only";

import { createClient } from "@/lib/supabase/server";

export type VerifiedUser = {
  id: string;
  email: string | null;
};

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims.sub) {
    return { user: null, supabase };
  }

  const user: VerifiedUser = {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };

  return { user, supabase };
}
