import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

let adminClient: SupabaseClient<Database> | null = null;

export function createAdminClient() {
  if (!adminClient) {
    const { url } = publicSupabaseEnv();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
    }

    adminClient = createClient<Database>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

