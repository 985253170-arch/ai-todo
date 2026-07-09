"use client";

import { useMemo, useState } from "react";
import { WelcomePage } from "@/components/auth/WelcomePage";
import { OtpLoginPage } from "@/components/auth/OtpLoginPage";
import { PasswordLoginPage } from "@/components/auth/PasswordLoginPage";
import { RegisterPage } from "@/components/auth/RegisterPage";
import { FootprintsView } from "@/components/footprints/FootprintsView";
import { GrowthView } from "@/components/growth/GrowthView";
import { MeView } from "@/components/me/MeView";
import { AppShell } from "@/components/shell/AppShell";
import { TaskExecutionView } from "@/components/today/TaskExecutionView";
import { TaskListView } from "@/components/today/TaskListView";
import { TodayHomeView } from "@/components/today/TodayHomeView";
import { PaperCard } from "@/components/ui/PaperCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { SectionTitle } from "@/components/ui/SectionTitle";
import {
  IconBack,
  IconFire,
  IconLeaf,
  IconPaperPlane,
  IconSeed,
  IconSettings,
  IconStar,
} from "@/components/icons";
import { completeTask, generateTasks, getTodayState } from "@/services/taskService.mock";
import type { AppTab, AuthScreen, TodayState } from "@/types/app";

type AuthState = "guest" | "authenticated";
type TodayMode = "home" | "tasks" | "execution";

