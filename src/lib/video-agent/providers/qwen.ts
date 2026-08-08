const MODEL = "qwen/qwen3-235b-a22b-instruct-2507";
let queue = Promise.resolve();
let nextCallAt = 0;

function outputText(output: unknown) {
  return Array.isArray(output) ? output.join("") : typeof output === "string" ? output : "";
}

async function request(prompt: string, temperature: number) {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) throw new Error("REPLICATE_API_TOKEN is missing.");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=60", "Cancel-After": "5m" };
  let response!: Response;
  let prediction!: { status?: string; output?: unknown; error?: unknown; detail?: unknown; retry_after?: number; urls?: { get?: string } };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, { method: "POST", headers, body: JSON.stringify({ input: { prompt, temperature, max_tokens: 8192 } }) });
    prediction = await response.json() as typeof prediction;
    if (response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, ((prediction.retry_after ?? 10) + 1) * 1000));
  }
  if (!response.ok) throw new Error(`qwen_http_${response.status}:${JSON.stringify(prediction.error ?? prediction.detail ?? prediction)}`);
  const deadline = Date.now() + 5 * 60_000;
  while (!new Set(["succeeded", "failed", "canceled"]).has(prediction.status ?? "")) {
    if (Date.now() >= deadline) throw new Error("qwen_prediction_timeout");
    if (!prediction.urls?.get) throw new Error("qwen_prediction_url_missing");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    response = await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    prediction = await response.json() as typeof prediction;
    if (!response.ok) throw new Error(`qwen_poll_http_${response.status}`);
  }
  if (prediction.status !== "succeeded") throw new Error(`qwen_prediction_${prediction.status}:${JSON.stringify(prediction.error)}`);
  const text = outputText(prediction.output).trim();
  if (!text) throw new Error("qwen_output_missing");
  return text;
}

export function qwenGeneration(prompt: string, temperature = 0.9) {
  const queued = queue.then(async () => {
    const delay = Math.max(0, nextCallAt - Date.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    nextCallAt = Date.now() + 12_000;
    return request(prompt, temperature);
  });
  queue = queued.then(() => undefined, () => undefined);
  return queued;
}
