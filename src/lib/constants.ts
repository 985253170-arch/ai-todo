export const STORAGE_KEY = "ai_todo_current_task_group";

export const UI_TEXT = {
  APP_NAME: "AI Todo",
  APP_TAGLINE: "把模糊目标拆成今天可以执行的任务。",
  INPUT_PLACEHOLDER: "例如：我要学习 Python / 我要准备面试 / 我要做一个小项目",
  BUTTON_GENERATE: "AI 拆分任务",
  GENERATING_BUTTON: "生成中...",
  EMPTY_STATE: "还没有任务，输入一个目标试试。",
  EXAMPLE_LABEL: "试试：",
  EXAMPLE_GOALS: [
    "我要学习 Python",
    "我要准备面试",
    "我要做一个小项目",
    "我要减肥",
  ],
} as const;

export const ERROR_MESSAGES = {
  EMPTY_INPUT: "请先输入一个目标。",
  INPUT_TOO_SHORT: "请输入更具体的目标，例如：我要学习 Python。",
  INPUT_TOO_LONG: "目标描述太长，请简化为一句话。",
  AI_GENERATION_FAILED: "任务生成失败，请稍后重试。",
  AI_PARSE_FAILED: "任务解析失败，请重新生成。",
  NETWORK_ERROR: "网络连接异常，请检查后重试。",
  SAVE_FAILED: "任务暂时无法保存，请稍后重试。",
  HIGH_RISK_INPUT:
    "这个目标可能会带来伤害或风险，我不能帮你拆解执行步骤。请换一个安全、积极的目标。",
  CHAT_INPUT: "我是用来帮你拆解任务的。请输入一个目标，例如：我要准备面试。",
} as const;
