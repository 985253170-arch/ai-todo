import { useMemo, useState } from "react";
import { FootprintDetailView } from "./FootprintDetailView";
import { FootprintEmptyState } from "./FootprintEmptyState";
import { FootprintList } from "./FootprintList";
import { FootprintSummaryCard } from "./FootprintSummaryCard";

interface FootprintsViewProps {
  onNavigateToToday: () => void;
}

type FootprintMode = "empty" | "list" | "detail";

interface FootprintEntry {
  id: string;
  dateLabel: string;
  goal: string;
  completedTitle: string;
  completedAt: string;
  reflection: string;
  details: string[];
}

const MOCK_FOOTPRINTS_DATA: FootprintEntry[] = [
  {
    id: "footprint-1",
    dateLabel: "今天 09:40",
    goal: "准备明天的面试",
    completedTitle: "阅读面试岗位要求",
    completedAt: "09:40",
    reflection: "你把这一步走完了。",
    details: ["圈出 3 个关键词。", "写下一句自己的理解。"],
  },
  {
    id: "footprint-2",
    dateLabel: "昨天 20:15",
    goal: "整理作品集介绍",
    completedTitle: "写下项目的第一句话",
    completedAt: "20:15",
    reflection: "开始不需要很大，能落笔就很好。",
    details: ["打开旧材料。", "挑出一个最想讲清楚的项目。"],
  },
  {
    id: "footprint-3",
    dateLabel: "7月7日 08:30",
    goal: "恢复早起节奏",
    completedTitle: "提前放好第二天要穿的衣服",
    completedAt: "08:30",
    reflection: "你给明天少留了一点阻力。",
    details: ["把外套放到椅背上。", "睡前确认闹钟。"],
  },
];

export function FootprintsView({ onNavigateToToday }: FootprintsViewProps) {
  const [footprintMode, setFootprintMode] = useState<FootprintMode>("list");
  const [selectedFootprintId, setSelectedFootprintId] = useState<string | null>(null);

  const selectedFootprint = useMemo(
    () => MOCK_FOOTPRINTS_DATA.find((footprint) => footprint.id === selectedFootprintId),
    [selectedFootprintId],
  );

  function handleSelectFootprint(id: string) {
    setSelectedFootprintId(id);
    setFootprintMode("detail");
  }

  function handleBackToList() {
    setSelectedFootprintId(null);
    setFootprintMode("list");
  }

  if (footprintMode === "detail" && selectedFootprint) {
    return <FootprintDetailView footprint={selectedFootprint} onBack={handleBackToList} />;
  }

  if (footprintMode === "empty" || MOCK_FOOTPRINTS_DATA.length === 0) {
    return <FootprintEmptyState onNavigateToToday={onNavigateToToday} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="shrink-0 space-y-1 pt-1">
        <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">
          足迹
        </h1>
        <p className="text-sm leading-5 text-text-secondary">
          慢慢走过的路，也值得被看见。
        </p>
      </header>

      <FootprintSummaryCard totalCompletedToday={1} />
      <FootprintList footprints={MOCK_FOOTPRINTS_DATA} onSelect={handleSelectFootprint} />
    </div>
  );
}
