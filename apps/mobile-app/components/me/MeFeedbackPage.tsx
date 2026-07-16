import { useState } from "react";
import { IconBack, IconPaperPlane } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

interface MeFeedbackPageProps {
  onBack: () => void;
}

export function MeFeedbackPage({ onBack }: MeFeedbackPageProps) {
  const [feedback, setFeedback] = useState("");
  const [hint, setHint] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const trimmedFeedback = feedback.trim();

  function handleSubmit() {
    if (!trimmedFeedback) {
      setHint("先写下一点点想法就好。");
      return;
    }

    setHint("");
    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        <header className="shrink-0 pt-1">
          <div className="grid grid-cols-3 items-center text-sm font-semibold text-brand-blue">
            <button
              className="inline-flex min-h-touch items-center gap-1 justify-self-start rounded-full bg-paper px-3 shadow-card"
              type="button"
              onClick={onBack}
            >
              <IconBack size={18} />
              返回我的
            </button>
            <p className="justify-self-center whitespace-nowrap">说说你的想法</p>
            <span />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 items-center">
          <PaperCard variant="warm" padding="normal" className="w-full space-y-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-paper text-brand-blue shadow-card">
              <IconPaperPlane size={28} />
            </span>
            <div>
              <h1 className="font-serif text-3xl font-semibold text-brand-blue">收到啦。</h1>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text-secondary">
                {"谢谢你认真告诉我们。\n我们会把它当作下一次变好的线索。"}
              </p>
            </div>
            <PrimaryButton onClick={onBack}>回到我的小空间</PrimaryButton>
          </PaperCard>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="shrink-0 space-y-3 pt-1">
        <div className="grid grid-cols-3 items-center text-sm font-semibold text-brand-blue">
          <button
            className="inline-flex min-h-touch items-center gap-1 justify-self-start rounded-full bg-paper px-3 shadow-card"
            type="button"
            onClick={onBack}
          >
            <IconBack size={18} />
            返回我的
          </button>
          <p className="justify-self-center whitespace-nowrap">说说你的想法</p>
          <span />
        </div>

        <div>
          <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">
            说说你的想法
          </h1>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-text-secondary">
            {"哪里用起来不舒服，\n或者你希望清行变得更轻一点，\n都可以慢慢告诉我们。"}
          </p>
        </div>
      </header>

      <PaperCard variant="white" padding="normal" className="min-h-0 flex-1 space-y-3 bg-paper/90">
        <div>
          <h2 className="font-serif text-xl font-semibold text-brand-blue">你的想法</h2>
          <p className="mt-1 text-xs leading-5 text-text-tertiary">
            不用写得完整，留下一句也可以。
          </p>
        </div>

        <textarea
          className="h-[180px] w-full resize-none rounded-3xl border border-border-paper bg-warm-soft px-4 py-3 text-sm leading-6 text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-brand-blue/50"
          maxLength={300}
          placeholder="比如：这里有点难懂、这个按钮我不知道会去哪里……"
          value={feedback}
          onChange={(event) => {
            setFeedback(event.target.value);
            if (hint) {
              setHint("");
            }
          }}
        />

        {hint ? (
          <p className="rounded-2xl bg-warm-soft px-3 py-2 text-xs leading-5 text-[#9A7352]">
            {hint}
          </p>
        ) : null}

        <PrimaryButton onClick={handleSubmit}>轻轻提交</PrimaryButton>
      </PaperCard>
    </div>
  );
}
