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
    return Response.json({ error: "Invalid movie draft." }, { status: 400 });
  }
  const { data: draft } = await createAdminClient()
    .from("analysis_requests")
    .select("draft_data")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("experience_kind", "movie_scene")
    .maybeSingle();
  const path = draft?.draft_data && typeof draft.draft_data === "object" && !Array.isArray(draft.draft_data)
    ? draft.draft_data.voiceRecordingPath
    : null;
  if (typeof path !== "string") {
    return Response.json({ error: "Voice recording not found." }, { status: 404 });
  }
  const { data, error } = await createAdminClient().storage
    .from("movie-voice-recordings")
    .download(path);
  if (error || !data) return Response.json({ error: "Voice recording not found." }, { status: 404 });
  return new Response(data, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": data.type || "audio/webm",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
