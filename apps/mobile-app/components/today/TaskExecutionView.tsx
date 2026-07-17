import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { IconBack } from "@/components/icons";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useBackController } from "@/contexts/BackControllerContext";
import { getCompanionStep } from "@/services/taskService.mock";
import type { CompanionStep, Task } from "@/types/app";
import { ExecutionFeedbackBox } from "./ExecutionFeedbackBox";
import { ExecutionGuideCard } from "./ExecutionGuideCard";
import { ExecutionTaskCard } from "./ExecutionTaskCard";

interface TaskExecutionViewProps {
  task: Task;
  onBack: () => void;
  onComplete: (taskId: string) => void | Promise<void>;
}

type ExecutionPresentation =
  | "default"
  | "guide-focused"
  | "feedback-focused";

export function TaskExecutionView({
  task,
  onBack,
  onComplete,
}: TaskExecutionViewProps) {
  const [guide, setGuide] = useState<CompanionStep | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false);
  const [executionPresentation, setExecutionPresentation] =
    useState<ExecutionPresentation>("default");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);
  const executionRootRef = useRef<HTMLDivElement | null>(null);
  const feedbackTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const baselineViewportHeightRef = useRef<number | null>(null);
  const executionPresentationRef = useRef<ExecutionPresentation>("default");
  const viewportCleanupRef = useRef<(() => void) | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const backController = useBackController();

  const cancelPendingFocusFrame = useCallback(() => {
    if (focusFrameRef.current !== null) {
      cancelAnimationFrame(focusFrameRef.current);
      focusFrameRef.current = null;
    }
  }, []);

  const removeViewportListeners = useCallback(() => {
    viewportCleanupRef.current?.();
    viewportCleanupRef.current = null;
  }, []);

  const clearKeyboardUi = useCallback(() => {
    baselineViewportHeightRef.current = null;
    setKeyboardInset(0);
    executionRootRef.current?.style.removeProperty(
      "--task-feedback-keyboard-inset",
    );
  }, []);

  const stopViewportTracking = useCallback(() => {
    removeViewportListeners();
    clearKeyboardUi();
  }, [clearKeyboardUi, removeViewportListeners]);

  const startViewportTracking = useCallback(() => {
    stopViewportTracking();

    const textarea = feedbackTextareaRef.current;
    const visualViewport = window.visualViewport;
    baselineViewportHeightRef.current = visualViewport?.height ?? window.innerHeight;

    if (
      !visualViewport ||
      executionPresentationRef.current !== "feedback-focused" ||
      document.activeElement !== textarea
    ) {
      return;
    }

    const updateKeyboardInset = () => {
      if (
        executionPresentationRef.current !== "feedback-focused" ||
        document.activeElement !== feedbackTextareaRef.current
      ) {
        stopViewportTracking();
        return;
      }

      const baselineHeight = baselineViewportHeightRef.current;
      if (baselineHeight === null) {
        return;
      }

      const viewportDrop = Math.max(0, baselineHeight - visualViewport.height);
      const rawInset = Math.max(
        0,
        window.innerHeight - visualViewport.height - visualViewport.offsetTop,
      );
      const nextInset = viewportDrop >= 120 ? rawInset : 0;

      setKeyboardInset(nextInset);
    };

    visualViewport.addEventListener("resize", updateKeyboardInset);
    visualViewport.addEventListener("scroll", updateKeyboardInset);
    viewportCleanupRef.current = () => {
      visualViewport.removeEventListener("resize", updateKeyboardInset);
      visualViewport.removeEventListener("scroll", updateKeyboardInset);
    };
    updateKeyboardInset();
  }, [stopViewportTracking]);

  const openGuideFocus = useCallback(() => {
    cancelPendingFocusFrame();
    stopViewportTracking();
    executionPresentationRef.current = "guide-focused";
    setExecutionPresentation("guide-focused");
  }, [cancelPendingFocusFrame, stopViewportTracking]);

  const collapseGuideFocus = useCallback(() => {
    cancelPendingFocusFrame();
    executionPresentationRef.current = "default";
    setExecutionPresentation("default");
  }, [cancelPendingFocusFrame]);

  const openFeedbackFocus = useCallback(() => {
    cancelPendingFocusFrame();
    executionPresentationRef.current = "feedback-focused";
    setExecutionPresentation("feedback-focused");
    startViewportTracking();
  }, [cancelPendingFocusFrame, startViewportTracking]);

  const collapseFeedbackFocus = useCallback(() => {
    cancelPendingFocusFrame();
    feedbackTextareaRef.current?.blur();
    executionPresentationRef.current = "default";
    setExecutionPresentation("default");
    stopViewportTracking();
  }, [cancelPendingFocusFrame, stopViewportTracking]);

  const openFeedbackFromGuide = useCallback(() => {
    cancelPendingFocusFrame();
    executionPresentationRef.current = "feedback-focused";
    setExecutionPresentation("feedback-focused");
    focusFrameRef.current = requestAnimationFrame(() => {
      focusFrameRef.current = null;

      if (
        isMountedRef.current &&
        executionPresentationRef.current === "feedback-focused"
      ) {
        feedbackTextareaRef.current?.focus();
      }
    });
  }, [cancelPendingFocusFrame]);

  const handleFeedbackBlur = useCallback(() => {
    stopViewportTracking();
  }, [stopViewportTracking]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cancelPendingFocusFrame();
    };
  }, [cancelPendingFocusFrame]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialGuide() {
      collapseFeedbackFocus();
      setFeedbackDraft("");
      setGuide(null);
      setHasSubmittedFeedback(false);

      setIsProcessing(true);
      try {
        const nextGuide = await getCompanionStep(task.id);
        if (isMounted) {
          setGuide(nextGuide);
        }
      } finally {
        if (isMounted) {
          setIsProcessing(false);
        }
      }
    }

    void loadInitialGuide();

    return () => {
      isMounted = false;
      executionPresentationRef.current = "default";
      cancelPendingFocusFrame();
      stopViewportTracking();
    };
  }, [
    cancelPendingFocusFrame,
    collapseFeedbackFocus,
    stopViewportTracking,
    task.id,
  ]);

  useEffect(() => {
    backController.register({
      id: "task-feedback-focus",
      priority: 95,
      handle: () => {
        if (executionPresentation !== "feedback-focused") {
          return false;
        }

        collapseFeedbackFocus();
        return true;
      },
    });

    return () => backController.unregister("task-feedback-focus");
  }, [backController, collapseFeedbackFocus, executionPresentation]);

  useEffect(() => {
    backController.register({
      id: "task-guide-focus",
      priority: 94,
      handle: () => {
        if (executionPresentation !== "guide-focused") {
          return false;
        }

        collapseGuideFocus();
        return true;
      },
    });

    return () => backController.unregister("task-guide-focus");
  }, [backController, collapseGuideFocus, executionPresentation]);

  async function handleFeedback(feedback: string) {
    const trimmedFeedback = feedback.trim();
    if (!trimmedFeedback || isProcessing) {
      return;
    }

    setIsProcessing(true);
    try {
      const nextGuide = await getCompanionStep(task.id, trimmedFeedback);
      setGuide(nextGuide);
      setHasSubmittedFeedback(true);
      collapseFeedbackFocus();
    } catch {
      // Keep the focused editor and draft available for a retry.
    } finally {
      setIsProcessing(false);
    }
  }

  const isDefault = executionPresentation === "default";
  const isGuideFocused = executionPresentation === "guide-focused";
  const isFeedbackFocused = executionPresentation === "feedback-focused";
  const needsCompactHeader = !isDefault;

  return (
    <div
      ref={executionRootRef}
      className={`flex h-full min-h-0 flex-col gap-3 overflow-hidden ${
        isFeedbackFocused ? "pb-[var(--task-feedback-keyboard-inset)]" : ""
      }`}
      style={
        {
          "--task-feedback-keyboard-inset": `${keyboardInset}px`,
        } as CSSProperties
      }
    >
      {needsCompactHeader ? (
        <header className="shrink-0 pt-1">
          <div className="flex items-start justify-between gap-3 text-brand-blue">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-brand-blue/70">任务执行</p>
              <h1 className="mt-1 truncate font-serif text-xl font-semibold leading-snug text-brand-blue">
                {task.title}
              </h1>
            </div>
            <button
              className="min-h-touch shrink-0 rounded-full bg-paper px-3 text-sm font-semibold shadow-card"
              type="button"
              onClick={isGuideFocused ? collapseGuideFocus : collapseFeedbackFocus}
            >
              收起
            </button>
          </div>
        </header>
      ) : (
        <header className="shrink-0 space-y-2 pt-1">
          <div className="grid grid-cols-3 items-center text-sm font-semibold text-brand-blue">
            <button
              className="inline-flex min-h-touch items-center gap-1 justify-self-start rounded-full bg-paper px-3 shadow-card"
              type="button"
              onClick={onBack}
            >
              <IconBack size={18} />
              回到任务
            </button>
            <p className="justify-self-center whitespace-nowrap">任务执行</p>
            <button
              className="min-h-touch justify-self-end rounded-full bg-paper px-3 text-sm shadow-card"
              type="button"
              onClick={onBack}
            >
              先退出
            </button>
          </div>

          <div>
            <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">
              陪你走这一步
            </h1>
            <p className="mt-1 text-sm leading-5 text-text-secondary">
              不用一次做好，只把这一小步推进一点。
            </p>
          </div>
        </header>
      )}

      {isDefault ? <ExecutionTaskCard task={task} /> : null}

      <div
        className={
          isFeedbackFocused
            ? "hidden"
            : "flex min-h-0 flex-1 flex-col"
        }
      >
        <ExecutionGuideCard
          guide={guide}
          isProcessing={isProcessing}
          hasSubmittedFeedback={hasSubmittedFeedback}
          focused={isGuideFocused}
          onExpand={openGuideFocus}
        />
      </div>

      {isGuideFocused ? (
        <PrimaryButton
          className="shrink-0 min-h-touch py-3 text-sm"
          onClick={openFeedbackFromGuide}
        >
          写下现在的情况
        </PrimaryButton>
      ) : null}

      <div
        className={
          isGuideFocused
            ? "hidden"
            : isFeedbackFocused
              ? "flex min-h-0 flex-1 flex-col"
              : "shrink-0"
        }
      >
        <ExecutionFeedbackBox
          value={feedbackDraft}
          focused={isFeedbackFocused}
          isProcessing={isProcessing}
          textareaRef={feedbackTextareaRef}
          onChange={setFeedbackDraft}
          onFocus={openFeedbackFocus}
          onBlur={handleFeedbackBlur}
          onSubmit={handleFeedback}
        />
      </div>

      <PrimaryButton
        className="shrink-0 min-h-[44px] py-3 text-sm"
        onClick={() => onComplete(task.id)}
      >
        我完成了这一小步
      </PrimaryButton>
    </div>
  );
}
