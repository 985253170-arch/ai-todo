import { ExampleGoals } from "@/components/ExampleGoals";
import { GoalInput } from "@/components/GoalInput";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { TaskList } from "@/components/TaskList";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <Header />
        <HeroSection />
        <div className="grid gap-5">
          <GoalInput />
          <ExampleGoals />
          <TaskList />
        </div>
      </div>
    </main>
  );
}
