"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewData, ReviewResponse } from "@/lib/types";

interface UseTaskReviewOptions {
  taskGroupId: string | undefined;
  taskGroupUpdatedAt: string | undefined;
  taskCount: number;
  deviceId: string;
  timezoneOffset: number;
}

interface UseTaskReviewReturn {
  review: ReviewData | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  generateReview: () => Promise<void>;
  resetReview: () => void;
}

const DEFAULT_ERROR_MESSAGE = "复盘生成失败，请稍后重试。";
const NETWORK_ERROR_MESSAGE = "网络连接失败，请检查网络后重试。";

export function useTaskReview({
  taskGroupId,
  taskGroupUpdatedAt,
  taskCount,
  deviceId,
  timezoneOffset,
}: UseTaskReviewOptions): UseTaskReviewReturn {
  const [review, setReview] = useState<ReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const inflightRef = useRef<Promise<void> | null>(null);
  const reviewedAtVersionRef = useRef<string | null>(null);
  const taskGroupIdRef = useRef<string | undefined>(taskGroupId);

  const resetReview = useCallback(() => {
    setReview(null);
    setIsLoading(false);
    setError(null);
    setIsStale(false);
    reviewedAtVersionRef.current = null;
    inflightRef.current = null;
  }, []);

  const generateReview = useCallback(async () => {
    if (!taskGroupId || taskCount === 0) {
      return;
    }

    if (inflightRef.current) {
      return inflightRef.current;
    }

    const requestTaskGroupId = taskGroupId;
    const requestTaskGroupUpdatedAt = taskGroupUpdatedAt;

    const promise = (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/task-groups/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
            taskGroupId,
            timezoneOffset,
          }),
        });
        const result = (await response.json()) as ReviewResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.success ? DEFAULT_ERROR_MESSAGE : result.error.message,
          );
        }

        if (taskGroupIdRef.current !== requestTaskGroupId) {
          return;
        }

        reviewedAtVersionRef.current = requestTaskGroupUpdatedAt ?? null;
        setReview(result.data);
        setError(null);
        setIsStale(false);
      } catch (reviewError) {
        if (taskGroupIdRef.current !== requestTaskGroupId) {
          return;
        }

        setError(
          reviewError instanceof TypeError
            ? NETWORK_ERROR_MESSAGE
            : reviewError instanceof Error && reviewError.message
              ? reviewError.message
              : DEFAULT_ERROR_MESSAGE,
        );
      } finally {
        setIsLoading(false);
        inflightRef.current = null;
      }
    })();

    inflightRef.current = promise;
    return promise;
  }, [deviceId, taskCount, taskGroupId, taskGroupUpdatedAt, timezoneOffset]);

  useEffect(() => {
    if (taskGroupIdRef.current === taskGroupId) {
      return;
    }

    taskGroupIdRef.current = taskGroupId;
    resetReview();
  }, [resetReview, taskGroupId]);

  useEffect(() => {
    if (!review || !taskGroupId || !reviewedAtVersionRef.current) {
      return;
    }

    if (taskGroupUpdatedAt !== reviewedAtVersionRef.current) {
      setIsStale(true);
    }
  }, [review, taskGroupId, taskGroupUpdatedAt]);

  return {
    review,
    isLoading,
    error,
    isStale,
    generateReview,
    resetReview,
  };
}
