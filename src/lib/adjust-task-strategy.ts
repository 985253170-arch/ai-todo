import type { AdjustmentResult, StatsData } from "@/lib/types";

export function computeAdjustment(stats: StatsData): AdjustmentResult {
  const rate = stats.sevenDay.completionRate;
  const streak = stats.total.activeDayStreak;

  if (stats.total.totalCompleted === 0 || rate === null) {
    return {
      difficulty: "normal",
      countRange: [3, 5],
      reason: "新用户，无历史数据，使用默认策略。",
    };
  }

  if (rate < 0.3) {
    return {
      difficulty: "lighter",
      countRange: [3, 3],
      reason: "最近7天完成率偏低，建议生成最少量的轻量任务，降低完成门槛。",
    };
  }

  if (rate < 0.5) {
    return {
      difficulty: "lighter",
      countRange: [3, 4],
      reason: "最近7天完成率偏低，建议减少任务数量并降低每条的完成门槛。",
    };
  }

  if (rate >= 0.8 && streak >= 7) {
    return {
      difficulty: "deeper",
      countRange: [5, 7],
      reason: "近期完成率高且连续行动稳定，可以适度增加挑战。",
    };
  }

  if (rate >= 0.7) {
    return {
      difficulty: "normal",
      countRange: [4, 6],
      reason: "近期完成率不错，可以稍微增加任务量。",
    };
  }

  return {
    difficulty: "normal",
    countRange: [3, 5],
    reason: "保持当前节奏。",
  };
}
