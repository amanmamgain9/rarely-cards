export async function createZazzlePrintCheckout(
  analysisId: string,
  card: File,
): Promise<string> {
  const formData = new FormData();
  formData.set("analysisId", analysisId);
  formData.set("card", card);

  const response = await fetch("/api/print/zazzle", {
    method: "POST",
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.checkoutUrl !== "string") {
    throw new Error(payload.error || "Print checkout could not be opened.");
  }
  return payload.checkoutUrl;
}
