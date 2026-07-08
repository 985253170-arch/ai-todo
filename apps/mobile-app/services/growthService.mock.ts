import { MOCK_GROWTH } from "@/mockData/mockData";
import type { GrowthStats } from "@/types/app";
import { delay } from "./serviceDelay";

export async function getGrowthStats(): Promise<GrowthStats> {
  await delay();
  return structuredClone(MOCK_GROWTH);
}
