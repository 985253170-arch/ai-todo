import { MOCK_HISTORY } from "@/mockData/mockData";
import type { HistoryItem, HistoryRange } from "@/types/app";
import { delay } from "./serviceDelay";

export async function getHistory(range: HistoryRange): Promise<HistoryItem[]> {
  await delay();
  const history = range === "7d" ? MOCK_HISTORY.slice(0, 1) : MOCK_HISTORY;
  return structuredClone(history);
}
