import { useEffect, useState } from "react";
import { APP_CONFIG } from "./appConfig";
import { fetchDailyTasks } from "./dailyTasksApi";
import { DEFAULT_DAILY_TASKS } from "./dailyTasks";

export function useDailyTasks({
  fallbackTasks = DEFAULT_DAILY_TASKS,
  fetchImpl = fetch,
  refreshMs = 30_000,
  tasksUrl = APP_CONFIG.dailyTasksUrl,
} = {}) {
  const [tasks, setTasks] = useState(fallbackTasks);
  const [error, setError] = useState(null);

  useEffect(() => {
    let disposed = false;

    const pullTasks = async () => {
      try {
        const nextTasks = await fetchDailyTasks({
          fallbackTasks,
          fetchImpl,
          tasksUrl,
        });
        if (disposed) return;
        setTasks(nextTasks);
        setError(null);
      } catch (nextError) {
        if (disposed) return;
        setTasks(fallbackTasks);
        setError(nextError);
      }
    };

    pullTasks();

    if (!refreshMs || refreshMs <= 0) {
      return () => {
        disposed = true;
      };
    }

    const timer = window.setInterval(pullTasks, refreshMs);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [fallbackTasks, fetchImpl, refreshMs, tasksUrl]);

  return {
    error,
    tasks,
  };
}
