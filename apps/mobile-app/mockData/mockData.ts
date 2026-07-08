import type { GrowthStats, HistoryItem, MockUser, TodayState } from "@/types/app";

export const MOCK_USER: MockUser = {
  email: "user@example.com",
  isLoggedIn: true,
  syncStatus: "synced",
};

export const MOCK_TODAY_STATE: TodayState = {
  goal: "准备明天的数据分析面试",
  completedCount: 0,
  totalCount: 4,
  tasks: [
    {
      id: "task-1",
      title: "阅读面试岗位要求",
      details: ["圈出 3 个关键词", "约 10 分钟"],
      estimatedMinutes: 10,
      status: "current",
    },
    {
      id: "task-2",
      title: "准备 1 分钟自我介绍",
      estimatedMinutes: 15,
      status: "locked",
    },
    {
      id: "task-3",
      title: "整理简历项目经历",
      estimatedMinutes: 20,
      status: "locked",
    },
    {
      id: "task-4",
      title: "复习常见 SQL 问题",
      estimatedMinutes: 15,
      status: "locked",
    },
  ],
};

export const MOCK_EMPTY_TODAY: TodayState = {
  goal: "",
  completedCount: 0,
  totalCount: 0,
  tasks: [],
};

export const MOCK_HISTORY: HistoryItem[] = [
  {
    id: "history-1",
    dateLabel: "7月6日 周一",
    goal: "准备数据分析面试",
    completionRate: 67,
    completedCount: 4,
    totalCount: 6,
    expanded: true,
    tasks: [
      { title: "圈出岗位关键词", completed: true },
      { title: "复习常见SQL问题", completed: true },
      { title: "模拟一次面试", completed: true },
      { title: "整理项目亮点", completed: false },
      { title: "更新简历", completed: false },
      { title: "发送感谢信", completed: true },
    ],
  },
  {
    id: "history-2",
    dateLabel: "7月5日 周日",
    goal: "整理简历项目经历",
    completionRate: 75,
    completedCount: 3,
    totalCount: 4,
    expanded: false,
    tasks: [],
  },
];

export const MOCK_EMPTY_HISTORY: HistoryItem[] = [];

export const MOCK_GROWTH: GrowthStats = {
  todayCompletionRate: 67,
  weekCompletionRate: 58,
  streakDays: 3,
  totalCompleted: 26,
  statusLabel: "有在继续",
  summaryText: "这几天你都有回来，已经往前走了一点点。",
  suggestionTitle: "下次可以轻一点",
  suggestionText: "不用一次安排太多。下次先从 2-3 个小步骤开始就好。",
};
