import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function storeGeneratedScene(path: string, jpeg: Buffer) {
  const storage = createAdminClient().storage.from("analysis-photos");
  const body = Uint8Array.from(jpeg).buffer;
  const { error: uploadError } = await storage.upload(path, body, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (uploadError) throw new Error(`scene_upload_failed:${uploadError.message}`);

  const { data, error } = await storage.download(path);
  const stored = data ? Buffer.from(await data.arrayBuffer()) : null;
  if (error || !stored || stored.byteLength !== jpeg.byteLength || !stored.equals(jpeg)) {
    await storage.remove([path]);
    throw new Error("scene_storage_verification_failed");
  }
}
