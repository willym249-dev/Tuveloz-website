// Thin, dependency-free fetch wrappers around the three chat-completion APIs.
// Kept free of any Cloudflare/Node-specific imports so the same module runs
// both inside the Workers runtime and in a plain Node CLI.

export type CouncilProvider = "openai" | "gemini" | "anthropic";

export type ProviderCallInput = {
  apiKey: string;
  model: string;
  system?: string;
  prompt: string;
  maxTokens: number;
};

export type ProviderCallResult = {
  provider: CouncilProvider;
  model: string;
  text: string;
};

const REQUEST_TIMEOUT_MS = 30_000;
// Claude Fable 5 always reasons before answering, so its turns can run well
// past the 30s that is plenty for the other providers.
const CLAUDE_TIMEOUT_MS = 120_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function safeText(response: Response) {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

export async function callOpenAI(input: ProviderCallInput): Promise<ProviderCallResult> {
  const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      max_completion_tokens: input.maxTokens,
      messages: [
        ...(input.system ? [{ role: "system", content: input.system }] : []),
        { role: "user", content: input.prompt },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status}): ${await safeText(response)}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI response had no message content.");
  return { provider: "openai", model: input.model, text };
}

export async function callGemini(input: ProviderCallInput): Promise<ProviderCallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...(input.system ? { systemInstruction: { parts: [{ text: input.system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      generationConfig: { maxOutputTokens: input.maxTokens },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status}): ${await safeText(response)}`);
  }
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini response had no text content.");
  return { provider: "gemini", model: input.model, text };
}

export async function callClaude(input: ProviderCallInput): Promise<ProviderCallResult> {
  // Fable 5 runs safety classifiers that can decline a request outright; the
  // server-side fallback re-runs a declined request on Opus so the council
  // still gets an answer instead of an error.
  const isFable = input.model.startsWith("claude-fable");
  const response = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
        ...(isFable ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens,
        ...(isFable ? { fallbacks: "default" } : {}),
        ...(input.system ? { system: input.system } : {}),
        messages: [{ role: "user", content: input.prompt }],
      }),
    },
    CLAUDE_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw new Error(`Claude request failed (${response.status}): ${await safeText(response)}`);
  }
  const data = (await response.json()) as {
    content?: Array<{ text?: string }>;
    stop_reason?: string;
  };
  if (data.stop_reason === "refusal") {
    throw new Error("Claude declined this request (stop_reason: refusal).");
  }
  const text = data.content?.map((block) => block.text ?? "").join("").trim();
  if (!text) throw new Error("Claude response had no text content.");
  return { provider: "anthropic", model: input.model, text };
}
