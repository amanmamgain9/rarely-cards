import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { inspectImage, MAX_IMAGE_BYTES } from "@/lib/analysis/image";
import { reportServerError } from "@/lib/observability";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { runLocalVideoAgent } from "@/lib/video-agent/agent";
import { addReferenceLabels, buildReferenceSheet, MAX_AGENT_PICTURES } from "@/lib/studio/reference-sheet";

export const maxDuration = 300;

const requestSchema = z.string().trim().min(3).max(1000);
const labelsSchema = z.array(z.string().trim().min(1).max(60)).min(1).max(MAX_AGENT_PICTURES);

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return Response.json({ error: "Agent is temporarily unavailable." }, { status: 503 });
  }
  const limit = await checkRateLimit({ request, scope: "video-agent-create", userId: user.id, limit: 3, windowSeconds: 60 * 60 });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const form = await request.formData().catch(() => null);
  const photos = form?.getAll("photos").filter((photo): photo is File => photo instanceof File) ?? [];
  const labels = labelsSchema.safeParse(form?.getAll("labels"));
  const creatorRequest = requestSchema.safeParse(form?.get("request"));
  if (!creatorRequest.success || !labels.success || labels.data.length !== photos.length || photos.some(({ size }) => size > MAX_IMAGE_BYTES)) {
    return Response.json({ error: "Choose 1–4 labeled pictures and describe what you want." }, { status: 400 });
  }

  let workspace: string | null = null;
  try {
    const images = await Promise.all(photos.map(async (photo) => {
      const image = Buffer.from(await photo.arrayBuffer());
      await inspectImage(image);
      return image;
    }));
    const image = await buildReferenceSheet(images);
    workspace = await mkdtemp(path.join(tmpdir(), "rarely-agent-"));
    const imagePath = path.join(workspace, "source.jpg");
    const outputDir = path.join(workspace, "output");
    await writeFile(imagePath, image);
    const result = await runLocalVideoAgent({
      imagePath,
      request: addReferenceLabels(creatorRequest.data, labels.data),
      outputDir,
      stopAfter: "hook",
    });
    if (!result.hookPath) throw new Error("agent_hook_missing");
    const hook = (await readFile(result.hookPath, "utf8")).trim();
    return Response.json({ message: `Opening ready:\n\n${hook}` });
  } catch (error) {
    reportServerError(error, { operation: "video_agent_create" });
    return Response.json({ error: "Agent could not build this direction. Try again." }, { status: 502 });
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}
