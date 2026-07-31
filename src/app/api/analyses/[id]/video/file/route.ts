import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const routeIdSchema = z.string().uuid();
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  if (!routeIdSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid card." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("video_generations")
    .select("output_path")
    .eq("analysis_id", id)
    .eq("user_id", user.id)
    .eq("status", "succeeded")
    .maybeSingle();
  if (!row?.output_path) {
    return Response.json({ error: "Video not found." }, { status: 404 });
  }
  const { data, error } = await admin.storage
    .from("generated-videos")
    .createSignedUrl(row.output_path, 5 * 60, { download: false });
  if (error || !data?.signedUrl) {
    return Response.json({ error: "Video could not be opened." }, { status: 503 });
  }
  return Response.redirect(data.signedUrl, 307);
}
