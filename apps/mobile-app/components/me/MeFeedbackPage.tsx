import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  const feedbackScrollRef = useRef<HTMLDivElement | null>(null);
  const feedbackFocusTargetRef = useRef<HTMLDivElement | null>(null);
  const feedbackTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const revealFrameRef = useRef<number | null>(null);
  const focusedRef = useRef(false);
  const baselineViewportHeightRef = useRef<number | null>(null);
  const viewportCleanupRef = useRef<(() => void) | null>(null);
  const trimmedFeedback = feedback.trim();

  const cancelPendingReveal = useCallback(() => {
    if (revealFrameRef.current !== null) {
      cancelAnimationFrame(revealFrameRef.current);
      revealFrameRef.current = null;
    }
  }, []);

  const clearFocusUi = useCallback(() => {
    baselineViewportHeightRef.current = null;
    feedbackScrollRef.current?.style.removeProperty("scroll-padding-bottom");
  }, []);

  const stopViewportTracking = useCallback(() => {
    viewportCleanupRef.current?.();
    viewportCleanupRef.current = null;
    cancelPendingReveal();
    clearFocusUi();
  }, [cancelPendingReveal, clearFocusUi]);

  const scheduleReveal = useCallback(() => {
    cancelPendingReveal();
    revealFrameRef.current = requestAnimationFrame(() => {
      revealFrameRef.current = null;

      if (focusedRef.current) {
        feedbackFocusTargetRef.current?.scrollIntoView({
          block: "nearest",
          behavior: "auto",
        });
      }
    });
  }, [cancelPendingReveal]);

  const handleFocus = useCallback(() => {
    focusedRef.current = true;
    stopViewportTracking();

    const visualViewport = window.visualViewport;
    baselineViewportHeightRef.current = visualViewport?.height ?? window.innerHeight;
    scheduleReveal();

    if (!visualViewport) {
      return;
    }

    const handleViewportChange = () => {
      if (!focusedRef.current) {
        stopViewportTracking();
        return;
      }

      const baselineHeight =
        baselineViewportHeightRef.current ?? visualViewport.height;
      const viewportDrop = Math.max(0, baselineHeight - visualViewport.height);
      const rawInset = Math.max(
        0,
        window.innerHeight - visualViewport.height - visualViewport.offsetTop,
      );

      feedbackScrollRef.current?.style.setProperty(
        "scroll-padding-bottom",
        viewportDrop >= 120 ? `${rawInset}px` : "",
      );
      scheduleReveal();
    };

    visualViewport.addEventListener("resize", handleViewportChange);
    visualViewport.addEventListener("scroll", handleViewportChange);
    viewportCleanupRef.current = () => {
      visualViewport.removeEventListener("resize", handleViewportChange);
      visualViewport.removeEventListener("scroll", handleViewportChange);
    };
  }, [scheduleReveal, stopViewportTracking]);

  const handleBlur = useCallback(() => {
    focusedRef.current = false;
    stopViewportTracking();
  }, [stopViewportTracking]);

  const handleBack = useCallback(() => {
    focusedRef.current = false;
    stopViewportTracking();
    onBack();
  }, [onBack, stopViewportTracking]);

  useEffect(() => {
    return () => {
      focusedRef.current = false;
      stopViewportTracking();
    };
  }, [stopViewportTracking]);

  function handleSubmit() {
    if (!trimmedFeedback) {
      setHint("先写下一点点想法就好。");
      return;
    }

    focusedRef.current = false;
    stopViewportTracking();
    setHint("");
    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        <header className="shrink-0 pt-1">
          <div className="grid grid-cols-3 items-center text-sm font-semibold text-brand-blue">
            <button className="inline-flex min-h-touch items-center gap-1 justify-self-start rounded-full bg-paper px-3 shadow-card" type="button" onClick={handleBack}>
              <IconBack size={18} />
              返回我的
            </button>
            <p className="justify-self-center whitespace-nowrap">说说你的想法</p>
            <span />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 items-center">
          <PaperCard variant="warm" padding="normal" className="w-full space-y-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-paper text-brand-blue shadow-card"><IconPaperPlane size={28} /></span>
            <div>
              <h1 className="font-serif text-3xl font-semibold text-brand-blue">收到啦。</h1>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text-secondary">{"谢谢你认真告诉我们。\n我们会把它当作下一次变好的线索。"}</p>
            </div>
            <PrimaryButton onClick={handleBack}>回到我的小空间</PrimaryButton>
          </PaperCard>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="shrink-0 space-y-3 pt-1">
        <div className="grid grid-cols-3 items-center text-sm font-semibold text-brand-blue">
          <button className="inline-flex min-h-touch items-center gap-1 justify-self-start rounded-full bg-paper px-3 shadow-card" type="button" onClick={handleBack}>
            <IconBack size={18} />
            返回我的
          </button>
          <p className="justify-self-center whitespace-nowrap">说说你的想法</p>
          <span />
        </div>
        <div>
          <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">说说你的想法</h1>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-text-secondary">{"哪里用起来不舒服，\n或者你希望清行变得更轻一点，\n都可以慢慢告诉我们。"}</p>
        </div>
      </header>

      <PaperCard variant="white" padding="normal" className="min-h-0 flex-1 overflow-hidden bg-paper/90">
        <div ref={feedbackScrollRef} className="h-full min-h-0 overflow-y-auto overscroll-y-contain pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div>
            <h2 className="font-serif text-xl font-semibold text-brand-blue">你的想法</h2>
            <p className="mt-1 text-xs leading-5 text-text-tertiary">不用写得完整，留下一句也可以。</p>
          </div>
          <div ref={feedbackFocusTargetRef} className="mt-4">
            <textarea
              ref={feedbackTextareaRef}
              className="min-h-[280px] max-h-[360px] w-full resize-none overflow-y-auto rounded-3xl border border-border-paper bg-warm-soft px-4 py-3 text-sm leading-6 text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-brand-blue/50"
              maxLength={500}
              placeholder="比如：这里有点难懂、这个按钮我不知道会去哪里……"
              value={feedback}
              onBlur={handleBlur}
              onChange={(event) => {
                setFeedback(event.target.value);
                if (hint) setHint("");
              }}
              onFocus={handleFocus}
            />
            {hint ? <p className="mt-3 rounded-2xl bg-warm-soft px-3 py-2 text-xs leading-5 text-[#9A7352]">{hint}</p> : null}
            <PrimaryButton className="mt-3" onClick={handleSubmit}>送出这份想法</PrimaryButton>
          </div>
        </div>
      </PaperCard>
    </div>
  );
}
