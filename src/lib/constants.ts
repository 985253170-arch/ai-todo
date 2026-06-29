export const STORAGE_KEY = "ai_todo_current_task_group";
export const DEVICE_ID_STORAGE_KEY = "ai_todo_device_id";

export const UI_TEXT = {
  APP_NAME: "AI Todo",
  APP_ROLE: "今日行动教练",
  HERO_TITLE: "今天想推进哪个目标？",
  APP_TAGLINE: "让 AI 帮你拆成今天能完成的小任务。",
  INPUT_CARD_TITLE: "生成今日行动计划",
  INPUT_CARD_DESCRIPTION: "输入一个目标，AI 会拆成 3-8 个可执行任务。",
  INPUT_PLACEHOLDER: "例如：我要学习 Python / 我要准备面试 / 我要做一个小项目",
  BUTTON_GENERATE: "生成今日任务",
  GENERATING_BUTTON: "生成中...",
  EMPTY_STATE_TITLE: "还没有生成今日任务",
  EMPTY_STATE_DESCRIPTION: "输入一个目标，让 AI 帮你拆出第一步。",
  TASK_LIST_TITLE: "今日行动计划",
  CLEAR_TASKS_BUTTON: "清空",
  REGENERATE_BUTTON: "重新生成",
  START_NEW_DAY_BUTTON: "开始新一天",
  NEW_DAY_PROMPT: "这是上次的任务，要开始新一天吗？",
  COMPLETE_ALL_TITLE: "🎉 今日任务已完成",
  COMPLETE_ALL_DESCRIPTION: "你已经把目标往前推进了一步。",
  LOADING_TEXT: "AI 正在拆解任务...",
  PRIVACY_NOTICE: "请勿输入密码、证件号等敏感信息。",
  EXAMPLE_LABEL: "不知道写什么？试试：",
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
  REGENERATE_FAILED: "重新生成失败，请稍后重试。",
  INVALID_DEVICE_ID: "设备标识无效。",
  INVALID_TASK_GROUP: "任务组数据无效。",
  NOT_CONFIGURED: "云端保存暂未配置。",
  CLOUD_SAVE_FAILED: "云端保存失败，请稍后重试。",
  CLOUD_LOAD_FAILED: "云端读取失败，请稍后重试。",
  CLOUD_DELETE_FAILED: "云端删除失败，请稍后重试。",
} as const;
