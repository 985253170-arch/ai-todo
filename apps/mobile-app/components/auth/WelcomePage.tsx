import type { AuthScreen } from "@/types/app";
import { IconPaperPlane, IconStar } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";

interface WelcomePageProps {
  onNavigate: (screen: AuthScreen) => void;
}

export function WelcomePage({ onNavigate }: WelcomePageProps) {
  return (
    <main className="min-h-screen bg-warm-bg px-6 py-7">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-mobile flex-col">
        <header className="flex items-center justify-between">
          <p className="font-serif text-3xl font-semibold text-brand-blue">清行</p>
          <button
            className="min-h-touch rounded-button px-4 text-sm font-semibold text-brand-blue"
            type="button"
            onClick={() => onNavigate("otp-login")}
          >
            登录
          </button>
        </header>

        <section className="flex flex-1 flex-col justify-center gap-7 py-8">
          <div>
            <div className="mb-5 flex items-center gap-2 text-brand-blue">
              <IconStar size={22} />
              <span className="text-sm font-semibold text-text-secondary">今天从一句话开始</span>
            </div>
            <h1 className="font-serif text-5xl font-semibold leading-tight text-brand-blue">
              慢一点，也在向前走
            </h1>
            <p className="mt-5 text-lg leading-8 text-text-secondary">
              不用完整计划，写下一句话，我会与你一起完成
            </p>
          </div>

          <PaperCard variant="warm" padding="large" className="relative overflow-hidden">
            <div className="absolute right-5 top-5 rounded-tag bg-danger-soft/10 px-3 py-1 text-sm font-semibold text-danger-soft">
              行动中
            </div>
            <div className="mb-6 inline-flex rounded-card bg-paper-yellow p-4 text-brand-blue">
              <IconPaperPlane size={50} />
            </div>
            <p className="font-serif text-2xl font-semibold text-brand-blue">今天的一小步</p>
            <div className="mt-5 space-y-3">
              <div className="h-3 w-11/12 rounded-full bg-border-paper" />
              <div className="h-3 w-8/12 rounded-full bg-border-paper" />
              <div className="h-3 w-10/12 rounded-full bg-paper-yellow" />
            </div>
            <p className="mt-5 text-sm leading-6 text-text-secondary">
              先把眼前这一句放下来，剩下的慢慢拆开。
            </p>
          </PaperCard>
        </section>

        <footer className="space-y-3 pb-safe-bottom">
          <PrimaryButton onClick={() => onNavigate("otp-login")}>开始使用</PrimaryButton>
          <SecondaryButton onClick={() => onNavigate("otp-login")}>
            已有账号，去登录
          </SecondaryButton>
        </footer>
      </div>
    </main>
  );
}
