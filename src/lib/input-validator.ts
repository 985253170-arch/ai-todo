import { ERROR_MESSAGES } from "@/lib/constants";

export type InputValidationResult =
  | { isValid: true; message: null }
  | { isValid: false; message: string };

export function validateGoalInput(goal: string): InputValidationResult {
  const trimmedGoal = goal.trim();

  if (trimmedGoal.length === 0) {
    return { isValid: false, message: ERROR_MESSAGES.EMPTY_INPUT };
  }

  if (trimmedGoal.length === 1) {
    return { isValid: false, message: ERROR_MESSAGES.INPUT_TOO_SHORT };
  }

  if (trimmedGoal.length > 100) {
    return { isValid: false, message: ERROR_MESSAGES.INPUT_TOO_LONG };
  }

  return { isValid: true, message: null };
}
