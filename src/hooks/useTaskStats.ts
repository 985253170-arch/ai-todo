"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type { StatsData, StatsResponse } from "@/lib/types";

const DEFAULT_ERROR_MESSAGE = "统计数据加载失败，请稍后重试。";

export function useTaskStats() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);

  const refreshStats = useCallback(async () => {
    if (inflightRef.current) {
      return inflightRef.current;
    }

    const promise = (async () => {
      setError(null);

      try {
        const deviceId = getOrCreateDeviceId();
        const timezoneOffset = new Date().getTimezoneOffset();
        const params = new URLSearchParams({
          deviceId,
          timezoneOffset: String(timezoneOffset),
        });
        const response = await fetch(`/api/task-groups/stats?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as StatsResponse;

        if (!response.ok || !result.success) {
          throw new Error(result.success ? DEFAULT_ERROR_MESSAGE : result.error.message);
        }

        setStats(result.data);
      } catch (statsError) {
        setError(
          statsError instanceof Error ? statsError.message : DEFAULT_ERROR_MESSAGE,
        );
      } finally {
        setIsLoading(false);
        inflightRef.current = null;
      }
    })();

    inflightRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshStats();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthLoading, refreshStats, user?.id]);

  return {
    stats,
    isLoading,
    error,
    refreshStats,
  };
}
