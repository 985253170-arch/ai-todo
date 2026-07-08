import type { CompanionStep, TaskAdjustmentSuggestion } from "@/lib/types";

export class ParseCompanionAIResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseCompanionAIResponseError";
  }
}

const MAX_MESSAGE_LENGTH = 300;
const DONE_MARKER_PATTERN = /^\[DONE\]$/im;
const ADJUST_PATTERN = /\[ADJUST\]([\s\S]*?)\[\/ADJUST\]/i;
const VALID_ADJUSTMENT_TYPES = new Set([
  "downgraded",
  "tomorrow",
  "keep_visible",
]);

function stripCodeFence(text: string) {
  return text
    .replace(/^\s*```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function readAdjustmentField(lines: string[], fieldNames: string[]) {
  const normalizedFieldNames = fieldNames.map((fieldName) =>
    fieldName.toLowerCase(),
  );

  for (const line of lines) {
    const [rawKey, ...valueParts] = line.split(":");
    const key = rawKey?.trim().toLowerCase();

    if (!key || !normalizedFieldNames.includes(key)) {
      continue;
    }

    const value = valueParts.join(":").trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function parseAdjustmentSuggestion(
  rawAdjustment: string,
): TaskAdjustmentSuggestion | undefined {
  const lines = rawAdjustment
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const type = readAdjustmentField(lines, ["type"]);

  if (!type || !VALID_ADJUSTMENT_TYPES.has(type)) {
    return undefined;
  }

  const suggestion = readAdjustmentField(lines, ["suggestion", "reason"]);

  if (!suggestion) {
    return undefined;
  }

  const alternativeTitle = readAdjustmentField(lines, [
    "alt_title",
    "alternativeTitle",
    "alternative_title",
  ]);

  if (type === "downgraded" && !alternativeTitle) {
    return undefined;
  }

  return {
    alternativeTitle:
      type === "downgraded" ? alternativeTitle?.slice(0, 120) : undefined,
    suggestion: suggestion.slice(0, 200),
    type,
  } as TaskAdjustmentSuggestion;
}

export function parseCompanionAIResponse(rawText: string): CompanionStep {
  let text = stripCodeFence(rawText);
  const adjustmentMatch = text.match(ADJUST_PATTERN);
  const adjustmentSuggestion = adjustmentMatch
    ? parseAdjustmentSuggestion(adjustmentMatch[1] ?? "")
    : undefined;

  text = text.replace(ADJUST_PATTERN, "").trim();

  const companionState = DONE_MARKER_PATTERN.test(text) ? "done" : "active";

  text = text
    .replace(DONE_MARKER_PATTERN, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*{1,3}([^*]+?)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+?)_{1,3}/g, "$1")
    .trim();

  if (!text) {
    throw new ParseCompanionAIResponseError("AI companion response is empty.");
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    text = text.slice(0, MAX_MESSAGE_LENGTH) + "?";
  }

  return {
    adjustmentSuggestion,
    companionState,
    message: text,
  };
}
