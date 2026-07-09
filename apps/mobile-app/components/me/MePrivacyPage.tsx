import { IconBack, IconLeaf } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";

interface MePrivacyPageProps {
  onBack: () => void;
}

const privacyCards = [
  {
    title: "我们会保存什么",
    items: [
      "你写下的目标",
      "AI 为你拆出的小任务",
      "你完成过的足迹",
      "你在任务里留下的简单反馈",
    ],
  },
  {
    title: "这些记录用来做什么",
    items: [
      "帮你接着上次的进度继续",
      "让任务建议更贴近你的节奏",
      "在复盘时看到自己已经走过的小步",
    ],
  },
  {
    title: "你可以放心",
    items: [
      "清行不会用复杂指标评价你。",
      "也不会用完成率给你制造压力。",
      "这些记录只是为了陪你更轻地行动。",
    ],
  },
];

export function MePrivacyPage({ onBack }: MePrivacyPageProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="shrink-0 space-y-3 pt-1">
        <div className="grid grid-cols-3 items-center text-sm font-semibold text-brand-blue">
          <button
            className="inline-flex min-h-[38px] items-center gap-1 justify-self-start rounded-full bg-paper px-3 shadow-card"
            type="button"
            onClick={onBack}
          >
            <IconBack size={18} />
            返回我的
          </button>
          <p className="justify-self-center whitespace-nowrap">隐私与数据说明</p>
          <span className="justify-self-end text-brand-blue/55">
            <IconLeaf size={24} />
          </span>
        </div>

        <div>
          <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">
            隐私与数据说明
          </h1>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-text-secondary">
            {"我们只希望把你的行动记录安静保存好。\n\n目标、任务和足迹，是为了帮你在下次回来时，\n更容易接着往前走。"}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-3 pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {privacyCards.map((card) => (
          <PaperCard key={card.title} variant="white" padding="compact" className="bg-paper/90">
            <h2 className="font-serif text-lg font-semibold text-brand-blue">{card.title}</h2>
            <div className="mt-3 space-y-2">
              {card.items.map((item) => (
                <p key={item} className="rounded-2xl bg-warm-soft px-3 py-2 text-sm leading-5 text-text-secondary">
                  {item}
                </p>
              ))}
            </div>
          </PaperCard>
        ))}

        <p className="whitespace-pre-line rounded-3xl bg-paper/75 px-4 py-3 text-xs leading-5 text-text-tertiary shadow-card">
          {"如果你之后想清理本地缓存，\n可以回到“我的小空间”里处理。"}
        </p>
      </div>
    </div>
  );
}
