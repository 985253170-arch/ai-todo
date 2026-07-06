export class ParseAssistAIResponseError extends Error {
  constructor(message = "Failed to parse assist AI response.") {
    super(message);
    this.name = "ParseAssistAIResponseError";
  }
}

const MAX_RESULT_LENGTH = 500;

export function parseAssistAIResponse(rawText: string): string {
  let text = rawText.trim();

  if (!text) {
    throw new ParseAssistAIResponseError("AI response is empty.");
  }

  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json|text)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as unknown;

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const parsedObject = parsed as Record<string, unknown>;
        const innerText =
          parsedObject.text ??
          parsedObject.result ??
          parsedObject.content ??
          parsedObject.response ??
          parsedObject.message;

        if (typeof innerText === "string" && innerText.trim()) {
          text = innerText.trim();
        }
      }
    } catch {
      // Keep the raw text if the model returned non-JSON text starting with "{".
    }
  }

  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/\*{1,3}([^*]+?)\*{1,3}/g, "$1");
  text = text.replace(/_{1,3}([^_]+?)_{1,3}/g, "$1");
  text = text.trim();

  if (!text) {
    throw new ParseAssistAIResponseError("AI response is empty after cleaning.");
  }

  if (text.length > MAX_RESULT_LENGTH) {
    text = text.slice(0, MAX_RESULT_LENGTH) + "…";
  }

  return text;
}
