"use client";

import { useEffect, useRef, useState } from "react";
import { GoalInput } from "@/components/GoalInput";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { HistoryPanel } from "@/components/HistoryPanel";
import { LoadingState } from "@/components/LoadingState";
import { NewDayPrompt } from "@/components/NewDayPrompt";
import { StatsBar } from "@/components/StatsBar";
import { TaskReviewPanel } from "@/components/TaskReviewPanel";
import { TaskList } from "@/components/TaskList";
import { useTaskHistory } from "@/hooks/useTaskHistory";
import { useTaskGroup } from "@/hooks/useTaskGroup";
import { useTaskReview } from "@/hooks/useTaskReview";
import { useTaskStats } from "@/hooks/useTaskStats";
import { getOrCreateDeviceId } from "@/lib/device-id";

export function MainWorkspace() {
  const historyPanelRef = useRef<HTMLDivElement>(null);
  const statsRefreshTimerRef = useRef<number | null>(null);
  const statsFollowUpRefreshTimerRef = useRef<number | null>(null);
  const {
    inputGoal,
    errorMessage,
    tasks,
    completedCount,
    totalCount,
    isGenerateDisabled,
    pageStatus,
    taskGroup,
    showNewDayPrompt,
    regenerateError,
    isAllCompleted,
    setInputGoal,
    handleGenerate,
    handleToggleTask,
    handleClearTasks,
    handleRegenerate,
    handleExampleClick,
    handleStartNewDay,
  } = useTaskGroup();
  const [activeAssistTaskId, setActiveAssistTaskId] = useState<string | null>(
    null,
  );
  const taskHistory = useTaskHistory();
  const taskStats = useTaskStats();
  const taskReview = useTaskReview({
    taskGroupId: taskGroup?.id,
    taskGroupUpdatedAt: taskGroup?.updatedAt,
    taskCount: totalCount,
    deviceId: getOrCreateDeviceId(),
    timezoneOffset: new Date().getTimezoneOffset(),
  });

  function scheduleStatsRefresh(delay = 500, followUpDelay = 2500) {
    if (statsRefreshTimerRef.current !== null) {
      window.clearTimeout(statsRefreshTimerRef.current);
    }
    if (statsFollowUpRefreshTimerRef.current !== null) {
      window.clearTimeout(statsFollowUpRefreshTimerRef.current);
    }

    statsRefreshTimerRef.current = window.setTimeout(() => {
      statsRefreshTimerRef.current = null;
      void taskStats.refreshStats();
    }, delay);

    statsFollowUpRefreshTimerRef.current = window.setTimeout(() => {
      statsFollowUpRefreshTimerRef.current = null;
      void taskStats.refreshStats();
    }, followUpDelay);
  }

  async function handleGenerateWithStats() {
    await handleGenerate();
    scheduleStatsRefresh(500);
  }

  function handleToggleTaskWithStats(taskId: string) {
    handleToggleTask(taskId);
    scheduleStatsRefresh(500);
  }

  function handleToggleAssist(taskId: string) {
    setActiveAssistTaskId((currentTaskId) =>
      currentTaskId === taskId ? null : taskId,
    );
  }

  function handleClearTasksWithStats() {
    handleClearTasks();
    scheduleStatsRefresh(500);
  }

  async function handleRegenerateWithStats() {
    await handleRegenerate();
    scheduleStatsRefresh(500);
  }

  function handleStartNewDayWithStats() {
    handleStartNewDay();
    scheduleStatsRefresh(500);
  }

  useEffect(() => {
    if (!taskHistory.isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      historyPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [taskHistory.isOpen]);

  useEffect(() => {
    return () => {
      if (statsRefreshTimerRef.current !== null) {
        window.clearTimeout(statsRefreshTimerRef.current);
      }
      if (statsFollowUpRefreshTimerRef.current !== null) {
        window.clearTimeout(statsFollowUpRefreshTimerRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F8FAFF] bg-gradient-to-b from-indigo-50 via-white to-sky-50 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-[720px] flex-col gap-6 sm:gap-7">
        <Header
          variant="app"
          historyPanelId="history-panel"
          isHistoryOpen={taskHistory.isOpen}
          onToggleHistory={taskHistory.togglePanel}
        />
        <HeroSection />
        <div className="grid gap-5">
          <GoalInput
            errorMessage={errorMessage}
            isLoading={isGenerateDisabled}
            onChange={setInputGoal}
            onExampleClick={handleExampleClick}
            onSubmit={handleGenerateWithStats}
            value={inputGoal}
          />
          <StatsBar
            error={taskStats.error}
            isLoading={taskStats.isLoading}
            onRetry={taskStats.refreshStats}
            stats={taskStats.stats}
          />
          {showNewDayPrompt ? (
            <NewDayPrompt onStartNewDay={handleStartNewDayWithStats} />
          ) : null}
          {pageStatus === "loading" ? <LoadingState /> : null}
          <TaskList
            activeAssistTaskId={activeAssistTaskId}
            completedCount={completedCount}
            goal={taskGroup?.goal ?? ""}
            isAllCompleted={isAllCompleted}
            onClearTasks={handleClearTasksWithStats}
            onRegenerate={handleRegenerateWithStats}
            onToggleAssist={handleToggleAssist}
            onToggleTask={handleToggleTaskWithStats}
            regenerateError={regenerateError}
            tasks={tasks}
            totalCount={totalCount}
          />
          {taskGroup ? (
            <TaskReviewPanel
              taskCount={totalCount}
              error={taskReview.error}
              isLoading={taskReview.isLoading}
              isStale={taskReview.isStale}
              onGenerate={taskReview.generateReview}
              onReset={taskReview.resetReview}
              review={taskReview.review}
            />
          ) : null}
          <div id="history-panel" ref={historyPanelRef}>
            <HistoryPanel
              error={taskHistory.error}
              hasMore={taskHistory.hasMore}
              historyList={taskHistory.historyList}
              isLoading={taskHistory.isLoading}
              isLoadingMore={taskHistory.isLoadingMore}
              isOpen={taskHistory.isOpen}
              onLoadMore={taskHistory.loadMore}
              onRetry={taskHistory.refreshHistory}
            />
          </div>
        </div>
      </div>
    </main>
  );
}




