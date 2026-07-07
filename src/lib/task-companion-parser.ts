import type { CompanionStep } from "@/lib/types";

export class ParseCompanionAIResponseError extends Error {
  constructor(message = "Failed to parse companion AI response.") {
    super(message);
    this.name = "ParseCompanionAIResponseError";
  }
}

const MAX_MESSAGE_LENGTH = 300;
const DONE_MARKER_PATTERN = /^\[DONE\]$/im;

export function parseCompanionAIResponse(rawText: string): CompanionStep {
  let text = rawText.trim();

  if (!text) {
    throw new ParseCompanionAIResponseError("AI response is empty.");
  }

  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:text)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  const companionState = DONE_MARKER_PATTERN.test(text) ? "done" : "active";

  text = text
    .replace(DONE_MARKER_PATTERN, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,3}([^*]+?)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+?)_{1,3}/g, "$1")
    .trim();

  if (!text) {
    throw new ParseCompanionAIResponseError("AI response is empty after cleaning.");
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    text = text.slice(0, MAX_MESSAGE_LENGTH) + "…";
  }

  return {
    companionState,
    message: text,
  };
}
