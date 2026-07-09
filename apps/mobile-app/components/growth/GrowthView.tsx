import { useState } from "react";
import { GrowthEmptyState } from "./GrowthEmptyState";
import { GrowthRhythmCard } from "./GrowthRhythmCard";
import { GrowthSummaryCard } from "./GrowthSummaryCard";
import { GrowthTaskSizeCard } from "./GrowthTaskSizeCard";

interface GrowthViewProps {
  onNavigateToToday: () => void;
}

type GrowthMode = "empty" | "insight";

const MOCK_GROWTH_INSIGHT = {
  weeklySteps: 5,
  quickStartCount: 3,
  preferredStartActions: ["先做 5 分钟", "先写一句话", "先打开材料"],
  recommendedMinutes: "5-15 分钟",
  taskSizeTips: ["一次只做一个动作", "先完成“能开始”的版本"],
};

export function GrowthView({ onNavigateToToday }: GrowthViewProps) {
  const [growthMode] = useState<GrowthMode>("insight");

  if (growthMode === "empty") {
    return <GrowthEmptyState onNavigateToToday={onNavigateToToday} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="shrink-0 space-y-1 pt-1">
        <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">
          成长
        </h1>
        <p className="text-sm leading-5 text-text-secondary">
          慢慢来，你的变化会被看见。
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <GrowthSummaryCard
          weeklySteps={MOCK_GROWTH_INSIGHT.weeklySteps}
          quickStartCount={MOCK_GROWTH_INSIGHT.quickStartCount}
        />
        <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 overflow-hidden">
          <GrowthRhythmCard preferredStartActions={MOCK_GROWTH_INSIGHT.preferredStartActions} />
          <GrowthTaskSizeCard
            recommendedMinutes={MOCK_GROWTH_INSIGHT.recommendedMinutes}
            tips={MOCK_GROWTH_INSIGHT.taskSizeTips}
          />
        </div>
      </div>
    </div>
  );
}
