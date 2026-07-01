import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PerformanceLabel,
  SevenDayStats,
  StatsData,
  TodayStats,
  TotalStats,
} from "@/lib/types";

interface TaskGroupRow {
  id: string;
  goal: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  task_group_id: string;
}

interface TaskGroupWithTasks extends TaskGroupRow {
  tasks: TaskRow[];
}

export interface StatsOwnerFilter {
  userId: string | null;
  deviceId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function emptyStats(): StatsData {
  return {
    today: { completedCount: 0, totalCount: 0, completionRate: null },
    sevenDay: { completedCount: 0, totalCount: 0, completionRate: null },
    total: { totalCompleted: 0, activeDayStreak: 0 },
    recentTaskGroupCount: 0,
    recentAverageTaskCount: 0,
    recentIncompleteTaskCount: 0,
    performanceLabel: "刚刚开始",
  };
}

function computeCompletionRate(completedCount: number, totalCount: number) {
  if (totalCount === 0) {
    return null;
  }

  return completedCount / totalCount;
}

function toLocalDateKey(value: Date | string, timezoneOffset: number) {
  const utcMs = value instanceof Date ? value.getTime() : new Date(value).getTime();
  const localMs = utcMs - timezoneOffset * 60 * 1000;

  return new Date(localMs).toISOString().slice(0, 10);
}

function previousDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const previousMs = Date.UTC(year, month - 1, day) - DAY_MS;

  return new Date(previousMs).toISOString().slice(0, 10);
}

export function computeSevenDayStartUTC(timezoneOffset: number) {
  const now = new Date();
  const localNowMs = now.getTime() - timezoneOffset * 60 * 1000;
  const localNow = new Date(localNowMs);
  const localTodayStartMs = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate(),
  );
  const sevenDayLocalStartMs = localTodayStartMs - 6 * DAY_MS;

  return new Date(sevenDayLocalStartMs + timezoneOffset * 60 * 1000);
}

export function computeStreak(completedAts: string[], timezoneOffset: number) {
  if (completedAts.length === 0) {
    return 0;
  }

  const completedDateKeys = new Set(
    completedAts.map((completedAt) => toLocalDateKey(completedAt, timezoneOffset)),
  );
  const todayKey = toLocalDateKey(new Date(), timezoneOffset);
  let currentDateKey = completedDateKeys.has(todayKey)
    ? todayKey
    : previousDateKey(todayKey);
  let streak = 0;

  while (completedDateKeys.has(currentDateKey)) {
    streak += 1;
    currentDateKey = previousDateKey(currentDateKey);
  }

  return streak;
}

function countTasks(taskGroups: TaskGroupWithTasks[]) {
  return taskGroups.reduce(
    (stats, taskGroup) => {
      for (const task of taskGroup.tasks) {
        stats.totalCount += 1;

        if (task.completed) {
          stats.completedCount += 1;
        }
      }

      return stats;
    },
    { completedCount: 0, totalCount: 0 },
  );
}

export function computePerformanceLabel(
  sevenDayRate: number | null,
  streak: number,
  totalCompleted: number,
): PerformanceLabel {
  if (totalCompleted === 0 || sevenDayRate === null) {
    return "刚刚开始";
  }

  if (sevenDayRate < 0.5) {
    return "有点吃力";
  }

  if (sevenDayRate >= 0.7 && streak >= 3) {
    return "稳定行动";
  }

  return "刚刚开始";
}

