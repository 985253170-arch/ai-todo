"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type { HistoryTaskGroupsResponse, TaskGroup } from "@/lib/types";

const HISTORY_PAGE_SIZE = 30;
const DEFAULT_ERROR_MESSAGE = "加载失败，请稍后重试。";

export function useTaskHistory() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [historyList, setHistoryList] = useState<TaskGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const deviceId = getOrCreateDeviceId();
      const params = new URLSearchParams({
        deviceId,
        limit: String(HISTORY_PAGE_SIZE),
      });
      const response = await fetch(`/api/task-groups/history?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as HistoryTaskGroupsResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.success ? DEFAULT_ERROR_MESSAGE : result.error.message);
      }

      setHistoryList(result.data);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setHistoryList([]);
      setHasMore(false);
      setError(loadError instanceof Error ? loadError.message : DEFAULT_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || isLoading || !hasMore || historyList.length === 0) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      const deviceId = getOrCreateDeviceId();
      const cursor = historyList[historyList.length - 1]?.createdAt;
      const params = new URLSearchParams({
        deviceId,
        limit: String(HISTORY_PAGE_SIZE),
      });

      if (cursor) {
        params.set("cursor", cursor);
      }

      const response = await fetch(`/api/task-groups/history?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as HistoryTaskGroupsResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.success ? DEFAULT_ERROR_MESSAGE : result.error.message);
      }

      setHistoryList((currentList) => [...currentList, ...result.data]);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : DEFAULT_ERROR_MESSAGE);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, historyList, isLoading, isLoadingMore]);

  const refreshHistory = useCallback(async () => {
    await loadHistory();
  }, [loadHistory]);

  const togglePanel = useCallback(() => {
    setIsOpen((currentValue) => !currentValue);
  }, []);

  useEffect(() => {
    if (!isOpen || isAuthLoading) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadHistory();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthLoading, isOpen, loadHistory, user?.id]);

  return {
    historyList,
    isLoading,
    isLoadingMore,
    hasMore,
    isOpen,
    error,
    togglePanel,
    loadHistory,
    loadMore,
    refreshHistory,
  };
}
