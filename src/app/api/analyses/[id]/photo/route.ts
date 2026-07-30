import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const routeIdSchema = z.string().uuid();

type RouteContext = { params: Promise<{ id: string }> };

function detectImageContentType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

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

  const photoPaths = [analysis.card_photo_path, analysis.object_path].filter(
    (path, index, paths): path is string =>
      Boolean(path) && paths.indexOf(path) === index,
  );
  if (photoPaths.length === 0) {
    return Response.json({ error: "Photo not found." }, { status: 404 });
  }

  const storage = createAdminClient().storage.from("analysis-photos");
  for (const photoPath of photoPaths) {
    const { data: photo, error: downloadError } = await storage.download(photoPath);
    if (downloadError || !photo) continue;

    const photoBytes = new Uint8Array(await photo.arrayBuffer());
    const contentType = detectImageContentType(photoBytes);
    if (!contentType) continue;

    return new Response(photoBytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Length": String(photoBytes.byteLength),
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return Response.json({ error: "No valid stored photo was found." }, { status: 404 });
}