const tabCopy: Record<AppTab, { title: string; body: string }> = {
  today: {
    title: "今日",
    body: "这里会承载今天的小步入口。Batch 1 只保留基础占位，不实现任务页。",
  },
  footprint: {
    title: "足迹",
    body: "这里会记录走过的小步。Batch 1 暂不实现历史列表。",
  },
  growth: {
    title: "成长",
    body: "这里会展示低压力的成长洞察。Batch 1 暂不实现统计页面。",
  },
  me: {
    title: "我的",
    body: "这里会放账号与设置入口。Batch 1 暂不实现设置页。",
  },
};

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("guest");
  const [authScreen, setAuthScreen] = useState<AuthScreen>("welcome");
  const [activeTab, setActiveTab] = useState<AppTab>("today");
  const [todayMode, setTodayMode] = useState<TodayMode>("home");
  const [todayState, setTodayState] = useState<TodayState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [taskHint, setTaskHint] = useState("");
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const current = tabCopy[activeTab];

  const accentIcon = useMemo(() => {
    if (activeTab === "footprint") {
      return <IconPaperPlane size={44} />;
    }

    if (activeTab === "growth") {
      return <IconSeed size={44} />;
    }

    if (activeTab === "me") {
      return <IconLeaf size={44} />;
    }

    return <IconStar size={40} />;
  }, [activeTab]);

  function handleLoginSuccess() {
    setAuthState("authenticated");
    setActiveTab("today");
    setTodayMode("home");
    setExecutingTaskId(null);
  }

  async function handleGenerateGoal(goal: string) {
    setIsGenerating(true);
    setTaskHint("");

    try {
      await generateTasks(goal);
      const nextState = await getTodayState();
      setTodayState(nextState);
      setExecutingTaskId(null);
      setTodayMode("tasks");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCompleteTask(taskId: string) {
    const nextState = await completeTask(taskId);
    setTodayState(nextState);
    setTaskHint("");
    setExecutingTaskId(null);
    setTodayMode("tasks");
  }

  function handleStartTask(taskId: string) {
    setTaskHint("");
    setExecutingTaskId(taskId);
    setTodayMode("execution");
  }

  function handleBackToTasks() {
    setExecutingTaskId(null);
    setTodayMode("tasks");
  }

  function handleLockedTaskClick() {
    setTaskHint("先完成眼前这一小步");
  }

  function handleLogout() {
    setAuthState("guest");
    setAuthScreen("welcome");
    setActiveTab("today");
    setTodayMode("home");
    setTodayState(null);
    setExecutingTaskId(null);
    setTaskHint("");
  }

  function renderTaskList() {
    if (!todayState) {
      return null;
    }

    return (
      <TaskListView
        todayState={todayState}
        hint={taskHint}
        onBackHome={() => setTodayMode("home")}
        onStartTask={handleStartTask}
        onCompleteTask={handleCompleteTask}
        onLockedTaskClick={handleLockedTaskClick}
      />
    );
  }

  function renderTodayContent() {
    if (todayMode === "execution" && todayState) {
      const executingTask = todayState.tasks.find((task) => task.id === executingTaskId);

      if (executingTask) {
        return (
          <TaskExecutionView
            task={executingTask}
            onBack={handleBackToTasks}
            onComplete={handleCompleteTask}
          />
        );
      }

      return renderTaskList();
    }

    if (todayMode === "tasks" && todayState) {
      return renderTaskList();
    }

    return (
      <TodayHomeView
        isGenerating={isGenerating}
        onGenerateGoal={handleGenerateGoal}
        onNavigateToMe={() => setActiveTab("me")}
      />
    );
  }

  function renderContent() {
    if (activeTab === "today") {
      return renderTodayContent();
    }

    if (activeTab === "footprint") {
      return <FootprintsView onNavigateToToday={() => setActiveTab("today")} />;
    }

    if (activeTab === "growth") {
      return <GrowthView onNavigateToToday={() => setActiveTab("today")} />;
    }

    if (activeTab === "me") {
      return <MeView onLogout={handleLogout} />;
    }

    return renderPlaceholderContent();
  }

  function renderPlaceholderContent() {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-secondary">清行</p>
            <h1 className="mt-2 font-serif text-5xl font-semibold leading-tight text-brand-blue">
              清行
            </h1>
          </div>
          <button
            className="grid min-h-touch min-w-touch place-items-center rounded-full border border-border-paper bg-paper text-brand-blue shadow-card"
            type="button"
            aria-label="设置"
            onClick={() => setActiveTab("me")}
          >
            <IconSettings size={24} />
          </button>
        </header>

        <PaperCard variant="warm" padding="large" className="relative overflow-hidden">
          <div className="absolute right-5 top-5 text-brand-blue/80">{accentIcon}</div>
          <p className="pr-14 font-serif text-3xl font-semibold leading-snug text-brand-blue">
            慢一点，也在向前走
          </p>
          <p className="mt-4 max-w-[18rem] text-base leading-7 text-text-secondary">
            一个手机端优先的行动壳已经放好。后续页面会在这层 AppShell 内继续生长。
          </p>
        </PaperCard>

        <PaperCard>
          <SectionTitle
            title={`${current.title}占位`}
            subtitle="当前只验证基础工程壳、视觉 token、底部导航和组件可用性。"
          />
          <p className="mt-5 rounded-card bg-warm-soft p-5 text-base leading-7 text-text-secondary">
            {current.body}
          </p>
          <div className="mt-5 flex items-center gap-3 rounded-card border border-border-paper bg-paper-warm p-4 text-brand-blue">
            <IconFire size={24} />
            <span className="text-sm font-semibold">底部 Tab 已固定，安全区 padding 已预留。</span>
          </div>
        </PaperCard>

        <div className="grid grid-cols-2 gap-3">
          <SecondaryButton onClick={() => setActiveTab("today")}>
            <span className="inline-flex items-center justify-center gap-2">
              <IconBack size={18} />
              回到今日
            </span>
          </SecondaryButton>
          <PrimaryButton onClick={() => setActiveTab("growth")}>看看成长</PrimaryButton>
        </div>
      </div>
    );
  }

  if (authState === "guest") {
    if (authScreen === "otp-login") {
      return (
        <OtpLoginPage
          onLoginSuccess={handleLoginSuccess}
          onNavigate={setAuthScreen}
        />
      );
    }

    if (authScreen === "password-login") {
      return (
        <PasswordLoginPage
          onLoginSuccess={handleLoginSuccess}
          onNavigate={setAuthScreen}
        />
      );
    }

    if (authScreen === "register") {
      return (
        <RegisterPage
          onLoginSuccess={handleLoginSuccess}
          onNavigate={setAuthScreen}
        />
      );
    }

    return <WelcomePage onNavigate={setAuthScreen} />;
  }

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </AppShell>
  );
}