async function fetchTaskGroups(
  supabase: SupabaseClient,
  ownerFilter: StatsOwnerFilter,
) {
  let query = supabase
    .from("task_groups")
    .select("id, goal, created_at, updated_at, archived_at")
    .order("updated_at", { ascending: false });

  if (ownerFilter.userId) {
    query = query.eq("user_id", ownerFilter.userId);
  } else {
    query = query.eq("device_id", ownerFilter.deviceId).is("user_id", null);
  }

  const { data, error } = await query.returns<TaskGroupRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function fetchTasks(supabase: SupabaseClient, taskGroupIds: string[]) {
  if (taskGroupIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, completed, completed_at, task_group_id")
    .in("task_group_id", taskGroupIds)
    .returns<TaskRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

function attachTasksToGroups(
  groups: TaskGroupRow[],
  tasks: TaskRow[],
): TaskGroupWithTasks[] {
  const tasksByGroupId = new Map<string, TaskRow[]>();

  for (const task of tasks) {
    const groupTasks = tasksByGroupId.get(task.task_group_id) ?? [];

    groupTasks.push(task);
    tasksByGroupId.set(task.task_group_id, groupTasks);
  }

  return groups.map((group) => ({
    ...group,
    tasks: tasksByGroupId.get(group.id) ?? [],
  }));
}

export function computeTodayStats(groups: TaskGroupWithTasks[]): TodayStats {
  const activeGroup =
    groups
      .filter((group) => group.archived_at === null)
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )[0] ?? null;

  if (!activeGroup) {
    return { completedCount: 0, totalCount: 0, completionRate: null };
  }

  const completedCount = activeGroup.tasks.filter((task) => task.completed).length;
  const totalCount = activeGroup.tasks.length;

  return {
    completedCount,
    totalCount,
    completionRate: computeCompletionRate(completedCount, totalCount),
  };
}

export function computeSevenDayStats(
  groups: TaskGroupWithTasks[],
  timezoneOffset: number,
): SevenDayStats {
  const sevenDayStartUTC = computeSevenDayStartUTC(timezoneOffset);
  const sevenDayGroups = groups.filter(
    (group) => new Date(group.created_at).getTime() >= sevenDayStartUTC.getTime(),
  );
  const { completedCount, totalCount } = countTasks(sevenDayGroups);

  return {
    completedCount,
    totalCount,
    completionRate: computeCompletionRate(completedCount, totalCount),
  };
}

export function computeTotalStats(
  groups: TaskGroupWithTasks[],
  timezoneOffset: number,
): TotalStats {
  const allTasks = groups.flatMap((group) => group.tasks);
  const completedAts = allTasks
    .map((task) => task.completed_at)
    .filter((completedAt): completedAt is string => Boolean(completedAt));

  return {
    totalCompleted: allTasks.filter((task) => task.completed).length,
    activeDayStreak: computeStreak(completedAts, timezoneOffset),
  };
}

export async function computeAllStats(
  supabase: SupabaseClient,
  ownerFilter: StatsOwnerFilter,
  timezoneOffset: number,
): Promise<StatsData> {
  const groups = await fetchTaskGroups(supabase, ownerFilter);

  if (groups.length === 0) {
    return emptyStats();
  }

  const tasks = await fetchTasks(
    supabase,
    groups.map((group) => group.id),
  );
  const groupsWithTasks = attachTasksToGroups(groups, tasks);
  const today = computeTodayStats(groupsWithTasks);
  const sevenDay = computeSevenDayStats(groupsWithTasks, timezoneOffset);
  const total = computeTotalStats(groupsWithTasks, timezoneOffset);
  const sevenDayStartUTC = computeSevenDayStartUTC(timezoneOffset);
  const recentGroups = groupsWithTasks.filter(
    (group) => new Date(group.created_at).getTime() >= sevenDayStartUTC.getTime(),
  );
  const recentTaskCount = recentGroups.reduce(
    (count, group) => count + group.tasks.length,
    0,
  );
  const recentTaskGroupCount = recentGroups.length;
  const recentAverageTaskCount =
    recentTaskGroupCount === 0
      ? 0
      : Math.round((recentTaskCount / recentTaskGroupCount) * 10) / 10;
  const recentIncompleteTaskCount = recentGroups.reduce(
    (count, group) =>
      count + group.tasks.filter((task) => !task.completed).length,
    0,
  );

  return {
    today,
    sevenDay,
    total,
    recentTaskGroupCount,
    recentAverageTaskCount,
    recentIncompleteTaskCount,
    performanceLabel: computePerformanceLabel(
      sevenDay.completionRate,
      total.activeDayStreak,
      total.totalCompleted,
    ),
  };
}
