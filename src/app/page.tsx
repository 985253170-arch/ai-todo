"use client";

import { ExampleGoals } from "@/components/ExampleGoals";
import { GoalInput } from "@/components/GoalInput";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { LoadingState } from "@/components/LoadingState";
import { NewDayPrompt } from "@/components/NewDayPrompt";
import { TaskList } from "@/components/TaskList";
import { useTaskGroup } from "@/hooks/useTaskGroup";

export default function Home() {
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <Header />
        <HeroSection />
        <div className="grid gap-5">
          <GoalInput
            errorMessage={errorMessage}
            isLoading={isGenerateDisabled}
            onChange={setInputGoal}
            onSubmit={handleGenerate}
            value={inputGoal}
          />
          <ExampleGoals onExampleClick={handleExampleClick} />
          {showNewDayPrompt ? (
            <NewDayPrompt onStartNewDay={handleStartNewDay} />
          ) : null}
          {pageStatus === "loading" ? <LoadingState /> : null}
          <TaskList
            completedCount={completedCount}
            isAllCompleted={isAllCompleted}
            onClearTasks={handleClearTasks}
            onRegenerate={handleRegenerate}
            onToggleTask={handleToggleTask}
            regenerateError={regenerateError}
            tasks={tasks}
            totalCount={totalCount}
          />
        </div>
      </div>
    </main>
  );
}
