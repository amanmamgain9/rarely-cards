const API_URL = "https://api.deepseek.com/chat/completions";

export type DeepSeekTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type DeepSeekToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  reasoning_content?: string | null;
  tool_calls?: DeepSeekToolCall[];
  tool_call_id?: string;
};

export function deepSeekModel() {
  return process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-pro";
}

function apiKey() {
  const value = process.env.DEEPSEEK_API_KEY?.trim();
  if (!value) throw new Error("DEEPSEEK_API_KEY is missing.");
  return value;
}

export async function deepSeekChat({ messages, tools = [], thinking = true }: {
  messages: DeepSeekMessage[];
  tools?: DeepSeekTool[];
  thinking?: boolean;
}) {
  const body = JSON.stringify({
    model: deepSeekModel(),
    messages,
    ...(tools.length ? {
      tools: tools.map((tool) => ({ type: "function", function: tool })),
      tool_choice: "auto",
    } : {}),
    thinking: { type: thinking ? "enabled" : "disabled" },
    ...(thinking ? { reasoning_effort: "high" } : {}),
    max_tokens: thinking ? 12_000 : 4_000,
  });
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
          continue;
        }
        const failure = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
        throw new Error(`deepseek_http_${response.status}:${failure?.error?.code || "unknown"}:${failure?.error?.message || "unknown"}`);
      }
      const payload = await response.json() as { choices?: Array<{ message?: DeepSeekMessage }> };
      const message = payload.choices?.[0]?.message;
      if (!message) throw new Error("deepseek_message_missing");
      return message;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.startsWith("deepseek_http_")) throw error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("deepseek_request_failed");
}

export function toolArguments(call: DeepSeekToolCall) {
  try {
    return JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
  } catch {
    throw new Error(`deepseek_tool_arguments_invalid:${call.function.name}`);
  }
}
