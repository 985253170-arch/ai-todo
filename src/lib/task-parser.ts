export class ParseAIResponseError extends Error {
  constructor(message = "Failed to parse AI response.") {
    super(message);
    this.name = "ParseAIResponseError";
  }
}

interface RawTask {
  title?: unknown;
}

function cleanAIResponse(rawText: string) {
  let cleanedText = rawText.trim();

  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  return cleanedText;
}

export function parseAIResponse(rawText: string) {
  let parsedResponse: unknown;

  try {
    parsedResponse = JSON.parse(cleanAIResponse(rawText));
  } catch {
    throw new ParseAIResponseError("AI response is not valid JSON.");
  }

  if (!parsedResponse || typeof parsedResponse !== "object") {
    throw new ParseAIResponseError("AI response is not an object.");
  }

  if (!("tasks" in parsedResponse)) {
    throw new ParseAIResponseError("AI response is missing tasks.");
  }

  const { tasks } = parsedResponse as { tasks: unknown };

  if (!Array.isArray(tasks)) {
    throw new ParseAIResponseError("AI response tasks is not an array.");
  }

  const taskTitles = tasks
    .map((task: RawTask) =>
      typeof task?.title === "string" ? task.title.trim() : "",
    )
    .filter((title) => title.length > 0);

  if (taskTitles.length < 3) {
    throw new ParseAIResponseError("AI response has fewer than 3 tasks.");
  }

  return taskTitles.slice(0, 8);
}
