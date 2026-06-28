import { buildPrompt, SYSTEM_PROMPT } from "@/prompts/task-generation";

interface AIClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  goal: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const taskJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tasks: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  required: ["tasks"],
};

function normalizeBaseUrl(baseUrl?: string) {
  return (baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
}

async function requestChatCompletion(
  options: AIClientOptions,
  responseFormat: Record<string, unknown> | undefined,
) {
  const response = await fetch(`${normalizeBaseUrl(options.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(options.goal) },
      ],
      temperature: 0.2,
      max_tokens: 700,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI response content is empty.");
  }

  return content;
}

export async function callAIService(options: AIClientOptions) {
  const structuredOutputFormat = {
    type: "json_schema",
    json_schema: {
      name: "task_generation",
      strict: true,
      schema: taskJsonSchema,
    },
  };

  try {
    return await requestChatCompletion(options, structuredOutputFormat);
  } catch {
    try {
      return await requestChatCompletion(options, { type: "json_object" });
    } catch {
      return requestChatCompletion(options, undefined);
    }
  }
}
