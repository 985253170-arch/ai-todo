import { ERROR_MESSAGES } from "@/lib/constants";
import type { ApiErrorCode } from "@/lib/types";

export type InputValidationResult =
  | { isValid: true; code: null; message: null }
  | { isValid: false; code: ApiErrorCode; message: string };

const RISK_KEYWORDS = [
  "自杀",
  "自残",
  "伤害",
  "杀人",
  "报复",
  "诈骗",
  "毒品",
  "炸弹",
  "攻击",
  "违法",
];

export function validateGoalInput(goal: string): InputValidationResult {
  const trimmedGoal = goal.trim();

  if (trimmedGoal.length === 0) {
    return {
      isValid: false,
      code: "EMPTY_INPUT",
      message: ERROR_MESSAGES.EMPTY_INPUT,
    };
  }

  if (trimmedGoal.length === 1) {
    return {
      isValid: false,
      code: "INPUT_TOO_SHORT",
      message: ERROR_MESSAGES.INPUT_TOO_SHORT,
    };
  }

  if (trimmedGoal.length > 100) {
    return {
      isValid: false,
      code: "INPUT_TOO_LONG",
      message: ERROR_MESSAGES.INPUT_TOO_LONG,
    };
  }

  return { isValid: true, code: null, message: null };
}

export function checkRiskInput(goal: string) {
  const normalizedGoal = goal.toLowerCase();
  return RISK_KEYWORDS.some((keyword) => normalizedGoal.includes(keyword));
}
