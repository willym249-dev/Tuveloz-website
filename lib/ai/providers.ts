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

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens,
      ...(input.system ? { system: input.system } : {}),
      messages: [{ role: "user", content: input.prompt }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Claude request failed (${response.status}): ${await safeText(response)}`);
  }
  const data = (await response.json()) as {
    content?: Array<{ text?: string }>;
  };
  const text = data.content?.map((block) => block.text ?? "").join("").trim();
  if (!text) throw new Error("Claude response had no text content.");
  return { provider: "anthropic", model: input.model, text };
}
