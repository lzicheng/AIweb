const isAbsoluteUrl = (value) => /^[a-z][a-z\d+\-.]*:/i.test(value);

const toRequestUrl = (tasksUrl) => {
  const url = new URL(tasksUrl, window.location.origin);
  return isAbsoluteUrl(tasksUrl) ? url.toString() : `${url.pathname}${url.search}`;
};

const hasValidStep = (step) => {
  if (typeof step === "string") return step.trim().length > 0;
  return typeof step?.text === "string" && step.text.trim().length > 0;
};

const hasValidTask = (task) => {
  if (!task || typeof task !== "object") return false;
  if (typeof task.time !== "string" || !/^\d{1,2}:\d{2}$/.test(task.time.trim())) {
    return false;
  }
  if (typeof task.title !== "string" || !task.title.trim()) return false;
  return Array.isArray(task.steps) && task.steps.some(hasValidStep);
};

const normalizePayload = (payload) => {
  const tasks = Array.isArray(payload) ? payload : payload?.tasks;
  if (!Array.isArray(tasks) || !tasks.length) return null;
  if (!tasks.every(hasValidTask)) return null;
  return tasks;
};

export const fetchDailyTasks = async ({
  fallbackTasks,
  fetchImpl = fetch,
  tasksUrl,
}) => {
  if (typeof tasksUrl !== "string" || !tasksUrl.trim()) {
    return fallbackTasks;
  }

  try {
    const response = await fetchImpl(toRequestUrl(tasksUrl.trim()), {
      headers: { accept: "application/json" },
    });

    if (!response.ok) return fallbackTasks;

    const tasks = normalizePayload(await response.json());
    return tasks ?? fallbackTasks;
  } catch {
    return fallbackTasks;
  }
};
