import type { ReviewData, SuggestedDifficulty } from "@/lib/types";

export class ParseReviewAIResponseError extends Error {
  constructor(message = "Failed to parse review AI response.") {
    super(message);
    this.name = "ParseReviewAIResponseError";
  }
}

export function isSuggestedDifficulty(
  value: unknown,
): value is SuggestedDifficulty {
  return value === "lighter" || value === "normal" || value === "deeper";
}

export function normalizeTaskCountRange(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    return [3, 5];
  }

  const [min, max] = value;

  if (
    typeof min !== "number" ||
    typeof max !== "number" ||
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 2 ||
    max > 8 ||
    min > max
  ) {
    return [3, 5];
  }

  return [min, max];
}

function cleanReviewAIResponse(rawText: string) {
  let cleanedText = rawText.trim();

  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  return cleanedText;
}

function parseJsonObject(cleanedText: string) {
  try {
    return JSON.parse(cleanedText) as unknown;
  } catch {
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new ParseReviewAIResponseError(
        "Review AI response is not valid JSON.",
      );
    }

    try {
      return JSON.parse(jsonMatch[0]) as unknown;
    } catch {
      throw new ParseReviewAIResponseError(
        "Review AI response JSON fallback failed.",
      );
    }
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseReviewAIResponse(rawText: string): ReviewData {
  const parsedResponse = parseJsonObject(cleanReviewAIResponse(rawText));

  if (!parsedResponse || typeof parsedResponse !== "object") {
    throw new ParseReviewAIResponseError(
      "Review AI response is not an object.",
    );
  }

  const response = parsedResponse as Record<string, unknown>;
  const feedbackText = readString(response.feedbackText);

  if (!feedbackText || feedbackText.length > 300) {
    throw new ParseReviewAIResponseError(
      "Review AI response feedbackText is missing or too long.",
    );
  }

  const sections =
    response.sections && typeof response.sections === "object"
      ? (response.sections as Record<string, unknown>)
      : {};
  const suggestedDifficulty: SuggestedDifficulty = isSuggestedDifficulty(
    response.suggestedDifficulty,
  )
    ? response.suggestedDifficulty
    : "normal";

  return {
    feedbackText,
    sections: {
      summary: readString(sections.summary),
      encouragement: readString(sections.encouragement),
      nextStep: readString(sections.nextStep),
    },
    suggestedDifficulty,
    suggestedTaskCountRange: normalizeTaskCountRange(
      response.suggestedTaskCountRange,
    ),
  };
}
