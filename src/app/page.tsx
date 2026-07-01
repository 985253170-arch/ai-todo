"use client";

import { useEffect, useRef } from "react";
import { GoalInput } from "@/components/GoalInput";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { HistoryPanel } from "@/components/HistoryPanel";
import { LoadingState } from "@/components/LoadingState";
import { NewDayPrompt } from "@/components/NewDayPrompt";
import { StatsBar } from "@/components/StatsBar";
import { TaskList } from "@/components/TaskList";
import { useTaskHistory } from "@/hooks/useTaskHistory";
import { useTaskGroup } from "@/hooks/useTaskGroup";
import { useTaskStats } from "@/hooks/useTaskStats";

export default function Home() {
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
  const taskHistory = useTaskHistory();
  const taskStats = useTaskStats();

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
            completedCount={completedCount}
            isAllCompleted={isAllCompleted}
            onClearTasks={handleClearTasksWithStats}
            onRegenerate={handleRegenerateWithStats}
            onToggleTask={handleToggleTaskWithStats}
            regenerateError={regenerateError}
            tasks={tasks}
            totalCount={totalCount}
          />
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
