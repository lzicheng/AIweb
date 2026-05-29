import { normalizeTaskSteps } from "./taskTimeline";

export const buildFocusTaskSteps = ({
  externalStepStateMap,
  task,
  taskIndex,
}) => {
  if (!task) return [];

  return normalizeTaskSteps(task, taskIndex).map((step) => {
    if (!step.id) return step;

    const runtime = externalStepStateMap[step.id];
    return {
      ...step,
      message: runtime?.message || "",
      status: runtime?.status || "pending",
    };
  });
};

export const summarizeFocusTaskSteps = (steps) => {
  const statuses = steps
    .filter((step) => step.id)
    .map((step) => step.status);

  if (statuses.includes("error")) return "任务存在异常，请关注并处理。";
  if (statuses.length > 0 && statuses.every((status) => status === "success"))
    return "任务步骤已完成。";
  if (statuses.includes("running")) return "任务执行中。";
  return "任务等待外部事件或时间驱动更新。";
};
