import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const routeIdSchema = z.string().uuid();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { user, supabase } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  if (!routeIdSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid analysis." }, { status: 400 });
  }

  const { data: analysis, error } = await supabase
    .from("analysis_requests")
    .select("card_photo_path, object_path")
    .eq("id", id)
    .single();
  if (error || !analysis) {
    return Response.json({ error: "Analysis not found." }, { status: 404 });
  }

  const photoPath = analysis.card_photo_path ?? analysis.object_path;
  if (!photoPath) {
    return Response.json({ error: "Photo not found." }, { status: 404 });
  }

  const { data: photo, error: downloadError } = await createAdminClient().storage
    .from("analysis-photos")
    .download(photoPath);
  if (downloadError || !photo) {
    return Response.json({ error: "Photo not found." }, { status: 404 });
  }

  return new Response(photo, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "Content-Type": photo.type || "image/jpeg",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
