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

export async function GET(request: Request, context: RouteContext) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  if (!routeIdSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid analysis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: analysis, error } = await admin
    .from("analysis_requests")
    .select("card_photo_path, object_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !analysis) {
    console.warn(
      JSON.stringify({
        event: "analysis_photo_missing",
        analysisId: id,
        databaseCode: error?.code ?? null,
      }),
    );
    return Response.json({ error: "Analysis not found." }, { status: 404 });
  }

  const sourceOnly = new URL(request.url).searchParams.get("source") === "1";
  const candidates = sourceOnly
    ? [analysis.object_path]
    : [analysis.card_photo_path, analysis.object_path];
  const photoPaths = candidates.filter(
    (path, index, paths): path is string =>
      Boolean(path) && paths.indexOf(path) === index,
  );
  if (photoPaths.length === 0) {
    console.warn(JSON.stringify({ event: "analysis_photo_path_missing", analysisId: id }));
    return Response.json({ error: "Photo not found." }, { status: 404 });
  }

  const storage = admin.storage.from("analysis-photos");
  for (const photoPath of photoPaths) {
    const { data: photo, error: downloadError } = await storage.download(photoPath);
    if (downloadError || !photo) {
      console.warn(
        JSON.stringify({
          event: "analysis_photo_download_failed",
          analysisId: id,
          storageCode: downloadError?.name ?? "missing_blob",
        }),
      );
      continue;
    }

    const photoBytes = new Uint8Array(await photo.arrayBuffer());
    const contentType = detectImageContentType(photoBytes);
    if (!contentType) {
      console.warn(
        JSON.stringify({
          event: "analysis_photo_format_invalid",
          analysisId: id,
          bytes: photoBytes.byteLength,
        }),
      );
      continue;
    }

    console.info(
      JSON.stringify({
        event: "analysis_photo_served",
        analysisId: id,
        bytes: photoBytes.byteLength,
        contentType,
      }),
    );

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
